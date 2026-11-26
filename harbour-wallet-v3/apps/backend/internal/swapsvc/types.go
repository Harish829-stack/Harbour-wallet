// Package swapsvc is Harbour's swap service. It asks several swap providers for quotes through their official public
// REST APIs (LI.FI, Relay, Jupiter, THORChain; Uniswap for the testnet swap screen) and returns them in one format.
//
// Trust model: the service never holds user keys and never signs. Everything it returns is treated by the extension as
// untrusted input: before signing, the extension re-checks every transaction against what the user confirmed (allowed
// contracts, payout to the user's own address, exact amounts, minimum output) and simulates it. This package only
// orchestrates provider calls (keys stay here), normalises answers, and turns provider failures into stable error codes.
package swapsvc

import (
	"encoding/json"
	"strings"
)

// Asset is one side of a swap. Field names match the extension's SwapAsset.
type Asset struct {
	AssetID  string   `json:"assetId"`
	DomainID string   `json:"domainId"`
	Address  string   `json:"address"` // "native" for the chain's coin
	Symbol   string   `json:"symbol"`
	Name     string   `json:"name"`
	Decimals int      `json:"decimals"`
	LogoURL  string   `json:"logoUrl,omitempty"`
	PriceUSD *float64 `json:"priceUsd,omitempty"`
}

// QuoteRequest asks for routes. Amount is in the smallest unit of From; Slippage is a percent ("0.5").
type QuoteRequest struct {
	From        Asset    `json:"from"`
	To          Asset    `json:"to"`
	FromAddress string   `json:"fromAddress"`
	ToAddress   string   `json:"toAddress"`
	Amount      string   `json:"amount"`
	Slippage    string   `json:"slippage"`
	SortBy      string   `json:"sortBy"`
	SolanaTurbo bool     `json:"solanaTurbo,omitempty"`
	Providers   []string `json:"providers,omitempty"` // optional subset (re-quote one provider before signing)
}

type Fee struct {
	Symbol      string   `json:"symbol"`
	Decimals    int      `json:"decimals"`
	Amount      string   `json:"amount"`
	USD         *float64 `json:"usd,omitempty"`
	Name        string   `json:"name,omitempty"`
	Description string   `json:"description,omitempty"`
	IsNative    bool     `json:"isNative,omitempty"`
	UpperBound  bool     `json:"upperBound,omitempty"`
}

type ProviderInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	LogoURL string `json:"logoUrl,omitempty"`
}

type Side struct {
	Asset     Asset  `json:"asset"`
	Amount    string `json:"amount"`
	MinAmount string `json:"minAmount,omitempty"`
}

type Approval struct {
	TokenAddress string `json:"tokenAddress"`
	Spender      string `json:"spender"`
	MinAmount    string `json:"minAmount"`
}

type Slippage struct {
	UserSelected *float64 `json:"userSelected,omitempty"`
}

// Step matches the extension's SwapStep. Raw carries the provider payload the extension needs to re-check the
// transaction (and to ask this service for a fresh one) at signing time.
type Step struct {
	ID               string          `json:"id"`
	Type             string          `json:"type"`
	Provider         ProviderInfo    `json:"provider"`
	FromDomainID     string          `json:"fromDomainId"`
	ToDomainID       string          `json:"toDomainId"`
	From             Side            `json:"from"`
	To               Side            `json:"to"`
	Slippage         Slippage        `json:"slippage"`
	PriceImpact      *float64        `json:"priceImpact,omitempty"`
	ProviderFees     []Fee           `json:"providerFees"`
	NetworkFee       *Fee            `json:"networkFee,omitempty"`
	Approval         *Approval       `json:"approval,omitempty"`
	ExecutionSeconds *float64        `json:"executionSeconds,omitempty"`
	Raw              json.RawMessage `json:"raw"`
}

type Warning struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Route matches the extension's SwapRoute.
type Route struct {
	ID            string    `json:"id"`
	Source        string    `json:"source"`
	ExpiresAt     int64     `json:"expiresAt"` // ms epoch (the extension re-bases it on its own clock)
	Steps         []Step    `json:"steps"`
	Tags          []string  `json:"tags"`
	Warnings      []Warning `json:"warnings"`
	FromAmountUSD *float64  `json:"fromAmountUsd,omitempty"`
	ToAmountUSD   *float64  `json:"toAmountUsd,omitempty"`
	PriceImpact   *float64  `json:"priceImpact,omitempty"`
	TotalSeconds  *float64  `json:"totalSeconds,omitempty"`
}

// ProviderError reports why one provider gave no route (the request still succeeds when another provider answered).
type ProviderError struct {
	Provider string `json:"provider"`
	Code     string `json:"code"`
}

type QuoteResult struct {
	Routes                 []Route         `json:"routes"`
	RefreshInterval        int             `json:"refreshInterval"`
	PriceImpactMediumLevel float64         `json:"priceImpactMediumLevel"`
	PriceImpactHighLevel   float64         `json:"priceImpactHighLevel"`
	ProviderErrors         []ProviderError `json:"providerErrors,omitempty"`
}

// Domain is a swap network. Matches the extension's SWAP_DOMAINS.
type Domain struct {
	ID             string
	Kind           string // evm | solana | utxo
	ChainID        uint64 // EVM chain id
	LifiChainID    uint64
	NativeSymbol   string
	NativeDecimals int
}

const SolanaLifiChainID = 1151111081099710

var domains = []Domain{
	{ID: "ethereum", Kind: "evm", ChainID: 1, LifiChainID: 1, NativeSymbol: "ETH", NativeDecimals: 18},
	{ID: "smartchain", Kind: "evm", ChainID: 56, LifiChainID: 56, NativeSymbol: "BNB", NativeDecimals: 18},
	{ID: "polygon", Kind: "evm", ChainID: 137, LifiChainID: 137, NativeSymbol: "POL", NativeDecimals: 18},
	{ID: "arbitrum", Kind: "evm", ChainID: 42161, LifiChainID: 42161, NativeSymbol: "ETH", NativeDecimals: 18},
	{ID: "base", Kind: "evm", ChainID: 8453, LifiChainID: 8453, NativeSymbol: "ETH", NativeDecimals: 18},
	{ID: "bitcoin", Kind: "utxo", LifiChainID: 20000000000001, NativeSymbol: "BTC", NativeDecimals: 8},
	{ID: "solana", Kind: "solana", LifiChainID: SolanaLifiChainID, NativeSymbol: "SOL", NativeDecimals: 9},
}

func domainByID(id string) *Domain {
	for i := range domains {
		if domains[i].ID == id {
			return &domains[i]
		}
	}
	return nil
}

const (
	evmNative = "0x0000000000000000000000000000000000000000"
	solNative = "11111111111111111111111111111111"
)

// sameAddr compares addresses: EVM hex case-insensitively, everything else exactly.
func sameAddr(a, b string) bool {
	if strings.HasPrefix(a, "0x") && strings.HasPrefix(b, "0x") {
		return strings.EqualFold(a, b)
	}
	return a == b
}

func f64(v float64) *float64 { return &v }
