import { getPrices } from '../kit/clients/priceClient';
import { TW_CATEGORIES, TW_NETWORKS } from './twTaxonomy';
import { GATEWAY_URL } from '../kit/endpoints';
import { gtTrendingPools } from '../kit/providers/geckoterminal';
import { ALL_CHAINS } from './chains/index';
// Live market data via CoinGecko's public API (no key). Best-effort: on any failure returns
// empty/[] so the UI falls back to cached metadata instead of breaking. Runs in the service
// worker (fetch + AbortSignal.timeout are available there).

const COINGECKO_ID: Record<number, string> = {
  1: 'ethereum', 42161: 'ethereum', 8453: 'ethereum', 11155111: 'ethereum',
  56: 'binancecoin', 137: 'matic-network',
};
const timeout = () => AbortSignal.timeout(8000);


// Price + 24h change keyed by chainId.
export async function fetchMarket(chainIds: number[]): Promise<Record<number, { price: number; change: number }>> {
  const ids = [...new Set(chainIds.map((c) => COINGECKO_ID[c]).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`, { signal: timeout() });
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd: number; usd_24h_change?: number }>;
    const out: Record<number, { price: number; change: number }> = {};
    for (const [chainId, cg] of Object.entries(COINGECKO_ID)) {
      if (data[cg]?.usd != null) out[Number(chainId)] = { price: data[cg].usd, change: data[cg].usd_24h_change ?? 0 };
    }
    return out;
  } catch { return {}; }
}

export interface Market { id: string; symbol: string; name: string; image: string; price: number; change: number; change1h?: number; change24h?: number; change7d?: number; change30d?: number; marketCap?: number; volume24h?: number; }
// Top tokens by market cap for the Trending tab.
export async function fetchTrending(opts?: { category?: string; order?: string; categoryId?: string; networkCoinId?: number }): Promise<Market[]> {
  try {
    const tc = TW_CATEGORIES.find((c) => c.id === opts?.categoryId);
    const tn = TW_NETWORKS.find((n) => n.coinId === opts?.networkCoinId);
    const order = opts?.order || (tc ? (tc.sortField === 'volume_24h' ? 'volume_desc' : 'market_cap_desc') : 'market_cap_desc');
    const catName = opts?.category || tn?.cgCategory || tc?.cg;
    const cat = catName ? `&category=${encodeURIComponent(catName)}` : '';
    const qs = `vs_currency=usd&order=${order}&per_page=50&page=1&price_change_percentage=1h,24h,7d,30d${cat}`;
    // gateway (cached CoinGecko) first, then CoinGecko direct
    let data: any[] | null = null;
    for (const url of [...(GATEWAY_URL ? [`${GATEWAY_URL}/v2/market/tickers?${qs}`] : []), `https://api.coingecko.com/api/v3/coins/markets?${qs}`]) {
      try { const res = await fetch(url, { signal: timeout() }); if (res.ok) { const j = await res.json(); if (Array.isArray(j)) { data = j; break; } } } catch { /* next */ }
    }
    if (!data) return [];
    return data.map((c) => ({
      id: c.id, symbol: (c.symbol || '').toUpperCase(), name: c.name, image: c.image, price: c.current_price ?? 0,
      change: c.price_change_percentage_24h ?? 0,
      change1h: c.price_change_percentage_1h_in_currency ?? 0,
      change24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0,
      change7d: c.price_change_percentage_7d_in_currency ?? 0,
      change30d: c.price_change_percentage_30d_in_currency ?? 0,
      marketCap: c.market_cap ?? 0, volume24h: c.total_volume ?? 0,
    }));
  } catch { return []; }
}

// Native-asset prices keyed by CoinGecko id (registry `cg`), one request for any number of chains.
export async function fetchNativePrices(cgIds: string[]): Promise<Record<string, { price: number; change: number }>> {
  const ids = [...new Set(cgIds.filter(Boolean))];
  if (!ids.length) return {};
  try { return await getPrices(ids); } catch { return {}; } // gateway -> CoinGecko -> DefiLlama
}

