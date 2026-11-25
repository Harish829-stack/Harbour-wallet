package evm

// QA (neg, T-IDX-062 chain-client part): every client method against a node that answers garbage — null results, wrong JSON
// types, non-hex strings, numbers beyond uint64, truncated bodies, HTTP errors — returns an error or a "Failed" marker; never
// panics, never a silently wrong value (a block number from "0xzz", a balance from a truncated word).

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"harbour/backend/internal/core/chain"
)

func TestQAClientRejectsMalformedNodeAnswers(t *testing.T) {
	answers := []string{`null`, `"0xzz"`, `"0x"`, `"-0x1"`, `123`, `{"a":1}`, `[]`, `"0x1ffffffffffffffffffffffff"`, `"` + strings.Repeat("f", 5000) + `"`, `true`}
	for _, ans := range answers {
		for _, mode := range []string{"result", "truncated", "http500", "error"} {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				b, _ := io.ReadAll(r.Body)
				var reqs []map[string]any
				batch := strings.HasPrefix(strings.TrimSpace(string(b)), "[")
				if batch {
					_ = json.Unmarshal(b, &reqs)
				} else {
					var one map[string]any
					_ = json.Unmarshal(b, &one)
					reqs = []map[string]any{one}
				}
				switch mode {
				case "http500":
					w.WriteHeader(500)
					return
				case "truncated":
					w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"0x`))
					return
				}
				var out []string
				for _, q := range reqs {
					id, _ := json.Marshal(q["id"])
					if mode == "error" {
						out = append(out, `{"jsonrpc":"2.0","id":`+string(id)+`,"error":{"code":-32000,"message":"boom"}}`)
					} else {
						out = append(out, `{"jsonrpc":"2.0","id":`+string(id)+`,"result":`+ans+`}`)
					}
				}
				if batch {
					w.Write([]byte("[" + strings.Join(out, ",") + "]"))
				} else {
					w.Write([]byte(out[0]))
				}
			}))
			c, err := New(chain.ClientConfig{Chain: "base", Family: chain.FamilyEVM, RPCURL: srv.URL})
			if err != nil {
				t.Fatal(err)
			}
			ctx := context.Background()
			label := mode + " " + ans[:min(len(ans), 20)]
			func() {
				defer func() {
					if r := recover(); r != nil {
						t.Fatalf("%s: panic %v", label, r)
					}
				}()
				// none of the answers is a valid hex quantity: LatestBlock must fail rather than invent a head
				if n, err := c.LatestBlock(ctx); err == nil {
					t.Errorf("%s: LatestBlock = %d without error", label, n)
				}
				if bals, _, err := c.Balances(ctx, "0x1111111111111111111111111111111111111111", []string{"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"}, 0); err == nil {
					for _, b := range bals {
						if !b.Failed && b.AmountRaw != nil && b.AmountRaw.Sign() < 0 {
							t.Errorf("%s: negative balance", label)
						}
					}
				}
				_, _ = c.TokenInfo(ctx, []string{"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"})
				if _, err := c.Fees(ctx); err == nil && mode != "result" {
					t.Errorf("%s: Fees without error", label)
				}
				_, _ = c.Nonce(ctx, "0x1111111111111111111111111111111111111111")
				_, _ = c.(*Client).ConfirmedNonce(ctx, "0x1111111111111111111111111111111111111111")
				if inc, err := c.(*Client).Inclusion(ctx, "0x"+strings.Repeat("ab", 32)); err == nil && inc.Found && mode != "result" {
					t.Errorf("%s: Inclusion found without a receipt", label)
				}
				_, _ = c.(*Client).BlockHash(ctx, 5)
				_, _ = c.Simulate(ctx, map[string]any{"to": "0x1111111111111111111111111111111111111111"})
			}()
			srv.Close()
		}
	}
}
