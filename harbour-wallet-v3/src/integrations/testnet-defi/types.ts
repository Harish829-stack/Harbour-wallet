import type { Address, Hex } from 'viem';

export interface DefiToken { address: Address; symbol: string; decimals: number; balance: string }
export interface EarnAsset extends DefiToken {
  aToken: Address; supplied: string; apy: number; canSupply: boolean; canWithdraw: boolean;
  supplyRemaining: string | null; availableLiquidity: string; reason?: string;
}
export interface SwapCatalog { tokens: DefiToken[] }
export type DefiAction = 'supply' | 'withdraw' | 'swap' | 'wrap' | 'unwrap';
export interface DefiRequest {
  networkId: string; action: DefiAction; token: string; tokenOut?: string; amount: string; slippageBps?: number;
}
export interface DefiCall { to: Address; data: Hex; value: bigint; label: string }
export interface DefiReview {
  id: string; expiresAt: number; network: string; account: string; action: DefiAction;
  symbol: string; amount: string; decimals: number; outputSymbol?: string; outputDecimals?: number;
  expectedOutput?: string; minimumOutput?: string; fee: string; steps: string[]; apy?: number;
}
export interface PreparedDefi { calls: DefiCall[]; review: Omit<DefiReview, 'id' | 'expiresAt' | 'network' | 'account' | 'fee' | 'steps'> }
