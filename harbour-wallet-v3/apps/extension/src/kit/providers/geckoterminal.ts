// GeckoTerminal public API (api.geckoterminal.com/api/v2, keyless, ~30 calls/min): DEX token prices, OHLCV charts and
// trending pools. Used for tokens CoinGecko does not list and for "hot" DEX tokens. Through harbour-gateway `/gt/*` when
// configured (cached), else direct. Shapes follow the public docs (JSON:API); unverified live from the build sandbox.
import { GATEWAY_URL } from '../endpoints';

type F = typeof fetch;
export const GT_BASE = GATEWAY_URL ? `${GATEWAY_URL}/gt` : 'https://api.geckoterminal.com/api/v2';
/** Harbour chain id -> GeckoTerminal network slug. */
export const GT_NETWORK: Record<string, string> = {
  ethereum: 'eth', smartchain: 'bsc', polygon: 'polygon_pos', arbitrum: 'arbitrum', base: 'base', optimism: 'optimism', avalanchec: 'avax',
  solana: 'solana', tron: 'tron', ton: 'ton', sui: 'sui-network', aptos: 'aptos', zksync: 'zksync', linea: 'linea', scroll: 'scroll', blast: 'blast',
  mantle: 'mantle', fantom: 'ftm', cronos: 'cro', celo: 'celo', gnosis: 'xdai', sonic: 'sonic', opbnb: 'opbnb',
};
export const gtChainOf = (slug: string) => Object.entries(GT_NETWORK).find(([, s]) => s === slug)?.[0];

async function gtGet(f: F, path: string): Promise<any> {
  const r = await f(`${GT_BASE}${path}`, { headers: { accept: 'application/json;version=20230302' }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}
const num = (v: unknown): number | undefined => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };

export interface GtToken { price?: number; fdv?: number; marketCap?: number; volume24h?: number; totalSupply?: number; name?: string; symbol?: string; topPool?: string }
export async function gtToken(network: string, address: string, f: F = fetch): Promise<GtToken> {
  const j = await gtGet(f, `/networks/${network}/tokens/${encodeURIComponent(address)}`);
  const a = j?.data?.attributes ?? {};
  const pool = j?.data?.relationships?.top_pools?.data?.[0]?.id as string | undefined; // "<network>_<poolAddress>"
  return { price: num(a.price_usd), fdv: num(a.fdv_usd), marketCap: num(a.market_cap_usd), volume24h: num(a.volume_usd?.h24), totalSupply: num(a.normalized_total_supply ?? a.total_supply), name: a.name, symbol: a.symbol, topPool: pool?.includes('_') ? pool.slice(pool.indexOf('_') + 1) : undefined };
}

/** OHLCV close prices for the token's top pool. timeframe: minute|hour|day. Points are [ms, usd]. */
export async function gtChart(network: string, address: string, tf: { timeframe: 'minute' | 'hour' | 'day'; aggregate: number; limit: number }, f: F = fetch): Promise<Array<[number, number]>> {
  const t = await gtToken(network, address, f);
  if (!t.topPool) throw new Error('No liquidity pool for this token');
  const j = await gtGet(f, `/networks/${network}/pools/${t.topPool}/ohlcv/${tf.timeframe}?aggregate=${tf.aggregate}&limit=${tf.limit}&currency=usd&token=${encodeURIComponent(address)}`);
  const rows: any[] = j?.data?.attributes?.ohlcv_list ?? [];
  return rows.filter((r) => Array.isArray(r) && Number.isFinite(Number(r[0])) && Number(r[4]) > 0).map((r) => [Number(r[0]) * 1000, Number(r[4])] as [number, number]);
}

export interface HotPool { network: string; chainId?: string; name: string; tokenAddress: string; priceUsd?: number; change24h?: number; volume24h?: number; poolAddress: string }
export async function gtTrendingPools(f: F = fetch): Promise<HotPool[]> {
  const j = await gtGet(f, `/networks/trending_pools?page=1`);
  return ((j?.data ?? []) as any[]).map((p) => {
    const a = p?.attributes ?? {}; const network = String(p?.relationships?.network?.data?.id ?? '');
    const base = String(p?.relationships?.base_token?.data?.id ?? ''); // "<network>_<address>"
    return { network, chainId: gtChainOf(network), name: String(a.name ?? '').slice(0, 60), tokenAddress: base.includes('_') ? base.slice(base.indexOf('_') + 1) : '', priceUsd: num(a.base_token_price_usd), change24h: num(a.price_change_percentage?.h24), volume24h: num(a.volume_usd?.h24), poolAddress: String(a.address ?? '') };
  }).filter((p) => p.name && p.tokenAddress);
}
