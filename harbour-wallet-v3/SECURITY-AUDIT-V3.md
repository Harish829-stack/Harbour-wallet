# Harbour Wallet v3: security audit (extension + backend)

**Date:** 2026-10-28
**Scope:** `harbour-wallet-v3`, which covers:
- the MV3 extension (`src/`, `scripts/`, `manifest.config.ts`, `dist/`)
- the Go backend (`backend/`: api, rpc-gateway, webhook-ingest, indexer, price-poller, tx-tracker, realtime-bridge, notifier, migrations, deploy, CI)
- secrets, supply chain and release
- regression check against the v2 audit (`claude/security.md`, 2026-10-23 and 2026-10-27)

**Method:** static review, run as four passes: architecture and threat model; backend; extension; secrets, supply chain and deploy.
- The lead reviewer read the device-auth path (`internal/api/auth.go`, `internal/devicesig`) personally.
- The backend data plane and the extension were reviewed in two parallel deep passes.
- Every High finding was re-read in code by the lead reviewer before it went into this report.

This is not a penetration test, and no live services were attacked.

**Verification run:**

| Check | Result |
|---|---|
| Extension `node --test test/*.test.js` | 452 of 453 pass. The 1 failure is `chains.test.js` reading a fixture outside the repo (`evidences/...`), an environment problem. |
| `npm audit --omit=dev` | 13 issues: 9 low, 4 high, 0 critical. |
| Bundle secret scan over `dist/` | Clean. No Infura, Alchemy or CoinGecko key values found. |
| Go `build`, `vet`, `test`, `gosec`, `govulncheck` | **Not run.** The Go module proxy is blocked from the audit sandbox. Run them locally (see section 6). |

Severity scale:
- **Critical:** direct loss of funds without user action.
- **High:** a realistic path to secret exposure, signing on the wrong network, or a full-service outage.
- **Medium:** a privacy or DoS problem with real impact, or a defence-in-depth gap on a security boundary.
- **Low and Info:** hardening.

---

## 1. Executive summary

**Verdict: not ready for a public or AWS deployment.** No Critical findings.

There are **8 High** findings, and four of them must be fixed before anyone else installs this build:
1. **The v2 "dumb UI" protection is missing from v3** (V3-01). The popup again receives the seed phrase, private keys and passwords. v3 was copied from v2 before the 2026-10-27 UI-secret-boundary work landed.
2. **"Testnet only" exists only in the UI** (V3-02). Mainnet EVM, Solana, TON, Sui, Aptos, Tron and Bitcoin signing and broadcasting are still reachable, including from any website through the injected providers.
3. **The production bundle's backend URL is `http://localhost:8080`** (V3-03). `.env.production` has no `VITE_HB_API_URL`, and nothing enforces https.
4. **The leaked Sepolia Infura key from the v2 audit was never rotated** (V3-04). It is now also used as a backend provider key.

The other four High findings are backend availability and blast-radius problems. Any cheaply registered device can exhaust shared RPC capacity or gateway memory (V3-05, V3-06), and every service connects to Postgres as superuser (V3-07). V3-08 makes the first two worse: device registration costs well under a second of work.

**What is solid:**
- The device-signature protocol: canonical string, nonce replay, verification order.
- Per-device authorization: no IDOR found.
- The broadcast checks.
- The media proxy's SSRF defences.
- Webhook HMAC verification.
- Centrifugo channel scoping.
- Address-link cryptography, parameterised SQL, non-root distroless containers, and localhost-only ports.
- On the extension side, most v2 controls hold: worker-only keys, the sender gate, origin binding, the approval window for every signature, `eth_sign` off by default, the throttle, and the CSP.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 8 |
| Medium | 15 |
| Low | 17 |
| Info | 8 |

---

## 2. Architecture and trust boundaries (as audited)

```
Popup (UI) ──runtime msg──► Service worker (vault, keys, wallet-core, device key)
                                 │  Ed25519-signed HTTPS (X-HB-*)
dApp page ─inpage─►content─port─►│──────────────► api :8080 ──► Postgres / Redis / NATS
                                 │                     └──────► rpc-gateway :8081 ──► Alchemy / Infura
                                 │◄── wss ── Centrifugo :8000 ◄── realtime-bridge ◄── NATS
                                 │◄── Web Push ◄── notifier ◄── NATS
Alchemy webhooks ──► tunnel ──► webhook-ingest :8082 ──► NATS ──► indexer ──► Postgres
```

Boundaries and what each one has to guarantee:

