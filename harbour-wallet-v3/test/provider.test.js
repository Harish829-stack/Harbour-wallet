// dApp provider tests: protocol validation, method allowlist, permission store, origin binding, approval queue + restart resilience,
// EIP-1193 error codes, and signing known-answer vectors. Everything runs against fakes (no chrome.* / network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { keccak_256 } from '@noble/hashes/sha3';
import { ed25519 } from '@noble/curves/ed25519';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({
  stdin: {
    contents: `
      export * from './core/provider/errors'; export * from './core/provider/protocol'; export * from './core/provider/methods'; export * from './core/provider/store';
      export * from './core/provider/ratelimit'; export * from './core/provider/decode'; export * from './core/provider/typed'; export * from './core/provider/siwe';
      export * from './core/provider/solanaTx'; export * from './core/provider/phishing'; export * from './core/provider/origin'; export * from './core/provider/base58'; export * from './core/provider/evmSign';
      export { ProviderService, permission } from './background/provider/service'; export * from './background/provider/fees'; export { ApprovalWindow } from './background/provider/approvalWindow';
      export { makeRpc } from './background/provider/rpc';
      export { isInternalWalletSender } from './background/accessPolicy';`,
    resolveDir: src, sourcefile: 'entry.ts', loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

// ------------------------------------------------------------------ fakes
class MemKV { constructor() { this.m = new Map(); } async get(k) { const v = this.m.get(k); return v === undefined ? undefined : JSON.parse(v); } async set(k, v) { this.m.set(k, JSON.stringify(v)); } async remove(k) { this.m.delete(k); } }
const ADDR0 = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23', ADDR1 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const SOL0 = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', SOL1 = 'GrDMoeqMLFjeXQ24H56S1RLgT4R76jsuWCd6SvXyGPQ5';
const NETS = [
  { chainId: 1, id: 'ethereum', name: 'Ethereum', symbol: 'ETH', decimals: 18, rpcs: ['http://rpc1'], testnet: false, custom: false },
  { chainId: 137, id: 'polygon', name: 'Polygon', symbol: 'POL', decimals: 18, rpcs: ['http://rpc137'], testnet: false, custom: false },
  { chainId: 11155111, id: 'sepolia', name: 'Sepolia', symbol: 'ETH', decimals: 18, rpcs: ['http://rpcs'], testnet: true, custom: false },
];
const sender = (origin = 'https://app.example', o = {}) => ({ tabId: 1, frameId: 0, documentId: 'doc1', origin, topOrigin: origin, isTopFrame: true, title: 'Example dApp', icon: 'https://app.example/f.png', ...o });
let rid = 0; const req = (method, params, ns = 'evm') => ({ id: `r${++rid}`, ns, method, ...(params !== undefined ? { params } : {}) });

function setup(over = {}) {
  const clock = { t: 1_700_000_000_000 };
  const perms = new M.PermissionStore(new MemKV(), () => clock.t), pending = new M.PendingStore(new MemKV(), () => clock.t);
  const log = { delivered: [], events: [], opened: 0, closed: 0, signed: [], rpc: [], sol: [], saved: [], tokens: [] };
  const state = { locked: false, hasVault: true, port: true };
  const signer = {
    accounts: async () => ({ walletId: 'w1', walletName: 'Seed Phrase 1', activeAccount: 0, accounts: [{ index: 0, derivationIndex: 0, name: 'Account 1', evm: ADDR0, solana: SOL0 }, { index: 1, derivationIndex: 1, name: 'Account 2', evm: ADDR1, solana: SOL1 }] }),
    accountOf: async () => null,
    signMessage: async (c, hex, mode) => { log.signed.push(['msg', c.evmAddress, hex, mode]); return '0xsig' + mode; },
    signTypedData: async (c, td) => { log.signed.push(['typed', c.evmAddress, td.primaryType]); return '0xtyped'; },
    sendTransaction: async (c, net, tx, opts) => { log.signed.push(['tx', c.evmAddress, net.chainId, tx, opts]); return '0x' + 'ab'.repeat(32); },
    solSign: async (c, msgs) => { log.signed.push(['sol', c.solanaAddress, msgs.length]); return msgs.map(() => new Uint8Array(64).fill(7)); },
  };
  const deps = {
    // The generic provider is tested with every family and chain on (the v3 build policy is tested separately below).
    policy: { families: { evm: true, solana: true, multi: true }, isSigningEvmChain: () => true, siteAddChain: true, defaultChain: 1 }, 
    perms, pending, signer, now: () => clock.t, version: '9.9.9',
    rpc: async (chainId, method, params) => { log.rpc.push([chainId, method, params]); if (method === 'eth_blockNumber') return '0x10'; if (method === 'eth_call') return '0x'; return null; },
    solRpc: async (m, p) => { log.sol.push([m, p]); return 'SOLSIG'; },
    networks: { list: () => NETS, get: (id) => NETS.find((n) => n.chainId === id) },
    vaultStatus: async () => ({ hasVault: state.hasVault, unlocked: !state.locked }),
    openApproval: async () => { log.opened++; }, closeApprovalIfIdle: async () => { log.closed++; },
    deliver: async (t, reqId, outcome) => { if (!state.port) return false; log.delivered.push({ t, reqId, outcome }); return true; },
    emit: (o, ns, n, d) => log.events.push([o, ns, n, d]),
    probeChainId: async () => 137, saveCustomNetwork: async (n) => { log.saved.push(n); }, addToken: async (t) => { log.tokens.push(t); return { ok: true }; },
    ethSignEnabled: async () => true,
    ...over,
  };
  return { svc: new M.ProviderService(deps), perms, pending, log, clock, state };
}
const pendingOf = async (ctx) => (await ctx.pending.list())[0];
async function connect(ctx, s = sender(), account = 0) {
  const r = await ctx.svc.handle(s, req('eth_requestAccounts'));
  assert.equal(r.done, false); const p = await pendingOf(ctx);
  const res = await ctx.svc.resolve(p.id, { approve: true, accountIndex: account }); assert.equal(res.ok, true); return p;
}

// ------------------------------------------------------------------ protocol + allowlist
test('parsePageRequest keeps only the 4 allowed keys and deep-copies params', () => {
  const r = M.parsePageRequest({ id: 'a1', ns: 'evm', method: 'eth_chainId', params: [1, { a: 'b' }], t: 'INTERNAL_Lock', secret: 'x' });
  assert.equal(r.ok, true); assert.deepEqual(Object.keys(r.req).sort(), ['id', 'method', 'ns', 'params']);
});
test('parsePageRequest rejects malformed, oversize and unsafe payloads', () => {
  for (const bad of [null, [], 'x', 42, {}, { id: 'a', ns: 'btc', method: 'x' }, { id: 'a b', ns: 'evm', method: 'x' }, { id: 'a', ns: 'evm', method: 'a.b' }, { id: 'a', ns: 'evm', method: 'INTERNAL_Lock!' }, { id: 'x'.repeat(65), ns: 'evm', method: 'm' }])
    assert.equal(M.parsePageRequest(bad).ok, false, JSON.stringify(bad));
  assert.equal(M.parsePageRequest({ id: 'a', ns: 'evm', method: 'm', params: [() => 1] }).ok, false);
  assert.equal(M.parsePageRequest({ id: 'a', ns: 'evm', method: 'm', params: JSON.parse('{"__proto__":{"x":1}}') }).ok, false);
  assert.equal(M.parsePageRequest({ id: 'a', ns: 'evm', method: 'm', params: ['x'.repeat(300_000)] }).ok, false);
  assert.equal(M.parsePageRequest({ id: 'a', ns: 'evm', method: 'm', params: [Infinity] }).ok, false);
});
test('method allowlist: wallet UI messages and bridge-namespaced names are not dApp methods', () => {
  for (const m of ['unlock', 'sendTx', 'getAccounts', 'revealMnemonic', 'createWallet', 'networkSave', 'INTERNAL_Lock', 'PUBLIC_Ping', 'lock_callback', 'providerResolve', 'providerView']) assert.equal(M.specFor('evm', m), null, m);
  assert.ok(M.isBridgeNamespaced('INTERNAL_Reset') && M.isBridgeNamespaced('PUBLIC_Ping') && M.isBridgeNamespaced('x_callback'));
  for (const m of ['eth_requestAccounts', 'personal_sign', 'eth_sendTransaction', 'eth_signTypedData_v4', 'wallet_switchEthereumChain', 'eth_getBalance']) assert.ok(M.specFor('evm', m), m);
  assert.equal(M.specFor('evm', 'constructor'), null); assert.equal(M.specFor('evm', '__proto__'), null); assert.equal(M.specFor('solana', 'toString'), null);
  assert.ok(M.UNSUPPORTED_EVM.has('eth_signTransaction') && M.UNSUPPORTED_EVM.has('eth_subscribe') && M.UNSUPPORTED_EVM.has('wallet_sendCalls'));
});
test('event allowlist', () => {
  assert.ok(M.isAllowedEvent('evm', 'accountsChanged') && M.isAllowedEvent('solana', 'disconnect'));
  assert.ok(!M.isAllowedEvent('evm', 'INTERNAL_Lock') && !M.isAllowedEvent('btc', 'connect') && !M.isAllowedEvent('solana', 'chainChanged'));
});
test('internal wallet router never accepts a content-script / web-page sender', () => {
  const id = 'abcdefghijklmnopabcdefghijklmnop';
  assert.equal(M.isInternalWalletSender({ id, url: 'https://evil.example/', tab: { id: 3 } }, id), false);
  assert.equal(M.isInternalWalletSender({ id, url: `chrome-extension://${id}/src/popup/index.html#/approval?x=1` }, id), true);
});

// ------------------------------------------------------------------ origin
test('origin normalisation: https and local http only, opaque origins refused', () => {
  assert.equal(M.normalizeOrigin('https://App.Example/path?q=1'), 'https://app.example');
  assert.equal(M.normalizeOrigin('http://localhost:3000/x'), 'http://localhost:3000');
  for (const o of ['null', '', 'http://evil.example', 'chrome-extension://abc', 'file:///etc', 'javascript:alert(1)', undefined, 5]) assert.equal(M.normalizeOrigin(o), null, String(o));
  assert.ok(M.isPunycodeHost('xn--pple-43d.com')); assert.ok(!M.isPunycodeHost('apple.com'));
  assert.ok(M.isBlockedDomain('mail.google.com') && M.isBlockedDomain('x.com') && !M.isBlockedDomain('box.com') && !M.isBlockedDomain('notx.com'));
});

// ------------------------------------------------------------------ rate limiter
test('token bucket limits bursts and refills over time', () => {
  let t = 0; const rl = new M.RateLimiter({ capacity: 3, refillPerSec: 1 }, () => t);
  assert.ok(rl.take('a') && rl.take('a') && rl.take('a')); assert.ok(!rl.take('a')); assert.ok(rl.take('b'));
  t += 1500; assert.ok(rl.take('a')); assert.ok(!rl.take('a'));
});

// ------------------------------------------------------------------ normalisers
test('personal_sign accepts both param orders, hex and utf8, and rejects bad input', () => {
  const a = M.normalizePersonalSign(['0x48656c6c6f', ADDR0], ADDR0); assert.equal(a.utf8, 'Hello'); assert.equal(a.hexInput, true); assert.equal(a.address, ADDR0);
  const b = M.normalizePersonalSign(['Some data', ADDR0], ADDR0); assert.equal(b.bytesHex, '0x536f6d652064617461'); assert.equal(b.hexInput, false);
  const c = M.normalizePersonalSign([ADDR0.toLowerCase(), 'hi there'], ADDR0); assert.equal(c.utf8, 'hi there'); assert.equal(c.address.toLowerCase(), ADDR0.toLowerCase());
  for (const p of [undefined, [], ['x'], [1, ADDR0], ['x', 'nope'], ['x'.repeat(200_000), ADDR0]]) assert.throws(() => M.normalizePersonalSign(p, ADDR0), (e) => e.code === -32602);
});
test('eth_sign: text uses the personal prefix, otherwise only a raw 32-byte hash is accepted', () => {
  assert.equal(M.normalizeEthSign([ADDR0, '0x68656c6c6f']).rawHash, false);
  const h = '0x' + 'ff'.repeat(32); const n = M.normalizeEthSign([ADDR0, h]); assert.equal(n.rawHash, true);
  assert.throws(() => M.normalizeEthSign([ADDR0, '0x' + 'ff'.repeat(20)]), (e) => e.code === -32602);
  assert.throws(() => M.normalizeEthSign([ADDR0, 'hello']), (e) => e.code === -32602);
});
test('typed data: V1 array form is unsupported (4200), invalid shapes are -32602', () => {
  assert.throws(() => M.normalizeTypedData('eth_signTypedData', [[{ type: 'string', name: 'a', value: 'b' }], ADDR0], ADDR0), (e) => e.code === 4200);
  assert.throws(() => M.normalizeTypedData('eth_signTypedData_v4', [ADDR0, '{not json'], ADDR0), (e) => e.code === -32602);
  assert.throws(() => M.normalizeTypedData('eth_signTypedData_v4', [ADDR0, { types: {}, primaryType: 'X', domain: {}, message: {} }], ADDR0), (e) => e.code === -32602);
  const ok = M.normalizeTypedData('eth_signTypedData_v4', [JSON.stringify(MAIL), ADDR0], ADDR0); assert.equal(ok.version, 'V4'); assert.equal(ok.address, ADDR0);
});
test('eth_sendTransaction normalisation: strict fields, from binding, hex quantities', () => {
  const t = M.normalizeSendTx([{ from: ADDR0.toLowerCase(), to: ADDR1, value: '0x10', data: '0xabcdef', gasLimit: '0x5208' }], ADDR0);
  assert.equal(t.value, '0x10'); assert.equal(t.gas, '0x5208'); assert.equal(t.data, '0xabcdef');
  assert.equal(M.normalizeSendTx([{ to: ADDR1 }], ADDR0).from, ADDR0);
  assert.throws(() => M.normalizeSendTx([{ from: ADDR1, to: ADDR0 }], ADDR0), (e) => e.code === 4100);
  for (const bad of [[{ to: ADDR1, authorizationList: [] }], [{ to: ADDR1, value: '16' }], [{ to: 'nope' }], [{ value: '0x1' }], [{ to: ADDR1, gasPrice: '0x1', maxFeePerGas: '0x2' }], [{ to: ADDR1, type: '0x1' }], [{ to: ADDR1, accessList: [{ address: ADDR0, storageKeys: [] }] }], [], 'x'])
    assert.throws(() => M.normalizeSendTx(bad, ADDR0), (e) => e.code === -32602 || e.code === 4100, JSON.stringify(bad));
});
test('padded quantities (ethers v5 style 0x01) are accepted and canonicalised', () => {
  assert.equal(M.normalizeSendTx([{ to: ADDR1, value: '0x01' }], ADDR0).value, '0x1');
});
test('chain id / add chain / watch asset normalisation', () => {
  assert.equal(M.normalizeSwitchChain([{ chainId: '0x89' }]).chainId, 137);
  for (const c of ['137', '0x0', '0x089', 'abc', 1, undefined]) assert.throws(() => M.normalizeSwitchChain([{ chainId: c }]), (e) => e.code === -32602, String(c));
  const a = M.normalizeAddChain([{ chainId: '0xa86a', chainName: 'Avalanche', nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'], blockExplorerUrls: ['https://snowtrace.io'] }]);
  assert.equal(a.chainId, 43114); assert.equal(a.symbol, 'AVAX');
  assert.throws(() => M.normalizeAddChain([{ chainId: '0x1', chainName: 'x', nativeCurrency: { symbol: 'X', decimals: 8 }, rpcUrls: ['https://x'] }]), (e) => e.code === -32602);
  assert.throws(() => M.normalizeAddChain([{ chainId: '0x1', chainName: 'x', nativeCurrency: { symbol: 'X' }, rpcUrls: [] }]), (e) => e.code === -32602);
  assert.equal(M.normalizeWatchAsset({ type: 'ERC20', options: { address: ADDR0, symbol: 'ABC', decimals: 6, image: 'http://x/y.png' } }).image, undefined);
  assert.throws(() => M.normalizeWatchAsset({ type: 'ERC721', options: { address: ADDR0 } }), (e) => e.code === -32602);
});
test('solana params: base64 only, bounded', () => {
  assert.equal(M.normalizeSolMessage({ message: 'aGVsbG8=' }).length, 5);
  assert.throws(() => M.normalizeSolMessage({ message: 'not base64!!' }));
  assert.throws(() => M.normalizeSolTx({ transaction: 'AAAA' }));
  assert.throws(() => M.normalizeSolTx({ transactions: [] }));
});

// ------------------------------------------------------------------ error codes
test('serializeError maps to EIP-1193 / EIP-1474 codes without leaking internals', () => {
  assert.deepEqual(M.serializeError(new M.ProviderError(4001)), { code: 4001, message: 'User rejected the request.' });
  assert.equal(M.serializeError(new M.ProviderError(4100)).code, 4100); assert.equal(M.serializeError(new M.ProviderError(4200)).code, 4200);
  assert.equal(M.serializeError(new M.ProviderError(4900)).code, 4900); assert.equal(M.serializeError(new M.ProviderError(4901)).code, 4901); assert.equal(M.serializeError(new M.ProviderError(-32602)).code, -32602);
  const w = M.serializeError(Object.assign(new Error('boom\n    at secret (file.js:1)'), { stack: 'secret stack' })); assert.equal(w.code, -32603); assert.ok(!('stack' in w));
  assert.equal(M.serializeError({ code: 3, message: 'revert' }).code, -32603);
  assert.equal(M.serializeError({ code: 4001, message: 'no' }).code, 4001);
  assert.equal(M.ERR.USER_REJECTED, 4001); assert.equal(M.ERR.UNRECOGNIZED_CHAIN, 4902); assert.equal(M.ERR.INVALID_PARAMS, -32602); assert.equal(M.ERR.INTERNAL, -32603);
});

// ------------------------------------------------------------------ permission store
test('permission store: per-origin connections, namespaces, ids, serialised writes', async () => {
  const ctx = setup(); const { perms } = ctx;
  const base = { walletId: 'w1', walletName: 'W', accountIndex: 0, accountName: 'A', chainId: 1 };
  await Promise.all(Array.from({ length: 20 }, (_, i) => perms.connect({ ...base, origin: `https://s${i}.example`, evmAddress: ADDR0, namespaces: ['evm'] })));
  assert.equal((await perms.all()).length, 20);
  const c = await perms.connect({ ...base, origin: 'https://s1.example', solanaAddress: SOL0, namespaces: ['solana'] });
  assert.deepEqual(c.namespaces.sort(), ['evm', 'solana']); assert.equal((await perms.all()).length, 20);
  assert.ok(await perms.isConnected('https://s1.example', 'solana')); assert.equal(await perms.isConnected('https://s2.example', 'solana'), undefined);
  assert.equal(await perms.get('https://s1.example.evil.com'), undefined); assert.equal(await perms.get('constructor'), undefined);
  await perms.disconnect('https://s1.example', 'solana'); assert.deepEqual((await perms.get('https://s1.example')).namespaces, ['evm']);
  await perms.disconnect('https://s1.example', 'evm'); assert.equal(await perms.get('https://s1.example'), undefined);
  assert.equal((await perms.disconnectAll()).length, 19); assert.equal((await perms.all()).length, 0);
});
test('blacklist matches by hostname, drops connections, can be undone', async () => {
  const { perms } = setup();
  await perms.connect({ walletId: 'w', walletName: 'W', accountIndex: 0, accountName: 'A', chainId: 1, origin: 'https://bad.example', evmAddress: ADDR0, namespaces: ['evm'] });
  const item = await perms.addBlacklist('https://bad.example', { title: 'Bad' });
  assert.ok(await perms.isBlacklisted('https://bad.example')); assert.ok(await perms.isBlacklisted('http://bad.example:8080')); assert.ok(!(await perms.isBlacklisted('https://good.example'))); assert.ok(!(await perms.isBlacklisted('https://sub.bad.example')));
  assert.equal(await perms.get('https://bad.example'), undefined);
  assert.equal((await perms.addBlacklist('https://bad.example')).id, item.id);
  assert.ok(await perms.removeBlacklist(item.id)); assert.ok(!(await perms.isBlacklisted('https://bad.example')));
});
test('pending store: dedupe key, atomic take, expiry, settled hand-off', async () => {
  const { pending, clock } = setup();
  const base = { key: '1:0:r1', reqId: 'r1', ns: 'evm', method: 'eth_requestAccounts', kind: 'connect', params: {}, origin: 'https://a.example', topOrigin: 'https://a.example', isTopFrame: true, tabId: 1, frameId: 0 };
  const p = await pending.add(base);
  assert.equal((await pending.findByKey('1:0:r1')).id, p.id);
  const [x, y] = await Promise.all([pending.take(p.id), pending.take(p.id)]); assert.ok((x && !y) || (!x && y));
  const q = await pending.add({ ...base, key: '1:0:r2' }); clock.t += M.PENDING_TTL_MS + 1; assert.equal((await pending.expired()).length, 1); assert.equal(await pending.get(q.id), undefined);
  await pending.putSettled('k', { result: 5 }); assert.deepEqual(await pending.takeSettled('k'), { result: 5 }); assert.deepEqual(await pending.takeSettled('k'), { result: 5 }); clock.t += M.SETTLED_TTL_MS + 1; assert.equal(await pending.takeSettled('k'), undefined);
});

// ------------------------------------------------------------------ service: connect + permissions
test('eth_requestAccounts queues one approval, opens the window, resolves the page promise and emits events', async () => {
  const ctx = setup(); const s = sender();
  assert.deepEqual((await ctx.svc.handle(s, req('eth_accounts'))).outcome, { result: [] });
  const r = req('eth_requestAccounts'); const h = await ctx.svc.handle(s, r); assert.equal(h.done, false); assert.equal(ctx.log.opened, 1);
  const p = await pendingOf(ctx); assert.equal(p.origin, s.origin); assert.equal(p.kind, 'connect');
  const res = await ctx.svc.resolve(p.id, { approve: true, accountIndex: 1, chainId: 137 }); assert.equal(res.ok, true);
  assert.deepEqual(ctx.log.delivered[0].outcome, { result: [ADDR1] }); assert.equal(ctx.log.delivered[0].reqId, r.id);
  assert.deepEqual(ctx.log.events.map((e) => e[2]), ['accountsChanged', 'chainChanged', 'connect']);
  assert.deepEqual((await ctx.svc.handle(s, req('eth_accounts'))).outcome, { result: [ADDR1] });
  assert.deepEqual((await ctx.svc.handle(s, req('eth_chainId'))).outcome, { result: '0x89' }); assert.deepEqual((await ctx.svc.handle(s, req('net_version'))).outcome, { result: '137' });
  assert.deepEqual((await ctx.svc.handle(s, req('eth_requestAccounts'))).outcome, { result: [ADDR1] });
  assert.equal((await ctx.pending.list()).length, 0);
});
test('reject resolves the dApp with 4001; a second concurrent connect is -32002', async () => {
  const ctx = setup(); const s = sender();
  await ctx.svc.handle(s, req('eth_requestAccounts'));
  const dup = await ctx.svc.handle(s, req('eth_requestAccounts')); assert.equal(dup.outcome.error.code, -32002);
  const p = await pendingOf(ctx); assert.equal((await ctx.svc.resolve(p.id, { approve: false })).ok, true);
  assert.equal(ctx.log.delivered[0].outcome.error.code, 4001);
  assert.equal((await ctx.svc.resolve(p.id, { approve: true })).ok, false);
});
test('permissions are bound to the exact origin: other sites and sub-frames do not inherit a connection', async () => {
  const ctx = setup(); await connect(ctx, sender('https://app.example'));
  assert.deepEqual((await ctx.svc.handle(sender('https://other.example'), req('eth_accounts'))).outcome.result, []);
  const frame = sender('https://evil-frame.example', { frameId: 7, topOrigin: 'https://app.example', isTopFrame: false });
  assert.deepEqual((await ctx.svc.handle(frame, req('eth_accounts'))).outcome.result, []);
  const r = await ctx.svc.handle(frame, req('personal_sign', ['hi', ADDR0])); assert.equal(r.outcome.error.code, 4100);
  const p = await ctx.svc.handle(sender('https://app.example.evil.com'), req('eth_sendTransaction', [{ to: ADDR1 }])); assert.equal(p.outcome.error.code, 4100);
  assert.equal((await ctx.pending.list()).length, 0);
});
test('a sub-frame request is queued with its own origin and the embedding page recorded', async () => {
  const ctx = setup(); const frame = sender('https://widget.example', { frameId: 4, topOrigin: 'https://host.example', isTopFrame: false });
  await ctx.svc.handle(frame, req('eth_requestAccounts')); const p = await pendingOf(ctx);
  assert.equal(p.origin, 'https://widget.example'); assert.equal(p.topOrigin, 'https://host.example'); assert.equal(p.isTopFrame, false); assert.equal(p.frameId, 4);
});
test('unsupported / unknown methods: 4200 vs -32601, and no UI-message injection', async () => {
  const ctx = setup(); const s = sender();
  for (const m of ['eth_signTransaction', 'eth_subscribe', 'wallet_sendCalls', 'eth_newFilter', 'eth_decrypt']) assert.equal((await ctx.svc.handle(s, req(m, []))).outcome.error.code, 4200, m);
  for (const m of ['unlock', 'sendTx', 'revealMnemonic', 'INTERNAL_Lock', 'providerResolve']) assert.equal((await ctx.svc.handle(s, req(m, []))).outcome.error.code, -32601, m);
  assert.equal((await ctx.svc.handle(s, req('connect', undefined, 'solana'))).done, false);
  assert.equal((await ctx.svc.handle(s, req('eth_accounts', undefined, 'solana'))).outcome.error.code, -32601);
});
test('blacklisted sites get nothing but static chain info', async () => {
  const ctx = setup(); await ctx.perms.addBlacklist('https://bad.example'); const s = sender('https://bad.example');
  assert.equal((await ctx.svc.handle(s, req('eth_requestAccounts'))).outcome.error.code, 4100);
  assert.deepEqual((await ctx.svc.handle(s, req('eth_accounts'))).outcome.result, []);
  assert.equal((await ctx.svc.handle(s, req('eth_blockNumber'))).outcome.error.code, 4100);
  assert.equal(ctx.log.opened, 0);
});
test('no wallet yet -> 4100; locked wallet keeps the request and asks the UI to unlock', async () => {
  const a = setup(); a.state.hasVault = false; assert.equal((await a.svc.handle(sender(), req('eth_requestAccounts'))).outcome.error.code, 4100);
  const b = setup(); b.state.locked = true; await b.svc.handle(sender(), req('eth_requestAccounts')); assert.equal(b.log.opened, 1);
  const p = await pendingOf(b); const r = await b.svc.resolve(p.id, { approve: true }); assert.equal(r.locked, true); assert.ok(await b.pending.get(p.id));
  b.state.locked = false; assert.equal((await b.svc.resolve(p.id, { approve: true })).ok, true);
});
test('wallet_requestPermissions / getPermissions / revokePermissions (EIP-2255 shape)', async () => {
  const ctx = setup(); const s = sender();
  assert.deepEqual((await ctx.svc.handle(s, req('wallet_getPermissions'))).outcome.result, []);
  await ctx.svc.handle(s, req('wallet_requestPermissions', [{ eth_accounts: {} }])); const p = await pendingOf(ctx); await ctx.svc.resolve(p.id, { approve: true });
  const perm = ctx.log.delivered[0].outcome.result[0]; assert.equal(perm.parentCapability, 'eth_accounts'); assert.deepEqual(perm.caveats[0], { type: 'restrictReturnedAccounts', value: [ADDR0] }); assert.equal(perm.invoker, s.origin);
  assert.equal((await ctx.svc.handle(s, req('wallet_getPermissions'))).outcome.result.length, 1);
  assert.equal((await ctx.svc.handle(s, req('wallet_revokePermissions', [{ eth_accounts: {} }]))).outcome.result, null);
  assert.deepEqual((await ctx.svc.handle(s, req('eth_accounts'))).outcome.result, []);
  assert.ok(ctx.log.events.some((e) => e[2] === 'accountsChanged' && e[3].length === 0));
});

// ------------------------------------------------------------------ service: rpc proxy, rate limits
test('read RPC is proxied to the origin chain; params must be an array', async () => {
  const ctx = setup(); const s = sender();
  assert.deepEqual((await ctx.svc.handle(s, req('eth_blockNumber'))).outcome, { result: '0x10' }); assert.equal(ctx.log.rpc[0][0], 1);
  await connect(ctx, s); await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x89' }]));
  await ctx.svc.handle(s, req('eth_blockNumber')); assert.equal(ctx.log.rpc.at(-1)[0], 137);
  assert.equal((await ctx.svc.handle(s, req('eth_call', { to: ADDR0 }))).outcome.error.code, -32602);
});
test('requests are rate limited per origin (-32005) and approvals per origin per minute', async () => {
  const ctx = setup(); const s = sender(); let limited = 0;
  for (let i = 0; i < 200; i++) if ((await ctx.svc.handle(s, req('eth_blockNumber'))).outcome?.error?.code === -32005) limited++;
  assert.ok(limited > 50); assert.equal((await ctx.svc.handle(sender('https://calm.example'), req('eth_blockNumber'))).outcome.result, '0x10');
  const c2 = setup(); let got = 0; for (let i = 0; i < 12; i++) { const r = await c2.svc.handle(sender('https://spam.example', { frameId: i }), req('eth_requestAccounts')); if (r.outcome?.error?.code === -32005) got++; }
  assert.ok(got >= 1 && c2.log.opened <= 6);
  const c3 = setup(); for (let i = 0; i < 40; i++) await c3.svc.handle(sender(`https://o${i % 9}.example`, { frameId: i }), req('eth_requestAccounts')); assert.ok((await c3.pending.list()).length <= M.MAX_PENDING_TOTAL);
});

// ------------------------------------------------------------------ service: signing flows
const MAIL = { types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }], Person: [{ name: 'name', type: 'string' }, { name: 'wallet', type: 'address' }], Mail: [{ name: 'from', type: 'Person' }, { name: 'to', type: 'Person' }, { name: 'contents', type: 'string' }] }, primaryType: 'Mail', domain: { name: 'Ether Mail', version: '1', chainId: 1, verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' }, message: { from: { name: 'Cow', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' }, to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' }, contents: 'Hello, Bob!' } };
test('personal_sign / eth_sign / typed data require a connection, the connected account, and the approval', async () => {
  const ctx = setup(); const s = sender();
  assert.equal((await ctx.svc.handle(s, req('personal_sign', ['hi', ADDR0]))).outcome.error.code, 4100);
  await connect(ctx, s, 0); ctx.log.delivered.length = 0;
  assert.equal((await ctx.svc.handle(s, req('personal_sign', ['hi', ADDR1]))).outcome.error.code, 4100);
  await ctx.svc.handle(s, req('personal_sign', ['0x68690a', ADDR0])); let p = await pendingOf(ctx); assert.equal(p.kind, 'sign'); assert.equal(ctx.log.signed.length, 0);
  await ctx.svc.resolve(p.id, { approve: true }); assert.deepEqual(ctx.log.signed[0], ['msg', ADDR0, '0x68690a', 'personal']); assert.equal(ctx.log.delivered[0].outcome.result, '0xsigpersonal');
  await ctx.svc.handle(s, req('eth_sign', [ADDR0, '0x' + 'ee'.repeat(32)])); p = await pendingOf(ctx); await ctx.svc.resolve(p.id, { approve: true }); assert.equal(ctx.log.signed.at(-1)[3], 'rawHash');
  await ctx.svc.handle(s, req('eth_signTypedData_v4', [ADDR0, JSON.stringify(MAIL)])); p = await pendingOf(ctx); assert.equal(p.kind, 'typed'); await ctx.svc.resolve(p.id, { approve: true }); assert.equal(ctx.log.delivered.at(-1).outcome.result, '0xtyped');
});
test('typed data / tx naming another known chain switch a connected site there first; unknown chains are refused (-32602)', async () => {
  const ctx = setup(); const s = sender(); await connect(ctx, s); ctx.log.events.length = 0;
  const td = { ...MAIL, domain: { ...MAIL.domain, chainId: 137 } };
  assert.equal((await ctx.svc.handle(s, req('eth_signTypedData_v4', [ADDR0, JSON.stringify(td)]))).done, false);
  assert.equal((await ctx.perms.get(s.origin)).chainId, 137); assert.deepEqual(ctx.log.events.find((e) => e[2] === 'chainChanged'), [s.origin, 'evm', 'chainChanged', '0x89']);
  assert.equal((await pendingOf(ctx)).kind, 'typed');
  const c2 = setup(); await connect(c2, s);
  assert.equal((await c2.svc.handle(s, req('eth_sendTransaction', [{ to: ADDR1, chainId: '0x89' }]))).done, false);
  assert.equal((await c2.perms.get(s.origin)).chainId, 137); assert.equal((await pendingOf(c2)).kind, 'tx');
  const c3 = setup(); await connect(c3, s);
  assert.equal((await c3.svc.handle(s, req('eth_signTypedData_v4', [ADDR0, JSON.stringify({ ...MAIL, domain: { ...MAIL.domain, chainId: 56 } })]))).outcome.error.code, -32602);
  assert.equal((await c3.svc.handle(s, req('eth_sendTransaction', [{ to: ADDR1, chainId: '0x38' }]))).outcome.error.code, -32602);
  assert.equal((await c3.pending.list()).length, 0); assert.equal((await c3.perms.get(s.origin)).chainId, 1);
});
test('eth_sendTransaction: approval signs/broadcasts with the connected account and tracks approve() calls', async () => {
  const ctx = setup(); const s = sender(); await connect(ctx, s); ctx.log.delivered.length = 0;
  const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const data = '0x095ea7b3' + ADDR1.slice(2).toLowerCase().padStart(64, '0') + 'f'.repeat(64);
  await ctx.svc.handle(s, req('eth_sendTransaction', [{ from: ADDR0, to: token, data }])); const p = await pendingOf(ctx); assert.equal(p.kind, 'tx');
  await ctx.svc.resolve(p.id, { approve: true, gasLimit: '60000', fee: { maxFeePerGas: '30000000000', maxPriorityFeePerGas: '1500000000' } });
  const [, from, chainId, tx, opts] = ctx.log.signed.at(-1); assert.equal(from, ADDR0); assert.equal(chainId, 1); assert.equal(tx.to, token); assert.equal(opts.gas, 60000n); assert.equal(opts.fee.maxFeePerGas, 30000000000n);
  assert.equal(ctx.log.delivered.at(-1).outcome.result, '0x' + 'ab'.repeat(32));
  await new Promise((r) => setTimeout(r, 5)); const tracked = await ctx.perms.approvals(); assert.equal(tracked.length, 1); assert.equal(tracked[0].unlimited, true); assert.equal(tracked[0].spender.toLowerCase(), ADDR1.toLowerCase());
});
test('a signing failure reaches the dApp as a -32603 error without leaking internals', async () => {
  const ctx = setup({}); const s = sender(); await connect(ctx, s); ctx.log.delivered.length = 0;
  ctx.svc.d.signer.sendTransaction = async () => { throw Object.assign(new Error('insufficient funds for gas'), { stack: 'hidden' }); };
  await ctx.svc.handle(s, req('eth_sendTransaction', [{ to: ADDR1, value: '0x1' }])); const r = await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true, fee: { gasPrice: '1' } });
  assert.equal(r.ok, false); const e = ctx.log.delivered.at(-1).outcome.error; assert.equal(e.code, -32603); assert.match(e.message, /insufficient funds/); assert.ok(!('stack' in e));
});

// ------------------------------------------------------------------ service: chains, assets
test('wallet_switchEthereumChain: 4902 for unknown chains; a connected site switches silently (no approval), an unconnected one gets 4100', async () => {
  const ctx = setup(); const s = sender(); await connect(ctx, s); ctx.log.events.length = 0;
  assert.equal((await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x38' }]))).outcome.error.code, 4902);
  assert.deepEqual((await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x1' }]))).outcome, { result: null });
  assert.deepEqual(ctx.log.events.find((e) => e[2] === 'chainChanged'), [s.origin, 'evm', 'chainChanged', '0x1']);   // current chain is re-announced, like Trust Wallet
  ctx.log.events.length = 0;
  assert.deepEqual((await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x89' }]))).outcome, { result: null });
  assert.equal(await pendingOf(ctx), undefined);
  assert.deepEqual(ctx.log.events.find((e) => e[2] === 'chainChanged'), [s.origin, 'evm', 'chainChanged', '0x89']);
  assert.equal((await ctx.perms.get(s.origin)).chainId, 137);
  const c2 = setup(); const un = await c2.svc.handle(sender('https://new.example'), req('wallet_switchEthereumChain', [{ chainId: '0x89' }])); assert.equal(un.outcome.error.code, 4100);
});
test('wallet_addEthereumChain: validates, checks the RPC chain id, saves, then switches', async () => {
  const ctx = setup(); const s = sender(); await connect(ctx, s);
  const chain = (o = {}) => [{ chainId: '0x2105a', chainName: 'My Chain', nativeCurrency: { name: 'MYC', symbol: 'MYC', decimals: 18 }, rpcUrls: ['http://insecure.example', 'https://rpc.mychain.example'], blockExplorerUrls: ['https://scan.mychain.example'], ...o }];
  assert.equal((await ctx.svc.handle(s, req('wallet_addEthereumChain', chain({ rpcUrls: ['http://insecure.example'] })))).outcome.error.code, -32602);
  await ctx.svc.handle(s, req('wallet_addEthereumChain', chain())); const p = await pendingOf(ctx); assert.equal(p.params.network.rpcUrl, 'https://rpc.mychain.example');
  const bad = await ctx.svc.resolve(p.id, { approve: true }); assert.equal(bad.ok, false); assert.equal(ctx.log.saved.length, 0);
  const ctx2 = setup({ probeChainId: async () => 0x2105a }); await connect(ctx2, s); await ctx2.svc.handle(s, req('wallet_addEthereumChain', chain())); await ctx2.svc.resolve((await pendingOf(ctx2)).id, { approve: true });
  assert.equal(ctx2.log.saved[0].chainId, 0x2105a); assert.equal(ctx2.log.saved[0].rpcUrl, 'https://rpc.mychain.example'); assert.equal(ctx2.log.delivered.at(-1).outcome.result, null);
  const ctx3 = setup(); await connect(ctx3, s);
  ctx3.log.events.length = 0;
  assert.deepEqual((await ctx3.svc.handle(s, req('wallet_addEthereumChain', chain({ chainId: '0x89' })))).outcome, { result: null });
  assert.equal(await pendingOf(ctx3), undefined);
  assert.equal(ctx3.log.saved.length, 0);
  assert.equal((await ctx3.perms.get(s.origin)).chainId, 137);   // a chain the wallet already has is a switch (Trust Wallet WalletAddEthereumChain)
  assert.deepEqual(ctx3.log.events.find((e) => e[2] === 'chainChanged'), [s.origin, 'evm', 'chainChanged', '0x89']);
});
test('ChainList repeat add uses the saved chain ID, never its new label or RPC', async () => {
  const saved = { chainId: 84532, id: 'custom-84532', name: 'Crynux on Base Sepolia', symbol: 'ETH', decimals: 18, rpcs: ['https://saved.example/rpc'], testnet: true, custom: true };
  const ctx = setup({ networks: { list: () => [...NETS, saved], get: (id) => [...NETS, saved].find((n) => n.chainId === id) } });
  const s = sender('https://chainlist.org'); await connect(ctx, s);
  const add = req('wallet_addEthereumChain', [{ chainId: '0x14a34', chainName: 'Base Sepolia Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://lb.routeme.sh/rpc/evm/84532'], blockExplorerUrls: ['https://sepolia.basescan.org'] }]);
  ctx.log.events.length = 0;
  assert.deepEqual((await ctx.svc.handle(s, add)).outcome, { result: null });
  assert.equal(await pendingOf(ctx), undefined);
  assert.equal(ctx.log.opened, 1, 'only the initial connect approval opened');
  assert.deepEqual(ctx.log.saved, []);
  assert.equal((await ctx.perms.get(s.origin)).chainId, 84532);
  assert.deepEqual(ctx.log.events, [[s.origin, 'evm', 'chainChanged', '0x14a34'], [s.origin, 'evm', 'networkChanged', '84532']]);
  assert.equal(saved.rpcs[0], 'https://saved.example/rpc');
  const sw = await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x14a34' }]));
  assert.equal(sw.done, true);
  assert.equal((await ctx.perms.get(s.origin)).chainId, 84532);
});
test('a pending add cannot overwrite a network added in Settings before approval', async () => {
  let added;
  const ctx = setup({ networks: { list: () => [...NETS, ...(added ? [added] : [])], get: (id) => [...NETS, ...(added ? [added] : [])].find((n) => n.chainId === id) } });
  const s = sender(); await connect(ctx, s);
  const r = await ctx.svc.handle(s, req('wallet_addEthereumChain', [{ chainId: '0x1092', chainName: 'Test Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://site.example/rpc'] }]));
  assert.equal(r.done, false);
  const p = await pendingOf(ctx);
  added = { chainId: 4242, id: 'custom-4242', name: 'My saved Test Chain', symbol: 'ETH', decimals: 18, rpcs: ['https://saved.example/rpc'], testnet: true, custom: true };
  await ctx.svc.resolve(p.id, { approve: true });
  assert.deepEqual(ctx.log.saved, []);
  assert.equal((await ctx.perms.get(s.origin)).chainId, 1);
  assert.equal(ctx.log.delivered.at(-1).outcome.result, null);
});
test('wallet_watchAsset reads symbol/decimals from the chain, never from the page', async () => {
  const symbolHex = '0x' + '20'.padStart(64, '0') + '3'.padStart(64, '0') + Buffer.from('ABC').toString('hex').padEnd(64, '0');
  const ctx = setup({ rpc: async (c, m, p) => (m === 'eth_call' ? (p[0].data === '0x95d89b41' ? symbolHex : p[0].data === '0x313ce567' ? '0x' + (6).toString(16).padStart(64, '0') : '0x') : null) });
  const s = sender(); await connect(ctx, s);
  await ctx.svc.handle(s, req('wallet_watchAsset', { type: 'ERC20', options: { address: ADDR1, symbol: 'SCAM', decimals: 18 } })); await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true });
  assert.equal(ctx.log.tokens[0].symbol, 'ABC'); assert.equal(ctx.log.tokens[0].decimals, 6); assert.equal(ctx.log.tokens[0].walletId, 'w1'); assert.equal(ctx.log.delivered.at(-1).outcome.result, true);
  const bad = setup(); await connect(bad, s); await bad.svc.handle(s, req('wallet_watchAsset', { type: 'ERC20', options: { address: ADDR1 } })); const r = await bad.svc.resolve((await pendingOf(bad)).id, { approve: true }); assert.equal(r.ok, false); assert.equal(bad.log.tokens.length, 0);
});

// ------------------------------------------------------------------ restart resilience
test('pending requests survive a worker restart; re-sent request not duplicated; undeliverable results parked', async () => {
  const ctx = setup(); const s = sender(); const r = req('eth_requestAccounts');
  await ctx.svc.handle(s, r);
  const reborn = new M.ProviderService({ ...ctx.svc.d });
  assert.equal((await reborn.handle(s, r)).done, false); assert.equal((await ctx.pending.list()).length, 1); assert.equal(ctx.log.opened, 1);
  ctx.state.port = false;
  const p = await pendingOf(ctx); await reborn.resolve(p.id, { approve: true });
  assert.equal(ctx.log.delivered.length, 0);
  const settled = await reborn.takeSettled(M.senderKey(s, r.id)); assert.deepEqual(settled, { result: [ADDR0] }); assert.deepEqual(await reborn.takeSettled(M.senderKey(s, r.id)), settled);
});
test('page navigation drops its pending requests; window close / expiry reject them with 4001', async () => {
  const ctx = setup(); const s = sender(); await ctx.svc.handle(s, req('eth_requestAccounts')); await ctx.svc.dropFor(1, 0, 'doc1'); assert.equal((await ctx.pending.list()).length, 0);
  await ctx.svc.handle(s, req('eth_requestAccounts')); assert.equal(await ctx.svc.rejectWhere(() => true), 1); assert.equal(ctx.log.delivered.at(-1).outcome.error.code, 4001);
  await ctx.svc.handle(sender('https://b.example'), req('eth_requestAccounts')); ctx.clock.t += M.PENDING_TTL_MS + 5; await ctx.svc.gc(); assert.equal((await ctx.pending.list()).length, 0); assert.match(ctx.log.delivered.at(-1).outcome.error.message, /expired/);
  await ctx.svc.handle(s, req('eth_requestAccounts')); await ctx.svc.dropFor(1, 0, 'other-doc'); assert.equal((await ctx.pending.list()).length, 1);
});
test('approval window: reused while open, recreated when closed, closed when idle', async () => {
  const kv = new MemKV(); const pending = new M.PendingStore(kv); const calls = []; let alive = true;
  const w = new M.ApprovalWindow({ create: async (o) => { calls.push(['create', o.url, o.type]); return { id: 42 }; }, get: async () => (alive ? { id: 42 } : undefined), update: async (id) => { calls.push(['update', id]); }, remove: async (id) => { calls.push(['remove', id]); }, getLastFocused: async () => ({ left: 0, top: 0, width: 1200 }) }, kv, pending, 'chrome-extension://x/src/popup/index.html#/approval');
  await Promise.all([w.open(), w.open()]); assert.equal(calls.filter((c) => c[0] === 'create').length, 1);
  await w.open(); assert.deepEqual(calls.at(-1), ['update', 42]);
  alive = false; await w.open(); assert.equal(calls.filter((c) => c[0] === 'create').length, 2);
  await pending.add({ key: 'k', reqId: 'r', ns: 'evm', method: 'm', kind: 'connect', params: {}, origin: 'https://a.example', topOrigin: 'https://a.example', isTopFrame: true, tabId: 1, frameId: 0 });
  await w.closeIfIdle(); assert.ok(!calls.some((c) => c[0] === 'remove')); await pending.takeWhere(() => true); await w.closeIfIdle(); assert.deepEqual(calls.at(-1), ['remove', 42]);
});

// ------------------------------------------------------------------ decoding, typed data summary, SIWE
test('calldata decoding: ERC-20 transfer/approve, unlimited allowance, NFT approval-for-all, unknown', () => {
  const to = ADDR1.slice(2).toLowerCase().padStart(64, '0');
  const t = M.decodeCalldata('0xa9059cbb' + to + (1000000n).toString(16).padStart(64, '0')); assert.equal(t.kind, 'transfer'); assert.equal(t.amount, 1000000n); assert.equal(t.to.toLowerCase(), ADDR1.toLowerCase());
  const a = M.decodeCalldata('0x095ea7b3' + to + 'f'.repeat(64)); assert.equal(a.kind, 'approve'); assert.ok(M.isUnlimited(a.amount)); assert.ok(!M.isUnlimited(10n ** 24n));
  const s = M.decodeCalldata('0xa22cb465' + to + '1'.padStart(64, '0')); assert.equal(s.kind, 'setApprovalForAll'); assert.equal(s.approved, true);
  assert.equal(M.decodeCalldata('0xdeadbeef00').kind, 'unknown'); assert.equal(M.decodeCalldata('0x').kind, 'none'); assert.equal(M.decodeCalldata('0xa9059cbb1234').kind, 'unknown');
  assert.equal(M.encodeApprove(ADDR1, 0n), '0x095ea7b3' + to + '0'.repeat(64));
});
test('typed data summary flags permit-style signatures and marketplace orders', () => {
  const permit = { types: { Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] }, primaryType: 'Permit', domain: { name: 'USDC', version: '2', chainId: 1, verifyingContract: ADDR1 }, message: { owner: ADDR0, spender: ADDR1, value: (2n ** 256n - 1n).toString(), nonce: 0, deadline: 1900000000 } };
  const s = M.summarizeTypedData(permit); assert.equal(s.approvals[0].kind, 'permit'); assert.equal(s.approvals[0].unlimited, true); assert.ok(s.warnings.includes('unlimited')); assert.equal(s.approvals[0].token, ADDR1);
  const p2 = { types: { PermitSingle: [{ name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }], PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }] }, primaryType: 'PermitSingle', domain: { name: 'Permit2', chainId: 1, verifyingContract: ADDR1 }, message: { details: { token: ADDR0, amount: '1000', expiration: 1900000000, nonce: 0 }, spender: ADDR1, sigDeadline: 1900000000 } };
  const s2 = M.summarizeTypedData(p2); assert.equal(s2.approvals[0].kind, 'permit2'); assert.equal(s2.approvals[0].unlimited, false); assert.equal(s2.approvals[0].amount, '1000');
  const order = M.summarizeTypedData({ types: { OrderComponents: [{ name: 'offer', type: 'string' }] }, primaryType: 'OrderComponents', domain: {}, message: { offer: 'x' } }); assert.ok(order.warnings.includes('order'));
  assert.deepEqual(M.summarizeTypedData(MAIL).approvals, []);
});
test('SIWE (EIP-4361) parsing and mismatch detection', () => {
  const msg = `app.example wants you to sign in with your Ethereum account:\n${ADDR0}\n\nSign in to Example.\n\nURI: https://app.example/login\nVersion: 1\nChain ID: 1\nNonce: abc12345\nIssued At: 2026-01-01T00:00:00Z`;
  const s = M.parseSiwe(msg); assert.equal(s.domain, 'app.example'); assert.equal(s.chainId, 1); assert.equal(s.statement, 'Sign in to Example.');
  assert.deepEqual(M.siweIssues(s, { host: 'app.example', address: ADDR0, chainId: 1 }), []);
  assert.deepEqual(M.siweIssues(s, { host: 'evil.example', address: ADDR1, chainId: 137 }).sort(), ['address', 'chain', 'domain']);
  assert.equal(M.parseSiwe('hello'), null);
});

// ------------------------------------------------------------------ phishing list
test('site risk: blocklist hit, whitelist override, cache, and honest "unavailable"', async () => {
  M.resetPhishingCache();
  const cfg = { blacklist: ['scam.example', 'evil.io'], whitelist: ['ok.scam.example'] }; let fetches = 0;
  const f = async () => { fetches++; return { ok: true, json: async () => cfg }; };
  const kv = new MemKV(); const now = () => 1000;
  assert.deepEqual(await M.siteRisk('https://scam.example', kv, f, now), { level: 'high', reason: 'blocklist' });
  assert.deepEqual(await M.siteRisk('https://login.scam.example', kv, f, now), { level: 'high', reason: 'blocklist' });
  assert.deepEqual(await M.siteRisk('https://ok.scam.example', kv, f, now), { level: 'ok' });
  assert.deepEqual(await M.siteRisk('https://fine.example', kv, f, now), { level: 'ok' }); assert.equal(fetches, 2); // MetaMask list + ScamSniffer domains, once each (then cached)
  M.resetPhishingCache(); assert.deepEqual(await M.siteRisk('https://evil.io', kv, async () => { throw new Error('offline'); }, now), { level: 'high', reason: 'blocklist' });
  M.resetPhishingCache(); assert.deepEqual(await M.siteRisk('https://fine.example', new MemKV(), async () => { throw new Error('offline'); }, now), { level: 'unavailable' });
  assert.equal(M.parsePhishingConfig({ nope: 1 }), null);
});


test('pending signing approval is bound to the original connection, account and chain', async () => {
  for (const method of ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction']) {
    const ctx = setup(), s = sender(); await connect(ctx, s);
    const params = method === 'personal_sign' ? ['hello', ADDR0] : method === 'eth_sendTransaction' ? [{ to: ADDR1, value: '0x1' }] : [ADDR0, MAIL];
    await ctx.svc.handle(s, req(method, params)); const p = await pendingOf(ctx);
    const c = await ctx.perms.get(s.origin); await ctx.perms.disconnect(s.origin);
    await ctx.perms.connect({ ...c, accountIndex: 1, evmAddress: ADDR1 });
    const result = await ctx.svc.resolve(p.id, { approve: true });
    assert.equal(result.ok, false); assert.match(result.error, /connection changed/); assert.equal(ctx.log.signed.length, 0);
  }
});
test('chain changes invalidate queued typed-data approvals', async () => {
  const ctx = setup(), s = sender(); await connect(ctx, s);
  await ctx.svc.handle(s, req('eth_signTypedData_v4', [ADDR0, MAIL])); const p = await pendingOf(ctx);
  await ctx.perms.update(s.origin, { chainId: 137 });
  assert.equal((await ctx.svc.resolve(p.id, { approve: true })).ok, false); assert.equal(ctx.log.signed.length, 0);
});
test('executing journal prevents worker restart from replaying a transaction', async () => {
  const ctx = setup(), s = sender(); await connect(ctx, s);
  const r = req('eth_sendTransaction', [{ to: ADDR1, value: '0x1' }]);
  await ctx.svc.handle(s, r); const p = await pendingOf(ctx);
  const [claim, duplicate] = await Promise.all([ctx.pending.claim(p.id), ctx.pending.claim(p.id)]);
  assert.ok(claim); assert.equal(duplicate, undefined);
  const reborn = new M.ProviderService({ ...ctx.svc.d });
  await reborn.dropFor(s.tabId, s.frameId, s.documentId); await reborn.rejectWhere(() => true); ctx.clock.t += M.PENDING_TTL_MS + 1; await reborn.gc();
  assert.equal((await ctx.pending.get(p.id)).stage, 'executing');
  const replay = await reborn.handle(s, r); assert.equal(replay.done, true); assert.match(replay.outcome.error.message, /outcome is unknown/);
  assert.equal((await reborn.resolve(p.id, { approve: true })).ok, false); assert.equal(ctx.log.signed.length, 0);
});
test('settlement is journalled even when delivery succeeds, without consuming the replay result', async () => {
  const ctx = setup(), s = sender(); const p = await connect(ctx, s);
  assert.equal((await ctx.pending.list()).length, 0);
  assert.deepEqual(await ctx.svc.takeSettled(p.key), { result: [ADDR0] });
  const reborn = new M.ProviderService({ ...ctx.svc.d });
  assert.deepEqual(await reborn.takeSettled(p.key), { result: [ADDR0] });
});
test('expired approvals cannot execute between garbage collection ticks', async () => {
  const ctx = setup(), s = sender(); await connect(ctx, s);
  await ctx.svc.handle(s, req('personal_sign', ['hello', ADDR0])); const p = await pendingOf(ctx);
  ctx.clock.t += M.PENDING_TTL_MS + 1;
  assert.equal((await ctx.svc.resolve(p.id, { approve: true })).ok, false); assert.equal(ctx.log.signed.length, 0);
});


test('request replay identity includes the browser origin and document, not only tab/frame/request id', async () => {
  const s = sender();
  assert.notEqual(M.senderKey(s, 'same'), M.senderKey({ ...s, documentId: 'doc2' }, 'same'));
  assert.notEqual(M.senderKey(s, 'same'), M.senderKey({ ...s, origin: 'https://other.example' }, 'same'));
  const ctx = setup(); const r = req('eth_requestAccounts'); await ctx.svc.handle(s, r);
  await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true });
  assert.equal(await ctx.svc.takeSettled(M.senderKey({ ...s, documentId: 'doc2' }, r.id)), undefined);
});


