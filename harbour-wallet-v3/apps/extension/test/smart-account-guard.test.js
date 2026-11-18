// Smart accounts guard (src/core/smartAccount/guard.ts): every check in documentation/smart-accounts/02 fails closed, and a provider
// reply can only supply the few numbers the guard reads. Pure code, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/constants'; export * from './core/smartAccount/abi'; export * from './core/smartAccount/userOp'; export * from './core/smartAccount/guard';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const v = JSON.parse(readFileSync(new URL('./fixtures/aa/vectors.json', import.meta.url), 'utf8'));

const CHAIN = 84532, ACCT = v.account, PM = '0x777777777777AeC03fd955926DbF81597e66834C', SINK = '0x000000000000000000000000000000000000dEaD';
const call = { to: SINK, value: '0x5', data: '0x' };
const refuses = (fn, reason) => assert.throws(fn, (e) => e instanceof M.GuardError && e.code === 'guard_failed' && e.message === M.GUARD_MESSAGE && (!reason || e.reason === reason), reason ?? 'GuardError');
const goodSponsor = { paymaster: PM, paymasterData: '0xabcd', paymasterVerificationGasLimit: '0x7cb3', paymasterPostOpGasLimit: '0x1', callGasLimit: '0x4623', verificationGasLimit: '0x7cb3', preVerificationGas: '0xc479' };

