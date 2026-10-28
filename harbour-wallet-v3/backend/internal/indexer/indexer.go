// Package indexer keeps Postgres current for tracked addresses. It consumes
// index.ActivityEvent only; balances are always read from chain through
// chain.Client, never summed from transfers.
package indexer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"sort"
	"strings"
	"sync"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/store"
)

// Chain is everything the indexer needs for one chain.
type Chain struct {
	Name     string
	Family   string
	Native   config.Native
	Client   chain.Client
	Finality chain.FinalityPolicy
	Source   index.Source
	Holdings index.Holdings // optional

	mu      sync.Mutex
	heads   [2]uint64 // latest, finalized
	headsAt time.Time
}

// Heads returns latest and finalized, cached for a few seconds.
func (c *Chain) Heads(ctx context.Context) (latest, finalized uint64, err error) {
	c.mu.Lock()
	if time.Since(c.headsAt) < 5*time.Second {
		l, f := c.heads[0], c.heads[1]
		c.mu.Unlock()
		return l, f, nil
	}
	c.mu.Unlock()
	if latest, err = c.Client.LatestBlock(ctx); err != nil {
		return 0, 0, err
	}
	if c.Finality != nil {
		finalized, _ = c.Finality.FinalizedBlock(ctx) // 0 = unknown: everything stays "confirmed"
	}
	c.mu.Lock()
	c.heads, c.headsAt = [2]uint64{latest, finalized}, time.Now()
	c.mu.Unlock()
	return latest, finalized, nil
}

// Indexer runs backfills, balance refreshes and NFT syncs.
type Indexer struct {
	st     *store.Store
	cfg    config.Indexer
	bus    events.Bus
	log    *slog.Logger
	chains map[string]*Chain
	assets *store.AssetCache
	wake   chan struct{}
	deb    *debouncer
}

// New builds an indexer over the given chains.
func New(st *store.Store, cfg config.Indexer, bus events.Bus, chains map[string]*Chain, log *slog.Logger) *Indexer {
	ix := &Indexer{st: st, cfg: cfg, bus: bus, log: log, chains: chains, assets: store.NewAssetCache(),
		wake: make(chan struct{}, 1)}
	ix.deb = newDebouncer(cfg.RefreshDebounce, func(ctx context.Context, id int64, refs []string) {
		if err := ix.RefreshBalances(ctx, id, refs); err != nil {
			ix.log.Warn("balance refresh failed", "tracked_address_id", id, "err", err)
		}
	})
	return ix
}

func (ix *Indexer) chainNames() []string {
	out := make([]string, 0, len(ix.chains))
	for n := range ix.chains {
		out = append(out, n)
	}
	sort.Strings(out)
	return out
}

// Wake asks a worker to look for pending backfills now.
func (ix *Indexer) Wake() {
	select {
	case ix.wake <- struct{}{}:
	default:
	}
}

// Run blocks until ctx ends.
func (ix *Indexer) Run(ctx context.Context) {
	var wg sync.WaitGroup
	wg.Add(3 + ix.cfg.Workers)
	go func() {
		defer wg.Done()
		err := ix.bus.Consume(ctx, "indexer-address-added", events.SubjectAddressAdded, func(context.Context, []byte) error {
			ix.Wake() // the row is already 'pending'; the event only removes polling delay
			return nil
		})
		if err != nil && ctx.Err() == nil {
			ix.log.Error("consume address.added", "err", err)
		}
	}()
	go func() {
		defer wg.Done()
		err := ix.bus.Consume(ctx, "indexer-history-more", events.SubjectHistoryMore, func(ctx context.Context, b []byte) error {
			var m struct {
				TrackedAddressID int64 `json:"tracked_address_id"`
			}
			if json.Unmarshal(b, &m) != nil || m.TrackedAddressID == 0 {
				return nil // malformed: drop
			}
			return ix.LoadOlder(ctx, m.TrackedAddressID)
		})
		if err != nil && ctx.Err() == nil {
			ix.log.Error("consume address.history.more", "err", err)
		}
	}()
	go func() { defer wg.Done(); ix.sweepLoop(ctx) }()
	for i := 0; i < ix.cfg.Workers; i++ {
		go func() { defer wg.Done(); ix.workerLoop(ctx) }()
	}
	wg.Wait()
}

