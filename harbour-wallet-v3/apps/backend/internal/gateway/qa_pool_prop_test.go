package gateway

// QA (property, T-IDX-057): over random pools — breakers open/half-open/closed, heads, exclusions, minBlock, budgets — pick never
// returns an excluded member, an open (cooling) breaker, a member whose estimated head is below minBlock, or one without budget;
// and it returns nil only when no member satisfies all of those.

import (
	"context"
	"io"
	"log/slog"
	"math/rand"
	"testing"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/rpc"
)

func TestQAPickNeverReturnsIneligibleProperty(t *testing.T) {
	rng := rand.New(rand.NewSource(57))
	gcfg := config.Gateway{WindowSize: 50, WindowAge: time.Minute, BreakerCooldown: 5 * time.Second, BreakerProbes: 1, BreakerErrorRate: 0.5, BreakerMinSamples: 5, BudgetWait: 0,
		HeadProbeEvery: 10 * time.Second, IdlePollEvery: 30 * time.Second}
	for run := 0; run < 2000; run++ {
		n := 1 + rng.Intn(6)
		ups := make([]rpc.Upstream, n)
		w, rps := make([]float64, n), make([]float64, n)
		for i := range ups {
			w[i] = float64(1 + rng.Intn(5))
			rps[i] = []float64{0.001, 1, 100}[rng.Intn(3)]
		}
		p := NewPool("qa", config.Chain{BlockTime: 2 * time.Second}, gcfg, ups, w, rps, slog.New(slog.NewTextHandler(io.Discard, nil)))
		p.rnd = rng.Float64
		now := time.Now()
		exclude := map[*member]bool{}
		for _, m := range p.members {
			if rng.Intn(4) == 0 {
				m.latest.Store(uint64(1000 + rng.Intn(50)))
				m.headAt.Store(now.Add(-time.Duration(rng.Intn(3000)) * time.Millisecond).UnixNano())
			}
			switch rng.Intn(4) {
			case 0:
				m.br.state, m.br.openedAt = open, now.Add(-time.Duration(rng.Intn(10))*time.Second)
			case 1:
				m.br.state, m.br.inFlight = halfOpen, rng.Intn(2)
			}
			if rng.Intn(5) == 0 {
				exclude[m] = true
			}
			if rng.Intn(5) == 0 {
				m.bkt.tokens = 0
			}
		}
		minBlock := uint64(0)
		if rng.Intn(2) == 0 {
			minBlock = uint64(1000 + rng.Intn(60))
		}
		// expected eligibility, computed before pick mutates budgets/breakers
		ok := map[*member]bool{}
		any := false
		for _, m := range p.members {
			e := !exclude[m] && m.br.eligible(now) && (minBlock == 0 || p.estLatest(m, now) >= minBlock) && m.bkt.available(now)
			ok[m] = e
			any = any || e
		}
		got := p.pick(context.Background(), exclude, minBlock)
		if got == nil {
			if any {
				t.Fatalf("run %d: nil although an eligible member existed", run)
			}
			continue
		}
		if !ok[got] {
			t.Fatalf("run %d: picked an ineligible member (excluded=%v state=%v est=%d min=%d)", run, exclude[got], got.br.state, p.estLatest(got, now), minBlock)
		}
	}
}
