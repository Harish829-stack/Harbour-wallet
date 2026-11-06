# Harbour Redesign: REA-Verified Backend, Database and Architecture

Oct 27, 2026 · @Harish

## Answer

A fresh REA pass over 1,476 recorded requests and the shipped bundle shows that Trust Wallet is mostly a **client-side application with a data backend**: its service worker holds an event router, 52 services, a 16-slice Redux store and a 40-table SQLite cache, while the servers only serve public data through four first-party services: a main API gateway, a node-discovery gateway, a WalletKit host for staking and fee data, and a fleet of about 100 per-chain node hosts that carry most balance traffic.

**What the old docs got wrong or missed:** the node fleet, not the gateway, does most chain reads; `coinstatus` asset-security endpoints (82 calls), node discovery and the WalletKit host were missing; the job queue key is `trust:queue:v2`; there are 218 events, not 204; `AssetAccount` has 18 balance columns, not 10.

**The redesign:** give Harbour the same shape MetaMask and Trust Wallet share. Split the background into one controller per domain behind typed messages; move cached data into a real local database (IndexedDB); upgrade the vault to a random data key wrapped by a stronger KDF; keep the UI a thin mirror; and add a backend that separates API services (Postgres, signed device auth, indexer, realtime) from node access. About 20 weeks in 8 shippable phases.

## Trust Wallet runtime as REA sees it

&#91;embedded content: Trust Wallet 26.41.0 runtime layers\]

The service worker is the application: an event router, 52 dependency-injected services, a Redux store and a local SQLite database. The popup is a thin React view that mirrors the worker's Redux state through an RPC store (`GET_REDUX_STATE`, `DISPATCH_REDUX_ACTION`) and caches fetched data with React Query. Counts come from the shipped `background.js` (SHA-256 `a6dc88b6...`) and the popup `App` chunk; host roles come from the REA capture analysis in the next section.

## Backend API surface verified by REA

REA's HAR adapter decoded 1,476 requests from 8 runtime captures of Trust Wallet 26.41.0 (onboarding, send, custom token, custom network, network switch, lock/unlock, base flow) and grouped them into endpoint templates. Trust Wallet talks to **four first-party services**, not one gateway: the main gateway, a node-discovery gateway, a WalletKit SDK host, and a fleet of about 100 per-chain node hosts that carry most balance and transaction traffic.

| Service and host | Endpoints seen at runtime | Calls | What it does |
| --- | --- | --- | --- |
| Main gateway `gateway.us.trustwallet.com` | `POST /v1/assets` | 129 | Token discovery and metadata, the busiest call |
|  | `GET /v2/announcements` | 63 | In-app notices per device |
|  | `GET /v1/coinstatus/{asset}`, `/v2/coinstatus/{asset}` (`include_security_info`, `include_solana_security_info`) | 82 | Per-asset status and security flags; **missing from the old docs** |
|  | `POST /v2/market/tickers`, `GET /v2/market/rates`, `/charts/{asset}`, `/info/{asset}`, `/sentiment-assets` | 69 | Prices and charts |
|  | `POST /v1/txhub/bulk_history`, `GET /v1/txhub/txs` | 45 | Transaction history with cursor |
|  | `POST /v1/balances/stream`, `GET /v1/balances/chains` | 33 | NDJSON balance stream and per-chain capability flags |
|  | `POST /v2/devices/fingerprint`, `GET /v2/devices/{id}`, `PUT /push-topics`, `POST /v3/devices/{id}/wallets/{w}/register`, `/address_association`, `GET .../meta` | 34 | Device identity, wallet registry, push topics |
|  | `GET /v1/cex-transfer/providers/{binance-pay,coinbase-pay}/...`, `/v1/buycrypto/widget/quote` | 133 | Exchange transfers and on-ramp |
|  | `POST /v1/validate/url`, `/v1/validate/address`, `/v1/approvals/scan` | 20 | Site and address risk, allowance scan |
|  | `GET /v1/search/assets`, `/v1/assets/listings`, `/tabs-config`, `/trending-config`, `/v1/assets/{id}` | 40 | Search, listings and server-driven tabs |
|  | `POST /v3/nft/collections`, `GET /v3/points/{addr}/vip`, `/v1/invests/*`, `/v1/discover/group/*`, `/amber-api/v1/domains` | 21 | NFTs, VIP points, earn config, swap domains |
|  | `POST /v1/centrifugo-hooks/token`, `wss /stream/ws` | 9 | Realtime socket |
| Node discovery `gateway.trustwallet.com` | `GET /v2/projects/{id}/nodes?account-abstraction&sponsored` | 5 | Hands out per-chain node session URLs, including gas-sponsored nodes; **new** |
| WalletKit SDK `wallet-kit.trustwallet.com` | `POST /v1/apr`, `GET /v1/fee/priority/{chainId}`, `/v1/apr/proxy/stakewiz` | 30 | Staking APR and fee tiers; **new** |
| Node fleet `*.twnodes.com/naas/session/{token}/...` | 61 JSON-RPC hosts (EVM plus Solana, Sui, Near, XRP and others), 18 Cosmos LCD hosts, 14 Blockbook (UTXO) hosts, about 15 chain-specific REST hosts | about 600 | Balances, staking, nonces, broadcast for every chain |
| CDN `assets-cdn.trustwallet.com` | `/blockchains/{chain}/tokenlist.json`, `/validators/list.json` | 11 | Static token and validator lists |
| Third parties called directly | `lb.routeme.sh/rpc/evm/{chainId}`, `query.thegraph.kiln.fi`, `api.bnbchain.org`, public testnet RPCs | 120 | Extra RPC, staking subgraph, BNB validators, testnets |

