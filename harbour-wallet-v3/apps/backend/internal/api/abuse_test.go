package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

// abuseServer starts an API on a fresh database for the abuse-limit tests (2026-11-16 audit). Needs HB_TEST_POSTGRES_URL and
// HB_TEST_REDIS_URL (make test-integration); skipped otherwise.
func abuseServer(t *testing.T, name string, tune func(*config.Config)) (*httptest.Server, *redis.Client) {
	t.Helper()
	if os.Getenv("HB_TEST_POSTGRES_URL") == "" || os.Getenv("HB_TEST_REDIS_URL") == "" {
		t.Skip("HB_TEST_POSTGRES_URL / HB_TEST_REDIS_URL not set")
	}
	ctx := context.Background()
	st, err := store.Open(ctx, testdb.URL(t, name))
	must(t, err)
	t.Cleanup(st.Close)
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.MaintainPartitions(ctx))
	ropt, _ := redis.ParseURL(os.Getenv("HB_TEST_REDIS_URL"))
	rdb := redis.NewClient(ropt)
	must(t, rdb.FlushDB(ctx).Err())
	cfg, err := config.Load("../../config")
	must(t, err)
	cfg.API.ProbationTier = ""
	if tune != nil {
		tune(cfg)
	}
	fams := map[string]string{}
	for n, c := range cfg.Chains {
		fams[n] = c.Family
	}
	must(t, st.UpsertChains(ctx, fams))
	lc, err := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	must(t, err)
	gw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x10"}`)
	}))
	t.Cleanup(gw.Close)
	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc,
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)), GatewayURL: gw.URL, PowDifficulty: 8})
	hs := httptest.NewServer(srv.Handler())
	t.Cleanup(hs.Close)
	return hs, rdb
}

// Finding 22: the hourly ceiling on new devices was charged per challenge, which costs the caller nothing. A few dozen addresses
// asking for challenges could use it up and lock every new install out. It is now charged per completed registration.
func TestRegistrationCeilingNeedsProofOfWork(t *testing.T) {
	hs, _ := abuseServer(t, "abuse_reg", func(c *config.Config) {
		c.API.RegistrationsPerHour = 2
		c.API.ChallengesPerHour = 1000
	})
	ctx := context.Background()
	for i := 0; i < 10; i++ { // free challenges, never solved
		resp, err := http.Post(hs.URL+"/v1/devices/challenge", "application/json", nil)
		must(t, err)
		resp.Body.Close()
		wantStatus(t, resp.StatusCode, 200)
	}
	for i := 0; i < 2; i++ { // real installs still get in
		if _, err := hbclient.New(hs.URL).Register(ctx); err != nil {
			t.Fatalf("registration %d refused after unsolved challenges: %v", i+1, err)
		}
	}
	// The ceiling itself still holds for completed registrations.
	if _, err := hbclient.New(hs.URL).Register(ctx); err == nil || !strings.Contains(err.Error(), "busy") {
		t.Fatalf("third registration in the hour should hit the ceiling, got %v", err)
	}
}

// Finding 23 (was 12): requests naming unknown devices, or carrying wrong signatures, cost a database lookup each and had no limit.
// One address now gets 30 such failures a minute; further requests for devices the server has not seen are refused before any
// lookup. A device that has already authenticated keeps working from the same address.
func TestFailedAuthIsLimitedPerClient(t *testing.T) {
	hs, _ := abuseServer(t, "abuse_auth", nil)
	ctx := context.Background()
	good := hbclient.New(hs.URL)
	_, err := good.Register(ctx)
	must(t, err)
	wantStatus(t, status(good.Do(ctx, "GET", "/v1/me", nil, nil, nil)), 200)
	late := hbclient.New(hs.URL) // registered, but not seen by the server before the flood
	_, err = late.Register(ctx)
	must(t, err)
	ghost := hbclient.New(hs.URL)
	for i := 0; i < 30; i++ {
		ghost.DeviceID = fmt.Sprintf("00000000-0000-4000-8000-%012d", i)
		wantStatus(t, status(ghost.Do(ctx, "GET", "/v1/me", nil, nil, nil)), 401)
	}
	ghost.DeviceID = "00000000-0000-4000-8000-999999999999"
	wantStatus(t, status(ghost.Do(ctx, "GET", "/v1/me", nil, nil, nil)), 429) // refused before any lookup
	wantStatus(t, status(good.Do(ctx, "GET", "/v1/me", nil, nil, nil)), 200)  // an already-seen device is not affected
	wantStatus(t, status(late.Do(ctx, "GET", "/v1/me", nil, nil, nil)), 429)  // an unseen one waits for the next minute
}

// Finding 24: the estimate / simulate / broadcast counters were the only Redis keys that carried the raw device id.
func TestSendCountersDoNotStoreDeviceIDs(t *testing.T) {
	hs, rdb := abuseServer(t, "abuse_keys", nil)
	ctx := context.Background()
	c := hbclient.New(hs.URL)
	_, err := c.Register(ctx)
	must(t, err)
	const addr = "0x1111111111111111111111111111111111111111"
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": addr}}}, nil, nil)
	must(t, err)
	c.Do(ctx, "POST", "/v1/tx/base/estimate", map[string]string{"from": addr, "to": addr, "value": "1"}, nil, nil) //nolint:errcheck
	c.Do(ctx, "POST", "/v1/tx/base/simulate", map[string]string{"from": addr, "to": addr, "value": "1"}, nil, nil) //nolint:errcheck
	keys, err := rdb.Keys(ctx, "*").Result()
	must(t, err)
	var sendKeys int
	for _, k := range keys {
		if strings.Contains(k, c.DeviceID) {
			t.Errorf("Redis key carries the raw device id: %s", strings.ReplaceAll(k, c.DeviceID, "<device id>"))
		}
		if strings.HasPrefix(k, "hb:rlest:") || strings.HasPrefix(k, "hb:rlsim:") {
			sendKeys++
		}
	}
	if sendKeys != 2 {
		t.Fatalf("expected the estimate and simulate counters, found %d of them in %d keys", sendKeys, len(keys))
	}
}
