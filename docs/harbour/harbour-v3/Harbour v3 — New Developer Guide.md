# Harbour v3 — New Developer Guide

Oct 30, 2026 · @Harish

Operations and inspection instructions updated Nov 3, 2026.

## Big picture

Harbour is a Chrome extension (the wallet) plus a Go backend (balances, history, prices, push). Websites and the popup never touch keys; they send requests to the background worker, which owns the vault and signs.

&#91;embedded content: architecture · 4 parts, 3 connections\]

A website talks through two small scripts, the popup talks through its own port, and only the worker talks to the backend. A fresh clone has no `README.md` for v3 (the root one still describes v2), so this guide is the entry point.

## Where things live

Work inside `REA/harbour-wallet-v3` on branch `harbour-v3`. Treat `harbour-wallet-v2` and the repo root as reference only.

| Path | What it is |
| --- | --- |
| `src/background/` | The service worker: boots the wallet, routes every message, runs the provider router and approval window. Messages are registered in `handlers/` and `modules/` |
| `src/core/` | Logic with no UI: chains and networks (`chains/`, `networkRegistry.ts`), vault and passwords, signing policy (`harbour/policy.ts`), tokens, activity, swaps |
| `src/popup/` | The React UI: onboarding, home, send, settings, approval screens. Talks to the worker through `popup/api.ts` |
| `src/inpage/` | Script injected into web pages; defines `window.ethereum` and the other providers |
| `src/content/` | Content script that checks and relays page requests to the worker |
| `src/kit/` | Network helpers: RPC failover, gateway calls, remote config |
| `test/` | Node tests, one file per feature (`npm test`) |
| `backend/` | Go services, database migrations, Docker Compose in `deploy/` |
| `scripts/` | Build, release, chain-list and RPC-check scripts |
| `manifest.config.ts`, `vite.config.ts` | Chrome manifest and build setup |
| `SECURITY-AUDIT-V3.md` | The security audit and its fix status |

Other docs live one level up in `REA/docs/`; `docs/harbour/` holds the release and security notes.

## Prerequisites

Install these once. The extension needs only Node and Chrome; the backend adds Docker and an RPC key.

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js and npm | Node 22 | Building and testing the extension |
| Google Chrome | 114 or newer | Loading the extension (`minimum_chrome_version` in the manifest) |
| Docker Desktop | Current, with `docker compose` | Running the backend stack |
| Go | 1.26 (`go.mod` says 1.26.0; the Makefile comment says 1.23+, so use 1.26) | `./run.sh test`, `./run.sh verify`, `make deps`. Install with `brew install go` |
| `curl`, `openssl`, `perl` | Preinstalled on macOS | `setup.sh` generates secrets with them |
| Alchemy and/or Infura API key | Free tier works | The backend reads chains through them. `./run.sh` refuses to start without one |
| `cloudflared` | Optional | A public URL for webhooks; without it the indexer polls instead |

You do not need the Trust Wallet extension or the old Cloudflare worker to run v3; the backend replaces the worker.

## Run the extension

Build it, then load it into Chrome.

1. Open a terminal in the project: `cd REA/harbour-wallet-v3`.
2. Install exact dependencies: `npm ci`.
3. Build: `npm run build`. It copies and verifies the wallet-core WASM, bundles the page and content scripts, type-checks, then runs Vite. The result is the `dist/` folder.
4. If the type-check step stops the build, run `npx vite build` instead; it produces the same `dist/` without the check.
5. In Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `harbour-wallet-v3/dist`. A full-page onboarding tab opens on first install.

The backend address is baked in at build time. With `VITE_HB_API_URL` unset (the checked-in `.env.production` leaves it unset) the build points at `http://localhost:8080`, prints a "Local build" warning, and `scripts/release.mjs` will refuse to release that `dist/`. That is what you want for local work.

For live editing run `npm run dev` and load the folder the same way. Popup changes reload on their own; after changing background-worker or injected-script code, click the reload icon on the extension's card in `chrome://extensions`.

