// Package rpchttp is a provider-neutral HTTP JSON-RPC upstream. Provider
// adapters under adapters/rpc wrap it with their URL scheme and auth.
package rpchttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"harbour/backend/internal/core/rpc"
)

// Options tweak an Upstream.
type Options struct {
	// BasicAuthPassword is sent as HTTP basic auth with an empty user.
	BasicAuthPassword string
	Headers           map[string]string
	Client            *http.Client
}

// FinalizedEvery is how often Head re-reads the finalized block.
var FinalizedEvery = 30 * time.Second

// Upstream implements rpc.Upstream over HTTP.
type Upstream struct {
	mu        sync.Mutex
	finalized uint64
	finAt     time.Time
	noBatch   bool // the endpoint refused a JSON-RPC batch once: send head calls separately
	cfg       rpc.UpstreamConfig
	url       string
	opt       Options
	client    *http.Client
}

// BuildURL fills {network} and {key} in a template, or returns cfg.URL.
func BuildURL(cfg rpc.UpstreamConfig) (string, error) {
	if cfg.URL != "" {
		return cfg.URL, nil
	}
	if cfg.URLTemplate == "" {
		return "", fmt.Errorf("upstream %s: no url or url_template", cfg.ID)
	}
	u := cfg.URLTemplate
	if strings.Contains(u, "{network}") {
		if cfg.Network == "" {
			return "", fmt.Errorf("upstream %s: url_template needs a network for chain %s", cfg.ID, cfg.Chain)
		}
		u = strings.ReplaceAll(u, "{network}", cfg.Network)
	}
	if strings.Contains(u, "{key}") {
		if cfg.Key == "" {
			return "", fmt.Errorf("upstream %s: missing key", cfg.ID)
		}
		u = strings.ReplaceAll(u, "{key}", cfg.Key)
	}
	return u, nil
}

// New builds an Upstream.
func New(cfg rpc.UpstreamConfig, opt Options) (*Upstream, error) {
	u, err := BuildURL(cfg)
	if err != nil {
		return nil, err
	}
	c := opt.Client
	if c == nil {
		t := cfg.Timeout
		if t == 0 {
			t = 10 * time.Second
		}
		c = &http.Client{Timeout: t, Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment, MaxIdleConnsPerHost: 64, IdleConnTimeout: 90 * time.Second,
			ForceAttemptHTTP2: true,
		}}
	}
	return &Upstream{cfg: cfg, url: u, opt: opt, client: c}, nil
}

func (u *Upstream) ID() string       { return u.cfg.ID }
func (u *Upstream) Provider() string { return u.cfg.Provider }
func (u *Upstream) Chain() string    { return u.cfg.Chain }

// Call sends one JSON-RPC request.
func (u *Upstream) Call(ctx context.Context, req *rpc.Request) (*rpc.Response, error) {
	r := *req
	r.JSONRPC = "2.0"
	if len(r.ID) == 0 {
		r.ID = json.RawMessage("1")
	}
	body, err := json.Marshal(&r)
	if err != nil {
		return nil, &rpc.TransportError{Err: err}
	}
	hreq, err := http.NewRequestWithContext(ctx, http.MethodPost, u.url, bytes.NewReader(body))
	if err != nil {
		return nil, &rpc.TransportError{Err: err}
	}
	hreq.Header.Set("Content-Type", "application/json")
	for k, v := range u.opt.Headers {
		hreq.Header.Set(k, v)
	}
	if u.opt.BasicAuthPassword != "" {
		hreq.SetBasicAuth("", u.opt.BasicAuthPassword)
	}
	resp, err := u.client.Do(hreq)
	if err != nil {
		// Never leak the URL (it contains the key).
		var ue interface{ Unwrap() error }
		if errors.As(err, &ue) && ue.Unwrap() != nil {
			err = ue.Unwrap()
		}
		return nil, &rpc.TransportError{Err: err}
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return nil, &rpc.TransportError{Status: resp.StatusCode, Err: err}
	}
	if resp.StatusCode != http.StatusOK {
		return nil, &rpc.TransportError{Status: resp.StatusCode, Err: errors.New(snippet(rb))}
	}
	var out rpc.Response
	if err := json.Unmarshal(rb, &out); err != nil {
		return nil, &rpc.TransportError{Status: resp.StatusCode, Err: fmt.Errorf("bad json-rpc body: %s", snippet(rb))}
	}
	if out.Result == nil && out.Error == nil {
		out.Result = json.RawMessage("null")
	}
	return &out, nil
}

func snippet(b []byte) string {
	if len(b) > 200 {
		b = b[:200]
	}
	return strings.TrimSpace(string(b))
}

