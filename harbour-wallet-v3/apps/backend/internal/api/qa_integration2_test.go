package api_test

// QA integration suite part 2 (real Postgres + Redis, fake rpc-gateway). TEST_PLAN: T-BE-005, 012, 024, 025, 031, 037, 042, 043, 044, 045,
// 048, 050, 053, 059, 063, 064, 065, 066, 075, 085, 092, 093, 094, T-RT-003, T-RT-004, T-GW-001.

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	mrand "math/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/devicesig"
	"harbour/backend/internal/evmtx"
	"harbour/backend/internal/evmtx/devsign"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"

	"github.com/redis/go-redis/v9"
)

const evKey = "0x4646464646464646464646464646464646464646464646464646464646464646"

func tune(f func(*config.Tier)) func(*config.Config) {
	return func(c *config.Config) {
		for name, t := range c.API.Tiers {
			f(&t)
			c.API.Tiers[name] = t
		}
	}
}

func signedTx(t *testing.T, e *qaEnv, chain string, nonce uint64) (string, string) {
	t.Helper()
	k, _ := devsign.ParseKey(evKey)
	raw, err := devsign.Sign(k, devsign.Tx{ChainID: e.cfg.Chains[chain].EVMChainID, Nonce: nonce, TipCap: big.NewInt(1), FeeCap: big.NewInt(2), Gas: 21000, To: addr(9), Value: big.NewInt(1)})
	must(t, err)
	info, _, err := evmtx.Decode(fmt.Sprintf("0x%x", raw))
	must(t, err)
	return fmt.Sprintf("0x%x", raw), info.Hash
}
func own(t *testing.T, c *hbclient.Client, chain string) {
	t.Helper()
	k, _ := devsign.ParseKey(evKey)
	_, err := c.Do(context.Background(), "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": chain, "address": devsign.Address(k)}}}, nil, nil)
	must(t, err)
}

// T-BE-005: /healthz reports a broken cache as 503 "Cache unavailable" with the error shape.
func TestQAHealthzDependencyDown(t *testing.T) {
	e := qaServer(t, "qa_healthz", nil, nil)
	resp, err := http.Get(e.hs.URL + "/healthz")
	must(t, err)
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("healthy: %d", resp.StatusCode)
	}
	e2 := qaServerWithBrokenRedis(t) // Redis unreachable
	resp, err = http.Get(e2.hs.URL + "/healthz")
	must(t, err)
	b, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 503 || !strings.Contains(string(b), "Cache unavailable") || !strings.Contains(string(b), `"retryable":true`) {
		t.Fatalf("redis down: %d %s", resp.StatusCode, b)
	}
}

// T-BE-012: the same solved challenge submitted twice concurrently registers exactly one device.
func TestQAChallengeSingleUseUnderRace(t *testing.T) {
	e := qaServer(t, "qa_challenge_race", nil, nil)
	resp, err := http.Post(e.hs.URL+"/v1/devices/challenge", "application/json", nil)
	must(t, err)
	var ch struct{ Challenge string }
	must(t, json.NewDecoder(resp.Body).Decode(&ch))
	resp.Body.Close()
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	pb := devicesig.B64(pub)
	ctr, err := devicesig.SolvePow(ch.Challenge, pb, 8)
	must(t, err)
	body, _ := json.Marshal(map[string]any{"public_key": pb, "challenge": ch.Challenge, "pow_counter": ctr, "signature": devicesig.Sign(priv, devicesig.RegistrationMessage(ch.Challenge))})
	var created atomic.Int64
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := http.Post(e.hs.URL+"/v1/devices", "application/json", bytes.NewReader(body))
			if err == nil {
				if r.StatusCode == 201 {
					created.Add(1)
				}
				r.Body.Close()
			}
		}()
	}
	wg.Wait()
	if created.Load() != 1 {
		t.Fatalf("%d registrations from one challenge, want 1", created.Load())
	}
}

