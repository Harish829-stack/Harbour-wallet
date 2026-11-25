// QA (property): the rest of T-X-006 — data that is saved and loaded again must come back unchanged:
//  - vault state: any JSON state (unicode, nested, large) survives passworder encrypt/decrypt and a real VaultService persist/getState,
//    and a wrong key never reads it;
//  - keystore export/import: a wallet-core keystore (mnemonic and private-key) survives exportJSON -> JSON text -> importJSON with the
//    same id, name, account list and secret, and a VaultService-held list of keystores is identical after save, lock, unlock;
//  - history cursors: any cursor string the API may return (<= 2048 chars, any characters) reaches the next request URL byte for byte
//    and is accepted unchanged by the response check.
// PendingStore records / settled outcomes are in roundtrip.prop.test.js. TEST_PLAN: T-X-006.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { harness, CHEAP_ARGON2 } from './harness.mjs';

const H = await harness(`
  export * as passworder from './core/passworder';
  export { VaultService } from './core/vaultService';
  export { session, local, KEYS } from './core/storage';
  export { checkHistory } from './core/harbour/schema';
`);
const { M, core } = H;
const RUNS = Number(process.env.HB_FUZZ_RUNS ?? 60);
const te = new TextEncoder(), td = new TextDecoder();
const SECRET = 'k'.repeat(64);
const key = fc.string({ maxLength: 8 }).filter((k) => k !== '__proto__');
const json = fc.letrec((t) => ({ v: fc.oneof({ maxDepth: 4 }, fc.string({ unit: 'binary' }), fc.integer(), fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Object.is(n, -0)), fc.boolean(), fc.constant(null), fc.array(t('v'), { maxLength: 4 }), fc.dictionary(key, t('v'), { maxKeys: 4 })) })).v;

test('T-X-006: any JSON state round trips through passworder, and only the right key opens it', async () => {
  await fc.assert(fc.asyncProperty(json, async (state) => {
    const blob = await M.passworder.encrypt(SECRET, state);
    assert.deepEqual(await M.passworder.decrypt(SECRET, blob), JSON.parse(JSON.stringify(state)));
    await assert.rejects(M.passworder.decrypt('x'.repeat(64), blob), /Incorrect password/);
  }), { numRuns: RUNS });
});

test('T-X-006: a large vault (past the 32 KiB chunk size and past 1 MiB) is identical after encrypt/decrypt', async () => {
  for (const size of [32 * 1024 - 1, 32 * 1024, 32 * 1024 + 1, 70_000, 1_200_000]) {
    const state = { wallets: [{ name: 'é☃🙂'.repeat(10), blob: 'ab'.repeat(size / 2) }], n: size };
    assert.deepEqual(await M.passworder.decrypt(SECRET, await M.passworder.encrypt(SECRET, state)), state, String(size));
  }
});

