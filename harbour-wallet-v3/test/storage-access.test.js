// Audit A4: storage.local must be pinned to trusted extension contexts at worker boot (content scripts may not read or write it).
// Behaviour verified in real Chromium 153: a content script gets "Access to storage is not allowed from this context" after boot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sw = fs.readFileSync(new URL('../src/background/index.ts', import.meta.url), 'utf8');
test('worker pins storage.local and storage.session to TRUSTED_CONTEXTS', () => {
  assert.match(sw, /chrome\.storage\.session as any\)\.setAccessLevel\?\.\(\{ accessLevel: 'TRUSTED_CONTEXTS' \}\)/);
  assert.match(sw, /chrome\.storage\.local as any\)\.setAccessLevel\?\.\(\{ accessLevel: 'TRUSTED_CONTEXTS' \}\)/);
});
test('content script and inpage never touch extension storage', () => {
  for (const dir of ['../src/content/', '../src/inpage/']) for (const f of fs.readdirSync(new URL(dir, import.meta.url)).filter((n) => /\.tsx?$/.test(n))) {
    assert.doesNotMatch(fs.readFileSync(new URL(dir + f, import.meta.url), 'utf8'), /storage\.(local|sync|session)|core\/storage/, f);
  }
});