**Not seen in any capture, only in code:** `/v1/validate/transaction` and `/message`, transaction simulation on `api.trustwallet.com`, Amber swap sessions, homepage and discover feeds. Those flows were not exercised in the recordings, so their wire shapes stay code-level only.

**What this changes in the old docs:** balances are not mainly a gateway feature. The gateway stream covers part, and the client fetches the rest directly from the per-chain node fleet, so a Trust Wallet-class backend is really two products: an API gateway and a managed node service.

## Network logs: call sequence and polling load

An open Trust Wallet makes about 700 API requests an hour plus about 520 node calls, and most of it is polling, not user actions. The server sets the discovery interval itself (`meta.interval_ms` = 10,000 in all 129 responses), so it can slow every client down without a release.

&#91;embedded content: network-log.har · 3,467 requests over 2.8 hours, 16 Oct 2026\]

**First 11 seconds after a wallet is added** (onboarding capture), in three waves: at 0 to 1 s the wallet is registered (`/v3/devices/.../register`), push topics are set, and discovery, NFTs, tickers and the balance stream start in parallel; at about 4.5 s the device fingerprint, device profile, realtime token, WebSocket and node list arrive; from 6 to 11 s the client queries about 45 node hosts in parallel (Blockbook, Cosmos LCD, EVM, Polkadot, Cardano) for chains the stream does not cover. The long session shows the same device credential and the same node session token reused for 2.8 hours, even though both are re-fetched every 6 minutes.

## Network logs: auth, headers and infrastructure

The wire shows a lightweight device credential rather than real authentication, an Envoy service mesh behind Cloudflare, open-source Centrifugo for realtime, and (inferred) Go services that fan out to an internal node layer.

| Signal | What the captures show | What it means |
| --- | --- | --- |
| Gateway request headers | `X-TW-CREDENTIAL` (device id), `X-TW-NONCE`, `X-TW-DATE`, `X-Origin`, W3C `traceparent` on all 671 gateway calls; `X-Platform` on 20 | Every call is tied to a device and a distributed trace. The HMAC `Authorization` header itself is absent because Chrome strips it from HAR exports |
| Device credential | 27 fingerprint calls in the long session sent the same identifier and got back the **same** `device_id` and the **same** `hash_key` every time; the fingerprint call itself needs no auth | The HMAC secret is a stable function of a client-chosen identifier. It limits abuse; it does not prove who the caller is |
| Gateway response headers | `server: cloudflare`, `cf-ray`, HSTS, `nosniff`, and `x-envoy-upstream-service-time` on 671 of 674 | Cloudflare in front of an Envoy mesh. Server time is 7 to 20 ms for most calls; the 280 to 380 ms users see is mostly network distance to the US gateway |
| Caching | No `cache-control` on gateway responses except `no-cache` on the balance stream; CDN files use ETags (304s seen) | Caching lives in the client (SQLite, Redux), not HTTP |
| Swap service | `/amber-api/v1/domains` answers with `grpc-metadata-*` headers | The swap backend is a gRPC service exposed through an HTTP/JSON gateway |
| Node fleet requests | No auth headers; the credential is a session token in the URL path (`/naas/session/{token}`); one token served 1,463 calls over 2.8 hours | Bearer-in-URL sessions, long-lived, refreshed by re-listing nodes every 6 minutes |
| Node fleet responses | `server: istio-envoy` on all 591, `x-tw-naas-request-id`, `x-ratelimit-limit` (100M to 500M), `x-cosmos-block-height`, ETags | Istio service mesh with per-request ids and block-height freshness hints |
| Balance stream failure lines | 56 of 585 lines were `failure`; their text exposes internal hosts (`<chain>.naas.internal`), per-node circuit breakers ("node circuit breaker open"), Go `net/http` timeout messages, and upstream errors such as "chain is not available on free plan" | The balance service calls the same node layer internally, likely in Go, and some chains rely on third-party providers. Raw internal errors reach the client, which Harbour should avoid |
| Realtime | Connect reply reports `version: 6.6.2 OSS`, `ttl: 299`, `ping: 25`; token is an HS256 JWT with only `sub`, `iat`, `exp` (300 s life) | Stock open-source Centrifugo; channel rights are checked server-side, not in the token |
| Risk vendors | `/v1/validate/url` returns `provider: [Binance, Hashdit, Trustwallet]` with a `risk_level` | URL risk is an aggregate of in-house and vendor feeds |

## Network logs: payload shapes

