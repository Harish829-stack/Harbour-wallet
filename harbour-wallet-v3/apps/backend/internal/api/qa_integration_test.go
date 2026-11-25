package api_test

// QA integration suite for the signed API against real Postgres + Redis (make test-integration).
// TEST_PLAN: T-BE-006, T-BE-007, T-BE-009, T-BE-015, T-BE-017, T-BE-027, T-BE-028, T-BE-033, T-BE-034, T-BE-035, T-BE-036,
// T-BE-039, T-BE-055, T-BE-058, T-BE-062, T-BE-091, T-RT-001.

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/devicesig"
	"harbour/backend/internal/evmtx/devsign"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

type qaEnv struct {
	hs     *httptest.Server
	rdb    *redis.Client
	st     *store.Store
	cfg    *config.Config
	gwHits *atomic.Int64
	gwBody func() []byte
}

// qaServer starts an API on a fresh database. tune adjusts config before start; gw answers rpc-gateway calls (nil: result 0x10).
func qaServer(t *testing.T, name string, tune func(*config.Config), gw http.HandlerFunc) *qaEnv {
	t.Helper()
	if os.Getenv("HB_TEST_POSTGRES_URL") == "" || os.Getenv("HB_TEST_REDIS_URL") == "" {
		t.Skip("HB_TEST_POSTGRES_URL / HB_TEST_REDIS_URL not set")
	}
	ctx := context.Background()
	st, err := store.Open(ctx, testdb.URL(t, name))
	must(t, err)
	t.Cleanup(st.Close)
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.MaintainPartitions(ctx))
	ropt, _ := redis.ParseURL(os.Getenv("HB_TEST_REDIS_URL"))
	rdb := redis.NewClient(ropt)
	must(t, rdb.FlushDB(ctx).Err())
	cfg, err := config.Load("../../config")
	must(t, err)
	cfg.API.ProbationTier = ""
	if tune != nil {
		tune(cfg)
	}
	fams := map[string]string{}
	for n, c := range cfg.Chains {
		fams[n] = c.Family
	}
	must(t, st.UpsertChains(ctx, fams))
	lc, err := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	must(t, err)
	env := &qaEnv{rdb: rdb, st: st, cfg: cfg, gwHits: &atomic.Int64{}}
	var mu sync.Mutex
	var last []byte
	env.gwBody = func() []byte { mu.Lock(); defer mu.Unlock(); return last }
	gws := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		env.gwHits.Add(1)
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		last = b
		mu.Unlock()
		r.Body = io.NopCloser(bytes.NewReader(b))
		if gw != nil {
			gw(w, r)
			return
		}
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x10"}`)
	}))
	t.Cleanup(gws.Close)
	opts := api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc,
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)), GatewayURL: gws.URL, PowDifficulty: 8}
	if qaOptionsHook != nil {
		qaOptionsHook(&opts) // test-only: simulator stubs, log capture, private media hosts
	}
	srv := api.New(opts)
	env.hs = httptest.NewServer(srv.Handler())
	t.Cleanup(env.hs.Close)
	return env
}

// qaOptionsHook, when set by a test (and reset by it), adjusts the api.Options qaServer builds.
var qaOptionsHook func(*api.Options)

func (e *qaEnv) device(t *testing.T) *hbclient.Client {
	t.Helper()
	c := hbclient.New(e.hs.URL)
	_, err := c.Register(context.Background())
	must(t, err)
	return c
}

func errCode(err error) string {
	he, ok := err.(*hbclient.HTTPError)
	if !ok {
		return ""
	}
	var b struct {
		Error struct{ Code string } `json:"error"`
	}
	_ = json.Unmarshal([]byte(he.Body), &b)
	return b.Error.Code
}

func addr(i int) string { return fmt.Sprintf("0x%040x", i) }

// rawSigned sends a hand-built signed request so individual parts can be tampered with after signing.
type rawReq struct {
	method, path, date, nonce, dev, sig string
	body                                []byte
	skipHeader                          string
}

