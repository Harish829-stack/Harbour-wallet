// Package realtime issues Centrifugo tokens and relays internal events to
// Centrifugo channels. Channel names follow Trust Wallet's: balances:<chain>.<address>
// and tx:<chain>.<hash>.
package realtime

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"
)

// Channel names.
func BalanceChannel(chain, address string) string {
	return "balances:" + chain + "." + strings.ToLower(address)
}

// TxChannel is a transaction's status channel.
func TxChannel(chain, hash string) string { return "tx:" + chain + "." + strings.ToLower(hash) }

var b64 = base64.RawURLEncoding

// SignHS256 signs claims as a compact JWT.
func SignHS256(secret []byte, claims map[string]any) string {
	h := b64.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	p, _ := json.Marshal(claims)
	unsigned := h + "." + b64.EncodeToString(p)
	m := hmac.New(sha256.New, secret)
	m.Write([]byte(unsigned))
	return unsigned + "." + b64.EncodeToString(m.Sum(nil))
}

// ConnectionToken is a short-lived Centrifugo connection JWT for a device.
func ConnectionToken(secret []byte, deviceID string, now time.Time, ttl time.Duration) string {
	return SignHS256(secret, map[string]any{"sub": deviceID, "exp": now.Add(ttl).Unix(), "iat": now.Unix()})
}

// SubscriptionToken lets the device subscribe to one channel.
func SubscriptionToken(secret []byte, deviceID, channel string, now time.Time, ttl time.Duration) string {
	return SignHS256(secret, map[string]any{"sub": deviceID, "channel": channel, "exp": now.Add(ttl).Unix(), "iat": now.Unix()})
}
