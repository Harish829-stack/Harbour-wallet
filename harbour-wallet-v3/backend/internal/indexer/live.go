package indexer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/store"
)

// Phase 4: live webhooks, gap-fill, reorg repair and finality.

// Subjects for the live path.
const (
	SubjectGapFill = "chain.gapfill" // full gap-fill (published by webhook-ingest after downtime)
)

// ActivitySubject is where webhook-ingest publishes raw deliveries.
func ActivitySubject(chain string) string { return "chain." + chain + ".activity.raw" }

// RawDelivery is the NATS payload webhook-ingest publishes.
type RawDelivery struct {
	Source string          `json:"source"`
	Body   json.RawMessage `json:"body"`
}

// LiveOptions enable the live path.
type LiveOptions struct {
	// PublicURL is the HTTPS base the provider delivers to; webhooks
	// point at PublicURL + "/webhooks/<source>". Empty disables management.
	PublicURL    string
	Box          *store.SecretBox // encrypts signing keys at rest
	GapFillEvery time.Duration
	ActiveWithin time.Duration
	RepairEvery  time.Duration
	ManageEvery  time.Duration
}

// EnableLive turns on webhook management, delivery handling, gap-fill and repair.
func (ix *Indexer) EnableLive(o LiveOptions) {
	if o.GapFillEvery == 0 {
		o.GapFillEvery = 3 * time.Minute
	}
	if o.ActiveWithin == 0 {
		o.ActiveWithin = 7 * 24 * time.Hour
	}
	if o.RepairEvery == 0 {
		o.RepairEvery = time.Minute
	}
	if o.ManageEvery == 0 {
		o.ManageEvery = 15 * time.Second
	}
	ix.live = &o
}

func (ix *Indexer) runLive(ctx context.Context, wg *sync.WaitGroup) {
	if ix.live == nil {
		return
	}
	o := ix.live
	loop := func(every time.Duration, wake <-chan struct{}, f func(context.Context)) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			t := time.NewTicker(every)
			defer t.Stop()
			for {
				f(ctx)
				select {
				case <-ctx.Done():
					return
				case <-t.C:
				case <-wake:
				}
			}
		}()
	}
	loop(o.ManageEvery, ix.manageWake, func(ctx context.Context) {
		for _, c := range ix.sortedChains() {
			if err := ix.ManageWebhooks(ctx, c); err != nil && ctx.Err() == nil {
				ix.log.Warn("webhook management failed", "chain", c.Name, "err", err)
			}
		}
	})
	loop(o.GapFillEvery, nil, func(ctx context.Context) {
		if err := ix.GapFill(ctx, false); err != nil && ctx.Err() == nil {
			ix.log.Warn("gap-fill failed", "err", err)
		}
	})
	loop(o.RepairEvery, nil, func(ctx context.Context) {
		for _, c := range ix.sortedChains() {
			if err := ix.Repair(ctx, c); err != nil && ctx.Err() == nil {
				ix.log.Warn("reorg repair failed", "chain", c.Name, "err", err)
			}
		}
	})
	wg.Add(2)
	go func() {
		defer wg.Done()
		err := ix.bus.Consume(ctx, "indexer-activity", "chain.*.activity.raw", func(ctx context.Context, b []byte) error {
			return ix.HandleDelivery(ctx, b)
		})
		if err != nil && ctx.Err() == nil {
			ix.log.Error("consume activity", "err", err)
		}
	}()
	go func() {
		defer wg.Done()
		err := ix.bus.Consume(ctx, "indexer-gapfill", SubjectGapFill, func(ctx context.Context, _ []byte) error {
			ix.log.Info("full gap-fill requested (ingest was down)")
			return ix.GapFill(ctx, true)
		})
		if err != nil && ctx.Err() == nil {
			ix.log.Error("consume gapfill", "err", err)
		}
	}()
}

func (ix *Indexer) sortedChains() []*Chain {
	out := make([]*Chain, 0, len(ix.chains))
	for _, n := range ix.chainNames() {
		out = append(out, ix.chains[n])
	}
	return out
}

// ---------- webhook management ----------

// ManageWebhooks keeps the provider's webhooks in line with tracked
// addresses: moves them to a new public URL, subscribes new addresses,
// unsubscribes ones no device tracks, and shards past the provider cap.
func (ix *Indexer) ManageWebhooks(ctx context.Context, c *Chain) error {
	o := ix.live
	if o == nil || o.PublicURL == "" || c.Webhooks == nil || !c.Webhooks.WebhooksEnabled() || o.Box == nil {
		return nil
	}
	return ix.st.WithLock(ctx, "webhooks:"+c.SourceName+":"+c.Name, func() error { return ix.manageWebhooks(ctx, c, o) })
}

