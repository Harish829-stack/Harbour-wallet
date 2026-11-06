// Biometrics (WebAuthn wrapper) + PasskeyService, against fake credentials and an in-memory fake of webextension-polyfill.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const fakeBrowser = `
const store = (g) => ({ get: async (k) => (k in g.data ? { [k]: g.data[k] } : {}), set: async (o) => { Object.assign(g.data, o); }, remove: async (k) => { delete g.data[k]; } });
const state = globalThis.__fake = { local: { data: {} }, session: { data: {} } };
export default { storage: { local: store(state.local), session: store(state.session) } };`;
const plugin = { name: 'fake', setup(b) {
  b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'fake', namespace: 'fake' }));
  b.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: fakeBrowser, loader: 'js' }));
} };
const out = await build({ stdin: { contents: `export * from './core/passkey'; export * from './core/passkeyService'; export { KEYS } from './core/storage';`, resolveDir: root, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', plugins: [plugin] });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const F = () => globalThis.__fake;
beforeEach(() => { F().local.data = {}; F().session.data = {}; M.Biometrics.abortController = null; });

// A fake PRF authenticator (HW-2026-001): a per-credential HMAC key that never leaves it; `prf.results.first` = HMAC(key, salt).
import { createHmac } from 'node:crypto';
function fakeAuthenticator({ tamperChallenge = false, noPrf = false, prfDisabledOnCreate = false, key = 'k1' } = {}) {
  let userId; const rawId = new Uint8Array([1, 2, 3, 4]);
  return {
    async create(o) { userId = new Uint8Array(o.publicKey.user.id); return { rawId, response: { getTransports: () => ['internal'] }, getClientExtensionResults: () => ({ prf: { enabled: !prfDisabledOnCreate && !!o.publicKey.extensions?.prf } }) }; },
    async get(o) {
      const ch = tamperChallenge ? new Uint8Array(32) : new Uint8Array(o.publicKey.challenge);
      const clientDataJSON = new TextEncoder().encode(JSON.stringify({ challenge: M.b64url(ch), type: 'webauthn.get' }));
      const salt = o.publicKey.extensions?.prf?.eval?.first;
      const first = !noPrf && salt ? new Uint8Array(createHmac('sha256', key).update(Buffer.from(salt)).digest()).buffer : undefined;
      return { response: { clientDataJSON, userHandle: userId }, getClientExtensionResults: () => (first ? { prf: { results: { first } } } : {}) };
    },
  };
}

test('toHex/fromHex round trip and reject bad hex', () => {
  const b = Uint8Array.from([0, 15, 255]);
  assert.equal(M.toHex(b), '000fff'); assert.deepEqual([...M.fromHex('000fff')], [0, 15, 255]);
  assert.throws(() => M.fromHex('zz')); assert.throws(() => M.fromHex('abc'));
});

test('HW-001: create -> verify -> login derive the same PRF secret, never the user handle', async () => {
  const auth = fakeAuthenticator(); const bio = new M.Biometrics(auth, 'ext-id');
  const c = await bio.create(); assert.equal(c.credentialId, '01020304'); assert.equal(c.secret, undefined);
  const { secret } = await bio.verify(c); assert.match(secret, M.SECRET_HEX);
  assert.equal((await bio.login(c.credentialId)).secret, secret);
  assert.notEqual(secret, M.toHex((await auth.get({ publicKey: { challenge: new Uint8Array(32) } })).response.userHandle), 'secret is not the user handle');
  // a different authenticator key (someone else's device, or storage copied elsewhere) yields a different secret
  assert.notEqual((await new M.Biometrics(fakeAuthenticator({ key: 'other' })).login('01020304')).secret, secret);
});

test('create asks for a resident, user-verifying credential with PRF on the extension rp id', async () => {
  let seen; const bio = new M.Biometrics({ create: async (o) => { seen = o.publicKey; return { rawId: new Uint8Array([9]), getClientExtensionResults: () => ({ prf: { enabled: true } }) }; }, get: async () => null }, 'abc');
  await bio.create();
  assert.equal(seen.rp.id, 'abc'); assert.equal(seen.authenticatorSelection.residentKey, 'required'); assert.equal(seen.authenticatorSelection.userVerification, 'required'); assert.deepEqual(seen.extensions, { prf: {} });
});

test('HW-001: no PRF support means no biometrics (no user-handle fallback)', async () => {
  await assert.rejects(new M.Biometrics(fakeAuthenticator({ prfDisabledOnCreate: true })).create(), (e) => e.code === 'prf_unsupported');
  const a = new M.Biometrics(fakeAuthenticator({ noPrf: true })); const c = await a.create();
  await assert.rejects(a.verify(c), (e) => e.code === 'prf_unsupported');
  await assert.rejects(a.login(c.credentialId), (e) => e.code === 'prf_unsupported');
  const t = new M.Biometrics(fakeAuthenticator({ tamperChallenge: true })); const d = await t.create();
  await assert.rejects(t.verify(d), (e) => e.code === 'bad_challenge');
  await assert.rejects(t.login(d.credentialId), (e) => e.code === 'bad_challenge');
});

test('a new login aborts the previous pending prompt', async () => {
  const signals = []; const auth = fakeAuthenticator(); await auth.create({ publicKey: { user: { id: new Uint8Array(32) }, extensions: { prf: {} } } });
  const bio = new M.Biometrics({ create: async () => null, get: async (o) => { signals.push(o.signal); return auth.get(o); } });
  await bio.login('01'); await bio.login('01');
  assert.equal(signals[0].aborted, true); assert.equal(signals[1].aborted, false);
});

test('HW-001: legacy (user-handle) seals: dropped for password wallets, add-password only for password-less ones', async () => {
  const f = F(); f.session.data[M.KEYS.PASSWORD] = 'p'; f.session.data[M.KEYS.UNLOCK] = 'u';
  await M.enrollPasskey('cd'.repeat(32), 'aa', false);
  assert.equal((await M.passkeyMeta()).legacy, false);
  delete f.local.data[M.KEYS.PASSKEY].scheme; // simulate a seal written by an older build
  assert.equal((await M.passkeyMeta()).legacy, true);
  await assert.rejects(M.verifyPasskeySecret('cd'.repeat(32)), /upgraded/);
  f.session.data = {};
  await assert.rejects(M.unlockWithPasskey('cd'.repeat(32), async () => {}), /upgraded/);
  assert.equal(await M.passkeyMeta(), null, 'legacy seal removed'); assert.equal(f.session.data[M.KEYS.PASSWORD], undefined);
  // password-less legacy wallet: still unlockable once so the user can add a password
  f.session.data[M.KEYS.PASSWORD] = 'p'; f.session.data[M.KEYS.UNLOCK] = 'u';
  await M.enrollPasskey('cd'.repeat(32), 'aa', true); delete f.local.data[M.KEYS.PASSKEY].scheme; f.session.data = {};
  await M.unlockWithPasskey('cd'.repeat(32), async () => {}); assert.equal(f.session.data[M.KEYS.UNLOCK], 'u');
  await assert.rejects(M.verifyPasskeySecret('cd'.repeat(32)), /upgraded/);
  await M.verifyPasskeySecret('cd'.repeat(32), { allowLegacy: true });
  assert.equal(await M.dropLegacyPasskey(), false, 'never drops the only way into a password-less wallet');
});

test('isUserCancel treats dismissals as quiet, real failures as errors', () => {
  for (const n of ['NotAllowedError', 'AbortError', 'TimeoutError']) assert.equal(M.isUserCancel({ name: n }), true);
  assert.equal(M.isUserCancel(new Error('The operation either timed out or was not allowed')), true);
  assert.equal(M.isUserCancel(new Error('Missing userHandle')), false);
});

test('platform names and availability', async () => {
  assert.equal(M.detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)'), 'macos'); assert.equal(M.detectPlatform('Windows NT 10'), 'windows');
  globalThis.navigator ??= {}; Object.defineProperty(globalThis, 'navigator', { value: { credentials: {}, userAgent: '' }, configurable: true });
  assert.deepEqual(await M.biometricAvailability('Macintosh', { isUserVerifyingPlatformAuthenticatorAvailable: async () => true }), { available: true, name: 'Touch ID' });
  assert.deepEqual(await M.biometricAvailability('Windows', { isUserVerifyingPlatformAuthenticatorAvailable: async () => false }), { available: false, name: 'Biometrics' });
  assert.equal((await M.biometricAvailability('Windows', { isUserVerifyingPlatformAuthenticatorAvailable: async () => { throw new Error('x'); } })).available, false);
});

test('passkeyService: enroll seals session keys, unlock restores them, password is never stored', async () => {
  const f = F(); f.session.data[M.KEYS.PASSWORD] = 'pw-key'; f.session.data[M.KEYS.UNLOCK] = 'unlock-key';
  const secret = 'ab'.repeat(32);
  await M.enrollPasskey(secret, '01020304', false);
  assert.equal((await M.passkeyMeta()).credentialId, '01020304');
  const stored = JSON.stringify(f.local.data); assert.ok(!stored.includes('pw-key') && !stored.includes('unlock-key'), 'keys are encrypted at rest');
  f.session.data = {}; // lock
  let checked; await M.unlockWithPasskey(secret, async (k) => { checked = k; });
  assert.equal(checked, 'unlock-key'); assert.equal(f.session.data[M.KEYS.PASSWORD], 'pw-key'); assert.equal(f.session.data[M.KEYS.UNLOCK], 'unlock-key');
});

test('passkeyService: wrong secret, stale vault, locked enroll, removal', async () => {
  const f = F(); f.session.data[M.KEYS.PASSWORD] = 'p'; f.session.data[M.KEYS.UNLOCK] = 'u';
  await M.enrollPasskey('cd'.repeat(32), 'aa', true);
  f.session.data = {};
  await assert.rejects(M.unlockWithPasskey('ef'.repeat(32), async () => {}), /Biometric verification failed/);
  assert.equal(f.session.data[M.KEYS.PASSWORD], undefined, 'failed unlock leaves the wallet locked');
  await assert.rejects(M.unlockWithPasskey('cd'.repeat(32), async () => { throw new Error('bad'); }), /out of date/);
  assert.equal(f.session.data[M.KEYS.PASSWORD], undefined);
  await assert.rejects(M.unlockWithPasskey('nothex', async () => {}), /INVALID_PASSKEY_SECRET/);
  await assert.rejects(M.enrollPasskey('cd'.repeat(32), 'aa'), /FORBIDDEN_REQUEST/); // locked: nothing to seal
  f.session.data[M.KEYS.PASSWORD] = 'p'; f.session.data[M.KEYS.UNLOCK] = 'u';
  await assert.rejects(M.enrollPasskey('short', 'aa'), /INVALID_PASSKEY_SECRET/);
  await M.enrollPasskey('cd'.repeat(32), 'aa'); await M.removePasskey();
  assert.equal(await M.passkeyMeta(), null);
  await assert.rejects(M.unlockWithPasskey('cd'.repeat(32), async () => {}), /BIOMETRICS_NOT_SET_UP/);
});
