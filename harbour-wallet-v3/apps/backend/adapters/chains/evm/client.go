// Package evm is the chain.Client for EVM chains. It reaches the chain only
// through rpc-gateway, and reads balances with Multicall3 pinned to one block,
// so gas fees, L2 fees and rebasing tokens are always exactly right.
package evm

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/core/rpc"
	"harbour/backend/internal/registry"
)

// Name is the family name used in chains.yaml.
const Name = "evm"

func init() {
	registry.ChainClients.Register(Name, New)
	registry.Finality.Register("finalized-tag", NewFinalizedTag)
	registry.Finality.Register("depth", NewDepth)
}

// maxCallsPerMulticall keeps each eth_call well under provider gas and size limits.
const maxCallsPerMulticall = 250

// Client implements chain.Client.
type Client struct {
	cfg  chain.ClientConfig
	url  string
	http *http.Client
	id   atomic.Int64
}

// New builds a client that talks to rpc-gateway at cfg.RPCURL/rpc/<chain>.
func New(cfg chain.ClientConfig) (chain.Client, error) {
	if cfg.RPCURL == "" {
		return nil, errors.New("evm: RPCURL (rpc-gateway) is required")
	}
	return &Client{cfg: cfg, url: strings.TrimRight(cfg.RPCURL, "/") + "/rpc/" + cfg.Chain,
		http: &http.Client{Timeout: 30 * time.Second}}, nil
}

func (c *Client) Family() chain.Family { return chain.FamilyEVM }
func (c *Client) Chain() string        { return c.cfg.Chain }

// RPCError is a JSON-RPC error from the chain.
type RPCError struct {
	Code    int
	Message string
}

func (e *RPCError) Error() string { return e.Message }

// Call sends one JSON-RPC request through the gateway.
func (c *Client) Call(ctx context.Context, method string, params ...any) (json.RawMessage, error) {
	if params == nil {
		params = []any{}
	}
	ps, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(rpc.Request{JSONRPC: "2.0", ID: json.RawMessage(strconv.FormatInt(c.id.Add(1), 10)), Method: method, Params: ps})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.cfg.RPCToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.cfg.RPCToken)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("evm %s: gateway: %w", c.cfg.Chain, err)
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("evm %s: gateway http %d", c.cfg.Chain, resp.StatusCode)
	}
	var out rpc.Response
	if err := json.Unmarshal(rb, &out); err != nil {
		return nil, fmt.Errorf("evm %s: bad response: %w", c.cfg.Chain, err)
	}
	if out.Error != nil {
		return nil, &RPCError{Code: out.Error.Code, Message: out.Error.Message}
	}
	return out.Result, nil
}

func hexQty(n uint64) string { return "0x" + strconv.FormatUint(n, 16) }

func parseQty(raw json.RawMessage) (uint64, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return 0, err
	}
	return strconv.ParseUint(strings.TrimPrefix(s, "0x"), 16, 64)
}

func parseBig(raw json.RawMessage) (*big.Int, error) {
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	v, ok := new(big.Int).SetString(strings.TrimPrefix(s, "0x"), 16)
	if !ok {
		return nil, fmt.Errorf("bad quantity %q", s)
	}
	return v, nil
}

// LatestBlock returns eth_blockNumber.
func (c *Client) LatestBlock(ctx context.Context) (uint64, error) {
	r, err := c.Call(ctx, "eth_blockNumber")
	if err != nil {
		return 0, err
	}
	return parseQty(r)
}

