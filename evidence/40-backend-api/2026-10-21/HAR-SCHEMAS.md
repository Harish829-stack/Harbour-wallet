# Historical request / response shapes

[OBSERVED-ONLY] Values are removed. These are observed shapes, not server validation schemas. Field requiredness, bounds, enums, empty-array item types and absent fields are UNKNOWN. All original shape variants, observed array lengths, truncation counts and record references are in har-contracts.json. Repeated equivalent shape text is collapsed below. NDJSON lines are represented as an analysis array, never a claim of a JSON-array wire response. Unparseable/non-JSON bodies are not retained. Header names never contain credential values.

## 1. POST aag.twnodes.com/naas/session/{sessionToken}/v2

Query keys: none recorded. Status counts: `{"400":11}`. MIME: text/plain.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-tw-naas-aag-chain.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:622, E2E-network-log-trust-wallet.har:623, E2E-network-log-trust-wallet.har:627, E2E-network-log-trust-wallet.har:629, E2E-network-log-trust-wallet.har:632, E2E-network-log-trust-wallet.har:634, E2E-network-log-trust-wallet.har:637, E2E-network-log-trust-wallet.har:932, E2E-network-log-trust-wallet.har:935, E2E-network-log-trust-wallet.har:938, E2E-network-log-trust-wallet.har:940.

## 2. GET aeternity.twnodes.com/naas/session/{sessionToken}/v2/accounts/{opaqueValue}

Query keys: none recorded. Status counts: `{"404":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ reason: string }
```

Record references: E2E-network-log-trust-wallet.har:52, E2E-network-log-trust-wallet.har:387, E2E-network-log-trust-wallet.har:538, E2E-network-log-trust-wallet.har:703, E2E-network-log-trust-wallet.har:849, E2E-network-log-trust-wallet.har:1057, add-cutom-network.har:182, lock-unlock-biometric.har:68, network-log.har:60, network-log.har:179, network-log.har:300, network-log.har:420, network-log.har:540, network-log.har:660, network-log.har:781, network-log.har:902, network-log.har:1025, network-log.har:1148, network-log.har:1272, network-log.har:1411, network-log.har:1533, network-log.har:1656, network-log.har:1779, network-log.har:1901, network-log.har:2023, network-log.har:2142, network-log.har:2264, network-log.har:2387, network-log.har:2508, network-log.har:2634, network-log.har:2756, network-log.har:2876, network-log.har:3001, network-log.har:3118, network-log.har:3239, network-log.har:3390.

## 3. GET agoric-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:254.

## 4. GET agoric-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:253.

## 5. GET agoric-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:252.

## 6. GET agoric-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:251.

## 7. POST aion.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"404":36}`. MIME: text/html.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:47, E2E-network-log-trust-wallet.har:385, E2E-network-log-trust-wallet.har:534, E2E-network-log-trust-wallet.har:701, E2E-network-log-trust-wallet.har:847, E2E-network-log-trust-wallet.har:1054, add-cutom-network.har:180, lock-unlock-biometric.har:69, network-log.har:59, network-log.har:178, network-log.har:299, network-log.har:419, network-log.har:539, network-log.har:659, network-log.har:780, network-log.har:901, network-log.har:1024, network-log.har:1147, network-log.har:1270, network-log.har:1410, network-log.har:1532, network-log.har:1655, network-log.har:1778, network-log.har:1900, network-log.har:2022, network-log.har:2141, network-log.har:2263, network-log.har:2386, network-log.har:2507, network-log.har:2633, network-log.har:2755, network-log.har:2874, network-log.har:3000, network-log.har:3119, network-log.har:3238, network-log.har:3389.

## 8. GET akash-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:155.

## 9. GET akash-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:154.

## 10. GET akash-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:153.

## 11. GET akash-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:152.

## 12. GET algorand.twnodes.com/naas/session/{sessionToken}/v2/accounts/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, amount: number, amount-without-pending-rewards: number, apps-local-state: Array<UNKNOWN item; empty in capture>, apps-total-schema: { num-byte-slice: number, num-uint: number }, assets: Array<UNKNOWN item; empty in capture>, created-apps: Array<UNKNOWN item; empty in capture>, created-assets: Array<UNKNOWN item; empty in capture>, min-balance: number, pending-rewards: number, reward-base: number, rewards: number, round: number, status: string, total-apps-opted-in: number, total-assets-opted-in: number, total-created-apps: number, total-created-assets: number }
```

Record references: add-cutom-network.har:170.

## 13. GET api.bnbchain.org/bnb-staking/v1/validator/all

Query keys: limit, offset. Status counts: `{"200":7}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ code: number, data: { total: number, validators: Array<{ apy: number, commission: number, consensusAddress: string, createdAt: number, delegatorCount: number, miningStatus: string, moniker: string, operatorAddress: string, status: string, totalStaked: string } | { apy: number, bcOperatorAddress: string, commission: number, consensusAddress: string, createdAt: number, delegatorCount: number, miningStatus: string, moniker: string, operatorAddress: string, status: string, totalStaked: string } | { apy: number, bcOperatorAddress: string, commission: number, consensusAddress: string, createdAt: number, delegatorCount: number, displayMoniker: string, miningStatus: string, moniker: string, operatorAddress: string, status: string, totalStaked: string } | { bcOperatorAddress: string, commission: number, consensusAddress: string, createdAt: number, delegatorCount: number, miningStatus: string, moniker: string, operatorAddress: string, status: string, totalStaked: string } | { commission: number, consensusAddress: string, createdAt: number, delegatorCount: number, miningStatus: string, moniker: string, operatorAddress: string, status: string, totalStaked: string }> } }
```

Record references: E2E-network-log-trust-wallet.har:321, E2E-network-log-trust-wallet.har:322, E2E-network-log-trust-wallet.har:325, E2E-network-log-trust-wallet.har:327, E2E-network-log-trust-wallet.har:329, add-cutom-network.har:287, add-cutom-network.har:292.

## 14. POST aptos.twnodes.com/naas/session/{sessionToken}/v1/view

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ function: string, type_arguments: Array<string>, arguments: Array<string> }
```

Response:

```text
Array<string>
```

Record references: add-cutom-network.har:124.

## 15. POST arb1.arbitrum.io/rpc

Query keys: none recorded. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ jsonrpc: string, id: string, method: string, params: Array<UNKNOWN item; empty in capture> }
OR
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: string, result: string }
OR
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:217, add-cutom-network.har:222.

## 16. POST arc.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":1,"200":1}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<{ to: string, data: string } | string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:279, network-log.har:1342.

## 17. GET assets-cdn.trustwallet.com/blockchains/ethereum/tokenlist.json

Query keys: none recorded. Status counts: `{"304":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, if-modified-since, if-none-match, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ name: string, logoURI: string, timestamp: string, tokens: Array<{ chainId: number, asset: string, type: string, address: string, name: string, symbol: string, decimals: number, logoURI: string, pairs: Array<{ base: string }> } | { chainId: number, asset: string, type: string, address: string, name: string, symbol: string, decimals: number, logoURI: string, pairs: Array<UNKNOWN item; empty in capture> } | { asset: string, type: string, address: string, name: string, symbol: string, decimals: number, logoURI: string, pairs: Array<UNKNOWN item; empty in capture> }>, version: { major: number, minor: number, patch: number } }
```

Record references: E2E-network-log-trust-wallet.har:178.

## 18. GET assets-cdn.trustwallet.com/blockchains/smartchain/tokenlist.json

Query keys: none recorded. Status counts: `{"304":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, if-modified-since, if-none-match, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ name: string, logoURI: string, timestamp: string, tokens: Array<{ chainId: number, asset: string, type: string, address: string, name: string, symbol: string, decimals: number, logoURI: string, pairs: Array<{ base: string }> } | { chainId: number, asset: string, type: string, address: string, name: string, symbol: string, decimals: number, logoURI: string, pairs: Array<UNKNOWN item; empty in capture> } | { asset: string, type: string, address: string, name: string, symbol: string, decimals: number, logoURI: string, pairs: Array<UNKNOWN item; empty in capture> }>, version: { major: number, minor: number, patch: number } }
```

Record references: E2E-network-log-trust-wallet.har:171.

## 19. GET assets-cdn.trustwallet.com/blockchains/smartchain/validators/list.json

Query keys: none recorded. Status counts: `{"200":3,"304":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, if-modified-since, if-none-match, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<{ id: string, name: string, description: string, website: string }>
```

Record references: E2E-network-log-trust-wallet.har:314, E2E-network-log-trust-wallet.har:328, E2E-network-log-trust-wallet.har:330, add-cutom-network.har:293.

## 20. GET assets-cdn.trustwallet.com/blockchains/solana/validators/list.json

Query keys: none recorded. Status counts: `{"200":1,"304":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, if-modified-since, if-none-match, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<{ id: string, name: string, description: string, website: string }>
```

Record references: E2E-network-log-trust-wallet.har:343, E2E-network-log-trust-wallet.har:352.

## 21. POST aurora.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, error: { code: number, message: string } }
OR
{ id: number, jsonrpc: string, result: string }
```

Record references: add-cutom-network.har:239, network-log.har:2893.

## 22. POST avalanche.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:220.

## 23. GET axelar-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:146.

## 24. GET axelar-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:145.

## 25. GET axelar-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:144.

## 26. GET axelar-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:143.

## 27. POST base.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":1,"200":1}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<{ to: string, data: string } | string>, jsonrpc: string }
```

Response:

```text
{ id: number, result: string, jsonrpc: string }
```

Record references: add-cutom-network.har:119, network-log.har:1341.

## 28. GET bin.bnbstatic.com/api/i18n/-/web/cms/sp/86a37593e/en/translations

