package store

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Device is a registered extension install.
type Device struct {
	ID         string
	PublicKey  []byte
	QuotaTier  string
	CreatedAt  time.Time
	LastSeenAt time.Time
	RevokedAt  *time.Time
}

// ErrDuplicateKey is returned when a public key is already registered.
var ErrDuplicateKey = errors.New("store: public key already registered")

// CreateDevice inserts a device.
func (s *Store) CreateDevice(ctx context.Context, pub []byte, tier string, attestation []byte) (Device, error) {
	var d Device
	var att any
	if len(attestation) > 0 {
		att = attestation
	}
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO devices (public_key, quota_tier, attestation) VALUES ($1, $2, $3)
		RETURNING id::text, public_key, quota_tier, created_at, last_seen_at, revoked_at`,
		pub, tier, att).Scan(&d.ID, &d.PublicKey, &d.QuotaTier, &d.CreatedAt, &d.LastSeenAt, &d.RevokedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return d, ErrDuplicateKey
	}
	return d, err
}

// GetDevice loads a device by id.
func (s *Store) GetDevice(ctx context.Context, id string) (Device, error) {
	var d Device
	err := s.Pool.QueryRow(ctx, `
		SELECT id::text, public_key, quota_tier, created_at, last_seen_at, revoked_at
		FROM devices WHERE id = $1::uuid`, id).
		Scan(&d.ID, &d.PublicKey, &d.QuotaTier, &d.CreatedAt, &d.LastSeenAt, &d.RevokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return d, ErrNotFound
	}
	return d, err
}

// TouchDevice updates last_seen_at at most once a minute.
func (s *Store) TouchDevice(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE devices SET last_seen_at = now()
		WHERE id = $1::uuid AND last_seen_at < now() - interval '1 minute'`, id)
	return err
}

// LinkCrypto encrypts device -> tracked address links.
type LinkCrypto struct {
	aead     cipher.AEAD
	hmacKey  []byte
	routeKey []byte
}

// RouteTag is the push-route index for a tracked address (keyed, so the
// push_routes table alone can't be joined to addresses).
// DeviceTag is an opaque, keyed stand-in for a device id in Redis keys (HW-2026-020): a Redis dump or MONITOR no longer
// shows which device sent which transaction or idempotent request. Stable per device so dedupe/replay still work.
func (c *LinkCrypto) DeviceTag(deviceID string) string {
	m := hmac.New(sha256.New, c.hmacKey)
	m.Write([]byte("hb-redis-device-tag\x00"))
	m.Write([]byte(deviceID))
	return hex.EncodeToString(m.Sum(nil)[:16])
}

// KeyTag hashes a client-chosen key (an Idempotency-Key can embed transaction bytes) under the same secret.
func (c *LinkCrypto) KeyTag(key string) string {
	m := hmac.New(sha256.New, c.hmacKey)
	m.Write([]byte("hb-redis-key-tag\x00"))
	m.Write([]byte(key))
	return hex.EncodeToString(m.Sum(nil)[:16])
}

func (c *LinkCrypto) RouteTag(trackedID int64) []byte {
	m := hmac.New(sha256.New, c.routeKey)
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], uint64(trackedID))
	m.Write(b[:])
	return m.Sum(nil)
}

// NewLinkCrypto derives an AES-256-GCM key and an HMAC key from one secret.
func NewLinkCrypto(secret []byte) (*LinkCrypto, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("address link key must be at least 32 bytes")
	}
	derive := func(label string) []byte {
		m := hmac.New(sha256.New, secret)
		m.Write([]byte(label))
		return m.Sum(nil)
	}
	block, err := aes.NewCipher(derive("harbour/device_addresses/enc"))
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &LinkCrypto{aead: aead, hmacKey: derive("harbour/device_addresses/idx"), routeKey: derive("harbour/push_routes/idx")}, nil
}

func (c *LinkCrypto) linkHash(deviceID string, trackedID int64) []byte {
	m := hmac.New(sha256.New, c.hmacKey)
	m.Write([]byte(deviceID))
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], uint64(trackedID))
	m.Write(b[:])
	return m.Sum(nil)
}

