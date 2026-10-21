// Provider slots with a primary and fallbacks. Kill switches come from signed remote config (plan section 4 / risks).
const killed = new Set<string>();
export const setKilledProviders = (names: string[]) => { killed.clear(); names.forEach((n) => killed.add(n)); };
export const isKilled = (name: string) => killed.has(name);

export interface Provider<T> { name: string; run: () => Promise<T> }

/** Runs providers in order, skipping killed ones; returns the first success, otherwise throws the last error. */
export async function failover<T>(providers: Provider<T>[]): Promise<{ provider: string; value: T }> {
  let last: unknown = new Error('no provider available');
  for (const p of providers) {
    if (killed.has(p.name)) continue;
    try { return { provider: p.name, value: await p.run() }; } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error('all providers failed');
}

/** Runs all providers concurrently and returns every success (quote racing). */
export async function race<T>(providers: Provider<T>[]): Promise<{ provider: string; value: T }[]> {
  const live = providers.filter((p) => !killed.has(p.name));
  const settled = await Promise.allSettled(live.map(async (p) => ({ provider: p.name, value: await p.run() })));
  return settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
}
