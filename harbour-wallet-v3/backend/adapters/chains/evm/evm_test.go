package evm

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golang.org/x/crypto/sha3"

	"harbour/backend/contracttest"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/rpc"
)

func selector(sig string) string {
	h := sha3.NewLegacyKeccak256()
	h.Write([]byte(sig))
	return hex.EncodeToString(h.Sum(nil)[:4])
}

func TestSelectors(t *testing.T) {
	for sig, got := range map[string][]byte{
		"aggregate3((address,bool,bytes)[])": selAggregate3,
		"getEthBalance(address)":             selGetEthBalance,
		"balanceOf(address)":                 selBalanceOf,
		"decimals()":                         selDecimals,
		"symbol()":                           selSymbol,
		"name()":                             selName,
	} {
		if want := selector(sig); hex.EncodeToString(got) != want {
			t.Errorf("%s: %x want %s", sig, got, want)
		}
	}
}

// Hand-checked ABI layout for a single call (independent of the decoder).
func TestEncodeAggregate3Layout(t *testing.T) {
	data, err := encodeAggregate3([]call3{{target: "0x00000000000000000000000000000000000000aa", data: []byte{0x31, 0x3c, 0xe5, 0x67}}})
	if err != nil {
		t.Fatal(err)
	}
	want := "82ad56cb" +
		"0000000000000000000000000000000000000000000000000000000000000020" + // array offset
		"0000000000000000000000000000000000000000000000000000000000000001" + // length
		"0000000000000000000000000000000000000000000000000000000000000020" + // tuple 0 offset
		"00000000000000000000000000000000000000000000000000000000000000aa" + // target
		"0000000000000000000000000000000000000000000000000000000000000001" + // allowFailure
		"0000000000000000000000000000000000000000000000000000000000000060" + // bytes offset
		"0000000000000000000000000000000000000000000000000000000000000004" + // bytes length
		"313ce56700000000000000000000000000000000000000000000000000000000"
	if got := hex.EncodeToString(data); got != want {
		t.Fatalf("encoding\n got %s\nwant %s", got, want)
	}
}

func TestDecodeStringAndBytes32(t *testing.T) {
	// "USDC" as an ABI string.
	s := "0000000000000000000000000000000000000000000000000000000000000020" +
		"0000000000000000000000000000000000000000000000000000000000000004" +
		"5553444300000000000000000000000000000000000000000000000000000000"
	b, _ := hex.DecodeString(s)
	if v, ok := decodeString(b); !ok || v != "USDC" {
		t.Fatalf("string: %q %v", v, ok)
	}
	// "MKR" as bytes32 (old tokens).
	b32, _ := hex.DecodeString("4d4b520000000000000000000000000000000000000000000000000000000000")
	if v, ok := decodeString(b32); !ok || v != "MKR" {
		t.Fatalf("bytes32: %q %v", v, ok)
	}
}

// fakeChain answers eth_call to Multicall3 by decoding the calls and replying
// per target, so Balances/TokenInfo exercise the real codec end to end.
type fakeChain struct {
	balances map[string]*big.Int // target|holder -> balance; "native" for ETH
	reverts  map[string]bool
	block    uint64
	lastTag  string
}

func decodeCalls(t *testing.T, data []byte) []call3 {
	b := data[4:]
	arrOff, _ := readUint(b, 0)
	n, _ := readUint(b, arrOff)
	base := arrOff + 32
	var out []call3
	for i := uint64(0); i < n; i++ {
		off, _ := readUint(b, base+32*i)
		tp := base + off
		tw, _ := readWord(b, tp)
		dOff, _ := readUint(b, tp+64)
		l, _ := readUint(b, tp+dOff)
		out = append(out, call3{target: "0x" + hex.EncodeToString(tw[12:]), data: b[tp+dOff+32 : tp+dOff+32+l]})
	}
	return out
}

func encodeResults(rs []result3) []byte {
	var tuples [][]byte
	for _, r := range rs {
		ok := uint64(0)
		if r.success {
			ok = 1
		}
		tp := append(uintWord(ok), uintWord(0x40)...)
		tp = append(tp, uintWord(uint64(len(r.data)))...)
		tp = append(tp, pad32(append([]byte{}, r.data...))...)
		tuples = append(tuples, tp)
	}
	out := append(uintWord(0x20), uintWord(uint64(len(rs)))...)
	off := uint64(32 * len(rs))
	for _, tp := range tuples {
		out = append(out, uintWord(off)...)
		off += uint64(len(tp))
	}
	for _, tp := range tuples {
		out = append(out, tp...)
	}
	return out
}

func strABI(s string) []byte {
	return append(append(uintWord(0x20), uintWord(uint64(len(s)))...), pad32([]byte(s))...)
}

