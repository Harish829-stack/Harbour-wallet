// E2E (node-level, full stack): the REAL extension service worker (bundled whole) ↔ the REAL Harbour Go API (Postgres + Redis) ↔ the
// deterministic mock chain. Only loopback network. Requires the env listed in stack.mjs; if any is missing every test reports SKIP with
// the missing variables (and `npm run test:e2e` fails), never a silent pass.
// TEST_PLAN: T-DATA-002, 004, 006, 009, 010, 013, 016, 017, 018, T-CH-009, 010, 017, 021, T-SIG-021, T-X-012 (node-level part), T-UX-028.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionFactory } from '@ethereumjs/tx';
import { harness, PASSWORD, PHRASE_ABOUT, PHRASE_LEGAL } from '../qa/harness.mjs';
import { startStack, stackRequirements } from './stack.mjs';

const realFetch = globalThis.fetch;
const missing = stackRequirements();
const ACC0 = '0x9858effd232b4033e47d90003d41ec34ecaeda94';
const ACC_LEGAL = '0x58a57ed9d8d624cbd12e2c467d34787555bb1b25';
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return null; await tick(400); } }; // gentle polling: the API rate-limits devices
let S, H, M, F; const apiCalls = [];
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const e2e = (name, fn) => test(name, missing.length ? { skip: `E2E stack not configured: ${missing.join(', ')}` } : {}, fn);

before(async () => {
  if (missing.length) return;
  S = await startStack({ funded: { [ACC0]: 10n ** 19n, [ACC_LEGAL]: 10n ** 18n }, established: true }); // quota limits of a new device: quota.test.js
  H = await harness(`
    import './background/index';
    export { deviceIdentity, resetDevice, setDeviceStorage } from './core/harbour/device';
    export { listAddresses, getPortfolio, getHistory, getMe, putAddresses } from './core/harbour/client';
    export { ACTIVITY_PENDING_ALARM } from './background/activityRuntime';
  `);
  ({ M, F } = H);
  H.reset();
  // Only loopback traffic reaches a real socket; everything else is refused (rule 4).
  F.fetchImpl = async (url, init) => {
    const u = new URL(url); if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new TypeError(`NETWORK_DISABLED_IN_TESTS (${u.host})`);
    u.hostname = '127.0.0.1'; apiCalls.push({ method: init?.method ?? 'GET', path: u.pathname, body: typeof init?.body === 'string' ? init.body : init?.body ? new TextDecoder().decode(init.body) : null });
    return realFetch(u.toString(), init);
  };
  const r = await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' });
  assert.equal(r.ok, true, JSON.stringify(r));
});
after(async () => { await S?.stop(); });

// ---------------------------------------------------------------- device identity (DATA-05)

e2e('T-DATA-006: first API use registers a non-extractable WebCrypto Ed25519 device key with proof of work; the real backend accepts it', async () => {
  const reg = await until(() => apiCalls.find((c) => c.method === 'POST' && c.path === '/v1/devices'));
  assert.ok(reg, 'registered'); const body = JSON.parse(reg.body);
  assert.deepEqual(Object.keys(body).sort(), ['challenge', 'pow_counter', 'public_key', 'signature']);
  const rec = await until(async () => { const m = H.idb('harbour-device'); const v = m.get('device'); return v?.deviceId ? v : null; });
  assert.equal(rec.kind, 'webcrypto'); assert.equal(rec.priv.extractable, false); assert.equal(rec.priv.algorithm.name, 'Ed25519');
  await assert.rejects(crypto.subtle.exportKey('pkcs8', rec.priv), 'private key cannot be exported');
  const me = await M.getMe(); assert.equal(me.device_id, rec.deviceId);
});

e2e('T-DATA-009 / T-DATA-010: concurrent first calls register once; a legacy raw-seed record is wiped and re-enrolled', async () => {
  // A separate module instance, so the worker's own device identity is untouched.
  const D = (await harness(`export { deviceIdentity, setDeviceStorage } from './core/harbour/device'; // isolated device module`)).M;
  const mem = { v: { kind: 'seed', seed: 'aa'.repeat(32), pub: 'legacy' } }; const forgot = [];
  D.setDeviceStorage({ load: async () => mem.v, save: async (v) => { mem.v = v; }, forget: async () => { forgot.push(mem.v); mem.v = undefined; } });
  const before = apiCalls.filter((c) => c.path === '/v1/devices').length;
  const ids = await Promise.all(Array.from({ length: 10 }, () => D.deviceIdentity('http://127.0.0.1:8080')));
  assert.equal(new Set(ids.map((i) => i.deviceId)).size, 1);
  assert.equal(apiCalls.filter((c) => c.path === '/v1/devices').length - before, 1, 'one registration for 10 concurrent callers');
  assert.equal(forgot.length, 1); assert.equal(forgot[0].kind, 'seed', 'legacy record removed');
  assert.equal(mem.v.kind, 'webcrypto'); assert.notEqual(mem.v.pub, 'legacy');
});

