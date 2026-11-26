package onramper

import (
	"context"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// Vectors below were produced with Node's crypto (the reference TypeScript from Onramper's docs: URLSearchParams + sort,
// JSON canonicalised with sorted keys, sign(null, …) Ed25519) for seed 0x01..0x20.
func testKey() ed25519.PrivateKey {
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = byte(i + 1)
	}
	return ed25519.NewKeyFromSeed(seed)
}

func vectorIntent() IntentRequest {
	return IntentRequest{Type: "buy", Onramp: "banxa", Source: "EUR", Destination: "eth", Amount: 100.5, PaymentMethod: "creditcard",
		Network: "ethereum", WalletAddress: "0xAbCdEf0000000000000000000000000000000001", EndUserIPHash: HashIP("203.0.113.7"),
		Country: "DE", PartnerContext: "ord-1", SuccessURL: "https://api.example.com/v1/ramps/return?o=ord-1"}
}

func TestIntentBodyAndSignatureMatchNodeReference(t *testing.T) {
	body, err := IntentBody(vectorIntent())
	if err != nil {
		t.Fatal(err)
	}
	const wantBody = `{"amount":100.5,"country":"de","destination":"eth","endUserIpHash":"fec52565aa0cf18f57d7cf5b3ac728503b8992d2d6f7d46da1d1201090902b02","network":"ethereum","onramp":"banxa","partnerContext":"ord-1","paymentMethod":"creditcard","platform":"browser-extension","source":"eur","supportedParams":{"partnerData":{"redirectUrl":{"success":"https://api.example.com/v1/ramps/return?o=ord-1"}}},"type":"buy","wallet":{"address":"0xAbCdEf0000000000000000000000000000000001"}}`
	if string(body) != wantBody {
		t.Fatalf("body\n got %s\nwant %s", body, wantBody)
	}
	s := NewSigner(testKey())
	s.now = func() time.Time { return time.Date(2026, 1, 15, 10, 30, 0, 0, time.UTC) }
	s.uid = func() string { return "550e8400-e29b-41d4-a716-446655440000" }
	h := s.Headers(Request{Method: "post", Path: "/checkout/v2/intent", APIKey: "pk_test_abc", ContentType: "application/json", Body: body})
	if h["x-onramper-timestamp"] != "2026-01-15T10:30:00.000Z" || h["x-onramper-nonce"] != "550e8400-e29b-41d4-a716-446655440000" || h["Authorization"] != "pk_test_abc" {
		t.Fatalf("headers %v", h)
	}
	const wantSig = "v2:R990OvOAa2miE3KUuo06LnQukGKp3heAzbvtNTMMrv80VOUdWXKJxvb/rYfFLFMQUFsde8vDuAhod4LQN7ROCA=="
	if h["x-onramper-signature"] != wantSig {
		t.Fatalf("signature\n got %s\nwant %s", h["x-onramper-signature"], wantSig)
	}
	if hex.EncodeToString(s.Public()) != "79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664" {
		t.Fatal("public key mismatch")
	}
}

func TestCanonicalQueryMatchesURLSearchParams(t *testing.T) {
	got := CanonicalQuery([]Param{{"wallets", "btc:bc1q x*~"}, {"apiKey", "pk_test_xxx"}, {"defaultAmount", "100"}})
	if want := "apiKey=pk_test_xxx&defaultAmount=100&wallets=btc%3Abc1q+x*%7E"; got != want {
		t.Fatalf("got %s want %s", got, want)
	}
	if CanonicalQuery(nil) != "" {
		t.Fatal("empty query must be empty")
	}
}

func TestESNumberFormatting(t *testing.T) {
	for in, want := range map[float64]string{0.1: "0.1", 100: "100", 1e21: "1e+21", 1.5e-7: "1.5e-7", 0.000001: "0.000001", 123456789.125: "123456789.125", 0: "0"} {
		if got, _ := esNumber(in); got != want {
			t.Errorf("%v: got %s want %s", in, got, want)
		}
	}
}

func TestCanonicalizeEscapingAndOrder(t *testing.T) {
	b, err := Canonicalize(map[string]any{"b": "<&> \"\\\n\x01", "a": []any{true, nil, 1}, "é": 1, "z": 2})
	if err != nil {
		t.Fatal(err)
	}
	if want := "{\"a\":[true,null,1],\"b\":\"<&> \\\"\\\\\\n\\u0001\",\"z\":2,\"é\":1}"; string(b) != want {
		t.Fatalf("got %s want %s", b, want)
	}
	if _, err := Canonicalize(map[string]any{"x": struct{}{}}); err == nil {
		t.Fatal("unsupported type must fail")
	}
}

func TestParsePrivateKeyFormats(t *testing.T) {
	k := testKey()
	der, _ := x509.MarshalPKCS8PrivateKey(k)
	p := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
	lines := strings.Split(strings.TrimSpace(p), "\n")
	for name, in := range map[string]string{"pem": p, "pem-one-line": strings.ReplaceAll(p, "\n", `\n`), "seed-hex": hex.EncodeToString(k.Seed()), "full-hex": hex.EncodeToString(k),
		"body-only": lines[1], "quoted": `"` + strings.ReplaceAll(p, "\n", `\n`) + `"`, "spaced": strings.Join(lines, ` \n `), "crlf": strings.ReplaceAll(p, "\n", "\r\n")} {
		got, err := ParsePrivateKey(in)
		if err != nil || !got.Equal(k) {
			t.Errorf("%s: %v", name, err)
		}
	}
	for _, bad := range []string{"", "nope", "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----", hex.EncodeToString(make([]byte, 31)), "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----", "-----BEGIN PRIVATE KEY-----MC4C"} {
		if _, err := ParsePrivateKey(bad); err == nil {
			t.Errorf("accepted %q", bad)
		}
	}
}

