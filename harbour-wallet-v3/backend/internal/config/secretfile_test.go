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
	t.Setenv("HBT_SET", "explicit")
	t.Setenv("HBT_SET_FILE", p)
	if err := LoadSecretFiles(); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("HBT_KEY") != "s3cret" || os.Getenv("HBT_SET") != "explicit" {
		t.Fatalf("got %q %q", os.Getenv("HBT_KEY"), os.Getenv("HBT_SET"))
	}
	t.Setenv("HBT_BAD_FILE", filepath.Join(t.TempDir(), "missing"))
	if LoadSecretFiles() == nil {
		t.Fatal("missing secret file must be an error")
	}
}
