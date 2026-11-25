// QA: regression tests for the fixes of BUGS_FOUND.md items that had no direct unit test (BUG-08, BUG-12, OBS-15) — pure modules bundled
// with esbuild, no browser. The other fixes are pinned by the tests that originally reproduced them (now plain assertions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../src/', import.meta.url));
const out = await build({
  stdin: { contents: `export { ApprovalWindow } from './background/provider/approvalWindow'; export { checkRawTx } from './background/provider/service'; export { resolveSns } from './core/sendService';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'stub-polyfill', setup(b) { b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'wep', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};' })); } }],
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

class MemKV { constructor() { this.m = new Map(); } async get(k) { return this.m.get(k); } async set(k, v) { this.m.set(k, v); } async remove(k) { this.m.delete(k); } }
const noPending = { list: async () => [] };

test('BUG-12: a refused window position is retried without coordinates, so the approval window still opens', async () => {
  const calls = [];
  const w = { async getLastFocused() { return { left: 2000, top: 0, width: 4000 }; }, async get() { return undefined; }, async update() {}, async remove() {},
    async create(o) { calls.push(o); if (o.left !== undefined) throw new Error('Invalid value for bounds. Bounds must be at least 50% within visible screen space.'); return { id: 7 }; } };
  const kv = new MemKV(); const aw = new M.ApprovalWindow(w, kv, noPending, 'chrome-extension://x/src/popup/index.html#/notification');
  await aw.open();
  assert.equal(calls.length, 2); assert.equal(calls[1].left, undefined); assert.equal(calls[1].top, undefined);
  assert.equal(await aw.windowId(), 7);
});

test('BUG-12: when no window can be created at all, open() rejects (the provider then answers the site instead of waiting silently)', async () => {
  const w = { async getLastFocused() { return undefined; }, async get() { return undefined; }, async update() {}, async remove() {}, async create() { throw new Error('no windows'); } };
  const aw = new M.ApprovalWindow(w, new MemKV(), noPending, 'u');
  await assert.rejects(aw.open(), /no windows/);
});

test('BUG-08: eth_sendRawTransaction from a site needs one signed transaction envelope, else -32602', () => {
  const legacy = '0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83';
  assert.doesNotThrow(() => M.checkRawTx([legacy]));
  for (const params of [[], ['xxxx'], ['0x'], ['0x123'], ['0xzz'], [legacy, 'extra'], [42], ['0x' + 'ab'.repeat(300_000)], ['0xdeadbeef'], ['0x02c0']]) {
    assert.throws(() => M.checkRawTx(params), (e) => e.code === -32602, JSON.stringify(params).slice(0, 40));
  }
});

test('OBS-15: .sol names resolve through the Harbour gateway route, the answer must be a Solana address', async () => {
  const seen = [];
  const f = async (url) => { seen.push(String(url)); return new Response(JSON.stringify({ s: 'ok', result: 'HKKp49qGWXd639QsuH7JiLijfVW5UtCVY4s1n2HANwEA' }), { status: 200 }); };
  assert.equal(await M.resolveSns('Bonfida.sol', f, 'https://api.example/v1/gw'), 'HKKp49qGWXd639QsuH7JiLijfVW5UtCVY4s1n2HANwEA');
  assert.deepEqual(seen, ['https://api.example/v1/gw/sns/resolve/bonfida']);
  const bad = async () => new Response(JSON.stringify({ s: 'ok', result: '0x1234' }), { status: 200 });
  await assert.rejects(M.resolveSns('x.sol', bad, 'https://api.example/v1/gw'), /could not be resolved/);
  await assert.rejects(M.resolveSns('../admin.sol', f, 'https://api.example/v1/gw'), /could not be resolved/);
  await assert.rejects(M.resolveSns('x.sol', f, ''), /not available/);
  assert.equal(seen.length, 1, 'no request for a refused name or without a gateway');
});
