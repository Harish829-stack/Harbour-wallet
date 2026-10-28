package evm

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"unicode/utf8"
)

// Multicall3 is deployed at the same address on every EVM chain Harbour serves.
const Multicall3 = "0xca11bde05977b3631167028862be2a173976ca11"

// Function selectors (first 4 bytes of keccak256 of the signature; checked in tests).
var (
	selAggregate3    = mustHex("82ad56cb") // aggregate3((address,bool,bytes)[])
	selGetEthBalance = mustHex("4d2301cc") // getEthBalance(address)
	selBalanceOf     = mustHex("70a08231") // balanceOf(address)
	selDecimals      = mustHex("313ce567") // decimals()
	selSymbol        = mustHex("95d89b41") // symbol()
	selName          = mustHex("06fdde03") // name()
)

func mustHex(s string) []byte {
	b, err := hex.DecodeString(s)
	if err != nil {
		panic(err)
	}
	return b
}

func word(b []byte) []byte { // left-pad to 32 bytes
	out := make([]byte, 32)
	copy(out[32-len(b):], b)
	return out
}

func uintWord(n uint64) []byte { return word(new(big.Int).SetUint64(n).Bytes()) }

func addrWord(addr string) ([]byte, error) {
	b, err := hex.DecodeString(strings.TrimPrefix(strings.ToLower(addr), "0x"))
	if err != nil || len(b) != 20 {
		return nil, fmt.Errorf("bad address %q", addr)
	}
	return word(b), nil
}

func pad32(b []byte) []byte {
	if r := len(b) % 32; r != 0 {
		return append(b, make([]byte, 32-r)...)
	}
	return b
}

// call3 is one Multicall3 sub-call.
type call3 struct {
	target string
	data   []byte
}

// encodeAggregate3 encodes aggregate3(Call3[]) with allowFailure = true.
func encodeAggregate3(calls []call3) ([]byte, error) {
	n := len(calls)
	// Each tuple: target, allowFailure, offset(bytes)=0x60, len, data(padded).
	tuples := make([][]byte, n)
	for i, c := range calls {
		t, err := addrWord(c.target)
		if err != nil {
			return nil, err
		}
		t = append(t, uintWord(1)...)
		t = append(t, uintWord(0x60)...)
		t = append(t, uintWord(uint64(len(c.data)))...)
		t = append(t, pad32(append([]byte{}, c.data...))...)
		tuples[i] = t
	}
	out := append([]byte{}, selAggregate3...)
	out = append(out, uintWord(0x20)...)      // offset of the array
	out = append(out, uintWord(uint64(n))...) // array length
	off := uint64(32 * n)                     // tuple offsets, relative to after the length word
	for _, t := range tuples {
		out = append(out, uintWord(off)...)
		off += uint64(len(t))
	}
	for _, t := range tuples {
		out = append(out, t...)
	}
	return out, nil
}

// result3 is one Multicall3 sub-result.
type result3 struct {
	success bool
	data    []byte
}

var errShort = errors.New("abi: short data")

func readWord(b []byte, at uint64) ([]byte, error) {
	if at+32 > uint64(len(b)) || at+32 < at {
		return nil, errShort
	}
	return b[at : at+32], nil
}

func readUint(b []byte, at uint64) (uint64, error) {
	w, err := readWord(b, at)
	if err != nil {
		return 0, err
	}
	v := new(big.Int).SetBytes(w)
	if !v.IsUint64() || v.Uint64() > 1<<32 {
		return 0, errors.New("abi: offset too large")
	}
	return v.Uint64(), nil
}

// decodeAggregate3 decodes (bool success, bytes returnData)[].
func decodeAggregate3(b []byte) ([]result3, error) {
	arrOff, err := readUint(b, 0)
	if err != nil {
		return nil, err
	}
	n, err := readUint(b, arrOff)
	if err != nil {
		return nil, err
	}
	base := arrOff + 32
	out := make([]result3, n)
	for i := uint64(0); i < n; i++ {
		tOff, err := readUint(b, base+32*i)
		if err != nil {
			return nil, err
		}
		t := base + tOff
		okw, err := readWord(b, t)
		if err != nil {
			return nil, err
		}
		dOff, err := readUint(b, t+32)
		if err != nil {
			return nil, err
		}
		l, err := readUint(b, t+dOff)
		if err != nil {
			return nil, err
		}
		start := t + dOff + 32
		if start+l > uint64(len(b)) {
			return nil, errShort
		}
		out[i] = result3{success: okw[31] == 1, data: b[start : start+l]}
	}
	return out, nil
}

// decodeUint256 decodes a single uint256 return value.
func decodeUint256(b []byte) (*big.Int, bool) {
	if len(b) < 32 {
		return nil, false
	}
	return new(big.Int).SetBytes(b[:32]), true
}

// decodeString decodes a string return value, or a bytes32 (old tokens such as MKR).
func decodeString(b []byte) (string, bool) {
	if len(b) == 32 { // bytes32
		s := strings.TrimRight(string(b), "\x00")
		return cleanText(s), utf8.ValidString(s)
	}
	off, err := readUint(b, 0)
	if err != nil {
		return "", false
	}
	l, err := readUint(b, off)
	if err != nil || off+32+l > uint64(len(b)) {
		return "", false
	}
	s := string(b[off+32 : off+32+l])
	if !utf8.ValidString(s) {
		return "", false
	}
	return cleanText(s), true
}

func cleanText(s string) string {
	s = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, s)
	if len(s) > 128 {
		s = s[:128]
	}
	return strings.TrimSpace(s)
}
