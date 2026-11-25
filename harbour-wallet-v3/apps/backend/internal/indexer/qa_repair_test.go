package indexer_test

// QA: reorg repair in detail (T-IDX-024). Events arrive by webhook; then the fake chain changes block hashes / inclusion and
// Repair is run directly. Checked: a hash mismatch is removed only after 3 confirmations; a younger mismatch is kept and HOLDS
// finality promotion below it; a transaction re-mined at another block is moved there; removal refreshes the balance; rows are
// finalized only up to the last verified block.

import (
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	alchemysrc "harbour/backend/adapters/sources/alchemy"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/ingest"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

type finalityAt struct{ n *uint64 }

func (f finalityAt) FinalizedBlock(context.Context) (uint64, error) { return *f.n, nil }
func (f finalityAt) Classify(b, latest, fin uint64) chain.Finality {
	if b <= fin {
		return chain.Finalized
	}
	return chain.Confirmed
}

func TestQARepairConfirmationsHoldAndFinality(t *testing.T) {
	pgURL := testdb.URL(t, "indexer_qa_repair")
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
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
	fa := &fakeAlchemy{hooks: map[string][]string{}}
	alch := httptest.NewServer(fa)
	defer alch.Close()
	srcI, err := alchemysrc.New(index.SourceConfig{Name: "alchemy",
		Options: map[string]string{"base_url": alch.URL + "/{network}", "notify_base_url": alch.URL + "/notify"},
		Chains:  map[string]map[string]string{"base": {"network": "base-mainnet", "webhook_network": "BASE_MAINNET", "categories": "external,erc20"}},
		Getenv: func(k string) string {
			return map[string]string{"ALCHEMY_API_KEY": "k", "ALCHEMY_NOTIFY_TOKEN": "notify-token"}[k]
		}})
	must(t, err)
	src := srcI.(*alchemysrc.Source)
	fc := &fakeChain{block: 1003, bal: map[string]string{A + "|" + USDC: "0", A + "|native": "0"}, hashes: map[uint64]string{}, inclusion: map[string]chain.Inclusion{}}
	fin := uint64(900)
	box, _ := store.NewSecretBox([]byte(strings.Repeat("s", 32)), "webhook-signing-keys")
	c := &indexer.Chain{Name: "base", Family: "evm", Native: config.Native{Symbol: "ETH", Decimals: 18}, Client: fc,
		Finality: finalityAt{&fin}, Source: src, SourceName: "alchemy", Webhooks: src, BlockTime: 2 * time.Second}
	cfg := config.Indexer{BackfillMaxTransfers: 5000, OlderPageTransfers: 100, RefreshDebounce: 30 * time.Millisecond, IdleSweepAfter: time.Hour, NFTMaxPages: 1, Workers: 1}
	ix := indexer.New(st, cfg, bus, map[string]*indexer.Chain{"base": c}, log)
	ix.EnableLive(indexer.LiveOptions{PublicURL: "https://tunnel-one.example", Box: box, GapFillEvery: time.Hour, RepairEvery: time.Hour, ManageEvery: time.Hour,
		Probe: func(context.Context, string) error { return nil }, SettledRefresh: []time.Duration{}})
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, _ := st.CreateDevice(ctx, []byte(strings.Repeat("9", 32)), "default", nil)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	_, err = ix.RunOneBackfill(ctx)
	must(t, err)
	idA, _ := st.TrackedID(ctx, "base", A)
	_, err = st.Heartbeat(ctx, "indexer-safety-gapfill", time.Now())
	must(t, err)
	runCtx, stopRun := context.WithCancel(ctx)
	runDone := make(chan struct{})
	go func() { ix.Run(runCtx); close(runDone) }()
	defer func() { stopRun(); <-runDone }()
	must(t, ix.ManageWebhooks(ctx, c))
	in := ingest.New(ingest.Options{Store: st, Bus: bus, Log: log, Box: box, Sources: map[string]index.Webhooks{"alchemy": src}, KeyCacheTTL: 50 * time.Millisecond})
	must(t, in.Start(ctx))
	recv := httptest.NewServer(in.Handler())
	defer recv.Close()
	count := func(q string) int { var n int; must(t, st.Pool.QueryRow(ctx, q).Scan(&n)); return n }
	finality := func(tx string) string {
		var f string
		must(t, st.Pool.QueryRow(ctx, `SELECT finality::text FROM transfers WHERE tx_hash=hb_ref($1) LIMIT 1`, tx).Scan(&f))
		return f
	}

	fc.mu.Lock()
	fc.bal[A+"|"+USDC] = "6000000"
	fc.mu.Unlock()
	body := deliveryBody("wh_1", "whevt_1", hookActivity(1001, "0xa1", 1, 1_000_000, "0xh1001", false), hookActivity(1002, "0xa2", 1, 2_000_000, "0xh1002", false), hookActivity(1003, "0xa3", 1, 3_000_000, "0xh1003", false))
	if code := post(t, recv.URL+"/webhooks/alchemy", "whsec_1", body); code != 200 {
		t.Fatalf("delivery %d", code)
	}
	waitUntil(t, "3 transfers", func() bool { return count(`SELECT count(*) FROM transfers`) == 3 })
	waitUntil(t, "balance 6", func() bool { return balances(t, st, idA)[USDC] == "6000000" })

	// Pass 1 (head 1004, finalized head 1003): 0xa1's block hash changed and it has no receipt, 3 confirmations old → removed.
	// 0xa3's block hash also changed but it is only 1 block old → kept, and finality is held below it. 0xa2 still canonical.
	fc.mu.Lock()
	fc.block = 1004
	fc.hashes[1001], fc.hashes[1002], fc.hashes[1003] = "0xother1001", "0xh1002", "0xother1003"
	fc.bal[A+"|"+USDC] = "5000000" // the chain no longer credits 0xa1
	fc.mu.Unlock()
	fin = 1003
	must(t, ix.Repair(ctx, c))
	if count(`SELECT count(*) FROM transfers WHERE tx_hash=hb_ref('0xa1')`) != 0 {
		t.Fatal("0xa1 (orphaned, 3 confirmations) not removed")
	}
	if count(`SELECT count(*) FROM transfers WHERE tx_hash=hb_ref('0xa3')`) != 1 {
		t.Fatal("0xa3 (orphaned 1 block ago) removed too early")
	}
	if count(`SELECT count(*) FROM address_activity WHERE tx_hash=hb_ref('0xa1')`)+count(`SELECT count(*) FROM transactions WHERE tx_hash=hb_ref('0xa1')`) != 0 {
		t.Fatal("removed tx left activity / transaction rows")
	}
	if f := finality("0xa2"); f != "finalized" {
		t.Fatalf("0xa2 (verified canonical, ≤ the held limit 1002) finality %q", f)
	}
	if f := finality("0xa3"); f == "finalized" {
		t.Fatal("0xa3 finalized although its block hash no longer matches (held)")
	}
	waitUntil(t, "balance refreshed after removal", func() bool { return balances(t, st, idA)[USDC] == "5000000" })

	// Pass 2 (head 1010): 0xa3 was re-mined at block 1005 → moved there (block + hash), not removed; then finalized once ≤ head.
	fc.mu.Lock()
	fc.block = 1010
	fc.inclusion["0xa3"] = chain.Inclusion{Found: true, BlockNumber: 1005, BlockHash: "0xh1005", Success: true}
	fc.mu.Unlock()
	fin = 1004
	must(t, ix.Repair(ctx, c))
	var bn int64
	var bh string
	must(t, st.Pool.QueryRow(ctx, `SELECT block_number, hb_ref_text(block_hash) FROM transfers WHERE tx_hash=hb_ref('0xa3')`).Scan(&bn, &bh))
	if bn != 1005 || bh != "0xh1005" {
		t.Fatalf("re-mined tx not moved: block %d hash %s", bn, bh)
	}
	if f := finality("0xa3"); f == "finalized" {
		t.Fatal("0xa3 at 1005 finalized while the finalized head is 1004")
	}
	fc.mu.Lock()
	fc.hashes[1005] = "0xh1005"
	fc.mu.Unlock()
	fin = 1006
	must(t, ix.Repair(ctx, c))
	if f := finality("0xa3"); f != "finalized" {
		t.Fatalf("0xa3 not finalized after its block became final: %q", f)
	}
	// Nothing unfinalized left: a further pass (even with every block hash now unknown) changes nothing
	fc.mu.Lock()
	fc.hashes = map[uint64]string{}
	fc.mu.Unlock()
	must(t, ix.Repair(ctx, c))
	if count(`SELECT count(*) FROM transfers`) != 2 {
		t.Fatal("a pass with nothing to check changed rows")
	}
}
