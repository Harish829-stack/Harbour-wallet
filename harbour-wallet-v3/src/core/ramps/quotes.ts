// Quote aggregation: asks every provider that supports the asset/mode, never fabricates a number, and reports each provider's state
// (needs key / unsupported / error / widget only) so the UI can show an explicit reason. Output mirrors TW's `providerRoutes.onramp`
// ({quotes, paymentCategories}) with quotes grouped per payment category (TW chunk buy-*.js `useBuyProviderRoutes`).
import type { Fetcher, PaymentCategory, PaymentCategoryId, ProviderState, QuoteRequest, QuoteResult, RampKeys, RampQuote } from './types';
import { PROVIDERS, ProviderError, PAYMENT_CATEGORIES, keysFor } from './providers';
import { parseAmount } from './guard';
import { isRampFiat } from './fiat';

const CAT_ORDER: PaymentCategoryId[] = ['card', 'apple_pay', 'google_pay', 'bank', 'sepa', 'ach', 'instant', 'other'];

export async function getRampQuotes(req: QuoteRequest, all: RampKeys | undefined, f: Fetcher): Promise<QuoteResult> {
  const amt = parseAmount(req.amount);
  if (!amt.ok) throw new Error(amt.error);
  if (!isRampFiat(req.fiat)) throw new Error('Unsupported currency');
  const providers: ProviderState[] = []; const quotes: RampQuote[] = [];
  await Promise.all(PROVIDERS.map(async (p) => {
    const base = { id: p.id, name: p.name };
    if (!p.modes.includes(req.mode)) { providers.push({ ...base, state: 'unsupported', message: `${p.name} does not support ${req.mode}` }); return; }
    const code = p.code(req.asset);
    if (!code) { providers.push({ ...base, state: 'unsupported', message: `${req.asset.symbol} on ${req.asset.chainName} is not available` }); return; }
    const keys = keysFor(all, p.id);
    const miss = p.quoteNeeds.filter((k) => !keys[k]);
    if (miss.length) { providers.push({ ...base, state: 'needs_key', message: `Needs API key: ${p.keyFields.filter((k) => miss.includes(k.field)).map((k) => k.label).join(', ')}` }); return; }
    if (p.widgetOnly || !p.quote) {
      providers.push({ ...base, state: 'widget_only', message: 'Price is shown inside the provider widget' });
      quotes.push({ id: `${p.id}:other`, mode: req.mode, providerId: p.id, providerName: p.name, paymentMethod: { categoryId: 'other', label: 'Choose in widget' },
        fiat: { currency: req.fiat, amount: req.mode === 'buy' ? amt.num : 0 }, crypto: { symbol: req.asset.symbol, amount: req.mode === 'buy' ? null : amt.num }, isRecommended: false, badges: [] });
      return;
    }
    try {
      const qs = await p.quote(req, code, keys, f);
      quotes.push(...qs); providers.push({ ...base, state: 'ok' });
    } catch (e: any) {
      const kind = e instanceof ProviderError ? e.kind : 'error';
      providers.push({ ...base, state: kind === 'unsupported' ? 'unsupported' : kind === 'needs_key' ? 'needs_key' : 'error', message: String(e?.message ?? 'Quote failed').slice(0, 200) });
    }
  }));
  providers.sort((a, b) => PROVIDERS.findIndex((p) => p.id === a.id) - PROVIDERS.findIndex((p) => p.id === b.id));
  const priced = quotes.filter((q) => (req.mode === 'buy' ? q.crypto.amount : q.fiat.amount) as number > 0);
  const score = (q: RampQuote) => (req.mode === 'buy' ? q.crypto.amount : q.fiat.amount) ?? 0;
  const best = priced.length ? priced.reduce((a, b) => (score(b) > score(a) ? b : a)) : undefined;
  for (const q of quotes) { q.badges = []; q.isRecommended = false; }
  if (best) { best.isRecommended = true; best.badges = ['IsRecommended', 'BestPrice']; }
  quotes.sort((a, b) => (a.isRecommended === b.isRecommended ? score(b) - score(a) : a.isRecommended ? -1 : 1));
  const cats = [...new Set(quotes.map((q) => q.paymentMethod.categoryId))].sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
  const categories: PaymentCategory[] = cats.map((id) => ({ id, displayName: PAYMENT_CATEGORIES[id] }));
  return { quotes, categories, providers, bestQuoteId: best?.id };
}

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
