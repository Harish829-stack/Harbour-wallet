// QA (mutation hardening): examples that pin the behaviour Stryker found unpinned in core/errors.ts and core/passkey.ts
// (every alternative of the classifier regexes, status mapping, WebAuthn request parameters, platform names, buffer zeroing).
// TEST_PLAN: T-KEY-111 / T-KEY-130 / T-KEY-083 (mutation-score gate, Phase 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const load = async (f) => { const o = await build({ stdin: { contents: `export * from './src/core/${f}.ts'`, resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64')); };
const E = await load('errors'); const P = await load('passkey');

// ---------------------------------------------------------------- errors.ts
const GENERIC = 'Something went wrong. Please try again.';
const NETWORK = 'The network is unreachable or busy right now. Please check your connection and try again.';
test('errors: HTTP status → one specific sentence each (status text forms, boundaries)', () => {
  const t = (s) => E.userText(s);
  const provider = t('HTTP 401'); assert.equal(t('HTTP 403'), provider); assert.match(provider, /data provider/);
  const nf = t('HTTP 404'); assert.equal(t('HTTP 410'), nf); assert.match(nf, /isn’t available/);
  const slow = t('HTTP 408'); assert.equal(t('HTTP 504'), slow); assert.match(slow, /too long/);
  assert.match(t('HTTP 429'), /Too many requests/);
  const svc = t('HTTP 500'); assert.equal(t('HTTP 503'), svc); assert.equal(t('HTTP 599'), svc); assert.match(svc, /temporarily unavailable/);
  const other = t('HTTP 418'); assert.match(other, /couldn’t complete/); assert.equal(t('HTTP 499'), other); assert.notEqual(t('HTTP 400'), svc);
  assert.equal(new Set([provider, nf, slow, t('HTTP 429'), svc, other]).size, 6, 'six distinct sentences');
  assert.equal(t('status code: 429'), t('HTTP 429')); assert.equal(t('status 404'), nf); assert.equal(t('request failed (503)'), svc);
  assert.equal(t('HTTP error 404'), nf); assert.equal(t('http 500'), svc);
  assert.equal(t('HTTP error'), svc); assert.equal(t('http ERROR'), svc);
  assert.equal(t('HTTP 4040'), E.userText('HTTP 4040'), 'four digits are not a status');
  assert.notEqual(t('HTTP 40'), nf);
});
test('errors: raw text classification — codes pass, network and technical text are replaced, short sentences kept', () => {
  assert.equal(E.userText('LOCKED'), 'LOCKED'); assert.equal(E.userText('TOO_MANY_ATTEMPTS'), 'TOO_MANY_ATTEMPTS');
  for (const m of ['fetch failed', 'Failed to fetch', 'a network error', 'a network  error'.replace('  ', ''), 'network request failed', 'request timeout', 'it timed out', 'aborted by user', 'rate limit hit', 'hit the rate-limit now', 'circuit open for x', 'failed to load module', 'you are offline', 'ECONNRESET happened', 'ENOTFOUND host', 'socket hang up', 'all RPC endpoints failed', 'no nodes available', 'no provider available', 'the load failed'])
    assert.equal(E.userText(m), NETWORK, m);
  for (const m of ['a TypeError occurred', 'SyntaxError here', 'ReferenceError here', 'RangeError here', 'Unexpected token x', 'Unexpected end of input', 'bad JSON body', 'value was undefined', 'it was null here', 'x is not a function', 'cannot read properties', 'Failed to execute fetch', 'see http://x.y', 'at https://x.y', 'hash 0x0123456789abcdef0123 leaked', 'at file.js:1:2', 'invalid response from x', 'stack trace follows', 'CORS blocked', '[object Object] seen'])
    assert.equal(E.userText(m), GENERIC, m);
  assert.equal(E.userText('failed at foo (file.js:1:2)'), GENERIC, 'OBS-12 (fixed): the V8 frame form with a function name is recognised');
  assert.equal(E.userText('boom at Object.run (chrome-extension://abc/x.js:10:5)'), GENERIC);
  assert.equal(E.userText('Insufficient funds for gas'), 'Insufficient funds for gas', 'short human sentences are kept');
  assert.equal(E.userText('x '.repeat(110).trim()), 'x '.repeat(110).trim(), '219 chars kept'); assert.equal(E.userText('word '.repeat(60)), GENERIC, 'over 220 chars replaced');
  assert.equal(E.userText(''), GENERIC); assert.equal(E.userText('   '), GENERIC); assert.equal(E.userText(undefined), GENERIC); assert.equal(E.userText(42), GENERIC); assert.equal(E.userText(null), GENERIC);
  assert.equal(E.userText(new Error('LOCKED')), 'LOCKED'); assert.equal(E.userText(new Error('fetch failed')), NETWORK); assert.equal(E.userText({ message: 'x y' }), GENERIC);
  assert.equal(E.userText('  Some words here  '), 'Some words here', 'trimmed');
  assert.equal(E.friendlyMessage('LOCKED'), GENERIC, 'a bare code is never shown'); assert.equal(E.friendlyMessage('Nice words'), 'Nice words'); assert.equal(E.friendlyMessage(new Error('fetch failed')), NETWORK);
  assert.ok(GENERIC.length > 0 && NETWORK.length > 0);
});
test('errors: sanitizeResult touches only string error fields, recursively through arrays, up to depth 5', () => {
  const raw = 'fetch failed';
  assert.equal(E.sanitizeResult({ error: raw }).error, NETWORK);
  assert.equal(E.sanitizeResult({ a: { error: raw } }).a.error, NETWORK);
  assert.equal(E.sanitizeResult([{ error: raw }])[0].error, NETWORK);
  assert.equal(E.sanitizeResult({ errors: [raw] }).errors[0], raw, 'only fields literally named error');
  assert.equal(E.sanitizeResult({ other: raw }).other, raw); assert.equal(E.sanitizeResult({ error: 3 }).error, 3); assert.equal(E.sanitizeResult({ error: null }).error, null);
  let o = { error: raw }; for (let i = 0; i < 5; i++) o = { x: o }; let q = E.sanitizeResult(o); for (let i = 0; i < 5; i++) q = q.x; assert.equal(q.error, NETWORK, 'depth 5 is rewritten');
  const arr = [1, 'a', null, [raw]]; assert.deepEqual(E.sanitizeResult(arr), arr);
});

