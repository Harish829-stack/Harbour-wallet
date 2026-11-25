package indexer_test

// QA (resilience, T-IDX-056): failures injected into the indexer's loops while Run is active.
//  1. chain RPC down → backfill errors are logged, Run keeps running, and the backfill completes once RPC returns;
//  2. Postgres down (connections refused + existing ones killed) → the loops log and survive; new work completes after recovery;
//  3. NATS down when Run starts → the event consumers must start once NATS is back (address.nfts.sync handled).

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	natsserver "github.com/nats-io/nats-server/v2/server"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

type flakyChain struct {
	*fakeChain
	down atomic.Bool
}

var errRPCDown = errors.New("qa: rpc down")

func (f *flakyChain) LatestBlock(ctx context.Context) (uint64, error) {
	if f.down.Load() {
		return 0, errRPCDown
	}
	return f.fakeChain.LatestBlock(ctx)
}
func (f *flakyChain) Balances(ctx context.Context, a string, refs []string, b uint64) ([]chain.Balance, uint64, error) {
	if f.down.Load() {
		return nil, 0, errRPCDown
	}
	return f.fakeChain.Balances(ctx, a, refs, b)
}

type countingHoldings struct {
	*fakeSource
	nfts atomic.Int64
}

func (c *countingHoldings) NFTs(ctx context.Context, ch, a, cur string) (index.NFTPage, error) {
	c.nfts.Add(1)
	return c.fakeSource.NFTs(ctx, ch, a, cur)
}

type syncBuf struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuf) Write(p []byte) (int, error) { s.mu.Lock(); defer s.mu.Unlock(); return s.b.Write(p) }
func (s *syncBuf) String() string              { s.mu.Lock(); defer s.mu.Unlock(); return s.b.String() }

func qaPG(t *testing.T, pgURL string, allow bool) {
	t.Helper()
	u, _ := url.Parse(pgURL)
	db := u.Path[1:]
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, os.Getenv("HB_TEST_POSTGRES_URL"))
	must(t, err)
	defer conn.Close(ctx)
	_, err = conn.Exec(ctx, "ALTER DATABASE "+pgx.Identifier{db}.Sanitize()+" WITH ALLOW_CONNECTIONS "+map[bool]string{true: "true", false: "false"}[allow])
	must(t, err)
	if !allow {
		_, err = conn.Exec(ctx, "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()", db)
		must(t, err)
	}
}

func qaIndexerEnv(t *testing.T, name, natsURL string) (context.Context, *store.Store, string, *flakyChain, *countingHoldings, *indexer.Indexer, *syncBuf, *events.NATS) {
	t.Helper()
	pgURL := testdb.URL(t, name)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	t.Cleanup(cancel)
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	t.Cleanup(st.Close)
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.UpsertChains(ctx, map[string]string{"base": "evm"}))
	logs := &syncBuf{}
	log := slog.New(slog.NewTextHandler(logs, &slog.HandlerOptions{Level: slog.LevelDebug}))
	bus, err := events.Connect(ctx, natsURL, "qa", log)
	must(t, err)
	t.Cleanup(bus.Close)
	fc := &flakyChain{fakeChain: &fakeChain{block: 100, bal: map[string]string{A + "|native": "1000", A + "|" + USDC: "5", B + "|native": "7"}}}
	src := &countingHoldings{fakeSource: &fakeSource{evs: history()}}
	cfg := config.Indexer{BackfillMaxTransfers: 5000, OlderPageTransfers: 1000, RefreshDebounce: 30 * time.Millisecond, IdleSweepAfter: time.Hour, NFTMaxPages: 2, Workers: 1}
	ix := indexer.New(st, cfg, bus, map[string]*indexer.Chain{"base": {Name: "base", Family: "evm", Native: config.Native{Symbol: "ETH", Decimals: 18},
		Client: fc, Finality: finality{}, Source: src, Holdings: src}}, log)
	return ctx, st, pgURL, fc, src, ix, logs, bus
}

