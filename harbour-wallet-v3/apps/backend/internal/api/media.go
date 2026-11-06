package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/png"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"syscall"
	"time"

	_ "image/gif"  // decoders
	_ "image/jpeg" // decoders

	"github.com/go-chi/chi/v5"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // decoder

	"harbour/backend/internal/store"
)

// ---------- GET /v1/tx/{chain}/{hash} ----------

var txHashRe = regexp.MustCompile(`^0x[0-9a-f]{64}$`)

func (s *Server) handleTx(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	chain := chi.URLParam(r, "chain")
	hash := strings.ToLower(chi.URLParam(r, "hash"))
	if _, ok := s.cfg.Chains[chain]; !ok || !txHashRe.MatchString(hash) {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid transaction.", false)
		return
	}
	t, err := s.opt.Store.Tx(ctx, chain, hash)
	if err == nil {
		type tr struct {
			assetView
			EventRef  string  `json:"event_ref"`
			From      *string `json:"from"`
			To        *string `json:"to"`
			AmountRaw string  `json:"amount_raw"`
			Amount    string  `json:"amount"`
		}
		var trs []tr
		for _, x := range t.Transfers {
			trs = append(trs, tr{assetView: assetOf(x.Asset), EventRef: x.EventRef, From: x.From, To: x.To, AmountRaw: x.AmountRaw,
				Amount: formatUnits(x.AmountRaw, x.Asset.Decimals)})
		}
		writeJSON(w, http.StatusOK, map[string]any{"source": "indexed", "chain": chain, "tx_hash": hash, "status": "mined",
			"finality": t.Finality, "block_number": t.BlockNumber, "block_time": t.BlockTime, "from": t.From, "to": t.To, "transfers": trs})
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		s.internalErr(w, r, err)
		return
	}
	// A transaction broadcast through Harbour is described from our records only to the device that sent it; anyone
	// else gets the public chain view (otherwise this endpoint tells whether a hash came from a Harbour user).
	if p, err := s.opt.Store.Pending(ctx, chain, hash); err == nil {
		if dev, derr := s.opt.Store.PendingDevice(ctx, chain, hash); derr == nil && dev == deviceFrom(ctx).ID {
			writeJSON(w, http.StatusOK, map[string]any{"source": "pending", "chain": chain, "tx_hash": hash, "status": p.State,
				"from": p.From, "submitted_at": p.SubmittedAt})
			return
		}
	} else if !errors.Is(err, store.ErrNotFound) {
		s.internalErr(w, r, err)
		return
	}
	// Unknown to Harbour (e.g. not involving a tracked address): ask the chain.
	var receipt struct {
		BlockNumber string  `json:"blockNumber"`
		Status      string  `json:"status"`
		From        string  `json:"from"`
		To          *string `json:"to"`
	}
	found, err := s.gatewayCall(ctx, chain, "eth_getTransactionReceipt", []any{hash}, &receipt)
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, "network_busy", "Network busy, please try again.", true)
		return
	}
	if !found {
		var tx struct {
			From string `json:"from"`
		}
		known, err := s.gatewayCall(ctx, chain, "eth_getTransactionByHash", []any{hash}, &tx)
		if err != nil {
			writeErr(w, http.StatusServiceUnavailable, "network_busy", "Network busy, please try again.", true)
			return
		}
		if !known {
			writeErr(w, http.StatusNotFound, "unknown_tx", "We can't find this transaction yet.", true)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"source": "chain", "chain": chain, "tx_hash": hash, "status": "pending", "from": tx.From})
		return
	}
	status := "success"
	if receipt.Status == "0x0" {
		status = "failed"
	}
	writeJSON(w, http.StatusOK, map[string]any{"source": "chain", "chain": chain, "tx_hash": hash, "status": status,
		"block_number": receipt.BlockNumber, "from": receipt.From, "to": receipt.To})
}

