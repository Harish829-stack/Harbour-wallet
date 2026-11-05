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
- Live smoke against Sepolia / Base Sepolia (real keys from `.env`): 65 s after start Base Sepolia made 17 head calls
  (2 upstreams; previously about 36), `eth_blockNumber` x5 and `eth_chainId` were answered locally (0 upstream calls),
  `eth_getBalance` went upstream once.

## Rough effect at the full MVP chain set (all of chains.yaml)

- Idle head polling: about 50 Alchemy + 42 Infura upstreams polling every 4 s become one follower per chain plus a
  30 s probe; roughly 70-85 % fewer head calls, and close to 95 % on chains nobody uses (60 s idle polling).
- Gap-fill for a new user (18 chains): from about 17,280 Transfers calls/day for 7 days to about 1,700/day on the first
  day (48 passes x 2 calls x 18 chains), then 36/day (daily pass) unless the address is active.

## Not done here (needs a product or infra decision)

- Index only the chains an address uses (needs extension + API change; product rule).
- Restrict balance reads / NFT sync to native + user-added assets (product rule).
- Route `/v1/gw/alchemy/{id}/rpc` through rpc-gateway (security-audited path; extension should move to `/v1/rpc`).
- BYTEA hashes/addresses migration; PgBouncer; split cache vs nonce Redis; fewer deployables.
- Alchemy key in `.env` fails on Sepolia/Base Sepolia (every call retryable); Infura serves everything. Check the key.
