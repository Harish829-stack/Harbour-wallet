package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

type memCache struct {
	mu sync.Mutex
	m  map[string][]byte
}

func (c *memCache) Get(_ context.Context, k string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	b, ok := c.m[k]
	return b, ok
}

func (c *memCache) Set(_ context.Context, k string, v []byte, _ time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.m == nil {
		c.m = map[string][]byte{}
	}
	c.m[k] = v
}

func testGateway(t *testing.T, h http.HandlerFunc) (*gateway, *memCache) {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	hosts := GatewayHosts{
		LiFi: srv.URL + "/lifi", Jupiter: srv.URL + "/jup", Relay: srv.URL + "/relay", Thor: srv.URL + "/thor", CoinGecko: srv.URL + "/cg",
		CoinGeckoPro: srv.URL + "/cgpro", GeckoTerminal: srv.URL + "/gt", Helius: srv.URL + "/helius", Etherscan: srv.URL + "/es",
		TronGrid: srv.URL + "/tron", TonCenter: srv.URL + "/ton", Pimlico: srv.URL + "/pim", Alchemy: srv.URL + "/alch/%s",
	}
	keys := GatewayKeys{LiFi: "lifi-secret-key", Jupiter: "jup-secret-key", CoinGecko: "cg-secret-key", Helius: "helius-secret", Alchemy: "alchemy-secret",
		Etherscan: "etherscan-secret", TronGrid: "trongrid-secret", TonCenter: "toncenter-secret"}
	cache := &memCache{}
	return newGateway(keys, hosts, map[uint64]string{1: "eth-mainnet", 137: "polygon-mainnet"}, cache), cache
}

func call(t *testing.T, g *gateway, method, target string, body string) (*gwResult, *gwReject, error) {
	t.Helper()
	u, err := url.Parse(target)
	if err != nil {
		t.Fatal(err)
	}
	c, rej := g.resolve(method, u.Path, u.Query(), []byte(body))
	if rej != nil {
		return nil, rej, nil
	}
	res, err := g.run(context.Background(), c)
	return res, nil, err
}

func TestGatewayRejectsUnlistedRoutes(t *testing.T) {
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) { t.Errorf("upstream must not be called: %s", r.URL) })
	for _, tc := range []struct{ method, target, body string }{
		{"GET", "/lifi/v1/admin", ""},
		{"GET", "/etherscan/v2?module=account&action=txlist&chainid=1&address=0x1&module=proxy", ""},
		{"GET", "/etherscan/v2?module=contract&action=getabi&chainid=1", ""},
		{"GET", "/etherscan/v2?module=account&action=txlist&chainid=abc", ""},
		{"POST", "/helius/rpc", `{"jsonrpc":"2.0","method":"requestAirdrop","params":[]}`},
		{"POST", "/helius/rpc", `[{"method":"getBalance"},{"method":"setIdentity"}]`},
		{"POST", "/alchemy/1/rpc", `{"method":"debug_traceTransaction"}`},
		{"POST", "/alchemy/999/rpc", `{"method":"eth_chainId"}`},
		{"GET", "/alchemy/1/nft/getNFTsForOwner?owner=0x1&apikey=x y", ""},
		{"POST", "/trongrid/wallet/deletewallet", `{}`},
		{"POST", "/toncenter/api/v2/admin", `{}`},
		{"GET", "/thornode/thorchain/tx/status/zz", ""},
		{"GET", "/rss/unknown", ""},
		{"GET", "/v2/market/charts?coin=bitcoin&days=3", ""},
		{"GET", "/v2/market/tickers?vs_currency=eur&order=market_cap_desc", ""},
		{"GET", "/gt/networks/eth/tokens/0x1", ""},
	} {
		if _, rej, _ := call(t, g, tc.method, tc.target, tc.body); rej == nil {
			t.Errorf("%s %s should be rejected", tc.method, tc.target)
		}
	}
}

func TestGatewayInjectsKeysAndScrubsEchoes(t *testing.T) {
	var gotHeader, gotPath, gotQuery string
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) {
		gotHeader, gotPath, gotQuery = r.Header.Get("x-lifi-api-key"), r.URL.Path, r.URL.RawQuery
		_, _ = io.WriteString(w, `{"echo":"`+r.Header.Get("x-lifi-api-key")+`"}`)
	})
	res, rej, err := call(t, g, "GET", "/lifi/v1/advanced/routes?x=1", "")
	if rej != nil || err != nil {
		t.Fatalf("rej=%v err=%v", rej, err)
	}
	if gotHeader != "lifi-secret-key" || gotPath != "/lifi/advanced/routes" || gotQuery != "x=1" {
		t.Fatalf("upstream saw header=%q path=%q query=%q", gotHeader, gotPath, gotQuery)
	}
	if strings.Contains(string(res.Body), "lifi-secret-key") {
		t.Fatalf("key leaked in %s", res.Body)
	}
}

