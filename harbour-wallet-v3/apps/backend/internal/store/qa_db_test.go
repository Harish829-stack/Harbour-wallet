package store_test

// QA database suite against real Postgres (make test-integration).
// TEST_PLAN: T-DB-001, T-DB-003, T-DB-004, T-DB-005, T-DB-011, T-DB-013, T-DB-016, T-DB-017, T-DB-019, T-DB-023, T-IDX-015, T-IDX-053, T-DBO-001.

import (
	"context"
	"fmt"
	"io/fs"
	"math/rand"
	"net/url"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
	"harbour/backend/migrations"
)

func migrationVersions(t *testing.T) []string {
	names, err := fs.Glob(migrations.FS, "*.sql")
	ok(t, err)
	sort.Strings(names)
	var v []string
	for _, n := range names {
		v = append(v, strings.TrimSuffix(n, ".sql"))
	}
	return v
}

// T-DB-001 / T-DBO-001: a fresh database gets every migration once and every expected object.
func TestQAFreshSchemaHasEveryObject(t *testing.T) {
	st, ctx := open(t, "qa_schema")
	var applied []string
	rows, err := st.Pool.Query(ctx, `SELECT version FROM schema_migrations ORDER BY version`)
	ok(t, err)
	for rows.Next() {
		var v string
		ok(t, rows.Scan(&v))
		applied = append(applied, v)
	}
	if strings.Join(applied, ",") != strings.Join(migrationVersions(t), ",") {
		t.Fatalf("applied %v", applied)
	}
	again, err := st.Migrate(ctx)
	ok(t, err)
	if len(again) != 0 {
		t.Fatalf("second run applied %v", again)
	}
	tables := []string{"chains", "assets", "devices", "tracked_addresses", "device_addresses", "event_keys", "transactions", "transfers", "price_ticks",
		"balances", "nft_holdings", "address_activity", "balance_snapshots", "pending_transactions", "webhooks", "webhook_deliveries",
		"service_heartbeats", "push_subscriptions", "push_routes"}
	for _, tb := range tables {
		var exists bool
		ok(t, st.Pool.QueryRow(ctx, `SELECT to_regclass($1) IS NOT NULL`, "public."+tb).Scan(&exists))
		if !exists {
			t.Errorf("table %s missing", tb)
		}
	}
	for _, fn := range []string{"harbour_ensure_monthly_partitions", "harbour_ensure_partition", "hb_ref", "hb_ref_text", "hb_refs"} {
		var n int
		ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM pg_proc WHERE proname = $1`, fn).Scan(&n))
		if n == 0 {
			t.Errorf("function %s missing", fn)
		}
	}
	for _, role := range []string{"harbour_api", "harbour_indexer", "harbour_prices", "harbour_tracker", "harbour_app"} {
		var n int
		ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM pg_roles WHERE rolname = $1 AND NOT rolcanlogin`, role).Scan(&n))
		if n != 1 {
			t.Errorf("role %s missing or can log in", role)
		}
	}
	var parts int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM pg_inherits WHERE inhparent = 'address_activity'::regclass`).Scan(&parts))
	if parts != 32 {
		t.Errorf("address_activity hash partitions = %d, want 32", parts)
	}
	// 0009: the dormant state is allowed; 0010: refs are bytea.
	var typ string
	ok(t, st.Pool.QueryRow(ctx, `SELECT data_type FROM information_schema.columns WHERE table_name='transfers' AND column_name='tx_hash' LIMIT 1`).Scan(&typ))
	if typ != "bytea" {
		t.Errorf("transfers.tx_hash type %s, want bytea", typ)
	}
}

// T-DB-003: two concurrent migrators apply each version exactly once (advisory lock).
func TestQAConcurrentMigrate(t *testing.T) {
	url := testdb.URL(t, "qa_migrate_race")
	ctx := context.Background()
	var wg sync.WaitGroup
	res := make([][]string, 3)
	errs := make([]error, 3)
	for i := range res {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			st, err := store.Open(ctx, url)
			if err != nil {
				errs[i] = err
				return
			}
			defer st.Close()
			res[i], errs[i] = st.Migrate(ctx)
		}(i)
	}
	wg.Wait()
	total := 0
	for i := range res {
		ok(t, errs[i])
		total += len(res[i])
	}
	if total != len(migrationVersions(t)) {
		t.Fatalf("versions applied across migrators: %d, want %d (%v)", total, len(migrationVersions(t)), res)
	}
}

// T-DB-004: a migration that fails is rolled back completely and not recorded; earlier migrations stay applied.
func TestQAFailedMigrationRollsBack(t *testing.T) {
	url := testdb.URL(t, "qa_migrate_fail")
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	ok(t, err)
	// Pre-create an object that migration 0005 creates, so 0005 fails half way (after its ALTER TABLE).
	_, err = conn.Exec(ctx, `CREATE TABLE nft_holdings_media (x int)`)
	ok(t, err)
	conn.Close(ctx)
	st, err := store.Open(ctx, url)
	ok(t, err)
	defer st.Close()
	applied, err := st.Migrate(ctx)
	if err == nil || !strings.Contains(err.Error(), "0005") {
		t.Fatalf("want a 0005 failure, got applied=%v err=%v", applied, err)
	}
	if strings.Join(applied, ",") != "0001_init,0002_indexer,0003_partition_fix,0004_live" {
		t.Fatalf("applied before the failure: %v", applied)
	}
	var recorded int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations WHERE version = '0005_read_api'`).Scan(&recorded))
	var col int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM information_schema.columns WHERE table_name='nft_holdings' AND column_name='image_src'`).Scan(&col))
	if recorded != 0 || col != 0 {
		t.Fatalf("partial 0005 left behind: recorded=%d image_src column=%d", recorded, col)
	}
}

// T-DB-005: 0010 converts populated text refs to bytea without losing rows, lower-cases hex, and compacts activity summaries.
func TestQAMigration0010PreservesData(t *testing.T) {
	url := testdb.URL(t, "qa_mig_0010")
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	ok(t, err)
	defer conn.Close(ctx)
	ok(t, applyUpTo(ctx, conn, "0009_lazy_chains_nfts"))
	tx := "0xAB" + strings.Repeat("cd", 31)
	from := "0x00000000000000000000000000000000000000Aa"
	_, err = conn.Exec(ctx, `
		INSERT INTO chains(chain_id, family) VALUES ('base','evm'), ('solana','solana');
		INSERT INTO assets(chain_id, asset_ref, kind, symbol, decimals) VALUES ('base','native','native','ETH',18), ('base','0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913','token','USDC',6);
		INSERT INTO tracked_addresses(chain_id, address) VALUES ('base', '0x00000000000000000000000000000000000000aa');`)
	ok(t, err)
	for _, m := range []string{"2026-09-15", "2026-10-15"} {
		_, err = conn.Exec(ctx, `SELECT harbour_ensure_partition('transfers', $1::timestamptz)`, m)
		ok(t, err)
		_, err = conn.Exec(ctx, `SELECT harbour_ensure_partition('transactions', $1::timestamptz)`, m)
		ok(t, err)
		_, err = conn.Exec(ctx, `INSERT INTO transfers(chain_id, chain_family, tx_hash, event_ref, block_number, block_hash, block_time, asset_id, "from", "to", amount_raw, kind)
			SELECT 'base','evm',$1,'log:'||$2,1,'',$2::timestamptz, id, $3, 'So11111111111111111111111111111111111111112', 5, 'token' FROM assets WHERE symbol='USDC'`, tx, m, from)
		ok(t, err)
	}
	_, err = conn.Exec(ctx, `INSERT INTO address_activity(tracked_address_id, block_time, tx_hash, chain_id, direction, summary)
		SELECT id, now(), $1, 'base', 'out', jsonb_build_object('transfers', jsonb_build_array(jsonb_build_object('event_ref','log:1','asset','0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913','amount_raw','5','kind','token','direction','out')))
		FROM tracked_addresses`, tx)
	ok(t, err)
	var before int
	ok(t, conn.QueryRow(ctx, `SELECT count(*) FROM transfers`).Scan(&before))
	st, err := store.Open(ctx, url)
	ok(t, err)
	defer st.Close()
	applied, err := st.Migrate(ctx)
	ok(t, err)
	if strings.Join(applied, ",") != "0010_compact_refs" {
		t.Fatalf("applied %v", applied)
	}
	var after int
	var gotTx, gotFrom, gotTo string
	ok(t, conn.QueryRow(ctx, `SELECT count(*) FROM transfers`).Scan(&after))
	ok(t, conn.QueryRow(ctx, `SELECT hb_ref_text(tx_hash), hb_ref_text("from"), hb_ref_text("to") FROM transfers LIMIT 1`).Scan(&gotTx, &gotFrom, &gotTo))
	if after != before || after != 2 {
		t.Fatalf("rows %d -> %d", before, after)
	}
	if gotTx != strings.ToLower(tx) || gotFrom != strings.ToLower(from) || gotTo != "So11111111111111111111111111111111111111112" {
		t.Fatalf("refs after conversion: %s %s %s", gotTx, gotFrom, gotTo)
	}
	var summary string
	ok(t, conn.QueryRow(ctx, `SELECT summary::text FROM address_activity`).Scan(&summary))
	if !strings.Contains(summary, `"a":`) || strings.Contains(summary, "event_ref") || strings.Contains(summary, "0x8335") {
		t.Fatalf("summary not compacted to asset ids: %s", summary)
	}
}

func applyUpTo(ctx context.Context, conn *pgx.Conn, last string) error {
	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	names, _ := fs.Glob(migrations.FS, "*.sql")
	sort.Strings(names)
	for _, n := range names {
		v := strings.TrimSuffix(n, ".sql")
		b, _ := migrations.FS.ReadFile(n)
		if _, err := conn.Exec(ctx, string(b)); err != nil {
			return fmt.Errorf("%s: %w", n, err)
		}
		if _, err := conn.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES ($1)`, v); err != nil {
			return err
		}
		if v == last {
			return nil
		}
	}
	return nil
}

