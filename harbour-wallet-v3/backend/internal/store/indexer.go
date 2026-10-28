package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"harbour/backend/internal/core/index"
)

// BackfillJob is a claimed backfill.
type BackfillJob struct {
	TrackedAddress
	HistoryFrom     *int64
	HistoryComplete bool
}

// ClaimBackfill takes one pending backfill for the given chains, marking it
// running. Runs stuck for 15 minutes and failures older than 10 minutes are retried.
func (s *Store) ClaimBackfill(ctx context.Context, chains []string) (BackfillJob, bool, error) {
	var j BackfillJob
	err := s.Pool.QueryRow(ctx, `
		UPDATE tracked_addresses t SET backfill_state = 'running', backfill_started_at = now(), backfill_error = NULL
		WHERE t.id = (
			SELECT id FROM tracked_addresses
			WHERE chain_id = ANY($1) AND (backfill_state = 'pending'
			   OR (backfill_state = 'running' AND backfill_started_at < now() - interval '15 minutes')
			   OR (backfill_state = 'failed' AND backfill_started_at < now() - interval '10 minutes'))
			ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
		RETURNING id, chain_id, address, backfill_state, deny_backfill, synced_to_block, history_from_block, history_complete`,
		chains).Scan(&j.ID, &j.Chain, &j.Address, &j.BackfillState, &j.DenyBackfill, &j.SyncedTo, &j.HistoryFrom, &j.HistoryComplete)
	if errors.Is(err, pgx.ErrNoRows) {
		return j, false, nil
	}
	return j, err == nil, err
}

// GetTracked loads one tracked address.
func (s *Store) GetTracked(ctx context.Context, id int64) (BackfillJob, error) {
	var j BackfillJob
	err := s.Pool.QueryRow(ctx, `SELECT id, chain_id, address, backfill_state, deny_backfill, synced_to_block, history_from_block, history_complete
		FROM tracked_addresses WHERE id = $1`, id).
		Scan(&j.ID, &j.Chain, &j.Address, &j.BackfillState, &j.DenyBackfill, &j.SyncedTo, &j.HistoryFrom, &j.HistoryComplete)
	if errors.Is(err, pgx.ErrNoRows) {
		return j, ErrNotFound
	}
	return j, err
}

// SaveBackfillCursor records progress (visible in tracked_addresses).
func (s *Store) SaveBackfillCursor(ctx context.Context, id int64, cursor string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_cursor = $2 WHERE id = $1`, id, cursor)
	return err
}

// FinishBackfill marks a backfill done ("done", "capped", "skipped" or "failed").
func (s *Store) FinishBackfill(ctx context.Context, id int64, state string, syncedTo uint64, historyFrom uint64, complete bool, errMsg string) error {
	var hf any
	if historyFrom > 0 {
		hf = int64(historyFrom)
	}
	var em any
	if errMsg != "" {
		em = errMsg
	}
	_, err := s.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_state = $2,
		synced_to_block = CASE WHEN $3::bigint > 0 THEN GREATEST(COALESCE(synced_to_block, 0), $3::bigint) ELSE synced_to_block END,
		last_seen_block = CASE WHEN $3::bigint > 0 THEN GREATEST(COALESCE(last_seen_block, 0), $3::bigint) ELSE last_seen_block END,
		history_from_block = COALESCE(LEAST(history_from_block, $4::bigint), $4::bigint, history_from_block),
		history_complete = history_complete OR $5, backfill_cursor = NULL, backfill_error = $6
		WHERE id = $1`, id, state, int64(syncedTo), hf, complete, em)
	return err
}

// UpdateHistory records an on-demand older page.
func (s *Store) UpdateHistory(ctx context.Context, id int64, historyFrom uint64, complete bool) error {
	var hf any
	if historyFrom > 0 {
		hf = int64(historyFrom)
	}
	_, err := s.Pool.Exec(ctx, `UPDATE tracked_addresses SET
		history_from_block = COALESCE(LEAST(history_from_block, $2::bigint), $2::bigint, history_from_block),
		history_complete = history_complete OR $3 WHERE id = $1`, id, hf, complete)
	return err
}

// ---------- assets ----------

// AssetInput describes an asset to upsert.
type AssetInput struct {
	Chain, Ref, Kind string
	Symbol, Name     string
	Decimals         *int
	SpamScore        int
	Verified         bool
}

