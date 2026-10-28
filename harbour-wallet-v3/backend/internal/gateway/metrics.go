package gateway

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync/atomic"
	"time"
)

func (g *Gateway) count(chain, result string) {
	v, _ := g.stats.LoadOrStore(chain+"|"+result, new(atomic.Uint64))
	v.(*atomic.Uint64).Add(1)
}

// UpstreamStatus is a JSON view of one upstream.
type UpstreamStatus struct {
	ID            string  `json:"id"`
	Provider      string  `json:"provider"`
	State         string  `json:"state"`
	Weight        float64 `json:"weight"`
	Latest        uint64  `json:"latest"`
	Finalized     uint64  `json:"finalized"`
	BlockLag      uint64  `json:"block_lag"`
	ErrorRate     float64 `json:"error_rate"`
	P50ms         float64 `json:"p50_ms"`
	P90ms         float64 `json:"p90_ms"`
	P99ms         float64 `json:"p99_ms"`
	BudgetUsed    float64 `json:"budget_used"`
	OK            uint64  `json:"ok"`
	Retryable     uint64  `json:"retryable"`
	Deterministic uint64  `json:"deterministic"`
	Shed          uint64  `json:"budget_shed"`
}

// Status returns per-chain upstream status.
func (g *Gateway) Status() map[string][]UpstreamStatus {
	now := time.Now()
	out := map[string][]UpstreamStatus{}
	for name, p := range g.pools {
		best := p.BestHead()
		for _, m := range p.members {
			st := m.win.stats(now)
			l := m.latest.Load()
			var lag uint64
			if best > l {
				lag = best - l
			}
			m.bkt.mu.Lock()
			shed := m.bkt.shed
			m.bkt.mu.Unlock()
			out[name] = append(out[name], UpstreamStatus{
				ID: m.up.ID(), Provider: m.up.Provider(), State: m.br.current().String(), Weight: m.weight,
				Latest: l, Finalized: m.finalized.Load(), BlockLag: lag, ErrorRate: st.errRate,
				P50ms: ms(st.p50), P90ms: ms(st.p90), P99ms: ms(st.p99), BudgetUsed: m.bkt.usedRatio(now),
				OK: m.ok.Load(), Retryable: m.retryable.Load(), Deterministic: m.deterministic.Load(), Shed: shed,
			})
		}
	}
	return out
}

// Healthy reports whether every chain has at least one non-open upstream.
func (g *Gateway) Healthy() (bool, []string) {
	var down []string
	for name, p := range g.pools {
		ok := false
		for _, m := range p.members {
			if m.br.current() != open {
				ok = true
				break
			}
		}
		if !ok {
			down = append(down, name)
		}
	}
	sort.Strings(down)
	return len(down) == 0, down
}

func ms(d time.Duration) float64 { return float64(d) / float64(time.Millisecond) }

// WriteMetrics writes Prometheus text exposition.
func (g *Gateway) WriteMetrics(w io.Writer) {
	st := g.Status()
	chains := make([]string, 0, len(st))
	for c := range st {
		chains = append(chains, c)
	}
	sort.Strings(chains)
	gauge := func(name, help string) { fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n", name, help, name) }
	counter := func(name, help string) { fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s counter\n", name, help, name) }

	counter("hb_upstream_requests_total", "Calls per upstream by outcome class.")
	for _, c := range chains {
		for _, u := range st[c] {
			l := fmt.Sprintf(`chain=%q,upstream=%q,provider=%q`, c, u.ID, u.Provider)
			fmt.Fprintf(w, "hb_upstream_requests_total{%s,outcome=\"ok\"} %d\n", l, u.OK)
			fmt.Fprintf(w, "hb_upstream_requests_total{%s,outcome=\"retryable\"} %d\n", l, u.Retryable)
			fmt.Fprintf(w, "hb_upstream_requests_total{%s,outcome=\"deterministic\"} %d\n", l, u.Deterministic)
		}
	}
	gauge("hb_upstream_latency_ms", "Latency quantiles over the scoring window.")
	for _, c := range chains {
		for _, u := range st[c] {
			l := fmt.Sprintf(`chain=%q,upstream=%q`, c, u.ID)
			fmt.Fprintf(w, "hb_upstream_latency_ms{%s,quantile=\"0.5\"} %g\n", l, u.P50ms)
			fmt.Fprintf(w, "hb_upstream_latency_ms{%s,quantile=\"0.9\"} %g\n", l, u.P90ms)
			fmt.Fprintf(w, "hb_upstream_latency_ms{%s,quantile=\"0.99\"} %g\n", l, u.P99ms)
		}
	}
	for _, m := range []struct {
		name, help string
		f          func(UpstreamStatus) float64
	}{
		{"hb_upstream_error_rate", "Error rate over the scoring window.", func(u UpstreamStatus) float64 { return u.ErrorRate }},
		{"hb_upstream_block_lag", "Blocks behind the best head in the pool.", func(u UpstreamStatus) float64 { return float64(u.BlockLag) }},
		{"hb_upstream_budget_used_ratio", "Share of the key's token bucket in use.", func(u UpstreamStatus) float64 { return u.BudgetUsed }},
		{"hb_upstream_budget_shed_total", "Calls shed to another key before hitting the provider limit.", func(u UpstreamStatus) float64 { return float64(u.Shed) }},
		{"hb_upstream_healthy", "1 unless the circuit breaker is open.", func(u UpstreamStatus) float64 {
			if u.State == "open" {
				return 0
			}
			return 1
		}},
	} {
		gauge(m.name, m.help)
		for _, c := range chains {
			for _, u := range st[c] {
				fmt.Fprintf(w, "%s{chain=%q,upstream=%q} %g\n", m.name, c, u.ID, m.f(u))
			}
		}
	}
	counter("hb_gateway_requests_total", "Requests served by chain and result.")
	var keys []string
	g.stats.Range(func(k, _ any) bool { keys = append(keys, k.(string)); return true })
	sort.Strings(keys)
	for _, k := range keys {
		v, _ := g.stats.Load(k)
		chain, result, _ := strings.Cut(k, "|")
		fmt.Fprintf(w, "hb_gateway_requests_total{chain=%q,result=%q} %d\n", chain, result, v.(*atomic.Uint64).Load())
	}
	gauge("hb_gateway_cache_entries", "Entries in the response cache.")
	fmt.Fprintf(w, "hb_gateway_cache_entries %d\n", g.cache.len())
	counter("hb_gateway_cache_lookups_total", "Cache lookups by result.")
	fmt.Fprintf(w, "hb_gateway_cache_lookups_total{result=\"hit\"} %d\n", g.cache.hits.Load())
	fmt.Fprintf(w, "hb_gateway_cache_lookups_total{result=\"miss\"} %d\n", g.cache.miss.Load())
}
