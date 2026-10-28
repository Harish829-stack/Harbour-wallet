package gateway_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	_ "harbour/backend/adapters/rpc/all"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/gateway"
	"harbour/backend/internal/rpchttp"
)

// fakeNode is a JSON-RPC node with switchable failure modes.
type fakeNode struct {
	name      string
	latest    atomic.Uint64
	finalized atomic.Uint64
	disabled  atomic.Bool  // key revoked: HTTP 401
	delay     atomic.Int64 // ns
	calls     sync.Map     // method -> *atomic.Int64
	total     atomic.Int64
	sendResp  atomic.Value // string: JSON for eth_sendRawTransaction ("result" or "error" object)
}

func (n *fakeNode) count(m string) int64 {
	v, ok := n.calls.Load(m)
	if !ok {
		return 0
	}
	return v.(*atomic.Int64).Load()
}

func (n *fakeNode) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if n.disabled.Load() {
		http.Error(w, `{"error":"invalid api key"}`, http.StatusUnauthorized)
		return
	}
	var req rpc.Request
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "bad", 400)
		return
	}
	v, _ := n.calls.LoadOrStore(req.Method, new(atomic.Int64))
	v.(*atomic.Int64).Add(1)
	n.total.Add(1)
	if d := n.delay.Load(); d > 0 && req.Method != "eth_blockNumber" && req.Method != "eth_getBlockByNumber" {
		select {
		case <-time.After(time.Duration(d)):
		case <-r.Context().Done():
			return
		}
	}
	var ps []json.RawMessage
	_ = json.Unmarshal(req.Params, &ps)
	hexn := func(x uint64) string { return strconv.Quote("0x" + strconv.FormatUint(x, 16)) }
	res := `null`
	errObj := ""
	switch req.Method {
	case "eth_blockNumber":
		res = hexn(n.latest.Load())
	case "eth_chainId":
		res = `"0x2105"`
	case "eth_getBlockByNumber":
		var tag string
		_ = json.Unmarshal(ps[0], &tag)
		switch {
		case tag == "finalized":
			res = `{"number":` + hexn(n.finalized.Load()) + `}`
		case tag == "latest":
			res = `{"number":` + hexn(n.latest.Load()) + `}`
		default:
			num, _ := strconv.ParseUint(strings.TrimPrefix(tag, "0x"), 16, 64)
			if num <= n.latest.Load() {
				res = `{"number":"` + tag + `","by":"` + n.name + `"}`
			}
		}
	case "eth_getBalance":
		res = `"0xde0b6b3a7640000"`
	case "eth_call":
		errObj = `{"code":3,"message":"execution reverted","data":"0x"}`
	case "eth_getLogs":
		var f struct{ FromBlock, ToBlock string }
		_ = json.Unmarshal(ps[0], &f)
		from, _ := strconv.ParseUint(strings.TrimPrefix(f.FromBlock, "0x"), 16, 64)
		to, _ := strconv.ParseUint(strings.TrimPrefix(f.ToBlock, "0x"), 16, 64)
		if to-from+1 > 100 {
			errObj = `{"code":-32005,"message":"query returned more than 10000 results"}`
			break
		}
		var logs []string
		for b := from; b <= to; b += 50 {
			logs = append(logs, `{"blockNumber":`+hexn(b)+`}`)
		}
		res = "[" + strings.Join(logs, ",") + "]"
	case "eth_sendRawTransaction":
		s, _ := n.sendResp.Load().(string)
		if strings.HasPrefix(s, "{") {
			errObj = s
		} else {
			res = s
		}
	}
	w.Header().Set("Content-Type", "application/json")
	if errObj != "" {
		fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"error":%s}`, req.ID, errObj)
		return
	}
	fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":%s}`, req.ID, res)
}

type rig struct {
	g     *gateway.Gateway
	nodes map[string]*fakeNode // key id -> node
	stop  func()
}

