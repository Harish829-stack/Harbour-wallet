// Local checks that run BEFORE any signature (documentation/smart-accounts/02). Pure: no I/O, no keys.
// Harbour builds the operation itself, so there is no third-party payload to "verify". This file checks the few fields a third
// party can still influence (paymaster and gas numbers, the on-chain delegation state) and refuses anything unexpected. Every
// failure is a GuardError: the worker signs nothing and shows GUARD_MESSAGE.
import { getAddress, isAddress, isHex, type Hex } from 'viem';
import { delegationTarget } from '../evmCode';
import { DELEGATES, ENTRYPOINT_V07, LIMITS, MAX_CALLS, PREPARED_TTL_MS, ZERO_ADDRESS, isPinnedPaymaster, type Address } from './constants';
import { normalizeCall, type Call } from './abi';
import type { UserOp } from './userOp';

export const GUARD_MESSAGE = "Harbour couldn't verify this request, so nothing was signed.";
export class GuardError extends Error {
  readonly code = 'guard_failed';
  /** Short machine reason for the security log (never an address or amount). */
  constructor(readonly reason: string) { super(GUARD_MESSAGE); }
}
const fail = (reason: string): never => { throw new GuardError(reason); };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 1. Intent: allowed chain, `from` is the user's own account on that chain, 1..16 normalized calls, none aimed at the account's own setup. */
export function checkIntent(i: { chainId: number; from: string; account: string; calls: unknown }): Call[] {
  if (!DELEGATES[i.chainId]) fail('chain');
  if (typeof i.from !== 'string' || typeof i.account !== 'string' || !isAddress(i.from, { strict: false }) || !same(i.from, i.account)) fail('from');
  if (!Array.isArray(i.calls) || i.calls.length < 1 || i.calls.length > MAX_CALLS) fail('calls');
  let calls: Call[];
  try { calls = (i.calls as any[]).map(normalizeCall); } catch { return fail('call_shape'); }
  const delegate = DELEGATES[i.chainId];
  for (const c of calls) {
    // S7: a normal operation may not call the account itself, the delegate or the EntryPoint with data (setup / re-entry paths).
    const target = c.to.toLowerCase();
    if ((target === i.account.toLowerCase() || target === delegate || target === ENTRYPOINT_V07.toLowerCase()) && c.data !== '0x') fail('self_call');
  }
  return calls;
}

/** 2. Delegation state from eth_getCode: 'none' (plain account), 'pinned' (our delegate) or 'other' (anything else). */
export type DelegationState = 'none' | 'pinned' | 'other';
export function delegationState(code: string | null | undefined, chainId: number): DelegationState {
  const pinned = DELEGATES[chainId]; if (!pinned) return fail('chain');
  const c = (code ?? '').toLowerCase();
  if (c === '' || c === '0x' || c === '0x0') return 'none';
  const t = delegationTarget(c);
  if (t && t === pinned) return 'pinned';
  return 'other';
}
/** Smart operations need the pinned delegate; anything else stops with a reason the UI can turn into Enable or Revoke. */
export function requirePinnedDelegation(code: string | null | undefined, chainId: number): void {
  const s = delegationState(code, chainId);
  if (s !== 'pinned') fail(s === 'none' ? 'not_enabled' : 'foreign_delegate');
}

const QTY = /^0x(0|[1-9a-fA-F][0-9a-fA-F]*)$/;
function qty(v: unknown, max: bigint, reason: string, { allowZero = true }: { allowZero?: boolean } = {}): bigint {
  if (typeof v !== 'string' || !QTY.test(v) || v.length > 66) return fail(reason);
  const n = BigInt(v);
  if (n > max || (!allowZero && n === 0n)) return fail(reason);
  return n;
}
const isObj = (r: unknown): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r);

/** 5a. Gas price reply (pimlico_getUserOperationGasPrice). Only `fast.maxFeePerGas` and `fast.maxPriorityFeePerGas` are read. */
export function acceptGasPrice(reply: unknown): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  const fast = isObj(reply) && isObj(reply.fast) ? reply.fast : fail('price_shape');
  const maxFeePerGas = qty((fast as any).maxFeePerGas, LIMITS.maxFeePerGasWei, 'fee_per_gas', { allowZero: false });
  const maxPriorityFeePerGas = qty((fast as any).maxPriorityFeePerGas, LIMITS.maxFeePerGasWei, 'priority_fee');
  if (maxPriorityFeePerGas > maxFeePerGas) fail('priority_over_max');
  return { maxFeePerGas, maxPriorityFeePerGas };
}

export interface GasFields { callGasLimit: bigint; verificationGasLimit: bigint; preVerificationGas: bigint }
export interface SponsorFields extends GasFields { paymaster: Address; paymasterData: Hex; paymasterVerificationGasLimit: bigint; paymasterPostOpGasLimit: bigint }

