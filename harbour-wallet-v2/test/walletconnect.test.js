// WalletConnect v2: URI validation, namespace negotiation, request mapping, and the bridge against a fake relay client + fake provider service.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './core/walletconnect'; export { WalletConnectBridge, WC_TAB, SESSIONS_KEY } from './background/walletconnect/bridge'; export { b58encode, b64ToBytes, bytesToB64 } from './core/provider/base58';
    export { PermissionStore } from './core/provider/store';`, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const TOPIC = 'ab'.repeat(32), KEY = 'cd'.repeat(32);
const uri = (o = '') => `wc:${TOPIC}@2?relay-protocol=irn&symKey=${KEY}${o}`;
const NOW = 1_700_000_000;

test('parseWcUri accepts v2 links and refuses v1, malformed, wrong-relay and expired links', () => {
  const ok = M.parseWcUri(uri(`&expiryTimestamp=${NOW + 300}`), NOW); assert.equal(ok.ok, true); assert.equal(ok.value.topic, TOPIC); assert.equal(ok.value.expiry, NOW + 300);
  assert.equal(M.parseWcUri(uri(), NOW).ok, true);
  assert.equal(M.parseWcUri(`https://app.example/wc?uri=${encodeURIComponent(uri())}`, NOW).ok, false, 'a web URL is not a pairing link');
  assert.equal(M.parseWcUri(`trust://wc?uri=${encodeURIComponent(uri())}`, NOW).ok, true, 'a wallet deep link wrapping a wc: URI');
  assert.match(M.parseWcUri(`wc:${TOPIC}@1?bridge=https%3A%2F%2Fx&key=${KEY}`, NOW).error, /v1/);
  assert.equal(M.parseWcUri(`wc:${TOPIC}@2?relay-protocol=irn&symKey=zz`, NOW).ok, false);
  assert.equal(M.parseWcUri(`wc:${TOPIC}@2?relay-protocol=other&symKey=${KEY}`, NOW).ok, false);
  assert.match(M.parseWcUri(uri(`&expiryTimestamp=${NOW - 1}`), NOW).error, /expired/);
  assert.equal(M.parseWcUri('wc:short@2?relay-protocol=irn', NOW).ok, false);
  assert.equal(M.parseWcUri(42, NOW).ok, false); assert.equal(M.parseWcUri('x'.repeat(3000), NOW).ok, false);
});

