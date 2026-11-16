// Earn plan locking: the EVM staking runner refuses to sign when the live fee rose past what the user reviewed (+20%), and
// the review store is single-use and bound to the account that reviewed it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({
  stdin: { contents: `export { estimatePlan, runPlan } from './background/handlers/earnEvm'; export { ReviewStore } from './integrations/testnet-defi/plans';`, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const state = { baseFee: 10_000_000_000n, sent: 0 };
const server = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
    const one = (m) => {
      const r = { eth_chainId: '0xf423f', eth_getTransactionCount: '0x0', eth_estimateGas: '0x5208', eth_maxPriorityFeePerGas: '0x3b9aca00', eth_gasPrice: '0x' + state.baseFee.toString(16),
        eth_getBlockByNumber: { number: '0x1', hash: '0x' + '11'.repeat(32), baseFeePerGas: '0x' + state.baseFee.toString(16), timestamp: '0x1', transactions: [] },
        eth_sendRawTransaction: '0x' + 'ab'.repeat(32) }[m.method];
      if (m.method === 'eth_sendRawTransaction') state.sent++;
      return { jsonrpc: '2.0', id: m.id, result: r ?? null };
    };
    const j = JSON.parse(body); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(Array.isArray(j) ? j.map(one) : one(j)));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const chain = { id: 'lock-test', kind: 'evm', evmChainId: 999999, name: 'Lock', symbol: 'ETH', decimals: 18, rpcs: [url] };
const plan = [{ to: '0x' + '22'.repeat(20), data: '0x', value: 1n, gasFallback: 100000n }];
const KEY = new Uint8Array(32).fill(1);

test('runPlan signs at the reviewed price, and refuses before signing when the live fee rose past +20%', async () => {
  const est = await M.estimatePlan(chain, '0x' + '33'.repeat(20), plan);
  assert.ok(est.price > 0n);
  const cap = { maxPrice: (est.price * 12n) / 10n, onFeeRose: () => Object.assign(new Error('fee rose'), { code: 'fee_changed' }) };
  state.sent = 0; state.baseFee = 10_500_000_000n; // small move: within the slack
  assert.equal((await M.runPlan(chain, KEY, plan, cap)).length, 1);
  state.sent = 0; state.baseFee = 30_000_000_000n; // fee tripled after review
  await assert.rejects(M.runPlan(chain, KEY, plan, cap), (e) => e.code === 'fee_changed');
  assert.equal(state.sent, 0, 'nothing was broadcast');
  server.close();
});

test('review store: single use, bound to the reviewing account, expires', () => {
  const s = new M.ReviewStore(); const now = 1_000;
  s.put('a', { owner: 'w1:0', expiresAt: now + 100, plan: 1 }, now);
  assert.throws(() => s.take('a', 'w1:1', now), /account changed/);
  s.put('b', { owner: 'w1:0', expiresAt: now + 100, plan: 2 }, now);
  assert.equal(s.take('b', 'w1:0', now).plan, 2);
  assert.throws(() => s.take('b', 'w1:0', now), /expired/, 'a review cannot be replayed');
  s.put('c', { owner: 'w1:0', expiresAt: now + 100, plan: 3 }, now);
  assert.throws(() => s.take('c', 'w1:0', now + 101), /expired/);
});