// rpcError is a JSON-RPC error returned by the chain (as opposed to a transport failure).
type rpcError struct{ Message string }

func (e *rpcError) Error() string { return e.Message }

// gatewayCall makes one JSON-RPC call through rpc-gateway; found=false for a null result.
func (s *Server) gatewayCall(ctx context.Context, chain, method string, params []any, out any) (bool, error) {
	return s.gatewayCallSession(ctx, chain, "", method, params, out)
}

// gatewayCallSession pins the call to the upstream used by earlier calls with the same session.
func (s *Server) gatewayCallSession(ctx context.Context, chain, session, method string, params []any, out any) (bool, error) {
	body, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(s.opt.GatewayURL, "/")+"/rpc/"+chain, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-HB-Priority", "user")
	if session != "" {
		req.Header.Set("X-HB-Session", session)
	}
	if s.opt.GatewayToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.opt.GatewayToken)
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	var r struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&r); err != nil {
		return false, err
	}
	if r.Error != nil {
		return false, &rpcError{Message: r.Error.Message}
	}
	if len(r.Result) == 0 || string(r.Result) == "null" {
		return false, nil
	}
	return true, json.Unmarshal(r.Result, out)
}

// ---------- GET /v1/media/{key} ----------

// The media proxy fetches NFT images server-side from URLs the indexer
// stored (never from user input), re-encodes them to PNG (no SVG, no
// scripts), caps their size and caches the result. The extension only ever
// loads Harbour's URL.

const (
	mediaMaxBytes  = 10 << 20
	mediaMaxPixels = 16_000_000 // decoded RGBA is 4 bytes per pixel
	mediaMaxSide   = 512
	mediaCacheTTL  = 24 * time.Hour
)

var mediaKeyRe = regexp.MustCompile(`^[0-9a-f]{32}$`)

// mediaSem bounds concurrent fetch+decode work across all callers (each decode can take ~64 MB).
var mediaSem = make(chan struct{}, 4)

// errMediaPermanent marks failures worth remembering (the image is bad), as opposed to timeouts and outages.
var errMediaPermanent = errors.New("media: permanent")

// errBlockedAddress is returned when a media URL resolves to a private address.
var errBlockedAddress = errors.New("media: address not allowed")

var blockedNets = func() []*net.IPNet {
	var out []*net.IPNet
	for _, c := range []string{"0.0.0.0/8", "100.64.0.0/10", "192.0.0.0/24", "198.18.0.0/15", "240.0.0.0/4", "64:ff9b::/96", "64:ff9b:1::/48", "2002::/16"} {
		_, n, _ := net.ParseCIDR(c)
		out = append(out, n)
	}
	return out
}()

func blocked(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsUnspecified() || ip.IsMulticast() || ip.Equal(net.IPv4bcast) || ip.IsInterfaceLocalMulticast() {
		return true
	}
	for _, n := range blockedNets { // CGNAT, benchmarking, reserved, NAT64 and 6to4 (which can embed private IPv4)
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// newMediaClient builds an HTTP client that refuses private destinations,
// checked at connect time so DNS rebinding and redirects can't bypass it.
func newMediaClient(allowPrivate bool) *http.Client {
	dialer := &net.Dialer{Timeout: 5 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
		if allowPrivate {
			return nil
		}
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return err
		}
		if ip := net.ParseIP(host); ip == nil || blocked(ip) {
			return errBlockedAddress
		}
		return nil
	}}
	return &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{DialContext: dialer.DialContext, TLSHandshakeTimeout: 5 * time.Second,
			MaxIdleConnsPerHost: 4, ResponseHeaderTimeout: 10 * time.Second},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 || (req.URL.Scheme != "https" && req.URL.Scheme != "http") {
				return errors.New("media: redirect refused")
			}
			return nil
		},
	}
}

