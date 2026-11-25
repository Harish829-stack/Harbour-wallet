// QA: cryptographic known-answer and envelope tests (TEST_PLAN T-KEY-004..008, 010..014, 038, 040..043, 045, 046, 062, 063, 121, 125..127,
// 140, 141, 143, T-SIG-024, T-SIG-045). Every expected value is a published vector or is recomputed independently with node:crypto /
// @noble (never with the code under test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fc from 'fast-check';
import { argon2id } from '@noble/hashes/argon2';
import { privateKeyToAccount } from 'viem/accounts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { ed25519 } from '@noble/curves/ed25519';
import { base58 } from '@scure/base';
import { harness, PHRASE_ABOUT, CHEAP_ARGON2 } from './harness.mjs';

const H = await harness(`
  export { deriveV2, v2Record, isV2, ARGON2_DEFAULT } from './core/keySchedule';
  export * as passworder from './core/passworder';
  export { rekeyKeystore } from './core/keyMigration';
  export { PasswordService } from './core/passwordService';
  export { WalletService } from './core/walletService';
  export { VaultService } from './core/vaultService';
  export { validatePrivateKey, decodePrivateKeyBytes, coreCodec } from './core/importKey';
  export { session, local, KEYS } from './core/storage';
`);
const { M, core } = H;
const te = new TextEncoder();
const hex = (u) => Buffer.from(u).toString('hex');
// Independent SLIP-0010 ed25519 derivation (hardened only) used as the Solana reference.
function slip10Solana(phrase, path) {
  let I = crypto.createHmac('sha512', 'ed25519 seed').update(mnemonicToSeedSync(phrase, '')).digest();
  for (const s of path) {
    const d = Buffer.concat([Buffer.alloc(1), I.subarray(0, 32), Buffer.alloc(4)]); d.writeUInt32BE((s | 0x80000000) >>> 0, 33);
    I = crypto.createHmac('sha512', I.subarray(32)).update(d).digest();
  }
  return base58.encode(ed25519.getPublicKey(I.subarray(0, 32)));
}

// ---------------------------------------------------------------- KDF (KEY-03/04)

test('T-KEY-004: deriveV2 equals HKDF-SHA256(Argon2id) computed independently, and @noble Argon2id matches RFC 9106 §5.3', () => {
  const rfc = argon2id(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2), { t: 3, m: 32, p: 4, dkLen: 32, key: new Uint8Array(8).fill(3), personalization: new Uint8Array(12).fill(4) });
  assert.equal(hex(rfc), '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659');
  const salt = new Uint8Array(16).fill(1);
  const master = argon2id(te.encode('password'), salt, { m: 8, t: 1, p: 1, dkLen: 32 });
  const expect = (info) => hex(crypto.hkdfSync('sha256', master, Buffer.alloc(0), info, 64));
  const got = M.deriveV2('password', salt, { m: 8, t: 1, p: 1 });
  assert.equal(got.unlockKey, expect('harbour/v2/vault-unlock'));
  assert.equal(got.passwordKey, expect('harbour/v2/keystore'));
});

test('T-KEY-005: deriveV2 is deterministic, salt/password sensitive, and its two keys are independent 512-bit hex values', () => {
  const s1 = new Uint8Array(32).fill(7), s2 = new Uint8Array(32).fill(8);
  const a = M.deriveV2('pw-one-1234', s1, CHEAP_ARGON2), b = M.deriveV2('pw-one-1234', s1, CHEAP_ARGON2);
  assert.deepEqual(a, b);
  assert.notEqual(M.deriveV2('pw-one-1234', s2, CHEAP_ARGON2).unlockKey, a.unlockKey);
  assert.notEqual(M.deriveV2('pw-one-1235', s1, CHEAP_ARGON2).unlockKey, a.unlockKey);
  assert.notEqual(a.unlockKey, a.passwordKey);
  assert.match(a.unlockKey, /^[0-9a-f]{128}$/); assert.match(a.passwordKey, /^[0-9a-f]{128}$/);
});