func (c *LinkCrypto) seal(deviceID string, trackedID int64) ([]byte, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], uint64(trackedID))
	return c.aead.Seal(nonce, nonce, b[:], []byte(deviceID)), nil
}

func (c *LinkCrypto) open(deviceID string, blob []byte) (int64, error) {
	ns := c.aead.NonceSize()
	if len(blob) < ns {
		return 0, errors.New("short ciphertext")
	}
	pt, err := c.aead.Open(nil, blob[:ns], blob[ns:], []byte(deviceID))
	if err != nil || len(pt) != 8 {
		return 0, fmt.Errorf("decrypt link: %w", err)
	}
	return int64(binary.BigEndian.Uint64(pt)), nil
}

// TrackedAddress is a (chain, address) the indexer follows.
type TrackedAddress struct {
	ID            int64
	Chain         string
	Address       string
	BackfillState string
	DenyBackfill  bool
	SyncedTo      *int64
}

// AddressRef identifies an address on a chain.
type AddressRef struct {
	Chain   string `json:"chain"`
	Address string `json:"address"`
}

// ErrQuota is returned when a device would exceed its address quota.
var ErrQuota = errors.New("store: address quota exceeded")

// AddDeviceAddresses links addresses to a device within maxAddresses.
// It returns the tracked rows and which of them were newly tracked by
// anyone (callers publish address.added for those).
func (s *Store) AddDeviceAddresses(ctx context.Context, lc *LinkCrypto, deviceID string, refs []AddressRef, deny map[string]bool, maxAddresses int) (rows []TrackedAddress, created []TrackedAddress, err error) {
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		// Serialize quota checks per device.
		if _, err := tx.Exec(ctx, `SELECT 1 FROM devices WHERE id=$1::uuid FOR UPDATE`, deviceID); err != nil {
			return err
		}
		var count int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM device_addresses WHERE device_id=$1::uuid`, deviceID).Scan(&count); err != nil {
			return err
		}
		for _, r := range refs {
			var t TrackedAddress
			var inserted bool
			err := tx.QueryRow(ctx, `
				INSERT INTO tracked_addresses (chain_id, address, deny_backfill, backfill_state)
				VALUES ($1, $2, $3, CASE WHEN $3 THEN 'skipped' ELSE 'pending' END)
				ON CONFLICT (chain_id, address) DO UPDATE SET chain_id = EXCLUDED.chain_id
				RETURNING id, chain_id, address, backfill_state, deny_backfill, synced_to_block, (xmax = 0)`,
				r.Chain, r.Address, deny[r.Address]).
				Scan(&t.ID, &t.Chain, &t.Address, &t.BackfillState, &t.DenyBackfill, &t.SyncedTo, &inserted)
			if err != nil {
				return err
			}
			h := lc.linkHash(deviceID, t.ID)
			enc, err := lc.seal(deviceID, t.ID)
			if err != nil {
				return err
			}
			tag, err := tx.Exec(ctx, `INSERT INTO device_addresses (link_hash, device_id, enc_tracked_ref)
				VALUES ($1, $2::uuid, $3) ON CONFLICT (link_hash) DO NOTHING`, h, deviceID, enc)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 1 {
				if _, err := tx.Exec(ctx, `UPDATE tracked_addresses SET device_count = device_count + 1 WHERE id = $1`, t.ID); err != nil {
					return err
				}
				count++
				if count > maxAddresses {
					return ErrQuota
				}
			}
			rows = append(rows, t)
			if inserted {
				created = append(created, t)
			}
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return rows, created, nil
}

// RemoveDeviceAddresses unlinks addresses from a device. Tracked rows stay
// (other devices may track them); a sweeper can drop orphans later.
func (s *Store) RemoveDeviceAddresses(ctx context.Context, lc *LinkCrypto, deviceID string, refs []AddressRef) (int, error) {
	removed := 0
	for _, r := range refs {
		var id int64
		err := s.Pool.QueryRow(ctx, `SELECT id FROM tracked_addresses WHERE chain_id=$1 AND address=$2`, r.Chain, r.Address).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return removed, err
		}
		err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
			tag, err := tx.Exec(ctx, `DELETE FROM device_addresses WHERE link_hash=$1`, lc.linkHash(deviceID, id))
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 1 {
				removed++
				_, err = tx.Exec(ctx, `UPDATE tracked_addresses SET device_count = GREATEST(device_count - 1, 0) WHERE id = $1`, id)
			}
			return err
		})
		if err != nil {
			return removed, err
		}
	}
	return removed, nil
}

// DeviceAddresses lists a device's tracked addresses (decrypting links).
func (s *Store) DeviceAddresses(ctx context.Context, lc *LinkCrypto, deviceID string) ([]TrackedAddress, error) {
	rows, err := s.Pool.Query(ctx, `SELECT enc_tracked_ref FROM device_addresses WHERE device_id=$1::uuid`, deviceID)
	if err != nil {
		return nil, err
	}
	var ids []int64
	for rows.Next() {
		var blob []byte
		if err := rows.Scan(&blob); err != nil {
			rows.Close()
			return nil, err
		}
		id, err := lc.open(deviceID, blob)
		if err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []TrackedAddress{}, nil
	}
	rows, err = s.Pool.Query(ctx, `SELECT id, chain_id, address, backfill_state, deny_backfill, synced_to_block
		FROM tracked_addresses WHERE id = ANY($1) ORDER BY chain_id, address`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TrackedAddress{}
	for rows.Next() {
		var t TrackedAddress
		if err := rows.Scan(&t.ID, &t.Chain, &t.Address, &t.BackfillState, &t.DenyBackfill, &t.SyncedTo); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// DeviceOwns reports whether every (chain,address) is linked to the device.
func (s *Store) DeviceOwns(ctx context.Context, lc *LinkCrypto, deviceID string, refs []AddressRef) (bool, error) {
	for _, r := range refs {
		var id int64
		err := s.Pool.QueryRow(ctx, `SELECT id FROM tracked_addresses WHERE chain_id=$1 AND address=$2`, r.Chain, r.Address).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		var ok bool
		if err := s.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM device_addresses WHERE link_hash=$1)`, lc.linkHash(deviceID, id)).Scan(&ok); err != nil {
			return false, err
		}
		if !ok {
			return false, nil
		}
	}
	return true, nil
}

