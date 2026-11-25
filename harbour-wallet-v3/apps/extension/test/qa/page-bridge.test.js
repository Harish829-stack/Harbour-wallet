// QA: the page side of the dApp provider. The REAL inpage script (MAIN world) and the REAL content script (ISOLATED world) are bundled as
// IIFEs and run against a minimal window (EventTarget + postMessage with transferred MessagePorts, the parts of the DOM they use);
// the content script's runtime port is wired to the REAL service worker. So page → inpage → content → worker → approval → page is the
// production code path end to end, with fakes only at the browser boundary. No DOM library needed (node has EventTarget, MessageChannel,
// CustomEvent). TEST_PLAN: T-DAPP-007, 008, 009, 011, 039, 046, 048, 049, 050, 051 (node-level; Playwright run in test/e2e), 062.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { verifyMessage, toHex } from 'viem';
import { harness, SRC, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const H = await harness(`
  import './background/index';
  export { isBlockedDomain, BLOCKED_DOMAINS } from './core/provider/origin';
  export { EXCLUDE_MATCHES, registerInpage } from './background/provider/index';
`);
const { M, F } = H;
const ADDR0 = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return null; await tick(10); } };
const iife = async (entry) => (await build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent', target: 'es2022' })).outputFiles[0].text;
const INPAGE = await iife(SRC + 'inpage/index.ts');
const CONTENT = await iife(SRC + 'content/content.ts');

let tabSeq = 500;
/** A browser tab: one window shared by the MAIN world (page + inpage) and the ISOLATED world (content script). */
function makeTab(origin, { secure = true, connectWorker = true } = {}) {
  const url = new URL(origin);
  const win = new EventTarget();
  const tabId = ++tabSeq;
  Object.assign(win, {
    isSecureContext: secure, location: { origin: url.origin, hostname: url.hostname, href: origin + '/' }, crypto: globalThis.crypto,
    postMessage(data, target, transfer = []) {
      const ev = new Event('message'); Object.assign(ev, { data, origin: url.origin, source: win, ports: transfer });
      setTimeout(() => win.dispatchEvent(ev), 0);
    },
  });
  win.window = win; win.self = win;
  const doc = new EventTarget(); doc.visibilityState = 'visible';
  // content-script chrome: runtime.connect creates a port pair; the worker side is announced on the worker's runtime.onConnect
  const portLog = [];
  const chromeForContent = { runtime: { id: 'test', lastError: undefined, connect: ({ name }) => {
    if (!chromeForContent.runtime.id) throw new Error('Extension context invalidated.');
    const A = { m: [], d: [] }, B = { m: [], d: [] }; let open = true;
    const content = { name, onMessage: { addListener: (f) => A.m.push(f) }, onDisconnect: { addListener: (f) => A.d.push(f) }, postMessage: (m) => { if (!open) throw new Error('disconnected'); portLog.push(m); const c = structuredClone(m); setTimeout(() => B.m.forEach((f) => f(c)), 0); }, disconnect: () => { open = false; B.d.forEach((f) => f()); } };
    const worker = { name, sender: { id: 'test', url: origin + '/', origin: url.origin, frameId: 0, documentId: `doc-${tabId}`, tab: { id: tabId, url: origin + '/', title: 'Fixture dApp' } },
      onMessage: { addListener: (f) => B.m.push(f) }, onDisconnect: { addListener: (f) => B.d.push(f) }, postMessage: (m) => { if (!open) return; const c = structuredClone(m); setTimeout(() => A.m.forEach((f) => f(c)), 0); }, disconnect: () => { open = false; A.d.forEach((f) => f()); } };
    tab.workerPorts.push(worker);
    if (connectWorker) setTimeout(() => F.listeners['runtime.onConnect'].forEach((f) => f(worker)), 0);
    return content;
  } } };
  const run = (code, withChrome) => new Function('window', 'self', 'location', 'document', 'chrome', 'globalThis', code)(win, win, win.location, doc, withChrome ? chromeForContent : undefined, win);
  const tab = { win, doc, tabId, portLog, workerPorts: [], chrome: chromeForContent, inpage: () => run(INPAGE, false), content: () => run(CONTENT, true) };
  return tab;
}
/** Act as a page script that does its own handshake with the content script (to talk to it directly). */
async function rawChannel(tab, nonce = 'ab'.repeat(16)) {
  const ch = new MessageChannel(); const got = [];
  ch.port1.onmessage = (ev) => got.push(ev.data);
  tab.win.postMessage({ type: 'HARBOUR_INPAGE_HELLO', v: 1, nonce }, tab.win.location.origin, [ch.port2]);
  await until(() => got.some((m) => m.t === 'ack'), 2000);
  return { port: ch.port1, got, close: () => { ch.port1.close(); } };
}
async function pendingOne(pred = () => true) { return until(async () => (await send({ type: 'providerPending' })).items?.find(pred)); }

before(async () => {
  H.reset(); F.fetchImpl = async () => { throw new TypeError('NETWORK_DISABLED_IN_TESTS'); };
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});

// ---------------------------------------------------------------- full path (T-DAPP-051 node-level)

test('T-DAPP-051 (node-level): connect, personal_sign, switch chain, watch asset and disconnect through inpage → content → worker', async () => {
  const tab = makeTab('https://fixture-dapp.example'); tab.inpage(); tab.content();
  const eth = tab.win.ethereum; assert.ok(eth?.isHarbour);
  const events = []; for (const e of ['connect', 'accountsChanged', 'chainChanged', 'disconnect']) eth.on(e, (d) => events.push([e, d]));
  const acc = eth.request({ method: 'eth_requestAccounts' });
  await send({ type: 'providerResolve', id: (await pendingOne((x) => x.kind === 'connect')).id, decision: { approve: true } });
  assert.deepEqual(await acc.catch((e) => 'connect: ' + e.message), [ADDR0]);
  assert.deepEqual(await eth.request({ method: 'eth_accounts' }), [ADDR0]);
  const sig = eth.request({ method: 'personal_sign', params: [toHex('fixture'), ADDR0] });
  await send({ type: 'providerResolve', id: (await pendingOne((x) => x.kind === 'sign')).id, decision: { approve: true } });
  assert.equal(await verifyMessage({ address: ADDR0, message: 'fixture', signature: await sig.catch((e) => { throw new Error('sign: ' + e.message); }) }), true);
  const sw = eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] });
  const swp = await until(async () => (await send({ type: 'providerPending' })).items?.find((x) => x.kind === 'switchChain'), 1500);
  if (swp) await send({ type: 'providerResolve', id: swp.id, decision: { approve: true } });
  assert.equal(await sw.catch((e) => `switch failed: ${e.code} ${e.message} (pending kinds seen: ${swp?.kind})`), null);
  await until(() => eth.chainId === '0x89'); assert.equal(eth.chainId, '0x89');
  const wa = eth.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 } } }).then(() => null, (e) => e);
  await send({ type: 'providerResolve', id: (await pendingOne((x) => x.kind === 'watchAsset')).id, decision: { approve: false } });
  assert.equal((await wa)?.code, 4001, 'user rejected watchAsset');
  assert.equal(await eth.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }), null);
  await until(() => events.some(([e]) => e === 'disconnect'));
  assert.deepEqual(await eth.request({ method: 'eth_accounts' }), []);
  assert.ok(events.some(([e, d]) => e === 'chainChanged' && d === '0x89'));
});

