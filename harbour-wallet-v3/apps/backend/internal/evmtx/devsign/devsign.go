// Package devsign signs EIP-1559 transactions for developer tools and tests
// (hbdevice send on testnets). Harbour services never import it: the
// extension signs on the user's device.
package devsign

import (
	"encoding/hex"
	"errors"
	"math/big"
	"strings"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/decred/dcrd/dcrec/secp256k1/v4/ecdsa"

	"harbour/backend/internal/evmtx"
)

// Tx is an EIP-1559 (type 2) transaction.
type Tx struct {
	ChainID uint64
	Nonce   uint64
	TipCap  *big.Int
	FeeCap  *big.Int
	Gas     uint64
	To      string // 0x address
	Value   *big.Int
	Data    []byte
}

// ParseKey reads a 0x-hex private key.
func ParseKey(h string) (*secp256k1.PrivateKey, error) {
	b, err := hex.DecodeString(strings.TrimPrefix(strings.TrimSpace(h), "0x"))
	if err != nil || len(b) != 32 {
		return nil, errors.New("devsign: private key must be 32 bytes of hex")
	}
	return secp256k1.PrivKeyFromBytes(b), nil
}

// Address is the key's EVM address.
func Address(k *secp256k1.PrivateKey) string {
	return "0x" + hex.EncodeToString(evmtx.Keccak(k.PubKey().SerializeUncompressed()[1:])[12:])
}

// Sign returns the raw signed transaction.
func Sign(k *secp256k1.PrivateKey, t Tx) ([]byte, error) {
	to, err := hex.DecodeString(strings.TrimPrefix(t.To, "0x"))
	if err != nil || len(to) != 20 {
		return nil, errors.New("devsign: bad to address")
	}
	var f []byte
	f = append(f, evmtx.EncodeUint(t.ChainID)...)
	f = append(f, evmtx.EncodeUint(t.Nonce)...)
	f = append(f, evmtx.EncodeBig(t.TipCap)...)
	f = append(f, evmtx.EncodeBig(t.FeeCap)...)
	f = append(f, evmtx.EncodeUint(t.Gas)...)
	f = append(f, evmtx.EncodeBytes(to)...)
	f = append(f, evmtx.EncodeBig(t.Value)...)
	f = append(f, evmtx.EncodeBytes(t.Data)...)
	f = append(f, 0xc0) // empty access list
	hash := evmtx.Keccak(append([]byte{2}, evmtx.EncodeList(f)...))
	sig := ecdsa.SignCompact(k, hash, false) // [27+v] r s
	f = append(f, evmtx.EncodeUint(uint64(sig[0]-27))...)
	f = append(f, evmtx.EncodeBig(new(big.Int).SetBytes(sig[1:33]))...)
	f = append(f, evmtx.EncodeBig(new(big.Int).SetBytes(sig[33:]))...)
	return append([]byte{2}, evmtx.EncodeList(f)...), nil
}