Query keys: none recorded. Status counts: `{"0":1,"200":1,"304":5}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, if-modified-since, if-none-match, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ modal.description: string, modal.header: string, compromised-warning.call-to-action: string, compromised-warning.description: string, compromised-modal.button: string, compromised-modal.call-to-action: string, compromised-modal.description: string, compromised-warning.contact: string, compromised-modal.header: string, generic.view-more: string, first-time-education-modal.step2.body: string, input-contract-address.validation.manual.wrong-address: string, staking.available: string, staking-overview.available-balance-blocked: string, staking.frozen: string, staking.description: string, staking.frozen-but-not-staked: string, staking.cross-chain-redelegate: string, staking.epoch-period-day: string, staking-overview.available-balance-staked: string, staking-overview.available-balance-pending: string, staking.list-item-available-date: string, staking-teaser.pool-staking: string, staking.epoch-period-days: string, staking.compound-now: string, staking.delegations-limit: string, staking.binance-stake-info: string, staking.highlight-stake-now: string, staking-teaser.native-staking: string, staking-list-item.coming-soon-for-ledger: string, manage-crypto.import-asset: string, stake-hint.normal-fees-apply: string, manage-assets.support-coming-soon: string, manage-assets.btn-custom-asset: string, redelegate.info: string, manage-assets.no-asset.description: string, security_banner.heading: string, seed-phrase-backup-warning.button-text: string, network.header: string, nft-reported-collections.hidden-collections: string, stake.advanced-options: string, navigation.tab-earn: string, nft-list.empty: string, stake-hint.epoch-takes-2-4-days: string, stake.rewards: string, nft-collection.unhide: string, stake-hint.lock-time: string, nft-reported-collections.hidden-nfts: string, manage-crypto.info-action.text: string, manage-crypto.title: string, security_banner.subheading: string, stake-hint.apr-estimate: string, stake.balance: string, modal-migrate.title: string, inscription-overview.inscription-balance: string, seed-phrase-backup-warning.description: string, stake-hint.claim-accessible-after-current-epoch: string, nft-collection.nothing-bought: string, stake-hint.two-epochs-to-see-rewards: string, stake-hint.unstake-anytime: string, seed-phrase-backup-warning.title: string, stake.validators-header: string, stake-hint.rewards: string, stake-hint.funds-available-in: string, stake-hint.pool-staking-provider: string, inscription-overview.non-transferable-balance: string, nft-item.rarity-text: string, redelegate.balance: string, stake-hint.rewards-stop-immediately: string, nft-item.view-on-opensea: string, nft-collection.hide-and-report: string, manage-assets.no-asset.title: string, nft-collection.nothing-hidden: string, inscription-overview.transferable-balance: string, nft-item.attributes: string, stake-hint.delegation-active-after-current-epoch: string, stake.advanced-options-validators: string, generic.nonce: string, stake-hint.redelegate: string, dev-mode.title: string, inscription-overview.balance-transferable: string, dashboard.switch-networks: string, generic.migration.bep2-warning: string, generic.description: string, generic.trade.migrate-warning: string, generic.asset-migrate.fees-disclaimer: string, inscription-overview.available-balance: string, history.receive.modal.subheader: string, generic.trade.asset-migrate.description: string, manage-assets.title: string, generic.network-error: string, inscription-overview.balance-available: string, history.receive.modal.header: string, input-contract-address.validation.generic: string, history-list.title: string, dashboard.refresh: string, first-time-education-modal.step2.body.list1: string, generic.trade.migrate: string, generic.asset-migrate.description: string, input-contract-address.confirmation: string, generic.estimated-tx-fee: string, generic.learn-more: string, generic.copy-address: string, generic.trade.migrate-checkbox: string, earn.title: string, generic.trade.input-address.label: string, generic.type: string, generic.trade.modal-migrate.title: string, disabled-max-state.tooltip: string, history.receive.header: string, generic.migrate: string, history.receive.subheader: string, generic.migration-required: string, input-contract-address.label: string, generic.understood: string, first-time-education-modal.step2.body.list3: string, generic.loading: string, input-contract-address.placeholder: string, dashboard.token-management-button-flyout: string, generic.stake-crypto: string, input-contract-address.symbol: string, generic.trade.asset-migrate.fees-disclaimer: string, inscription-overview.balance-inscription: string, generic.trade.bnb-input-address.label: string, input-contract-address.decimals: string, airdrops.title: string, generic.trade.migration-required: string, chart.period-1h: string, input-contract-address.validation.not-found: string, airdrops.2.step-7: string, airdrops.2.step-0: string, generic.trade.input-amount.label: string, airdrops.2.step-6: string, compound.target-validator: string, dashboard.disconnect-dapp: string, airdrops.1.step-0: string, airdrops.2.step-3: string, backup.warning-title: string, airdrops.0.step-7: string, asset.chart.period-1y: string, backup.modal-description: string, airdrops.link: string, dashboard.not-connected: string, airdrops.2.step-2: string, airdrops.1.step-1: string, compound.balance: string, airdrops.1.step-5: string, airdrops.2.step-4: string, airdrops.1.step-2: string, asset.chart.period-1d: string, airdrops.2.step-1: string, backup.warning-description: string, collection-list.empty: string, backup-seedphrase-cta.receive-crypto-header: string, backup.modal-button: string, custom-asset.token-name: string, custom-asset.token-type: string, airdrops.2.step-5: string, custom-asset.token-symbol: string, badge.new: string, component.input-addresses-search.placeholder: string, asset.chart.period-1m: string, dashboard.manage-networks: string, asset.chart.period-1h: string, backup.warning-backup-now: string, airdrops.1.step-6: string, asset.chart.period-all: string, airdrops.2.step-9: string, dashboard.connected-to: string, custom-asset.token-decimals: string, backup.warning-remind-later: string, dashboard.other-chains: string, airdrops.1.step-4: string, airdrops.2.step-8: string, airdrops.description: string, airdrops.1.step-3: string, add-asset.register-error: string, backup.modal-title: string, airdrops.0.step-1: string, airdrops.0.step-4: string, airdrops.0.step-6: string, airdrops.0.step-3: string, airdrops.0.step-0: string, your-addresses.title: string, airdrops.0.step-5: string, airdrop.tasks: string, add-custom-asset.title: string, input-contract-address.validation.metadata: string, add-asset.btn-add-token-manually: string, airdrops.0.step-2: string, asset.chart.period-1w: string, staking.lock-time-period: string, staking.minimum-to-claim: string, staking.active-delegations: string, generic.validators: string, first-time-education-modal.button.finish: string, staking-overview.claim-rewards: string, staking.epoch-period-hour: string, component.blockchain-select.all-networks: string, generic.view-less: string, staking-overview.available-balance-balance: string, staking.claimable-delegations: string, staking-overview.lifetime-rewards: string, staking.cross-chain-redelegate.bnb-smart-chain: string, staking.list-item-rewards: string, staking-overview.lock-time-header: string, staking.minimum-staking-amount: string, staking-teaser.claimable-rewards: string, staking.apr: string, staking.compound: string, staking-overview.available-balance-frozen: string, staking.activating-delegations: string, staking.claim-delegation: string, staking-overview.available: string, add-asset.warning: string, staking-teaser.description: string, staking.list-item-description: string, staking.highlight-stake-with-trust: string, staking.claim-rewards: string, staking.epoch-period-hours: string, staking-stake-now: string, staking.deactivating-delegations: string, staking.list-item-staked: string, staking-overview.available-balance-locked: string, staking.inactive-delegations: string, staking.epoch-header: string, token-asset-list.empty-home-caption: string, staking.list-item-unstaking: string, transaction.claim-rewards.title: string, staking.pending: string, transaction.delegate.title: string, switch-modal.disconnect-tooltip: string, staking.validator-list-header: string, staking.stake-info: string, transaction.receive.title: string, staking.unstake-after-claim: string, transaction.claim.title: string, staking.title: string, staking.validator-list-inactive: string, tab-settings: string, staking.select-validator: string, token-asset-list.manage-crypto: string, staking.lock-time-header: string, staking-teaser.get-started: string, staking.staked: string, tab-earn: string, transaction.send.title: string, staking.unstake: string, staking.pending-delegations: string, token-asset-list.empty-caption: string, staking.redelegate: string, switch-modal.switch-to: string, token-asset-list.no-crypto-activated: string, staking.rewards: string, staking.unstake-now: string, transaction.btn-view-on-explorer: string, switch-modal.body-incompatible: string, switch-modal.title: string, trade.modal-migrate.title: string, staking.validator-to: string, switch-modal.body: string, tab-home: string, transaction.cannot-find-transaction: string, staking.stake-now: string, transaction.approve.title: string, transaction.redelegate.title: string, testnet-mode.title: string, staking.stake: string, staking.validators-modal-header: string, switch-modal.connect-with: string, tab-history: string, staking.smartchain-banner-1: string, switch-modal.disconnect: string, transaction.contract.title: string, transaction.check-explorer: string, staking.validator-list-active: string, transaction.swap.title: string, transaction.compound.title: string, transaction.testnet-transaction: string, staking.validator-from: string, your-addresses.empty-search: string, unstake.balance: string, wallet-more-actions.support: string, staking.staking-overview: string, unstake.advanced-options: string, transaction.tesnet-transaction: string, transaction.undelegate.title: string, transaction.trade.title: string, wallet-more-actions.fullscreen: string, validators.list-item-description: string, dashboard.tokens.buy-tax: string, settings-modal.title: string, dashboard.tokens.contract-security: string, errors.transaction-generation: string, dashboard.tokens.risk: string, swap-details.routing-fee: string, dashboard.tokens.total-supply: string, dashboard.tokens.stats: string, errors.route-not-available: string, dashboard.tokens.volume-24h: string, network-selection-modal.input-placeholder: string, swap-details.provider: string, dashboard.tokens.risk-cancel: string, dashboard.tokens.table.marketcap: string, dashboard.tokens.max-supply: string, dashboard.tokens.table.24h-volume: string, settings-modal.mev-tooltip: string, generic.hot-tokens: string, swap-details.provider-fee: string, dashboard.tokens.sell-tax: string, dashboard.tokens.table.price: string, dashboard.tokens.risk-disclaimer: string, settings-modal.mev-protection: string, network-selection-modal.choose-network: string, dashboard.tokens.read-more: string, swap-details.edit-slippage: string, dashboard.tokens.risk-confirm: string, dashboard.tokens.scanned-by-go-plus: string, dashboard.tokens.table.token: string, dashboard.tokens.warnings: string, swap-details.price-impact: string, swap-details.slippage-tolerance: string, dashboard.tokens.warning: string, dashboard.tokens.swap: string, dashboard.tokens.risk-reminder: string, swap-details.network-fee: string, dashboard.tokens.risks: string, errors.failed-quote: string, dashboard.tokens.read-less: string, swap-details.minimum-amount-receive: string, dashboard.tokens.dyor-disclaimer: string, dashboard.approve-crypto: string, asset-selection-modal.rest-of-currencies-category: string, dashboard.spend: string, dashboard.balance-exceeded: string, dashboard.select-token: string, dashboard.receive: string, asset-selection-modal.search-results-category: string, dashboard.swap: string, dashboard.header: string, asset-selection-modal.spend-header: string, dashboard.insufficient-balance: string, dashboard.tokens.links: string, dashboard.tokens.circulating-supply: string, asset-selection-modal.you-pay: string, dashboard.tokens.honeypot-risk: string, asset-selection-modal.rest-of-crypto-category: string, asset-selection-modal.no-results: string, asset-selection-modal.popular-category: string, asset-selection-modal.input-placeholder: string, dashboard.tokens.input-placeholder: string, asset-selection-modal.you-get: string, dashboard.find-best-price: string, dashboard.tokens.about: string, dashboard.tokens.contract-addresses: string, asset-selection-modal.receive-header: string, dashboard.tokens.marketcap: string, asset-selection-modal.balance-category: string, modal-reset-wallet.title: string, modal-reset-wallet.btn-i-understand: string, unlock.memory-error: string, mpc.unlock.heading: string, modal-forgot-password.btn-reset-password: string, unlock.reset-wallet: string, modal-forgot-password.title: string, modal-forgot-password.description: string, mpc.unlock.subheading: string, modal-reset-wallet.description: string, modal-reset-wallet.loading: string, unlock.forgot-password: string, unlock.subheading: string, unlock.cannot-login: string, modal-reset-wallet.modal.title: string, mpc.unlock.continuewith: string, dapps.revoke-access: string, settings.backup-wallet: string, mpc.recoveryfactor.email.error: string, settings.notifications.product_announcement: string, wallet-item.back-up-mnemonic-badge: string, ui.colorMode.light: string, settings.language.tr: string, settings.language.id: string, ui.colorMode.system: string, ui.colorMode.dark: string, settings.view-seed-phrase: string, settings.help.support: string, settings.notifications: string, settings.language.ar: string, settings.language.it: string, settings.notifications.send-receive.tooltip: string, settings.enable-eth-sign.tooltip: string, settings.language.de: string, settings.language.pt: string, settings.custom-nonce: string, settings.language.es-LA: string, settings.dapps-connections: string, settings.language.ja: string, settings.language.zh-TC: string, settings.developer-settings: string, settings.language.vi: string, settings.help.help-center: string, settings.enable-eth-sign: string, settings.language.zh-CN: string, settings.language.bn: string, settings.language.ru: string, settings.sidepanel-enable: string, settings.developer-settings.faucets-alert: string, settings.share-feedback: string, settings.language.ko: string, settings.language: string, settings.enable-testnets.tooltip: string, settings.notifications.send-receive: string, settings.language.fr: string, settings.help: string, settings.default-wallet: string, settings.custom-nonce.tooltip: string, settings.manage-wallets.caption: string, settings.default-wallet.tooltip: string, settings.language.en: string, settings.enable-testnets: string, settings.connected-dapps: string, settings.lock: string, settings.notifications.product_announcement.tooltip: string, ui.colorMode: string, settings.manage-wallets: string, settings.language.uk-UA: string, settings.notifications.enable-push: string, settings.notifications.product_announcements.tooltip: string, settings.notifications.product_announcements: string, mpc.recoveryfactor.social: string, mpc.recoveryfactor.email.heading: string, settings.remove-wallet: string, mpc.security.add-factor-cta: string, modal-view-seed-phrase.not-visible.title-2: string, modal-reset-account.type-confirm: string, mpc.recoveryfactor.email.title: string, mpc.recoveryfactor.mobileOTP.placeholder: string, settings.advanced-gas: string, mpc.security.email.tooltip: string, mpc.recoveryfactor.email.success: string, mpc.heading: string, mpc.security.subheading: string, settings.analytics: string, mpc.security.subheading-variant: string, mpc.recoveryfactor.mobile-otp: string, modal-view-seed-phrase.banner.title-2: string, mpc.recoveryfactor.mobile-otp-save: string, mpc.security.factors-three: string, mpc.security_factors.social: string, mpc.recoveryfactor.email.tooltip: string, mpc.recoveryfactor.mobileOTP.heading: string, modal-view-seed-phrase.banner.title: string, settings.analytics.tooltip: string, settings.blacklisted-dapps: string, mpc.recoveryfactor.set-up-factors: string, settings.change-wallet-name: string, mpc.subheading: string, settings.advanced-transaction-data.tooltip: string, mpc.recoveryfactor.email.subheading: string, mpc.recoveryfactor.email.subtitle: string, navigation.tab2: string, modal-view-seed-phrase.visible.title: string, mpc.security.heading: string, mpc.security.enabled: string, mpc.security_factors.mobile-otp-save: string, mpc.security.tooltip: string, mpc.recoveryfactor.manual.subheading: string, settings.advanced-gas.tooltip: string, modal-view-seed-phrase.not-visible.title: string, mpc.recoveryfactor.email.label: string, navigation.tab3: string, settings.advanced-transaction-data: string, mpc.recoveryfactor.email.placeholder: string, mpc.recoveryfactor.mobileOTP.subheading: string, mpc.subheading-variant: string, modal-view-seed-phrase.banner.description: string, modal-remove-wallet.back-up-secret-phrase-button: string, mpc.security.social: string, mpc.security_factors.mobile-otp: string, navigation.tab1: string, modal-reset-account.heading: string, modal-require-2-factor.title: string, modal-remove-wallet-no-backup.description-2: string, dapps.connected-wallet: string, modal-remove-wallet-no-backup.delete-this: string, modal-remove-wallet.backup-wallet-content-title: string, generic.hide: string, modal-remove-wallet.btn-i-understand: string, modal-remove-wallet-mpc.description-2: string, modal-reset-account.btn-yes-reset-my-account: string, modal-remove-wallet-no-backup.backup-phrase: string, modal-remove-wallet-no-backup.title: string, modal-remove-wallet.password-validation-warning: string, modal-remove-wallet.title: string, modal-require-2-factor.btn-i-understand: string, modal-remove-wallet.description: string, modal-remove-wallet.backup-wallet-content-header: string, generic.wallets: string, modal-remove-wallet.backup-wallet-content-description-new: string, modal-reset-account.alert-reset-account: string, dapps.empty-blacklist: string, modal-remove-wallet-mpc.description-1: string, dapps.list-empty: string, modal-reset-account.subheading: string, modal-remove-wallet.password-validation-header: string, modal-remove-wallet-mpc.btn-i-understand: string, modal-remove-wallet-mpc.yes-remove: string, dapps.blacklist-header: string, modal-remove-wallet-no-backup.description: string, modal-require-2-factor.description: string, dapps.first-connected: string, dapps.empty-list: string, modal-remove-wallet-mpc.title: string, modal-remove-wallet.backup-wallet-content-description: string, modal-remove-wallet.backup-wallet-content-header-new: string, max-wallets-reached.warning: string, select-asset.title: string, generic.inscribe: string, send.confirm.ksm.inactive-account: string, send.low-gas-warning: string, send.non-transferable-balance: string, send.confirm.validation.generic: string, validate-amount.ksm.less-than-00034: string, send.confirm.redelegation-in-progress: string, send.nonce-warning: string, send.tag-optional: string, generic.confirm-claim-rewards: string, validate-amount.dot.less-than-1: string, generic.confirm-undelegate: string, send.title: string, send.max-button-disabled.not-enough-balance: string, input-memo.placeholder	Memo: string, input-amount.validation.generic: string, input-tag.tag.label: string, send.dust-balance: string, generic.confirm-compound: string, generic.continue: string, send.confirm.hardware-wallet-gas-info: string, input-tag.placeholder: string, input-address.address.label: string, generic.available-balance: string, generic.inscription.no-transferable-disclaimer: string, send.confirm.recipient-not-registered-token: string, input-address.address.placeholder: string, send.confirm.recipient-not-owner-nor-approved: string, send.balance: string, generic.confirm-redelegate: string, generic.inscription-modal.header: string, input-memo.memo.label: string, generic.confirm-claim: string, input-memo.memo.placeholder: string, input-tag.tag.placeholder: string, input-address.placeholder: string, generic.inscription-modal.disclaimer: string, input-amount.amount.placeholder: string, send.confirm.inactive-account: string, generic.pay-and-inscribe: string, input-amount.send.max-button-info: string, input-memo.placeholder: string, input-amount.amount.label: string, generic.confirm-stake: string, send.confirm.dot.inactive-account: string, modal-transaction-failed.advanced-error.description: string, input-amount.placeholder: string, send.confirm.hardware-wallet-info: string, send.available-balance: string, token-asset-list.empty-search-caption: string, modal-receive.warning-alert: string, generic.trade.migration.bep2-warning: string, component.input-asset-search.placeholder: string, generic.ton.migration.address: string, account_verify_authenticator.creation-content-scan: string, account_verify_mobile_otp.resendOTP: string, account_verify_new_device.description: string, account_verify_mobile_otp.subheading: string, create-wallet.initiate.heading: string, welcome.import-ledger.title: string, welcome.import.title: string, welcome.create.title: string, welcome.create.subheading: string, welcome.heading: string, welcome.import.description: string, welcome.subheading: string, welcome.import-ledger.description: string, import-ledger-select-account.submit: string, import_options.social.heading: string, import-ledger-connect-device.open-app-description: string, verify-password.heading: string, import-wallet.confirm.heading: string, mpc.recoveryfactor.manual.heading: string, mpc.recoveryfactor.manual.subtitle: string, import_options.secretphrase.subheading: string, import-ledger-select-account.pagination.previous: string, import-ledger-connect-device.heading: string, import-ledger-connect-device.open-app-alert: string, import-ledger-connect.spinner.title: string, import-wallet.confirm.pin-extension: string, import-ledger-connection-error.description: string, import-wallet.seed-phrase.duplicated: string, import-wallet.confirm.subheading: string, import-ledger-select-account.subheading: string, import-wallet.confirm.btn-open-wallet: string, import-ledger-connect.heading: string, max-wallets-reached.title: string, import-seed-phrase.heading: string, import-wallet.seed-phrase.heading: string, set-password.subheading: string, import-wallet.seed-phrase.subheading: string, import-ledger-select-account.spinner.description: string, import-ledger-select-account.spinner.description-new: string, import-ledger-connect.subheading: string, mpc.recoveryfactor.manual.title: string, verify-password-popup.title: string, import_options.social.subheading: string, import-ledger-connect.spinner.description: string, import.heading: string, import-ledger-select-account.item.already-added: string, verify-password.subheading: string, import.subheading: string, import-ledger-select-account.reached-max-warning: string, import-ledger-confirm.proceed-button: string, welcome.connect.heading: string, welcome.create.description: string, import-ledger-confirm.subheading: string, max-wallets-reached.description: string, import-ledger-connect.submit-button: string, import-ledger-select-account.input-placeholder: string, import-wallet.set-password.subheading: string, import-wallet.set-password.heading: string, import-ledger-connection-error.retry-button: string, import-ledger-select-account.heading: string, set-password.heading: string, analytics.subheading: string, account_verify_recoveryFactor.heading: string, mpc.recoveryfactor.mobile.mobile-enter: string, import-ledger-select-account.pagination.next: string, create_social.subheading: string, create_device_factor.delete-consent: string, create_options.heading: string, create-wallet.initiate.write-down: string, create-wallet.set-password.subheading: string, create_mobileOTP.heading: string, create-wallet.confirm.pin-extension.li2: string, create_options.subheading: string, create-wallet.confirm.heading: string, create-wallet.show-seed-phrase.subheading: string, analytics.heading: string, component.select-seed-phrase.clear-all: string, create-wallet.show-seed-phrase.copy-seed-phrase: string, create_options.secretphrase.subheading: string, create_mobileOTP.placeholder: string, create-wallet.confirm.subheading: string, analytics.privacy-policy: string, analytics.list3: string, create_device_factor.heading: string, create_mobileOTP.subheading: string, create-wallet.set-password.heading: string, analytics.list2: string, checkbox-terms-of-service: string, create_social.continue-label: string, create-wallet.safe-paper-message: string, create-wallet.confirm.pin-extension.title: string, create-wallet.show-seed-phrase.heading: string, create-wallet.confirm.pin-extension.li1: string, create_social.heading: string, import-ledger-confirm.create-another-account-button: string, create-wallet.verify-seed-phrase.heading: string, create-wallet.backup-later: string, create-wallet.verify-seed-phrase.description: string, create-wallet.initiate.keep-safe: string, analytics.btn-accept: string, account_verify_recoveryFactor.subheading: string, create_social.verifying: string, create-wallet.confirm.btn-open-wallet: string, create-wallet.verify-seed-phrase.input.placeholder: string, create_device_factor.subheading: string, create-wallet.initiate.description: string, create_options.secretphrase.heading: string, create-wallet.initiate.never-share: string, import-ledger-confirm.heading: string, analytics.list1: string, account_verify_mobile_otp.heading: string, account_verify_new_device.reset-account: string, analytics.btn-decline: string, account_verify_recoveryFactor.error: string, account_verify_options.subheading: string, account_verify_options.recovery-factor: string, account_verify_authenticator.confirmation-sub-heading: string, account_verify_authenticator.creation-caution-description: string, checkbox-terms-of-use: string, account_verify_authenticator.creation-caution-heading: string, GENERIC.ALPHA: string, account_verify_options.email: string, account_verify_authenticator.creation-info: string, account_verify_authenticator.mobile-otp-heading: string, account_verify_mobile_otp.error: string, account_verify_new_device.heading: string, account_verify_authenticator.creation-sub-heading: string, account_verify_authenticator.creation-proceed: string, account_verify_mobile_otp.success_msg: string, account_verify_authenticator.creation-content-manual: string, account_verify_options.mobile-otp: string, account_verify_authenticator.mobile-otp-sub-heading: string, account_verify_new_device.options: string, account_verify_mobile_otp.verifying: string, account_verify_new_device.subheading: string, account_verify_authenticator.heading: string, account_verify_options.heading: string, account_verify_options.reset-account: string, add-network.chain-id: string, add-network.currency-symbol: string, approve-notification.confirmation-modal-header: string, approve-notification.confirmation-modal-content: string, add-asset.desc: string, add-network.connecting: string, approve-notification.confirmation-modal-cancel: string, approve-notification.spending-limit-unlimited: string, add-network.network-name: string, approve.modal.action.radio-1: string, approve-notification.spending-limit: string, connect-wallet.blacklist-button: string, approve.desc: string, approve.modal.action.radio-2: string, connect-wallet.notice1: string, add-asset.symbol: string, add-network.rpc-url: string, add-asset.btn-add-asset: string, approve.modal.title: string, add-asset.decimals: string, approve-notification.confirmation-modal-confirm: string, sign-tx.content.origin: string, sign-tx.chainid.mismatch: string, send-tx.nonce-warning: string, switch-network.switch-to: string, send-tx.title: string, switch-wallets.switch-to: string, send-tx.title.contract: string, sign-tx.raw: string, notification-header.balance-label: string, switch-wallets.connect-with: string, dapps.disconnected-write: string, encrypt.content.action.reveal: string, switch-network.warning: string, switch-wallets.title: string, unsupported-page.body: string, sign-tx.advanced.view: string, sign-tx.EIP4361-warning: string, send-tx.content.detail.error.invalid-token-value: string, switch-wallets.switch: string, switch-wallets.current-wallet: string, switch-network.title: string, sign-tx.instructions: string, switch-wallets.connected-wallet: string, unsupported-page.title: string, switch-wallets.description: string, generic.approve-access-disclaimer: string, send-tx.content.detail.error.invalid-data: string, notification.pagination.title: string, generic.origin: string, sign-tx.title: string, send-tx.content.detail.copy: string, dapp.chainid-mismatch: string, send-tx.content.origin: string, send-tx.content.network-fee.estimated-fee: string, generic.operator: string, encrypt.content.action.provide: string, generic.pay: string, custom-nonce.placeholder: string, send-tx.content.network-fee.title: string, generic.protected-from-mev: string, encrypt.content.desc-decrypted: string, send-tx.decoding-warning: string, send-tx.content.detail.to: string, encrypt.content.action.decrypt: string, sign-message.address.mismatch: string, send-tx.content.detail.view: string, sign-message.domain.mismatch: string, encrypt.content.desc-provided: string, encrypt.content.title-decrypted: string, connect-wallet.title: string, send-tx.content.network-fee.total: string, generic.off-chain-disclaimer: string, connect-wallet.notice3: string, send-tx.content.detail.hide: string, send-tx.content.network-fee.estimated-time.desc: string, send-tx.content.detail.function: string, custom-nonce.description: string, send-tx.content.detail.data: string, encrypt.content.title-provided: string, sign-tx.content.message: string, send-tx.content.detail.hex: string, send-tx.content.amount: string, send-tx.content.network-fee.estimated-time.title: string, send-tx.title.contract-deploy: string, send-tx.content.detail.error.invalid-custom-value: string, encrypt.content.decrypt-message: string, generic.mev-tooltip: string, connect-wallet.notice2: string, encrypt.content.action.copy: string, add-network.block-explorer: string, approve.modal.action.radio-2.input.placeholder: string, send-tx.content.network: string, add-asset.title: string, approve.action.edit: string, approve-notification.confirmation-modal-content-high-default: string, approve.high-cap-limit-tooltip: string, add-network.desc: string, approve.title: string, add-network.title: string, encrypt.content.origin: string, network.test.title: string, dashboard.disconnect: string, input-network-name.placeholder: string, modal-add-network.btn-add-network: string, modal-remove-network.title: string, settings.connections: string, network.btn-custom-network: string, modal-remove-network.description: string, modal-add-network.subtitle: string, modal-add-network.title: string, input-network-name.validation.generic: string, input-rpc-url.placeholder: string, input-currency-symbol.description: string, input-explorer-url.placeholder: string, modal-switch-to-test-network.title: string, dapp.dapps-list-title: string, modal-add-network.warning.title: string, input-currency-symbol.placeholder: string, modal-switch-to-test-network.description: string, dapp.last-connected: string, network.test.tooltip: string, dapp.first-connected: string, modal-add-network.warning.description: string, input-chain-id.placeholder: string, dapp.connected-wallet: string, generic.disconnect: string, generic.delete: string, dapp.revoke-access: string, dapp.dapps-list-empty: string, edit-fee-eip1559.title: string, wallet-selector-popup.add-new-wallet-button: string, generic.connect: string, asset-list.empty: string, generic.name: string, generic.got-it: string, generic.read-more: string, generic.buy: string, generic.next: string, generic.estimated-fee: string, generic.password: string, generic.label.view-other-options: string, generic.empty-search-title: string, generic.label.set-it-up-later: string, generic.confirmed: string, generic.label.set-it-up: string, generic.receive: string, generic.hash: string, generic.gas-price: string, generic.from: string, generic.insufficient-balance-for-tx: string, generic.network-fee: string, generic.label.hide-other-options: string, generic.collection: string, generic.advanced-user: string, generic.decimals: string, edit-fee-eip1559.default.desc: string, generic.input-data: string, generic.amount: string, edit-fee-eip1559.subtitle: string, edit-fee-eip1559.fast.title: string, edit-fee-eip1559.slow.desc: string, generic.balance: string, dashboard.dapp-blacklisted: string, generic-total-fiat-info: string, default-wallet-box.tooltip: string, edit-fee-eip1559.advanced.title: string, blacklisted-dapps-modal.header: string, edit-fee-eip1559.advanced.desc: string, edit-fee-eip1559.slow.title: string, blacklisted-dapps-modal.review-settings: string, backup-seedphrase-cta.back-up-secret-phrase-button: string, generic.advanced-options: string, backup-seedphrase-cta.body: string, blacklisted-dapps-modal.content: string, generic-high-risk-address: string, blacklisted-dapps-modal.title: string, generic-view-more: string, edit-fee-eip1559.default.title: string, generic.approve: string, generic.beta: string, default-wallet-box.hint: string, generic.buy-sell: string, edit-fee-eip1559.fast.desc: string, generic.back: string, generic.coming-soon: string, generic.label.retry: string, generic.proceed: string, generic.preview: string, generic.on-network: string, generic.critical-risk: string, generic.contract: string, generic.mpc_device: string, generic.contract-address: string, generic.network: string, generic.continue-anyway-button: string, default-wallet-box.title: string, generic.failed: string, generic.insufficient-balance-for-gas: string, generic.modal-receive-warning-alert: string, generic.done: string, generic.pending: string, generic.gas-limit: string, generic.estimated-network-fee: string, generic.buy-crypto: string, generic.close: string, generic.label.contact-support: string, generic.coming-soon-on-hardware: string, generic.unconfirmed-txhub-tooltip: string, generic.remind-me-later: string, generic.to: string, generic.confirm: string, generic.unconfirmed-txhub-label: string, generic.memo: string, generic.total: string, generic.token-id: string, generic.recommended: string, highFeeModal.description: string, generic.cancel: string, generic.sell: string, generic.start: string, generic.unsafe-address: string, modal-edit-fee.gas-limit.tooltip: string, generic.sell-crypto: string, generic.unable-to-verify: string, modal-edit-fee.base-fee.label: string, generic.reset: string, history-list.empty-month: string, generic.reject: string, generic.status: string, generic.send: string, history-list.load-more: string, generic.reveal: string, modal-edit-fee.current-base-fee.tooltip: string, generic.show: string, generic.transaction-nonce: string, generic.submit: string, modal-edit-fee.gas-price.label: string, generic.unlock: string, generic.unsafe-address-desc2: string, generic.symbol: string, highFeeModal.swaps.description: string, generic.swap: string, generic.switch: string, generic.save: string, generic.total-fiat: string, generic.unsafe-address-desc1: string, modal-edit-fee.gas-price.tooltip: string, generic.verify: string, generic.remember: string, history-list.empty: string, modal-edit-fee.gas-limit.label: string, highFeeModal.checkbox: string, highFeeModal.title: string, modal-edit-fee.max-fee: string, generic.token: string, modal-edit-fee.subheader.legacy: string, generic.time: string, modal-edit-fee.max-base-price.tooltip: string, validate-allowance.minimum: string, modal-transaction-failed.description: string, generic.settings: string, warning.backup-secret-phrase: string, validate-address.receiver-matches-sender: string, wallet-selector-popup.max-limit-reached: string, modal-edit-fee.max-base-price.label: string, modal-edit-fee.title: string, wallet-select.multi-chain-wallet-description: string, validate-chain-id.generic.number: string, generic.stop-go-back-button: string, modal-receive.account-does-not-exist: string, send.confirm.hardware-wallet-failed-message: string, validate-address.generic: string, modal-remove-wallet.proceed-anyway: string, validate-allowance.generic: string, modal-edit-fee.header: string, {dynamicKey}: string, validate-chain-id.generic.rpc: string, modal-transaction-failed.title: string, modal-edit-fee.subheader.eip1559: string, settings.secure-wallet: string, modal-edit-fee.miner-fee: string, validate-allowance.maximum: string, modal-receive.title: string, validate-allowance.decimals: string, modal-edit-fee.priority-price.label: string, modal-edit-fee.priority-price.tooltip: string, validate-tag.all-numbers: string, validate-chain-id.generic.unique: string, modal-edit-fee.subheader-tooltip: string, send.hardware-wallet-message: string, wallet-selector-popup.manage-wallets-button: string, modal-transaction-failed.btn-try-again: string, first-time-education-modal.step1.body.list1: string, component.transaction-item.status.pending: string, component.input-password-new.placeholder: string, validate-amount.minimum: string, component.input-password.confirm.validation: string, validate-amount.minimum-threshold: string, validate.generic: string, validate-url.secure-prefix: string, validate-seed-phrase.length-24: string, validate-seed-phrase.generic: string, validate-url.generic: string, validate-url.prefix: string, validate-password.length: string, validate-number.no-limit-set: string, validate-password.case: string, validate-number.not-a-number: string, validate-url.only-plain-localhost: string, validate-seed-phrase.length-12: string, validate-password.digit: string, validate-password.symbol: string, validate-asset-decimal.generic: string, validate-amount.min: string, input-amount.use-default-button: string, component.input-seed-phrase.select.placeholder: string, validate-seed-phrase.length: string, component.input-password.confirm.placeholder: string, validate-amount.max: string, component.input-seed-phrase.select.label: string, validate-amount.decimals: string, modal-stepper.step-counter: string, component.transaction-item.status.confirmed: string, validate-amount.gas: string, first-time-education-modal.step1.body.subtitle: string, component.transaction-item.type.delegate: string, first-time-education-modal.button.next-step: string, component.input-password.placeholder: string, component.copy-to-clipboard.tooltip-copy-network-address: string, component.transaction-item.type.swap: string, component.input-password-new.confirm.placeholder: string, component.transaction-item.type.approve: string, component.select-seed-phrase.input.validation.error: string, component.transaction-item.status.failed: string, first-time-education-modal.step1.body.list3: string, validate-amount.generic: string, component.input-amount.placeholder: string, component.transaction-item.type.receive: string, component.transaction-item.type.send: string, component.transaction-item.type.trade: string, component.transaction-item.type.compound: string, generic.copy: string, component.transaction-item.type.undelegate: string, component.nft-media-asset.missing-media: string, generic.download: string, component.transaction-item.type.redelegate: string, first-time-education-modal.step2.title: string, component.transaction-item.type.claim: string, asset-image.token-network-tooltip: string, first-time-education-modal.step1.body: string, component.transaction-item.type.contract: string, component.copy-to-clipboard.tooltip-copy-address: string, validate-amount.maximum: string, component.input-address.placeholder: string, first-time-education-modal.step1.title: string, first-time-education-modal.step1.body.list2: string, component.transaction-item.type.claim-rewards: string, component.copy-to-clipboard.tooltip-copied: string, modal-edit-fee.bitcoin.network-fee.tooltip: string, modal-edit-fee.bitcoin.network-fee.label: string, gas-station-badge.High: string, gas-station-badge.Medium: string, gas-station.header: string, component.transaction-item.type.Coin: string, component.transaction-item.type.Dapp: string, component.transaction-item.type.Token: string, gas-station.fast: string, component.transaction-item.type.Swap: string, gas-station.estimates.heading: string, gas-station.minutes: string, gas-station.minute: string, gas-station.average: string, gas-station.heading: string, gas-station.safe: string, gas-station-badge.Low: string, dashboard.reduced-fee-applied: string, backup-seedphrase-cta.buy-crypto-header: string, sell-crypto-input-amount.wallet-balance: string, validation.error-max-amount: string, payment.wire-title: string, quote-item.best-rate: string, payment.pse-title: string, payment.other-title: string, payment.shopee_pay-title: string, quote-counter.counting: string, sell-crypto.fiat-input-label: string, dashboard.crypto-input-label: string, validation.sell-crypto-error-max-amount: string, dashboard.quotes-list-category-mobile_pay: string, payment.upi-title: string, quote-counter.fetching: string, payment.gcash-title: string, mascot.sell-pristine-subheader: string, currency-selection-modal.input-placeholder: string, sell-crypto.amount-input-label: string, validation.sell-crypto-error-min-amount: string, currency-list-item.coming-soon-for-ledger: string, buy-crypto.quote-error: string, dashboard.fiat-input-label: string, payment.bank_transfer-title: string, mascot.sell-pristine-header: string, mascot.no-tokens-found-header: string, currency-selection-modal.search-list-header: string, payment.apple_pay-title: string, buy-crypto.quote-too-high-error: string, payment.credit_card-title: string, payment.fpbt-title: string, dashboard.quotes-list-category-other: string, dashboard.quotes-header-title: string, mascot.invalid-header: string, payment.bpi-title: string, dashboard.quotes-list-category-bank_transfer: string, mascot.invalid-subheader: string, payment.digital_wallet-title: string, buy-crypto.quote-error-subheader: string, mascot.no-tokens-found-subheader: string, currency-selection-modal.other-list-header: string, dashboard.quotes-header-title-v2: string, payment.google_pay-title: string, currency-selection-modal.popular-list-header: string, dashboard.quotes-list-category-digital_wallet: string, buy-crypto.quote-too-high-error-subheader: string, dashboard.reduced-fee-cta: string, payment.maya-title: string, payment.mobile_pay-title: string, payment.astropay-title: string, crypto-input.on-network-label: string, mascot.no-quotes-subheader: string, payment.open_banking-title: string, dashboard.quotes-list-category-credit_card: string, payment.cash_app-title: string, currency-selection-modal.fiat-header: string, payment.imps-title: string, currency-selection-modal.crypto-header: string, mascot.no-quotes-header: string, currency-selection-modal.header: string, payment.pix-title: string, payment.union_bank-title: string, payment.grab_pay-title: string, payment.instant.transfer: string, validation.error-min-amount: string, validation.sell-crypto-error-balance-exceeded: string, stake-hint.rewards-calculation-after-unstake: string, wmp-swap-minimum-received: string, PriceImpactDescription: string, quote: string, ProviderFeeDesc: string, otc-home-countdownInfo-process: string, mp-checkout-go-back: string, QuoteExpired: string, HideDetails: string, ViewDetails: string, send-tx.content.network-fee: string, send-tx.content.quote: string, send-tx.content.swap: string, send-tx.content.contract-address: string, send-tx.content.back-to-refresh-quote: string, send-tx.content.price-impact-info: string, send-tx.content.swap-quote-expire-in: string, swap.notifications.title: string, uikit.collapse.hide-details: string, send-tx.content.provider-fee: string, send-tx.content.swap-quote-expired: string, dashboard.continue: string, uikit.collapse.view-details: string, error.fatal.description: string, error.fatal.btn: string, error.fatal.title: string, payment.p2p-title: string, p2p.withdraw-limit-day: string, p2p.banner-text: string, p2p.withdraw-limit-days: string, send-tx.content.network-fee-info: string, send-tx.title.swap: string, send-tx.content.price-impact: string, send-tx.content.provider-fee-info: string, send-tx.content.max-slippage: string, send-tx.content.minimum-received: string, generic.error: string, generic.transaction-error: string, generic.transaction-error-btn: string, alert.account-activation-fee: string, generic.xrp.account-activation-fee: string, tron.resources.energy: string, tron.resources.bandwidth: string, generic.trade.shutdown.bep2-warning: string, tron.resources.info.bandwidth: string, tron.resources.info.energy: string, tron.resources.info.title: string, staking.epoch-period-minute: string, stake.select-validators: string, staking.inactive-validators: string, staking.claim: string, staking.delegations-remaining: string, staking.claim-now: string, staking.active-validators: string, staking.epoch-period-minutes: string, tron.bandwidth.used: string, tron.energy.used: string, tron.fees.disclaimer: string, tron.fees.discount.info: string, tron.energy.summary: string, tron.bandwidth.summary: string, risk.high-risk-message: string, risk.mid-risk-message: string, risk.mid-risk-transaction: string, generic.medium-risk: string, risk.proceed: string, risk.checkbox-title: string, risk.lose-funds: string, risk.checkbox-2: string, risk.checkbox-1: string, risk.high-risk-transaction: string, risk.mid-risk-url: string, risk.high-risk-url: string, import-solana-derivation.heading: string, generic.confirm-register-token: string, generic.register: string, component.transaction-item.type.register-token: string, asset.activation-banner.coin: string, asset.activation-banner.token: string, market-sentiment.description.positive: string, market-sentiment.no-data-post: string, market-sentiment.description.negative: string, send.confirm.reserve-fee: string, market-sentiment.description.neutral: string, asset.reserve-fee-modal.token-disclaimer: string, market-sentiment.posts: string, market-sentiment.description.header: string, market-sentiment.articles: string, asset.reserve-fee-modal.disclaimer: string, market-sentiment.description.body: string, asset.activation-banner.xrp-coin: string, asset.activation-banner.enable-token: string, market-sentiment.no-data-article: string, send.confirm.reserve-fee-info: string, staking-overview.available-balance-reserved: string, asset.reserve-fee-modal.coin-disclaimer: string, asset.reserve-fee-modal.header: string, reserve-fee-modal.disclaimer: string, generic.confirm-trust-line: string, asset.reserve-fee-modal.coin-reserve-header: string, asset.reserve-fee-modal.token-reserve-header: string, transaction.trust-line.title: string, component.transaction-item.type.trust-line: string, generic.enable: string, address-and-memo-input.tag.label: string, address-and-memo-input.address.placeholder: string, validate-tag.in-range: string, address-and-memo-input.address.label: string, settings.address-book: string, address-book-modal.edit-address-and-memo.title: string, address-and-memo-input.button.label: string, address-and-memo-input.tag.placeholder: string, settings.address-book.no-wallets: string, settings.address-book.add-wallet: string, cancel-confirmation-modal.title: string, address-book-modal.add-wallet.title: string, address-book-modal.cancel-confirmation.discard: string, new-address-book-wallet.add-button.subtitle: string, address-book-modal.input-address-and-memo.title: string, address-and-memo-input.memo.placeholder: string, blockchain-list.no-blockchains-found: string, new-address-book-wallet.add-button.title: string, new-address-book-wallet.name-input.placeholder: string, address-book-modal.cancel-confirmation.keep-editing: string, address-and-memo-input.memo.label: string, address-book-modal.select-asset.title: string, address-book-modal.title: string, blockchain-list.search.placeholder: string, new-address-book-wallet.name-input.error: string, new-address-book-wallet.name-input.label: string, acknowledge-facts.fact1.text: string, acknowledge-facts.mnemonic.subheading: string, acknowledge-facts.mnemonic.heading: string, acknowledge-facts.fact2.text: string, acknowledge-facts.fact3.text: string, wallet-more-actions.sidepanel: string, send.hardware-wallet-message-app: string, currency.name.AFA: string, currency.name.ALL: string, currency.name.AFN: string, currency.name.BEF: string, currency.name.BYR: string, currency.name.CLF: string, currency.name.PHP: string, currency.name.ANG: string, currency.name.ITL: string, currency.name.XAU: string, currency.name.CAD: string, currency.name.PLN: string, currency.name.MNT: string, currency.name.BND: string, currency.name.DJF: string, currency.name.HUF: string, currency.name.BDT: string, currency.name.CVE: string, currency.name.MZN: string, currency.name.KPW: string, currency.name.TTD: string, currency.name.AUD: string, currency.name.CLP: string, currency.name.XOF: string, currency.name.NOK: string, currency.name.BTN: string, currency.name.DZD: string, currency.name.CNY: string, currency.name.HTG: string, currency.name.PKR: string, currency.name.AWG: string, currency.name.SAR: string, currency.name.HNL: string, currency.name.IMP: string, currency.name.AOA: string, currency.name.XAG: string, currency.name.BHD: string, currency.name.BMD: string, currency.name.KYD: string, currency.name.MAD: string, currency.name.ISK: string, currency.name.GBP: string, currency.name.AMD: string, currency.name.PYG: string, currency.name.MDL: string, currency.name.STN: string, currency.name.TOP: string, currency.name.COP: string, currency.name.IQD: string, currency.name.CDF: string, currency.name.GMD: string, currency.name.ARS: string, currency.name.XAF: string, currency.name.RON: string, currency.name.NPR: string, currency.name.BWP: string, currency.name.EEK: string, currency.name.TJS: string, currency.name.RSD: string, currency.name.MMK: string, currency.name.IDR: string, currency.name.PGK: string, currency.name.PEN: string, currency.name.XCD: string, currency.name.FKP: string, currency.name.BYN: string, currency.name.RUB: string, currency.name.PAB: string, currency.name.THB: string, currency.name.VES: string, currency.name.ILS: string, currency.name.ERN: string, currency.name.OMR: string, currency.name.MZM: string, currency.name.SVC: string, currency.name.BBD: string, currency.name.NZD: string, currency.name.QAR: string, currency.name.SCR: string, currency.name.BGN: string, currency.name.BRL: string, currency.name.KZT: string, currency.name.BIF: string, currency.name.NAD: string, currency.name.NIO: string, currency.name.BZD: string, currency.name.CUP: string, currency.name.NGN: string, currency.name.KHR: string, currency.name.WST: string, currency.name.INR: string, currency.name.SGD: string, currency.name.AZN: string, currency.name.DKK: string, currency.name.BSD: string, currency.name.IRR: string, currency.name.CZK: string, currency.name.RWF: string, currency.name.XPF: string, currency.name.DOP: string, currency.name.TRY: string, currency.name.TZS: string, currency.name.EGP: string, currency.name.TWD: string, currency.name.HKD: string, currency.name.GGP: string, currency.name.EUR: string, currency.name.JPY: string, currency.name.CRC: string, currency.name.BAM: string, currency.name.SLL: string, currency.name.JMD: string, currency.name.JEP: string, currency.name.JOD: string, currency.name.STD: string, currency.name.ETB: string, currency.name.CUC: string, currency.name.FJD: string, currency.name.TND: string, currency.name.BOB: string, currency.name.KMF: string, currency.name.UAH: string, currency.name.LVL: string, currency.name.TMT: string, currency.name.KES: string, currency.name.HRK: string, currency.name.UGX: string, currency.name.AED: string, currency.name.KWD: string, currency.name.SKK: string, currency.name.GEL: string, currency.name.ZWL: string, currency.name.UYU: string, currency.name.LAK: string, currency.name.KGS: string, currency.name.USD: string, currency.name.SBD: string, currency.name.DEM: string, currency.name.LYD: string, currency.name.ZAR: string, currency.name.YER: string, currency.name.UZS: string, currency.name.VEF: string, currency.name.GTQ: string, currency.name.LRD: string, currency.name.KRW: string, currency.name.SOS: string, currency.name.XDR: string, currency.name.GHS: string, currency.name.LSL: string, currency.name.GRD: string, currency.name.VUV: string, currency.name.LBP: string, currency.name.LKR: string, currency.name.SYP: string, currency.name.GIP: string, currency.name.LTL: string, currency.name.VND: string, currency.name.MRU: string, currency.name.SRD: string, currency.name.SHP: string, currency.name.ZMW: string, currency.name.MRO: string, currency.name.SDG: string, currency.name.ZMK: string, currency.name.SEK: string, currency.name.MOP: string, currency.name.MVR: string, currency.name.SZL: string, currency.name.GNF: string, currency.name.MUR: string, currency.name.MYR: string, currency.name.MWK: string, currency.name.MKD: string, currency.name.CHF: string, currency.name.MGA: string, currency.name.GYD: string, currency.name.MXN: string, dapps.network-hint: string, dapps.manage-connections: string, dapps.not-connected: string, dapps.disconnect: string, dapp.connected-to: string, dapp.chainId-switched: string, dapp.disconnected-from: string, setup-biometrics.subHeading: string, generic.set-up-biometrics: string, settings.biometric-enable: string, setup-biometrics.heading: string, generic.unlock-biometrics: string, settings.biometrics-enabled: string, modal-remove-wallet.description-private-key: string, verify-identity.subheading: string, generic.biometrics-register: string, setup-biometrics.subheading: string, generic.biometrics-verifying: string, settings.biometric-login: string, verify-identity.heading: string, generic.biometrics-redirecting: string, unlock.use-password-instead: string, setup-biometrics.steps: string, network-list.empty-title: string, generic.custom-networks: string, network-list.empty-caption: string, select-asset.receive.title: string, select-asset.send.title: string, switch-modal.origin-not-connected: string, generic.connected: string, wallet-selector-popup.add-account-button: string, generic.current-account: string, import-hardware-connect-select-chain-header: string, import-hardware-connect-device.open-app-description: string, import-hardware-connect-correct-app-alert: string, generic.connected-account: string, dapps.address: string, manage-assets.not-supported: string, settings.change-account-name: string, generic.action-required: string, dapps.account-connected: string, settings.enable-export-private-key: string, settings.export-private-key.file-password.description: string, settings.enable-export-private-key.tooltip: string, settings.export-private-key.file-password.link: string, import-private-key.blockchain.label: string, modal-view-private-key.banner.description: string, settings.export-private-key: string, modal-view-private-key.banner.title: string, generic.reveal-private-key: string, settings.show-private-key: string, generic.download-private-key: string, import-hardware-select-accounts-header: string, import-hardware-select-accounts-subheader: string, import-hardware-connected-device: string, generic.biometrics-verify: string, welcome.import-hw.description: string, welcome.import-hw.title: string, generic.retry: string, generic.show-less: string, generic.show-more: string, manage-crypto.show-more-tooltip: string, asset.reserve-fee-modal.header-1: string, asset.reserve-fee-modal.cta: string, component.transaction-item.type.inscribe: string, transaction.inscribe.title: string, generic.advanced: string, dashboard.show-balance: string, dashboard.hide-balance: string, generic.beginner: string, generic.adding: string, settings.wallet-name-required: string, wallet-selector-popup.private-key-wallets: string, settings.wallet-name-already-exists: string, settings.remove-account: string, wallet-selector-popup.hardware-wallets: string, wallets.wallet-name: string, modal-remove-account.content-description: string, generic.edit-account: string, generic.content-missing: string, wallets.wallet-accounts: string, settings.wallet-name-too-long: string, wallets.account-name: string, wallet-selector-popup.mnemonic-wallets: string, generic.content-missing-description: string, wallets.private-key: string, generic.edit-wallet: string, modal-remove-account.title: string, wallets.secret-phrase: string, generic.accounts: string, universal-gas.not-enough-balance: string, generic.available: string, generic.pay-fee-with-flexgas: string, universal-gas.modal.title: string, universal-gas.custom-fee: string, acknowledge-facts.fact1-new.text: string, acknowledge-facts.fact3-new.text: string, onboarding.import-wallet.wallet-name-already-exists: string, create-password.input.placeholder: string, component.blockchain-select.select-network: string, onboarding.completed.heading: string, validate-password.common: string, onboarding.authenticate.footer: string, onboarding.authenticate.reset-wallet: string, onboarding.explore.extension-pinned: string, authentication-selection.recommended: string, onboarding.explore.dapp-cta: string, onboarding.authenticate.authenticating: string, welcome.first-wallet.heading: string, authentication-selection.subheading: string, create-password.input.confirm.label: string, onboarding.explore.side-panel-subheader: string, create-password.input.label: string, generic.biometrics-register-new: string, onboarding.explore.close-side-panel: string, onboarding.explore.open-side-panel: string, onboarding.select-import-method.hardware-wallets-header: string, onboarding.select-import-method.heading: string, onboarding.stepper.title: string, onboarding.explore.pin-description: string, onboarding.explore.side-panel-description: string, acknowledge-facts.heading: string, create-password.input-confirm.placeholder: string, welcome.additional-wallet.heading: string, authentication-selection.creating-mnemonic: string, onboarding.explore.pin-hint-description: string, onboarding.authenticate.subheading-password: string, onboarding.explore.top-app: string, onboarding.explore.dapp-description: string, validate-password.max-length: string, onboarding.authenticate.heading: string, onboarding.authenticate.subheading-biometrics: string, authentication-selection.biometrics-registered: string, onboarding.explore.pin-subheader: string, authentication-selection.biometrics-subheading-new: string, onboarding.explore.side-panel-header: string, set-password.heading-new: string, onboarding.authenticate.button: string, onboarding.explore.pin-cta: string, onboarding.explore.pin: string, authentication-selection.heading: string, onboarding.select-import-method.subheading: string, onboarding.completed.subheading: string, onboarding.authenticate.creating-wallet: string, authentication-selection.setup-password: string, welcome.terms: string, welcome.create-new-wallet: string, set-password.subheading-new: string, onboarding.completed.confirm: string, onboarding.header.help: string, welcome.existing-wallet: string, welcome.creating-wallet: string, generic.biometrics-verify-new: string, acknowledge-facts.fact2-new.text: string, onboarding.create-password.loading: string, onboarding.select-import-method.other-wallet: string, fund.cex-deposit-providers.label: string, fund.header: string, cex-funding.qr-scan.title: string, fund.mobile-platform-select.label: string, fund.buy-locally.subtitle: string, fund.cex-deposit.title: string, fund.buy-crypto.title: string, fund.receive-crypto.subtitle: string, fund.cex-deposit.subtitle: string, fund.receive-crypto.title: string, generic.fund: string, cex-funding.qr-scan.return: string, fund.buy-crypto.subtitle: string, fund.buy-locally.title: string, cex-funding-transfer-success: string, fund.mobile-platform-select.header: string, cex-funding.qr-scan.description: string, welcome.import-qr-code: string, welcome.import-qr-code.description: string, import-wallet.import-with-qr-code: string, import-wallet.qr.error-parsing-frame: string, import-wallet.qr.scan-again: string, import-wallet.qr.instructions-subheading: string, import-wallet.qr.scan-qr-code: string, import-wallet.qr.camera-denied: string, import-wallet.qr-to-mobile.completed: string, import-wallet.qr.request-camera: string, import-wallet.qr.heading: string, import-wallet.qr.body-verified: string, import-wallet.qr.body: string, import-wallet.qr.body-loading: string, import-wallet.import-with-secret-phrase-or-private-key: string, import-wallet.qr.password-incorrect: string, import-wallet.qr.password-heading: string, import-wallet.qr.scanning-instructions: string, import-wallet.qr.password-sub-heading: string, import-wallet.qr.scanning: string, settings.qr-sync: string, token-asset-list.collapse-all-assets: string, token-asset-list.show-all-assets: string, home-page.disclaimer: string, home.earn-widget.title: string, home.earn-widget.yield: string, home.earn-widget.term: string, home.earn-widget.caption: string, alpha-tokens.title: string, popular-tokens.title: string, popular-tokens.top-title: string, popular-tokens.section-title: string, top-movers.title: string, top-movers.rwa-protocols-title: string, top-movers.ai-title: string, top-movers.memes-title: string, import-wallet.qr.sub-heading-instructions: string, tab-wallet: string, tab-trending-tokens: string, trending-tokens.title: string, dashboard.tokens.table.price-change: string, trending-tokens.priceChange.percent_change_1h: string, trending-tokens.priceChange.percent_change_24h: string, trending-tokens.priceChange.percent_change_7d: string, import-wallet.qr.sub-heading-new: string, settings.language.pt-BR: string, settings.language.es-ES: string, settings.language.bg-BG: string, settings.language.cs-CZ: string, settings.language.el-GR: string, settings.language.kk-KZ: string, settings.language.da-DK: string, settings.language.si-LK: string, settings.language.lo-LA: string, settings.language.my-MM: string, settings.language.sv-SE: string, settings.language.ro-RO: string, settings.language.pl-PL: string, settings.language.lv-LV: string, component.transaction-item.type.revoke: string, transaction.revoke.title: string, transaction.spending-limit-unlimited: string, send.destination-address: string, tron.save-tronify: string, tron.discount: string, history-list.no-transactions-found: string, history-list.buy-crypto: string, history-list.swap-crypto: string, asset.about.header: string, asset.about.contract-security: string, asset.about.honeypot-risk: string, asset.about.stats: string, asset.about.market-cap: string, asset.about.circulating-supply: string, asset.about.total-supply: string, asset.about.volume-24h: string, asset.about.contract-address: string, asset.about.links: string, asset.history.header: string, asset.holdings.header: string, asset.holdings.collapse-all-balances: string, asset.holdings.show-all-balances: string, buy-now-widget.text.description: string, asset.about.security-header-not-scanned-honeypot: string, asset.about.security-header-risk: string, asset.about.security-header-risks: string, asset.about.security-header-warning: string, asset.about.security-header-warnings: string, asset.about.security-header: string, asset.about.buy-tax: string, asset.about.sell-tax: string, asset.about.scanned-by: string, asset.about.contract-security-tag.scanned: string, asset.about.contract-security-tag.not-scanned: string, asset.tabs.holdings: string, asset.tabs.history: string, asset.tabs.about: string, buy-now-widget.button.text: string, asset.buy-now.header: string, asset.about.security-header-not-scanned-contract: string, generic.earn: string, approvals.risk.high: string, approvals.unlimited: string, approval-detail.revoke-approval: string, approval-detail.title: string, flex-gas.vip-benefit.gold: string, approval-detail.wallet-address: string, approval-detail.unlimited-warning: string, approval-detail.amount: string, flex-gas.vip-discount: string, approvals.risk.pending: string, unlock.biometrics-issues: string, approval-detail.risk-detail: string, approval-detail.contract: string, flex-gas.vip-benefit.bronze: string, flex-gas.vip-benefit.silver: string, approval-detail.asset: string, approvals.unable-to-retrieve: string, approval-detail.contract-address: string, approvals.risk.medium: string, approvals.no-approvals: string, token-scanner.popup.volume-label: string, token-scanner.popup.price-label: string, token-scanner.popup.similar-tokens: string, vip.modal-benefits-description: string, trust-token-retry-button: string, token-scanner.popup.swap-button: string, token-scanner.popup.powered-by: string, token-scanner.popup.dismiss-button: string, token-scanner.popup.name-label: string, token-scanner.popup.market-cap-label: string, vip.banner-benefits: string, token-scanner.error.message: string, layout-settings.hide-low-balance: string, layout-settings.asset-layout: string, layout-settings.hide-nfts: string, preferences.title: string, select-network.title: string, select-crypto.all-networks: string, select-network.search-placeholder: string, select-network.az-networks: string, select-network.popular-networks: string, component.blockchain-select.all: string, inscription-balance-modal.header: string, inscription-balance-modal.description: string, inscription-balance-modal.got-button: string, settings.unlock-utxos: string, utxo.unlock-success-toast: string, utxo.no-unlocked: string, utxo.title: string, utxo.no-locked: string, utxo.fetch-error: string, utxo.lock-count: string, utxo.unlocked: string, utxo.lock-success-toast: string, utxo.locked: string, utxo.lock: string, utxo.unlock-message: string, utxo.info: string, utxo.manage-title: string, utxo.unlock-warning-message: string, utxo.info-message: string, utxo.active-locked: string, utxo.unlock-warning-title: string, utxo.unlock: string, utxo.unlock-count: string, utxo.no-bitcoin: string, utxo.active-unlocked: string, compromised-wallet-banner.title: string, compromised-wallet-banner.migrate-button: string, settings.security: string, migration.skip-and-continue: string, migration.migrate-to: string, settings.move-assets: string, migration.compromised: string, migration.no-wallets-description: string, migration.select-all: string, migration.asset-count: string, migration.deposit: string, migration.assets-selected: string, compromised-wallet-banner.learn-more: string, migration.move-selected-assets: string, migration.select-wallet: string, migration.no-assets-description: string, migration.nft-banner: string, migration.create-new-wallet: string, compromised-wallet-banner.description: string, migration.create-new-wallet-title: string, migration.multicoin-wallet: string, dust-cleaner.convert-to: string, dust-cleaner.title: string, dust-cleaner.operation.close-accounts: string, dust-cleaner.insufficient-sol-balance: string, transaction.burn.title: string, dust-cleaner.no-tokens-available: string, component.transaction-item.type.burn: string, dust-cleaner.select-destination-token: string, dust-cleaner.empty-state.change-threshold: string, dust-cleaner.small-amount-tokens: string, dust-cleaner.threshold.title: string, dust-cleaner.burn: string, preferences.dust-cleaner.title: string, dust-cleaner.high-risk-transaction: string, preferences.dust-cleaner.premium: string, dust-cleaner.understand-tokens-cannot-be-recovered: string, dust-cleaner.threshold.description: string, dust-cleaner.burning-warning: string, dust-cleaner.estimated-received: string, dust-cleaner.empty-state.message: string, dust-cleaner.select-token: string, preferences.dust-cleaner.subtitle: string, update-available.title: string, update-available.later: string, update-available.install-now: string, update-available.message: string, import-wallet.qr.no-camera-fallback: string, dapps.active-account: string, dapp.chainid-mismatch-unknown: string, switch-network.switch-to-name: string, dapp.frames-disallowed: string, dapps.use-this-account: string }
```

