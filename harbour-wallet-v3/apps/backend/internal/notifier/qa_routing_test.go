package notifier

// QA (be-int, T-IDX-065): push routing against real Postgres + Redis with a capturing channel. Incoming activity reaches only the
// devices whose push routes include that address; spam / stale activity notifies nobody; an unverified token gets a generic title;
// a settled transaction notifies only the device that sent it; every (device, event) pair is delivered once.

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

type capChannel struct {
	mu   sync.Mutex
	sent []struct {
		endpoint string
		m        notify.Message
	}
}

func (c *capChannel) Name() string { return "webpush" }
func (c *capChannel) Send(_ context.Context, t notify.Target, m notify.Message) error {
	var tok struct{ Endpoint string }
	_ = json.Unmarshal([]byte(t.Token), &tok)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sent = append(c.sent, struct {
		endpoint string
		m        notify.Message
	}{tok.Endpoint, m})
	return nil
}
func (c *capChannel) take() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []string
	for _, s := range c.sent {
		out = append(out, s.endpoint+" | "+s.m.Title)
	}
	c.sent = nil
	return out
}

func TestQAPushRouting(t *testing.T) {
	rURL := os.Getenv("HB_TEST_REDIS_URL")
	if rURL == "" {
		t.Skip("HB_TEST_REDIS_URL not set")
	}
	ctx := context.Background()
	st, err := store.Open(ctx, testdb.URL(t, "qa_notifier"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if _, err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertChains(ctx, map[string]string{"base": "evm"}); err != nil {
		t.Fatal(err)
	}
	ropt, _ := redis.ParseURL(rURL)
	rdb := redis.NewClient(ropt)
	rdb.FlushDB(ctx)
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	ch := &capChannel{}
	n := &Notifier{St: st, LC: lc, Redis: rdb, Channels: map[string]notify.Channel{"webpush": ch}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	X, Y := "0x"+strings.Repeat("1", 40), "0x"+strings.Repeat("2", 40)
	mkDev := func(seed string, addr string, push bool) string {
		d, err := st.CreateDevice(ctx, []byte(strings.Repeat(seed, 32)), "default", nil)
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err := st.AddDeviceAddresses(ctx, lc, d.ID, []store.AddressRef{{Chain: "base", Address: addr}}, nil, 50); err != nil {
			t.Fatal(err)
		}
		if push {
			id, _ := st.TrackedID(ctx, "base", addr)
			if err := st.UpsertPushSub(ctx, store.PushSub{DeviceID: d.ID, Channel: "webpush", Endpoint: "https://push/" + seed, P256dh: "p", Auth: "a"}, [][]byte{lc.RouteTag(id)}); err != nil {
				t.Fatal(err)
			}
		}
		return d.ID
	}
	mkDev("1", X, true)
	d2 := mkDev("2", Y, true)
	mkDev("3", X, false)
	idX, _ := st.TrackedID(ctx, "base", X)
	dec := 18
	act := func(tx, kind, asset string, spam int, at time.Time) []byte {
		b, _ := json.Marshal(map[string]any{"tracked_address_id": idX, "chain": "base", "tx_hash": tx, "asset": asset, "kind": kind, "amount_raw": "1500000000000000000", "symbol": "ETH", "decimals": dec, "spam_score": spam, "block_time": at})
		return b
	}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(n.HandleActivity(ctx, act("0xa1", "native", "native", 0, time.Now())))
	got := ch.take()
	if len(got) != 1 || !strings.HasPrefix(got[0], "https://push/1 | Received 1.5 ETH") {
		t.Fatalf("native incoming: %v (only device 1 routes X with push)", got)
	}
	must(n.HandleActivity(ctx, act("0xa1", "native", "native", 0, time.Now())))
	if got := ch.take(); len(got) != 0 {
		t.Fatalf("same event delivered twice: %v", got)
	}
	must(n.HandleActivity(ctx, act("0xa2", "native", "native", 80, time.Now())))
	must(n.HandleActivity(ctx, act("0xa3", "native", "native", 0, time.Now().Add(-2*time.Hour))))
	if got := ch.take(); len(got) != 0 {
		t.Fatalf("spam or stale activity notified: %v", got)
	}
	must(n.HandleActivity(ctx, act("0xa4", "token", "0x"+strings.Repeat("9", 40), 0, time.Now())))
	if got := ch.take(); len(got) != 1 || !strings.HasSuffix(got[0], "| You received a token") {
		t.Fatalf("unverified token: %v", got)
	}
	// tx status: only the device that broadcast it (device 2), and only for settled states
	must(st.InsertPending(ctx, "base", "0x"+strings.Repeat("ab", 32), Y, 1, d2))
	tx := func(status string) []byte {
		b, _ := json.Marshal(map[string]any{"chain": "base", "tx_hash": "0x" + strings.Repeat("ab", 32), "status": status})
		return b
	}
	must(n.HandleTx(ctx, tx("pending")))
	if got := ch.take(); len(got) != 0 {
		t.Fatalf("pending notified: %v", got)
	}
	must(n.HandleTx(ctx, tx("confirmed")))
	if got := ch.take(); len(got) != 1 || got[0] != "https://push/2 | Transaction confirmed" {
		t.Fatalf("confirmed: %v", got)
	}
	// malformed events are dropped without error (no redelivery loop)
	for _, bad := range []string{"", "{", `{"tx_hash":""}`, `[]`} {
		must(n.HandleActivity(ctx, []byte(bad)))
		must(n.HandleTx(ctx, []byte(bad)))
	}
	if got := ch.take(); len(got) != 0 {
		t.Fatalf("malformed events notified: %v", got)
	}
	// Redis holds only keyed tags, never the readable device id / tx hash
	keys, _ := rdb.Keys(ctx, "hb:push:*").Result()
	for _, k := range keys {
		if strings.Contains(k, d2) || strings.Contains(k, "0xa1") {
			t.Fatalf("readable dedupe key %q", k)
		}
	}
}