| Boundary | Must guarantee | Status |
|---|---|---|
| **B1 popup ↔ worker** | Secrets never cross into the popup. | **Broken** (V3-01) |
| **B2 page ↔ worker** | Only approved signatures, only on allowed networks. | Approval holds; **network restriction broken** (V3-02) |
| **B3 extension ↔ API** | Authenticated, private (TLS), and the backend cannot make the user sign something other than what is shown. | Signing holds; **TLS not enforced** (V3-03); backend-trust gaps (V3-15, V3-16) |
| **B4 internet ↔ api / webhook-ingest** | One device or one IP cannot degrade the service for everyone. | **Weak** (V3-05, 06, 08 and the Medium DoS findings) |
| **B5 service ↔ service** (DB, NATS, gateway token) | Least privilege. | **Weak** (V3-07, V3-17, V3-19) |

---

## 3. Findings

Each entry gives the ID, severity, title, evidence (file:line), impact and fix.
- **[V]** means verified end to end in code.
- **[S]** means suspected (depends on runtime or third-party behaviour).

### 3.1 High

**V3-01 · High · [V] v2 "dumb UI" (UI-secret-boundary) is missing in v3, so the popup receives the seed, private keys and passwords**
- **Evidence:**
  - `background/secretRender.ts`, `core/uiSafe.ts` and `popup/secureField.tsx` do not exist in v3. There is no offscreen document either.
  - `src/background/modules/wallet.ts:20` returns `{ mnemonic: await wallet.generateMnemonic() }` to the UI.
  - `wallet.ts:247` returns `mnemonic` to the UI after a new wallet is created.
  - `wallet.ts:313` (reveal) returns `{ ok: true, mnemonic: hd.mnemonic() }`.
  - `handlers/settingsExtra.ts` `revealPrivateKey` returns the key to the UI.
  - The popup stores them in React state: `onboarding/BackupFlow.tsx:21`, `App.tsx:132`.
  - `popup/wallet/walletScreens.tsx:143` copies the key with `navigator.clipboard.writeText`, and the clipboard is never cleared.
  - Password fields are controlled React state (`Onboarding.tsx:68`).
  - `test/boundaries.test.js` only checks imports, so it still passes.
- **Impact:**
  - Any script running in the popup can read the phrase and keys from memory, the DOM or the accessibility tree. That includes a compromised npm dependency in the popup bundle, a future XSS, or an attached debugger or extension.
  - The private key stays on the clipboard indefinitely.
  - The worker hands out `generateMnemonic` with no re-authentication.
- **Fix:**
  - Port the v2 2026-10-27 work in full: worker-painted PNGs (`secretRender.ts`), tile-id backup verification, offscreen copy with a 60 s clear, the `uiSafe` response filter, `secureField` and `onboardingSecure`.
  - Port `test/ui-secrets.test.js`.
  - Add a test that fails if any handler response sent to the UI contains `mnemonic|privateKey|seed|password`.

**V3-02 · High · [V] "Sepolia + Base Sepolia only" is enforced only in UI pick-lists; mainnet signing and broadcasting stay reachable, including from websites**
- **Evidence:**
  - `src/core/chains/index.ts:22-26`: `ENABLED_CHAIN_IDS` filters lists only. The file's own comment says "Lookups (chainById etc.) still see the whole registry".
  - `background/provider/service.ts:187-241` still serves the Solana and multi-chain namespaces:
    - Solana `signAndSend` uses the mainnet RPCs;
    - TON send, Sui execute, Aptos submit and BTC PSBT still work.
  - `dist/inpage.js` still injects `isPhantom`, `keplr`, `tronLink` and an Aptos provider.
  - `chainSend.ts` and `sendService.ts` resolve any registry chain.
  - Swap, Earn, Fund, ramps, perps, predictions and WalletConnect handlers are still registered (`handlers/index.ts:20`).
  - `wallet_addEthereumChain` lets a site add any EVM chain not in the registry (`provider/networks.ts:32`).
- **Impact:** a build presented and tested as testnet-only can sign and broadcast real-value transactions on many networks. The only thing in the way is the approval window, and for non-EVM families that window has the weaker decoding noted in v2 (SIG-08). The extra code is also untested attack surface for a testnet release.
- **Fix:**
  - Add one background guard, `assertChainAllowed(chain)`, in every sign, broadcast and send path, and refuse anything outside `HARBOUR_CHAINS`.
  - Remove the Solana and multi-chain providers from `inpage` and `content` at build time.
  - Leave out the swap, earn, ramps, perps, predictions and WalletConnect modules and screens through a build flag.
  - Refuse site-initiated `addChain`.
  - Add tests that a mainnet request is refused.

**V3-03 · High · [V] Production backend URL is plaintext `http://localhost:8080`, and https is not enforced anywhere**
- **Evidence:**
  - `src/core/harbour/config.ts:6` sets `HB_API_URL = env.VITE_HB_API_URL ?? 'http://localhost:8080'`.
  - `.env.production` has no `VITE_HB_API_URL`.
  - The built `dist/assets/settingsExtra-*.js` contains `VITE_HB_API_URL??"http://localhost:8080"`.
  - The manifest grants `http://localhost/*` and `http://127.0.0.1/*`.
  - The realtime URL is used unchecked: `background/harbour.ts:59` calls `new WebSocket(tok.url)`, and compose sets `REALTIME_PUBLIC_URL: ws://...`.
