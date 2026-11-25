// QA: vault lifecycle, wallet management and re-auth grants through the REAL worker handlers (wallet-core WASM, real crypto with cheap
// Argon2 cost, fake chrome.storage + transactional IndexedDB). TEST_PLAN §KEY: T-KEY-001..003, 016, 019, 022, 024, 025, 028..030, 032,
// 034, 035, 037, 048, 049, 051..059, 075, 077, 078, 082, 086, 098..103, 120 (partial), 123, 124, 129, 131, 134..139, 142, 144, 147.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { harness, PASSWORD, PHRASE_ABOUT, PHRASE_LEGAL, CHEAP_ARGON2, allStrings } from './harness.mjs';
import { fakeClock } from './known-bug.mjs';
import commonPasswords from '../../src/core/commonPasswords.json' with { type: 'json' };

const H = await harness(`
  export { handlers as walletH } from './background/modules/wallet';
  export { handlers as onboardingH } from './background/handlers/onboardingExtra';
  export { VaultService } from './core/vaultService';
  export { WalletService } from './core/walletService';
  export { validatePassword } from './core/passwordPolicy';
  export * as passworder from './core/passworder';
  export { rekeyKeystore, rekeyBlob } from './core/keyMigration';
  export { grantReauth, consumeReauth, hasReauth, purposeOf, clearReauth, ALL_GRANT_KEYS } from './background/reauth';
  export { enrollPasskey } from './core/passkeyService';
  export { local, session, KEYS, isSecretKey, VAULT_REV, migrateSecretsToSecureStore } from './core/storage';
  export { secureStore } from './core/secureStore';
  export { findSecretField } from './core/uiSafe';
  export { PasswordService, DEFAULT_ITERATIONS } from './core/passwordService';
`);
const { M, core, F } = H;
const W = M.walletH, O = M.onboardingH;
const PHRASE_C = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const S = (c) => c.repeat(64);

beforeEach(() => H.reset());
async function fresh({ keepGrant = false } = {}) {
  const c = H.ctx();
  const r = await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' }, c);
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!keepGrant) await M.session.remove(M.KEYS.MANAGE);
  return c;
}
const grant = (c, purpose, extra = {}) => W.revealAuth({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose, ...extra }, c);
const state = (c) => c.vault.getState();
async function addSecond(c, phrase = PHRASE_LEGAL) {
  assert.equal((await grant(c, 'addWallet')).ok, true);
  const r = await W.addWallet({ type: 'addWallet', mnemonic: phrase }, c); assert.equal(r.ok, true, JSON.stringify(r)); return r;
}
const snapshot = () => JSON.stringify({ l: F.local.data, s: F.session.data, i: [...H.idb().entries()] });

// ---------------------------------------------------------------- password policy (KEY-01)

test('T-KEY-001: validatePassword length boundaries and messages', () => {
  assert.deepEqual(M.validatePassword(''), { valid: false });
  assert.deepEqual(M.validatePassword('a1B!c2D'), { valid: false, error: 'Min 8 characters' });
  assert.deepEqual(M.validatePassword('a1B!c2D@'), { valid: true });
  assert.deepEqual(M.validatePassword('x'.repeat(63) + 'Y'), { valid: true });
  assert.deepEqual(M.validatePassword('x'.repeat(64) + 'Y'), { valid: false, error: 'Password is too long' });
});

test('T-KEY-002: common passwords (first, last, 20 sampled) are refused with the "too common" message', () => {
  const list = commonPasswords.filter((p) => p.length >= 8 && p.length <= 64);
  assert.ok(list.length > 0);
  const sample = [list[0], list.at(-1), ...Array.from({ length: 20 }, (_, i) => list[Math.floor((i * 7919) % list.length)])];
  for (const p of sample) assert.match(M.validatePassword(p).error ?? '', /too common/, p);
});

test('T-KEY-003: validatePassword never throws and valid ⇔ 8 ≤ length ≤ 64 ∧ not common (property, astral chars included)', () => {
  const common = new Set(commonPasswords);
  fc.assert(fc.property(fc.oneof(fc.string({ maxLength: 80 }), fc.fullUnicodeString({ maxLength: 80 })), (s) => {
    const r = M.validatePassword(s);
    return r.valid === (s.length >= 8 && s.length <= 64 && !common.has(s));
  }), { numRuns: 500, seed: 3 });
});

test('T-KEY-016: passworder.decrypt on malformed envelopes throws without echoing the secret', async () => {
  const secret = S('a');
  for (const blob of ['not json', '{}', JSON.stringify({ v: 3, data: 'AA==', iv: 'AA==', salt: 'AA==' }), '', 'null']) {
    let err; try { await M.passworder.decrypt(secret, blob); } catch (e) { err = e; }
    assert.ok(err, `refused: ${blob}`);
    assert.ok(!String(err.message).includes(secret) && !String(err.stack).includes(secret));
  }
});

// ---------------------------------------------------------------- create / unlock / throttle (KEY-02, KEY-06)

test('T-KEY-019 / T-KEY-052: two concurrent vault creations yield one vault; the loser is refused; the winner password opens it', async () => {
  const c1 = H.ctx(), c2 = H.ctx();
  const [a, b] = await Promise.all([
    W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT }, c1),
    W.createWallet({ type: 'createWallet', password: 'Other-horse-7-staple', mnemonic: PHRASE_LEGAL }, c2)]);
  assert.equal([a, b].filter((r) => r.ok).length, 1, JSON.stringify([a, b]));
  assert.match((a.ok ? b : a).error, /^(WALLET_CREATION_IN_PROGRESS|FORBIDDEN_REQUEST)$/);
  await W.lock({}, c1);
  const winner = a.ok ? PASSWORD : 'Other-horse-7-staple';
  const st = (await W.unlock({ password: winner }, H.ctx())).state;
  assert.equal(Object.keys(st.wallets).length, 1);
  // vault.create on an existing vault is refused at the service level too (ASM-10)
  await assert.rejects(new M.VaultService(core, CHEAP_ARGON2).create('Another-pass-123'), /FORBIDDEN_REQUEST/);
});

