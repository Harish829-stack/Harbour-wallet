package indexer

// QA (be-unit, T-IDX-025 = backend part of T-UX-014): SpamScore on airdrop-style names, URLs, zero-width characters, look-alike
// scripts, missing decimals and long symbols; bounded to 0..100; real tokens score below the 50 hide threshold.

import (
	"math/rand"
	"testing"
)

func TestQASpamScore(t *testing.T) {
	d18, d6, d0 := 18, 6, 0
	clean := []struct {
		sym, name string
		dec       *int
	}{{"USDC", "USD Coin", &d6}, {"WETH", "Wrapped Ether", &d18}, {"stETH", "Liquid staked Ether 2.0", &d18}, {"PUNK", "CryptoPunks", &d0}, {"€URe", "Monerium EUR emoney", &d18}}
	for _, c := range clean {
		if s := SpamScore(c.sym, c.name, c.dec); s >= 50 {
			t.Errorf("%s / %s scored %d (would be hidden)", c.sym, c.name, s)
		}
	}
	spam := []struct {
		sym, name string
		dec       *int
	}{
		{"Visit claim-usdc.com", "Claim rewards", &d18},
		{"$ Reward", "Visit www.airdrop.xyz to claim", &d18},
		{"t.me/freegift", "Free giveaway", &d0},
		{"USDС", "USD Coin airdrop", &d6},            // Cyrillic С + airdrop word
		{"ETH-REWARDS.COM", "eligible voucher", nil}, // URL + words + no decimals
		{"", "", nil},
	}
	for _, c := range spam {
		if s := SpamScore(c.sym, c.name, c.dec); s < 50 {
			t.Errorf("%q / %q scored %d, want ≥ 50", c.sym, c.name, s)
		}
	}
	// OBS-09 (fixed): a zero-width character alone hides the token, and so does a look-alike ticker with one foreign letter
	if s := SpamScore("USDC", "USD\u200bCoin", &d6); s < 50 {
		t.Errorf("zero-width only: %d, want ≥ 50", s)
	}
	if s := SpamScore("USDС", "USD Coin", &d6); s < 50 {
		t.Errorf("Cyrillic look-alike ticker alone: %d, want ≥ 50", s)
	}
	if s := SpamScore("ABC", "中文代币", &d18); s >= 50 {
		t.Errorf("a token whose NAME is in another script must stay visible: %d", s)
	}
	if s := SpamScore("USDC", "USD\u200bCoin bonus", &d6); s < 50 {
		t.Errorf("zero-width + spam word: %d", s)
	}
	if SpamScore("USDС", "USD Coin", &d6) <= SpamScore("USDC", "USD Coin", &d6) {
		t.Error("a look-alike (mixed script) symbol must score higher than the real one")
	}
	if SpamScore("ABCDEFGHIJKLMN", "Long", &d18) <= SpamScore("ABC", "Long", &d18) {
		t.Error("an over-long symbol must score higher")
	}
	rng := rand.New(rand.NewSource(25))
	alphabet := []rune("abcXYZ.:/ 0123​С‮claimfreeHTTPS://")
	for i := 0; i < 20000; i++ {
		mk := func() string {
			r := make([]rune, rng.Intn(40))
			for j := range r {
				r[j] = alphabet[rng.Intn(len(alphabet))]
			}
			return string(r)
		}
		var dec *int
		if rng.Intn(2) == 0 {
			v := rng.Intn(80) - 5
			dec = &v
		}
		if s := SpamScore(mk(), mk(), dec); s < 0 || s > 100 {
			t.Fatalf("score %d out of range", s)
		}
	}
}
