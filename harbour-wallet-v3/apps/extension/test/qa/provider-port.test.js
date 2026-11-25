// QA: dApp provider through the REAL worker. A fake page port (the content script's 'harbour-provider' port, with the sender identity
// the browser would attach) sends EIP-1193 requests; the approval UI is driven through the internal router messages the approval window
// uses (providerPending / providerResolve). Network answered by an in-process fake JSON-RPC node (no real network).
// TEST_PLAN: T-PM-001..005, T-DAPP-003, 004, 033, 034, 035, 054, 058, 060, T-SIG-041, 043 (worker part), T-SIG-001 golden through the port.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { verifyMessage, verifyTypedData, keccak256, toHex } from 'viem';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';
import { fakeClock } from './known-bug.mjs';

const H = await harness(`
  import './background/index';
  export { parsePageRequest, EVENT_ALLOWLIST, MAX_PARAMS_BYTES } from './core/provider/protocol';
  export { EVM_METHODS, SOLANA_METHODS, MULTI_METHODS, UNSUPPORTED_EVM } from './core/provider/methods';
  export { MAX_PENDING_PER_ORIGIN, MAX_PENDING_TOTAL } from './core/provider/store';
  export { enrollPasskey } from './core/passkeyService';
`);
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const ADDR0 = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// ---- fake JSON-RPC node (chain id from the request URL is not trusted; we answer per method and record the calls)
const rpcCalls = [];
function rpcNode(url, init) {
  let body; try { body = JSON.parse(init?.body ?? 'null'); } catch { body = null; }
  const one = (r) => { rpcCalls.push({ url, method: r?.method, params: r?.params });
    const res = { eth_chainId: '0x1', net_version: '1', eth_blockNumber: '0x10', eth_gasPrice: '0x3b9aca00', eth_maxPriorityFeePerGas: '0x3b9aca00', eth_getTransactionCount: '0x0', eth_estimateGas: '0x5208',
      eth_getBalance: '0xde0b6b3a7640000', eth_call: '0x', eth_getCode: '0x', eth_feeHistory: { baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'], gasUsedRatio: [0.5], oldestBlock: '0x1', reward: [['0x3b9aca00']] },
      eth_getBlockByNumber: { number: '0x10', baseFeePerGas: '0x3b9aca00', timestamp: '0x1', hash: '0x' + '11'.repeat(32), transactions: [] } }[r?.method];
    return { jsonrpc: '2.0', id: r?.id ?? 1, ...(res !== undefined ? { result: res } : { error: { code: -32601, message: 'method not found' } }) }; };
  const out = Array.isArray(body) ? body.map(one) : one(body);
  return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
}

// ---- page ports
let tabSeq = 10;
function page(origin, { frameId = 0, topUrl, tabId = ++tabSeq, documentId = `doc-${tabSeq}` } = {}) {
  const L = { m: [], d: [] }; const out = []; let n = 0;
  const port = { name: 'harbour-provider', sender: { id: 'test', url: origin + '/app', origin, frameId, documentId, tab: { id: tabId, url: topUrl ?? origin + '/', title: 'Fixture dApp', favIconUrl: origin + '/favicon.ico' } },
    onMessage: { addListener: (f) => L.m.push(f), removeListener() {} }, onDisconnect: { addListener: (f) => L.d.push(f), removeListener() {} },
    postMessage: (m) => out.push(structuredClone(m)), disconnect() { L.d.forEach((f) => f()); } };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  const waitRes = async (id, ms = 15_000) => { const t0 = Date.now(); for (;;) { const r = out.find((m) => m.t === 'res' && m.id === id); if (r) return r; if (Date.now() - t0 > ms) return { timeout: true }; await tick(5); } };
  return {
    out, port, tabId,
    post: (raw) => L.m.forEach((f) => f(raw)),
    async req(ns, method, params, { wait = true } = {}) { const id = `r${++n}`; L.m.forEach((f) => f({ id, ns, method, ...(params !== undefined ? { params } : {}) })); return wait ? waitRes(id) : id; },
    waitRes, close: () => L.d.forEach((f) => f()),
    events: () => out.filter((m) => m.t === 'evt'), inits: () => out.filter((m) => m.t === 'init'),
  };
}
async function pendingOne(predicate = () => true, ms = 10_000) {
  const t0 = Date.now();
  for (;;) { const r = await send({ type: 'providerPending' }); const it = r.items?.find(predicate); if (it) return it; if (Date.now() - t0 > ms) return null; await tick(10); }
}
async function approve(id, decision = {}) { return send({ type: 'providerResolve', id, decision: { approve: true, ...decision } }); }
async function reject(id) { return send({ type: 'providerResolve', id, decision: { approve: false } }); }
async function connect(p) {
  const id = await p.req('evm', 'eth_requestAccounts', undefined, { wait: false });
  const it = await pendingOne((x) => x.kind === 'connect'); assert.ok(it, 'connect approval pending');
  await approve(it.id);
  const r = await p.waitRes(id); assert.deepEqual(r.result, [ADDR0]); return r;
}
let BASE;
before(async () => {
  H.reset(); F.fetchImpl = rpcNode;
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
  BASE = { l: structuredClone(F.local.data), s: structuredClone(F.session.data), i: new Map([...H.idb()].map(([k, v]) => [k, structuredClone(v)])) };
});
beforeEach(async () => {
  // Each test starts unlocked with no connections and no pending requests (the pending store lives in storage).
  F.local.data = structuredClone(BASE.l); F.session.data = structuredClone(BASE.s); const db = H.idb(); db.clear(); for (const [k, v] of BASE.i) db.set(k, structuredClone(v));
  F.fetchImpl = rpcNode; F.windows = []; rpcCalls.length = 0;
});
const errCode = (r) => r?.error?.code;

// ---------------------------------------------------------------- protocol (T-DAPP-003/004/060)

test('T-DAPP-003: prototype-polluting keys anywhere in params are refused and Object.prototype stays clean', () => {
  for (const params of [JSON.parse('{"__proto__":{"polluted":1}}'), [JSON.parse('{"a":{"__proto__":{"x":1}}}')], { constructor: { prototype: { y: 1 } } }, [{ prototype: 1 }]]) {
    const r = M.parsePageRequest({ id: 'a', ns: 'evm', method: 'eth_call', params });
    assert.equal(r.ok, false); assert.equal(r.error.code, -32602);
  }
  assert.equal(({}).polluted, undefined); assert.equal(({}).x, undefined); assert.equal(({}).y, undefined);
});

test('T-DAPP-004: parsePageRequest never throws; ok ⇒ only 4 keys, JSON-serialisable, ≤ 256 KiB (fuzz)', () => {
  fc.assert(fc.property(fc.anything({ withBigInt: true, withNullPrototype: true, withTypedArray: true, withSparseArray: true, withDate: true, withMap: true, withSet: true }), fc.anything(), (params, extra) => {
    for (const raw of [params, { id: 'x1', ns: 'evm', method: 'eth_call', params, extra }, { id: extra, ns: params, method: 'm' }]) {
      const r = M.parsePageRequest(raw);
      if (r.ok) { assert.deepEqual(Object.keys(r.req).sort().filter((k) => k !== 'params'), ['id', 'method', 'ns']); const t = JSON.stringify(r.req); assert.ok(t.length <= M.MAX_PARAMS_BYTES + 200); assert.deepEqual(JSON.parse(t), r.req); }
      else assert.ok([-32600, -32602].includes(r.error.code));
    }
  }), { numRuns: 1500, seed: 77 });
  assert.equal(M.parsePageRequest({ id: 'a', ns: 'evm', method: 'eth_call', params: ['x'.repeat(M.MAX_PARAMS_BYTES)] }).ok, false);
  assert.equal(M.parsePageRequest({ id: 'a'.repeat(65), ns: 'evm', method: 'eth_call' }).ok, false);
  assert.equal(M.parsePageRequest({ id: 'a', ns: 'evm', method: 'eth-call' }).ok, false);
});

test('T-DAPP-060: wire schema golden: init state fields, event allowlist and message kinds', async () => {
  const p = page('https://golden.example'); await tick(50);
  const init = p.inits().at(-1);
  assert.deepEqual(Object.keys(init).sort(), ['state', 't']);
  assert.deepEqual(Object.keys(init.state).sort(), ['evm', 'multi', 'prefs', 'solana']);
  assert.deepEqual(Object.keys(init.state.evm).sort(), ['accounts', 'chainId', 'connected', 'networkVersion']);
  assert.deepEqual(Object.keys(init.state.prefs), ['defaultWallet']);
  assert.deepEqual(M.EVENT_ALLOWLIST, { evm: ['accountsChanged', 'chainChanged', 'connect', 'disconnect', 'networkChanged'], solana: ['connect', 'disconnect', 'accountChanged'], multi: ['connect', 'disconnect'] });
  const r = await p.req('evm', 'eth_chainId'); assert.deepEqual(Object.keys(r).sort(), ['id', 'result', 't']);
  const e = await p.req('evm', 'eth_subscribe', []); assert.deepEqual(Object.keys(e).sort(), ['error', 'id', 't']); assert.deepEqual(Object.keys(e.error).sort(), ['code', 'message']);
});

// ---------------------------------------------------------------- method table behaviour (T-PM-001..004)

const ALL = () => [...Object.keys(M.EVM_METHODS).map((m) => ['evm', m]), ...Object.keys(M.SOLANA_METHODS).map((m) => ['solana', m]), ...Object.keys(M.MULTI_METHODS).map((m) => ['multi', m])];
const spec = (ns, m) => (ns === 'evm' ? M.EVM_METHODS : ns === 'solana' ? M.SOLANA_METHODS : M.MULTI_METHODS)[m];
const ALLOWED = new Set([-32602, -32600, -32601, 4100, 4200, 4001, 4902, -32002, -32005, 5700, 5710, 5730]); // -32000..-32099 (server errors) are NOT expected for malformed params

test('T-PM-002: every method that needs a connection answers 4100 to an unconnected origin and opens no window', async () => {
  const p = page('https://unconnected.example');
  for (const [ns, m] of ALL().filter(([ns, m]) => spec(ns, m).needsConnection)) {
    const params = ns === 'multi' ? { chain: 'cosmos', message: 'hello', signer: 'cosmos1x' } : ns === 'solana' ? { message: 'aGk=' } : [ADDR0, 'hello'];
    const r = await p.req(ns, m, params);
    assert.equal(errCode(r), 4100, `${ns}.${m}: ${JSON.stringify(r)}`);
  }
  assert.equal(F.windows.length, 0); assert.equal((await send({ type: 'providerPending' })).items.length, 0);
});

test('T-PM-001: every method with missing / null / wrong-type / oversized params answers a spec error code, never a -32603 with a stack', async (t) => {
  const p = page('https://params.example'); await connect(p);
  const bad = [undefined, null, 'string', 42, {}, [null], [{}], ['x'.repeat(200_000)]];
  const internal = [];
  for (const [ns, m] of ALL()) {
    for (const params of bad) {
      const r = await p.req(ns, m, params);
      assert.ok(!r.timeout || spec(ns, m).approval, `${ns}.${m} hung on ${JSON.stringify(params)?.slice(0, 30)}`);
      if (r.timeout) continue;
      if (r.error) {
        assert.doesNotMatch(r.error.message, /at \S+:\d+:\d+|TypeError|Cannot read prop|undefined is not/, `${ns}.${m}`);
        if (!ALLOWED.has(r.error.code)) internal.push(`${ns}.${m}(${JSON.stringify(params)?.slice(0, 20)}) → ${r.error.code} ${r.error.message}`);
      }
    }
    // reject anything a malformed request managed to queue
    for (const it of (await send({ type: 'providerPending' })).items) await reject(it.id);
  }
  t.diagnostic(`non-spec codes: ${internal.length}`);
  if (internal.length) return assert.fail('BUG-08 regression (fixed bug reproduces again): ' + `${internal.length} malformed request(s) answered -32603/other instead of -32602: ${[...new Set(internal)].slice(0, 8).join(' | ')}`);
});

test('T-PM-003: approval methods from a connected origin: one window, 4001 on reject, nothing signed', async () => {
  const p = page('https://approve.example'); await connect(p);
  const cases = [['evm', 'personal_sign', ['0x68656c6c6f', ADDR0]], ['evm', 'eth_signTypedData_v4', [ADDR0, JSON.stringify({ types: { EIP712Domain: [{ name: 'name', type: 'string' }], M: [{ name: 'a', type: 'uint256' }] }, primaryType: 'M', domain: { name: 'x' }, message: { a: '1' } })]],
    ['evm', 'eth_sendTransaction', [{ from: ADDR0, to: '0x000000000000000000000000000000000000dEaD', value: '0x1' }]], ['evm', 'wallet_watchAsset', { type: 'ERC20', options: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 } }],
    ['evm', 'wallet_switchEthereumChain', [{ chainId: '0x89' }]]];
  for (const [ns, m, params] of cases) {
    F.windows = [];
    const id = await p.req(ns, m, params, { wait: false });
    const it = await pendingOne(); assert.ok(it, `${m} pending`);
    assert.equal(F.windows.length <= 1, true, `${m} opened ${F.windows.length} windows`);
    await reject(it.id);
    const r = await p.waitRes(id);
    assert.equal(errCode(r), 4001, `${m}: ${JSON.stringify(r)}`);
  }
  assert.ok(!rpcCalls.some((c) => c.method === 'eth_sendRawTransaction'), 'nothing broadcast');
});

