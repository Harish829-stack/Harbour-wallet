# Harbour Wallet: findings

> **Status as of 2026-10-30:** 17 findings fixed in code, HW-002 partly fixed (hand steps), HW-017 mostly fixed, HW-015 open (deployment). Each finding's `Status:` line is current; the description text is the original audit wording. Commits: `git log --oneline 6692a88..`.

Covers every FAIL and PARTIAL control in `results.md`, sorted Critical → Info. Severity follows Section 18 of the framework. Every finding comes from static review of code and config; nothing was exploited live.

No Critical findings: no path was found that sends seeds or keys off the device, signs without approval, or loads remote code.

---

### HW-2026-018: Phishing detection never works at runtime (found in the runtime audit)
- Control ID(s): F-05, F-09
- Severity: **High**
- Component: extension (service worker)
- Description: `cfg.blacklist.push(...scamSnifferList)` (359,277 entries) throws `RangeError: Maximum call stack size exceeded`, so `siteRisk()` always returns `unavailable`. The MetaMask list is discarded too, and every approval shows "Site safety check is unavailable". Details are in `runtime-results.md`.
- Evidence: `src/core/provider/phishing.ts:65`; runtime reproduction 2026-10-30.
- Recommendation: Merge the lists with a loop or Set, keep the cache out of `storage.session` (10 MB quota), add a large-list unit test, and fail closed.
- Status: Fixed in code (b2d7139): loop merge, cache size cap, 15 s timeout, MetaMask list kept if ScamSniffer fails; unit test with a 400k list.

### HW-2026-019: dApp-path RPC reads bypass device signing and fall back to public RPCs (runtime)
- Control ID(s): I-02, I-04, G-09
- Severity: **Medium**
- Evidence: `src/background/provider/index.ts:57`, `src/background/provider/rpc.ts:61`, `src/background/index.ts:7`; `audit/flows.mitm`. Details are in `runtime-results.md`.
- Recommendation: Bind `fetch` lazily in `makeRpc`, or install the Harbour fetch hook before the provider module evaluates.
- Status: Fixed in code (b2d7139): makeRpc resolves fetch at call time, so dApp reads go through the signed Harbour proxy.

### HW-2026-020: Device↔transaction links kept in plaintext in Redis and pending_transactions (runtime)
- Control ID(s): G-09, H-07
- Severity: **Medium**
- Evidence: Redis keys `hb:push:<device>:tx:*` and `hb:idem:<device>:bc-*` (body with tx_hash and channel_token); `pending_transactions.device_id` + `from`. Details are in `runtime-results.md`.
- Recommendation: Use no-body idempotency for broadcast, HMAC device IDs in Redis keys, and clear device_id when a tx settles.
- Status: Fixed in code: Redis keys use LinkCrypto tags (idempotency, push dedupe, nonce, rate limits, read cache); broadcast replays keep only tx_hash/status; device unlinked 10 min after settle, rows kept 7 days. Existing old-format Redis keys expire on their TTL.

### HW-2026-001: Biometric unlock seals the vault keys under the WebAuthn user handle, which is not a secret
- Control ID(s): B-12, B-11
- Severity: **High** (uncertain: exploitability depends on the authenticator, see Description)
- Component: extension (popup + service worker)
- Description: When biometrics are enabled, the 32-byte WebAuthn `user.id` is generated, used as the passkey "secret", and the session `unlockKey` + `passwordKey` are encrypted under it (HKDF → AES-GCM, no slow KDF). The secret is read back from `response.userHandle`. In WebAuthn, the user handle is credential metadata, not a confidential value. Some platform authenticators and credential-management APIs expose it without user verification, and synced passkeys copy it to other devices.
- Impact: Anyone who can read the user handle and the `wallet:passkey:vault` blob in storage.local can recover the vault and keystore keys without the password. That bypasses the Argon2id protection described in B-02.
- Evidence: `src/core/passkey.ts:39-50` (`const userId = random32(); … user: { id: userId … } … return { secret: toHex(userId) … }`), `src/core/passkey.ts:65-74` (`const handle = res.response?.userHandle; … return { secret: toHex(handle) }`), `src/core/passkeyService.ts:18-26` (`passworder.encrypt(secret, { passwordKey, unlockKey })`), `src/core/passworder.ts:4-7,14-17` (HKDF only).
- Recommendation: Derive the sealing key from the WebAuthn **PRF** (hmac-secret) extension output, which is released only after user verification and never stored as metadata. Treat the user handle as public. Until then, label biometric unlock as weaker than the password.
- Owner / due date:
- Status: Fixed in code (e09d05a): secret = WebAuthn PRF output; no PRF = no biometrics; legacy seals dropped for password wallets, password-less legacy wallets can only add a password. Users with biometrics on must turn it on again.

