// NFT aggregation: per-chain indexers, hide/report state, collection detail. Pure (I/O via injected fetch + urls).
import type { Fetcher } from '../chains/adapters/types';
import type { NftCollection, NftItem, NftReportState } from './types';
import { BLOCKSCOUT_HOSTS, fetchBlockscoutCollections, fetchBlockscoutOwned } from './blockscout';
import { fetchDas, fetchMagicEden } from './solana';

export interface NftEnv { f: Fetcher; solUrls: () => string[] }
/** Mainnet chains queried by default (testnets only when asked). */
export const NFT_CHAINS: string[] = [...Object.keys(BLOCKSCOUT_HOSTS).filter((c) => c !== 'sepolia'), 'solana'];
export interface CollectionsResult { collections: NftCollection[]; errors: Array<{ chainId: string; error: string }>; sources: Record<string, string> }

export async function loadCollections(env: NftEnv, addressOf: (chainId: string) => string, chainIds: string[] = NFT_CHAINS, limit = 4): Promise<CollectionsResult> {
  const res: CollectionsResult = { collections: [], errors: [], sources: {} };
  const wanted = chainIds.filter((c) => c === 'solana' || BLOCKSCOUT_HOSTS[c]);
  let i = 0;
  const worker = async () => {
    while (i < wanted.length) {
      const chainId = wanted[i++]; const addr = addressOf(chainId);
      if (!addr) continue;
      try {
        if (chainId === 'solana') {
          try { res.collections.push(...(await fetchDas(env.solUrls(), addr, env.f))); res.sources[chainId] = 'Solana DAS'; }
          catch { res.collections.push(...(await fetchMagicEden(addr, env.f))); res.sources[chainId] = 'Magic Eden'; }
        } else { res.collections.push(...(await fetchBlockscoutCollections(chainId, addr, env.f))); res.sources[chainId] = 'Blockscout'; }
      } catch (e: any) { res.errors.push({ chainId, error: String(e?.message ?? 'failed').slice(0, 160) }); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, wanted.length) }, worker));
  res.collections.sort((a, b) => Number(a.suspicious) - Number(b.suspicious) || b.owned - a.owned || a.name.localeCompare(b.name));
  return res;
}

/** Full item list of one collection (Blockscout pages through /nft; Solana already carries every item). */
export async function loadCollectionItems(env: NftEnv, c: Pick<NftCollection, 'chainId' | 'contract' | 'items'>, owner: string): Promise<NftItem[]> {
  if (c.chainId === 'solana') return c.items;
  const all = await fetchBlockscoutOwned(c.chainId, owner, c.contract, env.f);
  return all.length ? all : c.items;
}

export const isHidden = (c: Pick<NftCollection, 'id' | 'suspicious'>, s: NftReportState): boolean => s.hidden.includes(c.id) || (c.suspicious && !s.shown.includes(c.id));
export function splitCollections(all: NftCollection[], s: NftReportState): { active: NftCollection[]; hidden: Array<NftCollection & { reason: 'reported' | 'suspected' }> } {
  const active: NftCollection[] = []; const hidden: Array<NftCollection & { reason: 'reported' | 'suspected' }> = [];
  for (const c of all) (isHidden(c, s) ? hidden.push({ ...c, reason: s.hidden.includes(c.id) ? 'reported' : 'suspected' }) : active.push(c));
  return { active, hidden };
}
export function setReported(s: NftReportState, id: string, reported: boolean): NftReportState {
  const hidden = s.hidden.filter((x) => x !== id); const shown = s.shown.filter((x) => x !== id);
  return reported ? { hidden: [...hidden, id].slice(-500), shown } : { hidden, shown: [...shown, id].slice(-500) };
}
export function sanitizeReportState(raw: unknown): NftReportState {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 200).slice(0, 500) : []);
  return { hidden: arr((raw as any)?.hidden), shown: arr((raw as any)?.shown) };
}