test('T-KEY-022: exponential lockout 5 s → 300 s cap; the right password is refused during lockout and resets after it', async () => {
  const c = await fresh(); await W.lock({}, c);
  const clk = fakeClock();
  try {
    for (let i = 0; i < 5; i++) assert.equal((await W.unlock({ password: 'Wrong-pass-' + i }, c)).error, 'Incorrect password');
    assert.equal((await M.local.get(M.KEYS.THROTTLE)).lockedUntil, 0, 'five free attempts');
    const expected = [5, 10, 20, 40, 80, 160, 300, 300].map((s) => s * 1000);
    for (const d of expected) {
      assert.equal((await W.unlock({ password: 'Wrong-pass-x' }, c)).error, 'Incorrect password');
      const t = await M.local.get(M.KEYS.THROTTLE);
      assert.equal(t.lockedUntil - clk.now, d);
      assert.equal((await W.unlock({ password: PASSWORD }, c)).error, 'TOO_MANY_ATTEMPTS', 'correct password refused during lockout');
      clk.advance(d - 1);
      assert.equal((await W.unlock({ password: PASSWORD }, c)).error, 'TOO_MANY_ATTEMPTS', '1 ms before expiry still locked');
      clk.advance(1);
    }
    assert.equal((await W.unlock({ password: PASSWORD }, c)).ok, true, 'after expiry the right password unlocks');
    assert.deepEqual(await M.local.get(M.KEYS.THROTTLE), { failedAttempts: 0, lockedUntil: 0 });
  } finally { clk.restore(); }
});

test('T-KEY-024: unlock without a vault → VAULT_IS_EMPTY; checkPassword without a vault → VAULT_IS_EMPTY', async () => {
  const c = H.ctx();
  assert.equal((await W.unlock({ password: PASSWORD }, c)).error, 'VAULT_IS_EMPTY');
  await assert.rejects(c.vault.checkPassword(PASSWORD), /VAULT_IS_EMPTY/);
});

test('T-KEY-025: a corrupted vault blob gives "Incorrect password", arms the throttle and does not crash', async () => {
  const c = await fresh(); await W.lock({}, c);
  const blob = JSON.parse(await M.local.get(M.KEYS.VAULT)); const d = Buffer.from(blob.data, 'base64'); d[0] ^= 0xff; blob.data = d.toString('base64');
  await M.local.set(M.KEYS.VAULT, JSON.stringify(blob));
  assert.equal((await W.unlock({ password: PASSWORD }, c)).error, 'Incorrect password');
  assert.equal((await M.local.get(M.KEYS.THROTTLE)).failedAttempts, 1);
  assert.equal(await c.vault.isUnlocked(), false);
});

test('T-KEY-034: checkPassword never touches the session keys and shares the unlock throttle', async () => {
  const c = await fresh();
  const before = JSON.stringify(F.session.data);
  await c.vault.checkPassword(PASSWORD);
  await assert.rejects(c.vault.checkPassword('Wrong-pass-1'), /Incorrect password/);
  assert.equal(JSON.stringify(F.session.data), before);
  assert.equal((await M.local.get(M.KEYS.THROTTLE)).failedAttempts, 1);
});

test('T-KEY-077: revealAuth with a wrong password is throttled together with unlock (6th attempt → lockout)', async () => {
  const c = await fresh(); const clk = fakeClock();
  try {
    for (let i = 0; i < 6; i++) assert.equal((await grant({ ...c }, 'reveal', { password: 'Wrong-pass-' + i })).error, 'Incorrect password');
    assert.equal((await grant(c, 'reveal')).error, 'TOO_MANY_ATTEMPTS', 'even the right password during lockout');
    await W.lock({}, c);
    assert.equal((await W.unlock({ password: PASSWORD }, c)).error, 'TOO_MANY_ATTEMPTS', 'the lock screen shares the same counter');
  } finally { clk.restore(); }
});

test('T-KEY-035 / T-KEY-037: lock removes both session keys and every re-auth grant; locking again is a no-op', async () => {
  const c = await fresh();
  for (const p of ['reveal', 'addWallet', 'manage']) assert.equal((await grant(c, p)).ok, true);
  for (const k of M.ALL_GRANT_KEYS) assert.ok(F.session.data[k]);
  assert.deepEqual(await W.lock({}, c), { ok: true });
  for (const k of [M.KEYS.PASSWORD, M.KEYS.UNLOCK, ...M.ALL_GRANT_KEYS]) assert.equal(F.session.data[k], undefined, k);
  assert.deepEqual(await W.status({}, c), { hasVault: true, unlocked: false });
  assert.equal((await W.getAccounts({}, c)).error, 'LOCKED');
  assert.deepEqual(await W.lock({}, c), { ok: true });
});

// ---------------------------------------------------------------- createWallet (KEY-14)

