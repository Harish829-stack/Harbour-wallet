# Backend services

The backend (`harbour-wallet-v3/apps/backend`) is a set of small Go programs built from **one image**. The extension talks only to `api`; the other services work behind it. No service other than `rpc-gateway` talks to an RPC provider, and provider SDKs are only imported under `adapters/` and `cmd/` (enforced in CI).

For how to start the stack, see [how-to-run.md](how-to-run.md). For deploying it, see [deployment-railway.md](deployment-railway.md).

## Map

```
                      ┌────────── extension ──────────┐
                      │ signed HTTPS                  │ websocket
                      ▼                               ▼
                    api :8080 ──────────────────► centrifugo :8000
        ┌─────────────┼───────────┐                   ▲
        ▼             ▼           ▼                   │ publishes
  rpc-gateway    Postgres     Redis ×2         realtime-bridge ◄── NATS ◄── indexer ◄── webhook-ingest :8082
     :8081                                                  ▲        ▲           ▲            ▲
        │                                    tx-tracker ────┘  price-poller   notifier       │
        ▼                                                                                Alchemy webhooks
  Alchemy · Infura · QuickNode · Chainstack · public RPCs
```

Infrastructure: **Postgres** (source of truth), **Redis** (rate limits, nonces, price cache; a second instance `redis-cache` backs the API's response cache), **NATS JetStream** (events between services), **Centrifugo** (websocket push to the popup).

## Services

| Service (`cmd/`) | Port | Role | Talks to |
| --- | --- | --- | --- |
| `api` | 8080 (public) | Extension-facing API: device registration (Ed25519 + proof-of-work), signed requests, quotas, address tracking, allow-listed `/v1/rpc/{chain}` reads, portfolio/history/NFT/price reads, estimate/simulate/broadcast, realtime tokens, push subscriptions, the third-party gateway `/v1/gw/*` | Postgres, Redis, redis-cache, NATS, rpc-gateway, Centrifugo (token signing) |
| `rpc-gateway` | 8081 (private) | The only process that speaks JSON-RPC to providers: pools, scoring, failover, circuit breakers, per-key budgets, caching, hedging, head tracking | providers |
| `indexer` | 8083 (health) | Backfills tracked addresses, reads balances from chain (Multicall3), syncs NFTs, manages Alchemy webhooks, processes deliveries, gap-fills, repairs reorgs, finalizes rows | Postgres, NATS, rpc-gateway, Alchemy |
| `webhook-ingest` | 8082 (public) | Verifies provider webhooks (HMAC), stores the raw body for 7 days, publishes it to NATS, answers 200 at once | Postgres, NATS |
| `price-poller` | none | Prices held tokens (top 2,000 every 60 s, the rest every 5 min), caches in Redis, writes `price_ticks`, hourly balance snapshots | Postgres, Redis, NATS, CoinGecko / Alchemy |
| `tx-tracker` | none | Follows transactions broadcast through Harbour to confirmed / failed / dropped (receipt polling with backoff) | Postgres, NATS, rpc-gateway |
| `realtime-bridge` | none | Relays `balance.changed.*` and `tx.status.*` from NATS to Centrifugo channels | NATS, Centrifugo |
| `notifier` | none | Web Push for incoming transfers and settled sends; deduped per device and transaction | Postgres, Redis, NATS |
| `migrate` | none | Applies `migrations/*.sql`, creates the per-service database logins, premakes monthly partitions, thins old price ticks and snapshots. Runs to completion and exits (`-maintain`, daily) | Postgres |

Developer tools, not deployed: `hbdevice` (acts like the extension from a terminal: `register`, `me`, `list`, `addresses`, `get`, `rpc`, `send`, `watch`), `hbkeys` (`hbkeys vapid` prints a Web Push key pair), `hbverify` (stored balances vs an independent chain read at the same block).

## `api`

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /v1/devices/challenge`, `POST /v1/devices` | none / PoW + key possession | register a device: `{public_key, challenge, pow_counter, signature}` returns `device_id` |
| `GET /v1/me`, `GET/PUT /v1/me/addresses` | signed | device, tier, quotas; tracked addresses (`PUT` takes `Idempotency-Key`, is quota-checked, publishes `address.added`) |
| `POST /v1/rpc/{chain}` | signed | allow-listed read methods only (list in `config/api.yaml`), per-device rate limit |
| `GET /v1/me/portfolio`, `/portfolio/chart`, `/history`, `/nfts` | signed | served from the database and Redis, never from a live chain call |
| `GET /v1/assets/{chain}/{asset}` and `/prices` | signed | asset metadata and price history |
| `GET /v1/tx/{chain}/{hash}` | signed | `transactions`, then `pending_transactions`, then the chain |
| `POST /v1/tx/{chain}/estimate`, `/simulate`, `/broadcast` | signed | nonce, gas and EIP-1559 fees; simulation with predicted asset changes and warnings; relay of a **client-signed** raw transaction |
| `POST /v1/realtime/token` | signed | Centrifugo connection token plus one subscription token per tracked address and pending transaction |
| `GET /v1/push/vapid` (unsigned), `PUT/DELETE /v1/me/push` | mixed | Web Push subscription |
| `GET/POST /v1/gw/*` | signed | the extension's route to third-party APIs (LI.FI, Uniswap, Jupiter, Relay, Pimlico, CoinGecko, Helius, Etherscan, TronGrid, TON Center, Alchemy). **The keys live only here** and the request body is validated before it is forwarded |
| `/v1/swap/*`, `/v1/earn/*` | signed | swap and earn services: quotes and unsigned transaction plans from the providers' official APIs (see [swap-earn-services.md](swap-earn-services.md)) |
| `GET /v1/media/{key}` | none (for `<img>`) | NFT image proxy: server-side fetch, refuses private addresses, PNG/JPEG/GIF/WebP only, downsized to 512 px, re-encoded, cached 24 h |
| `GET /healthz` | none | liveness |

**Request signing.** Headers `X-HB-Device`, `X-HB-Date` (unix seconds), `X-HB-Nonce`, `X-HB-Signature`. The signature is Ed25519 over `HB1\nMETHOD\npath?query\ndate\nnonce\ndevice\nhex(sha256(body))`, base64url. Nonces are single-use (Redis), clock skew is 5 minutes. The extension side is `apps/extension/src/core/harbour/` (and `clients/ts/hbclient.ts` for scripts). Error codes: `device_unknown` (client re-registers), `device_revoked`, `unauthorized`.

**Quotas.** Tiers `default`, `probation` (a new device's first 24 h), `trusted` in `config/api.yaml`: maximum tracked addresses, backfills per day, and requests / RPC / gateway calls per minute. Registration is also capped per IP (IPv6 by /64) and globally per hour.

**Proxy headers.** `X-Forwarded-For` is trusted only from `TRUSTED_PROXY_CIDRS` and only when `TRUST_PROXY_HEADERS=1` (set it behind a load balancer such as Railway's).

## `rpc-gateway`

`POST /rpc/{chain}` (single or batch), `GET /status`, `/metrics` (Prometheus), `/healthz`. It refuses to start without `GATEWAY_INTERNAL_TOKEN`; `api`, `indexer` and `tx-tracker` send it as a bearer token.

- **Routing:** weighted random over healthy upstreams, scored by error rate, p90 latency and block lag over a sliding window.
- **Failover:** timeouts, 401/403/429/5xx and "header not found" move to the next upstream; deterministic errors (revert, bad params, nonce too low) return immediately.
- **Circuit breaker:** opens at 50 % errors over 10+ samples or 5 consecutive failures; half-open probe after 30 s.
- **Budgets:** one token bucket per provider key (`rps` in `providers.yaml`), shared by every chain that key serves.
- **Coalescing and cache:** identical in-flight reads share one call; finalized results are cached, `latest` for one block time, `pending` never.
- **Hedging:** only for `X-HB-Priority: user`, after the upstream's p90.
- **Sends:** `eth_sendRawTransaction` goes to two upstreams at once; "already known" counts as success. `X-HB-Session` pins estimate, nonce and send to one upstream.
- **`eth_getLogs`:** background ranges over `logs_max_range` are split and merged; user-facing calls are never split.
- **Head tracking:** one follower per chain polls every block; idle chains poll every 60 s.
- **Errors:** one shape when it gives up: `error.data = {code, retryable, upstreamsTried}`.

Tuning values are in `config/providers.yaml` under `gateway:`.

## `indexer`

- **Trigger:** `PUT /v1/me/addresses` creates a `pending` tracked address and publishes `address.added`; the indexer wakes on it and also polls every 30 s.
- **Backfill:** history from the Alchemy Transfers API, newest first, capped at 90 days or 5,000 transfers (`indexer:` in `providers.yaml`). Exchange hot wallets and big contracts (`backfill_deny_list`) are tracked live but never backfilled. Older pages load on demand.
- **Writes:** `event_keys` first, in the same transaction as each fact row; a conflict means duplicate and nothing else is written, so replays and retries change nothing.
- **Balances:** never summed from transfers. Native plus every known token is read from chain with Multicall3 at one block and written only over an older `as_of_block`.
- **Spam:** tokens get a 0-100 spam score (URL or "claim" bait, look-alike letters, missing decimals); nothing is deleted, the UI hides scores of 50 or more.
- **Webhooks:** one Address Activity webhook per chain pointing at `WEBHOOK_PUBLIC_URL/webhooks/alchemy`, addresses added in batches of 500, another webhook opened past 100,000 addresses. Needs `ALCHEMY_NOTIFY_TOKEN`; a Postgres advisory lock keeps it to one replica at a time.
- **Gap-fill:** webhooks are the live path; gap-fill re-reads from `last_seen_block` every 3 minutes for addresses not on a webhook yet, every 30 minutes for recently active ones, daily for all. With no `WEBHOOK_PUBLIC_URL` the 3-minute pass is the live path. After `webhook-ingest` downtime, `chain.gapfill` triggers a full gap-fill.
- **Reorgs and finality:** every minute, rows at or below the chain's `finalized` block become `finalized`; newer rows are compared against the canonical block hash and repaired or removed.

## Event bus and realtime

| NATS subject | Published by | Consumed by |
| --- | --- | --- |
| `address.added`, `address.history.more`, `address.nfts.sync` | api, indexer | indexer |
| `chain.<chain>.activity.raw`, `chain.gapfill` | webhook-ingest | indexer |
| `balance.changed.<chain>` | indexer | realtime-bridge |
| `activity.new.<chain>` | indexer | notifier |
| `tx.status.<chain>` | tx-tracker | realtime-bridge, notifier |

Centrifugo channels are `balances:<chain>.<address>` and `tx:<chain>.<hash>`. Clients can only subscribe to channels the API signed a token for. NATS has one login per service with subject permissions (`deploy/nats/nats.conf`).

## Configuration

| File | Holds |
| --- | --- |
| `config/chains.yaml` | one entry per EVM chain: id, block time, finality policy, native coin, upstream list with weights, indexer source, price ids, simulator. See [chains-and-providers.md](chains-and-providers.md) |
| `config/providers.yaml` | provider keys and rps budgets, indexer sources, price source order, risk simulator, gateway tuning, push channels |
| `config/api.yaml` | device tiers and quotas, proof-of-work difficulty, RPC allow-list, backfill deny-list |
| `.env` (from `.env.example`) | secrets and wiring; generated by `scripts/setup.sh`; never committed |

Environment variables are documented inline in `apps/backend/.env.example`. A secret setting `NAME` can instead be given as `NAME_FILE` (a mounted secret file). This applies to names ending in `_KEY`, `_KEYS`, `_SECRET`, `_PASSWORD`, `_TOKEN`, `_URL`, `_USERS`, `_JSON`, `_SIG` or `_SUBJECT` (optionally numbered) and to `PG_PW_*` / `NATS_PW_*`; other `*_FILE` variables, such as `FCM_CREDENTIALS_FILE`, are plain paths and are left alone. `ENABLED_CHAINS` limits what a deployment serves (empty means every chain in `chains.yaml`). Config files carry no secrets.

## Data

Migrations live in `apps/backend/migrations/` (`0001_init.sql` onward) and are applied by `migrate`.

- `event_keys` (unpartitioned dedupe), `transactions` and `transfers` range-partitioned by month (pg_partman when installed, otherwise `harbour_ensure_monthly_partitions`), `address_activity` hash-partitioned x32, `NUMERIC(78,0)` amounts.
- Only `migrate` uses the owner role. Services log in as `harbour_<service>` users that belong to the data-access-only role `harbour_app`; no DDL, no superuser.
- `device_addresses` stores an AES-256-GCM-encrypted address link plus an HMAC blind index. `push_routes` is keyed by an HMAC of the tracked-address id. No wallet grouping, no addresses in logs. Settled sends lose their device link after 1 hour and are deleted after 30 days.
- Postgres connections must be `verify-full` (see the exception for Railway in [deployment-railway.md](deployment-railway.md)).

## Docker images

`apps/backend/Dockerfile` has three stages: `build`, `local` (distroless, all binaries; Compose builds it) and `railway` (the default, one binary per container chosen by the `SERVICE` variable through `docker-entrypoint.sh`). `.dockerignore` keeps `.env`, certificates and `.hbdevice.json` out of the build. NATS, Centrifugo and the cache Redis have small Dockerfiles under `deploy/`.

## Extending the backend

| To add | Do |
| --- | --- |
| An RPC key, or a provider reachable by a full URL | a key in `providers.yaml` plus an env var, then reference it from `chains.yaml`. No code |
| A provider with its own URL scheme or auth | a package under `adapters/rpc/<name>` that registers itself in `init()`, imported by `adapters/rpc/all`, tested with `contracttest.RunUpstream` |
| An EVM chain | one entry in `chains.yaml` (see [chains-and-providers.md](chains-and-providers.md)) |
| A non-EVM family, indexer source, price source, simulator, metadata source or push channel | an adapter under `adapters/<kind>/<name>` that passes the shared suite in `contracttest/` |

Not built yet: native push channels beyond Web Push (add an adapter under `adapters/notify`), non-EVM send paths on the backend, sqlc generation (queries are hand-written pgx in `internal/store`).
