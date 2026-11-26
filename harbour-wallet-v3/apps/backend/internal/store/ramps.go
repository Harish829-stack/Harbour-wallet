package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// ---------- fiat ramp orders (migration 0011) ----------

// RampOrder is one checkout Harbour opened with Onramper.
type RampOrder struct {
	ID            string
	DeviceID      string
	Type          string
	Status        string
	Provider      string
	PaymentMethod string
	Chain         string
	Crypto        string
	Fiat          string
	FiatAmount    *float64
	CryptoAmount  *float64
	Session       string
	OnramperTxID  string
	ProviderTxID  string
	TxHash        string
	StatusReason  string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// InsertRampOrder records a new order in status "created".
func (s *Store) InsertRampOrder(ctx context.Context, o RampOrder) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO ramp_orders (id, device_id, type, provider, payment_method, chain, crypto, fiat, fiat_amount, crypto_amount)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)`,
		o.ID, o.DeviceID, o.Type, o.Provider, o.PaymentMethod, o.Chain, o.Crypto, o.Fiat, o.FiatAmount, o.CryptoAmount)
	return err
}

// SetRampOrderSession stores the Onramper session id once the checkout intent exists.
func (s *Store) SetRampOrderSession(ctx context.Context, id, session string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE ramp_orders SET onramper_session=$2, updated_at=now() WHERE id=$1::uuid`, id, session)
	return err
}

// DeleteRampOrder removes an order whose checkout could not be created (nothing was opened for the user).
func (s *Store) DeleteRampOrder(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM ramp_orders WHERE id=$1::uuid AND status='created' AND onramper_session IS NULL`, id)
	return err
}

// CountRecentRampOrders counts a device's orders since t (abuse bound on checkout creation).
func (s *Store) CountRecentRampOrders(ctx context.Context, deviceID string, since time.Time) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM ramp_orders WHERE device_id=$1::uuid AND created_at >= $2`, deviceID, since).Scan(&n)
	return n, err
}

const rampCols = `id::text, device_id::text, type, status, provider, payment_method, chain, crypto, fiat, fiat_amount::float8, crypto_amount::float8,
	COALESCE(onramper_session,''), COALESCE(onramper_tx_id,''), COALESCE(provider_tx_id,''), COALESCE(tx_hash,''), COALESCE(status_reason,''), created_at, updated_at`

func scanRamp(r pgx.CollectableRow) (RampOrder, error) {
	var o RampOrder
	err := r.Scan(&o.ID, &o.DeviceID, &o.Type, &o.Status, &o.Provider, &o.PaymentMethod, &o.Chain, &o.Crypto, &o.Fiat, &o.FiatAmount, &o.CryptoAmount,
		&o.Session, &o.OnramperTxID, &o.ProviderTxID, &o.TxHash, &o.StatusReason, &o.CreatedAt, &o.UpdatedAt)
	return o, err
}

// DeviceRampOrders lists a device's newest orders. Orders still in "created" after a day are left out: the user closed the
// provider page without ordering, and Onramper will never report on them.
func (s *Store) DeviceRampOrders(ctx context.Context, deviceID string, limit int) ([]RampOrder, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.Pool.Query(ctx, `SELECT `+rampCols+` FROM ramp_orders
		WHERE device_id=$1::uuid AND (status <> 'created' OR created_at > now() - interval '1 day')
		ORDER BY created_at DESC LIMIT $2`, deviceID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanRamp)
}

// RampUpdate is a status change reported by Onramper.
type RampUpdate struct {
	OrderID      string // partnerContext
	Status       string // Harbour status
	StatusAt     time.Time
	Reason       string
	OnramperTxID string
	ProviderTxID string
	TxHash       string
	FiatAmount   *float64
	CryptoAmount *float64
}

// ApplyRampUpdate moves an order forward. Deliveries can arrive late or twice: an update older than the last applied
// one is ignored, and a terminal status is never left. Returns ErrNotFound for an unknown order id.
func (s *Store) ApplyRampUpdate(ctx context.Context, u RampUpdate) (bool, error) {
	if !IsUUID(u.OrderID) {
		return false, ErrNotFound
	}
	tag, err := s.Pool.Exec(ctx, `UPDATE ramp_orders SET
			status = $2, status_at = $3, status_reason = NULLIF($4,''),
			onramper_tx_id = COALESCE(NULLIF($5,''), onramper_tx_id), provider_tx_id = COALESCE(NULLIF($6,''), provider_tx_id),
			tx_hash = COALESCE(NULLIF($7,''), tx_hash), fiat_amount = COALESCE($8, fiat_amount), crypto_amount = COALESCE($9, crypto_amount),
			updated_at = now()
		WHERE id = $1::uuid
		  AND status NOT IN ('completed', 'canceled', 'failed')
		  AND (status_at IS NULL OR status_at <= $3)`,
		u.OrderID, u.Status, u.StatusAt, u.Reason, u.OnramperTxID, u.ProviderTxID, u.TxHash, u.FiatAmount, u.CryptoAmount)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() > 0 {
		return true, nil
	}
	var exists bool
	if err := s.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM ramp_orders WHERE id=$1::uuid)`, u.OrderID).Scan(&exists); err != nil {
		return false, err
	}
	if !exists {
		return false, ErrNotFound
	}
	return false, nil // stale or after a terminal status
}

// IsUUID reports whether s looks like a UUID (guards ::uuid casts on attacker-controlled ids).
func IsUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		switch i {
		case 8, 13, 18, 23:
			if c != '-' {
				return false
			}
		default:
			if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F') {
				return false
			}
		}
	}
	return true
}
