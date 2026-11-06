package indexer

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"harbour/backend/internal/store"
)

// safetyOverdue reports whether the last completed safety gap-fill is older than every (or never ran). On a database
// error it answers false: the pass then runs on its normal schedule.
func (ix *Indexer) safetyOverdue(ctx context.Context, every time.Duration) bool {
	last, err := ix.st.LastHeartbeat(ctx, safetyBeat)
	if err != nil {
		if ctx.Err() == nil {
			ix.log.Warn("read safety gap-fill time failed", "err", err)
		}
		return false
	}
	return last.IsZero() || time.Since(last) > every
}

// txSettled is the part of tx-tracker's tx.status.<chain> message the indexer needs.
type txSettled struct {
	Chain       string `json:"chain"`
	Status      string `json:"status"`
	From        string `json:"from"`
	BlockNumber uint64 `json:"block_number"`
}

// settledRefresher re-reads an address shortly after one of its own transactions settles. The wallet's own sends and
// swaps then reach balances and history even when the webhook delivery is late, lost, or the webhook path is down.
type settledRefresher struct {
	ix     *Indexer
	delays []time.Duration
	mu     sync.Mutex
	busy   map[string]bool // chain|address with a refresh already scheduled
}

func newSettledRefresher(ix *Indexer, delays []time.Duration) *settledRefresher {
	return &settledRefresher{ix: ix, delays: delays, busy: map[string]bool{}}
}

// handle schedules the refreshes for one tx.status message and returns at once (never blocks the consumer).
func (s *settledRefresher) handle(ctx context.Context, b []byte) {
	if len(s.delays) == 0 {
		return
	}
	var m txSettled
	if json.Unmarshal(b, &m) != nil || (m.Status != "confirmed" && m.Status != "failed") || m.From == "" {
		return
	}
	c, ok := s.ix.chains[m.Chain]
	if !ok {
		return
	}
	addr := strings.ToLower(m.From)
	key := m.Chain + "|" + addr
	s.mu.Lock()
	if s.busy[key] {
		s.mu.Unlock()
		return
	}
	s.busy[key] = true
	s.mu.Unlock()
	go func() {
		defer func() { s.mu.Lock(); delete(s.busy, key); s.mu.Unlock() }()
		for _, d := range s.delays {
			t := time.NewTimer(d)
			select {
			case <-ctx.Done():
				t.Stop()
				return
			case <-t.C:
			}
			if err := s.ix.refreshAddress(ctx, c, addr, m.BlockNumber); err != nil && ctx.Err() == nil {
				s.ix.log.Warn("refresh after settled tx failed", "chain", c.Name, "err", err)
			}
		}
	}()
}

// refreshAddress runs one gap-fill pass for a single tracked address, whatever its webhook state, then re-reads its
// balances at block atBlock or newer (the events may already be stored, in which case gap-fill alone changes nothing).
func (ix *Indexer) refreshAddress(ctx context.Context, c *Chain, address string, atBlock uint64) error {
	r, err := ix.st.GapRowFor(ctx, c.Name, address)
	if errors.Is(err, store.ErrNotFound) {
		return nil // not tracked (or still backfilling: the backfill will see the transaction)
	}
	if err != nil {
		return err
	}
	latest, finalized, err := c.FreshHeads(ctx)
	if err != nil {
		return err
	}
	if latest <= safetyMargin(c) {
		return nil
	}
	if err := ix.gapFillOne(ctx, c, r, latest-safetyMargin(c), latest, finalized); err != nil {
		return err
	}
	ix.needBlock(r.ID, atBlock)
	ix.deb.Trigger(context.WithoutCancel(ctx), r.ID)
	return nil
}

// refreshActiveBalances queues a balance re-read for every webhook-subscribed address active within `within` (bounded:
// idle addresses are skipped; unsubscribed ones are re-read by the 3-minute gap-fill anyway).
func (ix *Indexer) refreshActiveBalances(ctx context.Context, within time.Duration) {
	n := 0
	for _, c := range ix.sortedChains() {
		for _, scope := range []store.GapScope{store.GapActive} {
			var after int64
			for ctx.Err() == nil {
				rows, err := ix.st.GapFillCandidates(ctx, c.Name, scope, false, within, after, 200)
				if err != nil {
					if ctx.Err() == nil {
						ix.log.Warn("start-up balance refresh failed", "chain", c.Name, "err", err)
					}
					break
				}
				if len(rows) == 0 {
					break
				}
				for _, r := range rows {
					after = r.ID
					ix.deb.Trigger(ctx, r.ID)
					n++
				}
			}
		}
	}
	if n > 0 {
		ix.log.Info("start-up balance refresh queued", "addresses", n)
	}
}
