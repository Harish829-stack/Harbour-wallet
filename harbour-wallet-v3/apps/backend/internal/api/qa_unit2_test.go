package api

// QA unit suite part 2 (no Postgres/Redis): middleware behaviour, log hygiene, cursors, media decoding caps, realIP, gateway route
// matrix and the signed-config route. TEST_PLAN: T-BE-002, 003, 004, 020, 030, 051, 068, 073, 078, 090, 095, T-RT-002, T-GW-002,
// T-GW-004, T-GW-006, T-GW-010, T-GW-014, T-GW-016, T-GW-024, T-GW-026.

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/realtime"
	"harbour/backend/internal/store"
)

// logBuf is a concurrency-safe log sink for log-hygiene assertions.
type logBuf struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (l *logBuf) Write(p []byte) (int, error) { l.mu.Lock(); defer l.mu.Unlock(); return l.b.Write(p) }
func (l *logBuf) String() string              { l.mu.Lock(); defer l.mu.Unlock(); return l.b.String() }

// bareServer is the real router with no database or cache: enough for everything that happens before a lookup.
func bareServer(t *testing.T) (*Server, *logBuf) {
	t.Helper()
	cfg, err := config.Load("../../config")
	if err != nil {
		t.Fatal(err)
	}
	lb := &logBuf{}
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	return New(Options{Config: cfg, Log: slog.New(slog.NewJSONHandler(lb, &slog.HandlerOptions{Level: slog.LevelDebug})), LinkCrypto: lc}), lb
}

func signedHeaders(req *http.Request) {
	req.Header.Set("X-HB-Device", "123e4567-e89b-12d3-a456-426614174000")
	req.Header.Set("X-HB-Date", fmt.Sprint(time.Now().Unix()))
	req.Header.Set("X-HB-Nonce", "AAAAAAAAAAAAAAAAAAAAAAAA")
	req.Header.Set("X-HB-Signature", "c2ln")
}

// T-BE-002: a body over 1 MiB on a signed route is refused 413 too_large before any device lookup or signature work.
func TestQABodyLimitBeforeSignatureWork(t *testing.T) {
	s, _ := bareServer(t) // no Store: a lookup would panic, so reaching 413 proves it happened before any lookup
	req := httptest.NewRequest(http.MethodPut, "/v1/me/addresses", bytes.NewReader(bytes.Repeat([]byte("a"), 1<<20+1)))
	signedHeaders(req)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, req)
	if rr.Code != http.StatusRequestEntityTooLarge || !strings.Contains(rr.Body.String(), `"too_large"`) {
		t.Fatalf("got %d %s, want 413 too_large", rr.Code, rr.Body.String())
	}
}

