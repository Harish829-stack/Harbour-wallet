package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// Read-side queries for the extension (phase 5). Each is one indexed query.

// TrackedState is a tracked address's sync state.
type TrackedState struct {
	ID              int64
	Chain           string
	Address         string
	BackfillState   string
	SyncedTo        *int64
	HistoryFrom     *int64
	HistoryComplete bool
}

// TrackedStates loads several tracked addresses.
func (s *Store) TrackedStates(ctx context.Context, ids []int64) ([]TrackedState, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, chain_id, address, backfill_state, synced_to_block, history_from_block, history_complete
		FROM tracked_addresses WHERE id = ANY($1) ORDER BY chain_id, address`, ids)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (TrackedState, error) {
		var t TrackedState
		return t, r.Scan(&t.ID, &t.Chain, &t.Address, &t.BackfillState, &t.SyncedTo, &t.HistoryFrom, &t.HistoryComplete)
	})
}

// AssetRow is asset metadata.
type AssetRow struct {
	ID        int64
	Chain     string
	Ref       string
	Kind      string
	Symbol    *string
	Name      *string
	Decimals  *int
	LogoURL   *string
	SpamScore int
	Verified  bool
}

const assetCols = `a.id, a.chain_id, a.asset_ref, a.kind, a.symbol, a.name, a.decimals, a.logo_url, a.spam_score, a.verified`

func scanAsset(r pgx.Row, a *AssetRow, extra ...any) error {
	return r.Scan(append([]any{&a.ID, &a.Chain, &a.Ref, &a.Kind, &a.Symbol, &a.Name, &a.Decimals, &a.LogoURL, &a.SpamScore, &a.Verified}, extra...)...)
}

// HoldingRow is one balance with its asset.
type HoldingRow struct {
	TrackedID int64
	Asset     AssetRow
	AmountRaw string
	AsOfBlock int64
}

// Holdings returns non-zero balances (native always) for tracked ids.
func (s *Store) Holdings(ctx context.Context, ids []int64) ([]HoldingRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT b.tracked_address_id, b.amount_raw::text, b.as_of_block, `+assetCols+`
		FROM balances b JOIN assets a ON a.id = b.asset_id
		WHERE b.tracked_address_id = ANY($1) AND (b.amount_raw > 0 OR a.kind = 'native')
		ORDER BY b.tracked_address_id, a.kind, a.asset_ref`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []HoldingRow
	for rows.Next() {
		var h HoldingRow
		if err := rows.Scan(&h.TrackedID, &h.AmountRaw, &h.AsOfBlock, &h.Asset.ID, &h.Asset.Chain, &h.Asset.Ref, &h.Asset.Kind,
			&h.Asset.Symbol, &h.Asset.Name, &h.Asset.Decimals, &h.Asset.LogoURL, &h.Asset.SpamScore, &h.Asset.Verified); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

// ActivityCursor is a keyset position in the history.
type ActivityCursor struct {
	BlockTime time.Time `json:"t"`
	TxHash    string    `json:"h"`
	TrackedID int64     `json:"i"`
}

// ActivityRow is one history entry.
type ActivityRow struct {
	TrackedID int64
	Chain     string
	TxHash    string
	BlockTime time.Time
	Direction string
	Summary   []byte
}

// Activity returns history newest first after cursor (nil = from the top).
func (s *Store) Activity(ctx context.Context, ids []int64, after *ActivityCursor, limit int) ([]ActivityRow, error) {
	var rows pgx.Rows
	var err error
	q := `SELECT tracked_address_id, chain_id, tx_hash, block_time, direction, summary FROM address_activity
		WHERE tracked_address_id = ANY($1) %s ORDER BY block_time DESC, tx_hash DESC, tracked_address_id DESC LIMIT $2`
	if after == nil {
		rows, err = s.Pool.Query(ctx, sprintf(q, ""), ids, limit)
	} else {
		rows, err = s.Pool.Query(ctx, sprintf(q, "AND (block_time, tx_hash, tracked_address_id) < ($3, $4, $5)"),
			ids, limit, after.BlockTime, after.TxHash, after.TrackedID)
	}
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (ActivityRow, error) {
		var a ActivityRow
		return a, r.Scan(&a.TrackedID, &a.Chain, &a.TxHash, &a.BlockTime, &a.Direction, &a.Summary)
	})
}

// AssetsByRef loads assets for (chain, ref) pairs.
func (s *Store) AssetsByRef(ctx context.Context, chains, refs []string) ([]AssetRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+assetCols+` FROM assets a
		JOIN unnest($1::text[], $2::text[]) AS q(chain_id, asset_ref) ON q.chain_id = a.chain_id AND q.asset_ref = a.asset_ref`, chains, refs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AssetRow
	for rows.Next() {
		var a AssetRow
		if err := scanAsset(rows, &a); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Asset loads one asset.
func (s *Store) Asset(ctx context.Context, chain, ref string) (AssetRow, error) {
	var a AssetRow
	err := scanAsset(s.Pool.QueryRow(ctx, `SELECT `+assetCols+` FROM assets a WHERE a.chain_id=$1 AND a.asset_ref=$2`, chain, ref), &a)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// TxFinality returns finality and status for tx hashes on a chain.
func (s *Store) TxFinality(ctx context.Context, chain string, hashes []string) (map[string]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT tx_hash, finality FROM transactions WHERE chain_id=$1 AND tx_hash = ANY($2)`, chain, hashes)
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for rows.Next() {
		var h, f string
		if err := rows.Scan(&h, &f); err != nil {
			rows.Close()
			return nil, err
		}
		out[h] = f
	}
	rows.Close()
	return out, rows.Err()
}

// NFTItem is one NFT holding.
type NFTItem struct {
	TrackedID int64
	Asset     AssetRow
	TokenID   string
	Amount    string
	Name      *string
	MediaKey  *string
}

// NFTs lists NFT holdings.
func (s *Store) NFTs(ctx context.Context, ids []int64) ([]NFTItem, error) {
	rows, err := s.Pool.Query(ctx, `SELECT n.tracked_address_id, n.token_id::text, n.amount::text, n.name, n.media_key, `+assetCols+`
		FROM nft_holdings n JOIN assets a ON a.id = n.asset_id WHERE n.tracked_address_id = ANY($1)
		ORDER BY a.spam_score, a.asset_ref, n.token_id`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []NFTItem
	for rows.Next() {
		var n NFTItem
		if err := rows.Scan(&n.TrackedID, &n.TokenID, &n.Amount, &n.Name, &n.MediaKey, &n.Asset.ID, &n.Asset.Chain, &n.Asset.Ref,
			&n.Asset.Kind, &n.Asset.Symbol, &n.Asset.Name, &n.Asset.Decimals, &n.Asset.LogoURL, &n.Asset.SpamScore, &n.Asset.Verified); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// MediaSource returns the source URL behind a media key.
func (s *Store) MediaSource(ctx context.Context, key string) (string, error) {
	var src string
	err := s.Pool.QueryRow(ctx, `SELECT image_src FROM nft_holdings WHERE media_key=$1 AND image_src IS NOT NULL LIMIT 1`, key).Scan(&src)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return src, err
}

// ChartPoint is one day of portfolio value.
type ChartPoint struct {
	Day      time.Time
	ValueUSD float64
}

// Chart values each day's snapshot with the last price at or before that day's
// end. Spam and thin-priced assets (no liquidity tick) are excluded.
func (s *Store) Chart(ctx context.Context, ids []int64, from time.Time, minLiq float64) ([]ChartPoint, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT s.day, COALESCE(sum(s.amount_raw / power(10::numeric, a.decimals) * p.price_usd), 0)::float8
		FROM balance_snapshots s
		JOIN assets a ON a.id = s.asset_id AND a.decimals IS NOT NULL AND a.spam_score < 50
		LEFT JOIN LATERAL (
			SELECT pt.price_usd FROM price_ticks pt
			WHERE pt.asset_id = s.asset_id AND pt.ts < s.day + 1
			  AND (pt.liquidity_usd IS NULL AND (a.kind = 'native' OR a.verified) OR pt.liquidity_usd >= $3)
			ORDER BY pt.ts DESC LIMIT 1) p ON true
		WHERE s.tracked_address_id = ANY($1) AND s.day >= $2::date
		GROUP BY s.day ORDER BY s.day`, ids, from.UTC().Format("2006-01-02"), minLiq)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (ChartPoint, error) {
		var c ChartPoint
		return c, r.Scan(&c.Day, &c.ValueUSD)
	})
}

// PricePoint is one bucket of a price series.
type PricePoint struct {
	At       time.Time
	PriceUSD float64
}

// PriceSeries returns the last price in each bucket ("minute"-sized 5m ticks
// are stored; bucket is a date_trunc unit: hour or day).
func (s *Store) PriceSeries(ctx context.Context, assetID int64, from time.Time, bucket string) ([]PricePoint, error) {
	if bucket != "hour" && bucket != "day" && bucket != "minute" {
		return nil, errors.New("bad bucket")
	}
	rows, err := s.Pool.Query(ctx, `SELECT date_trunc($3, ts) b, (array_agg(price_usd ORDER BY ts DESC))[1]::float8
		FROM price_ticks WHERE asset_id=$1 AND ts >= $2 GROUP BY b ORDER BY b`, assetID, from, bucket)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (PricePoint, error) {
		var p PricePoint
		return p, r.Scan(&p.At, &p.PriceUSD)
	})
}

// TxRow is a stored transaction with its transfers.
type TxRow struct {
	Chain       string
	TxHash      string
	BlockNumber int64
	BlockTime   time.Time
	From, To    *string
	Finality    string
	Transfers   []TxTransfer
}

// TxTransfer is one transfer inside a transaction.
type TxTransfer struct {
	EventRef  string
	Asset     AssetRow
	From, To  *string
	AmountRaw string
	Kind      string
}

// Tx loads a stored transaction (ErrNotFound if unknown).
func (s *Store) Tx(ctx context.Context, chain, hash string) (TxRow, error) {
	var t TxRow
	err := s.Pool.QueryRow(ctx, `SELECT chain_id, tx_hash, block_number, block_time, "from", "to", finality
		FROM transactions WHERE chain_id=$1 AND tx_hash=$2`, chain, hash).
		Scan(&t.Chain, &t.TxHash, &t.BlockNumber, &t.BlockTime, &t.From, &t.To, &t.Finality)
	if errors.Is(err, pgx.ErrNoRows) {
		return t, ErrNotFound
	}
	if err != nil {
		return t, err
	}
	rows, err := s.Pool.Query(ctx, `SELECT t.event_ref, t."from", t."to", t.amount_raw::text, t.kind, `+assetCols+`
		FROM transfers t JOIN assets a ON a.id = t.asset_id WHERE t.chain_id=$1 AND t.tx_hash=$2 ORDER BY t.event_ref`, chain, hash)
	if err != nil {
		return t, err
	}
	defer rows.Close()
	for rows.Next() {
		var x TxTransfer
		if err := rows.Scan(&x.EventRef, &x.From, &x.To, &x.AmountRaw, &x.Kind, &x.Asset.ID, &x.Asset.Chain, &x.Asset.Ref, &x.Asset.Kind,
			&x.Asset.Symbol, &x.Asset.Name, &x.Asset.Decimals, &x.Asset.LogoURL, &x.Asset.SpamScore, &x.Asset.Verified); err != nil {
			return t, err
		}
		t.Transfers = append(t.Transfers, x)
	}
	return t, rows.Err()
}

// PendingTx is a submitted transaction not yet indexed.
type PendingTx struct {
	From        string
	Nonce       *string
	SubmittedAt time.Time
	State       string
}

// Pending loads a pending transaction (ErrNotFound if unknown).
func (s *Store) Pending(ctx context.Context, chain, hash string) (PendingTx, error) {
	var p PendingTx
	err := s.Pool.QueryRow(ctx, `SELECT "from", nonce::text, submitted_at, state FROM pending_transactions WHERE chain_id=$1 AND tx_hash=$2`,
		chain, hash).Scan(&p.From, &p.Nonce, &p.SubmittedAt, &p.State)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, ErrNotFound
	}
	return p, err
}

func sprintf(q, cond string) string { return fmt.Sprintf(q, cond) }