func (ix *Indexer) manageWebhooks(ctx context.Context, c *Chain, o *LiveOptions) error {
	url := strings.TrimRight(o.PublicURL, "/") + "/webhooks/" + c.SourceName
	hooks, err := ix.st.Webhooks(ctx, c.SourceName, c.Name)
	if err != nil {
		return err
	}
	var current []store.WebhookRow
	for _, h := range hooks {
		if h.URL == url {
			current = append(current, h)
			continue
		}
		// Public URL changed (e.g. a new dev tunnel): drop the old webhook;
		// its addresses resubscribe below and gap-fill covers the switch.
		if err := c.Webhooks.DeleteWebhook(ctx, h.ID); err != nil {
			ix.log.Warn("could not delete old webhook (continuing)", "chain", c.Name, "webhook", h.ID, "err", err)
		}
		if err := ix.st.DeleteWebhookRow(ctx, h.ID); err != nil {
			return err
		}
		ix.log.Info("webhook moved to new URL", "chain", c.Name, "old", h.ID)
	}
	max := c.Webhooks.MaxAddressesPerWebhook()
	for round := 0; round < 20; round++ {
		unsub, err := ix.st.PendingUnsubscriptions(ctx, c.Name, 500)
		if err != nil {
			return err
		}
		byHook := map[string][]store.SubRow{}
		for _, u := range unsub {
			byHook[u.WebhookID] = append(byHook[u.WebhookID], u)
		}
		for hid, rows := range byHook {
			addrs, ids := splitSub(rows)
			if err := c.Webhooks.UpdateWebhookAddresses(ctx, hid, nil, addrs); err != nil {
				return err
			}
			if err := ix.st.SetSubscribed(ctx, hid, ids, false); err != nil {
				return err
			}
		}
		pend, err := ix.st.PendingSubscriptions(ctx, c.Name, 500)
		if err != nil {
			return err
		}
		if len(pend) == 0 && len(unsub) == 0 {
			return nil
		}
		if len(pend) == 0 {
			continue
		}
		addrs, ids := splitSub(pend)
		var target *store.WebhookRow
		for i := range current {
			if current[i].AddressCount+len(pend) <= max {
				target = &current[i]
				break
			}
		}
		if target == nil {
			info, err := c.Webhooks.CreateWebhook(ctx, c.Name, url, addrs)
			if err != nil {
				return fmt.Errorf("create webhook: %w", err)
			}
			enc, err := o.Box.Seal(info.SigningKey)
			if err != nil {
				return err
			}
			row := store.WebhookRow{ID: info.ID, Source: c.SourceName, Chain: c.Name, URL: url, EncKey: enc, AddressCount: len(ids)}
			if err := ix.st.InsertWebhook(ctx, row, ids); err != nil {
				return err
			}
			current = append(current, row)
			ix.log.Info("webhook created", "chain", c.Name, "webhook", info.ID, "addresses", len(ids))
			continue
		}
		if err := c.Webhooks.UpdateWebhookAddresses(ctx, target.ID, addrs, nil); err != nil {
			return err
		}
		if err := ix.st.SetSubscribed(ctx, target.ID, ids, true); err != nil {
			return err
		}
		target.AddressCount += len(ids)
	}
	return nil
}

func splitSub(rows []store.SubRow) ([]string, []int64) {
	addrs := make([]string, len(rows))
	ids := make([]int64, len(rows))
	for i, r := range rows {
		addrs[i], ids[i] = r.Address, r.ID
	}
	return addrs, ids
}

// ---------- deliveries ----------

