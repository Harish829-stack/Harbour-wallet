package swapsvc

// LI.FI (https://docs.li.fi), official REST API. LI.FI recommends the REST API for backend integrations; its JS SDK is
// for frontends that execute routes themselves. Quotes: POST /advanced/routes; the transaction for a step is built only
// when it is about to be signed: POST /advanced/stepTransaction; bridge progress: GET /status.

import (
	"context"
	"encoding/json"
	"math"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
)

type lifiToken struct {
	Address  string `json:"address"`
	ChainID  uint64 `json:"chainId"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
	Name     string `json:"name"`
	PriceUSD any    `json:"priceUSD"`
}

type lifiCost struct {
	Token       *lifiToken `json:"token"`
	Amount      string     `json:"amount"`
	AmountUSD   any        `json:"amountUSD"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
}

type lifiStep struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Tool        string `json:"tool"`
	ToolDetails struct {
		Key, Name, LogoURI string
	} `json:"toolDetails"`
	Action struct {
		FromToken  lifiToken `json:"fromToken"`
		ToToken    lifiToken `json:"toToken"`
		FromAmount string    `json:"fromAmount"`
	} `json:"action"`
	Estimate struct {
		FromAmount        string     `json:"fromAmount"`
		ToAmount          string     `json:"toAmount"`
		ToAmountMin       string     `json:"toAmountMin"`
		ApprovalAddress   string     `json:"approvalAddress"`
		ExecutionDuration any        `json:"executionDuration"`
		GasCosts          []lifiCost `json:"gasCosts"`
		FeeCosts          []lifiCost `json:"feeCosts"`
	} `json:"estimate"`
	IncludedSteps []struct {
		Type string `json:"type"`
	} `json:"includedSteps"`
}

type lifiRoute struct {
	ID            string            `json:"id"`
	FromAmountUSD any               `json:"fromAmountUSD"`
	ToAmountUSD   any               `json:"toAmountUSD"`
	Tags          []string          `json:"tags"`
	Steps         []json.RawMessage `json:"steps"`
}

func lifiAddr(a Asset, d *Domain) string {
	if a.Address != "native" {
		return a.Address
	}
	if d.Kind == "solana" {
		return solNative
	}
	return evmNative
}

var lifiOrder = map[string]string{"quantity": "CHEAPEST", "security": "SAFEST", "latency": "FASTEST", "outcome": "RECOMMENDED"}

func (s *Service) lifiHeaders() map[string]string {
	return map[string]string{"x-lifi-api-key": s.cfg.Keys.LiFi}
}

func (s *Service) lifiRoutes(ctx context.Context, r *QuoteRequest) ([]Route, error) {
	fd, td := domainByID(r.From.DomainID), domainByID(r.To.DomainID)
	slip, _ := slippagePct(r.Slippage)
	order := lifiOrder[r.SortBy]
	if order == "" {
		order = "RECOMMENDED"
	}
	body := map[string]any{
		"fromChainId": fd.LifiChainID, "toChainId": td.LifiChainID,
		"fromTokenAddress": lifiAddr(r.From, fd), "toTokenAddress": lifiAddr(r.To, td),
		"fromAmount": r.Amount, "fromAddress": r.FromAddress, "toAddress": r.ToAddress,
		"options": map[string]any{"slippage": slip / 100, "order": order, "integrator": "harbour-wallet", "allowSwitchChain": false},
	}
	var out struct {
		Routes []lifiRoute `json:"routes"`
	}
	if err := s.do(ctx, http.MethodPost, s.cfg.Hosts.LiFi+"/advanced/routes", s.lifiHeaders(), body, &out); err != nil {
		return nil, err
	}
	var routes []Route
	for _, lr := range out.Routes {
		// Multi-transaction routes are out of scope: single-step routes only.
		if len(lr.Steps) != 1 {
			continue
		}
		if rt, ok := s.mapLifiRoute(lr, r, fd, td); ok {
			routes = append(routes, rt)
		}
	}
	if len(routes) == 0 {
		return nil, errCode("no_liquidity")
	}
	return routes, nil
}

