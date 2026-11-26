package swapsvc

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"unicode"
)

var (
	reBase64     = regexp.MustCompile(`^[A-Za-z0-9+/]+={0,2}$`)
	reRequestID  = regexp.MustCompile(`^0x[0-9a-fA-F]{1,128}$`)
	reThorHash   = regexp.MustCompile(`^[0-9A-F]{64}$`)
	reEVMHash    = regexp.MustCompile(`^0x[0-9a-fA-F]{64}$`)
	reSolSig     = regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{64,90}$`)
	reTokenQuery = regexp.MustCompile(`^[A-Za-z0-9._$-]{1,64}$`)
	reWord       = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,64}$`)
)

// TxRequest asks for a fresh, unsigned transaction for a route the user confirmed.
//   - lifi:      Ref = the route's QuoteRef (the LI.FI step stays on the server)
//   - relay, thorchain: Request = the quote request (a fresh quote is the transaction source)
//   - jupiter:   Ref = the route's QuoteRef (Jupiter's quote stays on the server), Priority = fast|turbo, User = the Solana address
type TxRequest struct {
	Source   string        `json:"source"`
	Ref      string        `json:"ref,omitempty"`
	Request  *QuoteRequest `json:"request,omitempty"`
	Priority string        `json:"priority,omitempty"`
	User     string        `json:"user,omitempty"`
}

var reQuoteRef = regexp.MustCompile(`^[0-9a-f]{48}$`)

// Transaction returns the provider's own answer (the extension checks it before signing).
func (s *Service) Transaction(ctx context.Context, t TxRequest) (json.RawMessage, error) {
	if !s.Enabled(t.Source) || t.Source == Uniswap {
		return nil, errCode("unavailable")
	}
	switch t.Source {
	case LiFi, Jupiter:
		if !reQuoteRef.MatchString(t.Ref) {
			return nil, errCode("bad_request")
		}
		payload, ok := s.guard.getRef(s.cfg.Now(), t.Ref, t.Source)
		if !ok {
			return nil, errCode("quote_expired") // expired or unknown (e.g. after a restart): the client quotes again
		}
		if t.Source == LiFi {
			return s.lifiStepTransaction(ctx, payload)
		}
		return s.jupiterSwap(ctx, payload, t.Priority, t.User)
	case Relay, THORChain:
		if t.Request == nil {
			return nil, errCode("bad_request")
		}
		if err := t.Request.Validate(); err != nil {
			return nil, err
		}
		if t.Source == Relay {
			if !relaySupports(t.Request) {
				return nil, errCode("unsupported_pair")
			}
			raw, _, err := s.relayQuoteRaw(ctx, t.Request)
			return raw, err
		}
		if !thorSupports(t.Request) {
			return nil, errCode("unsupported_pair")
		}
		raw, _, err := s.thorQuoteRaw(ctx, t.Request)
		return raw, err
	}
	return nil, errCode("bad_request")
}

// StatusRequest asks how a submitted swap is settling.
type StatusRequest struct {
	Source       string `json:"source"`
	TxHash       string `json:"txHash"`
	RequestID    string `json:"requestId,omitempty"`
	FromDomainID string `json:"fromDomainId"`
	ToDomainID   string `json:"toDomainId"`
	Bridge       string `json:"bridge,omitempty"`
}

// StatusResult: pending | success | failed | refunded.
type StatusResult struct {
	Status          string `json:"status"`
	Detail          string `json:"detail,omitempty"`
	ReceivingTxHash string `json:"receivingTxHash,omitempty"`
}

// Status reports settlement for cross-chain routes (same-chain swaps are confirmed by the extension from its own RPC).
func (s *Service) Status(ctx context.Context, q StatusRequest) (*StatusResult, error) {
	if q.Bridge != "" && !reWord.MatchString(q.Bridge) {
		return nil, errCode("bad_request")
	}
	switch q.Source {
	case Relay:
		return s.relayStatus(ctx, q.RequestID)
	case THORChain:
		return s.thorStatus(ctx, q.TxHash)
	case LiFi:
		if !reEVMHash.MatchString(q.TxHash) && !reSolSig.MatchString(q.TxHash) {
			return nil, errCode("bad_request")
		}
		return s.lifiStatus(ctx, q)
	}
	return nil, errCode("bad_request")
}

// cleanText strips control characters and markup brackets and caps the length (for provider text shown to users).
func cleanText(s string, max int) string {
	var b strings.Builder
	for _, r := range s {
		if unicode.IsControl(r) || r == '<' || r == '>' {
			r = ' '
		}
		b.WriteRune(r)
	}
	out := strings.Join(strings.Fields(b.String()), " ")
	if r := []rune(out); len(r) > max {
		out = string(r[:max])
	}
	return out
}

func safeWord(s string) string {
	if reWord.MatchString(s) {
		return s
	}
	return ""
}

func safeHash(s string) string {
	if reEVMHash.MatchString(s) || reSolSig.MatchString(s) || reThorHash.MatchString(s) {
		return s
	}
	return ""
}
