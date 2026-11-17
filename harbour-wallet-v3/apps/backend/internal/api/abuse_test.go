package api_test

import (
	"context"
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
