package api_test

// QA integration (P1/P2): simulate modes, broadcast after a failed pending insert, push route sync, media proxy under client
// disconnect and concurrency. Real Postgres + Redis (HB_TEST_*), fake gateway.
// TEST_PLAN: T-BE-060, T-BE-065, T-BE-070, T-BE-077, T-BE-076.

import (
	"bytes"
	"context"
	"crypto/ecdh"
	crand "crypto/rand"
	"encoding/base64"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/risk"
	"harbour/backend/internal/evmtx/devsign"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/store"
)

type qaSim struct {
	res risk.Result
	err error
}

func (q qaSim) Name() string { return "qa" }
func (q qaSim) Simulate(context.Context, string, map[string]any) (risk.Result, error) {
	return q.res, q.err
}

type qaLogBuf struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (l *qaLogBuf) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.Write(p)
}
func (l *qaLogBuf) String() string { l.mu.Lock(); defer l.mu.Unlock(); return l.b.String() }

// T-BE-060: simulator answers → mode "full" with formatted amounts; ErrUnsupported → basic mode silently; other error → basic + warn.
func TestQASimulateModes(t *testing.T) {
	logs := &qaLogBuf{}
	sim := &qaSim{}
	qaOptionsHook = func(o *api.Options) {
		o.Simulator = simProxy{sim}
		o.Log = slog.New(slog.NewTextHandler(logs, &slog.HandlerOptions{Level: slog.LevelDebug}))
	}
	defer func() { qaOptionsHook = nil }()
	e := qaServer(t, "qa_simulate", nil, func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x5208"}`)
	})
	c := e.device(t)
	ctx := context.Background()
	own(t, c, "ethereum")
	k, _ := devsign.ParseKey(evKey)
	body := map[string]any{"from": devsign.Address(k), "to": addr(2), "value": "0x1", "data": "0x"}
	sim.res = risk.Result{Changes: []risk.AssetChange{{AssetRef: "native", Kind: "native", ChangeType: "transfer", From: addr(1), To: addr(2), AmountRaw: "1500000000000000000", Symbol: "ETH", Decimals: 18},
		{AssetRef: addr(9), Kind: "token", ChangeType: "approve", AmountRaw: "123", Symbol: "X", Decimals: -1}}, GasUsed: 21000}
	var out map[string]any
	_, err := c.Do(ctx, "POST", "/v1/tx/ethereum/simulate", body, &out, nil)
	must(t, err)
	if out["mode"] != "full" || out["success"] != true {
		t.Fatalf("full mode: %v", out)
	}
	ch := out["changes"].([]any)
	first, second := ch[0].(map[string]any), ch[1].(map[string]any)
	if first["amount"] != "1.5" || first["amount_raw"] != "1500000000000000000" {
		t.Fatalf("formatted amount: %v", first)
	}
	if _, has := second["amount"]; has {
		t.Fatalf("unknown decimals must not be formatted: %v", second)
	}
	sim.res = risk.Result{Reverted: true}
	_, err = c.Do(ctx, "POST", "/v1/tx/ethereum/simulate", body, &out, nil)
	must(t, err)
	if out["success"] != false || out["message"] == nil {
		t.Fatalf("reverted: %v", out)
	}
	sim.err = risk.ErrUnsupported
	_, err = c.Do(ctx, "POST", "/v1/tx/ethereum/simulate", body, &out, nil)
	must(t, err)
	if out["mode"] == "full" {
		t.Fatalf("unsupported → basic mode, got %v", out)
	}
	if strings.Contains(logs.String(), "simulator failed") {
		t.Fatal("ErrUnsupported logged as a failure")
	}
	sim.err = errors.New("provider 500")
	_, err = c.Do(ctx, "POST", "/v1/tx/ethereum/simulate", body, &out, nil)
	must(t, err)
	if out["mode"] == "full" || !strings.Contains(logs.String(), "simulator failed; using basic check") {
		t.Fatalf("simulator error → basic + warn: %v / logs %q", out, logs.String())
	}
}

