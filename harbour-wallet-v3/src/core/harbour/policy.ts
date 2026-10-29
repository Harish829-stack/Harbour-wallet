// What this build may sign and broadcast. Harbour v3 serves only the networks the Harbour backend indexes (HARBOUR_CHAINS in
// config.ts). Everything that moves value checks this file in the background worker, so a network or feature is enabled in ONE
// place: add the chain to HARBOUR_CHAINS (and the backend's chains.yaml), or flip a feature flag below once it is reviewed.
import { HARBOUR_CHAINS } from './config';

/** dApp provider namespaces injected into pages and served by the worker. Non-EVM families stay off until the backend serves them. */
export const PROVIDER_FAMILIES: Readonly<{ evm: boolean; solana: boolean; multi: boolean }> = { evm: true, solana: false, multi: false };

/** Value-moving features that talk to third parties outside the Harbour backend. Off for the testnet-only build. */
export type Feature = 'swap' | 'earn' | 'ramps' | 'perps' | 'predictions' | 'walletconnect' | 'siteAddChain';
export const FEATURES: Readonly<Record<Feature, boolean>> = {
  swap: false, earn: false, ramps: false, perps: false, predictions: false, walletconnect: false,
  /** wallet_addEthereumChain from a site for a chain this build does not serve. */
  siteAddChain: false,
};
export const featureEnabled = (f: Feature): boolean => FEATURES[f] === true;

/** Chain a site sees before it picks one (and after a disconnect): the first network this build serves. */
export const DEFAULT_EVM_CHAIN: number = HARBOUR_CHAINS.find((c) => c.evmChainId)?.evmChainId ?? 11155111;

const EVM_IDS = new Set(HARBOUR_CHAINS.map((c) => c.evmChainId));
const CHAIN_IDS = new Set(HARBOUR_CHAINS.map((c) => c.id));

/** True when this build may sign for the EVM chain id. */
export const isSigningEvmChain = (chainId: number | bigint | string | null | undefined): boolean => {
  if (chainId === null || chainId === undefined || chainId === '') return false;
  try { return EVM_IDS.has(Number(BigInt(chainId as any))); } catch { return false; }
};
/** True when this build may sign for the registry chain (`sepolia`, `base-sepolia`, …) or its EVM chain id. */
export const isSigningChain = (chain: { id?: string; kind?: string; evmChainId?: number } | null | undefined): boolean =>
  !!chain && (chain.kind === 'evm' ? isSigningEvmChain(chain.evmChainId) : !!chain.id && CHAIN_IDS.has(chain.id));

/** The provider-facing slice of the policy. ProviderService takes it as a dependency so the generic provider stays testable
 *  with every family on, while the build default (below) is what ships. */
export interface ProviderPolicy { families: { evm: boolean; solana: boolean; multi: boolean }; isSigningEvmChain(chainId: number | bigint | string): boolean; siteAddChain: boolean; defaultChain: number }
export const BUILD_PROVIDER_POLICY: ProviderPolicy = { families: PROVIDER_FAMILIES, isSigningEvmChain, siteAddChain: FEATURES.siteAddChain, defaultChain: DEFAULT_EVM_CHAIN };

export class NetworkNotEnabledError extends Error {
  readonly code = 'NETWORK_NOT_ENABLED';
  constructor(what = 'This network') { super(`${what} is not available in this version of Harbour.`); }
}
export function assertSigningEvmChain(chainId: number | bigint | string | null | undefined, what?: string): void {
  if (!isSigningEvmChain(chainId)) throw new NetworkNotEnabledError(what);
}
export function assertSigningChain(chain: { id?: string; kind?: string; evmChainId?: number; name?: string } | null | undefined): void {
  if (!isSigningChain(chain)) throw new NetworkNotEnabledError(chain?.name);
}
export function assertFeature(f: Feature): void {
  if (!featureEnabled(f)) throw new Error('This feature is not available in this version of Harbour.');
}