function gasFields(r: Record<string, unknown>): GasFields {
  return {
    callGasLimit: qty(r.callGasLimit, LIMITS.maxCallGasLimit, 'call_gas', { allowZero: false }),
    verificationGasLimit: qty(r.verificationGasLimit, LIMITS.maxVerificationGasLimit, 'verification_gas', { allowZero: false }),
    preVerificationGas: qty(r.preVerificationGas, LIMITS.maxPreVerificationGas, 'pre_verification_gas', { allowZero: false }),
  };
}
/** 5b. User-paid: eth_estimateUserOperationGas reply. Only the three gas limits are read; everything else is ignored. */
export function acceptGasEstimate(reply: unknown): GasFields {
  if (!isObj(reply)) return fail('estimate_shape');
  return gasFields(reply);
}
/** 5b'. User-paid only: safety margin on the bundler's estimate. The bundler sizes its handleOps transaction from these limits, and a
 *  tight estimate (seen on Sepolia: callGasLimit 34,068) can leave the EntryPoint out of gas after a successful validation and call.
 *  +25% on call and verification gas, +10% on pre-verification gas, never above the hard caps. Unused gas is not charged (the fee cap
 *  in assembleOp still bounds the worst case). NOT applied to sponsored ops: the paymaster signature covers the gas limits. */
export function padGasEstimate(g: GasFields): GasFields {
  const pad = (v: bigint, pct: bigint, cap: bigint): bigint => { const x = (v * pct + 99n) / 100n; return x > cap ? cap : x; };
  return {
    callGasLimit: pad(g.callGasLimit, 125n, LIMITS.maxCallGasLimit),
    verificationGasLimit: pad(g.verificationGasLimit, 125n, LIMITS.maxVerificationGasLimit),
    preVerificationGas: pad(g.preVerificationGas, 110n, LIMITS.maxPreVerificationGas),
  };
}
/** 5c. Sponsored: pm_sponsorUserOperation reply. Only paymaster, paymasterData, paymaster gas limits and the three gas limits are read.
 *  The paymaster must be in the per-chain allow-list; any other field (callData, sender, nonce, initCode, entryPoint, ...) is ignored. */
export function acceptSponsorReply(reply: unknown, chainId: number): SponsorFields {
  if (!isObj(reply)) return fail('sponsor_shape');
  const pm = reply.paymaster;
  if (typeof pm !== 'string' || !isAddress(pm, { strict: false }) || !isPinnedPaymaster(chainId, pm)) return fail('paymaster');
  const data = reply.paymasterData ?? '0x';
  if (typeof data !== 'string' || !isHex(data) || data.length % 2 !== 0 || data.length > 2 + 2 * 256) return fail('paymaster_data');
  return {
    ...gasFields(reply), paymaster: getAddress(pm) as Address, paymasterData: data as Hex,
    paymasterVerificationGasLimit: qty(reply.paymasterVerificationGasLimit, LIMITS.maxPaymasterVerificationGasLimit, 'pm_verification_gas'),
    paymasterPostOpGasLimit: qty(reply.paymasterPostOpGasLimit, LIMITS.maxPaymasterPostOpGasLimit, 'pm_post_op_gas'),
  };
}

/** The most the account can be charged for an operation (wei): every gas limit x maxFeePerGas. For a sponsored operation the user pays nothing. */
export const maxTotalFee = (op: Pick<UserOp, 'callGasLimit' | 'verificationGasLimit' | 'preVerificationGas' | 'maxFeePerGas' | 'paymasterVerificationGasLimit' | 'paymasterPostOpGasLimit'>): bigint =>
  (op.callGasLimit + op.verificationGasLimit + op.preVerificationGas + (op.paymasterVerificationGasLimit ?? 0n) + (op.paymasterPostOpGasLimit ?? 0n)) * op.maxFeePerGas;

/** S8: the fee shown to the user is the most they can pay. */
export function checkFeeCap(op: UserOp): bigint {
  const fee = maxTotalFee(op);
  if (fee > LIMITS.maxTotalFeeWei) fail('fee_cap');
  return fee;
}

/** Assembles the operation from locally built parts plus the accepted provider numbers. `nonce` comes from an EntryPoint read, never a reply. */
export function assembleOp(p: { sender: Address; nonce: bigint; callData: Hex; price: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }; gas: GasFields; sponsor?: SponsorFields; signature: Hex }): UserOp {
  if (typeof p.nonce !== 'bigint' || p.nonce < 0n) fail('nonce');
  const op: UserOp = { sender: p.sender, nonce: p.nonce, callData: p.callData, ...p.gas, ...p.price, signature: p.signature };
  if (p.sponsor) Object.assign(op, { paymaster: p.sponsor.paymaster, paymasterData: p.sponsor.paymasterData, paymasterVerificationGasLimit: p.sponsor.paymasterVerificationGasLimit, paymasterPostOpGasLimit: p.sponsor.paymasterPostOpGasLimit });
  checkFeeCap(op);
  return op;
}

/** 7. Authorization (upgrade / revoke): target, chain and nonce are exactly what the builder is supposed to produce. */
export function checkAuthorization(a: { contractAddress: string; chainId: number; nonce: number }, e: { kind: 'upgrade' | 'revoke'; chainId: number; txNonce: number }): void {
  if (!Number.isSafeInteger(a.chainId) || a.chainId <= 0 || a.chainId !== e.chainId) fail('auth_chain'); // 0 = all chains: always refused
  if (a.nonce !== e.txNonce + 1) fail('auth_nonce');
  const want = e.kind === 'revoke' ? ZERO_ADDRESS : DELEGATES[e.chainId];
  if (!want || !same(a.contractAddress, want)) fail('auth_target');
}

/** 8. Freshness: a prepared operation is valid for PREPARED_TTL_MS and for one approval. */
export function assertFresh(preparedAt: number, now: number = Date.now()): void {
  if (!Number.isFinite(preparedAt) || now < preparedAt || now - preparedAt > PREPARED_TTL_MS) fail('expired');
}
