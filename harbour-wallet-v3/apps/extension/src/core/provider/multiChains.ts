// Registry chain ids a site may connect to through the 'multi' namespace (no crypto imports: the page bundle uses this file).
/** Registry chain ids a site may connect to through this namespace, with the signing family each one follows. */
export const MULTI_CHAINS: Readonly<Record<string, { family: 'cosmos' | 'sui' | 'aptos' | 'tron' | 'btc' | 'ton'; cosmosChainId?: string; name: string }>> = Object.freeze({
  cosmos: { family: 'cosmos', cosmosChainId: 'cosmoshub-4', name: 'Cosmos Hub' }, osmosis: { family: 'cosmos', cosmosChainId: 'osmosis-1', name: 'Osmosis' },
  juno: { family: 'cosmos', cosmosChainId: 'juno-1', name: 'Juno' }, stride: { family: 'cosmos', cosmosChainId: 'stride-1', name: 'Stride' },
  axelar: { family: 'cosmos', cosmosChainId: 'axelar-dojo-1', name: 'Axelar' }, neutron: { family: 'cosmos', cosmosChainId: 'neutron-1', name: 'Neutron' },
  sei: { family: 'cosmos', cosmosChainId: 'pacific-1', name: 'Sei' }, akash: { family: 'cosmos', cosmosChainId: 'akashnet-2', name: 'Akash' },
  terra: { family: 'cosmos', cosmosChainId: 'columbus-5', name: 'Terra Classic' }, agoric: { family: 'cosmos', cosmosChainId: 'agoric-3', name: 'Agoric' },
  kava: { family: 'cosmos', cosmosChainId: 'kava_2222-10', name: 'Kava' },
  sui: { family: 'sui', name: 'Sui' }, aptos: { family: 'aptos', name: 'Aptos' }, tron: { family: 'tron', name: 'Tron' }, ton: { family: 'ton', name: 'TON' }, bitcoin: { family: 'btc', name: 'Bitcoin' },
});
export const isMultiChain = (c: unknown): c is string => typeof c === 'string' && Object.prototype.hasOwnProperty.call(MULTI_CHAINS, c);
/** Keplr dApps address chains by their Cosmos chain-id string. */
export function chainOfCosmosId(chainId: unknown): string | null { for (const [k, v] of Object.entries(MULTI_CHAINS)) if (v.cosmosChainId === chainId) return k; return null; }

