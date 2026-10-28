// Package alchemy registers the "alchemy" rpc.Upstream adapter.
// URL scheme comes from providers.yaml; nothing else is provider-specific yet.
package alchemy

import (
	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/registry"
	"harbour/backend/internal/rpchttp"
)

// Name is the adapter name used in providers.yaml.
const Name = "alchemy"

func init() { registry.RPCUpstreams.Register(Name, New) }

// New builds an Alchemy upstream.
func New(cfg rpc.UpstreamConfig) (rpc.Upstream, error) {
	if cfg.URLTemplate == "" && cfg.URL == "" {
		cfg.URLTemplate = "https://{network}.g.alchemy.com/v2/{key}"
	}
	return rpchttp.New(cfg, rpchttp.Options{})
}
