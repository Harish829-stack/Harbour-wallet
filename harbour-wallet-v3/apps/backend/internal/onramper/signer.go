// Package onramper is Harbour's client for the Onramper fiat on/off-ramp aggregator: supported assets, quotes, signed
// checkout intents (Signature V2, Ed25519) and webhook verification. It has no dependencies outside the standard library.
//
// Specs: docs.onramper.com/docs/api-sign-requests-v2 (request signing), /reference/post_checkout-v2-intent (intent),
// /docs/optional-set-up-webhooks (webhooks). The private signing key never leaves the backend.
package onramper

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"time"
)

const sigVersion = "ONRAMPER-SIG-V2"

// EmptyBodyHash is the SHA-256 of an empty body (canonical line 8 for requests without a body).
var EmptyBodyHash = sha256Hex(nil)

func sha256Hex(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

// HashIP is the endUserIpHash Onramper binds a checkout session to: lowercase hex SHA-256 of the end user's IP address.
func HashIP(ip string) string { return sha256Hex([]byte(ip)) }

// ParsePrivateKey reads the Ed25519 signing key in any of these forms:
//   - the PKCS#8 PEM file made by `openssl genpkey -algorithm ED25519` (real line breaks, or one line with literal "\n");
//   - just the base64 line between the BEGIN/END lines of that file (easiest in a .env file);
//   - a raw 32-byte seed or 64-byte private key in hex or base64.
//
// Quotes, spaces and stray "\n"/"\r" are ignored, so .env and Docker Compose quoting styles all work.
func ParsePrivateKey(s string) (ed25519.PrivateKey, error) {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, `"'`)
	if s == "" {
		return nil, errors.New("onramper: signing key is empty")
	}
	if strings.Contains(s, "PUBLIC KEY") {
		return nil, errors.New("onramper: ONRAMPER_SIGNING_KEY holds the PUBLIC key; use the private key (onramper_private.pem)")
	}
	body := s
	if i := strings.Index(s, "-----BEGIN"); i >= 0 {
		rest := s[i+len("-----BEGIN"):]
		j := strings.Index(rest, "-----") // end of the BEGIN line
		k := strings.Index(rest, "-----END")
		if j < 0 || k < 0 || k <= j {
			return nil, errors.New("onramper: signing key is not valid PEM (missing BEGIN/END lines)")
		}
		body = rest[j+len("-----") : k]
	}
	clean := strings.NewReplacer(`\n`, "", `\r`, "", "\n", "", "\r", "", " ", "", "\t", "", `"`, "", "'", "").Replace(body)
	var raw []byte
	if b, err := hex.DecodeString(clean); err == nil {
		raw = b
	} else {
		for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
			if b, err := enc.DecodeString(clean); err == nil {
				raw = b
				break
			}
		}
	}
	if raw == nil {
		return nil, errors.New("onramper: signing key is not valid PEM or base64")
	}
	switch len(raw) {
	case ed25519.SeedSize:
		return ed25519.NewKeyFromSeed(raw), nil
	case ed25519.PrivateKeySize:
		k := ed25519.PrivateKey(raw)
		if !ed25519.NewKeyFromSeed(raw[:ed25519.SeedSize]).Equal(k) {
			return nil, errors.New("onramper: signing key is inconsistent")
		}
		return k, nil
	}
	k, err := x509.ParsePKCS8PrivateKey(raw)
	if err != nil {
		return nil, errors.New("onramper: signing key is not a PKCS#8 private key")
	}
	ed, ok := k.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("onramper: signing key is not an Ed25519 key")
	}
	return ed, nil
}

// formEscape matches the WHATWG application/x-www-form-urlencoded byte serializer (URLSearchParams.toString()):
// ASCII alphanumerics and *-._ stay, space becomes '+', every other byte is %XX (uppercase). Go's url.QueryEscape differs
// on '*' and '~', which would break signatures.
func formEscape(s string) string {
	const hexd = "0123456789ABCDEF"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9', c == '*', c == '-', c == '.', c == '_':
			b.WriteByte(c)
		case c == ' ':
			b.WriteByte('+')
		default:
			b.WriteByte('%')
			b.WriteByte(hexd[c>>4])
			b.WriteByte(hexd[c&15])
		}
	}
	return b.String()
}

// Param is one query parameter; order among equal keys is preserved (URLSearchParams.sort() is stable).
type Param struct{ Key, Value string }

// CanonicalQuery is canonical line 6: parameters sorted by key (stable), form-encoded, joined with '&'.
func CanonicalQuery(params []Param) string {
	ps := append([]Param(nil), params...)
	sort.SliceStable(ps, func(i, j int) bool { return lessUTF16(ps[i].Key, ps[j].Key) })
	parts := make([]string, len(ps))
	for i, p := range ps {
		parts[i] = formEscape(p.Key) + "=" + formEscape(p.Value)
	}
	return strings.Join(parts, "&")
}

// Signer signs Onramper API requests with the partner's Ed25519 key.
type Signer struct {
	key ed25519.PrivateKey
	now func() time.Time
	uid func() string
}

// NewSigner wraps a private key. now/nonce default to the clock and a random UUID v4.
func NewSigner(key ed25519.PrivateKey) *Signer { return &Signer{key: key, now: time.Now, uid: newUUID} }

// Public returns the public key Onramper must have on file for this signer.
func (s *Signer) Public() ed25519.PublicKey { return s.key.Public().(ed25519.PublicKey) }

// Request is what gets signed.
type Request struct {
	Method, Path string
	Query        []Param
	APIKey       string
	ContentType  string // included in the signed headers only when the request carries it
	Body         []byte // already canonical (RFC 8785) JSON, or nil
}

// CanonicalString builds the 8-line string to sign.
func CanonicalString(r Request, timestamp, nonce string) string {
	headers := []string{"authorization:" + strings.TrimSpace(r.APIKey)}
	if ct := strings.TrimSpace(r.ContentType); ct != "" {
		headers = append(headers, "content-type:"+ct)
	}
	sort.Strings(headers)
	bodyHash := EmptyBodyHash
	if len(r.Body) > 0 {
		bodyHash = sha256Hex(r.Body)
	}
	return strings.Join([]string{sigVersion, timestamp, nonce, strings.ToUpper(r.Method), r.Path, CanonicalQuery(r.Query),
		strings.Join(headers, "\n"), bodyHash}, "\n")
}

// Headers returns the signature headers for a request (Authorization included).
func (s *Signer) Headers(r Request) map[string]string {
	ts := s.now().UTC().Format("2006-01-02T15:04:05.000Z")
	nonce := s.uid()
	sig := ed25519.Sign(s.key, []byte(CanonicalString(r, ts, nonce)))
	return map[string]string{
		"Authorization":        r.APIKey,
		"x-onramper-signature": "v2:" + base64.StdEncoding.EncodeToString(sig),
		"x-onramper-timestamp": ts,
		"x-onramper-nonce":     nonce,
	}
}
