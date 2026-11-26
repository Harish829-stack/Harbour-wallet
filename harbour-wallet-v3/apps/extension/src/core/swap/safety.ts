// Pre-sign checks on aggregator-built transactions. The aggregator response is UNTRUSTED input:
// a swap may only be signed if the transaction matches what the user was quoted and confirmed.
import type { SwapStep, SwapError } from './types';
import { swapError } from './errors';
import { popularAssets } from './tokens';
import { domainById } from './domains';
/** The zero address LI.FI and Relay use for a chain's native coin. */
export const EVM_NATIVE = '0x0000000000000000000000000000000000000000';
export const SOL_NATIVE = '11111111111111111111111111111111';

const ZERO = '0x0000000000000000000000000000000000000000';
const isAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
/** Integer from a decimal or 0x-hex string or a bigint/safe integer; anything else (including '' and booleans) is null. */
const big = (v: unknown): bigint | null => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return Number.isSafeInteger(v) ? BigInt(v) : null;
  if (typeof v !== 'string' || !/^(\d{1,78}|0x[0-9a-fA-F]{1,64})$/.test(v)) return null;
  return BigInt(v);
};
/** The floor every signed transaction must meet: the minimum the user confirmed, less 0.1% for rounding (audit H4). */
export const confirmedFloor = (step: SwapStep): bigint => { const m = BigInt(step.to.minAmount); return m - m / 1000n; };

/** Selectors that move tokens or grant authority (transfer, transferFrom, approve, increaseAllowance, setApprovalForAll, permit). A swap/bridge step is never one of these. */
export const DANGEROUS_SELECTORS = ['0xa9059cbb', '0x23b872dd', '0x095ea7b3', '0x39509351', '0xa22cb465', '0xd505accf', '0x42842e0e', '0xb88d4fde'];
export const hasDangerousSelector = (data: string): boolean => DANGEROUS_SELECTORS.includes(String(data).slice(0, 10).toLowerCase());

/** LI.FI Diamond: same address on every EVM chain Harbour swaps on (verified against lifinance/contracts deployments/*.json for chains 1, 56, 137, 42161, 8453). Any other `to` / approval spender is refused. */
export const LIFI_DIAMOND = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
export const LIFI_ALLOWED: Record<number, string[]> = { 1: [LIFI_DIAMOND], 56: [LIFI_DIAMOND], 137: [LIFI_DIAMOND], 42161: [LIFI_DIAMOND], 8453: [LIFI_DIAMOND] };
export const isAllowedLifiTarget = (chainId: number, a: string): boolean => !!LIFI_ALLOWED[chainId]?.some((x) => x.toLowerCase() === String(a).toLowerCase());
/** LI.FI's marker for "the receiver is on a non-EVM chain" in BridgeData.receiver. */
export const LIFI_NON_EVM_RECEIVER = '0x11f111f111f111f111f111f111f111f111f111f1';
// GenericSwapFacet / GenericSwapFacetV3 selectors: (bytes32 id, string integrator, string referrer, address receiver, uint256 minAmountOut, swapData)
const LIFI_SWAP_SELECTORS = ['0x4630a0d8', '0x4666fc80', '0x733214a3', '0xaf7060fd', '0x5fd9ae2e', '0x2c57e884', '0x736eac0b'];

/**
 * Most native coin a LI.FI transaction may carry ON TOP of a native sale (bridge/messaging fees), per chain, in wei (audit M1).
 * The fee list in the response is untrusted, so it is only believed up to this bound. Unknown chains: none.
 */
export const LIFI_NATIVE_FEE_CAP: Record<number, bigint> = { 1: 10n ** 16n, 56: 5n * 10n ** 16n, 137: 50n * 10n ** 18n, 42161: 5n * 10n ** 15n, 8453: 5n * 10n ** 15n };
/**
 * What a LI.FI bridge leg delivers is the destination counterpart of the asset it bridges (no destination call is allowed),
 * which calldata cannot name (audit follow-up). Accept a bridge only when the bridged asset and the bought asset are the same
 * asset family: the chains' native coins with the same symbol, or curated tokens with the same symbol on both chains.
 */