// multicall runs calls at one block and returns per-call results.
func (c *Client) multicall(ctx context.Context, calls []call3, block uint64) ([]result3, error) {
	out := make([]result3, 0, len(calls))
	for start := 0; start < len(calls); start += maxCallsPerMulticall {
		end := start + maxCallsPerMulticall
		if end > len(calls) {
			end = len(calls)
		}
		data, err := encodeAggregate3(calls[start:end])
		if err != nil {
			return nil, err
		}
		r, err := c.Call(ctx, "eth_call", map[string]string{"to": Multicall3, "data": "0x" + hex.EncodeToString(data)}, hexQty(block))
		if err != nil {
			return nil, err
		}
		var s string
		if err := json.Unmarshal(r, &s); err != nil {
			return nil, err
		}
		b, err := hex.DecodeString(strings.TrimPrefix(s, "0x"))
		if err != nil {
			return nil, err
		}
		res, err := decodeAggregate3(b)
		if err != nil {
			return nil, err
		}
		if len(res) != end-start {
			return nil, fmt.Errorf("multicall returned %d results for %d calls", len(res), end-start)
		}
		out = append(out, res...)
	}
	return out, nil
}

// Balances reads the native balance first, then each token's balanceOf, all
// at one block (latest when block == 0).
func (c *Client) Balances(ctx context.Context, address string, assetRefs []string, block uint64) ([]chain.Balance, uint64, error) {
	if block == 0 {
		var err error
		if block, err = c.LatestBlock(ctx); err != nil {
			return nil, 0, err
		}
	}
	aw, err := addrWord(address)
	if err != nil {
		return nil, 0, err
	}
	calls := []call3{{target: Multicall3, data: append(append([]byte{}, selGetEthBalance...), aw...)}}
	for _, ref := range assetRefs {
		calls = append(calls, call3{target: ref, data: append(append([]byte{}, selBalanceOf...), aw...)})
	}
	res, err := c.multicall(ctx, calls, block)
	if err != nil {
		return nil, 0, err
	}
	out := make([]chain.Balance, len(calls))
	for i, r := range res {
		ref := "native"
		if i > 0 {
			ref = strings.ToLower(assetRefs[i-1])
		}
		v, ok := decodeUint256(r.data)
		if !r.success || !ok {
			out[i] = chain.Balance{AssetRef: ref, Failed: true}
			continue
		}
		out[i] = chain.Balance{AssetRef: ref, AmountRaw: v}
	}
	return out, block, nil
}

// TokenInfo reads symbol, name and decimals with one multicall.
func (c *Client) TokenInfo(ctx context.Context, assetRefs []string) ([]chain.TokenInfo, error) {
	if len(assetRefs) == 0 {
		return nil, nil
	}
	block, err := c.LatestBlock(ctx)
	if err != nil {
		return nil, err
	}
	var calls []call3
	for _, ref := range assetRefs {
		calls = append(calls,
			call3{target: ref, data: selSymbol},
			call3{target: ref, data: selName},
			call3{target: ref, data: selDecimals})
	}
	res, err := c.multicall(ctx, calls, block)
	if err != nil {
		return nil, err
	}
	out := make([]chain.TokenInfo, len(assetRefs))
	for i, ref := range assetRefs {
		ti := chain.TokenInfo{AssetRef: strings.ToLower(ref), Decimals: -1}
		if r := res[3*i]; r.success {
			ti.Symbol, _ = decodeString(r.data)
		}
		if r := res[3*i+1]; r.success {
			ti.Name, _ = decodeString(r.data)
		}
		if r := res[3*i+2]; r.success {
			if d, ok := decodeUint256(r.data); ok && d.IsInt64() && d.Int64() <= 77 {
				ti.Decimals = int(d.Int64())
			}
		}
		ti.Failed = !res[3*i].success && !res[3*i+1].success && !res[3*i+2].success
		out[i] = ti
	}
	return out, nil
}

