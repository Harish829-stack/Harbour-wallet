# TEST_GAP_REPORT.md — Phase 3 (Harbour Wallet v3)

Status: COMPLETE (2026-11-19). This is the first phase in which existing tests were read. Every one of the 712 Test IDs in TEST_PLAN.md has a status, judged on what the test *asserts*, not on its title.

## 1. What exists

| Suite | Runner | Files | Tests | Result in this environment |
|---|---|---|---|---|
| Extension `apps/extension/test/*.test.js` | `node --test` (esbuild bundles TS sources in memory, fake `webextension-polyfill`, real wallet-core WASM) | 87 test files + 2 helpers + fixtures/ | 744 | 742 pass, 1 skipped (optional dev dependency `@polymarket/clob-client-v2` absent), 1 env-dependent (see 4.1) |
| Backend `apps/backend/**/*_test.go` | `go test -race` | 41 files (incl. `contracttest/`) | 112 top-level funcs, 142 incl. subtests | all pass; 9 integration tests skip silently unless `HB_TEST_POSTGRES_URL` + `HB_TEST_REDIS_URL` are set — with Postgres 16 + Redis 7 they all pass |
| E2E / browser | — | none | 0 | — |
| Property / fuzz | — | none | 0 | — |
| Coverage config | none (no c8/nyc; Go cover not wired) | — | — | baseline measured here: Go 68.7 % statements (unit + integration) |
| Mutation | none | — | — | — |

Backend packages with **no test file at all**: `internal/devicesig`, `internal/ingest`, `internal/txtrack`, `internal/notifier`, `internal/ratelimit`, `internal/realtime`, `internal/rpchttp`, `internal/events`, `migrations`, all `cmd/*` except indexer. (Some are executed indirectly by `internal/api` tests, which is why coverage is not 0 — but no test asserts their own behaviour.)

## 2. Totals

## 3. Counts

### By category

| Category | COVERED | WEAK | BROKEN | MISSING | Total |
|---|---|---|---|---|---|
| CON | 3 | 5 | 0 | 11 | 19 |
| CONC | 4 | 0 | 0 | 26 | 30 |
| E2E | 0 | 0 | 0 | 15 | 15 |
| INT | 49 | 22 | 0 | 31 | 102 |
| KAT | 9 | 4 | 0 | 16 | 29 |
| MIG | 7 | 2 | 0 | 12 | 21 |
| NEG | 21 | 13 | 0 | 46 | 80 |
| PERF | 1 | 0 | 0 | 10 | 11 |
| PROP | 1 | 8 | 0 | 55 | 64 |
| REG | 28 | 6 | 0 | 3 | 37 |
| RES | 10 | 2 | 0 | 31 | 43 |
| SEC | 66 | 32 | 0 | 53 | 151 |
| UI | 1 | 0 | 0 | 5 | 6 |
| UNIT | 61 | 9 | 0 | 34 | 104 |
| **All** | **261** | **103** | **0** | **348** | **712** |

### By priority

| Priority | COVERED | WEAK | BROKEN | MISSING | Total |
|---|---|---|---|---|---|
| P0 | 147 | 68 | 0 | 116 | 331 |
| P1 | 98 | 33 | 0 | 190 | 321 |
| P2 | 16 | 2 | 0 | 33 | 51 |
| P3 | 0 | 0 | 0 | 9 | 9 |

P0 reading: 147 of 331 P0 tests are COVERED by behavioural assertions; 68 are WEAK (mostly source-regex "wiring" tests or happy-path-only); 116 are MISSING. All P0 MISSING/WEAK items are scheduled first in Phase 4.

## 4. Existing tests that are wrong, misleading, redundant or fragile

### 4.1 Environment-dependent
- `test/chains.test.js` reads `../../../../research/evidences/re-evidence/30-chain-registry/har-balances-chains.json`, a file outside the `harbour-wallet-v3` repository. In a clean clone of `harbour-wallet-v3` alone it fails with ENOENT (observed). It passes when the REA monorepo checkout is present. Not a product bug; the test should skip with a clear reason or the fixture should be vendored.
- 9 Go integration tests (`TestDeviceFlow`, `TestReplayRejected`, `TestReadScreensMakeNoRPCCalls`, `TestMediaProxyBlocksPrivateAddresses`, `TestSendRealtimePush`, `TestRegistrationCeilingNeedsProofOfWork`, `TestFailedAuthIsLimitedPerClient`, `TestSendCountersDoNotStoreDeviceIDs`, `TestGatewayRPCCannotBeSteeredPastTheAllowlist`, plus `TestPoller`) **skip silently** without DB env vars. `make test` (documented as "unit + gateway + contract") therefore runs none of the API security tests. CI sets the vars, so CI is fine; local `make test` gives false confidence.

### 4.2 Misleading: source-text ("wiring") tests counted as behaviour
These assert that a regex matches the source code, not that the behaviour happens. They break on harmless refactors and pass even if the guarded path is unreachable. They are kept, but the plan items they appear to cover are marked WEAK and get behavioural tests:
- `reauth-gate.test.js` (all 3) — grants for addWallet/qrSyncImport/importInitiate/qrImportAll; Symbol marker.
- `storage-access.test.js` "worker pins storage.local and storage.session to TRUSTED_CONTEXTS".
- `ui-secrets.test.js` "no worker handler returns a phrase…" (regex over `return {…}` literals: misses secrets returned via variables, spreads or nested objects) and "the popup never asks the worker for key material…".
- `pentest-regressions.test.js` "PT-01/09/11 wiring" (CSP, armed button, platform authenticator).
- `jupiter-gateway.test.js`, `smart-account-kit-offline.test.js` "nothing in src imports the kit root entry", `smart-account-ui-safe.test.js` "the popup never imports…", `boundaries.test.js` — static checks; legitimate as architecture guards, not as behaviour coverage.

### 4.3 Weak assertions on security paths
- `TestFilteredLogs` (internal/api) omits nested-null topic filters (`[[null]]`, `[[]]`), the case flagged in AMB-06.
- `TestDeviceFlow` tests only two signature-failure modes (foreign key, stale clock); body/query/method tampering are not enumerated.
- `vault-throttle.test.js` proves serialization but never asserts the backoff schedule or the 300 s cap.
- `provider.test.js` "HW-009: evmAccountFromBytes signs identically…" does not assert that key bytes are zeroed after dispose (the point of HW-009).
- `audit-fixes.test.js` "…remote config expires" covers expiry but not version-downgrade refusal or signature verification.
- `harbour.test.js` "canonical string matches backend/internal/devicesig" compares the JS output to a hard-coded literal; the Go side has no test of `devicesig.Canonical` at all, so the two can drift while both suites stay green.

### 4.4 Self-generated "golden" vectors (regression value only, not correctness)
- `send.test.js` "${id}: quote -> sign gives a deterministic transaction" and `staking.test.js` "cosmos signing is deterministic and regression-pinned (self-generated vector…)" pin the current output. They catch changes, not wrong-but-stable output. Correctness KATs against published vectors are added in Phase 4 (T-SIG-026, T-KEY-041, T-KEY-126/127, T-SIG-045).

### 4.5 Redundant
- `vault-throttle.test.js` and `pentest-regressions.test.js` "PT-03" test the same property (parallel guesses serialized). Both kept (cheap), noted as duplicates.
- `onboarding-import.test.js` "private-key StoredKey round-trips…" overlaps `core.test.js`.

### 4.6 Nothing found wrong
No existing test asserts behaviour that contradicts the source or the documented intent. No flaky test observed in this run (Phase 5 repeats ×3 with shuffled order).

## 5. Per-test status (all 712 Test IDs)

