// Adding another seed or key to a wallet that already exists needs the unlock credential (password or biometrics) once per operation.
// Source-level guard: every worker path that stores a new secret into an existing vault must consume the add-wallet grant first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const body = (src, start) => { const i = src.indexOf(start); assert.ok(i >= 0, `${start} not found`); return src.slice(i, i + 3500); };

test('addWallet, qrSyncImport, importInitiate and qrImportAll require the add-wallet grant', () => {
  const w = read('background/modules/wallet.ts'); const o = read('background/handlers/onboardingExtra.ts');
  assert.match(body(w, 'addWallet: async'), /consumeReauth\('addWallet'\)/);
  assert.match(body(w, 'qrSyncImport: async'), /consumeReauth\('addWallet'\)/);
  assert.match(body(o, 'async importInitiate'), /consumeReauth\('addWallet'\)/);
  assert.match(body(o, 'async qrImportAll'), /consumeReauth\('addWallet'\)/);
});
test('revealAuth grants per purpose and the grant is one-shot', () => {
  const w = read('background/modules/wallet.ts'); const r = read('background/reauth.ts');
  assert.match(body(w, 'revealAuth: async'), /grantReauth\(purposeOf\(msg\.purpose\)\)/);
  assert.match(r, /session\.remove\(KEY\[p\]\)/);
});
test('a page cannot skip the gate: the batch marker is a Symbol, not a message field', () => {
  const w = read('background/modules/wallet.ts');
  assert.match(w, /const AUTHORIZED = Symbol\(/); assert.doesNotMatch(w, /msg\.authorized|msg\.preAuthorized/);
});
