// QA: one install carrying EVERY legacy stored-data format at once is booted with the current worker and unlocked:
//   v1 PBKDF2 KDF record + v1 vault + keystore under the PBKDF2 key, all still in chrome.storage.local (pre-IndexedDB, PT-11);
//   store tuple v0 (`wallet:store` absent); a legacy (user-handle, non-PRF) biometric seal; a perps agent blob under the old key;
//   a pre-PT-06 WalletConnect session sharing an injected site's origin; stored auto-lock 0 ("Never"); a raw-seed device identity.
// Everything must be upgraded with nothing lost and every legacy artefact removed. The fixtures are written by a separate,
// non-worker bundle BEFORE the worker boots, so the worker's own boot migrations do the work.
// TEST_PLAN: T-X-007.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT, allStrings } from './harness.mjs';

const ADDR0 = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const AGENT = '0x' + '1'.repeat(64);
// 1. fixture writer (no worker in this bundle)
const P = await harness(`
  export { PasswordService, DEFAULT_ITERATIONS } from './core/passwordService';
  export * as passworder from './core/passworder';
  export { KEYS } from './core/storage';
  // legacy fixture writer
`);
const { F, core } = P;
P.reset();
const pw = new P.M.PasswordService(core); const salt = new Uint8Array(32).fill(7); const iterations = 600;
const unlockKey = pw.deriveKeyHex(PASSWORD, salt, iterations), passwordKey = pw.deriveKeyHex(PASSWORD, salt, P.M.DEFAULT_ITERATIONS);
const sk = core.StoredKey.importHDWalletWithEncryption(PHRASE_ABOUT, 'Main', new TextEncoder().encode(passwordKey), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
const WID = sk.identifier(); const KS = JSON.parse(new TextDecoder().decode(sk.exportJSON())); sk.delete();
const K = P.M.KEYS; const VAULT_ID = 'vault-legacy';
const L = F.local.data; // chrome.storage.local, written directly: this is what an old build left behind
L[K.PBKDF2] = { salt: core.HexCoding.encode(salt), iterations };
L[K.VAULT_ID] = { vaultId: VAULT_ID }; L[K.wallets(VAULT_ID)] = [WID]; L[WID] = KS;
L[K.VAULT] = await P.M.passworder.encrypt(unlockKey, { vaultId: VAULT_ID, activeWalletId: WID, wallets: { [WID]: { label: 'Main', type: 'mnemonic', addresses: { ethereum: ADDR0 } } } });
L[K.PERPS_AGENTS] = { [`${WID}:0`]: { address: '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A', enc: await P.M.passworder.encrypt(passwordKey, { pk: AGENT }), approvedAt: 1 } };
L[K.PASSKEY] = { credentialId: 'legacy-cred', isPasswordGenerated: false, createdAt: 1 }; // no `scheme`: user-handle seal
L[K.PASSKEY_VAULT] = await P.M.passworder.encrypt('legacy-user-handle-secret-0123456789abcdef', { passwordKey, unlockKey });
L[K.SETTINGS] = { lockTimeInMinutes: 0, currency: 'USD' };
L['harbour:wc:sessions'] = { t1: { topic: 't1', origin: 'https://legacy-wc.example', connectedAt: 1, expiry: 0, peer: { name: 'Old dApp', url: 'https://legacy-wc.example' } } };
assert.equal(L[K.STORE], undefined, 'store tuple v0 (absent)');
const LEGACY_SECRETS = [K.PBKDF2, K.VAULT, WID, K.PERPS_AGENTS, K.PASSKEY_VAULT];

// 2. the current worker boots over it
const H = await harness(`
  import './background/index';
  export { KEYS, local } from './core/storage';
  export { loadSettings } from './background/settingsService';
  export * as passworder from './core/passworder';
  export { deviceIdentity, setDeviceStorage } from './core/harbour/device';
`);
const { M } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test('T-X-007: boot + unlock upgrades every legacy format at once, with nothing lost and every legacy artefact removed', async () => {
  // boot migrations ran on import (give the async boot a moment)
  for (let i = 0; i < 250 && LEGACY_SECRETS.some((k) => F.local.data[k] !== undefined); i++) await tick(20);
  // a) secrets moved out of storage.local into the extension-origin IndexedDB, byte-for-byte
  for (const k of LEGACY_SECRETS) { assert.equal(F.local.data[k], undefined, `${k} left storage.local`); assert.ok(H.idb().get(k) !== undefined, `${k} in IndexedDB`); }
  // b) store tuple migrated from v0
  const tuple = await M.local.get(K.STORE); assert.ok(Array.isArray(tuple) && tuple[0] >= 1 && tuple[2].legacyImported === true, JSON.stringify(tuple));
  // c) auto-lock "Never" is not honoured: normalised to the default, and an alarm is armed after unlock
  assert.equal((await M.loadSettings()).lockTimeInMinutes, 10);

  // d) unlock with the old password: v1 → v2 key schedule, everything re-keyed
  const u = await send({ type: 'unlock', password: PASSWORD }); assert.equal(u.ok, true, JSON.stringify(u));
  const rec = await M.local.get(K.PBKDF2); assert.equal(rec.v, 2); assert.equal(rec.kdf, 'argon2id'); assert.equal(rec.iterations, undefined);
  const pwk = F.session.data[K.PASSWORD];
  const ks = H.idb().get(WID); const sk2 = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
  try { assert.equal(sk2.decryptMnemonic(new TextEncoder().encode(pwk)), PHRASE_ABOUT, 'phrase intact under the new key'); } finally { sk2.delete(); }
  const agents = await M.local.get(K.PERPS_AGENTS); assert.deepEqual(await M.passworder.decrypt(pwk, agents[`${WID}:0`].enc), { pk: AGENT }, 'perps agent re-keyed, not lost');
  const acc = await send({ type: 'getAccounts' }); assert.equal(acc.addresses.ethereum, ADDR0, 'account intact');
  // e) the legacy biometric seal (old keys, non-PRF) is gone; password unlock keeps working
  assert.equal(await M.local.get(K.PASSKEY), undefined); assert.equal(await M.local.get(K.PASSKEY_VAULT), undefined);
  assert.equal((await send({ type: 'passkeyStatus' })).enabled, false);
  // f) no v1 key material anywhere
  const everything = JSON.stringify([F.local.data, F.session.data, [...H.idb()]]);
  for (const k of [unlockKey, passwordKey]) assert.ok(!everything.includes(k), 'old v1 key not stored');
  assert.ok(F.alarms.some((a) => /auto-lock/.test(a.name ?? a[0] ?? '')), `auto-lock alarm armed: ${JSON.stringify(F.alarms)}`);
  // g) the pre-PT-06 WalletConnect session is ended and removed
  const wc = await send({ type: 'wcStatus' }); assert.deepEqual(wc.sessions, []);
  assert.deepEqual(Object.keys((await M.local.get('harbour:wc:sessions')) ?? {}), []);
  // h) the wallet still works end to end: lock → unlock again under v2
  await send({ type: 'lock' }); assert.equal((await send({ type: 'unlock', password: PASSWORD })).ok, true);
  assert.ok(!allStrings(u).includes(PHRASE_ABOUT));
});

test('T-X-007: a raw-seed device identity left by an old build is wiped and re-enrolled as a non-extractable WebCrypto key', async () => {
  const mem = { v: { kind: 'seed', seed: 'ab'.repeat(32), pub: 'legacy-pub', deviceId: 'legacy-dev' } }; const forgot = [];
  M.setDeviceStorage({ load: async () => mem.v, save: async (v) => { mem.v = v; }, forget: async () => { forgot.push(mem.v); mem.v = undefined; } });
  F.fetchImpl = async (url) => { const p = new URL(url).pathname; return new Response(JSON.stringify(p.endsWith('/challenge') ? { challenge: 'qa', difficulty: 0 } : { device_id: 'new-dev' }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const id = await M.deviceIdentity('http://127.0.0.1:8080');
  assert.equal(forgot.length, 1); assert.equal(forgot[0].kind, 'seed');
  assert.equal(mem.v.kind, 'webcrypto'); assert.equal(mem.v.priv.extractable, false); assert.equal(id.deviceId, 'new-dev');
  assert.ok(!JSON.stringify(mem.v).includes('ab'.repeat(32)), 'old seed not kept');
});
