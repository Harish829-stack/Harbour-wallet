package api

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/risk"
	"harbour/backend/internal/evmtx"
	"harbour/backend/internal/realtime"
	"harbour/backend/internal/store"
)

// The send path: the extension builds and signs locally; Harbour only
// estimates, simulates and relays the signed bytes. Keys never arrive here.

// txRequest is an unsigned EVM call description.
type txRequest struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Value string `json:"value"` // decimal or 0x wei
	Data  string `json:"data"`
	Gas   string `json:"gas"`
}

// TxStatusEvent is published on tx.status.<chain>.
type TxStatusEvent struct {
	Chain       string `json:"chain"`
	TxHash      string `json:"tx_hash"`
	Status      string `json:"status"` // pending | confirmed | failed | dropped
	BlockNumber uint64 `json:"block_number,omitempty"`
	From        string `json:"from,omitempty"`
}

var hexDataRe = func(s string) bool {
	if !strings.HasPrefix(s, "0x") || len(s)%2 != 0 || len(s) > 2+2*128*1024 {
		return false
	}
	for _, c := range s[2:] {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F') {
			return false
		}
	}
	return true
}

func toQty(v string) (string, bool) {
	if v == "" {
		return "0x0", true
	}
	n, ok := new(big.Int).SetString(v, 0)
	if !ok || n.Sign() < 0 || n.BitLen() > 256 {
		return "", false
	}
	return "0x" + n.Text(16), true
}

func hexToDec(h string) string {
	n, ok := new(big.Int).SetString(strings.TrimPrefix(h, "0x"), 16)
	if !ok {
		return "0"
	}
	return n.String()
}

// sendChain resolves an EVM chain from the path (other families: later).
func (s *Server) sendChain(w http.ResponseWriter, r *http.Request) (string, config.Chain, bool) {
	name := chi.URLParam(r, "chain")
	ch, ok := s.cfg.Chains[name]
	if !ok {
		writeErr(w, http.StatusNotFound, "unknown_chain", "This network isn't supported.", false)
		return "", ch, false
	}
	if ch.Family != "evm" {
		writeErr(w, http.StatusBadRequest, "unsupported", "Sending on this network isn't supported yet.", false)
		return "", ch, false
	}
	return name, ch, true
}

// sendSession scopes the extension's X-HB-Session to the device so the
// gateway pins estimate -> nonce -> broadcast to one upstream.
func sendSession(r *http.Request) string {
	if sess := r.Header.Get("X-HB-Session"); sess != "" && len(sess) <= 64 {
		return deviceFrom(r.Context()).ID + ":" + sess
	}
	return ""
}

// parseTx validates the body and checks the sender is tracked by this device.
func (s *Server) parseTx(w http.ResponseWriter, r *http.Request, chain string) (map[string]any, string, bool) {
	var req txRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return nil, "", false
	}
	from, err1 := s.normalizeAddress(chain, req.From)
	to, err2 := s.normalizeAddress(chain, req.To)
	if err1 != nil || (req.To != "" && err2 != nil) {
		writeErr(w, http.StatusBadRequest, "bad_address", "The address isn't valid.", false)
		return nil, "", false
	}
	value, ok := toQty(req.Value)
	if !ok || (req.Data != "" && !hexDataRe(req.Data)) {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid amount or data.", false)
		return nil, "", false
	}
	if !s.ownsAddress(w, r, chain, from) {
		return nil, "", false
	}
	tx := map[string]any{"from": from, "value": value}
	if to != "" {
		tx["to"] = to
	}
	if req.Data != "" {
		tx["data"] = strings.ToLower(req.Data)
	}
	if req.Gas != "" {
		if g, ok := toQty(req.Gas); ok {
			tx["gas"] = g
		}
	}
	return tx, from, true
}

