// Package meta defines token and NFT metadata sources. Media is fetched
// server-side and re-encoded; the extension never loads NFT URLs directly.
package meta

import "context"

// Token metadata.
type Token struct {
	Chain    string
	AssetRef string
	Symbol   string
	Name     string
	Decimals int
	LogoURL  string
}

// NFT metadata.
type NFT struct {
	Chain    string
	Contract string
	TokenID  string
	Name     string
	ImageURL string // source URL; fetched and re-encoded by the media proxy
	Attrs    map[string]any
}

// Source returns metadata.
type Source interface {
	Name() string
	Token(ctx context.Context, chain, assetRef string) (Token, error)
	NFT(ctx context.Context, chain, contract, tokenID string) (NFT, error)
}

// SourceFactory constructs a Source.
type SourceFactory func(options map[string]string) (Source, error)