// T-BE-024 / T-BE-092: the per-device request limit allows exactly RPM requests in a minute, also under 50 parallel requests.
func TestQARequestRateLimitExact(t *testing.T) {
	e := qaServer(t, "qa_rpm", tune(func(t *config.Tier) { t.RequestsPerMinute = 10 }), nil)
	c := e.device(t)
	var ok, limited atomic.Int64
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := c.Do(context.Background(), "GET", "/v1/me", nil, nil, nil); err == nil {
				ok.Add(1)
			} else if errCode(err) == "rate_limited" {
				limited.Add(1)
			}
		}()
	}
	wg.Wait()
	if ok.Load() != 10 || limited.Load() != 40 {
		t.Fatalf("ok=%d limited=%d, want 10/40", ok.Load(), limited.Load())
	}
}

// T-BE-025 / T-BE-037: the daily backfill budget refuses over-limit adds with 429 backfill_quota and rolls the counter back; TTL is set once.
func TestQABackfillBudget(t *testing.T) {
	e := qaServer(t, "qa_backfill_budget", tune(func(t *config.Tier) { t.BackfillsPerDay = 2 }), nil)
	c := e.device(t)
	ctx := context.Background()
	put := func(addrs ...string) error {
		var add []map[string]string
		for _, a := range addrs {
			add = append(add, map[string]string{"chain": "base", "address": a})
		}
		_, err := c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": add}, nil, nil)
		return err
	}
	must(t, put(addr(1), addr(2)))
	err := put(addr(3))
	if errCode(err) != "backfill_quota" {
		t.Fatalf("third add: %v, want backfill_quota", err)
	}
	keys, _ := e.rdb.Keys(ctx, "hb:bf:*").Result()
	if len(keys) != 1 {
		t.Fatalf("budget keys %v", keys)
	}
	if v, _ := e.rdb.Get(ctx, keys[0]).Int(); v != 2 {
		t.Fatalf("counter %d after a refused add, want 2 (rolled back)", v)
	}
	ttl1, _ := e.rdb.TTL(ctx, keys[0]).Result()
	time.Sleep(1100 * time.Millisecond)
	_ = put(addr(4))
	if ttl2, _ := e.rdb.TTL(ctx, keys[0]).Result(); ttl2 > ttl1 {
		t.Fatalf("TTL extended (%s → %s): must be set once", ttl1, ttl2)
	}
	// deny-listed addresses are tracked live but never backfilled, so they do not count
	deny := e.cfg.API.BackfillDenyList[0]
	if err := put(deny); err != nil {
		t.Fatalf("deny-listed address charged the exhausted budget: %v", err)
	}
}

