package webpush

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"harbour/backend/contracttest"
	"harbour/backend/internal/core/notify"
)

// RFC 8291 Appendix A.
func TestRFC8291Vector(t *testing.T) {
	d := func(s string) []byte {
		b, err := decodeB64(s)
		if err != nil {
			t.Fatal(err)
		}
		return b
	}
	asPriv, _ := ecdh.P256().NewPrivateKey(d("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"))
	uaPriv, _ := ecdh.P256().NewPrivateKey(d("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"))
	auth, salt := d("BTBZMqHH6r4Tts7J_aSIgg"), d("DGv6ra1nlYgDCS1FRnbzlw")
	shared, _ := asPriv.ECDH(uaPriv.PublicKey())
	body, err := seal(shared, auth, uaPriv.PublicKey().Bytes(), asPriv.PublicKey().Bytes(), salt, []byte("When I grow up, I want to be a watermelon"))
	if err != nil {
		t.Fatal(err)
	}
	want := "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
	if got := b64.EncodeToString(body); got != want {
		t.Fatalf("body mismatch\n got %s\nwant %s", got, want)
	}
	pt, err := Decrypt(uaPriv, auth, body)
	if err != nil || string(pt) != "When I grow up, I want to be a watermelon" {
		t.Fatalf("decrypt %q %v", pt, err)
	}
}

// Send posts an encrypted body with VAPID auth; 410 means gone.
func TestSend(t *testing.T) {
	priv, pub, err := GenerateKeys()
	if err != nil {
		t.Fatal(err)
	}
	ua, _ := ecdh.P256().GenerateKey(rand.Reader)
	auth := make([]byte, 16)
	rand.Read(auth)
	var got []byte
	var hdr http.Header
	status := http.StatusCreated
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, _ = io.ReadAll(r.Body)
		hdr = r.Header
		w.WriteHeader(status)
	}))
	defer srv.Close()
	ch, err := New(map[string]string{"private_key": priv, "subject": "mailto:test@example.com", "allow_private": "true"})
	if err != nil {
		t.Fatal(err)
	}
	var sub Subscription
	sub.Endpoint = srv.URL + "/push/abc"
	sub.Keys.P256dh = b64.EncodeToString(ua.PublicKey().Bytes())
	sub.Keys.Auth = b64.EncodeToString(auth)
	tok, _ := json.Marshal(sub)
	target := notify.Target{Channel: Name, Token: string(tok)}
	if err := ch.Send(context.Background(), target, notify.Message{Title: "Received 1 ETH", Data: map[string]string{"tx_hash": "0x1"}}); err != nil {
		t.Fatal(err)
	}
	if hdr.Get("Content-Encoding") != "aes128gcm" || !strings.Contains(hdr.Get("Authorization"), "k="+pub) {
		t.Fatalf("headers %v", hdr)
	}
	pt, err := Decrypt(ua, auth, got)
	if err != nil || !strings.Contains(string(pt), `"title":"Received 1 ETH"`) {
		t.Fatalf("payload %s %v", pt, err)
	}
	status = http.StatusGone
	if err := ch.Send(context.Background(), target, notify.Message{Title: "x"}); err == nil {
		t.Fatal("expected gone")
	} else if _, ok := err.(notify.ErrGone); !ok {
		t.Fatalf("want ErrGone, got %v", err)
	}
	// Private destinations are refused without the test flag.
	strict, _ := New(map[string]string{"private_key": priv})
	if err := strict.Send(context.Background(), target, notify.Message{Title: "x"}); err == nil {
		t.Fatal("private endpoint accepted")
	}
}

func TestNotifyContract(t *testing.T) {
	priv, _, _ := GenerateKeys()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/gone") {
			w.WriteHeader(http.StatusGone)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()
	ch, _ := New(map[string]string{"private_key": priv, "allow_private": "true"})
	ua, _ := ecdh.P256().GenerateKey(rand.Reader)
	target := func(path string) notify.Target {
		var s Subscription
		s.Endpoint = srv.URL + path
		s.Keys.P256dh = b64.EncodeToString(ua.PublicKey().Bytes())
		s.Keys.Auth = b64.EncodeToString(make([]byte, 16))
		b, _ := json.Marshal(s)
		return notify.Target{Channel: Name, Token: string(b)}
	}
	contracttest.RunNotifyChannel(t, ch, target("/live"), target("/gone"))
}
