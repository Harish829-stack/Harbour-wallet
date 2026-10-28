// Package hbclient is a Go client that behaves like the extension: it holds
// an Ed25519 device key, registers with proof-of-work, and signs requests.
// Used by cmd/hbdevice and integration tests.
package hbclient

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"harbour/backend/internal/devicesig"
)

// Client is one device install.
type Client struct {
	BaseURL  string
	Priv     ed25519.PrivateKey
	DeviceID string
	HTTP     *http.Client
	Now      func() time.Time
}

// New makes a client with a fresh key.
func New(baseURL string) *Client {
	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), Priv: priv, HTTP: &http.Client{Timeout: 60 * time.Second}, Now: time.Now}
}

// PublicKeyB64 returns the base64url public key.
func (c *Client) PublicKeyB64() string {
	return devicesig.B64(c.Priv.Public().(ed25519.PublicKey))
}

// Register solves the PoW challenge and registers the device.
func (c *Client) Register(ctx context.Context) (map[string]any, error) {
	var ch struct {
		Challenge  string `json:"challenge"`
		Difficulty int    `json:"difficulty"`
	}
	if _, err := c.do(ctx, http.MethodPost, "/v1/devices/challenge", nil, false, &ch, nil); err != nil {
		return nil, err
	}
	pk := c.PublicKeyB64()
	counter, err := devicesig.SolvePow(ch.Challenge, pk, ch.Difficulty)
	if err != nil {
		return nil, err
	}
	body := map[string]string{
		"public_key":  pk,
		"challenge":   ch.Challenge,
		"pow_counter": counter,
		"signature":   devicesig.Sign(c.Priv, devicesig.RegistrationMessage(ch.Challenge)),
	}
	var out map[string]any
	if _, err := c.do(ctx, http.MethodPost, "/v1/devices", body, false, &out, nil); err != nil {
		return nil, err
	}
	c.DeviceID, _ = out["device_id"].(string)
	return out, nil
}

// Do sends a signed request. body may be nil, []byte, or a JSON-able value.
func (c *Client) Do(ctx context.Context, method, path string, body any, out any, hdr http.Header) (int, error) {
	return c.do(ctx, method, path, body, true, out, hdr)
}

// HTTPError is a non-2xx response.
type HTTPError struct {
	Status int
	Body   string
}

func (e *HTTPError) Error() string { return fmt.Sprintf("http %d: %s", e.Status, e.Body) }

func (c *Client) do(ctx context.Context, method, path string, body any, sign bool, out any, hdr http.Header) (int, error) {
	var raw []byte
	switch b := body.(type) {
	case nil:
	case []byte:
		raw = b
	default:
		var err error
		if raw, err = json.Marshal(b); err != nil {
			return 0, err
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, bytes.NewReader(raw))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range hdr {
		req.Header[k] = v
	}
	if sign {
		nb := make([]byte, 18)
		rand.Read(nb)
		nonce := devicesig.B64(nb)
		date := strconv.FormatInt(c.Now().Unix(), 10)
		canon := devicesig.Canonical(method, req.URL.RequestURI(), date, nonce, c.DeviceID, raw)
		req.Header.Set(devicesig.HeaderDevice, c.DeviceID)
		req.Header.Set(devicesig.HeaderDate, date)
		req.Header.Set(devicesig.HeaderNonce, nonce)
		req.Header.Set(devicesig.HeaderSignature, devicesig.Sign(c.Priv, canon))
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return resp.StatusCode, &HTTPError{Status: resp.StatusCode, Body: string(rb)}
	}
	if out != nil {
		if err := json.Unmarshal(rb, out); err != nil {
			return resp.StatusCode, fmt.Errorf("decode: %w (%s)", err, rb)
		}
	}
	return resp.StatusCode, nil
}
