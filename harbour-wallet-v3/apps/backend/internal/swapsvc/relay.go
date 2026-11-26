package swapsvc

// Relay (https://docs.relay.link), official REST API: POST /quote/v2 returns ready-made step items (approve, then
// deposit/swap); GET /intents/status/v2 tracks the fill. An API key is required (x-api-key).

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
)

const relaySolanaChainID = 792703809

func relayChainID(domainID string) (uint64, bool) {
	d := domainByID(domainID)
	switch {
	case d == nil:
		return 0, false
	case d.Kind == "evm":
		return d.ChainID, true
	case d.Kind == "solana":
		return relaySolanaChainID, true
	}
	return 0, false
}

// relaySupports: EVM-source routes only (Relay's Solana-source items are raw instructions Harbour does not assemble).
func relaySupports(r *QuoteRequest) bool {
	d := domainByID(r.From.DomainID)
	_, ok := relayChainID(r.To.DomainID)
	return d != nil && d.Kind == "evm" && ok
}

func relayCurrency(a Asset) string {
	if a.Address != "native" {
		return a.Address
	}
	if domainByID(a.DomainID).Kind == "solana" {
		return solNative
	}
	return evmNative
}

type relayQuote struct {
	RequestID string `json:"requestId"`
	Steps     []struct {
		ID    string `json:"id"`
		Kind  string `json:"kind"`
		Items []struct {
			Data struct {
				Data string `json:"data"`
			} `json:"data"`
		} `json:"items"`
	} `json:"steps"`
	Fees map[string]struct {
		Amount    string `json:"amount"`
		AmountUSD any    `json:"amountUsd"`
		Currency  struct {
			Symbol   string `json:"symbol"`
			Decimals int    `json:"decimals"`
		} `json:"currency"`
	} `json:"fees"`
	Details struct {
		CurrencyIn struct {
			AmountUSD any `json:"amountUsd"`
		} `json:"currencyIn"`
		CurrencyOut struct {
			Amount        string `json:"amount"`
			MinimumAmount string `json:"minimumAmount"`
			AmountUSD     any    `json:"amountUsd"`
		} `json:"currencyOut"`
		TotalImpact struct {
			Percent any `json:"percent"`
		} `json:"totalImpact"`
		TimeEstimate any `json:"timeEstimate"`
	} `json:"details"`
}

// relayQuoteRaw fetches a quote and returns both the raw JSON (for the extension's pre-sign checks) and its parsed form.
func (s *Service) relayQuoteRaw(ctx context.Context, r *QuoteRequest) (json.RawMessage, *relayQuote, error) {
	from, _ := relayChainID(r.From.DomainID)
	to, _ := relayChainID(r.To.DomainID)
	slip, _ := slippagePct(r.Slippage)
	body := map[string]any{
		"user": r.FromAddress, "recipient": r.ToAddress, "originChainId": from, "destinationChainId": to,
		"originCurrency": relayCurrency(r.From), "destinationCurrency": relayCurrency(r.To),
		"amount": r.Amount, "tradeType": "EXACT_INPUT", "slippageTolerance": fmt.Sprint(int64(math.Round(slip * 100))), "refundTo": r.FromAddress,
	}
	var raw json.RawMessage
	if err := s.do(ctx, http.MethodPost, s.cfg.Hosts.Relay+"/quote/v2", map[string]string{"x-api-key": s.cfg.Keys.Relay}, body, &raw); err != nil {
		return nil, nil, err
	}
	var q relayQuote
	if json.Unmarshal(raw, &q) != nil || len(q.Steps) == 0 || digits(q.Details.CurrencyOut.Amount) == "" {
		return nil, nil, errCode("no_liquidity")
	}
	return raw, &q, nil
}

// decodeApproveSpender reads the spender of approve(spender, amount) calldata.
func decodeApproveSpender(data string) string {
	d := strings.ToLower(data)
	if !strings.HasPrefix(d, "0x095ea7b3") || len(d) < 138 || d[10:34] != strings.Repeat("0", 24) {
		return ""
	}
	return "0x" + d[34:74]
}