| Test ID | Feature | Cat | Pri | Status | Evidence (file / test) | Note |
|---|---|---|---|---|---|---|
| T-KEY-001 | KEY-01 | UNIT | P1 | MISSING | — |  |
| T-KEY-002 | KEY-01 | NEG | P1 | MISSING | — |  |
| T-KEY-003 | KEY-01 | PROP | P2 | MISSING | — |  |
| T-KEY-004 | KEY-03 | KAT | P0 | MISSING | — |  |
| T-KEY-005 | KEY-03 | UNIT | P0 | MISSING | — |  |
| T-KEY-006 | KEY-03 | NEG | P0 | MISSING | — |  |
| T-KEY-007 | KEY-03 | UNIT | P1 | MISSING | — |  |
| T-KEY-008 | KEY-03 | SEC | P0 | MISSING | — |  |
| T-KEY-009 | KEY-03 | PERF | P2 | MISSING | — |  |
| T-KEY-010 | KEY-04 | KAT | P0 | MISSING | — |  |
| T-KEY-011 | KEY-05 | UNIT | P0 | WEAK | key-schedule.test.js "new vaults use Argon2id…" (round trip only implicitly through the vault) | no direct encrypt/decrypt shape assertions (salt/IV sizes, base64 fields) |
| T-KEY-012 | KEY-05 | PROP | P0 | MISSING | — |  |
| T-KEY-013 | KEY-05 | NEG | P0 | COVERED | key-schedule.test.js "passworder refuses a human password…" | asserts /high-entropy/ rejection |
| T-KEY-014 | KEY-05 | SEC | P0 | MISSING | — |  |
| T-KEY-015 | KEY-05 | MIG | P0 | COVERED | key-schedule.test.js "passworder refuses a human password and still reads the old envelope" | v1 envelope built independently and decrypted |
| T-KEY-016 | KEY-05 | NEG | P1 | MISSING | — |  |
| T-KEY-017 | KEY-02 | INT | P0 | COVERED | key-schedule.test.js "new vaults use Argon2id…" + pentest-regressions.test.js "PT-11: key material lives in extension-origin IndexedDB" | record v2 + params, vault v2, IDB placement |
| T-KEY-018 | KEY-02 | NEG | P0 | COVERED | pentest-regressions.test.js "PT-05: createWallet against an existing vault changes nothing" |  |
| T-KEY-019 | KEY-02 | CONC | P1 | MISSING | — |  |
| T-KEY-020 | KEY-06 | INT | P0 | COVERED | key-schedule.test.js "new vaults use Argon2id and unlock again after a lock" |  |
| T-KEY-021 | KEY-06 | NEG | P0 | COVERED | vault-throttle.test.js "parallel wrong passwords cannot outrun the throttle" | counts 6 'Incorrect password' then TOO_MANY_ATTEMPTS |
| T-KEY-022 | KEY-06 | SEC | P0 | WEAK | vault-throttle.test.js | asserts lockout blocks the right password; does not assert the backoff schedule (5 s·2^n), the 300 s cap or recovery after expiry |
| T-KEY-023 | KEY-06 | CONC | P0 | COVERED | vault-throttle.test.js + pentest-regressions.test.js "PT-03: parallel wrong passwords through SEPARATE VaultService instances" |  |
| T-KEY-024 | KEY-06 | NEG | P1 | MISSING | — |  |
| T-KEY-025 | KEY-06 | RES | P1 | MISSING | — |  |
| T-KEY-026 | KEY-07 | MIG | P0 | COVERED | key-schedule.test.js "a v1 vault is upgraded on first unlock…" | asserts re-key of vault, both keystore kinds, perps & prediction blobs, passkey cleared, old keys fail |
| T-KEY-027 | KEY-07 | RES | P0 | COVERED | key-schedule.test.js "a failed upgrade changes nothing and the wallet still unlocks on v1" |  |
| T-KEY-028 | KEY-07 | NEG | P1 | MISSING | — |  |
| T-KEY-029 | KEY-07 | UNIT | P1 | WEAK | key-schedule.test.js (through migration) | rekeyKeystore not tested directly (mismatch path KEYSTORE_REKEY_MISMATCH untested) |
| T-KEY-030 | KEY-07 | NEG | P2 | MISSING | — |  |
| T-KEY-031 | KEY-08 | INT | P0 | COVERED | key-schedule.test.js "a biometrics-only wallet can add a password…" |  |
| T-KEY-032 | KEY-08 | NEG | P0 | WEAK | key-schedule.test.js (only LOCKED path) | wrong PRF secret, weak password, already-has-password not asserted at handler level |
| T-KEY-033 | KEY-08 | MIG | P1 | COVERED | key-schedule.test.js "HW-001: adding a password to a LEGACY biometrics-only wallet…" |  |
| T-KEY-034 | KEY-09 | INT | P0 | WEAK | vault-throttle.test.js (checkPassword during lockout) | correct/incorrect checkPassword leaving session keys untouched not asserted |
| T-KEY-035 | KEY-10 | INT | P0 | WEAK | pentest-regressions.test.js "re-auth grants never outlive the session (lock clears them)" | alarm/idle triggers and store/provider effects not asserted |
| T-KEY-036 | KEY-10 | UNIT | P1 | COVERED | settings.test.js "auto-lock options, default and sanitising" + settings-service.test.js "HW-011…", "changing the auto-lock timer persists it and arms the real alarm" |  |
| T-KEY-037 | KEY-10 | NEG | P1 | MISSING | — |  |
| T-KEY-038 | KEY-11 | UNIT | P0 | MISSING | — |  |
| T-KEY-039 | KEY-11 | NEG | P1 | MISSING | — |  |
| T-KEY-040 | KEY-12 | KAT | P0 | WEAK | restore-vectors.test.js "BIP-39/44/84 reference vectors…" | ETH and BTC only; other families unpinned |
| T-KEY-041 | KEY-12 | KAT | P0 | MISSING | — |  |
| T-KEY-042 | KEY-12 | UNIT | P0 | WEAK | add-account.test.js | ethereum only; accountPath for other coins not pinned |
| T-KEY-043 | KEY-12 | PROP | P0 | WEAK | add-account.test.js "cross-check vs wallet-core getDerivedKey" | example-based, not property-based vs an independent derivation (viem) |
| T-KEY-044 | KEY-12 | UNIT | P1 | MISSING | — |  |
| T-KEY-045 | KEY-12 | KAT | P0 | MISSING | — |  |
| T-KEY-046 | KEY-13 | INT | P0 | WEAK | core.test.js "addresses deterministic + keystore params" + key-schedule.test.js | cipher/n asserted; buildStoredKey export→import→decryptMnemonic round trip via WalletService not asserted |
| T-KEY-047 | KEY-14 | E2E | P0 | MISSING | — |  |
| T-KEY-048 | KEY-14 | INT | P0 | WEAK | pentest-regressions.test.js PT-01 onboarding / PT-05 | createWallet happy path response & state shape not asserted directly |
| T-KEY-049 | KEY-14 | NEG | P0 | MISSING | — |  |
| T-KEY-050 | KEY-14 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-05…" |  |
| T-KEY-051 | KEY-14 | RES | P0 | MISSING | — |  |
| T-KEY-052 | KEY-14 | CONC | P1 | MISSING | — |  |
| T-KEY-053 | KEY-14 | RES | P1 | WEAK | onboarding-import.test.js "onboarding mode and interrupted-setup recovery" | pure classification only; failure injection after vault.create absent |
| T-KEY-054 | KEY-14 | SEC | P0 | WEAK | ui-secrets.test.js "no worker handler returns a phrase…" | source-regex check, not a runtime response check |
| T-KEY-055 | KEY-15 | INT | P0 | WEAK | multi-wallet.test.js "distinct seeds -> distinct eth addresses" | wallet-core level, not the addWallet handler |
| T-KEY-056 | KEY-15 | SEC | P0 | WEAK | reauth-gate.test.js "addWallet… require the add-wallet grant" | source regex only; no behavioural assertion that addWallet returns AUTH_REQUIRED and consumes the grant |
| T-KEY-057 | KEY-15 | SEC | P0 | WEAK | reauth-gate.test.js "a page cannot skip the gate: the batch marker is a Symbol" | source regex only |
| T-KEY-058 | KEY-15 | NEG | P1 | WEAK | onboarding-import.test.js "wallet limit, names and duplicates" | pure canCreateWallet only; handler path not exercised |
| T-KEY-059 | KEY-15 | NEG | P1 | WEAK | multi-wallet.test.js "same seed -> identical eth address" | duplicate refusal by the handler not asserted |
| T-KEY-060 | KEY-15 | INT | P1 | COVERED | pentest-regressions.test.js "PT-08: the reveal grant created for a NEW wallet reveals only that wallet…" |  |
| T-KEY-061 | KEY-16 | UNIT | P0 | COVERED | onboarding-import.test.js "classifySecret…" |  |
| T-KEY-062 | KEY-16 | KAT | P0 | MISSING | — |  |
| T-KEY-063 | KEY-16 | NEG | P0 | WEAK | onboarding-import.test.js "private-key validation uses the right curve per chain" | boundary keys (0, n, >n, wrong lengths) not enumerated |
| T-KEY-064 | KEY-16 | INT | P0 | MISSING | — |  |
| T-KEY-065 | KEY-16 | PROP | P1 | MISSING | — |  |
| T-KEY-066 | KEY-17 | SEC | P0 | MISSING | — |  |
| T-KEY-067 | KEY-18 | INT | P0 | WEAK | ui-secrets.test.js "backup session…" | pure planBackup/checkPicks; handlers backupBegin/Finish not exercised |
| T-KEY-068 | KEY-18 | SEC | P0 | WEAK | ui-secrets.test.js "backup session…" (asserts no word in session record) | backupBegin response not scanned |
| T-KEY-069 | KEY-18 | NEG | P0 | MISSING | — |  |
| T-KEY-070 | KEY-18 | NEG | P1 | MISSING | — |  |
| T-KEY-071 | KEY-18 | PROP | P1 | WEAK | ui-secrets.test.js "backup session…" | example with one repeated word; not property-based |
| T-KEY-072 | KEY-19 | INT | P0 | MISSING | — |  |
| T-KEY-073 | KEY-19 | NEG | P0 | MISSING | — |  |
| T-KEY-074 | KEY-19/EXT-13 | SEC | P0 | MISSING | — |  |
| T-KEY-075 | KEY-20 | UNIT | P0 | WEAK | pentest-regressions.test.js (grants) | TTL boundaries / 15-min cap not asserted |
| T-KEY-076 | KEY-20 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-08…" and "PT-01: enrolment needs a PASSWORD grant…" |  |
| T-KEY-077 | KEY-20 | INT | P0 | MISSING | — |  |
| T-KEY-078 | KEY-20 | NEG | P1 | MISSING | — |  |
| T-KEY-079 | KEY-21 | INT | P0 | COVERED | passkey.test.js "passkeyService: enroll seals session keys, unlock restores them…" | security notification not asserted (minor) |
| T-KEY-080 | KEY-21 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-01…" |  |
| T-KEY-081 | KEY-21 | NEG | P0 | COVERED | passkey.test.js "passkeyService: wrong secret, stale vault, locked enroll, removal" + "HW-001: legacy (user-handle) seals…" |  |
| T-KEY-082 | KEY-21 | NEG | P1 | MISSING | — |  |
| T-KEY-083 | KEY-21 | E2E | P1 | MISSING | — |  |
| T-KEY-084 | KEY-22 | MIG | P0 | COVERED | pentest-regressions.test.js "PT-11: an existing install is migrated…" |  |
| T-KEY-085 | KEY-22 | RES | P0 | MISSING | — |  |
| T-KEY-086 | KEY-22 | UNIT | P0 | WEAK | pentest-regressions.test.js PT-11 | isSecretKey not unit-tested (UUID case variants) |
| T-KEY-087 | KEY-22 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-11: key material lives in extension-origin IndexedDB…" |  |
| T-KEY-088 | KEY-22 | NEG | P1 | COVERED | pentest-regressions.test.js "PT-11: … a removed key cannot be resurrected" |  |
| T-KEY-089 | KEY-23 | INT | P0 | WEAK | provider.test.js "HW-009: evmAccountFromBytes signs identically…" | zeroing on dispose not asserted |
| T-KEY-090 | KEY-23 | NEG | P0 | COVERED | send.test.js "a signing key that does not belong to the account is refused" + pentest-regressions.test.js "PT-12" |  |
| T-KEY-091 | KEY-23 | NEG | P1 | MISSING | — |  |
| T-KEY-092 | KEY-24 | UNIT | P0 | COVERED | qrsync.test.js (4 tests: decode, out-of-order, rejects non-UR/absurd seq/oversize, malformed keys) |  |
| T-KEY-093 | KEY-24 | SEC | P0 | COVERED | audit-a5-a8.test.js "A5: …scrypt memory exceeds the cap…", "A5: total scrypt work…" |  |
| T-KEY-094 | KEY-24 | INT | P0 | WEAK | onboarding-import.test.js "QR import decrypts phrase and private-key wallets, rejects wrong codes" | core-level; qrSyncImport handler with grant not exercised |
| T-KEY-095 | KEY-24 | SEC | P0 | COVERED | seed-typing.test.js "QR import: the staged keystores are destroyed after 5 wrong one-time codes" |  |
| T-KEY-096 | KEY-24 | NEG | P1 | WEAK | qrsync.test.js "one-time code shape" | expiry and >100 keys not asserted |
| T-KEY-097 | KEY-24 | PROP | P1 | WEAK | qrsync.test.js "malformed keys never reach wallet-core" | example-based, not fuzz |
| T-KEY-098 | KEY-25 | INT | P0 | MISSING | — |  |
| T-KEY-099 | KEY-25 | NEG | P0 | WEAK | pentest-regressions.test.js "PT-04: removing a wallet needs the backup first…" | only-wallet and unknown-id paths not asserted |
| T-KEY-100 | KEY-26 | INT | P1 | WEAK | add-account.test.js | derivation only; handlers switchAccount/rename/listWallets not exercised |
| T-KEY-101 | KEY-26 | NEG | P1 | MISSING | — |  |
| T-KEY-102 | KEY-27 | INT | P1 | WEAK | onboarding-import.test.js "onboarding mode and interrupted-setup recovery" | resetEmptyVault handler not exercised |
| T-KEY-103 | KEY-27 | SEC | P0 | MISSING | — |  |
| T-KEY-104 | KEY-28 | INT | P1 | MISSING | — |  |
| T-KEY-105 | KEY-28 | SEC | P0 | WEAK | smart-account-service.test.js "unavailable for … hardware / watch-only wallets" | reveal/addAccount refusal for ledger not asserted |
| T-KEY-106 | KEY-29 | INT | P1 | WEAK | key-schedule.test.js (perps blob re-key) | perpsEnable flow not exercised |
| T-KEY-107 | KEY-30 | UNIT | P0 | WEAK | ui-secrets.test.js "uiSafe blocks any response…" | case variants partly; depth limit, arrays>500, cycles not asserted |
| T-KEY-108 | KEY-30 | SEC | P0 | WEAK | ui-secrets.test.js "no worker handler returns a phrase…" | source regex, not runtime over all messages |
| T-KEY-109 | KEY-30 | SEC | P0 | MISSING | — |  |
| T-KEY-110 | KEY-30 | UNIT | P1 | COVERED | errors.test.js (4 tests) |  |
| T-KEY-111 | KEY-30 | PROP | P2 | MISSING | — |  |
| T-KEY-112 | KEY-31 | SEC | P0 | COVERED | failover.test.js "logger redacts API keys in URLs, hex secrets and mnemonic-shaped text" |  |
| T-KEY-113 | KEY-31 | PROP | P1 | MISSING | — |  |
| T-KEY-114 | KEY-31 | SEC | P0 | WEAK | eslint.config.js no-console rule (lint, not a test) |  |
| T-KEY-115 | KEY-06 | E2E | P0 | MISSING | — |  |
| T-KEY-116 | KEY-18 | E2E | P0 | MISSING | — |  |
| T-KEY-117 | KEY-19 | UI | P1 | MISSING | — |  |
| T-KEY-118 | KEY-14 | UI | P2 | MISSING | — |  |
| T-KEY-119 | KEY-22 | PERF | P3 | MISSING | — |  |
| T-KEY-120 | KEY-02 | SEC | P0 | WEAK | storage-access.test.js "worker pins storage.local and storage.session…" | source regex, not a behavioural boot test |
| T-SIG-001 | SIG-01 | UNIT | P0 | COVERED | provider.test.js "personal_sign accepts both param orders, hex and utf8, and rejects bad input" |  |
| T-SIG-002 | SIG-01 | NEG | P0 | COVERED | provider.test.js "personal_sign accepts both param orders…" |  |
| T-SIG-003 | SIG-01 | UNIT | P1 | MISSING | — |  |
| T-SIG-004 | SIG-04 | KAT | P0 | COVERED | provider.test.js "personal_sign vector (web3.js docs): \"Some data\"" |  |
| T-SIG-005 | SIG-02 | SEC | P0 | COVERED | provider.test.js "eth_sign is refused unless enabled, and then only for a 32-byte hash" |  |
| T-SIG-006 | SIG-02 | UNIT | P0 | COVERED | provider.test.js "eth_sign: text uses the personal prefix, otherwise only a raw 32-byte hash is accepted" |  |
| T-SIG-007 | SIG-02 | KAT | P0 | COVERED | provider.test.js "eth_sign raw hash signs the digest unprefixed; wrong length refused" |  |
| T-SIG-008 | SIG-03 | KAT | P0 | COVERED | provider.test.js "EIP-712 \"Mail\" vector from the specification (digest + signature)" |  |
| T-SIG-009 | SIG-03 | UNIT | P0 | COVERED | provider.test.js "typed data: V1 array form is unsupported (4200), invalid shapes are -32602" |  |
| T-SIG-010 | SIG-03 | NEG | P0 | COVERED | provider.test.js "typed data: V1 array form… invalid shapes are -32602" |  |
| T-SIG-011 | SIG-03 | SEC | P0 | COVERED | provider.test.js "PT-07 / EIP-3326: typed data / tx naming another known chain…" + audit-a5-a8.test.js "A6" |  |
| T-SIG-012 | SIG-03 | SEC | P0 | COVERED | provider.test.js "personal_sign / eth_sign / typed data require a connection, the connected account, and the approval" |  |
| T-SIG-013 | SIG-03 | UNIT | P1 | COVERED | provider.test.js "typed data summary flags permit-style signatures and marketplace orders" |  |
| T-SIG-014 | SIG-03 | PROP | P1 | WEAK | provider.test.js "EIP-712 v4 with arrays and nested structs matches an independent encoder" | one fixed example; not property-based |
| T-SIG-015 | SIG-03 | PROP | P1 | MISSING | — |  |
| T-SIG-016 | SIG-05 | INT | P0 | COVERED | provider.test.js "eth_sendTransaction: approval signs/broadcasts with the connected account…" + "evmSendTransaction: prepares, signs locally and broadcasts…" |  |
| T-SIG-017 | SIG-05 | SEC | P0 | COVERED | provider.test.js "pending signing approval is bound to the original connection, account and chain" / "chain changes invalidate queued typed-data approvals" |  |
| T-SIG-018 | SIG-05 | SEC | P0 | COVERED | provider.test.js "pending signing approval is bound to the original connection, account and chain" |  |
| T-SIG-019 | SIG-05 | NEG | P0 | COVERED | provider.test.js "eth_sendTransaction normalisation: strict fields, from binding, hex quantities" |  |
| T-SIG-020 | SIG-05 | SEC | P0 | WEAK | policy.test.js "the three signing switches are explicit…" | release-build + loopback API case not asserted |
| T-SIG-021 | SIG-05 | RES | P1 | MISSING | — |  |
| T-SIG-022 | SIG-05 | E2E | P0 | MISSING | — |  |
| T-SIG-023 | SIG-06 | UNIT | P0 | COVERED | chain-data.test.js "gas: EIP-1559 tiers…" + send.test.js "EVM native…", "EVM: legacy (pre-1559)…" |  |
| T-SIG-024 | SIG-06 | KAT | P0 | MISSING | — |  |
| T-SIG-025 | SIG-06 | UNIT | P1 | COVERED | tokens.test.js "estimateSend (ERC-20)…", "estimateSend (native)…" + send.test.js "EVM: … insufficient funds and contract recipients are flagged" |  |
| T-SIG-026 | SIG-07 | KAT | P0 | WEAK | send.test.js (per-family quote→sign tests, "${id}: quote -> sign gives a deterministic transaction") | deterministic but self-generated goldens; signature verification per family only for EVM/BTC/SOL/TRON/NEAR |
| T-SIG-027 | SIG-07 | NEG | P0 | COVERED | send.test.js "EVM rejects malformed recipients…", XRP/Bitcoin dust/insufficient tests, "parseUnits / formatUnits are exact and strict" |  |
| T-SIG-028 | SIG-07 | PROP | P1 | WEAK | send.test.js "parseUnits / formatUnits are exact and strict" | example-based, not property-based |
| T-SIG-029 | SIG-08 | INT | P0 | COVERED | provider.test.js "solana provider flow: connect, signMessage, signTransaction, signAndSendTransaction, disconnect" + "solana tx parse and signature slot filling verifies with ed25519" |  |
| T-SIG-030 | SIG-08 | SEC | P0 | COVERED | audit-fixes.test.js "Solana: a serialized transaction message is refused as a \"message\"; text is not" |  |
| T-SIG-031 | SIG-08 | PROP | P1 | MISSING | — |  |
| T-SIG-032 | SIG-09 | INT | P1 | COVERED | multi.test.js (10 tests) + multi-extra.test.js |  |
| T-SIG-033 | SIG-09 | KAT | P1 | WEAK | multi-extra.test.js "ton: v4r2 identity…; ton_proof hash layout", multi.test.js "cosmos direct… ADR-36" | layout checks; no published spec vector pinned |
| T-SIG-034 | SIG-09 | PROP | P2 | WEAK | multi-extra.test.js "psbt: absurd fees are refused, mismatching non_witness_utxo is refused" | example-based, no fuzz |
| T-SIG-035 | SIG-10 | UNIT | P0 | COVERED | policy.test.js "Harbour mainnets and curated testnets are classified and signable; unknown chains are refused" + "a user-added network becomes signable…" |  |
| T-SIG-036 | SIG-10 | SEC | P0 | WEAK | policy.test.js | non-EVM isSigningChain negative not asserted |
| T-SIG-037 | SIG-11 | INT | P1 | MISSING | — |  |
| T-SIG-038 | SIG-12 | UNIT | P0 | COVERED | provider.test.js "SIWE (EIP-4361) parsing and mismatch detection" |  |
| T-SIG-039 | SIG-12 | PROP | P2 | MISSING | — |  |
| T-SIG-040 | SIG-13 | INT | P0 | COVERED | provider.test.js "no wallet yet -> 4100; locked wallet keeps the request and asks the UI to unlock" |  |
| T-SIG-041 | SIG-13 | SEC | P0 | WEAK | pentest-regressions.test.js "PT-04: turning biometric approval for sites OFF needs re-auth" | providerResolve without proof when biometricApproval on not asserted |
| T-SIG-042 | SIG-13 | SEC | P0 | COVERED | provider.test.js "HW-2026-006: approvals for a phishing-listed origin are refused unless the user typed the site host" + "PT-10…" |  |
| T-SIG-043 | SIG-13 | E2E | P0 | MISSING | — |  |
| T-SIG-044 | SIG-05 | UI | P1 | MISSING | — |  |
| T-DAPP-001 | DAPP-04 | UNIT | P0 | COVERED | provider.test.js "parsePageRequest keeps only the 4 allowed keys and deep-copies params" |  |
| T-DAPP-002 | DAPP-04 | NEG | P0 | COVERED | provider.test.js "parsePageRequest rejects malformed, oversize and unsafe payloads" |  |
| T-DAPP-003 | DAPP-04 | SEC | P0 | WEAK | provider.test.js "parsePageRequest rejects … unsafe payloads" | nested __proto__ via JSON.parse and Object.prototype integrity not asserted |
| T-DAPP-004 | DAPP-04 | PROP | P0 | MISSING | — |  |
| T-DAPP-005 | DAPP-05 | UNIT | P0 | COVERED | provider.test.js "method allowlist: wallet UI messages and bridge-namespaced names are not dApp methods" |  |
| T-DAPP-006 | DAPP-05 | NEG | P1 | COVERED | provider.test.js "unsupported / unknown methods: 4200 vs -32601, and no UI-message injection" |  |
| T-DAPP-007 | DAPP-03 | SEC | P0 | MISSING | — |  |
| T-DAPP-008 | DAPP-03 | INT | P1 | MISSING | — |  |
| T-DAPP-009 | DAPP-06 | NEG | P1 | MISSING | — |  |
| T-DAPP-010 | DAPP-06 | RES | P0 | COVERED | provider.test.js "pending requests survive a worker restart; re-sent request not duplicated…" |  |
| T-DAPP-011 | DAPP-06 | RES | P1 | MISSING | — |  |
| T-DAPP-012 | DAPP-07 | SEC | P0 | COVERED | provider.test.js "origin normalisation: https and local http only, opaque origins refused" |  |
| T-DAPP-013 | DAPP-07 | SEC | P0 | COVERED | provider.test.js "permissions are bound to the exact origin: other sites and sub-frames do not inherit a connection" |  |
| T-DAPP-014 | DAPP-07 | UNIT | P1 | COVERED | provider.test.js "origin normalisation…" |  |
| T-DAPP-015 | DAPP-08 | INT | P0 | COVERED | provider.test.js "eth_requestAccounts queues one approval…", "wallet_requestPermissions / getPermissions / revokePermissions" |  |
| T-DAPP-016 | DAPP-08 | SEC | P0 | COVERED | provider.test.js "permissions are bound to the exact origin…" |  |
| T-DAPP-017 | DAPP-08 | SEC | P0 | COVERED | walletconnect.test.js "PT-06: a WalletConnect session never shares or changes the real site's injected connection" |  |
| T-DAPP-018 | DAPP-08 | NEG | P1 | COVERED | provider.test.js "blacklisted sites get nothing but static chain info" + "blacklist matches by hostname…" |  |
| T-DAPP-019 | DAPP-08 | UNIT | P1 | COVERED | provider.test.js "permission store: per-origin connections, namespaces, ids, serialised writes" |  |
| T-DAPP-020 | DAPP-09 | UNIT | P0 | COVERED | provider.test.js "pending store: dedupe key, atomic take, expiry, settled hand-off" + "expired approvals cannot execute between garbage collection ticks" |  |
| T-DAPP-021 | DAPP-09 | CONC | P0 | COVERED | provider.test.js "pending requests survive a worker restart; re-sent request not duplicated" |  |
| T-DAPP-022 | DAPP-09 | SEC | P0 | COVERED | provider.test.js "page navigation drops its pending requests…" + "request replay identity includes the browser origin and document…" |  |
| T-DAPP-023 | DAPP-10 | UNIT | P0 | COVERED | provider.test.js "token bucket limits bursts and refills over time" | maxKeys eviction not asserted (minor) |
| T-DAPP-024 | DAPP-10 | NEG | P0 | COVERED | provider.test.js "requests are rate limited per origin (-32005) and approvals per origin per minute" |  |
| T-DAPP-025 | DAPP-11 | INT | P1 | COVERED | provider.test.js "wallet_switchEthereumChain: 4902 for unknown chains…" |  |
| T-DAPP-026 | DAPP-11 | SEC | P0 | COVERED | audit-fixes.test.js "dApp-supplied RPC URLs: LAN, metadata and IPv6 literals blocked; public and loopback allowed" |  |
| T-DAPP-027 | DAPP-11 | SEC | P0 | COVERED | provider.test.js "wallet_addEthereumChain: validates, checks the RPC chain id, saves, then switches" |  |
| T-DAPP-028 | DAPP-11 | NEG | P1 | COVERED | provider.test.js "chain id / add chain / watch asset normalisation" |  |
| T-DAPP-029 | DAPP-11 | CONC | P2 | COVERED | provider.test.js "a pending add cannot overwrite a network added in Settings before approval" + "ChainList repeat add…" |  |
| T-DAPP-030 | DAPP-11 | UNIT | P1 | WEAK | audit-fixes.test.js "dApp-supplied RPC URLs…" | decimal/octal/hex IPv4 forms, 100.64/10, no-dot hosts not enumerated |
| T-DAPP-031 | DAPP-12 | UNIT | P1 | COVERED | tokens.test.js "sanitizeToken validates network/address/metadata…", "hostile metadata is cleaned…", "upsert … list is capped" |  |
| T-DAPP-032 | DAPP-13 | INT | P1 | COVERED | provider.test.js "read RPC is proxied to the origin chain; params must be an array" |  |
| T-DAPP-033 | DAPP-13 | SEC | P1 | MISSING | — |  |
| T-DAPP-034 | DAPP-14 | INT | P1 | MISSING | — |  |
| T-DAPP-035 | DAPP-14 | SEC | P0 | WEAK | provider.test.js "locked vault hides grants from initial state…" | storage.onChanged init payload content not asserted |
| T-DAPP-036 | DAPP-15 | UNIT | P0 | COVERED | provider.test.js "site risk: blocklist hit, whitelist override, cache, and honest \"unavailable\"" |  |
| T-DAPP-037 | DAPP-15 | RES | P1 | COVERED | provider.test.js "site risk…honest unavailable" + "HW-2026-018: siteRisk handles a ScamSniffer-sized list…" |  |
| T-DAPP-038 | DAPP-15 | SEC | P0 | COVERED | provider.test.js "PT-10: a clean dApp iframe inside a phishing-listed page is blocked…" |  |
| T-DAPP-039 | DAPP-16 | UNIT | P2 | MISSING | — |  |
| T-DAPP-040 | DAPP-17 | INT | P1 | COVERED | walletconnect.test.js (16 tests) |  |
| T-DAPP-041 | DAPP-17 | MIG | P1 | COVERED | walletconnect.test.js "PT-06 migration…" |  |
| T-DAPP-042 | DAPP-17 | NEG | P1 | COVERED | walletconnect.test.js "parseWcUri accepts v2 links and refuses…", "session_request: refuses unknown sessions…" |  |
| T-DAPP-043 | DAPP-18 | UNIT | P0 | COVERED | provider.test.js "calldata decoding…" + audit-fixes.test.js "decoder: Permit2 approve and multicall expose inner approvals" |  |
| T-DAPP-044 | DAPP-18 | PROP | P1 | MISSING | — |  |
| T-DAPP-045 | DAPP-18 | UNIT | P1 | COVERED | display-integrity.test.js (9 tests) |  |
| T-DAPP-046 | DAPP-19 | INT | P2 | MISSING | — |  |
| T-DAPP-047 | DAPP-20 | INT | P1 | COVERED | provider.test.js "page navigation drops its pending requests; window close / expiry reject them with 4001" |  |
| T-DAPP-048 | DAPP-01 | UNIT | P1 | MISSING | — |  |
| T-DAPP-049 | DAPP-01/DAPP-02 | SEC | P1 | MISSING | — |  |
| T-DAPP-050 | DAPP-02 | UNIT | P2 | MISSING | — |  |
| T-DAPP-051 | DAPP-01..20 | E2E | P0 | MISSING | — |  |
| T-DAPP-052 | DAPP-07 | E2E | P0 | MISSING | — |  |
| T-DAPP-053 | DAPP-10 | PERF | P2 | MISSING | — |  |
| T-EXT-001 | EXT-01 | SEC | P0 | MISSING | — |  |
| T-EXT-002 | EXT-01 | CON | P1 | MISSING | — |  |
| T-EXT-003 | EXT-02 | SEC | P0 | WEAK | pentest-regressions.test.js "PT-01/09/11 wiring" (regex on Trusted Types part of CSP) | full CSP not asserted |
| T-EXT-004 | EXT-02 | SEC | P0 | MISSING | — |  |
| T-EXT-005 | EXT-03 | UNIT | P0 | COVERED | accessPolicy.test.js (2 tests) |  |
| T-EXT-006 | EXT-03 | SEC | P0 | WEAK | provider.test.js "internal wallet router never accepts a content-script / web-page sender" | predicate only, not real router per message |
| T-EXT-007 | EXT-03 | SEC | P0 | MISSING | — |  |
| T-EXT-008 | EXT-04 | INT | P0 | WEAK | storage-access.test.js | source regex |
| T-EXT-009 | EXT-05 | UNIT | P0 | MISSING | — |  |
| T-EXT-010 | EXT-05 | SEC | P1 | MISSING | — |  |
| T-EXT-011 | EXT-05 | NEG | P1 | MISSING | — |  |
| T-EXT-012 | EXT-06 | INT | P1 | MISSING | — |  |
| T-EXT-013 | EXT-07 | UNIT | P1 | MISSING | — |  |
| T-EXT-014 | EXT-07 | RES | P1 | MISSING | — |  |
| T-EXT-015 | EXT-07 | UNIT | P2 | MISSING | — |  |
| T-EXT-016 | EXT-08 | MIG | P1 | COVERED | migrations.test.js (3 tests) |  |
| T-EXT-017 | EXT-08 | UNIT | P1 | MISSING | — |  |
| T-EXT-018 | EXT-08 | SEC | P0 | MISSING | — |  |
| T-EXT-019 | EXT-09 | RES | P0 | MISSING | — |  |
| T-EXT-020 | EXT-09 | E2E | P0 | MISSING | — |  |
| T-EXT-021 | EXT-10 | UNIT | P1 | COVERED | settings.test.js "applyPatch validates every field…", "applyPatch ignores junk…", "normalizeSettings tolerates corrupt / old storage" |  |
| T-EXT-022 | EXT-10 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-04: only settings that WEAKEN security need re-auth" |  |
| T-EXT-023 | EXT-10 | UNIT | P2 | COVERED | settings.test.js "locale list and pick" |  |
| T-EXT-024 | EXT-11 | KAT | P0 | WEAK | audit-fixes.test.js "gateway cleanSearch bounds query strings; remote config expires" | signature verify KAT not asserted |
| T-EXT-025 | EXT-11 | SEC | P0 | WEAK | audit-fixes.test.js "…remote config expires" | version downgrade/filters not asserted |
| T-EXT-026 | EXT-11 | SEC | P1 | MISSING | — |  |
| T-EXT-027 | EXT-11 | RES | P1 | MISSING | — |  |
| T-EXT-028 | EXT-12 | UNIT | P0 | COVERED | policy.test.js "the three signing switches are explicit and on in this build" |  |
| T-EXT-029 | EXT-12 | UNIT | P0 | COVERED | policy.test.js "smart accounts need the remote flag…" |  |
| T-EXT-030 | EXT-13 | INT | P1 | MISSING | — |  |
| T-EXT-031 | EXT-14 | SEC | P0 | WEAK | phase8.test.js "release zips are byte-identical…" | sign/verify tamper not asserted |
| T-EXT-032 | EXT-14 | SEC | P0 | COVERED | check-frozen.test.js (2 tests) |  |
| T-EXT-033 | EXT-14 | SEC | P0 | MISSING | — |  |
| T-EXT-034 | EXT-14 | SEC | P1 | COVERED | security-2026-11-18.test.js "SEC-01…" |  |
| T-EXT-035 | EXT-15 | SEC | P0 | MISSING | — |  |
| T-EXT-036 | EXT-15 | UI | P1 | COVERED | provider.test.js "HW-004…" |  |
| T-EXT-037 | EXT-16 | INT | P2 | MISSING | — |  |
| T-EXT-038 | EXT-01..16 | E2E | P1 | MISSING | — |  |
| T-EXT-039 | EXT-06 | PERF | P3 | MISSING | — |  |
| T-EXT-040 | EXT-15 | UI | P2 | MISSING | — |  |
| T-UX-001 | UX-01 | UNIT | P0 | WEAK | provider.test.js "calldata decoding: … unlimited allowance" | exact 2^159 boundary not asserted |
| T-UX-002 | UX-02 | UNIT | P0 | COVERED | audit-fixes.test.js "spending cap rewrite (MetaMask style)…" + provider.test.js "PT-02…" |  |
| T-UX-003 | UX-02 | E2E | P1 | MISSING | — |  |
| T-UX-004 | UX-03 | INT | P1 | COVERED | approval-preview.test.js (13 tests) |  |
| T-UX-005 | UX-04 | INT | P1 | COVERED | approval-scan.test.js (10 tests) |  |
| T-UX-006 | UX-04 | PERF | P2 | COVERED | approval-scan.test.js "pairs are de-duplicated and the scan is capped…" / "added tokens are checked … in ONE batched call" |  |
| T-UX-007 | UX-05 | UNIT | P0 | COVERED | audit-fixes.test.js "EVM recipients: bad mixed-case checksum rejected…" + addressBook.test.js "wallet-core accepts real addresses…" |  |
| T-UX-008 | UX-05 | SEC | P0 | COVERED | audit-fixes.test.js "send: lookalike (address poisoning) detection and plan fingerprint" + phase8.test.js "ScamSniffer lists…" |  |
| T-UX-009 | UX-05 | UNIT | P2 | COVERED | addressBook.test.js (6 tests) |  |
| T-UX-010 | UX-06 | PROP | P0 | WEAK | swap.test.js "toAtomic/fromAtomic are exact and reject junk", tokens.test.js "token amounts are exact base units…", send.test.js "parseUnits / formatUnits…" | example-based only |
| T-UX-011 | UX-06 | UNIT | P1 | COVERED | settings.test.js "formatFiat…" (3 tests) | NaN not asserted (minor) |
| T-UX-012 | UX-06 | NEG | P0 | MISSING | — |  |
| T-UX-013 | UX-06 | PROP | P1 | MISSING | — |  |
| T-UX-014 | UX-07 | UNIT | P1 | COVERED | tokens.test.js "hostile metadata is cleaned…" + nfts.test.js "spam heuristic" | backend SpamScore has no direct test |
| T-UX-015 | UX-08 | UNIT | P1 | MISSING | — |  |
| T-UX-016 | UX-09 | UNIT | P0 | COVERED | swap.test.js "safety: …" (8 tests) |  |
| T-UX-017 | UX-09 | UNIT | P0 | COVERED | swap.test.js "safety: bridge calls (BridgeData) are decoded…" |  |
| T-UX-018 | UX-09 | UNIT | P0 | COVERED | audit-fixes.test.js "solana: lookup tables resolve and the swap guard refuses authority changes…" |  |
| T-UX-019 | UX-09 | PROP | P1 | MISSING | — |  |
| T-UX-020 | UX-10 | UNIT | P1 | COVERED | chain-data.test.js "gas: EIP-1559 tiers from feeHistory percentiles, legacy single tier" |  |
| T-UX-021 | UX-11 | UNIT | P1 | MISSING | — |  |
| T-SA-001 | SA-01 | UNIT | P0 | COVERED | smart-account-core.test.js "pinned constants…" + smart-account-guard.test.js "every smart account chain has its own explicit limits entry…" |  |
| T-SA-002 | SA-02 | UNIT | P0 | COVERED | smart-account-guard.test.js "intent: …" (3 tests) + "red-team finding 2…" |  |
| T-SA-003 | SA-03 | UNIT | P0 | COVERED | smart-account-guard.test.js "delegation state: none, pinned, other…" |  |
| T-SA-004 | SA-04 | UNIT | P0 | COVERED | smart-account-guard.test.js "sponsor reply…", "gas limits, fee and nonce over the bounds are refused", "max fee is every gas limit x maxFeePerGas…" |  |
| T-SA-005 | SA-04 | PROP | P0 | MISSING | — |  |
| T-SA-006 | SA-05 | INT | P0 | COVERED | smart-account-service.test.js "approve needs a fresh re-auth… signs a self-sent type-4 that recovers to the account" |  |
| T-SA-007 | SA-05 | SEC | P0 | COVERED | smart-account-guard.test.js "freshness: a prepared operation expires after 2 minutes…" + smart-account-service.test.js "fails closed…" |  |
| T-SA-008 | SA-06 | INT | P0 | COVERED | smart-account-send.test.js (13 tests) |  |
| T-SA-009 | SA-06 | UNIT | P0 | COVERED | smart-account-send.test.js "verifyInclusion…", "a receipt that is not for this operation is a mismatch…" |  |
| T-SA-010 | SA-07 | UNIT | P1 | COVERED | provider.test.js "5792 normalizer: strict fields, caps, sizes, chain and from binding" |  |
| T-SA-011 | SA-07 | INT | P1 | COVERED | provider.test.js "5792 sendCalls: one approval…", "5792 capabilities…" |  |
| T-SA-012 | SA-07 | SEC | P0 | COVERED | provider.test.js "5792: methods answer 4200 while the flag is off…", "7715: methods answer 4200…" |  |
| T-SA-013 | SA-08 | UNIT | P0 | COVERED | smart-account-permissions.test.js "unlimited, zero, expired, over 30 days, unknown fields…" |  |
| T-SA-014 | SA-08 | SEC | P0 | COVERED | smart-account-grant-store.test.js "a site reads only its own grants…" + provider.test.js "7715: … a site reads back only its own grants" |  |
| T-SA-015 | SA-09 | INT | P1 | MISSING | — |  |
| T-SA-016 | SA-10 | UNIT | P0 | COVERED | policy.test.js "smart accounts need the remote flag…" |  |
| T-SA-017 | SA-02..09 | E2E | P2 | MISSING | — |  |
| T-CH-001 | CH-01 | CON | P1 | WEAK | harbour-chains.test.js "every Harbour chain is a registry EVM chain with the same id…" | compares the generated list to the registry, not to backend config/chains.yaml |
| T-CH-002 | CH-01 | UNIT | P1 | COVERED | chains.test.js (needs ../../../research data) + harbour-chains.test.js | ENV-DEPENDENT |
| T-CH-003 | CH-02 | UNIT | P1 | COVERED | networks.test.js "field validation", "duplicates are rejected, edits are not" |  |
| T-CH-004 | CH-02 | INT | P1 | COVERED | networks.test.js "RPC probe requires a JSON-RPC answer with the same chain id" + audit-fixes.test.js "site-supplied RPC probe: https only…" |  |
| T-CH-005 | CH-03 | UNIT | P1 | COVERED | tokens.test.js (probe tests: valid, no contract, not a token, bytes32, dead node, bad input) |  |
| T-CH-006 | CH-03 | INT | P1 | MISSING | — |  |
| T-CH-007 | CH-04 | INT | P1 | COVERED | runtime-network-review.test.js "coalescer: concurrent and back-to-back callers share one run…" | asserted on the coalescer, not via getBalances handler |
| T-CH-008 | CH-04 | SEC | P1 | COVERED | harbour.test.js "HW-014: schema guards reject malformed or foreign-address responses" |  |
| T-CH-009 | CH-05 | INT | P0 | WEAK | send.test.js (builders) + defi-broadcast.test.js | sendQuote/sendSubmit handlers not exercised end-to-end |
| T-CH-010 | CH-05 | NEG | P0 | MISSING | — |  |
| T-CH-011 | CH-05 | E2E | P0 | MISSING | — |  |
| T-CH-012 | CH-06 | INT | P0 | COVERED | harbour.test.js "RPC proxy: reads are signed, eth_sendRawTransaction becomes /v1/tx broadcast…" + runtime-network-review.test.js "RPC: unknown_chain falls back…" + defi-broadcast.test.js |  |
| T-CH-013 | CH-06 | CON | P0 | WEAK | harbour.test.js "canonical string matches backend/internal/devicesig" | JS side compares to a literal; Go side has no golden test of Canonical (two-sided golden missing) |
| T-CH-014 | CH-07 | RES | P1 | COVERED | failover.test.js (5 tests) |  |
| T-CH-015 | CH-07 | UNIT | P2 | MISSING | — |  |
| T-DEFI-001 | DEFI-01 | INT | P0 | WEAK | swap.test.js / swap-providers.test.js (mapping + safety) | swapQuote→swapApprove→swapSubmit handler flow not exercised |
| T-DEFI-002 | DEFI-01/UX-09 | SEC | P0 | COVERED | swap.test.js "safety: router must be the LI.FI Diamond and calldata must pay us" et al. |  |
| T-DEFI-003 | DEFI-01 | UNIT | P1 | COVERED | swap.test.js "slippage helpers clamp and normalise", "CTA resolution…", "price impact severity…" |  |
| T-DEFI-004 | DEFI-01 | UNIT | P2 | COVERED | swap-providers.test.js "dust picker keeps priced non-native balances…" |  |
| T-DEFI-005 | DEFI-01 | RES | P1 | MISSING | — |  |
| T-DEFI-006 | DEFI-02 | INT | P1 | WEAK | staking.test.js, staking-phase5.test.js | builders/parsers covered; earnPrepare/earnSubmit handlers only for lock path (earn-lock.test.js) |
| T-DEFI-007 | DEFI-02 | NEG | P1 | COVERED | staking.test.js "amount parsing", "cosmos message builder validation" |  |
| T-DEFI-008 | DEFI-03 | INT | P1 | COVERED | testnet-defi.test.js (12 tests) + testnet-defi-handlers.test.js (7 tests) |  |
| T-DEFI-009 | DEFI-03 | SEC | P0 | COVERED | testnet-defi-handlers.test.js "worker blocks unsupported network, RPC mismatch, disabled features…" |  |
| T-DEFI-010 | DEFI-04 | KAT | P1 | COVERED | hyperliquid-golden.test.js + phase7.test.js "Hyperliquid L1 (agent) signing matches the Python SDK vectors" |  |
| T-DEFI-011 | DEFI-05 | KAT | P1 | COVERED | polymarket-golden.test.js "order matches the official client" + phase7.test.js |  |
| T-DEFI-012 | DEFI-06 | UNIT | P1 | COVERED | ramps.test.js (13 tests) + ramps-fund.test.js |  |
| T-DEFI-013 | DEFI-06 | SEC | P1 | WEAK | ramps.test.js "key sanitising rejects secrets-looking / malformed values and never echoes full keys" | at-rest encryption of user ramp keys not asserted |
| T-DEFI-014 | DEFI-07 | UNIT | P2 | COVERED | settings.test.js "mapRates…", phase6.test.js market tests |  |
| T-DEFI-015 | DEFI-08 | SEC | P1 | COVERED | security-2026-11-18.test.js "SEC-05…" (2 tests) |  |
| T-DEFI-016 | DEFI-08 | INT | P1 | COVERED | nfts.test.js "EVM NFT transfer plans…", send.test.js "NFT ERC-721: ownership is checked…" |  |
| T-DATA-001 | DATA-01 | UNIT | P1 | COVERED | activityEngine.test.js (6 tests) + activityFeed.test.js (4 tests) + eip7708.test.js |  |
| T-DATA-002 | DATA-01 | RES | P1 | MISSING | — |  |
| T-DATA-003 | DATA-02 | INT | P2 | COVERED | runtime-network-review.test.js "Arbitrum Sepolia and Polygon Amoy history use Etherscan V2…" |  |
| T-DATA-004 | DATA-03 | INT | P1 | MISSING | — |  |
| T-DATA-005 | DATA-04 | INT | P2 | COVERED | runtime-network-review.test.js "realtime URL: a deployed API may not hand out a temporary tunnel…" + harbour.test.js "API and realtime URLs…" | only-while-UI-open not asserted (minor) |
| T-DATA-006 | DATA-05 | INT | P0 | MISSING | — |  |
| T-DATA-007 | DATA-05 | SEC | P0 | COVERED | harbour.test.js "a server-chosen proof-of-work difficulty above the cap is refused" | negative/non-integer not asserted (minor) |
| T-DATA-008 | DATA-05 | SEC | P0 | COVERED | harbour.test.js "only device_unknown re-registers; a revoked device keeps its key" |  |
| T-DATA-009 | DATA-05 | CONC | P1 | MISSING | — |  |
| T-DATA-010 | DATA-05 | MIG | P1 | MISSING | — |  |
| T-DATA-011 | DATA-05 | KAT | P0 | MISSING | — |  |
| T-DATA-012 | DATA-06 | SEC | P1 | COVERED | harbour.test.js "HW-014: schema guards reject malformed or foreign-address responses" |  |
| T-BE-001 | BE-01 | SEC | P0 | COVERED | internal/api TestSecurityHeaders |  |
| T-BE-002 | BE-01 | NEG | P1 | MISSING | — |  |
| T-BE-003 | BE-01 | SEC | P1 | MISSING | — |  |
| T-BE-004 | BE-01 | SEC | P1 | MISSING | — |  |
| T-BE-005 | BE-02 | RES | P1 | MISSING | — |  |
| T-BE-006 | BE-03 | INT | P0 | MISSING | — |  |
| T-BE-007 | BE-03 | NEG | P0 | WEAK | internal/api TestClientIPGroupsIPv6By64 | the per-IP challenge limit (429 after N) not asserted |
| T-BE-008 | BE-04 | INT | P0 | COVERED | internal/api TestDeviceFlow (registration) |  |
| T-BE-009 | BE-04 | NEG | P0 | WEAK | internal/api TestDeviceFlow, TestRegistrationCeilingNeedsProofOfWork | bad PoW / bad key / attestation size / challenge reuse not enumerated |
| T-BE-010 | BE-04 | NEG | P1 | COVERED | internal/api TestDeviceFlow "duplicate key" 409 |  |
| T-BE-011 | BE-04 | SEC | P0 | COVERED | internal/api TestRegistrationCeilingNeedsProofOfWork |  |
| T-BE-012 | BE-04 | CONC | P1 | MISSING | — |  |
| T-BE-013 | BE-05 | UNIT | P1 | COVERED | internal/api TestEffectiveTierProbation |  |
| T-BE-014 | BE-06 | INT | P0 | COVERED | internal/api TestDeviceFlow (/v1/me) |  |
| T-BE-015 | BE-06 | SEC | P0 | WEAK | internal/api TestDeviceFlow (forged key, stale clock) | other header/body/query/method tampering cases not enumerated |
| T-BE-016 | BE-06 | SEC | P0 | COVERED | internal/api TestReplayRejected |  |
| T-BE-017 | BE-06 | SEC | P0 | MISSING | — |  |
| T-BE-018 | BE-06 | SEC | P0 | COVERED | internal/api TestFailedAuthIsLimitedPerClient (unknown devices) |  |
| T-BE-019 | BE-06 | NEG | P0 | COVERED | internal/api TestFailedAuthIsLimitedPerClient |  |
| T-BE-020 | BE-06 | SEC | P1 | MISSING | — |  |
| T-BE-021 | BE-06 | KAT | P0 | MISSING | — |  |
| T-BE-022 | BE-06 | PROP | P0 | MISSING | — |  |
| T-BE-023 | BE-06 | PROP | P1 | MISSING | — |  |
| T-BE-024 | BE-07 | INT | P1 | MISSING | — |  |
| T-BE-025 | BE-07 | UNIT | P1 | MISSING | — |  |
| T-BE-026 | BE-08 | INT | P0 | COVERED | internal/api TestDeviceFlow (Idempotency-Key replay) |  |
| T-BE-027 | BE-08 | NEG | P0 | MISSING | — |  |
| T-BE-028 | BE-08 | RES | P0 | MISSING | — |  |
| T-BE-029 | BE-08 | SEC | P0 | COVERED | internal/api TestScrubBroadcast + TestSendCountersDoNotStoreDeviceIDs |  |
| T-BE-030 | BE-09 | SEC | P1 | MISSING | — |  |
| T-BE-031 | BE-10/11 | CON | P1 | MISSING | — |  |
| T-BE-032 | BE-12 | INT | P0 | COVERED | internal/api TestDeviceFlow (addresses, deny-list, link encryption "plain" check, tracked rows) |  |
| T-BE-033 | BE-12 | NEG | P0 | WEAK | internal/api TestDeviceFlow ("nope" address → 400) | 0/101 changes and non-EVM/unknown chain not asserted |
| T-BE-034 | BE-12 | SEC | P0 | WEAK | internal/api TestDeviceFlow (quota → 403) | rollback of partial rows not asserted |
| T-BE-035 | BE-12 | NEG | P1 | MISSING | — |  |
| T-BE-036 | BE-12 | CONC | P0 | MISSING | — |  |
| T-BE-037 | BE-12 | NEG | P1 | MISSING | — |  |
| T-BE-038 | BE-13 | INT | P0 | COVERED | internal/api TestDeviceFlow (rpc forwarded with X-HB-Priority user) |  |
| T-BE-039 | BE-13 | SEC | P0 | WEAK | internal/api TestDeviceFlow (write method refused) | batch limits/invalid JSON not asserted on /v1/rpc |
| T-BE-040 | BE-13 | SEC | P0 | WEAK | internal/api TestFilteredLogs + TestCanonLogFilterRefusesParserDifferentials | `[[null]]` / `[[]]` nested-topic cases absent (ASM-03) |
| T-BE-041 | BE-13 | SEC | P1 | COVERED | internal/api TestStripGatewayInternals |  |
| T-BE-042 | BE-13 | NEG | P1 | MISSING | — |  |
| T-BE-043 | BE-13 | RES | P1 | MISSING | — |  |
| T-BE-044 | BE-13 | NEG | P1 | MISSING | — |  |
| T-BE-045 | BE-13 | PROP | P0 | MISSING | — |  |
| T-BE-046 | BE-14..18 | SEC | P0 | COVERED | internal/api TestReadScreensMakeNoRPCCalls ("Addresses a device doesn't track are refused") |  |
| T-BE-047 | BE-14 | INT | P1 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (portfolio totals, thin-liquidity and spam not priced, cached second call) |  |
| T-BE-048 | BE-14 | SEC | P1 | MISSING | — |  |
| T-BE-049 | BE-16 | INT | P1 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (history paging, no duplicates, newest first) |  |
| T-BE-050 | BE-16 | NEG | P1 | MISSING | — |  |
| T-BE-051 | BE-16 | PROP | P2 | MISSING | — |  |
| T-BE-052 | BE-17 | INT | P2 | WEAK | internal/api TestReadScreensMakeNoRPCCalls (NFTs via media proxy) | dirty-flag sync request not asserted |
| T-BE-053 | BE-18 | NEG | P2 | MISSING | — |  |
| T-BE-054 | BE-19 | SEC | P0 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (SEC-2026-11-18-02 block) |  |
| T-BE-055 | BE-19 | SEC | P0 | MISSING | — |  |
| T-BE-056 | BE-19 | NEG | P1 | MISSING | — |  |
| T-BE-057 | BE-20 | INT | P0 | COVERED | internal/api TestSendRealtimePush (estimate) | only one chain type; +20 % / 21000 rule not asserted |
| T-BE-058 | BE-20 | NEG | P0 | WEAK | internal/api TestSendRealtimePush (untracked sender 403) | invalid value/data/address cases not enumerated |
| T-BE-059 | BE-20 | RES | P1 | MISSING | — |  |
| T-BE-060 | BE-21 | INT | P1 | WEAK | internal/api TestSendRealtimePush (basic simulation) | simulator full mode only in adapters/risk TestAlchemySimulator |
| T-BE-061 | BE-22 | INT | P0 | COVERED | internal/api TestSendRealtimePush (broadcast, pending row, realtime, push) |  |
| T-BE-062 | BE-22 | SEC | P0 | WEAK | internal/api TestSendRealtimePush (wrong chain, untracked sender) | pre-EIP-155 legacy, malformed raw, type-5 not asserted at API level |
| T-BE-063 | BE-22 | RES | P1 | MISSING | — |  |
| T-BE-064 | BE-22 | SEC | P1 | MISSING | — |  |
| T-BE-065 | BE-22 | RES | P1 | MISSING | — |  |
| T-BE-066 | BE-22 | NEG | P1 | MISSING | — |  |
| T-BE-067 | BE-23 | SEC | P0 | COVERED | internal/api TestSendRealtimePush ("Realtime tokens cover the balance channel and the pending tx") | JWT aud/exp not asserted |
| T-BE-068 | BE-23 | KAT | P1 | MISSING | — |  |
| T-BE-069 | BE-25 | SEC | P0 | COVERED | internal/api TestKnownPushHost | b64 length checks not asserted (minor) |
| T-BE-070 | BE-25 | INT | P1 | WEAK | internal/api TestSendRealtimePush (push subscription) | DELETE and route resync not asserted |
| T-BE-071 | BE-26 | SEC | P0 | COVERED | internal/api TestMediaProxyBlocksPrivateAddresses |  |
| T-BE-072 | BE-26 | SEC | P0 | COVERED | internal/api TestMediaProxyBlocksPrivateAddresses ("even via redirects") |  |
| T-BE-073 | BE-26 | SEC | P0 | WEAK | internal/api TestReadScreensMakeNoRPCCalls (SVG refused, large PNG re-encoded) | size/pixel caps and GIF/WebP not asserted |
| T-BE-074 | BE-26 | UNIT | P1 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (re-encoded image bounds) |  |
| T-BE-075 | BE-26 | NEG | P1 | MISSING | — |  |
| T-BE-076 | BE-26 | CONC | P2 | MISSING | — |  |
| T-BE-077 | BE-26 | RES | P1 | MISSING | — |  |
| T-BE-078 | BE-26 | PROP | P1 | MISSING | — |  |
| T-BE-079 | BE-27 | UNIT | P1 | MISSING | — |  |
| T-BE-080 | BE-28 | SEC | P0 | COVERED | internal/api TestRealIPOnlyTrustsProxies |  |
| T-BE-081 | BE-28 | UNIT | P1 | COVERED | internal/api TestClientIPGroupsIPv6By64 |  |
| T-BE-082 | BE-29 | UNIT | P1 | COVERED | internal/config TestLoadRepoConfig, TestEnabledChains, TestPublicUpstreamsAndAllChains | invalid configs only partly |
| T-BE-083 | BE-29 | SEC | P1 | COVERED | internal/config TestLoadSecretFiles, TestLoadSecretFilesIgnoresForeignVariables |  |
| T-BE-084 | BE-30 | SEC | P0 | COVERED | internal/store TestRequireTLS + deploy/postgres/initdb TestRequireTLSHBA |  |
| T-BE-085 | BE-31 | INT | P0 | WEAK | internal/api TestDeviceFlow (re-applied migrations = none) | fresh-schema completeness not asserted |
| T-BE-086 | BE-31 | NEG | P1 | MISSING | — |  |
| T-BE-087 | BE-32 | UNIT | P3 | MISSING | — |  |
| T-BE-088 | BE-01..28 | PERF | P2 | MISSING | — |  |
| T-BE-089 | BE-04 | PERF | P3 | MISSING | — |  |
| T-BE-090 | BE-01..28 | CON | P1 | MISSING | — |  |
| T-GW-001 | GW-01 | INT | P1 | MISSING | — |  |
| T-GW-002 | GW-02 | UNIT | P2 | MISSING | — |  |
| T-GW-003 | GW-03 | UNIT | P1 | COVERED | internal/api TestGatewayPricesShapeAndCache |  |
| T-GW-004 | GW-04 | NEG | P1 | WEAK | internal/api TestGatewayRejectsUnlistedRoutes | market param regexes not enumerated |
| T-GW-005 | GW-05 | SEC | P1 | COVERED | internal/api TestCleanQuery + TestGatewayRejectsUnlistedRoutes |  |
| T-GW-006 | GW-06 | NEG | P2 | MISSING | — |  |
| T-GW-007 | GW-07 | SEC | P0 | COVERED | internal/api TestGatewayInjectsKeysAndScrubsEchoes + TestGatewayRejectsUnlistedRoutes |  |
| T-GW-008 | GW-08 | SEC | P0 | COVERED | internal/api TestGatewayUniswapRoute |  |
| T-GW-009 | GW-09 | NEG | P1 | COVERED | internal/api TestGatewayJupiterTokenSearchRejectsAbuse |  |
| T-GW-010 | GW-10 | NEG | P1 | MISSING | — |  |
| T-GW-011 | GW-11 | SEC | P0 | COVERED | internal/api TestGatewayHeliusProgramAccountsOnlyOwnStakeAccounts |  |
| T-GW-012 | GW-12 | SEC | P0 | COVERED | internal/api TestJSONRPCGuardRejectsParserDifferentials, TestGatewayRPCRoutesRefuseTheDifferentialBody, TestGatewayAlchemyBroadcastAndLogsPolicy, TestGatewayRPCCannotBeSteeredPastTheAllowlist |  |
| T-GW-013 | GW-12 | INT | P1 | COVERED | internal/api TestGatewayRPCCannotBeSteeredPastTheAllowlist (Ethereum via rpc-gateway) |  |
| T-GW-014 | GW-13 | NEG | P1 | MISSING | — |  |
| T-GW-015 | GW-14 | SEC | P0 | COVERED | internal/api TestGatewayEtherscanSetsServerKeyAndIgnoresCallerKey |  |
| T-GW-016 | GW-15 | NEG | P1 | MISSING | — |  |
| T-GW-017 | GW-16 | SEC | P0 | COVERED | internal/api TestGatewayPimlicoUnpinnedSponsorTestnetOnly |  |
| T-GW-018 | GW-16 | SEC | P0 | COVERED | internal/api TestGatewayPimlicoPinsSponsorPolicy |  |
| T-GW-019 | GW-16 | NEG | P1 | COVERED | internal/api TestGatewayPimlicoPinsSponsorPolicy (invalid policy → refused) |  |
| T-GW-020 | GW-17 | PROP | P0 | MISSING | — |  |
| T-GW-021 | GW-18 | PROP | P0 | MISSING | — |  |
| T-GW-022 | GW-19 | SEC | P0 | COVERED | internal/api TestGatewayInjectsKeysAndScrubsEchoes |  |
| T-GW-023 | GW-19 | RES | P1 | COVERED | internal/api TestGatewayUpstreamAuthFailureIsBadGateway |  |
| T-GW-024 | GW-19 | RES | P1 | WEAK | internal/api TestGatewayPassesClientErrorsThrough | size cap/timeout not asserted |
| T-GW-025 | GW-19 | INT | P1 | COVERED | internal/api TestGatewayPricesShapeAndCache (hits/cache) | unit-level fake cache, not Redis |
| T-GW-026 | GW-* | CON | P1 | WEAK | internal/api TestGatewayRejectsUnlistedRoutes | allowed-route matrix not exhaustive |
| T-IDX-001 | IDX-01 | SEC | P0 | MISSING | — |  |
| T-IDX-002 | IDX-01 | SEC | P1 | MISSING | — |  |
| T-IDX-003 | IDX-02 | UNIT | P1 | COVERED | internal/gateway TestBlockLagRouting, TestStickySession |  |
| T-IDX-004 | IDX-03 | RES | P1 | COVERED | internal/gateway TestHedgingOnlyForUserFacing, TestProviderOutageUnderLoad |  |
| T-IDX-005 | IDX-04 | UNIT | P1 | WEAK | internal/gateway TestProviderOutageUnderLoad, TestBudgetShedsToOtherKeys | breaker state transitions not unit-asserted |
| T-IDX-006 | IDX-05 | UNIT | P0 | COVERED | internal/gateway TestFinalizedAndLatestCaching |  |
| T-IDX-007 | IDX-05 | PROP | P1 | MISSING | — |  |
| T-IDX-008 | IDX-05 | UNIT | P2 | COVERED | internal/gateway TestCacheBoundedByBytes |  |
| T-IDX-009 | IDX-06 | CONC | P1 | COVERED | internal/gateway TestCoalescedReads | copy-independence not asserted |
| T-IDX-010 | IDX-07 | RES | P0 | COVERED | internal/gateway TestBroadcastFanoutAndAlreadyKnown |  |
| T-IDX-011 | IDX-08 | UNIT | P1 | COVERED | internal/gateway TestGetLogsSplit |  |
| T-IDX-012 | IDX-09 | RES | P1 | COVERED | internal/gateway TestHeadFollowerOnly, TestHeadPollIsBatched, TestLocalAnswers |  |
| T-IDX-013 | IDX-10 | UNIT | P1 | MISSING | — |  |
| T-IDX-014 | IDX-11 | INT | P0 | COVERED | internal/indexer TestNewWalletMatchesChain, TestCappedBackfillAndOlderPages, TestDormantAddressAndLazyNFTs | failing-source path not asserted |
| T-IDX-015 | IDX-11 | CONC | P0 | MISSING | — |  |
| T-IDX-016 | IDX-12 | INT | P0 | COVERED | internal/store TestIngestEventsBatched + internal/indexer TestLivePath |  |
| T-IDX-017 | IDX-12 | NEG | P0 | MISSING | — |  |
| T-IDX-018 | IDX-12 | PROP | P1 | MISSING | — |  |
| T-IDX-019 | IDX-13 | UNIT | P2 | MISSING | — |  |
| T-IDX-020 | IDX-14 | SEC | P1 | WEAK | internal/store (MediaKey via TestRefCodec?) | keyed/deterministic property not asserted |
| T-IDX-021 | IDX-15 | INT | P1 | COVERED | internal/indexer TestLivePath + adapters/sources/alchemy TestNotifyAPI |  |
| T-IDX-022 | IDX-16 | INT | P1 | COVERED | internal/indexer TestLivePath |  |
| T-IDX-023 | IDX-17 | INT | P1 | COVERED | internal/store TestGapFillScopes, TestLastHeartbeatAndGapRowFor | ingest Start publish not asserted |
| T-IDX-024 | IDX-18 | INT | P0 | WEAK | internal/indexer TestLivePath (reorg part?) | Repair path coverage partial |
| T-IDX-025 | IDX-19 | UNIT | P1 | MISSING | — |  |
| T-IDX-026 | IDX-20 | SEC | P0 | WEAK | adapters/sources/alchemy TestVerifyWebhook | HTTP handler (unknown webhook, size limit) untested; internal/ingest has no tests |
| T-IDX-027 | IDX-20 | SEC | P0 | MISSING | — |  |
| T-IDX-028 | IDX-20 | RES | P1 | MISSING | — |  |
| T-IDX-029 | IDX-20 | KAT | P1 | COVERED | adapters/sources/alchemy TestVerifyWebhook |  |
| T-IDX-030 | IDX-20 | PROP | P1 | MISSING | — |  |
| T-IDX-031 | IDX-21 | INT | P1 | WEAK | internal/api TestSendRealtimePush (tracker confirms) | failed/dropped/replaced/backoff not asserted; internal/txtrack has no tests |
| T-IDX-032 | IDX-22 | UNIT | P1 | MISSING | — |  |
| T-IDX-033 | IDX-22 | RES | P1 | COVERED | adapters/notify/webpush TestSend | 410 cleanup covered in adapter |
| T-IDX-034 | IDX-23 | INT | P1 | COVERED | internal/prices TestPoller + adapters/prices TestQuotes |  |
| T-IDX-035 | IDX-24 | INT | P2 | COVERED | internal/api TestSendRealtimePush (Centrifugo publishes) |  |
| T-IDX-036 | IDX-25 | INT | P1 | MISSING | — |  |
| T-IDX-037 | IDX-26 | CON | P1 | COVERED | contracttest TestSuitesAgainstFakes + adapters/*/TestContract |  |
| T-IDX-038 | IDX-27 | UNIT | P2 | MISSING | — |  |
| T-IDX-039 | IDX-28 | KAT | P0 | COVERED | internal/evmtx TestDecode, TestSender, TestType4DecodeAndSender | EIP-4844 fixture not present |
| T-IDX-040 | IDX-28 | NEG | P0 | WEAK | internal/evmtx TestDecode | type 5 / length overflow / recID 2 not all asserted |
| T-IDX-041 | IDX-28 | PROP | P0 | MISSING | — |  |
| T-IDX-042 | IDX-28 | UNIT | P2 | MISSING | — |  |
| T-IDX-043 | IDX-28 | PROP | P1 | WEAK | internal/evmtx (encode used in sender tests) | no round-trip property |
| T-IDX-044 | IDX-29 | KAT | P0 | MISSING | — |  |
| T-IDX-045 | IDX-29 | UNIT | P1 | MISSING | — |  |
| T-IDX-046 | IDX-30 | SEC | P0 | MISSING | — |  |
| T-IDX-047 | IDX-30 | SEC | P0 | MISSING | — |  |
| T-IDX-048 | IDX-30 | PROP | P1 | MISSING | — |  |
| T-IDX-049 | IDX-30 | SEC | P1 | MISSING | — |  |
| T-IDX-050 | IDX-11..24 | PERF | P2 | MISSING | — |  |
| T-IDX-051 | IDX-03 | PERF | P3 | MISSING | — |  |
| T-DB-001 | DB-21 | MIG | P0 | WEAK | internal/api TestDeviceFlow (migrate twice) | object-level schema assertions absent |
| T-DB-002 | DB-21 | MIG | P1 | MISSING | — |  |
| T-DB-003 | DB-21 | CONC | P0 | MISSING | — |  |
| T-DB-004 | DB-21 | RES | P0 | MISSING | — |  |
| T-DB-005 | DB-20 | MIG | P0 | MISSING | — |  |
| T-DB-006 | DB-20 | MIG | P1 | MISSING | — |  |
| T-DB-007 | DB-20 | MIG | P1 | MISSING | — |  |
| T-DB-008 | DB-20 | MIG | P1 | MISSING | — |  |
| T-DB-009 | DB-20 | MIG | P2 | MISSING | — |  |
| T-DB-010 | DB-21 | MIG | P1 | MISSING | — |  |
| T-DB-011 | DB-03 | INT | P0 | MISSING | — |  |
| T-DB-012 | DB-04 | INT | P1 | MISSING | — |  |
| T-DB-013 | DB-05 | INT | P0 | MISSING | — |  |
| T-DB-014 | DB-07/08 | INT | P1 | MISSING | — |  |
| T-DB-015 | DB-17 | SEC | P1 | MISSING | — |  |
| T-DB-016 | DB-18 | PROP | P0 | COVERED | internal/store TestRefCodec | example-based |
| T-DB-017 | DB-19 | SEC | P0 | MISSING | — |  |
| T-DB-018 | DB-19 | SEC | P1 | MISSING | — |  |
| T-DB-019 | DB-22 | SEC | P0 | MISSING | — |  |
| T-DB-020 | DB-10/12/13 | INT | P1 | MISSING | — |  |
| T-DB-021 | DB-23 | INT | P2 | COVERED | internal/store TestPruneTimeSeries | deliveries/pending prune not asserted |
| T-DB-022 | DB-01..16 | PERF | P2 | MISSING | — |  |
| T-DB-023 | DB-05 | SEC | P0 | MISSING | — |  |
| T-DB-024 | DB-14 | INT | P1 | MISSING | — |  |
| T-DB-025 | DB-01..23 | MIG | P1 | MISSING | — |  |
| T-X-001 | X-01 | PROP | P0 | MISSING | — |  |
| T-X-002 | X-01 | UNIT | P1 | MISSING | — |  |
| T-X-003 | X-02 | UNIT | P1 | MISSING | — |  |
| T-X-004 | X-02 | NEG | P1 | MISSING | — |  |
| T-X-005 | X-03 | UNIT | P2 | MISSING | — |  |
| T-X-006 | X-04 | PROP | P1 | MISSING | — |  |
| T-X-007 | X-05 | MIG | P0 | WEAK | key-schedule, migrations.test.js, passkey, settings-service, walletconnect PT-06 migration | no single "every legacy format at once" upgrade test |
| T-X-008 | X-06 | UNIT | P1 | MISSING | — |  |
| T-X-009 | X-07 | SEC | P0 | MISSING | — |  |
| T-X-010 | X-08 | SEC | P1 | WEAK | scripts/audit-gate.mjs (run by npm run verify, not a test) |  |
| T-X-011 | X-09 | CONC | P0 | MISSING | — |  |
| T-MSG-001 | all MSG-001..160 | SEC | P0 | WEAK | provider.test.js "internal wallet router never accepts a content-script / web-page sender" + accessPolicy.test.js | predicate-level; not every message dispatched through the real router |
| T-MSG-002 | all MSG | SEC | P0 | MISSING | — |  |
| T-MSG-003 | all MSG | PROP | P0 | MISSING | — |  |
| T-MSG-004 | value-moving MSG (send*, swap*, earn*, defi*, perps*, prediction*, nftTransfer*, smartAccount*, approvalsRevoke, ledgerSend*) | SEC | P0 | MISSING | — |  |
| T-MSG-005 | value-moving MSG | SEC | P0 | MISSING | — |  |
| T-MSG-006 | registry | CON | P1 | MISSING | — |  |
| T-MSG-007 | grant-gated MSG (backupBegin, revealPrivateKey, copyPrivateKey, addWallet(non-first), qrSyncImport, removeWallet, passkeyEnroll, passkeyDisable, setSettings(weaken)) | SEC | P0 | MISSING | — |  |
| T-PM-001 | all PM-001..069 | NEG | P0 | WEAK | provider.test.js (normalisers per method) | not table-driven over every method |
| T-PM-002 | PM with needsConnection | SEC | P0 | WEAK | provider.test.js "personal_sign / eth_sign / typed data require a connection…" | not every needsConnection method |
| T-PM-003 | PM with approval | SEC | P0 | WEAK | provider.test.js "reject resolves the dApp with 4001…" | not every approval method |
| T-PM-004 | PM local/rpc | UNIT | P1 | MISSING | — |  |
| T-PM-005 | all PM | PROP | P0 | MISSING | — |  |
| T-PM-006 | all PM | E2E | P1 | MISSING | — |  |
| T-RT-001 | RT-06..24 (signed routes) | SEC | P0 | MISSING | — |  |
| T-RT-002 | all RT | NEG | P1 | MISSING | — |  |
| T-RT-003 | all RT | CON | P1 | MISSING | — |  |
| T-RT-004 | all RT | PROP | P0 | MISSING | — |  |
| T-RT-005 | all RT | PERF | P3 | MISSING | — |  |
| T-DBO-001 | all DBO-01..63 | MIG | P0 | MISSING | — |  |
| T-DBO-002 | all CHECK/UNIQUE/FK constraints in DBO list | INT | P1 | MISSING | — |  |
| T-GOF-001 | all GOF-0001..0627 | UNIT | P1 | MISSING | — |  |
| T-EXP-001 | all EXP-0001..1616 | UNIT | P1 | MISSING | — |  |
| T-REG-001 | 4f44aaa | REG | P2 | COVERED | runtime-network-review.test.js "realtime URL…" |  |
| T-REG-002 | ac9a470 | REG | P1 | COVERED | runtime-network-review.test.js "Tron data goes through the Harbour gateway relay first…", "WalletConnect is created with telemetry off" |  |
| T-REG-003 | 61e9857 | REG | P2 | COVERED | runtime-network-review.test.js "coalescer…" |  |
| T-REG-004 | 4e40f64 | REG | P1 | COVERED | runtime-network-review.test.js "wallet_getCallsStatus logs are only the own logs…" + smart-account-service.test.js "dApp capability reads: eth_getCode is cached briefly…" |  |
| T-REG-005 | e4605c7 | REG | P2 | COVERED | runtime-network-review.test.js (Solana supply, Cosmos tx search, Tezos bakers, Stride/Neutron/ZetaChain) |  |
| T-REG-006 | 5f4d4a9 | REG | P2 | COVERED | runtime-network-review.test.js "Arbitrum Sepolia and Polygon Amoy history…" |  |
| T-REG-007 | 03e483b | REG | P1 | COVERED | runtime-network-review.test.js "networks the backend does not serve…", "RPC: unknown_chain falls back…" |  |
| T-REG-008 | e839b99 | REG | P2 | COVERED | runtime-network-review.test.js "testnet DeFi client groups concurrent contract reads into one Multicall3 request" |  |
| T-REG-009 | 3a43fdc | REG | P0 | COVERED | internal/api TestGatewayHeliusProgramAccountsOnlyOwnStakeAccounts |  |
| T-REG-010 | 9755b18 | REG | P0 | COVERED | security-2026-11-18.test.js "SEC-01: env guard flags secret-named and key-shaped entries…" |  |
| T-REG-011 | d8221b9 | REG | P1 | COVERED | security-2026-11-18.test.js "SEC-05…" |  |
| T-REG-012 | 2b895b0 | REG | P0 | COVERED | internal/api TestGatewayPimlicoUnpinnedSponsorTestnetOnly |  |
| T-REG-013 | de98755 | REG | P0 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (SEC-2026-11-18-02) | pending-source variant (T-BE-055) missing |
| T-REG-014 | 7724fc8 | REG | P0 | COVERED | audit-a5-a8.test.js (A5, A6, A8) |  |
| T-REG-015 | b2dbc94 | REG | P0 | WEAK | storage-access.test.js | source regex |
| T-REG-016 | b2b9770 | REG | P1 | COVERED | approval-preview.test.js + internal/api TestDeviceFlow (eth_simulateV1 forwarded) |  |
| T-REG-017 | 0c1d006 | REG | P0 | COVERED | internal/api TestJSONRPCGuardRejectsParserDifferentials et al. |  |
| T-REG-018 | cf3c951 | REG | P1 | COVERED | testnet-defi.test.js "Uniswap API swap: proxy target, exact approval…" |  |
| T-REG-019 | 0d78eb3 | REG | P0 | COVERED | pentest-regressions.test.js (PT-01/03/04/05/08/11) |  |
| T-REG-020 | d2e8104 | REG | P0 | COVERED | pentest-regressions.test.js (PT-02/12), provider.test.js (PT-07/PT-10), walletconnect.test.js (PT-06) | PT-09 only via source-regex wiring test |
| T-REG-021 | b26a725 | REG | P3 | MISSING | — | no a11y test exists |
| T-REG-022 | 68bcb51 / fb9c7e9 / 296961d | REG | P0 | COVERED | internal/store TestRequireTLS + initdb TestRequireTLSHBA |  |
| T-REG-023 | 57ded23 | REG | P0 | COVERED | internal/api TestScrubBroadcast, TestSecurityHeaders, TestSendCountersDoNotStoreDeviceIDs | security-event log content not asserted |
| T-REG-024 | 320adc5 | REG | P1 | COVERED | internal/config TestLoadSecretFiles |  |
| T-REG-025 | f4f5c94 | REG | P1 | WEAK | internal/api TestDeviceFlow (quotas) | JWT audience and migrate role check not asserted |
| T-REG-026 | 68d65cc | REG | P3 | MISSING | — | redefined: legacy worker not deployed (ASM-14) |
| T-REG-027 | fd7206e | REG | P1 | COVERED | restore-vectors.test.js + display-integrity "page title … escaped" |  |
| T-REG-028 | b05b9cc | REG | P1 | WEAK | phase8.test.js "release zips are byte-identical…" | key-source behaviour not asserted |
| T-REG-029 | a20239b | REG | P1 | WEAK | .npmrc ignore-scripts (config, not a test) |  |
| T-REG-030 | e09d05a | REG | P0 | COVERED | passkey.test.js "HW-001…" (3 tests) |  |
| T-REG-031 | eba8c0f | REG | P3 | MISSING | — | UI |
| T-REG-032 | 35a1ceb | REG | P0 | COVERED | harbour.test.js "HW-014…" |  |
| T-REG-033 | 0e37148 | REG | P0 | WEAK | provider.test.js "HW-009…" | zeroing not asserted |
| T-REG-034 | 316e5cb / c765527 | REG | P1 | COVERED | provider.test.js "HW-004: receive/buy/fund routes gated on backupRequired" |  |
| T-REG-035 | c193d91 | REG | P1 | WEAK | (no direct assertion that isTrust/trustwallet are absent) |  |
| T-REG-036 | def7f87 | REG | P1 | COVERED | settings-service.test.js "HW-011…" + settings.test.js |  |
| T-REG-037 | b2d7139 | REG | P0 | COVERED | provider.test.js "site risk…", "HW-2026-019…", "wallet_switchEthereumChain…(HW-2026-005)" |  |
| T-KEY-121 | KEY-13 | SEC | P0 | MISSING | — |  |
| T-KEY-122 | KEY-23 | SEC | P0 | MISSING | — |  |
| T-KEY-123 | KEY-04 | SEC | P0 | MISSING | — |  |
| T-KEY-124 | KEY-07 | SEC | P0 | MISSING | — |  |
| T-KEY-125 | KEY-05 | KAT | P0 | MISSING | — |  |
| T-KEY-126 | KEY-11 | KAT | P0 | MISSING | — |  |
| T-KEY-127 | KEY-13 | KAT | P0 | MISSING | — |  |
| T-KEY-128 | KEY-24 | KAT | P1 | MISSING | — |  |
| T-KEY-129 | KEY-14/KEY-15/KEY-26/KEY-28 | MIG | P1 | MISSING | — |  |
| T-KEY-130 | KEY-21 | RES | P1 | MISSING | — |  |
| T-KEY-131 | KEY-15 | CONC | P0 | MISSING | — |  |
| T-KEY-132 | KEY-22 | CONC | P1 | MISSING | — |  |
| T-KEY-133 | KEY-24 | CONC | P1 | MISSING | — |  |
| T-KEY-134 | KEY-25/KEY-26 | CONC | P1 | MISSING | — |  |
| T-KEY-135 | KEY-26 | CONC | P0 | MISSING | — | settings-service.test.js "concurrent saves do not lose updates" covers settings only, not vault persists |
| T-KEY-136 | KEY-02 | RES | P0 | MISSING | — |  |
| T-KEY-137 | KEY-15 | RES | P0 | MISSING | — |  |
| T-KEY-138 | KEY-25 | RES | P1 | MISSING | — |  |
| T-KEY-139 | KEY-12/KEY-13 | NEG | P1 | MISSING | — |  |
| T-KEY-140 | KEY-07 | PROP | P0 | MISSING | — |  |
| T-KEY-141 | KEY-13 | PROP | P1 | MISSING | — |  |
| T-KEY-142 | KEY-22 | PROP | P1 | MISSING | — |  |
| T-KEY-143 | KEY-05/KEY-02 | CON | P0 | MISSING | — |  |
| T-KEY-144 | KEY-22 | CON | P1 | MISSING | — |  |
| T-KEY-145 | KEY-29 | NEG | P1 | MISSING | — |  |
| T-KEY-146 | KEY-29 | SEC | P0 | MISSING | — |  |
| T-SIG-045 | SIG-08 | KAT | P0 | MISSING | — |  |
| T-SIG-046 | SIG-06 | PROP | P0 | MISSING | — |  |
| T-SIG-047 | SIG-04 | PROP | P1 | MISSING | — |  |
| T-SIG-048 | SIG-04 | NEG | P1 | MISSING | — |  |
| T-SIG-049 | SIG-06/SIG-07 | NEG | P0 | MISSING | — |  |
| T-SIG-050 | SIG-06/SIG-07 | SEC | P0 | MISSING | — |  |
| T-DAPP-054 | DAPP-08 | CONC | P1 | MISSING | — |  |
| T-DAPP-055 | DAPP-08/DAPP-09 | RES | P1 | MISSING | — |  |
| T-DAPP-056 | DAPP-11 | RES | P1 | MISSING | — |  |
| T-DAPP-057 | DAPP-17 | RES | P1 | MISSING | — |  |
| T-DAPP-058 | DAPP-09 | PROP | P1 | MISSING | — |  |
| T-DAPP-059 | DAPP-10 | PROP | P1 | MISSING | — |  |
| T-DAPP-060 | DAPP-03/DAPP-04/DAPP-06/DAPP-14 | CON | P1 | MISSING | — |  |
| T-EXT-041 | KEY-06/KEY-14/KEY-18/KEY-19/KEY-21/SIG-05/SIG-13/EXT-10/UX-02/UX-04/UX-05/UX-06/CH-05/DEFI-01/DAPP-08 | UI | P1 | MISSING | — |  |
| T-EXT-042 | EXT-10 | MIG | P1 | COVERED | settings.test.js "normalizeSettings tolerates corrupt / old storage" + settings-service.test.js "corrupt stored settings fall back…" |  |
| T-EXT-043 | EXT-08 | CONC | P2 | MISSING | — |  |
| T-EXT-044 | EXT-08 | PROP | P2 | MISSING | — |  |
| T-EXT-045 | EXT-11 | PROP | P1 | MISSING | — |  |
| T-UX-022 | UX-01 | PROP | P1 | MISSING | — |  |
| T-UX-023 | UX-02 | PROP | P0 | MISSING | — |  |
| T-UX-024 | UX-08 | PROP | P1 | MISSING | — |  |
| T-UX-025 | UX-10 | PROP | P1 | MISSING | — |  |
| T-UX-026 | UX-01/UX-02/UX-03/DAPP-18 | SEC | P0 | COVERED | approval-preview.test.js "batch: an unlimited approval names the spender… high-risk warning", "unknown call with no preview is flagged…" |  |
| T-UX-027 | UX-06 | SEC | P0 | MISSING | — |  |
| T-UX-028 | UX-10 | SEC | P1 | MISSING | — |  |
| T-UX-029 | UX-11 | SEC | P1 | MISSING | — |  |
| T-SA-018 | SA-05 | KAT | P0 | COVERED | smart-account-core.test.js "authorization digest and both type-4 transactions equal the kit" |  |
| T-SA-019 | SA-06 | KAT | P0 | COVERED | smart-account-core.test.js "kit-built typed data signs to the pinned vectors…" |  |
| T-SA-020 | SA-05/SA-06/SA-07/SA-09 | RES | P1 | COVERED | smart-account-send.test.js "sponsorship refused and the estimate also fails…", "reverted and pending operations are reported", "a receipt not yet visible…" |  |
| T-SA-021 | SA-02 | PROP | P0 | MISSING | — |  |
| T-SA-022 | SA-03 | PROP | P1 | MISSING | — |  |
| T-SA-023 | SA-07 | CON | P1 | WEAK | provider.test.js 5792 tests | status codes asserted partially |
| T-SA-024 | SA-08 | CON | P1 | COVERED | provider.test.js "7715: one approval, nothing signed before it, response shape…" |  |
| T-SA-025 | SA-01 | SEC | P0 | COVERED | smart-account-kit-offline.test.js + smart-account-send.test.js "a provider reply cannot change callData…" |  |
| T-SA-026 | SA-02/SA-03/SA-04/SA-05/SA-06/SA-09 | SEC | P0 | COVERED | smart-account-send.test.js "a paymaster outside the allow-list signs nothing", "not enabled, foreign delegate, bad intent and a fee over the cap are refused…" |  |
| T-CH-016 | CH-02/CH-03 | MIG | P1 | MISSING | — |  |
| T-CH-017 | CH-02/CH-03/CH-04/CH-05 | RES | P1 | MISSING | — |  |
| T-CH-018 | CH-01 | SEC | P1 | COVERED | chains.test.js "EVM chain ids are unique and match wallet-core" | ENV-DEPENDENT |
| T-CH-019 | CH-06 | SEC | P0 | COVERED | defi-broadcast.test.js "indexed network: broadcast through the Harbour RPC URL, public RPC untouched", "API refusal is final…" |  |
| T-CH-020 | CH-07 | SEC | P1 | COVERED | failover.test.js "network errors fail over too, and non-RPC requests pass through untouched" |  |
| T-DEFI-017 | DEFI-02/DEFI-03/DEFI-04/DEFI-05/DEFI-06/DEFI-07/DEFI-08 | RES | P1 | MISSING | — |  |
| T-DATA-013 | DATA-02/DATA-03/DATA-04/DATA-06 | RES | P1 | MISSING | — |  |
| T-DATA-014 | DATA-05 | PROP | P1 | MISSING | — |  |
| T-DATA-015 | DATA-06 | PROP | P1 | MISSING | — |  |
| T-DATA-016 | DATA-05/DATA-06/CH-06 | CON | P0 | WEAK | harbour.test.js mappers | no two-sided golden fixtures |
| T-DATA-017 | DATA-03 | SEC | P1 | MISSING | — |  |
| T-BE-091 | BE-06 | CONC | P0 | MISSING | — |  |
| T-BE-092 | BE-07 | CONC | P1 | MISSING | — |  |
| T-BE-093 | BE-22 | CONC | P1 | MISSING | — |  |
| T-BE-094 | BE-01..28 | RES | P0 | MISSING | — |  |
| T-BE-095 | BE-28 | PROP | P1 | MISSING | — |  |
| T-BE-096 | BE-29 | PROP | P2 | MISSING | — |  |
| T-BE-097 | BE-15/BE-18/BE-19/BE-23/BE-24/BE-26 | INT | P1 | WEAK | internal/api TestReadScreensMakeNoRPCCalls | realtime/vapid/media covered elsewhere; assets prices covered |
| T-BE-098 | BE-31 | SEC | P1 | MISSING | — |  |
| T-GW-027 | GW-01..19 | INT | P1 | COVERED | internal/api TestGatewayRPCCannotBeSteeredPastTheAllowlist (full stack for RPC routes) | other routes unit-only |
| T-IDX-052 | IDX-30 | KAT | P1 | MISSING | — |  |
| T-IDX-053 | IDX-12 | CONC | P0 | MISSING | — |  |
| T-IDX-054 | IDX-18 | CONC | P1 | MISSING | — |  |
| T-IDX-055 | IDX-21 | CONC | P1 | MISSING | — |  |
| T-IDX-056 | IDX-11..25 | RES | P0 | MISSING | — |  |
| T-IDX-057 | IDX-02 | PROP | P1 | MISSING | — |  |
| T-IDX-058 | IDX-04 | PROP | P1 | MISSING | — |  |
| T-IDX-059 | IDX-29 | PROP | P1 | MISSING | — |  |
| T-IDX-060 | IDX-25/IDX-24/IDX-16/IDX-21/IDX-23 | CON | P1 | MISSING | — |  |
| T-IDX-061 | IDX-01..10 | INT | P1 | COVERED | internal/gateway TestProviderOutageUnderLoad et al. (server via httptest) |  |
| T-IDX-062 | IDX-02..27 | NEG | P1 | MISSING | — |  |
| T-DBO-003 | DB-01..23 | NEG | P1 | MISSING | — |  |
| T-MSG-008 | all MSG | NEG | P1 | MISSING | — |  |
| T-PM-007 | all PM | CON | P1 | COVERED | provider.test.js "serializeError maps to EIP-1193 / EIP-1474 codes without leaking internals" | result shapes per method not golden-tested |
| T-X-012 | BE-03/BE-04/BE-06/BE-07/BE-08/BE-10/BE-12/BE-13/BE-14/BE-16/BE-20/BE-21/BE-22/BE-23/IDX-01/IDX-02/IDX-03/IDX-05/IDX-07/IDX-09/IDX-10/DB-21/DATA-03/DATA-05/CH-06 | E2E | P0 | MISSING | — |  |
| T-X-013 | X-02 | PROP | P2 | MISSING | — |  |
| T-KEY-147 | KEY-20 | CONC | P0 | MISSING | — |  |
| T-SA-027 | SA-07 | CONC | P2 | MISSING | — |  |
| T-CH-021 | CH-05/DEFI-01/DEFI-02/DEFI-03/DEFI-04/DEFI-05 | CONC | P0 | MISSING | — |  |
| T-DATA-018 | DATA-03 | CONC | P1 | MISSING | — |  |
| T-DAPP-061 | DAPP-12 | INT | P1 | COVERED | provider.test.js "wallet_watchAsset reads symbol/decimals from the chain, never from the page" |  |
| T-DAPP-062 | DAPP-02 | CON | P1 | MISSING | — |  |
| T-EXT-046 | EXT-10 | INT | P1 | MISSING | — |  |
| T-EXT-047 | EXT-11 | CON | P1 | MISSING | — |  |
| T-SA-028 | SA-08 | INT | P1 | COVERED | smart-account-service.test.js "grantPermission: signs the checked delegation…" + provider.test.js "7715…" |  |
| T-SA-029 | SA-05 | PROP | P1 | MISSING | — |  |
| T-UX-030 | UX-08 | SEC | P0 | WEAK | display-integrity.test.js "page title and network name set by a site are escaped…" | view-model level, not rendered UI |
| T-IDX-063 | IDX-13 | INT | P1 | MISSING | — |  |
| T-IDX-064 | IDX-14 | INT | P1 | MISSING | — |  |
| T-IDX-065 | IDX-22 | INT | P1 | MISSING | — |  |
| T-IDX-066 | IDX-10 | PROP | P1 | MISSING | — |  |