Without the backend running the wallet still opens, but balances, history and prices will not load. Start the backend next.

## Run the backend

One script, `backend/run.sh`, starts everything in Docker. Your first run is expected to stop and ask for an RPC key.

1. Start Docker Desktop and wait until it says it is running.
2. `cd REA/harbour-wallet-v3/backend`
3. Run `./run.sh`. It creates `backend/.env` from `.env.example` and generates every password and secret itself, then stops with "No RPC provider key in .env".
4. Open `backend/.env` and set `ALCHEMY_API_KEY` and/or `INFURA_API_KEY`. Leave the generated values alone; the file is git-ignored, so never commit it.
5. Run `./run.sh` again. It builds the images and starts Postgres, Redis, NATS, Centrifugo, the migration job, the RPC gateway, the API and the other Go services, then waits until the API and gateway report healthy.
6. Check it: `./run.sh status`, then `./run.sh smoke`, which registers a test device and reads a block from Base and Ethereum through the gateway.

The API listens on `http://localhost:8080`, which is where the locally built extension looks. Webhooks are optional: set `ALCHEMY_NOTIFY_TOKEN` and `WEBHOOK_PUBLIC_URL` (a `cloudflared` tunnel to port 8082) for live updates; without them the indexer polls every few minutes.

| Command | What it does |
| --- | --- |
| `./run.sh status` | Container state, health and per-upstream gateway status |
| `./run.sh logs` | Follow the Go services' logs |
| `./run.sh inspect CHAIN ADDRESS` | Read local tracking state, transfers, balances, webhook registration and recent delivery counts |
| `./run.sh verify CHAIN ADDRESS` | Track an address with the CLI device, wait for backfill, compare stored balances against RPC at the same block (needs Go) |
| `./run.sh watch 300` | Watch the CLI device's live balance and transaction updates for 300 seconds (needs Go) |
| `./run.sh restart` | Rebuild and restart the Go services after a code or config change |
| `./run.sh test` | Unit tests, then integration tests against the running stack (needs Go) |
| `./run.sh down` | Stop everything, keep data |
| `./run.sh reset` | Stop everything and delete the local database, Redis and NATS data |

## Service ports: which address goes where?

These are the host ports in `backend/deploy/docker-compose.yml`. All are bound to `127.0.0.1`; run the commands on the Mac running Docker.

| Host address / port | Service | Purpose and inspection |
| --- | --- | --- |
| `http://localhost:8080` | `api` | Extension-facing HTTP API. `GET /healthz` is public; wallet data endpoints need device-signed requests. Use `hbdevice` below |
| `http://localhost:8081` | `rpc-gateway` | Internal blockchain RPC routing, failover and provider health. `/healthz` is public; `/status` and `/metrics` require `GATEWAY_INTERNAL_TOKEN` |
| `http://localhost:8082` | `webhook-ingest` | Receives `POST /webhooks/alchemy`. **Point the development Cloudflare tunnel here.** `GET /healthz` checks the receiver and its database connection |
| `http://localhost:8083` | `indexer` | Health endpoint at `/healthz`; indexing runs in the background. Inspect addresses through the CLI/database, not an address page on this port |
| `ws://localhost:8000/connection/websocket` | `centrifugo` | Realtime client connection; the HTTP server API is at `http://localhost:8000/api` and requires its API key. `./run.sh watch` obtains client tokens through Harbour |
| `localhost:5432` | `postgres` | Stored addresses, balances, transfers and webhook deliveries; PostgreSQL protocol, not HTTP |
| `localhost:6379` | `redis` | Cache and Centrifugo backing store; Redis protocol, password required |
| `localhost:4222` | `nats` | Internal JetStream event bus, authenticated and restricted per service; not HTTP. Compose does not publish a NATS monitoring port |
| No published port | `price-poller`, `tx-tracker`, `realtime-bridge`, `notifier` | Background workers; use Docker logs |
| No published port | `migrate` | One-shot database migration job; an exited container with exit code 0 is expected |

