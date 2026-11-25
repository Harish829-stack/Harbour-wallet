package gateway_test

// QA load test (TEST_PLAN T-IDX-051, IDX-03): 1000 rps of distinct eth_getBalance calls (distinct params, so the cache never answers)
// through the gateway HTTP handler to fake upstreams. Checks: every call succeeds, goroutines stay bounded and return to baseline,
// and the gateway adds < 5 ms at the median over calling an upstream directly.
// Opt-in: HB_QA_PERF=1 (HB_QA_PERF_SECS, default 10; HB_QA_OVERHEAD_MS overrides the 5 ms bound). Run without -race.

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func qaEnvInt(k string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil && v > 0 {
		return v
	}
	return def
}

type loadResult struct {
	lats []time.Duration
	bad  int64
	peak int
}

func drive(url, token string, rps, secs int, mkBody func(i int) string, tr *http.Transport) loadResult {
	cl := &http.Client{Transport: tr, Timeout: 10 * time.Second}
	var (
		mu   sync.Mutex
		res  loadResult
		bad  atomic.Int64
		wg   sync.WaitGroup
		peak atomic.Int64
	)
	tick := time.NewTicker(time.Second / time.Duration(rps))
	defer tick.Stop()
	stop := time.After(time.Duration(secs) * time.Second)
	i := 0
	for done := false; !done; {
		select {
		case <-stop:
			done = true
		case <-tick.C:
			i++
			n := i
			wg.Add(1)
			go func() {
				defer wg.Done()
				t0 := time.Now()
				req, _ := http.NewRequest("POST", url, strings.NewReader(mkBody(n)))
				if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}
				resp, err := cl.Do(req)
				if err != nil {
					bad.Add(1)
					return
				}
				b, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				d := time.Since(t0)
				if resp.StatusCode != 200 || !strings.Contains(string(b), `"result"`) {
					bad.Add(1)
					return
				}
				mu.Lock()
				res.lats = append(res.lats, d)
				mu.Unlock()
			}()
			if g := int64(runtime.NumGoroutine()); g > peak.Load() {
				peak.Store(g)
			}
		}
	}
	wg.Wait()
	res.bad = bad.Load()
	res.peak = int(peak.Load())
	sort.Slice(res.lats, func(a, b int) bool { return res.lats[a] < res.lats[b] })
	return res
}

func TestQAGatewayLoad1000rps(t *testing.T) {
	if os.Getenv("HB_QA_PERF") == "" {
		t.Skip("set HB_QA_PERF=1 to run the load test")
	}
	const rps = 1000
	secs := qaEnvInt("HB_QA_PERF_SECS", 10)
	maxOverhead := time.Duration(qaEnvInt("HB_QA_OVERHEAD_MS", 5)) * time.Millisecond

	r := newRig(t, 1e6, nil) // per-key provider limits out of the way: the test measures the gateway
	hs := httptest.NewServer(r.g.Handler("tok"))
	defer hs.Close()
	direct := httptest.NewServer(r.nodes["alchemy-a"])
	defer direct.Close()
	body := func(i int) string {
		return fmt.Sprintf(`{"jsonrpc":"2.0","id":%d,"method":"eth_getBalance","params":["0x%040x","latest"]}`, i, i)
	}
	newTr := func() *http.Transport {
		return &http.Transport{MaxIdleConns: 2048, MaxIdleConnsPerHost: 2048, IdleConnTimeout: 30 * time.Second}
	}

	baseTr := newTr()
	base := drive(direct.URL, "", rps, 3, body, baseTr)
	baseTr.CloseIdleConnections()
	time.Sleep(300 * time.Millisecond)
	baseG := runtime.NumGoroutine()

	tr := newTr()
	got := drive(hs.URL+"/rpc/testnet", "tok", rps, secs, body, tr)
	if got.bad != 0 {
		t.Errorf("%d calls failed", got.bad)
	}
	if len(got.lats) == 0 || len(base.lats) == 0 {
		t.Fatal("no successful calls")
	}
	pct := func(l []time.Duration, p float64) time.Duration { return l[int(float64(len(l)-1)*p)] }
	over := pct(got.lats, .5) - pct(base.lats, .5)
	t.Logf("gateway p50=%v p95=%v p99=%v | direct p50=%v | overhead p50=%v | peak goroutines=%d (baseline %d)",
		pct(got.lats, .5), pct(got.lats, .95), pct(got.lats, .99), pct(base.lats, .5), over, got.peak, baseG)
	if over > maxOverhead {
		t.Errorf("median overhead %v exceeds %v", over, maxOverhead)
	}
	if got.peak > baseG+rps*2 {
		t.Errorf("peak goroutines %d: unbounded growth (about %d requests are in flight at most)", got.peak, rps/4)
	}
	tr.CloseIdleConnections()
	var g int
	for end := time.Now().Add(5 * time.Second); time.Now().Before(end); time.Sleep(200 * time.Millisecond) {
		if g = runtime.NumGoroutine(); g <= baseG+25 {
			break
		}
	}
	if g > baseG+25 {
		buf := make([]byte, 1<<16)
		t.Errorf("goroutines %d after the run vs %d before: possible leak\n%s", g, baseG, buf[:runtime.Stack(buf, true)])
	}
}
