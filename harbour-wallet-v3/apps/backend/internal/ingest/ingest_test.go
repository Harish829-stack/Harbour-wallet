package ingest_test

// QA suite for webhook-ingest (TEST_PLAN: T-IDX-026, T-IDX-027, T-IDX-028, T-IDX-030 fuzz seed). The provider adapter is replaced by a
// small fake with the same HMAC scheme (it is the external boundary); the receiver, store and bus wiring are the units under test.

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/ingest"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

type fakeSource struct{}

func (fakeSource) WebhookID(body []byte) (string, error) {
	var b struct {
		WebhookID string `json:"webhookId"`
	}
	if json.Unmarshal(body, &b) != nil || b.WebhookID == "" {
		return "", errors.New("no webhook id")
	}
	return b.WebhookID, nil
}
func (fakeSource) VerifyWebhook(h func(string) string, body []byte, key string) error {
	got, err := hex.DecodeString(h("X-Sig"))
	m := hmac.New(sha256.New, []byte(key))
	m.Write(body)
	if err != nil || !hmac.Equal(got, m.Sum(nil)) {
		return errors.New("bad signature")
	}
	return nil
}
func (fakeSource) ParseWebhook(body []byte) (index.Delivery, error) {
	var b struct {
		WebhookID string    `json:"webhookId"`
		ID        string    `json:"id"`
		At        time.Time `json:"at"`
	}
	if err := json.Unmarshal(body, &b); err != nil || b.ID == "" {
		return index.Delivery{}, errors.New("unparseable")
	}
	return index.Delivery{ID: b.ID, WebhookID: b.WebhookID, Chain: "base", Events: []index.ActivityEvent{{Chain: "base", BlockTime: b.At}}}, nil
}
func (fakeSource) CreateWebhook(context.Context, string, string, []string) (index.WebhookInfo, error) {
	return index.WebhookInfo{}, nil
}
func (fakeSource) UpdateWebhookAddresses(context.Context, string, []string, []string) error {
	return nil
}
func (fakeSource) DeleteWebhook(context.Context, string) error { return nil }
func (fakeSource) MaxAddressesPerWebhook() int                 { return 100 }
func (fakeSource) WebhooksEnabled() bool                       { return true }

type recBus struct {
	mu   sync.Mutex
	msgs []string
	fail bool
}

func (b *recBus) Publish(_ context.Context, subject string, data []byte) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.fail {
		return errors.New("jetstream down")
	}
	b.msgs = append(b.msgs, subject)
	return nil
}
func (b *recBus) Consume(context.Context, string, string, func(context.Context, []byte) error) error {
	return nil
}
func (b *recBus) Close()     {}
func (b *recBus) count() int { b.mu.Lock(); defer b.mu.Unlock(); return len(b.msgs) }

const key = "whsec_test_key"

func setup(t *testing.T, now time.Time) (*httptest.Server, *recBus, *store.Store) {
	t.Helper()
	ctx := context.Background()
	st, err := store.Open(ctx, testdb.URL(t, "qa_ingest"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	if _, err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	box, _ := store.NewSecretBox([]byte(strings.Repeat("x", 32)), "webhooks")
	bus := &recBus{}
	in := ingest.New(ingest.Options{Store: st, Bus: bus, Log: slog.New(slog.NewTextHandler(io.Discard, nil)), Box: box,
		Sources: map[string]index.Webhooks{"alchemy": fakeSource{}}, StaticKeys: map[string]string{"wh_1": key}, Now: func() time.Time { return now }})
	hs := httptest.NewServer(in.Handler())
	t.Cleanup(hs.Close)
	return hs, bus, st
}

func body(id string, at time.Time) []byte {
	b, _ := json.Marshal(map[string]any{"webhookId": "wh_1", "id": id, "at": at})
	return b
}

func sig(b []byte) string {
	m := hmac.New(sha256.New, []byte(key))
	m.Write(b)
	return hex.EncodeToString(m.Sum(nil))
}

func post(t *testing.T, url string, b []byte, headers map[string]string) int {
	t.Helper()
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	return resp.StatusCode
}

// T-IDX-026: only correctly signed deliveries for a known webhook are accepted; everything else is 401 and never published.
func TestDeliveryAuthentication(t *testing.T) {
	now := time.Now()
	hs, bus, _ := setup(t, now)
	good := body("d1", now)
	url := hs.URL + "/webhooks/alchemy"
	if s := post(t, url, good, map[string]string{"X-Sig": sig(good)}); s != 200 {
		t.Fatalf("valid delivery: %d", s)
	}
	unknown, _ := json.Marshal(map[string]any{"webhookId": "wh_unknown", "id": "d2", "at": now})
	cases := map[string]struct {
		b []byte
		h map[string]string
	}{
		"wrong signature":   {body("d3", now), map[string]string{"X-Sig": sig([]byte("other"))}},
		"missing signature": {body("d4", now), nil},
		"non-hex signature": {body("d5", now), map[string]string{"X-Sig": "zz"}},
		"body changed":      {body("d6", now), map[string]string{"X-Sig": sig(body("d7", now))}},
		"unknown webhook":   {unknown, map[string]string{"X-Sig": sig(unknown)}},
	}
	for name, c := range cases {
		if s := post(t, url, c.b, c.h); s != 401 {
			t.Errorf("%s: %d, want 401", name, s)
		}
	}
	if s := post(t, hs.URL+"/webhooks/nosuchsource", good, map[string]string{"X-Sig": sig(good)}); s != 404 {
		t.Errorf("unknown source: %d", s)
	}
	big := append([]byte(`{"webhookId":"wh_1","id":"d8","pad":"`), bytes.Repeat([]byte("a"), 8<<20)...)
	big = append(big, []byte(`"}`)...)
	if s := post(t, url, big, map[string]string{"X-Sig": sig(big)}); s != 413 {
		t.Errorf("8 MiB+ body: %d, want 413", s)
	}
	if n := bus.count(); n != 1 {
		t.Fatalf("published %d messages, want only the valid one", n)
	}
}

// T-IDX-027: an authentic but stale delivery (older than the replay window) is acknowledged and dropped.
func TestStaleDeliveryNotPublished(t *testing.T) {
	now := time.Now()
	hs, bus, _ := setup(t, now)
	old := body("old", now.Add(-2*time.Hour))
	if s := post(t, hs.URL+"/webhooks/alchemy", old, map[string]string{"X-Sig": sig(old)}); s != 200 {
		t.Fatalf("stale delivery status %d, want 200 (so the provider stops retrying)", s)
	}
	if bus.count() != 0 {
		t.Fatal("stale delivery was re-injected into the indexer")
	}
}

// T-IDX-028: when the bus is down the provider gets 503 (it retries), and a retry after recovery is published.
func TestPublishFailureIsRetryable(t *testing.T) {
	now := time.Now()
	hs, bus, _ := setup(t, now)
	b := body("r1", now)
	bus.fail = true
	if s := post(t, hs.URL+"/webhooks/alchemy", b, map[string]string{"X-Sig": sig(b)}); s != 503 {
		t.Fatalf("bus down: %d, want 503", s)
	}
	bus.fail = false
	if s := post(t, hs.URL+"/webhooks/alchemy", b, map[string]string{"X-Sig": sig(b)}); s != 200 || bus.count() != 1 {
		t.Fatalf("retry: status %d published %d", s, bus.count())
	}
}
