package gateway

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestCacheBoundedByBytes(t *testing.T) {
	c := newCache(1000)
	c.maxBytes, c.maxEntry = 4096, 1024
	big := json.RawMessage(`"` + strings.Repeat("a", 900) + `"`)
	for i := 0; i < 50; i++ {
		c.put(strings.Repeat("k", i+1), big, time.Minute, true)
	}
	if c.bytes > c.maxBytes || c.len() > 5 {
		t.Fatalf("cache over budget: %d bytes, %d entries", c.bytes, c.len())
	}
	c.put("huge", json.RawMessage(`"`+strings.Repeat("b", 2000)+`"`), time.Minute, false)
	if _, ok := c.get("huge"); ok {
		t.Fatal("oversized entry cached")
	}
}
