// EVM NFTs through public Blockscout v2 instances: GET /api/v2/addresses/{addr}/nft/collections and /nft.
// Response shapes follow Blockscout's published OpenAPI (https://docs.blockscout.com/devs/apis/rest). Live responses UNVERIFIED here.
import type { Fetcher } from '../chains/adapters/types';
import { jsonGet } from '../chains/adapters/types';
import type { NftCollection, NftItem, NftStandard } from './types';
import { cleanText, mapAttributes, sanitizeLink, sanitizeMediaUrl } from './media';
import { isSuspiciousCollection } from './spam';

/** chain id (core/chains registry) -> public Blockscout base URL. `[verified-doc]` = listed on docs.blockscout.com, `[likely]` = explorer is Blockscout. */
export const BLOCKSCOUT_HOSTS: Record<string, string> = {
  ethereum: 'https://eth.blockscout.com', base: 'https://base.blockscout.com', optimism: 'https://optimism.blockscout.com', arbitrum: 'https://arbitrum.blockscout.com',
  polygon: 'https://polygon.blockscout.com', xdai: 'https://gnosis.blockscout.com', zksync: 'https://zksync.blockscout.com', scroll: 'https://scroll.blockscout.com',
  blast: 'https://blast.blockscout.com', celo: 'https://celo.blockscout.com', megaeth: 'https://megaeth.blockscout.com', sepolia: 'https://eth-sepolia.blockscout.com',
  mantle: 'https://explorer.mantle.xyz', kavaevm: 'https://explorer.kava.io', manta: 'https://pacific-explorer.manta.network', neon: 'https://neon.blockscout.com',
};
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const TYPES = 'ERC-721,ERC-1155';
const std = (t: unknown): NftStandard => (t === 'ERC-721' ? 'ERC-721' : t === 'ERC-1155' ? 'ERC-1155' : 'Unknown');
export const collectionKey = (chainId: string, contract: string) => `${chainId}:${contract.toLowerCase()}`;

export function mapBlockscoutInstance(chainId: string, tok: any, inst: any): NftItem | null {
  const contract = tok?.address_hash ?? tok?.address;
  const id = inst?.id;
  if (typeof contract !== 'string' || !ADDR.test(contract) || (typeof id !== 'string' && typeof id !== 'number')) return null;
  const tokenId = String(id);
  if (!/^\d{1,78}$/.test(tokenId)) return null;
  const md = inst?.metadata && typeof inst.metadata === 'object' ? inst.metadata : {};
  const collectionName = cleanText(tok?.name, 80);
  const standard = std(inst?.token_type ?? tok?.type);
  return {
    id: tokenId, collectionId: collectionKey(chainId, contract), chainId, contract,
    name: cleanText(md.name, 120) || `${collectionName || 'NFT'} #${tokenId.length > 12 ? tokenId.slice(0, 6) + '…' : tokenId}`,
    description: cleanText(md.description, 2000),
    image: sanitizeMediaUrl(inst?.image_url) || sanitizeMediaUrl(md.image) || sanitizeMediaUrl(md.image_url),
    animationUrl: sanitizeMediaUrl(inst?.animation_url) || sanitizeMediaUrl(md.animation_url),
    attributes: mapAttributes(md.attributes), standard,
    balance: /^\d+$/.test(String(inst?.value ?? '')) ? String(inst.value) : '1',
    externalUrl: sanitizeLink(inst?.external_app_url) || sanitizeLink(md.external_url),
    transferable: standard === 'ERC-721' || standard === 'ERC-1155',
  };
}
export function mapBlockscoutCollections(chainId: string, entries: any[]): NftCollection[] {
  const out: NftCollection[] = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    const tok = e?.token; const contract = tok?.address_hash ?? tok?.address;
    if (typeof contract !== 'string' || !ADDR.test(contract)) continue;
    const items = (Array.isArray(e.token_instances) ? (e.token_instances as any[]) : []).map((i: any) => mapBlockscoutInstance(chainId, tok, i)).filter((i: NftItem | null): i is NftItem => !!i);
    const name = cleanText(tok.name, 80) || 'Unnamed collection'; const symbol = cleanText(tok.symbol, 20);
    const owned = Number(e.amount);
    out.push({
      id: collectionKey(chainId, contract), chainId, contract, name, symbol, standard: std(tok.type),
      image: sanitizeMediaUrl(tok.icon_url) || items.find((i) => i.image)?.image || '',
      owned: Number.isFinite(owned) && owned > 0 ? owned : items.length, suspicious: isSuspiciousCollection(name, symbol), items,
    });
  }
  return out;
}
function nextQuery(p: any): string {
  if (!p || typeof p !== 'object') return '';
  const q = new URLSearchParams(); for (const [k, v] of Object.entries(p)) if (v != null && /^[\w.]+$/.test(k)) q.set(k, String(v));
  return q.toString();
}
export async function fetchBlockscoutCollections(chainId: string, address: string, f: Fetcher, maxPages = 3): Promise<NftCollection[]> {
  const host = BLOCKSCOUT_HOSTS[chainId]; if (!host) throw new Error('No public NFT indexer for this network');
  if (!ADDR.test(address)) throw new Error('Invalid address');
  const out: NftCollection[] = []; let extra = '';
  for (let page = 0; page < maxPages; page++) {
    const j = await jsonGet(f, `${host}/api/v2/addresses/${address}/nft/collections?type=${encodeURIComponent(TYPES)}${extra ? '&' + extra : ''}`, 12000);
    out.push(...mapBlockscoutCollections(chainId, j?.items));
    extra = nextQuery(j?.next_page_params); if (!extra) break;
  }
  return out;
}
/** All owned instances of one collection (pages through /nft and filters by contract). */
export async function fetchBlockscoutOwned(chainId: string, address: string, contract: string, f: Fetcher, maxPages = 8): Promise<NftItem[]> {
  const host = BLOCKSCOUT_HOSTS[chainId]; if (!host) throw new Error('No public NFT indexer for this network');
  if (!ADDR.test(address) || !ADDR.test(contract)) throw new Error('Invalid address');
  const out: NftItem[] = []; let extra = '';
  for (let page = 0; page < maxPages; page++) {
    const j = await jsonGet(f, `${host}/api/v2/addresses/${address}/nft?type=${encodeURIComponent(TYPES)}${extra ? '&' + extra : ''}`, 12000);
    for (const inst of Array.isArray(j?.items) ? j.items : []) {
      const c = inst?.token?.address_hash ?? inst?.token?.address;
      if (typeof c === 'string' && c.toLowerCase() === contract.toLowerCase()) { const m = mapBlockscoutInstance(chainId, inst.token, inst); if (m) out.push(m); }
    }
    extra = nextQuery(j?.next_page_params); if (!extra) break;
  }
  return out;
}
export const blockscoutInstanceUrl = (chainId: string, contract: string, id: string): string => {
  const h = BLOCKSCOUT_HOSTS[chainId]; return h && ADDR.test(contract) && /^\d+$/.test(id) ? `${h}/token/${contract}/instance/${id}` : '';
};
