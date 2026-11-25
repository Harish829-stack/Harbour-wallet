// QA: user-facing number/approval/display helpers and the smart-account guard, against independent oracles (viem, @ethereumjs, manual
// big-integer arithmetic). TEST_PLAN: T-UX-001, 010, 015, 019, 022, 023, 024, 025, 027, T-SA-005, 021, 022, 023, 029.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { decodeFunctionData, parseAbi, keccak256, getAddress } from 'viem';
import { RLP } from '@ethereumjs/rlp';
import { privateKeyToAccount, sign } from 'viem/accounts';
import { harness } from './harness.mjs';

const H = await harness(`
  export { isUnlimited, setApproveAmount, decodeCalldata, encodeApprove, MAX_UINT256 } from './core/provider/decode';
  export { toAtomic, fromAtomic } from './core/swap/amount';
  export { parseTokenAmount, formatTokenAmount } from './core/erc20';
  export { parseUnits as sendParse, formatUnits as sendFormat } from './core/chains/send/util';
  export { parseSolanaTx, decodeLifiCall, attachSolanaSignature } from './core/swap/safety';
  export { plainLabel, visibleText, hasHiddenChars } from './core/provider/displayText';
  export { buildQuote } from './core/gasFees';
  export { fmtAmount } from './popup/wallet/send/lib';
  export { checkIntent, delegationState, acceptGasPrice, acceptGasEstimate, acceptSponsorReply, padGasEstimate, assembleOp, checkFeeCap, maxTotalFee, GuardError } from './core/smartAccount/guard';
  export { LIMITS, limitsFor, DELEGATES, PAYMASTERS, SMART_ACCOUNT_CHAINS, MAX_CALLS, DELEGATION_MANAGER, ENTRYPOINT_V07 } from './core/smartAccount/constants';
  export { authorizationDigest, buildSignedType4 } from './core/smartAccount/delegation';
  export { buildCallsStatus, buildCapabilities, normalizeSendCalls } from './core/smartAccount/calls5792';
`);
const { M } = H;
const KEY = '0x' + '46'.repeat(32); const ME = privateKeyToAccount(KEY).address;
const u256 = fc.bigInt({ min: 0n, max: (1n << 256n) - 1n });
const addr = fc.uint8Array({ minLength: 20, maxLength: 20 }).map((b) => '0x' + Buffer.from(b).toString('hex'));

// ---------------------------------------------------------------- approvals (UX-01/02)

test('T-UX-001 / T-UX-022: isUnlimited boundary at 2^159 and monotonic in the value', () => {
  assert.equal(M.isUnlimited((1n << 159n) - 1n), false); assert.equal(M.isUnlimited(1n << 159n), true); assert.equal(M.isUnlimited(M.MAX_UINT256), true); assert.equal(M.isUnlimited(0n), false);
  fc.assert(fc.property(u256, u256, (a, b) => !(a <= b && M.isUnlimited(a)) || M.isUnlimited(b)), { numRuns: 3000, seed: 22 });
});

test('T-UX-023: setApproveAmount keeps selector and spender, writes exactly the new amount, refuses non-approve calldata', () => {
  const abi = parseAbi(['function approve(address spender, uint256 amount)']);
  fc.assert(fc.property(addr, u256, fc.bigInt({ min: 1n, max: (1n << 256n) - 1n }), (spender, old, neu) => {
    const data = M.encodeApprove(spender, old);
    const out = M.setApproveAmount(data, neu);
    assert.ok(out.startsWith('0x095ea7b3'));
    const d = decodeFunctionData({ abi, data: out });
    assert.equal(d.args[0].toLowerCase(), spender.toLowerCase()); assert.equal(d.args[1], neu);
    assert.equal(M.decodeCalldata(out).amount, neu);
  }), { numRuns: 800, seed: 23 });
  const transfer = '0xa9059cbb' + '00'.repeat(12) + '11'.repeat(20) + '00'.repeat(31) + '01';
  assert.equal(M.setApproveAmount(transfer, 5n), null);
  assert.equal(M.setApproveAmount(M.encodeApprove('0x' + '11'.repeat(20), 1n), 0n), null, 'zero refused');
  assert.equal(M.setApproveAmount(M.encodeApprove('0x' + '11'.repeat(20), 1n), M.MAX_UINT256 + 1n), null, 'overflow refused');
  assert.equal(M.setApproveAmount('0x095ea7b3', 5n), null, 'truncated calldata refused');
});

