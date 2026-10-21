// Real price charts + market info for the Token detail screen.
// TW source (evidence: HAR `GET gateway.us.trustwallet.com/v2/market/charts/c<coin>?currency=USD&period=day`
// -> {prices:[{price,date}]}, and `/v2/market/info/c<coin>`) is TW's authenticated gateway and is NOT used.
// Harbour sources, in order: harbour-gateway (CoinGecko with a cached key) -> CoinGecko public API -> DefiLlama
// (coins.llama.fi, keyless). Tokens CoinGecko does not know (asset id `token:<chainId>:<address>`) use GeckoTerminal pools.
// Response shapes follow the public docs; UNVERIFIED live from the build environment (egress blocked there).
import { chainById } from './chains/index';
import { GATEWAY_URL } from '../kit/endpoints';
import { GT_NETWORK, gtChart, gtToken } from '../kit/providers/geckoterminal';
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
/** CoinGecko id for a native asset: the curated map first, then the registry's `cg` field (mainnets only). */
export function coinIdFor(assetId: string): string | undefined {
  if (COINGECKO_COIN[assetId]) return COINGECKO_COIN[assetId];
  const c = chainById(assetId);
  return c && !c.testnet && c.cg ? c.cg : undefined;
}
/** `token:<chainId>:<address>` -> GeckoTerminal network + address. */
export function tokenRef(assetId: string): { network: string; address: string } | null {
  const m = /^token:([a-z0-9-]+):([A-Za-z0-9]{20,64})$/.exec(assetId); if (!m) return null;
  const network = GT_NETWORK[m[1]]; return network ? { network, address: m[2] } : null;
}
const GT_TF: Record<ChartRange, { timeframe: 'minute' | 'hour' | 'day'; aggregate: number; limit: number }> = {
  '1H': { timeframe: 'minute', aggregate: 1, limit: 60 }, '1D': { timeframe: 'minute', aggregate: 15, limit: 96 }, '1W': { timeframe: 'hour', aggregate: 1, limit: 168 },
  '1M': { timeframe: 'hour', aggregate: 4, limit: 180 }, '1Y': { timeframe: 'day', aggregate: 1, limit: 365 }, All: { timeframe: 'day', aggregate: 1, limit: 1000 },
};
/** DefiLlama chart for a CoinGecko id, shaped like CoinGecko's market_chart body. */
const LLAMA_SPAN: Record<ChartRange, { span: number; period: string; back: number }> = {
  '1H': { span: 12, period: '5m', back: 3600 }, '1D': { span: 48, period: '30m', back: 86400 }, '1W': { span: 84, period: '2h', back: 7 * 86400 },
  '1M': { span: 120, period: '6h', back: 30 * 86400 }, '1Y': { span: 365, period: '1d', back: 365 * 86400 }, All: { span: 500, period: '1w', back: 500 * 7 * 86400 },
};
export function mapLlamaChart(body: any, coin: string): { prices: Array<[number, number]> } {
  const pts: any[] = body?.coins?.[`coingecko:${coin}`]?.prices ?? [];
  return { prices: pts.filter((p) => Number.isFinite(p?.timestamp) && Number(p?.price) > 0).map((p) => [Number(p.timestamp) * 1000, Number(p.price)]) };
}

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
  const tok = tokenRef(assetId);
  const coin = tok ? undefined : coinIdFor(assetId);
  if (!coin && !tok) return { ok: false, error: 'No market data: testnet and custom-network coins have no market price.' };
  const key = `chart:${coin ?? assetId}:${range}`; const hit = cache.get(key);
  if (hit && now - hit.at < ttl(range)) return { ok: true, data: hit.v };
  const done = (data: ChartResult) => { cache.set(key, { at: now, v: data }); return { ok: true as const, data }; };
  if (tok) {
    try {
      const data = mapMarketChart({ prices: await gtChart(tok.network, tok.address, GT_TF[range], f) }, range, now);
      if (data.points.length) return done(data);
      return { ok: false, error: 'Not enough price data for this range.' };
    } catch { return hit ? { ok: true, data: hit.v } : { ok: false, error: 'Price chart unavailable for this token.' }; }
  }
  let status = 0;
  // 1) gateway (cached CoinGecko), 2) CoinGecko direct (free tier caps history at 1 year: "All" retries with 365 days)
  const sources = [
    ...(GATEWAY_URL ? [`${GATEWAY_URL}/v2/market/charts?coin=${encodeURIComponent(coin!)}&days=${DAYS[range]}`] : []),
    `${CG}/coins/${coin}/market_chart?vs_currency=usd&days=${DAYS[range]}`,
  ];
  for (const url of sources) {
    try {
      let r = await getJson(url, f);
      if (!r.ok && range === 'All' && r.status !== 429 && url.startsWith(CG)) r = await getJson(`${CG}/coins/${coin}/market_chart?vs_currency=usd&days=365`, f);
      if (r.ok) { const data = mapMarketChart(r.body, range, now); if (data.points.length) return done(data); }
      else if (url.startsWith(CG)) status = r.status;
    } catch { /* next source */ }
  }
  // 3) DefiLlama (keyless) by the same CoinGecko id
  try {
    const sp = LLAMA_SPAN[range]; const start = Math.floor(now / 1000) - sp.back;
    const r = await getJson(`https://coins.llama.fi/chart/coingecko:${coin}?start=${start}&span=${sp.span}&period=${sp.period}`, f);
    if (r.ok) { const data = mapMarketChart(mapLlamaChart(r.body, coin!), range, now); if (data.points.length) return done(data); }
  } catch { /* fall through */ }
  if (hit) return { ok: true, data: hit.v };
  return { ok: false, error: status === 429 ? 'Price data is rate-limited. Try again in a minute.' : 'Price chart unavailable right now.' };
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
  const tok = tokenRef(assetId);
  const coin = tok ? undefined : coinIdFor(assetId);
  if (!coin && !tok) return { ok: false, error: 'No market data: testnet and custom-network coins have no market price.' };
  const key = `info:${coin ?? assetId}`; const hit = cache.get(key);
  if (hit && now - hit.at < 600_000) return { ok: true, data: hit.v };
  const done = (data: MarketInfo) => { cache.set(key, { at: now, v: data }); return { ok: true as const, data }; };
  if (tok) {
    try { const t = await gtToken(tok.network, tok.address, f); return done({ price: t.price, marketCap: t.marketCap ?? t.fdv, volume24h: t.volume24h, total: t.totalSupply }); }
    catch { return hit ? { ok: true, data: hit.v } : { ok: false, error: 'Market info unavailable for this token.' }; }
  }
  const q = `localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
  for (const url of [...(GATEWAY_URL ? [`${GATEWAY_URL}/v2/market/info?coin=${encodeURIComponent(coin!)}`] : []), `${CG}/coins/${coin}?${q}`]) {
    try { const r = await getJson(url, f); if (r.ok && r.body) return done(mapCoinInfo(r.body)); } catch { /* next */ }
  }
  // DefiLlama has no coin profile: price only, so the About tab still shows a live price
  try {
    const r = await getJson(`https://coins.llama.fi/prices/current/coingecko:${coin}`, f);
    const p = Number(r.body?.coins?.[`coingecko:${coin}`]?.price);
    if (r.ok && p > 0) return done({ price: p });
  } catch { /* fall through */ }
  return hit ? { ok: true, data: hit.v } : { ok: false, error: 'Market info unavailable right now.' };
}
