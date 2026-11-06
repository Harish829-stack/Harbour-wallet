package contracttest

import (
	"context"
	"errors"
	"math/big"
	"regexp"
	"testing"

	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/core/meta"
	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/core/price"
	"harbour/backend/internal/core/risk"
)

var (
	digits   = regexp.MustCompile(`^[0-9]+$`)
	eventRef = regexp.MustCompile(`^[a-z]+:[0-9.]+$`)
	kinds    = map[index.Kind]bool{index.KindNative: true, index.KindInternal: true, index.KindToken: true, index.KindNFT: true, index.KindMulti: true}
)

// SourceFixture names an address whose recorded history the adapter replays.
type SourceFixture struct {
	Chain, Family, Address string
	SinceBlock             uint64
}

// RunSource is the index.Source contract: every event is a valid,
// provider-free ActivityEvent; backfill pages terminate; Since respects the block.
func RunSource(t *testing.T, s index.Source, fx SourceFixture) {
	ctx := context.Background()
	if s.Name() == "" {
		t.Fatal("empty name")
	}
	check := func(t *testing.T, ev index.ActivityEvent) {
		t.Helper()
		if ev.Chain != fx.Chain || ev.Family != fx.Family {
			t.Fatalf("chain/family %q/%q", ev.Chain, ev.Family)
		}
		// BlockHash may be empty for history: the indexer only needs hashes
		// for blocks newer than the finalized block (reorg repair).
		if ev.TxHash == "" || ev.BlockNumber == 0 || ev.BlockTime.IsZero() {
			t.Fatalf("missing position fields: %+v", ev)
		}
		if !eventRef.MatchString(ev.EventRef) {
			t.Fatalf("event_ref %q not opaque position like log:12", ev.EventRef)
		}
		if !digits.MatchString(ev.AmountRaw) || !kinds[ev.Kind] || ev.Asset == "" {
			t.Fatalf("bad amount/kind/asset: %+v", ev)
		}
	}
	seen := map[string]bool{}
	cursor := ""
	var lastBlock uint64
	for page := 0; ; page++ {
		if page > 1000 {
			t.Fatal("backfill does not terminate")
		}
		p, err := s.Backfill(ctx, fx.Chain, fx.Address, cursor, index.BackfillLimits{MaxTransfers: 5000})
		if err != nil {
			t.Fatal(err)
		}
		for _, ev := range p.Events {
			check(t, ev)
			k := ev.TxHash + "|" + ev.EventRef
			if seen[k] {
				t.Fatalf("duplicate event %s", k)
			}
			seen[k] = true
			if ev.BlockNumber > p.LastBlock && p.LastBlock != 0 {
				t.Fatalf("LastBlock %d below event block %d", p.LastBlock, ev.BlockNumber)
			}
		}
		if p.LastBlock > lastBlock {
			lastBlock = p.LastBlock
		}
		if p.Cursor == "" {
			break
		}
		cursor = p.Cursor
	}
	if len(seen) == 0 {
		t.Fatal("fixture produced no events")
	}
	p, err := s.Since(ctx, fx.Chain, fx.Address, fx.SinceBlock, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, ev := range p.Events {
		check(t, ev)
		if ev.BlockNumber <= fx.SinceBlock {
			t.Fatalf("Since(%d) returned block %d", fx.SinceBlock, ev.BlockNumber)
		}
	}
}

// ClientFixture names an address with a known balance set.
type ClientFixture struct {
	Address   string
	AssetRefs []string
}

// RunChainClient is the chain.Client contract.
func RunChainClient(t *testing.T, c chain.Client, fx ClientFixture) {
	ctx := context.Background()
	bals, block, err := c.Balances(ctx, fx.Address, fx.AssetRefs, 0)
	if err != nil {
		t.Fatal(err)
	}
	if block == 0 {
		t.Fatal("Balances must report the block it read at")
	}
	if len(bals) != len(fx.AssetRefs)+1 || bals[0].AssetRef != "native" {
		t.Fatalf("want native first plus %d assets, got %+v", len(fx.AssetRefs), bals)
	}
	for _, b := range bals {
		if b.Failed {
			continue
		}
		if b.AmountRaw == nil || b.AmountRaw.Sign() < 0 {
			t.Fatalf("bad amount %+v", b)
		}
	}
	// Pinned block is honoured.
	_, b2, err := c.Balances(ctx, fx.Address, fx.AssetRefs, block)
	if err != nil || b2 != block {
		t.Fatalf("pinned read at %d returned %d (%v)", block, b2, err)
	}
	if head, err := c.LatestBlock(ctx); err != nil || head < block {
		t.Fatalf("LatestBlock %d < balance block %d (%v)", head, block, err)
	}
	if len(fx.AssetRefs) > 0 {
		ti, err := c.TokenInfo(ctx, fx.AssetRefs)
		if err != nil || len(ti) != len(fx.AssetRefs) {
			t.Fatalf("TokenInfo: %+v %v", ti, err)
		}
		for _, x := range ti {
			if !x.Failed && (x.Decimals < -1 || x.Decimals > 77) {
				t.Fatalf("bad decimals %+v", x)
			}
		}
	}
	if _, err := c.Nonce(ctx, fx.Address); err != nil {
		t.Fatal(err)
	}
	f, err := c.Fees(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if f.MaxFee == nil && f.GasPrice == nil {
		t.Fatal("fees carry neither MaxFee nor GasPrice")
	}
}

// RunPriceSource is the price.Source contract.
func RunPriceSource(t *testing.T, s price.Source, known []price.AssetKey) {
	ctx := context.Background()
	qs, err := s.Quotes(ctx, nil)
	if err != nil || len(qs) != 0 {
		t.Fatalf("empty input: %v %v", qs, err)
	}
	qs, err = s.Quotes(ctx, known)
	if err != nil {
		t.Fatal(err)
	}
	if len(qs) == 0 {
		t.Fatal("no quotes for fixture assets")
	}
	want := map[price.AssetKey]bool{}
	for _, k := range known {
		want[k] = true
	}
	for _, q := range qs {
		if !want[q.Asset] {
			t.Fatalf("quote for unrequested asset %+v", q.Asset)
		}
		if q.PriceUSD <= 0 || q.At.IsZero() || q.LiquidityUSD < 0 {
			t.Fatalf("bad quote %+v", q)
		}
	}
}

// RunSimulator is the risk.Simulator contract: a reverting tx is reported,
// not returned as an error.
func RunSimulator(t *testing.T, s risk.Simulator, chainName string, ok, reverting map[string]any) {
	ctx := context.Background()
	r, err := s.Simulate(ctx, chainName, ok)
	if err != nil || r.Reverted {
		t.Fatalf("ok tx: %+v %v", r, err)
	}
	for _, c := range r.Changes {
		if !digits.MatchString(c.AmountRaw) {
			t.Fatalf("bad change %+v", c)
		}
	}
	r, err = s.Simulate(ctx, chainName, reverting)
	if err != nil || !r.Reverted {
		t.Fatalf("reverting tx: %+v %v", r, err)
	}
}

// RunMetaSource is the meta.Source contract.
func RunMetaSource(t *testing.T, s meta.Source, chainName, token, nftContract, nftID string) {
	ctx := context.Background()
	tk, err := s.Token(ctx, chainName, token)
	if err != nil {
		t.Fatal(err)
	}
	if tk.Chain != chainName || tk.AssetRef != token || tk.Decimals < 0 || tk.Decimals > 77 || tk.Symbol == "" {
		t.Fatalf("bad token %+v", tk)
	}
	n, err := s.NFT(ctx, chainName, nftContract, nftID)
	if err != nil {
		t.Fatal(err)
	}
	if n.Contract != nftContract || n.TokenID != nftID {
		t.Fatalf("bad nft %+v", n)
	}
}

// RunNotifyChannel is the notify.Channel contract: a dead target is ErrGone.
func RunNotifyChannel(t *testing.T, c notify.Channel, live, gone notify.Target) {
	ctx := context.Background()
	m := notify.Message{Title: "Received 0.1 ETH", Body: "On Base", DedupKey: "0xabc"}
	if err := c.Send(ctx, live, m); err != nil {
		t.Fatal(err)
	}
	var g notify.ErrGone
	if err := c.Send(ctx, gone, m); !errors.As(err, &g) {
		t.Fatalf("gone target: want ErrGone, got %v", err)
	}
}

// Big is a helper for fakes.
func Big(s string) *big.Int { b, _ := new(big.Int).SetString(s, 10); return b }