test('T-SIG-043 (worker): closing the approval window rejects every pending site request with 4001', async () => {
  const p = page('https://close.example'); await connect(p);
  const ids = [await p.req('evm', 'personal_sign', ['0x6869', ADDR0], { wait: false })];
  const it = await pendingOne(); assert.ok(it);
  const win = F.windows.at(-1); assert.ok(win, 'approval window opened');
  await chrome.windows.remove(win.id); await tick(50);
  for (const id of ids) assert.equal(errCode(await p.waitRes(id)), 4001);
  assert.equal((await send({ type: 'providerPending' })).items.length, 0);
});

test('T-SIG-001/T-SIG-010 through the port: an approved personal_sign / typed-data signature recovers to the account', async () => {
  const p = page('https://sign.example'); await connect(p);
  const id = await p.req('evm', 'personal_sign', [toHex('hello harbour'), ADDR0], { wait: false });
  await approve((await pendingOne()).id);
  const r = await p.waitRes(id);
  assert.equal(await verifyMessage({ address: ADDR0, message: 'hello harbour', signature: r.result }), true);
  const td = { types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }], Mail: [{ name: 'contents', type: 'string' }] }, primaryType: 'Mail', domain: { name: 'Ether Mail', chainId: 1 }, message: { contents: 'Hello, Bob!' } };
  const id2 = await p.req('evm', 'eth_signTypedData_v4', [ADDR0, JSON.stringify(td)], { wait: false });
  await approve((await pendingOne()).id);
  const r2 = await p.waitRes(id2);
  assert.equal(await verifyTypedData({ address: ADDR0, ...td, types: { Mail: td.types.Mail }, signature: r2.result }), true);
});

