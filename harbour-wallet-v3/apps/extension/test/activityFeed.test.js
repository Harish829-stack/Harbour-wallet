import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './activityFeed';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const A = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const row = (assetId, id, timestamp, status = 'confirmed') => ({ id, assetId, kind: 'receive', status, timestamp, amount: '1', symbol: 'X' });

test('merge dedupes per network, sorts newest first, pending leads, ties are stable', () => {
  const m = A.mergeActivity([[row('base', 'a', 10), row('base', 'a', 10)], [row('sepolia', 'a', 10), row('sepolia', 'p', 0, 'pending'), row('sepolia', 'u', 0)], [row('base', 'z', 30)]]);
  assert.deepEqual(m.map((x) => `${x.assetId}:${x.id}`), ['sepolia:p', 'base:z', 'base:a', 'sepolia:a', 'sepolia:u']);
});
test('networks list: only chains with rows, most recent first', () => {
  const n = A.activityNetworks([row('base', '1', 5), row('sepolia', '2', 9), row('base', '3', 7)]);
  assert.deepEqual(n, [{ assetId: 'sepolia', count: 1 }, { assetId: 'base', count: 2 }]);
  assert.deepEqual(A.activityNetworks([]), []);
});
test('chain order: preferred, then funded, then the rest, stable', () => {
  assert.deepEqual(A.orderChains(['a', 'b', 'c', 'd', 'e'], 'd', new Set(['c', 'b'])), ['d', 'b', 'c', 'a', 'e']);
  assert.deepEqual(A.orderChains(['a', 'b'], null, new Set()), ['a', 'b']);
});

test('activity shows one network: a pick counts only while it is still selectable', () => {
  assert.equal(A.resolveActivityChain(['base', 'sepolia'], 'sepolia'), 'sepolia');
  assert.equal(A.resolveActivityChain(['base'], 'sepolia'), null, 'a stale pick falls back to "choose a network"');
  assert.equal(A.resolveActivityChain(['base'], null), null);
  assert.equal(A.resolveActivityChain([], undefined), null);
});
