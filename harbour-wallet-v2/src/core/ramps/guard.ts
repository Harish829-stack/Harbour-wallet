// Input validation + injection-safe URL building for ramp widgets. Every provider URL is assembled with URL/searchParams (never string
// concatenation), only to an allow-listed https host, and the wallet address is forced to the user's own validated address
// (TW chunk `enforceTrustedRampAddress`: any `address` query value that differs from the wallet address is overridden).
import type { ChainKind } from '../chains/types';

const MAX_AMOUNT_DIGITS = 18;
/** A positive plain-decimal amount ("100", "0.05"). No exponent, sign, separators or whitespace. */
export function parseAmount(input: unknown): { ok: true; value: string; num: number } | { ok: false; error: string } {
  if (typeof input !== 'string') return { ok: false, error: 'Enter an amount' };
  const s = input.trim();
  if (!/^\d{1,12}(\.\d{1,18})?$/.test(s) || s.replace('.', '').length > MAX_AMOUNT_DIGITS + 12) return { ok: false, error: 'Enter a valid amount' };
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Enter an amount greater than 0' };
  return { ok: true, value: s.replace(/^0+(?=\d)/, ''), num: n };
}

const B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
/** Structural address check per chain family. This is a shape check (injection / mix-up guard), not a checksum proof; the address itself
 *  always comes from the vault, never from user input. */
export function isPlausibleAddress(kind: ChainKind, address: unknown): boolean {
  if (typeof address !== 'string') return false;
  const a = address;
  if (a !== a.trim() || a.length < 20 || a.length > 128) return false;
  switch (kind) {
    case 'evm': return /^0x[0-9a-fA-F]{40}$/.test(a);
    case 'solana': return a.length >= 32 && a.length <= 44 && B58.test(a);
    case 'tron': return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
    case 'utxo': return /^(bc1[0-9a-z]{25,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|ltc1[0-9a-z]{25,87}|[LM][1-9A-HJ-NP-Za-km-z]{25,34}|D[1-9A-HJ-NP-Za-km-z]{25,34}|bitcoincash:[0-9a-z]{30,60}|q[0-9a-z]{40,60})$/.test(a);
    case 'ton': return /^[A-Za-z0-9_-]{48}$/.test(a);
    default: return /^[A-Za-z0-9:_\-.]{20,128}$/.test(a);
  }
}

export interface WidgetTarget { host: string }
export function buildSafeUrl(base: string, params: Record<string, string | number | boolean | undefined | null>, allowedHosts: readonly string[]): URL {
  const u = new URL(base);
  if (u.protocol !== 'https:') throw new Error('Provider URL must be https');
  if (u.username || u.password) throw new Error('Provider URL must not contain credentials');
  if (!allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) throw new Error(`Host not allowed: ${u.hostname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    u.searchParams.set(k, String(v));
  }
  return u;
}

/** Mirror of TW `enforceTrustedRampAddress(url, addressField, trustedAddress)`: set the provider's address field and override any
 *  parameter literally named `address`. Returns the list of overridden params (for tests / logging). */
export function enforceTrustedAddress(url: URL, addressField: string | undefined, trusted: string): string[] {
  const overridden: string[] = [];
  if (addressField) url.searchParams.set(addressField, trusted);
  for (const [k, v] of Array.from(url.searchParams.entries())) {
    if (/^(address|walletaddress|useraddress|refundwalletaddress)$/i.test(k) && v !== trusted) { url.searchParams.set(k, trusted); overridden.push(k); }
  }
  return overridden;
}

/** Defensive final check before a URL leaves the extension. */
export function assertOpenable(u: string): string {
  const x = new URL(u);
  if (x.protocol !== 'https:' || x.username || x.password) throw new Error('Blocked URL');
  return x.toString();
}

/** Public https link from untrusted feed data (articles, posts, dApps): https only, no credentials, no local/IP hosts. Returns '' if unsafe. */
export function safeHttpsLink(u: unknown): string {
  if (typeof u !== 'string' || u.length > 2048) return '';
  try {
    const x = new URL(u.trim());
    if (x.protocol !== 'https:' || x.username || x.password) return '';
    const h = x.hostname.toLowerCase();
    if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.startsWith('[')) return '';
    return x.toString();
  } catch { return ''; }
}
