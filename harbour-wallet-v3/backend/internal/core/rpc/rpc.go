// Package rpc defines the JSON-RPC types and the Upstream interface every RPC
// provider adapter implements. It must not import any provider package.
package rpc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Request is one JSON-RPC 2.0 request.
type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// Response is one JSON-RPC 2.0 response.
type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *Error          `json:"error,omitempty"`
}

// Error is a JSON-RPC error object.
type Error struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *Error) Error() string { return fmt.Sprintf("rpc error %d: %s", e.Code, e.Message) }

// TransportError is returned by Upstream.Call when no JSON-RPC response was
// obtained (network failure, HTTP status, undecodable body).
type TransportError struct {
	Status int // HTTP status, 0 if none
	Err    error
}

func (e *TransportError) Error() string {
	if e.Status != 0 {
		return fmt.Sprintf("upstream http %d: %v", e.Status, e.Err)
	}
	return fmt.Sprintf("upstream transport: %v", e.Err)
}
func (e *TransportError) Unwrap() error { return e.Err }

// Head is an upstream's view of the chain tip.
type Head struct {
	Latest    uint64
	Finalized uint64
	At        time.Time
}

// Upstream is one provider endpoint for one chain (one key, one URL).
type Upstream interface {
	// ID is unique across the gateway, e.g. "ethereum/<key id>".
	ID() string
	// Provider is the provider name from providers.yaml (for metrics only).
	Provider() string
	Chain() string
	// Call sends one request. A JSON-RPC error is returned inside Response,
	// not as err. err is non-nil only for transport-level failures.
	Call(ctx context.Context, req *Request) (*Response, error)
	// Head returns the latest and finalized block numbers.
	Head(ctx context.Context) (Head, error)
	// Health performs a cheap liveness probe.
	Health(ctx context.Context) error
}

// UpstreamConfig is what a factory receives; built from chains.yaml and
// providers.yaml with secrets already resolved from the environment.
type UpstreamConfig struct {
	ID          string
	Provider    string
	Chain       string
	Network     string // provider's name for the chain, e.g. "eth-mainnet"
	URLTemplate string // may contain {network} and {key}
	URL         string // full URL (overrides template)
	Key         string
	Secret      string
	Timeout     time.Duration
}

// UpstreamFactory constructs an Upstream; adapters register one by name.
type UpstreamFactory func(cfg UpstreamConfig) (Upstream, error)

// Class says what the gateway should do with an outcome.
type Class int

const (
	OK            Class = iota
	Retryable           // try another upstream
	Deterministic       // return to caller as-is; retrying burns quota
)

func (c Class) String() string {
	switch c {
	case OK:
		return "ok"
	case Retryable:
		return "retryable"
	default:
		return "deterministic"
	}
}

var retryableMsgs = []string{
	"header not found", "missing trie node", "unknown block", "block not found",
	"rate limit", "too many requests", "exceeded", "capacity", "timeout", "timed out",
	"try again", "temporarily", "busy", "internal error", "service unavailable",
	"upstream", "backend", "not synced", "request limit", "compute units",
}

var deterministicMsgs = []string{
	"execution reverted", "revert", "invalid params", "invalid argument", "nonce too low",
	"nonce too high", "insufficient funds", "already known", "known transaction",
	"replacement transaction underpriced", "intrinsic gas too low", "gas limit",
	"invalid sender", "method not found", "does not exist", "not supported",
	"max fee per gas less than block base fee", "transaction underpriced",
}

// Classify decides whether an outcome should fail over.
func Classify(resp *Response, err error) Class {
	if err != nil {
		var te *TransportError
		if errors.As(err, &te) && te.Status >= 400 && te.Status < 500 &&
			te.Status != 401 && te.Status != 403 && te.Status != 408 && te.Status != 429 {
			// 400/404/413...: our request is malformed for this upstream; another may differ.
			return Retryable
		}
		if errors.Is(err, context.Canceled) {
			return Deterministic
		}
		return Retryable
	}
	if resp == nil {
		return Retryable
	}
	if resp.Error == nil {
		return OK
	}
	msg := strings.ToLower(resp.Error.Message)
	for _, m := range deterministicMsgs {
		if strings.Contains(msg, m) {
			return Deterministic
		}
	}
	switch resp.Error.Code {
	case 3, -32602, -32601, -32600, -32700:
		return Deterministic
	case -32005, -32429, 429, -32603, -32001, -32002, -32004:
		return Retryable
	}
	for _, m := range retryableMsgs {
		if strings.Contains(msg, m) {
			return Retryable
		}
	}
	// Unknown -32000 class errors: providers use it for both; prefer passing
	// through, which never multiplies spend.
	return Deterministic
}

// GatewayErrorData is the single error shape callers see when the gateway
// itself gives up.
type GatewayErrorData struct {
	Code           string   `json:"code"`
	Retryable      bool     `json:"retryable"`
	UpstreamsTried []string `json:"upstreamsTried"`
}

// Gateway error codes (JSON-RPC server error range).
const (
	CodeUpstreamsUnavailable = -32098
	CodeMethodNotAllowed     = -32097
	CodeRateLimited          = -32096
	CodeBadRequest           = -32600
)

// NewGatewayError builds the gateway's single error response.
func NewGatewayError(id json.RawMessage, code int, short, msg string, retryable bool, tried []string) *Response {
	if tried == nil {
		tried = []string{}
	}
	data, _ := json.Marshal(GatewayErrorData{Code: short, Retryable: retryable, UpstreamsTried: tried})
	return &Response{JSONRPC: "2.0", ID: id, Error: &Error{Code: code, Message: msg, Data: data}}
}

// Kind of method, for routing policy.
type Kind int

const (
	KindRead Kind = iota
	KindWrite
	KindForbidden
)

// MethodKind classifies a method name.
func MethodKind(method string) Kind {
	switch method {
	case "eth_sendRawTransaction", "eth_sendRawTransactionConditional":
		return KindWrite
	}
	for _, p := range []string{"admin_", "personal_", "miner_", "engine_", "debug_setHead", "eth_sign", "eth_sendTransaction", "eth_subscribe", "eth_unsubscribe", "eth_newFilter", "eth_newBlockFilter", "eth_newPendingTransactionFilter", "eth_getFilterChanges", "eth_uninstallFilter"} {
		if strings.HasPrefix(method, p) {
			return KindForbidden
		}
	}
	return KindRead
}