// ---------------------------------------------------------------- amounts (UX-06)

test('T-UX-010: every decimal ↔ atomic converter round-trips exactly for decimals 0..36 and rejects malformed input', () => {
  fc.assert(fc.property(fc.bigInt({ min: 0n, max: 10n ** 50n }), fc.integer({ min: 0, max: 36 }), (raw, d) => {
    const s = M.fromAtomic(raw, d);
    assert.equal(M.toAtomic(s, d), raw);
    assert.equal(M.sendParse(M.sendFormat(raw, d), d), raw);
    if (raw > 0n) assert.equal(M.parseTokenAmount(M.formatTokenAmount(raw, d), d), raw);
    assert.doesNotMatch(s, /e/i);
  }), { numRuns: 2000, seed: 10 });
  for (const bad of ['-1', '1e5', '1,5', 'abc', '.', '', ' ', '0x1', '١٢']) { assert.equal(M.toAtomic(bad, 18), null, bad); assert.throws(() => M.parseTokenAmount(bad, 18), bad); }
  assert.throws(() => M.parseTokenAmount('1.1234567', 6), /at most 6/); assert.throws(() => M.parseTokenAmount('0', 6), /valid amount/);
  assert.equal(M.toAtomic('1.1234567', 6), 1123456n, 'swap input truncates extra digits (documented)');
});

test('T-UX-027: confirm-screen amounts and fees are never shown smaller than what is signed (debits must not round down)', (t) => {
  // fmtAmount is what the send Confirm screen uses for the amount and the network fee (popup/wallet/send/confirm.tsx:56, parts.tsx:82/96).
  const cases = [[123456789n, 18, 8], [1n, 18, 8], [42_000_000_001n * 1000n, 18, 8], [1_000_000_009n, 9, 8]];
  const shownSmaller = [];
  for (const [raw, d, frac] of cases) {
    const shown = M.fmtAmount(raw, d, frac); const back = M.sendParse(shown, d);
    if (back < raw) shownSmaller.push(`${raw} (${d} dp) shown as "${shown}"`);
  }
  if (shownSmaller.length) return assert.fail('BUG-11 regression (fixed bug reproduces again): ' + `fmtAmount truncates: ${shownSmaller.join('; ')}`);
});

// ---------------------------------------------------------------- display integrity (UX-08)

test('T-UX-024 / T-UX-015: random unicode labels lose every hidden/bidi/control char and respect the max length; visibleText escapes them', () => {
  const hidden = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B\u200E\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uDB40[\uDC00-\uDC7F]/;
  const evil = fc.constantFrom('\u202E', '\u200B', '\u2066', '\u0000', '\u001B', '\uFEFF', '\u2028', '\uDB40\uDC41', '\u00AD');
  fc.assert(fc.property(fc.array(fc.oneof(fc.fullUnicodeString({ maxLength: 8 }), evil), { maxLength: 40 }).map((p) => p.join('')), fc.integer({ min: 1, max: 120 }), (s, max) => {
    const l = M.plainLabel(s, max);
    assert.ok(l.length <= max); assert.doesNotMatch(l, hidden); assert.doesNotMatch(l, /\s{2}|^\s|\s$/);
    const v = M.visibleText(s); assert.doesNotMatch(v, hidden); assert.equal(M.hasHiddenChars(v), false);
    if (M.hasHiddenChars(s)) assert.match(v, /\\u\{[0-9A-F]{4,5}\}/);
  }), { numRuns: 2000, seed: 24 });
  assert.equal(M.visibleText('paypal\u202Emoc.evil'), 'paypal\\u{202E}moc.evil');
});

// ---------------------------------------------------------------- swap safety parsers (UX-09)

test('T-UX-019: parseSolanaTx / decodeLifiCall never throw a TypeError on random input; attachSolanaSignature keeps the length', () => {
  fc.assert(fc.property(fc.uint8Array({ maxLength: 500 }), (b) => {
    let parsed; try { parsed = M.parseSolanaTx(b); } catch (e) { assert.ok(!(e instanceof TypeError) && !(e instanceof RangeError), `${e?.name}: ${e?.message}`); return; }
    const sig = new Uint8Array(64).fill(7);
    try { const out = M.attachSolanaSignature(b, parsed, sig); assert.equal(out.length, b.length); } catch (e) { assert.ok(!(e instanceof TypeError), e?.message); }
  }), { numRuns: 4000, seed: 19 });
  fc.assert(fc.property(fc.oneof(fc.uint8Array({ maxLength: 400 }).map((b) => '0x' + Buffer.from(b).toString('hex')), fc.string()), (h) => { const r = M.decodeLifiCall(h); assert.ok(r === null || typeof r === 'object'); }), { numRuns: 4000, seed: 191 });
});

