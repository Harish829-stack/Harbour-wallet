// Audit "weak key derivation": new vaults use Argon2id; v1 (PBKDF2) vaults are upgraded on the first correct unlock, keystores and
// every other password-encrypted blob included, in one all-or-nothing write. Real wallet-core, in-memory storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pbkdf2Sync, createCipheriv, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pkg from '@trustwallet/wallet-core'; const { initWasm } = pkg;

const root = fileURLToPath(new URL('../src/', import.meta.url));
const fakeBrowser = `
const store = (g) => ({ get: async (k) => (k in g.data ? { [k]: JSON.parse(JSON.stringify(g.data[k])) } : {}), set: async (o) => { Object.assign(g.data, JSON.parse(JSON.stringify(o))); }, remove: async (k) => { delete g.data[k]; } });
const state = globalThis.__fake = { local: { data: {} }, session: { data: {} } };
export default { storage: { local: store(state.local), session: store(state.session) } };`;
const plugin = { name: 'fake', setup(b) {
  b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'fake', namespace: 'fake' }));
  b.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: fakeBrowser, loader: 'js' }));
} };
const out = await build({ stdin: { contents: `export { VaultService } from './core/vaultService'; export * as passworder from './core/passworder'; export { KEYS } from './core/storage';`, resolveDir: root, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', plugins: [plugin] });
const { VaultService, passworder, KEYS } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const core = await initWasm();
const F = () => globalThis.__fake;
const ARGON = { m: 8, t: 1, p: 1 }; // test speed only
const te = new TextEncoder(), td = new TextDecoder(), hex = (u) => Buffer.from(u).toString('hex');
const MNEMONIC = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const PK = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const PASSWORD = 'correct horse battery staple';

// The old (v1) passworder envelope, exactly as shipped before: PBKDF2-SHA256 10k -> AES-256-GCM, 16-byte IV.
function v1Encrypt(secret, obj) {
  const salt = randomBytes(32), iv = randomBytes(16);
  const key = pbkdf2Sync(Buffer.from(secret), salt, 10000, 32, 'sha256');
  const c = createCipheriv('aes-256-gcm', key, iv); const ct = Buffer.concat([c.update(JSON.stringify(obj)), c.final(), c.getAuthTag()]);
  return JSON.stringify({ data: ct.toString('base64'), iv: iv.toString('base64'), salt: salt.toString('base64') });
}
const pwBytes = (s) => te.encode(s);

function seedV1() {
  const salt = randomBytes(32);
  // the shipped v1 code encodes keys with wallet-core HexCoding, i.e. with a 0x prefix
  const passwordKey = core.HexCoding.encode(core.PBKDF2.hmacSha512(pwBytes(PASSWORD), salt, 20000, 64));
  const unlockKey = core.HexCoding.encode(core.PBKDF2.hmacSha512(pwBytes(PASSWORD), salt, 1000, 64)); // fewer iterations than prod: speed only
  const eth = core.CoinType.ethereum, aes = core.StoredKeyEncryption.aes128Ctr;
  const hd = core.StoredKey.importHDWalletWithEncryption(MNEMONIC, 'Main', pwBytes(passwordKey), eth, aes);
  const w = core.HDWallet.createWithMnemonic(MNEMONIC, ''); hd.accountForCoin(eth, w).delete(); w.delete();
  const pkKey = core.StoredKey.importPrivateKeyWithEncryption(PK, 'Imported', pwBytes(passwordKey), eth, aes);
  const ks1 = JSON.parse(td.decode(hd.exportJSON())), ks2 = JSON.parse(td.decode(pkKey.exportJSON()));
  const id1 = hd.identifier(), id2 = pkKey.identifier();
  hd.delete(); pkKey.delete();
  const state = { vaultId: 'v1', activeWalletId: id1, wallets: { [id1]: { type: 'mnemonic' }, [id2]: { type: 'privateKey' } } };
  F().local.data = {
    [KEYS.PBKDF2]: { salt: core.HexCoding.encode(salt), iterations: 1000 }, [KEYS.VAULT]: v1Encrypt(unlockKey, state), [KEYS.VAULT_ID]: { vaultId: 'v1' },
    [id1]: ks1, [id2]: ks2, [KEYS.wallets('v1')]: [id1, id2],
    [KEYS.PERPS_AGENTS]: { s1: { address: '0xabc', enc: v1Encrypt(passwordKey, { pk: '0x01' }), approvedAt: 1 } },
    [KEYS.PREDICTIONS_CREDS]: { s1: v1Encrypt(passwordKey, { key: 'k' }) },
    [KEYS.PASSKEY]: { credentialId: 'aa' }, [KEYS.PASSKEY_VAULT]: v1Encrypt('f'.repeat(64), { passwordKey, unlockKey }),
  };
  F().session.data = {};
  return { state, id1, id2, ks1, passwordKey };
}

test('new vaults use Argon2id and unlock again after a lock', async () => {
  F().local.data = {}; F().session.data = {};
  const v = new VaultService(core, ARGON);
  await v.create(PASSWORD, { wallets: {} }); await v.lock();
  assert.deepEqual({ ...F().local.data[KEYS.PBKDF2], salt: 'x' }, { v: 2, kdf: 'argon2id', salt: 'x', ...ARGON });
  assert.equal(JSON.parse(F().local.data[KEYS.VAULT]).v, 2);
  await assert.rejects(v.unlock('wrong password'), /Incorrect password/);
  assert.deepEqual(await v.unlock(PASSWORD), { vaultId: F().local.data[KEYS.VAULT_ID].vaultId, wallets: {} });
});

test('a v1 vault is upgraded on first unlock: same wallets, new keys, nothing left on the old keys', async () => {
  const { state, id1, id2, ks1, passwordKey: oldPw } = seedV1();
  const v = new VaultService(core, ARGON);
  assert.deepEqual(await v.unlock(PASSWORD), state);
  const d = F().local.data;
  assert.equal(d[KEYS.PBKDF2].v, 2); assert.equal(d[KEYS.PBKDF2].kdf, 'argon2id');
  assert.equal(JSON.parse(d[KEYS.VAULT]).v, 2);
  const newPw = F().session.data[KEYS.PASSWORD];
  assert.notEqual(newPw, oldPw);
  // Keystores: identity preserved, secret preserved, only the new passphrase opens them.
  const open = (ks, pw) => core.StoredKey.importJSON(te.encode(JSON.stringify(ks)));
  const hd = open(d[id1]); assert.equal(hd.identifier(), id1); assert.equal(hd.decryptMnemonic(pwBytes(newPw)), MNEMONIC);
  assert.throws(() => hd.decryptMnemonic(pwBytes(oldPw))); assert.equal(d[id1].name ?? ks1.name, ks1.name); assert.deepEqual(d[id1].activeAccounts, ks1.activeAccounts);
  const pk = open(d[id2]); assert.equal(pk.identifier(), id2); assert.deepEqual([...pk.decryptPrivateKey(pwBytes(newPw))], [...PK]);
  assert.throws(() => pk.decryptPrivateKey(pwBytes(oldPw)));
  // Other password-encrypted blobs follow.
  assert.deepEqual(await passworder.decrypt(newPw, d[KEYS.PERPS_AGENTS].s1.enc), { pk: '0x01' });
  assert.deepEqual(await passworder.decrypt(newPw, d[KEYS.PREDICTIONS_CREDS].s1), { key: 'k' });
  // The stale biometric blob (old keys) is cleared.
  assert.equal(d[KEYS.PASSKEY], undefined); assert.equal(d[KEYS.PASSKEY_VAULT], undefined);
  // And the upgraded vault works on the next unlock, with the same keystore passphrase.
  await v.lock(); assert.deepEqual(await v.unlock(PASSWORD), state); assert.equal(F().session.data[KEYS.PASSWORD], newPw);
});

test('a failed upgrade changes nothing and the wallet still unlocks on v1', async () => {
  const { state, id2 } = seedV1();
  F().local.data[id2].crypto.mac = '00'.repeat(32); // this keystore can no longer be decrypted, so the whole upgrade must abort
  const before = JSON.stringify(F().local.data);
  const v = new VaultService(core, ARGON);
  assert.deepEqual(await v.unlock(PASSWORD), state);
  const after = { ...F().local.data }; delete after[KEYS.THROTTLE]; // the attempt counter reset is expected
  assert.equal(JSON.stringify(after), before, 'no key was written');
  assert.equal(F().local.data[KEYS.PBKDF2].v, undefined);
});

test('a biometrics-only wallet can add a password: everything re-keyed, biometrics re-sealed, both unlock afterwards', async () => {
  const { state, id1, id2 } = seedV1();
  const v = new VaultService(core, ARGON);
  await v.unlock(PASSWORD); // upgrades to v2 and opens the session
  const SECRET = 'ab'.repeat(32), NEW = 'brand new password 42';
  await v.lock(); await assert.rejects(v.setPassword(NEW, SECRET), /LOCKED/);
  await v.unlock(PASSWORD);
  F().local.data[KEYS.PASSKEY_VAULT] = await passworder.encrypt(SECRET, { passwordKey: F().session.data[KEYS.PASSWORD], unlockKey: F().session.data[KEYS.UNLOCK] });
  F().local.data[KEYS.PASSKEY] = { credentialId: 'aa', isPasswordGenerated: true, createdAt: 1, scheme: 'prf-v1' };
  const oldPw = F().session.data[KEYS.PASSWORD], oldSalt = F().local.data[KEYS.PBKDF2].salt;
  await v.setPassword(NEW, SECRET);
  const d = F().local.data, newPw = F().session.data[KEYS.PASSWORD];
  assert.notEqual(newPw, oldPw); assert.notEqual(d[KEYS.PBKDF2].salt, oldSalt);
  const open = (ks) => core.StoredKey.importJSON(te.encode(JSON.stringify(ks)));
  assert.equal(open(d[id1]).decryptMnemonic(pwBytes(newPw)), MNEMONIC); assert.throws(() => open(d[id1]).decryptMnemonic(pwBytes(oldPw)));
  assert.deepEqual([...open(d[id2]).decryptPrivateKey(pwBytes(newPw))], [...PK]);
  assert.deepEqual(await passworder.decrypt(newPw, d[KEYS.PERPS_AGENTS].s1.enc), { pk: '0x01' });
  // Biometrics were re-sealed under the new keys and the wallet is no longer "password-less".
  assert.deepEqual(await passworder.decrypt(SECRET, d[KEYS.PASSKEY_VAULT]), { passwordKey: newPw, unlockKey: F().session.data[KEYS.UNLOCK] });
  assert.equal(d[KEYS.PASSKEY].isPasswordGenerated, false);
  // The new password unlocks; the old one no longer does.
  await v.lock(); assert.deepEqual(await v.unlock(NEW), state);
  await v.lock(); await assert.rejects(v.unlock(PASSWORD), /Incorrect password/);
});

test('HW-001: adding a password to a LEGACY biometrics-only wallet drops the user-handle seal instead of re-sealing it', async () => {
  seedV1(); const v = new VaultService(core, ARGON); await v.unlock(PASSWORD);
  const SECRET = 'ab'.repeat(32);
  F().local.data[KEYS.PASSKEY_VAULT] = await passworder.encrypt(SECRET, { passwordKey: F().session.data[KEYS.PASSWORD], unlockKey: F().session.data[KEYS.UNLOCK] });
  F().local.data[KEYS.PASSKEY] = { credentialId: 'aa', isPasswordGenerated: true, createdAt: 1 }; // no scheme = legacy
  await v.setPassword('brand new password 42', SECRET);
  assert.equal(F().local.data[KEYS.PASSKEY], undefined); assert.equal(F().local.data[KEYS.PASSKEY_VAULT], undefined);
  await v.lock(); await v.unlock('brand new password 42');
});

test('passworder refuses a human password and still reads the old envelope', async () => {
  await assert.rejects(passworder.encrypt('hunter2', {}), /high-entropy/);
  const secret = 'a'.repeat(64);
  assert.deepEqual(await passworder.decrypt(secret, v1Encrypt(secret, { ok: 1 })), { ok: 1 });
});