func (ix *Indexer) workerLoop(ctx context.Context) {
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()
	for {
		for {
			ran, err := ix.RunOneBackfill(ctx)
			if err != nil && ctx.Err() == nil {
				ix.log.Warn("backfill error", "err", err)
			}
			if !ran {
				break
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ix.wake:
		case <-t.C:
		}
	}
}

func (ix *Indexer) sweepLoop(ctx context.Context) {
	t := time.NewTicker(10 * time.Minute)
	defer t.Stop()
	for {
		ids, err := ix.st.DueForSweep(ctx, ix.chainNames(), ix.cfg.IdleSweepAfter, 500)
		if err != nil && ctx.Err() == nil {
			ix.log.Warn("sweep query failed", "err", err)
		}
		for _, id := range ids {
			ix.deb.Trigger(ctx, id)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// TriggerRefresh schedules a debounced balance refresh (phase 4 live path);
// refs are token contracts the triggering transfer moved.
func (ix *Indexer) TriggerRefresh(ctx context.Context, trackedID int64, refs ...string) {
	ix.deb.Trigger(ctx, trackedID, refs...)
}

// Flush runs every pending debounced refresh now (tests, shutdown).
func (ix *Indexer) Flush(ctx context.Context) { ix.deb.Flush(ctx) }

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func (ix *Indexer) ingestOpts(c *Chain, latest, finalized uint64) store.IngestOptions {
	return store.IngestOptions{
		Chain: c.Name, Family: c.Family, NativeSym: c.Native.Symbol, NativeDec: c.Native.Decimals,
		Assets: ix.assets, Spam: SpamScore,
		Classify: func(b uint64) string {
			if c.Finality == nil {
				return string(chain.Confirmed)
			}
			return string(c.Finality.Classify(b, latest, finalized))
		},
	}
}

// RunOneBackfill claims and runs one pending backfill. It returns false when
// there was nothing to do.
func (ix *Indexer) RunOneBackfill(ctx context.Context) (bool, error) {
	job, ok, err := ix.st.ClaimBackfill(ctx, ix.chainNames())
	if err != nil || !ok {
		return false, err
	}
	log := ix.log.With("tracked_address_id", job.ID, "chain", job.Chain) // never log the address
	start := time.Now()
	state, newEvents, err := ix.backfill(ctx, job)
	if err != nil {
		msg := err.Error()
		if len(msg) > 300 {
			msg = msg[:300]
		}
		_ = ix.st.FinishBackfill(context.WithoutCancel(ctx), job.ID, "failed", 0, 0, false, msg)
		log.Warn("backfill failed", "err", err)
		return true, nil
	}
	log.Info("backfill finished", "state", state, "new_events", newEvents, "ms", time.Since(start).Milliseconds())
	return true, nil
}

func (ix *Indexer) backfill(ctx context.Context, job store.BackfillJob) (string, int, error) {
	c, ok := ix.chains[job.Chain]
	if !ok {
		return "", 0, fmt.Errorf("chain %s not indexed", job.Chain)
	}
	latest, finalized, err := c.Heads(ctx)
	if err != nil {
		return "", 0, err
	}
	refs := map[string]bool{}
	others := map[int64]map[string]bool{} // other tracked parties these events touched
	newEvents := 0
	state := "skipped"
	var oldest uint64
	complete := false
	if !job.DenyBackfill {
		state = "done"
		lim := index.BackfillLimits{MaxAge: ix.cfg.BackfillMaxAge, MaxTransfers: ix.cfg.BackfillMaxTransfers}
		cursor := ""
		for {
			page, err := c.Source.Backfill(ctx, c.Name, job.Address, cursor, lim)
			if err != nil {
				return "", newEvents, err
			}
			res, err := ix.st.IngestEvents(ctx, ix.ingestOpts(c, latest, finalized), page.Events)
			if err != nil {
				return "", newEvents, err
			}
			newEvents += res.New
			for id, as := range res.Touched {
				dst := refs
				if id != job.ID {
					if others[id] == nil {
						others[id] = map[string]bool{}
					}
					dst = others[id]
				}
				for a := range as {
					dst[a] = true
				}
			}
			if page.OldestBlock > 0 {
				oldest = page.OldestBlock
			}
			if page.Cursor == "" {
				if page.Capped {
					state = "capped"
				} else {
					complete = true
				}
				break
			}
			cursor = page.Cursor
			_ = ix.st.SaveBackfillCursor(ctx, job.ID, cursor)
		}
	}
	// Token discovery: transfers seen plus what the source says is held now.
	if c.Holdings != nil {
		toks, err := c.Holdings.TokenContracts(ctx, c.Name, job.Address)
		if err != nil {
			ix.log.Warn("token discovery failed", "tracked_address_id", job.ID, "err", err)
		}
		for _, t := range toks {
			refs[t] = true
		}
	}
	delete(refs, "native")
	extra := make([]string, 0, len(refs))
	for r := range refs {
		extra = append(extra, r)
	}
	if err := ix.RefreshBalances(ctx, job.ID, extra); err != nil {
		return "", newEvents, fmt.Errorf("balances: %w", err)
	}
	// Other tracked wallets on the other side of these transfers moved too.
	for id, as := range others {
		ix.deb.Trigger(ctx, id, keys(as)...)
	}
	if c.Holdings != nil && !job.DenyBackfill {
		if err := ix.SyncNFTs(ctx, c, job.ID, job.Address); err != nil {
			ix.log.Warn("nft sync failed", "tracked_address_id", job.ID, "err", err)
		}
	}
	return state, newEvents, ix.st.FinishBackfill(ctx, job.ID, state, latest, oldest, complete, "")
}

// LoadOlder fetches one page of history older than what is stored (the API
// asks for it when the user scrolls past the backfill cap).
func (ix *Indexer) LoadOlder(ctx context.Context, trackedID int64) error {
	job, err := ix.st.GetTracked(ctx, trackedID)
	if errors.Is(err, store.ErrNotFound) {
		return nil
	} else if err != nil {
		return err
	}
	if job.HistoryComplete || job.DenyBackfill || job.HistoryFrom == nil {
		return nil
	}
	c, ok := ix.chains[job.Chain]
	if !ok {
		return nil
	}
	latest, finalized, err := c.Heads(ctx)
	if err != nil {
		return err
	}
	lim := index.BackfillLimits{MaxTransfers: ix.cfg.OlderPageTransfers, BeforeBlock: uint64(*job.HistoryFrom)}
	cursor := ""
	var oldest uint64
	for {
		page, err := c.Source.Backfill(ctx, c.Name, job.Address, cursor, lim)
		if err != nil {
			return err
		}
		if _, err := ix.st.IngestEvents(ctx, ix.ingestOpts(c, latest, finalized), page.Events); err != nil {
			return err
		}
		if page.OldestBlock > 0 {
			oldest = page.OldestBlock
		}
		if page.Cursor == "" {
			return ix.st.UpdateHistory(ctx, trackedID, oldest, !page.Capped)
		}
		cursor = page.Cursor
	}
}

// BalanceChanged is published on balance.changed.<chain>; it carries the new
// state so clients never need to refetch.
type BalanceChanged struct {
	TrackedAddressID int64           `json:"tracked_address_id"`
	Chain            string          `json:"chain"`
	Address          string          `json:"address"`
	AsOfBlock        uint64          `json:"as_of_block"`
	Balances         []BalanceChange `json:"balances"`
}

// BalanceChange is one asset's new amount.
type BalanceChange struct {
	AssetRef  string `json:"asset_ref"`
	AmountRaw string `json:"amount_raw"`
}

// RefreshBalances reads native plus every known token balance from chain at
// one block and writes them (guarded by as_of_block).
func (ix *Indexer) RefreshBalances(ctx context.Context, trackedID int64, extraRefs []string) error {
	job, err := ix.st.GetTracked(ctx, trackedID)
	if err != nil {
		return err
	}
	c, ok := ix.chains[job.Chain]
	if !ok {
		return nil
	}
	held, err := ix.st.HeldTokenRefs(ctx, trackedID)
	if err != nil {
		return err
	}
	set := map[string]bool{}
	for _, r := range append(held, extraRefs...) {
		if r != "" && r != "native" {
			set[strings.ToLower(r)] = true
		}
	}
	refs := make([]string, 0, len(set))
	for r := range set {
		refs = append(refs, r)
	}
	sort.Strings(refs)

	// Make sure every token has an asset row with on-chain metadata.
	for _, r := range refs {
		if _, err := ix.st.UpsertAsset(ctx, ix.st.Pool, ix.assets, store.AssetInput{Chain: c.Name, Ref: r, Kind: "token"}); err != nil {
			return err
		}
	}
	if missing, err := ix.st.AssetsMissingInfo(ctx, c.Name, refs); err == nil && len(missing) > 0 {
		if infos, err := c.Client.TokenInfo(ctx, missing); err == nil {
			for _, ti := range infos {
				var dec *int
				if ti.Decimals >= 0 {
					d := ti.Decimals
					dec = &d
				}
				spam := SpamScore(ti.Symbol, ti.Name, dec)
				if ti.Failed {
					spam = 100 // not a token contract
				}
				_ = ix.st.SetTokenInfo(ctx, c.Name, ti.AssetRef, ti.Symbol, ti.Name, dec, spam)
			}
		} else {
			ix.log.Warn("token info failed", "chain", c.Name, "err", err)
		}
	}

	bals, block, err := c.Client.Balances(ctx, job.Address, refs, 0)
	if err != nil {
		return err
	}
	nd := c.Native.Decimals
	var rows []store.BalanceRow
	for _, b := range bals {
		if b.Failed || b.AmountRaw == nil {
			continue // keep the previous value rather than writing a wrong zero
		}
		a := store.AssetInput{Chain: c.Name, Ref: b.AssetRef, Kind: "token"}
		if b.AssetRef == "native" {
			a = store.AssetInput{Chain: c.Name, Ref: "native", Kind: "native", Symbol: c.Native.Symbol, Decimals: &nd, Verified: true}
		}
		id, err := ix.st.UpsertAsset(ctx, ix.st.Pool, ix.assets, a)
		if err != nil {
			return err
		}
		rows = append(rows, store.BalanceRow{AssetID: id, AssetRef: b.AssetRef, AmountRaw: b.AmountRaw.String()})
	}
	changed, err := ix.st.UpsertBalances(ctx, trackedID, block, rows)
	if err != nil {
		return err
	}
	if len(changed) == 0 {
		return nil
	}
	msg := BalanceChanged{TrackedAddressID: trackedID, Chain: c.Name, Address: job.Address, AsOfBlock: block}
	for _, r := range changed {
		msg.Balances = append(msg.Balances, BalanceChange{AssetRef: r.AssetRef, AmountRaw: r.AmountRaw})
	}
	b, _ := json.Marshal(msg)
	if err := ix.bus.Publish(ctx, events.SubjectBalance+"."+c.Name, b); err != nil {
		ix.log.Warn("publish balance.changed failed", "err", err)
	}
	return nil
}

// SyncNFTs replaces a tracked address's NFT holdings from the source.
func (ix *Indexer) SyncNFTs(ctx context.Context, c *Chain, trackedID int64, address string) error {
	var rows []store.NFTRow
	cursor := ""
	var asOf uint64
	for page := 0; page < ix.cfg.NFTMaxPages; page++ {
		p, err := c.Holdings.NFTs(ctx, c.Name, address, cursor)
		if err != nil {
			return err
		}
		if p.AsOfBlock > asOf {
			asOf = p.AsOfBlock
		}
		for _, n := range p.Items {
			kind := "nft"
			if n.Standard == "erc1155" {
				kind = "multi"
			}
			spam := 0
			if n.Spam {
				spam = 100
			}
			id, err := ix.st.UpsertAsset(ctx, ix.st.Pool, ix.assets, store.AssetInput{Chain: c.Name, Ref: n.Contract, Kind: kind,
				Symbol: n.Symbol, SpamScore: spam})
			if err != nil {
				return err
			}
			if _, ok := new(big.Int).SetString(n.TokenID, 10); !ok {
				continue
			}
			rows = append(rows, store.NFTRow{AssetID: id, TokenID: n.TokenID, Amount: n.Amount})
		}
		if p.Cursor == "" {
			break
		}
		cursor = p.Cursor
	}
	return ix.st.ReplaceNFTs(ctx, trackedID, asOf, rows)
}

// ---------- debounce ----------

type debouncer struct {
	d    time.Duration
	f    func(context.Context, int64, []string)
	mu   sync.Mutex
	m    map[int64]*time.Timer
	refs map[int64]map[string]bool
	sem  chan struct{}
}

func newDebouncer(d time.Duration, f func(context.Context, int64, []string)) *debouncer {
	return &debouncer{d: d, f: f, m: map[int64]*time.Timer{}, refs: map[int64]map[string]bool{}, sem: make(chan struct{}, 8)}
}

// Trigger runs f(id, refs) once, d after the last trigger for id; refs from
// every trigger in the window are merged.
func (db *debouncer) Trigger(ctx context.Context, id int64, refs ...string) {
	db.mu.Lock()
	defer db.mu.Unlock()
	if db.refs[id] == nil {
		db.refs[id] = map[string]bool{}
	}
	for _, r := range refs {
		db.refs[id][r] = true
	}
	if t, ok := db.m[id]; ok {
		t.Reset(db.d)
		return
	}
	db.m[id] = time.AfterFunc(db.d, func() { db.fire(ctx, id) })
}

func (db *debouncer) take(id int64) ([]string, bool) {
	db.mu.Lock()
	defer db.mu.Unlock()
	t, ok := db.m[id]
	if !ok {
		return nil, false
	}
	t.Stop()
	delete(db.m, id)
	refs := keys(db.refs[id])
	delete(db.refs, id)
	return refs, true
}

func (db *debouncer) fire(ctx context.Context, id int64) {
	refs, ok := db.take(id)
	if !ok || ctx.Err() != nil {
		return
	}
	db.sem <- struct{}{}
	defer func() { <-db.sem }()
	cctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	db.f(cctx, id, refs)
}

// Flush runs all pending triggers synchronously.
func (db *debouncer) Flush(ctx context.Context) {
	db.mu.Lock()
	ids := make([]int64, 0, len(db.m))
	for id := range db.m {
		ids = append(ids, id)
	}
	db.mu.Unlock()
	for _, id := range ids {
		db.fire(ctx, id)
	}
}
