import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { decodeFunctionData, encodeFunctionData, encodePacked, zeroAddress } from 'viem';

const out = await build({ stdin: { contents: `export * from './aave'; export * from './uniswap'; export * from './routing'; export * from './plans'; export * from './config'; export * from './abis'; export * from './rpc';`, resolveDir: fileURLToPath(new URL('../src/integrations/testnet-defi/', import.meta.url)), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const OWNER = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';
const OUTPUT = '0x3333333333333333333333333333333333333333';
const ATOKEN = '0x4444444444444444444444444444444444444444';
const EDGE = { address: '0x5555555555555555555555555555555555555555', token0: TOKEN, token1: OUTPUT, fee: 3000 };
const ACTIVE = 1n << 56n;

function fakeClient(overrides = {}) {
  return {
    async readContract(r) {
      switch (r.functionName) {
        case 'getReservesList': return [TOKEN];
        case 'symbol': return r.address === OUTPUT ? 'OUT' : 'TEST';
        case 'decimals': return 6;
        case 'balanceOf': return r.address === ATOKEN ? 2_000_000n : 20_000_000n;
        case 'allowance': return 0n;
        case 'getConfiguration': return ACTIVE;
        case 'getReserveTokensAddresses': return [ATOKEN, zeroAddress, zeroAddress];
        case 'getReserveData': return [0n, 0n, 5_000_000n, 0n, 0n, 5n * 10n ** 25n, 0n, 0n, 0n, 10n ** 27n, 0n, 0n];
        default: throw new Error(`Unexpected read ${r.functionName}`);
      }
    },
    async getBalance() { return 10n ** 18n; },
    async simulateContract(r) { return { result: r.functionName === 'withdraw' ? r.args[1] : [100_000_000n, [], [], 150_000n] }; },
    ...overrides,
  };
}

test('Sepolia module rejects mainnets and other testnets', () => {
  assert.doesNotThrow(() => M.assertTestnetNetwork('sepolia'));
  for (const id of ['ethereum', 'base-sepolia', '', '11155111']) assert.throws(() => M.assertTestnetNetwork(id), /Sepolia/);
});
test('review IDs are account-bound, expiring, single-use and bounded', () => {
  const store = new M.ReviewStore();
  store.put('one', { expiresAt: 200, owner: 'wallet:0' }, 100);
  assert.throws(() => store.take('one', 'wallet:1', 101), /account changed/);
  assert.equal(store.take('one', 'wallet:0', 102).owner, 'wallet:0');
  assert.throws(() => store.take('one', 'wallet:0', 103), /expired/);
  store.put('expired', { expiresAt: 200, owner: 'wallet:0' }, 100);
  assert.throws(() => store.take('expired', 'wallet:0', 200), /expired/);
  for (let i = 0; i < 30; i++) store.put(String(i), { expiresAt: 1000, owner: 'wallet:0' }, 100);
  assert.throws(() => store.put('overflow', { expiresAt: 1000, owner: 'wallet:0' }, 100), /Too many/);
});
test('Aave live discovery handles caps and keeps existing positions visible when frozen', async () => {
  const client = fakeClient();
  const assets = await M.listEarnAssets(client, OWNER);
  assert.equal(assets.length, 1); assert.equal(assets[0].canSupply, true);
  assert.ok(assets[0].apy > 5 && assets[0].apy < 5.2);
  const frozen = fakeClient({ readContract: async (r) => r.functionName === 'getConfiguration' ? ACTIVE | (1n << 57n) : client.readContract(r) });
  const existing = await M.listEarnAssets(frozen, OWNER);
  assert.equal(existing[0].canSupply, false); assert.equal(existing[0].canWithdraw, true);
  await assert.rejects(M.prepareEarn(frozen, OWNER, TOKEN, 1n, 'supply'), /paused/);
  const capped = fakeClient({ readContract: async (r) => r.functionName === 'getConfiguration' ? ACTIVE | (6n << 116n) : client.readContract(r) });
  assert.equal((await M.reserve(capped, TOKEN, OWNER)).supplyRemaining, '1000000');
  await assert.rejects(M.prepareEarn(capped, OWNER, TOKEN, 1_000_001n, 'supply'), /cap/);
});
test('Aave builders encode one reusable supply call with exact allowance and the account as recipient', async () => {
  const built = await M.prepareEarn(fakeClient(), OWNER, TOKEN, 1_000_000n, 'supply');
  assert.equal(built.calls.length, 2);
  const approval = decodeFunctionData({ abi: M.tokenAbi, data: built.calls[0].data });
  assert.equal(approval.functionName, 'approve'); assert.equal(approval.args[1], 1_000_000n);
  assert.equal(built.calls[0].to, TOKEN);
  const supply = decodeFunctionData({ abi: M.poolAbi, data: built.calls[1].data });
  assert.deepEqual(supply.args, [TOKEN, 1_000_000n, OWNER, 0]);
  await assert.rejects(M.prepareEarn(fakeClient(), OWNER, OUTPUT, 1n, 'supply'), /not supported/);
});
test('withdrawal checks supplied balance, live liquidity, pause and collateral simulation', async () => {
  const client = fakeClient();
  await assert.rejects(M.prepareEarn(client, OWNER, TOKEN, 2_000_001n, 'withdraw'), /not available/);
  const restricted = fakeClient({ simulateContract: async () => { throw new Error('Health factor restriction'); } });
  await assert.rejects(M.prepareEarn(restricted, OWNER, TOKEN, 1n, 'withdraw'), /Health factor/);
  const built = await M.prepareEarn(client, OWNER, TOKEN, 1n, 'withdraw');
  assert.equal(built.calls.length, 1);
  assert.deepEqual(decodeFunctionData({ abi: M.poolAbi, data: built.calls[0].data }).args, [TOKEN, 1n, OWNER]);
});
test('approval reset supports nonzero existing allowances without granting unlimited approval', async () => {
  const client = fakeClient({ readContract: async () => 1n });
  const calls = await M.approvals(client, TOKEN, OWNER, M.SEPOLIA.router, 10n);
  assert.deepEqual(calls.map((c) => decodeFunctionData({ abi: M.tokenAbi, data: c.data }).args[1]), [0n, 10n]);
  assert.deepEqual(await M.approvals(fakeClient({ readContract: async () => 10n }), TOKEN, OWNER, M.SEPOLIA.router, 10n), []);
});
test('V3 routes include direct and reverse paths and an intermediate token, never self swaps', () => {
  const edge2 = { ...EDGE, token0: OUTPUT, token1: ATOKEN, fee: 500 };
  assert.deepEqual(M.pathsFor([EDGE], TOKEN, OUTPUT), [encodePacked(['address', 'uint24', 'address'], [TOKEN, 3000, OUTPUT])]);
  assert.deepEqual(M.pathsFor([EDGE], OUTPUT, TOKEN), [encodePacked(['address', 'uint24', 'address'], [OUTPUT, 3000, TOKEN])]);
  assert.equal(M.pathsFor([EDGE, edge2], TOKEN, ATOKEN, [OUTPUT])[0].length, 134);
  assert.deepEqual(M.pathsFor([EDGE, edge2], TOKEN, ATOKEN), [], 'UI and backend only use configured intermediate bases');
  assert.deepEqual(M.pathsFor([EDGE], TOKEN, TOKEN), []);
  assert.deepEqual(M.pathsFor([], TOKEN, OUTPUT), []);
});
test('pool discovery omits absent and zero active-liquidity pools; RPC errors surface', async () => {
  let n = 0;
  const client = fakeClient({ multicall: async ({ contracts }) => {
    n++; return n === 1 ? contracts.map((_, i) => i === 0 || i === 1 ? EDGE.address : zeroAddress) : [0n, 1n];
  } });
  const pools = await M.discoverPools(client, [TOKEN]);
  assert.equal(pools.length, 1);
  await assert.rejects(M.discoverPools(fakeClient({ multicall: async () => { throw new Error('RPC unavailable'); } }), [TOKEN]), /RPC unavailable/);
});
test('pool discovery unwraps viem allowFailure multicall result objects', async () => {
  const client = fakeClient({ multicall: async ({ contracts }) => contracts[0].functionName === 'getPool'
    ? contracts.map((_, i) => ({ status: 'success', result: i === 0 ? EDGE.address : zeroAddress }))
    : [{ status: 'success', result: 100n }] });
  const pools = await M.discoverPools(client, [TOKEN]);
  assert.equal(pools.length, 1);
});
test('SDK slippage rounds down precisely for large integer amounts', () => {
  const token = { address: OUTPUT, symbol: 'OUT', decimals: 6, balance: '0' };
  const raw = 12345678901234567890123456789n;
  assert.equal(M.minimumOutput(token, raw, 50), raw * 9950n / 10000n);
  for (const slippage of [-1, 0, 501, 0.5, NaN]) assert.throws(() => M.minimumOutput(token, raw, slippage), /Slippage/);
});
test('Uniswap API swap: proxy target, exact approval, wrong spender or target refused', async () => {
  const PROXY = M.SEPOLIA.apiRouter; const MAX = (1n << 256n) - 1n;
  const approveData = (spender, amt) => encodeFunctionData({ abi: M.tokenAbi, functionName: 'approve', args: [spender, amt] });
  const run = async ({ spender = PROXY, swapTo = PROXY, cancel = null, minimum = '995', swapValue = '0x00', status = 200, error = null } = {}) => {
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const path = String(url).split('/uniswap/v1/')[1]; const json = (body) => ({ ok: status === 200, status, json: async () => body });
      if (error) return json(error);
      if (path === 'quote') return json({ routing: 'CLASSIC', quote: { output: { amount: '1000', minimumAmount: minimum } } });
      if (path === 'check_approval') return json({ approval: { to: TOKEN, from: OWNER, chainId: 11155111, value: '0x00', data: approveData(spender, MAX) }, cancel });
      if (path === 'swap') return json({ swap: { to: swapTo, from: OWNER, chainId: 11155111, value: swapValue, data: '0x2894adf900' } });
      throw new Error(`unexpected ${path} ${init?.method}`);
    };
    try { return await M.prepareSwap(fakeClient(), OWNER, TOKEN, OUTPUT, 1_000_000n, 50, 123456); } finally { globalThis.fetch = real; }
  };
  const built = await run();
  assert.equal(built.calls.length, 2);
  const approve = decodeFunctionData({ abi: M.tokenAbi, data: built.calls[0].data });
  assert.equal(built.calls[0].to.toLowerCase(), TOKEN); assert.equal(approve.args[0], PROXY); assert.equal(approve.args[1], 1_000_000n, 'exact, not unlimited');
  assert.equal(built.calls[1].to, PROXY);
  await assert.rejects(run({ spender: OUTPUT }), /unexpected approval target/);
  await assert.rejects(run({ swapTo: OUTPUT }), /invalid or unexpected transaction/);
  const reset = await run({ cancel: { to: TOKEN, from: OWNER, chainId: 11155111, value: '0x00', data: approveData(PROXY, 0n) } });
  assert.equal(reset.calls.length, 3); assert.equal(decodeFunctionData({ abi: M.tokenAbi, data: reset.calls[0].data }).args[1], 0n);
  await assert.rejects(run({ cancel: { to: TOKEN, from: OWNER, chainId: 11155111, value: '0x00', data: approveData(PROXY, 5n) } }), /invalid approval reset/);
  // The displayed minimum must honour the user's slippage and the swap must not carry ETH for a token input.
  await assert.rejects(run({ minimum: '900' }), /slippage tolerance/);
  await assert.rejects(run({ minimum: '1001' }), /slippage tolerance/);
  await assert.rejects(run({ swapValue: '0x01' }), /unexpected ETH amount/);
  // Raw upstream errors are never shown; gateway messages (already user-facing) are.
  await assert.rejects(run({ status: 404, error: { errorCode: 'NO_ROUTE', detail: 'No quotes available 0xdead' } }), (e) => /No Uniswap route/.test(e.message) && !/0xdead/.test(e.message));
  await assert.rejects(run({ status: 503, error: { error: { code: 'uniswap_not_configured', message: 'Uniswap Trading API is not configured.' } } }), /not configured/);
});
test('ETH wrapping uses the canonical contract and equal input/output without a swap quote', async () => {
  const built = await M.prepareWrap(fakeClient(), OWNER, 100n, 'wrap');
  assert.equal(built.calls[0].to, M.SEPOLIA.weth); assert.equal(built.calls[0].value, 100n);
  assert.equal(built.calls[0].data, '0xd0e30db0'); assert.equal(built.review.expectedOutput, '100');
});