// ---------------------------------------------------------------- address sync (DATA-03)

e2e('T-DATA-004 / T-DATA-017: wallet changes sync exactly the EVM addresses to the backend; payload is {chain,address} only', async () => {
  const listed = await until(async () => { const r = await M.listAddresses(); return r.addresses.some((a) => a.address.toLowerCase() === ACC0) ? r : null; });
  assert.ok(listed, 'account 0 tracked');
  const puts = apiCalls.filter((c) => c.method === 'PUT' && c.path === '/v1/me/addresses');
  for (const p of puts) { const b = JSON.parse(p.body); for (const r of [...(b.add ?? []), ...(b.remove ?? [])]) assert.deepEqual(Object.keys(r).sort(), ['address', 'chain']); assert.deepEqual(Object.keys(b).filter((k) => !['add', 'remove'].includes(k)), []); }
  for (const p of puts) assert.ok(!/Main|wallet|label|account/i.test(p.body), 'no wallet names or grouping hints');
  await send({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'addWallet' });
  const add = await send({ type: 'addWallet', mnemonic: PHRASE_LEGAL }); assert.equal(add.ok, true);
  assert.ok(await until(async () => (await M.listAddresses()).addresses.some((a) => a.address.toLowerCase() === ACC_LEGAL)), 'new wallet tracked');
  await send({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'manage' });
  assert.equal((await send({ type: 'removeWallet', walletId: add.walletId })).ok, true);
  assert.ok(await until(async () => !(await M.listAddresses()).addresses.some((a) => a.address.toLowerCase() === ACC_LEGAL)), 'removed wallet untracked');
  const chains = new Set((await M.listAddresses()).addresses.map((a) => a.chain));
  for (const c of chains) assert.ok(!['solana', 'bitcoin', 'cosmos', 'tron'].includes(c), `only EVM chains tracked (${c})`);
});

e2e('T-DATA-018: ten rapid wallet changes produce debounced PUTs whose net effect equals the final state', async () => {
  const before = apiCalls.filter((c) => c.path === '/v1/me/addresses' && c.method === 'PUT').length;
  await send({ type: 'addAccount' }); await send({ type: 'addAccount' }); // 3 accounts × 18 networks = 54 refs: within the probation quota (100)
  for (let i = 0; i < 8; i++) await send({ type: 'switchAccount', index: i % 3 });
  await tick(2500);
  const puts = apiCalls.filter((c) => c.path === '/v1/me/addresses' && c.method === 'PUT').length - before;
  assert.ok(puts >= 1 && puts <= 3, `debounced: ${puts} PUTs for 10 changes`);
  const st = await send({ type: 'listWallets' });
  const want = new Set(st.wallets.flatMap((w) => w.accounts.map((a) => a.addresses.ethereum.toLowerCase())));
  const have = new Set((await M.listAddresses()).addresses.map((a) => a.address.toLowerCase()));
  assert.deepEqual([...have].sort(), [...want].sort());
});

e2e('T-DATA-016: real backend responses for portfolio / history / addresses pass the client schema checkers (two-sided contract)', async () => {
  const refs = [{ chain: 'sepolia', address: ACC0 }];
  const p = await M.getPortfolio(refs); assert.ok(Array.isArray(p.addresses) && typeof p.value_usd === 'number');
  const h = await M.getHistory(refs); assert.ok(Array.isArray(h.items));
  const a = await M.listAddresses(); assert.ok(a.addresses.every((x) => typeof x.backfill_state === 'string' && typeof x.synced === 'boolean'));
});

// ---------------------------------------------------------------- send (CH-05)

