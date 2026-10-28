package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/store"
)

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	d := deviceFrom(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{
		"device_id":  d.ID,
		"quota_tier": d.Tier,
		"quotas":     s.quotas(d.Tier),
		"chains":     s.cfg.ChainNames(),
	})
}

type addressView struct {
	Chain         string `json:"chain"`
	Address       string `json:"address"`
	BackfillState string `json:"backfill_state"`
	Synced        bool   `json:"synced"`
}

func view(t store.TrackedAddress) addressView {
	return addressView{Chain: t.Chain, Address: t.Address, BackfillState: t.BackfillState,
		Synced: t.SyncedTo != nil}
}

func (s *Server) handleListAddresses(w http.ResponseWriter, r *http.Request) {
	d := deviceFrom(r.Context())
	rows, err := s.opt.Store.DeviceAddresses(r.Context(), s.opt.LinkCrypto, d.ID)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	out := make([]addressView, 0, len(rows))
	for _, t := range rows {
		out = append(out, view(t))
	}
	writeJSON(w, http.StatusOK, map[string]any{"addresses": out})
}

type putAddressesReq struct {
	Add    []store.AddressRef `json:"add"`
	Remove []store.AddressRef `json:"remove"`
}

// AddressAddedEvent is published on address.added for the indexer.
type AddressAddedEvent struct {
	TrackedAddressID int64  `json:"tracked_address_id"`
	Chain            string `json:"chain"`
	Address          string `json:"address"`
	DenyBackfill     bool   `json:"deny_backfill"`
}

func (s *Server) handlePutAddresses(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	d := deviceFrom(ctx)
	var req putAddressesReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	if len(req.Add)+len(req.Remove) == 0 || len(req.Add)+len(req.Remove) > 100 {
		writeErr(w, http.StatusBadRequest, "bad_request", "Send between 1 and 100 address changes.", false)
		return
	}
	norm := func(in []store.AddressRef) ([]store.AddressRef, bool) {
		out := make([]store.AddressRef, 0, len(in))
		seen := map[store.AddressRef]bool{}
		for _, a := range in {
			n, err := s.normalizeAddress(a.Chain, a.Address)
			if err != nil {
				writeErr(w, http.StatusBadRequest, "bad_address", "One of the addresses or networks isn't valid.", false)
				return nil, false
			}
			ref := store.AddressRef{Chain: a.Chain, Address: n}
			if !seen[ref] {
				seen[ref] = true
				out = append(out, ref)
			}
		}
		return out, true
	}
	add, ok := norm(req.Add)
	if !ok {
		return
	}
	rem, ok := norm(req.Remove)
	if !ok {
		return
	}
	removed, err := s.opt.Store.RemoveDeviceAddresses(ctx, s.opt.LinkCrypto, d.ID, rem)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	var rows, created []store.TrackedAddress
	if len(add) > 0 {
		// Backfills cost provider budget: cap new ones per device per day.
		n, err := s.opt.Store.CountUntracked(ctx, add, s.deny)
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		if n > 0 {
			ok, err := s.dailyCounter(ctx, "hb:bf:"+d.ID, int64(n), s.tier(d.Tier).BackfillsPerDay)
			if err != nil {
				s.internalErr(w, r, err)
				return
			}
			if !ok {
				writeErr(w, http.StatusTooManyRequests, "backfill_quota", "You've added many new addresses today. Please try again tomorrow.", true)
				return
			}
		}
		rows, created, err = s.opt.Store.AddDeviceAddresses(ctx, s.opt.LinkCrypto, d.ID, add, s.deny, s.tier(d.Tier).MaxAddresses)
		if errors.Is(err, store.ErrQuota) {
			writeErr(w, http.StatusForbidden, "quota_exceeded", "You've reached the maximum number of tracked addresses.", false)
			return
		} else if err != nil {
			s.internalErr(w, r, err)
			return
		}
	}
	for _, t := range created {
		b, _ := json.Marshal(AddressAddedEvent{TrackedAddressID: t.ID, Chain: t.Chain, Address: t.Address, DenyBackfill: t.DenyBackfill})
		if err := s.opt.Events.Publish(ctx, "address.added", b); err != nil {
			s.opt.Log.Warn("publish address.added failed", "err", err)
		}
	}
	out := make([]addressView, 0, len(rows))
	for _, t := range rows {
		out = append(out, view(t))
	}
	writeJSON(w, http.StatusOK, map[string]any{"added": out, "removed": removed})
}

// handleRPC forwards allow-listed read calls to rpc-gateway as user-facing
// (hedging allowed). Never an open proxy.
func (s *Server) handleRPC(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	d := deviceFrom(ctx)
	chainName := chi.URLParam(r, "chain")
	if _, ok := s.cfg.Chains[chainName]; !ok {
		writeErr(w, http.StatusNotFound, "unknown_chain", "This network isn't supported.", false)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	var reqs []rpc.Request
	trimmed := bytes.TrimSpace(body)
	isBatch := len(trimmed) > 0 && trimmed[0] == '['
	if isBatch {
		err = json.Unmarshal(trimmed, &reqs)
	} else {
		var one rpc.Request
		err = json.Unmarshal(trimmed, &one)
		reqs = []rpc.Request{one}
	}
	if err != nil || len(reqs) == 0 || len(reqs) > s.cfg.Gateway.MaxBatch {
		writeJSON(w, http.StatusOK, rpc.NewGatewayError(nil, rpc.CodeBadRequest, "bad_request", "Invalid request", false, nil))
		return
	}
	for _, q := range reqs {
		if !s.rpcAllow[q.Method] {
			writeJSON(w, http.StatusOK, rpc.NewGatewayError(q.ID, rpc.CodeMethodNotAllowed, "method_not_allowed",
				"Method not available", false, nil))
			return
		}
	}
	ok, err := s.counter(ctx, "hb:rlrpc:"+d.ID, int64(len(reqs)), s.tier(d.Tier).RPCPerMinute)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	if !ok {
		w.Header().Set("Retry-After", "60")
		writeJSON(w, http.StatusTooManyRequests, rpc.NewGatewayError(reqs[0].ID, rpc.CodeRateLimited, "rate_limited",
			"Network busy, retrying", true, nil))
		return
	}
	greq, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(s.opt.GatewayURL, "/")+"/rpc/"+chainName, bytes.NewReader(trimmed))
	greq.Header.Set("Content-Type", "application/json")
	greq.Header.Set("X-HB-Priority", "user")
	if sess := r.Header.Get("X-HB-Session"); sess != "" && len(sess) <= 64 {
		greq.Header.Set("X-HB-Session", d.ID+":"+sess)
	}
	if s.opt.GatewayToken != "" {
		greq.Header.Set("Authorization", "Bearer "+s.opt.GatewayToken)
	}
	resp, err := s.http.Do(greq)
	if err != nil {
		s.opt.Log.Warn("rpc-gateway unreachable", "err", err)
		writeJSON(w, http.StatusOK, rpc.NewGatewayError(reqs[0].ID, rpc.CodeUpstreamsUnavailable, "gateway_unavailable",
			"Network busy, retrying", true, nil))
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
