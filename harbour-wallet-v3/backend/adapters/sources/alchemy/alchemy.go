// Package alchemy is the first index.Source: Alchemy's Transfers API for
// history and gap-fill, token-balance discovery and the NFT API for holdings.
// It converts every payload to index.ActivityEvent; nothing outside this
// package sees an Alchemy type. Live delivery (Address Activity webhooks)
// arrives through webhook-ingest in phase 4.
package alchemy

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/ratelimit"
	"harbour/backend/internal/registry"
)

// Name is the adapter name used in providers.yaml.
const Name = "alchemy"

func init() { registry.IndexSources.Register(Name, New) }

const pageMax = 1000 // Transfers API maxCount ceiling

// Source implements index.Source and index.Holdings.
type Source struct {
	key         string
	notifyToken string
	notifyBase  string
	baseURL     string // template with {network}; default https://{network}.g.alchemy.com
	chains      map[string]chainOpts
	lim         *ratelimit.Limiter
	http        *http.Client
	now         func() time.Time

	mu         sync.Mutex
	noInternal map[string]bool   // chains where the API rejected "internal"
	blockTimes map[string]string // chain|block -> RFC3339, for networks without withMetadata
}

type chainOpts struct {
	network        string
	categories     []string
	webhookNetwork string // Notify network enum, e.g. ETH_MAINNET
}

// New builds the source from providers.yaml options and chains.yaml per-chain options.
func New(cfg index.SourceConfig) (index.Source, error) {
	getenv := cfg.Getenv
	if getenv == nil {
		return nil, errors.New("alchemy: Getenv is required")
	}
	keyEnv := cfg.Options["key_env"]
	if keyEnv == "" {
		keyEnv = "ALCHEMY_API_KEY"
	}
	key := strings.TrimSpace(getenv(keyEnv))
	if key == "" {
		return nil, fmt.Errorf("alchemy: %s is empty", keyEnv)
	}
	rps, _ := strconv.ParseFloat(cfg.Options["rps"], 64)
	base := cfg.Options["base_url"]
	if base == "" {
		base = "https://{network}.g.alchemy.com"
	}
	s := &Source{key: key, baseURL: base, chains: map[string]chainOpts{}, lim: ratelimit.New(rps),
		http: &http.Client{Timeout: 30 * time.Second}, now: time.Now, noInternal: map[string]bool{}, blockTimes: map[string]string{}}
	notifyEnv := cfg.Options["notify_token_env"]
	if notifyEnv == "" {
		notifyEnv = "ALCHEMY_NOTIFY_TOKEN"
	}
	s.notifyToken = strings.TrimSpace(getenv(notifyEnv))
	s.notifyBase = cfg.Options["notify_base_url"]
	if s.notifyBase == "" {
		s.notifyBase = "https://dashboard.alchemy.com/api"
	}
	for chain, o := range cfg.Chains {
		if o["network"] == "" {
			return nil, fmt.Errorf("alchemy: chain %s has no network option", chain)
		}
		cats := strings.Split(o["categories"], ",")
		if o["categories"] == "" {
			cats = []string{"external", "erc20", "erc721", "erc1155"}
		}
		for i := range cats {
			cats[i] = strings.TrimSpace(cats[i])
		}
		s.chains[chain] = chainOpts{network: o["network"], categories: cats, webhookNetwork: o["webhook_network"]}
	}
	return s, nil
}

func (s *Source) Name() string { return Name }

// Subscribe is not used for this source: Alchemy pushes webhooks to
// webhook-ingest, which converts them with ParseWebhook (phase 4).
func (s *Source) Subscribe(context.Context, string, []string, index.Handler) error {
	return errors.New("alchemy: live events arrive through webhook-ingest")
}

func (s *Source) opts(chain string) (chainOpts, error) {
	o, ok := s.chains[chain]
	if !ok {
		return o, fmt.Errorf("alchemy: chain %s not configured", chain)
	}
	return o, nil
}