func TestWebhookVerifyAndParse(t *testing.T) {
	body := []byte(`{"transactionId":"01H","onramp":"banxa","status":"paid","statusDate":"2026-01-15T10:30:00.000Z","transactionType":"buy","partnerContext":"ord-1","outAmount":0.05,"inAmount":100,"sourceCurrency":"eur","targetCurrency":"eth"}`)
	m := hmac.New(sha256.New, []byte("whsec"))
	m.Write(body)
	sig := hex.EncodeToString(m.Sum(nil))
	if err := VerifyWebhook("whsec", body, sig); err != nil {
		t.Fatal(err)
	}
	if err := VerifyWebhook("whsec", body, "sha256="+strings.ToUpper(sig)); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"", "zz", sig[:10], strings.Repeat("0", 64)} {
		if VerifyWebhook("whsec", body, bad) == nil {
			t.Errorf("accepted %q", bad)
		}
	}
	if VerifyWebhook("", body, sig) == nil {
		t.Fatal("empty secret must fail")
	}
	e, err := ParseEvent(body)
	if err != nil || e.PartnerContext != "ord-1" || NormalizeStatus(e.Status) != StatusPending || e.StatusDate.IsZero() {
		t.Fatalf("%+v %v", e, err)
	}
	for in, want := range map[string]string{"new": StatusPending, "COMPLETED": StatusCompleted, "cancelled": StatusCanceled, "failed": StatusFailed, "weird": ""} {
		if NormalizeStatus(in) != want {
			t.Errorf("%s", in)
		}
	}
}

func TestTrustedCheckoutURL(t *testing.T) {
	for u, ok := range map[string]bool{"https://buy.onramper.com?session=1": true, "https://buy.onramper.dev/x": true, "http://buy.onramper.com": false,
		"https://onramper.com.evil.io": false, "https://u:p@buy.onramper.com": false, "javascript:alert(1)": false} {
		if TrustedCheckoutURL(u) != ok {
			t.Errorf("%s", u)
		}
	}
}

func TestClientAgainstFakeServer(t *testing.T) {
	var gotSig, gotBody, gotQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "pk_test_abc" {
			w.WriteHeader(401)
			w.Write([]byte(`{"message":"Unauthorized"}`))
			return
		}
		switch {
		case r.URL.Path == "/supported":
			gotQuery = r.URL.RawQuery
			w.Write([]byte(`{"message":{"crypto":[{"id":"eth","code":"ETH","network":"ethereum","chainId":1,"decimals":18},{"id":"usdc_base","code":"USDC","network":"base","chainId":"8453","address":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"},{"code":"NOID"}],"fiat":[{"id":"eur","code":"EUR"}]}}`))
		case strings.HasPrefix(r.URL.Path, "/quotes/eur/eth"):
			gotQuery = r.URL.RawQuery
			w.Write([]byte(`[{"ramp":"banxa","paymentMethod":"creditcard","rate":2000,"payout":0.05,"quoteId":"q1","availablePaymentMethods":[{"paymentTypeId":"creditcard","name":"Card"}]},{"ramp":"moonpay","errors":[{"type":"x","errorId":6103,"message":"no pm"}]}]`))
		case r.URL.Path == "/checkout/v2/intent":
			gotSig = r.Header.Get("x-onramper-signature")
			b, _ := io.ReadAll(r.Body)
			gotBody = string(b)
			w.Write([]byte(`{"redirectUrl":"https://buy.onramper.com?session=S&resumeToken=T","sessionId":"S"}`))
		default:
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()
	c := &Client{BaseURL: srv.URL, APIKey: "pk_test_abc", Signer: NewSigner(testKey())}
	ctx := context.Background()
	cr, fi, err := c.Supported(ctx, "buy", "de")
	if err != nil || len(cr) != 2 || cr[1].ChainID != 8453 || cr[0].ChainID != 1 || len(fi) != 1 || !strings.Contains(gotQuery, "country=de") {
		t.Fatalf("%v %+v %v %s", err, cr, fi, gotQuery)
	}
	qs, err := c.Quotes(ctx, QuoteRequest{Type: "buy", Source: "EUR", Destination: "eth", Amount: "100", Country: "de"})
	if err != nil || len(qs) != 2 || qs[0].Payout != 0.05 || len(qs[1].Errors) != 1 || !strings.Contains(gotQuery, "platform=browser-extension") {
		t.Fatalf("%v %+v %s", err, qs, gotQuery)
	}
	in, err := c.CreateIntent(ctx, vectorIntent())
	if err != nil || in.SessionID != "S" || !strings.HasPrefix(gotSig, "v2:") || !strings.Contains(gotBody, `"partnerContext":"ord-1"`) {
		t.Fatalf("%v %+v %s %s", err, in, gotSig, gotBody)
	}
	var parsed map[string]any
	if json.Unmarshal([]byte(gotBody), &parsed) != nil {
		t.Fatal("body is not JSON")
	}
	bad := &Client{BaseURL: srv.URL, APIKey: "nope"}
	if _, _, err := bad.Supported(ctx, "buy", ""); !IsAuth(err) {
		t.Fatalf("want auth error, got %v", err)
	}
	if _, err := (&Client{BaseURL: srv.URL, APIKey: "pk_test_abc"}).CreateIntent(ctx, vectorIntent()); err == nil {
		t.Fatal("intent without signer must fail")
	}
}
