package indexer

// QA: the refresh debouncer (TEST_PLAN T-IDX-019, IDX-13). The production type uses real time.AfterFunc, so these tests use short real
// windows with generous margins instead of a fake clock; they assert counts and merged refs, never exact timings.

import (
	"context"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type deb struct {
	mu    sync.Mutex
	calls map[int64][][]string
}

func newRec() (*deb, func(context.Context, int64, []string)) {
	r := &deb{calls: map[int64][][]string{}}
	return r, func(_ context.Context, id int64, refs []string) {
		s := append([]string(nil), refs...)
		sort.Strings(s)
		r.mu.Lock()
		r.calls[id] = append(r.calls[id], s)
		r.mu.Unlock()
	}
}

func (r *deb) got(id int64) [][]string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([][]string(nil), r.calls[id]...)
}

func eventually(t *testing.T, what string, ok func() bool) {
	t.Helper()
	for end := time.Now().Add(3 * time.Second); time.Now().Before(end); time.Sleep(5 * time.Millisecond) {
		if ok() {
			return
		}
	}
	t.Fatalf("timed out waiting for %s", what)
}

// T-IDX-019: a burst of triggers inside the window runs the refresh once, with the union of every trigger's refs (duplicates collapsed).
func TestQADebounceBurstCoalescesAndMergesRefs(t *testing.T) {
	r, f := newRec()
	db := newDebouncer(150*time.Millisecond, f)
	ctx := context.Background()
	for i := 0; i < 50; i++ {
		db.Trigger(ctx, 7, []string{"0xa", "0xb", "0xc"}[i%3])
	}
	db.Trigger(ctx, 7, "0xa", "0xd")
	if n := len(r.got(7)); n != 0 {
		t.Fatalf("ran %d times before the window closed", n)
	}
	eventually(t, "the coalesced refresh", func() bool { return len(r.got(7)) > 0 })
	time.Sleep(300 * time.Millisecond)
	got := r.got(7)
	if len(got) != 1 {
		t.Fatalf("burst ran %d times, want 1: %v", len(got), got)
	}
	want := []string{"0xa", "0xb", "0xc", "0xd"}
	if len(got[0]) != len(want) {
		t.Fatalf("refs %v want %v", got[0], want)
	}
	for i := range want {
		if got[0][i] != want[i] {
			t.Fatalf("refs %v want %v", got[0], want)
		}
	}
}

// T-IDX-019: each tracked id has its own window and its own ref set; one id's burst does not swallow another's.
func TestQADebounceIDsAreIndependent(t *testing.T) {
	r, f := newRec()
	db := newDebouncer(80*time.Millisecond, f)
	ctx := context.Background()
	db.Trigger(ctx, 1, "x")
	db.Trigger(ctx, 2, "y")
	db.Trigger(ctx, 1, "z")
	eventually(t, "both ids", func() bool { return len(r.got(1)) > 0 && len(r.got(2)) > 0 })
	if g := r.got(1); len(g) != 1 || len(g[0]) != 2 {
		t.Fatalf("id1 %v", g)
	}
	if g := r.got(2); len(g) != 1 || len(g[0]) != 1 || g[0][0] != "y" {
		t.Fatalf("id2 %v", g)
	}
}

// T-IDX-019: a trigger after the previous refresh ran starts a fresh window, and refs from the earlier window do not leak into it.
func TestQADebounceSecondWindowIsFresh(t *testing.T) {
	r, f := newRec()
	db := newDebouncer(60*time.Millisecond, f)
	ctx := context.Background()
	db.Trigger(ctx, 3, "old")
	eventually(t, "first run", func() bool { return len(r.got(3)) == 1 })
	db.Trigger(ctx, 3, "new")
	eventually(t, "second run", func() bool { return len(r.got(3)) == 2 })
	g := r.got(3)
	if len(g[1]) != 1 || g[1][0] != "new" {
		t.Fatalf("second window refs %v (first %v)", g[1], g[0])
	}
}

