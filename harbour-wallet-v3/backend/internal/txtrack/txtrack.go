// Package txtrack follows transactions broadcast through Harbour until they
// are mined, fail or drop, and publishes tx.status.<chain> on every change.
package txtrack

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/events"
	"harbour/backend/internal/registry"
	"harbour/backend/internal/store"
)

// Status is published on tx.status.<chain> (same shape as the API's).
type Status struct {
	Chain       string `json:"chain"`
	TxHash      string `json:"tx_hash"`
	Status      string `json:"status"` // pending | confirmed | failed | dropped
	BlockNumber uint64 `json:"block_number,omitempty"`
	From        string `json:"from,omitempty"`
}

// Chain is what the tracker needs per chain.
type Chain struct {
	Client    chain.Client
	BlockTime time.Duration
}

// Tracker polls due pending transactions.
type Tracker struct {
	St     *store.Store
	Bus    events.Bus
	Chains map[string]Chain
	Log    *slog.Logger
	// MaxAge after which an unseen transaction is reported dropped.
	MaxAge time.Duration
	Every  time.Duration
}

// BuildChains constructs a chain client per configured chain via the registry.
func BuildChains(cfg *config.Config, rpcURL, rpcToken string) (map[string]Chain, error) {
	out := map[string]Chain{}
	for _, name := range cfg.ChainNames() {
		ch := cfg.Chains[name]
		f, err := registry.ChainClients.Get(ch.Family)
		if err != nil {
			return nil, err
		}
		c, err := f(chain.ClientConfig{Chain: name, Family: chain.Family(ch.Family), EVMChainID: ch.EVMChainID,
			RPCURL: rpcURL, RPCToken: rpcToken, Options: ch.Extra})
		if err != nil {
			return nil, fmt.Errorf("chain %s: %w", name, err)
		}
		out[name] = Chain{Client: c, BlockTime: ch.BlockTime}
	}
	return out, nil
}

// Run polls until ctx ends.
func (t *Tracker) Run(ctx context.Context) {
	every := t.Every
	if every <= 0 {
		every = time.Second
	}
	tick := time.NewTicker(every)
	defer tick.Stop()
	lastPrune := time.Time{}
	for {
		if _, err := t.RunOnce(ctx); err != nil && ctx.Err() == nil {
			t.Log.Warn("tx check failed", "err", err)
		}
		// Privacy: settled sends lose their device link after an hour and disappear after 30 days.
		if time.Since(lastPrune) > 10*time.Minute {
			lastPrune = time.Now()
			// HW-2026-020: unlink the device soon after settle (the notifier has pushed by then); keep rows 7 days.
			if err := t.St.PrunePending(ctx, 10*time.Minute, 7*24*time.Hour); err != nil && ctx.Err() == nil {
				t.Log.Warn("prune pending failed", "err", err)
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

// RunOnce checks every due transaction and returns how many changed state.
func (t *Tracker) RunOnce(ctx context.Context) (int, error) {
	due, err := t.St.DuePending(ctx, 100)
	if err != nil {
		return 0, err
	}
	changed := 0
	for _, p := range due {
		ok, err := t.check(ctx, p)
		if err != nil {
			t.Log.Warn("tx check failed", "chain", p.Chain, "err", err)
			_, _ = t.St.UpdatePending(ctx, p.Chain, p.TxHash, "pending", 0, 15*time.Second)
			continue
		}
		if ok {
			changed++
		}
	}
	return changed, nil
}

func (t *Tracker) backoff(c Chain, checks int) time.Duration {
	bt := c.BlockTime
	if bt <= 0 {
		bt = 2 * time.Second
	}
	d := bt * time.Duration(1+checks/5)
	if d > time.Minute {
		d = time.Minute
	}
	return d
}

func (t *Tracker) check(ctx context.Context, p store.PendingRef) (bool, error) {
	c, ok := t.Chains[p.Chain]
	if !ok {
		_, err := t.St.UpdatePending(ctx, p.Chain, p.TxHash, "dropped", 0, 0)
		return false, err
	}
	inc, err := c.Client.Inclusion(ctx, p.TxHash)
	if err != nil {
		return false, err
	}
	if inc.Found {
		state := "confirmed"
		if !inc.Success {
			state = "failed"
		}
		return t.finish(ctx, p, state, inc.BlockNumber)
	}
	maxAge := t.MaxAge
	if maxAge <= 0 {
		maxAge = 6 * time.Hour
	}
	if time.Since(p.At) > maxAge {
		return t.finish(ctx, p, "dropped", 0)
	}
	// Its nonce was used by another mined transaction: replaced or dropped.
	// Check twice (a receipt can lag the nonce by a moment).
	if cn, ok := c.Client.(chain.ConfirmedNoncer); ok && p.Checks >= 1 {
		n, err := cn.ConfirmedNonce(ctx, p.From)
		if err == nil && n > uint64(p.Nonce) {
			if p.Checks >= 3 {
				return t.finish(ctx, p, "dropped", 0)
			}
		}
	}
	_, err = t.St.UpdatePending(ctx, p.Chain, p.TxHash, "pending", 0, t.backoff(c, p.Checks))
	return false, err
}

func (t *Tracker) finish(ctx context.Context, p store.PendingRef, state string, block uint64) (bool, error) {
	ok, err := t.St.UpdatePending(ctx, p.Chain, p.TxHash, state, block, 0)
	if err != nil || !ok {
		return false, err
	}
	b, _ := json.Marshal(Status{Chain: p.Chain, TxHash: p.TxHash, Status: state, BlockNumber: block, From: p.From})
	if err := t.Bus.Publish(ctx, "tx.status."+p.Chain, b); err != nil {
		t.Log.Warn("publish tx.status failed", "err", err)
	}
	t.Log.Info("tx settled", "chain", p.Chain, "state", state)
	return true, nil
}
