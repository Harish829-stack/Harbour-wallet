// QA: the "dumb UI" secret boundary — backup, private-key reveal/copy, import checks, QR sync, ActiveKeys, uiSafe and log redaction.
// TEST_PLAN §KEY: T-KEY-064..075 (secret parts), 089, 091, 094, 096, 097, 105 (partial), 107, 111, 113, 114, 128, 133, T-SIG-024.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { privateKeyToAccount } from 'viem/accounts';
import { harness, PASSWORD, PHRASE_ABOUT, PHRASE_LEGAL, SRC, allStrings } from './harness.mjs';
import { fakeClock } from './known-bug.mjs';

const H = await harness(`
  export { handlers as walletH } from './background/modules/wallet';
  export { handlers as secretsH } from './background/handlers/secrets';
  export { handlers as onboardingH, _pendingCount } from './background/handlers/onboardingExtra';
  export { VaultService } from './core/vaultService';
  export { WalletService } from './core/walletService';
  export { openActiveKeys } from './background/keys';
  export { planBackup, checkPicks } from './core/backupSession';
  export { codeMatchesKey, isWellFormedKey, unminify } from './core/qrSync';
  export { decodePrivateKeyBytes } from './core/importKey';
  export { findSecretField, uiSafe } from './core/uiSafe';
  export { redact } from './core/logger';
  export { local, session, KEYS } from './core/storage';
`);
const { M, core, F } = H;
const W = M.walletH, X = M.secretsH, O = M.onboardingH;
const te = new TextEncoder();
const EIP155_KEY = '4646464646464646464646464646464646464646464646464646464646464646';
const WORDS = new Set(wordlist);

beforeEach(() => H.reset());
async function fresh(phrase = PHRASE_ABOUT) {
  const c = H.ctx();
  assert.equal((await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: phrase, name: 'Main' }, c)).ok, true);
  await M.session.remove(M.KEYS.MANAGE);
  return c;
}
const grant = (c, purpose = 'reveal', extra = {}) => W.revealAuth({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose, ...extra }, c);
const activeId = async (c) => (await c.vault.getState()).activeWalletId;
/** Every whole word of the 2048-word list found anywhere in a JSON value (keys and values, split on non-letters). */
const bip39WordsIn = (v) => allStrings(v).flatMap((s) => s.split(/[^a-z]+/)).filter((w) => w.length >= 3 && WORDS.has(w));
async function importKeyWallet(c) {
  await grant(c, 'addWallet');
  const init = await O.importInitiate({ secret: '0x' + EIP155_KEY, group: true }, c); assert.equal(init.ok, true, JSON.stringify(init));
  const done = await O.importComplete({ pendingId: init.pendingId, name: 'Imported' }, c); assert.equal(done.ok, true, JSON.stringify(done));
  return done;
}

// ---------------------------------------------------------------- backup (KEY-18)

test('T-KEY-067: backupBegin → backupCheck → backupFinish with a reveal grant clears the backup flag', async () => {
  const c = H.ctx();
  assert.equal((await W.createWallet({ type: 'createWallet', password: PASSWORD, newlyGenerated: true }, c)).ok, true);
  const id = await activeId(c);
  await grant(c);
  const b = await X.backupBegin({ walletId: id }, c);
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(b.wordCount, 12); assert.equal(b.chips.length, 12);
  assert.match(b.grid.src ?? b.grid.dataUrl ?? JSON.stringify(b.grid), /data:image\/png;base64,/);
  for (const ch of b.chips) assert.match(ch.id, /^[0-9a-f]{32}$/);
  const rec = F.session.data['wallet:backupSession'];
  assert.deepEqual(Object.keys(rec).sort(), ['chipClass', 'exp', 'id', 'posClass', 'walletId']);
  assert.ok(rec.posClass.every(Number.isInteger) && Object.values(rec.chipClass).every(Number.isInteger));
  // The painted strings are the phrase: use them to compute the right order without ever reading a word from a response.
  const words = F.painted.slice(0, 24).filter((s) => WORDS.has(s)); assert.equal(words.length, 12, 'grid painted the 12 words');
  const order = rec.posClass.map((cls, i) => i).map((i) => Object.keys(rec.chipClass).find((cid, _, all) => rec.chipClass[cid] === rec.posClass[i]));
  // order may reuse a chip when words repeat; resolve with unused chips
  const used = new Set(); const picked = rec.posClass.map((cls) => { const cid = Object.keys(rec.chipClass).find((k) => rec.chipClass[k] === cls && !used.has(k)); used.add(cid); return cid; });
  void order;
  assert.deepEqual(await X.backupCheck({ sessionId: b.sessionId, picked: picked.slice(0, 3) }), { ok: true, valid: true, complete: false, firstWrong: -1, count: 3 });
  assert.deepEqual(await X.backupFinish({ sessionId: b.sessionId, picked }, c), { ok: true, walletId: id });
  assert.equal((await c.vault.getState()).wallets[id].seedPhraseBackupRequired, false);
  assert.equal(F.session.data['wallet:backupSession'], undefined, 'session removed');
});

