# TEST_DISCOVERY.md — Phase 0 (Harbour Wallet v3)

Status: COMPLETE (2026-11-19). Built from source, schemas, configs and docs only. No test file, test directory, coverage report or CI test config was opened (`apps/extension/test/`, `apps/backend/**/_test.go`, `apps/backend/contracttest/`, `.github/workflows/*` were deliberately not read).

Scope: `harbour-wallet-v3/` (its own git repo, branch `fix/runtime-network-review`, HEAD `4f44aaa`, 59 commits). Working tree has 5 pre-existing uncommitted deletions under `apps/extension/test/` (dot-files) made by the user; untouched.

## 1. Architecture summary

```
 dApp page (MAIN world)                       Harbour popup / side panel (React, extension origin)
   inpage.js  (EIP-1193 + EIP-6963, Solana,     │  chrome.runtime.sendMessage / port "harbour-ui"
   multi-chain providers)                       ▼
     │ window.postMessage HELLO + MessageChannel   ┌───────────── MV3 service worker (src/background) ─────────────┐
     ▼                                              │ index.ts router → kernel/events (INTERNAL_*) → ~180 handlers   │
 content.js (ISOLATED world, all frames) ──port "harbour-provider"──► provider/ (ProviderService, approval window)     │
                                                    │ core/ vault (Argon2id+HKDF → AES-GCM), wallet-core WASM keystores │
                                                    │ IndexedDB "harbour-secure" (secrets), IDB "harbour-device"        │
                                                    │ chrome.storage.local (TRUSTED_CONTEXTS) / storage.session         │
                                                    │ offscreen clipboard doc, WebAuthn PRF passkeys, WebHID Ledger    │
                                                    │ WalletConnect (Reown WalletKit relay), Web Push (GCM)            │
                                                    └────────────── fetch (device-signed Ed25519) ──────────────────┘
                                                                         │ HTTPS
          ┌──────────────────────────────────────────────────────────────▼───────────────────────────────┐
          │ Go backend (apps/backend, one Docker image, 9 programs)                                          │
          │ api (chi /v1, device auth, PoW registration, quotas, idempotency, /v1/gw third-party gateway,    │
          │      media proxy, realtime tokens, push subs) → rpc-gateway (pooled/hedged JSON-RPC, cache,      │
          │      breakers, bearer token) → Alchemy / Infura / public RPC                                      │
          │ indexer (backfill, webhooks mgmt, gap-fill, reorg repair, NFTs) ← NATS JetStream ← webhook-ingest │
          │ price-poller, tx-tracker, realtime-bridge (→ Centrifugo), notifier (→ Web Push), migrate          │
          │ Postgres (partitioned facts, encrypted device↔address links) · Redis (nonces, quotas, idem, cache)│
          └───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Languages / frameworks
- Extension: TypeScript 5.5, React 18.3, Vite 5.4 + `@crxjs/vite-plugin` 2.0-beta.26, Redux Toolkit 2.2, `@trustwallet/wallet-core` 4.8.2 (WASM crypto), viem 2.31.4, `@noble/hashes`/`@noble/curves`, MetaMask smart-accounts-kit 2.0.0 / delegation-core 3.0.0, Reown WalletKit 1.6, Ledger hw-app-* (WebHID), Solana/Sui/Aptos/TON/Polkadot SDKs. Node 22.
- Backend: Go 1.26.10 (go.mod), chi v5.1, pgx v5.11, go-redis v9.23, nats.go 1.55 (+ embedded nats-server for tests), coder/websocket, decred secp256k1 v4.3, x/crypto (sha3), x/image (webp). Postgres (pg_partman optional), Redis ×2 (state + disposable cache), NATS JetStream, Centrifugo.
- Infra: Docker Compose (`deploy/docker-compose.yml`), Railway config-as-code (`infra/railway/`), Postgres TLS required (verify-full) for non-loopback.

Build & existing test tooling (names only, not content)
- Extension: `npm test` = `node --test test/*.test.js` (Node built-in runner, plain JS); `npm run verify` = eslint → check-frozen → tsc → unit tests → prebuild → vite build → npm-audit gate → lockfile check → secret-leak scan of the bundle. No Playwright/Puppeteer, no coverage tool, no property-based or mutation tool in `package.json`.
- Backend: `make test` = `go test -race ./...` (unit + gateway + contract suite, no services); `make test-integration` = api/indexer/prices against Compose Postgres + Redis (env `HB_TEST_POSTGRES_URL`, `HB_TEST_REDIS_URL`); `make lint` = golangci-lint (depguard) + provider-name check. Go has native fuzzing (`go test -fuzz`) available with no new dependency.
- CI: `.github/workflows/backend.yml`, `extension.yml` (exist at repo root; not read in Phase 0–2).

Execution environments available to this effort (affects Phases 4–5)
- User's computer VM (where the repo lives): Node 22.23 + npm (registry reachable), `node_modules` installed (421 pkgs), aarch64, 4 CPU, 3 GB RAM, **only ~875 MB free disk**, **no Go, no Docker, no Postgres/Redis**, go.dev / proxy.golang.org blocked.
- Cloud container: Go 1.24.7 (repo needs 1.26.10), Docker, psql, redis-server, Node 22; proxy.golang.org not resolvable from here either (in no-proxy list but no DNS) → Go module download / toolchain fetch must be solved in Phase 5 (try routing through HTTPS_PROXY or vendoring from the module cache). Recorded as a blocker risk, not assumed solved.

## 2. Module list

### 2.1 Extension (`apps/extension`, ~35.6k LOC TS/TSX excl. generated chain list)
| Area | Paths | Responsibility |
|---|---|---|
| Manifest / CSP | `manifest.config.ts` | MV3; min Chrome 137; CSP `script-src 'self' 'wasm-unsafe-eval'`, Trusted Types `'none'`; perms alarms, storage, clipboardWrite, notifications, scripting, sidePanel, gcm, idle, offscreen; host `https://*/*` (+ loopback in local builds) |
| SW entry & router | `src/background/index.ts`, `kernel/{events,port,boot}.ts`, `accessPolicy.ts` | boot pipeline, INTERNAL_ event registry, `harbour-ui` port, auto-lock alarm, idle lock, storage access-level pinning, `uiSafe` + `sanitizeResult` on every response |
| Handler modules | `src/background/modules/{wallet,market,swap,tokens,settingsCore}.ts`, `handlers/*.ts` (19 files) | ~180 named messages (wallet lifecycle, send, earn, swap, NFTs, ramps, perps, predictions, provider admin, secrets, smart account, WalletConnect, Ledger, discover) |
| Vault & keys | `core/{vaultService,keySchedule,passworder,passwordService,passwordPolicy,keyMigration,storage,secureStore,walletService,importKey,seedWords,backupSession,backupVerify,onboardingRules}.ts`, `background/{keys,reauth,secretRender,clipboard,qrStage}.ts`, `offscreen/clipboard.ts` | Argon2id v2 / PBKDF2 v1 KDF, AES-GCM vault, wallet-core keystores (aes-128-ctr), unlock throttle, re-auth grants, secret rendering to PNG, offscreen clipboard, QR staging |
| Biometrics | `core/{passkey,passkeyService}.ts`, `popup/biometricsUi.tsx` | WebAuthn PRF seal (prf-v1), legacy user-handle seal retirement |
| dApp provider | `src/inpage/*`, `src/content/content.ts`, `core/provider/*` (21 files), `background/provider/*` (12 files) | EIP-1193/6963, Solana wallet-standard-ish, multi (Cosmos/Sui/Aptos/TON/Tron/BTC PSBT); method allowlist, param normalisation, permission store, pending queue, approval window, rate limits, phishing lists, SIWE/SIWS, simulation, typed-data |
| Smart accounts | `core/smartAccount/*`, `background/smartAccountService.ts`, `handlers/smartAccount.ts` | EIP-7702 delegate (MetaMask Stateless7702), ERC-4337 v0.7 user ops via Pimlico, EIP-5792 calls, ERC-7715 grants, guard checks |
| Chains / send | `core/chains/**` (adapters + 24 send builders), `core/{sendService,erc20,gasFees,evmCode,rpc,networks,networkRegistry,customTokens}.ts`, `handlers/chainSend.ts` | multi-chain tx building/signing, address validation, fee estimation, custom networks/tokens |
| DeFi features | `core/swap/*`, `background/swapService.ts`, `core/staking/*`, `handlers/{earn,earnEvm,earnKeys,testnetDefi}.ts`, `integrations/testnet-defi/*`, `core/perps/hyperliquid.ts`, `core/predictions/polymarket.ts`, `core/ramps/*` | LI.FI/Jupiter/Relay/THORChain swaps with safety decoding, staking on 8 families, Aave/Uniswap testnet, Hyperliquid, Polymarket, on/off ramps |
| Data / activity | `core/activity/*`, `core/{txHistory,activityFeed,balanceService,priceService,marketData,fiat,fiatTable,tokenPrice,approvals,approvalScan,addressBook}.ts`, `core/nfts/*`, `background/{notify,activityRuntime,harbour}.ts` | history merge/classify, balances, prices, NFT lists, approvals scan, notifications, realtime |
| Backend client | `core/harbour/{client,device,fetchHook,config,data,policy,schema,chainList.gen}.ts` | Ed25519 device identity (non-extractable WebCrypto), PoW registration, signed requests, RPC/broadcast routing, signing policy, feature flags |
| Kit | `src/kit/*` | http client, failover fetch w/ circuit breakers, signed remote config, provider endpoints |
| Store | `background/store/*` | Redux slices (non-secret), versioned store migrations, debounced persistence |
| Popup UI | `src/popup/**` (~70 files) | onboarding, unlock, wallet, send, swap, settings, approvals ("notification" route), reveal gates, secure field |
| Scripts | `scripts/*.mjs` | build, release signing/verification, audit gate, frozen-code check, chain registry generation |
| Legacy | `gateway/{worker,push}.ts` | Cloudflare Worker (v2), README says not deployed but still type-checked |

### 2.2 Backend (`apps/backend`, ~17.6k LOC Go non-test, 627 funcs)
| Package | Responsibility |
|---|---|
| `cmd/{api,rpc-gateway,indexer,webhook-ingest,price-poller,tx-tracker,realtime-bridge,notifier,migrate,hbdevice,hbkeys,hbverify}` | program entry points |
| `internal/api` (server, auth, handlers, read, send, media, realtime, gateway) | public HTTP API |
| `internal/devicesig` | canonical string, Ed25519 verify, PoW |
| `internal/evmtx` | RLP decode, tx hash, sender recovery (secp256k1), RLP encode |
| `internal/gateway` | JSON-RPC pool: scoring, hedging, session pinning, breakers, token buckets, LRU cache with finality policy, singleflight, log splitting, broadcast fan-out, metrics |
| `internal/store` | pgx access: devices, LinkCrypto (AES-GCM + HMAC blind index), SecretBox, ingest, balances, NFTs, webhooks, deliveries, heartbeats, pending txs, push, prices, migrations runner, app-login creation |
| `internal/indexer` | backfill, dormant probing, live webhooks mgmt, delivery handling, gap-fill, reorg repair, balance refresh, NFT sync, spam scoring |
| `internal/ingest` | webhook receive → verify HMAC → replay window → JetStream |
| `internal/{txtrack,notifier,prices,realtime,events,ratelimit,rpchttp,config,logx,registry,hbclient}` | tracker, push notifier, price poller/cache, Centrifugo JWT + bridge, NATS, limiter, upstream HTTP, config load/validate/secrets |
| `adapters/*` | provider adapters (alchemy/infura/url RPC, alchemy indexer source + webhooks, coingecko/alchemy prices, alchemy risk simulator, webpush, evm chain client/ABI) |
| `migrations/0001..0010.sql` | schema (embedded, up-only, advisory-locked runner) |

### 2.3 Database (Postgres)
Tables: `chains`, `assets`, `devices`, `tracked_addresses`, `device_addresses`, `event_keys`, `transactions` (RANGE-partitioned by month), `transfers` (RANGE-partitioned), `price_ticks`, `balances`, `nft_holdings`, `address_activity` (HASH ×32), `balance_snapshots`, `pending_transactions`, `webhooks`, `webhook_deliveries`, `service_heartbeats`, `push_subscriptions`, `push_routes`, `schema_migrations`. Functions: `harbour_ensure_monthly_partitions`, `harbour_ensure_partition` (SECURITY DEFINER), `hb_ref`, `hb_ref_text`, `hb_refs`. Roles: `harbour_api`, `harbour_indexer`, `harbour_prices`, `harbour_tracker`, `harbour_app` (+ LOGIN users created by `migrate`). No down migrations exist.

Redis keys (state): `hb:chal:<ip>:<hour>`, `hb:pow:<challenge>`, `hb:reg:all:<hour>`, `hb:nonce:<devtag>:<nonce>`, `hb:rl*:<devtag>:<min>`, `hb:bf:<devtag>:<day>`, `hb:idem:<devtag>:<keytag>`, `hb:rlmedia:<ip>`, `hb:media:<key>`, `hb:price:<asset>`; cache Redis: `hb:rc:*`, gateway cache.

## 3. Entry points
- Extension: SW `src/background/index.ts`; popup `src/popup/index.html#/…` (also side panel, approval window `#/notification`, onboarding tab); content script `public-content.js` (registered dynamically, all frames, `document_start`); inpage `inpage.js` (MAIN world); offscreen `src/offscreen/clipboard.html`; alarms (`harbour:remote-config` 360 min, lock alarm, activity, provider GC 1 min, WC keepalive 30 s); `runtime.onInstalled`, `idle.onStateChanged`, `storage.onChanged`, GCM push, WalletConnect relay events, WebHID.
- Backend HTTP: api `/healthz`, `/v1/devices/challenge`, `/v1/devices`, `/v1/media/{key}`, `/v1/push/vapid`, signed group `/v1/me`, `/v1/me/addresses` (GET/PUT), `/v1/rpc/{chain}`, `/v1/gw/*` (GET/POST, ~20 provider routes + `/v1/config`), `/v1/me/portfolio`, `/v1/me/portfolio/chart`, `/v1/me/history`, `/v1/me/nfts`, `/v1/assets/{chain}/{asset}`, `…/prices`, `/v1/tx/{chain}/{hash}`, `/v1/tx/{chain}/estimate|simulate|broadcast`, `/v1/realtime/token`, `/v1/me/push` (PUT/DELETE). rpc-gateway `/rpc/{chain}`, `/status`, `/metrics`, `/healthz`. webhook-ingest `/webhooks/{source}`, `/healthz`. indexer `/healthz`.
- Backend async: NATS subjects `address.added`, `chain.<c>.activity.raw`, gap-fill subject, `tx.status.<chain>`, `price.tick`, balance events; cron `migrate -maintain`.

## 4. Trust boundaries (attacker-reachable edges)
| # | Boundary | Untrusted side | Enforcement observed in source |
|---|---|---|---|
| TB1 | Web page → inpage/content | any https page script, iframes, sandboxed frames | nonce'd MessageChannel handshake; `parsePageRequest` (id/ns/method regex, plain-JSON scan, 256 KiB, proto-key reject); method allowlist; MAX_INFLIGHT 200; blocked domains |
| TB2 | content script → SW provider port | compromised renderer / content script | sender identity from `port.sender` (tab, frame, documentId, origin); `normalizeOrigin` (https or loopback http); extension URLs rejected; rate limiters per origin; permission store; approval window |
| TB3 | Any extension context → SW internal router | content scripts share the extension id | `isInternalWalletSender` (exact `chrome-extension://<id>/src/popup/index.html`); `stripExternalFlags`; port `harbour-ui` same check |
| TB4 | SW → popup (dumb-UI rule) | popup DOM/XSS, extensions with debugger | `findSecretField`/`uiSafe` on responses; secrets rendered to PNG; offscreen clipboard; Trusted Types CSP. **Gap to test: Redux patches over `harbour-ui` port are NOT passed through `uiSafe`.** |
| TB5 | Storage at rest | profile thief, content-script/renderer exploit | secrets in extension-origin IndexedDB; storage.local/session pinned to TRUSTED_CONTEXTS; Argon2id (m=46 MiB,t=2,p=1) + HKDF; AES-GCM v2 envelope; keystores aes-128-ctr |
| TB6 | Extension → Harbour API | network attacker, malicious server responses | HTTPS; Ed25519 device signature over canonical string; PoW difficulty capped client-side (≤26); response parsing; tx hash check on idempotent replay |
| TB7 | Internet → API | any client, bots | PoW + per-IP challenge limit + global registration ceiling; signed requests, ±skew, nonce replay (Redis SETNX); per-device quotas/tiers/probation; auth-failure budget per IP; 1 MiB body cap; idempotency; security headers |
| TB8 | API → third-party providers (`/v1/gw`) | key abuse by registered devices, upstream responses | path regex allowlist, JSON-RPC re-marshal (case/duplicate-key strict), method sets, eth_getLogs bounds, Solana getProgramAccounts bounds, Uniswap chain gate, Pimlico policy pinning, key scrubbing, caching |
| TB9 | API → media origins (SSRF) | NFT metadata URLs from providers | dial-time IP blocklist, redirect cap/scheme, size/pixel caps, re-encode to PNG, semaphore |
| TB10 | Provider → webhook-ingest | forged/replayed webhooks | per-webhook HMAC-SHA256 (AES-GCM-encrypted signing key), replay window, dedupe |
| TB11 | Services → Postgres/Redis/NATS/Centrifugo | lateral movement | per-service DB logins in `harbour_app`, TLS verify-full, NATS auth, Centrifugo HS256 JWT with `aud`, gateway bearer token (optional!) |
| TB12 | SW → RPC / Solana / third-party APIs directly | hostile RPC responses | failover fetch, chain-id probe, swap safety decoding, smart-account guard, simulation |
| TB13 | dApp-supplied network config | wallet_addEthereumChain RPC URL | `isPrivateNetworkUrl`, chain-id probe, approval |
| TB14 | Remote config | backend / CDN | Ed25519 signature, version monotonic, optional `expiresAt` |
| TB15 | QR import / WalletConnect / Ledger / passkeys | camera input, relay peers, USB device, authenticator | UR/gzip limits, one-time code + 5-try destruction, WC permission key suffix, address-match on keys, PRF-only seals |

## 5. External dependencies (runtime)
Alchemy (RPC, NFT, webhooks, prices, simulation), Infura, public RPCs, CoinGecko, GeckoTerminal, LI.FI, Uniswap Trading API, Jupiter, Relay, THORNode, Helius, Etherscan v2, TronGrid, TONCenter, Pimlico (bundler/paymaster), RSS feeds, MetaMask eth-phishing-detect + ScamSniffer lists (GitHub raw), Reown WalletConnect relay, Web Push services (FCM/Mozilla/Apple/WNS), Hyperliquid, Polymarket, DeFiLlama, GoPlus.

## 6. Ambiguities, unclear behaviours and suspected defects to verify by test (not yet confirmed)
| ID | Location | Observation | Treated in plan as |
|---|---|---|---|
| AMB-01 | `background/index.ts:71-72` | Comment says vault state is "readable while the wallet is locked" for the notification watcher, but `VaultService.getState()` throws `LOCKED` when locked. Notifications while locked may silently not work. | assert actual behaviour; flag |
| AMB-02 | `background/kernel/port.ts:14-21` | Store patches broadcast to UI ports bypass `uiSafe`. Safe only if no slice ever holds a secret. | P0 security test (invariant) |
| AMB-03 | `core/vaultService.ts:25` | `create()` is not serialized via `vaultQueue`; two concurrent creates can both pass `exists()`. | P0 race test |
| AMB-04 | `background/handlers/index.ts:154` | Handler maps are merged by object spread: a duplicate message name across modules is silently overridden (only cross-registry duplicates throw). | P1 test |
| AMB-05 | `api/handlers.go:103-127` | `PUT /me/addresses` commits removals, then charges the daily backfill counter, then may fail with `quota_exceeded` → removals persist and backfill budget is consumed for a rejected add. | P1 test; likely BUG |
| AMB-06 | `api/handlers.go:251-268` | `filteredLogs` treats `topics: [[null]]` (and `[[]]`?) as filtered; nested null topics may allow an unfiltered query. | P0/P1 abuse test |
| AMB-07 | `api/read.go:81-103` | `formatUnits` with negative decimals panics (slice out of range); huge decimals allocate unboundedly. Decimals originate from provider metadata. | P1 robustness/fuzz |
| AMB-08 | `api/auth.go:203-218` | Revoked device keeps access for up to 60 s (in-process cache), per API replica. | P1 test documenting window |
| AMB-09 | `api/server.go:369` | HSTS decision trusts `X-Forwarded-Proto` from any peer when TrustProxy is on (not only trusted proxies). | P3 |
| AMB-10 | `gateway/server.go:25`, `cmd/rpc-gateway/main.go:33-36` | rpc-gateway auth is skipped when token is empty; the binary refuses to start without `GATEWAY_INTERNAL_TOKEN` unless `GATEWAY_ALLOW_NO_TOKEN=1`. Handler-level behaviour with empty token must be pinned. | P1 config test |
| AMB-11 | `kit/remoteConfig.ts:31` | `expiresAt` optional: a signed config without it can be replayed indefinitely (version check only blocks downgrade relative to a stored version). | P1 |
| AMB-12 | `core/walletService.ts:8` | `HDWallet.create(128, passwordKey)` passes the session key as BIP-39 passphrase; only the mnemonic is kept, addresses derived with empty passphrase. Harmless if consistent; must be pinned by KAT. | P0 KAT |
| AMB-13 | `core/walletService.ts:30-34` | `accountPath` replaces the LAST `0` char of the default path; for some coins this changes a hardened account/change segment rather than the address index. Parity with TW claimed; verify per coin. | P0 derivation table test |
| AMB-14 | `core/provider/methods.ts normalizeEthSign` | eth_sign data that happens to be valid UTF-8 (even 32 bytes) is signed with the personal prefix, not raw. TW parity; verify and document. | P1 |
| AMB-15 | `core/provider/origin.ts isPrivateNetworkUrl` | Hostname-only check; DNS names resolving to private IPs (rebinding, `*.nip.io`) pass. | P1 |
| AMB-16 | `migrations/0002,0003` | SECURITY DEFINER `harbour_ensure_partition` has no `REVOKE EXECUTE FROM PUBLIC`; restricted to two parent names, so impact low. Creating a month partition when the DEFAULT partition already holds rows for that month will error. | P2 DB tests |
| AMB-17 | `evmtx/sender.go` | High-s (non-EIP-2) signatures and non-canonical RLP are not rejected; legacy typed `0x00` prefix handling. Node rejects them anyway; behaviour must be pinned. | P1 fuzz/KAT |
| AMB-18 | `store/devices.go SecretBox` | No AAD binding ciphertext to webhook id (blobs can be swapped between rows by a DB writer). | P3 |
| AMB-19 | `api/media.go` | GIF decode only first frame; behaviour with animated/oversized frames to pin. | P2 |
| AMB-20 | `kit/failoverFetch.ts` | Retries broadcast calls across endpoints on timeout (same signed bytes; idempotent but may double-submit). | P2 |
| AMB-21 | `handlers/secrets.ts copyPrivateKey` | Copy grant is reusable for 60 s (not one-shot). Intended? | P2 |
| AMB-22 | `ingest.go` replay window | Only the first event's block time is checked. | P2 |
| AMB-23 | `README` | `gateway/worker.ts` legacy, "not deployed": tests treat it as out of scope except type-check. | plan note |

Secrets hygiene observed: root-level key files (`harbour-keys.env`, firebase admin SDK JSON, release/config keys) and `apps/backend/.env`, Postgres CA/server keys exist on disk but are git-ignored (confirmed with `git ls-files`). Tests must never read them.