// Head returns latest and finalized block numbers. When the finalized block is due (every FinalizedEvery) both are
// asked in one JSON-RPC batch, so a head poll is one HTTP round trip.
func (u *Upstream) Head(ctx context.Context) (rpc.Head, error) {
	h := rpc.Head{At: time.Now()}
	u.mu.Lock()
	fin, fresh, noBatch := u.finalized, time.Since(u.finAt) < FinalizedEvery, u.noBatch
	u.mu.Unlock()
	if fresh {
		latest, err := u.blockNumber(ctx)
		if err != nil {
			return h, err
		}
		h.Latest, h.Finalized = latest, fin
		return h, nil
	}
	var latest, finalized uint64
	var err error
	batched := false
	if !noBatch {
		latest, finalized, batched, err = u.headBatch(ctx)
		if err != nil {
			return h, err
		}
	}
	if !batched {
		if latest, err = u.blockNumber(ctx); err != nil {
			return h, err
		}
		finalized = u.finalizedBlock(ctx)
	}
	h.Latest = latest
	u.mu.Lock()
	if finalized > 0 {
		u.finalized = finalized
	}
	h.Finalized = u.finalized
	u.finAt = time.Now() // also back off on chains without a finalized tag
	u.mu.Unlock()
	return h, nil
}

func (u *Upstream) blockNumber(ctx context.Context) (uint64, error) {
	resp, err := u.Call(ctx, &rpc.Request{Method: "eth_blockNumber", Params: json.RawMessage("[]")})
	if err != nil {
		return 0, err
	}
	if resp.Error != nil {
		return 0, resp.Error
	}
	return ParseQuantity(resp.Result)
}

func (u *Upstream) finalizedBlock(ctx context.Context) uint64 {
	resp, err := u.Call(ctx, &rpc.Request{Method: "eth_getBlockByNumber", Params: json.RawMessage(`["finalized",false]`)})
	if err != nil || resp.Error != nil {
		return 0
	}
	return parseBlockNumber(resp.Result)
}

func parseBlockNumber(raw json.RawMessage) uint64 {
	var blk struct {
		Number string `json:"number"`
	}
	if json.Unmarshal(raw, &blk) != nil || blk.Number == "" {
		return 0
	}
	n, _ := strconv.ParseUint(strings.TrimPrefix(blk.Number, "0x"), 16, 64)
	return n
}

// headBatch sends eth_blockNumber and the finalized block as one batch. batched=false (with no error) means the
// endpoint does not take batches; it is then remembered and the caller falls back to two calls.
func (u *Upstream) headBatch(ctx context.Context) (latest, finalized uint64, batched bool, err error) {
	body := []byte(`[{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]},` +
		`{"jsonrpc":"2.0","id":2,"method":"eth_getBlockByNumber","params":["finalized",false]}]`)
	rb, status, err := u.post(ctx, body)
	if err != nil {
		return 0, 0, false, &rpc.TransportError{Status: status, Err: err}
	}
	var out []rpc.Response
	if status != http.StatusOK || json.Unmarshal(rb, &out) != nil || len(out) == 0 {
		if status == http.StatusTooManyRequests || status == http.StatusUnauthorized || status == http.StatusForbidden || status >= 500 {
			return 0, 0, false, &rpc.TransportError{Status: status, Err: errors.New(snippet(rb))}
		}
		u.mu.Lock()
		u.noBatch = true
		u.mu.Unlock()
		return 0, 0, false, nil
	}
	gotLatest := false
	for _, r := range out {
		switch strings.TrimSpace(string(r.ID)) {
		case "1":
			if r.Error != nil {
				return 0, 0, true, r.Error
			}
			if latest, err = ParseQuantity(r.Result); err != nil {
				return 0, 0, true, err
			}
			gotLatest = true
		case "2":
			if r.Error == nil {
				finalized = parseBlockNumber(r.Result)
			}
		}
	}
	if !gotLatest {
		return 0, 0, true, errors.New("batch answer without eth_blockNumber")
	}
	return latest, finalized, true, nil
}

// post sends a raw JSON-RPC body and returns the response body and HTTP status.
func (u *Upstream) post(ctx context.Context, body []byte) ([]byte, int, error) {
	hreq, err := http.NewRequestWithContext(ctx, http.MethodPost, u.url, bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	hreq.Header.Set("Content-Type", "application/json")
	for k, v := range u.opt.Headers {
		hreq.Header.Set(k, v)
	}
	if u.opt.BasicAuthPassword != "" {
		hreq.SetBasicAuth("", u.opt.BasicAuthPassword)
	}
	resp, err := u.client.Do(hreq)
	if err != nil {
		var ue interface{ Unwrap() error }
		if errors.As(err, &ue) && ue.Unwrap() != nil {
			err = ue.Unwrap() // never leak the URL (it contains the key)
		}
		return nil, 0, err
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return rb, resp.StatusCode, err
}

// Health probes eth_chainId.
func (u *Upstream) Health(ctx context.Context) error {
	resp, err := u.Call(ctx, &rpc.Request{Method: "eth_chainId", Params: json.RawMessage("[]")})
	if err != nil {
		return err
	}
	if resp.Error != nil {
		return resp.Error
	}
	return nil
}

// ParseQuantity decodes a JSON hex quantity like "0x1b4".
func ParseQuantity(raw json.RawMessage) (uint64, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return 0, fmt.Errorf("quantity: %w", err)
	}
	return strconv.ParseUint(strings.TrimPrefix(s, "0x"), 16, 64)
}
