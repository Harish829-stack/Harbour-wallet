package api

// Fiat on/off-ramp through Onramper (buy and sell crypto with a card or bank). The backend holds the Onramper API key
// and the Ed25519 signing key; the extension only ever sends the wallet's public address, and gets back an Onramper
// checkout page that it opens in a tab. Onramper webhooks (cmd/webhook-ingest) move orders forward.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"harbour/backend/internal/onramper"
	"harbour/backend/internal/store"
)

// RampsOptions enable /v1/ramps. A nil Client turns the feature off (endpoints answer 503).
type RampsOptions struct {
	Client *onramper.Client
	// ReturnURL is the public URL of GET /v1/ramps/return. Providers send the browser there after a purchase, which is
	// how the extension knows the checkout tab is finished. Empty: no redirect (the extension still polls orders).
	ReturnURL string
	// MaxOrdersPerHour bounds checkout creation per device (default 20).
	MaxOrdersPerHour int
	// TestCountry forces the Onramper country (staging only, RAMPS_TEST_COUNTRY) so a developer can try providers and
	// currencies of another country, e.g. "gb" for Banxa + GBP in the sandbox.
	TestCountry string
}

const (
	rampsConfigTTL = time.Hour
	rampsUnavail   = "Buying and selling crypto is unavailable right now. Please try again later."
)

