// Package webpush delivers notifications with the Web Push protocol
// (RFC 8030) using VAPID (RFC 8292) and aes128gcm payload encryption
// (RFC 8291). Payloads are end-to-end encrypted to the browser, so the push
// service never sees their contents.
package webpush

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"syscall"
	"time"

	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/registry"
)

// Name is the adapter and channel name.
const Name = "webpush"

func init() { registry.NotifyChannel.Register(Name, New) }

// Subscription is the browser's PushSubscription JSON.
type Subscription struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

// Channel implements notify.Channel.
type Channel struct {
	priv    *ecdsa.PrivateKey
	pubB64  string
	subject string
	ttl     int
	private bool // tests only: allow http and private endpoints
	http    *http.Client
}

var b64 = base64.RawURLEncoding

func decodeB64(s string) ([]byte, error) {
	for _, enc := range []*base64.Encoding{base64.RawURLEncoding, base64.URLEncoding, base64.RawStdEncoding, base64.StdEncoding} {
		if b, err := enc.DecodeString(s); err == nil {
			return b, nil
		}
	}
	return nil, errors.New("webpush: bad base64")
}

func opt(o map[string]string, key string) string {
	if v := o[key]; v != "" {
		return v
	}
	if env := o[key+"_env"]; env != "" {
		return os.Getenv(env)
	}
	return ""
}

// New builds the channel. Options (each may be given as <name>_env to read
// an environment variable): private_key (base64url 32-byte P-256 scalar),
// subject (mailto: or https: contact). allow_private=true is for tests only.
func New(o map[string]string) (notify.Channel, error) {
	d, err := decodeB64(opt(o, "private_key"))
	if err != nil || len(d) != 32 {
		return nil, errors.New("webpush: VAPID private key missing or invalid (run hbkeys vapid)")
	}
	priv, err := PrivateKey(d)
	if err != nil {
		return nil, err
	}
	subject := opt(o, "subject")
	if subject == "" || subject == "mailto:" {
		subject = "mailto:ops@harbour.invalid"
	}
	ttl, _ := strconv.Atoi(o["ttl_seconds"])
	if ttl <= 0 {
		ttl = 12 * 3600
	}
	return &Channel{priv: priv, pubB64: b64.EncodeToString(PublicBytes(priv)), subject: subject, ttl: ttl,
		private: o["allow_private"] == "true", http: guardedClient(o["allow_private"] == "true")}, nil
}

// PrivateKey builds a P-256 signing key from a raw scalar.
func PrivateKey(d []byte) (*ecdsa.PrivateKey, error) {
	if _, err := ecdh.P256().NewPrivateKey(d); err != nil {
		return nil, fmt.Errorf("webpush: %w", err)
	}
	c := elliptic.P256()
	k := &ecdsa.PrivateKey{D: new(big.Int).SetBytes(d)}
	k.Curve = c
	k.X, k.Y = c.ScalarBaseMult(d) //nolint:staticcheck // no non-deprecated raw-scalar import before Go 1.25
	return k, nil
}

// PublicBytes is the uncompressed public key (the VAPID application server key).
func PublicBytes(k *ecdsa.PrivateKey) []byte {
	out := make([]byte, 65)
	out[0] = 4
	k.X.FillBytes(out[1:33])
	k.Y.FillBytes(out[33:])
	return out
}

// GenerateKeys returns a new VAPID key pair as base64url (private, public).
func GenerateKeys() (string, string, error) {
	k, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}
	return b64.EncodeToString(k.Bytes()), b64.EncodeToString(k.PublicKey().Bytes()), nil
}

// Name implements notify.Channel.
func (c *Channel) Name() string { return Name }

// Send encrypts the message for the subscription and posts it to the push service.
func (c *Channel) Send(ctx context.Context, t notify.Target, m notify.Message) error {
	var sub Subscription
	if err := json.Unmarshal([]byte(t.Token), &sub); err != nil {
		return notify.ErrGone{Reason: "unreadable subscription"}
	}
	u, err := url.Parse(sub.Endpoint)
	if err != nil || u.Scheme != "https" && !(c.private && u.Scheme == "http") {
		return notify.ErrGone{Reason: "bad endpoint"}
	}
	payload, _ := json.Marshal(map[string]any{"title": m.Title, "body": m.Body, "data": m.Data})
	body, err := Encrypt(sub, payload)
	if err != nil {
		return notify.ErrGone{Reason: "bad subscription keys"}
	}
	jwt, err := c.vapidJWT(u.Scheme + "://" + u.Host)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("TTL", strconv.Itoa(c.ttl))
	req.Header.Set("Urgency", "normal")
	req.Header.Set("Authorization", "vapid t="+jwt+", k="+c.pubB64)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	switch {
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return notify.ErrGone{Reason: "subscription expired"}
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	default:
		return fmt.Errorf("webpush: push service http %d", resp.StatusCode)
	}
}

