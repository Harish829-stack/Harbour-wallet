package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// ---------- webhooks ----------

// WebhookRow is a stored provider webhook.
type WebhookRow struct {
	ID           string
	Source       string
	Chain        string
	URL          string
	EncKey       []byte
	AddressCount int
}

// Webhooks lists webhooks for a source and chain.
func (s *Store) Webhooks(ctx context.Context, source, chain string) ([]WebhookRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, source, chain_id, url, enc_signing_key, address_count FROM webhooks
		WHERE source=$1 AND chain_id=$2 ORDER BY created_at`, source, chain)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []WebhookRow
	for rows.Next() {
		var w WebhookRow
		if err := rows.Scan(&w.ID, &w.Source, &w.Chain, &w.URL, &w.EncKey, &w.AddressCount); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// WebhookKey returns the encrypted signing key for a webhook id.
func (s *Store) WebhookKey(ctx context.Context, id string) ([]byte, error) {
	var k []byte
	err := s.Pool.QueryRow(ctx, `SELECT enc_signing_key FROM webhooks WHERE id=$1`, id).Scan(&k)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return k, err
}

// InsertWebhook records a newly created webhook and the addresses it was
// created with.
func (s *Store) InsertWebhook(ctx context.Context, w WebhookRow, trackedIDs []int64) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO webhooks (id, source, chain_id, url, enc_signing_key, address_count)
			VALUES ($1,$2,$3,$4,$5,$6)`, w.ID, w.Source, w.Chain, w.URL, w.EncKey, len(trackedIDs)); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE tracked_addresses SET webhook_id=$1 WHERE id = ANY($2)`, w.ID, trackedIDs)
		return err
	})
}

// DeleteWebhookRow forgets a webhook; its addresses become unsubscribed.
func (s *Store) DeleteWebhookRow(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM webhooks WHERE id=$1`, id)
	return err
}

// SubRow is an address to (un)subscribe.
type SubRow struct {
	ID        int64
	Address   string
	WebhookID string
}

// PendingSubscriptions returns tracked addresses that need a webhook.
func (s *Store) PendingSubscriptions(ctx context.Context, chain string, limit int) ([]SubRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, address FROM tracked_addresses
		WHERE chain_id=$1 AND webhook_id IS NULL AND device_count > 0 ORDER BY id LIMIT $2`, chain, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (SubRow, error) {
		var x SubRow
		return x, r.Scan(&x.ID, &x.Address)
	})
}

// PendingUnsubscriptions returns addresses no device tracks any more.
func (s *Store) PendingUnsubscriptions(ctx context.Context, chain string, limit int) ([]SubRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, address, webhook_id FROM tracked_addresses
		WHERE chain_id=$1 AND webhook_id IS NOT NULL AND device_count = 0 ORDER BY webhook_id, id LIMIT $2`, chain, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (SubRow, error) {
		var x SubRow
		return x, r.Scan(&x.ID, &x.Address, &x.WebhookID)
	})
}

// SetSubscribed records that ids are now delivered by webhookID (or none when "").
func (s *Store) SetSubscribed(ctx context.Context, webhookID string, ids []int64, subscribed bool) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if subscribed {
			tag, err := tx.Exec(ctx, `UPDATE tracked_addresses SET webhook_id=$1 WHERE id = ANY($2) AND webhook_id IS NULL`, webhookID, ids)
			if err != nil {
				return err
			}
			_, err = tx.Exec(ctx, `UPDATE webhooks SET address_count = address_count + $2 WHERE id=$1`, webhookID, tag.RowsAffected())
			return err
		}
		tag, err := tx.Exec(ctx, `UPDATE tracked_addresses SET webhook_id=NULL WHERE id = ANY($2) AND webhook_id=$1`, webhookID, ids)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE webhooks SET address_count = GREATEST(address_count - $2, 0) WHERE id=$1`, webhookID, tag.RowsAffected())
		return err
	})
}

// ---------- deliveries and heartbeats ----------

// InsertDelivery stores a raw delivery; false if it was already stored.
func (s *Store) InsertDelivery(ctx context.Context, source, deliveryID, webhookID, chain string, body []byte) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `INSERT INTO webhook_deliveries (source, delivery_id, webhook_id, chain_id, body)
		VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, source, deliveryID, webhookID, chain, body)
	return tag.RowsAffected() == 1, err
}

