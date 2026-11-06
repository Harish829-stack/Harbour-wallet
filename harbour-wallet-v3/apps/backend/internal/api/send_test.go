package api_test

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/redis/go-redis/v9"

	"harbour/backend/adapters/notify/webpush"
	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/events"
	"harbour/backend/internal/evmtx"
	"harbour/backend/internal/evmtx/devsign"
	"harbour/backend/internal/hbclient"
	"harbour/backend/internal/notifier"
	"harbour/backend/internal/realtime"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
	"harbour/backend/internal/txtrack"
)

// fakeChain mines every transaction it is asked about on the second check.
type fakeChain struct {
	chain.Client
	mu   sync.Mutex
	seen map[string]int
}

func (f *fakeChain) Inclusion(_ context.Context, h string) (chain.Inclusion, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seen[h]++
	if f.seen[h] < 2 {
		return chain.Inclusion{}, nil
	}
	return chain.Inclusion{Found: true, BlockNumber: 100, Success: true}, nil
}

// Phase 6 exit test: a transaction sent through Harbour goes pending ->
// confirmed and the device sees both on its realtime channel plus a push;
// an incoming transfer pushes to the receiving device.
func TestSendRealtimePush(t *testing.T) {
	rURL := os.Getenv("HB_TEST_REDIS_URL")
	if rURL == "" || os.Getenv("HB_TEST_POSTGRES_URL") == "" {
		t.Skip("integration env not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	st, err := store.Open(ctx, testdb.URL(t, "api_send"))
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	ropt, _ := redis.ParseURL(rURL)
	ropt.DB = 13
	rdb := redis.NewClient(ropt)
	must(t, rdb.FlushDB(ctx).Err())
	cfg, err := config.Load("../../config")
	must(t, err)
	fams := map[string]string{}
	for n, c := range cfg.Chains {
		fams[n] = c.Family
	}
	must(t, st.UpsertChains(ctx, fams))
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))

	ns, err := natsserver.NewServer(&natsserver.Options{Port: -1, JetStream: true, StoreDir: t.TempDir(), NoLog: true, NoSigs: true})
	must(t, err)
	go ns.Start()
	if !ns.ReadyForConnections(5 * time.Second) {
		t.Fatal("nats not ready")
	}
	defer ns.Shutdown()
	bus, err := events.Connect(ctx, ns.ClientURL(), "test", log)
	must(t, err)
	defer bus.Close()

	// Gateway: answers the send path's calls.
	var sent []string
	var gmu sync.Mutex
	gw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		res := map[string]string{"eth_getTransactionCount": `"0x7"`, "eth_estimateGas": `"0x5208"`, "eth_maxPriorityFeePerGas": `"0x3b9aca00"`,
			"eth_getBlockByNumber": `{"baseFeePerGas":"0x2"}`, "eth_call": `"0x"`}[req.Method]
		if req.Method == "eth_sendRawTransaction" {
			var raw string
			json.Unmarshal(req.Params[0], &rawHex{&raw})
			gmu.Lock()
			sent = append(sent, raw)
			gmu.Unlock()
			b, _ := hex.DecodeString(strings.TrimPrefix(raw, "0x"))
			h := devsignHash(b)
			res = `"` + h + `"`
		}
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":`+res+`}`)
	}))
	defer gw.Close()

	// Centrifugo: records server-API publishes.
	var cmu sync.Mutex
	published := map[string][]string{}
	cent := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/publish" || r.Header.Get("X-API-Key") != "centkey" {
			w.WriteHeader(401)
			return
		}
		var p struct {
			Channel string          `json:"channel"`
			Data    json.RawMessage `json:"data"`
		}
		json.NewDecoder(r.Body).Decode(&p)
		cmu.Lock()
		published[p.Channel] = append(published[p.Channel], string(p.Data))
		cmu.Unlock()
		io.WriteString(w, `{"result":{}}`)
	}))
	defer cent.Close()

	// Push service: decrypts with the browser's key.
	ua, _ := ecdh.P256().GenerateKey(rand.Reader)
	auth := make([]byte, 16)
	rand.Read(auth)
	var pmu sync.Mutex
	var pushes []string
	pushSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		pt, err := webpush.Decrypt(ua, auth, b)
		if err != nil || !strings.HasPrefix(r.Header.Get("Authorization"), "vapid t=") {
			w.WriteHeader(400)
			return
		}
		pmu.Lock()
		pushes = append(pushes, string(pt))
		pmu.Unlock()
		w.WriteHeader(201)
	}))
	defer pushSrv.Close()

	vapidPriv, vapidPub, _ := webpush.GenerateKeys()
	srv := api.New(api.Options{Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc, Events: bus, Log: log, GatewayURL: gw.URL, AnyPushHost: true,
		PowDifficulty: 4, RealtimeSecret: []byte("rtsecret"), RealtimeURL: "ws://test/connection/websocket", VAPIDPublicKey: vapidPub})
	hs := httptest.NewServer(srv.Handler())
	defer hs.Close()
	c := hbclient.New(hs.URL)
	_, err = c.Register(ctx)
	must(t, err)

	key, _ := devsign.ParseKey("0x" + strings.Repeat("ab", 32))
	from := devsign.Address(key)
	const to = "0x3535353535353535353535353535353535353535"
	const chainName = "base-sepolia"
	_, err = c.Do(ctx, "PUT", "/v1/me/addresses", map[string]any{"add": []map[string]string{{"chain": chainName, "address": from}}}, nil, nil)
	must(t, err)

	// Push subscription (http endpoint is test-only).
	var vk map[string]string
	_, err = c.Do(ctx, "GET", "/v1/push/vapid", nil, &vk, nil)
	if err != nil || vk["public_key"] != vapidPub {
		t.Fatalf("vapid %v %v", vk, err)
	}
	b64 := base64.RawURLEncoding.EncodeToString
	sub := map[string]any{"endpoint": strings.Replace(pushSrv.URL, "http://", "https://", 1) + "/x", "keys": map[string]string{
		"p256dh": b64(ua.PublicKey().Bytes()), "auth": b64(auth)}}
	_, err = c.Do(ctx, "PUT", "/v1/me/push", sub, nil, nil)
	must(t, err)
	// The API only accepts https endpoints; point the stored one at the plain test server.
	_, err = st.Pool.Exec(ctx, `UPDATE push_subscriptions SET endpoint=$1`, pushSrv.URL+"/x")
	must(t, err)

	// Estimate and basic simulation.
	var est map[string]any
	_, err = c.Do(ctx, "POST", "/v1/tx/"+chainName+"/estimate", map[string]string{"from": from, "to": to, "value": "1000"}, &est, nil)
	must(t, err)
	if est["nonce"] != "7" || est["gas_limit"] != "21000" || est["chain_id"].(float64) != 84532 {
		t.Fatalf("estimate %v", est)
	}
	var sim map[string]any
	_, err = c.Do(ctx, "POST", "/v1/tx/"+chainName+"/simulate", map[string]string{"from": from, "to": to, "value": "1000"}, &sim, nil)
	if err != nil || sim["mode"] != "basic" || sim["success"] != true {
		t.Fatalf("simulate %v %v", sim, err)
	}
	// Untracked sender is refused.
	if code, _ := c.Do(ctx, "POST", "/v1/tx/"+chainName+"/estimate", map[string]string{"from": to, "to": to}, nil, nil); code != 403 {
		t.Fatalf("untracked estimate: %d", code)
	}

	sign := func(chainID uint64, k string) string {
		kk, _ := devsign.ParseKey(k)
		raw, err := devsign.Sign(kk, devsign.Tx{ChainID: chainID, Nonce: 7, TipCap: big.NewInt(1e9), FeeCap: big.NewInt(2e9), Gas: 21000,
			To: to, Value: big.NewInt(1000)})
		must(t, err)
		return "0x" + hex.EncodeToString(raw)
	}
	if code, _ := c.Do(ctx, "POST", "/v1/tx/"+chainName+"/broadcast", map[string]string{"raw": sign(8453, "0x"+strings.Repeat("ab", 32))}, nil, nil); code != 400 {
		t.Fatalf("wrong chain: %d", code)
	}
	if code, _ := c.Do(ctx, "POST", "/v1/tx/"+chainName+"/broadcast", map[string]string{"raw": sign(84532, "0x"+strings.Repeat("cd", 32))}, nil, nil); code != 403 {
		t.Fatalf("untracked sender: %d", code)
	}
	rawTx := sign(84532, "0x"+strings.Repeat("ab", 32))
	hdr := http.Header{"Idempotency-Key": {"k1"}}
	var bc, bc2 map[string]any
	_, err = c.Do(ctx, "POST", "/v1/tx/"+chainName+"/broadcast", map[string]string{"raw": rawTx}, &bc, hdr)
	must(t, err)
	_, err = c.Do(ctx, "POST", "/v1/tx/"+chainName+"/broadcast", map[string]string{"raw": rawTx}, &bc2, hdr)
	must(t, err)
	hash, _ := bc["tx_hash"].(string)
	if bc["status"] != "pending" || hash == "" || bc2["tx_hash"] != hash || len(sent) != 1 {
		t.Fatalf("broadcast %v / %v sent=%d", bc, bc2, len(sent))
	}

	// Realtime tokens cover the balance channel and the pending tx.
	var rt struct {
		Subscriptions []struct{ Channel string } `json:"subscriptions"`
	}
	_, err = c.Do(ctx, "POST", "/v1/realtime/token", map[string]string{}, &rt, nil)
	must(t, err)
	chans := map[string]bool{}
	for _, s := range rt.Subscriptions {
		chans[s.Channel] = true
	}
	txChan := realtime.TxChannel(chainName, hash)
	if !chans[realtime.BalanceChannel(chainName, from)] || !chans[txChan] {
		t.Fatalf("channels %v", chans)
	}

	// Run the tracker, bridge and notifier.
	wp, err := webpush.New(map[string]string{"private_key": vapidPriv, "allow_private": "true"})
	must(t, err)
	tracker := &txtrack.Tracker{St: st, Bus: bus, Log: log, Every: 100 * time.Millisecond,
		Chains: map[string]txtrack.Chain{chainName: {Client: &fakeChain{seen: map[string]int{}}, BlockTime: 50 * time.Millisecond}}}
	go tracker.Run(ctx)
	go (&realtime.Bridge{Bus: bus, APIURL: cent.URL, APIKey: "centkey", Log: log}).Run(ctx)
	go (&notifier.Notifier{St: st, LC: lc, Redis: rdb, Bus: bus, Channels: map[string]notify.Channel{"webpush": wp}, Log: log}).Run(ctx)

	waitFor(t, ctx, func() bool {
		cmu.Lock()
		defer cmu.Unlock()
		msgs := strings.Join(published[txChan], "\n")
		return strings.Contains(msgs, `"status":"pending"`) && strings.Contains(msgs, `"status":"confirmed"`)
	}, "tx channel pending -> confirmed")
	waitFor(t, ctx, func() bool {
		pmu.Lock()
		defer pmu.Unlock()
		return len(pushes) == 1 && strings.Contains(pushes[0], "Transaction confirmed")
	}, "confirmation push")
	if p, _ := st.Pending(ctx, chainName, hash); p.State != "confirmed" {
		t.Fatalf("pending row %+v", p)
	}

	// Incoming transfer to the tracked address -> one push (deduped on redelivery).
	id, _ := st.TrackedID(ctx, chainName, from)
	ev, _ := json.Marshal(map[string]any{"tracked_address_id": id, "chain": chainName, "tx_hash": "0x" + strings.Repeat("e", 64),
		"kind": "native", "amount_raw": "1500000000000000", "symbol": "ETH", "decimals": 18, "block_time": time.Now()})
	must(t, bus.Publish(ctx, events.SubjectActivityNew+"."+chainName, ev))
	must(t, bus.Publish(ctx, events.SubjectActivityNew+"."+chainName, ev))
	waitFor(t, ctx, func() bool {
		pmu.Lock()
		defer pmu.Unlock()
		return len(pushes) == 2 && strings.Contains(pushes[1], "Received 0.0015 ETH")
	}, "incoming push")
	time.Sleep(300 * time.Millisecond)
	pmu.Lock()
	n := len(pushes)
	pmu.Unlock()
	if n != 2 {
		t.Fatalf("duplicate pushes: %d", n)
	}
	// Balance events reach the balance channel.
	bal, _ := json.Marshal(map[string]any{"tracked_address_id": id, "chain": chainName, "address": from, "as_of_block": 101,
		"balances": []map[string]string{{"asset_ref": "native", "amount_raw": "5"}}})
	must(t, bus.Publish(ctx, events.SubjectBalance+"."+chainName, bal))
	waitFor(t, ctx, func() bool {
		cmu.Lock()
		defer cmu.Unlock()
		return len(published[realtime.BalanceChannel(chainName, from)]) == 1
	}, "balance relay")
}

type rawHex struct{ s *string }

func (r *rawHex) UnmarshalJSON(b []byte) error { return json.Unmarshal(b, r.s) }

func devsignHash(raw []byte) string {
	return "0x" + hex.EncodeToString(keccak(raw))
}

func waitFor(t *testing.T, ctx context.Context, f func() bool, what string) {
	t.Helper()
	for !f() {
		select {
		case <-ctx.Done():
			t.Fatalf("timed out waiting for %s", what)
		case <-time.After(50 * time.Millisecond):
		}
	}
}

func keccak(b []byte) []byte { return evmtx.Keccak(b) }
