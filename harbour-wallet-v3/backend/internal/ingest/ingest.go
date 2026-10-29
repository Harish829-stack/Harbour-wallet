// Package ingest is webhook-ingest: it authenticates provider deliveries,
// stores the raw payload for replay, publishes it to NATS and returns 200 at
// once. It records its own liveness; after downtime it asks the indexer for
// a full gap-fill, because providers retry deliveries only briefly.
package ingest

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/store"
)

// Service name in service_heartbeats.
const Service = "webhook-ingest"

// Options configure the receiver.
type Options struct {
	Store   *store.Store
	Bus     events.Bus
	Log     *slog.Logger
	Box     *store.SecretBox
	Sources map[string]index.Webhooks // by source name from providers.yaml
	// StaticKeys are signing keys from env (webhookID -> key) for webhooks
	// created by hand; keys of webhooks the indexer created live in Postgres.
	StaticKeys map[string]string
	// DownAfter: a heartbeat gap longer than this triggers a full gap-fill.
	DownAfter time.Duration
	// KeyCacheTTL bounds how long a signing key stays cached (so a deleted
	// webhook stops being accepted). Default 1 minute.
	KeyCacheTTL time.Duration
	Now         func() time.Time
}

type cachedKey struct {
	key   string
	until time.Time
}

// Ingest is the receiver.
type Ingest struct {
	o       Options
	keys    sync.Map // webhookID -> key ("" = known unknown)
	unknown atomic.Int64
	lookups *bucket
}

const (
	replayWindow     = time.Hour // deliveries older than this are left to gap-fill
	maxUnknownCached = 10_000    // negative-cache entries (bounded: ids are attacker-chosen)
)

var errLookupBusy = errors.New("ingest: too many signing-key lookups")

// bucket is a small token bucket (lookups per second with a burst).
type bucket struct {
	mu     sync.Mutex
	tokens float64
	max    float64
	rate   float64
	last   time.Time
}

func (b *bucket) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	b.tokens += now.Sub(b.last).Seconds() * b.rate
	if b.tokens > b.max {
		b.tokens = b.max
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// New builds a receiver.
func New(o Options) *Ingest {
	if o.Now == nil {
		o.Now = time.Now
	}
	if o.DownAfter == 0 {
		o.DownAfter = time.Minute
	}
	if o.KeyCacheTTL == 0 {
		o.KeyCacheTTL = time.Minute
	}
	return &Ingest{o: o, lookups: &bucket{tokens: 50, max: 50, rate: 20, last: time.Now()}}
}

// Handler serves POST /webhooks/{source} and GET /healthz.
func (in *Ingest) Handler() http.Handler {
	r := chi.NewRouter()
	r.Post("/webhooks/{source}", in.receive)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := in.o.Store.Pool.Ping(ctx); err != nil {
			http.Error(w, `{"ok":false}`, http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte(`{"ok":true}`))
	})
	return r
}

func (in *Ingest) signingKey(ctx context.Context, webhookID string) (string, error) {
	if k, ok := in.o.StaticKeys[webhookID]; ok {
		return k, nil
	}
	if v, ok := in.keys.Load(webhookID); ok && in.o.Now().Before(v.(cachedKey).until) {
		if v.(cachedKey).key == "" {
			return "", store.ErrNotFound // remembered unknown id: no database lookup for repeats
		}
		return v.(cachedKey).key, nil
	}
	// Unauthenticated callers choose webhook ids: bound how many database lookups they can cause.
	if !in.lookups.Allow() {
		return "", errLookupBusy
	}
	enc, err := in.o.Store.WebhookKey(ctx, webhookID)
	if errors.Is(err, store.ErrNotFound) {
		if in.unknown.Add(1) <= maxUnknownCached {
			in.keys.Store(webhookID, cachedKey{until: in.o.Now().Add(30 * time.Second)})
		}
		return "", err
	}
	if err != nil {
		return "", err
	}
	k, err := in.o.Box.Open(enc)
	if err != nil {
		return "", err
	}
	in.keys.Store(webhookID, cachedKey{key: k, until: in.o.Now().Add(in.o.KeyCacheTTL)})
	return k, nil
}

