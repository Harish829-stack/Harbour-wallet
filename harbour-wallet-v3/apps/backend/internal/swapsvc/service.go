package swapsvc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Keys are the provider API keys (held only by the backend).
type Keys struct{ LiFi, Jupiter, Relay, Uniswap string }

// Hosts are the provider base URLs (overridden in tests). Thor lists THORNode endpoints, tried in order.
type Hosts struct {
	LiFi, Jupiter, Relay, Uniswap string
	Thor                          []string
}

// DefaultHosts are the providers' official public endpoints.
func DefaultHosts() Hosts {
	return Hosts{
		LiFi: "https://li.quest/v1", Jupiter: "https://api.jup.ag/swap/v1", Relay: "https://api.relay.link",
		Uniswap: "https://trade-api.gateway.uniswap.org/v1",
		Thor:    []string{"https://gateway.liquify.com/chain/thorchain_api", "https://thornode.ninerealms.com"},
	}
}

// Config builds a Service.
type Config struct {
	Keys  Keys
	Hosts Hosts
	// Disabled turns providers off without a new extension release (SWAP_DISABLED_PROVIDERS=relay,thorchain).
	Disabled map[string]bool
	// UniswapChains are the chains the Uniswap route may be used for (default: Ethereum Sepolia only).
	UniswapChains   map[uint64]bool
	ProviderTimeout time.Duration // per provider, default 12 s
	Client          *http.Client
	Now             func() time.Time
	// QuoteCache is how long an identical quote answer is reused (default 8 s; negative: off).
	QuoteCache time.Duration
	// Log receives provider failures for operators (host, path, status and a short, key-scrubbed body). Nil: not logged.
	Log *slog.Logger
}

// Service is safe for concurrent use.
type Service struct {
	cfg    Config
	client *http.Client
	guard  *guard
}

// Provider ids.
const (
	LiFi      = "lifi"
	Relay     = "relay"
	Jupiter   = "jupiter"
	THORChain = "thorchain"
	Uniswap   = "uniswap"
)

// AllProviders in display order.
var AllProviders = []string{LiFi, Relay, Jupiter, THORChain, Uniswap}

const (
	refreshSeconds = 60
	maxBody        = 4 << 20
)

