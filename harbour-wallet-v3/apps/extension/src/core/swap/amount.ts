import { parseUnits, formatUnits } from 'viem';
// Exact decimal <-> atomic conversion (bigint). Never uses floating point for token amounts.
export function toAtomic(value: string, decimals: number): bigint | null {
  const v = (value ?? '').trim();
  if (!/^\d*\.?\d*$/.test(v) || v === '' || v === '.') return null;
  const [i, f = ''] = v.split('.');
  try { return parseUnits(`${i || '0'}.${f.slice(0, decimals)}`, decimals); } catch { return null; }
}
export function fromAtomic(value: bigint | string, decimals: number): string {
  try { return formatUnits(BigInt(value), decimals); } catch { return '0'; }
}
// Human display: significant digits for small numbers, grouping for large ones.
export function fmtToken(value: string | number, max = 6): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '0';
  if (Math.abs(n) < 0.000001) return '<0.000001';
  return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 1000 ? 2 : max });
}
export function fmtUsd(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '';
  if (n !== 0 && Math.abs(n) < 0.01) return '<$0.01';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
// rate = how many `to` tokens per 1 `from` token
export function rateOf(fromAtomicAmt: string, fromDec: number, toAtomicAmt: string, toDec: number): number | null {
  const f = Number(fromAtomic(fromAtomicAmt, fromDec)); const t = Number(fromAtomic(toAtomicAmt, toDec));
  return f > 0 && Number.isFinite(t) ? t / f : null;
}
