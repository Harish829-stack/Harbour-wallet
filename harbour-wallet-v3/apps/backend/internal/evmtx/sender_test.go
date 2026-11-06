package evmtx_test

import (
	"encoding/hex"
	"math/big"
	"testing"

	"harbour/backend/internal/evmtx"
	"harbour/backend/internal/evmtx/devsign"
)

func TestSender(t *testing.T) {
	// EIP-155 example: key 0x4646…46 signs as 0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f.
	legacy := "f86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83"
	raw, _ := hex.DecodeString(legacy)
	if from, err := evmtx.Sender(raw); err != nil || from != "0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f" {
		t.Fatalf("legacy sender %s %v", from, err)
	}
	k, _ := devsign.ParseKey("0x4646464646464646464646464646464646464646464646464646464646464646")
	if a := devsign.Address(k); a != "0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f" {
		t.Fatalf("address %s", a)
	}
	signed, err := devsign.Sign(k, devsign.Tx{ChainID: 84532, Nonce: 7, TipCap: big.NewInt(1e9), FeeCap: big.NewInt(2e9),
		Gas: 21000, To: "0x3535353535353535353535353535353535353535", Value: big.NewInt(1e15)})
	if err != nil {
		t.Fatal(err)
	}
	info, _, err := evmtx.Decode("0x" + hex.EncodeToString(signed))
	if err != nil || info.Nonce != 7 || info.ChainID.Uint64() != 84532 {
		t.Fatalf("decode %+v %v", info, err)
	}
	if from, err := evmtx.Sender(signed); err != nil || from != devsign.Address(k) {
		t.Fatalf("1559 sender %s %v", from, err)
	}
	signed[len(signed)-1] ^= 1 // tamper with s
	if from, _ := evmtx.Sender(signed); from == devsign.Address(k) {
		t.Fatal("tampered signature recovered the same sender")
	}
}
