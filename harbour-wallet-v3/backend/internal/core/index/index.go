// Package index defines the indexer source interface and the one event format
// every source emits. The indexer, store and API never see provider payloads.
package index

import (
	"context"
	"encoding/json"
	"time"
)

// Kind of transfer.
type Kind string

const (
	KindNative   Kind = "native"
	KindInternal Kind = "internal"
	KindToken    Kind = "token" // fungible (ERC-20, SPL, TRC-20 ...)
	KindNFT      Kind = "nft"   // non-fungible (ERC-721 ...)
	KindMulti    Kind = "multi" // semi-fungible (ERC-1155 ...)
)

// ActivityEvent is the only shape the indexer consumes.
type ActivityEvent struct {
	Chain       string          `json:"chain"`
	Family      string          `json:"family"`
	TxHash      string          `json:"tx_hash"`
	EventRef    string          `json:"event_ref"` // "log:12", "trace:0.1", "vout:3"
	BlockNumber uint64          `json:"block_number"`
	BlockHash   string          `json:"block_hash"`
	BlockTime   time.Time       `json:"block_time"`
	From        string          `json:"from"`
	To          string          `json:"to"`
	Asset       string          `json:"asset"` // asset_ref: contract, mint or "native"
	AmountRaw   string          `json:"amount_raw"`
	Kind        Kind            `json:"kind"`
	Removed     bool            `json:"removed"`
	Details     json.RawMessage `json:"details,omitempty"`
}

// Handler receives events from a live subscription.
type Handler func(ctx context.Context, ev ActivityEvent) error

// Page is one page of historical events.
type Page struct {
	Events []ActivityEvent
	// Cursor resumes the backfill; empty when done.
	Cursor string
	// LastBlock is the highest block covered, persisted because provider
	// cursors expire.
	LastBlock uint64
}

// BackfillLimits caps a first-time backfill.
type BackfillLimits struct {
	MaxAge       time.Duration
	MaxTransfers int
}

// Source is an indexer source (a provider stream, an own node ...).
type Source interface {
	Name() string
	// Subscribe starts live delivery of events touching the given addresses.
	// Sources fed by webhooks implement it by accepting decoded payloads
	// from webhook-ingest.
	Subscribe(ctx context.Context, chain string, addresses []string, h Handler) error
	// Backfill returns history for one address, newest first, resuming at cursor.
	Backfill(ctx context.Context, chain, address, cursor string, lim BackfillLimits) (Page, error)
	// Since returns events after fromBlock (gap-fill).
	Since(ctx context.Context, chain, address string, fromBlock uint64, cursor string) (Page, error)
}

// SourceConfig is passed to a SourceFactory.
type SourceConfig struct {
	Name    string
	Options map[string]string
}

// SourceFactory constructs a Source.
type SourceFactory func(cfg SourceConfig) (Source, error)
