// Send engine types (core, pure: no DOM / chrome.*; fetch is injected). One SendFamily per chain family (ChainInfo.kind).
// TW evidence for the flow lives in evidences/re-evidence/33-send-receive/SPEC.md.
import type { ChainInfo, ChainKind } from '../types';
export type Fetcher = typeof fetch;
export interface SendEnv { core: any; fetch: Fetcher; now?: () => number; /** Random source (tests inject a deterministic one). */ random?: (n: number) => Uint8Array }

export type FeeTierId = 'slow' | 'average' | 'fast';
export const TIER_IDS: FeeTierId[] = ['slow', 'average', 'fast'];
/** What the chain wants in the optional "memo" slot of the Prepare screen (TW: address-and-memo-input memo / tag / comment). */
export type MemoKind = 'none' | 'memo' | 'tag' | 'comment';

export interface SendAsset {
  kind: 'native' | 'token';
  /** Token contract / mint / asset id / denom (family specific). */
  contract?: string;
  decimals: number;
  symbol: string;
}
export interface SendParams {
  chain: ChainInfo;
  from: string;
  to: string;
  /** Raw (smallest-unit) amount. */
  amount: bigint;
  asset: SendAsset;
  memo?: string;
  /** "Max": send the whole spendable balance (the family subtracts the fee itself). */
  isMax?: boolean;
  tier?: FeeTierId;
}
export interface FeeTier {
  id: FeeTierId;
  /** Estimated fee in raw units of the fee asset. */
  fee: bigint;
  /** Worst-case fee that must be spendable (EIP-1559 maxFee*gas); defaults to `fee`. */
  feeMax?: bigint;
  /** Largest sendable amount of the asset for this tier (raw). */
  max: bigint;
  /** Short human text, e.g. "12 sat/vB" or "0.1 gwei". */
  detail?: string;
}
export type IssueCode =
  | 'insufficient-funds' | 'insufficient-fee' | 'low-gas' | 'dust' | 'smart-contract' | 'memo-required' | 'inactive-account' | 'reserve'
  | 'below-minimum' | 'invalid-recipient' | 'invalid-memo' | 'estimate-failed' | 'network' | 'self-send' | 'token-not-registered' | 'info';
export interface SendIssue { code: IssueCode; message: string; blocking: boolean }
export interface SendQuote {
  tiers: FeeTier[];
  defaultTier: FeeTierId;
  feeSymbol: string;
  feeDecimals: number;
  /** Raw native balance of the sender (fee asset when the fee is paid in the native coin). */
  nativeBalance: string;
  /** Raw balance of the sent asset. */
  assetBalance: string;
  issues: SendIssue[];
  /** XRP-style amount that is locked for the account reserve (raw), already excluded from `max`. */
  reserve?: string;
  recipientIsContract?: boolean;
  /** Recipient account does not exist on chain yet (activation / reserve rules apply). */
  recipientInactive?: boolean;
  /** Opaque family context (nonce, utxos, blockhash...) reused by build(); never sent to the UI. */
  ctx?: any;
}
export interface BuiltTx {
  /** Broadcast payload (hex / base64 / JSON string, family specific). */
  raw: string;
  /** Transaction hash when it is known before broadcast. */
  hash?: string;
  /** Serialisable data a later screen can use (e.g. EVM nonce for a replacement). */
  meta?: Record<string, any>;
}
export type TxState = 'pending' | 'confirmed' | 'failed' | 'unknown';
export interface TxStatus { state: TxState; block?: string; confirmations?: number; fee?: string; error?: string; from?: string; to?: string; value?: string; timestamp?: number }

export interface SendFamily {
  kinds: ChainKind[];
  memo: MemoKind;
  /** Token transfers (contract / mint / denom) supported by this family. */
  tokens: boolean;
  /** Fetches balances / fee / nonce / UTXOs and validates; never needs a key. */
  quote(env: SendEnv, p: SendParams): Promise<SendQuote>;
  /** Signs. `key` is the raw private key; the caller wipes it afterwards. Uses `q.ctx` (a few families, e.g. NEAR, refresh a nonce / block hash that must be fresh). */
  build(env: SendEnv, p: SendParams, key: Uint8Array, q: SendQuote, tier: FeeTierId): Promise<BuiltTx>;
  /** Returns an error message for an invalid memo / tag / comment (TW: validate-tag.*), or null. */
  validateMemo?(memo: string): string | null;
  broadcast(env: SendEnv, chain: ChainInfo, tx: BuiltTx): Promise<string>;
  status?(env: SendEnv, chain: ChainInfo, hash: string, from?: string): Promise<TxStatus>;
}
export class SendError extends Error { constructor(public code: IssueCode, message: string) { super(message); } }