type simProxy struct{ s *qaSim }

func (p simProxy) Name() string { return "qa" }
func (p simProxy) Simulate(ctx context.Context, c string, tx map[string]any) (risk.Result, error) {
	return p.s.Simulate(ctx, c, tx)
}

// T-BE-065: the node accepted the tx but recording it as pending failed → 500 (the tx WAS sent); the client retries with the same
// Idempotency-Key → the node says "already known" → 200 with the same hash and exactly one pending row.
func TestQABroadcastRetryAfterPendingInsertFailure(t *testing.T) {
	var sends atomic.Int64
	e := qaServer(t, "qa_bc_pendingfail", nil, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if bytes.Contains(b, []byte("eth_sendRawTransaction")) && sends.Add(1) > 1 {
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"already known"}}`)
			return
		}
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x`+strings.Repeat("ab", 32)+`"}`)
	})
	c := e.device(t)
	own(t, c, "base")
	ctx := context.Background()
	raw, hash := signedTx(t, e, "base", 3)
	// a one-shot failure on the pending insert (test database only)
	// (a sequence, because nextval is not rolled back with the failing statement)
	_, err := e.st.Pool.Exec(ctx, `CREATE SEQUENCE qa_fail_seq;
		CREATE FUNCTION qa_fail_pending() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
		  IF nextval('qa_fail_seq') = 1 THEN RAISE EXCEPTION 'qa: disk full'; END IF; RETURN NEW; END $$;
		CREATE TRIGGER qa_fail_pending BEFORE INSERT ON pending_transactions FOR EACH ROW EXECUTE FUNCTION qa_fail_pending();`)
	must(t, err)
	hdr := http.Header{"Idempotency-Key": {"bc-retry-1"}}
	var out map[string]any
	_, err = c.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": raw}, &out, hdr)
	he, ok := err.(*hbclient.HTTPError)
	if !ok || he.Status != 500 || !strings.Contains(he.Body, `"retryable":true`) || strings.Contains(he.Body, "disk full") {
		t.Fatalf("first attempt: %v", err)
	}
	_, err = c.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": raw}, &out, hdr)
	if err != nil {
		t.Fatalf("retry with the same Idempotency-Key: %v", err)
	}
	if out["tx_hash"] != hash {
		t.Fatalf("retry hash %v, want %s", out["tx_hash"], hash)
	}
	var n int
	must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*) FROM pending_transactions WHERE tx_hash=hb_ref($1)`, hash).Scan(&n))
	if n != 1 {
		t.Fatalf("%d pending rows", n)
	}
	if sends.Load() != 2 {
		t.Fatalf("node saw %d sends, want 2 (original + idempotent resubmission answered 'already known')", sends.Load())
	}
}

// T-BE-070: PUT /v1/me/push stores the subscription with route tags = the device's tracked addresses; adding/removing addresses
// resyncs the routes; DELETE removes the subscription and every route.
func TestQAPushRoutesFollowAddresses(t *testing.T) {
	e := qaServer(t, "qa_push_routes", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "ethereum", "address": addr(1)}, {"chain": "base", "address": addr(2)}}}, nil, nil)
	must(t, err)
	ua, _ := ecdh.P256().GenerateKey(crand.Reader)
	b64 := base64.RawURLEncoding.EncodeToString
	_, err = c.Do(ctx, "PUT", "/v1/me/push", map[string]any{"endpoint": "https://fcm.googleapis.com/fcm/send/qa", "keys": map[string]string{"p256dh": b64(ua.PublicKey().Bytes()), "auth": b64(make([]byte, 16))}}, nil, nil)
	must(t, err)
	routes := func() int {
		var n int
		must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*) FROM push_routes WHERE device_id=$1::uuid`, c.DeviceID).Scan(&n))
		return n
	}
	if routes() != 2 {
		t.Fatalf("routes after PUT push: %d, want 2", routes())
	}
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "polygon", "address": addr(3)}}, "remove": []map[string]string{{"chain": "ethereum", "address": addr(1)}}}, nil, nil)
	must(t, err)
	if routes() != 2 {
		t.Fatalf("routes after +1/-1 addresses: %d, want 2", routes())
	}
	var tags [][]byte
	rows, err := e.st.Pool.Query(ctx, `SELECT route_tag FROM push_routes WHERE device_id=$1::uuid`, c.DeviceID)
	must(t, err)
	for rows.Next() {
		var b []byte
		must(t, rows.Scan(&b))
		tags = append(tags, b)
	}
	rows.Close()
	for _, b := range tags {
		if bytes.Contains(b, []byte(addr(2))) || bytes.Contains(b, []byte(addr(3))) {
			t.Fatal("a route tag contains the plain address (must be a keyed tag)")
		}
	}
	_, err = c.Do(ctx, "DELETE", "/v1/me/push", nil, nil, nil)
	must(t, err)
	var subs int
	must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*) FROM push_subscriptions WHERE device_id=$1::uuid`, c.DeviceID).Scan(&subs))
	if subs != 0 || routes() != 0 {
		t.Fatalf("after DELETE: %d subscriptions, %d routes", subs, routes())
	}
	// with no subscription, address changes create no routes
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": addr(4)}}}, nil, nil)
	must(t, err)
	if routes() != 0 {
		t.Fatal("routes created for a device without a push subscription")
	}
}

func qaPNG(t *testing.T) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	for i := 0; i < 8; i++ {
		img.Set(i, i, color.RGBA{255, 0, 0, 255})
	}
	var b bytes.Buffer
	must(t, png.Encode(&b, img))
	return b.Bytes()
}

func qaSeedMedia(t *testing.T, e *qaEnv, srcs ...string) []string {
	t.Helper()
	ctx := context.Background()
	var ta, asset int64
	must(t, e.st.Pool.QueryRow(ctx, `INSERT INTO tracked_addresses(chain_id, address) VALUES ('base', $1) RETURNING id`, addr(77)).Scan(&ta))
	must(t, e.st.Pool.QueryRow(ctx, `INSERT INTO assets(chain_id, asset_ref, kind) VALUES ('base', hb_ref($1), 'nft') RETURNING id`, addr(78)).Scan(&asset))
	var keys []string
	for i, s := range srcs {
		k := store.MediaKey(s)
		_, err := e.st.Pool.Exec(ctx, `INSERT INTO nft_holdings(tracked_address_id, asset_id, token_id, media_key, image_src) VALUES ($1,$2,$3,$4,$5)`, ta, asset, i+1, k, s)
		must(t, err)
		keys = append(keys, k)
	}
	return keys
}

// T-BE-077: a client that disconnects mid-fetch does not cancel the fetch; the image is cached positively and the next client
// gets it from cache (one upstream fetch). T-BE-076: 10 cold fetches at once → at most 4 decode at the same time.
func TestQAMediaDisconnectAndConcurrency(t *testing.T) {
	qaOptionsHook = func(o *api.Options) { o.AllowPrivateMedia = true }
	defer func() { qaOptionsHook = nil }()
	pngBytes := qaPNG(t)
	var hits, inflight, peak atomic.Int64
	img := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		n := inflight.Add(1)
		for {
			p := peak.Load()
			if n <= p || peak.CompareAndSwap(p, n) {
				break
			}
		}
		time.Sleep(700 * time.Millisecond)
		inflight.Add(-1)
		w.Header().Set("Content-Type", "image/png")
		w.Write(pngBytes)
	}))
	defer img.Close()
	e := qaServer(t, "qa_media_disc", nil, nil)
	srcs := []string{img.URL + "/slow.png"}
	for i := 0; i < 10; i++ {
		srcs = append(srcs, img.URL+"/c"+string(rune('a'+i))+".png")
	}
	keys := qaSeedMedia(t, e, srcs...)

	// client gives up after 150 ms
	cctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	req, _ := http.NewRequestWithContext(cctx, "GET", e.hs.URL+"/v1/media/"+keys[0], nil)
	if _, err := http.DefaultClient.Do(req); err == nil {
		t.Fatal("expected the client to time out")
	}
	cancel()
	time.Sleep(1200 * time.Millisecond) // the server-side fetch finishes on its own deadline
	resp, err := http.Get(e.hs.URL + "/v1/media/" + keys[0])
	must(t, err)
	b, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || !bytes.HasPrefix(b, []byte("\x89PNG")) {
		t.Fatalf("after a disconnect: %d (a negative cache would give 404)", resp.StatusCode)
	}
	if hits.Load() != 1 {
		t.Fatalf("upstream hit %d times, want 1 (second client served from cache)", hits.Load())
	}

	// 10 concurrent cold fetches
	peak.Store(0)
	var wg sync.WaitGroup
	codes := make([]int, 10)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			r, err := http.Get(e.hs.URL + "/v1/media/" + keys[i+1])
			if err == nil {
				codes[i] = r.StatusCode
				r.Body.Close()
			}
		}(i)
	}
	wg.Wait()
	if peak.Load() > 4 {
		t.Fatalf("%d concurrent upstream fetches, cap is 4", peak.Load())
	}
	for i, c := range codes {
		if c != 200 && c != 503 {
			t.Fatalf("request %d → %d", i, c)
		}
	}
}

type qaPublisher struct {
	mu   sync.Mutex
	msgs []string
}

func (p *qaPublisher) Publish(_ context.Context, subject string, data []byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.msgs = append(p.msgs, subject+" "+string(data))
	return nil
}

// T-BE-052: /v1/me/nfts with a dirty list asks the indexer for a sync (at most once a minute per address), reports syncing, and
// every image URL is a /v1/media key (never the source URL); spam NFTs get no image.
func TestQANFTsDirtyFlagRequestsSync(t *testing.T) {
	pub := &qaPublisher{}
	qaOptionsHook = func(o *api.Options) { o.Events = pub }
	defer func() { qaOptionsHook = nil }()
	e := qaServer(t, "qa_nfts_dirty", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": addr(5)}}}, nil, nil)
	must(t, err)
	var ta, asset, spam int64
	must(t, e.st.Pool.QueryRow(ctx, `UPDATE tracked_addresses SET backfill_state='done', nft_dirty=true WHERE chain_id='base' AND lower(address)=lower($1) RETURNING id`, addr(5)).Scan(&ta))
	must(t, e.st.Pool.QueryRow(ctx, `INSERT INTO assets(chain_id, asset_ref, kind, symbol) VALUES ('base', hb_ref($1), 'nft', 'CAT') RETURNING id`, addr(60)).Scan(&asset))
	must(t, e.st.Pool.QueryRow(ctx, `INSERT INTO assets(chain_id, asset_ref, kind, symbol, spam_score) VALUES ('base', hb_ref($1), 'nft', 'Claim at evil', 90) RETURNING id`, addr(61)).Scan(&spam))
	src := "https://img.example/cat.png"
	_, err = e.st.Pool.Exec(ctx, `INSERT INTO nft_holdings(tracked_address_id, asset_id, token_id, media_key, image_src, name) VALUES ($1,$2,1,$3,$4,'Cat'), ($1,$5,2,$6,'https://evil.example/x.png','Spam')`,
		ta, asset, store.MediaKey(src), src, spam, store.MediaKey("https://evil.example/x.png"))
	must(t, err)
	var out struct {
		NFTs []struct {
			TokenID  string  `json:"token_id"`
			ImageURL *string `json:"image_url"`
			Spam     bool    `json:"spam"`
		} `json:"nfts"`
		Syncing bool `json:"syncing"`
	}
	for i := 0; i < 3; i++ {
		_, err = c.Do(ctx, "GET", "/v1/me/nfts", nil, &out, nil)
		must(t, err)
	}
	if !out.Syncing {
		t.Fatal("dirty list not reported as syncing")
	}
	pub.mu.Lock()
	n := 0
	for _, m := range pub.msgs {
		if strings.HasPrefix(m, "address.nfts.sync ") && strings.Contains(m, `"tracked_address_id":`) {
			n++
		}
	}
	pub.mu.Unlock()
	if n != 1 {
		t.Fatalf("%d nfts.sync requests for 3 reads within a minute, want 1 (%v)", n, pub.msgs)
	}
	for _, x := range out.NFTs {
		if x.Spam {
			if x.ImageURL != nil {
				t.Fatalf("spam NFT has an image: %v", *x.ImageURL)
			}
			continue
		}
		if x.ImageURL == nil || *x.ImageURL != "/v1/media/"+store.MediaKey(src) {
			t.Fatalf("image url %v", x.ImageURL)
		}
	}
	// once the indexer clears the flag, no further requests
	_, err = e.st.Pool.Exec(ctx, `UPDATE tracked_addresses SET nft_dirty=false WHERE id=$1`, ta)
	must(t, err)
	_, err = c.Do(ctx, "GET", "/v1/me/nfts", nil, &out, nil)
	must(t, err)
	if out.Syncing {
		t.Fatal("clean list reported as syncing")
	}
}

// T-X-004: the signed-request clock window is inclusive at exactly ClockSkew and refuses one second beyond, in both directions.
func TestQAClockSkewBoundary(t *testing.T) {
	fixed := time.Unix(1_900_000_000, 0)
	qaOptionsHook = func(o *api.Options) { o.Now = func() time.Time { return fixed } }
	defer func() { qaOptionsHook = nil }()
	e := qaServer(t, "qa_clock_skew", nil, nil)
	c := hbclient.New(e.hs.URL)
	c.Now = func() time.Time { return fixed }
	_, err := c.Register(context.Background())
	must(t, err)
	skew := e.cfg.API.ClockSkew
	for _, tc := range []struct {
		off  time.Duration
		want bool
	}{{0, true}, {skew, true}, {-skew, true}, {skew + time.Second, false}, {-skew - time.Second, false}} {
		c.Now = func() time.Time { return fixed.Add(tc.off) }
		_, err := c.Do(context.Background(), "GET", "/v1/me", nil, nil, nil)
		if (err == nil) != tc.want {
			t.Errorf("client clock %+v from server: err=%v, want accepted=%v", tc.off, err, tc.want)
		}
		if err != nil && errCode(err) == "" {
			t.Errorf("refusal without an error code: %v", err)
		}
	}
}

// T-X-003 (backend part): the daily backfill budget is keyed by the UTC date — exhausted at 23:59:59.999 UTC, fresh at 00:00:00 UTC,
// whatever the server's local time zone.
func TestQADailyCounterUTCMidnight(t *testing.T) {
	t.Setenv("TZ", "Pacific/Kiritimati") // UTC+14: the local date is already "tomorrow"
	clock := time.Date(2026, 12, 31, 23, 59, 59, 999_000_000, time.UTC)
	var mu sync.Mutex
	qaOptionsHook = func(o *api.Options) { o.Now = func() time.Time { mu.Lock(); defer mu.Unlock(); return clock } }
	defer func() { qaOptionsHook = nil }()
	e := qaServer(t, "qa_daily_utc", tune(func(t *config.Tier) { t.BackfillsPerDay = 1 }), nil)
	c := hbclient.New(e.hs.URL)
	c.Now = func() time.Time { mu.Lock(); defer mu.Unlock(); return clock }
	_, err := c.Register(context.Background())
	must(t, err)
	put := func(i int) error {
		_, err := c.Do(context.Background(), "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": addr(500 + i)}}}, nil, nil)
		return err
	}
	must(t, put(1))
	if err := put(2); errCode(err) != "backfill_quota" {
		t.Fatalf("second backfill on the same UTC day: %v, want backfill_quota", err)
	}
	mu.Lock()
	clock = time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)
	mu.Unlock()
	if err := put(3); err != nil {
		t.Fatalf("new UTC day: %v", err)
	}
	keys, _ := e.rdb.Keys(context.Background(), "*20270101*").Result()
	if len(keys) == 0 {
		t.Fatal("no counter keyed by the UTC date 20270101")
	}
}
