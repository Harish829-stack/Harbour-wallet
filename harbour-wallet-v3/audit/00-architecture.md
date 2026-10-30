# Harbour Wallet: architecture map (as found in code)

| Component | Path | Role |
| --- | --- | --- |
| Manifest | `manifest.config.ts`, `dist/manifest.json` | MV3, CSP, permissions, host permissions |
| Service worker | `src/background/index.ts` | Boot, internal router (`isInternalWalletSender`), auto-lock, `uiSafe` filter |
| Vault / keys | `src/core/vaultService.ts`, `keySchedule.ts`, `passworder.ts`, `walletService.ts`, `background/keys.ts` | Argon2id → HKDF → AES-GCM vault; wallet-core keystores; signing keys per operation |
| Secrets UI boundary | `src/background/handlers/secrets.ts`, `secretRender.ts`, `clipboard.ts`, `src/offscreen/clipboard.ts`, `reauth.ts` | Reveal and backup as images, re-auth grants, clipboard wipe |
| Biometrics | `src/core/passkey.ts`, `src/core/passkeyService.ts` | WebAuthn credential; vault keys sealed under the user handle |
| dApp provider (worker) | `src/background/provider/index.ts`, `service.ts`, `view.ts`, `signer.ts` | Port handling, method router, approval queue, approval view (decode, simulate, risk) |
| Content script | `src/content/content.ts` | Isolated-world relay with schema and allowlist checks |
| Inpage provider | `src/inpage/*.ts` | EIP-1193/6963 and multi-chain providers in the MAIN world |
| Popup / side panel | `src/popup/**` | UI; approval window at `#/notification` |
| Chain sends | `src/core/chains/send/*.ts`, `src/background/handlers/chainSend.ts` | Per-family build, sign and broadcast |
| RPC / network kit | `src/kit/*`, `src/config/rpcEndpoints.json`, `src/core/harbour/fetchHook.ts` | Failover, signed remote config, Harbour API proxy |
| Harbour API client | `src/core/harbour/client.ts`, `device.ts` | Ed25519 device key (non-extractable), signed requests |
| Backend API | `backend/internal/api/*.go`, `backend/cmd/api` | Device auth, quotas, read API, RPC proxy, broadcast, media proxy |
| RPC gateway | `backend/internal/gateway/*`, `backend/cmd/rpc-gateway` | Upstream pool, cache, health, metrics |
| Indexer / ingest | `backend/internal/indexer`, `ingest`, `cmd/indexer`, `cmd/webhook-ingest` | Backfill, live webhooks, reorg repair, finality |
| Store / DB | `backend/internal/store/*.go`, `backend/migrations/*.sql`, `backend/deploy/postgres` | Postgres schema, LinkCrypto, roles |
| Infra (local) | `backend/deploy/docker-compose.yml`, `backend/Dockerfile` | Postgres, Redis, NATS, Centrifugo, services |
| Backend CI | `backend/ci/backend.yml` | vet, lint, test, govulncheck, gosec |
| Release | `scripts/release.mjs`, `verify-release.mjs`, `repro.mjs`, `audit-gate.mjs`, `verify.mjs`, `releases/` | Signed zip, reproducibility check, npm audit gate |
| Legacy gateway | `gateway/worker.ts`, `gateway/push.ts` | Cloudflare Worker (superseded by `/v1/gw`) |
