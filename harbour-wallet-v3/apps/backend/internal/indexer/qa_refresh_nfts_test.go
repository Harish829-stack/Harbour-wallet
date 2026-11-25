package indexer_test

// QA (be-int): T-IDX-063 balance refresh with extra token refs + idle sweep; T-IDX-064 lazy NFT sync: atomic replacement, media
// keys, dirty flag cleared, MarkNFTsMoved re-dirties, malformed token ids skipped, a failing provider leaves the old list intact.

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/store"
)

func TestQARefreshExtraRefsAndSweep(t *testing.T) {
	ctx, st, _, fc, _, ix, _, _ := qaIndexerEnv(t, "indexer_qa_refresh", startNATS(t))
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, _ := st.CreateDevice(ctx, []byte(strings.Repeat("5", 32)), "default", nil)
	_, _, err := st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	_, err = ix.RunOneBackfill(ctx)
	must(t, err)
	id, _ := st.TrackedID(ctx, "base", A)
	extra := "0x00000000000000000000000000000000000e7a11"
	fc.mu.Lock()
	fc.block = 120
	fc.bal[A+"|"+extra] = "777"
	fc.bal[A+"|native"] = "2000"
	fc.mu.Unlock()
	must(t, ix.RefreshBalances(ctx, id, []string{extra}))
	b := balances(t, st, id)
	if b[extra] != "777" || b["native"] != "2000" {
		t.Fatalf("refresh with an extra ref: %v", b)
	}
	var asOf int64
	var at *time.Time
	must(t, st.Pool.QueryRow(ctx, `SELECT max(as_of_block) FROM balances WHERE tracked_address_id=$1`, id).Scan(&asOf))
	must(t, st.Pool.QueryRow(ctx, `SELECT balances_refreshed_at FROM tracked_addresses WHERE id=$1`, id).Scan(&at))
	if asOf != 120 || at == nil || time.Since(*at) > time.Minute {
		t.Fatalf("as_of_block %d refreshed_at %v", asOf, at)
	}
	// sweep: only addresses not refreshed within the idle window are due
	due, err := st.DueForSweep(ctx, []string{"base"}, time.Hour, 10)
	must(t, err)
	if len(due) != 0 {
		t.Fatalf("just refreshed but due: %v", due)
	}
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET balances_refreshed_at = now() - interval '2 hours' WHERE id=$1`, id)
	must(t, err)
	due, err = st.DueForSweep(ctx, []string{"base"}, time.Hour, 10)
	must(t, err)
	if len(due) != 1 || due[0] != id {
		t.Fatalf("stale address not due: %v", due)
	}
	if due, _ := st.DueForSweep(ctx, []string{"ethereum"}, time.Hour, 10); len(due) != 0 {
		t.Fatal("sweep crossed chains")
	}
}

type qaNFTSource struct {
	*fakeSource
	pages [][]index.NFT
	fail  bool
}

func (q *qaNFTSource) NFTs(_ context.Context, _, _, cursor string) (index.NFTPage, error) {
	if q.fail {
		return index.NFTPage{}, errors.New("provider 500")
	}
	i := 0
	if cursor != "" {
		i = int(cursor[0] - '0')
	}
	p := index.NFTPage{Items: q.pages[i], AsOfBlock: uint64(200 + i)}
	if i+1 < len(q.pages) {
		p.Cursor = string(rune('0' + i + 1))
	}
	return p, nil
}

func TestQANFTSyncReplaceMediaAndDirty(t *testing.T) {
	ctx, st, _, _, _, ix, _, _ := qaIndexerEnv(t, "indexer_qa_nfts", startNATS(t))
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, _ := st.CreateDevice(ctx, []byte(strings.Repeat("6", 32)), "default", nil)
	_, _, err := st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: A}}, nil, 50)
	must(t, err)
	_, err = ix.RunOneBackfill(ctx)
	must(t, err)
	id, _ := st.TrackedID(ctx, "base", A)
	src := &qaNFTSource{fakeSource: &fakeSource{}, pages: [][]index.NFT{
		{{Contract: NFTC, TokenID: "1", Amount: "1", Standard: "erc721", Name: "One", ImageURL: "https://img.example/1.png"},
			{Contract: NFTC, TokenID: "not-a-number", Amount: "1", Standard: "erc721"}},
		{{Contract: NFTC, TokenID: "2", Amount: "3", Standard: "erc1155", Name: "Two", ImageURL: "ipfs://bafy/2.png"}}}}
	c := &indexer.Chain{Name: "base", Holdings: src}
	must(t, ix.SyncNFTs(ctx, c, id, A))
	must(t, st.NFTsSynced(ctx, id))
	type row struct {
		tok, key, src string
		asOf          int64
	}
	read := func() []row {
		rs, err := st.Pool.Query(ctx, `SELECT token_id::text, COALESCE(media_key,''), COALESCE(image_src,''), COALESCE(as_of_block,0) FROM nft_holdings WHERE tracked_address_id=$1 ORDER BY token_id`, id)
		must(t, err)
		defer rs.Close()
		var out []row
		for rs.Next() {
			var r row
			must(t, rs.Scan(&r.tok, &r.key, &r.src, &r.asOf))
			out = append(out, r)
		}
		return out
	}
	got := read()
	if len(got) != 2 || got[0].tok != "1" || got[1].tok != "2" {
		t.Fatalf("holdings %+v (two pages, malformed token id skipped)", got)
	}
	for _, r := range got {
		if r.key != store.MediaKey(r.src) || len(r.key) != 32 {
			t.Fatalf("media key for %s: %q", r.src, r.key)
		}
		if r.asOf != 201 {
			t.Fatalf("as_of_block %d, want the highest page block 201", r.asOf)
		}
	}
	var dirty bool
	must(t, st.Pool.QueryRow(ctx, `SELECT nft_dirty FROM tracked_addresses WHERE id=$1`, id).Scan(&dirty))
	if dirty {
		t.Fatal("dirty flag not cleared after sync")
	}
	// an NFT moved: the list is flagged; reported as "synced recently" so the caller can resync now
	now, err := st.MarkNFTsMoved(ctx, []int64{id}, time.Hour)
	must(t, err)
	must(t, st.Pool.QueryRow(ctx, `SELECT nft_dirty FROM tracked_addresses WHERE id=$1`, id).Scan(&dirty))
	if !dirty || len(now) != 1 {
		t.Fatalf("MarkNFTsMoved: dirty=%v recent=%v", dirty, now)
	}
	// a provider failure leaves the previous list untouched (no partial replace)
	src.fail = true
	if err := ix.SyncNFTs(ctx, c, id, A); err == nil {
		t.Fatal("provider error swallowed")
	}
	if len(read()) != 2 {
		t.Fatal("failed sync changed the stored list")
	}
	// the token sold: replaced atomically by the new (shorter) list
	src.fail = false
	src.pages = [][]index.NFT{{{Contract: NFTC, TokenID: "2", Amount: "2", Standard: "erc1155", ImageURL: "ipfs://bafy/2.png"}}}
	must(t, ix.SyncNFTs(ctx, c, id, A))
	if g := read(); len(g) != 1 || g[0].tok != "2" {
		t.Fatalf("after sale %+v", g)
	}
}
