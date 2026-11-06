// Package testdb gives each test package its own database so `go test ./...`
// can run packages in parallel against one Postgres.
package testdb

import (
	"context"
	"net/url"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
)

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