func (s *Server) ownsAddress(w http.ResponseWriter, r *http.Request, chain, addr string) bool {
	ok, err := s.opt.Store.DeviceOwns(r.Context(), s.opt.LinkCrypto, deviceFrom(r.Context()).ID,
		[]store.AddressRef{{Chain: chain, Address: addr}})
	if err != nil {
		s.internalErr(w, r, err)
		return false
	}
	if !ok {
		writeErr(w, http.StatusForbidden, "not_tracked", "Add this account to Harbour before sending from it.", false)
	}
	return ok
}

func (s *Server) sendRate(w http.ResponseWriter, r *http.Request, kind string, limit int) bool {
	d := deviceFrom(r.Context())
	ok, err := s.counter(r.Context(), "hb:rl"+kind+":"+d.ID, 1, limit)
	if err != nil {
		s.internalErr(w, r, err)
		return false
	}
	if !ok {
		w.Header().Set("Retry-After", "60")
		writeErr(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Please wait a moment.", true)
	}
	return ok
}

func networkBusy(w http.ResponseWriter) {
	writeErr(w, http.StatusServiceUnavailable, "network_busy", "Network busy, please try again.", true)
}

// friendlyChainError maps node messages to user-presentable errors.
func friendlyChainError(msg string) (code, text string) {
	m := strings.ToLower(msg)
	switch {
	case strings.Contains(m, "insufficient funds"):
		return "insufficient_funds", "Not enough balance to cover the amount and network fee."
	case strings.Contains(m, "nonce too low"):
		return "nonce_used", "This transaction was already used. Please refresh and try again."
	case strings.Contains(m, "nonce too high"):
		return "nonce_gap", "An earlier transaction is still missing. Please wait for it or refresh."
	case strings.Contains(m, "underpriced"), strings.Contains(m, "fee cap"), strings.Contains(m, "base fee"), strings.Contains(m, "tip"):
		return "fee_too_low", "The network fee is too low right now. Please try again with a higher fee."
	case strings.Contains(m, "intrinsic gas"), strings.Contains(m, "gas limit"), strings.Contains(m, "out of gas"):
		return "gas_too_low", "The gas limit is too low for this transaction."
	case strings.Contains(m, "execution reverted"), strings.Contains(m, "revert"):
		return "would_fail", "This transaction would fail if sent."
	case strings.Contains(m, "chain id"), strings.Contains(m, "chainid"):
		return "wrong_network", "This transaction was signed for a different network."
	default:
		return "rejected", "The network rejected this transaction."
	}
}

// ---------- POST /v1/tx/{chain}/estimate ----------

func (s *Server) handleEstimate(w http.ResponseWriter, r *http.Request) {
	chain, ch, ok := s.sendChain(w, r)
	if !ok {
		return
	}
	tx, from, ok := s.parseTx(w, r, chain)
	if !ok || !s.sendRate(w, r, "est", s.tier(deviceFrom(r.Context()).Tier).RPCPerMinute) {
		return
	}
	ctx, sess := r.Context(), sendSession(r)
	delete(tx, "gas")
	var nonce, gas, tip string
	var blk struct {
		BaseFee string `json:"baseFeePerGas"`
	}
	if _, err := s.gatewayCallSession(ctx, chain, sess, "eth_getTransactionCount", []any{from, "pending"}, &nonce); err != nil {
		networkBusy(w)
		return
	}
	if _, err := s.gatewayCallSession(ctx, chain, sess, "eth_estimateGas", []any{tx}, &gas); err != nil {
		var re *rpcError
		if errors.As(err, &re) {
			code, text := friendlyChainError(re.Message)
			writeErr(w, http.StatusUnprocessableEntity, code, text, false)
			return
		}
		networkBusy(w)
		return
	}
	if _, err := s.gatewayCallSession(ctx, chain, sess, "eth_getBlockByNumber", []any{"latest", false}, &blk); err != nil {
		networkBusy(w)
		return
	}
	gasN, _ := new(big.Int).SetString(hexToDec(gas), 10)
	limit := new(big.Int).Div(new(big.Int).Mul(gasN, big.NewInt(120)), big.NewInt(100)) // 20% buffer
	if gasN.Cmp(big.NewInt(21000)) == 0 {
		limit = gasN // plain transfers use exactly 21000
	}
	out := map[string]any{"chain": chain, "chain_id": ch.EVMChainID, "nonce": hexToDec(nonce), "gas_estimate": gasN.String(), "gas_limit": limit.String()}
	if blk.BaseFee == "" { // legacy pricing
		var gp string
		if _, err := s.gatewayCallSession(ctx, chain, sess, "eth_gasPrice", []any{}, &gp); err != nil {
			networkBusy(w)
			return
		}
		g, _ := new(big.Int).SetString(hexToDec(gp), 10)
		out["fees"] = map[string]any{"type": "legacy", "gas_price": g.String()}
		out["max_cost_wei"] = new(big.Int).Mul(g, limit).String()
		writeJSON(w, http.StatusOK, out)
		return
	}
	if _, err := s.gatewayCallSession(ctx, chain, sess, "eth_maxPriorityFeePerGas", []any{}, &tip); err != nil {
		tip = "0x3b9aca00" // 1 gwei
	}
	base, _ := new(big.Int).SetString(hexToDec(blk.BaseFee), 10)
	t, _ := new(big.Int).SetString(hexToDec(tip), 10)
	speed := func(tipPct int64) map[string]string {
		tp := new(big.Int).Div(new(big.Int).Mul(t, big.NewInt(tipPct)), big.NewInt(100))
		mf := new(big.Int).Add(new(big.Int).Mul(base, big.NewInt(2)), tp)
		return map[string]string{"max_priority_fee": tp.String(), "max_fee": mf.String(),
			"max_cost_wei": new(big.Int).Mul(mf, limit).String()}
	}
	out["fees"] = map[string]any{"type": "eip1559", "base_fee": base.String(),
		"slow": speed(80), "normal": speed(100), "fast": speed(150)}
	writeJSON(w, http.StatusOK, out)
}

// ---------- POST /v1/tx/{chain}/simulate ----------

type changeView struct {
	Asset      string `json:"asset"`
	Kind       string `json:"kind"`
	ChangeType string `json:"change_type"`
	From       string `json:"from"`
	To         string `json:"to"`
	AmountRaw  string `json:"amount_raw"`
	Amount     string `json:"amount,omitempty"`
	Symbol     string `json:"symbol,omitempty"`
	TokenID    string `json:"token_id,omitempty"`
}

func (s *Server) handleSimulate(w http.ResponseWriter, r *http.Request) {
	chain, _, ok := s.sendChain(w, r)
	if !ok {
		return
	}
	tx, _, ok := s.parseTx(w, r, chain)
	if !ok || !s.sendRate(w, r, "sim", 30) {
		return
	}
	ctx := r.Context()
	if s.opt.Simulator != nil {
		res, err := s.opt.Simulator.Simulate(ctx, chain, tx)
		if err == nil {
			changes := make([]changeView, 0, len(res.Changes))
			for _, c := range res.Changes {
				v := changeView{Asset: c.AssetRef, Kind: c.Kind, ChangeType: c.ChangeType, From: c.From, To: c.To,
					AmountRaw: c.AmountRaw, Symbol: c.Symbol, TokenID: c.TokenID}
				if c.Decimals >= 0 && c.AmountRaw != "" {
					d := c.Decimals
					v.Amount = formatUnits(c.AmountRaw, &d)
				}
				changes = append(changes, v)
			}
			out := map[string]any{"mode": "full", "success": !res.Reverted, "gas_used": res.GasUsed,
				"changes": changes, "warnings": nonNil(res.Warnings)}
			if res.Reverted {
				_, out["message"] = friendlyChainError("execution reverted")
			}
			writeJSON(w, http.StatusOK, out)
			return
		}
		if !errors.Is(err, risk.ErrUnsupported) {
			s.opt.Log.Warn("simulator failed; using basic check", "chain", chain, "err", err)
		}
	}
	// Basic check: does it execute, and how much gas?
	var gas string
	var raw json.RawMessage
	_, err := s.gatewayCallSession(ctx, chain, sendSession(r), "eth_call", []any{tx, "latest"}, &raw)
	if err == nil {
		_, err = s.gatewayCallSession(ctx, chain, sendSession(r), "eth_estimateGas", []any{tx}, &gas)
	}
	var re *rpcError
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string]any{"mode": "basic", "success": true, "gas_used": hexToDec(gas),
			"changes": []changeView{}, "warnings": []string{}})
	case errors.As(err, &re):
		code, text := friendlyChainError(re.Message)
		writeJSON(w, http.StatusOK, map[string]any{"mode": "basic", "success": false, "code": code, "message": text,
			"changes": []changeView{}, "warnings": []string{}})
	default:
		networkBusy(w)
	}
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// ---------- POST /v1/tx/{chain}/broadcast ----------