func (c *Channel) vapidJWT(aud string) (string, error) {
	h := b64.EncodeToString([]byte(`{"typ":"JWT","alg":"ES256"}`))
	claims, _ := json.Marshal(map[string]any{"aud": aud, "exp": time.Now().Add(12 * time.Hour).Unix(), "sub": c.subject})
	unsigned := h + "." + b64.EncodeToString(claims)
	sum := sha256.Sum256([]byte(unsigned))
	r, s, err := ecdsa.Sign(rand.Reader, c.priv, sum[:])
	if err != nil {
		return "", err
	}
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	return unsigned + "." + b64.EncodeToString(sig), nil
}

func hkdf(salt, ikm, info []byte, n int) []byte {
	m := hmac.New(sha256.New, salt)
	m.Write(ikm)
	prk := m.Sum(nil)
	m = hmac.New(sha256.New, prk)
	m.Write(info)
	m.Write([]byte{1})
	return m.Sum(nil)[:n]
}

// Encrypt produces an RFC 8291 aes128gcm body (single record).
func Encrypt(sub Subscription, plaintext []byte) ([]byte, error) {
	uaPub, err := decodeB64(sub.Keys.P256dh)
	if err != nil {
		return nil, err
	}
	auth, err := decodeB64(sub.Keys.Auth)
	if err != nil || len(auth) != 16 {
		return nil, errors.New("webpush: bad auth secret")
	}
	ua, err := ecdh.P256().NewPublicKey(uaPub)
	if err != nil {
		return nil, err
	}
	as, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	shared, err := as.ECDH(ua)
	if err != nil {
		return nil, err
	}
	asPub := as.PublicKey().Bytes()
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	return seal(shared, auth, uaPub, asPub, salt, plaintext)
}

func seal(shared, auth, uaPub, asPub, salt, plaintext []byte) ([]byte, error) {
	keyInfo := append(append([]byte("WebPush: info\x00"), uaPub...), asPub...)
	ikm := hkdf(auth, shared, keyInfo, 32)
	cek := hkdf(salt, ikm, []byte("Content-Encoding: aes128gcm\x00"), 16)
	nonce := hkdf(salt, ikm, []byte("Content-Encoding: nonce\x00"), 12)
	blk, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(blk)
	if err != nil {
		return nil, err
	}
	const rs = 4096
	if len(plaintext)+1+16 > rs {
		return nil, errors.New("webpush: payload too large")
	}
	ct := gcm.Seal(nil, nonce, append(plaintext, 2), nil) // 0x02: last record
	hdr := make([]byte, 16+4+1)
	copy(hdr, salt)
	binary.BigEndian.PutUint32(hdr[16:], rs)
	hdr[20] = byte(len(asPub))
	return append(append(hdr, asPub...), ct...), nil
}

// Decrypt reverses Encrypt given the subscriber's private key (tests and tooling).
func Decrypt(uaPriv *ecdh.PrivateKey, auth, body []byte) ([]byte, error) {
	if len(body) < 21 {
		return nil, errors.New("webpush: short body")
	}
	salt, idlen := body[:16], int(body[20])
	if len(body) < 21+idlen {
		return nil, errors.New("webpush: short body")
	}
	asPub := body[21 : 21+idlen]
	as, err := ecdh.P256().NewPublicKey(asPub)
	if err != nil {
		return nil, err
	}
	shared, err := uaPriv.ECDH(as)
	if err != nil {
		return nil, err
	}
	keyInfo := append(append([]byte("WebPush: info\x00"), uaPriv.PublicKey().Bytes()...), asPub...)
	ikm := hkdf(auth, shared, keyInfo, 32)
	cek := hkdf(salt, ikm, []byte("Content-Encoding: aes128gcm\x00"), 16)
	nonce := hkdf(salt, ikm, []byte("Content-Encoding: nonce\x00"), 12)
	blk, _ := aes.NewCipher(cek)
	gcm, _ := cipher.NewGCM(blk)
	pt, err := gcm.Open(nil, nonce, body[21+idlen:], nil)
	if err != nil {
		return nil, err
	}
	i := bytes.LastIndexByte(pt, 2)
	if i < 0 {
		return nil, errors.New("webpush: no record delimiter")
	}
	return pt[:i], nil
}

// guardedClient refuses private destinations at connect time (push
// endpoints come from clients, so they must not reach internal services).
func guardedClient(allowPrivate bool) *http.Client {
	tr := &http.Transport{TLSHandshakeTimeout: 5 * time.Second, ResponseHeaderTimeout: 10 * time.Second, MaxIdleConnsPerHost: 8}
	if !allowPrivate {
		d := &net.Dialer{Timeout: 5 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			ip := net.ParseIP(host)
			if ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() || ip.IsMulticast() ||
				(ip.To4() != nil && ip.To4()[0] == 100 && ip.To4()[1]&0xc0 == 64) {
				return errors.New("webpush: destination not allowed")
			}
			return nil
		}}
		tr.DialContext = d.DialContext
	}
	return &http.Client{Timeout: 15 * time.Second, Transport: tr,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}
