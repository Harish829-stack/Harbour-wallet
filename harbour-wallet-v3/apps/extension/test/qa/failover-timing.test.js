// QA (timed run): the RPC failover gives a slow method (getSupply / getProgramAccounts) 30 s per attempt and every other call 10 s.
// A fake node answers after 15 s on a fake clock: a normal call must be cut off at 10 s and moved to the next endpoint, a slow method
// must wait and succeed on the first endpoint. TEST_PLAN: T-CH-015 (timed half; the regex half is in locale-format.test.js).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const out = await build({ entryPoints: [fileURLToPath(new URL('../../src/kit/failoverFetch.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
const { makeFailoverFetch } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const cfg = JSON.parse(readFileSync(new URL('../../src/config/rpcEndpoints.json', import.meta.url), 'utf8'));
const body = (m) => JSON.stringify({ jsonrpc: '2.0', id: 1, method: m, params: [] });
const okRes = () => new Response('{"jsonrpc":"2.0","id":1,"result":1}', { status: 200 });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

// A node that needs `delayMs` to answer, honouring the caller's abort signal like real fetch.
function slowNode(delayMs, calls) {
  return (u, init) => new Promise((resolve, reject) => {
    calls.push(String(u));
    const t = setTimeout(() => resolve(okRes()), delayMs);
    init?.signal?.addEventListener('abort', () => { clearTimeout(t); reject(init.signal.reason ?? new DOMException('aborted', 'AbortError')); }, { once: true });
  });
}
async function run(method, ticks) {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const calls = []; const f = makeFailoverFetch(slowNode(15_000, calls));
    const p = f(cfg.solana[0], { method: 'POST', body: body(method) }).then((r) => ({ status: r.status }), (e) => ({ error: String(e?.name ?? e) }));
    await flush();
    const log = [];
    for (const [ms, label] of ticks) { mock.timers.tick(ms); await flush(); log.push([label, calls.length]); }
    return { calls, log, settled: await Promise.race([p, flush().then(() => 'pending')]) };
  } finally { mock.timers.reset(); }
}

test('T-CH-015: a normal call is cut off at 10 s and retried on the next endpoint; it never waits the 15 s the node needs', async () => {
  const r = await run('eth_blockNumber', [[9_000, 't=9s'], [1_500, 't=10.5s']]);
  assert.equal(r.log[0][1], 1, 'only the first endpoint is tried before 10 s');
  assert.ok(r.log[1][1] >= 2, `after the 10 s attempt timeout the next endpoint is tried (calls: ${r.log[1][1]})`);
  assert.notEqual(new Set(r.calls).size, 1, 'a different endpoint, not the same one again');
});

test('T-CH-015: a listed slow method gets 30 s: still waiting on the first endpoint at 14 s, answered at 15 s, no failover', async () => {
  for (const m of ['getSupply', 'getProgramAccounts']) {
    const r = await run(m, [[14_000, 't=14s'], [1_500, 't=15.5s']]);
    assert.equal(r.log[0][1], 1, `${m}: no second endpoint at 14 s`);
    assert.equal(r.log[1][1], 1, `${m}: the first endpoint answered at 15 s, so no failover happened`);
    assert.deepEqual(r.settled, { status: 200 }, `${m} resolved with the slow node's answer`);
  }
});

test('T-CH-015: even a slow method is cut off at 30 s', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const calls = []; const f = makeFailoverFetch(slowNode(120_000, calls));
    const p = f(cfg.solana[0], { method: 'POST', body: body('getSupply') }).catch(() => 'failed'); void p;
    await flush(); mock.timers.tick(29_000); await flush(); assert.equal(calls.length, 1);
    mock.timers.tick(1_500); await flush(); assert.ok(calls.length >= 2, `the 30 s limit moved on to the next endpoint (calls: ${calls.length})`);
  } finally { mock.timers.reset(); }
});
