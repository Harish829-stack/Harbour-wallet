package swapsvc

// Jupiter (https://dev.jup.ag), official Swap API v1 (key required, x-api-key): GET /quote, POST /swap returns the
// unsigned base64 versioned transaction. Same-chain Solana swaps only.

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
)

const wsolMint = "So11111111111111111111111111111111111111112"

// Priority-fee presets for "Solana turbo swaps" (fast / turbo).
var solanaPriority = map[string]struct {
	level string
	max   int64
}{"fast": {"medium", 200_000}, "turbo": {"high", 1_000_000}}

const solBaseFeeLamports = 5000

func jupMint(a Asset) string {
	if a.Address == "native" {
		return wsolMint
	}
	return a.Address
}

func (s *Service) jupHeaders() map[string]string {
	return map[string]string{"x-api-key": s.cfg.Keys.Jupiter}
}

func (s *Service) jupiterRoutes(ctx context.Context, r *QuoteRequest) ([]Route, error) {
	slip, _ := slippagePct(r.Slippage)
	v := url.Values{"inputMint": {jupMint(r.From)}, "outputMint": {jupMint(r.To)}, "amount": {r.Amount},
		"slippageBps": {fmt.Sprint(int64(math.Round(slip * 100)))}, "restrictIntermediateTokens": {"true"}}
	var raw json.RawMessage
	if err := s.do(ctx, http.MethodGet, s.cfg.Hosts.Jupiter+"/quote?"+v.Encode(), s.jupHeaders(), nil, &raw); err != nil {
		return nil, err
	}
	var q struct {
		InputMint            string `json:"inputMint"`
		OutputMint           string `json:"outputMint"`
		InAmount             string `json:"inAmount"`
		OutAmount            string `json:"outAmount"`
		OtherAmountThreshold string `json:"otherAmountThreshold"`
		PriceImpactPct       any    `json:"priceImpactPct"`
	}
	if json.Unmarshal(raw, &q) != nil || digits(q.OutAmount) == "" || q.OutAmount == "0" {
		return nil, errCode("no_liquidity")
	}
	// The quote must be for exactly the requested mints and input amount.
	if q.InputMint != jupMint(r.From) || q.OutputMint != jupMint(r.To) || (q.InAmount != "" && q.InAmount != r.Amount) {
		return nil, errCode("no_liquidity")
	}
	min := digits(q.OtherAmountThreshold)
	if min == "" {
		min = q.OutAmount
	}
	priority := "fast"
	if r.SolanaTurbo {
		priority = "turbo"
	}
	impact := 0.0
	if p := num(q.PriceImpactPct); p != nil {
		impact = -math.Abs(*p) * 100
	}
	slipv := slip
	now := s.cfg.Now().UnixMilli()
	step := Step{
		ID: fmt.Sprintf("jupiter-%d", now), Type: "swap",
		Provider:     ProviderInfo{ID: Jupiter, Name: "Jupiter"},
		FromDomainID: "solana", ToDomainID: "solana",
		From:     Side{Asset: r.From, Amount: r.Amount},
		To:       Side{Asset: r.To, Amount: q.OutAmount, MinAmount: min},
		Slippage: Slippage{UserSelected: &slipv}, PriceImpact: f64(impact), ProviderFees: []Fee{},
		NetworkFee:       &Fee{Symbol: "SOL", Decimals: 9, Amount: fmt.Sprint(solBaseFeeLamports + solanaPriority[priority].max), Name: "Network fee", IsNative: true, UpperBound: true},
		ExecutionSeconds: f64(5),
		Raw:              mustRaw(map[string]any{"quote": raw, "priority": priority}),
	}
	return []Route{{ID: step.ID, Source: Jupiter, ExpiresAt: s.expiry(refreshSeconds), Steps: []Step{step}, Tags: []string{"RECOMMENDED"}, Warnings: []Warning{},
		PriceImpact: step.PriceImpact, TotalSeconds: f64(5)}}, nil
}

// jupiterSwap builds the unsigned transaction for a quote Jupiter returned.
func (s *Service) jupiterSwap(ctx context.Context, quote json.RawMessage, priority, user string) (json.RawMessage, error) {
	p, ok := solanaPriority[priority]
	if !ok || !reSolAddr.MatchString(user) || !json.Valid(quote) || len(quote) < 2 || quote[0] != '{' {
		return nil, errCode("bad_request")
	}
	body := map[string]any{"quoteResponse": quote, "userPublicKey": user, "wrapAndUnwrapSol": true, "dynamicComputeUnitLimit": true,
		"prioritizationFeeLamports": map[string]any{"priorityLevelWithMaxLamports": map[string]any{"priorityLevel": p.level, "maxLamports": p.max}}}
	var out struct {
		SwapTransaction string `json:"swapTransaction"`
	}
	if err := s.do(ctx, http.MethodPost, s.cfg.Hosts.Jupiter+"/swap", s.jupHeaders(), body, &out); err != nil {
		return nil, err
	}
	if out.SwapTransaction == "" || !reBase64.MatchString(out.SwapTransaction) {
		return nil, errCode("server")
	}
	return mustRaw(map[string]string{"swapTransaction": out.SwapTransaction}), nil
}
