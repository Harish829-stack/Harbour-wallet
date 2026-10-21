import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipDir } from '../scripts/lib-zip.mjs';

// Phase 8: simulation asset changes, approval-scan parsing, ScamSniffer list parsing, deterministic release zips.
const bundle = async (contents) => {
  const out = await build({ stdin: { contents, resolveDir: fileURLToPath(new URL('../src/core/', import.meta.url)), sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const M = await bundle(`export * from './provider/simulate'; export { parseGoPlus } from './approvals'; export { parseList, addressRisk } from './provider/phishing';`);
const ME = '0x1111111111111111111111111111111111111111'; const OTHER = '0x2222222222222222222222222222222222222222';
const pad = (a) => '0x' + '0'.repeat(24) + a.slice(2);
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

test('eth_simulateV1 logs become net balance changes (native pseudo-token, ERC-20, ERC-721)', () => {
  const logs = [
    { address: M.NATIVE_PSEUDO, topics: [TRANSFER, pad(ME), pad(OTHER)], data: '0x' + (10n ** 18n).toString(16) },
    { address: '0x' + 'a'.repeat(40), topics: [TRANSFER, pad(OTHER), pad(ME)], data: '0x' + (500n).toString(16) },
    { address: '0x' + 'a'.repeat(40), topics: [TRANSFER, pad(ME), pad(OTHER)], data: '0x' + (200n).toString(16) },
    { address: '0x' + 'b'.repeat(40), topics: [TRANSFER, pad(ME), pad(OTHER), '0x' + '0'.repeat(63) + '7'], data: '0x' },
    { address: '0x' + 'c'.repeat(40), topics: [TRANSFER, pad(OTHER), pad(OTHER)], data: '0x1' },
  ];
  const ch = M.assetChangesFrom(logs, ME);
  assert.deepEqual(ch.map((c) => [c.kind, c.direction, c.amount]), [['native', 'out', String(10n ** 18n)], ['erc20', 'in', '300'], ['nft', 'out', '1']]);
  assert.equal(M.readSimulation([{ calls: [{ status: '0x0', error: { message: 'execution reverted' }, logs: [] }] }], ME).ok, false);
  assert.equal(M.readSimulation({}, ME), null);
  assert.equal(M.simulateParams({ from: ME, to: OTHER, data: '0xab' })[0].traceTransfers, true);
});

test('GoPlus approval parsing keeps valid spenders and marks malicious ones', () => {
  const rows = M.parseGoPlus('ethereum', { result: [{ token_address: '0x' + 'A'.repeat(40), token_symbol: 'USDC', decimals: 6, approved_list: [
    { approved_contract: '0x' + 'B'.repeat(40), approved_amount: 'Unlimited', approved_time: 1700000000, address_info: { contract_name: 'Router', malicious_behavior: [] } },
    { approved_contract: '0x' + 'C'.repeat(40), address_info: { malicious_behavior: ['phishing_activities'] } },
    { approved_contract: 'garbage' },
  ] }] });
  assert.equal(rows.length, 2); assert.equal(rows[0].spenderName, 'Router'); assert.equal(rows[0].risky, false); assert.equal(rows[1].risky, true);
  assert.equal(rows[0].token, '0x' + 'a'.repeat(40)); assert.equal(rows[0].approvedAt, 1700000000000);
});

test('ScamSniffer lists: tolerant parsing and address lookup with caching', async () => {
  assert.deepEqual(M.parseList(['Evil.com', 'https://x.io/path', 7]), ['evil.com', 'x.io']);
  assert.deepEqual(M.parseList({ a: ['A.com'], b: 'b.com' }), ['a.com', 'b.com']);
  const store = new Map(); const kv = { get: async (k) => store.get(k), set: async (k, v) => { store.set(k, v); }, remove: async () => {} };
  let calls = 0; const f = async () => { calls++; return { ok: true, json: async () => [OTHER] }; };
  assert.equal(await M.addressRisk(OTHER.toUpperCase().replace('0X', '0x'), kv, f), 'scam'); assert.equal(await M.addressRisk(ME, kv, f), 'ok'); assert.equal(calls, 1);
});

test('release zips are byte-identical for the same files regardless of creation order', () => {
  const mk = (order) => { const d = mkdtempSync(path.join(tmpdir(), 'hbzip-')); mkdirSync(path.join(d, 'a')); for (const [n, c] of order) writeFileSync(path.join(d, n), c); return d; };
  const files = [['manifest.json', '{}'], ['a/x.js', 'x'], ['b.txt', 'b']];
  const z1 = zipDir(mk(files)).zip; const z2 = zipDir(mk([...files].reverse())).zip;
  assert.ok(z1.equals(z2)); assert.equal(z1.readUInt32LE(0), 0x04034b50);
});
