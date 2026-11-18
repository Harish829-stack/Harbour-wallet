// sendOperation (src/core/smartAccount/send.ts): Flow B end to end with a fake bundler. The signed digest is the one computed from the
// FINAL operation sent, a hostile or odd provider reply signs nothing, sponsorship refusal is a distinct code, and a revert/pending
// operation is reported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { recoverAddress, hexToBytes, hashTypedData, concat, pad, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/constants'; export * from './core/smartAccount/userOp'; export * from './core/smartAccount/guard'; export * from './core/smartAccount/send'; export * from './core/smartAccount/kit'; export * from './core/smartAccount/abi';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
void readFileSync; void hexToBytes;

const CHAIN = 84532, PM = '0x777777777777AeC03fd955926DbF81597e66834C', SINK = '0x000000000000000000000000000000000000dEaD';
const KEY = '0x' + '11'.repeat(32); const ACCT = privateKeyToAccount(KEY).address;
const DELEG_CODE = '0xef0100' + M.DELEGATES[CHAIN].slice(2);
const goodSponsor = { paymaster: PM, paymasterData: '0xabcd', paymasterVerificationGasLimit: '0x7cb3', paymasterPostOpGasLimit: '0x1', callGasLimit: '0x4623', verificationGasLimit: '0x7cb3', preVerificationGas: '0xc479' };
const TX = '0x' + 'ab'.repeat(32);
const signOp = (op) => M.signUserOp(op, CHAIN, privateKeyToAccount(KEY));
// Independent oracle (test only): the delegate's EIP-712 PackedUserOperation digest, written out here so the kit is checked against it.
const p16 = (n) => pad(toHex(n), { size: 16 });
const oracleDigest = (op, chainId) => hashTypedData({
  domain: { name: 'EIP7702StatelessDeleGator', version: '1', chainId, verifyingContract: op.sender },
  types: { PackedUserOperation: [{ name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' }, { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' }, { name: 'gasFees', type: 'bytes32' }, { name: 'paymasterAndData', type: 'bytes' }, { name: 'entryPoint', type: 'address' }] },
  primaryType: 'PackedUserOperation',
  message: { sender: op.sender, nonce: op.nonce, initCode: '0x', callData: op.callData, accountGasLimits: concat([p16(op.verificationGasLimit), p16(op.callGasLimit)]), preVerificationGas: op.preVerificationGas, gasFees: concat([p16(op.maxPriorityFeePerGas), p16(op.maxFeePerGas)]), paymasterAndData: op.paymaster ? concat([op.paymaster, p16(op.paymasterVerificationGasLimit), p16(op.paymasterPostOpGasLimit), op.paymasterData]) : '0x', entryPoint: M.ENTRYPOINT_V07 },
});

// viem's sign is async in some versions; use the sync secp256k1 path via noble to stay synchronous
import { secp256k1 } from '@noble/curves/secp256k1';
const syncSign = (h) => { const s = secp256k1.sign(h.slice(2), KEY.slice(2)); return '0x' + s.r.toString(16).padStart(64, '0') + s.s.toString(16).padStart(64, '0') + (s.recovery ? '1c' : '1b'); };

