// NFT domain types (pure). Data comes from public indexers (Blockscout v2 for EVM, Solana DAS / Magic Eden) — see evidences/re-evidence/35-nfts.
export type NftStandard = 'ERC-721' | 'ERC-1155' | 'Metaplex' | 'Unknown';
export interface NftAttribute { key: string; value: string }
export interface NftItem {
  /** Token id (EVM) or mint address (Solana); unique within the collection. */
  id: string;
  collectionId: string;
  chainId: string;
  contract: string;
  name: string;
  description: string;
  /** Sanitised https/data:image URL or '' (render a placeholder). */
  image: string;
  animationUrl: string;
  attributes: NftAttribute[];
  standard: NftStandard;
  /** Owned quantity (always '1' for ERC-721 / Metaplex). */
  balance: string;
  externalUrl: string;
  /** Compressed / programmable NFTs cannot be transferred by Harbour's basic transfer. */
  transferable: boolean;
}
export interface NftCollection {
  /** `${chainId}:${contract-or-collection-key}` — stable across refreshes. */
  id: string;
  chainId: string;
  contract: string;
  name: string;
  symbol: string;
  image: string;
  owned: number;
  standard: NftStandard;
  /** Heuristic spam flag (see spam.ts); drives the default "hidden" bucket, never a deletion. */
  suspicious: boolean;
  /** Collection floor in the chain's native coin (Alchemy's OpenSea metadata); absent when unknown. */
  floorPrice?: number;
  items: NftItem[];
}
export interface NftReportState { hidden: string[]; shown: string[] }
export const emptyReportState = (): NftReportState => ({ hidden: [], shown: [] });