test('T-X-006: VaultService state and staged keystores are identical after save, lock and unlock', async () => {
  await fc.assert(fc.asyncProperty(fc.uint8Array({ minLength: 16, maxLength: 16 }), fc.dictionary(key.filter((k) => k !== 'vaultId'), json, { maxKeys: 4 }), async (ent, extra) => {
    H.reset();
    const w = core.HDWallet.createWithEntropy(Buffer.from(ent), ''); const m = w.mnemonic(); w.delete();
    const vault = new M.VaultService(core, CHEAP_ARGON2);
    const pw = 'Round-Trip-Passw0rd!';
    const vaultId = await vault.create(pw, { wallets: [{ id: 'w1', name: 'Main', type: 'mnemonic' }], ...extra });
    const pwKey = await M.session.get(M.KEYS.PASSWORD);
    const sk = core.StoredKey.importHDWalletWithEncryption(m, 'Main', te.encode(pwKey), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
    const ks = JSON.parse(td.decode(sk.exportJSON())); sk.delete();
    await vault.update((s, tx) => { tx.stage('wallet:keystore:w1', ks); s.keystores = ['w1']; });
    const before = JSON.parse(JSON.stringify(await vault.getState()));
    await vault.lock();
    await vault.unlock(pw);
    const after = await vault.getState();
    assert.deepEqual(after, before);
    assert.equal(after.vaultId, vaultId);
    for (const [k, v] of Object.entries(extra)) assert.deepEqual(after[k], JSON.parse(JSON.stringify(v)));
    assert.deepEqual(await M.local.get('wallet:keystore:w1'), ks, 'the staged keystore is stored unchanged');
  }), { numRuns: 6, seed: 21 });
});

test('T-X-006: keystore export -> text -> import keeps id, name, accounts and secret (mnemonic and private-key wallets)', async () => {
  await fc.assert(fc.asyncProperty(fc.uint8Array({ minLength: 16, maxLength: 16 }), fc.uint8Array({ minLength: 32, maxLength: 32 }), fc.string({ minLength: 1, maxLength: 30 }), async (ent, raw, name) => {
    const P = te.encode('p'.repeat(64));
    const w = core.HDWallet.createWithEntropy(Buffer.from(ent), ''); const m = w.mnemonic();
    const sk = core.StoredKey.importHDWalletWithEncryption(m, name, P, core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
    for (const coin of [core.CoinType.ethereum, core.CoinType.bitcoin, core.CoinType.solana]) sk.accountForCoin(coin, w).delete();
    w.delete();
    const text = td.decode(sk.exportJSON()); const back = core.StoredKey.importJSON(te.encode(text));
    try {
      assert.equal(back.identifier(), sk.identifier()); assert.equal(back.name(), sk.name()); assert.equal(back.accountCount(), sk.accountCount());
      assert.equal(back.decryptMnemonic(P), m);
      assert.equal(td.decode(back.exportJSON()), text, 'a second export is byte-identical');
      for (let i = 0; i < sk.accountCount(); i++) { const a = sk.account(i), b = back.account(i); assert.equal(b.address(), a.address()); assert.equal(b.derivationPath(), a.derivationPath()); a.delete(); b.delete(); }
    } finally { sk.delete(); back.delete(); }
    if (core.PrivateKey.isValid(raw, core.Curve.secp256k1)) {
      const pk = core.StoredKey.importPrivateKeyWithEncryption(raw, name, P, core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
      const t2 = td.decode(pk.exportJSON()); const b2 = core.StoredKey.importJSON(te.encode(t2));
      try { assert.equal(Buffer.from(b2.decryptPrivateKey(P)).toString('hex'), Buffer.from(raw).toString('hex')); assert.equal(b2.account(0).address(), pk.account(0).address()); } finally { pk.delete(); b2.delete(); }
    }
  }), { numRuns: 6, seed: 22 });
});

const histRow = { chain: 'ethereum', address: '0xabc', tx_hash: '0x1', block_time: '2026-01-01T00:00:00Z', direction: 'in', finality: 'final', transfers: [] };
test('T-X-006: any cursor reaches the next request URL byte for byte and passes the response check unchanged', () => {
  fc.assert(fc.property(fc.string({ unit: 'binary', minLength: 1, maxLength: 2048 }), (cursor) => {
    const checked = M.checkHistory({ items: [histRow], cursor });
    assert.equal(checked.cursor, cursor, 'the response check keeps the cursor as is');
    const path = `/v1/me/history?${[`limit=50`, `cursor=${encodeURIComponent(checked.cursor)}`].join('&')}`; // the exact form built in getHistory
    assert.equal(new URL('https://x' + path).searchParams.get('cursor'), cursor, 'the server reads back the same cursor');
  }), { numRuns: 300 });
  assert.equal(M.checkHistory({ items: [histRow], cursor: null }).cursor, null);
  assert.throws(() => M.checkHistory({ items: [histRow], cursor: 'x'.repeat(2049) }));
});
