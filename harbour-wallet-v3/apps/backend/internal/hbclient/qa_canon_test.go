package hbclient

// QA: the Go client signs exactly what the shared golden vectors specify (TEST_PLAN T-BE-087, BE-32). The extension twin is checked
// against the same files in apps/extension/test/qa/canonical-golden.test.js, so the two clients are tied to one spec.

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/devicesig"
)

func TestQAClientSignsGoldenCanonical(t *testing.T) {
	raw, err := os.ReadFile("../devicesig/testdata/canonical_vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Vectors []map[string]string `json:"vectors"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	if len(file.Vectors) < 4 {
		t.Fatalf("only %d golden vectors", len(file.Vectors))
	}
	for _, v := range file.Vectors {
		body, _ := base64.StdEncoding.DecodeString(v["body_b64"])
		want := strings.Split(v["canonical"], "\n")
		date, _ := strconv.ParseInt(v["date"], 10, 64)

		var seen struct {
			canon string
			ok    bool
		}
		c := New("http://placeholder")
		pub := c.Priv.Public().(ed25519.PublicKey)
		c.DeviceID = v["device"]
		c.Now = func() time.Time { return time.Unix(date, 0) }
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			b, _ := io.ReadAll(r.Body)
			canon := devicesig.Canonical(r.Method, r.URL.RequestURI(), r.Header.Get(devicesig.HeaderDate), r.Header.Get(devicesig.HeaderNonce), r.Header.Get(devicesig.HeaderDevice), b)
			seen.canon = canon
			seen.ok = devicesig.Verify(pub, canon, r.Header.Get(devicesig.HeaderSignature)) && devicesig.ValidNonce(r.Header.Get(devicesig.HeaderNonce))
			w.Write([]byte("{}"))
		}))
		c.BaseURL = srv.URL
		var payload any
		if len(body) > 0 {
			payload = body
		}
		if _, err := c.Do(context.Background(), v["method"], v["path_and_query"], payload, nil, nil); err != nil {
			srv.Close()
			t.Fatalf("%s %s: %v", v["method"], v["path_and_query"], err)
		}
		srv.Close()
		got := strings.Split(seen.canon, "\n")
		if len(got) != 7 {
			t.Fatalf("canonical has %d lines: %q", len(got), seen.canon)
		}
		// The nonce is random per request, so compare every other line with the golden string.
		for i, name := range []string{"version", "method", "path", "date", "nonce", "device", "body hash"} {
			if i == 4 {
				continue
			}
			if got[i] != want[i] {
				t.Errorf("%s %s: %s line = %q, golden %q", v["method"], v["path_and_query"], name, got[i], want[i])
			}
		}
		if !seen.ok {
			t.Errorf("%s %s: server could not verify the client's signature", v["method"], v["path_and_query"])
		}
	}
}
