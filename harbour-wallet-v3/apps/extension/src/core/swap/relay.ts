// Relay (api.relay.link) pre-sign checks. Quotes and fresh step items come from Harbour's swap service (backend /v1/swap,
// which calls Relay's official API with its key); this file checks a FRESH quote against the confirmed step before signing
// and reads Relay's own list of its contracts directly from api.relay.link (never through the backend that served the quote).
import { encodeFunctionData, erc20Abi, decodeFunctionData, hashStruct, parseAbi, bytesToHex } from 'viem';
import { hasDangerousSelector, confirmedFloor } from './safety';
import { b58decode, b58encode } from '../provider/base58';
import { domainById } from './domains';
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
export function relayTransactions(fresh: any, step: SwapStep, ctx: { ourAddress: string; chainId: number; slippagePct: number; targets: Set<string>; ownTo?: string; chains?: RelayChains }): { txs: RelayTx[]; requestId?: string } {
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
  // Cross-chain: what arrives, where and to whom is only in Relay's order. Verify it the way Relay documents
  // (docs.relay.link "Input Validation"): recompute the order id and check the deposit commits to it (audit H2).
  if (step.fromDomainId !== step.toDomainId) {
    const exec = txs.filter((t) => t.kind === 'execute');
    if (exec.length !== 1 || !ctx.ownTo || !ctx.chains) throw swapError('unsupported_route');
    verifyRelayOrder(fresh, step, exec[0], { ourAddress: ctx.ourAddress, ownTo: ctx.ownTo, chainId: ctx.chainId, chains: ctx.chains });
  }
  const outNow = big(fresh?.details?.currencyOut?.amount); const minNow = big(fresh?.details?.currencyOut?.minimumAmount ?? fresh?.details?.currencyOut?.amount);
  if (outNow == null || minNow == null) throw bad;
  const bps = BigInt(Math.round(ctx.slippagePct * 100));
  if (minNow * 10_000n < outNow * (10_000n - bps) - outNow * 10n) throw bad;   // minimum within the user's slippage (+0.1% rounding)
  if (outNow < confirmedFloor(step) || minNow < confirmedFloor(step)) throw swapError('price_moved');           // never below the minimum the user confirmed (audit H4)
  return { txs, requestId: requestId ?? fresh?.requestId };
}

// ---------------------------------------------------------------- Relay order verification
/** Relay chain info from api.relay.link/chains (fetched directly, never through the backend). */
export interface RelayChainInfo { protocolChainId: string; vm: 'ethereum-vm' | 'solana-vm'; depository: string }
export type RelayChains = Map<number, RelayChainInfo>;
const RELAY_SOLANA = 792703809;
/** Relay's chain id for a Harbour domain (EVM chain id; Solana has Relay's own id). */
export function relayChainId(domainId: string): number | null {
  const d = domainById(domainId); if (!d) return null;
  return d.kind === 'evm' ? d.chainId! : d.kind === 'solana' ? RELAY_SOLANA : null;
}
const SOL_NATIVE_RELAY = '11111111111111111111111111111111';

