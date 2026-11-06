import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, parseAbi, zeroAddress } from 'viem';

const out = await build({ stdin: { contents: `export * from './aavekit'; export * from './config'; export * from './abis';`, resolveDir: fileURLToPath(new URL('../src/integrations/testnet-defi/', import.meta.url)), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const D = M.BASE_SEPOLIA;
const OWNER = '0x7ece450c274672c8007372F81cfCCC1c412466bb';
const USDC = '0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f';
const WETH = '0x4200000000000000000000000000000000000006';
const AWETH = '0x73a5bB60b0B0fc35710DDc0ea9c407031E31Bdbb';
const AUSDC = '0x10F1A9D11CDf50041f3f8cB7191CBE2f31750ACC';
const GATEWAY = '0x0568130e794429D2eEBC4dafE18f25Ff1a1ed8b6';
const erc20 = parseAbi(['function approve(address,uint256) returns (bool)']);
const tx = (to, data, value = '0', from = OWNER) => ({ to, from, data, value, chainId: 84532, operation: 'SUPPLY' });
const supplyData = (asset, amount, onBehalf = OWNER) => encodeFunctionData({ abi: M.poolAbi, functionName: 'supply', args: [asset, amount, onBehalf, 0] });

test('accepts the real AaveKit native ETH supply response (Base Sepolia, captured 2026-11-03)', () => {
  // Verbatim from api.v3.aave.com supply(native: "0.0001").
  const live = tx(GATEWAY, '0x474cf53d000000000000000000000000e4c23309117aa30342bfaae6c95c6478e0a4ad000000000000000000000000007ece450c274672c8007372f81cfccc1c412466bb0000000000000000000000000000000000000000000000000000000000000000', '100000000000000');
  const call = M.verifyKitTx(live, { owner: OWNER, token: zeroAddress, aToken: AWETH, amount: 10n ** 14n, action: 'supply', deployment: D }, 'main');
  assert.equal(call.value, 10n ** 14n);
  // A different beneficiary or amount is rejected.
  assert.throws(() => M.verifyKitTx(live, { owner: OWNER, token: zeroAddress, aToken: AWETH, amount: 10n ** 15n, action: 'supply', deployment: D }, 'main'), /unexpected/);
  assert.throws(() => M.verifyKitTx({ ...live, from: USDC }, { owner: OWNER, token: zeroAddress, aToken: AWETH, amount: 10n ** 14n, action: 'supply', deployment: D }, 'main'), /unexpected/);
});

test('ERC-20 supply accepts exact approval + Pool.supply and rejects tampered calldata', () => {
  const ctx = { owner: OWNER, token: USDC, aToken: AUSDC, amount: 5_000_000n, action: 'supply', deployment: D };
  assert.ok(M.verifyKitTx(tx(USDC, encodeFunctionData({ abi: erc20, functionName: 'approve', args: [D.pool, 5_000_000n] })), ctx, 'approval'));
  assert.ok(M.verifyKitTx(tx(D.pool, supplyData(USDC, 5_000_000n)), ctx, 'main'));
  const rejects = [
    [tx(USDC, encodeFunctionData({ abi: erc20, functionName: 'approve', args: [D.pool, 2n ** 256n - 1n] })), 'approval'], // unlimited
    [tx(USDC, encodeFunctionData({ abi: erc20, functionName: 'approve', args: [OWNER, 5_000_000n] })), 'approval'],       // wrong spender
    [tx(D.pool, supplyData(USDC, 5_000_000n, USDC)), 'main'],                                                              // aTokens to someone else
    [tx(D.pool, supplyData(WETH, 5_000_000n)), 'main'],                                                                    // wrong asset
    [tx(USDC, supplyData(USDC, 5_000_000n)), 'main'],                                                                      // not the Pool
    [{ ...tx(D.pool, supplyData(USDC, 5_000_000n)), chainId: 1 }, 'main'],                                                // wrong chain
    [tx(D.pool, supplyData(USDC, 5_000_000n), '1'), 'main'],                                                               // unexpected value
  ];
  for (const [bad, step] of rejects) assert.throws(() => M.verifyKitTx(bad, ctx, step), /unexpected/);
});

test('native withdraw requires aWETH approval to the gateway and withdrawETH to the owner', () => {
  const ctx = { owner: OWNER, token: zeroAddress, aToken: AWETH, amount: 10n ** 14n, action: 'withdraw', deployment: D };
  assert.ok(M.verifyKitTx(tx(AWETH, encodeFunctionData({ abi: erc20, functionName: 'approve', args: [GATEWAY, 10n ** 14n] })), ctx, 'approval'));
  assert.ok(M.verifyKitTx(tx(GATEWAY, encodeFunctionData({ abi: M.gatewayAbi, functionName: 'withdrawETH', args: [D.pool, 10n ** 14n, OWNER] })), ctx, 'main'));
  assert.throws(() => M.verifyKitTx(tx(GATEWAY, encodeFunctionData({ abi: M.gatewayAbi, functionName: 'withdrawETH', args: [D.pool, 10n ** 14n, USDC] })), ctx, 'main'), /unexpected/);
});

test('API outages are AaveKitUnavailable (fallback allowed); user-input errors become friendly text', async () => {
  await assert.rejects(M.aaveKitQuery('{x}', {}, async () => { throw new TypeError('Failed to fetch'); }), (e) => e instanceof M.AaveKitUnavailable);
  await assert.rejects(M.aaveKitQuery('{x}', {}, async () => new Response('', { status: 503 })), (e) => e instanceof M.AaveKitUnavailable);
  const bad = async () => new Response(JSON.stringify({ data: null, errors: [{ message: 'Bad user input - Supply cap reached for reserve 0xba50 on market 0x8bAB' }] }));
  await assert.rejects(M.aaveKitQuery('{x}', {}, bad), (e) => !(e instanceof M.AaveKitUnavailable) && /remaining supply cap/.test(e.message) && !/0x/.test(e.message));
});