// newRig builds chain "testnet" with upstreams alchemy-a, infura-a,
// alchemy-b, infura-b, each a fake node, through the real config, registry,
// adapters and HTTP client.
func newRig(t *testing.T, rps float64, mutate func(*config.Config)) *rig {
	rpchttp.FinalizedEvery = 0
	t.Helper()
	r := &rig{nodes: map[string]*fakeNode{}}
	mux := http.NewServeMux()
	env := map[string]string{}
	for _, id := range []string{"alchemy-a", "infura-a", "alchemy-b", "infura-b"} {
		n := &fakeNode{name: id}
		n.latest.Store(1000)
		n.finalized.Store(990)
		r.nodes[id] = n
		mux.Handle("/"+id+"/", http.StripPrefix("/"+id, n))
		env["KEY_"+strings.ReplaceAll(id, "-", "_")] = id
	}
	srv := httptest.NewServer(mux)
	cfg := &config.Config{
		Chains: map[string]config.Chain{"testnet": {
			Family: "evm", BlockTime: time.Second, LogsMaxRange: 100,
			Upstreams: []config.UpstreamRef{
				{Provider: "alchemy", Key: "alchemy-a", Network: "net"},
				{Provider: "infura", Key: "infura-a", Network: "net"},
				{Provider: "alchemy", Key: "alchemy-b", Network: "net"},
				{Provider: "infura", Key: "infura-b", Network: "net"},
			},
		}},
		Providers: map[string]config.Provider{
			"alchemy": {Adapter: "alchemy", URLTemplate: srv.URL + "/{key}/{network}", Timeout: 5 * time.Second,
				Keys: []config.Key{{ID: "alchemy-a", KeyEnv: "KEY_alchemy_a", RPS: rps}, {ID: "alchemy-b", KeyEnv: "KEY_alchemy_b", RPS: rps}}},
			"infura": {Adapter: "infura", URLTemplate: srv.URL + "/{key}/{network}", Timeout: 5 * time.Second,
				Keys: []config.Key{{ID: "infura-a", KeyEnv: "KEY_infura_a", RPS: rps}, {ID: "infura-b", KeyEnv: "KEY_infura_b", RPS: rps}}},
		},
		API: config.API{DefaultTier: "d", Tiers: map[string]config.Tier{"d": {}}},
	}
	cfg.Gateway = config.Gateway{BreakerCooldown: 300 * time.Millisecond, HeadPollMin: time.Second}
	if mutate != nil {
		mutate(cfg)
	}
	cfg.ApplyDefaults()
	g, err := gateway.New(cfg, func(k string) string { return env[k] }, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	go g.Run(ctx)
	r.g = g
	r.stop = func() { cancel(); srv.Close() }
	t.Cleanup(r.stop)
	waitFor(t, func() bool { p, _ := g.Pool("testnet"); return p.BestHead() == 1000 && p.Finalized() == 990 })
	return r
}

func waitFor(t *testing.T, f func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !f() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func call(g *gateway.Gateway, method, params string, opt gateway.CallOptions) *rpc.Response {
	return g.Handle(context.Background(), "testnet", &rpc.Request{JSONRPC: "2.0", ID: json.RawMessage("7"), Method: method, Params: json.RawMessage(params)}, opt)
}

// Phase 2 exit test: disabling one provider's keys under load causes zero
// failed reads.
func TestProviderOutageUnderLoad(t *testing.T) {
	r := newRig(t, 0, nil)
	var failed, done atomic.Int64
	var wg sync.WaitGroup
	stopLoad := make(chan struct{})
	for w := 0; w < 32; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; ; i++ {
				select {
				case <-stopLoad:
					return
				default:
				}
				// Distinct params defeat the cache so every read hits upstreams.
				addr := fmt.Sprintf(`["0x%040x","latest"]`, w*1_000_000+i)
				resp := call(r.g, "eth_getBalance", addr, gateway.CallOptions{UserFacing: i%2 == 0})
				if resp.Error != nil || string(resp.Result) != `"0xde0b6b3a7640000"` || string(resp.ID) != "7" {
					failed.Add(1)
					t.Logf("failed: %+v", resp.Error)
				}
				done.Add(1)
			}
		}(w)
	}
	time.Sleep(300 * time.Millisecond)
	// Revoke every Alchemy key mid-load.
	r.nodes["alchemy-a"].disabled.Store(true)
	r.nodes["alchemy-b"].disabled.Store(true)
	time.Sleep(1500 * time.Millisecond)
	close(stopLoad)
	wg.Wait()
	if failed.Load() != 0 {
		t.Fatalf("%d of %d reads failed", failed.Load(), done.Load())
	}
	st := r.g.Status()["testnet"]
	for _, u := range st {
		if strings.Contains(u.ID, "alchemy") && u.State != "open" {
			t.Errorf("%s breaker %s, want open", u.ID, u.State)
		}
	}
	t.Logf("%d reads, 0 failed; status: %+v", done.Load(), st)
}

