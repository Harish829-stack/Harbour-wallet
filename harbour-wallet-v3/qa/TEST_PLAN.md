# TEST_PLAN.md — Phase 2 (Harbour Wallet v3)

Status: COMPLETE for Phase 2 (2026-11-19). Written from source/specs only; no existing test was read. Statuses (COVERED/WEAK/MISSING…) are added in Phase 3 (`TEST_GAP_REPORT.md`) and updated here in Phase 5.

## 0. Conventions

**Test ID** `T-<GROUP>-<NNN>`; groups follow FEATURE_INVENTORY Part A (KEY, SIG, DAPP, EXT, UX, SA, CH, DEFI, DATA, BE, GW, IDX, DB, X) plus parameterised suites over Part C (MSG, PM, RT, DBO) and regressions (REG).

**Categories** (column `Cat`): `UNIT` unit · `INT` integration · `E2E` end-to-end · `NEG` negative/abuse · `SEC` security · `PROP` property-based/fuzz · `KAT` cryptographic known-answer · `CONC` state/concurrency · `RES` resilience/fault injection · `MIG` migration/compatibility · `CON` contract/API · `PERF` performance/load · `UI` accessibility/UI · `REG` regression.

**Priority**: P0 fund-loss/security · P1 core function · P2 edge · P3 nice-to-have.

**Layers** (column `Layer`) and where the tests live (existing conventions first):
| Layer | Location | Runner | Notes |
|---|---|---|---|
| `ext-unit` | `apps/extension/test/*.test.js` | `node --test` (existing) | pure modules, chrome APIs faked at the boundary |
| `ext-int` | `apps/extension/test/integration/*.test.js` | `node --test` | real wallet-core WASM, real handlers/router, in-memory `chrome.*` + `fake-indexeddb` (new devDependency: needed to exercise the real IndexedDB secret store under Node) |
| `ext-prop` | `apps/extension/test/property/*.test.js` | `node --test` + `fast-check` (new devDependency: no property-based tool exists in the repo) | |
| `ext-fuzz` | `apps/extension/test/fuzz/*.test.js` | `node --test` + `fast-check` arbitraries (bounded runs in CI, long campaigns opt-in via env `HB_FUZZ_RUNS`) | |
| `ext-e2e` | `apps/extension/test/e2e/*.spec.mjs` | Playwright with the unpacked `dist/` (new devDependency `@playwright/test`: no browser runner exists; required for real MV3 flows) + local fixture dApp (`tools/e2e/dapp/index.html` exists) + local anvil-free mock RPC/backend | |
| `be-unit` | `apps/backend/**/x_test.go` | `go test -race ./...` (existing) | |
| `be-int` | `apps/backend/**/x_integration_test.go` | `go test` with `HB_TEST_POSTGRES_URL` / `HB_TEST_REDIS_URL` (existing convention, `make test-integration`) | real Postgres + Redis (containers), embedded NATS server (already a dependency) |
| `be-fuzz` | `apps/backend/**/fuzz_test.go` | native `go test -fuzz` (no new dependency); seed corpus runs on every `go test` | |
| `be-prop` | `apps/backend/**/prop_test.go` | `testing/quick` (stdlib) | |
| `db-mig` | `apps/backend/migrations/migrations_test.go` (build tag `integration`) | real Postgres 16 with and without pg_partman | |
| `be-perf` / `ext-perf` | `*_bench_test.go`, `test/perf/*.test.js` | `go test -bench`, `node --test` timing assertions (smoke level) | |

Mutation testing (Phase 5): StrykerJS for extension crypto/signing/permission modules; `gremlins` for Go `devicesig`, `evmtx`, `api/auth.go`, `api/gateway.go` parsers. Both are dev-only tools.

**Test data rules**: published vectors only (BIP-39/32/44 TREZOR vectors, EIP-155 example tx, EIP-191, EIP-712 "Mail" example, RFC 8032 Ed25519, RFC 9106 Argon2id, RFC 5869 HKDF, NIST AES-GCM), deterministic test mnemonic `abandon×11 about` and `test test … junk`; local mock RPC servers; no mainnet, no real keys, no real provider keys (backend tests use dummy keys and httptest upstreams).

## 0.1 Assumptions and flagged ambiguities (expected behaviour where the source is unclear)
| ID | Assumption (the test asserts this; if the product differs the test is marked expected-fail and logged in BUGS_FOUND.md) | Source |
|---|---|---|
| ASM-01 | The UI must never receive key material through ANY channel, including Redux patches on `harbour-ui` (AMB-02). | user rule "dumb UI" |
| ASM-02 | `PUT /me/addresses` must be atomic: if the add part is refused, removals and backfill budget must not be consumed (AMB-05). | API semantics |
| ASM-03 | eth_getLogs through `/v1/rpc` must require at least one concrete address or topic value; `[[null]]`/`[[]]` topic lists count as unfiltered (AMB-06). | handler comment |
| ASM-04 | Formatting functions must never panic or allocate unboundedly on hostile decimals (AMB-07): negative → treat as invalid, >77 → invalid. | robustness |
| ASM-05 | A revoked device may be served for at most 60 s by an API replica (AMB-08) — documented window, asserted as ≤ 60 s. | code comment |
| ASM-06 | A signed remote config without `expiresAt` is accepted (current behaviour) — flagged risk (AMB-11), test documents it; separate test asserts a config whose version < stored version is refused. | code |
| ASM-07 | Generated wallets: address set derived with an empty BIP-39 passphrase must equal the set derived from the mnemonic alone (AMB-12). | BIP-39 |
| ASM-08 | `accountPath` must equal Trust Wallet's per-coin rule; table pinned per coin from wallet-core default paths (AMB-13). | RE evidence |
| ASM-09 | eth_sign with a payload that is valid UTF-8 is signed with the EIP-191 personal prefix (TW parity, AMB-14). | code comment |
| ASM-10 | `vault.create` concurrency: at most one vault ever exists; second concurrent create fails with FORBIDDEN_REQUEST (AMB-03). | invariant |
| ASM-11 | `isPrivateNetworkUrl` is a best-effort literal check; DNS-rebinding names are accepted (AMB-15) — documented, not failed. | code comment |
| ASM-12 | Backend `evmtx.Sender` accepts high-s signatures (nodes reject later) — documented, P2 (AMB-17). | code |
| ASM-13 | Notification watcher only works while unlocked (AMB-01) — documented. | code |
| ASM-14 | Legacy `gateway/worker.ts` is out of scope beyond type-check and its own existing tests (README: not deployed). | README |
| ASM-15 | Duplicate INTERNAL handler names across modules must be impossible (AMB-04): a test asserts all handler maps have disjoint keys. | design intent |
| ASM-16 | Copy grant for an imported private key is reusable within 60 s (AMB-21) — documented. | code |

## 1. Key and secret management (KEY)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-KEY-001 | KEY-01 | UNIT | P1 | — | `validatePassword` with '', 7 chars, 8 chars, 64 chars, 65 chars | invalid(no msg), 'Min 8 characters', valid, valid, 'Password is too long' | ext-unit |
| T-KEY-002 | KEY-01 | NEG | P1 | — | each entry of commonPasswords.json sample (first, last, random 20) | invalid with "too common" text | ext-unit |
| T-KEY-003 | KEY-01 | PROP | P2 | — | arbitrary unicode strings incl. astral chars | never throws; valid ⇔ 8≤length≤64 ∧ not common | ext-prop |
| T-KEY-004 | KEY-03 | KAT | P0 | — | `deriveV2('password', salt=0x01..(16B), {m:8,t:1,p:1})` vs reference Argon2id (RFC 9106 test vector checked through @noble directly) then HKDF-SHA256 with info strings | unlockKey/passwordKey equal independently computed HKDF(argon2id(...)) values (pinned hex) | ext-unit |
| T-KEY-005 | KEY-03 | UNIT | P0 | — | derive same password/salt twice; different salts; different passwords | deterministic; outputs differ on salt/password change; unlockKey ≠ passwordKey; both 128 hex chars | ext-unit |
| T-KEY-006 | KEY-03 | NEG | P0 | — | params m=7·p, m=262145, t=0, t=11, p=0, p=5, NaN, strings | throws `VAULT_KDF_PARAMS_INVALID` before any Argon2 work | ext-unit |
| T-KEY-007 | KEY-03 | UNIT | P1 | — | password 'Å' (U+212B) vs 'Å' (U+00C5) | NFKC normalisation ⇒ same keys | ext-unit |
| T-KEY-008 | KEY-03 | SEC | P0 | spy on argon2 output | derive | master buffer is zero-filled after return (finally path, also when HKDF throws) | ext-unit |
| T-KEY-009 | KEY-03 | PERF | P2 | default params | single derive | completes < 5 s on CI runner; memory ≈46 MiB (smoke) | ext-perf |
| T-KEY-010 | KEY-04 | KAT | P0 | wallet-core loaded | PBKDF2-HMAC-SHA512 RFC 6070-style vectors (password/salt/iterations 1, 2, 4096) via `PasswordService.hash` | matches published SHA-512 PBKDF2 vectors | ext-int |
| T-KEY-011 | KEY-05 | UNIT | P0 | — | encrypt(secret≥32, obj) → decrypt | round-trip deep-equal; payload has v=2, 32-byte salt, 12-byte IV, base64 fields | ext-unit |
| T-KEY-012 | KEY-05 | PROP | P0 | — | arbitrary JSON values × random secrets | decrypt(encrypt(x)) ≡ x; two encryptions of same x differ (fresh IV/salt) | ext-prop |
| T-KEY-013 | KEY-05 | NEG | P0 | — | encrypt with 31-char secret, non-string | throws "needs a derived high-entropy key" | ext-unit |
| T-KEY-014 | KEY-05 | SEC | P0 | valid blob | flip one bit in data / iv / salt; truncate tag; wrong secret | decrypt throws exactly 'Incorrect password' (no partial plaintext) | ext-unit |
| T-KEY-015 | KEY-05 | MIG | P0 | v1 blob produced with PBKDF2-SHA256 10k + AES-GCM (fixture built in test with WebCrypto) | decrypt | returns original object | ext-unit |
| T-KEY-016 | KEY-05 | NEG | P1 | — | decrypt('not json'), decrypt('{}'), decrypt with v=3 | throws (SyntaxError for non-JSON is acceptable but must not leak secret); documented behaviour | ext-unit |
| T-KEY-017 | KEY-02 | INT | P0 | empty fake storage, wallet-core | `VaultService.create('Str0ngPass!', {})` | IDB has `wallet:pbkdf2` v2 record with params = ARGON2_DEFAULT and 64-hex salt; `wallet:vault` v2 blob; chrome.storage.local has NO secret keys; session has unlock+password keys; VAULT_REV set | ext-int |
| T-KEY-018 | KEY-02 | NEG | P0 | vault exists | create again | throws FORBIDDEN_REQUEST, existing vault bytes unchanged | ext-int |
| T-KEY-019 | KEY-02 | CONC | P1 | empty storage | two `create()` started concurrently (ASM-10) | exactly one vault; second rejects; vault decrypts with the winning password | ext-int |
| T-KEY-020 | KEY-06 | INT | P0 | vault created, locked | unlock(correct) | returns state; session keys set; throttle reset | ext-int |
| T-KEY-021 | KEY-06 | NEG | P0 | locked | unlock(wrong) ×5 | each 'Incorrect password'; failedAttempts increments; no lockout until 6th failure | ext-int |
| T-KEY-022 | KEY-06 | SEC | P0 | 5 failures recorded, fake clock | 6th, 7th … wrong; then correct password during lockout | lockedUntil = now+5s, +10s, …, capped 300 s; during lockout even the correct password gets TOO_MANY_ATTEMPTS; after expiry correct unlocks and resets | ext-int |
| T-KEY-023 | KEY-06 | CONC | P0 | locked, 5 failures | 20 parallel wrong unlock calls (new VaultService per call, as the worker does) | serialized: failedAttempts == 25 exactly; no attempt bypasses throttle (PT-03 regression) | ext-int |
| T-KEY-024 | KEY-06 | NEG | P1 | no vault | unlock | VAULT_IS_EMPTY | ext-int |
| T-KEY-025 | KEY-06 | RES | P1 | vault blob corrupted in IDB | unlock(correct) | 'Incorrect password' and throttle armed (documented), no crash | ext-int |
| T-KEY-026 | KEY-07 | MIG | P0 | v1 fixture: PBKDF2 record + v1-keyed vault + 2 keystores + perps & predictions blobs (built with legacy code path) | unlock(correct) | all blobs re-keyed to v2 in ONE IDB txn; afterwards v1 keys no longer decrypt; mnemonic/private key inside keystores unchanged (decrypt with new passwordKey); passkey seal removed; second unlock uses v2 | ext-int |
| T-KEY-027 | KEY-07 | RES | P0 | v1 fixture; make `secureStore.setMany` throw | unlock(correct) | unlock succeeds with v1 keys; storage byte-identical to before; next unlock retries migration | ext-int |
| T-KEY-028 | KEY-07 | NEG | P1 | v1 fixture with one corrupt keystore | unlock | rekey throws → nothing written; unlock still OK | ext-int |
| T-KEY-029 | KEY-07 | UNIT | P1 | — | `rekeyKeystore` on mnemonic keystore and private-key keystore | id/name/accounts preserved, crypto replaced, verification compares secret; KEYSTORE_REKEY_MISMATCH when verification is forced to differ | ext-int |
| T-KEY-030 | KEY-07 | NEG | P2 | — | `rekeyBlob` with non-string, wrong old passphrase | returns null (agent dropped — documented data-loss of unreadable blobs) | ext-unit |
| T-KEY-031 | KEY-08 | INT | P0 | biometrics-only wallet (isPasswordGenerated, prf-v1 seal) unlocked | passkeyAddPassword(valid pw, correct PRF secret) | password unlock works; PRF unlock still works with re-sealed blob; isPasswordGenerated=false; throttle reset | ext-int |
| T-KEY-032 | KEY-08 | NEG | P0 | as above | wrong PRF secret; weak password; wallet already has password; locked | error, no storage change | ext-int |
| T-KEY-033 | KEY-08 | MIG | P1 | legacy (user-handle) seal | passkeyAddPassword | legacy seal deleted, password set | ext-int |
| T-KEY-034 | KEY-09 | INT | P0 | unlocked | checkPassword right / wrong | resolves / throws; session keys untouched in both cases; wrong arms shared throttle | ext-int |
| T-KEY-035 | KEY-10 | INT | P0 | unlocked with reveal/addWallet/manage grants | `lock` message; LOCK_ALARM fire; idle 'locked' event | session unlock/password keys and all 3 grants removed; store wallet.unlocked=false; provider init state shows no accounts | ext-int |
| T-KEY-036 | KEY-10 | UNIT | P1 | fake alarms | armLockTimer with each AUTO_LOCK_OPTIONS value; sanitizeLockTime(0, -1, 9999, 'x') | alarm delay = minutes; 0/'Never' migrated to default 10; cap 240 | ext-unit |
| T-KEY-037 | KEY-10 | NEG | P1 | locked | `lock` again | no error (idempotent) | ext-int |
| T-KEY-038 | KEY-11 | UNIT | P0 | unlocked | generateMnemonic ×100 | 12 words, all in BIP-39 English list, checksum valid (Mnemonic.isValid), all distinct | ext-int |
| T-KEY-039 | KEY-11 | NEG | P1 | locked | generateMnemonic | throws LOCKED | ext-int |
| T-KEY-040 | KEY-12 | KAT | P0 | — | mnemonic `abandon…about` | ETH address 0x9858EfFD232B4033E47d90003D41EC34EcaEda94; BTC (BIP-84) bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu; Solana/ATOM/TRX/etc. pinned to published wallet-core test vectors | ext-int |
| T-KEY-041 | KEY-12 | KAT | P0 | — | BIP-32 TREZOR vector 1 seed 000102…0f, paths m/0'/1/2'/2/1000000000 via wallet-core HDWallet | xprv/xpub match BIP-32 test vector 1 | ext-int |
| T-KEY-042 | KEY-12 | UNIT | P0 | — | `accountPath(coin, i)` for every supported coin, i=0..3 (ASM-08) | i=0 equals default path; table pinned per coin; exactly one path segment differs for i>0 | ext-int |
| T-KEY-043 | KEY-12 | PROP | P0 | — | random account index 0..2^31-1 | derived EVM address for index i equals viem HD derivation m/44'/60'/0'/0/i of the same mnemonic | ext-prop |
| T-KEY-044 | KEY-12 | UNIT | P1 | newlyGenerated=true | deriveAddresses | Solana uses `solanaSolana` derivation; imported uses default derivation | ext-int |
| T-KEY-045 | KEY-12 | KAT | P0 | (ASM-07) | create wallet via generateMnemonic path, then re-derive from mnemonic with empty passphrase | identical address maps (generation passphrase does not leak into addresses) | ext-int |
| T-KEY-046 | KEY-13 | INT | P0 | unlocked | buildStoredKey(mnemonic) → export JSON → importJSON → decryptMnemonic(passwordKey) | returns same mnemonic; cipher aes-128-ctr; accounts for all supported coins; wrong passphrase fails MAC (no wasm abort) | ext-int |
| T-KEY-047 | KEY-14 | E2E | P0 | fresh profile | onboarding: create new wallet with password, skip/finish backup | wallet home shows ETH address; reload → locked screen; unlock works | ext-e2e |
| T-KEY-048 | KEY-14 | INT | P0 | no vault | `createWallet` {password, mnemonic(import)} | ok + addresses; vault state has 1 wallet type mnemonic, seedPhraseBackupRequired=false; manage grant (method password, ~10 min) | ext-int |
| T-KEY-049 | KEY-14 | NEG | P0 | no vault | generatedPassword:true; weak password; invalid mnemonic; non-string password | INVALID_WALLET_INPUT; nothing written | ext-int |
| T-KEY-050 | KEY-14 | SEC | P0 | vault exists, old passkey seal present | `createWallet` | FORBIDDEN_REQUEST and passkey seal untouched (PT-05 regression) | ext-int |
| T-KEY-051 | KEY-14 | RES | P0 | enrolPasskey throws | createWallet with passkey | vault keys dropped (no vault nobody can open); error returned | ext-int |
| T-KEY-052 | KEY-14 | CONC | P1 | — | two createWallet concurrently | second → WALLET_CREATION_IN_PROGRESS or FORBIDDEN_REQUEST; one wallet | ext-int |
| T-KEY-053 | KEY-14 | RES | P1 | buildStoredKey throws after vault.create | createWallet | error returned; state classified "interrupted" by onboardingStatus; resetEmptyVault recovers | ext-int |
| T-KEY-054 | KEY-14 | SEC | P0 | spy on all handler responses | createWallet newlyGenerated | response has no mnemonic/private key (only addresses) | ext-int |
| T-KEY-055 | KEY-15 | INT | P0 | 1 wallet, addWallet grant | addWallet(import valid mnemonic) | new wallet, keystore encrypted with session passwordKey, wallet list updated, address sync scheduled | ext-int |
| T-KEY-056 | KEY-15 | SEC | P0 | 1 wallet, NO grant | addWallet(import) and addWallet(create) | AUTH_REQUIRED; grant consumed on first use (second call also AUTH_REQUIRED) | ext-int |
| T-KEY-057 | KEY-15 | SEC | P0 | — | page-crafted message `{type:'addWallet', AUTHORIZED:true}` / JSON with symbol-like key | AUTHORIZED symbol cannot be forged via JSON (still AUTH_REQUIRED) | ext-int |
| T-KEY-058 | KEY-15 | NEG | P1 | 30 wallets | addWallet | MAX_WALLETS | ext-int |
| T-KEY-059 | KEY-15 | NEG | P1 | wallet with same mnemonic exists | addWallet same mnemonic | 'This wallet already exists' | ext-int |
| T-KEY-060 | KEY-15 | INT | P1 | create (newlyGenerated) second wallet | addWallet | reveal grant bound to new walletId with method 'created'; it cannot reveal wallet #1 | ext-int |
| T-KEY-061 | KEY-16 | UNIT | P0 | — | classifySecret: '', 'abc', 9-char token, 12 words, 0x+64hex, base58 64B | empty, mnemonic, privateKey, mnemonic, privateKey, privateKey (TW rule: 1 token && len>8) | ext-unit |
| T-KEY-062 | KEY-16 | KAT | P0 | — | private key 0x4646…46 (EIP-155 example) for ethereum | valid; derived address 0x9d8A62f656a8d1615C1294fd71e9CFb3E4855A4F | ext-int |
| T-KEY-063 | KEY-16 | NEG | P0 | — | key = 0, = secp256k1 n, > n, 31 bytes, 33 bytes, non-hex, bech32 with bad checksum, Solana 63 bytes | invalid; byte buffers zeroed | ext-int |
| T-KEY-064 | KEY-16 | INT | P0 | unlocked, grant | importInitiate → importComplete with EVM key | wallet type privateKey; signing uses imported key; duplicate address refused (hasDuplicateAddress) | ext-int |
| T-KEY-065 | KEY-16 | PROP | P1 | — | fuzz decodePrivateKeyBytes with random strings | never throws; returns null or Uint8Array of expected length | ext-fuzz |
| T-KEY-066 | KEY-17 | SEC | P0 | — | importCheck with mnemonic/key | response only {ok, kind, valid[, needsNetwork]}; nothing persisted in storage | ext-int |
| T-KEY-067 | KEY-18 | INT | P0 | wallet needing backup, reveal grant | backupBegin → backupCheck(prefix) → backupFinish(correct order) | images returned (PNG data), chip ids opaque (16-byte hex), session record holds only class numbers; finish clears seedPhraseBackupRequired | ext-int |
| T-KEY-068 | KEY-18 | SEC | P0 | — | inspect backupBegin response and session storage | no word strings anywhere (grep all 2048 BIP-39 words in JSON); findSecretField null | ext-int |
| T-KEY-069 | KEY-18 | NEG | P0 | — | backupBegin without grant / locked / grant bound to other wallet / private-key wallet | AUTH_REQUIRED / LOCKED / AUTH_REQUIRED / 'no secret phrase' | ext-int |
| T-KEY-070 | KEY-18 | NEG | P1 | session started | backupFinish wrong order; wrong sessionId; after 15 min (fake clock) | BACKUP_MISMATCH / BACKUP_EXPIRED / BACKUP_EXPIRED (session removed) | ext-int |
| T-KEY-071 | KEY-18 | PROP | P1 | — | planBackup/checkPicks with phrases containing repeated words | any permutation that maps equal words is accepted; any other order rejected; firstWrong index correct | ext-prop |
| T-KEY-072 | KEY-19 | INT | P0 | imported key wallet, reveal grant | revealPrivateKey | PNG view + meta; copy grant 60 s; copyPrivateKey writes via offscreen port (fake) and schedules clear after 60 s; response has no key | ext-int |
| T-KEY-073 | KEY-19 | NEG | P0 | — | copyPrivateKey without view / other walletId / after 60 s; secretViewClosed then copy | AUTH_REQUIRED | ext-int |
| T-KEY-074 | KEY-19/EXT-13 | SEC | P0 | — | offscreen clipboard document | text overwritten after clearAfterMs even if SW stopped (timer in document) | ext-int |
| T-KEY-075 | KEY-20 | UNIT | P0 | fake clock | grantReauth/consume/has for each purpose; TTL boundaries (exp-1 ms valid, exp+1 invalid); ttlMs capped at 15 min | correct validity; consume removes grant even if invalid | ext-unit |
| T-KEY-076 | KEY-20 | SEC | P0 | grant bound to wallet A | consume for wallet B; method requirement 'password' with passkey grant | false | ext-unit |
| T-KEY-077 | KEY-20 | INT | P0 | unlocked | revealAuth(password wrong) ×6 | throttle shared with unlock; TOO_MANY_ATTEMPTS on 6th+ | ext-int |
| T-KEY-078 | KEY-20 | NEG | P1 | — | purposeOf('admin'), undefined | maps to 'reveal' (documented) | ext-unit |
| T-KEY-079 | KEY-21 | INT | P0 | unlocked, manage grant (password) | passkeyEnroll(secret, credId) → lock → passkeyUnlock(secret) | unlock succeeds; meta scheme prf-v1; security notification created | ext-int |
| T-KEY-080 | KEY-21 | SEC | P0 | unlocked, manage grant obtained by PASSKEY method | passkeyEnroll | AUTH_REQUIRED (an authenticator cannot vouch for itself, PT-01) | ext-int |
| T-KEY-081 | KEY-21 | NEG | P0 | locked | passkeyUnlock wrong secret; legacy seal present | error; legacy seal deleted with LEGACY_MSG | ext-int |
| T-KEY-082 | KEY-21 | NEG | P1 | biometrics-only wallet | passkeyDisable | refused (only way to unlock) | ext-int |
| T-KEY-083 | KEY-21 | E2E | P1 | Chrome virtual authenticator with PRF (CDP WebAuthn domain) | enrol biometrics in Settings, lock, unlock with biometrics | works; password still works | ext-e2e |
| T-KEY-084 | KEY-22 | MIG | P0 | legacy secrets in chrome.storage.local | boot migration | each secret moved to IDB, read-back verified, removed from storage.local; non-secret keys untouched; idempotent second run | ext-int |
| T-KEY-085 | KEY-22 | RES | P0 | secureStore.get returns different value (verify fails) | migration | legacy copy kept; local.get still returns legacy value | ext-int |
| T-KEY-086 | KEY-22 | UNIT | P0 | — | isSecretKey for SECRET_KEYS, UUID keystore ids (upper/lower), 'wallet:settings' | true for secrets/UUIDs only | ext-unit |
| T-KEY-087 | KEY-22 | SEC | P0 | after any full onboarding flow | dump chrome.storage.local | contains no vault, keystores, pbkdf2 record, passkey vault, perps/predictions blobs | ext-int |
| T-KEY-088 | KEY-22 | NEG | P1 | — | local.remove(secret) then lazy get | legacy copy cannot be resurrected | ext-int |
| T-KEY-089 | KEY-23 | INT | P0 | unlocked, mnemonic wallet acct index 2 | openActiveKeys().evmPrivateKey() | key derives account #2 address; dispose zero-fills returned bytes and frees wasm objects | ext-int |
| T-KEY-090 | KEY-23 | NEG | P0 | — | privateKeyFor(chain, address not ours) | throws 'signing key does not match'; no key returned | ext-int |
| T-KEY-091 | KEY-23 | NEG | P1 | locked; private-key wallet without EVM | open / evmPrivateKey | 'Wallet is locked' / 'This wallet has no EVM account' | ext-int |
| T-KEY-092 | KEY-24 | UNIT | P0 | — | QR reader: frames out of order, duplicates, seq>2048, compressed>400 KiB, inflated>1 MB, not gzip | assembles valid; rejects oversize/invalid with errors, no exception escape | ext-unit |
| T-KEY-093 | KEY-24 | SEC | P0 | — | codeMatchesKey with scrypt n=2^30 key; total work over QR_MAX_TOTAL_WORK | refused before KDF runs | ext-unit |
| T-KEY-094 | KEY-24 | INT | P0 | staged keys (fixture exported by wallet-core with code 'Ab12Cd') | qrSyncImport right code with addWallet grant | wallets imported; stage cleared | ext-int |
| T-KEY-095 | KEY-24 | SEC | P0 | staged | 5 wrong codes | 5th returns QR_TOO_MANY_ATTEMPTS and staged keys deleted; 6th QR_EXPIRED | ext-int |
| T-KEY-096 | KEY-24 | NEG | P1 | — | code with 5 chars / symbols; stage older than 5 min; > 100 keys | INCORRECT_CODE / QR_EXPIRED / QR_EXPIRED | ext-int |
| T-KEY-097 | KEY-24 | PROP | P1 | — | isWellFormedKey on random JSON | never throws; only well-typed keys pass (wallet-core never sees malformed JSON) | ext-fuzz |
| T-KEY-098 | KEY-25 | INT | P0 | 2 wallets, backup done, manage grant | removeWallet(id) | wallet + keystore removed (IDB), active switched, address sync scheduled | ext-int |
| T-KEY-099 | KEY-25 | NEG | P0 | backup required / no grant / only wallet / unknown id | removeWallet | BACKUP_REQUIRED / AUTH_REQUIRED / 'Cannot remove your only wallet' / 'Wallet not found' — nothing deleted | ext-int |
| T-KEY-100 | KEY-26 | INT | P1 | mnemonic wallet | addAccount ×3, switchAccount(2), renameAccount, switchWallet, renameWallet, listWallets | indices 1..3 derived per accountPath; active switches; names validated (≤40, unique) | ext-int |
| T-KEY-101 | KEY-26 | NEG | P1 | — | switchAccount(-1, 1.5, 99, '1'); addAccount on privateKey wallet; rename '' | 'Invalid account' / 'single account' / 'Name required' | ext-int |
| T-KEY-102 | KEY-27 | INT | P1 | vault, no wallets (interrupted) | resetEmptyVault | vault removed; onboarding returns first-wallet | ext-int |
| T-KEY-103 | KEY-27 | SEC | P0 | vault with wallets | resetEmptyVault | refused; nothing removed | ext-int |
| T-KEY-104 | KEY-28 | INT | P1 | fake Ledger transport (hw-transport mock) | ledgerAddWallet; ledgerSendPrepare; ledgerSendSubmit with signed tx | wallet type ledger; worker holds no key; broadcast of device-signed tx; address mismatch refused | ext-int |
| T-KEY-105 | KEY-28 | SEC | P0 | ledger wallet | revealPrivateKey / smart account / addAccount | refused for hardware wallets | ext-int |
| T-KEY-106 | KEY-29 | INT | P1 | unlocked | perpsEnable then lock/unlock and v1→v2 migration | agent blob encrypted under passwordKey in IDB; readable after migration | ext-int |
| T-KEY-107 | KEY-30 | UNIT | P0 | — | findSecretField on objects containing each FORBIDDEN name in camel/snake/kebab/upper case, nested to depth 5, in arrays (≤500), cyclic objects | returns field name; null for false/null/undefined values and depth>5; no infinite loop on cycles | ext-unit |
| T-KEY-108 | KEY-30 | SEC | P0 | real router with all handlers | invoke every INTERNAL message (T-MSG suite) in states locked/unlocked | no response contains a FORBIDDEN field or a BIP-39 phrase or 64-hex private key pattern | ext-int |
| T-KEY-109 | KEY-30 | SEC | P0 | (ASM-01) | subscribe to `harbour-ui` port; drive full onboarding, unlock, reveal, send, swap flows | no snapshot/patch contains secret fields or secret values (deep scan of every message) | ext-int |
| T-KEY-110 | KEY-30 | UNIT | P1 | — | userText for 'HTTP 404', 'status code: 503', '(429)', 'fetch failed', 'TypeError: x', URLs, 0x+16 hex, 300-char text, 'LOCKED', 'Wrong amount' | mapped sentences; codes passed through; short prose kept | ext-unit |
| T-KEY-111 | KEY-30 | PROP | P2 | — | sanitizeResult on random nested objects | only string `error` fields rewritten; shape otherwise identical; depth>5 untouched | ext-prop |
| T-KEY-112 | KEY-31 | SEC | P0 | — | redact on: Alchemy URL `/v2/<key>`, Infura `/v3/<32hex>`, `?apikey=…&x=1`, quicknode subdomain key, 64-hex key, 12- and 24-word phrase, 100-char base64 blob, Error object | all secrets masked; output ≤ 301 chars; host kept | ext-unit |
| T-KEY-113 | KEY-31 | PROP | P1 | — | random phrases of 12–24 BIP-39 words embedded in random text | never appear in redact output | ext-prop |
| T-KEY-114 | KEY-31 | SEC | P0 | lint config | grep source for `console.` outside logger | none (lint rule enforced) | ext-unit |
| T-KEY-115 | KEY-06 | E2E | P0 | wallet created | wrong password ×6 in UI then right | lockout message with countdown; unlock after wait; no secret in DOM at any time (DOM text scan) | ext-e2e |
| T-KEY-116 | KEY-18 | E2E | P0 | new wallet | backup flow in UI | phrase shown as images only (no text nodes containing words; accessibility tree has no words); verification step works | ext-e2e |
| T-KEY-117 | KEY-19 | UI | P1 | — | reveal private key screen | auto-hide after visibleForMs; copy button feedback; keyboard reachable | ext-e2e |
| T-KEY-118 | KEY-14 | UI | P2 | — | onboarding password form | errors announced (aria-live), Enter submits, focus order sane | ext-e2e |
| T-KEY-119 | KEY-22 | PERF | P3 | — | 30 wallets × keystores | getState/unlock < 3 s total besides KDF | ext-perf |
| T-KEY-120 | KEY-02 | SEC | P0 | — | after create/unlock, `chrome.storage.session` access level | setAccessLevel called with TRUSTED_CONTEXTS for session and local at boot | ext-int |

