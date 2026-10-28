// Transak + Ramp Network adapters (see kit.ts for confidence notes).
import type { PaymentCategoryId, RampQuote } from './types';
import { buildSafeUrl } from './guard';
import { KEY, ProviderError, PAYMENT_CATEGORIES, categoryOf, num, qid, getJson, need, toUnits, fromUnits, assetDecimals, firstRejection, TRANSAK_NET, RAMP_PREFIX, type ProviderDef } from './kit';

const TRANSAK_METHODS = ['credit_debit_card', 'apple_pay', 'sepa_bank_transfer'] as const;
const transakMethod: Record<PaymentCategoryId, string | undefined> = { card: 'credit_debit_card', apple_pay: 'apple_pay', google_pay: 'google_pay', sepa: 'sepa_bank_transfer', bank: 'sepa_bank_transfer', ach: undefined, instant: undefined, other: undefined };

export const transak: ProviderDef = {
  id: 'transak', name: 'Transak', modes: ['buy', 'sell'], docsUrl: 'https://docs.transak.com', hosts: ['transak.com'],
  keyFields: [{ field: 'apiKey', label: 'API key', hint: 'Partner API key from the Transak dashboard', pattern: KEY }],
  quoteNeeds: ['apiKey'], widgetNeeds: ['apiKey'],
  code: (a) => { const n = TRANSAK_NET[a.chainId]; return n ? { crypto: a.symbol, network: n } : undefined; },
  async quote(req, code, keys, f) {
    need(keys, ['apiKey'], 'Transak');
    const buy = req.mode === 'buy';
    const rows = await Promise.allSettled(TRANSAK_METHODS.map(async (pm) => {
      const u = buildSafeUrl('https://api.transak.com/api/v1/pricing/public/quotes', {
        partnerApiKey: keys.apiKey, fiatCurrency: req.fiat, cryptoCurrency: code.crypto, isBuyOrSell: buy ? 'BUY' : 'SELL', network: code.network, paymentMethod: pm,
        ...(buy ? { fiatAmount: req.amount } : { cryptoAmount: req.amount }),
      }, ['api.transak.com']);
      const body = await getJson(f, u.toString());
      const r = body?.response ?? body;
      const fiatAmount = num(r?.fiatAmount); const cryptoAmount = num(r?.cryptoAmount);
      if (fiatAmount == null || cryptoAmount == null) throw new ProviderError('error', 'Unexpected Transak quote');
      const cat = categoryOf(pm);
      return { id: qid('transak', cat), mode: req.mode, providerId: 'transak', providerName: 'Transak', paymentMethod: { categoryId: cat, label: PAYMENT_CATEGORIES[cat] },
        fiat: { currency: req.fiat, amount: buy ? Number(req.amount) : fiatAmount }, crypto: { symbol: req.asset.symbol, amount: buy ? cryptoAmount : Number(req.amount) },
        feeFiat: num(r?.totalFee) ?? undefined, isRecommended: false, badges: [] } as RampQuote;
    }));
    const ok = rows.filter((r): r is PromiseFulfilledResult<RampQuote> => r.status === 'fulfilled').map((r) => r.value);
    if (!ok.length) throw firstRejection(rows, 'No Transak quote');
    return ok;
  },
  widget(i, code, keys) {
    const buy = i.mode === 'buy';
    const url = buildSafeUrl('https://global.transak.com/', {
      apiKey: keys.apiKey, productsAvailed: buy ? 'BUY' : 'SELL', cryptoCurrencyCode: code.crypto, network: code.network, fiatCurrency: i.fiat,
      ...(buy ? { fiatAmount: i.amount } : { cryptoAmount: i.amount }), paymentMethod: i.category ? transakMethod[i.category] : undefined,
      walletAddress: i.address, disableWalletAddressForm: 'true',
    }, ['transak.com']);
    return { url, addressField: 'walletAddress' };
  },
};

const RAMP_METHOD_CAT: Record<string, PaymentCategoryId> = { CARD_PAYMENT: 'card', APPLE_PAY: 'apple_pay', GOOGLE_PAY: 'google_pay', MANUAL_BANK_TRANSFER: 'bank', AUTO_BANK_TRANSFER: 'instant', OPEN_BANKING: 'instant', PIX: 'instant', BANK_TRANSFER: 'bank' };
export const ramp: ProviderDef = {
  id: 'ramp', name: 'Ramp Network', modes: ['buy', 'sell'], docsUrl: 'https://docs.ramp.network', hosts: ['ramp.network', 'rampnetwork.com'],
  keyFields: [{ field: 'hostApiKey', label: 'Host API key', hint: 'Optional; production widgets normally need the key from the Ramp dashboard', pattern: KEY, optional: true }],
  quoteNeeds: [], widgetNeeds: [],
  note: 'Ramp quotes are requested without a key; add your host API key for production widgets.',
  code: (a) => { const p = RAMP_PREFIX[a.chainId]; return p ? { crypto: `${p}_${a.symbol}`, network: a.chainId } : undefined; },
  async quote(req, code, _keys, f) {
    const buy = req.mode === 'buy';
    const dec = assetDecimals(req.asset);
    const body = await getJson(f, `https://api.ramp.network/api/host-api/v3/${buy ? 'onramp' : 'offramp'}/quote/all`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buy ? { cryptoAssetSymbol: code.crypto, fiatCurrency: req.fiat, fiatValue: Number(req.amount) } : { cryptoAssetSymbol: code.crypto, fiatCurrency: req.fiat, cryptoAmount: toUnits(req.amount, dec) }),
    });
    const assetDec = Number.isInteger(body?.asset?.decimals) ? body.asset.decimals : dec;
    const out: RampQuote[] = [];
    for (const [method, r] of Object.entries<any>(body ?? {})) {
      if (method === 'asset' || !r || typeof r !== 'object') continue;
      const cat = RAMP_METHOD_CAT[method] ?? categoryOf(method);
      const fiatVal = num(r.fiatValue); const cryptoAmt = fromUnits(r.cryptoAmount, assetDec);
      if (buy ? cryptoAmt == null : fiatVal == null) continue;
      out.push({ id: qid('ramp', cat), mode: req.mode, providerId: 'ramp', providerName: 'Ramp Network', paymentMethod: { categoryId: cat, label: PAYMENT_CATEGORIES[cat] },
        fiat: { currency: req.fiat, amount: buy ? Number(req.amount) : (fiatVal as number) }, crypto: { symbol: req.asset.symbol, amount: buy ? cryptoAmt : Number(req.amount) },
        feeFiat: num(r.appliedFee) ?? undefined, isRecommended: false, badges: [] });
    }
    if (!out.length) throw new ProviderError('error', 'Ramp returned no quotes for this pair');
    return out;
  },
  widget(i, code, keys) {
    const buy = i.mode === 'buy';
    const base = { hostApiKey: keys.hostApiKey, hostAppName: 'Harbour Wallet', userAddress: i.address, fiatCurrency: i.fiat };
    const url = buildSafeUrl('https://app.ramp.network/', buy
      ? { ...base, swapAsset: code.crypto, fiatValue: i.amount }
      : { ...base, enabledFlows: 'OFFRAMP', defaultFlow: 'OFFRAMP', offrampAsset: code.crypto, swapAmount: toUnits(i.amount, assetDecimals(i.asset)) }, ['ramp.network', 'rampnetwork.com']);
    return { url, addressField: 'userAddress' };
  },
};
