package store_test

// QA performance test (TEST_PLAN T-IDX-050, IDX-11..24): 10,000 tracked addresses, 1,000,000 transfers and 1,000,000 activity rows
// (100 per address). Checks the history page query and an ingest batch against that volume, and that the plans use the indexes
// (address_activity_page for history, transfers_hash for a tx lookup) instead of scanning.
// Opt-in: HB_QA_PERF=1 (needs HB_TEST_POSTGRES_URL; loading takes about a minute). HB_QA_PAGE_P95_MS overrides the 50 ms bound.

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/store"
)

func qaPlan(t *testing.T, st *store.Store, ctx context.Context, q string) string {
	t.Helper()
	rows, err := st.Pool.Query(ctx, "EXPLAIN "+q)
	ok(t, err)
	defer rows.Close()
	var lines []string
	for rows.Next() {
		var l string
		ok(t, rows.Scan(&l))
		lines = append(lines, l)
	}
	ok(t, rows.Err())
	return strings.Join(lines, "\n")
}

func TestQAPerfHistoryAndIngestAtScale(t *testing.T) {
	if os.Getenv("HB_QA_PERF") == "" {
		t.Skip("set HB_QA_PERF=1 to run the scale test")
	}
	p95Max := 50 * time.Millisecond
	if v, err := strconv.Atoi(os.Getenv("HB_QA_PAGE_P95_MS")); err == nil && v > 0 {
		p95Max = time.Duration(v) * time.Millisecond
	}
	st, _ := open(t, "qa_perf_scale")
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	ex := func(q string, args ...any) {
		t.Helper()
		if _, err := st.Pool.Exec(ctx, q, args...); err != nil {
			t.Fatalf("%v\n%s", err, q)
		}
	}
	ok(t, st.MaintainPartitions(ctx))

	t0 := time.Now()
	ex(`INSERT INTO tracked_addresses(chain_id, address, backfill_state)
	    SELECT 'base', '0x' || lpad(to_hex(g), 40, '0'), 'done' FROM generate_series(1, 10000) g`)
	var assetID int64
	ok(t, st.Pool.QueryRow(ctx, `INSERT INTO assets(chain_id, asset_ref, symbol, decimals, kind) VALUES ('base', '\x01aa'::bytea, 'QA', 18, 'token') RETURNING id`).Scan(&assetID))
	ex(`INSERT INTO address_activity(tracked_address_id, block_time, tx_hash, chain_id, direction, summary)
	    SELECT t.id, now() - make_interval(secs => g * 30), '\x01'::bytea || decode(md5(t.id::text || ':' || g::text) || md5(g::text || ':' || t.id::text), 'hex'),
	           'base', CASE WHEN g % 2 = 0 THEN 'in' ELSE 'out' END, '{"transfers":[]}'
	    FROM tracked_addresses t, generate_series(1, 100) g`)
	ex(`INSERT INTO transfers(chain_id, chain_family, tx_hash, event_ref, block_number, block_hash, block_time, asset_id, "from", "to", amount_raw, kind, finality)
	    SELECT 'base', 'evm', '\x01'::bytea || decode(md5(g::text) || md5('t' || g::text), 'hex'), 'log:0', 1000000 + g, '\x01'::bytea || decode(md5('b' || g::text) || md5('c' || g::text), 'hex'),
	           now() - make_interval(secs => g % 1700000), $1, '\x01'::bytea || decode(md5('f' || (g % 5000)::text), 'hex') || '\x00000000', '\x01'::bytea || decode(md5('o' || (g % 5000)::text), 'hex') || '\x00000000',
	           (g * 1000)::numeric, 'erc20', 'finalized'
	    FROM generate_series(1, 1000000) g`, assetID)
	ex(`ANALYZE`)
	t.Logf("loaded in %v", time.Since(t0).Round(time.Second))

	var nAct, nTr int64
	ok(t, st.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM address_activity), (SELECT count(*) FROM transfers)`).Scan(&nAct, &nTr))
	if nAct != 1_000_000 || nTr != 1_000_000 {
		t.Fatalf("loaded %d activity rows and %d transfers", nAct, nTr)
	}
	idRows, err := st.Pool.Query(ctx, `SELECT id FROM tracked_addresses ORDER BY id`)
	ok(t, err)
	var ids []int64
	for idRows.Next() {
		var id int64
		ok(t, idRows.Scan(&id))
		ids = append(ids, id)
	}
	idRows.Close()

	// History pages: a one-address device and a 20-address device, first page and a cursor page.
	rng := rand.New(rand.NewSource(1))
	var lats []time.Duration
	for i := 0; i < 300; i++ {
		set := []int64{ids[rng.Intn(len(ids))]}
		if i%2 == 1 {
			set = set[:0]
			for len(set) < 20 {
				set = append(set, ids[rng.Intn(len(ids))])
			}
		}
		t1 := time.Now()
		page, err := st.Activity(ctx, set, nil, 50)
		ok(t, err)
		if len(page) == 0 {
			t.Fatalf("empty first page for %v", set)
		}
		if i%3 == 0 {
			last := page[len(page)-1]
			page2, err := st.Activity(ctx, set, &store.ActivityCursor{BlockTime: last.BlockTime, TxHash: last.TxHash, TrackedID: last.TrackedID}, 50)
			ok(t, err)
			if len(page2) > 0 && !page2[0].BlockTime.Before(last.BlockTime) && page2[0].TxHash == last.TxHash {
				t.Fatalf("cursor page repeats the last row")
			}
		}
		lats = append(lats, time.Since(t1))
	}
	sort.Slice(lats, func(a, b int) bool { return lats[a] < lats[b] })
	p95 := lats[int(float64(len(lats)-1)*.95)]
	t.Logf("history page: p50=%v p95=%v max=%v", lats[len(lats)/2], p95, lats[len(lats)-1])
	if p95 > p95Max {
		t.Errorf("history page p95 %v exceeds %v", p95, p95Max)
	}

	// Plans: no sequential scan of the big tables for the two hot queries.
	idList := fmt.Sprintf("ARRAY[%d,%d,%d]::bigint[]", ids[1], ids[500], ids[9000])
	histPlan := qaPlan(t, st, ctx, `SELECT aa.tracked_address_id, aa.block_time FROM address_activity aa WHERE aa.tracked_address_id = ANY(`+idList+`)
		ORDER BY aa.block_time DESC, aa.tx_hash DESC, aa.tracked_address_id DESC LIMIT 50`)
	if strings.Contains(histPlan, "Seq Scan on address_activity") || !strings.Contains(histPlan, "Index") {
		t.Errorf("history plan scans instead of using the activity index:\n%s", histPlan)
	}
	var hashText string
	ok(t, st.Pool.QueryRow(ctx, `SELECT hb_ref_text(tx_hash) FROM transfers WHERE block_number = 1500000`).Scan(&hashText))
	txPlan := qaPlan(t, st, ctx, fmt.Sprintf(`SELECT 1 FROM transfers WHERE chain_id = 'base' AND tx_hash = hb_ref('%s')`, hashText))
	// A tx hash carries no block time, so every partition is probed; empty partitions (cost 0.00..0.00) rightly use a trivial seq scan.
	// What must not happen is a seq scan of a partition that holds rows.
	bigSeq := false
	for _, l := range strings.Split(txPlan, "\n") {
		if strings.Contains(l, "Seq Scan on transfers") && !strings.Contains(l, "cost=0.00..0.00") {
			bigSeq = true
		}
	}
	if bigSeq || !strings.Contains(txPlan, "Index Only Scan using transfers_") && !strings.Contains(txPlan, "Index Scan using transfers_") {
		t.Errorf("tx lookup plan scans instead of using the tx hash index:\n%s", txPlan)
	}
	t.Logf("history plan:\n%s\ntx plan:\n%s", histPlan, txPlan)

	var tl []time.Duration
	for i := 0; i < 100; i++ {
		var h string
		ok(t, st.Pool.QueryRow(ctx, `SELECT hb_ref_text(tx_hash) FROM transfers WHERE block_number = $1`, 1000001+rng.Intn(1000000)).Scan(&h))
		t1 := time.Now()
		var n int
		ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM transfers t JOIN assets a ON a.id = t.asset_id WHERE t.chain_id='base' AND t.tx_hash=hb_ref($1)`, h).Scan(&n))
		if n != 1 {
			t.Fatalf("tx %s: %d transfers", h, n)
		}
		tl = append(tl, time.Since(t1))
	}
	sort.Slice(tl, func(a, b int) bool { return tl[a] < tl[b] })
	if p := tl[94]; p > p95Max {
		t.Errorf("tx transfers lookup p95 %v exceeds %v", p, p95Max)
	} else {
		t.Logf("tx transfers lookup p95=%v", p)
	}

	// Ingest batch: 500 new events for tracked addresses, then the same batch again (all duplicates).
	var addrs []string
	for _, i := range []int{1, 77, 1234, 4321, 9999} {
		addrs = append(addrs, fmt.Sprintf("0x%040x", i))
	}
	now := time.Now().UTC().Truncate(time.Second)
	var evs []index.ActivityEvent
	for i := 0; i < 500; i++ {
		evs = append(evs, index.ActivityEvent{Chain: "base", Family: "evm", TxHash: fmt.Sprintf("0x%064x", 9_000_000+i), EventRef: "log:0", BlockNumber: uint64(2_000_000 + i),
			BlockHash: fmt.Sprintf("0x%064x", 8_000_000+i), BlockTime: now, From: carolAddr, To: addrs[i%len(addrs)], Asset: "native", AmountRaw: "5", Kind: index.KindNative})
	}
	opts := store.IngestOptions{Chain: "base", Family: "evm", NativeSym: "ETH", NativeDec: 18, Assets: store.NewAssetCache()}
	t1 := time.Now()
	res, err := st.IngestEvents(ctx, opts, evs)
	ok(t, err)
	ing := time.Since(t1)
	if res.New != 500 || res.Duplicates != 0 {
		t.Fatalf("ingest: new=%d dup=%d", res.New, res.Duplicates)
	}
	t1 = time.Now()
	res, err = st.IngestEvents(ctx, opts, evs)
	ok(t, err)
	dup := time.Since(t1)
	if res.New != 0 || res.Duplicates != 500 {
		t.Fatalf("re-ingest: new=%d dup=%d", res.New, res.Duplicates)
	}
	t.Logf("ingest 500 events: new=%v duplicates=%v", ing, dup)
	if ing > 2*time.Second || dup > 2*time.Second {
		t.Errorf("ingest of 500 events took %v (duplicates %v), want < 2s", ing, dup)
	}
}
