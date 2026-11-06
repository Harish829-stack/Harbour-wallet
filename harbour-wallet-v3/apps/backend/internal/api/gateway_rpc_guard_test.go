package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
)

// Audit A1: the guard must judge exactly the bytes the upstream receives.
func TestJSONRPCGuardRejectsParserDifferentials(t *testing.T) {
	allowed := setOf("eth_chainId", "eth_blockNumber")
	bad := []string{
		`{"method":"debug_traceCall","Method":"eth_chainId"}`,                            // case-variant duplicate: Go takes the last, others the first
		`{"Method":"eth_chainId","method":"debug_traceCall"}`,                            // same, other order
		`{"METHOD":"eth_chainId"}`,                                                       // wrong case only
		`{"method":"eth_chainId","method":"debug_traceCall"}`,                            // exact duplicate
		`{"method":"debug_traceCall","method":"eth_chainId"}`,                            // exact duplicate, other order
		`{"method":"eth_chainId","extra":1}`,                                             // unknown key
		`{"method":"eth_chainId","params":[],"Params":[]}`,                               // duplicate params, different case
		`{"method":"eth_chainId"} {"method":"debug_traceCall"}`,                          // trailing second value
		`{"method":"eth_chainId"}garbage`,                                                // trailing garbage
		`{"method":["eth_chainId"]}`,                                                     // non-string method
		`{"method":""}`,                                                                  // empty method
		`{"jsonrpc":"2.0","id":1}`,                                                       // no method
		`[{"method":"eth_chainId"},{"method":"debug_traceCall","Method":"eth_chainId"}]`, // bad member of a batch
		`[{"method":"eth_chainId"},1]`,                                                   // non-object member
		`[]`, `null`, `1`, `"eth_chainId"`, ``,
	}
	for _, b := range bad {
		if _, rej := jsonRPCClean([]byte(b), allowed, nil); rej == nil {
			t.Errorf("accepted %q", b)
		}
	}
	good := []string{
		`{"method":"eth_chainId"}`,
		`{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}`,
		`{"jsonrpc":"2.0","id":"abc","method":"eth_chainId"}`,
		`{"jsonrpc":"2.0","id":null,"method":"eth_chainId","params":[]}`,
		` [ {"method":"eth_chainId"} , {"method":"eth_blockNumber","params":[]} ] `,
	}
	for _, b := range good {
		if _, rej := jsonRPCClean([]byte(b), allowed, nil); rej != nil {
			t.Errorf("rejected %q", b)
		}
	}
}

func TestJSONRPCCleanReturnsTheValidatedBody(t *testing.T) {
	allowed := setOf("eth_call")
	out, rej := jsonRPCClean([]byte(` { "id" : 7 , "jsonrpc":"2.0", "params":[{"to":"0xabc","Method":"debug_x"},"latest"], "method":"eth_call" } `), allowed, nil)
	if rej != nil {
		t.Fatal(rej)
	}
	var got struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      int             `json:"id"`
		Method  string          `json:"method"`
		Params  json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("rebuilt body is not JSON: %v (%s)", err, out)
	}
	if got.Method != "eth_call" || got.ID != 7 || got.JSONRPC != "2.0" || !strings.Contains(string(got.Params), `"debug_x"`) {
		t.Fatalf("rebuilt body = %s", out)
	}
	// only the four known top-level members survive
	var top map[string]json.RawMessage
	_ = json.Unmarshal(out, &top)
	if len(top) != 4 {
		t.Fatalf("members = %v", top)
	}
}

type upstreamLog struct {
	mu     sync.Mutex
	bodies []string
}

func (u *upstreamLog) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		u.mu.Lock()
		u.bodies = append(u.bodies, string(b))
		u.mu.Unlock()
		_, _ = io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x1"}`)
	}
}
func (u *upstreamLog) count() int { u.mu.Lock(); defer u.mu.Unlock(); return len(u.bodies) }

