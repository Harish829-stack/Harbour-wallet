# 34 Staking STATUS (2026-10-19)
| Screen / flow | Status |
|---|---|
| Earn tab (Native Staking list: loading/error/stale/empty, per-asset error) | Real (live-unverified) |
| Hidden for hardware / non-mnemonic wallets (tab removed) | Real |
| Staking details (staked, rewards, unbonding, APR, min, lock, delegations) | Real (live-unverified) |
| Stake / Unstake / Redelegate / Compound / Claim (Cosmos family, 12 chains) | Real build+signing tested; broadcast unverified |
| Solana stake / deactivate / withdraw | Real build+signing tested; unverified live |
| ETH Lido stake / request withdrawal (+approve) / claim | Real; ABI selectors tested; unverified live |
| BNB StakeHub delegate/undelegate/redelegate/claim | Partial: ABI [likely], no APR |
| Validator picker (Active/Inactive, search, logos from assets repo) | Real |
| Tron, DOT/KSM, ADA, XTZ, NEAR, APT, SUI, IOTX, ONE, POL, multi-validator, Ledger earn | Gap |
Tests: test/staking.test.js (15, mocked fetch, wallet-core signing vectors self-generated + regression-pinned — NOT official TW vectors).