Record references: E2E-network-log-trust-wallet.har:492, lock-unlock-biometric.har:2, network-log.har:977, network-log.har:1234, network-log.har:2471, network-log.har:2472, network-log.har:3299.

## 29. GET bitcoincash-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:44, E2E-network-log-trust-wallet.har:381, E2E-network-log-trust-wallet.har:531, E2E-network-log-trust-wallet.har:697, E2E-network-log-trust-wallet.har:843, E2E-network-log-trust-wallet.har:1050, add-cutom-network.har:160, lock-unlock-biometric.har:65, network-log.har:56, network-log.har:175, network-log.har:296, network-log.har:416, network-log.har:536, network-log.har:656, network-log.har:777, network-log.har:898, network-log.har:1021, network-log.har:1144, network-log.har:1267, network-log.har:1407, network-log.har:1529, network-log.har:1652, network-log.har:1775, network-log.har:1897, network-log.har:2019, network-log.har:2138, network-log.har:2260, network-log.har:2383, network-log.har:2504, network-log.har:2630, network-log.har:2752, network-log.har:2872, network-log.har:2997, network-log.har:3115, network-log.har:3235, network-log.har:3386.

## 30. POST blast.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:269.

## 31. POST boba.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:237.

## 32. POST bouncebit.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":2,"404":35}`. MIME: text/html, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:83, E2E-network-log-trust-wallet.har:420, E2E-network-log-trust-wallet.har:571, E2E-network-log-trust-wallet.har:732, E2E-network-log-trust-wallet.har:881, E2E-network-log-trust-wallet.har:1089, add-cutom-network.har:270, lock-unlock-biometric.har:95, network-log.har:84, network-log.har:204, network-log.har:324, network-log.har:445, network-log.har:565, network-log.har:685, network-log.har:805, network-log.har:927, network-log.har:1051, network-log.har:1173, network-log.har:1296, network-log.har:1437, network-log.har:1558, network-log.har:1682, network-log.har:1804, network-log.har:1927, network-log.har:2047, network-log.har:2167, network-log.har:2288, network-log.har:2412, network-log.har:2532, network-log.har:2537, network-log.har:2660, network-log.har:2780, network-log.har:2902, network-log.har:3025, network-log.har:3144, network-log.har:3264, network-log.har:3415.

## 33. POST bsc.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":8,"200":23}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<{ to: string, data: string } | string>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<string>, jsonrpc: string }
OR
Array<{ id: number, method: string, params: Array<{ to: string, data: string } | string>, jsonrpc: string }>
```

Response:

```text
{ id: number, result: string, jsonrpc: string }
OR
Array<{ id: number, result: string, jsonrpc: string }>
OR
Array<{ jsonrpc: string, id: number, result: string }>
```

Record references: E2E-network-log-trust-wallet.har:187, E2E-network-log-trust-wallet.har:212, E2E-network-log-trust-wallet.har:294, E2E-network-log-trust-wallet.har:313, E2E-network-log-trust-wallet.har:315, E2E-network-log-trust-wallet.har:316, E2E-network-log-trust-wallet.har:317, E2E-network-log-trust-wallet.har:318, E2E-network-log-trust-wallet.har:319, E2E-network-log-trust-wallet.har:320, E2E-network-log-trust-wallet.har:323, E2E-network-log-trust-wallet.har:324, E2E-network-log-trust-wallet.har:945, add-cutom-network.har:105, add-cutom-network.har:109, add-cutom-network.har:110, add-cutom-network.har:111, add-cutom-network.har:115, add-cutom-network.har:116, add-cutom-network.har:117, add-cutom-network.har:283, add-cutom-network.har:288, add-cutom-network.har:289, network-log.har:1343, network-log.har:1344, network-log.har:1345, network-log.har:1346, network-log.har:1350, network-log.har:1353, network-log.har:1354, network-log.har:1355.

## 34. GET btc-book.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"0":3,"200":205}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedBalance: string, unconfirmedTxs: number, txs: number }
OR
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:85, E2E-network-log-trust-wallet.har:98, E2E-network-log-trust-wallet.har:105, E2E-network-log-trust-wallet.har:127, E2E-network-log-trust-wallet.har:146, E2E-network-log-trust-wallet.har:152, E2E-network-log-trust-wallet.har:161, E2E-network-log-trust-wallet.har:169, E2E-network-log-trust-wallet.har:264, E2E-network-log-trust-wallet.har:422, E2E-network-log-trust-wallet.har:433, E2E-network-log-trust-wallet.har:447, E2E-network-log-trust-wallet.har:459, E2E-network-log-trust-wallet.har:470, E2E-network-log-trust-wallet.har:481, E2E-network-log-trust-wallet.har:573, E2E-network-log-trust-wallet.har:617, E2E-network-log-trust-wallet.har:643, E2E-network-log-trust-wallet.har:652, E2E-network-log-trust-wallet.har:657, E2E-network-log-trust-wallet.har:662, E2E-network-log-trust-wallet.har:734, E2E-network-log-trust-wallet.har:768, E2E-network-log-trust-wallet.har:890, E2E-network-log-trust-wallet.har:931, E2E-network-log-trust-wallet.har:955, E2E-network-log-trust-wallet.har:964, E2E-network-log-trust-wallet.har:970, E2E-network-log-trust-wallet.har:977, E2E-network-log-trust-wallet.har:999, E2E-network-log-trust-wallet.har:1007, E2E-network-log-trust-wallet.har:1091, add-cutom-network.har:280, lock-unlock-biometric.har:14, lock-unlock-biometric.har:33, lock-unlock-biometric.har:42, lock-unlock-biometric.har:97, network-log.har:4, network-log.har:16, network-log.har:30, network-log.har:86, network-log.har:100, network-log.har:112, network-log.har:124, network-log.har:137, network-log.har:148, network-log.har:207, network-log.har:222, network-log.har:235, network-log.har:246, network-log.har:258, network-log.har:270, network-log.har:326, network-log.har:342, network-log.har:353, network-log.har:365, network-log.har:377, network-log.har:390, network-log.har:447, network-log.har:461, network-log.har:473, network-log.har:486, network-log.har:499, network-log.har:510, network-log.har:567, network-log.har:581, network-log.har:594, network-log.har:606, network-log.har:618, network-log.har:629, network-log.har:687, network-log.har:702, network-log.har:714, network-log.har:725, network-log.har:737, network-log.har:750, network-log.har:807, network-log.har:822, network-log.har:834, network-log.har:846, network-log.har:862, network-log.har:872, network-log.har:929, network-log.har:945, network-log.har:958, network-log.har:970, network-log.har:982, network-log.har:997, network-log.har:1053, network-log.har:1069, network-log.har:1082, network-log.har:1095, network-log.har:1107, network-log.har:1117, network-log.har:1176, network-log.har:1193, network-log.har:1205, network-log.har:1216, network-log.har:1228, network-log.har:1241, network-log.har:1298, network-log.har:1313, network-log.har:1327, network-log.har:1349, network-log.har:1368, network-log.har:1379, network-log.har:1439, network-log.har:1455, network-log.har:1467, network-log.har:1478, network-log.har:1490, network-log.har:1503, network-log.har:1561, network-log.har:1576, network-log.har:1587, network-log.har:1599, network-log.har:1612, network-log.har:1624, network-log.har:1684, network-log.har:1699, network-log.har:1712, network-log.har:1725, network-log.har:1737, network-log.har:1748, network-log.har:1806, network-log.har:1822, network-log.har:1837, network-log.har:1847, network-log.har:1859, network-log.har:1871, network-log.har:1930, network-log.har:1944, network-log.har:1956, network-log.har:1967, network-log.har:1980, network-log.har:1992, network-log.har:2049, network-log.har:2064, network-log.har:2076, network-log.har:2088, network-log.har:2100, network-log.har:2112, network-log.har:2169, network-log.har:2186, network-log.har:2198, network-log.har:2210, network-log.har:2222, network-log.har:2234, network-log.har:2291, network-log.har:2305, network-log.har:2317, network-log.har:2330, network-log.har:2343, network-log.har:2357, network-log.har:2414, network-log.har:2428, network-log.har:2441, network-log.har:2453, network-log.har:2464, network-log.har:2478, network-log.har:2534, network-log.har:2539, network-log.har:2556, network-log.har:2567, network-log.har:2579, network-log.har:2591, network-log.har:2602, network-log.har:2662, network-log.har:2676, network-log.har:2688, network-log.har:2702, network-log.har:2714, network-log.har:2726, network-log.har:2782, network-log.har:2798, network-log.har:2809, network-log.har:2822, network-log.har:2834, network-log.har:2846, network-log.har:2904, network-log.har:2919, network-log.har:2931, network-log.har:2944, network-log.har:2956, network-log.har:2967, network-log.har:3027, network-log.har:3041, network-log.har:3053, network-log.har:3064, network-log.har:3077, network-log.har:3089, network-log.har:3146, network-log.har:3160, network-log.har:3172, network-log.har:3185, network-log.har:3196, network-log.har:3208, network-log.har:3266, network-log.har:3281, network-log.har:3293, network-log.har:3330, network-log.har:3339, network-log.har:3348, network-log.har:3356, network-log.har:3417, network-log.har:3432, network-log.har:3445, network-log.har:3456.

## 35. POST callisto.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: E2E-network-log-trust-wallet.har:54, E2E-network-log-trust-wallet.har:389, E2E-network-log-trust-wallet.har:540, E2E-network-log-trust-wallet.har:705, E2E-network-log-trust-wallet.har:851, E2E-network-log-trust-wallet.har:1059, add-cutom-network.har:195, lock-unlock-biometric.har:73, network-log.har:61, network-log.har:180, network-log.har:301, network-log.har:422, network-log.har:541, network-log.har:661, network-log.har:782, network-log.har:904, network-log.har:1026, network-log.har:1149, network-log.har:1273, network-log.har:1413, network-log.har:1534, network-log.har:1657, network-log.har:1780, network-log.har:1903, network-log.har:2024, network-log.har:2144, network-log.har:2265, network-log.har:2389, network-log.har:2509, network-log.har:2635, network-log.har:2757, network-log.har:2878, network-log.har:3002, network-log.har:3120, network-log.har:3240, network-log.har:3392.

## 36. POST cardano-graphql.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":180}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent.

Request:

```text
{ operationName: string, variables: { address: string }, query: string }
```

Response:

```text
{ data: { utxos: Array<UNKNOWN item; empty in capture>, cardano: { tip: { slotNo: string } } } }
OR
{ data: { delegations: Array<UNKNOWN item; empty in capture> } }
OR
{ data: { utxos: { aggregate: { sum: { value: null } } } } }
OR
{ data: { activeStake: Array<UNKNOWN item; empty in capture> } }
OR
{ data: { stakeDeregistrations: Array<UNKNOWN item; empty in capture> } }
```

Record references: E2E-network-log-trust-wallet.har:56, E2E-network-log-trust-wallet.har:57, E2E-network-log-trust-wallet.har:58, E2E-network-log-trust-wallet.har:59, E2E-network-log-trust-wallet.har:60, E2E-network-log-trust-wallet.har:391, E2E-network-log-trust-wallet.har:392, E2E-network-log-trust-wallet.har:393, E2E-network-log-trust-wallet.har:394, E2E-network-log-trust-wallet.har:395, E2E-network-log-trust-wallet.har:543, E2E-network-log-trust-wallet.har:544, E2E-network-log-trust-wallet.har:545, E2E-network-log-trust-wallet.har:546, E2E-network-log-trust-wallet.har:547, E2E-network-log-trust-wallet.har:707, E2E-network-log-trust-wallet.har:708, E2E-network-log-trust-wallet.har:709, E2E-network-log-trust-wallet.har:710, E2E-network-log-trust-wallet.har:711, E2E-network-log-trust-wallet.har:854, E2E-network-log-trust-wallet.har:855, E2E-network-log-trust-wallet.har:856, E2E-network-log-trust-wallet.har:857, E2E-network-log-trust-wallet.har:858, E2E-network-log-trust-wallet.har:1061, E2E-network-log-trust-wallet.har:1062, E2E-network-log-trust-wallet.har:1063, E2E-network-log-trust-wallet.har:1064, E2E-network-log-trust-wallet.har:1065, add-cutom-network.har:202, add-cutom-network.har:203, add-cutom-network.har:204, add-cutom-network.har:205, add-cutom-network.har:206, lock-unlock-biometric.har:75, lock-unlock-biometric.har:76, lock-unlock-biometric.har:77, lock-unlock-biometric.har:78, lock-unlock-biometric.har:79, network-log.har:63, network-log.har:64, network-log.har:65, network-log.har:66, network-log.har:67, network-log.har:183, network-log.har:184, network-log.har:185, network-log.har:186, network-log.har:187, network-log.har:303, network-log.har:304, network-log.har:305, network-log.har:306, network-log.har:307, network-log.har:424, network-log.har:425, network-log.har:426, network-log.har:427, network-log.har:428, network-log.har:544, network-log.har:545, network-log.har:546, network-log.har:547, network-log.har:548, network-log.har:664, network-log.har:665, network-log.har:666, network-log.har:667, network-log.har:668, network-log.har:784, network-log.har:785, network-log.har:786, network-log.har:787, network-log.har:788, network-log.har:906, network-log.har:907, network-log.har:908, network-log.har:909, network-log.har:910, network-log.har:1028, network-log.har:1029, network-log.har:1030, network-log.har:1031, network-log.har:1032, network-log.har:1152, network-log.har:1153, network-log.har:1154, network-log.har:1155, network-log.har:1156, network-log.har:1275, network-log.har:1276, network-log.har:1277, network-log.har:1278, network-log.har:1279, network-log.har:1415, network-log.har:1416, network-log.har:1417, network-log.har:1418, network-log.har:1419, network-log.har:1536, network-log.har:1537, network-log.har:1538, network-log.har:1539, network-log.har:1540, network-log.har:1660, network-log.har:1661, network-log.har:1662, network-log.har:1663, network-log.har:1664, network-log.har:1782, network-log.har:1783, network-log.har:1784, network-log.har:1785, network-log.har:1786, network-log.har:1905, network-log.har:1906, network-log.har:1907, network-log.har:1908, network-log.har:1909, network-log.har:2026, network-log.har:2027, network-log.har:2028, network-log.har:2029, network-log.har:2030, network-log.har:2146, network-log.har:2147, network-log.har:2148, network-log.har:2149, network-log.har:2150, network-log.har:2267, network-log.har:2268, network-log.har:2269, network-log.har:2270, network-log.har:2271, network-log.har:2391, network-log.har:2392, network-log.har:2393, network-log.har:2394, network-log.har:2395, network-log.har:2511, network-log.har:2512, network-log.har:2513, network-log.har:2514, network-log.har:2515, network-log.har:2638, network-log.har:2639, network-log.har:2640, network-log.har:2641, network-log.har:2642, network-log.har:2759, network-log.har:2760, network-log.har:2761, network-log.har:2762, network-log.har:2763, network-log.har:2880, network-log.har:2881, network-log.har:2882, network-log.har:2883, network-log.har:2884, network-log.har:3004, network-log.har:3005, network-log.har:3006, network-log.har:3007, network-log.har:3008, network-log.har:3123, network-log.har:3124, network-log.har:3125, network-log.har:3126, network-log.har:3127, network-log.har:3242, network-log.har:3243, network-log.har:3244, network-log.har:3245, network-log.har:3246, network-log.har:3394, network-log.har:3395, network-log.har:3396, network-log.har:3397, network-log.har:3398.

## 37. POST celo.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:228.

## 38. POST classic.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:122.

## 39. POST conflux-evm.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:248.

## 40. GET cosmos.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:130.

## 41. GET cosmos.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:129.

## 42. GET cosmos.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:128.

## 43. GET cosmos.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:127.

## 44. POST cronos.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:234.

## 45. GET crypto-org-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:69, E2E-network-log-trust-wallet.har:405, E2E-network-log-trust-wallet.har:557, E2E-network-log-trust-wallet.har:721, E2E-network-log-trust-wallet.har:867, E2E-network-log-trust-wallet.har:1074, add-cutom-network.har:227, lock-unlock-biometric.har:86, network-log.har:75, network-log.har:195, network-log.har:315, network-log.har:436, network-log.har:556, network-log.har:676, network-log.har:796, network-log.har:918, network-log.har:1041, network-log.har:1164, network-log.har:1287, network-log.har:1428, network-log.har:1549, network-log.har:1672, network-log.har:1794, network-log.har:1918, network-log.har:2038, network-log.har:2158, network-log.har:2279, network-log.har:2403, network-log.har:2523, network-log.har:2650, network-log.har:2771, network-log.har:2892, network-log.har:3016, network-log.har:3135, network-log.har:3254, network-log.har:3406.

## 46. GET crypto-org-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: E2E-network-log-trust-wallet.har:68, E2E-network-log-trust-wallet.har:404, E2E-network-log-trust-wallet.har:556, E2E-network-log-trust-wallet.har:720, E2E-network-log-trust-wallet.har:866, E2E-network-log-trust-wallet.har:1073, add-cutom-network.har:226, lock-unlock-biometric.har:85, network-log.har:74, network-log.har:194, network-log.har:314, network-log.har:435, network-log.har:555, network-log.har:675, network-log.har:795, network-log.har:917, network-log.har:1040, network-log.har:1163, network-log.har:1286, network-log.har:1427, network-log.har:1548, network-log.har:1671, network-log.har:1793, network-log.har:1917, network-log.har:2037, network-log.har:2157, network-log.har:2278, network-log.har:2402, network-log.har:2522, network-log.har:2649, network-log.har:2770, network-log.har:2891, network-log.har:3015, network-log.har:3134, network-log.har:3253, network-log.har:3405.

## 47. GET crypto-org-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:67, E2E-network-log-trust-wallet.har:403, E2E-network-log-trust-wallet.har:555, E2E-network-log-trust-wallet.har:719, E2E-network-log-trust-wallet.har:865, E2E-network-log-trust-wallet.har:1072, add-cutom-network.har:225, lock-unlock-biometric.har:84, network-log.har:73, network-log.har:193, network-log.har:313, network-log.har:434, network-log.har:554, network-log.har:674, network-log.har:794, network-log.har:916, network-log.har:1039, network-log.har:1162, network-log.har:1285, network-log.har:1426, network-log.har:1547, network-log.har:1670, network-log.har:1792, network-log.har:1916, network-log.har:2036, network-log.har:2156, network-log.har:2277, network-log.har:2401, network-log.har:2521, network-log.har:2648, network-log.har:2769, network-log.har:2890, network-log.har:3014, network-log.har:3133, network-log.har:3252, network-log.har:3404.

## 48. GET crypto-org-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:66, E2E-network-log-trust-wallet.har:402, E2E-network-log-trust-wallet.har:554, E2E-network-log-trust-wallet.har:718, E2E-network-log-trust-wallet.har:864, E2E-network-log-trust-wallet.har:1071, add-cutom-network.har:224, lock-unlock-biometric.har:83, network-log.har:72, network-log.har:192, network-log.har:312, network-log.har:433, network-log.har:553, network-log.har:673, network-log.har:793, network-log.har:915, network-log.har:1038, network-log.har:1161, network-log.har:1284, network-log.har:1425, network-log.har:1546, network-log.har:1669, network-log.har:1791, network-log.har:1915, network-log.har:2035, network-log.har:2155, network-log.har:2276, network-log.har:2400, network-log.har:2520, network-log.har:2647, network-log.har:2768, network-log.har:2889, network-log.har:3013, network-log.har:3132, network-log.har:3251, network-log.har:3403.

## 49. GET dash-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:30, E2E-network-log-trust-wallet.har:369, E2E-network-log-trust-wallet.har:518, E2E-network-log-trust-wallet.har:684, E2E-network-log-trust-wallet.har:829, E2E-network-log-trust-wallet.har:1038, add-cutom-network.har:108, lock-unlock-biometric.har:53, network-log.har:43, network-log.har:163, network-log.har:284, network-log.har:404, network-log.har:524, network-log.har:644, network-log.har:765, network-log.har:885, network-log.har:1009, network-log.har:1132, network-log.har:1255, network-log.har:1395, network-log.har:1517, network-log.har:1640, network-log.har:1762, network-log.har:1885, network-log.har:2007, network-log.har:2126, network-log.har:2248, network-log.har:2370, network-log.har:2492, network-log.har:2618, network-log.har:2740, network-log.har:2860, network-log.har:2985, network-log.har:3102, network-log.har:3223, network-log.har:3374.

## 50. GET decred-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":32}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:522, E2E-network-log-trust-wallet.har:688, E2E-network-log-trust-wallet.har:835, lock-unlock-biometric.har:58, network-log.har:49, network-log.har:168, network-log.har:289, network-log.har:409, network-log.har:529, network-log.har:649, network-log.har:770, network-log.har:891, network-log.har:1013, network-log.har:1137, network-log.har:1260, network-log.har:1400, network-log.har:1522, network-log.har:1645, network-log.har:1767, network-log.har:1890, network-log.har:2012, network-log.har:2130, network-log.har:2253, network-log.har:2375, network-log.har:2497, network-log.har:2623, network-log.har:2745, network-log.har:2865, network-log.har:2990, network-log.har:3108, network-log.har:3228, network-log.har:3379.

## 51. GET digibyte-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
OR
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedBalance: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:34, E2E-network-log-trust-wallet.har:372, E2E-network-log-trust-wallet.har:521, E2E-network-log-trust-wallet.har:687, E2E-network-log-trust-wallet.har:834, E2E-network-log-trust-wallet.har:1041, add-cutom-network.har:114, lock-unlock-biometric.har:57, network-log.har:48, network-log.har:167, network-log.har:288, network-log.har:408, network-log.har:528, network-log.har:648, network-log.har:769, network-log.har:890, network-log.har:1012, network-log.har:1136, network-log.har:1259, network-log.har:1399, network-log.har:1521, network-log.har:1644, network-log.har:1766, network-log.har:1889, network-log.har:2011, network-log.har:2129, network-log.har:2251, network-log.har:2374, network-log.har:2496, network-log.har:2621, network-log.har:2744, network-log.har:2864, network-log.har:2989, network-log.har:3107, network-log.har:3227, network-log.har:3378.

## 52. GET doge-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:29, E2E-network-log-trust-wallet.har:368, E2E-network-log-trust-wallet.har:517, E2E-network-log-trust-wallet.har:683, E2E-network-log-trust-wallet.har:828, E2E-network-log-trust-wallet.har:1037, add-cutom-network.har:107, lock-unlock-biometric.har:52, network-log.har:42, network-log.har:162, network-log.har:283, network-log.har:403, network-log.har:523, network-log.har:643, network-log.har:764, network-log.har:884, network-log.har:1008, network-log.har:1131, network-log.har:1254, network-log.har:1394, network-log.har:1516, network-log.har:1639, network-log.har:1761, network-log.har:1884, network-log.har:2006, network-log.har:2125, network-log.har:2247, network-log.har:2369, network-log.har:2491, network-log.har:2617, network-log.har:2739, network-log.har:2859, network-log.har:2984, network-log.har:3101, network-log.har:3222, network-log.har:3373.

## 53. POST ethereum-sepolia-rpc.publicnode.com/

Query keys: none recorded. Status counts: `{"200":83}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ jsonrpc: string, id: string, method: string, params: Array<UNKNOWN item; empty in capture> }
OR
{ id: number, method: string, params: Array<string>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<{ from: string, to: string, value: string, data: string }>, jsonrpc: string }
OR
{ id: number, method: string, jsonrpc: string }
OR
{ jsonrpc: string, id: string, method: string, params: Array<{ to: string, data: string } | string> }
OR
{ id: number, method: string, params: Array<{ to: string, data: string } | string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, result: string, id: string }
OR
{ jsonrpc: string, id: number, result: string }
OR
{ jsonrpc: string, id: number, result: { blockHash: null, blockNumber: null, blockTimestamp: null, from: string, gas: string, gasPrice: string, hash: string, input: string, nonce: string, to: string, transactionIndex: null, value: string, type: string, chainId: string, v: string, r: string, s: string } }
OR
{ jsonrpc: string, id: number, result: { blockHash: string, blockNumber: string, blockTimestamp: string, from: string, gas: string, gasPrice: string, hash: string, input: string, nonce: string, to: string, transactionIndex: string, value: string, type: string, chainId: string, v: string, r: string, s: string } }
OR
{ jsonrpc: string, id: number, result: { blockHash: string, blockNumber: string, contractAddress: null, cumulativeGasUsed: string, effectiveGasPrice: string, from: string, gasUsed: string, logs: Array<{ address: string, topics: Array<string>, data: string, blockNumber: string, transactionHash: string, transactionIndex: string, blockHash: string, blockTimestamp: string, logIndex: string, removed: boolean }>, logsBloom: string, status: string, to: string, transactionHash: string, transactionIndex: string, type: string } }
```

Record references: E2E-network-log-trust-wallet.har:480, E2E-network-log-trust-wallet.har:482, E2E-network-log-trust-wallet.har:574, E2E-network-log-trust-wallet.har:575, E2E-network-log-trust-wallet.har:590, E2E-network-log-trust-wallet.har:591, E2E-network-log-trust-wallet.har:592, E2E-network-log-trust-wallet.har:593, E2E-network-log-trust-wallet.har:595, E2E-network-log-trust-wallet.har:596, E2E-network-log-trust-wallet.har:597, E2E-network-log-trust-wallet.har:598, E2E-network-log-trust-wallet.har:603, E2E-network-log-trust-wallet.har:604, E2E-network-log-trust-wallet.har:605, E2E-network-log-trust-wallet.har:606, E2E-network-log-trust-wallet.har:607, E2E-network-log-trust-wallet.har:616, E2E-network-log-trust-wallet.har:619, E2E-network-log-trust-wallet.har:624, E2E-network-log-trust-wallet.har:628, E2E-network-log-trust-wallet.har:630, E2E-network-log-trust-wallet.har:633, E2E-network-log-trust-wallet.har:635, E2E-network-log-trust-wallet.har:638, E2E-network-log-trust-wallet.har:639, E2E-network-log-trust-wallet.har:642, E2E-network-log-trust-wallet.har:651, E2E-network-log-trust-wallet.har:656, E2E-network-log-trust-wallet.har:661, E2E-network-log-trust-wallet.har:735, E2E-network-log-trust-wallet.har:736, E2E-network-log-trust-wallet.har:753, E2E-network-log-trust-wallet.har:754, E2E-network-log-trust-wallet.har:755, E2E-network-log-trust-wallet.har:766, E2E-network-log-trust-wallet.har:767, E2E-network-log-trust-wallet.har:778, E2E-network-log-trust-wallet.har:784, E2E-network-log-trust-wallet.har:804, E2E-network-log-trust-wallet.har:816, E2E-network-log-trust-wallet.har:891, E2E-network-log-trust-wallet.har:892, E2E-network-log-trust-wallet.har:899, E2E-network-log-trust-wallet.har:906, E2E-network-log-trust-wallet.har:907, E2E-network-log-trust-wallet.har:908, E2E-network-log-trust-wallet.har:912, E2E-network-log-trust-wallet.har:915, E2E-network-log-trust-wallet.har:916, E2E-network-log-trust-wallet.har:917, E2E-network-log-trust-wallet.har:918, E2E-network-log-trust-wallet.har:920, E2E-network-log-trust-wallet.har:921, E2E-network-log-trust-wallet.har:922, E2E-network-log-trust-wallet.har:924, E2E-network-log-trust-wallet.har:925, E2E-network-log-trust-wallet.har:929, E2E-network-log-trust-wallet.har:930, E2E-network-log-trust-wallet.har:933, E2E-network-log-trust-wallet.har:936, E2E-network-log-trust-wallet.har:939, E2E-network-log-trust-wallet.har:941, E2E-network-log-trust-wallet.har:944, E2E-network-log-trust-wallet.har:953, E2E-network-log-trust-wallet.har:954, E2E-network-log-trust-wallet.har:956, E2E-network-log-trust-wallet.har:957, E2E-network-log-trust-wallet.har:962, E2E-network-log-trust-wallet.har:963, E2E-network-log-trust-wallet.har:968, E2E-network-log-trust-wallet.har:969, E2E-network-log-trust-wallet.har:975, E2E-network-log-trust-wallet.har:976, E2E-network-log-trust-wallet.har:997, E2E-network-log-trust-wallet.har:998, E2E-network-log-trust-wallet.har:1005, E2E-network-log-trust-wallet.har:1006, E2E-network-log-trust-wallet.har:1008, E2E-network-log-trust-wallet.har:1009, E2E-network-log-trust-wallet.har:1092, add-cutom-network.har:286, add-cutom-network.har:291.

## 54. POST ethereum-sponsored.twnodes.com/naas/session/{sessionToken}/v2/

Query keys: none recorded. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<{ from: string, to: string, value: string, data: string, gas: string }>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: { sponsorable: boolean } }
```

Record references: E2E-network-log-trust-wallet.har:911, E2E-network-log-trust-wallet.har:923.

## 55. POST ethereum.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":2,"200":101}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin.

Request:

```text
{ jsonrpc: string, id: string, method: string, params: Array<{ to: string, data: string } | string> }
OR
{ id: number, method: string, params: Array<string>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<{ to: string, data: string } | string>, jsonrpc: string }
```

