package gateway

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"harbour/backend/internal/core/rpc"
)

// Handler exposes the gateway over HTTP (private network only):
//
//	POST /rpc/{chain}  JSON-RPC, single or batch
//	   X-HB-Priority: user   allows hedging
//	   X-HB-Session: <id>    pins a call sequence to one upstream
//	GET  /status /metrics /healthz
func (g *Gateway) Handler(token string) http.Handler {
	r := chi.NewRouter()
	auth := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, req *http.Request) {
			if token != "" && subtle.ConstantTimeCompare([]byte(req.Header.Get("Authorization")), []byte("Bearer "+token)) != 1 {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			next(w, req)
		}
	}
	r.Post("/rpc/{chain}", auth(g.serveRPC))
	r.Get("/status", auth(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(g.Status())
	}))
	r.Get("/metrics", auth(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		g.WriteMetrics(w)
	}))
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		ok, down := g.Healthy()
		w.Header().Set("Content-Type", "application/json")
		if !ok {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": ok, "chains_down": down})
	})
	return r
}

func (g *Gateway) serveRPC(w http.ResponseWriter, r *http.Request) {
	chain := chi.URLParam(r, "chain")
	opt := CallOptions{UserFacing: r.Header.Get("X-HB-Priority") == "user", Session: r.Header.Get("X-HB-Session")}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8<<20))
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	if err != nil {
		enc.Encode(rpc.NewGatewayError(nil, rpc.CodeBadRequest, "bad_request", "Invalid request", false, nil))
		return
	}
	body = bytes.TrimSpace(body)
	if len(body) > 0 && body[0] == '[' {
		var reqs []rpc.Request
		if err := json.Unmarshal(body, &reqs); err != nil || len(reqs) == 0 || len(reqs) > g.cfg.Gateway.MaxBatch {
			enc.Encode(rpc.NewGatewayError(nil, rpc.CodeBadRequest, "bad_request", "Invalid batch", false, nil))
			return
		}
		enc.Encode(g.HandleBatch(r.Context(), chain, reqs, opt))
		return
	}
	var req rpc.Request
	if err := json.Unmarshal(body, &req); err != nil {
		enc.Encode(rpc.NewGatewayError(nil, rpc.CodeBadRequest, "bad_request", "Invalid request", false, nil))
		return
	}
	enc.Encode(g.Handle(r.Context(), chain, &req, opt))
}
