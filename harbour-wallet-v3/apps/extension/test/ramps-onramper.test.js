// Onramper mapping (core/ramps/onramper.ts): asset matching, quote normalisation, quote ids, URL trust checks and order views.
// The backend talks to Onramper; these are the pieces the extension owns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, jsonRes } from './_ramps-load.mjs';
const R = await load('./ramps/index');
const A = (id) => R.rampAssetById(id);

const CRYPTOS = [
  { id: 'eth', code: 'ETH', network: 'ethereum', chainId: 1 },
  { id: 'usdc_ethereum', code: 'USDC', network: 'ethereum', chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { id: 'eth_base', code: 'ETH', network: 'base', chainId: 8453, address: '0x0000000000000000000000000000000000000000' },
  { id: 'usdc_base', code: 'USDC', network: 'base', chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
  { id: 'bnb_bsc', code: 'BNB', network: 'bsc' },                         // no chain id: matched through the network alias
  { id: 'usdt_bsc', code: 'USDT', network: 'bsc', address: '0x55d398326f99059ff775485246999027b3197955' },
  { id: 'fake_usdc', code: 'USDC', network: 'base', chainId: 84532, address: '0x1' }, // wrong chain id: never matched to Base
  { id: 'btc', code: 'BTC', network: 'bitcoin' },
  { id: 'sol', code: 'SOL', network: 'solana' },
  { id: 'usdc_sol', code: 'USDC', network: 'solana', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
];

test('matchCrypto: by EVM chain id first, native vs token, network aliases for the rest', () => {
  assert.equal(R.matchCrypto(A('ethereum'), CRYPTOS)?.id, 'eth');
  assert.equal(R.matchCrypto(A('ethereum:USDC'), CRYPTOS)?.id, 'usdc_ethereum');
  assert.equal(R.matchCrypto(A('base'), CRYPTOS)?.id, 'eth_base');
  assert.equal(R.matchCrypto(A('base:USDC'), CRYPTOS)?.id, 'usdc_base');
  assert.equal(R.matchCrypto(A('smartchain'), CRYPTOS)?.id, 'bnb_bsc');
  assert.equal(R.matchCrypto(A('smartchain:USDT'), CRYPTOS)?.id, 'usdt_bsc');
  assert.equal(R.matchCrypto(A('bitcoin'), CRYPTOS)?.id, 'btc');
  assert.equal(R.matchCrypto(A('solana'), CRYPTOS)?.id, 'sol');
  assert.equal(R.matchCrypto(A('solana:USDC'), CRYPTOS)?.id, 'usdc_sol');
  assert.equal(R.matchCrypto(A('polygon'), CRYPTOS), undefined, 'not offered => undefined, never a guess');
  assert.equal(R.matchCrypto(A('arbitrum'), CRYPTOS), undefined);
  assert.equal(R.matchCrypto(A('ethereum'), [{ id: 'eth_x', code: 'ETH', network: 'ethereum', chainId: 1, address: '0xabc0000000000000000000000000000000000001' }]), undefined, 'a token named ETH is not native ETH');
  const pairs = R.rampableAssets(R.buildRampAssets(), { cryptos: CRYPTOS });
  assert.ok(pairs.length >= 9); assert.ok(pairs.every((p) => p.crypto && p.asset));
  assert.ok(!pairs.some((p) => p.crypto.id === 'fake_usdc'));
});

const QUOTES = { quotes: [
  { provider: 'banxa', payment_method: 'creditcard', payment_methods: [{ paymentTypeId: 'creditcard', name: 'Credit Card' }], payout: 0.031, network_fee: 1.2, transaction_fee: 2.5, recommendations: [] },
  { provider: 'moonpay', payment_method: 'applepay', payout: 0.0305 },
  { provider: 'moonpay', payment_method: 'creditcard', payout: 0.0312 },
  { provider: 'transak', payment_method: 'sepabanktransfer', payout: 0.0315 },
  { provider: 'evil provider', payment_method: 'creditcard', payout: 9 },          // rejected id
  { provider: 'mercuryo', payment_method: 'creditcard', payout: 0 },               // no price => not a quote
  { provider: 'mercuryo', payment_method: 'creditcard', payout: Number.NaN },
], unavailable: ['revolut', 'moonpay'] };

test('mapQuotes: one quote per provider+method, best payout recommended, honest provider states, no invented prices', () => {
  const r = R.mapQuotes(QUOTES, { mode: 'buy', asset: A('ethereum'), fiat: 'EUR', amount: '100' });
  assert.equal(r.quotes.length, 4);
  assert.equal(r.quotes[0].providerName, 'Transak'); assert.equal(r.quotes[0].isRecommended, true); assert.deepEqual(r.quotes[0].badges, ['IsRecommended', 'BestPrice']);
  assert.equal(r.bestQuoteId, 'onramper:sepa:transak:sepabanktransfer');
  const banxa = r.quotes.find((q) => q.providerName === 'Banxa');
  assert.equal(banxa.paymentMethod.label, 'Credit Card'); assert.equal(banxa.paymentMethod.categoryId, 'card'); assert.equal(banxa.feeFiat, 3.7);
  assert.equal(banxa.crypto.amount, 0.031); assert.equal(banxa.fiat.amount, 100); assert.equal(banxa.providerId, 'onramper');
  assert.deepEqual(r.categories.map((c) => c.id), ['card', 'apple_pay', 'sepa']);
  assert.ok(r.providers.some((p) => p.name === 'Revolut' && p.state === 'unsupported'));
  assert.ok(!r.providers.some((p) => p.name === 'MoonPay' && p.state === 'unsupported'), 'a provider with a quote is not also listed as unavailable');
  assert.equal(new Set(r.quotes.map((q) => q.id)).size, r.quotes.length);
  const sell = R.mapQuotes({ quotes: [{ provider: 'banxa', payment_method: 'sepabanktransfer', payout: 2900 }, { provider: 'moonpay', payment_method: 'sepabanktransfer', payout: 2950 }] }, { mode: 'sell', asset: A('ethereum'), fiat: 'EUR', amount: '1' });
  assert.equal(sell.quotes[0].providerName, 'MoonPay'); assert.equal(sell.quotes[0].fiat.amount, 2950); assert.equal(sell.quotes[0].crypto.amount, 1);
  assert.equal(R.mapQuotes(null, { mode: 'buy', asset: A('ethereum'), fiat: 'EUR', amount: '1' }).quotes.length, 0);
});

test('quote ids carry provider + payment method and reject anything else', () => {
  assert.deepEqual(R.parseQuoteId('onramper:card:banxa:creditcard'), { provider: 'banxa', paymentMethod: 'creditcard' });
  for (const bad of ['onramper:card:banxa', 'transak:card:x:y', 'onramper:card:BANXA:creditcard', 'onramper:card:banxa:credit card', 'onramper:card:banxa:x&address=0xevil', null, 5])
    assert.equal(R.parseQuoteId(bad), null, String(bad));
});

test('payment categories cover Onramper ids', () => {
  for (const [m, c] of [['creditcard', 'card'], ['debitcard', 'card'], ['applepay', 'apple_pay'], ['googlepay', 'google_pay'], ['sepabanktransfer', 'sepa'], ['sepainstant', 'sepa'], ['iach', 'ach'], ['upi', 'instant'], ['pix', 'instant'], ['gbpbanktransfer', 'bank'], ['zonapago', 'other']])
    assert.equal(R.categoryOf(m), c, m);
});

test('only https Onramper checkout pages are trusted; return prefix must be a plain https URL', () => {
  assert.equal(R.isTrustedCheckout('https://buy.onramper.com?session=S&resumeToken=T'), true);
  assert.equal(R.isTrustedCheckout('https://buy.onramper.dev/'), true);
  for (const bad of ['http://buy.onramper.com', 'https://onramper.com.evil.io/', 'https://u:p@buy.onramper.com', 'javascript:alert(1)', 'https://buy.moonpay.com', 5, 'https://buy.onramper.com/' + 'x'.repeat(5000)])
    assert.equal(R.isTrustedCheckout(bad), false, String(bad).slice(0, 60));
  assert.equal(R.isReturnPrefix('https://api.example.com/v1/ramps/return'), true);
  for (const bad of ['', 'http://api.example.com/v1/ramps/return', 'https://api.example.com/v1/ramps/return?x=1', 'https://a.com/#x', null]) assert.equal(R.isReturnPrefix(bad), false, String(bad));
});

test('orderView: symbol, network, provider label and status text', () => {
  const o = { id: 'x', type: 'buy', status: 'pending', provider: 'moonpay', payment_method: 'creditcard', chain: 'base', crypto: 'usdc_base', fiat: 'eur', fiat_amount: 100, crypto_amount: null, created_at: 1, updated_at: 1 };
  const v = R.orderView(o, CRYPTOS);
  assert.equal(v.symbol, 'USDC'); assert.equal(v.isNative, false); assert.equal(v.chainName, 'Base'); assert.equal(v.providerName, 'MoonPay'); assert.equal(v.statusLabel, 'Processing'); assert.equal(v.fiatCode, 'EUR');
  const n = R.orderView({ ...o, crypto: 'eth_base', status: 'completed' }, []);
  assert.equal(n.symbol, 'ETH'); assert.equal(n.isNative, true); assert.equal(n.statusLabel, 'Completed');
});

test('market reference: CoinGecko simple price, cached 60s, null on failure/bad ids', async () => {
  let n = 0; const f = async () => { n++; return jsonRes({ ethereum: { usd: 3100.5 } }); };
  assert.equal(await R.fetchMarketReference('ethereum', 'USD', f, 1000), 3100.5);
  assert.equal(await R.fetchMarketReference('ethereum', 'USD', f, 1000 + 59_000), 3100.5); assert.equal(n, 1);
  assert.equal(await R.fetchMarketReference('ethereum', 'USD', f, 1000 + 61_000), 3100.5); assert.equal(n, 2);
  assert.equal(await R.fetchMarketReference('../x', 'USD', f), null); assert.equal(await R.fetchMarketReference('bitcoin', 'ZZZ', f), null);
  assert.equal(await R.fetchMarketReference('solana', 'USD', async () => { throw new Error('offline'); }), null);
});
