package gateway

// QA unit tests: circuit breaker state machine, block-reference parsing. TEST_PLAN: T-IDX-005, T-IDX-007, T-IDX-058.

import (
	"encoding/json"
	"math/rand"
	"testing"
	"time"
)

func newTestBreaker() *breaker {
	return &breaker{cooldown: 10 * time.Second, probes: 2, threshold: 0.5, minSamples: 10}
}

// T-IDX-005: closed → open after 5 consecutive failures or a high error rate; open refuses until the cooldown; half-open allows
// exactly `probes` concurrent calls; one failed probe reopens; `probes` successes close.
func TestQABreakerTransitions(t *testing.T) {
	b := newTestBreaker()
	t0 := time.Unix(1_800_000_000, 0)
	for i := 0; i < 4; i++ {
		b.result(t0, false, windowStats{})
	}
	if b.current() != closed {
		t.Fatal("opened before 5 consecutive failures")
	}
	b.result(t0, false, windowStats{})
	if b.current() != open || b.acquire(t0.Add(9*time.Second)) || b.eligible(t0.Add(9*time.Second)) {
		t.Fatal("open breaker must refuse until the cooldown")
	}
	t1 := t0.Add(10 * time.Second)
	if !b.acquire(t1) || !b.acquire(t1) || b.acquire(t1) {
		t.Fatal("half-open must allow exactly 2 probes")
	}
	if b.current() != halfOpen {
		t.Fatal("not half-open")
	}
	b.result(t1, true, windowStats{})
	if b.current() != halfOpen {
		t.Fatal("closed after one success of two")
	}
	if !b.result(t1, true, windowStats{}) || b.current() != closed {
		t.Fatal("two probe successes must close")
	}
	b2 := newTestBreaker()
	b2.result(t0, false, windowStats{n: 10, errRate: 0.5})
	if b2.current() != open {
		t.Fatal("error rate at threshold with enough samples must open")
	}
	b2.acquire(t1)
	b2.result(t1, false, windowStats{})
	if b2.current() != open || b2.acquire(t1.Add(time.Second)) {
		t.Fatal("a failed probe must reopen with a fresh cooldown")
	}
	b3 := newTestBreaker()
	b3.result(t0, false, windowStats{n: 9, errRate: 1})
	if b3.current() != closed {
		t.Fatal("too few samples must not open on rate")
	}
	b3.acquire(t0)
	b3.release()
}

// T-IDX-058: random outcome sequences keep the invariants: no traffic while open before cooldown; in half-open never more than
// `probes` in flight; inFlight never negative.
func TestQABreakerInvariantsProperty(t *testing.T) {
	rng := rand.New(rand.NewSource(58))
	for run := 0; run < 300; run++ {
		b := newTestBreaker()
		now := time.Unix(1_800_000_000, 0)
		inflight := 0
		for step := 0; step < 200; step++ {
			now = now.Add(time.Duration(rng.Intn(4000)) * time.Millisecond)
			st := b.current()
			openedAt := b.openedAt
			switch rng.Intn(3) {
			case 0:
				if b.acquire(now) {
					if st == open && now.Sub(openedAt) < b.cooldown {
						t.Fatalf("run %d: traffic while open before cooldown", run)
					}
					if b.current() == halfOpen {
						inflight++
					}
				}
			case 1:
				ok := rng.Intn(2) == 0
				b.result(now, ok, windowStats{n: rng.Intn(20), errRate: rng.Float64()})
				if inflight > 0 {
					inflight--
				}
			default:
				b.release()
				if inflight > 0 {
					inflight--
				}
			}
			b.mu.Lock()
			if b.inFlight < 0 || (b.state == halfOpen && b.inFlight > b.probes) {
				t.Fatalf("run %d: inFlight %d in state %s", run, b.inFlight, b.state)
			}
			b.mu.Unlock()
		}
	}
}

// T-IDX-007: parseBlockRef never panics and classifies tags, numbers and hashes.
func FuzzQAParseBlockRef(f *testing.F) {
	for _, s := range []string{`"latest"`, `"0x10"`, `"0x` + "ab" + `"`, `null`, `""`, `{"blockHash":"0x1"}`, `{"blockNumber":"0x1"}`, `123`, `"0xffffffffffffffffff"`, `"0x` + string(make([]byte, 64)) + `"`} {
		f.Add([]byte(s))
	}
	f.Fuzz(func(t *testing.T, raw []byte) {
		r := parseBlockRef(json.RawMessage(raw))
		if r.hash && r.tag != "" {
			t.Fatalf("both hash and tag for %q", raw)
		}
	})
}