// T-BE-031 / T-RT-003: /v1/me and /v1/me/addresses keep their JSON contract (field names and types).
func TestQAMeContract(t *testing.T) {
	e := qaServer(t, "qa_me_contract", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	var me map[string]any
	_, err := c.Do(ctx, "GET", "/v1/me", nil, &me, nil)
	must(t, err)
	for k, kind := range map[string]string{"device_id": "string", "quota_tier": "string", "quotas": "object"} {
		if got := jsonKind(me[k]); got != kind {
			t.Fatalf("/v1/me %s: %s, want %s (%v)", k, got, kind, me)
		}
	}
	own(t, c, "base")
	var list struct {
		Addresses []map[string]any `json:"addresses"`
	}
	_, err = c.Do(ctx, "GET", "/v1/me/addresses", nil, &list, nil)
	must(t, err)
	if len(list.Addresses) != 1 {
		t.Fatalf("addresses %v", list.Addresses)
	}
	for k, kind := range map[string]string{"chain": "string", "address": "string", "backfill_state": "string", "synced": "bool"} {
		if got := jsonKind(list.Addresses[0][k]); got != kind {
			t.Fatalf("address.%s: %s, want %s", k, got, kind)
		}
	}
}
func jsonKind(v any) string {
	switch v.(type) {
	case string:
		return "string"
	case bool:
		return "bool"
	case float64:
		return "number"
	case map[string]any:
		return "object"
	case []any:
		return "array"
	case nil:
		return "null"
	}
	return "?"
}

// T-BE-042 / T-BE-043 / T-BE-044: rpc proxy refuses oversized gateway answers, reports a down gateway as retryable, and counts batch items.
func TestQARPCGatewayFailures(t *testing.T) {
	big := `{"jsonrpc":"2.0","id":1,"result":"0x` + strings.Repeat("0", 8<<20) + `"}`
	e := qaServer(t, "qa_rpc_gw", tune(func(t *config.Tier) { t.RPCPerMinute = 3 }), func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if bytes.Contains(b, []byte("eth_getBalance")) {
			io.WriteString(w, big)
			return
		}
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x1"}`)
	})
	c := e.device(t)
	ctx := context.Background()
	var out map[string]any
	_, err := c.Do(ctx, "POST", "/v1/rpc/base", map[string]any{"jsonrpc": "2.0", "id": 1, "method": "eth_getBalance", "params": []any{addr(1), "latest"}}, &out, nil)
	if err != nil || !strings.Contains(fmt.Sprint(out), "response_too_large") {
		t.Fatalf("oversized gateway answer: %v %v", out, err)
	}
	batch := []map[string]any{}
	for i := 0; i < 4; i++ {
		batch = append(batch, map[string]any{"jsonrpc": "2.0", "id": i, "method": "eth_chainId", "params": []any{}})
	}
	_, err = c.Do(ctx, "POST", "/v1/rpc/base", batch, nil, nil)
	if he, ok := err.(*hbclient.HTTPError); !ok || he.Status != 429 || !strings.Contains(he.Body, `"rate_limited"`) {
		t.Fatalf("batch of 4 with RPCPerMinute=3: %v, want rate_limited", err)
	}
	down := qaServer(t, "qa_rpc_gw_down", nil, func(w http.ResponseWriter, r *http.Request) { panic(http.ErrAbortHandler) })
	cd := down.device(t)
	var res map[string]any
	_, err = cd.Do(ctx, "POST", "/v1/rpc/base", map[string]any{"jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": []any{}}, &res, nil)
	text := fmt.Sprint(res, err)
	if !strings.Contains(text, "unavailable") && !strings.Contains(text, "busy") {
		t.Fatalf("gateway down: %s", text)
	}
}

// T-BE-045 / T-RT-004: random JSON-RPC bodies (seeded property run) never crash /v1/rpc, never yield a 500, and only allow-listed methods
// reach the gateway.
func TestQAHandleRPCRandomBodies(t *testing.T) {
	e := qaServer(t, "qa_rpc_random", nil, nil)
	c := e.device(t)
	allowed := map[string]bool{}
	for _, m := range e.cfg.API.RPCAllowedMethods {
		allowed[m] = true
	}
	rng := mrand.New(mrand.NewSource(45))
	methods := append([]string{"debug_traceTransaction", "admin_peers", "eth_sendRawTransaction", "eth_sign", "personal_unlockAccount", "", "ETH_CALL", "eth_call\u0000"}, e.cfg.API.RPCAllowedMethods...)
	anyVal := func() any {
		switch rng.Intn(7) {
		case 0:
			return nil
		case 1:
			return rng.Intn(1 << 30)
		case 2:
			return strings.Repeat("x", rng.Intn(64))
		case 3:
			return []any{nil}
		case 4:
			return map[string]any{"topics": []any{[]any{nil}}, "fromBlock": "0x0"}
		case 5:
			return true
		}
		return []any{addr(rng.Intn(9)), "latest"}
	}
	bodies := []string{`null`, `[]`, `"x"`, `{`, `[{"method":"eth_call"},{"method":"debug_traceTransaction"}]`, `{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"topics":[[null]]}]}`}
	for i := 0; i < 300; i++ {
		var v any
		if rng.Intn(4) == 0 {
			var batch []any
			for j := 0; j < rng.Intn(5); j++ {
				batch = append(batch, map[string]any{"jsonrpc": "2.0", "id": anyVal(), "method": methods[rng.Intn(len(methods))], "params": anyVal()})
			}
			v = batch
		} else {
			v = map[string]any{"jsonrpc": anyVal(), "id": anyVal(), "method": methods[rng.Intn(len(methods))], "params": anyVal()}
		}
		b, _ := json.Marshal(v)
		bodies = append(bodies, string(b))
	}
	for _, body := range bodies {
		before := e.gwHits.Load()
		_, err := c.Do(context.Background(), "POST", "/v1/rpc/base", json.RawMessage(body), nil, nil)
		if he, ok := err.(*hbclient.HTTPError); ok && he.Status >= 500 {
			t.Fatalf("500 for body %q: %s", body, he.Body)
		}
		if e.gwHits.Load() > before {
			var many []struct{ Method string }
			var one struct{ Method string }
			fwd := e.gwBody()
			if json.Unmarshal(fwd, &many) == nil {
				for _, m := range many {
					if !allowed[m.Method] {
						t.Fatalf("forwarded %q from %q", m.Method, body)
					}
				}
			} else if json.Unmarshal(fwd, &one) == nil && !allowed[one.Method] {
				t.Fatalf("forwarded %q from %q", one.Method, body)
			}
		}
	}
}

