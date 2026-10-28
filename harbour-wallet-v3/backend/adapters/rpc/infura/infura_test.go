package infura_test

import (
	"encoding/base64"
	"testing"

	"harbour/backend/adapters/rpc/infura"
	"harbour/backend/contracttest"
	"harbour/backend/internal/core/rpc"
)

func TestContract(t *testing.T) {
	contracttest.RunUpstream(t, contracttest.UpstreamHarness{
		Factory: infura.New,
		Config: func(base string) rpc.UpstreamConfig {
			return rpc.UpstreamConfig{ID: "base/infura-a", Provider: "infura", Chain: "base", Network: "base-mainnet",
				URLTemplate: base + "/{network}/v3/{key}", Key: "test-key", Secret: "s3cret"}
		},
		WantBasicAuth: "Basic " + base64.StdEncoding.EncodeToString([]byte(":s3cret")),
	})
}