// AssetCache maps (chain, ref) to asset ids for the life of a process.
type AssetCache struct {
	mu     sync.Mutex
	m      map[string]int64
	parent *AssetCache // read-through; writes stay local until merged
}

func (c *AssetCache) get(k string) (int64, bool) {
	c.mu.Lock()
	id, ok := c.m[k]
	c.mu.Unlock()
	if !ok && c.parent != nil {
		return c.parent.get(k)
	}
	return id, ok
}

// child returns a cache for one transaction; merge it only after commit so a
// rolled-back insert never leaves a dangling id behind.
func (c *AssetCache) child() *AssetCache {
	return &AssetCache{m: map[string]int64{}, parent: c}
}

func (c *AssetCache) mergeInto(p *AssetCache) {
	if p == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	p.mu.Lock()
	defer p.mu.Unlock()
	for k, v := range c.m {
		p.m[k] = v
	}
}

// NewAssetCache returns an empty cache.
func NewAssetCache() *AssetCache { return &AssetCache{m: map[string]int64{}} }

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// UpsertAsset inserts an asset or fills fields it lacked; returns its id.
func (s *Store) UpsertAsset(ctx context.Context, q Querier, c *AssetCache, a AssetInput) (int64, error) {
	key := a.Chain + "|" + a.Ref
	if c != nil {
		if id, ok := c.get(key); ok && a.Symbol == "" && a.Decimals == nil {
			return id, nil
		}
	}
	var dec any
	if a.Decimals != nil {
		dec = *a.Decimals
	}
	var id int64
	err := q.QueryRow(ctx, `
		INSERT INTO assets (chain_id, asset_ref, kind, symbol, name, decimals, spam_score, verified)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (chain_id, asset_ref) DO UPDATE SET
			symbol = COALESCE(assets.symbol, EXCLUDED.symbol),
			name = COALESCE(assets.name, EXCLUDED.name),
			decimals = COALESCE(assets.decimals, EXCLUDED.decimals),
			spam_score = GREATEST(assets.spam_score, EXCLUDED.spam_score),
			verified = assets.verified OR EXCLUDED.verified
		RETURNING id`, a.Chain, a.Ref, a.Kind, nullStr(a.Symbol), nullStr(a.Name), dec, a.SpamScore, a.Verified).Scan(&id)
	if err != nil {
		return 0, err
	}
	if c != nil {
		c.mu.Lock()
		c.m[key] = id
		c.mu.Unlock()
	}
	return id, nil
}

// SetTokenInfo overwrites on-chain metadata and spam score for an asset.
func (s *Store) SetTokenInfo(ctx context.Context, chain, ref, symbol, name string, decimals *int, spam int) error {
	var dec any
	if decimals != nil {
		dec = *decimals
	}
	_, err := s.Pool.Exec(ctx, `UPDATE assets SET symbol = COALESCE($3, symbol), name = COALESCE($4, name),
		decimals = COALESCE($5, decimals), spam_score = $6 WHERE chain_id = $1 AND asset_ref = $2`,
		chain, ref, nullStr(symbol), nullStr(name), dec, spam)
	return err
}

