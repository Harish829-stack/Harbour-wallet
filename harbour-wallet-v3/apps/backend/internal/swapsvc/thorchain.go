package swapsvc

// THORChain native swaps (BTC <-> EVM coins/tokens), quoted by public THORNode endpoints (no key), tried in order:
// GET /thorchain/quote/swap, GET /thorchain/tx/status/{hash}. The quote names the vault, memo and router; the extension
// re-quotes right before signing and cross-checks the vault against independent THORNodes itself.

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

var thorChains = map[string]struct{ chain, native string }{
	"bitcoin":    {"BTC", "BTC.BTC"},
	"ethereum":   {"ETH", "ETH.ETH"},
	"smartchain": {"BSC", "BSC.BNB"},
	"base":       {"BASE", "BASE.ETH"},
}

var reThorSymbol = regexp.MustCompile(`^[A-Za-z0-9]{1,16}$`)

const thorDecimals = 8

// thorAsset is THORChain asset notation (CHAIN.SYMBOL or CHAIN.SYMBOL-0XCONTRACT); "" when not a THORChain asset.
func thorAsset(a Asset) string {
	c, ok := thorChains[a.DomainID]
	if !ok {
		return ""
	}
	if a.Address == "native" {
		return c.native
	}
	if !reEVMAddr.MatchString(a.Address) || !reThorSymbol.MatchString(a.Symbol) {
		return ""
	}
	return c.chain + "." + strings.ToUpper(a.Symbol) + "-" + strings.ToUpper(a.Address)
}

func thorSupports(r *QuoteRequest) bool {
	return r.From.DomainID != r.To.DomainID && thorAsset(r.From) != "" && thorAsset(r.To) != ""
}

func pow10(n int) *big.Int { return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil) }

func toThorUnits(amount *big.Int, decimals int) *big.Int {
	if decimals >= thorDecimals {
		return new(big.Int).Quo(amount, pow10(decimals-thorDecimals))
	}
	return new(big.Int).Mul(amount, pow10(thorDecimals-decimals))
}

func fromThorUnits(amount *big.Int, decimals int) *big.Int {
	if decimals >= thorDecimals {
		return new(big.Int).Mul(amount, pow10(decimals-thorDecimals))
	}
	return new(big.Int).Quo(amount, pow10(thorDecimals-decimals))
}

// thorGet tries each THORNode; 5xx/429/network errors fall through to the next one.
func (s *Service) thorGet(ctx context.Context, path string, out *json.RawMessage) error {
	var last error = errCode("network")
	for _, base := range s.cfg.Hosts.Thor {
		err := s.do(ctx, http.MethodGet, base+path, nil, nil, out)
		if err == nil {
			var probe map[string]any
			if json.Unmarshal(*out, &probe) == nil && probe["error"] != nil {
				return classify(400, probe)
			}
			return nil
		}
		last = err
		if e := asErr(err); e.Code != "server" && e.Code != "network" && e.Code != "timeout" {
			return err
		}
	}
	return last
}

type thorQuote struct {
	InboundAddress         string `json:"inbound_address"`
	Router                 string `json:"router"`
	Memo                   string `json:"memo"`
	ExpectedAmountOut      string `json:"expected_amount_out"`
	RecommendedMinAmountIn string `json:"recommended_min_amount_in"`
	Expiry                 any    `json:"expiry"`
	Warning                string `json:"warning"`
	TotalSwapSeconds       any    `json:"total_swap_seconds"`
	OutboundDelaySeconds   any    `json:"outbound_delay_seconds"`
	InboundConfSeconds     any    `json:"inbound_confirmation_seconds"`
	Fees                   struct {
		Total       string `json:"total"`
		SlippageBps any    `json:"slippage_bps"`
	} `json:"fees"`
}

func (s *Service) thorQuoteRaw(ctx context.Context, r *QuoteRequest) (json.RawMessage, *thorQuote, error) {
	from, to := thorAsset(r.From), thorAsset(r.To)
	if from == "" || to == "" {
		return nil, nil, errCode("unsupported_pair")
	}
	amt, _ := new(big.Int).SetString(r.Amount, 10)
	units := toThorUnits(amt, r.From.Decimals)
	if units.Sign() <= 0 {
		return nil, nil, errCode("amount_too_low")
	}
	slip, _ := slippagePct(r.Slippage)
	v := url.Values{"from_asset": {from}, "to_asset": {to}, "amount": {units.String()}, "destination": {r.ToAddress}, "refund_address": {r.FromAddress},
		"streaming_interval": {"1"}, "streaming_quantity": {"0"}, "liquidity_tolerance_bps": {fmt.Sprint(int64(math.Round(slip * 100)))}}
	var raw json.RawMessage
	if err := s.thorGet(ctx, "/thorchain/quote/swap?"+v.Encode(), &raw); err != nil {
		return nil, nil, err
	}
	var q thorQuote
	if json.Unmarshal(raw, &q) != nil || q.InboundAddress == "" || q.Memo == "" || digits(q.ExpectedAmountOut) == "" {
		return nil, nil, errCode("no_liquidity")
	}
	if m := digits(q.RecommendedMinAmountIn); m != "" {
		minIn, _ := new(big.Int).SetString(m, 10)
		if units.Cmp(minIn) < 0 {
			return nil, nil, &Error{Code: "amount_too_low", MinAmount: fromThorUnits(minIn, r.From.Decimals).String()}
		}
	}
	return raw, &q, nil
}

