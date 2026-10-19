import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, jsonRes } from './_ramps-load.mjs';
const R = await load('./ramps/index');
const ME = '0xAbCdEf0000000000000000000000000000000001';

test('recurring buy ICS: RRULE, escaping, CRLF + folding, bad input rejected', () => {
  const ics = R.buildRecurringIcs({ uid: 'buy-eth-1', title: 'Buy 100 USD, of ETH; now', description: 'Line1\nLine2 ' + 'x'.repeat(200), freq: 'weekly', start: new Date('2026-11-03T00:00:00Z'), now: new Date('2026-10-19T10:00:00Z') });
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=TU/); assert.match(ics, /DTSTART;VALUE=DATE:20261103/); assert.match(ics, /SUMMARY:Buy 100 USD\\, of ETH\\; now/); assert.match(ics, /DESCRIPTION:Line1\\nLine2/);
  assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)); assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(R.buildRecurringIcs({ uid: 'abcd', title: 't', description: 'd', freq: 'monthly', start: new Date('2026-11-30T00:00:00Z') }), /BYMONTHDAY=28/);
  assert.throws(() => R.buildRecurringIcs({ uid: 'bad uid\r\nX:1', title: 't', description: 'd', freq: 'weekly', start: new Date() }));
  assert.throws(() => R.buildRecurringIcs({ uid: 'abcd', title: 't', description: 'd', freq: 'weekly', start: new Date('nope') }));
  assert.ok(!R.buildRecurringIcs({ uid: 'abcd', title: 'a\r\nATTENDEE:evil', description: 'd', freq: 'weekly', start: new Date('2026-11-03T00:00:00Z') }).includes('\r\nATTENDEE:evil'));
});
test('P2P URL builder allow-lists asset and fiat', () => {
  assert.equal(R.buildP2pUrl('USDT', 'EUR'), 'https://p2p.binance.com/en/trade/all-payments/USDT?fiat=EUR');
  assert.throws(() => R.buildP2pUrl('DOGE', 'EUR')); assert.throws(() => R.buildP2pUrl('USDT', 'EUR&x=1')); assert.throws(() => R.buildP2pUrl('../x', 'EUR'));
});
test('Coinbase currencies -> chain-mapped deposit assets (online networks only)', () => {
  const body = [
    { id: 'ETH', name: 'Ether', status: 'online', details: { type: 'crypto' }, supported_networks: [{ id: 'ethereum', name: 'Ethereum', status: 'online', min_withdrawal_amount: 0.001 }, { id: 'base', name: 'Base', status: 'online' }, { id: 'weird', name: 'Weird', status: 'online' }, { id: 'arbitrum', name: 'Arbitrum', status: 'offline' }] },
    { id: 'USDC', name: 'USD Coin', status: 'online', supported_networks: [{ id: 'ethereum', name: 'Ethereum', status: 'online', contract_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }, { id: 'solana', name: 'Solana', status: 'online', contract_address: 'EPj<script>' }] },
    { id: 'USD', name: 'US Dollar', details: { type: 'fiat' } }, { id: 'BAD/ID', supported_networks: [{ id: 'ethereum' }] }, null,
  ];
  const a = R.parseCoinbaseCurrencies(body);
  assert.deepEqual(a.map((x) => x.key).sort(), ['base:ETH', 'ethereum:ETH', 'ethereum:USDC', 'solana:USDC']);
  assert.equal(a.find((x) => x.key === 'ethereum:ETH').isNative, true); assert.equal(a.find((x) => x.key === 'ethereum:ETH').minWithdrawal, '0.001');
  assert.equal(a.find((x) => x.key === 'ethereum:USDC').isNative, false); assert.equal(a.find((x) => x.key === 'solana:USDC').contract, undefined);
  assert.deepEqual(R.parseCoinbaseCurrencies({ nope: 1 }), []);
});
test('Binance network list parsing + registry fallback is explicit about its limits', async () => {
  const a = R.parseBinanceNetworks({ data: [{ coin: 'BNB', name: 'BNB', networkList: [{ network: 'BSC', name: 'BNB Smart Chain (BEP20)', withdrawEnable: true, withdrawMin: '0.01' }, { network: 'BNB', name: 'BNB Beacon', withdrawEnable: true }, { network: 'ETH', withdrawEnable: false }] }] });
  assert.deepEqual(a.map((x) => x.key), ['smartchain:BNB']); assert.equal(a[0].isNative, true); assert.equal(a[0].networkLabel, 'BNB Smart Chain (BEP20)');
  const live = await R.fetchCexAssets('coinbase-pay', async () => jsonRes([{ id: 'ETH', name: 'Ether', supported_networks: [{ id: 'ethereum', name: 'Ethereum', status: 'online' }] }]));
  assert.equal(live.source, 'coinbase-exchange-api'); assert.equal(live.assets.length, 1);
  const fb = await R.fetchCexAssets('binance-pay', async () => { throw new Error('offline'); });
  assert.equal(fb.source, 'registry'); assert.match(fb.note, /may not support every asset/); assert.ok(fb.assets.some((x) => x.key === 'ethereum:USDT'));
  assert.equal((await R.fetchCexAssets('binance-pay', async () => jsonRes({ data: [] }))).source, 'registry');
});
test('CEX deposit info: network, memo, activation, token and min-withdrawal warnings', () => {
  const asset = R.registryCexAssets().find((x) => x.key === 'ripple:XRP');
  const d = R.cexDepositInfo('binance-pay', { ...asset, minWithdrawal: '25' }, 'rXYZ');
  assert.ok(d.warnings.some((w) => /Send only XRP on/.test(w))); assert.ok(d.warnings.some((w) => /memo, tag or comment/.test(w))); assert.ok(d.warnings.some((w) => /minimum first deposit/.test(w))); assert.ok(d.warnings.some((w) => /minimum withdrawal.*25/.test(w)));
  assert.equal(d.exchangeUrl, 'https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/XRP'); assert.equal(d.qrData, 'rXYZ');
  const tok = R.cexDepositInfo('coinbase-pay', R.registryCexAssets().find((x) => x.key === 'ethereum:USDC'), ME);
  assert.ok(tok.warnings.some((w) => /native coin/.test(w))); assert.equal(tok.exchangeUrl, 'https://www.coinbase.com/');
  assert.ok(R.cexProvider('binance-pay').needsPlatform); assert.equal(R.cexProvider('coinbase-pay').needsPlatform, false); assert.equal(R.cexProvider('x'), undefined);
});
