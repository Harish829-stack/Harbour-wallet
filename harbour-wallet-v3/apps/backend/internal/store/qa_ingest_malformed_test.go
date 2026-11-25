package store_test

// QA (neg, T-IDX-062 store part): a batch containing one malformed event (negative / non-numeric / fractional / >78-digit
// amount, missing tx hash or event ref, foreign chain) is refused as a whole and writes nothing; valid batches (incl. a 78-digit
// amount) are stored exactly. Garbage address/block-hash text is stored as opaque references (not validated by the store).

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/core/index"
	"harbour/backend/internal/store"
)

func TestQAIngestMalformedBatchRefusedAtomically(t *testing.T) {
	st, ctx := open(t, "qa_ingest_bad")
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("m", 32)), "default", nil)
	ok(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr}}, nil, 10)
	ok(t, err)
	now := time.Now().UTC().Truncate(time.Second)
	ev := func(i int, f func(*index.ActivityEvent)) index.ActivityEvent {
		e := index.ActivityEvent{Chain: "base", Family: "evm", TxHash: fmt.Sprintf("0x%064x", i), EventRef: "log:0", BlockNumber: 100, BlockHash: "0xbh", BlockTime: now,
			From: carolAddr, To: aliceAddr, Asset: "native", AmountRaw: "5", Kind: index.KindNative}
		if f != nil {
			f(&e)
		}
		return e
	}
	batch := []index.ActivityEvent{
		ev(1, nil),
		ev(2, func(e *index.ActivityEvent) { e.AmountRaw = "-5" }),
		ev(3, func(e *index.ActivityEvent) { e.AmountRaw = "1.5" }),
		ev(4, func(e *index.ActivityEvent) { e.AmountRaw = "0x10" }),
		ev(5, func(e *index.ActivityEvent) { e.AmountRaw = "" }),
		ev(6, func(e *index.ActivityEvent) { e.AmountRaw = "1" + strings.Repeat("0", 80) }), // beyond numeric(78,0)
		ev(7, func(e *index.ActivityEvent) { e.TxHash = "" }),
		ev(8, func(e *index.ActivityEvent) { e.EventRef = "" }),
		ev(9, func(e *index.ActivityEvent) { e.Chain = "ethereum" }),
		ev(10, func(e *index.ActivityEvent) { e.From, e.To = "not-an-address", "zz" }),
		ev(11, func(e *index.ActivityEvent) { e.BlockHash = "garbage" }),
		ev(12, func(e *index.ActivityEvent) { e.AmountRaw = strings.Repeat("9", 78) }), // the largest value that fits
		ev(13, nil),
	}
	opts := store.IngestOptions{Chain: "base", Family: "evm", NativeSym: "ETH", NativeDec: 18, Assets: store.NewAssetCache()}
	count := func() (tr, keys, act int) {
		ok(t, st.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM transfers), (SELECT count(*) FROM event_keys), (SELECT count(*) FROM address_activity)`).Scan(&tr, &keys, &act))
		return
	}
	// OBS-10 (fixed): a malformed event is left out and reported (Skipped / OnSkip); the valid events of the same batch are still written.
	for i, bad := range batch {
		if i == 0 || i == 11 || i == 12 || i == 9 || i == 10 {
			continue // valid, or garbage text kept as opaque references (addresses / block hash are not validated here)
		}
		var skipped []string
		o := opts
		o.OnSkip = func(ev index.ActivityEvent, reason string) { skipped = append(skipped, reason) }
		res, err := st.IngestEvents(ctx, o, []index.ActivityEvent{batch[0], bad, batch[12]})
		if err != nil {
			t.Fatalf("batch with malformed event %d failed as a whole: %v", i+1, err)
		}
		if res.Skipped != 1 || len(skipped) != 1 {
			t.Fatalf("event %d: skipped %d (%v), want exactly the malformed one", i+1, res.Skipped, skipped)
		}
		if tr, _, _ := count(); tr != 2 {
			t.Fatalf("event %d: %d transfers, want the 2 valid ones", i+1, tr)
		}
		// reset for the next case
		_, err = st.Pool.Exec(ctx, `TRUNCATE transfers, event_keys, address_activity`)
		ok(t, err)
	}
	_, err = st.IngestEvents(ctx, opts, []index.ActivityEvent{batch[0], batch[9], batch[10], batch[11], batch[12]})
	ok(t, err)
	tr, keys, _ := count()
	var orphan int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM event_keys k WHERE NOT EXISTS (SELECT 1 FROM transfers t WHERE t.tx_hash = k.tx_hash)`).Scan(&orphan))
	if tr != 5 || keys < 5 || orphan != 0 {
		t.Fatalf("valid batch: transfers %d keys %d (orphan %d), want 5 transfers", tr, keys, orphan)
	}
	var max string
	ok(t, st.Pool.QueryRow(ctx, `SELECT amount_raw::text FROM transfers WHERE tx_hash = hb_ref($1)`, fmt.Sprintf("0x%064x", 12)).Scan(&max))
	if max != strings.Repeat("9", 78) {
		t.Fatalf("78-digit amount stored as %s", max)
	}
}