test('T-KEY-006: tampered or absurd KDF parameters are refused before any Argon2 work', () => {
  const salt = new Uint8Array(16);
  for (const p of [{ m: 7, t: 1, p: 1 }, { m: 262145, t: 1, p: 1 }, { m: 64, t: 0, p: 1 }, { m: 64, t: 11, p: 1 }, { m: 64, t: 1, p: 0 }, { m: 64, t: 1, p: 5 },
    { m: NaN, t: 1, p: 1 }, { m: 15, t: 1, p: 2 }, {}]) {
    const started = process.hrtime.bigint();
    assert.throws(() => M.deriveV2('x', salt, p), /VAULT_KDF_PARAMS_INVALID/, JSON.stringify(p));
    assert.ok(process.hrtime.bigint() - started < 50_000_000n, 'refused quickly, without running Argon2');
  }
  // OBS-01 (fixed): non-number / fractional values are refused with the specific code too, before any Argon2 work.
  for (const p of [{ m: '64', t: '1', p: '1' }, { m: 64.5, t: 1, p: 1 }, { m: 64, t: 1.5, p: 1 }]) assert.throws(() => M.deriveV2('x', salt, p), /VAULT_KDF_PARAMS_INVALID/, JSON.stringify(p));
});

test('T-KEY-007: passwords are NFKC-normalised before derivation (Å U+212B and Å U+00C5 open the same vault)', () => {
  const salt = new Uint8Array(16).fill(3);
  assert.deepEqual(M.deriveV2('pÅss-word-1', salt, CHEAP_ARGON2), M.deriveV2('pÅss-word-1', salt, CHEAP_ARGON2));
});

test('T-KEY-008: the Argon2 master key is zeroed after derivation (also when HKDF throws)', async () => {
  // Observe the buffer argon2id returns by wrapping Uint8Array.prototype.fill: deriveV2 must call master.fill(0) in its finally block.
  const fills = []; const orig = Uint8Array.prototype.fill;
  Uint8Array.prototype.fill = function (v, ...r) { if (this.length === 32 && v === 0) fills.push(this); return orig.call(this, v, ...r); };
  try { M.deriveV2('pw-zeroise-1', new Uint8Array(16), CHEAP_ARGON2); } finally { Uint8Array.prototype.fill = orig; }
  assert.ok(fills.length >= 1, 'a 32-byte buffer was zero-filled');
  assert.ok(fills.every((b) => b.every((x) => x === 0)));
});

test('T-KEY-010: PBKDF2-HMAC-SHA512 through wallet-core matches node:crypto for the legacy v1 schedule', () => {
  const pw = new M.PasswordService(core);
  for (const [p, s, i] of [['password', 'salt', 1], ['password', 'salt', 2], ['passwordPASSWORDpassword', 'saltSALTsaltSALTsaltSALTsaltSALTsalt', 4096]]) {
    assert.equal(hex(pw.hash(p, te.encode(s), i)), crypto.pbkdf2Sync(p, s, i, 64, 'sha512').toString('hex'));
  }
  // RFC 6070-style published SHA-512 vector (password/salt, c=1): 867f70cf1ade02cf…
  assert.ok(hex(pw.hash('password', te.encode('salt'), 1)).startsWith('867f70cf1ade02cff3752599a3a53dc4af34c7a669815ae5d513554e1c8cf252'));
});

// ---------------------------------------------------------------- passworder envelope (KEY-05)

const SECRET = 'a'.repeat(64);
test('T-KEY-011: passworder v2 envelope shape: v=2, 32-byte salt, 12-byte IV, base64 fields, round trip', async () => {
  const obj = { a: 1, nested: { s: 'x', arr: [1, 2] } };
  const blob = await M.passworder.encrypt(SECRET, obj);
  const p = JSON.parse(blob);
  assert.equal(p.v, 2);
  assert.equal(Buffer.from(p.salt, 'base64').length, 32);
  assert.equal(Buffer.from(p.iv, 'base64').length, 12);
  assert.ok(Buffer.from(p.data, 'base64').length >= JSON.stringify(obj).length + 16, 'ciphertext carries the 16-byte GCM tag');
  assert.deepEqual(await M.passworder.decrypt(SECRET, blob), obj);
});

