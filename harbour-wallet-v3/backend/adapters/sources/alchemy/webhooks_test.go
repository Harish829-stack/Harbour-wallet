package alchemy

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"harbour/backend/internal/core/index"
)

// Shaped like Alchemy's Address Activity example payload.
const delivery = `{
  "webhookId": "wh_octjglnywaupz6th",
  "id": "whevt_ogrc5v64myey69ux",
  "createdAt": "2026-10-28T06:20:01.123Z",
  "type": "ADDRESS_ACTIVITY",
  "event": {
    "network": "BASE_MAINNET",
    "activity": [
      {"blockNum": "0xdf34a3", "hash": "0x7A4A39DA2A3FA1FC2EF88FD1EAEA070286ED2ABA21E0419DCFB6D5C5D9F02A72",
       "fromAddress": "0x503828976d22510aad0201ac7ec88293211d23da", "toAddress": "0x1111111111111111111111111111111111111111",
       "value": 293.092129, "erc721TokenId": null, "erc1155Metadata": null, "asset": "USDC", "category": "token",
       "rawContract": {"rawValue": "0x0000000000000000000000000000000000000000000000000000000011783b21", "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "decimals": 6},
       "typeTraceAddress": null,
       "log": {"address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "topics": [], "data": "0x", "blockNumber": "0xdf34a3",
               "transactionHash": "0x7a4a39da2a3fa1fc2ef88fd1eaea070286ed2aba21e0419dcfb6d5c5d9f02a72", "transactionIndex": "0x46",
               "blockHash": "0xA99EC54413BD3DB3F9BDB0C1AD3AB1400EE0ECEFB47803E17F9D33BC4D0A1E91", "logIndex": "0x6e", "removed": false}},
      {"blockNum": "0xdf34a3", "hash": "0xaaa", "fromAddress": "0x1111111111111111111111111111111111111111", "toAddress": "0x2222222222222222222222222222222222222222",
       "value": 0.5, "asset": "ETH", "category": "external", "rawContract": {"rawValue": "0x6f05b59d3b20000", "address": null, "decimals": 18}},
      {"blockNum": "0xdf34a4", "hash": "0xbbb", "fromAddress": "0x2222222222222222222222222222222222222222", "toAddress": "0x1111111111111111111111111111111111111111",
       "value": 1, "asset": "ETH", "category": "internal", "typeTraceAddress": "CALL_0_1", "rawContract": {"rawValue": "0xde0b6b3a7640000", "address": null, "decimals": 18}},
      {"blockNum": "0xdf34a4", "hash": "0xccc", "fromAddress": "0x2222222222222222222222222222222222222222", "toAddress": "0x1111111111111111111111111111111111111111",
       "erc721TokenId": "0x2a", "asset": "CAT", "category": "token", "rawContract": {"rawValue": "0x", "address": "0xabc0000000000000000000000000000000000001"},
       "log": {"address": "0xabc0000000000000000000000000000000000001", "blockNumber": "0xdf34a4", "blockHash": "0xb2", "logIndex": "0x3", "removed": true}},
      {"blockNum": "0xdf34a4", "hash": "0xddd", "fromAddress": "0x2222222222222222222222222222222222222222", "toAddress": "0x1111111111111111111111111111111111111111",
       "erc1155Metadata": [{"tokenId": "0x1", "value": "0x2"}, {"tokenId": "0x7", "value": "0x1"}], "asset": null, "category": "erc1155",
       "rawContract": {"rawValue": "0x", "address": "0xabc0000000000000000000000000000000000002"},
       "log": {"address": "0xabc0000000000000000000000000000000000002", "blockNumber": "0xdf34a4", "blockHash": "0xb2", "logIndex": "0x9", "removed": false}}
    ]
  }
}`

func sign(key string, body []byte) string {
	m := hmac.New(sha256.New, []byte(key))
	m.Write(body)
	return hex.EncodeToString(m.Sum(nil))
}

func hookSource(t *testing.T, notifyURL string) *Source {
	s, err := New(index.SourceConfig{Name: "alchemy",
		Options: map[string]string{"notify_base_url": notifyURL},
		Chains:  map[string]map[string]string{"base": {"network": "base-mainnet", "webhook_network": "BASE_MAINNET"}},
		Getenv: func(k string) string {
			return map[string]string{"ALCHEMY_API_KEY": "k", "ALCHEMY_NOTIFY_TOKEN": "notify-tok"}[k]
		}})
	if err != nil {
		t.Fatal(err)
	}
	return s.(*Source)
}

