// Package price defines price sources, polled by price-poller (never per request).
package price

import (
	"context"
	"time"
)

// AssetKey identifies an asset to price.
type AssetKey struct {
	Chain    string
	AssetRef string
	// ExternalID is the source's own id for native coins (chains.yaml native.price_ids).
	ExternalID string
}

// Quote is one price observation.
type Quote struct {
	Asset        AssetKey
	PriceUSD     float64
	LiquidityUSD float64 // 0 if unknown; 24h volume or pool reserves, per source
	At           time.Time
}

// Source fetches current prices for many assets at once.
type Source interface {
	Name() string
	Quotes(ctx context.Context, assets []AssetKey) ([]Quote, error)
}

// SourceConfig is passed to a SourceFactory.
type SourceConfig struct {
	Name    string
	Options map[string]string
	// Chains holds per-chain options from chains.yaml "prices:" (platform ids ...).
	Chains map[string]map[string]string
	Getenv func(string) string
}

// SourceFactory constructs a Source.
type SourceFactory func(cfg SourceConfig) (Source, error)
