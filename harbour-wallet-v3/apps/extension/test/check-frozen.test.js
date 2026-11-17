// scripts/check-frozen.mjs: the frozen list covers the key-handling and boundary files and the comparison fails closed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FROZEN, findChanges, BASE_CANDIDATES } from '../scripts/check-frozen.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('the frozen list names the 20 key-handling and boundary files, and they all exist', () => {
  assert.equal(FROZEN.length, 20); assert.equal(new Set(FROZEN).size, 20);
  for (const must of ['src/background/keys.ts', 'src/background/reauth.ts', 'src/core/uiSafe.ts', 'src/core/provider/evmAccount.ts', 'src/core/vaultService.ts', 'src/content/content.ts', 'src/inpage/bridge.ts', 'src/core/storage.ts']) assert.ok(FROZEN.includes(must), must);
  for (const f of FROZEN) assert.ok(existsSync(root + f), `${f} exists`);
  assert.ok(BASE_CANDIDATES.length >= 1);
});
test('identical files pass; any byte of difference, a missing file or an unreadable file fails', () => {
  const base = { a: 'x', b: 'y', c: 'z' };
  assert.deepEqual(findChanges(['a', 'b'], (f) => base[f], (f) => base[f]), []);
  assert.deepEqual(findChanges(['a', 'b'], (f) => base[f], (f) => (f === 'b' ? 'y ' : base[f])), ['b']);
  assert.deepEqual(findChanges(['a'], (f) => base[f], () => Buffer.from('X')), ['a']);
  assert.deepEqual(findChanges(['a', 'zz'], (f) => base[f], (f) => base[f]), ['zz'], 'a file missing from the base is a failure');
  assert.deepEqual(findChanges(['a'], () => { throw new Error('no base'); }, () => 'x'), ['a (unreadable)']);
  assert.deepEqual(findChanges(['a'], () => 'x', () => { throw new Error('gone'); }), ['a (unreadable)']);
});
