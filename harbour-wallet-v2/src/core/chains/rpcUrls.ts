import type { ChainInfo } from './types';
import { rpcOverride } from '../networkRegistry';
import { gatewayRpc, configRpcs } from '../rpc';
/** Ordered JSON-RPC URLs for an EVM chain: user override / custom network first, then env override, then the registry's public list. */
export function getRpcUrls(chain: ChainInfo): string[] {
  const out: string[] = [];
  const id = chain.evmChainId;
  if (id != null) {
    const o = rpcOverride(id); if (o) out.push(o);
    const env = (import.meta as any).env?.[`VITE_RPC_${id}`]; if (typeof env === 'string') for (const u of env.split(',').map((x) => x.trim())) if (/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1))/.test(u) && !out.includes(u)) out.push(u);
  }
  const gw = id != null ? gatewayRpc(id) : undefined; if (gw && !out.includes(gw)) out.push(gw); // keyed Alchemy via the gateway, ahead of the public list
  for (const u of [...(chain.rpcs ?? []), ...(id != null ? configRpcs(id) : [])]) if (!out.includes(u)) out.push(u);
  return out;
}
