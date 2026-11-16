# Architecture

Harbour is a **self-custodial** multi-chain wallet: a Chrome (Manifest V3) extension plus a Go backend. Keys are created, stored and used only inside the extension; the backend never receives a seed, a private key or an unsigned-transaction secret. It reads chains for the extension, relays transactions the extension already signed, and pushes updates.

## The two halves

| | Extension (`apps/extension`) | Backend (`apps/backend`) |
| --- | --- | --- |
| Language | TypeScript, React, Vite | Go |
| Job | vault, signing, dApp provider, UI | chain reads, indexing, prices, relaying, realtime, push |
| Holds | encrypted keystores, device key | provider API keys, address index, prices |
| Talks to | the Harbour API only (plus some non-EVM chain endpoints directly) | providers, Postgres, Redis, NATS, Centrifugo |

The extension reaches the backend through one URL, `VITE_HB_API_URL` (the `api` service). Every request is signed with a per-device Ed25519 key kept as a non-extractable WebCrypto key; there are no user accounts.

## How a request flows

**Opening the wallet.** The popup asks the background worker, the worker calls `GET /v1/me/portfolio` on `api`, and `api` answers from Postgres and Redis (balances from the indexer, prices from the price poller). Nothing on this path calls a provider.

**Adding an address.** `PUT /v1/me/addresses` stores an encrypted link, publishes `address.added`, and the `indexer` backfills history, reads balances from chain with Multicall3, syncs NFTs and subscribes the address to an Alchemy webhook.

**A transfer arrives.** Alchemy calls `webhook-ingest`, which verifies the signature, stores the body, publishes it to NATS and answers 200. The `indexer` turns it into activity rows (deduplicated by `event_keys`), refreshes balances and publishes `balance.changed.<chain>`. `realtime-bridge` copies that to Centrifugo and the open popup updates; `notifier` sends a Web Push if the popup is closed. If a webhook is missed, gap-fill catches it within minutes.

**Sending.** The extension asks `api` for a nonce, gas and fees (`/estimate`), optionally simulates (`/simulate`), builds and signs the transaction locally, and posts the raw transaction to `/broadcast`. `api` decodes it, checks the chain id, requires the sender to be an address this device tracks, relays it through `rpc-gateway` to two upstreams, and stores it as pending. `tx-tracker` follows it to confirmed / failed / dropped and publishes `tx.status.<chain>`.

**A website asks to sign.** `window.ethereum` (injected by `src/inpage`) hands the request to the content script, which validates it and forwards it to the worker. The worker applies the signing policy, opens an approval window showing decoded calldata, simulated balance changes and phishing/address risk, and signs only after the user approves. Details in [extension.md](extension.md).

## Principles

- **Self-custody, "dumb UI".** Key material exists only in the background worker. The popup never imports vault or wallet-core code, and every worker response passes a filter that refuses to carry secrets. Seed phrases and keys reach the screen only as rendered images or opaque chips.
- **Database-first reads.** Heavy reads (history, balances, NFTs, portfolio) come from Postgres, not from live chain calls, so the wallet is fast and provider cost stays flat.
- **Providers are replaceable.** Only `rpc-gateway` and the adapters know a provider exists. Adding an RPC, indexer, price source or chain is configuration or one adapter package; CI blocks provider names from leaking into service code.
- **Idempotent events.** Every fact row is written together with an `event_keys` row, so replays, retries and duplicate webhooks change nothing.
- **Least privilege.** One Postgres login and one NATS login per service; services receive only the variables they read; only `rpc-gateway` holds RPC keys; only `api` holds third-party gateway keys.
- **Only added tokens and NFTs show up.** A chain's native coin is always listed; tokens and NFTs appear after the user adds them, and history tracks only those.

## Technology

| Layer | Choice |
| --- | --- |
| Extension | Chrome MV3, TypeScript, React 18, Vite with `@crxjs/vite-plugin`, Redux Toolkit, `@trustwallet/wallet-core` (WASM) for keys and signing, viem for EVM |
| Vault crypto | Argon2id key derivation, HKDF, AES-256-GCM; WebAuthn PRF for biometrics; Ed25519 device key |
| Backend | Go 1.26, chi, pgx; one Docker image, one binary per service |
| Data | Postgres 16 (monthly partitions, `NUMERIC(78,0)` amounts), Redis 7, NATS 2.10 JetStream, Centrifugo 6 |
| Chain data | Alchemy (RPC, Transfers API, Address Activity webhooks, NFTs, simulation), Infura, optional QuickNode / Chainstack, public RPCs as fallback |
| Prices | CoinGecko first, Alchemy Prices as fallback |
| Third-party (through `api /v1/gw`) | LI.FI, Uniswap Trading API, Jupiter, Relay, Pimlico, Helius, Etherscan v2, TronGrid, TON Center |
| Hosting | Docker Compose locally; Railway for the backend ([deployment-railway.md](deployment-railway.md)); the extension ships through the Chrome Web Store ([release.md](release.md)) |
| Quality gates | ESLint (zero warnings), `tsc`, Node test runner, `golangci-lint` with depguard, `govulncheck`, `gosec`, `npm audit` gate, gitleaks, reproducible signed releases |

Providers and chain coverage are listed in [chains-and-providers.md](chains-and-providers.md).

## Repository layout

```
.
├── harbour-wallet-v3/
│   ├── apps/extension/     Chrome MV3 extension
│   ├── apps/backend/       Go services, migrations, config, Docker Compose
│   └── infra/railway/      Railway config-as-code, one file per service
├── documentation/          this folder
├── research/               Trust Wallet reverse-engineering evidence, tools and write-ups (not needed to build or run)
├── scripts/git-hooks/      pre-commit secret guard
└── .github/workflows/      CI: backend.yml, extension.yml, dependabot.yml
```

## Known gaps

The code reports unsupported paths instead of faking support. Open items at the time of writing:

- Send paths for a few non-EVM chains (ICP, FIO, Nimiq, Aion, Ontology), some non-EVM token coverage, inscriptions and some bridge flows.
- Perps, prediction markets and some Earn flows are UI-first and gated by signed remote-config flags.
- Not yet verified on real hardware: Touch ID / Windows Hello (WebAuthn PRF) and Ledger.
- Railway's Postgres cannot do `verify-full` TLS, so the Railway setup accepts an unverified-but-encrypted connection ([deployment-railway.md](deployment-railway.md)).
- Release hygiene steps that must be done by hand are listed in [security.md](security.md).