test('T-KEY-068: no BIP-39 word reaches the UI or session storage during backup; findSecretField is clean', async () => {
  const c = await fresh(PHRASE_LEGAL); const id = await activeId(c);
  await grant(c);
  const b = await X.backupBegin({ walletId: id }, c);
  assert.equal(b.ok, true);
  const phraseWords = new Set(PHRASE_LEGAL.split(' '));
  const values = (v) => allStrings(v).filter((s) => !s.startsWith('data:image/'));
  assert.deepEqual(bip39WordsIn(values(b)).filter((w) => phraseWords.has(w)), [], 'response holds no phrase word');
  assert.deepEqual(bip39WordsIn(values(F.session.data)).filter((w) => phraseWords.has(w)), [], 'session storage holds no phrase word');
  assert.equal(M.findSecretField(b), null);
  assert.ok(PHRASE_LEGAL.split(' ').every((w) => F.painted.includes(w)), 'the words exist only as painted pixels');
});

test('T-KEY-069: backupBegin refusals: no grant, locked, grant bound to another wallet, private-key wallet', async () => {
  const c = await fresh(); const id = await activeId(c);
  assert.equal((await X.backupBegin({ walletId: id }, c)).error, 'AUTH_REQUIRED');
  await grant(c, 'reveal', { walletId: 'someone-else' });
  assert.equal((await X.backupBegin({ walletId: id }, c)).error, 'AUTH_REQUIRED');
  const k = await importKeyWallet(c); await grant(c, 'reveal');
  assert.equal((await X.backupBegin({ walletId: k.walletId }, c)).error, 'This wallet has no secret phrase');
  await W.lock({}, c);
  assert.equal((await X.backupBegin({ walletId: id }, c)).error, 'LOCKED');
  assert.equal(F.painted.length, 0, 'nothing was rendered on any refusal');
});

test('T-KEY-070: backupFinish wrong order / wrong session / after 15 minutes', async () => {
  const c = await fresh(); const id = await activeId(c); await grant(c);
  const clk = fakeClock();
  try {
    const b = await X.backupBegin({ walletId: id }, c); const rec = F.session.data['wallet:backupSession'];
    const chips = Object.keys(rec.chipClass);
    const wrong = [...chips].sort((x, y) => rec.chipClass[x] - rec.chipClass[y]).reverse(); // abandon×11, about → reversed order is wrong at 0
    const r = await X.backupFinish({ sessionId: b.sessionId, picked: wrong }, c);
    assert.equal(r.error, 'BACKUP_MISMATCH'); assert.equal(r.firstWrong, 0);
    assert.equal((await X.backupFinish({ sessionId: 'f'.repeat(32), picked: chips }, c)).error, 'BACKUP_EXPIRED');
    clk.advance(15 * 60_000 + 1);
    assert.equal((await X.backupCheck({ sessionId: b.sessionId, picked: [] })).error, 'BACKUP_EXPIRED');
    assert.equal(F.session.data['wallet:backupSession'], undefined, 'expired session removed');
  } finally { clk.restore(); }
});

