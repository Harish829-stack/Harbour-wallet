package indexer_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	alchemysrc "harbour/backend/adapters/sources/alchemy"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/ingest"
	"harbour/backend/internal/store"
	"harbour/backend/internal/testdb"
)

// fakeAlchemy plays both the Transfers API (gap-fill) and the Notify API.
type fakeAlchemy struct {
	mu        sync.Mutex
	transfers []map[string]any // what the chain really has for A, any order
	calls     []string
	hooks     map[string][]string // webhook id -> addresses
	nextHook  int
}

func (f *fakeAlchemy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	b, _ := io.ReadAll(r.Body)
	switch {
	case strings.HasPrefix(r.URL.Path, "/notify/"):
		if r.Header.Get("X-Alchemy-Token") != "notify-token" {
			w.WriteHeader(401)
			return
		}
		f.calls = append(f.calls, r.Method+" "+strings.TrimPrefix(r.URL.Path, "/notify"))
		var body struct {
			WebhookID string   `json:"webhook_id"`
			Addresses []string `json:"addresses"`
			Add       []string `json:"addresses_to_add"`
			Remove    []string `json:"addresses_to_remove"`
		}
		json.Unmarshal(b, &body)
		switch r.URL.Path {
		case "/notify/create-webhook":
			f.nextHook++
			id := fmt.Sprintf("wh_%d", f.nextHook)
			f.hooks[id] = body.Addresses
			fmt.Fprintf(w, `{"data":{"id":%q,"signing_key":"whsec_%d","webhook_url":"x","is_active":true}}`, id, f.nextHook)
		case "/notify/update-webhook-addresses":
			cur := map[string]bool{}
			for _, a := range f.hooks[body.WebhookID] {
				cur[a] = true
			}
			for _, a := range body.Add {
				cur[a] = true
			}
			for _, a := range body.Remove {
				delete(cur, a)
			}
			f.hooks[body.WebhookID] = nil
			for a := range cur {
				f.hooks[body.WebhookID] = append(f.hooks[body.WebhookID], a)
			}
			io.WriteString(w, `{}`)
		case "/notify/delete-webhook":
			delete(f.hooks, r.URL.Query().Get("webhook_id"))
			io.WriteString(w, `{}`)
		}
		return
	}
	var req struct {
		Method string            `json:"method"`
		Params []json.RawMessage `json:"params"`
	}
	json.Unmarshal(b, &req)
	var p struct {
		FromBlock, ToBlock, FromAddress, ToAddress, Order string
	}
	if len(req.Params) > 0 {
		json.Unmarshal(req.Params[0], &p)
	}
	from, _ := strconv.ParseUint(strings.TrimPrefix(p.FromBlock, "0x"), 16, 64)
	var sel []map[string]any
	for _, t := range f.transfers {
		bn, _ := strconv.ParseUint(strings.TrimPrefix(t["blockNum"].(string), "0x"), 16, 64)
		if bn < from {
			continue
		}
		if (p.ToAddress != "" && t["to"] == p.ToAddress) || (p.FromAddress != "" && t["from"] == p.FromAddress) {
			sel = append(sel, t)
		}
	}
	out, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "result": map[string]any{"transfers": sel, "pageKey": ""}})
	w.Write(out)
}

// apiTransfer is how the Transfers API reports a USDC transfer to A.
func apiTransfer(block uint64, tx string, logIdx int, amount int64) map[string]any {
	return map[string]any{
		"blockNum": "0x" + strconv.FormatUint(block, 16), "uniqueId": fmt.Sprintf("%s:log:%d", tx, logIdx), "hash": tx,
		"from": X, "to": A, "category": "erc20", "asset": "USDC",
		"rawContract": map[string]any{"value": "0x" + strconv.FormatInt(amount, 16), "address": USDC, "decimal": "0x6"},
		"metadata":    map[string]any{"blockTimestamp": time.Now().UTC().Format(time.RFC3339)},
	}
}

// hookActivity is how an Address Activity webhook reports the same transfer.
func hookActivity(block uint64, tx string, logIdx int, amount int64, blockHash string, removed bool) map[string]any {
	return map[string]any{
		"blockNum": "0x" + strconv.FormatUint(block, 16), "hash": tx, "fromAddress": X, "toAddress": A,
		"category": "token", "asset": "USDC",
		"rawContract": map[string]any{"rawValue": "0x" + strconv.FormatInt(amount, 16), "address": USDC, "decimals": 6},
		"log": map[string]any{"address": USDC, "blockNumber": "0x" + strconv.FormatUint(block, 16), "blockHash": blockHash,
			"logIndex": "0x" + strconv.FormatInt(int64(logIdx), 16), "removed": removed},
	}
}

