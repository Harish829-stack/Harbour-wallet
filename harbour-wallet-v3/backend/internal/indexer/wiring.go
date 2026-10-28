package indexer

import (
	"fmt"
	"sort"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/registry"
)

// BuildChains constructs a Chain for every chain that has an indexer source,
// using only the registry and config (no adapter imports here).
func BuildChains(cfg *config.Config, rpcURL, rpcToken string, getenv func(string) string) (map[string]*Chain, error) {
	// One source instance per source name, configured for all its chains.
	perSource := map[string]map[string]map[string]string{}
	for name, ch := range cfg.Chains {
		for src, opts := range ch.Sources {
			if perSource[src] == nil {
				perSource[src] = map[string]map[string]string{}
			}
			perSource[src][name] = opts
		}
	}
	sources := map[string]index.Source{}
	for name, chains := range perSource {
		def := cfg.Sources[name]
		f, err := registry.IndexSources.Get(def.Adapter)
		if err != nil {
			return nil, err
		}
		s, err := f(index.SourceConfig{Name: name, Options: def.Options, Chains: chains, Getenv: getenv})
		if err != nil {
			return nil, err
		}
		sources[name] = s
	}
	out := map[string]*Chain{}
	for _, name := range cfg.ChainNames() {
		ch := cfg.Chains[name]
		if len(ch.Sources) == 0 {
			continue
		}
		srcNames := make([]string, 0, len(ch.Sources))
		for s := range ch.Sources {
			srcNames = append(srcNames, s)
		}
		sort.Strings(srcNames) // first source (by name) is primary until multi-source merging exists
		src := sources[srcNames[0]]
		cf, err := registry.ChainClients.Get(ch.Family)
		if err != nil {
			return nil, err
		}
		client, err := cf(chain.ClientConfig{Chain: name, Family: chain.Family(ch.Family), EVMChainID: ch.EVMChainID,
			RPCURL: rpcURL, RPCToken: rpcToken, Options: ch.Extra})
		if err != nil {
			return nil, fmt.Errorf("chain %s: %w", name, err)
		}
		var fin chain.FinalityPolicy
		if ch.Finality.Policy != "" {
			ff, err := registry.Finality.Get(ch.Finality.Policy)
			if err != nil {
				return nil, err
			}
			if fin, err = ff(client, ch.Finality.Options); err != nil {
				return nil, fmt.Errorf("chain %s finality: %w", name, err)
			}
		}
		c := &Chain{Name: name, Family: ch.Family, Native: ch.Native, Client: client, Finality: fin, Source: src,
			SourceName: srcNames[0], BlockTime: ch.BlockTime}
		if h, ok := src.(index.Holdings); ok {
			c.Holdings = h
		}
		if w, ok := src.(index.Webhooks); ok {
			c.Webhooks = w
		}
		out[name] = c
	}
	return out, nil
}
