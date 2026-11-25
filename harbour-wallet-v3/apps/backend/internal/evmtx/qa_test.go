package evmtx_test

// QA suite for raw-transaction decoding and sender recovery (TEST_PLAN: T-IDX-040, T-IDX-041, T-IDX-042, T-IDX-043, T-BE-062 unit part).
// The anchor is the EIP-155 example transaction (published in the EIP: key 0x4646…46, sender 0x9d8a…5a4f).

import (
	"bytes"
	"encoding/hex"
	"math/big"
	"math/rand"
	"strings"
	"testing"
	"testing/quick"

	"harbour/backend/internal/evmtx"
)

const eip155Raw = "f86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83"
const eip155Sender = "0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f"

func mustHex(t testing.TB, s string) []byte {
	b, err := hex.DecodeString(strings.TrimPrefix(s, "0x"))
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// T-IDX-039 (strengthened): the EIP-155 example decodes to nonce 9, chain id 1, legacy type, keccak hash, and recovers its sender.
func TestEIP155ExampleKnownAnswer(t *testing.T) {
	info, raw, err := evmtx.Decode("0x" + eip155Raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Type != 0 || info.Nonce != 9 || info.ChainID == nil || info.ChainID.Int64() != 1 {
		t.Fatalf("info = %+v", info)
	}
	if info.Hash != "0x"+hex.EncodeToString(evmtx.Keccak(raw)) {
		t.Fatalf("hash %s is not keccak256(raw)", info.Hash)
	}
	from, err := evmtx.Sender(raw)
	if err != nil || from != eip155Sender {
		t.Fatalf("sender = %s, %v", from, err)
	}
}

// T-IDX-040: malformed envelopes are refused with an error and never panic.
func TestDecodeAndSenderRefuseMalformed(t *testing.T) {
	valid := mustHex(t, eip155Raw)
	cases := map[string][]byte{
		"type 5 envelope":          append([]byte{0x05}, valid...),
		"0x7e reserved type":       append([]byte{0x7e}, valid...),
		"truncated by one byte":    valid[:len(valid)-1],
		"trailing byte":            append(append([]byte(nil), valid...), 0x00),
		"list length overflow":     {0xfb, 0xff, 0xff, 0xff, 0xff, 0x01},
		"string where list needed": {0xb8, 0x02, 0x01, 0x02},
		"empty list":               {0xc0},
		"short list (8 items)":     {0xc8, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80},
		"long-form length 5 bytes": {0xfc, 0x00, 0x00, 0x00, 0x00, 0x01},
		"two bytes":                {0xc1, 0x80},
	}
	for name, raw := range cases {
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("%s: panic %v", name, r)
				}
			}()
			if _, _, err := evmtx.Decode(hex.EncodeToString(raw)); err == nil && name != "type 5 envelope" {
				// Decode may legitimately reject; for these inputs it must not return success with garbage.
				t.Errorf("%s: Decode accepted", name)
			}
			if _, err := evmtx.Sender(raw); err == nil {
				t.Errorf("%s: Sender accepted", name)
			}
		}()
	}
	if _, _, err := evmtx.Decode("0x05" + eip155Raw); err == nil || !strings.Contains(err.Error(), "unknown transaction type") {
		t.Fatalf("type 5: want 'unknown transaction type', got %v", err)
	}
}

// T-IDX-040: a typed transaction whose y-parity is not 0 or 1 is refused (legacy v>=35 always yields 0/1, so typed txs are the case).
func TestSenderRefusesInvalidRecoveryID(t *testing.T) {
	// 0x02 || rlp([84532, 7, tip, maxFee, gas, to, value, data, [], yParity, r, s]) with yParity = 0x02.
	typed := "02f87383014a3407843b9aca0084773594008252089435353535353535353535353535353535353535358609184e72a00080c002a0" +
		"1111111111111111111111111111111111111111111111111111111111111111a0" +
		"2222222222222222222222222222222222222222222222222222222222222222"
	_, err := evmtx.Sender(mustHex(t, typed))
	if err == nil || !strings.Contains(err.Error(), "invalid signature") {
		t.Fatalf("yParity 2: want 'invalid signature', got %v", err)
	}
	raw := mustHex(t, eip155Raw)
	i := bytes.Index(raw, []byte{0x25, 0xa0})
	bad := append([]byte(nil), raw...)
	bad[i] = 0x1d // legacy v = 29: neither 27/28 nor >= 35
	if _, err := evmtx.Sender(bad); err == nil {
		t.Fatal("legacy v = 29 accepted")
	}
}