### HW-2026-002: Live backend secrets are kept in plaintext inside the project folder
- Control ID(s): G-06, H-11, M-01
- Severity: **Medium**
- Component: backend / build
- Description: `backend/.env` contains live-looking provider credentials and the server secrets, including `ADDRESS_LINK_ENCRYPTION_KEY`, which protects the device→address privacy links. `backend/.hbdevice.json` holds a dev device seed. The config loader reads raw environment variables, and there is no secrets-manager integration in code. I checked that none of the 43 values appears in `dist/`.
- Impact: A copy of the folder (zip, backup, shared drive, or a commit if it ever becomes a git repo) exposes the provider keys and the key that de-anonymises which device tracks which addresses.
- Evidence: `backend/.env` (values redacted), `backend/.hbdevice.json`, `backend/internal/config/secrets.go:10-25`, `backend/deploy/docker-compose.yml:114`.
- Recommendation: Rotate the keys present in the file. Load production secrets from a secrets manager or KMS. Keep only `.env.example` in the source tree, and add a pre-commit secret scan (gitleaks).
- Owner / due date:
- Status: Partially fixed in code: NAME_FILE secret mounts (secrets manager / Docker secrets), gitleaks config + pre-commit hook. Still to do by hand: rotate every key in backend/.env, move production secrets to a secrets manager.

### HW-2026-003: The release signing key is a plaintext file on a developer machine, with no two-person release
- Control ID(s): K-10, K-06, M-05
- Severity: **Medium**
- Component: build
- Description: `scripts/release.mjs` creates and reads an Ed25519 private key from `../harbour-release-key.json`. Releases are built locally, and nothing in code requires a second approver or an isolated builder.
- Impact: A compromised developer laptop can produce a correctly signed malicious release.
- Evidence: `scripts/release.mjs:13,26-31`.
- Recommendation: Move signing to CI with the key in an HSM or KMS (or Sigstore keyless signing), require two reviewers for release tags, and publish SLSA provenance.
- Owner / due date:
- Status: Fixed in code (b05b9cc): key only from HB_RELEASE_KEY_PEM (CI/KMS secret) or an explicit 0600 file outside the repo, never auto-created; two distinct approvers required and recorded. Still to do by hand: move the existing key into the CI secret store and delete ../harbour-release-key.json.

### HW-2026-004: Seed backup is not enforced before the wallet can receive funds
- Control ID(s): D-01
- Severity: **Medium**
- Component: extension (popup)
- Description: A new wallet is stored with `seedPhraseBackupRequired: true`, but the only effect is a dismissible banner. The Receive action is always available.
- Impact: Users can fund a wallet they cannot recover. Losing the device or forgetting the password means losing the funds.
- Evidence: `src/background/modules/wallet.ts:59`, `src/popup/wallet/Wallet.tsx:159-162,170`.
- Recommendation: Gate Receive (and show the receive address) until `backupFinish` succeeds, or require an explicit "I accept the risk" step.
- Owner / due date:
- Status: Fixed in code (c765527): receive, buy and fund routes (including deep links) redirect to the backup flow until the phrase is backed up.

### HW-2026-005: Connected sites can switch the wallet's network silently
- Control ID(s): C-03, F-07
- Severity: **Medium**
- Component: extension (service worker provider)
- Description: For a connected origin, `wallet_switchEthereumChain` applies immediately, and a tx or typed-data request naming another known chain triggers `autoSwitch` with no prompt. The approval screen does show the bound network, but the switch itself is never confirmed. There is also no warning when a known chain ID is added with a non-canonical RPC; that case is treated as a switch.
- Impact: A malicious or compromised dApp can move the user to a chain where the same-looking contract or address means something different, relying on the user not noticing the network line.
- Evidence: `src/background/provider/service.ts:163,168-174,302-308`.
- Recommendation: Prompt for network switches, or at least highlight "network changed by this site" on the next approval. Warn when `tx.chainId` differs from the chain the user last saw.
- Owner / due date:
- Status: Fixed in code (b2d7139): wallet_switchEthereumChain / addChain prompt the user; auto-switch for signing is shown in the approval.

