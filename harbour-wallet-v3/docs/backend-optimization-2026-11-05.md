# Backend optimization (branch `backend-optimization`, 2026-11-05)

Goal: cut provider spend (Alchemy CU / Infura credits), Postgres writes and idle work in `harbour-wallet-v3/backend`
without changing API behaviour. Background and the full list of findings: project doc
`claude/v3-backend-optimization-2026-11-05.md`.

## What changed

| Area | Before | After | Where |
|---|---|---|---|
| Head tracking | every upstream (chain x key) polled `eth_blockNumber` every max(block time, 4 s), plus `finalized` every 30 s as a second call | one upstream per chain (best score) follows the head; others probed every 30 s; latest + finalized in one batch; idle chains (no request for 10 min) poll every 60 s | `internal/gateway/pool.go`, `internal/rpchttp` |
| `eth_blockNumber`, `eth_chainId` | sent upstream (cached one block) | answered from head tracking / `chains.yaml` | `internal/gateway/gateway.go` |
| Rate budgets | one bucket per chain x key (a 25 rps key could run at 25 x chains) | one bucket per provider key, shared by every chain | `gateway.New`, `config.ResolvedUpstream.BudgetKey` |
| Duplicate reads | each concurrent identical read went upstream | coalesced into one call (session-pinned calls excluded) | `internal/gateway/flight.go` |
| Scoring CPU | sort of 200 samples per call per member | percentiles cached 250 ms; breaker uses sort-free counts | `internal/gateway/health.go` |
| Spend visibility | none per method | `hb_upstream_calls_total{chain,provider,method}` | `internal/gateway/metrics.go` |
| Gap-fill | every 3 min: every address added or active in 7 days, 2 Transfers calls each, per chain | 3 min: addresses not on a webhook; 30 min: subscribed + active/added in 24 h; daily: all subscribed; ingest downtime: all | `internal/indexer/live.go`, `store.GapFillCandidates` |
| Idle chains | heads read (2 RPC) per chain every repair (1 min) and gap-fill pass | heads read only when there is work | `live.go` |
| Webhook sync | every 15 s per chain (3 queries) | every 5 min; new addresses still wake it | `live.go` |
| Ingest | 4-6 sequential statements per event | 4 pipelined batches per call, one asset upsert per distinct asset | `store.IngestEvents` |
| Prices | held-asset aggregate every minute; tick upsert every poll | held list reused 5 min; one tick per asset per 5-min bucket; unchanged rows not rewritten | `internal/prices/poller.go`, `store/prices.go` |
| Snapshots | hourly upsert of every balance row | unchanged rows skipped | `store.SnapshotBalances` |
| Retention | none for `price_ticks`, `balance_snapshots` | `migrate -maintain`: ticks 5-min for 7 days, hourly to 90 days, then daily; snapshots 400 days | `store.PruneTimeSeries` |
| Device touch | `UPDATE devices` on every signed request | at most every 5 min per device per process | `internal/api/auth.go` |
| Daily quota | INCRBY + EXPIRE (+ DECRBY): 2-3 round trips | one Lua call | `auth.go` |
| `/v1/gw` | concurrent identical calls all upstream; every body copied for key scrubbing | cacheable calls coalesced; bodies copied only if they contain a key | `internal/api/gateway.go` |
| tx-tracker | DB poll every 1 s forever | 1 s while work is due, 5 s idle | `internal/txtrack` |
| Test race | `Debouncer.Flush` could return while a timer-claimed refresh was still running (TestNewWalletMatchesChain flake) | Flush waits for it | `internal/indexer/indexer.go` |

## Verification

- `go vet`, build, all unit tests, and integration tests (api, indexer, prices, store, gateway) against the Compose
  Postgres/Redis: all pass. Indexer/store/prices integration ran 6 times in a row: 6/6.
- New tests: `gateway_opt_test.go` (follower-only polling, batched head, local answers, shared budget across chains,
  coalesced reads) and `store/optimize_test.go` (gap-fill scopes, batched ingest semantics, pruning).
- Live smoke against Sepolia / Base Sepolia (real keys from `.env`): in the first 65 s Base Sepolia made 17 head calls and
  Sepolia 8 (the old loop makes about 40 and 18 for the same 2 upstreams), `eth_blockNumber` x5 and `eth_chainId` were answered locally (0 upstream calls),
  `eth_getBalance` went upstream once.