func (s *Service) relayRoutes(ctx context.Context, r *QuoteRequest) ([]Route, error) {
	raw, q, err := s.relayQuoteRaw(ctx, r)
	if err != nil {
		return nil, err
	}
	out := q.Details.CurrencyOut
	min := digits(out.MinimumAmount)
	if min == "" {
		min = digits(out.Amount)
	}
	spender := ""
	for _, st := range q.Steps {
		if st.ID == "approve" && len(st.Items) > 0 {
			spender = decodeApproveSpender(st.Items[0].Data.Data)
		}
	}
	fd := domainByID(r.From.DomainID)
	var fees []Fee
	for _, k := range []struct{ key, name string }{{"relayer", "Relayer fee"}, {"app", "App fee"}} {
		f, ok := q.Fees[k.key]
		if !ok || digits(f.Amount) == "" || f.Amount == "0" {
			continue
		}
		dec := f.Currency.Decimals
		if dec == 0 {
			dec = 18
		}
		fees = append(fees, Fee{Symbol: f.Currency.Symbol, Decimals: dec, Amount: f.Amount, USD: pos(num(f.AmountUSD)), Name: k.name})
	}
	if fees == nil {
		fees = []Fee{}
	}
	var networkFee *Fee
	if g, ok := q.Fees["gas"]; ok && digits(g.Amount) != "" {
		networkFee = &Fee{Symbol: fd.NativeSymbol, Decimals: fd.NativeDecimals, Amount: g.Amount, USD: pos(num(g.AmountUSD)), Name: "Network fee", IsNative: true}
	}
	seconds := pos(num(q.Details.TimeEstimate))
	if seconds == nil {
		seconds = f64(30)
	}
	var impact *float64
	if p := num(q.Details.TotalImpact.Percent); p != nil {
		impact = f64(math.Min(0, *p))
	}
	slip, _ := slippagePct(r.Slippage)
	now := s.cfg.Now().UnixMilli()
	typ := "swapAndBridge"
	if r.From.DomainID == r.To.DomainID {
		typ = "swap"
	}
	step := Step{
		ID: fmt.Sprintf("relay-%d", now), Type: typ,
		Provider:     ProviderInfo{ID: Relay, Name: "Relay", LogoURL: "https://assets.relay.link/icons/1/light.png"},
		FromDomainID: r.From.DomainID, ToDomainID: r.To.DomainID,
		From:        Side{Asset: r.From, Amount: r.Amount},
		To:          Side{Asset: r.To, Amount: digits(out.Amount), MinAmount: min},
		Slippage:    Slippage{UserSelected: f64(slip)},
		PriceImpact: impact, ProviderFees: fees, NetworkFee: networkFee, ExecutionSeconds: seconds,
		Raw: mustRaw(map[string]any{"quote": raw, "request": r, "approveSpender": spender}),
	}
	if r.From.Address != "native" && spender != "" {
		step.Approval = &Approval{TokenAddress: r.From.Address, Spender: spender, MinAmount: r.Amount}
	}
	return []Route{{ID: step.ID, Source: Relay, ExpiresAt: s.expiry(30), Steps: []Step{step}, Tags: []string{}, Warnings: []Warning{},
		FromAmountUSD: pos(num(q.Details.CurrencyIn.AmountUSD)), ToAmountUSD: pos(num(out.AmountUSD)), PriceImpact: impact, TotalSeconds: seconds}}, nil
}

func (s *Service) relayStatus(ctx context.Context, requestID string) (*StatusResult, error) {
	if !reRequestID.MatchString(requestID) {
		return nil, errCode("bad_request")
	}
	var out struct {
		Status string `json:"status"`
	}
	if err := s.do(ctx, http.MethodGet, s.cfg.Hosts.Relay+"/intents/status/v2?requestId="+url.QueryEscape(requestID), map[string]string{"x-api-key": s.cfg.Keys.Relay}, nil, &out); err != nil {
		return nil, err
	}
	switch strings.ToLower(out.Status) {
	case "success":
		return &StatusResult{Status: "success"}, nil
	case "refund", "refunded":
		return &StatusResult{Status: "refunded"}, nil
	case "failure", "failed":
		return &StatusResult{Status: "failed"}, nil
	}
	return &StatusResult{Status: "pending"}, nil
}
