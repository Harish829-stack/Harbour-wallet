package swapsvc

// Uniswap API (https://developers.uniswap.org/docs/trading/swapping-api), official REST API, for the testnet swap screen
// (Ethereum Sepolia by default). The backend calls quote -> check_approval -> swap and returns Uniswap's answers; the
// extension checks the approval spender, the router target, the calldata and the minimum output before signing, and
// approves only the exact input amount. Permit2 is disabled (x-permit2-disabled) so no off-chain permit is ever signed.

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

// UniswapRequest is an exact-input swap request.
type UniswapRequest struct {
	ChainID     uint64 `json:"chainId"`
	TokenIn     string `json:"tokenIn"`  // 0x000…0 = the chain's coin
	TokenOut    string `json:"tokenOut"` // 0x000…0 = the chain's coin
	Amount      string `json:"amount"`
	Swapper     string `json:"swapper"`
	SlippageBps int    `json:"slippageBps"`
	Deadline    int64  `json:"deadline"` // unix seconds
}

// UniswapPrepared holds Uniswap's own answers, unchanged.
type UniswapPrepared struct {
	Routing                   string          `json:"routing"`
	Quote                     json.RawMessage `json:"quote"`
	IsTokenApprovalApplicable *bool           `json:"isTokenApprovalApplicable,omitempty"`
	Approval                  json.RawMessage `json:"approval,omitempty"`
	Cancel                    json.RawMessage `json:"cancel,omitempty"`
	Swap                      json.RawMessage `json:"swap"`
}

func (s *Service) uniswapHeaders() map[string]string {
	return map[string]string{"x-api-key": s.cfg.Keys.Uniswap, "x-universal-router-version": "2.1.2", "x-permit2-disabled": "true"}
}

func (r *UniswapRequest) validate(chains map[uint64]bool, now time.Time) error {
	if !chains[r.ChainID] {
		return errCode("unsupported_domain")
	}
	if !reEVMAddr.MatchString(r.TokenIn) || !reEVMAddr.MatchString(r.TokenOut) || strings.EqualFold(r.TokenIn, r.TokenOut) || !reEVMAddr.MatchString(r.Swapper) {
		return errCode("invalid_asset")
	}
	if !reAmount.MatchString(r.Amount) {
		return errCode("invalid_amount")
	}
	if r.SlippageBps < 1 || r.SlippageBps > 500 {
		return errCode("invalid_slippage")
	}
	if r.Deadline <= now.Unix() || r.Deadline > now.Add(time.Hour).Unix() {
		return errCode("bad_request")
	}
	return nil
}

// UniswapPrepare runs quote -> check_approval (token input) -> swap.
func (s *Service) UniswapPrepare(ctx context.Context, r UniswapRequest) (*UniswapPrepared, error) {
	if !s.Enabled(Uniswap) {
		return nil, errCode("unavailable")
	}
	if err := r.validate(s.cfg.UniswapChains, s.cfg.Now()); err != nil {
		return nil, err
	}
	h := s.uniswapHeaders()
	base := s.cfg.Hosts.Uniswap
	var qr struct {
		Routing                   string          `json:"routing"`
		Quote                     json.RawMessage `json:"quote"`
		IsTokenApprovalApplicable *bool           `json:"isTokenApprovalApplicable"`
	}
	quoteBody := map[string]any{"type": "EXACT_INPUT", "amount": r.Amount, "tokenInChainId": r.ChainID, "tokenOutChainId": r.ChainID,
		"tokenIn": r.TokenIn, "tokenOut": r.TokenOut, "swapper": r.Swapper, "slippageTolerance": float64(r.SlippageBps) / 100,
		"routingPreference": "BEST_PRICE", "permitAmount": "EXACT"}
	if err := s.do(ctx, http.MethodPost, base+"/quote", h, quoteBody, &qr); err != nil {
		return nil, err
	}
	switch qr.Routing {
	case "CLASSIC", "WRAP", "UNWRAP":
	default:
		return nil, errCode("unsupported_pair") // UniswapX / bridge routes are not executable here
	}
	if len(qr.Quote) < 2 || qr.Quote[0] != '{' {
		return nil, errCode("server")
	}
	out := &UniswapPrepared{Routing: qr.Routing, Quote: qr.Quote, IsTokenApprovalApplicable: qr.IsTokenApprovalApplicable}
	if !strings.EqualFold(r.TokenIn, evmNative) && (qr.IsTokenApprovalApplicable == nil || *qr.IsTokenApprovalApplicable) {
		var ar struct {
			Approval json.RawMessage `json:"approval"`
			Cancel   json.RawMessage `json:"cancel"`
		}
		body := map[string]any{"walletAddress": r.Swapper, "amount": r.Amount, "token": r.TokenIn, "chainId": r.ChainID, "tokenOut": r.TokenOut, "tokenOutChainId": r.ChainID}
		if err := s.do(ctx, http.MethodPost, base+"/check_approval", h, body, &ar); err != nil {
			return nil, err
		}
		out.Approval, out.Cancel = nullToNil(ar.Approval), nullToNil(ar.Cancel)
	}
	var sr struct {
		Swap            json.RawMessage `json:"swap"`
		SwapTransaction json.RawMessage `json:"swapTransaction"`
	}
	if err := s.do(ctx, http.MethodPost, base+"/swap", h, map[string]any{"quote": qr.Quote, "deadline": r.Deadline}, &sr); err != nil {
		return nil, err
	}
	out.Swap = nullToNil(sr.Swap)
	if out.Swap == nil {
		out.Swap = nullToNil(sr.SwapTransaction)
	}
	if out.Swap == nil {
		return nil, errCode("server")
	}
	return out, nil
}

func nullToNil(r json.RawMessage) json.RawMessage {
	if len(r) == 0 || string(r) == "null" {
		return nil
	}
	return r
}