// AssetsMissingInfo returns token refs among refs that have no decimals yet.
func (s *Store) AssetsMissingInfo(ctx context.Context, chain string, refs []string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT asset_ref FROM assets WHERE chain_id = $1 AND asset_ref = ANY($2)
		AND kind = 'token' AND (decimals IS NULL OR symbol IS NULL)`, chain, refs)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// Querier is satisfied by a pool and a transaction.
type Querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// ---------- facts ----------

// IngestOptions carries chain context for one batch.
type IngestOptions struct {
	Chain     string
	Family    string
	NativeSym string
	NativeDec int
	Classify  func(block uint64) string // finality
	Spam      func(symbol, name string, decimals *int) int
	Assets    *AssetCache
}

// IngestResult summarises a batch.
type IngestResult struct {
	New        int
	Duplicates int
	// Touched maps tracked address id -> fungible asset refs it moved.
	Touched map[int64]map[string]bool
}

var ensuredMonths sync.Map // "parent|YYYYMM" -> true

func (s *Store) ensurePartitions(ctx context.Context, evs []index.ActivityEvent) error {
	for _, ev := range evs {
		m := ev.BlockTime.UTC().Format("200601")
		for _, parent := range []string{"transfers", "transactions"} {
			k := parent + "|" + m
			if _, ok := ensuredMonths.Load(k); ok {
				continue
			}
			if _, err := s.Pool.Exec(ctx, `SELECT harbour_ensure_partition($1, $2)`, parent, ev.BlockTime); err != nil {
				return fmt.Errorf("ensure partition %s %s: %w", parent, m, err)
			}
			ensuredMonths.Store(k, true)
		}
	}
	return nil
}

func validAmount(s string) bool {
	_, ok := new(big.Int).SetString(s, 10)
	return ok && !strings.HasPrefix(s, "-")
}

type summaryItem struct {
	EventRef  string `json:"event_ref"`
	Asset     string `json:"asset"`
	AmountRaw string `json:"amount_raw"`
	Kind      string `json:"kind"`
	Direction string `json:"direction"`
	TokenID   string `json:"token_id,omitempty"`
	Counter   string `json:"counterparty,omitempty"`
}

// IngestEvents writes events idempotently. For each event the dedupe key
// goes into event_keys first, in the same transaction as the fact row; a
// conflict means the event was already stored and nothing else is written.
func (s *Store) IngestEvents(ctx context.Context, o IngestOptions, evs []index.ActivityEvent) (IngestResult, error) {
	res := IngestResult{Touched: map[int64]map[string]bool{}}
	if len(evs) == 0 {
		return res, nil
	}
	if err := s.ensurePartitions(ctx, evs); err != nil {
		return res, err
	}
	// Which parties are tracked on this chain?
	addrSet := map[string]bool{}
	for _, ev := range evs {
		addrSet[ev.From], addrSet[ev.To] = true, true
	}
	addrs := make([]string, 0, len(addrSet))
	for a := range addrSet {
		if a != "" {
			addrs = append(addrs, a)
		}
	}
	tracked := map[string]int64{}
	rows, err := s.Pool.Query(ctx, `SELECT address, id FROM tracked_addresses WHERE chain_id = $1 AND address = ANY($2)`, o.Chain, addrs)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var a string
		var id int64
		if err := rows.Scan(&a, &id); err != nil {
			rows.Close()
			return res, err
		}
		tracked[a] = id
	}
	rows.Close()

	var txCache *AssetCache
	if o.Assets != nil {
		txCache = o.Assets.child()
	}
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		var q Querier = tx
		for _, ev := range evs {
			if ev.Chain != o.Chain || ev.TxHash == "" || ev.EventRef == "" || !validAmount(ev.AmountRaw) {
				return fmt.Errorf("invalid event %s/%s", ev.TxHash, ev.EventRef)
			}
			tag, err := tx.Exec(ctx, `INSERT INTO event_keys (chain_id, tx_hash, event_ref) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
				o.Chain, ev.TxHash, ev.EventRef)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				res.Duplicates++
				continue
			}
			res.New++
			var details map[string]any
			if len(ev.Details) > 0 {
				_ = json.Unmarshal(ev.Details, &details)
			}
			sym, _ := details[index.DetailSymbol].(string)
			var dec *int
			if d, ok := details[index.DetailDecimals].(float64); ok {
				di := int(d)
				dec = &di
			}
			tokenID, _ := details[index.DetailTokenID].(string)
			a := AssetInput{Chain: o.Chain, Ref: ev.Asset, Kind: "token", Symbol: sym, Decimals: dec}
			switch ev.Kind {
			case index.KindNative, index.KindInternal:
				nd := o.NativeDec
				a = AssetInput{Chain: o.Chain, Ref: "native", Kind: "native", Symbol: o.NativeSym, Decimals: &nd, Verified: true}
			case index.KindNFT:
				a.Kind, a.Decimals = "nft", nil
			case index.KindMulti:
				a.Kind, a.Decimals = "multi", nil
			default:
				if o.Spam != nil {
					a.SpamScore = o.Spam(sym, "", dec)
				}
			}
			assetID, err := s.UpsertAsset(ctx, q, txCache, a)
			if err != nil {
				return err
			}
			fin := "confirmed"
			if o.Classify != nil {
				fin = o.Classify(ev.BlockNumber)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO transfers (chain_id, chain_family, tx_hash, event_ref, block_number, block_hash,
				block_time, asset_id, "from", "to", amount_raw, kind, finality, details)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::numeric,$12,$13,COALESCE($14::jsonb,'{}'::jsonb))`,
				o.Chain, o.Family, ev.TxHash, ev.EventRef, int64(ev.BlockNumber), ev.BlockHash, ev.BlockTime, assetID,
				nullStr(ev.From), nullStr(ev.To), ev.AmountRaw, string(ev.Kind), fin, nullJSON(ev.Details)); err != nil {
				return err
			}
			// One transactions row per tx, deduped the same way.
			tag, err = tx.Exec(ctx, `INSERT INTO event_keys (chain_id, tx_hash, event_ref) VALUES ($1,$2,'tx') ON CONFLICT DO NOTHING`, o.Chain, ev.TxHash)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 1 {
				var from, to any
				if ev.Kind == index.KindNative {
					from, to = nullStr(ev.From), nullStr(ev.To)
				}
				if _, err := tx.Exec(ctx, `INSERT INTO transactions (chain_id, chain_family, tx_hash, block_number, block_hash, block_time, "from", "to", finality)
					VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, o.Chain, o.Family, ev.TxHash, int64(ev.BlockNumber), ev.BlockHash, ev.BlockTime, from, to, fin); err != nil {
					return err
				}
			}
			// Activity rows for every tracked party.
			for party, dir := range map[string]string{ev.To: "in", ev.From: "out"} {
				id, ok := tracked[party]
				if !ok || party == "" {
					continue
				}
				if ev.From == ev.To {
					dir = "self"
				}
				counter := ev.From
				if dir == "out" {
					counter = ev.To
				}
				item, _ := json.Marshal([]summaryItem{{EventRef: ev.EventRef, Asset: ev.Asset, AmountRaw: ev.AmountRaw,
					Kind: string(ev.Kind), Direction: dir, TokenID: tokenID, Counter: counter}})
				if _, err := tx.Exec(ctx, `INSERT INTO address_activity (tracked_address_id, block_time, tx_hash, chain_id, direction, summary)
					VALUES ($1,$2,$3,$4,$5, jsonb_build_object('transfers', $6::jsonb))
					ON CONFLICT (tracked_address_id, tx_hash) DO UPDATE SET
						direction = CASE WHEN address_activity.direction = EXCLUDED.direction THEN address_activity.direction
						                 WHEN 'self' IN (address_activity.direction, EXCLUDED.direction) THEN 'self'
						                 ELSE 'out' END,
						summary = jsonb_set(address_activity.summary, '{transfers}',
						          COALESCE(address_activity.summary->'transfers', '[]'::jsonb) || (EXCLUDED.summary->'transfers'))`,
					id, ev.BlockTime, ev.TxHash, o.Chain, dir, string(item)); err != nil {
					return err
				}
				if ev.Kind == index.KindToken || ev.Kind == index.KindNative || ev.Kind == index.KindInternal {
					if res.Touched[id] == nil {
						res.Touched[id] = map[string]bool{}
					}
					res.Touched[id][ev.Asset] = true
				}
			}
		}
		return nil
	})
	if err != nil {
		return IngestResult{}, err
	}
	if txCache != nil {
		txCache.mergeInto(o.Assets)
	}
	return res, nil
}

