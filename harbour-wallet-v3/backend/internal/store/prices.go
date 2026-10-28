package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// HeldAsset is a priceable asset someone holds.
type HeldAsset struct {
	AssetID  int64
	Chain    string
	Ref      string
	Kind     string
	Verified bool
	Holders  int
}

// HeldAssets lists native and fungible assets with a positive balance on a
// device-tracked address, excluding likely spam, most-held first.
func (s *Store) HeldAssets(ctx context.Context) ([]HeldAsset, error) {
	rows, err := s.Pool.Query(ctx, `SELECT a.id, a.chain_id, a.asset_ref, a.kind, a.verified, count(*)
		FROM balances b JOIN assets a ON a.id = b.asset_id JOIN tracked_addresses t ON t.id = b.tracked_address_id
		WHERE b.amount_raw > 0 AND a.kind IN ('native','token') AND a.spam_score < 50 AND t.device_count > 0
		GROUP BY a.id ORDER BY count(*) DESC, a.id`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (HeldAsset, error) {
		var h HeldAsset
		return h, r.Scan(&h.AssetID, &h.Chain, &h.Ref, &h.Kind, &h.Verified, &h.Holders)
	})
}

// Tick is one price observation for price_ticks.
type Tick struct {
	AssetID      int64
	At           time.Time
	PriceUSD     float64
	LiquidityUSD float64
}

// InsertTicks stores ticks in 5-minute buckets (one row per asset and bucket).
func (s *Store) InsertTicks(ctx context.Context, ticks []Tick) error {
	b := &pgx.Batch{}
	for _, t := range ticks {
		var liq any
		if t.LiquidityUSD > 0 {
			liq = t.LiquidityUSD
		}
		b.Queue(`INSERT INTO price_ticks (asset_id, ts, price_usd, liquidity_usd)
			VALUES ($1, to_timestamp(floor(extract(epoch FROM $2::timestamptz) / 300) * 300), $3, $4)
			ON CONFLICT (asset_id, ts) DO UPDATE SET price_usd = EXCLUDED.price_usd, liquidity_usd = EXCLUDED.liquidity_usd`,
			t.AssetID, t.At, t.PriceUSD, liq)
	}
	return s.Pool.SendBatch(ctx, b).Close()
}

// SnapshotBalances copies current balances into today's balance_snapshots
// (re-run during the day to keep the latest value).
func (s *Store) SnapshotBalances(ctx context.Context, day time.Time) (int64, error) {
	tag, err := s.Pool.Exec(ctx, `INSERT INTO balance_snapshots (tracked_address_id, day, asset_id, amount_raw)
		SELECT b.tracked_address_id, $1::date, b.asset_id, b.amount_raw FROM balances b
		JOIN assets a ON a.id = b.asset_id WHERE a.kind IN ('native','token')
		ON CONFLICT (tracked_address_id, day, asset_id) DO UPDATE SET amount_raw = EXCLUDED.amount_raw`, day.UTC().Format("2006-01-02"))
	return tag.RowsAffected(), err
}