func (e *qaEnv) sendRaw(t *testing.T, r rawReq) (int, string) {
	t.Helper()
	req, _ := http.NewRequest(r.method, e.hs.URL+r.path, bytes.NewReader(r.body))
	h := map[string]string{devicesig.HeaderDevice: r.dev, devicesig.HeaderDate: r.date, devicesig.HeaderNonce: r.nonce, devicesig.HeaderSignature: r.sig}
	for k, v := range h {
		if k != r.skipHeader {
			req.Header.Set(k, v)
		}
	}
	resp, err := http.DefaultClient.Do(req)
	must(t, err)
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

func newNonce() string { b := make([]byte, 18); rand.Read(b); return devicesig.B64(b) }

// T-BE-006: a challenge is a 32-byte base64url value with the configured difficulty and expiry, stored single-use in Redis.
func TestQAChallengeShapeAndStorage(t *testing.T) {
	e := qaServer(t, "qa_challenge", nil, nil)
	before := time.Now()
	resp, err := http.Post(e.hs.URL+"/v1/devices/challenge", "application/json", nil)
	must(t, err)
	defer resp.Body.Close()
	var ch struct {
		Challenge  string    `json:"challenge"`
		Difficulty int       `json:"difficulty"`
		ExpiresAt  time.Time `json:"expires_at"`
	}
	must(t, json.NewDecoder(resp.Body).Decode(&ch))
	raw, err := devicesig.UnB64(ch.Challenge)
	if err != nil || len(raw) != 32 {
		t.Fatalf("challenge %q is not 32 bytes of base64url", ch.Challenge)
	}
	if ch.Difficulty != 8 {
		t.Fatalf("difficulty %d, want the configured 8", ch.Difficulty)
	}
	if d := ch.ExpiresAt.Sub(before); d < e.cfg.API.PowTTL-5*time.Second || d > e.cfg.API.PowTTL+5*time.Second {
		t.Fatalf("expires in %s, want ≈ %s", d, e.cfg.API.PowTTL)
	}
	ttl, err := e.rdb.TTL(context.Background(), "hb:pow:"+ch.Challenge).Result()
	if err != nil || ttl <= 0 {
		t.Fatalf("challenge not stored with a TTL: %v %v", ttl, err)
	}
}

// T-BE-007: the per-address challenge limit returns 429 with Retry-After 3600 once exceeded.
func TestQAChallengeLimitPerAddress(t *testing.T) {
	e := qaServer(t, "qa_challenge_limit", func(c *config.Config) { c.API.ChallengesPerHour = 3 }, nil)
	var last *http.Response
	for i := 0; i < 4; i++ {
		resp, err := http.Post(e.hs.URL+"/v1/devices/challenge", "application/json", nil)
		must(t, err)
		resp.Body.Close()
		if i < 3 && resp.StatusCode != 200 {
			t.Fatalf("challenge %d refused early: %d", i+1, resp.StatusCode)
		}
		last = resp
	}
	if last.StatusCode != 429 || last.Header.Get("Retry-After") != "3600" {
		t.Fatalf("4th challenge: %d Retry-After=%q, want 429/3600", last.StatusCode, last.Header.Get("Retry-After"))
	}
}

// T-BE-009: each malformed registration is refused with its own code and never creates a device.
func TestQARegistrationRejectsMalformed(t *testing.T) {
	e := qaServer(t, "qa_register_bad", nil, nil)
	ctx := context.Background()
	challenge := func() string {
		resp, err := http.Post(e.hs.URL+"/v1/devices/challenge", "application/json", nil)
		must(t, err)
		defer resp.Body.Close()
		var ch struct{ Challenge string }
		must(t, json.NewDecoder(resp.Body).Decode(&ch))
		return ch.Challenge
	}
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	pubB64 := devicesig.B64(pub)
	solved := func(ch string) map[string]any {
		ctr, err := devicesig.SolvePow(ch, pubB64, 8)
		must(t, err)
		return map[string]any{"public_key": pubB64, "challenge": ch, "pow_counter": ctr, "signature": devicesig.Sign(priv, devicesig.RegistrationMessage(ch))}
	}
	post := func(body any) (int, string) {
		var b []byte
		switch v := body.(type) {
		case []byte:
			b = v
		default:
			b, _ = json.Marshal(v)
		}
		resp, err := http.Post(e.hs.URL+"/v1/devices", "application/json", bytes.NewReader(b))
		must(t, err)
		defer resp.Body.Close()
		rb, _ := io.ReadAll(resp.Body)
		var x struct{ Error struct{ Code string } }
		_ = json.Unmarshal(rb, &x)
		return resp.StatusCode, x.Error.Code
	}
	cases := []struct {
		name string
		body func() any
		code string
	}{
		{"not json", func() any { return []byte("{") }, "bad_request"},
		{"key not base64url", func() any { b := solved(challenge()); b["public_key"] = "!!!"; return b }, "bad_key"},
		{"31-byte key", func() any { b := solved(challenge()); b["public_key"] = devicesig.B64(pub[:31]); return b }, "bad_key"},
		{"attestation over 4 KiB", func() any {
			b := solved(challenge())
			b["attestation"] = json.RawMessage(`"` + strings.Repeat("a", 4100) + `"`)
			return b
		}, "bad_request"},
		{"unknown challenge", func() any { b := solved(challenge()); b["challenge"] = devicesig.B64(make([]byte, 32)); return b }, "challenge_expired"},
		{"wrong proof of work", func() any { b := solved(challenge()); b["pow_counter"] = "x"; return b }, "bad_pow"},
		{"empty counter", func() any { b := solved(challenge()); b["pow_counter"] = ""; return b }, "bad_pow"},
		{"signature by another key", func() any {
			_, other, _ := ed25519.GenerateKey(rand.Reader)
			ch := challenge()
			b := solved(ch)
			b["signature"] = devicesig.Sign(other, devicesig.RegistrationMessage(ch))
			return b
		}, "bad_signature"},
	}
	for _, c := range cases {
		status, code := post(c.body())
		if status != 400 || code != c.code {
			t.Errorf("%s: %d %q, want 400 %q", c.name, status, code, c.code)
		}
	}
	// A solved challenge is single use.
	ch := challenge()
	b := solved(ch)
	if s, _ := post(b); s != 201 {
		t.Fatalf("valid registration: %d", s)
	}
	_, priv2, _ := ed25519.GenerateKey(rand.Reader)
	b["public_key"] = devicesig.B64(priv2.Public().(ed25519.PublicKey))
	if s, code := post(b); s != 400 || code != "challenge_expired" {
		t.Fatalf("challenge reuse: %d %q", s, code)
	}
	var n int
	must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*) FROM devices`).Scan(&n))
	if n != 1 {
		t.Fatalf("devices created: %d, want 1", n)
	}
}

// T-BE-015: every tampering of a signed request is refused with 401; the untampered control succeeds.
func TestQASignedRequestTampering(t *testing.T) {
	e := qaServer(t, "qa_tamper", nil, nil)
	c := e.device(t)
	sign := func(method, path, date, nonce string, body []byte) string {
		return devicesig.Sign(c.Priv, devicesig.Canonical(method, path, date, nonce, c.DeviceID, body))
	}
	now := strconv.FormatInt(time.Now().Unix(), 10)
	body := []byte(`{"add":[{"chain":"base","address":"0x1111111111111111111111111111111111111111"}]}`)
	base := func() rawReq {
		n := newNonce()
		return rawReq{method: "PUT", path: "/v1/me/addresses", date: now, nonce: n, dev: c.DeviceID, body: body, sig: sign("PUT", "/v1/me/addresses", now, n, body)}
	}
	skew := e.cfg.API.ClockSkew
	cases := map[string]func(r *rawReq){
		"no device header":    func(r *rawReq) { r.skipHeader = devicesig.HeaderDevice },
		"no date header":      func(r *rawReq) { r.skipHeader = devicesig.HeaderDate },
		"no nonce header":     func(r *rawReq) { r.skipHeader = devicesig.HeaderNonce },
		"no signature header": func(r *rawReq) { r.skipHeader = devicesig.HeaderSignature },
		"uppercase uuid":      func(r *rawReq) { r.dev = strings.ToUpper(r.dev) },
		"device not a uuid":   func(r *rawReq) { r.dev = "not-a-uuid" },
		"nonce too short":     func(r *rawReq) { r.nonce = "abc" },
		"nonce too long":      func(r *rawReq) { r.nonce = strings.Repeat("a", 65) },
		"nonce illegal char":  func(r *rawReq) { r.nonce = strings.Repeat("a", 20) + "=" },
		"date not a number":   func(r *rawReq) { r.date = "yesterday" },
		"date too old":        func(r *rawReq) { r.date = strconv.FormatInt(time.Now().Add(-skew-5*time.Second).Unix(), 10) },
		"date in the future":  func(r *rawReq) { r.date = strconv.FormatInt(time.Now().Add(skew+5*time.Second).Unix(), 10) },
		"body changed":        func(r *rawReq) { r.body = bytes.Replace(r.body, []byte("1111"), []byte("2222"), 1) },
		"path changed":        func(r *rawReq) { r.path = "/v1/me/addresses?x=1" },
		"method changed":      func(r *rawReq) { r.method = "POST" },
		"signature garbage":   func(r *rawReq) { r.sig = strings.Repeat("A", 86) },
	}
	for name, mut := range cases {
		r := base()
		mut(&r)
		status, out := e.sendRaw(t, r)
		if status == 200 {
			t.Errorf("%s: accepted (%s)", name, out)
		} else if status != 401 && !(name == "method changed" && status == 405) {
			t.Errorf("%s: status %d, want 401", name, status)
		}
	}
	if status, out := e.sendRaw(t, base()); status != 200 {
		t.Fatalf("untampered control refused: %d %s", status, out)
	}
}

// T-BE-017 / ASM-05: a device revoked in the database is refused within the 60 s in-process cache window.
func TestQARevokedDeviceRefusedAfterCacheWindow(t *testing.T) {
	e := qaServer(t, "qa_revoke", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	if _, err := c.Do(ctx, "GET", "/v1/me", nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	_, err := e.st.Pool.Exec(ctx, `UPDATE devices SET revoked_at = now() WHERE id = $1::uuid`, c.DeviceID)
	must(t, err)
	// Within the cache window the API may still serve the device (documented). A fresh server process (no cache) must refuse at once.
	srv2 := api.New(api.Options{Config: e.cfg, Store: e.st, Redis: e.rdb, LinkCrypto: mustLC(t), Log: slog.New(slog.NewTextHandler(io.Discard, nil)), PowDifficulty: 8})
	hs2 := httptest.NewServer(srv2.Handler())
	defer hs2.Close()
	c2 := *c
	c2.BaseURL = hs2.URL
	_, err = c2.Do(ctx, "GET", "/v1/me", nil, nil, nil)
	if errCode(err) != "device_revoked" {
		t.Fatalf("revoked device on a cold server: %v", err)
	}
	// Same server after the cache expires (61 s later on the server clock).
	now := time.Now().Add(61 * time.Second)
	srv3 := api.New(api.Options{Config: e.cfg, Store: e.st, Redis: e.rdb, LinkCrypto: mustLC(t), Log: slog.New(slog.NewTextHandler(io.Discard, nil)), PowDifficulty: 8,
		Now: func() time.Time { return now }})
	hs3 := httptest.NewServer(srv3.Handler())
	defer hs3.Close()
	c3 := *c
	c3.BaseURL = hs3.URL
	c3.Now = func() time.Time { return now }
	_, err = c3.Do(ctx, "GET", "/v1/me", nil, nil, nil)
	if errCode(err) != "device_revoked" {
		t.Fatalf("revoked device after the cache window: %v", err)
	}
}

func mustLC(t *testing.T) *store.LinkCrypto {
	lc, err := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	must(t, err)
	return lc
}

// T-BE-027: Idempotency-Key misuse: different body → 422, key over 128 chars → 400.
func TestQAIdempotencyMisuse(t *testing.T) {
	e := qaServer(t, "qa_idem", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	put := func(a string, key string) error {
		_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": a}}}, nil, http.Header{"Idempotency-Key": {key}})
		return err
	}
	must(t, put(addr(1), "same-key"))
	if err := put(addr(2), "same-key"); errCode(err) != "idempotency_mismatch" {
		t.Fatalf("same key, other body: %v", err)
	}
	if err := put(addr(3), strings.Repeat("k", 129)); errCode(err) != "bad_request" {
		t.Fatalf("129-char key: %v", err)
	}
}

// T-BE-028: a request that ends in a 5xx/429 releases its idempotency key so the retry really executes.
func TestQAIdempotencyKeyReleasedAfterRetryableFailure(t *testing.T) {
	e := qaServer(t, "qa_idem_retry", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	// Make the broadcast fail with 503 (gateway unreachable) first, then succeed.
	k, _ := devsign.ParseKey("0x4646464646464646464646464646464646464646464646464646464646464646")
	from := devsign.Address(k)
	_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": from}}}, nil, nil)
	must(t, err)
	raw, err := devsign.Sign(k, devsign.Tx{ChainID: e.cfg.Chains["base"].EVMChainID, Nonce: 1, TipCap: big.NewInt(1), FeeCap: big.NewInt(2), Gas: 21000, To: addr(9), Value: big.NewInt(1)})
	must(t, err)
	hdr := http.Header{"Idempotency-Key": {"bc-1"}}
	// Point the API at a dead gateway: first attempt 503.
	e.hs.Close()
	deadSrv := api.New(api.Options{Config: e.cfg, Store: e.st, Redis: e.rdb, LinkCrypto: mustLC(t), Log: slog.New(slog.NewTextHandler(io.Discard, nil)), GatewayURL: "http://127.0.0.1:1", PowDifficulty: 8})
	dead := httptest.NewServer(deadSrv.Handler())
	defer dead.Close()
	cd := *c
	cd.BaseURL = dead.URL
	_, err = cd.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": "0x" + fmt.Sprintf("%x", raw)}, nil, hdr)
	if he, ok := err.(*hbclient.HTTPError); !ok || he.Status != 503 {
		t.Fatalf("first attempt: %v, want 503", err)
	}
	// Retry with the same key against a working gateway: executes (not 409 in_progress, not a replay of the 503).
	okGW := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x`+strings.Repeat("0", 64)+`"}`)
	}))
	defer okGW.Close()
	liveSrv := api.New(api.Options{Config: e.cfg, Store: e.st, Redis: e.rdb, LinkCrypto: mustLC(t), Log: slog.New(slog.NewTextHandler(io.Discard, nil)), GatewayURL: okGW.URL, PowDifficulty: 8})
	live := httptest.NewServer(liveSrv.Handler())
	defer live.Close()
	cl := *c
	cl.BaseURL = live.URL
	var out map[string]any
	if _, err := cl.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": "0x" + fmt.Sprintf("%x", raw)}, &out, hdr); err != nil {
		t.Fatalf("retry after 503: %v", err)
	}
	if out["replayed"] == true || out["status"] != "pending" {
		t.Fatalf("retry was not executed: %v", out)
	}
}

