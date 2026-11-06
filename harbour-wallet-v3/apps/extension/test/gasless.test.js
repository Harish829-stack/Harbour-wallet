import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount, sign, serializeSignature } from 'viem/accounts';
import { recoverAddress } from 'viem';

// Gasless (EIP-7702 + ERC-4337 v0.8) flow with a fake bundler/chain: delegation guard, auth on first use only, op signature recovers to the EOA.
const out = await build({ entryPoints: [fileURLToPath(new URL('../src/core/swap/gasless.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const PK = '0x' + '11'.repeat(32); const EOA = privateKeyToAccount(PK).address;
const signDigest = async (hash) => { const s = await sign({ hash, privateKey: PK }); return { r: s.r, s: s.s, yParity: Number(s.yParity), serialized: serializeSignature(s) }; };
const pad32 = (a) => '0x' + '0'.repeat(24) + a.slice(2).toLowerCase();

function fakeDeps(code) {
  const log = []; let sent;
  const bundler = async (method, params) => {
    log.push(method);
    if (method === 'pimlico_getUserOperationGasPrice') return { fast: { maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x5f5e100' } };
    if (method === 'pm_sponsorUserOperation') return { paymaster: '0x' + '22'.repeat(20), paymasterData: '0xabcd', paymasterVerificationGasLimit: '0x10000', paymasterPostOpGasLimit: '0x1', callGasLimit: '0x30000', verificationGasLimit: '0x20000', preVerificationGas: '0xc350' };
    if (method === 'eth_sendUserOperation') { sent = params[0]; return '0x' + 'aa'.repeat(32); }
    if (method === 'eth_getUserOperationReceipt') return { success: true, receipt: { transactionHash: '0x' + 'bb'.repeat(32) } };
  };
  const call = async (to) => (to.toLowerCase() === M.SIMPLE_7702.toLowerCase() ? pad32(M.ENTRYPOINT_V08) : '0x' + '0'.repeat(63) + '5');
  return { deps: { chainId: 8453, sender: EOA, bundler, getCode: async () => code, call, txCount: async () => 7, signDigest, sleep: async () => {} }, log, sent: () => sent };
}
const calls = [{ to: '0x' + '33'.repeat(20), value: 0n, data: '0x1234' }, { to: '0x' + '44'.repeat(20), value: 5n, data: '0x' }];

test('first gasless op authorises the pinned delegate, batches calls, and signs a hash that recovers to the EOA', async () => {
  const f = fakeDeps('0x');
  const r = await M.sendGasless(f.deps, calls);
  assert.equal(r.txHash, '0x' + 'bb'.repeat(32));
  assert.deepEqual(f.log, ['pimlico_getUserOperationGasPrice', 'pm_sponsorUserOperation', 'eth_sendUserOperation', 'eth_getUserOperationReceipt']);
  const op = f.sent();
  assert.equal(op.factory, '0x7702'); assert.equal(op.eip7702Auth.address, M.SIMPLE_7702); assert.equal(op.eip7702Auth.nonce, '0x7');
  assert.ok(op.callData.startsWith('0x34fcd5be')); // executeBatch((address,uint256,bytes)[])
  const auth = await recoverAddress({ hash: M.authorizationDigest(8453, 7), signature: { r: op.eip7702Auth.r, s: op.eip7702Auth.s, yParity: Number(op.eip7702Auth.yParity) } });
  assert.equal(auth, EOA);
  const unpacked = { sender: op.sender, nonce: BigInt(op.nonce), factory: op.factory, factoryData: op.factoryData, callData: op.callData, callGasLimit: BigInt(op.callGasLimit), verificationGasLimit: BigInt(op.verificationGasLimit), preVerificationGas: BigInt(op.preVerificationGas), maxFeePerGas: BigInt(op.maxFeePerGas), maxPriorityFeePerGas: BigInt(op.maxPriorityFeePerGas), paymaster: op.paymaster, paymasterVerificationGasLimit: BigInt(op.paymasterVerificationGasLimit), paymasterPostOpGasLimit: BigInt(op.paymasterPostOpGasLimit), paymasterData: op.paymasterData, signature: op.signature };
  assert.equal(await recoverAddress({ hash: M.userOpHash(unpacked, 8453), signature: op.signature }), EOA);
});

test('already-delegated accounts skip the authorisation; foreign delegations and contracts are refused', async () => {
  const ok = fakeDeps('0xef0100' + M.SIMPLE_7702.slice(2).toLowerCase());
  await M.sendGasless(ok.deps, [calls[0]]);
  assert.equal(ok.sent().eip7702Auth, undefined); assert.equal(ok.sent().factory, undefined);
  assert.ok(ok.sent().callData.startsWith('0xb61d27f6')); // execute(address,uint256,bytes)
  await assert.rejects(M.sendGasless(fakeDeps('0xef0100' + '99'.repeat(20)).deps, calls), (e) => e.code === 'gasless_unavailable');
  await assert.rejects(M.sendGasless(fakeDeps('0x6080604052').deps, calls), (e) => e.code === 'gasless_unavailable');
  assert.equal(M.delegationOf('0x'), ''); assert.equal(M.delegationOf('0xEF0100' + 'AB'.repeat(20)), '0x' + 'ab'.repeat(20)); assert.equal(M.delegationOf('0x60'), null);
});
