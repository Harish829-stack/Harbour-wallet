// Pre-sign checks on aggregator-built transactions. The aggregator response is UNTRUSTED input:
// a swap may only be signed if the transaction matches what the user was quoted and confirmed.
import type { SwapStep, SwapError } from './types';
import { swapError } from './errors';
import { EVM_NATIVE } from './lifi';

const ZERO = '0x0000000000000000000000000000000000000000';
const isAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const big = (v: unknown): bigint | null => { try { return BigInt(v as any); } catch { return null; } };

export interface EvmTxCheckCtx { ourAddress: string; chainId: number; slippagePct: number }

export function validateLifiTransaction(refreshed: any, step: SwapStep, ctx: EvmTxCheckCtx): SwapError | null {
  const tx = refreshed?.transactionRequest; const est = refreshed?.estimate ?? {};
  const bad = swapError('unsafe_transaction');
  if (!tx || !isAddr(tx.to) || tx.to.toLowerCase() === ZERO || typeof tx.data !== 'string' || !/^0x[0-9a-fA-F]*$/.test(tx.data)) return bad;
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
  const maxValue = (nativeSell ? fromAmt : 0n) + nativeFees;
  if (value > maxValue) return bad;
  if (nativeSell && value < fromAmt) return bad;
  // token sells: the contract that pulls the tokens must be the contract that was approved
  if (!nativeSell) {
    const spender = est.approvalAddress ?? step.approval?.spender;
    if (!isAddr(spender) || spender.toLowerCase() !== String(tx.to).toLowerCase()) return bad;
    if (step.approval && step.approval.spender.toLowerCase() !== spender.toLowerCase()) return bad;
  }
  // output protection: min received must honour the user's slippage; the price may not drift past it
  const outNow = big(est.toAmount); const minNow = big(est.toAmountMin);
  const outQuoted = big(step.to.amount);
  if (outNow == null || minNow == null || outQuoted == null) return bad;
  const bps = BigInt(Math.round(ctx.slippagePct * 100));
  if (minNow * 10_000n < outNow * (10_000n - bps) - outNow / 1000n) return bad;       // min below user tolerance (+0.1% rounding)
  if (outNow * 10_000n < outQuoted * (10_000n - bps)) return swapError('price_moved'); // drifted beyond tolerance since the quote
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