// Fees suggests EIP-1559 fees: maxFee = 2 x base fee + priority fee.
func (c *Client) Fees(ctx context.Context) (chain.Fees, error) {
	r, err := c.Call(ctx, "eth_getBlockByNumber", "latest", false)
	if err != nil {
		return chain.Fees{}, err
	}
	var blk struct {
		BaseFeePerGas string `json:"baseFeePerGas"`
	}
	if err := json.Unmarshal(r, &blk); err != nil {
		return chain.Fees{}, err
	}
	if blk.BaseFeePerGas == "" { // pre-London chain
		gp, err := c.Call(ctx, "eth_gasPrice")
		if err != nil {
			return chain.Fees{}, err
		}
		v, err := parseBig(gp)
		return chain.Fees{GasPrice: v}, err
	}
	base, err := parseBig(json.RawMessage(strconv.Quote(blk.BaseFeePerGas)))
	if err != nil {
		return chain.Fees{}, err
	}
	tip := big.NewInt(0)
	if r, err := c.Call(ctx, "eth_maxPriorityFeePerGas"); err == nil {
		if v, err := parseBig(r); err == nil {
			tip = v
		}
	}
	maxFee := new(big.Int).Add(new(big.Int).Mul(base, big.NewInt(2)), tip)
	return chain.Fees{BaseFee: base, MaxPriorityFee: tip, MaxFee: maxFee}, nil
}

// Nonce returns the pending transaction count.
func (c *Client) Nonce(ctx context.Context, address string) (uint64, error) {
	r, err := c.Call(ctx, "eth_getTransactionCount", address, "pending")
	if err != nil {
		return 0, err
	}
	return parseQty(r)
}

// ConfirmedNonce counts only mined transactions.
func (c *Client) ConfirmedNonce(ctx context.Context, address string) (uint64, error) {
	r, err := c.Call(ctx, "eth_getTransactionCount", address, "latest")
	if err != nil {
		return 0, err
	}
	return parseQty(r)
}

// Broadcast sends a signed transaction.
func (c *Client) Broadcast(ctx context.Context, signedTx []byte) (string, error) {
	r, err := c.Call(ctx, "eth_sendRawTransaction", "0x"+hex.EncodeToString(signedTx))
	if err != nil {
		return "", err
	}
	var h string
	return h, json.Unmarshal(r, &h)
}

// Simulate dry-runs a call and estimates gas.
func (c *Client) Simulate(ctx context.Context, tx map[string]any) (chain.SimulationResult, error) {
	if _, err := c.Call(ctx, "eth_call", tx, "latest"); err != nil {
		var re *RPCError
		if errors.As(err, &re) {
			return chain.SimulationResult{Success: false, Error: re.Message}, nil
		}
		return chain.SimulationResult{}, err
	}
	r, err := c.Call(ctx, "eth_estimateGas", tx)
	if err != nil {
		var re *RPCError
		if errors.As(err, &re) {
			return chain.SimulationResult{Success: false, Error: re.Message}, nil
		}
		return chain.SimulationResult{}, err
	}
	gas, _ := parseQty(r)
	return chain.SimulationResult{Success: true, GasUsed: gas}, nil
}

// Inclusion reads the receipt.
func (c *Client) Inclusion(ctx context.Context, txHash string) (chain.Inclusion, error) {
	r, err := c.Call(ctx, "eth_getTransactionReceipt", txHash)
	if err != nil {
		return chain.Inclusion{}, err
	}
	if len(r) == 0 || string(r) == "null" {
		return chain.Inclusion{}, nil
	}
	var rc struct {
		BlockNumber string `json:"blockNumber"`
		BlockHash   string `json:"blockHash"`
		Status      string `json:"status"`
	}
	if err := json.Unmarshal(r, &rc); err != nil {
		return chain.Inclusion{}, err
	}
	n, err := strconv.ParseUint(strings.TrimPrefix(rc.BlockNumber, "0x"), 16, 64)
	if err != nil {
		return chain.Inclusion{}, fmt.Errorf("receipt block: %w", err)
	}
	return chain.Inclusion{Found: true, BlockNumber: n, BlockHash: strings.ToLower(rc.BlockHash), Success: rc.Status != "0x0"}, nil
}