var (
	rampCurrencyRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{0,47}$`)
	rampWordRe     = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,47}$`)
	rampChainRe    = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,47}$`)
	rampAmountRe   = regexp.MustCompile(`^\d{1,12}(\.\d{1,18})?$`)
	rampCountryRe  = regexp.MustCompile(`^[a-z]{2}$`)
	rampOtherAddr  = regexp.MustCompile(`^[A-Za-z0-9:_\-.]{20,128}$`)
)

func (s *Server) rampsOn(w http.ResponseWriter) bool {
	if s.opt.Ramps == nil || s.opt.Ramps.Client == nil {
		writeErr(w, http.StatusServiceUnavailable, "ramps_unavailable", rampsUnavail, false)
		return false
	}
	return true
}

func rampType(v string) (string, bool) {
	switch v {
	case "", "buy":
		return "buy", true
	case "sell":
		return "sell", true
	}
	return "", false
}

// rampCountry: the client's choice, else Cloudflare's CF-IPCountry when the API sits behind the operator's proxy, else ""
// (Onramper would then use the backend's own IP, so the extension always sends one when it knows it).
func (s *Server) rampCountry(r *http.Request) string {
	if s.opt.Ramps != nil && s.opt.Ramps.TestCountry != "" {
		return s.opt.Ramps.TestCountry
	}
	if c := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("country"))); rampCountryRe.MatchString(c) {
		return c
	}
	if s.opt.TrustProxy {
		if c := strings.ToLower(strings.TrimSpace(r.Header.Get("CF-IPCountry"))); rampCountryRe.MatchString(c) && c != "xx" && c != "t1" {
			return c
		}
	}
	return ""
}

func (s *Server) rampUpstreamErr(w http.ResponseWriter, r *http.Request, err error, msg4xx string) {
	var re *onramper.RequestError
	switch {
	case onramper.IsAuth(err):
		s.opt.Log.Error("onramper rejected the request (check ONRAMPER_API_KEY / signing key / registered public key)", "route", routePattern(r), "err", err)
		writeErr(w, http.StatusServiceUnavailable, "ramps_unavailable", rampsUnavail, true)
	case errors.As(err, &re):
		s.opt.Log.Warn("onramper refused the request", "route", routePattern(r), "status", re.Status, "error_id", re.ErrorID, "msg", re.Message)
		writeErr(w, http.StatusBadRequest, "ramps_rejected", msg4xx, false)
	default:
		s.opt.Log.Warn("onramper unavailable", "route", routePattern(r), "err", err)
		writeErr(w, http.StatusBadGateway, "ramps_upstream", "The payment provider is not responding. Please try again.", true)
	}
}

// ---------- GET /v1/ramps/config?type=buy&country=de ----------

type rampsConfigResp struct {
	Country string            `json:"country"`
	Type    string            `json:"type"`
	Cryptos []onramper.Crypto `json:"cryptos"`
	Fiats   []onramper.Fiat   `json:"fiats"`
}

func (s *Server) handleRampsConfig(w http.ResponseWriter, r *http.Request) {
	if !s.rampsOn(w) {
		return
	}
	typ, ok := rampType(r.URL.Query().Get("type"))
	if !ok {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	country := s.rampCountry(r)
	key := "hb:ramps:cfg:" + typ + ":" + country
	ctx := r.Context()
	if s.opt.CacheRedis != nil {
		if b, err := s.opt.CacheRedis.Get(ctx, key).Bytes(); err == nil && len(b) > 0 {
			w.Header().Set("Content-Type", "application/json")
			w.Write(b)
			return
		}
	}
	cryptos, fiats, err := s.opt.Ramps.Client.Supported(ctx, typ, country)
	if err != nil {
		s.rampUpstreamErr(w, r, err, rampsUnavail)
		return
	}
	b, _ := json.Marshal(rampsConfigResp{Country: country, Type: typ, Cryptos: cryptos, Fiats: fiats})
	if s.opt.CacheRedis != nil {
		_ = s.opt.CacheRedis.Set(ctx, key, b, rampsConfigTTL).Err()
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(b)
}

// ---------- GET /v1/ramps/quotes?type=buy&source=eur&destination=eth&amount=100&country=de ----------

type rampQuoteView struct {
	Provider        string                   `json:"provider"`
	PaymentMethod   string                   `json:"payment_method"`
	PaymentMethods  []onramper.PaymentMethod `json:"payment_methods"`
	Rate            float64                  `json:"rate"`
	Payout          float64                  `json:"payout"`
	NetworkFee      float64                  `json:"network_fee"`
	TransactionFee  float64                  `json:"transaction_fee"`
	Recommendations []string                 `json:"recommendations"`
}

func (s *Server) handleRampsQuotes(w http.ResponseWriter, r *http.Request) {
	if !s.rampsOn(w) {
		return
	}
	q := r.URL.Query()
	typ, ok := rampType(q.Get("type"))
	src, dst, amt := strings.ToLower(q.Get("source")), strings.ToLower(q.Get("destination")), q.Get("amount")
	pm := strings.ToLower(q.Get("payment_method"))
	wallet := q.Get("wallet_address") // optional (buy): some providers only quote with the receiving address
	if !ok || !rampCurrencyRe.MatchString(src) || !rampCurrencyRe.MatchString(dst) || !rampAmountRe.MatchString(amt) || (pm != "" && !rampWordRe.MatchString(pm)) ||
		(wallet != "" && (typ != "buy" || !(evmAddr.MatchString(wallet) || rampOtherAddr.MatchString(wallet)))) {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	if f, _ := strconv.ParseFloat(amt, 64); f <= 0 {
		writeErr(w, http.StatusBadRequest, "bad_amount", "Enter an amount greater than 0.", false)
		return
	}
	quotes, err := s.opt.Ramps.Client.Quotes(r.Context(), onramper.QuoteRequest{Type: typ, Source: src, Destination: dst, Amount: amt, Country: s.rampCountry(r), PaymentMethod: pm, WalletAddress: wallet})
	if err != nil {
		s.rampUpstreamErr(w, r, err, "No provider can quote this pair right now.")
		return
	}
	out := make([]rampQuoteView, 0, len(quotes))
	unavailable := []string{}
	for _, x := range quotes {
		prov := strings.ToLower(x.Ramp)
		if !rampWordRe.MatchString(prov) {
			continue
		}
		if len(x.Errors) > 0 || x.Payout <= 0 {
			unavailable = append(unavailable, prov)
			continue
		}
		if x.PaymentMethods == nil {
			x.PaymentMethods = []onramper.PaymentMethod{}
		}
		if x.Recommendations == nil {
			x.Recommendations = []string{}
		}
		out = append(out, rampQuoteView{Provider: prov, PaymentMethod: strings.ToLower(x.PaymentMethod), PaymentMethods: x.PaymentMethods, Rate: x.Rate,
			Payout: x.Payout, NetworkFee: x.NetworkFee, TransactionFee: x.TransactionFee, Recommendations: x.Recommendations})
	}
	if len(out) == 0 && len(quotes) > 0 {
		// Operator diagnostics: why every provider declined (Onramper error type/id, never shown to the user).
		reasons := map[string]int{}
		for _, x := range quotes {
			for _, e := range x.Errors {
				msg := e.Message
				if len(msg) > 120 {
					msg = msg[:120]
				}
				reasons[fmt.Sprintf("%s/%v: %s", e.Type, e.ErrorID, msg)]++
			}
		}
		s.opt.Log.Warn("onramper returned no usable quotes", "type", typ, "source", src, "destination", dst, "country", s.rampCountry(r), "reasons", reasons)
	}
	writeJSON(w, http.StatusOK, map[string]any{"quotes": out, "unavailable": unavailable})
}

// ---------- POST /v1/ramps/checkout ----------

type rampCheckoutReq struct {
	Type          string `json:"type"`
	Provider      string `json:"provider"`
	PaymentMethod string `json:"payment_method"`
	Source        string `json:"source"`      // fiat (buy) or crypto id (sell)
	Destination   string `json:"destination"` // crypto id (buy) or fiat (sell)
	Network       string `json:"network"`     // Onramper network of the crypto (buy)
	Chain         string `json:"chain"`       // Harbour network id, for the order list
	Amount        string `json:"amount"`
	Address       string `json:"address"` // the wallet's own receiving address (buy)
	Country       string `json:"country"`
}

// rampAddressOwned: an EVM address must be one this device registered (one key serves every EVM chain, so any chain counts).
// Other families are not tracked by the backend yet and get a strict shape check only.
func (s *Server) rampAddressOwned(ctx context.Context, deviceID, addr string) (bool, error) {
	if !evmAddr.MatchString(addr) {
		return rampOtherAddr.MatchString(addr) && !strings.HasPrefix(strings.ToLower(addr), "0x"), nil
	}
	addrs, err := s.opt.Store.DeviceAddresses(ctx, s.opt.LinkCrypto, deviceID)
	if err != nil {
		return false, err
	}
	for _, a := range addrs {
		if strings.EqualFold(a.Address, addr) {
			return true, nil
		}
	}
	return false, nil
}

// endUserIP is the caller's full address (realIP has already applied trusted X-Forwarded-For).
func endUserIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.String()
	}
	return host
}

func (s *Server) handleRampsCheckout(w http.ResponseWriter, r *http.Request) {
	if !s.rampsOn(w) {
		return
	}
	ctx := r.Context()
	d := deviceFrom(ctx)
	var req rampCheckoutReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	typ, ok := rampType(req.Type)
	req.Provider, req.PaymentMethod = strings.ToLower(req.Provider), strings.ToLower(req.PaymentMethod)
	req.Source, req.Destination, req.Network = strings.ToLower(req.Source), strings.ToLower(req.Destination), strings.ToLower(req.Network)
	req.Country = strings.ToLower(req.Country)
	if !ok || !rampWordRe.MatchString(req.Provider) || !rampWordRe.MatchString(req.PaymentMethod) || !rampCurrencyRe.MatchString(req.Source) ||
		!rampCurrencyRe.MatchString(req.Destination) || !rampChainRe.MatchString(req.Chain) || !rampAmountRe.MatchString(req.Amount) ||
		(req.Country != "" && !rampCountryRe.MatchString(req.Country)) || (typ == "buy" && !rampWordRe.MatchString(req.Network)) {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	amount, err := strconv.ParseFloat(req.Amount, 64)
	if err != nil || amount <= 0 {
		writeErr(w, http.StatusBadRequest, "bad_amount", "Enter an amount greater than 0.", false)
		return
	}
	if typ == "buy" {
		owns, err := s.rampAddressOwned(ctx, d.ID, req.Address)
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		if !owns {
			writeErr(w, http.StatusForbidden, "address_not_linked", "This wallet address isn't linked to Harbour on this device yet. Open your wallet, wait a moment and try again.", false)
			return
		}
	}
	limit := s.opt.Ramps.MaxOrdersPerHour
	if limit <= 0 {
		limit = 20
	}
	if n, err := s.opt.Store.CountRecentRampOrders(ctx, d.ID, s.opt.Now().Add(-time.Hour)); err != nil {
		s.internalErr(w, r, err)
		return
	} else if n >= limit {
		writeErr(w, http.StatusTooManyRequests, "rate_limited", "Too many orders started in the last hour. Please try again later.", true)
		return
	}
	country := req.Country
	if country == "" {
		country = s.rampCountry(r)
	}
	ip := endUserIP(r)
	if p := net.ParseIP(ip); p == nil || p.IsLoopback() || p.IsPrivate() {
		s.opt.Log.Warn("ramps checkout from a private/loopback address: the provider will reject the session (run behind your proxy with TRUST_PROXY_HEADERS=1)")
	}
	order := store.RampOrder{ID: onramper.NewUUID(), DeviceID: d.ID, Type: typ, Provider: req.Provider, PaymentMethod: req.PaymentMethod, Chain: req.Chain}
	if typ == "buy" {
		order.Fiat, order.Crypto, order.FiatAmount = req.Source, req.Destination, &amount
	} else {
		order.Crypto, order.Fiat, order.CryptoAmount = req.Source, req.Destination, &amount
	}
	if err := s.opt.Store.InsertRampOrder(ctx, order); err != nil {
		s.internalErr(w, r, err)
		return
	}
	success := ""
	if s.opt.Ramps.ReturnURL != "" {
		success = s.opt.Ramps.ReturnURL + "?order=" + order.ID
	}
	in, err := s.opt.Ramps.Client.CreateIntent(ctx, onramper.IntentRequest{Type: typ, Onramp: req.Provider, Source: req.Source, Destination: req.Destination,
		Amount: amount, PaymentMethod: req.PaymentMethod, Network: req.Network, WalletAddress: req.Address, EndUserIPHash: onramper.HashIP(ip),
		Country: country, PartnerContext: order.ID, SuccessURL: success})
	if err != nil {
		_ = s.opt.Store.DeleteRampOrder(context.WithoutCancel(ctx), order.ID)
		s.rampUpstreamErr(w, r, err, "The provider couldn't start this order. Try another amount, payment method or provider.")
		return
	}
	if err := s.opt.Store.SetRampOrderSession(ctx, order.ID, in.SessionID); err != nil {
		s.opt.Log.Warn("ramps: could not store the session id", "err", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"order_id": order.ID, "checkout_url": in.RedirectURL, "return_url": s.opt.Ramps.ReturnURL})
}

// ---------- GET /v1/ramps/orders ----------

type rampOrderView struct {
	ID            string   `json:"id"`
	Type          string   `json:"type"`
	Status        string   `json:"status"`
	Provider      string   `json:"provider"`
	PaymentMethod string   `json:"payment_method"`
	Chain         string   `json:"chain"`
	Crypto        string   `json:"crypto"`
	Fiat          string   `json:"fiat"`
	FiatAmount    *float64 `json:"fiat_amount"`
	CryptoAmount  *float64 `json:"crypto_amount"`
	TxHash        string   `json:"tx_hash,omitempty"`
	StatusReason  string   `json:"status_reason,omitempty"`
	CreatedAt     int64    `json:"created_at"`
	UpdatedAt     int64    `json:"updated_at"`
}

func (s *Server) handleRampsOrders(w http.ResponseWriter, r *http.Request) {
	rows, err := s.opt.Store.DeviceRampOrders(r.Context(), deviceFrom(r.Context()).ID, 50)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	out := make([]rampOrderView, 0, len(rows))
	for _, o := range rows {
		out = append(out, rampOrderView{ID: o.ID, Type: o.Type, Status: o.Status, Provider: o.Provider, PaymentMethod: o.PaymentMethod, Chain: o.Chain,
			Crypto: o.Crypto, Fiat: o.Fiat, FiatAmount: o.FiatAmount, CryptoAmount: o.CryptoAmount, TxHash: o.TxHash, StatusReason: o.StatusReason,
			CreatedAt: o.CreatedAt.UnixMilli(), UpdatedAt: o.UpdatedAt.UnixMilli()})
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": out})
}

// ---------- GET /v1/ramps/return (unsigned, opened by the provider in the user's browser) ----------

const rampReturnPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Harbour</title>
<style>body{font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#f6f7f9;color:#111}main{max-width:420px;padding:32px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#555}</style></head>
<body><main><h1>Order submitted</h1><p>You can close this tab and return to Harbour. Your order status updates in the wallet.</p></main></body></html>`

func (s *Server) handleRampsReturn(w http.ResponseWriter, _ *http.Request) {
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(rampReturnPage))
}
