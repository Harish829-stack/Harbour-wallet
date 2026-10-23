// EVM networks a dApp can use: Harbour's chain registry (Trust Wallet's 86 chains + Sepolia) plus the user's custom networks.
import { ALL_CHAINS, TESTNET_CHAINS, type ChainInfo } from '../../core/chains/index';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { customNetworks, rpcOverride } from '../../core/networkRegistry';

export interface EvmNetwork { chainId: number; id: string; name: string; symbol: string; decimals: number; rpcs: string[]; explorer?: string; txPath?: string; accountPath?: string; testnet: boolean; custom: boolean }
const fromChain = (c: ChainInfo): EvmNetwork => ({ chainId: c.evmChainId!, id: c.id, name: c.name, symbol: c.symbol, decimals: c.decimals, rpcs: getRpcUrls(c), explorer: c.explorer, txPath: c.txPath, accountPath: c.accountPath, testnet: !!c.testnet, custom: false });
export function evmNetworks(): EvmNetwork[] {
  const builtin = [...ALL_CHAINS, ...TESTNET_CHAINS].filter((c) => c.kind === 'evm' && c.evmChainId).map(fromChain);
  const seen = new Set(builtin.map((n) => n.chainId));
  const custom: EvmNetwork[] = customNetworks().filter((n) => !seen.has(n.chainId)).map((n) => ({ chainId: n.chainId, id: `custom-${n.chainId}`, name: n.name, symbol: n.symbol, decimals: 18, rpcs: [rpcOverride(n.chainId) ?? n.rpcUrl], explorer: n.explorerUrl, testnet: false, custom: true }));
  return [...builtin, ...custom];
}
export const evmNetwork = (chainId: number): EvmNetwork | undefined => evmNetworks().find((n) => n.chainId === chainId);
