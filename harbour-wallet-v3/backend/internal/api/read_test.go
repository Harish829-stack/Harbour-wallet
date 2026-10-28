package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/prices"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

const (
	addrA = "0xaaaa000000000000000000000000000000000001"
	addrB = "0xbbbb000000000000000000000000000000000002"
	usdc  = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
	spam  = "0x5aa0000000000000000000000000000000000005"
	thin  = "0x7777000000000000000000000000000000000007"
	nftC  = "0xc0c0000000000000000000000000000000000c0c"
)

type capturePub struct {
	mu   sync.Mutex
	msgs map[string][]string
}

func (c *capturePub) Publish(_ context.Context, subject string, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.msgs[subject] = append(c.msgs[subject], string(data))
	return nil
}

// Phase 5 exit test: the home (portfolio, chart), history and NFT screens
// make no RPC calls, and their numbers are right.
func TestReadScreensMakeNoRPCCalls(t *testing.T) {
	rURL := os.Getenv("HB_TEST_REDIS_URL")
	if rURL == "" || os.Getenv("HB_TEST_POSTGRES_URL") == "" {
		t.Skip("integration env not set")
	}
	pgURL := testdb.URL(t, "api_read")
	ctx := context.Background()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	ropt, _ := redis.ParseURL(rURL)
	rdb := redis.NewClient(ropt)
	must(t, rdb.FlushDB(ctx).Err())
	cfg, err := config.Load("../../config")
	must(t, err)
	fams := map[string]string{}
	for n, c := range cfg.Chains {
		fams[n] = c.Family
	}
	must(t, st.UpsertChains(ctx, fams))
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))

	var rpcHits atomic.Int64
	gw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rpcHits.Add(1)
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":{"blockNumber":"0x10","status":"0x1","from":"0x1","to":null}}`)
	}))
	defer gw.Close()

	// NFT images: a large PNG and an SVG (refused).
	var imgHits atomic.Int64
	imgSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		imgHits.Add(1)
		if strings.HasSuffix(r.URL.Path, ".svg") {
			w.Header().Set("Content-Type", "image/svg+xml")
			io.WriteString(w, `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
			return
		}
		m := image.NewRGBA(image.Rect(0, 0, 1024, 512))
		for x := 0; x < 1024; x++ {
			m.Set(x, 10, color.RGBA{255, 0, 0, 255})
		}
		png.Encode(w, m)
	}))
	defer imgSrv.Close()

	pub := &capturePub{msgs: map[string][]string{}}
	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc, Events: pub,
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)), GatewayURL: gw.URL, PowDifficulty: 4, AllowPrivateMedia: true})
	hs := httptest.NewServer(srv.Handler())
	defer hs.Close()
	c := hbclient.New(hs.URL)
	_, err = c.Register(ctx)
	must(t, err)
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{
		{"chain": "base", "address": addrA}, {"chain": "base", "address": addrB}}}, nil, nil)
	must(t, err)
	idA, _ := st.TrackedID(ctx, "base", addrA)
	idB, _ := st.TrackedID(ctx, "base", addrB)

	// ---- seed what the indexer and price-poller would have written ----
	ac := store.NewAssetCache()
	dec := func(n int) *int { return &n }
	asset := func(ref, kind, sym string, d *int, spamScore int, verified bool) int64 {
		id, err := st.UpsertAsset(ctx, st.Pool, ac, store.AssetInput{Chain: "base", Ref: ref, Kind: kind, Symbol: sym, Decimals: d, SpamScore: spamScore, Verified: verified})
		must(t, err)
		return id
	}
	ethID := asset("native", "native", "ETH", dec(18), 0, true)
	usdcID := asset(usdc, "token", "USDC", dec(6), 0, true)
	spamID := asset(spam, "token", "Visit claim.xyz", dec(18), 90, false)
	thinID := asset(thin, "token", "THIN", dec(18), 0, false)
	nftID := asset(nftC, "nft", "CAT", nil, 0, false)
	_, err = st.UpsertBalances(ctx, idA, 500, []store.BalanceRow{
		{AssetID: ethID, AmountRaw: "1500000000000000000"}, {AssetID: usdcID, AmountRaw: "2500500000"},
		{AssetID: spamID, AmountRaw: "1000000000000000000000"}, {AssetID: thinID, AmountRaw: "5000000000000000000"}})
	must(t, err)
	_, err = st.UpsertBalances(ctx, idB, 500, []store.BalanceRow{{AssetID: ethID, AmountRaw: "0"}})
	must(t, err)
	now := time.Now()
	setPrice := func(id int64, usd, liq float64, flag string) {
		b, _ := json.Marshal(prices.Cached{USD: usd, LiquidityUSD: liq, Source: "coingecko", Flag: flag, At: now})
		must(t, rdb.Set(ctx, prices.Key(id), b, time.Hour).Err())
	}
	setPrice(ethID, 3000, 1e10, prices.FlagOK)
	setPrice(usdcID, 1.0, 4e8, prices.FlagOK)
	setPrice(thinID, 0.5, 120, prices.FlagThin)
	setPrice(spamID, 9.99, 1e9, prices.FlagOK) // a spam token must never be valued

	// 120 incoming USDC transfers over time, plus an NFT.
	var evs []index.ActivityEvent
	for i := 0; i < 120; i++ {
		evs = append(evs, index.ActivityEvent{Chain: "base", Family: "evm", TxHash: fmt.Sprintf("0x%064x", i+1), EventRef: "log:1",
			BlockNumber: uint64(100 + i), BlockTime: now.Add(-time.Duration(120-i) * time.Hour), From: addrB, To: addrA,
			Asset: usdc, AmountRaw: "1000000", Kind: index.KindToken})
	}
	_, err = st.IngestEvents(ctx, store.IngestOptions{Chain: "base", Family: "evm", NativeSym: "ETH", NativeDec: 18, Assets: ac,
		Classify: func(uint64) string { return "finalized" }}, evs)
	must(t, err)
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_state = CASE WHEN id=$1 THEN 'capped' ELSE 'done' END,
		synced_to_block = 500, history_from_block = 100 WHERE id IN ($1,$2)`, idA, idB)
	must(t, err)
	must(t, st.ReplaceNFTs(ctx, idA, 500, []store.NFTRow{
		{AssetID: nftID, TokenID: "1", Amount: "1", Name: "Cat #1", ImageSrc: imgSrv.URL + "/1.png"},
		{AssetID: nftID, TokenID: "2", Amount: "1", Name: "Cat #2", ImageSrc: imgSrv.URL + "/2.svg"}}))
	// Chart: yesterday 1 ETH, today 1.5 ETH + USDC.
	_, err = st.Pool.Exec(ctx, `INSERT INTO balance_snapshots VALUES ($1, current_date - 1, $2, 1000000000000000000)`, idA, ethID)
	must(t, err)
	_, err = st.SnapshotBalances(ctx, now)
	must(t, err)
	must(t, st.InsertTicks(ctx, []store.Tick{
		{AssetID: ethID, At: now.Add(-24 * time.Hour), PriceUSD: 2800, LiquidityUSD: 1e10},
		{AssetID: ethID, At: now, PriceUSD: 3000, LiquidityUSD: 1e10},
		{AssetID: usdcID, At: now, PriceUSD: 1, LiquidityUSD: 4e8},
		{AssetID: thinID, At: now, PriceUSD: 0.5, LiquidityUSD: 120}}))

	// ---- the screens ----
	var pf struct {
		ValueUSD  float64 `json:"value_usd"`
		Addresses []struct {
			Address   string `json:"address"`
			Synced    bool   `json:"synced"`
			AsOfBlock int64  `json:"as_of_block"`
			Assets    []struct {
				AssetRef string   `json:"asset_ref"`
				Amount   string   `json:"amount"`
				Spam     bool     `json:"spam"`
				ValueUSD *float64 `json:"value_usd"`
				Price    struct {
					USD  *float64 `json:"usd"`
					Flag string   `json:"flag"`
				} `json:"price"`
			} `json:"assets"`
		} `json:"addresses"`
	}
	_, err = c.Do(ctx, "GET", "/v1/me/portfolio", nil, &pf, nil)
	must(t, err)
	if pf.ValueUSD != 7000.5 || len(pf.Addresses) != 2 {
		t.Fatalf("portfolio total %v (want 7000.5) %+v", pf.ValueUSD, pf)
	}
	a := pf.Addresses[0]
	if a.Address != addrA || !a.Synced || a.AsOfBlock != 500 || len(a.Assets) != 4 {
		t.Fatalf("address A %+v", a)
	}
	if a.Assets[0].AssetRef != "native" || a.Assets[0].Amount != "1.5" || *a.Assets[0].ValueUSD != 4500 {
		t.Fatalf("first asset should be ETH worth 4500: %+v", a.Assets[0])
	}
	for _, x := range a.Assets {
		switch x.AssetRef {
		case usdc:
			if x.Amount != "2500.5" || *x.ValueUSD != 2500.5 {
				t.Fatalf("usdc %+v", x)
			}
		case thin:
			if x.Price.USD != nil || x.Price.Flag != "thin" || x.ValueUSD != nil {
				t.Fatalf("thin-liquidity token was priced: %+v", x)
			}
		case spam:
			if !x.Spam || x.ValueUSD != nil || x.Price.Flag != "none" {
				t.Fatalf("spam token was priced: %+v", x)
			}
		}
	}
	if !a.Assets[len(a.Assets)-1].Spam {
		t.Fatal("spam should sort last")
	}
	// Cached second call.
	_, err = c.Do(ctx, "GET", "/v1/me/portfolio", nil, &pf, nil)
	must(t, err)

	// History: 120 items in pages of 50, then older pages are requested.
	seen := map[string]bool{}
	cursor := ""
	var last map[string]any
	for page := 0; page < 5; page++ {
		path := "/v1/me/history?limit=50&addresses=base:" + addrA
		if cursor != "" {
			path += "&cursor=" + cursor
		}
		var h struct {
			Items []struct {
				TxHash    string `json:"tx_hash"`
				Direction string `json:"direction"`
				Finality  string `json:"finality"`
				Transfers []struct {
					Symbol *string `json:"symbol"`
					Amount string  `json:"amount"`
				} `json:"transfers"`
			} `json:"items"`
			Cursor       string `json:"cursor"`
			LoadingOlder *bool  `json:"loading_older"`
		}
		_, err = c.Do(ctx, "GET", path, nil, &h, nil)
		must(t, err)
		for _, it := range h.Items {
			if seen[it.TxHash] {
				t.Fatalf("duplicate %s across pages", it.TxHash)
			}
			seen[it.TxHash] = true
			if it.Direction != "in" || it.Finality != "finalized" || it.Transfers[0].Amount != "1" || *it.Transfers[0].Symbol != "USDC" {
				t.Fatalf("history item %+v", it)
			}
		}
		if page == 0 && h.Items[0].TxHash != fmt.Sprintf("0x%064x", 120) {
			t.Fatalf("history not newest first: %s", h.Items[0].TxHash)
		}
		if h.Cursor == "" {
			if h.LoadingOlder == nil || !*h.LoadingOlder {
				t.Fatal("capped address should report loading_older")
			}
			b, _ := json.Marshal(h)
			json.Unmarshal(b, &last)
			break
		}
		cursor = h.Cursor
	}
	if len(seen) != 120 {
		t.Fatalf("paged %d of 120", len(seen))
	}
	pub.mu.Lock()
	more := pub.msgs["address.history.more"]
	pub.mu.Unlock()
	if len(more) != 1 || !strings.Contains(more[0], fmt.Sprint(idA)) {
		t.Fatalf("history.more not requested once: %v", more)
	}

	// NFTs, through the media proxy only.
	var nfts struct {
		NFTs []struct {
			TokenID  string  `json:"token_id"`
			Name     *string `json:"name"`
			ImageURL *string `json:"image_url"`
		} `json:"nfts"`
	}
	_, err = c.Do(ctx, "GET", "/v1/me/nfts", nil, &nfts, nil)
	must(t, err)
	if len(nfts.NFTs) != 2 || nfts.NFTs[0].ImageURL == nil || strings.Contains(*nfts.NFTs[0].ImageURL, imgSrv.URL) {
		t.Fatalf("nfts %+v", nfts)
	}
	resp, err := http.Get(hs.URL + *nfts.NFTs[0].ImageURL)
	must(t, err)
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/png" || resp.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("media %d %v", resp.StatusCode, resp.Header)
	}
	cfgImg, err := png.DecodeConfig(bytes.NewReader(body))
	if err != nil || cfgImg.Width != 512 || cfgImg.Height != 256 {
		t.Fatalf("re-encoded image %+v %v", cfgImg, err)
	}
	hitsBefore := imgHits.Load()
	resp, _ = http.Get(hs.URL + *nfts.NFTs[0].ImageURL)
	resp.Body.Close()
	if imgHits.Load() != hitsBefore {
		t.Fatal("media not cached")
	}
	resp, _ = http.Get(hs.URL + *nfts.NFTs[1].ImageURL)
	resp.Body.Close()
	if resp.StatusCode != 404 {
		t.Fatalf("svg served: %d", resp.StatusCode)
	}

	// Chart: yesterday 1 ETH @2800; today 1.5 ETH @3000 + 2500.5 USDC (thin and spam excluded).
	var chart struct {
		Points []struct {
			Day      string  `json:"day"`
			ValueUSD float64 `json:"value_usd"`
		} `json:"points"`
	}
	_, err = c.Do(ctx, "GET", "/v1/me/portfolio/chart?range=7d", nil, &chart, nil)
	must(t, err)
	if len(chart.Points) != 2 || chart.Points[0].ValueUSD != 2800 || chart.Points[1].ValueUSD != 7000.5 {
		t.Fatalf("chart %+v", chart)
	}

	// Asset details and price history.
	var as struct {
		Asset struct{ Symbol string } `json:"asset"`
		Price struct {
			USD *float64 `json:"usd"`
		} `json:"price"`
	}
	_, err = c.Do(ctx, "GET", "/v1/assets/base/"+usdc, nil, &as, nil)
	must(t, err)
	if as.Asset.Symbol != "USDC" || as.Price.USD == nil || *as.Price.USD != 1 {
		t.Fatalf("asset %+v", as)
	}
	var series struct {
		Points []struct{ PriceUSD float64 } `json:"points"`
	}
	_, err = c.Do(ctx, "GET", "/v1/assets/base/native/prices?range=7d", nil, &series, nil)
	must(t, err)
	if len(series.Points) != 2 {
		t.Fatalf("series %+v", series)
	}
	// A known transaction is served from Postgres.
	var tx map[string]any
	_, err = c.Do(ctx, "GET", fmt.Sprintf("/v1/tx/base/0x%064x", 7), nil, &tx, nil)
	must(t, err)
	if tx["source"] != "indexed" || tx["finality"] != "finalized" {
		t.Fatalf("tx %v", tx)
	}

	if n := rpcHits.Load(); n != 0 {
		t.Fatalf("read screens made %d RPC calls", n)
	}

	// Only an unknown transaction may ask the chain.
	_, err = c.Do(ctx, "GET", "/v1/tx/base/0x"+strings.Repeat("e", 64), nil, &tx, nil)
	must(t, err)
	if tx["source"] != "chain" || rpcHits.Load() != 1 {
		t.Fatalf("unknown tx: %v hits=%d", tx, rpcHits.Load())
	}

	// Addresses a device doesn't track are refused.
	if code := status(c.Do(ctx, "GET", "/v1/me/portfolio?addresses=base:0x1234000000000000000000000000000000000000", nil, nil, nil)); code != 403 {
		t.Fatalf("foreign address: %d", code)
	}
}

