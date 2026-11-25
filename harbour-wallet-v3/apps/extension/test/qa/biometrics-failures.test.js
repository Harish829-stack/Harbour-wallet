// QA (resilience): WebAuthn unavailable, PRF unsupported, user cancels, wrong challenge, short PRF output. A fake credentials
// container stands in for the OS authenticator; Biometrics is the real class. TEST_PLAN: T-KEY-130.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const o = await build({ stdin: { contents: "export * from './src/core/passkey.ts'", resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const P = await import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64'));
const { Biometrics, BiometricsError, isUserCancel, biometricAvailability } = P;

const b64u = (b) => Buffer.from(b).toString('base64url');
const cred = (ext = {}) => ({ rawId: new Uint8Array([1, 2, 3]).buffer, response: { getTransports: () => ['internal'] }, getClientExtensionResults: () => ext });
const assertion = (challenge, prf, clientChallenge) => ({ response: { clientDataJSON: new TextEncoder().encode(JSON.stringify({ challenge: clientChallenge ?? b64u(challenge) })) }, getClientExtensionResults: () => (prf === undefined ? {} : { prf: { results: { first: prf } } }) });
const dom = (name) => Object.assign(new Error(name), { name });

test('T-KEY-130: enrol — PRF unsupported or no credential is a clear error; nothing is returned to seal under', async () => {
  const noPrf = new Biometrics({ create: async () => cred({}), get: async () => { throw new Error('unreachable'); } }, 'x');
  await assert.rejects(noPrf.create(), (e) => e instanceof BiometricsError && e.code === 'prf_unsupported' && /password/i.test(e.message));
  const prfFalse = new Biometrics({ create: async () => cred({ prf: { enabled: false } }), get: async () => null }, 'x');
  await assert.rejects(prfFalse.create(), (e) => e.code === 'prf_unsupported');
  const none = new Biometrics({ create: async () => null, get: async () => null }, 'x');
  await assert.rejects(none.create(), (e) => e.code === 'create_failed');
  for (const n of ['NotAllowedError', 'AbortError', 'TimeoutError']) {
    const c = new Biometrics({ create: async () => { throw dom(n); }, get: async () => null }, 'x');
    await assert.rejects(c.create(), (e) => e.name === n && isUserCancel(e), n); // the UI keys off isUserCancel to stay quiet
  }
});

test('T-KEY-130: unlock — cancel, missing PRF, short PRF, wrong challenge and empty result are all refused with no secret', async () => {
  const mk = (get) => new Biometrics({ create: async () => null, get }, 'x');
  await assert.rejects(mk(async () => { throw dom('NotAllowedError'); }).login('010203'), (e) => isUserCancel(e));
  await assert.rejects(mk(async () => null).login('010203'), (e) => e.code === 'no_result');
  await assert.rejects(mk(async (o) => assertion(o.publicKey.challenge, undefined)).login('010203'), (e) => e.code === 'prf_unsupported');
  await assert.rejects(mk(async (o) => assertion(o.publicKey.challenge, new Uint8Array(31))).login('010203'), (e) => e.code === 'prf_unsupported', '31-byte PRF');
  await assert.rejects(mk(async (o) => assertion(o.publicKey.challenge, new Uint8Array(32).fill(5), 'AAAA')).login('010203'), (e) => e.code === 'bad_challenge');
  const ok = await mk(async (o) => assertion(o.publicKey.challenge, new Uint8Array(32).fill(0xab))).login('010203');
  assert.match(ok.secret, /^[0-9a-f]{64}$/);
  assert.equal(ok.secret, 'ab'.repeat(32));
  assert.throws(() => P.fromHex('zz'), /Invalid hex/);
});

test('T-KEY-130: availability — no WebAuthn / platform authenticator absent or throwing reports unavailable, never throws', async () => {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
  assert.equal((await biometricAvailability(ua, undefined)).available, false);
  assert.equal((await biometricAvailability(ua, { isUserVerifyingPlatformAuthenticatorAvailable: async () => { throw new Error('boom'); } })).available, false);
});
