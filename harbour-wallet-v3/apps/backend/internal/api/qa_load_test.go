package api_test

// QA load test (TEST_PLAN T-BE-088, BE-01..28): signed GET /v1/me at a steady 200 rps against real Postgres + Redis.
// Opt-in: HB_QA_PERF=1 (HB_QA_PERF_SECS shortens the 30 s default; HB_QA_P99_MS overrides the 100 ms bound).
// Run it WITHOUT -race: the race detector slows request handling several times over and makes the latency bound meaningless.

import (
	"context"
	"net/http"
	"os"
	"runtime"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/hbclient"
)

func envInt(k string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil && v > 0 {
		return v
	}
	return def
}

func TestQALoadSignedMe200rps(t *testing.T) {
	if os.Getenv("HB_QA_PERF") == "" {
		t.Skip("set HB_QA_PERF=1 to run the load test")
	}
	const rps, ndev = 200, 40
	secs := envInt("HB_QA_PERF_SECS", 30)
	p99Max := time.Duration(envInt("HB_QA_P99_MS", 100)) * time.Millisecond

	e := qaServer(t, "qa_load", func(c *config.Config) {
		c.API.ChallengesPerHour = 100000
		c.API.RegistrationsPerHour = 100000
		for n, tr := range c.API.Tiers { // the test measures the server, not the per-device quota
			tr.RequestsPerMinute = 10_000_000
			c.API.Tiers[n] = tr
		}
	}, nil)

	tr := &http.Transport{MaxIdleConns: 512, MaxIdleConnsPerHost: 512, IdleConnTimeout: 30 * time.Second}
	devs := make([]*hbclient.Client, ndev)
	for i := range devs {
		devs[i] = e.device(t)
		devs[i].HTTP = &http.Client{Transport: tr, Timeout: 10 * time.Second}
	}
	ctx := context.Background()
	if _, err := devs[0].Do(ctx, "GET", "/v1/me", nil, nil, nil); err != nil { // warm-up
		t.Fatal(err)
	}
	tr.CloseIdleConnections()
	time.Sleep(300 * time.Millisecond)
	baseG := runtime.NumGoroutine()

	var (
		mu   sync.Mutex
		lats []time.Duration
		bad  atomic.Int64
		sent atomic.Int64
		wg   sync.WaitGroup
	)
	tick := time.NewTicker(time.Second / rps)
	defer tick.Stop()
	stop := time.After(time.Duration(secs) * time.Second)
	start := time.Now()
	i := 0
loop:
	for {
		select {
		case <-stop:
			break loop
		case <-tick.C:
			c := devs[i%ndev]
			i++
			sent.Add(1)
			wg.Add(1)
			go func() {
				defer wg.Done()
				t0 := time.Now()
				code, err := c.Do(ctx, "GET", "/v1/me", nil, nil, nil)
				d := time.Since(t0)
				if err != nil || code != 200 {
					bad.Add(1)
					return
				}
				mu.Lock()
				lats = append(lats, d)
				mu.Unlock()
			}()
		}
	}
	wg.Wait()
	elapsed := time.Since(start)

	if bad.Load() != 0 {
		t.Errorf("%d of %d requests failed or were not 200", bad.Load(), sent.Load())
	}
	if got := float64(sent.Load()) / elapsed.Seconds(); got < 0.9*rps {
		t.Errorf("generator only reached %.0f rps (machine too slow for the target)", got)
	}
	sort.Slice(lats, func(a, b int) bool { return lats[a] < lats[b] })
	if len(lats) == 0 {
		t.Fatal("no successful requests")
	}
	pct := func(p float64) time.Duration { return lats[int(float64(len(lats)-1)*p)] }
	t.Logf("sent=%d ok=%d rate=%.0f/s p50=%v p95=%v p99=%v max=%v", sent.Load(), len(lats), float64(sent.Load())/elapsed.Seconds(), pct(.5), pct(.95), pct(.99), lats[len(lats)-1])
	if pct(.99) > p99Max {
		t.Errorf("p99 %v exceeds %v", pct(.99), p99Max)
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
