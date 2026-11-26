// "You send X, you get Y": the swap's real effect on the wallet, from an on-chain dry run (eth_simulateV1 with
// traceTransfers), checked against the route the user confirmed. Provider-independent: whichever provider built the
// transaction, the simulated balance changes must match the quote or nothing is signed.
import { assetChangesFrom, NATIVE_PSEUDO, type AssetChange } from '../provider/simulate';
import type { SwapStep } from './types';

export interface SimCall { from: string; to: string; data: string; value: bigint }
/** eth_simulateV1 params for calls run one after another in one block (e.g. approve, then swap). */
export function simulateCallsParams(calls: SimCall[]) {
  return [{ blockStateCalls: [{ calls: calls.map((c) => ({ from: c.from, to: c.to, input: c.data, value: `0x${c.value.toString(16)}` })) }], traceTransfers: true, validation: false }, 'latest'];
}

export type SimRead = { ok: true; changes: AssetChange[] } | { ok: false; error: string };
/** null = the RPC cannot simulate (method unsupported / failed); otherwise success with net changes for `owner`, or the revert. */
export function readSimulatedCalls(result: any, owner: string): SimRead | null {
  const calls: any[] | undefined = result?.[0]?.calls;
  if (!Array.isArray(calls) || !calls.length) return null;
  const bad = calls.find((c) => c?.status !== '0x1');
  if (bad) return { ok: false, error: String(bad?.error?.message ?? 'reverted').slice(0, 200) };
  return { ok: true, changes: assetChangesFrom(calls.flatMap((c) => (Array.isArray(c?.logs) ? c.logs : [])), owner) };
}

export interface SwapEffect { sent: bigint; received: bigint | null; nativeOut: bigint }
export type SwapEffectCheck = { ok: true; effect: SwapEffect } | { ok: false; reason: 'unexpected_outflow' | 'oversend' | 'below_minimum' | 'nothing_received' };

/**
 * Rules (same-chain and cross-chain): the wallet may lose only the sold asset (at most the sold amount; for a native sell, at
 * most the native value the transactions carry) and native coin up to `maxNativeOut` (the transactions' own value, e.g.
 * bridge fees); never an NFT or any other token. Same-chain swaps must also
 * pay at least the confirmed minimum of the bought asset to the wallet.
 */
export function checkSwapEffect(changes: AssetChange[], step: SwapStep, o: { maxNativeOut: bigint }): SwapEffectCheck {
  const key = (a: { address: string }) => (a.address === 'native' ? NATIVE_PSEUDO : a.address.toLowerCase());
  const sold = key(step.from.asset); const bought = key(step.to.asset);
  const sameChain = step.fromDomainId === step.toDomainId;
  let sent = 0n; let received = 0n; let nativeOut = 0n;
  for (const c of changes) {
    const amt = BigInt(c.amount); const tok = c.token.toLowerCase();
    if (c.direction === 'out') {
      if (c.kind === 'nft') return { ok: false, reason: 'unexpected_outflow' };
      if (tok === sold) sent += amt;
      else if (tok === NATIVE_PSEUDO) nativeOut += amt;
      else return { ok: false, reason: 'unexpected_outflow' };
    } else if (sameChain && tok === bought) received += amt;
  }
  // A native sell's value may include native provider fees (already bounded by the provider checks): cap at the value sent.
  const maxSent = sold === NATIVE_PSEUDO ? (o.maxNativeOut > BigInt(step.from.amount) ? o.maxNativeOut : BigInt(step.from.amount)) : BigInt(step.from.amount);
  if (sent > maxSent) return { ok: false, reason: 'oversend' };
  if (nativeOut > o.maxNativeOut) return { ok: false, reason: 'unexpected_outflow' };
  if (sameChain) {
    if (received === 0n) return { ok: false, reason: 'nothing_received' };
    if (received < BigInt(step.to.minAmount)) return { ok: false, reason: 'below_minimum' };
  }
  return { ok: true, effect: { sent, received: sameChain ? received : null, nativeOut } };
}