test('T-KEY-048: createWallet(import) persists one mnemonic wallet, needs no backup and leaves a 10-minute password manage grant', async () => {
  const clk = fakeClock();
  try {
    const c = H.ctx();
    const r = await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' }, c);
    assert.equal(r.ok, true); assert.equal(r.addresses.ethereum, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    const st = await state(c); const [id, w] = Object.entries(st.wallets)[0];
    assert.equal(Object.keys(st.wallets).length, 1); assert.equal(st.activeWalletId, id);
    assert.equal(w.type, 'mnemonic'); assert.equal(w.seedPhraseBackupRequired, false); assert.equal(w.accounts.length, 1);
    assert.deepEqual(F.session.data[M.KEYS.MANAGE], { exp: clk.now + 600_000, method: 'password' });
    assert.ok(H.idb().get(id), 'keystore in IndexedDB'); assert.equal(F.local.data[id], undefined, 'not in chrome.storage.local');
  } finally { clk.restore(); }
});

test('T-KEY-049: invalid createWallet input is refused with INVALID_WALLET_INPUT and writes nothing', async () => {
  const c = H.ctx();
  for (const m of [{ generatedPassword: true, password: PASSWORD, mnemonic: PHRASE_ABOUT }, { password: 'password', mnemonic: PHRASE_ABOUT },
    { password: 'short', mnemonic: PHRASE_ABOUT }, { password: PASSWORD, mnemonic: 'abandon abandon' }, { password: PASSWORD, mnemonic: PHRASE_ABOUT + ' x' },
    { password: 12345678, mnemonic: PHRASE_ABOUT }, { password: { toString: () => PASSWORD }, mnemonic: PHRASE_ABOUT }, { password: PASSWORD }]) {
    const before = snapshot();
    assert.equal((await W.createWallet({ type: 'createWallet', ...m }, c)).error, 'INVALID_WALLET_INPUT', JSON.stringify(m));
    assert.equal(snapshot(), before);
  }
});

test('T-KEY-051: a failing biometric enrolment during createWallet drops the vault keys (no vault nobody can open)', async () => {
  const c = H.ctx();
  const r = await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, passkey: { secret: 'not-hex', credentialId: 'aa' } }, c);
  assert.deepEqual(r, { ok: false, error: 'INVALID_PASSKEY_SECRET' });
  assert.equal(await c.vault.exists(), false);
  for (const k of [M.KEYS.VAULT, M.KEYS.PBKDF2, M.KEYS.VAULT_ID]) assert.equal(await M.local.get(k), undefined, k);
  assert.equal(F.session.data[M.KEYS.UNLOCK], undefined);
  assert.equal((await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT }, c)).ok, true, 'retry works');
});

test('T-KEY-053 / T-KEY-102: a createWallet interrupted after vault.create is classified "interrupted" and resetEmptyVault recovers', async () => {
  const c = H.ctx();
  // Interrupt exactly between vault.create and the keystore write: buildStoredKey throws.
  const ws = c.wallet; const orig = ws.buildStoredKey; ws.buildStoredKey = async () => { throw new Error('SIMULATED_CRASH'); };
  try { assert.deepEqual(await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT }, c), { ok: false, error: 'SIMULATED_CRASH' }); }
  finally { ws.buildStoredKey = orig; }
  const st = await O.onboardingStatus({}, c);
  assert.equal(st.mode, 'interrupted'); assert.equal(st.walletCount, 0);
  assert.deepEqual(await O.resetEmptyVault({}, c), { ok: true });
  assert.equal(await c.vault.exists(), false);
  assert.equal((await O.onboardingStatus({}, c)).mode, 'first-wallet');
});

test('T-KEY-054: createWallet(newlyGenerated) answers with addresses only: no phrase, key or keystore in the response or in chrome.storage', async () => {
  const c = H.ctx();
  const r = await W.createWallet({ type: 'createWallet', password: PASSWORD, newlyGenerated: true }, c);
  assert.equal(r.ok, true); assert.deepEqual(Object.keys(r).sort(), ['addresses', 'ok']);
  assert.equal(M.findSecretField(r), null);
  const id = (await state(c)).activeWalletId;
  const mnemonic = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(H.idb().get(id)))).decryptMnemonic(new TextEncoder().encode(F.session.data[M.KEYS.PASSWORD]));
  assert.equal(mnemonic.split(' ').length, 12);
  for (const where of [r, F.local.data, F.session.data]) assert.ok(!JSON.stringify(where).includes(mnemonic));
  assert.equal((await state(c)).wallets[id].seedPhraseBackupRequired, true);
});

test('T-KEY-136: a storage failure part-way through createWallet leaves a recoverable state (onboarding not blocked)', async () => {
  const c = H.ctx();
  F.idbFail = 'QuotaExceededError'; // every IndexedDB transaction aborts: the KDF record write fails
  const r = await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT }, c);
  F.idbFail = null;
  assert.equal(r.ok, false);
  const st = await O.onboardingStatus({}, c);
  assert.ok(['first-wallet', 'interrupted'].includes(st.mode), st.mode);
  if (st.mode === 'interrupted') assert.equal((await O.resetEmptyVault({}, c)).ok, true);
  assert.equal((await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT }, c)).ok, true, 'retry after the failure succeeds');
});

// ---------------------------------------------------------------- addWallet (KEY-15)

test('T-KEY-055: addWallet(import) with a grant stores the keystore under the session passwordKey and activates the new wallet', async () => {
  const c = await fresh();
  const r = await addSecond(c);
  assert.equal(r.newlyGenerated, false); assert.equal(r.backupGranted, false);
  const st = await state(c);
  assert.equal(st.activeWalletId, r.walletId); assert.equal(Object.keys(st.wallets).length, 2);
  const list = await M.local.get(M.KEYS.wallets(st.vaultId)); assert.ok(list.includes(r.walletId));
  const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(H.idb().get(r.walletId))));
  try { assert.equal(sk.decryptMnemonic(new TextEncoder().encode(F.session.data[M.KEYS.PASSWORD])), PHRASE_LEGAL); } finally { sk.delete(); }
});

test('T-KEY-056: addWallet without a fresh grant → AUTH_REQUIRED (import and create); one grant is consumed by one add', async () => {
  const c = await fresh(); const before = snapshot();
  assert.equal((await W.addWallet({ type: 'addWallet', mnemonic: PHRASE_LEGAL }, c)).error, 'AUTH_REQUIRED');
  assert.equal((await W.addWallet({ type: 'addWallet' }, c)).error, 'AUTH_REQUIRED');
  assert.equal(snapshot(), before);
  await addSecond(c);
  assert.equal((await W.addWallet({ type: 'addWallet', mnemonic: PHRASE_C }, c)).error, 'AUTH_REQUIRED', 'grant was consumed');
});