test('locked vault hides grants from initial state and local account methods, and reconnect waits for unlock', async () => {
  const ctx = setup(), s = sender(); await connect(ctx, s); ctx.state.locked = true;
  const state = await ctx.svc.initState(s.origin); assert.deepEqual(state.evm.accounts, []); assert.equal(state.solana.publicKey, null);
  assert.deepEqual((await ctx.svc.handle(s, req('eth_accounts'))).outcome.result, []);
  assert.equal((await ctx.svc.handle(s, req('eth_coinbase'))).outcome.result, null);
  assert.equal((await ctx.svc.handle(s, req('eth_requestAccounts'))).done, false);
  assert.equal((await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true })).locked, true);
});

// ------------------------------------------------------------------ signing known-answer vectors
const PK1 = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
test('personal_sign vector (web3.js docs): "Some data"', async () => {
  const hex = '0x' + Buffer.from('Some data').toString('hex');
  assert.equal(M.personalMessageHash(hex), '0x1da44b586eb0729ff70a73c326926f6ed5a25f5b056e7f47fbc6e58d86871655');
  const sig = await M.evmSignMessage(PK1, hex, 'personal');
  assert.equal(sig, '0xb91467e570a6466aa9e9876cbcd013baba02900b8979d43fe208a4a4f339f5fd6007e74cd82e037b800186422fc2da167c747ef045e5d18a5f5d4300f8e1a0291c');
  assert.equal((await M.evmRecover(hex, sig)).toLowerCase(), ADDR0.toLowerCase());
});
test('eth_sign raw hash signs the digest unprefixed; wrong length refused', async () => {
  const hash = '0x' + Buffer.from(keccak_256(Buffer.from('raw'))).toString('hex');
  const sig = await M.evmSignMessage(PK1, hash, 'rawHash'); assert.match(sig, /^0x[0-9a-f]{130}$/);
  const { recoverAddress } = await import('viem'); assert.equal((await recoverAddress({ hash, signature: sig })).toLowerCase(), ADDR0.toLowerCase());
  await assert.rejects(() => M.evmSignMessage(PK1, '0x1234', 'rawHash'));
});
test('EIP-712 "Mail" vector from the specification (digest + signature)', async () => {
  const cow = '0xc85ef7d79691fe79573b1a7064c19c1a9819ebdbd1faaab1a8ec92344438aaf4';
  const { privateKeyToAccount } = await import('viem/accounts'); assert.equal(privateKeyToAccount(cow).address, '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826');
  assert.equal(M.typedDataDigest(MAIL), '0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2');
  const sig = await M.evmSignTypedData(cow, MAIL);
  assert.equal(sig, '0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b915621c');
});
test('EIP-712 v4 with arrays and nested structs matches an independent encoder', async () => {
  const td = { types: { Person: [{ name: 'name', type: 'string' }, { name: 'wallets', type: 'address[]' }], Mail: [{ name: 'from', type: 'Person' }, { name: 'to', type: 'Person[]' }, { name: 'contents', type: 'string' }, { name: 'tags', type: 'bytes32[]' }, { name: 'n', type: 'uint256' }, { name: 'ok', type: 'bool' }] },
    primaryType: 'Mail', domain: { name: 'Ether Mail', version: '2', chainId: 1, verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' },
    message: { from: { name: 'Cow', wallets: ['0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826', '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF'] }, to: [{ name: 'Bob', wallets: ['0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'] }, { name: 'Alice', wallets: [] }], contents: 'Hello, Bob!', tags: ['0x' + '11'.repeat(32)], n: 12345678901234567890n.toString(), ok: true } };
  const kk = (b) => keccak_256(b); const cat = (...a) => Buffer.concat(a.map((x) => Buffer.from(x))); const hexOf = (u) => '0x' + Buffer.from(u).toString('hex');
  const deps = (t, types, set = new Set()) => { const base = t.replace(/\[\]$/, ''); if (!types[base] || set.has(base)) return set; set.add(base); for (const f of types[base]) deps(f.type, types, set); return set; };
  const encType = (t, types) => { const ds = [...deps(t, types)].filter((x) => x !== t).sort(); return [t, ...ds].map((n) => `${n}(${types[n].map((f) => `${f.type} ${f.name}`).join(',')})`).join(''); };
  const enc = (type, v, types) => {
    if (type.endsWith('[]')) return kk(cat(...v.map((x) => enc(type.slice(0, -2), x, types))));
    if (types[type]) return hashStruct(type, v, types);
    if (type === 'string') return kk(Buffer.from(v)); if (type === 'bool') return Buffer.from((v ? 1n : 0n).toString(16).padStart(64, '0'), 'hex');
    if (type === 'address') return Buffer.from(v.slice(2).toLowerCase().padStart(64, '0'), 'hex'); if (type === 'bytes32') return Buffer.from(v.slice(2), 'hex');
    if (type.startsWith('uint')) return Buffer.from(BigInt(v).toString(16).padStart(64, '0'), 'hex'); throw new Error('type ' + type);
  };
  const hashStruct = (t, v, types) => kk(cat(kk(Buffer.from(encType(t, types))), ...types[t].map((f) => enc(f.type, v[f.name], types))));
  const domTypes = { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }] };
  const expected = hexOf(kk(cat('\x19\x01', hashStruct('EIP712Domain', td.domain, domTypes), hashStruct('Mail', td.message, td.types))));
  assert.equal(M.typedDataDigest(td), expected);
  const sig = await M.evmSignTypedData(PK1, td); const { recoverAddress } = await import('viem'); assert.equal((await recoverAddress({ hash: expected, signature: sig })).toLowerCase(), ADDR0.toLowerCase());
});
test('web3_sha3 / personal_ecRecover answer locally', async () => {
  const ctx = setup(); const s = sender();
  assert.equal((await ctx.svc.handle(s, req('web3_sha3', ['0x68656c6c6f']))).outcome.result, '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8');
  const hex = '0x' + Buffer.from('Some data').toString('hex'); const sig = await M.evmSignMessage(PK1, hex, 'personal');
  assert.equal((await ctx.svc.handle(s, req('personal_ecRecover', [hex, sig]))).outcome.result, ADDR0);
});

