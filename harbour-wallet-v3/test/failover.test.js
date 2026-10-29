// RPC failover, circuit breaker, redacting logger and endpoint config. Pure (no network): fetch is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const load = async (rel) => {
  const out = await build({ entryPoints: [fileURLToPath(new URL(rel, import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const { makeFailoverFetch } = await load('../src/kit/failoverFetch.ts');
const { NodeRepository } = await load('../src/kit/nodeRepository.ts');
const { redact } = await load('../src/core/logger.ts');
const { netStatus, recordNet, resetNetStatus } = await load('../src/kit/netStatus.ts');
const cfg = JSON.parse(readFileSync(new URL('../src/config/rpcEndpoints.json', import.meta.url), 'utf8'));

const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });
const ok = () => new Response('{"jsonrpc":"2.0","id":1,"result":"0x1"}', { status: 200 });

test('every configured EVM chain and Solana has at least three independent providers', () => {
  for (const [id, list] of Object.entries(cfg.evm)) {
    const hosts = new Set(list.map((u) => new URL(u).hostname.split('.').slice(-2).join('.')));
    assert.ok(list.length >= 3 && hosts.size >= 3, `chain ${id}: ${list.length} urls, ${hosts.size} providers`);
    assert.ok(list.every((u) => u.startsWith('https://')), `chain ${id} must be https`);
  }
  assert.ok(cfg.solana.length >= 3);
});

test('a 429 or failure moves to the next endpoint of the same chain', async () => {
  // EVM networks go through the Harbour API proxy (one URL; the backend fails over between providers itself), so use Solana's list.
  const calls = [];
  const f = makeFailoverFetch(async (u) => { calls.push(String(u)); return calls.length === 1 ? new Response('{}', { status: 429 }) : ok(); });
  const res = await f(cfg.solana[0], { method: 'POST', body });
  assert.equal(res.status, 200);
  assert.ok(calls.length >= 2 && calls[0] !== calls[1], calls.join(' | '));
});

test('network errors fail over too, and non-RPC requests pass through untouched', async () => {
  let n = 0;
  const f = makeFailoverFetch(async () => { if (n++ === 0) throw new TypeError('fetch failed'); return ok(); });
  assert.equal((await f(cfg.solana[0], { method: 'POST', body })).status, 200);
  const calls = [];
  const g = makeFailoverFetch(async (u) => { calls.push(String(u)); return ok(); });
  await g('https://example.com/x', { method: 'POST', body }); await g(cfg.evm['1'][0], { method: 'GET' });
  assert.deepEqual(calls, ['https://example.com/x', cfg.evm['1'][0]]);
});

test('a timed-out broadcast is never resent to another node', async () => {
  const calls = [];
  const f = makeFailoverFetch(async (u) => { calls.push(u); throw Object.assign(new Error('t'), { name: 'TimeoutError' }); });
  await assert.rejects(f(cfg.evm['137'][0], { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: ['0x00'] }) }));
  assert.equal(calls.length, 1);
});

test('circuit breaker skips a node after repeated failures and recovers on success', () => {
  const r = new NodeRepository([{ url: 'a', source: 'default', rank: 0 }, { url: 'b', source: 'default', rank: 1 }]);
  for (let i = 0; i < 3; i++) r.report('a', false);
  assert.ok(r.isOpen('a')); assert.deepEqual(r.ordered(), ['b', 'a']);
  r.report('a', true); assert.ok(!r.isOpen('a')); assert.deepEqual(r.ordered(), ['a', 'b']);
});

test('logger redacts API keys in URLs, hex secrets and mnemonic-shaped text', () => {
  const key = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4';
  const out = redact(new Error(`HTTP 429 from https://eth-mainnet.g.alchemy.com/v2/${key}?apikey=${key} and key=0x${'ab'.repeat(32)} phrase: abandon ability able about above absent absorb abstract absurd abuse access accident`));
  assert.ok(!out.includes(key) && !out.includes('abab') && !out.includes('abandon ability'), out);
  assert.match(out, /alchemy\.com\/v2\/\*\*\*/);
});

test('network status reports degraded and offline from real traffic', () => {
  resetNetStatus(); const t = Date.now();
  for (let i = 0; i < 4; i++) recordNet('rpc', true, 'a.example', t);
  assert.equal(netStatus(t, true).state, 'ok');
  for (let i = 0; i < 5; i++) recordNet('rpc', false, 'b.example', t);
  assert.equal(netStatus(t, true).state, 'offline');
  assert.equal(netStatus(t, false).state, 'offline');
});
