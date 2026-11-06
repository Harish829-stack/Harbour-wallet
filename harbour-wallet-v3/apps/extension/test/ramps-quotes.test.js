import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, jsonRes, fakeFetch } from './_ramps-load.mjs';
const R = await load('./ramps/index');
const ETH = R.rampAssetById('ethereum');
const KEYS = { transak: { apiKey: 'tk_test_12345678' }, moonpay: { apiKey: 'pk_test_abcdefghijkl' }, mercuryo: { widgetId: 'abcd1234-ef56' }, banxa: { partner: 'harbour' }, onramper: { apiKey: 'pk_test_abcdefgh1234' } };
const BUY = { mode: 'buy', asset: ETH, fiat: 'USD', amount: '100' };

test('Transak quotes: one per payment method, failed methods dropped, key sent as partnerApiKey', async () => {
  const calls = [];
  const f = fakeFetch([['api.transak.com', (url) => url.includes('apple_pay') ? jsonRes({ error: { message: 'not supported' } }, 400) : jsonRes({ response: { fiatAmount: 100, cryptoAmount: url.includes('sepa') ? 0.031 : 0.03, totalFee: 3.5 } })]], calls);
  const qs = await R.transak.quote(BUY, R.transak.code(ETH), KEYS.transak, f);
  assert.equal(qs.length, 2); assert.deepEqual(qs.map((q) => q.paymentMethod.categoryId).sort(), ['card', 'sepa']);
  assert.equal(qs.find((q) => q.paymentMethod.categoryId === 'card').crypto.amount, 0.03); assert.equal(qs[0].feeFiat, 3.5);
  assert.ok(calls.every((c) => new URL(c.url).searchParams.get('partnerApiKey') === 'tk_test_12345678' && new URL(c.url).searchParams.get('fiatAmount') === '100'));
  await assert.rejects(R.transak.quote(BUY, R.transak.code(ETH), {}, f), /needs/);
  await assert.rejects(R.transak.quote(BUY, R.transak.code(ETH), KEYS.transak, fakeFetch([['transak', () => jsonRes({}, 401)]])), (e) => e.kind === 'needs_key');
});
test('Ramp quotes: per payment method, smallest units converted with asset decimals, no key needed', async () => {
  const calls = [];
  const f = fakeFetch([['onramp/quote/all', () => jsonRes({ asset: { decimals: 18 }, CARD_PAYMENT: { fiatValue: 100, cryptoAmount: '30000000000000000', appliedFee: 2.9 }, APPLE_PAY: { fiatValue: 100, cryptoAmount: '29500000000000000' }, MANUAL_BANK_TRANSFER: { error: 'x' } })]], calls);
  const qs = await R.ramp.quote(BUY, R.ramp.code(ETH), {}, f);
  assert.deepEqual(qs.map((q) => [q.paymentMethod.categoryId, q.crypto.amount]), [['card', 0.03], ['apple_pay', 0.0295]]);
  assert.equal(JSON.parse(calls[0].init.body).cryptoAssetSymbol, 'ETH_ETH'); assert.equal(calls[0].init.method, 'POST');
  const sell = await R.ramp.quote({ mode: 'sell', asset: ETH, fiat: 'EUR', amount: '0.5' }, R.ramp.code(ETH), {}, fakeFetch([['offramp/quote/all', (u, init) => { assert.equal(JSON.parse(init.body).cryptoAmount, '500000000000000000'); return jsonRes({ asset: { decimals: 18 }, BANK_TRANSFER: { fiatValue: 1500.5, cryptoAmount: '500000000000000000' } }); }]]));
  assert.equal(sell[0].fiat.amount, 1500.5); assert.equal(sell[0].crypto.amount, 0.5);
  await assert.rejects(R.ramp.quote(BUY, R.ramp.code(ETH), {}, fakeFetch([['quote', () => jsonRes({ asset: { decimals: 18 } })]])), /no quotes/);
});
test('MoonPay / Mercuryo / Onramper quote parsing', async () => {
  const mp = await R.moonpay.quote(BUY, R.moonpay.code(ETH), KEYS.moonpay, fakeFetch([['buy_quote', (u) => u.includes('google_pay') ? jsonRes({ message: 'no' }, 400) : jsonRes({ quoteCurrencyAmount: 0.029, feeAmount: 3.99, extraFeeAmount: 0, networkFeeAmount: 1 })]]));
  assert.equal(mp.length, 3); assert.equal(mp[0].crypto.amount, 0.029); assert.equal(mp[0].feeFiat, 4.99);
  const mpSell = await R.moonpay.quote({ ...BUY, mode: 'sell', amount: '1' }, R.moonpay.code(ETH), KEYS.moonpay, fakeFetch([['sell_quote', () => jsonRes({ quoteCurrencyAmount: 3100 })]]));
  assert.equal(mpSell[0].fiat.amount, 3100);
  const me = await R.mercuryo.quote(BUY, R.mercuryo.code(ETH), KEYS.mercuryo, fakeFetch([['widget/buy/rate', () => jsonRes({ status: 200, data: { amount: '0.0291' } })]]));
  assert.equal(me[0].crypto.amount, 0.0291);
  const on = await R.onramper.quote(BUY, R.onramper.code(ETH), KEYS.onramper, fakeFetch([['api.onramper.com/quotes/usd/eth', (u, init) => { assert.equal(init.headers.Authorization, KEYS.onramper.apiKey); return jsonRes([{ ramp: 'moonpay', paymentMethod: 'creditcard', payout: 0.0289, networkFee: 1, transactionFee: 3 }, { ramp: 'bad', errors: [{ type: 'x' }] }, { ramp: 'x<script>', paymentMethod: 'sepabanktransfer', payout: 0.03 }, { ramp: 'zero', payout: 0 }]); }]]));
  assert.deepEqual(on.map((q) => [q.providerName, q.paymentMethod.categoryId]), [['Moonpay', 'card'], ['Xscript', 'sepa']]); assert.equal(on[0].feeFiat, 4);
});
test('getRampQuotes with no keys: honest provider states, quotes only from key-less Ramp, never fake', async () => {
  const f = fakeFetch([['onramp/quote/all', () => jsonRes({ asset: { decimals: 18 }, CARD_PAYMENT: { fiatValue: 100, cryptoAmount: '30000000000000000' } })]]);
  const r = await R.getRampQuotes(BUY, {}, f);
  assert.deepEqual(r.quotes.map((q) => q.providerId), ['ramp']);
  const st = Object.fromEntries(r.providers.map((p) => [p.id, p.state]));
  assert.deepEqual(st, { transak: 'needs_key', ramp: 'ok', moonpay: 'needs_key', mercuryo: 'needs_key', banxa: 'needs_key', onramper: 'needs_key' });
  assert.match(r.providers.find((p) => p.id === 'transak').message, /API key/);
  assert.equal(r.quotes[0].isRecommended, true); assert.deepEqual(r.quotes[0].badges, ['IsRecommended', 'BestPrice']); assert.equal(r.bestQuoteId, 'ramp:card');
});
test('getRampQuotes aggregates, ranks best price first, reports errors and widget-only providers', async () => {
  const f = fakeFetch([
    ['onramp/quote/all', () => jsonRes({ asset: { decimals: 18 }, CARD_PAYMENT: { fiatValue: 100, cryptoAmount: '30000000000000000' } })],
    ['api.transak.com', () => jsonRes({ response: { fiatAmount: 100, cryptoAmount: 0.0312 } })],
    ['api.moonpay.com', () => jsonRes({ message: 'down' }, 500)],
  ]);
  const r = await R.getRampQuotes(BUY, { transak: KEYS.transak, moonpay: KEYS.moonpay, banxa: KEYS.banxa }, f);
  assert.equal(r.quotes[0].providerId, 'transak'); assert.equal(r.quotes[0].isRecommended, true);
  const st = Object.fromEntries(r.providers.map((p) => [p.id, p.state])); assert.equal(st.moonpay, 'error'); assert.equal(st.banxa, 'widget_only'); assert.equal(st.transak, 'ok');
  const banxaQ = r.quotes.find((q) => q.providerId === 'banxa'); assert.equal(banxaQ.crypto.amount, null); assert.equal(banxaQ.isRecommended, false);
  const groups = R.groupByCategory(r); assert.equal(groups[0].category.id, 'card'); assert.equal(groups[0].recommended.providerId, 'transak');
  assert.ok(groups.some((g) => g.category.id === 'other'));
});
test('getRampQuotes validates inputs and flags unsupported assets', async () => {
  const f = fakeFetch([]);
  await assert.rejects(R.getRampQuotes({ ...BUY, amount: '-1' }, {}, f), /valid amount|greater/);
  await assert.rejects(R.getRampQuotes({ ...BUY, fiat: 'XXX', amount: '5' }, {}, f), /currency/);
  const r = await R.getRampQuotes({ ...BUY, asset: R.rampAssetById('cosmos'), amount: '5' }, {}, f);
  assert.equal(r.quotes.length, 0); assert.ok(r.providers.every((p) => p.state === 'unsupported'));
});
test('sell quotes rank by fiat payout', async () => {
  const f = fakeFetch([['offramp/quote/all', () => jsonRes({ asset: { decimals: 18 }, BANK_TRANSFER: { fiatValue: 1500, cryptoAmount: '500000000000000000' } })], ['sell_quote', () => jsonRes({ quoteCurrencyAmount: 1520 })]]);
  const r = await R.getRampQuotes({ mode: 'sell', asset: ETH, fiat: 'USD', amount: '0.5' }, { moonpay: KEYS.moonpay }, f);
  assert.equal(r.quotes[0].providerId, 'moonpay'); assert.equal(r.quotes[0].fiat.amount, 1520); assert.equal(r.quotes[0].crypto.amount, 0.5);
});
test('market reference: CoinGecko simple price, cached 60s, null on failure/bad ids', async () => {
  let n = 0; const f = async () => { n++; return jsonRes({ ethereum: { usd: 3100.5 } }); };
  assert.equal(await R.fetchMarketReference('ethereum', 'USD', f, 1000), 3100.5);
  assert.equal(await R.fetchMarketReference('ethereum', 'USD', f, 1000 + 59_000), 3100.5); assert.equal(n, 1);
  assert.equal(await R.fetchMarketReference('ethereum', 'USD', f, 1000 + 61_000), 3100.5); assert.equal(n, 2);
  assert.equal(await R.fetchMarketReference('../x', 'USD', f), null); assert.equal(await R.fetchMarketReference('bitcoin', 'ZZZ', f), null);
  assert.equal(await R.fetchMarketReference('solana', 'USD', async () => { throw new Error('offline'); }), null);
});
