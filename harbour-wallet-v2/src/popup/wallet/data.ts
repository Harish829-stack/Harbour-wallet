import { customExplorer, customNetworks } from '../../core/networkRegistry';
import { ALL_CHAINS, TESTNET_CHAINS, chainByEvmId, chainById, explorerTxUrl, explorerAddressUrl, type ChainKind } from '../../core/chains/index';
import { money } from '../settingsStore';
// Dummy/presentation data for screens that need the network in a real deployment.
// Live data (Sepolia balance, send) comes from the background via RPC; everything here is
// static sample content clearly used only for UI. Colors are neutral brand-free swatches.

export interface TokenInfo { id: string; address: string; decimals: number; chainId: number; networkId: string }
export interface Asset { id: string; name: string; sym: string; color: string; chainId?: number; evm: boolean; price: number; change: number; token?: TokenInfo; kind?: ChainKind; decimals?: number; twId?: number; native?: boolean; }

// Native assets of every chain in the registry (Trust Wallet's 86 enabled chains + Sepolia). Prices/balances are NEVER defined here:
// they come from the background (CoinGecko + per-chain adapters); `price`/`change` stay 0 until a live quote arrives.
const BRAND: Record<string, string> = { bitcoin: '#f7931a', ethereum: '#6372f0', smartchain: '#d9a21b', polygon: '#8247e5', arbitrum: '#28a0f0', base: '#2456f5', solana: '#17c0a0',
  optimism: '#ff0420', avalanchec: '#e84142', tron: '#eb0029', sepolia: '#7a7f93' };
const hashColor = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 45% 45%)`; };
export const ASSETS: Asset[] = [...ALL_CHAINS, ...TESTNET_CHAINS].map((c) => ({
  id: c.id, name: c.name, sym: c.symbol, color: BRAND[c.id] ?? hashColor(c.id), chainId: c.evmChainId, evm: c.kind === 'evm', price: 0, change: 0,
  kind: c.kind, decimals: c.decimals, twId: c.twId, native: true,
}));
// User-added EVM networks are first-class native assets in the popup catalog.  The
// background already supports their RPC/send path; keeping them in this same
// catalog makes the home filter, receive picker, and send asset picker share one
// source of truth with the network settings screen.
const customNetworkAssets = (): Asset[] => customNetworks().map((n) => ({
  id: `custom-${n.chainId}`, name: n.name, sym: n.symbol, color: hashColor(`custom-${n.chainId}`),
  chainId: n.chainId, evm: true, price: 0, change: 0, kind: 'evm', decimals: 18, native: true,
}));
// Custom (user-imported) tokens are registered here by tokensStore once their balances load, so Send / Receive /
// Token detail resolve them through the same assetOf() as the built-in native assets.
let customAssets: Asset[] = [];
export const registerCustomAssets = (list: Asset[]) => { customAssets = list; };
export const allAssets = (): Asset[] => [...ASSETS, ...customNetworkAssets(), ...customAssets];
export const assetOf = (id: string) => allAssets().find((a) => a.id === id);
export const EXPLORER: Record<number, string> = Object.fromEntries([...ALL_CHAINS, ...TESTNET_CHAINS].filter((c) => c.evmChainId && c.explorer).map((c) => [c.evmChainId!, c.explorer!]));
const explorerBase = (chainId?: number) => (chainId ? EXPLORER[chainId] ?? customExplorer(chainId) : undefined);
export const explorerTx = (chainId: number | undefined, hash: string) => { const c = chainByEvmId(chainId); if (c) return explorerTxUrl(c, hash); const b = explorerBase(chainId); return b ? `${b}/tx/${hash}` : ''; };
export const explorerAddress = (chainId: number | undefined, addr: string) => { const c = chainByEvmId(chainId); if (c) return explorerAddressUrl(c, addr); const b = explorerBase(chainId); return b ? `${b}/address/${addr}` : ''; };
export const explorerAddressById = (id: string, addr: string) => explorerAddressUrl(chainById(id), addr);

// (Static trending/dApp/buy-provider samples removed: real data now comes from features/ramps + features/discover.)
// Networks for the filter chip row + selector (derived from the home asset set).
export const NETWORKS = ASSETS.map((a) => ({ id: a.id, name: a.name, sym: a.sym, color: a.color, chainId: a.chainId }));
export const networkOptions = () => allAssets().filter((a) => a.native).map((a) => ({ id: a.id, name: a.name, sym: a.sym, color: a.color, chainId: a.chainId }));

export interface Activity { id: string; type: 'send' | 'receive' | 'swap'; sym: string; color: string; amount: string; sub: string; usd: string; time: string; status: 'confirmed' | 'pending'; }


// All app values are USD internally; this converts + formats into the user's base currency (Settings > Currency).
export const usd = (n: number) => money(n);
export const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
