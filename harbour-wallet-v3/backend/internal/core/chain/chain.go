// Package chain defines the per-family chain client and finality policy.
// Implementations live under adapters/chains/<family>.
package chain

import (
	"context"
	"math/big"
)

// Family is a chain family such as "evm", "solana", "bitcoin", "tron".
type Family string

const (
	FamilyEVM Family = "evm"
)

// Finality states stored on fact rows.
type Finality string

const (
	Pending   Finality = "pending"
	Confirmed Finality = "confirmed"
	Finalized Finality = "finalized"
)

// Balance is one asset balance read from chain at a block.
type Balance struct {
	AssetRef  string   // contract address, mint, or "native"
	AmountRaw *big.Int // raw integer units; nil when Failed
	// Failed means the read reverted (not a token, self-destructed ...);
	// callers keep the previous value rather than writing zero.
	Failed bool
}

// TokenInfo is on-chain token metadata.
type TokenInfo struct {
	AssetRef string
	Symbol   string
	Name     string
	Decimals int // -1 when the contract has no decimals()
	Failed   bool
}

// Fees is a fee suggestion; EVM fields are in Details for other families.
type Fees struct {
	BaseFee        *big.Int
	MaxPriorityFee *big.Int
	MaxFee         *big.Int
	GasPrice       *big.Int
	Details        map[string]any
}

// SimulationResult is a generic dry-run outcome.
type SimulationResult struct {
	Success bool
	GasUsed uint64
	Error   string
	Details map[string]any
}

// Client is everything Harbour needs from a chain family.
type Client interface {
	Family() Family
	Chain() string
	// Balances reads native plus the given asset balances at one block.
	// block == 0 means latest; the block actually used is returned.
	Balances(ctx context.Context, address string, assetRefs []string, block uint64) ([]Balance, uint64, error)
	Fees(ctx context.Context) (Fees, error)
	Nonce(ctx context.Context, address string) (uint64, error)
	Broadcast(ctx context.Context, signedTx []byte) (txHash string, err error)
	Simulate(ctx context.Context, tx map[string]any) (SimulationResult, error)
	// TokenInfo reads symbol, name and decimals from chain.
	TokenInfo(ctx context.Context, assetRefs []string) ([]TokenInfo, error)
	// LatestBlock returns the current head.
	LatestBlock(ctx context.Context) (uint64, error)
	// Inclusion reports where a transaction is mined now (found=false when
	// the chain has no receipt: dropped, reorged out or not yet mined).
	Inclusion(ctx context.Context, txHash string) (Inclusion, error)
	// BlockHash returns the canonical hash at a height ("" if unknown).
	BlockHash(ctx context.Context, number uint64) (string, error)
}

// ConfirmedNoncer is optionally implemented by account-based families: the
// next nonce counting only mined transactions (used to detect dropped or
// replaced transactions).
type ConfirmedNoncer interface {
	ConfirmedNonce(ctx context.Context, address string) (uint64, error)
}

// Inclusion is a transaction's current position.
type Inclusion struct {
	Found       bool
	BlockNumber uint64
	BlockHash   string
	Success     bool
}

// FinalityPolicy maps a block to a finality state for one chain.
type FinalityPolicy interface {
	// FinalizedBlock returns the latest block considered final.
	FinalizedBlock(ctx context.Context) (uint64, error)
	// Classify returns the finality of a block given the current heads.
	Classify(block, latest, finalized uint64) Finality
}

// ClientConfig is passed to a ClientFactory.
type ClientConfig struct {
	Chain      string
	Family     Family
	EVMChainID uint64
	// RPC is how the client reaches the chain (normally the rpc-gateway).
	RPCURL string
	// RPCToken is sent as a bearer token (GATEWAY_INTERNAL_TOKEN).
	RPCToken string
	Options  map[string]any
}

// ClientFactory constructs a Client.
type ClientFactory func(cfg ClientConfig) (Client, error)

// FinalityFactory constructs a FinalityPolicy for a chain; it reads heads
// through the chain's Client.
type FinalityFactory func(c Client, opts map[string]any) (FinalityPolicy, error)
