package gateway

import (
	"sort"
	"sync"
	"time"
)

// ---------- sliding window of call outcomes ----------

type sample struct {
	at  time.Time
	lat time.Duration
	ok  bool
}

type window struct {
	mu     sync.Mutex
	buf    []sample
	next   int
	full   bool
	maxAge time.Duration
}

func newWindow(size int, maxAge time.Duration) *window {
	return &window{buf: make([]sample, size), maxAge: maxAge}
}

func (w *window) record(at time.Time, lat time.Duration, ok bool) {
	w.mu.Lock()
	w.buf[w.next] = sample{at, lat, ok}
	w.next = (w.next + 1) % len(w.buf)
	if w.next == 0 {
		w.full = true
	}
	w.mu.Unlock()
}

func (w *window) reset() {
	w.mu.Lock()
	w.next, w.full = 0, false
	w.mu.Unlock()
}

type windowStats struct {
	n             int
	errRate       float64
	p50, p90, p99 time.Duration
}

func (w *window) stats(now time.Time) windowStats {
	w.mu.Lock()
	n := w.next
	if w.full {
		n = len(w.buf)
	}
	lats := make([]time.Duration, 0, n)
	errs := 0
	for i := 0; i < n; i++ {
		s := w.buf[i]
		if now.Sub(s.at) > w.maxAge {
			continue
		}
		if s.ok {
			lats = append(lats, s.lat)
		} else {
			errs++
		}
	}
	w.mu.Unlock()
	st := windowStats{n: len(lats) + errs}
	if st.n > 0 {
		st.errRate = float64(errs) / float64(st.n)
	}
	if len(lats) > 0 {
		sort.Slice(lats, func(i, j int) bool { return lats[i] < lats[j] })
		q := func(p float64) time.Duration { return lats[int(p*float64(len(lats)-1))] }
		st.p50, st.p90, st.p99 = q(0.5), q(0.9), q(0.99)
	}
	return st
}

// ---------- circuit breaker ----------

type breakerState int

const (
	closed breakerState = iota
	open
	halfOpen
)

func (s breakerState) String() string {
	return [...]string{"closed", "open", "half_open"}[s]
}

type breaker struct {
	mu          sync.Mutex
	state       breakerState
	openedAt    time.Time
	inFlight    int
	successes   int
	consecutive int
	cooldown    time.Duration
	probes      int
	threshold   float64
	minSamples  int
}

// eligible reports whether the upstream may take a call, without reserving.
func (b *breaker) eligible(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	switch b.state {
	case closed:
		return true
	case open:
		return now.Sub(b.openedAt) >= b.cooldown
	default:
		return b.inFlight < b.probes
	}
}

// acquire reserves a slot; returns false if not allowed.
func (b *breaker) acquire(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.state == open {
		if now.Sub(b.openedAt) < b.cooldown {
			return false
		}
		b.state, b.inFlight, b.successes = halfOpen, 0, 0
	}
	if b.state == halfOpen {
		if b.inFlight >= b.probes {
			return false
		}
		b.inFlight++
	}
	return true
}

// result records an outcome; returns true if the breaker just closed (caller
// resets the window so stale errors don't reopen it).
func (b *breaker) result(now time.Time, ok bool, st windowStats) (closedNow bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	switch b.state {
	case halfOpen:
		if b.inFlight > 0 {
			b.inFlight--
		}
		if !ok {
			b.state, b.openedAt = open, now
			return false
		}
		b.successes++
		if b.successes >= b.probes {
			b.state, b.consecutive = closed, 0
			return true
		}
	case closed:
		if ok {
			b.consecutive = 0
			return false
		}
		b.consecutive++
		if b.consecutive >= 5 || (st.n >= b.minSamples && st.errRate >= b.threshold) {
			b.state, b.openedAt = open, now
		}
	}
	return false
}

// release frees a reserved slot without recording an outcome.
func (b *breaker) release() {
	b.mu.Lock()
	if b.state == halfOpen && b.inFlight > 0 {
		b.inFlight--
	}
	b.mu.Unlock()
}

func (b *breaker) current() breakerState {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.state
}

// ---------- token bucket (per-key budget) ----------

type bucket struct {
	mu     sync.Mutex
	rate   float64 // tokens per second; 0 = unlimited
	burst  float64
	tokens float64
	last   time.Time
	taken  uint64
	shed   uint64
}

func newBucket(rps float64) *bucket {
	b := rps
	if b < 1 {
		b = 1
	}
	return &bucket{rate: rps, burst: b, tokens: b, last: time.Now()}
}

func (b *bucket) refill(now time.Time) {
	if el := now.Sub(b.last).Seconds(); el > 0 {
		b.tokens += el * b.rate
		if b.tokens > b.burst {
			b.tokens = b.burst
		}
		b.last = now
	}
}

func (b *bucket) available(now time.Time) bool {
	if b.rate == 0 {
		return true
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refill(now)
	return b.tokens >= 1
}

func (b *bucket) take(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.rate == 0 {
		b.taken++
		return true
	}
	b.refill(now)
	if b.tokens < 1 {
		b.shed++
		return false
	}
	b.tokens--
	b.taken++
	return true
}

// wait is how long until one token is available.
func (b *bucket) wait(now time.Time) time.Duration {
	if b.rate == 0 {
		return 0
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refill(now)
	if b.tokens >= 1 {
		return 0
	}
	return time.Duration((1 - b.tokens) / b.rate * float64(time.Second))
}

func (b *bucket) usedRatio(now time.Time) float64 {
	if b.rate == 0 {
		return 0
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refill(now)
	return 1 - b.tokens/b.burst
}
