package devicesig

// QA suite for the device-signature protocol (TEST_PLAN: T-BE-021, T-BE-022, T-IDX-044, T-IDX-045, T-IDX-059, T-DATA-011).
// Golden values in testdata/ were computed independently (Python hashlib), not by this package.

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"math/rand"
	"os"
	"strings"
	"testing"
	"testing/quick"
)

type canonVector struct {
	Method, PathAndQuery, Date, Nonce, Device, BodyB64, Canonical string
}

func loadCanon(t *testing.T) []canonVector {
	t.Helper()
	b, err := os.ReadFile("testdata/canonical_vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Vectors []struct {
			Method       string `json:"method"`
			PathAndQuery string `json:"path_and_query"`
			Date         string `json:"date"`
			Nonce        string `json:"nonce"`
			Device       string `json:"device"`
			BodyB64      string `json:"body_b64"`
			Canonical    string `json:"canonical"`
		} `json:"vectors"`
	}
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatal(err)
	}
	var out []canonVector
	for _, v := range f.Vectors {
		out = append(out, canonVector{v.Method, v.PathAndQuery, v.Date, v.Nonce, v.Device, v.BodyB64, v.Canonical})
	}
	return out
}

// T-BE-021 / T-CH-013: Canonical reproduces the spec'd string byte for byte (method upper-cased, body hashed, query kept verbatim).
func TestCanonicalMatchesIndependentGoldenVectors(t *testing.T) {
	for _, v := range loadCanon(t) {
		body, _ := base64.StdEncoding.DecodeString(v.BodyB64)
		if got := Canonical(v.Method, v.PathAndQuery, v.Date, v.Nonce, v.Device, body); got != v.Canonical {
			t.Errorf("Canonical(%s %s) =\n%q\nwant\n%q", v.Method, v.PathAndQuery, got, v.Canonical)
		}
	}
}

