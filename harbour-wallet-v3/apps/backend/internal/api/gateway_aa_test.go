package api

import (
	"strings"
	"testing"
)

// B1: the Pimlico route covers the smart-account testnets and still refuses unknown chains.
func TestGatewayPimlicoChains(t *testing.T) {
	body := `{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}`
	for chain, ok := range map[string]bool{
		"1": true, "56": true, "137": true, "42161": true, "8453": true, "11155111": true, "84532": true,
		"5": false, "0": false, "111551110": false, "845321": false, "10": false,
	} {
		g, _ := testGateway(t, nil)
		g.keys.Pimlico = "pimlico-secret"
		c, rej := g.resolve("POST", "/pimlico/"+chain, nil, []byte(body))
		if ok {
			if rej != nil || c == nil || !strings.Contains(c.url, "/"+chain+"/rpc?apikey=") {
				t.Errorf("chain %s: want allowed, rej=%v call=%+v", chain, rej, c)
			}
		} else if rej == nil {
			t.Errorf("chain %s: want refused", chain)
		}
	}
}

// B2: every bundler/paymaster method the smart-account flow uses is allowed; nothing else is.
func TestGatewayPimlicoMethods(t *testing.T) {
	allowed := []string{"eth_sendUserOperation", "eth_estimateUserOperationGas", "eth_getUserOperationReceipt", "eth_getUserOperationByHash",
		"eth_supportedEntryPoints", "pm_sponsorUserOperation", "pimlico_getUserOperationGasPrice"}
	denied := []string{"eth_sendRawTransaction", "eth_call", "debug_traceCall", "pimlico_getUserOperationStatus", "pm_getPaymasterData"}
	for _, m := range append(append([]string{}, allowed...), denied...) {
		want := false
		for _, a := range allowed {
			want = want || a == m
		}
		g, _ := testGateway(t, nil)
		g.keys.Pimlico = "pimlico-secret"
		_, rej := g.resolve("POST", "/pimlico/84532", nil, []byte(`{"jsonrpc":"2.0","id":1,"method":"`+m+`","params":[]}`))
		if want && rej != nil {
			t.Errorf("%s: want allowed, got rejection %v", m, rej)
		}
		if !want && rej == nil {
			t.Errorf("%s: want refused", m)
		}
	}
}
