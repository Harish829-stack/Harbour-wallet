// Banxa (widget-only) + Onramper (aggregator) adapters (see kit.ts for confidence notes).
import type { RampQuote } from './types';
import { buildSafeUrl } from './guard';
import { ProviderError, PAYMENT_CATEGORIES, categoryOf, num, qid, getJson, need, compositeCode, BANXA_NET, type ProviderDef } from './kit';

export const banxa: ProviderDef = {
  id: 'banxa', name: 'Banxa', modes: ['buy', 'sell'], docsUrl: 'https://docs.banxa.com', hosts: ['banxa.com'], widgetOnly: true,
  keyFields: [{ field: 'partner', label: 'Partner subdomain', hint: 'The "<partner>" in <partner>.banxa.com', pattern: /^[a-z0-9][a-z0-9-]{1,38}$/ }],
  quoteNeeds: ['partner'], widgetNeeds: ['partner'],
  note: 'Banxa quotes need an HMAC-signed partner API, which cannot be done safely inside an extension, so the price is shown in the Banxa widget.',
  code: (a) => { const n = BANXA_NET[a.chainId]; return n ? { crypto: a.symbol, network: n } : undefined; },
  widget(i, code, keys) {
    if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(keys.partner ?? '')) throw new ProviderError('needs_key', 'Banxa needs a valid partner subdomain');
    const buy = i.mode === 'buy';
    const url = buildSafeUrl(`https://${keys.partner}.banxa.com/`, { orderType: buy ? 'BUY' : 'SELL', coinType: code.crypto, blockchain: code.network, fiatType: i.fiat, ...(buy ? { fiatAmount: i.amount } : { coinAmount: i.amount }), walletAddress: i.address }, ['banxa.com']);
    return { url, addressField: 'walletAddress' };
  },
};

export const onramper: ProviderDef = {
  id: 'onramper', name: 'Onramper', modes: ['buy', 'sell'], docsUrl: 'https://docs.onramper.com', hosts: ['onramper.com'],
  keyFields: [{ field: 'apiKey', label: 'API key', hint: 'pk_prod_… / pk_test_… from the Onramper dashboard (public key)', pattern: /^pk_(prod|test)_[A-Za-z0-9\-_]{8,100}$/ }],
  quoteNeeds: ['apiKey'], widgetNeeds: ['apiKey'],
  note: 'One Onramper key unlocks quotes from several on-ramps (each shown as its own provider).',
  code: (a) => { const c = compositeCode(a); return c ? { crypto: c, network: a.chainId } : undefined; },
  async quote(req, code, keys, f) {
    need(keys, ['apiKey'], 'Onramper');
    const buy = req.mode === 'buy';
    const u = buildSafeUrl(`https://api.onramper.com/quotes/${encodeURIComponent(buy ? req.fiat.toLowerCase() : code.crypto)}/${encodeURIComponent(buy ? code.crypto : req.fiat.toLowerCase())}`, { amount: req.amount, type: buy ? 'buy' : 'sell' }, ['api.onramper.com']);
    const body = await getJson(f, u.toString(), { headers: { Authorization: keys.apiKey } });
    const list: any[] = Array.isArray(body) ? body : Array.isArray(body?.quotes) ? body.quotes : [];
    const out: RampQuote[] = [];
    for (const r of list) {
      if (!r || (Array.isArray(r.errors) && r.errors.length) || typeof r.ramp !== 'string') continue;
      const payout = num(r.payout); if (payout == null || payout <= 0) continue;
      const cat = categoryOf(String(r.paymentMethod ?? ''));
      const sub = String(r.ramp).replace(/[^a-z0-9_-]/gi, '').slice(0, 40); if (!sub) continue;
      const pretty = sub.charAt(0).toUpperCase() + sub.slice(1);
      out.push({ id: qid('onramper', cat, sub.toLowerCase()), mode: req.mode, providerId: 'onramper', providerName: pretty, paymentMethod: { categoryId: cat, label: PAYMENT_CATEGORIES[cat], providerName: 'Onramper' },
        fiat: { currency: req.fiat, amount: buy ? Number(req.amount) : payout }, crypto: { symbol: req.asset.symbol, amount: buy ? payout : Number(req.amount) },
        feeFiat: buy ? (num(r.networkFee) ?? 0) + (num(r.transactionFee) ?? 0) : undefined, isRecommended: false, badges: [] });
    }
    if (!out.length) throw new ProviderError('error', 'Onramper returned no quotes for this pair');
    return out;
  },
  widget(i, code, keys) {
    const buy = i.mode === 'buy';
    const sub = i.subProvider && /^[a-z0-9_-]{1,40}$/i.test(i.subProvider) ? i.subProvider.toLowerCase() : undefined;
    const url = buildSafeUrl('https://buy.onramper.com/', { apiKey: keys.apiKey, mode: buy ? 'buy' : 'sell', defaultFiat: i.fiat.toLowerCase(), defaultCrypto: code.crypto, defaultAmount: i.amount, onlyCryptos: code.crypto, onlyOnramps: sub, wallets: `${code.crypto}:${i.address}` }, ['onramper.com']);
    return { url, addressField: undefined };
  },
};
