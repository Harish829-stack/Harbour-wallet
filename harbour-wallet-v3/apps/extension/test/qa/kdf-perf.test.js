// QA (perf smoke): one default Argon2id derive finishes in < 5 s and keeps heap growth near the 46 MiB the parameters imply.
// TEST_PLAN: T-KEY-009. Smoke only: a regression to a much heavier setting (or a leak) fails; CI noise does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const o = await build({ stdin: { contents: "export * from './src/core/keySchedule.ts'", resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const K = await import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64'));

test('T-KEY-009: default params are 46 MiB / t=2 and a single derive completes in under 5 s', () => {
  assert.deepEqual(K.ARGON2_DEFAULT, { m: 47104, t: 2, p: 1 });
  assert.equal(K.ARGON2_DEFAULT.m / 1024, 46);
  const salt = new Uint8Array(16).fill(9);
  global.gc?.();
  const h0 = process.memoryUsage().arrayBuffers;
  const t0 = performance.now();
  const r = K.deriveV2('correct horse battery staple', salt, K.ARGON2_DEFAULT);
  const ms = performance.now() - t0;
  assert.match(r.unlockKey, /^[0-9a-f]+$/); assert.notEqual(r.unlockKey, r.passwordKey);
  assert.ok(ms < 5000, `derive took ${ms.toFixed(0)} ms`);
  const grown = (process.memoryUsage().arrayBuffers - h0) / 2 ** 20;
  assert.ok(grown < 200, `buffers grew ${grown.toFixed(0)} MiB`); // generous ceiling; expected ~46 MiB transiently
  console.log(`# derive ${ms.toFixed(0)} ms, retained buffers +${grown.toFixed(1)} MiB`);
});
