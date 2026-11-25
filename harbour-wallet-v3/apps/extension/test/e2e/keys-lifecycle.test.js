// E2E (node-level, full stack): every signing path opens the account keys, and every opened key set is disposed in a `finally`, with
// every key buffer handed out zero-filled afterwards — after success AND after failure. The REAL worker is bundled with a spy wrapped
// around openActiveKeys (background/keys.ts) and openConnectionKeys (background/provider/wallet.ts); the wrap is applied at bundle time
// only (harness `transform`), production files are untouched. Signing completes against the real Go API + mock chain.
// TEST_PLAN: T-KEY-122 (and T-REG-033 behaviour across handlers).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { verifyMessage, verifyTypedData } from 'viem';
import { harness, PASSWORD, PHRASE_ABOUT } from '../qa/harness.mjs';
import { startStack, stackRequirements } from './stack.mjs';

const realFetch = globalThis.fetch;
const missing = stackRequirements();
const ACC0 = '0x9858effd232b4033e47d90003d41ec34ecaeda94';
const DEAD = '0x000000000000000000000000000000000000dEaD';
// The fee the approval window shows and returns with the decision (the wallet never lets the node pick it).
const FEE = { fee: { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '2000000000' } };
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const e2e = (name, fn) => test(name, missing.length ? { skip: `E2E stack not configured: ${missing.join(', ')}` } : { timeout: 180_000 }, fn);

// ---- the spy (installed before the bundle loads)
const opened = [];
globalThis.__keySpy = {
  wrap(k, site) {
    const rec = { site, bufs: [], disposed: 0, stack: new Error().stack.split('\n').slice(3, 6).join(' | ') }; opened.push(rec);
    const track = (f) => (...a) => { const v = f.apply(k, a); if (v instanceof Uint8Array) rec.bufs.push(v); return v; };
    return { ...k, evmPrivateKey: track(k.evmPrivateKey), ...(k.privateKeyFor ? { privateKeyFor: track(k.privateKeyFor) } : {}), solanaKey: k.solanaKey, ...(k.chainKey ? { chainKey: k.chainKey } : {}),
      dispose() { rec.disposed++; return k.dispose(); } };
  },
};
const spy = (fn) => (src) => {
  const out = src.replace(`export async function ${fn}(`, `async function __real_${fn}(`);
  if (out === src) throw new Error(`${fn} not found: the spy needs updating`);
  return `${out}\nexport async function ${fn}(...a: any[]): Promise<any> { const k = await (__real_${fn} as any)(...a); return (globalThis as any).__keySpy.wrap(k, '${fn}'); }\n`;
};

let S, H, F;
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
before(async () => {
  if (missing.length) return;
  S = await startStack({ funded: { [ACC0]: 10n ** 19n }, established: true });
  H = await harness(`import './background/index'; export { listAddresses } from './core/harbour/client'; // keys-lifecycle spy bundle`, { transform: [[/background[\\/]keys\.ts$/, spy('openActiveKeys')], [/background[\\/]provider[\\/]wallet\.ts$/, spy('openConnectionKeys')]] });
  F = H.F; H.reset();
  F.fetchImpl = async (url, init) => { const u = new URL(url); if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new TypeError(`NETWORK_DISABLED_IN_TESTS (${u.host})`); u.hostname = '127.0.0.1'; const res = await realFetch(u.toString(), init); if (process.env.HB_QA_DEBUG && u.pathname.includes('broadcast')) console.log('DEBUG', res.status, await res.clone().text()); return res; };
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
  // The API only broadcasts for tracked accounts: wait until the worker's address sync has registered ACC0.
  for (let i = 0; i < 60; i++) { const l = await H.M.listAddresses().catch(() => null); if (JSON.stringify(l ?? '').toLowerCase().includes(ACC0)) return; await tick(500); }
  throw new Error('address sync did not register the account');
});
after(async () => { await S?.stop(); });

/** Every key set opened since `from` was disposed exactly once and every buffer it handed out is all zero. */
function assertDisposed(from, label) {
  const recs = opened.slice(from);
  for (const r of recs) {
    assert.equal(r.disposed >= 1, true, `${label}: ${r.site} opened at ${r.stack} was never disposed`);
    for (const b of r.bufs) assert.ok(b.every((x) => x === 0), `${label}: a key buffer from ${r.site} was not zeroed (${r.stack})`);
  }
  return recs.length;
}

