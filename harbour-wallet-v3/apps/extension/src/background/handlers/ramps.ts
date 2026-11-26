// Feature message handlers: ramps (Buy / Sell / Fund / CEX deposit). Every message here is UI-only (the router enforces
// isInternalWalletSender before dispatch). Buy and sell go through Onramper via the Harbour backend, which holds the Onramper
// API key and signing key. The wallet address always comes from the vault (never from the UI payload), mirroring TW's
// `enforceTrustedRampAddress`, and the backend additionally checks an EVM address belongs to this device.
import type { HandlerMap, HandlerCtx } from './types';
import { ensureAccounts, activeEntry } from '../walletState';
import { chainById } from '../../core/chains/index';
import { addressFor } from '../../core/chains/adapters';
import { api } from '../../core/harbour/client';
import {
  RAMP_FIATS, isRampFiat, buildRampAssets, rampAssetById, PAYMENT_CATEGORIES, fetchMarketReference, parseAmount, isPlausibleAddress,
  buildRecurringIcs, buildP2pUrl, isP2pAsset, CEX_PROVIDERS, cexProvider, fetchCexAssets, cexDepositInfo, rampableAssets, mapQuotes, parseQuoteId,
  matchCrypto, isTrustedCheckout, orderView, type CexAssets, type RampMode, type OnramperConfig,
} from '../../core/ramps/index';
import { openCheckoutTab, pollRampOrders } from '../rampsWatch';

const fail = (error: string) => ({ ok: false, error });
const mode = (m: unknown): RampMode | null => (m === 'buy' || m === 'sell' ? m : null);

/** The active account's own address on a chain, from the vault. */
async function ownAddress(ctx: HandlerCtx, chainId: string): Promise<string> {
  const chain = chainById(chainId); if (!chain) throw new Error('Unsupported network');
  const st: any = await ctx.vault.getState();
  const entry = activeEntry(st); if (!entry) throw new Error('No wallet');
  const w = entry[1]; const accounts = ensureAccounts(w); const active = accounts[w.activeAccount] ?? accounts[0];
  const addr = addressFor(chain, active?.addresses ?? {});
  if (!addr || !isPlausibleAddress(chain.kind, addr)) throw new Error(`No valid ${chain.name} address for this account`);
  return addr;
}

// Onramper catalog per mode, cached for 30 minutes (the backend caches for an hour as well).
const cfgCache = new Map<RampMode, { at: number; v: OnramperConfig }>();
async function onramperConfig(m: RampMode): Promise<OnramperConfig> {
  const c = cfgCache.get(m); if (c && Date.now() - c.at < 30 * 60_000) return c.v;
  const v = await api<OnramperConfig>('GET', `/v1/ramps/config?type=${m}`);
  const safe: OnramperConfig = { country: typeof v?.country === 'string' ? v.country : '', type: m, cryptos: Array.isArray(v?.cryptos) ? v.cryptos : [], fiats: Array.isArray(v?.fiats) ? v.fiats : [] };
  cfgCache.set(m, { at: Date.now(), v: safe }); return safe;
}
async function cryptoFor(m: RampMode, assetId: string) {
  const asset = rampAssetById(assetId); if (!asset) return null;
  const crypto = matchCrypto(asset, (await onramperConfig(m)).cryptos); return crypto ? { asset, crypto } : null;
}

const cexCache = new Map<string, { at: number; v: CexAssets }>();
async function cexAssetsCached(id: 'binance-pay' | 'coinbase-pay'): Promise<CexAssets> {
  const c = cexCache.get(id); if (c && Date.now() - c.at < 3600_000) return c.v;
  const v = await fetchCexAssets(id, fetch); if (v.source !== 'registry') cexCache.set(id, { at: Date.now(), v }); return v;
}