Response:

```text
{ id: string, result: string, jsonrpc: string }
OR
{ jsonrpc: string, id: number, result: string }
```

Record references: E2E-network-log-trust-wallet.har:122, E2E-network-log-trust-wallet.har:123, E2E-network-log-trust-wallet.har:124, E2E-network-log-trust-wallet.har:252, E2E-network-log-trust-wallet.har:253, E2E-network-log-trust-wallet.har:254, E2E-network-log-trust-wallet.har:256, E2E-network-log-trust-wallet.har:257, E2E-network-log-trust-wallet.har:258, E2E-network-log-trust-wallet.har:265, E2E-network-log-trust-wallet.har:266, E2E-network-log-trust-wallet.har:267, E2E-network-log-trust-wallet.har:270, E2E-network-log-trust-wallet.har:271, E2E-network-log-trust-wallet.har:272, E2E-network-log-trust-wallet.har:274, E2E-network-log-trust-wallet.har:275, E2E-network-log-trust-wallet.har:276, E2E-network-log-trust-wallet.har:306, E2E-network-log-trust-wallet.har:336, add-cutom-network.har:281, custom-token.har:17, custom-token.har:18, custom-token.har:19, custom-token.har:28, custom-token.har:29, custom-token.har:30, custom-token.har:32, custom-token.har:33, custom-token.har:34, custom-token.har:42, custom-token.har:43, custom-token.har:44, custom-token.har:46, custom-token.har:47, custom-token.har:48, custom-token.har:49, custom-token.har:52, custom-token.har:53, custom-token.har:54, custom-token.har:59, custom-token.har:60, custom-token.har:61, custom-token.har:63, custom-token.har:64, custom-token.har:65, custom-token.har:71, custom-token.har:74, custom-token.har:75, custom-token.har:76, custom-token.har:80, custom-token.har:81, custom-token.har:82, custom-token.har:91, custom-token.har:92, custom-token.har:93, custom-token.har:94, custom-token.har:95, custom-token.har:96, custom-token.har:97, custom-token.har:99, custom-token.har:100, custom-token.har:101, custom-token.har:104, custom-token.har:105, custom-token.har:106, custom-token.har:110, custom-token.har:111, custom-token.har:112, custom-token.har:115, custom-token.har:116, custom-token.har:117, custom-token.har:119, custom-token.har:120, custom-token.har:121, custom-token.har:124, custom-token.har:125, custom-token.har:126, custom-token.har:185, custom-token.har:186, custom-token.har:187, custom-token.har:190, custom-token.har:191, custom-token.har:192, custom-token.har:194, custom-token.har:195, custom-token.har:196, custom-token.har:198, custom-token.har:199, custom-token.har:200, custom-token.har:203, custom-token.har:204, custom-token.har:205, custom-token.har:207, custom-token.har:208, custom-token.har:209, custom-token.har:215, custom-token.har:216, custom-token.har:217, custom-token.har:228, network-log.har:1340, network-log.har:1347, network-log.har:1685.

## 56. GET evmos-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"0":2,"404":34}`. MIME: x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:78, E2E-network-log-trust-wallet.har:415, E2E-network-log-trust-wallet.har:566, E2E-network-log-trust-wallet.har:727, E2E-network-log-trust-wallet.har:876, E2E-network-log-trust-wallet.har:1084, add-cutom-network.har:244, lock-unlock-biometric.har:91, network-log.har:80, network-log.har:200, network-log.har:320, network-log.har:441, network-log.har:561, network-log.har:681, network-log.har:801, network-log.har:923, network-log.har:1047, network-log.har:1169, network-log.har:1292, network-log.har:1433, network-log.har:1554, network-log.har:1678, network-log.har:1799, network-log.har:1923, network-log.har:2043, network-log.har:2163, network-log.har:2284, network-log.har:2408, network-log.har:2528, network-log.har:2655, network-log.har:2776, network-log.har:2898, network-log.har:3021, network-log.har:3140, network-log.har:3260, network-log.har:3411.

## 57. GET evmos-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"0":4,"404":32}`. MIME: x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:77, E2E-network-log-trust-wallet.har:414, E2E-network-log-trust-wallet.har:565, E2E-network-log-trust-wallet.har:726, E2E-network-log-trust-wallet.har:875, E2E-network-log-trust-wallet.har:1083, add-cutom-network.har:243, lock-unlock-biometric.har:90, network-log.har:79, network-log.har:199, network-log.har:319, network-log.har:440, network-log.har:560, network-log.har:680, network-log.har:800, network-log.har:922, network-log.har:1046, network-log.har:1168, network-log.har:1291, network-log.har:1432, network-log.har:1553, network-log.har:1677, network-log.har:1798, network-log.har:1922, network-log.har:2042, network-log.har:2162, network-log.har:2283, network-log.har:2407, network-log.har:2527, network-log.har:2654, network-log.har:2775, network-log.har:2897, network-log.har:3020, network-log.har:3139, network-log.har:3259, network-log.har:3410.

## 58. GET evmos-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"0":2,"404":34}`. MIME: x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:76, E2E-network-log-trust-wallet.har:413, E2E-network-log-trust-wallet.har:564, E2E-network-log-trust-wallet.har:725, E2E-network-log-trust-wallet.har:874, E2E-network-log-trust-wallet.har:1082, add-cutom-network.har:242, lock-unlock-biometric.har:89, network-log.har:78, network-log.har:198, network-log.har:318, network-log.har:439, network-log.har:559, network-log.har:679, network-log.har:799, network-log.har:921, network-log.har:1045, network-log.har:1167, network-log.har:1290, network-log.har:1431, network-log.har:1552, network-log.har:1676, network-log.har:1797, network-log.har:1921, network-log.har:2041, network-log.har:2161, network-log.har:2282, network-log.har:2406, network-log.har:2526, network-log.har:2653, network-log.har:2774, network-log.har:2896, network-log.har:3019, network-log.har:3138, network-log.har:3258, network-log.har:3409.

## 59. GET evmos-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"0":3,"404":33}`. MIME: x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:75, E2E-network-log-trust-wallet.har:412, E2E-network-log-trust-wallet.har:563, E2E-network-log-trust-wallet.har:724, E2E-network-log-trust-wallet.har:873, E2E-network-log-trust-wallet.har:1081, add-cutom-network.har:241, lock-unlock-biometric.har:88, network-log.har:77, network-log.har:197, network-log.har:317, network-log.har:438, network-log.har:558, network-log.har:678, network-log.har:798, network-log.har:920, network-log.har:1044, network-log.har:1166, network-log.har:1289, network-log.har:1430, network-log.har:1551, network-log.har:1675, network-log.har:1796, network-log.har:1920, network-log.har:2040, network-log.har:2160, network-log.har:2281, network-log.har:2405, network-log.har:2525, network-log.har:2652, network-log.har:2773, network-log.har:2895, network-log.har:3018, network-log.har:3137, network-log.har:3257, network-log.har:3408.

## 60. POST evmos-jsonrpc.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"404":36}`. MIME: x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:74, E2E-network-log-trust-wallet.har:411, E2E-network-log-trust-wallet.har:562, E2E-network-log-trust-wallet.har:723, E2E-network-log-trust-wallet.har:872, E2E-network-log-trust-wallet.har:1080, add-cutom-network.har:240, lock-unlock-biometric.har:87, network-log.har:76, network-log.har:196, network-log.har:316, network-log.har:437, network-log.har:557, network-log.har:677, network-log.har:797, network-log.har:919, network-log.har:1042, network-log.har:1165, network-log.har:1288, network-log.har:1429, network-log.har:1550, network-log.har:1673, network-log.har:1795, network-log.har:1919, network-log.har:2039, network-log.har:2159, network-log.har:2280, network-log.har:2404, network-log.har:2524, network-log.har:2651, network-log.har:2772, network-log.har:2894, network-log.har:3017, network-log.har:3136, network-log.har:3256, network-log.har:3407.

## 61. POST fantom.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:223.

## 62. POST filecoin.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ id: number, jsonrpc: string, result: string }
```

Record references: add-cutom-network.har:187.

## 63. POST fio.twnodes.com/naas/session/{sessionToken}/v1/chain/get_fio_balance

Query keys: none recorded. Status counts: `{"404":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ fio_public_key: string }
```

Response:

```text
{ message: string }
```

Record references: add-cutom-network.har:166.

## 64. GET firo-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:43, E2E-network-log-trust-wallet.har:380, E2E-network-log-trust-wallet.har:530, E2E-network-log-trust-wallet.har:696, E2E-network-log-trust-wallet.har:842, E2E-network-log-trust-wallet.har:1049, add-cutom-network.har:157, lock-unlock-biometric.har:64, network-log.har:55, network-log.har:174, network-log.har:295, network-log.har:415, network-log.har:535, network-log.har:655, network-log.har:776, network-log.har:897, network-log.har:1020, network-log.har:1143, network-log.har:1266, network-log.har:1406, network-log.har:1528, network-log.har:1651, network-log.har:1774, network-log.har:1896, network-log.har:2018, network-log.har:2137, network-log.har:2259, network-log.har:2381, network-log.har:2503, network-log.har:2629, network-log.har:2751, network-log.har:2871, network-log.har:2996, network-log.har:3114, network-log.har:3234, network-log.har:3385.

## 65. GET fonts.gstatic.com/s/googlesans/v62/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: font/woff2.

Request header names: origin, referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:10.

## 66. GET fonts.gstatic.com/s/roboto/v48/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: font/woff2.

Request header names: origin, referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:9.

## 67. GET gateway.trustwallet.com/v2/projects/{projectId}/nodes

Query keys: account-abstraction, sponsored. Status counts: `{"200":33}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-tw-device-id.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ code: number, message: string, data: Array<{ name: string, network: string, nodes: Array<{ url: string, weight: string }> }> }
```

Record references: E2E-network-log-trust-wallet.har:25, E2E-network-log-trust-wallet.har:427, E2E-network-log-trust-wallet.har:620, E2E-network-log-trust-wallet.har:750, E2E-network-log-trust-wallet.har:910, add-cutom-network.har:297, network-log.har:92, network-log.har:214, network-log.har:334, network-log.har:453, network-log.har:573, network-log.har:695, network-log.har:814, network-log.har:937, network-log.har:1061, network-log.har:1183, network-log.har:1305, network-log.har:1447, network-log.har:1568, network-log.har:1693, network-log.har:1814, network-log.har:1936, network-log.har:2056, network-log.har:2177, network-log.har:2298, network-log.har:2420, network-log.har:2668, network-log.har:2790, network-log.har:2910, network-log.har:3035, network-log.har:3152, network-log.har:3272, network-log.har:3424.

## 68. GET gateway.us.trustwallet.com/amber-api/v1/domains

Query keys: arc, ton. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ domains: Array<{ id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, bridgeDirection: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, bridgeDirection: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, bridgeDirection: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number } | { id: string, name: string, type: string, finalityTime: string, chainId: string, bridgeDirection: Array<string>, dex: Array<string>, networkOrder: number }> }
```

Record references: E2E-network-log-trust-wallet.har:13, network-log.har:3304.

## 69. GET gateway.us.trustwallet.com/stream/ws

Query keys: none recorded. Status counts: `{"101":10}`. MIME: x-unknown.

Request header names: accept-encoding, accept-language, cache-control, connection, host, origin, pragma, sec-websocket-extensions, sec-websocket-key, sec-websocket-protocol, sec-websocket-version, upgrade, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:23, lock-unlock-biometric.har:1, lock-unlock-biometric.har:19, network-log.har:25, network-log.har:1074, network-log.har:1190, network-log.har:1318, network-log.har:1441, network-log.har:2550, network-log.har:3363.

## 70. GET gateway.us.trustwallet.com/v1/assets

Query keys: asset_ids. Status counts: `{"200":3}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<{ name: string, symbol: string, type: string, decimals: number, network: number, asset_id: string, icon_url: string, is_pre_ipo: boolean, is_rwa: boolean, is_scaled_ui_amount: boolean, classification: { category: string, surface: string, category_reason: string, provisional: boolean } }>
```

Record references: E2E-network-log-trust-wallet.har:173, E2E-network-log-trust-wallet.har:183, E2E-network-log-trust-wallet.har:943.

## 71. GET gateway.us.trustwallet.com/v1/assets/listings

Query keys: category_id, currency, limit, networks, sort_direction, sort_field, version. Status counts: `{"200":13}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ total: number, docs: Array<{ asset: { name: string, symbol: string, type: string, decimals: number, network: number, asset_id: string, icon_url: string, is_verified: boolean, is_pre_ipo: boolean, is_rwa: boolean, is_scaled_ui_amount: boolean }, market: { market_cap: number, circulating_supply: number, total_supply: number, max_supply: number, volume_24h: number }, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, four_meme_meta: null }> }
```

Record references: E2E-network-log-trust-wallet.har:96, E2E-network-log-trust-wallet.har:130, E2E-network-log-trust-wallet.har:174, E2E-network-log-trust-wallet.har:176, E2E-network-log-trust-wallet.har:249, E2E-network-log-trust-wallet.har:286, E2E-network-log-trust-wallet.har:287, E2E-network-log-trust-wallet.har:289, E2E-network-log-trust-wallet.har:291, E2E-network-log-trust-wallet.har:462, E2E-network-log-trust-wallet.har:506, E2E-network-log-trust-wallet.har:746, custom-token.har:12.

## 72. GET gateway.us.trustwallet.com/v1/assets/tabs-config

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<{ tab: string, categories: Array<{ id: string, name: string, sort_field: string, sort_direction: string, default_chain_handle: string, eligible_chain_handles: null, supported_sort_fields: Array<{ id: string, display_name: string }> }>, preview_size: number, preview_category_id: string, preview_sort_field: string, preview_sort_direction: string, details_screen_title: string } | { tab: string, categories: Array<{ id: string, name: string, sort_field: string, sort_direction: string, default_chain_handle: string, eligible_chain_handles: null, supported_sort_fields: Array<{ id: string, display_name: string }> }>, preview_size: number, preview_category_id: string, preview_sort_field: string, preview_sort_direction: string, details_screen_title: string } | { tab: string, categories: Array<{ id: string, name: string, is_recommended: boolean, sort_field: string, sort_direction: string, default_chain_handle: string, eligible_chain_handles: null, supported_sort_fields: Array<{ id: string, display_name: string }> }>, preview_size: number, preview_category_id: string, preview_sort_field: string, preview_sort_direction: string, details_screen_title: string }>
```

Record references: E2E-network-log-trust-wallet.har:284.

## 73. GET gateway.us.trustwallet.com/v1/assets/trending-config

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ supported_networks: Array<{ chain: number, name: string, handle: string }>, trending_networks: Array<{ chain: number, name: string, handle: string }> }
```

Record references: E2E-network-log-trust-wallet.har:285.

## 74. GET gateway.us.trustwallet.com/v1/assets/{assetId}

Query keys: none recorded. Status counts: `{"404":33}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:121, E2E-network-log-trust-wallet.har:250, E2E-network-log-trust-wallet.har:255, E2E-network-log-trust-wallet.har:263, E2E-network-log-trust-wallet.har:268, E2E-network-log-trust-wallet.har:273, E2E-network-log-trust-wallet.har:752, E2E-network-log-trust-wallet.har:756, custom-token.har:16, custom-token.har:25, custom-token.har:31, custom-token.har:40, custom-token.har:45, custom-token.har:51, custom-token.har:56, custom-token.har:62, custom-token.har:73, custom-token.har:79, custom-token.har:88, custom-token.har:90, custom-token.har:98, custom-token.har:103, custom-token.har:109, custom-token.har:114, custom-token.har:118, custom-token.har:123, custom-token.har:171, custom-token.har:189, custom-token.har:193, custom-token.har:197, custom-token.har:202, custom-token.har:206, custom-token.har:214.

## 75. GET gateway.us.trustwallet.com/v1/balances/chains

Query keys: none recorded. Status counts: `{"200":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ stats: { total: number, enabled: number, db_lookup_enabled: number, ws_supported: number }, chains: Array<{ chain_id: number, name: string, handle: string, enabled: boolean, db_lookup_enabled: boolean, ws_supported: boolean }> }
```

Record references: E2E-network-log-trust-wallet.har:18, network-log.har:931, network-log.har:2180, network-log.har:3437.

## 76. GET gateway.us.trustwallet.com/v1/buycrypto/screens/funding

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ recommended: Array<UNKNOWN item; empty in capture>, exchanges: Array<UNKNOWN item; empty in capture>, all_options: Array<{ id: string, icon: string }> }
```

Record references: E2E-network-log-trust-wallet.har:739.

## 77. GET gateway.us.trustwallet.com/v1/cex-transfer/providers/binance-pay/assets

Query keys: none recorded. Status counts: `{"200":79}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<string>
```

Record references: E2E-network-log-trust-wallet.har:20, E2E-network-log-trust-wallet.har:114, E2E-network-log-trust-wallet.har:133, E2E-network-log-trust-wallet.har:142, E2E-network-log-trust-wallet.har:157, E2E-network-log-trust-wallet.har:165, E2E-network-log-trust-wallet.har:219, E2E-network-log-trust-wallet.har:248, E2E-network-log-trust-wallet.har:283, E2E-network-log-trust-wallet.har:358, E2E-network-log-trust-wallet.har:444, E2E-network-log-trust-wallet.har:454, E2E-network-log-trust-wallet.har:465, E2E-network-log-trust-wallet.har:486, E2E-network-log-trust-wallet.har:490, E2E-network-log-trust-wallet.har:505, E2E-network-log-trust-wallet.har:509, E2E-network-log-trust-wallet.har:513, E2E-network-log-trust-wallet.har:583, E2E-network-log-trust-wallet.har:650, E2E-network-log-trust-wallet.har:666, E2E-network-log-trust-wallet.har:679, E2E-network-log-trust-wallet.har:742, E2E-network-log-trust-wallet.har:745, E2E-network-log-trust-wallet.har:763, E2E-network-log-trust-wallet.har:776, E2E-network-log-trust-wallet.har:795, E2E-network-log-trust-wallet.har:810, E2E-network-log-trust-wallet.har:822, E2E-network-log-trust-wallet.har:887, E2E-network-log-trust-wallet.har:985, E2E-network-log-trust-wallet.har:991, E2E-network-log-trust-wallet.har:1024, add-cutom-network.har:10, add-cutom-network.har:13, add-cutom-network.har:16, add-cutom-network.har:19, add-cutom-network.har:22, add-cutom-network.har:25, add-cutom-network.har:28, add-cutom-network.har:35, add-cutom-network.har:38, add-cutom-network.har:41, add-cutom-network.har:44, add-cutom-network.har:47, add-cutom-network.har:50, add-cutom-network.har:53, add-cutom-network.har:60, add-cutom-network.har:63, add-cutom-network.har:66, add-cutom-network.har:69, add-cutom-network.har:72, add-cutom-network.har:75, add-cutom-network.har:78, add-cutom-network.har:82, add-cutom-network.har:85, add-cutom-network.har:88, add-cutom-network.har:91, add-cutom-network.har:94, add-cutom-network.har:97, add-cutom-network.har:100, custom-token.har:7, custom-token.har:39, custom-token.har:87, custom-token.har:212, custom-token.har:222, lock-unlock-biometric.har:5, lock-unlock-biometric.har:9, lock-unlock-biometric.har:24, lock-unlock-biometric.har:27, lock-unlock-biometric.har:30, network-log.har:3306, network-log.har:3309, network-log.har:3312, network-log.har:3315, network-log.har:3318, network-log.har:3321, network-log.har:3324, network-log.har:3327.

## 78. GET gateway.us.trustwallet.com/v1/cex-transfer/providers/coinbase-pay/assets

Query keys: none recorded. Status counts: `{"200":79}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<string>
```

Record references: E2E-network-log-trust-wallet.har:19, E2E-network-log-trust-wallet.har:113, E2E-network-log-trust-wallet.har:132, E2E-network-log-trust-wallet.har:141, E2E-network-log-trust-wallet.har:156, E2E-network-log-trust-wallet.har:164, E2E-network-log-trust-wallet.har:218, E2E-network-log-trust-wallet.har:247, E2E-network-log-trust-wallet.har:282, E2E-network-log-trust-wallet.har:357, E2E-network-log-trust-wallet.har:443, E2E-network-log-trust-wallet.har:453, E2E-network-log-trust-wallet.har:464, E2E-network-log-trust-wallet.har:485, E2E-network-log-trust-wallet.har:489, E2E-network-log-trust-wallet.har:504, E2E-network-log-trust-wallet.har:508, E2E-network-log-trust-wallet.har:512, E2E-network-log-trust-wallet.har:582, E2E-network-log-trust-wallet.har:649, E2E-network-log-trust-wallet.har:665, E2E-network-log-trust-wallet.har:678, E2E-network-log-trust-wallet.har:741, E2E-network-log-trust-wallet.har:744, E2E-network-log-trust-wallet.har:762, E2E-network-log-trust-wallet.har:775, E2E-network-log-trust-wallet.har:794, E2E-network-log-trust-wallet.har:809, E2E-network-log-trust-wallet.har:821, E2E-network-log-trust-wallet.har:886, E2E-network-log-trust-wallet.har:984, E2E-network-log-trust-wallet.har:990, E2E-network-log-trust-wallet.har:1023, add-cutom-network.har:9, add-cutom-network.har:12, add-cutom-network.har:15, add-cutom-network.har:18, add-cutom-network.har:21, add-cutom-network.har:24, add-cutom-network.har:27, add-cutom-network.har:34, add-cutom-network.har:37, add-cutom-network.har:40, add-cutom-network.har:43, add-cutom-network.har:46, add-cutom-network.har:49, add-cutom-network.har:52, add-cutom-network.har:59, add-cutom-network.har:62, add-cutom-network.har:65, add-cutom-network.har:68, add-cutom-network.har:71, add-cutom-network.har:74, add-cutom-network.har:77, add-cutom-network.har:81, add-cutom-network.har:84, add-cutom-network.har:87, add-cutom-network.har:90, add-cutom-network.har:93, add-cutom-network.har:96, add-cutom-network.har:99, custom-token.har:6, custom-token.har:38, custom-token.har:86, custom-token.har:211, custom-token.har:221, lock-unlock-biometric.har:4, lock-unlock-biometric.har:8, lock-unlock-biometric.har:23, lock-unlock-biometric.har:26, lock-unlock-biometric.har:29, network-log.har:3305, network-log.har:3308, network-log.har:3311, network-log.har:3314, network-log.har:3317, network-log.har:3320, network-log.har:3323, network-log.har:3326.

## 79. GET gateway.us.trustwallet.com/v1/coinstatus/{assetId}

Query keys: include_security_info, include_solana_security_info. Status counts: `{"0":6,"200":48,"404":24}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<UNKNOWN item; empty in capture>, isScaledUIAmount: boolean, defaultSwapPair: null, defaultSwapCrossChainPair: { fromAsset: string, toAsset: string }, isBuyCryptoAvailable: boolean }
OR
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<{ id: string, type: string, targets: { android_enabled: boolean, android_version_from: string, android_version_to: string, ios_enabled: boolean, ios_version_from: string, ios_version_to: string, extension_enabled: boolean, extension_version_from: string, extension_version_to: string }, metadata: { format: string, description: string, type: string, link: { type: string, url: string }, always_show: boolean } }>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: { fromAsset: string, toAsset: string }, isBuyCryptoAvailable: boolean }
OR
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<UNKNOWN item; empty in capture>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: null, isBuyCryptoAvailable: boolean }
OR
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<UNKNOWN item; empty in capture>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: { fromAsset: string, toAsset: string }, isBuyCryptoAvailable: boolean }
OR
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<{ id: string, type: string, targets: { android_enabled: boolean, android_version_from: string, android_version_to: string, ios_enabled: boolean, ios_version_from: string, ios_version_to: string, extension_enabled: boolean, extension_version_from: string, extension_version_to: string }, metadata: { format: string, description: string, type: string, link: { type: string, url: string }, always_show: boolean } }>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: { fromAsset: string, toAsset: string }, isBuyCryptoAvailable: boolean, security_info: { is_scanned: boolean, provider: string, contract_security: { num_risks: number, num_warnings: number, items: Array<UNKNOWN item; empty in capture>, is_counterfeit: null }, honeypot_risk: { num_risks: number, num_warnings: number, items: Array<UNKNOWN item; empty in capture>, buy_tax: null, sell_tax: null } } }
OR
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<UNKNOWN item; empty in capture>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: { fromAsset: string, toAsset: string }, isBuyCryptoAvailable: boolean, security_info: { is_scanned: boolean, provider: string, contract_security: { num_risks: number, num_warnings: number, items: Array<{ type: string, summary: string, description: string, code: string }>, is_counterfeit: boolean }, honeypot_risk: { num_risks: number, num_warnings: number, items: Array<{ type: string, summary: string, description: string, code: string }>, buy_tax: null, sell_tax: null } } }
OR
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:14, E2E-network-log-trust-wallet.har:15, E2E-network-log-trust-wallet.har:16, E2E-network-log-trust-wallet.har:87, E2E-network-log-trust-wallet.har:88, E2E-network-log-trust-wallet.har:89, E2E-network-log-trust-wallet.har:111, E2E-network-log-trust-wallet.har:112, E2E-network-log-trust-wallet.har:277, E2E-network-log-trust-wallet.har:278, E2E-network-log-trust-wallet.har:299, E2E-network-log-trust-wallet.har:310, E2E-network-log-trust-wallet.har:340, E2E-network-log-trust-wallet.har:1018, E2E-network-log-trust-wallet.har:1019, E2E-network-log-trust-wallet.har:1020, E2E-network-log-trust-wallet.har:1021, E2E-network-log-trust-wallet.har:1022, E2E-network-log-trust-wallet.har:1030, E2E-network-log-trust-wallet.har:1031, custom-token.har:129, custom-token.har:130, custom-token.har:131, custom-token.har:132, custom-token.har:133, custom-token.har:134, custom-token.har:135, custom-token.har:136, custom-token.har:137, custom-token.har:138, custom-token.har:139, custom-token.har:140, custom-token.har:141, custom-token.har:142, custom-token.har:143, custom-token.har:144, custom-token.har:145, custom-token.har:146, custom-token.har:147, custom-token.har:148, custom-token.har:149, custom-token.har:150, custom-token.har:151, custom-token.har:152, custom-token.har:153, custom-token.har:154, custom-token.har:155, custom-token.har:156, custom-token.har:157, custom-token.har:158, custom-token.har:159, custom-token.har:160, custom-token.har:161, custom-token.har:162, custom-token.har:163, custom-token.har:164, custom-token.har:165, custom-token.har:166, custom-token.har:167, custom-token.har:168, custom-token.har:169, custom-token.har:170, custom-token.har:172, custom-token.har:173, custom-token.har:174, custom-token.har:175, custom-token.har:176, custom-token.har:177, custom-token.har:178, custom-token.har:179, custom-token.har:180, custom-token.har:181, custom-token.har:182, custom-token.har:183, custom-token.har:184, custom-token.har:188, custom-token.har:210, custom-token.har:220.

## 80. GET gateway.us.trustwallet.com/v1/coinstatus/{opaqueValue}

Query keys: include_security_info. Status counts: `{"404":21}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:576, E2E-network-log-trust-wallet.har:577, E2E-network-log-trust-wallet.har:580, E2E-network-log-trust-wallet.har:757, E2E-network-log-trust-wallet.har:758, E2E-network-log-trust-wallet.har:760, E2E-network-log-trust-wallet.har:761, E2E-network-log-trust-wallet.har:781, E2E-network-log-trust-wallet.har:788, E2E-network-log-trust-wallet.har:789, E2E-network-log-trust-wallet.har:792, E2E-network-log-trust-wallet.har:793, E2E-network-log-trust-wallet.har:801, E2E-network-log-trust-wallet.har:813, E2E-network-log-trust-wallet.har:883, E2E-network-log-trust-wallet.har:884, E2E-network-log-trust-wallet.har:896, E2E-network-log-trust-wallet.har:982, E2E-network-log-trust-wallet.har:983, E2E-network-log-trust-wallet.har:1032, E2E-network-log-trust-wallet.har:1034.

## 81. GET gateway.us.trustwallet.com/v1/discover/group/invest-staking

Query keys: currency. Status counts: `{"200":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { value: number, asset: { name: string, symbol: string, decimals: number } } }> }
```

Record references: E2E-network-log-trust-wallet.har:779, E2E-network-log-trust-wallet.har:800, E2E-network-log-trust-wallet.har:812, E2E-network-log-trust-wallet.har:894.

## 82. GET gateway.us.trustwallet.com/v1/discover/new

Query keys: content, currency, device_id, source, wallet_id. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<{ id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, change_1h: number, change_1d: number, change_7d: number, rank: number, audit_links: Array<string>, chain_tvls: { Arbitrum: number, Ethereum: number, Ethereum-staking: number, Fraxtal: number, Polygon: number, staking: number }, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, change_1h: number, change_1d: number, change_7d: number, rank: number, audit_links: Array<string>, chain_tvls: { Arbitrum: number, Arbitrum-staking: number, Arc: number, Arc-staking: number, Aurora: number, Aurora-staking: number, Avalanche: number, Avalanche-staking: number, Base: number, Base-staking: number, Berachain: number, Berachain-staking: number, Binance: number, Binance-staking: number, Canto: number, Canto-staking: number, Celo: number, Celo-staking: number, Cronos: number, Cronos-staking: number, Ethereum: number, Ethereum-staking: number, Fantom: number, Fantom-staking: number, Fraxtal: number, Fraxtal-staking: number, Fuse: number, Fuse-staking: number, Harmony: number, Harmony-staking: number, Heco: number, Heco-staking: number, Hyperliquid L1: number, Hyperliquid L1-staking: number, Kava: number, Kava-staking: number, Linea: number, Linea-staking: number, Lisk: number, Lisk-staking: number, Manta: number, Manta-staking: number, Mantle: number, Mantle-staking: number, MegaETH: number, MegaETH-staking: number, Metis: number, Metis-staking: number, Mode: number, Mode-staking: number, Monad: number, Monad-staking: number, Moonbeam: number, Moonbeam-staking: number, Moonriver: number, Moonriver-staking: number, Oasis: number, Oasis-staking: number, Optimism: number, Optimism-staking: number, Plasma: number, Plasma-staking: number, Polygon: number, Polygon zkEVM: number, Polygon zkEVM-staking: number, Polygon-staking: number, RSK: number, RSK-staking: number, Robinhood Chain: number, Robinhood Chain-staking: number, Saga: number, Saga-staking: number, Scroll: number, Scroll-staking: number, Sei: number, Sei-staking: number, Sonic: number, Sonic-staking: number, re.al: number, re.al-staking: number, staking: number, xDai: number, xDai-staking: number, zkSync Era: number, zkSync Era-staking: number }, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, tvl: number, change_1h: number, change_1d: number, change_7d: number, rank: number, audit_links: Array<string>, chain_tvls: { Binance: number, Ethereum: number }, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, change_1h: number, change_1d: number, change_7d: number, rank: number, audit_links: Array<string>, chain_tvls: { Ethereum: number, Ethereum-staking: number, staking: number }, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, change_1h: number, change_1d: number, change_7d: number, rank: number, chain_tvls: { Arbitrum: number, Base: number, Bitcoin: number, Ethereum: number, Solana: number, Solana-staking: number, staking: number }, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, market_cap: number, rank: number, audit_links: Array<string>, chain_tvls: { Ethereum: number, Ethereum-pool2: number, Ethereum-staking: number, pool2: number, staking: number }, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, rank: number, consumer_category: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, chains: Array<string>, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, tvl: number, market_cap: number, change_1h: number, change_1d: number, change_7d: number, rank: number, audit_links: Array<string>, chain_tvls: { Wax: number, Wax-staking: number, staking: number }, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string, categories: Array<string>, social_links: Array<{ title: string, url: string, type: string }>, token: { address: string, symbol: string, chain: string }, market_cap: number, rank: number, consumer_category: string } } | { id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { url: string } }> }> } | { id: string, name: string, description: string, type: string, expandable: boolean, items: Array<{ id: string, name: string, description: string, type: string, url: string, image_url: string, metadata: { price: number, price_change_24h: number, market_cap: number, volume_24h: number, asset: { name: string, symbol: string, decimals: number } } }> }>
```

Record references: E2E-network-log-trust-wallet.har:108.

## 83. GET gateway.us.trustwallet.com/v1/invests/stablecoin/config

Query keys: none recorded. Status counts: `{"200":18}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ angle_routers: Array<{ chain_id: string, address: string }>, vaults: Array<{ protocol_name: string, description: string, website: string, vault_id: string, chain_id: string, contract_address: string, locked_asset_address: string, type: string, provider: string, icon_url: string, subtitle: string, tvl: string, staker_count: number, deposit_unavailable_reason: string } | { protocol_name: string, description: string, website: string, vault_id: string, chain_id: string, contract_address: string, locked_asset_address: string, type: string, provider: string, icon_url: string, subtitle: string, tvl: string, staker_count: number }> }
OR
{ angle_routers: Array<{ chain_id: string, address: string }>, vaults: Array<{ protocol_name: string, description: string, website: string, vault_id: string, chain_id: string, contract_address: string, locked_asset_address: string, type: string, provider: string, icon_url: string, subtitle: string, tvl: string, staker_count: number } | { protocol_name: string, description: string, website: string, vault_id: string, chain_id: string, contract_address: string, locked_asset_address: string, type: string, provider: string, icon_url: string, subtitle: string, tvl: string, staker_count: number, deposit_unavailable_reason: string }> }
```

Record references: E2E-network-log-trust-wallet.har:49, E2E-network-log-trust-wallet.har:536, custom-token.har:50, lock-unlock-biometric.har:71, network-log.har:181, network-log.har:421, network-log.har:662, network-log.har:903, network-log.har:1150, network-log.har:1412, network-log.har:1658, network-log.har:1902, network-log.har:2143, network-log.har:2388, network-log.har:2636, network-log.har:2877, network-log.har:3122, network-log.har:3391.

## 84. GET gateway.us.trustwallet.com/v1/invests/staking

Query keys: currency. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-type, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ id: string, name: string, description: string, items: Array<{ id: string, metadata: { asset_id: string, name: string, symbol: string, decimals: number, network: number, icon_url: string }, market_data: { price: number, price_change_24h: number, market_cap: number }, apr_data: { staking: number }, tvl: string, staker_count: number, status: string }>, order: number }
```

