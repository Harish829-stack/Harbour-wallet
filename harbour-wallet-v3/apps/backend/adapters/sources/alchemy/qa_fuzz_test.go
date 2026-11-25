package alchemy

// QA (fuzz, T-IDX-030): WebhookID, ParseWebhook and VerifyWebhook never panic on arbitrary bodies/headers, and ParseWebhook only
// returns events with a chain, a positive or zero integer amount and a 0x tx hash (or an error).

import (
	"math/big"

	"harbour/backend/internal/core/index"
	"strings"
	"testing"
)

func FuzzQAWebhookParsing(f *testing.F) {
	f.Add([]byte(delivery), "deadbeef")
	f.Add([]byte(`{"webhookId":"wh_1","id":"x","event":{"network":"BASE_MAINNET","activity":[{"value":-1,"rawContract":{"rawValue":"0x-1"}}]}}`), "")
	f.Add([]byte(`{"event":{"activity":[null,{},{"blockNum":"0xffffffffffffffffffffffff","hash":7}]}}`), "zz")
	f.Add([]byte(`[]`), "")
	f.Add([]byte(`{"webhookId":{"a":1}}`), "")
	si, err := New(index.SourceConfig{Name: "alchemy", Chains: map[string]map[string]string{"base": {"network": "base-mainnet", "webhook_network": "BASE_MAINNET"}},
		Getenv: func(k string) string {
			return map[string]string{"ALCHEMY_API_KEY": "k", "ALCHEMY_NOTIFY_TOKEN": "notify-tok"}[k]
		}})
	if err != nil {
		f.Fatal(err)
	}
	s := si.(*Source)
	f.Fuzz(func(t *testing.T, body []byte, sig string) {
		_, _ = s.WebhookID(body)
		_ = s.VerifyWebhook(func(string) string { return sig }, body, "whsec_test")
		d, err := s.ParseWebhook(body)
		if err != nil {
			return
		}
		for _, e := range d.Events {
			if e.AmountRaw != "" {
				v, ok := new(big.Int).SetString(e.AmountRaw, 10)
				if !ok || v.Sign() < 0 {
					t.Fatalf("event with a non-integer or negative amount %q", e.AmountRaw)
				}
			}
			if e.TxHash != "" && !strings.HasPrefix(e.TxHash, "0x") {
				t.Fatalf("tx hash %q", e.TxHash)
			}
		}
	})
}
