// Package gateway is rpc-gateway: the only Harbour component that talks
// JSON-RPC to providers. Per chain it pools upstreams scored on error rate,
// p90 latency and block lag, with failover, circuit breaking, per-key
// budgets, a finality-aware cache, hedging for user-facing reads only,
// sticky sessions, eth_getLogs splitting and broadcast fan-out for sends.
// The design follows eRPC's (docs.erpc.cloud) but runs in-process.
package gateway

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/sha3"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/registry"
)

// Gateway routes requests to chain pools.
type Gateway struct {
	cfg   *config.Config
	pools map[string]*Pool
	cache *cache
	log   *slog.Logger
	stats sync.Map // chain|result -> *atomicCounter
}

// CallOptions describe the caller.
type CallOptions struct {
	// UserFacing allows hedging (estimate, simulate, receipt, balance on open).
	// Background jobs leave it false so they never double provider spend.
	UserFacing bool
	// Session pins a call sequence (estimate -> nonce -> send) to one upstream.
	Session string
}

// New builds a gateway from config, constructing upstreams via the registry.
// Chains with no usable upstream are skipped with a warning.
func New(cfg *config.Config, getenv func(string) string, log *slog.Logger) (*Gateway, error) {
	g := &Gateway{cfg: cfg, pools: map[string]*Pool{}, cache: newCacheFor(cfg.Gateway), log: log}
	for _, name := range cfg.ChainNames() {
		res, skipped := cfg.Upstreams(name, getenv)
		if len(skipped) > 0 {
			log.Info("upstreams without keys skipped", "chain", name, "upstreams", skipped)
		}
		var ups []rpc.Upstream
		var weights, rps []float64
		for _, r := range res {
			f, err := registry.RPCUpstreams.Get(r.Adapter)
			if err != nil {
				return nil, err
			}
			u, err := f(r.Config)
			if err != nil {
				return nil, fmt.Errorf("chain %s: %w", name, err)
			}
			ups = append(ups, u)
			weights = append(weights, r.Weight)
			rps = append(rps, r.RPS)
		}
		if len(ups) == 0 {
			log.Warn("chain has no usable upstreams; disabled", "chain", name)
			continue
		}
		g.pools[name] = NewPool(name, cfg.Chains[name], cfg.Gateway, ups, weights, rps, log)
	}
	if len(g.pools) == 0 {
		return nil, fmt.Errorf("gateway: no chain has a usable upstream (set provider keys in .env)")
	}
	return g, nil
}

// NewWithPools is for tests: supply pools directly.
func NewWithPools(cfg *config.Config, pools map[string]*Pool, log *slog.Logger) *Gateway {
	return &Gateway{cfg: cfg, pools: pools, cache: newCacheFor(cfg.Gateway), log: log}
}

// Pool returns a chain's pool.
func (g *Gateway) Pool(chain string) (*Pool, bool) {
	p, ok := g.pools[chain]
	return p, ok
}

// Run starts head tracking for all pools; blocks until ctx ends.
func (g *Gateway) Run(ctx context.Context) {
	var wg sync.WaitGroup
	for _, p := range g.pools {
		wg.Add(1)
		go func(p *Pool) { defer wg.Done(); p.RunHeads(ctx) }(p)
	}
	wg.Wait()
}

// Handle serves one request and always returns a response.
func (g *Gateway) Handle(ctx context.Context, chain string, req *rpc.Request, opt CallOptions) *rpc.Response {
	resp := g.handle(ctx, chain, req, opt, false)
	resp.ID = req.ID
	resp.JSONRPC = "2.0"
	outcome := "ok"
	if resp.Error != nil {
		outcome = "error"
	}
	g.count(chain, outcome)
	return resp
}

// HandleBatch routes each item independently and reassembles in order.
func (g *Gateway) HandleBatch(ctx context.Context, chain string, reqs []rpc.Request, opt CallOptions) []*rpc.Response {
	out := make([]*rpc.Response, len(reqs))
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	for i := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(i int) {
			defer wg.Done()
			defer func() { <-sem }()
			out[i] = g.Handle(ctx, chain, &reqs[i], opt)
		}(i)
	}
	wg.Wait()
	return out
}

