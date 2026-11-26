// Package earnsvc is Harbour's earn service. It talks to the earn providers through their official APIs:
//   - Aave V3 through AaveKit (https://aave.com/docs/aave-v3/getting-started/graphql, the API behind Aave's own
//     @aave/client SDK): market list and the supply / withdraw transaction plans, with fixed queries only;
//   - Lido and Rocket Pool staking APR from their official public APIs.
//
// Trust model: the service never holds user keys and never signs. The extension decodes every transaction plan and
// accepts only the exact call the user reviewed (Aave address book: pool, gateway, amount, owner), reads balances and
// reserve state on-chain, and signs locally. This package only orchestrates the calls and maps failures to codes.
package earnsvc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// Error is a stable code. For Aave input errors Reason says which kind (the provider's text is never returned).
type Error struct {
	Code   string `json:"code"`
	Reason string `json:"reason,omitempty"`
}

func (e *Error) Error() string { return "earn: " + e.Code }

func errCode(code string) *Error { return &Error{Code: code} }

// Messages are the API's plain-language texts per code / Aave reason.
var Messages = map[string]string{
	"bad_request":   "Invalid request.",
	"unavailable":   "Earn data is temporarily unavailable. Try again shortly.",
	"unsupported":   "This network is not supported for Earn.",
	"supply_cap":    "This deposit exceeds the remaining supply cap.",
	"not_available": "This amount is not available to withdraw.",
	"health_factor": "This withdrawal would put your borrowed position at risk.",
	"paused":        "This Aave reserve is not accepting this action right now.",
	"aave_rejected": "Aave could not prepare this transaction. Try again shortly.",
}

// Providers.
const (
	Aave       = "aave"
	Lido       = "lido"
	RocketPool = "rocketpool"
)

// Hosts are the official endpoints (overridden in tests).
type Hosts struct{ AaveKit, LidoAPR, RocketAPR string }

func DefaultHosts() Hosts {
	return Hosts{AaveKit: "https://api.v3.aave.com/graphql", LidoAPR: "https://eth-api.lido.fi/v1/protocol/steth/apr/sma", RocketAPR: "https://api.rocketpool.net/mainnet/reth/apr"}
}

type Config struct {
	Hosts Hosts
	// AaveChains are the chains Aave may be used on (default: Base Sepolia, the reviewed testnet market).
	AaveChains map[uint64]bool
	// Disabled switches providers off without an extension release (EARN_DISABLED_PROVIDERS=aave,lido).
	Disabled map[string]bool
	Client   *http.Client
	Now      func() time.Time
	// Log receives provider failures for operators (host, path and status only). Nil: not logged.
	Log *slog.Logger
}

type Service struct {
	cfg     Config
	client  *http.Client
	mu      sync.Mutex
	apr     map[string]aprEntry
	markets map[uint64]marketsEntry
	flight  singleflight.Group // one upstream call per key at a time (audit M6: no stampede)
}

type marketsEntry struct {
	at  time.Time
	raw json.RawMessage
}

type aprEntry struct {
	at  time.Time
	val float64
}

const (
	maxBody    = 2 << 20
	aprTTL     = 10 * time.Minute
	marketsTTL = 60 * time.Second
)

// New returns a Service; redirects are never followed.
func New(cfg Config) *Service {
	if cfg.Hosts == (Hosts{}) {
		cfg.Hosts = DefaultHosts()
	}
	if cfg.AaveChains == nil {
		cfg.AaveChains = map[uint64]bool{84532: true}
	}
	if cfg.Disabled == nil {
		cfg.Disabled = map[string]bool{}
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	c := cfg.Client
	if c == nil {
		c = &http.Client{Timeout: 15 * time.Second}
	}
	cc := *c
	cc.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &Service{cfg: cfg, client: &cc, apr: map[string]aprEntry{}, markets: map[uint64]marketsEntry{}}
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

// ProviderStates lists every provider and whether it is on.
func (s *Service) ProviderStates() map[string]bool {
	return map[string]bool{Aave: !s.cfg.Disabled[Aave], Lido: !s.cfg.Disabled[Lido], RocketPool: !s.cfg.Disabled[RocketPool]}
}

func (s *Service) do(ctx context.Context, method, url string, body any, out any) error {
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return errCode("bad_request")
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rd)
	if err != nil {
		return errCode("unavailable")
	}
	req.Header.Set("Accept", "application/json")
	if rd != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := s.client.Do(req)
	if err != nil {
		s.logUpstream(req, 0)
		var ne net.Error
		if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout()) {
			return &Error{Code: "unavailable", Reason: "timeout"}
		}
		return errCode("unavailable")
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxBody+1))
	if err != nil || len(raw) > maxBody || res.StatusCode < 200 || res.StatusCode > 299 {
		s.logUpstream(req, res.StatusCode)
		return errCode("unavailable")
	}
	if json.Unmarshal(raw, out) != nil {
		return errCode("unavailable")
	}
	return nil
}

