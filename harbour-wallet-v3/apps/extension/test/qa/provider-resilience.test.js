// QA: the dApp provider through the REAL worker when storage writes fail (quota) and when a site-supplied RPC never answers.
// Page port fake as in provider-port.test.js. TEST_PLAN: T-DAPP-055, T-DAPP-056.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`import './background/index'; export { customNetworks } from './core/networkRegistry'; // provider-resilience`);
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let tabSeq = 40;
function page(origin) {
  const L = { m: [] }; const out = []; let n = 0; const tabId = ++tabSeq;
  const port = { name: 'harbour-provider', sender: { id: 'test', url: origin + '/app', origin, frameId: 0, documentId: `d${tabId}`, tab: { id: tabId, url: origin + '/', title: 'QA' } },
    onMessage: { addListener: (f) => L.m.push(f), removeListener() {} }, onDisconnect: { addListener() {}, removeListener() {} }, postMessage: (m) => out.push(structuredClone(m)), disconnect() {} };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  return { req: (ns, method, params) => { const id = `q${++n}`; L.m.forEach((f) => f({ id, ns, method, ...(params !== undefined ? { params } : {}) })); return id; },
    res: async (id, ms = 20_000) => { const t0 = Date.now(); for (;;) { const r = out.find((m) => m.t === 'res' && m.id === id); if (r) return r; if (Date.now() - t0 > ms) return { timeout: true }; await tick(10); } } };
}
async function pendingNext(ms = 5000) { const t0 = Date.now(); for (;;) { const r = await send({ type: 'providerPending' }); if (r.items?.[0]) return r.items[0]; if (Date.now() - t0 > ms) return null; await tick(10); } }
const approve = async (decision = {}) => { const it = await pendingNext(); assert.ok(it, 'approval queued'); return send({ type: 'providerResolve', id: it.id, decision: { approve: true, ...decision } }); };
before(async () => { H.reset(); assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true); });

test('T-DAPP-055: storage quota exceeded while connecting → the site gets an error, no half-written connection; it works once space is back', async (t) => {
  const p = page('https://quota.qa.example');
  const id = p.req('evm', 'eth_requestAccounts');
  const it = await pendingNext(); assert.ok(it);
  F.local.failWrites = 'QUOTA_BYTES quota exceeded';
  const r = await send({ type: 'providerResolve', id: it.id, decision: { approve: true } });
  const res = await p.res(id);
  F.local.failWrites = null;
  assert.ok(!res.timeout, 'the site got an answer');
  assert.ok(res.error, `connect failed with an error: ${JSON.stringify(res)} / resolve: ${JSON.stringify(r)}`);
  assert.doesNotMatch(res.error.message ?? '', /TypeError|at \S+:\d+/, 'no stack or code internals in the site-facing message');
  assert.doesNotMatch(res.error.message, /QUOTA_BYTES|quota/i, 'OBS-07 (fixed): the browser storage error is not shown to the site');
  assert.match(res.error.message, /could not save/);
  const accounts = await p.res(p.req('evm', 'eth_accounts'));
  assert.deepEqual(accounts.result, [], 'no connection recorded');
  // retry works
  const id2 = p.req('evm', 'eth_requestAccounts'); await approve();
  assert.equal((await p.res(id2)).result?.length, 1);
});

test('T-DAPP-055: session storage full when a request must be queued → the site gets an error at once, nothing pending is left behind', async () => {
  const p = page('https://quota2.qa.example');
  F.session.failWrites = 'QUOTA_BYTES quota exceeded';
  const id = p.req('evm', 'eth_requestAccounts');
  const res = await p.res(id, 10_000);
  F.session.failWrites = null;
  assert.ok(!res.timeout, 'answered instead of hanging');
  assert.ok(res.error, JSON.stringify(res));
  const pend = await send({ type: 'providerPending' });
  assert.ok(!(pend.items ?? []).some((x) => x.origin === 'https://quota2.qa.example'), 'no orphan pending item');
});

test('T-DAPP-056: wallet_addEthereumChain whose RPC never answers → error to the site within the probe timeout, nothing saved', async () => {
  const p = page('https://addchain.qa.example');
  const c = p.req('evm', 'eth_requestAccounts'); await approve(); await p.res(c);
  const hung = [];
  F.fetchImpl = (url, init) => new Promise((_, reject) => { hung.push(url); init?.signal?.addEventListener('abort', () => reject(init.signal.reason ?? new Error('aborted'))); });
  const id = p.req('evm', 'wallet_addEthereumChain', [{ chainId: '0xbeef1', chainName: 'Hang Net', rpcUrls: ['https://hang.rpc.example', 'https://hang2.rpc.example', 'https://hang3.rpc.example'], nativeCurrency: { name: 'H', symbol: 'HNG', decimals: 18 } }]);
  const keepAlive = setInterval(() => {}, 200); // AbortSignal.timeout timers do not keep Node's event loop alive on their own
  const t0 = Date.now(); await approve();
  const res = await p.res(id, 60_000);
  F.fetchImpl = null; clearInterval(keepAlive);
  assert.ok(!res.timeout, `answered within ${Date.now() - t0} ms`);
  assert.ok(res.error && Number.isInteger(res.error.code) && /reach/i.test(res.error.message), `error to the site: ${JSON.stringify(res)}`);
  // OBS-08 (fixed): the three candidate RPCs are probed in parallel, so they cost ONE 8 s probe timeout together (the other waits are the
  // phishing list and device registration, which also hang in this test).
  const probes = hung.filter((u) => /hang\d?\.rpc\.example/.test(u));
  assert.equal(probes.length, 3, `every candidate probed: ${JSON.stringify(hung)}`);
  const others = hung.length - probes.length;
  assert.ok(Date.now() - t0 < (others + 1) * 8_500 + 3_000, `bounded by one probe timeout for all candidates (${hung.length} waits, ${Date.now() - t0} ms): ${JSON.stringify(hung)}`);
  assert.ok(hung.some((u) => u.startsWith('https://hang.rpc.example')), 'the RPC was probed');
  assert.ok(!M.customNetworks().some((n) => n.chainId === 0xbeef1), 'nothing saved');
  assert.ok(!(JSON.stringify((await send({ type: 'networkList' })) ?? {})).includes('Hang Net'));
});
