package store_test

// QA database suite part 2 (real Postgres). Data-preserving migrations 0003/0004/0007/0008/0009, partitioning (pg_partman and the
// built-in fallback), constraint behaviour, numeric bounds, SECURITY DEFINER exposure, hot-query plans and a schema golden.
// TEST_PLAN: T-DB-002, 006, 007, 008, 009, 010, 012, 014, 018, 020, 022, 024, 025, T-DBO-002, T-DBO-003.

import (
	"context"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"

	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
	"harbour/backend/migrations"
)

func rawConn(t *testing.T, name string) (*pgx.Conn, string, context.Context) {
	t.Helper()
	url := testdb.URL(t, name)
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	ok(t, err)
	t.Cleanup(func() { conn.Close(ctx) })
	return conn, url, ctx
}
func migrateRest(t *testing.T, ctx context.Context, url string) []string {
	t.Helper()
	st, err := store.Open(ctx, url)
	ok(t, err)
	defer st.Close()
	applied, err := st.Migrate(ctx)
	ok(t, err)
	return applied
}
func one[T any](t *testing.T, ctx context.Context, conn *pgx.Conn, q string, args ...any) T {
	t.Helper()
	var v T
	ok(t, conn.QueryRow(ctx, q, args...).Scan(&v))
	return v
}

// T-DB-009: 0003 resets failed backfills to pending; 0004 marks existing tracked rows as tracked by one device.
func TestQAMigrations0003And0004Data(t *testing.T) {
	conn, url, ctx := rawConn(t, "qa_mig_0003")
	ok(t, applyUpTo(ctx, conn, "0002_indexer"))
	_, err := conn.Exec(ctx, `INSERT INTO chains(chain_id, family) VALUES ('base','evm');
		INSERT INTO tracked_addresses(chain_id, address, backfill_state, backfill_error) VALUES ('base','0x01','failed','boom'), ('base','0x02','done',NULL)`)
	ok(t, err)
	ok(t, applyUpTo2(ctx, conn, "0003_partition_fix", "0004_live"))
	if n := one[int](t, ctx, conn, `SELECT count(*) FROM tracked_addresses WHERE backfill_state='pending' AND backfill_error IS NULL`); n != 1 {
		t.Fatalf("failed rows reset: %d", n)
	}
	if n := one[int](t, ctx, conn, `SELECT count(*) FROM tracked_addresses WHERE device_count = 1`); n != 2 {
		t.Fatalf("device_count backfilled on %d rows", n)
	}
	migrateRest(t, ctx, url)
}