export const handlers: HandlerMap = {
  // Catalog for the flow: fiat list + the Harbour assets Onramper carries in the user's region. `providers` stays empty: there
  // are no user-supplied provider keys any more.
  rampsConfig: async () => {
    // Deposit-from-exchange shares this catalog, so an unavailable Onramper must not break it: return an empty asset list and
    // `unavailable` with the reason instead of failing.
    const base = { ok: true, providers: [], categories: PAYMENT_CATEGORIES, cexProviders: CEX_PROVIDERS };
    try {
      const [buy, sell] = await Promise.all([onramperConfig('buy'), onramperConfig('sell').catch(() => null)]);
      const sellIds = new Set(sell ? rampableAssets(buildRampAssets(), sell).map((x) => x.asset.assetId) : []);
      const assets = rampableAssets(buildRampAssets(), buy).map(({ asset }) => ({ ...asset, providers: ['onramper'], sellable: sellIds.has(asset.assetId) }));
      const codes = new Set(buy.fiats.map((f) => String(f.code ?? f.id ?? '').toUpperCase()));
      const fiats = codes.size ? RAMP_FIATS.filter((f) => codes.has(f.code)) : RAMP_FIATS;
      return { ...base, fiats: fiats.length ? fiats : RAMP_FIATS, assets, country: buy.country };
    } catch (e: any) { return { ...base, fiats: RAMP_FIATS, assets: [], unavailable: String(e?.message ?? 'Buying and selling crypto is unavailable right now.') }; }
  },
  rampsQuotes: async (msg, ctx) => {
    const m = mode(msg.mode); if (!m) return fail('Unsupported request');
    if (!isRampFiat(msg.fiat)) return fail('Unsupported currency');
    const amt = parseAmount(msg.amount); if (!amt.ok) return fail(amt.error);
    try {
      const pair = await cryptoFor(m, String(msg.assetId ?? '')); if (!pair) return fail('This crypto is not available to ' + m + ' in your region.');
      const fiat = String(msg.fiat).toLowerCase();
      const qs = new URLSearchParams({ type: m, source: m === 'buy' ? fiat : pair.crypto.id, destination: m === 'buy' ? pair.crypto.id : fiat, amount: amt.value });
      // Some providers only quote with the receiving address (Binance Connect, Simplex, BTC Direct...). It comes from the vault;
      // a locked wallet simply gets the quotes that don't need it.
      if (m === 'buy') { const addr = await ownAddress(ctx, pair.asset.chainId).catch(() => ''); if (addr) qs.set('wallet_address', addr); }
      const res = await api('GET', `/v1/ramps/quotes?${qs.toString()}`);
      return { ok: true, ...mapQuotes(res, { mode: m, asset: pair.asset, fiat: msg.fiat, amount: amt.value }) };
    } catch (e: any) { return fail(e?.message ?? 'Could not get quotes'); }
  },
  rampsMarketRef: async (msg) => {
    const asset = rampAssetById(String(msg.assetId ?? '')); if (!asset || !isRampFiat(msg.fiat)) return fail('Unsupported');
    const rate = await fetchMarketReference(asset.cg, msg.fiat, fetch); return rate ? { ok: true, rate } : fail('Market price unavailable');
  },
  // Creates the order on the backend (which signs the Onramper checkout intent) and opens the provider page from the worker,
  // so the popup can close without losing the follow-up.
  rampsCheckout: async (msg, ctx) => {
    try {
      const m = mode(msg.mode); const q = parseQuoteId(msg.quote?.id);
      if (!m || !q) return fail('Unsupported request');
      if (!isRampFiat(msg.fiat)) return fail('Unsupported currency');
      const amt = parseAmount(msg.amount); if (!amt.ok) return fail(amt.error);
      const pair = await cryptoFor(m, String(msg.assetId ?? '')); if (!pair) return fail('This crypto is not available in your region.');
      const address = m === 'buy' ? await ownAddress(ctx, pair.asset.chainId) : '';
      const fiat = String(msg.fiat).toLowerCase();
      const r = await api<{ order_id: string; checkout_url: string; return_url?: string }>('POST', '/v1/ramps/checkout', {
        type: m, provider: q.provider, payment_method: q.paymentMethod, source: m === 'buy' ? fiat : pair.crypto.id, destination: m === 'buy' ? pair.crypto.id : fiat,
        network: pair.crypto.network, chain: pair.asset.chainId, amount: amt.value, ...(address ? { address } : {}),
      });
      if (!isTrustedCheckout(r?.checkout_url)) return fail('The provider link was blocked because it is not a secure Onramper page.');
      await openCheckoutTab(r.checkout_url, r.return_url);
      return { ok: true, opened: true, orderId: r.order_id, providerName: msg.quote?.providerName ?? 'the provider', address };
    } catch (e: any) { return fail(e?.message ?? 'Could not open the provider'); }
  },
  rampsOrders: async () => {
    try {
      const orders = await pollRampOrders();
      const cryptos = (await onramperConfig('buy').catch(() => null))?.cryptos ?? [];
      return { ok: true, orders: orders.map((o) => orderView(o, cryptos)) };
    } catch (e: any) { return fail(e?.message ?? 'Could not load orders'); }
  },
  rampsRecurringIcs: async (msg) => {
    const asset = rampAssetById(String(msg.assetId ?? '')); const amt = parseAmount(msg.amount);
    if (!asset || !isRampFiat(msg.fiat) || !amt.ok || (msg.frequency !== 'weekly' && msg.frequency !== 'monthly')) return fail('Invalid recurring buy');
    const start = new Date(String(msg.start)); if (Number.isNaN(start.getTime())) return fail('Invalid start date');
    const uid = `buy-${asset.assetId.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString(36)}`;
    const ics = buildRecurringIcs({ uid, title: `Buy ${amt.value} ${msg.fiat} of ${asset.symbol} (Harbour recurring buy)`, description: `Open Harbour Wallet > Fund > Buy crypto to make this ${msg.frequency} purchase. Prices and providers may change; always review the quote.`, freq: msg.frequency, start });
    return { ok: true, ics, filename: `harbour-recurring-buy-${asset.symbol.toLowerCase()}.ics` };
  },
  rampsP2pUrl: async (msg) => { try { if (!isP2pAsset(msg.asset)) return fail('Asset not available on P2P'); return { ok: true, url: buildP2pUrl(msg.asset, String(msg.fiat)) }; } catch (e: any) { return fail(e?.message ?? 'Invalid request'); } },

  // ---- Fund > Deposit from exchange (TW /fund/cex/*)
  cexProviders: async () => ({ ok: true, providers: CEX_PROVIDERS }),
  cexAssets: async (msg) => { const p = cexProvider(msg.providerId); if (!p) return fail('Unknown exchange'); return { ok: true, ...(await cexAssetsCached(p.id)) }; },
  cexDeposit: async (msg, ctx) => {
    try {
      const p = cexProvider(msg.providerId); if (!p) return fail('Unknown exchange');
      const list = await cexAssetsCached(p.id); const asset = list.assets.find((a) => a.key === msg.assetKey); if (!asset) return fail('Asset not available');
      const address = await ownAddress(ctx, asset.chainId);
      return { ok: true, asset, address, source: list.source, ...cexDepositInfo(p.id, asset, address) };
    } catch (e: any) { return fail(e?.message ?? 'Could not prepare the deposit'); }
  },
};