In a mapping such as `127.0.0.1:8082:8082`, the first port is on your Mac and the second is inside the container. Containers reach each other by service name, for example `http://rpc-gateway:8081`; `localhost` inside a container refers to that container. The instructions below run `cloudflared` on the Mac, outside Docker.

## Connect a Cloudflare tunnel to the backend

The development webhook path is:

```text
Alchemy -> https://<random>.trycloudflare.com/webhooks/alchemy
        -> Cloudflare -> cloudflared on your Mac
        -> http://localhost:8082/webhooks/alchemy
        -> Postgres + NATS -> indexer -> balances/transfers
        -> realtime-bridge -> Centrifugo :8000 -> extension / CLI watcher
```

`cloudflared` establishes an outbound connection to Cloudflare, allowing incoming webhook requests to reach your local receiver without router port forwarding. A Quick Tunnel needs no account or domain, has a temporary hostname, and stops serving when its process stops. It is a development tool. See Cloudflare's [tunnel concepts](https://developers.cloudflare.com/tunnel/concepts/) and [Quick Tunnel instructions](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

### First connection

1. Install the client once on macOS: `brew install cloudflared`.
2. In terminal A, start the backend and confirm the receiver is healthy:

   ```bash
   cd /Users/jatinsharma/Desktop/REA/harbour-wallet-v3/backend
   ./run.sh
   curl -fsS http://localhost:8082/healthz
   ```

3. In terminal B, start the tunnel and **leave it running**:

   ```bash
   cloudflared tunnel --url http://localhost:8082
   ```

   Copy the `https://...trycloudflare.com` URL printed in this terminal. This forwards the receiver's HTTP routes; it does not start Docker or the backend.

4. In terminal A, edit `backend/.env`. Set these values, replacing the example URL with the one just printed:

   ```dotenv
   ALCHEMY_NOTIFY_TOKEN=<your Alchemy Webhooks auth token>
   WEBHOOK_PUBLIC_URL=https://your-generated-host.trycloudflare.com
   ```

   Use the **base URL only**, without `/webhooks/alchemy`; the indexer appends that path. `ALCHEMY_NOTIFY_TOKEN` is the webhook-management credential, separate from the RPC `ALCHEMY_API_KEY`. The indexer stores signing keys for automatically created webhooks encrypted in Postgres; `ALCHEMY_WEBHOOK_SIGNING_KEYS` is for manually created webhooks.

5. Apply the environment change and check both local and public reachability:

   ```bash
   ./run.sh restart
   ./run.sh status
   curl -fsS https://your-generated-host.trycloudflare.com/healthz
   ```

   Expect `{"ok":true}` from the receiver and `public URL ... -> reachable` in status. This proves the public route reaches the receiver; it does not prove that Alchemy has subscribed an address or delivered an event. Track an address using the next section. For eligible chains, webhook management runs immediately and then every 15 seconds by default; logs may show `webhook created` or `webhook moved to new URL`.

Keep the extension's local API URL at `http://localhost:8080` and realtime URL at `ws://localhost:8000/connection/websocket`. `WEBHOOK_PUBLIC_URL` is the inbound provider callback URL; putting it into `VITE_HB_API_URL` would send wallet API calls to the webhook receiver. Changing only the webhook URL needs a backend restart, not an extension rebuild.

### Restart after a code change, tunnel restart, or laptop sleep

| What changed | What to do |
| --- | --- |
| Backend code or `.env`; tunnel still running | Run `./run.sh restart`, then `./run.sh status`. Keep the existing tunnel URL |
| Tunnel stopped or restarted | Run the tunnel command again, copy its **new** URL into `WEBHOOK_PUBLIC_URL`, run `./run.sh restart`, then `./run.sh status` |
| Docker stopped | Start Docker Desktop, run `./run.sh`, then check whether the tunnel is still running and its URL matches `.env` |
| Laptop slept / network dropped | Check `./run.sh status`, the tunnel terminal and logs. If you recreate the Quick Tunnel, apply its new URL as above |