test('T-PM-004: local methods answer the expected shapes; RPC methods are proxied for the origin\'s selected chain only', async () => {
  const p = page('https://local.example');
  assert.equal((await p.req('evm', 'eth_chainId')).result, '0x1');
  assert.equal((await p.req('evm', 'net_version')).result, '1');
  assert.deepEqual((await p.req('evm', 'eth_accounts')).result, [], 'unconnected origin sees no account');
  assert.equal((await p.req('evm', 'eth_coinbase')).result ?? null, null);
  assert.match((await p.req('evm', 'web3_clientVersion')).result, /Harbour/i);
  assert.equal((await p.req('evm', 'web3_sha3', ['0x68656c6c6f'])).result, keccak256('0x68656c6c6f'));
  assert.deepEqual((await p.req('evm', 'wallet_getPermissions')).result, []);
  await connect(p);
  assert.deepEqual((await p.req('evm', 'eth_accounts')).result, [ADDR0]);
  rpcCalls.length = 0;
  const bn = await p.req('evm', 'eth_blockNumber'); assert.equal(bn.result, '0x10');
  assert.ok(rpcCalls.some((c) => c.method === 'eth_blockNumber'));
  for (const m of M.UNSUPPORTED_EVM) assert.equal(errCode(await p.req('evm', m, [])), 4200, m);
  assert.ok([4200, -32601].includes(errCode(await p.req('evm', 'eth_notAMethod', []))), 'unknown method: 4200 (EIP-1193) or -32601 (EIP-1474)');
});