func TestVerifyWebhook(t *testing.T) {
	s := hookSource(t, "")
	body := []byte(delivery)
	h := func(sig string) func(string) string {
		return func(k string) string {
			if k == "X-Alchemy-Signature" {
				return sig
			}
			return ""
		}
	}
	if err := s.VerifyWebhook(h(sign("whsec", body)), body, "whsec"); err != nil {
		t.Fatal(err)
	}
	if s.VerifyWebhook(h(sign("other", body)), body, "whsec") == nil {
		t.Fatal("wrong key accepted")
	}
	tampered := append([]byte{}, body...)
	tampered[10] ^= 1
	if s.VerifyWebhook(h(sign("whsec", body)), tampered, "whsec") == nil {
		t.Fatal("tampered body accepted")
	}
	if s.VerifyWebhook(h(""), body, "whsec") == nil || s.VerifyWebhook(h(sign("", body)), body, "") == nil {
		t.Fatal("missing signature or key accepted")
	}
	if id, _ := s.WebhookID(body); id != "wh_octjglnywaupz6th" {
		t.Fatalf("webhook id %q", id)
	}
}

func TestParseWebhook(t *testing.T) {
	s := hookSource(t, "")
	d, err := s.ParseWebhook([]byte(delivery))
	if err != nil {
		t.Fatal(err)
	}
	if d.Chain != "base" || d.ID != "whevt_ogrc5v64myey69ux" || len(d.Events) != 6 {
		t.Fatalf("delivery %+v", d)
	}
	usdc := d.Events[0]
	if usdc.EventRef != "log:110" || usdc.AmountRaw != "293092129" || usdc.Kind != index.KindToken ||
		usdc.BlockHash != "0xa99ec54413bd3db3f9bdb0c1ad3ab1400ee0ecefb47803e17f9d33bc4d0a1e91" ||
		usdc.TxHash != "0x7a4a39da2a3fa1fc2ef88fd1eaea070286ed2aba21e0419dcfb6d5c5d9f02a72" || !strings.Contains(string(usdc.Details), `"decimals":6`) {
		t.Fatalf("token %+v", usdc)
	}
	if e := d.Events[1]; e.Asset != "native" || e.EventRef != "tx:0" || e.AmountRaw != "500000000000000000" {
		t.Fatalf("external %+v", e)
	}
	// Internal transfers get the same ref the Transfers API path derives.
	if e := d.Events[2]; e.Kind != index.KindInternal || e.EventRef != internalRef(e.From, e.To, "1000000000000000000") {
		t.Fatalf("internal %+v", e)
	}
	if e := d.Events[3]; e.Kind != index.KindNFT || !e.Removed || !strings.Contains(string(e.Details), `"token_id":"42"`) {
		t.Fatalf("nft %+v", e)
	}
	if a, b := d.Events[4], d.Events[5]; a.EventRef != "log:9.0" || b.EventRef != "log:9.1" || b.AmountRaw != "1" {
		t.Fatalf("erc1155 %+v %+v", a, b)
	}
	if _, err := s.ParseWebhook([]byte(strings.Replace(delivery, "BASE_MAINNET", "ETH_HOLESKY", 1))); err == nil {
		t.Fatal("unconfigured network accepted")
	}
}

func TestNotifyAPI(t *testing.T) {
	var mu sync.Mutex
	var calls []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("X-Alchemy-Token") != "notify-tok" {
			w.WriteHeader(401)
			return
		}
		b, _ := io.ReadAll(r.Body)
		calls = append(calls, r.Method+" "+r.URL.RequestURI()+" "+string(b))
		switch r.URL.Path {
		case "/create-webhook":
			io.WriteString(w, `{"data":{"id":"wh_new","network":"BASE_MAINNET","webhook_type":"ADDRESS_ACTIVITY","webhook_url":"https://x/webhooks/alchemy","is_active":true,"signing_key":"whsec_new"}}`)
		default:
			io.WriteString(w, `{}`)
		}
	}))
	defer srv.Close()
	s := hookSource(t, srv.URL)
	ctx := context.Background()
	info, err := s.CreateWebhook(ctx, "base", "https://x/webhooks/alchemy", []string{"0x1111111111111111111111111111111111111111"})
	if err != nil || info.ID != "wh_new" || info.SigningKey != "whsec_new" || info.Chain != "base" {
		t.Fatalf("create %+v %v", info, err)
	}
	if err := s.UpdateWebhookAddresses(ctx, "wh_new", []string{"0xa"}, nil); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteWebhook(ctx, "wh_old"); err != nil {
		t.Fatal(err)
	}
	var create map[string]any
	json.Unmarshal([]byte(strings.SplitN(calls[0], " ", 3)[2]), &create)
	if create["network"] != "BASE_MAINNET" || create["webhook_type"] != "ADDRESS_ACTIVITY" {
		t.Fatalf("create body %v", create)
	}
	if !strings.HasPrefix(calls[1], `PATCH /update-webhook-addresses {"addresses_to_add":["0xa"],"addresses_to_remove":[],"webhook_id":"wh_new"}`) {
		t.Fatalf("update call %s", calls[1])
	}
	if !strings.HasPrefix(calls[2], "DELETE /delete-webhook?webhook_id=wh_old") {
		t.Fatalf("delete call %s", calls[2])
	}
	if !s.WebhooksEnabled() {
		t.Fatal("token configured but disabled")
	}
}
