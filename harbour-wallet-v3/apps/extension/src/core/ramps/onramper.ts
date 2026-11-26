// Onramper (fiat on/off-ramp aggregator) through the Harbour backend. The backend holds the Onramper API key and the
// Ed25519 signing key and returns plain JSON; this file only maps it to Harbour's ramp shapes. Nothing here talks to the
// network, so it is unit-testable (test/ramps-onramper.test.js). See documentation/buy-sell-onramper.md.
import type { PaymentCategory, PaymentCategoryId, ProviderState, QuoteResult, RampAsset, RampMode, RampQuote } from './types';
import { chainById } from '../chains/index';

/** One Onramper crypto, as /v1/ramps/config returns it. */
export interface OnramperCrypto { id: string; code: string; name?: string; network: string; networkDisplayName?: string; decimals?: number; address?: string; chainId?: number; icon?: string }
export interface OnramperFiat { id: string; code: string; name?: string; symbol?: string }
export interface OnramperConfig { country: string; type: RampMode; cryptos: OnramperCrypto[]; fiats: OnramperFiat[] }
export interface OnramperQuote { provider: string; payment_method: string; payment_methods?: Array<{ paymentTypeId: string; name?: string; icon?: string }>; rate?: number; payout: number; network_fee?: number; transaction_fee?: number; recommendations?: string[] }
export interface OnramperQuotes { quotes: OnramperQuote[]; unavailable?: string[] }
export interface OnramperOrder { id: string; type: RampMode; status: 'created' | 'pending' | 'completed' | 'canceled' | 'failed'; provider: string; payment_method: string; chain: string; crypto: string; fiat: string; fiat_amount: number | null; crypto_amount: number | null; tx_hash?: string; status_reason?: string; created_at: number; updated_at: number }

export const PAYMENT_CATEGORIES: Record<PaymentCategoryId, string> = {
  card: 'Credit / debit card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank: 'Bank transfer', sepa: 'SEPA bank transfer', ach: 'ACH bank transfer', instant: 'Instant bank payment', other: 'Other',
};
/** Onramper payment type id (creditcard, applepay, sepabanktransfer, upi, pix, ...) -> Harbour payment category. */
export function categoryOf(method: string): PaymentCategoryId {
  const m = String(method ?? '').toLowerCase().replace(/[\s\-]+/g, '_');
  if (m.includes('apple')) return 'apple_pay';
  if (m.includes('google')) return 'google_pay';
  if (m.includes('sepa')) return 'sepa';
  if (m.includes('ach')) return 'ach';
  if (m.includes('open_banking') || m.includes('openbanking') || m.includes('instant') || m.includes('pix') || m.includes('upi') || m.includes('faster') || m.includes('fps') || m.includes('imps')) return 'instant';
  if (m.includes('bank') || m.includes('wire') || m.includes('transfer')) return 'bank';
  if (m.includes('card') || m.includes('credit') || m.includes('debit') || m.includes('visa') || m.includes('master')) return 'card';
  return 'other';
}

// Onramper network names for Harbour networks, used when Onramper gives no EVM chain id. Matching by chain id comes first.
const NETWORK_ALIASES: Record<string, readonly string[]> = {
  ethereum: ['ethereum', 'erc20'], smartchain: ['bsc', 'bnb_smart_chain', 'binance_smart_chain', 'bep20'], polygon: ['polygon', 'matic'],
  arbitrum: ['arbitrum', 'arbitrum_one'], optimism: ['optimism'], base: ['base'], avalanchec: ['avaxcchain', 'avalanche', 'avalanche_c'],
  linea: ['linea'], zksync: ['zksync', 'zksync_era'], celo: ['celo'], fantom: ['fantom'], sonic: ['sonic'], cronos: ['cronos'], mantle: ['mantle'],
  scroll: ['scroll'], blast: ['blast'], xdai: ['gnosis', 'xdai'], moonbeam: ['moonbeam'], ronin: ['ronin'], klaytn: ['klaytn', 'kaia'],
  bitcoin: ['bitcoin', 'btc'], solana: ['solana', 'sol'], tron: ['tron', 'trx', 'trc20'], ton: ['ton', 'the_open_network'], ripple: ['ripple', 'xrp', 'xrpl'],
  stellar: ['stellar', 'xlm'], cosmos: ['cosmos', 'cosmoshub'], polkadot: ['polkadot'], near: ['near'], algorand: ['algorand'], tezos: ['tezos'],
  aptos: ['aptos'], sui: ['sui'], filecoin: ['filecoin'], kava: ['kava'], elrond: ['multiversx', 'elrond'], hedera: ['hedera'], osmosis: ['osmosis'],
};
const ZERO_ADDR = /^(0x0{40}|0xe{40}|0x0+)$/i;
const isNativeCrypto = (c: OnramperCrypto) => !c.address || ZERO_ADDR.test(c.address);
const norm = (s: unknown) => String(s ?? '').toLowerCase().trim();

