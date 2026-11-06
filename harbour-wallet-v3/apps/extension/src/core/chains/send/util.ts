import type { Fetcher, SendIssue, IssueCode, FeeTier, FeeTierId } from './types';
import { TIER_IDS } from './types';
export { TIER_IDS };

/** TW strings (App/HiddenAmount chunks, v26.41.0) reused as user-facing text. */
export const MSG = {
  insufficientFunds: 'Insufficient funds, please try again with a larger amount.',
  lowGas: 'Your balance is low and may not cover the network fee.',
  dust: 'Unable to prepare the transaction due to a dust error.',
  smartContract: 'This address belongs to a smart contract. Sending tokens directly to a contract may result in permanent loss.',
  memoRequired: 'A memo is required when sending to this exchange address. Go back and add a memo, or your funds may be lost.',
  simulationNetwork: "Couldn't verify the transaction due to a network issue. Check your connection and try again.",
  simulationReverted: "This transaction can't be completed right now — it was rejected during simulation. If you just approved a token, wait a few seconds and try again.",
} as const;
export const issue = (code: IssueCode, message: string, blocking: boolean): SendIssue => ({ code, message, blocking });

// ---- units ----
export function parseUnits(s: string, decimals: number): bigint {
  const t = String(s ?? '').trim();
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') throw new Error('Enter a valid amount');
  const [w, f = ''] = t.split('.');
  if (f.length > decimals) throw new Error(`Too many decimals (max ${decimals})`);
  return BigInt(w || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
}
export function formatUnits(raw: bigint, decimals: number): string {
  const neg = raw < 0n; const v = neg ? -raw : raw; const base = 10n ** BigInt(decimals);
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${v / base}${frac ? '.' + frac : ''}`;
}
export const maxBig = (a: bigint, b: bigint) => (a > b ? a : b);
export const minBig = (a: bigint, b: bigint) => (a < b ? a : b);
export const sub0 = (a: bigint, b: bigint) => (a > b ? a - b : 0n);

// ---- bytes ----
export const hexToBytes = (h: string): Uint8Array => { const s = h.replace(/^0x/i, ''); const o = new Uint8Array(s.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return o; };
export const bytesToHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
/** Minimal big-endian bytes of a non-negative bigint (wallet-core "uint256" fields; zero -> empty array like protobuf default). */
export function bigToBytes(n: bigint): Uint8Array { if (n <= 0n) return new Uint8Array(0); let h = n.toString(16); if (h.length % 2) h = '0' + h; return hexToBytes(h); }
export const b64 = (b: Uint8Array): string => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
export const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

// ---- network ----
export async function jget(f: Fetcher, url: string, ms = 10000): Promise<any> {
  const res = await f(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } });
  if (!res.ok) { const e: any = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}
export async function jpost(f: Fetcher, url: string, body: unknown, ms = 15000, headers: Record<string, string> = {}): Promise<any> {
  const res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  const text = await res.text(); let j: any; try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!res.ok) { const e: any = new Error(j?.message || j?.error?.message || j?.error || `HTTP ${res.status}`); e.status = res.status; e.body = j; throw e; }
  return j;
}
let rpcId = 1;
/** JSON-RPC 2.0 call; throws the node's error message. */
export async function rpc(f: Fetcher, url: string, method: string, params: unknown[] | Record<string, unknown> = []): Promise<any> {
  const j = await jpost(f, url, { jsonrpc: '2.0', id: rpcId++, method, params });
  if (j?.error) throw new Error(typeof j.error === 'string' ? j.error : j.error.message || j.error.data || JSON.stringify(j.error));
  return j.result;
}
export async function firstOf<T>(urls: string[], run: (u: string) => Promise<T>): Promise<T> {
  let last: unknown = new Error('no endpoint configured');
  for (const u of urls) { try { return await run(u); } catch (e) { last = e; } }
  throw last;
}
export const trimUrl = (u: string) => u.replace(/\/+$/, '');

/** Build three fee tiers from one base fee: slow / average / fast multipliers (percent). */
export function tiersFrom(fees: Record<FeeTierId, bigint>, maxFor: (fee: bigint) => bigint, detail?: Record<FeeTierId, string>, feeMax?: Record<FeeTierId, bigint>): FeeTier[] {
  return TIER_IDS.map((id) => ({ id, fee: fees[id], feeMax: feeMax?.[id], max: maxFor(feeMax?.[id] ?? fees[id]), detail: detail?.[id] }));
}
/** n x multiplier (1.5 = +50%), exact to 3 decimals. */
export const scale = (n: bigint, mult: number) => (n * BigInt(Math.round(mult * 1000))) / 1000n;
/** Common balance/fee validation shared by families (native fee asset == native coin). */
export function fundsIssues(p: { amount: bigint; isToken: boolean; assetBalance: bigint; nativeBalance: bigint; fee: bigint; reserve?: bigint }): SendIssue[] {
  const out: SendIssue[] = []; const reserve = p.reserve ?? 0n;
  if (p.amount > 0n && p.assetBalance < p.amount) out.push(issue('insufficient-funds', MSG.insufficientFunds, true));
  else if (p.isToken ? p.nativeBalance < p.fee : p.nativeBalance < p.amount + p.fee + reserve) { if (!(p.amount > 0n && p.assetBalance < p.amount)) out.push(issue('insufficient-fee', MSG.insufficientFunds, true)); }
  return out;
}
export const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
/** Payload bytes of a bech32 / bech32m string (io1..., one1..., zil1..., thor1...). Throws on a bad character; the checksum is validated by wallet-core elsewhere. */
export function bech32Bytes(addr: string): Uint8Array {
  const s = addr.toLowerCase(); const i = s.lastIndexOf('1'); if (i < 1) throw new Error('Invalid bech32 address');
  const data = [...s.slice(i + 1, -6)].map((c) => { const v = B32.indexOf(c); if (v < 0) throw new Error('Invalid bech32 address'); return v; });
  let acc = 0, bits = 0; const out: number[] = [];
  for (const v of data) { acc = (acc << 5) | v; bits += 5; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); acc &= (1 << bits) - 1; } }
  return Uint8Array.from(out);
}