test('T-DAPP-033: eth_call from an unconnected origin is a read-only proxy that implies no account', async () => {
  const p = page('https://reader.example');
  const r = await p.req('evm', 'eth_call', [{ to: '0x6B175474E89094C44Da98b954EedeAC495271d0F', data: '0x18160ddd' }, 'latest']);
  assert.equal(r.result, '0x');
  const call = rpcCalls.find((c) => c.method === 'eth_call');
  assert.ok(call); assert.equal(call.params[0].from, undefined, 'no "from" injected');
});

test('T-PM-005: random params for every method never sign, never open a window for invalid input, never crash (fuzz)', async () => {
  const p = page('https://fuzz.example'); await connect(p);
  const runs = Number(process.env.HB_FUZZ_RUNS ?? 30);
  for (const [ns, m] of ALL()) {
    await fc.assert(fc.asyncProperty(fc.jsonValue({ maxDepth: 3 }), async (params) => {
      F.windows = [];
      const id = await p.req(ns, m, params, { wait: false });
      const r = await p.waitRes(id, 400);
      if (r.timeout) { const it = await pendingOne(() => true, 200); if (it) await reject(it.id); await p.waitRes(id, 2000); return; } // valid enough to need approval: rejected
      if (r.error) { assert.ok(Number.isInteger(r.error.code)); assert.doesNotMatch(r.error.message, /at \S+:\d+:\d+/); }
      // The wallet never produced a signature without an approval (a page may still relay its OWN raw tx via eth_sendRawTransaction).
      if (r.result !== undefined) assert.doesNotMatch(JSON.stringify(r.result), /0x[0-9a-f]{130}\b/i, `${ns}.${m} returned a signature without approval`);
      if (m !== 'eth_sendRawTransaction') assert.ok(!rpcCalls.some((c) => c.method === 'eth_sendRawTransaction'), `${ns}.${m} broadcast`);
      rpcCalls.length = 0;
    }), { numRuns: runs, seed: 99 });
  }
});

