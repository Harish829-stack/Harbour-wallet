// Native-balance fetch via viem. EVM chains share one secp256k1 address (the `ethereum`
// account), so one address covers ETH/BSC/Polygon/Arbitrum/Base/Sepolia.
// Tolerant by design: a failing chain yields ok:false, never throws (one dead RPC must not
// blank the whole home screen).
import { createPublicClient, http, formatEther } from 'viem';
import { rpcUrl } from './rpc';

export interface NativeBalance { chainId: number; wei: string; formatted: string; symbol: string; ok: boolean; }

const SYMBOL: Record<number, string> = { 1: 'ETH', 56: 'BNB', 137: 'POL', 42161: 'ETH', 8453: 'ETH', 11155111: 'ETH' };

export async function fetchNativeBalance(chainId: number, address: string): Promise<NativeBalance> {
  const base: NativeBalance = { chainId, wei: '0', formatted: '0', symbol: SYMBOL[chainId] ?? 'ETH', ok: false };
  const url = rpcUrl(chainId);
  if (!url || !address || !address.startsWith('0x')) return base;
  try {
    const client = createPublicClient({ transport: http(url, { timeout: 8000, retryCount: 1 }) });
    const wei = await client.getBalance({ address: address as `0x${string}` });
    return { ...base, wei: wei.toString(), formatted: formatEther(wei), ok: true };
  } catch {
    return base;
  }
}

// Fetch many chains in parallel for a single EVM address.
export async function fetchEvmBalances(chainIds: number[], evmAddress: string): Promise<Record<number, NativeBalance>> {
  const results = await Promise.all(chainIds.map((id) => fetchNativeBalance(id, evmAddress)));
  const out: Record<number, NativeBalance> = {};
  results.forEach((b) => { out[b.chainId] = b; });
  return out;
}
