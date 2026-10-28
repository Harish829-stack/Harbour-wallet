// Package ratelimit is a small blocking token bucket for adapters that call
// a provider directly (outside rpc-gateway) and need their own budget.
package ratelimit

import (
	"context"
	"sync"
	"time"
)

// Limiter allows rps events per second with a burst of max(1, rps).
type Limiter struct {
	mu     sync.Mutex
	rate   float64
	burst  float64
	tokens float64
	last   time.Time
}

// New returns a limiter; rps <= 0 means unlimited.
func New(rps float64) *Limiter {
	b := rps
	if b < 1 {
		b = 1
	}
	return &Limiter{rate: rps, burst: b, tokens: b, last: time.Now()}
}

// Wait blocks until a token is available or ctx ends.
func (l *Limiter) Wait(ctx context.Context) error {
	if l == nil || l.rate <= 0 {
		return nil
	}
	for {
		l.mu.Lock()
		now := time.Now()
		l.tokens += now.Sub(l.last).Seconds() * l.rate
		if l.tokens > l.burst {
			l.tokens = l.burst
		}
		l.last = now
		if l.tokens >= 1 {
			l.tokens--
			l.mu.Unlock()
			return nil
		}
		wait := time.Duration((1 - l.tokens) / l.rate * float64(time.Second))
		l.mu.Unlock()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(wait):
		}
	}
}