func TestAllUpstreamsDownGivesRetryableError(t *testing.T) {
	r := newRig(t, 0, nil)
	for _, n := range r.nodes {
		n.disabled.Store(true)
	}
	resp := call(r.g, "eth_getBalance", `["0x0000000000000000000000000000000000000001","latest"]`, gateway.CallOptions{})
	if resp.Error == nil || resp.Error.Code != rpc.CodeUpstreamsUnavailable {
		t.Fatalf("want gateway error, got %+v", resp)
	}
	var d rpc.GatewayErrorData
	_ = json.Unmarshal(resp.Error.Data, &d)
	if !d.Retryable || len(d.UpstreamsTried) != 4 {
		t.Fatalf("error data %+v", d)
	}
}

func TestDeterministicErrorNotRetried(t *testing.T) {
	r := newRig(t, 0, nil)
	resp := call(r.g, "eth_call", `[{"to":"0x0000000000000000000000000000000000000001","data":"0x"},"latest"]`, gateway.CallOptions{})
	if resp.Error == nil || resp.Error.Message != "execution reverted" {
		t.Fatalf("got %+v", resp)
	}
	var total int64
	for _, n := range r.nodes {
		total += n.count("eth_call")
	}
	if total != 1 {
		t.Fatalf("revert sent %d times, want 1", total)
	}
}

func TestFinalizedAndLatestCaching(t *testing.T) {
	r := newRig(t, 0, nil)
	sum := func(m string) (s int64) {
		for _, n := range r.nodes {
			s += n.count(m)
		}
		return
	}
	for i := 0; i < 3; i++ {
		call(r.g, "eth_getBalance", `["0x0000000000000000000000000000000000000003","0x3dc"]`, gateway.CallOptions{}) // 988 <= 990
	}
	if got := sum("eth_getBalance"); got != 1 {
		t.Fatalf("finalized read: %d upstream calls, want 1", got)
	}
	for i := 0; i < 3; i++ {
		call(r.g, "eth_getBalance", `["0x0000000000000000000000000000000000000004","latest"]`, gateway.CallOptions{})
	}
	if got := sum("eth_getBalance"); got != 2 {
		t.Fatalf("latest read within a block: %d calls, want 2", got)
	}
	time.Sleep(1100 * time.Millisecond) // block_time TTL
	call(r.g, "eth_getBalance", `["0x0000000000000000000000000000000000000004","latest"]`, gateway.CallOptions{})
	if got := sum("eth_getBalance"); got != 3 {
		t.Fatalf("latest read after TTL: %d calls, want 3", got)
	}
	// pending is never cached
	call(r.g, "eth_getBalance", `["0x0000000000000000000000000000000000000004","pending"]`, gateway.CallOptions{})
	call(r.g, "eth_getBalance", `["0x0000000000000000000000000000000000000004","pending"]`, gateway.CallOptions{})
	if got := sum("eth_getBalance"); got != 5 {
		t.Fatalf("pending cached: %d", got)
	}
}

func TestHedgingOnlyForUserFacing(t *testing.T) {
	r := newRig(t, 0, nil)
	for id, n := range r.nodes {
		if id != "infura-b" {
			n.delay.Store(int64(1500 * time.Millisecond))
		}
	}
	// User-facing: answer comes from the fast node well before the slow one.
	var fastest time.Duration = time.Hour
	for i := 0; i < 6; i++ {
		start := time.Now()
		resp := call(r.g, "eth_getBalance", fmt.Sprintf(`["0x%040x","latest"]`, 100+i), gateway.CallOptions{UserFacing: true})
		if resp.Error != nil {
			t.Fatal(resp.Error)
		}
		if d := time.Since(start); d < fastest {
			fastest = d
		}
	}
	if fastest > time.Second {
		t.Fatalf("hedged read never beat the slow upstreams: %v", fastest)
	}
	// Background: exactly one upstream call per read.
	before := int64(0)
	for _, n := range r.nodes {
		before += n.count("eth_getBalance")
	}
	call(r.g, "eth_getBalance", `["0x00000000000000000000000000000000000000ff","latest"]`, gateway.CallOptions{})
	after := int64(0)
	for _, n := range r.nodes {
		after += n.count("eth_getBalance")
	}
	if after-before != 1 {
		t.Fatalf("background read hit %d upstreams", after-before)
	}
}

