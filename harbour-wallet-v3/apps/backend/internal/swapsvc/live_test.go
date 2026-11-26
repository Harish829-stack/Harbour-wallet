//go:build live

// Live smoke test against the real provider APIs (needs network and the provider keys in the environment):
//
//	set -a; . ./.env; set +a; go test -tags live -count=1 -v ./internal/swapsvc ./internal/earnsvc
//
// It only requests quotes and unsigned transactions; nothing is signed or sent. With HB_LIVE_OUT set, every provider answer is
// written there as JSON so the extension's pre-sign checks can be run on real data (apps/extension/scripts/live-swap-check.mjs).
package swapsvc

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

const (
	liveEVM = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" // a public, well-funded address (quotes only)
	liveSOL = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"
	liveBTC = "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h"
)

func liveSvc(t *testing.T) *Service {
	t.Helper()
	return New(Config{
		Keys:  Keys{LiFi: os.Getenv("LIFI_API_KEY"), Jupiter: os.Getenv("JUP_API_KEY"), Relay: os.Getenv("RELAY_API_KEY"), Uniswap: os.Getenv("UNISWAP_API_KEY")},
		Hosts: DefaultHosts(), ProviderTimeout: 20 * time.Second, Log: slog.New(slog.NewTextHandler(os.Stdout, nil)),
	})
}

func dump(t *testing.T, name string, v any) {
	dir := os.Getenv("HB_LIVE_OUT")
	if dir == "" {
		return
	}
	b, _ := json.MarshalIndent(v, "", " ")
	if err := os.WriteFile(filepath.Join(dir, name+".json"), b, 0o644); err != nil {
		t.Logf("dump %s: %v", name, err)
	}
}

func a(domain, addr, sym string, dec int) Asset {
	id := domain + ":" + addr
	return Asset{AssetID: id, DomainID: domain, Address: addr, Symbol: sym, Name: sym, Decimals: dec}
}

type liveCase struct {
	name             string
	from, to         Asset
	amount           string
	fromAddr, toAddr string
	providers        []string
}

