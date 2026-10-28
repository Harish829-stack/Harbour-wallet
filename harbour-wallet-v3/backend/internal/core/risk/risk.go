// Package risk defines transaction simulation used before a user signs.
package risk

import "context"

// AssetChange is one predicted balance change.
type AssetChange struct {
	AssetRef  string
	From      string
	To        string
	AmountRaw string
	Kind      string
}

// Result of a simulation.
type Result struct {
	Changes  []AssetChange
	Reverted bool
	Error    string
	Warnings []string
}

// Simulator predicts what a transaction will do.
type Simulator interface {
	Name() string
	Simulate(ctx context.Context, chain string, tx map[string]any) (Result, error)
}

// SimulatorFactory constructs a Simulator.
type SimulatorFactory func(options map[string]string) (Simulator, error)
