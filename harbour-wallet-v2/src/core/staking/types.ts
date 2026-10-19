// Native staking domain types (pure; no DOM / chrome APIs). Amounts are smallest-unit decimal strings.
export type StakeFamily = 'cosmos' | 'solana' | 'lido' | 'bsc';
export type StakeAction = 'stake' | 'unstake' | 'redelegate' | 'compound' | 'claim' | 'withdraw';

export interface StakeAssetDef {
  chainId: string;          // registry id (core/chains)
  family: StakeFamily;
  symbol: string;
  decimals: number;
  /** Smallest amount the protocol accepts for a new stake (smallest unit, decimal string). */
  minStake: string;
  /** Unbonding / cooldown in days when known from the protocol (null = variable, shown as such). */
  lockDays: number | null;
  /** The list at trustwallet/assets blockchains/<id>/validators/list.json (null = protocol has a single pool). */
  validatorsList: string | null;
  /** Rewards are claimed explicitly (Cosmos) vs. auto-compounding / accrued in the position (Solana, Lido, BSC). */
  claimableRewards: boolean;
  supportsRedelegate: boolean;
  /** Short protocol label shown on the details screen. */
  protocol: string;
}

export interface ValidatorMeta { id: string; name: string; description?: string; website?: string }
export interface Validator extends ValidatorMeta {
  /** Annualised reward rate for a delegator, percent (e.g. 7.31). null = could not be derived from public data. */
  apr: number | null;
  /** Validator commission, percent. */
  commission: number | null;
  active: boolean;
  jailed?: boolean;
  /** Total stake (raw) when the chain reports it. */
  tokens?: string;
}

export type PositionStatus = 'active' | 'activating' | 'deactivating' | 'inactive' | 'unbonding' | 'claimable';
export interface Position {
  /** Stable id: validator address for Cosmos/BSC; stake-account address for Solana; withdrawal request id for Lido. */
  id: string;
  validatorId: string;
  validatorName?: string;
  amount: string;
  /** Pending rewards (Cosmos), smallest unit. */
  rewards?: string;
  status: PositionStatus;
  /** Epoch ms when the position becomes available (unbonding end / cooldown end). */
  availableAt?: number;
  /** Validator APR snapshot (percent). */
  apr?: number | null;
}

export interface StakeOverview {
  chainId: string;
  symbol: string;
  decimals: number;
  /** Active + activating stake. */
  staked: string;
  /** Sum of pending (Cosmos) rewards. */
  rewards: string;
  /** Unbonding / deactivating, not yet withdrawable. */
  unbonding: string;
  /** Withdrawable now (Solana inactive stake accounts, Lido finalized, BSC claimable). */
  claimable: string;
  apr: number | null;
  positions: Position[];
  /** Unbonding period in days when the node reports it. */
  lockDays: number | null;
}

export interface StakeListItem {
  chainId: string;
  symbol: string;
  name: string;
  apr: number | null;          // best known APR (percent)
  staked: string;              // raw, "0" when none
  rewards: string;
  decimals: number;
  protocol: string;
  error?: string;              // per-asset refresh failure (never a fake zero)
  stale?: boolean;             // showing the last good snapshot because the refresh failed
}

export const stakeError = (code: string, message: string) => Object.assign(new Error(message), { code });