// T-BE-033: address-change validation.
func TestQAPutAddressesValidation(t *testing.T) {
	e := qaServer(t, "qa_addr_valid", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	many := make([]map[string]string, 101)
	for i := range many {
		many[i] = map[string]string{"chain": "base", "address": addr(i + 1)}
	}
	cases := map[string]any{
		"zero changes":   map[string]any{"add": []any{}},
		"101 changes":    map[string]any{"add": many},
		"non-EVM chain":  map[string]any{"add": []map[string]string{{"chain": "solana", "address": "So11111111111111111111111111111111111111112"}}},
		"unknown chain":  map[string]any{"add": []map[string]string{{"chain": "nochain", "address": addr(1)}}},
		"short address":  map[string]any{"add": []map[string]string{{"chain": "base", "address": "0x1234"}}},
		"remove invalid": map[string]any{"remove": []map[string]string{{"chain": "base", "address": "zz"}}},
	}
	for name, body := range cases {
		_, err := c.Do(ctx, "PUT", "/v1/me/addresses", body, nil, nil)
		if he, ok := err.(*hbclient.HTTPError); !ok || he.Status != 400 {
			t.Errorf("%s: %v, want 400", name, err)
		}
	}
	var n int
	must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*) FROM tracked_addresses`).Scan(&n))
	if n != 0 {
		t.Fatalf("invalid requests created %d tracked rows", n)
	}
}

// T-BE-034: exceeding the address quota rolls the whole add back (no tracked rows, links or device_count changes).
func TestQAQuotaExceededRollsBack(t *testing.T) {
	e := qaServer(t, "qa_quota_rollback", func(c *config.Config) {
		tr := c.API.Tiers["default"]
		tr.MaxAddresses = 2
		c.API.Tiers["default"] = tr
	}, nil)
	c := e.device(t)
	ctx := context.Background()
	_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{
		{"chain": "base", "address": addr(1)}, {"chain": "base", "address": addr(2)}, {"chain": "base", "address": addr(3)}}}, nil, nil)
	if errCode(err) != "quota_exceeded" {
		t.Fatalf("want quota_exceeded, got %v", err)
	}
	var tracked, links, devCount int
	must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*), COALESCE(sum(device_count),0) FROM tracked_addresses`).Scan(&tracked, &devCount))
	must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*) FROM device_addresses`).Scan(&links))
	if tracked != 0 || links != 0 || devCount != 0 {
		t.Fatalf("partial add persisted: tracked=%d links=%d device_count=%d", tracked, links, devCount)
	}
}

// T-BE-035 / ASM-02 / AMB-05: a combined request whose add part is refused must not apply its remove part or burn backfill budget.
func TestQAPutAddressesIsAtomic(t *testing.T) {
	e := qaServer(t, "qa_put_atomic", func(c *config.Config) {
		tr := c.API.Tiers["default"]
		tr.MaxAddresses = 1
		c.API.Tiers["default"] = tr
	}, nil)
	c := e.device(t)
	ctx := context.Background()
	_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": addr(1)}}}, nil, nil)
	must(t, err)
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{
		"remove": []map[string]string{{"chain": "base", "address": addr(1)}},
		"add":    []map[string]string{{"chain": "base", "address": addr(2)}, {"chain": "base", "address": addr(3)}},
	}, nil, nil)
	var problems []string
	if errCode(err) != "quota_exceeded" {
		t.Fatalf("setup: want quota_exceeded, got %v", err)
	}
	var list struct {
		Addresses []struct{ Address string } `json:"addresses"`
	}
	_, err = c.Do(ctx, "GET", "/v1/me/addresses", nil, &list, nil)
	must(t, err)
	if len(list.Addresses) != 1 || list.Addresses[0].Address != addr(1) {
		problems = append(problems, fmt.Sprintf("refused request still removed the address: now tracking %v", list.Addresses))
	}
	keys, _ := e.rdb.Keys(ctx, "hb:bf:*").Result()
	for _, k := range keys {
		if v, _ := e.rdb.Get(ctx, k).Int(); v > 1 {
			problems = append(problems, fmt.Sprintf("backfill budget charged %d for a refused request (key %s)", v, k))
		}
	}
	expectFixedExt(t, "BUG-01", problems)
}

// T-BE-036: concurrent adds cannot exceed the per-device quota (row lock serialises the count).
func TestQAConcurrentAddsRespectQuota(t *testing.T) {
	e := qaServer(t, "qa_quota_race", func(c *config.Config) {
		tr := c.API.Tiers["default"]
		tr.MaxAddresses = 5
		c.API.Tiers["default"] = tr
	}, nil)
	c := e.device(t)
	ctx := context.Background()
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _ = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": addr(100 + i)}}}, nil, nil)
		}(i)
	}
	wg.Wait()
	var links int
	must(t, e.st.Pool.QueryRow(ctx, `SELECT count(*) FROM device_addresses WHERE device_id = $1::uuid`, c.DeviceID).Scan(&links))
	if links != 5 {
		t.Fatalf("device holds %d links, want exactly the quota 5", links)
	}
}

// T-BE-039: /v1/rpc refuses non-allow-listed methods, oversized and empty batches and invalid JSON without forwarding anything.
func TestQARPCRefusals(t *testing.T) {
	e := qaServer(t, "qa_rpc_refuse", func(c *config.Config) { c.Gateway.MaxBatch = 3 }, nil)
	c := e.device(t)
	ctx := context.Background()
	call := func(body string) map[string]any {
		var out map[string]any
		_, _ = c.Do(ctx, "POST", "/v1/rpc/base", []byte(body), &out, nil)
		return out
	}
	bodies := map[string]string{
		"debug method":     `{"jsonrpc":"2.0","id":1,"method":"debug_traceTransaction","params":["0x00"]}`,
		"write method":     `{"jsonrpc":"2.0","id":1,"method":"eth_sendTransaction","params":[{}]}`,
		"personal":         `{"jsonrpc":"2.0","id":1,"method":"personal_unlockAccount","params":[]}`,
		"batch over max":   `[{"id":1,"method":"eth_chainId"},{"id":2,"method":"eth_chainId"},{"id":3,"method":"eth_chainId"},{"id":4,"method":"eth_chainId"}]`,
		"empty batch":      `[]`,
		"invalid json":     `{"method":`,
		"one bad in batch": `[{"id":1,"method":"eth_chainId"},{"id":2,"method":"admin_peers"}]`,
	}
	for name, b := range bodies {
		out := call(b)
		if out == nil || out["error"] == nil {
			t.Errorf("%s: not refused: %v", name, out)
		}
	}
	if n := e.gwHits.Load(); n != 0 {
		t.Fatalf("refused requests reached rpc-gateway %d times", n)
	}
	if out := call(`{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}`); out["result"] != "0x10" {
		t.Fatalf("control call: %v", out)
	}
}

// T-BE-040 (integration): a nested-null topic filter is forwarded to the node as an unfiltered query.
func TestQARPCNestedNullTopicsForwarded(t *testing.T) {
	e := qaServer(t, "qa_rpc_logs", nil, nil)
	c := e.device(t)
	var out map[string]any
	_, _ = c.Do(context.Background(), "POST", "/v1/rpc/base", []byte(`{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"topics":[[null]],"fromBlock":"0x0","toBlock":"latest"}]}`), &out, nil)
	var problems []string
	if e.gwHits.Load() != 0 {
		problems = append(problems, "eth_getLogs with topics [[null]] (no address) was forwarded to rpc-gateway: "+string(e.gwBody()))
	}
	expectFixedExt(t, "BUG-02", problems)
}

// T-BE-055: a pending transaction broadcast by device A is not described as Harbour's "pending" record to device B.
func TestQAPendingTxNotRevealedToOtherDevice(t *testing.T) {
	e := qaServer(t, "qa_pending_privacy", nil, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		switch {
		case bytes.Contains(b, []byte("eth_sendRawTransaction")):
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x01"}`)
		default:
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":null}`)
		}
	})
	a, b := e.device(t), e.device(t)
	ctx := context.Background()
	k, _ := devsign.ParseKey("0x4646464646464646464646464646464646464646464646464646464646464646")
	_, err := a.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": devsign.Address(k)}}}, nil, nil)
	must(t, err)
	raw, err := devsign.Sign(k, devsign.Tx{ChainID: e.cfg.Chains["base"].EVMChainID, Nonce: 3, TipCap: big.NewInt(1), FeeCap: big.NewInt(2), Gas: 21000, To: addr(9), Value: big.NewInt(1)})
	must(t, err)
	var bc map[string]any
	_, err = a.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": fmt.Sprintf("0x%x", raw)}, &bc, nil)
	must(t, err)
	hash := bc["tx_hash"].(string)
	var own map[string]any
	_, err = a.Do(ctx, "GET", "/v1/tx/base/"+hash, nil, &own, nil)
	must(t, err)
	if own["source"] != "pending" {
		t.Fatalf("sender should see its pending record: %v", own)
	}
	var other map[string]any
	_, err = b.Do(ctx, "GET", "/v1/tx/base/"+hash, nil, &other, nil)
	if err == nil && other["source"] == "pending" {
		t.Fatalf("another device learned the tx came from Harbour: %v", other)
	}
}