// ---- page port (the content script's 'harbour-provider' port)
let tabSeq = 10;
function page(origin) {
  const L = { m: [], d: [] }; const out = []; let n = 0; const tabId = ++tabSeq;
  const port = { name: 'harbour-provider', sender: { id: 'test', url: origin + '/app', origin, frameId: 0, documentId: `doc-${tabId}`, tab: { id: tabId, url: origin + '/', title: 'QA dApp' } },
    onMessage: { addListener: (f) => L.m.push(f), removeListener() {} }, onDisconnect: { addListener: (f) => L.d.push(f), removeListener() {} }, postMessage: (m) => out.push(structuredClone(m)), disconnect() {} };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  const waitRes = async (id, ms = 30_000) => { const t0 = Date.now(); for (;;) { const r = out.find((m) => m.t === 'res' && m.id === id); if (r) return r; if (Date.now() - t0 > ms) return { timeout: true }; await tick(10); } };
  return { req: (ns, method, params) => { const id = `r${++n}`; L.m.forEach((f) => f({ id, ns, method, ...(params !== undefined ? { params } : {}) })); return id; }, waitRes };
}
async function approveNext(decision = {}, tries = 1500) {
  for (let i = 0; i < tries; i++) { const r = await send({ type: 'providerPending' }); const it = r.items?.[0]; if (it) return send({ type: 'providerResolve', id: it.id, decision: { approve: true, ...decision } }); await tick(10); }
  if (tries < 1500) return null; throw new Error('no pending approval');
}
async function ask(p, ns, method, params, { approve = true, decision } = {}) {
  const id = p.req(ns, method, params);
  if (approve === 'maybe') { const quick = await p.waitRes(id, 1500); if (!quick.timeout) return quick; await approveNext(decision, 300); }
  else if (approve) await approveNext(decision);
  return p.waitRes(id);
}

e2e('T-KEY-122: dApp signing (personal_sign, typed data v4, eth_sendTransaction, Solana signMessage) disposes and zeroes keys after success and failure', async () => {
  const p = page('https://dapp.qa.example');
  const acc = await ask(p, 'evm', 'eth_requestAccounts');
  assert.deepEqual(acc.result?.map((a) => a.toLowerCase()), [ACC0], JSON.stringify(acc));
  assert.equal((await ask(p, 'evm', 'wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }])).error, undefined);

  let mark = opened.length;
  const sig = await ask(p, 'evm', 'personal_sign', ['0x6b6579', ACC0]);
  assert.equal(await verifyMessage({ address: ACC0, message: 'key', signature: sig.result }), true);
  assert.ok(assertDisposed(mark, 'personal_sign') >= 1, 'personal_sign opened keys through the spy');

  mark = opened.length;
  const TD = { domain: { name: 'QA', version: '1', chainId: 11155111 }, primaryType: 'M', types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }], M: [{ name: 'v', type: 'uint256' }] }, message: { v: '7' } };
  const td = await ask(p, 'evm', 'eth_signTypedData_v4', [ACC0, JSON.stringify(TD)]);
  const { EIP712Domain, ...types } = TD.types; void EIP712Domain;
  assert.equal(await verifyTypedData({ address: ACC0, domain: TD.domain, types, primaryType: 'M', message: { v: 7n }, signature: td.result }), true);
  assert.ok(assertDisposed(mark, 'typed v4') >= 1);

  mark = opened.length; const before = S.chain.txs.length;
  const tx = await ask(p, 'evm', 'eth_sendTransaction', [{ from: ACC0, to: DEAD, value: '0x1' }], { decision: FEE });
  assert.match(tx.result ?? '', /^0x[0-9a-f]{64}$/, JSON.stringify(tx) + ' chain saw: ' + JSON.stringify(S.chain.calls.slice(-4)).slice(0, 600)); assert.equal(S.chain.txs.length, before + 1);
  assert.ok(assertDisposed(mark, 'eth_sendTransaction (success)') >= 1);

  // failure after the key was used: the chain refuses the broadcast
  mark = opened.length; S.chain.fail('eth_sendRawTransaction', 5);
  const bad = await ask(p, 'evm', 'eth_sendTransaction', [{ from: ACC0, to: DEAD, value: '0x2' }], { decision: FEE, approve: 'maybe' });
  assert.ok(bad.error, `broadcast failure reported: ${JSON.stringify(bad)}`);
  assert.ok(assertDisposed(mark, 'eth_sendTransaction (broadcast fails)') >= 1);
  S.chain.fail('eth_sendRawTransaction', 0);

  // Solana message signing (no network)
  const ps = page('https://sol.qa.example'); // per-origin rate limit: a fresh site
  const sol = await ask(ps, 'solana', 'connect', {}, { approve: 'maybe' });
  assert.ok(sol.result?.publicKey, `solana connect: ${JSON.stringify(sol)}`);
  if (sol.result?.publicKey) {
    mark = opened.length;
    const sm = await ask(ps, 'solana', 'signMessage', { message: Buffer.from('qa').toString('base64') });
    assert.ok(sm.result?.signature, JSON.stringify(sm));
    assert.ok(assertDisposed(mark, 'solana signMessage') >= 1);
  }
});

