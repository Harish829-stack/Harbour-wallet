package realtime

// QA (T-REG-025, HW-2026-017): every realtime token carries aud = the audience Centrifugo is configured to require, the subscription
// token is bound to one channel and one device, and the channel namespaces in the Centrifugo config refuse client-side subscribe.

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

func decodeJWT(t *testing.T, secret []byte, tok string) map[string]any {
	t.Helper()
	p := strings.Split(tok, ".")
	if len(p) != 3 {
		t.Fatalf("not a JWT: %s", tok)
	}
	m := hmac.New(sha256.New, secret)
	m.Write([]byte(p[0] + "." + p[1]))
	if base64.RawURLEncoding.EncodeToString(m.Sum(nil)) != p[2] {
		t.Fatal("bad signature")
	}
	var h, c map[string]any
	hb, _ := base64.RawURLEncoding.DecodeString(p[0])
	cb, _ := base64.RawURLEncoding.DecodeString(p[1])
	_ = json.Unmarshal(hb, &h)
	_ = json.Unmarshal(cb, &c)
	if h["alg"] != "HS256" {
		t.Fatalf("alg %v", h["alg"])
	}
	return c
}

func TestQARealtimeTokensAudienceAndBinding(t *testing.T) {
	var cfg struct {
		Client struct {
			Token struct {
				Audience string `json:"audience"`
			} `json:"token"`
		} `json:"client"`
		Channel struct {
			Namespaces []struct {
				Name                    string `json:"name"`
				AllowSubscribeForClient bool   `json:"allow_subscribe_for_client"`
			} `json:"namespaces"`
		} `json:"channel"`
	}
	b, err := os.ReadFile("../../deploy/centrifugo/config.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg.Client.Token.Audience != Audience || Audience == "" {
		t.Fatalf("Centrifugo requires aud %q, tokens carry %q", cfg.Client.Token.Audience, Audience)
	}
	ns := map[string]bool{}
	for _, n := range cfg.Channel.Namespaces {
		ns[n.Name] = true
		if n.AllowSubscribeForClient {
			t.Fatalf("namespace %s lets any client subscribe without a token", n.Name)
		}
	}
	for _, ch := range []string{BalanceChannel("base", "0xA"), TxChannel("base", "0xB")} {
		if !ns[strings.SplitN(ch, ":", 2)[0]] {
			t.Fatalf("channel %s has no configured namespace", ch)
		}
	}
	secret := []byte(strings.Repeat("s", 32))
	now := time.Unix(1_800_000_000, 0)
	c := decodeJWT(t, secret, ConnectionToken(secret, "dev-1", now, time.Hour))
	if c["aud"] != Audience || c["sub"] != "dev-1" || c["exp"].(float64) != float64(now.Add(time.Hour).Unix()) || c["channel"] != nil {
		t.Fatalf("connection token %v", c)
	}
	s := decodeJWT(t, secret, SubscriptionToken(secret, "dev-1", TxChannel("base", "0xB"), now, time.Minute))
	if s["aud"] != Audience || s["sub"] != "dev-1" || s["channel"] != "tx:base.0xb" {
		t.Fatalf("subscription token %v", s)
	}
}
