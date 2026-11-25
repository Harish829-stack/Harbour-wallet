// E2E (node-level, full stack): hardware-wallet (Ledger) accounts. The "device" is a throwaway key held by the test: it reports its
// address to ledgerAddWallet and signs exactly the unsigned transaction the worker prepared, the way the popup's WebHID transport
// would. The worker must hold no key for the Ledger account, verify the device signature against the account before broadcasting,
// and refuse every local-key operation (reveal, copy, add account, smart account, perps, local send, dApp signing).
// TEST_PLAN: T-KEY-104, T-KEY-105.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseTransaction, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { harness, PASSWORD, PHRASE_ABOUT } from '../qa/harness.mjs';
import { startStack, stackRequirements } from './stack.mjs';

const realFetch = globalThis.fetch;
const missing = stackRequirements();
const e2e = (name, fn) => test(name, missing.length ? { skip: `E2E stack not configured: ${missing.join(', ')}` } : { timeout: 180_000 }, fn);
const INTERNAL = { id: 'test', url: 'chrome-extension://test/src/popup/index.html' };
const DEAD = '0x000000000000000000000000000000000000dEaD';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
// Throwaway "device" keys (well-known Hardhat test keys #1 and #2; never used with real funds).
const DEVICE = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const OTHER = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');

let S, H, F;
const send = (msg) => F.listeners['runtime.onMessage'][0](msg, INTERNAL);
before(async () => {
  if (missing.length) return;
  S = await startStack({ funded: { [DEVICE.address.toLowerCase()]: 10n ** 18n }, established: true });
  H = await harness(`import './background/index'; export { listAddresses } from './core/harbour/client'; export { KEYS } from './core/storage'; // ledger e2e`);
  F = H.F; H.reset();
  F.fetchImpl = async (url, init) => { const u = new URL(url); if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new TypeError(`NETWORK_DISABLED_IN_TESTS (${u.host})`); u.hostname = '127.0.0.1'; return realFetch(u.toString(), init); };
  assert.equal((await send({ type: 'createWallet', password: PASSWORD, mnemonic: PHRASE_ABOUT, name: 'Main' })).ok, true);
});
after(async () => { await S?.stop(); });

/** The device: sign exactly what the worker prepared and return only { r, s, v } as the Ledger app does. */
async function deviceSign(account, unsignedTx) {
  const tx = parseTransaction(unsignedTx);
  const raw = await account.signTransaction(tx);
  const p = parseTransaction(raw);
  return { r: p.r.slice(2), s: p.s.slice(2), v: (p.yParity ?? Number(p.v)).toString(16) };
}

