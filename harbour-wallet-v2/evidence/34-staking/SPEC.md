# 34 Staking / Earn — SPEC (REA of TW 26.41.0 + Harbour public-data implementation)

Evidence: `artifacts/reference-26.41.0/chunks/App-D29UTaP5.js` (offsets ~1.65M–1.86M: StakingList, Staking, Stake, Unstake, Redelegate, Compound, Claim, ValidatorSelect), HAR contract `evidence/24-har-api-contract/API-CONTRACT.md`. Read directly (minified chunk, not Wakaru'd). i18n strings are NOT in the extension (remote catalog): ids confirmed, English wording partly guessed.

## TW behaviour (confidence)
- Routes `/staking`, `/staking/:assetId`, `/stake/:assetId/:amount?/:validatorId?`, `/unstake/:assetId`, `/redelegate/:assetId`, `/compound/:assetId`, `/claim-delegation/:assetId` [verified]. Earn tab = StakingList titled "Native Staking" [verified].
- List rows: asset icon, title, subtitle, APR (`staking.list-item-description` with `{maxApr}`) [verified]; states: loading spinner, error "We couldn’t load staking options. Please try again." + Retry, stale banner "Couldn’t refresh rates. Showing recent data.", empty "No staking available for the current wallet", `coming-soon-for-ledger` tag for some assets [verified strings].
- Data comes from TW's earn SDK in the background (`sdkFeatures.earn`, 5-min cache, 15-min stale window) fed by `/v1/invests/staking` on the authenticated gateway [verified/likely]. NOT used by Harbour.
- Details page: rows Staked / other balances / Minimum Amount / APR (with APR-warning popup "Got it") / lock-time row; action rows (Stake, Unstake, Redelegate, Compound, Claim — set varies per protocol); delegation rows (validator, balance, earned, APR, "Remaining: <time>") [verified].
- Stake/Unstake/Claim forms: amount input with MAX, ValidatorSelect (single or multi), warnings, CTA "Stake now"/"Unstake now"/"Compound now"/"Claim now"; confirm via shared SEND_CONFIRM screen; Tron adds Bandwidth/Energy resource radio [verified]. Validator modal "Validators": Active / Inactive sections, APR per row [verified].
- Hardware: list row shows "coming soon for Ledger"; task brief: earn hidden for hardware accounts (Harbour hides the tab).

## Harbour implementation (deviations)
| TW | Harbour |
|---|---|
| gateway `/v1/invests/staking`, earn SDK | `core/staking/registry.ts` asset set + live on-chain reads |
| validator metadata (gateway) | `raw.githubusercontent.com/trustwallet/assets/master/blockchains/<chain>/validators/list.json` + bundled snapshot (`validators.snapshot.json`, 2026-10-19), sanitised |
| APR (provider) | Cosmos: mint inflation / bonded ratio × (1−community tax) × (1−commission); Solana: getInflationRate/getSupply/getVoteAccounts × (1−commission); Lido: eth-api.lido.fi sma APR; BNB: none (shown "—") |
| positions | Cosmos LCD delegations/unbonding/rewards; Solana getProgramAccounts(Stake, memcmp staker); Lido stETH balance + WithdrawalQueue; BNB StakeHub credit contracts (multicall) |
| signing | wallet-core AnySigner (Cosmos MsgDelegate/Undelegate/BeginRedelegate/WithdrawDelegatorReward, Solana DelegateStake/DeactivateStake/WithdrawStake); EVM calls signed with viem (deviation from AnySigner) |
| confirm | own confirm screen (`stakeConfirm`); send worker's files untouched |
Assets: ETH (Lido, replaces TW's Kiln pool), SOL, BNB (StakeHub), ATOM OSMO KAVA AKT SEI JUNO STRD AXL BLD INJ ZETA LUNC. Gaps: Tron resources, Polkadot/Kusama, Cardano, Tezos, NEAR, Aptos, Sui, IoTeX, Harmony, POL, Neutron, Kiln ETH, Tron stake 2.0, multi-validator select.
Confidence: contract addresses (Lido stETH/queue, StakeHub 0x…2002), StakeHub/credit ABIs [likely]; Cosmos gas prices [likely]; Solana `value` includes rent (observed in a signed tx: one lamports field == value) [verified locally]. Everything network-facing is live-unverified.
