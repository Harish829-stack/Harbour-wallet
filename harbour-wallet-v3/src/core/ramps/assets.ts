// Ramp-able assets, derived from the live chain registry (natives) plus USDT/USDC on the networks where providers carry them.
// Provider-side codes live in providers.ts; an asset only shows a provider when that provider has a mapping for it.
import { ALL_CHAINS, chainById } from '../chains/index';
import type { RampAsset } from './types';

export const RAMP_TOKENS: ReadonlyArray<{ symbol: 'USDT' | 'USDC'; name: string; cg: string; chains: readonly string[] }> = [
  { symbol: 'USDT', name: 'Tether', cg: 'tether', chains: ['ethereum', 'smartchain', 'polygon', 'arbitrum', 'optimism', 'avalanchec', 'solana', 'tron', 'ton'] },
  { symbol: 'USDC', name: 'USD Coin', cg: 'usd-coin', chains: ['ethereum', 'smartchain', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanchec', 'solana'] },
];

export const tokenAssetId = (chainId: string, symbol: string) => `${chainId}:${symbol}`;

export function buildRampAssets(chainIds?: readonly string[]): RampAsset[] {
  const allow = chainIds ? new Set(chainIds) : null;
  const out: RampAsset[] = [];
  for (const c of ALL_CHAINS) {
    if (allow && !allow.has(c.id)) continue;
    out.push({ assetId: c.id, symbol: c.symbol, name: c.name, chainId: c.id, chainName: c.name, isNative: true, cg: c.cg });
  }
  for (const t of RAMP_TOKENS) for (const id of t.chains) {
    const c = chainById(id); if (!c || (allow && !allow.has(id))) continue;
    out.push({ assetId: tokenAssetId(id, t.symbol), symbol: t.symbol, name: t.name, chainId: id, chainName: c.name, isNative: false, cg: t.cg });
  }
  return out;
}
export function rampAssetById(assetId: string): RampAsset | undefined {
  if (typeof assetId !== 'string') return undefined;
  const [chainId, sym] = assetId.split(':');
  const c = chainById(chainId); if (!c || c.testnet) return undefined;
  if (!sym) return { assetId: c.id, symbol: c.symbol, name: c.name, chainId: c.id, chainName: c.name, isNative: true, cg: c.cg };
  const t = RAMP_TOKENS.find((x) => x.symbol === sym && x.chains.includes(chainId));
  return t ? { assetId, symbol: t.symbol, name: t.name, chainId, chainName: c.name, isNative: false, cg: t.cg } : undefined;
}
