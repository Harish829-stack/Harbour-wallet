package api_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/store"
)

// Phase 1 exit test: a device registers with proof-of-work and makes signed
// calls; replays, forgeries, quota and allow-list are enforced.
// Needs HB_TEST_POSTGRES_URL and HB_TEST_REDIS_URL (make test-integration).
func TestDeviceFlow(t *testing.T) {
	pgURL, rURL := os.Getenv("HB_TEST_POSTGRES_URL"), os.Getenv("HB_TEST_REDIS_URL")
	if pgURL == "" || rURL == "" {
		t.Skip("HB_TEST_POSTGRES_URL / HB_TEST_REDIS_URL not set")
	}
	ctx := context.Background()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
	must(t, err)
	_, err = st.Migrate(ctx)
	must(t, err)
	// Migrations are idempotent across restarts.
	applied, err := st.Migrate(ctx)
	must(t, err)
	if len(applied) != 0 {
		t.Fatalf("re-applied %v", applied)
	}
	must(t, st.MaintainPartitions(ctx))

	ropt, _ := redis.ParseURL(rURL)
	rdb := redis.NewClient(ropt)
	must(t, rdb.FlushDB(ctx).Err())

	cfg, err := config.Load("../../config")
	must(t, err)
	tier := cfg.API.Tiers["default"]
	tier.MaxAddresses = 2
	cfg.API.Tiers["default"] = tier
	fams := map[string]string{}
	for n, c := range cfg.Chains {
		fams[n] = c.Family
	}
	must(t, st.UpsertChains(ctx, fams))
	lc, err := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	must(t, err)

	var gwHits int
	gw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gwHits++
		if r.Header.Get("X-HB-Priority") != "user" || r.URL.Path != "/rpc/base" {
			t.Errorf("gateway got %s priority=%q", r.URL.Path, r.Header.Get("X-HB-Priority"))
		}
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x10"}`)
	}))
	defer gw.Close()

	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc,
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)), GatewayURL: gw.URL, PowDifficulty: 8})
	hs := httptest.NewServer(srv.Handler())
	defer hs.Close()

	c := hbclient.New(hs.URL)
	reg, err := c.Register(ctx)
	must(t, err)
	if c.DeviceID == "" || reg["quota_tier"] != "default" {
		t.Fatalf("register: %v", reg)
	}

	// Signed call.
	var me map[string]any
	_, err = c.Do(ctx, "GET", "/v1/me", nil, &me, nil)
	must(t, err)
	if me["device_id"] != c.DeviceID {
		t.Fatalf("me: %v", me)
	}

	// Forged: another key claiming this device id.
	evil := hbclient.New(hs.URL)
	evil.DeviceID = c.DeviceID
	wantStatus(t, status(evil.Do(ctx, "GET", "/v1/me", nil, nil, nil)), 401)

	// Stale clock.
	old := *c
	old.Now = func() time.Time { return time.Now().Add(-time.Hour) }
	wantStatus(t, status(old.Do(ctx, "GET", "/v1/me", nil, nil, nil)), 401)

	// Addresses + quota (max 2).
	var put map[string]any
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{
		{"chain": "base", "address": "0x1111111111111111111111111111111111111111"},
		{"chain": "ethereum", "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}, // deny-listed
	}}, &put, http.Header{"Idempotency-Key": {"k1"}})
	must(t, err)
	added := put["added"].([]any)
	if len(added) != 2 || added[1].(map[string]any)["backfill_state"] != "skipped" {
		t.Fatalf("put: %v", put)
	}
	// Idempotent replay returns the same body without re-running.
	var again map[string]any
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{
		{"chain": "base", "address": "0x1111111111111111111111111111111111111111"},
		{"chain": "ethereum", "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"},
	}}, &again, http.Header{"Idempotency-Key": {"k1"}})
	must(t, err)
	if len(again["added"].([]any)) != 2 {
		t.Fatalf("replay: %v", again)
	}
	wantStatus(t, status(c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{
		{"chain": "base", "address": "0x2222222222222222222222222222222222222222"}}}, nil, nil)), 403)
	wantStatus(t, status(c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{
		{"chain": "base", "address": "nope"}}}, nil, nil)), 400)

	var list struct {
		Addresses []map[string]any `json:"addresses"`
	}
	_, err = c.Do(ctx, "GET", "/v1/me/addresses", nil, &list, nil)
	must(t, err)
	if len(list.Addresses) != 2 {
		t.Fatalf("list: %v", list)
	}
	// The link table holds no plaintext address id.
	var plain int
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM device_addresses d JOIN tracked_addresses t ON position(int8send(t.id) in d.enc_tracked_ref) > 0`).Scan(&plain))
	if plain != 0 {
		t.Fatal("device_addresses leaks tracked ids")
	}
	// A second device tracking the same address shares the tracked row.
	c2 := hbclient.New(hs.URL)
	_, err = c2.Register(ctx)
	must(t, err)
	_, err = c2.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{
		{"chain": "base", "address": "0x1111111111111111111111111111111111111111"}}}, nil, nil)
	must(t, err)
	var n int
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM tracked_addresses`).Scan(&n))
	if n != 2 {
		t.Fatalf("tracked rows = %d", n)
	}
	// Remove.
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"remove": []map[string]string{
		{"chain": "base", "address": "0x1111111111111111111111111111111111111111"}}}, &put, nil)
	must(t, err)
	if put["removed"].(float64) != 1 {
		t.Fatalf("remove: %v", put)
	}

	// RPC allow-list and forwarding.
	var rr map[string]any
	_, err = c.Do(ctx, "POST", "/v1/rpc/base", []byte(`{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}`), &rr, nil)
	must(t, err)
	if rr["result"] != "0x10" || gwHits != 1 {
		t.Fatalf("rpc: %v hits=%d", rr, gwHits)
	}
	_, err = c.Do(ctx, "POST", "/v1/rpc/base", []byte(`{"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":["0x00"]}`), &rr, nil)
	must(t, err)
	if rr["error"] == nil || gwHits != 1 {
		t.Fatalf("write method passed allow-list: %v", rr)
	}
	wantStatus(t, status(c.Do(ctx, "POST", "/v1/rpc/solana", []byte(`{}`), nil, nil)), 404)

	// Challenge single use: registering again with the same public key is refused.
	c3 := *c
	_, err = c3.Register(ctx)
	var he *hbclient.HTTPError
	if !errors.As(err, &he) || he.Status != 409 {
		t.Fatalf("duplicate key: %v", err)
	}
}

