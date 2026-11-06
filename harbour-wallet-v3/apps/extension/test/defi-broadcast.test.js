// Testnet Swap / Earn broadcasts go through the Harbour API on indexed networks (tracked as pending, balances refreshed on
// settle); the public RPC is used only when the API cannot be reached, never after the API refused the transaction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { keccak_256 } from '@noble/hashes/sha3';

const out = await build({ stdin: { contents: `export * from './broadcast';`, resolveDir: fileURLToPath(new URL('../src/integrations/testnet-defi/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const B = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const RAW = '0x02f86c83aa36a7';
const HASH = '0x' + Buffer.from(keccak_256(Buffer.from(RAW.slice(2), 'hex'))).toString('hex');
const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
const URL_ = 'https://api.test/v1/rpc/sepolia';

test('indexed network: broadcast through the Harbour RPC URL, public RPC untouched', async () => {
  const seen = []; let publicCalls = 0;
  const h = await B.broadcastSigned(RAW, { harbourRpcUrl: URL_, fetch: async (u, init) => { seen.push([u, JSON.parse(init.body)]); return json({ jsonrpc: '2.0', id: 1, result: HASH }); }, sendPublic: async () => { publicCalls++; return HASH; } });
  assert.equal(h, HASH); assert.equal(publicCalls, 0);
  assert.deepEqual([seen[0][0], seen[0][1].method, seen[0][1].params[0]], [URL_, 'eth_sendRawTransaction', RAW]);
});

test('API refusal is final: shown to the user, no public re-broadcast', async () => {
  let publicCalls = 0;
  await assert.rejects(B.broadcastSigned(RAW, { harbourRpcUrl: URL_, fetch: async () => json({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Not enough balance to cover the amount and network fee.', data: { harbour: 'insufficient_funds' } } }), sendPublic: async () => { publicCalls++; return HASH; } }), /Not enough balance/);
  assert.equal(publicCalls, 0);
});

test('API unreachable: falls back to the public RPC', async () => {
  for (const fetch of [async () => { throw new TypeError('Failed to fetch'); }, async () => json({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Network busy', data: { harbour: 'network_busy' } } })]) {
    let publicCalls = 0;
    assert.equal(await B.broadcastSigned(RAW, { harbourRpcUrl: URL_, fetch, sendPublic: async () => { publicCalls++; return HASH; } }), HASH);
    assert.equal(publicCalls, 1);
  }
});

test('a hash that is not keccak256(raw) is refused; non-indexed networks use public RPC; "already known" is success', async () => {
  await assert.rejects(B.broadcastSigned(RAW, { harbourRpcUrl: URL_, fetch: async () => json({ jsonrpc: '2.0', id: 1, result: '0x' + '11'.repeat(32) }), sendPublic: async () => HASH }), /could not confirm/);
  let fetched = 0;
  assert.equal(await B.broadcastSigned(RAW, { fetch: async () => { fetched++; return json({}); }, sendPublic: async () => HASH }), HASH);
  assert.equal(fetched, 0);
  assert.equal(await B.broadcastSigned(RAW, { harbourRpcUrl: URL_, fetch: async () => { throw new TypeError('reset'); }, sendPublic: async () => { throw new Error('already known'); } }), HASH);
});