// EIP-712 order types, copied verbatim from Relay's official @relay-protocol/settlement-sdk 0.0.163 (dist/order/index.js,
// ORDER_EIP712_TYPES; getOrderId = viem.hashStruct over normalizeOrder). Pinned by tests against order ids Relay returned live.
const ORDER_TYPES = {
  Order: [{ name: 'version', type: 'string' }, { name: 'solverChainId', type: 'string' }, { name: 'solver', type: 'address' }, { name: 'salt', type: 'uint256' }, { name: 'inputs', type: 'Input[]' }, { name: 'output', type: 'Output' }, { name: 'fees', type: 'Fee[]' }],
  Input: [{ name: 'payment', type: 'InputPayment' }, { name: 'refunds', type: 'InputRefund[]' }],
  InputPayment: [{ name: 'chainId', type: 'string' }, { name: 'currency', type: 'bytes' }, { name: 'amount', type: 'uint256' }, { name: 'weight', type: 'uint256' }],
  InputRefund: [{ name: 'chainId', type: 'string' }, { name: 'recipient', type: 'bytes' }, { name: 'currency', type: 'bytes' }, { name: 'minimumAmount', type: 'uint256' }, { name: 'deadline', type: 'uint32' }, { name: 'extraData', type: 'bytes' }],
  Output: [{ name: 'chainId', type: 'string' }, { name: 'payments', type: 'OutputPayment[]' }, { name: 'deadline', type: 'uint32' }, { name: 'calls', type: 'bytes[]' }, { name: 'extraData', type: 'bytes' }],
  OutputPayment: [{ name: 'recipient', type: 'bytes' }, { name: 'currency', type: 'bytes' }, { name: 'minimumAmount', type: 'uint256' }, { name: 'expectedAmount', type: 'uint256' }],
  Fee: [{ name: 'recipientChainId', type: 'string' }, { name: 'recipient', type: 'bytes' }, { name: 'currencyChainId', type: 'string' }, { name: 'currency', type: 'bytes' }, { name: 'amount', type: 'uint256' }],
} as const;
/** settlement-sdk encodeAddress for the two VMs Harbour swaps on; any other VM throws (the swap is refused). */
function encodeAddr(a: unknown, vm: RelayChainInfo['vm'] | undefined): `0x${string}` {
  if (typeof a !== 'string') throw new Error('address');
  if (vm === 'ethereum-vm') { if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error('evm address'); return a.toLowerCase() as `0x${string}`; }
  if (vm === 'solana-vm') { const b = b58decode(a); if (b.length !== 32 || b58encode(b) !== a) throw new Error('solana address'); return bytesToHex(b); }
  throw new Error('unsupported vm');
}
const hexBytes = (h: unknown): `0x${string}` => { if (typeof h !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(h)) throw new Error('bytes'); return h as `0x${string}`; };
/** Recompute a Relay order id (settlement-sdk getOrderId). `vmOf` maps Relay protocol chain ids ("base", "solana") to VMs. */
export function relayOrderId(o: any, vmOf: (protocolChainId: string) => RelayChainInfo['vm'] | undefined): `0x${string}` {
  return hashStruct({ types: ORDER_TYPES as any, primaryType: 'Order', data: {
    version: o.version, solverChainId: o.solverChainId, solver: o.solver, salt: BigInt(o.salt),
    inputs: o.inputs.map((i: any) => ({
      payment: { chainId: i.payment.chainId, currency: encodeAddr(i.payment.currency, vmOf(i.payment.chainId)), amount: BigInt(i.payment.amount), weight: BigInt(i.payment.weight) },
      refunds: i.refunds.map((r: any) => ({ chainId: r.chainId, recipient: encodeAddr(r.recipient, vmOf(r.chainId)), currency: encodeAddr(r.currency, vmOf(r.chainId)), minimumAmount: BigInt(r.minimumAmount), deadline: Number(r.deadline), extraData: hexBytes(r.extraData) })),
    })),
    output: {
      chainId: o.output.chainId,
      payments: o.output.payments.map((p: any) => ({ recipient: encodeAddr(p.recipient, vmOf(o.output.chainId)), currency: encodeAddr(p.currency, vmOf(o.output.chainId)), minimumAmount: BigInt(p.minimumAmount), expectedAmount: BigInt(p.expectedAmount) })),
      deadline: Number(o.output.deadline), calls: o.output.calls.map(hexBytes), extraData: hexBytes(o.output.extraData),
    },
    fees: o.fees.map((f: any) => ({ recipientChainId: f.recipientChainId, recipient: encodeAddr(f.recipient, vmOf(f.recipientChainId)), currencyChainId: f.currencyChainId, currency: encodeAddr(f.currency, vmOf(f.currencyChainId)), amount: BigInt(f.amount) })),
  } } as any);
}
const DEPOSITORY_ABI = parseAbi(['function depositNative(address depositor, bytes32 id) payable', 'function depositErc20(address depositor, address token, uint256 amount, bytes32 id)']);
const sameAddr = (a: unknown, b: string, vm: RelayChainInfo['vm']) => typeof a === 'string' && (vm === 'ethereum-vm' ? a.toLowerCase() === b.toLowerCase() : a === b);
const relayCurrency = (asset: SwapStep['from']['asset'], vm: RelayChainInfo['vm']) => asset.address !== 'native' ? asset.address : vm === 'solana-vm' ? SOL_NATIVE_RELAY : EVM_NATIVE;

/**
 * Relay order checks for a cross-chain deposit: the order pays exactly the sold amount of the sold token on this chain,
 * delivers the bought token on the destination chain to OUR address with at least the confirmed minimum and no extra
 * calls, refunds only to our addresses, hashes to the order id, and the deposit to Relay's own depository commits to that id.
 */