func (g *Gateway) handle(ctx context.Context, chain string, req *rpc.Request, opt CallOptions, noSplit bool) *rpc.Response {
	p, ok := g.pools[chain]
	if !ok {
		return rpc.NewGatewayError(req.ID, rpc.CodeBadRequest, "unknown_chain", "Unknown chain", false, nil)
	}
	if req.Method == "" {
		return rpc.NewGatewayError(req.ID, rpc.CodeBadRequest, "bad_request", "Invalid request", false, nil)
	}
	switch rpc.MethodKind(req.Method) {
	case rpc.KindForbidden:
		return rpc.NewGatewayError(req.ID, rpc.CodeMethodNotAllowed, "method_not_allowed", "Method not available", false, nil)
	case rpc.KindWrite:
		return g.broadcast(ctx, p, req)
	}
	params := splitParams(req.Params)
	if req.Method == "eth_getLogs" && !noSplit {
		if r, split := g.splitLogs(ctx, p, req, params, opt); split {
			return r
		}
	}
	key := chain + "|" + req.Method + "|" + string(compact(req.Params))
	if v, hit := g.cache.get(key); hit {
		g.count(chain, "cache_hit")
		return &rpc.Response{Result: v}
	}
	var minBlock uint64
	if ref, has := requestBlock(req.Method, params); has && ref.numeric() {
		minBlock = ref.num
	}
	resp := g.execute(ctx, p, req, opt, minBlock)
	if resp.Error == nil {
		if ttl, forever, ok := cachePolicy(req.Method, params, resp.Result, p.Finalized(), p.cfg.BlockTime); ok {
			g.cache.put(key, resp.Result, ttl, forever)
		}
	}
	return resp
}

func compact(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return nil
	}
	var v any
	if json.Unmarshal(raw, &v) != nil {
		return raw
	}
	b, _ := json.Marshal(v)
	return b
}

type outcome struct {
	m     *member
	resp  *rpc.Response
	err   error
	class rpc.Class
}

func (g *Gateway) call(ctx context.Context, p *Pool, m *member, req *rpc.Request, minBlock uint64) outcome {
	start := time.Now()
	resp, err := m.up.Call(ctx, req)
	class := rpc.Classify(resp, err)
	// Empty result for a block the pool says exists means this node is behind.
	if class == rpc.OK && req.Method == "eth_getBlockByNumber" && minBlock > 0 && string(resp.Result) == "null" {
		if best := p.BestHead(); best > minBlock {
			class = rpc.Retryable
		}
	}
	if ctx.Err() != nil && class == rpc.Retryable {
		// Cancelled (hedge loser or caller gone): no health signal.
		m.br.release()
		return outcome{m: m, resp: resp, err: err, class: class}
	}
	m.record(time.Now(), time.Since(start), class)
	if class == rpc.Retryable {
		g.log.Debug("upstream retryable failure", "upstream", m.up.ID(), "method", req.Method, "err", errString(resp, err))
	}
	return outcome{m: m, resp: resp, err: err, class: class}
}

func errString(resp *rpc.Response, err error) string {
	if err != nil {
		return err.Error()
	}
	if resp != nil && resp.Error != nil {
		return resp.Error.Message
	}
	return ""
}

func (p *Pool) hedgeDelay(m *member) time.Duration {
	st := m.win.stats(time.Now())
	d := st.p90
	if st.n < 5 {
		d = 300 * time.Millisecond
	}
	if d < p.gcfg.HedgeMin {
		d = p.gcfg.HedgeMin
	}
	if d > p.gcfg.HedgeMax {
		d = p.gcfg.HedgeMax
	}
	return d
}

