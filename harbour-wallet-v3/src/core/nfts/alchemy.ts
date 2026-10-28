// EVM NFTs through the Alchemy NFT API v3, proxied by harbour-gateway (the key never leaves the gateway). Primary source when a
// gateway is configured; service.ts falls back to Blockscout on any failure or malformed response. Shapes follow Alchemy's docs;
// confirm with `tools/check-gateway.mjs` (live).
import type { Fetcher } from '../chains/adapters/types';
import { jsonGet } from '../chains/adapters/types';
import type { NftCollection, NftItem, NftStandard } from './types';
import { cleanText, mapAttributes, sanitizeLink, sanitizeMediaUrl } from './media';
import { isSuspiciousCollection } from './spam';
import { collectionKey } from './blockscout';
import { GATEWAY_URL } from '../../kit/endpoints';

/** Harbour chain id -> EVM chain id for the chains the gateway serves through Alchemy. */
export const ALCHEMY_NFT_CHAINS: Record<string, number> = { ethereum: 1, base: 8453, polygon: 137, arbitrum: 42161, optimism: 10 };
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const std = (t: unknown): NftStandard => (t === 'ERC721' ? 'ERC-721' : t === 'ERC1155' ? 'ERC-1155' : 'Unknown');
const truthy = (v: unknown) => v === true || v === 'true';

export function mapAlchemyOwned(chainId: string, ownedNfts: any[]): NftCollection[] {
  const byContract = new Map<string, NftCollection & { _spam: boolean }>();
  for (const n of Array.isArray(ownedNfts) ? ownedNfts : []) {
    const contract = n?.contract?.address; const tokenId = String(n?.tokenId ?? '');
    if (typeof contract !== 'string' || !ADDR.test(contract) || !/^\d{1,78}$/.test(tokenId)) continue;
    const standard = std(n.tokenType ?? n.contract?.tokenType);
    const md = n?.raw?.metadata && typeof n.raw.metadata === 'object' ? n.raw.metadata : {};
    const colName = cleanText(n.contract?.name ?? n.contract?.openSeaMetadata?.collectionName, 80);
    const item: NftItem = {
      id: tokenId, collectionId: collectionKey(chainId, contract), chainId, contract,
      name: cleanText(n.name, 120) || `${colName || 'NFT'} #${tokenId.length > 12 ? tokenId.slice(0, 6) + '…' : tokenId}`,
      description: cleanText(n.description, 2000),
      image: sanitizeMediaUrl(n.image?.cachedUrl) || sanitizeMediaUrl(n.image?.originalUrl) || sanitizeMediaUrl(n.image?.thumbnailUrl),
      animationUrl: sanitizeMediaUrl(n.animation?.cachedUrl) || sanitizeMediaUrl(n.animation?.originalUrl),
      attributes: mapAttributes(md.attributes), standard,
      balance: /^\d+$/.test(String(n.balance ?? '')) ? String(n.balance) : '1',
      externalUrl: sanitizeLink(md.external_url),
      transferable: standard === 'ERC-721' || standard === 'ERC-1155',
    };
    const key = collectionKey(chainId, contract);
    let c = byContract.get(key);
    if (!c) {
      const name = colName || 'Unnamed collection'; const symbol = cleanText(n.contract?.symbol, 20);
      const floor = Number(n.contract?.openSeaMetadata?.floorPrice);
      c = { id: key, chainId, contract, name, symbol, standard, image: sanitizeMediaUrl(n.contract?.openSeaMetadata?.imageUrl), owned: 0, suspicious: false, items: [], _spam: truthy(n.contract?.isSpam), ...(Number.isFinite(floor) && floor > 0 && floor < 1e6 ? { floorPrice: floor } : {}) };
      byContract.set(key, c);
    }
    c.items.push(item); c.owned += Number(item.balance) || 1;
  }
  return [...byContract.values()].map(({ _spam, ...c }) => ({ ...c, image: c.image || c.items.find((i) => i.image)?.image || '', suspicious: _spam || isSuspiciousCollection(c.name, c.symbol) }));
}

export const alchemyAvailable = (chainId: string) => GATEWAY_URL !== '' && chainId in ALCHEMY_NFT_CHAINS;

export async function fetchAlchemyCollections(chainId: string, address: string, f: Fetcher, maxPages = 4): Promise<NftCollection[]> {
  const evm = ALCHEMY_NFT_CHAINS[chainId];
  if (!GATEWAY_URL || !evm) throw new Error('Alchemy NFT API unavailable');
  if (!ADDR.test(address)) throw new Error('Invalid address');
  const owned: any[] = []; let pageKey = '';
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ owner: address, withMetadata: 'true', pageSize: '100' }); if (pageKey) q.set('pageKey', pageKey);
    const j = await jsonGet(f, `${GATEWAY_URL}/alchemy/${evm}/nft/getNFTsForOwner?${q}`, 15000);
    if (!Array.isArray(j?.ownedNfts)) throw new Error('Unexpected Alchemy response');
    owned.push(...j.ownedNfts);
    pageKey = typeof j.pageKey === 'string' ? j.pageKey : ''; if (!pageKey) break;
  }
  return mapAlchemyOwned(chainId, owned);
}
