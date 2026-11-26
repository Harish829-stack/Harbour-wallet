package earnsvc

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const (
	owner  = "0x7ece450c274672c8007372F81cfCCC1c412466bb"
	pool   = "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27"
	usdc   = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f"
	sepolA = 84532
)

func testSvc(t *testing.T, h http.HandlerFunc) (*Service, *atomic.Int64) {
	t.Helper()
	var hits atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1); h(w, r) }))
	t.Cleanup(srv.Close)
	now := time.Unix(1_800_000_000, 0)
	return New(Config{Hosts: Hosts{AaveKit: srv.URL + "/graphql", LidoAPR: srv.URL + "/lido", RocketAPR: srv.URL + "/rp"}, Now: func() time.Time { return now }}), &hits
}

func code(err error) string {
	if e, ok := err.(*Error); ok {
		return e.Code + "/" + e.Reason
	}
	return "?"
}

func TestAaveFixedQueriesAndVariables(t *testing.T) {
	var got map[string]any
	s, _ := testSvc(t, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &got)
		io.WriteString(w, `{"data":{"value":{"__typename":"TransactionRequest","to":"`+pool+`"}}}`)
	})
	data, err := s.AaveTransaction(context.Background(), AaveTxRequest{Action: "supply", ChainID: sepolA, Market: pool, Sender: owner, Token: usdc, Value: "5"})
	if err != nil || !strings.Contains(string(data), "TransactionRequest") {
		t.Fatalf("%v %s", err, data)
	}
	q := got["query"].(string)
	if !strings.HasPrefix(q, "query HarbourEarnSupply") {
		t.Fatalf("query %q", q)
	}
	r := got["variables"].(map[string]any)["r"].(map[string]any)
	erc := r["amount"].(map[string]any)["erc20"].(map[string]any)
	if r["sender"] != owner || r["market"] != pool || erc["currency"] != usdc || erc["value"] != "5" || r["chainId"].(float64) != sepolA {
		t.Fatalf("vars %v", r)
	}
	// native withdraw uses the exact-value shape
	if _, err := s.AaveTransaction(context.Background(), AaveTxRequest{Action: "withdraw", ChainID: sepolA, Market: pool, Sender: owner, Value: "0.0001"}); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got["query"].(string), "query HarbourEarnWithdraw") {
		t.Fatal("withdraw query")
	}
	n := got["variables"].(map[string]any)["r"].(map[string]any)["amount"].(map[string]any)["native"].(map[string]any)["value"].(map[string]any)
	if n["exact"] != "0.0001" {
		t.Fatalf("native %v", n)
	}
}

func TestAaveValidationAndChainAllowlist(t *testing.T) {
	s, hits := testSvc(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, `{"data":{}}`) })
	bad := []AaveTxRequest{
		{Action: "borrow", ChainID: sepolA, Market: pool, Sender: owner, Value: "1"},
		{Action: "supply", ChainID: sepolA, Market: "0x1", Sender: owner, Value: "1"},
		{Action: "supply", ChainID: sepolA, Market: pool, Sender: owner, Value: "-1"},
		{Action: "supply", ChainID: sepolA, Market: pool, Sender: owner, Value: "0"},
		{Action: "supply", ChainID: sepolA, Market: pool, Sender: owner, Value: "1e18"},
		{Action: "supply", ChainID: sepolA, Market: pool, Sender: owner, Token: "evil", Value: "1"},
	}
	for _, b := range bad {
		if _, err := s.AaveTransaction(context.Background(), b); code(err) != "bad_request/" {
			t.Errorf("%+v: %v", b, err)
		}
	}
	if _, err := s.AaveTransaction(context.Background(), AaveTxRequest{Action: "supply", ChainID: 1, Market: pool, Sender: owner, Value: "1"}); code(err) != "unsupported/" {
		t.Fatal("mainnet Aave must be off until configured")
	}
	if _, err := s.AaveMarkets(context.Background(), 1); code(err) != "unsupported/" {
		t.Fatal("markets chain allowlist")
	}
	if hits.Load() != 0 {
		t.Fatal("invalid requests reached AaveKit")
	}
}

func TestAaveErrorsAreCategorisedNeverPassedThrough(t *testing.T) {
	msg := ""
	s, _ := testSvc(t, func(w http.ResponseWriter, r *http.Request) {
		if msg == "500" {
			w.WriteHeader(500)
			return
		}
		io.WriteString(w, `{"data":null,"errors":[{"message":"`+msg+`"}]}`)
	})
	cases := map[string]string{
		"Bad user input - Supply cap reached for reserve 0xba50": "aave_rejected/supply_cap",
		"Bad user input - no supply to withdraw":                 "aave_rejected/not_available",
		"Bad user input - health factor too low":                 "aave_rejected/health_factor",
		"Bad user input - reserve is paused":                     "aave_rejected/paused",
		"Bad user input - something new":                         "aave_rejected/other",
		"Internal server error":                                  "unavailable/",
		"500":                                                    "unavailable/",
	}
	for m, want := range cases {
		msg = m
		_, err := s.AaveMarkets(context.Background(), sepolA)
		if code(err) != want {
			t.Errorf("%q: got %s want %s", m, code(err), want)
		}
		if strings.Contains(err.Error(), "0xba50") {
			t.Fatal("upstream text leaked")
		}
	}
}

func TestAPRCachedValidatedAndKillSwitch(t *testing.T) {
	lido := `{"data":{"smaApr":2.876}}`
	s, hits := testSvc(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/lido") {
			io.WriteString(w, lido)
			return
		}
		io.WriteString(w, `{"yearlyAPR":"2.51"}`)
	})
	v, err := s.APR(context.Background(), Lido)
	if err != nil || v != 2.88 {
		t.Fatalf("%v %v", v, err)
	}
	lido = `{"data":{"smaApr":5000}}`
	if v2, _ := s.APR(context.Background(), Lido); v2 != 2.88 || hits.Load() != 1 {
		t.Fatal("not cached")
	}
	if v, err := s.APR(context.Background(), RocketPool); err != nil || v != 2.51 {
		t.Fatalf("rp %v %v", v, err)
	}
	s.cfg.Now = func() time.Time { return time.Unix(1_800_000_000, 0).Add(time.Hour) }
	if _, err := s.APR(context.Background(), Lido); code(err) != "unavailable/" {
		t.Fatal("absurd APR accepted")
	}
	if _, err := s.APR(context.Background(), "evil"); code(err) != "bad_request/" {
		t.Fatal("provider not validated")
	}
	off := New(Config{Disabled: ParseDisabled("aave, lido")})
	if _, err := off.APR(context.Background(), Lido); code(err) != "unavailable/" {
		t.Fatal("kill switch")
	}
	if _, err := off.AaveMarkets(context.Background(), sepolA); code(err) != "unavailable/" {
		t.Fatal("aave kill switch")
	}
	if off.ProviderStates()[Aave] || !off.ProviderStates()[RocketPool] {
		t.Fatal("states")
	}
}

func TestRedirectNotFollowed(t *testing.T) {
	var leaked atomic.Int64
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked.Add(1) }))
	defer other.Close()
	s, _ := testSvc(t, func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, other.URL, http.StatusFound) })
	if _, err := s.AaveMarkets(context.Background(), sepolA); err == nil || leaked.Load() != 0 {
		t.Fatal("redirect followed")
	}
}
