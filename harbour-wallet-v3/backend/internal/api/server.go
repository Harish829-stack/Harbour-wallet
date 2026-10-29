// Package api is the extension-facing HTTP API (chi). Every /v1/me and
// /v1/rpc request is signed by the install's Ed25519 device key; abuse is
// bounded by proof-of-work at registration and per-device quotas in Redis.
package api

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/config"
	"harbour/backend/internal/core/risk"
	"harbour/backend/internal/store"
)

// Publisher publishes internal events (NATS JetStream from phase 3).
type Publisher interface {
	Publish(ctx context.Context, subject string, data []byte) error
}

// LogPublisher logs events; used until the NATS publisher lands in phase 3.
type LogPublisher struct{ Log *slog.Logger }

// Publish implements Publisher.
func (p LogPublisher) Publish(_ context.Context, subject string, data []byte) error {
	p.Log.Debug("event", "subject", subject, "bytes", len(data))
	return nil
}

// Options configure a Server.
type Options struct {
	Config       *config.Config
	Store        *store.Store
	Redis        *redis.Client
	LinkCrypto   *store.LinkCrypto
	Log          *slog.Logger
	Events       Publisher
	GatewayURL   string // e.g. http://rpc-gateway:8081
	GatewayToken string
	TrustProxy   bool // honour X-Forwarded-For (only behind your own load balancer)
	// TrustedProxies are the load balancer networks whose X-Forwarded-For is believed (default: RFC 1918 ranges).
	TrustedProxies []*net.IPNet
	// AllowPrivateMedia lets the media proxy fetch from private addresses (tests only).
	AllowPrivateMedia bool
	// AnyPushHost accepts push endpoints outside the known push services (tests only).
	AnyPushHost   bool
	PowDifficulty int // overrides config when > 0
	// Simulator predicts asset changes before signing (nil: eth_call + estimate only).
	Simulator risk.Simulator
	// Realtime (Centrifugo): the HMAC secret for client tokens and the
	// websocket URL handed to the extension.
	RealtimeSecret []byte
	RealtimeURL    string
	// VAPIDPublicKey is the Web Push application server key (base64url).
	VAPIDPublicKey string
	Now            func() time.Time
}

// Server holds dependencies.
type Server struct {
	opt      Options
	cfg      *config.Config
	rpcAllow map[string]bool
	deny     map[string]bool
	devCache sync.Map // device id -> cachedDevice
	http     *http.Client
	media    *http.Client
}

type cachedDevice struct {
	pub     ed25519.PublicKey
	tier    string
	revoked bool
	until   time.Time
}

// New builds a Server.
func New(opt Options) *Server {
	if opt.Now == nil {
		opt.Now = time.Now
	}
	if opt.Events == nil {
		opt.Events = LogPublisher{Log: opt.Log}
	}
	s := &Server{opt: opt, cfg: opt.Config, rpcAllow: map[string]bool{}, deny: map[string]bool{},
		http: &http.Client{Timeout: 30 * time.Second}, media: newMediaClient(opt.AllowPrivateMedia)}
	for _, m := range opt.Config.API.RPCAllowedMethods {
		s.rpcAllow[m] = true
	}
	for _, a := range opt.Config.API.BackfillDenyList {
		s.deny[strings.ToLower(a)] = true
	}
	return s
}

func (s *Server) powDifficulty() int {
	if s.opt.PowDifficulty > 0 {
		return s.opt.PowDifficulty
	}
	return s.cfg.API.PowDifficulty
}

// Handler returns the router.
func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	if s.opt.TrustProxy {
		r.Use(s.realIP)
	}
	r.Use(middleware.Recoverer, s.accessLog, maxBody(1<<20))
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := s.opt.Store.Pool.Ping(ctx); err != nil {
			writeErr(w, http.StatusServiceUnavailable, "unavailable", "Database unavailable", true)
			return
		}
		if err := s.opt.Redis.Ping(ctx).Err(); err != nil {
			writeErr(w, http.StatusServiceUnavailable, "unavailable", "Cache unavailable", true)
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})
	r.Route("/v1", func(r chi.Router) {
		r.Post("/devices/challenge", s.handleChallenge)
		r.Post("/devices", s.handleRegister)
		r.Get("/media/{key}", s.handleMedia) // loaded by <img>: unsigned, keys are unguessable
		r.Get("/push/vapid", s.handleVAPID)
		r.Group(func(r chi.Router) {
			r.Use(s.deviceAuth, s.rateLimit)
			r.Get("/me", s.handleMe)
			r.Get("/me/addresses", s.handleListAddresses)
			r.With(s.idempotencyNoBody).Put("/me/addresses", s.handlePutAddresses)
			r.Post("/rpc/{chain}", s.handleRPC)
			r.Get("/me/portfolio", s.handlePortfolio)
			r.Get("/me/portfolio/chart", s.handleChart)
			r.Get("/me/history", s.handleHistory)
			r.Get("/me/nfts", s.handleNFTs)
			r.Get("/assets/{chain}/{asset}", s.handleAsset)
			r.Get("/assets/{chain}/{asset}/prices", s.handleAssetPrices)
			r.Get("/tx/{chain}/{hash}", s.handleTx)
			r.Post("/tx/{chain}/estimate", s.handleEstimate)
			r.Post("/tx/{chain}/simulate", s.handleSimulate)
			r.With(s.idempotency).Post("/tx/{chain}/broadcast", s.handleBroadcast)
			r.Post("/realtime/token", s.handleRealtimeToken)
			r.Put("/me/push", s.handlePutPush)
			r.Delete("/me/push", s.handleDeletePush)
		})
	})
	return r
}

