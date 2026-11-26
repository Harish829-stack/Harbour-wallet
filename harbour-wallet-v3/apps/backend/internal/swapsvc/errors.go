package swapsvc

import (
	"fmt"
	"regexp"
	"strings"
)

// Error is a stable, user-safe error code (the extension maps codes to its own wording). Upstream messages are never
// passed through: they can contain anything.
type Error struct {
	Code      string `json:"code"`
	MinAmount string `json:"minAmount,omitempty"`
}

func (e *Error) Error() string { return "swap: " + e.Code }

func errCode(code string) *Error { return &Error{Code: code} }

// Messages are the API's plain-language texts for each code.
var Messages = map[string]string{
	"amount_too_low":     "Adjust input: Amount entered is too low.",
	"amount_too_high":    "Adjust input: Amount entered is too high.",
	"invalid_amount":     "Adjust input: Invalid amount.",
	"no_liquidity":       "Swap unavailable: No provider found.",
	"unsupported_pair":   "These two tokens can’t be swapped with each other. Try another pair.",
	"unsupported_domain": "Try a different network.",
	"invalid_asset":      "Unsupported asset: Select another token.",
	"server":             "Server error, please try again.",
	"timeout":            "Quote request timed out. Please try again.",
	"network":            "Couldn’t fetch a quote. Please try again.",
	"invalid_slippage":   "Invalid slippage.",
	"unavailable":        "This swap provider is not available right now.",
	"bad_request":        "Invalid request.",
}

var (
	reNoRoute = regexp.MustCompile(`no available quotes|no possible route|could_not_find_any_route|no route|route.*not.*found|insufficient liquidity|no liquidity|no_route`)
	reTooLow  = regexp.MustCompile(`too low|too small|minimum|below the min|amount.*small|dust`)
	reTooHigh = regexp.MustCompile(`too high|exceeds|too large|above the max`)
	reUnsupp  = regexp.MustCompile(`token_not_tradable|not supported|unsupported|unknown token|invalid token|token.*not found`)
)

// classify maps a provider HTTP failure onto an error code (port of the extension's classifyAggregatorError).
func classify(status int, body map[string]any) *Error {
	msg := strings.ToLower(upstreamMessage(body))
	switch {
	case status == 429, status >= 500:
		return errCode("server")
	case status == 401 || status == 403:
		return errCode("unavailable") // our key is missing/invalid: an operator problem, not the user's
	case reNoRoute.MatchString(msg):
		return errCode("no_liquidity")
	case reTooLow.MatchString(msg):
		return errCode("amount_too_low")
	case reTooHigh.MatchString(msg):
		return errCode("amount_too_high")
	case reUnsupp.MatchString(msg):
		return errCode("unsupported_pair")
	case strings.Contains(msg, "slippage"):
		return errCode("invalid_slippage")
	case strings.Contains(msg, "chain"):
		return errCode("unsupported_domain")
	case strings.Contains(msg, "amount"):
		return errCode("invalid_amount")
	case status == 404:
		return errCode("no_liquidity")
	}
	return errCode("network")
}

func upstreamMessage(body map[string]any) string {
	if body == nil {
		return ""
	}
	for _, k := range []string{"message", "error", "errorCode", "detail"} {
		switch v := body[k].(type) {
		case string:
			if v != "" {
				return v
			}
		case map[string]any:
			if s := upstreamMessage(v); s != "" {
				return s
			}
		case float64:
			return fmt.Sprint(v)
		}
	}
	return ""
}

// rank orders errors when every provider failed: a user-fixable error beats an infrastructure one.
var errorRank = []string{"amount_too_low", "amount_too_high", "invalid_amount", "unsupported_pair", "no_liquidity", "server", "timeout", "network", "unavailable"}

func rank(code string) int {
	for i, c := range errorRank {
		if c == code {
			return i
		}
	}
	return len(errorRank)
}
