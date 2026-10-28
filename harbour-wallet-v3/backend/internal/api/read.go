package api

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"harbour/backend/internal/prices"
	"harbour/backend/internal/store"
)

// Read endpoints (phase 5). They read Postgres and Redis only: the home,
// history and NFT screens never cause an RPC call. Only GET /v1/tx for a
// hash Harbour has never seen asks the chain.

// selectTracked resolves ?addresses=chain:0x..,chain:0x.. to the device's
// tracked rows (all of the device's addresses when absent). Addresses the
// device doesn't track are rejected.
func (s *Server) selectTracked(w http.ResponseWriter, r *http.Request) ([]store.TrackedAddress, bool) {
	d := deviceFrom(r.Context())
	all, err := s.opt.Store.DeviceAddresses(r.Context(), s.opt.LinkCrypto, d.ID)
	if err != nil {
		s.internalErr(w, r, err)
		return nil, false
	}
	q := strings.TrimSpace(r.URL.Query().Get("addresses"))
	if q == "" {
		return all, true
	}
	byKey := map[string]store.TrackedAddress{}
	for _, t := range all {
		byKey[t.Chain+":"+t.Address] = t
	}
	var out []store.TrackedAddress
	seen := map[int64]bool{}
	for _, part := range strings.Split(q, ",") {
		chain, addr, ok := strings.Cut(strings.TrimSpace(part), ":")
		if !ok {
			writeErr(w, http.StatusBadRequest, "bad_address", "Addresses must look like chain:0x...", false)
			return nil, false
		}
		n, err := s.normalizeAddress(chain, addr)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "bad_address", "One of the addresses or networks isn't valid.", false)
			return nil, false
		}
		t, ok := byKey[chain+":"+n]
		if !ok {
			writeErr(w, http.StatusForbidden, "not_tracked", "Add this address to the wallet first.", false)
			return nil, false
		}
		if !seen[t.ID] {
			seen[t.ID] = true
			out = append(out, t)
		}
	}
	return out, true
}

func ids(ts []store.TrackedAddress) []int64 {
	out := make([]int64, len(ts))
	for i, t := range ts {
		out[i] = t.ID
	}
	return out
}

// formatUnits renders raw/10^dec exactly (trailing zeros trimmed).
func formatUnits(raw string, dec *int) string {
	v, ok := new(big.Int).SetString(raw, 10)
	if !ok {
		return ""
	}
	if dec == nil || *dec == 0 {
		return v.String()
	}
	d := *dec
	s := v.String()
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	for len(s) <= d {
		s = "0" + s
	}
	out := s[:len(s)-d] + "." + strings.TrimRight(s[len(s)-d:], "0")
	out = strings.TrimSuffix(out, ".")
	if neg {
		out = "-" + out
	}
	return out
}

func valueUSD(raw string, dec *int, px float64) float64 {
	if dec == nil {
		return 0
	}
	v, ok := new(big.Float).SetString(raw)
	if !ok {
		return 0
	}
	scale := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(*dec)), nil))
	f, _ := new(big.Float).Mul(new(big.Float).Quo(v, scale), big.NewFloat(px)).Float64()
	return f
}

type assetView struct {
	Chain    string  `json:"chain"`
	AssetRef string  `json:"asset_ref"`
	Kind     string  `json:"kind"`
	Symbol   *string `json:"symbol"`
	Name     *string `json:"name"`
	Decimals *int    `json:"decimals"`
	LogoURL  *string `json:"logo_url"`
	Spam     bool    `json:"spam"`
	Verified bool    `json:"verified"`
}

func assetOf(a store.AssetRow) assetView {
	return assetView{Chain: a.Chain, AssetRef: a.Ref, Kind: a.Kind, Symbol: a.Symbol, Name: a.Name, Decimals: a.Decimals,
		LogoURL: a.LogoURL, Spam: a.SpamScore >= 50, Verified: a.Verified}
}

type priceView struct {
	USD  *float64 `json:"usd"`  // null = no trustworthy price
	Flag string   `json:"flag"` // ok | thin | none
	At   *string  `json:"at,omitempty"`
}

func priceOf(c prices.Cached, ok bool, spam bool) priceView {
	if !ok || spam {
		return priceView{Flag: "none"}
	}
	at := c.At.UTC().Format(time.RFC3339)
	if c.Flag != prices.FlagOK {
		return priceView{Flag: c.Flag, At: &at}
	}
	v := c.USD
	return priceView{USD: &v, Flag: prices.FlagOK, At: &at}
}

type holdingView struct {
	assetView
	AmountRaw string    `json:"amount_raw"`
	Amount    string    `json:"amount"`
	Price     priceView `json:"price"`
	ValueUSD  *float64  `json:"value_usd"`
}

