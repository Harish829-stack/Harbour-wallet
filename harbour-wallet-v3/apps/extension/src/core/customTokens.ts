// Custom-token model (TW: `isUserCustomAsset` assets, added with ADD_ASSET into the active wallet's asset list).
// Tokens are stored per wallet inside the encrypted vault state (`wallets[walletId].customTokens`), never in plain storage.
import { getAddress, isAddress } from 'viem';
import { CHAINS, TESTNETS } from './chains';
import { cleanText, MAX_DECIMALS } from './erc20';
import { customNetworks } from './networkRegistry';

export interface CustomToken { id: string; chainId: number; networkId: string; address: string; name: string; symbol: string; decimals: number; manual: boolean; addedAt: number;
  /** Non-EVM tokens only (Solana SPL / Tron TRC-20): registry chain id + token standard. `chainId` then holds the chain's wallet-core coin id. */
  chain?: string; standard?: string }
export const MAX_TOKENS = 100;

// Networks a token can be added on: every EVM chain Harbour supports (TW: networks with `customTokensEnabled`).
const BUILTIN_NETWORKS = [...CHAINS, ...TESTNETS].filter((c) => c.kind === 'evm' && c.chainId);
// Built-in EVM chains plus the user's custom networks (see core/networkRegistry.ts).
export const tokenNetworks = () => [...BUILTIN_NETWORKS, ...customNetworks().map((n) => ({ id: `custom-${n.chainId}`, name: n.name, ct: 'ethereum', kind: 'evm' as const, chainId: n.chainId, testnet: false, custom: true }))];
export const TOKEN_NETWORKS = BUILTIN_NETWORKS; // legacy export (built-ins only)
export const networkByChainId = (chainId?: number) => tokenNetworks().find((n) => n.chainId === chainId);
export const tokenId = (chainId: number, address: string) => `${chainId}_t${address.toLowerCase()}`;

export type SanitizeResult = { ok: true; token: CustomToken } | { ok: false; error: string };
export function sanitizeToken(input: any, now = Date.now()): SanitizeResult {
  const chainId = Number(input?.chainId); const net = networkByChainId(chainId);
  if (!net) return { ok: false, error: 'Unsupported network' };
  const raw = String(input?.address ?? '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw) || !isAddress(raw, { strict: true })) return { ok: false, error: 'Invalid contract address' };
  const address = getAddress(raw.toLowerCase());
  const name = cleanText(input?.name, 64); const symbol = cleanText(input?.symbol, 32);
  if (!name) return { ok: false, error: 'Token name is required' };
  if (!symbol) return { ok: false, error: 'Token symbol is required' };
  const decimals = Number(input?.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) return { ok: false, error: `Decimals must be a whole number from 0 to 32` };
  if (decimals > 32) return { ok: false, error: 'Decimals must be a whole number from 0 to 32' };
  return { ok: true, token: { id: tokenId(chainId, address), chainId, networkId: net.id, address, name, symbol, decimals, manual: input?.manual === true, addedAt: now } };
}

export const readTokens = (list: unknown): CustomToken[] => (Array.isArray(list) ? list : []).filter((t): t is CustomToken =>
  !!t && typeof t.id === 'string' && typeof t.address === 'string' && typeof t.chainId === 'number' && typeof t.decimals === 'number' && !!networkByChainId(t.chainId));

export function upsertToken(list: CustomToken[], t: CustomToken): { list: CustomToken[]; existed: boolean } | { error: string } {
  const i = list.findIndex((x) => x.id === t.id);
  if (i >= 0) { const next = list.slice(); next[i] = { ...t, addedAt: list[i].addedAt }; return { list: next, existed: true }; }
  if (list.length >= MAX_TOKENS) return { error: `You can add up to ${MAX_TOKENS} custom tokens` };
  return { list: [...list, t], existed: false };
}
export const removeToken = (list: CustomToken[], id: string): CustomToken[] => list.filter((t) => t.id !== id);