// T-DB-006 / T-DB-007 / T-DB-008: 0007 removes EIP-7708 pseudo transfers & balances (event keys kept, spam 100); 0008 truncates added_at
// to the day, changes its default and creates harbour_app; 0009 allows 'dormant' and sets nft_dirty per backfill state.
func TestQAMigrations0007To0009Data(t *testing.T) {
	conn, url, ctx := rawConn(t, "qa_mig_0007")
	ok(t, applyUpTo(ctx, conn, "0006_send_realtime"))
	pseudo := "0xfffffffffffffffffffffffffffffffffffffffe"
	stmts := []string{
		`INSERT INTO chains(chain_id, family) VALUES ('sepolia','evm')`,
		`INSERT INTO assets(chain_id, asset_ref, kind, symbol, decimals) VALUES ('sepolia','native','native','ETH',18), ('sepolia','` + pseudo + `','token','ETH',18)`,
		`INSERT INTO tracked_addresses(chain_id, address, backfill_state) VALUES ('sepolia','0xaa','done'), ('sepolia','0xbb','pending'), ('sepolia','0xcc','capped'), ('sepolia','0xdd','running')`,
		`INSERT INTO devices(public_key) VALUES (decode(repeat('ab',32),'hex'))`,
		`SELECT harbour_ensure_monthly_partitions('transfers', 1, 1)`,
		`INSERT INTO transfers(chain_id, chain_family, tx_hash, event_ref, block_number, block_hash, block_time, asset_id, "from", "to", amount_raw, kind)
		  SELECT 'sepolia','evm','0x01','log:1',1,'',now(),id,'0xaa','0xbb',5,'token' FROM assets WHERE asset_ref='` + pseudo + `'`,
		`INSERT INTO transfers(chain_id, chain_family, tx_hash, event_ref, block_number, block_hash, block_time, asset_id, "from", "to", amount_raw, kind)
		  SELECT 'sepolia','evm','0x01','native:1',1,'',now(),id,'0xaa','0xbb',5,'native' FROM assets WHERE asset_ref='native'`,
		`INSERT INTO balances(tracked_address_id, asset_id, amount_raw, as_of_block) SELECT t.id, a.id, 5, 1 FROM tracked_addresses t, assets a WHERE t.address='0xaa'`,
		`INSERT INTO event_keys(chain_id, tx_hash, event_ref) VALUES ('sepolia','0x01','log:1')`,
		`INSERT INTO device_addresses(link_hash, device_id, enc_tracked_ref, added_at) SELECT decode('01','hex'), d.id, decode('02','hex'), '2026-05-05 13:14:15.123456+00' FROM devices d`,
		`INSERT INTO address_activity(tracked_address_id, block_time, tx_hash, chain_id, direction, summary)
		  SELECT id, now(), '0x01', 'sepolia', 'in', jsonb_build_object('transfers', jsonb_build_array(jsonb_build_object('asset','` + pseudo + `','amount_raw','5'), jsonb_build_object('asset','native','amount_raw','5'))) FROM tracked_addresses WHERE address='0xbb'`,
	}
	for _, q := range stmts {
		if _, err := conn.Exec(ctx, q); err != nil {
			t.Fatalf("fixture at 0006: %v\n%s", err, q)
		}
	}
	ok(t, applyUpTo2(ctx, conn, "0007_native_transfer_logs", "0008_runtime_role_privacy", "0009_lazy_chains_nfts"))
	if n := one[int](t, ctx, conn, `SELECT count(*) FROM transfers t JOIN assets a ON a.id=t.asset_id WHERE a.asset_ref=$1`, pseudo); n != 0 {
		t.Fatalf("pseudo transfers left: %d", n)
	}
	if n := one[int](t, ctx, conn, `SELECT count(*) FROM transfers`); n != 1 {
		t.Fatalf("native transfer lost: %d rows", n)
	}
	if one[int](t, ctx, conn, `SELECT count(*) FROM balances b JOIN assets a ON a.id=b.asset_id WHERE a.asset_ref=$1`, pseudo) != 0 || one[int](t, ctx, conn, `SELECT spam_score FROM assets WHERE asset_ref=$1`, pseudo) != 100 {
		t.Fatal("pseudo balances / spam score")
	}
	if one[int](t, ctx, conn, `SELECT count(*) FROM event_keys`) != 1 {
		t.Fatal("event_keys must be kept so a replay cannot bring the rows back")
	}
	if s := one[string](t, ctx, conn, `SELECT summary::text FROM address_activity`); strings.Contains(s, pseudo) || !strings.Contains(s, "native") {
		t.Fatalf("summary not filtered: %s", s)
	}
	if s := one[string](t, ctx, conn, `SELECT to_char(added_at AT TIME ZONE 'UTC','HH24:MI:SS.US') FROM device_addresses`); s != "00:00:00.000000" {
		t.Fatalf("added_at not truncated to the day: %s", s)
	}
	if d := one[string](t, ctx, conn, `SELECT column_default FROM information_schema.columns WHERE table_name='device_addresses' AND column_name='added_at'`); !strings.Contains(d, "date_trunc") {
		t.Fatalf("added_at default %s", d)
	}
	if one[int](t, ctx, conn, `SELECT count(*) FROM pg_roles WHERE rolname='harbour_app'`) != 1 {
		t.Fatal("harbour_app role missing")
	}
	dirty := map[string]bool{}
	rows, err := conn.Query(ctx, `SELECT backfill_state, nft_dirty FROM tracked_addresses`)
	ok(t, err)
	for rows.Next() {
		var s string
		var d bool
		ok(t, rows.Scan(&s, &d))
		dirty[s] = d
	}
	if dirty["done"] || dirty["capped"] || !dirty["pending"] || !dirty["running"] {
		t.Fatalf("nft_dirty per state %v", dirty)
	}
	_, err = conn.Exec(ctx, `UPDATE tracked_addresses SET backfill_state='dormant' WHERE address='0xaa'`)
	ok(t, err)
	if _, err := conn.Exec(ctx, `UPDATE tracked_addresses SET backfill_state='bogus' WHERE address='0xaa'`); err == nil {
		t.Fatal("unknown backfill_state accepted")
	}
	migrateRest(t, ctx, url)
}

