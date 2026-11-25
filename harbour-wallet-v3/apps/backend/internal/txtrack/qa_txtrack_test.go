package txtrack_test

// QA (be-int): the tx tracker against real Postgres with a fake chain client and a capturing bus.
// TEST_PLAN: T-IDX-031 (confirmed / failed / backoff / replaced→dropped / aged→dropped / unknown chain / RPC error, events published),
// T-IDX-055 (two trackers at once: each due row handled once, one event per settled tx).

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
	"harbour/backend/internal/txtrack"
)

type fakeClient struct {
	chain.Client // nil: only Inclusion / ConfirmedNonce are used by the tracker
	mu           sync.Mutex
	inc          map[string]chain.Inclusion
	incErr       map[string]error
	nonce        uint64
	calls        map[string]int
}

func (f *fakeClient) Inclusion(_ context.Context, tx string) (chain.Inclusion, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls[tx]++
	time.Sleep(5 * time.Millisecond)
	if e := f.incErr[tx]; e != nil {
		return chain.Inclusion{}, e
	}
	return f.inc[tx], nil
}
func (f *fakeClient) ConfirmedNonce(context.Context, string) (uint64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.nonce, nil
}

type capBus struct {
	mu   sync.Mutex
	msgs []txtrack.Status
}

func (b *capBus) Publish(_ context.Context, subject string, data []byte) error {
	var s txtrack.Status
	_ = json.Unmarshal(data, &s)
	if subject != "tx.status."+s.Chain {
		return errors.New("wrong subject " + subject)
	}
	b.mu.Lock()
	b.msgs = append(b.msgs, s)
	b.mu.Unlock()
	return nil
}
func (b *capBus) Consume(context.Context, string, string, func(context.Context, []byte) error) error {
	return nil
}
func (b *capBus) Close() {}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func h(i int) string {
	return "0x" + strings.Repeat("0", 62) + string("0123456789abcdef"[i%16]) + string("0123456789abcdef"[i/16%16])
}

func setup(t *testing.T, name string) (context.Context, *store.Store, string) {
	ctx := context.Background()
	st, err := store.Open(ctx, testdb.URL(t, name))
	must(t, err)
	t.Cleanup(st.Close)
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.UpsertChains(ctx, map[string]string{"base": "evm", "gone": "evm"}))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("7", 32)), "default", nil)
	must(t, err)
	return ctx, st, dev.ID
}

func state(t *testing.T, st *store.Store, hash string) (s string, checks int, next time.Duration) {
	var n time.Time
	must(t, st.Pool.QueryRow(context.Background(), `SELECT state, checks, next_check_at FROM pending_transactions WHERE tx_hash=hb_ref($1)`, hash).Scan(&s, &checks, &n))
	return s, checks, time.Until(n)
}

