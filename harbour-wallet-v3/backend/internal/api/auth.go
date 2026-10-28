package api

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/devicesig"
	"harbour/backend/internal/store"
)

type ctxKey int

const deviceKey ctxKey = 1

// AuthDevice is the authenticated device in a request context.
type AuthDevice struct {
	ID   string
	Tier string
}

func deviceFrom(ctx context.Context) AuthDevice {
	d, _ := ctx.Value(deviceKey).(AuthDevice)
	return d
}

// ---------- registration ----------

type challengeResp struct {
	Challenge  string    `json:"challenge"`
	Difficulty int       `json:"difficulty"`
	ExpiresAt  time.Time `json:"expires_at"`
}

func (s *Server) handleChallenge(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	now := s.opt.Now()
	ipKey := fmt.Sprintf("hb:chal:%s:%d", clientIP(r), now.Unix()/3600)
	n, err := s.opt.Redis.Incr(ctx, ipKey).Result()
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	if n == 1 {
		s.opt.Redis.Expire(ctx, ipKey, 2*time.Hour)
	}
	if int(n) > s.cfg.API.ChallengesPerHour {
		w.Header().Set("Retry-After", "3600")
		writeErr(w, http.StatusTooManyRequests, "rate_limited", "Too many attempts. Please try again later.", true)
		return
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		s.internalErr(w, r, err)
		return
	}
	ch := devicesig.B64(raw)
	diff := s.powDifficulty()
	ttl := s.cfg.API.PowTTL
	if err := s.opt.Redis.Set(ctx, "hb:pow:"+ch, diff, ttl).Err(); err != nil {
		s.internalErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, challengeResp{Challenge: ch, Difficulty: diff, ExpiresAt: now.Add(ttl).UTC()})
}

type registerReq struct {
	PublicKey   string          `json:"public_key"`
	Challenge   string          `json:"challenge"`
	PowCounter  string          `json:"pow_counter"`
	Signature   string          `json:"signature"`
	Attestation json.RawMessage `json:"attestation,omitempty"`
}

type registerResp struct {
	DeviceID  string     `json:"device_id"`
	QuotaTier string     `json:"quota_tier"`
	Quotas    quotasView `json:"quotas"`
}

type quotasView struct {
	MaxAddresses      int `json:"max_addresses"`
	BackfillsPerDay   int `json:"backfills_per_day"`
	RequestsPerMinute int `json:"requests_per_minute"`
	RPCPerMinute      int `json:"rpc_per_minute"`
}

func (s *Server) quotas(tier string) quotasView {
	t := s.tier(tier)
	return quotasView{t.MaxAddresses, t.BackfillsPerDay, t.RequestsPerMinute, t.RPCPerMinute}
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	pub, err := devicesig.UnB64(req.PublicKey)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		writeErr(w, http.StatusBadRequest, "bad_key", "Invalid device key.", false)
		return
	}
	if len(req.Attestation) > 4096 {
		writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
		return
	}
	// Single use: GETDEL so a solved challenge can't register twice.
	diffStr, err := s.opt.Redis.GetDel(ctx, "hb:pow:"+req.Challenge).Result()
	if errors.Is(err, redis.Nil) {
		writeErr(w, http.StatusBadRequest, "challenge_expired", "Setup took too long. Please try again.", true)
		return
	} else if err != nil {
		s.internalErr(w, r, err)
		return
	}
	diff, _ := strconv.Atoi(diffStr)
	if !devicesig.CheckPow(req.Challenge, req.PublicKey, req.PowCounter, diff) {
		writeErr(w, http.StatusBadRequest, "bad_pow", "Device check failed. Please try again.", true)
		return
	}
	if !devicesig.Verify(pub, devicesig.RegistrationMessage(req.Challenge), req.Signature) {
		writeErr(w, http.StatusBadRequest, "bad_signature", "Device check failed. Please try again.", false)
		return
	}
	tier := s.cfg.API.DefaultTier
	d, err := s.opt.Store.CreateDevice(ctx, pub, tier, req.Attestation)
	if errors.Is(err, store.ErrDuplicateKey) {
		writeErr(w, http.StatusConflict, "already_registered", "This device is already registered.", false)
		return
	} else if err != nil {
		s.internalErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, registerResp{DeviceID: d.ID, QuotaTier: d.QuotaTier, Quotas: s.quotas(d.QuotaTier)})
}

// ---------- signed requests ----------

func (s *Server) lookupDevice(ctx context.Context, id string) (cachedDevice, error) {
	now := s.opt.Now()
	if v, ok := s.devCache.Load(id); ok {
		cd := v.(cachedDevice)
		if now.Before(cd.until) {
			return cd, nil
		}
	}
	d, err := s.opt.Store.GetDevice(ctx, id)
	if err != nil {
		return cachedDevice{}, err
	}
	cd := cachedDevice{pub: d.PublicKey, tier: d.QuotaTier, revoked: d.RevokedAt != nil, until: now.Add(time.Minute)}
	s.devCache.Store(id, cd)
	return cd, nil
}

var uuidRe = func(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
		} else if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