## 2. Signing (SIG)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-SIG-001 | SIG-01 | UNIT | P0 | connected 0xA | personal_sign ['hello', 0xA]; [0xA, 'hello'] (swapped); ['0x68656c6c6f', 0xA] | utf8 'hello' both orders; hex input decoded to bytes; bytesHex identical | ext-unit |
| T-SIG-002 | SIG-01 | NEG | P0 | — | params not array; length 1; message number; address invalid; message > 128 KiB | -32602 with specific message | ext-unit |
| T-SIG-003 | SIG-01 | UNIT | P1 | — | '0x' and '0x1' (odd) | treated as UTF-8 text (documented) | ext-unit |
| T-SIG-004 | SIG-04 | KAT | P0 | key 0x4646…46 | evmSignMessage('hello', personal); evmRecover | signature equals viem `signMessage` for same key; recovers 0x9d8A…5A4F; EIP-191 hash = keccak('\x19Ethereum Signed Message:\n5hello') | ext-unit |
| T-SIG-005 | SIG-02 | SEC | P0 | eth_sign disabled (default) | eth_sign request | 4200 'eth_sign is disabled'; no approval window opened | ext-int |
| T-SIG-006 | SIG-02 | UNIT | P0 | enabled | eth_sign 32-byte non-UTF8 hash; UTF-8 text payload; 31-byte binary | rawHash=true; personal prefix (ASM-09); -32602 | ext-unit |
| T-SIG-007 | SIG-02 | KAT | P0 | — | raw-hash mode sign 0x00…01 | signature verifies with ecrecover over the raw hash (no prefix) | ext-unit |
| T-SIG-008 | SIG-03 | KAT | P0 | — | EIP-712 "Mail" example from the EIP with key `cow` (keccak('cow')) | digest 0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2; signature v=28 r=0x4355c4…, s=0x07299936… (EIP vector) | ext-unit |
| T-SIG-009 | SIG-03 | UNIT | P0 | — | normalizeTypedData with JSON string vs object; param order swapped; V1 array form | same normalized output; V1 → 4200 | ext-unit |
| T-SIG-010 | SIG-03 | NEG | P0 | — | missing types/primaryType/domain/message; primaryType not in types; typed data > 200 KiB; invalid JSON | -32602 | ext-unit |
| T-SIG-011 | SIG-03 | SEC | P0 | site on chain 1 | typed data with domain.chainId 137 / '0x89' / '137' | refused or explicit chain-mismatch warning blocks signing (per service.ts:185) — assert refusal | ext-int |
| T-SIG-012 | SIG-03 | SEC | P0 | connected 0xA | typed data for address 0xB | 4100 'not authorized' | ext-int |
| T-SIG-013 | SIG-03 | UNIT | P1 | — | summarizeTypedData on Permit, Permit2 PermitSingle/Batch, Seaport order, DAI permit (allowed flag), unlimited amount | approval summary with token, spender, amount, unlimited flag, expiry | ext-unit |
| T-SIG-014 | SIG-03 | PROP | P1 | — | random valid EIP-712 type trees (fast-check generator) | `typedDataDigest` equals viem `hashTypedData`; signature recovers signer | ext-prop |
| T-SIG-015 | SIG-03 | PROP | P1 | — | fuzz normalizeTypedData with arbitrary JSON | throws only ProviderError(-32602/4200), never TypeError | ext-fuzz |
| T-SIG-016 | SIG-05 | INT | P0 | connected chain 11155111, mock RPC + mock backend | eth_sendTransaction {from: me, to, value, data} approve in window | signed EIP-1559 tx with chainId 11155111, nonce from pending count, broadcast via /v1/tx/sepolia/broadcast, returns hash = keccak(raw) | ext-int |
| T-SIG-017 | SIG-05 | SEC | P0 | pending tx | site switches chain (wallet_switchEthereumChain) then user approves | 4100 'switched networks while pending'; nothing signed | ext-int |
| T-SIG-018 | SIG-05 | SEC | P0 | pending tx | user switches active account then approves | 4100 'connected account changed'; nothing signed | ext-int |
| T-SIG-019 | SIG-05 | NEG | P0 | — | from ≠ connected; value negative / >2^256; gas non-hex; data odd length; to invalid; chainId param mismatch | -32602 / 4100 | ext-unit |
| T-SIG-020 | SIG-05 | SEC | P0 | mainnet chain, build pointing at http loopback backend in release mode | eth_sendTransaction | refused by signing policy (mainnetSigningReady false) | ext-unit |
| T-SIG-021 | SIG-05 | RES | P1 | broadcast returns 503 then 200 | approve | retry with same raw bytes (idempotent key); single tx hash returned | ext-int |
| T-SIG-022 | SIG-05 | E2E | P0 | fixture dApp + mock chain | connect → send tx → approve | dApp receives hash; activity shows pending then confirmed | ext-e2e |
| T-SIG-023 | SIG-06 | UNIT | P0 | — | evmTxRequest/evmTierFees slow/standard/fast, legacy chain (no baseFee) | maxFee=2·base+tip·pct; legacy gasPrice; 21000 gas exact for native; token transfer data = transfer(to, amount) | ext-unit |
| T-SIG-024 | SIG-06 | KAT | P0 | — | EIP-155 example (nonce 9, 20 gwei, 21000, to 0x3535…35, 1 ETH, chainId 1, key 0x4646…) built through `signEvmTx` legacy path | raw = 0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83 (EIP-155 vector); hash = keccak256(raw) | ext-int |
| T-SIG-025 | SIG-06 | UNIT | P1 | — | sendService preflight: recipient contract code, insufficient native for fee, token amount > balance, estimate failure fallback | issues list with blocking flags; warning text for contract recipient | ext-unit |
| T-SIG-026 | SIG-07 | KAT | P0 | test mnemonic | build+sign one transfer per family (Solana, BTC P2WPKH, Cosmos, Tron, TON, Sui, Aptos, Near, Polkadot, Stellar, XRP, Tezos, Algorand, Cardano, Filecoin, Harmony, ICON, MultiversX, Theta, VeChain, Waves, Zilliqa, IoTeX) with mocked network inputs | signed payload equals pinned golden (wallet-core deterministic signing); signature verifies with family verifier where available | ext-int |
| T-SIG-027 | SIG-07 | NEG | P0 | — | per family: invalid recipient, zero/negative amount, amount with too many decimals, memo too long, dust below minimum | blocking issue, no signing | ext-unit |
| T-SIG-028 | SIG-07 | PROP | P1 | — | parseUnits/formatUnits (send/util) random bigints and decimals 0..36 | formatUnits(parseUnits(x,d),d) == normalized x; never float rounding | ext-prop |
| T-SIG-029 | SIG-08 | INT | P0 | Solana connected | signMessage (UTF-8), signTransaction (legacy + v0), signAllTransactions, signAndSendTransaction with mock RPC | signatures verify with ed25519 over message bytes; fee payer must be me; send broadcasts via RPC | ext-int |
| T-SIG-030 | SIG-08 | SEC | P0 | — | signMessage with bytes that parse as a transaction message | refused or flagged as transaction (looksLikeSolMessage) — no blind tx signing via signMessage | ext-unit |
| T-SIG-031 | SIG-08 | PROP | P1 | — | fuzz parseSolanaTx / solanaTx decoders with random bytes | never throws non-ProviderError; never reads out of bounds | ext-fuzz |
| T-SIG-032 | SIG-09 | INT | P1 | multi connected (cosmos, sui, aptos, ton, tron, btc) | sign requests per chain | correct curve/format; address mismatch refused; PSBT inputs not owned → refused/flagged | ext-int |
| T-SIG-033 | SIG-09 | KAT | P1 | — | TON proof (ton_proof v2 spec example), Cosmos ADR-036 signArbitrary example | match spec vectors | ext-unit |
| T-SIG-034 | SIG-09 | PROP | P2 | — | fuzz psbt.ts parser | no crash; bounded memory | ext-fuzz |
| T-SIG-035 | SIG-10 | UNIT | P0 | — | evmSigningBasis for harbour mainnet id, testnet id, custom id, unknown, '0x1', 1n, -1, '', null, 2^64 | basis values per policy; null for unknown/invalid | ext-unit |
| T-SIG-036 | SIG-10 | SEC | P0 | — | isSigningChain for non-EVM chain ids not in CHAIN_IDS | false | ext-unit |
| T-SIG-037 | SIG-11 | INT | P1 | — | sessionFor(chain) across minute boundary; estimate→broadcast share X-HB-Session | same session within a minute; backend pins upstream | ext-int |
| T-SIG-038 | SIG-12 | UNIT | P0 | — | parseSiwe on EIP-4361 example; siweIssues with mismatched domain/address/chain | parsed fields; issues ['domain'],['address'],['chain'] | ext-unit |
| T-SIG-039 | SIG-12 | PROP | P2 | — | fuzz parseSiwe / siws | never throws; returns null or object | ext-fuzz |
| T-SIG-040 | SIG-13 | INT | P0 | pending request, wallet locked | providerResolve approve | {locked:true, error:'LOCKED'}; request stays pending | ext-int |
| T-SIG-041 | SIG-13 | SEC | P0 | prefs.biometricApproval on | providerResolve without fresh providerBioProof | refused | ext-int |
| T-SIG-042 | SIG-13 | SEC | P0 | site on blocklist (phishing high) top origin or embedding origin | approve | requires explicit risk acknowledgement; otherwise refused | ext-int |
| T-SIG-043 | SIG-13 | E2E | P0 | — | reject in approval window; close window | dApp receives 4001 user rejected; closing window rejects all non-internal pending | ext-e2e |
| T-SIG-044 | SIG-05 | UI | P1 | — | approval screen | origin shown first (HW-2026-017), amounts with symbol & decimals, warnings visible, buttons keyboard-accessible | ext-e2e |

## 3. dApp interaction (DAPP)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DAPP-001 | DAPP-04 | UNIT | P0 | — | parsePageRequest valid {id,ns,method,params} | ok with deep copy; extra keys dropped | ext-unit |
| T-DAPP-002 | DAPP-04 | NEG | P0 | — | null, array, id missing/65 chars/with spaces, ns 'btc', method 'a.b', params with function/symbol/bigint/NaN/Infinity/undefined, depth 25, 20001 nodes, 256 KiB+1 JSON | ok:false with -32600/-32602 and id echoed when parseable | ext-unit |
| T-DAPP-003 | DAPP-04 | SEC | P0 | — | params containing `__proto__`, `constructor`, `prototype` keys (also nested, also via JSON.parse) | rejected; Object.prototype unmodified after call | ext-unit |
| T-DAPP-004 | DAPP-04 | PROP | P0 | — | fuzz parsePageRequest with fast-check `anything()` | never throws; ok ⇒ output JSON-serialisable and ≤256 KiB | ext-fuzz |
| T-DAPP-005 | DAPP-05 | UNIT | P0 | — | specFor for every method in EVM/SOLANA/MULTI tables; 'toString', '__proto__', 'hasOwnProperty' | spec or null; prototype names → null | ext-unit |
| T-DAPP-006 | DAPP-05 | NEG | P1 | — | each UNSUPPORTED_EVM method via content script | 4200 without reaching background | ext-unit |
| T-DAPP-007 | DAPP-03 | SEC | P0 | content script loaded | HELLO with bad nonce format; from another window (iframe postMessage to parent); second HELLO after ack; origin mismatch | ignored; first valid channel wins | ext-unit (jsdom) |
| T-DAPP-008 | DAPP-03 | INT | P1 | content loads after inpage | inpage retries | channel established within 200 tries; requests queued until ack | ext-unit (jsdom) |
| T-DAPP-009 | DAPP-06 | NEG | P1 | — | duplicate request id in flight; 201 inflight | -32600 duplicate; -32005 limit | ext-unit |
| T-DAPP-010 | DAPP-06 | RES | P0 | inflight requests | background port disconnects (SW restart) | reconnect with backoff; inflight requests re-sent; background dedupes via takeSettled (no double approval) | ext-int |
| T-DAPP-011 | DAPP-06 | RES | P1 | extension reloaded (runtime.id undefined) | request | fatal message; all inflight rejected with 'Harbour was reloaded…'; provider emits disconnect 4900 | ext-unit |
| T-DAPP-012 | DAPP-07 | SEC | P0 | — | port sender: chrome-extension URL; no tab; frameId missing; origin 'null' (sandboxed iframe); http://evil.com; https; http://localhost | rejected (4100 answers) for the first five; accepted for https & loopback | ext-int |
| T-DAPP-013 | DAPP-07 | SEC | P0 | evil.com iframe embedded in good.com which is connected | iframe requests eth_accounts / sign | origin = evil.com (not good.com); not connected → [] / 4100 | ext-int |
| T-DAPP-014 | DAPP-07 | UNIT | P1 | — | normalizeOrigin: 'https://a.com/path?x', 'https://A.COM:443', 'http://127.0.0.1:8545', 'ftp://x', 'javascript:alert(1)', '' | origin strings / null | ext-unit |
| T-DAPP-015 | DAPP-08 | INT | P0 | — | eth_requestAccounts → approve → eth_accounts; disconnect via settings; revoke via wallet_revokePermissions | accounts [me]; after disconnect [], accountsChanged [] and disconnect events to that origin only | ext-int |
| T-DAPP-016 | DAPP-08 | SEC | P0 | site A connected | site B eth_accounts | [] (no cross-origin leakage) | ext-int |
| T-DAPP-017 | DAPP-08 | SEC | P0 | WalletConnect session for 'https://a.com' | injected a.com eth_accounts | not connected (separate key `#walletconnect`, PT-06) | ext-int |
| T-DAPP-018 | DAPP-08 | NEG | P1 | blacklisted origin | any request | 4100 blacklist message | ext-int |
| T-DAPP-019 | DAPP-08 | UNIT | P1 | — | PermissionStore connect/scoped/disconnect(ns)/revoke/isConnected/list with fake KV | correct records; namespaces tracked; storage shape stable | ext-unit |
| T-DAPP-020 | DAPP-09 | UNIT | P0 | fake clock | PendingStore add beyond MAX_PENDING_TOTAL, per-origin cap, TTL expiry 15 min, settled 5 min | oldest rejected / limit error; expired removed by gc; settled retrievable once | ext-unit |
| T-DAPP-021 | DAPP-09 | CONC | P0 | — | same request id resent after SW restart while approval pending | single pending entry; outcome delivered once | ext-int |
| T-DAPP-022 | DAPP-09 | SEC | P0 | pending sign from tab 1 doc A | tab navigates (new documentId) then user approves | outcome not delivered to new document; request dropped (dropFor) | ext-int |
| T-DAPP-023 | DAPP-10 | UNIT | P0 | fake clock | RateLimiter capacity/refill, maxKeys eviction | tokens refill linearly; 501st key evicts oldest | ext-unit |
| T-DAPP-024 | DAPP-10 | NEG | P0 | — | 7 eth_requestAccounts in 1 s from one origin | 7th refused -32005; approval window not spammed | ext-int |
| T-DAPP-025 | DAPP-11 | INT | P1 | connected | wallet_switchEthereumChain to known chain; to unknown chain | chainChanged event; 4902 for unknown | ext-int |
| T-DAPP-026 | DAPP-11 | SEC | P0 | — | wallet_addEthereumChain rpcUrls: http://192.168.1.1, http://10.0.0.1, http://169.254.169.254, http://[::1], http://printer.local, http://localhost:8545, https://rpc.example | private ones refused before any fetch; loopback & public accepted | ext-unit |
| T-DAPP-027 | DAPP-11 | SEC | P0 | — | add chain where RPC reports different chain id than requested | refused | ext-int |
| T-DAPP-028 | DAPP-11 | NEG | P1 | — | chainId non-hex, leading zero '0x01', > 2^53, nativeCurrency decimals ≠18, name with control chars, explorer javascript: URL | -32602 | ext-unit |
| T-DAPP-029 | DAPP-11 | CONC | P2 | — | two add-chain approvals for same id race; SW restart before network list loaded | single entry; stored list not overwritten (networksReady) | ext-int |
| T-DAPP-030 | DAPP-11 | UNIT | P1 | — | isPrivateNetworkUrl with decimal/octal/hex IPv4 forms (normalised by URL parser), 0.0.0.0, 224.0.0.1, 100.64.0.1, 'intranet' (no dot) | true; documented ASM-11 for DNS names | ext-unit |
| T-DAPP-031 | DAPP-12 | UNIT | P1 | — | sanitizeToken: decimals 0..36 / 37 / -1 / 1.5; symbol with RTL override; address checksum invalid; 101st token | valid / error per rule; cleaned symbol | ext-unit |
| T-DAPP-032 | DAPP-13 | INT | P1 | connected chain | eth_call, eth_getBalance, eth_sendRawTransaction passthrough | proxied to selected network RPC; results returned; rate limited per origin | ext-int |
| T-DAPP-033 | DAPP-13 | SEC | P1 | not connected | eth_call | allowed (read-only) or refused per spec — assert current behaviour and that no account data is implied | ext-int |
| T-DAPP-034 | DAPP-14 | INT | P1 | two tabs same origin, one other origin | change active account / chain | events only to tabs of connected origin; event names filtered by EVENT_ALLOWLIST | ext-int |
| T-DAPP-035 | DAPP-14 | SEC | P0 | — | storage.onChanged handler | init messages never include storage values or session key material (only public InitState fields) | ext-int |
| T-DAPP-036 | DAPP-15 | UNIT | P0 | — | checkHost: exact, subdomain, whitelist override, punycode, uppercase, trailing dot | blocked/ok per eth-phishing-detect semantics | ext-unit |
| T-DAPP-037 | DAPP-15 | RES | P1 | list fetch fails / returns HTML / > 6 MB | siteRisk | 'unavailable' (no false 'ok' claim); cache not persisted when too large | ext-unit |
| T-DAPP-038 | DAPP-15 | SEC | P0 | embedding origin blocklisted, iframe origin clean | approval | high risk detected via topOrigin | ext-int |
| T-DAPP-039 | DAPP-16 | UNIT | P2 | — | isBlockedDomain('x.com'), 'sub.x.com', 'notx.com', EXCLUDE_MATCHES patterns valid match patterns | true, true, false; patterns valid | ext-unit |
| T-DAPP-040 | DAPP-17 | INT | P1 | fake WalletKit | pair URI, session proposal approve/reject, request routed through ProviderService with same validation, chain add on chainChanged, disconnect | identical checks to injected path; permission key `<origin>#walletconnect` | ext-int |
| T-DAPP-041 | DAPP-17 | MIG | P1 | pre-PT-06 sessions sharing injected key | resume | sessions ended once and shared record removed | ext-int |
| T-DAPP-042 | DAPP-17 | NEG | P1 | — | malformed pairing URI, unknown chain namespaces, request for unapproved method | errors returned to peer; no crash | ext-int |
| T-DAPP-043 | DAPP-18 | UNIT | P0 | — | decodeCalldata for transfer, transferFrom, approve (limited/unlimited ≥2^159), increaseAllowance, setApprovalForAll(true/false), permit, multicall nested 4 deep, unknown selector, truncated data | correct DecodedCall; flattenCalls stops at depth 3; unknown → 'unknown' (flagged undecodable, A3) | ext-unit |
| T-DAPP-044 | DAPP-18 | PROP | P1 | — | fuzz decodeCalldata with random hex | never throws | ext-fuzz |
| T-DAPP-045 | DAPP-18 | UNIT | P1 | — | plainLabel/displayText with bidi overrides U+202E, zero-width, newlines, 1000 chars | stripped & truncated | ext-unit |
| T-DAPP-046 | DAPP-19 | INT | P2 | fake chrome.scripting | registerInpage twice | update path on duplicate id; MAIN world, all frames, document_start | ext-unit |
| T-DAPP-047 | DAPP-20 | INT | P1 | pending from tab | tab closed; approval window closed | pending dropped / rejected (non-internal) | ext-int |
| T-DAPP-048 | DAPP-01 | UNIT | P1 | jsdom inpage | window.ethereum.request, send (legacy), sendAsync, isConnected, on/removeListener, EIP-6963 announceProvider on requestProvider event | spec-compliant behaviour; no `isTrust`/`trustwallet` impersonation (HW-2026-010) | ext-unit |
| T-DAPP-049 | DAPP-01/DAPP-02 | SEC | P1 | — | page overwrites window.ethereum methods / prototype | wallet's internal bridge unaffected (closures), handshake still private | ext-unit |
| T-DAPP-050 | DAPP-02 | UNIT | P2 | jsdom | solana provider connect({onlyIfTrusted:true}) when not trusted | 4100 'not trusted yet' | ext-unit |
| T-DAPP-051 | DAPP-01..20 | E2E | P0 | Playwright + fixture dApp (`tools/e2e/dapp`) | connect, personal_sign, typed sign, send, switch chain, add chain, watch asset, disconnect | each flow end-to-end through real content script + SW + approval window | ext-e2e |
| T-DAPP-052 | DAPP-07 | E2E | P0 | Playwright | cross-origin iframe on fixture dApp attempts eth_requestAccounts | approval shows iframe origin, not top origin; top-origin risk evaluated | ext-e2e |
| T-DAPP-053 | DAPP-10 | PERF | P2 | — | 1000 eth_blockNumber reads from one page | served within rate limits, SW memory stable | ext-perf |

