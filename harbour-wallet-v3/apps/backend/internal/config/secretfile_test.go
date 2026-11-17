package config

import (
	"os"
	"path/filepath"
	"testing"
)

// HW-2026-002: NAME_FILE loads a mounted secret into NAME; an explicit NAME wins.
func TestLoadSecretFiles(t *testing.T) {
	p := filepath.Join(t.TempDir(), "k")
	if err := os.WriteFile(p, []byte("s3cret\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HBT_KEY", "")
	os.Unsetenv("HBT_KEY")
	t.Setenv("HBT_KEY_FILE", p)
	t.Setenv("HBT_SET_TOKEN", "explicit")
	t.Setenv("HBT_SET_TOKEN_FILE", p)
	if err := LoadSecretFiles(); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("HBT_KEY") != "s3cret" || os.Getenv("HBT_SET_TOKEN") != "explicit" {
		t.Fatalf("got %q %q", os.Getenv("HBT_KEY"), os.Getenv("HBT_SET_TOKEN"))
	}
	t.Setenv("HBT_BAD_KEY_FILE", filepath.Join(t.TempDir(), "missing"))
	if LoadSecretFiles() == nil {
		t.Fatal("missing secret file must be an error")
	}
}

// Finding 25: a *_FILE variable that belongs to other software is left alone: not read into the environment, and never a reason
// to refuse to start (PIP_CONFIG_FILE pointing at a missing file made every service exit before this).
func TestLoadSecretFilesIgnoresForeignVariables(t *testing.T) {
	p := filepath.Join(t.TempDir(), "conf")
	if err := os.WriteFile(p, []byte("not a harbour secret\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"PIP_CONFIG", "SSL_CERT", "GIT_CONFIG", "FCM_CREDENTIALS"} {
		os.Unsetenv(name)
		t.Cleanup(func() { os.Unsetenv(name) })
	}
	t.Setenv("PIP_CONFIG_FILE", filepath.Join(t.TempDir(), "missing"))
	t.Setenv("SSL_CERT_FILE", p)
	t.Setenv("GIT_CONFIG_FILE", p)
	t.Setenv("FCM_CREDENTIALS_FILE", p)
	if err := LoadSecretFiles(); err != nil {
		t.Fatalf("a foreign *_FILE variable stopped startup: %v", err)
	}
	for _, name := range []string{"PIP_CONFIG", "SSL_CERT", "GIT_CONFIG", "FCM_CREDENTIALS"} {
		if v, set := os.LookupEnv(name); set {
			t.Errorf("%s was read into the environment (%d bytes)", name, len(v))
		}
	}
	for _, name := range []string{"ALCHEMY_API_KEY_2", "PG_PW_API", "NATS_PW_REALTIME", "POSTGRES_URL", "CENTRIFUGO_TOKEN_HMAC_SECRET", "REDIS_PASSWORD",
		"GATEWAY_INTERNAL_TOKEN", "ALCHEMY_WEBHOOK_SIGNING_KEYS", "POSTGRES_SERVICE_USERS", "CONFIG_JSON", "CONFIG_SIG", "ADDRESS_LINK_ENCRYPTION_KEY"} {
		if !secretName.MatchString(name) {
			t.Errorf("%s_FILE would no longer be resolved", name)
		}
	}
}