func lifiStepType(st *lifiStep) string {
	switch st.Type {
	case "swap":
		return "swap"
	case "cross":
		return "bridge"
	}
	swapAt, crossAt := -1, -1
	for i, x := range st.IncludedSteps {
		if x.Type == "swap" && swapAt < 0 {
			swapAt = i
		}
		if x.Type == "cross" && crossAt < 0 {
			crossAt = i
		}
	}
	switch {
	case swapAt >= 0 && crossAt >= 0 && swapAt < crossAt:
		return "swapAndBridge"
	case swapAt >= 0 && crossAt >= 0:
		return "bridgeAndSwap"
	case crossAt >= 0:
		return "bridge"
	}
	return "aggregate"
}

func lifiFee(c lifiCost, name string) *Fee {
	if c.Token == nil || digits(c.Amount) == "" {
		return nil
	}
	f := &Fee{Symbol: c.Token.Symbol, Decimals: c.Token.Decimals, Amount: digits(c.Amount), USD: num(c.AmountUSD), Name: name, Description: c.Description,
		IsNative: c.Token.Address == evmNative || c.Token.Address == solNative}
	if f.Name == "" {
		f.Name = c.Name
	}
	return f
}

// mapLifiRoute keeps a route only when LI.FI's step sells exactly the requested amount of the requested token and buys the
// requested token on the requested chain; the assets shown are the request's own.
func (s *Service) mapLifiRoute(lr lifiRoute, r *QuoteRequest, fd, td *Domain) (Route, bool) {
	var st lifiStep
	if json.Unmarshal(lr.Steps[0], &st) != nil || st.ID == "" {
		return Route{}, false
	}
	a := st.Action
	if a.FromToken.ChainID != fd.LifiChainID || a.ToToken.ChainID != td.LifiChainID ||
		!sameAddr(a.FromToken.Address, lifiAddr(r.From, fd)) || !sameAddr(a.ToToken.Address, lifiAddr(r.To, td)) {
		return Route{}, false
	}
	fromAmt := digits(a.FromAmount)
	if fromAmt == "" {
		fromAmt = digits(st.Estimate.FromAmount)
	}
	toAmt, minAmt := digits(st.Estimate.ToAmount), digits(st.Estimate.ToAmountMin)
	if fromAmt != r.Amount || toAmt == "" || minAmt == "" {
		return Route{}, false
	}
	slip, _ := slippagePct(r.Slippage)
	step := Step{
		ID: st.ID, Type: lifiStepType(&st),
		Provider:     ProviderInfo{ID: firstNonEmpty(st.Tool, st.ToolDetails.Key, "lifi"), Name: firstNonEmpty(st.ToolDetails.Name, st.Tool, "LI.FI"), LogoURL: st.ToolDetails.LogoURI},
		FromDomainID: r.From.DomainID, ToDomainID: r.To.DomainID,
		From:         Side{Asset: r.From, Amount: fromAmt},
		To:           Side{Asset: r.To, Amount: toAmt, MinAmount: minAmt},
		Slippage:     Slippage{UserSelected: f64(slip)},
		ProviderFees: []Fee{},
		Raw:          lr.Steps[0],
	}
	if gas := st.Estimate.GasCosts; len(gas) > 0 && gas[0].Token != nil {
		total, usd := new(big.Int), 0.0
		for _, g := range gas {
			if v, ok := new(big.Int).SetString(digits(g.Amount), 10); ok {
				total.Add(total, v)
			}
			if u := num(g.AmountUSD); u != nil {
				usd += *u
			}
		}
		step.NetworkFee = lifiFee(lifiCost{Token: gas[0].Token, Amount: total.String(), AmountUSD: usd}, "Network fee")
	}
	for _, c := range st.Estimate.FeeCosts {
		if f := lifiFee(c, ""); f != nil {
			step.ProviderFees = append(step.ProviderFees, *f)
		}
	}
	if r.From.Address != "native" && st.Estimate.ApprovalAddress != "" {
		step.Approval = &Approval{TokenAddress: r.From.Address, Spender: st.Estimate.ApprovalAddress, MinAmount: fromAmt}
	}
	if secs := pos(num(st.Estimate.ExecutionDuration)); secs != nil {
		step.ExecutionSeconds = secs
	}
	rt := Route{ID: firstNonEmpty(lr.ID, st.ID), Source: LiFi, ExpiresAt: s.expiry(refreshSeconds), Steps: []Step{step},
		Tags: append([]string{}, lr.Tags...), Warnings: []Warning{}, FromAmountUSD: num(lr.FromAmountUSD), ToAmountUSD: num(lr.ToAmountUSD), TotalSeconds: step.ExecutionSeconds}
	if rt.FromAmountUSD != nil && *rt.FromAmountUSD > 0 && rt.ToAmountUSD != nil {
		impact := (*rt.ToAmountUSD - *rt.FromAmountUSD) / *rt.FromAmountUSD * 100
		rt.PriceImpact = f64(math.Round(impact*10000) / 10000)
	}
	return rt, true
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if s != "" {
			return s
		}
	}
	return ""
}

