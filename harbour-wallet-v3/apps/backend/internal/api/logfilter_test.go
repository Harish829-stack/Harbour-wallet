package api

import (
	"strings"
	"testing"
)

// Finding 21: the eth_getLogs guards must judge the filter the node receives. Go matches JSON keys case-insensitively and keeps the
// last duplicate; nodes do not, so a second, differently-cased key let an unfiltered whole-chain query through both guards.
func TestCanonLogFilterRefusesParserDifferentials(t *testing.T) {
	bad := []string{
		`[{"address":null,"ADDRESS":"0x00000000000000000000000000000000000000aa","fromBlock":"0x0","FROMBLOCK":"0xfffff0","toBlock":"latest"}]`,
		`[{"address":null,"Address":"0x00000000000000000000000000000000000000aa"}]`,
		`[{"address":"0x00000000000000000000000000000000000000aa","address":null}]`, // exact duplicate
		`[{"Topics":[["0x01"]]}]`, // wrong case only
		`[{"address":"0x00000000000000000000000000000000000000aa","limit":1}]`, // unknown key
		`[{"address":"0x00000000000000000000000000000000000000aa"},{}]`,        // two filters
		`[]`, `{}`, `null`, `[1]`, `["x"]`,
	}
	for _, b := range bad {
		if _, ok := canonLogFilter([]byte(b)); ok {
			t.Errorf("accepted %s", b)
		}
	}
	out, ok := canonLogFilter([]byte(`[ {"toBlock":"0x20","topics":[null,"0x01"],"fromBlock":"0x10","address":"0x00000000000000000000000000000000000000aa"} ]`))
	want := `[{"address":"0x00000000000000000000000000000000000000aa","topics":[null,"0x01"],"fromBlock":"0x10","toBlock":"0x20"}]`
	if !ok || string(out) != want {
		t.Fatalf("canonical form = %s (ok=%v), want %s", out, ok, want)
	}
	if out, ok := canonLogFilter([]byte(`[{"blockHash":"0xabc","topics":["0x01"]}]`)); !ok || !filteredLogs(out) {
		t.Fatalf("blockHash filter refused: %s", out)
	}
}

func TestGatewayLogsGuardSeesTheForwardedFilter(t *testing.T) {
	allowed := setOf("eth_getLogs")
	// The exact request that reached the node unfiltered from block 0 before the fix.
	attack := `{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"address":null,"ADDRESS":"0x00000000000000000000000000000000000000aa","fromBlock":"0x0","FROMBLOCK":"0x10","toBlock":"0x20"}]}`
	if _, rej := jsonRPCClean([]byte(attack), allowed, boundedLogs); rej == nil {
		t.Fatal("duplicate-key log filter accepted")
	}
	okBody := `{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"fromBlock":"0x10","toBlock":"0x20","address":"0x00000000000000000000000000000000000000aa"}]}`
	out, rej := jsonRPCClean([]byte(okBody), allowed, boundedLogs)
	if rej != nil {
		t.Fatalf("valid filter refused: %+v", rej)
	}
	if !strings.Contains(string(out), `"params":[{"address":"0x00000000000000000000000000000000000000aa","fromBlock":"0x10","toBlock":"0x20"}]`) {
		t.Fatalf("forwarded body is not the canonical filter: %s", out)
	}
}
