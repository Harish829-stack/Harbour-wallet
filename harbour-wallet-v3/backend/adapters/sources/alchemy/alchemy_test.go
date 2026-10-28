package alchemy

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"harbour/backend/contracttest"
	"harbour/backend/internal/core/index"
)

const me = "0x1111111111111111111111111111111111111111"
const other = "0x2222222222222222222222222222222222222222"
const usdc = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"

// fakeAlchemy serves Transfers API pages shaped like Alchemy's responses.
type fakeAlchemy struct {
	in, out        []map[string]any // newest first
	rejectInternal bool
	calls          atomic.Int64
	lastCats       atomic.Value
}

func tr(block int, hash, cat, from, to string, extra map[string]any) map[string]any {
	ts := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(block) * time.Minute)
	t := map[string]any{
		"blockNum": "0x" + strconv.FormatInt(int64(block), 16), "hash": hash, "from": from, "to": to,
		"category": cat, "asset": "ETH", "value": 1.5,
		"rawContract": map[string]any{"value": "0xde0b6b3a7640000", "address": nil, "decimal": "0x12"},
		"metadata":    map[string]any{"blockTimestamp": ts.Format(time.RFC3339)},
	}
	switch cat {
	case "external":
		t["uniqueId"] = hash + ":external"
	case "internal":
		t["uniqueId"] = hash + ":internal:0"
	default:
		t["uniqueId"] = hash + ":log:0x" + strconv.FormatInt(int64(block%7), 16)
	}
	for k, v := range extra {
		t[k] = v
	}
	return t
}

func (f *fakeAlchemy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.calls.Add(1)
	if strings.Contains(r.URL.Path, "/nft/v3/") {
		if r.URL.Query().Get("pageKey") == "" {
			io.WriteString(w, `{"ownedNfts":[{"contract":{"address":"0xAbC0000000000000000000000000000000000001","name":"Cats","symbol":"CAT","tokenType":"ERC721","isSpam":false},"tokenId":"42","tokenType":"ERC721","name":"Cat #42","balance":"1","image":{"cachedUrl":"https://nft-cdn/42.png"}}],"pageKey":"p2","validAt":{"blockNumber":500}}`)
		} else {
			io.WriteString(w, `{"ownedNfts":[{"contract":{"address":"0xabc0000000000000000000000000000000000002","tokenType":"ERC1155","isSpam":true},"tokenId":"0x0a","balance":"3","image":{}}],"pageKey":null,"validAt":{"blockNumber":500}}`)
		}
		return
	}
	var req struct {
		Method string            `json:"method"`
		Params []json.RawMessage `json:"params"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Method == "eth_getBlockByNumber" {
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":{"number":"0x64","timestamp":"0x6720e8c0"}}`)
		return
	}
	if req.Method == "alchemy_getTokenBalances" {
		io.WriteString(w, `{"jsonrpc":"2.0","id":1,"result":{"address":"`+me+`","tokenBalances":[{"contractAddress":"`+strings.ToUpper(usdc[:2])+usdc[2:]+`","tokenBalance":"0x0000000000000000000000000000000000000000000000000000000002faf080"},{"contractAddress":"0x9999999999999999999999999999999999999999","tokenBalance":"0x0000000000000000000000000000000000000000000000000000000000000000"}]}}`)
		return
	}
	var p struct {
		FromBlock   string   `json:"fromBlock"`
		ToBlock     string   `json:"toBlock"`
		FromAddress string   `json:"fromAddress"`
		ToAddress   string   `json:"toAddress"`
		Order       string   `json:"order"`
		MaxCount    string   `json:"maxCount"`
		PageKey     string   `json:"pageKey"`
		Category    []string `json:"category"`
	}
	json.Unmarshal(req.Params[0], &p)
	f.lastCats.Store(p.Category)
	if f.rejectInternal {
		for _, c := range p.Category {
			if c == "internal" {
				io.WriteString(w, `{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"internal category is not supported on this network"}}`)
				return
			}
		}
	}
	src := f.in
	if p.FromAddress != "" {
		src = f.out
	}
	var sel []map[string]any
	from, _ := strconv.ParseUint(strings.TrimPrefix(p.FromBlock, "0x"), 16, 64)
	to := uint64(1 << 62)
	if p.ToBlock != "latest" {
		to, _ = strconv.ParseUint(strings.TrimPrefix(p.ToBlock, "0x"), 16, 64)
	}
	for _, t := range src {
		b, _ := strconv.ParseUint(strings.TrimPrefix(t["blockNum"].(string), "0x"), 16, 64)
		if b >= from && b <= to {
			sel = append(sel, t)
		}
	}
	if p.Order == "asc" {
		for i, j := 0, len(sel)-1; i < j; i, j = i+1, j-1 {
			sel[i], sel[j] = sel[j], sel[i]
		}
	}
	start, _ := strconv.Atoi(p.PageKey)
	max, _ := strconv.ParseInt(strings.TrimPrefix(p.MaxCount, "0x"), 16, 64)
	if max > 3 {
		max = 3 // small pages to exercise paging
	}
	end := start + int(max)
	key := strconv.Itoa(end)
	if end >= len(sel) {
		end, key = len(sel), ""
	}
	if start > len(sel) {
		start = len(sel)
	}
	b, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "result": map[string]any{"transfers": sel[start:end], "pageKey": key}})
	w.Write(b)
}