/** The Onramper crypto for a Harbour ramp asset, or undefined when Onramper does not carry it on that network. */
export function matchCrypto(asset: RampAsset, cryptos: readonly OnramperCrypto[]): OnramperCrypto | undefined {
  const chain = chainById(asset.chainId); if (!chain) return undefined;
  const sym = norm(asset.symbol);
  const aliases = new Set([norm(asset.chainId), ...(NETWORK_ALIASES[asset.chainId] ?? [])]);
  const onChain = (c: OnramperCrypto) => (chain.kind === 'evm' && chain.evmChainId && c.chainId ? c.chainId === chain.evmChainId : aliases.has(norm(c.network)));
  const candidates = cryptos.filter((c) => c && typeof c.id === 'string' && norm(c.code) === sym && onChain(c));
  return candidates.find((c) => (asset.isNative ? isNativeCrypto(c) : !isNativeCrypto(c))) ?? (chain.kind === 'evm' ? undefined : candidates[0]);
}

/** Harbour assets Onramper can serve, each paired with its Onramper crypto. */
export function rampableAssets(assets: readonly RampAsset[], cfg: Pick<OnramperConfig, 'cryptos'>): Array<{ asset: RampAsset; crypto: OnramperCrypto }> {
  const out: Array<{ asset: RampAsset; crypto: OnramperCrypto }> = [];
  for (const asset of assets) { const crypto = matchCrypto(asset, cfg.cryptos); if (crypto) out.push({ asset, crypto }); }
  return out;
}

export const providerLabel = (id: string): string => {
  const known: Record<string, string> = { moonpay: 'MoonPay', banxa: 'Banxa', transak: 'Transak', mercuryo: 'Mercuryo', ramp: 'Ramp Network', rampnetwork: 'Ramp Network', revolut: 'Revolut',
    stripe: 'Stripe', coinbase: 'Coinbase', guardarian: 'Guardarian', alchemypay: 'Alchemy Pay', topper: 'Topper', sardine: 'Sardine', onramp: 'Onramp.money', onrampmoney: 'Onramp.money',
    transfi: 'TransFi', btcdirect: 'BTC Direct', coinify: 'Coinify', utorg: 'UTORG', simplex: 'Simplex', unlimit: 'Unlimit', paybis: 'Paybis', kado: 'Kado' };
  const k = norm(id).replace(/[^a-z0-9]/g, '');
  return known[k] ?? (id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/[_-]+/g, ' ') : 'Provider');
};

/** Quote id carries everything checkout needs: onramper:<category>:<provider>:<payment method>. */
export const quoteId = (cat: PaymentCategoryId, provider: string, method: string) => `onramper:${cat}:${provider}:${method}`;
export function parseQuoteId(id: unknown): { provider: string; paymentMethod: string } | null {
  if (typeof id !== 'string') return null;
  const m = id.match(/^onramper:[a-z_]+:([a-z0-9][a-z0-9_-]{0,47}):([a-z0-9][a-z0-9_-]{0,47})$/);
  return m ? { provider: m[1], paymentMethod: m[2] } : null;
}