func TestQAIndexerSurvivesRPCAndPostgresOutages(t *testing.T) {
	ctx, st, pgURL, fc, _, ix, logs, _ := qaIndexerEnv(t, "indexer_qa_resil", startNATS(t))
	runCtx, stop := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { ix.Run(runCtx); close(done) }()
	t.Cleanup(func() { stop(); <-done })
	alive := func(what string) {
		select {
		case <-done:
			t.Fatalf("indexer Run exited during %s", what)
		default:
		}
	}
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("3", 32)), "default", nil)
	must(t, err)

	// 1. RPC down
	fc.down.Store(true)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	ix.Wake()
	waitUntil(t, "backfill failure logged", func() bool {
		return strings.Contains(logs.String(), "backfill failed") && strings.Contains(logs.String(), "qa: rpc down")
	})
	idA, _ := st.TrackedID(ctx, "base", A)
	if len(balances(t, st, idA)) != 0 {
		t.Fatal("balances written while the chain RPC was down")
	}
	alive("RPC outage")
	fc.down.Store(false)
	// backoff: a failed backfill is retried after 10 minutes, not hammered; let that time pass
	ix.Wake()
	time.Sleep(300 * time.Millisecond)
	if len(balances(t, st, idA)) != 0 {
		t.Fatal("failed backfill retried immediately (no backoff)")
	}
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_started_at = now() - interval '11 minutes' WHERE id=$1`, idA)
	must(t, err)
	deadline := time.Now().Add(15 * time.Second)
	for len(balances(t, st, idA)) == 0 && time.Now().Before(deadline) {
		ix.Wake()
		time.Sleep(200 * time.Millisecond)
	}
	if balances(t, st, idA)["native"] != "1000" {
		t.Fatalf("backfill did not resume after RPC recovery: %v\nlogs:\n%s", balances(t, st, idA), logs.String())
	}

	// 2. Postgres down
	qaPG(t, pgURL, false)
	for i := 0; i < 5; i++ {
		ix.Wake()
		time.Sleep(100 * time.Millisecond)
	}
	alive("Postgres outage")
	qaPG(t, pgURL, true)
	deadline = time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		if _, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: B}}, nil, 50); err == nil {
			break
		}
		time.Sleep(300 * time.Millisecond)
	}
	must(t, err)
	idB, _ := st.TrackedID(ctx, "base", B)
	deadline = time.Now().Add(15 * time.Second)
	for balances(t, st, idB)["native"] != "7" && time.Now().Before(deadline) {
		ix.Wake()
		time.Sleep(200 * time.Millisecond)
	}
	if balances(t, st, idB)["native"] != "7" {
		t.Fatalf("no progress after Postgres recovery\nlogs:\n%s", logs.String())
	}
	alive("after recovery")
}

func TestQAIndexerConsumersStartAfterLateNATS(t *testing.T) {
	dir := t.TempDir()
	ns, err := natsserver.NewServer(&natsserver.Options{Port: -1, JetStream: true, StoreDir: dir, NoLog: true, NoSigs: true})
	must(t, err)
	go ns.Start()
	if !ns.ReadyForConnections(5 * time.Second) {
		t.Fatal("nats not ready")
	}
	// the restarted server must come back on the same port; parse it from the client URL (Addr() is "[::]:port" on macOS, so
	// splitting it at the first colon yielded port 0 there and the second server started on a different port)
	_, portStr, err := net.SplitHostPort(strings.TrimPrefix(ns.ClientURL(), "nats://"))
	must(t, err)
	pn, err := strconv.Atoi(portStr)
	must(t, err)
	ctx, st, _, _, src, ix, logs, bus := qaIndexerEnv(t, "indexer_qa_latenats", ns.ClientURL())
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, _ := st.CreateDevice(ctx, []byte(strings.Repeat("4", 32)), "default", nil)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	_, err = ix.RunOneBackfill(ctx)
	must(t, err)
	id, _ := st.TrackedID(ctx, "base", A)

	// NATS goes away, the indexer (re)starts, NATS comes back on the same address a moment later
	ns.Shutdown()
	ns.WaitForShutdown()
	// like cmd/indexer: Run's context has no deadline, so JetStream applies its default API timeout to consumer creation
	runCtx, stop := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { ix.Run(runCtx); close(done) }()
	t.Cleanup(func() { stop(); <-done })
	time.Sleep(7 * time.Second) // longer than the JetStream API timeout (5 s): consumer creation fails while NATS is away
	ns2, err := natsserver.NewServer(&natsserver.Options{Port: pn, JetStream: true, StoreDir: dir, NoLog: true, NoSigs: true})
	must(t, err)
	go ns2.Start()
	if !ns2.ReadyForConnections(5 * time.Second) {
		t.Fatal("nats did not restart")
	}
	t.Cleanup(ns2.Shutdown)
	// the API asks for an NFT refresh of a tracked address
	before := src.nfts.Load()
	msg, _ := json.Marshal(map[string]any{"tracked_address_id": id})
	t0 := time.Now()
	var pubErr error
	pubTries := 0
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		pubTries++
		if pubErr = bus.Publish(ctx, events.SubjectNFTSync, msg); pubErr == nil {
			break
		}
		time.Sleep(300 * time.Millisecond)
	}
	pubDone := time.Since(t0)
	deadline = time.Now().Add(20 * time.Second)
	for src.nfts.Load() == before && time.Now().Before(deadline) {
		time.Sleep(200 * time.Millisecond)
	}
	var problems []string
	if src.nfts.Load() == before {
		problems = append(problems, fmt.Sprintf("after NATS was unavailable when Run started, address.nfts.sync was never consumed (publish tries=%d err=%v after %s)\nlog lines:\n%s", pubTries, pubErr, pubDone, matchLines(logs.String(), "consume", "nats")))
	}
	expectFixed(t, "BUG-16", problems)
}

// expectFixed fails when a fixed bug (qa/BUGS_FOUND.md) reproduces again.
func expectFixed(t *testing.T, id string, problems []string) {
	t.Helper()
	if len(problems) > 0 {
		t.Fatalf("%s regression: %s", id, strings.Join(problems, "; "))
	}
}

// qaKnownBug: expected-fail marker (same convention as internal/api expectKnownBug; qa/BUGS_FOUND.md).
func qaKnownBug(t *testing.T, id string, problems []string) {
	t.Helper()
	if len(problems) == 0 {
		t.Fatalf("%s no longer reproduces: remove the qaKnownBug marker and close the bug", id)
	}
	msg := "KNOWN BUG " + id + " (qa/BUGS_FOUND.md):\n  " + strings.Join(problems, "\n  ")
	if os.Getenv("HB_QA_STRICT") == "1" {
		t.Fatal(msg)
	}
	t.Skip(msg)
}

func firstLine(s, want string) string {
	for _, l := range strings.Split(s, "\n") {
		if strings.Contains(l, want) {
			return l
		}
	}
	return "no consumer error logged"
}

// matchLines returns every log line that contains one of the words (diagnostics for failing resilience tests).
func matchLines(all string, words ...string) string {
	var out []string
	for _, l := range strings.Split(all, "\n") {
		for _, w := range words {
			if strings.Contains(l, w) {
				out = append(out, l)
				break
			}
		}
	}
	return strings.Join(out, "\n")
}
