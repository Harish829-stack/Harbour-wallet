package alchemy

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"harbour/backend/internal/core/index"
)

// Address Activity webhooks (Alchemy Notify).

const maxAddressesPerWebhook = 100_000

// internalRef is a position for an internal (trace) transfer that both the
// Transfers API and webhooks can derive: they expose different trace ids,
// so the ref is derived from what both carry (from, to, amount).
func internalRef(from, to, amountDec string) string {
	h := sha256.Sum256([]byte(strings.ToLower(from) + "|" + strings.ToLower(to) + "|" + amountDec))
	return "trace:" + strconv.FormatUint(binary.BigEndian.Uint64(h[:8])>>1, 10)
}

// WebhooksEnabled reports whether a Notify auth token is configured.
func (s *Source) WebhooksEnabled() bool { return s.notifyToken != "" }

// MaxAddressesPerWebhook is Alchemy's per-webhook cap.
func (s *Source) MaxAddressesPerWebhook() int { return maxAddressesPerWebhook }

type deliveryEnvelope struct {
	WebhookID string `json:"webhookId"`
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	Type      string `json:"type"`
	Event     struct {
		Network  string            `json:"network"`
		Activity []webhookActivity `json:"activity"`
	} `json:"event"`
}

type webhookActivity struct {
	BlockNum      string `json:"blockNum"`
	Hash          string `json:"hash"`
	FromAddress   string `json:"fromAddress"`
	ToAddress     string `json:"toAddress"`
	Asset         string `json:"asset"`
	Category      string `json:"category"`
	ERC721TokenID string `json:"erc721TokenId"`
	ERC1155       []struct {
		TokenID string `json:"tokenId"`
		Value   string `json:"value"`
	} `json:"erc1155Metadata"`
	RawContract struct {
		RawValue string          `json:"rawValue"`
		Address  string          `json:"address"`
		Decimals json.RawMessage `json:"decimals"`
		Decimal  json.RawMessage `json:"decimal"`
	} `json:"rawContract"`
	TypeTraceAddress string `json:"typeTraceAddress"`
	Log              *struct {
		Address     string `json:"address"`
		BlockNumber string `json:"blockNumber"`
		BlockHash   string `json:"blockHash"`
		LogIndex    string `json:"logIndex"`
		Removed     bool   `json:"removed"`
	} `json:"log"`
}

// WebhookID extracts webhookId.
func (s *Source) WebhookID(body []byte) (string, error) {
	var e struct {
		WebhookID string `json:"webhookId"`
	}
	if err := json.Unmarshal(body, &e); err != nil || e.WebhookID == "" {
		return "", errors.New("alchemy: delivery has no webhookId")
	}
	return e.WebhookID, nil
}

// VerifyWebhook checks X-Alchemy-Signature = hex(HMAC-SHA256(signingKey, body)).
func (s *Source) VerifyWebhook(header func(string) string, body []byte, signingKey string) error {
	if signingKey == "" {
		return errors.New("alchemy: no signing key for this webhook")
	}
	got, err := hex.DecodeString(strings.TrimSpace(header("X-Alchemy-Signature")))
	if err != nil || len(got) != sha256.Size {
		return errors.New("alchemy: missing or malformed signature")
	}
	m := hmac.New(sha256.New, []byte(signingKey))
	m.Write(body)
	if !hmac.Equal(m.Sum(nil), got) {
		return errors.New("alchemy: bad signature")
	}
	return nil
}

func (s *Source) chainForNetwork(network string) (string, bool) {
	for chain, o := range s.chains {
		if strings.EqualFold(o.webhookNetwork, network) {
			return chain, true
		}
	}
	return "", false
}

func decimalsOf(raws ...json.RawMessage) (int, bool) {
	for _, r := range raws {
		if len(r) == 0 || string(r) == "null" {
			continue
		}
		var n int
		if json.Unmarshal(r, &n) == nil {
			return n, true
		}
		var s string
		if json.Unmarshal(r, &s) == nil {
			if v, ok := hexToDec(s); ok && strings.HasPrefix(s, "0x") {
				n, _ = strconv.Atoi(v)
				return n, true
			}
			if n, err := strconv.Atoi(s); err == nil {
				return n, true
			}
		}
	}
	return 0, false
}

