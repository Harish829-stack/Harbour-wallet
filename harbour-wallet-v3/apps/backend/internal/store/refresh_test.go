package store_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/store"
)

// LastHeartbeat reads without writing; GapRowFor finds one synced tracked address (any case) and nothing else.
func TestLastHeartbeatAndGapRowFor(t *testing.T) {
	st, ctx := open(t, "store_refresh")

	if last, err := st.LastHeartbeat(ctx, "svc"); err != nil || !last.IsZero() {
		t.Fatalf("no beat yet: %v %v", last, err)
	}
	if last, _ := st.LastHeartbeat(ctx, "svc"); !last.IsZero() {
		t.Fatal("LastHeartbeat must not write a beat")
	}
	at := time.Now().Add(-time.Hour).Truncate(time.Millisecond)
	_, err := st.Heartbeat(ctx, "svc", at)
	ok(t, err)
	if last, err := st.LastHeartbeat(ctx, "svc"); err != nil || !last.Equal(at) {
		t.Fatalf("beat: got %v want %v (%v)", last, at, err)
	}

	if _, err := st.GapRowFor(ctx, "base", aliceAddr); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("untracked: %v", err)
	}
	lc, _ := store.NewLinkCrypto([]byte(strings.Repeat("k", 32)))
	dev, err := st.CreateDevice(ctx, []byte(strings.Repeat("r", 32)), "default", nil)
	ok(t, err)
	_, _, err = st.AddDeviceAddresses(ctx, lc, dev.ID, []store.AddressRef{{Chain: "base", Address: aliceAddr}}, nil, 10)
	ok(t, err)
	if _, err := st.GapRowFor(ctx, "base", aliceAddr); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("still backfilling must not be returned: %v", err)
	}
	_, err = st.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_state='done', last_seen_block=42`)
	ok(t, err)
	r, err := st.GapRowFor(ctx, "base", strings.ToUpper(aliceAddr[:2])+strings.ToUpper(aliceAddr[2:]))
	ok(t, err)
	if r.Address != aliceAddr || r.LastSeen != 42 || r.ID == 0 {
		t.Fatalf("row %+v", r)
	}
	if _, err := st.GapRowFor(ctx, "ethereum", aliceAddr); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("other chain: %v", err)
	}
}

// NoteBlock keeps the highest block per address and works on a zero IngestResult.
func TestIngestResultNoteBlock(t *testing.T) {
	var r store.IngestResult
	r.NoteBlock(7, 10)
	r.NoteBlock(7, 9)
	r.NoteBlock(8, 3)
	if r.AtBlock[7] != 10 || r.AtBlock[8] != 3 {
		t.Fatalf("%v", r.AtBlock)
	}
}