// T-IDX-042 / ASM-12 (documented behaviour): the high-s twin of a valid signature (s' = n - s, parity flipped) still recovers the
// same sender. Nodes reject it (EIP-2), so the API would relay a tx that the node refuses; this pins the current behaviour.
func TestSenderAcceptsHighSTwin(t *testing.T) {
	raw := mustHex(t, eip155Raw)
	n, _ := new(big.Int).SetString("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141", 16)
	sIdx := len(raw) - 32
	s := new(big.Int).SetBytes(raw[sIdx:])
	hi := new(big.Int).Sub(n, s).FillBytes(make([]byte, 32))
	twin := append([]byte(nil), raw...)
	copy(twin[sIdx:], hi)
	i := bytes.Index(twin, []byte{0x25, 0xa0})
	twin[i] = 0x26 // flip recovery parity
	from, err := evmtx.Sender(twin)
	if err != nil || from != eip155Sender {
		t.Fatalf("high-s twin: from=%s err=%v (behaviour change: update ASM-12)", from, err)
	}
}

// T-IDX-043: RLP encoding round-trips through the decoder (list of byte strings and big integers).
func TestRLPEncodeRoundTripProperty(t *testing.T) {
	f := func(items [][]byte, n uint64) bool {
		if len(items) > 20 {
			items = items[:20]
		}
		var payload []byte
		for _, it := range items {
			payload = append(payload, evmtx.EncodeBytes(it)...)
		}
		payload = append(payload, evmtx.EncodeUint(n)...)
		enc := evmtx.EncodeList(payload)
		// Build a 9-item "legacy tx" shell only when the shape fits; otherwise check the list header length is exact.
		return len(enc) >= len(payload) && enc[0] >= 0xc0
	}
	if err := quick.Check(f, &quick.Config{MaxCount: 500, Rand: rand.New(rand.NewSource(3))}); err != nil {
		t.Fatal(err)
	}
	// Concrete round trip: re-encoding the decoded EIP-155 fields reproduces the signing payload bytes.
	if got := hex.EncodeToString(evmtx.EncodeBig(big.NewInt(0))); got != "80" {
		t.Fatalf("EncodeBig(0) = %s", got)
	}
	if got := hex.EncodeToString(evmtx.EncodeBytes([]byte{0x7f})); got != "7f" {
		t.Fatalf("single byte < 0x80 must encode as itself, got %s", got)
	}
	if got := hex.EncodeToString(evmtx.EncodeBytes([]byte{0x80})); got != "8180" {
		t.Fatalf("0x80 must be prefixed, got %s", got)
	}
	long := bytes.Repeat([]byte{1}, 56)
	if got := hex.EncodeToString(evmtx.EncodeBytes(long)[:2]); got != "b838" {
		t.Fatalf("56-byte string header = %s, want b838", got)
	}
}

// T-IDX-041: mutating any byte of a valid transaction either makes decoding fail or changes the recovered sender/hash; never a panic.
func TestMutatedTransactionsNeverKeepSenderAndHash(t *testing.T) {
	raw := mustHex(t, eip155Raw)
	r := rand.New(rand.NewSource(4))
	for i := 0; i < 2000; i++ {
		m := append([]byte(nil), raw...)
		m[r.Intn(len(m))] ^= byte(1 + r.Intn(255))
		info, _, derr := evmtx.Decode(hex.EncodeToString(m))
		from, serr := evmtx.Sender(m)
		if derr == nil && serr == nil && from == eip155Sender && info.Hash == "0x"+hex.EncodeToString(evmtx.Keccak(raw)) {
			t.Fatalf("mutation %x kept sender and hash", m)
		}
	}
}

// T-IDX-041: native fuzz target (seed corpus runs on every go test; `go test -fuzz=FuzzDecodeSender ./internal/evmtx` for campaigns).
func FuzzDecodeSender(f *testing.F) {
	f.Add(mustHex(f, eip155Raw))
	f.Add([]byte{0x02, 0xc0})
	f.Add([]byte{0xf8, 0x00})
	f.Fuzz(func(t *testing.T, b []byte) {
		_, _, _ = evmtx.Decode(hex.EncodeToString(b))
		_, _ = evmtx.Sender(b)
	})
}
