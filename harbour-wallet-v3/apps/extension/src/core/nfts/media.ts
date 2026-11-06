// Media URL sanitising. NFT metadata is attacker-controlled: only https and inline raster/svg data URIs may reach <img src>.
// ipfs:// and ar:// are rewritten to public gateways. Never http, javascript:, file:, blob:, or data: with a non-image type.
import { HB_API_URL } from '../harbour/config';
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
export const ARWEAVE_GATEWAY = 'https://arweave.net/';
const MAX = 2048;
const DATA_IMG = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)(;charset=[\w-]+)?(;base64)?,/i;

export function sanitizeMediaUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const s = input.trim();
  if (!s || s.length > (s.startsWith('data:') ? 400_000 : MAX)) return '';
  if (/[\u0000-\u001f\u007f\s]/.test(s.startsWith('data:') ? s.slice(0, 100) : s)) return '';
  const lower = s.toLowerCase();
  if (lower.startsWith('data:')) return DATA_IMG.test(s) ? s : '';
  if (lower.startsWith('ipfs://')) {
    const rest = s.slice(7).replace(/^ipfs\//i, '');
    return /^[A-Za-z0-9][A-Za-z0-9._~\-/%]*$/.test(rest) ? IPFS_GATEWAY + rest : '';
  }
  if (lower.startsWith('ar://')) {
    const rest = s.slice(5);
    return /^[A-Za-z0-9_\-/.]+$/.test(rest) ? ARWEAVE_GATEWAY + rest : '';
  }
  if (s.startsWith(`${HB_API_URL}/v1/media/`) && /^[a-z]+:\/\/[^/]+\/v1\/media\/[0-9a-f]{32}$/.test(s)) return s; // Harbour's media proxy (re-encoded PNG)
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    return u.toString();
  } catch { return ''; }
}
/** External links (marketplace / project pages) opened in a new tab: https only. */
export function sanitizeLink(input: unknown): string {
  if (typeof input !== 'string') return '';
  try { const u = new URL(input.trim()); return u.protocol === 'https:' && !u.username && !u.password ? u.toString().slice(0, MAX) : ''; } catch { return ''; }
}
/** Plain text from metadata: control chars removed, length-capped (React escapes it on render). */
export function cleanText(input: unknown, max: number): string {
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  return typeof input === 'string' ? input.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';
}
export function mapAttributes(raw: unknown): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  const push = (k: unknown, v: unknown) => { const key = cleanText(k, 60); const value = cleanText(v, 120); if (key && value) out.push({ key, value }); };
  if (Array.isArray(raw)) for (const a of raw.slice(0, 50)) { if (a && typeof a === 'object') push((a as any).trait_type ?? (a as any).key ?? (a as any).name, (a as any).value); }
  else if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw).slice(0, 50)) push(k, v);
  return out;
}
