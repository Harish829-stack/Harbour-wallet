package ingest

import (
	"errors"
	"io"
	"net/http"

	"harbour/backend/internal/onramper"
	"harbour/backend/internal/store"
)

// receiveOnramper handles POST /webhooks/onramper: an order status update for a checkout Harbour opened. The body is
// authenticated with the HMAC secret Onramper issued (ONRAMPER_WEBHOOK_SECRET) before anything else is read.
func (in *Ingest) receiveOnramper(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		http.Error(w, "too large", http.StatusRequestEntityTooLarge)
		return
	}
	if err := onramper.VerifyWebhook(in.o.OnramperSecret, body, r.Header.Get(onramper.SignatureHeader)); err != nil {
		in.o.Log.Warn("rejected onramper delivery", "err", err)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	ev, err := onramper.ParseEvent(body)
	if err != nil {
		in.o.Log.Warn("unparseable onramper delivery", "err", err)
		w.WriteHeader(http.StatusOK) // authentic but not understood: don't make Onramper retry forever
		return
	}
	status := onramper.NormalizeStatus(ev.Status)
	if ev.PartnerContext == "" || status == "" {
		in.o.Log.Info("onramper delivery ignored", "status", ev.Status, "has_context", ev.PartnerContext != "")
		w.WriteHeader(http.StatusOK)
		return
	}
	u := store.RampUpdate{OrderID: ev.PartnerContext, Status: status, StatusAt: ev.StatusDate, Reason: trimReason(ev.StatusReason),
		OnramperTxID: ev.TransactionID, ProviderTxID: ev.OnrampTransactionID, TxHash: ev.TransactionHash}
	if ev.StatusDate.IsZero() {
		u.StatusAt = in.o.Now()
	}
	isBuy := ev.TransactionType != "sell" && ev.TransactionType != "offramp"
	if ev.InAmount > 0 {
		v := ev.InAmount
		if isBuy {
			u.FiatAmount = &v
		} else {
			u.CryptoAmount = &v
		}
	}
	if ev.OutAmount > 0 {
		v := ev.OutAmount
		if isBuy {
			u.CryptoAmount = &v
		} else {
			u.FiatAmount = &v
		}
	}
	applied, err := in.o.Store.ApplyRampUpdate(r.Context(), u)
	switch {
	case errors.Is(err, store.ErrNotFound):
		in.o.Log.Warn("onramper delivery for an unknown order")
	case err != nil:
		in.o.Log.Error("store onramper update", "err", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable) // Onramper retries
		return
	default:
		in.o.Log.Info("onramper order update", "status", status, "applied", applied)
	}
	w.WriteHeader(http.StatusOK)
}

func trimReason(s string) string {
	r := []rune(s)
	if len(r) > 256 {
		r = r[:256]
	}
	return string(r)
}
