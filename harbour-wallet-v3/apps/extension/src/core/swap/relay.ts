// Relay (api.relay.link) pre-sign checks. Quotes and fresh step items come from Harbour's swap service (backend /v1/swap,
// which calls Relay's official API with its key); this file checks a FRESH quote against the confirmed step before signing
// and reads Relay's own list of its contracts directly from api.relay.link (never through the backend that served the quote).
import { encodeFunctionData, erc20Abi } from 'viem';
import { hasDangerousSelector } from './safety';
import type { SwapStep } from './types';
import { swapError } from './errors';

type F = typeof fetch;
const EVM_NATIVE = '0x0000000000000000000000000000000000000000';
const APPROVE = '0x095ea7b3';
const isAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const big = (v: unknown): bigint | null => { try { return v == null ? null : BigInt(v as any); } catch { return null; } };

/** Decode `approve(spender, amount)` calldata. */
export function decodeApprove(data: string): { spender: string; amount: bigint } | null {
  if (typeof data !== 'string' || !data.toLowerCase().startsWith(APPROVE) || data.length < 138) return null;
  const spender = `0x${data.slice(34, 74)}`; const amount = big(`0x${data.slice(74, 138)}`);
  return isAddr(spender) && amount != null ? { spender, amount } : null;
}

export interface RelayTx { kind: 'approve' | 'execute'; to: `0x${string}`; data: `0x${string}`; value: bigint }
/**
 * Validate a FRESH quote against the confirmed step and return the transactions to sign, in order.
 * Rules: only `transaction` steps on our chain from our address; approvals target the sold token and the confirmed
 * spender; execute items send at most the sold amount (native sells) or nothing (token sells); the output may not
 * drift past the user's slippage.
 */
export function relayTransactions(fresh: any, step: SwapStep, ctx: { ourAddress: string; chainId: number; slippagePct: number; targets: Set<string> }): { txs: RelayTx[]; requestId?: string } {
  const bad = swapError('unsafe_transaction');
  const steps: any[] = fresh?.steps ?? [];
  if (!steps.length || steps.some((s) => s?.kind !== 'transaction')) throw swapError('unsupported_pair');
  const native = step.from.asset.address === 'native';
  const sell = BigInt(step.from.amount);
  const txs: RelayTx[] = []; let requestId: string | undefined;
  for (const s of steps) for (const it of s.items ?? []) {
    if (it?.status === 'complete') continue;
    const d = it?.data ?? {};
    if (!isAddr(d.to) || d.to === EVM_NATIVE || typeof d.data !== 'string' || !/^0x[0-9a-fA-F]*$/.test(d.data)) throw bad;
    if (d.chainId != null && Number(d.chainId) !== ctx.chainId) throw bad;
    if (d.from != null && String(d.from).toLowerCase() !== ctx.ourAddress.toLowerCase()) throw bad;
    const value = big(d.value ?? 0); if (value == null) throw bad;
    if (s.id === 'approve') {
      const dec = decodeApprove(d.data);
      if (native || !dec || d.to.toLowerCase() !== step.from.asset.address.toLowerCase() || value !== 0n) throw bad;
      if (!step.approval || dec.spender.toLowerCase() !== step.approval.spender.toLowerCase()) throw bad;
      if (!ctx.targets.has(dec.spender.toLowerCase())) throw bad;   // spender must be a contract Relay itself lists for this chain
      // Never sign Relay's own approval calldata (it may ask for an unlimited allowance): approve exactly the amount being sold.
      const exact = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [dec.spender as `0x${string}`, sell] });
      txs.push({ kind: 'approve', to: d.to, data: exact, value: 0n });
    } else {
      if (native ? value > sell : value !== 0n) throw bad;
      if (!ctx.targets.has(d.to.toLowerCase())) throw bad;          // execute target must be a contract Relay itself lists for this chain
      if (String(d.data).toLowerCase().startsWith(APPROVE) || hasDangerousSelector(d.data)) throw bad;
      txs.push({ kind: 'execute', to: d.to, data: d.data, value });
      requestId = requestId ?? s.requestId ?? fresh?.requestId;
    }
  }
  if (!txs.some((t) => t.kind === 'execute')) throw bad;
  const outNow = big(fresh?.details?.currencyOut?.amount); const minNow = big(fresh?.details?.currencyOut?.minimumAmount ?? fresh?.details?.currencyOut?.amount);
  const quoted = big(step.to.amount);
  if (outNow == null || minNow == null || quoted == null) throw bad;
  const bps = BigInt(Math.round(ctx.slippagePct * 100));
  if (minNow * 10_000n < outNow * (10_000n - bps) - outNow / 1000n) throw bad;
  if (outNow * 10_000n < quoted * (10_000n - bps)) throw swapError('price_moved');
  return { txs, requestId: requestId ?? fresh?.requestId };
}

/**
 * Contracts Relay's own chain list names for a chain (protocol.v2.*). It is fetched DIRECTLY from api.relay.link, not through
 * the gateway that served the quote, so a tampered quote cannot vouch for itself. Empty set = unknown = the caller refuses.
 */
const relayTargetCache = new Map<number, { at: number; set: Set<string> }>();
export async function relayTargets(chainId: number, f: F = fetch): Promise<Set<string>> {
  const hit = relayTargetCache.get(chainId); if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.set;
  const set = new Set<string>();
  try {
    const res = await f('https://api.relay.link/chains', { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const c = ((await res.json())?.chains ?? []).find((x: any) => Number(x?.id) === chainId);
      const walk = (v: any, depth = 0) => { if (depth > 4 || v == null) return; if (typeof v === 'string') { if (isAddr(v) && v !== EVM_NATIVE) set.add(v.toLowerCase()); } else if (typeof v === 'object') for (const x of Object.values(v)) walk(x, depth + 1); };
      walk(c?.protocol?.v2);
    }
  } catch { /* unreachable: stays empty and the swap is refused */ }
  if (set.size) relayTargetCache.set(chainId, { at: Date.now(), set });
  return set;
}