// execute runs a read with failover (and hedging when user-facing).
func (g *Gateway) execute(ctx context.Context, p *Pool, req *rpc.Request, opt CallOptions, minBlock uint64) *rpc.Response {
	tried := map[*member]bool{}
	var triedIDs []string
	attempts := 0
	for attempts < p.gcfg.MaxAttempts {
		if ctx.Err() != nil {
			break
		}
		m := p.pinned(opt.Session, tried, minBlock)
		if m == nil {
			m = p.pick(ctx, tried, minBlock)
		}
		if m == nil && minBlock > 0 {
			// No upstream reports that block yet; let the best one try.
			m = p.pick(ctx, tried, 0)
		}
		if m == nil {
			break
		}
		tried[m] = true
		triedIDs = append(triedIDs, m.up.ID())
		attempts++

		var o outcome
		if opt.UserFacing && attempts == 1 && len(p.members) > 1 {
			o = g.hedged(ctx, p, m, req, minBlock, tried, &triedIDs)
		} else {
			o = g.call(ctx, p, m, req, minBlock)
		}
		if o.class != rpc.Retryable {
			p.pin(opt.Session, o.m)
			if o.resp == nil {
				return rpc.NewGatewayError(req.ID, rpc.CodeUpstreamsUnavailable, "upstreams_unavailable",
					"Network busy, retrying", true, triedIDs)
			}
			return o.resp
		}
	}
	return rpc.NewGatewayError(req.ID, rpc.CodeUpstreamsUnavailable, "upstreams_unavailable",
		"Network busy, retrying", true, triedIDs)
}

// hedged sends to first; if no answer by its p90, also to a second upstream.
// First non-retryable answer wins; the loser is cancelled.
func (g *Gateway) hedged(ctx context.Context, p *Pool, first *member, req *rpc.Request, minBlock uint64, tried map[*member]bool, triedIDs *[]string) outcome {
	hctx, cancel := context.WithCancel(ctx)
	defer cancel()
	results := make(chan outcome, 2)
	go func() { results <- g.call(hctx, p, first, req, minBlock) }()
	timer := time.NewTimer(p.hedgeDelay(first))
	defer timer.Stop()
	inflight := 1
	var lastRetryable outcome
	for {
		select {
		case <-timer.C:
			if second := p.pick(hctx, tried, minBlock); second != nil {
				tried[second] = true
				*triedIDs = append(*triedIDs, second.up.ID())
				inflight++
				go func() { results <- g.call(hctx, p, second, req, minBlock) }()
			}
		case o := <-results:
			inflight--
			if o.class != rpc.Retryable {
				return o
			}
			lastRetryable = o
			if inflight == 0 {
				// The first one failed fast before the hedge fired: let the
				// failover loop continue (it skips tried members).
				return lastRetryable
			}
		case <-ctx.Done():
			return outcome{class: rpc.Retryable, err: ctx.Err()}
		}
	}
}

// broadcast sends a signed transaction to several upstreams at once on
// purpose: the same raw transaction is idempotent by hash. Never hedged.
func (g *Gateway) broadcast(ctx context.Context, p *Pool, req *rpc.Request) *rpc.Response {
	params := splitParams(req.Params)
	var rawHex string
	if len(params) > 0 {
		_ = json.Unmarshal(params[0], &rawHex)
	}
	raw, err := hex.DecodeString(strings.TrimPrefix(rawHex, "0x"))
	if err != nil || len(raw) == 0 {
		return &rpc.Response{Error: &rpc.Error{Code: -32602, Message: "invalid raw transaction"}}
	}
	h := sha3.NewLegacyKeccak256()
	h.Write(raw)
	txHash := "0x" + hex.EncodeToString(h.Sum(nil))

	tried := map[*member]bool{}
	var triedIDs []string
	var firstDeterministic *rpc.Response
	for round := 0; round < 2; round++ {
		var ms []*member
		for len(ms) < p.gcfg.BroadcastFanout {
			m := p.pick(ctx, tried, 0)
			if m == nil {
				break
			}
			tried[m] = true
			triedIDs = append(triedIDs, m.up.ID())
			ms = append(ms, m)
		}
		if len(ms) == 0 {
			break
		}
		// Sends outlive the caller's context so a disconnect can't half-send.
		bctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
		results := make(chan outcome, len(ms))
		for _, m := range ms {
			go func(m *member) { results <- g.call(bctx, p, m, req, 0) }(m)
		}
		var success *rpc.Response
		got := 0
		for got < len(ms) && success == nil {
			o := <-results
			got++
			switch {
			case o.class == rpc.OK:
				success = o.resp
			case o.class == rpc.Deterministic && o.resp != nil && o.resp.Error != nil && isAlreadyKnown(o.resp.Error.Message):
				success = &rpc.Response{Result: json.RawMessage(strconv.Quote(txHash))}
			case o.class == rpc.Deterministic && firstDeterministic == nil && o.resp != nil:
				firstDeterministic = o.resp
			}
		}
		if success != nil {
			remaining := len(ms) - got
			go func() { // let the other sends finish; they carry the same tx
				defer cancel()
				for i := 0; i < remaining; i++ {
					<-results
				}
			}()
			return success
		}
		cancel()
		if firstDeterministic != nil {
			return firstDeterministic
		}
	}
	return rpc.NewGatewayError(req.ID, rpc.CodeUpstreamsUnavailable, "upstreams_unavailable",
		"Network busy, retrying", true, triedIDs)
}

