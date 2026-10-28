// Package url registers the "url" rpc.Upstream adapter: a full HTTPS endpoint
// with the key embedded (QuickNode, Chainstack, public endpoints). Adding such
// a provider is config only.
package url

import (
	"fmt"

	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/registry"
	"harbour/backend/internal/rpchttp"
)

// Name is the adapter name used in providers.yaml.
const Name = "url"

func init() { registry.RPCUpstreams.Register(Name, New) }

// New builds an upstream from cfg.URL.
func New(cfg rpc.UpstreamConfig) (rpc.Upstream, error) {
	if cfg.URL == "" && cfg.URLTemplate == "" {
		return nil, fmt.Errorf("upstream %s: url adapter needs url_env or url_template", cfg.ID)
	}
	return rpchttp.New(cfg, rpchttp.Options{})
}
