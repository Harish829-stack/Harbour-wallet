// Runtime registry of user-added EVM networks and RPC overrides for built-in ones. Kept in module state so the synchronous
// `rpcUrl()` / `networkByChainId()` lookups can see them; the background loads it from storage on every service-worker start,
// and the popup fills it from the `networkList` message.
import { chainByEvmId } from './chains/index';
export interface CustomNetwork { chainId: number; name: string; rpcUrl: string; symbol: string; explorerUrl?: string; addedAt: number }
export interface NetworkState { custom: CustomNetwork[]; rpcOverrides: Record<string, string> }
let state: NetworkState = { custom: [], rpcOverrides: {} };
export const setNetworkState = (s: Partial<NetworkState> | null | undefined) => {
  const custom = Array.isArray(s?.custom) ? (s!.custom as CustomNetwork[]).filter((n) => n && Number.isSafeInteger(n.chainId) && typeof n.rpcUrl === 'string') : [];
  const rpcOverrides = s?.rpcOverrides && typeof s.rpcOverrides === 'object' ? { ...s.rpcOverrides } : {};
  // Older builds allowed a built-in chain to be saved as a second custom row.
  // Keep its chosen RPC as an override, while exposing just one chain identity.
  state = { custom: custom.filter((n) => {
    if (!chainByEvmId(n.chainId)) return true;
    rpcOverrides[String(n.chainId)] ??= n.rpcUrl;
    return false;
  }), rpcOverrides };
};
export const getNetworkState = (): NetworkState => state;
export const customNetworks = (): CustomNetwork[] => state.custom;
export const customNetwork = (chainId?: number): CustomNetwork | undefined => state.custom.find((n) => n.chainId === chainId);
export const rpcOverride = (chainId: number): string | undefined => state.rpcOverrides[String(chainId)] ?? state.custom.find((n) => n.chainId === chainId)?.rpcUrl;
export const customExplorer = (chainId?: number): string | undefined => state.custom.find((n) => n.chainId === chainId)?.explorerUrl;