test('T-KEY-071: checkPicks accepts exactly the orders that map equal words to equal positions (property, repeated words)', () => {
  let n = 0; const id = () => `c${n++}`;
  fc.assert(fc.property(fc.array(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 12 }), fc.array(fc.nat(), { minLength: 12, maxLength: 12 }), (words, perm) => {
    const plan = planOf(words);
    const ids = plan.chips.map((c) => c.id);
    const order = [...ids].sort((x, y) => perm[ids.indexOf(x) % 12] - perm[ids.indexOf(y) % 12] || ids.indexOf(x) - ids.indexOf(y));
    const r = M.checkPicks(plan, order);
    const firstWrong = order.findIndex((cid, i) => words[plan.chips.find((c) => c.id === cid).index] !== words[i]);
    assert.equal(r.complete, firstWrong === -1); assert.equal(r.firstWrong, firstWrong);
    assert.equal(M.checkPicks(plan, [...order, order[0]]).valid, false, 'duplicate chip ids refused');
    assert.equal(M.checkPicks(plan, [1, 2]).valid, false, 'non-string ids refused');
    assert.equal(M.checkPicks(plan, ['__proto__']).valid, false, 'prototype keys are not chips');
  }), { numRuns: 300, seed: 9 });
  function planOf(words) { return M.planBackup(words, id, () => 0.5); }
});

// ---------------------------------------------------------------- private key reveal / copy (KEY-19)

test('T-KEY-072: revealPrivateKey paints the key (no key in the response), grants a 60 s copy, copy goes only to the offscreen port', async () => {
  const c = await fresh(); const k = await importKeyWallet(c);
  await grant(c, 'reveal', { walletId: k.walletId });
  const r = await X.revealPrivateKey({ walletId: k.walletId }, c);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.format, 'hex'); assert.equal(r.length, 64); assert.equal(r.visibleForMs, 60_000);
  assert.ok(!JSON.stringify(r).toLowerCase().includes(EIP155_KEY)); assert.equal(M.findSecretField(r), null);
  assert.ok(F.painted.join('').toLowerCase().includes(EIP155_KEY.slice(0, 16)), 'the key was painted');
  const cp = await X.copyPrivateKey({ walletId: k.walletId }, c);
  assert.deepEqual(cp, { ok: true, clearsInMs: 60_000 });
  assert.deepEqual(F.clipboard, [{ text: EIP155_KEY, clearAfterMs: 60_000 }]);
});

test('T-KEY-073: copyPrivateKey without a view, for another wallet, after 60 s, or after secretViewClosed → AUTH_REQUIRED', async () => {
  const c = await fresh(); const k = await importKeyWallet(c);
  assert.equal((await X.copyPrivateKey({ walletId: k.walletId }, c)).error, 'AUTH_REQUIRED');
  assert.equal((await X.revealPrivateKey({ walletId: k.walletId }, c)).error, 'AUTH_REQUIRED', 'reveal needs a grant');
  const clk = fakeClock();
  try {
    await grant(c, 'reveal'); assert.equal((await X.revealPrivateKey({ walletId: k.walletId }, c)).ok, true);
    assert.equal((await X.copyPrivateKey({ walletId: await activeId(c) === k.walletId ? 'other' : await activeId(c) }, c)).error, 'AUTH_REQUIRED');
    clk.advance(60_001);
    assert.equal((await X.copyPrivateKey({ walletId: k.walletId }, c)).error, 'AUTH_REQUIRED');
    clk.restore();
    await grant(c, 'reveal'); await X.revealPrivateKey({ walletId: k.walletId }, c);
    await X.secretViewClosed({}, c);
    assert.equal((await X.copyPrivateKey({ walletId: k.walletId }, c)).error, 'AUTH_REQUIRED');
    assert.equal(F.clipboard.length, 0);
  } finally { clk.restore(); }
});

