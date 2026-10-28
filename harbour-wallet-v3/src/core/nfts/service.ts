// NFT aggregation: per-chain indexers, hide/report state, collection detail. Pure (I/O via injected fetch + urls).
import type { Fetcher } from '../chains/adapters/types';
import type { NftCollection, NftItem, NftReportState } from './types';
import { BLOCKSCOUT_HOSTS, fetchBlockscoutCollections, fetchBlockscoutOwned } from './blockscout';
import { fetchDas, fetchMagicEden } from './solana';
import { alchemyAvailable, fetchAlchemyCollections } from './alchemy';
import { fillMissingMetadata } from './onchain';
import { isHarbourChain } from '../harbour/config';
import { fetchHarbourNfts } from '../harbour/data';
import { ENABLED_CHAIN_IDS } from '../chains/index';

export interface NftEnv { f: Fetcher; solUrls: () => string[]; /** EVM RPCs for the on-chain metadata fallback (optional). */ rpcUrls?: (chainId: string) => string[] }
/** Mainnet chains queried by default (testnets only when asked). */
// Harbour v3: only the enabled (backend-served) networks.
export const NFT_CHAINS: string[] = [...Object.keys(BLOCKSCOUT_HOSTS).filter((c) => c !== 'sepolia'), 'solana'].filter((c) => ENABLED_CHAIN_IDS.includes(c)).concat(ENABLED_CHAIN_IDS.filter(isHarbourChain));
export interface CollectionsResult { collections: NftCollection[]; errors: Array<{ chainId: string; error: string }>; sources: Record<string, string> }

export async function loadCollections(env: NftEnv, addressOf: (chainId: string) => string, chainIds: string[] = NFT_CHAINS, limit = 4): Promise<CollectionsResult> {
  const res: CollectionsResult = { collections: [], errors: [], sources: {} };
  // Harbour networks: one API call covers all of them (indexed holdings, images through Harbour's media proxy).
  const hb = chainIds.filter(isHarbourChain);
  if (hb.length) {
    const addr = addressOf(hb[0]);
    if (addr) {
      try { res.collections.push(...(await fetchHarbourNfts(addr, hb))); for (const c of hb) res.sources[c] = 'Harbour'; }
      catch (e: any) { for (const c of hb) res.errors.push({ chainId: c, error: String(e?.message ?? 'failed').slice(0, 160) }); }
    }
  }
  const wanted = chainIds.filter((c) => !isHarbourChain(c) && (c === 'solana' || BLOCKSCOUT_HOSTS[c]));
  let i = 0;
  const worker = async () => {
    while (i < wanted.length) {
      const chainId = wanted[i++]; const addr = addressOf(chainId);
      if (!addr) continue;
      try {
        if (chainId === 'solana') {
          try { res.collections.push(...(await fetchDas(env.solUrls(), addr, env.f))); res.sources[chainId] = 'Solana DAS'; }
          catch { res.collections.push(...(await fetchMagicEden(addr, env.f))); res.sources[chainId] = 'Magic Eden'; }
        } else {
          let cols: NftCollection[];
          if (alchemyAvailable(chainId)) {
            try { cols = await fetchAlchemyCollections(chainId, addr, env.f); res.sources[chainId] = 'Alchemy'; }
            catch { cols = await fetchBlockscoutCollections(chainId, addr, env.f); res.sources[chainId] = 'Blockscout'; }
          } else { cols = await fetchBlockscoutCollections(chainId, addr, env.f); res.sources[chainId] = 'Blockscout'; }
          if (env.rpcUrls) await fillMissingMetadata(cols, env.rpcUrls(chainId), env.f); // indexer had no metadata yet
          res.collections.push(...cols);
        }
      } catch (e: any) { res.errors.push({ chainId, error: String(e?.message ?? 'failed').slice(0, 160) }); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, wanted.length) }, worker));
  res.collections.sort((a, b) => Number(a.suspicious) - Number(b.suspicious) || b.owned - a.owned || a.name.localeCompare(b.name));
  return res;
}

/** Full item list of one collection (Blockscout pages through /nft; Solana already carries every item). */
export async function loadCollectionItems(env: NftEnv, c: Pick<NftCollection, 'chainId' | 'contract' | 'items'>, owner: string): Promise<NftItem[]> {
  if (c.chainId === 'solana' || isHarbourChain(c.chainId)) return c.items; // already complete
  const all = await fetchBlockscoutOwned(c.chainId, owner, c.contract, env.f);
  if (!all.length) return c.items;
  // keep metadata already resolved on-chain for the list, then resolve the rest
  const known = new Map(c.items.map((i) => [i.id, i]));
  const merged = all.map((i) => (i.image || !known.get(i.id)?.image ? i : { ...i, ...known.get(i.id)! }));
  if (env.rpcUrls) await fillMissingMetadata([{ ...(c as NftCollection), items: merged }], env.rpcUrls(c.chainId), env.f, 24);
  return merged;
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
