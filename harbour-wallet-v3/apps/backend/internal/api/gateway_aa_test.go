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

// H1: the server, not the client, chooses the sponsorship policy.
func TestGatewayPimlicoPinsSponsorPolicy(t *testing.T) {
	const op = `{"sender":"0x1111111111111111111111111111111111111111","nonce":"0x0"}`
	const ep = `"0x0000000071727De22E5E9d8BAf0edAc6f37da032"`
	sponsor := func(params string) string {
		return `{"jsonrpc":"2.0","id":3,"method":"pm_sponsorUserOperation","params":` + params + `}`
	}
	forwarded := func(t *testing.T, policy, body string) (string, *gwReject) {
		t.Helper()
		g, _ := testGateway(t, nil)
		g.keys.Pimlico = "pimlico-secret"
		g.keys.PimlicoPolicy = policy
		c, rej := g.resolve("POST", "/pimlico/84532", nil, []byte(body))
		if rej != nil {
			return "", rej
		}
		return string(c.body), nil
	}
	want := func(ctx string) string {
		return `{"jsonrpc":"2.0","id":3,"method":"pm_sponsorUserOperation","params":[` + op + `,` + ep + ctx + `]}`
	}
	policyCtx := `,{"sponsorshipPolicyId":"sp_server_policy"}`

	cases := map[string]struct{ policy, params, want string }{
		"no client context, policy set":         {"sp_server_policy", `[` + op + `,` + ep + `]`, want(policyCtx)},
		"client policy id replaced":             {"sp_server_policy", `[` + op + `,` + ep + `,{"sponsorshipPolicyId":"sp_attacker"}]`, want(policyCtx)},
		"client extra context fields dropped":   {"sp_server_policy", `[` + op + `,` + ep + `,{"token":"0xabc","sponsorshipPolicyId":"sp_attacker"}]`, want(policyCtx)},
		"client empty context, policy set":      {"sp_server_policy", `[` + op + `,` + ep + `,{}]`, want(policyCtx)},
		"policy unset: client context dropped":  {"", `[` + op + `,` + ep + `,{"sponsorshipPolicyId":"sp_attacker"}]`, want("")},
		"policy unset: no context stays absent": {"", `[` + op + `,` + ep + `]`, want("")},
	}
	for name, tc := range cases {
		got, rej := forwarded(t, tc.policy, sponsor(tc.params))
		if rej != nil || got != tc.want {
			t.Errorf("%s:\n got  %s (rej=%v)\n want %s", name, got, rej, tc.want)
		}
		if strings.Contains(got, "sp_attacker") || strings.Contains(got, "0xabc") {
			t.Errorf("%s: client context reached the upstream: %s", name, got)
		}
	}

	// malformed params fail closed; a configured id that is not a plain identifier fails closed
	for name, tc := range map[string]struct{ policy, body string }{
		"one param":         {"sp_server_policy", sponsor(`[` + op + `]`)},
		"four params":       {"sp_server_policy", sponsor(`[` + op + `,` + ep + `,{},{}]`)},
		"params an object":  {"sp_server_policy", sponsor(`{"a":1}`)},
		"bad configured id": {`sp"x`, sponsor(`[` + op + `,` + ep + `]`)},
	} {
		if got, rej := forwarded(t, tc.policy, tc.body); rej == nil {
			t.Errorf("%s: want refused, forwarded %s", name, got)
		}
	}

	// other methods are untouched
	other := `{"jsonrpc":"2.0","id":4,"method":"eth_estimateUserOperationGas","params":[` + op + `,` + ep + `]}`
	if got, rej := forwarded(t, "sp_server_policy", other); rej != nil || got != other {
		t.Errorf("estimate call changed: %s (rej=%v)", got, rej)
	}

	// batch: only the sponsor call is rewritten
	batch := `[` + other + `,` + sponsor(`[`+op+`,`+ep+`,{"sponsorshipPolicyId":"sp_attacker"}]`) + `]`
	if got, rej := forwarded(t, "sp_server_policy", batch); rej != nil || strings.Contains(got, "sp_attacker") || !strings.Contains(got, "sp_server_policy") || !strings.Contains(got, `"eth_estimateUserOperationGas"`) {
		t.Errorf("batch: %s (rej=%v)", got, rej)
	}
}
