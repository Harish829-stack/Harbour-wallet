package onramper

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Base URLs (docs.onramper.com API reference).
const (
	ProductionURL = "https://api.onramper.com"
	StagingURL    = "https://api-stg.onramper.com"
)

// Platform tells Onramper which client type starts the flow; providers that need platform allow-listing are only
// offered when it is set, and the same value must be used for quotes and checkout.
const Platform = "browser-extension"

var (
	// ErrUnauthorized: Onramper rejected the API key or signature (configuration problem, not the user's).
	ErrUnauthorized = errors.New("onramper: unauthorized")
	// ErrUnavailable: Onramper failed or timed out.
	ErrUnavailable = errors.New("onramper: unavailable")
)

// RequestError is a 4xx from Onramper other than auth. Message is Onramper's text, for logs only (never shown raw).
type RequestError struct {
	Status  int
	ErrorID string
	Message string
}

func (e *RequestError) Error() string {
	return fmt.Sprintf("onramper: HTTP %d %s %s", e.Status, e.ErrorID, e.Message)
}

// Client talks to the Onramper API. Signer is required only for checkout intents.
type Client struct {
	BaseURL string
	APIKey  string
	Signer  *Signer
	HTTP    *http.Client
}

func (c *Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 15 * time.Second}
}

func (c *Client) do(ctx context.Context, method, path string, query url.Values, body []byte, signed bool, extra map[string]string) ([]byte, error) {
	u := strings.TrimRight(c.BaseURL, "/") + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, u, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", c.APIKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if signed {
		if c.Signer == nil {
			return nil, errors.New("onramper: no signing key configured")
		}
		var params []Param
		for k, vs := range query {
			for _, v := range vs {
				params = append(params, Param{k, v})
			}
		}
		ct := ""
		if body != nil {
			ct = "application/json"
		}
		for k, v := range c.Signer.Headers(Request{Method: method, Path: path, Query: params, APIKey: c.APIKey, ContentType: ct, Body: body}) {
			req.Header.Set(k, v)
		}
	}
	for k, v := range extra {
		req.Header.Set(k, v)
	}
	res, err := c.http().Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		var e struct {
			Message string `json:"message"`
			ErrorID any    `json:"errorId"`
		}
		_ = json.Unmarshal(raw, &e)
		return nil, &RequestError{Status: res.StatusCode, ErrorID: fmt.Sprint(e.ErrorID), Message: trim(e.Message, 200)}
	case res.StatusCode >= 500:
		return nil, fmt.Errorf("%w: HTTP %d", ErrUnavailable, res.StatusCode)
	case res.StatusCode >= 400:
		var e struct {
			Message string `json:"message"`
			ErrorID any    `json:"errorId"`
		}
		_ = json.Unmarshal(raw, &e)
		return nil, &RequestError{Status: res.StatusCode, ErrorID: fmt.Sprint(e.ErrorID), Message: trim(e.Message, 200)}
	}
	return raw, nil
}

// IsAuth reports whether err is an Onramper 401/403 (bad key, bad signature, IP mismatch).
func IsAuth(err error) bool {
	var re *RequestError
	return errors.As(err, &re) && (re.Status == 401 || re.Status == 403)
}

