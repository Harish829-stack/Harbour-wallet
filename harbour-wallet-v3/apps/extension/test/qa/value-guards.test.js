// QA: the signing-chain policy is enforced BEFORE any key is opened. The real worker is bundled with an insecure (plain-http,
// non-loopback) API URL, which by policy.ts switches mainnet signing off (testnets stay on), and with a spy around openActiveKeys /
// openConnectionKeys (bundle-time transform; production files untouched). Every value-moving message aimed at a non-signing chain must be
// refused with no key opened, no signature and no broadcast. Network is an in-process fake that records calls.
// TEST_PLAN: T-MSG-005.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { harness, PASSWORD, PHRASE_ABOUT } from './harness.mjs';

const opened = []; const material = [];
// `opened`: a key set was opened (the keystore decrypted); `material`: private-key bytes / key objects were actually taken from it.
globalThis.__keySpy = { wrap(k, site) {
  const at = new Error().stack.split('\n').slice(3, 6).join(' | '); opened.push({ site, stack: at });
  const take = (name) => (...a) => { material.push({ site, name, stack: new Error().stack.split('\n').slice(2, 5).join(' | ') }); return k[name](...a); };
  return { ...k, evmPrivateKey: take('evmPrivateKey'), solanaKey: take('solanaKey'), ...(k.privateKeyFor ? { privateKeyFor: take('privateKeyFor') } : {}), ...(k.chainKey ? { chainKey: take('chainKey') } : {}), dispose: () => k.dispose() };
} };
const spy = (fn) => (src) => {
  const out = src.replace(`export async function ${fn}(`, `async function __real_${fn}(`);
  if (out === src) throw new Error(`${fn} not found: the spy needs updating`);
  return `${out}\nexport async function ${fn}(...a: any[]): Promise<any> { const k = await (__real_${fn} as any)(...a); return (globalThis as any).__keySpy.wrap(k, '${fn}'); }\n`;
};
const H = await harness(`
  import './background/index';
  export { isSigningChain, isSigningEvmChain, mainnetSigningReady } from './core/harbour/policy';
  export { HB_API_SECURE } from './core/harbour/config';
  export { chainById } from './core/chains/index';
`, { define: { 'import.meta.env': JSON.stringify({ VITE_HB_API_URL: 'http://api.harbour-qa.example' }) },
  transform: [[/background[\\/]keys\.ts$/, spy('openActiveKeys')], [/background[\\/]provider[\\/]wallet\.ts$/, spy('openConnectionKeys')]] });