## 4. Extension platform (EXT)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-EXT-001 | EXT-01 | SEC | P0 | built manifest (prod mode, https API) | parse dist/manifest.json | permissions exactly the 9 listed; host_permissions only `https://*/*` (no loopback in prod); no `externally_connectable`; no `web_accessible_resources` exposing internal pages; minimum_chrome_version 137 | ext-unit |
| T-EXT-002 | EXT-01 | CON | P1 | local build (VITE_HB_API_URL=http://localhost) | manifest | adds loopback host permissions only then | ext-unit |
| T-EXT-003 | EXT-02 | SEC | P0 | — | CSP string | script-src 'self' 'wasm-unsafe-eval' only; object-src 'self'; base-uri 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'; no 'unsafe-eval'/'unsafe-inline'/remote hosts | ext-unit |
| T-EXT-004 | EXT-02 | SEC | P0 | Playwright popup | attempt `el.innerHTML = '<img onerror>'` via DevTools eval | TypeError (Trusted Types) | ext-e2e |
| T-EXT-005 | EXT-03 | UNIT | P0 | — | isInternalWalletSender: popup URL; side panel same URL; `/src/popup/index.html?x` ; other path; content script sender (tab, page URL); other extension id; http URL; missing url | true only for exact extension popup path | ext-unit |
| T-EXT-006 | EXT-03 | SEC | P0 | real router | runtime.sendMessage from content-script-like sender for every INTERNAL message | {ok:false, error:'UNAUTHORIZED'}; no handler invoked (spy) | ext-int |
| T-EXT-007 | EXT-03 | SEC | P0 | — | message with isInternal/source/internal flags | stripped before dispatch | ext-unit |
| T-EXT-008 | EXT-04 | INT | P0 | fake chrome with setAccessLevel spy | SW boot | session and local set to TRUSTED_CONTEXTS | ext-int |
| T-EXT-009 | EXT-05 | UNIT | P0 | — | registerEvent duplicate; dispatch unknown; handler throws Error with URL+key in message | throws 'duplicate event'; undefined → 'unknown_message'; error redacted | ext-unit |
| T-EXT-010 | EXT-05 | SEC | P1 | (ASM-15) | union of keys of every handler map (modules + handlers/*) | pairwise disjoint | ext-unit |
| T-EXT-011 | EXT-05 | NEG | P1 | — | raw message null, string, {type:5}, {type:'__proto__'}, {type:'constructor'} | INVALID_REQUEST / unknown_message; no prototype access | ext-int |
| T-EXT-012 | EXT-06 | INT | P1 | — | connect `harbour-ui` from popup sender; from content sender; request with non-number id; handler throws | snapshot then patches; foreign sender disconnected; ignored; error response | ext-int |
| T-EXT-013 | EXT-07 | UNIT | P1 | fake timers | bootWith step failing 19× then succeeding; failing 20× | resolves; rejects with step name | ext-unit |
| T-EXT-014 | EXT-07 | RES | P1 | — | queue job handler throws; job without handler | kept for next boot; others removed after success | ext-unit |
| T-EXT-015 | EXT-07 | UNIT | P2 | — | selfHeal twice within 1 h | reload once | ext-unit |
| T-EXT-016 | EXT-08 | MIG | P1 | stored tuples [0,0,{}], [1,0,{…}], malformed, missing | runMigrations('pre'/'post') | version advanced per step and persisted after each step; malformed treated as fresh | ext-unit |
| T-EXT-017 | EXT-08 | UNIT | P1 | — | hydrateStore with unknown slice, partial slice, transient slices | unknown dropped; missing keep defaults; transient never persisted | ext-unit |
| T-EXT-018 | EXT-08 | SEC | P0 | — | every slice initial state & after full flows | no secret-named fields/values (ties to T-KEY-109) | ext-int |
| T-EXT-019 | EXT-09 | RES | P0 | pending approval in session storage | simulate SW termination (drop module state, keep session storage), re-import SW | approval window still lists request; approve signs exactly once | ext-int |
| T-EXT-020 | EXT-09 | E2E | P0 | Playwright | stop SW via CDP during pending approval; approve | single signature/broadcast; dApp resolves | ext-e2e |
| T-EXT-021 | EXT-10 | UNIT | P1 | — | applyPatch/normalizeSettings with unknown keys, bad types, locale not supported, currency unknown | sanitized settings; defaults applied | ext-unit |
| T-EXT-022 | EXT-10 | SEC | P0 | — | setSettings patch that weakens security (enable eth_sign, longer auto-lock, disable biometric approval) without manage grant | refused AUTH_REQUIRED (weakensSecurity) | ext-int |
| T-EXT-023 | EXT-10 | UNIT | P2 | — | pickLocale/intlTag/localeLabel | expected tags | ext-unit |
| T-EXT-024 | EXT-11 | KAT | P0 | test Ed25519 keypair (RFC 8032 test 1) | verifySignature over exact text; altered whitespace; wrong key; bad base64 | true / false / false / false | ext-unit |
| T-EXT-025 | EXT-11 | SEC | P0 | stored version 5 | config version 4 (valid sig); expired expiresAt; non-boolean flags; announcement url javascript: | refused / refused / filtered / url dropped | ext-unit |
| T-EXT-026 | EXT-11 | SEC | P1 | (ASM-06) | valid config without expiresAt | accepted (documents replay risk AMB-11) | ext-unit |
| T-EXT-027 | EXT-11 | RES | P1 | config endpoint 500 / timeout / invalid JSON | refreshConfig | null; previous config kept; kill switches unchanged | ext-unit |
| T-EXT-028 | EXT-12 | UNIT | P0 | — | SIGNING_POLICY frozen; FEATURES values; featureEnabled unknown key | explicit values asserted (review gate); unknown → false | ext-unit |
| T-EXT-029 | EXT-12 | UNIT | P0 | — | smartAccountsAvailable matrix (flag × walletType × chain) | true only for flag true + mnemonic/privateKey + pinned chain + signing chain | ext-unit |
| T-EXT-030 | EXT-13 | INT | P1 | fake offscreen API | two concurrent copy requests | single offscreen doc; point-to-point port; clear timers per copy | ext-int |
| T-EXT-031 | EXT-14 | SEC | P0 | test keypair | release.mjs sign → verify-release.mjs; tamper zip byte | verify ok / fails | ext-unit |
| T-EXT-032 | EXT-14 | SEC | P0 | — | check-frozen.mjs after modifying a frozen file in a temp copy | fails with file name | ext-unit |
| T-EXT-033 | EXT-14 | SEC | P0 | fake built bundle containing an Alchemy URL with key / a value from a fake key file | verify.mjs leak scan function | flags the file | ext-unit |
| T-EXT-034 | EXT-14 | SEC | P1 | — | env-guard.mjs with .env.production holding SECRET-like value (SEC-2026-11-18-01) | build refused | ext-unit |
| T-EXT-035 | EXT-15 | SEC | P0 | Playwright | type password in unlock field, submit; type phrase in import field, submit | input values cleared from DOM after submit; React state cleared; no secret in `document.body.innerText` or a11y tree after navigation | ext-e2e |
| T-EXT-036 | EXT-15 | UI | P1 | — | revealGate / backupGate (HW-2026-004) | receive/buy/fund routes gated until backup done; hashchange re-bind | ext-e2e |
| T-EXT-037 | EXT-16 | INT | P2 | fake push event | wirePushEvents with payload | notification created with safe text; malformed payload ignored | ext-int |
| T-EXT-038 | EXT-01..16 | E2E | P1 | Playwright | full smoke: install → onboarding tab opens automatically → create → lock via idle API emulation → unlock | flows succeed | ext-e2e |
| T-EXT-039 | EXT-06 | PERF | P3 | — | 1000 store patches with UI open | patch fan-out < 50 ms p95 | ext-perf |
| T-EXT-040 | EXT-15 | UI | P2 | axe-core in Playwright (dev only) | home, send, approval, settings, onboarding | no critical a11y violations; hidden home layer inert (b26a725) | ext-e2e |

## 5. Transaction UX safety (UX)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-UX-001 | UX-01 | UNIT | P0 | — | isUnlimited at 2^159-1, 2^159, MAX_UINT256 | false, true, true | ext-unit |
| T-UX-002 | UX-02 | UNIT | P0 | — | setApproveAmount on approve calldata; on non-approve; amount > MAX_UINT256; negative | rewritten selector+spender preserved; null; null; null | ext-unit |
| T-UX-003 | UX-02 | E2E | P1 | dApp approve unlimited | user edits cap to 10 tokens | signed tx data encodes 10·10^dec | ext-e2e |
| T-UX-004 | UX-03 | INT | P1 | mock backend simulate full/basic/failed | approval view | asset changes displayed; failure shows 'would fail'; basic mode labelled | ext-int |
| T-UX-005 | UX-04 | INT | P1 | mock multicall RPC | approvalsScan → approvalsRevoke | only allowance>0 shown; revoke builds approve(spender,0) and goes through signing policy | ext-int |
| T-UX-006 | UX-04 | PERF | P2 | 500 pairs | scan | ≤ 6 multicall requests (≈100 per call) | ext-unit |
| T-UX-007 | UX-05 | UNIT | P0 | — | sendValidateAddress per family: valid, wrong checksum (EVM mixed-case), other-family address, empty, whitespace, zero address | valid/invalid; checksum mismatch flagged | ext-unit |
| T-UX-008 | UX-05 | SEC | P0 | address book with 0xAbC…123 | recipient 0xAbC…(poisoned middle)…123 from history | poisoning warning (similar prefix/suffix) or at minimum full-address confirmation; scam list hit → blocking warning | ext-int |
| T-UX-009 | UX-05 | UNIT | P2 | — | addressBook save/remove/list limits, duplicate names | per rules | ext-unit |
| T-UX-010 | UX-06 | PROP | P0 | — | toAtomic/fromAtomic, parseTokenAmount/formatTokenAmount, parseUnits/formatUnits for decimals 0..36 and random strings | round-trip exact; reject >decimals fraction digits, negatives, exponents, '1e3', ' 1', '.', '1.' handled consistently; never Number precision loss | ext-prop |
| T-UX-011 | UX-06 | UNIT | P1 | — | formatFiat/compact/signed for 0, 1e-9, 1e15, negative, NaN, each currency locale | stable formatting; NaN → '—' or 0 (no 'NaN' text) | ext-unit |
| T-UX-012 | UX-06 | NEG | P0 | — | backend formatUnits with dec=-1, dec=1_000_000, raw '-5', raw '1e3' (ASM-04) | no panic, bounded output (expected fail if it panics → BUGS_FOUND) | be-unit |
| T-UX-013 | UX-06 | PROP | P1 | — | backend formatUnits(raw, d) vs big.Rat reference for random raw/d∈[0,77] | equal | be-prop |
| T-UX-014 | UX-07 | UNIT | P1 | — | cleanText on control chars/RTL/1000 chars; SpamScore on airdrop-like names ('Visit x.com to claim'), unicode lookalikes, decimals nil/0/>36 | cleaned; spam score high for scam patterns | ext-unit, be-unit |
| T-UX-015 | UX-08 | UNIT | P1 | — | (see T-DAPP-045) | — | ext-unit |
| T-UX-016 | UX-09 | UNIT | P0 | — | validateLifiTransaction: to ≠ diamond; data with transfer/approve selector; receiver ≠ me; minAmountOut below quote×(1-slippage); value ≠ quoted; chain mismatch; non-EVM receiver marker for EVM dest | SwapError for each; valid tx passes | ext-unit |
| T-UX-017 | UX-09 | UNIT | P0 | — | decodeLifiCall for each facet shape (swap, bridge BridgeData) and unknown | decoded or null (fail closed) | ext-unit |
| T-UX-018 | UX-09 | UNIT | P0 | — | Jupiter tx: program not JUP; fee payer not me; extra signer slots | refused | ext-unit |
| T-UX-019 | UX-09 | PROP | P1 | — | fuzz parseSolanaTx / decodeLifiCall | never throws non-SwapError; attachSolanaSignature length invariant | ext-fuzz |
| T-UX-020 | UX-10 | UNIT | P1 | — | gasFees.buildQuote with/without feeHistory, maxPriority 0, huge baseFee | tiers monotonic slow≤standard≤fast; costs = fee×gas | ext-unit |
| T-UX-021 | UX-11 | UNIT | P1 | — | backend friendlyChainError for each pattern incl. mixed case; unknown | mapped codes; 'rejected' default | be-unit |

## 6. Smart accounts (SA)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-SA-001 | SA-01 | UNIT | P0 | — | constants: every DELEGATES chain has PAYMASTERS and limitsFor entry; addresses lowercase; ENTRYPOINT checksum valid | invariants hold | ext-unit |
| T-SA-002 | SA-02 | UNIT | P0 | — | checkIntent: unpinned chain; from ≠ account (case-insensitive equal accepted); 0 calls; 17 calls; call to DelegationManager / each enforcer (any case); call to self/delegate/EntryPoint with data; with '0x' data | GuardError reasons chain/from/calls/protocol_call/self_call; '0x' self call allowed | ext-unit |
| T-SA-003 | SA-03 | UNIT | P0 | — | delegationState: '', '0x', '0x0', 0xef0100+pinned (upper/lower), 0xef0100+other, contract code, null | none/pinned/other | ext-unit |
| T-SA-004 | SA-04 | UNIT | P0 | — | acceptGasPrice/Estimate/sponsor: non-object, missing fast, '0x0' maxFee, value > limits, priority > max, leading zero '0x01', 67-char hex, non-pinned paymaster, total fee > maxTotalFeeWei | GuardError each; valid replies parsed to bigint | ext-unit |
| T-SA-005 | SA-04 | PROP | P0 | — | random gas replies | accepted ⇒ all values within LIMITS and total fee ≤ cap | ext-prop |
| T-SA-006 | SA-05 | INT | P0 | Sepolia mock RPC, unlocked mnemonic wallet | smartAccountPrepare(enable) → smartAccountApprove | EIP-7702 authorization signed for pinned delegate & chain id & current nonce+1; type-4 tx gas 150k; user-paid | ext-int |
| T-SA-007 | SA-05 | SEC | P0 | — | prepared op older than PREPARED_TTL_MS; approve twice; reject then approve | expired / one-shot / refused | ext-int |
| T-SA-008 | SA-06 | INT | P0 | mock bundler | sendOperation sponsored and user-paid | userOp signed over EntryPoint v0.7 hash; inclusion verified by UserOperationEvent for the right hash & sender; mismatch → error | ext-int |
| T-SA-009 | SA-06 | UNIT | P0 | — | verifyInclusion with receipt null, status 0x0, logs for other userOpHash/account, success=false | mismatch / tx_reverted / op_reverted | ext-unit |
| T-SA-010 | SA-07 | UNIT | P1 | — | normalizeSendCalls v1.0/v2.0.0, atomicRequired, chainId mismatch, from mismatch, required unknown capability | normalized / errors (refuseRequiredCapabilities) | ext-unit |
| T-SA-011 | SA-07 | INT | P1 | flag on | wallet_getCapabilities, wallet_sendCalls, wallet_getCallsStatus (pending/done), showCallsStatus | EIP-5792 shapes; status codes; bundles per origin in session (≤50) | ext-int |
| T-SA-012 | SA-07 | SEC | P0 | flag off | any 5792/7715 method | 4200 | ext-int |
| T-SA-013 | SA-08 | UNIT | P0 | — | normalizePermissionRequest: expiry > 30 days, past, non-integer; allowance 0/negative/huge; unknown type; session key invalid | errors; valid normalized | ext-unit |
| T-SA-014 | SA-08 | SEC | P0 | grants for site A | site B wallet_getGrantedExecutionPermissions | only own grants | ext-int |
| T-SA-015 | SA-09 | INT | P1 | first op | sponsorship flag & confirmation shows gasless vs user-paid as Pimlico reports | correct label | ext-int |
| T-SA-016 | SA-10 | UNIT | P0 | — | (T-EXT-029) | — | ext-unit |
| T-SA-017 | SA-02..09 | E2E | P2 | Playwright + mock bundler | enable smart account, send batch from dApp, check status | end-to-end with guard | ext-e2e |

## 7. Chains, networks, tokens (CH)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-CH-001 | CH-01 | CON | P1 | — | chainList.gen.ts vs backend `config/chains.yaml` | every backend EVM chain present with same chain id/name; testnet flags consistent (single source of truth) | ext-unit |
| T-CH-002 | CH-01 | UNIT | P1 | — | chainById, testnets list (2–3 + curated), network groups Default/Custom/Testnets | per product rule | ext-unit |
| T-CH-003 | CH-02 | UNIT | P1 | — | validateNetwork: duplicate chainId, builtin chainId, bad URL, http non-local, symbol >6, name empty | errors per field | ext-unit |
| T-CH-004 | CH-02 | INT | P1 | mock RPC | probeRpcChainId ok / mismatch / timeout / non-JSON | ok / error / error / error | ext-unit |
| T-CH-005 | CH-03 | UNIT | P1 | mock client | probeToken: EOA, non-token contract, decimals 37, symbol bytes32, network error | INVALID/NOT_A_CONTRACT/NOT_A_TOKEN/…/NETWORK_ERROR | ext-unit |
| T-CH-006 | CH-03 | INT | P1 | — | tokenAdd/tokenRemove/tokenList persist in vault customTokens; ≤100 | persisted; 101st refused | ext-int |
| T-CH-007 | CH-04 | INT | P1 | mock backend portfolio | getBalances (coalesced, 61e9857) | concurrent identical requests produce one backend call | ext-int |
| T-CH-008 | CH-04 | SEC | P1 | backend returns portfolio for an address not requested | client.checkPortfolio | rejected (HW-2026-014) | ext-unit |
| T-CH-009 | CH-05 | INT | P0 | mock chain | sendQuote → sendSubmit (native & ERC-20) | tiers; signed+broadcast; activity pending record | ext-int |
| T-CH-010 | CH-05 | NEG | P0 | — | sendSubmit with stale quote, amount > balance, chain not signing, locked | errors; nothing signed | ext-int |
| T-CH-011 | CH-05 | E2E | P0 | Playwright + mock chain | send ETH via UI | confirm screen shows recipient, amount, fee; tx hash shown | ext-e2e |
| T-CH-012 | CH-06 | INT | P0 | — | harbourRpc for served chain: request signed (headers X-HB-*), eth_sendRawTransaction → POST /v1/tx/<chain>/broadcast with Idempotency-Key; unserved chain → public RPC, marked for 10 min | per spec; replay response verified tx_hash == keccak(raw) | ext-int |
| T-CH-013 | CH-06 | CON | P0 | — | `canonical()` in client.ts vs Go `devicesig.Canonical` for shared fixtures (method case, query, empty body, unicode body) | byte-identical strings (cross-language golden file) | ext-unit + be-unit |
| T-CH-014 | CH-07 | RES | P1 | fake endpoints | first endpoint 429/timeout/500/invalid JSON | next endpoint used; breaker opens after N failures and half-opens after cooldown; non-RPC requests untouched | ext-unit |
| T-CH-015 | CH-07 | UNIT | P2 | — | slow-method allowance (getSupply) | longer timeout applied only to listed methods | ext-unit |

## 8. DeFi & third parties (DEFI)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DEFI-001 | DEFI-01 | INT | P0 | mock LI.FI | swapQuote → swapApprove → swapSubmit | approval exact amount to diamond; tx validated by safety; broadcast; status polling | ext-int |
| T-DEFI-002 | DEFI-01/UX-09 | SEC | P0 | mock aggregator returns tampered tx (receiver attacker) at submit refresh | swapSubmit | refused with SwapError; nothing signed | ext-int |
| T-DEFI-003 | DEFI-01 | UNIT | P1 | — | slippage rules: normalizeSlippage, step, acceptSlippageInput, >30 clamp, high warning >5, priceImpactSeverity, resolveCta matrix | per rules | ext-unit |
| T-DEFI-004 | DEFI-01 | UNIT | P2 | — | dust scan/convert thresholds | per rules | ext-unit |
| T-DEFI-005 | DEFI-01 | RES | P1 | quote API 429/500 | swapQuote | friendly error; no stale quote reused after 60 s | ext-int |
| T-DEFI-006 | DEFI-02 | INT | P1 | mock chain per family | earnPrepare/earnSubmit stake/unstake/claim (EVM, Cosmos, Solana, Polkadot, Tron, Tezos, Cardano) | correct tx shape; fee shown; validators list | ext-int |
| T-DEFI-007 | DEFI-02 | NEG | P1 | — | amount below minimum delegation, unknown validator, unsupported action | errors | ext-unit |
| T-DEFI-008 | DEFI-03 | INT | P1 | mock Sepolia | defiCatalog/defiPrepare/defiSubmit (Aave supply/withdraw, Uniswap swap via universal router) | calldata verified against router/pool addresses; feature checks | ext-int |
| T-DEFI-009 | DEFI-03 | SEC | P0 | — | defiSubmit on non-testnet chain / feature disabled | refused (assertSigningEvmChain/assertFeature) | ext-int |
| T-DEFI-010 | DEFI-04 | KAT | P1 | — | hyperliquid action signing (EIP-712 agent) KAT vs @nktkas/hyperliquid devDependency | identical signatures | ext-unit |
| T-DEFI-011 | DEFI-05 | KAT | P1 | — | polymarket order signing (EIP-712 CTF Exchange) | matches reference | ext-unit |
| T-DEFI-012 | DEFI-06 | UNIT | P1 | — | ramps guard (allowed URLs/hosts), quotes sort, checkout URL builder escaping, ICS generation | per rules; no javascript: URLs | ext-unit |
| T-DEFI-013 | DEFI-06 | SEC | P1 | — | rampsKeysSet/Get/Clear | user keys encrypted at rest; never returned in clear to UI (masked) | ext-int |
| T-DEFI-014 | DEFI-07 | UNIT | P2 | — | marketData/priceService/fiat mapRates with partial/invalid upstream data | graceful defaults | ext-unit |
| T-DEFI-015 | DEFI-08 | SEC | P1 | — | NFT media loaded only on request (SEC-2026-11-18-05); mediaUrl accepts only /v1/media/ paths | third-party URLs never loaded directly | ext-unit |
| T-DEFI-016 | DEFI-08 | INT | P1 | — | nftTransferPrepare/Submit ERC-721/1155 | safeTransferFrom calldata; ownership checked | ext-int |

## 9. Activity & data (DATA)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DATA-001 | DATA-01 | UNIT | P1 | — | classify/merge/filter over fixtures (send, receive, swap, approve, self, failed) | correct kinds, dedupe by hash, ordering by time | ext-unit |
| T-DATA-002 | DATA-01 | RES | P1 | pending activity, receipt arrives after SW restart | reconcilePendingActivity alarm | pending → confirmed/failed | ext-int |
| T-DATA-003 | DATA-02 | INT | P2 | mock Etherscan v2 gateway | history for Arbitrum Sepolia / Amoy (5f4d4a9) | rows parsed | ext-int |
| T-DATA-004 | DATA-03 | INT | P1 | — | after addWallet/removeWallet/switch | PUT /v1/me/addresses with exact add/remove diff (EVM only) | ext-int |
| T-DATA-005 | DATA-04 | INT | P2 | fake Centrifugo | wireRealtime only while UI port open; reconnect after broadcast | per spec; deployed API never returns tunnel URL (4f44aaa) | ext-int |
| T-DATA-006 | DATA-05 | INT | P0 | fake fetch backend | deviceIdentity first call | WebCrypto Ed25519 non-extractable key (exportKey('pkcs8') throws); PoW solved; registration signature verifies; saved deviceId | ext-int |
| T-DATA-007 | DATA-05 | SEC | P0 | — | challenge difficulty 27 / -1 / 1.5 | bad_challenge, no PoW loop | ext-unit |
| T-DATA-008 | DATA-05 | SEC | P0 | — | server responds device_revoked / bad signature / replay | NO re-registration (key not rotated); only device_unknown triggers re-register once | ext-int |
| T-DATA-009 | DATA-05 | CONC | P1 | — | 10 concurrent deviceIdentity() calls | one registration (Web Lock + pending promise) | ext-int |
| T-DATA-010 | DATA-05 | MIG | P1 | IDB holds legacy raw seed record (kind≠webcrypto) | deviceIdentity | wiped and re-enrolled | ext-int |
| T-DATA-011 | DATA-05 | KAT | P0 | — | JS leadingZeroBits / solvePow vs Go CheckPow on shared fixtures | agree | ext-unit + be-unit |
| T-DATA-012 | DATA-06 | SEC | P1 | — | checkPortfolio/checkNfts/checkAddresses with extra/missing fields, foreign addresses | rejected or filtered | ext-unit |

## 10. Backend API (BE)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-BE-001 | BE-01 | SEC | P0 | httptest server | any route | headers nosniff, DENY, no-referrer, CSP default-src 'none', no-store; HSTS only on TLS or trusted X-Forwarded-Proto | be-unit |
| T-BE-002 | BE-01 | NEG | P1 | — | body 1 MiB + 1 to signed route | 413 too_large (before signature work) | be-unit |
| T-BE-003 | BE-01 | SEC | P1 | handler panics | request | 500 JSON, no stack in body, process alive (Recoverer) | be-unit |
| T-BE-004 | BE-01 | SEC | P1 | log capture | request with query string + address in path | access log contains route pattern only (no query/addresses) | be-unit |
| T-BE-005 | BE-02 | RES | P1 | DB down / Redis down | GET /healthz | 503 'Database unavailable' / 'Cache unavailable' | be-int |
| T-BE-006 | BE-03 | INT | P0 | miniredis/real Redis | POST challenge | 32-byte b64url challenge, difficulty from config, expires_at = now+TTL; key hb:pow:<ch> with TTL | be-int |
| T-BE-007 | BE-03 | NEG | P0 | ChallengesPerHour=N | N+1 challenges same IP; same /64 IPv6 different host bits | 429 Retry-After 3600 on N+1 (IPv6 /64 shares bucket) | be-int |
| T-BE-008 | BE-04 | INT | P0 | challenge | solve PoW, sign registration message | 201, device_id UUID, probation tier quotas; DB row public_key 32 bytes | be-int |
| T-BE-009 | BE-04 | NEG | P0 | — | bad JSON; public_key not b64url / 31 bytes; attestation 4097 bytes; expired/unknown challenge; wrong PoW; counter '' or 21 chars; signature by other key; same challenge reused | 400 codes per path (bad_request/bad_key/challenge_expired/bad_pow/bad_signature); reuse → challenge_expired (GETDEL) | be-int |
| T-BE-010 | BE-04 | NEG | P1 | key already registered | register again | 409 already_registered | be-int |
| T-BE-011 | BE-04 | SEC | P0 | RegistrationsPerHour=2 | 3 valid registrations | 3rd 429 busy; failed PoW attempts do NOT consume the ceiling (finding 22) | be-int |
| T-BE-012 | BE-04 | CONC | P1 | — | same solved challenge submitted twice concurrently | exactly one 201 | be-int |
| T-BE-013 | BE-05 | UNIT | P1 | — | effectiveTier(default, created now/old/zero), (trusted, any) | probation / default / probation / trusted | be-unit |
| T-BE-014 | BE-06 | INT | P0 | registered device | valid signed GET /v1/me | 200 with device id | be-int |
| T-BE-015 | BE-06 | SEC | P0 | — | missing each header; device not UUID / uppercase UUID; nonce 15/65 chars/illegal char; date non-numeric; date ±(skew+1 s); signature altered; body altered after signing; query altered; method altered | 401 unauthorized / clock_skew; never 200 | be-int |
| T-BE-016 | BE-06 | SEC | P0 | — | replay identical signed request (same nonce) within window | second → 401 (auth_replay event logged) | be-int |
| T-BE-017 | BE-06 | SEC | P0 | device revoked in DB | request; then after 61 s (fake clock) | 401 device_revoked at the latest after cache expiry (ASM-05) | be-int |
| T-BE-018 | BE-06 | SEC | P0 | — | unknown device id with valid format | 401 device_unknown; counts toward auth-failure budget | be-int |
| T-BE-019 | BE-06 | NEG | P0 | — | 31 failures from one IP for unseen devices | 31st → 429 before DB lookup (spy store); a device already cached on that IP still served | be-unit |
| T-BE-020 | BE-06 | SEC | P1 | — | authFailures map > 50k keys | reset without unbounded growth | be-unit |
| T-BE-021 | BE-06 | KAT | P0 | — | devicesig.Canonical golden vectors (shared with T-CH-013); Verify with RFC 8032 test-vector keys | exact strings; true/false | be-unit |
| T-BE-022 | BE-06 | PROP | P0 | — | random method/path/body/nonce | Verify(Sign(canonical)) true; any single-byte mutation → false | be-prop |
| T-BE-023 | BE-06 | PROP | P1 | — | fuzz deviceAuth with random header values | never panics; never 200 without valid sig | be-fuzz |
| T-BE-024 | BE-07 | INT | P1 | tier RPM=5 | 6 requests in a minute; next minute | 6th 429; resets | be-int |
| T-BE-025 | BE-07 | UNIT | P1 | real Redis | dailyCounter over limit | returns false and rolls back increment; TTL set once | be-int |
| T-BE-026 | BE-08 | INT | P0 | — | PUT /me/addresses with Idempotency-Key twice same body | second replays status with `{"replayed":true}`, header Idempotent-Replay | be-int |
| T-BE-027 | BE-08 | NEG | P0 | — | same key different body; key 129 chars; concurrent same key | 422 idempotency_mismatch; 400; 409 in_progress | be-int |
| T-BE-028 | BE-08 | RES | P0 | handler returns 500/429/409 or panics | retry same key | key released, retry executes | be-int |
| T-BE-029 | BE-08 | SEC | P0 | broadcast idempotent replay | inspect Redis value | only tx_hash/status/error kept (no channel/token); keys are HMAC tags, not raw device id or key | be-int |
| T-BE-030 | BE-09 | SEC | P1 | log capture | auth failures | security_event lines carry tags only (no IP, sig, body, raw device id) | be-unit |
| T-BE-031 | BE-10/11 | CON | P1 | — | GET /me, /me/addresses | JSON schema (fields, types) stable | be-int |
| T-BE-032 | BE-12 | INT | P0 | — | add 3 EVM addresses (mixed case), remove 1 | normalised lowercase, deduped; device_count maintained; address.added only for newly tracked; link rows encrypted (no plaintext address/device association in device_addresses) | be-int |
| T-BE-033 | BE-12 | NEG | P0 | — | 0 or 101 changes; non-EVM chain; invalid address; unknown chain | 400 messages | be-int |
| T-BE-034 | BE-12 | SEC | P0 | MaxAddresses=2 | add 3 | 403 quota_exceeded; tx rolled back (no tracked rows/links/device_count changes) | be-int |
| T-BE-035 | BE-12 | NEG | P1 | (ASM-02) | request removing A and adding over-quota B | expect atomic (A still linked; backfill counter unchanged) — currently removal persists → expected-fail + BUGS_FOUND | be-int |
| T-BE-036 | BE-12 | CONC | P0 | MaxAddresses=5 | 10 parallel PUTs each adding 1 new address | ≤5 links total (FOR UPDATE serialisation) | be-int |
| T-BE-037 | BE-12 | NEG | P1 | BackfillsPerDay=2 | add 3 untracked | 429 backfill_quota; deny-listed addresses don't count | be-int |
| T-BE-038 | BE-13 | INT | P0 | fake rpc-gateway | eth_blockNumber single & batch | forwarded re-marshalled body, X-HB-Priority user, bearer token, session scoped `<device>:<sess>` | be-unit |
| T-BE-039 | BE-13 | SEC | P0 | — | method not allowlisted (debug_traceTransaction, eth_sendTransaction, personal_*); batch > MaxBatch; empty batch; invalid JSON | JSON-RPC error method_not_allowed / bad_request; nothing forwarded | be-unit |
| T-BE-040 | BE-13 | SEC | P0 | — | eth_getLogs without address/topic; topics [null]; [[]]; [[null]] (ASM-03); duplicate/differently-cased keys ADDRESS/address; extra keys | refused; `[[null]]` expected refused → BUG if forwarded | be-unit |
| T-BE-041 | BE-13 | SEC | P1 | gateway returns error.data.upstreamsTried | call | field stripped (single & batch) | be-unit |
| T-BE-042 | BE-13 | NEG | P1 | gateway returns 8 MiB+1 | call | response_too_large | be-unit |
| T-BE-043 | BE-13 | RES | P1 | gateway down | call | gateway_unavailable retryable | be-unit |
| T-BE-044 | BE-13 | NEG | P1 | RPCPerMinute=3 | batch of 4 | 429 rate_limited (batch counts per call) | be-int |
| T-BE-045 | BE-13 | PROP | P0 | — | fuzz handleRPC body | never panics; forwarded body always valid JSON-RPC with allowlisted methods | be-fuzz |
| T-BE-046 | BE-14..18 | SEC | P0 | device A tracks X; device B tracks Y | B requests portfolio/history/nfts with addresses=chain:X | 403 not_tracked (no IDOR) | be-int |
| T-BE-047 | BE-14 | INT | P1 | seeded balances/prices | portfolio | values = amount/10^dec × price; spam assets flagged; cache hit second time (X-HB-Cache) keyed per device | be-int |
| T-BE-048 | BE-14 | SEC | P1 | two devices same query string | portfolio | cache keys differ (no cross-device cache bleed) | be-int |
| T-BE-049 | BE-16 | INT | P1 | seeded activity | history paging with cursor, limit bounds (0, 1, max, max+1) | stable ordering by block_time desc, tx_hash; no duplicates across pages | be-int |
| T-BE-050 | BE-16 | NEG | P1 | — | cursor not base64 / not JSON / missing tx_hash | 400 bad cursor | be-int |
| T-BE-051 | BE-16 | PROP | P2 | — | encodeCursor/decodeCursor round-trip | identity | be-prop |
| T-BE-052 | BE-17 | INT | P2 | — | nfts with dirty flag | sync requested; media keys point to /v1/media | be-int |
| T-BE-053 | BE-18 | NEG | P2 | — | unknown asset, invalid chain, invalid range | 404/400 | be-int |
| T-BE-054 | BE-19 | SEC | P0 | tx indexed involving X (tracked by A) | B queries /v1/tx | chain view only (source 'chain'), no transfer amounts (SEC-2026-11-18-02) | be-int |
| T-BE-055 | BE-19 | SEC | P0 | tx broadcast by A pending | B queries | not 'pending' source (no Harbour-origin leak) | be-int |
| T-BE-056 | BE-19 | NEG | P1 | — | hash uppercase / 63 hex / no 0x; unknown chain | lowercase accepted; 400 otherwise | be-unit |
| T-BE-057 | BE-20 | INT | P0 | fake gateway | estimate EIP-1559 chain and legacy chain; gas = 21000 / other | fees per formula; +20% buffer except 21000; chain_id from config | be-unit |
| T-BE-058 | BE-20 | NEG | P0 | — | from not tracked; to invalid; value negative/0x-hex/2^256; data odd/too large (>128 KiB); non-EVM chain | 403 not_tracked / 400 | be-unit |
| T-BE-059 | BE-20 | RES | P1 | estimateGas returns revert; tip call fails | estimate | 422 would_fail; default tip 1 gwei used | be-unit |
| T-BE-060 | BE-21 | INT | P1 | simulator stub returns changes / ErrUnsupported / error | simulate | full mode with formatted amounts / basic mode / basic mode + warn log | be-unit |
| T-BE-061 | BE-22 | INT | P0 | signed EIP-1559 tx from tracked address | broadcast | 200 tx_hash = keccak(raw) lowercase; pending row; tx.status event; channel token when realtime secret set | be-int |
| T-BE-062 | BE-22 | SEC | P0 | — | tx signed for other chain id; pre-EIP-155 legacy tx; tx from untracked address; malformed raw; type 5 envelope | 400 wrong_network / wrong_network / 403 not_tracked / 400 bad_transaction | be-unit |
| T-BE-063 | BE-22 | RES | P1 | node replies 'already known' | broadcast | 200 with locally computed hash | be-unit |
| T-BE-064 | BE-22 | SEC | P1 | node returns different hash | broadcast | local hash used, warning logged | be-unit |
| T-BE-065 | BE-22 | RES | P1 | InsertPending fails after send | broadcast; retry with same Idempotency-Key | 500 then retry → already known → 200 (no double-send harm) | be-int |
| T-BE-066 | BE-22 | NEG | P1 | — | 11 broadcasts in a minute | 11th 429 | be-int |
| T-BE-067 | BE-23 | SEC | P0 | device tracking X, pending tx T | realtime token | subscription tokens only for balances:X and tx:T; JWT HS256 with aud 'harbour-realtime', exp=1 h, sub=device | be-int |
| T-BE-068 | BE-23 | KAT | P1 | — | SignHS256 vs independent HMAC-SHA256 JWT construction (RFC 7515 A.1 key) | identical | be-unit |
| T-BE-069 | BE-25 | SEC | P0 | — | push endpoint http://, non-push host, `fcm.googleapis.com.evil.com`, IP literal, >1024 chars; p256dh 64 bytes; auth 15 bytes | 400 bad_subscription | be-unit |
| T-BE-070 | BE-25 | INT | P1 | — | PUT then addresses change then DELETE | routes synced to route tags; delete removes sub+routes | be-int |
| T-BE-071 | BE-26 | SEC | P0 | media key whose source resolves to 127.0.0.1 / 10.x / 169.254.169.254 / [::1] / 100.64.x / 64:ff9b::a00:1 | GET media | 404 and negative cache 1 h; dialer never connects (Control hook) | be-unit |
| T-BE-072 | BE-26 | SEC | P0 | public host redirects to private IP / to file:// / 4 redirects | GET | refused | be-unit |
| T-BE-073 | BE-26 | SEC | P0 | — | SVG, HTML, 10 MiB+1, 5000×5000 PNG (25 Mpx), GIF bomb header, WebP | refused permanent (no decode of oversized) / WebP accepted | be-unit |
| T-BE-074 | BE-26 | UNIT | P1 | 1024×512 PNG | GET | PNG 512×256; headers image/png, immutable cache, CSP sandbox, nosniff | be-unit |
| T-BE-075 | BE-26 | NEG | P1 | — | key not 32 hex; unknown key; 601 requests/min/IP | 404 / 404 / 429 | be-int |
| T-BE-076 | BE-26 | CONC | P2 | — | 10 concurrent cold fetches | ≤4 concurrent decodes; others wait ≤5 s then 503 | be-unit |
| T-BE-077 | BE-26 | RES | P1 | client disconnects mid-fetch | then another client | fetch completes on own deadline; not negatively cached | be-unit |
| T-BE-078 | BE-26 | PROP | P1 | — | fuzz fetchImage decode with random bytes (served by httptest) | never panics | be-fuzz |
| T-BE-079 | BE-27 | UNIT | P1 | — | normalizeAddress for evm valid/invalid/unknown chain/non-evm | lowercase / errors | be-unit |
| T-BE-080 | BE-28 | SEC | P0 | TrustProxy on, trusted 10/8 | XFF spoofed by client direct (untrusted peer); XFF chain 'evil, client, 10.0.0.2' from 10.0.0.1 | untrusted peer: RemoteAddr unchanged; trusted: right-most untrusted hop = client | be-unit |
| T-BE-081 | BE-28 | UNIT | P1 | — | clientIP IPv4, IPv6 → /64, unparsable | per rule | be-unit |
| T-BE-082 | BE-29 | UNIT | P1 | temp config dir | Load valid; missing file; bad YAML; unknown chain in ENABLED_CHAINS; tier missing; provider key ref missing | config / errors from validate() | be-unit |
| T-BE-083 | BE-29 | SEC | P1 | — | LoadSecretFiles with NAME_FILE pointing to file; DecodeKey hex/base64 shorter than min | env populated; error | be-unit |
| T-BE-084 | BE-30 | SEC | P0 | — | requireTLS host remote + sslmode disable / require (no verify) / verify-full; loopback; socket; HB_ALLOW_INSECURE_DB=1 | refuse / refuse / ok / ok / ok / ok | be-unit |
| T-BE-085 | BE-31 | INT | P0 | fresh Postgres | migrate; run again | all versions applied once; second run applies none | db-mig |
| T-BE-086 | BE-31 | NEG | P1 | migration user without CREATEROLE | migrate | exits non-zero unless HB_ALLOW_MISSING_APP_ROLE=1 | db-mig |
| T-BE-087 | BE-32 | UNIT | P3 | — | hbclient TS & Go client canonicalisation | equals devicesig golden | be-unit |
| T-BE-088 | BE-01..28 | PERF | P2 | Postgres+Redis | 200 rps signed GET /v1/me for 30 s | p99 < 100 ms locally; no goroutine leak | be-perf |
| T-BE-089 | BE-04 | PERF | P3 | — | registration PoW at difficulty 20 | JS solvePow < 10 s on CI; Go CheckPow O(1) | ext-perf |
| T-BE-090 | BE-01..28 | CON | P1 | — | every error response | shape {"error":{"code","message","retryable"}}; messages user-presentable (no Go error text) | be-unit |

## 11. Third-party gateway (GW)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-GW-001 | GW-01 | INT | P1 | — | gw quota exceeded | 429 Retry-After 30 | be-int |
| T-GW-002 | GW-02 | UNIT | P2 | config set / unset | /v1/gw/v1/config | 200 {config,signature} cache 300 / 404 no_config | be-unit |
| T-GW-003 | GW-03 | UNIT | P1 | fake CoinGecko | ids with invalid entries, 150 ids, none | invalid dropped; ≤100 sorted; '{}' without upstream call; post-processing to {price,change} | be-unit |
| T-GW-004 | GW-04 | NEG | P1 | — | coin 'BTC' uppercase, '../x', days '2'; tickers vs_currency eur, order 'x;y' | 400 | be-unit |
| T-GW-005 | GW-05 | SEC | P1 | — | /gt/ paths with '..', encoded slashes, long ids; query keys outside list; values with '&' | 404/400 | be-unit |
| T-GW-006 | GW-06 | NEG | P2 | — | /rss/unknown, POST | 404 | be-unit |
| T-GW-007 | GW-07 | SEC | P0 | fake LI.FI | path outside regex; query > 2048; PUT method | rejected; API key header added only to LI.FI host; key scrubbed from response body | be-unit |
| T-GW-008 | GW-08 | SEC | P0 | key set | body chainId 1; tokenInChainId 11155111 & tokenOutChainId 1; nested quote.chainId 1 at depth 3; depth 13; no chain id; non-numeric chainId; query string present | rejected; only all-Sepolia bodies forwarded | be-unit |
| T-GW-009 | GW-09 | NEG | P1 | — | jup search with 2 params / long query / special chars | 400 | be-unit |
| T-GW-010 | GW-10 | NEG | P1 | — | relay/thornode path variants, thor tx status non-hex | 400/404 | be-unit |
| T-GW-011 | GW-11 | SEC | P0 | — | Helius getProgramAccounts for Token program; Stake program without memcmp; memcmp at offset 0; staker offset 12 with own address | refused / refused / refused / forwarded (SEC-2026-11-19-01) | be-unit |
| T-GW-012 | GW-12 | SEC | P0 | — | alchemy rpc: method `debug_traceCall`; body {"method":"debug_x","Method":"eth_chainId"} (A1); duplicate "method" keys; trailing data; non-string method; batch 51; eth_getLogs span 2001; fromBlock 'latest'; blockHash+range | all refused; forwarded body always rebuilt from validated fields | be-unit |
| T-GW-013 | GW-12 | INT | P1 | chain served by rpc-gateway | alchemy/<served id>/rpc | routed to rpc-gateway with bearer token, upstreamsTried stripped | be-unit |
| T-GW-014 | GW-13 | NEG | P1 | — | nft method not in list; >24 params; value with '/' | rejected | be-unit |
| T-GW-015 | GW-14 | SEC | P0 | — | etherscan module/action not allowed; apikey param supplied by caller; chainid non-digit; 9 values for one key; 201-char value | rejected / caller apikey replaced by server key | be-unit |
| T-GW-016 | GW-15 | NEG | P1 | — | trongrid path outside regex (case-insensitive variants allowed); toncenter unknown method | 403 not_allowed | be-unit |
| T-GW-017 | GW-16 | SEC | P0 | no policy configured | pm_sponsorUserOperation on chain 1 / 11155111 | 403 sponsorship_not_configured / forwarded | be-unit |
| T-GW-018 | GW-16 | SEC | P0 | policy 'sp_abc' | client context {sponsorshipPolicyId:'attacker'} and extra fields | forwarded params = [userOp, entryPoint, {sponsorshipPolicyId:'sp_abc'}] only | be-unit |
| T-GW-019 | GW-16 | NEG | P1 | policy with invalid chars | sponsor call | 400 (fail closed) | be-unit |
| T-GW-020 | GW-17 | PROP | P0 | — | fuzz parseRPCObject / jsonRPCClean | never panics; accepted ⇒ re-marshalled output parses to same method/params and only allowed methods | be-fuzz |
| T-GW-021 | GW-18 | PROP | P0 | — | fuzz canonLogFilter | accepted ⇒ exactly the 5 known keys max, each once | be-fuzz |
| T-GW-022 | GW-19 | SEC | P0 | upstream echoes API key in body / error | call | key scrubbed (scrubBytes) | be-unit |
| T-GW-023 | GW-19 | RES | P1 | upstream 401/403 | call | 502 (not 401 to device) | be-unit |
| T-GW-024 | GW-19 | RES | P1 | upstream > 4 MiB; timeout; 500 | call | bounded read / 502 upstream_unavailable | be-unit |
| T-GW-025 | GW-19 | INT | P1 | cache Redis | cacheable GET twice | second served from cache (X-HB-Cache hit) with same body/status | be-int |
| T-GW-026 | GW-* | CON | P1 | — | table test over every documented route × allowed method → resolves; × other methods → rejected | full route matrix | be-unit |

## 12. RPC gateway, indexer, ingest and workers (IDX)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-IDX-001 | IDX-01 | SEC | P0 | token set | /rpc, /status, /metrics without/with wrong/with right Bearer; /healthz | 401/401/200; healthz open | be-unit |
| T-IDX-002 | IDX-01 | SEC | P1 | token empty, GATEWAY_ALLOW_NO_TOKEN unset | start rpc-gateway main | exits non-zero | be-int |
| T-IDX-003 | IDX-02 | UNIT | P1 | fake members with heads/latency/breakers | pick with minBlock, exclusions, stale heads; pinned session | highest score eligible; pinned member reused until unhealthy | be-unit |
| T-IDX-004 | IDX-03 | RES | P1 | slow first upstream | user-facing call | hedge after delay to second; first success wins; tried list recorded | be-unit |
| T-IDX-005 | IDX-04 | UNIT | P1 | fake clock | breaker open/half-open/close transitions; bucket refill/take/wait | per state machine | be-unit |
| T-IDX-006 | IDX-05 | UNIT | P0 | — | cachePolicy for blockNumber, getBlockByNumber('latest'/finalized number/hash), getTransactionReceipt null, eth_call at latest, getLogs ranges beyond finalized | never cache non-final/null results forever; finalized immutable cached forever | be-unit |
| T-IDX-007 | IDX-05 | PROP | P1 | — | parseBlockRef fuzz | no panic | be-fuzz |
| T-IDX-008 | IDX-05 | UNIT | P2 | — | LRU max size eviction | bytes bounded | be-unit |
| T-IDX-009 | IDX-06 | CONC | P1 | — | 50 identical concurrent calls | one upstream call; each caller gets an independent copy (mutating one doesn't affect others) | be-unit |
| T-IDX-010 | IDX-07 | RES | P0 | members: one rejects 'already known', one errors | broadcast | success result; isAlreadyKnown patterns | be-unit |
| T-IDX-011 | IDX-08 | UNIT | P1 | — | getLogs range 10k background vs user-facing | background split into chunks; user-facing never split | be-unit |
| T-IDX-012 | IDX-09 | RES | P1 | head poll errors / stale | LocalHead | false when stale; BestHead excludes open breakers | be-unit |
| T-IDX-013 | IDX-10 | UNIT | P1 | — | BuildURL with key placeholders; ParseQuantity edge (0x, 0x0, non-hex, >64-bit) | URL; errors; no key in error strings (snippet) | be-unit |
| T-IDX-014 | IDX-11 | INT | P0 | Postgres + fake source | backfill new address; dormant address; failing source | done with synced_to; dormant state; failed with error, retried | be-int |
| T-IDX-015 | IDX-11 | CONC | P0 | two indexer workers | ClaimBackfill concurrently | each job claimed once (SKIP LOCKED or equivalent) | be-int |
| T-IDX-016 | IDX-12 | INT | P0 | — | IngestEvents same events twice; events across two months; event in month without partition | idempotent (event_keys); partitions created on demand; amounts NUMERIC exact | be-int |
| T-IDX-017 | IDX-12 | NEG | P0 | — | event with amount '-1', '1.5', 'abc', 79 digits | rejected by validAmount; batch not corrupted | be-int |
| T-IDX-018 | IDX-12 | PROP | P1 | — | random event batches | per-address balance projection = Σ in − Σ out (never negative for fixture histories); activity rows unique | be-int |
| T-IDX-019 | IDX-13 | UNIT | P2 | fake clock | debouncer trigger bursts, flush | coalesced refresh with merged refs | be-unit |
| T-IDX-020 | IDX-14 | SEC | P1 | — | MediaKey(src) with secret | 32 hex, keyed (differs with secret), deterministic | be-unit |
| T-IDX-021 | IDX-15 | INT | P1 | fake provider webhooks API | subscribe/unsubscribe batching; signing key stored encrypted (SecretBox) | rows & tracked_addresses.webhook_id updated | be-int |
| T-IDX-022 | IDX-16 | INT | P1 | — | HandleDelivery valid payload | ingest, promote dormant, NFTs marked moved, incoming published | be-int |
| T-IDX-023 | IDX-17 | INT | P1 | heartbeat older than DownAfter | ingest Start | gap-fill request published | be-int |
| T-IDX-024 | IDX-18 | INT | P0 | indexed tx whose block hash changed (reorg) | Repair | events removed & re-ingested at new block; balances refreshed; finalized marked | be-int |
| T-IDX-025 | IDX-19 | UNIT | P1 | — | (T-UX-014 backend part) | — | be-unit |
| T-IDX-026 | IDX-20 | SEC | P0 | webhook with key K | delivery with valid HMAC; wrong HMAC; missing header; non-hex; unknown webhook id; body > 8 MiB | 200 / 401 / 401 / 401 / 401 / 413 | be-int |
| T-IDX-027 | IDX-20 | SEC | P0 | — | authentic delivery whose first event is older than replay window | 200 but not published (ignored) | be-int |
| T-IDX-028 | IDX-20 | RES | P1 | JetStream publish fails | delivery | 503 (provider retries); retry republishes | be-int |
| T-IDX-029 | IDX-20 | KAT | P1 | — | Alchemy signature example (HMAC-SHA256 hex of body) | verifies | be-unit |
| T-IDX-030 | IDX-20 | PROP | P1 | — | fuzz WebhookID/ParseWebhook | never panics | be-fuzz |
| T-IDX-031 | IDX-21 | INT | P1 | pending rows | tracker RunOnce with receipts success/fail/none; nonce consumed by other tx | confirmed/failed/backoff/replaced|dropped; events published | be-int |
| T-IDX-032 | IDX-22 | UNIT | P1 | — | notifier safeSymbol (control chars, long), displayAmount, chainLabel | sanitized | be-unit |
| T-IDX-033 | IDX-22 | RES | P1 | push endpoint 410 Gone | deliver | subscription removed | be-int |
| T-IDX-034 | IDX-23 | INT | P1 | — | price poller with source priority & failures | falls back to next source; ticks inserted; cache updated | be-int |
| T-IDX-035 | IDX-24 | INT | P2 | fake Centrifugo | bridge publish | correct channel names lowercase | be-unit |
| T-IDX-036 | IDX-25 | INT | P1 | embedded NATS | Publish/Consume durable; handler error → redelivery | at-least-once semantics | be-int |
| T-IDX-037 | IDX-26 | CON | P1 | existing contract suite pattern | every adapter (alchemy/infura/url rpc, alchemy source, coingecko/alchemy prices, alchemy risk, webpush) against httptest upstream fixtures | adapter contract holds | be-unit |
| T-IDX-038 | IDX-27 | UNIT | P2 | — | ratelimit Wait with ctx cancel; rps<=0 | returns ctx error; unlimited | be-unit |
| T-IDX-039 | IDX-28 | KAT | P0 | — | evmtx.Decode/Sender on EIP-155 example tx; EIP-1559 tx signed by viem fixture; EIP-2930; EIP-4844 (type 3); EIP-7702 (type 4) fixtures | hash, nonce, chainId, sender exactly match | be-unit |
| T-IDX-040 | IDX-28 | NEG | P0 | — | type 5; 0x7f prefix; truncated; trailing bytes; length prefix overflow (beLen n=4 huge); recID 2; r > 32 bytes; empty | errors, no panic | be-unit |
| T-IDX-041 | IDX-28 | PROP | P0 | — | fuzz Decode & Sender with random bytes + mutated valid txs | never panics; if both succeed for a mutation of a valid tx, either sender differs or the mutation was in non-signed bytes | be-fuzz |
| T-IDX-042 | IDX-28 | UNIT | P2 | (ASM-12) | high-s signature variant of valid tx | sender recovered (documented) | be-unit |
| T-IDX-043 | IDX-28 | PROP | P1 | — | EncodeBytes/EncodeBig/EncodeList round trip via header/list | decode(encode(x)) == x | be-prop |
| T-IDX-044 | IDX-29 | KAT | P0 | — | LeadingZeroBits on known hashes; CheckPow at difficulty 0, 8, 256; counter length bounds | exact | be-unit |
| T-IDX-045 | IDX-29 | UNIT | P1 | — | ValidNonce boundaries 15/16/64/65, illegal chars, unicode | per rule | be-unit |
| T-IDX-046 | IDX-30 | SEC | P0 | — | LinkCrypto seal/open round trip; open with other device id (AAD); tampered blob; short blob; secret < 32 bytes | ok / error / error / error / constructor error | be-unit |
| T-IDX-047 | IDX-30 | SEC | P0 | — | DeviceTag/KeyTag/RouteTag domain separation | tags differ across functions for same input; deterministic; 32 hex | be-unit |
| T-IDX-048 | IDX-30 | PROP | P1 | — | random (device, tracked id) | open(seal(x)) == x; nonce fresh each seal | be-prop |
| T-IDX-049 | IDX-30 | SEC | P1 | — | SecretBox round trip; tamper; wrong label | ok / error / error | be-unit |
| T-IDX-050 | IDX-11..24 | PERF | P2 | 10k tracked addresses, 1M transfers | history page query & ingest batch | EXPLAIN uses indexes (address_activity_page, transfers_hash); p95 page < 50 ms locally | be-perf |
| T-IDX-051 | IDX-03 | PERF | P3 | fake upstreams | 1000 rps through gateway | no unbounded goroutines; latency overhead < 5 ms | be-perf |

## 13. Database (DB)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DB-001 | DB-21 | MIG | P0 | empty DB (no partman) | apply 0001..0010 | success; schema_migrations has 10 versions | db-mig |
| T-DB-002 | DB-21 | MIG | P1 | DB with pg_partman available | apply all | partman path taken; partitions managed by partman | db-mig |
| T-DB-003 | DB-21 | CONC | P0 | — | two migrate processes concurrently | advisory lock serialises; each version once | db-mig |
| T-DB-004 | DB-21 | RES | P0 | inject failing SQL in a copy of migration N | migrate | migration N rolled back entirely, not recorded; earlier ones kept | db-mig |
| T-DB-005 | DB-20 | MIG | P0 | DB at 0009 populated with text refs (assets, transfers across 2 months + default partition, activity summaries with assets) | apply 0010 | every hash/address converted to bytea; hb_ref_text(round-trip) equals lowercase originals; summaries compacted with asset ids; row counts unchanged | db-mig |
| T-DB-006 | DB-20 | MIG | P1 | DB at 0006 with EIP-7708 pseudo-asset transfers | apply 0007 | pseudo transfers & balances deleted; spam_score 100; activity summaries filtered; event_keys kept | db-mig |
| T-DB-007 | DB-20 | MIG | P1 | DB at 0007 | apply 0008 | added_at truncated to day; default changed; harbour_app role & grants exist | db-mig |
| T-DB-008 | DB-20 | MIG | P1 | DB at 0008 with tracked rows in each backfill state | apply 0009 | constraint replaced (dormant allowed); nft_dirty false for done/capped, true others | db-mig |
| T-DB-009 | DB-20 | MIG | P2 | DB at 0003 pre-state with failed backfills; at 0004 with rows | apply 0003 / 0004 | failed→pending; device_count=1 | db-mig |
| T-DB-010 | DB-21 | MIG | P1 | (no down migrations exist) | — | N/A for "down": documented; instead verify forward-only idempotency (re-running a file's DDL fails safely only via version table) | db-mig |
| T-DB-011 | DB-03 | INT | P0 | — | insert device with 31/33-byte key; duplicate key | CHECK violation; unique violation (→ ErrDuplicateKey) | be-int |
| T-DB-012 | DB-04 | INT | P1 | — | duplicate (chain,address); invalid backfill_state; unknown chain FK | violations | be-int |
| T-DB-013 | DB-05 | INT | P0 | — | delete device | device_addresses & push rows cascade; pending_transactions.device_id set NULL | be-int |
| T-DB-014 | DB-07/08 | INT | P1 | — | insert transfer with block_time far future/past (no partition) via harbour_ensure_partition | partition created; DEFAULT partition holding rows of that month → error surfaced (AMB-16) | be-int |
| T-DB-015 | DB-17 | SEC | P1 | harbour_app login | call harbour_ensure_partition('devices', now()) | exception 'not a partitioned fact table' | be-int |
| T-DB-016 | DB-18 | PROP | P0 | — | hb_ref/hb_ref_text on random strings (hex even/odd/upper, 'native', '', unicode, '0x') | hb_ref_text(hb_ref(t)) == lower-hex-normalised t; injective on normalised domain | be-int |
| T-DB-017 | DB-19 | SEC | P0 | service login in harbour_app | CREATE TABLE, DROP TABLE, CREATE ROLE, COPY … PROGRAM, ALTER TABLE | permission denied; DML on tables allowed | be-int |
| T-DB-018 | DB-19 | SEC | P1 | — | PUBLIC execute on SECURITY DEFINER functions | documented (AMB-16) | be-int |
| T-DB-019 | DB-22 | SEC | P0 | — | EnsureAppLogin user 'Bad-Name', 'x; DROP', password 15 chars, password with quotes `a'b"c\`, user == current_user | errors / quoting safe (role created with exact password, login works) | be-int |
| T-DB-020 | DB-10/12/13 | INT | P1 | — | NUMERIC(78,0) max uint256 value; > 78 digits | stored exactly; overflow error | be-int |
| T-DB-021 | DB-23 | INT | P2 | — | PurgeDeliveries 7 d, PrunePending, PruneTimeSeries | old rows removed only | be-int |
| T-DB-022 | DB-01..16 | PERF | P2 | — | EXPLAIN of each hot query in store/read.go & indexer.go | index scans (no seq scan on large tables) | be-perf |
| T-DB-023 | DB-05 | SEC | P0 | populated DB | attacker with SELECT only on device_addresses + tracked_addresses | cannot link device to address without key: added_at only day precision; enc ref random; link_hash keyed (statistical join test on timestamps fails) | be-int |
| T-DB-024 | DB-14 | INT | P1 | — | InsertPending duplicate (chain, hash) | no error (upsert/ignore) or defined error — assert behaviour | be-int |
| T-DB-025 | DB-01..23 | MIG | P1 | — | `pg_dump --schema-only` after migrations vs committed golden schema | identical (catches drift) | db-mig |

## 14. Cross-cutting (X)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-X-001 | X-01 | PROP | P0 | — | every amount path (send, swap, earn, approvals, backend formatUnits/valueUSD) with values near 2^256-1 and decimals 0/18/36 | BigInt/big.Int exact; no Number() on wei; USD float only for display | ext-prop, be-prop |
| T-X-002 | X-01 | UNIT | P1 | — | grep-based lint: `Number(` / `parseFloat(` applied to wei/raw fields in core/** | none (or allow-listed display-only sites) | ext-unit |
| T-X-003 | X-02 | UNIT | P1 | fake clock at 23:59:59.999 UTC and month end, DST change in local TZ | daily counter key, partition month, reauth TTL, auto-lock alarm | UTC-based boundaries; local DST does not shift TTLs | be-unit, ext-unit |
| T-X-004 | X-02 | NEG | P1 | — | device clock skew exactly = ClockSkew and +1 s | accepted / rejected | be-unit |
| T-X-005 | X-03 | UNIT | P2 | — | formatFiat in ar, de, ja, zh-TC | locale-appropriate separators; RTL safe | ext-unit |
| T-X-006 | X-04 | PROP | P1 | — | JSON round trips of vault state, keystore export/import, cursor, PendingStore records | identity | ext-prop |
| T-X-007 | X-05 | MIG | P0 | fixtures of every stored-data version: v1 KDF, v1 passworder, store tuple v0, legacy secrets in storage.local, legacy passkey seal, legacy device seed, pre-PT-06 WC sessions, stored auto-lock 0 ('Never') | boot + unlock current build | all upgraded without loss; legacy artefacts removed | ext-int |
| T-X-008 | X-06 | UNIT | P1 | — | build flags × remote flags (killed provider, smartAccounts off) | features gated in both registration and handler re-check | ext-unit |
| T-X-009 | X-07 | SEC | P0 | — | scripts/api-url.mjs with http://non-loopback in production mode | build refused / HB_API_SECURE false ⇒ mainnet signing off | ext-unit |
| T-X-010 | X-08 | SEC | P1 | CI | npm audit gate (high/critical prod deps) and govulncheck | pass or documented exceptions (audit-exceptions.json) not expired | ext-unit, be-unit |
| T-X-011 | X-09 | CONC | P0 | — | (aggregate of T-KEY-019/023/052, T-BE-012/036, T-DB-003, T-IDX-009/015, T-DATA-009) | — | — |

## 15. Parameterised suites over the exhaustive index (Part C)

These suites guarantee that every generated inventory row (MSG-###, PM-###, RT-##, DBO-##, GOF-####, EXP-####) is exercised. They are table-driven: the table is generated from source by `qa/tools/gen-index.mjs`, so a new handler/method/route automatically joins the suite (a test fails if the generated table and the live registry differ).

| Test ID | Covers | Cat | Pri | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|
| T-MSG-001 | all MSG-001..160 | SEC | P0 | dispatch each message from a non-internal sender (content-script sender, other extension, http page) | `UNAUTHORIZED`, handler spy not called | ext-int |
| T-MSG-002 | all MSG | SEC | P0 | dispatch each message with `{}` body while locked and while unlocked | no throw escapes; response passes `uiSafe` (no SECRET_FIELD_BLOCKED); error strings pass `userText` | ext-int |
| T-MSG-003 | all MSG | PROP | P0 | fuzz each message with fast-check records (random types for every field read by the handler, prototype keys, huge strings) — 200 runs each in CI, 10k with HB_FUZZ_RUNS | no unhandled rejection; no storage write of secret keys to chrome.storage.local; response JSON-serialisable | ext-fuzz |
| T-MSG-004 | value-moving MSG (send*, swap*, earn*, defi*, perps*, prediction*, nftTransfer*, smartAccount*, approvalsRevoke, ledgerSend*) | SEC | P0 | invoke while locked | LOCKED/locked error; no RPC broadcast performed (fetch spy) | ext-int |
| T-MSG-005 | value-moving MSG | SEC | P0 | invoke for a chain where `isSigningChain` is false | refused before signing | ext-int |
| T-MSG-006 | registry | CON | P1 | compare live `listEvents()` after boot vs generated MSG table | equal sets (no unlisted handler) | ext-int |
| T-MSG-007 | grant-gated MSG (backupBegin, revealPrivateKey, copyPrivateKey, addWallet(non-first), qrSyncImport, removeWallet, passkeyEnroll, passkeyDisable, setSettings(weaken)) | SEC | P0 | invoke without grant, with expired grant, with grant for other wallet, with wrong-method grant | AUTH_REQUIRED in every case | ext-int |
| T-PM-001 | all PM-001..069 | NEG | P0 | each method with params: none, null, wrong type, oversized | spec-conformant error codes (-32602/-32600), never -32603 with stack | ext-int |
| T-PM-002 | PM with needsConnection | SEC | P0 | call from unconnected origin | 4100 | ext-int |
| T-PM-003 | PM with approval | SEC | P0 | call from connected origin; never approve (timeout/close) | approval window opened once (rate limited); outcome 4001 on reject/close; nothing signed | ext-int |
| T-PM-004 | PM local/rpc | UNIT | P1 | call each | result matches expected shape; rpc methods proxied only to the origin's chain | ext-int |
| T-PM-005 | all PM | PROP | P0 | fuzz params per method (fast-check `jsonValue`) through content→background | no crash, no approval opened for invalid params, no signature | ext-fuzz |
| T-PM-006 | all PM | E2E | P1 | Playwright fixture dApp invokes each method once | expected success/error per method table | ext-e2e |
| T-RT-001 | RT-06..24 (signed routes) | SEC | P0 | unsigned / bad signature / replayed | 401 for every route | be-int |
| T-RT-002 | all RT | NEG | P1 | wrong HTTP method for each path | 405 (chi) and JSON-free body; no handler execution | be-unit |
| T-RT-003 | all RT | CON | P1 | golden JSON schema per success and error response | matches | be-int |
| T-RT-004 | all RT | PROP | P0 | `go test -fuzz` per handler with random bodies/queries via httptest | no panics; no 500 except injected dependency failures | be-fuzz |
| T-RT-005 | all RT | PERF | P3 | 50 rps each for 10 s | p99 bounded; memory stable | be-perf |
| T-DBO-001 | all DBO-01..63 | MIG | P0 | after full migration: every table/index/function/role from the DBO list exists with the expected definition | exists; definitions match golden | db-mig |
| T-DBO-002 | all CHECK/UNIQUE/FK constraints in DBO list | INT | P1 | violation insert per constraint (generated) | rejected with the constraint name | be-int |
| T-GOF-001 | all GOF-0001..0627 | UNIT | P1 | coverage gate (Phase 5): every function executed by at least one test that asserts its behaviour; uncovered functions listed with justification in TEST_SUMMARY.md | ≥ 85 % line / ≥ 75 % branch on internal/api, devicesig, evmtx, store/devices; ≥ 70 % overall | be-unit, be-int |
| T-EXP-001 | all EXP-0001..1616 | UNIT | P1 | c8 coverage for core/** and background/** | same thresholds for core/vaultService, keySchedule, passworder, storage, provider/*, smartAccount/*, swap/safety | ext-unit, ext-int |

## 16. Regression tests (one per fix commit in `git log`, 2026-10-30 → 2026-11-19)

| Test ID | Commit | Cat | Pri | Behaviour pinned | Layer |
|---|---|---|---|---|---|
| T-REG-001 | 4f44aaa | REG | P2 | deployed API never returns a temporary tunnel URL as realtime URL (localhost/trycloudflare refused in non-local builds) | be-unit |
| T-REG-002 | ac9a470 | REG | P1 | Tron requests go through `/v1/gw/trongrid`; WalletConnect telemetry disabled in kit config | ext-unit |
| T-REG-003 | 61e9857 | REG | P2 | concurrent getBalances coalesced (T-CH-007) | ext-int |
| T-REG-004 | 4e40f64 | REG | P1 | capability reads cached; final batch status; receipt logs scoped to the user op hash (userOpLogs) | ext-unit |
| T-REG-005 | e4605c7 | REG | P2 | Solana getSupply allowed longer timeout; Cosmos tx search params; TzKT bakers parsing; dead Cosmos REST hosts removed | ext-unit |
| T-REG-006 | 5f4d4a9 | REG | P2 | Arbitrum Sepolia & Amoy history via Etherscan v2 gateway (T-DATA-003) | ext-int |
| T-REG-007 | 03e483b | REG | P1 | backend serving fewer chains → unserved marked, public RPC fallback, retry after 10 min | ext-unit |
| T-REG-008 | e839b99 | REG | P2 | protocol reads batched in Multicall3 | ext-unit |
| T-REG-009 | 3a43fdc | REG | P0 | getProgramAccounts restricted (T-GW-011) | be-unit |
| T-REG-010 | 9755b18 | REG | P0 | build refuses .env with secret (T-EXT-034) | ext-unit |
| T-REG-011 | d8221b9 | REG | P1 | NFT media only on request (T-DEFI-015) | ext-unit |
| T-REG-012 | 2b895b0 | REG | P0 | unpinned sponsorship refused on mainnets (T-GW-017) | be-unit |
| T-REG-013 | de98755 | REG | P0 | /v1/tx privacy (T-BE-054/055) | be-int |
| T-REG-014 | 7724fc8 | REG | P0 | QR scrypt cap (T-KEY-093); typed-data chainId warning (T-SIG-011); re-auth needed to unblock a site | ext-unit |
| T-REG-015 | b2dbc94 | REG | P0 | storage.local pinned to trusted contexts (T-EXT-008) | ext-int |
| T-REG-016 | b2b9770 | REG | P1 | undecodable/unpreviewable calls flagged; eth_simulateV1 allowed on /v1/rpc | ext-unit, be-unit |
| T-REG-017 | 0c1d006 | REG | P0 | strict JSON-RPC parse, validated body forwarded (T-GW-012 A1/A2) | be-unit |
| T-REG-018 | cf3c951 | REG | P1 | Uniswap no-Permit2 proxy with exact approvals | ext-unit |
| T-REG-019 | 0d78eb3 | REG | P0 | PT-01 (T-KEY-080), PT-03 (T-KEY-023), PT-04 (passkeyDisable needs manage grant), PT-05 (T-KEY-050), PT-08 (T-KEY-060/076), PT-11 (T-KEY-087) | ext-int |
| T-REG-020 | d2e8104 | REG | P0 | PT-02, PT-06 (T-DAPP-017), PT-07, PT-09, PT-10, PT-12 provider hardening — each finding's documented behaviour | ext-int |
| T-REG-021 | b26a725 | REG | P3 | hidden home layer inert (T-EXT-040) | ext-e2e |
| T-REG-022 | 68bcb51 / fb9c7e9 / 296961d | REG | P0 | Postgres TLS required (T-BE-084); clear error when certs missing | be-unit |
| T-REG-023 | 57ded23 | REG | P0 | keyed Redis tags, scrubbed broadcast replays, early device unlink, security headers, security-event logs (T-BE-029/030/001) | be-int |
| T-REG-024 | 320adc5 | REG | P1 | NAME_FILE secrets (T-BE-083) | be-unit |
| T-REG-025 | f4f5c94 | REG | P1 | realtime JWT audience (T-BE-067); migrate fails without harbour_app (T-BE-086) | be-int |
| T-REG-026 | 68d65cc | REG | P3 | legacy Cloudflare gateway is not deployed (ASM-14): the extension bundle and kit endpoints never reference a workers.dev / legacy gateway origin, so the fixed allowlist cannot be reached | ext-unit |
| T-REG-027 | fd7206e | REG | P1 | origin leads approval header; cross-wallet restore vectors | ext-unit |
| T-REG-028 | b05b9cc | REG | P1 | release key only from CI/KMS secret, no implicit key file (T-EXT-031) | ext-unit |
| T-REG-029 | a20239b | REG | P1 | install scripts disabled (.npmrc ignore-scripts), audit gate in verify | ext-unit |
| T-REG-030 | e09d05a | REG | P0 | biometric seal with PRF, user handle not secret (T-KEY-079/081) | ext-int |
| T-REG-031 | eba8c0f | REG | P3 | Home approvals link to full allowance scan | ext-e2e |
| T-REG-032 | 35a1ceb | REG | P0 | API responses validated & pinned to requested addresses (T-CH-008, T-DATA-012) | ext-unit |
| T-REG-033 | 0e37148 | REG | P0 | EVM signing with key bytes, zeroed on dispose (T-KEY-089) | ext-int |
| T-REG-034 | 316e5cb / c765527 | REG | P1 | backup gate on receive/buy/fund routes (T-EXT-036) | ext-e2e |
| T-REG-035 | c193d91 | REG | P1 | no Trust Wallet impersonation flags (T-DAPP-048) | ext-unit |
| T-REG-036 | def7f87 | REG | P1 | auto-lock 'Never' removed, cap 4 h, stored 0 migrated (T-KEY-036) | ext-unit |
| T-REG-037 | b2d7139 | REG | P0 | phishing block screen works; signed dApp RPC; prompted network switches (T-DAPP-036/025) | ext-int |

## 18. Gap-closure tests (added after the first traceability pass found uncovered Feature×Category cells)

These rows close cells that the first matrix run reported as gaps where a test is genuinely needed (rather than an N/A reason).

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-KEY-121 | KEY-13 | SEC | P0 | — | exported keystore JSON | cipher aes-128-ctr, KDF scrypt with wallet-core default params (n≥2^14), MAC present; passphrase is the derived passwordKey (decrypt with the raw user password FAILS) | ext-int |
| T-KEY-122 | KEY-23 | SEC | P0 | spy wraps Uint8Array allocations returned by ActiveKeys | run every signing handler (send, typed, personal, solana, multi, swap, earn, smart account) to completion and to failure | dispose() called in finally; every returned key buffer is all-zero afterwards | ext-int |
| T-KEY-123 | KEY-04 | SEC | P0 | v1 vault | any write path (persist, setPassword, migrate) | never writes a v1 (PBKDF2) record or v1 passworder blob | ext-int |
| T-KEY-124 | KEY-07 | SEC | P0 | after v1→v2 migration | scan IDB + storage.local + storage.session | no copy of old v1 keys/blobs remains; no plaintext | ext-int |
| T-KEY-125 | KEY-05 | KAT | P0 | — | passworder v2 with fixed salt/IV (test seam) vs node:crypto HKDF-SHA256 + AES-256-GCM computed independently | identical ciphertext/tag | ext-unit |
| T-KEY-126 | KEY-11 | KAT | P0 | — | BIP-39 TREZOR vectors (entropy → mnemonic → seed with passphrase 'TREZOR') via wallet-core Mnemonic/HDWallet | match published vectors | ext-int |
| T-KEY-127 | KEY-13 | KAT | P0 | — | Web3 Secret Storage v3 scrypt test vector (password 'testpassword') imported with StoredKey.importJSON | decrypts to published private key 7a28b5ba57c53603b0b07b56bba752f7784bf506fa95edc395f5cf6c7514fe9d | ext-int |
| T-KEY-128 | KEY-24 | KAT | P1 | — | codeMatchesKey on a minified keystore fixture with known code (scrypt RFC 7914 parameters scaled) | true for right code, false for wrong, MAC checked before decrypt | ext-unit |
| T-KEY-129 | KEY-14/KEY-15/KEY-26/KEY-28 | MIG | P1 | vault state from older builds: wallet without `accounts` (only `addresses`), without `type`, without activeAccount | openActiveKeys, listWallets, addAccount | treated as mnemonic, account 0 from `addresses`; no crash; persisted state upgraded consistently | ext-int |
| T-KEY-130 | KEY-21 | RES | P1 | WebAuthn unavailable / PRF extension unsupported / user cancels | enrol & unlock | clear error; password path unaffected; no partial seal stored | ext-int |
| T-KEY-131 | KEY-15 | CONC | P0 | grant | two addWallet(import) concurrently with different mnemonics | both succeed or second gets WALLET_CREATION_IN_PROGRESS; vault lists every stored keystore (no orphan keystore, no lost wallet) | ext-int |
| T-KEY-132 | KEY-22 | CONC | P1 | — | concurrent secureStore.setMany batches touching same keys | each batch atomic (all-or-nothing); final state equals one serial order | ext-int |
| T-KEY-133 | KEY-24 | CONC | P1 | staged keys | 10 wrong codes in parallel | stage destroyed after exactly 5 counted failures; no extra imports | ext-int |
| T-KEY-134 | KEY-25/KEY-26 | CONC | P1 | 2 wallets | removeWallet(B) concurrently with addAccount(B) / switchWallet(B) | final vault consistent: B absent, active points to existing wallet, no keystore for absent wallet | ext-int |
| T-KEY-135 | KEY-26 | CONC | P0 | unlocked | concurrent read-modify-write handlers (renameWallet, tokenAdd via provider addToken, backupFinish, switchAccount) | no lost update: every change present afterwards (vault persist is not serialized → likely BUG; expected-fail if lost) | ext-int |
| T-KEY-136 | KEY-02 | RES | P0 | storage write fails after PBKDF2 record written, before vault blob | createWallet | no half-created vault that blocks onboarding (exists() false or interrupted state recoverable via resetEmptyVault) | ext-int |
| T-KEY-137 | KEY-15 | RES | P0 | vault.persist throws after keystore written | addWallet | error surfaced; orphan keystore either removed or harmless and not listed; retry succeeds | ext-int |
| T-KEY-138 | KEY-25 | RES | P1 | keystore removal throws | removeWallet | wallet entry and keystore stay consistent (both present or both absent) | ext-int |
| T-KEY-139 | KEY-12/KEY-13 | NEG | P1 | — | deriveAddresses / buildStoredKey with invalid mnemonic, 11 words, non-English words, mixed case, extra spaces | invalid rejected before wallet-core (no WASM abort); normalised input accepted | ext-int |
| T-KEY-140 | KEY-07 | PROP | P0 | — | random valid mnemonics / private keys × random passphrases | rekeyKeystore(ks, a, b) decrypts with b to the same secret; never with a | ext-prop |
| T-KEY-141 | KEY-13 | PROP | P1 | — | random 12/24-word mnemonics | buildStoredKey→export→import→decryptMnemonic == input; addresses stable | ext-prop |
| T-KEY-142 | KEY-22 | PROP | P1 | — | random key names (secret & non-secret patterns) and JSON values | local.get(local.set(k,v)) == v; secret keys only ever land in IDB | ext-prop |
| T-KEY-143 | KEY-05/KEY-02 | CON | P0 | — | golden vault blob & KDF record produced by the current build (committed fixture) | current build decrypts it; field names/types unchanged (format contract for future migrations) | ext-unit |
| T-KEY-144 | KEY-22 | CON | P1 | — | KEYS map and SECRET_KEYS list | equal to committed golden list (renaming a storage key requires a migration) | ext-unit |
| T-KEY-145 | KEY-29 | NEG | P1 | locked / no agent | perpsOrder, predictionOrder | LOCKED / needs enable; no network call | ext-int |
| T-KEY-146 | KEY-29 | SEC | P0 | — | perps/prediction handlers responses | never contain agent key / api secret / passphrase (uiSafe + value scan) | ext-int |
| T-SIG-045 | SIG-08 | KAT | P0 | — | Ed25519 RFC 8032 test vectors 1–3 through the Solana signing path (wallet-core) | identical signatures | ext-unit |
| T-SIG-046 | SIG-06 | PROP | P0 | — | random tx fields (nonce, fees, gas, value, data, chainId) signed via signEvmTx | viem parseTransaction recovers our address and the same fields; chainId preserved | ext-prop |
| T-SIG-047 | SIG-04 | PROP | P1 | — | random messages | evmRecover(evmSignMessage(m)) == address; raw vs personal mode give different signatures | ext-prop |
| T-SIG-048 | SIG-04 | NEG | P1 | — | key of 31/33 bytes, non-hex message | throws, no signature | ext-unit |
| T-SIG-049 | SIG-06/SIG-07 | NEG | P0 | — | stale quote reuse, fee tier missing, nonce gap, recipient = own address (allowed?) , 0 amount | blocking issues or explicit errors per rule | ext-unit |
| T-SIG-050 | SIG-06/SIG-07 | SEC | P0 | — | send builders with from ≠ active account address; chain id override in params | refused; chain id always from registry | ext-int |
| T-DAPP-054 | DAPP-08 | CONC | P1 | — | concurrent connect approvals for same origin; connect + disconnect race | single connection record; final state matches last user action | ext-int |
| T-DAPP-055 | DAPP-08/DAPP-09 | RES | P1 | storage quota exceeded on write | connect / pending add | request fails with clear error; no corrupted records | ext-int |
| T-DAPP-056 | DAPP-11 | RES | P1 | RPC probe hangs | wallet_addEthereumChain | times out, 4xxx error to site; nothing saved | ext-int |
| T-DAPP-057 | DAPP-17 | RES | P1 | relay socket closes | WC request pending | resume via alarm; pending request still answered or rejected, never lost silently | ext-int |
| T-DAPP-058 | DAPP-09 | PROP | P1 | — | random sequences of add/settle/drop/gc/takeSettled with fake clock | invariants: ≤MAX_PENDING_TOTAL, no expired entry returned, each settled outcome taken at most once | ext-prop |
| T-DAPP-059 | DAPP-10 | PROP | P1 | — | random request timings | tokens taken in any window ≤ capacity + refill·Δt | ext-prop |
| T-DAPP-060 | DAPP-03/DAPP-04/DAPP-06/DAPP-14 | CON | P1 | — | inpage↔content↔background message schemas (req/res/evt/init/ack/fatal) | match committed golden schema; InitState fields exact | ext-unit |
| T-EXT-041 | KEY-06/KEY-14/KEY-18/KEY-19/KEY-21/SIG-05/SIG-13/EXT-10/UX-02/UX-04/UX-05/UX-06/CH-05/DEFI-01/DAPP-08 | UI | P1 | Playwright + axe-core | each screen: unlock, onboarding, backup, reveal, biometrics settings, approval (sign/typed/tx), settings/security, approvals list, send confirm, swap, connections | no critical a11y violations; full keyboard path; amounts/addresses not truncated ambiguously (full address on confirm) | ext-e2e |
| T-EXT-042 | EXT-10 | MIG | P1 | stored settings from older builds (missing keys, auto-lock 0, unknown currency, removed locale) | loadSettings | normalized; 0→default 10; unknown currency→USD | ext-unit |
| T-EXT-043 | EXT-08 | CONC | P2 | — | rapid dispatches + SW stop during 250 ms debounce | persisted state never partially written; next boot hydrates last complete tuple | ext-int |
| T-EXT-044 | EXT-08 | PROP | P2 | — | random persisted slice objects | hydrate never throws; result has every slice with default keys | ext-prop |
| T-EXT-045 | EXT-11 | PROP | P1 | — | fuzz parseConfig | never throws; output only booleans in flags/chains; urls https only | ext-fuzz |
| T-UX-022 | UX-01 | PROP | P1 | — | random uint256 | isUnlimited monotonic in value | ext-prop |
| T-UX-023 | UX-02 | PROP | P0 | — | random approve calldata + amounts | setApproveAmount keeps spender & selector; amount field equals new value; decode(result).amount == new | ext-prop |
| T-UX-024 | UX-08 | PROP | P1 | — | random unicode strings | output has no bidi/control chars and ≤ max length | ext-prop |
| T-UX-025 | UX-10 | PROP | P1 | — | random baseFee/tip/gas | tiers monotonic; max cost ≥ fee×gas for each tier | ext-prop |
| T-UX-026 | UX-01/UX-02/UX-03/DAPP-18 | SEC | P0 | approval view model | unlimited approve, permit, Permit2, setApprovalForAll(true), undecodable call, simulation failure | each produces a blocking/explicit warning flag requiring confirmation | ext-int |
| T-UX-027 | UX-06 | SEC | P0 | — | display rounding of amounts to send / receive / fees | never displays a smaller outgoing amount or fee than the signed value (rounding up for debits) | ext-unit |
| T-UX-028 | UX-10 | SEC | P1 | — | fee shown vs signed tx max fee | shown max ≥ signed maxFeePerGas×gas | ext-int |
| T-UX-029 | UX-11 | SEC | P1 | — | backend & extension error mapping with raw node messages containing URLs, keys, stack traces | output never contains them | ext-unit, be-unit |
| T-SA-018 | SA-05 | KAT | P0 | — | EIP-7702 authorization digest keccak256(0x05‖rlp([chainId, delegate, nonce])) vs viem `hashAuthorization` | identical; signature recovers our address | ext-unit |
| T-SA-019 | SA-06 | KAT | P0 | — | ERC-4337 v0.7 userOpHash vs viem `getUserOperationHash` for fixtures | identical | ext-unit |
| T-SA-020 | SA-05/SA-06/SA-07/SA-09 | RES | P1 | mock bundler: timeout, 500, malformed, receipt never arrives | operations | GuardError / timeout error; no second signature; status pending→failed handled | ext-int |
| T-SA-021 | SA-02 | PROP | P0 | — | fuzz checkIntent | accepted ⇒ chain pinned, 1..16 calls, no protected target | ext-fuzz |
| T-SA-022 | SA-03 | PROP | P1 | — | random code strings | delegationState total function; 'pinned' only for exact 0xef0100‖pinned | ext-prop |
| T-SA-023 | SA-07 | CON | P1 | — | EIP-5792 getCapabilities/sendCalls/getCallsStatus responses | conform to EIP-5792 v2 JSON shapes (status codes 100/200/400/500/600) | ext-unit |
| T-SA-024 | SA-08 | CON | P1 | — | ERC-7715 request/grant response | conform to ERC-7715 draft shape used by MetaMask kit | ext-unit |
| T-SA-025 | SA-01 | SEC | P0 | — | static analysis test: every address used in signing (delegate, EntryPoint, paymaster, DelegationManager, enforcers) originates from constants.ts | no import of addresses from replies (AST scan of core/smartAccount) | ext-unit |
| T-SA-026 | SA-02/SA-03/SA-04/SA-05/SA-06/SA-09 | SEC | P0 | hostile mock bundler/paymaster/RPC | return foreign paymaster, gas above limits, foreign delegate code, wrong chain id | nothing signed; GuardError reason logged | ext-int |
| T-CH-016 | CH-02/CH-03 | MIG | P1 | stored custom networks/tokens from older builds (missing addedAt, uppercase addresses) | load | normalized; ids stable | ext-unit |
| T-CH-017 | CH-02/CH-03/CH-04/CH-05 | RES | P1 | RPC/backend errors (timeout, 429, invalid JSON) | balance, probe, quote, submit | friendly errors; no partial vault writes; submit never double-broadcasts different txs | ext-int |
| T-CH-018 | CH-01 | SEC | P1 | — | registry: unique chain ids, unique ids, no EVM id collision between mainnet/testnet entries | invariants | ext-unit |
| T-CH-019 | CH-06 | SEC | P0 | served chain | any RPC from SW | always signed to backend; broadcast never sent to public RPC for served chains; unserved fallback only after 404 unknown_chain | ext-int |
| T-CH-020 | CH-07 | SEC | P1 | — | failover with non-pool URL; failure logs | non-pool URLs untouched; logs contain host only | ext-unit |
| T-DEFI-017 | DEFI-02/DEFI-03/DEFI-04/DEFI-05/DEFI-06/DEFI-07/DEFI-08 | RES | P1 | third-party API failure modes per feature (timeout, 429, 500, malformed) | each handler | friendly error; no signing with partial data | ext-int |
| T-DATA-013 | DATA-02/DATA-03/DATA-04/DATA-06 | RES | P1 | backend 503/timeout/invalid JSON | history, address sync, realtime, data fetch | retry later (queue/alarm); UI shows friendly state; no loop storms (backoff) | ext-int |
| T-DATA-014 | DATA-05 | PROP | P1 | — | random challenge/pub, difficulty 0..12 | solvePow result passes JS check and Go CheckPow fixture | ext-prop |
| T-DATA-015 | DATA-06 | PROP | P1 | — | fuzz schema checkers | never throw; accepted ⇒ fields well-typed | ext-fuzz |
| T-DATA-016 | DATA-05/DATA-06/CH-06 | CON | P0 | — | shared golden JSON fixtures for every backend endpoint used by client.ts | client parses backend golden responses; backend tests produce the same golden (two-sided contract) | ext-unit, be-unit |
| T-DATA-017 | DATA-03 | SEC | P1 | — | address sync payload | only {chain,address} for EVM addresses; no wallet names/ids/grouping hints; order randomized or sorted (no wallet grouping leak) | ext-int |
| T-BE-091 | BE-06 | CONC | P0 | — | same signed request (same nonce) sent 20× in parallel | exactly one 200 | be-int |
| T-BE-092 | BE-07 | CONC | P1 | RPM=10 | 50 parallel requests | exactly 10 succeed | be-int |
| T-BE-093 | BE-22 | CONC | P1 | — | same raw tx broadcast 5× in parallel with different Idempotency-Keys | all 200 with same hash; single pending row | be-int |
| T-BE-094 | BE-01..28 | RES | P0 | Redis down / Postgres down / gateway down injected per route | every signed route | JSON 5xx retryable, no panic, idempotency key not pinned, no partial DB writes | be-int |
| T-BE-095 | BE-28 | PROP | P1 | — | fuzz realIP with random XFF and peers | never panics; untrusted peer never rewritten | be-fuzz |
| T-BE-096 | BE-29 | PROP | P2 | — | fuzz config YAML loader | no panic; invalid → error | be-fuzz |
| T-BE-097 | BE-15/BE-18/BE-19/BE-23/BE-24/BE-26 | INT | P1 | real Postgres/Redis seeded | each read route via signed HTTP | expected data & status | be-int |
| T-BE-098 | BE-31 | SEC | P1 | log capture | migrate with app/service users | passwords never logged | be-int |
| T-GW-027 | GW-01..19 | INT | P1 | full API stack, httptest upstreams | each gateway route through signed request + quotas | forwarded/rejected per route table; cache behaviour | be-int |
| T-IDX-052 | IDX-30 | KAT | P1 | — | HMAC-SHA256 RFC 4231 case 2 and AES-256-GCM NIST vector via the same primitives LinkCrypto composes | match | be-unit |
| T-IDX-053 | IDX-12 | CONC | P0 | — | two ingest workers ingest overlapping batches concurrently | event_keys dedupe holds; balances/activity not double counted | be-int |
| T-IDX-054 | IDX-18 | CONC | P1 | — | Repair concurrently with live ingest for same chain | WithLock serialises; final state consistent | be-int |
| T-IDX-055 | IDX-21 | CONC | P1 | two tracker instances | RunOnce concurrently | each pending row processed once per due time; no conflicting state | be-int |
| T-IDX-056 | IDX-11..25 | RES | P0 | inject Postgres/NATS/RPC/provider failures into each worker loop | run | errors logged, backoff, no crash/exit, progress resumes | be-int |
| T-IDX-057 | IDX-02 | PROP | P1 | — | random pools | pick never returns excluded/open member or member below minBlock | be-prop |
| T-IDX-058 | IDX-04 | PROP | P1 | — | random outcome sequences | breaker state machine invariants (open → no traffic until cooldown; one half-open probe) | be-prop |
| T-IDX-059 | IDX-29 | PROP | P1 | — | random challenge/pubkey | CheckPow(SolvePow(d)) true; LeadingZeroBits ≤ 256 | be-prop |
| T-IDX-060 | IDX-25/IDX-24/IDX-16/IDX-21/IDX-23 | CON | P1 | — | NATS payloads AddressAddedEvent, TxStatusEvent, RawDelivery, TickMessage, gap-fill; Centrifugo channel names | golden JSON; producers & consumers agree | be-unit |
| T-IDX-061 | IDX-01..10 | INT | P1 | — | rpc-gateway HTTP server with httptest upstreams (pool+hedge+cache+breaker+splitting+broadcast) | end-to-end behaviour through HTTP | be-int |
| T-IDX-062 | IDX-02..27 | NEG | P1 | — | malformed provider payloads/RPC responses for every adapter & worker (null results, wrong types, huge numbers, negative values) | rejected/logged; no DB corruption | be-int |
| T-DBO-003 | DB-01..23 | NEG | P1 | — | NULL into NOT NULL, wrong types, out-of-range values for every table (generated) | rejected | be-int |
| T-MSG-008 | all MSG | NEG | P1 | — | each message with semantically invalid values (unknown walletId/chainId/asset, negative amounts, out-of-range indices) | specific error code/sentence; no generic crash text | ext-int |
| T-PM-007 | all PM | CON | P1 | — | EIP-1193 / EIP-1474 error codes and result shapes; EIP-6963 announce detail | conform | ext-unit |
| T-X-012 | BE-03/BE-04/BE-06/BE-07/BE-08/BE-10/BE-12/BE-13/BE-14/BE-16/BE-20/BE-21/BE-22/BE-23/IDX-01/IDX-02/IDX-03/IDX-05/IDX-07/IDX-09/IDX-10/DB-21/DATA-03/DATA-05/CH-06 | E2E | P0 | Docker Compose backend + mock JSON-RPC chain (deterministic, local) + Playwright extension built against it | register device, add wallet (address sync), view portfolio/history, estimate, simulate, send (broadcast), realtime status | full stack works; no real network | ext-e2e |
| T-X-013 | X-02 | PROP | P2 | — | random instants around UTC day/month boundaries | day/month keys computed in UTC consistently in Go and JS | be-prop, ext-prop |
| T-KEY-147 | KEY-20 | CONC | P0 | one reveal grant | two concurrent consumeReauth('reveal') (two reveal requests) | at most one returns true (get+remove is not atomic → expected-fail if both pass) | ext-int |
| T-SA-027 | SA-07 | CONC | P2 | — | concurrent wallet_sendCalls from two origins | both bundles retrievable (session map read-modify-write) | ext-int |
| T-CH-021 | CH-05/DEFI-01/DEFI-02/DEFI-03/DEFI-04/DEFI-05 | CONC | P0 | — | submit handler invoked twice quickly with the same prepared quote (double click / two windows) | exactly one signature and one broadcast | ext-int |
| T-DATA-018 | DATA-03 | CONC | P1 | — | 10 rapid wallet changes | one debounced PUT whose add/remove diff equals final state | ext-int |
| T-DAPP-061 | DAPP-12 | INT | P1 | connected | wallet_watchAsset ERC-20 → approve | token appears in vault customTokens of the connected wallet; duplicate request is idempotent | ext-int |
| T-DAPP-062 | DAPP-02 | CON | P1 | jsdom | Solana provider (publicKey, connect, disconnect, signMessage, signTransaction, signAllTransactions, signAndSendTransaction, events) and multi provider surfaces | match committed golden API surface (names, arities, event names) | ext-unit |
| T-EXT-046 | EXT-10 | INT | P1 | — | setSettings lockTimeInMinutes / preferSidePanel / currency through the router | alarm re-armed with new delay; side panel behaviour applied; rate fetched and stored; store slices updated | ext-int |
| T-EXT-047 | EXT-11 | CON | P1 | — | backend `/v1/gw/v1/config` response fixture (Go handler) consumed by kit/remoteConfig.refreshConfig | shapes agree ({config: string, signature: base64}); signature verified over exact text | ext-unit, be-unit |
| T-SA-028 | SA-08 | INT | P1 | flag on, smart account enabled (mock chain) | wallet_requestExecutionPermissions → approve → wallet_getGrantedExecutionPermissions | grant stored per origin; delegation signed with pinned DelegationManager & enforcers; response context usable by the kit | ext-int |
| T-SA-029 | SA-05 | PROP | P1 | — | random chain ids (pinned set) and nonces | authorization digest equals viem hashAuthorization; signature recovers our address | ext-prop |
| T-UX-030 | UX-08 | SEC | P0 | Playwright approval window | site title / token symbol containing U+202E, zero-width joiners, lookalike 'USDC' | rendered text neutralised (no reordering), lookalikes flagged where token unverified | ext-e2e |
| T-IDX-063 | IDX-13 | INT | P1 | Postgres + fake source | RefreshBalances for tracked id with extra refs; sweep due addresses | balances upserted with as_of_block; refreshed_at updated; stale reads re-requested | be-int |
| T-IDX-064 | IDX-14 | INT | P1 | Postgres + fake source | SyncNFTs / NFTsSynced / MarkNFTsMoved | holdings replaced atomically; media keys set; dirty flag cleared | be-int |
| T-IDX-065 | IDX-22 | INT | P1 | Postgres + embedded NATS + fake push service | activity event for address with route tag | push delivered only to subscribers of that route; tx status push to sending device only | be-int |
| T-IDX-066 | IDX-10 | PROP | P1 | — | fuzz ParseQuantity / parseBlockNumber | never panics; valid hex ≤ 64-bit parsed exactly | be-fuzz |

## 17. Traceability matrix (generated by `qa/tools/gen-matrix.mjs`)

Each cell lists the Test IDs for that Feature ID and category, or the explicit reason it does not apply (rule ids in `qa/tools/na-rules.json`). Parameterised suites (T-MSG/T-PM/T-RT/T-DBO/T-GOF/T-EXP) count for every feature their generated table maps to. **Gaps: see bottom line (must be 0).**

| Feature | UNIT | INT | E2E | NEG | SEC | PROP | KAT | CONC | RES | MIG | CON | PERF | UI | REG |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| KEY-01 | T-KEY-001 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | T-KEY-002 | N/A(PTR-KEY-SEC) | T-KEY-003 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-02 | +1 suite | T-KEY-017 | N/A(NOE2E-LIB) | T-KEY-018 | T-KEY-120 | N/A(PTR-KEY-PROP) | N/A(NOKAT) | T-KEY-019 | T-KEY-136 | N/A(PTR-VAULT-MIG) | T-KEY-143 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-03 | T-KEY-005 T-KEY-007 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | T-KEY-006 | T-KEY-008 | N/A(PTR-KEY-PROP) | T-KEY-004 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | T-KEY-009 | N/A(NOUI) | N/A(NOREG) |
| KEY-04 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-KEY-NEG) | T-KEY-123 | N/A(PTR-KEY-PROP) | T-KEY-010 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-05 | T-KEY-011 +1 suite | N/A(PTR-VAULT-INT) | N/A(NOE2E-LIB) | T-KEY-013 T-KEY-016 | T-KEY-014 | T-KEY-012 | T-KEY-125 | N/A(NOCONC) | N/A(NORES) | T-KEY-015 | T-KEY-143 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-06 | +1 suite | T-KEY-020 | T-KEY-115 | T-KEY-021 T-KEY-024 +1 suite | T-KEY-022 +5 suite | +1 suite | N/A(NOKAT) | T-KEY-023 | T-KEY-025 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | T-EXT-041 | T-REG-019 |
| KEY-07 | T-KEY-029 +1 suite | N/A(PTR-VAULT-INT) | N/A(NOE2E-LIB) | T-KEY-028 T-KEY-030 | T-KEY-124 | T-KEY-140 | N/A(NOKAT) | N/A(NOCONC) | T-KEY-027 | T-KEY-026 | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-08 | +1 suite | T-KEY-031 | N/A(NOE2E-LIB) | T-KEY-032 | N/A(PTR-KEY-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | T-KEY-033 | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-09 | +1 suite | T-KEY-034 | N/A(NOE2E-LIB) | N/A(PTR-KEY-NEG) | N/A(PTR-KEY-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-10 | T-KEY-036 +1 suite | T-KEY-035 | N/A(NOE2E-LIB) | T-KEY-037 | N/A(PTR-KEY-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-036 |
| KEY-11 | T-KEY-038 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | T-KEY-039 | N/A(PTR-KEY-SEC) | N/A(NOPROP) | T-KEY-126 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-12 | T-KEY-042 T-KEY-044 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | T-KEY-139 | N/A(PTR-KEY-SEC) | T-KEY-043 | T-KEY-040 T-KEY-041 T-KEY-045 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-027 |
| KEY-13 | +1 suite | T-KEY-046 | N/A(NOE2E-LIB) | T-KEY-139 | T-KEY-121 | T-KEY-141 | T-KEY-127 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-14 | +1 suite | T-KEY-048 | T-KEY-047 | T-KEY-049 +1 suite | T-KEY-050 T-KEY-054 +5 suite | +1 suite | N/A(NOKAT) | T-KEY-052 | T-KEY-051 T-KEY-053 | T-KEY-129 | +1 suite | N/A(NOPERF) | T-KEY-118 T-EXT-041 | T-REG-019 |
| KEY-15 | +1 suite | T-KEY-055 T-KEY-060 | N/A(NOE2E-LIB) | T-KEY-058 T-KEY-059 +1 suite | T-KEY-056 T-KEY-057 +5 suite | +1 suite | N/A(NOKAT) | T-KEY-131 | T-KEY-137 | T-KEY-129 | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-019 |
| KEY-16 | T-KEY-061 +1 suite | T-KEY-064 | N/A(NOE2E-LIB) | T-KEY-063 +1 suite | +5 suite | T-KEY-065 +1 suite | T-KEY-062 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-17 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | +1 suite | T-KEY-066 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-18 | +1 suite | T-KEY-067 | T-KEY-116 | T-KEY-069 T-KEY-070 +1 suite | T-KEY-068 +5 suite | T-KEY-071 +1 suite | N/A(NOKAT) | N/A(NOCONC-UI) | N/A(NORES) | N/A(NOMIG-SESSION) | +1 suite | N/A(NOPERF) | T-EXT-041 | N/A(NOREG) |
| KEY-19 | +1 suite | T-KEY-072 | N/A(NOE2E-LIB) | T-KEY-073 +1 suite | T-KEY-074 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG-SESSION) | +1 suite | N/A(NOPERF) | T-KEY-117 T-EXT-041 | N/A(NOREG) |
| KEY-20 | T-KEY-075 +1 suite | T-KEY-077 | N/A(NOE2E-LIB) | T-KEY-078 +1 suite | T-KEY-076 +5 suite | +1 suite | N/A(NOKAT) | T-KEY-147 | N/A(NORES) | N/A(NOMIG-SESSION) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-21 | +1 suite | T-KEY-079 | T-KEY-083 | T-KEY-081 T-KEY-082 +1 suite | T-KEY-080 +5 suite | +1 suite | N/A(PTR-KEY05-KAT) | N/A(NOCONC-UI) | T-KEY-130 | N/A(PTR-SEAL-MIG) | +1 suite | N/A(NOPERF) | T-EXT-041 | T-REG-019 T-REG-030 |
| KEY-22 | T-KEY-086 +1 suite | N/A(PTR-VAULT-INT) | N/A(NOE2E-LIB) | T-KEY-088 | T-KEY-087 | T-KEY-142 | N/A(NOKAT) | T-KEY-132 | T-KEY-085 | T-KEY-084 | T-KEY-144 | T-KEY-119 | N/A(NOUI) | T-REG-019 |
| KEY-23 | +1 suite | T-KEY-089 | N/A(NOE2E-LIB) | T-KEY-090 T-KEY-091 | T-KEY-122 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-033 |
| KEY-24 | T-KEY-092 +1 suite | T-KEY-094 | N/A(NOE2E-LIB) | T-KEY-096 +1 suite | T-KEY-093 T-KEY-095 +5 suite | T-KEY-097 +1 suite | T-KEY-128 | T-KEY-133 | N/A(NORES) | N/A(NOMIG-SESSION) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-014 |
| KEY-25 | +1 suite | T-KEY-098 | N/A(NOE2E-LIB) | T-KEY-099 +1 suite | +5 suite | +1 suite | N/A(NOKAT) | T-KEY-134 | T-KEY-138 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-26 | +1 suite | T-KEY-100 | N/A(NOE2E-LIB) | T-KEY-101 +1 suite | +5 suite | +1 suite | N/A(NOKAT) | T-KEY-134 T-KEY-135 | N/A(NORES) | T-KEY-129 | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-27 | +1 suite | T-KEY-102 | N/A(NOE2E-LIB) | +1 suite | T-KEY-103 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-28 | +1 suite | T-KEY-104 | N/A(NOE2E-LIB) | +1 suite | T-KEY-105 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | T-KEY-129 | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-29 | +1 suite | T-KEY-106 | N/A(NOE2E-LIB) | T-KEY-145 | T-KEY-146 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(PTR-SEAL-MIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-30 | T-KEY-107 T-KEY-110 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-KEY-NEG) | T-KEY-108 T-KEY-109 | T-KEY-111 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| KEY-31 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-KEY-NEG) | T-KEY-112 T-KEY-114 | T-KEY-113 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-01 | T-SIG-001 T-SIG-003 +2 suite | N/A(NOINT-PURE) | +1 suite | T-SIG-002 +1 suite | +2 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-02 | T-SIG-006 +2 suite | N/A(NOINT-PURE) | +1 suite | +1 suite | T-SIG-005 +2 suite | +1 suite | T-SIG-007 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-03 | T-SIG-009 T-SIG-013 +2 suite | N/A(NOINT-PURE) | +1 suite | T-SIG-010 +1 suite | T-SIG-011 T-SIG-012 +2 suite | T-SIG-014 T-SIG-015 +1 suite | T-SIG-008 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-014 |
| SIG-04 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | T-SIG-048 | N/A(PTR-SIG-SEC) | T-SIG-047 | T-SIG-004 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-05 | +2 suite | T-SIG-016 | T-SIG-022 +1 suite | T-SIG-019 +1 suite | T-SIG-017 T-SIG-018 T-SIG-020 +2 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | T-SIG-021 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | T-SIG-044 T-EXT-041 | N/A(NOREG) |
| SIG-06 | T-SIG-023 T-SIG-025 +1 suite | N/A(PTR-SEND-INT) | N/A(NOE2E-LIB) | T-SIG-049 | T-SIG-050 | T-SIG-046 | T-SIG-024 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-07 | +1 suite | N/A(PTR-SEND-INT) | N/A(NOE2E-LIB) | T-SIG-027 T-SIG-049 | T-SIG-050 | T-SIG-028 | T-SIG-026 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-08 | +2 suite | T-SIG-029 | +1 suite | +1 suite | T-SIG-030 +2 suite | T-SIG-031 +1 suite | T-SIG-045 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-09 | +2 suite | T-SIG-032 | +1 suite | +1 suite | +2 suite | T-SIG-034 +1 suite | T-SIG-033 | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-10 | T-SIG-035 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-SIG-NEG) | T-SIG-036 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-11 | +1 suite | T-SIG-037 | N/A(NOE2E-LIB) | N/A(PTR-SIG-NEG) | N/A(PTR-SIG-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-12 | T-SIG-038 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-SIG-NEG) | N/A(PTR-SIG-SEC) | T-SIG-039 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SIG-13 | +1 suite | T-SIG-040 | T-SIG-043 | +1 suite | T-SIG-041 T-SIG-042 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | T-EXT-041 | T-REG-027 |
| DAPP-01 | T-DAPP-048 +2 suite | N/A(NOINT-FLOW) | T-DAPP-051 +1 suite | +1 suite | T-DAPP-049 +2 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-035 |
| DAPP-02 | T-DAPP-050 +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 | N/A(PTR-DAPP02-NEG) | T-DAPP-049 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | T-DAPP-062 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-03 | +1 suite | T-DAPP-008 | T-DAPP-051 | N/A(PTR-DAPP-NEG) | T-DAPP-007 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | T-DAPP-060 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-04 | T-DAPP-001 +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 | T-DAPP-002 | T-DAPP-003 | T-DAPP-004 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | T-DAPP-060 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-05 | T-DAPP-005 +2 suite | N/A(NOINT-FLOW) | T-DAPP-051 +1 suite | T-DAPP-006 +1 suite | +2 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-06 | +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 | T-DAPP-009 | N/A(PTR-DAPP-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-DAPP-010 T-DAPP-011 | N/A(NOMIG) | T-DAPP-060 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-07 | T-DAPP-014 +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 T-DAPP-052 | N/A(PTR-DAPP-NEG) | T-DAPP-012 T-DAPP-013 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-08 | T-DAPP-019 +2 suite | T-DAPP-015 | T-DAPP-051 +1 suite | T-DAPP-018 +2 suite | T-DAPP-016 T-DAPP-017 +7 suite | +2 suite | N/A(NOKAT) | T-DAPP-054 | T-DAPP-055 | N/A(PTR-PERM-MIG) | +2 suite | N/A(NOPERF) | T-EXT-041 | T-REG-020 |
| DAPP-09 | T-DAPP-020 +1 suite | N/A(PTR-PEND-INT) | T-DAPP-051 | N/A(PTR-DAPP-NEG) | T-DAPP-022 | T-DAPP-058 | N/A(NOKAT) | T-DAPP-021 | T-DAPP-055 | N/A(NOMIG-SESSION) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-10 | T-DAPP-023 +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 | T-DAPP-024 | N/A(PTR-DAPP-SEC) | T-DAPP-059 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | T-DAPP-053 | N/A(NOUI) | N/A(NOREG) |
| DAPP-11 | T-DAPP-030 +2 suite | T-DAPP-025 | T-DAPP-051 +1 suite | T-DAPP-028 +1 suite | T-DAPP-026 T-DAPP-027 +2 suite | +1 suite | N/A(NOKAT) | T-DAPP-029 | T-DAPP-056 | N/A(PTR-PERM-MIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-12 | T-DAPP-031 +2 suite | T-DAPP-061 | T-DAPP-051 +1 suite | +1 suite | +2 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(PTR-PERM-MIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-13 | +2 suite | T-DAPP-032 | T-DAPP-051 +1 suite | +1 suite | T-DAPP-033 +2 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-14 | +1 suite | T-DAPP-034 | T-DAPP-051 | N/A(PTR-DAPP-NEG) | T-DAPP-035 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | T-DAPP-060 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-15 | T-DAPP-036 +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 | N/A(PTR-DAPP-NEG) | T-DAPP-038 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-DAPP-037 | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-037 |
| DAPP-16 | T-DAPP-039 +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 | N/A(PTR-DAPP-NEG) | N/A(PTR-DAPP-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-17 | +1 suite | T-DAPP-040 | T-DAPP-051 | T-DAPP-042 +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-SER) | T-DAPP-057 | T-DAPP-041 | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-002 |
| DAPP-18 | T-DAPP-043 T-DAPP-045 +1 suite | N/A(NOINT-FLOW) | T-DAPP-051 | N/A(PTR-DAPP-NEG) | T-UX-026 | T-DAPP-044 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-016 |
| DAPP-19 | +1 suite | T-DAPP-046 | T-DAPP-051 | N/A(PTR-DAPP-NEG) | N/A(PTR-DAPP-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DAPP-20 | +1 suite | T-DAPP-047 | T-DAPP-051 | N/A(PTR-DAPP-NEG) | N/A(PTR-DAPP-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-01 | +1 suite | N/A(NOINT-PURE) | T-EXT-038 | N/A(PTR-MSG-NEG) | T-EXT-001 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | T-EXT-002 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-02 | +1 suite | N/A(NOINT-PURE) | T-EXT-038 | N/A(PTR-MSG-NEG) | T-EXT-003 T-EXT-004 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-03 | T-EXT-005 +1 suite | N/A(NOINT-PURE) | T-EXT-038 | N/A(PTR-MSG-NEG) | T-EXT-006 T-EXT-007 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-04 | +1 suite | T-EXT-008 | T-EXT-038 | N/A(PTR-MSG-NEG) | N/A(PTR-EXT-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-015 |
| EXT-05 | T-EXT-009 +1 suite | N/A(NOINT-PURE) | T-EXT-038 | T-EXT-011 | T-EXT-010 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-06 | +1 suite | T-EXT-012 | T-EXT-038 | N/A(PTR-MSG-NEG) | N/A(PTR-EXT-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | T-EXT-039 | N/A(NOUI) | N/A(NOREG) |
| EXT-07 | T-EXT-013 T-EXT-015 +1 suite | N/A(NOINT-FLOW) | T-EXT-038 | N/A(PTR-MSG-NEG) | N/A(PTR-EXT-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-BOOT) | T-EXT-014 | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-08 | T-EXT-017 +1 suite | N/A(NOINT-FLOW) | T-EXT-038 | N/A(PTR-MSG-NEG) | T-EXT-018 | T-EXT-044 | N/A(NOKAT) | T-EXT-043 | N/A(NORES) | T-EXT-016 | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-09 | +1 suite | N/A(NOINT-FLOW) | T-EXT-020 T-EXT-038 | N/A(PTR-MSG-NEG) | N/A(PTR-EXT-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-EXT-019 | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-10 | T-EXT-021 T-EXT-023 +1 suite | T-EXT-046 | T-EXT-038 | +1 suite | T-EXT-022 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-UI) | N/A(NORES) | T-EXT-042 | +1 suite | N/A(NOPERF) | T-EXT-041 | N/A(NOREG) |
| EXT-11 | +1 suite | N/A(NOINT-PURE) | T-EXT-038 | N/A(PTR-MSG-NEG) | T-EXT-025 T-EXT-026 | T-EXT-045 | T-EXT-024 | N/A(NOCONC) | T-EXT-027 | N/A(PTR-CFG-MIG) | T-EXT-047 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-12 | T-EXT-028 T-EXT-029 +1 suite | N/A(NOINT-PURE) | T-EXT-038 | N/A(PTR-MSG-NEG) | N/A(PTR-EXT-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-13 | +1 suite | T-EXT-030 | T-EXT-038 | N/A(PTR-MSG-NEG) | T-KEY-074 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| EXT-14 | +1 suite | N/A(NOINT-PURE) | T-EXT-038 | N/A(PTR-MSG-NEG) | T-EXT-031 T-EXT-032 T-EXT-033 T-EXT-034 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-010 T-REG-026 T-REG-028 T-REG-029 |
| EXT-15 | +1 suite | N/A(NOINT-FLOW) | T-EXT-038 | N/A(PTR-MSG-NEG) | T-EXT-035 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | T-EXT-036 T-EXT-040 | T-REG-021 T-REG-034 |
| EXT-16 | +1 suite | T-EXT-037 | T-EXT-038 | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| UX-01 | T-UX-001 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-UX-026 | T-UX-022 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| UX-02 | T-UX-002 +1 suite | N/A(NOINT-PURE) | T-UX-003 | N/A(PTR-MSG-NEG) | T-UX-026 | T-UX-023 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | T-EXT-041 | N/A(NOREG) |
| UX-03 | +1 suite | T-UX-004 | N/A(NOE2E-LIB) | +1 suite | T-UX-026 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| UX-04 | +1 suite | T-UX-005 | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | T-UX-006 | T-EXT-041 | T-REG-031 |
| UX-05 | T-UX-007 T-UX-009 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | +1 suite | T-UX-008 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | T-EXT-041 | N/A(NOREG) |
| UX-06 | T-UX-011 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | T-UX-012 | T-UX-027 | T-UX-010 T-UX-013 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | T-EXT-041 | N/A(NOREG) |
| UX-07 | T-UX-014 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| UX-08 | T-UX-015 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-UX-030 | T-UX-024 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| UX-09 | T-UX-016 T-UX-017 T-UX-018 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-DEFI-002 | T-UX-019 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| UX-10 | T-UX-020 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-UX-028 | T-UX-025 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| UX-11 | T-UX-021 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-UX-029 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-01 | T-SA-001 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-SA-025 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-02 | T-SA-002 +1 suite | N/A(NOINT-PURE) | T-SA-017 | N/A(PTR-MSG-NEG) | T-SA-026 | T-SA-021 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-03 | T-SA-003 +1 suite | N/A(NOINT-PURE) | T-SA-017 | N/A(PTR-MSG-NEG) | T-SA-026 | T-SA-022 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-04 | T-SA-004 +1 suite | N/A(NOINT-PURE) | T-SA-017 | N/A(PTR-MSG-NEG) | T-SA-026 | T-SA-005 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-05 | +1 suite | T-SA-006 | T-SA-017 | N/A(PTR-MSG-NEG) | T-SA-007 T-SA-026 | T-SA-029 | T-SA-018 | N/A(PTR-SA-ONESHOT) | T-SA-020 | N/A(NOMIG-NEW) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-06 | T-SA-009 +1 suite | T-SA-008 | T-SA-017 | N/A(PTR-MSG-NEG) | T-SA-026 | N/A(NOPROP) | T-SA-019 | N/A(PTR-SA-ONESHOT) | T-SA-020 | N/A(NOMIG-NEW) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-07 | T-SA-010 +2 suite | T-SA-011 | T-SA-017 +1 suite | +1 suite | T-SA-012 +2 suite | +1 suite | N/A(NOKAT) | T-SA-027 | T-SA-020 | N/A(NOMIG-NEW) | T-SA-023 +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-004 |
| SA-08 | T-SA-013 +2 suite | T-SA-028 | T-SA-017 +1 suite | +1 suite | T-SA-014 +2 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG-NEW) | T-SA-024 +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-09 | +1 suite | T-SA-015 | T-SA-017 | N/A(PTR-MSG-NEG) | T-SA-026 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-SA-020 | N/A(NOMIG-NEW) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| SA-10 | T-SA-016 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | N/A(PTR-SA-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| CH-01 | T-CH-002 +1 suite | N/A(NOINT-FLOW) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-CH-018 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | T-CH-001 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| CH-02 | T-CH-003 +1 suite | T-CH-004 | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(PTR-CH-CONC) | T-CH-017 | T-CH-016 | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| CH-03 | T-CH-005 +1 suite | T-CH-006 | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(PTR-CH-CONC) | T-CH-017 | T-CH-016 | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| CH-04 | +1 suite | T-CH-007 | N/A(NOE2E-LIB) | +1 suite | T-CH-008 +5 suite | +1 suite | N/A(NOKAT) | N/A(PTR-CH04) | T-CH-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-003 T-REG-032 |
| CH-05 | +1 suite | T-CH-009 | T-CH-011 | T-CH-010 +1 suite | +5 suite | +1 suite | N/A(NOKAT) | T-CH-021 | T-CH-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | T-EXT-041 | N/A(NOREG) |
| CH-06 | +1 suite | T-CH-012 | T-X-012 | N/A(PTR-MSG-NEG) | T-CH-019 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | T-CH-013 T-DATA-016 | N/A(NOPERF) | N/A(NOUI) | T-REG-007 |
| CH-07 | T-CH-015 +1 suite | N/A(NOINT-FLOW) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-CH-020 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-CH-014 | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-005 |
| DEFI-01 | T-DEFI-003 T-DEFI-004 +1 suite | T-DEFI-001 | N/A(NOE2E-LIB) | +1 suite | T-DEFI-002 +5 suite | +1 suite | N/A(NOKAT) | T-CH-021 | T-DEFI-005 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | T-EXT-041 | T-REG-008 |
| DEFI-02 | +1 suite | T-DEFI-006 | N/A(NOE2E-LIB) | T-DEFI-007 +1 suite | +5 suite | +1 suite | N/A(NOKAT) | T-CH-021 | T-DEFI-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-005 |
| DEFI-03 | +1 suite | T-DEFI-008 | N/A(NOE2E-LIB) | +1 suite | T-DEFI-009 +5 suite | +1 suite | N/A(NOKAT) | T-CH-021 | T-DEFI-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-008 T-REG-018 |
| DEFI-04 | +1 suite | N/A(NOINT-FLOW) | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | T-DEFI-010 | T-CH-021 | T-DEFI-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DEFI-05 | +1 suite | N/A(NOINT-FLOW) | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | T-DEFI-011 | T-CH-021 | T-DEFI-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DEFI-06 | T-DEFI-012 +1 suite | N/A(NOINT-FLOW) | N/A(NOE2E-LIB) | +1 suite | T-DEFI-013 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | T-DEFI-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DEFI-07 | T-DEFI-014 +1 suite | N/A(NOINT-FLOW) | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | T-DEFI-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DEFI-08 | +1 suite | T-DEFI-016 | N/A(NOE2E-LIB) | +1 suite | T-DEFI-015 +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | T-DEFI-017 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-011 |
| DATA-01 | T-DATA-001 +1 suite | N/A(NOINT-FLOW) | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-ALARM) | T-DATA-002 | N/A(NOMIG-NEW) | +1 suite | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DATA-02 | +1 suite | T-DATA-003 | N/A(NOE2E-LIB) | +1 suite | +5 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | T-DATA-013 | N/A(NOMIG) | +1 suite | N/A(NOPERF) | N/A(NOUI) | T-REG-006 |
| DATA-03 | +1 suite | T-DATA-004 | T-X-012 | N/A(PTR-MSG-NEG) | T-DATA-017 | N/A(NOPROP) | N/A(NOKAT) | T-DATA-018 | T-DATA-013 | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DATA-04 | +1 suite | T-DATA-005 | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | N/A(PTR-DATA-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-DATA-013 | N/A(NOMIG) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-001 |
| DATA-05 | +1 suite | T-DATA-006 | T-X-012 | N/A(PTR-MSG-NEG) | T-DATA-007 T-DATA-008 | T-DATA-014 | T-DATA-011 | T-DATA-009 | N/A(NORES) | T-DATA-010 | T-DATA-016 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DATA-06 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-LIB) | N/A(PTR-MSG-NEG) | T-DATA-012 | T-DATA-015 | N/A(NOKAT) | N/A(NOCONC) | T-DATA-013 | N/A(NOMIG) | T-DATA-016 | N/A(NOPERF) | N/A(NOUI) | T-REG-032 |
| BE-01 | +1 suite | N/A(PTR-BE-INT) | N/A(NOE2E-BE) | T-BE-002 | T-BE-001 T-BE-003 T-BE-004 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | N/A(NOREG) |
| BE-02 | +1 suite | N/A(PTR-BE-INT) | N/A(NOE2E-BE) | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-005 T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-03 | +1 suite | T-BE-006 | T-X-012 | T-BE-007 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-ATOMIC) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-04 | +1 suite | T-BE-008 | T-X-012 | T-BE-009 T-BE-010 +1 suite | T-BE-011 +1 suite | +1 suite | N/A(PTR-POW-KAT) | T-BE-012 | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 T-BE-089 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-05 | T-BE-013 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-BE-NEG) | N/A(PTR-BE-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | N/A(NOREG) |
| BE-06 | +1 suite | T-BE-014 | T-X-012 | T-BE-019 | T-BE-015 T-BE-016 T-BE-017 T-BE-018 T-BE-020 | T-BE-022 T-BE-023 | T-BE-021 | T-BE-091 | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | N/A(NOREG) |
| BE-07 | T-BE-025 +1 suite | T-BE-024 | T-X-012 | N/A(PTR-BE-NEG) | N/A(PTR-BE-SEC) | N/A(NOPROP) | N/A(NOKAT) | T-BE-092 | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | N/A(NOREG) |
| BE-08 | +1 suite | T-BE-026 | T-X-012 | T-BE-027 | T-BE-029 | N/A(PTR-BE-PROP) | N/A(NOKAT) | N/A(PTR-IDEM-CONC) | T-BE-028 T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | T-REG-023 |
| BE-09 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-BE-NEG) | T-BE-030 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | N/A(NOREG) |
| BE-10 | +1 suite | N/A(PTR-BE-INT) | T-X-012 | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-031 T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-11 | +1 suite | N/A(PTR-BE-INT) | N/A(NOE2E-BE) | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-031 T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-12 | +1 suite | T-BE-032 | T-X-012 | T-BE-033 T-BE-035 T-BE-037 +1 suite | T-BE-034 +1 suite | +1 suite | N/A(NOKAT) | T-BE-036 | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-13 | +1 suite | T-BE-038 | T-X-012 | T-BE-042 T-BE-044 +1 suite | T-BE-039 T-BE-040 T-BE-041 +1 suite | T-BE-045 +1 suite | N/A(NOKAT) | N/A(NOCONC) | T-BE-043 T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | T-REG-016 |
| BE-14 | +1 suite | T-BE-047 | T-X-012 | +1 suite | T-BE-046 T-BE-048 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-15 | +1 suite | T-BE-097 | N/A(NOE2E-BE) | +1 suite | T-BE-046 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-16 | +1 suite | T-BE-049 | T-X-012 | T-BE-050 +1 suite | T-BE-046 +1 suite | T-BE-051 +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-17 | +1 suite | T-BE-052 | N/A(NOE2E-BE) | +1 suite | T-BE-046 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-18 | +1 suite | T-BE-097 | N/A(NOE2E-BE) | T-BE-053 +1 suite | T-BE-046 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-19 | +1 suite | T-BE-097 | N/A(NOE2E-BE) | T-BE-056 +1 suite | T-BE-054 T-BE-055 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | T-REG-013 |
| BE-20 | +1 suite | T-BE-057 | T-X-012 | T-BE-058 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-059 T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-21 | +1 suite | T-BE-060 | T-X-012 | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-22 | +1 suite | T-BE-061 | T-X-012 | T-BE-066 +1 suite | T-BE-062 T-BE-064 +1 suite | +1 suite | N/A(NOKAT) | T-BE-093 | T-BE-063 T-BE-065 T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-23 | +1 suite | T-BE-097 | T-X-012 | +1 suite | T-BE-067 +1 suite | +1 suite | T-BE-068 | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | T-REG-001 T-REG-025 |
| BE-24 | +1 suite | T-BE-097 | N/A(NOE2E-BE) | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-25 | +1 suite | T-BE-070 | N/A(NOE2E-BE) | +1 suite | T-BE-069 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-ATOMIC) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-26 | T-BE-074 +1 suite | T-BE-097 | N/A(NOE2E-BE) | T-BE-075 +1 suite | T-BE-071 T-BE-072 T-BE-073 +1 suite | T-BE-078 +1 suite | N/A(NOKAT) | T-BE-076 | T-BE-077 T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 +1 suite | T-BE-088 +1 suite | N/A(NOUI) | N/A(NOREG) |
| BE-27 | T-BE-079 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-BE-NEG) | N/A(PTR-BE-SEC) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | N/A(NOREG) |
| BE-28 | T-BE-081 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-BE-NEG) | T-BE-080 | T-BE-095 | N/A(NOKAT) | N/A(NOCONC) | T-BE-094 | N/A(NOMIG-EPH) | T-BE-090 | T-BE-088 | N/A(NOUI) | N/A(NOREG) |
| BE-29 | T-BE-082 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-BE-NEG) | T-BE-083 | T-BE-096 | N/A(NOKAT) | N/A(NOCONC) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-024 |
| BE-30 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-BE-NEG) | T-BE-084 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-022 |
| BE-31 | +1 suite | T-BE-085 | N/A(NOE2E-BE) | T-BE-086 | T-BE-098 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | T-REG-025 |
| BE-32 | T-BE-087 +1 suite | N/A(PTR-BE-INT) | N/A(NOE2E-BE) | N/A(PTR-BE-NEG) | N/A(NOSEC-DEV) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| GW-01 | +1 suite | T-GW-001 T-GW-027 | N/A(NOE2E-BE) | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-02 | T-GW-002 +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-03 | T-GW-003 +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-04 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | T-GW-004 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-05 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | T-GW-005 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-06 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | T-GW-006 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-07 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | T-GW-007 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-08 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | T-GW-008 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-09 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | T-GW-009 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-10 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | T-GW-010 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-11 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | T-GW-011 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | T-REG-009 |
| GW-12 | +1 suite | T-GW-013 T-GW-027 | N/A(NOE2E-BE) | +1 suite | T-GW-012 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | T-REG-017 |
| GW-13 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | T-GW-014 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-14 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | T-GW-015 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-15 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | T-GW-016 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | T-REG-002 |
| GW-16 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | T-GW-019 +1 suite | T-GW-017 T-GW-018 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | T-REG-012 |
| GW-17 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | +1 suite | T-GW-020 +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-18 | +1 suite | T-GW-027 | N/A(NOE2E-BE) | +1 suite | +1 suite | T-GW-021 +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | N/A(PTR-BE-RES) | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| GW-19 | +1 suite | T-GW-025 T-GW-027 | N/A(NOE2E-BE) | +1 suite | T-GW-022 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RO) | T-GW-023 T-GW-024 | N/A(NOMIG-EPH) | T-GW-026 +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| IDX-01 | +1 suite | T-IDX-061 | T-X-012 | +1 suite | T-IDX-001 T-IDX-002 +1 suite | +1 suite | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | +1 suite | +1 suite | N/A(NOUI) | N/A(NOREG) |
| IDX-02 | T-IDX-003 +1 suite | T-IDX-061 | T-X-012 | T-IDX-062 | N/A(NOSEC-INTERNAL) | T-IDX-057 | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-03 | +1 suite | T-IDX-061 | T-X-012 | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-004 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-051 | N/A(NOUI) | N/A(NOREG) |
| IDX-04 | T-IDX-005 +1 suite | T-IDX-061 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | T-IDX-058 | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-05 | T-IDX-006 T-IDX-008 +1 suite | T-IDX-061 | T-X-012 | T-IDX-062 | N/A(NOSEC-INTERNAL) | T-IDX-007 | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-06 | +1 suite | T-IDX-061 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | T-IDX-009 | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-07 | +1 suite | T-IDX-061 | T-X-012 | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-010 | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-08 | T-IDX-011 +1 suite | T-IDX-061 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-09 | +1 suite | T-IDX-061 | T-X-012 | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-012 | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-10 | T-IDX-013 +1 suite | T-IDX-061 | T-X-012 | T-IDX-062 | N/A(NOSEC-INTERNAL) | T-IDX-066 | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-11 | +1 suite | T-IDX-014 | N/A(NOE2E-BE) | T-IDX-062 +1 suite | +1 suite | +1 suite | N/A(NOKAT) | T-IDX-015 | T-IDX-056 | N/A(NOMIG-DB) | +1 suite | T-IDX-050 +1 suite | N/A(NOUI) | N/A(NOREG) |
| IDX-12 | +1 suite | T-IDX-016 | N/A(NOE2E-BE) | T-IDX-017 T-IDX-062 | N/A(NOSEC-INTERNAL) | T-IDX-018 | N/A(NOKAT) | T-IDX-053 | T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-13 | T-IDX-019 +1 suite | T-IDX-063 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-14 | +1 suite | T-IDX-064 | N/A(NOE2E-BE) | T-IDX-062 | T-IDX-020 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-15 | +1 suite | T-IDX-021 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-16 | +1 suite | T-IDX-022 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | T-IDX-060 | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-17 | +1 suite | T-IDX-023 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-18 | +1 suite | T-IDX-024 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | T-IDX-054 | T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-19 | T-IDX-025 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-20 | +1 suite | N/A(PTR-INGEST-INT) | N/A(NOE2E-BE) | T-IDX-062 +1 suite | T-IDX-026 T-IDX-027 +1 suite | T-IDX-030 +1 suite | T-IDX-029 | N/A(NOCONC-RACE) | T-IDX-028 T-IDX-056 | N/A(NOMIG-DB) | +1 suite | T-IDX-050 +1 suite | N/A(NOUI) | N/A(NOREG) |
| IDX-21 | +1 suite | T-IDX-031 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | T-IDX-055 | T-IDX-056 | N/A(NOMIG-DB) | T-IDX-060 | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-22 | T-IDX-032 +1 suite | T-IDX-065 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-033 T-IDX-056 | N/A(NOMIG-DB) | N/A(NOCON) | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-23 | +1 suite | T-IDX-034 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | T-IDX-060 | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-24 | +1 suite | T-IDX-035 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | T-IDX-060 | T-IDX-050 | N/A(NOUI) | N/A(NOREG) |
| IDX-25 | +1 suite | T-IDX-036 | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | T-IDX-056 | N/A(NOMIG-DB) | T-IDX-060 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-26 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | T-IDX-037 | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-27 | T-IDX-038 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | T-IDX-062 | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-28 | T-IDX-042 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | T-IDX-040 | N/A(NOSEC-INTERNAL) | T-IDX-041 T-IDX-043 | T-IDX-039 | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-29 | T-IDX-045 +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-IDX-NEG) | N/A(NOSEC-INTERNAL) | T-IDX-059 | T-IDX-044 | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| IDX-30 | +1 suite | N/A(NOINT-PURE) | N/A(NOE2E-BE) | N/A(PTR-IDX-NEG) | T-IDX-046 T-IDX-047 T-IDX-049 | T-IDX-048 | T-IDX-052 | N/A(NOCONC-RACE) | N/A(NORES) | N/A(NOMIG-DB) | N/A(NOCON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DB-01 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-02 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-03 | +1 suite | T-DB-011 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-04 | +1 suite | T-DB-012 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-05 | +1 suite | T-DB-013 +1 suite | N/A(NOE2E-BE) | +1 suite | T-DB-023 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-06 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-07 | +1 suite | T-DB-014 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-08 | +1 suite | T-DB-014 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-09 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-10 | +1 suite | T-DB-020 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-11 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-12 | +1 suite | T-DB-020 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-13 | +1 suite | T-DB-020 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-14 | +1 suite | T-DB-024 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-15 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-16 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | T-DB-022 | N/A(NOUI) | N/A(NOREG) |
| DB-17 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | T-DB-015 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DB-18 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | T-DB-016 | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DB-19 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | T-DB-017 T-DB-018 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DB-20 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-005 T-DB-006 T-DB-007 T-DB-008 T-DB-009 T-DB-025 +1 suite | N/A(PTR-DB-CON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DB-21 | +1 suite | +1 suite | T-X-012 | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | T-DB-003 | T-DB-004 | T-DB-001 T-DB-002 T-DB-010 T-DB-025 +1 suite | N/A(PTR-DB-CON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DB-22 | +1 suite | +1 suite | N/A(NOE2E-BE) | +1 suite | T-DB-019 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| DB-23 | +1 suite | T-DB-021 +1 suite | N/A(NOE2E-BE) | +1 suite | N/A(NOSEC-INTERNAL) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC-DB) | N/A(PTR-DB-RES) | T-DB-025 +1 suite | N/A(PTR-DB-CON) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-01 | T-X-002 +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | N/A(NOSEC-X) | T-X-001 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-02 | T-X-003 +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | T-X-004 | N/A(NOSEC-X) | T-X-013 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-03 | T-X-005 +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | N/A(NOSEC-X) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-04 | +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | N/A(NOSEC-X) | T-X-006 | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-05 | +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | N/A(NOSEC-X) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | T-X-007 | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-06 | T-X-008 +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | N/A(NOSEC-X) | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-07 | +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | T-X-009 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |
| X-08 | +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | T-X-010 | N/A(NOPROP) | N/A(NOKAT) | N/A(NOCONC) | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | T-REG-029 |
| X-09 | +1 suite | N/A(NOINT-X) | N/A(NOE2E-LIB) | N/A(NONEG-X) | N/A(NOSEC-X) | N/A(NOPROP) | N/A(NOKAT) | T-X-011 | N/A(NORES) | N/A(NOMIG) | N/A(NOCON-X) | N/A(NOPERF) | N/A(NOUI) | N/A(NOREG) |

N/A reasons:

- **PTR-VAULT-INT**: Integrated with real IndexedDB/WebCrypto/wallet-core through the vault rows T-KEY-017/020/026/084/087 (categorised by their primary concern).
- **PTR-SEND-INT**: Integrated through T-CH-009 (send flow) and T-SIG-026 (ext-int signing per family).
- **PTR-PEND-INT**: Integrated through the provider service in T-DAPP-021/022 and T-EXT-019.
- **PTR-INGEST-INT**: Integration over real HTTP + Postgres + NATS is T-IDX-026..028 (categorised SEC/RES).
- **PTR-IDX-NEG**: Bad inputs enumerated in T-IDX-045 (nonces) and T-IDX-046 (tampered/short blobs, short secret).
- **PTR-DAPP02-NEG**: Invalid calls on the Solana/multi surfaces are asserted in T-DAPP-050 and the parameterised T-PM-001.
- **NOPROP**: No parser, codec, arithmetic or algebraic invariant with a generative input domain; behaviour is enumerated exactly by its UNIT/INT rows (and DB constraints by T-DBO-002/003).
- **NOCON**: Internal function, not a cross-component contract; component contracts are covered by T-MSG-006, T-PM-007, T-DAPP-060, T-DATA-016, T-RT-003, T-IDX-060.
- **PTR-KEY05-KAT**: The PRF output is produced by the authenticator; the seal is the KEY-05 envelope whose KAT is T-KEY-125.
- **PTR-POW-KAT**: The PoW and Ed25519 primitives used by registration have KATs in T-IDX-044 and T-BE-021.
- **NOKAT**: No cryptographic primitive or published test vector applies to this feature (it only calls primitives whose KATs live in KEY-/SIG-/IDX- crypto rows).
- **NOREG**: No bug-fix commit touching this feature exists in git history; §16 lists every fix commit and its regression test.
- **NOUI**: Feature has no screen of its own (backend, worker or library code); its visible output is checked through the owning screen's UI tests (T-EXT-041).
- **NOE2E-BE**: Server-side: exercised end-to-end by the full-stack flow T-X-012 where it is on the user path, and otherwise over real HTTP/Postgres/Redis in be-int; a browser E2E adds no extra observable.
- **NOE2E-LIB**: Library/worker logic with no independent user flow; it is reached by the flow-level E2E tests (T-KEY-047, T-DAPP-051, T-CH-011, T-SIG-022, T-X-012) and asserted precisely at unit/integration level.
- **NOPERF**: Not a hot path and its inputs are bounded by validation; smoke-level performance tests exist only for the hot paths (KDF, provider reads, UI port fan-out, API, DB queries, gateway, ingest).
- **PTR-VAULT-MIG**: Vault/KDF format migrations are asserted in T-KEY-015, T-KEY-026 and the format contract T-KEY-143.
- **PTR-SEAL-MIG**: Legacy seal and perps/prediction blob migrations are asserted in T-KEY-033, T-KEY-081 and T-KEY-026.
- **PTR-PERM-MIG**: Stored permission/network/token formats are migrated and asserted in T-DAPP-041 and T-CH-016.
- **PTR-CFG-MIG**: Stored config version monotonicity (the only persisted field) is asserted in T-EXT-025.
- **NOMIG-NEW**: Format introduced in the current release with no earlier stored version; future changes are guarded by contract tests T-SA-023/T-SA-024 and T-DATA-001.
- **NOMIG-SESSION**: State lives only in storage.session (cleared when the browser closes), so no cross-version stored data exists.
- **NOMIG-EPH**: Redis state is TTL-bounded (≤48 h) and Postgres schema migrations are owned by DB-* rows (T-DB-*, T-DBO-001).
- **NOMIG-DB**: Persists only through DB tables whose migrations are covered by T-DB-001..010 and T-DBO-001.
- **NOMIG**: No persisted state or versioned format is owned by this feature.
- **NOCONC-UI**: Single interactive session per user action; records are id-bound and one-shot (asserted in T-KEY-070, T-KEY-079); no concurrent writer exists.
- **PTR-SA-ONESHOT**: Prepared operations are one-shot; double approval is asserted in T-SA-007.
- **PTR-CH-CONC**: Network list races are asserted in T-DAPP-029; token writes go through the vault and are covered by T-KEY-135.
- **PTR-CH04**: Request coalescing under concurrency is asserted in T-CH-007.
- **NOCONC-SER**: WalletKit delivers relay events sequentially and every request passes the ProviderService pending store, whose concurrency is asserted in T-DAPP-021.
- **NOCONC-ALARM**: Alarms run sequentially per name; reconcile idempotency is asserted in T-DATA-002.
- **NOCONC-BOOT**: The persisted queue is drained once inside the boot pipeline; no concurrent drainer exists.
- **NOCONC-ATOMIC**: Single atomic Redis INCR / single-statement upsert keyed by device; no read-modify-write.
- **PTR-IDEM-CONC**: Concurrent same-key requests are asserted in T-BE-027.
- **NOCONC-RO**: Read-only or stateless request handling; shared caches are covered by the -race detector on all Go unit tests.
- **NOCONC-RACE**: In-memory shared structures (pools, breakers, caches, debouncer) are exercised under go test -race; cross-process races have dedicated tests (T-IDX-015/053/054/055).
- **NOCONC-DB**: Concurrency is asserted at the store/service level (T-BE-036, T-IDX-015, T-IDX-053, T-DB-003).
- **NOCONC**: Pure or single-writer code with no shared mutable state (JS worker is single-threaded and the function does not await between read and write).
- **PTR-BE-RES**: Dependency failures (Redis, Postgres, rpc-gateway, upstreams) for every route are injected by T-BE-094 and T-GW-023/024.
- **PTR-DB-RES**: Connection loss is a service concern, asserted in T-BE-094 and T-IDX-056.
- **NORES**: No I/O or external dependency (pure or in-memory logic).
- **NOINT-PURE**: Pure function/module with no collaborator of its own; it is integrated through its callers' INT tests (vault, provider, send, API stacks) and T-GW-027/T-IDX-061.
- **NOINT-FLOW**: Integrated through the provider/UI flows asserted in T-DAPP-051, T-EXT-019/020/038 and the feature's INT rows; no separate collaborator boundary.
- **PTR-BE-INT**: Exercised through the full API stack by T-BE-097 / T-GW-027 / T-X-012.
- **NOINT-X**: Cross-cutting concern; integration is covered by the rows it aggregates.
- **PTR-KEY-NEG**: Negative inputs are asserted through the owning flow: T-KEY-021/024 (wrong password), T-KEY-069 (no grant), T-KEY-103, T-KEY-104 (address mismatch), T-KEY-107/112 (odd inputs).
- **PTR-SIG-NEG**: Invalid inputs asserted in T-SIG-035 (bad chain ids), T-SIG-039 (fuzz), T-SIG-040/041 (locked/no proof).
- **PTR-DAPP-NEG**: Invalid inputs asserted in T-DAPP-007, T-DAPP-012/014, T-DAPP-020, T-DAPP-034/035, T-DAPP-037, T-DAPP-039, T-DAPP-042/043/045, T-DAPP-046/047.
- **PTR-MSG-NEG**: Invalid-value handling of every message is covered by T-MSG-008 and the feature's UNIT rows that enumerate bad inputs.
- **PTR-BE-NEG**: Bad inputs enumerated in T-BE-013 (tiers), T-BE-024 (over limit), T-BE-030, T-BE-079/080, T-BE-082/083/084, T-BE-086.
- **NONEG-X**: Cross-cutting; negative cases live in the aggregated rows.
- **PTR-KEY-SEC**: Security assertion implemented in a row of another category: T-KEY-022/023 (brute force), T-KEY-123/124 (KDF), T-KEY-032 (PRF), T-KEY-077 (re-auth throttle), T-KEY-035 (lock clears grants), T-KEY-038/045 (entropy, passphrase), T-KEY-101, T-KEY-146.
- **PTR-SIG-SEC**: Security assertions in T-SIG-005..007 (raw-hash gating), T-SIG-050 (send builders), T-SIG-037 (session scoping), T-SIG-038 (SIWE issues).
- **PTR-DAPP-SEC**: Security assertions in T-DAPP-006/009, T-DAPP-023/024, T-DAPP-039, T-DAPP-046, T-SIG-043.
- **PTR-EXT-SEC**: Security assertions in T-EXT-008, T-EXT-012, T-EXT-015, T-EXT-019/020, T-EXT-028.
- **PTR-SA-SEC**: Availability gating is asserted in T-EXT-029 / T-SA-016.
- **PTR-DATA-SEC**: Channel authorisation is enforced and asserted server-side in T-BE-067.
- **PTR-BE-SEC**: Security assertions in T-BE-013 (probation tiers), T-BE-024/092 (quotas), T-BE-079 (address normalisation).
- **NOSEC-DEV**: Developer CLIs (hbdevice, hbkeys, hbverify, clients/ts) are not deployed or reachable from any trust boundary.
- **NOSEC-INTERNAL**: Internal input from authenticated services only (TB11); boundary security is asserted by T-IDX-001, T-IDX-026/027, T-IDX-046/047, T-DB-017/019/023.
- **NOSEC-X**: Cross-cutting; security assertions live in the aggregated rows.
- **PTR-KEY-PROP**: Generative invariants for the vault/KDF/storage stack live in T-KEY-012, T-KEY-140..142.
- **PTR-BE-PROP**: Covered by T-BE-095/096 fuzzers and the deterministic idempotency matrix T-BE-026..029.
- **PTR-DB-CON**: The schema contract is the golden schema dump T-DB-025 and object check T-DBO-001 (categorised MIG).
- **NOCON-X**: Cross-cutting; contracts are covered in the aggregated rows.

Totals: 235 features × 14 categories; tests defined: 712; gaps: **0**.

Test counts by category: UNIT 104, NEG 80, PROP 64, KAT 29, SEC 151, PERF 11, MIG 21, INT 102, CONC 30, RES 43, E2E 15, UI 6, CON 19, REG 37. By priority: P0 331, P1 321, P2 51, P3 9.

## 19. Progress ledger

| Phase | Scope | State | Notes |
|---|---|---|---|
| 0 Discovery | whole repo | DONE 2026-11-19 | TEST_DISCOVERY.md |
| 1 Inventory | 235 features, 160 messages, 69 provider methods, 31 routes, 63 DB objects, 627 Go funcs, 1616 TS exports | DONE 2026-11-19 | FEATURE_INVENTORY.md |
| 2 Test plan | 712 test definitions, 0 matrix gaps | DONE 2026-11-19 | this file |
| 3 Reconciliation | 712 IDs: 261 COVERED, 103 WEAK, 0 BROKEN, 348 MISSING | DONE 2026-11-19 | TEST_GAP_REPORT.md |
| 4 Implementation | P0 → P3 | PENDING | |
| 5 Verification | run ×3, coverage, mutation | PENDING | |
| 6 Summary | — | PENDING | TEST_SUMMARY.md |

Status column per Test ID (COVERED / WEAK / BROKEN / MISSING) is recorded in TEST_GAP_REPORT.md §3 and mirrored here after Phase 5.