// ------------------------------------------------------------------ broadcasting through a mock JSON-RPC node (live-unverified against real nodes)
test('evmSendTransaction: prepares, signs locally and broadcasts a raw tx that recovers to the account', async () => {
  const { parseTransaction, recoverTransactionAddress } = await import('viem'); let raw = null;
  const server = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', (c) => (b += c)); rq.on('end', () => {
      const j = JSON.parse(b); const one = (c) => { let result;
        switch (c.method) {
          case 'eth_chainId': result = '0x539'; break; case 'eth_getTransactionCount': result = '0x7'; break; case 'eth_estimateGas': result = '0x5208'; break;
          case 'eth_gasPrice': result = '0x3b9aca00'; break; case 'eth_maxPriorityFeePerGas': result = '0x59682f00'; break;
          case 'eth_getBlockByNumber': result = { number: '0x10', hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32), baseFeePerGas: '0x3b9aca00', gasLimit: '0x1c9c380', gasUsed: '0x0', timestamp: '0x5f5e100', transactions: [], miner: '0x' + '00'.repeat(20), difficulty: '0x0', totalDifficulty: '0x0', nonce: '0x0000000000000000', sha3Uncles: '0x' + '33'.repeat(32), logsBloom: '0x' + '00'.repeat(256), transactionsRoot: '0x' + '44'.repeat(32), stateRoot: '0x' + '55'.repeat(32), receiptsRoot: '0x' + '66'.repeat(32), extraData: '0x', size: '0x200', uncles: [], mixHash: '0x' + '77'.repeat(32) }; break;
          case 'eth_sendRawTransaction': raw = c.params[0]; result = '0x' + Buffer.from(keccak_256(Buffer.from(raw.slice(2), 'hex'))).toString('hex'); break;
          default: return { jsonrpc: '2.0', id: c.id, error: { code: -32601, message: 'nope ' + c.method } };
        } return { jsonrpc: '2.0', id: c.id, result }; };
      rs.setHeader('content-type', 'application/json'); rs.end(JSON.stringify(Array.isArray(j) ? j.map(one) : one(j)));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const tx = { from: ADDR0, to: ADDR1, value: '0xde0b6b3a7640000', data: '0x' };
    const hash = await M.evmSendTransaction(PK1, tx, { urls: [url], chainId: 1337, name: 'Local', symbol: 'ETH', fee: { maxFeePerGas: 5000000000n, maxPriorityFeePerGas: 1500000000n } });
    const parsed = parseTransaction(raw); assert.equal(parsed.chainId, 1337); assert.equal(parsed.nonce, 7); assert.equal(parsed.value, 10n ** 18n); assert.equal(parsed.to.toLowerCase(), ADDR1.toLowerCase());
    assert.equal(parsed.maxFeePerGas, 5000000000n); assert.equal(parsed.gas, 21000n);
    assert.equal((await recoverTransactionAddress({ serializedTransaction: raw })).toLowerCase(), ADDR0.toLowerCase());
    assert.equal(hash, '0x' + Buffer.from(keccak_256(Buffer.from(raw.slice(2), 'hex'))).toString('hex'));
    await M.evmSendTransaction(PK1, tx, { urls: [url], chainId: 1337, name: 'Local', symbol: 'ETH', gas: 100000n }); assert.equal(parseTransaction(raw).gas, 100000n);
  } finally { server.close(); }
});

