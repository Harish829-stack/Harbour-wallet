package store_test

import (
	"crypto/rand"
	"errors"
	"testing"
	"time"

	"harbour/backend/internal/store"
)

// Ramp orders (migration 0011): insert, list, webhook ordering guard, terminal states, unknown ids.
func TestRampOrdersLifecycle(t *testing.T) {
	st, ctx := open(t, "ramps")
	pub := make([]byte, 32)
	_, _ = rand.Read(pub)
	dev, err := st.CreateDevice(ctx, pub, "default", nil)
	ok(t, err)
	amt := 100.0
	id := "6f9619ff-8b86-4d11-b42d-00c04fc964ff"
	ok(t, st.InsertRampOrder(ctx, store.RampOrder{ID: id, DeviceID: dev.ID, Type: "buy", Provider: "banxa", PaymentMethod: "creditcard",
		Chain: "base", Crypto: "usdc_base", Fiat: "eur", FiatAmount: &amt}))
	ok(t, st.SetRampOrderSession(ctx, id, "S1"))
	n, err := st.CountRecentRampOrders(ctx, dev.ID, time.Now().Add(-time.Hour))
	ok(t, err)
	if n != 1 {
		t.Fatalf("count %d", n)
	}
	t0 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	out := 99.5
	applied, err := st.ApplyRampUpdate(ctx, store.RampUpdate{OrderID: id, Status: "pending", StatusAt: t0, OnramperTxID: "01H", CryptoAmount: &out})
	ok(t, err)
	if !applied {
		t.Fatal("first update not applied")
	}
	// an older delivery arriving late is ignored
	applied, err = st.ApplyRampUpdate(ctx, store.RampUpdate{OrderID: id, Status: "failed", StatusAt: t0.Add(-time.Minute)})
	ok(t, err)
	if applied {
		t.Fatal("stale update applied")
	}
	applied, err = st.ApplyRampUpdate(ctx, store.RampUpdate{OrderID: id, Status: "completed", StatusAt: t0.Add(time.Minute), TxHash: "0xabc"})
	ok(t, err)
	if !applied {
		t.Fatal("completion not applied")
	}
	// nothing leaves a terminal status, even a newer delivery
	applied, err = st.ApplyRampUpdate(ctx, store.RampUpdate{OrderID: id, Status: "pending", StatusAt: t0.Add(time.Hour)})
	ok(t, err)
	if applied {
		t.Fatal("terminal status left")
	}
	rows, err := st.DeviceRampOrders(ctx, dev.ID, 10)
	ok(t, err)
	if len(rows) != 1 || rows[0].Status != "completed" || rows[0].TxHash != "0xabc" || rows[0].OnramperTxID != "01H" || rows[0].Session != "S1" ||
		rows[0].CryptoAmount == nil || *rows[0].CryptoAmount != 99.5 || rows[0].FiatAmount == nil || *rows[0].FiatAmount != 100 {
		t.Fatalf("%+v", rows)
	}
	for _, bad := range []string{"6f9619ff-8b86-4d11-b42d-000000000000", "not-a-uuid", "'; drop table ramp_orders; --"} {
		if _, err := st.ApplyRampUpdate(ctx, store.RampUpdate{OrderID: bad, Status: "pending", StatusAt: t0}); !errors.Is(err, store.ErrNotFound) {
			t.Fatalf("%q: %v", bad, err)
		}
	}
	// a checkout that failed to open is removed; one with a session is kept
	id2 := "6f9619ff-8b86-4d11-b42d-00c04fc96500"
	ok(t, st.InsertRampOrder(ctx, store.RampOrder{ID: id2, DeviceID: dev.ID, Type: "sell", Provider: "banxa", PaymentMethod: "sepabanktransfer", Chain: "ethereum", Crypto: "eth", Fiat: "eur"}))
	ok(t, st.DeleteRampOrder(ctx, id2))
	ok(t, st.DeleteRampOrder(ctx, id))
	rows, err = st.DeviceRampOrders(ctx, dev.ID, 10)
	ok(t, err)
	if len(rows) != 1 {
		t.Fatalf("after delete: %d rows", len(rows))
	}
}
