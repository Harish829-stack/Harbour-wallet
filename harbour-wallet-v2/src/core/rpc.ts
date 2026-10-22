// Per-chain JSON-RPC endpoints. The URL lists live in src/config/rpcEndpoints.json (not in components).
// Order for a chain: user override, VITE_RPC_<chainId> (comma-separated list allowed), the keyed gateway, then the public providers in the config file.
// RE note (§7): Trust Wallet routes RPC through its own NaaS gateway; Harbour uses the gateway plus direct public RPC with automatic failover (kit/failoverFetch.ts).
import endpoints from '../config/rpcEndpoints.json';
const CONFIG_EVM = endpoints.evm as Record<string, string[]>;
/** Public fallback RPC URLs from the config file for an EVM chain (empty when the chain is not configured). */
export const configRpcs = (chainId: number): string[] => CONFIG_EVM[String(chainId)] ?? [];
const envList = (v: unknown): string[] => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter((x) => /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1))/.test(x)) : []);

import { rpcOverride } from './networkRegistry';
import { GATEWAY_URL } from '../kit/endpoints';
// Chains the gateway proxies through its server-held Alchemy key (see gateway/worker.ts ALCHEMY_HOSTS).
export const GATEWAY_EVM_CHAINS = new Set([1, 56, 137, 42161, 8453, 10]);
export const gatewayRpc = (chainId: number): string | undefined => (GATEWAY_URL && GATEWAY_EVM_CHAINS.has(chainId) ? `${GATEWAY_URL}/alchemy/${chainId}/rpc` : undefined);
export function rpcUrl(chainId: number): string | undefined { return rpcUrlList(chainId)[0]; }

/** Ordered RPC URLs for a chain: user override, env, the gateway (keyed Alchemy), then the configured public providers. */
export function rpcUrlList(chainId: number): string[] {
  const out: string[] = [];
  const o = rpcOverride(chainId); if (o) out.push(o);
  out.push(...envList((import.meta as any).env?.[`VITE_RPC_${chainId}`]));
  const gw = gatewayRpc(chainId); if (gw) out.push(gw);
  out.push(...configRpcs(chainId));
  return [...new Set(out)];
}

/** Ordered Solana JSON-RPC URLs: env (VITE_RPC_SOLANA, comma-separated), the keyed gateway, then the configured public providers. */
export function solanaRpcUrls(): string[] {
  const out = envList((import.meta as any).env?.VITE_RPC_SOLANA);
  if (GATEWAY_URL) out.push(`${GATEWAY_URL}/helius/rpc`);
  out.push(...(endpoints.solana as string[]));
  return [...new Set(out)];
}
export const solanaRpcUrl = (): string => solanaRpcUrls()[0];
// MEV-protected broadcast endpoints (TW "Best price execution" / "MEV protection" setting).
// How TW itself implements this is UNKNOWN (it submits through its own backend); Harbour broadcasts
// through public private-mempool RPCs where they exist and falls back to the normal RPC elsewhere.
const PROTECTED_RPC = endpoints.protected as Record<string, string>;
export const protectedRpcUrl = (chainId: number): string | undefined => PROTECTED_RPC[String(chainId)];
