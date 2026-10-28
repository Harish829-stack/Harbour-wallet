// On-chain metadata fallback for EVM NFTs. Indexers (Blockscout, Alchemy) fetch token metadata lazily, so fresh mints and
// testnet tokens often arrive without name/image. Harbour then reads tokenURI (ERC-721) / uri (ERC-1155) over the chain's
// public RPC and loads the JSON itself (https, ipfs:// via gateway, or inline data: JSON). Metadata stays untrusted:
// every field goes through the same sanitisers as indexer data.
import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';
import type { Fetcher } from '../chains/adapters/types';
import { ethCall } from '../staking/evm';
import type { NftCollection } from './types';
import { cleanText, mapAttributes, sanitizeLink, sanitizeMediaUrl, IPFS_GATEWAY } from './media';

const abi = parseAbi(['function tokenURI(uint256 tokenId) view returns (string)', 'function uri(uint256 id) view returns (string)']);
const MAX_JSON = 200_000;

/** Turn a token URI into a fetchable https URL or the inline JSON text; '' when unusable. */
export function resolveTokenUri(uri: string, tokenId: string): { url?: string; inline?: string } {
  let u = String(uri ?? '').trim().replace(/\{id\}/gi, BigInt(tokenId).toString(16).padStart(64, '0')); // ERC-1155 template
  if (!u) return {};
  const m = /^data:application\/json(;charset=[\w-]+)?(;base64)?,(.*)$/is.exec(u);
  if (m) { try { return { inline: m[2] ? atob(m[3]) : decodeURIComponent(m[3]) }; } catch { return {}; } }
  if (/^ipfs:\/\//i.test(u)) u = IPFS_GATEWAY + u.slice(7).replace(/^ipfs\//i, '');
  try { const p = new URL(u); return p.protocol === 'https:' ? { url: p.toString() } : {}; } catch { return {}; }
}

async function readUri(f: Fetcher, urls: string[], contract: string, tokenId: string, standard: string): Promise<string> {
  const fn = standard === 'ERC-1155' ? 'uri' : 'tokenURI';
  const raw = await ethCall(f, urls, contract, encodeFunctionData({ abi, functionName: fn, args: [BigInt(tokenId)] }));
  return decodeFunctionResult({ abi, functionName: fn, data: raw }) as string;
}

/** Fill missing name/image/description/attributes for up to `limit` items in place. Never throws. */
export async function fillMissingMetadata(cols: NftCollection[], rpcUrls: string[], f: Fetcher, limit = 12): Promise<void> {
  if (!rpcUrls.length) return;
  const todo = cols.flatMap((c) => c.items.filter((i) => !i.image).map((i) => ({ c, i }))).slice(0, limit);
  await Promise.all(todo.map(async ({ c, i }) => {
    try {
      const r = resolveTokenUri(await readUri(f, rpcUrls, i.contract, i.id, i.standard), i.id);
      let text = r.inline;
      if (!text && r.url) { const res = await f(r.url, { signal: AbortSignal.timeout(8000) }); if (!res.ok) return; text = await res.text(); }
      if (!text || text.length > MAX_JSON) return;
      const md = JSON.parse(text);
      if (!md || typeof md !== 'object') return;
      const generic = /#\S+$/.test(i.name) && i.name.startsWith(c.name === 'Unnamed collection' ? 'NFT' : c.name);
      if (generic && cleanText(md.name, 120)) i.name = cleanText(md.name, 120);
      if (!i.description) i.description = cleanText(md.description, 2000);
      i.image = sanitizeMediaUrl(md.image) || sanitizeMediaUrl(md.image_url) || sanitizeMediaUrl(md.image_data?.startsWith?.('data:') ? md.image_data : '');
      if (!i.animationUrl) i.animationUrl = sanitizeMediaUrl(md.animation_url);
      if (!i.attributes.length) i.attributes = mapAttributes(md.attributes);
      if (!i.externalUrl) i.externalUrl = sanitizeLink(md.external_url);
    } catch { /* leave the placeholder */ }
  }));
  for (const c of cols) if (!c.image) c.image = c.items.find((x) => x.image)?.image ?? '';
}