async function quote(amount = '0.01', to = '0x000000000000000000000000000000000000dEaD') {
  const q = await send({ type: 'sendQuote', chainId: 'sepolia', to, amount, tier: 'average' }); assert.equal(q.ok, true, JSON.stringify(q)); return q;
}
e2e('T-CH-009 / T-UX-028: sendQuote → sendSubmit broadcasts one signed transfer through the API to the chain; fee shown ≥ signed max fee', async () => {
  await send({ type: 'switchAccount', index: 0 });
  const q = await quote();
  const r = await send({ type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.01', tier: 'average', planHash: q.planHash });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.match(r.hash, /^0x[0-9a-f]{64}$/);
  const tx = await until(() => S.chain.txs.find((t) => t.hash === r.hash)); assert.ok(tx, 'on chain');
  assert.equal(tx.from, ACC0); assert.equal(tx.value, 10n ** 16n);
  assert.ok(apiCalls.some((c) => /^\/v1\/tx\/sepolia\/broadcast$/.test(c.path)), 'broadcast went through the Harbour API');
  const decoded = TransactionFactory.fromSerializedData(Buffer.from(tx.raw.slice(2), 'hex'));
  const tier = q.quote.tiers.find((t) => t.id === 'average');
  const signedMax = decoded.gasLimit * (decoded.type === 2 ? decoded.maxFeePerGas : decoded.gasPrice);
  assert.ok(BigInt(tier.feeMax ?? tier.fee) >= signedMax, `shown max fee ${tier.feeMax ?? tier.fee} ≥ signed ${signedMax}`);
});

e2e('T-CH-010: stale plan, amount above balance, unsupported chain and a locked wallet are refused and nothing is signed', async () => {
  const n0 = S.chain.txs.length;
  const q = await quote('0.02');
  assert.match((await send({ type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.03', tier: 'average', planHash: q.planHash })).error, /changed after you reviewed/);
  const big = await quote('100000');
  assert.ok(big.quote.issues.some((i) => i.blocking), 'quote flags insufficient funds');
  assert.equal((await send({ type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '100000', tier: 'average', planHash: big.planHash })).ok, false);
  assert.equal((await send({ type: 'sendQuote', chainId: 'not-a-chain', to: '0x000000000000000000000000000000000000dEaD', amount: '1' })).ok, false);
  await send({ type: 'lock' });
  assert.equal((await send({ type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.02', tier: 'average', planHash: q.planHash })).ok, false);
  await send({ type: 'unlock', password: PASSWORD });
  assert.equal(S.chain.txs.length, n0, 'nothing broadcast');
});

e2e('T-CH-021: the same prepared send submitted twice at once is signed and broadcast exactly once', async (t) => {
  const n0 = S.chain.txs.length; const q = await quote('0.001');
  const body = { type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.001', tier: 'average', planHash: q.planHash };
  const rs = await Promise.all([send(body), send(body)]);
  await tick(500);
  const sent = S.chain.txs.length - n0;
  t.diagnostic(`double submit → ${JSON.stringify(rs.map((r) => r.ok ? 'ok' : r.error))}, on chain: ${sent}`);
  if (sent > 1) { return assert.fail('T-CH-021 regression: ' + `double submit broadcast ${sent} transactions (nonces ${S.chain.txs.slice(n0).map((x) => x.nonce)})`); }
  assert.equal(sent, 1);
});

e2e('T-DATA-002: the broadcast is recorded as pending activity and the pending-activity alarm settles it from the receipt', async () => {
  const q = await quote('0.0005');
  const r = await send({ type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.0005', tier: 'average', planHash: q.planHash });
  assert.equal(r.ok, true);
  const docWith = () => Object.entries(F.local.data).find(([k, v]) => k.startsWith('activity:v1:') && k !== 'activity:v1:index' && k !== 'activity:v1:meta' && JSON.stringify(v).includes(r.hash));
  assert.ok(await until(async () => docWith()), 'activity row recorded for the broadcast');
  F.listeners['alarms.onAlarm'].forEach((f) => f({ name: M.ACTIVITY_PENDING_ALARM }));
  const settled = await until(async () => { const idx = F.local.data['activity:v1:index']; const d = docWith(); return d && !(idx?.pending ?? []).includes(d[0]) && /confirmed|success|"status":"ok"/i.test(JSON.stringify(d[1])) ? d : null; }, 15000);
  assert.ok(settled, `settled: ${JSON.stringify(docWith()?.[1] ?? null).slice(0, 300)}`);
});

e2e('T-DATA-013 / T-CH-017 / T-SIG-021: upstream 503s give a friendly error or a retry, never a double broadcast or raw text', async () => {
  S.chain.fail('eth_getTransactionCount', 50);
  const q = await send({ type: 'sendQuote', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.001', tier: 'average' });
  assert.ok(!q.ok || q.quote, JSON.stringify(q));
  if (!q.ok) assert.doesNotMatch(q.error, /https?:\/\/|503|upstream|TypeError/);
  S.chain.fail('eth_getTransactionCount', 0);
  const n0 = S.chain.txs.length; S.chain.fail('eth_sendRawTransaction', 1);
  const q2 = await quote('0.0007');
  const r = await send({ type: 'sendSubmit', chainId: 'sepolia', to: '0x000000000000000000000000000000000000dEaD', amount: '0.0007', tier: 'average', planHash: q2.planHash });
  await tick(300);
  assert.ok(S.chain.txs.length - n0 <= 1, 'at most one transaction');
  if (!r.ok) assert.doesNotMatch(r.error, /https?:\/\/|TypeError|stack/);
});