Record references: E2E-network-log-trust-wallet.har:298.

## 85. GET gateway.us.trustwallet.com/v1/search/assets

Query keys: exactQuery, include_pricing_info, limit, networks, offset, sortBy, type, version. Status counts: `{"200":6}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ total: number, docs: Array<{ name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean }>, currency: string }
OR
{ total: number, docs: Array<{ name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_cap_verified: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, apy: number, verifiers: Array<string>, market_cap: number, market_cap_verified: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: null, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, volume_24h: number, liquidity_usd: number, price: null, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, is_pre_ipo: boolean, is_rwa: boolean }>, currency: string }
OR
{ total: number, docs: Array<{ name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, apy: number, verifiers: Array<string>, market_cap: number, market_cap_verified: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean } | { name: string, symbol: string, type: string, decimals: number, asset_id: string, icon_url: string, chain_name: string, verifiers: Array<string>, market_cap: number, market_data_expires_at_unix: string, volume_24h: number, liquidity_usd: number, price: { price: number, percent_change_1h: number, percent_change_24h: number, percent_change_7d: number, percent_change_30d: number, percent_change_60d: number, percent_change_90d: number }, tags: Array<string>, is_pre_ipo: boolean, is_rwa: boolean }>, currency: string }
```

Record references: E2E-network-log-trust-wallet.har:172, E2E-network-log-trust-wallet.har:177, E2E-network-log-trust-wallet.har:181, E2E-network-log-trust-wallet.har:211, E2E-network-log-trust-wallet.har:293, E2E-network-log-trust-wallet.har:942.

## 86. GET gateway.us.trustwallet.com/v1/txhub/txs

Query keys: address, asset, chain, from, limit, to. Status counts: `{"400":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:783, E2E-network-log-trust-wallet.har:803, E2E-network-log-trust-wallet.har:815, E2E-network-log-trust-wallet.har:898.

## 87. GET gateway.us.trustwallet.com/v2/announcements

Query keys: device_id, platform, strategy, version. Status counts: `{"200":79}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ announcements: Array<UNKNOWN item; empty in capture> }
```

Record references: E2E-network-log-trust-wallet.har:12, E2E-network-log-trust-wallet.har:110, E2E-network-log-trust-wallet.har:131, E2E-network-log-trust-wallet.har:140, E2E-network-log-trust-wallet.har:155, E2E-network-log-trust-wallet.har:163, E2E-network-log-trust-wallet.har:217, E2E-network-log-trust-wallet.har:246, E2E-network-log-trust-wallet.har:281, E2E-network-log-trust-wallet.har:356, E2E-network-log-trust-wallet.har:440, E2E-network-log-trust-wallet.har:452, E2E-network-log-trust-wallet.har:463, E2E-network-log-trust-wallet.har:484, E2E-network-log-trust-wallet.har:488, E2E-network-log-trust-wallet.har:503, E2E-network-log-trust-wallet.har:507, E2E-network-log-trust-wallet.har:579, E2E-network-log-trust-wallet.har:648, E2E-network-log-trust-wallet.har:664, E2E-network-log-trust-wallet.har:677, E2E-network-log-trust-wallet.har:740, E2E-network-log-trust-wallet.har:743, E2E-network-log-trust-wallet.har:759, E2E-network-log-trust-wallet.har:774, E2E-network-log-trust-wallet.har:791, E2E-network-log-trust-wallet.har:808, E2E-network-log-trust-wallet.har:820, E2E-network-log-trust-wallet.har:882, E2E-network-log-trust-wallet.har:981, E2E-network-log-trust-wallet.har:989, E2E-network-log-trust-wallet.har:1017, add-cutom-network.har:8, add-cutom-network.har:11, add-cutom-network.har:14, add-cutom-network.har:17, add-cutom-network.har:20, add-cutom-network.har:23, add-cutom-network.har:26, add-cutom-network.har:33, add-cutom-network.har:36, add-cutom-network.har:39, add-cutom-network.har:42, add-cutom-network.har:45, add-cutom-network.har:48, add-cutom-network.har:51, add-cutom-network.har:58, add-cutom-network.har:61, add-cutom-network.har:64, add-cutom-network.har:67, add-cutom-network.har:70, add-cutom-network.har:73, add-cutom-network.har:76, add-cutom-network.har:80, add-cutom-network.har:83, add-cutom-network.har:86, add-cutom-network.har:89, add-cutom-network.har:92, add-cutom-network.har:95, add-cutom-network.har:98, custom-token.har:1, custom-token.har:37, custom-token.har:85, custom-token.har:127, custom-token.har:201, custom-token.har:219, lock-unlock-biometric.har:3, lock-unlock-biometric.har:6, lock-unlock-biometric.har:22, lock-unlock-biometric.har:25, lock-unlock-biometric.har:28, network-log.har:3303, network-log.har:3307, network-log.har:3310, network-log.har:3313, network-log.har:3316, network-log.har:3319, network-log.har:3322, network-log.har:3325.

## 88. GET gateway.us.trustwallet.com/v2/coinstatus/{assetId}

Query keys: include_security_info, include_solana_security_info, platform, version. Status counts: `{"200":6}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-type, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<{ id: string, type: string, targets: { android_enabled: boolean, android_version_from: string, android_version_to: string, ios_enabled: boolean, ios_version_from: string, ios_version_to: string, extension_enabled: boolean, extension_version_from: string, extension_version_to: string }, metadata: { format: string, description: string, type: string, link: { type: string, url: string }, always_show: boolean } }>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: { fromAsset: string, toAsset: string }, isBuyCryptoAvailable: boolean }
OR
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<UNKNOWN item; empty in capture>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: null, isBuyCryptoAvailable: boolean }
OR
{ asset: { name: string, symbol: string, type: string, decimals: number, asset_id: string }, isBuyCryptoEnabled: boolean, isSellCryptoEnabled: boolean, isSwapEnabled: boolean, isSwapCrossChainEnabled: boolean, isStakeEnabled: boolean, isDappsEnabled: boolean, isPreIPO: boolean, isRWA: boolean, messages: Array<UNKNOWN item; empty in capture>, isScaledUIAmount: boolean, defaultSwapPair: { fromAsset: string, toAsset: string }, defaultSwapCrossChainPair: { fromAsset: string, toAsset: string }, isBuyCryptoAvailable: boolean }
```

Record references: E2E-network-log-trust-wallet.har:134, E2E-network-log-trust-wallet.har:297, E2E-network-log-trust-wallet.har:300, E2E-network-log-trust-wallet.har:311, E2E-network-log-trust-wallet.har:331, E2E-network-log-trust-wallet.har:341.

## 89. GET gateway.us.trustwallet.com/v2/coinstatus/{opaqueValue}

Query keys: include_security_info, include_solana_security_info, platform, version. Status counts: `{"404":3}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-type, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:586, E2E-network-log-trust-wallet.har:823, E2E-network-log-trust-wallet.har:900.

## 90. GET gateway.us.trustwallet.com/v2/devices/{deviceId}

Query keys: none recorded. Status counts: `{"200":29}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ device_id: string, platform: string, push_enabled: boolean, language: string, app_version: string, wallets_version: number, model_name: string, currency: string, country_code: string, geofence: { rule_version: string, country: string, region: string, verdicts: { campaign:enter: { allowed: boolean }, cash:buy: { allowed: boolean }, earn:deposit: { allowed: boolean }, earn:stake: { allowed: boolean }, earn:view: { allowed: boolean }, earn:withdraw: { allowed: boolean }, odd:access: { allowed: boolean }, perps:trade: { allowed: boolean }, perps:view: { allowed: boolean }, qrpay:decode: { allowed: boolean }, ramp:buy: { allowed: boolean, blocked: { provider: Array<string> } }, ramp:sell: { allowed: boolean, blocked: { provider: Array<string> } }, rwa:trade: { allowed: boolean }, swap:fastquote: { allowed: boolean }, swap:trade: { allowed: boolean }, worldcup:enter: { allowed: boolean } } } }
```

Record references: E2E-network-log-trust-wallet.har:21, E2E-network-log-trust-wallet.har:143, E2E-network-log-trust-wallet.har:158, E2E-network-log-trust-wallet.har:167, E2E-network-log-trust-wallet.har:260, E2E-network-log-trust-wallet.har:359, E2E-network-log-trust-wallet.har:362, E2E-network-log-trust-wallet.har:365, E2E-network-log-trust-wallet.har:430, E2E-network-log-trust-wallet.har:441, E2E-network-log-trust-wallet.har:445, E2E-network-log-trust-wallet.har:467, E2E-network-log-trust-wallet.har:581, E2E-network-log-trust-wallet.har:584, E2E-network-log-trust-wallet.har:885, E2E-network-log-trust-wallet.har:888, E2E-network-log-trust-wallet.har:1002, add-cutom-network.har:29, add-cutom-network.har:54, add-cutom-network.har:79, add-cutom-network.har:101, custom-token.har:2, custom-token.har:8, custom-token.har:21, custom-token.har:67, custom-token.har:69, lock-unlock-biometric.har:11, lock-unlock-biometric.har:31, network-log.har:3329.

## 91. GET gateway.us.trustwallet.com/v2/market/charts/{opaqueValue}

Query keys: currency, period. Status counts: `{"400":5}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:777, E2E-network-log-trust-wallet.har:799, E2E-network-log-trust-wallet.har:811, E2E-network-log-trust-wallet.har:819, E2E-network-log-trust-wallet.har:893.

## 92. GET gateway.us.trustwallet.com/v2/market/info/{opaqueValue}

Query keys: currency. Status counts: `{"400":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:780, E2E-network-log-trust-wallet.har:895.

## 93. GET gateway.us.trustwallet.com/v2/market/rates

Query keys: currency. Status counts: `{"0":3,"200":176}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<{ currency: string, value: number }>
```

Record references: custom-token.har:9, custom-token.har:24, custom-token.har:55, custom-token.har:72, custom-token.har:102, lock-unlock-biometric.har:15, lock-unlock-biometric.har:34, lock-unlock-biometric.har:43, lock-unlock-biometric.har:100, network-log.har:6, network-log.har:17, network-log.har:31, network-log.har:88, network-log.har:101, network-log.har:113, network-log.har:125, network-log.har:138, network-log.har:149, network-log.har:209, network-log.har:223, network-log.har:236, network-log.har:248, network-log.har:259, network-log.har:271, network-log.har:328, network-log.har:343, network-log.har:355, network-log.har:366, network-log.har:378, network-log.har:391, network-log.har:449, network-log.har:462, network-log.har:474, network-log.har:487, network-log.har:500, network-log.har:512, network-log.har:569, network-log.har:582, network-log.har:595, network-log.har:607, network-log.har:619, network-log.har:630, network-log.har:690, network-log.har:703, network-log.har:715, network-log.har:726, network-log.har:738, network-log.har:751, network-log.har:810, network-log.har:823, network-log.har:835, network-log.har:847, network-log.har:863, network-log.har:873, network-log.har:933, network-log.har:946, network-log.har:959, network-log.har:971, network-log.har:983, network-log.har:998, network-log.har:1055, network-log.har:1070, network-log.har:1083, network-log.har:1096, network-log.har:1108, network-log.har:1118, network-log.har:1178, network-log.har:1194, network-log.har:1206, network-log.har:1217, network-log.har:1229, network-log.har:1242, network-log.har:1301, network-log.har:1314, network-log.har:1328, network-log.har:1356, network-log.har:1369, network-log.har:1380, network-log.har:1443, network-log.har:1456, network-log.har:1468, network-log.har:1480, network-log.har:1491, network-log.har:1504, network-log.har:1563, network-log.har:1577, network-log.har:1588, network-log.har:1600, network-log.har:1613, network-log.har:1625, network-log.har:1688, network-log.har:1700, network-log.har:1713, network-log.har:1726, network-log.har:1738, network-log.har:1750, network-log.har:1810, network-log.har:1823, network-log.har:1838, network-log.har:1848, network-log.har:1860, network-log.har:1872, network-log.har:1931, network-log.har:1945, network-log.har:1957, network-log.har:1969, network-log.har:1981, network-log.har:1993, network-log.har:2051, network-log.har:2065, network-log.har:2077, network-log.har:2089, network-log.har:2101, network-log.har:2113, network-log.har:2173, network-log.har:2187, network-log.har:2199, network-log.har:2211, network-log.har:2223, network-log.har:2235, network-log.har:2293, network-log.har:2306, network-log.har:2318, network-log.har:2331, network-log.har:2344, network-log.har:2358, network-log.har:2416, network-log.har:2429, network-log.har:2442, network-log.har:2454, network-log.har:2465, network-log.har:2479, network-log.har:2540, network-log.har:2557, network-log.har:2569, network-log.har:2580, network-log.har:2592, network-log.har:2603, network-log.har:2663, network-log.har:2677, network-log.har:2689, network-log.har:2703, network-log.har:2715, network-log.har:2727, network-log.har:2785, network-log.har:2799, network-log.har:2810, network-log.har:2823, network-log.har:2835, network-log.har:2847, network-log.har:2906, network-log.har:2920, network-log.har:2932, network-log.har:2945, network-log.har:2957, network-log.har:2968, network-log.har:3030, network-log.har:3042, network-log.har:3054, network-log.har:3065, network-log.har:3078, network-log.har:3090, network-log.har:3148, network-log.har:3161, network-log.har:3173, network-log.har:3186, network-log.har:3198, network-log.har:3209, network-log.har:3267, network-log.har:3282, network-log.har:3294, network-log.har:3331, network-log.har:3340, network-log.har:3349, network-log.har:3357, network-log.har:3419, network-log.har:3433, network-log.har:3446, network-log.har:3458.

## 94. GET gateway.us.trustwallet.com/v2/market/sentiment-assets

Query keys: none recorded. Status counts: `{"200":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<string>
```

Record references: E2E-network-log-trust-wallet.har:782, E2E-network-log-trust-wallet.har:802, E2E-network-log-trust-wallet.har:814, E2E-network-log-trust-wallet.har:897.

## 95. GET gateway.us.trustwallet.com/v3/devices/{deviceId}/wallets/{opaqueValue}/meta

Query keys: none recorded. Status counts: `{"404":3}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:0, E2E-network-log-trust-wallet.har:4, E2E-network-log-trust-wallet.har:1011.

## 96. GET gateway.us.trustwallet.com/v3/points/{hexValue}/vip

Query keys: none recorded. Status counts: `{"200":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ vip_config: { progress_window: number, vip_status_valid_for: number, vip_tiers: Array<{ level: number, display_name: string, icon_light: string, icon_dark: string, lottie_dark: string, prerequisites: { points: number, locked_twt: number } }>, vip_benefits: Array<{ id: string, minimum_level: number, template: string, properties: {  } } | { id: string, minimum_level: number, template: string, properties: { 1: { value: string }, 2: { value: string }, 3: { value: string } } } | { id: string, minimum_level: number, template: string, properties: { 2: { value: string }, 3: { value: string } } } | { id: string, minimum_level: number, template: string, properties: { 1: { trust_alpha_access_cap: string }, 2: { trust_alpha_access_cap: string }, 3: { trust_alpha_access_cap: string } } }> }, vip_window_points: number, vip_window_twt_locked: number, vip_tier_level: number, vip_tier_unlocked_at: null, user_all_time_points: { unclaimed_points: number, claimed_points: number, expired_points: number }, vip_transition_animation: null }
```

Record references: E2E-network-log-trust-wallet.har:186, E2E-network-log-trust-wallet.har:210, E2E-network-log-trust-wallet.har:292, E2E-network-log-trust-wallet.har:974.

## 97. POST gateway.us.trustwallet.com/v1/approvals/scan

Query keys: none recorded. Status counts: `{"200":3}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ addresses: Array<{ chain: string, address: string }>, currency: string }
```

Response:

```text
{ approvals: Array<UNKNOWN item; empty in capture>, meta: { next_token: string }, errors: Array<UNKNOWN item; empty in capture> }
```

Record references: E2E-network-log-trust-wallet.har:510, E2E-network-log-trust-wallet.har:511, custom-token.har:113.

## 98. POST gateway.us.trustwallet.com/v1/assets

Query keys: none recorded. Status counts: `{"0":11,"200":1291}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ assets: Array<{ address: string, coin: number, publicKey: string }>, from_time: number, version: number }
```

Response:

```text
{ docs: Array<UNKNOWN item; empty in capture>, meta: { interval_ms: number } }
```

Record references: E2E-network-log-trust-wallet.har:2, E2E-network-log-trust-wallet.har:22, E2E-network-log-trust-wallet.har:95, E2E-network-log-trust-wallet.har:100, E2E-network-log-trust-wallet.har:102, E2E-network-log-trust-wallet.har:107, E2E-network-log-trust-wallet.har:109, E2E-network-log-trust-wallet.har:115, E2E-network-log-trust-wallet.har:116, E2E-network-log-trust-wallet.har:117, E2E-network-log-trust-wallet.har:118, E2E-network-log-trust-wallet.har:119, E2E-network-log-trust-wallet.har:120, E2E-network-log-trust-wallet.har:125, E2E-network-log-trust-wallet.har:129, E2E-network-log-trust-wallet.har:136, E2E-network-log-trust-wallet.har:138, E2E-network-log-trust-wallet.har:139, E2E-network-log-trust-wallet.har:144, E2E-network-log-trust-wallet.har:148, E2E-network-log-trust-wallet.har:149, E2E-network-log-trust-wallet.har:153, E2E-network-log-trust-wallet.har:159, E2E-network-log-trust-wallet.har:166, E2E-network-log-trust-wallet.har:175, E2E-network-log-trust-wallet.har:180, E2E-network-log-trust-wallet.har:191, E2E-network-log-trust-wallet.har:214, E2E-network-log-trust-wallet.har:216, E2E-network-log-trust-wallet.har:245, E2E-network-log-trust-wallet.har:251, E2E-network-log-trust-wallet.har:259, E2E-network-log-trust-wallet.har:261, E2E-network-log-trust-wallet.har:280, E2E-network-log-trust-wallet.har:288, E2E-network-log-trust-wallet.har:290, E2E-network-log-trust-wallet.har:309, E2E-network-log-trust-wallet.har:326, E2E-network-log-trust-wallet.har:339, E2E-network-log-trust-wallet.har:360, E2E-network-log-trust-wallet.har:361, E2E-network-log-trust-wallet.har:423, E2E-network-log-trust-wallet.har:426, E2E-network-log-trust-wallet.har:429, E2E-network-log-trust-wallet.har:431, E2E-network-log-trust-wallet.har:435, E2E-network-log-trust-wallet.har:436, E2E-network-log-trust-wallet.har:437, E2E-network-log-trust-wallet.har:438, E2E-network-log-trust-wallet.har:439, E2E-network-log-trust-wallet.har:442, E2E-network-log-trust-wallet.har:449, E2E-network-log-trust-wallet.har:450, E2E-network-log-trust-wallet.har:451, E2E-network-log-trust-wallet.har:455, E2E-network-log-trust-wallet.har:456, E2E-network-log-trust-wallet.har:457, E2E-network-log-trust-wallet.har:460, E2E-network-log-trust-wallet.har:466, E2E-network-log-trust-wallet.har:468, E2E-network-log-trust-wallet.har:472, E2E-network-log-trust-wallet.har:473, E2E-network-log-trust-wallet.har:474, E2E-network-log-trust-wallet.har:475, E2E-network-log-trust-wallet.har:477, E2E-network-log-trust-wallet.har:478, E2E-network-log-trust-wallet.har:487, E2E-network-log-trust-wallet.har:491, E2E-network-log-trust-wallet.har:494, E2E-network-log-trust-wallet.har:495, E2E-network-log-trust-wallet.har:496, E2E-network-log-trust-wallet.har:500, E2E-network-log-trust-wallet.har:502, E2E-network-log-trust-wallet.har:514, E2E-network-log-trust-wallet.har:585, E2E-network-log-trust-wallet.har:599, E2E-network-log-trust-wallet.har:602, E2E-network-log-trust-wallet.har:609, E2E-network-log-trust-wallet.har:625, E2E-network-log-trust-wallet.har:640, E2E-network-log-trust-wallet.har:645, E2E-network-log-trust-wallet.har:646, E2E-network-log-trust-wallet.har:654, E2E-network-log-trust-wallet.har:659, E2E-network-log-trust-wallet.har:667, E2E-network-log-trust-wallet.har:668, E2E-network-log-trust-wallet.har:680, E2E-network-log-trust-wallet.har:738, E2E-network-log-trust-wallet.har:749, E2E-network-log-trust-wallet.har:764, E2E-network-log-trust-wallet.har:770, E2E-network-log-trust-wallet.har:771, E2E-network-log-trust-wallet.har:772, E2E-network-log-trust-wallet.har:773, E2E-network-log-trust-wallet.har:790, E2E-network-log-trust-wallet.har:796, E2E-network-log-trust-wallet.har:807, E2E-network-log-trust-wallet.har:825, E2E-network-log-trust-wallet.har:831, E2E-network-log-trust-wallet.har:902, E2E-network-log-trust-wallet.har:919, E2E-network-log-trust-wallet.har:927, E2E-network-log-trust-wallet.har:946, E2E-network-log-trust-wallet.har:950, E2E-network-log-trust-wallet.har:959, E2E-network-log-trust-wallet.har:965, E2E-network-log-trust-wallet.har:972, E2E-network-log-trust-wallet.har:980, E2E-network-log-trust-wallet.har:986, E2E-network-log-trust-wallet.har:987, E2E-network-log-trust-wallet.har:992, E2E-network-log-trust-wallet.har:993, E2E-network-log-trust-wallet.har:994, E2E-network-log-trust-wallet.har:1001, E2E-network-log-trust-wallet.har:1003, E2E-network-log-trust-wallet.har:1013, E2E-network-log-trust-wallet.har:1025, E2E-network-log-trust-wallet.har:1093, E2E-network-log-trust-wallet.har:1095, E2E-network-log-trust-wallet.har:1097, add-cutom-network.har:0, add-cutom-network.har:30, add-cutom-network.har:32, add-cutom-network.har:55, add-cutom-network.har:57, add-cutom-network.har:193, add-cutom-network.har:294, add-cutom-network.har:298, custom-token.har:0, custom-token.har:3, custom-token.har:4, custom-token.har:13, custom-token.har:14, custom-token.har:15, custom-token.har:20, custom-token.har:22, custom-token.har:35, custom-token.har:36, custom-token.har:66, custom-token.har:68, custom-token.har:83, custom-token.har:84, custom-token.har:128, custom-token.har:213, custom-token.har:218, custom-token.har:223, custom-token.har:224, custom-token.har:225, custom-token.har:226, lock-unlock-biometric.har:10, lock-unlock-biometric.har:13, lock-unlock-biometric.har:20, lock-unlock-biometric.har:35, lock-unlock-biometric.har:38, lock-unlock-biometric.har:39, lock-unlock-biometric.har:40, lock-unlock-biometric.har:46, lock-unlock-biometric.har:47, lock-unlock-biometric.har:48, lock-unlock-biometric.har:49, lock-unlock-biometric.har:66, lock-unlock-biometric.har:99, network-log.har:0, network-log.har:1, network-log.har:2, network-log.har:5, network-log.har:9, network-log.har:10, network-log.har:11, network-log.har:12, network-log.har:13, network-log.har:14, network-log.har:20, network-log.har:21, network-log.har:22, network-log.har:23, network-log.har:26, network-log.har:27, network-log.har:28, network-log.har:34, network-log.har:35, network-log.har:36, network-log.har:37, network-log.har:38, network-log.har:39, network-log.har:45, network-log.har:87, network-log.har:94, network-log.har:95, network-log.har:96, network-log.har:97, network-log.har:98, network-log.har:104, network-log.har:105, network-log.har:106, network-log.har:107, network-log.har:108, network-log.har:109, network-log.har:110, network-log.har:116, network-log.har:117, network-log.har:118, network-log.har:119, network-log.har:120, network-log.har:121, network-log.har:122, network-log.har:128, network-log.har:130, network-log.har:131, network-log.har:132, network-log.har:133, network-log.har:134, network-log.har:135, network-log.har:141, network-log.har:142, network-log.har:143, network-log.har:144, network-log.har:145, network-log.har:146, network-log.har:152, network-log.har:153, network-log.har:155, network-log.har:156, network-log.har:157, network-log.har:158, network-log.har:159, network-log.har:205, network-log.har:212, network-log.har:216, network-log.har:217, network-log.har:218, network-log.har:219, network-log.har:220, network-log.har:226, network-log.har:227, network-log.har:228, network-log.har:229, network-log.har:231, network-log.har:232, network-log.har:233, network-log.har:239, network-log.har:240, network-log.har:241, network-log.har:242, network-log.har:243, network-log.har:244, network-log.har:247, network-log.har:251, network-log.har:252, network-log.har:253, network-log.har:254, network-log.har:255, network-log.har:256, network-log.har:262, network-log.har:263, network-log.har:264, network-log.har:265, network-log.har:266, network-log.har:267, network-log.har:268, network-log.har:274, network-log.har:275, network-log.har:276, network-log.har:277, network-log.har:278, network-log.har:279, network-log.har:280, network-log.har:327, network-log.har:331, network-log.har:336, network-log.har:337, network-log.har:338, network-log.har:339, network-log.har:340, network-log.har:346, network-log.har:347, network-log.har:348, network-log.har:349, network-log.har:350, network-log.har:351, network-log.har:354, network-log.har:358, network-log.har:359, network-log.har:360, network-log.har:361, network-log.har:362, network-log.har:363, network-log.har:369, network-log.har:370, network-log.har:371, network-log.har:372, network-log.har:373, network-log.har:374, network-log.har:375, network-log.har:381, network-log.har:382, network-log.har:383, network-log.har:384, network-log.har:385, network-log.har:387, network-log.har:388, network-log.har:394, network-log.har:395, network-log.har:396, network-log.har:397, network-log.har:398, network-log.har:399, network-log.har:400, network-log.har:448, network-log.har:454, network-log.har:456, network-log.har:457, network-log.har:458, network-log.har:459, network-log.har:463, network-log.har:466, network-log.har:467, network-log.har:468, network-log.har:469, network-log.har:470, network-log.har:471, network-log.har:477, network-log.har:478, network-log.har:480, network-log.har:481, network-log.har:482, network-log.har:483, network-log.har:484, network-log.har:490, network-log.har:491, network-log.har:493, network-log.har:494, network-log.har:495, network-log.har:496, network-log.har:497, network-log.har:503, network-log.har:504, network-log.har:505, network-log.har:506, network-log.har:507, network-log.har:508, network-log.har:511, network-log.har:515, network-log.har:516, network-log.har:517, network-log.har:518, network-log.har:519, network-log.har:520, network-log.har:542, network-log.har:568, network-log.har:575, network-log.har:576, network-log.har:577, network-log.har:578, network-log.har:579, network-log.har:585, network-log.har:586, network-log.har:587, network-log.har:588, network-log.har:589, network-log.har:591, network-log.har:592, network-log.har:598, network-log.har:599, network-log.har:600, network-log.har:601, network-log.har:602, network-log.har:603, network-log.har:604, network-log.har:610, network-log.har:611, network-log.har:612, network-log.har:613, network-log.har:614, network-log.har:615, network-log.har:617, network-log.har:622, network-log.har:623, network-log.har:624, network-log.har:625, network-log.har:626, network-log.har:627, network-log.har:633, network-log.har:634, network-log.har:635, network-log.har:636, network-log.har:637, network-log.har:638, network-log.har:639, network-log.har:641, network-log.har:688, network-log.har:693, network-log.har:697, network-log.har:698, network-log.har:699, network-log.har:700, network-log.har:706, network-log.har:707, network-log.har:708, network-log.har:709, network-log.har:710, network-log.har:711, network-log.har:712, network-log.har:718, network-log.har:719, network-log.har:720, network-log.har:721, network-log.har:722, network-log.har:723, network-log.har:729, network-log.har:730, network-log.har:731, network-log.har:732, network-log.har:733, network-log.har:734, network-log.har:735, network-log.har:741, network-log.har:742, network-log.har:743, network-log.har:744, network-log.har:745, network-log.har:747, network-log.har:748, network-log.har:754, network-log.har:755, network-log.har:757, network-log.har:758, network-log.har:759, network-log.har:760, network-log.har:761, network-log.har:809, network-log.har:816, network-log.har:817, network-log.har:818, network-log.har:819, network-log.har:820, network-log.har:826, network-log.har:827, network-log.har:828, network-log.har:829, network-log.har:830, network-log.har:831, network-log.har:832, network-log.har:838, network-log.har:839, network-log.har:840, network-log.har:841, network-log.har:842, network-log.har:843, network-log.har:844, network-log.har:850, network-log.har:851, network-log.har:853, network-log.har:854, network-log.har:855, network-log.har:856, network-log.har:857, network-log.har:859, network-log.har:861, network-log.har:866, network-log.har:867, network-log.har:868, network-log.har:869, network-log.har:871, network-log.har:876, network-log.har:877, network-log.har:878, network-log.har:879, network-log.har:880, network-log.har:881, network-log.har:887, network-log.har:932, network-log.har:939, network-log.har:940, network-log.har:941, network-log.har:942, network-log.har:943, network-log.har:949, network-log.har:950, network-log.har:951, network-log.har:952, network-log.har:953, network-log.har:955, network-log.har:956, network-log.har:962, network-log.har:963, network-log.har:964, network-log.har:965, network-log.har:966, network-log.har:967, network-log.har:968, network-log.har:974, network-log.har:975, network-log.har:976, network-log.har:978, network-log.har:979, network-log.har:980, network-log.har:986, network-log.har:987, network-log.har:988, network-log.har:989, network-log.har:990, network-log.har:991, network-log.har:992, network-log.har:994, network-log.har:996, network-log.har:1001, network-log.har:1002, network-log.har:1003, network-log.har:1004, network-log.har:1005, network-log.har:1043, network-log.har:1058, network-log.har:1063, network-log.har:1064, network-log.har:1065, network-log.har:1066, network-log.har:1067, network-log.har:1075, network-log.har:1076, network-log.har:1077, network-log.har:1078, network-log.har:1079, network-log.har:1080, network-log.har:1086, network-log.har:1087, network-log.har:1089, network-log.har:1090, network-log.har:1091, network-log.har:1092, network-log.har:1093, network-log.har:1099, network-log.har:1100, network-log.har:1101, network-log.har:1102, network-log.har:1103, network-log.har:1104, network-log.har:1105, network-log.har:1111, network-log.har:1112, network-log.har:1113, network-log.har:1114, network-log.har:1115, network-log.har:1121, network-log.har:1122, network-log.har:1123, network-log.har:1124, network-log.har:1126, network-log.har:1127, network-log.har:1128, network-log.har:1177, network-log.har:1181, network-log.har:1185, network-log.har:1186, network-log.har:1187, network-log.har:1188, network-log.har:1191, network-log.har:1197, network-log.har:1198, network-log.har:1199, network-log.har:1200, network-log.har:1201, network-log.har:1202, network-log.har:1204, network-log.har:1209, network-log.har:1210, network-log.har:1211, network-log.har:1212, network-log.har:1213, network-log.har:1214, network-log.har:1220, network-log.har:1221, network-log.har:1222, network-log.har:1223, network-log.har:1224, network-log.har:1225, network-log.har:1226, network-log.har:1232, network-log.har:1233, network-log.har:1235, network-log.har:1236, network-log.har:1237, network-log.har:1238, network-log.har:1239, network-log.har:1245, network-log.har:1246, network-log.har:1248, network-log.har:1249, network-log.har:1250, network-log.har:1251, network-log.har:1271, network-log.har:1300, network-log.har:1307, network-log.har:1308, network-log.har:1309, network-log.har:1310, network-log.har:1311, network-log.har:1319, network-log.har:1320, network-log.har:1321, network-log.har:1322, network-log.har:1323, network-log.har:1324, network-log.har:1325, network-log.har:1331, network-log.har:1332, network-log.har:1333, network-log.har:1334, network-log.har:1335, network-log.har:1336, network-log.har:1338, network-log.har:1361, network-log.har:1362, network-log.har:1363, network-log.har:1364, network-log.har:1365, network-log.har:1366, network-log.har:1372, network-log.har:1373, network-log.har:1374, network-log.har:1375, network-log.har:1376, network-log.har:1377, network-log.har:1381, network-log.har:1384, network-log.har:1386, network-log.har:1387, network-log.har:1389, network-log.har:1390, network-log.har:1391, network-log.har:1420, network-log.har:1442, network-log.har:1449, network-log.har:1450, network-log.har:1451, network-log.har:1452, network-log.har:1453, network-log.har:1459, network-log.har:1460, network-log.har:1461, network-log.har:1462, network-log.har:1463, network-log.har:1464, network-log.har:1465, network-log.har:1471, network-log.har:1472, network-log.har:1473, network-log.har:1474, network-log.har:1475, network-log.har:1476, network-log.har:1479, network-log.har:1483, network-log.har:1484, network-log.har:1485, network-log.har:1486, network-log.har:1487, network-log.har:1488, network-log.har:1494, network-log.har:1495, network-log.har:1496, network-log.har:1497, network-log.har:1499, network-log.har:1500, network-log.har:1501, network-log.har:1507, network-log.har:1508, network-log.har:1509, network-log.har:1510, network-log.har:1511, network-log.har:1512, network-log.har:1513, network-log.har:1562, network-log.har:1566, network-log.har:1570, network-log.har:1571, network-log.har:1572, network-log.har:1573, network-log.har:1575, network-log.har:1580, network-log.har:1581, network-log.har:1582, network-log.har:1583, network-log.har:1584, network-log.har:1585, network-log.har:1591, network-log.har:1592, network-log.har:1593, network-log.har:1594, network-log.har:1595, network-log.har:1596, network-log.har:1597, network-log.har:1603, network-log.har:1605, network-log.har:1606, network-log.har:1607, network-log.har:1608, network-log.har:1609, network-log.har:1610, network-log.har:1616, network-log.har:1617, network-log.har:1618, network-log.har:1619, network-log.har:1620, network-log.har:1621, network-log.har:1622, network-log.har:1628, network-log.har:1629, network-log.har:1630, network-log.har:1631, network-log.har:1632, network-log.har:1633, network-log.har:1635, network-log.har:1636, network-log.har:1674, network-log.har:1691, network-log.har:1695, network-log.har:1696, network-log.har:1697, network-log.har:1703, network-log.har:1704, network-log.har:1705, network-log.har:1706, network-log.har:1708, network-log.har:1709, network-log.har:1710, network-log.har:1716, network-log.har:1717, network-log.har:1719, network-log.har:1720, network-log.har:1721, network-log.har:1722, network-log.har:1723, network-log.har:1729, network-log.har:1730, network-log.har:1731, network-log.har:1732, network-log.har:1733, network-log.har:1734, network-log.har:1735, network-log.har:1741, network-log.har:1742, network-log.har:1743, network-log.har:1744, network-log.har:1745, network-log.har:1746, network-log.har:1749, network-log.har:1753, network-log.har:1754, network-log.har:1755, network-log.har:1756, network-log.har:1757, network-log.har:1758, network-log.har:1768, network-log.har:1809, network-log.har:1816, network-log.har:1817, network-log.har:1818, network-log.har:1819, network-log.har:1820, network-log.har:1826, network-log.har:1827, network-log.har:1828, network-log.har:1829, network-log.har:1830, network-log.har:1831, network-log.har:1832, network-log.har:1834, network-log.har:1836, network-log.har:1841, network-log.har:1842, network-log.har:1843, network-log.har:1844, network-log.har:1845, network-log.har:1851, network-log.har:1852, network-log.har:1853, network-log.har:1854, network-log.har:1855, network-log.har:1856, network-log.har:1858, network-log.har:1863, network-log.har:1864, network-log.har:1865, network-log.har:1867, network-log.har:1868, network-log.har:1869, network-log.har:1875, network-log.har:1876, network-log.har:1877, network-log.har:1878, network-log.har:1879, network-log.har:1880, network-log.har:1881, network-log.har:1928, network-log.har:1934, network-log.har:1938, network-log.har:1939, network-log.har:1940, network-log.har:1941, network-log.har:1942, network-log.har:1948, network-log.har:1949, network-log.har:1950, network-log.har:1951, network-log.har:1952, network-log.har:1953, network-log.har:1954, network-log.har:1960, network-log.har:1961, network-log.har:1962, network-log.har:1963, network-log.har:1964, network-log.har:1965, network-log.har:1968, network-log.har:1972, network-log.har:1974, network-log.har:1975, network-log.har:1976, network-log.har:1977, network-log.har:1978, network-log.har:1984, network-log.har:1985, network-log.har:1986, network-log.har:1987, network-log.har:1988, network-log.har:1989, network-log.har:1990, network-log.har:1996, network-log.har:1997, network-log.har:1999, network-log.har:2000, network-log.har:2001, network-log.har:2002, network-log.har:2003, network-log.har:2050, network-log.har:2054, network-log.har:2058, network-log.har:2059, network-log.har:2060, network-log.har:2061, network-log.har:2062, network-log.har:2068, network-log.har:2069, network-log.har:2070, network-log.har:2071, network-log.har:2073, network-log.har:2074, network-log.har:2080, network-log.har:2081, network-log.har:2082, network-log.har:2083, network-log.har:2084, network-log.har:2085, network-log.har:2086, network-log.har:2092, network-log.har:2093, network-log.har:2094, network-log.har:2095, network-log.har:2096, network-log.har:2097, network-log.har:2098, network-log.har:2104, network-log.har:2105, network-log.har:2106, network-log.har:2107, network-log.har:2108, network-log.har:2109, network-log.har:2110, network-log.har:2116, network-log.har:2117, network-log.har:2118, network-log.har:2119, network-log.har:2120, network-log.har:2121, network-log.har:2123, network-log.har:2171, network-log.har:2179, network-log.har:2181, network-log.har:2182, network-log.har:2183, network-log.har:2184, network-log.har:2190, network-log.har:2191, network-log.har:2192, network-log.har:2193, network-log.har:2194, network-log.har:2195, network-log.har:2196, network-log.har:2202, network-log.har:2203, network-log.har:2204, network-log.har:2205, network-log.har:2206, network-log.har:2207, network-log.har:2208, network-log.har:2214, network-log.har:2215, network-log.har:2216, network-log.har:2217, network-log.har:2218, network-log.har:2219, network-log.har:2221, network-log.har:2226, network-log.har:2227, network-log.har:2228, network-log.har:2229, network-log.har:2231, network-log.har:2232, network-log.har:2238, network-log.har:2239, network-log.har:2240, network-log.har:2241, network-log.har:2242, network-log.har:2243, network-log.har:2244, network-log.har:2292, network-log.har:2296, network-log.har:2300, network-log.har:2301, network-log.har:2302, network-log.har:2303, network-log.har:2307, network-log.har:2310, network-log.har:2311, network-log.har:2312, network-log.har:2313, network-log.har:2314, network-log.har:2315, network-log.har:2319, network-log.har:2322, network-log.har:2324, network-log.har:2325, network-log.har:2326, network-log.har:2327, network-log.har:2328, network-log.har:2334, network-log.har:2336, network-log.har:2337, network-log.har:2338, network-log.har:2339, network-log.har:2340, network-log.har:2341, network-log.har:2347, network-log.har:2348, network-log.har:2349, network-log.har:2350, network-log.har:2351, network-log.har:2352, network-log.har:2354, network-log.har:2361, network-log.har:2362, network-log.har:2363, network-log.har:2364, network-log.har:2365, network-log.har:2366, network-log.har:2382, network-log.har:2415, network-log.har:2422, network-log.har:2423, network-log.har:2424, network-log.har:2425, network-log.har:2426, network-log.har:2432, network-log.har:2433, network-log.har:2434, network-log.har:2435, network-log.har:2437, network-log.har:2438, network-log.har:2439, network-log.har:2445, network-log.har:2446, network-log.har:2447, network-log.har:2448, network-log.har:2449, network-log.har:2450, network-log.har:2451, network-log.har:2457, network-log.har:2458, network-log.har:2459, network-log.har:2460, network-log.har:2461, network-log.har:2462, network-log.har:2468, network-log.har:2469, network-log.har:2470, network-log.har:2473, network-log.har:2474, network-log.har:2475, network-log.har:2476, network-log.har:2482, network-log.har:2483, network-log.har:2484, network-log.har:2485, network-log.har:2486, network-log.har:2487, network-log.har:2488, network-log.har:2535, network-log.har:2548, network-log.har:2551, network-log.har:2552, network-log.har:2553, network-log.har:2554, network-log.har:2560, network-log.har:2561, network-log.har:2562, network-log.har:2563, network-log.har:2564, network-log.har:2565, network-log.har:2568, network-log.har:2572, network-log.har:2573, network-log.har:2574, network-log.har:2575, network-log.har:2576, network-log.har:2577, network-log.har:2583, network-log.har:2584, network-log.har:2585, network-log.har:2586, network-log.har:2587, network-log.har:2588, network-log.har:2589, network-log.har:2595, network-log.har:2596, network-log.har:2597, network-log.har:2598, network-log.har:2599, network-log.har:2600, network-log.har:2604, network-log.har:2608, network-log.har:2610, network-log.har:2611, network-log.har:2612, network-log.har:2613, network-log.har:2614, network-log.har:2656, network-log.har:2666, network-log.har:2670, network-log.har:2671, network-log.har:2672, network-log.har:2673, network-log.har:2674, network-log.har:2680, network-log.har:2681, network-log.har:2682, network-log.har:2683, network-log.har:2684, network-log.har:2685, network-log.har:2686, network-log.har:2692, network-log.har:2693, network-log.har:2694, network-log.har:2695, network-log.har:2696, network-log.har:2697, network-log.har:2699, network-log.har:2700, network-log.har:2706, network-log.har:2708, network-log.har:2710, network-log.har:2711, network-log.har:2712, network-log.har:2718, network-log.har:2719, network-log.har:2720, network-log.har:2721, network-log.har:2722, network-log.har:2723, network-log.har:2724, network-log.har:2730, network-log.har:2731, network-log.har:2732, network-log.har:2733, network-log.har:2734, network-log.har:2735, network-log.har:2736, network-log.har:2784, network-log.har:2788, network-log.har:2792, network-log.har:2793, network-log.har:2794, network-log.har:2795, network-log.har:2796, network-log.har:2802, network-log.har:2803, network-log.har:2804, network-log.har:2805, network-log.har:2806, network-log.har:2807, network-log.har:2813, network-log.har:2815, network-log.har:2816, network-log.har:2817, network-log.har:2818, network-log.har:2819, network-log.har:2820, network-log.har:2826, network-log.har:2827, network-log.har:2828, network-log.har:2829, network-log.har:2830, network-log.har:2831, network-log.har:2832, network-log.har:2838, network-log.har:2839, network-log.har:2840, network-log.har:2841, network-log.har:2842, network-log.har:2843, network-log.har:2844, network-log.har:2850, network-log.har:2851, network-log.har:2852, network-log.har:2853, network-log.har:2854, network-log.har:2855, network-log.har:2856, network-log.har:2905, network-log.har:2912, network-log.har:2913, network-log.har:2915, network-log.har:2916, network-log.har:2917, network-log.har:2923, network-log.har:2924, network-log.har:2925, network-log.har:2926, network-log.har:2927, network-log.har:2928, network-log.har:2929, network-log.har:2935, network-log.har:2936, network-log.har:2938, network-log.har:2939, network-log.har:2940, network-log.har:2941, network-log.har:2942, network-log.har:2948, network-log.har:2949, network-log.har:2950, network-log.har:2951, network-log.har:2952, network-log.har:2953, network-log.har:2955, network-log.har:2960, network-log.har:2961, network-log.har:2962, network-log.har:2963, network-log.har:2964, network-log.har:2965, network-log.har:2972, network-log.har:2973, network-log.har:2974, network-log.har:2975, network-log.har:2976, network-log.har:2977, network-log.har:2978, network-log.har:2980, network-log.har:2981, network-log.har:3029, network-log.har:3034, network-log.har:3037, network-log.har:3038, network-log.har:3039, network-log.har:3045, network-log.har:3046, network-log.har:3047, network-log.har:3048, network-log.har:3049, network-log.har:3050, network-log.har:3052, network-log.har:3057, network-log.har:3058, network-log.har:3059, network-log.har:3060, network-log.har:3061, network-log.har:3062, network-log.har:3068, network-log.har:3069, network-log.har:3070, network-log.har:3072, network-log.har:3073, network-log.har:3074, network-log.har:3075, network-log.har:3081, network-log.har:3082, network-log.har:3083, network-log.har:3084, network-log.har:3085, network-log.har:3086, network-log.har:3087, network-log.har:3093, network-log.har:3094, network-log.har:3095, network-log.har:3096, network-log.har:3097, network-log.har:3098, network-log.har:3104, network-log.har:3147, network-log.har:3154, network-log.har:3155, network-log.har:3156, network-log.har:3157, network-log.har:3158, network-log.har:3164, network-log.har:3165, network-log.har:3166, network-log.har:3167, network-log.har:3168, network-log.har:3169, network-log.har:3170, network-log.har:3177, network-log.har:3178, network-log.har:3179, network-log.har:3180, network-log.har:3181, network-log.har:3182, network-log.har:3183, network-log.har:3189, network-log.har:3190, network-log.har:3191, network-log.har:3192, network-log.har:3193, network-log.har:3194, network-log.har:3197, network-log.har:3201, network-log.har:3202, network-log.har:3203, network-log.har:3204, network-log.har:3205, network-log.har:3206, network-log.har:3212, network-log.har:3213, network-log.har:3215, network-log.har:3216, network-log.har:3217, network-log.har:3218, network-log.har:3219, network-log.har:3255, network-log.har:3268, network-log.har:3274, network-log.har:3276, network-log.har:3277, network-log.har:3278, network-log.har:3279, network-log.har:3285, network-log.har:3286, network-log.har:3287, network-log.har:3288, network-log.har:3289, network-log.har:3290, network-log.har:3291, network-log.har:3297, network-log.har:3298, network-log.har:3300, network-log.har:3301, network-log.har:3334, network-log.har:3335, network-log.har:3336, network-log.har:3337, network-log.har:3343, network-log.har:3344, network-log.har:3345, network-log.har:3347, network-log.har:3352, network-log.har:3353, network-log.har:3354, network-log.har:3358, network-log.har:3361, network-log.har:3364, network-log.har:3365, network-log.har:3366, network-log.har:3367, network-log.har:3368, network-log.har:3369, network-log.har:3370, network-log.har:3418, network-log.har:3422, network-log.har:3426, network-log.har:3427, network-log.har:3428, network-log.har:3429, network-log.har:3430, network-log.har:3436, network-log.har:3438, network-log.har:3439, network-log.har:3440, network-log.har:3441, network-log.har:3442, network-log.har:3443, network-log.har:3449, network-log.har:3450, network-log.har:3451, network-log.har:3452, network-log.har:3453, network-log.har:3454, network-log.har:3457, network-log.har:3461, network-log.har:3462, network-log.har:3464, network-log.har:3465, network-log.har:3466.

## 99. POST gateway.us.trustwallet.com/v1/balances/stream

Query keys: none recorded. Status counts: `{"0":7,"200":217,"503":1}`. MIME: application/x-ndjson, text/plain, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ currency: string, addresses: Array<{ asset_id: string, address: string }> }
```

