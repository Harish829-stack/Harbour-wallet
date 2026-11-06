# 41 — Trust Wallet Activity / transaction history (extension 26.41.0)
Method: REA toolchain on `evidences/extension/reference-26.41.0` (REA `recover_javascript_sources` unavailable: Wakaru not installed on this Mac; chunks read directly, bundles are un-obfuscated enough). Confidence tags: [certain] = read in code, [inferred] = deduced.

## Data source (backend, private) [certain]
- `GET  {gateway}/v1/txhub/txs?asset&chain&address&from&to&limit&next_token`  (per asset+chain history)
- `POST {gateway}/v1/txhub/bulk_history {addresses, from, to, next_token}`     (all chains at once)  — response `data[]`, `meta.next_token`, `meta.unsupported_chains`
- `GET  {gateway}/v1/txhub/txs/{hash}?chain=&tx_type=` (single tx)
- Real-time: `POST /v1/centrifugo-hooks/token` (Centrifugo websocket) + push topics. Source: background.js `TransactionHistoryService` (~offset 41.3M), network chunk `getTransactionHistory / getMultipleAssetTransactionHistory`.
- Classification is SERVER-SIDE: each tx has `events[]` typed `transfer | utxo_transfer | contract_call | swap | stake_delegate | stake_undelegate | stake_redelegate | stake_claim_rewards | stake_compound | token_approval | token_revoke`; `status` completed|error → confirmed|failed; `fees[]`, `created_at`.

## Client pipeline [certain]
1. `fetchBulkTransactionHistory` → `mapBulkTransactions`: resolve asset(s) from events (`getAssetFromEvents`, fetches unknown assets from the asset service and AUTO-ENABLES them: `dispatchPendingAutoEnable`), map each event (`mapTransactionEvent`), build record `{hash, assetId, blockchain{id,isCustom}, status, createdAt, fee[], feeAsset, symbol, events[]}`.
2. `walkBulkTransactionHistory`: walks BACKWARD in 29-day windows (`getDateDaysAgo(to,29)`) down to a `floor` date; first batch = 1 window, then 3 windows in parallel (`HISTORY_WALK_BATCH_SIZE=3`); stops at the first window with rows; returns `{from,to,nextToken,exhausted,unsupportedChains}`; any failed window aborts the walk (no silent gaps).
3. Persisted locally (SQLite/redux) and read by the UI hook `useTransactionsByDate(blockchain?, asset?)`.
## UI rules (`useTransactionsByDate`, `useFormattedTransaction`, `TransactionRecordRow`) [certain]
- ONE feed for all chains; optional filter by (blockchain, assetId) used by the token page. Grouped by day label ("Oct 22, 2026"), newest first.
- Row type label = `component.transaction-item.type.<type>`: trade approve revoke contract receive send swap delegate undelegate claim-rewards claim compound redelegate cross-chain-redelegate utxo inscribe register-token trust-line burn. Swap with cross-chain flag renders "Bridge".
- Status chip only when NOT confirmed (pending=warning, failed=error).
- Send/Receive is derived client-side: sign of amount vs the account address; Approve shows "Unlimited" when `isUnlimited`; Revoke amount 0; fee shown for non-transfer types.
- Feed filters: in the all-assets view an event is dropped if its asset is not enabled (`isShownInHomeScreen`) and has zero balance (airdrop / spam suppression, `isAirdropCandidate` = incoming ERC-20 from someone else); bridge destination txs de-duplicated into the source swap; local provisional swap rows (`swap-pending:<id>`, TTL 15 min = 9e5 ms; `swap-failed:`) are merged/settled against indexed rows.
## Not recoverable client-side [UNKNOWN]
txhub indexing/classification logic, chain coverage list, rate limits (all server side).

