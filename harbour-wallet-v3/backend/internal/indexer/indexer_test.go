package indexer_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"math/big"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/nats-io/nats.go"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

const (
	A    = "0xaaaa000000000000000000000000000000000001" // the new wallet
	B    = "0xbbbb000000000000000000000000000000000002" // another tracked wallet
	X    = "0x9999000000000000000000000000000000000009"
	Y    = "0x8888000000000000000000000000000000000008"
	USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
	STE  = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84" // rebasing
	DISC = "0xdddd00000000000000000000000000000000000d" // held, no transfers in window
	SPAM = "0x5aa0000000000000000000000000000000000005"
	DEAD = "0xdead00000000000000000000000000000000dead" // balanceOf reverts
	NFTC = "0xc0c0000000000000000000000000000000000c0c"
)

func ev(block uint64, tx, ref, from, to, asset, amt string, kind index.Kind, details string) index.ActivityEvent {
	e := index.ActivityEvent{Chain: "base", Family: "evm", TxHash: tx, EventRef: ref, BlockNumber: block,
		BlockTime: time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(block) * time.Hour),
		From:      from, To: to, Asset: asset, AmountRaw: amt, Kind: kind}
	if details != "" {
		e.Details = json.RawMessage(details)
	}
	return e
}

// history for A, newest first. Sums of transfers deliberately do NOT equal
// chain balances (gas, rebasing): the indexer must use chain reads.
func history() []index.ActivityEvent {
	return []index.ActivityEvent{
		ev(20, "0xt7", "log:1", A, A, USDC, "1", index.KindToken, `{"symbol":"USDC","decimals":6}`), // self
		ev(18, "0xt6", "log:4", X, A, NFTC, "1", index.KindNFT, `{"token_id":"77"}`),
		ev(16, "0xt5", "log:2", X, A, SPAM, "1000", index.KindToken, `{"symbol":"Visit claim-usdc.com"}`),
		ev(15, "0xt4", "log:3", A, B, USDC, "10000000", index.KindToken, `{"symbol":"USDC","decimals":6}`),
		ev(14, "0xt3", "log:0", X, A, USDC, "50000000", index.KindToken, `{"symbol":"USDC","decimals":6}`),
		ev(14, "0xt3", "trace:0", X, A, "native", "5", index.KindInternal, ""), // second transfer in the same tx
		ev(12, "0xt2", "tx:0", A, Y, "native", "500000000000000000", index.KindNative, ""),
		ev(11, "0xt1", "log:7", X, A, STE, "100000000000000000000", index.KindToken, `{"symbol":"stETH","decimals":18}`),
		ev(10, "0xt0", "tx:0", X, A, "native", "1000000000000000000", index.KindNative, ""),
		// Old event (Jan 2025): its month partition must be created on demand.
		{Chain: "base", Family: "evm", TxHash: "0xold", EventRef: "tx:0", BlockNumber: 2, BlockTime: time.Date(2025, 1, 5, 0, 0, 0, 0, time.UTC),
			From: X, To: A, Asset: "native", AmountRaw: "1", Kind: index.KindNative},
	}
}

type fakeSource struct{ evs []index.ActivityEvent }

func (f *fakeSource) Name() string { return "fake" }
func (f *fakeSource) Subscribe(context.Context, string, []string, index.Handler) error {
	return nil
}
func (f *fakeSource) Backfill(_ context.Context, _, addr, _ string, lim index.BackfillLimits) (index.Page, error) {
	if addr != A {
		return index.Page{}, nil
	}
	var p index.Page
	for _, e := range f.evs {
		if lim.BeforeBlock > 0 && e.BlockNumber >= lim.BeforeBlock {
			continue
		}
		if lim.MaxTransfers > 0 && len(p.Events) >= lim.MaxTransfers {
			p.Capped = true
			break
		}
		p.Events = append(p.Events, e)
		if p.LastBlock < e.BlockNumber {
			p.LastBlock = e.BlockNumber
		}
		p.OldestBlock = e.BlockNumber
	}
	return p, nil
}
func (f *fakeSource) Since(context.Context, string, string, uint64, string) (index.Page, error) {
	return index.Page{}, nil
}