test('T-KEY-074: the offscreen clipboard page overwrites the clipboard after the delay by its own timer (clamped 5 s..120 s)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes = []; const L = []; const posted = [];
  globalThis.document = { _h: null, addEventListener(_e, f) { this._h = f; }, removeEventListener() { this._h = null; },
    execCommand() { const ev = { clipboardData: { setData: (_t, v) => writes.push(v) }, preventDefault() {} }; this._h?.(ev); return true; } };
  const saved = globalThis.chrome.runtime.connect;
  globalThis.chrome.runtime.connect = () => ({ onMessage: { addListener: (f) => L.push(f) }, postMessage: (m) => posted.push(m) });
  try {
    await import(`data:text/javascript,${encodeURIComponent((await (await import('esbuild')).build({ entryPoints: [join(SRC, 'offscreen/clipboard.ts')], bundle: true, write: false, format: 'esm', logLevel: 'silent' })).outputFiles[0].text)}`);
    L[0]({ op: 'copy', id: 'a1', text: 'secret-key', clearAfterMs: 60_000 });
    assert.deepEqual(writes, ['secret-key']); assert.deepEqual(posted, [{ op: 'copied', id: 'a1', ok: true }]);
    t.mock.timers.tick(59_999); assert.deepEqual(writes, ['secret-key']);
    t.mock.timers.tick(1); assert.deepEqual(writes, ['secret-key', ''], 'cleared without any worker involvement');
    assert.deepEqual(posted.at(-1), { op: 'cleared' });
    L[0]({ op: 'copy', id: 'a2', text: 'x', clearAfterMs: 1 }); t.mock.timers.tick(4_999); assert.equal(writes.at(-1), 'x'); t.mock.timers.tick(1); assert.equal(writes.at(-1), '', 'min 5 s');
    L[0]({ op: 'copy', id: 'a3', text: 'y', clearAfterMs: 10 ** 9 }); t.mock.timers.tick(120_000); assert.equal(writes.at(-1), '', 'max 120 s');
    L[0]({ op: 'copy', id: 5, text: 'z' }); L[0]({ op: 'paste', id: 'q', text: 'z' }); assert.ok(!writes.includes('z'), 'malformed messages ignored');
  } finally { globalThis.chrome.runtime.connect = saved; delete globalThis.document; }
});

// ---------------------------------------------------------------- import (KEY-16, KEY-17)

test('T-KEY-064: importInitiate → importComplete with an EVM key: privateKey wallet, signs with that key, duplicate refused', async () => {
  const c = await fresh(); const k = await importKeyWallet(c);
  const st = await c.vault.getState();
  assert.equal(st.wallets[k.walletId].type, 'privateKey'); assert.equal(st.activeWalletId, k.walletId);
  assert.equal(k.addresses.ethereum, '0x9d8A62f656a8d1615C1294fd71e9CFb3E4855A4F');
  const keys = await M.openActiveKeys(core, c.vault, c.wallet);
  try { assert.equal(Buffer.from(keys.evmPrivateKey()).toString('hex'), EIP155_KEY); } finally { keys.dispose(); }
  await grant(c, 'addWallet');
  assert.equal((await O.importInitiate({ secret: EIP155_KEY, group: true }, c)).error, 'PRIVATE_KEY_DUPLICATED');
  assert.equal(M._pendingCount(), 0, 'nothing pending after completion/refusal');
});

test('T-KEY-065: decodePrivateKeyBytes never throws and returns null or the expected length (fuzz)', () => {
  fc.assert(fc.property(fc.oneof(fc.string(), fc.hexaString({ minLength: 60, maxLength: 70 }), fc.base64String(), fc.constant('0x' + EIP155_KEY)), fc.constantFrom('ethereum', 'solana', 'bitcoin', 'cosmos', 'tron'), (s, ct) => {
    const r = M.decodePrivateKeyBytes(core, s, ct);
    return r === null || (r instanceof Uint8Array && (r.length === 32 || r.length === 64));
  }), { numRuns: 1000, seed: 21 });
});

test('T-KEY-066: importCheck answers only {ok, kind, valid[, needsNetwork]} and stores nothing', async () => {
  const c = await fresh(); const before = JSON.stringify([F.local.data, F.session.data, [...H.idb().entries()]]);
  const out = [await X.importCheck({ secret: PHRASE_LEGAL }, c), await X.importCheck({ secret: EIP155_KEY }, c), await X.importCheck({ secret: EIP155_KEY, group: true }, c),
    await X.importCheck({ secret: 'hello world' }, c), await X.importCheck({ secret: 42 }, c)];
  for (const r of out) assert.ok(Object.keys(r).every((k) => ['ok', 'kind', 'valid', 'needsNetwork'].includes(k)), JSON.stringify(r));
  assert.equal(out[0].valid, true); assert.equal(out[1].needsNetwork, true); assert.equal(out[2].valid, true);
  assert.equal(JSON.stringify([F.local.data, F.session.data, [...H.idb().entries()]]), before);
});

// ---------------------------------------------------------------- ActiveKeys (KEY-23)