// TestReplayRejected sends the exact same signed request twice.
func TestReplayRejected(t *testing.T) {
	pgURL, rURL := os.Getenv("HB_TEST_POSTGRES_URL"), os.Getenv("HB_TEST_REDIS_URL")
	if pgURL == "" || rURL == "" {
		t.Skip("integration env not set")
	}
	ctx := context.Background()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	ropt, _ := redis.ParseURL(rURL)
	rdb := redis.NewClient(ropt)
	cfg, err := config.Load("../../config")
	must(t, err)
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc,
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)), PowDifficulty: 4})
	hs := httptest.NewServer(srv.Handler())
	defer hs.Close()
	c := hbclient.New(hs.URL)
	_, err = c.Register(ctx)
	must(t, err)

	// Capture one signed request and send it twice.
	var captured *http.Request
	c.HTTP = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		captured = r.Clone(r.Context())
		return http.DefaultTransport.RoundTrip(r)
	})}
	_, err = c.Do(ctx, "GET", "/v1/me", nil, nil, nil)
	must(t, err)
	req2, _ := http.NewRequest("GET", captured.URL.String(), nil)
	req2.Header = captured.Header.Clone()
	resp, err := http.DefaultClient.Do(req2)
	must(t, err)
	resp.Body.Close()
	if resp.StatusCode != 401 {
		t.Fatalf("replay status %d", resp.StatusCode)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func status(code int, _ error) int { return code }

func wantStatus(t *testing.T, got, want int) {
	t.Helper()
	if got != want {
		t.Fatalf("status %d want %d", got, want)
	}
}