`./run.sh restart` uses Compose `up -d --build` for the migration job and Go services, then waits for their HTTP health endpoints. Compose can recreate containers with changed environment values; a plain `docker compose restart` does not apply `.env` changes. The script does not restart the separate `cloudflared` process. It keeps stored data; `./run.sh reset` deletes it and is not a recovery step for a broken tunnel.

After the indexer reloads the new public URL, it replaces old provider webhooks and resubscribes tracked addresses. Gap-fill runs every 3 minutes by default for eligible tracked addresses, so updates can arrive later while webhooks are unavailable. Recovery still depends on chain/source support and healthy RPC providers.

## Inspect a wallet address

All commands here run from `/Users/jatinsharma/Desktop/REA/harbour-wallet-v3/backend`. Use a supported, enabled chain slug from `config/chains.yaml`, such as `base-sepolia`, `sepolia`, `base` or `ethereum`. A numeric EVM chain ID is not the CLI chain argument. These examples use an EVM public address; replace it with the address you want to inspect. No wallet private key is needed.

### Read what Harbour already knows

```bash
./run.sh inspect base-sepolia 0x1111111111111111111111111111111111111111
```

This reads the local database without registering or tracking the address. Its five result sets show:

| Result | What to look for |
| --- | --- |
| Tracking row | `backfill_state`, `device_count`, `webhook_id`, `synced_to_block`, `last_seen_block`, `last_activity_at` |
| Latest 10 transfers | Block, shortened transaction hash, event reference, kind, asset, raw amount, finality and shortened block hash |
| Stored balances | Positive balances plus the native coin, decimals, `as_of_block` and update time |
| Webhooks for the chain | Provider webhook ID, address count and callback URL; confirm the current tunnel URL |
| Deliveries in the last hour | Count and latest receive time **for the whole chain**, not just this address |

No tracking row means Harbour has no local tracked record for that chain/address. It does not mean the address has no on-chain activity. A `webhook_id` indicates local registration state; a recent delivery is stronger evidence of traffic. Amounts are raw integers: token units are `amount_raw / 10^decimals`.

The current `inspect` helper lowercases its address argument and interpolates both arguments into SQL. Use it for trusted chain slugs and validated EVM hexadecimal addresses; do not feed it arbitrary text or untrusted input. It is not a universal explorer for every address format.

### Track a new address, backfill it, and verify balances

```bash
./run.sh smoke
./run.sh verify base-sepolia 0x1111111111111111111111111111111111111111
./run.sh inspect base-sepolia 0x1111111111111111111111111111111111111111
```

`smoke` creates or reuses a test API device in `.hbdevice.json`. `verify` adds the address to that device, waits up to 10 minutes for backfill, and compares stored native/token balances with individual RPC reads at each stored balance's block. It can requeue a previously failed backfill. It changes local tracking state and uses provider quota; it does not send a transaction. A successful comparison checks stored balances, not completeness of all historical activity. A `capped` backfill can have incomplete history.

The CLI device is separate from the Chrome extension's device. Tracking an address in one does not add it to the other. Keep `.hbdevice.json` private; it contains the CLI device signing seed. Re-registering overwrites it, so use `smoke` to reuse it.

For signed API inspection without the full verification step:

```bash
# Run smoke once first so the CLI device exists.
go run ./cmd/hbdevice addresses '{"add":[{"chain":"base-sepolia","address":"0x1111111111111111111111111111111111111111"}]}'
go run ./cmd/hbdevice list
go run ./cmd/hbdevice get '/v1/me/portfolio?addresses=base-sepolia:0x1111111111111111111111111111111111111111'
go run ./cmd/hbdevice get '/v1/me/history?addresses=base-sepolia:0x1111111111111111111111111111111111111111&limit=10'
```

