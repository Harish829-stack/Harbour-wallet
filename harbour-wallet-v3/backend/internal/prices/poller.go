package prices

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/price"
	"harbour/backend/internal/events"
	"harbour/backend/internal/store"
)

// SubjectTick is published after each poll.
const SubjectTick = "price.tick"

// Named is a price source with its providers.yaml name (used to pick the
// native coin id from chains.yaml native.price_ids).
type Named struct {
	Name   string
	Source price.Source
}

// Poller refreshes prices.
type Poller struct {
	St      *store.Store
	Redis   *redis.Client
	Bus     events.Bus
	Sources []Named // priority order
	Chains  map[string]config.Chain
	Cfg     config.Prices
	Log     *slog.Logger
	Now     func() time.Time
}

// TickMessage is the price.tick payload.
type TickMessage struct {
	At     time.Time          `json:"at"`
	Prices map[string]float64 `json:"prices"` // asset id -> usd (ok prices only)
}

// RunOnce prices the most-held TopN assets (top=true) or the rest.
func (p *Poller) RunOnce(ctx context.Context, top bool) (int, error) {
	held, err := p.St.HeldAssets(ctx)
	if err != nil {
		return 0, err
	}
	if top && len(held) > p.Cfg.TopN {
		held = held[:p.Cfg.TopN]
	} else if !top {
		if len(held) <= p.Cfg.TopN {
			return 0, nil
		}
		held = held[p.Cfg.TopN:]
	}
	if len(held) == 0 {
		return 0, nil
	}
	ids := make([]int64, len(held))
	for i, h := range held {
		ids[i] = h.AssetID
	}
	prev, err := Get(ctx, p.Redis, ids)
	if err != nil {
		return 0, err
	}
	now := p.now()
	remaining := map[int64]store.HeldAsset{}
	for _, h := range held {
		remaining[h.AssetID] = h
	}
	results := map[int64]Cached{}
	for _, s := range p.Sources {
		if len(remaining) == 0 {
			break
		}
		var keys []price.AssetKey
		byKey := map[price.AssetKey]int64{}
		for id, h := range remaining {
			k := price.AssetKey{Chain: h.Chain, AssetRef: h.Ref}
			if h.Ref == "native" {
				k.ExternalID = p.Chains[h.Chain].Native.PriceIDs[s.Name]
				if k.ExternalID == "" {
					continue
				}
			}
			keys = append(keys, k)
			byKey[k] = id
		}
		if len(keys) == 0 {
			continue
		}
		qs, err := s.Source.Quotes(ctx, keys)
		if err != nil {
			p.Log.Warn("price source failed; trying the next", "source", s.Name, "err", err)
			continue
		}
		for _, q := range qs {
			id, ok := byKey[q.Asset]
			if !ok || q.PriceUSD <= 0 {
				continue
			}
			h := remaining[id]
			liq := q.LiquidityUSD
			if liq == 0 { // source doesn't know: reuse the last known liquidity (< 1 day old)
				if old, ok := prev[id]; ok && now.Sub(old.At) < 24*time.Hour {
					liq = old.LiquidityUSD
				}
			}
			flag := FlagOK
			switch {
			case liq >= p.Cfg.MinLiquidityUSD:
			case liq == 0 && (h.Kind == "native" || h.Verified):
			default:
				flag = FlagThin
			}
			results[id] = Cached{USD: q.PriceUSD, LiquidityUSD: liq, Source: s.Name, Flag: flag, At: now}
			delete(remaining, id)
		}
	}
	pipe := p.Redis.Pipeline()
	var ticks []store.Tick
	msg := TickMessage{At: now, Prices: map[string]float64{}}
	for id, c := range results {
		b, _ := json.Marshal(c)
		pipe.Set(ctx, Key(id), b, p.Cfg.CacheTTL)
		ticks = append(ticks, store.Tick{AssetID: id, At: now, PriceUSD: c.USD, LiquidityUSD: c.LiquidityUSD})
		if c.Flag == FlagOK {
			msg.Prices[jsonID(id)] = c.USD
		}
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	if err := p.St.InsertTicks(ctx, ticks); err != nil {
		return 0, err
	}
	if len(msg.Prices) > 0 && p.Bus != nil {
		b, _ := json.Marshal(msg)
		if err := p.Bus.Publish(ctx, SubjectTick, b); err != nil {
			p.Log.Warn("publish price.tick failed", "err", err)
		}
	}
	if len(remaining) > 0 {
		p.Log.Debug("assets without a price", "count", len(remaining))
	}
	return len(results), nil
}

func jsonID(id int64) string {
	b, _ := json.Marshal(id)
	return string(b)
}

func (p *Poller) now() time.Time {
	if p.Now != nil {
		return p.Now()
	}
	return time.Now()
}

// Run polls on the configured cadences and snapshots balances hourly.
func (p *Poller) Run(ctx context.Context) {
	run := func(top bool) {
		n, err := p.RunOnce(ctx, top)
		if err != nil && ctx.Err() == nil {
			p.Log.Warn("price poll failed", "top", top, "err", err)
			return
		}
		p.Log.Debug("prices updated", "top", top, "count", n)
	}
	snap := func() {
		n, err := p.St.SnapshotBalances(ctx, p.now())
		if err != nil && ctx.Err() == nil {
			p.Log.Warn("balance snapshot failed", "err", err)
			return
		}
		p.Log.Debug("balance snapshot", "rows", n)
	}
	run(true)
	run(false)
	snap()
	top := time.NewTicker(p.Cfg.TopEvery)
	tail := time.NewTicker(p.Cfg.TailEvery)
	hourly := time.NewTicker(time.Hour)
	defer top.Stop()
	defer tail.Stop()
	defer hourly.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-top.C:
			run(true)
		case <-tail.C:
			run(false)
		case <-hourly.C:
			snap()
		}
	}
}