## Addendum (second pass, bundle unzipped and read in the cloud workspace; `background.js` offsets from 26.41.0_0.zip) [certain unless noted]
- **Local record at broadcast** — `GenericBroadcasterService.recordTransaction` (~40.26M): immediately after a successful broadcast writes a `status:"pending"` tx into the local `txSlice` (per walletId+accountId) with `events:[{type,metadata}]`, then `emit(REFRESH_BALANCE)`. So the user's OWN sends / approvals / revokes / swaps / burns appear instantly, before any indexer sees them.
- **Approve vs revoke is decided locally**: `parseApproveTransaction(data)` → allowance == 0 ⇒ type `revoke`; otherwise `approve` with `isUnlimited = isTokenAmountUnlimited(allowance)` and value formatted with token decimals. Revoke also marks the approval `pending revoke` and triggers `POLL_APPROVALS`.
- **Indexer rows later replace local rows** (same hash; `initialHash` kept). Pending reconciliation lives in `NetworkService` + `pendingTransactionPolicy`: a pending tx not found on chain after a threshold is failed/dropped; UTXO chains use 24 h (`UTXO_PENDING_RECOVERY_MS = 864e5`), swaps use the 15-min provisional TTL.
- **Fetch strategy**: per-asset `FETCH_MISSING_TRANSACTIONS` splits the requested range into `API_MONTH_LIMIT`-month slices, follows `next_token` recursively, merges with `txSlice.updateTxs`, and records the covered range per asset (`updateCachedTransactionsPeriod`) so the same period is never refetched. All-chains view uses `FETCH_ASSETS_TRANSACTION_HISTORY_WALK` (bulk, 29-day windows) with addresses from `getAddressesForTxHub(blockchains)` = `[{chain, address}]` for the active account.
- **List UI** (`TransactionList`): date-grouped sections, "Load more" button (not infinite scroll) shown while `hasNextPage` or fetching, empty state "Your crypto transactions will appear here once you start using wallet." with Buy/Swap CTA.
- **Harbour implications**: (1) record own txs locally at broadcast; (2) classify approve/revoke from calldata, not from the explorer; (3) cache the fetched period per asset/chain; (4) never silently skip a failed window.

## Addendum 2 — Wakaru 1.14.0 recovery (cloud workspace; REA's own `recover_javascript_sources` could not run on the Mac: no Wakaru there)
Readable sources: `recovery/ui/*` (6 UI chunks) and `recovery/background/*` (TransactionHistoryService, FetchMissingTransactions, FetchAssetsTransactionHistoryWalk, GenericBroadcasterService; brace-matched slices of the 42 MB `background.js`). Names are still minified in the UI chunks; the background keeps real class/method names. Runtime equivalence not verified.

### txhub event schema (inferred from `mapTransactionEvent`, [certain] for fields read)
| event.type | event.data fields used | → client type |
|---|---|---|
| transfer / utxo_transfer / contract_call / stake_* | `asset, from, to, value, direction?, input?` | Send / Utxo / Contract / Delegate… ; a `transfer` whose `to` == own address and `from` != own becomes **Receive** |
| token_approval | `asset, owner, spender, amount, is_unlimited` | Approve (`isUnlimited`) |
| token_revoke | `asset, owner, spender` | Revoke |
| swap | `from, to, sent{asset,value}, received{asset,value}` (+`bridge`) | Swap; if only `received` asset is known → Receive; only `sent` → Send |
Transaction envelope: `{hash, chain, status: completed|error, created_at, fees[{asset,value}], events[]}`.
Airdrop flag: an incoming `transfer` of a token (`asset` contains `_t`) that is not enabled / zero balance, `to`==me, `from`!=me → `metadata.airdrop=true` (then hidden from the all-assets feed by the UI filter).
Unknown assets referenced by events are fetched from the asset service and **auto-enabled** (`pendingAutoEnable`), so a faucet-minted token becomes visible in the wallet after the history refresh.
### All-chains refresh (`fetchAllChainsMissingTransactions`) [certain]
Range [from,to] is cut into 29-day windows, each window follows `next_token` recursively, all merged with `txSlice.updateTxs`; the covered period is cached (`updateAllChainsCachedTransactionsPeriod`) ONLY when no window failed.
