package store

// QA unit suite for at-rest crypto (TEST_PLAN: T-IDX-046, T-IDX-047, T-IDX-048, T-IDX-049, T-IDX-052, T-IDX-017 validAmount).

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"math/rand"
	"strings"
	"testing"
	"testing/quick"
)

const devA = "123e4567-e89b-12d3-a456-426614174000"
const devB = "123e4567-e89b-12d3-a456-426614174001"

func newLC(t *testing.T) *LinkCrypto {
	t.Helper()
	lc, err := NewLinkCrypto([]byte(strings.Repeat("s", 32)))
	if err != nil {
		t.Fatal(err)
	}
	return lc
}

// T-IDX-046: link blobs round-trip only for the device they were sealed for; tampering and truncation fail; short secrets refused.
func TestLinkCryptoSealOpenBinding(t *testing.T) {
	lc := newLC(t)
	blob, err := lc.seal(devA, 42)
	if err != nil {
		t.Fatal(err)
	}
	if id, err := lc.open(devA, blob); err != nil || id != 42 {
		t.Fatalf("open = %d, %v", id, err)
	}
	if _, err := lc.open(devB, blob); err == nil {
		t.Fatal("a link sealed for device A opened for device B (AAD not bound)")
	}
	bad := append([]byte(nil), blob...)
	bad[len(bad)-1] ^= 1
	if _, err := lc.open(devA, bad); err == nil {
		t.Fatal("tampered blob opened")
	}
	if _, err := lc.open(devA, blob[:5]); err == nil {
		t.Fatal("short blob opened")
	}
	if _, err := NewLinkCrypto(make([]byte, 31)); err == nil {
		t.Fatal("31-byte secret accepted")
	}
	other, _ := NewLinkCrypto([]byte(strings.Repeat("t", 32)))
	if _, err := other.open(devA, blob); err == nil {
		t.Fatal("blob opened under another secret")
	}
}

// T-IDX-048: random (device, id) pairs round-trip and every seal uses a fresh nonce.
func TestLinkCryptoRoundTripProperty(t *testing.T) {
	lc := newLC(t)
	f := func(id int64, a, b, c uint32) bool {
		dev := hex.EncodeToString([]byte{byte(a), byte(b), byte(c)})
		b1, err1 := lc.seal(dev, id)
		b2, err2 := lc.seal(dev, id)
		if err1 != nil || err2 != nil || string(b1) == string(b2) {
			return false
		}
		got, err := lc.open(dev, b1)
		return err == nil && got == id
	}
	if err := quick.Check(f, &quick.Config{MaxCount: 500, Rand: rand.New(rand.NewSource(6))}); err != nil {
		t.Fatal(err)
	}
}

// T-IDX-047: Redis/route tags are keyed, deterministic, domain-separated and never contain the raw id.
func TestLinkCryptoTagsDomainSeparated(t *testing.T) {
	lc := newLC(t)
	d1, d2 := lc.DeviceTag(devA), lc.DeviceTag(devA)
	k := lc.KeyTag(devA)
	if d1 != d2 {
		t.Fatal("DeviceTag not deterministic")
	}
	if d1 == k {
		t.Fatal("DeviceTag and KeyTag collide for the same input (no domain separation)")
	}
	if len(d1) != 32 || len(k) != 32 || strings.Contains(d1, "123e4567") {
		t.Fatalf("tag shape: %q %q", d1, k)
	}
	if lc.DeviceTag(devA) == lc.DeviceTag(devB) {
		t.Fatal("different devices share a tag")
	}
	other, _ := NewLinkCrypto([]byte(strings.Repeat("t", 32)))
	if other.DeviceTag(devA) == d1 {
		t.Fatal("tag does not depend on the secret")
	}
	if string(lc.RouteTag(1)) == string(lc.RouteTag(2)) || len(lc.RouteTag(1)) != 32 {
		t.Fatal("route tags must be 32-byte and distinct per id")
	}
	if hex.EncodeToString(lc.linkHash(devA, 7)) == hex.EncodeToString(lc.RouteTag(7)) {
		t.Fatal("link hash and route tag collide")
	}
}

// T-IDX-049: SecretBox round trip, tamper detection, label separation, short secret.
func TestSecretBox(t *testing.T) {
	sec := []byte(strings.Repeat("w", 32))
	b1, _ := NewSecretBox(sec, "webhooks")
	b2, _ := NewSecretBox(sec, "other")
	blob, err := b1.Seal("signing-key")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := b1.Open(blob); err != nil || got != "signing-key" {
		t.Fatalf("open = %q %v", got, err)
	}
	if _, err := b2.Open(blob); err == nil {
		t.Fatal("blob opened under another label")
	}
	blob[len(blob)-1] ^= 1
	if _, err := b1.Open(blob); err == nil {
		t.Fatal("tampered blob opened")
	}
	if _, err := NewSecretBox(sec[:31], "x"); err == nil {
		t.Fatal("short secret accepted")
	}
}

// T-IDX-052: the primitives LinkCrypto composes match published vectors (RFC 4231 test case 2; NIST GCM test case 3, AES-128 is
// replaced by AES-256 test case 15 from the GCM spec) so a library swap cannot silently change the at-rest format.
func TestPrimitivesKnownAnswers(t *testing.T) {
	m := hmac.New(sha256.New, []byte("Jefe"))
	m.Write([]byte("what do ya want for nothing?"))
	if got := hex.EncodeToString(m.Sum(nil)); got != "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843" {
		t.Fatalf("HMAC-SHA256 RFC 4231 case 2 = %s", got)
	}
	key, _ := hex.DecodeString("feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308")
	iv, _ := hex.DecodeString("cafebabefacedbaddecaf888")
	pt, _ := hex.DecodeString("d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255")
	want := "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad" + "b094dac5d93471bdec1a502270e3cc6c"
	blk, _ := aes.NewCipher(key)
	g, _ := cipher.NewGCM(blk)
	if got := hex.EncodeToString(g.Seal(nil, iv, pt, nil)); got != want {
		t.Fatalf("AES-256-GCM test case 15 = %s", got)
	}
}

// T-IDX-017: amount validation for ingested events.
func TestValidAmount(t *testing.T) {
	cases := map[string]bool{"0": true, "5": true, strings.Repeat("9", 78): true, "-1": false, "1.5": false, "abc": false, "": false, "0x10": false, "1e3": false}
	for in, want := range cases {
		if got := validAmount(in); got != want {
			t.Errorf("validAmount(%q) = %v, want %v", in, got, want)
		}
	}
}