// ------------------------------------------------------------------ Solana
const cu = (n) => { const o = []; do { let b = n & 0x7f; n >>= 7; if (n) b |= 0x80; o.push(b); } while (n); return Uint8Array.from(o); };
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
function solTransfer(fromPk, toPk, lamports) {
  const data = new Uint8Array(12); new DataView(data.buffer).setUint32(0, 2, true); new DataView(data.buffer).setBigUint64(4, BigInt(lamports), true);
  const msg = concat(Uint8Array.of(1, 0, 1), cu(3), fromPk, toPk, new Uint8Array(32), new Uint8Array(32).fill(9), cu(1), Uint8Array.of(2), cu(2), Uint8Array.of(0, 1), cu(12), data);
  return concat(cu(1), new Uint8Array(64), msg);
}
test('base58 round trip and solana address validation', () => {
  const pk = ed25519.getPublicKey(new Uint8Array(32).fill(1)); assert.deepEqual(M.b58decode(M.b58encode(pk)), pk);
  assert.equal(M.b58encode(Uint8Array.of(0, 0, 1)), '112'); assert.ok(M.isSolanaAddress(SOL0)); assert.ok(!M.isSolanaAddress('0xabc'));
  assert.equal(M.b58encode(new Uint8Array(32)), '11111111111111111111111111111111');
});
test('solana tx parse and signature slot filling verifies with ed25519', () => {
  const seed = new Uint8Array(32).fill(5); const me = ed25519.getPublicKey(seed); const you = ed25519.getPublicKey(new Uint8Array(32).fill(6));
  const bytes = solTransfer(me, you, 123456); const tx = M.parseSolTx(bytes);
  assert.equal(tx.version, 'legacy'); assert.equal(M.signerSlot(tx, M.b58encode(me)), 0); assert.equal(M.signerSlot(tx, M.b58encode(you)), -1);
  const sig = ed25519.sign(tx.message, seed); const signed = M.withSignature(bytes, tx, 0, sig);
  const back = M.parseSolTx(signed); assert.ok(ed25519.verify(signed.slice(1, 65), back.message, me)); assert.equal(signed.length, bytes.length);
  assert.throws(() => M.parseSolTx(bytes.slice(0, 80))); assert.throws(() => M.withSignature(bytes, tx, 3, sig)); assert.throws(() => M.withSignature(bytes, tx, 0, new Uint8Array(10)));
});
test('solana provider flow: connect, signMessage, signTransaction, signAndSendTransaction, disconnect', async () => {
  const seed = new Uint8Array(32).fill(5); const mePk = ed25519.getPublicKey(seed); const ME = M.b58encode(mePk);
  const ctx = setup(); ctx.svc.d.signer.accounts = async () => ({ walletId: 'w1', walletName: 'W', activeAccount: 0, accounts: [{ index: 0, derivationIndex: 0, name: 'Account 1', evm: ADDR0, solana: ME }] });
  ctx.svc.d.signer.solSign = async (c, msgs) => msgs.map((m) => ed25519.sign(m, seed));
  const s = sender(); assert.equal((await ctx.svc.handle(s, req('signMessage', { message: 'aGk=' }, 'solana'))).outcome.error.code, 4100);
  await ctx.svc.handle(s, req('connect', {}, 'solana')); await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true });
  assert.deepEqual(ctx.log.delivered.at(-1).outcome.result, { publicKey: ME });
  await ctx.svc.handle(s, req('signMessage', { message: 'aGVsbG8=' }, 'solana')); await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true });
  const sm = ctx.log.delivered.at(-1).outcome.result; assert.ok(ed25519.verify(Buffer.from(sm.signature, 'base64'), Buffer.from('hello'), mePk));
  const bytes = solTransfer(mePk, ed25519.getPublicKey(new Uint8Array(32).fill(6)), 1000); const b64 = Buffer.from(bytes).toString('base64');
  const other = solTransfer(ed25519.getPublicKey(new Uint8Array(32).fill(8)), ed25519.getPublicKey(new Uint8Array(32).fill(6)), 1);
  assert.equal((await ctx.svc.handle(s, req('signTransaction', { transaction: Buffer.from(other).toString('base64') }, 'solana'))).outcome.error.code, -32602);
  await ctx.svc.handle(s, req('signTransaction', { transaction: b64 }, 'solana')); await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true });
  const st = ctx.log.delivered.at(-1).outcome.result; const signed = Buffer.from(st.signedTransaction, 'base64'); assert.ok(ed25519.verify(signed.subarray(1, 65), M.parseSolTx(signed).message, mePk));
  await ctx.svc.handle(s, req('signAndSendTransaction', { transaction: b64, options: { skipPreflight: true } }, 'solana')); await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true });
  assert.deepEqual(ctx.log.delivered.at(-1).outcome.result, { signature: 'SOLSIG' }); assert.equal(ctx.log.sol[0][0], 'sendTransaction');
  assert.equal((await ctx.svc.handle(s, req('disconnect', undefined, 'solana'))).outcome.result, null); assert.equal((await ctx.svc.handle(s, req('signMessage', { message: 'aGk=' }, 'solana'))).outcome.error.code, 4100);
});

