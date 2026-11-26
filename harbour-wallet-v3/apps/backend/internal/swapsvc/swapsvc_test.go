package swapsvc

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
	me    = "0x1111111111111111111111111111111111111111"
	usdc  = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
	diam  = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"
	solMe = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
	btcMe = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
)

func eth() Asset {
	return Asset{AssetID: "c60", DomainID: "ethereum", Address: "native", Symbol: "ETH", Name: "Ethereum", Decimals: 18}
}
func usdC() Asset {
	return Asset{AssetID: "c60_t" + usdc, DomainID: "ethereum", Address: usdc, Symbol: "USDC", Name: "USD Coin", Decimals: 6}
}
func btc() Asset {
	return Asset{AssetID: "c0", DomainID: "bitcoin", Address: "native", Symbol: "BTC", Name: "Bitcoin", Decimals: 8}
}
func sol() Asset {
	return Asset{AssetID: "c501", DomainID: "solana", Address: "native", Symbol: "SOL", Name: "Solana", Decimals: 9}
}
func solUSDC() Asset {
	return Asset{AssetID: "c501_tEPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", DomainID: "solana", Address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", Symbol: "USDC", Name: "USD Coin", Decimals: 6}
}

func req(from, to Asset, amount string) QuoteRequest {
	fa, ta := me, me
	if from.DomainID == "solana" {
		fa = solMe
	}
	if to.DomainID == "solana" {
		ta = solMe
	}
	if from.DomainID == "bitcoin" {
		fa = btcMe
	}
	if to.DomainID == "bitcoin" {
		ta = btcMe
	}
	return QuoteRequest{From: from, To: to, FromAddress: fa, ToAddress: ta, Amount: amount, Slippage: "1", SortBy: "quantity"}
}

// fake upstream: one handler per path suffix; records headers.
type fake struct {
	srv     *httptest.Server
	handler map[string]func(w http.ResponseWriter, r *http.Request, body []byte)
	hits    atomic.Int64
	headers atomic.Value
}

func newFake(t *testing.T) *fake {
	f := &fake{handler: map[string]func(http.ResponseWriter, *http.Request, []byte){}}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.hits.Add(1)
		f.headers.Store(r.Header.Clone())
		b, _ := io.ReadAll(r.Body)
		for p, h := range f.handler {
			if strings.HasPrefix(r.URL.Path, p) {
				h(w, r, b)
				return
			}
		}
		w.WriteHeader(404)
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func jsonOK(v string) func(http.ResponseWriter, *http.Request, []byte) {
	return func(w http.ResponseWriter, _ *http.Request, _ []byte) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, v)
	}
}

func svc(f *fake, keys Keys) *Service {
	return New(Config{Keys: keys, Hosts: Hosts{LiFi: f.srv.URL + "/lifi", Jupiter: f.srv.URL + "/jup", Relay: f.srv.URL + "/relay", Uniswap: f.srv.URL + "/uni", Thor: []string{f.srv.URL + "/thor1", f.srv.URL + "/thor2"}},
		Now: func() time.Time { return time.Unix(1_800_000_000, 0) }, ProviderTimeout: 2 * time.Second})
}