Portfolio/history read stored data for the selected device-tracked address. A plain `curl` to these protected routes does not supply the required device signature. For an independent current native-balance RPC read through Harbour:

```bash
go run ./cmd/hbdevice rpc base-sepolia '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0x1111111111111111111111111111111111111111","latest"]}'
```

This returns a hexadecimal wei balance at `latest`, which can differ from a stored balance at an earlier block. To stop tracking it with the CLI device:

```bash
go run ./cmd/hbdevice addresses '{"remove":[{"chain":"base-sepolia","address":"0x1111111111111111111111111111111111111111"}]}'
```

## Watch incoming logs and events

Use separate terminals: one for the tunnel, one for backend logs, and one for client events. Start watching before triggering a testnet transfer involving your tracked address.

```bash
# Backend operational logs; Ctrl-C stops following, not the containers.
./run.sh logs
```

For a smaller stream, or logs from infrastructure omitted by `run.sh logs`:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml logs --tail 100 --timestamps -f webhook-ingest indexer realtime-bridge
docker compose --env-file .env -f deploy/docker-compose.yml logs --since 10m --tail 100 api rpc-gateway tx-tracker
docker compose --env-file .env -f deploy/docker-compose.yml logs --tail 100 centrifugo nats postgres
```

The Go services emit JSON logs with a `service` field. Useful messages include `webhook created`, `webhook moved to new URL`, `webhook management failed`, `rejected delivery`, `delivery for unknown webhook`, `publish delivery`, `gap-fill recovered events` and `event handler failed; will redeliver`. A successful incoming webhook is not logged once per request by the current receiver; use delivery rows and transfer/balance changes to confirm receipt. Searching logs for a wallet address can miss relevant work because services often identify it by `tracked_address_id`.

To increase backend detail, set `LOG_LEVEL=debug` in `.env`, run `./run.sh restart`, reproduce the issue, then restore `info` and restart. This changes logging detail; it does not turn Docker logs into a complete event-bus trace.

### Watch the events delivered to a client

After `smoke` and tracking the address with that same CLI device, run:

```bash
./run.sh watch 300
```

This obtains realtime tokens from `POST /v1/realtime/token`, connects to Centrifugo and prints channel names plus publication JSON. The bridge relays balance changes (`type: "balance"`, including chain, address, block and balances) and transaction status changes (`type: "tx"`, including hash, status and block). The subscriptions returned for the CLI device cover its tracked addresses and pending transactions. Rerun `watch` after adding an address or starting a transaction so it requests fresh subscriptions.

`watching N channels` reports attempted subscriptions; check for subsequent `realtime error` messages. This watches future client publications, not every internal NATS event or past transaction. A quiet stream can simply mean no relevant change occurred. To inspect current state, run `inspect` or the signed portfolio/history calls separately.

The internal path uses subjects such as `chain.<chain>.activity.raw` (received provider payload), `balance.changed.<chain>` (indexed balances), `activity.new.<chain>` (incoming activity for notifications) and `tx.status.<chain>` (transaction status). `realtime-bridge` forwards balance and transaction subjects to Centrifugo; the CLI watcher does not print the raw provider payload stream.

### Confirm incoming deliveries in the database

For a recent delivery list without dumping payloads or signing keys:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml exec -T postgres \
  psql -U harbour -d harbour -c "SELECT chain_id, received_at FROM webhook_deliveries ORDER BY received_at DESC LIMIT 20;"
```

Compare receive times with `./run.sh inspect CHAIN ADDRESS`, its latest transfers and balance block numbers. Rows are evidence of stored deliveries, not proof that every delivery has already been processed by the indexer.

### Inspect the tunnel and extension

The tunnel terminal shows connection/reconnection errors. For temporary request detail, stop it with Ctrl-C and run:

```bash
cloudflared tunnel --url http://localhost:8082 --loglevel debug
```

