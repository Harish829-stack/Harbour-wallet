package api

// QA unit suite for pure API helpers (TEST_PLAN: T-UX-012, T-UX-013, T-UX-021, T-UX-029, T-BE-040, T-BE-056, T-BE-079, T-GW-020, T-GW-021).

import (
	"encoding/json"
	"fmt"
	"math/big"
	"math/rand"
	"os"
	"regexp"
	"strings"
	"testing"
	"testing/quick"
	"time"

	"harbour/backend/internal/config"
)

func intp(i int) *int { return &i }

// T-UX-012 / ASM-04: formatUnits must not panic or allocate unboundedly on hostile decimals coming from token metadata.
// Expected per ASM-04: negative decimals are invalid (empty string), absurd decimals are bounded. If this fails it is logged as BUG-03.
func TestFormatUnitsHostileDecimalsDoNotPanic(t *testing.T) {
	cases := []struct {
		raw string
		dec *int
	}{
		{"5", intp(-1)},
		{"123", intp(-30)},
		{"1", intp(50_000)}, // 50k: quadratic zero padding is ~1e9 byte copies (bounded so the goroutine ends)
	}
	var problems []string
	for _, c := range cases {
		type res struct {
			out   string
			panic any
		}
		done := make(chan res, 1)
		go func() {
			defer func() {
				if r := recover(); r != nil {
					done <- res{panic: r}
				}
			}()
			done <- res{out: formatUnits(c.raw, c.dec)}
		}()
		select {
		case r := <-done:
			if r.panic != nil {
				problems = append(problems, fmt.Sprintf("formatUnits(%q, %d) panicked: %v", c.raw, *c.dec, r.panic))
			} else if len(r.out) > 200 {
				problems = append(problems, fmt.Sprintf("formatUnits(%q, %d) produced %d chars", c.raw, *c.dec, len(r.out)))
			}
		case <-time.After(20 * time.Second):
			problems = append(problems, fmt.Sprintf("formatUnits(%q, %d) still running after 20s (quadratic zero padding)", c.raw, *c.dec))
		}
	}
	expectFixed(t, "BUG-03", problems)
}

// T-UX-012: ordinary inputs (exact rendering, trimming, negatives, non-numeric raw).
func TestFormatUnitsExact(t *testing.T) {
	cases := []struct {
		raw  string
		dec  *int
		want string
	}{
		{"1000000000000000000", intp(18), "1"},
		{"1500000", intp(6), "1.5"},
		{"1", intp(18), "0.000000000000000001"},
		{"0", intp(18), "0"},
		{"-2500", intp(3), "-2.5"},
		{"42", nil, "42"},
		{"42", intp(0), "42"},
		{"1e3", intp(2), ""},
		{"", intp(2), ""},
		{"115792089237316195423570985008687907853269984665640564039457584007913129639935", intp(18), "115792089237316195423570985008687907853269984665640564039457.584007913129639935"},
	}
	for _, c := range cases {
		if got := formatUnits(c.raw, c.dec); got != c.want {
			t.Errorf("formatUnits(%q) = %q, want %q", c.raw, got, c.want)
		}
	}
}

// T-UX-013: formatUnits agrees with an independent big.Rat rendering for random values and decimals 0..77.
func TestFormatUnitsMatchesBigRatProperty(t *testing.T) {
	f := func(hi, lo uint64, d uint8) bool {
		dec := int(d % 78)
		v := new(big.Int).Lsh(new(big.Int).SetUint64(hi), 64)
		v.Add(v, new(big.Int).SetUint64(lo))
		got := formatUnits(v.String(), &dec)
		r := new(big.Rat).SetFrac(v, new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(dec)), nil))
		want := strings.TrimRight(strings.TrimRight(r.FloatString(dec), "0"), ".")
		if dec == 0 {
			want = v.String()
		}
		if want == "" {
			want = "0"
		}
		return got == want
	}
	if err := quick.Check(f, &quick.Config{MaxCount: 2000, Rand: rand.New(rand.NewSource(5))}); err != nil {
		t.Fatal(err)
	}
}

