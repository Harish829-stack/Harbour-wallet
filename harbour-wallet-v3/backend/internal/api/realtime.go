package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"context"

	"harbour/backend/internal/realtime"
	"harbour/backend/internal/store"
)

const realtimeTTL = time.Hour

// ---------- POST /v1/realtime/token ----------

// handleRealtimeToken returns a Centrifugo connection token plus one
// subscription token per channel the device may read: its tracked
// addresses' balances and its pending transactions. Channels are
// server-side only (allow_subscribe_for_client=false), so these tokens are
// the only way in.
func (s *Server) handleRealtimeToken(w http.ResponseWriter, r *http.Request) {
	if len(s.opt.RealtimeSecret) == 0 {
		writeErr(w, http.StatusServiceUnavailable, "unavailable", "Live updates are unavailable right now.", true)
		return
	}
	ctx := r.Context()
	d := deviceFrom(ctx)
	addrs, err := s.opt.Store.DeviceAddresses(ctx, s.opt.LinkCrypto, d.ID)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	pend, err := s.opt.Store.DevicePending(ctx, d.ID)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	now := s.opt.Now()
	type sub struct {
		Channel string `json:"channel"`
		Token   string `json:"token"`
	}
	subs := make([]sub, 0, len(addrs)+len(pend))
	for _, a := range addrs {
		c := realtime.BalanceChannel(a.Chain, a.Address)
		subs = append(subs, sub{c, realtime.SubscriptionToken(s.opt.RealtimeSecret, d.ID, c, now, realtimeTTL)})
	}
	for _, p := range pend {
		c := realtime.TxChannel(p.Chain, p.TxHash)
		subs = append(subs, sub{c, realtime.SubscriptionToken(s.opt.RealtimeSecret, d.ID, c, now, realtimeTTL)})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"url":           s.opt.RealtimeURL,
		"token":         realtime.ConnectionToken(s.opt.RealtimeSecret, d.ID, now, realtimeTTL),
		"expires_at":    now.Add(realtimeTTL).Unix(),
		"subscriptions": subs,
	})
}

// ---------- push ----------

func (s *Server) handleVAPID(w http.ResponseWriter, _ *http.Request) {
	if s.opt.VAPIDPublicKey == "" {
		writeErr(w, http.StatusServiceUnavailable, "unavailable", "Notifications are unavailable right now.", true)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=3600")
	writeJSON(w, http.StatusOK, map[string]string{"public_key": s.opt.VAPIDPublicKey})
}

func b64len(v string) int {
	for _, enc := range []*base64.Encoding{base64.RawURLEncoding, base64.URLEncoding, base64.RawStdEncoding, base64.StdEncoding} {
		if b, err := enc.DecodeString(v); err == nil {
			return len(b)
		}
	}
	return -1
}

func (s *Server) handlePutPush(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	d := deviceFrom(ctx)
	var req struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	u, err := url.Parse(req.Endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || len(req.Endpoint) > 1024 ||
		b64len(req.Keys.P256dh) != 65 || b64len(req.Keys.Auth) != 16 {
		writeErr(w, http.StatusBadRequest, "bad_subscription", "This notification subscription isn't valid.", false)
		return
	}
	tags, err := s.routeTags(ctx, d.ID)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	if err := s.opt.Store.UpsertPushSub(ctx, store.PushSub{DeviceID: d.ID, Channel: "webpush", Endpoint: req.Endpoint,
		P256dh: req.Keys.P256dh, Auth: req.Keys.Auth}, tags); err != nil {
		s.internalErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": true})
}

func (s *Server) handleDeletePush(w http.ResponseWriter, r *http.Request) {
	if err := s.opt.Store.DeletePushSub(r.Context(), deviceFrom(r.Context()).ID); err != nil {
		s.internalErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": false})
}

func (s *Server) routeTags(ctx context.Context, deviceID string) ([][]byte, error) {
	addrs, err := s.opt.Store.DeviceAddresses(ctx, s.opt.LinkCrypto, deviceID)
	if err != nil {
		return nil, err
	}
	tags := make([][]byte, 0, len(addrs))
	for _, a := range addrs {
		tags = append(tags, s.opt.LinkCrypto.RouteTag(a.ID))
	}
	return tags, nil
}

// syncPushRoutes keeps push routes equal to the device's tracked addresses.
func (s *Server) syncPushRoutes(ctx context.Context, deviceID string) {
	on, err := s.opt.Store.HasPushSub(ctx, deviceID)
	if err != nil || !on {
		return
	}
	tags, err := s.routeTags(ctx, deviceID)
	if err == nil {
		err = s.opt.Store.ReplaceRoutes(ctx, deviceID, tags)
	}
	if err != nil {
		s.opt.Log.Warn("push route sync failed", "err", err)
	}
}
