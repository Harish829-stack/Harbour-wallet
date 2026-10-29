package api

import (
	"testing"
	"time"

	"harbour/backend/internal/config"
)

// A new default-tier device is held to the probation tier for ProbationPeriod; hand-set tiers are never lowered (audit V3-08).
func TestEffectiveTierProbation(t *testing.T) {
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	s := &Server{cfg: &config.Config{API: config.API{DefaultTier: "default", ProbationTier: "probation", ProbationPeriod: 24 * time.Hour}}}
	if got := s.effectiveTier("default", now.Add(-time.Hour), now); got != "probation" {
		t.Fatalf("fresh device: got %q", got)
	}
	if got := s.effectiveTier("default", time.Time{}, now); got != "probation" {
		t.Fatalf("unknown creation time counts as fresh: got %q", got)
	}
	if got := s.effectiveTier("default", now.Add(-25*time.Hour), now); got != "default" {
		t.Fatalf("after probation: got %q", got)
	}
	if got := s.effectiveTier("trusted", now.Add(-time.Minute), now); got != "trusted" {
		t.Fatalf("hand-set tier must not be lowered: got %q", got)
	}
	off := &Server{cfg: &config.Config{API: config.API{DefaultTier: "default"}}}
	if got := off.effectiveTier("default", now, now); got != "default" {
		t.Fatalf("probation disabled: got %q", got)
	}
}