// ------------------------------------------------------------------ fee presets
test('fee presets derive only from node data', async () => {
  const rpc = async (c, m) => ({ eth_getBlockByNumber: { baseFeePerGas: '0x3b9aca00' }, eth_maxPriorityFeePerGas: '0x59682f00', eth_gasPrice: '0x77359400' }[m]);
  const f = await M.feePresets(1, rpc); assert.equal(f.eip1559, true);
  assert.ok(f.presets.safe.maxFeePerGas < f.presets.average.maxFeePerGas && f.presets.average.maxFeePerGas < f.presets.fast.maxFeePerGas);
  await assert.rejects(() => M.feePresets(1, async () => null));
});
test('eth_sendTransaction accepts padded hex quantities and canonicalises them', async () => {
  const me = '0x' + '11'.repeat(20);
  const t = M.normalizeSendTx([{ from: me, to: '0x' + '22'.repeat(20), value: '0x00', data: '0x', gas: '0x0de0b6b3a7640000' }], me);
  assert.equal(t.value, '0x0'); assert.equal(t.gas, '0xde0b6b3a7640000');
  assert.throws(() => M.normalizeSendTx([{ from: me, to: '0x' + '22'.repeat(20), value: '1000' }], me));
});
test('WalletConnect session proposal: approval negotiates, sends the session, and creates the site connection; rejection never connects', async () => {
  const wcLog = { approved: [], rejected: [] };
  const wc = { approve: async (id, ns, meta) => { wcLog.approved.push({ id, ns, meta }); return 'topic1'; }, reject: async (id, code, message) => { wcLog.rejected.push({ id, code, message }); } };
  const ctx = setup({ wc }); const s = sender('https://app.uniswap.org', { tabId: -1, frameId: 0, documentId: 'wc:proposal' });
  const proposal = { requiredNamespaces: { eip155: { chains: ['eip155:1'], methods: ['personal_sign'], events: ['chainChanged'] } }, optionalNamespaces: { eip155: { chains: ['eip155:137', 'eip155:56'], methods: ['eth_sendTransaction'], events: [] } } };
  await ctx.svc.queueWcSession(s, 7, { proposal, verify: null });
  const p = await pendingOf(ctx); assert.equal(p.kind, 'wcSession'); assert.equal(p.reqId, 'proposal:7'); assert.equal(p.params.proposalId, 7);
  const r = await ctx.svc.resolve(p.id, { approve: true, accountIndex: 1 }); assert.equal(r.ok, true);
  assert.deepEqual(wcLog.approved[0].ns.eip155.chains, ['eip155:1', 'eip155:137']); assert.deepEqual(wcLog.approved[0].ns.eip155.accounts, [`eip155:1:${ADDR1}`, `eip155:137:${ADDR1}`]);
  const c = await ctx.perms.get('https://app.uniswap.org'); assert.equal(c.evmAddress, ADDR1); assert.equal(c.accountIndex, 1); assert.equal(c.chainId, 1); assert.deepEqual(c.namespaces, ['evm']);
  assert.equal(ctx.log.delivered.at(-1).t.tabId, -1, 'the outcome is routed to the WalletConnect bridge, not a tab');
  // a proposal Harbour cannot satisfy is refused on the relay and never connects
  const ctx2 = setup({ wc: { ...wc, reject: async (id, code) => { wcLog.rejected.push({ id, code }); } } });
  await ctx2.svc.queueWcSession(s, 8, { proposal: { requiredNamespaces: { eip155: { chains: ['eip155:56'], methods: [], events: [] } } } });
  const r2 = await ctx2.svc.resolve((await pendingOf(ctx2)).id, { approve: true }); assert.equal(r2.ok, false); assert.equal(wcLog.rejected.at(-1).code, 5100); assert.equal(await ctx2.perms.get('https://app.uniswap.org'), undefined);
  // user rejection
  const ctx3 = setup({ wc }); await ctx3.svc.queueWcSession(s, 9, { proposal });
  assert.equal((await ctx3.svc.resolve((await pendingOf(ctx3)).id, { approve: false })).ok, true);
  assert.equal(await ctx3.perms.get('https://app.uniswap.org'), undefined); assert.equal(ctx3.log.delivered.at(-1).outcome.error.code, 4001);
});

