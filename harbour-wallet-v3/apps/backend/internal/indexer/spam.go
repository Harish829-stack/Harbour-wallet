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
		if r == '\u200b' || r == '\u200c' || r == '\u200d' || r == '\ufeff' || r == '\u2060' {
			score += 60 // OBS-09: an invisible character has no honest use in token metadata; enough on its own to hide the token
			break
		}
	}
	nonASCII := 0
	for _, r := range text {
		if r > unicode.MaxASCII && unicode.IsLetter(r) {
			nonASCII++
		}
	}
	if lookAlikeSymbol(symbol) {
		score += 50 // OBS-09: a ticker mixing Latin letters with letters of another script ("USDС" with a Cyrillic С) imitates a real one
	} else if nonASCII > 0 && nonASCII < len([]rune(strings.TrimSpace(text))) {
		score += 20 // mixed scripts elsewhere (e.g. a name in another script): a weak signal
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

// lookAlikeSymbol reports a symbol that mixes ASCII letters with non-ASCII letters (homoglyph tickers).
func lookAlikeSymbol(symbol string) bool {
	ascii, other := false, false
	for _, r := range symbol {
		if !unicode.IsLetter(r) {
			continue
		}
		if r <= unicode.MaxASCII {
			ascii = true
		} else {
			other = true
		}
	}
	return ascii && other
}