// BlockHash returns the hash of the canonical block at number.
func (c *Client) BlockHash(ctx context.Context, number uint64) (string, error) {
	r, err := c.Call(ctx, "eth_getBlockByNumber", hexQty(number), false)
	if err != nil {
		return "", err
	}
	if len(r) == 0 || string(r) == "null" {
		return "", nil
	}
	var blk struct {
		Hash string `json:"hash"`
	}
	if err := json.Unmarshal(r, &blk); err != nil {
		return "", err
	}
	return strings.ToLower(blk.Hash), nil
}

// ---------- finality ----------

// FinalizedTag reads the chain's "finalized" block. On OP-stack L2s this is
// the L2 block whose batch is final on L1 (often 10+ minutes behind).
type FinalizedTag struct {
	c        chain.Client
	callable interface {
		Call(ctx context.Context, method string, params ...any) (json.RawMessage, error)
	}
}

// NewFinalizedTag builds the policy for an EVM client.
func NewFinalizedTag(c chain.Client, _ map[string]any) (chain.FinalityPolicy, error) {
	ec, ok := c.(*Client)
	if !ok {
		return nil, errors.New("finalized-tag needs an evm client")
	}
	return &FinalizedTag{c: c, callable: ec}, nil
}

// FinalizedBlock returns the number of the "finalized" block.
func (f *FinalizedTag) FinalizedBlock(ctx context.Context) (uint64, error) {
	r, err := f.callable.Call(ctx, "eth_getBlockByNumber", "finalized", false)
	if err != nil {
		return 0, err
	}
	var blk struct {
		Number string `json:"number"`
	}
	if err := json.Unmarshal(r, &blk); err != nil || blk.Number == "" {
		return 0, fmt.Errorf("no finalized block: %v", err)
	}
	return strconv.ParseUint(strings.TrimPrefix(blk.Number, "0x"), 16, 64)
}

// Classify maps a mined block to pending/confirmed/finalized.
func (f *FinalizedTag) Classify(block, latest, finalized uint64) chain.Finality {
	switch {
	case block == 0 || block > latest:
		return chain.Pending
	case finalized > 0 && block <= finalized:
		return chain.Finalized
	default:
		return chain.Confirmed
	}
}

// Depth treats a block as final once it is `confirmations` blocks behind the
// head. It is for chains whose nodes have no "finalized" tag (most sidechains
// and independent L1s); pick a depth that makes a reorg implausible.
type Depth struct {
	c             chain.Client
	confirmations uint64
}

// defaultDepth is used when chains.yaml gives no finality.options.confirmations.
const defaultDepth = 30

// NewDepth builds the depth policy; options: confirmations (integer).
func NewDepth(c chain.Client, opts map[string]any) (chain.FinalityPolicy, error) {
	n := uint64(defaultDepth)
	switch v := opts["confirmations"].(type) {
	case nil:
	case int:
		if v > 0 {
			n = uint64(v)
		}
	case int64:
		if v > 0 {
			n = uint64(v)
		}
	case uint64:
		if v > 0 {
			n = v
		}
	case float64:
		if v >= 1 {
			n = uint64(v)
		}
	default:
		return nil, fmt.Errorf("depth: confirmations must be a number, got %T", v)
	}
	return &Depth{c: c, confirmations: n}, nil
}

// FinalizedBlock is head minus the configured depth (0 while the chain is shorter).
func (d *Depth) FinalizedBlock(ctx context.Context) (uint64, error) {
	head, err := d.c.LatestBlock(ctx)
	if err != nil {
		return 0, err
	}
	if head <= d.confirmations {
		return 0, nil
	}
	return head - d.confirmations, nil
}

// Classify maps a mined block to pending/confirmed/finalized.
func (d *Depth) Classify(block, latest, finalized uint64) chain.Finality {
	switch {
	case block == 0 || block > latest:
		return chain.Pending
	case finalized > 0 && block <= finalized:
		return chain.Finalized
	default:
		return chain.Confirmed
	}
}
