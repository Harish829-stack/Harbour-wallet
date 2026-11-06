package alchemy_test

import (
	"testing"

	"harbour/backend/adapters/rpc/alchemy"
	"harbour/backend/contracttest"
	"harbour/backend/internal/core/rpc"
)

func TestContract(t *testing.T) {
	contracttest.RunUpstream(t, contracttest.UpstreamHarness{
		Factory: alchemy.New,
		Config: func(base string) rpc.UpstreamConfig {
			return rpc.UpstreamConfig{ID: "base/alchemy-a", Provider: "alchemy", Chain: "base", Network: "base-mainnet",
				URLTemplate: base + "/{network}/v2/{key}", Key: "test-key"}
		},
	})
}
