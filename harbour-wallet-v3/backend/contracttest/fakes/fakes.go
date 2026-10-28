// Package fakes holds in-memory implementations used to keep the contract
// suites themselves tested until real adapters land (phases 3-6).
package fakes

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/core/meta"
	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/core/price"
	"harbour/backend/internal/core/risk"
)

// Source serves a fixed history of 25 events in pages of 10.
type Source struct{ Chain string }

func (Source) Name() string                                                     { return "fake" }
func (Source) Subscribe(context.Context, string, []string, index.Handler) error { return nil }

func (s Source) events() []index.ActivityEvent {
	var out []index.ActivityEvent
	for i := 25; i >= 1; i-- {
		out = append(out, index.ActivityEvent{Chain: s.Chain, Family: "evm", TxHash: fmt.Sprintf("0x%064x", i),
			EventRef: fmt.Sprintf("log:%d", i%3), BlockNumber: uint64(100 + i), BlockHash: fmt.Sprintf("0x%064x", 1000+i),
			BlockTime: time.Unix(1_700_000_000+int64(i)*12, 0), From: "0xa", To: "0xb", Asset: "native",
			AmountRaw: "1000000000000000000", Kind: index.KindNative})
	}
	return out
}

func (s Source) Backfill(_ context.Context, _, _, cursor string, _ index.BackfillLimits) (index.Page, error) {
	evs := s.events()
	start := 0
	fmt.Sscan(cursor, &start)
	end := start + 10
	next := fmt.Sprint(end)
	if end >= len(evs) {
		end, next = len(evs), ""
	}
	return index.Page{Events: evs[start:end], Cursor: next, LastBlock: evs[start].BlockNumber}, nil
}

func (s Source) Since(_ context.Context, _, _ string, from uint64, _ string) (index.Page, error) {
	var out []index.ActivityEvent
	for _, e := range s.events() {
		if e.BlockNumber > from {
			out = append(out, e)
		}
	}
	return index.Page{Events: out}, nil
}

// Client is a fake chain client.
type Client struct{}

func (Client) Family() chain.Family { return chain.FamilyEVM }
func (Client) Chain() string        { return "base" }
func (Client) Balances(_ context.Context, _ string, refs []string, block uint64) ([]chain.Balance, uint64, error) {
	if block == 0 {
		block = 500
	}
	out := []chain.Balance{{AssetRef: "native", AmountRaw: big.NewInt(42)}}
	for _, r := range refs {
		out = append(out, chain.Balance{AssetRef: r, AmountRaw: big.NewInt(7)})
	}
	return out, block, nil
}
func (Client) Fees(context.Context) (chain.Fees, error) {
	return chain.Fees{MaxFee: big.NewInt(2e9), MaxPriorityFee: big.NewInt(1e8)}, nil
}
func (Client) LatestBlock(context.Context) (uint64, error) { return 600, nil }
func (Client) TokenInfo(_ context.Context, refs []string) ([]chain.TokenInfo, error) {
	out := []chain.TokenInfo{}
	for _, r := range refs {
		out = append(out, chain.TokenInfo{AssetRef: r, Symbol: "TKN", Name: "Token", Decimals: 18})
	}
	return out, nil
}
func (Client) Nonce(context.Context, string) (uint64, error)     { return 3, nil }
func (Client) Broadcast(context.Context, []byte) (string, error) { return "0x1", nil }
func (Client) Simulate(context.Context, map[string]any) (chain.SimulationResult, error) {
	return chain.SimulationResult{Success: true}, nil
}

// Prices is a fake price source.
type Prices struct{}

func (Prices) Name() string { return "fake" }
func (Prices) Quotes(_ context.Context, keys []price.AssetKey) ([]price.Quote, error) {
	out := []price.Quote{}
	for _, k := range keys {
		out = append(out, price.Quote{Asset: k, PriceUSD: 3000, LiquidityUSD: 1e9, At: time.Now()})
	}
	return out, nil
}

// Simulator reverts when tx["data"] == "0xdead".
type Simulator struct{}

func (Simulator) Name() string { return "fake" }
func (Simulator) Simulate(_ context.Context, _ string, tx map[string]any) (risk.Result, error) {
	if tx["data"] == "0xdead" {
		return risk.Result{Reverted: true, Error: "execution reverted"}, nil
	}
	return risk.Result{Changes: []risk.AssetChange{{AssetRef: "native", AmountRaw: "100", Kind: "native"}}}, nil
}

// Meta is a fake metadata source.
type Meta struct{}

func (Meta) Name() string { return "fake" }
func (Meta) Token(_ context.Context, c, ref string) (meta.Token, error) {
	return meta.Token{Chain: c, AssetRef: ref, Symbol: "USDC", Decimals: 6}, nil
}
func (Meta) NFT(_ context.Context, c, contract, id string) (meta.NFT, error) {
	return meta.NFT{Chain: c, Contract: contract, TokenID: id}, nil
}

// Notifier treats token "gone" as unsubscribed.
type Notifier struct{}

func (Notifier) Name() string { return "fake" }
func (Notifier) Send(_ context.Context, t notify.Target, _ notify.Message) error {
	if t.Token == "gone" {
		return notify.ErrGone{Reason: "410"}
	}
	return nil
}
