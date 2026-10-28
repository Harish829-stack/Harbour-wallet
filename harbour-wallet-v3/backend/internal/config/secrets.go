package config

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

// DecodeKey accepts a hex or base64 secret of at least minLen bytes.
func DecodeKey(name, v string, minLen int) ([]byte, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil, fmt.Errorf("%s is not set (run scripts/gen-secrets.sh)", name)
	}
	if b, err := hex.DecodeString(v); err == nil && len(b) >= minLen {
		return b, nil
	}
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if b, err := enc.DecodeString(v); err == nil && len(b) >= minLen {
			return b, nil
		}
	}
	return nil, fmt.Errorf("%s must be hex or base64 of at least %d bytes", name, minLen)
}
