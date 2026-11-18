// Smart account service (background/smartAccountService.ts) end to end with fake chain, key and re-auth modules: the flag gates
// everything, Approve/Reject carry only a requestId, no key/digest/signature reaches the caller, re-auth is required, a request is
// single use and expires, and the signed type-4 transactions recover to the account with the pinned delegate (or zero for revoke).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { parseTransaction, recoverTransactionAddress, recoverAddress, hexToBytes, keccak256 } from 'viem';
import { hashAuthorization } from 'viem/experimental';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const stubs = {
  './keys': `export const openActiveKeys = async () => globalThis.__sa.openKeys();`,
  './reauth': `export const consumeReauth = async (p, need) => globalThis.__sa.consume(p, need);`,
  './store': `export const store = { getState: () => ({ sdkFeatureSlice: { flags: globalThis.__sa.flags } }) };`,
  './handlers/earnEvm': `export const evmClientFor = () => globalThis.__sa.client; export const feeData = async () => ({ maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n });`,
  './handlers/earnKeys': `export const activeInfo = async () => globalThis.__sa.info;`,
  '../core/sendService': `export const resolveSendChain = (_a, id) => (id === 84532 ? { id: 'base-sepolia', name: 'Base Sepolia', symbol: 'ETH', evmChainId: 84532, kind: 'evm' } : undefined);`,
};
const plugin = { name: 'stubs', setup(b) {
  b.onResolve({ filter: /^(\.\/(keys|reauth|store)|\.\/handlers\/(earnEvm|earnKeys)|\.\.\/core\/sendService)$/ }, (a) => (a.importer.endsWith('smartAccountService.ts') && stubs[a.path] ? { path: a.path, namespace: 'stub' } : undefined));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js' }));
} };
const out = await build({ stdin: { contents: `export * from './background/smartAccountService'; export { handlers } from './background/handlers/smartAccount'; export { DELEGATES } from './core/smartAccount/constants';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', plugins: [plugin], define: { 'import.meta.env': '{}' } });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // public anvil key
const ACCT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const CHAIN = 84532; const DELEGATE = M.DELEGATES[CHAIN];
const sa = globalThis.__sa = {};
function reset(over = {}) {
  Object.assign(sa, { flags: { smartAccounts: true }, code: '0x', nonce: 4, balance: 10n ** 18n, sent: [], disposed: 0, opened: 0, grants: 1, keyHex: PK, info: { walletId: 'w1', walletType: 'mnemonic', addresses: { ethereum: ACCT } }, ...over });
  sa.client = {
    getCode: async () => sa.code, getTransactionCount: async () => sa.nonce, getBalance: async () => sa.balance,
    sendRawTransaction: async ({ serializedTransaction }) => { sa.sent.push(serializedTransaction); return keccak256(serializedTransaction); },
  };
  sa.openKeys = async () => { sa.opened++; const b = hexToBytes(sa.keyHex); return { evmPrivateKey: () => b, dispose: () => { sa.disposed++; b.fill(0); } }; };
  sa.consume = async (p, need) => { assert.equal(p, 'manage'); assert.equal(need.walletId, 'w1'); if (sa.grants > 0) { sa.grants--; return true; } return false; };
}
const call = (type, msg = {}) => M.handlers[type]({ type, ...msg }, {});
const noSecrets = (r) => { const s = JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)); for (const bad of ['signature', 'digest', 'privateKey', 'rawTx', '"raw"', PK.slice(2, 14)]) assert.ok(!s.includes(bad), `response leaks ${bad}`); };

test('flag off (the default): status says unavailable and prepare refuses', async () => {
  reset({ flags: {} });
  assert.deepEqual({ ...(await call('smartAccountStatus', { chainId: CHAIN })) }, { ok: true, available: false });
  const p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  assert.equal(p.ok, false); assert.equal(p.code, 'unavailable'); assert.equal(sa.opened, 0);
});
test('unavailable for unpinned chains, hardware / watch-only wallets and unknown requests', async () => {
  reset();
  assert.equal((await call('smartAccountPrepare', { kind: 'enable', chainId: 1 })).code, 'unavailable');
  assert.equal((await call('smartAccountPrepare', { kind: 'enable', chainId: 0 })).code, 'unavailable');
  for (const walletType of ['ledger', 'watch']) { reset({ info: { walletId: 'w1', walletType, addresses: { ethereum: ACCT } } }); assert.equal((await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN })).code, 'unavailable'); }
  reset();
  assert.equal((await call('smartAccountPrepare', { kind: 'enable-all', chainId: CHAIN })).code, 'bad_request');
  assert.equal((await call('smartAccountApprove', { requestId: 'nope' })).code, 'expired');
  assert.equal((await call('smartAccountApprove', {})).code, 'expired');
  assert.equal((await call('smartAccountApprove', { requestId: { toString: () => 'x' } })).code, 'expired');
});
test('status reports state and the pinned delegate; prepare signs nothing and returns a summary with a requestId', async () => {
  reset();
  const s = await call('smartAccountStatus', { chainId: CHAIN });
  assert.equal(s.state, 'none'); assert.equal(s.delegate, DELEGATE); assert.equal(s.address, ACCT); assert.equal(s.network, 'Base Sepolia');
  const p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  assert.equal(p.ok, true); assert.match(p.requestId, /^[0-9a-f-]{36}$/); assert.equal(p.delegate, DELEGATE); assert.equal(p.maxFeeWei, String(150_000n * 2_400_000_000n)); assert.equal(p.needsReauth, true);
  assert.equal(sa.opened, 0, 'no key was opened'); assert.equal(sa.sent.length, 0); noSecrets(p); noSecrets(s);
  M.reject({ requestId: p.requestId });
});
test('approve needs a fresh re-auth, keeps the request for a retry, then signs a self-sent type-4 that recovers to the account', async () => {
  reset({ grants: 0 });
  const p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  const denied = await call('smartAccountApprove', { requestId: p.requestId });
  assert.equal(denied.code, 'AUTH_REQUIRED'); assert.equal(sa.opened, 0); assert.equal(sa.sent.length, 0);
  sa.grants = 1;
  const r = await call('smartAccountApprove', { requestId: p.requestId });
  assert.equal(r.ok, true); assert.deepEqual(Object.keys(r).sort(), ['chainId', 'kind', 'ok', 'txHash']); noSecrets(r);
  assert.equal(sa.sent.length, 1); assert.equal(sa.disposed, 1, 'key disposed'); assert.equal(sa.opened, 1);
  const raw = sa.sent[0]; const tx = parseTransaction(raw);
  assert.equal(tx.type, 'eip7702'); assert.equal(tx.chainId, CHAIN); assert.equal(tx.nonce, 4); assert.equal(tx.to.toLowerCase(), ACCT.toLowerCase()); assert.equal(tx.value ?? 0n, 0n); assert.equal(tx.gas, 150_000n);
  assert.equal((await recoverTransactionAddress({ serializedTransaction: raw })).toLowerCase(), ACCT.toLowerCase());
  const a = tx.authorizationList; assert.equal(a.length, 1);
  assert.equal(a[0].address.toLowerCase(), DELEGATE); assert.equal(Number(a[0].chainId), CHAIN); assert.equal(Number(a[0].nonce), 5, 'authorization nonce = tx nonce + 1');
  const signer = await recoverAddress({ hash: hashAuthorization({ address: a[0].address, chainId: CHAIN, nonce: 5 }), signature: { r: a[0].r, s: a[0].s, yParity: a[0].yParity } });
  assert.equal(signer.toLowerCase(), ACCT.toLowerCase());
  assert.equal((await call('smartAccountApprove', { requestId: p.requestId })).code, 'expired', 'a request is single use');
});
test('revoke authorizes the zero address; enable on an enabled account and revoke on a plain one are refused', async () => {
  reset({ code: '0xef0100' + DELEGATE.slice(2) });
  assert.equal((await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN })).code, 'already_enabled');
  const p = await call('smartAccountPrepare', { kind: 'revoke', chainId: CHAIN }); assert.equal(p.ok, true); assert.equal(p.delegate, null);
  const r = await call('smartAccountApprove', { requestId: p.requestId }); assert.equal(r.ok, true); assert.equal(r.kind, 'revoke');
  const a = parseTransaction(sa.sent[0]).authorizationList[0];
  assert.equal(a.address, '0x0000000000000000000000000000000000000000'); assert.equal(Number(a.chainId), CHAIN);
  reset(); assert.equal((await call('smartAccountPrepare', { kind: 'revoke', chainId: CHAIN })).code, 'not_enabled');
});
test('an account delegated to another contract can be re-delegated or revoked, and is reported as such', async () => {
  const other = '0x' + '22'.repeat(20); reset({ code: '0xef0100' + other.slice(2) });
  const s = await call('smartAccountStatus', { chainId: CHAIN }); assert.equal(s.state, 'other'); assert.equal(s.delegatedTo, other);
  assert.equal((await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN })).ok, true);
  assert.equal((await call('smartAccountPrepare', { kind: 'revoke', chainId: CHAIN })).ok, true);
});
test('fails closed: state changed, expired, key mismatch, account changed; nothing is broadcast and the key is still disposed', async () => {
  reset(); let p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  sa.code = '0xef0100' + DELEGATE.slice(2); // someone delegated it in between
  let r = await call('smartAccountApprove', { requestId: p.requestId });
  assert.equal(r.code, 'guard_failed'); assert.match(r.error, /nothing was signed/); assert.equal(sa.sent.length, 0); assert.equal(sa.opened, 0);

  reset(); p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  const real = Date.now; Date.now = () => real() + 121_000;
  try { r = await call('smartAccountApprove', { requestId: p.requestId }); } finally { Date.now = real; }
  assert.equal(r.code, 'guard_failed'); assert.equal(sa.sent.length, 0);

  reset({ keyHex: '0x' + '11'.repeat(32) }); p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  r = await call('smartAccountApprove', { requestId: p.requestId });
  assert.equal(r.code, 'guard_failed'); assert.equal(sa.sent.length, 0); assert.equal(sa.opened, 1); assert.equal(sa.disposed, 1);

  reset(); p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  sa.info = { ...sa.info, addresses: { ethereum: '0x' + '33'.repeat(20) } };
  r = await call('smartAccountApprove', { requestId: p.requestId });
  assert.equal(r.code, 'guard_failed'); assert.equal(sa.sent.length, 0); assert.equal(sa.opened, 0);
});
test('flag turned off between prepare and approve stops the signature', async () => {
  reset(); const p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  sa.flags = { smartAccounts: false };
  const r = await call('smartAccountApprove', { requestId: p.requestId });
  assert.equal(r.ok, false); assert.equal(sa.sent.length, 0); assert.equal(sa.opened, 0);
});
test('not enough balance for the network fee: refused before anything is remembered', async () => {
  reset({ balance: 1n });
  const before = M.preparedCount(); const p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  assert.equal(p.code, 'insufficient_funds'); assert.equal(M.preparedCount(), before);
});
test('reject forgets the request; only the four UI messages exist', async () => {
  reset(); const p = await call('smartAccountPrepare', { kind: 'enable', chainId: CHAIN });
  assert.deepEqual({ ...M.reject({ requestId: p.requestId }) }, { ok: true });
  assert.equal((await call('smartAccountApprove', { requestId: p.requestId })).code, 'expired');
  assert.deepEqual(Object.keys(M.handlers).sort(), ['smartAccountApprove', 'smartAccountPrepare', 'smartAccountReject', 'smartAccountStatus']);
});