func trim(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// ---------- supported assets ----------

// Crypto is one Onramper crypto currency (an asset on a network).
type Crypto struct {
	ID                 string `json:"id"`   // e.g. "usdc_base"; used in quotes and checkout
	Code               string `json:"code"` // ticker, e.g. "USDC"
	Name               string `json:"name"`
	Symbol             string `json:"symbol"`
	Network            string `json:"network"` // e.g. "ethereum"
	NetworkDisplayName string `json:"networkDisplayName"`
	Decimals           int    `json:"decimals"`
	Address            string `json:"address"` // token contract; empty for native coins
	ChainID            int64  `json:"chainId"` // EVM chain id when known, else 0
	Icon               string `json:"icon"`
}

// Fiat is one supported fiat currency.
type Fiat struct {
	ID     string `json:"id"`
	Code   string `json:"code"`
	Name   string `json:"name"`
	Symbol string `json:"symbol"`
	Icon   string `json:"icon"`
}

// Supported lists the currencies for a transaction type in a country (ISO 3166-1 alpha-2; "" lets Onramper use the
// caller IP, which for a server is the server's country, so callers should pass one).
func (c *Client) Supported(ctx context.Context, typ, country string) ([]Crypto, []Fiat, error) {
	q := url.Values{"type": {typ}}
	if country != "" {
		q.Set("country", country)
	}
	raw, err := c.do(ctx, http.MethodGet, "/supported", q, nil, false, nil)
	if err != nil {
		return nil, nil, err
	}
	var r struct {
		Message struct {
			Crypto []json.RawMessage `json:"crypto"`
			Fiat   []Fiat            `json:"fiat"`
		} `json:"message"`
	}
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, nil, fmt.Errorf("%w: bad supported response", ErrUnavailable)
	}
	out := make([]Crypto, 0, len(r.Message.Crypto))
	for _, m := range r.Message.Crypto {
		var x struct {
			Crypto
			ChainID json.RawMessage `json:"chainId"`
		}
		if json.Unmarshal(m, &x) != nil || x.ID == "" {
			continue
		}
		x.Crypto.ChainID = flexInt(x.ChainID)
		out = append(out, x.Crypto)
	}
	return out, r.Message.Fiat, nil
}

// flexInt reads a chain id given as a number, a decimal string or a hex string.
func flexInt(raw json.RawMessage) int64 {
	s := strings.Trim(strings.TrimSpace(string(raw)), `"`)
	if s == "" || s == "null" {
		return 0
	}
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		n, _ := strconv.ParseInt(s[2:], 16, 64)
		return n
	}
	n, _ := strconv.ParseInt(s, 10, 64)
	return n
}

// ---------- quotes ----------

// PaymentMethod is a payment type a provider accepts for a quote.
type PaymentMethod struct {
	ID   string `json:"paymentTypeId"`
	Name string `json:"name"`
	Icon string `json:"icon"`
}

// Quote is one provider's price for a payment method.
type Quote struct {
	Ramp            string          `json:"ramp"`
	PaymentMethod   string          `json:"paymentMethod"`
	Rate            float64         `json:"rate"`
	NetworkFee      float64         `json:"networkFee"`
	TransactionFee  float64         `json:"transactionFee"`
	Payout          float64         `json:"payout"`
	QuoteID         string          `json:"quoteId"`
	Recommendations []string        `json:"recommendations"`
	PaymentMethods  []PaymentMethod `json:"availablePaymentMethods"`
	Errors          []struct {
		Type    string `json:"type"`
		ErrorID any    `json:"errorId"`
		Message string `json:"message"`
	} `json:"errors"`
}

// QuoteRequest asks for quotes. For "buy" Source is the fiat and Destination the crypto id; for "sell" the reverse.
type QuoteRequest struct {
	Type, Source, Destination, Amount, Country, PaymentMethod string
	// WalletAddress is required by some providers (Binance Connect, Simplex, BTC Direct, ...). When set, the request is
	// signed (Signature V2), as Onramper requires for requests carrying a wallet address.
	WalletAddress string
}

