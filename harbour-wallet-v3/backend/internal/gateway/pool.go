package gateway

import (
	"context"
	"log/slog"
	"math"
	"math/rand/v2"
	"sync"
	"sync/atomic"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/rpc"
)

// member is one upstream inside a chain pool.
type member struct {
	up     rpc.Upstream
	weight float64
	win    *window
	br     *breaker
	bkt    *bucket

	latest    atomic.Uint64
	finalized atomic.Uint64
	headAt    atomic.Int64 // unix nanos of last good head

	ok, retryable, deterministic atomic.Uint64
}

func (m *member) record(now time.Time, lat time.Duration, class rpc.Class) {
	good := class != rpc.Retryable
	m.win.record(now, lat, good)
	switch class {
	case rpc.OK:
		m.ok.Add(1)
	case rpc.Retryable:
		m.retryable.Add(1)
	default:
		m.deterministic.Add(1)
	}
	if m.br.result(now, good, m.win.stats(now)) {
		m.win.reset()
	}
}

// Pool is the set of upstreams for one chain.
type Pool struct {
	Chain   string
	cfg     config.Chain
	gcfg    config.Gateway
	members []*member
	sticky  sync.Map // session -> stickyEntry
	log     *slog.Logger
	rnd     func() float64
}

type stickyEntry struct {
	m     *member
	until time.Time
}

// NewPool builds a pool; upstreams are already constructed.
func NewPool(chain string, cfg config.Chain, gcfg config.Gateway, ups []rpc.Upstream, weights, rps []float64, log *slog.Logger) *Pool {
	p := &Pool{Chain: chain, cfg: cfg, gcfg: gcfg, log: log, rnd: rand.Float64}
	for i, u := range ups {
		p.members = append(p.members, &member{
			up: u, weight: weights[i],
			win: newWindow(gcfg.WindowSize, gcfg.WindowAge),
			br: &breaker{cooldown: gcfg.BreakerCooldown, probes: gcfg.BreakerProbes,
				threshold: gcfg.BreakerErrorRate, minSamples: gcfg.BreakerMinSamples},
			bkt: newBucket(rps[i]),
		})
	}
	return p
}

func (p *Pool) headFresh(m *member, now time.Time) bool {
	at := m.headAt.Load()
	return at != 0 && now.Sub(time.Unix(0, at)) < 10*p.cfg.BlockTime+30*time.Second
}

// BestHead is the highest latest block among upstreams that are not open.
func (p *Pool) BestHead() uint64 {
	now := time.Now()
	var best uint64
	for _, m := range p.members {
		if m.br.current() != open && p.headFresh(m, now) {
			if l := m.latest.Load(); l > best {
				best = l
			}
		}
	}
	return best
}

// Finalized is the highest finalized block reported by a healthy upstream.
func (p *Pool) Finalized() uint64 {
	now := time.Now()
	var best uint64
	for _, m := range p.members {
		if m.br.current() != open && p.headFresh(m, now) {
			if f := m.finalized.Load(); f > best {
				best = f
			}
		}
	}
	return best
}

func (p *Pool) score(m *member, now time.Time, best uint64) float64 {
	st := m.win.stats(now)
	s := m.weight * math.Pow(1-st.errRate, 2)
	p90ms := float64(st.p90) / float64(time.Millisecond)
	s /= 1 + p90ms/250
	if best > 0 {
		if l := m.latest.Load(); l > 0 && l < best {
			s /= 1 + float64(best-l)/2
		}
	}
	if s < 1e-6 {
		s = 1e-6
	}
	return s
}