// HandleDelivery ingests one raw webhook delivery. Replays are harmless:
// every event is deduplicated by event_keys.
func (ix *Indexer) HandleDelivery(ctx context.Context, b []byte) error {
	var raw RawDelivery
	if err := json.Unmarshal(b, &raw); err != nil {
		ix.log.Warn("dropping malformed delivery message", "err", err)
		return nil
	}
	var wh index.Webhooks
	for _, c := range ix.chains {
		if c.SourceName == raw.Source && c.Webhooks != nil {
			wh = c.Webhooks
			break
		}
	}
	if wh == nil {
		ix.log.Warn("delivery for unknown source", "source", raw.Source)
		return nil
	}
	d, err := wh.ParseWebhook(raw.Body)
	if err != nil {
		ix.log.Warn("dropping unparseable delivery", "source", raw.Source, "err", err)
		return nil
	}
	c, ok := ix.chains[d.Chain]
	if !ok {
		return nil
	}
	var live, removed []index.ActivityEvent
	for _, ev := range d.Events {
		if ev.Removed {
			removed = append(removed, ev)
		} else {
			live = append(live, ev)
		}
	}
	latest, finalized, err := c.Heads(ctx)
	if err != nil {
		return err // redelivered later
	}
	res, err := ix.st.IngestEvents(ctx, ix.ingestOpts(c, latest, finalized), live)
	if err != nil {
		return err
	}
	if len(removed) > 0 {
		keys := make([]store.EventKey, len(removed))
		for i, ev := range removed {
			keys[i] = store.EventKey{TxHash: ev.TxHash, EventRef: ev.EventRef}
		}
		touched, err := ix.st.RemoveEvents(ctx, c.Name, keys)
		if err != nil {
			return err
		}
		for id, as := range touched {
			res.Parties[id] = true
			if res.Touched[id] == nil {
				res.Touched[id] = map[string]bool{}
			}
			for a := range as {
				res.Touched[id][a] = true
			}
		}
		ix.log.Info("reorged events removed (webhook)", "chain", c.Name, "events", len(keys))
	}
	ix.afterIngest(ctx, c, res)
	return nil
}

// afterIngest refreshes balances (debounced) and NFTs for every touched party.
func (ix *Indexer) afterIngest(ctx context.Context, c *Chain, res store.IngestResult) {
	ids := make([]int64, 0, len(res.Parties))
	for id := range res.Parties {
		ids = append(ids, id)
		var refs []string
		for a := range res.Touched[id] {
			if a != "native" {
				refs = append(refs, a)
			}
		}
		ix.deb.Trigger(ctx, id, refs...)
	}
	_ = ix.st.TouchActivity(ctx, ids)
	if c.Holdings == nil {
		return
	}
	for id := range res.NFTParties {
		j, err := ix.st.GetTracked(ctx, id)
		if err != nil || j.DenyBackfill {
			continue
		}
		if err := ix.SyncNFTs(ctx, c, id, j.Address); err != nil {
			ix.log.Warn("nft resync failed", "tracked_address_id", id, "err", err)
		}
	}
}

// ---------- gap-fill ----------

// safetyMargin keeps last_seen_block far enough behind the head that the
// source has indexed every block up to it (about two minutes).
func safetyMargin(c *Chain) uint64 {
	bt := c.BlockTime
	if bt <= 0 {
		bt = 2 * time.Second
	}
	m := uint64((2 * time.Minute) / bt)
	if m < 3 {
		m = 3
	}
	return m
}

// GapFill fetches anything the live path missed since each address's
// last_seen_block. all=false limits it to addresses active in the last week;
// all=true (after ingest downtime) covers every tracked address.
func (ix *Indexer) GapFill(ctx context.Context, all bool) error {
	var errs []error
	for _, c := range ix.sortedChains() {
		if err := ix.gapFillChain(ctx, c, all); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", c.Name, err))
		}
	}
	return errors.Join(errs...)
}

func (ix *Indexer) gapFillChain(ctx context.Context, c *Chain, all bool) error {
	latest, finalized, err := c.FreshHeads(ctx)
	if err != nil {
		return err
	}
	if latest <= safetyMargin(c) {
		return nil
	}
	target := latest - safetyMargin(c)
	within := 7 * 24 * time.Hour
	if ix.live != nil {
		within = ix.live.ActiveWithin
		if ix.live.PublicURL == "" {
			all = true // no webhooks at all: gap-fill is the only live path
		}
	}
	var after int64
	var firstErr error
	var mu sync.Mutex
	for {
		rows, err := ix.st.GapFillCandidates(ctx, c.Name, within, all, after, 200)
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return firstErr
		}
		sem := make(chan struct{}, 4)
		var wg sync.WaitGroup
		for _, r := range rows {
			after = r.ID
			if uint64(r.LastSeen) >= target {
				continue
			}
			wg.Add(1)
			sem <- struct{}{}
			go func(r store.GapRow) {
				defer wg.Done()
				defer func() { <-sem }()
				if err := ix.gapFillOne(ctx, c, r, target, latest, finalized); err != nil {
					mu.Lock()
					if firstErr == nil {
						firstErr = err
					}
					mu.Unlock()
				}
			}(r)
		}
		wg.Wait()
	}
}

