package api

// Third-party gateway: the Go replacement for gateway/worker.ts (the v2 Cloudflare Worker).
//
// The extension calls /v1/gw/<provider>/... with its normal device signature. This file holds the provider API keys,
// accepts only allow-listed paths and JSON-RPC methods (so it is not an open relay for the keys), caches answers in Redis
// and returns the upstream body. Routes keep the worker's paths so the extension's clients (swap, market, history, ramps,
// staking) only need their base URL changed.

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/config"
)

// GatewayKeys are the third-party API keys held by the backend. They never reach the extension.
type GatewayKeys struct {
	LiFi, Jupiter, Relay, Pimlico, CoinGecko, Helius, Alchemy, Etherscan, TronGrid, TonCenter string
	CoinGeckoPro                                                                              bool
	ConfigJSON, ConfigSig                                                                     string
}

// GatewayKeysFromEnv reads the keys from the environment (backend/.env locally, the secret store in production).
func GatewayKeysFromEnv() GatewayKeys {
	get := func(names ...string) string {
		for _, n := range names {
			if v := strings.TrimSpace(os.Getenv(n)); v != "" {
				return v
			}
		}
		return ""
	}
	return GatewayKeys{
		LiFi: get("LIFI_API_KEY"), Jupiter: get("JUP_API_KEY"), Relay: get("RELAY_API_KEY"), Pimlico: get("PIMLICO_API_KEY"),
		CoinGecko: get("COINGECKO_API_KEY", "COINGECKO_KEY"), CoinGeckoPro: strings.EqualFold(strings.TrimSpace(os.Getenv("COINGECKO_PLAN")), "pro"),
		Helius: get("HELIUS_API_KEY"), Alchemy: get("ALCHEMY_API_KEY"), Etherscan: get("ETHERSCAN_API_KEY"),
		TronGrid: get("TRONGRID_API_KEY"), TonCenter: get("TONCENTER_API_KEY"),
		ConfigJSON: os.Getenv("CONFIG_JSON"), ConfigSig: os.Getenv("CONFIG_SIG"),
	}
}

// GatewayHosts are the upstream base URLs (overridden in tests).
type GatewayHosts struct {
	LiFi, Jupiter, Relay, Thor, CoinGecko, CoinGeckoPro, GeckoTerminal, Helius, Etherscan, TronGrid, TonCenter, Pimlico string
	// Alchemy is a format with one %s for the network slug, e.g. "https://%s.g.alchemy.com".
	Alchemy string
}

// DefaultGatewayHosts are the production upstreams.
func DefaultGatewayHosts() GatewayHosts {
	return GatewayHosts{
		LiFi: "https://li.quest/v1", Jupiter: "https://api.jup.ag/swap/v1", Relay: "https://api.relay.link",
		Thor: "https://gateway.liquify.com/chain/thorchain_api", CoinGecko: "https://api.coingecko.com/api/v3",
		CoinGeckoPro: "https://pro-api.coingecko.com/api/v3", GeckoTerminal: "https://api.geckoterminal.com/api/v2",
		Helius: "https://mainnet.helius-rpc.com", Etherscan: "https://api.etherscan.io/v2/api", TronGrid: "https://api.trongrid.io",
		TonCenter: "https://toncenter.com", Pimlico: "https://api.pimlico.io/v2", Alchemy: "https://%s.g.alchemy.com",
	}
}

// gwCall is one validated upstream request.
type gwCall struct {
	method  string
	url     string
	header  map[string]string
	body    []byte
	ttl     time.Duration // 0 = not cached
	post    func([]byte) ([]byte, error)
	accept  string // response content type when the upstream sends none
	secrets []string
}

type gwReject struct {
	status int
	code   string
	msg    string
}

var errNotFound = &gwReject{http.StatusNotFound, "not_found", "Not available."}
var errNotAllowed = &gwReject{http.StatusForbidden, "not_allowed", "This request is not allowed."}
var errBadRequest = &gwReject{http.StatusBadRequest, "bad_request", "Invalid request."}
var errUnavailable = &gwReject{http.StatusNotFound, "unavailable", "This service is not available."}

