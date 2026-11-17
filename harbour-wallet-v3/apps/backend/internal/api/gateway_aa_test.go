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
