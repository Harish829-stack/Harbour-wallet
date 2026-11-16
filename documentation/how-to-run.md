# How to run Harbour locally

This guide takes you from a fresh clone to a working wallet: the Go backend in Docker, the Chrome extension built and loaded, and the tests passing. For what each backend service does, see [backend-services.md](backend-services.md).

## 1. Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Git | any | cloning |
| Node.js + npm | **22** (`apps/extension/.nvmrc`) | building and testing the extension |
| Google Chrome | **137 or newer** (`minimum_chrome_version` in the manifest) | loading the extension |
| Docker Desktop (with `docker compose`) | current | running the backend stack |
| Go | **1.26.10** (`apps/backend/go.mod`) | `make test`, `./run.sh test`, `./run.sh verify` (not needed just to run the stack, Docker builds the code) |
| `curl`, `openssl`, `perl` | preinstalled on macOS/Linux | `scripts/setup.sh` generates local secrets with them |
| An Alchemy and/or Infura API key | free tier is enough | the backend reads chains through them; `./run.sh` refuses to start without at least one |
| `cloudflared` | optional | a public URL so Alchemy webhooks can reach your laptop (see [section 5](#5-optional-live-updates-with-a-tunnel)) |

You do **not** need the Trust Wallet extension or anything under `research/` to run Harbour.

## 2. Get the code

```bash
git clone <repo-url> REA
cd REA
ln -s ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit   # secret guard, install once
```

Everything below starts from the repository root (`REA/`). The product lives in `harbour-wallet-v3/`.

## 3. Run the backend

```bash
cd harbour-wallet-v3/apps/backend
./run.sh
```

The first run is **expected to stop** with `No RPC provider key in .env`. It has just created `apps/backend/.env` from `.env.example` and generated every password and secret. Then:

1. Open `apps/backend/.env` and set `ALCHEMY_API_KEY` and/or `INFURA_API_KEY`. Leave the generated values alone. `.env` is git-ignored: never commit it.
2. Run `./run.sh` again. It builds the image, starts Postgres, two Redis instances, NATS, Centrifugo, the `migrate` job and the Go services, then waits until the API and the RPC gateway report healthy.
3. Check it:

   ```bash
   ./run.sh status    # container state, health, per-upstream gateway status
   ./run.sh smoke     # registers a test device and reads a block from Base and Ethereum through the gateway
   ```

The API is now on `http://localhost:8080`, which is where a locally built extension looks.

### `run.sh` commands

| Command | What it does |
| --- | --- |
| `./run.sh` / `up` | create `.env` and secrets if needed, build, start, wait until healthy |
| `status` | containers, health, gateway upstreams, whether the public webhook URL is reachable |
| `logs` | follow the Go services' logs |
| `smoke` | register a CLI test device, make signed calls, read testnet/mainnet blocks via the gateway |
| `inspect CHAIN ADDRESS` | tracking state, webhook, latest transfers and balances of an address |
| `verify [CHAIN ADDRESS]` | track an address, wait for the backfill, compare stored balances with the chain at the same block (needs Go) |
| `send CHAIN TO WEI` | send testnet ETH from `HB_DEV_PRIVATE_KEY` through Harbour (needs Go) |
| `watch [SECONDS]` | print live balance and transaction updates from Centrifugo (needs Go) |
| `test` | unit tests, then integration tests against the running stack (needs Go) |
| `restart` | rebuild, migrate and restart the Go services after a code, config or `.env` change |
| `down` | stop everything, keep data |
| `reset` | stop everything and **delete** the local database, Redis and NATS data |

`make` shortcuts exist for the same things (`make setup`, `make up`, `make test`, `make test-integration`, `make lint`; run `make` targets from `apps/backend`). `./run.sh` is the main entry point.

A plain `docker compose restart` does **not** apply `.env` changes; use `./run.sh restart`.

### Local ports

Everything is bound to `127.0.0.1`.

| Address | Service | Notes |
| --- | --- | --- |
| `http://localhost:8080` | `api` | what the extension talks to; `GET /healthz` is public, everything else needs device-signed requests |
| `http://localhost:8081` | `rpc-gateway` | internal; `/healthz` public, `/status` and `/metrics` need `GATEWAY_INTERNAL_TOKEN` |
| `http://localhost:8082` | `webhook-ingest` | receives `POST /webhooks/alchemy`; point the tunnel here |
| `http://localhost:8083` | `indexer` | `/healthz` only |
| `ws://localhost:8000/connection/websocket` | `centrifugo` | realtime for the extension; HTTP API at `:8000/api` needs its key |
| `localhost:5432` / `6379` / `4222` | Postgres / Redis / NATS | not HTTP; password required, per-service logins |

`price-poller`, `tx-tracker`, `realtime-bridge`, `notifier` and `migrate` publish no port; read their logs with `./run.sh logs`.

## 4. Build and load the extension

```bash
cd harbour-wallet-v3/apps/extension
nvm use                              # Node 22
npm ci                               # install scripts are disabled on purpose (.npmrc)
cp .env.example .env.production      # defaults point at http://localhost:8080
npm run build                        # produces dist/
```

Then in Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select `harbour-wallet-v3/apps/extension/dist`. A full-page onboarding tab opens on first install.

- `npm run dev` gives live development. Popup changes reload by themselves; after changing background-worker or injected-script code, click the reload icon on the extension's card.
- `VITE_HB_API_URL` is baked in at build time. `http://` is accepted only for localhost, and `scripts/release.mjs` refuses to release a build that points at localhost.
- Without the backend the wallet still opens, but balances, history and prices will not load.
- To look at what the extension is doing: on `chrome://extensions` click the **service worker** link for Harbour. Console shows failures, Network shows the `:8080/v1/...` calls and the WebSocket to `:8000`. Open DevTools on the popup separately for UI errors.

Build settings are in `.env.example`; only public values go there. Provider keys live in the backend's `.env`, never in the extension.

## 5. Optional: live updates with a tunnel

Without a public URL the indexer **polls** every few minutes, which is fine for development. For instant updates, Alchemy needs to reach `webhook-ingest` (port 8082):

```bash
# terminal A
cd harbour-wallet-v3/apps/backend && ./run.sh
curl -fsS http://localhost:8082/healthz        # {"ok":true}

# terminal B: leave running
brew install cloudflared                        # once
cloudflared tunnel --url http://localhost:8082  # prints https://<random>.trycloudflare.com
```

Put the printed URL in `apps/backend/.env`, **base URL only** (the indexer appends `/webhooks/alchemy`):

```dotenv
ALCHEMY_NOTIFY_TOKEN=<Alchemy dashboard > Webhooks > Auth token>   # not the RPC key
WEBHOOK_PUBLIC_URL=https://<random>.trycloudflare.com
```

Then `./run.sh restart` and `./run.sh status`; it should print `public URL ... -> reachable`. A quick tunnel gets a **new URL every time it restarts**, so update `.env` and restart the backend again whenever you restart the tunnel. Never put `WEBHOOK_PUBLIC_URL` into `VITE_HB_API_URL`.

## 6. Tests and checks

| Where | Command | What it runs |
| --- | --- | --- |
| `apps/extension` | `npm test` | all Node tests in `test/` |
| `apps/extension` | `npm run lint` | ESLint, zero warnings allowed |
| `apps/extension` | `npm run verify` | lint, type-check, tests, production build, npm audit gate, bundle secret scan (what CI runs) |
| `apps/extension` | `npm run check:rpc` | probes configured RPC endpoints (needs internet) |
| `apps/backend` | `make test` | `go test -race ./...`, no services needed |
| `apps/backend` | `make test-integration` | integration tests against the Compose Postgres and Redis |
| `apps/backend` | `make lint` | `golangci-lint` (depguard) and the provider-name check |

Some extension tests read the three chain-registry JSON files in `research/evidences/re-evidence/30-chain-registry/`; they are committed, so a plain clone passes.

## 7. Inspecting what the backend is doing

```bash
cd harbour-wallet-v3/apps/backend
./run.sh logs                                            # all Go services
docker compose --env-file .env -f deploy/docker-compose.yml logs --tail 100 -f webhook-ingest indexer realtime-bridge
./run.sh inspect base-sepolia 0xYourAddress              # what Harbour knows about an address
./run.sh watch 300                                       # live updates for the CLI device
docker compose --env-file .env -f deploy/docker-compose.yml exec -T postgres \
  psql -U harbour -d harbour -c "SELECT chain_id, received_at FROM webhook_deliveries ORDER BY received_at DESC LIMIT 20;"
```

Use chain names from `config/chains.yaml` (`base-sepolia`, `sepolia`, `base`, `ethereum`), not numeric chain IDs. Logs are JSON with a `service` field; set `LOG_LEVEL=debug` in `.env` and `./run.sh restart` for more detail (set it back afterwards). Services often identify a wallet by `tracked_address_id`, so searching logs for the address can miss things.

## 8. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `No RPC provider key in .env` | expected on first run; add `ALCHEMY_API_KEY` or `INFURA_API_KEY` and rerun |
| `Docker is not running` | start Docker Desktop and wait until it is up |
| First `up` fails on Postgres certificates, or Docker created empty folders under `deploy/postgres/certs` | run `scripts/setup.sh` before `up` (`./run.sh` does this), remove the empty folders, rerun |
| `npm run build`: `VITE_HB_API_URL must be https://` | only localhost may use `http://`; fix the value in `.env.production` |
| `npm run build` stops on type errors in unrelated files | wrong TypeScript; run `npm ci` and check `npx tsc -v` matches `package.json` |
| `status` says the public URL is **NOT reachable** | tunnel stopped or its URL changed; restart it, update `WEBHOOK_PUBLIC_URL`, `./run.sh restart` |
| Webhook URL contains `/webhooks/alchemy` twice | `WEBHOOK_PUBLIC_URL` must be the base URL only |
| `logs` show `webhook management failed` / `create webhook` errors | `ALCHEMY_NOTIFY_TOKEN` empty or wrong |
| `rejected delivery ... bad signature` | the delivery came from a webhook Harbour did not create; let the indexer manage webhooks or add `id:key` to `ALCHEMY_WEBHOOK_SIGNING_KEYS` |
| New transfers appear only after minutes | webhook path is down and gap-fill caught them; check the tunnel and `webhook-ingest` logs. Data is still correct |
| `watch` prints nothing after a send | `realtime-bridge` or Centrifugo down (`./run.sh status`); the transaction still settles, see `GET /v1/tx/<chain>/<hash>` |
| `send` says `not_tracked` | the sender address is not tracked by the CLI device; track it first |
| CLI works but the extension does not | check the API URL baked into `dist/build-info.json`, then the service-worker Console and Network |
| Extension shows no balances | backend not running or `VITE_HB_API_URL` wrong; open the service worker's DevTools |

Hard reset of local data: `./run.sh reset` (destroys the local database; not a fix for a broken tunnel).
