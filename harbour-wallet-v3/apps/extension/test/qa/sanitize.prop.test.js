// QA (property): sanitizeResult rewrites only string `error` fields (via userText), keeps shape/other fields identical, leaves
// anything deeper than 5 levels untouched, and never mutates its input. TEST_PLAN: T-KEY-111.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const o = await build({ stdin: { contents: "export * from './src/core/errors.ts'", resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { sanitizeResult, userText } = await import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64'));
const RUNS = Number(process.env.HB_FUZZ_RUNS ?? 300);

// independent oracle: structural walk, depth counted from the root like the implementation documents (>5 untouched)
const oracle = (v, d = 0) => {
  if (d > 5 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => oracle(x, d + 1));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'error' && typeof x === 'string' ? userText(x) : oracle(x, d + 1)]));
};
const errText = fc.oneof(fc.constant('HTTP 500'), fc.constant('TypeError: x is not a function'), fc.constant('LOCKED'), fc.constant('fetch failed'), fc.string(), fc.constant('https://api.x/y'));
const leaf = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), errText);
const tree = fc.letrec((t) => ({ node: fc.oneof({ depthSize: 'small', maxDepth: 8 }, leaf, fc.array(t('node'), { maxLength: 3 }), fc.dictionary(fc.oneof(fc.constant('error'), fc.constant('errors'), fc.constant('ok'), fc.string({ maxLength: 4 })).filter((k) => k !== '__proto__'), t('node'), { maxKeys: 4 })) })).node;

test('T-KEY-111: sanitizeResult equals the structural oracle and does not mutate the input', () => {
  fc.assert(fc.property(tree, (v) => {
    const before = JSON.stringify(v);
    const r = sanitizeResult(v);
    assert.deepEqual(r, oracle(v));
    assert.equal(JSON.stringify(v), before, 'input mutated');
  }), { numRuns: RUNS });
});

test('T-KEY-111: only string error fields change; non-string error values and other keys are identical; depth > 5 untouched', () => {
  const raw = 'HTTP 500: upstream https://x.example failed';
  const r = sanitizeResult({ error: raw, n: { error: 7, m: 'HTTP 500' }, list: [{ error: raw }] });
  assert.notEqual(r.error, raw); assert.equal(r.n.error, 7); assert.equal(r.n.m, 'HTTP 500'); assert.notEqual(r.list[0].error, raw);
  let deep = { error: raw }; for (let i = 0; i < 6; i++) deep = { x: deep };
  let p = sanitizeResult(deep); for (let i = 0; i < 6; i++) p = p.x;
  assert.equal(p.error, raw, 'beyond depth 5 is left as-is');
  assert.equal(sanitizeResult({ error: 'LOCKED' }).error, 'LOCKED', 'single-token codes pass through');
  assert.equal(sanitizeResult(null), null); assert.equal(sanitizeResult('s'), 's');
});
