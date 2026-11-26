package api

// Unit tests for /v1/ramps (no Postgres/Redis): feature gate, input validation, quote normalisation, upstream error mapping,
// country resolution and the static return page.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"harbour/backend/internal/onramper"
)

func rampsServer(t *testing.T, upstream http.HandlerFunc) (*Server, *logBuf) {
	t.Helper()
	s, lb := bareServer(t)
	up := httptest.NewServer(upstream)
	t.Cleanup(up.Close)
	s.opt.Ramps = &RampsOptions{Client: &onramper.Client{BaseURL: up.URL, APIKey: "pk_test_x"}}
	return s, lb
}

func TestRampsDisabledAnswers503(t *testing.T) {
	s, _ := bareServer(t)
	for _, h := range []http.HandlerFunc{s.handleRampsConfig, s.handleRampsQuotes, s.handleRampsCheckout} {
		w := httptest.NewRecorder()
		h(w, httptest.NewRequest("GET", "/v1/ramps/x", strings.NewReader("{}")))
		if w.Code != 503 || !strings.Contains(w.Body.String(), "ramps_unavailable") {
			t.Fatalf("%d %s", w.Code, w.Body)
		}
	}
}

func TestRampsQuotesNormalisesAndValidates(t *testing.T) {
	var gotPath, gotQuery string
	s, _ := rampsServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotQuery = r.URL.Path, r.URL.RawQuery
		w.Write([]byte(`[{"ramp":"Banxa","paymentMethod":"CreditCard","payout":0.05,"rate":2000,"availablePaymentMethods":[{"paymentTypeId":"creditcard","name":"Card"}],"recommendations":["BestPrice"]},
			{"ramp":"moonpay","errors":[{"type":"x","errorId":6103,"message":"Minimum is 30"}]},{"ramp":"bad provider!","payout":1}]`))
	})
	w := httptest.NewRecorder()
	s.handleRampsQuotes(w, httptest.NewRequest("GET", "/v1/ramps/quotes?type=buy&source=EUR&destination=eth&amount=100&country=DE", nil))
	if w.Code != 200 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	var resp struct {
		Quotes      []rampQuoteView `json:"quotes"`
		Unavailable []string        `json:"unavailable"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Quotes) != 1 || resp.Quotes[0].Provider != "banxa" || resp.Quotes[0].PaymentMethod != "creditcard" || resp.Quotes[0].Payout != 0.05 ||
		len(resp.Unavailable) != 1 || resp.Unavailable[0] != "moonpay" {
		t.Fatalf("%+v", resp)
	}
	if strings.Contains(w.Body.String(), "Minimum is 30") {
		t.Fatal("raw upstream error text leaked to the client")
	}
	if gotPath != "/quotes/eur/eth" || !strings.Contains(gotQuery, "country=de") || !strings.Contains(gotQuery, "platform=browser-extension") {
		t.Fatalf("%s ? %s", gotPath, gotQuery)
	}
	for _, q := range []string{"type=swap&source=eur&destination=eth&amount=1", "source=eur&destination=eth&amount=0", "source=eur&destination=eth&amount=1e3",
		"source=eur/../x&destination=eth&amount=1", "source=eur&destination=eth&amount=1&payment_method=a%20b", "source=&destination=eth&amount=1"} {
		w := httptest.NewRecorder()
		s.handleRampsQuotes(w, httptest.NewRequest("GET", "/v1/ramps/quotes?"+q, nil))
		if w.Code != 400 {
			t.Errorf("%s: %d", q, w.Code)
		}
	}
}

func TestRampsUpstreamErrorsAreMapped(t *testing.T) {
	status := 401
	s, lb := rampsServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		w.Write([]byte(`{"message":"secret upstream detail","errorId":4011}`))
	})
	for want, st := range map[int]int{503: 401, 400: 422, 502: 500} {
		status = st
		w := httptest.NewRecorder()
		s.handleRampsQuotes(w, httptest.NewRequest("GET", "/v1/ramps/quotes?source=eur&destination=eth&amount=10", nil))
		if w.Code != want || strings.Contains(w.Body.String(), "secret upstream detail") {
			t.Errorf("upstream %d -> %d %s", st, w.Code, w.Body)
		}
	}
	if !strings.Contains(lb.String(), "ONRAMPER_API_KEY") {
		t.Error("auth failures must tell the operator what to check")
	}
}

func TestRampsConfigAndCountry(t *testing.T) {
	var gotQuery string
	s, _ := rampsServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		w.Write([]byte(`{"message":{"crypto":[{"id":"eth","code":"ETH","network":"ethereum","chainId":1}],"fiat":[{"id":"eur","code":"EUR"}]}}`))
	})
	req := httptest.NewRequest("GET", "/v1/ramps/config?type=buy", nil)
	req.Header.Set("CF-IPCountry", "IN")
	w := httptest.NewRecorder()
	s.handleRampsConfig(w, req)
	if w.Code != 200 || strings.Contains(gotQuery, "country=") {
		t.Fatalf("CF-IPCountry must be ignored without TRUST_PROXY_HEADERS: %d %s", w.Code, gotQuery)
	}
	s.opt.TrustProxy = true
	w = httptest.NewRecorder()
	s.handleRampsConfig(w, req)
	var resp rampsConfigResp
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if !strings.Contains(gotQuery, "country=in") || resp.Country != "in" || len(resp.Cryptos) != 1 || resp.Cryptos[0].ChainID != 1 {
		t.Fatalf("%s %+v", gotQuery, resp)
	}
	w = httptest.NewRecorder()
	s.handleRampsConfig(w, httptest.NewRequest("GET", "/v1/ramps/config?type=lend", nil))
	if w.Code != 400 {
		t.Fatal(w.Code)
	}
}

func TestRampsCheckoutRejectsBadInputBeforeAnyLookup(t *testing.T) {
	s, _ := rampsServer(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("upstream must not be called")
		w.WriteHeader(500)
	})
	base := map[string]any{"type": "buy", "provider": "banxa", "payment_method": "creditcard", "source": "eur", "destination": "eth", "network": "ethereum",
		"chain": "ethereum", "amount": "100", "address": "0x0000000000000000000000000000000000000001"}
	for k, v := range map[string]any{"type": "lend", "provider": "Ban xa", "amount": "-1", "chain": "ETH/../x", "network": "", "country": "deu", "destination": "e th"} {
		body := map[string]any{}
		for a, b := range base {
			body[a] = b
		}
		body[k] = v
		raw, _ := json.Marshal(body)
		w := httptest.NewRecorder()
		s.handleRampsCheckout(w, httptest.NewRequest("POST", "/v1/ramps/checkout", strings.NewReader(string(raw))))
		if w.Code != 400 {
			t.Errorf("%s=%v: %d", k, v, w.Code)
		}
	}
}

func TestRampsOtherFamilyAddressShape(t *testing.T) {
	s, _ := bareServer(t)
	for addr, want := range map[string]bool{"bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq": true, "4Nd1mYQn7tVv4y5kqXyV3b8fZ9T2N1gP6dEJc7rWqXvK": true,
		"0x1234": false, "short": false, "evil\naddr0000000000000000": false, "0XABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD12": false} {
		got, err := s.ownsAddress(t.Context(), "", addr)
		if err != nil || got != want {
			t.Errorf("%q: %v %v", addr, got, err)
		}
	}
}

func TestRampsReturnPageIsStatic(t *testing.T) {
	s, _ := bareServer(t)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/v1/ramps/return?order=<script>", nil))
	if w.Code != 200 || strings.Contains(w.Body.String(), "<script>") || !strings.Contains(w.Header().Get("Content-Security-Policy"), "default-src 'none'") {
		t.Fatalf("%d %s %s", w.Code, w.Header(), w.Body)
	}
}
