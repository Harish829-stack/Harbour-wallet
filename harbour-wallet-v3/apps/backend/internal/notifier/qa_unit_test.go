package notifier

// QA unit tests: notification text helpers. TEST_PLAN: T-IDX-032.

import (
	"strings"
	"testing"
	"time"
)

// T-IDX-032: symbols are reduced to ≤ 12 plain characters, amounts formatted exactly, chain labels title-cased.
func TestQANotificationTextHelpers(t *testing.T) {
	for in, want := range map[string]string{"USDC": "USDC", "U‮SDC": "USDC", "<script>": "script", "\x00\x1b[31m": "31m", "": "token", "😀😀": "token", "ABCDEFGHIJKLMNOP": "ABCDEFGHIJKL", "w.ETH-1_x": "w.ETH-1_x"} {
		if got := safeSymbol(in, "token"); got != want {
			t.Errorf("safeSymbol(%q) = %q, want %q", in, got, want)
		}
	}
	d := func(n int) *int { return &n }
	for _, c := range []struct {
		raw  string
		dec  *int
		want string
	}{{"1000000000000000000", d(18), "1"}, {"1500000", d(6), "1.5"}, {"1", d(18), "<0.000001"}, {"0", d(18), "0"}, {"123", nil, "123"}, {"x", d(2), ""}, {"1234567890123", d(6), "1234567.890123"}} {
		if got := displayAmount(c.raw, c.dec); got != c.want {
			t.Errorf("displayAmount(%s,%v) = %q, want %q", c.raw, c.dec, got, c.want)
		}
	}
	if chainLabel("base-sepolia") != "Base Sepolia" || chainLabel("ethereum") != "Ethereum" || chainLabel("x-y-z") != "X Y Z" {
		t.Fatal("chainLabel")
	}
}

// T-IDX-032 (hostile decimals): token metadata decimals are unbounded (BUG-03); displayAmount must not panic or take long.
func TestQADisplayAmountHostileDecimals(t *testing.T) {
	problems := []string{}
	for _, dec := range []int{-1, -100, 50_000} {
		dec := dec
		done := make(chan string, 1)
		go func() {
			defer func() {
				if r := recover(); r != nil {
					done <- "panic: " + strings.SplitN(fmtAny(r), "\n", 2)[0]
				}
			}()
			start := time.Now()
			_ = displayAmount("5", &dec)
			if el := time.Since(start); el > time.Second {
				done <- "slow: " + el.String()
				return
			}
			done <- ""
		}()
		select {
		case p := <-done:
			if p != "" {
				problems = append(problems, fmtAny(dec)+" → "+p)
			}
		case <-time.After(20 * time.Second):
			problems = append(problems, fmtAny(dec)+" → >20s")
		}
	}
	if len(problems) > 0 { // BUG-03 (fixed): hostile decimals render as unknown
		t.Fatalf("BUG-03 regression (notifier.displayAmount): %v", problems)
	}
}
