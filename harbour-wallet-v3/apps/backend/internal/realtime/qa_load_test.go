package realtime

// QA load test (TEST_PLAN T-RT-005): the bridge relays 50 balance events/s and 50 tx events/s for 10 s to a fake Centrifugo.
// Each stream is driven serially, as a NATS consumer would. Checks: nothing is lost, handler p99 stays bounded, heap and goroutines
// do not grow. Opt-in: HB_QA_PERF=1 (HB_QA_PERF_SECS shortens the 10 s default). Run without -race.

import (
	"context"
	"encoding/json"
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

func TestQARealtimeBridgeSteadyLoad(t *testing.T) {
	if os.Getenv("HB_QA_PERF") == "" {
		t.Skip("set HB_QA_PERF=1 to run the load test")
	}
	secs := 10
	if v, err := strconv.Atoi(os.Getenv("HB_QA_PERF_SECS")); err == nil && v > 0 {
		secs = v
	}
	const rate = 50

	var pubs, badKey, badBody atomic.Int64
	cf := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if r.URL.Path != "/api/publish" || r.Header.Get("X-API-Key") != "k" {
			badKey.Add(1)
		}
		var m struct {
			Channel string
			Data    map[string]any
		}
		if json.Unmarshal(b, &m) != nil || (!strings.HasPrefix(m.Channel, "balances:") && !strings.HasPrefix(m.Channel, "tx:")) || m.Data["type"] == nil {
			badBody.Add(1)
		}
		pubs.Add(1)
		io.WriteString(w, `{"result":{}}`)
	}))
	defer cf.Close()
	b := &Bridge{APIURL: cf.URL + "/api", APIKey: "k"}

	runtime.GC()
	var m0 runtime.MemStats
	runtime.ReadMemStats(&m0)
	g0 := runtime.NumGoroutine()

	var (
		mu   sync.Mutex
		lats []time.Duration
		errs atomic.Int64
		wg   sync.WaitGroup
	)
	stream := func(name string, mk func(i int) []byte, h func(context.Context, []byte) error) {
		defer wg.Done()
		tick := time.NewTicker(time.Second / rate)
		defer tick.Stop()
		end := time.Now().Add(time.Duration(secs) * time.Second)
		for i := 0; time.Now().Before(end); i++ {
			<-tick.C
			t0 := time.Now()
			if err := h(context.Background(), mk(i)); err != nil {
				errs.Add(1)
				continue
			}
			d := time.Since(t0)
			mu.Lock()
			lats = append(lats, d)
			mu.Unlock()
		}
	}
	wg.Add(2)
	go stream("balance", func(i int) []byte {
		return []byte(fmt.Sprintf(`{"chain":"base","address":"0x%040X","as_of_block":%d,"balances":[{"token":"native","amount":"%d"}]}`, i%500, i, i))
	}, b.HandleBalance)
	go stream("tx", func(i int) []byte {
		return []byte(fmt.Sprintf(`{"chain":"base","tx_hash":"0x%064X","status":"confirmed","block_number":%d}`, i, i))
	}, b.HandleTx)
	wg.Wait()

	if errs.Load() != 0 {
		t.Errorf("%d handler errors", errs.Load())
	}
	if int(pubs.Load()) != len(lats) {
		t.Errorf("published %d, handled %d: events lost or duplicated", pubs.Load(), len(lats))
	}
	if want := int(float64(2*rate*secs) * 0.9); len(lats) < want {
		t.Errorf("only %d events relayed, want about %d", len(lats), 2*rate*secs)
	}
	if badKey.Load() != 0 || badBody.Load() != 0 {
		t.Errorf("fake Centrifugo saw %d bad requests and %d bad bodies", badKey.Load(), badBody.Load())
	}
	sort.Slice(lats, func(i, j int) bool { return lats[i] < lats[j] })
	p99 := lats[int(float64(len(lats)-1)*.99)]
	t.Logf("events=%d p50=%v p99=%v max=%v", len(lats), lats[len(lats)/2], p99, lats[len(lats)-1])
	if p99 > 100*time.Millisecond {
		t.Errorf("p99 %v exceeds 100ms", p99)
	}

	http.DefaultClient.CloseIdleConnections()
	time.Sleep(500 * time.Millisecond)
	runtime.GC()
	var m1 runtime.MemStats
	runtime.ReadMemStats(&m1)
	if grow := int64(m1.HeapAlloc) - int64(m0.HeapAlloc); grow > 20<<20 {
		t.Errorf("heap grew %d MiB over %d events", grow>>20, len(lats))
	}
	if g := runtime.NumGoroutine(); g > g0+15 {
		t.Errorf("goroutines %d, baseline %d", g, g0)
	}
}