// The media proxy refuses private addresses (SSRF), even via redirects.
func TestMediaProxyBlocksPrivateAddresses(t *testing.T) {
	if os.Getenv("HB_TEST_REDIS_URL") == "" || os.Getenv("HB_TEST_POSTGRES_URL") == "" {
		t.Skip("integration env not set")
	}
	ctx := context.Background()
	pgURL := testdb.URL(t, "api_media")
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.UpsertChains(ctx, map[string]string{"base": "evm"}))
	ropt, _ := redis.ParseURL(os.Getenv("HB_TEST_REDIS_URL"))
	rdb := redis.NewClient(ropt)
	var hit atomic.Int64
	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hit.Add(1) }))
	defer internal.Close()
	cfg, _ := config.Load("../../config")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc, Log: slog.New(slog.NewTextHandler(io.Discard, nil))})
	hs := httptest.NewServer(srv.Handler())
	defer hs.Close()
	d, _ := st.CreateDevice(ctx, []byte(strings.Repeat("m", 32)), "default", nil)
	_, _, err = st.AddDeviceAddresses(ctx, lc, d.ID, []store.AddressRef{{Chain: "base", Address: addrA}}, nil, 5)
	must(t, err)
	id, _ := st.TrackedID(ctx, "base", addrA)
	aid, _ := st.UpsertAsset(ctx, st.Pool, nil, store.AssetInput{Chain: "base", Ref: nftC, Kind: "nft"})
	src := internal.URL + "/metadata-service"
	must(t, st.ReplaceNFTs(ctx, id, 1, []store.NFTRow{{AssetID: aid, TokenID: "1", Amount: "1", ImageSrc: src}}))
	resp, err := http.Get(hs.URL + "/v1/media/" + store.MediaKey(src))
	must(t, err)
	resp.Body.Close()
	if resp.StatusCode != 404 || hit.Load() != 0 {
		t.Fatalf("private address fetched: status %d hits %d", resp.StatusCode, hit.Load())
	}
}
