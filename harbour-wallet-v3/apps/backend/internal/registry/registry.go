// Package registry maps adapter names to constructors. Adapters register
// themselves in init(); services look them up by the name in config.
package registry

import (
	"fmt"
	"sort"
	"sync"

	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/core/meta"
	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/core/price"
	"harbour/backend/internal/core/risk"
	"harbour/backend/internal/core/rpc"
)

// Registry is a name -> constructor map for one plug point.
type Registry[T any] struct {
	kind string
	mu   sync.RWMutex
	m    map[string]T
}

// New returns an empty registry.
func New[T any](kind string) *Registry[T] { return &Registry[T]{kind: kind, m: map[string]T{}} }

// Register adds a constructor; registering a name twice panics (init-time bug).
func (r *Registry[T]) Register(name string, f T) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, dup := r.m[name]; dup {
		panic(fmt.Sprintf("registry: %s %q registered twice", r.kind, name))
	}
	r.m[name] = f
}

// Get returns the constructor for name.
func (r *Registry[T]) Get(name string) (T, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	f, ok := r.m[name]
	if !ok {
		var zero T
		return zero, fmt.Errorf("registry: no %s adapter named %q (registered: %v)", r.kind, name, r.namesLocked())
	}
	return f, nil
}

// Names lists registered names, sorted.
func (r *Registry[T]) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.namesLocked()
}

func (r *Registry[T]) namesLocked() []string {
	out := make([]string, 0, len(r.m))
	for k := range r.m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// One registry per plug point in the plan's modular design table.
var (
	RPCUpstreams  = New[rpc.UpstreamFactory]("rpc upstream")
	ChainClients  = New[chain.ClientFactory]("chain client")
	Finality      = New[chain.FinalityFactory]("finality policy")
	IndexSources  = New[index.SourceFactory]("index source")
	PriceSources  = New[price.SourceFactory]("price source")
	RiskSimulator = New[risk.SimulatorFactory]("risk simulator")
	MetaSources   = New[meta.SourceFactory]("meta source")
	NotifyChannel = New[notify.ChannelFactory]("notify channel")
)
