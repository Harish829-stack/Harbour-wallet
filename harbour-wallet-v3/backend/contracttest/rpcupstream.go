// Package contracttest holds one shared suite per plug-point interface.
// An adapter is accepted by running its suite (recorded fixtures, replayed),
// not by reviewing every service. Call the Run* function from the adapter's
// own _test.go.
package contracttest

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"harbour/backend/internal/core/rpc"
)

func fixturePath(name string) string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "testdata", name)
}

// replayNode serves recorded responses; mode switches failure behaviour.
type replayNode struct {
	fixtures map[string]json.RawMessage
	mode     atomic.Value // "", "429", "401", "slow", "garbage"
	lastAuth atomic.Value
	lastPath atomic.Value
}

func (n *replayNode) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	n.lastAuth.Store(r.Header.Get("Authorization"))
	n.lastPath.Store(r.URL.Path)
	switch n.mode.Load() {
	case "429":
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"error":{"code":429,"message":"Your app has exceeded its compute units per second capacity"}}`))
		return
	case "401":
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`invalid project id`))
		return
	case "slow":
		select {
		case <-time.After(1500 * time.Millisecond):
		case <-r.Context().Done():
			return
		}
	case "garbage":
		w.Write([]byte(`<html>bad gateway</html>`))
		return
	}
	var req rpc.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(400)
		return
	}
	key := req.Method
	if req.Method == "eth_getBlockByNumber" && strings.Contains(string(req.Params), "finalized") {
		key += ":finalized"
	}
	fx, ok := n.fixtures[key]
	if !ok {
		fx = json.RawMessage(`{"error":{"code":-32601,"message":"the method does not exist/is not available"}}`)
	}
	var m map[string]json.RawMessage
	_ = json.Unmarshal(fx, &m)
	m["jsonrpc"] = json.RawMessage(`"2.0"`)
	m["id"] = req.ID
	json.NewEncoder(w).Encode(m)
}

// UpstreamHarness tells the suite how to point an adapter at the replay server.
type UpstreamHarness struct {
	Factory rpc.UpstreamFactory
	// Config returns a config whose URL reaches baseURL (e.g. via URLTemplate).
	Config func(baseURL string) rpc.UpstreamConfig
	// WantBasicAuth, if set, is the Authorization header the adapter must send.
	WantBasicAuth string
}

// RunUpstream is the rpc.Upstream contract.
func RunUpstream(t *testing.T, h UpstreamHarness) {
	raw, err := os.ReadFile(fixturePath("evm_node.json"))
	if err != nil {
		t.Fatal(err)
	}
	node := &replayNode{}
	if err := json.Unmarshal(raw, &node.fixtures); err != nil {
		t.Fatal(err)
	}
	node.mode.Store("")
	srv := httptest.NewServer(node)
	defer srv.Close()
	cfg := h.Config(srv.URL)
	cfg.Timeout = 300 * time.Millisecond
	up, err := h.Factory(cfg)
	if err != nil {
		t.Fatalf("factory: %v", err)
	}
	ctx := context.Background()
	call := func(method, params string) (*rpc.Response, error) {
		return up.Call(ctx, &rpc.Request{JSONRPC: "2.0", ID: json.RawMessage(`42`), Method: method, Params: json.RawMessage(params)})
	}

	t.Run("identity", func(t *testing.T) {
		if up.ID() != cfg.ID || up.Chain() != cfg.Chain || up.Provider() != cfg.Provider {
			t.Fatalf("identity %q %q %q", up.ID(), up.Chain(), up.Provider())
		}
	})
	t.Run("result", func(t *testing.T) {
		resp, err := call("eth_getBalance", `["0x0000000000000000000000000000000000000001","latest"]`)
		if err != nil || resp.Error != nil || string(resp.Result) != `"0x2386f26fc10000"` || string(resp.ID) != "42" {
			t.Fatalf("resp %+v err %v", resp, err)
		}
		if h.WantBasicAuth != "" && node.lastAuth.Load() != h.WantBasicAuth {
			t.Fatalf("auth header %q", node.lastAuth.Load())
		}
	})
	t.Run("rpc error is a response not a Go error", func(t *testing.T) {
		resp, err := call("eth_call", `[{},"latest"]`)
		if err != nil || resp.Error == nil || resp.Error.Code != 3 {
			t.Fatalf("resp %+v err %v", resp, err)
		}
		if rpc.Classify(resp, err) != rpc.Deterministic {
			t.Fatal("revert must be deterministic")
		}
	})
	t.Run("head", func(t *testing.T) {
		hd, err := up.Head(ctx)
		if err != nil || hd.Latest != 0x1495b3c || hd.Finalized != 0x1495a10 {
			t.Fatalf("head %+v err %v", hd, err)
		}
		if err := up.Health(ctx); err != nil {
			t.Fatal(err)
		}
	})
	for _, mode := range []string{"429", "401", "garbage"} {
		t.Run("transport "+mode+" is retryable", func(t *testing.T) {
			node.mode.Store(mode)
			defer node.mode.Store("")
			resp, err := call("eth_chainId", `[]`)
			var te *rpc.TransportError
			if err == nil || !errors.As(err, &te) {
				t.Fatalf("want TransportError, got %+v %v", resp, err)
			}
			if rpc.Classify(resp, err) != rpc.Retryable {
				t.Fatal("not retryable")
			}
			if strings.Contains(err.Error(), srv.URL) || (cfg.Key != "" && strings.Contains(err.Error(), cfg.Key)) {
				t.Fatalf("error leaks URL or key: %v", err)
			}
		})
	}
	t.Run("timeout honoured", func(t *testing.T) {
		node.mode.Store("slow")
		defer node.mode.Store("")
		start := time.Now()
		_, err := call("eth_chainId", `[]`)
		if err == nil || time.Since(start) > time.Second {
			t.Fatalf("timeout not honoured: %v after %v", err, time.Since(start))
		}
		if strings.Contains(err.Error(), srv.URL) {
			t.Fatalf("error leaks URL: %v", err)
		}
	})
}
