// QA: the UI never receives a secret through the 'harbour-ui' port (ASM-01). A popup port is subscribed BEFORE the wallet exists and
// stays open while the full set of secret-touching flows runs: create (generated and imported phrase), lock/unlock, phrase backup,
// private-key reveal and copy, private-key and phrase import, account add/switch, send quote/submit, swap quote. Requests go both
// through the port ({id,msg}) and through runtime messages (whose state changes reach the port as patches). Every message the port
// carried is deep-scanned for secret field names and secret VALUES.
// TEST_PLAN: T-KEY-109.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { harness, PASSWORD, PHRASE_ABOUT, PHRASE_LEGAL, allStrings } from './harness.mjs';

const require = createRequire(import.meta.url);
const WORDS = new Set(require('@scure/bip39/wordlists/english').wordlist);
const H = await harness(`
  import './background/index';
  export { findSecretField } from './core/uiSafe';
  export { KEYS } from './core/storage';
`);
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const IMPORTED_KEY = '4646464646464646464646464646464646464646464646464646464646464646';

function uiPort() {
  const L = { m: [] }; const out = []; let n = 1000;
  const port = { name: 'harbour-ui', sender: INTERNAL, onMessage: { addListener: (f) => L.m.push(f) }, onDisconnect: { addListener() {} }, postMessage: (m) => out.push(structuredClone(m)), disconnect() {} };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  return { out, async req(msg) { const id = ++n; L.m.forEach((f) => f({ id, msg })); for (let i = 0; i < 4000; i++) { const r = out.find((m) => m.kind === 'response' && m.id === id); if (r) return r.result; await tick(5); } throw new Error(`no response for ${msg.type}`); } };
}
const rt = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const evmKeys = (phrase, n = 3) => Array.from({ length: n }, (_, i) => Buffer.from(HDKey.fromMasterSeed(mnemonicToSeedSync(phrase, '')).derive(`m/44'/60'/0'/0/${i}`).privateKey).toString('hex'));
function longestWordRun(s) { let run = 0, best = 0; for (const w of s.toLowerCase().split(/[^a-z]+/).filter(Boolean)) { run = WORDS.has(w) ? run + 1 : 0; best = Math.max(best, run); } return best; }