func (ix *Indexer) gapFillOne(ctx context.Context, c *Chain, r store.GapRow, target, latest, finalized uint64) error {
	cursor := ""
	agg := store.IngestResult{Touched: map[int64]map[string]bool{}, Parties: map[int64]bool{}, NFTParties: map[int64]bool{}}
	found := 0
	for {
		page, err := c.Source.Since(ctx, c.Name, r.Address, uint64(r.LastSeen), cursor)
		if err != nil {
			return err
		}
		res, err := ix.st.IngestEvents(ctx, ix.ingestOpts(c, latest, finalized), page.Events)
		if err != nil {
			return err
		}
		found += res.New
		mergeResult(&agg, res)
		if page.Cursor == "" {
			break
		}
		cursor = page.Cursor
	}
	if found > 0 {
		ix.log.Info("gap-fill recovered events", "chain", c.Name, "tracked_address_id", r.ID, "events", found)
		ix.afterIngest(ctx, c, agg)
	}
	return ix.st.AdvanceLastSeen(ctx, r.ID, target)
}

func mergeResult(dst *store.IngestResult, src store.IngestResult) {
	dst.New += src.New
	for id, as := range src.Touched {
		if dst.Touched[id] == nil {
			dst.Touched[id] = map[string]bool{}
		}
		for a := range as {
			dst.Touched[id][a] = true
		}
	}
	for id := range src.Parties {
		dst.Parties[id] = true
	}
	for id := range src.NFTParties {
		dst.NFTParties[id] = true
	}
}

// ---------- reorg repair and finality ----------

// Repair promotes rows to finalized, fills block hashes the backfill could
// not provide, and removes events whose transaction left the canonical chain.
// It costs one block lookup per distinct non-final block, and a receipt only
// for rows without a hash or whose block hash no longer matches.
func (ix *Indexer) Repair(ctx context.Context, c *Chain) error {
	latest, finalized, err := c.FreshHeads(ctx)
	if err != nil {
		return err
	}
	if finalized > 0 {
		if _, err := ix.st.MarkFinalized(ctx, c.Name, finalized); err != nil {
			return err
		}
	}
	txs, err := ix.st.UnfinalTxs(ctx, c.Name, 300)
	if err != nil {
		return err
	}
	canonical := map[int64]string{}
	refresh := map[int64]map[string]bool{}
	removed := 0
	for _, tx := range txs {
		if uint64(tx.Block) > latest {
			continue // our view of the head is behind this row; check later
		}
		if tx.BlockHash != "" {
			h, ok := canonical[tx.Block]
			if !ok {
				if h, err = c.Client.BlockHash(ctx, uint64(tx.Block)); err != nil {
					return err
				}
				canonical[tx.Block] = h
			}
			if h == "" || h == tx.BlockHash {
				continue // still canonical (or block not visible yet)
			}
		}
		inc, err := c.Client.Inclusion(ctx, tx.TxHash)
		if err != nil {
			return err
		}
		switch {
		case inc.Found:
			if inc.BlockNumber != uint64(tx.Block) || inc.BlockHash != tx.BlockHash {
				if err := ix.st.SetTxBlock(ctx, c.Name, tx.TxHash, inc.BlockNumber, inc.BlockHash); err != nil {
					return err
				}
			}
		case latest >= uint64(tx.Block)+reorgConfirmations(tx.BlockHash):
			keys, err := ix.st.TxEventKeys(ctx, c.Name, tx.TxHash)
			if err != nil {
				return err
			}
			touched, err := ix.st.RemoveEvents(ctx, c.Name, keys)
			if err != nil {
				return err
			}
			removed += len(keys)
			for id, as := range touched {
				if refresh[id] == nil {
					refresh[id] = map[string]bool{}
				}
				for a := range as {
					refresh[id][a] = true
				}
			}
		}
	}
	if removed > 0 {
		ix.log.Info("reorged events removed (repair)", "chain", c.Name, "events", removed)
	}
	ids := make([]int64, 0, len(refresh))
	for id := range refresh {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	for _, id := range ids {
		ix.deb.Trigger(ctx, id, keys(refresh[id])...)
	}
	return nil
}

// reorgConfirmations: a row with a known hash that no longer matches is
// confirmed gone after a few blocks; a row with no hash (from backfill) is
// only dropped once the chain is clearly past it.
func reorgConfirmations(storedHash string) uint64 {
	if storedHash == "" {
		return 12
	}
	return 3
}