// ---------------------------------------------------------------- events, init, isolation (T-DAPP-034/035)

test('T-DAPP-034 / T-DAPP-035: events reach only pages of the connected origin; init carries public fields only', async () => {
  const a1 = page('https://a.example'), a2 = page('https://a.example'), b = page('https://b.example');
  await connect(a1); await tick(50);
  const before = [a1.events().length, a2.events().length, b.events().length];
  const id = (await send({ type: 'providerConnections' })).items.find((c) => c.origin === 'https://a.example').id;
  assert.equal((await send({ type: 'providerSetChain', id, chainId: 137 })).ok, true); await tick(50);
  assert.ok(a1.events().length > before[0] && a2.events().length > before[1], 'both tabs of the origin get chainChanged');
  assert.equal(b.events().length, before[2], 'other origin gets nothing');
  for (const pg of [a1, a2, b]) for (const e of pg.events()) assert.ok(M.EVENT_ALLOWLIST[e.ns].includes(e.name));
  // A vault change re-sends init to open pages; it never contains storage values or session keys.
  await send({ type: 'lock' }); await tick(50);
  const all = JSON.stringify([...a1.inits(), ...b.inits()]);
  for (const secret of [BASE.s['wallet:password'], BASE.s['wallet:unlock'], 'wallet:vault', 'pbkdf2', 'argon2id']) assert.ok(!all.includes(secret), `init leaked ${String(secret).slice(0, 12)}`);
  assert.deepEqual(a1.inits().at(-1).state.evm.accounts, [], 'locked: no accounts exposed');
});

test('T-DAPP-054: concurrent connect requests from one origin produce one connection record', async () => {
  const p = page('https://race.example');
  const ids = [await p.req('evm', 'eth_requestAccounts', undefined, { wait: false }), await p.req('evm', 'eth_requestAccounts', undefined, { wait: false })];
  await tick(50);
  for (let i = 0; i < 2; i++) { const it = await pendingOne((x) => x.kind === 'connect', 500); if (it) await approve(it.id); }
  const rs = await Promise.all(ids.map((id) => p.waitRes(id, 3000)));
  assert.ok(rs.some((r) => Array.isArray(r.result)), JSON.stringify(rs));
  for (const r of rs) if (r.error) assert.equal(r.error.code, -32002, 'second request: already pending');
  assert.equal((await send({ type: 'providerConnections' })).items.filter((c) => c.origin === 'https://race.example').length, 1);
});

