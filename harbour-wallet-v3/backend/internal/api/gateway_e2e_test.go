package api_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

// End to end (audit A1 + A2): a really registered device, real signed HTTP requests through the whole API stack, a fake upstream that
// records exactly what the provider would have received. Needs HB_TEST_POSTGRES_URL / HB_TEST_REDIS_URL (make test-integration).
func TestGatewayRPCCannotBeSteeredPastTheAllowlist(t *testing.T) {
	pgURL, rURL := os.Getenv("HB_TEST_POSTGRES_URL"), os.Getenv("HB_TEST_REDIS_URL")
	if pgURL == "" || rURL == "" {
		t.Skip("HB_TEST_POSTGRES_URL / HB_TEST_REDIS_URL not set")
	}
	pgURL = testdb.URL(t, "gw_e2e")
	ctx := context.Background()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.MaintainPartitions(ctx))
	ropt, _ := redis.ParseURL(rURL)
	rdb := redis.NewClient(ropt)
	must(t, rdb.FlushDB(ctx).Err())
	cfg, err := config.Load("../../config")
	must(t, err)
	cfg.API.ProbationTier = ""
	fams := map[string]string{}
	for n, c := range cfg.Chains {
		fams[n] = c.Family
	}
	must(t, st.UpsertChains(ctx, fams))
	lc, err := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	must(t, err)

	var mu sync.Mutex
	type hit struct{ path, body string }
	var hits []hit
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		hits = append(hits, hit{r.URL.Path, string(b)})
		mu.Unlock()
		_, _ = io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x1"}`)
	}))
	defer up.Close()
	hosts := api.DefaultGatewayHosts()
	hosts.Alchemy, hosts.Helius, hosts.Pimlico = up.URL+"/alch/%s", up.URL+"/helius", up.URL+"/pim"
	keys := api.GatewayKeys{Alchemy: "alchemy-secret", Helius: "helius-secret", Pimlico: "pimlico-secret"}

	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc, Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		GatewayURL: "http://127.0.0.1:1", PowDifficulty: 8, GatewayKeys: &keys, GatewayHosts: &hosts})
	hs := httptest.NewServer(srv.Handler())
	defer hs.Close()
	c := hbclient.New(hs.URL)
	_, err = c.Register(ctx)
	must(t, err)

	count := func() int { mu.Lock(); defer mu.Unlock(); return len(hits) }
	post := func(path, body string) int {
		code, err := c.Do(ctx, "POST", path, []byte(body), nil, http.Header{"Content-Type": {"application/json"}})
		if err != nil && code == 0 {
			t.Fatalf("%s: %v", path, err)
		}
		return code
	}
	logs := func(f string) string { return `{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[` + f + `]}` }

	refused := map[string]struct {
		path, body string
		want       int
	}{
		"A1 alchemy: Method shadows method":       {"/v1/gw/alchemy/1/rpc", `{"jsonrpc":"2.0","id":1,"method":"web3_clientVersion","Method":"eth_chainId"}`, 400},
		"A1 alchemy: Method first":                {"/v1/gw/alchemy/1/rpc", `{"Method":"eth_chainId","method":"debug_traceTransaction"}`, 400},
		"A1 alchemy: duplicate method":            {"/v1/gw/alchemy/1/rpc", `{"method":"eth_chainId","method":"debug_traceTransaction"}`, 400},
		"A1 alchemy: batch member":                {"/v1/gw/alchemy/1/rpc", `[{"method":"eth_chainId"},{"method":"debug_x","Method":"eth_chainId"}]`, 400},
		"A1 alchemy: trailing value":              {"/v1/gw/alchemy/1/rpc", `{"method":"eth_chainId"} {"method":"debug_x"}`, 400},
		"A1 alchemy: method not on the list":      {"/v1/gw/alchemy/1/rpc", `{"jsonrpc":"2.0","id":1,"method":"debug_traceTransaction","params":[]}`, 403},
		"A1 helius: Method shadows method":        {"/v1/gw/helius/rpc", `{"jsonrpc":"2.0","id":1,"method":"requestAirdrop","Method":"getHealth"}`, 400},
		"A1 pimlico: Method shadows method":       {"/v1/gw/pimlico/1", `{"jsonrpc":"2.0","id":1,"method":"pm_x","Method":"eth_supportedEntryPoints"}`, 400},
		"A2 alchemy: raw broadcast":               {"/v1/gw/alchemy/1/rpc", `{"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":["0x02"]}`, 403},
		"A2 alchemy: getLogs with no filter":      {"/v1/gw/alchemy/1/rpc", logs(`{"fromBlock":"0x10","toBlock":"0x20"}`), 403},
		"A2 alchemy: getLogs range too wide":      {"/v1/gw/alchemy/1/rpc", logs(`{"address":"0x28c6c06298d514db089934071355e5743bf21d60","fromBlock":"0x1","toBlock":"0x186a0"}`), 403},
		"A2 alchemy: getLogs open-ended 'latest'": {"/v1/gw/alchemy/1/rpc", logs(`{"address":"0x28c6c06298d514db089934071355e5743bf21d60","fromBlock":"0x1","toBlock":"latest"}`), 403},
	}
	for name, tc := range refused {
		if got := post(tc.path, tc.body); got != tc.want {
			t.Errorf("%s: status %d, want %d", name, got, tc.want)
		}
	}
	if n := count(); n != 0 {
		t.Fatalf("the upstream provider received %d refused request(s): %v", n, hits)
	}

	// Control: a normal request still works, and the provider receives exactly the validated body, on the key path, nothing else.
	if got := post("/v1/gw/alchemy/1/rpc", ` { "jsonrpc":"2.0", "id":3, "method":"eth_blockNumber", "params":[] } `); got != 200 {
		t.Fatalf("valid request: status %d", got)
	}
	if got := post("/v1/gw/alchemy/1/rpc", logs(`{"address":"0x28c6c06298d514db089934071355e5743bf21d60","fromBlock":"0x10","toBlock":"0x20"}`)); got != 200 {
		t.Fatalf("filtered, bounded getLogs: status %d", got)
	}
	if count() != 2 {
		t.Fatalf("upstream hits = %d, want 2", count())
	}
	if hits[0].path != "/alch/eth-mainnet/v2/alchemy-secret" || hits[0].body != `{"jsonrpc":"2.0","id":3,"method":"eth_blockNumber","params":[]}` {
		t.Fatalf("upstream received %+v", hits[0])
	}
}
