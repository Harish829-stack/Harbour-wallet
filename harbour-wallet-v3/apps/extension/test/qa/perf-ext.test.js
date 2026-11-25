// QA performance smoke tests for the extension worker (real worker code, fake browser surface, no network).
// TEST_PLAN: T-DAPP-053 (1000 reads from one page), T-EXT-039 (1000 store patches with the UI open), T-KEY-119 (30 wallets × keystores).
// Bounds are generous on purpose: they catch an algorithmic regression (quadratic fan-out, per-wallet work on every read), not CI noise.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`
  import './background/index';
  export { store, actions } from './background/store/index';
  export { handlers as walletH } from './background/modules/wallet';
  export { VaultService } from './core/vaultService';
  export { WalletService } from './core/walletService';
  export * as passworder from './core/passworder';
`);
const { M, core, F } = H;
const W = M.walletH;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];

function rpcNode(url, init) {
  let body; try { body = JSON.parse(init?.body ?? 'null'); } catch { body = null; }
  const one = (r) => ({ jsonrpc: '2.0', id: r?.id ?? 1, result: r?.method === 'eth_chainId' ? '0x1' : '0x10' });
  return new Response(JSON.stringify(Array.isArray(body) ? body.map(one) : one(body)), { status: 200, headers: { 'content-type': 'application/json' } });
}
function pagePort(origin, tabId = 501) {
  const L = { m: [], d: [] }; const out = [];
  const port = { name: 'harbour-provider', sender: { id: 'test', url: origin + '/app', origin, frameId: 0, documentId: 'doc-perf', tab: { id: tabId, url: origin + '/', title: 'Perf dApp' } },
    onMessage: { addListener: (f) => L.m.push(f), removeListener() {} }, onDisconnect: { addListener: (f) => L.d.push(f), removeListener() {} },
    postMessage: (m) => out.push(structuredClone(m)), disconnect() { L.d.forEach((f) => f()); } };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  return { out, req: (id, method) => L.m.forEach((f) => f({ id, ns: 'evm', method, params: [] })), close: () => L.d.forEach((f) => f()) };
}
function uiPort() {
  const L = { m: [], d: [] }; const out = [];
  const port = { name: 'harbour-ui', sender: INTERNAL, onMessage: { addListener: (f) => L.m.push(f) }, onDisconnect: { addListener: (f) => L.d.push(f) }, postMessage: (m) => out.push({ at: performance.now(), m: structuredClone(m) }), disconnect() {} };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  return { out, close: () => L.d.forEach((f) => f()) };
}

before(async () => {
  H.reset(); F.fetchImpl = rpcNode;
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});

test('T-DAPP-053: 1000 eth_blockNumber reads from one page are all answered; the origin read limit holds; nothing is left in flight', async () => {
  F.fetchImpl = rpcNode;
  const p = pagePort('https://perf-burst.example');
  const heap0 = process.memoryUsage().heapUsed;
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) p.req(`b${i}`, 'eth_blockNumber');
  const deadline = Date.now() + 60_000;
  while (p.out.filter((m) => m.t === 'res').length < 1000 && Date.now() < deadline) await tick(20);
  const res = p.out.filter((m) => m.t === 'res');
  const secs = (Date.now() - t0) / 1000;
  assert.equal(res.length, 1000, 'every request gets exactly one response (no timeouts, no drops)');
  assert.equal(new Set(res.map((r) => r.id)).size, 1000, 'no duplicate responses');
  const ok = res.filter((r) => r.result !== undefined), limited = res.filter((r) => r.error?.code === -32005), other = res.filter((r) => r.result === undefined && r.error?.code !== -32005);
  assert.equal(other.length, 0, `unexpected errors: ${JSON.stringify(other.slice(0, 2))}`);
  assert.ok(ok.length <= 120 + 60 * secs + 5, `served ${ok.length} reads in ${secs.toFixed(1)}s: more than the origin bucket (120 + 60/s) allows`);
  assert.ok(ok.length >= 100, `only ${ok.length} reads served: the limiter is stricter than its 120-token burst`);
  assert.equal(ok.length + limited.length, 1000);
  const heapGrowthMiB = (process.memoryUsage().heapUsed - heap0) / 2 ** 20;
  console.log(`# T-DAPP-053 burst: served ${ok.length}, limited ${limited.length}, ${secs.toFixed(2)}s, heap +${heapGrowthMiB.toFixed(1)} MiB`);
  assert.ok(heapGrowthMiB < 64, `heap grew ${heapGrowthMiB.toFixed(1)} MiB`);
  p.close();
});

test('T-DAPP-053: paced under the limit (40 reads/s) every read is served', async () => {
  F.fetchImpl = rpcNode;
  const p = pagePort('https://perf-paced.example', 502);
  const N = 200;
  for (let i = 0; i < N; i++) { p.req(`p${i}`, 'eth_blockNumber'); await tick(25); }
  const deadline = Date.now() + 10_000;
  while (p.out.filter((m) => m.t === 'res').length < N && Date.now() < deadline) await tick(10);
  const res = p.out.filter((m) => m.t === 'res');
  assert.equal(res.length, N);
  assert.equal(res.filter((r) => r.result === undefined).length, 0, 'no read refused when under the limit');
  p.close();
});

