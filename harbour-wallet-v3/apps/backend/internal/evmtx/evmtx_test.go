package evmtx

import "testing"

// Vectors: EIP-155 example (legacy, chain 1, nonce 9) and an EIP-1559 tx
// (chain 84532, nonce 7) built by hand.
func TestDecode(t *testing.T) {
	legacy := "0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83"
	in, _, err := Decode(legacy)
	if err != nil || in.Type != 0 || in.Nonce != 9 || in.ChainID.Int64() != 1 ||
		in.Hash != "0x33469b22e9f636356c4160a87eb19df52b7412e8eac32a4a55ffe88ea8350788" {
		t.Fatalf("legacy %+v %v", in, err)
	}
	// 0x02 || rlp([chainId=84532, nonce=7, tip, maxFee, gas, to, value, data, accessList, v, r, s])
	typed := "0x02f87383014a3407843b9aca0084773594008252089435353535353535353535353535353535353535358609184e72a00080c001a0" +
		"1111111111111111111111111111111111111111111111111111111111111111a0" +
		"2222222222222222222222222222222222222222222222222222222222222222"
	in, _, err = Decode(typed)
	if err != nil || in.Type != 2 || in.Nonce != 7 || in.ChainID.Int64() != 84532 {
		t.Fatalf("1559 %+v %v", in, err)
	}
	for _, bad := range []string{"", "0x", "zz", "0x02c0", "0xf800"} {
		if _, _, err := Decode(bad); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
}
