// "Dumb UI" guard: the popup never receives or keeps a recovery phrase, private key or password.
//  1. Worker side: backup verification by opaque chip ids (core/backupSession) and the response firewall (core/uiSafe).
//  2. Static guards over the sources: no handler returns key material, the popup never asks for it, never renders it as text
//     and never binds a secret field to React state (controlled inputs mirror the value into the DOM).
// The runtime check (heap, DOM, accessibility tree, storage) of the built extension is documented in docs/harbour/UI-SECRET-BOUNDARY.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './core/backupSession'; export * from './core/uiSafe';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const tmp = fileURLToPath(new URL('./.ui-secrets.mjs', import.meta.url));
writeFileSync(tmp, out.outputFiles[0].text);
const M = await import(tmp + '?' + Date.now());
unlinkSync(tmp);

const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const files = (dir) => walk(path.join(src, dir)).map((f) => ({ f: path.relative(src, f), s: stripComments(readFileSync(f, 'utf8')) }));

test('backup session: the UI proves the order with chip ids; the worker keeps only the equality pattern of the words', () => {
  let n = 0; const id = () => `c${n++}`;
  const words = ['apple', 'banana', 'apple', 'cherry'];
  const plan = M.planBackup(words, id, () => 0.42);
  assert.deepEqual(plan.posClass, [0, 1, 0, 2]);
  assert.equal(plan.chips.length, 4);
  assert.ok(!JSON.stringify({ posClass: plan.posClass, chipClass: plan.chipClass }).includes('apple'), 'no word is stored in the session');
  const byIndex = (i) => plan.chips.find((c) => c.index === i).id;
  const s = { posClass: plan.posClass, chipClass: plan.chipClass };
  assert.deepEqual(M.checkPicks(s, [byIndex(0), byIndex(1), byIndex(2), byIndex(3)]), { valid: true, complete: true, firstWrong: -1, count: 4 });
  assert.equal(M.checkPicks(s, [byIndex(2), byIndex(1), byIndex(0), byIndex(3)]).complete, true, 'either copy of a repeated word fits either position');
  assert.deepEqual(M.checkPicks(s, [byIndex(1)]), { valid: false, complete: false, firstWrong: 0, count: 1 });
  assert.equal(M.checkPicks(s, [byIndex(0), byIndex(1)]).complete, false, 'a correct prefix is valid but not complete');
  assert.equal(M.checkPicks(s, [byIndex(0), byIndex(0)]).valid, false, 'a chip cannot be used twice');
  assert.equal(M.checkPicks(s, ['__proto__']).valid, false);
  assert.equal(M.checkPicks(s, 'nope').complete, false);
});

test('uiSafe blocks any response that carries key material, and lets ordinary data through', () => {
  for (const bad of [{ ok: true, mnemonic: 'a b c' }, { ok: true, wallet: { privateKey: '00' } }, { list: [{ seed_phrase: 'x' }] }, { password: 'x' }, { storedKeys: [{}] }])
    assert.equal(M.uiSafe(bad).error, 'SECRET_FIELD_BLOCKED', JSON.stringify(bad));
  for (const ok of [{ ok: true, image: 'data:image/png;base64,AA', network: 'Ethereum' }, { ok: true, isPasswordGenerated: true, keys: 3 }, { nfts: [{ attributes: { seed: 42 } }] }, { ok: true, mnemonic: undefined }])
    assert.deepEqual(M.uiSafe(ok), ok, JSON.stringify(ok));
});

test('no worker handler returns a phrase, private key or password', () => {
  const bad = [];
  for (const { f, s } of files('background')) {
    for (const m of s.matchAll(/return\s*\{[^{};]*?\b(mnemonic|privateKey|seedPhrase|password|passwordKey|unlockKey)\s*[:,}]/g)) bad.push(`${f}: ${m[0].slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('the popup never asks the worker for key material and never holds it as text', () => {
  const bad = [];
  for (const { f, s } of files('popup')) {
    const rules = [
      [/type:\s*'(revealMnemonic|generateMnemonic|exportPrivateKey|getMnemonic)'/, 'requests a secret from the worker'],
      [/\.mnemonic\b|\bmnemonic\s*:|\bpresetMnemonic\b/, 'handles a mnemonic value'],
      [/\br\.key\b|\bkey\.key\b/, 'renders a private key as text'],
      [/navigator\.clipboard[^;\n]*(key|phrase|secret)/i, 'copies a secret from the page'],
      [/<textarea\b[^>]*\bvalue=/, 'controlled textarea (React writes the value into the DOM text node)'],
      [/type=["']password["'][^>]*\bvalue=|\bvalue=\{[^}]*\}[^>]*type=["']password["']/, 'controlled password input (React mirrors it into the value attribute)'],
      [/useState\(\s*''\s*\)[^;\n]*\b(password|setPassword|setPw|setSecret|setPhrase)\b|\bconst\s*\[\s*(password|pw|secret|phrase|confirmation)\s*,/, 'keeps a secret in React state'],
    ];
    for (const [re, why] of rules) if (re.test(s)) bad.push(`${f}: ${why}`);
  }
  assert.deepEqual(bad, []);
});
