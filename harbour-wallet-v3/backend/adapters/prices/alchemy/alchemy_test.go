package alchemy

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"harbour/backend/contracttest"
	"harbour/backend/internal/core/price"
)

func TestQuotes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer k" {
			w.WriteHeader(401)
			return
		}
		switch r.URL.Path {
		case "/tokens/by-symbol":
			io.WriteString(w, `{"data":[{"symbol":"ETH","prices":[{"currency":"usd","value":"3150.12","lastUpdatedAt":"2026-10-28T00:00:00Z"}],"error":null}]}`)
		case "/tokens/by-address":
			var req struct {
				Addresses []struct{ Network, Address string }
			}
			json.NewDecoder(r.Body).Decode(&req)
			if len(req.Addresses) != 1 || req.Addresses[0].Network != "base-mainnet" {
				t.Errorf("body %+v", req)
			}
			io.WriteString(w, `{"data":[{"network":"base-mainnet","address":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","prices":[{"currency":"usd","value":"0.9999"}],"error":null}]}`)
		}
	}))
	defer srv.Close()
	s, err := New(price.SourceConfig{Options: map[string]string{"base_url": srv.URL},
		Chains: map[string]map[string]string{"base": {"network": "base-mainnet"}},
		Getenv: func(string) string { return "k" }})
	if err != nil {
		t.Fatal(err)
	}
	contracttest.RunPriceSource(t, s, []price.AssetKey{{Chain: "base", AssetRef: "native", ExternalID: "ETH"},
		{Chain: "base", AssetRef: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"}})
}