test('T-KEY-109: across onboarding, unlock, backup, reveal, import, send and swap flows, no harbour-ui message carries a secret field or value', async (t) => {
  H.reset();
  F.fetchImpl = async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'offline in QA' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  const p = uiPort();
  const secrets = new Set([PASSWORD, PHRASE_ABOUT, PHRASE_LEGAL, IMPORTED_KEY, ...evmKeys(PHRASE_ABOUT), ...evmKeys(PHRASE_LEGAL)]);
  const grabSession = () => { for (const k of ['wallet:password', 'wallet:unlock']) if (typeof F.session.data[k] === 'string') secrets.add(F.session.data[k]); };

  // 1. generated wallet (the phrase is only ever painted; we learn it from the paint recorder)
  assert.equal((await p.req({ type: 'createWallet', password: PASSWORD, newlyGenerated: true })).ok, true);
  grabSession();
  const st = await p.req({ type: 'walletsDetailed' }); const genId = st.wallets?.[0]?.id ?? Object.keys((await rt({ type: 'status' })) ?? {})[0];
  // 2. lock / wrong password / unlock
  await rt({ type: 'lock' }); await p.req({ type: 'unlock', password: 'Wrong-pass-1' }); assert.equal((await p.req({ type: 'unlock', password: PASSWORD })).ok, true); grabSession();
  // 3. phrase backup (grid painted, chips only)
  assert.equal((await p.req({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'reveal', walletId: genId })).ok, true);
  const b = await p.req({ type: 'backupBegin', walletId: genId });
  assert.equal(b?.ok, true, `backupBegin: ${JSON.stringify(b).slice(0, 120)}`);
  const painted = F.painted.filter((s) => WORDS.has(s)); assert.ok(painted.length >= 12, 'grid painted the generated phrase'); secrets.add(painted.slice(0, 12).join(' '));
  for (const w of new Set(painted.slice(0, 12))) void w;
  if (b?.ok) await p.req({ type: 'backupCancel', sessionId: b.sessionId });
  // 5. imports: phrase and private key, through both channels
  await p.req({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'addWallet' });
  const i1 = await p.req({ type: 'importInitiate', secret: PHRASE_ABOUT }); assert.ok(i1?.pendingId, `phrase import: ${JSON.stringify(i1)}`); if (i1?.pendingId) await p.req({ type: 'importComplete', pendingId: i1.pendingId, name: 'Imported phrase' });
  await rt({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'addWallet' });
  const i2 = await rt({ type: 'importInitiate', secret: '0x' + IMPORTED_KEY, group: true }); assert.ok(i2?.pendingId, `key import: ${JSON.stringify(i2)}`); const i2done = await rt({ type: 'importComplete', pendingId: i2.pendingId, name: 'Imported key' }); Object.assign(i2, { walletId: i2done?.walletId });
  await p.req({ type: 'importCheck', secret: PHRASE_LEGAL });
  const keyId = i2.walletId ?? (await p.req({ type: 'walletsDetailed' })).wallets.find((w) => /Imported key/.test(w.name ?? w.label ?? ''))?.id;
  assert.ok(keyId, 'imported key wallet id');
  // 5b. private key reveal + copy (private-key wallets only)
  await p.req({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'reveal', walletId: keyId });
  const rv = await p.req({ type: 'revealPrivateKey', walletId: keyId }); assert.equal(rv.ok, true, `reveal ran: ${JSON.stringify(rv).slice(0, 200)}`); assert.equal((await p.req({ type: 'copyPrivateKey', walletId: keyId })).ok, true, 'copy ran');
  for (const c of F.clipboard) if (/^(0x)?[0-9a-f]{64}$/i.test(String(c?.text ?? ''))) secrets.add(c.text.replace(/^0x/, ''));
  assert.ok(F.clipboard.length >= 1, 'the key went to the offscreen clipboard');
  // 6. accounts
  await p.req({ type: 'addAccount' }); await rt({ type: 'addAccount' }); await p.req({ type: 'switchAccount', index: 0 });
  // 7. send and swap (network refused / RPC errors: the flows run to their failure paths)
  await p.req({ type: 'sendQuote', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.01', tier: 'average' });
  await p.req({ type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.01', tier: 'average', planHash: 'x' });
  await p.req({ type: 'swapQuote', from: 'ethereum', to: 'sepolia', amount: '0.1' });
  await p.req({ type: 'getAccounts' }); await p.req({ type: 'status' });
  await tick(50);

  assert.ok(p.out.length > 20, `port carried ${p.out.length} messages`);
  const kinds = p.out.reduce((a, m) => ((a[m.kind] = (a[m.kind] ?? 0) + 1), a), {});
  t.diagnostic(`port messages scanned: ${JSON.stringify(kinds)}; secret values checked: ${secrets.size}`);
  assert.ok(kinds.snapshot >= 1 && kinds.patch >= 1 && kinds.response >= 20, 'snapshot, patches and responses all seen');
  for (const [i, m] of p.out.entries()) {
    assert.equal(M.findSecretField(m), null, `message #${i} (${m.kind}) has a secret-named field`);
    const strs = allStrings(m);
    for (const s of strs) {
      const low = s.toLowerCase();
      for (const sec of secrets) assert.ok(!low.includes(sec.toLowerCase()), `message #${i} (${m.kind}${m.id ? ' ' + m.id : ''}) contains a secret value`);
      assert.ok(longestWordRun(s) < 6, `message #${i} (${m.kind}) contains a run of ${longestWordRun(s)} BIP-39 words`);
    }
  }
});
