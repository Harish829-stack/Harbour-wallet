// Seed-typing review (2026-11-04): local per-word phrase checks, QR one-time-code attempt limit, and the UI wiring for paste,
// re-mask on leave, idle wipe and hold-to-reveal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { english } from 'viem/accounts';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const fakeBrowser = `const s = (globalThis.__qr ??= { session: {} });
export default { storage: { session: { get: async (k) => (k in s.session ? { [k]: structuredClone(s.session[k]) } : {}), set: async (o) => { Object.assign(s.session, structuredClone(o)); }, remove: async (k) => { delete s.session[k]; } }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} } } };`;
const out = await build({ stdin: { contents: `export * from './core/seedWords'; export { stageQrKeys, readQrStage, qrWrongCode, QR_MAX_WRONG_CODES } from './background/qrStage';`, resolveDir: root, sourcefile: 'e.ts', loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'fake', setup(b) { b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'f', namespace: 'f' })); b.onLoad({ filter: /.*/, namespace: 'f' }, () => ({ contents: fakeBrowser, loader: 'js' })); } }] });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const W = new Set(english);
const P12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('phrase is checked word by word locally; only a complete 12/18/24-word phrase goes to the worker', () => {
  const a = (s) => M.assessTypedPhrase(s, W);
  assert.equal(a('').state, 'empty');
  assert.equal(a('aban').state, 'typing', 'an unfinished last word may be a prefix');
  assert.deepEqual(a('aban '), { state: 'badWord', index: 0 }, 'a finished word must be a real word');
  assert.deepEqual(a('abandon zzz abandon'), { state: 'badWord', index: 1 });
  assert.equal(a('abandon abandon').state, 'typing');
  assert.equal(a(P12).state, 'complete');
  assert.equal(a(P12.slice(0, -2)).state, 'typing', '12 words but the last is still a prefix');
  assert.equal(a(Array(25).fill('abandon').join(' ')).state, 'tooLong');
  assert.equal(a('4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318').state, 'privateKey');
  assert.equal(a('  ABANDON  Abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about ').state, 'complete');
});
test('QR import: the staged keystores are destroyed after 5 wrong one-time codes', async () => {
  const st = await M.stageQrKeys([{ type: 'mnemonic' }]); assert.equal(st.ok, true);
  for (let i = 1; i < M.QR_MAX_WRONG_CODES; i++) assert.equal(await M.qrWrongCode(st.stageId), 'INCORRECT_CODE');
  assert.ok(await M.readQrStage(st.stageId), 'still staged after 4 wrong codes');
  assert.equal(await M.qrWrongCode(st.stageId), 'QR_TOO_MANY_ATTEMPTS');
  assert.equal(await M.readQrStage(st.stageId), null, 'gone after the 5th');
  assert.equal(await M.qrWrongCode('other'), 'INCORRECT_CODE');
});
test('worker counts wrong QR codes on every path that tries one', () => {
  const o = readFileSync(new URL('../src/background/handlers/onboardingExtra.ts', import.meta.url), 'utf8');
  const w = readFileSync(new URL('../src/background/modules/wallet.ts', import.meta.url), 'utf8');
  assert.equal((o.match(/await qrWrongCode\(m\.stageId\)/g) ?? []).length, 2, 'qrVerify + qrImportAll');
  assert.match(w, /await qrWrongCode\(msg\.stageId\)/, 'qrSyncImport');
  assert.match(readFileSync(new URL('../src/background/qrStage.ts', import.meta.url), 'utf8'), /TTL_MS = 5 \* 60_000/);
});
test('UI wiring: typing warning, paste clears clipboard + warns, re-mask on leave, idle wipe, no per-pause phrase sends, hold-to-reveal', () => {
  const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  const form = read('popup/onboarding/ImportSecret.tsx');
  assert.match(form, /secret-typing-warning/); assert.match(form, /onPaste=\{onPaste\}/); assert.match(form, /navigator\.clipboard\?\.writeText\(''\)/);
  assert.match(form, /useHideOnLeave\(\(\) => setVisible\(false\)\)/); assert.match(form, /SECRET_IDLE_WIPE_MS = 5 \* 60_000/);
  assert.match(form, /spellCheck=\{false\} autoComplete="off" autoCapitalize="off" autoCorrect="off"/);
  assert.doesNotMatch(form, /type="password"/, 'not a password field: Chrome would offer to save words');
  const ob = read('popup/onboarding/Onboarding.tsx');
  assert.match(ob, /assessTypedPhrase\(value, BIP39, BIP39_PREFIXES\)/); assert.match(ob, /if \(a\.state === 'typing'\) \{ setCheck\(\{ state: 'idle' \}\); return; \}/);
  assert.match(ob, /onWipe=\{clearSecret\}/); assert.match(ob, /className="ob-secret-masked"/, 'one-time code is masked');
  assert.match(read('popup/onboarding/BackupFlow.tsx'), /<HoldToReveal /); assert.match(read('popup/wallet/walletScreens.tsx'), /<HoldToReveal /);
  const sf = read('popup/secureField.tsx'); assert.match(sf, /HOLD_TO_REVEAL_MS = 1200/); assert.match(sf, /REVEAL_VISIBLE_MS = 60_000/);
});
