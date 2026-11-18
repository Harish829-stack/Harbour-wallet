// Persistent store of ERC-7715 grants the user has signed (so Settings can list and revoke them and a site can read its own back).
// Pure over an injected key-value store. Holds only public data: the delegation, its signature and the limits. Never a key.
import type { GrantRecord } from './permissions';

export interface Kv { get<T>(k: string): Promise<T | undefined | null>; set(k: string, v: unknown): Promise<void> }
export const GRANTS_KEY = 'wallet:smartAccount:grants'; export const MAX_GRANTS = 100;

export function makeGrantStore(kv: Kv) {
  const read = async (): Promise<GrantRecord[]> => { const v = await kv.get<GrantRecord[]>(GRANTS_KEY); return Array.isArray(v) ? v : []; };
  return {
    all: read,
    /** A site sees only ITS OWN grants for the account it is connected to. */
    list: async (origin: string, account: string) => (await read()).filter((g) => g.origin === origin && g.account.toLowerCase() === account.toLowerCase()),
    put: async (rec: GrantRecord) => {
      const all = (await read()).filter((g) => g.id !== rec.id); all.push(rec);
      await kv.set(GRANTS_KEY, all.slice(-MAX_GRANTS)); // oldest dropped from the list only; an on-chain grant stays valid until it expires or is disabled
    },
    remove: async (id: string) => { await kv.set(GRANTS_KEY, (await read()).filter((g) => g.id !== id)); },
  };
}
