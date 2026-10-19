// Site risk check against MetaMask's public eth-phishing-detect list (static JSON on github raw; Trust Wallet's own URL-risk service is
// a private backend and is NOT used). The list is cached in storage.session for 24h; if it cannot be fetched the UI says so (TW: risk.dapp-check-unavailable).
import type { KV } from './store';
import { hostnameOf } from './origin';

export const PHISHING_URL = 'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json';
const KEY = 'wallet:provider:phishing'; const TTL = 24 * 3600_000;
export type SiteRisk = { level: 'ok' } | { level: 'high'; reason: 'blocklist' } | { level: 'unavailable' };

export interface PhishingConfig { blacklist: string[]; whitelist: string[] }
export function parsePhishingConfig(json: unknown): PhishingConfig | null {
  const o = json as any; if (!o || typeof o !== 'object' || !Array.isArray(o.blacklist)) return null;
  const s = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && x.length < 256).map((x) => x.toLowerCase()) : []);
  return { blacklist: s(o.blacklist), whitelist: s(o.whitelist) };
}
/** A host matches an entry if it equals it or is a subdomain of it. The whitelist overrides the blacklist for the same registrable entry (as eth-phishing-detect does). */
export function checkHost(cfg: { black: Set<string>; white: Set<string> }, host: string): 'ok' | 'blocked' {
  const labels = host.toLowerCase().split('.'); let blocked = false;
  for (let i = 0; i < labels.length - 1 || i === 0; i++) {
    const d = labels.slice(i).join('.');
    if (cfg.white.has(d)) return 'ok';
    if (cfg.black.has(d)) blocked = true;
    if (i >= labels.length - 1) break;
  }
  return blocked ? 'blocked' : 'ok';
}
let mem: { at: number; black: Set<string>; white: Set<string> } | null = null;
export function resetPhishingCache() { mem = null; }
export async function siteRisk(origin: string, kv: KV, f: typeof fetch = fetch, now: () => number = Date.now): Promise<SiteRisk> {
  const host = hostnameOf(origin); if (!host) return { level: 'unavailable' };
  try {
    if (!mem || now() - mem.at > TTL) {
      const cached = await kv.get<{ at: number; black: string; white: string }>(KEY);
      if (cached && now() - cached.at <= TTL) mem = { at: cached.at, black: new Set(cached.black ? cached.black.split('\n') : []), white: new Set(cached.white ? cached.white.split('\n') : []) };
      else {
        const res = await f(PHISHING_URL, { signal: AbortSignal.timeout(6000) }); if (!res.ok) throw new Error('http ' + res.status);
        const cfg = parsePhishingConfig(await res.json()); if (!cfg) throw new Error('bad config');
        mem = { at: now(), black: new Set(cfg.blacklist), white: new Set(cfg.whitelist) };
        await kv.set(KEY, { at: mem.at, black: cfg.blacklist.join('\n'), white: cfg.whitelist.join('\n') }).catch(() => {});
      }
    }
    return checkHost(mem, host) === 'blocked' ? { level: 'high', reason: 'blocklist' } : { level: 'ok' };
  } catch { return mem ? (checkHost(mem, host) === 'blocked' ? { level: 'high', reason: 'blocklist' } : { level: 'ok' }) : { level: 'unavailable' }; }
}
