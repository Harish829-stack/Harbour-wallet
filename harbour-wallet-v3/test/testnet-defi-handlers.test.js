import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const mock = new Map([
  ['background/handlers/earnKeys.ts', `export const activeInfo=async()=>globalThis.__defi.info;`],
  ['core/storage.ts', `export const KEYS={UI:'ui'}; export const local={get:async()=>({networkFilter:globalThis.__defi.network})};`],
  ['core/harbour/policy.ts', `export const assertFeature=()=>{if(!globalThis.__defi.enabled)throw Error('Feature disabled')}; export const assertSigningEvmChain=()=>{};`],
  ['integrations/testnet-defi/client.ts', `export const defiClient=()=>globalThis.__defi.client;`],
  ['background/keys.ts', `export async function openActiveKeys(){const s=globalThis.__defi;if(s.locked)throw Error('Wallet is locked');return{walletId:s.info.walletId,derivationIndex:s.info.derivationIndex,privateKeyFor(){const b=new Uint8Array(32).fill(7);s.buffers.push(b);return b},dispose(){s.disposed++}}}`],
  ['core/provider/evmAccount.ts', `export const evmAccountFromBytes=()=>({address:globalThis.__defi.info.addresses.ethereum,signTransaction:async(tx)=>{globalThis.__defi.signed.push(tx);return '0xdeadbeef'}});`],
].map(([name, source]) => [path.join(root, name), source]));
const out = await build({ entryPoints: [path.join(root, 'background/handlers/testnetDefi.ts')], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', plugins: [{ name: 'defi-host-mocks', setup(b) {
  b.onResolve({ filter: /^\./ }, (args) => { const target = path.resolve(args.resolveDir, args.path) + '.ts'; return mock.has(target) ? { path: target, namespace: 'host-mock' } : undefined; });
  b.onLoad({ filter: /.*/, namespace: 'host-mock' }, (args) => ({ contents: mock.get(args.path), loader: 'js' }));
} }] });
const { handlers } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const ACCOUNT = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';
const ATOKEN = '0x3333333333333333333333333333333333333333';
function reset() {
  const state = { network: 'sepolia', chainId: 11155111, enabled: true, locked: false, info: { walletId: 'wallet-one', derivationIndex: 0, walletType: 'mnemonic', addresses: { ethereum: ACCOUNT } }, signed: [], sent: [], buffers: [], disposed: 0, receiptStatus: 'success' };
  state.client = {
    getChainId: async () => state.chainId,
    getCode: async () => '0x1234',
    getBalance: async () => 10n ** 18n,
    readContract: async (r) => {
      if (r.functionName === 'getReservesList') return [TOKEN];
      if (r.functionName === 'symbol') return 'TEST';
      if (r.functionName === 'decimals') return 6;
      if (r.functionName === 'balanceOf') return 100_000_000n;
      if (r.functionName === 'allowance') return 0n;
      if (r.functionName === 'getConfiguration') return 1n << 56n;
      if (r.functionName === 'getReserveTokensAddresses') return [ATOKEN, ATOKEN, ATOKEN];
      if (r.functionName === 'getReserveData') return [0n,0n,0n,0n,0n,0n,0n,0n,0n,10n ** 27n,0n,0n];
      throw Error(`Unexpected ${r.functionName}`);
    },
    estimateGas: async () => 50_000n,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 100_000_000n }),
    getTransactionCount: async () => state.sent.length,
    sendRawTransaction: async (tx) => { state.sent.push(tx); return `0x${String(state.sent.length).padStart(64, '0')}`; },
    waitForTransactionReceipt: async () => {
      assert.ok(state.buffers.every((b) => b.every((v) => v === 0)), 'keys must be wiped before waiting for receipts');
      return { status: state.receiptStatus };
    },
  };
  globalThis.__defi = state; return state;
}
const prepare = () => handlers.defiPrepare({ request: { networkId: 'sepolia', action: 'supply', token: TOKEN, amount: '1' } }, {});
const submit = (id, extra = {}) => handlers.defiSubmit({ networkId: 'sepolia', kind: 'earn', id, ...extra }, {});

test('worker blocks unsupported network, RPC mismatch, disabled features and unsupported wallet types', async () => {
  const s = reset(); s.network = 'ethereum'; await assert.rejects(prepare(), /network changed/);
  s.network = 'sepolia'; s.chainId = 1; await assert.rejects(prepare(), /different network/);
  s.chainId = 11155111; s.enabled = false; await assert.rejects(prepare(), /disabled/);
  s.enabled = true; s.info.walletType = 'ledger'; await assert.rejects(prepare(), /software wallets/);
});
test('worker rejects rounded/invalid input amounts rather than silently changing them', async () => {
  reset();
  for (const amount of ['0', '-1', '1.0000001', '1e6', 'NaN']) await assert.rejects(handlers.defiPrepare({ request: { networkId: 'sepolia', action: 'supply', token: TOKEN, amount } }, {}), /amount|precision/);
});
test('worker submits only its reviewed calldata and rejects replay', async () => {
  const s = reset(); const { review } = await prepare();
  assert.equal(s.signed.length, 0, 'preparation never signs');
  const result = await submit(review.id, { calls: [{ to: ACCOUNT, value: '999999', data: '0xbad' }] });
  assert.equal(result.ok, true); assert.equal(result.hashes.length, 2);
  assert.notEqual(s.signed[0].to, ACCOUNT); assert.equal(s.signed[0].chainId, 11155111);
  assert.equal(s.signed[0].nonce, 0); assert.equal(s.signed[1].nonce, 1);
  assert.equal(s.disposed, 2);
  await assert.rejects(submit(review.id), /expired/);
});
test('changing accounts or selected networks invalidates a pending review', async () => {
  const s = reset(); const { review } = await prepare();
  s.info = { ...s.info, derivationIndex: 1 };
  await assert.rejects(submit(review.id), /account changed/); assert.equal(s.sent.length, 0);
  s.info = { ...s.info, derivationIndex: 0 }; s.network = 'base-sepolia';
  await assert.rejects(submit(review.id), /network changed/); assert.equal(s.sent.length, 0);
});
test('locked wallets never sign and reverted approvals stop the remaining calls', async () => {
  let s = reset(); let { review } = await prepare(); s.locked = true;
  let result = await submit(review.id); assert.equal(result.ok, false); assert.equal(s.signed.length, 0);
  s = reset(); ({ review } = await prepare()); s.receiptStatus = 'reverted';
  result = await submit(review.id); assert.equal(result.ok, false); assert.equal(s.sent.length, 1);
  assert.equal(result.hashes.length, 1); assert.match(result.error, /reverted/);
});
test('simulation failure does not fall back to a guessed gas limit and submit anyway', async () => {
  const s = reset(); const { review } = await prepare();
  s.client.estimateGas = async () => { throw Error('Simulation reverted'); };
  const result = await submit(review.id); assert.equal(result.ok, false); assert.equal(s.sent.length, 0);
});
