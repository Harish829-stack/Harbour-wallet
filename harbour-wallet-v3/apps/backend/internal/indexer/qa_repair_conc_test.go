package indexer_test

// QA (be-int, T-IDX-054): Repair runs in a loop while 40 live webhook deliveries are ingested for the same chain. No repair pass
// fails (deadlock/serialisation), every live event survives, and the orphaned one is removed.
// (Repair is not serialised with ingest by a lock; correctness relies on per-transaction statements — this test checks the outcome.)

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"sync"
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

func TestQARepairConcurrentWithLiveIngest(t *testing.T) {
	pgURL := testdb.URL(t, "indexer_qa_repair_conc")
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

	hook := recv.URL + "/webhooks/alchemy"
	// An orphan to be removed by repair while new events stream in.
	if code := post(t, hook, "whsec_1", deliveryBody("wh_1", "whevt_o", hookActivity(1001, "0xorphan", 1, 1_000_000, "0xh1001", false))); code != 200 {
		t.Fatalf("delivery %d", code)
	}
	waitUntil(t, "orphan stored", func() bool { return count(`SELECT count(*) FROM transfers`) == 1 })
	fc.mu.Lock()
	fc.block = 1100
	fc.hashes[1001] = "0xreorged"
	for b := uint64(1010); b < 1090; b++ {
		fc.hashes[b] = fmt.Sprintf("0xh%d", b)
	}
	fc.mu.Unlock()
	fin = 1000
	var wg sync.WaitGroup
	errs := make(chan error, 100)
	stopRepair := make(chan struct{})
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stopRepair:
				return
			default:
			}
			if err := ix.Repair(ctx, c); err != nil {
				errs <- err
			}
		}
	}()
	for i := 0; i < 40; i++ {
		b := uint64(1010 + i*2)
		body := deliveryBody("wh_1", fmt.Sprintf("whevt_%d", i), hookActivity(b, fmt.Sprintf("0xlive%02d", i), 1, int64(1000+i), fmt.Sprintf("0xh%d", b), false))
		if code := post(t, hook, "whsec_1", body); code != 200 {
			t.Fatalf("delivery %d: %d", i, code)
		}
	}
	waitUntil(t, "40 live transfers", func() bool {
		return count(`SELECT count(*) FROM transfers WHERE hb_ref_text(tx_hash) LIKE '0xlive%'`) == 40
	})
	close(stopRepair)
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("repair failed while ingest ran: %v", err)
	}
	must(t, ix.Repair(ctx, c))
	if count(`SELECT count(*) FROM transfers WHERE tx_hash=hb_ref('0xorphan')`) != 0 {
		t.Fatal("orphan not removed")
	}
	if n := count(`SELECT count(*) FROM transfers WHERE hb_ref_text(tx_hash) LIKE '0xlive%'`); n != 40 {
		t.Fatalf("%d of 40 live transfers survived concurrent repair", n)
	}
	if count(`SELECT count(*) FROM event_keys`) < 40 {
		t.Fatal("event keys lost")
	}
	_ = idA
}