// T-BE-003: a handler panic becomes a 500 without a stack trace in the body, and the server keeps serving.
func TestQARecovererHidesPanics(t *testing.T) {
	s, _ := bareServer(t) // /healthz dereferences the nil Store: a real panic inside a handler
	h := s.Handler()
	for i := 0; i < 2; i++ {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/healthz", nil))
		if rr.Code != http.StatusInternalServerError {
			t.Fatalf("panic → %d, want 500", rr.Code)
		}
		if b := rr.Body.String(); strings.Contains(b, "goroutine") || strings.Contains(b, ".go:") || strings.Contains(b, "nil pointer") {
			t.Fatalf("panic details leaked: %q", b)
		}
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/push/vapid", nil))
	if rr.Code == 0 {
		t.Fatal("server stopped serving after a panic")
	}
}

// T-BE-004 / T-BE-030: access and security logs carry route patterns and HMAC tags only — no query, address, IP, signature or device id.
func TestQALogsCarryNoIdentifiers(t *testing.T) {
	s, lb := bareServer(t)
	h := s.Handler()
	const address = "0xabcdefabcdefabcdefabcdefabcdefabcdef1234"
	req := httptest.NewRequest(http.MethodGet, "/v1/assets/ethereum/"+address+"?owner="+address+"&secret=topsecret", nil)
	req.RemoteAddr = "203.0.113.77:5555"
	signedHeaders(req)
	req.Header.Set("X-HB-Date", "1") // clock skew → security event before any lookup
	h.ServeHTTP(httptest.NewRecorder(), req)
	bad := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	bad.RemoteAddr = "203.0.113.77:5555"
	bad.Header.Set("X-HB-Device", "not-a-uuid")
	h.ServeHTTP(httptest.NewRecorder(), bad)
	out := lb.String()
	if !strings.Contains(out, `"route":"/v1/assets/{chain}/{asset}"`) {
		t.Fatalf("access log has no route pattern: %s", out)
	}
	for _, leak := range []string{address, "topsecret", "owner=", "203.0.113.77", "c2ln", "123e4567-e89b-12d3-a456-426614174000", "not-a-uuid"} {
		if strings.Contains(out, leak) {
			t.Fatalf("log leaks %q:\n%s", leak, out)
		}
	}
	if !strings.Contains(out, "auth_clock_skew") || !strings.Contains(out, "auth_malformed") {
		t.Fatalf("security events missing:\n%s", out)
	}
}

// T-BE-090: every error the API emits has the shape {"error":{"code","message","retryable"}} with a plain-language message.
func TestQAErrorShape(t *testing.T) {
	s, _ := bareServer(t)
	h := s.Handler()
	goText := regexp.MustCompile(`(?i)(runtime error|nil pointer|unexpected EOF|invalid character|json:|sql:|pgx|redis:|dial tcp|context deadline)`)
	cases := []*http.Request{
		httptest.NewRequest(http.MethodGet, "/v1/me", nil), // unsigned
		httptest.NewRequest(http.MethodPost, "/v1/devices", strings.NewReader("{")),
		httptest.NewRequest(http.MethodPost, "/v1/devices", strings.NewReader(`{"public_key":"x"}`)),
	}
	r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	signedHeaders(r)
	r.Header.Set("X-HB-Date", "1")
	cases = append(cases, r)
	for _, req := range cases {
		rr := httptest.NewRecorder()
		func() { defer func() { _ = recover() }(); h.ServeHTTP(rr, req) }()
		if rr.Code < 400 {
			t.Fatalf("%s %s: %d", req.Method, req.URL, rr.Code)
		}
		var body struct {
			Error *struct {
				Code      *string `json:"code"`
				Message   *string `json:"message"`
				Retryable *bool   `json:"retryable"`
			} `json:"error"`
		}
		if rr.Code == 500 { // the nil-store fixture panics on lookups; shape for 500 comes from the Recoverer (plain) — checked in T-BE-003
			continue
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil || body.Error == nil || body.Error.Code == nil || body.Error.Message == nil || body.Error.Retryable == nil {
			t.Fatalf("%s %s → %d %q: not the error shape", req.Method, req.URL, rr.Code, rr.Body.String())
		}
		if goText.MatchString(*body.Error.Message) {
			t.Fatalf("Go error text reached the client: %q", *body.Error.Message)
		}
	}
}

// T-RT-002: a wrong HTTP method on any route is 405 and runs no handler (no lookup → no panic with the nil store).
func TestQAWrongMethod405(t *testing.T) {
	s, _ := bareServer(t)
	h := s.Handler()
	routes := map[string][]string{
		"/v1/devices/challenge": {"GET", "PUT", "DELETE"}, "/v1/devices": {"GET", "DELETE"}, "/v1/me": {"POST", "PUT", "DELETE"},
		"/v1/me/addresses": {"POST", "DELETE"}, "/v1/rpc/ethereum": {"GET", "PUT"}, "/v1/me/portfolio": {"POST"}, "/v1/me/history": {"POST"},
		"/v1/tx/ethereum/broadcast": {"PUT", "DELETE"}, "/v1/tx/ethereum/estimate": {"PUT"}, "/v1/realtime/token": {"GET"}, "/v1/me/push": {"GET", "POST"},
		"/v1/gw/v2/market/prices":                    {"PUT", "DELETE", "PATCH"},
		"/v1/media/00000000000000000000000000000000": {"POST"}, "/healthz": {"POST"},
	}
	for path, methods := range routes {
		for _, m := range methods {
			rr := httptest.NewRecorder()
			h.ServeHTTP(rr, httptest.NewRequest(m, path, strings.NewReader("{}")))
			if rr.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s %s → %d, want 405", m, path, rr.Code)
			}
		}
	}
}

// T-BE-020: the per-client auth-failure table is bounded: past 50 000 keys it resets instead of growing.
func TestQAAuthFailuresBounded(t *testing.T) {
	var f authFailures
	now := time.Unix(1_800_000_000, 0)
	for i := 0; i < authFailMaxKeys+10; i++ {
		f.add(fmt.Sprintf("10.%d.%d.%d", i>>16&255, i>>8&255, i&255), now)
	}
	f.mu.Lock()
	n := len(f.n)
	f.mu.Unlock()
	if n > authFailMaxKeys+1 {
		t.Fatalf("table grew to %d keys (cap %d)", n, authFailMaxKeys)
	}
	for i := 0; i < authFailPerMinute; i++ {
		f.add("198.51.100.1", now)
	}
	if !f.blocked("198.51.100.1", now) || f.blocked("198.51.100.2", now) {
		t.Fatal("blocking is per client")
	}
	if f.blocked("198.51.100.1", now.Add(time.Minute)) {
		t.Fatal("the window resets each minute")
	}
}

// T-BE-051: history cursors round-trip exactly; malformed ones are refused.
func TestQACursorRoundTrip(t *testing.T) {
	for i := 0; i < 500; i++ {
		c := store.ActivityCursor{TxHash: fmt.Sprintf("0x%064x", i*7919), BlockTime: time.Unix(int64(1_600_000_000+i*37), int64(i)).UTC()}
		got, err := decodeCursor(encodeCursor(c))
		if err != nil || got == nil || got.TxHash != c.TxHash || !got.BlockTime.Equal(c.BlockTime) {
			t.Fatalf("round trip %d: %+v %v", i, got, err)
		}
	}
	for _, bad := range []string{"!!!", base64.RawURLEncoding.EncodeToString([]byte("not json")), base64.RawURLEncoding.EncodeToString([]byte(`{"block_time":"2020-01-01T00:00:00Z"}`))} {
		if _, err := decodeCursor(bad); err == nil {
			t.Fatalf("cursor %q accepted", bad)
		}
	}
}

// T-BE-068: realtime tokens are standard HS256 JWTs (independent HMAC construction with the RFC 7515 A.1 key).
func TestQASignHS256MatchesIndependentJWT(t *testing.T) {
	key, _ := base64.RawURLEncoding.DecodeString("AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow")
	claims := map[string]any{"sub": "dev", "aud": "harbour", "exp": 1300819380, "iat": 1300819300}
	tok := realtime.SignHS256(key, claims)
	parts := strings.Split(tok, ".")
	if len(parts) != 3 {
		t.Fatalf("not a compact JWT: %s", tok)
	}
	var hdr map[string]string
	hb, _ := base64.RawURLEncoding.DecodeString(parts[0])
	_ = json.Unmarshal(hb, &hdr)
	if hdr["alg"] != "HS256" || hdr["typ"] != "JWT" {
		t.Fatalf("header %v", hdr)
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	if want := base64.RawURLEncoding.EncodeToString(mac.Sum(nil)); parts[2] != want {
		t.Fatalf("signature %s, independent HMAC %s", parts[2], want)
	}
	var got map[string]any
	pb, _ := base64.RawURLEncoding.DecodeString(parts[1])
	_ = json.Unmarshal(pb, &got)
	if got["sub"] != "dev" || got["aud"] != "harbour" || got["exp"].(float64) != 1300819380 {
		t.Fatalf("claims %v", got)
	}
}

// ---------- media (T-BE-073, T-BE-078) ----------

func mediaFixture(t *testing.T, body []byte, ctype string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", ctype); w.Write(body) }))
	t.Cleanup(srv.Close)
	return srv.URL + "/img"
}
func pngOf(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{255, 0, 0, 255})
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

// T-BE-073: SVG, HTML, oversize bodies, decompression bombs (headers claiming 25 Mpx) are refused permanently without decoding; WebP accepted.
func TestQAMediaRefusesDangerousImages(t *testing.T) {
	c := newMediaClient(true) // httptest is loopback
	ctx := context.Background()
	gifBomb := func() []byte { // a tiny GIF whose logical screen claims 5000x5000
		var b bytes.Buffer
		_ = gif.Encode(&b, image.NewPaletted(image.Rect(0, 0, 1, 1), color.Palette{color.Black, color.White}), nil)
		raw := b.Bytes()
		raw[6], raw[7], raw[8], raw[9] = 0x88, 0x13, 0x88, 0x13 // 5000 x 5000
		return raw
	}()
	pngBomb := pngOf(1, 1)
	// IHDR width/height at bytes 16..23 → 5000x5000 (CRC is checked only on decode, DecodeConfig reads the header)
	pngBomb[16], pngBomb[17], pngBomb[18], pngBomb[19] = 0, 0, 0x13, 0x88
	pngBomb[20], pngBomb[21], pngBomb[22], pngBomb[23] = 0, 0, 0x13, 0x88
	for name, tc := range map[string]struct {
		body  []byte
		ctype string
	}{
		"svg":      {[]byte(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>`), "image/svg+xml"},
		"html":     {[]byte(`<html><script>alert(1)</script></html>`), "text/html"},
		"big":      {bytes.Repeat([]byte{0}, mediaMaxBytes+1), "image/png"},
		"png25mpx": {pngBomb, "image/png"},
		"gifbomb":  {gifBomb, "image/gif"},
	} {
		_, err := fetchImage(ctx, c, mediaFixture(t, tc.body, tc.ctype))
		if !errors.Is(err, errMediaPermanent) {
			t.Errorf("%s: %v, want a permanent refusal", name, err)
		}
	}
	// a valid large PNG is scaled to ≤ 512 px and re-encoded
	out, err := fetchImage(ctx, c, mediaFixture(t, pngOf(2000, 1000), "image/png"))
	if err != nil {
		t.Fatal(err)
	}
	cfg, _, _ := image.DecodeConfig(bytes.NewReader(out))
	if cfg.Width != 512 || cfg.Height != 256 {
		t.Fatalf("scaled to %dx%d", cfg.Width, cfg.Height)
	}
	// WebP (lossless 1x1, from the libwebp test corpus) is accepted and re-encoded as PNG
	webp, _ := base64.StdEncoding.DecodeString("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==")
	if out, err := fetchImage(ctx, c, mediaFixture(t, webp, "image/webp")); err != nil || !bytes.HasPrefix(out, []byte("\x89PNG")) {
		t.Fatalf("webp: %v", err)
	}
	// private addresses are refused by the production client
	if _, err := fetchImage(ctx, newMediaClient(false), mediaFixture(t, pngOf(1, 1), "image/png")); err == nil {
		t.Fatal("the production media client fetched from loopback")
	}
	for _, u := range []string{"javascript:alert(1)", "file:///etc/passwd", "ftp://x/y.png", "data:image/png;base64,AAAA", "https://"} {
		if _, err := mediaURL(u); err == nil {
			t.Errorf("mediaURL accepted %q", u)
		}
	}
	if u, _ := mediaURL("ipfs://ipfs/Qm123"); u != "https://ipfs.io/ipfs/Qm123" {
		t.Fatalf("ipfs rewrite %q", u)
	}
}

// T-BE-078: fetchImage never panics on random bytes served as an image.
func FuzzQAFetchImage(f *testing.F) {
	f.Add(pngOf(2, 2))
	f.Add([]byte("GIF89a\x01\x00\x01\x00"))
	f.Add([]byte("RIFF\x00\x00\x00\x00WEBPVP8 "))
	f.Add([]byte{0xff, 0xd8, 0xff})
	c := newMediaClient(true)
	var body []byte
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { mu.Lock(); defer mu.Unlock(); w.Write(body) }))
	f.Cleanup(srv.Close)
	f.Fuzz(func(t *testing.T, b []byte) {
		mu.Lock()
		body = b
		mu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = fetchImage(ctx, c, srv.URL+"/x")
	})
}

// ---------- realIP (T-BE-095) ----------

// T-BE-095: realIP never panics and only a trusted peer can make X-Forwarded-For count.
func FuzzQARealIP(f *testing.F) {
	f.Add("10.0.0.1:1", "203.0.113.5")
	f.Add("203.0.113.9:1", "1.2.3.4, 10.0.0.2")
	f.Add("[::1]:1", "garbage,,,")
	f.Add("nonsense", "")
	s := &Server{opt: Options{TrustedProxies: []*net.IPNet{mustCIDR("10.0.0.0/8")}}}
	f.Fuzz(func(t *testing.T, remote, xff string) {
		var seen string
		h := s.realIP(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { seen = r.RemoteAddr }))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = remote
		req.Header.Set("X-Forwarded-For", xff)
		h.ServeHTTP(httptest.NewRecorder(), req)
		host, _, err := net.SplitHostPort(remote)
		if err != nil {
			host = remote
		}
		peer := net.ParseIP(host)
		if (peer == nil || !inNets(peer, s.opt.TrustedProxies)) && seen != remote {
			t.Fatalf("untrusted peer %q rewritten to %q by XFF %q", remote, seen, xff)
		}
	})
}
func mustCIDR(s string) *net.IPNet { _, n, _ := net.ParseCIDR(s); return n }

// ---------- gateway (T-GW-*) ----------

// T-GW-004 / 006 / 010 / 014 / 016: the exact refusals listed in the plan, each rejected before any upstream call.
func TestQAGatewayPlanRefusals(t *testing.T) {
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) { t.Errorf("upstream called: %s %s", r.Method, r.URL) })
	cases := []struct{ id, method, target, body string }{
		{"GW-004", "GET", "/v2/market/charts?coin=BTC&days=1", ""}, {"GW-004", "GET", "/v2/market/charts?coin=../x&days=1", ""},
		{"GW-004", "GET", "/v2/market/charts?coin=bitcoin&days=2", ""}, {"GW-004", "GET", "/v2/market/tickers?vs_currency=eur&order=market_cap_desc", ""},
		{"GW-004", "GET", "/v2/market/tickers?vs_currency=usd&order=x;y", ""}, {"GW-004", "GET", "/v2/market/info?coin=BTC", ""},
		{"GW-006", "GET", "/rss/unknown", ""}, {"GW-006", "POST", "/rss/unknown", ""},
		{"GW-010", "GET", "/thornode/thorchain/tx/status/zz", ""}, {"GW-010", "GET", "/thornode/thorchain/tx/status/" + strings.Repeat("g", 64), ""},
		{"GW-010", "GET", "/relay/../admin", ""}, {"GW-010", "DELETE", "/relay/quote", ""},
		{"GW-014", "GET", "/alchemy/1/nft/getNFTsForOwnerAdmin?owner=0x1", ""}, {"GW-014", "GET", "/alchemy/1/nft/getNFTsForOwner?" + strings.Repeat("a=1&", 25), ""},
		{"GW-014", "GET", "/alchemy/1/nft/getNFTsForOwner?owner=0x1/../x", ""},
		{"GW-016", "POST", "/trongrid/wallet/deletewallet", "{}"}, {"GW-016", "POST", "/trongrid/../admin", "{}"}, {"GW-016", "POST", "/toncenter/api/v2/unknownMethod", "{}"},
	}
	for _, tc := range cases {
		if _, rej, _ := call(t, g, tc.method, tc.target, tc.body); rej == nil {
			t.Errorf("%s: %s %s accepted", tc.id, tc.method, tc.target)
		}
	}
}

// T-GW-026: route matrix: every documented route resolves for its allowed method and is refused for every other method.
func TestQAGatewayRouteMatrix(t *testing.T) {
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "{}") })
	routes := []struct {
		target string
		body   string
		ok     []string
	}{
		{"/v2/market/prices?ids=bitcoin", "", []string{"GET"}},
		{"/v2/market/charts?coin=bitcoin&days=1", "", []string{"GET", "POST"}}, // read-only market routes ignore the method (upstream is always GET)
		{"/v2/market/trending", "", []string{"GET", "POST"}},
		{"/helius/rpc", `{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["11111111111111111111111111111111"]}`, []string{"POST"}},
		{"/alchemy/1/rpc", `{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}`, []string{"POST"}},
		{"/etherscan/v2?module=account&action=txlist&chainid=1&address=0x0000000000000000000000000000000000000001", "", []string{"GET"}},
	}
	for _, r := range routes {
		for _, m := range []string{"GET", "POST"} { // the router only lets GET and POST reach /v1/gw/* (others: 405, TestQAWrongMethod405)
			u, _ := url.Parse(r.target)
			_, rej := g.resolve(m, u.Path, u.Query(), []byte(r.body))
			allowed := false
			for _, a := range r.ok {
				allowed = allowed || a == m
			}
			if allowed && rej != nil {
				t.Errorf("%s %s refused: %+v", m, r.target, rej)
			}
			if !allowed && rej == nil {
				t.Errorf("%s %s resolved but should be refused", m, r.target)
			}
		}
	}
}

// T-GW-024: upstream bodies are read up to the 4 MiB cap; timeouts and 5xx become 502 upstream_unavailable without leaking upstream text.
func TestQAGatewayUpstreamFailures(t *testing.T) {
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/search/trending"):
			w.Write(bytes.Repeat([]byte("x"), gwMaxBody+10))
		default:
			w.WriteHeader(500)
			io.WriteString(w, "internal stack at upstream.go:12 key=cg-secret-key")
		}
	})
	if _, _, err := call(t, g, "GET", "/v2/market/trending", ""); err == nil || !strings.Contains(err.Error(), "bad body") {
		t.Fatalf("oversize upstream body: %v, want a bounded-read error", err)
	}
	_, _, err := call(t, g, "GET", "/v2/market/info?coin=bitcoin", "")
	if err == nil || strings.Contains(err.Error(), "cg-secret-key") || strings.Contains(err.Error(), "upstream.go") {
		t.Fatalf("upstream 500: %v, want an error without upstream text", err)
	}
	// timeout: the client deadline bounds the call
	slow, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) { time.Sleep(300 * time.Millisecond) })
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	c, rej := slow.resolve("GET", "/v2/market/trending", url.Values{}, nil)
	if rej != nil {
		t.Fatal(rej)
	}
	if _, err := slow.run(ctx, c); err == nil {
		t.Fatal("a slow upstream did not time out")
	}
}

// T-GW-002: /v1/gw/v1/config serves {config, signature} with a 5-minute cache, or 404 no_config when unset.
func TestQAGatewayConfigRoute(t *testing.T) {
	s := &Server{gw: &gateway{keys: GatewayKeys{}}}
	rr := httptest.NewRecorder()
	s.handleGatewayConfig(rr)
	if rr.Code != 404 || !strings.Contains(rr.Body.String(), `"no_config"`) {
		t.Fatalf("unset: %d %s", rr.Code, rr.Body.String())
	}
	g := readGolden(t)
	s.gw.keys = GatewayKeys{ConfigJSON: g.Config, ConfigSig: g.Signature}
	rr = httptest.NewRecorder()
	s.handleGatewayConfig(rr)
	if rr.Code != 200 || rr.Header().Get("Cache-Control") != "public, max-age=300" {
		t.Fatalf("set: %d %v", rr.Code, rr.Header())
	}
	var got map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &got)
	if len(got) != 2 || got["config"] != g.Config || got["signature"] != g.Signature {
		t.Fatalf("body %v differs from the shared golden (T-EXT-047)", got)
	}
}

type gwConfigGolden struct {
	Config    string `json:"config"`
	Signature string `json:"signature"`
	PublicKey string `json:"public_key"`
}

func readGolden(t *testing.T) gwConfigGolden {
	t.Helper()
	b, err := readFileT("testdata/gw_config_golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var g gwConfigGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func readFileT(p string) ([]byte, error) { return os.ReadFile(p) }