This creates a new Quick Tunnel: update `WEBHOOK_PUBLIC_URL` and restart the backend again. Cloudflare documents that debug logs can contain request/response headers; keep them local and redact credentials before sharing. See [Cloudflare run parameters](https://developers.cloudflare.com/tunnel/configuration/). Use the printed public URL with `/healthz` for a reachability check; opening `/webhooks/alchemy` in a browser makes a GET, while the receiver expects a signed provider POST.

For extension-side inspection, open `chrome://extensions` and click Harbour's **service worker** link. In DevTools, check Console for failures, Network for `:8080/v1/...` calls, and the WebSocket connection to `:8000/connection/websocket` for frames. Open DevTools on the popup separately for UI errors. Inspecting the service worker keeps it active, so recheck lifecycle issues with DevTools closed too.

### Diagnose the first failing stage

| Observation | Next check |
| --- | --- |
| Local `:8082/healthz` fails | Docker state and `webhook-ingest` / Postgres logs; fix the local receiver first |
| Local receiver works, public `/healthz` fails | Tunnel process, network and whether `.env` contains its current hostname; a 502 often means the configured local origin is unavailable |
| Public health works, no webhook registration | `ALCHEMY_NOTIFY_TOKEN`, supported/enabled chain, tracked address and indexer management errors |
| Webhook URL includes `/webhooks/alchemy` twice | Store only the HTTPS base URL in `WEBHOOK_PUBLIC_URL`, then `./run.sh restart` |
| Webhook registered, no recent deliveries | Confirm activity on the exact chain/address and check the provider's webhook delivery status; unsigned hand-made POSTs are rejected |
| Delivery rows advance, balances/transfers do not | Indexer logs, NATS errors, backfill state and gateway upstream status |
| Stored state advances, watcher stays quiet | CLI device tracks the address, fresh subscriptions, realtime errors, `realtime-bridge` / Centrifugo logs and `REALTIME_PUBLIC_URL` |
| CLI works, extension does not | Extension device/address tracking, baked API URL in `dist/build-info.json`, worker Console and Network |

Implementation references: [`run.sh`](../../../harbour-wallet-v3/backend/run.sh), [`docker-compose.yml`](../../../harbour-wallet-v3/backend/deploy/docker-compose.yml), [`hbdevice`](../../../harbour-wallet-v3/backend/cmd/hbdevice/main.go), [`hbverify`](../../../harbour-wallet-v3/backend/cmd/hbverify/main.go), [`webhook management`](../../../harbour-wallet-v3/backend/internal/indexer/live.go), [`webhook receiver`](../../../harbour-wallet-v3/backend/internal/ingest/ingest.go), and [`realtime bridge`](../../../harbour-wallet-v3/backend/internal/realtime/bridge.go). For the longer architecture walkthrough, see [HOW-IT-WORKS.md](HOW-IT-WORKS.md).

## How it works: one request from click to signature

A website asks to send a transaction. Read these files in this order and you will have seen the whole path.

1. **The page asks.** The site calls `window.ethereum.request(...)`. That object comes from `src/inpage/ethereum.ts`; `src/inpage/index.ts` installs it and also announces Harbour to wallet pickers.
2. **The page script hands it over.** `src/inpage/bridge.ts` opens a private channel to the content script, so other scripts on the page cannot listen in.
3. **The content script checks it.** `src/content/content.ts` validates the request shape and the method name against an allowlist, then forwards it over a port named `harbour-provider`. The page can never choose who it claims to be; Chrome reports the origin.
4. **The worker routes it.** `src/background/provider/index.ts` receives the port and calls `ProviderService.handle` in `service.ts`. Simple reads are answered directly. Anything that signs or changes state is put in a pending queue (`queue`).
5. **You approve.** The worker opens the approval window (`approvalWindow.ts`). The screens are in `src/popup/wallet/features/provider.tsx`, and they get a prepared summary from `view.ts`, never raw keys. Approve or Reject calls `providerResolve` in `handlers/provider.ts`, which calls `ProviderService.resolve`.
6. **The worker signs and sends.** `execute` in `service.ts` re-checks that the site is still connected (the signing policy in `core/harbour/policy.ts`), signs with the vault key through `signer.ts`, and sends the transaction.
7. **The backend relays it.** `src/core/harbour/fetchHook.ts` makes the Harbour API look like an ordinary RPC endpoint: it signs each call with the device key and turns `eth_sendRawTransaction` into a broadcast request to the backend.

The popup follows a shorter path. A button calls `bg({ type: '...' })` in `src/popup/api.ts`, which sends the message over the `harbour-ui` port. `src/background/index.ts` looks the message name up in the event registry (`kernel/events.ts`) and runs the handler registered in `modules/` or `handlers/`.

To add a feature, register a new message handler in `src/background/handlers/` (add it to `handlers/index.ts`), then call it from a screen with `bg(...)`. Anything that moves value also needs a check in `core/harbour/policy.ts`.

## Everyday commands and tests

Run extension commands from `harbour-wallet-v3`, backend commands from `harbour-wallet-v3/backend`.

| Command | Where | What it does |
| --- | --- | --- |
| `npm test` | extension | All Node tests in `test/` (about 478 results; `chains.test.js` needs a file outside the repo and fails on a plain clone) |
| `npm run lint` | extension | ESLint, zero warnings allowed |
| `npm run verify` | extension | The full pre-release check in `scripts/verify.mjs` |
| `npm run check:rpc` | extension | Probes every configured RPC endpoint; needs internet |
| `npm run build` | extension | Production build into `dist/` |
| `make test` | backend | `go test -race ./...`, no services needed |
| `make test-integration` | backend | Integration tests against the Docker Postgres and Redis |
| `make lint` | backend | `golangci-lint` plus the provider-name check |

The backend's chain list is generated from the extension's testnet list: edit `src/core/chains/testnets.ts`, then run `backend/scripts/gen_chains.py` so the extension, backend and faucets stay in step. Add a custom RPC provider in `backend/config/providers.yaml` and `chains.yaml`; no Go code is needed for a plain URL provider.

Before you open a pull request: `npm run lint`, `npm test`, and for backend changes `make test`. Work on branch `harbour-v3` and commit in small steps.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `./run.sh` stops with "No RPC provider key in .env" | Expected on first run. Add `ALCHEMY_API_KEY` or `INFURA_API_KEY` to `backend/.env` and rerun |
| "Docker is not running" | Start Docker Desktop and wait for it to finish starting |
| `npm run build` fails with "VITE\_HB\_API\_URL must be https://" | The backend URL must be https, except localhost. Unset it for local work |
| `npm run build` stops on type errors in `cardano.ts`, `algorand.ts` or `device.ts` | You are using a newer TypeScript than the project's 5.5.4. Run `npm ci` and use `npx tsc -v` to confirm, or build with `npx vite build` |
| esbuild says it was "installed for another platform" | `node_modules` was copied from another machine or operating system. Delete it and run `npm ci` where you work |
| Extension changes do not appear | Click the reload icon on the extension in `chrome://extensions`. For provider changes also hard-reload the website tab, because the page script loads at document start |
| Balances, history or prices stay empty | The backend is not running, or the build points at another URL. `dist/build-info.json` shows the address baked into the build; run `./run.sh status` |
| A dApp such as chainlist opens MetaMask instead | Turn on Settings, Connections, "Use Harbour as default wallet", then reload the website tab |
| A token or NFT you own is missing | By design only each network's native coin shows by default. Add tokens by contract address and import NFTs; history then covers only what you added |
| A chain added from chainlist is not saved | Its supplied RPCs may be rate-limited (HTTP 429). Harbour tries up to six; retry later or add the network under Settings, Custom networks with an RPC you trust |

Still stuck? Check `./run.sh logs` for the backend and the extension's service worker console (`chrome://extensions`, then "service worker" on the Harbour card) for the extension.