// ---------- hot tokens + trending networks (TW: /v2/market/trending, /v1/hot-tokens) ----------
export interface HotToken { id: string; symbol: string; name: string; image: string; price: number | null; change24h: number | null; rank?: number; source: 'coingecko' | 'geckoterminal'; chainId?: string; address?: string; volume24h?: number }
export interface TrendingNetwork { chainId: string; name: string; tvl: number; change1d?: number }

export function mapCgTrending(body: any): HotToken[] {
  return ((body?.coins ?? []) as any[]).map((c) => c?.item).filter((i) => i?.id).slice(0, 15).map((i) => ({
    id: String(i.id), symbol: String(i.symbol ?? '').toUpperCase(), name: String(i.name ?? ''), image: /^https:\/\//.test(i.large ?? i.small ?? i.thumb ?? '') ? (i.large ?? i.small ?? i.thumb) : '',
    price: Number.isFinite(Number(i.data?.price)) ? Number(i.data.price) : null, change24h: Number.isFinite(Number(i.data?.price_change_percentage_24h?.usd)) ? Number(i.data.price_change_percentage_24h.usd) : null,
    rank: Number.isFinite(Number(i.market_cap_rank)) ? Number(i.market_cap_rank) : undefined, source: 'coingecko' as const,
  }));
}
/** CoinGecko trending (gateway -> direct), then GeckoTerminal trending DEX pools for chains Harbour supports. */
export async function fetchHot(f: typeof fetch = fetch): Promise<{ tokens: HotToken[]; dex: HotToken[] }> {
  let tokens: HotToken[] = [];
  for (const url of [...(GATEWAY_URL ? [`${GATEWAY_URL}/v2/market/trending`] : []), 'https://api.coingecko.com/api/v3/search/trending']) {
    try { const r = await f(url, { signal: timeout() }); if (r.ok) { tokens = mapCgTrending(await r.json()); if (tokens.length) break; } } catch { /* next */ }
  }
  let dex: HotToken[] = [];
  try {
    dex = (await gtTrendingPools(f)).filter((p) => p.chainId).slice(0, 15).map((p) => ({
      id: `token:${p.chainId}:${p.tokenAddress}`, symbol: p.name.split(/\s*\/\s*/)[0].toUpperCase().slice(0, 12), name: p.name, image: '', price: p.priceUsd ?? null, change24h: p.change24h ?? null,
      source: 'geckoterminal' as const, chainId: p.chainId, address: p.tokenAddress, volume24h: p.volume24h,
    }));
  } catch { /* optional */ }
  return { tokens, dex };
}
/** Networks Harbour supports, ranked by DeFi TVL (DefiLlama /v2/chains, keyless). */
export async function fetchTrendingNetworks(f: typeof fetch = fetch): Promise<TrendingNetwork[]> {
  try {
    const r = await f('https://api.llama.fi/v2/chains', { signal: timeout() }); if (!r.ok) return [];
    const rows: any[] = await r.json();
    const byCg = new Map(ALL_CHAINS.filter((c) => c.cg).map((c) => [c.cg!, c]));
    const byEvm = new Map(ALL_CHAINS.filter((c) => c.evmChainId).map((c) => [c.evmChainId!, c]));
    const out: TrendingNetwork[] = []; const seen = new Set<string>();
    for (const row of rows) {
      const c = (row?.chainId != null && byEvm.get(Number(row.chainId))) || (row?.gecko_id && byCg.get(String(row.gecko_id)));
      if (!c || seen.has(c.id) || !(Number(row.tvl) > 0)) continue;
      seen.add(c.id); out.push({ chainId: c.id, name: c.name, tvl: Number(row.tvl) });
    }
    return out.sort((a, b) => b.tvl - a.tvl).slice(0, 20);
  } catch { return []; }
}
