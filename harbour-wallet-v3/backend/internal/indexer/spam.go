package indexer

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	spamURL   = regexp.MustCompile(`(?i)(https?://|www\.|\.(com|io|net|org|xyz|app|site|online|gift|top|club|fi|finance|vip|cc|me|ly)\b|t\.me/)`)
	spamWords = regexp.MustCompile(`(?i)\b(claim|visit|reward|rewards|airdrop|voucher|bonus|free|giveaway|redeem|access|eligible)\b`)
)

// SpamScore rates a fungible token 0..100 from its on-chain metadata. The
// UI hides tokens scoring 50 or more by default; nothing is deleted.
func SpamScore(symbol, name string, decimals *int) int {
	score := 0
	text := symbol + " " + name
	if spamURL.MatchString(text) {
		score += 60
	}
	if spamWords.MatchString(text) {
		score += 40
	}
	for _, r := range text {
		if r == '\u200b' || r == '\u200c' || r == '\u200d' || r == '\ufeff' {
			score += 40
			break
		}
	}
	nonASCII := 0
	for _, r := range text {
		if r > unicode.MaxASCII && unicode.IsLetter(r) {
			nonASCII++
		}
	}
	if nonASCII > 0 && nonASCII < len([]rune(strings.TrimSpace(text))) {
		score += 20 // mixed scripts: look-alike symbols (e.g. a Cyrillic letter in "USDC")
	}
	if decimals == nil {
		score += 30
	}
	if len(symbol) > 12 {
		score += 10
	}
	if strings.TrimSpace(symbol) == "" && strings.TrimSpace(name) == "" {
		score += 30
	}
	if score > 100 {
		score = 100
	}
	return score
}
