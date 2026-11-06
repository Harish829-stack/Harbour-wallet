// Onboarding import rules (private-key validation per curve, limits, duplicates, Solana variants, QR decrypt, idle/restore, backup verify)
// and the settings reducers. Network is mocked; Solana history lookups are "live-unverified" (no real RPC is called).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { writeFileSync, unlinkSync } from 'node:fs';
import pkg from '@trustwallet/wallet-core';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './core/importKey'; export * as rules from './core/onboardingRules'; export * as backup from './core/backupVerify'; export * as qr from './core/qrImport'; export * as sx from './core/settingsExtra'; export { applyPatch, DEFAULT_SETTINGS } from './core/settings'; export { ALL_CHAINS } from './core/chains/index';`, resolveDir: root, sourcefile: 'e.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', external: ['@ngraveio/bc-ur', 'pako'], nodePaths: [fileURLToPath(new URL('../node_modules', import.meta.url))], loader: { '.json': 'json' },
});
const tmp = fileURLToPath(new URL('./.onboarding-import.mjs', import.meta.url));
writeFileSync(tmp, out.outputFiles[0].text);
const M = await import(tmp + '?' + Date.now());
unlinkSync(tmp);
const core = await pkg.initWasm();
const hex = (u) => Buffer.from(u).toString('hex');

test('classifySecret: a single token longer than 8 chars is a private key, otherwise a phrase', () => {
  assert.equal(M.classifySecret(''), 'empty');
  assert.equal(M.classifySecret('   '), 'empty');
  assert.equal(M.classifySecret('abcdefgh'), 'mnemonic'); // 8 chars is not "longer than 8"
  assert.equal(M.classifySecret('abcdefghi'), 'privateKey');
  assert.equal(M.classifySecret('word word word'), 'mnemonic');
});

test('private-key validation uses the right curve per chain', () => {
  const evmKey = '0x' + '11'.repeat(32);
  assert.equal(M.validatePrivateKey(core, evmKey, 'ethereum').isValid, true);
  assert.equal(M.validatePrivateKey(core, '11'.repeat(32), 'smartChain').isValid, true, '0x prefix optional');
  assert.equal(M.validatePrivateKey(core, '00'.repeat(32), 'ethereum').isValid, false, 'zero is not a secp256k1 key');
  assert.equal(M.validatePrivateKey(core, 'ff'.repeat(32), 'ethereum').isValid, false, 'above the curve order');
  assert.equal(M.validatePrivateKey(core, 'zz'.repeat(32), 'ethereum').isValid, false);
  assert.equal(M.validatePrivateKey(core, '11'.repeat(31), 'ethereum').isValid, false, 'wrong length');
  // ed25519 (Solana): base58, 32 or 64 bytes
  const seed = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const b58 = core.Base58.encodeNoCheck(seed);
  assert.equal(M.validatePrivateKey(core, b58, 'solana').isValid, true);
  const kp = new Uint8Array(64); kp.set(seed); assert.equal(M.validatePrivateKey(core, core.Base58.encodeNoCheck(kp), 'solana').isValid, true, '64-byte keypair accepted');
  assert.equal(M.validatePrivateKey(core, hex(seed), 'solana').isValid, false, 'hex is not a Solana key');
  assert.equal(M.validatePrivateKey(core, 'not a key', 'solana').isValid, false);
  assert.equal(M.validatePrivateKey(core, evmKey, 'nosuchcoin').isValid, false);
});

test('network options: EVM group first, popular order, search and empty state', () => {
  const all = M.privateKeyNetworkOptions(M.ALL_CHAINS, '');
  assert.equal(all[0].kind, 'evm-group');
  assert.ok(all.some((o) => o.id === 'solana'));
  assert.ok(all.every((o) => o.id !== 'sepolia'), 'testnets are not offered');
  const sol = M.privateKeyNetworkOptions(M.ALL_CHAINS, 'sol');
  assert.ok(sol.some((o) => o.id === 'solana'));
  assert.deepEqual(M.privateKeyNetworkOptions(M.ALL_CHAINS, 'zzzz-no-such-network'), []);
});

test('wallet limit, names and duplicates', () => {
  assert.equal(M.MAX_WALLETS, 30);
  assert.equal(M.canCreateWallet(29), true);
  assert.equal(M.canCreateWallet(30), false);
  assert.equal(M.defaultWalletName([]), 'Main wallet');
  assert.equal(M.defaultWalletName(['Main wallet']), 'Main wallet 2');
  assert.equal(M.defaultWalletName(['Main wallet', 'Main wallet 2']), 'Main wallet 3');
  assert.equal(M.validateWalletName('', []).isValid, false);
  assert.equal(M.validateWalletName('A', ['A']).isValid, false);
  assert.equal(M.validateWalletName('x'.repeat(41), []).isValid, false);
  assert.equal(M.validateWalletName('B', ['A']).isValid, true);
  const wallets = { w1: { accounts: [{ addresses: { ethereum: '0xAbC0000000000000000000000000000000000001' } }] }, w2: { addresses: { solana: 'SoL1' } } };
  assert.equal(M.hasDuplicateAddress(wallets, 'ethereum', '0xabc0000000000000000000000000000000000001'), true, 'EVM compare is case-insensitive');
  assert.equal(M.hasDuplicateAddress(wallets, 'solana', 'SoL1'), true);
  assert.equal(M.hasDuplicateAddress(wallets, 'solana', 'sol1'), false, 'base58 is case-sensitive');
  assert.equal(M.hasDuplicateAddress(wallets, 'ethereum', ''), false);
});

test('Solana derivation choice follows activity', () => {
  assert.deepEqual(M.pickSolanaVariants([true, true]), ['default', 'phantom']);
  assert.deepEqual(M.pickSolanaVariants([true, false]), ['default']);
  assert.deepEqual(M.pickSolanaVariants([false, true]), ['phantom']);
  assert.deepEqual(M.pickSolanaVariants([false, false]), ['phantom']);
  assert.deepEqual(M.pickSolanaVariants(null), ['default']);
});

test('solanaHasHistory with a mocked RPC (live-unverified)', async () => {
  const f = async (_u, init) => { const a = JSON.parse(init.body).params[0]; return { ok: true, json: async () => ({ result: a === 'A' ? [{ signature: 's' }] : [] }) }; };
  assert.deepEqual(await M.solanaHasHistory(['A', 'B'], ['https://rpc.invalid'], f), [true, false]);
  const bad = async () => ({ ok: false, status: 500 });
  await assert.rejects(M.solanaHasHistory(['A'], ['https://a.invalid', 'https://b.invalid'], bad));
  let calls = 0; const flaky = async () => { if (calls++ === 0) throw new Error('down'); return { ok: true, json: async () => ({ result: [] }) }; };
  assert.deepEqual(await M.solanaHasHistory(['A'], ['https://a.invalid', 'https://b.invalid'], flaky), [false], 'falls through to the next endpoint');
});

test('idle guard: 600000 ms, 500 ms throttle, pause', () => {
  const { createIdleGuard, ONBOARDING_IDLE_MS, ONBOARDING_EVENT_THROTTLE_MS } = M.rules;
  assert.equal(ONBOARDING_IDLE_MS, 600000); assert.equal(ONBOARDING_EVENT_THROTTLE_MS, 500);
  let now = 0; const timers = []; let idle = 0;
  const g = createIdleGuard({ onIdle: () => idle++, now: () => now, setTimer: (fn, ms) => { const t = { fn, ms, off: false }; timers.push(t); return t; }, clearTimer: (t) => { t.off = true; } });
  g.start(); assert.equal(timers.length, 1); assert.equal(timers[0].ms, 600000);
  now = 100; g.activity(); assert.equal(timers.length, 1, 'throttled');
  now = 600; g.activity(); assert.equal(timers.length, 2); assert.equal(timers[0].off, true);
  timers[1].fn(); assert.equal(idle, 1);
  g.start(); g.pause(); assert.equal(g.running, false); now += 5000; g.activity(); assert.equal(timers.length, 3, 'no re-arm while paused');
});

test('onboarding mode and interrupted-setup recovery', () => {
  const { onboardingMode, restoreStep, serializeStep } = M.rules;
  assert.equal(onboardingMode({ hasVault: false, unlocked: false, walletCount: 0 }), 'first-wallet');
  assert.equal(onboardingMode({ hasVault: true, unlocked: false, walletCount: 0 }), 'locked');
  assert.equal(onboardingMode({ hasVault: true, unlocked: true, walletCount: 0 }), 'interrupted');
  assert.equal(onboardingMode({ hasVault: true, unlocked: true, walletCount: 3 }), 'additional-wallet');
  assert.equal(onboardingMode({ hasVault: true, unlocked: true, walletCount: 30 }), 'blocked');
  const raw = serializeStep({ step: 'secret', flow: 'import', source: 'other' }, 1000);
  assert.deepEqual(restoreStep(raw, 'additional-wallet', 2000), { step: 'secret', flow: 'import', source: 'other' });
  assert.equal(restoreStep(raw, 'first-wallet', 2000).step, 'welcome', 'a first-wallet user cannot resume mid-import');
  assert.equal(restoreStep(raw, 'blocked', 2000), null);
  assert.equal(restoreStep(raw, 'additional-wallet', 1000 + 600001), null, 'stale');
  assert.equal(restoreStep('{bad', 'additional-wallet'), null);
  assert.equal(restoreStep(serializeStep({ step: 'password', flow: 'create', source: 'other' }, 1), 'first-wallet', 2).step, 'welcome', 'password step is never restored');
});

test('camera errors map to the right message', () => {
  const { cameraErrorKind, CAMERA_MESSAGES, QR_SCAN_INTERVAL_MS } = M.rules;
  assert.equal(QR_SCAN_INTERVAL_MS, 80);
  assert.equal(cameraErrorKind({ name: 'NotAllowedError' }), 'denied');
  assert.equal(cameraErrorKind({ name: 'NotReadableError' }), 'in-use');
  assert.equal(cameraErrorKind({ name: 'NotFoundError' }), 'no-camera');
  assert.equal(cameraErrorKind(new TypeError('x')), 'unsupported');
  assert.equal(cameraErrorKind(null), 'other');
  assert.match(CAMERA_MESSAGES.denied, /camera access denied/i);
});

test('QR import decrypts phrase and private-key wallets, rejects wrong codes', async () => {
  const MNEMONIC = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
  const CODE = 'A1b2C3'; const pw = new TextEncoder().encode(CODE);
  const hd = core.StoredKey.importHDWalletWithEncryption(MNEMONIC, 'Phone', pw, core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
  const hdJson = JSON.parse(new TextDecoder().decode(hd.exportJSON())); hd.delete();
  const keyBytes = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const pk = core.StoredKey.importPrivateKeyWithEncryption(keyBytes, 'Key', pw, core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
  const pkJson = JSON.parse(new TextDecoder().decode(pk.exportJSON())); pk.delete();
  const r = await M.qr.decryptStoredKeys(core, [hdJson, pkJson], CODE);
  assert.equal(r.wrong, 0);
  const phrase = r.secrets.find((s) => s.kind === 'mnemonic'); assert.equal(phrase.mnemonic, MNEMONIC);
  const key = r.secrets.find((s) => s.kind === 'privateKey'); assert.equal(hex(key.bytes), hex(keyBytes)); assert.equal(key.coin, 'ethereum');
  const bad = await M.qr.decryptStoredKeys(core, [hdJson, pkJson], 'ZZZZZZ');
  assert.equal(bad.secrets.length, 0); assert.equal(bad.wrong, 2);
  const malformed = await M.qr.decryptStoredKeys(core, [{ nope: 1 }], CODE);
  assert.equal(malformed.skipped, 1);
  assert.equal((await M.qr.decryptStoredKeys(core, [hdJson], 'short')).wrong, 1, 'a malformed code is a wrong code');
});

test('private-key StoredKey round-trips with aes128Ctr and signs for its coin', () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, i) => 200 - i); const pw = new TextEncoder().encode('pw-123456');
  const sk = core.StoredKey.importPrivateKeyWithEncryption(bytes, 'k', pw, core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
  const json = JSON.parse(new TextDecoder().decode(sk.exportJSON())); sk.delete();
  assert.equal(json.crypto.cipher, 'aes-128-ctr');
  const back = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(json)));
  assert.equal(back.isMnemonic(), false);
  const key = back.privateKey(core.CoinType.ethereum, pw); assert.equal(hex(key.data()), hex(bytes)); key.delete(); back.delete();
});

test('backup verification: words must be picked in order', () => {
  const { shuffleWords, chipWord, verifySelection } = M.backup;
  const words = ['a', 'b', 'a', 'c'];
  const chips = shuffleWords(words, () => 0.3);
  assert.equal(chips.length, 4); assert.deepEqual(chips.map(chipWord).sort(), ['a', 'a', 'b', 'c']); assert.equal(new Set(chips).size, 4, 'duplicates stay distinct');
  assert.deepEqual(verifySelection(words, []), { complete: false, valid: true, firstWrong: -1 });
  assert.deepEqual(verifySelection(words, ['a', 'b']), { complete: false, valid: true, firstWrong: -1 });
  assert.equal(verifySelection(words, ['a', 'c']).firstWrong, 1);
  assert.equal(verifySelection(words, ['a', 'b', 'a', 'c']).complete, true);
});

// ---------------- settings reducers ----------------
test('wallet kinds and sections', () => {
  const { walletKind, groupWallets, canAddAccount, canBackupPhrase, canRevealPrivateKey } = M.sx;
  assert.equal(walletKind({}), 'mnemonic'); assert.equal(walletKind({ type: 'privateKey' }), 'privateKey'); assert.equal(walletKind({ type: 'ledger' }), 'hardware');
  assert.equal(canAddAccount({ type: 'privateKey' }), false); assert.equal(canAddAccount({ type: 'mnemonic' }), true); assert.equal(canAddAccount({ type: 'ledger' }), false);
  assert.equal(canBackupPhrase({ type: 'privateKey' }), false); assert.equal(canRevealPrivateKey({ type: 'privateKey' }), true);
  const g = groupWallets([{ id: '1', type: 'privateKey' }, { id: '2' }, { id: '3', type: 'ledger' }]);
  assert.deepEqual(g.map((x) => x.kind), ['mnemonic', 'privateKey', 'hardware']);
  assert.deepEqual(groupWallets([{ id: '2' }]).map((x) => x.kind), ['mnemonic'], 'empty sections omitted');
});

test('developer settings: testnets toggle and flags', () => {
  const { testnetsEnabled, setTestnetsHidden, DEVELOPER_FLAGS, isSafeFaucetUrl, FAUCETS } = M.sx;
  assert.equal(testnetsEnabled(['sepolia', 'x'], ['sepolia']), false);
  assert.equal(testnetsEnabled(['x'], ['sepolia']), true);
  assert.equal(testnetsEnabled([], []), false);
  assert.deepEqual(setTestnetsHidden(['x'], ['sepolia'], false), ['x', 'sepolia']);
  assert.deepEqual(setTestnetsHidden(['x', 'sepolia'], ['sepolia'], true), ['x']);
  assert.deepEqual(setTestnetsHidden(['sepolia'], ['sepolia'], false), ['sepolia'], 'no duplicates');
  const s = M.DEFAULT_SETTINGS('en');
  for (const f of DEVELOPER_FLAGS) { const n = M.applyPatch(s, { developerSettings: { [f.key]: true } }); assert.equal(n.developerSettings[f.key], true, f.key); }
  assert.equal(M.applyPatch(s, { developerSettings: { bogus: true } }).developerSettings.bogus, undefined);
  assert.equal(FAUCETS.length, 6); assert.ok(FAUCETS.every((f) => isSafeFaucetUrl(f.url)));
  assert.equal(FAUCETS.find((f) => f.chainId === 'arbitrum-sepolia').url.includes('arbitrum-sepolia'), true);
  assert.equal(isSafeFaucetUrl('javascript:alert(1)'), false); assert.equal(isSafeFaucetUrl('http://x.test'), false);
});

test('notification settings reducer keeps push and send/receive together', () => {
  const s = M.DEFAULT_SETTINGS('en');
  const off = M.applyPatch(s, { pushNotifications: { isPushEnabled: false } });
  assert.equal(off.pushNotifications.isPushEnabled, false); assert.equal(off.pushNotifications.isSendAndReceiveEnabled, false);
  const topic = M.applyPatch(s, { pushNotifications: { topics: { product_announcement: false, 'bad key!': true } } });
  assert.equal(topic.pushNotifications.topics.product_announcement, false); assert.equal(topic.pushNotifications.topics['bad key!'], undefined);
});

test('security migration: source -> destination -> assets', () => {
  const x = M.sx; let s = x.emptyMigration();
  assert.equal(x.canContinueFromSource(s), false);
  s = x.pickSource(s, 'a'); assert.equal(x.canContinueFromSource(s), true); assert.equal(x.canContinueFromDestination(s), false);
  assert.equal(x.pickDestination(s, 'a').destination, undefined, 'destination cannot equal source');
  s = x.pickDestination(s, 'b'); assert.equal(x.canContinueFromDestination(s), true); assert.equal(x.canMigrate(s), false);
  const assets = [{ id: 'ethereum', symbol: 'ETH', name: 'Ethereum', balance: '1.5', address: '0x1' }, { id: 'solana', symbol: 'SOL', name: 'Solana', balance: '0', address: 'S' }, { id: 'tron', symbol: 'TRX', name: 'Tron', balance: '0.000001', address: 'T' }];
  const movable = x.migratableAssets(assets); assert.deepEqual(movable.map((a) => a.id), ['ethereum', 'tron']);
  s = x.toggleAsset(s, 'ethereum'); assert.equal(x.canMigrate(s), true); assert.deepEqual(x.migrationQueue(s, movable).map((a) => a.id), ['ethereum']);
  s = x.toggleAsset(s, 'ethereum'); assert.equal(x.canMigrate(s), false);
  s = x.selectAllAssets(s, movable); assert.equal(s.selected.length, 2); s = x.selectAllAssets(s, movable); assert.equal(s.selected.length, 0);
  s = x.toggleAsset(x.pickDestination(x.pickSource(x.emptyMigration(), 'a'), 'b'), 'ethereum');
  const re = x.pickSource(s, 'b'); assert.equal(re.destination, undefined, 'new source equal to destination clears it'); assert.deepEqual(re.selected, [], 'asset choice is reset');
  assert.deepEqual(x.destinationOptions([{ id: 'a' }, { id: 'b' }, { id: 'c', type: 'ledger' }], 'a').map((w) => w.id), ['b'], 'hardware wallets cannot receive');
  assert.equal(x.hasPositiveBalance({ balance: '0.0' }), false);
});
