package store_test

// QA (property, T-IDX-018): random event batches — duplicates across and within batches, shuffled, native and token, amounts up
// to 2^200 — are ingested; per tracked address and asset the stored Σin − Σout equals the oracle over UNIQUE events, every amount
// is exact, and address_activity has one row per (address, tx).

import (
	"fmt"
	"math/big"
	"math/rand"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/store"
)

func TestQAIngestProjectionProperty(t *testing.T) {
	st, ctx := open(t, "qa_ingest_prop")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("p", 32)), "default", nil)
	ok(t, err)
	addrs := []string{aliceAddr, bobAddr, carolAddr}
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr}, {Chain: "base", Address: bobAddr}}, nil, 10)
	ok(t, err)
	tokens := []string{"native", "0x00000000000000000000000000000000000000a1", "0x00000000000000000000000000000000000000a2"}
	rng := rand.New(rand.NewSource(18))
	now := time.Now().UTC().Truncate(time.Second)
	type key struct{ tx, ref string }
	unique := map[key]index.ActivityEvent{}
	var pool []index.ActivityEvent
	for i := 0; i < 200; i++ {
		from, to := addrs[rng.Intn(3)], addrs[rng.Intn(3)]
		asset := tokens[rng.Intn(3)]
		kind := index.KindToken
		if asset == "native" {
			kind = index.KindNative
		}
		amt := new(big.Int).Rand(rng, new(big.Int).Lsh(big.NewInt(1), uint(1+rng.Intn(200))))
		ev := index.ActivityEvent{Chain: "base", Family: "evm", TxHash: fmt.Sprintf("0x%064x", rng.Intn(120)), EventRef: fmt.Sprintf("log:%d", rng.Intn(3)),
			BlockNumber: uint64(100 + rng.Intn(50)), BlockHash: "0xbh", BlockTime: now.Add(-time.Duration(rng.Intn(48)) * time.Hour), From: from, To: to, Asset: asset, AmountRaw: amt.String(), Kind: kind}
		k := key{ev.TxHash, ev.EventRef}
		if prev, dup := unique[k]; dup {
			ev = prev // a provider re-sends the same event (same content)
		} else {
			unique[k] = ev
		}
		pool = append(pool, ev, ev) // every event twice
	}
	rng.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	for i := 0; i < len(pool); i += 37 {
		end := i + 37
		if end > len(pool) {
			end = len(pool)
		}
		_, err := st.IngestEvents(ctx, store.IngestOptions{Chain: "base", Family: "evm", NativeSym: "ETH", NativeDec: 18, Assets: store.NewAssetCache()}, pool[i:end])
		ok(t, err)
	}
	var n int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM transfers`).Scan(&n))
	if n != len(unique) {
		t.Fatalf("%d transfer rows for %d unique events", n, len(unique))
	}
	for _, a := range addrs {
		for _, asset := range tokens {
			want := new(big.Int)
			for _, e := range unique {
				if e.Asset != asset {
					continue
				}
				v, _ := new(big.Int).SetString(e.AmountRaw, 10)
				if strings.EqualFold(e.To, a) {
					want.Add(want, v)
				}
				if strings.EqualFold(e.From, a) {
					want.Sub(want, v)
				}
			}
			var got string
			ok(t, st.Pool.QueryRow(ctx, `SELECT (COALESCE(sum(t.amount_raw) FILTER (WHERE t."to" = hb_ref($1)), 0) - COALESCE(sum(t.amount_raw) FILTER (WHERE t."from" = hb_ref($1)), 0))::text
				FROM transfers t JOIN assets s ON s.id = t.asset_id WHERE (s.kind = 'native') = ($2 = 'native') AND ($2 = 'native' OR s.asset_ref = hb_ref($2))`, a, asset).Scan(&got))
			if got != want.String() {
				t.Fatalf("%s %s: stored net %s, oracle %s", a, asset, got, want)
			}
		}
	}
	// activity: one row per (tracked address, tx) touching it
	wantAct := map[string]bool{}
	for _, e := range unique {
		for _, tr := range []string{aliceAddr, bobAddr} {
			if strings.EqualFold(e.From, tr) || strings.EqualFold(e.To, tr) {
				wantAct[tr+e.TxHash] = true
			}
		}
	}
	var act, dupAct int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM address_activity`).Scan(&act))
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM (SELECT tracked_address_id, tx_hash FROM address_activity GROUP BY 1,2 HAVING count(*) > 1) d`).Scan(&dupAct))
	if dupAct != 0 || act != len(wantAct) {
		t.Fatalf("activity rows %d (dup %d), want %d", act, dupAct, len(wantAct))
	}
}
