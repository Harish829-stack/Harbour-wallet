// Host-specific RPC wiring stays outside the pure protocol adapters.
import { createPublicClient, fallback, http } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { chainById } from '../../core/chains/index';
import { getPublicRpcUrls } from '../../core/chains/rpcUrls';
import { BASE_SEPOLIA, SEPOLIA } from './config';

/** Multicall batching for protocol reads: reads issued within `wait` ms share one eth_call (at most `batchSize` bytes of calldata). */
export const DEFI_MULTICALL = { wait: 16, batchSize: 4_096 } as const;

export function defiClient(networkId: string = SEPOLIA.id) {
  const target = networkId === BASE_SEPOLIA.id ? BASE_SEPOLIA : SEPOLIA;
  const chain = chainById(target.id);
  if (!chain) throw new Error(`${target.name} is not configured.`);
  // Protocol discovery is read-only and must not depend on the Harbour RPC proxy.
  // Some proxy providers reject Multicall3/large eth_call payloads, which surfaced
  // in the popup as opaque `window is not defined` viem errors. Use the configured
  // public Sepolia endpoints for Uniswap/Aave reads instead.
  const urls = getPublicRpcUrls(chain);
  if (!urls.length) throw new Error('No Sepolia RPC endpoint is configured.');
  // The Earn catalog reads ~7 values per reserve, all at once. One request each hit the public node's 25 req/s limit (29% answered
  // 429 in the 2026-11-19 runtime capture). Concurrent reads are therefore grouped into Multicall3 `aggregate3` calls (viem's
  // chain definitions pin the Multicall3 address); a failed read still fails alone. 429 answers are retried with backoff.
  return createPublicClient({
    chain: target.id === BASE_SEPOLIA.id ? baseSepolia : sepolia,
    batch: { multicall: DEFI_MULTICALL },
    transport: fallback(urls.map((url) => http(url, { timeout: 15_000, retryCount: 2, retryDelay: 400 }))),
  });
}
