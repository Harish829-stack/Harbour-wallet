package swapsvc

// Upstream protection (audit M6/M2):
//   - quote refs: the provider objects a transaction is built from (LI.FI steps, Jupiter quotes) stay on the server. A route
//     carries an opaque QuoteRef; /transaction accepts only that ref, so clients cannot make Harbour's keys sign or forward
//     arbitrary provider bodies, and a quote cannot be edited between quote and transaction.
//   - a short quote cache with in-flight de-duplication (golang.org/x/sync/singleflight): bursts of identical quote
//     requests (refresh, double click) cost one upstream call per provider;
//   - a per-provider circuit breaker: after repeated upstream outages (5xx, timeouts; not 429s) a provider is skipped for a short time instead of
//     being hammered (and its error is reported as "unavailable").
// State is in memory: with more than one API replica, route /v1/swap with session affinity (a missing ref only means "quote again").

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

const (
	quoteRefTTL     = 10 * time.Minute
	quoteRefMax     = 20000
	quoteCacheTTL   = 8 * time.Second
	quoteCacheMax   = 2000
	breakerFailures = 3
	breakerOpenFor  = 30 * time.Second
)

type quoteRef struct {
	source  string
	payload json.RawMessage // LI.FI: the step object; Jupiter: the quote object
	expires time.Time
}

type guard struct {
	mu      sync.Mutex
	refs    map[string]quoteRef
	cache   map[string]cachedQuotes
	fails   map[string]int
	openTil map[string]time.Time
	flight  singleflight.Group
}

type cachedQuotes struct {
	res     *QuoteResult
	expires time.Time
}

func newGuard() *guard {
	return &guard{refs: map[string]quoteRef{}, cache: map[string]cachedQuotes{}, fails: map[string]int{}, openTil: map[string]time.Time{}}
}

func randomRef() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// putRef stores what a transaction for this route will be built from and returns its ref.
func (g *guard) putRef(now time.Time, source string, payload json.RawMessage) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	if len(g.refs) >= quoteRefMax {
		for k, v := range g.refs {
			if now.After(v.expires) {
				delete(g.refs, k)
			}
		}
		for k := range g.refs { // still full: drop arbitrary entries (map order is random)
			if len(g.refs) < quoteRefMax {
				break
			}
			delete(g.refs, k)
		}
	}
	ref := randomRef()
	g.refs[ref] = quoteRef{source: source, payload: payload, expires: now.Add(quoteRefTTL)}
	return ref
}

func (g *guard) getRef(now time.Time, ref, source string) (json.RawMessage, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	r, ok := g.refs[ref]
	if !ok || r.source != source || now.After(r.expires) {
		return nil, false
	}
	return r.payload, true
}

func quoteKey(r *QuoteRequest) string {
	b, _ := json.Marshal(r)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// cachedQuotes returns a recent identical answer, or runs `run` once for all concurrent identical requests.
func (g *guard) quotes(ctx context.Context, now func() time.Time, ttl time.Duration, r *QuoteRequest, run func() (*QuoteResult, error)) (*QuoteResult, error) {
	key := quoteKey(r)
	g.mu.Lock()
	if c, ok := g.cache[key]; ok && now().Before(c.expires) {
		g.mu.Unlock()
		return c.res, nil
	}
	g.mu.Unlock()
	v, err, _ := g.flight.Do(key, func() (any, error) {
		res, err := run()
		if err == nil {
			g.mu.Lock()
			if len(g.cache) >= quoteCacheMax {
				for k, c := range g.cache {
					if now().After(c.expires) || len(g.cache) >= quoteCacheMax {
						delete(g.cache, k)
					}
				}
			}
			g.cache[key] = cachedQuotes{res: res, expires: now().Add(ttl)}
			g.mu.Unlock()
		}
		return res, err
	})
	if err != nil {
		return nil, err
	}
	return v.(*QuoteResult), nil
}

// open reports whether a provider is being skipped after repeated upstream failures.
func (g *guard) open(now time.Time, p string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	return now.Before(g.openTil[p])
}

// record counts upstream failures (not user errors such as no route or amount too low).
func (g *guard) record(now time.Time, p string, err error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if err == nil {
		g.fails[p] = 0
		return
	}
	// Provider outages only. A 429 (rate_limited) is not counted: one busy device could otherwise switch a provider off for
	// every user; the per-device rate limit handles that.
	switch asErr(err).Code {
	case "server", "timeout", "network":
		g.fails[p]++
		if g.fails[p] >= breakerFailures {
			g.openTil[p] = now.Add(breakerOpenFor)
			g.fails[p] = 0
		}
	}
}