- **Impact:**
  - Whatever listens on the user's port 8080 becomes the trusted backend: balances, nonce, fees, simulation (see V3-15), broadcast, the VAPID key and the address list.
  - With a remote `http://` URL, a network attacker gains the same control, can read device tokens, and can force device-key resets (V3-30).
- **Fix:**
  - Fail `vite build` in production mode when `VITE_HB_API_URL` is missing or not `https://`.
  - Assert the same at runtime in `config.ts`.
  - Require `wss:` on the same host as the API for realtime.
  - Drop the localhost host permissions from production manifests.
  - Add the check to `scripts/verify.mjs`.

**V3-04 · High (hygiene) · [V] The leaked v2 Infura key was never rotated and is now also a backend production key**
- **Evidence:**
  - v2 finding INF-01 (keyed Sepolia Infura URL shipped in v2 `dist/` and release zips) listed "Rotate the Infura key" as action #1.
  - The same project id, `423f2a…`, is still in `harbour-wallet-v3/.env.development` (`VITE_RPC_11155111`).
  - It is also in `backend/.env` as `INFURA_API_KEY_2`.
  - v3 `dist/` is clean.
- **Impact:** anyone holding an old v2 build can spend the quota of a key that the v3 rpc-gateway now relies on for failover, and can get it blocked.
- **Fix:**
  - Revoke `423f2a…` in Infura and issue new keys for the backend only.
  - Remove `VITE_RPC_*` from the extension entirely, since v3 reads through `/v1/rpc`.
  - Delete old v2 zips that embed the key.

**V3-05 · High · [V] One device request can fan out into about 10,000 upstream `eth_getLogs` calls**
- **Evidence:**
  - `internal/api/handlers.go:175-186`: a batch can hold up to 100 items, charged 1 quota unit each.
  - `config/api.yaml` allows `eth_getLogs` with no address required.
  - `internal/gateway/gateway.go:419-430` splits ranges up to 100 × `logs_max_range` (100 chunks per item).
  - `rpchttp.go:123` accepts upstream bodies up to 64 MB each, combines everything in memory, and the API copies the result back with no cap (`handlers.go:217`).
- **Impact:**
  - One request of 100 × wide `eth_getLogs` ties up the whole provider pool (about 100 rps) for about 100 s, which starves the indexer, tx-tracker and every user.
  - Large address-less results can run the gateway out of memory.
- **Fix:**
  - On `/v1/rpc`, require `address` and cap the range at `logs_max_range` with no splitting (splitting stays for internal callers).
  - Charge the quota by block span.
  - Cap the combined response size.
  - Better still, remove `eth_getLogs` from the public allowlist; v3 history comes from the indexer.

**V3-06 · High · [V] Gateway cache is bounded by entry count, not bytes, and finalized entries never expire, so a device can fill gateway memory**
- **Evidence:**
  - `internal/gateway/cache.go` evicts only when `ll.Len() > max` (`cache_max_entries: 100000`).
  - Results at or below the finalized block are kept with `forever=true`.
  - The cache key is `chain|method|params`, so any allowed method with distinct params adds an entry, for example `eth_getBlockByNumber(n, true)`, which runs to MBs per block.
- **Impact:** the gateway process is killed, and every backend service depends on it.
- **Fix:** bound the cache by bytes, do not cache entries over about 256 KB, and give "forever" entries a TTL or a small separate LRU.

**V3-07 · High · [V] Every service connects to Postgres as superuser; the least-privilege roles are never used**
- **Evidence:**
  - `deploy/docker-compose.yml`: every service uses `postgres://harbour:…`, and `POSTGRES_USER=harbour` is a superuser in the official image.
  - `migrations/0001_init.sql:225-238` creates `harbour_api` and `harbour_indexer` as `NOLOGIN`, and no login user is granted them.
  - The grants use `ON ALL TABLES` at migration time, so later tables get no grants.
  - Even as designed, `harbour_api` gets `SELECT` on everything, including `webhooks.enc_signing_key`.
  - README line 133 says least-privilege roles are in place.
- **Impact:** any bug in the internet-facing api or webhook-ingest gives full database control, including `COPY … TO PROGRAM`, which means code execution in the DB container.
- **Fix:**
  - Create one LOGIN user per service with `GRANT harbour_api TO api_user` and so on.
  - Narrow the grants.
  - Add `ALTER DEFAULT PRIVILEGES` so new tables are covered.
  - Run migrations as the owner only.
  - In AWS, use IAM-authenticated RDS users per task.