// The same attack body is refused on every JSON-RPC route and never reaches the upstream.
func TestGatewayRPCRoutesRefuseTheDifferentialBody(t *testing.T) {
	attack := `{"jsonrpc":"2.0","id":1,"method":"web3_clientVersion","Method":"eth_chainId"}`
	for _, path := range []string{"/alchemy/1/rpc", "/helius/rpc", "/pimlico/1"} {
		up := &upstreamLog{}
		g, _ := testGateway(t, up.handler())
		g.keys.Pimlico = "pimlico-secret"
		if _, rej, err := call(t, g, "POST", path, attack); rej == nil || err != nil {
			t.Errorf("%s: rej=%v err=%v, want a rejection", path, rej, err)
		}
		if up.count() != 0 {
			t.Errorf("%s: the upstream was called", path)
		}
	}
}

func TestGatewayAlchemyForwardsOnlyTheValidatedBody(t *testing.T) {
	up := &upstreamLog{}
	g, _ := testGateway(t, up.handler())
	if _, rej, err := call(t, g, "POST", "/alchemy/1/rpc", `{ "jsonrpc":"2.0", "id":9, "method":"eth_blockNumber", "params":[] }`); rej != nil || err != nil {
		t.Fatalf("rej=%v err=%v", rej, err)
	}
	if up.count() != 1 {
		t.Fatalf("upstream calls = %d", up.count())
	}
	if got := up.bodies[0]; got != `{"jsonrpc":"2.0","id":9,"method":"eth_blockNumber","params":[]}` {
		t.Fatalf("upstream body = %s", got)
	}
}

// Audit A2: broadcasts only go through /v1/tx, and log queries follow the /v1/rpc policy.
func TestGatewayAlchemyBroadcastAndLogsPolicy(t *testing.T) {
	up := &upstreamLog{}
	g, _ := testGateway(t, up.handler())
	logs := func(f string) string {
		return `{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[` + f + `]}`
	}
	addr := `"address":"0x28c6c06298d514db089934071355e5743bf21d60"`
	refused := map[string]string{
		"raw broadcast":      `{"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":["0x02"]}`,
		"no filter":          logs(`{"fromBlock":"0x10","toBlock":"0x20"}`),
		"empty address":      logs(`{"address":[],"fromBlock":"0x10","toBlock":"0x20"}`),
		"tag range":          logs(`{` + addr + `,"fromBlock":"0x10","toBlock":"latest"}`),
		"no range":           logs(`{` + addr + `}`),
		"too wide":           logs(`{` + addr + `,"fromBlock":"0x1","toBlock":"0x7d2"}`),
		"inverted":           logs(`{` + addr + `,"fromBlock":"0x20","toBlock":"0x10"}`),
		"two filters":        `{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{` + addr + `,"fromBlock":"0x1","toBlock":"0x2"},{` + addr + `}]}`,
		"batch with the bad": `[{"method":"eth_chainId"},{"method":"eth_sendRawTransaction","params":["0x02"]}]`,
	}
	for name, body := range refused {
		if _, rej, err := call(t, g, "POST", "/alchemy/1/rpc", body); rej == nil || err != nil {
			t.Errorf("%s: accepted (rej=%v err=%v)", name, rej, err)
		}
	}
	if up.count() != 0 {
		t.Fatalf("the upstream saw %d refused calls", up.count())
	}
	allowed := map[string]string{
		"address + 2000 blocks": logs(`{` + addr + `,"fromBlock":"0x1","toBlock":"0x7d1"}`),
		"topic only":            logs(`{"topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],"fromBlock":"0x10","toBlock":"0x20"}`),
		"block hash":            logs(`{` + addr + `,"blockHash":"0x` + strings.Repeat("ab", 32) + `"}`),
	}
	for name, body := range allowed {
		if _, rej, err := call(t, g, "POST", "/alchemy/1/rpc", body); rej != nil || err != nil {
			t.Errorf("%s: rej=%v err=%v", name, rej, err)
		}
	}
}