// ParseWebhook converts an Address Activity delivery to ActivityEvents.
// Deliveries carry no block timestamp; createdAt (seconds after the block)
// stands in for live events.
func (s *Source) ParseWebhook(body []byte) (index.Delivery, error) {
	var env deliveryEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		return index.Delivery{}, fmt.Errorf("alchemy: bad delivery: %w", err)
	}
	if env.Type != "" && env.Type != "ADDRESS_ACTIVITY" {
		return index.Delivery{}, fmt.Errorf("alchemy: unsupported webhook type %q", env.Type)
	}
	chain, ok := s.chainForNetwork(env.Event.Network)
	if !ok {
		return index.Delivery{}, fmt.Errorf("alchemy: network %q not configured", env.Event.Network)
	}
	at, err := time.Parse(time.RFC3339Nano, env.CreatedAt)
	if err != nil {
		at = s.now()
	}
	d := index.Delivery{ID: env.ID, WebhookID: env.WebhookID, Chain: chain}
	for _, a := range env.Event.Activity {
		blockHex := a.BlockNum
		if blockHex == "" && a.Log != nil {
			blockHex = a.Log.BlockNumber
		}
		block, err := strconv.ParseUint(strings.TrimPrefix(blockHex, "0x"), 16, 64)
		if err != nil {
			return index.Delivery{}, fmt.Errorf("alchemy: bad blockNum %q", blockHex)
		}
		ev := index.ActivityEvent{Chain: chain, Family: "evm", TxHash: strings.ToLower(a.Hash), BlockNumber: block,
			BlockTime: at.UTC(), From: strings.ToLower(a.FromAddress), To: strings.ToLower(a.ToAddress)}
		if a.Log != nil {
			ev.BlockHash = strings.ToLower(a.Log.BlockHash)
			ev.Removed = a.Log.Removed
			if n, ok := parseIndex(a.Log.LogIndex); ok {
				ev.EventRef = "log:" + strconv.FormatUint(n, 10)
			}
		}
		amount, ok := hexToDec(a.RawContract.RawValue)
		if !ok {
			return index.Delivery{}, fmt.Errorf("alchemy: bad rawValue %q", a.RawContract.RawValue)
		}
		contract := strings.ToLower(a.RawContract.Address)
		if contract == "" && a.Log != nil {
			contract = strings.ToLower(a.Log.Address)
		}
		details := map[string]any{}
		switch {
		case a.Category == "external":
			ev.Asset, ev.Kind, ev.AmountRaw, ev.EventRef = "native", index.KindNative, amount, "tx:0"
		case a.Category == "internal":
			ev.Asset, ev.Kind, ev.AmountRaw = "native", index.KindInternal, amount
			ev.EventRef = internalRef(ev.From, ev.To, amount)
		case len(a.ERC1155) > 0 || a.Category == "erc1155":
			for i, m := range a.ERC1155 {
				e := ev
				e.Asset, e.Kind = contract, index.KindMulti
				v, ok := hexToDec(m.Value)
				if !ok {
					return index.Delivery{}, fmt.Errorf("alchemy: bad erc1155 value %q", m.Value)
				}
				e.AmountRaw = v
				e.EventRef = fmt.Sprintf("%s.%d", ev.EventRef, i)
				tid, _ := hexToDec(m.TokenID)
				e.Details, _ = json.Marshal(map[string]any{index.DetailTokenID: tid})
				d.Events = append(d.Events, e)
			}
			continue
		case a.ERC721TokenID != "" || a.Category == "erc721":
			ev.Asset, ev.Kind, ev.AmountRaw = contract, index.KindNFT, "1"
			if tid, ok := hexToDec(a.ERC721TokenID); ok {
				details[index.DetailTokenID] = tid
			}
		case (a.Category == "token" || a.Category == "erc20") && index.IsNativeTransferLog(contract):
			continue // EIP-7708 log of a native transfer: the "external" leg already covers it
		case a.Category == "token" || a.Category == "erc20":
			ev.Asset, ev.Kind, ev.AmountRaw = contract, index.KindToken, amount
			if a.Asset != "" {
				details[index.DetailSymbol] = a.Asset
			}
			if n, ok := decimalsOf(a.RawContract.Decimals, a.RawContract.Decimal); ok {
				details[index.DetailDecimals] = n
			}
		default:
			continue
		}
		if ev.EventRef == "" || ev.Asset == "" {
			continue // no stable position: gap-fill will deliver it
		}
		if len(details) > 0 {
			ev.Details, _ = json.Marshal(details)
		}
		d.Events = append(d.Events, ev)
	}
	return d, nil
}

// ---------- Notify API ----------

func (s *Source) notify(ctx context.Context, method, path string, body any, out any) error {
	if s.notifyToken == "" {
		return errors.New("alchemy: ALCHEMY_NOTIFY_TOKEN is not set")
	}
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(s.notifyBase, "/")+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("X-Alchemy-Token", s.notifyToken)
	req.Header.Set("Content-Type", "application/json")
	if out == nil {
		out = &json.RawMessage{}
	}
	return s.do(ctx, req, out)
}

// CreateWebhook creates an Address Activity webhook for chain.
func (s *Source) CreateWebhook(ctx context.Context, chain, hookURL string, addresses []string) (index.WebhookInfo, error) {
	o, err := s.opts(chain)
	if err != nil {
		return index.WebhookInfo{}, err
	}
	if o.webhookNetwork == "" {
		return index.WebhookInfo{}, fmt.Errorf("alchemy: chain %s has no webhook_network option", chain)
	}
	var r struct {
		Data struct {
			ID         string `json:"id"`
			WebhookURL string `json:"webhook_url"`
			SigningKey string `json:"signing_key"`
		} `json:"data"`
	}
	err = s.notify(ctx, http.MethodPost, "/create-webhook", map[string]any{
		"network": o.webhookNetwork, "webhook_type": "ADDRESS_ACTIVITY", "webhook_url": hookURL,
		"addresses": addresses, "name": "harbour-" + chain,
	}, &r)
	if err != nil {
		return index.WebhookInfo{}, err
	}
	if r.Data.ID == "" || r.Data.SigningKey == "" {
		return index.WebhookInfo{}, errors.New("alchemy: create-webhook returned no id or signing key")
	}
	return index.WebhookInfo{ID: r.Data.ID, Chain: chain, URL: hookURL, SigningKey: r.Data.SigningKey}, nil
}

// UpdateWebhookAddresses adds and removes addresses (idempotent).
func (s *Source) UpdateWebhookAddresses(ctx context.Context, webhookID string, add, remove []string) error {
	if add == nil {
		add = []string{}
	}
	if remove == nil {
		remove = []string{}
	}
	return s.notify(ctx, http.MethodPatch, "/update-webhook-addresses", map[string]any{
		"webhook_id": webhookID, "addresses_to_add": add, "addresses_to_remove": remove,
	}, nil)
}

// DeleteWebhook deletes a webhook.
func (s *Source) DeleteWebhook(ctx context.Context, webhookID string) error {
	return s.notify(ctx, http.MethodDelete, "/delete-webhook?webhook_id="+url.QueryEscape(webhookID), nil, nil)
}
