package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// OBS-15: .sol names are resolved through the gateway (/v1/gw/sns/resolve/<label>) so the SNS service never sees the user's IP.
func TestQAGatewaySNSRoute(t *testing.T) {
	var seen []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.URL.Path)
		_, _ = io.WriteString(w, `{"s":"ok","result":"HKKp49qGWXd639QsuH7JiLijfVW5UtCVY4s1n2HANwEA"}`)
	}))
	t.Cleanup(srv.Close)
	g := newGateway(GatewayKeys{}, GatewayHosts{SNS: srv.URL}, nil, &memCache{})
	res, rej, err := call(t, g, "GET", "/sns/resolve/bonfida", "")
	if rej != nil || err != nil || res.Status != 200 {
		t.Fatalf("resolve: rej=%v err=%v", rej, err)
	}
	if len(seen) != 1 || seen[0] != "/resolve/bonfida" {
		t.Fatalf("upstream saw %v", seen)
	}
	if _, _, _ = call(t, g, "GET", "/sns/resolve/bonfida", ""); len(seen) != 1 {
		t.Fatalf("second lookup should be served from cache, upstream calls %d", len(seen))
	}
	for _, bad := range []string{"/sns/resolve/../admin", "/sns/resolve/UPPER", "/sns/other/x", "/sns/resolve/", "/sns/resolve/a.b"} {
		if _, rej, _ := call(t, g, "GET", bad, ""); rej == nil {
			t.Errorf("%s should be rejected", bad)
		}
	}
	if _, rej, _ := call(t, g, "POST", "/sns/resolve/bonfida", "{}"); rej == nil {
		t.Error("POST should be rejected")
	}
}