test('T-DAPP-058 (worker): pending store limits per origin and in total are enforced with -32005', async () => {
  const p = page('https://flood.example'); await connect(p);
  const ids = [];
  for (let i = 0; i < M.MAX_PENDING_PER_ORIGIN + 3; i++) ids.push(await p.req('evm', 'personal_sign', [toHex(`m${i}`), ADDR0], { wait: false }));
  await tick(300);
  const answered = ids.map((id) => p.out.find((m) => m.t === 'res' && m.id === id)).filter(Boolean);
  assert.ok(answered.some((r) => [-32005, -32002].includes(errCode(r))), `limit enforced: ${JSON.stringify(answered.map(errCode))}`);
  assert.ok((await send({ type: 'providerPending' })).items.length <= M.MAX_PENDING_PER_ORIGIN);
});

// ---------------------------------------------------------------- biometric approval (T-SIG-041)

test('T-SIG-041: with biometric approval on, providerResolve(approve) without a fresh proof bound to that request is refused', async () => {
  await send({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'manage' });
  assert.equal((await send({ type: 'passkeyEnroll', secret: 'ab'.repeat(32), credentialId: 'cd' })).ok, true);
  assert.equal((await send({ type: 'providerPrefs', biometricApproval: true })).prefs.biometricApproval, true);
  const p = page('https://bio.example'); await connect(p);
  const id = await p.req('evm', 'personal_sign', ['0x6869', ADDR0], { wait: false });
  const it = await pendingOne(); assert.ok(it);
  const r = await approve(it.id); assert.equal(r.needsBio, true);
  assert.equal((await send({ type: 'providerBioProof', id: it.id, secret: 'ef'.repeat(32) })).ok, false, 'wrong secret');
  const other = await p.req('evm', 'personal_sign', ['0x6868', ADDR0], { wait: false }); const it2 = await pendingOne((x) => x.id !== it.id);
  assert.equal((await send({ type: 'providerBioProof', id: it2.id, secret: 'ab'.repeat(32) })).ok, true, 'proof for the OTHER request');
  assert.equal((await approve(it.id)).needsBio, true, 'a proof bound to another request does not count');
  const clk = fakeClock();
  try {
    assert.equal((await send({ type: 'providerBioProof', id: it.id, secret: 'ab'.repeat(32) })).ok, true);
    clk.advance(60_001);
    assert.equal((await approve(it.id)).needsBio, true, 'expired proof');
  } finally { clk.restore(); }
  await send({ type: 'providerBioProof', id: it.id, secret: 'ab'.repeat(32) });
  await approve(it.id);
  assert.ok((await p.waitRes(id)).result, 'fresh proof for this request → signed');
  await reject(it2.id); await p.waitRes(other);
  assert.equal((await send({ type: 'providerPrefs', biometricApproval: false })).error, 'AUTH_REQUIRED', 'turning it off needs a fresh grant');
});

test('T-DAPP-007 (worker side): a port from an extension page or without a tab gets 4100 for every request', async () => {
  for (const sender of [{ id: 'test', url: 'chrome-extension://test/src/popup/index.html', frameId: 0, tab: { id: 1, url: 'chrome-extension://test/' } }, { id: 'test', url: 'https://x.example/', frameId: 0 }, { id: 'other', url: 'https://x.example/', frameId: 0, tab: { id: 1, url: 'https://x.example/' } }]) {
    const out = []; const L = [];
    const port = { name: 'harbour-provider', sender, onMessage: { addListener: (f) => L.push(f) }, onDisconnect: { addListener() {} }, postMessage: (m) => out.push(m) };
    F.listeners['runtime.onConnect'].forEach((f) => f(port));
    L.forEach((f) => f({ id: 'q1', ns: 'evm', method: 'eth_requestAccounts' })); await tick(20);
    assert.equal(out.find((m) => m.id === 'q1')?.error?.code, 4100, JSON.stringify(sender));
    assert.ok(!out.some((m) => m.t === 'init'), 'no init state for an untrusted frame');
  }
});
void readFileSync;