type addressPortfolio struct {
	Chain         string        `json:"chain"`
	Address       string        `json:"address"`
	Synced        bool          `json:"synced"`
	BackfillState string        `json:"backfill_state"`
	AsOfBlock     int64         `json:"as_of_block"`
	ValueUSD      float64       `json:"value_usd"`
	Assets        []holdingView `json:"assets"`
}

func synced(state string) bool { return state == "done" || state == "capped" || state == "skipped" }

func (s *Server) cacheKey(r *http.Request, kind string) string {
	h := sha256.Sum256([]byte(r.URL.RawQuery))
	return "hb:rc:" + kind + ":" + deviceFrom(r.Context()).ID + ":" + hex.EncodeToString(h[:8])
}

func (s *Server) cached(w http.ResponseWriter, r *http.Request, key string) bool {
	b, err := s.opt.Redis.Get(r.Context(), key).Bytes()
	if err != nil {
		return false
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-HB-Cache", "hit")
	w.Write(b)
	return true
}

func (s *Server) writeCached(w http.ResponseWriter, r *http.Request, key string, ttl time.Duration, v any) {
	b, _ := json.Marshal(v)
	s.opt.Redis.Set(context.WithoutCancel(r.Context()), key, b, ttl)
	w.Header().Set("Content-Type", "application/json")
	w.Write(b)
}

// GET /v1/me/portfolio
func (s *Server) handlePortfolio(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	key := s.cacheKey(r, "pf")
	if s.cached(w, r, key) {
		return
	}
	tracked, ok := s.selectTracked(w, r)
	if !ok {
		return
	}
	hs, err := s.opt.Store.Holdings(ctx, ids(tracked))
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	var assetIDs []int64
	for _, h := range hs {
		assetIDs = append(assetIDs, h.Asset.ID)
	}
	px, err := prices.Get(ctx, s.opt.Redis, assetIDs)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	byID := map[int64]*addressPortfolio{}
	out := struct {
		ValueUSD  float64             `json:"value_usd"`
		Addresses []*addressPortfolio `json:"addresses"`
	}{Addresses: []*addressPortfolio{}}
	for _, t := range tracked {
		p := &addressPortfolio{Chain: t.Chain, Address: t.Address, Synced: synced(t.BackfillState), BackfillState: t.BackfillState, Assets: []holdingView{}}
		byID[t.ID] = p
		out.Addresses = append(out.Addresses, p)
	}
	for _, h := range hs {
		p := byID[h.TrackedID]
		c, ok := px[h.Asset.ID]
		hv := holdingView{assetView: assetOf(h.Asset), AmountRaw: h.AmountRaw, Amount: formatUnits(h.AmountRaw, h.Asset.Decimals),
			Price: priceOf(c, ok, h.Asset.SpamScore >= 50)}
		if hv.Price.USD != nil {
			v := valueUSD(h.AmountRaw, h.Asset.Decimals, *hv.Price.USD)
			hv.ValueUSD = &v
			p.ValueUSD += v
		}
		if h.AsOfBlock > p.AsOfBlock {
			p.AsOfBlock = h.AsOfBlock
		}
		p.Assets = append(p.Assets, hv)
	}
	for _, p := range out.Addresses {
		sort.SliceStable(p.Assets, func(i, j int) bool { // valued first, spam last
			vi, vj := p.Assets[i].ValueUSD, p.Assets[j].ValueUSD
			if p.Assets[i].Spam != p.Assets[j].Spam {
				return !p.Assets[i].Spam
			}
			if (vi == nil) != (vj == nil) {
				return vi != nil
			}
			return vi != nil && *vi > *vj
		})
		out.ValueUSD += p.ValueUSD
	}
	s.writeCached(w, r, key, 10*time.Second, out)
}

// ---------- history ----------

func encodeCursor(c store.ActivityCursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeCursor(s string) (*store.ActivityCursor, error) {
	if s == "" {
		return nil, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	var c store.ActivityCursor
	if err := json.Unmarshal(b, &c); err != nil || c.TxHash == "" {
		return nil, errors.New("bad cursor")
	}
	return &c, nil
}

type summaryItem struct {
	EventRef  string `json:"event_ref"`
	Asset     string `json:"asset"`
	AmountRaw string `json:"amount_raw"`
	Kind      string `json:"kind"`
	Direction string `json:"direction"`
	TokenID   string `json:"token_id,omitempty"`
	Counter   string `json:"counterparty,omitempty"`
}

type historyTransfer struct {
	assetView
	AmountRaw    string `json:"amount_raw"`
	Amount       string `json:"amount"`
	Direction    string `json:"direction"`
	Counterparty string `json:"counterparty,omitempty"`
	TokenID      string `json:"token_id,omitempty"`
}

type historyItem struct {
	Chain     string            `json:"chain"`
	Address   string            `json:"address"`
	TxHash    string            `json:"tx_hash"`
	BlockTime time.Time         `json:"block_time"`
	Direction string            `json:"direction"`
	Finality  string            `json:"finality"`
	Transfers []historyTransfer `json:"transfers"`
}

// GET /v1/me/history?addresses=&cursor=&limit=
func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tracked, ok := s.selectTracked(w, r)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	cur, err := decodeCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "bad_cursor", "Invalid request.", false)
		return
	}
	rows, err := s.opt.Store.Activity(ctx, ids(tracked), cur, limit)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	addrOf := map[int64]store.TrackedAddress{}
	for _, t := range tracked {
		addrOf[t.ID] = t
	}
	// Enrich with asset metadata and finality in two queries.
	var chains, refs []string
	seenRef := map[string]bool{}
	hashesByChain := map[string][]string{}
	parsed := make([][]summaryItem, len(rows))
	for i, a := range rows {
		var sum struct {
			Transfers []summaryItem `json:"transfers"`
		}
		_ = json.Unmarshal(a.Summary, &sum)
		parsed[i] = sum.Transfers
		hashesByChain[a.Chain] = append(hashesByChain[a.Chain], a.TxHash)
		for _, t := range sum.Transfers {
			if k := a.Chain + "|" + t.Asset; !seenRef[k] {
				seenRef[k] = true
				chains, refs = append(chains, a.Chain), append(refs, t.Asset)
			}
		}
	}
	assets := map[string]store.AssetRow{}
	if len(refs) > 0 {
		as, err := s.opt.Store.AssetsByRef(ctx, chains, refs)
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		for _, a := range as {
			assets[a.Chain+"|"+a.Ref] = a
		}
	}
	finality := map[string]string{}
	for chain, hs := range hashesByChain {
		f, err := s.opt.Store.TxFinality(ctx, chain, hs)
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		for h, v := range f {
			finality[chain+"|"+h] = v
		}
	}
	items := make([]historyItem, 0, len(rows))
	for i, a := range rows {
		it := historyItem{Chain: a.Chain, Address: addrOf[a.TrackedID].Address, TxHash: a.TxHash, BlockTime: a.BlockTime,
			Direction: a.Direction, Finality: finality[a.Chain+"|"+a.TxHash], Transfers: []historyTransfer{}}
		for _, t := range parsed[i] {
			ar, ok := assets[a.Chain+"|"+t.Asset]
			if !ok {
				ar = store.AssetRow{Chain: a.Chain, Ref: t.Asset, Kind: t.Kind}
			}
			var amt string
			if ar.Kind == "nft" || ar.Kind == "multi" {
				amt = formatUnits(t.AmountRaw, nil)
			} else {
				amt = formatUnits(t.AmountRaw, ar.Decimals)
			}
			it.Transfers = append(it.Transfers, historyTransfer{assetView: assetOf(ar), AmountRaw: t.AmountRaw, Amount: amt,
				Direction: t.Direction, Counterparty: t.Counter, TokenID: t.TokenID})
		}
		items = append(items, it)
	}
	resp := map[string]any{"items": items}
	if len(rows) == limit {
		last := rows[len(rows)-1]
		resp["cursor"] = encodeCursor(store.ActivityCursor{BlockTime: last.BlockTime, TxHash: last.TxHash, TrackedID: last.TrackedID})
	} else {
		// Reached the end of stored history: ask the indexer for older pages
		// past the backfill cap (at most once a minute per address).
		states, err := s.opt.Store.TrackedStates(ctx, ids(tracked))
		if err != nil {
			s.internalErr(w, r, err)
			return
		}
		loading := false
		for _, st := range states {
			if st.HistoryComplete || st.BackfillState != "capped" {
				continue
			}
			loading = true
			okSet, _ := s.opt.Redis.SetNX(ctx, "hb:older:"+strconv.FormatInt(st.ID, 10), 1, time.Minute).Result()
			if okSet {
				b, _ := json.Marshal(map[string]int64{"tracked_address_id": st.ID})
				if err := s.opt.Events.Publish(ctx, "address.history.more", b); err != nil {
					s.opt.Log.Warn("publish history.more failed", "err", err)
				}
			}
		}
		resp["loading_older"] = loading
	}
	writeJSON(w, http.StatusOK, resp)
}