func deliveryBody(hookID, id string, acts ...map[string]any) []byte {
	b, _ := json.Marshal(map[string]any{"webhookId": hookID, "id": id, "createdAt": time.Now().UTC().Format(time.RFC3339Nano),
		"type": "ADDRESS_ACTIVITY", "event": map[string]any{"network": "BASE_MAINNET", "activity": acts}})
	return b
}

func post(t *testing.T, url, key string, body []byte) int {
	t.Helper()
	m := hmac.New(sha256.New, []byte(key))
	m.Write(body)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("X-Alchemy-Signature", hex.EncodeToString(m.Sum(nil)))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	return resp.StatusCode
}

func waitUntil(t *testing.T, what string, f func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !f() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(25 * time.Millisecond)
	}
}

// Phase 4 exit test: replaying every webhook twice changes nothing, and
// stopping ingest for 30 minutes loses nothing once it restarts. Also covers
// webhook management, reorgs (webhook and repair) and finality.
func TestLivePath(t *testing.T) {
	pgURL := testdb.URL(t, "indexer_live")
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	st, err := store.Open(ctx, pgURL)
	must(t, err)
	defer st.Close()
	_, err = st.Migrate(ctx)
	must(t, err)
	must(t, st.UpsertChains(ctx, map[string]string{"base": "evm"}))
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	bus, err := events.Connect(ctx, startNATS(t), "test", log)
	must(t, err)
	defer bus.Close()

	fa := &fakeAlchemy{hooks: map[string][]string{}}
	alch := httptest.NewServer(fa)
	defer alch.Close()
	srcI, err := alchemysrc.New(index.SourceConfig{Name: "alchemy",
		Options: map[string]string{"base_url": alch.URL + "/{network}", "notify_base_url": alch.URL + "/notify"},
		Chains:  map[string]map[string]string{"base": {"network": "base-mainnet", "webhook_network": "BASE_MAINNET", "categories": "external,erc20"}},
		Getenv: func(k string) string {
			return map[string]string{"ALCHEMY_API_KEY": "k", "ALCHEMY_NOTIFY_TOKEN": "notify-token"}[k]
		}})
	must(t, err)
	src := srcI.(*alchemysrc.Source)

	fc := &fakeChain{block: 1000, bal: map[string]string{A + "|" + USDC: "0", A + "|native": "0"},
		hashes: map[uint64]string{}, inclusion: map[string]chain.Inclusion{}}
	box, _ := store.NewSecretBox([]byte(strings.Repeat("s", 32)), "webhook-signing-keys")
	c := &indexer.Chain{Name: "base", Family: "evm", Native: config.Native{Symbol: "ETH", Decimals: 18}, Client: fc,
		Finality: finality950{}, Source: src, SourceName: "alchemy", Holdings: nil, Webhooks: src, BlockTime: 2 * time.Second}
	cfg := config.Indexer{BackfillMaxTransfers: 5000, OlderPageTransfers: 100, RefreshDebounce: 30 * time.Millisecond,
		IdleSweepAfter: time.Hour, NFTMaxPages: 1, Workers: 1}
	ix := indexer.New(st, cfg, bus, map[string]*indexer.Chain{"base": c}, log)
	ix.EnableLive(indexer.LiveOptions{PublicURL: "https://tunnel-one.example", Box: box,
		GapFillEvery: time.Hour, RepairEvery: time.Hour, ManageEvery: time.Hour})

	// A device tracks A; its backfill finds nothing yet.
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, _ := st.CreateDevice(ctx, []byte(strings.Repeat("9", 32)), "default", nil)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	ran, err := ix.RunOneBackfill(ctx)
	must(t, err)
	if !ran {
		t.Fatal("no backfill")
	}
	idA, _ := st.TrackedID(ctx, "base", A)

	runCtx, stopRun := context.WithCancel(ctx)
	runDone := make(chan struct{})
	go func() { ix.Run(runCtx); close(runDone) }()
	defer func() { stopRun(); <-runDone }()

	// 1. Webhook management: A is subscribed through a new webhook.
	must(t, ix.ManageWebhooks(ctx, c))
	fa.mu.Lock()
	if len(fa.hooks["wh_1"]) != 1 || fa.hooks["wh_1"][0] != A {
		t.Fatalf("webhook not created with A: %v", fa.hooks)
	}
	fa.mu.Unlock()
	var whid *string
	must(t, st.Pool.QueryRow(ctx, `SELECT webhook_id FROM tracked_addresses WHERE id=$1`, idA).Scan(&whid))
	if whid == nil || *whid != "wh_1" {
		t.Fatalf("tracked row not linked to webhook: %v", whid)
	}

	// 2. webhook-ingest in front.
	in := ingest.New(ingest.Options{Store: st, Bus: bus, Log: log, Box: box, Sources: map[string]index.Webhooks{"alchemy": src},
		KeyCacheTTL: 50 * time.Millisecond})
	must(t, in.Start(ctx)) // first start: no gap-fill
	recv := httptest.NewServer(in.Handler())
	defer recv.Close()
	hookURL := recv.URL + "/webhooks/alchemy"

	count := func(q string) int {
		var n int
		must(t, st.Pool.QueryRow(ctx, q).Scan(&n))
		return n
	}
	d1 := deliveryBody("wh_1", "whevt_1", hookActivity(1001, "0xd1", 1, 10_000_000, "0xh1001", false), hookActivity(1001, "0xd1", 2, 5_000_000, "0xh1001", false))
	d2 := deliveryBody("wh_1", "whevt_2", hookActivity(1002, "0xd2", 7, 1_000_000, "0xh1002", false))
	if code := post(t, hookURL, "wrong", d1); code != 401 {
		t.Fatalf("bad signature got %d", code)
	}
	fc.mu.Lock()
	fc.bal[A+"|"+USDC] = "16000000"
	fc.block = 1003
	fc.mu.Unlock()
	for _, b := range [][]byte{d1, d1, d2} {
		if code := post(t, hookURL, "whsec_1", b); code != 200 {
			t.Fatalf("delivery got %d", code)
		}
	}
	waitUntil(t, "3 live transfers", func() bool { return count(`SELECT count(*) FROM transfers`) == 3 })
	waitUntil(t, "balance refresh", func() bool { return balances(t, st, idA)[USDC] == "16000000" })

	// 3. Exit test 1: replay every delivery twice more; nothing changes.
	snapshot := func() string {
		var s string
		must(t, st.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM transfers)::text || '/' || (SELECT count(*) FROM event_keys)::text
			|| '/' || (SELECT count(*) FROM transactions)::text || '/' || (SELECT sum(jsonb_array_length(summary->'transfers')) FROM address_activity)::text`).Scan(&s))
		return s
	}
	before := snapshot()
	for i := 0; i < 2; i++ {
		for _, b := range [][]byte{d1, d2} {
			if code := post(t, hookURL, "whsec_1", b); code != 200 {
				t.Fatalf("replay got %d", code)
			}
		}
	}
	time.Sleep(500 * time.Millisecond) // let the consumer drain
	if after := snapshot(); after != before {
		t.Fatalf("replaying webhooks changed facts: %s -> %s", before, after)
	}
	if count(`SELECT count(*) FROM webhook_deliveries`) != 2 {
		t.Fatal("raw deliveries not stored once each")
	}

	// 4. Exit test 2: ingest is down for 30 minutes; the chain keeps moving.
	// Transfers at 1100 and 1200 are never delivered by webhook.
	fa.mu.Lock()
	fa.transfers = append(fa.transfers, apiTransfer(1001, "0xd1", 1, 10_000_000), apiTransfer(1001, "0xd1", 2, 5_000_000),
		apiTransfer(1002, "0xd2", 7, 1_000_000), apiTransfer(1100, "0xmissed1", 3, 2_000_000), apiTransfer(1200, "0xmissed2", 4, 3_000_000))
	fa.mu.Unlock()
	fc.mu.Lock()
	fc.block = 1300
	fc.bal[A+"|"+USDC] = "21000000"
	fc.mu.Unlock()
	_, err = st.Heartbeat(ctx, ingest.Service, time.Now().Add(-30*time.Minute))
	must(t, err)
	// Restart: the stale heartbeat makes ingest ask for a full gap-fill.
	in2 := ingest.New(ingest.Options{Store: st, Bus: bus, Log: log, Box: box, Sources: map[string]index.Webhooks{"alchemy": src}})
	must(t, in2.Start(ctx))
	waitUntil(t, "missed transfers recovered", func() bool { return count(`SELECT count(*) FROM transfers`) == 5 })
	waitUntil(t, "balance after gap-fill", func() bool { return balances(t, st, idA)[USDC] == "21000000" })
	var lastSeen int64
	must(t, st.Pool.QueryRow(ctx, `SELECT last_seen_block FROM tracked_addresses WHERE id=$1`, idA).Scan(&lastSeen))
	if lastSeen != 1300-60 { // head minus a 2-minute safety margin at 2 s blocks
		t.Fatalf("last_seen_block %d", lastSeen)
	}

	// 5. Reorg via webhook: removed=true deletes the event and refreshes.
	fc.mu.Lock()
	fc.bal[A+"|"+USDC] = "20000000"
	fc.block = 1301
	fc.mu.Unlock()
	if code := post(t, hookURL, "whsec_1", deliveryBody("wh_1", "whevt_3", hookActivity(1002, "0xd2", 7, 1_000_000, "0xh1002", true))); code != 200 {
		t.Fatal("removed delivery rejected")
	}
	waitUntil(t, "reorged event removed", func() bool { return count(`SELECT count(*) FROM transfers WHERE tx_hash='0xd2'`) == 0 })
	waitUntil(t, "balance after reorg", func() bool { return balances(t, st, idA)[USDC] == "20000000" })
	if count(`SELECT count(*) FROM address_activity WHERE tx_hash='0xd2'`) != 0 || count(`SELECT count(*) FROM transactions WHERE tx_hash='0xd2'`) != 0 {
		t.Fatal("reorged tx left activity or transaction rows")
	}

	// 6. Repair: 0xmissed1 (block 1100, no hash from the Transfers API) is
	// still mined -> hash filled; 0xd1 at 1001 has a hash that is no longer
	// canonical and no receipt -> removed. Rows <= 950 would be finalized.
	fc.mu.Lock()
	fc.hashes[1001] = "0xnew1001"
	fc.inclusion["0xmissed1"] = chain.Inclusion{Found: true, BlockNumber: 1100, BlockHash: "0xh1100", Success: true}
	fc.inclusion["0xmissed2"] = chain.Inclusion{Found: true, BlockNumber: 1201, BlockHash: "0xh1201", Success: true} // re-mined one block later
	fc.mu.Unlock()
	must(t, ix.Repair(ctx, c))
	if count(`SELECT count(*) FROM transfers WHERE tx_hash='0xd1'`) != 0 {
		t.Fatal("reorged-out tx not removed by repair")
	}
	var h string
	var bn int64
	must(t, st.Pool.QueryRow(ctx, `SELECT block_hash FROM transfers WHERE tx_hash='0xmissed1'`).Scan(&h))
	must(t, st.Pool.QueryRow(ctx, `SELECT block_number FROM transfers WHERE tx_hash='0xmissed2'`).Scan(&bn))
	if h != "0xh1100" || bn != 1201 {
		t.Fatalf("repair did not update positions: hash=%q block=%d", h, bn)
	}
	// The removed tx is accepted again if the chain re-includes it.
	if code := post(t, hookURL, "whsec_1", deliveryBody("wh_1", "whevt_4", hookActivity(1305, "0xd1", 1, 10_000_000, "0xh1305", false))); code != 200 {
		t.Fatal("re-include rejected")
	}
	waitUntil(t, "re-included event stored", func() bool { return count(`SELECT count(*) FROM transfers WHERE tx_hash='0xd1'`) == 1 })

	// 7. Public URL changes (new dev tunnel): webhook replaced, A moved over.
	ix.EnableLive(indexer.LiveOptions{PublicURL: "https://tunnel-two.example", Box: box,
		GapFillEvery: time.Hour, RepairEvery: time.Hour, ManageEvery: time.Hour})
	must(t, ix.ManageWebhooks(ctx, c))
	fa.mu.Lock()
	_, oldAlive := fa.hooks["wh_1"]
	newAddrs := fa.hooks["wh_2"]
	fa.mu.Unlock()
	if oldAlive || len(newAddrs) != 1 || newAddrs[0] != A {
		t.Fatalf("url change: old alive=%v new=%v", oldAlive, newAddrs)
	}
	if code := post(t, hookURL, "whsec_2", deliveryBody("wh_2", "whevt_5", hookActivity(1306, "0xnewhook", 1, 1, "0xh1306", false))); code != 200 {
		t.Fatal("delivery from the new webhook rejected")
	}
	time.Sleep(60 * time.Millisecond) // key cache expiry
	if code := post(t, hookURL, "whsec_1", deliveryBody("wh_1", "whevt_6", hookActivity(1307, "0xoldhook", 1, 1, "0xh1307", false))); code != 401 {
		t.Fatal("delivery from the deleted webhook accepted")
	}

	// 8. No device tracks A any more: it is unsubscribed.
	_, err = st.RemoveDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}})
	must(t, err)
	must(t, ix.ManageWebhooks(ctx, c))
	fa.mu.Lock()
	left := len(fa.hooks["wh_2"])
	fa.mu.Unlock()
	if left != 0 {
		t.Fatal("untracked address still on the webhook")
	}
}

type finality950 struct{}

func (finality950) FinalizedBlock(context.Context) (uint64, error) { return 950, nil }
func (finality950) Classify(b, latest, fin uint64) chain.Finality {
	if b <= fin {
		return chain.Finalized
	}
	return chain.Confirmed
}