const A = { evm: '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23', solana: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin' };
test('negotiate: grants only what was asked and Harbour supports; refuses unmet requirements', () => {
  const r = M.negotiate({ requiredNamespaces: { eip155: { chains: ['eip155:1'], methods: ['personal_sign', 'eth_sendTransaction'], events: ['chainChanged'] } },
    optionalNamespaces: { eip155: { chains: ['eip155:137', 'eip155:56'], methods: ['eth_signTypedData_v4', 'eth_signTransaction'], events: ['accountsChanged', 'bogus'] } } }, A, [1, 137]);
  assert.equal(r.ok, true); assert.deepEqual(r.namespaces.eip155.chains, ['eip155:1', 'eip155:137']);
  assert.deepEqual(r.namespaces.eip155.methods.sort(), ['eth_sendTransaction', 'eth_signTypedData_v4', 'personal_sign']);
  assert.deepEqual(r.namespaces.eip155.events.sort(), ['accountsChanged', 'chainChanged']);
  assert.deepEqual(r.namespaces.eip155.accounts, [`eip155:1:${A.evm}`, `eip155:137:${A.evm}`]);
  assert.equal(r.initialChainId, 1); assert.deepEqual(r.evmChainIds, [1, 137]); assert.equal(r.solana, false);
  const badChain = M.negotiate({ requiredNamespaces: { eip155: { chains: ['eip155:56'], methods: [], events: [] } } }, A, [1]); assert.equal(badChain.ok, false); assert.equal(badChain.code, 5100);
  const badMethod = M.negotiate({ requiredNamespaces: { eip155: { chains: ['eip155:1'], methods: ['eth_signTransaction'], events: [] } } }, A, [1]); assert.equal(badMethod.code, 5101);
  const badEvent = M.negotiate({ requiredNamespaces: { eip155: { chains: ['eip155:1'], methods: [], events: ['bogus'] } } }, A, [1]); assert.equal(badEvent.code, 5102);
  const noNs = M.negotiate({ requiredNamespaces: { cosmos: { chains: ['cosmos:cosmoshub-4'], methods: [], events: [] } } }, A, [1]); assert.equal(noNs.code, 5104);
  const noEvmAddr = M.negotiate({ requiredNamespaces: { eip155: { chains: ['eip155:1'], methods: [], events: [] } } }, { solana: A.solana }, [1]); assert.equal(noEvmAddr.ok, false);
  const none = M.negotiate({ optionalNamespaces: { eip155: { chains: ['eip155:56'], methods: [], events: [] } } }, A, [1]); assert.equal(none.ok, false);
  const sol = M.negotiate({ optionalNamespaces: { solana: { chains: [M.SOLANA_MAINNET_CAIP], methods: ['solana_signMessage', 'solana_signTransaction'], events: [] } } }, A, [1]);
  assert.equal(sol.ok, true); assert.equal(sol.solana, true); assert.deepEqual(sol.evmChainIds, []);
  assert.deepEqual(sol.namespaces.solana.accounts, [`${M.SOLANA_MAINNET_CAIP}:${A.solana}`]);
  const crossKey = M.negotiate({ requiredNamespaces: { 'eip155:1': { methods: ['personal_sign'], events: [] } } }, A, [1, 137]); assert.equal(crossKey.ok, true); assert.deepEqual(crossKey.namespaces.eip155.chains, ['eip155:1']);
});

test('mapRequest enforces the approved chain/method allowlist and adapts Solana shapes', () => {
  const chains = ['eip155:1', M.SOLANA_MAINNET_CAIP], methods = ['personal_sign', 'solana_signMessage', 'solana_signTransaction'];
  assert.deepEqual(M.mapRequest({ chainId: 'eip155:1', request: { method: 'personal_sign', params: ['0x68', A.evm] } }, chains, methods), { ok: true, ns: 'evm', method: 'personal_sign', params: ['0x68', A.evm], chainId: 1 });
  assert.equal(M.mapRequest({ chainId: 'eip155:1', request: { method: 'eth_sendTransaction', params: [{}] } }, chains, methods).code, 5101, 'not approved');
  assert.equal(M.mapRequest({ chainId: 'eip155:137', request: { method: 'personal_sign', params: [] } }, chains, methods).code, 5100, 'chain not approved');
  assert.equal(M.mapRequest({ chainId: 'eip155:1', request: { method: 'eth_signTransaction' } }, chains, ['eth_signTransaction']).ok, false, 'never in the supported list');
  const msg = M.b58encode(new TextEncoder().encode('hello'));
  const m = M.mapRequest({ chainId: M.SOLANA_MAINNET_CAIP, request: { method: 'solana_signMessage', params: { message: msg, pubkey: A.solana } } }, chains, methods);
  assert.equal(m.ok, true); assert.equal(m.method, 'signMessage'); assert.equal(Buffer.from(M.b64ToBytes(m.params.message)).toString(), 'hello');
  assert.equal(M.mapRequest({ chainId: M.SOLANA_MAINNET_CAIP, request: { method: 'solana_signMessage', params: { message: '0OIl' } } }, chains, methods).ok, false, 'invalid base58');
  assert.equal(M.mapRequest({ chainId: M.SOLANA_MAINNET_CAIP, request: { method: 'solana_signTransaction', params: { feePayer: 'x', instructions: [] } } }, chains, methods).ok, false);
  const sig = new Uint8Array(64).fill(7);
  assert.equal(M.mapResult('message', { signature: M.bytesToB64(sig), publicKey: A.solana }).signature, M.b58encode(sig));
  assert.deepEqual(M.mapResult('transaction', { signature: 'S', signedTransaction: 'T', publicKey: 'P' }), { signature: 'S', transaction: 'T' });
  assert.equal(M.mapResult(undefined, '0xabc'), '0xabc');
});

// ------------------------------------------------------------------ bridge with fakes
class MemKV { constructor() { this.m = new Map(); } async get(k) { const v = this.m.get(k); return v === undefined ? undefined : JSON.parse(v); } async set(k, v) { this.m.set(k, JSON.stringify(v)); } async remove(k) { this.m.delete(k); } }
function fakeKit() {
  const k = { handlers: {}, calls: [], on(e, cb) { this.handlers[e] = cb; }, async pair(a) { this.calls.push(['pair', a]); }, async approveSession(a) { this.calls.push(['approve', a]); return { topic: TOPIC, expiry: NOW + 86400, peer: { metadata: { name: 'Uni', url: 'https://app.uniswap.org' } } }; },
    async rejectSession(a) { this.calls.push(['reject', a]); }, async respondSessionRequest(a) { this.calls.push(['respond', a]); }, async disconnectSession(a) { this.calls.push(['disconnect', a]); }, getActiveSessions() { return {}; } };
  return k;
}
function setup(over = {}) {
  const kv = new MemKV(); const perms = new M.PermissionStore(kv); const kit = fakeKit(); const log = { queued: [], handled: [], disconnectedOrigins: [] };
  const service = { async queueWcSession(s, id, p) { log.queued.push({ s, id, p }); }, async handle(s, req) { log.handled.push({ s, req }); return over.handle ? over.handle(s, req) : { done: true, outcome: { result: '0xsig' } }; } };
  const bridge = new M.WalletConnectBridge({ kv, perms, service: () => service, createKit: async () => kit, projectId: async () => ('projectId' in over ? over.projectId : 'a'.repeat(32)),
    networks: { get: (id) => [1, 137].includes(id) ? {} : undefined }, disconnectOrigin: async (o) => { log.disconnectedOrigins.push(o); }, now: () => NOW * 1000 });
  return { bridge, kit, kv, perms, log };
}
const proposalEvent = (url = 'https://app.uniswap.org') => ({ id: 7, params: { id: 7, proposer: { metadata: { name: 'Uniswap', description: 'swap', url, icons: ['https://app.uniswap.org/i.png', 'http://bad/i.png'] } }, requiredNamespaces: { eip155: { chains: ['eip155:1'], methods: ['personal_sign'], events: [] } }, optionalNamespaces: {} }, verifyContext: { verified: { origin: url, validation: 'VALID', isScam: false } } });
const flush = () => new Promise((r) => setTimeout(r, 20));
const seedSession = async (t, chains = ['eip155:1', 'eip155:137'], methods = ['personal_sign', 'eth_sendTransaction']) => {
  await t.kv.set(M.SESSIONS_KEY, { [TOPIC]: { topic: TOPIC, origin: 'https://app.uniswap.org', name: 'Uni', url: 'https://app.uniswap.org', chains, methods, connectedAt: 1 } });
  await t.perms.connect({ origin: 'https://app.uniswap.org', walletId: 'w', walletName: 'W', accountIndex: 0, accountName: 'A', chainId: 1, namespaces: ['evm'], evmAddress: A.evm });
};

test('pair: refuses bad links and a missing project ID before touching the relay; otherwise pairs', async () => {
  const none = setup({ projectId: null }); assert.match((await none.bridge.pair(uri())).error, /project ID/); assert.equal(none.kit.calls.length, 0);
  const t = setup(); assert.equal((await t.bridge.pair('hello')).ok, false); assert.equal(t.kit.calls.length, 0);
  assert.equal((await t.bridge.pair(uri())).ok, true); assert.deepEqual(t.kit.calls[0], ['pair', { uri: uri() }]);
});
test('proposal: queued for approval as a synthetic WalletConnect sender; bad/blocked origins are rejected without a prompt', async () => {
  const t = setup(); await t.bridge.ensure(); t.kit.handlers.session_proposal(proposalEvent()); await flush();
  assert.equal(t.log.queued.length, 1); const q = t.log.queued[0];
  assert.equal(q.id, 7); assert.equal(q.s.tabId, M.WC_TAB); assert.equal(q.s.origin, 'https://app.uniswap.org'); assert.equal(q.s.icon, 'https://app.uniswap.org/i.png');
  assert.equal(q.p.verify.validation, 'VALID'); assert.equal(q.p.proposal.requiredNamespaces.eip155.chains[0], 'eip155:1');
  const bad = setup(); await bad.bridge.ensure(); bad.kit.handlers.session_proposal(proposalEvent('http://insecure.example')); await flush();
  assert.equal(bad.log.queued.length, 0); assert.equal(bad.kit.calls[0][0], 'reject');
  const blk = setup(); await blk.perms.addBlacklist('https://app.uniswap.org'); await blk.bridge.ensure(); blk.kit.handlers.session_proposal(proposalEvent()); await flush();
  assert.equal(blk.log.queued.length, 0); assert.equal(blk.kit.calls[0][0], 'reject');
});
test('proposal: scam-flagged sites, and unverified sites claiming an already-connected address, are refused without a prompt', async () => {
  const scam = setup(); await scam.bridge.ensure(); const e = proposalEvent(); e.verifyContext.verified.isScam = true; scam.kit.handlers.session_proposal(e); await flush();
  assert.equal(scam.log.queued.length, 0); assert.equal(scam.kit.calls[0][0], 'reject');
  for (const validation of ['INVALID', 'UNKNOWN']) {
    const t = setup(); await seedSession(t); await t.bridge.ensure(); const ev = proposalEvent(); ev.verifyContext.verified.validation = validation; t.kit.handlers.session_proposal(ev); await flush();
    assert.equal(t.log.queued.length, 0, validation); assert.match(t.kit.calls.at(-1)[1].reason.message, /already connected/);
  }
  const ok = setup(); await seedSession(ok); await ok.bridge.ensure(); ok.kit.handlers.session_proposal(proposalEvent()); await flush();
  assert.equal(ok.log.queued.length, 1, 'a verified request for a connected site is allowed');
  const fresh = setup(); await fresh.bridge.ensure(); const ev2 = proposalEvent(); ev2.verifyContext.verified.validation = 'UNKNOWN'; fresh.kit.handlers.session_proposal(ev2); await flush();
  assert.equal(fresh.log.queued.length, 1, 'an unverified NEW site still reaches the prompt (with a warning)');
});
test('host.approve sends the session and indexes it; a rejected proposal is answered on the relay', async () => {
  const t = setup(); const topic = await t.bridge.host.approve(7, { eip155: { chains: ['eip155:1'], methods: ['personal_sign'], events: [], accounts: [`eip155:1:${A.evm}`] } }, { origin: 'https://app.uniswap.org', title: 'Uniswap', chains: ['eip155:1'] });
  assert.equal(topic, TOPIC); const s = await t.bridge.sessions(); assert.equal(s.length, 1); assert.equal(s[0].origin, 'https://app.uniswap.org'); assert.deepEqual(s[0].chains, ['eip155:1']);
  assert.equal(await t.bridge.deliver('wc:proposal', 'proposal:7', { result: { topic } }), true); assert.equal(t.kit.calls.filter((c) => c[0] === 'reject').length, 0);
  assert.equal(await t.bridge.deliver('wc:proposal', 'proposal:8', { error: { code: 4001, message: 'x' } }), true);
  assert.deepEqual(t.kit.calls.at(-1), ['reject', { id: 8, reason: { code: 5000, message: 'User rejected.' } }]);
  assert.equal(await t.bridge.deliver('doc-1', 'r1', { result: 1 }), false, 'content-script replies are not ours');
});
test('session_request: maps to the provider, binds the connection to the request chain, and answers on the relay', async () => {
  const t = setup(); await seedSession(t); await t.bridge.ensure();
  t.kit.handlers.session_request({ id: 11, topic: TOPIC, params: { chainId: 'eip155:137', request: { method: 'personal_sign', params: ['0x68', A.evm] } } }); await flush();
  assert.equal(t.log.handled[0].req.method, 'personal_sign'); assert.equal(t.log.handled[0].s.tabId, M.WC_TAB); assert.equal(t.log.handled[0].s.documentId, `wc:${TOPIC}`);
  assert.equal((await t.perms.get('https://app.uniswap.org')).chainId, 137);
  assert.deepEqual(t.kit.calls.at(-1), ['respond', { topic: TOPIC, response: { id: 11, jsonrpc: '2.0', result: '0xsig' } }]);
});
test('network change: a new chain is added to the session (updateSession) before chainChanged is emitted; a known chain only emits', async () => {
  const t = setup(); await seedSession(t, ['eip155:1']); await t.bridge.ensure(); const origin = 'https://app.uniswap.org';
  const live = { eip155: { chains: ['eip155:1'], accounts: [`eip155:1:${A.evm}`], methods: ['personal_sign'], events: ['chainChanged', 'accountsChanged'] } };
  t.kit.getActiveSessions = () => ({ [TOPIC]: { namespaces: live } });
  t.kit.updateSession = async (a) => { t.kit.calls.push(['update', a]); live.eip155 = a.namespaces.eip155; };
  t.kit.emitSessionEvent = async (a) => { t.kit.calls.push(['emit', a]); };
  await t.bridge.onChainChanged(origin, 137);
  assert.deepEqual(t.kit.calls.map((c) => c[0]), ['update', 'emit']);
  const upd = t.kit.calls[0][1].namespaces.eip155; assert.deepEqual(upd.chains, ['eip155:1', 'eip155:137']); assert.ok(upd.accounts.includes(`eip155:137:${A.evm}`));
  assert.deepEqual(t.kit.calls[1][1], { topic: TOPIC, event: { name: 'chainChanged', data: 137 }, chainId: 'eip155:137' });
  assert.ok((await t.bridge.sessions())[0].chains.includes('eip155:137'));
  t.kit.calls.length = 0; await t.bridge.onChainChanged(origin, 137); assert.deepEqual(t.kit.calls.map((c) => c[0]), ['emit']);
  t.kit.calls.length = 0; await t.bridge.onChainChanged('https://other.example', 1); assert.equal(t.kit.calls.length, 0);
  live.eip155.events = []; await t.bridge.onChainChanged(origin, 137); assert.equal(t.kit.calls.length, 0);
});
test('session_request: refuses unknown sessions, unapproved methods/chains, unavailable networks and removed connections', async () => {
  const t = setup(); await t.bridge.ensure();
  t.kit.handlers.session_request({ id: 1, topic: 'ee'.repeat(32), params: { chainId: 'eip155:1', request: { method: 'personal_sign', params: [] } } }); await flush();
  assert.equal(t.kit.calls.at(-1)[1].response.error.code, 4100);
  await seedSession(t, ['eip155:1', 'eip155:56'], ['personal_sign']);
  const ask = (id, chainId, method) => { t.kit.handlers.session_request({ id, topic: TOPIC, params: { chainId, request: { method, params: [] } } }); return flush().then(() => t.kit.calls.at(-1)[1].response); };
  assert.equal((await ask(2, 'eip155:1', 'eth_sendTransaction')).error.code, 5101);
  assert.equal((await ask(3, 'eip155:137', 'personal_sign')).error.code, 5100);
  assert.equal((await ask(4, 'eip155:56', 'personal_sign')).error.code, 4902, 'approved in the session but not a network Harbour has');
  await t.perms.disconnect('https://app.uniswap.org');
  assert.equal((await ask(5, 'eip155:1', 'personal_sign')).error.code, 4100);
  assert.equal(t.log.handled.length, 0, 'none of the refused requests reached the provider');
});
test('session_request: a request awaiting approval is answered when the provider settles it (approve and reject)', async () => {
  const t = setup({ handle: async () => ({ done: false }) }); await seedSession(t); await t.bridge.ensure();
  t.kit.handlers.session_request({ id: 21, topic: TOPIC, params: { chainId: 'eip155:1', request: { method: 'eth_sendTransaction', params: [{}] } } }); await flush();
  assert.equal(t.kit.calls.filter((c) => c[0] === 'respond').length, 0, 'nothing answered yet');
  assert.equal(await t.bridge.deliver(`wc:${TOPIC}`, '21', { result: '0xhash' }), true); assert.equal(t.kit.calls.at(-1)[1].response.result, '0xhash');
  assert.equal(await t.bridge.deliver(`wc:${TOPIC}`, '22', { error: { code: 4001, message: 'User rejected the request.' } }), true);
  assert.deepEqual(t.kit.calls.at(-1)[1].response, { id: 22, jsonrpc: '2.0', error: { code: 5000, message: 'User rejected the request.' } });
});
test('disconnect and session_delete end the connection once the last session for the site is gone', async () => {
  const t = setup(); await seedSession(t); await t.bridge.ensure();
  t.kit.handlers.session_delete({ topic: TOPIC }); await flush();
  assert.equal((await t.bridge.sessions()).length, 0); assert.deepEqual(t.log.disconnectedOrigins, ['https://app.uniswap.org']);
  const u = setup(); await seedSession(u); await u.bridge.disconnect(TOPIC);
  assert.equal(u.kit.calls.at(-1)[0], 'disconnect'); assert.deepEqual(u.log.disconnectedOrigins, ['https://app.uniswap.org']);
  const v = setup(); await seedSession(v); await v.bridge.onOriginDisconnected('https://app.uniswap.org');
  assert.equal((await v.bridge.sessions()).length, 0); assert.equal(v.kit.calls.at(-1)[0], 'disconnect');
});
test('expired sessions are not listed, and resume() only starts the relay when sessions exist', async () => {
  const t = setup(); await t.kv.set(M.SESSIONS_KEY, { [TOPIC]: { topic: TOPIC, origin: 'https://a.example', name: 'a', url: '', chains: [], methods: [], connectedAt: 1, expiry: NOW - 5 } });
  assert.equal((await t.bridge.sessions()).length, 0);
  let started = 0; const idle = new M.WalletConnectBridge({ kv: new MemKV(), perms: t.perms, service: () => ({}), createKit: async () => { started++; return fakeKit(); }, projectId: async () => 'a'.repeat(32), networks: { get: () => ({}) }, disconnectOrigin: async () => {} });
  await idle.resume(); assert.equal(started, 0);
  await seedSession(t); const busy = new M.WalletConnectBridge({ kv: t.kv, perms: t.perms, service: () => ({}), createKit: async () => { started++; return fakeKit(); }, projectId: async () => 'a'.repeat(32), networks: { get: () => ({}) }, disconnectOrigin: async () => {}, now: () => NOW * 1000 });
  await busy.resume(); assert.equal(started, 1);
});
