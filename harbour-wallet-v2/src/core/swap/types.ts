// Swap data model. Shapes mirror Trust Wallet's recovered client models
// (evidence/25-swap/serializer-schemas.json: Amber* route/step models, SwapQuoteResponse,
// SwapSettingsState). Harbour fills them from PUBLIC aggregators (LI.FI, Jupiter), never from
// TW's private gateway.
export type SwapDomainKind = 'evm' | 'solana' | 'utxo';

export interface SwapDomain {
  id: string;                 // Harbour chain id (matches src/core/chains.ts)
  name: string;
  kind: SwapDomainKind;
  chainId?: number;           // EVM chain id
  lifiChainId: number;        // LI.FI chain key
  nativeSymbol: string;
  nativeDecimals: number;
  addressKey: 'ethereum' | 'solana' | 'bitcoin'; // key into the account's address map
  twCoinId: number;           // TW coin id (twTaxonomy / HAR)
  trustAssetsDir: string;     // folder in the public trustwallet/assets repo (logos)
  explorerTx: string;         // tx explorer URL prefix
}

export interface SwapAsset {
  assetId: string;            // TW asset id convention: c<coinId> native, c<coinId>_t<address> token
  domainId: string;
  address: string;            // 'native' for the chain's gas token
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  priceUsd?: number;
}

export type SwapSortBy = 'quantity' | 'security' | 'latency' | 'outcome'; // AmberRouteSort

export interface SwapRouteRequest {
  from: SwapAsset;
  to: SwapAsset;
  fromAddress: string;
  toAddress: string;
  amount: string;             // atomic units of `from`
  slippage: string;           // percent, e.g. "2"
  sortBy: SwapSortBy;
  solanaTurbo?: boolean;
}

export interface SwapFee { symbol: string; decimals: number; amount: string; usd?: number; name?: string; description?: string; isNative?: boolean; upperBound?: boolean }

export type SwapStepType = 'swap' | 'bridge' | 'swapAndBridge' | 'bridgeAndSwap' | 'aggregate'; // AmberRouteStepResponse.StepType

export interface SwapStep {
  id: string;
  type: SwapStepType;
  provider: { id: string; name: string; logoUrl?: string };
  fromDomainId: string;
  toDomainId: string;
  from: { asset: SwapAsset; amount: string };
  to: { asset: SwapAsset; amount: string; minAmount: string };
  slippage: { userSelected?: number; suggested?: number };
  priceImpact?: number;       // percent; negative = loss (TW convention)
  providerFees: SwapFee[];
  networkFee?: SwapFee;
  approval?: { tokenAddress: string; spender: string; minAmount: string; needed?: boolean };
  executionSeconds?: number;
  raw: unknown;               // aggregator payload needed to build the transaction
}

export interface QuoteWarning { code: string; message: string }

export type SwapSource = 'lifi' | 'jupiter' | 'relay' | 'thorchain';

export interface SwapRoute {
  id: string;
  source: SwapSource;
  expiresAt: number;          // ms epoch
  steps: SwapStep[];
  tags: string[];
  warnings: QuoteWarning[];
  fromAmountUsd?: number;
  toAmountUsd?: number;
  priceImpact?: number;
  totalSeconds?: number;
}

export interface SwapQuoteResult {
  routes: SwapRoute[];
  refreshInterval: number;    // seconds; TW default 60 (AmberRouteConfig refreshInterval "60s")
  priceImpactMediumLevel: number;
  priceImpactHighLevel: number;
}

export type SwapErrorCode =
  | 'amount_too_low' | 'amount_too_high' | 'invalid_amount' | 'no_liquidity' | 'unsupported_pair'
  | 'unsupported_domain' | 'invalid_asset' | 'high_price_impact' | 'server' | 'timeout' | 'network'
  | 'invalid_slippage' | 'price_moved' | 'unsafe_transaction' | 'simulation_failed' | 'insufficient_gas';

export interface SwapError { code: SwapErrorCode; message: string; minAmount?: string }

export interface SwapSettings {
  slippage: string;           // percent string, TW default "2"
  mev: boolean;               // "Best price execution" / MEV protection
  solanaTurbo: boolean;       // "Solana turbo swaps"
  unlimitedAllowance: boolean;
  /** Gasless swaps (beta): EIP-7702 + sponsored user operation. Only offered when the remote flag is on. */
  gasless: boolean;
  sortBy: SwapSortBy;
  recentAssets: SwapAsset[];
}

export const DEFAULT_SWAP_SETTINGS: SwapSettings = {
  slippage: '2', mev: false, solanaTurbo: false, unlimitedAllowance: false, gasless: false, sortBy: 'quantity', recentAssets: [],
};

export type SwapStatus = 'approving' | 'swapping' | 'bridging' | 'success' | 'failed' | 'timeout';

export interface SwapHistoryItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: SwapStatus;
  address: string;
  fromAsset: SwapAsset; toAsset: SwapAsset;
  fromAmount: string; toAmountExpected: string; toAmountMin: string;
  provider: string;
  stepIndex: number; stepCount: number;
  approvalTxHash?: string;
  txHash?: string;
  fromDomainId: string; toDomainId: string;
  bridge?: string;
  /** Aggregator that built the route; picks the settlement-status API. Older items (no source) are LI.FI or Jupiter. */
  source?: SwapSource;
  /** Relay request id (status lookups). */
  requestId?: string;
  error?: string;
}