test('T-KEY-057: the internal AUTHORIZED marker cannot be forged through a JSON message', async () => {
  const c = await fresh();
  for (const raw of ['{"type":"addWallet","mnemonic":"' + PHRASE_LEGAL + '","AUTHORIZED":true}', '{"type":"addWallet","mnemonic":"' + PHRASE_LEGAL + '","Symbol(addWalletAuthorized)":true}',
    '{"type":"addWallet","mnemonic":"' + PHRASE_LEGAL + '","addWalletAuthorized":true,"__proto__":{"AUTHORIZED":true}}']) {
    assert.equal((await W.addWallet(JSON.parse(raw), c)).error, 'AUTH_REQUIRED', raw);
  }
  assert.equal(Object.keys((await state(c)).wallets).length, 1);
});

test('T-KEY-058: the 31st wallet is refused with MAX_WALLETS', async () => {
  const c = await fresh(); const st = await state(c);
  for (let i = 0; i < 29; i++) st.wallets[`w${i}`] = { label: `W${i}`, type: 'mnemonic', addresses: { ethereum: `0x${String(i).padStart(40, '0')}` } };
  await c.vault.persist(st);
  await grant(c, 'addWallet');
  assert.equal((await W.addWallet({ type: 'addWallet', mnemonic: PHRASE_LEGAL }, c)).error, 'MAX_WALLETS');
});

test('T-KEY-059: importing a phrase that is already in the vault → "This wallet already exists"', async () => {
  const c = await fresh(); await grant(c, 'addWallet');
  assert.equal((await W.addWallet({ type: 'addWallet', mnemonic: `  ${PHRASE_ABOUT}  ` }, c)).error, 'This wallet already exists');
});

test('T-KEY-131: two concurrent addWallet calls never leave an orphan keystore or lose a wallet', async () => {
  const c = await fresh(); await grant(c, 'addWallet');
  const [a, b] = await Promise.all([W.addWallet({ type: 'addWallet', mnemonic: PHRASE_LEGAL }, c), W.addWallet({ type: 'addWallet', mnemonic: PHRASE_C }, c)]);
  assert.ok(a.ok || b.ok);
  for (const r of [a, b]) if (!r.ok) assert.match(r.error, /^(WALLET_CREATION_IN_PROGRESS|AUTH_REQUIRED)$/);
  const st = await state(c);
  const keystores = [...H.idb().keys()].filter((k) => M.isSecretKey(k) && /^[0-9a-f-]{36}$/i.test(k));
  assert.deepEqual(keystores.sort(), Object.keys(st.wallets).sort(), 'every keystore is listed and every wallet has a keystore');
});

test('T-KEY-137: a failing vault write leaves no orphan keystore or listed id, and a retry succeeds (BUG-04 fixed)', async () => {
  const c = await fresh(); await grant(c, 'addWallet');
  const keystoresBefore = [...H.idb().keys()].filter((k) => /^[0-9a-f-]{36}$/i.test(k)).sort();
  // The storage write itself fails (quota, aborted IndexedDB transaction): keystore, id list and vault go in one setMany.
  const orig = M.local.setMany; M.local.setMany = async () => { throw new Error('PERSIST_FAILED'); };
  let r; try { r = await W.addWallet({ type: 'addWallet', mnemonic: PHRASE_LEGAL }, c); } finally { M.local.setMany = orig; }
  assert.deepEqual(r, { ok: false, error: 'PERSIST_FAILED' });
  const st = await state(c); assert.equal(Object.keys(st.wallets).length, 1, 'wallet not listed in the vault');
  const list = await M.local.get(M.KEYS.wallets(st.vaultId));
  assert.equal(list.length, 1, 'no orphan id listed');
  assert.deepEqual([...H.idb().keys()].filter((k) => /^[0-9a-f-]{36}$/i.test(k)).sort(), keystoresBefore, 'no orphan keystore written');
  await grant(c, 'addWallet');
  const retry = await W.addWallet({ type: 'addWallet', mnemonic: PHRASE_LEGAL }, c);
  assert.equal(retry.ok, true, 'retry succeeds');
  assert.equal((await M.local.get(M.KEYS.wallets(st.vaultId))).length, 2);
});

// ---------------------------------------------------------------- re-auth grants (KEY-20)

test('T-KEY-075: grant validity is exact to the millisecond, TTL is capped at 15 min, consume removes even an invalid grant', async () => {
  const clk = fakeClock();
  try {
    for (const [p, ttl] of [['reveal', 120_000], ['addWallet', 600_000], ['manage', 120_000]]) {
      await M.grantReauth(p, { method: 'password' });
      clk.advance(ttl); assert.equal(await M.hasReauth(p), true, `${p} valid at exp`);
      clk.advance(1); assert.equal(await M.hasReauth(p), false, `${p} invalid at exp+1`);
      assert.equal(await M.consumeReauth(p), false); assert.equal(F.session.data[M.KEYS[p === 'reveal' ? 'REVEAL' : p === 'manage' ? 'MANAGE' : 'ADD_WALLET']], undefined, 'consumed although expired');
    }
    await M.grantReauth('reveal', { method: 'password', ttlMs: 3_600_000 });
    assert.equal(F.session.data[M.KEYS.REVEAL].exp - clk.now, 15 * 60_000);
    await M.grantReauth('reveal', { method: 'passkey', walletId: 'A' });
    assert.equal(await M.hasReauth('reveal', { walletId: 'B' }), false);
    assert.equal(await M.hasReauth('reveal', { walletId: 'A', method: 'password' }), false);
    assert.equal(await M.consumeReauth('reveal', { walletId: 'A', method: 'passkey' }), true);
    assert.equal(await M.consumeReauth('reveal', { walletId: 'A', method: 'passkey' }), false, 'one shot');
    for (const bad of [null, 'x', { exp: 'soon', method: 'password' }, { method: 'password' }]) { F.session.data[M.KEYS.MANAGE] = bad; assert.equal(await M.consumeReauth('manage'), false); }
  } finally { clk.restore(); }
});

