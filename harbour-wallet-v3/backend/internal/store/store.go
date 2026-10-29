// Package store is Harbour's Postgres access layer (pgx). Every query is a
// single indexed statement; no provider types appear here.
package store

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"harbour/backend/migrations"
)

// Store wraps a pgx pool.
type Store struct {
	Pool *pgxpool.Pool
}

// Open connects and pings.
func Open(ctx context.Context, url string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("store: parse url: %w", err)
	}
	cfg.MaxConnLifetime = 30 * time.Minute
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	pctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("store: ping: %w", err)
	}
	return &Store{Pool: pool}, nil
}

// Close closes the pool.
func (s *Store) Close() { s.Pool.Close() }

// Migrate applies embedded migrations not yet recorded, each in its own
// transaction, under an advisory lock so concurrent starts are safe.
func (s *Store) Migrate(ctx context.Context) ([]string, error) {
	conn, err := s.Pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(7263001)`); err != nil {
		return nil, err
	}
	defer conn.Exec(context.Background(), `SELECT pg_advisory_unlock(7263001)`)
	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return nil, err
	}
	names, err := fs.Glob(migrations.FS, "*.sql")
	if err != nil {
		return nil, err
	}
	sort.Strings(names)
	var applied []string
	for _, n := range names {
		v := strings.TrimSuffix(n, ".sql")
		var exists bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version=$1)`, v).Scan(&exists); err != nil {
			return applied, err
		}
		if exists {
			continue
		}
		sqlb, err := migrations.FS.ReadFile(n)
		if err != nil {
			return applied, err
		}
		err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, string(sqlb)); err != nil {
				return fmt.Errorf("migration %s: %w", n, err)
			}
			_, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, v)
			return err
		})
		if err != nil {
			return applied, err
		}
		applied = append(applied, v)
	}
	return applied, nil
}

// MaintainPartitions premakes monthly partitions (no-op for tables pg_partman owns).
func (s *Store) MaintainPartitions(ctx context.Context) error {
	for _, t := range []string{"transactions", "transfers"} {
		if _, err := s.Pool.Exec(ctx, `SELECT harbour_ensure_monthly_partitions($1, 1, 4)`, t); err != nil {
			return err
		}
	}
	// If pg_partman is installed, run its maintenance too.
	var hasPartman bool
	_ = s.Pool.QueryRow(ctx, `SELECT to_regclass('partman.part_config') IS NOT NULL`).Scan(&hasPartman)
	if hasPartman {
		_, err := s.Pool.Exec(ctx, `CALL partman.run_maintenance_proc()`)
		return err
	}
	return nil
}

// UpsertChains syncs the chains table from config.
func (s *Store) UpsertChains(ctx context.Context, chains map[string]string) error {
	b := &pgx.Batch{}
	for id, fam := range chains {
		b.Queue(`INSERT INTO chains (chain_id, family) VALUES ($1,$2)
		         ON CONFLICT (chain_id) DO UPDATE SET family=EXCLUDED.family, updated_at=now()`, id, fam)
	}
	return s.Pool.SendBatch(ctx, b).Close()
}

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("store: not found")

var roleName = regexp.MustCompile(`^[a-z_][a-z0-9_]{0,62}$`)

// EnsureAppLogin creates (or updates the password of) the LOGIN user the services connect as, a member of the
// harbour_app role from migration 0008. Run by cmd/migrate as the owner; the services never get owner rights.
func (s *Store) EnsureAppLogin(ctx context.Context, user, password string) error {
	if !roleName.MatchString(user) || len(password) < 16 {
		return errors.New("POSTGRES_APP_USER must be a plain lowercase name and POSTGRES_APP_PASSWORD at least 16 characters")
	}
	var current string
	if err := s.Pool.QueryRow(ctx, `SELECT current_user`).Scan(&current); err != nil {
		return err
	}
	if user == current {
		return errors.New("POSTGRES_APP_USER must differ from the migration (owner) user")
	}
	var qUser, qPass string
	if err := s.Pool.QueryRow(ctx, `SELECT quote_ident($1), quote_literal($2)`, user, password).Scan(&qUser, &qPass); err != nil {
		return err
	}
	var exists bool
	if err := s.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$1)`, user).Scan(&exists); err != nil {
		return err
	}
	verb := "CREATE"
	if exists {
		verb = "ALTER"
	}
	if _, err := s.Pool.Exec(ctx, fmt.Sprintf(`%s ROLE %s WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %s`, verb, qUser, qPass)); err != nil {
		return err
	}
	_, err := s.Pool.Exec(ctx, fmt.Sprintf(`GRANT harbour_app TO %s`, qUser))
	return err
}
