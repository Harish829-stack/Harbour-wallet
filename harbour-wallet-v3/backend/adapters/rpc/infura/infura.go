// Package infura registers the "infura" rpc.Upstream adapter. When the
// project has "require API key secret" on, the secret is sent as basic auth.
package infura

import (
	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/registry"
	"harbour/backend/internal/rpchttp"
)

// Name is the adapter name used in providers.yaml.
const Name = "infura"

func init() { registry.RPCUpstreams.Register(Name, New) }

// New builds an Infura upstream.
func New(cfg rpc.UpstreamConfig) (rpc.Upstream, error) {
	if cfg.URLTemplate == "" && cfg.URL == "" {
		cfg.URLTemplate = "https://{network}.infura.io/v3/{key}"
	}
	return rpchttp.New(cfg, rpchttp.Options{BasicAuthPassword: cfg.Secret})
}