func (in *Ingest) receive(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := chi.URLParam(r, "source")
	src, ok := in.o.Sources[name]
	if !ok {
		http.NotFound(w, r)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8<<20))
	if err != nil {
		http.Error(w, "too large", http.StatusRequestEntityTooLarge)
		return
	}
	wid, err := src.WebhookID(body)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	key, err := in.signingKey(ctx, wid)
	if errors.Is(err, errLookupBusy) {
		http.Error(w, "busy", http.StatusServiceUnavailable)
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		in.o.Log.Warn("delivery for unknown webhook", "source", name, "webhook", wid)
		http.Error(w, "unknown webhook", http.StatusUnauthorized)
		return
	} else if err != nil {
		in.o.Log.Error("signing key lookup", "err", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	if err := src.VerifyWebhook(r.Header.Get, body, key); err != nil {
		in.o.Log.Warn("rejected delivery", "source", name, "webhook", wid, "err", err)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	d, err := src.ParseWebhook(body)
	if err != nil {
		// Authentic but not something we understand: keep it, don't make the
		// provider retry forever.
		in.o.Log.Warn("unparseable delivery stored", "source", name, "err", err)
		_, _ = in.o.Store.InsertDelivery(ctx, name, wid+":"+in.o.Now().Format(time.RFC3339Nano), wid, "", body)
		w.WriteHeader(http.StatusOK)
		return
	}
	// Replay window: an authentic delivery captured earlier must not be re-injected later (it could re-add events that
	// reorg repair removed). Old activity is recovered by gap-fill instead.
	if len(d.Events) > 0 && in.o.Now().Sub(d.Events[0].BlockTime) > replayWindow {
		in.o.Log.Warn("stale delivery ignored", "source", name, "webhook", wid, "age", in.o.Now().Sub(d.Events[0].BlockTime).Round(time.Second).String())
		w.WriteHeader(http.StatusOK)
		return
	}
	if _, err := in.o.Store.InsertDelivery(ctx, name, d.ID, wid, d.Chain, body); err != nil {
		in.o.Log.Error("store delivery", "err", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable) // provider retries
		return
	}
	// Publish even if this delivery id was seen before: a retry after a
	// failed publish must still reach the indexer, and the indexer dedupes.
	msg, _ := json.Marshal(indexer.RawDelivery{Source: name, Body: body})
	if err := in.o.Bus.Publish(ctx, indexer.ActivitySubject(d.Chain), msg); err != nil {
		in.o.Log.Error("publish delivery", "err", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// Start records a heartbeat; if the previous beat is older than DownAfter,
// it publishes a full gap-fill request.
func (in *Ingest) Start(ctx context.Context) error {
	now := in.o.Now()
	prev, err := in.o.Store.Heartbeat(ctx, Service, now)
	if err != nil {
		return err
	}
	if !prev.IsZero() && now.Sub(prev) > in.o.DownAfter {
		in.o.Log.Warn("ingest was down; requesting full gap-fill", "down_for", now.Sub(prev).Round(time.Second).String())
		b, _ := json.Marshal(map[string]any{"reason": "ingest_down", "since": prev})
		return in.o.Bus.Publish(ctx, indexer.SubjectGapFill, b)
	}
	return nil
}

// RunHeartbeat beats every DownAfter/4 and purges old deliveries hourly.
func (in *Ingest) RunHeartbeat(ctx context.Context) {
	t := time.NewTicker(in.o.DownAfter / 4)
	defer t.Stop()
	purge := time.NewTicker(time.Hour)
	defer purge.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if _, err := in.o.Store.Heartbeat(ctx, Service, in.o.Now()); err != nil && ctx.Err() == nil {
				in.o.Log.Warn("heartbeat failed", "err", err)
			}
		case <-purge.C:
			if n, err := in.o.Store.PurgeDeliveries(ctx, 7*24*time.Hour); err == nil && n > 0 {
				in.o.Log.Info("purged old deliveries", "rows", n)
			}
		}
	}
}
