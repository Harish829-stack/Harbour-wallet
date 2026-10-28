import { customExplorer, customNetworks } from '../../core/networkRegistry';
import { ALL_CHAINS, TESTNET_CHAINS, ENABLED_CHAINS, chainByEvmId, chainById, explorerTxUrl, explorerAddressUrl, type ChainKind } from '../../core/chains/index';
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
// Harbour v3: only the networks the Harbour backend serves.
export const ASSETS: Asset[] = ENABLED_CHAINS.map((c) => ({
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
/** Explorer links for any chain by registry id (non-EVM chains included). */
export const explorerTxById = (id: string, hash: string) => explorerTxUrl(chainById(id), hash);
export const explorerAddressById = (id: string, addr: string) => explorerAddressUrl(chainById(id), addr);

// (Static trending/dApp/buy-provider samples removed: real data now comes from features/ramps + features/discover.)
// Networks for the filter chip row + selector (derived from the home asset set).
export const NETWORKS = ASSETS.map((a) => ({ id: a.id, name: a.name, sym: a.sym, color: a.color, chainId: a.chainId }));
export const networkOptions = () => allAssets().filter((a) => a.native).map((a) => ({ id: a.id, name: a.name, sym: a.sym, color: a.color, chainId: a.chainId }));

export interface Activity { id: string; type: 'send' | 'receive' | 'swap'; sym: string; color: string; amount: string; sub: string; usd: string; time: string; status: 'confirmed' | 'pending'; }
export const ACTIVITY: Activity[] = [
  { id: 'a1', type: 'receive', sym: 'ETH', color: '#6372f0', amount: '+0.250 ETH', sub: 'From 0x7a…3Df1', usd: '$795.11', time: 'Today 10:24', status: 'confirmed' },
  { id: 'a2', type: 'send', sym: 'POL', color: '#8247e5', amount: '-120 POL', sub: 'To 0x19…9c0b', usd: '$62.40', time: 'Yesterday', status: 'confirmed' },
  { id: 'a3', type: 'swap', sym: 'BNB', color: '#d9a21b', amount: '0.5 BNB → 1.2k CAKE', sub: 'PancakeDEX', usd: '$306.05', time: 'Mar 12', status: 'confirmed' },
  { id: 'a4', type: 'send', sym: 'ETH', color: '#6372f0', amount: '-0.05 ETH', sub: 'To 0xab…77e2', usd: '$159.02', time: 'Mar 10', status: 'confirmed' },
];

// A 24-point sample sparkline (0..1) for token-detail charts.
export const SPARK = [0.42, 0.45, 0.4, 0.5, 0.55, 0.52, 0.6, 0.58, 0.63, 0.7, 0.66, 0.72, 0.68, 0.75, 0.8, 0.78, 0.74, 0.82, 0.88, 0.85, 0.9, 0.86, 0.92, 1.0];

// All app values are USD internally; this converts + formats into the user's base currency (Settings > Currency).
export const usd = (n: number) => money(n);
export const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
