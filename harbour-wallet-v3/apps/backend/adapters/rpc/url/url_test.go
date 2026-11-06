package url_test

import (
	"testing"

	"harbour/backend/adapters/rpc/url"
	"harbour/backend/contracttest"
	"harbour/backend/internal/core/rpc"
)

func TestContract(t *testing.T) {
	contracttest.RunUpstream(t, contracttest.UpstreamHarness{
		Factory: url.New,
		Config: func(base string) rpc.UpstreamConfig {
			return rpc.UpstreamConfig{ID: "base/quicknode", Provider: "quicknode", Chain: "base", URL: base + "/secret-path/"}
		},
	})
}
