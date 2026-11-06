<!-- Exported from Claude Docs on 2026-11-02. Source: https://claude.ai/artifact/6x85gJ2duGXZ3ax9p3RMku -->
> **Local copy.** Exported from the shared doc https://claude.ai/artifact/6x85gJ2duGXZ3ax9p3RMku on 2026-11-02 (written 2026-10-30). Status: current (banner added 2026-11-02 for the TLS change). Embedded diagrams in the original appear here as text placeholders. Treat code as the source of truth; see `audit/HANDOFF.md`.

# Harbour v3 — New Developer Guide

Oct 30, 2026 · @Harish

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

> **Security changes since this guide was written (2026-10-30 audit fixes):** Postgres now uses TLS with local certificates (`backend/scripts/pg-certs.sh`, run automatically by `./run.sh` and `make up`); biometric unlock needs WebAuthn PRF support and must be turned on again; auto-lock has no "Never" option; Receive and Buy require the phrase to be backed up first; phishing-listed sites are blocked. Details: `harbour-wallet-v3/audit/fixes.md` and `audit/HANDOFF.md`.

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
| `./run.sh restart` | Rebuild and restart the Go services after a code or config change |
| `./run.sh test` | Unit tests, then integration tests against the running stack (needs Go) |
| `./run.sh down` | Stop everything, keep data |
| `./run.sh reset` | Stop everything and delete the local database, Redis and NATS data |

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

## Testnet Swap and Earn

On Ethereum Sepolia the Swap tab uses the Uniswap Trading API, and on Base Sepolia the Earn tab uses Aave V3. Other networks keep the production Swap and Earn providers and show a "Use Sepolia" / "Use Base Sepolia" prompt. The code is in `src/integrations/testnet-defi/` (see its `README.md`), the worker handlers in `src/background/handlers/testnetDefi.ts` and the tab in `src/popup/wallet/defi/TestnetDefiTab.tsx`.

- **Swap** goes through the backend gateway route `/v1/gw/uniswap/v1/{quote,check_approval,swap}`. Set `UNISWAP_API_KEY` in `backend/.env` and restart; without it the route answers `uniswap_not_configured`. The gateway accepts only Ethereum Sepolia (chain 11155111) request bodies. The extension approves only the exact input amount, rejects quotes outside the user's slippage, and checks the swap's target and ETH value before review.
- **Earn** uses AaveKit, Aave's GraphQL API at `https://api.v3.aave.com/graphql`, called directly from the worker; no key is needed. AaveKit lists the reserves and builds supply/withdraw transactions, including native ETH through Aave's WETH gateway. Every transaction it returns is decoded and checked (chain, sender, contract allowlist, token, exact amount, beneficiary, bounded approval) before review. Reserve state and balances are read on-chain. If AaveKit is down or refuses, ERC-20 reserves fall back to the direct-contract builder in `aave.ts`; native ETH needs AaveKit. `EARN_PROVIDER` in `aavekit.ts` switches the provider.
- AaveKit reports "supply cap reached" for Base Sepolia reserves whose on-chain cap is 0 (unlimited, e.g. USDC and USDT). Harbour ignores that flag and uses the on-chain cap.
- Tests: `node --test test/testnet-defi.test.js test/testnet-defi-handlers.test.js test/aavekit.test.js`. Read-only live check: `node scripts/check-testnet-defi.mjs`.

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

Before you open a pull request: `npm run lint`, `npm test`, and for backend changes `make test`. Work on branch `harbour-v3` from the `REA` repository root and commit in small steps.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `./run.sh` stops with "No RPC provider key in .env" | Expected on first run. Add `ALCHEMY_API_KEY` or `INFURA_API_KEY` to `backend/.env` and rerun |
| "Docker is not running" | Start Docker Desktop and wait for it to finish starting |
| Postgres exits with "install: omitting directory '/certs/server.key'" or "Postgres TLS certificates missing" | Since 2026-10-30 Postgres runs with TLS (sslmode=verify-full). The certificates did not exist when Compose started, so Docker made empty folders in their place. Run backend/scripts/pg-certs.sh (it removes those folders and creates the certificates), then ./run.sh or make up again. Both now create the certificates automatically |
| `npm run build` fails with "VITE\_HB\_API\_URL must be https://" | The backend URL must be https, except localhost. Unset it for local work |
| `npm run build` stops on type errors in `cardano.ts`, `algorand.ts` or `device.ts` | You are using a newer TypeScript than the project's 5.5.4. Run `npm ci` and use `npx tsc -v` to confirm, or build with `npx vite build` |
| esbuild says it was "installed for another platform" | `node_modules` was copied from another machine or operating system. Delete it and run `npm ci` where you work |
| `npm run build` fails with "VITE\_HB\_API\_URL must be https:// (got wss://...)" | `VITE_HB_API_URL` is the HTTP base URL, so use `https://` even for a tunnel host. The websocket address is the backend's `REALTIME_PUBLIC_URL` (`wss://...`), which the backend hands to the extension |
| `git status` inside `harbour-wallet-v3` shows a different history from the repo root | `harbour-wallet-v3/` contains a stray local-only `.git` (no remote). Commit and push from the `REA` root, where `harbour-v3` tracks `origin/harbour-v3` |
| Swap says "Uniswap Trading API is not configured" | Set `UNISWAP_API_KEY` in `backend/.env`, then `./run.sh restart` |
| Earn shows "Aave data is temporarily unavailable" | AaveKit (`api.v3.aave.com`) is unreachable. ERC-20 reserves still work on-chain; native ETH supply and withdraw wait for AaveKit |
| Extension changes do not appear | Click the reload icon on the extension in `chrome://extensions`. For provider changes also hard-reload the website tab, because the page script loads at document start |
| Balances, history or prices stay empty | The backend is not running, or the build points at another URL. `dist/build-info.json` shows the address baked into the build; run `./run.sh status` |
| A dApp such as chainlist opens MetaMask instead | Turn on Settings, Connections, "Use Harbour as default wallet", then reload the website tab |
| A token or NFT you own is missing | By design only each network's native coin shows by default. Add tokens by contract address and import NFTs; history then covers only what you added |
| A chain added from chainlist is not saved | Its supplied RPCs may be rate-limited (HTTP 429). Harbour tries up to six; retry later or add the network under Settings, Custom networks with an RPC you trust |

Still stuck? Check `./run.sh logs` for the backend and the extension's service worker console (`chrome://extensions`, then "service worker" on the Harbour card) for the extension.
