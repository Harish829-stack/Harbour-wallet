# Deploying Harbour v3 to Railway

Written 2026-11-06 for the `codebase-structuring` layout. What is verified and what is not is listed at the end: read that first if this is your first deploy.

## What goes on Railway, and what does not

The **backend** goes on Railway: nine Go services plus Postgres, two Redis, NATS and Centrifugo (14 Railway services in one project). The **Chrome extension is not hosted anywhere**: you build it, point it at the API's public URL, and upload the signed zip to the Chrome Web Store (see `release.md`).

| Railway service | Source (Root Directory) | Config file (config-as-code path) | Public domain | Port |
| --- | --- | --- | --- | --- |
| `Postgres` | Railway database template (Postgres 16) | – | no | 5432 |
| `Redis` | Railway database template | – | no | 6379 |
| `redis-cache` | `harbour-wallet-v3/apps/backend/deploy/redis-cache` | `/harbour-wallet-v3/infra/railway/redis-cache.toml` | no | 6379 |
| `nats` | `harbour-wallet-v3/apps/backend/deploy/nats` (+ volume at `/data`) | `/harbour-wallet-v3/infra/railway/nats.toml` | no | 4222 |
| `centrifugo` | `harbour-wallet-v3/apps/backend/deploy/centrifugo` | `/harbour-wallet-v3/infra/railway/centrifugo.toml` | yes (wss) | 8000 |
| `migrate` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/migrate.toml` | no | – |
| `rpc-gateway` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/rpc-gateway.toml` | no | 8081 |
| `api` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/api.toml` | **yes** | 8080 |
| `indexer` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/indexer.toml` | no | 8083 |
| `webhook-ingest` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/webhook-ingest.toml` | **yes** | 8082 |
| `price-poller` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/price-poller.toml` | no | – |
| `tx-tracker` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/tx-tracker.toml` | no | – |
| `realtime-bridge` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/realtime-bridge.toml` | no | – |
| `notifier` | `harbour-wallet-v3/apps/backend` | `/harbour-wallet-v3/infra/railway/notifier.toml` | no | – |

Every Go service (including `migrate` and `rpc-gateway`) uses the **same Dockerfile** (`apps/backend/Dockerfile`, last stage `railway`). The `SERVICE` variable on each Railway service picks the binary (`api`, `rpc-gateway`, `indexer`, `webhook-ingest`, `price-poller`, `tx-tracker`, `notifier`, `realtime-bridge`, `migrate`). Service names matter: the private hostnames below are `<service name>.railway.internal`.

## Steps

1. Push `codebase-structuring` (or merge it) to GitHub and create a Railway project from the repo.
2. Add the databases: `Postgres` and `Redis` from Railway's database templates.
3. For every other row of the table: **New service → GitHub repo**, then Settings → **Root Directory** as in the table, Settings → **Config as code → file path** as in the table, and set the variables below. Do not generate a public domain unless the table says yes.
4. Project-level **Shared Variables** (Project settings → Shared Variables): create the secrets once and reference them as `${{shared.NAME}}`. Generate each with `openssl rand -hex 16` (32 for `ADDRESS_LINK_ENCRYPTION_KEY`, `CENTRIFUGO_TOKEN_HMAC_SECRET`; 24 for `GATEWAY_INTERNAL_TOKEN`, `CENTRIFUGO_API_KEY`):
   `REDIS_PASSWORD`, `NATS_PASSWORD`, `NATS_PW_API`, `NATS_PW_INDEXER`, `NATS_PW_WEBHOOK`, `NATS_PW_PRICES`, `NATS_PW_TXTRACK`, `NATS_PW_REALTIME`, `NATS_PW_NOTIFIER`, `PG_PW_API`, `PG_PW_INDEXER`, `PG_PW_WEBHOOK`, `PG_PW_PRICES`, `PG_PW_TXTRACK`, `PG_PW_NOTIFIER`, `POSTGRES_APP_PASSWORD`, `GATEWAY_INTERNAL_TOKEN`, `ADDRESS_LINK_ENCRYPTION_KEY`, `CENTRIFUGO_TOKEN_HMAC_SECRET`, `CENTRIFUGO_API_KEY`.
   Provider keys (`ALCHEMY_API_KEY`, `INFURA_API_KEY`, `COINGECKO_API_KEY`, `LIFI_API_KEY`, …) are shared variables too. `apps/backend/.env.example` lists all of them.
