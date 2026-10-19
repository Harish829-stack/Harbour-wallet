// Validator lists: public `trustwallet/assets` files (`blockchains/<chain>/validators/list.json`), with a bundled snapshot
// (validators.snapshot.json, fetched 2026-10-19) as the offline / failure fallback. Data is untrusted: every field is sanitised.
import snapshot from './validators.snapshot.json';
import type { ValidatorMeta } from './types';

export const VALIDATORS_BASE = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
export const validatorsUrl = (list: string) => `${VALIDATORS_BASE}/${encodeURIComponent(list)}/validators/list.json`;

const clean = (s: unknown, max: number): string => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const httpsUrl = (s: unknown): string | undefined => {
  if (typeof s !== 'string') return undefined;
  try { const u = new URL(s.trim()); return u.protocol === 'https:' ? u.toString().slice(0, 200) : undefined; } catch { return undefined; }
};

/** Accepts the raw JSON of a validators list; drops malformed rows and duplicate ids. Never throws. */
export function sanitizeValidators(raw: unknown): ValidatorMeta[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(); const out: ValidatorMeta[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const id = clean((r as any).id, 120);
    if (!id || /\s/.test(id) || seen.has(id)) continue;
    const name = clean((r as any).name, 80) || id.slice(0, 12);
    seen.add(id);
    out.push({ id, name, description: clean((r as any).description, 200) || undefined, website: httpsUrl((r as any).website) });
  }
  return out;
}

export function bundledValidators(list: string): ValidatorMeta[] {
  const s = (snapshot as Record<string, unknown>)[list];
  return sanitizeValidators(s);
}

export interface LoadedValidators { list: ValidatorMeta[]; source: 'network' | 'snapshot' }
const memo = new Map<string, { at: number; v: LoadedValidators }>();
const TTL = 6 * 3600_000;

/** Network first (fresh), snapshot on any failure or empty answer. The result says which one it was. */
export async function loadValidatorList(list: string, f: typeof fetch = fetch, now = Date.now()): Promise<LoadedValidators> {
  const hit = memo.get(list);
  if (hit && now - hit.at < TTL) return hit.v;
  try {
    const res = await f(validatorsUrl(list), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = sanitizeValidators(await res.json());
    if (!parsed.length) throw new Error('empty list');
    const v: LoadedValidators = { list: parsed, source: 'network' };
    memo.set(list, { at: now, v });
    return v;
  } catch {
    return { list: bundledValidators(list), source: 'snapshot' };
  }
}
export function clearValidatorCache() { memo.clear(); }
