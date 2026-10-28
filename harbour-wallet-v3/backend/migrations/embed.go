// Package migrations embeds the SQL migrations applied by cmd/migrate.
package migrations

import "embed"

// FS holds NNNN_name.sql files, applied in lexical order.
//
//go:embed *.sql
var FS embed.FS
