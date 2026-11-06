package indexer

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestProbeURL(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/healthz" {
			http.NotFound(w, r)
			return
		}
		w.Write([]byte(`{"ok":true}`))
	}))
	defer up.Close()
	if err := probeURL(context.Background(), up.URL+"/"); err != nil {
		t.Fatalf("healthy URL: %v", err)
	}
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusBadGateway) }))
	defer bad.Close()
	if err := probeURL(context.Background(), bad.URL); err == nil {
		t.Fatal("502 must count as down")
	}
	gone := httptest.NewServer(http.NotFoundHandler())
	gone.Close()
	if err := probeURL(context.Background(), gone.URL); err == nil {
		t.Fatal("closed server must count as down")
	}
}

// While the public URL fails, gap-fill must poll every address; it switches back once the URL answers again.
func TestWebhookPathFallback(t *testing.T) {
	ix := &Indexer{log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	var fail error
	o := &LiveOptions{PublicURL: "https://tunnel.example", Probe: func(context.Context, string) error { return fail }}
	p := &webhookPath{}
	ctx := context.Background()
	if !p.check(ctx, ix, o) {
		t.Fatal("healthy: webhooks")
	}
	fail = errors.New("dial tcp: no such host")
	if p.check(ctx, ix, o) || p.check(ctx, ix, o) {
		t.Fatal("unreachable: poll everything")
	}
	fail = nil
	if !p.check(ctx, ix, o) {
		t.Fatal("back: webhooks again")
	}
	// Shutdown is not a webhook outage.
	cctx, cancel := context.WithCancel(ctx)
	cancel()
	fail = context.Canceled
	if !p.check(cctx, ix, o) {
		t.Fatal("cancelled context must not switch to polling")
	}
}

func TestEnableLiveDefaults(t *testing.T) {
	ix := &Indexer{}
	ix.EnableLive(LiveOptions{})
	if ix.live.Probe == nil || len(ix.live.SettledRefresh) != 2 || ix.live.SettledRefresh[0] != 10*time.Second {
		t.Fatalf("defaults: %+v", ix.live)
	}
	ix.EnableLive(LiveOptions{SettledRefresh: []time.Duration{}})
	if len(ix.live.SettledRefresh) != 0 {
		t.Fatal("an empty list turns the settled refresh off")
	}
}

// A balance read older than the activity's block is retried, never stored; a fresh read (or giving up) clears the need.
func TestBalanceReadStale(t *testing.T) {
	ix := &Indexer{}
	if stale, _ := ix.balanceReadStale(1, 100); stale {
		t.Fatal("no recorded need: any read is fine")
	}
	ix.needBlock(1, 12076394)
	ix.needBlock(1, 12076390) // an older event never lowers the need
	if stale, want := ix.balanceReadStale(1, 12076393); !stale || want != 12076394 {
		t.Fatalf("read one block behind the swap must retry: stale=%v want=%d", stale, want)
	}
	if stale, _ := ix.balanceReadStale(1, 12076394); stale {
		t.Fatal("read at the event block is fresh")
	}
	if stale, _ := ix.balanceReadStale(1, 12076393); stale {
		t.Fatal("need is cleared after a fresh read")
	}
	ix.needBlock(2, 50)
	for i := 0; i < staleRetries; i++ {
		if stale, _ := ix.balanceReadStale(2, 49); !stale {
			t.Fatalf("retry %d should still wait", i)
		}
	}
	if stale, want := ix.balanceReadStale(2, 49); stale || want != 50 {
		t.Fatal("after the retry budget the read is stored (with a warning) rather than waiting forever")
	}
	ix.needBlock(3, 0)
	if stale, _ := ix.balanceReadStale(3, 1); stale {
		t.Fatal("block 0 records nothing")
	}
}