func (s *Service) thorRoutes(ctx context.Context, r *QuoteRequest) ([]Route, error) {
	raw, q, err := s.thorQuoteRaw(ctx, r)
	if err != nil {
		return nil, err
	}
	exp, _ := new(big.Int).SetString(q.ExpectedAmountOut, 10)
	out := fromThorUnits(exp, r.To.Decimals)
	slip, _ := slippagePct(r.Slippage)
	bps := big.NewInt(int64(math.Round(slip * 100)))
	min := new(big.Int).Quo(new(big.Int).Mul(out, new(big.Int).Sub(big.NewInt(10000), bps)), big.NewInt(10000))
	fees := []Fee{}
	if t := digits(q.Fees.Total); t != "" {
		tv, _ := new(big.Int).SetString(t, 10)
		fees = append(fees, Fee{Symbol: r.To.Symbol, Decimals: r.To.Decimals, Amount: fromThorUnits(tv, r.To.Decimals).String(), Name: "THORChain fees", Description: "Liquidity, outbound and network fees"})
	}
	seconds := pos(num(q.TotalSwapSeconds))
	if seconds == nil {
		sum := 0.0
		for _, v := range []any{q.OutboundDelaySeconds, q.InboundConfSeconds} {
			if p := num(v); p != nil {
				sum += *p
			}
		}
		if sum <= 0 {
			sum = 600
		}
		seconds = f64(sum)
	}
	var impact *float64
	if b := num(q.Fees.SlippageBps); b != nil {
		impact = f64(-*b / 100)
	}
	now := s.cfg.Now().UnixMilli()
	step := Step{
		ID: fmt.Sprintf("thorchain-%d", now), Type: "swapAndBridge",
		Provider:     ProviderInfo{ID: THORChain, Name: "THORChain"},
		FromDomainID: r.From.DomainID, ToDomainID: r.To.DomainID,
		From:     Side{Asset: r.From, Amount: r.Amount},
		To:       Side{Asset: r.To, Amount: out.String(), MinAmount: min.String()},
		Slippage: Slippage{UserSelected: f64(slip)}, PriceImpact: impact, ProviderFees: fees, ExecutionSeconds: seconds,
		Raw: mustRaw(map[string]any{"quote": raw, "request": r}),
	}
	if domainByID(r.From.DomainID).Kind == "evm" && r.From.Address != "native" && reEVMAddr.MatchString(q.Router) {
		step.Approval = &Approval{TokenAddress: r.From.Address, Spender: q.Router, MinAmount: r.Amount}
	}
	expires := s.expiry(refreshSeconds)
	if e := num(q.Expiry); e != nil && *e > 0 && int64(*e*1000) < expires {
		expires = int64(*e * 1000)
	}
	var warnings = []Warning{}
	if q.Warning != "" {
		warnings = append(warnings, Warning{Code: "thorchain", Message: cleanText(q.Warning, 200)})
	}
	return []Route{{ID: step.ID, Source: THORChain, ExpiresAt: expires, Steps: []Step{step}, Tags: []string{}, Warnings: warnings, PriceImpact: impact, TotalSeconds: seconds}}, nil
}

// thorStatus: done once the swap is finalised and the outbound signed; a REFUND outbound means the swap failed.
func (s *Service) thorStatus(ctx context.Context, hash string) (*StatusResult, error) {
	h := strings.ToUpper(strings.TrimPrefix(hash, "0x"))
	if !reThorHash.MatchString(h) {
		return nil, errCode("bad_request")
	}
	var raw json.RawMessage
	if err := s.thorGet(ctx, "/thorchain/tx/status/"+h, &raw); err != nil {
		return nil, err
	}
	var st struct {
		OutTxs        []map[string]any `json:"out_txs"`
		PlannedOutTxs []map[string]any `json:"planned_out_txs"`
		Stages        struct {
			InboundObserved *struct {
				Completed  *bool `json:"completed"`
				FinalCount *int  `json:"final_count"`
			} `json:"inbound_observed"`
			SwapFinalised *struct {
				Completed bool `json:"completed"`
			} `json:"swap_finalised"`
			OutboundSigned *struct {
				Completed bool `json:"completed"`
			} `json:"outbound_signed"`
		} `json:"stages"`
	}
	if json.Unmarshal(raw, &st) != nil {
		return nil, errCode("server")
	}
	for _, o := range append(append([]map[string]any{}, st.OutTxs...), st.PlannedOutTxs...) {
		if m, _ := o["memo"].(string); strings.HasPrefix(strings.ToUpper(m), "REFUND") {
			return &StatusResult{Status: "refunded"}, nil
		}
		if rf, _ := o["refund"].(bool); rf {
			return &StatusResult{Status: "refunded"}, nil
		}
	}
	if st.Stages.SwapFinalised != nil && st.Stages.SwapFinalised.Completed {
		signed := len(st.OutTxs) > 0
		if st.Stages.OutboundSigned != nil {
			signed = st.Stages.OutboundSigned.Completed
		}
		if signed {
			return &StatusResult{Status: "success"}, nil
		}
	}
	return &StatusResult{Status: "pending"}, nil
}
