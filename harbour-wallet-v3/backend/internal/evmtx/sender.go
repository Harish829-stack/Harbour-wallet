package evmtx

import (
	"encoding/hex"
	"errors"
	"math/big"

	"github.com/decred/dcrd/dcrec/secp256k1/v4/ecdsa"
	"golang.org/x/crypto/sha3"
)

// Sender recovers the signing address (lowercase 0x hex) of a raw signed
// transaction. Harbour uses it only to check the sender is an address the
// device tracks; it never signs.
func Sender(raw []byte) (string, error) {
	if len(raw) == 0 {
		return "", errRLP
	}
	var typ byte
	body := raw
	if raw[0] < 0x7f {
		typ, body = raw[0], raw[1:]
	}
	items, err := rawItems(body)
	if err != nil {
		return "", err
	}
	n := len(items)
	if n < 9 {
		return "", errRLP
	}
	v, r, s := payload(items[n-3]), payload(items[n-2]), payload(items[n-1])
	if len(r) > 32 || len(s) > 32 {
		return "", errRLP
	}
	var signing []byte
	var recID int64
	if typ == 0 {
		if n != 9 {
			return "", errRLP
		}
		vb := new(big.Int).SetBytes(v)
		var fields []byte
		for _, it := range items[:6] {
			fields = append(fields, it...)
		}
		switch {
		case vb.Cmp(big.NewInt(35)) >= 0:
			chainID := new(big.Int).Div(new(big.Int).Sub(vb, big.NewInt(35)), big.NewInt(2))
			recID = new(big.Int).Sub(vb, new(big.Int).Add(big.NewInt(35), new(big.Int).Lsh(chainID, 1))).Int64()
			fields = append(fields, EncodeBig(chainID)...)
			fields = append(fields, 0x80, 0x80)
		case vb.Cmp(big.NewInt(27)) == 0 || vb.Cmp(big.NewInt(28)) == 0:
			recID = vb.Int64() - 27
		default:
			return "", errRLP
		}
		signing = EncodeList(fields)
	} else {
		var fields []byte
		for _, it := range items[:n-3] {
			fields = append(fields, it...)
		}
		signing = append([]byte{typ}, EncodeList(fields)...)
		recID = new(big.Int).SetBytes(v).Int64()
	}
	if recID != 0 && recID != 1 {
		return "", errors.New("evmtx: invalid signature")
	}
	sig := make([]byte, 65)
	sig[0] = byte(27 + recID)
	copy(sig[33-len(r):33], r)
	copy(sig[65-len(s):], s)
	pub, _, err := ecdsa.RecoverCompact(sig, Keccak(signing))
	if err != nil {
		return "", errors.New("evmtx: invalid signature")
	}
	return "0x" + hex.EncodeToString(Keccak(pub.SerializeUncompressed()[1:])[12:]), nil
}

// Keccak is legacy Keccak-256.
func Keccak(b []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(b)
	return h.Sum(nil)
}

// rawItems splits a top-level RLP list into each item's full encoding.
func rawItems(b []byte) ([][]byte, error) {
	isList, off, l, err := header(b)
	if err != nil || !isList || off+l != len(b) {
		return nil, errRLP
	}
	var items [][]byte
	rest := b[off:]
	for len(rest) > 0 {
		_, o, n, err := header(rest)
		if err != nil || o+n > len(rest) {
			return nil, errRLP
		}
		items = append(items, rest[:o+n])
		rest = rest[o+n:]
	}
	return items, nil
}

func payload(item []byte) []byte {
	_, o, n, err := header(item)
	if err != nil {
		return nil
	}
	return item[o : o+n]
}

// ---------- RLP encoding (used to rebuild signing payloads) ----------

func rlpHeader(base byte, l int) []byte {
	if l <= 55 {
		return []byte{base + byte(l)}
	}
	var lb []byte
	for x := l; x > 0; x >>= 8 {
		lb = append([]byte{byte(x)}, lb...)
	}
	return append([]byte{base + 55 + byte(len(lb))}, lb...)
}

// EncodeBytes RLP-encodes a byte string.
func EncodeBytes(b []byte) []byte {
	if len(b) == 1 && b[0] < 0x80 {
		return []byte{b[0]}
	}
	return append(rlpHeader(0x80, len(b)), b...)
}

// EncodeBig RLP-encodes a non-negative integer.
func EncodeBig(n *big.Int) []byte {
	if n == nil || n.Sign() == 0 {
		return []byte{0x80}
	}
	return EncodeBytes(n.Bytes())
}

// EncodeUint RLP-encodes a uint64.
func EncodeUint(n uint64) []byte { return EncodeBig(new(big.Int).SetUint64(n)) }

// EncodeList wraps already-encoded items in a list header.
func EncodeList(payload []byte) []byte { return append(rlpHeader(0xc0, len(payload)), payload...) }
