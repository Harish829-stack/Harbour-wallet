package store

// QA unit test: media keys. TEST_PLAN: T-IDX-020.

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"testing"
)

// T-IDX-020: MediaKey is 32 hex chars, deterministic, keyed by the secret with its own label (independent HMAC computation).
func TestQAMediaKeyKeyed(t *testing.T) {
	defer func(old []byte) { mediaKeySecret = old }(mediaKeySecret)
	src := "https://img.example/nft/1.png"
	SetMediaKeySecret([]byte("secret-one"))
	a := MediaKey(src)
	if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(a) || a != MediaKey(src) {
		t.Fatalf("key %q", a)
	}
	label := hmac.New(sha256.New, []byte("secret-one"))
	label.Write([]byte("harbour/media-key"))
	m := hmac.New(sha256.New, label.Sum(nil))
	m.Write([]byte(src))
	if want := hex.EncodeToString(m.Sum(nil)[:16]); a != want {
		t.Fatalf("MediaKey %s, independent HMAC %s", a, want)
	}
	SetMediaKeySecret([]byte("secret-two"))
	if MediaKey(src) == a {
		t.Fatal("key does not depend on the secret")
	}
	plain := sha256.Sum256([]byte(src))
	if MediaKey(src) == hex.EncodeToString(plain[:16]) {
		t.Fatal("keyed MediaKey equals the public hash: anyone could probe holdings")
	}
	if MediaKey("") != "" {
		t.Fatal("empty source must have no key")
	}
}
