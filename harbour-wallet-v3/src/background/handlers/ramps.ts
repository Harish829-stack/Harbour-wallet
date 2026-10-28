// Feature message handlers: ramps (Buy / Sell / Fund / CEX deposit / Ramp API keys). Every message here is UI-only (the router enforces
// isInternalWalletSender before dispatch). Quotes and widget URLs are built HERE, in the service worker, and the wallet address always comes
// from the vault (never from the UI payload), mirroring TW's `enforceTrustedRampAddress`.
import type { HandlerMap, HandlerCtx } from './types';
import { local } from '../../core/storage';
import { ensureAccounts, activeEntry } from '../walletState';
import { chainById } from '../../core/chains/index';
import { addressFor } from '../../core/chains/adapters';
import {
  RAMP_FIATS, isRampFiat, buildRampAssets, rampAssetById, PROVIDERS, providerById, PAYMENT_CATEGORIES, getRampQuotes, fetchMarketReference, parseAmount, isPlausibleAddress,
  buildCheckoutUrl, ProviderError, normalizeKeys, setProviderKeys, describeKeys, RAMP_KEYS_STORAGE, keysFor, buildRecurringIcs, buildP2pUrl, isP2pAsset,
  CEX_PROVIDERS, cexProvider, fetchCexAssets, cexDepositInfo, type CexAssets, type PaymentCategoryId, type RampMode, type RampKeys,
} from '../../core/ramps/index';

const readKeys = async (): Promise<RampKeys> => normalizeKeys(await local.get(RAMP_KEYS_STORAGE));
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

const cexCache = new Map<string, { at: number; v: CexAssets }>();
async function cexAssetsCached(id: 'binance-pay' | 'coinbase-pay'): Promise<CexAssets> {
  const c = cexCache.get(id); if (c && Date.now() - c.at < 3600_000) return c.v;
  const v = await fetchCexAssets(id, fetch); if (v.source !== 'registry') cexCache.set(id, { at: Date.now(), v }); return v;
}

export const handlers: HandlerMap = {
  // Static catalog for the flow: fiat list + ramp-able assets (each with the providers that carry it) + provider descriptors (never key values).
  rampsConfig: async () => {
    const keys = await readKeys();
    const assets = buildRampAssets().map((a) => ({ ...a, providers: PROVIDERS.filter((p) => p.code(a)).map((p) => p.id) })).filter((a) => a.providers.length > 0);
    return { ok: true, fiats: RAMP_FIATS, assets, providers: describeKeys(keys), categories: PAYMENT_CATEGORIES, cexProviders: CEX_PROVIDERS };
  },
  rampsQuotes: async (msg) => {
    const m = mode(msg.mode); const asset = rampAssetById(String(msg.assetId ?? ''));
    if (!m || !asset) return fail('Unsupported asset');
    if (!isRampFiat(msg.fiat)) return fail('Unsupported currency');
    const amt = parseAmount(msg.amount); if (!amt.ok) return fail(amt.error);
    try { return { ok: true, ...(await getRampQuotes({ mode: m, asset, fiat: msg.fiat, amount: amt.value }, await readKeys(), fetch)) }; } catch (e: any) { return fail(e?.message ?? 'Quote failed'); }
  },
  rampsMarketRef: async (msg) => {
    const asset = rampAssetById(String(msg.assetId ?? '')); if (!asset || !isRampFiat(msg.fiat)) return fail('Unsupported');
    const rate = await fetchMarketReference(asset.cg, msg.fiat, fetch); return rate ? { ok: true, rate } : fail('Market price unavailable');
  },
  rampsCheckout: async (msg, ctx) => {
    try {
      const m = mode(msg.mode); const asset = rampAssetById(String(msg.assetId ?? '')); const q = msg.quote ?? {};
      const p = providerById(q.providerId);
      if (!m || !asset || !p) return fail('Unsupported request');
      if (!isRampFiat(msg.fiat)) return fail('Unsupported currency');
      const amt = parseAmount(msg.amount); if (!amt.ok) return fail(amt.error);
      const category = typeof q.categoryId === 'string' && q.categoryId in PAYMENT_CATEGORIES ? (q.categoryId as PaymentCategoryId) : undefined;
      const sub = typeof q.id === 'string' ? q.id.split(':')[2] : undefined;
      const address = await ownAddress(ctx, asset.chainId);
      const { url } = buildCheckoutUrl(p, { mode: m, asset, fiat: msg.fiat, amount: amt.value, address, category, subProvider: sub }, keysFor(await readKeys(), p.id));
      return { ok: true, url, providerName: p.name, address };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Could not open the provider', needsKey: e instanceof ProviderError && e.kind === 'needs_key' };
    }
  },
  rampsKeysGet: async () => ({ ok: true, providers: describeKeys(await readKeys()) }),
  rampsKeysSet: async (msg) => {
    const r = setProviderKeys(await readKeys(), msg.providerId, msg.keys); if (!r.ok) return fail(r.error);
    await local.set(RAMP_KEYS_STORAGE, r.keys); return { ok: true, providers: describeKeys(r.keys) };
  },
  rampsKeysClear: async (msg) => {
    const p = providerById(msg.providerId); if (!p) return fail('Unknown provider');
    const cur = await readKeys(); delete cur[p.id]; await local.set(RAMP_KEYS_STORAGE, cur); return { ok: true, providers: describeKeys(cur) };
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