// ---------- NFTs ----------

// GET /v1/me/nfts
func (s *Server) handleNFTs(w http.ResponseWriter, r *http.Request) {
	tracked, ok := s.selectTracked(w, r)
	if !ok {
		return
	}
	ns, err := s.opt.Store.NFTs(r.Context(), ids(tracked))
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	addrOf := map[int64]store.TrackedAddress{}
	for _, t := range tracked {
		addrOf[t.ID] = t
	}
	type nftView struct {
		Chain      string  `json:"chain"`
		Address    string  `json:"address"`
		Contract   string  `json:"contract"`
		Collection *string `json:"collection"`
		TokenID    string  `json:"token_id"`
		Amount     string  `json:"amount"`
		Name       *string `json:"name"`
		Standard   string  `json:"standard"`
		ImageURL   *string `json:"image_url"` // Harbour's media proxy, never the NFT's own URL
		Spam       bool    `json:"spam"`
	}
	out := []nftView{}
	for _, n := range ns {
		v := nftView{Chain: n.Asset.Chain, Address: addrOf[n.TrackedID].Address, Contract: n.Asset.Ref, Collection: n.Asset.Symbol,
			TokenID: n.TokenID, Amount: n.Amount, Name: n.Name, Standard: map[string]string{"nft": "erc721", "multi": "erc1155"}[n.Asset.Kind],
			Spam: n.Asset.SpamScore >= 50}
		if n.MediaKey != nil && !v.Spam {
			u := "/v1/media/" + *n.MediaKey
			v.ImageURL = &u
		}
		out = append(out, v)
	}
	writeJSON(w, http.StatusOK, map[string]any{"nfts": out})
}

