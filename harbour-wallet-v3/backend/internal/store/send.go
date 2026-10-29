package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ---------- pending transactions ----------

// InsertPending records a broadcast transaction (idempotent by hash).
func (s *Store) InsertPending(ctx context.Context, chain, hash, from string, nonce uint64, deviceID string) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO pending_transactions (chain_id, tx_hash, "from", nonce, device_id)
		VALUES ($1,$2,$3,$4,$5::uuid) ON CONFLICT (chain_id, tx_hash) DO NOTHING`, chain, hash, from, int64(nonce), deviceID)
	return err
}

// PendingRef identifies a pending transaction.
type PendingRef struct {
	Chain  string
	TxHash string
	From   string
	Nonce  int64
	Checks int
	At     time.Time
}

// DevicePending lists a device's still-pending transactions.
func (s *Store) DevicePending(ctx context.Context, deviceID string) ([]PendingRef, error) {
	rows, err := s.Pool.Query(ctx, `SELECT chain_id, tx_hash, "from", COALESCE(nonce,0)::bigint, checks, submitted_at FROM pending_transactions
		WHERE device_id=$1::uuid AND state='pending' ORDER BY submitted_at DESC LIMIT 50`, deviceID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanPending)
}

func scanPending(r pgx.CollectableRow) (PendingRef, error) {
	var p PendingRef
	return p, r.Scan(&p.Chain, &p.TxHash, &p.From, &p.Nonce, &p.Checks, &p.At)
}

// PrunePending drops the device link of transactions settled more than unlinkAfter ago (the notifier has used it by
// then) and deletes rows older than deleteAfter, so the table does not keep a lasting device -> sender address record.
func (s *Store) PrunePending(ctx context.Context, unlinkAfter, deleteAfter time.Duration) error {
	if _, err := s.Pool.Exec(ctx, `UPDATE pending_transactions SET device_id = NULL
		WHERE device_id IS NOT NULL AND state <> 'pending' AND updated_at < now() - $1::interval`, unlinkAfter.String()); err != nil {
		return err
	}
	_, err := s.Pool.Exec(ctx, `DELETE FROM pending_transactions WHERE state <> 'pending' AND submitted_at < now() - $1::interval`, deleteAfter.String())
	return err
}

// DuePending claims pending transactions whose next check is due.
func (s *Store) DuePending(ctx context.Context, limit int) ([]PendingRef, error) {
	rows, err := s.Pool.Query(ctx, `UPDATE pending_transactions p SET next_check_at = now() + interval '30 seconds'
		WHERE (chain_id, tx_hash) IN (SELECT chain_id, tx_hash FROM pending_transactions
			WHERE state='pending' AND next_check_at <= now() ORDER BY next_check_at LIMIT $1 FOR UPDATE SKIP LOCKED)
		RETURNING chain_id, tx_hash, "from", COALESCE(nonce,0)::bigint, checks, submitted_at`, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanPending)
}

// UpdatePending records a check result; next is when to look again.
func (s *Store) UpdatePending(ctx context.Context, chain, hash, state string, block uint64, next time.Duration) (bool, error) {
	var b any
	if block > 0 {
		b = int64(block)
	}
	tag, err := s.Pool.Exec(ctx, `UPDATE pending_transactions SET state=$3, block_number=COALESCE($4, block_number), checks = checks + 1,
		next_check_at = now() + $5::interval, updated_at = now() WHERE chain_id=$1 AND tx_hash=$2 AND state='pending'`,
		chain, hash, state, b, next.String())
	return tag.RowsAffected() == 1, err
}

// PendingDevice returns the device that broadcast a transaction ("" if none).
func (s *Store) PendingDevice(ctx context.Context, chain, hash string) (string, error) {
	var d *string
	err := s.Pool.QueryRow(ctx, `SELECT device_id::text FROM pending_transactions WHERE chain_id=$1 AND tx_hash=$2`, chain, hash).Scan(&d)
	if errors.Is(err, pgx.ErrNoRows) || d == nil {
		return "", nil
	}
	return *d, err
}

// ---------- push ----------

// PushSub is a Web Push subscription.
type PushSub struct {
	DeviceID string
	Channel  string
	Endpoint string
	P256dh   string
	Auth     string
}

// UpsertPushSub stores a device's subscription and replaces its routes.
func (s *Store) UpsertPushSub(ctx context.Context, p PushSub, routeTags [][]byte) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO push_subscriptions (device_id, channel, endpoint, p256dh, auth) VALUES ($1::uuid,$2,$3,$4,$5)
			ON CONFLICT (device_id) DO UPDATE SET channel=EXCLUDED.channel, endpoint=EXCLUDED.endpoint, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`,
			p.DeviceID, p.Channel, p.Endpoint, p.P256dh, p.Auth); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM push_routes WHERE device_id=$1::uuid`, p.DeviceID); err != nil {
			return err
		}
		for _, t := range routeTags {
			if _, err := tx.Exec(ctx, `INSERT INTO push_routes (route_tag, device_id) VALUES ($1,$2::uuid) ON CONFLICT DO NOTHING`, t, p.DeviceID); err != nil {
				return err
			}
		}
		return nil
	})
}

// DeletePushSub removes a device's subscription and routes.
func (s *Store) DeletePushSub(ctx context.Context, deviceID string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE device_id=$1::uuid`, deviceID)
	if err == nil {
		_, err = s.Pool.Exec(ctx, `DELETE FROM push_routes WHERE device_id=$1::uuid`, deviceID)
	}
	return err
}