export function bridgeFamily(domainId: string, address: string): string | null {
  const d = domainById(domainId); if (!d) return null;
  if (address === 'native' || address.toLowerCase() === EVM_NATIVE) return `native:${d.nativeSymbol}`;
  const t = popularAssets(domainId).find((a) => a.address !== 'native' && a.address.toLowerCase() === address.toLowerCase());
  return t ? `token:${t.symbol}` : null;
}
export interface LifiCallInfo { kind: 'swap' | 'bridge'; receiver: string; minAmount: bigint; destChainId?: bigint; sendingAsset?: string; hasSourceSwaps?: boolean; hasDestinationCall?: boolean }
const word = (hex: string, i: number): string | null => { const w = hex.slice(10 + i * 64, 10 + (i + 1) * 64); return w.length === 64 ? w : null; };
const wAddr = (w: string | null): string | null => (w && /^0{24}/.test(w) ? '0x' + w.slice(24) : null);
/** Decode what a LI.FI Diamond call does with funds. Swap functions carry (receiver, minAmountOut); every bridge facet starts with the BridgeData struct. Unknown shapes return null (the caller fails closed). */
export function decodeLifiCall(data: string): LifiCallInfo | null {
  const d = String(data).toLowerCase(); if (!/^0x[0-9a-f]*$/.test(d) || d.length < 10 + 64 * 6) return null;
  const sel = d.slice(0, 10);
  try {
    if (LIFI_SWAP_SELECTORS.includes(sel)) {
      const receiver = wAddr(word(d, 3)); const min = word(d, 4);
      return receiver && min ? { kind: 'swap', receiver, minAmount: BigInt('0x' + min) } : null;
    }
    const off = word(d, 0); if (!off) return null; const o = Number(BigInt('0x' + off)); if (o % 32 !== 0 || o < 32 || o > 4096) return null;
    const t = (i: number) => word(d, o / 32 + i);        // BridgeData tuple head: id, bridge*, integrator*, referrer, sendingAsset, receiver, minAmount, destChainId, hasSourceSwaps, hasDestinationCall
    const w = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(t); if (w.some((x) => x == null)) return null;
    if (BigInt('0x' + w[1]!) !== 320n) return null;      // the two strings follow the 10 fixed words: a distinctive BridgeData fingerprint
    const receiver = wAddr(w[5]); const sendingAsset = wAddr(w[4]); if (!receiver || !sendingAsset) return null;
    return { kind: 'bridge', receiver, sendingAsset, minAmount: BigInt('0x' + w[6]), destChainId: BigInt('0x' + w[7]), hasSourceSwaps: BigInt('0x' + w[8]!) === 1n, hasDestinationCall: BigInt('0x' + w[9]!) !== 0n };
  } catch { return null; }
}

export interface EvmTxCheckCtx { ourAddress: string; chainId: number; slippagePct: number; /** destination kind of the step (evm | solana | utxo) */ destKind?: string; /** LI.FI's id for the destination chain (bridges must name it) */ destLifiChainId?: number }