func TestGatewayEtherscanSetsServerKeyAndIgnoresCallerKey(t *testing.T) {
	var q url.Values
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) {
		q = r.URL.Query()
		_, _ = io.WriteString(w, `{"status":"1","result":[]}`)
	})
	if _, rej, err := call(t, g, "GET", "/etherscan/v2?module=account&action=txlist&chainid=137&address=0xabc&apikey=attacker", ""); rej != nil || err != nil {
		t.Fatalf("rej=%v err=%v", rej, err)
	}
	if q.Get("apikey") != "etherscan-secret" || q.Get("chainid") != "137" || q.Get("address") != "0xabc" {
		t.Fatalf("query = %v", q)
	}
}

func TestGatewayPricesShapeAndCache(t *testing.T) {
	hits := 0
	g, cache := testGateway(t, func(w http.ResponseWriter, r *http.Request) {
		hits++
		if r.Header.Get("x-cg-demo-api-key") != "cg-secret-key" {
			t.Errorf("missing coingecko key")
		}
		_, _ = io.WriteString(w, `{"bitcoin":{"usd":100.5,"usd_24h_change":2.5},"junk":{}}`)
	})
	for i := 0; i < 2; i++ {
		res, rej, err := call(t, g, "GET", "/v2/market/prices?ids=bitcoin,junk,BAD!", "")
		if rej != nil || err != nil {
			t.Fatalf("rej=%v err=%v", rej, err)
		}
		var out map[string]map[string]float64
		if json.Unmarshal(res.Body, &out) != nil || out["bitcoin"]["price"] != 100.5 || out["bitcoin"]["change"] != 2.5 || len(out) != 1 {
			t.Fatalf("body = %s", res.Body)
		}
		if i == 1 && !res.Hit {
			t.Fatal("second call should be a cache hit")
		}
	}
	if hits != 1 || len(cache.m) != 1 {
		t.Fatalf("hits=%d cache=%d", hits, len(cache.m))
	}
	// no usable ids: answered without calling upstream
	res, rej, err := call(t, g, "GET", "/v2/market/prices?ids=BAD!", "")
	if rej != nil || err != nil || string(res.Body) != "{}" {
		t.Fatalf("empty ids: %v %v %v", res, rej, err)
	}
}

func TestGatewayUpstreamAuthFailureIsBadGateway(t *testing.T) {
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusUnauthorized) })
	if _, rej, err := call(t, g, "GET", "/lifi/v1/chains", ""); rej != nil || err == nil {
		t.Fatalf("upstream 401 must surface as an error (502), got rej=%v err=%v", rej, err)
	}
}

func TestGatewayPassesClientErrorsThrough(t *testing.T) {
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"message":"No available quotes"}`)
	})
	res, rej, err := call(t, g, "POST", "/lifi/v1/advanced/routes", `{"a":1}`)
	if rej != nil || err != nil || res.Status != 400 || !strings.Contains(string(res.Body), "No available quotes") {
		t.Fatalf("res=%+v rej=%v err=%v", res, rej, err)
	}
}

func TestGatewayAlchemyUsesChainsYamlSlug(t *testing.T) {
	var path string
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_, _ = io.WriteString(w, `{"result":"0x1"}`)
	})
	if _, rej, err := call(t, g, "POST", "/alchemy/137/rpc", `{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}`); rej != nil || err != nil {
		t.Fatalf("rej=%v err=%v", rej, err)
	}
	if path != "/alch/polygon-mainnet/v2/alchemy-secret" {
		t.Fatalf("path = %s", path)
	}
}

func TestJSONRPCGuard(t *testing.T) {
	ok := setOf("a", "b")
	for body, want := range map[string]bool{
		`{"method":"a"}`: true, `[{"method":"a"},{"method":"b"}]`: true, `{"method":"c"}`: false, `[]`: false, `nope`: false, ``: false,
	} {
		if got := jsonRPCGuard([]byte(body), ok) == nil; got != want {
			t.Errorf("%q: allowed=%v want %v", body, got, want)
		}
	}
}

func TestCleanQuery(t *testing.T) {
	q := url.Values{"b": {"2"}, "a": {"1"}}
	if s, ok := cleanQuery(q, nil, 4, reNFTValue); !ok || s != "?a=1&b=2" {
		t.Fatalf("got %q %v", s, ok)
	}
	if _, ok := cleanQuery(url.Values{"x y": {"1"}}, nil, 4, reNFTValue); ok {
		t.Fatal("bad key accepted")
	}
	if _, ok := cleanQuery(url.Values{"a": {"1"}, "z": {"1"}}, []string{"a"}, 4, reNFTValue); ok {
		t.Fatal("unlisted key accepted")
	}
}