func isAlreadyKnown(msg string) bool {
	m := strings.ToLower(msg)
	return strings.Contains(m, "already known") || strings.Contains(m, "known transaction") ||
		strings.Contains(m, "already imported") || strings.Contains(m, "alreadyknown")
}

// splitLogs breaks large eth_getLogs ranges into chunks every provider accepts.
func (g *Gateway) splitLogs(ctx context.Context, p *Pool, req *rpc.Request, params []json.RawMessage, opt CallOptions) (*rpc.Response, bool) {
	if len(params) != 1 {
		return nil, false
	}
	var f logFilter
	if json.Unmarshal(params[0], &f) != nil || f.BlockHash != "" {
		return nil, false
	}
	resolve := func(raw json.RawMessage) (uint64, bool) {
		ref := parseBlockRef(raw)
		switch {
		case ref.numeric():
			return ref.num, true
		case ref.tag == "latest":
			b := p.BestHead()
			return b, b > 0
		case ref.tag == "earliest":
			return 0, true
		}
		return 0, false
	}
	from, ok1 := resolve(f.FromBlock)
	to, ok2 := resolve(f.ToBlock)
	maxRange := p.cfg.LogsMaxRange
	if !ok1 || !ok2 || to < from || to-from+1 <= maxRange {
		return nil, false
	}
	// Splitting multiplies one request into up to 100 upstream calls: only internal callers get it. User-facing
	// requests (the public API's /v1/rpc) must stay within one chunk.
	if opt.UserFacing {
		return &rpc.Response{Error: &rpc.Error{Code: -32602,
			Message: fmt.Sprintf("block range too large: max %d blocks per request", maxRange)}}, true
	}
	n := (to - from + maxRange) / maxRange
	if n > 100 {
		return &rpc.Response{Error: &rpc.Error{Code: -32602,
			Message: fmt.Sprintf("block range too large: max %d blocks per request", 100*maxRange)}}, true
	}
	chunks := make([][]json.RawMessage, n)
	errs := make([]*rpc.Response, n)
	sem := make(chan struct{}, 4)
	var wg sync.WaitGroup
	for i := uint64(0); i < n; i++ {
		lo := from + i*maxRange
		hi := lo + maxRange - 1
		if hi > to {
			hi = to
		}
		cf := f
		cf.FromBlock = json.RawMessage(strconv.Quote("0x" + strconv.FormatUint(lo, 16)))
		cf.ToBlock = json.RawMessage(strconv.Quote("0x" + strconv.FormatUint(hi, 16)))
		fb, _ := json.Marshal([]logFilter{cf})
		wg.Add(1)
		sem <- struct{}{}
		go func(i uint64, sub rpc.Request) {
			defer wg.Done()
			defer func() { <-sem }()
			r := g.handle(ctx, p.Chain, &sub, CallOptions{Session: opt.Session}, true)
			if r.Error != nil {
				errs[i] = r
				return
			}
			_ = json.Unmarshal(r.Result, &chunks[i])
		}(i, rpc.Request{JSONRPC: "2.0", ID: req.ID, Method: req.Method, Params: fb})
	}
	wg.Wait()
	all := []json.RawMessage{}
	for i := range chunks {
		if errs[i] != nil {
			return errs[i], true
		}
		all = append(all, chunks[i]...)
	}
	b, _ := json.Marshal(all)
	return &rpc.Response{Result: b}, true
}
