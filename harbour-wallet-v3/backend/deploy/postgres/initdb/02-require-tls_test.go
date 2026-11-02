package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestRequireTLSHBA(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "pg_hba.conf")
	initial := "# host all all all trust\nlocal all all trust\nhost all all 127.0.0.1/32 trust\nhostssl all all 10.0.0.0/8 scram-sha-256\nhost all all all scram-sha-256\n"
	if err := os.WriteFile(path, []byte(initial), 0600); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		cmd := exec.Command("sh", "02-require-tls.sh")
		cmd.Env = append(os.Environ(), "PGDATA="+dir)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("rule failed: %v: %s", err, out)
		}
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	want := strings.ReplaceAll(initial, "host all", "hostssl all")
	want = strings.Replace(want, "# hostssl all", "# host all", 1)
	if string(got) != want {
		t.Fatalf("pg_hba.conf mismatch:\n%s", got)
	}
}