var nftItems = []index.NFT{
	{Contract: NFTC, TokenID: "77", Amount: "1", Standard: "erc721", Symbol: "CAT"},
	{Contract: NFTC, TokenID: "78", Amount: "1", Standard: "erc721", Symbol: "CAT"},
}

func (f *fakeSource) TokenContracts(context.Context, string, string) ([]string, error) {
	return []string{DISC, DEAD}, nil
}
func (f *fakeSource) NFTs(context.Context, string, string, string) (index.NFTPage, error) {
	return index.NFTPage{Items: nftItems, AsOfBlock: 100}, nil
}

// fakeChain is "the chain": these are the true balances at block 100.
type fakeChain struct {
	mu        sync.Mutex
	block     uint64
	bal       map[string]string
	hashes    map[uint64]string          // canonical block hashes ("" = unknown)
	inclusion map[string]chain.Inclusion // tx -> where it is now (missing = not found)
}

func (c *fakeChain) Inclusion(_ context.Context, tx string) (chain.Inclusion, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.inclusion[tx], nil
}
func (c *fakeChain) BlockHash(_ context.Context, n uint64) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.hashes[n], nil
}

func (c *fakeChain) Family() chain.Family { return chain.FamilyEVM }
func (c *fakeChain) Chain() string        { return "base" }
func (c *fakeChain) LatestBlock(context.Context) (uint64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.block, nil
}
func (c *fakeChain) Balances(_ context.Context, addr string, refs []string, block uint64) ([]chain.Balance, uint64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if block == 0 {
		block = c.block
	}
	get := func(ref string) chain.Balance {
		if ref == DEAD {
			return chain.Balance{AssetRef: ref, Failed: true}
		}
		v, _ := new(big.Int).SetString(c.bal[addr+"|"+ref], 10)
		if v == nil {
			v = new(big.Int)
		}
		return chain.Balance{AssetRef: ref, AmountRaw: v}
	}
	out := []chain.Balance{get("native")}
	for _, r := range refs {
		out = append(out, get(r))
	}
	return out, block, nil
}
func (c *fakeChain) TokenInfo(_ context.Context, refs []string) ([]chain.TokenInfo, error) {
	var out []chain.TokenInfo
	for _, r := range refs {
		ti := chain.TokenInfo{AssetRef: r, Symbol: "TKN", Name: "Token", Decimals: 18}
		switch r {
		case SPAM:
			ti = chain.TokenInfo{AssetRef: r, Symbol: "Visit claim-usdc.com", Name: "Claim rewards", Decimals: 18}
		case DEAD:
			ti = chain.TokenInfo{AssetRef: r, Decimals: -1, Failed: true}
		}
		out = append(out, ti)
	}
	return out, nil
}
func (c *fakeChain) Fees(context.Context) (chain.Fees, error)          { return chain.Fees{}, nil }
func (c *fakeChain) Nonce(context.Context, string) (uint64, error)     { return 0, nil }
func (c *fakeChain) Broadcast(context.Context, []byte) (string, error) { return "", nil }
func (c *fakeChain) Simulate(context.Context, map[string]any) (chain.SimulationResult, error) {
	return chain.SimulationResult{}, nil
}

type finality struct{}

func (finality) FinalizedBlock(context.Context) (uint64, error) { return 13, nil }
func (finality) Classify(b, latest, fin uint64) chain.Finality {
	if b <= fin {
		return chain.Finalized
	}
	return chain.Confirmed
}

