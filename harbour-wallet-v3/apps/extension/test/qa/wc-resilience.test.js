// QA: WalletConnect bridge when the relay connection is lost (service-worker restart, relay down, socket closed while answering).
// The real WalletConnectBridge with a fake relay kit (same approach as test/walletconnect.test.js). TEST_PLAN: T-DAPP-057.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../src/', import.meta.url));
const out = await build({ stdin: { contents: `export { WalletConnectBridge, SESSIONS_KEY } from './background/walletconnect/bridge'; export { PermissionStore } from './core/provider/store';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const TOPIC = 'ab'.repeat(32), NOW = 1_700_000_000, O = 'https://app.uniswap.org', K = O + '#walletconnect';
const EVM = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
class MemKV { constructor() { this.m = new Map(); } async get(k) { const v = this.m.get(k); return v === undefined ? undefined : JSON.parse(v); } async set(k, v) { this.m.set(k, JSON.stringify(v)); } async remove(k) { this.m.delete(k); } }
function fakeKit(opts = {}) {
  return { handlers: {}, calls: [], failRespond: opts.failRespond ?? 0, on(e, cb) { this.handlers[e] = cb; }, async pair() {}, async approveSession() { return {}; }, async rejectSession(a) { this.calls.push(['reject', a]); },
    async respondSessionRequest(a) { if (this.failRespond > 0) { this.failRespond--; this.calls.push(['respond-failed', a]); throw new Error('socket closed'); } this.calls.push(['respond', a]); },
    async disconnectSession(a) { this.calls.push(['disconnect', a]); }, getActiveSessions() { return {}; } };
}
async function persisted() {
  const kv = new MemKV(); const perms = new M.PermissionStore(kv);
  await kv.set(M.SESSIONS_KEY, { [TOPIC]: { topic: TOPIC, origin: K, name: 'Uni', url: O, chains: ['eip155:1'], methods: ['eth_sendTransaction'], connectedAt: 1 } });
  await perms.connect({ origin: K, walletId: 'w', walletName: 'W', accountIndex: 0, accountName: 'A', chainId: 1, namespaces: ['evm'], evmAddress: EVM });
  return { kv, perms };
}
const bridgeOn = (s, createKit) => new M.WalletConnectBridge({ kv: s.kv, perms: s.perms, service: () => ({ async handle() { return { done: false }; }, async queueWcSession() {} }), createKit, projectId: async () => 'a'.repeat(32),
  networks: { get: (id) => (id === 1 ? {} : undefined) }, disconnectOrigin: async () => {}, now: () => NOW * 1000 });
const flush = () => new Promise((r) => setTimeout(r, 20));

test('T-DAPP-057: a request pending when the worker (and its relay socket) died is answered after the keep-alive alarm reconnects', async () => {
  const s = await persisted();
  const kit1 = fakeKit(); const a = bridgeOn(s, async () => kit1); await a.ensure();
  kit1.handlers.session_request({ id: 31, topic: TOPIC, params: { chainId: 'eip155:1', request: { method: 'eth_sendTransaction', params: [{}] } } }); await flush();
  assert.equal(kit1.calls.length, 0, 'waiting for the user');
  // service worker restarts: a new bridge instance, the old socket is gone
  const kit2 = fakeKit(); let started = 0; const b = bridgeOn(s, async () => { started++; return kit2; });
  await b.resume(); assert.equal(started, 1, 'the alarm-driven resume reconnects because a session exists');
  assert.equal(await b.deliver(`wc:${TOPIC}`, '31', { result: '0xhash' }), true);
  assert.deepEqual(kit2.calls.at(-1), ['respond', { topic: TOPIC, response: { id: 31, jsonrpc: '2.0', result: '0xhash' } }]);
  // a deliver arriving before any resume starts the relay itself
  const kit3 = fakeKit(); const c = bridgeOn(s, async () => kit3);
  await c.deliver(`wc:${TOPIC}`, '32', { error: { code: 4001, message: 'User rejected the request.' } });
  assert.equal(kit3.calls.at(-1)[1].response.error.code, 5000);
});

test('T-DAPP-057: relay unreachable at one alarm → the next alarm reconnects (no stuck "starting" state)', async () => {
  const s = await persisted(); let n = 0; const kit = fakeKit();
  const b = bridgeOn(s, async () => { if (++n === 1) throw new Error('relay down'); return kit; });
  await b.resume(); assert.equal(n, 1);
  await b.resume(); assert.equal(n, 2, 'retried on the next alarm');
  assert.equal(await b.ensure(), kit);
});

test('T-DAPP-057: an answer that fails to send (socket closed at that moment) is retried or reported, never dropped silently', async (t) => {
  const s = await persisted(); const kit = fakeKit({ failRespond: 1 }); const b = bridgeOn(s, async () => kit); await b.ensure();
  await b.deliver(`wc:${TOPIC}`, '41', { result: '0xsig' });
  await new Promise((r) => setTimeout(r, 200));
  await b.resume(); // a keep-alive tick later
  const delivered = kit.calls.some((c) => c[0] === 'respond' && c[1].response.id === 41);
  if (!delivered) return assert.fail('BUG-17 regression (fixed bug reproduces again): ' + `respondSessionRequest failed once (${kit.calls.map((c) => c[0]).join(', ')}): the approved answer was swallowed (bridge.ts respond(): .catch(() => {})) and never re-sent; the dApp waits forever`);
});