const lifiRoutesJSON = `{"routes":[
 {"id":"r1","fromAmountUSD":"10","toAmountUSD":"9.9","tags":["RECOMMENDED"],"steps":[{"id":"s1","type":"lifi","tool":"1inch","toolDetails":{"key":"1inch","name":"1inch","logoURI":"https://x/1inch.png"},
  "action":{"fromToken":{"address":"0x0000000000000000000000000000000000000000","chainId":1,"symbol":"ETH","decimals":18},"toToken":{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"symbol":"USDC","decimals":6},"fromAmount":"1000000000000000"},
  "estimate":{"toAmount":"2500000","toAmountMin":"2475000","approvalAddress":"0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE","executionDuration":30,
   "gasCosts":[{"token":{"address":"0x0000000000000000000000000000000000000000","symbol":"ETH","decimals":18},"amount":"100","amountUSD":"0.01"},{"token":{"address":"0x0000000000000000000000000000000000000000","symbol":"ETH","decimals":18},"amount":"50","amountUSD":"0.005"}],
   "feeCosts":[{"token":{"address":"0x0000000000000000000000000000000000000000","symbol":"ETH","decimals":18},"amount":"7","amountUSD":"0.001","name":"LI.FI fee"}]},
  "includedSteps":[{"type":"swap"}]}]},
 {"id":"r2","steps":[{"id":"a"},{"id":"b"}]},
 {"id":"r3","steps":[{"id":"s3","action":{"fromToken":{"address":"0x0000000000000000000000000000000000000000","chainId":1,"symbol":"ETH","decimals":18},"toToken":{"address":"0x9999999999999999999999999999999999999999","chainId":1,"symbol":"FAKE","decimals":6},"fromAmount":"1000000000000000"},"estimate":{"toAmount":"9999999999","toAmountMin":"1"}}]},
 {"id":"r4","steps":[{"id":"s4","action":{"fromToken":{"address":"0x0000000000000000000000000000000000000000","chainId":1,"symbol":"ETH","decimals":18},"toToken":{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"symbol":"USDC","decimals":6},"fromAmount":"5"},"estimate":{"toAmount":"9999999999","toAmountMin":"1"}}]}
]}`

func TestValidate(t *testing.T) {
	ok := req(eth(), usdC(), "1000")
	if err := ok.Validate(); err != nil {
		t.Fatal(err)
	}
	cases := map[string]func(r *QuoteRequest){
		"invalid_amount":     func(r *QuoteRequest) { r.Amount = "0" },
		"invalid_amount2":    func(r *QuoteRequest) { r.Amount = "1.5" },
		"invalid_slippage":   func(r *QuoteRequest) { r.Slippage = "31" },
		"invalid_slippage2":  func(r *QuoteRequest) { r.Slippage = "0" },
		"unsupported_pair":   func(r *QuoteRequest) { r.To = eth() },
		"unsupported_domain": func(r *QuoteRequest) { r.To.DomainID = "dogecoin" },
		"invalid_asset":      func(r *QuoteRequest) { r.FromAddress = solMe },
		"invalid_asset2":     func(r *QuoteRequest) { r.To.Address = "0x123" },
		"invalid_asset3":     func(r *QuoteRequest) { r.To.Symbol = "<script>" },
		"bad_request":        func(r *QuoteRequest) { r.Providers = []string{"evil"} },
	}
	for name, mut := range cases {
		r := req(eth(), usdC(), "1000")
		mut(&r)
		err := r.Validate()
		want := strings.TrimRight(name, "23")
		if e := asErr(err); err == nil || e.Code != want {
			t.Errorf("%s: got %v", name, err)
		}
	}
}

func TestLiFiRoutesKeepOnlyExactRequestedTrade(t *testing.T) {
	f := newFake(t)
	var sent map[string]any
	f.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, r *http.Request, b []byte) {
		json.Unmarshal(b, &sent)
		io.WriteString(w, lifiRoutesJSON)
	}
	s := svc(f, Keys{LiFi: "lk"})
	res, err := s.Quotes(context.Background(), QuoteRequest{From: eth(), To: usdC(), FromAddress: me, ToAddress: me, Amount: "1000000000000000", Slippage: "1", SortBy: "quantity", Providers: []string{LiFi}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Routes) != 1 {
		t.Fatalf("want 1 route (multi-step, wrong token, wrong amount dropped), got %d", len(res.Routes))
	}
	st := res.Routes[0].Steps[0]
	if st.To.Amount != "2500000" || st.To.MinAmount != "2475000" || st.From.Amount != "1000000000000000" || st.To.Asset.Address != usdc {
		t.Fatalf("bad step %+v", st)
	}
	if st.NetworkFee == nil || st.NetworkFee.Amount != "150" || len(st.ProviderFees) != 1 || st.Approval != nil || st.Type != "aggregate" {
		t.Fatalf("fees/approval wrong: %+v %+v %+v", st.NetworkFee, st.ProviderFees, st.Approval)
	}
	if !contains(res.Routes[0].Tags, "BEST_RETURN") || *res.Routes[0].PriceImpact != -1 {
		t.Fatalf("tags/impact %+v %v", res.Routes[0].Tags, *res.Routes[0].PriceImpact)
	}
	if h := f.headers.Load().(http.Header); h.Get("x-lifi-api-key") != "lk" {
		t.Fatal("key not sent")
	}
	opts := sent["options"].(map[string]any)
	if opts["integrator"] != "harbour-wallet" || opts["slippage"].(float64) != 0.01 || opts["order"] != "CHEAPEST" || sent["fromAddress"] != me {
		t.Fatalf("bad body %v", sent)
	}
	var raw map[string]any
	if json.Unmarshal(st.Raw, &raw) != nil || raw["id"] != "s1" {
		t.Fatal("raw step not kept")
	}
}