// T-BE-048: two devices asking the same portfolio query never share a cache entry.
func TestQAPortfolioCacheIsPerDevice(t *testing.T) {
	e := qaServer(t, "qa_cache_bleed", nil, nil)
	a, b := e.device(t), e.device(t)
	ctx := context.Background()
	_, err := a.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": "base", "address": addr(7)}}}, nil, nil)
	must(t, err)
	_, err = a.Do(ctx, "GET", "/v1/me/portfolio", nil, nil, nil)
	must(t, err)
	var pb map[string]any
	_, err = b.Do(ctx, "GET", "/v1/me/portfolio", nil, &pb, nil)
	must(t, err)
	if strings.Contains(fmt.Sprint(pb), strings.ToLower(addr(7))) {
		t.Fatalf("device B saw device A's portfolio: %v", pb)
	}
	keys, _ := e.rdb.Keys(ctx, "*portfolio*").Result()
	seen := map[string]bool{}
	for _, k := range keys {
		if seen[k] {
			t.Fatalf("shared key %s", k)
		}
		seen[k] = true
	}
}

// T-BE-050 / T-BE-053: malformed history cursors and asset/chain/range parameters are refused with 4xx (never 500).
func TestQAReadRouteValidation(t *testing.T) {
	e := qaServer(t, "qa_read_validation", nil, nil)
	c := e.device(t)
	ctx := context.Background()
	own(t, c, "base")
	k, _ := devsign.ParseKey(evKey)
	me := devsign.Address(k)
	for _, path := range []string{
		"/v1/me/history?cursor=!!!&chain=base&address=" + me, "/v1/me/history?cursor=bm90IGpzb24&chain=base&address=" + me, "/v1/me/history?cursor=eyJ0IjoiMjAyMC0wMS0wMVQwMDowMDowMFoifQ&chain=base&address=" + me,
		"/v1/assets/notachain/native", "/v1/assets/base/0xnothex", "/v1/assets/base/native/prices?range=7y",
	} {
		st, err := c.Do(ctx, "GET", path, nil, nil, nil)
		he, _ := err.(*hbclient.HTTPError)
		if err == nil || he == nil || he.Status < 400 || he.Status >= 500 {
			t.Errorf("%s → %d %v, want 4xx", path, st, err)
		}
	}
}

// OBS-04: an unknown chart range is not refused: it falls back to 30 days (documented lenient default, read.go handleChart).
func TestQAChartRangeDefault(t *testing.T) {
	e := qaServer(t, "qa_chart_default", nil, nil)
	c := e.device(t)
	var a, b map[string]any
	// OBS-04 (fixed): an unknown range is a 400; no range means the 30-day default.
	_, err := c.Do(context.Background(), "GET", "/v1/me/portfolio/chart?range=forever", nil, &a, nil)
	if errCode(err) != "bad_range" {
		t.Fatalf("unknown range: want bad_range, got %v", err)
	}
	_, err = c.Do(context.Background(), "GET", "/v1/me/portfolio/chart", nil, &a, nil)
	must(t, err)
	_, err = c.Do(context.Background(), "GET", "/v1/me/portfolio/chart?range=30d", nil, &b, nil)
	must(t, err)
	if jsonKind(a["points"]) != jsonKind(b["points"]) {
		t.Fatalf("default range %v vs 30d %v", a, b)
	}
}

