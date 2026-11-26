//go:build live

// Live smoke test against AaveKit, Lido and Rocket Pool (see swapsvc/live_test.go). Nothing is signed or sent.
package earnsvc

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLiveEarn(t *testing.T) {
	s := New(Config{})
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	for _, p := range []string{Lido, RocketPool} {
		v, err := s.APR(ctx, p)
		if err != nil {
			t.Fatalf("%s apr: %v", p, err)
		}
		t.Logf("%s APR %.2f%%", p, v)
	}
	m, err := s.AaveMarkets(ctx, 84532)
	if err != nil {
		t.Fatalf("aave markets: %v", err)
	}
	t.Logf("aave markets: %d bytes", len(m))
	save := func(name string, v any) {
		if dir := os.Getenv("HB_LIVE_OUT"); dir != "" {
			b, _ := json.MarshalIndent(v, "", " ")
			os.WriteFile(filepath.Join(dir, name+".json"), b, 0o644)
		}
	}
	save("aave_markets", json.RawMessage(m))
	const owner, pool = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27"
	for _, r := range []AaveTxRequest{
		{Action: "supply", ChainID: 84532, Market: pool, Sender: owner, Value: "0.0001"},
		{Action: "supply", ChainID: 84532, Market: pool, Sender: owner, Token: "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f", Value: "1"},
	} {
		d, err := s.AaveTransaction(ctx, r)
		if err != nil {
			t.Logf("aave %s token=%q: %v", r.Action, r.Token, err)
			continue
		}
		save("aave_"+r.Action+"_"+map[bool]string{true: "native", false: "erc20"}[r.Token == ""], map[string]any{"request": r, "data": json.RawMessage(d)})
		t.Logf("aave %s token=%q: %d bytes", r.Action, r.Token, len(d))
	}
}
