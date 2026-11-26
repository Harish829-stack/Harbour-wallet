package api

// Earn service (/v1/earn): Aave V3 through AaveKit (Aave's official API) and Lido / Rocket Pool APR from their official
// APIs (internal/earnsvc). Fixed queries only; the extension checks every transaction plan against the reviewed action
// (Aave address book, amount, owner), reads balances on-chain, and signs locally. Providers can be switched off with
// EARN_DISABLED_PROVIDERS (aave,lido,rocketpool); Aave chains come from EARN_AAVE_CHAINS (default 84532, Base Sepolia).

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"harbour/backend/internal/earnsvc"
)

func newEarnService(now func() time.Time, log *slog.Logger) *earnsvc.Service {
	var chains map[uint64]bool
	if v := strings.TrimSpace(os.Getenv("EARN_AAVE_CHAINS")); v != "" {
		chains = map[uint64]bool{}
		for _, p := range strings.Split(v, ",") {
			if id, err := strconv.ParseUint(strings.TrimSpace(p), 10, 64); err == nil && id > 0 {
				chains[id] = true
			}
		}
	}
	return earnsvc.New(earnsvc.Config{AaveChains: chains, Disabled: earnsvc.ParseDisabled(os.Getenv("EARN_DISABLED_PROVIDERS")), Now: now, Log: log})
}

func earnErr(w http.ResponseWriter, err error) {
	var e *earnsvc.Error
	if !errors.As(err, &e) {
		e = &earnsvc.Error{Code: "unavailable"}
	}
	status, retry := http.StatusBadGateway, true
	switch e.Code {
	case "bad_request", "unsupported":
		status, retry = http.StatusBadRequest, false
	case "aave_rejected":
		status, retry = http.StatusUnprocessableEntity, false
	case "unavailable":
		status = http.StatusServiceUnavailable
	}
	msg := earnsvc.Messages[e.Reason]
	if msg == "" {
		msg = earnsvc.Messages[e.Code]
	}
	writeJSON(w, status, map[string]any{"error": map[string]any{"code": e.Code, "reason": e.Reason, "message": msg, "retryable": retry}})
}

func (s *Server) handleEarnProviders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"providers": s.earn.ProviderStates()})
}

func (s *Server) handleEarnAaveMarkets(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChainID uint64 `json:"chainId"`
	}
	if !decodeLimited(w, r, 4<<10, &req) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	data, err := s.earn.AaveMarkets(ctx, req.ChainID)
	if err != nil {
		earnErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

func (s *Server) handleEarnAaveTransaction(w http.ResponseWriter, r *http.Request) {
	var req earnsvc.AaveTxRequest
	if !decodeLimited(w, r, 4<<10, &req) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	data, err := s.earn.AaveTransaction(ctx, req)
	if err != nil {
		if e := (*earnsvc.Error)(nil); !errors.As(err, &e) || e.Code != "aave_rejected" {
			s.opt.Log.Info("aave transaction failed", "chain", req.ChainID, "action", req.Action, "err", err)
		}
		earnErr(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

func (s *Server) handleEarnAPR(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("provider")
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	v, err := s.earn.APR(ctx, p)
	if err != nil {
		earnErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"provider": p, "apr": v})
}