test('T-KEY-078: purposeOf maps unknown purposes to the narrowest grant ("reveal")', () => {
  for (const v of ['admin', undefined, null, 'MANAGE', 1, {}]) assert.equal(M.purposeOf(v), 'reveal');
  assert.equal(M.purposeOf('manage'), 'manage'); assert.equal(M.purposeOf('addWallet'), 'addWallet');
});

test('T-KEY-147: two concurrent consumeReauth calls on one grant succeed at most once', async (t) => {
  await M.grantReauth('reveal', { method: 'password' });
  const r = await Promise.all([M.consumeReauth('reveal'), M.consumeReauth('reveal')]);
  const both = r.every(Boolean);
  if (both) return assert.fail('BUG-05 regression (fixed bug reproduces again): ' + 'consumeReauth = get then remove (two awaits); two concurrent requests both see the grant and both pass');
  assert.equal(r.filter(Boolean).length, 1);
});

// ---------------------------------------------------------------- biometrics guards (KEY-08, KEY-21)

test('T-KEY-032: passkeyAddPassword refuses wrong secret, weak password, a wallet that has a password, and a locked wallet — no storage change', async () => {
  const c = await fresh({ keepGrant: true });
  await M.enrollPasskey(S('b'), 'cc', true); // biometrics-only wallet (password generated)
  const before = snapshot();
  assert.equal((await W.passkeyAddPassword({ secret: S('c'), password: 'Brand-new-pass-77' }, c)).ok, false);
  assert.equal((await W.passkeyAddPassword({ secret: S('b'), password: 'password' }, c)).error, 'INVALID_WALLET_INPUT');
  assert.equal(snapshot(), before);
  await M.enrollPasskey(S('b'), 'cc', false);
  assert.equal((await W.passkeyAddPassword({ secret: S('b'), password: 'Brand-new-pass-77' }, c)).error, 'This wallet already has a password.');
  await W.lock({}, c);
  assert.equal((await W.passkeyAddPassword({ secret: S('b'), password: 'Brand-new-pass-77' }, c)).error, 'LOCKED');
});

test('T-KEY-082: biometrics cannot be turned off on a wallet whose only unlock method is biometrics', async () => {
  const c = await fresh({ keepGrant: true });
  await M.enrollPasskey(S('d'), 'dd', true);
  assert.match((await W.passkeyDisable({}, c)).error, /only way to unlock/);
  assert.ok(await M.local.get(M.KEYS.PASSKEY));
});

// ---------------------------------------------------------------- remove / reset / accounts (KEY-25..27)

test('T-KEY-098: removeWallet with a manage grant deletes the vault entry and the keystore and re-points the active wallet', async () => {
  const c = await fresh(); const first = (await state(c)).activeWalletId; const { walletId } = await addSecond(c);
  await grant(c, 'manage');
  const r = await W.removeWallet({ walletId }, c);
  assert.equal(r.ok, true); assert.equal(r.activeWalletId, first);
  const st = await state(c);
  assert.deepEqual(Object.keys(st.wallets), [first]);
  assert.equal(H.idb().get(walletId), undefined); assert.equal(F.local.data[walletId], undefined);
  assert.deepEqual(await M.local.get(M.KEYS.wallets(st.vaultId)), [first]);
});

test('T-KEY-099: removeWallet refusals leave everything in place', async () => {
  const c = await fresh(); const first = (await state(c)).activeWalletId;
  await grant(c, 'manage');
  assert.equal((await W.removeWallet({ walletId: first }, c)).error, 'Cannot remove your only wallet');
  assert.equal((await W.removeWallet({ walletId: 'nope' }, c)).error, 'Wallet not found');
  await grant(c, 'addWallet'); const gen = await W.addWallet({ type: 'addWallet' }, c); assert.equal(gen.ok, true);
  await grant(c, 'manage');
  assert.equal((await W.removeWallet({ walletId: gen.walletId }, c)).code, 'BACKUP_REQUIRED');
  await M.session.remove(M.KEYS.MANAGE);
  const before = snapshot();
  assert.equal((await W.removeWallet({ walletId: first }, c)).error, 'AUTH_REQUIRED');
  assert.equal(snapshot(), before);
});

test('T-KEY-103: resetEmptyVault is refused when the vault holds wallets or is locked', async () => {
  const c = await fresh(); const before = snapshot();
  assert.equal((await O.resetEmptyVault({}, c)).error, 'FORBIDDEN_REQUEST');
  await W.lock({}, c);
  assert.equal((await O.resetEmptyVault({}, c)).error, 'FORBIDDEN_REQUEST');
  assert.equal(await c.vault.exists(), true);
  assert.equal(JSON.stringify([...H.idb().entries()]), JSON.stringify(JSON.parse(before).i));
});

test('T-KEY-100: addAccount ×3, switch/rename account, switch/rename wallet, listWallets', async () => {
  const c = await fresh();
  for (let i = 1; i <= 3; i++) {
    const r = await W.addAccount({}, c); assert.equal(r.ok, true); assert.equal(r.account.derivationIndex, i); assert.equal(r.activeAccount, i);
    assert.equal(r.account.addresses.ethereum, c.wallet.deriveAddressesWithWallet(core.HDWallet.createWithMnemonic(PHRASE_ABOUT, ''), i).ethereum);
  }
  const sw = await W.switchAccount({ index: 2 }, c); assert.equal(sw.activeAccount, 2);
  assert.equal((await W.getAccounts({}, c)).addresses.ethereum, sw.addresses.ethereum);
  assert.equal((await W.renameAccount({ index: 2, name: '  Savings ' }, c)).name, 'Savings');
  const id1 = (await state(c)).activeWalletId; const { walletId: id2 } = await addSecond(c);
  assert.equal((await W.switchWallet({ walletId: id1 }, c)).activeAccount, 2);
  assert.equal((await W.renameWallet({ walletId: id2, name: 'Cold' }, c)).label, 'Cold');
  const l = await W.listWallets({}, c);
  assert.equal(l.activeWalletId, id1); assert.equal(l.wallets.length, 2);
  assert.equal(l.wallets.find((w) => w.id === id1).accounts[2].name, 'Savings');
  assert.equal(l.wallets.find((w) => w.id === id2).label, 'Cold');
  assert.equal(M.findSecretField(l), null);
});

