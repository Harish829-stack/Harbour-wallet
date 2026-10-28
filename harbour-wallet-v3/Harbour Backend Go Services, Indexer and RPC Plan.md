# Harbour Backend: Go Services, Indexer and RPC Plan

Oct 27, 2026 · @Harish

## Answer

Harbour's reads come from Postgres, not from RPC. An indexer writes every transfer, balance, NFT and price change for tracked addresses into Postgres as it happens, so opening the wallet costs a few indexed queries, never a fan-out of RPC calls.

- **Alchemy is the first indexer source, behind an adapter.** Address Activity webhooks push new transfers; the Transfers API backfills recent history and fills any gap the webhooks miss. Another source (Goldsky, QuickNode Streams, own nodes) is a new adapter, not a rewrite.
- **Balances are read from chain, not summed from transfers.** Transfers trigger a refresh; native and token balances are fetched with Multicall3 at one block, which stays correct for gas fees and rebasing tokens.
- **RPC goes through one Go gateway** pooling Alchemy, Infura and a third provider per chain, scored on errors, latency and block lag, with failover, budgets and caching. Only live work uses it: sending, estimates, simulation, balance refresh and gap-fill.
- **Writes are idempotent and reorg-aware.** An unpartitioned `event_keys` table dedupes every event by chain, transaction and position; reorged events are removed and balances refreshed.
- **Abuse is bounded.** Device keys, proof-of-work on registration, per-device quotas and a capped backfill keep one script from burning the provider budget.
- **The extension never calls providers directly** and never holds their keys; it calls Harbour's API and gets live updates from Centrifugo.

What this plan cannot promise: "no call ever fails". With three providers per chain, a call fails only when all three fail for that chain at once; the gateway then returns a clear retryable error and the extension retries.

## Architecture

&#91;embedded content: Harbour backend · services, stores and providers\]

Alchemy pushes chain activity into `webhook-ingest`, NATS fans it out, and the indexer writes Postgres; the API serves the extension from Postgres and Redis, and only sends, estimates and reconcile checks go through `rpc-gateway`. `tx-tracker`, `price-poller` and `notifier` are left out of the picture; they hang off NATS the same way.

## Modular design

Every outside dependency sits behind a Go interface, and each implementation registers itself by name. Services only ever see the interface and a config file, so adding a provider, an indexer source or a chain is a new adapter package plus a config entry; no service code changes.

| Plug point | Interface | First implementations | Adding one more means |
| --- | --- | --- | --- |
| RPC upstream | `rpc.Upstream` (`Call`, `Head`, `Health`) | Alchemy, Infura | Config only: URL template, key, weight, budget, chains |
| Chain family | `chain.Client` (balances, fees, nonce, broadcast, simulate) | EVM | A package under `chains/<family>`; Solana, Bitcoin and TRON later |
| Indexer source | `index.Source` (`Subscribe`, `Backfill`, `Since(block)`) emitting `ActivityEvent` | Alchemy webhooks and Transfers API | A package under `sources/<name>` that converts its payload to `ActivityEvent`; e.g. Goldsky, QuickNode Streams, own node |
| Finality | `chain.FinalityPolicy` | `finalized`-tag based (EVM) | Config per chain, code per family |
| Prices | `price.Source` | CoinGecko, Alchemy | Package under `prices/<name>`; priority order in config |
| Simulation and risk | `risk.Simulator` | Alchemy `simulateAssetChanges` | Package under `risk/<name>` |
| NFT and token metadata | `meta.Source` | Alchemy | Package under `meta/<name>` |
| Push delivery | `notify.Channel` | Web Push, FCM | Package under `notify/<name>` |

**One event format.** Every indexer source converts what it receives into one `ActivityEvent`: `chain`, `family`, `tx_hash`, `event_ref` (an opaque, source-independent position such as `log:12`, `trace:0.1`, `vout:3`), `block_number`, `block_hash`, `block_time`, `from`, `to`, `asset`, `amount_raw`, `kind`, `removed`, and a `details` JSON for chain-specific fields. The indexer, database and API never see a provider's payload.

**Chain-agnostic schema.** `transfers` and `transactions` use `event_ref` instead of `log_index` and `trace_address`, carry `chain_family`, and keep EVM-only fields (nonce, method signature, gas) in `details`. Assets are keyed by `(chain_id, asset_ref)` where `asset_ref` is a contract address, mint, or `native`.