func TestLiveQuotesAndTransactions(t *testing.T) {
	s := liveSvc(t)
	for p, on := range s.ProviderStates() {
		t.Logf("provider %-9s enabled=%v", p, on)
	}
	cases := []liveCase{
		{"lifi_eth_usdc_ethereum", a("ethereum", "native", "ETH", 18), a("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC", 6), "10000000000000000", liveEVM, liveEVM, []string{LiFi}},
		{"lifi_usdc_eth_base", a("base", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6), a("base", "native", "ETH", 18), "20000000", liveEVM, liveEVM, []string{LiFi}},
		{"lifi_bridge_arb_base", a("arbitrum", "native", "ETH", 18), a("base", "native", "ETH", 18), "10000000000000000", liveEVM, liveEVM, []string{LiFi}},
		{"relay_usdc_eth_to_base", a("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC", 6), a("base", "native", "ETH", 18), "50000000", liveEVM, liveEVM, []string{Relay}},
		{"relay_eth_base_to_sol", a("base", "native", "ETH", 18), a("solana", "native", "SOL", 9), "10000000000000000", liveEVM, liveSOL, []string{Relay}},
		{"jupiter_sol_usdc", a("solana", "native", "SOL", 9), a("solana", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6), "100000000", liveSOL, liveSOL, []string{Jupiter}},
		{"thor_btc_eth", a("bitcoin", "native", "BTC", 8), a("ethereum", "native", "ETH", 18), "1000000", liveBTC, liveEVM, []string{THORChain}},
		{"thor_btc_bnb", a("bitcoin", "native", "BTC", 8), a("smartchain", "native", "BNB", 18), "1000000", liveBTC, liveEVM, []string{THORChain}},
		{"thor_btc_base", a("bitcoin", "native", "BTC", 8), a("base", "native", "ETH", 18), "1000000", liveBTC, liveEVM, []string{THORChain}},
		{"thor_bnb_btc", a("smartchain", "native", "BNB", 18), a("bitcoin", "native", "BTC", 8), "100000000000000000", liveEVM, liveBTC, []string{THORChain}},
		{"thor_eth_btc", a("ethereum", "native", "ETH", 18), a("bitcoin", "native", "BTC", 8), "50000000000000000", liveEVM, liveBTC, []string{THORChain}},
		{"all_eth_usdc_ethereum", a("ethereum", "native", "ETH", 18), a("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC", 6), "10000000000000000", liveEVM, liveEVM, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := QuoteRequest{From: c.from, To: c.to, FromAddress: c.fromAddr, ToAddress: c.toAddr, Amount: c.amount, Slippage: "1", SortBy: "quantity", Providers: c.providers}
			ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
			defer cancel()
			res, err := s.Quotes(ctx, req)
			if err != nil {
				t.Fatalf("quotes: %v", err)
			}
			dump(t, c.name+".quotes", map[string]any{"request": req, "result": res})
			t.Logf("%d route(s); provider errors %v", len(res.Routes), res.ProviderErrors)
			for _, r := range res.Routes {
				st := r.Steps[0]
				t.Logf("  %-9s %-14s out=%s min=%s approval=%v", r.Source, st.Provider.Name, st.To.Amount, st.To.MinAmount, st.Approval != nil)
			}
			if c.providers == nil {
				return
			}
			r := res.Routes[0]
			st := r.Steps[0]
			var tx TxRequest
			switch r.Source {
			case LiFi:
				tx = TxRequest{Source: LiFi, Step: st.Raw}
			case Relay, THORChain:
				tx = TxRequest{Source: r.Source, Request: &req}
			case Jupiter:
				var raw struct {
					Quote    json.RawMessage `json:"quote"`
					Priority string          `json:"priority"`
				}
				json.Unmarshal(st.Raw, &raw)
				tx = TxRequest{Source: Jupiter, Quote: raw.Quote, Priority: raw.Priority, User: c.fromAddr}
			}
			out, err := s.Transaction(ctx, tx)
			if err != nil {
				t.Fatalf("transaction: %v", err)
			}
			dump(t, c.name+".transaction", map[string]any{"route": r, "fresh": json.RawMessage(out)})
			t.Logf("fresh transaction: %d bytes", len(out))
		})
	}
}

// Relay's own contract list (the extension fetches it directly from api.relay.link to vet Relay transactions).
func TestLiveRelayChains(t *testing.T) {
	s := liveSvc(t)
	var raw json.RawMessage
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := s.do(ctx, "GET", "https://api.relay.link/chains", nil, nil, &raw); err != nil {
		t.Fatalf("relay chains: %v", err)
	}
	dump(t, "relay_chains", raw)
	t.Logf("relay chains: %d bytes", len(raw))
}

func TestLiveUniswapSepolia(t *testing.T) {
	s := liveSvc(t)
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()
	for _, in := range []string{evmNative, "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"} { // ETH, Sepolia USDC (Circle)
		out := "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
		amount := "1000000000000000"
		if in != evmNative {
			out, amount = evmNative, "1000000"
		}
		r := UniswapRequest{ChainID: 11155111, TokenIn: in, TokenOut: out, Amount: amount, Swapper: liveEVM, SlippageBps: 50, Deadline: time.Now().Add(10 * time.Minute).Unix()}
		p, err := s.UniswapPrepare(ctx, r)
		if err != nil {
			t.Logf("uniswap %s -> %s: %v (testnet liquidity varies)", in, out, err)
			continue
		}
		dump(t, "uniswap_sepolia_"+strconv.FormatBool(in == evmNative), map[string]any{"request": r, "prepared": p})
		t.Logf("uniswap %s -> %s: routing=%s approval=%v swap=%d bytes", in, out, p.Routing, p.Approval != nil, len(p.Swap))
	}
}
