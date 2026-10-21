// Store migrations (plan A4): an old profile keeps its wallets/settings; versions persist per step; reruns are no-ops; crashes resume.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/', import.meta.url));
const mem = new Map();
globalThis.__mem = mem;
const stub = { name: 'stub', setup(b) {
  b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'p', namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ loader: 'js', contents: `const m = globalThis.__mem; const area = { async get(k) { return k in Object.fromEntries(m) ? { [k]: m.get(k) } : {}; }, async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); }, async remove(k) { m.delete(k); } }; export default { storage: { local: area, session: area } };` })); } };
const out = await build({ stdin: { contents: `export * from './background/store/migrations';`, resolveDir: dir, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', plugins: [stub] });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('old profile: wallet keys untouched, store becomes [1,0,state]', async () => {
  mem.clear(); mem.set('wallet:vault', 'ENC'); mem.set('wallet:settings', { lockTimeInMinutes: 15 });
  const t = await M.runMigrations('pre');
  assert.deepEqual([t[0], t[1]], [1, 0]); assert.equal(t[2].legacyImported, true);
  assert.equal(mem.get('wallet:vault'), 'ENC'); assert.deepEqual(mem.get('wallet:settings'), { lockTimeInMinutes: 15 });
});
test('rerun is a no-op; new migrations apply once, in order, with the version saved after each step', async () => {
  const calls = [];
  const pre = [...M.PRE_MIGRATIONS, (s) => { calls.push('a'); return { ...s, a: 1 }; }, (s) => { calls.push('b'); return { ...s, b: 1 }; }];
  await M.runMigrations('pre', pre); await M.runMigrations('pre', pre);
  assert.deepEqual(calls, ['a', 'b']); assert.equal(mem.get('wallet:store')[0], 3);
});
test('a crash mid-way resumes from the last saved version', async () => {
  mem.clear(); const calls = [];
  const pre = [(s) => ({ ...s, x: 1 }), () => { throw new Error('boom'); }, (s) => { calls.push('c'); return s; }];
  await assert.rejects(M.runMigrations('pre', pre));
  assert.equal(mem.get('wallet:store')[0], 1);
  pre[1] = (s) => ({ ...s, y: 1 }); await M.runMigrations('pre', pre);
  assert.deepEqual(calls, ['c']); assert.equal(mem.get('wallet:store')[0], 3);
});