## Rough effect at the full MVP chain set (all of chains.yaml)

- Idle head polling: about 50 Alchemy + 42 Infura upstreams polling every 4 s become one follower per chain plus a
  30 s probe; roughly 70-85 % fewer head calls, and close to 95 % on chains nobody uses (60 s idle polling).
- Gap-fill for a new user (18 chains): from about 17,280 Transfers calls/day for 7 days to about 1,700/day on the first
  day (48 passes x 2 calls x 18 chains), then 36/day (daily pass) unless the address is active.

## Phase 2: industry-standard follow-ups (same branch)

| Change | What other wallets do | Harbour now | Where |
|---|---|---|---|
| Index only chains a wallet uses | Rabby/DeBank `used_chain_list`, Moralis "active chains", GoldRush address activity; MetaMask Accounts API with RPC fallback | Before backfilling an address on a chain, one nonce read + one multicall (+ one Transfers lookup only if both are zero). Unused addresses become `dormant`: no backfill, no gap-fill or sweeps, zero native balance stored, still on the chain's webhook. First activity (webhook or a gap-fill that includes dormant rows) promotes them to a normal backfill. `indexer.dormant_probe: true` in providers.yaml. | `indexer.probeDormant`, `store.PromoteDormant`, migration 0009 |
| NFTs only when looked at | Rainbow buys NFT data instead of listing it for every wallet; MetaMask detects in the background but shows on demand | NFT lists are no longer fetched during backfill (`getNFTsForOwner` is 480 CU per page). `/v1/me/nfts` returns `syncing: true` and asks the indexer (`address.nfts.sync`) when a list is stale; the extension polls briefly. When an NFT moves, the list is resynced at once only if it was viewed in the last 7 days, otherwise just flagged stale. | `api.requestNFTSync`, `indexer.SyncNFTsByID`, `src/core/harbour/data.ts` |
| One RPC path | One proxy layer for all RPC (eRPC model) | `/v1/gw/alchemy/{id}/rpc` keeps its audited validation but, for chains rpc-gateway serves, forwards the validated body to rpc-gateway (cache, coalescing, failover, shared budgets) instead of straight to one Alchemy key. | `api/gateway.go` (`rpcRoute`) |
| Don't store payloads twice | Coinbase ChainStorage / CoinDesk keep raw payloads out of the relational index | Parsed webhook bodies are no longer copied into `webhook_deliveries` (the 7-day JetStream stream already holds them); the row stays as the dedupe/audit record. Unparseable bodies are still kept. | `ingest.go` |
| Cache vs state Redis | Disposable caches must be allowed to evict; nonces/quotas must not | New `redis-cache` (no persistence, 256 MB, allkeys-lru) for `/v1/gw` and read caches (`REDIS_CACHE_URL`); `redis` keeps nonces, quotas, idempotency, prices with AOF. | `docker-compose.yml`, `cmd/api` |
| Connection budgets | Explicit pool sizes behind a pooler | `pool_max_conns` per service (api 10, indexer 8, prices 4, others 2). | `docker-compose.yml` |
| One image | Build once, run many roles | `migrate` builds `harbour-backend:local`; the other 8 services reuse it (was 9 identical builds). | `docker-compose.yml` |
| Realtime engine | Redis engine only for multi-node | Centrifugo runs the in-memory engine (single node). | `docker-compose.yml` |

Also fixed: month-partition cache was global per process (wrong when one process opens two databases, which made an
indexer test order-dependent); it is now per `Store`.

Decided against, with reasons:
- Skipping balance reads for spam tokens: balances are one multicall regardless of token count, so the saving is
  negligible, and a false-positive spam score would hide a token the user added.
- Pruning `event_keys`: it is the dedupe guard when old history is re-read (promotion, older pages); dropping keys
  could duplicate transfers. Revisit with a unique index on the fact tables.
- PgBouncer in the local stack: the indexer holds session advisory locks (one webhook manager) and services require
  verify-full TLS; on AWS use RDS Proxy in front of the API only.
- Merging services into fewer processes: per-service Postgres/NATS logins from the security audit are kept; the single
  image already removes the build cost.

## Still open

- Normalised address/transaction tables (ids instead of repeated hex strings): a schema migration best done before
  production data; plan separately.
- RDS Proxy (AWS) in front of the API.