func (s *Source) base(o chainOpts) string {
	return strings.ReplaceAll(s.baseURL, "{network}", o.network)
}

// ---------- HTTP ----------

func (s *Source) do(ctx context.Context, req *http.Request, out any) error {
	if err := s.lim.Wait(ctx); err != nil {
		return err
	}
	resp, err := s.http.Do(req)
	if err != nil {
		var ue *url.Error
		if errors.As(err, &ue) { // never leak the URL: it contains the key
			err = ue.Err
		}
		return fmt.Errorf("alchemy: %w", err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return &APIError{Status: resp.StatusCode, Message: snippet(b)}
	}
	return json.Unmarshal(b, out)
}

// APIError is a non-200 or JSON-RPC error from Alchemy.
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string { return fmt.Sprintf("alchemy: %d %s", e.Status, e.Message) }

func snippet(b []byte) string {
	if len(b) > 200 {
		b = b[:200]
	}
	return strings.TrimSpace(string(b))
}

func (s *Source) rpc(ctx context.Context, o chainOpts, method string, params []any, out any) error {
	body, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.base(o)+"/v2/"+s.key, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	var env struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := s.do(ctx, req, &env); err != nil {
		return err
	}
	if env.Error != nil {
		return &APIError{Status: env.Error.Code, Message: env.Error.Message}
	}
	return json.Unmarshal(env.Result, out)
}

// ---------- transfers ----------

type transfer struct {
	BlockNum      string `json:"blockNum"`
	UniqueID      string `json:"uniqueId"`
	Hash          string `json:"hash"`
	From          string `json:"from"`
	To            string `json:"to"`
	Asset         string `json:"asset"`
	Category      string `json:"category"`
	TokenID       string `json:"tokenId"`
	ERC721TokenID string `json:"erc721TokenId"`
	ERC1155       []struct {
		TokenID string `json:"tokenId"`
		Value   string `json:"value"`
	} `json:"erc1155Metadata"`
	RawContract struct {
		Value   string `json:"value"`
		Address string `json:"address"`
		Decimal string `json:"decimal"`
	} `json:"rawContract"`
	Metadata struct {
		BlockTimestamp string `json:"blockTimestamp"`
	} `json:"metadata"`
}

type transfersResult struct {
	Transfers []transfer `json:"transfers"`
	PageKey   string     `json:"pageKey"`
}

func (s *Source) categories(chain string, o chainOpts) []string {
	s.mu.Lock()
	drop := s.noInternal[chain]
	s.mu.Unlock()
	out := make([]string, 0, len(o.categories))
	for _, c := range o.categories {
		if drop && c == "internal" {
			continue
		}
		out = append(out, c)
	}
	return out
}

// transfers runs one alchemy_getAssetTransfers page.
func (s *Source) transfers(ctx context.Context, chain string, p map[string]any) (transfersResult, error) {
	o, err := s.opts(chain)
	if err != nil {
		return transfersResult{}, err
	}
	p["category"] = s.categories(chain, o)
	p["withMetadata"] = true
	p["excludeZeroValue"] = false
	var r transfersResult
	err = s.rpc(ctx, o, "alchemy_getAssetTransfers", []any{p}, &r)
	var ae *APIError
	if errors.As(err, &ae) && strings.Contains(strings.ToLower(ae.Message), "internal") && containsStr(p["category"].([]string), "internal") {
		// This network does not support internal transfers: drop it for good.
		s.mu.Lock()
		s.noInternal[chain] = true
		s.mu.Unlock()
		return s.transfers(ctx, chain, p)
	}
	if err != nil {
		return r, err
	}
	return r, s.fillTimestamps(ctx, chain, o, r.Transfers)
}

// fillTimestamps reads block times for networks where withMetadata is not
// supported (some testnets), one eth_getBlockByNumber per distinct block.
func (s *Source) fillTimestamps(ctx context.Context, chain string, o chainOpts, ts []transfer) error {
	for i := range ts {
		if ts[i].Metadata.BlockTimestamp != "" {
			continue
		}
		key := chain + "|" + ts[i].BlockNum
		s.mu.Lock()
		v, ok := s.blockTimes[key]
		s.mu.Unlock()
		if !ok {
			var blk struct {
				Timestamp string `json:"timestamp"`
			}
			if err := s.rpc(ctx, o, "eth_getBlockByNumber", []any{ts[i].BlockNum, false}, &blk); err != nil {
				return err
			}
			sec, err := strconv.ParseInt(strings.TrimPrefix(blk.Timestamp, "0x"), 16, 64)
			if err != nil {
				return fmt.Errorf("alchemy: no timestamp for block %s", ts[i].BlockNum)
			}
			v = time.Unix(sec, 0).UTC().Format(time.RFC3339)
			s.mu.Lock()
			if len(s.blockTimes) > 50_000 {
				s.blockTimes = map[string]string{}
			}
			s.blockTimes[key] = v
			s.mu.Unlock()
		}
		ts[i].Metadata.BlockTimestamp = v
	}
	return nil
}

func containsStr(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func hexToDec(h string) (string, bool) {
	h = strings.TrimPrefix(strings.TrimSpace(h), "0x")
	if h == "" {
		return "0", true
	}
	v, ok := new(big.Int).SetString(h, 16)
	if !ok {
		return "", false
	}
	return v.String(), true
}

func parseIndex(s string) (uint64, bool) {
	if strings.HasPrefix(s, "0x") {
		v, err := strconv.ParseUint(s[2:], 16, 64)
		return v, err == nil
	}
	v, err := strconv.ParseUint(s, 10, 64)
	return v, err == nil
}

// eventRef turns Alchemy's uniqueId ("<hash>:log:<n>", "<hash>:external",
// "<hash>:internal:<n>") into a source-independent position.
func eventRef(t transfer) string {
	parts := strings.Split(t.UniqueID, ":")
	if len(parts) >= 2 {
		switch parts[1] {
		case "log":
			if len(parts) >= 3 {
				if n, ok := parseIndex(parts[2]); ok {
					return "log:" + strconv.FormatUint(n, 10)
				}
			}
		case "external":
			return "tx:0"
		case "internal":
			if len(parts) >= 3 {
				if n, ok := parseIndex(parts[2]); ok {
					return "trace:" + strconv.FormatUint(n, 10)
				}
			}
			return "trace:0"
		}
	}
	if t.Category == "external" {
		return "tx:0"
	}
	return "tx:0"
}

// convert maps one transfer to events (ERC-1155 batches become several).
func (s *Source) convert(chain string, t transfer) ([]index.ActivityEvent, error) {
	block, err := strconv.ParseUint(strings.TrimPrefix(t.BlockNum, "0x"), 16, 64)
	if err != nil {
		return nil, fmt.Errorf("alchemy: bad blockNum %q", t.BlockNum)
	}
	bt, err := time.Parse(time.RFC3339, t.Metadata.BlockTimestamp)
	if err != nil {
		return nil, fmt.Errorf("alchemy: missing blockTimestamp (withMetadata unsupported on %s?)", chain)
	}
	base := index.ActivityEvent{
		Chain: chain, Family: "evm", TxHash: strings.ToLower(t.Hash), EventRef: eventRef(t),
		BlockNumber: block, BlockTime: bt.UTC(), From: strings.ToLower(t.From), To: strings.ToLower(t.To),
	}
	details := map[string]any{}
	contract := strings.ToLower(t.RawContract.Address)
	switch t.Category {
	case "external", "internal":
		base.Asset = "native"
		base.Kind = index.KindNative
		if t.Category == "internal" {
			base.Kind = index.KindInternal
		}
		v, ok := hexToDec(t.RawContract.Value)
		if !ok {
			return nil, fmt.Errorf("alchemy: bad value %q", t.RawContract.Value)
		}
		base.AmountRaw = v
		if t.Category == "internal" {
			base.EventRef = internalRef(base.From, base.To, v) // same ref as webhooks derive
		}
	case "erc20":
		if index.IsNativeTransferLog(contract) {
			return nil, nil // EIP-7708 log of a native transfer: the "external" leg already covers it
		}
		base.Asset = contract
		base.Kind = index.KindToken
		v, ok := hexToDec(t.RawContract.Value)
		if !ok {
			return nil, fmt.Errorf("alchemy: bad value %q", t.RawContract.Value)
		}
		base.AmountRaw = v
		if t.Asset != "" {
			details[index.DetailSymbol] = t.Asset
		}
		if d, ok := hexToDec(t.RawContract.Decimal); ok && t.RawContract.Decimal != "" {
			if n, err := strconv.Atoi(d); err == nil {
				details[index.DetailDecimals] = n
			}
		}
	case "erc721", "specialnft":
		base.Asset = contract
		base.Kind = index.KindNFT
		base.AmountRaw = "1"
		tid := t.TokenID
		if tid == "" {
			tid = t.ERC721TokenID
		}
		if d, ok := hexToDec(tid); ok {
			details[index.DetailTokenID] = d
		}
		if t.Asset != "" {
			details[index.DetailSymbol] = t.Asset
		}
	case "erc1155":
		var out []index.ActivityEvent
		for i, m := range t.ERC1155 {
			ev := base
			ev.Asset, ev.Kind = contract, index.KindMulti
			v, ok := hexToDec(m.Value)
			if !ok {
				return nil, fmt.Errorf("alchemy: bad erc1155 value %q", m.Value)
			}
			ev.AmountRaw = v
			ev.EventRef = fmt.Sprintf("%s.%d", base.EventRef, i)
			tid, _ := hexToDec(m.TokenID)
			ev.Details, _ = json.Marshal(map[string]any{index.DetailTokenID: tid})
			out = append(out, ev)
		}
		return out, nil
	default:
		return nil, nil // unknown category: skip, never guess
	}
	if base.Asset == "" {
		return nil, nil
	}
	if len(details) > 0 {
		base.Details, _ = json.Marshal(details)
	}
	return []index.ActivityEvent{base}, nil
}

// ---------- backfill (newest first, both directions, fair share of the cap) ----------

type cursor struct {
	InKey   string `json:"ik,omitempty"`
	OutKey  string `json:"ok,omitempty"`
	InDone  bool   `json:"id,omitempty"`
	OutDone bool   `json:"od,omitempty"`
	N       int    `json:"n,omitempty"`
	Capped  bool   `json:"c,omitempty"`
	Last    uint64 `json:"l,omitempty"`
	Oldest  uint64 `json:"o,omitempty"`
}

func decodeCursor(c string) (cursor, error) {
	var cur cursor
	if c == "" {
		return cur, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(c)
	if err == nil {
		err = json.Unmarshal(b, &cur)
	}
	if err != nil {
		return cur, fmt.Errorf("alchemy: bad cursor")
	}
	return cur, nil
}

func encodeCursor(c cursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

// Backfill returns history newest first. Each call fetches one page per
// direction (incoming, outgoing) so neither can starve the other of the cap.
func (s *Source) Backfill(ctx context.Context, chain, address, cursorStr string, lim index.BackfillLimits) (index.Page, error) {
	cur, err := decodeCursor(cursorStr)
	if err != nil {
		return index.Page{}, err
	}
	addr := strings.ToLower(address)
	var cutoff time.Time
	if lim.MaxAge > 0 {
		cutoff = s.now().Add(-lim.MaxAge)
	}
	toBlock := "latest"
	if lim.BeforeBlock > 0 {
		toBlock = "0x" + strconv.FormatUint(lim.BeforeBlock-1, 16)
	}
	var page index.Page
	active := 0
	if !cur.InDone {
		active++
	}
	if !cur.OutDone {
		active++
	}
	for _, dir := range []string{"in", "out"} {
		done, key := cur.InDone, cur.InKey
		if dir == "out" {
			done, key = cur.OutDone, cur.OutKey
		}
		if done {
			continue
		}
		want := pageMax
		if lim.MaxTransfers > 0 {
			remaining := lim.MaxTransfers - cur.N
			if active > 1 {
				remaining = (remaining + 1) / 2
			}
			if remaining <= 0 {
				cur.Capped = true
				cur.InDone, cur.OutDone = true, true
				break
			}
			if remaining < want {
				want = remaining
			}
		}
		p := map[string]any{"fromBlock": "0x0", "toBlock": toBlock, "order": "desc", "maxCount": "0x" + strconv.FormatInt(int64(want), 16)}
		if dir == "in" {
			p["toAddress"] = addr
		} else {
			p["fromAddress"] = addr
		}
		if key != "" {
			p["pageKey"] = key
		}
		r, err := s.transfers(ctx, chain, p)
		if err != nil {
			return index.Page{}, err
		}
		dirDone := r.PageKey == ""
		for _, t := range r.Transfers {
			if dir == "out" && strings.EqualFold(t.To, addr) {
				continue // self-transfer, already returned as incoming
			}
			evs, err := s.convert(chain, t)
			if err != nil {
				return index.Page{}, err
			}
			if len(evs) > 0 && !cutoff.IsZero() && evs[0].BlockTime.Before(cutoff) {
				dirDone, cur.Capped = true, true
				break
			}
			for _, ev := range evs {
				page.Events = append(page.Events, ev)
				if ev.BlockNumber > cur.Last {
					cur.Last = ev.BlockNumber
				}
				if cur.Oldest == 0 || ev.BlockNumber < cur.Oldest {
					cur.Oldest = ev.BlockNumber
				}
			}
			cur.N++
		}
		if dir == "in" {
			cur.InDone, cur.InKey = dirDone, r.PageKey
		} else {
			cur.OutDone, cur.OutKey = dirDone, r.PageKey
		}
		if lim.MaxTransfers > 0 && cur.N >= lim.MaxTransfers {
			if !(cur.InDone && cur.OutDone) {
				cur.Capped = true
			}
			cur.InDone, cur.OutDone = true, true
		}
	}
	page.LastBlock, page.OldestBlock, page.Capped = cur.Last, cur.Oldest, cur.Capped
	if !(cur.InDone && cur.OutDone) {
		page.Cursor = encodeCursor(cur)
	}
	return page, nil
}

// Since returns events after fromBlock, oldest first (gap-fill).
func (s *Source) Since(ctx context.Context, chain, address string, fromBlock uint64, cursorStr string) (index.Page, error) {
	cur, err := decodeCursor(cursorStr)
	if err != nil {
		return index.Page{}, err
	}
	addr := strings.ToLower(address)
	var page index.Page
	for _, dir := range []string{"in", "out"} {
		done, key := cur.InDone, cur.InKey
		if dir == "out" {
			done, key = cur.OutDone, cur.OutKey
		}
		if done {
			continue
		}
		p := map[string]any{"fromBlock": "0x" + strconv.FormatUint(fromBlock+1, 16), "toBlock": "latest", "order": "asc", "maxCount": "0x3e8"}
		if dir == "in" {
			p["toAddress"] = addr
		} else {
			p["fromAddress"] = addr
		}
		if key != "" {
			p["pageKey"] = key
		}
		r, err := s.transfers(ctx, chain, p)
		if err != nil {
			return index.Page{}, err
		}
		for _, t := range r.Transfers {
			if dir == "out" && strings.EqualFold(t.To, addr) {
				continue
			}
			evs, err := s.convert(chain, t)
			if err != nil {
				return index.Page{}, err
			}
			for _, ev := range evs {
				if ev.BlockNumber <= fromBlock {
					continue
				}
				page.Events = append(page.Events, ev)
				if ev.BlockNumber > cur.Last {
					cur.Last = ev.BlockNumber
				}
			}
		}
		if dir == "in" {
			cur.InDone, cur.InKey = r.PageKey == "", r.PageKey
		} else {
			cur.OutDone, cur.OutKey = r.PageKey == "", r.PageKey
		}
	}
	page.LastBlock = cur.Last
	if !(cur.InDone && cur.OutDone) {
		page.Cursor = encodeCursor(cur)
	}
	return page, nil
}

// ---------- holdings ----------

// TokenContracts lists ERC-20 contracts with a non-zero balance (discovery
// only; amounts are read from chain).
func (s *Source) TokenContracts(ctx context.Context, chain, address string) ([]string, error) {
	o, err := s.opts(chain)
	if err != nil {
		return nil, err
	}
	var out []string
	key := ""
	for page := 0; page < 10; page++ {
		params := []any{strings.ToLower(address), "erc20"}
		if key != "" {
			params = append(params, map[string]string{"pageKey": key})
		}
		var r struct {
			TokenBalances []struct {
				ContractAddress string `json:"contractAddress"`
				TokenBalance    string `json:"tokenBalance"`
			} `json:"tokenBalances"`
			PageKey string `json:"pageKey"`
		}
		if err := s.rpc(ctx, o, "alchemy_getTokenBalances", params, &r); err != nil {
			return nil, err
		}
		for _, tb := range r.TokenBalances {
			if v, ok := hexToDec(tb.TokenBalance); ok && v != "0" {
				out = append(out, strings.ToLower(tb.ContractAddress))
			}
		}
		if r.PageKey == "" {
			break
		}
		key = r.PageKey
	}
	return out, nil
}

// NFTs lists current NFT holdings, 100 per page.
func (s *Source) NFTs(ctx context.Context, chain, address, cursorStr string) (index.NFTPage, error) {
	o, err := s.opts(chain)
	if err != nil {
		return index.NFTPage{}, err
	}
	q := url.Values{"owner": {strings.ToLower(address)}, "withMetadata": {"true"}, "pageSize": {"100"}}
	if cursorStr != "" {
		q.Set("pageKey", cursorStr)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.base(o)+"/nft/v3/"+s.key+"/getNFTsForOwner?"+q.Encode(), nil)
	if err != nil {
		return index.NFTPage{}, err
	}
	var r struct {
		OwnedNFTs []struct {
			Contract struct {
				Address   string `json:"address"`
				Name      string `json:"name"`
				Symbol    string `json:"symbol"`
				TokenType string `json:"tokenType"`
				IsSpam    bool   `json:"isSpam"`
			} `json:"contract"`
			TokenID   string `json:"tokenId"`
			TokenType string `json:"tokenType"`
			Name      string `json:"name"`
			Balance   string `json:"balance"`
			Image     struct {
				CachedURL   string `json:"cachedUrl"`
				OriginalURL string `json:"originalUrl"`
			} `json:"image"`
		} `json:"ownedNfts"`
		PageKey string `json:"pageKey"`
		ValidAt struct {
			BlockNumber uint64 `json:"blockNumber"`
		} `json:"validAt"`
	}
	if err := s.do(ctx, req, &r); err != nil {
		return index.NFTPage{}, err
	}
	page := index.NFTPage{Cursor: r.PageKey, AsOfBlock: r.ValidAt.BlockNumber}
	for _, n := range r.OwnedNFTs {
		std := strings.ToLower(n.TokenType)
		if std == "" {
			std = strings.ToLower(n.Contract.TokenType)
		}
		amt := n.Balance
		if amt == "" {
			amt = "1"
		}
		img := n.Image.CachedURL
		if img == "" {
			img = n.Image.OriginalURL
		}
		tid := n.TokenID
		if strings.HasPrefix(tid, "0x") {
			tid, _ = hexToDec(tid)
		}
		page.Items = append(page.Items, index.NFT{
			Contract: strings.ToLower(n.Contract.Address), TokenID: tid, Amount: amt, Standard: std,
			Name: n.Name, Symbol: n.Contract.Symbol, ImageURL: img, Spam: n.Contract.IsSpam,
		})
	}
	return page, nil
}