**Chains come from config.** A chain entry names its family, the RPC upstreams in priority order, the indexer sources, the finality policy and the price IDs for its native coin. Adding Arbitrum is one entry; adding Solana is one entry plus the `chains/solana` and source adapters.

**Contract tests.** Each interface has one shared test suite that every adapter must pass (recorded fixtures, replayed), so a new adapter is accepted by running the suite, not by reviewing every service.

**Rule.** Nothing outside an adapter package may import a provider SDK or reference a provider name; a lint check (`depguard`) enforces it.

## RPC layer

One Go service, `rpc-gateway`, is the only thing in Harbour that talks JSON-RPC to providers. Every other service, and the extension's live calls, go through it. Don't build this from zero: start from **eRPC** (open-source Go RPC proxy that already does scoring, failover, hedging, finality-aware caching and rate budgets) and wrap it, or copy its design if you need it in-process.

**Pool per chain.** Each chain has an ordered list of upstreams, e.g. Ethereum = Alchemy key A, Infura key A, Alchemy key B, Infura key B. Keys and weights live in config (Vault or the cloud secret store), never in code or the extension.

**How a call is routed**

1. **Classify the method.** Reads (`eth_call`, `eth_getBalance`, `eth_getLogs`, `eth_getTransactionReceipt`) can be retried and hedged. Writes (`eth_sendRawTransaction`) are never hedged; they are broadcast to two upstreams at once on purpose, since the same signed transaction is idempotent by hash.
2. **Check the cache.** Results for finalized blocks are cached for good; results at `latest` live for about one block time; pending and mempool calls are never cached.
3. **Pick an upstream by score.** The score combines error rate, p90 latency and block lag (how far its head trails the best head), measured over a sliding window. Requests are spread by weighted random over healthy upstreams, which spreads load evenly instead of pinning to the first.
4. **Fail over.** On a retryable error (timeout, 429, 5xx, "header not found", empty result for a block the pool says exists), move to the next upstream. Deterministic errors (revert, invalid params, nonce too low) return at once: retrying them only burns quota.
5. **Hedge slow reads.** Only for user-facing calls (estimate, simulate, receipt, balance on open): if no answer arrives by the upstream's p90 latency, send the same read to a second upstream and take the first good answer. Background jobs (gap-fill, balance refresh, sweeps) never hedge, because hedging doubles provider spend.
6. **Circuit-break.** An upstream with a high error rate is taken out for a cool-off period, then probed with a few requests before it rejoins.
7. **Budget.** Each key has a per-second budget matched to its plan; the gateway sheds load to the next key before the provider returns 429.

**Consistency rules that matter for a wallet**

- Track each upstream's head with `eth_blockNumber` polling (or `newHeads`); never send a block-specific read to an upstream that hasn't reached that block.
- Pin a multi-call sequence (estimate gas, then get nonce, then send) to one upstream, so the user never sees one node's nonce and another's balance.
- Split large `eth_getLogs` ranges into chunks each provider accepts, and merge.
- Batch JSON-RPC from callers is split, routed per item and reassembled.

**What callers see.** A normal JSON-RPC response, or one error shape: `{code, retryable, upstreamsTried}`. The extension shows "network busy, retrying" for retryable errors instead of a raw provider message.

**Non-EVM chains** use the same pool idea with chain-specific clients (Solana RPC, Bitcoin via a Blockbook or Esplora indexer, TRON HTTP, Cosmos LCD). Alchemy and Infura don't cover all of these, so each needs its own providers chosen per chain.

## Indexer

The indexer keeps Postgres current for every tracked address. Its sources are `index.Source` adapters (Alchemy first) that emit `ActivityEvent`; the indexer itself never sees a provider payload. Transfers are history and triggers; **balances are always read from chain**, never summed from transfers.

| Path | How | When | Writes |
| --- | --- | --- | --- |
| Live | Source `Subscribe` (Alchemy Address Activity webhook) | Each new transfer touching a tracked address | Transfer rows, then queues a balance refresh |
| Gap-fill | Source `Since(block)` (Alchemy Transfers API from `last_seen_block`) | Every few minutes for addresses active in the last 7 days; at once for all after any ingest outage | Any transfer the live path missed |
| Backfill | Source `Backfill` (Transfers API, Portfolio API) | Once when an address is first tracked, capped | Recent history, current balances, NFTs |
| Balance refresh | `chain.Client` balances: native balance plus `balanceOf` for held tokens via Multicall3, pinned to one block | On every trigger, debounced per address (e.g. 2 s); daily sweep for idle addresses | `balances` with `as_of_block` |