func TestLiFiTokenSellHasApproval(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = jsonOK(`{"routes":[{"id":"r","steps":[{"id":"s","type":"swap","action":{"fromToken":{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"symbol":"USDC","decimals":6},"toToken":{"address":"0x0000000000000000000000000000000000000000","chainId":1,"symbol":"ETH","decimals":18},"fromAmount":"5000000"},"estimate":{"toAmount":"2","toAmountMin":"1","approvalAddress":"` + diam + `"}}]}]}`)
	s := svc(f, Keys{})
	res, err := s.Quotes(context.Background(), req(usdC(), eth(), "5000000"))
	if err != nil {
		t.Fatal(err)
	}
	a := res.Routes[0].Steps[0].Approval
	if a == nil || a.Spender != diam || a.MinAmount != "5000000" || a.TokenAddress != usdc {
		t.Fatalf("approval %+v", a)
	}
}

func TestProviderErrorsAndRanking(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, _ *http.Request, _ []byte) {
		w.WriteHeader(400)
		io.WriteString(w, `{"message":"Amount too low <script>steal()</script>"}`)
	}
	f.handler["/relay/quote/v2"] = func(w http.ResponseWriter, _ *http.Request, _ []byte) { w.WriteHeader(503) }
	s := svc(f, Keys{Relay: "rk"})
	_, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000"))
	if e := asErr(err); e.Code != "amount_too_low" {
		t.Fatalf("user-fixable error should win, got %v", err)
	}
	if strings.Contains(err.Error(), "script") {
		t.Fatal("upstream text leaked")
	}
}

func TestKillSwitchAndMissingKeys(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = jsonOK(lifiRoutesJSON)
	s := New(Config{Hosts: Hosts{LiFi: f.srv.URL + "/lifi"}, Disabled: ParseDisabled(" LiFi , thorchain")})
	if s.Enabled(LiFi) || s.Enabled(THORChain) || s.Enabled(Relay) || s.Enabled(Jupiter) || s.Enabled(Uniswap) {
		t.Fatalf("states %v", s.ProviderStates())
	}
	_, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000000000000000"))
	if asErr(err).Code != "unsupported_pair" || f.hits.Load() != 0 {
		t.Fatalf("disabled provider was called: %v hits=%d", err, f.hits.Load())
	}
	if _, err := s.Transaction(context.Background(), TxRequest{Source: LiFi, Step: json.RawMessage(`{"id":"x"}`)}); asErr(err).Code != "unavailable" {
		t.Fatal("disabled provider built a transaction")
	}
}

func TestRedirectsAreNotFollowed(t *testing.T) {
	var leaked atomic.Int64
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked.Add(1) }))
	defer other.Close()
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		http.Redirect(w, r, other.URL+"/steal", http.StatusTemporaryRedirect)
	}
	s := svc(f, Keys{LiFi: "secret"})
	if _, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000")); err == nil {
		t.Fatal("expected failure")
	}
	if leaked.Load() != 0 {
		t.Fatal("redirect followed: API key could leak")
	}
}