func TestQATrackerOutcomes(t *testing.T) {
	ctx, st, dev := setup(t, "qa_txtrack")
	from := "0x" + strings.Repeat("ab", 20)
	for i, n := range []uint64{1, 2, 3, 4, 5, 6} {
		must(t, st.InsertPending(ctx, "base", h(i), from, n, dev))
	}
	must(t, st.InsertPending(ctx, "gone", h(9), from, 9, dev))
	_, err := st.Pool.Exec(ctx, `UPDATE pending_transactions SET submitted_at = now() - interval '7 hours' WHERE tx_hash=hb_ref($1)`, h(4))
	must(t, err)
	fc := &fakeClient{calls: map[string]int{}, nonce: 0,
		inc:    map[string]chain.Inclusion{h(0): {Found: true, BlockNumber: 100, Success: true}, h(1): {Found: true, BlockNumber: 101, Success: false}},
		incErr: map[string]error{h(5): errors.New("rpc 503")}}
	bus := &capBus{}
	tr := &txtrack.Tracker{St: st, Bus: bus, Chains: map[string]txtrack.Chain{"base": {Client: fc, BlockTime: 2 * time.Second}}, Log: slog.New(slog.NewTextHandler(io.Discard, nil)), MaxAge: 6 * time.Hour}
	changed, err := tr.RunOnce(ctx)
	must(t, err)
	if changed != 3 {
		t.Fatalf("changed %d, want 3 (confirmed, failed, aged-out)", changed)
	}
	want := map[string]string{h(0): "confirmed", h(1): "failed", h(2): "pending", h(3): "pending", h(4): "dropped", h(5): "pending", h(9): "dropped"}
	for hash, w := range want {
		if s, _, _ := state(t, st, hash); s != w {
			t.Fatalf("%s: %s, want %s", hash, s, w)
		}
	}
	if _, _, next := state(t, st, h(2)); next < time.Second || next > 3*time.Second {
		t.Fatalf("not-found backoff %v, want ≈ block time (2 s)", next)
	}
	if _, _, next := state(t, st, h(5)); next < 10*time.Second || next > 16*time.Second {
		t.Fatalf("RPC error backoff %v, want 15 s", next)
	}
	got := map[string]txtrack.Status{}
	for _, m := range bus.msgs {
		got[m.TxHash] = m
	}
	if len(bus.msgs) != 3 || got[h(0)].Status != "confirmed" || got[h(0)].BlockNumber != 100 || got[h(1)].Status != "failed" || got[h(4)].Status != "dropped" || got[h(0)].From != from {
		t.Fatalf("published %+v", bus.msgs)
	}
	if _, ok := got[h(9)]; ok {
		t.Fatal("unknown-chain drop must not publish a status for a chain nobody serves")
	}
	// replaced: another tx with a higher nonce is mined (confirmed nonce 5 > 3); dropped after the third check
	fc.mu.Lock()
	fc.nonce = 5
	fc.mu.Unlock()
	for i := 0; i < 4; i++ {
		_, err = st.Pool.Exec(ctx, `UPDATE pending_transactions SET next_check_at = now() WHERE state='pending'`)
		must(t, err)
		_, err = tr.RunOnce(ctx)
		must(t, err)
	}
	if s, _, _ := state(t, st, h(2)); s != "dropped" {
		t.Fatalf("nonce 3 with confirmed nonce 5: %s, want dropped", s)
	}
	// settled rows are never re-checked or re-published
	before := len(bus.msgs)
	_, err = st.Pool.Exec(ctx, `UPDATE pending_transactions SET next_check_at = now()`)
	must(t, err)
	_, err = tr.RunOnce(ctx)
	must(t, err)
	for _, m := range bus.msgs[before:] {
		if m.TxHash == h(0) || m.TxHash == h(1) || m.TxHash == h(2) || m.TxHash == h(3) {
			t.Fatalf("settled tx re-published: %+v", m)
		}
	}
	fc.mu.Lock()
	c0 := fc.calls[h(0)]
	fc.mu.Unlock()
	if c0 != 1 {
		t.Fatalf("confirmed tx queried %d times", c0)
	}
}

func TestQATwoTrackersProcessEachRowOnce(t *testing.T) {
	ctx, st, dev := setup(t, "qa_txtrack_conc")
	from := "0x" + strings.Repeat("cd", 20)
	inc := map[string]chain.Inclusion{}
	for i := 0; i < 60; i++ {
		must(t, st.InsertPending(ctx, "base", h(i), from, uint64(i), dev))
		inc[h(i)] = chain.Inclusion{Found: true, BlockNumber: uint64(1000 + i), Success: i%7 != 0}
	}
	fc := &fakeClient{calls: map[string]int{}, inc: inc, incErr: map[string]error{}}
	bus := &capBus{}
	mk := func() *txtrack.Tracker {
		return &txtrack.Tracker{St: st, Bus: bus, Chains: map[string]txtrack.Chain{"base": {Client: fc, BlockTime: time.Second}}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	}
	a, b := mk(), mk()
	var wg sync.WaitGroup
	for _, tr := range []*txtrack.Tracker{a, b, a, b} {
		wg.Add(1)
		go func(tr *txtrack.Tracker) { defer wg.Done(); _, err := tr.RunOnce(ctx); must(t, err) }(tr)
	}
	wg.Wait()
	seen := map[string]int{}
	for _, m := range bus.msgs {
		seen[m.TxHash]++
	}
	if len(seen) != 60 {
		t.Fatalf("%d of 60 settled", len(seen))
	}
	for k, n := range seen {
		if n != 1 {
			t.Fatalf("%s published %d times", k, n)
		}
		if fc.calls[k] != 1 {
			t.Fatalf("%s checked %d times by two trackers", k, fc.calls[k])
		}
	}
}
