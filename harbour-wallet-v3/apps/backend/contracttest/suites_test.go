package contracttest_test

import (
	"testing"

	"harbour/backend/contracttest"
	"harbour/backend/contracttest/fakes"
	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/core/price"
)

// The suites run against fakes so they stay correct before real adapters exist.
func TestSuitesAgainstFakes(t *testing.T) {
	t.Run("index.Source", func(t *testing.T) {
		contracttest.RunSource(t, fakes.Source{Chain: "base"}, contracttest.SourceFixture{Chain: "base", Family: "evm", Address: "0xb", SinceBlock: 120})
	})
	t.Run("chain.Client", func(t *testing.T) {
		contracttest.RunChainClient(t, fakes.Client{}, contracttest.ClientFixture{Address: "0xb", AssetRefs: []string{"0xusdc"}})
	})
	t.Run("price.Source", func(t *testing.T) {
		contracttest.RunPriceSource(t, fakes.Prices{}, []price.AssetKey{{Chain: "base", AssetRef: "native"}})
	})
	t.Run("risk.Simulator", func(t *testing.T) {
		contracttest.RunSimulator(t, fakes.Simulator{}, "base", map[string]any{"data": "0x"}, map[string]any{"data": "0xdead"})
	})
	t.Run("meta.Source", func(t *testing.T) {
		contracttest.RunMetaSource(t, fakes.Meta{}, "base", "0xusdc", "0xnft", "1")
	})
	t.Run("notify.Channel", func(t *testing.T) {
		contracttest.RunNotifyChannel(t, fakes.Notifier{}, notify.Target{Channel: "fake", Token: "ok"}, notify.Target{Channel: "fake", Token: "gone"})
	})
}