var (
	reLiFi      = regexp.MustCompile(`^/lifi/v1/(advanced/(routes|stepTransaction)|status|token|tokens|chains)$`)
	reJup       = regexp.MustCompile(`^/jup/swap/v1/(quote|swap)$`)
	reRelay     = regexp.MustCompile(`^/relay/(quote/v2|intents/status/v[23])$`)
	reThor      = regexp.MustCompile(`^/thornode/thorchain/(quote/swap|tx/status/[0-9A-Fa-f]{64}|inbound_addresses)$`)
	reGT        = regexp.MustCompile(`^/gt/networks/(trending_pools|[a-z0-9_-]{2,32}/(tokens/[A-Za-z0-9]{20,64}|pools/[A-Za-z0-9]{20,90}/ohlcv/(minute|hour|day)))$`)
	reAlchRPC   = regexp.MustCompile(`^/alchemy/(\d{1,9})/rpc$`)
	reAlchNFT   = regexp.MustCompile(`^/alchemy/(\d{1,9})/nft/(getNFTsForOwner|getContractMetadata|getNFTMetadata|getFloorPrice|isSpamContract|getOwnersForNFT)$`)
	rePimlico   = regexp.MustCompile(`^/pimlico/(1|56|137|42161|8453)$`)
	reTron      = regexp.MustCompile(`(?i)^/(wallet|walletsolidity)/(getaccount|getnowblock|getaccountresource|triggerconstantcontract|triggersmartcontract|createtransaction|broadcasttransaction|broadcasthex|getchainparameters|gettransactioninfobyid|listwitnesses|freezebalancev2|unfreezebalancev2|votewitnessaccount|withdrawbalance|getreward|getdelegatedresourcev2)$|^/v1/accounts/T[1-9A-HJ-NP-Za-km-z]{33}(/transactions(/trc20)?)?$`)
	reTon       = regexp.MustCompile(`^/toncenter(/api/v[23]/(getAddressInformation|getWalletInformation|getTransactions|sendBoc|sendBocReturnHash|runGetMethod|estimateFee|jetton/wallets|jetton/masters|jetton/transfers|nft/items|getMasterchainInfo|transactions))$`)
	reEtherscan = regexp.MustCompile(`^(account:(txlist|tokentx|tokennfttx|token1155tx|txlistinternal|balance|balancemulti)|gastracker:gasoracle|stats:ethprice|proxy:eth_gasPrice)$`)
	reDays      = regexp.MustCompile(`^(1|7|30|365|max)$`)
	reCoinID    = regexp.MustCompile(`^[a-z0-9-]{1,64}$`)
	reDigits    = regexp.MustCompile(`^\d{1,9}$`)
	reNFTValue  = regexp.MustCompile(`^[A-Za-z0-9_.,:=-]{0,200}$`)
	reGTValue   = regexp.MustCompile(`^[A-Za-z0-9_.,-]{0,64}$`)
	reQueryKey  = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{0,31}(\[\])?$`)
)

var rssFeeds = map[string]string{
	"coindesk": "https://www.coindesk.com/arc/outboundfeeds/rss/", "cointelegraph": "https://cointelegraph.com/rss",
	"decrypt": "https://decrypt.co/feed", "theblock": "https://www.theblock.co/rss.xml",
}

var solRPCMethods = setOf("getBalance", "getAccountInfo", "getMultipleAccounts", "getTokenAccountsByOwner", "getTokenAccountBalance", "getSignaturesForAddress", "getSignatureStatuses", "getTransaction", "getLatestBlockhash", "getFeeForMessage", "getMinimumBalanceForRentExemption", "getRecentPrioritizationFees", "getEpochInfo", "getVoteAccounts", "simulateTransaction", "sendTransaction", "isBlockhashValid", "getHealth",
	"getProgramAccounts", "getInflationRate", "getInflationReward", "getSupply", "getStakeMinimumDelegation", "getSlot", "getBlockHeight", "getTokenSupply",
	"getAsset", "getAssetsByOwner", "getAssetsByGroup", "getAssetBatch", "getAssetProof", "searchAssets", "getTokenAccounts", "getTokenLargestAccounts", "getBlockTime")

var evmRPCMethods = setOf("eth_chainId", "eth_blockNumber", "eth_getBalance", "eth_call", "eth_estimateGas", "eth_gasPrice", "eth_maxPriorityFeePerGas", "eth_feeHistory", "eth_getTransactionCount", "eth_getTransactionByHash", "eth_getTransactionReceipt", "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getCode", "eth_getLogs", "eth_getStorageAt", "eth_sendRawTransaction", "eth_simulateV1", "net_version", "alchemy_getTokenBalances", "alchemy_getTokenMetadata", "alchemy_getAssetTransfers")

var aaRPCMethods = setOf("pimlico_getUserOperationGasPrice", "pm_sponsorUserOperation", "eth_sendUserOperation", "eth_getUserOperationReceipt", "eth_estimateUserOperationGas", "eth_supportedEntryPoints")

func setOf(v ...string) map[string]bool {
	m := make(map[string]bool, len(v))
	for _, s := range v {
		m[s] = true
	}
	return m
}

// gateway resolves and runs allow-listed third-party calls.
type gateway struct {
	keys  GatewayKeys
	hosts GatewayHosts
	// alchemy maps an EVM chain id to its Alchemy network slug ("eth-mainnet"); built from chains.yaml.
	alchemy map[uint64]string
	client  *http.Client
	cache   gwCache
}

type gwCache interface {
	Get(ctx context.Context, key string) ([]byte, bool)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration)
}

type redisGWCache struct{ rdb *redis.Client }

func (c redisGWCache) Get(ctx context.Context, key string) ([]byte, bool) {
	b, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return nil, false
	}
	return b, true
}

func (c redisGWCache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) {
	_ = c.rdb.Set(ctx, key, val, ttl).Err()
}

func newGateway(keys GatewayKeys, hosts GatewayHosts, alchemy map[uint64]string, cache gwCache) *gateway {
	return &gateway{keys: keys, hosts: hosts, alchemy: alchemy, cache: cache, client: &http.Client{
		Timeout:       20 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

// jsonRPCGuard accepts a JSON-RPC object or a batch of at most 50 whose methods are all allowed.
func jsonRPCGuard(body []byte, allowed map[string]bool) *gwReject {
	if len(body) == 0 || len(body) > 200_000 {
		return errBadRequest
	}
	var one struct {
		Method string `json:"method"`
	}
	trim := bytes.TrimSpace(body)
	if len(trim) > 0 && trim[0] == '[' {
		var many []struct {
			Method string `json:"method"`
		}
		if json.Unmarshal(trim, &many) != nil || len(many) == 0 || len(many) > 50 {
			return errBadRequest
		}
		for _, c := range many {
			if !allowed[c.Method] {
				return errNotAllowed
			}
		}
		return nil
	}
	if json.Unmarshal(trim, &one) != nil {
		return errBadRequest
	}
	if !allowed[one.Method] {
		return errNotAllowed
	}
	return nil
}

// cleanQuery rebuilds a query string from a bounded, validated set of parameters so cache keys and upstream URLs cannot be inflated.
// keys == nil accepts any plausible name. ok=false means invalid. The result is sorted, "" or "?a=b&c=d".
func cleanQuery(q url.Values, keys []string, max int, value *regexp.Regexp) (string, bool) {
	type kv struct{ k, v string }
	var out []kv
	for k, vs := range q {
		if keys != nil {
			found := false
			for _, a := range keys {
				if a == k {
					found = true
					break
				}
			}
			if !found {
				return "", false
			}
		} else if !reQueryKey.MatchString(k) {
			return "", false
		}
		for _, v := range vs {
			if !value.MatchString(v) {
				return "", false
			}
			out = append(out, kv{k, v})
			if len(out) > max {
				return "", false
			}
		}
	}
	if len(out) == 0 {
		return "", true
	}
	sort.Slice(out, func(i, j int) bool { return out[i].k+out[i].v < out[j].k+out[j].v })
	parts := make([]string, len(out))
	for i, p := range out {
		parts[i] = url.QueryEscape(p.k) + "=" + url.QueryEscape(p.v)
	}
	return "?" + strings.Join(parts, "&"), true
}

// rawQuery passes a short query string through (used where the upstream API defines its own parameters).
func rawQuery(r url.Values) (string, bool) {
	if len(r) == 0 {
		return "", true
	}
	enc := r.Encode()
	if len(enc) > 2048 {
		return "", false
	}
	return "?" + enc, true
}

func (g *gateway) coingecko(path string, ttl time.Duration) *gwCall {
	base, header := g.hosts.CoinGecko, "x-cg-demo-api-key"
	if g.keys.CoinGeckoPro {
		base, header = g.hosts.CoinGeckoPro, "x-cg-pro-api-key"
	}
	h := map[string]string{"accept": "application/json"}
	if g.keys.CoinGecko != "" {
		h[header] = g.keys.CoinGecko
	}
	return &gwCall{method: http.MethodGet, url: base + path, header: h, ttl: ttl, secrets: []string{g.keys.CoinGecko}}
}

// resolve validates one request and describes the upstream call. path starts with "/" and is relative to /v1/gw.
func (g *gateway) resolve(method, path string, q url.Values, body []byte) (*gwCall, *gwReject) {
	jsonH := func(extra map[string]string) map[string]string {
		h := map[string]string{"content-type": "application/json", "accept": "application/json"}
		for k, v := range extra {
			if v != "" {
				h[k] = v
			}
		}
		return h
	}
	switch {
	case path == "/v2/market/prices":
		if method != http.MethodGet {
			return nil, errNotFound
		}
		var ids []string
		for _, id := range strings.Split(q.Get("ids"), ",") {
			if reCoinID.MatchString(id) {
				ids = append(ids, id)
			}
		}
		if len(ids) == 0 {
			return &gwCall{method: http.MethodGet, url: "", ttl: 0, accept: "application/json", post: func([]byte) ([]byte, error) { return []byte("{}"), nil }}, nil
		}
		sort.Strings(ids)
		if len(ids) > 100 {
			ids = ids[:100]
		}
		c := g.coingecko("/simple/price?ids="+strings.Join(ids, ",")+"&vs_currencies=usd&include_24hr_change=true", 60*time.Second)
		c.post = func(b []byte) ([]byte, error) {
			var d map[string]struct {
				USD    *float64 `json:"usd"`
				Change *float64 `json:"usd_24h_change"`
			}
			if err := json.Unmarshal(b, &d); err != nil {
				return nil, err
			}
			out := map[string]map[string]float64{}
			for k, v := range d {
				if v.USD == nil {
					continue
				}
				ch := 0.0
				if v.Change != nil {
					ch = *v.Change
				}
				out[k] = map[string]float64{"price": *v.USD, "change": ch}
			}
			return json.Marshal(out)
		}
		return c, nil
	case path == "/v2/market/charts":
		coin, days := q.Get("coin"), q.Get("days")
		if !reCoinID.MatchString(coin) || !reDays.MatchString(days) {
			return nil, errBadRequest
		}
		ttl := 600 * time.Second
		if days == "1" {
			ttl = 60 * time.Second
		}
		return g.coingecko("/coins/"+coin+"/market_chart?vs_currency=usd&days="+days, ttl), nil
	case path == "/v2/market/info":
		coin := q.Get("coin")
		if !reCoinID.MatchString(coin) {
			return nil, errBadRequest
		}
		return g.coingecko("/coins/"+coin+"?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false", 900*time.Second), nil
	case path == "/v2/market/tickers":
		allowed := map[string]*regexp.Regexp{
			"vs_currency": regexp.MustCompile(`^usd$`), "order": regexp.MustCompile(`^[a-z_]{1,32}$`), "per_page": regexp.MustCompile(`^\d{1,3}$`),
			"page": regexp.MustCompile(`^\d{1,4}$`), "price_change_percentage": regexp.MustCompile(`^[0-9a-z,]{0,40}$`), "category": regexp.MustCompile(`^[a-z0-9-]{0,64}$`),
		}
		if q.Get("vs_currency") != "usd" || !allowed["order"].MatchString(q.Get("order")) {
			return nil, errBadRequest
		}
		v := url.Values{}
		for k, re := range allowed {
			if val := q.Get(k); val != "" || q.Has(k) {
				if !re.MatchString(val) {
					return nil, errBadRequest
				}
				v.Set(k, val)
			}
		}
		return g.coingecko("/coins/markets?"+v.Encode(), 120*time.Second), nil
	case path == "/v2/market/trending":
		return g.coingecko("/search/trending", 300*time.Second), nil
	case strings.HasPrefix(path, "/gt/"):
		if method != http.MethodGet || !reGT.MatchString(path) {
			return nil, errNotFound
		}
		qs, ok := cleanQuery(q, []string{"page", "include", "aggregate", "limit", "before_timestamp", "token", "currency", "include_volume_breakdown", "duration"}, 8, reGTValue)
		if !ok {
			return nil, errBadRequest
		}
		ttl := 60 * time.Second
		if strings.Contains(path, "ohlcv") {
			ttl = 120 * time.Second
		}
		return &gwCall{method: http.MethodGet, url: g.hosts.GeckoTerminal + strings.TrimPrefix(path, "/gt") + qs, header: map[string]string{"accept": "application/json;version=20230302"}, ttl: ttl}, nil
	case strings.HasPrefix(path, "/rss/"):
		src, ok := rssFeeds[strings.TrimPrefix(path, "/rss/")]
		if !ok || method != http.MethodGet {
			return nil, errNotFound
		}
		return &gwCall{method: http.MethodGet, url: src, header: map[string]string{"accept": "application/rss+xml, application/xml, text/xml"}, ttl: 600 * time.Second, accept: "application/rss+xml"}, nil
	case reLiFi.MatchString(path):
		qs, ok := rawQuery(q)
		if !ok || (method != http.MethodGet && method != http.MethodPost) {
			return nil, errBadRequest
		}
		return &gwCall{method: method, url: g.hosts.LiFi + strings.TrimPrefix(path, "/lifi/v1") + qs, body: body, header: jsonH(map[string]string{"x-lifi-api-key": g.keys.LiFi}),
			ttl: lifiTTL(path, method), secrets: []string{g.keys.LiFi}}, nil
	case reJup.MatchString(path):
		qs, ok := rawQuery(q)
		if !ok || (method != http.MethodGet && method != http.MethodPost) {
			return nil, errBadRequest
		}
		return &gwCall{method: method, url: g.hosts.Jupiter + strings.TrimPrefix(path, "/jup/swap/v1") + qs, body: body, header: jsonH(map[string]string{"x-api-key": g.keys.Jupiter}), secrets: []string{g.keys.Jupiter}}, nil
	case reRelay.MatchString(path):
		qs, ok := rawQuery(q)
		if !ok || (method != http.MethodGet && method != http.MethodPost) {
			return nil, errBadRequest
		}
		var ttl time.Duration
		if strings.Contains(path, "/status/") {
			ttl = 3 * time.Second
		}
		return &gwCall{method: method, url: g.hosts.Relay + strings.TrimPrefix(path, "/relay") + qs, body: body, header: jsonH(map[string]string{"x-api-key": g.keys.Relay}), ttl: ttl, secrets: []string{g.keys.Relay}}, nil
	case reThor.MatchString(path):
		qs, ok := rawQuery(q)
		if !ok || method != http.MethodGet {
			return nil, errBadRequest
		}
		var ttl time.Duration
		if strings.Contains(path, "/tx/status/") {
			ttl = 5 * time.Second
		}
		return &gwCall{method: http.MethodGet, url: g.hosts.Thor + strings.TrimPrefix(path, "/thornode") + qs, header: jsonH(nil), ttl: ttl}, nil
	case path == "/helius/rpc":
		if method != http.MethodPost || g.keys.Helius == "" {
			return nil, errUnavailable
		}
		if rej := jsonRPCGuard(body, solRPCMethods); rej != nil {
			return nil, rej
		}
		return &gwCall{method: http.MethodPost, url: g.hosts.Helius + "/?api-key=" + url.QueryEscape(g.keys.Helius), body: body, header: jsonH(nil), secrets: []string{g.keys.Helius}}, nil
	case reAlchRPC.MatchString(path):
		m := reAlchRPC.FindStringSubmatch(path)
		slug := g.alchemySlug(m[1])
		if method != http.MethodPost || slug == "" || g.keys.Alchemy == "" {
			return nil, errUnavailable
		}
		if rej := jsonRPCGuard(body, evmRPCMethods); rej != nil {
			return nil, rej
		}
		return &gwCall{method: http.MethodPost, url: fmt.Sprintf(g.hosts.Alchemy, slug) + "/v2/" + g.keys.Alchemy, body: body, header: jsonH(nil), secrets: []string{g.keys.Alchemy}}, nil
	case reAlchNFT.MatchString(path):
		m := reAlchNFT.FindStringSubmatch(path)
		slug := g.alchemySlug(m[1])
		if method != http.MethodGet || slug == "" || g.keys.Alchemy == "" {
			return nil, errUnavailable
		}
		qs, ok := cleanQuery(q, nil, 24, reNFTValue)
		if !ok {
			return nil, errBadRequest
		}
		ttl := 60 * time.Second
		if m[2] == "getFloorPrice" || m[2] == "isSpamContract" || m[2] == "getContractMetadata" {
			ttl = 600 * time.Second
		}
		return &gwCall{method: http.MethodGet, url: fmt.Sprintf(g.hosts.Alchemy, slug) + "/nft/v3/" + g.keys.Alchemy + "/" + m[2] + qs, header: jsonH(nil), ttl: ttl, secrets: []string{g.keys.Alchemy}}, nil
	case path == "/etherscan/v2":
		if method != http.MethodGet || g.keys.Etherscan == "" {
			return nil, errNotAllowed
		}
		if len(q["module"]) != 1 || len(q["action"]) != 1 || len(q["chainid"]) != 1 || !reEtherscan.MatchString(q.Get("module")+":"+q.Get("action")) || !reDigits.MatchString(q.Get("chainid")) {
			return nil, errNotAllowed
		}
		v := url.Values{}
		for k, vs := range q {
			if k == "apikey" || len(vs) > 8 || !reQueryKey.MatchString(k) {
				continue
			}
			for _, x := range vs {
				if len(x) > 200 {
					return nil, errBadRequest
				}
				v.Add(k, x)
			}
		}
		v.Set("apikey", g.keys.Etherscan)
		ttl := 20 * time.Second
		if q.Get("action") == "gasoracle" || q.Get("action") == "ethprice" || q.Get("action") == "eth_gasPrice" {
			ttl = 10 * time.Second
		}
		return &gwCall{method: http.MethodGet, url: g.hosts.Etherscan + "?" + v.Encode(), header: map[string]string{"accept": "application/json"}, ttl: ttl, secrets: []string{g.keys.Etherscan}}, nil
	case strings.HasPrefix(path, "/trongrid/"):
		rest := strings.TrimPrefix(path, "/trongrid")
		qs, ok := rawQuery(q)
		if g.keys.TronGrid == "" || !reTron.MatchString(rest) || !ok || (method != http.MethodGet && method != http.MethodPost) {
			return nil, errNotAllowed
		}
		return &gwCall{method: method, url: g.hosts.TronGrid + rest + qs, body: body, header: jsonH(map[string]string{"TRON-PRO-API-KEY": g.keys.TronGrid}), secrets: []string{g.keys.TronGrid}}, nil
	case strings.HasPrefix(path, "/toncenter/"):
		m := reTon.FindStringSubmatch(path)
		qs, ok := rawQuery(q)
		if g.keys.TonCenter == "" || m == nil || !ok || (method != http.MethodGet && method != http.MethodPost) {
			return nil, errNotAllowed
		}
		return &gwCall{method: method, url: g.hosts.TonCenter + m[1] + qs, body: body, header: jsonH(map[string]string{"X-API-Key": g.keys.TonCenter}), secrets: []string{g.keys.TonCenter}}, nil
	case rePimlico.MatchString(path):
		m := rePimlico.FindStringSubmatch(path)
		if method != http.MethodPost || g.keys.Pimlico == "" {
			return nil, errUnavailable
		}
		if rej := jsonRPCGuard(body, aaRPCMethods); rej != nil {
			return nil, rej
		}
		return &gwCall{method: http.MethodPost, url: g.hosts.Pimlico + "/" + m[1] + "/rpc?apikey=" + url.QueryEscape(g.keys.Pimlico), body: body, header: jsonH(nil), secrets: []string{g.keys.Pimlico}}, nil
	}
	return nil, errNotFound
}

func lifiTTL(path, method string) time.Duration {
	switch {
	case method == http.MethodGet && (strings.HasSuffix(path, "/chains") || strings.HasSuffix(path, "/tokens")):
		return 600 * time.Second
	case method == http.MethodGet && strings.HasSuffix(path, "/status"):
		return 3 * time.Second
	}
	return 0
}

func (g *gateway) alchemySlug(chainID string) string {
	var id uint64
	if _, err := fmt.Sscanf(chainID, "%d", &id); err != nil {
		return ""
	}
	return g.alchemy[id]
}

type gwResult struct {
	Status int    `json:"s"`
	Type   string `json:"t"`
	Body   []byte `json:"b"`
	Hit    bool   `json:"-"`
}

const gwMaxBody = 4 << 20

// run performs the call (or serves it from the cache). Upstream authentication failures are reported as 502 so a bad or
// expired provider key never looks like a problem with the caller's own device signature.
func (g *gateway) run(ctx context.Context, c *gwCall) (*gwResult, error) {
	if c.url == "" { // a request with nothing to ask upstream (e.g. no valid coin ids): answer from post alone
		b, err := c.post(nil)
		if err != nil {
			return nil, err
		}
		return &gwResult{Status: 200, Type: "application/json", Body: b}, nil
	}
	var key string
	if c.ttl > 0 && g.cache != nil {
		sum := sha256.Sum256([]byte(c.method + "\n" + c.url + "\n" + string(c.body)))
		key = "hb:gw:" + hex.EncodeToString(sum[:])
		if b, ok := g.cache.Get(ctx, key); ok {
			var res gwResult
			if json.Unmarshal(b, &res) == nil {
				res.Hit = true
				return &res, nil
			}
		}
	}
	var rd io.Reader
	if len(c.body) > 0 {
		rd = bytes.NewReader(c.body)
	}
	req, err := http.NewRequestWithContext(ctx, c.method, c.url, rd)
	if err != nil {
		return nil, err
	}
	for k, v := range c.header {
		req.Header.Set(k, v)
	}
	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gateway upstream: %s", scrub(err.Error(), c.secrets))
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, gwMaxBody+1))
	if err != nil || len(b) > gwMaxBody {
		return nil, fmt.Errorf("gateway upstream: bad body")
	}
	b = []byte(scrub(string(b), c.secrets))
	status := resp.StatusCode
	if status == http.StatusUnauthorized || status == http.StatusForbidden || status >= 500 {
		return nil, fmt.Errorf("gateway upstream: status %d", status)
	}
	if status == http.StatusOK && c.post != nil {
		if b, err = c.post(b); err != nil {
			return nil, fmt.Errorf("gateway upstream: unreadable answer")
		}
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = c.accept
	}
	if ct == "" {
		ct = "application/json"
	}
	res := &gwResult{Status: status, Type: ct, Body: b}
	if status == http.StatusOK && c.ttl > 0 && g.cache != nil && len(b) <= 512<<10 {
		if enc, err := json.Marshal(res); err == nil {
			g.cache.Set(ctx, key, enc, c.ttl)
		}
	}
	return res, nil
}

func scrub(s string, secrets []string) string {
	for _, k := range secrets {
		if len(k) >= 6 {
			s = strings.ReplaceAll(s, k, "***")
		}
	}
	return s
}

// gwLimit is the per-device gateway budget per minute for a tier.
func (s *Server) gwLimit(tier string) int {
	if n := s.tier(tier).GatewayPerMinute; n > 0 {
		return n
	}
	return 600
}

// handleGateway serves /v1/gw/*.
func (s *Server) handleGateway(w http.ResponseWriter, r *http.Request) {
	d := deviceFrom(r.Context())
	ok, err := s.counter(r.Context(), "hb:rlgw:"+d.ID, 1, s.gwLimit(d.Tier))
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	if !ok {
		w.Header().Set("Retry-After", "30")
		writeErr(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Please wait a moment.", true)
		return
	}
	path := "/" + chi.URLParam(r, "*")
	if path == "/v1/config" {
		s.handleGatewayConfig(w)
		return
	}
	var body []byte
	if r.Method == http.MethodPost {
		body, err = io.ReadAll(r.Body)
		if err != nil {
			writeErr(w, http.StatusRequestEntityTooLarge, "too_large", "That request is too large.", false)
			return
		}
	}
	call, rej := s.gw.resolve(r.Method, path, r.URL.Query(), body)
	if rej != nil {
		writeErr(w, rej.status, rej.code, rej.msg, false)
		return
	}
	res, err := s.gw.run(r.Context(), call)
	if err != nil {
		s.opt.Log.Warn("gateway upstream failed", "path", path, "err", err)
		writeErr(w, http.StatusBadGateway, "upstream_unavailable", "This service is temporarily unavailable. Please try again.", true)
		return
	}
	w.Header().Set("Content-Type", res.Type)
	w.Header().Set("Cache-Control", "no-store")
	if res.Hit {
		w.Header().Set("X-HB-Cache", "hit")
	}
	w.WriteHeader(res.Status)
	_, _ = w.Write(res.Body)
}

// handleGatewayConfig serves the signed remote config (flags, announcements, kill switches).
func (s *Server) handleGatewayConfig(w http.ResponseWriter) {
	k := s.gw.keys
	if k.ConfigJSON == "" || k.ConfigSig == "" {
		writeErr(w, http.StatusNotFound, "no_config", "No configuration is published.", false)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	writeJSON(w, http.StatusOK, map[string]string{"config": k.ConfigJSON, "signature": k.ConfigSig})
}

// alchemySlugs maps EVM chain ids to Alchemy network slugs using chains.yaml (the single source of truth).
func alchemySlugs(cfg *config.Config) map[uint64]string {
	out := map[uint64]string{}
	if cfg == nil {
		return out
	}
	for _, c := range cfg.Chains {
		if c.EVMChainID == 0 {
			continue
		}
		for _, u := range c.Upstreams {
			if u.Provider == "alchemy" && u.Network != "" {
				out[c.EVMChainID] = u.Network
				break
			}
		}
	}
	return out
}
