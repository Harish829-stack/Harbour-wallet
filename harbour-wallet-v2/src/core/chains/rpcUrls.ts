import type { ChainInfo } from './types';
import { rpcOverride } from '../networkRegistry';
/** Ordered JSON-RPC URLs for an EVM chain: user override / custom network first, then env override, then the registry's public list. */
export function getRpcUrls(chain: ChainInfo): string[] {
  const out: string[] = [];
  const id = chain.evmChainId;
  if (id != null) {
    const o = rpcOverride(id); if (o) out.push(o);
    const env = (import.meta as any).env?.[`VITE_RPC_${id}`]; if (typeof env === 'string' && env) out.push(env);
  }
  for (const u of chain.rpcs ?? []) if (!out.includes(u)) out.push(u);
  return out;
}
