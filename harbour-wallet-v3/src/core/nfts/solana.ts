// Solana NFTs: Metaplex DAS `getAssetsByOwner` on the configured RPC when it supports DAS (Helius/QuickNode/Triton…), else the
// Magic Eden public API. The default api.mainnet-beta.solana.com does NOT implement DAS — the caller then falls back.
import type { Fetcher } from '../chains/adapters/types';
import { jsonGet, jsonPost } from '../chains/adapters/types';
import type { NftCollection, NftItem } from './types';
import { cleanText, mapAttributes, sanitizeLink, sanitizeMediaUrl } from './media';
import { isSuspiciousCollection } from './spam';

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const NFT_INTERFACES = new Set(['V1_NFT', 'V2_NFT', 'ProgrammableNFT', 'LEGACY_NFT', 'MplCoreAsset']);
export const UNGROUPED = 'ungrouped';
export const solCollectionKey = (group: string) => `solana:${group}`;

export function mapDasAsset(a: any): { item: NftItem; group: string; groupName: string; groupImage: string } | null {
  if (!a || typeof a.id !== 'string' || !B58.test(a.id) || a.burnt) return null;
  if (!NFT_INTERFACES.has(String(a.interface))) return null;
  const md = a.content?.metadata ?? {};
  const grp = (Array.isArray(a.grouping) ? a.grouping : []).find((g: any) => g?.group_key === 'collection' && typeof g.group_value === 'string' && B58.test(g.group_value));
  const group = grp?.group_value ?? UNGROUPED;
  const files: any[] = Array.isArray(a.content?.files) ? a.content.files : [];
  const imgFile = files.find((f) => typeof f?.mime === 'string' && f.mime.startsWith('image/')) ?? files[0];
  const image = sanitizeMediaUrl(a.content?.links?.image) || sanitizeMediaUrl(imgFile?.cdn_uri) || sanitizeMediaUrl(imgFile?.uri);
  const compressed = !!a.compression?.compressed; const programmable = a.interface === 'ProgrammableNFT';
  const cm = grp?.collection_metadata ?? {};
  return {
    group, groupName: cleanText(cm.name, 80), groupImage: sanitizeMediaUrl(cm.image),
    item: {
      id: a.id, collectionId: solCollectionKey(group), chainId: 'solana', contract: group === UNGROUPED ? '' : group,
      name: cleanText(md.name, 120) || `NFT ${a.id.slice(0, 4)}…${a.id.slice(-4)}`, description: cleanText(md.description, 2000), image,
      animationUrl: sanitizeMediaUrl(a.content?.links?.animation_url), attributes: mapAttributes(md.attributes), standard: 'Metaplex', balance: '1',
      externalUrl: sanitizeLink(a.content?.links?.external_url), transferable: !compressed && !programmable,
    },
  };
}
export function groupSolana(rows: Array<{ item: NftItem; group: string; groupName: string; groupImage: string; fallbackName?: string }>): NftCollection[] {
  const by = new Map<string, NftCollection>();
  for (const r of rows) {
    let c = by.get(r.group);
    if (!c) {
      const name = r.groupName || r.fallbackName || (r.group === UNGROUPED ? 'Other NFTs' : `Collection ${r.group.slice(0, 4)}…${r.group.slice(-4)}`);
      c = { id: solCollectionKey(r.group), chainId: 'solana', contract: r.group === UNGROUPED ? '' : r.group, name, symbol: '', image: r.groupImage, owned: 0, standard: 'Metaplex', suspicious: isSuspiciousCollection(name, ''), items: [] };
      by.set(r.group, c);
    }
    c.items.push(r.item); c.owned++;
    if (!c.image && r.item.image) c.image = r.item.image;
  }
  return [...by.values()];
}
export async function fetchDas(urls: string[], owner: string, f: Fetcher, maxPages = 4): Promise<NftCollection[]> {
  if (!B58.test(owner)) throw new Error('Invalid address');
  let last: unknown = new Error('no RPC endpoint');
  for (const u of urls) {
    try {
      const rows: ReturnType<typeof mapDasAsset>[] = [];
      for (let page = 1; page <= maxPages; page++) {
        const j = await jsonPost(f, u, { jsonrpc: '2.0', id: 'harbour', method: 'getAssetsByOwner', params: { ownerAddress: owner, page, limit: 100, displayOptions: { showCollectionMetadata: true } } }, 15000);
        if (j?.error) throw new Error(j.error.message ?? 'DAS not supported');
        const items: any[] = j?.result?.items; if (!Array.isArray(items)) throw new Error('DAS not supported');
        rows.push(...items.map(mapDasAsset)); if (items.length < 100) break;
      }
      return groupSolana(rows.filter((r): r is NonNullable<typeof r> => !!r));
    } catch (e) { last = e; }
  }
  throw last;
}

// Magic Eden public API (api-mainnet.magiceden.dev/v2). May require an API key / be rate limited — errors are surfaced, never faked.
export const MAGIC_EDEN = 'https://api-mainnet.magiceden.dev/v2';
export function mapMagicEden(rows: any[]): NftCollection[] {
  const out: Array<{ item: NftItem; group: string; groupName: string; groupImage: string }> = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (typeof r?.mintAddress !== 'string' || !B58.test(r.mintAddress)) continue;
    const group = typeof r.collection === 'string' && r.collection ? `me-${r.collection.replace(/[^\w-]/g, '').slice(0, 60)}` : UNGROUPED;
    out.push({
      group, groupName: cleanText(r.collectionName ?? r.collectionTitle, 80), groupImage: '',
      item: { id: r.mintAddress, collectionId: solCollectionKey(group), chainId: 'solana', contract: '', name: cleanText(r.name, 120) || `NFT ${r.mintAddress.slice(0, 4)}…`, description: '', image: sanitizeMediaUrl(r.image),
        animationUrl: sanitizeMediaUrl(r.animationUrl), attributes: mapAttributes(r.attributes), standard: 'Metaplex', balance: '1', externalUrl: sanitizeLink(r.externalUrl), transferable: true },
    });
  }
  return groupSolana(out);
}
export async function fetchMagicEden(owner: string, f: Fetcher): Promise<NftCollection[]> {
  if (!B58.test(owner)) throw new Error('Invalid address');
  const j = await jsonGet(f, `${MAGIC_EDEN}/wallets/${owner}/tokens?offset=0&limit=500&listStatus=both`, 15000);
  return mapMagicEden(j);
}