Response:

```text
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { asset_id: string, address: string, reason: string } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string }, block_timestamp: string } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string }, block_timestamp: string } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { asset_id: string, address: string, reason: string } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { asset_id: string, address: string, reason: string } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string }, block_timestamp: string } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { asset_id: string, address: string, reason: string } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string }, block_timestamp: string } } | { type: string, payload: { asset_id: string, address: string, reason: string } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string }, block_timestamp: string } } | { type: string, payload: { asset_id: string, address: string, reason: string } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { asset_id: string, address: string, reason: string } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
OR
Array<{ type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string }, block_timestamp: string } } | { type: string, payload: { address: string, asset_id: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } } | { type: string, payload: { asset_id: string, address: string, reason: string } } | { type: string, payload: { address: string, asset_id: string, slug: string, currency: string, amounts: { total: string, total_in_fiat: string, available: string, available_in_fiat: string } } }>
```

Record references: E2E-network-log-trust-wallet.har:8, E2E-network-log-trust-wallet.har:97, E2E-network-log-trust-wallet.har:103, E2E-network-log-trust-wallet.har:126, E2E-network-log-trust-wallet.har:145, E2E-network-log-trust-wallet.har:151, E2E-network-log-trust-wallet.har:160, E2E-network-log-trust-wallet.har:168, E2E-network-log-trust-wallet.har:262, E2E-network-log-trust-wallet.har:363, E2E-network-log-trust-wallet.har:432, E2E-network-log-trust-wallet.har:446, E2E-network-log-trust-wallet.har:458, E2E-network-log-trust-wallet.har:469, E2E-network-log-trust-wallet.har:479, E2E-network-log-trust-wallet.har:498, E2E-network-log-trust-wallet.har:501, E2E-network-log-trust-wallet.har:613, E2E-network-log-trust-wallet.har:641, E2E-network-log-trust-wallet.har:647, E2E-network-log-trust-wallet.har:655, E2E-network-log-trust-wallet.har:660, E2E-network-log-trust-wallet.har:670, E2E-network-log-trust-wallet.har:765, E2E-network-log-trust-wallet.har:798, E2E-network-log-trust-wallet.har:824, E2E-network-log-trust-wallet.har:928, E2E-network-log-trust-wallet.har:952, E2E-network-log-trust-wallet.har:961, E2E-network-log-trust-wallet.har:967, E2E-network-log-trust-wallet.har:973, E2E-network-log-trust-wallet.har:996, E2E-network-log-trust-wallet.har:1004, E2E-network-log-trust-wallet.har:1016, E2E-network-log-trust-wallet.har:1028, add-cutom-network.har:31, add-cutom-network.har:56, custom-token.har:5, custom-token.har:23, custom-token.har:41, custom-token.har:70, custom-token.har:89, custom-token.har:227, lock-unlock-biometric.har:12, lock-unlock-biometric.har:32, lock-unlock-biometric.har:41, lock-unlock-biometric.har:50, network-log.har:3, network-log.har:15, network-log.har:29, network-log.har:40, network-log.har:99, network-log.har:111, network-log.har:123, network-log.har:136, network-log.har:147, network-log.har:160, network-log.har:221, network-log.har:234, network-log.har:245, network-log.har:257, network-log.har:269, network-log.har:281, network-log.har:341, network-log.har:352, network-log.har:364, network-log.har:376, network-log.har:389, network-log.har:401, network-log.har:460, network-log.har:472, network-log.har:485, network-log.har:498, network-log.har:509, network-log.har:521, network-log.har:580, network-log.har:593, network-log.har:605, network-log.har:616, network-log.har:628, network-log.har:640, network-log.har:701, network-log.har:713, network-log.har:724, network-log.har:736, network-log.har:749, network-log.har:762, network-log.har:821, network-log.har:833, network-log.har:845, network-log.har:858, network-log.har:860, network-log.har:870, network-log.har:882, network-log.har:944, network-log.har:957, network-log.har:969, network-log.har:981, network-log.har:993, network-log.har:995, network-log.har:1006, network-log.har:1068, network-log.har:1081, network-log.har:1094, network-log.har:1106, network-log.har:1116, network-log.har:1129, network-log.har:1192, network-log.har:1203, network-log.har:1215, network-log.har:1227, network-log.har:1240, network-log.har:1252, network-log.har:1312, network-log.har:1326, network-log.har:1337, network-log.har:1339, network-log.har:1367, network-log.har:1378, network-log.har:1392, network-log.har:1454, network-log.har:1466, network-log.har:1477, network-log.har:1489, network-log.har:1502, network-log.har:1514, network-log.har:1574, network-log.har:1586, network-log.har:1598, network-log.har:1611, network-log.har:1623, network-log.har:1634, network-log.har:1637, network-log.har:1698, network-log.har:1711, network-log.har:1724, network-log.har:1736, network-log.har:1747, network-log.har:1759, network-log.har:1821, network-log.har:1833, network-log.har:1835, network-log.har:1846, network-log.har:1857, network-log.har:1870, network-log.har:1882, network-log.har:1943, network-log.har:1955, network-log.har:1966, network-log.har:1979, network-log.har:1991, network-log.har:2004, network-log.har:2063, network-log.har:2075, network-log.har:2087, network-log.har:2099, network-log.har:2111, network-log.har:2122, network-log.har:2185, network-log.har:2197, network-log.har:2209, network-log.har:2220, network-log.har:2233, network-log.har:2245, network-log.har:2304, network-log.har:2316, network-log.har:2329, network-log.har:2342, network-log.har:2353, network-log.har:2356, network-log.har:2367, network-log.har:2427, network-log.har:2440, network-log.har:2452, network-log.har:2463, network-log.har:2477, network-log.har:2489, network-log.har:2555, network-log.har:2566, network-log.har:2578, network-log.har:2590, network-log.har:2601, network-log.har:2615, network-log.har:2675, network-log.har:2687, network-log.har:2698, network-log.har:2701, network-log.har:2713, network-log.har:2725, network-log.har:2737, network-log.har:2797, network-log.har:2808, network-log.har:2821, network-log.har:2833, network-log.har:2845, network-log.har:2857, network-log.har:2918, network-log.har:2930, network-log.har:2943, network-log.har:2954, network-log.har:2966, network-log.har:2979, network-log.har:2982, network-log.har:3040, network-log.har:3051, network-log.har:3063, network-log.har:3076, network-log.har:3088, network-log.har:3099, network-log.har:3159, network-log.har:3171, network-log.har:3184, network-log.har:3195, network-log.har:3207, network-log.har:3220, network-log.har:3280, network-log.har:3292, network-log.har:3328, network-log.har:3338, network-log.har:3346, network-log.har:3355, network-log.har:3371, network-log.har:3431, network-log.har:3444, network-log.har:3455.

## 100. POST gateway.us.trustwallet.com/v1/centrifugo-hooks/token

Query keys: none recorded. Status counts: `{"0":4,"200":47}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{  }
```

Response:

```text
{ token: string }
```

Record references: E2E-network-log-trust-wallet.har:17, E2E-network-log-trust-wallet.har:279, E2E-network-log-trust-wallet.har:476, E2E-network-log-trust-wallet.har:904, lock-unlock-biometric.har:0, lock-unlock-biometric.har:18, network-log.har:24, network-log.har:129, network-log.har:230, network-log.har:332, network-log.har:386, network-log.har:492, network-log.har:590, network-log.har:689, network-log.har:746, network-log.har:852, network-log.har:954, network-log.har:1059, network-log.har:1073, network-log.har:1125, network-log.har:1189, network-log.har:1247, network-log.har:1317, network-log.har:1388, network-log.har:1440, network-log.har:1498, network-log.har:1604, network-log.har:1707, network-log.har:1808, network-log.har:1866, network-log.har:1973, network-log.har:2072, network-log.har:2172, network-log.har:2230, network-log.har:2335, network-log.har:2436, network-log.har:2536, network-log.har:2545, network-log.har:2546, network-log.har:2547, network-log.har:2549, network-log.har:2607, network-log.har:2709, network-log.har:2814, network-log.har:2914, network-log.har:2971, network-log.har:3071, network-log.har:3176, network-log.har:3275, network-log.har:3362, network-log.har:3463.

## 101. POST gateway.us.trustwallet.com/v1/txhub/bulk_history

Query keys: none recorded. Status counts: `{"200":63}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ addresses: Array<{ chain: string, address: string }>, from: string, to: string }
```

Response:

```text
{ data: Array<UNKNOWN item; empty in capture>, meta: { unsupported_chains: Array<string> } }
OR
{ data: Array<UNKNOWN item; empty in capture>, meta: {  } }
```

Record references: E2E-network-log-trust-wallet.har:192, E2E-network-log-trust-wallet.har:193, E2E-network-log-trust-wallet.har:194, E2E-network-log-trust-wallet.har:195, E2E-network-log-trust-wallet.har:196, E2E-network-log-trust-wallet.har:197, E2E-network-log-trust-wallet.har:198, E2E-network-log-trust-wallet.har:199, E2E-network-log-trust-wallet.har:200, E2E-network-log-trust-wallet.har:201, E2E-network-log-trust-wallet.har:202, E2E-network-log-trust-wallet.har:203, E2E-network-log-trust-wallet.har:204, E2E-network-log-trust-wallet.har:205, E2E-network-log-trust-wallet.har:206, E2E-network-log-trust-wallet.har:207, E2E-network-log-trust-wallet.har:208, E2E-network-log-trust-wallet.har:209, E2E-network-log-trust-wallet.har:220, E2E-network-log-trust-wallet.har:221, E2E-network-log-trust-wallet.har:222, E2E-network-log-trust-wallet.har:223, E2E-network-log-trust-wallet.har:224, E2E-network-log-trust-wallet.har:225, E2E-network-log-trust-wallet.har:226, E2E-network-log-trust-wallet.har:227, E2E-network-log-trust-wallet.har:228, E2E-network-log-trust-wallet.har:229, E2E-network-log-trust-wallet.har:230, E2E-network-log-trust-wallet.har:231, E2E-network-log-trust-wallet.har:232, E2E-network-log-trust-wallet.har:233, E2E-network-log-trust-wallet.har:234, E2E-network-log-trust-wallet.har:235, E2E-network-log-trust-wallet.har:236, E2E-network-log-trust-wallet.har:237, E2E-network-log-trust-wallet.har:238, E2E-network-log-trust-wallet.har:239, E2E-network-log-trust-wallet.har:240, E2E-network-log-trust-wallet.har:241, E2E-network-log-trust-wallet.har:242, E2E-network-log-trust-wallet.har:243, E2E-network-log-trust-wallet.har:244, E2E-network-log-trust-wallet.har:608, E2E-network-log-trust-wallet.har:610, E2E-network-log-trust-wallet.har:611, E2E-network-log-trust-wallet.har:612, E2E-network-log-trust-wallet.har:614, E2E-network-log-trust-wallet.har:615, E2E-network-log-trust-wallet.har:626, E2E-network-log-trust-wallet.har:631, E2E-network-log-trust-wallet.har:636, E2E-network-log-trust-wallet.har:671, E2E-network-log-trust-wallet.har:672, E2E-network-log-trust-wallet.har:673, E2E-network-log-trust-wallet.har:674, E2E-network-log-trust-wallet.har:675, E2E-network-log-trust-wallet.har:676, E2E-network-log-trust-wallet.har:926, E2E-network-log-trust-wallet.har:937, E2E-network-log-trust-wallet.har:979, E2E-network-log-trust-wallet.har:988, custom-token.har:122.

## 102. POST gateway.us.trustwallet.com/v1/validate/address

Query keys: none recorded. Status counts: `{"200":2,"400":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ asset_id: string, address: string, version: number, type: string }
```

Response:

```text
{ provider: Array<string>, risk_analysis: { risk_level: string, addresses: Array<{ address: string, risk_level: string }>, dapp: { risk_level: string } }, flagged_address: null }
OR
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:135, E2E-network-log-trust-wallet.har:137, E2E-network-log-trust-wallet.har:587, E2E-network-log-trust-wallet.har:594, E2E-network-log-trust-wallet.har:901, E2E-network-log-trust-wallet.har:905.

## 103. POST gateway.us.trustwallet.com/v1/validate/url

Query keys: none recorded. Status counts: `{"200":7}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ dapp_url: string }
```

Response:

```text
{ provider: Array<string>, risk_analysis: { risk_level: string }, dapp_url: string }
```

Record references: add-cutom-network.har:1, add-cutom-network.har:2, add-cutom-network.har:3, add-cutom-network.har:4, add-cutom-network.har:5, add-cutom-network.har:6, add-cutom-network.har:7.

## 104. POST gateway.us.trustwallet.com/v2/devices/fingerprint

Query keys: none recorded. Status counts: `{"200":37}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ identifier: string, bundle: string, sr: string }
```

Response:

```text
{ device_id: string, hash_key: string }
```

Record references: E2E-network-log-trust-wallet.har:24, E2E-network-log-trust-wallet.har:93, E2E-network-log-trust-wallet.har:425, E2E-network-log-trust-wallet.har:600, E2E-network-log-trust-wallet.har:618, E2E-network-log-trust-wallet.har:748, E2E-network-log-trust-wallet.har:909, E2E-network-log-trust-wallet.har:913, E2E-network-log-trust-wallet.har:1096, add-cutom-network.har:296, network-log.har:91, network-log.har:213, network-log.har:333, network-log.har:452, network-log.har:572, network-log.har:694, network-log.har:813, network-log.har:936, network-log.har:1060, network-log.har:1182, network-log.har:1304, network-log.har:1446, network-log.har:1567, network-log.har:1692, network-log.har:1813, network-log.har:1935, network-log.har:2055, network-log.har:2176, network-log.har:2297, network-log.har:2419, network-log.har:2667, network-log.har:2789, network-log.har:2909, network-log.har:3033, network-log.har:3151, network-log.har:3271, network-log.har:3423.

## 105. POST gateway.us.trustwallet.com/v2/market/tickers

Query keys: none recorded. Status counts: `{"0":9,"200":406}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ currency: string, assets: Array<string> }
OR
{ currency: string, assets: Array<string>, include_market_info: boolean }
```

Response:

```text
{ currency: string, tickers: Array<{ change_24h: number, provider: string, price: number, id: string, slug: string, last_updated_time: string }> }
OR
{ currency: string, tickers: Array<{ change_24h: number, provider: string, price: number, id: string, slug: string, market_info: { market_cap: number, volume_24h: number }, last_updated_time: string }> }
```

Record references: E2E-network-log-trust-wallet.har:5, E2E-network-log-trust-wallet.har:11, E2E-network-log-trust-wallet.har:92, E2E-network-log-trust-wallet.har:99, E2E-network-log-trust-wallet.har:101, E2E-network-log-trust-wallet.har:104, E2E-network-log-trust-wallet.har:106, E2E-network-log-trust-wallet.har:128, E2E-network-log-trust-wallet.har:147, E2E-network-log-trust-wallet.har:154, E2E-network-log-trust-wallet.har:162, E2E-network-log-trust-wallet.har:170, E2E-network-log-trust-wallet.har:179, E2E-network-log-trust-wallet.har:182, E2E-network-log-trust-wallet.har:184, E2E-network-log-trust-wallet.har:185, E2E-network-log-trust-wallet.har:190, E2E-network-log-trust-wallet.har:215, E2E-network-log-trust-wallet.har:269, E2E-network-log-trust-wallet.har:296, E2E-network-log-trust-wallet.har:301, E2E-network-log-trust-wallet.har:312, E2E-network-log-trust-wallet.har:332, E2E-network-log-trust-wallet.har:342, E2E-network-log-trust-wallet.har:424, E2E-network-log-trust-wallet.har:434, E2E-network-log-trust-wallet.har:448, E2E-network-log-trust-wallet.har:461, E2E-network-log-trust-wallet.har:471, E2E-network-log-trust-wallet.har:483, E2E-network-log-trust-wallet.har:589, E2E-network-log-trust-wallet.har:621, E2E-network-log-trust-wallet.har:644, E2E-network-log-trust-wallet.har:653, E2E-network-log-trust-wallet.har:658, E2E-network-log-trust-wallet.har:663, E2E-network-log-trust-wallet.har:747, E2E-network-log-trust-wallet.har:769, E2E-network-log-trust-wallet.har:903, E2E-network-log-trust-wallet.har:934, E2E-network-log-trust-wallet.har:947, E2E-network-log-trust-wallet.har:948, E2E-network-log-trust-wallet.har:958, E2E-network-log-trust-wallet.har:960, E2E-network-log-trust-wallet.har:966, E2E-network-log-trust-wallet.har:971, E2E-network-log-trust-wallet.har:978, E2E-network-log-trust-wallet.har:1000, E2E-network-log-trust-wallet.har:1010, E2E-network-log-trust-wallet.har:1012, E2E-network-log-trust-wallet.har:1094, add-cutom-network.har:295, custom-token.har:10, custom-token.har:11, custom-token.har:26, custom-token.har:27, custom-token.har:57, custom-token.har:58, custom-token.har:77, custom-token.har:78, custom-token.har:107, custom-token.har:108, lock-unlock-biometric.har:16, lock-unlock-biometric.har:17, lock-unlock-biometric.har:36, lock-unlock-biometric.har:37, lock-unlock-biometric.har:44, lock-unlock-biometric.har:45, lock-unlock-biometric.har:101, lock-unlock-biometric.har:102, network-log.har:7, network-log.har:8, network-log.har:18, network-log.har:19, network-log.har:32, network-log.har:33, network-log.har:89, network-log.har:90, network-log.har:102, network-log.har:103, network-log.har:114, network-log.har:115, network-log.har:126, network-log.har:127, network-log.har:139, network-log.har:140, network-log.har:150, network-log.har:151, network-log.har:210, network-log.har:211, network-log.har:224, network-log.har:225, network-log.har:237, network-log.har:238, network-log.har:249, network-log.har:250, network-log.har:260, network-log.har:261, network-log.har:272, network-log.har:273, network-log.har:329, network-log.har:330, network-log.har:344, network-log.har:345, network-log.har:356, network-log.har:357, network-log.har:367, network-log.har:368, network-log.har:379, network-log.har:380, network-log.har:392, network-log.har:393, network-log.har:450, network-log.har:451, network-log.har:464, network-log.har:465, network-log.har:475, network-log.har:476, network-log.har:488, network-log.har:489, network-log.har:501, network-log.har:502, network-log.har:513, network-log.har:514, network-log.har:570, network-log.har:571, network-log.har:583, network-log.har:584, network-log.har:596, network-log.har:597, network-log.har:608, network-log.har:609, network-log.har:620, network-log.har:621, network-log.har:631, network-log.har:632, network-log.har:691, network-log.har:692, network-log.har:704, network-log.har:705, network-log.har:716, network-log.har:717, network-log.har:727, network-log.har:728, network-log.har:739, network-log.har:740, network-log.har:752, network-log.har:753, network-log.har:811, network-log.har:812, network-log.har:824, network-log.har:825, network-log.har:836, network-log.har:837, network-log.har:848, network-log.har:849, network-log.har:864, network-log.har:865, network-log.har:874, network-log.har:875, network-log.har:934, network-log.har:935, network-log.har:947, network-log.har:948, network-log.har:960, network-log.har:961, network-log.har:972, network-log.har:973, network-log.har:984, network-log.har:985, network-log.har:999, network-log.har:1000, network-log.har:1056, network-log.har:1057, network-log.har:1071, network-log.har:1072, network-log.har:1084, network-log.har:1085, network-log.har:1097, network-log.har:1098, network-log.har:1109, network-log.har:1110, network-log.har:1119, network-log.har:1120, network-log.har:1179, network-log.har:1180, network-log.har:1195, network-log.har:1196, network-log.har:1207, network-log.har:1208, network-log.har:1218, network-log.har:1219, network-log.har:1230, network-log.har:1231, network-log.har:1243, network-log.har:1244, network-log.har:1302, network-log.har:1303, network-log.har:1315, network-log.har:1316, network-log.har:1329, network-log.har:1330, network-log.har:1357, network-log.har:1358, network-log.har:1359, network-log.har:1360, network-log.har:1370, network-log.har:1371, network-log.har:1382, network-log.har:1383, network-log.har:1444, network-log.har:1445, network-log.har:1457, network-log.har:1458, network-log.har:1469, network-log.har:1470, network-log.har:1481, network-log.har:1482, network-log.har:1492, network-log.har:1493, network-log.har:1505, network-log.har:1506, network-log.har:1564, network-log.har:1565, network-log.har:1578, network-log.har:1579, network-log.har:1589, network-log.har:1590, network-log.har:1601, network-log.har:1602, network-log.har:1614, network-log.har:1615, network-log.har:1626, network-log.har:1627, network-log.har:1689, network-log.har:1690, network-log.har:1701, network-log.har:1702, network-log.har:1714, network-log.har:1715, network-log.har:1727, network-log.har:1728, network-log.har:1739, network-log.har:1740, network-log.har:1751, network-log.har:1752, network-log.har:1811, network-log.har:1812, network-log.har:1824, network-log.har:1825, network-log.har:1839, network-log.har:1840, network-log.har:1849, network-log.har:1850, network-log.har:1861, network-log.har:1862, network-log.har:1873, network-log.har:1874, network-log.har:1932, network-log.har:1933, network-log.har:1946, network-log.har:1947, network-log.har:1958, network-log.har:1959, network-log.har:1970, network-log.har:1971, network-log.har:1982, network-log.har:1983, network-log.har:1994, network-log.har:1995, network-log.har:2052, network-log.har:2053, network-log.har:2066, network-log.har:2067, network-log.har:2078, network-log.har:2079, network-log.har:2090, network-log.har:2091, network-log.har:2102, network-log.har:2103, network-log.har:2114, network-log.har:2115, network-log.har:2174, network-log.har:2175, network-log.har:2188, network-log.har:2189, network-log.har:2200, network-log.har:2201, network-log.har:2212, network-log.har:2213, network-log.har:2224, network-log.har:2225, network-log.har:2236, network-log.har:2237, network-log.har:2294, network-log.har:2295, network-log.har:2308, network-log.har:2309, network-log.har:2320, network-log.har:2321, network-log.har:2332, network-log.har:2333, network-log.har:2345, network-log.har:2346, network-log.har:2359, network-log.har:2360, network-log.har:2417, network-log.har:2418, network-log.har:2430, network-log.har:2431, network-log.har:2443, network-log.har:2444, network-log.har:2455, network-log.har:2456, network-log.har:2466, network-log.har:2467, network-log.har:2480, network-log.har:2481, network-log.har:2541, network-log.har:2542, network-log.har:2543, network-log.har:2544, network-log.har:2558, network-log.har:2559, network-log.har:2570, network-log.har:2571, network-log.har:2581, network-log.har:2582, network-log.har:2593, network-log.har:2594, network-log.har:2605, network-log.har:2606, network-log.har:2664, network-log.har:2665, network-log.har:2678, network-log.har:2679, network-log.har:2690, network-log.har:2691, network-log.har:2704, network-log.har:2705, network-log.har:2707, network-log.har:2716, network-log.har:2717, network-log.har:2728, network-log.har:2729, network-log.har:2786, network-log.har:2787, network-log.har:2800, network-log.har:2801, network-log.har:2811, network-log.har:2812, network-log.har:2824, network-log.har:2825, network-log.har:2836, network-log.har:2837, network-log.har:2848, network-log.har:2849, network-log.har:2907, network-log.har:2908, network-log.har:2921, network-log.har:2922, network-log.har:2933, network-log.har:2934, network-log.har:2946, network-log.har:2947, network-log.har:2958, network-log.har:2959, network-log.har:2969, network-log.har:2970, network-log.har:3031, network-log.har:3032, network-log.har:3043, network-log.har:3044, network-log.har:3055, network-log.har:3056, network-log.har:3066, network-log.har:3067, network-log.har:3079, network-log.har:3080, network-log.har:3091, network-log.har:3092, network-log.har:3149, network-log.har:3150, network-log.har:3162, network-log.har:3163, network-log.har:3174, network-log.har:3175, network-log.har:3187, network-log.har:3188, network-log.har:3199, network-log.har:3200, network-log.har:3210, network-log.har:3211, network-log.har:3269, network-log.har:3270, network-log.har:3283, network-log.har:3284, network-log.har:3295, network-log.har:3296, network-log.har:3332, network-log.har:3333, network-log.har:3341, network-log.har:3342, network-log.har:3350, network-log.har:3351, network-log.har:3359, network-log.har:3360, network-log.har:3420, network-log.har:3421, network-log.har:3434, network-log.har:3435, network-log.har:3447, network-log.har:3448, network-log.har:3459, network-log.har:3460.

## 106. POST gateway.us.trustwallet.com/v3/devices/{deviceId}/wallets/{opaqueValue}/address_association

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ coin: number, address: string }
```

