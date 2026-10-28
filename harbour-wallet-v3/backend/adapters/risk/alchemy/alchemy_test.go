package alchemy_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"harbour/backend/adapters/risk/alchemy"
	"harbour/backend/contracttest"
	"harbour/backend/internal/core/risk"
)

// Responses in the shape alchemy_simulateAssetChanges returns.
const okResp = `{"jsonrpc":"2.0","id":1,"result":{"changes":[
 {"assetType":"NATIVE","changeType":"TRANSFER","from":"0xAAAA000000000000000000000000000000000001","to":"0x3535353535353535353535353535353535353535","rawAmount":"1000000000000000","symbol":"ETH","decimals":18},
 {"assetType":"ERC20","changeType":"APPROVE","from":"0xaaaa000000000000000000000000000000000001","to":"0x1111111111111111111111111111111111111111","rawAmount":"115792089237316195423570985008687907853269984665640564039457584007913129639935","contractAddress":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","symbol":"USDC","decimals":6}
],"gasUsed":"0x5208","error":null}}`
const revertResp = `{"jsonrpc":"2.0","id":1,"result":{"changes":[],"gasUsed":"0x0","error":{"message":"execution reverted"}}}`

func TestAlchemySimulator(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/v2/testkey") {
			w.WriteHeader(401)
			return
		}
		b, _ := io.ReadAll(r.Body)
		var req struct {
			Method string           `json:"method"`
			Params []map[string]any `json:"params"`
		}
		json.Unmarshal(b, &req)
		if req.Method != "alchemy_simulateAssetChanges" {
			w.WriteHeader(400)
			return
		}
		if req.Params[0]["data"] == "0xdead" {
			io.WriteString(w, revertResp)
			return
		}
		io.WriteString(w, okResp)
	}))
	defer srv.Close()
	s, err := alchemy.New(risk.SimulatorConfig{Options: map[string]string{"key_env": "K", "base_url": srv.URL + "/{network}"},
		Chains: map[string]map[string]string{"base": {"network": "base-mainnet"}},
		Getenv: func(string) string { return "testkey" }})
	if err != nil {
		t.Fatal(err)
	}
	contracttest.RunSimulator(t, s, "base", map[string]any{"data": "0x"}, map[string]any{"data": "0xdead"})

	r, _ := s.Simulate(context.Background(), "base", map[string]any{"data": "0x"})
	if len(r.Changes) != 2 || r.Changes[0].AssetRef != "native" || r.Changes[0].From != "0xaaaa000000000000000000000000000000000001" ||
		r.Changes[1].Kind != "token" || r.Changes[1].Decimals != 6 || r.GasUsed != 21000 ||
		len(r.Warnings) != 1 || r.Warnings[0] != "unlimited_approval" {
		t.Fatalf("mapped %+v", r)
	}
	if _, err := s.Simulate(context.Background(), "base-sepolia", map[string]any{}); !errors.Is(err, risk.ErrUnsupported) {
		t.Fatalf("unconfigured chain: %v", err)
	}
}