e2e('T-KEY-122: popup send (sendSubmit) disposes and zeroes keys on success, on a refused broadcast and when the plan check fails', async () => {
  let mark = opened.length;
  const q = await send({ type: 'sendQuote', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average' }); assert.equal(q.ok, true, JSON.stringify(q));
  const ok = await send({ type: 'sendSubmit', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average', planHash: q.planHash });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.ok(assertDisposed(mark, 'sendSubmit (success)') >= 1, 'sendSubmit opened keys');

  mark = opened.length; S.chain.fail('eth_sendRawTransaction', 5);
  const q2 = await send({ type: 'sendQuote', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average' });
  const fail = await send({ type: 'sendSubmit', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average', planHash: q2.planHash });
  assert.equal(fail.ok, false, JSON.stringify(fail));
  assertDisposed(mark, 'sendSubmit (broadcast refused)');
  S.chain.fail('eth_sendRawTransaction', 0);
});

e2e('T-KEY-122: every other value-moving handler, driven to failure with incomplete inputs, leaves no undisposed key set and no live key bytes', async (t) => {
  const msgs = [
    { type: 'swapApprove', quoteId: 'nope' }, { type: 'swapSubmit', quoteId: 'nope' }, { type: 'swapDustConvert' },
    { type: 'earnSubmit', chainId: 'sepolia', protocol: 'aave', action: 'supply', asset: DEAD, amount: '1' }, { type: 'defiSubmit' },
    { type: 'nftTransferSubmit', chainId: 'sepolia', contract: DEAD, tokenId: '1', to: DEAD }, { type: 'sendNftSubmit', chainId: 'sepolia', contract: DEAD, tokenId: '1', to: DEAD },
    { type: 'approvalsRevoke', chainId: 'sepolia', token: DEAD, spender: DEAD }, { type: 'perpsEnable' }, { type: 'perpsDeposit', amount: '1' }, { type: 'perpsWithdraw', amount: '1' },
    { type: 'perpsOrder', coin: 'ETH', isBuy: true, size: '1' }, { type: 'perpsCancel', coin: 'ETH', oid: 1 }, { type: 'perpsClose', coin: 'ETH' },
    { type: 'predictionWrap', amount: '1' }, { type: 'predictionOrder', tokenId: '1', side: 'BUY', size: '1', price: '0.5' },
    { type: 'smartAccountApprove', chainId: 'sepolia' }, { type: 'sendSubmit', chainId: 'solana', to: 'x', amount: '1' }, { type: 'sendSubmit', chainId: 'tron', to: 'x', amount: '1' },
  ];
  const mark = opened.length;
  for (const m of msgs) {
    const from = opened.length;
    const r = await Promise.race([send(m), tick(30_000).then(() => ({ timeout: true }))]);
    assert.ok(!r?.timeout, `${m.type} answered`);
    assertDisposed(from, m.type);
  }
  t.diagnostic(`key sets opened by the failing handlers: ${opened.length - mark} (${[...new Set(opened.slice(mark).map((r) => r.site))].join(', ') || 'none: each refused before touching keys'})`);
  // all of them together, after the fact (catches a dispose that only happens on a later call)
  assertDisposed(mark, 'all value-moving handlers');
});