// New returns a Service. Redirects are never followed (an upstream redirect must not carry our API key elsewhere).
func New(cfg Config) *Service {
	if cfg.ProviderTimeout <= 0 {
		cfg.ProviderTimeout = 12 * time.Second
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	if cfg.QuoteCache == 0 {
		cfg.QuoteCache = quoteCacheTTL
	}
	if cfg.UniswapChains == nil {
		cfg.UniswapChains = map[uint64]bool{11155111: true}
	}
	if cfg.Disabled == nil {
		cfg.Disabled = map[string]bool{}
	}
	c := cfg.Client
	if c == nil {
		c = &http.Client{Timeout: 20 * time.Second}
	}
	cc := *c
	cc.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &Service{cfg: cfg, client: &cc, guard: newGuard()}
}

// ParseDisabled reads a comma-separated provider list.
func ParseDisabled(s string) map[string]bool {
	out := map[string]bool{}
	for _, p := range strings.Split(s, ",") {
		if p = strings.ToLower(strings.TrimSpace(p)); p != "" {
			out[p] = true
		}
	}
	return out
}

// Enabled reports whether a provider is configured and not switched off.
func (s *Service) Enabled(p string) bool {
	if s.cfg.Disabled[p] {
		return false
	}
	switch p {
	case LiFi, THORChain:
		return true // keyless public APIs (a LI.FI key only raises rate limits)
	case Relay:
		return s.cfg.Keys.Relay != ""
	case Jupiter:
		return s.cfg.Keys.Jupiter != ""
	case Uniswap:
		return s.cfg.Keys.Uniswap != ""
	}
	return false
}

// ProviderStates lists every provider and whether it is on.
func (s *Service) ProviderStates() map[string]bool {
	out := map[string]bool{}
	for _, p := range AllProviders {
		out[p] = s.Enabled(p)
	}
	return out
}

// ---------- request validation ----------

var (
	reEVMAddr = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	reSolAddr = regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{32,44}$`)
	reBTCAddr = regexp.MustCompile(`^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$`)
	reAmount  = regexp.MustCompile(`^[1-9][0-9]{0,77}$`)
	reDigits  = regexp.MustCompile(`^[0-9]{1,78}$`)
	reSymbol  = regexp.MustCompile(`^[A-Za-z0-9.+_$-]{1,16}$`)
)

func validAddr(kind, a string) bool {
	switch kind {
	case "evm":
		return reEVMAddr.MatchString(a)
	case "solana":
		return reSolAddr.MatchString(a)
	case "utxo":
		return reBTCAddr.MatchString(a)
	}
	return false
}

func validAsset(a Asset) (*Domain, bool) {
	d := domainByID(a.DomainID)
	if d == nil {
		return nil, false
	}
	if a.Decimals < 0 || a.Decimals > 36 || !reSymbol.MatchString(a.Symbol) || len(a.Name) > 64 {
		return d, false
	}
	if a.Address == "native" {
		return d, true
	}
	return d, d.Kind != "utxo" && validAddr(d.Kind, a.Address)
}

// MaxSlippagePct is the highest slippage tolerance accepted (percent; audit M9). The extension uses the same ceiling.
const MaxSlippagePct = 5.0

func slippagePct(s string) (float64, bool) {
	v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return v, err == nil && v > 0 && v <= MaxSlippagePct
}

// Validate checks a quote request (port of the extension's validateRouteRequest, plus address formats).
func (r *QuoteRequest) Validate() error {
	fd, ok1 := validAsset(r.From)
	td, ok2 := validAsset(r.To)
	if fd == nil || td == nil {
		return errCode("unsupported_domain")
	}
	if !ok1 || !ok2 {
		return errCode("invalid_asset")
	}
	if r.From.DomainID == r.To.DomainID && sameAddr(r.From.Address, r.To.Address) {
		return errCode("unsupported_pair")
	}
	if !reAmount.MatchString(r.Amount) {
		return errCode("invalid_amount")
	}
	if _, ok := slippagePct(r.Slippage); !ok {
		return errCode("invalid_slippage")
	}
	if !validAddr(fd.Kind, r.FromAddress) || !validAddr(td.Kind, r.ToAddress) {
		return errCode("invalid_asset")
	}
	switch r.SortBy {
	case "", "quantity", "security", "latency", "outcome":
	default:
		return errCode("bad_request")
	}
	for _, p := range r.Providers {
		if !contains(AllProviders, p) {
			return errCode("bad_request")
		}
	}
	return nil
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// ---------- quotes ----------

// eligible lists the providers that can quote this pair (port of eligibleProviders).
// ProviderCount is how many providers a valid request would ask (0 for an invalid request).
func (s *Service) ProviderCount(r *QuoteRequest) int {
	if r.Validate() != nil {
		return 0
	}
	return len(s.eligible(r))
}

func (s *Service) eligible(r *QuoteRequest) []string {
	fd, td := domainByID(r.From.DomainID), domainByID(r.To.DomainID)
	var out []string
	if fd.Kind == "solana" && td.Kind == "solana" {
		out = append(out, Jupiter)
	} else if fd.Kind != "utxo" && td.Kind != "utxo" {
		out = append(out, LiFi)
	}
	if relaySupports(r) {
		out = append(out, Relay)
	}
	if thorSupports(r) {
		out = append(out, THORChain)
	}
	var keep []string
	for _, p := range out {
		if s.Enabled(p) && (len(r.Providers) == 0 || contains(r.Providers, p)) {
			keep = append(keep, p)
		}
	}
	return keep
}

func (s *Service) runner(p string) func(context.Context, *QuoteRequest) ([]Route, error) {
	switch p {
	case LiFi:
		return s.lifiRoutes
	case Relay:
		return s.relayRoutes
	case Jupiter:
		return s.jupiterRoutes
	case THORChain:
		return s.thorRoutes
	}
	return nil
}

// Quotes asks every eligible provider in parallel (each capped by ProviderTimeout) and returns all routes found.
// It fails only when no provider answered; the most useful error wins.
func (s *Service) Quotes(ctx context.Context, r QuoteRequest) (*QuoteResult, error) {
	if err := r.Validate(); err != nil {
		return nil, err
	}
	if s.cfg.QuoteCache < 0 {
		return s.quotesNow(ctx, r)
	}
	return s.guard.quotes(ctx, s.cfg.Now, s.cfg.QuoteCache, &r, func() (*QuoteResult, error) { return s.quotesNow(ctx, r) })
}

func (s *Service) quotesNow(ctx context.Context, r QuoteRequest) (*QuoteResult, error) {
	providers := s.eligible(&r)
	if len(providers) == 0 {
		return nil, errCode("unsupported_pair")
	}
	type res struct {
		p      string
		routes []Route
		err    error
	}
	ch := make(chan res, len(providers))
	var wg sync.WaitGroup
	for _, p := range providers {
		if s.guard.open(s.cfg.Now(), p) {
			ch <- res{p, nil, errCode("unavailable")}
			continue
		}
		wg.Add(1)
		go func(p string) {
			defer wg.Done()
			pctx, cancel := context.WithTimeout(ctx, s.cfg.ProviderTimeout)
			defer cancel()
			routes, err := s.safeRun(pctx, p, &r)
			s.guard.record(s.cfg.Now(), p, err)
			ch <- res{p, routes, err}
		}(p)
	}
	wg.Wait()
	close(ch)
	out := &QuoteResult{RefreshInterval: refreshSeconds}
	var best *Error
	for x := range ch {
		if x.err != nil {
			e := asErr(x.err)
			out.ProviderErrors = append(out.ProviderErrors, ProviderError{Provider: x.p, Code: e.Code})
			if best == nil || rank(e.Code) < rank(best.Code) {
				best = e
			}
			continue
		}
		for i := range x.routes {
			s.attachRef(&x.routes[i])
		}
		out.Routes = append(out.Routes, x.routes...)
	}
	sort.Slice(out.ProviderErrors, func(i, j int) bool { return out.ProviderErrors[i].Provider < out.ProviderErrors[j].Provider })
	if len(out.Routes) == 0 {
		if best == nil {
			best = errCode("no_liquidity")
		}
		return nil, best
	}
	sortRoutes(out.Routes, r.SortBy)
	tagBestReturn(out.Routes)
	return out, nil
}

// attachRef keeps the provider object a transaction will be built from on the server (LI.FI step, Jupiter quote).
func (s *Service) attachRef(rt *Route) {
	if len(rt.Steps) != 1 {
		return
	}
	switch rt.Source {
	case LiFi:
		rt.QuoteRef = s.guard.putRef(s.cfg.Now(), LiFi, rt.Steps[0].Raw)
	case Jupiter:
		var raw struct {
			Quote json.RawMessage `json:"quote"`
		}
		if json.Unmarshal(rt.Steps[0].Raw, &raw) == nil && len(raw.Quote) > 0 {
			rt.QuoteRef = s.guard.putRef(s.cfg.Now(), Jupiter, raw.Quote)
		}
	}
}

// safeRun turns a provider panic (unexpected response shape) into an error instead of crashing the request.
func (s *Service) safeRun(ctx context.Context, p string, r *QuoteRequest) (routes []Route, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			routes, err = nil, errCode("server")
		}
	}()
	routes, err = s.runner(p)(ctx, r)
	if err == nil && len(routes) == 0 {
		err = errCode("no_liquidity")
	}
	return routes, err
}

func asErr(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return errCode("timeout")
	}
	return errCode("network")
}

func outAmount(r Route) *big.Int {
	v, ok := new(big.Int).SetString(r.Steps[len(r.Steps)-1].To.Amount, 10)
	if !ok {
		return new(big.Int)
	}
	return v
}

// sortRoutes: quantity = most output first, latency = fastest first; security/outcome keep the providers' order.
func sortRoutes(routes []Route, by string) {
	switch by {
	case "quantity", "":
		sort.SliceStable(routes, func(i, j int) bool { return outAmount(routes[i]).Cmp(outAmount(routes[j])) > 0 })
	case "latency":
		secs := func(r Route) float64 {
			if r.TotalSeconds == nil {
				return 1e9
			}
			return *r.TotalSeconds
		}
		sort.SliceStable(routes, func(i, j int) bool { return secs(routes[i]) < secs(routes[j]) })
	}
}

func tagBestReturn(routes []Route) {
	bi := 0
	for i := range routes {
		if outAmount(routes[i]).Cmp(outAmount(routes[bi])) > 0 {
			bi = i
		}
	}
	if !contains(routes[bi].Tags, "BEST_RETURN") {
		routes[bi].Tags = append(routes[bi].Tags, "BEST_RETURN")
	}
}

func (s *Service) expiry(seconds int) int64 {
	return s.cfg.Now().Add(time.Duration(seconds) * time.Second).UnixMilli()
}

// ---------- HTTP to providers ----------

// do sends one JSON request to a provider. Bodies are size-capped; non-2xx answers become error codes; the provider's
// own error text is never returned.
func (s *Service) do(ctx context.Context, method, url string, headers map[string]string, body any, out any) error {
	var rd io.Reader
	if body != nil {
		var buf []byte
		switch b := body.(type) {
		case json.RawMessage:
			buf = b
		default:
			var err error
			if buf, err = json.Marshal(body); err != nil {
				return errCode("bad_request")
			}
		}
		rd = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rd)
	if err != nil {
		return errCode("network")
	}
	req.Header.Set("Accept", "application/json")
	if rd != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		if v != "" {
			req.Header.Set(k, v)
		}
	}
	res, err := s.client.Do(req)
	if err != nil {
		var ne net.Error
		if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout()) {
			return errCode("timeout")
		}
		return errCode("network")
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxBody+1))
	if err != nil {
		return errCode("network")
	}
	if len(raw) > maxBody {
		return errCode("server")
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		var eb map[string]any
		_ = json.Unmarshal(raw, &eb)
		e := classify(res.StatusCode, eb)
		s.logUpstream(req, res.StatusCode, raw, e.Code)
		return e
	}
	if out == nil {
		return nil
	}
	if rm, ok := out.(*json.RawMessage); ok {
		if !json.Valid(raw) {
			return errCode("server")
		}
		*rm = append((*rm)[:0], raw...)
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return errCode("server")
	}
	return nil
}

// ---------- small helpers ----------

// digits returns s when it is a non-negative integer string, else "".
func digits(s string) string {
	s = strings.TrimSpace(s)
	if reDigits.MatchString(s) {
		return s
	}
	return ""
}

// num parses a provider number that may be a JSON string or number; nil when absent or not finite.
func num(v any) *float64 {
	var f float64
	switch x := v.(type) {
	case float64:
		f = x
	case string:
		p, err := strconv.ParseFloat(x, 64)
		if err != nil {
			return nil
		}
		f = p
	case json.Number:
		p, err := x.Float64()
		if err != nil {
			return nil
		}
		f = p
	default:
		return nil
	}
	if f != f || f > 1e18 || f < -1e18 {
		return nil
	}
	return &f
}

func pos(p *float64) *float64 {
	if p == nil || *p <= 0 {
		return nil
	}
	return p
}

func mustRaw(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage("null")
	}
	return b
}

// logUpstream records a provider failure for operators. The query string is dropped and our keys are scrubbed from the body.
func (s *Service) logUpstream(req *http.Request, status int, body []byte, code string) {
	if s.cfg.Log == nil {
		return
	}
	b := string(body)
	if len(b) > 400 {
		b = b[:400]
	}
	for _, k := range []string{s.cfg.Keys.LiFi, s.cfg.Keys.Jupiter, s.cfg.Keys.Relay, s.cfg.Keys.Uniswap} {
		if len(k) >= 8 {
			b = strings.ReplaceAll(b, k, "***")
		}
	}
	s.cfg.Log.Warn("swap provider error", "host", req.URL.Host, "path", req.URL.Path, "status", status, "code", code, "body", cleanText(b, 400))
}