**Live path.** `webhook-ingest` verifies `X-Alchemy-Signature` (HMAC-SHA256 of the raw body with that webhook's key, constant-time compare), stores the raw payload for replay, publishes to NATS and returns 200 at once. Alchemy delivers at least once and retries for only about 10 minutes on standard plans, which is why gap-fill exists: webhooks are the fast path, gap-fill is the guarantee. `webhook-ingest` records its own downtime; on recovery it triggers a full gap-fill from the last block seen.

**Address registration and abuse limits.** The API publishes `address.added`; the indexer adds the address to a webhook (100,000 per webhook, sharded by chain) and starts a backfill. Each device has quotas (tracked addresses, backfills per day); addresses on a deny-list (exchange hot wallets, popular contracts) are tracked live but not backfilled.

**Backfill cap.** Fetch the last 90 days or 5,000 transfers per address and chain, whichever comes first; older pages load on demand when the user scrolls (`GET …/history?cursor=` past the cap triggers a fetch). Page with `pageKey` but persist the last block reached, because keys expire after 10 minutes. Mark `synced_to_block`; the API shows "history loading" until then.

**Dedupe.** A small unpartitioned table `event_keys (chain_id, tx_hash, event_ref)` is the single source of truth for "seen". Insert into it first, in the same transaction as the transfer row; a conflict means duplicate, and nothing else is written. This works no matter which block or time the event later lands in.

**Ordering.** NATS subjects are keyed by address so one address is processed in order; balance writes are guarded anyway: `UPDATE balances … WHERE as_of_block < $new`.

**Reorgs and finality.** On `removed: true`, delete the transfer and its `event_keys` row and queue a balance refresh. A repair job compares stored `block_hash` against the canonical hash for blocks newer than the chain's finalized block (read from the `finalized` tag, configured per chain by its `FinalityPolicy`). Rows carry `finality = pending | confirmed | finalized`; the UI shows confirmations until finalized. On L2s, finalized means the L1 batch is final, which can take 10+ minutes.

**Known data gaps (accepted for v1).** Internal ETH transfers exist only on some chains and exclude zero-value and `delegatecall` calls; ERC-721 transfers don't carry sale prices (join with the payment in the same transaction); non-EVM chains need their own source adapters.

## Database

Postgres holds **facts** (what happened on chain, append-only) and **projections** (current state). Every screen reads a projection with one indexed query. The schema is chain-agnostic: positions are `event_ref`, assets are `(chain_id, asset_ref)`, and chain-specific fields go in a `details` JSONB.

No private keys, seeds or passwords are stored server-side. The server links addresses to a device, nothing more: no wallet names, no grouping.

**Identity and tracking**

| Table | Key columns | Notes |
| --- | --- | --- |
| `devices` | `id`, `public_key`, `attestation`, `quota_tier`, `created_at`, `last_seen_at`, `revoked_at` | One row per install; requests are signed with the device key |
| `tracked_addresses` | `id`, `chain_id`, `address`, `synced_to_block`, `last_seen_block`, `backfill_state`, `backfill_cursor`, `deny_backfill` | Unique on `(chain_id, address)`; indexed once however many devices track it |
| `device_addresses` | `device_id`, `tracked_address_id`, `added_at` | Encrypted at the column level; the only owner link; grouping into wallets stays in the extension |
| `chains`, `assets` | `chain_id`, `family`; `(chain_id, asset_ref)`, `symbol`, `decimals`, `logo_url`, `spam_score`, `verified` | Reference data; `asset_ref` = contract, mint or `native` |

**Facts (range-partitioned by month on `block_time`, for retention)**

| Table | Key columns | Notes |
| --- | --- | --- |
| `event_keys` | `chain_id`, `tx_hash`, `event_ref` (primary key) | Unpartitioned; the dedupe source of truth |
| `transactions` | `chain_id`, `tx_hash`, `block_number`, `block_hash`, `block_time`, `from`, `to`, `fee_raw`, `status`, `details` | One row per transaction touching a tracked address |
| `transfers` | `chain_id`, `tx_hash`, `event_ref`, `asset_id`, `from`, `to`, `amount_raw`, `kind`, `block_time`, `finality` | History; not used to compute balances |
| `price_ticks` | `asset_id`, `ts`, `price_usd`, `liquidity_usd` | 5-minute ticks; moves to ClickHouse when large |

**Projections**

| Table | Key columns | Read by |
| --- | --- | --- |
| `balances` | `tracked_address_id`, `asset_id`, `amount_raw`, `as_of_block`, `updated_at` | Portfolio; written only from chain reads, guarded by `as_of_block` |
| `nft_holdings` | `tracked_address_id`, `asset_id`, `token_id`, `amount`, `media_key` | NFT tab; `media_key` points at the cached, re-encoded image |
| `address_activity` | `tracked_address_id`, `block_time`, `tx_hash`, `direction`, `summary` | History screen |
| `balance_snapshots` | `tracked_address_id`, `day`, `asset_id`, `amount_raw` | Portfolio chart, combined with daily prices; starts on the day tracking starts |
| `pending_transactions` | `chain_id`, `tx_hash`, `from`, `nonce`, `submitted_at`, `state` | Sends until the indexer sees them |

**Partitioning.** `transactions` and `transfers` are range-partitioned by month on `block_time` with `pg_partman` (premake ahead, scheduled maintenance, default partition kept empty), so old months can be archived. `address_activity` is **hash-partitioned by `tracked_address_id`** (32 partitions), because it is always read by address; a time-partitioned table would make every history query touch every month. Dedupe never relies on a partitioned unique key; it uses `event_keys`.

**Indexes that carry the app.** `address_activity (tracked_address_id, block_time DESC, tx_hash)` with keyset pagination, never `OFFSET`; `balances (tracked_address_id)`; `transfers (chain_id, tx_hash)`.

**Amounts.** `NUMERIC(78,0)` raw integers plus `decimals`; never floats.

**Portfolio chart.** Charts start on the day an address is first tracked. A backfilled chart would need historical balances for every token, which costs many archive-node calls; offer it later as an optional 30-day backfill if users ask.

**Capacity target and recovery.** Size for 100k devices, 5 addresses each, across the launch chains; check partition sizes and query plans against that in phase 7. Point-in-time recovery on Postgres with RPO under 5 minutes and RTO under 1 hour; restore from backup once before launch.

**Scale path.** Primary plus a read replica for API reads; then price and snapshot history to ClickHouse; old partitions to object storage.

## API

The extension talks to one host over HTTPS. Requests carry `X-HB-Device`, `X-HB-Date`, `X-HB-Nonce` and `X-HB-Signature`: an Ed25519 signature by a device key generated in the extension (the server stores only the public key, so a database leak can't forge requests), the same pattern Trust Wallet uses with its `X-TW-*` headers. A device key proves "same install", not a trustworthy user, so abuse is controlled by quotas, not by the signature. Reads come from Postgres or Redis; only the last four rows touch RPC.

| Endpoint | Served from | RPC? |
| --- | --- | --- |
| `POST /v1/devices` | Registers a device public key after a proof-of-work challenge | No |
| `PUT /v1/me/addresses` | Adds or removes tracked addresses, within the device quota | No |
| `GET /v1/me/portfolio?addresses=` | `balances` joined with latest prices, Redis-cached | No |
| `GET /v1/me/history?addresses=&cursor=` | `address_activity`, keyset paginated; past the backfill cap it fetches older pages on demand | Only past the cap |
| `GET /v1/me/nfts?addresses=` | `nft_holdings`, images from Harbour's media CDN | No |
| `GET /v1/me/portfolio/chart?range=` | `balance_snapshots` and daily prices | No |
| `GET /v1/assets/{chain}/{asset}` and `/prices` | `assets`, `price_ticks` | No |
| `GET /v1/tx/{chain}/{hash}` | `transactions`, then `pending_transactions` | Only if unknown |
| `POST /v1/rpc/{chain}` | `rpc-gateway`, allow-listed read methods, per-device rate limit | Yes |
| `POST /v1/tx/{chain}/estimate` | Gas, fee and nonce from `rpc-gateway` | Yes |
| `POST /v1/tx/{chain}/simulate` | `risk.Simulator` (Alchemy `simulateAssetChanges` first) | Yes |
| `POST /v1/tx/{chain}/broadcast` | Signed tx to two upstreams; row in `pending_transactions` | Yes |

The extension groups addresses into wallets itself and passes the addresses it wants; the server only checks they belong to that device.

**Rules.** Responses carry `as_of_block` and `synced` so the UI can show "syncing". Mutating calls take an `Idempotency-Key` stored in Redis for 24 hours. `/v1/rpc` is an allow-list, never an open proxy. Per-device quotas (addresses, backfills per day, requests per minute) live in Redis; quota tiers can rise for devices with a long clean history. Request logs never include addresses. Routes are versioned under `/v1`, and an old version stays alive until the extension's minimum supported release moves past it.

**NFT media.** `meta.Source` fetches metadata and images server-side, re-encodes images to PNG or WebP, strips SVG scripts, and serves them from Harbour's CDN; the extension never loads an NFT's own URLs.

## Realtime and notifications

NATS JetStream is the internal event bus; Centrifugo is the only thing the extension holds a socket to. Services never push to clients directly.

| NATS subject | Published by | Consumed by |
| --- | --- | --- |
| `chain.<chain>.activity.raw` | `webhook-ingest` | `indexer` |
| `address.added` | `api` | `indexer` (subscribe to webhook, start backfill) |
| `balance.changed.<chain>` | `indexer` | `realtime-bridge`, `notifier` |
| `tx.status.<chain>` | `indexer`, `tx-tracker` | `realtime-bridge`, `notifier` |
| `price.tick` | `price-poller` | `realtime-bridge`, portfolio snapshot job |

**To the extension.** `realtime-bridge` publishes to Centrifugo channels named the way Trust Wallet names them: `balances:<chain>.<address>` and `tx:<chain>.<hash>`. The extension gets a short-lived connection JWT (Trust uses 5 minutes, HS256) from `POST /v1/realtime/token`, and channel tokens only for addresses its device has registered. Messages carry the new state, not "go refetch", so the popup updates without an API call.

**Push when the popup is closed.** A service worker can't hold a socket for long in Manifest V3, so `notifier` sends Web Push (or Firebase Cloud Messaging) for incoming funds and confirmed sends, deduplicated per `tx_hash` in Redis.

**Pending sends.** `tx-tracker` watches `pending_transactions`, asks `rpc-gateway` for receipts with backoff, and marks a transaction dropped if its nonce is used by another transaction.

**Scaling.** Centrifugo runs with a Redis (or NATS) broker from the start, so a second node is a config change; Redis is a managed instance with a replica. Messages carry `as_of_block`, and the extension ignores any balance update older than the one it shows.

## Repo layout and operations

One Go module in `harbour-wallet-v3/backend` on the `harbour-v3` branch, several binaries; `harbour-wallet-v2` stays untouched and is reference only. Providers live only under `adapters/`.

```
harbour-wallet-v3/backend/
  cmd/                  api, rpc-gateway, webhook-ingest, indexer,
                        tx-tracker, price-poller, realtime-bridge, notifier
  internal/core/        interfaces + ActivityEvent; no provider imports
    rpc/ chain/ index/ price/ risk/ meta/ notify/
  internal/registry/    name -> constructor; adapters register in init()
  internal/indexer/     consumes ActivityEvent only
  internal/store/       sqlc queries (query/*.sql), chain-agnostic schema
  internal/api/         chi handlers, device signatures, quotas
  adapters/
    rpc/alchemy  rpc/infura  rpc/quicknode
    chains/evm   (later chains/solana, chains/bitcoin, chains/tron)
    sources/alchemy   (later sources/goldsky, sources/node)
    prices/coingecko  prices/alchemy
    risk/alchemy  meta/alchemy  notify/webpush  notify/fcm
  config/chains.yaml    chains, families, upstreams, sources, finality
  config/providers.yaml provider names, key refs, budgets, priority
  contracttest/         one shared suite per interface
  migrations/  deploy/
```

**Libraries.** `chi` router, `pgx` driver, `sqlc` for typed queries, `nats.go` with JetStream, `go-redis`, `go-ethereum` for ABI and RLP, OpenTelemetry for traces, `slog` for logs.

**Run.** Local: Docker Compose with Postgres, Redis, NATS and Centrifugo. Production at first: managed Postgres (with `pg_partman` available), managed Redis, containers on a managed platform (ECS, Cloud Run or Fly), NATS and Centrifugo as containers. Move to Kubernetes when there are more services than people to deploy them by hand.

**Observe.** Per upstream: request rate, error rate, p50/p90/p99 latency, block lag, budget used. Per indexer: webhook lag (block time to row written), backfill queue depth, reorgs repaired, reconcile mismatches. Alert on: any chain with all upstreams unhealthy, webhook lag over a few minutes, reconcile mismatch rate rising.

**Security.** Provider keys only in the secret store, rotated on a schedule. Webhook endpoints verify signatures and can allow-list Alchemy's egress IPs. Rate-limit per device in Redis. Postgres reachable only from the private network; least-privilege roles per service (the API role can't write facts). No keys or seeds anywhere on the server, by design.

## Build plan

Ethereum and Base first, end to end, in `harbour-wallet-v3/backend`; other chains follow as adapters and config. Each phase ends with something the extension can use and a test that proves it.

1. **Foundations.** Go module, core interfaces and registry, `chains.yaml` and `providers.yaml`, migrations (`event_keys`, partitioned facts, hash-partitioned activity), device registration with Ed25519 keys, proof-of-work and quotas, Compose stack, CI with `depguard`. Exit: the extension registers a device and makes a signed call; contract-test suites exist for every interface.
2. **RPC gateway.** Alchemy and Infura `rpc.Upstream` adapters (third provider added here if keys exist), scoring, failover, budgets, finality-aware cache, hedging for user-facing calls only, metrics. Exit: disabling one provider's key under load causes zero failed reads.
3. **Indexer, backfill and balances.** Alchemy `index.Source` adapter, capped backfill with on-demand older pages, deny-list, balance refresh from chain via Multicall3, spam scoring. Exit: a new wallet's balances match the chain exactly, including a rebasing token and native balance after gas.
4. **Indexer, live and gap-fill.** Webhook ingest, NATS keyed by address, `event_keys` dedupe, gap-fill, reorg repair, per-chain finality. Exit: replaying every webhook twice changes nothing, and stopping ingest for 30 minutes loses nothing once it restarts.
5. **Read API and prices.** `/v1/me/*` endpoints, Redis caching, CoinGecko `price.Source` with Alchemy fallback, liquidity flags, daily snapshots, NFT media proxy. Exit: the home, history and NFT screens make no RPC calls.
6. **Send path and realtime.** Estimate, simulate, broadcast, `tx-tracker`, Centrifugo with broker, Web Push. Exit: a send goes from pending to confirmed in the popup without a refresh.
7. **Hardening on AWS.** Deploy (RDS, ElastiCache, ECS Fargate), load test at the capacity target, chaos test (a provider down, NATS restart, Postgres failover), restore from backup, security review, runbooks. Exit: RPO under 5 minutes and RTO under 1 hour demonstrated.
8. **More chains.** Arbitrum and other EVM chains as config; Solana, Bitcoin and TRON as `chain.Client` and `index.Source` adapters that pass the contract tests.

**Decisions taken.** Base as the first L2, AWS for hosting, a third RPC provider (QuickNode or Chainstack), CoinGecko for prices with Alchemy as fallback; reasons in Decisions below. Still to confirm: CoinGecko's licence covers showing prices in a commercial wallet.

## Audit

All 14 findings from the audit are now fixed in the sections above. This table records what changed and where, so a reviewer can check each fix.

| # | Severity | Finding | Fixed in |
| --- | --- | --- | --- |
| 1 | Critical | Balances computed from transfers break for gas, L2 fees and rebasing tokens | Indexer (balance refresh from chain via Multicall3); Database (`balances` written only from chain reads) |
| 2 | Critical | Webhook retries last \~10 minutes, so outages lose history | Indexer (gap-fill path, full gap-fill after ingest downtime) |
| 3 | Critical | Anyone can track any address and burn the provider budget | API (proof-of-work, quotas); Indexer (backfill cap, deny-list) |
| 4 | Critical | Partitioned unique key includes `block_time`, so reorged events duplicate | Indexer and Database (`event_keys` dedupe table) |
| 5 | High | Time-partitioned activity makes history queries touch every month | Database (`address_activity` hash-partitioned by address) |
| 6 | High | Parallel consumers can apply older balances after newer ones | Indexer (NATS keyed by address, `as_of_block` guard); Realtime (client ignores older updates) |
| 7 | High | Hedging and frequent reconcile double provider spend | RPC layer (hedging only for user-facing calls); Indexer (trigger-driven refresh, daily sweep) |
| 8 | High | One finality depth for all chains | Indexer (`FinalityPolicy` per chain from the `finalized` tag) |
| 9 | Medium | Portfolio chart has no history before tracking | Database (charts start on tracking day; optional 30-day backfill later) |
| 10 | Medium | Server links addresses into wallets, a privacy risk | Database (no wallet groups, encrypted `device_addresses`); API (grouping stays in the extension, logs without addresses) |
| 11 | Medium | NFT media loaded from arbitrary URLs | API (server-side media proxy, re-encoded images) |
| 12 | Medium | No capacity, recovery or test targets | Database (capacity target, RPO and RTO); Build plan (exit tests per phase); Modular design (contract tests) |
| 13 | Low | Centrifugo and Redis single nodes | Realtime (broker from day one, managed Redis with replica) |
| 14 | Low | Simulation and risk provider unspecified | API (`risk.Simulator`, Alchemy first) |

Also fixed while doing this: device auth now uses an Ed25519 key per install instead of a shared HMAC secret, so a database leak can't forge requests; headers are Harbour's own (`X-HB-*`); the price source and third RPC provider are decided.

## Decisions

| Decision | Recommendation | Why | When to revisit |
| --- | --- | --- | --- |
| First L2 | **Base** | Leads Arbitrum on TVL ($14.9B vs $10.1B), daily active addresses (343k vs 106k) and transactions (growthepie, Oct 27, 2026); OP Stack, so Optimism and other OP chains follow with config. Arbitrum second. | If your users are mostly on another L2 (check your own analytics or Trust Wallet usage in your market). |
| Hosting | **AWS**: RDS Postgres (supports `pg_partman` and `pg_cron`), ElastiCache Redis, ECS Fargate containers, then EKS. | Alchemy and Infura run mostly on AWS (lower latency to providers), the most managed options, the easiest hiring. GCP (Cloud SQL, Cloud Run) is the close second; avoid Fly or Railway for the database tier. | If your team already runs GCP well, stay there. |
| Third RPC provider | **Add now, for reads only on the busiest chains**: QuickNode or Chainstack on a small plan, plus public endpoints as last resort for non-critical reads. | Alchemy and Infura outages both happen; two providers means one bad day takes you to zero headroom. The cost is small next to support load from a wallet that can't show balances. | Check after phase 7 load tests whether it was ever used. |
| Price source | **CoinGecko** as the primary (Analyst or Lite plan; DEX prices via its onchain data), Alchemy Prices API as fallback, DexScreener or GeckoTerminal for long-tail tokens. | CoinGecko covers the most tokens and has history back to 2013 for majors and 2021 for DEX pools. Confirm its license allows showing prices to end users in a commercial wallet; full redistribution needs its Enterprise licence. | If price API spend grows past an enterprise contract's price, negotiate one with CoinGecko or CoinMarketCap. |

**Price service rule.** Never call a price provider per user request. One `price-poller` fetches prices for tokens anyone holds, every 30–60 seconds for the top few thousand and every few minutes for the long tail, writes Redis and `price_ticks`, and flags prices whose liquidity is too thin to trust (show “no price” rather than a fake $1M balance from an illiquid pool).

## Sources

- [Alchemy: Address Activity webhook](https://www.alchemy.com/docs/reference/address-activity-webhook)
- [Alchemy: Webhooks overview](https://www.alchemy.com/docs/reference/webhooks-overview)
- [Alchemy: Transfers API](https://www.alchemy.com/docs/reference/transfers-api-quickstart)
- [Alchemy: Portfolio APIs](https://www.alchemy.com/docs/reference/portfolio-apis)
- [Alchemy: Prices API](https://www.alchemy.com/docs/reference/prices-api-quickstart)
- [Hookdeck: Alchemy webhooks guide (signatures, retries, delivery)](https://hookdeck.com/webhooks/platforms/guide-to-alchemy-webhooks-features-and-best-practices)
- [eRPC: how it works](https://docs.erpc.cloud/use-cases/how-it-works)
- [Percona: time-based partitioning with pg\_partman](https://www.percona.com/blog/postgresql-partitioning-made-easy-using-pg_partman-timebased/)
- Trust Wallet's request signing and Centrifugo channels: Harbour's own REA findings in [Harbour Redesign](https://claude.ai/artifact/WZh8S5DcV2H8sjxS5NGwBY)

* [growthepie: Base vs Arbitrum (Oct 27, 2026)](https://www.growthepie.com/answers/base-vs-arbitrum)
* [CoinGecko API plans](https://www.coingecko.com/en/api/pricing)