// T-UX-021: node messages map to stable codes regardless of case; unknown text becomes "rejected".
func TestFriendlyChainErrorMapping(t *testing.T) {
	cases := map[string]string{
		"INSUFFICIENT FUNDS for gas * price + value": "insufficient_funds",
		"nonce too low":                                      "nonce_used",
		"Nonce Too High":                                     "nonce_gap",
		"replacement transaction underpriced":                "fee_too_low",
		"max fee per gas less than block base fee":           "fee_too_low",
		"intrinsic gas too low":                              "gas_too_low",
		"execution reverted: ERC20: transfer amount exceeds": "would_fail",
		"invalid chain id for signer":                        "wrong_network",
		"something unexpected":                               "rejected",
		"":                                                   "rejected",
	}
	for msg, want := range cases {
		if code, _ := friendlyChainError(msg); code != want {
			t.Errorf("friendlyChainError(%q) = %s, want %s", msg, code, want)
		}
	}
}

// T-UX-029: user-facing text never echoes the node message (which can carry URLs, keys or stack text).
func TestFriendlyChainErrorNeverEchoesInput(t *testing.T) {
	secret := "https://eth-mainnet.g.alchemy.com/v2/SUPERSECRETKEY goroutine 1 [running]"
	for _, prefix := range []string{"", "insufficient funds ", "nonce too low ", "execution reverted "} {
		_, text := friendlyChainError(prefix + secret)
		if strings.Contains(text, "SUPERSECRETKEY") || strings.Contains(text, "http") || strings.Contains(text, "goroutine") {
			t.Fatalf("leaked node text: %q", text)
		}
	}
}

// T-BE-040 / ASM-03 / AMB-06: eth_getLogs topic filters made only of nulls or empty lists are unfiltered queries and must be refused.
func TestFilteredLogsRejectsNestedEmptyTopics(t *testing.T) {
	refuse := []string{
		`[{"topics":[[null]]}]`,
		`[{"topics":[[]]}]`,
		`[{"topics":[[null,null],null]}]`,
		`[{"address":[],"topics":[]}]`,
		`[{"address":"","topics":[null]}]`,
	}
	var problems []string
	for _, in := range refuse {
		if filteredLogs(json.RawMessage(in)) {
			problems = append(problems, in+" accepted as a filtered query")
		}
	}
	accept := []string{
		`[{"topics":[["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]]}]`,
		`[{"topics":[null,"0x000000000000000000000000000000000000000000000000000000000000dead"]}]`,
		`[{"address":["0x0000000000000000000000000000000000000001"]}]`,
	}
	for _, in := range accept {
		if !filteredLogs(json.RawMessage(in)) {
			t.Errorf("%s refused", in)
		}
	}
	if boundedLogs(rpcCall{Method: "eth_getLogs", Params: json.RawMessage(`[{"topics":[[null]],"fromBlock":"0x1","toBlock":"0x7d1"}]`)}) == nil {
		problems = append(problems, "/v1/gw boundedLogs accepts topics [[null]] with no address (2000-block unfiltered scan on the Alchemy key)")
	}
	expectFixed(t, "BUG-02", problems)
}

// T-BE-056: tx hash path validation (lower-case 0x + 64 hex only; the handler lower-cases first).
func TestTxHashFormat(t *testing.T) {
	ok := "0x" + strings.Repeat("ab", 32)
	if !txHashRe.MatchString(ok) || !txHashRe.MatchString(strings.ToLower("0x"+strings.Repeat("AB", 32))) {
		t.Fatal("valid hash refused")
	}
	for _, bad := range []string{ok[:65], ok + "0", strings.TrimPrefix(ok, "0x"), "0x" + strings.Repeat("zz", 32), "0x" + strings.Repeat("AB", 32)} {
		if txHashRe.MatchString(bad) {
			t.Errorf("accepted %q", bad)
		}
	}
}

// T-BE-079: address normalisation per chain family.
func TestNormalizeAddress(t *testing.T) {
	s := &Server{cfg: &config.Config{Chains: map[string]config.Chain{"base": {Family: "evm"}, "solana": {Family: "solana"}}}}
	if got, err := s.normalizeAddress("base", "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01"); err != nil || got != "0xabcdef0123456789abcdef0123456789abcdef01" {
		t.Fatalf("got %q %v", got, err)
	}
	for _, c := range [][2]string{{"base", "0x123"}, {"base", "abcdef0123456789abcdef0123456789abcdef01"}, {"base", "0xZZcdef0123456789abcdef0123456789abcdef01"},
		{"base", " 0xabcdef0123456789abcdef0123456789abcdef01"}, {"nochain", "0xabcdef0123456789abcdef0123456789abcdef01"}, {"solana", "So11111111111111111111111111111111111111112"}} {
		if _, err := s.normalizeAddress(c[0], c[1]); err == nil {
			t.Errorf("accepted %v", c)
		}
	}
}

