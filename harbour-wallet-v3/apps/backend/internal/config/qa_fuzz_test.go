package config

// QA: config YAML loader robustness (TEST_PLAN T-BE-096, BE-29). Load must never panic on hostile YAML and must either return an error
// or a usable config. Seeds are the real repo files, so `go test` replays them; run `go test ./internal/config -fuzz=FuzzLoad -fuzztime=60s` to explore.

import (
	"os"
	"path/filepath"
	"testing"
)

func writeCfg(t testing.TB, dir, chains, providers, api string) {
	t.Helper()
	for name, body := range map[string]string{"chains.yaml": chains, "providers.yaml": providers, "api.yaml": api} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

func FuzzLoad(f *testing.F) {
	read := func(n string) string {
		b, err := os.ReadFile(filepath.Join("..", "..", "config", n))
		if err != nil {
			f.Fatal(err)
		}
		return string(b)
	}
	f.Add(read("chains.yaml"), read("providers.yaml"), read("api.yaml"))
	f.Add("", "", "")
	f.Add("chains: [1,2", "providers: {", "api: !!binary x")
	f.Add("chains:\n  base:\n    block_time: -5s\n", "providers: ~\n", "api:\n  rpc_allowed_methods: 7\n")
	f.Add("&a [*a]", "{{{{", "\x00\xff")
	f.Fuzz(func(t *testing.T, chains, providers, api string) {
		os.Unsetenv("ENABLED_CHAINS")
		dir := t.TempDir()
		writeCfg(t, dir, chains, providers, api)
		c, err := Load(dir)
		if err == nil && c == nil {
			t.Fatal("Load returned (nil, nil)")
		}
		if err == nil {
			// A config that loaded must be safe to use.
			_ = c.ChainNames()
			for _, n := range c.ChainNames() {
				c.Upstreams(n, func(string) string { return "" })
			}
		}
	})
}

// T-BE-096: malformed or incomplete input is rejected with an error (not a panic, not a silent empty config).
func TestQALoadRejectsBadInput(t *testing.T) {
	good := func(n string) string {
		b, err := os.ReadFile(filepath.Join("..", "..", "config", n))
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	t.Setenv("ENABLED_CHAINS", "")
	cases := map[string][3]string{
		"broken chains yaml":    {"chains: [1,2", good("providers.yaml"), good("api.yaml")},
		"broken providers yaml": {good("chains.yaml"), "providers: {", good("api.yaml")},
		"broken api yaml":       {good("chains.yaml"), good("providers.yaml"), "api: [:"},
		"wrong type":            {"chains: 7", good("providers.yaml"), good("api.yaml")},
		"binary garbage":        {"\x00\x01\x02", good("providers.yaml"), good("api.yaml")},
	}
	for name, c := range cases {
		dir := t.TempDir()
		writeCfg(t, dir, c[0], c[1], c[2])
		if _, err := Load(dir); err == nil {
			t.Errorf("%s: Load returned no error", name)
		}
	}
	// A missing file is an error naming the problem.
	dir := t.TempDir()
	writeCfg(t, dir, good("chains.yaml"), good("providers.yaml"), good("api.yaml"))
	os.Remove(filepath.Join(dir, "api.yaml"))
	if _, err := Load(dir); err == nil {
		t.Error("missing api.yaml: no error")
	}
	if _, err := Load(filepath.Join(dir, "nope")); err == nil {
		t.Error("missing dir: no error")
	}
}

// T-BE-096: the real config, unmodified, loads (guards the seeds above and the other tests).
func TestQALoadRepoConfigOK(t *testing.T) {
	t.Setenv("ENABLED_CHAINS", "")
	if _, err := Load(filepath.Join("..", "..", "config")); err != nil {
		t.Fatal(err)
	}
}