**V3-08 · High (enabler) · [V] Device registration is too cheap to bound per-device quotas**
- **Evidence:**
  - `config/api.yaml`: `pow_difficulty: 20`, about 1 million SHA-256 hashes, which is well under 1 s natively.
  - The only other limit is `challenges_per_ip_per_hour: 30` (`auth.go:50`). It is keyed by the full IP, so on IPv6 one /64 gives effectively unlimited registrations.
  - Every per-device limit (120 RPC/min, 50 addresses, 20 backfills/day, push subscriptions) is multiplied by the number of devices an attacker creates.
- **Impact:** V3-05, V3-06 and the Medium DoS findings (V3-11 to V3-14) scale linearly with attacker effort and are not bounded per user.
- **Fix:**
  - Key per-IP limits on the IPv6 /64 (or /56).
  - Add global ceilings per tier, for example total backfills per hour and total RPC units per minute across all `default`-tier devices.
  - Raise difficulty adaptively under load.
  - Have new devices start in a "probation" tier for the first 24 h.
  - Keep the `attestation` field for a future Chrome or Play Integrity check.

### 3.2 Medium

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| **V3-09** [V] | **Privacy: the encrypted device↔address link can be rebuilt without the key.** Four routes: equal `created_at`/`added_at` timestamps in one transaction; plaintext `pending_transactions(device_id, from)` rows that are never deleted; idempotency records storing `PUT /me/addresses` responses for 24 h; portfolio cache keyed by device id. | `store/devices.go:174-190`, `store/send.go InsertPending`, `auth.go:332,362`, `read.go cacheKey` | Truncate or randomise timestamps; HMAC or encrypt `device_id` in pending and delete rows once settled; don't cache response bodies of `/me/addresses`; HMAC device ids in Redis keys. |
| **V3-10** [V] | **Privacy: every wallet address is automatically linked to one device id, without consent,** and the onboarding copy says there is no account. | `background/harbour.ts:17-35` (all EVM addresses of all wallets and accounts, on unlock, change and alarm); `landingPages.tsx:131` says "…there is no Harbour account behind them" | Opt-in or active-account-only tracking; consider one device key per wallet; correct the copy. |
| **V3-11** [V] | **Spoofed token symbols reach push notifications** ("Received 5000 USDC"), the classic poisoning lure. The spam score is recomputed from the symbol alone; the stored `spam_score` and `verified` flags are ignored, and the symbol is not cleaned on the webhook path. | `store/indexer.go:353-371,432`; `notifier.go:90`; `alchemy/webhooks.go:217` | Put amount and symbol in the title only for verified tokens or native currency; otherwise "Received a token (unverified)"; strip control and bidi characters and cap the length. |
| **V3-12** [V] | **One device's push endpoint can stall notifications for everyone.** Delivery is serial with a 15 s timeout, any https host is accepted, and one 5xx NAKs the whole message (redelivered up to 20 times). | `notifier.go:95-97`; `webpush.go:317`; `realtime.go handlePutPush`; `events.go:76,84` | Allowlist push-service hosts (FCM, Mozilla, Apple, WNS); deliver concurrently with a short timeout; retry per subscription. |
| **V3-13** [V] | **Media proxy can be forced into large decodes and its negative cache poisoned.** Up to 40 MP decodes (about 160 MB each) with no global concurrency limit; a client disconnect writes a 1 h negative-cache entry; keys are `sha256(url)[:16]` and unauthenticated. | `media.go:162,252,288,314`; `store/indexer.go:577` | 16 MP cap; a global decode semaphore; fetch with `WithoutCancel` and its own timeout; negative-cache only real 4xx or decode failures; HMAC media keys. |
| **V3-14** [V] | **Forced older-history paging drives provider cost and DB growth.** An unsigned client cursor triggers `address.history.more` every minute per address; the deny list has 5 entries. | `read.go:402-421`; `indexer.go:345-378` | Charge older pages to the backfill quota; HMAC the cursor; auto-deny backfill for high-activity addresses. |
| **V3-15** [V] | **The backend is the only source for the approval-screen preview.** Simulation, gas estimate, token metadata and contract checks for Harbour chains all come from `/v1/rpc`, so a compromised backend can show a drain as harmless. The signed fields (to, value, data, chainId) are built locally (good). | `rpcUrls.ts:8`; `provider/view.ts:150-160`; `service.ts:510-516` | Label the preview "provided by Harbour servers"; never let a clean simulation hide a locally decoded warning; cross-check with an independent RPC for high-value or unknown calls; check `tx_hash == keccak(raw)` on broadcast (`fetchHook.ts:21-23`). |
| **V3-16** [V] | **dApp transaction fee can be unshown and uncapped.** Approve is not blocked when fee presets are missing; the fee is then fetched from the backend at signing time with no ceiling. The in-wallet Send has a fee-jump check; the dApp path does not. | `popup/wallet/features/provider.tsx:118,131,176`; `service.ts:439`; `evmSign.ts:38` | Block Approve without a displayed fee; always pass explicit fees; refuse if the prepared `maxFee` is above the displayed one. |
| **V3-17** [V] | **NATS has no authentication.** Anything on the host or the compose network can publish `activity.new.*`, `tx.status.*` or `address.added`, which means forged pushes and realtime updates. | `docker-compose.yml:33-34`; `realtime/bridge.go`; `notifier.go HandleActivity` | Per-service NATS users or nkeys with subject permissions; remove the `8222` monitor port mapping. |
| **V3-18** [V] | **Gateway sticky-session map grows forever.** It is keyed by the client-chosen `X-HB-Session` and never pruned. | `gateway/pool.go:200,220` | TTL LRU, or delete expired entries on load plus a periodic sweep. |
| **V3-19** [V] | **Every container gets every secret** (`env_file: ../.env`): the api holds provider keys, the VAPID private key, `ALCHEMY_NOTIFY_TOKEN` and `ADDRESS_LINK_ENCRYPTION_KEY`. Postgres uses `sslmode=disable`. | `deploy/docker-compose.yml` (all Go services) | Give each service only its own secrets now; in AWS, use per-task Secrets Manager entries and `sslmode=verify-full`. |
| **V3-20** [V] | **Any website can spend the user's backend quota without connecting.** The `rpc` method group is served before the connection check and signed with the device key, so a hostile tab can rate-limit the wallet out of its own backend and log reads under the user's device. | `provider/service.ts:120-123`; `provider/methods.ts:30-34`; `harbour/fetchHook.ts:46-49` | Require a connection for proxied reads, or route dApp reads through a separate per-site budget that never uses the wallet's own quota. |
| **V3-21** [V] | **Release and verification gates are not runnable as shipped.** `npm run verify` fails at lint (4 errors) before the secret scan; `release-signer.pub` is still missing (v2 action #3), so `verify-release` refuses to run; `releases/Harbour-root-fixed.validation.json` is a stale v2 artefact. | `scripts/verify.mjs`, `scripts/verify-release.mjs`, `releases/` | Fix the lint errors; add the pinned signer key; remove the v2 artefacts; run `verify` in CI. |
| **V3-22** [V] | **4 high `npm audit` findings** (zod < 4.6.6 memory exhaustion, GHSA-mrhx-c7xc-m3w5, through viem, abitype and @ton/ton) plus 9 low (elliptic, through the Ledger and ethers v5 chain). | `npm audit --omit=dev` | Add an `overrides` entry for zod ≥ 4.6.6 once viem's range allows it, or upgrade viem; dropping the TON and Ledger mainnet code (V3-02) also removes most of the chain. |
| **V3-23** [S] | **Backend dependencies not scanned.** govulncheck could not run here. The pinned versions are `golang.org/x/crypto v0.36.0`, `x/image v0.21.0` (used by the media decoder), `nats-server v2.10.22`, `pgx v5.7.1`, and the `go 1.23.0` directive. The Dockerfile also runs `go mod tidy` at build time, which is not reproducible. | `backend/go.mod`, `Dockerfile` | Run `govulncheck ./...` and `gosec ./...` locally or in CI; remove `go mod tidy` from the Dockerfile and commit a complete `go.sum`. |

### 3.3 Low

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| V3-24 | Gateway token check is skipped when `GATEWAY_INTERNAL_TOKEN` is empty, which leaves broadcast open. Mitigated by setup.sh and a localhost bind. | `gateway/server.go:25` | Refuse to start without a token outside explicit dev mode. |
| V3-25 | Privacy oracles: an unauthenticated `/v1/media/{key}` 200/404 reveals NFT ownership by Harbour users; `/v1/tx/{chain}/{hash}` reveals `source` (indexed or pending), `from` and `submitted_at` to any device. | `media.go:42-71,303` | HMAC media keys; return the same response regardless of source; give pending details only to the device that broadcast. |
| V3-26 | Finalization can promote reorged-out rows without a hash check once the queue is longer than 300. Affects history only; balances are re-read from the chain. | `indexer/live.go:510`; `store/live.go:281-285` | Finalize only after the block-hash check; drain the queue. |
| V3-27 | Webhook ingest does a DB lookup for any `webhookId` before the HMAC check; no `createdAt` freshness window, so a captured delivery can be replayed and can re-insert events that reorg repair removed. | `ingest.go:114-124` | Negative-cache unknown ids; reject deliveries older than 10 min. |
| V3-28 | An oversized symbol makes Web Push encryption fail, which is mapped to `ErrGone`, which deletes the subscription. [S] | `webpush.go:150-152`; `notifier.go:148` | Truncate titles; don't treat oversized payloads as Gone. |
| V3-29 | Idempotency edge cases: 429 and 409 responses are stored for 24 h; a handler panic leaves the key "pending" for 24 h; a replayed broadcast returns an expired channel token. | `auth.go:316-364` | Don't store 4xx rate-limit or conflict responses; `defer` cleanup on panic; re-mint the token on replay. |
| V3-30 | Any 401 wipes the device key and re-registers, so server-side revocation has no effect and a hostile network or backend can force rotation (which drops push and tracked state). | `harbour/client.ts:63-66`; `auth.go:193-241` (one `unauthorized` code for every cause) | Return distinct error codes; re-register only on `device_unknown`, never after `revoked`. |
| V3-31 | Device revocation is cached for 60 s per api replica. | `auth.go:153-167` | Publish revocations on NATS to clear the cache, or shorten the TTL for revoked lookups. |
| V3-32 | The server-supplied PoW difficulty is not capped in the client, so a malicious backend can stall registration (and every call waits on it). | `harbour/device.ts:195` | Cap the client side at about 24 bits. |
| V3-33 | Device-key fallback stores a raw seed in IndexedDB when WebCrypto Ed25519 is missing. `minimum_chrome_version: 114` likely predates unflagged Ed25519. [S] | `harbour/device.ts:147-155`; `manifest.config.ts` | Raise the minimum Chrome version to one with Ed25519 and remove the fallback; fix the misleading comment. |
| V3-34 | The legacy GCM push path opens any `https://` URL from the payload on click. It is the fallback whenever Web Push setup fails. | `background/notify.ts:49,118-121` | Build URLs locally (as the Web Push path does) or remove the legacy path. |
| V3-35 | The legacy `sendTx` handler is still registered. It resolves `hb-` tokens and fees from the backend at send time with no review. It is unused by the popup, and `hb-` tokens cannot be sent through the reviewed flow. | `background/modules/send.ts:15-65` | Remove it; add `hb-` token support to `chainSend` with on-chain decimals bound into the plan hash. |
| V3-36 | Connecting an EVM dApp always fails: the default chain is 1 (not enabled) instead of `DEFAULT_DAPP_CHAIN`. Users may look for unsafe workarounds. | `provider/service.ts:77`; `view.ts:37`; `provider.tsx:108` | Use `DEFAULT_DAPP_CHAIN`; add a connect test. |
| V3-37 | `TRUST_PROXY_HEADERS=1` trusts the first `X-Forwarded-For` value from any client, which makes per-IP limits spoofable. | `server.go:115` | Behind an ALB, trust only the ALB's appended hop (a trusted-proxy CIDR list). |
| V3-38 | `deploy/centrifugo/config.json` holds literal `${…}` placeholders. Centrifugo does not expand them; it is safe only because compose overrides them with env vars. Run any other way, the HMAC key is a known string. | `deploy/centrifugo/config.json` | Remove the secret fields from the file. |
| V3-39 | Media SSRF blocklist misses `64:ff9b::/96`, `198.18.0.0/15` and `240.0.0.0/4`. The dial-time check is otherwise sound. | `media.go` | Add those ranges. |
| V3-40 | Backend secret `ALCHEMY_NOTIFY_TOKEN` sits in the extension's root `.env`. Vite does not inline non-`VITE_` variables, so it is not in `dist/`, but it is misplaced. | `harbour-wallet-v3/.env` | Keep backend secrets only in `backend/.env` (and Secrets Manager later). |

### 3.4 Info

- **V3-41:** gateway error `data.upstreamsTried` (for example `ethereum/alchemy-a`) is passed to clients and reveals provider topology. Strip it in the api.
- **V3-42:** `decodeAggregate3` allocates `make([]result3, n)` with `n` taken from RPC output, so a malicious provider could exhaust indexer memory. Bound `n` by the call count.
- **V3-43:** `cleanText` can split a UTF-8 rune at 128 bytes, so the insert fails silently and the token is re-queried on every refresh.
- **V3-44:** `Idempotency-Key`, `X-HB-Session` and `Content-Type` are not covered by the request signature. Acceptable with TLS (V3-03).
- **V3-45:** `backend/.hbdevice.json` holds a dev device seed. It is git-ignored; keep it out of shared copies.
- **V3-46:** strict checksum validation applies to user-entered addresses; the dApp `to` field is checked by format only. Matches common wallets.
- **V3-47:** `config/config.json` (remote config source) has no `issuedAt`/`expiresAt`. These are stamped at signing time by `config-tool sign`; make sure the published copy is signed and in date (v2 action #4).
- **V3-48:** the Cloudflare `gateway/` (v2) is still in the tree and in `dist` (`harbour-gateway…workers.dev`). Whether the v2 gateway fixes (INF-03/04/05/06/13) were redeployed could not be confirmed.

---

## 4. Controls verified as sound

**Backend**
- **Request signing:** the canonical string `HB1\nMETHOD\nRequestURI\ndate\nnonce\ndevice\nsha256(body)` matches byte for byte between Go (`devicesig.Canonical`) and the extension (`harbour/client.ts:39-40`).
- **Signature order of checks:** the signature is verified before the nonce is consumed, so nonces cannot be burned by an unauthenticated caller. Nonces are single-use (Redis `SetNX`, 2× the skew window). Clock skew is ±5 min. The body is capped at 1 MB globally.
- **Registration:** the challenge is single-use (`GETDEL`), the PoW is bound to the public key, and proof of key possession is required. Duplicate keys are refused.
- **Authorization:** every `/me/*` query is scoped to the authenticated device. `?addresses=` must be tracked by the device. Session pins are prefixed with the device id. No IDOR found.
- **Broadcast:**
  - strict RLP decode with no trailing bytes;
  - pre-EIP-155 and wrong chain ids rejected;
  - sender recovered and required to be tracked by the device;
  - limited to 10/min;
  - `eth_sendRawTransaction` is not on the `/v1/rpc` allowlist;
  - the gateway re-marshals parsed requests, so duplicate-key JSON tricks cannot bypass the allowlist.
- **Centrifugo:** HS256 tokens with `sub` set to the device. Channel claims are limited to the device's own tracked addresses and pending transactions. 1 h TTL. Client-side subscribe is disabled. The API needs a key.
- **Media proxy:** the private-IP check runs in the dialer on the resolved address, which covers DNS rebinding and every redirect hop. At most 3 redirects. 10 MB cap. No SVG. Output re-encoded to PNG. `nosniff` and a sandbox CSP.
- **Webhooks:** constant-time HMAC over the raw body, 8 MB cap before parsing, signing keys AES-GCM-encrypted at rest.
- **Address link:** AES-256-GCM with a random nonce and the device id as associated data, an HMAC blind index, and HKDF-style key separation. The leaks are elsewhere (V3-09).
- **Web Push:** RFC 8291 aes128gcm is correct, VAPID ES256, the SSRF guard is applied, and redirects are not followed.
- **SQL and deploy:** all SQL is parameterised. Containers are distroless and non-root. Every port is bound to `127.0.0.1`. Redis requires a password. Secrets are generated by `setup.sh` and required by compose.

**Extension**
- Keys stay only in the worker, and the popup never imports vault or wallet-core code (`boundaries.test.js`).
- `storage.session` is set to TRUSTED_CONTEXTS. The unlock throttle is serialized.
- Messages are gated by `isInternalWalletSender`. There is no `externally_connectable` and no `web_accessible_resources`.
- dApp origin comes from the browser. The nonce handshake and per-site rate limits remain. Every signature goes through the approval queue. `eth_sign` is off by default.
- Solana `signMessage` refuses transaction bytes. `addChain` probes only after approval, https only, private hosts refused.
- CSP has no eval and no `innerHTML`.
- The device key is non-extractable WebCrypto. The API URL cannot be changed at runtime.
- The chainId in every signed transaction is set locally. NFT media URLs are pinned to the Harbour proxy.
- The Web Push path builds click URLs locally.

---

## 5. Status of v2 items carried into v3

| v2 item | v3 status |
|---|---|
| Dumb UI / UI-secret boundary (2026-10-27) | **REGRESSED** (V3-01) |
| INF-01: rotate the leaked Infura key | **OPEN**; same key now also used by the backend (V3-04) |
| Action #3: `release-signer.pub` | **OPEN** (V3-21) |
| Action #4: re-sign config monthly | Unknown (V3-47) |
| Action #5: signing keys and Firebase admin JSON out of the project folder | Not present in the v3 folder (good). The REA root was not checked. |
| Action #2: redeploy the v2 gateway | Unknown (V3-48) |
| Action #7: `npm ci --ignore-scripts`, low audit items | **OPEN**, now 4 high as well (V3-22) |
| SIG-07, SIG-06, SIG-12, SIG-13, SIG-15 (send), INF-09/09b, F1, F3 | Hold in v3 |
| Deferred SIG-08, SIG-11, SIG-14, Ledger device verify | Still deferred; they become moot for v3 if V3-02 removes those chains and features |

---

## 6. Remediation plan

**P0: before anyone else installs v3**
1. V3-01: port the v2 UI-secret boundary and its tests.
2. V3-02: background chain guard, strip non-EVM providers and mainnet features from the build.
3. V3-03: https-only API URL, `wss` realtime, build fails when missing.
4. V3-04: rotate the Infura key; drop `VITE_RPC_*`.
5. V3-21: make `npm run verify` pass; add `release-signer.pub`.

**P1: before the AWS phase (these shape the infrastructure design)**
1. V3-07: per-service DB users and grants.
2. V3-19: per-service secrets in Secrets Manager; TLS to RDS.
3. V3-17: NATS authentication.
4. V3-05, V3-06, V3-08, V3-18: RPC allowlist and quota by cost, byte-bounded cache, IPv6 /64 limits and global tier ceilings, sticky-map TTL.
5. V3-12, V3-13, V3-14: push-host allowlist and concurrency, media decode limits, cost-charged older history.
6. V3-37: trusted-proxy handling behind the ALB.
7. V3-23: govulncheck, gosec and a reproducible Docker build in CI.

**P2: product and privacy hardening**
- V3-09, V3-10, V3-25: privacy.
- V3-11, V3-28: push content.
- V3-15, V3-16, V3-20: approval-screen trust and fee cap.
- V3-30 to V3-36: client resilience and cleanup.
- The remaining Low and Info items.

**Commands to run locally (could not run in the audit sandbox):**
```bash
cd harbour-wallet-v3/backend
go build ./... && go vet ./... && ./run.sh test
go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...
go install github.com/securego/gosec/v2/cmd/gosec@latest && gosec ./...
cd .. && npm ci --ignore-scripts && npm run verify && npm audit --omit=dev
```

## 7. Not reviewed or limited

- Go build, tests and vulnerability scanners were not run (module proxy blocked).
- No v2 source diff was possible (only v3 was mounted). Regressions were judged against the v2 control list in `claude/security.md`.
- Nothing was exercised at runtime in Chrome or against the live Docker stack.
- Ledger flows, WalletConnect relay handling, perps, predictions and swap reachability were not re-audited (they should be removed per V3-02).
- `prices/poller.go`, the risk adapters, `gateway/health.go` and `metrics.go` were only skimmed.
- The deployed Cloudflare gateway and the remote config were not checked.

---

## 8. Re-audit and follow-up fixes (2026-10-29, branch harbour-v3)

Features are now on (swap, earn, ramps, perps, predictions, WalletConnect, site add-chain, dApp reads), so the V3-02 fix was re-checked.

| ID | Status | What changed / what is left |
|---|---|---|
| V3-02 (re-check) | FIXED, now deliberate | `core/harbour/policy.ts` has an explicit `SIGNING_POLICY` (mainnet / testnet / custom). Mainnet and non-EVM signing also need a secure backend (a release build refuses a loopback API). Solana and the multi-chain providers follow the same switch at signing time. Chains the user adds (Manage networks or a site's add-chain request, approved by the user) sign as `custom-network`. `test/policy.test.js` |
| New: re-auth before adding secrets | FIXED | Creating, importing or QR-importing another seed or key into an existing wallet needs the unlock password or biometrics, once per operation (`background/reauth.ts`; popup, onboarding tab and a biometric tab route). Backup and reveal already had their own grant. `test/reauth-gate.test.js` |
| New: networks | FIXED | Default networks (Harbour-served mainnets), Custom networks (user or site added) and Testnets, in the picker and in Manage networks. Curated testnets: Sepolia, Base Sepolia, Arbitrum Sepolia, Polygon Amoy, Monad, MegaETH (new). The backend list (`chains.yaml`, `chainList.gen.ts`) is generated from the same list, faucets match, hard-coded `sepolia` checks replaced by the testnet flag |
| V3-04 | YOUR ACTION | Rotate Infura project `423f2a…` and replace `INFURA_API_KEY_2` in `backend/.env` |
| V3-07, V3-19 | PARTLY FIXED | One Postgres login per service (`harbour_<service>`, created by `migrate` from `POSTGRES_SERVICE_USERS`), all members of `harbour_app`. Table-level narrowing per service and RDS IAM auth are still to do |
| V3-17 | FIXED (verify on first run) | One NATS login per service with subject permissions (`deploy/nats/nats.conf`); `harbour` is admin for host tools only. If a service logs a permissions violation, widen that service's list |
| V3-08 | FIXED | New default-tier devices run on a `probation` quota tier for 24 h (`probation_tier`, `probation_period` in `api.yaml`) |
| V3-21 | PARTLY FIXED | `release-signer.pub` pinned from the public half of `harbour-release-key.json` (confirm it is the key you release with). CI now runs `npm run verify` for v3 (workflow previously ran v2 only) |
| V3-22 | OPEN (upstream) | The `zod` advisory has no patched release that viem/abitype (peer `zod ^3`) accept; CI audits at `critical` |
| V3-23 | PARTLY FIXED | Dockerfile no longer runs `go mod tidy` (`-mod=readonly`, escape hatch `--build-arg ALLOW_TIDY=1`); CI runs `go mod tidy` diff check, `govulncheck` and `gosec`. Run them locally once |
| V3-10 | OPEN (product decision) | Every wallet address is still linked to the device id without opt-in |

Not run here: Go build/tests, `npm test` (the esbuild-based tests need a Linux install), `npm run verify`, Docker. `tsc`, `eslint` and `gofmt` passed on the changed files.