var methodRe = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// T-GW-020: fuzz the strict JSON-RPC parser. Anything accepted must re-parse to exactly the validated method/params,
// and only allow-listed methods may come out.
func FuzzJSONRPCClean(f *testing.F) {
	for _, s := range []string{
		`{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}`,
		`[{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"},{"id":2,"method":"eth_chainId"}]`,
		`{"method":"debug_x","Method":"eth_chainId"}`,
		`{"method":"eth_getLogs","params":[{"address":"0x01","fromBlock":"0x1","toBlock":"0x2"}]}`,
		`{"method":"eth_chainId"} trailing`,
	} {
		f.Add([]byte(s))
	}
	allowed := map[string]bool{"eth_chainId": true, "eth_blockNumber": true, "eth_getLogs": true}
	f.Fuzz(func(t *testing.T, body []byte) {
		out, rej := jsonRPCClean(body, allowed, nil)
		if rej != nil {
			return
		}
		var v any
		if err := json.Unmarshal(out, &v); err != nil {
			t.Fatalf("accepted body re-marshalled to invalid JSON: %s", out)
		}
		check := func(m map[string]any) {
			for k := range m {
				if !rpcKeys[k] {
					t.Fatalf("forwarded unknown member %q in %s", k, out)
				}
			}
			meth, _ := m["method"].(string)
			if !allowed[meth] {
				t.Fatalf("forwarded non-allowed method %q from %q", meth, body)
			}
		}
		switch x := v.(type) {
		case map[string]any:
			check(x)
		case []any:
			for _, e := range x {
				m, ok := e.(map[string]any)
				if !ok {
					t.Fatalf("batch element not an object: %s", out)
				}
				check(m)
			}
		default:
			t.Fatalf("accepted non-object body %s", out)
		}
	})
}

// T-GW-021: fuzz the eth_getLogs canonicaliser: accepted output carries only the 5 standard keys, each at most once.
func FuzzCanonLogFilter(f *testing.F) {
	f.Add([]byte(`[{"address":"0x01","topics":[["0x02"]],"fromBlock":"0x1","toBlock":"0x2"}]`))
	f.Add([]byte(`[{"address":null,"ADDRESS":"0x01"}]`))
	f.Add([]byte(`[{"blockHash":"0x01"}]`))
	f.Fuzz(func(t *testing.T, params []byte) {
		out, ok := canonLogFilter(params)
		if !ok {
			return
		}
		var arr []map[string]json.RawMessage
		if err := json.Unmarshal(out, &arr); err != nil || len(arr) != 1 {
			t.Fatalf("canonical output not a one-filter array: %s (%v)", out, err)
		}
		for k := range arr[0] {
			found := false
			for _, a := range logFilterKeys {
				found = found || a == k
			}
			if !found {
				t.Fatalf("unknown key %q forwarded", k)
			}
		}
		if strings.Count(string(out), `"address":`) > 1 || strings.Count(string(out), `"fromBlock":`) > 1 {
			t.Fatalf("duplicate key in %s", out)
		}
	})
}

// T-UX-013 companion: valueUSD never panics for nil/odd inputs and is linear in the price.
func TestValueUSD(t *testing.T) {
	if valueUSD("100", nil, 2) != 0 || valueUSD("abc", intp(2), 2) != 0 {
		t.Fatal("invalid input must value at 0")
	}
	if v := valueUSD("150", intp(2), 2); v != 3 {
		t.Fatalf("1.5 × 2 = %v", v)
	}
	_ = methodRe
}

// expectFixed fails when a fixed bug (qa/BUGS_FOUND.md) reproduces again.
func expectFixed(t *testing.T, id string, problems []string) {
	t.Helper()
	if len(problems) > 0 {
		t.Fatalf("%s regression: %s", id, strings.Join(problems, "; "))
	}
}

// expectKnownBug implements expected-fail for confirmed product bugs (see qa/BUGS_FOUND.md). While the bug exists the test is
// reported as SKIP with the evidence; once the product is fixed the test FAILS so the marker gets removed. HB_QA_STRICT=1 turns
// known bugs into plain failures (used to list open bugs in CI).
func expectKnownBug(t *testing.T, id string, problems []string) {
	t.Helper()
	if len(problems) == 0 {
		t.Fatalf("%s no longer reproduces: remove the expectKnownBug marker and close the bug", id)
	}
	msg := fmt.Sprintf("KNOWN BUG %s (qa/BUGS_FOUND.md):\n  %s", id, strings.Join(problems, "\n  "))
	if os.Getenv("HB_QA_STRICT") == "1" {
		t.Fatal(msg)
	}
	t.Skip(msg)
}