5. Deploy order: databases, `nats`, `redis-cache`, `centrifugo`, then **`migrate`** (wait until its deployment shows it finished without error), then everything else. The other services restart on failure, so a wrong order self-heals once `migrate` has succeeded.
6. Give `api` and `webhook-ingest` a public domain; give `centrifugo` one too. Set `WEBHOOK_PUBLIC_URL` (on `indexer`) to the `webhook-ingest` URL and `REALTIME_PUBLIC_URL` (on `api`) to `wss://<centrifugo domain>/connection/websocket`.
7. Build the extension against the API: `VITE_HB_API_URL=https://<api domain>` in `apps/extension/.env.production` (the build refuses `http://` except for localhost).

## Variables per service

`SERVICE` and `PORT` as in the table; `PORT` must equal the port the service listens on (Railway health checks and the public domain use it). Common to every Go service: `APP_ENV=production`, `LOG_LEVEL=info`, `ENABLED_CHAINS` (empty = every chain in `config/chains.yaml`).

Database-connected services (`migrate`, `api`, `indexer`, `webhook-ingest`, `price-poller`, `tx-tracker`, `notifier`) also need `HB_ALLOW_INSECURE_DB=1` (see "Known trade-off").

| Service | Variables |
| --- | --- |
| `migrate` | `POSTGRES_URL=postgres://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}?sslmode=require`, `POSTGRES_APP_USER=harbour_svc`, `POSTGRES_APP_PASSWORD=${{shared.POSTGRES_APP_PASSWORD}}`, `POSTGRES_SERVICE_USERS=harbour_api:${{shared.PG_PW_API}},harbour_indexer:${{shared.PG_PW_INDEXER}},harbour_webhook:${{shared.PG_PW_WEBHOOK}},harbour_prices:${{shared.PG_PW_PRICES}},harbour_txtrack:${{shared.PG_PW_TXTRACK}},harbour_notifier:${{shared.PG_PW_NOTIFIER}}` |
| `rpc-gateway` | `GATEWAY_ADDR=:8081`, `GATEWAY_INTERNAL_TOKEN`, `ALCHEMY_API_KEY`, `ALCHEMY_API_KEY_2`, `INFURA_API_KEY`, `INFURA_API_SECRET`, `INFURA_API_KEY_2`, `QUICKNODE_ETH_URL`, `QUICKNODE_BASE_URL`, `CHAINSTACK_ETH_URL`, `CHAINSTACK_BASE_URL` |
| `api` | `API_ADDR=:8080`, `POSTGRES_URL=postgres://harbour_api:${{shared.PG_PW_API}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}?sslmode=require&pool_max_conns=10`, `REDIS_URL=${{Redis.REDIS_URL}}`, `REDIS_CACHE_URL=redis://:${{shared.REDIS_PASSWORD}}@redis-cache.railway.internal:6379/0`, `RPC_GATEWAY_URL=http://rpc-gateway.railway.internal:8081`, `NATS_URL=nats://api:${{shared.NATS_PW_API}}@nats.railway.internal:4222`, `GATEWAY_INTERNAL_TOKEN`, `ADDRESS_LINK_ENCRYPTION_KEY`, `CENTRIFUGO_TOKEN_HMAC_SECRET`, `REALTIME_PUBLIC_URL`, `TRUST_PROXY_HEADERS=1`, `TRUSTED_PROXY_CIDRS` (Railway's proxy range; see its docs), `VAPID_PUBLIC_KEY`, `POW_DIFFICULTY`, plus the gateway keys listed in `.env.example` (`ALCHEMY_API_KEY`, `LIFI_API_KEY`, `UNISWAP_API_KEY`, `JUP_API_KEY`, `RELAY_API_KEY`, `PIMLICO_API_KEY`, `COINGECKO_API_KEY`, `COINGECKO_PLAN`, `HELIUS_API_KEY`, `ETHERSCAN_API_KEY`, `TRONGRID_API_KEY`, `TONCENTER_API_KEY`, `CONFIG_JSON`, `CONFIG_SIG`) |
| `indexer` | `INDEXER_ADDR=:8083`, `POSTGRES_URL` (user `harbour_indexer`, `pool_max_conns=8`), `RPC_GATEWAY_URL`, `NATS_URL` (user `indexer`), `GATEWAY_INTERNAL_TOKEN`, `ADDRESS_LINK_ENCRYPTION_KEY`, `ALCHEMY_API_KEY`, `ALCHEMY_NOTIFY_TOKEN`, `ALCHEMY_WEBHOOK_SIGNING_KEYS`, `WEBHOOK_PUBLIC_URL` |
| `webhook-ingest` | `WEBHOOK_ADDR=:8082`, `POSTGRES_URL` (user `harbour_webhook`, `pool_max_conns=2`), `NATS_URL` (user `webhook`), `ADDRESS_LINK_ENCRYPTION_KEY`, `ALCHEMY_API_KEY`, `ALCHEMY_WEBHOOK_SIGNING_KEYS` |
| `price-poller` | `POSTGRES_URL` (user `harbour_prices`, `pool_max_conns=4`), `REDIS_URL`, `NATS_URL` (user `prices`), `COINGECKO_API_KEY`, `COINGECKO_PLAN`, `ALCHEMY_API_KEY` |
| `tx-tracker` | `POSTGRES_URL` (user `harbour_txtrack`, `pool_max_conns=2`), `RPC_GATEWAY_URL`, `NATS_URL` (user `txtrack`), `GATEWAY_INTERNAL_TOKEN` |
| `realtime-bridge` | `NATS_URL` (user `realtime`), `CENTRIFUGO_API_URL=http://centrifugo.railway.internal:8000/api`, `CENTRIFUGO_API_KEY` |
| `notifier` | `POSTGRES_URL` (user `harbour_notifier`, `pool_max_conns=2`), `REDIS_URL`, `NATS_URL` (user `notifier`), `ADDRESS_LINK_ENCRYPTION_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `FCM_CREDENTIALS_FILE` (mount or inline per `<NAME>_FILE` support in `internal/config`) |
| `nats` | `NATS_PASSWORD`, `NATS_PW_API`, `NATS_PW_INDEXER`, `NATS_PW_WEBHOOK`, `NATS_PW_PRICES`, `NATS_PW_TXTRACK`, `NATS_PW_REALTIME`, `NATS_PW_NOTIFIER` (all `${{shared.*}}`); volume mounted at `/data` |
| `centrifugo` | `PORT=8000`, `CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY=${{shared.CENTRIFUGO_TOKEN_HMAC_SECRET}}`, `CENTRIFUGO_HTTP_API_KEY=${{shared.CENTRIFUGO_API_KEY}}`, `CENTRIFUGO_ENGINE_TYPE=memory` |
| `redis-cache` | `REDIS_PASSWORD=${{shared.REDIS_PASSWORD}}` |

`POSTGRES_URL` for the per-service logins has the shape shown for `api`; only the user, password and `pool_max_conns` change. Run **one** replica of every service until you have read the scaling notes in `reliability.md`.

## Known trade-off: database TLS

The backend refuses a non-loopback database unless the connection is `verify-full` with a CA it trusts (audit HW-2026-007, `internal/store`). Railway's Postgres template presents a self-signed certificate and does not give services its CA, so `verify-full` cannot succeed. The guide therefore sets `sslmode=require` (encrypted, not verified) and `HB_ALLOW_INSECURE_DB=1`. Traffic stays on Railway's private network and the database has no public domain, but this is weaker than the audited setup. To restore full verification later: run Postgres with your own CA (the local stack's `scripts/pg-certs.sh` shows how), or move the database to a provider that publishes its CA (AWS RDS), and drop `HB_ALLOW_INSECURE_DB`. Treat this as a conscious risk acceptance, not a default.

Partitioning: Railway's Postgres has no `pg_partman`; migration `0001` falls back to the built-in `harbour_ensure_monthly_partitions`, which `migrate -maintain` (the daily cron) keeps ahead.

## Verification status (2026-11-06)

Checked here, on the real files:

- `docker build` of `apps/backend` builds both stages (`local`, `railway`); every Go binary compiles.
- The `railway` image: `SERVICE=bogus` exits 64 with a message; `SERVICE=migrate` starts the real binary (and fails only because no database was given).
- Extension: `eslint --max-warnings 0`, `tsc --noEmit`, all 568 unit tests and the production build pass from the new `apps/extension` folder (clean `npm ci` in a scratch copy).
- `scripts/gen_chains.py --check` passes with the new folder layout.

Not checked (needs your Railway account):

- That Railway accepts the config files and variable references exactly as written (field names follow Railway's config-as-code schema; confirm in the dashboard on first deploy).
- Live traffic: health checks, NATS JetStream on a Railway volume, Centrifugo through Railway's WebSocket proxy, Alchemy webhooks reaching `webhook-ingest`.
- Go unit and integration tests were not re-run in this change (no Go toolchain was available outside Docker, and the Go code is unchanged).
