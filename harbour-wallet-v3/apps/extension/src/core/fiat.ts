// Base-currency conversion + formatting.
//
// TW evidence (HAR, `GET gateway.us.trustwallet.com/v2/market/rates?currency=ETH` -> `[{"currency":"ETH","value":2450.05}]`):
// the extension asks for ONE currency at a time and gets the USD value of 1 unit of it [likely: value is USD per unit;
// ETH=2450 only makes sense that way]. That endpoint is TW's authenticated gateway and is NOT used. Harbour keeps the
// same semantics (`usdPer[code]` = USD value of 1 unit) but sources them from two public, key-less APIs:
//   fiat   : open.er-api.com  GET /v6/latest/USD  -> { result:'success', rates:{ EUR:0.92, ... } }  (units per USD)
//   crypto : CoinGecko        GET /api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd
// Shapes follow the public docs and are UNVERIFIED live from the build environment (egress blocked there).
import { FIAT_TABLE } from './fiatTable';
import { intlTag } from './settings';

export interface BaseCurrency { code: string; name: string; rating: number; isCrypto: boolean }
export const BASE_CURRENCIES: BaseCurrency[] = FIAT_TABLE.map(([code, name, rating, isCrypto]) => ({ code, name, rating, isCrypto }));
export const CURRENCY_CODES: ReadonlySet<string> = new Set(BASE_CURRENCIES.map((c) => c.code));
export const POPULAR_CURRENCIES = BASE_CURRENCIES.filter((c) => c.rating > 0);
export const OTHER_CURRENCIES = BASE_CURRENCIES.filter((c) => c.rating === 0);
export const isCryptoCurrency = (code: string) => BASE_CURRENCIES.find((c) => c.code === code)?.isCrypto ?? false;

const COINGECKO_IDS: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin' };
export const RATES_TTL_MS = 30 * 60_000;

export type UsdPer = Record<string, number>; // USD value of 1 unit of CODE
const pos = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function mapRates(erApi: any, coingecko: any): UsdPer {
  const out: UsdPer = { USD: 1 };
  const rates = erApi?.result === 'success' || erApi?.rates ? erApi?.rates : null;
  if (rates && typeof rates === 'object') {
    for (const [code, perUsd] of Object.entries(rates)) if (CURRENCY_CODES.has(code) && !isCryptoCurrency(code) && pos(perUsd)) out[code] = 1 / (perUsd as number);
  }
  for (const [code, id] of Object.entries(COINGECKO_IDS)) { const p = coingecko?.[id]?.usd; if (pos(p)) out[code] = p; }
  out.USD = 1;
  return out;
}

type F = typeof fetch;
const getJson = async (url: string, f: F) => {
  const res = await f(url, { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
export async function fetchRates(f: F = fetch): Promise<UsdPer> {
  const [fiat, crypto] = await Promise.allSettled([
    getJson('https://open.er-api.com/v6/latest/USD', f),
    getJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd', f),
  ]);
  const table = mapRates(fiat.status === 'fulfilled' ? fiat.value : null, crypto.status === 'fulfilled' ? crypto.value : null);
  if (Object.keys(table).length <= 1) throw new Error('rates unavailable');
  return table;
}

export interface RateStore { get: () => Promise<{ at: number; usdPer: UsdPer } | undefined>; set: (v: { at: number; usdPer: UsdPer }) => Promise<void> }
// Cached rate for one currency. Fresh cache wins; otherwise fetch; if the fetch fails, a stale cache is better than
// nothing (flagged `stale`), and only if the code was never priced do we report failure.
export async function getRate(code: string, store: RateStore, f: F = fetch, now = Date.now()): Promise<{ ok: true; usdPer: number; stale: boolean } | { ok: false; error: string }> {
  if (!CURRENCY_CODES.has(code)) return { ok: false, error: 'Unsupported currency' };
  if (code === 'USD') return { ok: true, usdPer: 1, stale: false };
  const cached = await store.get();
  if (cached && now - cached.at < RATES_TTL_MS && pos(cached.usdPer[code])) return { ok: true, usdPer: cached.usdPer[code], stale: false };
  try {
    const usdPer = await fetchRates(f);
    // Keep earlier values for codes the new response lacked (e.g. CoinGecko down but fiat up).
    const merged = { ...(cached?.usdPer ?? {}), ...usdPer };
    await store.set({ at: now, usdPer: merged });
    if (pos(merged[code])) return { ok: true, usdPer: merged[code], stale: !pos(usdPer[code]) };
    return { ok: false, error: `No rate for ${code} right now.` };
  } catch {
    if (cached && pos(cached.usdPer[code])) return { ok: true, usdPer: cached.usdPer[code], stale: true };
    return { ok: false, error: `Couldn't load the ${code} exchange rate. Check your connection and try again.` };
  }
}

// ---------- formatting ----------
export interface FiatCtx { code: string; usdPer: number; locale: string }
export const USD_CTX: FiatCtx = { code: 'USD', usdPer: 1, locale: 'en' };
export const toFiat = (usd: number, ctx: FiatCtx) => usd / ctx.usdPer;

const nf = (locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat => {
  try { return new Intl.NumberFormat(intlTag(locale), opts); } catch { return new Intl.NumberFormat('en', opts); }
};
const trimDecimals = (n: number, max: number, locale: string) => nf(locale, { maximumFractionDigits: max }).format(n);

// TW: fiat -> max 2 significant decimals with a "<$0.01" floor; crypto base currency -> up to 8 decimals.
export function formatFiat(usd: number, ctx: FiatCtx): string {
  const v = toFiat(usd, ctx);
  if (!Number.isFinite(v)) return '—';
  if (isCryptoCurrency(ctx.code)) {
    if (v !== 0 && Math.abs(v) < 1e-8) return `<${trimDecimals(1e-8, 8, ctx.locale)} ${ctx.code}`;
    return `${trimDecimals(v, 8, ctx.locale)} ${ctx.code}`;
  }
  const f = nf(ctx.locale, { style: 'currency', currency: ctx.code });
  const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
  const min = 10 ** -digits;
  if (v !== 0 && Math.abs(v) < min) return `<${f.format(min)}`;
  return f.format(v);
}
export const formatFiatSigned = (usd: number, ctx: FiatCtx) => `${usd > 0 ? '+' : ''}${formatFiat(usd, ctx)}`;

// Prices keep significant digits for tiny values (matches Trending): 0.00001234 -> 0.00001234 not 0.00.
export function formatFiatPrice(usd: number, ctx: FiatCtx): string {
  const v = toFiat(usd, ctx);
  if (!Number.isFinite(v) || v === 0) return formatFiat(0, ctx);
  if (isCryptoCurrency(ctx.code)) return formatFiat(usd, ctx);
  const a = Math.abs(v);
  if (a >= 1) return nf(ctx.locale, { style: 'currency', currency: ctx.code }).format(v);
  if (a >= 0.01) return nf(ctx.locale, { style: 'currency', currency: ctx.code, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);
  return nf(ctx.locale, { style: 'currency', currency: ctx.code, minimumSignificantDigits: 2, maximumSignificantDigits: 4 }).format(v);
}
export function formatFiatCompact(usd: number, ctx: FiatCtx): string {
  const v = toFiat(usd, ctx);
  if (!Number.isFinite(v)) return '—';
  if (isCryptoCurrency(ctx.code)) return `${nf(ctx.locale, { notation: 'compact', maximumFractionDigits: 2 }).format(v)} ${ctx.code}`;
  return nf(ctx.locale, { style: 'currency', currency: ctx.code, notation: 'compact', maximumFractionDigits: 2 }).format(v);
}
