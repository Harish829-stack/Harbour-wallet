package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func swapTestServer(t *testing.T, h http.HandlerFunc) *Server {
	t.Helper()
	up := httptest.NewServer(h)
	t.Cleanup(up.Close)
	hosts := DefaultGatewayHosts()
	hosts.LiFi, hosts.Relay, hosts.Jupiter, hosts.Uniswap, hosts.Thor = up.URL+"/lifi", up.URL+"/relay", up.URL+"/jup", up.URL+"/uni", up.URL+"/thor"
	return &Server{opt: Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil))}, swap: newSwapService(GatewayKeys{LiFi: "k"}, hosts, time.Now)}
}

func TestSwapHandlersErrorsAndShapes(t *testing.T) {
	s := swapTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		io.WriteString(w, `{"message":"No available quotes for the requested transfer"}`)
	})
	body := `{"from":{"assetId":"c60","domainId":"ethereum","address":"native","symbol":"ETH","name":"Ether","decimals":18},
	 "to":{"assetId":"x","domainId":"ethereum","address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","symbol":"USDC","name":"USD Coin","decimals":6},
	 "fromAddress":"0x1111111111111111111111111111111111111111","toAddress":"0x1111111111111111111111111111111111111111","amount":"1000","slippage":"1","sortBy":"quantity"}`
	rec := httptest.NewRecorder()
	s.handleSwapQuotes(rec, httptest.NewRequest(http.MethodPost, "/v1/swap/quotes", strings.NewReader(body)))
	if rec.Code != http.StatusUnprocessableEntity || !strings.Contains(rec.Body.String(), `"code":"no_liquidity"`) || strings.Contains(rec.Body.String(), "requested transfer") {
		t.Fatalf("quotes: %d %s", rec.Code, rec.Body)
	}
	// unknown fields and malformed bodies are refused
	rec = httptest.NewRecorder()
	s.handleSwapQuotes(rec, httptest.NewRequest(http.MethodPost, "/v1/swap/quotes", strings.NewReader(`{"evil":1}`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown field: %d", rec.Code)
	}
	// disabled / unconfigured provider
	rec = httptest.NewRecorder()
	s.handleSwapTransaction(rec, httptest.NewRequest(http.MethodPost, "/v1/swap/transaction", strings.NewReader(`{"source":"jupiter","quote":{},"priority":"fast","user":"x"}`)))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("jupiter without key: %d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	s.handleSwapProviders(rec, httptest.NewRequest(http.MethodGet, "/v1/swap/providers", nil))
	if !strings.Contains(rec.Body.String(), `"lifi":true`) || !strings.Contains(rec.Body.String(), `"relay":false`) {
		t.Fatalf("providers: %s", rec.Body)
	}
}

func TestEarnHandlersErrors(t *testing.T) {
	s := &Server{opt: Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil))}, earn: newEarnService(time.Now)}
	rec := httptest.NewRecorder()
	s.handleEarnAaveTransaction(rec, httptest.NewRequest(http.MethodPost, "/v1/earn/aave/transaction", strings.NewReader(`{"action":"supply","chainId":1,"market":"0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27","sender":"0x7ece450c274672c8007372F81cfCCC1c412466bb","value":"1"}`)))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), `"code":"unsupported"`) {
		t.Fatalf("mainnet aave: %d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	s.handleEarnAaveMarkets(rec, httptest.NewRequest(http.MethodPost, "/v1/earn/aave/markets", strings.NewReader(`{"chainId":84532,"query":"{ evil }"}`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("client GraphQL must be refused: %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	s.handleEarnProviders(rec, httptest.NewRequest(http.MethodGet, "/v1/earn/providers", nil))
	if !strings.Contains(rec.Body.String(), `"aave":true`) {
		t.Fatalf("providers %s", rec.Body)
	}
}