func (s *Server) handleBroadcast(w http.ResponseWriter, r *http.Request) {
	chain, ch, ok := s.sendChain(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	d := deviceFrom(ctx)
	var req struct {
		Raw string `json:"raw"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	info, raw, err := evmtx.Decode(req.Raw)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "bad_transaction", "This transaction couldn't be read.", false)
		return
	}
	if info.ChainID == nil || !info.ChainID.IsUint64() || info.ChainID.Uint64() != ch.EVMChainID {
		writeErr(w, http.StatusBadRequest, "wrong_network", "This transaction was signed for a different network.", false)
		return
	}
	from, err := evmtx.Sender(raw)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "bad_transaction", "This transaction's signature isn't valid.", false)
		return
	}
	if !s.ownsAddress(w, r, chain, from) || !s.sendRate(w, r, "bc", 10) {
		return
	}
	var hash string
	_, err = s.gatewayCallSession(ctx, chain, sendSession(r), "eth_sendRawTransaction", []any{req.Raw}, &hash)
	var re *rpcError
	if errors.As(err, &re) && strings.Contains(strings.ToLower(re.Message), "already known") {
		err, hash = nil, info.Hash // resubmission of a tx the node already has
	}
	if err != nil {
		if errors.As(err, &re) {
			code, text := friendlyChainError(re.Message)
			s.opt.Log.Info("broadcast rejected", "chain", chain, "code", code)
			writeErr(w, http.StatusUnprocessableEntity, code, text, false)
			return
		}
		s.opt.Log.Warn("broadcast failed", "chain", chain, "err", err)
		networkBusy(w)
		return
	}
	hash = strings.ToLower(hash)
	if hash != info.Hash {
		s.opt.Log.Warn("node returned a different tx hash", "chain", chain)
		hash = info.Hash
	}
	if err := s.opt.Store.InsertPending(ctx, chain, hash, from, info.Nonce, d.ID); err != nil {
		s.internalErr(w, r, err) // it was sent; the client still sees an error and can look it up
		return
	}
	b, _ := json.Marshal(TxStatusEvent{Chain: chain, TxHash: hash, Status: "pending", From: from})
	if err := s.opt.Events.Publish(context.WithoutCancel(ctx), "tx.status."+chain, b); err != nil {
		s.opt.Log.Warn("publish tx.status failed", "err", err)
	}
	out := map[string]any{"chain": chain, "tx_hash": hash, "status": "pending", "nonce": info.Nonce}
	if len(s.opt.RealtimeSecret) > 0 {
		chn := realtime.TxChannel(chain, hash)
		out["channel"] = chn
		out["channel_token"] = realtime.SubscriptionToken(s.opt.RealtimeSecret, d.ID, chn, s.opt.Now(), realtimeTTL)
	}
	writeJSON(w, http.StatusOK, out)
}