const { M, F } = H;
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const ADDR0 = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const DEAD = '0x000000000000000000000000000000000000dEaD';
const calls = [];
// Answers any JSON-RPC body (so a handler that wrongly proceeds would reach signing and be caught by the spy); records everything.
function net(url, init) {
  let body = null; try { body = JSON.parse(typeof init?.body === 'string' ? init.body : 'null'); } catch { /* not json */ }
  calls.push({ url, method: body?.method });
  const one = (r) => ({ jsonrpc: '2.0', id: r?.id ?? 1, result: { eth_chainId: '0x1', eth_getTransactionCount: '0x0', eth_estimateGas: '0x5208', eth_gasPrice: '0x3b9aca00', eth_maxPriorityFeePerGas: '0x3b9aca00', eth_getBalance: '0xde0b6b3a7640000', eth_blockNumber: '0x10',
    eth_getBlockByNumber: { number: '0x10', baseFeePerGas: '0x3b9aca00', timestamp: '0x1', hash: '0x' + '11'.repeat(32), transactions: [] }, eth_feeHistory: { baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'], gasUsedRatio: [0.5], oldestBlock: '0x1', reward: [['0x3b9aca00']] }, eth_sendRawTransaction: '0x' + 'ab'.repeat(32) }[r?.method] ?? '0x' });
  return new Response(JSON.stringify(Array.isArray(body) ? body.map(one) : one(body)), { status: 200, headers: { 'content-type': 'application/json' } });
}

before(async () => {
  H.reset(); F.fetchImpl = net;
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});

test('T-MSG-005: the build under test really has mainnet signing off (insecure API) and testnets on', () => {
  assert.equal(M.HB_API_SECURE, false); assert.equal(M.mainnetSigningReady(), false);
  for (const id of ['ethereum', 'base', 'polygon', 'arbitrum', 'solana', 'bitcoin', 'tron', 'cosmos']) assert.equal(M.isSigningChain(M.chainById(id)), false, id);
  assert.equal(M.isSigningChain(M.chainById('sepolia')), true);
  assert.equal(M.isSigningEvmChain(1), false); assert.equal(M.isSigningEvmChain(11155111), true); assert.equal(M.isSigningEvmChain(999_999_991), false, 'unknown EVM id');
});

test('T-MSG-005: every value-moving message for a non-signing chain is refused before any key is opened; nothing is broadcast', async (t) => {
  const cases = [];
  for (const chainId of ['ethereum', 'base', 'polygon', 'solana', 'bitcoin', 'tron', 'cosmos', 'ripple', 'not-a-chain']) {
    cases.push({ type: 'sendQuote', chainId, to: DEAD, amount: '0.01', tier: 'average' });
    cases.push({ type: 'sendSubmit', chainId, to: DEAD, amount: '0.01', tier: 'average', planHash: 'x' });
  }
  for (const chainId of ['ethereum', 'base', 'arbitrum', 1, 8453]) {
    cases.push({ type: 'earnSubmit', chainId, protocol: 'aave', action: 'supply', asset: DEAD, amount: '1' });
    cases.push({ type: 'approvalsRevoke', chainId, token: DEAD, spender: DEAD });
    cases.push({ type: 'nftTransferSubmit', chainId, contract: DEAD, tokenId: '1', to: DEAD });
    cases.push({ type: 'sendNftSubmit', chainId, contract: DEAD, tokenId: '1', to: DEAD });
    cases.push({ type: 'smartAccountPrepare', chainId: typeof chainId === 'number' ? chainId : 1 });
    cases.push({ type: 'smartAccountApprove', chainId: typeof chainId === 'number' ? chainId : 1 });
  }
  for (const m of ['swapQuote', 'swapApprove', 'swapSubmit']) cases.push({ type: m, fromChain: 'ethereum', toChain: 'ethereum', from: 'ethereum', to: 'ethereum_0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', amount: '0.1', quoteId: 'q' });
  cases.push({ type: 'perpsEnable' }, { type: 'perpsDeposit', amount: '10000000' }, { type: 'predictionWrap', amount: '1' });
  const refused = [];
  for (const m of cases) {
    const before = opened.length; const mb = material.length; const bc = calls.filter((c) => c.method === 'eth_sendRawTransaction').length;
    const r = await Promise.race([send(m), tick(20_000).then(() => ({ timeout: true }))]);
    assert.ok(!r?.timeout, `${m.type} ${m.chainId ?? ''} answered`);
    assert.notEqual(r?.ok === true && (r.hash || r.txHash || r.signature), true, `${m.type} ${m.chainId}: produced a signature/hash ${JSON.stringify(r)}`);
    assert.equal(material.length, mb, `${m.type} ${String(m.chainId)}: took key material (${material.slice(mb).map((o) => o.name + ' ' + o.stack).join(' / ')})`);
    // Opening the keystore without taking key material is only acceptable for the quote (it reads the account addresses; see OBS-05).
    if (m.type !== 'swapQuote') assert.equal(opened.length, before, `${m.type} ${String(m.chainId)}: opened keys (${opened.slice(before).map((o) => o.stack).join(' / ')})`);
    assert.equal(calls.filter((c) => c.method === 'eth_sendRawTransaction').length, bc, `${m.type} broadcast`);
    if (r?.ok !== true) refused.push(m.type);
  }
  t.diagnostic(`${cases.length} value-moving calls, ${refused.length} explicitly refused, no key material taken`);
});

test('T-MSG-005: the dApp provider refuses to switch to, or send on, a non-signing chain; testnet signing still works', async () => {
  const L = { m: [] }; const out = []; let n = 0;
  const port = { name: 'harbour-provider', sender: { id: 'test', url: 'https://dapp.qa.example/app', origin: 'https://dapp.qa.example', frameId: 0, documentId: 'd1', tab: { id: 77, url: 'https://dapp.qa.example/', title: 'QA' } },
    onMessage: { addListener: (f) => L.m.push(f), removeListener() {} }, onDisconnect: { addListener() {}, removeListener() {} }, postMessage: (m) => out.push(structuredClone(m)), disconnect() {} };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  const req = (method, params) => { const id = `q${++n}`; L.m.forEach((f) => f({ id, ns: 'evm', method, params })); return id; };
  const res = async (id) => { for (let i = 0; i < 2000; i++) { const r = out.find((m) => m.t === 'res' && m.id === id); if (r) return r; await tick(5); } return { timeout: true }; };
  const approve = async () => { for (let i = 0; i < 1000; i++) { const r = await send({ type: 'providerPending' }); if (r.items?.[0]) return send({ type: 'providerResolve', id: r.items[0].id, decision: { approve: true } }); await tick(5); } return null; };
  const c = req('eth_requestAccounts'); await approve(); assert.deepEqual((await res(c)).result?.map((a) => a.toLowerCase()), [ADDR0.toLowerCase()]);
  const before = opened.length;
  const sw = req('wallet_switchEthereumChain', [{ chainId: '0x1' }]);
  const swr = await Promise.race([res(sw), (async () => { await approve(); return res(sw); })()]);
  assert.ok(swr.error, `switch to mainnet refused: ${JSON.stringify(swr)}`);
  const tx = req('eth_sendTransaction', [{ from: ADDR0, to: DEAD, value: '0x1', chainId: '0x1' }]);
  const txr = await Promise.race([res(tx), (async () => { await approve(); return res(tx); })()]);
  assert.ok(!txr.result, `no transaction on a non-signing chain: ${JSON.stringify(txr)}`);
  assert.equal(opened.length, before, 'no key opened for the refused requests');
  // control: testnet signing is allowed in the same build (the guard is the policy, not a broken signer)
  const s2 = req('wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }]); await approve(); assert.equal((await res(s2)).error, undefined);
  const ps = req('personal_sign', ['0x6869', ADDR0]); await approve(); assert.match((await res(ps)).result ?? '', /^0x[0-9a-f]{130}$/);
  assert.ok(opened.length > before, 'the spy sees the testnet signature');
});
