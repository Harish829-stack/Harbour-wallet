// Last-known-good cache so the app can still show data (clearly marked stale) when every provider is down.
// Stored in extension local storage; contains only public market data, never keys or seed material.
import { markStale } from './netStatus';
const PREFIX = 'lk:';
const MAX_AGE_MS = 7 * 24 * 3600_000;
type Store = { get<T>(k: string): Promise<T | undefined>; set(k: string, v: unknown): Promise<void> };
const store = async (): Promise<Store> => (await import('../core/storage')).local as unknown as Store;

/** Runs `produce`; on success remembers the result, on failure returns the remembered one and flags the app as showing stale data. */
export async function withLastKnown<T>(key: string, produce: () => Promise<T>, usable: (v: T) => boolean = () => true): Promise<T> {
  try {
    const v = await produce();
    if (usable(v)) { markStale(false); void store().then((s) => s.set(PREFIX + key, { at: Date.now(), data: v })).catch(() => {}); return v; }
    throw new Error('empty result');
  } catch (e) {
    try {
      const hit = await (await store()).get<{ at: number; data: T }>(PREFIX + key);
      if (hit && Date.now() - hit.at < MAX_AGE_MS) { markStale(true); return hit.data; }
    } catch { /* storage unavailable */ }
    throw e;
  }
}
