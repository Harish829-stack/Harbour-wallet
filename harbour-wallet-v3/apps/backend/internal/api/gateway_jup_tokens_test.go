package api

import (
	"net/http"
	"strings"
	"testing"
)

func TestGatewayJupiterTokenSearch(t *testing.T) {
	var gotPath, gotQuery, gotKey string
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotQuery, gotKey = r.URL.Path, r.URL.RawQuery, r.Header.Get("x-api-key")
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`[{"id":"So11111111111111111111111111111111111111112","name":"Wrapped SOL","symbol":"SOL","decimals":9}]`))
	})
	res, rej, err := call(t, g, "GET", "/jup/tokens/v2/search?query=So11111111111111111111111111111111111111112", "")
	if rej != nil || err != nil {
		t.Fatalf("rej=%v err=%v", rej, err)
	}
	if gotPath != "/jupt/search" || gotQuery != "query=So11111111111111111111111111111111111111112" || gotKey != "jup-secret-key" {
		t.Fatalf("upstream got path=%q query=%q key=%q", gotPath, gotQuery, gotKey)
	}
	if strings.Contains(string(res.Body), "jup-secret-key") {
		t.Fatal("the API key must never reach the client")
	}
}

func TestGatewayJupiterTokenSearchRejectsAbuse(t *testing.T) {
	g, _ := testGateway(t, func(w http.ResponseWriter, r *http.Request) { t.Errorf("upstream must not be called: %s", r.URL) })
	for _, tc := range []struct{ method, target, body string }{
		{"POST", "/jup/tokens/v2/search?query=SOL", `{}`},
		{"GET", "/jup/tokens/v2/search", ""},
		{"GET", "/jup/tokens/v2/search?query=", ""},
		{"GET", "/jup/tokens/v2/search?query=SOL&limit=1000", ""},
		{"GET", "/jup/tokens/v2/search?query=SOL&query=BTC", ""},
		{"GET", "/jup/tokens/v2/search?query=" + strings.Repeat("a", 65), ""},
		{"GET", "/jup/tokens/v2/search?query=SOL%2F..%2Fadmin", ""},
		{"GET", "/jup/tokens/v2/recent", ""},
		{"GET", "/jup/tokens/v2/search/x?query=SOL", ""},
	} {
		if _, rej, _ := call(t, g, tc.method, tc.target, tc.body); rej == nil {
			t.Errorf("%s %s should be rejected", tc.method, tc.target)
		}
	}
}