// Quotes returns every provider's answer; entries with Errors or no Payout are kept so callers can explain gaps.
func (c *Client) Quotes(ctx context.Context, r QuoteRequest) ([]Quote, error) {
	q := url.Values{"amount": {r.Amount}, "type": {r.Type}, "platform": {Platform}}
	if r.Country != "" {
		q.Set("country", r.Country)
	}
	if r.PaymentMethod != "" {
		q.Set("paymentMethod", r.PaymentMethod)
	}
	signed := false
	if r.WalletAddress != "" && c.Signer != nil {
		q.Set("walletAddress", r.WalletAddress)
		signed = true
	}
	path := "/quotes/" + url.PathEscape(strings.ToLower(r.Source)) + "/" + url.PathEscape(strings.ToLower(r.Destination))
	raw, err := c.do(ctx, http.MethodGet, path, q, nil, signed, nil)
	if err != nil {
		return nil, err
	}
	var out []Quote
	if err := json.Unmarshal(raw, &out); err != nil {
		var wrapped struct {
			Message []Quote `json:"message"`
		}
		if json.Unmarshal(raw, &wrapped) != nil {
			return nil, fmt.Errorf("%w: bad quotes response", ErrUnavailable)
		}
		out = wrapped.Message
	}
	return out, nil
}

// ---------- checkout intent (V2, signed) ----------

// IntentRequest starts a checkout session with the chosen provider.
type IntentRequest struct {
	Type           string // buy | sell
	Onramp         string // provider id from the quote ("ramp")
	Source         string // fiat for buy, crypto id for sell
	Destination    string // crypto id for buy, fiat for sell
	Amount         float64
	PaymentMethod  string
	Network        string // required for buy
	WalletAddress  string // required for buy
	EndUserIPHash  string // HashIP(end user IP)
	Country        string
	PartnerContext string // Harbour order id, echoed on webhooks
	SuccessURL     string // where the provider sends the browser after a purchase
}

// Intent is Onramper's answer: open RedirectURL unmodified (it carries a one-time resume token).
type Intent struct {
	RedirectURL string `json:"redirectUrl"`
	SessionID   string `json:"sessionId"`
}

// IntentBody builds the canonical JSON body (exported for tests).
func IntentBody(r IntentRequest) ([]byte, error) {
	body := map[string]any{
		"onramp": r.Onramp, "source": strings.ToLower(r.Source), "destination": strings.ToLower(r.Destination),
		"amount": r.Amount, "type": r.Type, "paymentMethod": r.PaymentMethod, "endUserIpHash": r.EndUserIPHash,
		"platform": Platform,
	}
	if r.Type == "buy" {
		body["network"] = r.Network
		body["wallet"] = map[string]any{"address": r.WalletAddress}
	}
	if r.Country != "" {
		body["country"] = strings.ToLower(r.Country)
	}
	if r.PartnerContext != "" {
		body["partnerContext"] = r.PartnerContext
	}
	if r.SuccessURL != "" {
		body["supportedParams"] = map[string]any{"partnerData": map[string]any{"redirectUrl": map[string]any{"success": r.SuccessURL}}}
	}
	return Canonicalize(body)
}

// CreateIntent signs and sends POST /checkout/v2/intent. The returned URL is checked to be an https Onramper page.
func (c *Client) CreateIntent(ctx context.Context, r IntentRequest) (Intent, error) {
	body, err := IntentBody(r)
	if err != nil {
		return Intent{}, err
	}
	raw, err := c.do(ctx, http.MethodPost, "/checkout/v2/intent", nil, body, true, nil)
	if err != nil {
		return Intent{}, err
	}
	var in Intent
	if err := json.Unmarshal(raw, &in); err != nil || in.RedirectURL == "" {
		return Intent{}, fmt.Errorf("%w: bad intent response", ErrUnavailable)
	}
	if !TrustedCheckoutURL(in.RedirectURL) {
		return Intent{}, fmt.Errorf("%w: checkout URL is not an Onramper page", ErrUnavailable)
	}
	return in, nil
}

// TrustedCheckoutURL accepts only https URLs on onramper.com / onramper.dev without credentials.
func TrustedCheckoutURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil {
		return false
	}
	h := strings.ToLower(u.Hostname())
	for _, d := range []string{"onramper.com", "onramper.dev"} {
		if h == d || strings.HasSuffix(h, "."+d) {
			return true
		}
	}
	return false
}