func newFake() *fakeAlchemy {
	f := &fakeAlchemy{}
	for i := 20; i >= 1; i-- {
		f.in = append(f.in, tr(100+i*2, fmt.Sprintf("0x%064x", i), "erc20", other, me,
			map[string]any{"asset": "USDC", "rawContract": map[string]any{"value": "0x2faf080", "address": usdc, "decimal": "0x6"}}))
		f.out = append(f.out, tr(101+i*2, fmt.Sprintf("0x%064x", 1000+i), "external", me, other, nil))
	}
	// A self-transfer appears in both directions; it must be returned once.
	self := tr(200, fmt.Sprintf("0x%064x", 9999), "external", me, me, nil)
	f.in = append([]map[string]any{self}, f.in...)
	f.out = append([]map[string]any{self}, f.out...)
	// ERC-1155 batch and an internal transfer.
	f.in = append([]map[string]any{tr(199, fmt.Sprintf("0x%064x", 7777), "erc1155", other, me, map[string]any{
		"rawContract":     map[string]any{"value": nil, "address": "0xabc0000000000000000000000000000000000002", "decimal": nil},
		"erc1155Metadata": []map[string]string{{"tokenId": "0x1", "value": "0x2"}, {"tokenId": "0x2", "value": "0x5"}},
	})}, f.in...)
	f.in = append([]map[string]any{tr(198, fmt.Sprintf("0x%064x", 8888), "internal", other, me, nil)}, f.in...)
	return f
}

func newSource(t *testing.T, f *fakeAlchemy) (*Source, *httptest.Server) {
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	s, err := New(index.SourceConfig{Name: "alchemy",
		Options: map[string]string{"key_env": "K", "base_url": srv.URL + "/{network}"},
		Chains:  map[string]map[string]string{"base": {"network": "base-mainnet", "categories": "external,internal,erc20,erc721,erc1155"}},
		Getenv:  func(string) string { return "secret-key" }})
	if err != nil {
		t.Fatal(err)
	}
	src := s.(*Source)
	src.now = func() time.Time { return time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC) }
	return src, srv
}

func drain(t *testing.T, s *Source, lim index.BackfillLimits) ([]index.ActivityEvent, index.Page) {
	var all []index.ActivityEvent
	cursor := ""
	var last index.Page
	for i := 0; i < 100; i++ {
		p, err := s.Backfill(context.Background(), "base", me, cursor, lim)
		if err != nil {
			t.Fatal(err)
		}
		all = append(all, p.Events...)
		last = p
		if p.Cursor == "" {
			return all, last
		}
		cursor = p.Cursor
	}
	t.Fatal("no termination")
	return nil, last
}

func TestContract(t *testing.T) {
	s, _ := newSource(t, newFake())
	contracttest.RunSource(t, s, contracttest.SourceFixture{Chain: "base", Family: "evm", Address: me, SinceBlock: 130})
}

func TestBackfillShapes(t *testing.T) {
	s, _ := newSource(t, newFake())
	evs, last := drain(t, s, index.BackfillLimits{})
	// 20 in + 20 out + self once + internal + 2 x erc1155
	if len(evs) != 44 || last.Capped {
		t.Fatalf("got %d events capped=%v", len(evs), last.Capped)
	}
	byRef := map[string]index.ActivityEvent{}
	for _, e := range evs {
		byRef[e.TxHash+"|"+e.EventRef] = e
	}
	u := byRef[fmt.Sprintf("0x%064x", 1)+"|log:4"] // block 102 -> 102%7=4
	if u.Asset != usdc || u.AmountRaw != "50000000" || u.Kind != index.KindToken || !strings.Contains(string(u.Details), `"decimals":6`) {
		t.Fatalf("erc20 %+v", u)
	}
	e := byRef[fmt.Sprintf("0x%064x", 1001)+"|tx:0"]
	if e.Asset != "native" || e.AmountRaw != "1000000000000000000" || e.From != me {
		t.Fatalf("external %+v", e)
	}
	if byRef[fmt.Sprintf("0x%064x", 8888)+"|"+internalRef(other, me, "1000000000000000000")].Kind != index.KindInternal {
		t.Fatal("internal transfer missing")
	}
	b1, b2 := byRef[fmt.Sprintf("0x%064x", 7777)+"|log:3.0"], byRef[fmt.Sprintf("0x%064x", 7777)+"|log:3.1"]
	if b1.AmountRaw != "2" || b2.AmountRaw != "5" || !strings.Contains(string(b2.Details), `"token_id":"2"`) {
		t.Fatalf("erc1155 batch %+v %+v", b1, b2)
	}
}

