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

// A fake authenticator: remembers the user handle given at create and echoes it (plus the challenge) on get.
function fakeAuthenticator({ tamperChallenge = false, dropHandle = false, wrongHandle = false } = {}) {
  let userId, rawId = new Uint8Array([1, 2, 3, 4]);
  return {
    async create(o) { userId = new Uint8Array(o.publicKey.user.id); return { rawId, response: { getTransports: () => ['internal'] } }; },
    async get(o) {
      const ch = tamperChallenge ? new Uint8Array(32) : new Uint8Array(o.publicKey.challenge);
      const clientDataJSON = new TextEncoder().encode(JSON.stringify({ challenge: M.b64url(ch), type: 'webauthn.get' }));
      return { response: { clientDataJSON, userHandle: dropHandle ? null : wrongHandle ? new Uint8Array(32) : userId } };
    },
  };
}

test('toHex/fromHex round trip and reject bad hex', () => {
  const b = Uint8Array.from([0, 15, 255]);
  assert.equal(M.toHex(b), '000fff'); assert.deepEqual([...M.fromHex('000fff')], [0, 15, 255]);
  assert.throws(() => M.fromHex('zz')); assert.throws(() => M.fromHex('abc'));
});

test('create -> verify -> login return the same 32-byte secret', async () => {
  const bio = new M.Biometrics(fakeAuthenticator(), 'ext-id');
  const c = await bio.create();
  assert.match(c.secret, M.SECRET_HEX); assert.equal(c.credentialId, '01020304');
  assert.equal(await bio.verify(c), true);
  assert.equal((await bio.login(c.credentialId)).secret, c.secret);
});

test('create asks for a resident, user-verifying credential on the extension rp id', async () => {
  let seen; const bio = new M.Biometrics({ create: async (o) => { seen = o.publicKey; return { rawId: new Uint8Array([9]) }; }, get: async () => null }, 'abc');
  await bio.create();
  assert.equal(seen.rp.id, 'abc'); assert.equal(seen.authenticatorSelection.residentKey, 'required'); assert.equal(seen.user.id.length, 32);
});

test('verify/login reject a wrong secret, missing handle and a replayed challenge', async () => {
  let a = new M.Biometrics(fakeAuthenticator({ wrongHandle: true })); let c = await a.create();
  await assert.rejects(a.verify(c), (e) => e.code === 'secret_mismatch');
  a = new M.Biometrics(fakeAuthenticator({ dropHandle: true })); c = await a.create();
  await assert.rejects(a.verify(c), (e) => e.code === 'no_user_handle');
  await assert.rejects(a.login(c.credentialId), (e) => e.code === 'no_user_handle');
  a = new M.Biometrics(fakeAuthenticator({ tamperChallenge: true })); c = await a.create();
  await assert.rejects(a.verify(c), (e) => e.code === 'bad_challenge');
  await assert.rejects(a.login(c.credentialId), (e) => e.code === 'bad_challenge');
});

test('a new login aborts the previous pending prompt', async () => {
  const signals = []; const bio = new M.Biometrics({ create: async () => null, get: async (o) => { signals.push(o.signal); return { response: { clientDataJSON: new TextEncoder().encode(JSON.stringify({ challenge: M.b64url(new Uint8Array(o.publicKey.challenge)) })), userHandle: new Uint8Array(32) } }; } });
  await bio.login('01'); await bio.login('01');
  assert.equal(signals[0].aborted, true); assert.equal(signals[1].aborted, false);
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