### HW-2026-006: Phishing-listed sites get a click-through warning, not a block
- Control ID(s): F-05
- Severity: **Medium**
- Component: extension
- Description: Sites on the MetaMask and ScamSniffer lists still get the provider injected, and their requests reach the approval window with a warning and an acknowledgement checkbox.
- Impact: Users habituated to checkboxes can approve drainer requests on known phishing domains.
- Evidence: `src/core/provider/phishing.ts:56-72`, `src/popup/wallet/features/provider.tsx:128-130,150,189-190`.
- Recommendation: Show a full-page block for blocklisted origins, reject provider requests by default, and allow an override only through a separate, deliberate flow.
- Owner / due date:
- Status: Fixed in code (b2d7139): phishing-listed origins are blocked; override needs the user to type the host.

### HW-2026-007: Database connections have TLS disabled
- Control ID(s): H-05
- Severity: **Medium**
- Component: DB
- Description: Every service connection string uses `sslmode=disable`, and no production configuration in the repo requires TLS.
- Impact: Anyone on the network path between the services and Postgres can read and alter the traffic, including the device→address link data and credentials.
- Evidence: `backend/deploy/docker-compose.yml:76,109,148,169,185,201,227`.
- Recommendation: Use `sslmode=verify-full` with a pinned CA in every non-local environment, and fail startup otherwise.
- Owner / due date:
- Status: Fixed in code (verify-full in Compose, services refuse plaintext non-loopback DBs). Still to do by hand: run backend/scripts/setup.sh (creates certs, updates .env), then recreate the stack.

### HW-2026-008: Supply-chain hardening gaps in the extension build
- Control ID(s): K-01, K-02, K-05, K-07, K-08, K-09
- Severity: **Medium**
- Component: build
- Description: The repo has no extension CI workflow, `scripts/audit-gate.mjs` is not called by `scripts/verify.mjs`, dependency install scripts run unrestricted (no `ignore-scripts` or LavaMoat), and there is no SBOM. The service worker bundles all chain SDKs with no runtime compartmentalisation. npm audit currently reports 4 high-severity entries, all from GHSA-mrhx-c7xc-m3w5 (zod), accepted until 2027-01-31. npm lists viem@2.57.13 as a fix for the viem/abitype path.
- Impact: A compromised dependency would run with full access to keys in the service worker. This is the most common real-world way wallet extensions get drained.
- Evidence: `scripts/verify.mjs:15-36`, `scripts/audit-gate.mjs:1-28`, `audit/tool-output/npm-audit.json`, `audit/tool-output/audit-gate.txt`, `scripts/repro.mjs:13-19`.
- Recommendation: Add an extension CI workflow (`npm ci`, lint, tests, audit gate, repro check), add LavaMoat allow-scripts or `ignore-scripts=true`, generate a CycloneDX SBOM per release, upgrade viem, and evaluate a LavaMoat runtime policy for the service worker.
- Owner / due date:
- Status: Fixed in code (a20239b): CI workflow (verify, SBOM, provenance) in ci/extension.yml, audit gate + lockfile check in verify, ignore-scripts. Still to do by hand: install the workflow under .github/workflows, branch protection, release environment reviewers.

### HW-2026-009: Private keys and the generated phrase pass through immutable JS strings
- Control ID(s): A-08, B-10
- Severity: **Low**
- Component: service worker
- Description: `evmPrivateKey()` returns the key as a hex string, and `generateMnemonic()` returns the phrase as a string that is passed to `buildStoredKey`. Strings cannot be zeroed and may stay in the heap until garbage collection.
- Evidence: `src/background/keys.ts:40-44`, `src/core/walletService.ts:7-12`, `src/background/modules/wallet.ts:48-55`.
- Recommendation: Keep key material as `Uint8Array` end to end (viem accepts a byte-backed account), and generate and store the phrase inside wallet-core without exporting it as a string.
- Status: Fixed in code (0e37148): EVM signing takes key bytes (zeroed on dispose) via @noble/curves; output identical to viem (test). Residual: wallet-core's mnemonic API returns a JS string at creation/backup.

### HW-2026-010: The injected provider impersonates Trust Wallet
- Control ID(s): E-09
- Severity: **Low**
- Component: inpage
- Description: The provider sets `isTrust`/`isTrustWallet` and defines `window.trustwallet`/`window.trustWallet`.
- Impact: dApps and users may believe they are talking to Trust Wallet. It can also conflict with a real Trust Wallet install.
- Evidence: `src/inpage/ethereum.ts:9`, `src/inpage/index.ts:26-28`.
- Recommendation: Drop the third-party flags and namespaces, and rely on EIP-6963 for discovery.
- Status: Fixed in code (c193d91): isTrust/isTrustWallet flags and window.trustwallet/trustWallet removed; window.harbour kept. The onboarding 'import from Trust Wallet mobile' option is a product choice and was left.

