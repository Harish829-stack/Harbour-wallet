// QA: the REAL service worker (src/background/index.ts bundled whole) driven through chrome.runtime.onMessage, the way the popup talks
// to it. Fakes only at the browser boundary (harness.mjs); network is refused and recorded. TEST_PLAN: T-MSG-001..008, T-KEY-035
// (alarm + idle paths), T-KEY-108, T-KEY-120, T-EXT-003 (sender policy through the router).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { harness, PASSWORD, PHRASE_ABOUT, leaksSecret, allStrings } from './harness.mjs';

const H = await harness(`
  import './background/index';
  export { listEvents } from './background/kernel/events';
  export { isSecretKey, KEYS } from './core/storage';
  export { LOCK_ALARM } from './background/settingsService';
  export { findSecretField } from './core/uiSafe';
`);
const { M, F, core } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const OUTSIDERS = {
  contentScript: { id: 'test', url: 'https://evil.example/page', tab: { id: 7 }, frameId: 0 },
  otherExtension: { id: 'abcdefghijklmnopabcdefghijklmnop', url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/src/popup/index.html' },
  otherOwnPage: { id: 'test', url: 'chrome-extension://test/src/offscreen/clipboard.html' },
  spoofedPathQuery: { id: 'test', url: 'chrome-extension://test/src/popup/index.html.evil' },
  noUrl: { id: 'test' },
  webPage: { url: 'https://evil.example/' },
};
const listener = () => F.listeners['runtime.onMessage'][0];
const TIMEOUT_MS = 20_000;
async function send(msg, sender = INTERNAL) {
  let timer; const t = new Promise((r) => { timer = setTimeout(() => r({ __timeout: true }), TIMEOUT_MS); });
  try { return await Promise.race([listener()(msg, sender), t]); } finally { clearTimeout(timer); }
}
const messages = () => M.listEvents().filter((e) => e.startsWith('INTERNAL_')).map((e) => e.slice('INTERNAL_'.length));
// Messages that sign or broadcast (MSG inventory, Feature CH-05/DEFI-*/SA-*/UX-04). Read-only siblings (swapState, earnList, ...) are excluded.
const VALUE_MOVING = /^(swapApprove|swapSubmit|swapDustConvert|sendSubmit|ledgerSendSubmit|sendNftSubmit|earnSubmit|defiSubmit|nftTransferSubmit|perpsEnable|perpsDeposit|perpsWithdraw|perpsOrder|perpsCancel|perpsClose|predictionWrap|predictionOrder|approvalsRevoke|smartAccountApprove|testnetDefi\w*Submit)$/;
const KDF_MESSAGES = new Set(['unlock', 'revealAuth', 'passkeyAddPassword', 'createWallet', 'onboardingSecure', 'importComplete', 'qrImportAll']);
const snapshot = () => ({ l: structuredClone(F.local.data), s: structuredClone(F.session.data), i: new Map([...H.idb()].map(([k, v]) => [k, structuredClone(v)])) });
function restore(snap) { F.local.data = structuredClone(snap.l); F.session.data = structuredClone(snap.s); const db = H.idb(); db.clear(); for (const [k, v] of snap.i) db.set(k, structuredClone(v)); }
const sameState = (a, b) => JSON.stringify([a.l, a.s, [...a.i]]) === JSON.stringify([b.l, b.s, [...b.i]]);
// Capture the worker's own log lines (logger.ts → console.error/warn) to detect handler crashes behind sanitised responses.
const logs = []; const origErr = console.error, origWarn = console.warn;
console.error = (...a) => logs.push(a.join(' ')); console.warn = (...a) => logs.push(a.join(' '));
const unhandled = []; process.on('unhandledRejection', (e) => unhandled.push(String(e?.stack ?? e)));

let LOCKED, UNLOCKED, PASSWORD_KEY;
before(async () => {
  H.reset();
  const r = await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' });
  assert.equal(r.ok, true, JSON.stringify(r));
  await send({ type: 'addAccount' });
  UNLOCKED = snapshot(); PASSWORD_KEY = F.session.data['wallet:password'];
  await send({ type: 'lock' }); LOCKED = snapshot();
});
const SECRETS = () => [PHRASE_ABOUT, PASSWORD, PASSWORD_KEY];
function assertSafe(name, r, where) {
  assert.ok(r && typeof r === 'object', `${name} (${where}) answered ${JSON.stringify(r)}`);
  assert.ok(!r.__timeout, `${name} (${where}) did not answer within ${TIMEOUT_MS} ms`);
  assert.notEqual(r.error, 'SECRET_FIELD_BLOCKED', `${name} (${where}) tried to return ${r.field}`);
  assert.equal(M.findSecretField(r), null, `${name} (${where})`);
  assert.ok(!leaksSecret(r, [PHRASE_ABOUT], []) && !allStrings(r).some((s) => SECRETS().includes(s)), `${name} (${where}) leaks a secret`);
  if (typeof r.error === 'string') assert.doesNotMatch(r.error, /TypeError|ReferenceError|Cannot read prop|is not a function|at \S+:\d+:\d+|https?:\/\//, `${name} (${where}) error text`);
}

// ---------------------------------------------------------------- registry and boot

test('T-MSG-006: the live INTERNAL registry equals the inventory table (MSG-001..182) and nothing is registered PUBLIC', () => {
  const inv = [...readFileSync(new URL('../../../../qa/FEATURE_INVENTORY.md', import.meta.url), 'utf8').matchAll(/^\| MSG-\d+ \| `([^`]+)`/gm)].map((m) => m[1]).sort();
  assert.deepEqual(messages().sort(), inv);
  assert.deepEqual(M.listEvents().filter((e) => !e.startsWith('INTERNAL_')), []);
});

test('T-KEY-120: at boot the worker pins chrome.storage.session AND chrome.storage.local to TRUSTED_CONTEXTS', () => {
  assert.ok(F.accessLevels.some(([a, l]) => a === 'session' && l === 'TRUSTED_CONTEXTS'));
  assert.ok(F.accessLevels.some(([a, l]) => a === 'local' && l === 'TRUSTED_CONTEXTS'));
});

// ---------------------------------------------------------------- sender policy (T-MSG-001)

test('T-MSG-001: every INTERNAL message from a non-internal sender is UNAUTHORIZED and changes nothing', async () => {
  restore(UNLOCKED);
  for (const name of messages()) {
    for (const [who, sender] of Object.entries(OUTSIDERS)) {
      const before = snapshot(); const fetches = F.fetches.length;
      const r = await send({ type: name, password: PASSWORD, mnemonic: PHRASE_ABOUT, walletId: 'x' }, sender);
      assert.deepEqual(r, { ok: false, error: 'UNAUTHORIZED' }, `${name} from ${who}`);
      assert.ok(sameState(before, snapshot()), `${name} from ${who} changed storage`);
      assert.equal(F.fetches.length, fetches, `${name} from ${who} made a network call`);
    }
  }
  for (const raw of [null, 'lock', 42, [], { type: 7 }, { notype: true }]) assert.deepEqual(await send(raw), { ok: false, error: 'INVALID_REQUEST' });
  assert.deepEqual(await send({ type: 'noSuchMessage' }), { error: 'unknown_message' });
  assert.deepEqual(await send({ type: '__proto__' }), { error: 'unknown_message' });
  assert.deepEqual(await send({ type: 'constructor' }), { error: 'unknown_message' });
});

// ---------------------------------------------------------------- empty bodies, locked and unlocked (T-MSG-002, T-KEY-108)

for (const [label, pick] of [['locked', () => LOCKED], ['unlocked', () => UNLOCKED]]) {
  test(`T-MSG-002 / T-KEY-108: every message with an empty body (${label}) answers, stays uiSafe and leaks no secret`, async () => {
    const crashes = [];
    for (const name of messages()) {
      restore(pick()); const mark = logs.length;
      const r = await send({ type: name });
      assertSafe(name, r, label);
      const crash = logs.slice(mark).find((l) => /handler \S+ failed: (TypeError|ReferenceError|RangeError)/.test(l));
      if (crash) crashes.push(`${name}: ${crash.replace(/^\[harbour\] /, '')}`);
    }
    globalThis[`__crashes_${label}`] = crashes;
    assert.deepEqual(unhandled, []);
  });
}

test('T-MSG-008: handlers answer missing/invalid fields with a specific error, not an internal crash', async (t) => {
  const crashes = [...new Set([...(globalThis.__crashes_locked ?? []), ...(globalThis.__crashes_unlocked ?? [])])];
  restore(UNLOCKED);
  const invalid = { walletId: 'nope', chainId: 'no-such-chain', index: -1, amount: '-5', to: 'not-an-address', asset: { id: 1 }, id: {}, origin: 42, address: [] };
  for (const name of messages()) {
    restore(UNLOCKED); const mark = logs.length;
    const r = await send({ type: name, ...invalid });
    assertSafe(name, r, 'invalid');
    const crash = logs.slice(mark).find((l) => /handler \S+ failed: (TypeError|ReferenceError|RangeError)/.test(l));
    if (crash) crashes.push(`${name}(invalid): ${crash.replace(/^\[harbour\] /, '')}`);
  }
  t.diagnostic(`handlers that crash on missing/invalid input: ${crashes.length}`);
  assert.deepEqual(crashes, [], 'handlers crashed on missing/invalid input (caught by the router, shown to the user as a generic error)');
});

// ---------------------------------------------------------------- value-moving while locked (T-MSG-004)

test('T-MSG-004: value-moving messages refuse while locked and broadcast nothing', async () => {
  const moving = messages().filter((n) => VALUE_MOVING.test(n));
  assert.ok(moving.length >= 19, `found ${moving.length}: ${moving}`);
  for (const name of moving) {
    restore(LOCKED); const fetches = F.fetches.length;
    let posted = []; F.fetchImpl = async (url, init) => { posted.push(`${url} ${init?.body ?? ''}`); throw new TypeError('NETWORK_DISABLED_IN_TESTS'); };
    const r = await send({ type: name, chainId: 'ethereum', to: '0x000000000000000000000000000000000000dEaD', amount: '0.01', value: '1', asset: 'ethereum', confirm: true, id: 'x', quoteId: 'x' });
    F.fetchImpl = null;
    assertSafe(name, r, 'locked');
    const nothingDone = r.ok === true && Array.isArray(r.results) && r.results.length === 0; // e.g. swapDustConvert with no dust selected
    assert.ok(r.ok !== true || nothingDone, `${name} succeeded while locked: ${JSON.stringify(r).slice(0, 200)}`);
    assert.doesNotMatch(JSON.stringify(r), /0x[0-9a-fA-F]{64}/, `${name} returned a transaction hash while locked`);
    assert.ok(!posted.some((p) => /eth_sendRawTransaction|sendTransaction|\/v1\/tx\b|broadcast/i.test(p)), `${name} attempted a broadcast while locked: ${posted.join(' | ')}`);
    void fetches;
  }
});

// ---------------------------------------------------------------- grant-gated messages (T-MSG-007)

test('T-MSG-007: grant-gated messages refuse without a fresh grant (unlocked)', async () => {
  restore(UNLOCKED);
  const id = (await send({ type: 'listWallets' })).activeWalletId;
  const gated = [['backupBegin', { walletId: id }], ['revealPrivateKey', { walletId: id }], ['copyPrivateKey', { walletId: id }], ['addWallet', { mnemonic: 'legal winner thank year wave sausage worth useful legal winner thank yellow' }],
    ['removeWallet', { walletId: id }], ['passkeyEnroll', { secret: 'a'.repeat(64), credentialId: 'aa' }], ['passkeyDisable', {}], ['importInitiate', { secret: 'legal winner thank year wave sausage worth useful legal winner thank yellow' }]];
  for (const [name, body] of gated) {
    restore(UNLOCKED); delete F.session.data['wallet:manageGrant'];
    const before = snapshot();
    const r = await send({ type: name, ...body });
    assert.ok(r.error === 'AUTH_REQUIRED' || (name === 'removeWallet' && /only wallet/.test(r.error)) || (name === 'passkeyDisable' && r.error === 'AUTH_REQUIRED'), `${name}: ${JSON.stringify(r)}`);
    assert.ok(sameState(before, snapshot()) || name === 'backupBegin' || name === 'revealPrivateKey', `${name} changed storage`);
  }
  // setSettings that weakens security also needs the manage grant
  restore(UNLOCKED); delete F.session.data['wallet:manageGrant'];
  for (const settings of [{ lockTimeInMinutes: 60 }, { developerSettings: { isEthSignEnabled: true } }]) {
    const weaken = await send({ type: 'setSettings', patch: settings });
    assert.equal(weaken.error, 'AUTH_REQUIRED', JSON.stringify(weaken));
  }
  assert.equal((await send({ type: 'setSettings', patch: { lockTimeInMinutes: 5 } })).ok, true, 'strengthening needs no grant');
});

// ---------------------------------------------------------------- property fuzz (T-MSG-003)

test('T-MSG-003: random bodies for every message never leak secrets, never write a secret key to chrome.storage.local, never broadcast', async () => {
  const runs = Number(process.env.HB_FUZZ_RUNS ?? 50); // CI (test:qa:ci) runs 200
  const val = fc.oneof(fc.string({ maxLength: 40 }), fc.integer(), fc.double(), fc.boolean(), fc.constant(null), fc.constant(undefined), fc.array(fc.string(), { maxLength: 3 }),
    fc.constantFrom('__proto__', 'constructor', 'x'.repeat(300_000), PHRASE_ABOUT, '0x' + '46'.repeat(32), 'ethereum', 'solana', 'bitcoin', '-1', 'NaN'), fc.dictionary(fc.constantFrom('__proto__', 'a', 'type', 'password'), fc.string(), { maxKeys: 3 }));
  const keys = fc.constantFrom('walletId', 'chainId', 'amount', 'to', 'password', 'mnemonic', 'index', 'name', 'id', 'origin', 'asset', 'secret', 'settings', 'params', 'address', 'pendingId', 'sessionId', 'picked', 'code', 'stageId', 'quoteId', 'token', 'tx');
  const body = fc.dictionary(keys, val, { maxKeys: 6 });
  for (const name of messages()) {
    const n = KDF_MESSAGES.has(name) ? 3 : runs;
    await fc.assert(fc.asyncProperty(body, fc.boolean(), async (b, unlocked) => {
      restore(unlocked ? UNLOCKED : LOCKED);
      let posted = []; F.fetchImpl = async (url, init) => { posted.push(`${url} ${init?.body ?? ''}`); throw new TypeError('NETWORK_DISABLED_IN_TESTS'); };
      try {
        const r = await send({ ...b, type: name });
        assertSafe(name, r, `fuzz ${unlocked ? 'unlocked' : 'locked'}`);
        for (const k of Object.keys(F.local.data)) assert.ok(!M.isSecretKey(k), `${name} wrote secret key ${k} to chrome.storage.local`);
        assert.ok(!posted.some((p) => /eth_sendRawTransaction|\/v1\/tx\b/.test(p)), `${name} broadcast`);
      } finally { F.fetchImpl = null; }
    }), { numRuns: n, seed: 1234 });
  }
  assert.deepEqual(unhandled, []);
});

// ---------------------------------------------------------------- auto-lock paths (T-KEY-035)

test('T-KEY-035: the auto-lock alarm and an OS screen lock both drop the session keys and every grant', async () => {
  for (const fire of [() => F.listeners['alarms.onAlarm'].forEach((f) => f({ name: M.LOCK_ALARM })), () => F.listeners['idle.onStateChanged'].forEach((f) => f('locked'))]) {
    restore(UNLOCKED);
    for (const k of ['wallet:revealGrant', 'wallet:addWalletGrant', 'wallet:manageGrant']) F.session.data[k] = { exp: Date.now() + 60_000, method: 'password' };
    fire(); await new Promise((r) => setTimeout(r, 50));
    for (const k of ['wallet:password', 'wallet:unlock', 'wallet:revealGrant', 'wallet:addWalletGrant', 'wallet:manageGrant']) assert.equal(F.session.data[k], undefined, k);
    assert.equal((await send({ type: 'status' })).unlocked, false);
  }
  restore(UNLOCKED);
  F.listeners['idle.onStateChanged'].forEach((f) => f('idle')); await new Promise((r) => setTimeout(r, 20));
  assert.ok(F.session.data['wallet:unlock'], '"idle" (not locked) keeps the session');
  F.listeners['alarms.onAlarm'].forEach((f) => f({ name: 'something-else' })); await new Promise((r) => setTimeout(r, 20));
  assert.ok(F.session.data['wallet:unlock'], 'other alarms do not lock');
});

test('teardown: restore console', () => { console.error = origErr; console.warn = origWarn; void core; });
