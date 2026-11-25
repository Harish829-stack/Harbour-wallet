package store_test

import (
	"context"
	"testing"
	"time"

	"harbour/backend/internal/store"
)

// QA (T-GOF-001, the two store functions no test reached): SaveBackfillCursor writes only the named row; PurgeDeliveries deletes
// only deliveries older than the age, reports how many, and is idempotent.
func TestQASaveBackfillCursorTouchesOnlyItsRow(t *testing.T) {
	st, ctx := open(t, "qa_cursor")
	ok(t, mustExec(t, st, ctx, `INSERT INTO tracked_addresses(chain_id, address) VALUES ('base','0x01'), ('base','0x02')`))
	var a, b int64
	ok(t, st.Pool.QueryRow(ctx, `SELECT id FROM tracked_addresses WHERE address='0x01'`).Scan(&a))
	ok(t, st.Pool.QueryRow(ctx, `SELECT id FROM tracked_addresses WHERE address='0x02'`).Scan(&b))
	ok(t, st.SaveBackfillCursor(ctx, a, "cursor-1"))
	ok(t, st.SaveBackfillCursor(ctx, a, "cursor-2")) // overwrite
	var ca, cb *string
	ok(t, st.Pool.QueryRow(ctx, `SELECT backfill_cursor FROM tracked_addresses WHERE id=$1`, a).Scan(&ca))
	ok(t, st.Pool.QueryRow(ctx, `SELECT backfill_cursor FROM tracked_addresses WHERE id=$1`, b).Scan(&cb))
	if ca == nil || *ca != "cursor-2" {
		t.Fatalf("cursor of the named row = %v", ca)
	}
	if cb != nil {
		t.Fatalf("another row's cursor changed: %v", *cb)
	}
	ok(t, st.SaveBackfillCursor(ctx, 999999, "x")) // unknown id: no error, no effect
}

func TestQAPurgeDeliveriesOnlyOld(t *testing.T) {
	st, ctx := open(t, "qa_purge")
	for _, d := range []struct {
		id  string
		age string
	}{{"old-1", "10 days"}, {"old-2", "8 days"}, {"new-1", "1 hour"}, {"new-2", "0 seconds"}} {
		fresh, err := st.InsertDelivery(ctx, "alchemy", d.id, "wh", "base", []byte("{}"))
		ok(t, err)
		if !fresh {
			t.Fatalf("%s already stored", d.id)
		}
		ok(t, mustExec(t, st, ctx, `UPDATE webhook_deliveries SET received_at = now() - $1::interval WHERE delivery_id=$2`, d.age, d.id))
	}
	n, err := st.PurgeDeliveries(ctx, 7*24*time.Hour)
	ok(t, err)
	if n != 2 {
		t.Fatalf("purged %d, want 2", n)
	}
	var left int
	ok(t, st.Pool.QueryRow(ctx, `SELECT count(*) FROM webhook_deliveries`).Scan(&left))
	if left != 2 {
		t.Fatalf("%d deliveries left, want 2", left)
	}
	n, err = st.PurgeDeliveries(ctx, 7*24*time.Hour)
	ok(t, err)
	if n != 0 {
		t.Fatalf("second purge removed %d", n)
	}
	n, err = st.PurgeDeliveries(ctx, 30*time.Minute) // a tighter age also removes the 1-hour-old row
	ok(t, err)
	if n != 1 {
		t.Fatalf("tighter purge removed %d, want 1", n)
	}
}

func mustExec(t *testing.T, st *store.Store, ctx context.Context, sql string, args ...any) error {
	t.Helper()
	_, err := st.Pool.Exec(ctx, sql, args...)
	return err
}
