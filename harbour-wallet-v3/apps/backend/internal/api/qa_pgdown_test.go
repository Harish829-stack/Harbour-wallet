package api_test

// QA (resilience): Postgres becomes unavailable while the API is serving an already-authenticated device (its key is in the
// in-process device cache). Every signed route must answer with a JSON error (5xx, retryable) or succeed without the database —
// never panic, hang, or answer 2xx with a partial write — and once Postgres is back, a retried PUT with the same Idempotency-Key
// is executed (the failure was not pinned as the key's answer). TEST_PLAN: T-BE-094 (Postgres-down part).

import (
	"context"
	"crypto/ecdh"
	crand "crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"harbour/backend/internal/hbclient"
)

func qaSetConnections(t *testing.T, db string, allow bool) {
	t.Helper()
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, os.Getenv("HB_TEST_POSTGRES_URL"))
	must(t, err)
	defer conn.Close(ctx)
	_, err = conn.Exec(ctx, "ALTER DATABASE "+pgx.Identifier{db}.Sanitize()+" WITH ALLOW_CONNECTIONS "+map[bool]string{true: "true", false: "false"}[allow])
	must(t, err)
	if !allow {
		_, err = conn.Exec(ctx, "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", db)
		must(t, err)
	}
}

func TestQAPostgresDownEverySignedRoute(t *testing.T) {
	e := qaServer(t, "qa_pgdown", nil, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"0x1"}`))
	})
	c := e.device(t)
	ctx := context.Background()
	own(t, c, "ethereum") // the broadcast below is from a tracked account, so it reaches the database step
	raw, _ := signedTx(t, e, "ethereum", 0)
	ua, _ := ecdh.P256().GenerateKey(crand.Reader)
	b64 := base64.RawURLEncoding.EncodeToString
	pushSub := map[string]any{"endpoint": "https://fcm.googleapis.com/fcm/send/qa", "keys": map[string]string{"p256dh": b64(ua.PublicKey().Bytes()), "auth": b64(make([]byte, 16))}}
	if _, err := c.Do(ctx, http.MethodGet, "/v1/me", nil, nil, nil); err != nil {
		t.Fatal(err) // caches the device in-process
	}
	u, _ := url.Parse(os.Getenv("HB_TEST_POSTGRES_URL"))
	db := u.Path[1:] + "_qa_pgdown"
	qaSetConnections(t, db, false)
	t.Cleanup(func() { qaSetConnections(t, db, true) })

	addrBody := map[string]any{"add": []map[string]string{{"chain": "ethereum", "address": addr(7)}}}
	routes := []struct {
		method, path string
		body         any
		hdr          http.Header
	}{
		{"GET", "/v1/me", nil, nil},
		{"GET", "/v1/me/addresses", nil, nil},
		{"PUT", "/v1/me/addresses", addrBody, http.Header{"Idempotency-Key": {"pgdown-1"}}},
		{"GET", "/v1/me/portfolio", nil, nil},
		{"GET", "/v1/me/portfolio/chart?range=7d", nil, nil},
		{"GET", "/v1/me/history", nil, nil},
		{"GET", "/v1/me/nfts", nil, nil},
		{"GET", "/v1/assets/ethereum/native", nil, nil},
		{"GET", "/v1/assets/ethereum/native/prices", nil, nil},
		{"GET", "/v1/tx/ethereum/0x" + strings.Repeat("ab", 32), nil, nil},
		{"POST", "/v1/tx/ethereum/estimate", map[string]any{"from": addr(7), "to": addr(8), "value": "0x1"}, nil},
		{"POST", "/v1/tx/ethereum/simulate", map[string]any{"from": addr(7), "to": addr(8), "value": "0x1"}, nil},
		{"POST", "/v1/tx/ethereum/broadcast", map[string]any{"raw": raw}, http.Header{"Idempotency-Key": {"pgdown-bc"}}},
		{"POST", "/v1/realtime/token", nil, nil},
		{"PUT", "/v1/me/push", pushSub, nil},
		{"DELETE", "/v1/me/push", nil, nil},
		{"POST", "/v1/rpc/ethereum", map[string]any{"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []any{}}, nil},
	}
	for _, r := range routes {
		cctx, cancel := context.WithTimeout(ctx, 20*time.Second)
		status, err := c.Do(cctx, r.method, r.path, r.body, nil, r.hdr)
		hung := cctx.Err() == context.DeadlineExceeded
		cancel()
		if hung {
			t.Fatalf("%s %s hung with Postgres down", r.method, r.path)
		}
		if err == nil {
			// A route that does not need Postgres may still succeed (the RPC gateway, a Redis-only token).
			if r.method != "GET" && !strings.HasPrefix(r.path, "/v1/rpc/") && r.path != "/v1/realtime/token" {
				t.Errorf("%s %s answered %d with Postgres down (a write cannot have succeeded)", r.method, r.path, status)
			}
			continue
		}
		he, ok := err.(*hbclient.HTTPError)
		if !ok {
			t.Fatalf("%s %s: transport error %v", r.method, r.path, err)
		}
		if he.Status < 500 {
			t.Errorf("%s %s: %d with Postgres down, want 5xx (body %s)", r.method, r.path, he.Status, he.Body)
		}
		var b struct {
			Error struct {
				Code      string `json:"code"`
				Message   string `json:"message"`
				Retryable bool   `json:"retryable"`
			} `json:"error"`
		}
		if json.Unmarshal([]byte(he.Body), &b) != nil || b.Error.Code == "" {
			t.Errorf("%s %s: non-JSON error body %q", r.method, r.path, he.Body)
		}
		if !b.Error.Retryable {
			t.Errorf("%s %s: error not marked retryable: %s", r.method, r.path, he.Body)
		}
		if strings.Contains(strings.ToLower(he.Body), "pgx") || strings.Contains(he.Body, "SQLSTATE") || strings.Contains(he.Body, "connect") {
			t.Errorf("%s %s: database internals leaked: %s", r.method, r.path, he.Body)
		}
	}
	// the process is alive and reports the outage
	resp, err := http.Get(e.hs.URL + "/healthz")
	must(t, err)
	resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		t.Log("healthz reports 200 with Postgres down (liveness only)")
	}

	// Postgres back: the same Idempotency-Key is executed, not replayed as the earlier failure
	qaSetConnections(t, db, true)
	var out struct {
		Addresses []struct{ Address string } `json:"addresses"`
	}
	deadline := time.Now().Add(15 * time.Second)
	for {
		_, err = c.Do(ctx, http.MethodPut, "/v1/me/addresses", addrBody, &out, http.Header{"Idempotency-Key": {"pgdown-1"}})
		if err == nil || time.Now().After(deadline) {
			break
		}
		time.Sleep(300 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("retry after recovery failed: %v", err)
	}
	var list struct {
		Addresses []map[string]any `json:"addresses"`
	}
	_, err = c.Do(ctx, http.MethodGet, "/v1/me/addresses", nil, &list, nil)
	must(t, err)
	if !strings.Contains(strings.ToLower(jsonString(list)), strings.ToLower(addr(7))) {
		t.Fatalf("address not tracked after the retried request: %s", jsonString(list))
	}
}

func jsonString(v any) string { b, _ := json.Marshal(v); return string(b) }