func applyUpTo2(ctx context.Context, conn *pgx.Conn, versions ...string) error {
	for _, v := range versions {
		b, err := migrationFile(v)
		if err != nil {
			return err
		}
		if _, err := conn.Exec(ctx, string(b)); err != nil {
			return err
		}
		if _, err := conn.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES ($1)`, v); err != nil {
			return err
		}
	}
	return nil
}

// T-DB-010: migrations are forward-only; the version table makes re-running safe and a re-applied file is never executed twice.
func TestQAForwardOnlyVersionTable(t *testing.T) {
	st, ctx := open(t, "qa_forward_only")
	var versions []string
	rows, err := st.Pool.Query(ctx, `SELECT version FROM schema_migrations ORDER BY version`)
	ok(t, err)
	for rows.Next() {
		var v string
		ok(t, rows.Scan(&v))
		versions = append(versions, v)
	}
	if strings.Join(versions, ",") != strings.Join(migrationVersions(t), ",") {
		t.Fatalf("versions %v", versions)
	}
	if _, err := st.Pool.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES ($1)`, versions[0]); err == nil {
		t.Fatal("a version can be recorded twice")
	}
	for _, f := range migrationVersions(t) {
		if strings.Contains(strings.ToLower(f), "down") {
			t.Fatalf("down migration %s present (documented as forward-only)", f)
		}
	}
}

// T-DB-002 / T-DB-014: monthly partitions — pg_partman when the server has it, the built-in function otherwise; rows of a month with
// no partition land in the DEFAULT partition, and creating that month's partition later must not lose them (AMB-16).
func TestQAPartitioning(t *testing.T) {
	st, ctx := open(t, "qa_partitions")
	// Two statements: a query that names partman.part_config cannot even be planned on a server without the extension.
	var partman, haveTable bool
	ok(t, st.Pool.QueryRow(ctx, `SELECT to_regclass('partman.part_config') IS NOT NULL`).Scan(&haveTable))
	if haveTable {
		ok(t, st.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM partman.part_config WHERE parent_table='public.transfers')`).Scan(&partman))
	}
	var avail bool
	ok(t, st.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_partman')`).Scan(&avail))
	if avail != partman {
		t.Fatalf("pg_partman available=%v but managing transfers=%v", avail, partman)
	}
	t.Logf("partitioning path: partman=%v", partman)
	var parts int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM pg_inherits WHERE inhparent='transfers'::regclass`).Scan(&parts))
	if parts < 2 {
		t.Fatalf("only %d partitions", parts)
	}
	_, err := st.Pool.Exec(ctx, `INSERT INTO assets(chain_id, asset_ref, kind, symbol, decimals) VALUES ('base','native','native','ETH',18) ON CONFLICT DO NOTHING`)
	ok(t, err)
	ins := func(when string) error {
		_, err := st.Pool.Exec(ctx, `INSERT INTO transfers(chain_id, chain_family, tx_hash, event_ref, block_number, block_hash, block_time, asset_id, "from", "to", amount_raw, kind)
			SELECT 'base','evm',hb_ref($1),'native:'||$1,1,'',$2::timestamptz,id,hb_ref('0x01'),hb_ref('0x02'),1,'native' FROM assets WHERE chain_id='base' AND asset_ref='native'`, "0x"+strings.Repeat("ab", 31)+when[2:4], when)
		return err
	}
	if err := ins("2015-03-01"); err != nil {
		t.Fatalf("a far-past row was refused (no default partition): %v", err)
	}
	if err := ins("2099-01-01"); err != nil {
		t.Fatalf("a far-future row was refused: %v", err)
	}
	_, err = st.Pool.Exec(ctx, `SELECT harbour_ensure_partition('transfers', '2015-03-15'::timestamptz)`)
	var n int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM transfers WHERE block_time = '2015-03-01'`).Scan(&n))
	if n != 1 {
		t.Fatalf("row for the month lost after ensure_partition (%v): %d", err, n)
	}
	t.Logf("ensure_partition with rows in DEFAULT: %v (documented AMB-16: surfaced as an error, rows kept)", err)
}

// T-DB-012 / T-DBO-002: CHECK / UNIQUE / FOREIGN KEY violations are rejected and name their constraint.
func TestQAConstraintViolationsNamed(t *testing.T) {
	st, ctx := open(t, "qa_constraints")
	rows, err := st.Pool.Query(ctx, `SELECT conname, contype FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype IN ('c','u','f')`)
	ok(t, err)
	known := map[string]bool{}
	for rows.Next() {
		var n string
		var ty byte
		ok(t, rows.Scan(&n, &ty))
		known[n] = true
	}
	cases := []struct{ sql, want string }{
		{`INSERT INTO tracked_addresses(chain_id, address) VALUES ('base', '0x01'), ('base', '0x01')`, "_key"},
		{`INSERT INTO tracked_addresses(chain_id, address, backfill_state) VALUES ('base', '0x02', 'bogus')`, "backfill_state"},
		{`INSERT INTO tracked_addresses(chain_id, address) VALUES ('nochain', '0x03')`, "fkey"},
		{`INSERT INTO devices(public_key) VALUES (decode('ab','hex'))`, "public_key"},
	}
	re := regexp.MustCompile(`constraint "([^"]+)"`)
	for _, c := range cases {
		_, err := st.Pool.Exec(ctx, c.sql)
		if err == nil {
			t.Fatalf("accepted: %s", c.sql)
		}
		m := re.FindStringSubmatch(err.Error())
		if m == nil || !known[m[1]] || !strings.Contains(strings.ToLower(m[1]), c.want) {
			t.Fatalf("%s → %v (want a named %s constraint)", c.sql, err, c.want)
		}
	}
}