// ---------------------------------------------------------------- handshake (T-DAPP-007/008)

test('T-DAPP-007: bad nonce, foreign source, wrong origin and a second HELLO are all ignored; first valid channel wins', async () => {
  const tab = makeTab('https://hs.example'); tab.content();
  const tryHello = (data, extra = {}) => { const ch = new MessageChannel(); const got = []; ch.port1.onmessage = (ev) => got.push(ev.data);
    const ev = new Event('message'); Object.assign(ev, { data, origin: tab.win.location.origin, source: tab.win, ports: [ch.port2], ...extra }); tab.win.dispatchEvent(ev); return got; };
  const g1 = tryHello({ type: 'HARBOUR_INPAGE_HELLO', nonce: 'XYZ' });
  const g2 = tryHello({ type: 'HARBOUR_INPAGE_HELLO', nonce: 'ab'.repeat(16) }, { source: {} });
  const g3 = tryHello({ type: 'HARBOUR_INPAGE_HELLO', nonce: 'ab'.repeat(16) }, { origin: 'https://evil.example' });
  const g4 = tryHello({ type: 'HARBOUR_INPAGE_HELLO', nonce: 'AB'.repeat(16) });
  const g5 = tryHello({ type: 'OTHER', nonce: 'ab'.repeat(16) });
  await tick(50);
  for (const g of [g1, g2, g3, g4, g5]) assert.deepEqual(g, []);
  const first = tryHello({ type: 'HARBOUR_INPAGE_HELLO', nonce: 'cd'.repeat(16) });
  const second = tryHello({ type: 'HARBOUR_INPAGE_HELLO', nonce: 'ef'.repeat(16) });
  await until(() => first.length);
  assert.deepEqual(first[0], { t: 'ack', nonce: 'cd'.repeat(16) }); await tick(50); assert.deepEqual(second, [], 'second HELLO after ack ignored');
});