let LEDGER_ID;
e2e('T-KEY-104: ledgerAddWallet stores addresses + paths only; prepare → device signs → submit broadcasts the device-signed tx; wrong signer, replay and bad input refused', async () => {
  // input validation
  assert.equal((await send({ type: 'ledgerAddWallet', accounts: { ethereum: { address: 'nope', path: "44'/60'/0'/0/0" } } })).ok, false);
  assert.equal((await send({ type: 'ledgerAddWallet', accounts: { ethereum: { address: DEVICE.address, path: 'not/a/path' } } })).ok, false);
  assert.equal((await send({ type: 'ledgerAddWallet', accounts: {} })).ok, false);
  const add = await send({ type: 'ledgerAddWallet', accounts: { ethereum: { address: DEVICE.address, path: "m/44'/60'/0'/0/0" } }, model: 'Nano X' });
  assert.equal(add.ok, true, JSON.stringify(add)); LEDGER_ID = add.walletId;
  assert.equal((await send({ type: 'ledgerAddWallet', accounts: { ethereum: { address: DEVICE.address, path: "44'/60'/0'/0/0" } } })).ok, false, 'same device account twice refused');
  // the worker holds no key for it: no keystore under the wallet id, and nothing in storage contains the device key
  assert.equal(F.local.data[LEDGER_ID], undefined, 'no keystore for a Ledger wallet');
  const dump = JSON.stringify([F.local.data, F.session.data, [...H.idb()]]).toLowerCase();
  assert.ok(!dump.includes('59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'), 'device key never stored');

  // wait until the API tracks the Ledger address (it only broadcasts for tracked accounts)
  for (let i = 0; i < 60 && !JSON.stringify(await H.M.listAddresses().catch(() => '')).toLowerCase().includes(DEVICE.address.toLowerCase()); i++) await tick(500);

  const prep = await send({ type: 'ledgerSendPrepare', chainId: 'sepolia', to: DEAD, amount: '0.01', tier: 'average' });
  assert.equal(prep.ok, true, JSON.stringify(prep)); assert.equal(prep.kind, 'evm'); assert.equal(prep.path, "44'/60'/0'/0/0"); assert.equal(prep.chainId, 11155111);
  const unsigned = parseTransaction(prep.unsignedTx);
  assert.equal(unsigned.to.toLowerCase(), DEAD.toLowerCase()); assert.equal(unsigned.value, 10n ** 16n); assert.equal(unsigned.chainId, 11155111);

  // a signature from another key is refused and nothing is broadcast
  const before = S.chain.txs.length;
  const wrong = await send({ type: 'ledgerSendSubmit', id: prep.id, signature: await deviceSign(OTHER, prep.unsignedTx) });
  assert.equal(wrong.ok, false); assert.match(wrong.error, /different account/);
  assert.equal(S.chain.txs.length, before);
  // the prepared tx is single-use: after the refused attempt the id is gone
  const replay = await send({ type: 'ledgerSendSubmit', id: prep.id, signature: await deviceSign(DEVICE, prep.unsignedTx) });
  assert.equal(replay.ok, false); assert.match(replay.error, /expired/);

  const prep2 = await send({ type: 'ledgerSendPrepare', chainId: 'sepolia', to: DEAD, amount: '0.01', tier: 'average' });
  for (const bad of [{}, { r: 'zz', s: '00', v: '1' }, { r: '11'.repeat(31), s: '22'.repeat(32), v: '0' }]) {
    const p = await send({ type: 'ledgerSendPrepare', chainId: 'sepolia', to: DEAD, amount: '0.01', tier: 'average' });
    const r = await send({ type: 'ledgerSendSubmit', id: p.id, signature: bad }); assert.equal(r.ok, false, JSON.stringify(bad)); assert.match(r.error, /Invalid signature/);
  }
  // the device signing a DIFFERENT transaction (e.g. a tampered recipient) does not recover to the account for the prepared one
  const tampered = parseTransaction(prep2.unsignedTx); const evil = await DEVICE.signTransaction({ ...tampered, to: OTHER.address });
  const ep = parseTransaction(evil);
  const t2 = await send({ type: 'ledgerSendSubmit', id: prep2.id, signature: { r: ep.r.slice(2), s: ep.s.slice(2), v: String(ep.yParity) } });
  assert.equal(t2.ok, false, 'a signature over another transaction does not verify for the prepared one');
  assert.equal(S.chain.txs.length, before);

  const prep3 = await send({ type: 'ledgerSendPrepare', chainId: 'sepolia', to: DEAD, amount: '0.01', tier: 'average' });
  const ok = await send({ type: 'ledgerSendSubmit', id: prep3.id, signature: await deviceSign(DEVICE, prep3.unsignedTx) });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const onChain = S.chain.txs.find((x) => x.hash === ok.hash); assert.ok(onChain, 'device-signed tx reached the chain');
  assert.equal(onChain.from, DEVICE.address.toLowerCase()); assert.equal(onChain.to, DEAD.toLowerCase()); assert.equal(BigInt(onChain.value), 10n ** 16n);
  assert.equal(keccak256(onChain.raw), ok.hash);
});

