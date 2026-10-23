// ERC-20 helpers for custom tokens.
//
// Recovered from the Trust Wallet extension 26.41.0 (REA: background.js EVM service `fetchTokenOnChain`, custom-asset chunk):
//  * the asset is first looked up in TW's own index (`GET /v1/assets/c60_t<addr>`; 404 for unlisted tokens in
//    custom-token.har). That gateway needs a TW device credential, so Harbour does NOT call it.
//  * the fallback is on-chain: eth_call name() 0x06fdde03, symbol() 0x95d89b41, decimals() 0x313ce567 against the
//    contract, balance via balanceOf(address) 0x70a08231 [certain, same selectors seen in the HAR].
//  * an address that is not a token answers "0x" to those calls (HAR: every probe returned result "0x") => not valid.
// Deviations (Harbour): probes every supported EVM chain (TW's on-chain probe is limited to Ethereum + custom networks),
// accepts bytes32 name/symbol (MKR-style) as a fallback, and caps/cleans metadata so a hostile token cannot spoof the UI.
import { createPublicClient, custom, http, getAddress, isAddress, formatUnits, parseUnits, encodeFunctionData, type PublicClient } from 'viem';
import { rpcUrl } from './rpc';

export const ERC20_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;
const BYTES32_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
] as const;

export const MAX_DECIMALS = 36; // TW's manual form accepts 0..32; anything above 36 is not a real token.
export type ProbeFailure = 'INVALID_ADDRESS' | 'UNSUPPORTED_NETWORK' | 'NOT_A_CONTRACT' | 'NOT_A_TOKEN' | 'NETWORK_ERROR';
export interface TokenMeta { address: string; name: string; symbol: string; decimals: number }
export type ProbeResult = { ok: true; token: TokenMeta } | { ok: false; code: ProbeFailure; error: string };

// Strip control/format characters (incl. bidi overrides) and collapse whitespace; hostile contracts control these strings.
export const cleanText = (s: unknown, max: number): string =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

const bytes32ToString = (hex: string): string => {
  const b = hex.replace(/^0x/, ''); let out = '';
  for (let i = 0; i < b.length; i += 2) { const c = parseInt(b.slice(i, i + 2), 16); if (c === 0) break; out += String.fromCharCode(c); }
  return out;
};

export const clientFor = (chainId: number, timeoutMs = 8000): PublicClient | null => {
  const url = rpcUrl(chainId); if (!url) return null;
  return createPublicClient({ transport: http(url, { timeout: timeoutMs, retryCount: 1 }) }) as PublicClient;
};
// Test seam: a client over an arbitrary JSON-RPC handler.
export const clientFromRequest = (request: (a: { method: string; params?: any }) => Promise<any>): PublicClient => createPublicClient({ transport: custom({ request } as any) }) as PublicClient;

export const isNetworkError = (e: any): boolean => /fetch|network|timeout|timed out|HTTP request failed|Failed to fetch|ECONN|ENOTFOUND/i.test(String(e?.message ?? e)) && !/revert|returned no data|zero data|execution reverted/i.test(String(e?.shortMessage ?? e?.message ?? ''));

export async function probeToken(client: PublicClient | null, rawAddress: string): Promise<ProbeResult> {
  const addr = String(rawAddress ?? '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || !isAddress(addr, { strict: true })) return { ok: false, code: 'INVALID_ADDRESS', error: 'Enter a valid contract address.' };
  if (!client) return { ok: false, code: 'UNSUPPORTED_NETWORK', error: 'This network is not supported.' };
  const address = getAddress(addr.toLowerCase());
  try {
    const code = await client.getCode({ address });
    if (!code || code === '0x') return { ok: false, code: 'NOT_A_CONTRACT', error: 'No contract was found at this address on this network.' };
    const call = (fn: 'name' | 'symbol' | 'decimals') => client.readContract({ address, abi: ERC20_ABI, functionName: fn });
    const [n, s, d] = await Promise.allSettled([call('name'), call('symbol'), call('decimals')]);
    // A node/network failure must not be reported as "not a token".
    const rejected = [n, s, d].filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (rejected.length === 3 && rejected.every((r) => isNetworkError(r.reason))) return { ok: false, code: 'NETWORK_ERROR', error: 'Could not reach the network. Check your connection and try again.' };
    if (d.status !== 'fulfilled') return { ok: false, code: 'NOT_A_TOKEN', error: 'This contract does not look like a token (no decimals).' };
    const decimals = Number(d.value);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) return { ok: false, code: 'NOT_A_TOKEN', error: 'This contract reports invalid decimals.' };
    let name = n.status === 'fulfilled' ? cleanText(n.value, 64) : ''; let symbol = s.status === 'fulfilled' ? cleanText(s.value, 32) : '';
    if (!name || !symbol) {
      const [bn, bs] = await Promise.allSettled([
        client.readContract({ address, abi: BYTES32_ABI, functionName: 'name' }), client.readContract({ address, abi: BYTES32_ABI, functionName: 'symbol' })]);
      if (!name && bn.status === 'fulfilled') name = cleanText(bytes32ToString(bn.value as string), 64);
      if (!symbol && bs.status === 'fulfilled') symbol = cleanText(bytes32ToString(bs.value as string), 32);
    }
    if (!name || !symbol) return { ok: false, code: 'NOT_A_TOKEN', error: 'This contract does not return a token name and symbol.' };
    return { ok: true, token: { address, name, symbol, decimals } };
  } catch (e: any) {
    if (isNetworkError(e)) return { ok: false, code: 'NETWORK_ERROR', error: 'Could not reach the network. Check your connection and try again.' };
    return { ok: false, code: 'NOT_A_TOKEN', error: 'This contract does not look like a token.' };
  }
}

export async function tokenBalance(client: PublicClient, token: string, owner: string): Promise<bigint> {
  return (await client.readContract({ address: getAddress(token), abi: ERC20_ABI, functionName: 'balanceOf', args: [getAddress(owner)] })) as bigint;
}

// Exact decimal -> base units (no float math). Throws on bad input.
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const a = String(amount ?? '').trim();
  if (!/^\d*\.?\d*$/.test(a) || a === '' || a === '.') throw new Error('Enter a valid amount');
  const frac = a.split('.')[1] ?? '';
  if (frac.length > decimals) throw new Error(`This token supports at most ${decimals} decimal places`);
  const v = parseUnits(a, decimals);
  if (v <= 0n) throw new Error('Enter a valid amount');
  return v;
}
export const formatTokenAmount = (raw: bigint, decimals: number): string => formatUnits(raw, decimals);
export const encodeTransfer = (to: string, value: bigint): `0x${string}` => encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [getAddress(to), value] });
