import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import { sign } from 'viem/accounts';

// Phase 7: Hyperliquid signing against the official Python SDK's test vectors, wire formatting, account mapping; Polymarket V2
// order amounts (docs example), L2 HMAC, order digest/body; Ledger BTC output serialisation helper is exercised through chainSend in e2e only.
const bundle = async (entry) => {
  const out = await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const H = await bundle('../src/core/perps/hyperliquid.ts');
const P = await bundle('../src/core/predictions/polymarket.ts');
const PK = '0x0123456789012345678901234567890123456789012345678901234567890123';

test('Hyperliquid L1 (agent) signing matches the Python SDK vectors (mainnet + testnet)', async () => {
  const action = { type: 'dummy', num: 100000000000 }; // float_to_int_for_hashing(1000)
  const m = await sign({ hash: H.l1Digest(action, 0, true), privateKey: PK });
  assert.equal(m.r, '0x053749d5b30552aeb2fca34b530185976545bb22d0b3ce6f62e31be961a59298'); assert.equal(m.s, '0x755c40ba9bf05223521753995abb2f73ab3229be8ec921f350cb447e384d8ed8'); assert.equal(H.toSig(m).v, 27);
  const t = await sign({ hash: H.l1Digest(action, 0, false), privateKey: PK });
  assert.equal(t.r, '0x542af61ef1f429707e3c76c5293c80d01f74ef853e34b76efffcb57e574f9510'); assert.equal(H.toSig(t).v, 28);
});

test('Hyperliquid user-signed withdraw matches the SDK vector', async () => {
  const a = { type: 'withdraw3', signatureChainId: '0x66eee', hyperliquidChain: 'Testnet', destination: '0x5e9ee1089755c3435139848e47e6635505d5a13a', amount: '1', time: 1687816341423 };
  const s = await sign({ hash: H.userDigest(a), privateKey: PK });
  assert.equal(s.r, '0x8363524c799e90ce9bc41022f7c39b4e9bdba786e5f9c72b20e43e1462c37cf9'); assert.equal(s.s, '0x58b1411a775938b83e29182e8ef74975f9054c8e97ebf5ec2dc8d51bfc893881');
  const ua = H.userAction('approveAgent', { agentAddress: '0x' + '1'.repeat(40), agentName: 'Harbour', nonce: 5 });
  assert.equal(ua.signatureChainId, '0xa4b1'); assert.equal(ua.hyperliquidChain, 'Mainnet'); assert.match(H.userDigest(ua), /^0x[0-9a-f]{64}$/);
});

test('Hyperliquid wire formatting: float_to_wire, 5 significant figures, lot size, builder lowercase', () => {
  assert.equal(H.floatToWire(1670.1), '1670.1'); assert.equal(H.floatToWire(0.0001), '0.0001'); assert.equal(H.floatToWire(-0.0), '0'); assert.equal(H.floatToWire(10), '10');
  assert.equal(H.roundPrice(1234.567, 2), 1234.6); assert.equal(H.roundPrice(0.000123456, 0), 0.000123); assert.equal(H.roundPrice(105000, 5), 105000);
  const w = H.orderWire({ asset: 0, isBuy: true, price: 67891.234, size: 0.0012345, szDecimals: 5, tif: 'Ioc' });
  assert.deepEqual(w, { a: 0, b: true, p: '67891', s: '0.00123', r: false, t: { limit: { tif: 'Ioc' } } });
  assert.deepEqual(H.orderAction([w], { b: '0xABCDEF0000000000000000000000000000000001', f: 10 }).builder, { b: '0xabcdef0000000000000000000000000000000001', f: 10 });
  assert.throws(() => H.orderWire({ asset: 1, isBuy: false, price: 2, size: 0.0001, szDecimals: 2 }), /minimum lot/);
  assert.equal(Math.round(H.marketPrice(100, true) * 100) / 100, 105);
});

test('Hyperliquid account mapping: positions, orders, realized PnL after fees', () => {
  const a = H.mapAccount({ marginSummary: { accountValue: '1000', totalMarginUsed: '50' }, withdrawable: '900', assetPositions: [{ position: { coin: 'BTC', szi: '0.01', entryPx: '60000', positionValue: '610', unrealizedPnl: '10', leverage: { value: 5 }, liquidationPx: '50000', marginUsed: '122', returnOnEquity: '0.08' } }, { position: { coin: 'ETH', szi: '0' } }] },
    [{ coin: 'ETH', oid: 7, side: 'A', limitPx: '4000', sz: '0.5', reduceOnly: false, timestamp: 1 }], [{ coin: 'BTC', side: 'B', px: '60000', sz: '0.01', closedPnl: '3', fee: '0.5', time: 2, hash: '0x1' }]);
  assert.equal(a.positions.length, 1); assert.equal(a.unrealizedPnl, 10); assert.equal(a.orders[0].side, 'sell'); assert.equal(a.realizedPnl, 2.5); assert.equal(a.withdrawable, 900);
});

test('Polymarket V2 order amounts follow the docs (BUY 10 @ 0.52), SELL inverts, tick rounding', () => {
  assert.deepEqual(P.orderAmounts('BUY', 0.52, 10, 0.01), { makerAmount: '5200000', takerAmount: '10000000', price: 0.52, size: 10 });
  assert.deepEqual(P.orderAmounts('SELL', 0.52, 10, 0.01), { makerAmount: '10000000', takerAmount: '5200000', price: 0.52, size: 10 });
  assert.equal(P.orderAmounts('BUY', 0.523, 10.129, 0.01).takerAmount, '10120000');
  assert.throws(() => P.orderAmounts('BUY', 1.2, 10, 0.01), /between 0 and 1/);
});

test('Polymarket L2 HMAC = url-safe base64 of HMAC-SHA256(base64 secret, ts+METHOD+path+body)', async () => {
  const secret = Buffer.from('super-secret-key-bytes').toString('base64');
  const got = await P.l2Signature(secret, 1700000000, 'post', '/order', '{"a":1}');
  const want = createHmac('sha256', Buffer.from(secret, 'base64')).update('1700000000POST/order{"a":1}').digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(got, want);
});

test('Polymarket V2 order digest is deterministic per exchange; body carries side text and unsigned expiration', () => {
  const o = P.buildOrder({ maker: '0x' + '2'.repeat(40), tokenId: '123456789', side: 'BUY', price: 0.4, size: 20, tickSize: 0.01, now: 1700000000000, salt: 42, builder: '0x' + 'ab'.repeat(32) });
  assert.equal(o.makerAmount, '8000000'); assert.equal(o.takerAmount, '20000000'); assert.equal(o.builder, '0x' + 'ab'.repeat(32));
  const d1 = P.orderDigest(o, false); const d2 = P.orderDigest(o, true);
  assert.match(d1, /^0x[0-9a-f]{64}$/); assert.notEqual(d1, d2); assert.equal(P.orderDigest(o, false), d1);
  const body = JSON.parse(P.orderBody(o, '0xsig', 'api-key', 'FOK'));
  assert.equal(body.order.side, 'BUY'); assert.equal(body.order.expiration, '0'); assert.equal(body.owner, 'api-key'); assert.equal(body.orderType, 'FOK'); assert.equal(body.order.signatureType, 0);
  assert.match(P.clobAuthDigest('0x' + '2'.repeat(40), 1700000000, 0), /^0x[0-9a-f]{64}$/);
});
