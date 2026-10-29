// "Only what I added": the activity feed shows the native coin, the user's own swaps/contract calls, and movements of tokens and NFTs
// the user has added to this wallet. Airdropped or unknown tokens never appear (they can still be added by contract address, and then
// their history appears). Pure: the sets come from the wallet (background/activityRuntime.ts).
import type { HistoryItem } from '../txHistory';

export interface AssetAllow { tokens: Set<string>; nfts: Set<string> }
export const tokenKey = (network: string, address: string): string => `${network}:${address.toLowerCase()}`;
export const emptyAllow = (): AssetAllow => ({ tokens: new Set(), nfts: new Set() });

export function filterByAddedAssets(items: HistoryItem[], allow: AssetAllow): HistoryItem[] {
  return items.filter((it) => {
    if (it.kind === 'swap' || it.swap) return true;                      // the user's own swap
    if (it.tokenId != null && it.tokenId !== '') return !!it.token?.address && allow.nfts.has(`${it.assetId}:${it.token.address.toLowerCase()}:${it.tokenId}`);
    if (it.token) return !!it.token.address && allow.tokens.has(tokenKey(it.assetId, it.token.address));
    return true;                                                          // native coin, contract calls without a token leg
  });
}

/** Allow-lists from a decrypted wallet entry plus the wallet's imported NFTs. */
export function allowFromWallet(w: any, nftKeys: Iterable<string>): AssetAllow {
  const a = emptyAllow();
  for (const t of Array.isArray(w?.customTokens) ? w.customTokens : []) if (t && typeof t.networkId === 'string' && typeof t.address === 'string') a.tokens.add(tokenKey(t.networkId, t.address));
  for (const t of Array.isArray(w?.customChainTokens) ? w.customChainTokens : []) if (t && typeof t.chain === 'string' && typeof t.address === 'string') a.tokens.add(tokenKey(t.chain, t.address));
  for (const k of nftKeys) a.nfts.add(k);
  return a;
}
