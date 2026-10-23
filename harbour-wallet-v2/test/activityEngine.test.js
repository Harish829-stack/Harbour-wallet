import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/activity/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './engine'; export * from './classify'; export * from './merge'; export * from './evm'; export * from './scanner';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const A = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const ME = '0x1111111111111111111111111111111111111111'; const OTHER = '0x2222222222222222222222222222222222222222';
const USDC = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'; const WETH = '0x4200000000000000000000000000000000000006'; const ROUTER = '0x3333333333333333333333333333333333333333';
const pad = (a) => '0x' + a.replace(/^0x/, '').padStart(64, '0'); const num = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0'); const hx = (n) => '0x' + n.toString(16);
const log = (token, topic0, a, b, data, block, tx, idx) => ({ address: token, topics: [topic0, pad(a), pad(b)], data, blockNumber: hx(block), transactionHash: tx, logIndex: hx(idx) });
const T = A.TOPIC_TRANSFER, AP = A.TOPIC_APPROVAL;

// A tiny fake chain: receipts, txs, blocks, token metadata, and an eth_getLogs that honours topics, ranges and a max range.
function fakeChain({ head = 1000, maxRange = Infinity, logs = [], receipts = {}, txs = {}, nonce = 0 } = {}) {
  const calls = [];
  const rpc = async (method, params = []) => {
    calls.push(method);
    if (method === 'eth_blockNumber') return hx(head);
    if (method === 'eth_getLogs') {
      const f = params[0]; const from = Number(BigInt(f.fromBlock)), to = Number(BigInt(f.toBlock));
      if (to - from + 1 > maxRange) throw new A.RpcError('query exceeds max block range 2000', -32000);
      return logs.filter((l) => { const b = Number(BigInt(l.blockNumber)); return b >= from && b <= to && f.topics.every((t, i) => t === null || l.topics[i] === t); });
    }
    if (method === 'eth_getTransactionReceipt') return receipts[params[0]] ?? null;
    if (method === 'eth_getTransactionByHash') return txs[params[0]] ?? null;
    if (method === 'eth_getBlockByNumber') return { timestamp: hx(1_700_000_000 + Number(BigInt(params[0]))) };
    if (method === 'eth_getTransactionCount') return hx(nonce);
    if (method === 'eth_call') { const d = params[0].data; if (d === A.SEL_DECIMALS) return num(6); return '0x' + '20'.padStart(64, '0') + '4'.padStart(64, '0') + Buffer.from('USDC').toString('hex').padEnd(64, '0'); }
    throw new Error('unexpected ' + method);
  };
  return { rpc, calls };
}
const memStore = () => { const m = new Map(); return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); }, m }; };
const engineFor = (chain, store = memStore(), extra = {}) => ({ store, eng: A.createActivityEngine({ store, now: () => 1_700_100_000_000, rpcFor: () => chain.rpc, chainIdOf: () => 84532, assetIdOf: () => 'base-sepolia', nativeSymbol: () => 'ETH', explorerTx: (_, h) => `https://x/${h}`, ...extra }) });