// logUpstream records a provider failure: host, path and status only (never query strings or bodies).
func (s *Service) logUpstream(req *http.Request, status int) {
	if s.cfg.Log != nil {
		s.cfg.Log.Warn("earn provider failed", "host", req.URL.Host, "path", req.URL.Path, "status", status)
	}
}

// ---------- Aave (AaveKit) ----------

// The queries are fixed here; clients cannot send their own GraphQL.
const (
	aaveMarkets = `query HarbourEarnMarkets($r: MarketsRequest!) { markets(request: $r) { address chain { chainId }
  reserves(request: { reserveType: SUPPLY }) { underlyingToken { address symbol decimals } aToken { address } acceptsNative { symbol decimals }
    isFrozen isPaused supplyInfo { apy { formatted } supplyCapReached supplyCap { amount { raw } } total { value } } } } }`
	aaveTxFields = `to from data value chainId operation`
	aavePlan     = `__typename ... on TransactionRequest { ` + aaveTxFields + ` } ... on ApprovalRequired { approval { ` + aaveTxFields + ` } originalTransaction { ` + aaveTxFields + ` } }
  ... on InsufficientBalanceError { required { value } available { value } }`
	aaveSupply   = `query HarbourEarnSupply($r: SupplyRequest!) { value: supply(request: $r) { ` + aavePlan + ` } }`
	aaveWithdraw = `query HarbourEarnWithdraw($r: WithdrawRequest!) { value: withdraw(request: $r) { ` + aavePlan + ` } }`
)

var (
	reAddr  = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	reValue = regexp.MustCompile(`^(0|[1-9][0-9]{0,29})(\.[0-9]{1,36})?$`)
)

// classifyAave turns an AaveKit "bad user input" message into a reason; everything else is an outage.
func classifyAave(msg string) *Error {
	m := strings.ToLower(msg)
	if !strings.Contains(m, "bad user input") {
		return errCode("unavailable")
	}
	switch {
	case strings.Contains(m, "supply cap"):
		return &Error{Code: "aave_rejected", Reason: "supply_cap"}
	case strings.Contains(m, "no supply to withdraw"), strings.Contains(m, "not enough"), strings.Contains(m, "exceeds"):
		return &Error{Code: "aave_rejected", Reason: "not_available"}
	case strings.Contains(m, "health factor"), strings.Contains(m, "collateral"):
		return &Error{Code: "aave_rejected", Reason: "health_factor"}
	case strings.Contains(m, "paused"), strings.Contains(m, "frozen"), strings.Contains(m, "inactive"):
		return &Error{Code: "aave_rejected", Reason: "paused"}
	}
	return &Error{Code: "aave_rejected", Reason: "other"}
}

// aaveQuery runs one fixed query and returns AaveKit's `data` object unchanged.
func (s *Service) aaveQuery(ctx context.Context, query string, vars map[string]any) (json.RawMessage, error) {
	if s.cfg.Disabled[Aave] {
		return nil, errCode("unavailable")
	}
	var out struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := s.do(ctx, http.MethodPost, s.cfg.Hosts.AaveKit, map[string]any{"query": query, "variables": vars}, &out); err != nil {
		return nil, err
	}
	if len(out.Errors) > 0 {
		return nil, classifyAave(out.Errors[0].Message)
	}
	if len(out.Data) == 0 || string(out.Data) == "null" {
		return nil, errCode("unavailable")
	}
	return out.Data, nil
}