func TestBroadcastFanoutAndAlreadyKnown(t *testing.T) {
	r := newRig(t, 0, nil)
	raw := "0x02f86c"
	for _, n := range r.nodes {
		n.sendResp.Store(`{"code":-32000,"message":"already known"}`)
	}
	r.nodes["infura-a"].sendResp.Store(`"0xabc"`)
	resp := call(r.g, "eth_sendRawTransaction", `["`+raw+`"]`, gateway.CallOptions{})
	if resp.Error != nil {
		t.Fatalf("send: %+v", resp.Error)
	}
	time.Sleep(100 * time.Millisecond)
	var sends int64
	for _, n := range r.nodes {
		sends += n.count("eth_sendRawTransaction")
	}
	if sends != 2 {
		t.Fatalf("broadcast went to %d upstreams, want 2", sends)
	}
	// Nonce too low is deterministic and returned as-is.
	for _, n := range r.nodes {
		n.sendResp.Store(`{"code":-32000,"message":"nonce too low"}`)
	}
	resp = call(r.g, "eth_sendRawTransaction", `["`+raw+`"]`, gateway.CallOptions{})
	if resp.Error == nil || resp.Error.Message != "nonce too low" {
		t.Fatalf("got %+v", resp)
	}
}

func TestGetLogsSplit(t *testing.T) {
	r := newRig(t, 0, nil)
	resp := call(r.g, "eth_getLogs", `[{"fromBlock":"0x0","toBlock":"0x1f3","address":"0x0000000000000000000000000000000000000001"}]`, gateway.CallOptions{})
	if resp.Error != nil {
		t.Fatal(resp.Error)
	}
	var logs []struct{ BlockNumber string }
	_ = json.Unmarshal(resp.Result, &logs)
	if len(logs) != 10 || logs[0].BlockNumber != "0x0" || logs[9].BlockNumber != "0x1c2" {
		t.Fatalf("merged logs %+v", logs)
	}
}

func TestBatchOrderAndForbidden(t *testing.T) {
	r := newRig(t, 0, nil)
	out := r.g.HandleBatch(context.Background(), "testnet", []rpc.Request{
		{ID: json.RawMessage("1"), Method: "eth_chainId"},
		{ID: json.RawMessage("2"), Method: "personal_unlockAccount"},
		{ID: json.RawMessage("3"), Method: "eth_blockNumber"},
	}, gateway.CallOptions{})
	if string(out[0].ID) != "1" || string(out[0].Result) != `"0x2105"` {
		t.Fatalf("0: %+v", out[0])
	}
	if out[1].Error == nil || out[1].Error.Code != rpc.CodeMethodNotAllowed {
		t.Fatalf("1: %+v", out[1])
	}
	if string(out[2].ID) != "3" || out[2].Error != nil {
		t.Fatalf("2: %+v", out[2])
	}
}

func TestBlockLagRouting(t *testing.T) {
	r := newRig(t, 0, nil)
	for id, n := range r.nodes {
		if id != "infura-b" {
			n.latest.Store(900)
		}
	}
	r.nodes["infura-b"].latest.Store(1001)
	p, _ := r.g.Pool("testnet")
	waitFor(t, func() bool { return p.BestHead() == 1001 })
	time.Sleep(1200 * time.Millisecond) // every head refreshed
	for i := 0; i < 5; i++ {
		resp := call(r.g, "eth_getBlockByNumber", fmt.Sprintf(`["0x3e9",%v]`, i%2 == 0), gateway.CallOptions{})
		if resp.Error != nil || !strings.Contains(string(resp.Result), "infura-b") {
			t.Fatalf("block 1001 served by a lagging node: %s %+v", resp.Result, resp.Error)
		}
	}
}

func TestBudgetShedsToOtherKeys(t *testing.T) {
	r := newRig(t, 5, nil) // 5 rps per key, 20 rps total
	var ok int
	for i := 0; i < 15; i++ {
		resp := call(r.g, "eth_getBalance", fmt.Sprintf(`["0x%040x","latest"]`, 5000+i), gateway.CallOptions{})
		if resp.Error == nil {
			ok++
		}
	}
	if ok != 15 {
		t.Fatalf("%d/15 within combined budget", ok)
	}
	for _, n := range r.nodes {
		if n.count("eth_getBalance") > 6 {
			t.Fatalf("%s took %d calls over its 5 rps budget", n.name, n.count("eth_getBalance"))
		}
	}
}

func TestStickySession(t *testing.T) {
	r := newRig(t, 0, nil)
	opt := gateway.CallOptions{Session: "dev1:send-42"}
	for i := 0; i < 8; i++ {
		call(r.g, "eth_getBalance", fmt.Sprintf(`["0x%040x","pending"]`, 9000+i), opt)
	}
	used := 0
	for _, n := range r.nodes {
		if n.count("eth_getBalance") > 0 {
			used++
		}
	}
	if used != 1 {
		t.Fatalf("session spread over %d upstreams", used)
	}
}