export function validateLifiTransaction(refreshed: any, step: SwapStep, ctx: EvmTxCheckCtx): SwapError | null {
  const tx = refreshed?.transactionRequest; const est = refreshed?.estimate ?? {};
  const bad = swapError('unsafe_transaction');
  if (!tx || !isAddr(tx.to) || tx.to.toLowerCase() === ZERO || typeof tx.data !== 'string' || !/^0x[0-9a-fA-F]*$/.test(tx.data)) return bad;
  if (hasDangerousSelector(tx.data)) return bad;
  if (!isAllowedLifiTarget(ctx.chainId, tx.to)) return bad;   // the router must be LI.FI's own Diamond, whatever the API says
  if (tx.chainId != null && Number(tx.chainId) !== ctx.chainId) return bad;
  if (tx.from != null && String(tx.from).toLowerCase() !== ctx.ourAddress.toLowerCase()) return bad;
  const action = refreshed?.action ?? {};
  if (action.fromAddress && String(action.fromAddress).toLowerCase() !== ctx.ourAddress.toLowerCase()) return bad;
  // the signer is paying `from.amount` of `from.asset` — the provider may not change it
  const fromAmt = big(step.from.amount); const actAmt = big(action.fromAmount ?? step.from.amount);
  if (fromAmt == null || actAmt == null || actAmt !== fromAmt) return bad;
  // value: native sells send exactly the sell amount (+ native provider fees); token sells send only native fees
  const value = tx.value == null ? 0n : big(tx.value);
  if (value == null) return bad;
  let nativeFees = 0n;
  for (const f of (est.feeCosts ?? []) as any[]) {
    if (f?.token?.address === EVM_NATIVE) nativeFees += big(f.amount) ?? 0n;
  }
  const nativeSell = step.from.asset.address === 'native';
  const feeCap = LIFI_NATIVE_FEE_CAP[ctx.chainId] ?? 0n;
  const maxValue = (nativeSell ? fromAmt : 0n) + (nativeFees < feeCap ? nativeFees : feeCap);
  if (value > maxValue) return bad;
  if (nativeSell && value < fromAmt) return bad;
  // token sells: the contract that pulls the tokens must be the contract that was approved
  if (!nativeSell) {
    const spender = est.approvalAddress ?? step.approval?.spender;
    if (!isAddr(spender) || spender.toLowerCase() !== String(tx.to).toLowerCase()) return bad;
    if (step.approval && step.approval.spender.toLowerCase() !== spender.toLowerCase()) return bad;
  }
  // calldata must send the proceeds to us: decode receiver (and the swap's own min-out) instead of trusting the response's summary
  const info = decodeLifiCall(tx.data); if (!info) return bad;
  if (info.kind === 'bridge') {
    // Non-EVM destinations keep the real receiver in facet-specific data Harbour cannot decode: never signed (audit H2).
    if (ctx.destKind !== 'evm' || info.receiver.toLowerCase() === LIFI_NON_EVM_RECEIVER) return swapError('unsupported_route');
    if (info.hasDestinationCall) return bad;
    if (info.receiver.toLowerCase() !== ctx.ourAddress.toLowerCase()) return bad;
    // the bridge must deliver on the confirmed destination chain
    if (ctx.destLifiChainId == null || info.destChainId !== BigInt(ctx.destLifiChainId)) return bad;
    if (info.minAmount > fromAmt) return bad;
    if (!info.hasSourceSwaps && info.sendingAsset && !(nativeSell ? info.sendingAsset === ZERO : info.sendingAsset.toLowerCase() === step.from.asset.address.toLowerCase())) return bad;
    // the asset that arrives must be the bought asset's counterpart of what is bridged
    const sent = info.sendingAsset ? bridgeFamily(step.fromDomainId, info.sendingAsset) : null;
    const want = bridgeFamily(step.toDomainId, step.to.asset.address);
    if (!sent || !want || sent !== want) return swapError('unsupported_route');
  } else {
    if (info.receiver.toLowerCase() !== ctx.ourAddress.toLowerCase()) return bad;
    const em = big(est.toAmountMin); if (em == null || info.minAmount * 1000n < em * 999n) return bad;   // on-chain min-out may not be weaker than the quoted minimum (0.1% rounding)
  }
  // output protection: the response's own minimum must honour the user's slippage (+0.1% rounding = outNow * 10 on the
  // x10_000 scale; live LI.FI Layerswap bridges quote their minimum 1.00005% below the output at 1% slippage) ...
  const outNow = big(est.toAmount); const minNow = big(est.toAmountMin);
  if (outNow == null || minNow == null) return bad;
  const bps = BigInt(Math.round(ctx.slippagePct * 100));
  if (minNow * 10_000n < outNow * (10_000n - bps) - outNow * 10n) return bad;
  // ... and what is signed must guarantee the minimum the user confirmed, not a new minimum taken from a lower fresh price
  // (slippage applied twice). Swaps: the calldata's own min-out; bridges: the bridge's quoted minimum.
  const floor = confirmedFloor(step);
  if (outNow < floor || (info.kind === 'swap' ? info.minAmount : minNow) < floor) return swapError('price_moved');
  return null;
}

// ---- Solana versioned/legacy transaction helpers ----
export const JUPITER_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
function readCompactU16(b: Uint8Array, at: number): { value: number; len: number } {
  let value = 0; let len = 0;
  for (; len < 3; len++) {
    const byte = b[at + len]; if (byte === undefined) throw new Error('bad tx');
    value |= (byte & 0x7f) << (7 * len);
    if ((byte & 0x80) === 0) { len++; break; }
  }
  return { value, len };
}
export interface ParsedSolanaTx { sigSlots: number; sigOffset: number; msgOffset: number; message: Uint8Array; accountKeys: Uint8Array[] }
export function parseSolanaTx(bytes: Uint8Array): ParsedSolanaTx {
  const sc = readCompactU16(bytes, 0);
  const msgOffset = sc.len + sc.value * 64;
  if (sc.value < 1 || msgOffset >= bytes.length) throw new Error('bad tx');
  const message = bytes.slice(msgOffset);
  let p = message[0] & 0x80 ? 1 : 0;                // versioned prefix
  p += 3;                                           // header
  const nk = readCompactU16(message, p); p += nk.len;
  const accountKeys: Uint8Array[] = [];
  for (let i = 0; i < nk.value; i++) { const k = message.slice(p + i * 32, p + (i + 1) * 32); if (k.length !== 32) throw new Error('bad tx'); accountKeys.push(k); }
  return { sigSlots: sc.value, sigOffset: sc.len, msgOffset, message, accountKeys };
}
export function attachSolanaSignature(bytes: Uint8Array, parsed: ParsedSolanaTx, sig: Uint8Array): Uint8Array {
  if (sig.length !== 64) throw new Error('bad signature');
  const out = bytes.slice(); out.set(sig, parsed.sigOffset); return out;
}
export const b64ToBytes = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const bytesToB64 = (b: Uint8Array): string => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
