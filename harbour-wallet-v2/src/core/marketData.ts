// Real price charts + market info for the Token detail screen.
// TW source (evidence: HAR `GET gateway.us.trustwallet.com/v2/market/charts/c<coin>?currency=USD&period=day`
// -> {prices:[{price,date}]}, and `/v2/market/info/c<coin>`) is TW's authenticated gateway and is NOT used.
// Harbour source: CoinGecko public API (no key). Response shapes follow the public docs; UNVERIFIED live
// from the build environment (egress blocked there).
export type ChartRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All';
export const CHART_RANGES: ChartRange[] = ['1H', '1D', '1W', '1M', '1Y', 'All'];
export interface ChartPoint { t: number; p: number } // ms epoch, USD
export interface ChartResult { points: ChartPoint[]; changePct: number | null; last: number | null }
export interface MarketInfo { description?: string; marketCap?: number; volume24h?: number; circulating?: number; total?: number; website?: string; change24h?: number; price?: number }

// Harbour asset id -> CoinGecko coin id. Testnets have no market, so no entry.
export const COINGECKO_COIN: Record<string, string> = {
  ethereum: 'ethereum', arbitrum: 'ethereum', base: 'ethereum', smartchain: 'binancecoin', polygon: 'matic-network', bitcoin: 'bitcoin', solana: 'solana',
};
const DAYS: Record<ChartRange, string> = { '1H': '1', '1D': '1', '1W': '7', '1M': '30', '1Y': '365', All: 'max' };

export function mapMarketChart(body: any, range: ChartRange, now = Date.now()): ChartResult {
  const raw: any[] = Array.isArray(body?.prices) ? body.prices : [];
  let points: ChartPoint[] = raw
    .filter((r) => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] > 0)
    .map((r) => ({ t: Number(r[0]), p: Number(r[1]) }))
    .sort((a, b) => a.t - b.t);
  if (range === '1H') points = points.filter((x) => x.t >= now - 3_600_000);
  if (points.length < 2) return { points: [], changePct: null, last: points[0]?.p ?? null };
  const first = points[0].p; const last = points[points.length - 1].p;
  return { points, last, changePct: ((last - first) / first) * 100 };
}

type F = typeof fetch;
const CG = 'https://api.coingecko.com/api/v3';
const cache = new Map<string, { at: number; v: any }>();
const ttl = (r: ChartRange) => (r === '1H' || r === '1D' ? 60_000 : 600_000);
async function getJson(url: string, f: F): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await f(url, { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' } });
  let body: any = null; try { body = await res.json(); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, body };
}

export async function fetchChart(assetId: string, range: ChartRange, f: F = fetch, now = Date.now()): Promise<{ ok: true; data: ChartResult } | { ok: false; error: string }> {
  const coin = COINGECKO_COIN[assetId];
  if (!coin) return { ok: false, error: 'No market data: testnet and custom-network coins have no market price.' };
  const key = `chart:${coin}:${range}`; const hit = cache.get(key);
  if (hit && now - hit.at < ttl(range)) return { ok: true, data: hit.v };
  try {
    let r = await getJson(`${CG}/coins/${coin}/market_chart?vs_currency=usd&days=${DAYS[range]}`, f);
    // The free tier caps history at 1 year; fall back so "All" still draws something real.
    if (!r.ok && range === 'All' && r.status !== 429) r = await getJson(`${CG}/coins/${coin}/market_chart?vs_currency=usd&days=365`, f);
    if (!r.ok) { if (hit) return { ok: true, data: hit.v }; return { ok: false, error: r.status === 429 ? 'Price data is rate-limited. Try again in a minute.' : 'Price chart unavailable right now.' }; }
    const data = mapMarketChart(r.body, range, now);
    if (!data.points.length) return { ok: false, error: 'Not enough price data for this range.' };
    cache.set(key, { at: now, v: data });
    return { ok: true, data };
  } catch { return hit ? { ok: true, data: hit.v } : { ok: false, error: 'Price chart unavailable right now.' }; }
}

export function mapCoinInfo(body: any): MarketInfo {
  const md = body?.market_data ?? {};
  const strip = (s: unknown) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const desc = strip(body?.description?.en);
  const site = Array.isArray(body?.links?.homepage) ? body.links.homepage.find((x: string) => /^https:\/\//.test(x)) : undefined;
  return {
    description: desc ? desc.slice(0, 900) : undefined, website: site,
    marketCap: md.market_cap?.usd, volume24h: md.total_volume?.usd, circulating: md.circulating_supply, total: md.total_supply ?? undefined,
    change24h: md.price_change_percentage_24h, price: md.current_price?.usd,
  };
}
export async function fetchInfo(assetId: string, f: F = fetch, now = Date.now()): Promise<{ ok: true; data: MarketInfo } | { ok: false; error: string }> {
  const coin = COINGECKO_COIN[assetId];
  if (!coin) return { ok: false, error: 'No market data: testnet and custom-network coins have no market price.' };
  const key = `info:${coin}`; const hit = cache.get(key);
  if (hit && now - hit.at < 600_000) return { ok: true, data: hit.v };
  try {
    const r = await getJson(`${CG}/coins/${coin}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`, f);
    if (!r.ok) return hit ? { ok: true, data: hit.v } : { ok: false, error: 'Market info unavailable right now.' };
    const data = mapCoinInfo(r.body); cache.set(key, { at: now, v: data });
    return { ok: true, data };
  } catch { return hit ? { ok: true, data: hit.v } : { ok: false, error: 'Market info unavailable right now.' }; }
}