func startNATS(t *testing.T) string {
	opts := &natsserver.Options{Port: -1, JetStream: true, StoreDir: t.TempDir(), NoLog: true, NoSigs: true}
	ns, err := natsserver.NewServer(opts)
	if err != nil {
		t.Fatal(err)
	}
	go ns.Start()
	if !ns.ReadyForConnections(5 * time.Second) {
		t.Fatal("nats not ready")
	}
	t.Cleanup(ns.Shutdown)
	return ns.ClientURL()
}

// Phase 3 exit test: a new wallet's balances match the chain exactly,
// including a rebasing token and the native balance after gas.
func TestNewWalletMatchesChain(t *testing.T) {
	pgURL := testdb.URL(t, "indexer_wallet")
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.UpsertChains(ctx, map[string]string{"base": "evm"}))
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	natsURL := startNATS(t)
	bus, err := events.Connect(ctx, natsURL, "test", log)
	must(t, err)
	defer bus.Close()
	nc, _ := nats.Connect(natsURL)
	defer nc.Close()
	var bcMu sync.Mutex
	var balanceMsgs []indexer.BalanceChanged
	sub, _ := nc.Subscribe("balance.changed.base", func(m *nats.Msg) {
		var bc indexer.BalanceChanged
		json.Unmarshal(m.Data, &bc)
		bcMu.Lock()
		balanceMsgs = append(balanceMsgs, bc)
		bcMu.Unlock()
	})
	defer sub.Unsubscribe()

	truth := map[string]string{
		A + "|native":  "497900000000000000",    // 1 - 0.5 ETH - gas
		A + "|" + STE:  "100370000000000000000", // rebased up from 100
		A + "|" + USDC: "40000000",
		A + "|" + DISC: "7",
		A + "|" + SPAM: "1000",
		B + "|native":  "0",
		B + "|" + USDC: "10000000",
	}
	fc := &fakeChain{block: 100, bal: truth}
	src := &fakeSource{evs: history()}
	cfg := config.Indexer{BackfillMaxTransfers: 5000, OlderPageTransfers: 1000, RefreshDebounce: 50 * time.Millisecond,
		IdleSweepAfter: time.Hour, NFTMaxPages: 10, Workers: 1}
	ix := indexer.New(st, cfg, bus, map[string]*indexer.Chain{"base": {Name: "base", Family: "evm",
		Native: config.Native{Symbol: "ETH", Decimals: 18}, Client: fc, Finality: finality{}, Source: src, Holdings: src}}, log)

	// Two devices track A and B (the API path).
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	d1, err := st.CreateDevice(ctx, []byte(strings.Repeat("1", 32)), "default", nil)
	must(t, err)
	d2, err := st.CreateDevice(ctx, []byte(strings.Repeat("2", 32)), "default", nil)
	must(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, d1.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, d2.ID, []store.AddressRef{{Chain: "base", Address: B}}, nil, 50)
	must(t, err)

	runAll := func() {
		for {
			ran, err := ix.RunOneBackfill(ctx)
			must(t, err)
			if !ran {
				return
			}
		}
	}
	runAll()
	ix.Flush(ctx) // B's refresh was triggered by A's backfill

	idA, _ := st.TrackedID(ctx, "base", A)
	idB, _ := st.TrackedID(ctx, "base", B)
	got := balances(t, st, idA)
	want := map[string]string{"native": truth[A+"|native"], STE: truth[A+"|"+STE], USDC: truth[A+"|"+USDC], DISC: "7", SPAM: "1000"}
	for ref, w := range want {
		if got[ref] != w {
			t.Errorf("balance %s = %q, chain says %q", ref, got[ref], w)
		}
	}
	if _, ok := got[DEAD]; ok {
		t.Error("a reverting balanceOf must not be stored as zero")
	}
	if got := balances(t, st, idB); got[USDC] != "10000000" {
		t.Errorf("B balance %v", got)
	}

	// Facts: every event stored once, activity for both tracked parties.
	var nTransfers, nKeys int
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM transfers`).Scan(&nTransfers))
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM event_keys`).Scan(&nKeys))
	if nTransfers != len(history()) {
		t.Fatalf("transfers %d want %d", nTransfers, len(history()))
	}
	dir := func(id int64, tx string) string {
		var d string
		_ = st.Pool.QueryRow(ctx, `SELECT direction FROM address_activity WHERE tracked_address_id=$1 AND tx_hash=$2`, id, tx).Scan(&d)
		return d
	}
	var n0xt3 int
	must(t, st.Pool.QueryRow(ctx, `SELECT jsonb_array_length(summary->'transfers') FROM address_activity WHERE tracked_address_id=$1 AND tx_hash='0xt3'`, idA).Scan(&n0xt3))
	if n0xt3 != 2 {
		t.Fatalf("activity for a tx with two transfers has %d items", n0xt3)
	}
	if dir(idA, "0xt4") != "out" || dir(idB, "0xt4") != "in" || dir(idA, "0xt7") != "self" || dir(idA, "0xt3") != "in" {
		t.Fatalf("directions: %s %s %s %s", dir(idA, "0xt4"), dir(idB, "0xt4"), dir(idA, "0xt7"), dir(idA, "0xt3"))
	}
	var fin string
	must(t, st.Pool.QueryRow(ctx, `SELECT finality FROM transfers WHERE tx_hash='0xt1'`).Scan(&fin))
	if fin != "finalized" {
		t.Fatalf("block 11 <= finalized 13 but finality=%s", fin)
	}
	var part bool
	must(t, st.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid WHERE i.inhparent='public.transfers'::regclass AND pg_get_expr(c.relpartbound,c.oid) LIKE 'FOR VALUES FROM (''2025-01-%')`).Scan(&part))
	var inDefault int
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM transfers_default`).Scan(&inDefault))
	if !part || inDefault != 0 {
		t.Fatalf("old month partition created=%v, rows in default=%d", part, inDefault)
	}

	// Spam and metadata.
	var spam int
	must(t, st.Pool.QueryRow(ctx, `SELECT spam_score FROM assets WHERE asset_ref=$1`, SPAM).Scan(&spam))
	var usdcSpam int
	must(t, st.Pool.QueryRow(ctx, `SELECT spam_score FROM assets WHERE asset_ref=$1`, USDC).Scan(&usdcSpam))
	if spam < 50 || usdcSpam >= 50 {
		t.Fatalf("spam scores: spam=%d usdc=%d", spam, usdcSpam)
	}

	// NFTs.
	var nfts int
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM nft_holdings WHERE tracked_address_id=$1`, idA).Scan(&nfts))
	if nfts != 2 {
		t.Fatalf("nft holdings %d", nfts)
	}

	// Tracking state.
	j, err := st.GetTracked(ctx, idA)
	must(t, err)
	if j.BackfillState != "done" || j.SyncedTo == nil || *j.SyncedTo != 100 || !j.HistoryComplete {
		t.Fatalf("tracked state %+v", j)
	}

	// Replaying the whole backfill changes nothing (event_keys dedupe).
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_state='pending'`)
	must(t, err)
	runAll()
	var n2, k2 int
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM transfers`).Scan(&n2))
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM event_keys`).Scan(&k2))
	var actItems int
	must(t, st.Pool.QueryRow(ctx, `SELECT sum(jsonb_array_length(summary->'transfers')) FROM address_activity`).Scan(&actItems))
	if n2 != nTransfers || k2 != nKeys || actItems != 11 {
		t.Fatalf("replay changed facts: transfers %d->%d keys %d->%d activity items %d", nTransfers, n2, nKeys, k2, actItems)
	}

	// An older read can't overwrite a newer balance.
	var usdcID int64
	must(t, st.Pool.QueryRow(ctx, `SELECT id FROM assets WHERE asset_ref=$1`, USDC).Scan(&usdcID))
	changed, err := st.UpsertBalances(ctx, idA, 99, []store.BalanceRow{{AssetID: usdcID, AssetRef: USDC, AmountRaw: "1"}})
	must(t, err)
	if len(changed) != 0 || balances(t, st, idA)[USDC] != "40000000" {
		t.Fatal("older block overwrote a newer balance")
	}

	// A rebase moves the chain balance; a refresh picks it up and publishes the new state.
	fc.mu.Lock()
	fc.block = 101
	fc.bal[A+"|"+STE] = "100380000000000000000"
	fc.mu.Unlock()
	must(t, ix.RefreshBalances(ctx, idA, nil))
	if balances(t, st, idA)[STE] != "100380000000000000000" {
		t.Fatal("rebase not picked up")
	}
	deadline := time.Now().Add(3 * time.Second)
	for {
		bcMu.Lock()
		var last *indexer.BalanceChanged
		for i := range balanceMsgs {
			if balanceMsgs[i].AsOfBlock == 101 {
				last = &balanceMsgs[i]
			}
		}
		bcMu.Unlock()
		if last != nil {
			if len(last.Balances) != 1 || last.Balances[0].AssetRef != STE || last.Address != A {
				t.Fatalf("balance.changed %+v", last)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no balance.changed for block 101")
		}
		time.Sleep(20 * time.Millisecond)
	}

	// An NFT sold: the next sync drops it.
	nftItems = nftItems[:1]
	must(t, ix.SyncNFTs(ctx, &indexer.Chain{Name: "base", Holdings: src}, idA, A))
	must(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM nft_holdings WHERE tracked_address_id=$1`, idA).Scan(&nfts))
	if nfts != 1 {
		t.Fatalf("nft holdings after sale %d", nfts)
	}
}

// The cap stops a backfill early; older pages load on demand afterwards.
func TestCappedBackfillAndOlderPages(t *testing.T) {
	pgURL := testdb.URL(t, "indexer_older")
	ctx := context.Background()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.UpsertChains(ctx, map[string]string{"base": "evm"}))
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	src := &fakeSource{evs: history()}
	fc := &fakeChain{block: 100, bal: map[string]string{}}
	cfg := config.Indexer{BackfillMaxTransfers: 4, OlderPageTransfers: 3, RefreshDebounce: time.Second, NFTMaxPages: 1, Workers: 1}
	ix := indexer.New(st, cfg, events.Log{L: log}, map[string]*indexer.Chain{"base": {Name: "base", Family: "evm",
		Native: config.Native{Symbol: "ETH", Decimals: 18}, Client: fc, Source: src}}, log)
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	d, _ := st.CreateDevice(ctx, []byte(strings.Repeat("3", 32)), "default", nil)
	_, _, err = st.AddDeviceAddresses(ctx, lc, d.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	ran, err := ix.RunOneBackfill(ctx)
	must(t, err)
	if !ran {
		t.Fatal("nothing claimed")
	}
	id, _ := st.TrackedID(ctx, "base", A)
	j, _ := st.GetTracked(ctx, id)
	if j.BackfillState != "capped" || j.HistoryComplete || j.HistoryFrom == nil || *j.HistoryFrom != 15 {
		t.Fatalf("after capped backfill: %+v from=%v", j, j.HistoryFrom)
	}
	for i := 0; i < 5; i++ {
		must(t, ix.LoadOlder(ctx, id))
	}
	j, _ = st.GetTracked(ctx, id)
	var n int
	st.Pool.QueryRow(ctx, `SELECT count(*) FROM transfers`).Scan(&n)
	if !j.HistoryComplete || n != len(history()) {
		t.Fatalf("older pages: complete=%v transfers=%d", j.HistoryComplete, n)
	}
}

func balances(t *testing.T, st *store.Store, id int64) map[string]string {
	t.Helper()
	bs, err := st.Balances(context.Background(), id)
	must(t, err)
	out := map[string]string{}
	keys := []string{}
	for _, b := range bs {
		out[b.AssetRef] = b.AmountRaw
		keys = append(keys, b.AssetRef)
	}
	sort.Strings(keys)
	return out
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