test('T-KEY-089: openActiveKeys on account #2 returns that account\'s key; dispose zero-fills returned bytes', async () => {
  const c = await fresh(); await W.addAccount({}, c); await W.addAccount({}, c);
  const keys = await M.openActiveKeys(core, c.vault, c.wallet);
  assert.equal(keys.derivationIndex, 2);
  const k = keys.evmPrivateKey();
  const ref = HDKey.fromMasterSeed(mnemonicToSeedSync(PHRASE_ABOUT, '')).derive("m/44'/60'/0'/0/2");
  assert.equal(Buffer.from(k).toString('hex'), Buffer.from(ref.privateKey).toString('hex'));
  assert.equal(privateKeyToAccount('0x' + Buffer.from(k).toString('hex')).address, keys.addresses.ethereum);
  const sol = keys.solanaKey(); assert.equal(sol.address, keys.addresses.solana);
  keys.dispose();
  assert.ok(k.every((b) => b === 0), 'returned key zeroed');
  assert.doesNotThrow(() => keys.dispose(), 'double dispose is safe');
});

test('T-KEY-091: openActiveKeys refuses while locked; a non-EVM private-key wallet has no EVM key', async () => {
  const c = await fresh(); await W.lock({}, c);
  await assert.rejects(M.openActiveKeys(core, c.vault, c.wallet), /Wallet is locked/);
  await W.unlock({ password: PASSWORD }, c);
  const st = await c.vault.getState(); const id = st.activeWalletId;
  st.wallets[id].type = 'privateKey'; st.wallets[id].accounts = [{ derivationIndex: 0, addresses: { solana: 'x' } }]; await c.vault.persist(st);
  const keys = await M.openActiveKeys(core, c.vault, c.wallet);
  try { assert.throws(() => keys.evmPrivateKey(), /no EVM account/); } finally { keys.dispose(); }
});

test('T-SIG-024: privateKeyFor refuses a key that does not match the requested address', async () => {
  const c = await fresh(); const keys = await M.openActiveKeys(core, c.vault, c.wallet);
  try {
    assert.throws(() => keys.privateKeyFor({ ct: 'ethereum', kind: 'evm' }, '0x0000000000000000000000000000000000000001'), /does not match/);
    const k = keys.privateKeyFor({ ct: 'polygon', kind: 'evm' }, keys.addresses.ethereum); assert.equal(k.length, 32); k.fill(0);
  } finally { keys.dispose(); }
});

// ---------------------------------------------------------------- QR sync (KEY-24)

async function stageExport(code, phrases = [PHRASE_LEGAL]) {
  const keys = phrases.map((p) => { const sk = core.StoredKey.importHDWalletWithEncryption(p, 'Phone', te.encode(code), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr); const j = JSON.parse(new TextDecoder().decode(sk.exportJSON())); sk.delete(); return { ...j, id: 'temporary-id' }; });
  const r = await X.qrStage({ storedKeys: keys }); assert.equal(r.ok, true); return r.stageId;
}

test('T-KEY-094: qrSyncImport with the right code and an addWallet grant imports the wallets and clears the stage', async () => {
  const c = await fresh(); const stageId = await stageExport('Ab12Cd');
  assert.deepEqual(await W.qrSyncImport({ code: 'Ab12Cd', stageId, dryRun: true }, c), { ok: true, count: 1, skipped: 0 });
  assert.equal((await W.qrSyncImport({ code: 'Ab12Cd', stageId }, c)).error, 'AUTH_REQUIRED');
  await grant(c, 'addWallet');
  assert.deepEqual(await W.qrSyncImport({ code: 'Ab12Cd', stageId }, c), { ok: true, imported: 1, duplicates: 0, skipped: 0 });
  assert.equal(F.session.data['wallet:qrStage'], undefined);
  assert.equal(Object.keys((await c.vault.getState()).wallets).length, 2);
});

test('T-KEY-096: malformed codes, expired stage and oversize stage are refused', async () => {
  const c = await fresh(); const stageId = await stageExport('Ab12Cd');
  for (const code of ['Ab12C', 'Ab12Cd7', 'Ab-2Cd', '', 'ÄÄÄÄÄÄ']) assert.equal((await W.qrSyncImport({ code, stageId }, c)).error, 'INCORRECT_CODE', code);
  const clk = fakeClock(Date.now() + 5 * 60_000 + 1);
  try { assert.equal((await W.qrSyncImport({ code: 'Ab12Cd', stageId }, c)).error, 'QR_EXPIRED'); } finally { clk.restore(); }
  assert.equal((await X.qrStage({ storedKeys: Array.from({ length: 101 }, () => ({})) })).ok, false);
  assert.equal((await X.qrStage({ storedKeys: [{ big: 'x'.repeat(1_000_001) }] })).ok, false);
});