func (f *fakeChain) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req rpc.Request
	b, _ := io.ReadAll(r.Body)
	json.Unmarshal(b, &req)
	var ps []json.RawMessage
	json.Unmarshal(req.Params, &ps)
	res := `null`
	switch req.Method {
	case "eth_blockNumber":
		res = `"0x` + big.NewInt(int64(f.block)).Text(16) + `"`
	case "eth_getTransactionCount":
		res = `"0x5"`
	case "eth_getBlockByNumber":
		res = `{"number":"0x64","baseFeePerGas":"0x3b9aca00"}`
	case "eth_maxPriorityFeePerGas":
		res = `"0x5f5e100"`
	case "eth_call":
		var call struct{ To, Data string }
		json.Unmarshal(ps[0], &call)
		json.Unmarshal(ps[1], &f.lastTag)
		raw, _ := hex.DecodeString(strings.TrimPrefix(call.Data, "0x"))
		var rs []result3
		for _, c := range decodeCalls(nil, raw) {
			sel := hex.EncodeToString(c.data[:4])
			if f.reverts[c.target] {
				rs = append(rs, result3{success: false})
				continue
			}
			switch sel {
			case "4d2301cc", "70a08231":
				key := c.target + "|0x" + hex.EncodeToString(c.data[4+12:4+32])
				if sel == "4d2301cc" {
					key = "native|0x" + hex.EncodeToString(c.data[4+12:4+32])
				}
				v := f.balances[key]
				if v == nil {
					v = big.NewInt(0)
				}
				rs = append(rs, result3{success: true, data: word(v.Bytes())})
			case "313ce567":
				rs = append(rs, result3{success: true, data: uintWord(6)})
			case "95d89b41":
				rs = append(rs, result3{success: true, data: strABI("USDC")})
			case "06fdde03":
				rs = append(rs, result3{success: true, data: strABI("USD Coin")})
			}
		}
		res = `"0x` + hex.EncodeToString(encodeResults(rs)) + `"`
	}
	io.WriteString(w, `{"jsonrpc":"2.0","id":`+string(req.ID)+`,"result":`+res+`}`)
}

func TestClientAgainstFakeChain(t *testing.T) {
	holder := "0x1111111111111111111111111111111111111111"
	usdc := "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
	bad := "0x000000000000000000000000000000000000dead"
	f := &fakeChain{block: 100, reverts: map[string]bool{bad: true}, balances: map[string]*big.Int{
		"native|" + holder:  big.NewInt(123456789),
		usdc + "|" + holder: big.NewInt(42_000_000),
	}}
	srv := httptest.NewServer(f)
	defer srv.Close()
	c, err := New(chain.ClientConfig{Chain: "base", Family: chain.FamilyEVM, RPCURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	contracttest.RunChainClient(t, c, contracttest.ClientFixture{Address: holder, AssetRefs: []string{usdc}})

	bals, block, err := c.Balances(context.Background(), holder, []string{usdc, bad}, 0)
	if err != nil {
		t.Fatal(err)
	}
	if block != 100 || f.lastTag != "0x64" {
		t.Fatalf("not pinned: block %d tag %s", block, f.lastTag)
	}
	if bals[0].AmountRaw.Int64() != 123456789 || bals[1].AmountRaw.Int64() != 42_000_000 || !bals[2].Failed {
		t.Fatalf("balances %+v", bals)
	}
	ti, err := c.TokenInfo(context.Background(), []string{usdc})
	if err != nil || ti[0].Symbol != "USDC" || ti[0].Decimals != 6 || ti[0].Name != "USD Coin" {
		t.Fatalf("token info %+v %v", ti, err)
	}
	// More calls than one multicall holds are split and stay aligned.
	many := make([]string, 600)
	for i := range many {
		many[i] = usdc
	}
	bals, _, err = c.Balances(context.Background(), holder, many, 0)
	if err != nil || len(bals) != 601 || bals[600].AmountRaw.Int64() != 42_000_000 {
		t.Fatalf("chunked: %d %v", len(bals), err)
	}
}

type headOnly struct {
	chain.Client
	head uint64
}

func (h headOnly) LatestBlock(context.Context) (uint64, error) { return h.head, nil }

func TestDepthPolicy(t *testing.T) {
	p, err := NewDepth(headOnly{head: 1000}, map[string]any{"confirmations": 12})
	if err != nil {
		t.Fatal(err)
	}
	fin, err := p.FinalizedBlock(context.Background())
	if err != nil || fin != 988 {
		t.Fatalf("finalized=%d err=%v", fin, err)
	}
	if p.Classify(988, 1000, fin) != chain.Finalized || p.Classify(989, 1000, fin) != chain.Confirmed || p.Classify(1001, 1000, fin) != chain.Pending {
		t.Fatal("classification")
	}
	short, _ := NewDepth(headOnly{head: 5}, nil)
	if f, _ := short.FinalizedBlock(context.Background()); f != 0 {
		t.Fatalf("short chain finalized=%d", f)
	}
	if _, err := NewDepth(headOnly{}, map[string]any{"confirmations": "x"}); err == nil {
		t.Fatal("bad option accepted")
	}
}
