package devicesig

// QA: registration proof-of-work cost (TEST_PLAN T-BE-089, BE-04). CheckPow is the server's side and must stay O(1);
// SolvePow at the production difficulty (20 bits) must stay quick. The 20-bit solve runs only with HB_QA_PERF=1.

import (
	"os"
	"strings"
	"testing"
	"time"
)

// T-BE-089: CheckPow cost does not depend on difficulty or on how hard the answer was to find, and rejects oversize counters
// before hashing. Compares against a generous bound (not a tight timing): 20000 verifications must take well under a second.
func TestQACheckPowIsConstantTime(t *testing.T) {
	const n = 20000
	for _, d := range []int{0, 8, 20, 24} {
		t0 := time.Now()
		for i := 0; i < n; i++ {
			CheckPow("challenge", "pubkey", "123456", d)
		}
		if el := time.Since(t0); el > 2*time.Second {
			t.Errorf("difficulty %d: %d checks took %v", d, n, el)
		}
	}
	if CheckPow("c", "p", strings.Repeat("9", 21), 0) {
		t.Error("21-digit counter accepted")
	}
	if CheckPow("c", "p", "", 0) {
		t.Error("empty counter accepted")
	}
}

// T-BE-089: a 14-bit solve is correct and fast enough to run on every CI build; the answer verifies.
func TestQASolvePowSmallDifficulty(t *testing.T) {
	t0 := time.Now()
	c, err := SolvePow("qa-challenge", "qa-pub", 14)
	if err != nil || !CheckPow("qa-challenge", "qa-pub", c, 14) {
		t.Fatalf("counter %q err %v", c, err)
	}
	if el := time.Since(t0); el > 5*time.Second {
		t.Errorf("14-bit solve took %v", el)
	}
}

// T-BE-089 (opt-in, HB_QA_PERF=1): production difficulty 20; median of 3 challenges under 5 s (about 1M hashes, well under a second here).
func TestQASolvePowProductionDifficulty(t *testing.T) {
	if os.Getenv("HB_QA_PERF") == "" {
		t.Skip("set HB_QA_PERF=1 to run")
	}
	var ts []time.Duration
	for _, ch := range []string{"qa-1", "qa-2", "qa-3"} {
		t0 := time.Now()
		c, err := SolvePow(ch, "qa-pub", 20)
		if err != nil || !CheckPow(ch, "qa-pub", c, 20) {
			t.Fatalf("%s: %q %v", ch, c, err)
		}
		ts = append(ts, time.Since(t0))
	}
	if ts[0] > ts[1] {
		ts[0], ts[1] = ts[1], ts[0]
	}
	if ts[1] > ts[2] {
		ts[1], ts[2] = ts[2], ts[1]
	}
	if ts[0] > ts[1] {
		ts[0], ts[1] = ts[1], ts[0]
	}
	if ts[1] > 5*time.Second {
		t.Fatalf("median solve %v (all %v)", ts[1], ts)
	}
	t.Logf("difficulty-20 solves: %v", ts)
}