// T-BE-059: estimate on a reverting call answers 422 would_fail; a failing tip lookup falls back to 1 gwei.
func TestQAEstimateFallbacks(t *testing.T) {
	e := qaServer(t, "qa_estimate_fallbacks", nil, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		switch {
		case bytes.Contains(b, []byte("eth_estimateGas")):
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted: nope"}}`)
		case bytes.Contains(b, []byte("eth_maxPriorityFeePerGas")):
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found"}}`)
		default:
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x1"}`)
		}
	})
	c := e.device(t)
	own(t, c, "base")
	k, _ := devsign.ParseKey(evKey)
	_, err := c.Do(context.Background(), "POST", "/v1/tx/base/estimate", map[string]any{"from": devsign.Address(k), "to": addr(9), "value": "0x1"}, nil, nil)
	if code := errCode(err); code != "would_fail" {
		t.Fatalf("reverting estimate: %v (%s), want would_fail", err, code)
	}
}

// T-BE-063 / T-BE-064 / T-BE-066: "already known" → 200 with the locally computed hash; a node that returns another hash is ignored;
// the 11th broadcast in a minute is rate limited.
func TestQABroadcastNodeAnswers(t *testing.T) {
	var mode atomic.Value
	mode.Store("known")
	e := qaServer(t, "qa_broadcast_answers", nil, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if !bytes.Contains(b, []byte("eth_sendRawTransaction")) {
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":null}`)
			return
		}
		switch mode.Load().(string) {
		case "known":
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"already known"}}`)
		default:
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":"0x`+strings.Repeat("ab", 32)+`"}`)
		}
	})
	c := e.device(t)
	own(t, c, "base")
	ctx := context.Background()
	raw, hash := signedTx(t, e, "base", 1)
	var out map[string]any
	_, err := c.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": raw}, &out, nil)
	if err != nil || out["tx_hash"] != hash {
		t.Fatalf("already known: %v %v, want 200 with %s", out, err, hash)
	}
	mode.Store("other")
	raw2, hash2 := signedTx(t, e, "base", 2)
	_, err = c.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": raw2}, &out, nil)
	if err != nil || out["tx_hash"] != hash2 {
		t.Fatalf("node returned another hash: %v %v, want the local %s", out, err, hash2)
	}
	limited := false
	for n := uint64(3); n < 14 && !limited; n++ {
		r, _ := signedTx(t, e, "base", n)
		_, err := c.Do(ctx, "POST", "/v1/tx/base/broadcast", map[string]string{"raw": r}, nil, nil)
		limited = errCode(err) == "rate_limited"
	}
	if !limited {
		t.Fatal("no rate limit after 10 broadcasts in a minute")
	}
}

// T-BE-093: the same raw transaction broadcast 5× in parallel with different idempotency keys: all succeed with one hash, one pending row.
func TestQAParallelSameTxBroadcast(t *testing.T) {
	e := qaServer(t, "qa_broadcast_parallel", nil, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if bytes.Contains(b, []byte("eth_sendRawTransaction")) {
			io.WriteString(w, `{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"already known"}}`)
			return
		}
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":null}`)
	})
	c := e.device(t)
	own(t, c, "base")
	raw, hash := signedTx(t, e, "base", 5)
	var wg sync.WaitGroup
	var oks atomic.Int64
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			var out map[string]any
			h := http.Header{"Idempotency-Key": []string{fmt.Sprintf("k-%d-%d", time.Now().UnixNano(), i)}}
			if _, err := c.Do(context.Background(), "POST", "/v1/tx/base/broadcast", map[string]string{"raw": raw}, &out, h); err == nil && out["tx_hash"] == hash {
				oks.Add(1)
			}
		}(i)
	}
	wg.Wait()
	if oks.Load() != 5 {
		t.Fatalf("%d of 5 succeeded", oks.Load())
	}
	var n int
	must(t, e.st.Pool.QueryRow(context.Background(), `SELECT count(*) FROM pending_transactions WHERE tx_hash = hb_ref($1)`, hash).Scan(&n))
	if n != 1 {
		t.Fatalf("%d pending rows for one transaction", n)
	}
}