func (s *Server) deviceAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		dev := r.Header.Get(devicesig.HeaderDevice)
		date := r.Header.Get(devicesig.HeaderDate)
		nonce := r.Header.Get(devicesig.HeaderNonce)
		sig := r.Header.Get(devicesig.HeaderSignature)
		unauth := func() {
			writeErr(w, http.StatusUnauthorized, "unauthorized", "This device needs to sign in again.", false)
		}
		if !uuidRe(dev) || !devicesig.ValidNonce(nonce) || sig == "" {
			unauth()
			return
		}
		ts, err := strconv.ParseInt(date, 10, 64)
		if err != nil {
			unauth()
			return
		}
		if skew := s.opt.Now().Sub(time.Unix(ts, 0)); skew > s.cfg.API.ClockSkew || -skew > s.cfg.API.ClockSkew {
			writeErr(w, http.StatusUnauthorized, "clock_skew", "Your computer's clock looks wrong. Please check the date and time.", false)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeErr(w, http.StatusRequestEntityTooLarge, "too_large", "Request too large.", false)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		cd, err := s.lookupDevice(ctx, dev)
		if errors.Is(err, store.ErrNotFound) {
			unauth()
			return
		} else if err != nil {
			s.internalErr(w, r, err)
			return
		}
		if cd.revoked {
			unauth()
			return
		}
		canon := devicesig.Canonical(r.Method, r.URL.RequestURI(), date, nonce, dev, body)
		if !devicesig.Verify(cd.pub, canon, sig) {
			unauth()
			return
		}
		// Replay protection: a nonce is accepted once within the skew window.
		ok, err := s.opt.Redis.SetNX(ctx, "hb:nonce:"+dev+":"+nonce, 1, 2*s.cfg.API.ClockSkew).Result()
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		if !ok {
			unauth()
			return
		}
		go s.opt.Store.TouchDevice(context.WithoutCancel(ctx), dev) //nolint:errcheck
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, deviceKey, AuthDevice{ID: dev, Tier: cd.tier})))
	})
}

// counter increments a per-minute window counter and reports whether it is within limit.
func (s *Server) counter(ctx context.Context, key string, add int64, limit int) (bool, error) {
	k := fmt.Sprintf("%s:%d", key, s.opt.Now().Unix()/60)
	pipe := s.opt.Redis.TxPipeline()
	incr := pipe.IncrBy(ctx, k, add)
	pipe.Expire(ctx, k, 2*time.Minute)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, err
	}
	return incr.Val() <= int64(limit), nil
}

// dailyCounter adds n to today's counter and reports whether it stays within limit.
// Over-limit attempts are rolled back so they don't consume tomorrow's room.
func (s *Server) dailyCounter(ctx context.Context, key string, n int64, limit int) (bool, error) {
	k := fmt.Sprintf("%s:%s", key, s.opt.Now().UTC().Format("20060102"))
	v, err := s.opt.Redis.IncrBy(ctx, k, n).Result()
	if err != nil {
		return false, err
	}
	s.opt.Redis.Expire(ctx, k, 48*time.Hour)
	if v > int64(limit) {
		s.opt.Redis.DecrBy(ctx, k, n)
		return false, nil
	}
	return true, nil
}

func (s *Server) rateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		d := deviceFrom(r.Context())
		ok, err := s.counter(r.Context(), "hb:rl:"+d.ID, 1, s.tier(d.Tier).RequestsPerMinute)
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		if !ok {
			w.Header().Set("Retry-After", "60")
			writeErr(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Please wait a moment.", true)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---------- idempotency ----------

type idemRecord struct {
	Status  int    `json:"status"`
	Body    []byte `json:"body"`
	ReqHash string `json:"req_hash"`
}

type captureWriter struct {
	http.ResponseWriter
	status int
	buf    bytes.Buffer
}

func (c *captureWriter) WriteHeader(code int) { c.status = code; c.ResponseWriter.WriteHeader(code) }
func (c *captureWriter) Write(b []byte) (int, error) {
	if c.status == 0 {
		c.status = 200
	}
	c.buf.Write(b)
	return c.ResponseWriter.Write(b)
}

// idempotency replays the stored response for a repeated Idempotency-Key.
func (s *Server) idempotency(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		if len(key) > 128 {
			writeErr(w, http.StatusBadRequest, "bad_request", "Invalid request.", false)
			return
		}
		ctx := r.Context()
		body, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewReader(body))
		h := sha256.Sum256(append([]byte(r.Method+" "+r.URL.Path+"\n"), body...))
		reqHash := hex.EncodeToString(h[:])
		rk := "hb:idem:" + deviceFrom(ctx).ID + ":" + key
		ttl := s.cfg.API.IdempotencyTTL
		ok, err := s.opt.Redis.SetNX(ctx, rk, "pending", ttl).Result()
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		if !ok {
			v, err := s.opt.Redis.Get(ctx, rk).Bytes()
			if err != nil || string(v) == "pending" {
				writeErr(w, http.StatusConflict, "in_progress", "This request is still being processed.", true)
				return
			}
			var rec idemRecord
			if json.Unmarshal(v, &rec) != nil || rec.ReqHash != reqHash {
				writeErr(w, http.StatusUnprocessableEntity, "idempotency_mismatch", "This request conflicts with an earlier one.", false)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Idempotent-Replay", "true")
			w.WriteHeader(rec.Status)
			w.Write(rec.Body)
			return
		}
		cw := &captureWriter{ResponseWriter: w}
		next.ServeHTTP(cw, r)
		if cw.status >= 500 {
			s.opt.Redis.Del(context.WithoutCancel(ctx), rk) // allow retry
			return
		}
		b, _ := json.Marshal(idemRecord{Status: cw.status, Body: cw.buf.Bytes(), ReqHash: reqHash})
		s.opt.Redis.Set(context.WithoutCancel(ctx), rk, b, ttl)
	})
}
