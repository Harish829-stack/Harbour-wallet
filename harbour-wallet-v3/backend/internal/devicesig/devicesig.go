// Package devicesig defines how an extension install signs requests to the
// Harbour API with its Ed25519 device key, and the registration
// proof-of-work. The extension-side twin is clients/ts/hbclient.ts; both must
// produce byte-identical canonical strings.
//
// Headers:
//
//	X-HB-Device:    device id returned by POST /v1/devices
//	X-HB-Date:      unix seconds
//	X-HB-Nonce:     16-64 chars [A-Za-z0-9_-], unique per request
//	X-HB-Signature: base64url (no padding) Ed25519 signature of Canonical()
package devicesig

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"math/bits"
	"strconv"
	"strings"
)

// Header names.
const (
	HeaderDevice    = "X-HB-Device"
	HeaderDate      = "X-HB-Date"
	HeaderNonce     = "X-HB-Nonce"
	HeaderSignature = "X-HB-Signature"
)

// Canonical builds the signed string:
//
//	HB1\n<METHOD>\n<path?query>\n<date>\n<nonce>\n<device>\n<hex sha256(body)>
func Canonical(method, pathAndQuery, date, nonce, device string, body []byte) string {
	sum := sha256.Sum256(body)
	return strings.Join([]string{"HB1", strings.ToUpper(method), pathAndQuery, date, nonce, device, hex.EncodeToString(sum[:])}, "\n")
}

// Sign signs a canonical string.
func Sign(priv ed25519.PrivateKey, canonical string) string {
	return B64(ed25519.Sign(priv, []byte(canonical)))
}

// Verify checks a base64url signature.
func Verify(pub ed25519.PublicKey, canonical, sig string) bool {
	raw, err := base64.RawURLEncoding.DecodeString(sig)
	if err != nil || len(raw) != ed25519.SignatureSize || len(pub) != ed25519.PublicKeySize {
		return false
	}
	return ed25519.Verify(pub, []byte(canonical), raw)
}

// B64 encodes base64url without padding.
func B64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

// UnB64 decodes base64url without padding.
func UnB64(s string) ([]byte, error) { return base64.RawURLEncoding.DecodeString(s) }

// ValidNonce checks the nonce format.
func ValidNonce(n string) bool {
	if len(n) < 16 || len(n) > 64 {
		return false
	}
	for _, c := range n {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// RegistrationMessage is what a new device signs to prove it holds the key.
func RegistrationMessage(challenge string) string { return "HB1-register\n" + challenge }

// PowInput is hashed for the registration proof-of-work.
func PowInput(challenge, publicKeyB64, counter string) []byte {
	return []byte(challenge + ":" + publicKeyB64 + ":" + counter)
}

// LeadingZeroBits counts leading zero bits of a hash.
func LeadingZeroBits(h []byte) int {
	n := 0
	for _, b := range h {
		if b == 0 {
			n += 8
			continue
		}
		return n + bits.LeadingZeros8(b)
	}
	return n
}

// CheckPow verifies sha256(PowInput) has at least difficulty leading zero bits.
func CheckPow(challenge, publicKeyB64, counter string, difficulty int) bool {
	if len(counter) == 0 || len(counter) > 20 {
		return false
	}
	h := sha256.Sum256(PowInput(challenge, publicKeyB64, counter))
	return LeadingZeroBits(h[:]) >= difficulty
}

// SolvePow finds a counter (decimal string). Used by tests and cmd/hbdevice.
func SolvePow(challenge, publicKeyB64 string, difficulty int) (string, error) {
	for i := uint64(0); i < 1<<40; i++ {
		c := strconv.FormatUint(i, 10)
		if CheckPow(challenge, publicKeyB64, c, difficulty) {
			return c, nil
		}
	}
	return "", errors.New("pow: no solution")
}