function rig(over = {}) {
  const calls = []; const signed = [];
  const d = {
    chainId: CHAIN, account: ACCT, getCode: async () => DELEG_CODE, readNonce: async () => 7n,
    bundler: async (method, params) => {
      calls.push([method, params]);
      if (over[method]) return over[method](params);
      if (method === 'pimlico_getUserOperationGasPrice') return { fast: { maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x3b9aca' } };
      if (method === 'pm_sponsorUserOperation') return goodSponsor;
      if (method === 'eth_estimateUserOperationGas') return { callGasLimit: '0x4623', verificationGasLimit: '0x7cb3', preVerificationGas: '0xc479' };
      if (method === 'eth_sendUserOperation') return '0x' + 'cd'.repeat(32);
      if (method === 'eth_getUserOperationReceipt') return { success: true, receipt: { transactionHash: TX } };
      throw new Error('unexpected ' + method);
    },
    signUserOp: signOp,
    sleep: async () => {},
  };
  return { d, calls, signed };
}
const input = { calls: [{ to: SINK, value: '0x5', data: '0x' }], sponsor: true };
const refused = (p, reason) => assert.rejects(p, (e) => e instanceof M.GuardError && e.message === M.GUARD_MESSAGE && (!reason || e.reason === reason));

test('sponsored: builds locally, signs the final op, sends it, returns the tx hash', async () => {
  const { d, calls, signed } = rig(); d.signUserOp = (o) => { signed.push(o); return signOp(o); };
  const r = await M.sendOperation(d, input);
  assert.equal(r.txHash, TX); assert.equal(r.sponsored, true);
  const sent = calls.find((c) => c[0] === 'eth_sendUserOperation')[1][0];
  assert.equal(sent.sender, ACCT); assert.equal(sent.nonce, '0x7'); assert.equal(sent.paymaster, PM);
  assert.equal(signed.length, 1, 'exactly one signature');
  // the signed digest equals the digest recomputed from what was sent
  const op = { sender: sent.sender, nonce: BigInt(sent.nonce), callData: sent.callData, callGasLimit: BigInt(sent.callGasLimit), verificationGasLimit: BigInt(sent.verificationGasLimit), preVerificationGas: BigInt(sent.preVerificationGas), maxFeePerGas: BigInt(sent.maxFeePerGas), maxPriorityFeePerGas: BigInt(sent.maxPriorityFeePerGas), paymaster: sent.paymaster, paymasterVerificationGasLimit: BigInt(sent.paymasterVerificationGasLimit), paymasterPostOpGasLimit: BigInt(sent.paymasterPostOpGasLimit), paymasterData: sent.paymasterData };
  assert.equal(signed[0].callData, sent.callData); assert.equal(signed[0].nonce, op.nonce); assert.equal(signed[0].paymasterData, op.paymasterData);
  assert.equal(await recoverAddress({ hash: oracleDigest(op, CHAIN), signature: sent.signature }), ACCT, 'kit signature verifies against an independent digest of the op that was sent');
  assert.equal(sent.callData, M.encodeCalls(M.checkIntent({ chainId: CHAIN, from: ACCT, account: ACCT, calls: input.calls })), 'callData is built locally');
});
test('user-paid: estimates gas, no paymaster', async () => {
  const { d, calls } = rig(); d.signUserOp = signOp;
  const r = await M.sendOperation(d, { ...input, sponsor: false });
  assert.equal(r.sponsored, false); assert.ok(r.maxFeeWei > 0n);
  assert.ok(calls.some((c) => c[0] === 'eth_estimateUserOperationGas')); assert.ok(!calls.some((c) => c[0] === 'pm_sponsorUserOperation'));
  assert.equal(calls.find((c) => c[0] === 'eth_sendUserOperation')[1][0].paymaster, undefined);
});
test('user-paid ops carry padded gas limits; sponsored ops keep the paymaster-signed limits', async () => {
  const paid = rig(); paid.d.signUserOp = signOp;
  await M.sendOperation(paid.d, { ...input, sponsor: false });
  const p = paid.calls.find((c) => c[0] === 'eth_sendUserOperation')[1][0];
  assert.equal(BigInt(p.callGasLimit), (0x4623n * 125n + 99n) / 100n); assert.equal(BigInt(p.verificationGasLimit), (0x7cb3n * 125n + 99n) / 100n); assert.equal(BigInt(p.preVerificationGas), (0xc479n * 110n + 99n) / 100n);
  const sp = rig(); sp.d.signUserOp = signOp;
  await M.sendOperation(sp.d, input);
  const q = sp.calls.find((c) => c[0] === 'eth_sendUserOperation')[1][0];
  assert.equal(BigInt(q.callGasLimit), 0x4623n, 'the paymaster signature covers these numbers, so they are not changed');
});
test('a paymaster outside the allow-list signs nothing', async () => {
  const { d, signed } = rig({ pm_sponsorUserOperation: () => ({ ...goodSponsor, paymaster: '0x' + '22'.repeat(20) }) }); d.signUserOp = (o) => { signed.push(o); return signOp(o); };
  await refused(M.sendOperation(d, input), 'paymaster'); assert.equal(signed.length, 0);
});
test('a provider reply cannot change callData: extra fields are ignored', async () => {
  const { d, calls } = rig({ pm_sponsorUserOperation: () => ({ ...goodSponsor, callData: '0xdeadbeef', sender: '0x' + '33'.repeat(20), nonce: '0x99' }) }); d.signUserOp = signOp;
  await M.sendOperation(d, input);
  const sent = calls.find((c) => c[0] === 'eth_sendUserOperation')[1][0];
  assert.notEqual(sent.callData, '0xdeadbeef'); assert.equal(sent.sender, ACCT); assert.equal(sent.nonce, '0x7');
});
test('sponsorship refused is reported with its own code and signs nothing', async () => {
  const { d, signed } = rig({ pm_sponsorUserOperation: () => { throw new Error('sponsorshipPolicy perUserMaximumOpCount reached'); } }); d.signUserOp = (o) => { signed.push(o); return signOp(o); };
  await assert.rejects(M.sendOperation(d, input), (e) => e.code === 'sponsor_refused'); assert.equal(signed.length, 0);
});
test('not enabled, foreign delegate, bad intent and a fee over the cap are refused before any signature', async () => {
  for (const [code, reason] of [['0x', 'not_enabled'], ['0xef0100' + '44'.repeat(20), 'foreign_delegate']]) {
    const { d, signed } = rig(); d.getCode = async () => code; d.signUserOp = (o) => { signed.push(o); return signOp(o); };
    await refused(M.sendOperation(d, input), reason); assert.equal(signed.length, 0);
  }
  const a = rig(); await refused(M.sendOperation(a.d, { ...input, calls: [{ to: ACCT, data: '0x12345678' }] }), 'self_call');
  const b = rig({ pimlico_getUserOperationGasPrice: () => ({ fast: { maxFeePerGas: '0x174876e800', maxPriorityFeePerGas: '0x1' } }) }); b.d.signUserOp = signOp;
  const c = rig({ pm_sponsorUserOperation: () => ({ ...goodSponsor, callGasLimit: '0x1c9c380', verificationGasLimit: '0x1c9c380' }) }); c.d.signUserOp = signOp;
  await assert.rejects(M.sendOperation(c.d, input), (e) => e instanceof M.GuardError);
});
test('reverted and pending operations are reported', async () => {
  const r = rig({ eth_getUserOperationReceipt: () => ({ success: false, receipt: { transactionHash: TX } }) }); r.d.signUserOp = signOp;
  await assert.rejects(M.sendOperation(r.d, input), (e) => e.code === 'op_reverted');
  const p = rig({ eth_getUserOperationReceipt: () => null }); p.d.signUserOp = signOp;
  await assert.rejects(M.sendOperation(p.d, input, 1), (e) => e.code === 'op_pending' && /^0x[0-9a-f]{64}$/.test(e.userOpHash));
});
