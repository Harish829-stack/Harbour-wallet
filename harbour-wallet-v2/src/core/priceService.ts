import { TW_CATEGORIES, TW_NETWORKS } from './twTaxonomy';
// Live market data via CoinGecko's public API (no key). Best-effort: on any failure returns
// empty/[] so the UI falls back to cached metadata instead of breaking. Runs in the service
// worker (fetch + AbortSignal.timeout are available there).

const COINGECKO_ID: Record<number, string> = {
  1: 'ethereum', 42161: 'ethereum', 8453: 'ethereum', 11155111: 'ethereum',
  56: 'binancecoin', 137: 'matic-network',
};
const timeout = () => AbortSignal.timeout(8000);

// Prices keyed by chainId (back-compat with getBalances USD math).
export async function fetchUsdPrices(chainIds: number[]): Promise<Record<number, number>> {
  const m = await fetchMarket(chainIds);
  const out: Record<number, number> = {};
  for (const [id, v] of Object.entries(m)) out[Number(id)] = v.price;
  return out;
}

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
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=${order}&per_page=50&page=1&price_change_percentage=1h,24h,7d,30d${cat}`, { signal: timeout() });
    if (!res.ok) return [];
    const data = await res.json() as any[];
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
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`, { signal: timeout() });
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd: number; usd_24h_change?: number }>;
    const out: Record<string, { price: number; change: number }> = {};
    for (const [k, v] of Object.entries(data)) if (v?.usd != null) out[k] = { price: v.usd, change: v.usd_24h_change ?? 0 };
    return out;
  } catch { return {}; }
}