Response:

```text
{ status: boolean }
```

Record references: E2E-network-log-trust-wallet.har:493.

## 107. POST gateway.us.trustwallet.com/v3/devices/{deviceId}/wallets/{opaqueValue}/register

Query keys: none recorded. Status counts: `{"200":5,"429":1,"500":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ operation_type: string, accounts: Array<{ addresses: Array<string>, coin: number }> }
OR
{ parent_wallet_id: string, operation_type: string, accounts: Array<{ addresses: Array<string>, coin: number }> }
```

Response:

```text
{ accounts: Array<{ coin: number, addresses: Array<string> }>, coins: Array<number> }
OR
{ error: { message: string } }
```

Record references: E2E-network-log-trust-wallet.har:6, E2E-network-log-trust-wallet.har:10, E2E-network-log-trust-wallet.har:26, E2E-network-log-trust-wallet.har:86, E2E-network-log-trust-wallet.har:1015, E2E-network-log-trust-wallet.har:1026, E2E-network-log-trust-wallet.har:1029.

## 108. POST gateway.us.trustwallet.com/v3/nft/collections

Query keys: exclude_spam, page, pageSize. Status counts: `{"200":29}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ owners: Array<{ chain: string, address: string }> }
```

Response:

```text
{ docs: Array<UNKNOWN item; empty in capture>, next: null }
```

Record references: E2E-network-log-trust-wallet.har:3, E2E-network-log-trust-wallet.har:7, E2E-network-log-trust-wallet.har:9, E2E-network-log-trust-wallet.har:31, E2E-network-log-trust-wallet.har:91, E2E-network-log-trust-wallet.har:150, E2E-network-log-trust-wallet.har:364, E2E-network-log-trust-wallet.har:497, E2E-network-log-trust-wallet.har:499, E2E-network-log-trust-wallet.har:669, E2E-network-log-trust-wallet.har:797, E2E-network-log-trust-wallet.har:995, E2E-network-log-trust-wallet.har:1014, E2E-network-log-trust-wallet.har:1027, E2E-network-log-trust-wallet.har:1033, lock-unlock-biometric.har:7, lock-unlock-biometric.har:21, network-log.har:154, network-log.har:479, network-log.har:756, network-log.har:1088, network-log.har:1385, network-log.har:1718, network-log.har:1998, network-log.har:2323, network-log.har:2609, network-log.har:2937, network-log.har:3214, network-log.har:3302.

## 109. PUT gateway.us.trustwallet.com/v2/devices/{deviceId}/push-topics

Query keys: none recorded. Status counts: `{"204":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
{ product_announcement: boolean }
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:1.

## 110. POST gnosis.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ id: number, jsonrpc: string, result: string }
```

Record references: add-cutom-network.har:221.

## 111. POST gochain.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:209.

## 112. GET greenfield.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{hexValue}

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:80, E2E-network-log-trust-wallet.har:417, E2E-network-log-trust-wallet.har:568, E2E-network-log-trust-wallet.har:729, E2E-network-log-trust-wallet.har:878, E2E-network-log-trust-wallet.har:1086, add-cutom-network.har:249, lock-unlock-biometric.har:92, network-log.har:81, network-log.har:201, network-log.har:321, network-log.har:442, network-log.har:562, network-log.har:682, network-log.har:802, network-log.har:924, network-log.har:1048, network-log.har:1170, network-log.har:1293, network-log.har:1434, network-log.har:1555, network-log.har:1679, network-log.har:1800, network-log.har:1924, network-log.har:2044, network-log.har:2164, network-log.har:2285, network-log.har:2409, network-log.har:2529, network-log.har:2657, network-log.har:2777, network-log.har:2900, network-log.har:3022, network-log.har:3141, network-log.har:3261, network-log.har:3412.

## 113. GET groestlcoin-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:33, E2E-network-log-trust-wallet.har:371, E2E-network-log-trust-wallet.har:520, E2E-network-log-trust-wallet.har:686, E2E-network-log-trust-wallet.har:833, E2E-network-log-trust-wallet.har:1040, add-cutom-network.har:113, lock-unlock-biometric.har:56, network-log.har:46, network-log.har:166, network-log.har:287, network-log.har:407, network-log.har:527, network-log.har:647, network-log.har:767, network-log.har:889, network-log.har:1011, network-log.har:1135, network-log.har:1258, network-log.har:1398, network-log.har:1520, network-log.har:1643, network-log.har:1765, network-log.har:1888, network-log.har:2010, network-log.har:2128, network-log.har:2250, network-log.har:2372, network-log.har:2495, network-log.har:2620, network-log.har:2743, network-log.har:2863, network-log.har:2988, network-log.har:3105, network-log.har:3226, network-log.har:3377.

## 114. POST harmony.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:198.

## 115. POST hyperevm.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ id: number, jsonrpc: string, result: string }
```

Record references: add-cutom-network.har:277.

## 116. POST icon.twnodes.com/naas/session/{sessionToken}/api/v3

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: { address: string }, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, result: string, id: number }
```

Record references: add-cutom-network.har:123.

## 117. GET injective-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:258.

## 118. GET injective-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:257.

## 119. GET injective-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:256.

## 120. GET injective-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:255.

## 121. POST internetcomputer.twnodes.com/naas/session/{sessionToken}/account/balance

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ network_identifier: { blockchain: string, network: string }, account_identifier: { address: string } }
```

Response:

```text
{ block_identifier: { index: number, hash: string }, balances: Array<{ value: string, currency: { symbol: string, decimals: number } }> }
```

Record references: add-cutom-network.har:266.

## 122. POST iotex-jsonrpc.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ id: number, jsonrpc: string, result: string }
```

Record references: add-cutom-network.har:171.

## 123. GET juno-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:138.

## 124. GET juno-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:137.

## 125. GET juno-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:136.

## 126. GET juno-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:135.

## 127. POST kava-evm.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:235.

## 128. GET kava.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:186.

## 129. GET kava.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:185.

## 130. GET kava.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:184.

## 131. GET kava.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:183.

## 132. POST kcc.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:236.

## 133. POST klaytn.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":7}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: E2E-network-log-trust-wallet.har:79, E2E-network-log-trust-wallet.har:416, E2E-network-log-trust-wallet.har:567, E2E-network-log-trust-wallet.har:728, E2E-network-log-trust-wallet.har:877, E2E-network-log-trust-wallet.har:1085, add-cutom-network.har:247.

## 134. GET kusama.twnodes.com/naas/session/{sessionToken}/accounts/{opaqueValue}/balance-info

Query keys: none recorded. Status counts: `{"200":7}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, if-none-match, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ at: { hash: string, height: string }, nonce: string, tokenSymbol: string, free: string, reserved: string, miscFrozen: string, feeFrozen: string, frozen: string, transferable: string, locks: Array<UNKNOWN item; empty in capture> }
```

Record references: E2E-network-log-trust-wallet.har:51, E2E-network-log-trust-wallet.har:386, E2E-network-log-trust-wallet.har:537, E2E-network-log-trust-wallet.har:702, E2E-network-log-trust-wallet.har:848, E2E-network-log-trust-wallet.har:1055, add-cutom-network.har:181.

## 135. POST lb.routeme.sh/rpc/evm/{number}

Query keys: none recorded. Status counts: `{"429":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, user-agent.

Request:

```text
{ jsonrpc: string, id: string, method: string, params: Array<UNKNOWN item; empty in capture> }
```

Response:

```text
{ jsonrpc: string, id: number, error: { code: number, message: string } }
```

Record references: add-cutom-network.har:290.

## 136. GET lh3.google.com/u/{number}/ogw/{opaqueValue}

Query keys: none recorded. Status counts: `{"302":1}`. MIME: text/html.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent, x-browser-channel, x-browser-copyright, x-browser-validation, x-browser-year, x-client-data.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:0.

## 137. GET lh3.googleusercontent.com/a/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: image/png.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:11.

## 138. GET lh3.googleusercontent.com/rd-ogw/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: image/png.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent, x-browser-channel, x-browser-copyright, x-browser-validation, x-browser-year, x-client-data.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:5.

## 139. POST linea.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:120.

## 140. GET litecoin-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:28, E2E-network-log-trust-wallet.har:367, E2E-network-log-trust-wallet.har:516, E2E-network-log-trust-wallet.har:682, E2E-network-log-trust-wallet.har:827, E2E-network-log-trust-wallet.har:1036, add-cutom-network.har:106, lock-unlock-biometric.har:51, network-log.har:41, network-log.har:161, network-log.har:282, network-log.har:402, network-log.har:522, network-log.har:642, network-log.har:763, network-log.har:883, network-log.har:1007, network-log.har:1130, network-log.har:1253, network-log.har:1393, network-log.har:1515, network-log.har:1638, network-log.har:1760, network-log.har:1883, network-log.har:2005, network-log.har:2124, network-log.har:2246, network-log.har:2368, network-log.har:2490, network-log.har:2616, network-log.har:2738, network-log.har:2858, network-log.har:2983, network-log.har:3100, network-log.har:3221, network-log.har:3372.

## 141. POST manta.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:267.

## 142. POST mantle.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:121.

## 143. POST megaeth.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:275.

## 144. POST merlin.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:268.

## 145. POST metis.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:238.

## 146. POST monad.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, result: string, id: number }
```

Record references: add-cutom-network.har:274.

## 147. POST moonbeam.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:246.

## 148. POST moonriver.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:245.

## 149. GET multiversx-api.twnodes.com/naas/session/{sessionToken}/accounts/{opaqueValue}/delegation

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<UNKNOWN item; empty in capture>
```

Record references: add-cutom-network.har:190.

## 150. GET multiversx-api.twnodes.com/naas/session/{sessionToken}/address/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ data: { account: { address: string, nonce: number, balance: string, developerReward: string }, blockInfo: { nonce: number, hash: string, rootHash: string } }, code: string }
```

Record references: add-cutom-network.har:191.

## 151. POST nano.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":44}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ action: string, account: string, count: string }
OR
{ action: string, account: string }
```

Response:

```text
{ blocks: string }
OR
{ balance: string, pending: string, receivable: string }
```

Record references: E2E-network-log-trust-wallet.har:45, E2E-network-log-trust-wallet.har:50, E2E-network-log-trust-wallet.har:382, E2E-network-log-trust-wallet.har:396, E2E-network-log-trust-wallet.har:532, E2E-network-log-trust-wallet.har:542, E2E-network-log-trust-wallet.har:698, E2E-network-log-trust-wallet.har:712, E2E-network-log-trust-wallet.har:844, E2E-network-log-trust-wallet.har:853, E2E-network-log-trust-wallet.har:1051, E2E-network-log-trust-wallet.har:1056, add-cutom-network.har:163, add-cutom-network.har:168, lock-unlock-biometric.har:67, lock-unlock-biometric.har:72, network-log.har:57, network-log.har:176, network-log.har:297, network-log.har:417, network-log.har:537, network-log.har:657, network-log.har:778, network-log.har:899, network-log.har:1022, network-log.har:1145, network-log.har:1268, network-log.har:1408, network-log.har:1530, network-log.har:1653, network-log.har:1776, network-log.har:1898, network-log.har:2020, network-log.har:2139, network-log.har:2261, network-log.har:2384, network-log.har:2505, network-log.har:2631, network-log.har:2753, network-log.har:2873, network-log.har:2998, network-log.har:3116, network-log.har:3236, network-log.har:3387.

## 152. POST near.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: { request_type: string, account_id: string, finality: string }, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, error: { name: string, cause: { info: { block_hash: string, block_height: number, requested_account_id: string }, name: string }, code: number, message: string, data: string }, id: number }
OR
{ jsonrpc: string, result: { block_hash: string, block_height: number, keys: Array<UNKNOWN item; empty in capture> }, id: number }
```

Record references: add-cutom-network.har:178, add-cutom-network.har:179.

## 153. POST nebulas.twnodes.com/naas/session/{sessionToken}/v1/user/accountstate

Query keys: none recorded. Status counts: `{"0":68}`. MIME: x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ address: string }
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:62, E2E-network-log-trust-wallet.har:94, E2E-network-log-trust-wallet.har:398, E2E-network-log-trust-wallet.har:428, E2E-network-log-trust-wallet.har:550, E2E-network-log-trust-wallet.har:601, E2E-network-log-trust-wallet.har:714, E2E-network-log-trust-wallet.har:751, E2E-network-log-trust-wallet.har:860, E2E-network-log-trust-wallet.har:914, E2E-network-log-trust-wallet.har:1067, add-cutom-network.har:208, network-log.har:69, network-log.har:93, network-log.har:189, network-log.har:215, network-log.har:309, network-log.har:335, network-log.har:430, network-log.har:455, network-log.har:550, network-log.har:574, network-log.har:670, network-log.har:696, network-log.har:790, network-log.har:815, network-log.har:911, network-log.har:938, network-log.har:1035, network-log.har:1062, network-log.har:1158, network-log.har:1184, network-log.har:1281, network-log.har:1306, network-log.har:1421, network-log.har:1448, network-log.har:1543, network-log.har:1569, network-log.har:1666, network-log.har:1694, network-log.har:1788, network-log.har:1815, network-log.har:1912, network-log.har:1937, network-log.har:2032, network-log.har:2057, network-log.har:2151, network-log.har:2178, network-log.har:2273, network-log.har:2299, network-log.har:2397, network-log.har:2421, network-log.har:2517, network-log.har:2538, network-log.har:2644, network-log.har:2669, network-log.har:2765, network-log.har:2791, network-log.har:2886, network-log.har:2911, network-log.har:3010, network-log.har:3036, network-log.har:3128, network-log.har:3153, network-log.har:3248, network-log.har:3273, network-log.har:3400, network-log.har:3425.

## 154. POST neon.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":12,"400":20,"503":21}`. MIME: application/json, text/plain, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ id: number, jsonrpc: string, error: { message: string, code: number } }
```

Record references: E2E-network-log-trust-wallet.har:82, E2E-network-log-trust-wallet.har:90, E2E-network-log-trust-wallet.har:419, E2E-network-log-trust-wallet.har:570, E2E-network-log-trust-wallet.har:578, E2E-network-log-trust-wallet.har:731, E2E-network-log-trust-wallet.har:737, E2E-network-log-trust-wallet.har:880, E2E-network-log-trust-wallet.har:1088, add-cutom-network.har:265, add-cutom-network.har:276, lock-unlock-biometric.har:94, lock-unlock-biometric.har:98, network-log.har:83, network-log.har:203, network-log.har:208, network-log.har:323, network-log.har:444, network-log.har:564, network-log.har:684, network-log.har:804, network-log.har:808, network-log.har:926, network-log.har:930, network-log.har:1050, network-log.har:1054, network-log.har:1172, network-log.har:1175, network-log.har:1295, network-log.har:1299, network-log.har:1436, network-log.har:1557, network-log.har:1560, network-log.har:1681, network-log.har:1803, network-log.har:1807, network-log.har:1926, network-log.har:2046, network-log.har:2166, network-log.har:2170, network-log.har:2287, network-log.har:2290, network-log.har:2411, network-log.har:2531, network-log.har:2659, network-log.har:2779, network-log.har:2783, network-log.har:2901, network-log.har:3024, network-log.har:3028, network-log.har:3143, network-log.har:3263, network-log.har:3414.

## 155. GET neutron-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":7}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:41, E2E-network-log-trust-wallet.har:378, E2E-network-log-trust-wallet.har:528, E2E-network-log-trust-wallet.har:694, E2E-network-log-trust-wallet.har:840, E2E-network-log-trust-wallet.har:1047, add-cutom-network.har:147.

## 156. POST nimiq.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, result: { data: { address: string, balance: number, type: string }, metadata: { blockNumber: number, blockHash: string } }, id: number }
```

Record references: add-cutom-network.har:167.

## 157. POST o4507686279512064.ingest.us.sentry.io/api/{number}/envelope/

Query keys: sentry_client, sentry_key, sentry_version. Status counts: `{"200":6,"429":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent.

Request:

```text
Array<{ event_id: string, sent_at: string, sdk: { name: string, version: string }, trace: { environment: string, release: string, public_key: string, trace_id: string } } | { type: string } | { exception: { values: Array<{ type: string, value: string, stacktrace: { frames: Array<{ filename: string, function: string, in_app: boolean, lineno: number, colno: number } | { filename: string, function: string, in_app: boolean }> }, mechanism: { type: string, handled: boolean } }> }, level: string, event_id: string, platform: string, request: { url: string, headers: { User-Agent: string } }, timestamp: number, environment: string, release: string, sdk: { integrations: Array<string>, name: string, version: string, packages: Array<{ name: string, version: string }> }, extra: { errorParams: { context: string } }, tags: { context: string, url: string, source: string }, contexts: { trace: { trace_id: string, span_id: string }, react: { version: string }, Error: {  } }, breadcrumbs: Array<{ timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string } | { timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string, level: string }>, debug_meta: { images: Array<{ type: string, code_file: string, debug_id: string }> } }>
OR
Array<{ event_id: string, sent_at: string, sdk: { name: string, version: string }, trace: { environment: string, release: string, public_key: string, trace_id: string } } | { type: string } | { exception: { values: Array<{ type: string, value: string, stacktrace: { frames: Array<{ filename: string, function: string, in_app: boolean, lineno: number, colno: number } | { filename: string, function: string, in_app: boolean }> }, mechanism: { type: string, handled: boolean } }> }, level: string, event_id: string, platform: string, request: { url: string, headers: { User-Agent: string } }, timestamp: number, environment: string, release: string, sdk: { integrations: Array<string>, name: string, version: string, packages: Array<{ name: string, version: string }> }, extra: { errorParams: { context: string } }, tags: { context: string, url: string, safe_method: string, http_status: number }, contexts: { trace: { trace_id: string, span_id: string }, react: { version: string }, AxiosError: { isAxiosError: boolean, code: string, config: { transitional: { silentJSONParsing: boolean, forcedJSONParsing: boolean, clarifyTimeoutError: boolean, legacyInterceptorReqResOrdering: boolean, advertiseZstdAcceptEncoding: boolean, validateStatusUndefinedResolves: boolean }, adapter: string, transformRequest: Array<string>, transformResponse: Array<string>, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: { FormData: string, Blob: string }, validateStatus: string, headers: string, fetchOptions: { redirect: string }, method: string, url: string, data: string, allowAbsoluteUrls: boolean }, request: {  }, response: { data: { error: string }, headers: string, status: number, statusText: string, config: { transitional: string, adapter: string, transformRequest: string, transformResponse: string, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: string, validateStatus: string, headers: string, fetchOptions: string, method: string, url: string, data: string, allowAbsoluteUrls: boolean }, request: {  } }, status: number, message: string, name: string, stack: string } }, breadcrumbs: Array<{ timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string } | { timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string, level: string } | { timestamp: number, category: string, data: { method: string, url: string }, level: string, type: string }>, debug_meta: { images: Array<{ type: string, code_file: string, debug_id: string }> }, fingerprint: Array<string> }>
OR
Array<{ event_id: string, sent_at: string, sdk: { name: string, version: string }, trace: { environment: string, release: string, public_key: string, trace_id: string } } | { type: string } | { exception: { values: Array<{ type: string, value: string, stacktrace: { frames: Array<{ filename: string, function: string, in_app: boolean, lineno: number, colno: number } | { filename: string, function: string, in_app: boolean }> }, mechanism: { type: string, handled: boolean } }> }, level: string, event_id: string, platform: string, request: { url: string, headers: { User-Agent: string } }, timestamp: number, environment: string, release: string, sdk: { integrations: Array<string>, name: string, version: string, packages: Array<{ name: string, version: string }> }, extra: { errorParams: { context: string } }, tags: { context: string, url: string, safe_method: string, http_status: number }, contexts: { trace: { trace_id: string, span_id: string }, react: { version: string }, AxiosError: { isAxiosError: boolean, code: string, config: { transitional: { silentJSONParsing: boolean, forcedJSONParsing: boolean, clarifyTimeoutError: boolean, legacyInterceptorReqResOrdering: boolean, advertiseZstdAcceptEncoding: boolean, validateStatusUndefinedResolves: boolean }, adapter: string, transformRequest: Array<string>, transformResponse: Array<string>, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: { FormData: string, Blob: string }, validateStatus: string, headers: string, fetchOptions: { redirect: string }, method: string, url: string, allowAbsoluteUrls: boolean }, request: {  }, response: { data: { error: string }, headers: string, status: number, statusText: string, config: { transitional: string, adapter: string, transformRequest: string, transformResponse: string, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: string, validateStatus: string, headers: string, fetchOptions: string, method: string, url: string, allowAbsoluteUrls: boolean }, request: {  } }, status: number, message: string, name: string, stack: string } }, breadcrumbs: Array<{ timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string } | { timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string, level: string } | { timestamp: number, category: string, data: { method: string, url: string }, level: string, type: string }>, debug_meta: { images: Array<{ type: string, code_file: string, debug_id: string }> }, fingerprint: Array<string> }>
OR
Array<{ event_id: string, sent_at: string, sdk: { name: string, version: string }, trace: { environment: string, release: string, public_key: string, trace_id: string } } | { type: string } | { exception: { values: Array<{ type: string, value: string, stacktrace: { frames: Array<{ filename: string, function: string, in_app: boolean, lineno: number, colno: number } | { filename: string, function: string, in_app: boolean }> }, mechanism: { type: string, handled: boolean } }> }, level: string, event_id: string, platform: string, request: { url: string, headers: { User-Agent: string } }, timestamp: number, environment: string, release: string, sdk: { integrations: Array<string>, name: string, version: string, packages: Array<{ name: string, version: string }> }, extra: { errorParams: { context: string } }, tags: { context: string, url: string, safe_method: string, http_status: number }, contexts: { trace: { trace_id: string, span_id: string }, react: { version: string }, AxiosError: { isAxiosError: boolean, code: string, config: { transitional: { silentJSONParsing: boolean, forcedJSONParsing: boolean, clarifyTimeoutError: boolean, legacyInterceptorReqResOrdering: boolean, advertiseZstdAcceptEncoding: boolean, validateStatusUndefinedResolves: boolean }, adapter: string, transformRequest: Array<string>, transformResponse: Array<string>, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: { FormData: string, Blob: string }, validateStatus: string, headers: string, fetchOptions: { redirect: string }, method: string, url: string, allowAbsoluteUrls: boolean }, request: {  }, response: { data: { error: string }, headers: string, status: number, statusText: string, config: { transitional: string, adapter: string, transformRequest: string, transformResponse: string, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: string, validateStatus: string, headers: string, fetchOptions: string, method: string, url: string, allowAbsoluteUrls: boolean }, request: {  } }, status: number, message: string, name: string, stack: string } }, breadcrumbs: Array<{ timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string } | { timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string, level: string } | { timestamp: number, category: string, data: { method: string, url: string }, level: string, type: string } | { timestamp: number, category: string, event_id: string, level: string, message: string }>, debug_meta: { images: Array<{ type: string, code_file: string, debug_id: string }> }, fingerprint: Array<string> }>
OR
Array<{ event_id: string, sent_at: string, sdk: { name: string, version: string }, trace: { environment: string, release: string, public_key: string, trace_id: string } } | { type: string } | { exception: { values: Array<{ type: string, value: string, stacktrace: { frames: Array<{ filename: string, function: string, in_app: boolean, lineno: number, colno: number } | { filename: string, function: string, in_app: boolean }> }, mechanism: { type: string, handled: boolean } }> }, level: string, event_id: string, platform: string, request: { url: string, headers: { User-Agent: string } }, timestamp: number, environment: string, release: string, sdk: { integrations: Array<string>, name: string, version: string, packages: Array<{ name: string, version: string }> }, extra: { errorParams: { context: string } }, tags: { context: string, url: string, safe_method: string, http_status: number }, contexts: { trace: { trace_id: string, span_id: string }, react: { version: string }, AxiosError: { isAxiosError: boolean, code: string, config: { transitional: { silentJSONParsing: boolean, forcedJSONParsing: boolean, clarifyTimeoutError: boolean, legacyInterceptorReqResOrdering: boolean, advertiseZstdAcceptEncoding: boolean, validateStatusUndefinedResolves: boolean }, adapter: string, transformRequest: Array<string>, transformResponse: Array<string>, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: { FormData: string, Blob: string }, validateStatus: string, headers: string, fetchOptions: { redirect: string }, params: { asset: string, chain: string, address: string, from: string, to: string, limit: number }, url: string, allowAbsoluteUrls: boolean, method: string }, request: {  }, response: { data: { error: string }, headers: string, status: number, statusText: string, config: { transitional: string, adapter: string, transformRequest: string, transformResponse: string, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: string, validateStatus: string, headers: string, fetchOptions: string, params: string, url: string, allowAbsoluteUrls: boolean, method: string }, request: {  } }, status: number, message: string, name: string, stack: string } }, breadcrumbs: Array<{ timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string } | { timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string, level: string } | { timestamp: number, category: string, data: { method: string, url: string }, level: string, type: string } | { timestamp: number, category: string, event_id: string, level: string, message: string }>, debug_meta: { images: Array<{ type: string, code_file: string, debug_id: string }> }, fingerprint: Array<string> }>
OR
Array<{ event_id: string, sent_at: string, sdk: { name: string, version: string }, trace: { environment: string, release: string, public_key: string, trace_id: string } } | { type: string } | { exception: { values: Array<{ type: string, value: string, stacktrace: { frames: Array<{ filename: string, function: string, in_app: boolean, lineno: number, colno: number } | { filename: string, function: string, in_app: boolean }> }, mechanism: { type: string, handled: boolean } }> }, level: string, event_id: string, platform: string, request: { url: string, headers: { User-Agent: string } }, timestamp: number, environment: string, release: string, sdk: { integrations: Array<string>, name: string, version: string, packages: Array<{ name: string, version: string }> }, extra: { errorParams: { context: string } }, tags: { context: string, url: string, safe_method: string, http_status: number }, contexts: { trace: { trace_id: string, span_id: string }, react: { version: string }, AxiosError: { isAxiosError: boolean, code: string, config: { transitional: { silentJSONParsing: boolean, forcedJSONParsing: boolean, clarifyTimeoutError: boolean, legacyInterceptorReqResOrdering: boolean, advertiseZstdAcceptEncoding: boolean, validateStatusUndefinedResolves: boolean }, adapter: string, transformRequest: Array<string>, transformResponse: Array<string>, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: { FormData: string, Blob: string }, validateStatus: string, headers: string, fetchOptions: { redirect: string }, responseType: string, method: string, url: string, data: string, allowAbsoluteUrls: boolean }, request: {  }, response: { data: string, headers: string, status: number, statusText: string, config: { transitional: string, adapter: string, transformRequest: string, transformResponse: string, timeout: number, xsrfCookieName: string, xsrfHeaderName: string, maxContentLength: number, maxBodyLength: number, env: string, validateStatus: string, headers: string, fetchOptions: string, responseType: string, method: string, url: string, data: string, allowAbsoluteUrls: boolean }, request: {  } }, status: number, message: string, name: string, stack: string } }, breadcrumbs: Array<{ timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string, level: string } | { timestamp: number, category: string, data: { method: string, url: string }, level: string, type: string } | { timestamp: number, category: string, data: { method: string, url: string, status_code: number }, type: string }>, debug_meta: { images: Array<{ type: string, code_file: string, debug_id: string }> }, fingerprint: Array<string> }>
```

Response:

```text
{ detail: string }
OR
{ id: string }
```

Record references: E2E-network-log-trust-wallet.har:35, E2E-network-log-trust-wallet.har:588, E2E-network-log-trust-wallet.har:785, E2E-network-log-trust-wallet.har:786, E2E-network-log-trust-wallet.har:787, E2E-network-log-trust-wallet.har:805, E2E-network-log-trust-wallet.har:806, E2E-network-log-trust-wallet.har:817, E2E-network-log-trust-wallet.har:818, network-log.har:2355.

## 158. POST ogads-pa.clients6.google.com/$rpc/{opaqueValue}/GetAsyncData

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json+protobuf.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent, x-browser-channel, x-browser-copyright, x-browser-validation, x-browser-year, x-client-data, x-goog-api-key, x-goog-authuser, x-user-agent.

Request:

```text
Array<number | string | null | Array<Array<number> | number> | Array<number> | { 1001: number }>
```

Response:

```text
Array<null | number | Array<Array<number> | number>>
```

Record references: Trust_wallet.har:3.

## 159. GET ogs.google.com/u/{number}/widget/app

Query keys: awwd, cn, dpi, em, eom, gpa, hl, origin, pid, scv, spid, xstg. Status counts: `{"200":1}`. MIME: text/html.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, upgrade-insecure-requests, user-agent, x-browser-channel, x-browser-copyright, x-browser-validation, x-browser-year, x-client-data.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:7.

## 160. POST ontology.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ desc: string, error: number, id: number, jsonrpc: string, result: { ont: string, ong: string, height: string } }
```