test('intent: accepts the user\'s own account on a pinned chain and normalizes calls', () => {
  const c = M.checkIntent({ chainId: CHAIN, from: ACCT.toLowerCase(), account: ACCT, calls: [call, { to: SINK, value: 0, data: '0xa9059cbb' }] });
  assert.equal(c.length, 2); assert.equal(c[0].value, 5n); assert.equal(c[0].to, SINK);
});
test('intent: wrong sender, unpinned chain, chain 0, too many or zero calls, malformed call are refused', () => {
  const ok = { chainId: CHAIN, from: ACCT, account: ACCT, calls: [call] };
  refuses(() => M.checkIntent({ ...ok, from: '0x' + '11'.repeat(20) }), 'from');
  refuses(() => M.checkIntent({ ...ok, from: 'nope' }), 'from');
  refuses(() => M.checkIntent({ ...ok, chainId: 1 }), 'chain');
  refuses(() => M.checkIntent({ ...ok, chainId: 0 }), 'chain');
  refuses(() => M.checkIntent({ ...ok, calls: [] }), 'calls');
  refuses(() => M.checkIntent({ ...ok, calls: Array(17).fill(call) }), 'calls');
  refuses(() => M.checkIntent({ ...ok, calls: 'x' }), 'calls');
  refuses(() => M.checkIntent({ ...ok, calls: [{ to: 'nope' }] }), 'call_shape');
  refuses(() => M.checkIntent({ ...ok, calls: [{ to: SINK, data: '0xabc' }] }), 'call_shape');
});
test('S7: calls to the account itself, the delegate or the EntryPoint with data are refused; plain value to the account is allowed', () => {
  const ok = { chainId: CHAIN, from: ACCT, account: ACCT };
  for (const to of [ACCT, M.DELEGATES[CHAIN], M.ENTRYPOINT_V07]) refuses(() => M.checkIntent({ ...ok, calls: [{ to, data: '0x12345678' }] }), 'self_call');
  assert.equal(M.checkIntent({ ...ok, calls: [{ to: ACCT, value: 1 }] }).length, 1);
});
test('delegation state: none, pinned, other; operations need the pinned delegate', () => {
  const pinned = '0xef0100' + M.DELEGATES[CHAIN].slice(2);
  assert.equal(M.delegationState('0x', CHAIN), 'none'); assert.equal(M.delegationState(undefined, CHAIN), 'none');
  assert.equal(M.delegationState(pinned.toUpperCase().replace('0X', '0x'), CHAIN), 'pinned');
  assert.equal(M.delegationState('0xef0100' + '22'.repeat(20), CHAIN), 'other'); // foreign delegate
  assert.equal(M.delegationState('0x6080604052', CHAIN), 'other'); // real contract code
  refuses(() => M.delegationState('0x', 1), 'chain');
  assert.doesNotThrow(() => M.requirePinnedDelegation(pinned, CHAIN));
  refuses(() => M.requirePinnedDelegation('0x', CHAIN), 'not_enabled');
  refuses(() => M.requirePinnedDelegation('0xef0100' + '22'.repeat(20), CHAIN), 'foreign_delegate');
});
test('sponsor reply: pinned paymaster accepted, unknown paymaster refused', () => {
  const r = M.acceptSponsorReply(goodSponsor, CHAIN);
  assert.equal(r.paymaster, PM); assert.equal(r.paymasterData, '0xabcd'); assert.equal(r.callGasLimit, 0x4623n); assert.equal(r.paymasterPostOpGasLimit, 1n);
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, paymaster: '0x' + '22'.repeat(20) }, CHAIN), 'paymaster');
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, paymaster: undefined }, CHAIN), 'paymaster');
  refuses(() => M.acceptSponsorReply(goodSponsor, 1), 'paymaster'); // chain with no pins
  refuses(() => M.acceptSponsorReply(null, CHAIN), 'sponsor_shape');
  refuses(() => M.acceptSponsorReply([goodSponsor], CHAIN), 'sponsor_shape');
});
test('provider replies: extra fields are ignored and cannot change the operation', () => {
  const evil = { ...goodSponsor, sender: '0x' + '99'.repeat(20), nonce: '0x63', callData: '0xdeadbeef', initCode: '0xbad', entryPoint: '0x' + '55'.repeat(20), factory: '0x' + '66'.repeat(20), signature: '0x01', maxFeePerGas: '0xffffffffffff' };
  const r = M.acceptSponsorReply(evil, CHAIN);
  assert.deepEqual(Object.keys(r).sort(), ['callGasLimit', 'paymaster', 'paymasterData', 'paymasterPostOpGasLimit', 'paymasterVerificationGasLimit', 'preVerificationGas', 'verificationGasLimit']);
  const g = M.acceptGasEstimate({ callGasLimit: '0x10', verificationGasLimit: '0x20', preVerificationGas: '0x30', callData: '0xdead', sender: '0x1' });
  assert.deepEqual(Object.keys(g).sort(), ['callGasLimit', 'preVerificationGas', 'verificationGasLimit']);
  const p = M.acceptGasPrice({ fast: { maxFeePerGas: '0x10', maxPriorityFeePerGas: '0x1', extra: 'x' }, slow: { maxFeePerGas: '0xffffffffffffffff' } });
  assert.deepEqual({ ...p }, { maxFeePerGas: 16n, maxPriorityFeePerGas: 1n });
  const op = M.assembleOp({ sender: ACCT, nonce: 7n, callData: '0x1234', price: p, gas: g, sponsor: r, signature: '0x' });
  assert.equal(op.sender, ACCT); assert.equal(op.nonce, 7n); assert.equal(op.callData, '0x1234'); assert.equal(op.factory, undefined);
});
test('gas limits, fee and nonce over the bounds are refused', () => {
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, callGasLimit: '0x' + (6_000_000).toString(16) }, CHAIN), 'call_gas');
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, verificationGasLimit: '0x' + (3_000_000).toString(16) }, CHAIN), 'verification_gas');
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, preVerificationGas: '0x' + (2_000_000).toString(16) }, CHAIN), 'pre_verification_gas');
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, paymasterPostOpGasLimit: '0x' + (2_000_000).toString(16) }, CHAIN), 'pm_post_op_gas');
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, callGasLimit: '0x0' }, CHAIN), 'call_gas');
  for (const bad of ['10', 'zz', '0x', '0x01', 5, null, '0x' + 'f'.repeat(70)]) refuses(() => M.acceptSponsorReply({ ...goodSponsor, callGasLimit: bad }, CHAIN), 'call_gas');
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, paymasterData: '0xabc' }, CHAIN), 'paymaster_data');
  refuses(() => M.acceptSponsorReply({ ...goodSponsor, paymasterData: '0x' + 'ab'.repeat(300) }, CHAIN), 'paymaster_data');
  refuses(() => M.acceptGasPrice({ fast: { maxFeePerGas: '0x0', maxPriorityFeePerGas: '0x0' } }), 'fee_per_gas');
  refuses(() => M.acceptGasPrice({ fast: { maxFeePerGas: '0x' + (2n * 10n ** 12n).toString(16), maxPriorityFeePerGas: '0x1' } }), 'fee_per_gas');
  refuses(() => M.acceptGasPrice({ fast: { maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x2' } }), 'priority_over_max');
  refuses(() => M.acceptGasPrice({}), 'price_shape');
  const gas = { callGasLimit: 1n, verificationGasLimit: 1n, preVerificationGas: 1n };
  refuses(() => M.assembleOp({ sender: ACCT, nonce: -1n, callData: '0x', price: { maxFeePerGas: 1n, maxPriorityFeePerGas: 0n }, gas, signature: '0x' }), 'nonce');
  refuses(() => M.assembleOp({ sender: ACCT, nonce: 1, callData: '0x', price: { maxFeePerGas: 1n, maxPriorityFeePerGas: 0n }, gas, signature: '0x' }), 'nonce');
  // each limit is within its bound but together they exceed the fee cap (0.01 ETH): 3.4M gas x 1000 gwei = 0.0034 ETH is fine, so push the price up
  const big = { callGasLimit: 5_000_000n, verificationGasLimit: 2_000_000n, preVerificationGas: 1_000_000n };
  refuses(() => M.assembleOp({ sender: ACCT, nonce: 1n, callData: '0x', price: { maxFeePerGas: 10n ** 12n, maxPriorityFeePerGas: 0n }, gas: big, signature: '0x' }), 'fee_cap');
  assert.equal(M.assembleOp({ sender: ACCT, nonce: 1n, callData: '0x', price: { maxFeePerGas: 10n ** 9n, maxPriorityFeePerGas: 0n }, gas: big, signature: '0x' }).maxFeePerGas, 10n ** 9n);
});
test('authorization: wrong chain (including 0), wrong nonce and foreign target are refused', () => {
  const up = { contractAddress: M.DELEGATES[CHAIN], chainId: CHAIN, nonce: 5 };
  const e = { kind: 'upgrade', chainId: CHAIN, txNonce: 4 };
  assert.doesNotThrow(() => M.checkAuthorization(up, e));
  assert.doesNotThrow(() => M.checkAuthorization({ contractAddress: M.ZERO_ADDRESS, chainId: CHAIN, nonce: 5 }, { ...e, kind: 'revoke' }));
  refuses(() => M.checkAuthorization({ ...up, chainId: 0 }, { ...e }), 'auth_chain');
  refuses(() => M.checkAuthorization({ ...up, chainId: 11155111 }, e), 'auth_chain');
  refuses(() => M.checkAuthorization({ ...up, nonce: 4 }, e), 'auth_nonce');
  refuses(() => M.checkAuthorization({ ...up, nonce: 6 }, e), 'auth_nonce');
  refuses(() => M.checkAuthorization({ ...up, contractAddress: '0x' + '22'.repeat(20) }, e), 'auth_target');
  refuses(() => M.checkAuthorization({ ...up, contractAddress: M.ZERO_ADDRESS }, e), 'auth_target'); // revoke target on an upgrade
  refuses(() => M.checkAuthorization({ ...up }, { ...e, kind: 'revoke' }), 'auth_target'); // delegate on a revoke
});
test('freshness: a prepared operation expires after 2 minutes and cannot be from the future', () => {
  const t = 1_000_000;
  assert.doesNotThrow(() => M.assertFresh(t, t + 119_000));
  refuses(() => M.assertFresh(t, t + 121_000), 'expired');
  refuses(() => M.assertFresh(t, t - 1), 'expired');
  refuses(() => M.assertFresh(NaN, t), 'expired');
});
test('max fee is every gas limit x maxFeePerGas, including the paymaster limits', () => {
  const op = { callGasLimit: 10n, verificationGasLimit: 20n, preVerificationGas: 30n, maxFeePerGas: 2n, paymasterVerificationGasLimit: 4n, paymasterPostOpGasLimit: 6n };
  assert.equal(M.maxTotalFee(op), 140n);
  assert.equal(M.maxTotalFee({ ...op, paymasterVerificationGasLimit: undefined, paymasterPostOpGasLimit: undefined }), 120n);
});

test('padGasEstimate: +25% call/verification, +10% pre-verification, rounded up, never above the hard caps', () => {
  const g = M.padGasEstimate({ callGasLimit: 34068n, verificationGasLimit: 209902n, preVerificationGas: 150630n });
  assert.equal(g.callGasLimit, 42585n); assert.equal(g.verificationGasLimit, 262378n); assert.equal(g.preVerificationGas, 165693n);
  const tiny = M.padGasEstimate({ callGasLimit: 1n, verificationGasLimit: 1n, preVerificationGas: 1n });
  assert.ok(tiny.callGasLimit >= 2n && tiny.verificationGasLimit >= 2n && tiny.preVerificationGas >= 2n, 'never rounds down below the estimate');
  const cap = M.padGasEstimate({ callGasLimit: M.LIMITS.maxCallGasLimit, verificationGasLimit: M.LIMITS.maxVerificationGasLimit, preVerificationGas: M.LIMITS.maxPreVerificationGas });
  assert.equal(cap.callGasLimit, M.LIMITS.maxCallGasLimit); assert.equal(cap.verificationGasLimit, M.LIMITS.maxVerificationGasLimit); assert.equal(cap.preVerificationGas, M.LIMITS.maxPreVerificationGas);
  assert.deepEqual(Object.keys(g).sort(), ['callGasLimit', 'preVerificationGas', 'verificationGasLimit']);
});

test('every smart account chain has its own explicit limits entry; an unlisted chain can never pass the fee cap', () => {
  for (const id of Object.keys(M.DELEGATES)) assert.ok(Object.prototype.hasOwnProperty.call(M.CHAIN_LIMITS, id), `chain ${id} needs an explicit CHAIN_LIMITS entry`);
  assert.equal(M.limitsFor(999999).maxTotalFeeWei, 0n);
  const tight = { ...M.LIMITS, maxFeePerGasWei: 10n, maxTotalFeeWei: 1_000n };
  assert.throws(() => M.acceptGasPrice({ fast: { maxFeePerGas: '0xb', maxPriorityFeePerGas: '0x1' } }, tight), (e) => e.reason === 'fee_per_gas');
  assert.deepEqual(M.acceptGasPrice({ fast: { maxFeePerGas: '0xa', maxPriorityFeePerGas: '0x1' } }, tight), { maxFeePerGas: 10n, maxPriorityFeePerGas: 1n });
  assert.throws(() => M.acceptGasEstimate({ callGasLimit: '0x4623', verificationGasLimit: '0x7cb3', preVerificationGas: '0xc479' }, { ...M.LIMITS, maxCallGasLimit: 100n }), (e) => e.reason === 'call_gas');
});

test('red-team finding 2: a dApp batch may not call the permission contracts (DelegationManager or any enforcer), with or without data', () => {
  const ok = { chainId: CHAIN, from: ACCT, account: ACCT, calls: [] };
  for (const to of [M.DELEGATION_MANAGER, ...Object.values(M.ENFORCERS)]) {
    for (const data of ['0x', '0x12345678']) refuses(() => M.checkIntent({ ...ok, calls: [{ to, value: 0, data }] }), 'protocol_call');
    refuses(() => M.checkIntent({ ...ok, calls: [{ to: to.toLowerCase(), value: 0, data: '0x12345678' }] }), 'protocol_call');
  }
  assert.equal(M.checkIntent({ ...ok, calls: [{ to: SINK, value: 0, data: '0x12345678' }] }).length, 1); // an ordinary contract is still fine
});
