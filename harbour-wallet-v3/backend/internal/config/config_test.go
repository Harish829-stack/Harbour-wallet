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