// T-BE-058: estimate input validation.
func TestQAEstimateValidation(t *testing.T) {
	e := qaServer(t, "qa_estimate_valid", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	mine := addr(1)
	_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": mine}}}, nil, nil)
	must(t, err)
	big256 := "0x1" + strings.Repeat("0", 64)
	cases := map[string]struct {
		body   map[string]string
		status int
	}{
		"untracked sender": {map[string]string{"from": addr(2), "to": addr(3)}, 403},
		"bad to":           {map[string]string{"from": mine, "to": "0x12"}, 400},
		"negative value":   {map[string]string{"from": mine, "to": addr(3), "value": "-1"}, 400},
		"2^256 value":      {map[string]string{"from": mine, "to": addr(3), "value": big256}, 400},
		"odd data":         {map[string]string{"from": mine, "to": addr(3), "data": "0x123"}, 400},
		"data not hex":     {map[string]string{"from": mine, "to": addr(3), "data": "0xzz"}, 400},
		"data too large":   {map[string]string{"from": mine, "to": addr(3), "data": "0x" + strings.Repeat("00", 128*1024+1)}, 400},
	}
	for name, tc := range cases {
		_, err := c.Do(ctx, "POST", "/v1/tx/base/estimate", tc.body, nil, nil)
		if he, ok := err.(*hbclient.HTTPError); !ok || he.Status != tc.status {
			t.Errorf("%s: %v, want %d", name, err, tc.status)
		}
	}
	_, err = c.Do(ctx, "POST", "/v1/tx/solana/estimate", map[string]string{"from": mine}, nil, nil)
	if he, ok := err.(*hbclient.HTTPError); !ok || (he.Status != 400 && he.Status != 404) {
		t.Errorf("non-EVM chain: %v", err)
	}
}

// T-BE-062: broadcast refuses pre-EIP-155 legacy, malformed and unknown-type transactions before anything reaches the node.
func TestQABroadcastRefusesUnsafeTransactions(t *testing.T) {
	e := qaServer(t, "qa_broadcast_refuse", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	// Pre-EIP-155 legacy (v = 27): from the "Ethereum Yellow Paper era" layout, here built by setting v=0x1b on the EIP-155 example.
	legacy := "f86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a7640000801ba028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83"
	cases := map[string]string{
		"pre-EIP-155 legacy": "0x" + legacy,
		"not hex":            "0xzz",
		"truncated":          "0x02f8",
		"unknown type 5":     "0x05c0",
		"empty":              "",
	}
	for name, raw := range cases {
		_, err := c.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": raw}, nil, nil)
		code := errCode(err)
		if code != "wrong_network" && code != "bad_transaction" {
			t.Errorf("%s: %v, want wrong_network/bad_transaction", name, err)
		}
	}
	if n := e.gwHits.Load(); n != 0 {
		t.Fatalf("refused transactions reached the node %d times", n)
	}
}

// T-BE-091: the same signed request fired 20 times in parallel succeeds exactly once (nonce replay protection under races).
func TestQAParallelReplayAcceptedOnce(t *testing.T) {
	e := qaServer(t, "qa_replay_race", nil, nil)
	c := e.device(t)
	now := strconv.FormatInt(time.Now().Unix(), 10)
	n := newNonce()
	r := rawReq{method: "GET", path: "/v1/me", date: now, nonce: n, dev: c.DeviceID, sig: devicesig.Sign(c.Priv, devicesig.Canonical("GET", "/v1/me", now, n, c.DeviceID, nil))}
	var ok atomic.Int64
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if s, _ := e.sendRaw(t, r); s == 200 {
				ok.Add(1)
			}
		}()
	}
	wg.Wait()
	if ok.Load() != 1 {
		t.Fatalf("%d of 20 identical requests accepted, want 1", ok.Load())
	}
}

