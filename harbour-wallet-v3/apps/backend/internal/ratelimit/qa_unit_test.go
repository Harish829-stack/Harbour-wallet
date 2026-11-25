package ratelimit

// QA unit test: blocking limiter. TEST_PLAN: T-IDX-038.

import (
	"context"
	"errors"
	"testing"
	"time"
)

// T-IDX-038: Wait returns the context error when cancelled; rps <= 0 (and a nil limiter) is unlimited; burst is max(1, rps).
func TestQAWaitCancelAndUnlimited(t *testing.T) {
	for _, l := range []*Limiter{New(0), New(-5), nil} {
		for i := 0; i < 1000; i++ {
			if err := l.Wait(context.Background()); err != nil {
				t.Fatal(err)
			}
		}
	}
	l := New(0.5) // one token, then one every 2 s
	if err := l.Wait(context.Background()); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	start := time.Now()
	if err := l.Wait(ctx); !errors.Is(err, context.DeadlineExceeded) || time.Since(start) > time.Second {
		t.Fatalf("Wait under a 50 ms deadline: %v after %s", err, time.Since(start))
	}
}
