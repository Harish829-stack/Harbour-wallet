// Package evmtx reads the few fields Harbour needs from a signed EVM
// transaction (hash, nonce, chain id) without a full Ethereum library. It
// never signs and never sees a key.
package evmtx

import (
	"encoding/hex"
	"errors"
	"math/big"
	"strings"

	"golang.org/x/crypto/sha3"
)

// Info is what Harbour reads from a signed transaction.
type Info struct {
	Hash    string // 0x-prefixed keccak256 of the raw bytes
	Type    byte   // 0 legacy, 1, 2, 3 or 4
	Nonce   uint64
	ChainID *big.Int // nil for pre-EIP-155 legacy transactions
}

var errRLP = errors.New("evmtx: malformed transaction")

// Decode parses a 0x-hex signed transaction.
func Decode(rawHex string) (Info, []byte, error) {
	raw, err := hex.DecodeString(strings.TrimPrefix(strings.TrimSpace(rawHex), "0x"))
	if err != nil || len(raw) < 3 || len(raw) > 256<<10 {
		return Info{}, nil, errors.New("evmtx: not a hex transaction")
	}
	h := sha3.NewLegacyKeccak256()
	h.Write(raw)
	info := Info{Hash: "0x" + hex.EncodeToString(h.Sum(nil))}
	body := raw
	if raw[0] < 0x7f { // typed envelope
		info.Type = raw[0]
		if info.Type > 4 {
			return Info{}, nil, errors.New("evmtx: unknown transaction type")
		}
		body = raw[1:]
	}
	items, err := list(body)
	if err != nil {
		return Info{}, nil, err
	}
	if info.Type == 0 {
		if len(items) != 9 {
			return Info{}, nil, errRLP
		}
		if info.Nonce, err = uint(items[0]); err != nil {
			return Info{}, nil, err
		}
		v := new(big.Int).SetBytes(items[6])
		if v.Cmp(big.NewInt(35)) >= 0 { // EIP-155: v = chainId*2 + 35/36
			info.ChainID = new(big.Int).Div(new(big.Int).Sub(v, big.NewInt(35)), big.NewInt(2))
		}
		return info, raw, nil
	}
	if len(items) < 8 {
		return Info{}, nil, errRLP
	}
	info.ChainID = new(big.Int).SetBytes(items[0])
	if info.Nonce, err = uint(items[1]); err != nil {
		return Info{}, nil, err
	}
	return info, raw, nil
}

func uint(b []byte) (uint64, error) {
	if len(b) > 8 {
		return 0, errRLP
	}
	var n uint64
	for _, c := range b {
		n = n<<8 | uint64(c)
	}
	return n, nil
}

// header decodes one RLP item header: (isList, payload offset, payload length).
func header(b []byte) (bool, int, int, error) {
	if len(b) == 0 {
		return false, 0, 0, errRLP
	}
	p := b[0]
	switch {
	case p < 0x80:
		return false, 0, 1, nil
	case p <= 0xb7:
		return false, 1, int(p - 0x80), nil
	case p <= 0xbf:
		n := int(p - 0xb7)
		l, err := beLen(b, n)
		return false, 1 + n, l, err
	case p <= 0xf7:
		return true, 1, int(p - 0xc0), nil
	default:
		n := int(p - 0xf7)
		l, err := beLen(b, n)
		return true, 1 + n, l, err
	}
}

func beLen(b []byte, n int) (int, error) {
	if n > 4 || len(b) < 1+n {
		return 0, errRLP
	}
	l := 0
	for _, c := range b[1 : 1+n] {
		l = l<<8 | int(c)
	}
	return l, nil
}

// list decodes a top-level RLP list into its items' payloads (nested lists
// such as access lists are returned as raw payloads).
func list(b []byte) ([][]byte, error) {
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
		if rest[0] < 0x80 {
			items = append(items, rest[:1])
		} else {
			items = append(items, rest[o:o+n])
		}
		rest = rest[o+n:]
	}
	return items, nil
}