test('T-KEY-097: isWellFormedKey never throws on arbitrary JSON and only accepts well-typed scrypt keystores', () => {
  const good = { type: 'mnemonic', crypto: { cipher: 'aes-128-ctr', cipherparams: { iv: 'aa'.repeat(16) }, ciphertext: 'bb'.repeat(32), kdf: 'scrypt', mac: 'cc'.repeat(32), kdfparams: { n: 16384, r: 8, p: 4, dklen: 32, salt: 'dd'.repeat(32) } } };
  assert.equal(M.isWellFormedKey(good), true);
  fc.assert(fc.property(fc.jsonValue(), (v) => M.isWellFormedKey(v) === false), { numRuns: 2000, seed: 4 });
  for (const mutate of [(k) => { k.crypto.kdf = 'pbkdf2'; }, (k) => { k.crypto.ciphertext = 'zz'; }, (k) => { k.crypto.kdfparams.n = '16384'; }, (k) => { k.type = 1; }, (k) => { k.crypto.cipher = 'aes-128-gcm'; }, (k) => { k.crypto.mac = 'a'.repeat(130); }]) {
    const k = structuredClone(good); mutate(k); assert.equal(M.isWellFormedKey(k), false);
  }
});

test('T-KEY-128: codeMatchesKey on the Web3 Secret Storage scrypt vector: right code true, wrong false, abusive params refused', async () => {
  const ks = { type: 'privateKey', crypto: { cipher: 'aes-128-ctr', cipherparams: { iv: '83dbcc02d8ccb40e466191a123791e0e' }, ciphertext: 'd172bf743a674da9cdad04534d56926ef8358534d458fffccd4e6ad2fbde479c', kdf: 'scrypt',
    kdfparams: { dklen: 32, n: 262144, r: 1, p: 8, salt: 'ab0c7876052600dd703518d6fc3fe8984592145b591fc8fb5c6d43190334ba19' }, mac: '2103ac29920d71da29f15d75b4a16dbe95cfd7ff8faea1056c33131d846e3097' } };
  assert.equal(await M.codeMatchesKey(ks, 'testpassword'), true);
  assert.equal(await M.codeMatchesKey(ks, 'testpassworD'), false);
  for (const kp of [{ n: 2 ** 21 }, { n: 1000 }, { r: 17 }, { p: 9 }, { dklen: 16 }, { n: 2 ** 20, r: 8 }]) {
    const k = structuredClone(ks); Object.assign(k.crypto.kdfparams, kp);
    const t0 = Date.now(); assert.equal(await M.codeMatchesKey(k, 'testpassword'), false, JSON.stringify(kp)); assert.ok(Date.now() - t0 < 200, 'refused before scrypt');
  }
  const budget = { spent: 2 ** 26 }; assert.equal(await M.codeMatchesKey(ks, 'testpassword', budget), false, 'total work budget enforced');
});

test('T-KEY-133: wrong codes sent in parallel destroy the stage after exactly five counted failures and import nothing', async () => {
  const c = await fresh(); const stageId = await stageExport('Ab12Cd'); await grant(c, 'addWallet');
  // Batches of 10 parallel wrong codes until the stage is gone. A code counts as CHECKED when it got INCORRECT_CODE or the final
  // QR_TOO_MANY_ATTEMPTS; everything after that must be refused as expired without running scrypt (BUG-07, fixed).
  const errors = [];
  for (let b = 0; b < 10 && F.session.data['wallet:qrStage']; b++) {
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => W.qrSyncImport({ code: `Zz${b}9Y${i}`, stageId }, c)));
    assert.ok(rs.every((r) => !r.ok)); errors.push(...rs.map((r) => r.error));
  }
  const checked = errors.filter((e) => e === 'INCORRECT_CODE' || e === 'QR_TOO_MANY_ATTEMPTS');
  assert.equal(checked.length, 5, `codes checked: ${errors.join(',')}`);
  assert.equal(errors.filter((e) => e === 'QR_TOO_MANY_ATTEMPTS').length, 1);
  assert.ok(errors.slice(5).every((e) => e === 'QR_EXPIRED'), 'later codes are refused, not checked');
  assert.equal(Object.keys((await c.vault.getState()).wallets).length, 1, 'nothing imported');
  assert.equal(F.session.data['wallet:qrStage'], undefined);
  // The right code after the stage is gone imports nothing either.
  assert.equal((await W.qrSyncImport({ code: 'Ab12Cd', stageId }, c)).ok, false);
});