// T-DB-011: device keys must be exactly 32 bytes and unique.
func TestQADeviceKeyConstraints(t *testing.T) {
	st, ctx := open(t, "qa_device_constraints")
	for _, n := range []int{31, 33, 0} {
		if _, err := st.CreateDevice(ctx, make([]byte, n), "default", nil); err == nil {
			t.Errorf("%d-byte key accepted", n)
		}
	}
	k := []byte(strings.Repeat("q", 32))
	_, err := st.CreateDevice(ctx, k, "default", nil)
	ok(t, err)
	if _, err := st.CreateDevice(ctx, k, "default", nil); err != store.ErrDuplicateKey {
		t.Fatalf("duplicate key: %v, want ErrDuplicateKey", err)
	}
}

// T-DB-013: deleting a device cascades its links and push data, and detaches (not deletes) its pending transactions.
func TestQADeviceDeleteCascades(t *testing.T) {
	st, ctx := open(t, "qa_device_cascade")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("c", 32)), "default", nil)
	ok(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr}}, nil, 10)
	ok(t, err)
	ok(t, st.UpsertPushSub(ctx, store.PushSub{DeviceID: dev.ID, Channel: "webpush", Endpoint: "https://fcm.googleapis.com/x", P256dh: "p", Auth: "a"}, [][]byte{[]byte("tag")}))
	ok(t, st.InsertPending(ctx, "base", "0x"+strings.Repeat("ab", 32), aliceAddr, 1, dev.ID))
	_, err = st.Pool.Exec(ctx, `DELETE FROM devices WHERE id = $1::uuid`, dev.ID)
	ok(t, err)
	var links, subs, routes, pend, pendDev int
	ok(t, st.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM device_addresses), (SELECT count(*) FROM push_subscriptions), (SELECT count(*) FROM push_routes),
		(SELECT count(*) FROM pending_transactions), (SELECT count(*) FROM pending_transactions WHERE device_id IS NOT NULL)`).Scan(&links, &subs, &routes, &pend, &pendDev))
	if links != 0 || subs != 0 || routes != 0 || pend != 1 || pendDev != 0 {
		t.Fatalf("after delete: links=%d subs=%d routes=%d pending=%d pendingWithDevice=%d", links, subs, routes, pend, pendDev)
	}
}

// T-DB-016: hb_ref / hb_ref_text round trip for random references (hex lower-cased, text kept).
func TestQARefCodecProperty(t *testing.T) {
	st, ctx := open(t, "qa_ref_codec")
	r := rand.New(rand.NewSource(7))
	alpha := "0123456789abcdefABCDEF"
	for i := 0; i < 300; i++ {
		var in string
		switch i % 4 {
		case 0:
			n := 2 * (1 + r.Intn(40))
			b := make([]byte, n)
			for j := range b {
				b[j] = alpha[r.Intn(len(alpha))]
			}
			in = "0x" + string(b)
		case 1:
			in = "0x" + strings.Repeat("a", 2*r.Intn(3)+1) // odd hex → text
		case 2:
			in = []string{"native", "", "So11111111111111111111111111111111111111112", "é✓", "0x"}[r.Intn(5)]
		default:
			in = fmt.Sprintf("T%x", r.Int63())
		}
		var out string
		ok(t, st.Pool.QueryRow(ctx, `SELECT hb_ref_text(hb_ref($1))`, in).Scan(&out))
		want := in
		if strings.HasPrefix(in, "0x") && len(in) > 2 && len(in)%2 == 0 && strings.Trim(in[2:], alpha) == "" {
			want = strings.ToLower(in)
		}
		if out != want {
			t.Fatalf("round trip %q -> %q, want %q", in, out, want)
		}
	}
}

// T-DB-017: a service login (member of harbour_app) can read/write data but cannot change the schema or roles.
func TestQAServiceRoleIsLeastPrivilege(t *testing.T) {
	st, ctx := open(t, "qa_roles")
	user := fmt.Sprintf("qa_svc_%d", time.Now().UnixNano()%1e9)
	ok(t, st.EnsureAppLogin(ctx, user, "correct-horse-battery-staple"))
	t.Cleanup(func() { _, _ = st.Pool.Exec(context.Background(), `DROP OWNED BY `+user+`; DROP ROLE IF EXISTS `+user) })
	cfg := st.Pool.Config().ConnConfig
	u := &url.URL{Scheme: "postgres", User: url.UserPassword(user, "correct-horse-battery-staple"), Host: fmt.Sprintf("%s:%d", cfg.Host, cfg.Port), Path: "/" + cfg.Database, RawQuery: "sslmode=disable"}
	conn, err := pgx.Connect(ctx, u.String())
	ok(t, err)
	defer conn.Close(ctx)
	if _, err := conn.Exec(ctx, `SELECT count(*) FROM devices`); err != nil {
		t.Fatalf("service cannot read: %v", err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO chains(chain_id, family) VALUES ('qa_chain','evm')`); err != nil {
		t.Fatalf("service cannot write: %v", err)
	}
	for _, ddl := range []string{`CREATE TABLE qa_evil(x int)`, `DROP TABLE price_ticks`, `ALTER TABLE devices ADD COLUMN x int`, `CREATE ROLE qa_evil_role`,
		`COPY devices TO PROGRAM 'id'`, `TRUNCATE devices`} {
		if _, err := conn.Exec(ctx, ddl); err == nil {
			t.Errorf("service login was allowed: %s", ddl)
		}
	}
	if _, err := conn.Exec(ctx, `SELECT harbour_ensure_partition('devices', now())`); err == nil || !strings.Contains(err.Error(), "not a partitioned fact table") {
		t.Errorf("SECURITY DEFINER partition helper accepted a foreign table: %v", err)
	}
}