// PurgeDeliveries deletes deliveries older than age.
func (s *Store) PurgeDeliveries(ctx context.Context, age time.Duration) (int64, error) {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM webhook_deliveries WHERE received_at < now() - $1::interval`, fmt.Sprintf("%d seconds", int(age.Seconds())))
	return tag.RowsAffected(), err
}

// Heartbeat records a beat and returns the previous one (zero if none).
func (s *Store) Heartbeat(ctx context.Context, service string, now time.Time) (time.Time, error) {
	var prev *time.Time
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `SELECT last_beat FROM service_heartbeats WHERE service=$1 FOR UPDATE`, service).Scan(&prev); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO service_heartbeats (service, last_beat) VALUES ($1,$2)
			ON CONFLICT (service) DO UPDATE SET last_beat = EXCLUDED.last_beat`, service, now)
		return err
	})
	if err != nil || prev == nil {
		return time.Time{}, err
	}
	return *prev, nil
}

// ---------- gap-fill ----------

// GapRow is an address to gap-fill.
type GapRow struct {
	ID       int64
	Address  string
	LastSeen int64
}

// GapFillCandidates returns synced, device-tracked addresses: all of them, or
// those active (or added) within activeWithin plus any without a webhook.
func (s *Store) GapFillCandidates(ctx context.Context, chain string, activeWithin time.Duration, all bool, afterID int64, limit int) ([]GapRow, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, address, last_seen_block FROM tracked_addresses
		WHERE chain_id=$1 AND id > $5 AND device_count > 0 AND last_seen_block IS NOT NULL
		  AND backfill_state IN ('done','capped','skipped')
		  AND ($3 OR webhook_id IS NULL OR last_activity_at > now() - $2::interval OR created_at > now() - $2::interval)
		ORDER BY id LIMIT $4`, chain, fmt.Sprintf("%d seconds", int(activeWithin.Seconds())), all, limit, afterID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (GapRow, error) {
		var x GapRow
		return x, r.Scan(&x.ID, &x.Address, &x.LastSeen)
	})
}

// AdvanceLastSeen moves the "complete up to" block forward only.
func (s *Store) AdvanceLastSeen(ctx context.Context, id int64, block uint64) error {
	_, err := s.Pool.Exec(ctx, `UPDATE tracked_addresses SET last_seen_block = GREATEST(COALESCE(last_seen_block,0), $2) WHERE id=$1`, id, int64(block))
	return err
}

// TouchActivity marks addresses as recently active (gap-fill priority).
func (s *Store) TouchActivity(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := s.Pool.Exec(ctx, `UPDATE tracked_addresses SET last_activity_at = now() WHERE id = ANY($1)`, ids)
	return err
}

// ---------- reorgs and finality ----------

// EventKey identifies one stored event.
type EventKey struct {
	TxHash   string
	EventRef string
}

// RemoveEvents deletes events (and their dedupe keys, activity items and,
// when empty, the tx row). It returns tracked address ids whose balances must
// be refreshed, with the asset refs that moved.
func (s *Store) RemoveEvents(ctx context.Context, chain string, keys []EventKey) (map[int64]map[string]bool, error) {
	touched := map[int64]map[string]bool{}
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		for _, k := range keys {
			var asset string
			err := tx.QueryRow(ctx, `DELETE FROM transfers t USING assets a
				WHERE t.chain_id=$1 AND t.tx_hash=$2 AND t.event_ref=$3 AND a.id = t.asset_id RETURNING a.asset_ref`,
				chain, k.TxHash, k.EventRef).Scan(&asset)
			if errors.Is(err, pgx.ErrNoRows) {
				// Never stored (or already removed): drop the key so a re-include is accepted.
				if _, err := tx.Exec(ctx, `DELETE FROM event_keys WHERE chain_id=$1 AND tx_hash=$2 AND event_ref=$3`, chain, k.TxHash, k.EventRef); err != nil {
					return err
				}
				continue
			}
			if err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `DELETE FROM event_keys WHERE chain_id=$1 AND tx_hash=$2 AND event_ref=$3`, chain, k.TxHash, k.EventRef); err != nil {
				return err
			}
			rows, err := tx.Query(ctx, `UPDATE address_activity SET summary = jsonb_set(summary, '{transfers}',
					COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(summary->'transfers') e WHERE e->>'event_ref' <> $3), '[]'::jsonb))
				WHERE chain_id=$1 AND tx_hash=$2 RETURNING tracked_address_id`, chain, k.TxHash, k.EventRef)
			if err != nil {
				return err
			}
			ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
			if err != nil {
				return err
			}
			for _, id := range ids {
				if touched[id] == nil {
					touched[id] = map[string]bool{}
				}
				touched[id][asset] = true
			}
			if _, err := tx.Exec(ctx, `DELETE FROM address_activity WHERE chain_id=$1 AND tx_hash=$2
				AND jsonb_array_length(summary->'transfers') = 0`, chain, k.TxHash); err != nil {
				return err
			}
			var left bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM transfers WHERE chain_id=$1 AND tx_hash=$2)`, chain, k.TxHash).Scan(&left); err != nil {
				return err
			}
			if !left {
				if _, err := tx.Exec(ctx, `DELETE FROM transactions WHERE chain_id=$1 AND tx_hash=$2`, chain, k.TxHash); err != nil {
					return err
				}
				if _, err := tx.Exec(ctx, `DELETE FROM event_keys WHERE chain_id=$1 AND tx_hash=$2 AND event_ref='tx'`, chain, k.TxHash); err != nil {
					return err
				}
			}
		}
		return nil
	})
	return touched, err
}