// ---------------------------------------------------------------- passkey.ts
const fakeCreds = () => { const calls = { create: [], get: [] }; return { calls, creds: {
  create: async (o) => { calls.create.push(o); return { rawId: new Uint8Array([0xde, 0xad]).buffer, response: { getTransports: () => ['internal'] }, getClientExtensionResults: () => ({ prf: { enabled: true } }) }; },
  get: async (o) => { calls.get.push(o); const c = o.publicKey.challenge; return { response: { clientDataJSON: new TextEncoder().encode(JSON.stringify({ challenge: Buffer.from(c).toString('base64url') })), userHandle: new Uint8Array([1, 2, 3]) }, getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(32).fill(7) } } }) }; } } }; };
test('passkey: the WebAuthn registration asks for a resident, user-verified PLATFORM credential with PRF', async () => {
  const { creds, calls } = fakeCreds(); const b = new P.Biometrics(creds, 'abc.extension');
  const r = await b.create(); assert.equal(r.credentialId, 'dead');
  const pk = calls.create[0].publicKey;
  assert.equal(pk.challenge.length, 32); assert.equal(pk.rp.id, 'abc.extension'); assert.equal(pk.rp.name, 'Harbour-Wallet-Extension');
  assert.equal(pk.user.id.length, 32); assert.equal(pk.user.name, 'Harbour-Wallet-Extension'); assert.equal(pk.user.displayName, 'Harbour Wallet');
  assert.deepEqual(pk.pubKeyCredParams, [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }, { type: 'public-key', alg: -8 }]);
  assert.deepEqual(pk.authenticatorSelection, { authenticatorAttachment: 'platform', requireResidentKey: true, residentKey: 'required', userVerification: 'required' });
  assert.deepEqual(pk.hints, ['client-device']); assert.deepEqual(pk.extensions, { prf: {} }); assert.equal(pk.timeout, 60_000);
  await b.create(); assert.notDeepEqual(calls.create[0].publicKey.challenge, calls.create[1].publicKey.challenge, 'fresh challenge each time');
  assert.notDeepEqual(calls.create[0].publicKey.user.id, calls.create[1].publicKey.user.id, 'fresh user id each time');
});
test('passkey: login/verify assertion requests are user-verified, bound to the credential, evaluate PRF with the pinned salt; the PRF buffer is zeroed after use', async () => {
  const { creds, calls } = fakeCreds(); const b = new P.Biometrics(creds, 'x');
  const out = await b.login('dead'); assert.equal(out.secret, '07'.repeat(32));
  const o = calls.get[0].publicKey;
  assert.equal(o.userVerification, 'required'); assert.equal(o.timeout, 60_000); assert.equal(o.challenge.length, 32);
  assert.deepEqual(o.allowCredentials.map((c) => [c.type, Buffer.from(c.id).toString('hex'), c.transports]), [['public-key', 'dead', undefined]]);
  assert.deepEqual(o.extensions, { prf: { eval: { first: P.PRF_SALT } } }); assert.equal(P.PRF_SALT.length, 32);
  assert.equal(new TextDecoder().decode(P.PRF_SALT), 'harbour-wallet/biometric-unlock/prf-v1'.slice(0, 32)); assert.ok(calls.get[0].signal instanceof AbortSignal);
  const v = await b.verify({ credential: { rawId: new Uint8Array([9]).buffer, response: { getTransports: () => ['internal'] } } });
  assert.equal(v.secret, '07'.repeat(32)); assert.deepEqual(calls.get[1].publicKey.allowCredentials[0].transports, ['internal']); assert.equal(calls.get[1].signal, undefined);
  // zeroing: hand back a typed array we keep a reference to
  const buf = new Uint8Array(32).fill(0x55); const c2 = { create: async () => null, get: async (x) => ({ response: { clientDataJSON: new TextEncoder().encode(JSON.stringify({ challenge: Buffer.from(x.publicKey.challenge).toString('base64url') })) }, getClientExtensionResults: () => ({ prf: { results: { first: buf } } }) }) };
  assert.equal((await new P.Biometrics(c2, 'x').login('01')).secret, '55'.repeat(32)); assert.deepEqual([...buf], new Array(32).fill(0), 'PRF output zeroed after hex conversion');
  // a second login aborts the first
  const slow = new P.Biometrics({ create: async () => null, get: (x) => new Promise((_, rej) => x.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))) }, 'x');
  const first = slow.login('01'); first.catch(() => {}); await new P.Biometrics(creds, 'x').login('02'); await assert.rejects(first, (e) => e.name === 'AbortError');
});
test('passkey: PRF output shapes — ArrayBuffer and views accepted, wrong sizes refused; legacy user-handle path', async () => {
  const mk = (first) => new P.Biometrics({ create: async () => null, get: async (x) => ({ response: { clientDataJSON: new TextEncoder().encode(JSON.stringify({ challenge: Buffer.from(x.publicKey.challenge).toString('base64url') })) }, getClientExtensionResults: () => ({ prf: { results: { first } } }) }) }, 'x');
  assert.equal((await mk(new Uint8Array(32).fill(1).buffer).login('01')).secret, '01'.repeat(32));
  assert.equal((await mk(new DataView(new Uint8Array(32).fill(2).buffer)).login('01')).secret, '02'.repeat(32), 'DataView-like: reads .buffer');
  await assert.rejects(mk(new Uint8Array(33)).login('01'), (e) => e.code === 'prf_unsupported'); await assert.rejects(mk(null).login('01'), (e) => e.code === 'prf_unsupported');
  const { creds, calls } = fakeCreds(); const lg = await new P.Biometrics(creds, 'x').legacyLogin('0a0b'); assert.equal(lg.secret, '010203');
  assert.equal(calls.get[0].publicKey.userVerification, 'required'); assert.equal(Buffer.from(calls.get[0].publicKey.allowCredentials[0].id).toString('hex'), '0a0b'); assert.equal(calls.get[0].publicKey.extensions, undefined);
  await assert.rejects(new P.Biometrics({ get: async () => ({ response: {} }) }, 'x').legacyLogin('01'), (e) => e.code === 'no_user_handle');
  await assert.rejects(new P.Biometrics({ get: async () => ({ response: { userHandle: new Uint8Array([1]), clientDataJSON: new TextEncoder().encode('{"challenge":"zzz"}') } }) }, 'x').legacyLogin('01'), (e) => e.code === 'bad_challenge');
  await assert.rejects(new P.Biometrics({ get: async () => ({ response: { userHandle: new Uint8Array([1]), clientDataJSON: new TextEncoder().encode('not json') } }) }, 'x').legacyLogin('01'), (e) => e.code === 'bad_challenge');
  const bad = new P.Biometrics({ create: async () => null, get: async () => ({ response: { clientDataJSON: new TextEncoder().encode('not json') }, getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(32) } } }) }) }, 'x');
  await assert.rejects(bad.login('01'), (e) => e.code === 'bad_challenge');
});
test('passkey: helpers, cancel detection, platform names and availability', async () => {
  assert.equal(P.toHex(new Uint8Array([0, 15, 255])), '000fff'); assert.equal(P.toHex(new Uint8Array([1, 2]).buffer), '0102'); assert.equal(P.toHex(new Uint8Array(0)), '');
  assert.deepEqual([...P.fromHex('000fFF')], [0, 15, 255]); assert.deepEqual([...P.fromHex('')], []);
  for (const bad of ['0', 'abc', 'zz', '0g', '12 34', '0x12']) assert.throws(() => P.fromHex(bad), /Invalid hex/, bad);
  assert.equal(P.b64url(new Uint8Array([251, 255, 254])), '-__-'); assert.equal(P.b64url(new Uint8Array([1])), 'AQ');
  assert.ok(P.SECRET_HEX.test('a'.repeat(64))); for (const s of ['a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), 'xx' + 'a'.repeat(64), 'a'.repeat(64) + 'x']) assert.ok(!P.SECRET_HEX.test(s), s);
  const e = new P.BiometricsError('m', 'c'); assert.equal(e.message, 'm'); assert.equal(e.code, 'c'); assert.equal(e.name, 'BiometricsError'); assert.ok(e instanceof Error);
  for (const n of ['AbortError', 'NotAllowedError', 'TimeoutError']) assert.equal(P.isUserCancel({ name: n, message: 'x' }), true, n);
  for (const m of ['User cancelled', 'ABORTED', 'it timeout', 'Timed Out', 'Not allowed here', 'cancel']) assert.equal(P.isUserCancel(new Error(m)), true, m);
  for (const x of [new Error('boom'), { name: 'TypeError', message: 'bad' }, undefined, null, {}, 'string']) assert.equal(P.isUserCancel(x), false, String(x));
  const ua = { mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', mac2: 'x MAC OS x', win: 'Mozilla/5.0 (Windows NT 10.0)', lin: 'Mozilla/5.0 (X11; Linux x86_64)', other: 'curl/8' };
  assert.deepEqual([P.detectPlatform(ua.mac), P.detectPlatform(ua.mac2), P.detectPlatform(ua.win), P.detectPlatform(ua.lin), P.detectPlatform(ua.other), P.detectPlatform('')], ['macos', 'macos', 'windows', 'linux', 'unknown', 'unknown']);
  assert.deepEqual(P.BIOMETRIC_NAME, { macos: 'Touch ID', windows: 'Windows Hello', linux: 'Fingerprint', unknown: 'Passkey' });
  const yes = { isUserVerifyingPlatformAuthenticatorAvailable: async () => true }, no = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false };
  const nav = globalThis.navigator; Object.defineProperty(globalThis, 'navigator', { value: { credentials: {}, userAgent: '' }, configurable: true });
  try {
    assert.deepEqual(await P.biometricAvailability(ua.mac, yes), { available: true, name: 'Touch ID' }); assert.deepEqual(await P.biometricAvailability(ua.win, yes), { available: true, name: 'Windows Hello' });
    assert.deepEqual(await P.biometricAvailability(ua.mac, no), { available: false, name: 'Biometrics' });
    assert.deepEqual(await P.biometricAvailability(ua.lin, {}), { available: false, name: 'Biometrics' }, 'no capability probe = unavailable');
    assert.deepEqual(await P.biometricAvailability(ua.mac, undefined), { available: false, name: 'Touch ID' }, 'no WebAuthn: unavailable, but the platform name is kept');
    Object.defineProperty(globalThis, 'navigator', { value: { userAgent: '' }, configurable: true }); assert.equal((await P.biometricAvailability(ua.mac, yes)).available, false, 'no navigator.credentials');
  } finally { Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true }); }
});