func TestBackfillCapIsShared(t *testing.T) {
	s, _ := newSource(t, newFake())
	evs, last := drain(t, s, index.BackfillLimits{MaxTransfers: 10})
	in, out := 0, 0
	for _, e := range evs {
		if e.To == me {
			in++
		} else {
			out++
		}
	}
	if !last.Capped || in+out > 11 || out < 3 {
		t.Fatalf("cap: in=%d out=%d capped=%v", in, out, last.Capped)
	}
}

func TestBackfillAgeCutoff(t *testing.T) {
	s, _ := newSource(t, newFake())
	// now = Oct 2 00:00 and block N is N minutes after Oct 1 00:00, so a
	// 1310-minute max age keeps blocks >= 130 only.
	evs, last := drain(t, s, index.BackfillLimits{MaxAge: 1310 * time.Minute})
	if len(evs) == 0 {
		t.Fatal("nothing inside the window")
	}
	for _, e := range evs {
		if e.BlockNumber < 130 {
			t.Fatalf("event older than cutoff: block %d", e.BlockNumber)
		}
	}
	if !last.Capped {
		t.Fatal("age cutoff must mark the backfill capped")
	}
}

func TestOlderPages(t *testing.T) {
	s, _ := newSource(t, newFake())
	evs, _ := drain(t, s, index.BackfillLimits{BeforeBlock: 120, MaxTransfers: 100})
	for _, e := range evs {
		if e.BlockNumber >= 120 {
			t.Fatalf("older page returned block %d", e.BlockNumber)
		}
	}
	if len(evs) == 0 {
		t.Fatal("no older events")
	}
}

func TestInternalUnsupportedFallsBack(t *testing.T) {
	f := newFake()
	f.rejectInternal = true
	s, _ := newSource(t, f)
	if _, err := s.Backfill(context.Background(), "base", me, "", index.BackfillLimits{MaxTransfers: 2}); err != nil {
		t.Fatal(err)
	}
	for _, c := range f.lastCats.Load().([]string) {
		if c == "internal" {
			t.Fatal("internal still requested after rejection")
		}
	}
}

func TestHoldings(t *testing.T) {
	s, _ := newSource(t, newFake())
	toks, err := s.TokenContracts(context.Background(), "base", me)
	if err != nil || len(toks) != 1 || toks[0] != usdc {
		t.Fatalf("tokens %v %v", toks, err)
	}
	p, err := s.NFTs(context.Background(), "base", me, "")
	if err != nil || len(p.Items) != 1 || p.Cursor != "p2" || p.Items[0].Contract != "0xabc0000000000000000000000000000000000001" || p.AsOfBlock != 500 {
		t.Fatalf("nft page 1 %+v %v", p, err)
	}
	p, err = s.NFTs(context.Background(), "base", me, p.Cursor)
	if err != nil || p.Cursor != "" || !p.Items[0].Spam || p.Items[0].TokenID != "10" || p.Items[0].Amount != "3" {
		t.Fatalf("nft page 2 %+v %v", p, err)
	}
}

func TestErrorsNeverLeakKey(t *testing.T) {
	s, srv := newSource(t, newFake())
	srv.Close()
	_, err := s.Backfill(context.Background(), "base", me, "", index.BackfillLimits{})
	if err == nil || strings.Contains(err.Error(), "secret-key") {
		t.Fatalf("err %v", err)
	}
}

func TestMissingTimestampsAreFilled(t *testing.T) {
	f := newFake()
	for _, t := range f.in {
		delete(t, "metadata")
	}
	s, _ := newSource(t, f)
	p, err := s.Backfill(context.Background(), "base", me, "", index.BackfillLimits{MaxTransfers: 2})
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range p.Events {
		if e.To == me && e.BlockTime.Unix() != 0x6720e8c0 {
			t.Fatalf("timestamp not filled: %v", e.BlockTime)
		}
	}
}