// AaveMarkets returns AaveKit's markets (with supply reserves) for one allowed chain.
func (s *Service) AaveMarkets(ctx context.Context, chainID uint64) (json.RawMessage, error) {
	if !s.cfg.AaveChains[chainID] {
		return nil, errCode("unsupported")
	}
	s.mu.Lock()
	if e, ok := s.markets[chainID]; ok && s.cfg.Now().Sub(e.at) < marketsTTL {
		s.mu.Unlock()
		return e.raw, nil
	}
	s.mu.Unlock()
	v, err, _ := s.flight.Do(fmt.Sprintf("markets:%d", chainID), func() (any, error) {
		raw, err := s.aaveQuery(ctx, aaveMarkets, map[string]any{"r": map[string]any{"chainIds": []uint64{chainID}}})
		if err == nil {
			s.mu.Lock()
			s.markets[chainID] = marketsEntry{at: s.cfg.Now(), raw: raw}
			s.mu.Unlock()
		}
		return raw, err
	})
	if err != nil {
		return nil, err
	}
	return v.(json.RawMessage), nil
}

// AaveTxRequest asks for a supply / withdraw plan. Token "" means the chain's native coin (Aave's WETH gateway).
type AaveTxRequest struct {
	Action  string `json:"action"` // supply | withdraw
	ChainID uint64 `json:"chainId"`
	Market  string `json:"market"`
	Sender  string `json:"sender"`
	Token   string `json:"token,omitempty"`
	Value   string `json:"value"` // decimal amount in token units, e.g. "1.5"
}

// AaveTransaction returns AaveKit's plan (TransactionRequest / ApprovalRequired / InsufficientBalanceError) unchanged.
func (s *Service) AaveTransaction(ctx context.Context, r AaveTxRequest) (json.RawMessage, error) {
	if !s.cfg.AaveChains[r.ChainID] {
		return nil, errCode("unsupported")
	}
	if (r.Action != "supply" && r.Action != "withdraw") || !reAddr.MatchString(r.Market) || !reAddr.MatchString(r.Sender) ||
		(r.Token != "" && !reAddr.MatchString(r.Token)) || !reValue.MatchString(r.Value) || strings.Trim(r.Value, "0.") == "" {
		return nil, errCode("bad_request")
	}
	native := r.Token == ""
	var amount map[string]any
	switch {
	case r.Action == "supply" && native:
		amount = map[string]any{"native": r.Value}
	case r.Action == "supply":
		amount = map[string]any{"erc20": map[string]any{"currency": r.Token, "value": r.Value}}
	case native:
		amount = map[string]any{"native": map[string]any{"value": map[string]any{"exact": r.Value}}}
	default:
		amount = map[string]any{"erc20": map[string]any{"currency": r.Token, "value": map[string]any{"exact": r.Value}}}
	}
	q := aaveSupply
	if r.Action == "withdraw" {
		q = aaveWithdraw
	}
	return s.aaveQuery(ctx, q, map[string]any{"r": map[string]any{"market": r.Market, "chainId": r.ChainID, "sender": r.Sender, "amount": amount}})
}

// ---------- staking APR (Lido, Rocket Pool) ----------

// APR returns a provider's current staking APR in percent, cached for 10 minutes.
func (s *Service) APR(ctx context.Context, provider string) (float64, error) {
	var url string
	switch provider {
	case Lido:
		url = s.cfg.Hosts.LidoAPR
	case RocketPool:
		url = s.cfg.Hosts.RocketAPR
	default:
		return 0, errCode("bad_request")
	}
	if s.cfg.Disabled[provider] {
		return 0, errCode("unavailable")
	}
	s.mu.Lock()
	if e, ok := s.apr[provider]; ok && s.cfg.Now().Sub(e.at) < aprTTL {
		s.mu.Unlock()
		return e.val, nil
	}
	s.mu.Unlock()
	v, err, _ := s.flight.Do("apr:"+provider, func() (any, error) { return s.fetchAPR(ctx, provider, url) })
	if err != nil {
		return 0, err
	}
	return v.(float64), nil
}

func (s *Service) fetchAPR(ctx context.Context, provider, url string) (float64, error) {
	var raw map[string]any
	if err := s.do(ctx, http.MethodGet, url, nil, &raw); err != nil {
		return 0, err
	}
	var v any
	if provider == Lido {
		if d, ok := raw["data"].(map[string]any); ok {
			v = d["smaApr"]
		}
	} else {
		v = raw["yearlyAPR"]
	}
	f, ok := toFloat(v)
	if !ok || f <= 0 || f >= 100 {
		return 0, errCode("unavailable")
	}
	f = float64(int64(f*100+0.5)) / 100
	s.mu.Lock()
	s.apr[provider] = aprEntry{at: s.cfg.Now(), val: f}
	s.mu.Unlock()
	return f, nil
}

func toFloat(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, x == x
	case string:
		f, err := strconv.ParseFloat(x, 64)
		return f, err == nil && f == f
	}
	return 0, false
}
