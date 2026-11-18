// Regenerates vectors.json with the OFFICIAL Polymarket V2 client (@polymarket/clob-client-v2, version pinned in the lockfile of
// whoever runs this). The vectors are the reference for test/polymarket-golden.test.js. Public test key only; never a real key.
//
//   mkdir /tmp/pmgen && cd /tmp/pmgen && npm init -y && npm i --ignore-scripts @polymarket/clob-client-v2@1.3.1 viem@2.46.3
//   node <this file>          # writes vectors.json next to this file
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { OrderBuilder, SignatureTypeV2, orderToJsonV2 } from '@polymarket/clob-client-v2';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.dirname(path.dirname(createRequire(import.meta.url).resolve('@polymarket/clob-client-v2'))); // .../dist/index.cjs -> package root
const deep = (p) => import(pathToFileURL(path.join(pkgDir, 'dist', p)).href);   // auth + HMAC helpers are not public exports
const { buildClobEip712Signature } = await deep('signing/eip712.js');
const { buildPolyHmacSignature } = await deep('signing/hmac.js');
const { getOrderRawAmounts } = await deep('order-builder/helpers/getOrderRawAmounts.js');
const { ROUNDING_CONFIG } = await deep('order-builder/helpers/roundingConfig.js');
import { parseUnits } from 'viem';

const KEY = '0x' + '11'.repeat(32);
const account = privateKeyToAccount(KEY);
const wallet = createWalletClient({ account, chain: polygon, transport: http('http://127.0.0.1:1') }); // never called: typed-data signing is local
const NOW = 1_800_000_000_000;
const TOKEN = '71321045679252212594626385532706912750332728571942532289631379312455583992563';
const BUILDER = '0x' + 'ab'.repeat(32);
const cases = [
  { name: 'buy_basic', side: 'BUY', price: 0.5, size: 10, tick: '0.01', negRisk: false, rand: 0.123456789 },
  { name: 'sell_negrisk', side: 'SELL', price: 0.37, size: 25.5, tick: '0.001', negRisk: true, rand: 0.5 },
  { name: 'buy_builder_fine_tick', side: 'BUY', price: 0.1234, size: 7.77, tick: '0.0001', negRisk: false, rand: 0.987654321, builder: BUILDER },
  { name: 'sell_coarse_tick', side: 'SELL', price: 0.9, size: 1, tick: '0.1', negRisk: false, rand: 0.25 },
  { name: 'buy_float_edge', side: 'BUY', price: 0.29, size: 1.15, tick: '0.01', negRisk: true, rand: 0.75, builder: BUILDER },
  { name: 'sell_quarter_tick', side: 'SELL', price: 0.4975, size: 3.333, tick: '0.0025', negRisk: false, rand: 0.31 },
];
const out = { key: KEY, address: account.address, now: NOW, tokenId: TOKEN, orders: [], clobAuth: [], hmac: [], amounts: [] };
const realRandom = Math.random, realNow = Date.now;
for (const c of cases) {
  Math.random = () => c.rand; Date.now = () => NOW;
  const builder = new OrderBuilder(wallet, 137, SignatureTypeV2.EOA);
  const signed = await builder.buildOrder({ tokenID: TOKEN, price: c.price, size: c.size, side: c.side, ...(c.builder ? { builderCode: c.builder } : {}) }, { tickSize: c.tick, negRisk: c.negRisk });
  Math.random = realRandom; Date.now = realNow;
  out.orders.push({ ...c, official: { salt: signed.salt, makerAmount: signed.makerAmount, takerAmount: signed.takerAmount, side: signed.side, timestamp: signed.timestamp, metadata: signed.metadata, builder: signed.builder, signature: signed.signature, body: orderToJsonV2(signed, 'api-key-1', 'GTC') } });
}
for (const [ts, nonce] of [[1_800_000_000, 0], [1_800_000_123, 7]]) out.clobAuth.push({ timestamp: ts, nonce, signature: await buildClobEip712Signature(wallet, 137, ts, nonce, account.address) });
const SECRET = 'c2VjcmV0LWtleS1mb3ItdGVzdHMtb25seS0hIT8-'; // base64url, with '-' and '_' style characters
for (const [ts, method, p, body] of [[1_800_000_000, 'GET', '/orders', undefined], [1_800_000_001, 'POST', '/order', '{"order":{"salt":1}}'], [1_800_000_002, 'DELETE', '/order', '{"orderID":"0xabc"}']])
  out.hmac.push({ timestamp: ts, method, path: p, body: body ?? '', secret: SECRET, signature: await buildPolyHmacSignature(SECRET, ts, method, p, body) });
// Amount rounding: the official getOrderRawAmounts over a seeded sample plus known float edge cases. Row: [tick, side, price, size, makerAmount, takerAmount].
let seed = 20260718; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const edge = [['0.01', 'BUY', 0.29, 1.15], ['0.01', 'SELL', 0.57, 4.35], ['0.01', 'BUY', 0.58, 8.2], ['0.001', 'SELL', 0.145, 2.675], ['0.0001', 'BUY', 0.0007, 12345.678], ['0.1', 'SELL', 0.3, 0.07], ['0.0025', 'BUY', 0.0025, 1.005]];
for (const [tick, side, price, size] of edge) out.amounts.push(row(tick, side, price, size));
for (const tick of Object.keys(ROUNDING_CONFIG)) for (const side of ['BUY', 'SELL']) for (let i = 0; i < 40; i++) {
  const dp = ROUNDING_CONFIG[tick].price; const price = Number((Math.floor(rnd() * 10 ** dp * 0.98) / 10 ** dp + 10 ** -dp).toFixed(dp));
  if (!(price > 0 && price < 1)) continue; out.amounts.push(row(tick, side, price, Number((rnd() * 500 + 0.01).toFixed(i % 3 === 0 ? 2 : i % 3 === 1 ? 4 : 6))));
}
function row(tick, side, price, size) { const r = getOrderRawAmounts(side, size, price, ROUNDING_CONFIG[tick]); return [tick, side, price, size, parseUnits(r.rawMakerAmt.toString(), 6).toString(), parseUnits(r.rawTakerAmt.toString(), 6).toString()]; }
writeFileSync(path.join(here, 'vectors.json'), JSON.stringify(out));
console.log('amounts', out.amounts.length, 'orders', out.orders.length, 'clobAuth', out.clobAuth.length, 'hmac', out.hmac.length, 'package', JSON.parse((await import('node:fs')).readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version);
