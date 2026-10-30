package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Unit tests for the 2026-10-28 audit fixes that need no database.

func TestClientIPGroupsIPv6By64(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "[2001:db8:1:2:aaaa::1]:5555"
	a := clientIP(r)
	r.RemoteAddr = "[2001:db8:1:2:bbbb::9]:5555"
	if b := clientIP(r); a != b || !strings.HasSuffix(a, "/64") {
		t.Fatalf("same /64 must share a key: %q %q", a, b)
	}
	r.RemoteAddr = "203.0.113.7:1"
	if got := clientIP(r); got != "203.0.113.7" {
		t.Fatalf("ipv4: %q", got)
	}
}

func TestRealIPOnlyTrustsProxies(t *testing.T) {
	s := &Server{}
	var seen string
	h := s.realIP(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { seen = clientIP(r) }))
	// Direct client sending its own header: ignored.
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "203.0.113.7:1"
	r.Header.Set("X-Forwarded-For", "198.51.100.1")
	h.ServeHTTP(httptest.NewRecorder(), r)
	if seen != "203.0.113.7" {
		t.Fatalf("spoofed header honoured: %q", seen)
	}
	// Through the load balancer: the right-most untrusted hop wins, not the client-supplied first entry.
	r = httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.5:1"
	r.Header.Set("X-Forwarded-For", "1.1.1.1, 198.51.100.1")
	h.ServeHTTP(httptest.NewRecorder(), r)
	if seen != "198.51.100.1" {
		t.Fatalf("lb hop: %q", seen)
	}
}

func TestFilteredLogs(t *testing.T) {
	cases := map[string]bool{
		`[{"fromBlock":"0x1","toBlock":"0x2"}]`:                                               false,
		`[{"address":null,"topics":[null,null]}]`:                                             false,
		`[{"address":"0x0000000000000000000000000000000000000001"}]`:                          true,
		`[{"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]}]`: true,
		`[{"address":"0x01"},{"address":"0x02"}]`:                                             false,
	}
	for in, want := range cases {
		if got := filteredLogs(json.RawMessage(in)); got != want {
			t.Errorf("%s: got %v", in, got)
		}
	}
}

func TestStripGatewayInternals(t *testing.T) {
	in := `[{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"x","data":{"code":"all_failed","upstreamsTried":["ethereum/alchemy-a"]}}}]`
	out := string(stripGatewayInternals([]byte(in)))
	if strings.Contains(out, "alchemy") || !strings.Contains(out, "all_failed") {
		t.Fatalf("not stripped: %s", out)
	}
}

func TestKnownPushHost(t *testing.T) {
	for h, want := range map[string]bool{"fcm.googleapis.com": true, "updates.push.services.mozilla.com": true,
		"wns2-par02p.notify.windows.com": true, "web.push.apple.com": true, "evil.example": false, "fcm.googleapis.com.evil.example": false} {
		if knownPushHost(h) != want {
			t.Errorf("%s", h)
		}
	}
}

// HW-2026-012: default security headers, overridable by handlers; HSTS only over HTTPS.
func TestSecurityHeaders(t *testing.T) {
	s := &Server{opt: Options{TrustProxy: true}}
	h := s.securityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/media" {
			w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
		}
		w.WriteHeader(200)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/v1/me/portfolio", nil))
	for k, v := range map[string]string{"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer"} {
		if got := rec.Header().Get(k); got != v {
			t.Errorf("%s = %q, want %q", k, got, v)
		}
	}
	if rec.Header().Get("Strict-Transport-Security") != "" {
		t.Error("HSTS on plain HTTP")
	}
	rec = httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/media", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Cache-Control") != "public, max-age=86400, immutable" || rec.Header().Get("Strict-Transport-Security") == "" {
		t.Errorf("override/HSTS: %v", rec.Header())
	}
}

// HW-2026-020: broadcast replays keep the hash but never the realtime channel token.
func TestScrubBroadcast(t *testing.T) {
	out := string(scrubBroadcast([]byte(`{"tx_hash":"0xab","status":"pending","channel":"tx:1","channel_token":"secret"}`)))
	if strings.Contains(out, "secret") || strings.Contains(out, "channel") || !strings.Contains(out, `"tx_hash":"0xab"`) {
		t.Errorf("scrubBroadcast = %s", out)
	}
	if string(scrubBroadcast([]byte("not json"))) != `{"replayed":true}` {
		t.Error("non-JSON body kept")
	}
}