// pick chooses an upstream by weighted random over eligible members,
// reserving budget and a breaker slot. minBlock > 0 requires its head.
func (p *Pool) pick(ctx context.Context, exclude map[*member]bool, minBlock uint64) *member {
	for attempt := 0; attempt < 2; attempt++ {
		now := time.Now()
		best := p.BestHead()
		type cand struct {
			m *member
			s float64
		}
		var cands []cand
		var budgetBlocked []*member
		total := 0.0
		for _, m := range p.members {
			if exclude[m] || !m.br.eligible(now) {
				continue
			}
			if minBlock > 0 && m.latest.Load() < minBlock {
				continue
			}
			if !m.bkt.available(now) {
				budgetBlocked = append(budgetBlocked, m)
				continue
			}
			s := p.score(m, now, best)
			cands = append(cands, cand{m, s})
			total += s
		}
		for len(cands) > 0 {
			r := p.rnd() * total
			idx := len(cands) - 1
			for i, c := range cands {
				if r < c.s {
					idx = i
					break
				}
				r -= c.s
			}
			c := cands[idx]
			if c.m.bkt.take(now) && c.m.br.acquire(now) {
				return c.m
			}
			total -= c.s
			cands = append(cands[:idx], cands[idx+1:]...)
		}
		// Everyone eligible is at budget: wait briefly for the soonest token
		// rather than letting the provider return 429.
		if len(budgetBlocked) == 0 || attempt == 1 {
			return nil
		}
		wait := p.gcfg.BudgetWait
		for _, m := range budgetBlocked {
			if w := m.bkt.wait(now); w < wait {
				wait = w
			}
		}
		if wait >= p.gcfg.BudgetWait {
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(wait + time.Millisecond):
		}
	}
	return nil
}

// pinned returns the session's upstream if it can still take the call.
func (p *Pool) pinned(session string, exclude map[*member]bool, minBlock uint64) *member {
	if session == "" {
		return nil
	}
	v, ok := p.sticky.Load(session)
	if !ok {
		return nil
	}
	e := v.(stickyEntry)
	now := time.Now()
	if now.After(e.until) || exclude[e.m] || (minBlock > 0 && e.m.latest.Load() < minBlock) {
		return nil
	}
	if !e.m.bkt.take(now) {
		return nil
	}
	if !e.m.br.acquire(now) {
		return nil
	}
	return e.m
}

func (p *Pool) pin(session string, m *member) {
	if session != "" {
		p.sticky.Store(session, stickyEntry{m: m, until: time.Now().Add(p.gcfg.StickyTTL)})
	}
}

// RunHeads polls every upstream's head until ctx ends. Polls double as
// health probes, so a dead key is detected even without traffic.
func (p *Pool) RunHeads(ctx context.Context) {
	interval := p.cfg.BlockTime
	if interval < p.gcfg.HeadPollMin {
		interval = p.gcfg.HeadPollMin
	}
	if interval > 12*time.Second {
		interval = 12 * time.Second
	}
	var wg sync.WaitGroup
	for _, m := range p.members {
		wg.Add(1)
		go func(m *member) {
			defer wg.Done()
			p.pollHead(ctx, m)
			t := time.NewTicker(interval)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					p.pollHead(ctx, m)
				}
			}
		}(m)
	}
	wg.Wait()
}

func (p *Pool) pollHead(ctx context.Context, m *member) {
	now := time.Now()
	if !m.br.acquire(now) {
		return
	}
	if !m.bkt.take(now) {
		m.br.release() // budget exhausted: no health signal
		return
	}
	cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	start := time.Now()
	h, err := m.up.Head(cctx)
	if ctx.Err() != nil {
		return
	}
	if err != nil {
		m.record(time.Now(), time.Since(start), rpc.Retryable)
		p.log.Debug("head poll failed", "upstream", m.up.ID(), "err", err)
		return
	}
	m.record(time.Now(), time.Since(start)/2, rpc.OK)
	if h.Latest > m.latest.Load() || h.Latest+64 < m.latest.Load() {
		m.latest.Store(h.Latest)
	}
	if h.Finalized > 0 {
		m.finalized.Store(h.Finalized)
	}
	m.headAt.Store(time.Now().UnixNano())
}