// HasPushSub reports whether a device enabled push.
func (s *Store) HasPushSub(ctx context.Context, deviceID string) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM push_subscriptions WHERE device_id=$1::uuid)`, deviceID).Scan(&ok)
	return ok, err
}

// ReplaceRoutes sets a device's push routes to exactly tags.
func (s *Store) ReplaceRoutes(ctx context.Context, deviceID string, tags [][]byte) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM push_routes WHERE device_id=$1::uuid`, deviceID); err != nil {
			return err
		}
		for _, t := range tags {
			if _, err := tx.Exec(ctx, `INSERT INTO push_routes (route_tag, device_id) VALUES ($1,$2::uuid) ON CONFLICT DO NOTHING`, t, deviceID); err != nil {
				return err
			}
		}
		return nil
	})
}

// PushSubsForRoute returns subscriptions of devices routed to a tag.
func (s *Store) PushSubsForRoute(ctx context.Context, tag []byte) ([]PushSub, error) {
	rows, err := s.Pool.Query(ctx, `SELECT p.device_id::text, p.channel, p.endpoint, p.p256dh, p.auth FROM push_routes r
		JOIN push_subscriptions p ON p.device_id = r.device_id WHERE r.route_tag=$1`, tag)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanSub)
}

// PushSubForDevice returns one device's subscription.
func (s *Store) PushSubForDevice(ctx context.Context, deviceID string) (PushSub, error) {
	rows, err := s.Pool.Query(ctx, `SELECT device_id::text, channel, endpoint, p256dh, auth FROM push_subscriptions WHERE device_id=$1::uuid`, deviceID)
	if err != nil {
		return PushSub{}, err
	}
	subs, err := pgx.CollectRows(rows, scanSub)
	if err != nil || len(subs) == 0 {
		return PushSub{}, ErrNotFound
	}
	return subs[0], nil
}

func scanSub(r pgx.CollectableRow) (PushSub, error) {
	var p PushSub
	return p, r.Scan(&p.DeviceID, &p.Channel, &p.Endpoint, &p.P256dh, &p.Auth)
}

// AssetTrust is the stored verdict on an asset: spam score (contract checks, provider flags) and verified flag.
type AssetTrust struct {
	SpamScore int
	Verified  bool
}

// AssetTrust reads an asset's stored spam score and verified flag.
func (s *Store) AssetTrust(ctx context.Context, chain, ref string) (AssetTrust, error) {
	var t AssetTrust
	err := s.Pool.QueryRow(ctx, `SELECT spam_score, verified FROM assets WHERE chain_id=$1 AND asset_ref=$2`, chain, ref).Scan(&t.SpamScore, &t.Verified)
	if errors.Is(err, pgx.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}
