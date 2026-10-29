import raw from './registry.json';
import extraRaw from './registry.extra.json';
import extraEnabled from './extra-enabled.json';
import type { ChainInfo } from './types';
export type { ChainInfo, ChainKind } from './types';

// Test networks live in ./testnets (Sepolia first). They derive with the ethereum CoinType; Trust Wallet gates them behind a toggle.
export { TESTNET_CHAINS } from './testnets';
import { TESTNET_CHAINS } from './testnets';
// Trust Wallet's 86 visible chains, plus any extra wallet-core chains explicitly enabled after a live probe (tools/check-chains.mjs).
export const EXTRA_CHAINS: ChainInfo[] = extraRaw as ChainInfo[];
export const ALL_CHAINS: ChainInfo[] = [...(raw as ChainInfo[]), ...EXTRA_CHAINS.filter((c) => (extraEnabled as string[]).includes(c.id))];
const byId = new Map<string, ChainInfo>([...ALL_CHAINS, ...TESTNET_CHAINS].map((c) => [c.id, c]));
const byTw = new Map<number, ChainInfo>(ALL_CHAINS.map((c) => [c.twId, c]));
const byEvm = new Map<number, ChainInfo>([...ALL_CHAINS, ...TESTNET_CHAINS].filter((c) => c.evmChainId).map((c) => [c.evmChainId!, c]));

export const chainById = (id?: string | null): ChainInfo | undefined => (id ? byId.get(id) : undefined);
export const chainByTwId = (n?: number | null): ChainInfo | undefined => (n == null ? undefined : byTw.get(n));
export const chainByEvmId = (n?: number | null): ChainInfo | undefined => (n == null ? undefined : byEvm.get(n));
export const evmChains = (): ChainInfo[] => [...ALL_CHAINS, ...TESTNET_CHAINS].filter((c) => c.kind === 'evm' && c.evmChainId);
export const chainLogo = (id: string): string => `/chains/${id}.png`;

/** Networks this build offers (Harbour v3: every network the Harbour backend serves, see harbour/chainList.gen.ts). Lookups (chainById etc.) still see the
 *  whole registry; lists the user can pick from (home, Manage crypto, dApp networks, NFTs) are limited to these. */
import { HARBOUR_CHAIN_IDS, CLIENT_CHAIN_IDS } from '../harbour/config';
export const ENABLED_CHAIN_IDS: readonly string[] = [...HARBOUR_CHAIN_IDS, ...CLIENT_CHAIN_IDS];
export const isEnabledChain = (id: string): boolean => ENABLED_CHAIN_IDS.includes(id);
export const ENABLED_CHAINS: ChainInfo[] = [...ALL_CHAINS, ...TESTNET_CHAINS].filter((c) => isEnabledChain(c.id));

/** How the network pickers group a network: Default (the mainnets this build serves), Custom (added by the user or by a site) and Testnets. */
export type NetworkCategory = 'default' | 'custom' | 'testnet';
export const NETWORK_CATEGORIES: readonly NetworkCategory[] = ['default', 'custom', 'testnet'];
export const NETWORK_CATEGORY_LABEL: Record<NetworkCategory, string> = { default: 'Default networks', custom: 'Custom networks', testnet: 'Testnets' };
export const chainCategory = (id: string): NetworkCategory => (id.startsWith('custom-') ? 'custom' : chainById(id)?.testnet ? 'testnet' : 'default');
/** Network name with a "testnet" marker where the name does not already say it ("Sepolia" -> "Sepolia testnet"). */
export const networkSubtitle = (id: string, name: string): string => (chainCategory(id) === 'testnet' && !/testnet/i.test(name) ? `${name} testnet` : name);

/** Chains shown on a brand-new wallet's home; everything else (other mainnets, testnets) is turned on from Manage crypto. */
export const DEFAULT_HOME_CHAINS: string[] = ['bitcoin', 'ethereum', 'solana', 'tron', 'smartchain', 'base', 'polygon', 'arbitrum', 'optimism', 'avalanchec'].filter((id) => ENABLED_CHAIN_IDS.includes(id));

/** Explorer URL helpers built from wallet-core's explorer templates (`/tx/{id}`, `/address/{address}`). */
export function explorerTxUrl(c: ChainInfo | undefined, hash: string): string {
  if (!c?.explorer) return '';
  // wallet-core's registry stores these either as a template (`/tx/{id}`) or as a bare prefix (`/tx/`, `/#/transaction/`): append the id for prefixes.
  const p = c.txPath ?? '/tx/{id}';
  return c.explorer.replace(/\/$/, '') + (p.includes('{id}') ? p.replace('{id}', hash) : p + hash);
}
export function explorerAddressUrl(c: ChainInfo | undefined, address: string): string {
  if (!c?.explorer) return '';
  const p = c.accountPath ?? '/address/{address}';
  return c.explorer.replace(/\/$/, '') + (p.includes('{address}') ? p.replace('{address}', address) : p + address);
}