// T-IDX-019: a trigger restarts the window (trailing-edge debounce): triggers spaced under the window keep postponing the single run.
func TestQADebounceTriggerExtendsWindow(t *testing.T) {
	r, f := newRec()
	d := 200 * time.Millisecond
	db := newDebouncer(d, f)
	ctx := context.Background()
	start := time.Now()
	for i := 0; i < 4; i++ {
		db.Trigger(ctx, 4, "r")
		time.Sleep(d / 2)
	}
	if n := len(r.got(4)); n != 0 {
		t.Fatalf("ran %d time(s) after %v although triggers kept arriving every %v", n, time.Since(start), d/2)
	}
	eventually(t, "the run after the last trigger", func() bool { return len(r.got(4)) == 1 })
}

// T-IDX-019: Flush runs every pending refresh now (without waiting for the window) and returns only after they have been written.
func TestQADebounceFlushRunsPendingNow(t *testing.T) {
	r, f := newRec()
	db := newDebouncer(time.Hour, f)
	ctx := context.Background()
	for id := int64(1); id <= 5; id++ {
		db.Trigger(ctx, id, "a")
		db.Trigger(ctx, id, "b")
	}
	db.Flush(ctx)
	for id := int64(1); id <= 5; id++ {
		if g := r.got(id); len(g) != 1 || len(g[0]) != 2 {
			t.Fatalf("id %d after Flush: %v", id, g)
		}
	}
	db.Flush(ctx) // nothing pending: no-op, no extra runs
	for id := int64(1); id <= 5; id++ {
		if n := len(r.got(id)); n != 1 {
			t.Fatalf("id %d ran %d times after a second Flush", id, n)
		}
	}
}

// T-IDX-019: Flush waits for a refresh a timer already claimed (so "flushed" means written), it does not return early.
func TestQADebounceFlushWaitsForInflight(t *testing.T) {
	var finished atomic.Bool
	started := make(chan struct{})
	db := newDebouncer(10*time.Millisecond, func(context.Context, int64, []string) {
		close(started)
		time.Sleep(250 * time.Millisecond)
		finished.Store(true)
	})
	db.Trigger(context.Background(), 9, "a")
	<-started
	db.Flush(context.Background())
	if !finished.Load() {
		t.Fatal("Flush returned while a claimed refresh was still running")
	}
}

// T-IDX-019: a cancelled context skips the refresh work (shutdown path) and leaves nothing pending.
func TestQADebounceCancelledContextSkipsWork(t *testing.T) {
	r, f := newRec()
	db := newDebouncer(20*time.Millisecond, f)
	ctx, cancel := context.WithCancel(context.Background())
	db.Trigger(ctx, 5, "a")
	cancel()
	time.Sleep(200 * time.Millisecond)
	if n := len(r.got(5)); n != 0 {
		t.Fatalf("ran %d times with a cancelled context", n)
	}
	db.Flush(context.Background()) // must not hang
}

// T-IDX-019: at most 8 refreshes run at once however many ids fire together (protects the database pool).
func TestQADebounceConcurrencyCapped(t *testing.T) {
	var cur, max atomic.Int32
	var done atomic.Int32
	db := newDebouncer(10*time.Millisecond, func(context.Context, int64, []string) {
		n := cur.Add(1)
		for {
			m := max.Load()
			if n <= m || max.CompareAndSwap(m, n) {
				break
			}
		}
		time.Sleep(40 * time.Millisecond)
		cur.Add(-1)
		done.Add(1)
	})
	for id := int64(1); id <= 40; id++ {
		db.Trigger(context.Background(), id, "a")
	}
	eventually(t, "all 40 refreshes", func() bool { return done.Load() == 40 })
	if max.Load() > 8 {
		t.Fatalf("peak concurrency %d, want <= 8", max.Load())
	}
	if max.Load() < 2 {
		t.Fatalf("peak concurrency %d: refreshes were serialised", max.Load())
	}
}
