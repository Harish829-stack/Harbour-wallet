// NFTs the user has imported ("Import NFT": network + contract + token id), like MetaMask's manual import. The wallet lists, fetches
// and tracks history for these and nothing else: no indexer sweep of everything the address happens to hold.
import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';
import type { Fetcher } from '../chains/adapters/types';
import { ethCall } from '../staking/evm';
import type { NftCollection, NftItem } from './types';
import { cleanText } from './media';

export interface AddedNft { chainId: string; contract: string; tokenId: string; addedAt: number }
export const MAX_ADDED_NFTS = 500;
export const nftKey = (chainId: string, contract: string, tokenId: string): string => `${chainId}:${contract.toLowerCase()}:${tokenId}`;
export const keyOf = (n: Pick<AddedNft, 'chainId' | 'contract' | 'tokenId'>): string => nftKey(n.chainId, n.contract, n.tokenId);

export function sanitizeAdded(input: any, now = Date.now()): { ok: true; nft: AddedNft } | { ok: false; error: string } {
  const chainId = typeof input?.chainId === 'string' ? input.chainId : '';
  const contract = typeof input?.contract === 'string' ? input.contract.trim() : '';
  const tokenId = typeof input?.tokenId === 'string' || typeof input?.tokenId === 'number' ? String(input.tokenId).trim() : '';
  if (!/^[a-z0-9-]{2,40}$/.test(chainId)) return { ok: false, error: 'Choose a network.' };
  if (!/^0x[0-9a-fA-F]{40}$/.test(contract)) return { ok: false, error: 'Enter a valid contract address (0x followed by 40 characters).' };
  if (!/^\d{1,78}$/.test(tokenId)) return { ok: false, error: 'Enter the token ID as a number.' };
  return { ok: true, nft: { chainId, contract: contract.toLowerCase(), tokenId: BigInt(tokenId).toString(), addedAt: now } };
}
export const readAdded = (raw: unknown): AddedNft[] => (Array.isArray(raw) ? raw : []).filter((n): n is AddedNft => !!n && typeof n.chainId === 'string' && typeof n.contract === 'string' && typeof n.tokenId === 'string').slice(0, MAX_ADDED_NFTS);
export const addedKeys = (list: AddedNft[]): Set<string> => new Set(list.map(keyOf));

/** Keep only imported items; collections left without items disappear, `owned` follows the kept items. */
export function keepAdded(cols: NftCollection[], keys: Set<string>): NftCollection[] {
  const out: NftCollection[] = [];
  for (const c of cols) {
    const items = c.items.filter((i) => keys.has(nftKey(i.chainId, i.contract, i.id)));
    if (items.length) out.push({ ...c, items, owned: items.length });
  }
  return out;
}

const erc721 = parseAbi(['function ownerOf(uint256) view returns (address)', 'function name() view returns (string)', 'function symbol() view returns (string)']);
const erc1155 = parseAbi(['function balanceOf(address,uint256) view returns (uint256)']);
export type Ownership = { owned: true; standard: 'ERC-721' | 'ERC-1155'; balance: string } | { owned: false; readable: boolean };

/** Reads who owns the token on chain (ERC-721 ownerOf, else ERC-1155 balanceOf). `readable` is false when neither call works. */
export async function checkOwnership(f: Fetcher, rpcs: string[], n: Pick<AddedNft, 'contract' | 'tokenId'>, owner: string): Promise<Ownership> {
  const id = BigInt(n.tokenId);
  try {
    const raw = await ethCall(f, rpcs, n.contract, encodeFunctionData({ abi: erc721, functionName: 'ownerOf', args: [id] }));
    const who = decodeFunctionResult({ abi: erc721, functionName: 'ownerOf', data: raw }) as string;
    return who.toLowerCase() === owner.toLowerCase() ? { owned: true, standard: 'ERC-721', balance: '1' } : { owned: false, readable: true };
  } catch { /* not an ERC-721 (or the token does not exist): try ERC-1155 */ }
  try {
    const raw = await ethCall(f, rpcs, n.contract, encodeFunctionData({ abi: erc1155, functionName: 'balanceOf', args: [owner as `0x${string}`, id] }));
    const bal = decodeFunctionResult({ abi: erc1155, functionName: 'balanceOf', data: raw }) as bigint;
    return bal > 0n ? { owned: true, standard: 'ERC-1155', balance: bal.toString() } : { owned: false, readable: true };
  } catch { return { owned: false, readable: false }; }
}

async function readText(f: Fetcher, rpcs: string[], contract: string, fn: 'name' | 'symbol'): Promise<string> {
  try { const raw = await ethCall(f, rpcs, contract, encodeFunctionData({ abi: erc721, functionName: fn })); return cleanText(decodeFunctionResult({ abi: erc721, functionName: fn, data: raw }) as string, 64); } catch { return ''; }
}

/** Imported NFTs the indexer did not return (fresh mint, lagging or unsupported indexer): built from the chain itself. */
export async function stubCollections(f: Fetcher, rpcsOf: (chainId: string) => string[], ownerOf: (chainId: string) => string, missing: AddedNft[]): Promise<NftCollection[]> {
  const byCol = new Map<string, NftCollection>();
  await Promise.all(missing.map(async (n) => {
    const rpcs = rpcsOf(n.chainId); const owner = ownerOf(n.chainId); if (!rpcs.length || !owner) return;
    const own = await checkOwnership(f, rpcs, n, owner); if (!own.owned) return;
    const colId = `${n.chainId}:${n.contract}`;
    let c = byCol.get(colId);
    if (!c) { const [name, symbol] = await Promise.all([readText(f, rpcs, n.contract, 'name'), readText(f, rpcs, n.contract, 'symbol')]); c = { id: colId, chainId: n.chainId, contract: n.contract, name: name || 'Collection', symbol, image: '', owned: 0, standard: own.standard, suspicious: false, items: [] }; byCol.set(colId, c); }
    const item: NftItem = { id: n.tokenId, collectionId: colId, chainId: n.chainId, contract: n.contract, name: `${c.name} #${n.tokenId}`, description: '', image: '', animationUrl: '', attributes: [], standard: own.standard, balance: own.balance, externalUrl: '', transferable: true };
    c.items.push(item); c.owned += 1;
  }));
  return [...byCol.values()];
}