// TxEventKeys lists the stored events of a transaction.
func (s *Store) TxEventKeys(ctx context.Context, chain, txHash string) ([]EventKey, error) {
	rows, err := s.Pool.Query(ctx, `SELECT tx_hash, event_ref FROM transfers WHERE chain_id=$1 AND tx_hash=$2`, chain, txHash)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (EventKey, error) {
		var k EventKey
		return k, r.Scan(&k.TxHash, &k.EventRef)
	})
}

// MarkFinalized promotes rows at or below finalized.
func (s *Store) MarkFinalized(ctx context.Context, chain string, finalized uint64) (int64, error) {
	var n int64
	for _, t := range []string{"transfers", "transactions"} {
		tag, err := s.Pool.Exec(ctx, `UPDATE `+t+` SET finality='finalized' WHERE chain_id=$1 AND finality <> 'finalized' AND block_number <= $2`,
			chain, int64(finalized))
		if err != nil {
			return n, err
		}
		n += tag.RowsAffected()
	}
	return n, nil
}

// UnfinalTx is a transaction not yet final.
type UnfinalTx struct {
	TxHash    string
	Block     int64
	BlockHash string
}

// UnfinalTxs lists distinct non-final transactions, oldest first.
func (s *Store) UnfinalTxs(ctx context.Context, chain string, limit int) ([]UnfinalTx, error) {
	rows, err := s.Pool.Query(ctx, `SELECT tx_hash, min(block_number), max(block_hash) FROM transfers
		WHERE chain_id=$1 AND finality <> 'finalized' GROUP BY tx_hash ORDER BY 2 LIMIT $2`, chain, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (UnfinalTx, error) {
		var x UnfinalTx
		return x, r.Scan(&x.TxHash, &x.Block, &x.BlockHash)
	})
}

// SetTxBlock records a transaction's (new) block after a check or reorg.
func (s *Store) SetTxBlock(ctx context.Context, chain, txHash string, block uint64, blockHash string) error {
	for _, t := range []string{"transfers", "transactions"} {
		if _, err := s.Pool.Exec(ctx, `UPDATE `+t+` SET block_number=$3, block_hash=$4 WHERE chain_id=$1 AND tx_hash=$2`,
			chain, txHash, int64(block), blockHash); err != nil {
			return err
		}
	}
	return nil
}

// WithLock runs f while holding a Postgres advisory lock named by key, so
// only one indexer replica manages a chain's webhooks at a time.
func (s *Store) WithLock(ctx context.Context, key string, f func() error) error {
	conn, err := s.Pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(hashtext($1))`, key); err != nil {
		return err
	}
	defer conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock(hashtext($1))`, key)
	return f()
}