// ---------- chart ----------

// GET /v1/me/portfolio/chart?range=7d|30d|90d|1y
func (s *Server) handleChart(w http.ResponseWriter, r *http.Request) {
	days := map[string]int{"7d": 7, "30d": 30, "90d": 90, "1y": 365}[r.URL.Query().Get("range")]
	if days == 0 {
		days = 30
	}
	key := s.cacheKey(r, "chart")
	if s.cached(w, r, key) {
		return
	}
	tracked, ok := s.selectTracked(w, r)
	if !ok {
		return
	}
	from := time.Now().UTC().AddDate(0, 0, -days+1)
	pts, err := s.opt.Store.Chart(r.Context(), ids(tracked), from, s.cfg.Prices.MinLiquidityUSD)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	type point struct {
		Day      string  `json:"day"`
		ValueUSD float64 `json:"value_usd"`
	}
	out := []point{}
	for _, p := range pts {
		out = append(out, point{Day: p.Day.Format("2006-01-02"), ValueUSD: p.ValueUSD})
	}
	// Charts start on the day an address is first tracked.
	s.writeCached(w, r, key, 5*time.Minute, map[string]any{"points": out})
}

// ---------- assets and prices ----------

func (s *Server) assetFromPath(w http.ResponseWriter, r *http.Request) (store.AssetRow, bool) {
	chain := chi.URLParam(r, "chain")
	ref := strings.ToLower(chi.URLParam(r, "asset"))
	if _, ok := s.cfg.Chains[chain]; !ok {
		writeErr(w, http.StatusNotFound, "unknown_chain", "This network isn't supported.", false)
		return store.AssetRow{}, false
	}
	a, err := s.opt.Store.Asset(r.Context(), chain, ref)
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "unknown_asset", "We don't have details for this token yet.", false)
		return a, false
	} else if err != nil {
		s.internalErr(w, r, err)
		return a, false
	}
	return a, true
}

// GET /v1/assets/{chain}/{asset}
func (s *Server) handleAsset(w http.ResponseWriter, r *http.Request) {
	a, ok := s.assetFromPath(w, r)
	if !ok {
		return
	}
	px, err := prices.Get(r.Context(), s.opt.Redis, []int64{a.ID})
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	c, has := px[a.ID]
	writeJSON(w, http.StatusOK, map[string]any{"asset": assetOf(a), "price": priceOf(c, has, a.SpamScore >= 50)})
}

// GET /v1/assets/{chain}/{asset}/prices?range=1d|7d|30d|1y
func (s *Server) handleAssetPrices(w http.ResponseWriter, r *http.Request) {
	a, ok := s.assetFromPath(w, r)
	if !ok {
		return
	}
	rng := r.URL.Query().Get("range")
	spec := map[string]struct {
		d      time.Duration
		bucket string
	}{"1d": {24 * time.Hour, "minute"}, "7d": {7 * 24 * time.Hour, "hour"}, "30d": {30 * 24 * time.Hour, "hour"}, "1y": {365 * 24 * time.Hour, "day"}}
	sp, ok := spec[rng]
	if !ok {
		sp = spec["7d"]
	}
	pts, err := s.opt.Store.PriceSeries(r.Context(), a.ID, time.Now().Add(-sp.d), sp.bucket)
	if err != nil {
		s.internalErr(w, r, err)
		return
	}
	type point struct {
		At       time.Time `json:"at"`
		PriceUSD float64   `json:"price_usd"`
	}
	out := []point{}
	if a.SpamScore < 50 {
		for _, p := range pts {
			out = append(out, point{At: p.At, PriceUSD: p.PriceUSD})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"points": out})
}
