package swapsvc

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

func guardSvc(f *fake, cache time.Duration) *Service {
	return New(Config{Hosts: Hosts{LiFi: f.srv.URL + "/lifi"}, Disabled: ParseDisabled("thorchain"),
		Now: func() time.Time { return time.Unix(1_800_000_000, 0) }, ProviderTimeout: 2 * time.Second, QuoteCache: cache})
}

// Audit M6: identical quote requests in a burst cost one upstream call.
func TestQuoteCacheAndSingleflight(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, r *http.Request, b []byte) {
		time.Sleep(50 * time.Millisecond)
		jsonOK(lifiRoutesJSON)(w, r, b)
	}
	s := guardSvc(f, 8*time.Second)
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000000000000000")); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if _, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000000000000000")); err != nil {
		t.Fatal(err)
	}
	if f.hits.Load() != 1 {
		t.Fatalf("upstream hits %d, want 1", f.hits.Load())
	}
	s.Quotes(context.Background(), req(eth(), usdC(), "2000000000000000")) // (the fixture answers for another amount: no route)
	if f.hits.Load() != 2 {
		t.Fatalf("a different request is not cached: hits=%d", f.hits.Load())
	}
}

// Audit M6: a provider failing repeatedly is skipped for a while; a 429 is reported as rate_limited.
func TestCircuitBreakerAnd429(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, _ *http.Request, _ []byte) { w.WriteHeader(http.StatusInternalServerError) }
	s := guardSvc(f, -1)
	for i := 0; i < breakerFailures; i++ {
		if _, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000000000000000")); asErr(err).Code != "server" {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	hits := f.hits.Load()
	if _, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000000000000000")); asErr(err).Code != "unavailable" || f.hits.Load() != hits {
		t.Fatalf("breaker open: %v hits %d→%d", err, hits, f.hits.Load())
	}
	f2 := newFake(t)
	f2.handler["/lifi/advanced/routes"] = func(w http.ResponseWriter, _ *http.Request, _ []byte) { w.WriteHeader(http.StatusTooManyRequests) }
	s2 := guardSvc(f2, -1)
	for i := 0; i < breakerFailures+2; i++ { // 429s never open the breaker (one busy device must not switch a provider off for everyone)
		if _, err := s2.Quotes(context.Background(), req(eth(), usdC(), "1000000000000000")); asErr(err).Code != "rate_limited" {
			t.Fatalf("429 #%d: %v", i, err)
		}
	}
	if f2.hits.Load() != breakerFailures+2 {
		t.Fatalf("hits %d", f2.hits.Load())
	}
}

// Audit M6/M2: /transaction builds from the server-held LI.FI step named by the route's ref, never from a client body.
func TestLifiTransactionUsesServerHeldStep(t *testing.T) {
	f := newFake(t)
	f.handler["/lifi/advanced/routes"] = jsonOK(lifiRoutesJSON)
	var got string
	f.handler["/lifi/advanced/stepTransaction"] = func(w http.ResponseWriter, r *http.Request, b []byte) { got = string(b); jsonOK(`{"ok":1}`)(w, r, b) }
	s := guardSvc(f, -1)
	res, err := s.Quotes(context.Background(), req(eth(), usdC(), "1000000000000000"))
	if err != nil || len(res.Routes) == 0 || res.Routes[0].QuoteRef == "" {
		t.Fatalf("quote: %v %+v", err, res)
	}
	if _, err := s.Transaction(context.Background(), TxRequest{Source: LiFi, Ref: res.Routes[0].QuoteRef}); err != nil {
		t.Fatal(err)
	}
	if got == "" || !strings.Contains(got, `"id"`) || got != string(res.Routes[0].Steps[0].Raw) {
		t.Fatalf("stepTransaction body %q, want the quoted step", got)
	}
}
