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
	// OldestBlock is the lowest block covered so far (for on-demand older pages).
	OldestBlock uint64
	// Capped is true when the backfill stopped at BackfillLimits rather than
	// at the start of the address's history.
	Capped bool
}

// BackfillLimits caps a backfill.
type BackfillLimits struct {
	MaxAge       time.Duration // 0 = no age limit
	MaxTransfers int           // 0 = no count limit
	// BeforeBlock > 0 fetches only history strictly older than this block
	// (on-demand older pages past the cap).
	BeforeBlock uint64
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
	Name string
	// Options are source-wide (key env vars, budgets).
	Options map[string]string
	// Chains holds per-chain options from chains.yaml (e.g. network name).
	Chains map[string]map[string]string
	// Getenv resolves secrets named in Options.
	Getenv func(string) string
}

// NFT is one NFT holding.
type NFT struct {
	Contract string
	TokenID  string // decimal
	Amount   string // decimal; 1 for ERC-721
	Standard string // erc721 | erc1155
	Name     string
	Symbol   string
	ImageURL string // source URL; the media proxy fetches it, never the extension
	Spam     bool
}

// NFTPage is one page of holdings.
type NFTPage struct {
	Items     []NFT
	Cursor    string
	AsOfBlock uint64
}

// Holdings is implemented by sources that can list what an address holds
// now. Token contracts are for discovery only: balances are always read from
// chain, never taken from this list.
type Holdings interface {
	TokenContracts(ctx context.Context, chain, address string) ([]string, error)
	NFTs(ctx context.Context, chain, address, cursor string) (NFTPage, error)
}

// Details keys sources may set on ActivityEvent.Details.
const (
	DetailSymbol   = "symbol"
	DetailDecimals = "decimals"
	DetailTokenID  = "token_id"
)

// SourceFactory constructs a Source.
type SourceFactory func(cfg SourceConfig) (Source, error)