e2e('T-KEY-105: with the Ledger wallet active, every local-key operation is refused and no signature is produced', async (t) => {
  assert.ok(LEDGER_ID, 'Ledger wallet from T-KEY-104');
  const st = await send({ type: 'getAccounts' }); assert.equal(st.addresses?.ethereum?.toLowerCase(), DEVICE.address.toLowerCase(), 'Ledger account is active');
  assert.equal((await send({ type: 'revealAuth', method: 'password', password: PASSWORD, purpose: 'reveal', walletId: LEDGER_ID })).ok, true);
  const rev = await send({ type: 'revealPrivateKey', walletId: LEDGER_ID });
  assert.equal(rev.ok, false, `reveal refused: ${JSON.stringify(rev).slice(0, 200)}`);
  assert.equal((await send({ type: 'copyPrivateKey', walletId: LEDGER_ID })).ok, false);
  const addAcc = await send({ type: 'addAccount' }); assert.equal(addAcc.ok, false, `addAccount refused: ${JSON.stringify(addAcc)}`);
  const q = await send({ type: 'sendQuote', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average' });
  const local = await send({ type: 'sendSubmit', chainId: 'sepolia', to: DEAD, amount: '0.001', tier: 'average', planHash: q.planHash });
  assert.equal(local.ok, false, `software send from a Ledger account refused: ${JSON.stringify(local)}`);
  for (const m of [{ type: 'smartAccountPrepare', chainId: 11155111 }, { type: 'smartAccountApprove', chainId: 11155111 }, { type: 'perpsEnable' }, { type: 'earnSubmit', chainId: 'sepolia', protocol: 'aave', action: 'supply', asset: DEAD, amount: '1' }]) {
    const r = await send(m); assert.notEqual(r?.ok, true, `${m.type} refused: ${JSON.stringify(r)}`);
  }
  // dApp signing through the provider: the Ledger account cannot be signed for in the worker
  const L = { m: [] }; const out = [];
  const port = { name: 'harbour-provider', sender: { id: 'test', url: 'https://d.qa.example/app', origin: 'https://d.qa.example', frameId: 0, documentId: 'dl', tab: { id: 91, url: 'https://d.qa.example/', title: 'QA' } },
    onMessage: { addListener: (f) => L.m.push(f), removeListener() {} }, onDisconnect: { addListener() {}, removeListener() {} }, postMessage: (m) => out.push(structuredClone(m)), disconnect() {} };
  F.listeners['runtime.onConnect'].forEach((f) => f(port));
  const res = async (id) => { for (let i = 0; i < 3000; i++) { const r = out.find((m) => m.t === 'res' && m.id === id); if (r) return r; await tick(5); } return { timeout: true }; };
  const approve = async () => { for (let i = 0; i < 400; i++) { const r = await send({ type: 'providerPending' }); if (r.items?.[0]) return send({ type: 'providerResolve', id: r.items[0].id, decision: { approve: true } }); await tick(5); } return null; };
  L.m.forEach((f) => f({ id: 'a', ns: 'evm', method: 'eth_requestAccounts' })); await approve(); const acc = await res('a');
  t.diagnostic(`dApp connect with the Ledger wallet active: ${JSON.stringify(acc.result ?? acc.error)}`);
  if (acc.result?.length) {
    // OBS-06 (fixed): refused up front with 4200 and a plain sentence, no approval window first.
    L.m.forEach((f) => f({ id: 'b', ns: 'evm', method: 'personal_sign', params: ['0x6869', acc.result[0]] }));
    const sig = await res('b');
    assert.equal(sig.error?.code, 4200, JSON.stringify(sig)); assert.match(sig.error.message, /Hardware wallets cannot sign/);
    assert.equal((await send({ type: 'providerPending' })).items.length, 0, 'no approval was queued'); t.diagnostic(`dApp personal_sign on the Ledger account: ${JSON.stringify(sig.error ?? sig).slice(0, 160)}`); assert.ok(!sig.result, `no software signature for a Ledger account: ${JSON.stringify(sig)}`);
  }
});