test('T-KEY-133b: a right code after wrong ones refunds its strike and imports', async () => {
  const c = await fresh(); const stageId = await stageExport('Ab12Cd'); await grant(c, 'addWallet');
  for (let i = 0; i < 3; i++) assert.equal((await W.qrSyncImport({ code: `Zz9Y${i}0`, stageId, dryRun: true }, c)).error, 'INCORRECT_CODE');
  assert.equal(F.session.data['wallet:qrStage'].wrong, 3);
  const ok = await W.qrSyncImport({ code: 'Ab12Cd', stageId, dryRun: true }, c);
  assert.equal(ok.ok, true, JSON.stringify(ok)); assert.equal(F.session.data['wallet:qrStage'].wrong, 3, 'the right code costs no strike');
});

// ---------------------------------------------------------------- uiSafe / redact / logging (KEY-30, KEY-31)

test('T-KEY-107: findSecretField: every forbidden name in every casing, nesting to depth 5, arrays ≤ 500, cycles, falsy values', () => {
  const names = ['mnemonic', 'seedPhrase', 'secret_phrase', 'privateKey', 'secret-key', 'PASSWORD', 'passwordKey', 'unlock_key', 'xprv', 'storedKeys', 'KeyStore'];
  for (const n of names) {
    for (const v of [{ [n]: 'x' }, { a: { b: { c: { d: { [n]: 1 } } } } }, { list: [0, 1, { [n]: true }] }]) assert.equal(M.findSecretField(v), n, JSON.stringify(v));
    for (const falsy of [null, undefined, false]) assert.equal(M.findSecretField({ [n]: falsy }), null);
    assert.equal(M.findSecretField({ a: { b: { c: { d: { e: { f: { [n]: 'deep' } } } } } } }), null, 'depth > 5 not scanned (documented)');
    assert.equal(M.findSecretField({ list: [...Array(500).fill(0), { [n]: 1 }] }), null, 'only the first 500 items are scanned (documented)');
  }
  const cyc = { a: {} }; cyc.a.self = cyc; cyc.a.mnemonic = 'm'; assert.equal(M.findSecretField(cyc), 'mnemonic');
  const loop = { x: {} }; loop.x.y = loop; assert.equal(M.findSecretField(loop), null);
  for (const ok of ['publicKey', 'keystoreId', 'passwordHint', 'privacy', 'mnemonicValid', 'attributes']) assert.equal(M.findSecretField({ [ok]: 'v' }), null, ok);
  assert.deepEqual(M.uiSafe({ ok: true, privateKey: '00' }), { ok: false, error: 'SECRET_FIELD_BLOCKED', field: 'privateKey' });
});

test('T-KEY-113: redact never lets a 12–24 word BIP-39 phrase through, wherever it is embedded (property)', () => {
  fc.assert(fc.property(fc.integer({ min: 12, max: 24 }), fc.array(fc.nat(2047), { minLength: 24, maxLength: 24 }), fc.string(), fc.string(), (n, idx, pre, post) => {
    const phrase = idx.slice(0, n).map((i) => wordlist[i]).join(' ');
    const out = M.redact(`${pre} ${phrase} ${post}`);
    return !out.includes(phrase) && !out.includes(idx.slice(0, 12).map((i) => wordlist[i]).join(' '));
  }), { numRuns: 400, seed: 8 });
  assert.ok(!M.redact(`key 0x${EIP155_KEY}`).includes(EIP155_KEY));
  assert.ok(!M.redact('https://eth-mainnet.g.alchemy.com/v2/AbCdEfGhIjKlMnOpQrStUv123').includes('AbCdEfGhIjKlMnOpQrStUv123'));
  assert.ok(!M.redact('https://x.io/rpc?apikey=SECRET1').includes('SECRET1'));
});

test('T-KEY-114: no console.* call in src outside the logger (logging always goes through redact)', () => {
  const hits = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n) && !p.endsWith(join('core', 'logger.ts'))) {
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/\bconsole\.(log|error|warn|info|debug|trace)\s*\(/.test(l) && !/^\s*\/\//.test(l)) hits.push(`${p.slice(SRC.length)}:${i + 1}`); }); } } };
  walk(SRC);
  assert.deepEqual(hits, []);
});