// ---------------------------------------------------------------- gas tiers (UX-10)

test('T-UX-025: fee tiers from random fee history are monotonic and each max cost ≥ maxFeePerGas × 21000', () => {
  const row = fc.tuple(fc.bigInt({ min: 0n, max: 10n ** 11n }), fc.bigInt({ min: 0n, max: 10n ** 11n }), fc.bigInt({ min: 0n, max: 10n ** 11n })).map((r) => r.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  fc.assert(fc.property(fc.array(fc.bigInt({ min: 1n, max: 10n ** 12n }), { minLength: 1, maxLength: 10 }), fc.array(row, { minLength: 1, maxLength: 10 }), fc.bigInt({ min: 1n, max: 10n ** 12n }), (base, rewards, gasPrice) => {
    const hx = (v) => '0x' + v.toString(16);
    const q = M.buildQuote('ethereum', { gasPrice, feeHistory: { baseFeePerGas: base.map(hx), reward: rewards.map((r) => r.map(hx)) } });
    const max = q.tiers.map((x) => BigInt(x.maxFeePerGas));
    for (let i = 1; i < max.length; i++) assert.ok(max[i] >= max[i - 1], `tier ${q.tiers[i].id} ${max[i]} < ${q.tiers[i - 1].id} ${max[i - 1]}`);
    for (const x of q.tiers) { assert.ok(BigInt(x.costWei) >= BigInt(x.maxFeePerGas) * 21000n); assert.ok(BigInt(x.maxFeePerGas) >= base.at(-1)); }
  }), { numRuns: 1500, seed: 25 });
  const legacy = M.buildQuote('bsc', { gasPrice: 5n * 10n ** 9n });
  assert.equal(legacy.eip1559, false); assert.equal(legacy.tiers.length, 1); assert.equal(legacy.tiers[0].costWei, String(5n * 10n ** 9n * 21000n));
});

// ---------------------------------------------------------------- smart-account guard (SA-02..09)

test('T-SA-005: random bundler/paymaster gas replies: anything accepted is within LIMITS and the assembled op stays under the fee cap', () => {
  const q = fc.oneof(fc.bigInt({ min: 0n, max: 1n << 80n }).map((v) => '0x' + v.toString(16)), fc.constantFrom('0x', '0x00', '1', 12, null, '0x' + 'f'.repeat(70), '-0x1'));
  for (const chainId of M.SMART_ACCOUNT_CHAINS) {
    const L = M.limitsFor(chainId);
    fc.assert(fc.property(fc.record({ fast: fc.record({ maxFeePerGas: q, maxPriorityFeePerGas: q }) }), fc.record({ callGasLimit: q, verificationGasLimit: q, preVerificationGas: q }), (price, est) => {
      let p, g;
      try { p = M.acceptGasPrice(price, L); } catch (e) { assert.ok(e instanceof M.GuardError); return; }
      assert.ok(p.maxFeePerGas > 0n && p.maxFeePerGas <= L.maxFeePerGasWei && p.maxPriorityFeePerGas <= p.maxFeePerGas);
      try { g = M.padGasEstimate(M.acceptGasEstimate(est, L), L); } catch (e) { assert.ok(e instanceof M.GuardError); return; }
      assert.ok(g.callGasLimit <= L.maxCallGasLimit && g.verificationGasLimit <= L.maxVerificationGasLimit && g.preVerificationGas <= L.maxPreVerificationGas);
      let op; try { op = M.assembleOp({ sender: ME, nonce: 0n, callData: '0x', price: p, gas: g, signature: '0x', limits: L }); } catch (e) { assert.ok(e instanceof M.GuardError); return; }
      assert.ok(M.maxTotalFee(op) <= L.maxTotalFeeWei, 'assembled op is under the fee cap');
    }), { numRuns: 600, seed: 5 });
    assert.throws(() => M.acceptSponsorReply({ paymaster: '0x' + '12'.repeat(20), callGasLimit: '0x1', verificationGasLimit: '0x1', preVerificationGas: '0x1' }, chainId), M.GuardError, 'unpinned paymaster');
  }
  assert.equal(M.limitsFor(1).maxTotalFeeWei, 0n, 'an unlisted chain can never pass the fee cap');
});

test('T-SA-021: checkIntent fuzz: accepted ⇒ pinned chain, from == account, 1..16 calls, no protected or self target with data', () => {
  const protectedSet = new Set([M.DELEGATION_MANAGER.toLowerCase()]);
  const call = fc.record({ to: fc.oneof(addr, fc.constant(ME), fc.constant(M.DELEGATION_MANAGER), fc.constant(M.ENTRYPOINT_V07), fc.constant('nope')), value: fc.oneof(fc.constant('0x0'), fc.bigInt({ min: 0n, max: 10n ** 20n }).map((v) => '0x' + v.toString(16)), fc.constant(-1)), data: fc.oneof(fc.constant('0x'), fc.uint8Array({ maxLength: 40 }).map((b) => '0x' + Buffer.from(b).toString('hex')), fc.constant('zz')) }, { requiredKeys: ['to'] });
  fc.assert(fc.property(fc.oneof(fc.constantFrom(...M.SMART_ACCOUNT_CHAINS), fc.integer()), fc.oneof(fc.constant(ME), addr), fc.oneof(fc.array(call, { maxLength: 20 }), fc.jsonValue()), (chainId, from, calls) => {
    let out; try { out = M.checkIntent({ chainId, from, account: ME, calls }); } catch (e) { assert.ok(e instanceof M.GuardError, `${e?.name} ${e?.message}`); return; }
    assert.ok(M.SMART_ACCOUNT_CHAINS.includes(chainId)); assert.equal(from.toLowerCase(), ME.toLowerCase());
    assert.ok(out.length >= 1 && out.length <= M.MAX_CALLS);
    const delegate = M.DELEGATES[chainId].toLowerCase();
    for (const c of out) { const t = c.to.toLowerCase(); assert.ok(!protectedSet.has(t)); if ([ME.toLowerCase(), delegate, M.ENTRYPOINT_V07.toLowerCase()].includes(t)) assert.equal(c.data, '0x'); }
  }), { numRuns: 3000, seed: 21 });
});

test('T-SA-022: delegationState is total and says "pinned" only for exactly 0xef0100 ‖ pinned delegate', () => {
  for (const chainId of M.SMART_ACCOUNT_CHAINS) {
    const pinned = M.DELEGATES[chainId].toLowerCase().slice(2);
    assert.equal(M.delegationState('0xef0100' + pinned, chainId), 'pinned');
    assert.equal(M.delegationState('0xEF0100' + pinned.toUpperCase(), chainId), 'pinned', 'case-insensitive');
    for (const c of [null, undefined, '', '0x', '0x0']) assert.equal(M.delegationState(c, chainId), 'none');
    for (const c of ['0xef0100' + pinned + '00', '0xef0101' + pinned, '0xef0100' + 'ab'.repeat(20), '0x6080604052', 'ef0100' + pinned]) assert.equal(M.delegationState(c, chainId), 'other', c);
    fc.assert(fc.property(fc.oneof(fc.string(), fc.uint8Array({ maxLength: 40 }).map((b) => '0x' + Buffer.from(b).toString('hex'))), (c) => { const s = M.delegationState(c, chainId); assert.ok(['none', 'pinned', 'other'].includes(s)); if (s === 'pinned') assert.equal(c.toLowerCase(), '0xef0100' + pinned); }), { numRuns: 2000, seed: 222 });
  }
  assert.throws(() => M.delegationState('0x', 1), M.GuardError, 'unlisted chain');
});

test('T-SA-029: EIP-7702 authorization digest equals an independent RLP/keccak computation and the signed type-4 recovers to our account', async () => {
  await fc.assert(fc.asyncProperty(fc.constantFrom(...M.SMART_ACCOUNT_CHAINS), fc.integer({ min: 0, max: 2 ** 40 }), async (chainId, txNonce) => {
    const d = M.DELEGATES[chainId];
    // EIP-7702: keccak256(0x05 || rlp([chain_id, address, nonce])), computed here with @ethereumjs/rlp (independent of viem)
    const big = (n) => (n === 0 ? new Uint8Array() : Buffer.from(n.toString(16).padStart(Math.ceil(n.toString(16).length / 2) * 2, '0'), 'hex'));
    const expected = keccak256(Buffer.concat([Buffer.from([5]), RLP.encode([big(chainId), Buffer.from(d.slice(2), 'hex'), big(txNonce + 1)])]));
    assert.equal(M.authorizationDigest(d, chainId, txNonce + 1), expected);
    const sigs = []; const signer = (digest) => { const s = signSync(digest); sigs.push({ digest, ...s }); return s; };
    const out = M.buildSignedType4({ kind: 'upgrade', chainId, account: ME, txNonce, maxFeePerGas: 10n ** 9n, maxPriorityFeePerGas: 10n ** 8n }, signer);
    assert.equal(out.authorization.nonce, txNonce + 1, 'self-sent: authorization nonce = tx nonce + 1');
    assert.equal(out.authorization.contractAddress, d);
    const a = out.authorization;
    const authSig = sigs.find((x) => x.digest === expected); assert.ok(authSig, 'the authorization digest itself was signed');
    const sig = new secp256k1.Signature(BigInt(authSig.r), BigInt(authSig.s)).addRecoveryBit(authSig.yParity);
    const pub = sig.recoverPublicKey(expected.slice(2)).toRawBytes(false);
    assert.equal(getAddress('0x' + keccak256(pub.slice(1)).slice(-40)), ME);
  }), { numRuns: 30, seed: 29 });
  assert.throws(() => M.buildSignedType4({ kind: 'upgrade', chainId: 0, account: ME, txNonce: 0, maxFeePerGas: 1n, maxPriorityFeePerGas: 0n }, () => ({})), /Invalid chain/);
  assert.throws(() => M.buildSignedType4({ kind: 'upgrade', chainId: 1, account: ME, txNonce: 0, maxFeePerGas: 1n, maxPriorityFeePerGas: 0n }, () => ({})), /not available/);
});
// synchronous secp256k1 signer for buildSignedType4 (viem's sign is async; noble is sync)
import { secp256k1 } from '@noble/curves/secp256k1';
let lastSig;
function signSync(digest) {
  const s = secp256k1.sign(digest.slice(2), KEY.slice(2), { lowS: true });
  lastSig = { r: '0x' + s.r.toString(16).padStart(64, '0'), s: '0x' + s.s.toString(16).padStart(64, '0'), yParity: s.recovery };
  return lastSig;
}
void sign;

test('T-SA-023: EIP-5792 v2 shapes: capabilities per chain, calls status 100 / 200 / 600 with receipts only when provable', () => {
  const caps = M.buildCapabilities(undefined, 11155111, { 11155111: 'supported', 84532: 'unsupported' });
  for (const [k, v] of Object.entries(caps)) { assert.match(k, /^0x[0-9a-f]+$/); assert.ok(['supported', 'unsupported', 'ready'].includes(v.atomic?.status ?? v.atomic), JSON.stringify(v)); }
  const pending = M.buildCallsStatus({ id: 'b1', chainId: 11155111, state: 'pending' });
  assert.deepEqual(pending, { version: '2.0.0', id: 'b1', chainId: '0xaa36a7', atomic: true, status: 100 });
  const receipt = { transactionHash: '0x' + '11'.repeat(32), blockHash: '0x' + '22'.repeat(32), blockNumber: '0x10', gasUsed: '0x5208', logs: [] };
  const ok = M.buildCallsStatus({ id: 'b1', chainId: 11155111, state: 'done', success: true, receipt });
  assert.equal(ok.status, 200); assert.equal(ok.receipts.length, 1); assert.equal(ok.receipts[0].transactionHash, receipt.transactionHash);
  assert.equal(M.buildCallsStatus({ id: 'b1', chainId: 11155111, state: 'done', success: false, receipt }).status, 600);
  assert.equal(M.buildCallsStatus({ id: 'b1', chainId: 11155111, state: 'done', success: true, receipt: null }).status, 100, 'no receipt → still pending, never invented');
  assert.throws(() => M.normalizeSendCalls([{ version: '2.0.0', chainId: '0xaa36a7', from: ME, calls: Array(17).fill({ to: ME }) }], ME, 11155111));
});
