package prices_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/price"
	"harbour/backend/internal/events"
	"harbour/backend/internal/prices"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

type src struct {
	q    map[string]price.Quote // asset ref -> quote
	fail bool
	seen [][]price.AssetKey
}

func (s *src) Name() string { return "fake" }
func (s *src) Quotes(_ context.Context, keys []price.AssetKey) ([]price.Quote, error) {
	s.seen = append(s.seen, keys)
	if s.fail {
		return nil, errors.New("down")
	}
	var out []price.Quote
	for _, k := range keys {
		if q, ok := s.q[k.AssetRef]; ok {
			q.Asset = k
			q.At = time.Now()
			out = append(out, q)
		}
	}
	return out, nil
}

func TestPoller(t *testing.T) {
	if os.Getenv("HB_TEST_REDIS_URL") == "" {
		t.Skip("integration env not set")
	}
	pgURL := testdb.URL(t, "prices")
	ctx := context.Background()
	st, err := store.Open(ctx, pgURL)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if _, err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	st.UpsertChains(ctx, map[string]string{"base": "evm"})
	ropt, _ := redis.ParseURL(os.Getenv("HB_TEST_REDIS_URL"))
	ropt.DB = 14 // the api tests flush their own DB in parallel
	rdb := redis.NewClient(ropt)
	rdb.FlushDB(ctx)
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	d, _ := st.CreateDevice(ctx, []byte(strings.Repeat("p", 32)), "default", nil)
	st.AddDeviceAddresses(ctx, lc, d.ID, []store.AddressRef{{Chain: "base", Address: "0xaaaa000000000000000000000000000000000001"}}, nil, 5)
	id, _ := st.TrackedID(ctx, "base", "0xaaaa000000000000000000000000000000000001")
	ac := store.NewAssetCache()
	up := func(ref, kind string, spam int, verified bool) int64 {
		x, _ := st.UpsertAsset(ctx, st.Pool, ac, store.AssetInput{Chain: "base", Ref: ref, Kind: kind, SpamScore: spam, Verified: verified})
		return x
	}
	eth, usdc, thin, longtail, spammy := up("native", "native", 0, true), up("0xusdc", "token", 0, true), up("0xthin", "token", 0, false),
		up("0xlong", "token", 0, false), up("0xspam", "token", 90, false)
	st.UpsertBalances(ctx, id, 1, []store.BalanceRow{{AssetID: eth, AmountRaw: "1"}, {AssetID: usdc, AmountRaw: "1"},
		{AssetID: thin, AmountRaw: "1"}, {AssetID: longtail, AmountRaw: "1"}, {AssetID: spammy, AmountRaw: "1"}})

	cg := &src{q: map[string]price.Quote{"native": {PriceUSD: 3000, LiquidityUSD: 1e10}, "0xusdc": {PriceUSD: 1, LiquidityUSD: 5e8},
		"0xthin": {PriceUSD: 2, LiquidityUSD: 500}}}
	al := &src{q: map[string]price.Quote{"0xlong": {PriceUSD: 0.01}, "0xusdc": {PriceUSD: 0.999}, "native": {PriceUSD: 2999}}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	chains := map[string]config.Chain{"base": {Native: config.Native{PriceIDs: map[string]string{"coingecko": "ethereum", "alchemy": "ETH"}}}}
	p := &prices.Poller{St: st, Redis: rdb, Bus: events.Log{L: log}, Sources: []prices.Named{{Name: "coingecko", Source: cg}, {Name: "alchemy", Source: al}},
		Chains: chains, Cfg: config.Prices{TopN: 100, MinLiquidityUSD: 10000, CacheTTL: time.Hour}, Log: log}
	n, err := p.RunOnce(ctx, true)
	if err != nil || n != 4 {
		t.Fatalf("priced %d (%v)", n, err)
	}
	got, _ := prices.Get(ctx, rdb, []int64{eth, usdc, thin, longtail, spammy})
	if got[eth].Flag != "ok" || got[usdc].USD != 1 || got[thin].Flag != "thin" || got[longtail].Flag != "thin" || got[longtail].Source != "alchemy" {
		t.Fatalf("prices %+v", got)
	}
	if _, ok := got[spammy]; ok {
		t.Fatal("spam token priced")
	}
	for _, k := range cg.seen[0] {
		if k.AssetRef == "native" && k.ExternalID != "ethereum" {
			t.Fatalf("native id %q", k.ExternalID)
		}
	}
	// Primary down: the fallback keeps majors priced using their last known liquidity.
	cg.fail = true
	if _, err := p.RunOnce(ctx, true); err != nil {
		t.Fatal(err)
	}
	got, _ = prices.Get(ctx, rdb, []int64{eth, usdc})
	if got[usdc].Source != "alchemy" || got[usdc].Flag != "ok" || got[usdc].USD != 0.999 || got[eth].USD != 2999 {
		t.Fatalf("fallback %+v", got)
	}
	var ticks int
	st.Pool.QueryRow(ctx, `SELECT count(*) FROM price_ticks`).Scan(&ticks)
	if ticks < 4 {
		t.Fatalf("ticks %d", ticks)
	}
	if n, err := st.SnapshotBalances(ctx, time.Now()); err != nil || n != 5 {
		t.Fatalf("snapshot %d %v", n, err)
	}
}