func nullJSON(b json.RawMessage) any {
	if len(b) == 0 {
		return nil
	}
	return string(b)
}

// ---------- balances ----------

// BalanceRow is one balance to write.
type BalanceRow struct {
	AssetID   int64
	AssetRef  string
	AmountRaw string
}

// UpsertBalances writes balances read from chain at asOfBlock. A row is only
// replaced by a read at a newer block, so out-of-order refreshes can't
// regress a balance. Returns the rows that changed.
func (s *Store) UpsertBalances(ctx context.Context, trackedID int64, asOfBlock uint64, rows []BalanceRow) ([]BalanceRow, error) {
	var changed []BalanceRow
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		for _, r := range rows {
			var prev *string
			err := tx.QueryRow(ctx, `SELECT amount_raw::text FROM balances WHERE tracked_address_id=$1 AND asset_id=$2`, trackedID, r.AssetID).Scan(&prev)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return err
			}
			tag, err := tx.Exec(ctx, `INSERT INTO balances (tracked_address_id, asset_id, amount_raw, as_of_block, updated_at)
				VALUES ($1,$2,$3::numeric,$4, now())
				ON CONFLICT (tracked_address_id, asset_id) DO UPDATE
				SET amount_raw = EXCLUDED.amount_raw, as_of_block = EXCLUDED.as_of_block, updated_at = now()
				WHERE balances.as_of_block < EXCLUDED.as_of_block`, trackedID, r.AssetID, r.AmountRaw, int64(asOfBlock))
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 1 && (prev == nil || *prev != r.AmountRaw) {
				changed = append(changed, r)
			}
		}
		_, err := tx.Exec(ctx, `UPDATE tracked_addresses SET balances_refreshed_at = now() WHERE id = $1`, trackedID)
		return err
	})
	return changed, err
}

