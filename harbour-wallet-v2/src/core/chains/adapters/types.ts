import type { ChainInfo } from '../types';
export type Fetcher = typeof fetch;
export interface NativeBalanceResult {
  ok: boolean;
  /** Smallest-unit amount as a decimal string ("0" when the account does not exist yet). */
  raw: string;
  /** Human-readable amount ("1.2345"). */
  formatted: string;
  error?: string;
}
/** Reads one account's native balance from a public endpoint. Must never throw: failures return ok:false. */
export type BalanceAdapter = (chain: ChainInfo, address: string, f: Fetcher) => Promise<NativeBalanceResult>;

export const fail = (error: string): NativeBalanceResult => ({ ok: false, raw: '0', formatted: '0', error });
export function formatUnits(raw: bigint, decimals: number): string {
  const neg = raw < 0n; const v = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = v / base; const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}
export const okRaw = (raw: bigint, decimals: number): NativeBalanceResult => ({ ok: true, raw: raw.toString(), formatted: formatUnits(raw, decimals) });
/** JSON POST helper with timeout. */
export async function jsonPost(f: Fetcher, url: string, body: unknown, ms = 8000): Promise<any> {
  const res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function jsonGet(f: Fetcher, url: string, ms = 8000): Promise<any> {
  const res = await f(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) { const e: any = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}
/** Try each endpoint in order until one answers. */
export async function firstOf<T>(urls: string[], run: (url: string) => Promise<T>): Promise<T> {
  let last: unknown = new Error('no endpoint configured');
  for (const u of urls) { try { return await run(u); } catch (e) { last = e; } }
  throw last;
}
