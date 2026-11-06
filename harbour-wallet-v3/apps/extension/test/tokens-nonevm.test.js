// Non-EVM custom tokens: TON jettons, Sui coins, Aptos coins / fungible assets. Probe + balance + send (quote and sign) with mocked nodes; nothing is broadcast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSend, getCore, account, otherAddress, mockFetch, rpcHandler, NOW } from './send-helpers.mjs';

const S = await loadSend(); const core = await getCore();
const chain = (id) => S.chainById(id);
const env = (f) => ({ core, fetch: f, now: () => NOW });
const J = (path, val) => [(u) => u.includes(path), typeof val === 'function' ? val : () => val];
const tok = (c, contract, decimals, symbol) => ({ kind: 'token', contract, decimals, symbol });
const P = (c, from, to, amount, asset, extra = {}) => ({ chain: c, from, to, amount, asset, ...extra });
const COIN = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
const RAW = '0:' + 'ab'.repeat(32);

test('token addresses are validated per chain', () => {
  assert.equal(S.validTokenAddress('sui', COIN), true); assert.equal(S.validTokenAddress('sui', '0x2'), false);
  assert.equal(S.validTokenAddress('aptos', '0x1::aptos_coin::AptosCoin'), true); assert.equal(S.validTokenAddress('aptos', '0x' + 'a'.repeat(64)), true); assert.equal(S.validTokenAddress('aptos', 'nope'), false);
  assert.equal(S.validTokenAddress('ton', RAW), true); assert.equal(S.validTokenAddress('ton', 'EQ' + 'A'.repeat(46)), true); assert.equal(S.validTokenAddress('ton', 'hello'), false);
  assert.equal(S.TOKEN_CHAINS.ton, 'JETTON'); assert.equal(S.STANDARD_LABEL.COIN, 'Coin');
});

test('Sui: probe reads coin metadata, balance reads suix_getBalance', async () => {
  const c = chain('sui');
  const f = mockFetch([rpcHandler({ suix_getCoinMetadata: { decimals: 6, name: 'USD Coin', symbol: 'USDC' }, suix_getBalance: { totalBalance: '2500000' } })]);
  const pr = await S.probeChainToken(c, COIN, f); assert.ok(pr.ok); assert.deepEqual([pr.token.symbol, pr.token.decimals, pr.token.standard], ['USDC', 6, 'COIN']);
  const b = await S.chainTokenBalance(c, '0x' + '11'.repeat(32), { address: COIN, decimals: 6 }, f); assert.deepEqual([b.ok, b.raw, b.formatted], [true, '2500000', '2.5']);
  const none = await S.probeChainToken(c, COIN, mockFetch([rpcHandler({ suix_getCoinMetadata: null })])); assert.equal(none.ok, false); assert.equal(none.code, 'NOT_A_TOKEN');
});

test('Aptos: coin and fungible-asset probes and balances', async () => {
  const c = chain('aptos'); const FA = '0x' + 'c'.repeat(64);
  const f = mockFetch([J('/resource/0x1%3A%3Acoin%3A%3ACoinInfo', { data: { name: 'Tether', symbol: 'USDt', decimals: 6 } }), J('/resource/0x1%3A%3Afungible_asset%3A%3AMetadata', { data: { name: 'FA Coin', symbol: 'FAC', decimals: 8 } }),
    [(u, b) => u.endsWith('/view'), (u, b) => [b.function.endsWith('primary_fungible_store::balance') ? '700' : '1500']]]);
  assert.equal((await S.probeChainToken(c, '0x1::coin::T'.replace('0x1', '0x' + 'e'.repeat(64)) , f)).token.symbol, 'USDt');
  assert.equal((await S.probeChainToken(c, FA, f)).token.decimals, 8);
  assert.equal((await S.chainTokenBalance(c, '0x1', { address: '0x1::x::Y', decimals: 6 }, f)).raw, '1500');
  assert.equal((await S.chainTokenBalance(c, '0x1', { address: FA, decimals: 8 }, f)).raw, '700');
});

test('TON: jetton master probe and wallet balance via the v3 index', async () => {
  const c = chain('ton');
  const f = mockFetch([J('/api/v3/jetton/masters', { jetton_masters: [{ address: RAW, jetton_content: { name: 'Tether USD', symbol: 'USDT', decimals: '6' } }] }), J('/api/v3/jetton/wallets', { jetton_wallets: [{ address: '0:' + 'cd'.repeat(32), balance: '4200000' }] })]);
  const pr = await S.probeChainToken(c, RAW, f); assert.ok(pr.ok); assert.deepEqual([pr.token.symbol, pr.token.decimals, pr.token.standard], ['USDT', 6, 'JETTON']);
  const b = await S.chainTokenBalance(c, 'UQ' + 'A'.repeat(46), { address: RAW, decimals: 6 }, f); assert.deepEqual([b.raw, b.formatted], ['4200000', '4.2']);
  const empty = await S.chainTokenBalance(c, 'UQ' + 'A'.repeat(46), { address: RAW, decimals: 6 }, mockFetch([J('/jetton/wallets', { jetton_wallets: [] })])); assert.equal(empty.raw, '0');
});

