package gateway_test

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/gateway"
)

// Only the follower polls every block; the other upstreams are probed every HeadProbeEvery.
func TestHeadFollowerOnly(t *testing.T) {
	r := newRig(t, 0, func(c *config.Config) { c.Gateway.HeadProbeEvery = time.Minute })
	time.Sleep(3500 * time.Millisecond)
	busy := 0
	for _, n := range r.nodes {
		if n.count("eth_blockNumber") > 2 {
			busy++
		}
	}
	if busy != 1 {
		for id, n := range r.nodes {
			t.Logf("%s: %d head polls", id, n.count("eth_blockNumber"))
		}
		t.Fatalf("%d upstreams polled every block, want 1", busy)
	}
}

// Head polls fetch latest and finalized in one batch request.
func TestHeadPollIsBatched(t *testing.T) {
	r := newRig(t, 0, nil)
	var batches int64
	for _, n := range r.nodes {
		batches += n.batches.Load()
	}
	if batches == 0 {
		t.Fatal("head polls never used a batch")
	}
}

// eth_blockNumber and eth_chainId are answered without an upstream call.
func TestLocalAnswers(t *testing.T) {
	r := newRig(t, 0, func(c *config.Config) {
		ch := c.Chains["testnet"]
		ch.EVMChainID = 8453
		c.Chains["testnet"] = ch
		c.Gateway.HeadProbeEvery = time.Minute
	})
	before := map[string]int64{}
	for id, n := range r.nodes {
		before[id] = n.count("eth_chainId")
	}
	for i := 0; i < 20; i++ {
		resp := call(r.g, "eth_blockNumber", `[]`, gateway.CallOptions{})
		if resp.Error != nil || string(resp.Result) != `"0x3e8"` || string(resp.ID) != "7" {
			t.Fatalf("blockNumber %+v", resp)
		}
		resp = call(r.g, "eth_chainId", `[]`, gateway.CallOptions{})
		if resp.Error != nil || string(resp.Result) != `"0x2105"` {
			t.Fatalf("chainId %+v", resp)
		}
	}
	for id, n := range r.nodes {
		if n.count("eth_chainId") != before[id] {
			t.Fatalf("%s got eth_chainId upstream", id)
		}
	}
}

// A key's rate budget is shared by every chain it serves.
func TestBudgetSharedAcrossChains(t *testing.T) {
	r := newRig(t, 5, func(c *config.Config) {
		c.Chains["testnet2"] = c.Chains["testnet"]
	})
	var wg sync.WaitGroup
	for _, chain := range []string{"testnet", "testnet2"} {
		for i := 0; i < 15; i++ {
			wg.Add(1)
			go func(chain string, i int) {
				defer wg.Done()
				r.g.Handle(context.Background(), chain, &rpc.Request{ID: json.RawMessage("1"), Method: "eth_getBalance",
					Params: json.RawMessage(fmt.Sprintf(`["0x%040x","latest"]`, 7000+i))}, gateway.CallOptions{})
			}(chain, i)
		}
	}
	wg.Wait()
	for _, n := range r.nodes {
		if c := n.count("eth_getBalance"); c > 7 {
			t.Fatalf("%s took %d calls across two chains on a 5 rps key", n.name, c)
		}
	}
}

// Identical concurrent reads share one upstream call; each caller keeps its own id.
func TestCoalescedReads(t *testing.T) {
	r := newRig(t, 0, nil)
	for _, n := range r.nodes {
		n.delay.Store(int64(200 * time.Millisecond))
	}
	var wg sync.WaitGroup
	ids := make([]string, 10)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			resp := r.g.Handle(context.Background(), "testnet", &rpc.Request{ID: json.RawMessage(fmt.Sprint(i)), Method: "eth_getBalance",
				Params: json.RawMessage(`["0x00000000000000000000000000000000000000aa","latest"]`)}, gateway.CallOptions{})
			if resp.Error != nil {
				t.Errorf("read %d: %+v", i, resp.Error)
			}
			ids[i] = string(resp.ID)
		}(i)
	}
	wg.Wait()
	var total int64
	for _, n := range r.nodes {
		total += n.count("eth_getBalance")
	}
	if total != 1 {
		t.Fatalf("%d upstream calls for 10 identical reads", total)
	}
	for i, id := range ids {
		if id != fmt.Sprint(i) {
			t.Fatalf("caller %d got id %s", i, id)
		}
	}
}