// HeldTokenRefs returns fungible token refs that have a balance row.
func (s *Store) HeldTokenRefs(ctx context.Context, trackedID int64) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT a.asset_ref FROM balances b JOIN assets a ON a.id = b.asset_id
		WHERE b.tracked_address_id = $1 AND a.kind = 'token'`, trackedID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// DueForSweep returns tracked addresses whose balances are older than age.
func (s *Store) DueForSweep(ctx context.Context, chains []string, age time.Duration, limit int) ([]int64, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id FROM tracked_addresses WHERE chain_id = ANY($1)
		AND backfill_state IN ('done','capped','skipped')
		AND (balances_refreshed_at IS NULL OR balances_refreshed_at < now() - $2::interval)
		ORDER BY balances_refreshed_at NULLS FIRST LIMIT $3`, chains, fmt.Sprintf("%d seconds", int(age.Seconds())), limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[int64])
}

// StoredBalance is a balance with its asset.
type StoredBalance struct {
	AssetRef  string
	Symbol    *string
	Decimals  *int
	Kind      string
	AmountRaw string
	AsOfBlock int64
	SpamScore int
}

// Balances lists a tracked address's balances.
func (s *Store) Balances(ctx context.Context, trackedID int64) ([]StoredBalance, error) {
	rows, err := s.Pool.Query(ctx, `SELECT a.asset_ref, a.symbol, a.decimals, a.kind, b.amount_raw::text, b.as_of_block, a.spam_score
		FROM balances b JOIN assets a ON a.id = b.asset_id WHERE b.tracked_address_id = $1 ORDER BY a.kind, a.asset_ref`, trackedID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []StoredBalance
	for rows.Next() {
		var b StoredBalance
		if err := rows.Scan(&b.AssetRef, &b.Symbol, &b.Decimals, &b.Kind, &b.AmountRaw, &b.AsOfBlock, &b.SpamScore); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// TrackedID finds a tracked address id.
func (s *Store) TrackedID(ctx context.Context, chain, address string) (int64, error) {
	var id int64
	err := s.Pool.QueryRow(ctx, `SELECT id FROM tracked_addresses WHERE chain_id=$1 AND address=$2`, chain, strings.ToLower(address)).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	return id, err
}

// ---------- NFTs ----------

// NFTRow is one holding to store.
type NFTRow struct {
	AssetID int64
	TokenID string
	Amount  string
}

// ReplaceNFTs sets a tracked address's NFT holdings to exactly rows.
func (s *Store) ReplaceNFTs(ctx context.Context, trackedID int64, asOfBlock uint64, rows []NFTRow) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `CREATE TEMP TABLE nft_new (asset_id BIGINT, token_id NUMERIC(78,0), amount NUMERIC(78,0)) ON COMMIT DROP`); err != nil {
			return err
		}
		for _, r := range rows {
			if !validAmount(r.TokenID) || !validAmount(r.Amount) {
				continue
			}
			if _, err := tx.Exec(ctx, `INSERT INTO nft_new VALUES ($1, $2::numeric, $3::numeric)`, r.AssetID, r.TokenID, r.Amount); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `DELETE FROM nft_holdings h WHERE h.tracked_address_id = $1
			AND NOT EXISTS (SELECT 1 FROM nft_new n WHERE n.asset_id = h.asset_id AND n.token_id = h.token_id)`, trackedID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO nft_holdings (tracked_address_id, asset_id, token_id, amount, as_of_block)
			SELECT $1, asset_id, token_id, max(amount), $2 FROM nft_new GROUP BY asset_id, token_id
			ON CONFLICT (tracked_address_id, asset_id, token_id) DO UPDATE SET amount = EXCLUDED.amount, as_of_block = EXCLUDED.as_of_block`,
			trackedID, int64(asOfBlock))
		return err
	})
}