// lifiStepTransaction asks LI.FI to build the transaction for one step (the step object it returned in the quote).
func (s *Service) lifiStepTransaction(ctx context.Context, step json.RawMessage) (json.RawMessage, error) {
	var probe struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(step, &probe) != nil || probe.ID == "" {
		return nil, errCode("bad_request")
	}
	var out json.RawMessage
	err := s.do(ctx, http.MethodPost, s.cfg.Hosts.LiFi+"/advanced/stepTransaction", s.lifiHeaders(), step, &out)
	return out, err
}

func (s *Service) lifiStatus(ctx context.Context, q StatusRequest) (*StatusResult, error) {
	fd, td := domainByID(q.FromDomainID), domainByID(q.ToDomainID)
	if fd == nil || td == nil {
		return nil, errCode("unsupported_domain")
	}
	v := url.Values{"txHash": {q.TxHash}, "fromChain": {strconv.FormatUint(fd.LifiChainID, 10)}, "toChain": {strconv.FormatUint(td.LifiChainID, 10)}}
	if q.Bridge != "" {
		v.Set("bridge", q.Bridge)
	}
	var out struct {
		Status    string `json:"status"`
		Substatus string `json:"substatus"`
		Receiving struct {
			TxHash string `json:"txHash"`
		} `json:"receiving"`
	}
	if err := s.do(ctx, http.MethodGet, s.cfg.Hosts.LiFi+"/status?"+v.Encode(), s.lifiHeaders(), nil, &out); err != nil {
		return nil, err
	}
	st := "pending"
	switch out.Status {
	case "DONE":
		st = "success"
	case "FAILED", "INVALID":
		st = "failed"
	}
	return &StatusResult{Status: st, Detail: safeWord(out.Substatus), ReceivingTxHash: safeHash(out.Receiving.TxHash)}, nil
}

// TokenInfo is a token found by address or symbol.
type TokenInfo struct {
	DomainID string   `json:"domainId"`
	Address  string   `json:"address"` // "native" for the chain coin
	Symbol   string   `json:"symbol"`
	Name     string   `json:"name"`
	Decimals int      `json:"decimals"`
	PriceUSD *float64 `json:"priceUsd,omitempty"`
}

// Token looks a token up on one network (LI.FI /token).
func (s *Service) Token(ctx context.Context, domainID, query string) (*TokenInfo, error) {
	d := domainByID(domainID)
	if d == nil || d.Kind == "utxo" {
		return nil, errCode("unsupported_domain")
	}
	if !reTokenQuery.MatchString(query) {
		return nil, errCode("bad_request")
	}
	if !s.Enabled(LiFi) {
		return nil, errCode("unavailable")
	}
	var t lifiToken
	v := url.Values{"chain": {strconv.FormatUint(d.LifiChainID, 10)}, "token": {query}}
	if err := s.do(ctx, http.MethodGet, s.cfg.Hosts.LiFi+"/token?"+v.Encode(), s.lifiHeaders(), nil, &t); err != nil {
		return nil, err
	}
	if t.ChainID != d.LifiChainID || t.Decimals < 0 || t.Decimals > 36 || !reSymbol.MatchString(t.Symbol) {
		return nil, errCode("invalid_asset")
	}
	addr := t.Address
	if addr == evmNative || addr == solNative {
		addr = "native"
	} else if !validAddr(d.Kind, addr) {
		return nil, errCode("invalid_asset")
	}
	name := t.Name
	if len(name) > 64 || name == "" {
		name = t.Symbol
	}
	return &TokenInfo{DomainID: d.ID, Address: addr, Symbol: t.Symbol, Name: name, Decimals: t.Decimals, PriceUSD: pos(num(t.PriceUSD))}, nil
}