test('faucet mint (incoming ERC-20 from the zero address) is found on a chain with no explorer', async () => {
  const mint = log(USDC, T, '0x0000000000000000000000000000000000000000', ME, num(10_000_000), 990, '0xaa', 0);
  const chain = fakeChain({ logs: [mint], receipts: { '0xaa': { transactionHash: '0xaa', blockNumber: hx(990), status: '0x1', from: OTHER, to: USDC, logs: [mint] } } });
  const { eng } = engineFor(chain);
  const r = await eng.read('base-sepolia', ME);
  assert.equal(r.error, undefined); assert.equal(r.logs.length, 1);
  assert.deepEqual([r.logs[0].kind, r.logs[0].amount, r.logs[0].symbol, r.logs[0].method], ['receive', '10', 'USDC', 'Mint']);
});
test('scanner shrinks the window when the node limits the range, and never leaves a gap', async () => {
  const mint = log(USDC, T, OTHER, ME, num(5_000_000), 20, '0xbb', 0);
  const chain = fakeChain({ head: 9000, maxRange: 2000, logs: [mint], receipts: { '0xbb': { transactionHash: '0xbb', blockNumber: hx(20), status: '0x1', from: OTHER, to: USDC, logs: [mint] } } });
  const { eng, store } = engineFor(chain, memStore(), { scan: { backfillWindows: 40, maxBackfillWindows: 100 } });
  const r = await eng.read('base-sepolia', ME);
  const doc = store.m.get('activity:v1:base-sepolia:' + ME);
  assert.equal(doc.scan.lo, 0); assert.equal(doc.scan.hi, 9000); assert.equal(r.logs.length, 1);
});
test('approve then revoke are typed from calldata while pending, then settled from the receipt', async () => {
  const input = (amt) => '0x095ea7b3' + pad(ROUTER).slice(2) + num(amt).slice(2);
  const chain = fakeChain({ nonce: 5 }); const { eng, store } = engineFor(chain);
  await eng.recordBroadcast({ chainId: 84532, from: ME, to: USDC, value: '0x0', input: input((1n << 256n) - 1n), nonce: 4, hash: '0xc1' });
  await eng.recordBroadcast({ chainId: 84532, from: ME, to: USDC, value: '0x0', input: input(0n), nonce: 5, hash: '0xc2' });
  let r = await eng.read('base-sepolia', ME, true);
  const byHash = (h) => r.local.find((x) => x.hash === h);
  assert.deepEqual([byHash('0xc1').kind, byHash('0xc1').unlimited, byHash('0xc1').status], ['approve', true, 'pending']);
  assert.deepEqual([byHash('0xc2').kind, byHash('0xc2').status], ['revoke', 'pending']);
  // the node now has the first one (its Approval log is emitted by the token the user called), the second was replaced
  const ap = log(USDC, AP, ME, ROUTER, num((1n << 256n) - 1n), 995, '0xc1', 3);
  const mined = { transactionHash: '0xc1', blockNumber: hx(995), status: '0x1', from: ME, to: USDC, gasUsed: '0x5208', effectiveGasPrice: '0x3b9aca00', logs: [ap] };
  const c2 = fakeChain({ nonce: 6, receipts: { '0xc1': mined }, txs: { '0xc1': { hash: '0xc1', from: ME, to: USDC, value: '0x0', input: input((1n << 256n) - 1n), nonce: '0x4' } } });
  const later = { now: () => 1_700_100_000_000 + 10 * 60_000 };
  const e2 = engineFor(c2, store, later).eng;
  await e2.reconcilePending(); await e2.reconcilePending(); await e2.reconcilePending();
  r = await e2.read('base-sepolia', ME, true);
  assert.deepEqual([byHash('0xc1').status, byHash('0xc1').symbol, byHash('0xc1').fee], ['confirmed', 'USDC', '0.000021']);
  assert.equal(byHash('0xc2'), undefined); // replaced: nonce moved on and the hash never appeared
});
test('swap, spend-only approval logs, and address poisoning', () => {
  const meta = () => ({ symbol: 'X', decimals: 6 });
  const ctx = { assetId: 'base-sepolia', me: ME, nativeSymbol: 'ETH', meta: (t) => (t === WETH ? { symbol: 'WETH', decimals: 18 } : { symbol: 'USDC', decimals: 6 }), source: 'logs' };
  // token -> token swap: I send USDC, receive WETH, and the router logs a spend-Approval that must NOT become an approval row
  const out = log(USDC, T, ME, ROUTER, num(2_000_000), 10, '0xd1', 0); const inn = log(WETH, T, ROUTER, ME, num(1_000_000_000_000_000n), 10, '0xd1', 1); const spend = log(USDC, AP, ME, ROUTER, num(0), 10, '0xd1', 2);
  const receipt = { transactionHash: '0xd1', blockNumber: hx(10), status: '0x1', from: ME, to: ROUTER, logs: [out, inn, spend] };
  const items = A.classify(ctx, { hash: '0xd1', receipt, tx: { hash: '0xd1', from: ME, to: ROUTER, value: '0x0', input: '0x3593564c', nonce: '0x1' }, timestamp: 1, status: 'confirmed' });
  assert.equal(items.length, 1); assert.equal(items[0].kind, 'swap'); assert.equal(items[0].swap.sent.symbol, 'USDC'); assert.equal(items[0].swap.received.symbol, 'WETH');
  // zero-value inbound transfer from a stranger is dropped
  const dust = log(USDC, T, OTHER, ME, num(0), 11, '0xd2', 0);
  assert.equal(A.classify(ctx, { hash: '0xd2', receipt: { transactionHash: '0xd2', blockNumber: hx(11), status: '0x1', from: OTHER, to: USDC, logs: [dust] }, timestamp: 1, status: 'confirmed' }).length, 0);
  void meta;
});
test('merge: typed local row hides explorer legs; duplicates collapse; pending settles to confirmed', () => {
  const base = { id: '0xe1', assetId: 'base-sepolia', symbol: 'ETH', amount: '1', timestamp: 5, kind: 'send' };
  const local = [{ ...base, status: 'pending', timestamp: 0 }, { ...base, id: '0xe2:s', hash: '0xe2', kind: 'swap', status: 'confirmed', amount: '3' }];
  const explorer = [{ ...base, status: 'confirmed', timestamp: 9 }, { ...base, id: '0xe2', kind: 'contract', amount: '0', status: 'confirmed' }, { ...base, id: '0xe3:7', kind: 'receive', amount: '0', token: { symbol: 'X', address: USDC }, status: 'confirmed' }];
  const m = A.mergeSources(local, [], explorer);
  assert.equal(m.length, 2); const send = m.find((x) => x.kind === 'send');
  assert.deepEqual([send.status, send.timestamp], ['confirmed', 9]); assert.ok(m.some((x) => x.kind === 'swap'));
});

test('classify: Aave-style deposit is one "Deposit" row, not a swap for the aToken', () => {
  const POOL = '0x4444444444444444444444444444444444444444', ATOKEN = '0x5555555555555555555555555555555555555555', Z = '0x0000000000000000000000000000000000000000';
  const input = '0x617ba037' + pad(USDC).slice(2) + num(1_000_000_000).slice(2) + pad(ME).slice(2) + num(0).slice(2);
  const receipt = { transactionHash: '0xaa', blockNumber: hx(5), from: ME, to: POOL, logs: [log(USDC, T, ME, ATOKEN, num(1_000_000_000), 5, '0xaa', 1), log(ATOKEN, T, Z, ME, num(999_999_999), 5, '0xaa', 2)] };
  const ctx = { assetId: 'base-sepolia', me: ME, nativeSymbol: 'ETH', meta: (t) => ({ symbol: t === USDC ? 'USDC' : 'aBasSepUSDC', decimals: 6 }), source: 'logs' };
  const items = A.classify(ctx, { hash: '0xaa', receipt, tx: { hash: '0xaa', from: ME, to: POOL, value: '0x0', input, nonce: '0x1' }, timestamp: 1, status: 'confirmed' });
  assert.equal(items.length, 1); assert.equal(items[0].kind, 'contract'); assert.equal(items[0].method, 'Deposit'); assert.equal(items[0].symbol, 'USDC'); assert.equal(items[0].amount, '1000');
});