### HW-2026-011: Auto-lock can be set to "never"
- Control ID(s): B-06
- Severity: **Low**
- Evidence: `src/core/settings.ts:12`, `src/background/settingsService.ts:32-36`.
- Recommendation: Cap the maximum (for example 60 min), or warn strongly when "never" is chosen. Lock on OS screen lock stays in place.
- Status: Fixed in code (def7f87): 'Never' removed, maximum 4 hours, stored 0 migrates to 10 minutes.

### HW-2026-012: The JSON API lacks security headers, and the legacy gateway allows any origin
- Control ID(s): G-07
- Severity: **Low**
- Evidence: `backend/internal/api/server.go:133-181` (headers set only in `media.go:370-377`), `gateway/.dev.vars.example:15-16`.
- Recommendation: Add `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` on `/v1/me/*`, and HSTS (or document it at the edge). Make an empty `ALLOWED_ORIGINS` fail closed, or retire the worker.
- Status: Fixed in code: nosniff, no-store, DENY, CSP, Referrer-Policy on every API response, HSTS over HTTPS; legacy gateway origin allowlist fails closed.

### HW-2026-013: Security events are not logged on the backend
- Control ID(s): L-02
- Severity: **Low**
- Evidence: `backend/internal/api/auth.go:223-226,254-262` (bad signature, revoked device and replayed nonce return 401 with no log line); `server.go:224-231` logs route and status only.
- Recommendation: Emit structured security events (device ID hash, reason code) for auth failures, revocations, nonce replays and rate-limit trips.
- Status: Fixed in code: structured security_event logs (auth failures, replays, clock skew, revoked/unknown devices, rate limits, bad proof-of-work) with keyed device/client tags. Still to do: alert rules in your log platform.

### HW-2026-014: Backend responses and chain reads are trusted without validation or cross-checks
- Control ID(s): J-03, I-04, I-08
- Severity: **Low**
- Evidence: `src/core/harbour/device.ts:147-154`; no consistency or proof checks found in `src/kit/` or `backend/internal/gateway/`.
- Recommendation: Add runtime schema validation (zod/valibot) for API responses. For pre-send balance and nonce, cross-check a second provider or use `eth_getProof`.
- Status: Fixed in code (HW-014 commit): schema guards on portfolio/history/NFT/address/broadcast responses, answers pinned to requested addresses, broadcast hash checked. Not done: second-provider cross-check for nonce/balance.

### HW-2026-015: Inter-service traffic is plaintext HTTP
- Control ID(s): J-05
- Severity: **Low**
- Evidence: `backend/deploy/docker-compose.yml:91,111` (`RPC_GATEWAY_URL: http://rpc-gateway:8081` with a bearer token).
- Recommendation: Use mTLS or a private service mesh in production.
- Status: Not code-fixable here: needs mTLS or a private mesh in the deployment. Left open.

### HW-2026-016: Allowance view covers only Harbour-granted approvals
- Control ID(s): F-10
- Severity: **Low**
- Evidence: `src/popup/wallet/features/provider.tsx:233-236`.
- Recommendation: Index Approval/ApprovalForAll events for the user's addresses (the backend indexer already sees logs) so every allowance can be revoked.
- Status: Fixed in code (eba8c0f): Home approvals links to the existing full scan (Settings > Security > Token approvals: GoPlus discovery, on-chain verified, revocable). Note: the static audit missed that scanner; GoPlus covers mainnets only.

### HW-2026-017: Remaining partial controls (informational)
- Severity: **Info**
- D-02: no automated cross-wallet restore test (`test/`).
- C-12: Ledger clear-signing for dApp requests not confirmed.
- G-10: realtime JWT has no `aud` claim (`backend/internal/realtime/jwt.go:37,42`).
- H-04: the role-separation migration silently skips without CREATEROLE (`backend/migrations/0008_runtime_role_privacy.sql:29-30`).
- I-09: metrics exist (`backend/internal/gateway/metrics.go`) but no alert rules.
- F-03: the page-controlled tab title is shown in bold above the real origin (`src/popup/wallet/features/provider.tsx:149`).
- Status: Mostly fixed: JWT aud claim + Centrifugo audience, TestDeviceFlow covers quotas again (passes), migrate fails without harbour_app, origin-first approval header, cross-wallet restore vectors test. Still open: Ledger clear-signing check (C-12), alert rules (I-09).
