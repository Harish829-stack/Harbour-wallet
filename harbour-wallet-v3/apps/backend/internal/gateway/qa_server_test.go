package gateway_test

// QA: rpc-gateway HTTP authentication (TEST_PLAN: T-IDX-001). The gateway can broadcast and spends provider budget, so every
// route except /healthz needs the internal bearer token, compared in constant time.

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestQAGatewayRoutesRequireBearerToken(t *testing.T) {
	r := newRig(t, 1000, nil)
	hs := httptest.NewServer(r.g.Handler("s3cret-token"))
	defer hs.Close()
	routes := [][2]string{{"POST", "/rpc/testnet"}, {"GET", "/status"}, {"GET", "/metrics"}}
	auths := map[string]string{"none": "", "wrong token": "Bearer nope", "token without scheme": "s3cret-token", "lowercase scheme": "bearer s3cret-token",
		"prefix of token": "Bearer s3cret", "token plus suffix": "Bearer s3cret-token-x"}
	for _, rt := range routes {
		for name, a := range auths {
			req, _ := http.NewRequest(rt[0], hs.URL+rt[1], strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}`))
			if a != "" {
				req.Header.Set("Authorization", a)
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()
			if resp.StatusCode != 401 {
				t.Errorf("%s %s with %s: %d, want 401", rt[0], rt[1], name, resp.StatusCode)
			}
		}
		req, _ := http.NewRequest(rt[0], hs.URL+rt[1], strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}`))
		req.Header.Set("Authorization", "Bearer s3cret-token")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Errorf("%s %s with the right token: %d", rt[0], rt[1], resp.StatusCode)
		}
	}
	resp, err := http.Get(hs.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("/healthz must stay open for the orchestrator: %d", resp.StatusCode)
	}
}

// T-IDX-002 (handler level): with an empty token the handler is open — the binary refuses to start that way (cmd/rpc-gateway),
// so this pins the documented contract that the guard lives in main, not in Handler.
func TestQAGatewayEmptyTokenHandlerIsOpen(t *testing.T) {
	r := newRig(t, 1000, nil)
	hs := httptest.NewServer(r.g.Handler(""))
	defer hs.Close()
	resp, err := http.Get(hs.URL + "/status")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status %d", resp.StatusCode)
	}
}