// ---------- helpers ----------

type apiError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeErr sends a user-presentable error; never raw upstream text.
func writeErr(w http.ResponseWriter, status int, code, msg string, retryable bool) {
	writeJSON(w, status, map[string]apiError{"error": {Code: code, Message: msg, Retryable: retryable}})
}

func (s *Server) internalErr(w http.ResponseWriter, r *http.Request, err error) {
	s.opt.Log.Error("internal error", "route", routePattern(r), "err", err)
	writeErr(w, http.StatusInternalServerError, "internal", "Something went wrong. Please try again.", true)
}

func maxBody(n int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, n)
			next.ServeHTTP(w, r)
		})
	}
}

func routePattern(r *http.Request) string {
	if rc := chi.RouteContext(r.Context()); rc != nil && rc.RoutePattern() != "" {
		return rc.RoutePattern()
	}
	return "unmatched"
}

// accessLog logs route patterns only: no query strings, bodies or addresses.
func (s *Server) accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		s.opt.Log.Info("http", "method", r.Method, "route", routePattern(r), "status", ww.Status(),
			"ms", time.Since(start).Milliseconds())
	})
}

// clientIP is the rate-limit identity of a caller: the IPv4 address, or the IPv6 /64 (one subscriber usually holds a
// whole /64, so per-address keys would be free to rotate).
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return host
	}
	if v4 := ip.To4(); v4 != nil {
		return v4.String()
	}
	return ip.Mask(net.CIDRMask(64, 128)).String() + "/64"
}

var defaultTrustedProxies = func() []*net.IPNet {
	var out []*net.IPNet
	for _, c := range []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "::1/128", "fc00::/7"} {
		_, n, _ := net.ParseCIDR(c)
		out = append(out, n)
	}
	return out
}()

// ParseCIDRs parses a comma-separated CIDR list (TRUSTED_PROXY_CIDRS).
func ParseCIDRs(list string) ([]*net.IPNet, error) {
	var out []*net.IPNet
	for _, c := range strings.Split(list, ",") {
		if c = strings.TrimSpace(c); c == "" {
			continue
		}
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

func inNets(ip net.IP, nets []*net.IPNet) bool {
	for _, n := range nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// realIP replaces RemoteAddr with the client address a trusted load balancer appended to X-Forwarded-For. Only a
// request that arrives from a trusted proxy is rewritten, and the chain is read from the right, skipping trusted hops,
// so a client cannot choose its own address by sending the header itself.
func (s *Server) realIP(next http.Handler) http.Handler {
	trusted := s.opt.TrustedProxies
	if len(trusted) == 0 {
		trusted = defaultTrustedProxies
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		if peer := net.ParseIP(host); peer != nil && inNets(peer, trusted) {
			hops := strings.Split(strings.Join(r.Header.Values("X-Forwarded-For"), ","), ",")
			for i := len(hops) - 1; i >= 0; i-- {
				ip := net.ParseIP(strings.TrimSpace(hops[i]))
				if ip == nil {
					break
				}
				if !inNets(ip, trusted) {
					r.RemoteAddr = net.JoinHostPort(ip.String(), "0")
					break
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

var evmAddr = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// normalizeAddress validates an address for its chain family.
func (s *Server) normalizeAddress(chainName, addr string) (string, error) {
	ch, ok := s.cfg.Chains[chainName]
	if !ok {
		return "", errors.New("unsupported network")
	}
	switch ch.Family {
	case "evm":
		if !evmAddr.MatchString(addr) {
			return "", errors.New("invalid address")
		}
		return strings.ToLower(addr), nil
	default:
		return "", errors.New("network not supported yet")
	}
}

func (s *Server) tier(name string) config.Tier {
	if t, ok := s.cfg.API.Tiers[name]; ok {
		return t
	}
	return s.cfg.API.Tiers[s.cfg.API.DefaultTier]
}
