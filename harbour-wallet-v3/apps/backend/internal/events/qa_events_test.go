package events_test

// QA (be-int, T-IDX-036): the JetStream bus delivers at least once: a handler error is redelivered, a durable consumer resumes
// where it stopped after a restart, and acked messages are not delivered again. Embedded NATS server; no network.

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"

	"harbour/backend/internal/events"
)

func startNATS(t *testing.T) string {
	t.Helper()
	ns, err := natsserver.NewServer(&natsserver.Options{Port: -1, JetStream: true, StoreDir: t.TempDir(), NoLog: true, NoSigs: true})
	if err != nil {
		t.Fatal(err)
	}
	go ns.Start()
	if !ns.ReadyForConnections(5 * time.Second) {
		t.Fatal("nats not ready")
	}
	t.Cleanup(ns.Shutdown)
	return ns.ClientURL()
}

func TestQABusAtLeastOnceAndDurableResume(t *testing.T) {
	url := startNATS(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	bus, err := events.Connect(ctx, url, "qa", log)
	if err != nil {
		t.Fatal(err)
	}
	defer bus.Close()
	for _, m := range []string{"a", "b", "c"} {
		if err := bus.Publish(ctx, events.SubjectAddressAdded, []byte(m)); err != nil {
			t.Fatal(err)
		}
	}
	var mu sync.Mutex
	got := map[string]int{}
	failB := 1
	cctx, stop := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() {
		done <- bus.Consume(cctx, "qa-durable", events.SubjectAddressAdded, func(_ context.Context, b []byte) error {
			mu.Lock()
			defer mu.Unlock()
			got[string(b)]++
			if string(b) == "b" && failB > 0 {
				failB--
				return errors.New("transient")
			}
			return nil
		})
	}()
	wait := func(cond func() bool, what string, d time.Duration) {
		deadline := time.Now().Add(d)
		for {
			mu.Lock()
			ok := cond()
			mu.Unlock()
			if ok {
				return
			}
			if time.Now().After(deadline) {
				t.Fatalf("timed out: %s (%v)", what, got)
			}
			time.Sleep(50 * time.Millisecond)
		}
	}
	wait(func() bool { return got["a"] == 1 && got["c"] == 1 }, "first deliveries", 5*time.Second)
	// the failed "b" is NAKed with a 10 s delay, then redelivered
	wait(func() bool { return got["b"] == 2 }, "redelivery after a handler error", 20*time.Second)
	stop()
	if err := <-done; err != nil {
		t.Fatalf("consume returned %v", err)
	}
	// published while no consumer runs; a restarted durable consumer receives only the new message
	if err := bus.Publish(ctx, events.SubjectAddressAdded, []byte("d")); err != nil {
		t.Fatal(err)
	}
	cctx2, stop2 := context.WithCancel(ctx)
	defer stop2()
	go func() {
		_ = bus.Consume(cctx2, "qa-durable", events.SubjectAddressAdded, func(_ context.Context, b []byte) error {
			mu.Lock()
			got[string(b)]++
			mu.Unlock()
			return nil
		})
	}()
	wait(func() bool { return got["d"] == 1 }, "durable resume", 5*time.Second)
	time.Sleep(500 * time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	if got["a"] != 1 || got["c"] != 1 || got["b"] != 2 {
		t.Fatalf("acked messages redelivered after restart: %v", got)
	}
}
