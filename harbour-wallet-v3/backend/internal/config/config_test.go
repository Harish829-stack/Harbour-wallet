package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRepoConfig(t *testing.T) {
	c, err := Load("../../config")
	if err != nil {
		t.Fatal(err)
	}
	if c.Chains["base"].BlockTime.Seconds() != 2 || c.Gateway.HedgeMin == 0 || len(c.API.RPCAllowedMethods) == 0 {
		t.Fatalf("unexpected config: %+v", c.Chains["base"])
	}
	env := map[string]string{"ALCHEMY_API_KEY": "a", "INFURA_API_KEY": "i", "INFURA_API_SECRET": "s", "QUICKNODE_BASE_URL": "https://qn/x"}
	ups, skipped := c.Upstreams("base", func(k string) string { return env[k] })
	if len(ups) != 3 || len(skipped) != 3 {
		t.Fatalf("ups=%d skipped=%v", len(ups), skipped)
	}
	if ups[1].Config.Secret != "s" || ups[2].Config.URL != "https://qn/x" || ups[0].Config.Network != "base-mainnet" {
		t.Fatalf("resolved %+v", ups)
	}
}

func TestDotEnvInlineComments(t *testing.T) {
	p := filepath.Join(t.TempDir(), ".env")
	os.WriteFile(p, []byte("HBT_A=alch_x             # optional second key\nHBT_B=BCAb+k2/x==   # secret\nHBT_C=\"quoted # not comment\"\nHBT_D=\n# HBT_E=no\n"), 0o600)
	for _, k := range []string{"HBT_A", "HBT_B", "HBT_C", "HBT_D"} {
		os.Unsetenv(k)
	}
	if err := LoadDotEnv(p); err != nil {
		t.Fatal(err)
	}
	want := map[string]string{"HBT_A": "alch_x", "HBT_B": "BCAb+k2/x==", "HBT_C": "quoted # not comment", "HBT_D": ""}
	for k, v := range want {
		if os.Getenv(k) != v {
			t.Errorf("%s=%q want %q", k, os.Getenv(k), v)
		}
	}
	if _, set := os.LookupEnv("HBT_E"); set {
		t.Error("commented line loaded")
	}
}

func TestEnabledChains(t *testing.T) {
	t.Setenv("ENABLED_CHAINS", "sepolia, base-sepolia")
	c, err := Load("../../config")
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Chains) != 2 || c.Chains["sepolia"].EVMChainID != 11155111 || c.Chains["base-sepolia"].EVMChainID != 84532 {
		t.Fatalf("chains %v", c.ChainNames())
	}
	t.Setenv("ENABLED_CHAINS", "sepolia,nope")
	if _, err := Load("../../config"); err == nil {
		t.Fatal("unknown chain accepted")
	}
}

func TestPublicUpstreamsAndAllChains(t *testing.T) {
	c, err := Load("../../config")
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Chains) < 50 {
		t.Fatalf("expected the full EVM list, got %d chains", len(c.Chains))
	}
	seenID := map[uint64]string{}
	for name, ch := range c.Chains {
		if other, dup := seenID[ch.EVMChainID]; dup {
			t.Errorf("evm chain id %d used by %s and %s", ch.EVMChainID, name, other)
		}
		seenID[ch.EVMChainID] = name
		ups, _ := c.Upstreams(name, func(string) string { return "" })
		ids := map[string]bool{}
		for _, u := range ups {
			if ids[u.Config.ID] {
				t.Errorf("%s: duplicate upstream id %s", name, u.Config.ID)
			}
			ids[u.Config.ID] = true
		}
	}
	ups, _ := c.Upstreams("polygon", func(k string) string { return map[string]string{"ALCHEMY_API_KEY": "a"}[k] })
	var public int
	for _, u := range ups {
		if u.Config.URL != "" && u.Config.Provider == "public" {
			public++
		}
	}
	if public != 2 {
		t.Fatalf("polygon public upstreams = %d, want 2 (%+v)", public, ups)
	}
}