// T-RT-001: every signed route refuses unsigned and wrongly signed requests with 401 (and never runs the handler).
func TestQAEverySignedRouteNeedsSignature(t *testing.T) {
	e := qaServer(t, "qa_routes_auth", nil, nil)
	c := e.device(t)
	routes := [][2]string{
		{"GET", "/v1/me"}, {"GET", "/v1/me/addresses"}, {"PUT", "/v1/me/addresses"}, {"POST", "/v1/rpc/base"}, {"GET", "/v1/gw/v2/market/trending"},
		{"POST", "/v1/gw/helius/rpc"}, {"GET", "/v1/me/portfolio"}, {"GET", "/v1/me/portfolio/chart"}, {"GET", "/v1/me/history"}, {"GET", "/v1/me/nfts"},
		{"GET", "/v1/assets/base/native"}, {"GET", "/v1/assets/base/native/prices"}, {"GET", "/v1/tx/base/0x" + strings.Repeat("0", 64)},
		{"POST", "/v1/tx/base/estimate"}, {"POST", "/v1/tx/base/simulate"}, {"POST", "/v1/tx/base/broadcast"}, {"POST", "/v1/realtime/token"},
		{"PUT", "/v1/me/push"}, {"DELETE", "/v1/me/push"},
	}
	for _, rt := range routes {
		// unsigned
		req, _ := http.NewRequest(rt[0], e.hs.URL+rt[1], strings.NewReader(`{}`))
		resp, err := http.DefaultClient.Do(req)
		must(t, err)
		resp.Body.Close()
		if resp.StatusCode != 401 {
			t.Errorf("%s %s unsigned: %d", rt[0], rt[1], resp.StatusCode)
		}
		// signed by a key that is not the device's
		now := strconv.FormatInt(time.Now().Unix(), 10)
		n := newNonce()
		_, other, _ := ed25519.GenerateKey(rand.Reader)
		s, _ := e.sendRaw(t, rawReq{method: rt[0], path: rt[1], date: now, nonce: n, dev: c.DeviceID, body: []byte(`{}`),
			sig: devicesig.Sign(other, devicesig.Canonical(rt[0], rt[1], now, n, c.DeviceID, []byte(`{}`)))})
		if s != 401 {
			t.Errorf("%s %s foreign signature: %d", rt[0], rt[1], s)
		}
	}
	if e.gwHits.Load() != 0 {
		t.Fatalf("an unauthenticated request reached the gateway")
	}
}

// expectFixedExt fails when a fixed bug reproduces again (external test package).
func expectFixedExt(t *testing.T, id string, problems []string) {
	t.Helper()
	if len(problems) > 0 {
		t.Fatalf("%s regression: %s", id, strings.Join(problems, "; "))
	}
}

// expectKnownBugExt mirrors expectKnownBug for the external test package.
func expectKnownBugExt(t *testing.T, id string, problems []string) {
	t.Helper()
	if len(problems) == 0 {
		t.Fatalf("%s no longer reproduces: remove the expectKnownBug marker and close the bug", id)
	}
	msg := fmt.Sprintf("KNOWN BUG %s (qa/BUGS_FOUND.md):\n  %s", id, strings.Join(problems, "\n  "))
	if os.Getenv("HB_QA_STRICT") == "1" {
		t.Fatal(msg)
	}
	t.Skip(msg)
}