func TestTimeoutAndOversizedBody(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		select {
		case <-time.After(3 * time.Second):
		case <-r.Context().Done():
		}
	}
	s := svc(f, Keys{})
	s.cfg.ProviderTimeout = 200 * time.Millisecond
	_, err := s.Quotes(context.Background(), QuoteRequest{From: eth(), To: usdC(), FromAddress: me, ToAddress: me, Amount: "1000", Slippage: "1", Providers: []string{LiFi}})
	if asErr(err).Code != "timeout" {
		t.Fatalf("got %v", err)
	}
	f2 := newFake(t)
	f2.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, _ *http.Request, _ []byte) {
		w.Write([]byte(`{"routes":"` + strings.Repeat("a", maxBody) + `"}`))
	}
	s = svc(f2, Keys{})
	_, err = s.Quotes(context.Background(), QuoteRequest{From: eth(), To: usdC(), FromAddress: me, ToAddress: me, Amount: "1000", Slippage: "1", Providers: []string{LiFi}})
	if asErr(err).Code != "server" {
		t.Fatalf("oversized body: %v", err)
	}
}

const relayQuoteJSON = `{"requestId":"0xabc","steps":[
 {"id":"approve","kind":"transaction","items":[{"status":"incomplete","data":{"to":"` + usdc + `","data":"0x095ea7b30000000000000000000000004444444444444444444444444444444444444444ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}}]},
 {"id":"deposit","kind":"transaction","items":[{"status":"incomplete","data":{"to":"0x4444444444444444444444444444444444444444","data":"0xabcdef"}}]}],
 "fees":{"gas":{"amount":"1000","amountUsd":"0.5"},"relayer":{"amount":"10","amountUsd":"0.01","currency":{"symbol":"USDC","decimals":6}},"app":{"amount":"0"}},
 "details":{"currencyIn":{"amountUsd":"5"},"currencyOut":{"amount":"2000000000000000","minimumAmount":"1980000000000000","amountUsd":"4.9"},"totalImpact":{"percent":"-0.4"},"timeEstimate":12}}`

func TestRelay(t *testing.T) {
	f := newFake(t)
	var body map[string]any
	f.handler["/relay/quote/v2"] = func(w http.ResponseWriter, _ *http.Request, b []byte) {
		json.Unmarshal(b, &body)
		io.WriteString(w, relayQuoteJSON)
	}
	s := svc(f, Keys{Relay: "rk"})
	r := req(usdC(), Asset{AssetID: "c8453", DomainID: "base", Address: "native", Symbol: "ETH", Name: "Ether", Decimals: 18}, "5000000")
	r.Providers = []string{Relay}
	res, err := s.Quotes(context.Background(), r)
	if err != nil {
		t.Fatal(err)
	}
	st := res.Routes[0].Steps[0]
	if st.Approval == nil || st.Approval.Spender != "0x4444444444444444444444444444444444444444" || st.To.MinAmount != "1980000000000000" || st.Type != "swapAndBridge" {
		t.Fatalf("relay step %+v", st)
	}
	if len(st.ProviderFees) != 1 || st.NetworkFee == nil || *st.PriceImpact != -0.4 || body["slippageTolerance"] != "100" || body["recipient"] != me {
		t.Fatalf("relay mapping %+v %+v body=%v", st.ProviderFees, st.NetworkFee, body)
	}
	if h := f.headers.Load().(http.Header); h.Get("x-api-key") != "rk" {
		t.Fatal("relay key")
	}
	// transaction = a fresh quote, raw
	raw, err := s.Transaction(context.Background(), TxRequest{Source: Relay, Request: &r})
	if err != nil || !strings.Contains(string(raw), `"requestId":"0xabc"`) {
		t.Fatalf("relay tx %v %s", err, raw)
	}
	if relaySupports(&QuoteRequest{From: sol(), To: eth()}) {
		t.Fatal("solana-source relay must be off")
	}
}

