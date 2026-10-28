// Signed remote config (plan A9): flags, chain toggles, announcements, provider kill switches. Ed25519 over the exact JSON text.
import { http } from './httpClient';
import { CONFIG_URL, CONFIG_PUBLIC_KEY } from './endpoints';
import { setKilledProviders } from './failover';

export interface RemoteConfig {
  version: number;
  flags: Record<string, boolean>;
  killedProviders: string[];
  chains: Record<string, boolean>;
  announcements: { id: string; title: string; body: string; url?: string }[];
  discover?: { name: string; url: string; icon?: string; category?: string }[];
}
export const EMPTY_CONFIG: RemoteConfig = { version: 0, flags: {}, killedProviders: [], chains: {}, announcements: [] };

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function verifySignature(text: string, sigB64: string, pubB64: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', b64(pubB64), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, b64(sigB64), new TextEncoder().encode(text));
  } catch { return false; }
}

/** Parses and validates a config payload. Rejects downgrades (version must not go backwards). */
export function parseConfig(text: string, currentVersion: number): RemoteConfig | null {
  try {
    const c = JSON.parse(text);
    if (typeof c?.version !== 'number' || c.version < currentVersion) return null;
    // signed configs carry an expiry so a captured old config (e.g. with kill switches off) cannot be replayed forever
    if (c.expiresAt !== undefined && (typeof c.expiresAt !== 'number' || c.expiresAt * 1000 < Date.now())) return null;
    const rec = (v: any) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'boolean')) as Record<string, boolean> : {});
    return {
      version: c.version, flags: rec(c.flags), chains: rec(c.chains),
      killedProviders: Array.isArray(c.killedProviders) ? c.killedProviders.filter((x: unknown) => typeof x === 'string') : [],
      announcements: Array.isArray(c.announcements) ? c.announcements.filter((a: any) => a && typeof a.id === 'string' && typeof a.title === 'string').map((a: any) => ({ id: a.id, title: a.title, body: String(a.body ?? ''), url: typeof a.url === 'string' && /^https:\/\//.test(a.url) ? a.url : undefined })) : [],
      discover: Array.isArray(c.discover) ? c.discover.filter((d: any) => typeof d?.name === 'string' && /^https:\/\//.test(d?.url)) : undefined,
    };
  } catch { return null; }
}

/** Fetches `{ config: <json text>, signature: <b64> }`, verifies, applies kill switches. Returns null when disabled or invalid. */
export async function refreshConfig(currentVersion: number): Promise<RemoteConfig | null> {
  if (!CONFIG_URL || !CONFIG_PUBLIC_KEY) return null;
  try {
    const env = await http.json<{ config: string; signature: string }>(CONFIG_URL, { retries: 1, timeoutMs: 8000 });
    if (typeof env?.config !== 'string' || !(await verifySignature(env.config, env.signature, CONFIG_PUBLIC_KEY))) return null;
    const cfg = parseConfig(env.config, currentVersion);
    if (cfg) setKilledProviders(cfg.killedProviders);
    return cfg;
  } catch { return null; }
}