func mediaURL(src string) (string, error) {
	if strings.HasPrefix(src, "ipfs://") {
		p := strings.TrimPrefix(strings.TrimPrefix(src, "ipfs://"), "ipfs/")
		src = "https://ipfs.io/ipfs/" + p
	}
	u, err := url.Parse(src)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return "", fmt.Errorf("media: unsupported URL")
	}
	return u.String(), nil
}

// fetchImage downloads, decodes, bounds and re-encodes an image to PNG.
func fetchImage(ctx context.Context, c *http.Client, src string) ([]byte, error) {
	u, err := mediaURL(src)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "image/png,image/jpeg,image/gif,image/webp")
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			return nil, fmt.Errorf("%w: http %d", errMediaPermanent, resp.StatusCode)
		}
		return nil, fmt.Errorf("media: http %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, mediaMaxBytes+1))
	if err != nil {
		return nil, err
	}
	if len(raw) > mediaMaxBytes {
		return nil, fmt.Errorf("%w: too large", errMediaPermanent)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(raw)) // SVG and anything else fails here
	if err != nil {
		return nil, fmt.Errorf("%w: unsupported format: %v", errMediaPermanent, err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > mediaMaxPixels {
		return nil, fmt.Errorf("%w: image dimensions refused", errMediaPermanent)
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", errMediaPermanent, err)
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > mediaMaxSide || h > mediaMaxSide {
		if w >= h {
			h, w = h*mediaMaxSide/w, mediaMaxSide
		} else {
			w, h = w*mediaMaxSide/h, mediaMaxSide
		}
		if w < 1 {
			w = 1
		}
		if h < 1 {
			h = 1
		}
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)
		img = dst
	}
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func (s *Server) handleMedia(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	key := chi.URLParam(r, "key")
	if !mediaKeyRe.MatchString(key) {
		http.NotFound(w, r)
		return
	}
	ok, err := s.counter(ctx, "hb:rlmedia:"+clientIP(r), 1, 600)
	if err == nil && !ok {
		w.Header().Set("Retry-After", "60")
		http.Error(w, "rate limited", http.StatusTooManyRequests)
		return
	}
	ck := "hb:media:" + key
	if b, err := s.opt.Redis.Get(ctx, ck).Bytes(); err == nil {
		if len(b) == 0 { // negative cache
			http.NotFound(w, r)
			return
		}
		writeImage(w, b)
		return
	}
	src, err := s.opt.Store.MediaSource(ctx, key)
	if errors.Is(err, store.ErrNotFound) {
		http.NotFound(w, r)
		return
	} else if err != nil {
		s.internalErr(w, r, err)
		return
	}
	select {
	case mediaSem <- struct{}{}:
	case <-ctx.Done():
		return
	case <-time.After(5 * time.Second):
		w.Header().Set("Retry-After", "5")
		http.Error(w, "busy", http.StatusServiceUnavailable)
		return
	}
	// The fetch runs on its own deadline: a client that disconnects must not turn into a cached "no image" for everyone.
	fctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
	img, err := fetchImage(fctx, s.media, src)
	cancel()
	<-mediaSem
	if err != nil {
		s.opt.Log.Debug("media fetch failed", "key", key, "err", err)
		neg := time.Minute // timeouts, outages: try again soon
		if errors.Is(err, errMediaPermanent) || errors.Is(err, errBlockedAddress) {
			neg = time.Hour
		}
		s.opt.Redis.Set(context.WithoutCancel(ctx), ck, []byte{}, neg)
		http.NotFound(w, r)
		return
	}
	if len(img) <= 2<<20 {
		s.opt.Redis.Set(context.WithoutCancel(ctx), ck, img, mediaCacheTTL)
	}
	writeImage(w, img)
}

func writeImage(w http.ResponseWriter, b []byte) {
	h := w.Header()
	h.Set("Content-Type", "image/png")
	h.Set("Cache-Control", "public, max-age=86400, immutable")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")
	w.Write(b)
}
