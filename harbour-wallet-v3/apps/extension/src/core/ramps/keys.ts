// Developer > Ramp API keys: partner/publishable keys the USER supplies. Stored locally only (chrome.storage.local, key below), never hard-coded,
// never sent anywhere except the provider's own API/widget. These are public/publishable identifiers, not wallet secrets, so they are stored
// unencrypted; secret/signing keys are deliberately NOT accepted (see providers.ts MoonPay/Mercuryo notes).
import type { RampKeys, RampProviderId } from './types';
import { PROVIDERS, providerById, sanitizeKeys } from './providers';
export const RAMP_KEYS_STORAGE = 'wallet:ramp:keys';

/** Re-validate whatever was read from storage (it is user-controlled data). */
export function normalizeKeys(raw: unknown): RampKeys {
  const out: RampKeys = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const p of PROVIDERS) {
    const r = sanitizeKeys(p, (raw as any)[p.id]);
    if (r.ok && Object.keys(r.keys).length) out[p.id] = r.keys;
  }
  return out;
}
export function setProviderKeys(cur: RampKeys, id: unknown, input: unknown): { ok: true; keys: RampKeys } | { ok: false; error: string } {
  const p = providerById(id); if (!p) return { ok: false, error: 'Unknown provider' };
  const r = sanitizeKeys(p, input); if (!r.ok) return r;
  const next: RampKeys = { ...cur };
  // blank fields keep the stored value; explicit null clears it
  const merged: Record<string, string> = { ...(cur[p.id] ?? {}), ...r.keys };
  for (const f of p.keyFields) if ((input as any)?.[f.field] === null) delete merged[f.field];
  if (Object.keys(merged).length) next[p.id as RampProviderId] = merged; else delete next[p.id as RampProviderId];
  return { ok: true, keys: next };
}
export const maskKey = (v: string) => (v.length <= 8 ? '••••' : `${v.slice(0, 3)}••••${v.slice(-3)}`);
/** What the UI may see: which fields are configured and a masked preview, never the full value. */
export function describeKeys(all: RampKeys) {
  return PROVIDERS.map((p) => ({
    id: p.id, name: p.name, docsUrl: p.docsUrl, note: p.note, widgetOnly: !!p.widgetOnly, modes: p.modes,
    fields: p.keyFields.map((f) => ({ field: f.field, label: f.label, hint: f.hint, optional: !!f.optional, configured: !!all[p.id]?.[f.field], preview: all[p.id]?.[f.field] ? maskKey(all[p.id]![f.field]) : '' })),
  }));
}
