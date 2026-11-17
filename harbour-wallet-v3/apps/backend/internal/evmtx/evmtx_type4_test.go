package evmtx

import (
	"strings"
	"testing"
)

const type4Acct = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

var type4Raws = map[string]string{"upgrade": "0x04f8cf83aa36a702843b9aca0084b2d05e00830186a094f39fd6e51aad88f6f4ce6ab8827279cfffb922668080c0f85ff85d83aa36a79463c0c19a282a1b52b07dd5a65b58948a07dae32b0380a07f60e0cccae83c2a064fc8de4b941315377b5b98235112d5d9f7018fb02cf1b8a002e9811c0c6ddc514ffea6961c8ef2c7bafaba2fd54e73d0d72226ff9425734b01a0e5f55c739d08048c345a35099e9ffffd9b7fe02dfdc2a593dae93fdccad013bba010ad85c714f7cab9099333ac740021116c597d79a67fe1929ecfa9a5f2ceb80f", "revoke": "0x04f8cf83aa36a702843b9aca0084b2d05e00830186a094f39fd6e51aad88f6f4ce6ab8827279cfffb922668080c0f85ff85d83aa36a79400000000000000000000000000000000000000000380a01ecb7ac4202ed09ca8c415cdd85d0e69a7eac844f150b5315d5b195bb0fc707fa0153d40c55bc4da257010ea44f74af20455cf066682f243a0fcaaa4b3d6f3ddae01a0532cd61f8badab069b3950dbcc9cd5acf6ca1b95dc7ffb025f48e07b7afb6d54a073b2d17ab1af0404d92a79a1be5809d44609998752c0ef9b28c0e477eeb68818"}

func TestType4DecodeAndSender(t *testing.T) {
	for name, raw := range type4Raws {
		info, b, err := Decode(raw)
		if err != nil {
			t.Fatalf("%s: decode: %v", name, err)
		}
		if info.Type != 4 || info.ChainID.Uint64() != 11155111 || info.Nonce != 2 {
			t.Fatalf("%s: bad info %+v", name, info)
		}
		from, err := Sender(b)
		if err != nil {
			t.Fatalf("%s: sender: %v", name, err)
		}
		if !strings.EqualFold(from, type4Acct) {
			t.Fatalf("%s: sender %s != %s", name, from, type4Acct)
		}
		t.Logf("%s ok: type=%d chain=%s nonce=%d from=%s hash=%s", name, info.Type, info.ChainID, info.Nonce, from, info.Hash)
	}
}
