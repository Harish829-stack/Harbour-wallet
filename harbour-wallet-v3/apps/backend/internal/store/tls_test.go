package store

import "testing"

// HW-2026-007: non-loopback databases must use verified TLS.
func TestRequireTLS(t *testing.T) {
	t.Setenv("HB_ALLOW_INSECURE_DB", "")
	cases := []struct {
		host              string
		plain, unverified bool
		ok                bool
	}{
		{"db.internal", false, false, true}, // verify-full
		{"db.internal", true, false, false}, // sslmode=disable
		{"db.internal", false, true, false}, // sslmode=require (no verification)
		{"postgres", true, false, false},    // compose host name, plain
		{"localhost", true, false, true},
		{"127.0.0.1", true, false, true},
		{"::1", false, true, true},
		{"/var/run/postgresql", true, false, true},
	}
	for _, c := range cases {
		if err := requireTLS(c.host, c.plain, c.unverified); (err == nil) != c.ok {
			t.Errorf("requireTLS(%q, plain=%v, unverified=%v) = %v, want ok=%v", c.host, c.plain, c.unverified, err, c.ok)
		}
	}
	t.Setenv("HB_ALLOW_INSECURE_DB", "1")
	if err := requireTLS("db.internal", true, false); err != nil {
		t.Errorf("override ignored: %v", err)
	}
}