// T-DB-019: login creation validates names and quotes passwords safely.
func TestQAEnsureAppLoginInputHandling(t *testing.T) {
	st, ctx := open(t, "qa_app_login")
	for _, bad := range [][2]string{{"Bad-Name", "0123456789abcdef"}, {"x; DROP TABLE devices", "0123456789abcdef"}, {"ok_name", "short"}, {"", "0123456789abcdef"}} {
		if err := st.EnsureAppLogin(ctx, bad[0], bad[1]); err == nil {
			t.Errorf("accepted user=%q password=%q", bad[0], bad[1])
		}
	}
	var current string
	ok(t, st.Pool.QueryRow(ctx, `SELECT current_user`).Scan(&current))
	if err := st.EnsureAppLogin(ctx, current, "0123456789abcdef"); err == nil {
		t.Error("owner user accepted as the service login")
	}
	user := fmt.Sprintf("qa_quote_%d", time.Now().UnixNano()%1e9)
	pw := `a'b"c\d$$e;--f0123`
	ok(t, st.EnsureAppLogin(ctx, user, pw))
	t.Cleanup(func() { _, _ = st.Pool.Exec(context.Background(), `DROP ROLE IF EXISTS `+user) })
	ok(t, st.EnsureAppLogin(ctx, user, pw)) // second call ALTERs, still fine
	var n int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM devices`).Scan(&n)) // the devices table survived
	var member bool
	ok(t, st.Pool.QueryRow(ctx, `SELECT pg_has_role($1, 'harbour_app', 'member')`, user).Scan(&member))
	if !member {
		t.Fatal("login is not a member of harbour_app")
	}
}

// T-DB-023: without the link key, device_addresses cannot be joined to addresses by time or by value.
func TestQALinkTableResistsCorrelation(t *testing.T) {
	st, ctx := open(t, "qa_link_privacy")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("p", 32)), "default", nil)
	ok(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr}, {Chain: "base", Address: bobAddr}}, nil, 10)
	ok(t, err)
	var sub int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM device_addresses WHERE added_at <> date_trunc('day', added_at)`).Scan(&sub))
	if sub != 0 {
		t.Fatal("added_at keeps sub-day precision (re-links devices to tracked_addresses.created_at)")
	}
	var plainHits int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM device_addresses d JOIN tracked_addresses t
		ON position(int8send(t.id) in d.enc_tracked_ref) > 0 OR position(convert_to(t.address,'UTF8') in d.enc_tracked_ref) > 0`).Scan(&plainHits))
	if plainHits != 0 {
		t.Fatal("tracked id or address visible in the encrypted link")
	}
}

// T-IDX-015: concurrent workers never claim the same backfill job.
func TestQAClaimBackfillConcurrent(t *testing.T) {
	st, ctx := open(t, "qa_claim_race")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("b", 32)), "default", nil)
	ok(t, err)
	var refs []store.AddressRef
	for i := 0; i < 20; i++ {
		refs = append(refs, store.AddressRef{Chain: "base", Address: fmt.Sprintf("0x%040x", i+1)})
	}
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, refs, nil, 100)
	ok(t, err)
	var mu sync.Mutex
	seen := map[int64]int{}
	var wg sync.WaitGroup
	for w := 0; w < 8; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				j, got, err := st.ClaimBackfill(ctx, []string{"base"})
				if err != nil || !got {
					return
				}
				mu.Lock()
				seen[j.ID]++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if len(seen) != 20 {
		t.Fatalf("claimed %d distinct jobs, want 20", len(seen))
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("job %d claimed %d times", id, n)
		}
	}
}

// T-IDX-053: two ingesters writing overlapping batches at once store each event exactly once.
func TestQAConcurrentIngestDedupes(t *testing.T) {
	st, ctx := open(t, "qa_ingest_race")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("i", 32)), "default", nil)
	ok(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr}}, nil, 10)
	ok(t, err)
	now := time.Now().UTC().Truncate(time.Second)
	var evs []index.ActivityEvent
	for i := 0; i < 30; i++ {
		evs = append(evs, index.ActivityEvent{Chain: "base", Family: "evm", TxHash: fmt.Sprintf("0x%064x", i), EventRef: "trace:0", BlockNumber: 100,
			BlockHash: "0xbh", BlockTime: now, From: carolAddr, To: aliceAddr, Asset: "native", AmountRaw: "7", Kind: index.KindNative})
	}
	var wg sync.WaitGroup
	errs := make([]error, 4)
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			// Each worker gets an overlapping window of the same events, in a different order.
			batch := append([]index.ActivityEvent(nil), evs[w*5:w*5+15]...)
			rand.New(rand.NewSource(int64(w))).Shuffle(len(batch), func(i, j int) { batch[i], batch[j] = batch[j], batch[i] })
			_, errs[w] = st.IngestEvents(ctx, store.IngestOptions{Chain: "base", Family: "evm", NativeSym: "ETH", NativeDec: 18, Assets: store.NewAssetCache()}, batch)
		}(w)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Logf("concurrent ingest error (retryable conflict is acceptable): %v", err)
		}
	}
	var transfers, activity int
	ok(t, st.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM transfers), (SELECT count(*) FROM address_activity)`).Scan(&transfers, &activity))
	wantMax := 30 // events 0..29 covered by windows [0,15),[5,20),[10,25),[15,30)
	if transfers > wantMax || activity > wantMax {
		t.Fatalf("double counted: transfers=%d activity=%d (max %d)", transfers, activity, wantMax)
	}
	var dups int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM (SELECT tx_hash, event_ref FROM transfers GROUP BY 1,2 HAVING count(*) > 1) d`).Scan(&dups))
	if dups != 0 {
		t.Fatalf("%d duplicated transfer rows", dups)
	}
}
