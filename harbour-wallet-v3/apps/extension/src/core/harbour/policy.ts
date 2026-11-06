// What this build may sign and broadcast: the EVM networks the Harbour backend serves (HARBOUR_CHAINS in config.ts) and the
// non-EVM networks the extension reaches directly (CLIENT_CHAIN_IDS). Everything that moves value checks this file in the
// background worker, so a network or feature is enabled in ONE place: add the chain to chains.yaml and run
// backend/scripts/gen_chains.py, or flip a feature flag below once it is reviewed.
import { HARBOUR_CHAINS, CLIENT_CHAIN_IDS, HB_API_URL, HB_API_SECURE, isLoopbackUrl } from './config';
import { customNetwork } from '../networkRegistry';
import { chainById } from '../chains/index';

/** Signing and broadcasting on real-value (mainnet) networks is a deliberate switch, not a side effect of a chain being listed.
 *  All three must stay explicit so a review (and test/policy.test.js) can see what this build allows:
 *   - mainnet: networks the Harbour backend serves that are not testnets, and the non-EVM networks the extension reaches directly;
 *   - testnet: the curated test networks;
 *   - custom: networks the user added (Manage networks) or approved from a site (wallet_addEthereumChain).
 *  Mainnet signing additionally needs a secure backend: a release build must talk to https (a build pointing at a local backend is for
 *  development only, and the app refuses to sign real-value transactions through it). Every signature still goes through the approval window. */
export const SIGNING_POLICY: Readonly<{ mainnet: boolean; testnet: boolean; custom: boolean }> = Object.freeze({ mainnet: true, testnet: true, custom: true });
const IS_RELEASE_BUILD: boolean = !!((import.meta as any).env ?? {}).PROD;
export const mainnetSigningReady = (): boolean => SIGNING_POLICY.mainnet && HB_API_SECURE && !(IS_RELEASE_BUILD && isLoopbackUrl(HB_API_URL));
export type SigningBasis = 'harbour-mainnet' | 'harbour-testnet' | 'client-chain' | 'custom-network';

/** dApp provider namespaces injected into pages and served by the worker: EVM, Solana and the multi-chain family (Cosmos, Aptos, Sui, TON, Tron, Bitcoin). */
export const PROVIDER_FAMILIES: Readonly<{ evm: boolean; solana: boolean; multi: boolean }> = { evm: true, solana: true, multi: true };

/** Value-moving features that talk to third parties. Their calls go through the Harbour backend gateway (/v1/gw, kit/endpoints.ts),
 *  which holds the API keys. A feature can still be switched off at build time here, or at run time by the signed remote config. */
export type Feature = 'swap' | 'earn' | 'ramps' | 'perps' | 'predictions' | 'walletconnect' | 'siteAddChain';
export const FEATURES: Readonly<Record<Feature, boolean>> = {
  swap: true, earn: true, ramps: true, perps: true, predictions: true, walletconnect: true,
  /** wallet_addEthereumChain from a site for a chain this build does not serve: becomes a user-approved custom network. */
  siteAddChain: true,
};
export const featureEnabled = (f: Feature): boolean => FEATURES[f] === true;

/** Chain a site sees before it picks one (and after a disconnect): the first network this build serves. */
export const DEFAULT_EVM_CHAIN: number = HARBOUR_CHAINS.find((c) => c.evmChainId)?.evmChainId ?? 11155111;

const CHAIN_IDS = new Set([...HARBOUR_CHAINS.map((c) => c.id), ...CLIENT_CHAIN_IDS]);

/** True when this build may sign for the EVM chain id: a network the Harbour backend serves, or one the user added themselves
 *  (including through a site's add-chain request, which always goes through the approval window). */
export const evmSigningBasis = (chainId: number | bigint | string | null | undefined): SigningBasis | null => {
  if (chainId === null || chainId === undefined || chainId === '') return null;
  try {
    const n = Number(BigInt(chainId as any));
    const h = HARBOUR_CHAINS.find((c) => c.evmChainId === n);
    if (h) return chainById(h.id)?.testnet ? 'harbour-testnet' : 'harbour-mainnet';
    return customNetwork(n) ? 'custom-network' : null;
  } catch { return null; }
};
const basisAllowed = (b: SigningBasis | null): boolean =>
  b === 'harbour-mainnet' ? mainnetSigningReady() : b === 'harbour-testnet' ? SIGNING_POLICY.testnet : b === 'custom-network' ? SIGNING_POLICY.custom : b === 'client-chain' ? mainnetSigningReady() : false;
export const isSigningEvmChain = (chainId: number | bigint | string | null | undefined): boolean => basisAllowed(evmSigningBasis(chainId));
/** True when this build may sign for the registry chain (`sepolia`, `base-sepolia`, …) or its EVM chain id. */
export const isSigningChain = (chain: { id?: string; kind?: string; evmChainId?: number } | null | undefined): boolean =>
  !!chain && (chain.kind === 'evm' ? isSigningEvmChain(chain.evmChainId) : !!chain.id && CHAIN_IDS.has(chain.id) && basisAllowed('client-chain'));

/** The provider-facing slice of the policy. ProviderService takes it as a dependency so the generic provider stays testable
 *  with every family on, while the build default (below) is what ships. */
export interface ProviderPolicy { families: { evm: boolean; solana: boolean; multi: boolean }; isSigningEvmChain(chainId: number | bigint | string): boolean; siteAddChain: boolean; defaultChain: number }
// Solana and the multi-chain family sign on real-value networks only, so they follow the same mainnet switch as EVM mainnets.
export const BUILD_PROVIDER_POLICY: ProviderPolicy = { families: { evm: PROVIDER_FAMILIES.evm, solana: PROVIDER_FAMILIES.solana && mainnetSigningReady(), multi: PROVIDER_FAMILIES.multi && mainnetSigningReady() }, isSigningEvmChain, siteAddChain: FEATURES.siteAddChain, defaultChain: DEFAULT_EVM_CHAIN };

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
