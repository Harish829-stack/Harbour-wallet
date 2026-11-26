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