test('T-KEY-101: invalid account/wallet operations are refused', async () => {
  const c = await fresh();
  for (const index of [-1, 1.5, 99, 'x', undefined, '1e9']) assert.equal((await W.switchAccount({ index }, c)).error, 'Invalid account', String(index));
  assert.equal((await W.renameWallet({ walletId: (await state(c)).activeWalletId, name: '   ' }, c)).error, 'Name required');
  assert.equal((await W.renameAccount({ index: 0, name: '' }, c)).error, 'Name required');
  assert.equal((await W.switchWallet({ walletId: 'missing' }, c)).error, 'Wallet not found');
  const st = await state(c); st.wallets[st.activeWalletId].type = 'privateKey'; await c.vault.persist(st);
  assert.equal((await W.addAccount({}, c)).error, 'This wallet type has a single account');
});

test('T-KEY-129: vault entries from older builds (no accounts/type/activeAccount) are read as one mnemonic account', async () => {
  const c = await fresh(); const st = await state(c); const w = st.wallets[st.activeWalletId];
  delete w.accounts; delete w.type; delete w.activeAccount; await c.vault.persist(st);
  const acc = await W.getAccounts({}, c);
  assert.equal(acc.ok, true); assert.equal(acc.accounts.length, 1); assert.equal(acc.addresses.ethereum, w.addresses.ethereum);
  assert.equal((await W.listWallets({}, c)).wallets[0].type, 'mnemonic');
  const add = await W.addAccount({}, c); assert.equal(add.ok, true); assert.equal(add.account.derivationIndex, 1);
  const after = (await state(c)).wallets[st.activeWalletId];
  assert.equal(after.accounts.length, 2); assert.equal(after.accounts[0].addresses.ethereum, w.addresses.ethereum);
});

test('T-KEY-134: removeWallet(B) racing addAccount/switchWallet(B) leaves a consistent vault', async (t) => {
  const c = await fresh(); const { walletId: B } = await addSecond(c); await grant(c, 'manage');
  await Promise.all([W.removeWallet({ walletId: B }, c), W.addAccount({}, c), W.switchWallet({ walletId: B }, c)]);
  const st = await state(c);
  const consistent = st.wallets[st.activeWalletId] && !(B in st.wallets ? H.idb().get(B) === undefined : H.idb().get(B) !== undefined);
  if (!consistent) return assert.fail('BUG-06 regression (fixed bug reproduces again): ' + `vault after race: active=${st.activeWalletId === B ? 'B' : 'A'}, B in vault=${B in st.wallets}, B keystore=${!!H.idb().get(B)}`);
  assert.ok(consistent);
});

test('T-KEY-135: concurrent read-modify-write handlers do not lose each other\'s updates', async (t) => {
  const c = await fresh(); await W.addAccount({}, c); const id = (await state(c)).activeWalletId;
  await Promise.all([W.renameWallet({ walletId: id, name: 'Renamed' }, c), W.switchAccount({ index: 0 }, c), W.renameAccount({ index: 1, name: 'Second' }, c)]);
  const w = (await state(c)).wallets[id];
  const lost = [w.label !== 'Renamed' && 'renameWallet', w.activeAccount !== 0 && 'switchAccount', w.accounts[1].name !== 'Second' && 'renameAccount'].filter(Boolean);
  if (lost.length) return assert.fail('BUG-06 regression (fixed bug reproduces again): ' + `vault.persist is not serialised with getState: lost ${lost.join(', ')}`);
  assert.equal(lost.length, 0);
});

test('T-KEY-138: a failing keystore removal leaves wallet entry and keystore consistent', async (t) => {
  const c = await fresh(); const { walletId } = await addSecond(c); await grant(c, 'manage');
  F.idbFail = 'IDB_DOWN';
  const r = await W.removeWallet({ walletId }, c);
  F.idbFail = null;
  assert.equal(r.ok, false);
  const st = await state(c);
  const inVault = walletId in st.wallets, hasKs = H.idb().get(walletId) !== undefined;
  assert.equal(inVault, hasKs, `vault entry ${inVault} vs keystore ${hasKs}`);
  void t;
});

// ---------------------------------------------------------------- input normalisation (KEY-12/13)

test('T-KEY-139: malformed phrases are rejected before wallet-core; spacing/case variants are normalised for import', async () => {
  const ws = new M.WalletService(core);
  for (const bad of ['', 'abandon '.repeat(11).trim(), PHRASE_ABOUT.replace('about', 'abaut'), 'àbandon '.repeat(11) + 'about', PHRASE_ABOUT + ' about']) {
    assert.equal(ws.isValidMnemonic(bad), false, String(bad));
  }
  // OBS-02 (fixed): non-string input answers valid:false instead of reaching wallet-core's embind layer.
  const c0 = H.ctx();
  for (const bad of [42, null, {}, ['abandon']]) assert.deepEqual(await W.validateMnemonic({ mnemonic: bad }, c0), { valid: false }, JSON.stringify(bad));
  assert.equal(ws.isValidMnemonic(42), false);
  assert.equal((await W.validateMnemonic({ mnemonic: PHRASE_ABOUT }, c0)).valid, true, 'wallet-core still usable afterwards');
  const c = await fresh(); await grant(c, 'addWallet');
  assert.equal((await W.addWallet({ type: 'addWallet', mnemonic: '  ' + PHRASE_LEGAL + '\n' }, c)).ok, true, 'surrounding whitespace trimmed');
  await grant(c, 'addWallet');
  const r = await O.importInitiate({ secret: PHRASE_C.toUpperCase().replace(/ /g, '   ') }, c);
  assert.equal(r.ok, true, 'importInitiate normalises case and inner spacing'); assert.equal(r.wordCount, 15);
});