export function verifyRelayOrder(fresh: any, step: SwapStep, exec: RelayTx, ctx: { ourAddress: string; ownTo: string; chainId: number; chains: RelayChains }): void {
  const bad = swapError('unsafe_transaction');
  const p = fresh?.protocol?.v2; const o = p?.orderData;
  const origin = ctx.chains.get(ctx.chainId); const destId = relayChainId(step.toDomainId); const dest = destId == null ? undefined : ctx.chains.get(destId);
  if (!p || !o || !origin || !dest || origin.vm !== 'ethereum-vm') throw swapError('unsupported_route');
  const vmOf = (id: string) => [...ctx.chains.values()].find((c) => c.protocolChainId === id)?.vm;
  if (!Array.isArray(o.inputs) || o.inputs.length !== 1 || !o.output || !Array.isArray(o.output.payments) || o.output.payments.length !== 1 || !Array.isArray(o.output.calls) || o.output.calls.length !== 0 || !Array.isArray(o.fees)) throw bad;
  const pay = o.inputs[0].payment; const out = o.output.payments[0];
  // what we pay
  if (pay?.chainId !== origin.protocolChainId || !sameAddr(pay.currency, relayCurrency(step.from.asset, origin.vm), origin.vm) || String(pay.amount) !== step.from.amount) throw bad;
  // refunds only to our own addresses
  for (const r of o.inputs[0].refunds ?? []) { const vm = vmOf(r?.chainId); if (!vm || !(sameAddr(r.recipient, ctx.ourAddress, vm) || sameAddr(r.recipient, ctx.ownTo, vm))) throw bad; }
  // what arrives, where and to whom
  if (o.output.chainId !== dest.protocolChainId || !sameAddr(out?.recipient, ctx.ownTo, dest.vm) || !sameAddr(out.currency, relayCurrency(step.to.asset, dest.vm), dest.vm)) throw bad;
  let min: bigint; try { min = BigInt(out.minimumAmount); } catch { throw bad; }
  if (min < confirmedFloor(step)) throw swapError('price_moved');
  // the order id and the deposit's commitment to it
  let id: string; try { id = relayOrderId(o, vmOf); } catch { throw bad; }
  if (typeof p.orderId !== 'string' || id.toLowerCase() !== p.orderId.toLowerCase()) throw bad;
  if (exec.to.toLowerCase() !== origin.depository.toLowerCase()) throw bad;
  let call; try { call = decodeFunctionData({ abi: DEPOSITORY_ABI, data: exec.data }); } catch { throw bad; }
  const args = call.args as readonly any[];
  if (String(args[0]).toLowerCase() !== ctx.ourAddress.toLowerCase() || String(args[args.length - 1]).toLowerCase() !== id.toLowerCase()) throw bad;
  if (step.from.asset.address === 'native') { if (call.functionName !== 'depositNative' || exec.value !== BigInt(pay.amount)) throw bad; }
  else if (call.functionName !== 'depositErc20' || String(args[1]).toLowerCase() !== step.from.asset.address.toLowerCase() || args[2] !== BigInt(pay.amount) || exec.value !== 0n) throw bad;
}

/** Relay's own chain list (api.relay.link/chains), cached for 6 hours. Empty map = unreachable = cross-chain refused. */
let relayChainsCache: { at: number; map: RelayChains; raw: any[] } | null = null;
async function relayChainList(f: F): Promise<{ map: RelayChains; raw: any[] }> {
  if (relayChainsCache && Date.now() - relayChainsCache.at < 6 * 3600_000) return relayChainsCache;
  const map: RelayChains = new Map(); let raw: any[] = [];
  try {
    const res = await f('https://api.relay.link/chains', { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (res.ok) raw = (await res.json())?.chains ?? [];
  } catch { /* unreachable */ }
  for (const c of raw) {
    const v2 = c?.protocol?.v2; const vm = c?.vmType === 'evm' ? 'ethereum-vm' : c?.vmType === 'svm' ? 'solana-vm' : undefined;
    if (vm && typeof v2?.chainId === 'string' && typeof v2?.depository === 'string' && Number.isSafeInteger(Number(c?.id))) map.set(Number(c.id), { protocolChainId: v2.chainId, vm, depository: v2.depository });
  }
  if (map.size) relayChainsCache = { at: Date.now(), map, raw };
  return { map, raw };
}
export async function relayChains(f: F = fetch): Promise<RelayChains> { return (await relayChainList(f)).map; }

/**
 * Contracts Relay's own chain list names for a chain (protocol.v2.*). It is fetched DIRECTLY from api.relay.link, not through
 * the gateway that served the quote, so a tampered quote cannot vouch for itself. Empty set = unknown = the caller refuses.
 */
export async function relayTargets(chainId: number, f: F = fetch): Promise<Set<string>> {
  const set = new Set<string>();
  const c = (await relayChainList(f)).raw.find((x: any) => Number(x?.id) === chainId);
  const walk = (v: any, depth = 0) => { if (depth > 4 || v == null) return; if (typeof v === 'string') { if (isAddr(v) && v !== EVM_NATIVE) set.add(v.toLowerCase()); } else if (typeof v === 'object') for (const x of Object.values(v)) walk(x, depth + 1); };
  walk(c?.protocol?.v2);
  return set;
}