// T-DBO-003: for every table, a NULL in each NOT NULL column without a default is rejected (generated from the catalog).
func TestQANotNullEverywhere(t *testing.T) {
	st, ctx := open(t, "qa_not_null")
	rows, err := st.Pool.Query(ctx, `SELECT c.table_name, c.column_name FROM information_schema.columns c JOIN information_schema.tables t USING (table_schema, table_name)
		WHERE c.table_schema='public' AND t.table_type='BASE TABLE' AND c.is_nullable='NO' AND c.column_default IS NULL AND c.is_identity='NO' AND c.table_name NOT LIKE '%\_p2%' AND c.table_name NOT LIKE '%default' ORDER BY 1,2`)
	ok(t, err)
	type col struct{ table, column string }
	var cols []col
	for rows.Next() {
		var c col
		ok(t, rows.Scan(&c.table, &c.column))
		cols = append(cols, c)
	}
	if len(cols) < 20 {
		t.Fatalf("only %d NOT NULL columns found", len(cols))
	}
	for _, c := range cols {
		tx, err := st.Pool.Begin(ctx)
		ok(t, err)
		_, err = tx.Exec(ctx, `INSERT INTO `+pgx.Identifier{c.table}.Sanitize()+` (`+pgx.Identifier{c.column}.Sanitize()+`) VALUES (NULL)`)
		_ = tx.Rollback(ctx)
		if err == nil || !strings.Contains(err.Error(), "null value") && !strings.Contains(err.Error(), "violates") {
			t.Errorf("%s.%s accepted NULL: %v", c.table, c.column, err)
		}
	}
}

// T-DB-020: NUMERIC(78,0) holds max uint256 exactly and refuses 79 digits.
func TestQANumericBounds(t *testing.T) {
	st, ctx := open(t, "qa_numeric")
	max := "115792089237316195423570985008687907853269984665640564039457584007913129639935"
	_, err := st.Pool.Exec(ctx, `INSERT INTO assets(chain_id, asset_ref, kind, symbol, decimals) VALUES ('base','native','native','ETH',18);
		INSERT INTO tracked_addresses(chain_id, address) VALUES ('base', hb_ref('0x0a'))`)
	ok(t, err)
	_, err = st.Pool.Exec(ctx, `INSERT INTO balances(tracked_address_id, asset_id, amount_raw, as_of_block) SELECT t.id, a.id, $1::numeric, 1 FROM tracked_addresses t, assets a`, max)
	ok(t, err)
	var got string
	ok(t, st.Pool.QueryRow(ctx, `SELECT amount_raw::text FROM balances`).Scan(&got))
	if got != max {
		t.Fatalf("stored %s", got)
	}
	if _, err := st.Pool.Exec(ctx, `UPDATE balances SET amount_raw = $1::numeric`, max+"0"); err == nil {
		t.Fatal("79-digit amount accepted")
	}
}

