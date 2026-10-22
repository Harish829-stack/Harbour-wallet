// Network health, as observed from real traffic (no extra probe requests). Only host names are kept, never full URLs or keys.
// `state`: ok | degraded (many recent failures, or fallbacks in use) | offline (browser offline, or every recent request failed).
export type NetKind = 'rpc' | 'api';
export interface NetStatus { state: 'ok' | 'degraded' | 'offline'; stale: boolean; failing: string[]; updatedAt: number }
interface Ev { ok: boolean; host: string; at: number }
const WINDOW_MS = 2 * 60_000;
const events: Ev[] = [];
let stale = false; let staleAt = 0;

export function recordNet(_kind: NetKind, ok: boolean, host: string, now = Date.now()): void {
  events.push({ ok, host, at: now });
  while (events.length > 60 || (events.length && now - events[0].at > WINDOW_MS)) events.shift();
}
export const markStale = (on: boolean, now = Date.now()): void => { stale = on; if (on) staleAt = now; };

export function netStatus(now = Date.now(), online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine !== false): NetStatus {
  const recent = events.filter((e) => now - e.at <= WINDOW_MS);
  const failing = [...new Set(recent.filter((e) => !e.ok).map((e) => e.host))].slice(0, 5);
  const last = recent.slice(-5);
  const allFailed = last.length >= 3 && last.every((e) => !e.ok);
  const rate = recent.length >= 4 ? recent.filter((e) => !e.ok).length / recent.length : 0;
  const staleNow = stale && now - staleAt < WINDOW_MS * 5;
  const state = !online || allFailed ? 'offline' : rate >= 0.5 || staleNow ? 'degraded' : 'ok';
  return { state, stale: staleNow, failing, updatedAt: now };
}
export const resetNetStatus = (): void => { events.length = 0; stale = false; };
