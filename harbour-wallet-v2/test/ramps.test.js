import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_ramps-load.mjs';
const R = await load('./ramps/index');
const ME = '0xAbCdEf0000000000000000000000000000000001';
const ETH = R.rampAssetById('ethereum');
const USDC_POLY = R.rampAssetById('polygon:USDC');

// ---------------------------------------------------------------- guard
test('parseAmount accepts plain positive decimals only', () => {
  assert.equal(R.parseAmount('100').ok, true);
  assert.equal(R.parseAmount('0.05').value, '0.05');
  assert.equal(R.parseAmount('007.5').value, '7.5');
  for (const bad of ['', ' ', '0', '0.0', '-5', '1e3', '1,000', '12abc', '1 2', '0x10', 'Infinity', 'NaN', '1.2.3', '100&address=0xevil', '1'.repeat(30), null, undefined, 5, '.5'])
    assert.equal(R.parseAmount(bad).ok, false, `should reject ${String(bad)}`);
});
test('isPlausibleAddress per chain family', () => {
  assert.equal(R.isPlausibleAddress('evm', ME), true);
  assert.equal(R.isPlausibleAddress('evm', ME.slice(0, 40)), false);
  assert.equal(R.isPlausibleAddress('evm', ME + ' '), false);
  assert.equal(R.isPlausibleAddress('evm', '0x' + 'g'.repeat(40)), false);
  assert.equal(R.isPlausibleAddress('solana', '4Nd1mYQn7tVv4y5kqXyV3b8fZ9T2N1gP6dEJc7rWqXvK'), true);
  assert.equal(R.isPlausibleAddress('solana', 'short'), false);
  assert.equal(R.isPlausibleAddress('tron', 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL'), true);
  assert.equal(R.isPlausibleAddress('utxo', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), true);
  assert.equal(R.isPlausibleAddress('evm', undefined), false);
});
test('buildSafeUrl: https + allow-listed host + encoded params only', () => {
  assert.throws(() => R.buildSafeUrl('http://global.transak.com/', {}, ['transak.com']), /https/);
  assert.throws(() => R.buildSafeUrl('https://evil.example/', {}, ['transak.com']), /not allowed/);
  assert.throws(() => R.buildSafeUrl('https://transak.com.evil.example/', {}, ['transak.com']), /not allowed/);
  assert.throws(() => R.buildSafeUrl('https://user:pw@global.transak.com/', {}, ['transak.com']), /credentials/);
  const u = R.buildSafeUrl('https://global.transak.com/', { a: 'x&address=0xevil#frag', b: undefined, c: '' }, ['transak.com']);
  assert.equal(u.searchParams.get('a'), 'x&address=0xevil#frag'); assert.equal(u.searchParams.has('address'), false); assert.equal(u.searchParams.has('b'), false); assert.equal(u.hash, '');
});
test('enforceTrustedAddress overrides any address-like parameter (TW enforceTrustedRampAddress)', () => {
  const u = new URL('https://x.example/?address=0xEVIL&walletAddress=0xEVIL&foo=1');
  const o = R.enforceTrustedAddress(u, 'walletAddress', ME);
  assert.equal(u.searchParams.get('address'), ME); assert.equal(u.searchParams.get('walletAddress'), ME); assert.equal(u.searchParams.get('foo'), '1'); assert.ok(o.includes('address'));
});
test('safeHttpsLink blocks javascript:, http, IPs, localhost, credentials', () => {
  for (const bad of ['javascript:alert(1)', 'http://a.com/', 'https://127.0.0.1/x', 'https://localhost/x', 'https://u:p@a.com/', 'data:text/html,x', 'https://nodot/', '//a.com', 5, 'https://a.local/'])
    assert.equal(R.safeHttpsLink(bad), '', String(bad));
  assert.equal(R.safeHttpsLink('https://example.com/a?b=1'), 'https://example.com/a?b=1');
});

// ---------------------------------------------------------------- assets / fiat
test('asset catalog derives from the registry and resolves ids', () => {
  assert.equal(ETH.symbol, 'ETH'); assert.equal(ETH.isNative, true);
  assert.equal(USDC_POLY.symbol, 'USDC'); assert.equal(USDC_POLY.isNative, false); assert.equal(USDC_POLY.chainId, 'polygon');
  assert.equal(R.rampAssetById('sepolia'), undefined); assert.equal(R.rampAssetById('nope'), undefined); assert.equal(R.rampAssetById('ethereum:USDT')?.symbol, 'USDT');
  assert.equal(R.rampAssetById('bitcoin:USDT'), undefined);
  assert.ok(R.buildRampAssets().length > 80);
});
test('fiat list: USD popular, suggestions scaled, no crypto codes', () => {
  assert.equal(R.isRampFiat('USD'), true); assert.equal(R.isRampFiat('BTC'), false); assert.equal(R.isRampFiat('USD&x=1'), false);
  assert.deepEqual(R.fiatInfo('USD').suggested, [50, 100, 250, 500]); assert.ok(R.fiatInfo('JPY').suggested[1] >= 5000);
});

// ---------------------------------------------------------------- checkout URLs
const KEYS = { transak: { apiKey: 'tk_test_12345678' }, ramp: { hostApiKey: 'ramphost1234' }, moonpay: { apiKey: 'pk_test_abcdefghijkl' }, mercuryo: { widgetId: 'abcd1234-ef56' }, banxa: { partner: 'harbour' }, onramper: { apiKey: 'pk_test_abcdefgh1234' } };
const input = (o = {}) => ({ mode: 'buy', asset: ETH, fiat: 'USD', amount: '100', address: ME, ...o });
test('every provider builds an https allow-listed buy URL with the wallet address prefilled', () => {
  for (const p of R.PROVIDERS) {
    const { url } = R.buildCheckoutUrl(p, input(), R.keysFor(KEYS, p.id)); const u = new URL(url);
    assert.equal(u.protocol, 'https:'); assert.ok(p.hosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h)), `${p.id} host ${u.hostname}`);
    assert.ok(url.includes(ME) || url.includes(encodeURIComponent(ME)), `${p.id} carries the address`);
  }
});
test('exact parameter names per provider (buy)', () => {
  const g = (id, o) => new URL(R.buildCheckoutUrl(R.providerById(id), input(o), R.keysFor(KEYS, id)).url);
  let u = g('transak'); assert.equal(u.searchParams.get('walletAddress'), ME); assert.equal(u.searchParams.get('cryptoCurrencyCode'), 'ETH'); assert.equal(u.searchParams.get('network'), 'ethereum'); assert.equal(u.searchParams.get('fiatAmount'), '100'); assert.equal(u.searchParams.get('productsAvailed'), 'BUY');
  u = g('ramp'); assert.equal(u.searchParams.get('userAddress'), ME); assert.equal(u.searchParams.get('swapAsset'), 'ETH_ETH'); assert.equal(u.searchParams.get('fiatValue'), '100');
  u = g('moonpay'); assert.equal(u.hostname, 'buy.moonpay.com'); assert.equal(u.searchParams.get('currencyCode'), 'eth'); assert.equal(u.searchParams.get('baseCurrencyCode'), 'usd');
  u = g('mercuryo'); assert.equal(u.searchParams.get('address'), ME); assert.equal(u.searchParams.get('fiat_amount'), '100');
  u = g('banxa'); assert.equal(u.hostname, 'harbour.banxa.com'); assert.equal(u.searchParams.get('walletAddress'), ME);
  u = g('onramper'); assert.equal(u.searchParams.get('wallets'), `eth:${ME}`); assert.equal(u.searchParams.get('defaultFiat'), 'usd');
  u = g('moonpay', { asset: USDC_POLY }); assert.equal(u.searchParams.get('currencyCode'), 'usdc_polygon');
  u = g('transak', { asset: R.rampAssetById('smartchain') }); assert.equal(u.searchParams.get('network'), 'bsc');
  u = g('ramp', { asset: R.rampAssetById('solana') }); assert.equal(u.searchParams.get('swapAsset'), 'SOLANA_SOL');
});
test('sell URLs: refund/address prefilled, crypto amount in provider units', () => {
  const g = (id, o) => new URL(R.buildCheckoutUrl(R.providerById(id), input({ mode: 'sell', amount: '0.5', ...o }), R.keysFor(KEYS, id)).url);
  let u = g('moonpay'); assert.equal(u.hostname, 'sell.moonpay.com'); assert.equal(u.searchParams.get('refundWalletAddress'), ME); assert.equal(u.searchParams.get('baseCurrencyAmount'), '0.5'); assert.equal(u.searchParams.get('quoteCurrencyCode'), 'usd');
  u = g('ramp'); assert.equal(u.searchParams.get('offrampAsset'), 'ETH_ETH'); assert.equal(u.searchParams.get('swapAmount'), '500000000000000000'); assert.equal(u.searchParams.get('defaultFlow'), 'OFFRAMP');
  u = g('transak'); assert.equal(u.searchParams.get('productsAvailed'), 'SELL'); assert.equal(u.searchParams.get('cryptoAmount'), '0.5');
  u = g('mercuryo'); assert.equal(u.searchParams.get('type'), 'sell'); assert.equal(u.searchParams.get('amount'), '0.5');
});
test('injection safety: hostile fiat/amount/partner cannot add params, change host or override the address', () => {
  const evil = 'USD&address=0xEVIL&walletAddress=0xEVIL#x';
  for (const p of R.PROVIDERS) {
    const { url } = R.buildCheckoutUrl(p, input({ fiat: evil, amount: '1&address=0xEVIL' }), R.keysFor(KEYS, p.id)); const u = new URL(url);
    assert.ok(p.hosts.some((h) => u.hostname.endsWith(h)), p.id);
    assert.equal(u.hash, '', p.id);
    for (const k of ['address', 'walletAddress', 'userAddress']) if (u.searchParams.has(k)) assert.equal(u.searchParams.get(k), ME, `${p.id}.${k}`);
    assert.ok(![...u.searchParams.values()].some((v) => v === '0xEVIL'), p.id);
  }
  assert.throws(() => R.buildCheckoutUrl(R.banxa, input(), { partner: 'evil.example/#' }), /partner/);
  assert.throws(() => R.buildCheckoutUrl(R.banxa, input(), { partner: 'a.b' }), /partner/);
});
test('missing key => needs_key error, unsupported asset => unsupported (never a URL)', () => {
  assert.throws(() => R.buildCheckoutUrl(R.transak, input(), {}), (e) => e instanceof R.ProviderError && e.kind === 'needs_key');
  assert.throws(() => R.buildCheckoutUrl(R.transak, input({ asset: R.rampAssetById('cosmos') }), KEYS.transak), (e) => e.kind === 'unsupported');
  assert.throws(() => R.buildCheckoutUrl(R.transak, input({ mode: 'swap' }), KEYS.transak), (e) => e.kind === 'unsupported');
  assert.ok(R.buildCheckoutUrl(R.ramp, input(), {}).url.startsWith('https://app.ramp.network/'));
});
test('key sanitising rejects secrets-looking / malformed values and never echoes full keys', () => {
  assert.equal(R.sanitizeKeys(R.moonpay, { apiKey: 'sk_live_abcdefghijkl' }).ok, false);
  assert.equal(R.sanitizeKeys(R.moonpay, { apiKey: 'pk_live_abcdefghijkl' }).ok, true);
  assert.equal(R.sanitizeKeys(R.onramper, { apiKey: 'pk_prod_x y' }).ok, false);
  assert.equal(R.sanitizeKeys(R.transak, { apiKey: 'a b' }).ok, false); assert.equal(R.sanitizeKeys(R.transak, 'x').ok, false);
  const stored = R.normalizeKeys({ transak: { apiKey: 'tk_test_12345678', evil: 'x' }, moonpay: { apiKey: 'bad' }, bogus: { apiKey: 'zzzzzzzz' } });
  assert.deepEqual(stored, { transak: { apiKey: 'tk_test_12345678' } });
  const d = R.describeKeys(stored); assert.ok(!JSON.stringify(d).includes('tk_test_12345678')); assert.equal(d.find((x) => x.id === 'transak').fields[0].configured, true);
  const set = R.setProviderKeys(stored, 'moonpay', { apiKey: 'pk_test_abcdefghijkl' }); assert.equal(set.ok, true); assert.equal(set.keys.moonpay.apiKey, 'pk_test_abcdefghijkl');
  assert.equal(R.setProviderKeys(stored, 'transak', { apiKey: '' }).keys.transak.apiKey, 'tk_test_12345678');
  assert.equal(R.setProviderKeys(stored, 'transak', { apiKey: null }).keys.transak, undefined);
  assert.equal(R.setProviderKeys(stored, 'nope', {}).ok, false);
});
