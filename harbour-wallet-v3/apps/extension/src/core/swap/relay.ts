// Relay (api.relay.link) — intent-based EVM swaps and bridges, including EVM -> Solana. Quotes from POST /quote/v2;
// from 2026-10-02 every call needs an API key, which harbour-gateway adds (`/relay/*`). The quote carries ready-made
// step items (approve, then deposit/swap); Harbour re-quotes at submit time and signs only items that match the
// confirmed quote. Field names follow docs.relay.link (get-quote-v2); unverified live from this build environment.
import { hasDangerousSelector } from './safety';
import type { SwapRoute, SwapRouteRequest, SwapStep, SwapFee } from './types';
import { domainById } from './domains';
import { classifyAggregatorError, swapError } from './errors';
import { QUOTE_REFRESH_SECONDS } from './rules';
import { GATEWAY_URL } from '../../kit/endpoints';

type F = typeof fetch;
export const RELAY_BASE = GATEWAY_URL ? `${GATEWAY_URL}/relay` : 'https://api.relay.link';
export const RELAY_SOLANA_CHAIN_ID = 792703809;
const EVM_NATIVE = '0x0000000000000000000000000000000000000000';
const SOL_NATIVE = '11111111111111111111111111111111';
const APPROVE = '0x095ea7b3';
const isAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const big = (v: unknown): bigint | null => { try { return v == null ? null : BigInt(v as any); } catch { return null; } };

export function relayChainId(domainId: string): number | null {
  const d = domainById(domainId); if (!d) return null;
  return d.kind === 'evm' ? d.chainId! : d.kind === 'solana' ? RELAY_SOLANA_CHAIN_ID : null;
}
const currency = (domainId: string, address: string) => address !== 'native' ? address : domainById(domainId)!.kind === 'solana' ? SOL_NATIVE : EVM_NATIVE;
/** Relay is used for EVM-source routes only (its Solana-source items are raw instructions Harbour does not assemble). */
export const relaySupports = (req: Pick<SwapRouteRequest, 'from' | 'to'>): boolean =>
  domainById(req.from.domainId)?.kind === 'evm' && relayChainId(req.to.domainId) != null;

export async function relayQuote(req: SwapRouteRequest, f: F = fetch): Promise<any> {
  const body = {
    user: req.fromAddress, recipient: req.toAddress,
    originChainId: relayChainId(req.from.domainId), destinationChainId: relayChainId(req.to.domainId),
    originCurrency: currency(req.from.domainId, req.from.address), destinationCurrency: currency(req.to.domainId, req.to.address),
    amount: req.amount, tradeType: 'EXACT_INPUT', slippageTolerance: String(Math.round(Number(req.slippage) * 100)), refundTo: req.fromAddress,
  };
  let res: Response;
  try { res = await f(`${RELAY_BASE}/quote/v2`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) }); }
  catch (e: any) { throw e?.name === 'TimeoutError' ? swapError('timeout') : swapError('network'); }
  let j: any = null; try { j = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw classifyAggregatorError(res.status, j);
  if (!Array.isArray(j?.steps) || !j?.details?.currencyOut?.amount) throw swapError('no_liquidity');
  return j;
}

/** Decode `approve(spender, amount)` calldata. */
export function decodeApprove(data: string): { spender: string; amount: bigint } | null {
  if (typeof data !== 'string' || !data.toLowerCase().startsWith(APPROVE) || data.length < 138) return null;
  const spender = `0x${data.slice(34, 74)}`; const amount = big(`0x${data.slice(74, 138)}`);
  return isAddr(spender) && amount != null ? { spender, amount } : null;
}
const items = (q: any, id?: string) => ((q?.steps ?? []) as any[]).filter((s) => !id || s?.id === id).flatMap((s) => (s?.items ?? []).map((it: any) => ({ step: s, item: it })));

export function mapRelayRoute(q: any, req: SwapRouteRequest, now = Date.now()): SwapRoute {
  const out = q.details.currencyOut;
  const approve = items(q, 'approve')[0]?.item?.data;
  const dec = approve ? decodeApprove(approve.data) : null;
  const fees: SwapFee[] = [];
  for (const [k, name] of [['relayer', 'Relayer fee'], ['app', 'App fee']] as const) {
    const fee = q?.fees?.[k]; if (!fee?.amount || fee.amount === '0') continue;
    fees.push({ symbol: fee.currency?.symbol ?? '', decimals: Number(fee.currency?.decimals ?? 18), amount: String(fee.amount), usd: Number(fee.amountUsd) || undefined, name });
  }
  const gas = q?.fees?.gas;
  const fd = domainById(req.from.domainId)!;
  const networkFee: SwapFee | undefined = gas?.amount ? { symbol: fd.nativeSymbol, decimals: fd.nativeDecimals, amount: String(gas.amount), usd: Number(gas.amountUsd) || undefined, name: 'Network fee', isNative: true } : undefined;
  const impact = Number(q?.details?.totalImpact?.percent);
  const seconds = Number(q?.details?.timeEstimate) || 30;
  const step: SwapStep = {
    id: `relay-${now}`, type: req.from.domainId === req.to.domainId ? 'swap' : 'swapAndBridge',
    provider: { id: 'relay', name: 'Relay', logoUrl: 'https://assets.relay.link/icons/1/light.png' },
    fromDomainId: req.from.domainId, toDomainId: req.to.domainId,
    from: { asset: req.from, amount: req.amount },
    to: { asset: req.to, amount: String(out.amount), minAmount: String(out.minimumAmount ?? out.amount) },
    slippage: { userSelected: Number(req.slippage) },
    priceImpact: Number.isFinite(impact) ? Math.min(0, impact) : undefined,
    providerFees: fees, networkFee,
    approval: dec && req.from.address !== 'native' ? { tokenAddress: req.from.address, spender: dec.spender, minAmount: req.amount } : undefined,
    executionSeconds: seconds,
    raw: { quote: q, request: { ...req }, approveSpender: dec?.spender },
  };
  return { id: step.id, source: 'relay', expiresAt: now + Math.min(QUOTE_REFRESH_SECONDS, 30) * 1000, steps: [step], tags: [], warnings: [], fromAmountUsd: Number(q?.details?.currencyIn?.amountUsd) || undefined, toAmountUsd: Number(out.amountUsd) || undefined, priceImpact: step.priceImpact, totalSeconds: seconds };
}

export async function relayRoutes(req: SwapRouteRequest, f: F = fetch): Promise<SwapRoute[]> {
  if (!relaySupports(req)) return [];
  return [mapRelayRoute(await relayQuote(req, f), req)];
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
      txs.push({ kind: 'approve', to: d.to, data: d.data, value: 0n });
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

export type RelayStatus = 'pending' | 'success' | 'failed' | 'refunded';
export async function relayStatus(requestId: string, f: F = fetch): Promise<RelayStatus> {
  const res = await f(`${RELAY_BASE}/intents/status/v2?requestId=${encodeURIComponent(requestId)}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const s = String((await res.json())?.status ?? '').toLowerCase();
  return s === 'success' ? 'success' : s === 'refund' || s === 'refunded' ? 'refunded' : s === 'failure' || s === 'failed' ? 'failed' : 'pending';
}
