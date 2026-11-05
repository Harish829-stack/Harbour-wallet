package store_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

func open(t *testing.T, name string) (*store.Store, context.Context) {
	t.Helper()
	url := testdb.URL(t, name)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	st, err := store.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	if _, err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertChains(ctx, map[string]string{"base": "evm"}); err != nil {
		t.Fatal(err)
	}
	return st, ctx
}

func ok(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

const (
	aliceAddr = "0xa11ce00000000000000000000000000000000001"
	bobAddr   = "0xb0b0000000000000000000000000000000000002"
	carolAddr = "0xca401000000000000000000000000000000000003"
)

// Gap-fill scopes: unsubscribed addresses every pass, subscribed ones only when active/new, everything for GapAll.
func TestGapFillScopes(t *testing.T) {
	st, ctx := open(t, "store_gapscope")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("d", 32)), "default", nil)
	ok(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr},
		{Chain: "base", Address: bobAddr}, {Chain: "base", Address: carolAddr}}, nil, 10)
	ok(t, err)
	// alice: no webhook. bob: webhook, idle and old. carol: webhook, active in the last hour.
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_state='done', last_seen_block=10, created_at=now()-interval '30 days'`)
	ok(t, err)
	_, err = st.Pool.Exec(ctx, `INSERT INTO webhooks (id, source, chain_id, url, enc_signing_key, address_count) VALUES ('wh','alchemy','base','https://x','\x00',2)`)
	ok(t, err)
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET webhook_id='wh' WHERE address IN ($1,$2)`, bobAddr, carolAddr)
	ok(t, err)
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET last_activity_at=now()-interval '1 hour' WHERE address=$1`, carolAddr)
	ok(t, err)
	got := func(scope store.GapScope) []string {
		rows, err := st.GapFillCandidates(ctx, "base", scope, 24*time.Hour, 0, 100)
		ok(t, err)
		var out []string
		for _, r := range rows {
			out = append(out, r.Address)
		}
		return out
	}
	if a := got(store.GapUnsubscribed); len(a) != 1 || a[0] != aliceAddr {
		t.Fatalf("unsubscribed %v", a)
	}
	if a := got(store.GapActive); len(a) != 1 || a[0] != carolAddr {
		t.Fatalf("active %v", a)
	}
	if a := got(store.GapAll); len(a) != 3 {
		t.Fatalf("all %v", a)
	}
}

// Batched ingest keeps the old semantics: dedupe across and within calls, one transactions row per tx, one activity
// row per tracked party (self transfers once), incoming list for push.
func TestIngestEventsBatched(t *testing.T) {
	st, ctx := open(t, "store_ingest")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("e", 32)), "default", nil)
	ok(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr}, {Chain: "base", Address: bobAddr}}, nil, 10)
	ok(t, err)
	now := time.Now().UTC().Truncate(time.Second)
	usdc := "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
	det, _ := json.Marshal(map[string]any{index.DetailSymbol: "USDC", index.DetailDecimals: 6})
	ev := func(tx, ref, from, to, asset string, kind index.Kind, d json.RawMessage) index.ActivityEvent {
		return index.ActivityEvent{Chain: "base", Family: "evm", TxHash: tx, EventRef: ref, BlockNumber: 100, BlockHash: "0xbh",
			BlockTime: now, From: from, To: to, Asset: asset, AmountRaw: "5", Kind: kind, Details: d}
	}
	evs := []index.ActivityEvent{
		ev("0xt1", "log:1", carolAddr, aliceAddr, usdc, index.KindToken, det),        // incoming token
		ev("0xt1", "log:2", aliceAddr, bobAddr, usdc, index.KindToken, det),          // same tx, alice -> bob
		ev("0xt2", "trace:0", aliceAddr, aliceAddr, "native", index.KindNative, nil), // self transfer
		ev("0xt1", "log:1", carolAddr, aliceAddr, usdc, index.KindToken, det),        // duplicate inside the call
	}
	opts := store.IngestOptions{Chain: "base", Family: "evm", NativeSym: "ETH", NativeDec: 18, Assets: store.NewAssetCache()}
	res, err := st.IngestEvents(ctx, opts, evs)
	ok(t, err)
	if res.New != 3 || res.Duplicates != 1 {
		t.Fatalf("new %d dup %d", res.New, res.Duplicates)
	}
	if len(res.Incoming) != 2 { // alice gets USDC in t1, bob gets USDC in t1
		t.Fatalf("incoming %+v", res.Incoming)
	}
	count := func(q string, args ...any) int {
		var n int
		ok(t, st.Pool.QueryRow(ctx, q, args...).Scan(&n))
		return n
	}
	if n := count(`SELECT count(*) FROM transfers`); n != 3 {
		t.Fatalf("transfers %d", n)
	}
	if n := count(`SELECT count(*) FROM transactions`); n != 2 {
		t.Fatalf("transactions %d", n)
	}
	if n := count(`SELECT count(*) FROM address_activity`); n != 3 { // alice t1, bob t1, alice t2
		t.Fatalf("activity rows %d", n)
	}
	var dir string
	ok(t, st.Pool.QueryRow(ctx, `SELECT a.direction FROM address_activity a JOIN tracked_addresses t ON t.id=a.tracked_address_id
		WHERE t.address=$1 AND a.tx_hash='0xt1'`, aliceAddr).Scan(&dir))
	if dir != "out" { // received in log:1 and sent in log:2 of the same tx
		t.Fatalf("alice t1 direction %s", dir)
	}
	ok(t, st.Pool.QueryRow(ctx, `SELECT a.direction FROM address_activity a JOIN tracked_addresses t ON t.id=a.tracked_address_id
		WHERE t.address=$1 AND a.tx_hash='0xt2'`, aliceAddr).Scan(&dir))
	if dir != "self" {
		t.Fatalf("self direction %s", dir)
	}
	if n := count(`SELECT jsonb_array_length(summary->'transfers') FROM address_activity a JOIN tracked_addresses t ON t.id=a.tracked_address_id
		WHERE t.address=$1 AND a.tx_hash='0xt1'`, aliceAddr); n != 2 {
		t.Fatalf("alice t1 summary items %d", n)
	}
	// Replaying the whole call changes nothing.
	res, err = st.IngestEvents(ctx, opts, evs)
	ok(t, err)
	if res.New != 0 || res.Duplicates != 4 || count(`SELECT count(*) FROM transfers`) != 3 {
		t.Fatalf("replay new %d dup %d", res.New, res.Duplicates)
	}
}

// Old price ticks thin to hourly then daily; recent ones stay; snapshots past a year are dropped.
func TestPruneTimeSeries(t *testing.T) {
	st, ctx := open(t, "store_prune")
	id, err := st.UpsertAsset(ctx, st.Pool, nil, store.AssetInput{Chain: "base", Ref: "native", Kind: "native", Verified: true})
	ok(t, err)
	ins := func(ago string, n int) {
		_, err := st.Pool.Exec(ctx, `INSERT INTO price_ticks (asset_id, ts, price_usd)
			SELECT $1, date_trunc('hour', now() - $2::interval) + make_interval(mins => g*5), 1 + g FROM generate_series(0, $3 - 1) g`, id, ago, n)
		ok(t, err)
	}
	ins("1 day", 12)   // one hour of 5-minute ticks, recent: kept
	ins("30 days", 12) // one hour, older than a week: thinned to 1
	ins("200 days", 12)
	ins("201 days", 12) // two hours on (most likely) the same day past 90 days: thinned to 1 per day
	ticks, _, err := st.PruneTimeSeries(ctx)
	ok(t, err)
	var left int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM price_ticks`).Scan(&left))
	if ticks == 0 || left != 15 {
		t.Fatalf("pruned %d, left %d", ticks, left)
	}
	var last float64
	ok(t, st.Pool.QueryRow(ctx, `SELECT price_usd FROM price_ticks WHERE ts < now() - interval '7 days' AND ts > now() - interval '90 days'`).Scan(&last))
	if last != 12 { // the hour keeps its last tick
		t.Fatalf("kept tick %v", last)
	}
}