func TestTHORChainFallbackUnitsAndStatus(t *testing.T) {
	f := newFake(t)
	f.handler["/thor1/"] = func(w http.ResponseWriter, _ *http.Request, _ []byte) { w.WriteHeader(502) }
	var q string
	f.handler["/thor2/thorchain/quote/swap"] = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		q = r.URL.RawQuery
		io.WriteString(w, `{"inbound_address":"bc1qvault","memo":"=:ETH.ETH:`+me+`:0/1/0","expected_amount_out":"150000","recommended_min_amount_in":"10000","expiry":1800000030,"fees":{"total":"1000","slippage_bps":25},"total_swap_seconds":620}`)
	}
	s := svc(f, Keys{})
	res, err := s.Quotes(context.Background(), req(btc(), eth(), "1000000"))
	if err != nil {
		t.Fatal(err)
	}
	st := res.Routes[0].Steps[0]
	if st.To.Amount != "1500000000000000" || st.To.MinAmount != "1485000000000000" || st.Approval != nil || *st.PriceImpact != -0.25 {
		t.Fatalf("thor step %+v", st)
	}
	if res.Routes[0].ExpiresAt != 1800000030000 || !strings.Contains(q, "amount=1000000") || !strings.Contains(q, "liquidity_tolerance_bps=100") {
		t.Fatalf("expiry/query %d %s", res.Routes[0].ExpiresAt, q)
	}
	// below THORChain's minimum: amount_too_low with the minimum in the asset's own units
	_, err = s.Quotes(context.Background(), req(btc(), eth(), "5000"))
	if e := asErr(err); e.Code != "amount_too_low" || e.MinAmount != "10000" {
		t.Fatalf("min amount %+v", e)
	}
	f.handler["/thor2/thorchain/tx/status/"] = jsonOK(`{"out_txs":[{"memo":"REFUND:ABC"}],"stages":{}}`)
	sr, err := s.Status(context.Background(), StatusRequest{Source: THORChain, TxHash: "0x" + strings.Repeat("ab", 32)})
	if err != nil || sr.Status != "refunded" {
		t.Fatalf("status %v %+v", err, sr)
	}
	if _, err := s.Status(context.Background(), StatusRequest{Source: THORChain, TxHash: "../../etc"}); asErr(err).Code != "bad_request" {
		t.Fatal("hash not validated")
	}
}

func TestJupiter(t *testing.T) {
	f := newFake(t)
	f.handler["/jup/quote"] = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		if r.URL.Query().Get("inputMint") != wsolMint {
			w.WriteHeader(400)
			return
		}
		io.WriteString(w, `{"inputMint":"`+wsolMint+`","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","inAmount":"1000000","outAmount":"150000","otherAmountThreshold":"148500","priceImpactPct":"0.001"}`)
	}
	f.handler["/jup/swap"] = func(w http.ResponseWriter, _ *http.Request, b []byte) {
		if !strings.Contains(string(b), `"userPublicKey":"`+solMe+`"`) || !strings.Contains(string(b), `"priorityLevel":"high"`) {
			w.WriteHeader(400)
			return
		}
		io.WriteString(w, `{"swapTransaction":"AQID"}`)
	}
	s := svc(f, Keys{Jupiter: "jk"})
	if !s.Enabled(Jupiter) || svc(f, Keys{}).Enabled(Jupiter) {
		t.Fatal("jupiter needs its key")
	}
	r := req(sol(), solUSDC(), "1000000")
	r.SolanaTurbo = true
	res, err := s.Quotes(context.Background(), r)
	if err != nil {
		t.Fatal(err)
	}
	st := res.Routes[0].Steps[0]
	if st.To.MinAmount != "148500" || *st.PriceImpact != -0.1 || st.NetworkFee.Amount != "1005000" {
		t.Fatalf("jup %+v", st)
	}
	var raw struct {
		Quote    json.RawMessage `json:"quote"`
		Priority string          `json:"priority"`
	}
	json.Unmarshal(st.Raw, &raw)
	tx, err := s.Transaction(context.Background(), TxRequest{Source: Jupiter, Quote: raw.Quote, Priority: raw.Priority, User: solMe})
	if err != nil || string(tx) != `{"swapTransaction":"AQID"}` {
		t.Fatalf("swap tx %v %s", err, tx)
	}
	// a quote for other mints than requested is refused
	f.handler["/jup/quote"] = jsonOK(`{"inputMint":"` + wsolMint + `","outputMint":"So1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","inAmount":"1000000","outAmount":"999999999"}`)
	if _, err := s.Quotes(context.Background(), r); asErr(err).Code != "no_liquidity" {
		t.Fatalf("mint mismatch accepted: %v", err)
	}
}

