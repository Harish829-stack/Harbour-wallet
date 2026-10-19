// Staking assets Harbour supports with PUBLIC data + wallet-core signing. TW's list comes from its authenticated gateway
// (`/v1/invests/staking`, evidence/24-har-api-contract); Harbour builds the list from chains that have (a) a public validators
// list at trustwallet/assets and (b) a public read API + a signing path. Anything not here is a documented gap
// (evidence/34-staking/STATUS.md): Tron (resources), Polkadot/Kusama, Cardano, Tezos, NEAR, Aptos, Sui, IoTeX, Harmony, Polygon (POL), Neutron…
import type { StakeAssetDef } from './types';

const cosmos = (chainId: string, symbol: string, decimals = 6, extra: Partial<StakeAssetDef> = {}): StakeAssetDef => ({
  chainId, family: 'cosmos', symbol, decimals, minStake: '1', lockDays: null, validatorsList: chainId, claimableRewards: true, supportsRedelegate: true,
  protocol: 'Cosmos SDK delegated proof of stake', ...extra,
});

export const STAKING_ASSETS: StakeAssetDef[] = [
  { chainId: 'ethereum', family: 'lido', symbol: 'ETH', decimals: 18, minStake: '1', lockDays: null, validatorsList: null, claimableRewards: false, supportsRedelegate: false,
    protocol: 'Lido liquid staking (stETH)' },
  { chainId: 'solana', family: 'solana', symbol: 'SOL', decimals: 9, minStake: '1000000000', lockDays: null, validatorsList: 'solana', claimableRewards: false, supportsRedelegate: false,
    protocol: 'Native stake accounts' },
  { chainId: 'smartchain', family: 'bsc', symbol: 'BNB', decimals: 18, minStake: '1000000000000000000', lockDays: 7, validatorsList: 'smartchain', claimableRewards: false, supportsRedelegate: true,
    protocol: 'BNB Chain StakeHub' },
  cosmos('cosmos', 'ATOM'),
  cosmos('osmosis', 'OSMO'),
  cosmos('kava', 'KAVA'),
  cosmos('akash', 'AKT'),
  cosmos('sei', 'SEI'),
  cosmos('juno', 'JUNO'),
  cosmos('stride', 'STRD'),
  cosmos('axelar', 'AXL'),
  cosmos('agoric', 'BLD'),
  cosmos('nativeinjective', 'INJ', 18),
  cosmos('zetachain', 'ZETA', 18),
  cosmos('terra', 'LUNC'),
];

export const stakingAsset = (chainId?: string | null): StakeAssetDef | undefined => STAKING_ASSETS.find((a) => a.chainId === chainId);
