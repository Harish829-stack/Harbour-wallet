package api

// Swap service (/v1/swap): quotes from several providers through their official APIs (internal/swapsvc), fresh unsigned
// transactions for a confirmed route, and settlement status. The backend holds the provider keys and can switch any
// provider off (SWAP_DISABLED_PROVIDERS=relay,thorchain) without an extension release. It never signs: the extension
// checks every transaction against the confirmed quote, simulates it, and signs locally.

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"harbour/backend/internal/swapsvc"
)

const (
	swapQuoteTimeout = 25 * time.Second
	swapTxMaxBody    = 512 << 10 // a LI.FI step object can be large
	swapMaxBody      = 64 << 10
)

// newSwapService builds the swap service from the gateway's keys and hosts.
func newSwapService(keys GatewayKeys, hosts GatewayHosts, now func() time.Time, log *slog.Logger) *swapsvc.Service {
	thor := []string{hosts.Thor}
	if hosts.Thor == DefaultGatewayHosts().Thor {
		thor = append(thor, "https://thornode.ninerealms.com") // second public THORNode, used when the first is down
	}
	return swapsvc.New(swapsvc.Config{
		Keys:     swapsvc.Keys{LiFi: keys.LiFi, Jupiter: keys.Jupiter, Relay: keys.Relay, Uniswap: keys.Uniswap},
		Hosts:    swapsvc.Hosts{LiFi: hosts.LiFi, Jupiter: hosts.Jupiter, Relay: hosts.Relay, Uniswap: hosts.Uniswap, Thor: thor},
		Disabled: swapsvc.ParseDisabled(os.Getenv("SWAP_DISABLED_PROVIDERS")),
		Now:      now,
		Log:      log,
	})
}

// swapErr writes a swap error. Request mistakes are 400, "no route / amount" answers 422, provider outages 502-504.
func swapErr(w http.ResponseWriter, err error) {
	var e *swapsvc.Error
	if !errors.As(err, &e) {
		e = &swapsvc.Error{Code: "network"}
	}
	status, retry := http.StatusBadGateway, true
	switch e.Code {
	case "bad_request", "invalid_amount", "invalid_asset", "invalid_slippage", "unsupported_domain", "unsupported_pair":
		status, retry = http.StatusBadRequest, false
	case "no_liquidity", "amount_too_low", "amount_too_high":
		status, retry = http.StatusUnprocessableEntity, false
	case "unavailable", "rate_limited":
		status = http.StatusServiceUnavailable
	case "price_moved":
		status, retry = http.StatusConflict, false
	case "timeout":
		status = http.StatusGatewayTimeout
	}
	msg := swapsvc.Messages[e.Code]
	if msg == "" {
		msg = swapsvc.Messages["network"]
	}
	writeJSON(w, status, map[string]any{"error": map[string]any{"code": e.Code, "message": msg, "retryable": retry, "minAmount": e.MinAmount}})
}

func decodeLimited(w http.ResponseWriter, r *http.Request, limit int64, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return false
	}
	return true
}

func (s *Server) handleSwapProviders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"providers": s.swap.ProviderStates()})
}

func (s *Server) handleSwapQuotes(w http.ResponseWriter, r *http.Request) {
	var req swapsvc.QuoteRequest
	if !decodeLimited(w, r, swapMaxBody, &req) {
		return
	}
	// One quote request fans out to several providers: charge the device's rate limit per provider asked (audit M6;
	// the middleware already counted one).
	if n := s.swap.ProviderCount(&req); n > 1 {
		d := deviceFrom(r.Context())
		ok, err := s.counter(r.Context(), "hb:rl:"+s.devTag(d.ID), int64(n-1), s.tier(d.Tier).RequestsPerMinute)
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		if !ok {
			w.Header().Set("Retry-After", "60")
			writeErr(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Please wait a moment.", true)
			return
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), swapQuoteTimeout)
	defer cancel()
	res, err := s.swap.Quotes(ctx, req)
	if err != nil {
		s.opt.Log.Info("swap quote failed", "from", req.From.DomainID, "to", req.To.DomainID, "err", err)
		swapErr(w, err)
		return
	}
	if len(res.ProviderErrors) > 0 {
		s.opt.Log.Info("swap providers failed", "from", req.From.DomainID, "to", req.To.DomainID, "failed", res.ProviderErrors)
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleSwapTransaction(w http.ResponseWriter, r *http.Request) {
	var req swapsvc.TxRequest
	if !decodeLimited(w, r, swapTxMaxBody, &req) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), swapQuoteTimeout)
	defer cancel()
	raw, err := s.swap.Transaction(ctx, req)
	if err != nil {
		s.opt.Log.Info("swap transaction failed", "source", req.Source, "err", err)
		swapErr(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	w.Write(raw)
}

func (s *Server) handleSwapStatus(w http.ResponseWriter, r *http.Request) {
	var req swapsvc.StatusRequest
	if !decodeLimited(w, r, swapMaxBody, &req) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), swapQuoteTimeout)
	defer cancel()
	res, err := s.swap.Status(ctx, req)
	if err != nil {
		swapErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleSwapToken(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	q := r.URL.Query()
	tok, err := s.swap.Token(ctx, q.Get("domain"), q.Get("q"))
	if err != nil {
		swapErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tok)
}

func (s *Server) handleSwapUniswap(w http.ResponseWriter, r *http.Request) {
	var req swapsvc.UniswapRequest
	if !decodeLimited(w, r, swapMaxBody, &req) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), swapQuoteTimeout)
	defer cancel()
	res, err := s.swap.UniswapPrepare(ctx, req)
	if err != nil {
		s.opt.Log.Info("uniswap prepare failed", "chain", req.ChainID, "err", err)
		swapErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}