func TestUniswapPrepare(t *testing.T) {
	f := newFake(t)
	var calls []string
	var swapBody map[string]any
	f.handler["/uni/quote"] = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		calls = append(calls, "quote")
		if r.Header.Get("x-permit2-disabled") != "true" || r.Header.Get("x-api-key") != "uk" {
			w.WriteHeader(401)
			return
		}
		io.WriteString(w, `{"routing":"CLASSIC","quote":{"output":{"amount":"100","minimumAmount":"99"}},"isTokenApprovalApplicable":true}`)
	}
	f.handler["/uni/check_approval"] = func(w http.ResponseWriter, _ *http.Request, _ []byte) {
		calls = append(calls, "approval")
		io.WriteString(w, `{"approval":{"to":"`+usdc+`","data":"0x095ea7b3"},"cancel":null}`)
	}
	f.handler["/uni/swap"] = func(w http.ResponseWriter, _ *http.Request, b []byte) {
		calls = append(calls, "swap")
		json.Unmarshal(b, &swapBody)
		io.WriteString(w, `{"swap":{"to":"0x0000000085E102724e78eCd2F45DC9cA239Affad","data":"0x12345678","value":"0","chainId":11155111}}`)
	}
	s := svc(f, Keys{Uniswap: "uk"})
	ur := UniswapRequest{ChainID: 11155111, TokenIn: usdc, TokenOut: evmNative, Amount: "1000", Swapper: me, SlippageBps: 50, Deadline: 1_800_000_600}
	p, err := s.UniswapPrepare(context.Background(), ur)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(calls, ",") != "quote,approval,swap" || p.Approval == nil || p.Cancel != nil || p.Swap == nil || swapBody["deadline"].(float64) != 1_800_000_600 {
		t.Fatalf("flow %v %+v", calls, p)
	}
	// native input: no approval call
	calls = nil
	ur.TokenIn, ur.TokenOut = evmNative, usdc
	if _, err := s.UniswapPrepare(context.Background(), ur); err != nil || strings.Join(calls, ",") != "quote,swap" {
		t.Fatalf("native flow %v %v", err, calls)
	}
	// mainnet is not enabled for Uniswap; UniswapX routing refused; deadline bounded
	bad := ur
	bad.ChainID = 1
	if _, err := s.UniswapPrepare(context.Background(), bad); asErr(err).Code != "unsupported_domain" {
		t.Fatal("chain allowlist")
	}
	bad = ur
	bad.Deadline = 1_800_000_000 + 7200
	if _, err := s.UniswapPrepare(context.Background(), bad); asErr(err).Code != "bad_request" {
		t.Fatal("deadline bound")
	}
	f.handler["/uni/quote"] = jsonOK(`{"routing":"DUTCH_V2","quote":{}}`)
	if _, err := s.UniswapPrepare(context.Background(), ur); asErr(err).Code != "unsupported_pair" {
		t.Fatal("UniswapX accepted")
	}
}

func TestLiFiTokenAndStatus(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/token"] = jsonOK(`{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"symbol":"USDC","decimals":6,"name":"USD Coin\u0000<b>","priceUSD":"1.0001"}`)
	f.handler["/lifi/status"] = jsonOK(`{"status":"DONE","substatus":"COMPLETED","receiving":{"txHash":"0x` + strings.Repeat("cd", 32) + `"}}`)
	s := svc(f, Keys{})
	tok, err := s.Token(context.Background(), "ethereum", "USDC")
	if err != nil || tok.Decimals != 6 || *tok.PriceUSD != 1.0001 {
		t.Fatalf("token %v %+v", err, tok)
	}
	if _, err := s.Token(context.Background(), "ethereum", "a b/../"); asErr(err).Code != "bad_request" {
		t.Fatal("query not validated")
	}
	st, err := s.Status(context.Background(), StatusRequest{Source: LiFi, TxHash: "0x" + strings.Repeat("ab", 32), FromDomainID: "ethereum", ToDomainID: "base"})
	if err != nil || st.Status != "success" || st.Detail != "COMPLETED" {
		t.Fatalf("status %v %+v", err, st)
	}
}

func TestCleanText(t *testing.T) {
	if got := cleanText("a\x00<b>  c", 100); got != "a b c" {
		t.Fatalf("%q", got)
	}
	if got := cleanText(strings.Repeat("é", 10), 3); got != "ééé" {
		t.Fatalf("%q", got)
	}
}