test('T-EXT-039: 1000 store patches with the popup open reach the UI port; p95 fan-out latency < 50 ms and only the changed slice is sent', async () => {
  const ui = uiPort(); await tick(50);
  const sent = new Map();
  for (let i = 1; i <= 1000; i++) { sent.set(i, performance.now()); M.store.dispatch(M.actions.live.patch({ balanceTick: 100000 + i })); await tick(0); }
  await tick(300);
  const patches = ui.out.filter((x) => x.m.kind === 'patch' && x.m.patch.live);
  assert.ok(patches.length > 0);
  const lat = [];
  for (const x of patches) { const t = sent.get(x.m.patch.live.balanceTick - 100000); if (t !== undefined) lat.push(x.at - t); assert.deepEqual(Object.keys(x.m.patch), ['live'], 'only the changed slice'); }
  const last = patches.at(-1).m.patch.live.balanceTick;
  assert.equal(last, 101000, 'the UI ends on the final value');
  console.log(`# T-EXT-039: ${patches.length} patch messages for 1000 dispatches, p50 ${pct(lat, 0.5).toFixed(2)} ms, p95 ${pct(lat, 0.95).toFixed(2)} ms`);
  assert.ok(pct(lat, 0.95) < 50, `p95 ${pct(lat, 0.95).toFixed(1)} ms`);
  ui.close();
});

test('T-KEY-119 (BUG-18 fixed): passworder.encrypt round-trips payloads up to 2 MB (past the engine argument limit)', async () => {
  const secret = 'k'.repeat(64);
  const sizes = [20_000, 60_000, 120_000, 250_000, 500_000, 2_000_000];
  const failed = [];
  for (const n of sizes) {
    const blob = { pad: 'x'.repeat(n) };
    try { const enc = await M.passworder.encrypt(secret, blob); assert.deepEqual(await M.passworder.decrypt(secret, enc), blob); }
    catch (e) { failed.push(`${n}B: ${e.constructor.name}`); }
  }
  assert.ok(!failed.some((f) => parseInt(f, 10) < 100_000), `payloads under 100 kB must always work: ${failed}`);
  if (failed.length) assert.fail('BUG-18 regression (fixed bug reproduces again): ' + `encrypt() throws for large payloads (${failed.join(', ')}): b64() spreads every ciphertext byte into String.fromCharCode(...bytes)`);
});

test('T-KEY-119: 30 wallets (real keystores) can be added; the vault locks, unlocks and lists in < 3 s in total (Argon2 cost excluded)', async () => {
  H.reset(); F.fetchImpl = rpcNode;
  const c = H.ctx();
  assert.equal((await W.createWallet({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'W0' }, c)).ok, true);
  let count = 1, firstFailure = null;
  for (let i = 1; i < 30; i++) {
    const hd = core.HDWallet.create(128, ''); const phrase = hd.mnemonic(); hd.delete();
    assert.equal((await W.revealAuth({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'addWallet' }, c)).ok, true);
    const r = await W.addWallet({ type: 'addWallet', mnemonic: phrase, name: `W${i}` }, c);
    if (!r.ok) { firstFailure = `wallet ${i + 1}: ${r.error}`; break; }
    count++;
  }
  const keystores = [...H.idb().keys()].filter((k) => /^[0-9a-f-]{36}$/i.test(k));
  assert.equal(firstFailure, null, 'BUG-18 regression: every add up to 30 wallets succeeds');
  assert.equal(count, 30);
  assert.equal(keystores.length, count, `${keystores.length} keystores for ${count} wallets (no orphan: BUG-04)`);
  const t0 = performance.now();
  await W.lock({}, c);
  const u = await W.unlock({ password: PASSWORD }, c);
  assert.ok(u.state, JSON.stringify(u));
  const st = await c.vault.getState();
  const list = await W.listWallets({}, c);
  const ms = performance.now() - t0;
  assert.equal(Object.keys(st.wallets).length, count);
  assert.equal(list.wallets.length, count);
  console.log(`# T-KEY-119: ${count} wallets: lock + unlock + getState + listWallets ${ms.toFixed(0)} ms`);
  assert.ok(ms < 3000, `${ms.toFixed(0)} ms`);
  let ms2 = 0; for (let i = 0; i < 20; i++) { const t1 = performance.now(); await c.vault.getState(); ms2 += performance.now() - t1; }
  assert.ok(ms2 / 20 < 100, `getState averages ${(ms2 / 20).toFixed(1)} ms with ${count} wallets`);
  if (firstFailure) assert.fail('BUG-18 regression (fixed bug reproduces again): ' + `the vault stops accepting wallets at ${count} of the 30 it advertises (${firstFailure})`);
});