// ---------------------------------------------------------------- key schedule migration (KEY-04, KEY-07)

async function v1Fixture({ corruptKeystore = false } = {}) {
  // A wallet as written by builds before Argon2id: PBKDF2 record, v1 passworder vault, keystores under the PBKDF2 passwordKey.
  H.reset();
  const pw = new M.PasswordService(core); const salt = new Uint8Array(32).fill(5); const iterations = 600;
  const unlockKey = pw.deriveKeyHex(PASSWORD, salt, iterations), passwordKey = pw.deriveKeyHex(PASSWORD, salt, M.DEFAULT_ITERATIONS);
  const sk = core.StoredKey.importHDWalletWithEncryption(PHRASE_ABOUT, 'Main', new TextEncoder().encode(passwordKey), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
  const id = sk.identifier(); const ks = JSON.parse(new TextDecoder().decode(sk.exportJSON())); sk.delete();
  if (corruptKeystore) ks.crypto.mac = '00'.repeat(32);
  const vaultId = 'vault-1';
  await M.local.set(M.KEYS.PBKDF2, { salt: core.HexCoding.encode(salt), iterations });
  await M.local.set(M.KEYS.VAULT_ID, { vaultId }); await M.local.set(id, ks); await M.local.set(M.KEYS.wallets(vaultId), [id]);
  await M.local.set(M.KEYS.PERPS_AGENTS, { 'evm:0x1': { enc: await M.passworder.encrypt(passwordKey, { agentKey: '0x' + '1'.repeat(64) }) } });
  await M.local.set(M.KEYS.VAULT, await M.passworder.encrypt(unlockKey, { vaultId, activeWalletId: id, wallets: { [id]: { label: 'Main', type: 'mnemonic', addresses: { ethereum: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94' } } } }));
  return { id, ks, unlockKey, passwordKey };
}

test('T-KEY-123 / T-KEY-124: v1 → v2 migration writes only v2 records and leaves no v1 key material behind', async () => {
  const old = await v1Fixture(); const c = H.ctx();
  assert.equal((await W.unlock({ password: PASSWORD }, c)).ok, true);
  const rec = await M.local.get(M.KEYS.PBKDF2); assert.equal(rec.v, 2); assert.equal(rec.kdf, 'argon2id');
  const all = JSON.stringify({ l: F.local.data, s: F.session.data, i: [...H.idb().entries()] });
  for (const k of [old.unlockKey, old.passwordKey]) assert.ok(!all.includes(k), 'old v1 key not stored anywhere');
  assert.ok(!all.includes(JSON.stringify(old.ks.crypto.ciphertext)), 'old keystore ciphertext replaced');
  assert.ok(!all.includes('"iterations"'), 'no PBKDF2 record remains');
  const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(H.idb().get(old.id))));
  try { assert.equal(sk.decryptMnemonic(new TextEncoder().encode(F.session.data[M.KEYS.PASSWORD])), PHRASE_ABOUT); } finally { sk.delete(); }
  const agents = await M.local.get(M.KEYS.PERPS_AGENTS);
  assert.deepEqual(await M.passworder.decrypt(F.session.data[M.KEYS.PASSWORD], agents['evm:0x1'].enc), { agentKey: '0x' + '1'.repeat(64) });
  // and later writes (persist) stay v2
  await c.vault.persist(await state(c)); assert.equal(JSON.parse(await M.local.get(M.KEYS.VAULT)).v, 2);
});

test('T-KEY-028: a v1 vault whose keystore cannot be re-keyed still unlocks and nothing is written', async () => {
  const old = await v1Fixture({ corruptKeystore: true });
  const before = JSON.stringify([...H.idb().entries()].filter(([k]) => k !== M.KEYS.VAULT));
  const r = await W.unlock({ password: PASSWORD }, H.ctx());
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify([...H.idb().entries()].filter(([k]) => k !== M.KEYS.VAULT)), before, 'KDF record and keystores untouched');
  assert.equal((await M.local.get(M.KEYS.PBKDF2)).iterations, 600, 'still v1, retried next unlock');
  assert.equal(F.session.data[M.KEYS.PASSWORD], old.passwordKey);
});

test('T-KEY-029: rekeyKeystore preserves id/name/accounts, replaces crypto, and works for private-key keystores', () => {
  const te = new TextEncoder(); const oldP = 'o'.repeat(128), newP = 'n'.repeat(128);
  const pk = core.StoredKey.importPrivateKeyWithEncryption(Buffer.from('46'.repeat(32), 'hex'), 'Imported', te.encode(oldP), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
  const ks = JSON.parse(new TextDecoder().decode(pk.exportJSON())); pk.delete();
  const next = M.rekeyKeystore(core, ks, oldP, newP);
  assert.equal(next.id, ks.id); assert.equal(next.name, ks.name); assert.deepEqual(next.activeAccounts, ks.activeAccounts);
  assert.notEqual(next.crypto.ciphertext, ks.crypto.ciphertext);
  assert.throws(() => M.rekeyKeystore(core, ks, 'w'.repeat(128), newP));
});

test('T-KEY-030: rekeyBlob returns null for non-strings and for blobs the old passphrase cannot open', async () => {
  assert.equal(await M.rekeyBlob(undefined, 'a', 'b'), null); assert.equal(await M.rekeyBlob({ v: 2 }, 'a', 'b'), null);
  const blob = await M.passworder.encrypt(S('a'), { x: 1 });
  assert.equal(await M.rekeyBlob(blob, S('b'), S('c')), null);
  assert.deepEqual(await M.passworder.decrypt(S('c'), await M.rekeyBlob(blob, S('a'), S('c'))), { x: 1 });
});

// ---------------------------------------------------------------- storage placement (KEY-22)

test('T-KEY-085: when the secure-store read-back differs (verify fails) the legacy copy is kept, still served, and retried later', async () => {
  H.reset();
  const blob = { v: 2, data: 'legacy-encrypted-vault-blob', iv: 'aa', salt: 'bb' };
  F.local.data['wallet:vault'] = structuredClone(blob);
  // the store accepts the write but reads back something else (bit rot / a broken IDB implementation)
  F.idbReadHook = (k, v) => (k === 'wallet:vault' && v !== undefined ? { ...v, data: 'CORRUPTED' } : v);
  await assert.rejects(M.migrateSecretsToSecureStore(), /SECURE_STORE_VERIFY_FAILED/);
  assert.deepEqual(F.local.data['wallet:vault'], blob, 'boot migration: legacy copy kept');
  // lazy path: local.get serves... the secure copy if it reads one; with the read-back broken it must not lose the legacy value
  H.idb().delete('wallet:vault');
  F.idbReadHook = (k, v) => (k === 'wallet:vault' && v !== undefined ? 'CORRUPTED' : v);
  assert.deepEqual(await M.local.get('wallet:vault'), blob, 'lazy migration: verify failed, the legacy value is returned');
  assert.deepEqual(F.local.data['wallet:vault'], blob, 'and kept in storage.local');
  // once the store behaves, the next read migrates and deletes the legacy copy
  F.idbReadHook = null; H.idb().delete('wallet:vault');
  assert.deepEqual(await M.local.get('wallet:vault'), blob);
  assert.equal(F.local.data['wallet:vault'], undefined, 'legacy copy removed after a verified move');
  assert.deepEqual(H.idb().get('wallet:vault'), blob);
  // a write failure (transaction abort) also keeps the legacy copy
  H.reset(); F.local.data['wallet:vault'] = structuredClone(blob); F.idbFail = 'QuotaExceededError';
  assert.deepEqual(await M.local.get('wallet:vault'), blob);
  assert.deepEqual(F.local.data['wallet:vault'], blob, 'abort: legacy kept');
  F.idbFail = null;
});

test('T-KEY-086: isSecretKey is true exactly for the secret keys and keystore UUIDs', () => {
  for (const k of ['wallet:vault', 'wallet:pbkdf2', 'wallet:passkey:vault', 'perps:agents:v1', 'predictions:creds:v1', '3198bc9c-6672-5ab3-d995-4942343ae5b6', '3198BC9C-6672-5AB3-D995-4942343AE5B6']) assert.equal(M.isSecretKey(k), true, k);
  for (const k of ['wallet:settings', 'wallet:vaultId', 'wallet:throttle', 'wallet:passkey', 'wallet:store', '3198bc9c-6672-5ab3-d995-4942343ae5b', 'x3198bc9c-6672-5ab3-d995-4942343ae5b6', 'wallet:vault ']) assert.equal(M.isSecretKey(k), false, k);
});

test('T-KEY-144: storage key names are frozen (renaming one needs a migration)', () => {
  const { wallets, ...fixed } = M.KEYS;
  assert.deepEqual(fixed, { STORE: 'wallet:store', PBKDF2: 'wallet:pbkdf2', VAULT: 'wallet:vault', VAULT_ID: 'wallet:vaultId', THROTTLE: 'wallet:throttle', PASSWORD: 'wallet:password',
    UNLOCK: 'wallet:unlock', UI: 'wallet:ui', SETTINGS: 'wallet:settings', PASSKEY: 'wallet:passkey', REVEAL: 'wallet:revealGrant', ADD_WALLET: 'wallet:addWalletGrant', MANAGE: 'wallet:manageGrant',
    NETWORKS: 'wallet:networks', PASSKEY_VAULT: 'wallet:passkey:vault', FIAT_RATES: 'wallet:fiatRates', PERPS_AGENTS: 'perps:agents:v1', PREDICTIONS_CREDS: 'predictions:creds:v1' });
  assert.equal(wallets('abc'), 'wallet:wallets:abc'); assert.equal(M.VAULT_REV, 'wallet:vaultRev');
});

test('T-KEY-142: local.set/get round-trips any JSON value; secret keys only ever land in IndexedDB', async () => {
  const keyArb = fc.oneof(fc.constantFrom('wallet:vault', 'wallet:pbkdf2', 'perps:agents:v1', 'wallet:settings', 'wallet:ui', 'misc'), fc.uuid());
  await fc.assert(fc.asyncProperty(keyArb, fc.jsonValue(), async (k, v0) => {
    H.reset(); const v = JSON.parse(JSON.stringify(v0 ?? 0));
    await M.local.set(k, v);
    assert.deepEqual(await M.local.get(k), v);
    if (M.isSecretKey(k)) { assert.equal(k in F.local.data, false); assert.deepEqual(H.idb().get(k), v); }
    else assert.equal(H.idb().has(k), false);
  }), { numRuns: 120, seed: 5 });
});

test('T-KEY-132: concurrent secureStore.setMany batches are each atomic and the final state is one serial order', async () => {
  const batches = Array.from({ length: 8 }, (_, i) => ({ a: i, b: i, c: i }));
  await Promise.all(batches.map((b) => M.secureStore.setMany(b)));
  const s = H.idb(); assert.ok(s.get('a') === s.get('b') && s.get('b') === s.get('c'), 'no mixed batch');
  F.idbFail = 'ABORT'; await assert.rejects(M.secureStore.setMany({ a: 99, b: 99 })); F.idbFail = null;
  assert.notEqual(s.get('a'), 99, 'aborted batch wrote nothing');
});

test('T-KEY-120: wallet responses never carry secret field names (uiSafe scan over the whole suite of wallet handlers)', async () => {
  const c = await fresh({ keepGrant: true });
  const out = [await W.status({}, c), await W.getAccounts({}, c), await W.listWallets({}, c), await W.addAccount({}, c), await W.passkeyStatus({}, c), await W.reauthStatus({ purpose: 'manage' }, c), await O.onboardingStatus({}, c)];
  for (const r of out) { assert.equal(M.findSecretField(r), null, JSON.stringify(r)); assert.ok(!allStrings(r).some((s) => s === PHRASE_ABOUT || s === F.session.data[M.KEYS.PASSWORD])); }
});