Record references: add-cutom-network.har:103, add-cutom-network.har:200.

## 161. POST opbnb.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:250.

## 162. POST optimism.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:215.

## 163. GET osmosis-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":6}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:73, E2E-network-log-trust-wallet.har:410, E2E-network-log-trust-wallet.har:561, E2E-network-log-trust-wallet.har:871, E2E-network-log-trust-wallet.har:1079, add-cutom-network.har:233.

## 164. GET osmosis-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":6}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: E2E-network-log-trust-wallet.har:72, E2E-network-log-trust-wallet.har:409, E2E-network-log-trust-wallet.har:560, E2E-network-log-trust-wallet.har:870, E2E-network-log-trust-wallet.har:1078, add-cutom-network.har:232.

## 165. GET osmosis-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":6}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:71, E2E-network-log-trust-wallet.har:408, E2E-network-log-trust-wallet.har:559, E2E-network-log-trust-wallet.har:869, E2E-network-log-trust-wallet.har:1077, add-cutom-network.har:231.

## 166. GET osmosis-lcd.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":6}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:70, E2E-network-log-trust-wallet.har:407, E2E-network-log-trust-wallet.har:558, E2E-network-log-trust-wallet.har:868, E2E-network-log-trust-wallet.har:1076, add-cutom-network.har:230.

## 167. POST plasma.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:273.

## 168. GET platform.trustwallet.com/v1/defi/network-stats

Query keys: vaults. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-type, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ data: Array<{ vault_id: string, asset: string, asset_symbol: string, asset_icon: string, asset_decimals: number, asset_price_usd: number, share_symbol: string, tvl: string, protocol_tvl: string, protocol_supply_limit: string, protocol_icon: string, protocol: string, protocol_display_name: string, grr: number, nrr: number, vault: string, chain: string, chain_id: number, updated_at_block: number, performance_fee: number, additional_rewards: Array<UNKNOWN item; empty in capture> }> }
```

Record references: E2E-network-log-trust-wallet.har:188, E2E-network-log-trust-wallet.har:949.

## 169. GET platform.trustwallet.com/v1/defi/stakes

Query keys: vaults, wallets. Status counts: `{"200":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-type, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent, x-origin, x-platform, x-tw-credential, x-tw-date, x-tw-nonce.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ data: Array<UNKNOWN item; empty in capture> }
```

Record references: E2E-network-log-trust-wallet.har:189, E2E-network-log-trust-wallet.har:213, E2E-network-log-trust-wallet.har:295, E2E-network-log-trust-wallet.har:951.

## 170. POST play.google.com/log

Query keys: authuser, format, hasfast. Status counts: `{"200":1}`. MIME: text/plain.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-encoding, content-length, content-type, origin, priority, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent, x-browser-channel, x-browser-copyright, x-browser-validation, x-browser-year, x-client-data, x-goog-authuser.

Request:

```text
Array<Array<number | null | Array<null | Array<Array<Array<string>> | number | string> | Array<number>>> | number | Array<Array<number | null | string | Array<null | string>>> | null | Array<Array<null | Array<null | number>> | number>>
```

Response:

```text
Array<string | null | Array<Array<Array<string | number>> | number> | Array<UNKNOWN item; empty in capture> | { 175237375: Array<number> }>
```

Record references: Trust_wallet.har:6.

## 171. GET polkadot.twnodes.com/naas/session/{sessionToken}/accounts/{opaqueValue}/balance-info

Query keys: none recorded. Status counts: `{"200":7}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, if-none-match, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ at: { hash: string, height: string }, nonce: string, tokenSymbol: string, free: string, reserved: string, miscFrozen: string, feeFrozen: string, frozen: string, transferable: string, locks: Array<UNKNOWN item; empty in capture> }
```

Record references: E2E-network-log-trust-wallet.har:46, E2E-network-log-trust-wallet.har:384, E2E-network-log-trust-wallet.har:533, E2E-network-log-trust-wallet.har:700, E2E-network-log-trust-wallet.har:846, E2E-network-log-trust-wallet.har:1053, add-cutom-network.har:177.

## 172. POST polygon-zkevm.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: E2E-network-log-trust-wallet.har:65, E2E-network-log-trust-wallet.har:401, E2E-network-log-trust-wallet.har:553, E2E-network-log-trust-wallet.har:717, E2E-network-log-trust-wallet.har:863, E2E-network-log-trust-wallet.har:1070, add-cutom-network.har:216, lock-unlock-biometric.har:82, network-log.har:71, network-log.har:191, network-log.har:311, network-log.har:432, network-log.har:552, network-log.har:672, network-log.har:792, network-log.har:914, network-log.har:1037, network-log.har:1160, network-log.har:1283, network-log.har:1424, network-log.har:1545, network-log.har:1668, network-log.har:1790, network-log.har:1914, network-log.har:2034, network-log.har:2154, network-log.har:2275, network-log.har:2399, network-log.har:2519, network-log.har:2646, network-log.har:2767, network-log.har:2888, network-log.har:3012, network-log.har:3131, network-log.har:3250, network-log.har:3402.

## 173. POST polygon.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":1,"200":1}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:282, network-log.har:1348.

## 174. GET qtum-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:61, E2E-network-log-trust-wallet.har:397, E2E-network-log-trust-wallet.har:549, E2E-network-log-trust-wallet.har:713, E2E-network-log-trust-wallet.har:859, E2E-network-log-trust-wallet.har:1066, add-cutom-network.har:207, lock-unlock-biometric.har:80, network-log.har:68, network-log.har:188, network-log.har:308, network-log.har:429, network-log.har:549, network-log.har:669, network-log.har:789, network-log.har:912, network-log.har:1033, network-log.har:1157, network-log.har:1280, network-log.har:1422, network-log.har:1541, network-log.har:1665, network-log.har:1787, network-log.har:1911, network-log.har:2031, network-log.har:2152, network-log.har:2272, network-log.har:2396, network-log.har:2516, network-log.har:2643, network-log.har:2764, network-log.har:2885, network-log.har:3009, network-log.har:3129, network-log.har:3247, network-log.har:3399.

## 175. POST query.thegraph.kiln.fi/subgraphs/name/vsuite

Query keys: none recorded. Status counts: `{"0":2,"200":15}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, user-agent.

Request:

```text
{ operationName: string, variables: { contractAddress: string }, query: string }
OR
{ operationName: string, variables: { contractAddress: string, userAddress: string }, query: string }
OR
{ operationName: string, variables: { ownerAddress: string }, query: string }
```

Response:

```text
{ data: { erc20: { address: string, summaries: { allTime: { period: string, entryCount: string, totalGrossRewards: string, totalNetRewards: string, grossRewardRate: string, netRewardRate: string }, sixMonths: { period: string, entryCount: string, totalGrossRewards: string, totalNetRewards: string, grossRewardRate: string, netRewardRate: string }, threeMonths: { period: string, entryCount: string, totalGrossRewards: string, totalNetRewards: string, grossRewardRate: string, netRewardRate: string }, oneMonth: { period: string, entryCount: string, totalGrossRewards: string, totalNetRewards: string, grossRewardRate: string, netRewardRate: string }, oneWeek: { period: string, entryCount: string, totalGrossRewards: string, totalNetRewards: string, grossRewardRate: string, netRewardRate: string } } } } }
OR
{ data: { erc20: { totalSupply: string, totalUnderlyingSupply: string, balances: Array<UNKNOWN item; empty in capture> } } }
OR
{ data: { tickets: Array<UNKNOWN item; empty in capture> } }
```

Record references: E2E-network-log-trust-wallet.har:302, E2E-network-log-trust-wallet.har:303, E2E-network-log-trust-wallet.har:304, E2E-network-log-trust-wallet.har:305, E2E-network-log-trust-wallet.har:307, E2E-network-log-trust-wallet.har:308, E2E-network-log-trust-wallet.har:333, E2E-network-log-trust-wallet.har:334, E2E-network-log-trust-wallet.har:335, E2E-network-log-trust-wallet.har:337, E2E-network-log-trust-wallet.har:338, add-cutom-network.har:284, add-cutom-network.har:285, network-log.har:1351, network-log.har:1352, network-log.har:1686, network-log.har:1687.

## 176. GET ravencoin-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:48, E2E-network-log-trust-wallet.har:383, E2E-network-log-trust-wallet.har:535, E2E-network-log-trust-wallet.har:699, E2E-network-log-trust-wallet.har:845, E2E-network-log-trust-wallet.har:1052, add-cutom-network.har:162, lock-unlock-biometric.har:70, network-log.har:58, network-log.har:177, network-log.har:298, network-log.har:418, network-log.har:538, network-log.har:658, network-log.har:779, network-log.har:900, network-log.har:1023, network-log.har:1146, network-log.har:1269, network-log.har:1409, network-log.har:1531, network-log.har:1654, network-log.har:1777, network-log.har:1899, network-log.har:2021, network-log.har:2140, network-log.har:2262, network-log.har:2385, network-log.har:2506, network-log.har:2632, network-log.har:2754, network-log.har:2875, network-log.har:2999, network-log.har:3117, network-log.har:3237, network-log.har:3388.

## 177. POST ripple.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ method: string, params: Array<{ account: string, strict: boolean, ledger_index: string, queue: boolean }> }
OR
{ method: string, params: Array<{  }> }
```

Response:

```text
{ result: { account: string, error: string, error_code: number, error_message: string, ledger_current_index: number, request: { account: string, command: string, ledger_index: string, queue: boolean, strict: boolean }, status: string, validated: boolean } }
OR
{ result: { state: { build_version: string, complete_ledgers: string, fetch_pack: number, git: { branch: string, hash: string }, initial_sync_duration_us: string, io_latency_ms: number, jq_trans_overflow: string, last_close: { converge_time: number, proposers: number }, load: { job_types: Array<{ avg_time: number, job_type: string, peak_time: number, per_second: number } | { job_type: string, per_second: number } | { in_progress: number, job_type: string, peak_time: number, per_second: number } | { job_type: string, peak_time: number, per_second: number } | { avg_time: number, job_type: string, peak_time: number }>, threads: number }, load_base: number, load_factor: number, load_factor_fee_escalation: number, load_factor_fee_queue: number, load_factor_fee_reference: number, load_factor_server: number, node_size: string, peer_disconnects: string, peer_disconnects_resources: string, peers: number, ports: Array<{ port: string, protocol: Array<string> }>, pubkey_node: string, pubkey_validator: string, server_state: string, server_state_duration_us: string, state_accounting: { connected: { duration_us: string, transitions: string }, disconnected: { duration_us: string, transitions: string }, full: { duration_us: string, transitions: string }, syncing: { duration_us: string, transitions: string }, tracking: { duration_us: string, transitions: string } }, time: string, uptime: number, validated_ledger: { base_fee: number, close_time: number, hash: string, reserve_base: number, reserve_inc: number, seq: number }, validation_quorum: number, validator_list_expires: number }, status: string } }
```

Record references: add-cutom-network.har:158, add-cutom-network.har:159.

## 178. POST robinhood.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:278.

## 179. POST ronin.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":4}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: E2E-network-log-trust-wallet.har:406, E2E-network-log-trust-wallet.har:722, E2E-network-log-trust-wallet.har:1075, add-cutom-network.har:229.

## 180. POST scroll.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:219.

## 181. GET sei-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:151.

## 182. GET sei-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:150.

## 183. GET sei-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:149.

## 184. GET sei-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:148.

## 185. POST solana.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":12}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, jsonrpc: string }
OR
{ id: number, method: string, params: Array<string>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<number>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<string | { encoding: string, commitment: string, filters: Array<{ memcmp: { offset: number, bytes: string } }> }>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<{ commitment: string }>, jsonrpc: string }
OR
{ id: number, method: string, params: Array<string | { encoding: string, commitment: string }>, jsonrpc: string }
```

Response:

```text
{ id: number, result: { context: { apiVersion: string, slot: number }, value: number }, jsonrpc: string }
OR
{ id: number, result: { epoch: number, foundation: number, total: number, validator: number }, jsonrpc: string }
OR
{ id: number, result: number, jsonrpc: string }
OR
{ id: number, result: Array<UNKNOWN item; empty in capture>, jsonrpc: string }
OR
{ id: number, result: { current: Array<{ activatedStake: number, commission: number, epochCredits: Array<Array<number>>, epochVoteAccount: boolean, inflationRewardsCommissionBps: number, lastVote: number, nodePubkey: string, rootSlot: number, votePubkey: string } | { activatedStake: number, commission: number, epochCredits: Array<Array<number>>, epochVoteAccount: boolean, inflationRewardsCommissionBps: number, lastVote: number, nodePubkey: string, rootSlot: number, votePubkey: string }>, delinquent: Array<{ activatedStake: number, commission: number, epochCredits: Array<Array<number>>, epochVoteAccount: boolean, inflationRewardsCommissionBps: number, lastVote: number, nodePubkey: string, rootSlot: number, votePubkey: string } | { activatedStake: number, commission: number, epochCredits: Array<UNKNOWN item; empty in capture>, epochVoteAccount: boolean, inflationRewardsCommissionBps: number, lastVote: number, nodePubkey: string, rootSlot: number, votePubkey: string }> }, jsonrpc: string }
OR
{ id: number, result: { absoluteSlot: number, blockHeight: number, epoch: number, slotIndex: number, slotsInEpoch: number, transactionCount: number }, jsonrpc: string }
OR
{ jsonrpc: string, id: number, result: Array<{ pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { keybaseUsername: string, name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, iconUrl: string, keybaseUsername: string, name: string, website: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, iconUrl: string, name: string, website: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, keybaseUsername: string, name: string, website: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { keybaseUsername: string, name: string, website: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, iconUrl: string, name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, name: string, website: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { iconUrl: string, name: string, website: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { name: string, website: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: Array<string>, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { iconUrl: string, name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, keybaseUsername: string, name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { iconUrl: string, keybaseUsername: string, name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } } | { pubkey: string, account: { lamports: number, data: { program: string, parsed: { info: { configData: { details: string, iconUrl: string, keybaseUsername: string, name: string }, keys: Array<{ pubkey: string, signer: boolean }> }, type: string }, space: number }, owner: string, executable: boolean, rentEpoch: number, space: number } }> }
```

Record references: E2E-network-log-trust-wallet.har:344, E2E-network-log-trust-wallet.har:345, E2E-network-log-trust-wallet.har:346, E2E-network-log-trust-wallet.har:347, E2E-network-log-trust-wallet.har:348, E2E-network-log-trust-wallet.har:349, E2E-network-log-trust-wallet.har:350, E2E-network-log-trust-wallet.har:353, E2E-network-log-trust-wallet.har:354, E2E-network-log-trust-wallet.har:355, add-cutom-network.har:189, add-cutom-network.har:194.

## 186. POST sonic.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:272.

## 187. GET ssl.gstatic.com/gb/images/sprites/p_2x_1b5e24e4e18f.png

Query keys: none recorded. Status counts: `{"200":1}`. MIME: image/png.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:12.

## 188. GET stargaze-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"0":2,"404":34}`. MIME: text/html, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:39, E2E-network-log-trust-wallet.har:376, E2E-network-log-trust-wallet.har:527, E2E-network-log-trust-wallet.har:693, E2E-network-log-trust-wallet.har:839, E2E-network-log-trust-wallet.har:1045, add-cutom-network.har:134, lock-unlock-biometric.har:62, network-log.har:53, network-log.har:172, network-log.har:293, network-log.har:413, network-log.har:533, network-log.har:653, network-log.har:774, network-log.har:895, network-log.har:1018, network-log.har:1141, network-log.har:1264, network-log.har:1404, network-log.har:1526, network-log.har:1649, network-log.har:1772, network-log.har:1894, network-log.har:2016, network-log.har:2134, network-log.har:2257, network-log.har:2379, network-log.har:2501, network-log.har:2627, network-log.har:2749, network-log.har:2869, network-log.har:2994, network-log.har:3112, network-log.har:3232, network-log.har:3383.

## 189. GET stargaze-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"0":1,"404":35}`. MIME: text/html, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:38, E2E-network-log-trust-wallet.har:375, E2E-network-log-trust-wallet.har:526, E2E-network-log-trust-wallet.har:692, E2E-network-log-trust-wallet.har:838, E2E-network-log-trust-wallet.har:1044, add-cutom-network.har:133, lock-unlock-biometric.har:61, network-log.har:52, network-log.har:171, network-log.har:292, network-log.har:412, network-log.har:532, network-log.har:652, network-log.har:773, network-log.har:894, network-log.har:1017, network-log.har:1140, network-log.har:1263, network-log.har:1403, network-log.har:1525, network-log.har:1648, network-log.har:1771, network-log.har:1893, network-log.har:2015, network-log.har:2133, network-log.har:2256, network-log.har:2378, network-log.har:2500, network-log.har:2626, network-log.har:2748, network-log.har:2868, network-log.har:2993, network-log.har:3111, network-log.har:3231, network-log.har:3382.

## 190. GET stargaze-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"0":2,"404":34}`. MIME: text/html, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:37, E2E-network-log-trust-wallet.har:374, E2E-network-log-trust-wallet.har:525, E2E-network-log-trust-wallet.har:691, E2E-network-log-trust-wallet.har:837, E2E-network-log-trust-wallet.har:1043, add-cutom-network.har:132, lock-unlock-biometric.har:60, network-log.har:51, network-log.har:170, network-log.har:291, network-log.har:411, network-log.har:531, network-log.har:651, network-log.har:772, network-log.har:893, network-log.har:1016, network-log.har:1139, network-log.har:1262, network-log.har:1402, network-log.har:1524, network-log.har:1647, network-log.har:1770, network-log.har:1892, network-log.har:2014, network-log.har:2132, network-log.har:2255, network-log.har:2377, network-log.har:2499, network-log.har:2625, network-log.har:2747, network-log.har:2867, network-log.har:2992, network-log.har:3110, network-log.har:3230, network-log.har:3381.

## 191. GET stargaze-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"404":36}`. MIME: text/html, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: E2E-network-log-trust-wallet.har:36, E2E-network-log-trust-wallet.har:373, E2E-network-log-trust-wallet.har:524, E2E-network-log-trust-wallet.har:690, E2E-network-log-trust-wallet.har:836, E2E-network-log-trust-wallet.har:1042, add-cutom-network.har:131, lock-unlock-biometric.har:59, network-log.har:50, network-log.har:169, network-log.har:290, network-log.har:410, network-log.har:530, network-log.har:650, network-log.har:771, network-log.har:892, network-log.har:1015, network-log.har:1138, network-log.har:1261, network-log.har:1401, network-log.har:1523, network-log.har:1646, network-log.har:1769, network-log.har:1891, network-log.har:2013, network-log.har:2131, network-log.har:2254, network-log.har:2376, network-log.har:2498, network-log.har:2624, network-log.har:2746, network-log.har:2866, network-log.har:2991, network-log.har:3109, network-log.har:3229, network-log.har:3380.

## 192. GET stellar.twnodes.com/naas/session/{sessionToken}/accounts/{opaqueValue}

Query keys: none recorded. Status counts: `{"404":1}`. MIME: application/problem+json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ type: string, title: string, status: number, detail: string }
```

Record references: add-cutom-network.har:161.

## 193. GET stride-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:142.

## 194. GET stride-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:141.

## 195. GET stride-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:140.

## 196. GET stride-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:139.

## 197. POST sui.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ method: string, params: Array<string>, id: number, jsonrpc: string }
```

Response:

```text
{ id: number, jsonrpc: string, result: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:125, add-cutom-network.har:126.

## 198. GET terra-classic-fcd.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:176.

## 199. GET terra-classic-fcd.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:175.

## 200. GET terra-classic-fcd.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:174.

## 201. GET terra-classic-fcd.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:173.

## 202. GET tezos.twnodes.com/naas/session/{sessionToken}/chains/main/blocks/head/context/contracts/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balance: string, counter: string, revealed: boolean }
```

Record references: add-cutom-network.har:201.

## 203. POST theta.twnodes.com/naas/session/{sessionToken}/rpc

Query keys: none recorded. Status counts: `{"200":14}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<{ address: string }>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, error: { code: number, message: string } }
```

Record references: E2E-network-log-trust-wallet.har:27, E2E-network-log-trust-wallet.har:53, E2E-network-log-trust-wallet.har:366, E2E-network-log-trust-wallet.har:388, E2E-network-log-trust-wallet.har:515, E2E-network-log-trust-wallet.har:539, E2E-network-log-trust-wallet.har:681, E2E-network-log-trust-wallet.har:704, E2E-network-log-trust-wallet.har:826, E2E-network-log-trust-wallet.har:850, E2E-network-log-trust-wallet.har:1035, E2E-network-log-trust-wallet.har:1058, add-cutom-network.har:102, add-cutom-network.har:188.

## 204. GET thorchain.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":7}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: E2E-network-log-trust-wallet.har:64, E2E-network-log-trust-wallet.har:400, E2E-network-log-trust-wallet.har:552, E2E-network-log-trust-wallet.har:716, E2E-network-log-trust-wallet.har:862, E2E-network-log-trust-wallet.har:1069, add-cutom-network.har:214.

## 205. POST thundertoken.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"400":35,"503":6}`. MIME: application/json, text/plain.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ id: number, jsonrpc: string, error: { message: string, code: number } }
```

Record references: E2E-network-log-trust-wallet.har:55, E2E-network-log-trust-wallet.har:390, E2E-network-log-trust-wallet.har:541, E2E-network-log-trust-wallet.har:548, E2E-network-log-trust-wallet.har:706, E2E-network-log-trust-wallet.har:852, E2E-network-log-trust-wallet.har:1060, add-cutom-network.har:197, add-cutom-network.har:199, lock-unlock-biometric.har:74, network-log.har:62, network-log.har:182, network-log.har:302, network-log.har:423, network-log.har:543, network-log.har:663, network-log.har:783, network-log.har:905, network-log.har:1027, network-log.har:1034, network-log.har:1151, network-log.har:1274, network-log.har:1414, network-log.har:1535, network-log.har:1542, network-log.har:1659, network-log.har:1781, network-log.har:1904, network-log.har:1910, network-log.har:2025, network-log.har:2145, network-log.har:2266, network-log.har:2390, network-log.har:2510, network-log.har:2637, network-log.har:2758, network-log.har:2879, network-log.har:3003, network-log.har:3121, network-log.har:3241, network-log.har:3393.

## 206. POST tomochain.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:196.

## 207. GET ton.twnodes.com/naas/session/{sessionToken}/getAddressBalance

Query keys: address. Status counts: `{"200":2}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ ok: boolean, result: string }
```

Record references: add-cutom-network.har:264, network-log.har:1802.

## 208. POST tron.twnodes.com/naas/session/{sessionToken}/wallet/getReward

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ address: string }
```

Response:

```text
{ reward: number }
```

Record references: add-cutom-network.har:169.

## 209. POST tron.twnodes.com/naas/session/{sessionToken}/wallet/getaccount

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ address: string }
```

Response:

```text
{  }
```

Record references: add-cutom-network.har:164.

## 210. POST tron.twnodes.com/naas/session/{sessionToken}/wallet/getaccountresource

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ address: string }
```

Response:

```text
{  }
```

Record references: add-cutom-network.har:165.

## 211. GET vechain.twnodes.com/naas/session/{sessionToken}/accounts/{hexValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balance: string, energy: string, hasCode: boolean }
```

Record references: add-cutom-network.har:192.

## 212. POST vechain.twnodes.com/naas/session/{sessionToken}/accounts/{hexValue}

Query keys: revision. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ data: string }
```

Response:

```text
{ data: string, events: Array<UNKNOWN item; empty in capture>, transfers: Array<UNKNOWN item; empty in capture>, gasUsed: number, reverted: boolean, vmError: string }
```

Record references: add-cutom-network.har:104.

## 213. GET viacoin-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"429":72}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ error: string }
```

Record references: E2E-network-log-trust-wallet.har:32, E2E-network-log-trust-wallet.har:40, E2E-network-log-trust-wallet.har:370, E2E-network-log-trust-wallet.har:377, E2E-network-log-trust-wallet.har:519, E2E-network-log-trust-wallet.har:523, E2E-network-log-trust-wallet.har:685, E2E-network-log-trust-wallet.har:689, E2E-network-log-trust-wallet.har:830, E2E-network-log-trust-wallet.har:832, E2E-network-log-trust-wallet.har:1039, E2E-network-log-trust-wallet.har:1046, add-cutom-network.har:112, add-cutom-network.har:118, lock-unlock-biometric.har:54, lock-unlock-biometric.har:55, network-log.har:44, network-log.har:47, network-log.har:164, network-log.har:165, network-log.har:285, network-log.har:286, network-log.har:405, network-log.har:406, network-log.har:525, network-log.har:526, network-log.har:645, network-log.har:646, network-log.har:766, network-log.har:768, network-log.har:886, network-log.har:888, network-log.har:1010, network-log.har:1014, network-log.har:1133, network-log.har:1134, network-log.har:1256, network-log.har:1257, network-log.har:1396, network-log.har:1397, network-log.har:1518, network-log.har:1519, network-log.har:1641, network-log.har:1642, network-log.har:1763, network-log.har:1764, network-log.har:1886, network-log.har:1887, network-log.har:2008, network-log.har:2009, network-log.har:2127, network-log.har:2135, network-log.har:2249, network-log.har:2252, network-log.har:2371, network-log.har:2373, network-log.har:2493, network-log.har:2494, network-log.har:2619, network-log.har:2622, network-log.har:2741, network-log.har:2742, network-log.har:2861, network-log.har:2862, network-log.har:2986, network-log.har:2987, network-log.har:3103, network-log.har:3106, network-log.har:3224, network-log.har:3225, network-log.har:3375, network-log.har:3376.

## 214. GET wallet-kit.trustwallet.com/v1/apr/proxy/stakewiz

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
Array<{ vote_identity: string, apy_estimate: number, staking_apy: number, jito_apy: number, total_apy: number } | { vote_identity: string, apy_estimate: number, staking_apy: number, total_apy: number }>
```

Record references: E2E-network-log-trust-wallet.har:351.

## 215. POST wanchain.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:210.

## 216. GET waves.twnodes.com/naas/session/{sessionToken}/addresses/balance/{opaqueValue}/{number}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, confirmations: number, balance: number }
```

Record references: add-cutom-network.har:213.

## 217. GET waves.twnodes.com/naas/session/{sessionToken}/assets/balance/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balances: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:212.

## 218. GET www.gstatic.com/_/mss/boq-one-google/_/js/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/excm=_b,_tp,appwidgetauthview/ed=1/dg=0/wt=2/ujg=1/{opaqueValue}/dti=1/m=_b,_tp

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/javascript.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:8.

## 219. GET www.gstatic.com/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/exm=_b,_tp/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/javascript.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:13.

## 220. GET www.gstatic.com/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=IiCRgf

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/javascript.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:18.

## 221. GET www.gstatic.com/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=P6sQOc

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/javascript.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:17.

## 222. GET www.gstatic.com/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=p3hmRc,LvGhrf,RqjULd

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/javascript.

Request header names: referer, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:14.

## 223. GET www.gstatic.com/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=sOXFj,q0xTif,YOiC1e

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/javascript.

Request header names: referer, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:15.

## 224. GET www.gstatic.com/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":2}`. MIME: text/javascript.

Request header names: referer, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:16, Trust_wallet.har:19.

## 225. GET www.gstatic.com/images/branding/googlelogo/svg/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: image/svg+xml.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:4.

## 226. GET www.gstatic.com/og/_/js/{opaqueValue}/rt=j/m=q_dnp,qmd,qcwid,qapid,qald,qads/{opaqueValue}/d=1/ed=1/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/javascript.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:1.

## 227. GET www.gstatic.com/og/_/ss/{opaqueValue}/{opaqueValue}/{opaqueValue}/d=1/ed=1/ct=zgms/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: text/css.

Request header names: referer.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
UNKNOWN / no parseable JSON body retained
```

Record references: Trust_wallet.har:2.

## 228. GET zcash-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:42, E2E-network-log-trust-wallet.har:379, E2E-network-log-trust-wallet.har:529, E2E-network-log-trust-wallet.har:695, E2E-network-log-trust-wallet.har:841, E2E-network-log-trust-wallet.har:1048, add-cutom-network.har:156, lock-unlock-biometric.har:63, network-log.har:54, network-log.har:173, network-log.har:294, network-log.har:414, network-log.har:534, network-log.har:654, network-log.har:775, network-log.har:896, network-log.har:1019, network-log.har:1142, network-log.har:1265, network-log.har:1405, network-log.har:1527, network-log.har:1650, network-log.har:1773, network-log.har:1895, network-log.har:2017, network-log.har:2136, network-log.har:2258, network-log.har:2380, network-log.har:2502, network-log.har:2628, network-log.har:2750, network-log.har:2870, network-log.har:2995, network-log.har:3113, network-log.har:3233, network-log.har:3384.

## 229. GET zelcash-blockbook.twnodes.com/naas/session/{sessionToken}/api/v2/address/{opaqueValue}

Query keys: details. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ address: string, balance: string, totalReceived: string, totalSent: string, unconfirmedTxs: number, txs: number }
```

Record references: E2E-network-log-trust-wallet.har:63, E2E-network-log-trust-wallet.har:399, E2E-network-log-trust-wallet.har:551, E2E-network-log-trust-wallet.har:715, E2E-network-log-trust-wallet.har:861, E2E-network-log-trust-wallet.har:1068, add-cutom-network.har:211, lock-unlock-biometric.har:81, network-log.har:70, network-log.har:190, network-log.har:310, network-log.har:431, network-log.har:551, network-log.har:671, network-log.har:791, network-log.har:913, network-log.har:1036, network-log.har:1159, network-log.har:1282, network-log.har:1423, network-log.har:1544, network-log.har:1667, network-log.har:1789, network-log.har:1913, network-log.har:2033, network-log.har:2153, network-log.har:2274, network-log.har:2398, network-log.har:2518, network-log.har:2645, network-log.har:2766, network-log.har:2887, network-log.har:3011, network-log.har:3130, network-log.har:3249, network-log.har:3401.

## 230. GET zetachain-api.twnodes.com/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ balances: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:262.

## 231. GET zetachain-api.twnodes.com/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ rewards: Array<UNKNOWN item; empty in capture>, total: Array<UNKNOWN item; empty in capture> }
```

Record references: add-cutom-network.har:261.

## 232. GET zetachain-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ delegation_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:260.

## 233. GET zetachain-api.twnodes.com/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
UNKNOWN / no parseable JSON body retained
```

Response:

```text
{ unbonding_responses: Array<UNKNOWN item; empty in capture>, pagination: { next_key: null, total: string } }
```

Record references: add-cutom-network.har:259.

## 234. POST zetachain-evm.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":36}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: E2E-network-log-trust-wallet.har:81, E2E-network-log-trust-wallet.har:418, E2E-network-log-trust-wallet.har:569, E2E-network-log-trust-wallet.har:730, E2E-network-log-trust-wallet.har:879, E2E-network-log-trust-wallet.har:1087, add-cutom-network.har:263, lock-unlock-biometric.har:93, network-log.har:82, network-log.har:202, network-log.har:322, network-log.har:443, network-log.har:563, network-log.har:683, network-log.har:803, network-log.har:925, network-log.har:1049, network-log.har:1171, network-log.har:1294, network-log.har:1435, network-log.har:1556, network-log.har:1680, network-log.har:1801, network-log.har:1925, network-log.har:2045, network-log.har:2165, network-log.har:2286, network-log.har:2410, network-log.har:2530, network-log.har:2658, network-log.har:2778, network-log.har:2899, network-log.har:3023, network-log.har:3142, network-log.har:3262, network-log.har:3413.

## 235. POST zilliqa-api.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, error: { code: number, message: string } }
```

Record references: add-cutom-network.har:172.

## 236. POST zklink-nova-evm.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"0":1,"200":35}`. MIME: application/json, x-unknown.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-fetch-storage-access, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, result: string, id: number }
```

Record references: E2E-network-log-trust-wallet.har:84, E2E-network-log-trust-wallet.har:421, E2E-network-log-trust-wallet.har:572, E2E-network-log-trust-wallet.har:733, E2E-network-log-trust-wallet.har:889, E2E-network-log-trust-wallet.har:1090, add-cutom-network.har:271, lock-unlock-biometric.har:96, network-log.har:85, network-log.har:206, network-log.har:325, network-log.har:446, network-log.har:566, network-log.har:686, network-log.har:806, network-log.har:928, network-log.har:1052, network-log.har:1174, network-log.har:1297, network-log.har:1438, network-log.har:1559, network-log.har:1683, network-log.har:1805, network-log.har:1929, network-log.har:2048, network-log.har:2168, network-log.har:2289, network-log.har:2413, network-log.har:2533, network-log.har:2661, network-log.har:2781, network-log.har:2903, network-log.har:3026, network-log.har:3145, network-log.har:3265, network-log.har:3416.

## 237. POST zksync.twnodes.com/naas/session/{sessionToken}

Query keys: none recorded. Status counts: `{"200":1}`. MIME: application/json.

Request header names: :authority, :method, :path, :scheme, accept, accept-encoding, accept-language, content-length, content-type, origin, priority, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, traceparent, user-agent.

Request:

```text
{ id: number, method: string, params: Array<string>, jsonrpc: string }
```

Response:

```text
{ jsonrpc: string, id: number, result: string }
```

Record references: add-cutom-network.har:218.