// CountUntracked returns how many refs nobody tracks yet (each would start a backfill).
func (s *Store) CountUntracked(ctx context.Context, refs []AddressRef, deny map[string]bool) (int, error) {
	n := 0
	for _, r := range refs {
		if deny[r.Address] {
			continue
		}
		var exists bool
		if err := s.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM tracked_addresses WHERE chain_id=$1 AND address=$2)`, r.Chain, r.Address).Scan(&exists); err != nil {
			return 0, err
		}
		if !exists {
			n++
		}
	}
	return n, nil
}

// SecretBox encrypts small secrets at rest (e.g. webhook signing keys).
type SecretBox struct{ aead cipher.AEAD }

// NewSecretBox derives a key for label from the server secret.
func NewSecretBox(secret []byte, label string) (*SecretBox, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("secret must be at least 32 bytes")
	}
	m := hmac.New(sha256.New, secret)
	m.Write([]byte("harbour/" + label))
	block, err := aes.NewCipher(m.Sum(nil))
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &SecretBox{aead: aead}, nil
}

// Seal encrypts plaintext (nonce || ciphertext).
func (b *SecretBox) Seal(plain string) ([]byte, error) {
	nonce := make([]byte, b.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return b.aead.Seal(nonce, nonce, []byte(plain), nil), nil
}

// Open decrypts a Seal output.
func (b *SecretBox) Open(blob []byte) (string, error) {
	ns := b.aead.NonceSize()
	if len(blob) < ns {
		return "", errors.New("short ciphertext")
	}
	pt, err := b.aead.Open(nil, blob[:ns], blob[ns:], nil)
	return string(pt), err
}