// T-DB-024: InsertPending is idempotent on (chain, hash).
func TestQAInsertPendingDuplicate(t *testing.T) {
	st, ctx := open(t, "qa_pending_dup")
	var dev string
	ok(t, st.Pool.QueryRow(ctx, `INSERT INTO devices(public_key) VALUES (decode(repeat('cd',32),'hex')) RETURNING id::text`).Scan(&dev))
	h := "0x" + strings.Repeat("12", 32)
	ok(t, st.InsertPending(ctx, "base", h, "0x"+strings.Repeat("34", 20), 1, dev))
	ok(t, st.InsertPending(ctx, "base", h, "0x"+strings.Repeat("34", 20), 1, dev))
	var n int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM pending_transactions`).Scan(&n))
	if n != 1 {
		t.Fatalf("%d rows", n)
	}
}

// T-DB-018: which SECURITY DEFINER functions PUBLIC can execute (documented, AMB-16).
func TestQASecurityDefinerExposure(t *testing.T) {
	st, ctx := open(t, "qa_secdef")
	rows, err := st.Pool.Query(ctx, `SELECT p.proname, has_function_privilege('public', p.oid, 'EXECUTE') FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef ORDER BY 1`)
	ok(t, err)
	var exposed []string
	for rows.Next() {
		var n string
		var pub bool
		ok(t, rows.Scan(&n, &pub))
		if pub {
			exposed = append(exposed, n)
		}
	}
	t.Logf("SECURITY DEFINER functions executable by PUBLIC: %v", exposed)
	for _, n := range exposed {
		if !strings.HasPrefix(n, "harbour_") && !strings.HasPrefix(n, "hb_") {
			t.Fatalf("unexpected SECURITY DEFINER function %s executable by PUBLIC", n)
		}
	}
}

// T-DB-022: hot read/ingest queries use indexes (no sequential scan on the big tables) with planner stats.
func TestQAHotQueriesUseIndexes(t *testing.T) {
	st, ctx := open(t, "qa_explain")
	_, err := st.Pool.Exec(ctx, `SET enable_seqscan = off`)
	ok(t, err)
	queries := map[string]string{
		"activity page":     `SELECT * FROM address_activity WHERE tracked_address_id = 1 ORDER BY block_time DESC, tx_hash DESC LIMIT 50`,
		"transfers by hash": `SELECT * FROM transfers WHERE chain_id = 'base' AND tx_hash = hb_ref('0x01')`,
		"tracked lookup":    `SELECT id FROM tracked_addresses WHERE chain_id = 'base' AND address = '0x01'`,
		"device links":      `SELECT * FROM device_addresses WHERE device_id = '00000000-0000-0000-0000-000000000001'`,
		"balances":          `SELECT * FROM balances WHERE tracked_address_id = 1`,
	}
	for name, q := range queries {
		var plan strings.Builder
		rows, err := st.Pool.Query(ctx, `EXPLAIN `+q)
		ok(t, err)
		for rows.Next() {
			var line string
			ok(t, rows.Scan(&line))
			plan.WriteString(line + "\n")
		}
		if strings.Contains(plan.String(), "Seq Scan on transfers") || strings.Contains(plan.String(), "Seq Scan on address_activity") || (strings.Contains(plan.String(), "Seq Scan") && !strings.Contains(plan.String(), "Index")) {
			t.Errorf("%s: no index used\n%s", name, plan.String())
		}
	}
}

// T-DB-025: the schema after all migrations equals the committed golden (testdata/schema.golden.sql). Regenerate deliberately with
// HB_UPDATE_GOLDEN=1 when a migration is added.
func TestQASchemaGolden(t *testing.T) {
	pgdump, err := exec.LookPath("pg_dump")
	if err != nil {
		t.Skip("pg_dump not on PATH")
	}
	_, url, ctx := rawConn(t, "qa_schema_golden")
	migrateRest(t, ctx, url)
	out, err := exec.CommandContext(ctx, pgdump, "--schema-only", "--no-owner", "--no-privileges", "--schema=public", url).Output()
	ok(t, err)
	norm := normalizeDump(string(out))
	const golden = "testdata/schema.golden.sql"
	if os.Getenv("HB_UPDATE_GOLDEN") == "1" {
		ok(t, os.MkdirAll("testdata", 0o755))
		ok(t, os.WriteFile(golden, []byte(norm), 0o644))
	}
	want, err := os.ReadFile(golden)
	ok(t, err)
	if string(want) != norm {
		t.Fatalf("schema drift: run with HB_UPDATE_GOLDEN=1 after reviewing; first difference near: %s", firstDiff(string(want), norm))
	}
}

func normalizeDump(s string) string {
	var keep []string
	partition := regexp.MustCompile(`_p\d{6}|_default`)
	for _, l := range strings.Split(s, "\n") {
		if strings.HasPrefix(l, "--") || strings.HasPrefix(l, "SET ") || strings.HasPrefix(l, "SELECT pg_catalog.set_config") || strings.HasPrefix(l, "\\restrict") || strings.HasPrefix(l, "\\unrestrict") || strings.TrimSpace(l) == "" {
			continue
		}
		if partition.MatchString(l) { // month partitions depend on the current date
			continue
		}
		keep = append(keep, l)
	}
	return strings.Join(keep, "\n") + "\n"
}
func firstDiff(a, b string) string {
	al, bl := strings.Split(a, "\n"), strings.Split(b, "\n")
	for i := 0; i < len(al) && i < len(bl); i++ {
		if al[i] != bl[i] {
			return "golden: " + al[i] + " | now: " + bl[i]
		}
	}
	return "length differs"
}

var _ = sort.Strings

func migrationFile(v string) ([]byte, error) { return migrations.FS.ReadFile(v + ".sql") }