// T-BE-021: RFC 8032 section 7.1 TEST 1 (empty message) verifies through Verify, and fails for any other message or a flipped bit.
func TestVerifyRFC8032Test1(t *testing.T) {
	seed, _ := hex.DecodeString("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
	wantPub, _ := hex.DecodeString("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a")
	sig, _ := hex.DecodeString("e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b")
	priv := ed25519.NewKeyFromSeed(seed)
	pub := priv.Public().(ed25519.PublicKey)
	if hex.EncodeToString(pub) != hex.EncodeToString(wantPub) {
		t.Fatalf("public key = %x", pub)
	}
	if got := Sign(priv, ""); got != B64(sig) {
		t.Fatalf("Sign = %s, want RFC 8032 signature", got)
	}
	if !Verify(pub, "", B64(sig)) {
		t.Fatal("RFC 8032 TEST 1 signature rejected")
	}
	if Verify(pub, "x", B64(sig)) {
		t.Fatal("signature accepted for another message")
	}
	bad := append([]byte(nil), sig...)
	bad[0] ^= 1
	if Verify(pub, "", B64(bad)) {
		t.Fatal("tampered signature accepted")
	}
}

// T-BE-021 (negative): malformed encodings and wrong lengths never verify (and never panic).
func TestVerifyRejectsMalformedInputs(t *testing.T) {
	priv := ed25519.NewKeyFromSeed(make([]byte, 32))
	pub := priv.Public().(ed25519.PublicKey)
	good := Sign(priv, "m")
	cases := map[string]struct {
		pub ed25519.PublicKey
		sig string
	}{
		"standard base64 padding":   {pub, base64.StdEncoding.EncodeToString(ed25519.Sign(priv, []byte("m")))},
		"truncated signature":       {pub, good[:len(good)-2]},
		"empty signature":           {pub, ""},
		"non base64":                {pub, strings.Repeat("!", 86)},
		"short public key":          {pub[:31], good},
		"nil public key":            {nil, good},
		"signature with extra byte": {pub, B64(append(ed25519.Sign(priv, []byte("m")), 0))},
	}
	for name, c := range cases {
		if Verify(c.pub, "m", c.sig) {
			t.Errorf("%s: accepted", name)
		}
	}
}

// T-BE-022: for random requests, Verify(Sign(canonical)) holds and any one-byte change to the canonical string fails.
func TestSignVerifyPropertyAndSingleByteMutation(t *testing.T) {
	priv := ed25519.NewKeyFromSeed(sha256.New().Sum(nil))
	pub := priv.Public().(ed25519.PublicKey)
	f := func(method, path, body, nonce string, date uint32, pos uint16) bool {
		c := Canonical(method, path, string(rune('0'+date%10)), nonce, "dev", []byte(body))
		sig := Sign(priv, c)
		if !Verify(pub, c, sig) {
			return false
		}
		b := []byte(c)
		i := int(pos) % len(b)
		b[i] ^= 0x01
		return !Verify(pub, string(b), sig)
	}
	if err := quick.Check(f, &quick.Config{MaxCount: 300, Rand: rand.New(rand.NewSource(1))}); err != nil {
		t.Fatal(err)
	}
}

// T-IDX-045: nonce format boundaries.
func TestValidNonceBoundaries(t *testing.T) {
	cases := map[string]bool{
		strings.Repeat("a", 15):          false,
		strings.Repeat("a", 16):          true,
		strings.Repeat("Z", 64):          true,
		strings.Repeat("9", 65):          false,
		"abcdefghijklmno-":               true,
		"abcdefghijklmno_":               true,
		"abcdefghijklmno=":               false,
		"abcdefghijklmno.":               false,
		"abcdefghijklmnoé":               false,
		"abcdefghijklmno ":               false,
		"":                               false,
		strings.Repeat("a", 15) + "\x00": false,
	}
	for in, want := range cases {
		if got := ValidNonce(in); got != want {
			t.Errorf("ValidNonce(%q) = %v, want %v", in, got, want)
		}
	}
}

type powVector struct {
	Challenge string `json:"challenge"`
	Pub       string `json:"pub"`
	Counter   string `json:"counter"`
	Bits      int    `json:"leading_zero_bits"`
	First12   bool   `json:"first_solution_for_12_bits"`
}

func loadPow(t *testing.T) []powVector {
	t.Helper()
	b, err := os.ReadFile("testdata/pow_vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct{ Vectors []powVector }
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatal(err)
	}
	return f.Vectors
}

// T-IDX-044 / T-DATA-011: leading-zero counts and CheckPow agree with independently computed values.
func TestPowKnownAnswers(t *testing.T) {
	for _, v := range loadPow(t) {
		h := sha256.Sum256(PowInput(v.Challenge, v.Pub, v.Counter))
		if got := LeadingZeroBits(h[:]); got != v.Bits {
			t.Errorf("LeadingZeroBits(%s:%s:%s) = %d, want %d", v.Challenge, v.Pub, v.Counter, got, v.Bits)
		}
		if !CheckPow(v.Challenge, v.Pub, v.Counter, v.Bits) || CheckPow(v.Challenge, v.Pub, v.Counter, v.Bits+1) {
			t.Errorf("CheckPow boundary wrong for %+v", v)
		}
		if v.First12 {
			got, err := SolvePow(v.Challenge, v.Pub, 12)
			if err != nil || got != v.Counter {
				t.Errorf("SolvePow(12) = %q %v, want the first solution %q", got, err, v.Counter)
			}
		}
	}
}

// T-IDX-044: difficulty 0 always passes, 256 bits never does, all-zero hash counts 256, counter length bounds 1..20.
func TestPowBoundaries(t *testing.T) {
	if LeadingZeroBits(make([]byte, 32)) != 256 {
		t.Fatal("all-zero hash must have 256 leading zero bits")
	}
	if LeadingZeroBits([]byte{0x01}) != 7 || LeadingZeroBits([]byte{0x80}) != 0 || LeadingZeroBits([]byte{0x00, 0x10}) != 11 {
		t.Fatal("bit counting is off")
	}
	if !CheckPow("c", "p", "0", 0) {
		t.Fatal("difficulty 0 must accept any counter")
	}
	if CheckPow("c", "p", "0", 257) {
		t.Fatal("difficulty above 256 must be impossible")
	}
	if CheckPow("c", "p", "", 0) || CheckPow("c", "p", strings.Repeat("1", 21), 0) {
		t.Fatal("empty or >20-char counters must be refused regardless of difficulty")
	}
	if !CheckPow("c", "p", strings.Repeat("1", 20), 0) {
		t.Fatal("a 20-char counter is allowed")
	}
}

// T-IDX-059: SolvePow output always satisfies CheckPow for random challenges (low difficulty keeps it fast).
func TestSolvePowProperty(t *testing.T) {
	f := func(ch, pub string, d uint8) bool {
		diff := int(d % 9)
		c, err := SolvePow(ch, pub, diff)
		return err == nil && CheckPow(ch, pub, c, diff)
	}
	if err := quick.Check(f, &quick.Config{MaxCount: 100, Rand: rand.New(rand.NewSource(2))}); err != nil {
		t.Fatal(err)
	}
}

// T-RT/T-BE-023 fuzz target: Verify never panics on arbitrary input.
func FuzzVerify(f *testing.F) {
	f.Add([]byte{}, "", "")
	f.Add(make([]byte, 32), "HB1\nGET\n/v1/me", "AAAA")
	f.Fuzz(func(t *testing.T, pub []byte, canon, sig string) {
		_ = Verify(pub, canon, sig)
	})
}
