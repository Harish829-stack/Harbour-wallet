package rpchttp

// QA unit tests: upstream URL building and quantity parsing. TEST_PLAN: T-IDX-013, T-IDX-066.

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"harbour/backend/internal/core/rpc"
)

// T-IDX-013: BuildURL fills placeholders and its errors never contain the key; ParseQuantity edge cases.
func TestQABuildURLAndParseQuantity(t *testing.T) {
	u, err := BuildURL(rpc.UpstreamConfig{ID: "a", URLTemplate: "https://{network}.example/v2/{key}", Network: "eth-mainnet", Key: "SECRETKEY123"})
	if err != nil || u != "https://eth-mainnet.example/v2/SECRETKEY123" {
		t.Fatalf("%q %v", u, err)
	}
	for _, c := range []rpc.UpstreamConfig{{ID: "b", URLTemplate: "https://{network}.x/{key}", Key: "SECRETKEY123", Chain: "base"}, {ID: "c", URLTemplate: "https://x/{key}", Network: "n"}, {ID: "d"}} {
		if _, err := BuildURL(c); err == nil || strings.Contains(err.Error(), "SECRETKEY123") {
			t.Fatalf("BuildURL(%+v): %v", c, err)
		}
	}
	if u, _ := BuildURL(rpc.UpstreamConfig{URL: "https://fixed.example"}); u != "https://fixed.example" {
		t.Fatal(u)
	}
	for in, want := range map[string]uint64{`"0x0"`: 0, `"0x1b4"`: 436, `"0xffffffffffffffff"`: 1<<64 - 1} {
		if got, err := ParseQuantity(json.RawMessage(in)); err != nil || got != want {
			t.Fatalf("%s → %d %v", in, got, err)
		}
	}
	for _, bad := range []string{`"0x"`, `"0xzz"`, `"0x10000000000000000"`, `16`, `null`, `"-0x1"`} {
		if _, err := ParseQuantity(json.RawMessage(bad)); err == nil {
			t.Fatalf("%s accepted", bad)
		}
	}
}

// T-IDX-066: ParseQuantity / parseBlockNumber never panic; valid ≤ 64-bit hex is parsed exactly.
func FuzzQAParseQuantity(f *testing.F) {
	for _, s := range []string{`"0x1"`, `"0x"`, `"0xffffffffffffffff"`, `null`, `{}`, `"0x10000000000000000"`} {
		f.Add([]byte(s))
	}
	f.Fuzz(func(t *testing.T, raw []byte) {
		_ = parseBlockNumber(json.RawMessage(raw))
		v, err := ParseQuantity(json.RawMessage(raw))
		var s string
		if json.Unmarshal(raw, &s) == nil && strings.HasPrefix(s, "0x") && len(s) > 2 && len(s) <= 18 {
			if want, perr := strconv.ParseUint(s[2:], 16, 64); perr == nil && (err != nil || v != want) {
				t.Fatalf("%s: %d %v, want %d", s, v, err, want)
			}
		}
		_ = fmt.Sprint(v)
	})
}