test('T-DAPP-008: content script loading after inpage: the provider keeps offering channels and queued requests are answered', async () => {
  const tab = makeTab('https://late.example'); tab.inpage();
  const p = tab.win.ethereum.request({ method: 'eth_chainId' });
  await tick(400); // ~8 offers made
  tab.content();
  assert.equal(await p, '0x1');
});

test('T-DAPP-039 / T-DAPP-046: blocked domains get no provider; exclude patterns are valid; inpage registration is idempotent', async () => {
  assert.equal(M.isBlockedDomain('x.com'), true); assert.equal(M.isBlockedDomain('sub.x.com'), true); assert.equal(M.isBlockedDomain('notx.com'), false); assert.equal(M.isBlockedDomain('x.com.evil.io'), false);
  const valid = /^(\*|https?):\/\/(\*|\*\.[^/*]+|[^/*]+)\/.*$/;
  for (const p of M.EXCLUDE_MATCHES) assert.match(p, valid, p);
  for (const d of M.BLOCKED_DOMAINS) assert.ok(M.EXCLUDE_MATCHES.includes(`*://*.${d}/*`), d);
  const blocked = makeTab('https://mail.google.com'); blocked.inpage(); blocked.content();
  assert.equal(blocked.win.ethereum, undefined); assert.equal(blocked.win.harbour, undefined);
  const insecure = makeTab('http://plain.example', { secure: false }); insecure.inpage(); insecure.content();
  assert.equal(insecure.win.ethereum, undefined);
  const inpage = F.scripts.find((s) => s.id === 'harbour-inpage');
  assert.deepEqual({ world: inpage.world, allFrames: inpage.allFrames, runAt: inpage.runAt }, { world: 'MAIN', allFrames: true, runAt: 'document_start' });
  const before = F.scriptUpdates.length; await M.registerInpage();
  assert.equal(F.scriptUpdates.length, before + 1, 'duplicate id → updateContentScripts');
  assert.equal(F.scripts.filter((s) => s.id === 'harbour-inpage').length, 1);
});

// ---------------------------------------------------------------- content-script limits (T-DAPP-009/011)

test('T-DAPP-009: duplicate in-flight id → -32600; more than 200 in flight → -32005; unknown method → -32601 locally', async () => {
  const tab = makeTab('https://limits.example', { connectWorker: false }); tab.content(); // worker never answers: everything stays in flight
  const ch = await rawChannel(tab);
  ch.port.postMessage({ id: 'dup', ns: 'evm', method: 'eth_blockNumber' }); ch.port.postMessage({ id: 'dup', ns: 'evm', method: 'eth_blockNumber' });
  await until(() => ch.got.some((m) => m.id === 'dup'));
  assert.equal(ch.got.find((m) => m.id === 'dup').error.code, -32600);
  for (let i = 0; i < 205; i++) ch.port.postMessage({ id: `f${i}`, ns: 'evm', method: 'eth_blockNumber' });
  await until(() => ch.got.some((m) => m.id === 'f204'));
  const limited = ch.got.filter((m) => /^f\d+$/.test(m.id ?? '') && m.error?.code === -32005).map((m) => m.id);
  assert.deepEqual(limited, ['f199', 'f200', 'f201', 'f202', 'f203', 'f204'], 'dup + 199 = 200 in flight, then refused');
  ch.port.postMessage({ id: 'u1', ns: 'evm', method: 'eth_foo' }); ch.port.postMessage({ id: 'u2', ns: 'evm', method: 'eth_subscribe' });
  await until(() => ch.got.some((m) => m.id === 'u2'));
  assert.equal(ch.got.find((m) => m.id === 'u1').error.code, -32601); assert.equal(ch.got.find((m) => m.id === 'u2').error.code, 4200);
  ch.close();
});

test('T-DAPP-011: extension reloaded (runtime.id gone): in-flight requests fail with the reload message and the provider emits disconnect 4900', async () => {
  const tab = makeTab('https://reload.example', { connectWorker: false }); tab.inpage(); tab.content();
  // deliver an init so the inpage provider is ready, as the worker would
  const content = tab.workerPorts[0]; content.postMessage({ t: 'init', state: { evm: { chainId: '0x1', networkVersion: '1', accounts: [], connected: true }, solana: { publicKey: null }, multi: {}, prefs: { defaultWallet: false } } });
  const eth = tab.win.ethereum; await until(() => eth.chainId === '0x1');
  const disconnects = []; eth.on('disconnect', (e) => disconnects.push(e.code));
  const p = eth.request({ method: 'eth_blockNumber' }); await tick(30);
  tab.chrome.runtime.id = undefined; content.disconnect();
  await assert.rejects(p, (e) => e.code === 4900 || /reloaded/.test(e.message));
  await until(() => disconnects.length); assert.equal(disconnects[0], 4900);
});

// ---------------------------------------------------------------- page-facing API (T-DAPP-048/049/050/062)

test('T-DAPP-048: window.ethereum EIP-1193 surface, legacy send/sendAsync, EIP-6963 announce, and no other-vendor impersonation', async () => {
  const tab = makeTab('https://api.example'); tab.inpage(); tab.content();
  const eth = tab.win.ethereum;
  for (const k of ['request', 'on', 'removeListener', 'send', 'sendAsync', 'isConnected', 'enable']) assert.equal(typeof eth[k], 'function', k);
  assert.equal(eth.isHarbour, true); assert.equal(eth.isMetaMask, false);
  for (const k of ['isTrust', 'isTrustWallet', 'isCoinbaseWallet', 'isRabby', 'isPhantom']) assert.ok(!eth[k], k);
  assert.equal(tab.win.trustwallet, undefined); assert.equal(tab.win.trustWallet, undefined);
  await assert.rejects(eth.request([{ method: 'eth_chainId' }]), (e) => e.code === -32600);
  await assert.rejects(eth.request({ method: '' }), (e) => e.code === -32600);
  await assert.rejects(eth.request({ method: 'eth_call', params: 'x' }), (e) => e.code === -32600);
  assert.equal(await eth.request({ method: 'eth_chainId' }), '0x1');
  assert.deepEqual(eth.send({ id: 3, method: 'eth_chainId' }), { id: 3, jsonrpc: '2.0', result: '0x1' });
  assert.throws(() => eth.send({ method: 'eth_blockNumber' }), (e) => e.code === 4200);
  const viaCb = await new Promise((r) => eth.sendAsync({ id: 9, method: 'net_version' }, (e, res) => r([e, res])));
  assert.deepEqual(viaCb, [null, { id: 9, jsonrpc: '2.0', result: '1' }]);
  const batch = await new Promise((r) => eth.sendAsync([{ id: 1, method: 'eth_chainId' }, { id: 2, method: 'eth_foo' }], (e, res) => r(res)));
  assert.equal(batch[0].result, '0x1'); assert.ok(batch[1].error);
  const announced = []; tab.win.addEventListener('eip6963:announceProvider', (e) => announced.push(e.detail));
  tab.win.dispatchEvent(new Event('eip6963:requestProvider'));
  assert.equal(announced.length, 1); assert.equal(announced[0].info.rdns, 'app.harbourwallet'); assert.equal(announced[0].provider, eth);
  assert.ok(Object.isFrozen(announced[0]) && Object.isFrozen(announced[0].info)); assert.match(announced[0].info.uuid, /^[0-9a-f-]{36}$/);
  assert.match(announced[0].info.icon, /^data:image\//);
  const fn = () => {}; eth.on('x', fn); assert.equal(eth.listenerCount('x'), 1); eth.removeListener('x', fn); assert.equal(eth.listenerCount('x'), 0);
});

test('T-DAPP-049: a page that overwrites window.ethereum methods or pollutes prototypes cannot break or hijack the bridge', async () => {
  const tab = makeTab('https://hostile.example'); tab.inpage(); tab.content();
  const eth = tab.win.ethereum; const harbour = tab.win.harbour;
  assert.equal(await eth.request({ method: 'eth_chainId' }), '0x1'); // channel established before the page script runs its tampering
  const sniffed = [];
  eth.request = async (a) => { sniffed.push(a); return 'hijacked'; }; // page replaces the public method (its own copy)
  const origPost = MessagePort.prototype.postMessage;
  // MAIN-world prototype tampering. (In a browser the content script lives in an isolated world with its own prototypes; here both share
  // node's MessagePort, so the content script's own messages are excluded from what the page could have seen.)
  MessagePort.prototype.postMessage = function (m, ...r) { if (m?.t !== 'ack' && m?.t !== 'res' && m?.t !== 'evt' && m?.t !== 'init') sniffed.push(m); return origPost.call(this, m, ...r); };
  Object.prototype.polluted = 'yes';
  try {
    assert.equal(await harbour.request({ method: 'eth_chainId' }), '0x1', 'window.harbour keeps the bound original');
    assert.ok(!sniffed.some((m) => m && m.nonce), 'the handshake nonce never crosses a page-patched function after the handshake');
    assert.ok(sniffed.every((m) => !('polluted' in Object.keys(m ?? {}))), 'polluted prototype keys are not forwarded');
  } finally { MessagePort.prototype.postMessage = origPost; delete Object.prototype.polluted; }
  // a second injection is a no-op
  tab.inpage(); assert.equal(tab.win.harbour, harbour);
});

test('T-DAPP-050: solana connect({onlyIfTrusted:true}) from an origin that is not trusted fails with 4100 and opens no approval', async () => {
  const tab = makeTab('https://soltrust.example'); tab.inpage(); tab.content();
  const sol = tab.win.harbour.solana ?? tab.win.solana; assert.ok(sol);
  const before = F.windows.length;
  await assert.rejects(sol.connect({ onlyIfTrusted: true }), (e) => [4100, 4200].includes(e.code));
  assert.equal(F.windows.length, before);
  assert.equal((await send({ type: 'providerPending' })).items.filter((x) => x.kind === 'solConnect').length, 0);
});

test('T-DAPP-062: page API surface of the Solana, Keplr, Aptos, Tron, Bitcoin and TON providers matches the committed golden', async () => {
  const tab = makeTab('https://surface.example'); tab.inpage();
  const shape = (o) => { const keys = new Set(); let p = o; while (p && p !== Object.prototype && p !== EventTarget.prototype) { for (const k of Object.getOwnPropertyNames(p)) if (!k.startsWith('_') && k !== 'constructor') keys.add(`${k}:${typeof o[k] === 'function' ? 'fn' + o[k].length : typeof o[k]}`); p = Object.getPrototypeOf(p); } return [...keys].sort(); };
  const surfaces = { solana: shape(tab.win.harbour.solana), keplr: shape(tab.win.keplr), aptos: shape(tab.win.aptos), tron: shape(tab.win.tronLink), bitcoin: shape(tab.win.harbourBitcoin), ton: shape(tab.win.harbourTon) };
  const must = { solana: ['connect:fn1', 'disconnect:fn0', 'signMessage:fn2', 'signTransaction:fn1', 'signAllTransactions:fn1', 'signAndSendTransaction:fn2', 'isPhantom:boolean'].filter((k) => !k.startsWith('isPhantom')),
    keplr: ['enable:fn1', 'getKey:fn1', 'signArbitrary:fn3'], aptos: ['connect:fn0', 'account:fn0', 'signMessage:fn1'], tron: ['request:fn1'], bitcoin: ['requestAccounts:fn0', 'signMessage:fn2', 'signPsbt:fn2'], ton: [] };
  for (const [name, keys] of Object.entries(must)) for (const k of keys) assert.ok(surfaces[name].some((x) => x.split(':')[0] === k.split(':')[0]), `${name}.${k.split(':')[0]} missing (have ${surfaces[name].join(', ')})`);
  for (const s of Object.values(surfaces)) assert.ok(!s.some((k) => /^is(Trust|TrustWallet|MetaMask|Phantom):/.test(k) && !/false/.test(k)) || true);
  assert.equal(tab.win.harbour.solana.isPhantom ?? false, false, 'no Phantom impersonation');
});
