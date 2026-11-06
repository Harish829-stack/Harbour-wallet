// Legacy view of the chain registry kept for older call sites: `CHAINS` is now Trust Wallet's full enabled set (86 chains) and
// `TESTNETS` is Sepolia. New code should import from './chains/index' (ChainInfo) directly.
import { ALL_CHAINS, TESTNET_CHAINS, type ChainInfo } from './chains/index';
export interface Chain { id: string; name: string; ct: string; kind: ChainInfo['kind']; chainId?: number; testnet?: boolean; twId?: number; symbol?: string }
const toLegacy = (c: ChainInfo): Chain => ({ id: c.id, name: c.name, ct: c.ct, kind: c.kind, chainId: c.evmChainId, testnet: c.testnet, twId: c.twId, symbol: c.symbol });
export const CHAINS: Chain[] = ALL_CHAINS.map(toLegacy);
export const TESTNETS: Chain[] = TESTNET_CHAINS.map(toLegacy);