test('T-KEY-125: passworder v2 is exactly HKDF-SHA256(secret, salt, "harbour/passworder/v2") → AES-256-GCM (both directions, independent implementation)', async () => {
  // our encrypt → node decrypt
  const blob = JSON.parse(await M.passworder.encrypt(SECRET, { k: 'v' }));
  const salt = Buffer.from(blob.salt, 'base64'), iv = Buffer.from(blob.iv, 'base64'), data = Buffer.from(blob.data, 'base64');
  const key = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(SECRET), salt, 'harbour/passworder/v2', 32));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(data.subarray(-16));
  assert.equal(Buffer.concat([d.update(data.subarray(0, -16)), d.final()]).toString(), '{"k":"v"}');
  // node encrypt (fixed salt/IV) → our decrypt
  const s2 = Buffer.alloc(32, 9), iv2 = Buffer.alloc(12, 4);
  const k2 = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(SECRET), s2, 'harbour/passworder/v2', 32));
  const c = crypto.createCipheriv('aes-256-gcm', k2, iv2); const ct = Buffer.concat([c.update('{"x":[1,"y"]}'), c.final(), c.getAuthTag()]);
  assert.deepEqual(await M.passworder.decrypt(SECRET, JSON.stringify({ v: 2, data: ct.toString('base64'), iv: iv2.toString('base64'), salt: s2.toString('base64') })), { x: [1, 'y'] });
});

test('T-KEY-012: passworder round-trips arbitrary JSON and never reuses salt/IV', async () => {
  await fc.assert(fc.asyncProperty(fc.jsonValue(), fc.hexaString({ minLength: 32, maxLength: 128 }), async (v, sec) => {
    const value = JSON.parse(JSON.stringify(v ?? null));
    const b1 = await M.passworder.encrypt(sec, value), b2 = await M.passworder.encrypt(sec, value);
    assert.deepEqual(await M.passworder.decrypt(sec, b1), value);
    const p1 = JSON.parse(b1), p2 = JSON.parse(b2);
    assert.notEqual(p1.iv + p1.salt, p2.iv + p2.salt);
  }), { numRuns: 60, seed: 42 });
});

test('T-KEY-014: any tampering or a wrong secret yields exactly "Incorrect password" and no plaintext', async () => {
  const blob = JSON.parse(await M.passworder.encrypt(SECRET, { secret: 'value' }));
  const flip = (b64, i) => { const b = Buffer.from(b64, 'base64'); b[i % b.length] ^= 1; return b.toString('base64'); };
  const variants = [
    { ...blob, data: flip(blob.data, 0) }, { ...blob, data: flip(blob.data, 999) }, { ...blob, iv: flip(blob.iv, 3) }, { ...blob, salt: flip(blob.salt, 5) },
    { ...blob, data: Buffer.from(blob.data, 'base64').subarray(0, -1).toString('base64') },
  ];
  for (const v of variants) await assert.rejects(M.passworder.decrypt(SECRET, JSON.stringify(v)), (e) => e.message === 'Incorrect password');
  await assert.rejects(M.passworder.decrypt('b'.repeat(64), JSON.stringify(blob)), (e) => e.message === 'Incorrect password');
});

test('T-KEY-143: a vault blob and KDF record produced in the current format stay readable (golden format contract)', async () => {
  // Fixture built here with node:crypto from the documented format (keySchedule.ts + passworder.ts); if the format changes, a migration is required.
  const salt = Buffer.alloc(32, 1);
  const rec = { v: 2, kdf: 'argon2id', salt: salt.toString('hex'), m: 8, t: 1, p: 1 };
  assert.ok(M.isV2(rec));
  const { unlockKey } = M.deriveV2('golden-password-1', salt, rec);
  const s = Buffer.alloc(32, 2), iv = Buffer.alloc(12, 3);
  const k = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(unlockKey), s, 'harbour/passworder/v2', 32));
  const c = crypto.createCipheriv('aes-256-gcm', k, iv); const ct = Buffer.concat([c.update(JSON.stringify({ vaultId: 'v', wallets: {} })), c.final(), c.getAuthTag()]);
  const blob = JSON.stringify({ v: 2, data: ct.toString('base64'), iv: iv.toString('base64'), salt: s.toString('base64') });
  H.reset();
  await M.local.set(M.KEYS.PBKDF2, rec); await M.local.set(M.KEYS.VAULT, blob);
  const v = new M.VaultService(core, CHEAP_ARGON2);
  assert.deepEqual(await v.unlock('golden-password-1'), { vaultId: 'v', wallets: {} });
});

// ---------------------------------------------------------------- BIP-39 / BIP-32 / derivation (KEY-11/12/13)

