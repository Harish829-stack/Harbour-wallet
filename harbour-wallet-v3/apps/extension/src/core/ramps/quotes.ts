// Quote helpers shared by the ramp screens: grouping by payment category and an indicative market reference. Quotes themselves
// come from Onramper through the Harbour backend (onramper.ts mapQuotes); nothing here fabricates a provider price.
import type { Fetcher, PaymentCategory, QuoteResult, RampQuote } from './types';
import { isRampFiat } from './fiat';

export interface CategoryGroup { category: PaymentCategory; quotes: RampQuote[]; recommended: RampQuote }
export function groupByCategory(r: Pick<QuoteResult, 'quotes' | 'categories'>): CategoryGroup[] {
  return r.categories.map((category) => {
    const quotes = r.quotes.filter((q) => q.paymentMethod.categoryId === category.id);
    return { category, quotes, recommended: quotes.find((q) => q.isRecommended) ?? quotes[0] };
  }).filter((g) => g.quotes.length > 0);
}

// ---- indicative market reference (CoinGecko public price; NOT a provider quote) ----
const cache = new Map<string, { at: number; v: number | null }>();
export async function fetchMarketReference(cg: string | undefined, fiat: string, f: Fetcher, now = Date.now()): Promise<number | null> {
  if (!cg || !/^[a-z0-9-]{2,60}$/.test(cg) || !isRampFiat(fiat)) return null;
  const k = `${cg}:${fiat}`; const c = cache.get(k);
  if (c && now - c.at < 60_000) return c.v;
  try {
    const res = await f(`https://api.coingecko.com/api/v3/simple/price?ids=${cg}&vs_currencies=${fiat.toLowerCase()}`, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j: any = await res.json(); const v = Number(j?.[cg]?.[fiat.toLowerCase()]);
    const val = Number.isFinite(v) && v > 0 ? v : null; cache.set(k, { at: now, v: val }); return val;
  } catch { return null; }
}