test('eth_sign is refused unless enabled, and then only for a 32-byte hash', async () => {
  let ctx = setup({ ethSignEnabled: async () => false }); let s = sender(); await connect(ctx, s, 0);
  assert.equal((await ctx.svc.handle(s, req('eth_sign', [ADDR0, '0x' + 'ee'.repeat(32)]))).outcome.error.code, 4200);
  ctx = setup(); s = sender(); await connect(ctx, s, 0);
  assert.equal((await ctx.svc.handle(s, req('eth_sign', [ADDR0, '0x68656c6c6f']))).outcome.error.code, -32602);
});

// ------------------------------------------------------------------ Harbour v3 build policy (core/harbour/policy.ts)
test('v3 build policy: only Harbour-served EVM networks sign; unserved chains and site-added networks are refused; Solana and multi-chain connect through the approval window', async () => {
  const NETS3 = [...NETS, { chainId: 84532, id: 'base-sepolia', name: 'Base Sepolia', symbol: 'ETH', decimals: 18, rpcs: ['http://rpcb'], testnet: true, custom: false },
    { chainId: 99999, id: 'unserved', name: 'Unserved', symbol: 'UNS', decimals: 18, rpcs: ['http://rpcu'], testnet: false, custom: false }];
  const ctx = setup({ policy: undefined, networks: { list: () => NETS3, get: (id) => NETS3.find((n) => n.chainId === id) } }); const s = sender();
  assert.equal((await ctx.svc.handle(s, req('eth_chainId'))).outcome.result, '0x1');                    // default chain is the first network the backend serves
  await connect(ctx, s);
  assert.deepEqual((await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x1' }]))).outcome, { result: null });
  assert.deepEqual((await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x14a34' }]))).outcome, { result: null });
  assert.equal((await ctx.svc.handle(s, req('wallet_switchEthereumChain', [{ chainId: '0x1869f' }]))).outcome.error.code, 4902);
  assert.equal((await ctx.svc.handle(s, req('eth_sendTransaction', [{ to: ADDR1, value: '0x1', chainId: '0x1869f' }]))).outcome.error.code, 4902);
  const typed = { types: { EIP712Domain: [{ name: 'chainId', type: 'uint256' }], M: [{ name: 'a', type: 'uint256' }] }, primaryType: 'M', domain: { chainId: 99999 }, message: { a: 1 } };
  assert.equal((await ctx.svc.handle(s, req('eth_signTypedData_v4', [ADDR0, JSON.stringify(typed)]))).outcome.error.code, 4902);
  assert.equal((await ctx.svc.handle(s, req('wallet_addEthereumChain', [{ chainId: '0x2710', chainName: 'X', rpcUrls: ['https://x.example'], nativeCurrency: { name: 'E', symbol: 'ETH', decimals: 18 } }]))).outcome.error.code, 4902);
  assert.equal(ctx.log.signed.length, 0);
});
test('a dApp transaction is never sent without the fee the user saw', async () => {
  const ctx = setup(); const s = sender(); await connect(ctx, s);
  await ctx.svc.handle(s, req('eth_sendTransaction', [{ to: ADDR1, value: '0x1' }])); const r = await ctx.svc.resolve((await pendingOf(ctx)).id, { approve: true });
  assert.equal(r.ok, false); assert.match(ctx.log.delivered.at(-1).outcome.error.message, /network fee could not be shown/);
  assert.equal(ctx.log.signed.filter((x) => x[0] === 'tx').length, 0);
});