const CAT_ORDER: PaymentCategoryId[] = ['card', 'apple_pay', 'google_pay', 'bank', 'sepa', 'ach', 'instant', 'other'];
const fin = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** Backend quotes -> Harbour QuoteResult (one quote per provider and payment method; best payout recommended). Never invents a price. */
export function mapQuotes(res: OnramperQuotes, req: { mode: RampMode; asset: RampAsset; fiat: string; amount: string }): QuoteResult {
  const buy = req.mode === 'buy'; const amount = Number(req.amount);
  const quotes: RampQuote[] = []; const seen = new Set<string>();
  for (const q of Array.isArray(res?.quotes) ? res.quotes : []) {
    const provider = norm(q?.provider); const method = norm(q?.payment_method); const payout = fin(q?.payout);
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(provider) || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(method) || !payout) continue;
    const cat = categoryOf(method); const id = quoteId(cat, provider, method);
    if (seen.has(id)) continue; seen.add(id);
    const pm = (q.payment_methods ?? []).find((x) => norm(x?.paymentTypeId) === method);
    const fee = (fin(q.network_fee) ?? 0) + (fin(q.transaction_fee) ?? 0);
    quotes.push({ id, mode: req.mode, providerId: 'onramper', providerName: providerLabel(provider),
      paymentMethod: { categoryId: cat, label: typeof pm?.name === 'string' && pm.name.trim() ? pm.name.trim().slice(0, 40) : PAYMENT_CATEGORIES[cat], providerName: providerLabel(provider) },
      fiat: { currency: req.fiat, amount: buy ? amount : payout }, crypto: { symbol: req.asset.symbol, amount: buy ? payout : amount },
      feeFiat: buy && fee > 0 ? fee : undefined, isRecommended: false, badges: [] });
  }
  const score = (q: RampQuote) => (buy ? q.crypto.amount : q.fiat.amount) ?? 0;
  const best = quotes.length ? quotes.reduce((a, b) => (score(b) > score(a) ? b : a)) : undefined;
  if (best) { best.isRecommended = true; best.badges = ['IsRecommended', 'BestPrice']; }
  quotes.sort((a, b) => (a.isRecommended === b.isRecommended ? score(b) - score(a) : a.isRecommended ? -1 : 1));
  const cats = [...new Set(quotes.map((q) => q.paymentMethod.categoryId))].sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));
  const categories: PaymentCategory[] = cats.map((id) => ({ id, displayName: PAYMENT_CATEGORIES[id] }));
  const offering = new Set(quotes.map((q) => q.providerName));
  const providers: ProviderState[] = [...offering].map((name) => ({ id: 'onramper', name, state: 'ok' }));
  for (const u of Array.isArray(res?.unavailable) ? res.unavailable : []) {
    const name = providerLabel(String(u)); if (!offering.has(name)) providers.push({ id: 'onramper', name, state: 'unsupported', message: 'Not available for this amount, payment method or region' });
  }
  return { quotes, categories, providers, bestQuoteId: best?.id };
}

/** Checkout pages Harbour will open: https on onramper.com / onramper.dev only. */
export function isTrustedCheckout(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.length > 4096) return false;
  try { const u = new URL(raw); const h = u.hostname.toLowerCase(); return u.protocol === 'https:' && !u.username && !u.password && ['onramper.com', 'onramper.dev'].some((d) => h === d || h.endsWith('.' + d)); } catch { return false; }
}
/** The backend's return page prefix (must be https, no query) that marks a finished checkout tab. */
export function isReturnPrefix(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw) return false;
  try { const u = new URL(raw); return u.protocol === 'https:' && !u.search && !u.hash && !u.username; } catch { return false; }
}

/** Display fields for an order row. */
export function orderView(o: OnramperOrder, cryptos: readonly OnramperCrypto[]) {
  const c = cryptos.find((x) => x.id === o.crypto); const chain = chainById(o.chain);
  const symbol = c?.code?.toUpperCase() ?? o.crypto.split('_')[0].toUpperCase();
  const label: Record<OnramperOrder['status'], string> = { created: 'Waiting for payment', pending: 'Processing', completed: 'Completed', canceled: 'Canceled', failed: 'Failed' };
  return { ...o, symbol, isNative: !!chain && chain.symbol.toUpperCase() === symbol, chainName: chain?.name ?? c?.networkDisplayName ?? o.chain, providerName: providerLabel(o.provider), statusLabel: label[o.status] ?? 'Processing', fiatCode: o.fiat.toUpperCase() };
}
