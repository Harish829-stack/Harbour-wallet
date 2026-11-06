// Host-specific RPC wiring stays outside the pure protocol adapters.
import { createPublicClient, fallback, http } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { chainById } from '../../core/chains/index';
import { getPublicRpcUrls } from '../../core/chains/rpcUrls';
import { BASE_SEPOLIA, SEPOLIA } from './config';

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
  return createPublicClient({ chain: target.id === BASE_SEPOLIA.id ? baseSepolia : sepolia, transport: fallback(urls.map((url) => http(url, { timeout: 15_000, retryCount: 1 }))) });
}