test('Aptos send: payload picks the right wallet-core message; token quote uses the asset balance and signs', async () => {
  const p = (a) => S.aptosPayload({ to: '0x2', asset: a }, 5n);
  assert.ok(p({ kind: 'native' }).transfer);
  assert.deepEqual(p({ kind: 'token', contract: '0xab::usdt::USDT' }).tokenTransferCoins.function, { accountAddress: '0xab', module: 'usdt', name: 'USDT' });
  assert.equal(p({ kind: 'token', contract: '0x' + 'd'.repeat(64) }).fungibleAssetTransfer.metadataAddress, '0x' + 'd'.repeat(64));
  const c = chain('aptos'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch([J('/estimate_gas_price', { gas_estimate: 100 }), [(u, b) => u.endsWith('/view'), (u, b) => [b.function === '0x1::coin::balance' && b.type_arguments[0].includes('::usdt::') ? '9000' : '100000000']],
    J('/accounts/', (u) => (u.includes(to) ? { __status: 404, body: {} } : { sequence_number: '4' })), [(u) => u.endsWith('mainnet.aptoslabs.com/v1'), () => ({ chain_id: 1 })]]);
  const pp = P(c, me.address, to, 1000n, tok(c, '0xab::usdt::USDT', 6, 'USDT')); const q = await S.familyOf(c).quote(env(f), pp);
  assert.equal(q.assetBalance, '9000'); assert.equal(q.tiers[1].max, 9000n); assert.ok(!q.issues.some((i) => i.blocking));
  const built = await S.familyOf(c).build(env(f), pp, me.key, q, 'average'); const j = JSON.parse(built.raw);
  assert.match(JSON.stringify(j.payload), /transfer_coins/); assert.ok(j.signature);
  const over = await S.familyOf(c).quote(env(f), { ...pp, amount: 10_000n }); assert.ok(over.issues.some((i) => i.blocking));
});

test('Sui send: token transfer uses Pay over the coin objects with a SUI gas coin', async () => {
  const c = chain('sui'); const me = await account(c); const to = await otherAddress(c);
  const coin = (id, bal) => ({ coinObjectId: '0x' + id.repeat(32), version: '12', digest: '5Y8sXtvPFVpFRiKJhdeRUsDYPKbUHKEYK1vwJ8TFhZs3', balance: bal });
  const f = mockFetch([rpcHandler({ suix_getCoins: (p) => ({ data: p[1] === '0x2::sui::SUI' ? [coin('ab', '3000000000')] : [coin('cd', '600'), coin('ef', '400')], hasNextPage: false }), suix_getReferenceGasPrice: '750' })]);
  const pp = P(c, me.address, to, 700n, tok(c, COIN, 6, 'USDC')); const q = await S.familyOf(c).quote(env(f), pp);
  assert.equal(q.assetBalance, '1000'); assert.equal(q.tiers[0].max, 1000n); assert.ok(!q.issues.some((i) => i.blocking)); assert.ok(q.ctx.gasCoin);
  const b = await S.familyOf(c).build(env(f), pp, me.key, q, 'average'); const j = JSON.parse(b.raw); assert.ok(j.tx.length > 60 && j.sig.length > 40);
  const bytes = Buffer.from(j.tx, 'base64'); assert.ok(bytes.includes(Buffer.from('cd'.repeat(32), 'hex')) && bytes.includes(Buffer.from('ab'.repeat(32), 'hex')), 'token coin and gas coin both referenced');
  const max = await S.familyOf(c).build(env(f), { ...pp, isMax: true }, me.key, q, 'average'); assert.ok(JSON.parse(max.raw).tx);
  const noGas = await S.familyOf(c).quote(env(mockFetch([rpcHandler({ suix_getCoins: (p) => ({ data: p[1] === '0x2::sui::SUI' ? [coin('ab', '1000')] : [coin('cd', '600')], hasNextPage: false }), suix_getReferenceGasPrice: '750' })])), pp);
  assert.ok(noGas.issues.some((i) => i.blocking), 'not enough SUI for gas');
});

test('TON send: jetton transfer is addressed to the sender jetton wallet; holds-none and memo are blocked', async () => {
  const c = chain('ton'); const me = await account(c); const to = await otherAddress(c);
  const JW = '0:' + 'cd'.repeat(32);
  const mk = (wallets) => mockFetch([J('/getWalletInformation', { ok: true, result: { balance: '5000000000', seqno: 3, wallet: true } }), J('/getAddressInformation', { ok: true, result: { state: 'active' } }), J('/api/v3/jetton/wallets', { jetton_wallets: wallets })]);
  const pp = P(c, me.address, to, 1_000_000n, tok(c, RAW, 6, 'USDT')); const f = mk([{ address: JW, balance: '4200000' }]);
  const q = await S.familyOf(c).quote(env(f), pp); assert.equal(q.assetBalance, '4200000'); assert.ok(!q.issues.some((i) => i.blocking)); assert.equal(q.ctx.jettonWallet, JW);
  const b = await S.familyOf(c).build(env(f), pp, me.key, q, 'average'); assert.ok(Buffer.from(b.raw, 'base64').length > 120);
  const none = await S.familyOf(c).quote(env(mk([])), pp); assert.ok(none.issues.some((i) => i.blocking));
  const memo = await S.familyOf(c).quote(env(f), { ...pp, memo: 'hi' }); assert.ok(memo.issues.some((i) => i.code === 'invalid-memo'));
  const poor = await S.familyOf(c).quote(env(mockFetch([J('/getWalletInformation', { ok: true, result: { balance: '1000', seqno: 3 } }), J('/getAddressInformation', { ok: true, result: { state: 'active' } }), J('/api/v3/jetton/wallets', { jetton_wallets: [{ address: JW, balance: '4200000' }] })])), pp);
  assert.ok(poor.issues.some((i) => i.blocking), 'needs TON for the attached fee');
});