These are the observed request and response fields for the gateway calls Harbour would need equivalents for (types only; no captured values are reproduced). The biggest surprise is that the device profile carries a **per-country feature gate** (`geofence.verdicts`). Extension 26.41.0 never reads those verdicts; enforcement happens on the server, which answers blocked actions with error code `geofenced` that the client recognises.

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /v2/devices/fingerprint` | `identifier`, `bundle`, `sr` (screen size) | `device_id`, `hash_key` |
| `GET /v2/devices/{id}` | none | `platform`, `push_enabled`, `language`, `app_version`, `wallets_version`, `currency`, `country_code`, `geofence {rule_version, country, region, verdicts}`; verdicts are `allowed` flags for 16 features: buy, sell (with blocked providers), earn deposit, stake, view and withdraw, perps view and trade, RWA trade, swap trade and fast quote, QR pay, campaigns |
| `POST /v3/devices/{d}/wallets/{w}/register` | `operation_type`, `accounts [{coin, addresses[]}]` | echoes `accounts`, plus `coins[]` |
| `POST .../address_association` | `coin`, `address` | `status` (bool) |
| `POST /v1/assets` (discovery) | `assets [{coin, address, publicKey}]`, `from_time`, `version` | `docs[]`, `meta.interval_ms` (10,000) |
| `GET /v1/assets?asset_ids=` | ids | `[{asset_id, name, symbol, type, decimals, network, icon_url, is_pre_ipo, is_rwa, is_scaled_ui_amount, classification {category, surface, category_reason, provisional}}]` |
| `GET /v1/coinstatus/{asset}` | none | `asset {…}`, `isBuyCryptoEnabled`, `isSellCryptoEnabled`, `isSwapEnabled`, `isSwapCrossChainEnabled`, `isStakeEnabled`, `isDappsEnabled`, `isPreIPO`, `isRWA`, `isScaledUIAmount`, `defaultSwapPair`, `defaultSwapCrossChainPair`, `messages[]` |
| `POST /v1/balances/stream` | `currency`, `addresses [{asset_id, address}]` | NDJSON, 1 to 92 lines (median 7): `{type: balance, payload {asset_id, address, amounts {total, total_in_fiat, available, available_in_fiat}}}` or `{type: failure, payload {asset_id, address, reason}}` |
| `GET /v1/balances/chains` | none | `stats {total, enabled, db_lookup_enabled, ws_supported}`, `chains [{chain_id, name, handle, enabled, db_lookup_enabled, ws_supported}]` |
| `POST /v2/market/tickers` | `currency`, `assets[]` | `currency`, `tickers [{id, price, change_24h, provider, slug, last_updated_time}]` |
| `POST /v1/txhub/bulk_history` | `addresses [{chain, address}]`, `from`, `to` | `data [{hash, chain, block_number, block_created_at, created_at, status, fees [{type, asset, value}], events [{type, data {from, to, asset, value}}]}]`, `meta.unsupported_chains[]` |
| `POST /v1/validate/url` | `dapp_url` | `provider[]`, `risk_analysis {risk_level}`, `dapp_url` |
| `POST /v1/validate/address` | `asset_id`, `address`, `version`, `type` | risk result, or `{error {message}}` on 400 |
| `POST /v1/approvals/scan` | `addresses [{chain, address}]`, `currency` | `approvals[]`, `meta.next_token`, `errors[]` |
| `POST /v3/nft/collections` | `owners [{chain, address}]`; query `page`, `pageSize`, `exclude_spam` | `docs[]`, `next` |
| `GET gateway.trustwallet.com/v2/projects/{id}/nodes` | none | `{code, message, data [{name, network, nodes [{url, weight}]}]}`: 125 networks, 377 node URLs, all weight `high`, all on `twnodes.com` |
| `POST wallet-kit/v1/apr` | `chain {coin_type, chain_id, coin_id, is_custom}`, `validator {address, available, commission}` | `apr` (string) |
| `POST /v1/centrifugo-hooks/token` | `{}` | `token` (JWT) |

**Design notes worth copying:** history is event-based (one transaction holds typed `events` and typed `fees`), which handles swaps and multi-transfer transactions cleanly; amounts are always strings; responses are explicit about partial failure (`failure` lines, `unsupported_chains`, `errors[]`) instead of failing the whole call.

## Network logs: node fleet and the send flow

The node list names 125 networks and 377 node URLs, all on `twnodes.com`; the client calls each chain in its native protocol and does little batching (6 of 342 JSON-RPC posts were batches). In the 2.8-hour session only 63% of 1,463 node calls returned 200, mostly because unfunded accounts return 404 and two chains rate-limited.

| Chain family | Hosts seen | Calls made per account | Notes |
| --- | --- | --- | --- |
| EVM JSON-RPC | about 50 (Ethereum, BSC, Base, Linea, Mantle, Polygon zkEVM, Zeta, others) | `eth_getBalance`; `eth_call` for ERC-20 `balanceOf`, `name`, `symbol`, `decimals`; Multicall3 `aggregate3` on BSC | One call per chain per refresh, even for empty accounts |
| Other JSON-RPC | Solana, Sui, Near, XRP, Theta, Ontology, ICON, Nano | Solana: `getBalance`, `getSignaturesForAddress`, staking reads; Sui: `suix_getAllBalances`, `suix_getStakes`; XRP: `account_info` | Native methods per chain |
| Cosmos LCD | 18 (Cosmos, Osmosis, Injective, Sei, Thorchain, Crypto.org, others) | 4 GETs: bank balances, delegations, rewards, unbonding | 404 for unfunded accounts |
| UTXO Blockbook | 14 (BTC, LTC, DOGE, BCH, DASH, ZEC, others) | `GET /api/v2/address/{addr}?details=` | Viacoin returned 429 repeatedly |
| Cardano GraphQL | 1 | 5 queries: `UtxoSetForAddress`, `GetBalance`, `LastDelegation`, `AllActiveStake`, `Deregistrations` | Rate limit header 100M |
| Chain REST | Polkadot, Kusama, Tron, TON, Stellar, VeChain, Algorand, Aptos, Waves, Tezos, MultiversX | Account and balance endpoints | Polkadot and Kusama often behind open circuit breakers |

**EVM send on a custom network (Sepolia, public RPC)**, from the send capture:

1. `eth_getTransactionCount`, `eth_estimateGas`, `eth_gasPrice`, repeated three times as the user edits the amount (0 to 6.5 s).
2. `eth_sendRawTransaction` at 8.4 s.
3. 58 polls of `eth_getUserOperationReceipt` on the account-abstraction node, every one answered 400 "unsupported chainID value": wasted polling on a chain that gateway does not serve.

**Gasless BSC send**, from the base-flow capture:

1. `eth_getTransactionCount` and `eth_estimateGas` on the normal BSC node.
2. `pm_isSponsorable` on `bsc-sponsored` with the full transaction (`from`, `to`, `value`, `data`, `gas`) returns `{sponsorable: true}`.
3. Nonce and `eth_sendRawTransaction` go to the sponsored node (a paymaster relay), at 10 s.
4. `eth_getGaslessTransactionByHash` on the sponsored node, then `eth_getTransactionReceipt` on the normal node at 11.7 s.

The signed transaction is built and signed locally in both flows; nodes only receive signed bytes.

## Network logs: realtime, errors and performance

The realtime socket is used only for balance channels and carried no balance events in any capture; errors are mostly expected 404s; and the heavy traffic is repeated config downloads, not user data.

**Realtime.** Three sockets were recorded with 245 `subscribe` and 147 `unsubscribe` commands, all for `balances:<coin>.<address>` channels, plus ping/pong every 25 s. No publication arrived because no funds moved during the recordings, so the push payload format is still unseen. In the long session the socket reconnected about every 23 minutes and the token was refreshed every 270 s.

**Errors.** Gateway: 606 of 681 calls returned 200. All 25 `GET /v1/assets/{id}` calls and 28 of 74 `coinstatus` calls were 404 (assets the server does not list, such as testnet or custom tokens); 7 were 400 (bad ids on charts and info, one address check); `wallet-kit /v1/fee/priority/60` returned 500. Client errors also go to Sentry (`ingest.us.sentry.io`, 1 to 9 events per capture).

**Latency and size.** Server time is short (Envoy reports 7 to 20 ms for most routes); users see 280 to 380 ms because of distance to the US gateway. The outliers and the heavy payloads:

| Call | Server time | Size | Repeats |
| --- | --- | --- | --- |
| `GET gateway.trustwallet.com/v2/projects/{id}/nodes` | 1,146 ms | 20 KB | every 6 min, identical each time |
| `GET /v1/buycrypto/widget/quote` | 974 ms | 0.7 KB | on open |
| `GET /v1/cex-transfer/providers/binance-pay/assets` | 8 ms | 30 KB | 57 times across captures |
| `GET wallet-kit/v1/apr/proxy/stakewiz` | 7 ms | 152 KB | on earn screen |
| `GET assets-cdn/blockchains/ethereum/tokenlist.json` | CDN | 149 KB | ETag revalidation |
| `GET /v1/invests/stablecoin/config` | 8 ms | 29 KB | every 12 min |

## Network logs: what Harbour should copy or do differently

Copy Trust Wallet's data contracts and server-controlled pacing, but not its device credential, its URL-borne node tokens or its polling volume. At Trust Wallet's observed rate (about 700 API and 520 node requests an hour per open wallet), 10,000 open wallets would mean roughly 3,400 requests a second, so the polling choices below decide most of Harbour's backend cost.

| Area | Copy | Do differently |
| --- | --- | --- |
| Pacing | Server-set poll interval in every discovery reply (`meta.interval_ms`) | Push changes over the socket and poll every 60 s or more only as a fallback, instead of discovery every 10 s |
| Balances | NDJSON stream with one line per asset and explicit `failure` lines | Return error codes, not raw internal messages with hostnames and session tokens |
| History | Event-based transactions with typed `events`, typed `fees`, cursor paging and `unsupported_chains` | Same; add reorg-safe status (`pending`, `confirmed`, `final`) |
| Device auth | A device id on every request, `traceparent` on every call | Ed25519 key pair per install; never hand out a stable shared secret that the identifier alone can retrieve |
| Node access | Node list with weights, per-chain native protocols, client failover | Short-lived tokens in a header, rotated, instead of one URL token reused for hours; ETag or a version so the 20 KB list is not re-downloaded every 6 minutes |
| Chain polling | Discovery decides which assets exist | Query only chains where the account has activity; Trust Wallet polls about 45 chains a minute and 37% of node calls fail or return empty |
| Batching | Multicall3 on BSC | Batch JSON-RPC and use Multicall on every EVM chain |
| Realtime | Open-source Centrifugo, one channel per chain and address, 5-minute JWT, connect only while unlocked | Same; publish discovery and history changes too, not only balances |
| Gasless | `pm_isSponsorable` check before routing to a paymaster relay | Add only for chains you sponsor; stop receipt polling on chains without account abstraction (58 wasted polls seen) |
| Compliance | Country rules returned with the device profile and enforced on the server (`geofenced` errors) | Same pattern if you need it, with a clear message in the UI |
| Region | Cloudflare in front of the API | Serve from the edge near users; Trust Wallet's US-only gateway adds about 300 ms per call from India |

## Data layer verified by REA

Trust Wallet keeps three local stores and no server-side copy of keys: an encrypted vault, a persisted Redux state, and a SQLite cache. REA validated the bundled SQLite engine (`sql-wasm.wasm`, 613 KB, valid, 52 exports); the schema and keys below were read directly from the shipped `background.js`.

| Store | Exact key or name | Holds | Protection |
| --- | --- | --- | --- |
| `chrome.storage.local` | `trust:vault`, `trust:pbkdf2`, `trust:vaultId`, `trust:migrated` | Encrypted wallets, KDF salt and iterations, vault id, migration flag | Password-derived AES-GCM |
| `chrome.storage.session` | `password`, `unlockKey` | Derived keys while unlocked | Memory only; no `setAccessLevel` call, so it relies on Chrome's default (trusted contexts) |
| `chrome.storage.local` | `trust:store` | Whole Redux state, 16 slices: app, approvals, asset, blockchains, dapps, fiat, migration, migrations, nft, notification, sdkFeatureSlice, settings, staking, swap, tx, wallet | Plain JSON |
| `chrome.storage.local` | `trust:queue:v2` | Pending background jobs, replayed at boot | Plain |
| `chrome.storage.local` | `trust:relayStatus:<id>`, `trust:relaySwapRequests`, `trust:swapLeg` | In-flight cross-chain swap state | Plain |
| `chrome.storage.local` | `TrustSDK_DB` | SQLite file, deflated then Base64 | Compressed, **not encrypted** |
| IndexedDB | none |  | Not used |

**SQLite schema (40 table names, 7 of them `_new` migration copies, 7 indexes).** Amounts and prices are `TEXT` in smallest units; every table keys on asset id and, where relevant, wallet and address.

| Group | Tables | Key columns |
| --- | --- | --- |
| Asset catalogue | `AssetInfo`, `AssetStatus`, `AssetLocalStatus`, `AssetMessage`, `AssetLocalMessage` | `assetID` PK; type, symbol, decimals, icon; buy, sell, swap, cross-chain and stake flags; default swap pairs; per-wallet enabled and manual flags |
| Balances | `AssetAccount` | PK (`assetID`, `accountAddress`); 18 balance columns (available, frozen, locked, rewards, staked, pending, blocked, claimable, transferable, inscribed, dust, invested, earned, energy, bandwidth and their limits, reserved); `isRegistered`, `updatedAt` |
| Prices | `AssetTicker`, `MarketInfo`, `MarketInfoLink`, `AssetHighlights` | price and 24h change as text, currency code, update time |
| Security | `AssetSecurityInfo`, `AssetSecurityInfoItem`, `Approval` | Approval PK (`walletId`, `address`, `spenderAddress`, `assetId`); risk level, unlimited flag, allowance, pending revoke hash |
| Fees | `FeePriority` | low, medium, high price and time per asset |
| Price alerts | `PriceAlert`, `PriceAlertAssets`, `PriceAlertSettings` | watch-list flag plus an outbox: `syncStatus`, `syncAttempts`, `lastFailureTime`, `nextRetryTime` |
| Caches | `HomepageCache`, `EarnPortfolio`, `StablecoinBalanceChange`, `StablecoinPopupStatus`, `SwapSelectedPair` | JSON blob per wallet and currency |
| Product features | `Launchpool*` (4), `TokenLockerPosition`, `Perpetual*` (6) | Campaigns, rewards, perps settings |

**Corrections to the old docs:** the job queue key is `trust:queue:v2` (previously "unresolved"); swap relay keys were missing; `AssetAccount` has 18 balance columns, not 10; the event router has 218 named events (176 internal, 42 public), not 204; there are 68 gateway call sites in the API client, not 73 methods. The old DDL count (174 occurrences, 56 statements) mixed several files; `background.js` alone has 71 `CREATE TABLE` statements.

## Industry standard: how the leaders split client, backend and database

Both leaders follow the same pattern: a **thick, stateful background** owns keys, state and a local cache; a **thin UI** renders a mirror of that state; and **many small, stateless data services** sit behind it, none of which ever see keys. They differ mainly in how they authenticate clients and how they reach chains.

| Concern | Trust Wallet 26.41.0 (REA) | MetaMask (public source) | Harbour today |
| --- | --- | --- | --- |
| Background structure | Event router (218 events) over 52 DI services | Controllers from the `MetaMask/core` monorepo (70+ packages: accounts, network, transactions, permissions), each owning one slice of state and talking through a messenger | Router with about 19 handler files; logic mixed into large modules |
| State | Redux, 16 slices, whole store persisted with versioned pre- and post-boot migrations | Per-controller state, persisted with numbered migrations | Small worker Redux store plus separate popup stores |
| Local database | SQLite (sql.js) with 40 tables, saved compressed | Extension storage per controller | `chrome.storage.local` JSON only |
| UI to background | RPC store mirroring Redux; React Query for fetched data | Background connection over a JSON-RPC stream | One port with snapshot and patches (good) |
| Vault | PBKDF2 then AES-GCM; keystore inside | PBKDF2 and AES-GCM via `browser-passworder`; reported at 600,000 iterations since 2023 | Copy of Trust Wallet's (10k outer, 20k and 210k derived) |
| Client auth to backend | Per-device HMAC secret from `/v2/devices/fingerprint` | Bearer token from a signed-in profile | IP rate limit only |
| Chain access | Own node fleet (\~100 hosts) with session URLs from a discovery API | Infura by default; Accounts API for balances and history | Public RPCs plus keyed proxies in one Worker |
| Data APIs | One large gateway plus WalletKit host | Several small APIs: accounts, price, token, tokens | One Worker proxying CoinGecko, LI.FI, explorers |
| Realtime | Centrifugo-style socket, channels per address and per swap session | WebSocket, `account-activity` channel per account | None |
| Risk | Gateway `validate` endpoints, `coinstatus` security info | Blockaid simulation and alerts | GoPlus, ScamSniffer, `eth_simulateV1` from the client |
| Telemetry and flags | Amplitude (75 UI chunks use an analytics hook), Sentry | Opt-in MetaMetrics, remote feature flags | None; signed remote config only |

**The standard to copy:** controller-per-domain background with typed messages, a real local database with migrations, a thin UI mirror, short-lived device credentials, a split between "data APIs" and "node access", a realtime channel per account, and opt-in telemetry. Harbour already matches the thin-UI and vault layering; the gaps are structure, local storage, backend auth, node access and realtime.

Sources for MetaMask rows: [MetaMask/core overview](https://www.sourcepulse.org/projects/600734), [@metamask/core-backend README](https://cdn.jsdelivr.net/npm/@metamask/core-backend@6.3.3/README.md), [browser-passworder README](https://github.com/MetaMask/browser-passworder), [write-up on MetaMask's 600,000-iteration change](https://chenguangliang.com/en/posts/blog176_electron-private-key-storage/).

## Harbour redesign: target layers

Restructure Harbour into six layers with one owner per concern: the UI only renders, controllers own all state and secrets, local data is versioned, clients are the only code that touches the network, and the backend serves public data. Highlighted boxes are the only places key material exists.

&#91;embedded content: Harbour target architecture · 6 layers\]

**Where today's folders go**

| Today (`harbour-wallet-v2/src`) | Target | Change |
| --- | --- | --- |
| `popup/wallet/*`, `popup/onboarding/*` (large files such as `screens.tsx`) | `ui/features/<feature>/` with routes, screens and hooks per feature | Split by feature; screens read state through selectors only |
| `popup/design`, theme | `ui/design-system/` | Shared tokens and components, accessibility rules |
| `popup/*Store.ts`, `send/store.ts`, `swap/swapStore.ts` | Query cache for server data; worker state for everything else | Remove popup copies of wallet state |
| `background/kernel`, `handlers/*`, `modules/*` | `background/controllers/<domain>/` plus a typed messenger | One controller per domain; each event has a schema |
| `core/vaultService.ts`, `passworder.ts`, `background/keys.ts` | `background/controllers/keyring/` | Versioned vault, stronger KDF, random data key |
| `background/store/*` | `background/state/` | Per-controller slices, migrations with tests |
| `core/txHistory.ts`, `activity/*`, caches in `storage.local` | `background/db/` (IndexedDB or sql.js) | Real tables with indexes and pruning |
| `kit/*` (failover, http client, gateway) | `background/clients/` | Harbour API client signs requests; node client keeps failover |
| `core/swap`, `core/staking`, `core/perps`, `core/predictions` | `background/controllers/swap`, `earn`, `trading` | Each behind a feature flag from signed config |
| `background/provider`, `inpage`, `content`, `walletconnect` | `provider/` package | Unchanged boundary; add per-session WalletConnect chain |
| `gateway/worker.ts`, `push.ts` | `backend/gateway`, `backend/services/*`, `backend/db` | Split routes into services; add Postgres and signed device auth |

## Database design

Use two databases with a hard line between them: the device database holds everything about the user, including the encrypted vault; the server database holds only public chain data plus a device's public key and watched addresses. Identify chains and assets with CAIP-2 and CAIP-19 ids, and store every amount as an integer in smallest units (`numeric(78,0)` on the server, decimal strings on the device), as Trust Wallet does.

**On the device**

| Store | Engine | Contents | Rules |
| --- | --- | --- | --- |
| Vault | `chrome.storage.local`, one blob | `{version, kdf: {alg, params, salt}, cipher: aes-256-gcm, iv, ct}`; a random data key encrypts the wallet keystores, the password-derived key only wraps the data key | Argon2id (wasm) or PBKDF2-SHA256 at 600k+; version field so the KDF can be raised on next unlock |
| Session | `chrome.storage.session`, `setAccessLevel(TRUSTED_CONTEXTS)` | Data key while unlocked | Cleared on lock, idle, OS lock and browser close |
| State | `chrome.storage.local`, one key per controller | Settings, accounts metadata, connected sites, networks | No secrets; numbered migrations with a test each |
| Cache database | IndexedDB (preferred over sql.js: native, incremental writes, larger quota) | Tables mirroring Trust Wallet's: `assets`, `asset_status`, `balances` (PK chain, address, asset), `prices`, `transactions` (PK chain, hash, log index; index by account and time), `approvals`, `fee_tiers` | Rebuildable from the network; prune history beyond a limit; never stores keys |
| Outbox | IndexedDB table | Pending server syncs (push topics, alerts) with `attempts`, `next_retry_at`, like Trust Wallet's `PriceAlertAssets` | Exponential backoff; idempotency key per item |

**On the server (Postgres)**

| Table | Key | Main columns | Notes |
| --- | --- | --- | --- |
| `devices` | `id` | `public_key`, `platform`, `app_version`, `locale`, `currency`, `push_token_enc`, `last_seen_at`, `revoked_at` | Ed25519 public key replaces Trust Wallet's shared HMAC secret |
| `device_addresses` | (`device_id`, `chain`, `address`) | `added_at` | Watched addresses; delete on unregister and after 30 idle days |
| `chains` | `caip2` | `family`, `enabled`, `ws_supported`, `finality_depth`, `node_pool` | Equivalent of `/v1/balances/chains` |
| `assets` | `caip19` | `chain`, `contract`, `symbol`, `name`, `decimals`, `logo`, `verified`, `spam_score` | Catalogue and search |
| `asset_status` | `caip19` | buy, sell, swap, stake flags; `security_info` JSON; `updated_at` | Equivalent of `coinstatus` |
| `balances` | (`chain`, `address`, `asset`) | `amount`, typed breakdown (staked, rewards, locked), `block_number`, `updated_at` | Source for the balance stream |
| `blocks` | (`chain`, `number`) | `hash`, `parent_hash` | Reorg detection |
| `transfers` | (`chain`, `tx_hash`, `log_index`) | `block_number`, `block_time`, `from`, `to`, `asset`, `amount`, `status` | Partition by chain and month; index (`chain`, `address`, `block_time desc`) via a join table |
| `prices` | (`asset`, `currency`, `ts`) | `price`, `change_24h`, `source` | Time-partitioned; latest value in Redis |
| `risk_results` | (`kind`, `subject`, `provider`) | `result`, `expires_at` | Cached site, address and token checks |
| `approvals` | (`chain`, `owner`, `spender`, `asset`) | `allowance`, `block_number`, `risk` | Built from indexed Approval events |
| `swap_sessions`, `swap_steps` | `id`, (`session_id`, `idx`) | `device_id`, `params`, `provider`, `status`, `tx_hash`, `expires_at` | Only if quotes move server-side |
| `notifications_outbox` | `id` | `device_id`, `payload`, `attempts`, `sent_at` | Exactly-once push delivery |
| `config_releases` | `seq` | `payload`, `signature`, `issued_at`, `expires_at` | Signed remote config history |

**Rules both sides follow:** migrations in code and reviewed; no seed, key, password or password hash anywhere on the server; retention and a delete path for every table that names a device; daily backups with point-in-time recovery on the server; and a write path that is idempotent so retries never double-count.

## Migration plan

Migrate in place, one domain at a time, keeping every existing message name working until its controller replaces it (a strangler pattern), so the extension ships at the end of every phase. About 20 weeks for 2 to 3 engineers; phases 3 to 5 overlap.

| Phase | Weeks | Work | Gate before moving on |
| --- | --- | --- | --- |
| 0. Ground rules | 1 | Schema for every existing UI-to-worker message; `no-explicit-any` on `background/` and `core/`; keep the boundary test; rotate and move the secrets in the REA folder | Every message validated; build fails on new `any` in signing code |
| 1. Keyring and vault v2 | 2-4 | Keyring controller owns vault, keystores and signing; vault v2 with a random data key and Argon2id or PBKDF2 600k; migrate on next unlock; old format readable | Upgrade test from a real v1 vault passes; no key material outside the controller |
| 2. Controllers | 4-8 | Accounts, network, assets and balances, transactions, dApp permissions, swap and earn, settings; move `handlers/*` and `modules/*` code into them; per-controller state with migrations | Each old message routes to a controller; popup state copies removed |
| 3. Local cache database | 6-9 | IndexedDB tables for assets, balances, transactions, approvals, fee tiers and an outbox; move `txHistory` and activity data out of `storage.local` | Cold start renders from cache; history survives worker restarts |
| 4. UI restructure | 6-10 | Feature folders, shared design system, React Query for server data, selectors for worker state; split the 300 to 600-line screen files | Popup first paint under 300 ms; no screen imports background code |
| 5. Backend v1 | 8-12 | Device registration with Ed25519 keys and signed requests; Postgres with `devices`, `device_addresses`, `chains`, `assets`, `asset_status`; push moved out of KV | Unsigned or replayed requests refused; push survives a redeploy |
| 6. Indexer and realtime | 12-17 | Balances and transfers for Ethereum, BNB, Polygon, Arbitrum, Base, Solana, Tron from provider webhooks and RPC; reorg handling; balance stream; WebSocket channels per address | Balances match RPC within one block; an incoming transfer shows in under 10 s |
| 7. Safety, telemetry, release | 16-20 | Risk and approval services with "check unavailable" states; opt-in scrubbed error reporting; Playwright end-to-end suite; external audit; staged store rollout | No open High findings; crash-free rate target met in beta |

Keep direct RPC as a fallback for every backend-served feature, so Harbour still works, more slowly, when the backend is down. That is the property that keeps a self-custody wallet trustworthy.

## Evidence

Every Trust Wallet fact in this doc comes from REA 6.5.0 run on 2026-10-27 or from a direct read of the shipped files; no earlier doc was used as a source. Raw outputs and a README are in `evidences/re-evidence/42-backend-rerun/2026-10-27/` in the REA folder.

| What | How | Evidence id or file | Confidence |
| --- | --- | --- | --- |
| Runtime endpoints, hosts, call counts | REA `inspect-web-network-capture` on 8 captures (1,476 requests), then the `api-surface` view | `ev_c8051aa4...`, `ev_88e5da0c...`, `ev_e58a039b...`, `ev_687fb921...`, `ev_a9da7fc4...`, `ev_e4b0a9e3...`, `ev_edd022f8...`, `ev_b4d14f24...`; merged in `api-surface-merged.txt` | Observed at runtime |
| SQLite engine | REA `inspect_wasm_artifact` on `sql-wasm.wasm` (WABT 1.0.42) | `ev_1a32f910...` | Observed, valid module |
| Content script and popup store module graph | REA `analyze-javascript-application` | `ev_f64ab173...` | Static |
| Storage keys, 40 SQLite tables, 16 slices, 218 events, 52 services, 68 gateway call sites, realtime channels | Direct static read of `background.js` (42.7 MB, SHA-256 `a6dc88b6...`) | Shipped file | Static, exact strings |
| Popup architecture (React, 69 routes, React Query, Redux mirror) | Direct static read of popup chunks | `chunks/App-*.js`, `chunks/store-*.js` | Static |
| MetaMask rows | Public sources linked in that section; some rows (Infura default, MetaMetrics) are general knowledge | Links | Secondary |

**Network log deep dive.** The "Network logs" sections come from parsing all 10 captures directly (the 8 above, the 1,098-entry end-to-end capture, and the first 3,467 complete entries of the truncated 2.8-hour `network-log.har`); the parser is saved as `network-deep-dive/har_lib.py` in the evidence folder. Only field names, counts and timings were copied into this doc, never captured addresses, tokens or device ids. The `geofence` claim was checked against the extension code, which does not read the verdicts.

**Limits.** REA's full graph analysis of `background.js` did not finish: the file is too large for the 60-second device bridge and the sandbox's per-call process lifetime, so those facts come from a direct scan instead. Two large captures (53 MB and 151 MB) exceed REA's 32 MiB input limit and were not used. 27 capture entries had an empty server IP field removed so REA's HAR schema would accept them; bodies and stack traces were removed only for the endpoint-grouping view. Flows not recorded (transaction simulation, swap sessions, homepage) are code-level only. Trust Wallet's server database and language cannot be recovered from a client and remain unknown.

**Removing the limits.** `tools/run-full-rea.sh` in the REA folder runs REA locally on the Mac, where no time limit applies. It runs the full `background.js` graph with raised heap, timeout and node limits; splits the bundle into modules with Wakaru and graphs them; and splits every capture into parts under 32 MiB without dropping a request. A `record` step opens a throwaway Chromium with the extension so you can record swap, receive, dApp-signing and homepage flows with full headers and socket frames. Results and a `STATUS.md` land in `evidences/re-evidence/43-full-rea/`.

## Full-scan results (Oct 27)

The full scan changed no backend or database conclusion above; it filled gaps in the extension's own code. Everything below is static analysis: it shows what the code can call, not what it did at runtime.

**Coverage.** The service worker (`background.js`, 42 MB) was scanned in 104 module batches: 4,272 JavaScript files, 8.2 million syntax nodes, 13,995 network, storage or socket call sites, no parse failures. Four batches (9, 23, 66, 73) are single oversized modules whose detail REA truncated. The whole-extension pass covered the popup app only (238 files, 19 million syntax nodes, 9,052 findings), because `background.js` exceeds its result size limit.

**Popup app (a thin React view, as in Harbour).** 246 endpoint nodes: about 80 screen routes and the rest backend and chain calls. Routes cover send, receive, swap, bridge, buy, sell, earn and staking, NFT collections and inscriptions, address book, connections and a connection blacklist, auto-lock, notifications, gas station, perps and a developer faucets page. Storage use is limited to local and session storage plus one worker; there is no IndexedDB.

**New backend calls not seen in the recordings.**

- Perps relay: `/v1/perps/relay/quote` and `/v1/perps/relay/authorize`. A separate hop from the swap relay.
- Cardano GraphQL operations: `SubmitTransaction`, `UtxoSetForAddress`, `GetBalance`, `StakeRegistrationsLatest`, `GetWithdrawableRewards` and others.
- TRON full-node HTTP calls: `wallet/broadcasthex`, `wallet/broadcasttransaction`, `wallet/getaccount`, `wallet/getaccountresource` and about 40 more.
- TON contract getters (`get_wallet_data`, `get_jetton_data`, `seqno`) and Solana program helpers (SPL token, memo, compute budget, address lookup tables).
- A token list fetched straight from `dex.binance.org/api/v1/tokens?limit=10000` (BNB Beacon Chain).
- Sentry error reporting (`sentry.dsc`).

**What it means for Harbour.** Chain families are separate adapters behind one interface; copy that shape, not the endpoint list. Perps and swaps go through a relay that quotes, then asks the server to authorize, before the client signs. The server and database internals remain unrecoverable from the client.

**Still open.** REA's endpoint grouping fails on the 10 largest recordings; new recordings (swap, receive, dApp signing) would add runtime evidence for the relay flows.
