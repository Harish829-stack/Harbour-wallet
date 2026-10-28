# Harbour backend

Go services for Harbour Wallet, built to `../Harbour Backend Go Services, Indexer and RPC Plan.md`.
This tree holds **phases 1–2**: foundations and `rpc-gateway`. The indexer, read API, prices and realtime (phases 3–6) plug into the interfaces that already exist here.

## Quick start

`./run.sh` does everything below in one step: it checks Docker, creates `.env` and secrets, builds and starts the stack, and waits until the API and gateway are healthy. `./run.sh help` lists `smoke`, `status`, `logs`, `test`, `restart`, `down` and `reset`.

```bash
cd harbour-wallet-v3/backend
make setup     # creates .env from .env.example and generates local secrets
               # then put your Alchemy / Infura keys in .env
make deps      # go mod tidy (once: fills go.sum lines for golang.org/x modules)
make up        # Postgres(+pg_partman), Redis, NATS, Centrifugo, migrate, rpc-gateway, api
make smoke     # register a device, make signed calls, read Base and Ethereum through the gateway
make test      # unit, gateway and contract tests (no services needed)
make test-integration   # phase 1 exit test against the Compose Postgres and Redis
make lint      # golangci-lint v2 with depguard, plus the provider-name check
```

## What runs

| Binary | Port | Role |
| --- | --- | --- |
| `api` | 8080 | Extension-facing API. Device registration (Ed25519 + proof-of-work), signed requests, quotas, address tracking, `/v1/rpc/{chain}` allow-listed reads |
| `rpc-gateway` | 8081 (private) | The only process that talks to providers. Pools, scoring, failover, budgets, cache, hedging, metrics |
| `migrate` | – | Applies `migrations/*.sql`; `-maintain` premakes monthly partitions (run daily) |
| `hbdevice` | – | Acts like the extension from a terminal (dev only) |

## API (phase 1)

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /v1/devices/challenge` | none | Proof-of-work challenge; 30/hour per IP |
| `POST /v1/devices` | PoW + key possession | `{public_key, challenge, pow_counter, signature}` → `device_id` |
| `GET /v1/me` | signed | Device, tier, quotas, chains |
| `GET /v1/me/addresses` | signed | Decrypted list of this device's tracked addresses |
| `PUT /v1/me/addresses` | signed, `Idempotency-Key` | `{add:[{chain,address}], remove:[…]}`; quota-checked; publishes `address.added` |
| `POST /v1/rpc/{chain}` | signed | Allow-listed read methods only, per-device RPC rate limit, forwarded as user-facing |

Signing: `X-HB-Device`, `X-HB-Date` (unix s), `X-HB-Nonce`, `X-HB-Signature` = Ed25519 over
`HB1\nMETHOD\npath?query\ndate\nnonce\ndevice\nhex(sha256(body))`, base64url. Nonces are single-use (Redis).
The extension side is `clients/ts/hbclient.ts` (WebCrypto Ed25519, sync SHA-256 for the PoW); `node --experimental-strip-types clients/ts/smoke.ts` runs it against a local API.

## rpc-gateway

`POST /rpc/{chain}` (single or batch). Headers: `X-HB-Priority: user` allows hedging; `X-HB-Session` pins an estimate→nonce→send sequence to one upstream. `GET /status` (JSON per upstream), `/metrics` (Prometheus), `/healthz`. Set `GATEWAY_INTERNAL_TOKEN` to require a bearer token.

- **Routing**: weighted random over healthy upstreams; score = weight × (1−error rate)² ÷ (1 + p90/250 ms) ÷ (1 + block lag/2), over a sliding window.
- **Failover**: retryable (timeout, 401/403/429/5xx, "header not found", null block the pool has) moves on; deterministic (revert, invalid params, nonce too low) returns at once.
- **Circuit breaker**: opens at ≥50 % errors over ≥10 samples or 5 consecutive failures; half-open probes after 30 s. Head polling doubles as the probe, so a revoked key is detected without traffic.
- **Budgets**: token bucket per key (`rps` in `providers.yaml`); load sheds to the next key before the provider returns 429.
- **Cache**: finalized-block results forever (LRU), `latest` for one block time, `pending` never.
- **Hedging**: only for `X-HB-Priority: user`, after the upstream's p90 (50 ms–2 s). Background calls never hedge.
- **Sends**: `eth_sendRawTransaction` goes to two upstreams at once; "already known" counts as success.
- **eth_getLogs**: ranges over `logs_max_range` are split, run 4 at a time, merged in order.
- **Errors**: one shape when the gateway gives up: `error.data = {code, retryable, upstreamsTried}`.

The plan suggests eRPC; its module graph can't be vendored here, so the gateway implements the same design in-process (`internal/gateway`). Swapping in eRPC later only changes `cmd/rpc-gateway`.

## Adding things

| To add | Do |
| --- | --- |
| An RPC key or provider with a full URL | `providers.yaml` key + env var, reference it from `chains.yaml`. No code. |
| A provider with its own URL scheme or auth | Package under `adapters/rpc/<name>` registering in `init()`, import it in `adapters/rpc/all`, run `contracttest.RunUpstream` from its test |
| An EVM chain | One entry in `chains.yaml` |
| A non-EVM family, indexer source, price source, simulator, metadata or push channel | Adapter under `adapters/<kind>/<name>` passing the shared suite in `contracttest/` |

Rules enforced in CI: depguard (`.golangci.yml`) blocks adapter and provider-SDK imports outside `adapters/` and `cmd/`; `scripts/check-provider-names.sh` blocks provider names in service code. The workflow is `ci/backend.yml`; copy it to the repository's `.github/workflows/`.

## Database

`migrations/0001_init.sql`: chain-agnostic schema from the plan. `event_keys` (unpartitioned dedupe), `transactions`/`transfers` range-partitioned by month (pg_partman when installed, otherwise `harbour_ensure_monthly_partitions`), `address_activity` hash-partitioned ×32, `NUMERIC(78,0)` amounts, and least-privilege roles `harbour_api` (can't write facts) and `harbour_indexer`. `device_addresses` stores an AES-256-GCM-encrypted link plus an HMAC blind index; no wallet grouping and no addresses in logs.

## Not in this phase

NATS publishing (`address.added` is logged until phase 3), Centrifugo tokens (phase 6), sqlc generation (queries are hand-written pgx in `internal/store`; switch when the indexer adds bulk queries).