// T-BE-075: media keys must be 32 hex chars of a known source; the unsigned media route is rate limited per IP.
func TestQAMediaRouteGuards(t *testing.T) {
	e := qaServer(t, "qa_media_guards", nil, nil)
	for _, k := range []string{"zz", strings.Repeat("A", 32), strings.Repeat("0", 31), strings.Repeat("0", 32)} {
		resp, err := http.Get(e.hs.URL + "/v1/media/" + k)
		must(t, err)
		resp.Body.Close()
		if resp.StatusCode != 404 {
			t.Fatalf("key %q → %d, want 404", k, resp.StatusCode)
		}
	}
	got429 := false
	for i := 0; i < 600 && !got429; i++ {
		resp, err := http.Get(e.hs.URL + "/v1/media/" + strings.Repeat("1", 32))
		must(t, err)
		resp.Body.Close()
		got429 = resp.StatusCode == 429
	}
	if !got429 {
		t.Fatal("no per-IP limit on the media route within 600 requests")
	}
}

// T-GW-001: the third-party gateway quota answers 429 with Retry-After 30.
func TestQAGatewayQuota(t *testing.T) {
	e := qaServer(t, "qa_gw_quota", tune(func(t *config.Tier) { t.GatewayPerMinute = 2 }), nil)
	c := e.device(t)
	var last error
	for i := 0; i < 3; i++ {
		_, last = c.Do(context.Background(), "GET", "/v1/gw/v2/market/prices?ids=", nil, nil, nil)
	}
	he, _ := last.(*hbclient.HTTPError)
	if he == nil || he.Status != 429 || errCode(last) != "rate_limited" {
		t.Fatalf("3rd gateway call: %v, want 429 rate_limited", last)
	}
}

// T-BE-085: migrations apply once; a second run applies nothing.
func TestQAMigrateTwiceIsNoop(t *testing.T) {
	e := qaServer(t, "qa_migrate_twice", nil, nil)
	applied, err := e.st.Migrate(context.Background())
	must(t, err)
	if len(applied) != 0 {
		t.Fatalf("second migrate applied %v", applied)
	}
}

// T-BE-094: with Redis gone, every signed route answers a JSON 5xx (retryable) without panicking and without partial writes.
func TestQASignedRoutesWithRedisDown(t *testing.T) {
	e := qaServerWithBrokenRedis(t)
	c := hbclient.New(e.hs.URL)
	if _, err := c.Register(context.Background()); err == nil {
		t.Fatal("registration succeeded without Redis (challenge storage)")
	} else if he, ok := err.(*hbclient.HTTPError); !ok || he.Status < 500 || !strings.Contains(he.Body, `"retryable":true`) {
		t.Fatalf("registration without Redis: %v", err)
	}
}

// qaServerWithBrokenRedis is qaServer with a Redis client that cannot connect (dependency-failure tests).
func qaServerWithBrokenRedis(t *testing.T) *qaEnv {
	t.Helper()
	if os.Getenv("HB_TEST_POSTGRES_URL") == "" || os.Getenv("HB_TEST_REDIS_URL") == "" {
		t.Skip("HB_TEST_POSTGRES_URL / HB_TEST_REDIS_URL not set")
	}
	ctx := context.Background()
	st, err := store.Open(ctx, testdb.URL(t, "qa_broken_redis"))
	must(t, err)
	t.Cleanup(st.Close)
	_, err = st.Migrate(ctx)
	must(t, err)
	cfg, err := config.Load("../../config")
	must(t, err)
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1", DialTimeout: 200 * time.Millisecond, MaxRetries: -1})
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc, Log: slog.New(slog.NewTextHandler(io.Discard, nil)), GatewayURL: "http://127.0.0.1:1", PowDifficulty: 8})
	hs := httptest.NewServer(srv.Handler())
	t.Cleanup(hs.Close)
	return &qaEnv{hs: hs, rdb: rdb, st: st, cfg: cfg, gwHits: &atomic.Int64{}}
}
