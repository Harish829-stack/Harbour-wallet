// MoonPay + Mercuryo adapters (see kit.ts for confidence notes).
import type { RampQuote } from './types';
import { buildSafeUrl } from './guard';
import { ProviderError, PAYMENT_CATEGORIES, categoryOf, num, qid, getJson, need, firstRejection, compositeCode, MERCURYO_NET, type ProviderDef } from './kit';

const MOONPAY_METHODS = ['credit_debit_card', 'apple_pay', 'google_pay', 'sepa_bank_transfer'] as const;
export const moonpay: ProviderDef = {
  id: 'moonpay', name: 'MoonPay', modes: ['buy', 'sell'], docsUrl: 'https://dev.moonpay.com', hosts: ['moonpay.com'],
  keyFields: [{ field: 'apiKey', label: 'Publishable key', hint: 'pk_live_… / pk_test_… from the MoonPay dashboard (never a secret key)', pattern: /^pk_(live|test)_[A-Za-z0-9]{8,64}$/ }],
  quoteNeeds: ['apiKey'], widgetNeeds: ['apiKey'],
  note: 'MoonPay only honours a pre-filled wallet address on URLs signed with your MoonPay secret key. Harbour never stores secret keys, so MoonPay may ask you to paste the address from Receive.',
  code: (a) => { const c = compositeCode(a); return c ? { crypto: c, network: a.chainId } : undefined; },
  async quote(req, code, keys, f) {
    need(keys, ['apiKey'], 'MoonPay');
    const buy = req.mode === 'buy';
    const methods = buy ? MOONPAY_METHODS : (['sepa_bank_transfer'] as const);
    const rows = await Promise.allSettled(methods.map(async (pm) => {
      const u = buy
        ? buildSafeUrl(`https://api.moonpay.com/v3/currencies/${encodeURIComponent(code.crypto)}/buy_quote`, { apiKey: keys.apiKey, baseCurrencyCode: req.fiat.toLowerCase(), baseCurrencyAmount: req.amount, paymentMethod: pm }, ['api.moonpay.com'])
        : buildSafeUrl(`https://api.moonpay.com/v3/currencies/${encodeURIComponent(code.crypto)}/sell_quote`, { apiKey: keys.apiKey, quoteCurrencyCode: req.fiat.toLowerCase(), baseCurrencyAmount: req.amount, paymentMethod: pm }, ['api.moonpay.com']);
      const r = await getJson(f, u.toString());
      const out = num(r?.quoteCurrencyAmount); if (out == null) throw new ProviderError('error', 'Unexpected MoonPay quote');
      const cat = categoryOf(pm);
      const fee = (num(r?.feeAmount) ?? 0) + (num(r?.extraFeeAmount) ?? 0) + (num(r?.networkFeeAmount) ?? 0);
      return { id: qid('moonpay', cat), mode: req.mode, providerId: 'moonpay', providerName: 'MoonPay', paymentMethod: { categoryId: cat, label: PAYMENT_CATEGORIES[cat] },
        fiat: { currency: req.fiat, amount: buy ? Number(req.amount) : out }, crypto: { symbol: req.asset.symbol, amount: buy ? out : Number(req.amount) }, feeFiat: buy ? fee : undefined, isRecommended: false, badges: [] } as RampQuote;
    }));
    const ok = rows.filter((r): r is PromiseFulfilledResult<RampQuote> => r.status === 'fulfilled').map((r) => r.value);
    if (!ok.length) throw firstRejection(rows, 'No MoonPay quote');
    return ok;
  },
  widget(i, code, keys) {
    const buy = i.mode === 'buy';
    const url = buy
      ? buildSafeUrl('https://buy.moonpay.com/', { apiKey: keys.apiKey, currencyCode: code.crypto, baseCurrencyCode: i.fiat.toLowerCase(), baseCurrencyAmount: i.amount, walletAddress: i.address }, ['moonpay.com'])
      : buildSafeUrl('https://sell.moonpay.com/', { apiKey: keys.apiKey, baseCurrencyCode: code.crypto, baseCurrencyAmount: i.amount, quoteCurrencyCode: i.fiat.toLowerCase(), refundWalletAddress: i.address }, ['moonpay.com']);
    return { url, addressField: buy ? 'walletAddress' : 'refundWalletAddress' };
  },
};

export const mercuryo: ProviderDef = {
  id: 'mercuryo', name: 'Mercuryo', modes: ['buy', 'sell'], docsUrl: 'https://help.mercuryo.io', hosts: ['mercuryo.io'],
  keyFields: [{ field: 'widgetId', label: 'Widget ID', hint: 'Public widget_id from the Mercuryo partner dashboard', pattern: /^[A-Za-z0-9\-]{8,64}$/ }],
  quoteNeeds: ['widgetId'], widgetNeeds: ['widgetId'],
  note: 'Mercuryo is the only provider TW supports for recurring buys.',
  code: (a) => { const n = MERCURYO_NET[a.chainId]; return n ? { crypto: a.symbol, network: n } : undefined; },
  async quote(req, code, keys, f) {
    need(keys, ['widgetId'], 'Mercuryo');
    const buy = req.mode === 'buy';
    const u = buildSafeUrl(`https://api.mercuryo.io/v1.6/widget/${buy ? 'buy' : 'sell'}/rate`, buy
      ? { from: req.fiat, to: code.crypto, amount: req.amount, network: code.network, widget_id: keys.widgetId }
      : { from: code.crypto, to: req.fiat, amount: req.amount, network: code.network, widget_id: keys.widgetId }, ['api.mercuryo.io']);
    const body = await getJson(f, u.toString());
    const d = body?.data ?? body;
    const out = num(d?.amount) ?? num(d?.[buy ? code.crypto : req.fiat]);
    if (out == null) throw new ProviderError('error', 'Unexpected Mercuryo rate');
    return [{ id: qid('mercuryo', 'card'), mode: req.mode, providerId: 'mercuryo', providerName: 'Mercuryo', paymentMethod: { categoryId: 'card', label: PAYMENT_CATEGORIES.card },
      fiat: { currency: req.fiat, amount: buy ? Number(req.amount) : out }, crypto: { symbol: req.asset.symbol, amount: buy ? out : Number(req.amount) }, isRecommended: false, badges: [] }];
  },
  widget(i, code, keys) {
    const buy = i.mode === 'buy';
    const url = buildSafeUrl('https://exchange.mercuryo.io/', { widget_id: keys.widgetId, type: buy ? 'buy' : 'sell', currency: code.crypto, network: code.network, fiat_currency: i.fiat, address: i.address, ...(buy ? { fiat_amount: i.amount } : { amount: i.amount }) }, ['mercuryo.io']);
    return { url, addressField: 'address' };
  },
};
