package coingecko

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"harbour/backend/contracttest"
	"harbour/backend/internal/core/price"
)

const usdc = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
const pepe = "0x1111111111111111111111111111111111111111" // DEX-only

func fake(t *testing.T, sawKey *string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*sawKey = r.Header.Get("x-cg-demo-api-key")
		switch {
		case r.URL.Path == "/simple/price":
			io.WriteString(w, `{"ethereum":{"usd":3150.5,"usd_24h_vol":12000000000}}`)
		case r.URL.Path == "/simple/token_price/base":
			if !strings.Contains(r.URL.Query().Get("contract_addresses"), usdc) {
				t.Errorf("token query %s", r.URL.RawQuery)
			}
			io.WriteString(w, `{"`+usdc+`":{"usd":0.9998,"usd_24h_vol":450000000}}`)
		case strings.HasPrefix(r.URL.Path, "/onchain/simple/networks/base/token_price/"):
			if strings.Contains(r.URL.Path, usdc) {
				t.Errorf("listed token asked onchain too")
			}
			io.WriteString(w, `{"data":{"id":"x","type":"simple_token_price","attributes":{"token_prices":{"`+pepe+`":"0.0000123"},"total_reserve_in_usd":{"`+pepe+`":"2500.5"}}}}`)
		default:
			w.WriteHeader(404)
		}
	}))
}

func TestQuotes(t *testing.T) {
	var key string
	srv := fake(t, &key)
	defer srv.Close()
	s, err := New(price.SourceConfig{Options: map[string]string{"base_url": srv.URL},
		Chains: map[string]map[string]string{"base": {"platform": "base", "onchain_network": "base"}},
		Getenv: func(k string) string { return map[string]string{"COINGECKO_API_KEY": "CG-demo"}[k] }})
	if err != nil {
		t.Fatal(err)
	}
	keys := []price.AssetKey{{Chain: "base", AssetRef: "native", ExternalID: "ethereum"}, {Chain: "base", AssetRef: usdc}, {Chain: "base", AssetRef: pepe},
		{Chain: "sepolia", AssetRef: "0x2222222222222222222222222222222222222222"}}
	contracttest.RunPriceSource(t, s, keys)
	qs, err := s.Quotes(context.Background(), keys)
	if err != nil || len(qs) != 3 || key != "CG-demo" {
		t.Fatalf("quotes %+v %v key=%q", qs, err, key)
	}
	got := map[string]price.Quote{}
	for _, q := range qs {
		got[q.Asset.AssetRef] = q
	}
	if got["native"].PriceUSD != 3150.5 || got[usdc].LiquidityUSD != 450000000 || got[pepe].LiquidityUSD != 2500.5 {
		t.Fatalf("values %+v", got)
	}
}
