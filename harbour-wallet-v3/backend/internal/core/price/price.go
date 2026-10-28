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
	// ExternalID is the source's own id when known (e.g. a coin id).
	ExternalID string
}

// Quote is one price observation.
type Quote struct {
	Asset        AssetKey
	PriceUSD     float64
	LiquidityUSD float64 // 0 if unknown
	At           time.Time
}

// Source fetches current prices for many assets at once.
type Source interface {
	Name() string
	Quotes(ctx context.Context, assets []AssetKey) ([]Quote, error)
}

// SourceFactory constructs a Source.
type SourceFactory func(options map[string]string) (Source, error)
