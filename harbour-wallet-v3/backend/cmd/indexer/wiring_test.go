package main

import (
	"testing"

	"harbour/backend/internal/config"
	"harbour/backend/internal/indexer"
)

// The shipped config must wire every indexed chain to a client, a finality
// policy, a source and holdings, through the registry only.
func TestRepoConfigWiring(t *testing.T) {
	cfg, err := config.Load("../../config")
	if err != nil {
		t.Fatal(err)
	}
	chains, err := indexer.BuildChains(cfg, "http://gateway:8081", "tok", func(k string) string {
		if k == "ALCHEMY_API_KEY" {
			return "k"
		}
		return ""
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"ethereum", "base", "sepolia", "base-sepolia"} {
		c := chains[name]
		if c == nil || c.Client == nil || c.Finality == nil || c.Source == nil || c.Holdings == nil || c.Native.Decimals != 18 {
			t.Fatalf("%s wired wrong: %+v", name, c)
		}
	}
}
