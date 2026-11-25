// QA (boundary): X-HB-Session is "<chain>-<minute>". Same minute -> same id (one upstream per send flow); the next ms across the
// minute boundary -> a new id; chains never share one. TEST_PLAN: T-SIG-037.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const out = await build({ stdin: { contents: "export { sessionFor } from './src/core/harbour/fetchHook.ts'", resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const { sessionFor } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const realNow = Date.now;
const at = (ms, chain) => { Date.now = () => ms; try { return sessionFor(chain); } finally { Date.now = realNow; } };

test('T-SIG-037: session id is stable within a minute and rolls exactly at the minute boundary', () => {
  const m = 29_000_000 * 60_000; // an exact minute boundary
  assert.equal(at(m, 'eth'), `eth-${29_000_000}`);
  assert.equal(at(m + 59_999, 'eth'), at(m, 'eth'), 'last ms of the minute keeps the id');
  assert.notEqual(at(m + 60_000, 'eth'), at(m, 'eth'), 'first ms of the next minute rolls it');
  assert.notEqual(at(m - 1, 'eth'), at(m, 'eth'), 'last ms of the previous minute is a different id');
  assert.equal(at(m + 60_000, 'eth'), `eth-${29_000_001}`);
});

test('T-SIG-037: sessions are per chain and never collide across chains in the same minute', () => {
  const t = 1_800_000_123_456;
  const ids = new Set(['eth', 'base', 'op', 'arb', 'sol', 'btc'].map((c) => at(t, c)));
  assert.equal(ids.size, 6);
});