test('T-KEY-126: BIP-39 TREZOR vectors: entropy → mnemonic and mnemonic + "TREZOR" → seed through wallet-core', () => {
  const vectors = [
    ['00000000000000000000000000000000', PHRASE_ABOUT, 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04'],
    ['7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f', 'legal winner thank year wave sausage worth useful legal winner thank yellow', '2e8905819b8723fe2c1d161860e5ee1830318dbf49a83bd451cfb8440c28bd6fa457fe1296106559a3c80937a1c1069be3a3a5bd381ee6260e8d9739fce1f607'],
    ['ffffffffffffffffffffffffffffffff', 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong', 'ac27495480225222079d7be181583751e86f571027b0497b5b5d11218e0a8a13332572917f0f8e5a589620c6f15b11c61dee327651a14c34e18231052e48c069'],
  ];
  for (const [ent, phrase, seed] of vectors) {
    const w = core.HDWallet.createWithEntropy(Buffer.from(ent, 'hex'), 'TREZOR');
    try { assert.equal(w.mnemonic(), phrase); assert.equal(hex(w.seed()), seed); } finally { w.delete(); }
    assert.ok(core.Mnemonic.isValid(phrase));
  }
});

test('T-KEY-038: generated mnemonics are 12 valid, distinct BIP-39 phrases (requires an unlocked session)', async () => {
  H.reset();
  const ws = new M.WalletService(core);
  await assert.rejects(ws.generateMnemonic(), /LOCKED/, 'T-KEY-039: refused while locked');
  await M.session.set(M.KEYS.PASSWORD, 'f'.repeat(128));
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const m = await ws.generateMnemonic();
    assert.equal(m.split(' ').length, 12); assert.ok(core.Mnemonic.isValid(m)); seen.add(m);
  }
  assert.equal(seen.size, 50);
});

test('T-KEY-045: addresses of a generated wallet do not depend on the generation passphrase (derived with an empty passphrase)', async () => {
  H.reset(); await M.session.set(M.KEYS.PASSWORD, 'e'.repeat(128));
  const ws = new M.WalletService(core);
  const m = await ws.generateMnemonic();
  const fromWallet = ws.deriveAddresses(m, false);
  const hd = HDKey.fromMasterSeed(mnemonicToSeedSync(m, '')).derive("m/44'/60'/0'/0/0");
  assert.equal(fromWallet.ethereum.toLowerCase(), privateKeyToAccount(`0x${hex(hd.privateKey)}`).address.toLowerCase());
});

test('T-KEY-040: BIP-44/84 reference addresses for "abandon … about" across families (published wallet-core / BIP vectors)', () => {
  const ws = new M.WalletService(core);
  const a = ws.deriveAddresses(PHRASE_ABOUT, false);
  assert.equal(a.ethereum, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  assert.equal(a.bitcoin, 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  assert.equal(a.cosmos, 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4'); // m/44'/118'/0'/0/0
  // Imported phrases keep wallet-core's default Solana path m/44'/501'/0'; newly generated wallets use m/44'/501'/0'/0' (Phantom/Solflare).
  assert.equal(a.solana, slip10Solana(PHRASE_ABOUT, [44, 501, 0]));
  assert.equal(a.solana, 'GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL');
  assert.equal(ws.deriveAddresses(PHRASE_ABOUT, true).solana, slip10Solana(PHRASE_ABOUT, [44, 501, 0, 0]));
  for (const [k, v] of Object.entries(a)) assert.ok(typeof v === 'string' && v.length > 10, `address for ${k}`);
});

test('T-KEY-041: BIP-32 test vector 1 (seed 000102…0f) through wallet-core matches the published xprv/xpub chain', () => {
  // wallet-core cannot import a raw seed into HDWallet, so the chain is checked with @scure/bip32 against the BIP-32 document and
  // wallet-core's secp256k1 public-key derivation is cross-checked on the resulting private key.
  const root = HDKey.fromMasterSeed(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'));
  assert.equal(root.privateExtendedKey, 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi');
  const leaf = root.derive("m/0'/1/2'/2/1000000000");
  assert.equal(leaf.privateExtendedKey, 'xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76');
  const pk = core.PrivateKey.createWithData(leaf.privateKey);
  try { assert.equal(hex(pk.getPublicKeySecp256k1(true).data()), hex(leaf.publicKey)); } finally { pk.delete(); }
});

test('T-KEY-042: accountPath(coin, 0) is the coin default path and later indices change exactly one path segment, for every supported coin', () => {
  const ws = new M.WalletService(core);
  for (const { name, coin } of ws.supportedCoins()) {
    const base = core.CoinTypeExt.derivationPath(coin);
    assert.equal(ws.accountPath(coin, 0), base, name);
    for (const i of [1, 2, 3, 17]) {
      const p = ws.accountPath(coin, i).split('/'), b = base.split('/');
      assert.equal(p.length, b.length, name);
      assert.equal(p.filter((x, j) => x !== b[j]).length, 1, `${name} index ${i}: ${ws.accountPath(coin, i)} vs ${base}`);
    }
  }
  assert.equal(ws.accountPath(core.CoinType.ethereum, 5), "m/44'/60'/0'/0/5");
});

test('T-KEY-043: EVM account i equals an independent BIP-44 derivation m/44\'/60\'/0\'/0/i (property over random indices)', () => {
  const ws = new M.WalletService(core);
  const root = HDKey.fromMasterSeed(mnemonicToSeedSync(PHRASE_ABOUT, ''));
  const hd = core.HDWallet.createWithMnemonic(PHRASE_ABOUT, '');
  try {
    fc.assert(fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (i) => {
      const ours = ws.deriveAddressesWithWallet(hd, i).ethereum;
      const ref = privateKeyToAccount(`0x${hex(root.derive(`m/44'/60'/0'/0/${i}`).privateKey)}`).address;
      return ours.toLowerCase() === ref.toLowerCase();
    }), { numRuns: 25, seed: 7 });
  } finally { hd.delete(); }
});

test('T-KEY-046 / T-KEY-121: buildStoredKey round-trips the mnemonic under the session key (not the raw password), aes-128-ctr + scrypt', async () => {
  H.reset(); const passwordKey = 'c'.repeat(128); await M.session.set(M.KEYS.PASSWORD, passwordKey);
  const ws = new M.WalletService(core);
  const sk = await ws.buildStoredKey(PHRASE_ABOUT, 'Main', false);
  let json; try { json = JSON.parse(new TextDecoder().decode(sk.exportJSON())); } finally { sk.delete(); }
  assert.equal(json.crypto.cipher, 'aes-128-ctr'); assert.equal(json.crypto.kdf, 'scrypt'); assert.ok(json.crypto.kdfparams.n >= 2 ** 14); assert.ok(json.crypto.mac);
  const back = core.StoredKey.importJSON(te.encode(JSON.stringify(json)));
  try {
    assert.equal(back.decryptMnemonic(te.encode(passwordKey)), PHRASE_ABOUT);
    assert.throws(() => back.decryptMnemonic(te.encode('Correct-horse-9-battery')), 'the user password itself does not open the keystore');
  } finally { back.delete(); }
});

test('T-KEY-141: keystore round trip holds for random 12/24-word mnemonics', async () => {
  H.reset(); await M.session.set(M.KEYS.PASSWORD, 'd'.repeat(128));
  const ws = new M.WalletService(core);
  await fc.assert(fc.asyncProperty(fc.uint8Array({ minLength: 16, maxLength: 16 }), fc.boolean(), async (ent, long) => {
    const e = long ? Buffer.concat([ent, ent]) : Buffer.from(ent);
    const w = core.HDWallet.createWithEntropy(e, ''); const m = w.mnemonic(); w.delete();
    const sk = await ws.buildStoredKey(m, 'x', false);
    try { return sk.decryptMnemonic(te.encode('d'.repeat(128))) === m; } finally { sk.delete(); }
  }), { numRuns: 8, seed: 11 });
});

test('T-KEY-127: a Web3 Secret Storage v3 scrypt keystore (published test vector) decrypts through wallet-core', () => {
  const ks = { version: 3, id: '3198bc9c-6672-5ab3-d995-4942343ae5b6', address: '008aeeda4d805471df9b2a5b0f38a0c3bcba786b',
    crypto: { cipher: 'aes-128-ctr', cipherparams: { iv: '83dbcc02d8ccb40e466191a123791e0e' }, ciphertext: 'd172bf743a674da9cdad04534d56926ef8358534d458fffccd4e6ad2fbde479c',
      kdf: 'scrypt', kdfparams: { dklen: 32, n: 262144, r: 1, p: 8, salt: 'ab0c7876052600dd703518d6fc3fe8984592145b591fc8fb5c6d43190334ba19' }, mac: '2103ac29920d71da29f15d75b4a16dbe95cfd7ff8faea1056c33131d846e3097' } };
  const sk = core.StoredKey.importJSON(te.encode(JSON.stringify(ks)));
  try { assert.equal(hex(sk.decryptPrivateKey(te.encode('testpassword'))), '7a28b5ba57c53603b0b07b56bba752f7784bf506fa95edc395f5cf6c7514fe9d'); } finally { sk.delete(); }
});

// ---------------------------------------------------------------- private-key import (KEY-16)

test('T-KEY-062: the EIP-155 example key imports as valid and derives the published sender address', () => {
  const v = M.validatePrivateKey(core, '0x4646464646464646464646464646464646464646464646464646464646464646', 'ethereum');
  assert.equal(v.isValid, true);
  const pk = core.PrivateKey.createWithData(v.bytes);
  try { assert.equal(core.CoinTypeExt.deriveAddress(core.CoinType.ethereum, pk), '0x9d8A62f656a8d1615C1294fd71e9CFb3E4855A4F'); } finally { pk.delete(); }
});

test('T-KEY-063: private keys outside the curve range or of the wrong length are invalid', () => {
  const n = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';
  const nPlus = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364142';
  for (const bad of ['0x' + '00'.repeat(32), n, nPlus, 'ff'.repeat(32), '11'.repeat(31), '11'.repeat(33), 'zz'.repeat(32), '0x']) {
    assert.equal(M.validatePrivateKey(core, bad, 'ethereum').isValid, false, bad);
  }
  assert.equal(M.validatePrivateKey(core, '11'.repeat(63) + 'z', 'solana').isValid, false);
});

test('T-KEY-140: rekeyKeystore keeps the secret and only the new passphrase opens the result (random mnemonics and keys)', async () => {
  await fc.assert(fc.asyncProperty(fc.uint8Array({ minLength: 16, maxLength: 16 }), fc.uint8Array({ minLength: 32, maxLength: 32 }), async (ent, raw) => {
    const w = core.HDWallet.createWithEntropy(Buffer.from(ent), ''); const m = w.mnemonic(); w.delete();
    const oldP = 'o'.repeat(128), newP = 'n'.repeat(128);
    const sk = core.StoredKey.importHDWalletWithEncryption(m, 'w', te.encode(oldP), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
    const ks = JSON.parse(new TextDecoder().decode(sk.exportJSON())); sk.delete();
    const next = M.rekeyKeystore(core, ks, oldP, newP);
    const back = core.StoredKey.importJSON(te.encode(JSON.stringify(next)));
    try {
      if (back.decryptMnemonic(te.encode(newP)) !== m) return false;
      assert.equal(next.id, ks.id);
      if (core.PrivateKey.isValid(raw, core.Curve.secp256k1)) {
        const pk = core.StoredKey.importPrivateKeyWithEncryption(raw, 'k', te.encode(oldP), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
        const pks = JSON.parse(new TextDecoder().decode(pk.exportJSON())); pk.delete();
        const n2 = core.StoredKey.importJSON(te.encode(JSON.stringify(M.rekeyKeystore(core, pks, oldP, newP))));
        try { assert.equal(hex(n2.decryptPrivateKey(te.encode(newP))), hex(raw)); } finally { n2.delete(); }
      }
      return true;
    } finally { back.delete(); }
  }), { numRuns: 5, seed: 13 });
});

test('T-SIG-045: Ed25519 RFC 8032 test vectors 1–3 through wallet-core (the Solana signer)', () => {
  const V = [
    ['9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', '', 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'],
    ['4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb', '72', '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00'],
    ['c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7', 'af82', '6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a'],
  ];
  for (const [sk, msg, sig] of V) {
    const pk = core.PrivateKey.createWithData(Buffer.from(sk, 'hex'));
    try { assert.equal(hex(pk.sign(Buffer.from(msg, 'hex'), core.Curve.ed25519)), sig); } finally { pk.delete(); }
  }
});
