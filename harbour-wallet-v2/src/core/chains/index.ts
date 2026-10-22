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

/** Chains shown on a brand-new wallet's home (Trust Wallet's default assets); everything else is enabled from Manage crypto. */
export const DEFAULT_HOME_CHAINS = ['bitcoin', 'ethereum', 'smartchain', 'solana', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanchec', 'tron'];

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
