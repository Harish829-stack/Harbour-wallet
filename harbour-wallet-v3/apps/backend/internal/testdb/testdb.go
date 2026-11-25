// Package testdb gives each test package its own database so `go test ./...`
// can run packages in parallel against one Postgres.
package testdb

import (
	"context"
	"net/url"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
)

// RoleLockKey is a Postgres advisory lock that guards cluster-wide roles (harbour_app). Every test process that creates databases
// (and so runs migrations that create the role) holds it SHARED for its lifetime; a test that must change those roles
// (cmd/migrate's missing-role test) takes it EXCLUSIVE, so it never races with other packages of a parallel `go test ./...`.
const RoleLockKey int64 = 0x48425f524f4c45 // "HB_ROLE"

var shared sync.Once

func holdRoleLockShared(t *testing.T, base string) {
	shared.Do(func() {
		conn, err := pgx.Connect(context.Background(), base)
		if err != nil {
			t.Fatal(err)
		}
		// Kept open (not closed) until the test process exits: the shared lock lives as long as the connection.
		if _, err := conn.Exec(context.Background(), "SELECT pg_advisory_lock_shared($1)", RoleLockKey); err != nil {
			t.Fatal(err)
		}
	})
}

// URL returns a URL for a fresh, empty database named <base>_<name>, or
// skips the test when HB_TEST_POSTGRES_URL is unset.
func URL(t *testing.T, name string) string {
	t.Helper()
	base := os.Getenv("HB_TEST_POSTGRES_URL")
	if base == "" {
		t.Skip("HB_TEST_POSTGRES_URL not set")
	}
	u, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	holdRoleLockShared(t, base)
	db := u.Path[1:] + "_" + name
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	if _, err := conn.Exec(ctx, "DROP DATABASE IF EXISTS "+pgx.Identifier{db}.Sanitize()+" WITH (FORCE)"); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{db}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + db
	return u.String()
}
