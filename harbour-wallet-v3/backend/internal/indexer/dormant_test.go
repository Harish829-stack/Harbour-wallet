package indexer_test

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

const D = "0xd0d0000000000000000000000000000000000004" // never used on this chain

// dormantSource lists history for A always and for D only once D becomes active.
type dormantSource struct {
	fakeSource
	mu       sync.Mutex
	dActive  bool
	probes   int
	backfill map[string]int
}

func (s *dormantSource) HasIncoming(_ context.Context, _, addr string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.probes++
	return addr == A || (addr == D && s.dActive), nil
}

func (s *dormantSource) dEvents() []index.ActivityEvent {
	return []index.ActivityEvent{ev(250, "0xd1", "log:1", X, D, USDC, "7000000", index.KindToken, `{"symbol":"USDC","decimals":6}`)}
}

func (s *dormantSource) Backfill(ctx context.Context, chain, addr, cursor string, lim index.BackfillLimits) (index.Page, error) {
	s.mu.Lock()
	s.backfill[addr]++
	active := s.dActive
	s.mu.Unlock()
	if addr == D {
		if !active {
			return index.Page{}, nil
		}
		return index.Page{Events: s.dEvents(), LastBlock: 250, OldestBlock: 250}, nil
	}
	return s.fakeSource.Backfill(ctx, chain, addr, cursor, lim)
}

func (s *dormantSource) Since(_ context.Context, _, addr string, from uint64, _ string) (index.Page, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if addr == D && s.dActive && from < 250 {
		return index.Page{Events: s.dEvents()}, nil
	}
	return index.Page{}, nil
}

// An address never used on a chain is not backfilled (dormant, zero native balance recorded); its first activity
// promotes it to a normal backfill. NFTs are listed on demand, not during backfill.
func TestDormantAddressAndLazyNFTs(t *testing.T) {
	pgURL := testdb.URL(t, "indexer_dormant")
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.UpsertChains(ctx, map[string]string{"base": "evm"}))
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	bus, err := events.Connect(ctx, startNATS(t), "test", log)
	must(t, err)
	defer bus.Close()

	fc := &fakeChain{block: 100, bal: map[string]string{A + "|native": "5", A + "|" + USDC: "1", D + "|" + USDC: "7000000"}}
	src := &dormantSource{fakeSource: fakeSource{evs: history()}, backfill: map[string]int{}}
	c := &indexer.Chain{Name: "base", Family: "evm", Native: config.Native{Symbol: "ETH", Decimals: 18}, Client: fc,
		Finality: finality{}, Source: src, Holdings: src, BlockTime: 2 * time.Second}
	cfg := config.Indexer{BackfillMaxTransfers: 5000, OlderPageTransfers: 100, RefreshDebounce: 20 * time.Millisecond,
		IdleSweepAfter: time.Hour, NFTMaxPages: 1, Workers: 1, DormantProbe: true}
	ix := indexer.New(st, cfg, bus, map[string]*indexer.Chain{"base": c}, log)

	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("7", 32)), "default", nil)
	must(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}, {Chain: "base", Address: D}}, nil, 50)
	must(t, err)
	for {
		ran, err := ix.RunOneBackfill(ctx)
		must(t, err)
		if !ran {
			break
		}
	}
	ix.Flush(ctx)
	idA, _ := st.TrackedID(ctx, "base", A)
	idD, _ := st.TrackedID(ctx, "base", D)
	jA, _ := st.GetTracked(ctx, idA)
	jD, _ := st.GetTracked(ctx, idD)
	if jA.BackfillState != "done" || jD.BackfillState != "dormant" {
		t.Fatalf("states A=%s D=%s", jA.BackfillState, jD.BackfillState)
	}
	if src.backfill[D] != 0 {
		t.Fatal("dormant address was backfilled")
	}
	if b := balances(t, st, idD); b["native"] != "0" || len(b) != 1 {
		t.Fatalf("dormant balances %v", b)
	}
	// NFTs are not listed during backfill; the API flags the list stale and the indexer syncs it on request.
	count := func(q string, args ...any) int {
		var n int
		must(t, st.Pool.QueryRow(ctx, q, args...).Scan(&n))
		return n
	}
	if n := count(`SELECT count(*) FROM nft_holdings WHERE tracked_address_id=$1`, idA); n != 0 {
		t.Fatalf("nfts listed during backfill: %d", n)
	}
	states, err := st.TrackedStates(ctx, []int64{idA})
	must(t, err)
	if !states[0].NFTDirty {
		t.Fatal("new address NFT list should be marked stale")
	}
	must(t, ix.SyncNFTsByID(ctx, idA))
	if n := count(`SELECT count(*) FROM nft_holdings WHERE tracked_address_id=$1`, idA); n != len(nftItems) {
		t.Fatalf("nfts after on-demand sync: %d", n)
	}
	states, _ = st.TrackedStates(ctx, []int64{idA})
	if states[0].NFTDirty {
		t.Fatal("sync did not clear the stale flag")
	}

	// Dormant addresses are left out of the routine gap-fill passes...
	fc.mu.Lock()
	fc.block = 300
	fc.mu.Unlock()
	src.mu.Lock()
	src.dActive = true
	src.mu.Unlock()
	must(t, ix.GapFill(ctx, store.GapAll, false))
	if j, _ := st.GetTracked(ctx, idD); j.BackfillState != "dormant" {
		t.Fatalf("routine pass touched the dormant address: %s", j.BackfillState)
	}
	// ...but a pass that includes them (no webhook / after downtime) sees the first activity and promotes D.
	must(t, ix.GapFill(ctx, store.GapAll, true))
	if j, _ := st.GetTracked(ctx, idD); j.BackfillState != "pending" {
		t.Fatalf("first activity did not promote: %s", j.BackfillState)
	}
	ran, err := ix.RunOneBackfill(ctx)
	must(t, err)
	if !ran {
		t.Fatal("promoted address not backfilled")
	}
	ix.Flush(ctx)
	if j, _ := st.GetTracked(ctx, idD); j.BackfillState != "done" {
		t.Fatalf("after promotion: %s", j.BackfillState)
	}
	if b := balances(t, st, idD); b[USDC] != "7000000" {
		t.Fatalf("promoted balances %v", b)
	}
}
