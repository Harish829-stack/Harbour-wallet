// Grant store (src/core/smartAccount/grantStore.ts): per-origin and per-account reads, replace by id, cap, remove.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/grantStore';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const mem = () => { const m = new Map(); return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, structuredClone(v)); } }; };
const rec = (id, origin = 'https://a.example', account = '0xAbC0000000000000000000000000000000000001') => ({ id, origin, account, chainId: 84532 });
test('a site reads only its own grants for the connected account (case-insensitive address)', async () => {
  const s = M.makeGrantStore(mem());
  await s.put(rec('0x1')); await s.put(rec('0x2', 'https://b.example')); await s.put(rec('0x3', 'https://a.example', '0x0000000000000000000000000000000000000009'));
  assert.deepEqual((await s.list('https://a.example', '0xabc0000000000000000000000000000000000001')).map((g) => g.id), ['0x1']);
  assert.equal((await s.all()).length, 3);
});
test('put replaces the same id, remove deletes, and the list is capped (newest kept)', async () => {
  const s = M.makeGrantStore(mem());
  await s.put(rec('0x1')); await s.put({ ...rec('0x1'), chainId: 11155111 }); assert.equal((await s.all()).length, 1); assert.equal((await s.all())[0].chainId, 11155111);
  await s.remove('0x1'); assert.equal((await s.all()).length, 0);
  for (let i = 0; i < M.MAX_GRANTS + 5; i++) await s.put(rec('0x' + (i + 1).toString(16)));
  const all = await s.all(); assert.equal(all.length, M.MAX_GRANTS); assert.equal(all.at(-1).id, '0x' + (M.MAX_GRANTS + 5).toString(16));
});
