package gateway

import (
	"context"
	"sync"

	"harbour/backend/internal/core/rpc"
)

// flightGroup collapses identical concurrent reads into one upstream call (what eRPC calls multiplexing). Each caller
// gets its own copy of the response, because Handle stamps the caller's request id on it.
type flightGroup struct {
	mu sync.Mutex
	m  map[string]*flight
}

type flight struct {
	done chan struct{}
	resp *rpc.Response
}

// do runs fn once per key among concurrent callers; followers wait for the leader's answer (or their own ctx).
func (g *flightGroup) do(ctx context.Context, key string, fn func(context.Context) *rpc.Response) (*rpc.Response, bool) {
	g.mu.Lock()
	if g.m == nil {
		g.m = map[string]*flight{}
	}
	if f, ok := g.m[key]; ok {
		g.mu.Unlock()
		select {
		case <-f.done:
			return copyResp(f.resp), true
		case <-ctx.Done():
			return rpc.NewGatewayError(nil, rpc.CodeUpstreamsUnavailable, "upstreams_unavailable",
				"Network busy, retrying", true, nil), true
		}
	}
	f := &flight{done: make(chan struct{})}
	g.m[key] = f
	g.mu.Unlock()

	func() {
		defer func() {
			g.mu.Lock()
			delete(g.m, key)
			g.mu.Unlock()
			close(f.done)
		}()
		f.resp = fn(ctx)
	}()
	return copyResp(f.resp), false
}

func copyResp(r *rpc.Response) *rpc.Response {
	if r == nil {
		return nil
	}
	c := *r
	return &c
}
