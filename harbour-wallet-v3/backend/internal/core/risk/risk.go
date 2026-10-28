// Package risk defines transaction simulation used before a user signs.
package risk

import (
	"context"
	"errors"
)

// AssetChange is one predicted balance change.
type AssetChange struct {
	AssetRef   string // contract address, or "native"
	Kind       string // native | token | nft | multi
	ChangeType string // transfer | approve
	From       string
	To         string
	AmountRaw  string
	TokenID    string
	Symbol     string
	Decimals   int // -1 if unknown
}

// Result of a simulation.
type Result struct {
	Changes  []AssetChange
	GasUsed  uint64
	Reverted bool
	Error    string
	Warnings []string
}

// ErrUnsupported means the simulator doesn't cover this chain; callers fall
// back to a plain eth_call + estimate.
var ErrUnsupported = errors.New("risk: chain not supported by simulator")

// Simulator predicts what a transaction will do.
type Simulator interface {
	Name() string
	Simulate(ctx context.Context, chain string, tx map[string]any) (Result, error)
}

// SimulatorConfig is passed to a SimulatorFactory.
type SimulatorConfig struct {
	Options map[string]string
	Chains  map[string]map[string]string // chains.yaml "risk:" options per chain
	Getenv  func(string) string
}

// SimulatorFactory constructs a Simulator.
type SimulatorFactory func(cfg SimulatorConfig) (Simulator, error)
