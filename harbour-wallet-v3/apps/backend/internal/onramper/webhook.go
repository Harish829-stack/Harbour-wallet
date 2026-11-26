package onramper

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// SignatureHeader carries the hex HMAC-SHA256 of the raw body, keyed with the webhook secret Onramper issued.
const SignatureHeader = "X-Onramper-Webhook-Signature"

// VerifyWebhook checks a delivery's signature in constant time.
func VerifyWebhook(secret string, body []byte, signature string) error {
	if secret == "" {
		return errors.New("onramper: webhook secret not configured")
	}
	sig := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(signature), "sha256=")))
	got, err := hex.DecodeString(sig)
	if err != nil || len(got) != sha256.Size {
		return errors.New("onramper: malformed webhook signature")
	}
	m := hmac.New(sha256.New, []byte(secret))
	m.Write(body)
	if !hmac.Equal(got, m.Sum(nil)) {
		return errors.New("onramper: webhook signature mismatch")
	}
	return nil
}

// Event is a transaction status update (webhook payload, also the GET /transactions/{id} shape).
type Event struct {
	TransactionID       string    `json:"transactionId"`
	OnrampTransactionID string    `json:"onrampTransactionId"`
	Onramp              string    `json:"onramp"`
	Status              string    `json:"status"`
	StatusReason        string    `json:"statusReason"`
	StatusDateRaw       string    `json:"statusDate"`
	StatusDate          time.Time `json:"-"` // parsed from StatusDateRaw; zero when absent or unreadable
	TransactionType     string    `json:"transactionType"`
	SourceCurrency      string    `json:"sourceCurrency"`
	TargetCurrency      string    `json:"targetCurrency"`
	InAmount            float64   `json:"inAmount"`
	OutAmount           float64   `json:"outAmount"`
	PaymentMethod       string    `json:"paymentMethod"`
	TransactionHash     string    `json:"transactionHash"`
	PartnerContext      string    `json:"partnerContext"`
	Country             string    `json:"country"`
}

// ParseEvent decodes a webhook body.
func ParseEvent(body []byte) (Event, error) {
	var e Event
	if err := json.Unmarshal(body, &e); err != nil {
		return Event{}, err
	}
	if e.TransactionID == "" || e.Status == "" {
		return Event{}, errors.New("onramper: webhook without transactionId/status")
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.999999999", "2006-01-02 15:04:05.999999999Z07:00", "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, strings.TrimSpace(e.StatusDateRaw)); err == nil {
			e.StatusDate = t.UTC()
			break
		}
	}
	return e, nil
}

// Harbour order statuses.
const (
	StatusCreated   = "created"   // checkout opened, nothing heard from Onramper yet
	StatusPending   = "pending"   // provider has the order (new / pending / paid)
	StatusCompleted = "completed" // crypto sent (buy) or fiat paid out (sell)
	StatusCanceled  = "canceled"
	StatusFailed    = "failed"
)

// NormalizeStatus maps Onramper's status to a Harbour status ("" when unknown).
func NormalizeStatus(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "new", "pending", "paid":
		return StatusPending
	case "completed":
		return StatusCompleted
	case "canceled", "cancelled":
		return StatusCanceled
	case "failed":
		return StatusFailed
	}
	return ""
}

// Terminal reports whether a status never changes again.
func Terminal(status string) bool {
	return status == StatusCompleted || status == StatusCanceled || status == StatusFailed
}
