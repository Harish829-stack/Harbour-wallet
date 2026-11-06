// EIP-7708 (live on Sepolia): native ETH transfers also emit a Transfer log from 0xff..fe. It must read as ETH,
// never as an unknown "ERC-20" token, and the transaction's own value must not be counted twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const out = await build({ stdin: { contents: `export * from './classify'; export * from './evm';`, resolveDir: fileURLToPath(new URL('../src/core/activity/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const A = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const ME = '0xe3b055427bdb39a6e66748d2c4212ff3946a82c7'; const ROUTER = '0x7e4f6c5e954da5c61b3423d81e2277431ac043f3';
const POOL = '0xe03a1074c86cfedd5c142c4f04f1a1536e203543'; const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'; const SYS = A.NATIVE_TRANSFER_LOG;
const pad = (a) => '0x' + a.replace(/^0x/, '').padStart(64, '0'); const num = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0');
let idx = 0; const log = (token, from, to, v) => ({ address: token, topics: [A.TOPIC_TRANSFER, pad(from), pad(to)], data: num(v), blockNumber: '0xb843fa', transactionHash: '0xcf', logIndex: '0x' + (idx++).toString(16) });
const meta = (t) => { if (t === SYS) throw new Error('metadata must never be looked up for the EIP-7708 system address'); return t === USDC ? { symbol: 'USDC', decimals: 6 } : { symbol: '', decimals: 18 }; };
const ctx = { assetId: 'sepolia', me: ME, nativeSymbol: 'ETH', meta, source: 'local' };
const ONE_MILLI = 10n ** 15n;

test('ETH -> USDC swap on an EIP-7708 chain (the Sepolia receipt from 2026-11-06) reads ETH, not ERC-20', () => {
  // Same shape as tx 0xcf1916…: my 0.001 ETH to the router, router splits it to the pool, pool pays me USDC twice.
  const logs = [log(SYS, ME, ROUTER, ONE_MILLI), log(SYS, ROUTER, POOL, 50_000_000_000_000n), log(USDC, POOL, ME, 1_453_484n), log(SYS, ROUTER, POOL, 950_000_000_000_000n), log(USDC, POOL, ME, 24_879_360n)];
  const receipt = { transactionHash: '0xcf', blockNumber: '0xb843fa', status: '0x1', from: ME, to: ROUTER, logs };
  const tx = { hash: '0xcf', from: ME, to: ROUTER, value: '0x' + ONE_MILLI.toString(16), input: '0x3593564c', nonce: '0x1' };
  assert.deepEqual(A.tokensNeeded(receipt, ME), [USDC]);
  const items = A.classify(ctx, { hash: '0xcf', receipt, tx, timestamp: 1, status: 'confirmed' });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'swap');
  assert.deepEqual([items[0].swap.sent.symbol, items[0].swap.sent.amount, items[0].swap.sent.address], ['ETH', '0.001', undefined]);
  assert.deepEqual([items[0].swap.received.symbol, items[0].swap.received.amount], ['USDC', '26.332844']);
});

test('plain ETH send: one native row, the EIP-7708 copy of the value is not a second row', () => {
  const OTHER = '0x878344af84a404439ea37cfb9b30defd7938741c';
  const receipt = { transactionHash: '0xs1', blockNumber: '0x1', status: '0x1', from: ME, to: OTHER, logs: [log(SYS, ME, OTHER, ONE_MILLI)] };
  const items = A.classify(ctx, { hash: '0xs1', receipt, tx: { hash: '0xs1', from: ME, to: OTHER, value: '0x' + ONE_MILLI.toString(16), input: '0x', nonce: '0x2' }, timestamp: 1, status: 'confirmed' });
  assert.deepEqual(items.map((x) => [x.kind, x.symbol, x.amount, x.token]), [['send', 'ETH', '0.001', undefined]]);
});

test('USDC -> ETH swap: ETH paid out by the router through an internal transfer is what I received', () => {
  const receipt = { transactionHash: '0xs2', blockNumber: '0x1', status: '0x1', from: ME, to: ROUTER, logs: [log(USDC, ME, POOL, 5_000_000n), log(SYS, ROUTER, ME, 2n * ONE_MILLI)] };
  const items = A.classify(ctx, { hash: '0xs2', receipt, tx: { hash: '0xs2', from: ME, to: ROUTER, value: '0x0', input: '0x3593564c', nonce: '0x3' }, timestamp: 1, status: 'confirmed' });
  assert.equal(items.length, 1); assert.equal(items[0].kind, 'swap');
  assert.deepEqual([items[0].swap.sent.symbol, items[0].swap.received.symbol, items[0].swap.received.amount, items[0].token], ['USDC', 'ETH', '0.002', undefined]);
});

test('ETH refund in an ETH -> token swap is change, not the bought asset', () => {
  const receipt = { transactionHash: '0xs3', blockNumber: '0x1', status: '0x1', from: ME, to: ROUTER, logs: [log(SYS, ME, ROUTER, 3n * ONE_MILLI), log(USDC, POOL, ME, 1_000_000n), log(SYS, ROUTER, ME, ONE_MILLI)] };
  const items = A.classify(ctx, { hash: '0xs3', receipt, tx: { hash: '0xs3', from: ME, to: ROUTER, value: '0x' + (3n * ONE_MILLI).toString(16), input: '0x3593564c', nonce: '0x4' }, timestamp: 1, status: 'confirmed' });
  assert.equal(items[0].kind, 'swap'); assert.equal(items[0].swap.received.symbol, 'USDC');
});

test('incoming ETH seen only through the EIP-7708 log (receiver side, no tx) is a native receive', () => {
  const SENDER = '0x2222222222222222222222222222222222222222';
  const receipt = { transactionHash: '0xr1', blockNumber: '0x1', status: '0x1', from: SENDER, to: ME, logs: [log(SYS, SENDER, ME, ONE_MILLI)] };
  const items = A.classify({ ...ctx, source: 'logs' }, { hash: '0xr1', receipt, tx: null, timestamp: 1, status: 'confirmed' });
  assert.deepEqual(items.map((x) => [x.kind, x.symbol, x.amount, x.token]), [['receive', 'ETH', '0.001', undefined]]);
});
