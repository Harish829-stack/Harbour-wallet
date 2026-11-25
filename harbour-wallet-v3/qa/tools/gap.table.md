| Test ID | Feature | Cat | Pri | Status | Evidence (file / test) | Note |
|---|---|---|---|---|---|---|
| T-KEY-001 | KEY-01 | UNIT | P1 | COVERED | apps/extension/test/qa/vault-handlers.test.js "T-KEY-001" | boundaries + messages |
| T-KEY-002 | KEY-01 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-002" | sampled list |
| T-KEY-003 | KEY-01 | PROP | P2 | COVERED | vault-handlers.test.js "T-KEY-003" | fast-check unicode |
| T-KEY-004 | KEY-03 | KAT | P0 | COVERED | apps/extension/test/qa/crypto-kat.test.js "T-KEY-004" | RFC 9106 + independent HKDF(Argon2id) |
| T-KEY-005 | KEY-03 | UNIT | P0 | COVERED | crypto-kat.test.js "T-KEY-005" | determinism, sensitivity, independence |
| T-KEY-006 | KEY-03 | NEG | P0 | COVERED | crypto-kat.test.js "T-KEY-006" | range refusals + timing; OBS-01 noted |
| T-KEY-007 | KEY-03 | UNIT | P1 | COVERED | crypto-kat.test.js "T-KEY-007" | NFKC |
| T-KEY-008 | KEY-03 | SEC | P0 | COVERED | crypto-kat.test.js "T-KEY-008" | master zeroised |
| T-KEY-009 | KEY-03 | PERF | P2 | COVERED | apps/extension/test/qa/kdf-perf.test.js | default params pinned (47104 KiB, t=2, p=1); one derive < 5 s; buffer growth ceiling |
| T-KEY-010 | KEY-04 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-010" | PBKDF2-SHA512 vs node + published |
| T-KEY-011 | KEY-05 | UNIT | P0 | COVERED | crypto-kat.test.js "T-KEY-011" | envelope shape |
| T-KEY-012 | KEY-05 | PROP | P0 | COVERED | crypto-kat.test.js "T-KEY-012" | fast-check round trip, salt/IV uniqueness |
| T-KEY-013 | KEY-05 | NEG | P0 | COVERED | key-schedule.test.js "passworder refuses a human password…" | asserts /high-entropy/ rejection |
| T-KEY-014 | KEY-05 | SEC | P0 | COVERED | crypto-kat.test.js "T-KEY-014" | tamper → exact error |
| T-KEY-015 | KEY-05 | MIG | P0 | COVERED | key-schedule.test.js "passworder refuses a human password and still reads the old envelope" | v1 envelope built independently and decrypted |
| T-KEY-016 | KEY-05 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-016" | malformed envelopes, no secret echo |
| T-KEY-017 | KEY-02 | INT | P0 | COVERED | key-schedule.test.js "new vaults use Argon2id…" + pentest-regressions.test.js "PT-11: key material lives in extension-origin IndexedDB" | record v2 + params, vault v2, IDB placement |
| T-KEY-018 | KEY-02 | NEG | P0 | COVERED | pentest-regressions.test.js "PT-05: createWallet against an existing vault changes nothing" |  |
| T-KEY-019 | KEY-02 | CONC | P1 | COVERED | vault-handlers.test.js "T-KEY-019 / T-KEY-052" | concurrent create |
| T-KEY-020 | KEY-06 | INT | P0 | COVERED | key-schedule.test.js "new vaults use Argon2id and unlock again after a lock" |  |
| T-KEY-021 | KEY-06 | NEG | P0 | COVERED | vault-throttle.test.js "parallel wrong passwords cannot outrun the throttle" | counts 6 'Incorrect password' then TOO_MANY_ATTEMPTS |
| T-KEY-022 | KEY-06 | SEC | P0 | COVERED | vault-handlers.test.js "T-KEY-022" | fake clock, exact schedule to cap |
| T-KEY-023 | KEY-06 | CONC | P0 | COVERED | vault-throttle.test.js + pentest-regressions.test.js "PT-03: parallel wrong passwords through SEPARATE VaultService instances" |  |
| T-KEY-024 | KEY-06 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-024" | VAULT_IS_EMPTY |
| T-KEY-025 | KEY-06 | RES | P1 | COVERED | vault-handlers.test.js "T-KEY-025" | corrupt blob |
| T-KEY-026 | KEY-07 | MIG | P0 | COVERED | key-schedule.test.js "a v1 vault is upgraded on first unlock…" | asserts re-key of vault, both keystore kinds, perps & prediction blobs, passkey cleared, old keys fail |
| T-KEY-027 | KEY-07 | RES | P0 | COVERED | key-schedule.test.js "a failed upgrade changes nothing and the wallet still unlocks on v1" |  |
| T-KEY-028 | KEY-07 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-028" | v1 fixture, corrupt keystore, nothing written |
| T-KEY-029 | KEY-07 | UNIT | P1 | COVERED | vault-handlers.test.js "T-KEY-029" + crypto-kat.test.js "T-KEY-140" | identity preserved, pk keystore |
| T-KEY-030 | KEY-07 | NEG | P2 | COVERED | vault-handlers.test.js "T-KEY-030" | null cases |
| T-KEY-031 | KEY-08 | INT | P0 | COVERED | key-schedule.test.js "a biometrics-only wallet can add a password…" |  |
| T-KEY-032 | KEY-08 | NEG | P0 | COVERED | vault-handlers.test.js "T-KEY-032" | passkeyAddPassword refusals |
| T-KEY-033 | KEY-08 | MIG | P1 | COVERED | key-schedule.test.js "HW-001: adding a password to a LEGACY biometrics-only wallet…" |  |
| T-KEY-034 | KEY-09 | INT | P0 | COVERED | vault-handlers.test.js "T-KEY-034" | session untouched, shared throttle |
| T-KEY-035 | KEY-10 | INT | P0 | COVERED | vault-handlers.test.js "T-KEY-035 / T-KEY-037" + worker-router.test.js "T-KEY-035" | lock msg + alarm + idle |
| T-KEY-036 | KEY-10 | UNIT | P1 | COVERED | settings.test.js "auto-lock options, default and sanitising" + settings-service.test.js "HW-011…", "changing the auto-lock timer persists it and arms the real alarm" |  |
| T-KEY-037 | KEY-10 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-035 / T-KEY-037" | idempotent |
| T-KEY-038 | KEY-11 | UNIT | P0 | COVERED | crypto-kat.test.js "T-KEY-038" | 12 words, valid, unique |
| T-KEY-039 | KEY-11 | NEG | P1 | COVERED | crypto-kat.test.js "T-KEY-038" | locked refusal |
| T-KEY-040 | KEY-12 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-040" | reference addresses + independent SLIP-10 |
| T-KEY-041 | KEY-12 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-041" | BIP-32 vector 1 |
| T-KEY-042 | KEY-12 | UNIT | P0 | COVERED | crypto-kat.test.js "T-KEY-042" | every coin path |
| T-KEY-043 | KEY-12 | PROP | P0 | COVERED | crypto-kat.test.js "T-KEY-043" | property vs scure |
| T-KEY-044 | KEY-12 | UNIT | P1 | COVERED | crypto-kat.test.js "T-KEY-040" | solanaSolana vs default, independent SLIP-10 |
| T-KEY-045 | KEY-12 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-045" | empty passphrase |
| T-KEY-046 | KEY-13 | INT | P0 | COVERED | crypto-kat.test.js "T-KEY-046" | keystore under session key |
| T-KEY-047 | KEY-14 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-EXT-038 / T-KEY-047" | lock → reload → unlock in the real popup |
| T-KEY-048 | KEY-14 | INT | P0 | COVERED | vault-handlers.test.js "T-KEY-048" | state + 10-min manage grant + IDB placement |
| T-KEY-049 | KEY-14 | NEG | P0 | COVERED | vault-handlers.test.js "T-KEY-049" | 8 invalid inputs, no write |
| T-KEY-050 | KEY-14 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-05…" |  |
| T-KEY-051 | KEY-14 | RES | P0 | COVERED | vault-handlers.test.js "T-KEY-051" | vault dropped, retry |
| T-KEY-052 | KEY-14 | CONC | P1 | COVERED | vault-handlers.test.js "T-KEY-019 / T-KEY-052" | concurrent createWallet |
| T-KEY-053 | KEY-14 | RES | P1 | COVERED | vault-handlers.test.js "T-KEY-053 / T-KEY-102" | interrupted + reset |
| T-KEY-054 | KEY-14 | SEC | P0 | COVERED | vault-handlers.test.js "T-KEY-054" | response keys exact, phrase scan |
| T-KEY-055 | KEY-15 | INT | P0 | COVERED | vault-handlers.test.js "T-KEY-055" | keystore under passwordKey |
| T-KEY-056 | KEY-15 | SEC | P0 | COVERED | vault-handlers.test.js "T-KEY-056" | AUTH_REQUIRED, consumed |
| T-KEY-057 | KEY-15 | SEC | P0 | COVERED | vault-handlers.test.js "T-KEY-057" | JSON forgery |
| T-KEY-058 | KEY-15 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-058" | MAX_WALLETS |
| T-KEY-059 | KEY-15 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-059" | duplicate |
| T-KEY-060 | KEY-15 | INT | P1 | COVERED | pentest-regressions.test.js "PT-08: the reveal grant created for a NEW wallet reveals only that wallet…" |  |
| T-KEY-061 | KEY-16 | UNIT | P0 | COVERED | onboarding-import.test.js "classifySecret…" |  |
| T-KEY-062 | KEY-16 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-062" | EIP-155 key |
| T-KEY-063 | KEY-16 | NEG | P0 | COVERED | crypto-kat.test.js "T-KEY-063" | curve range |
| T-KEY-064 | KEY-16 | INT | P0 | COVERED | secrets.test.js "T-KEY-064" | pk import, signing key, duplicate |
| T-KEY-065 | KEY-16 | PROP | P1 | COVERED | secrets.test.js "T-KEY-065" | fuzz decodePrivateKeyBytes |
| T-KEY-066 | KEY-17 | SEC | P0 | COVERED | secrets.test.js "T-KEY-066" | response shape, nothing stored |
| T-KEY-067 | KEY-18 | INT | P0 | COVERED | apps/extension/test/qa/secrets.test.js "T-KEY-067" | full backup flow, opaque ids, class-only session |
| T-KEY-068 | KEY-18 | SEC | P0 | COVERED | secrets.test.js "T-KEY-068" | BIP-39 word scan of response + session |
| T-KEY-069 | KEY-18 | NEG | P0 | COVERED | secrets.test.js "T-KEY-069" | 4 refusals, nothing rendered |
| T-KEY-070 | KEY-18 | NEG | P1 | COVERED | secrets.test.js "T-KEY-070" | mismatch/expired, fake clock |
| T-KEY-071 | KEY-18 | PROP | P1 | COVERED | secrets.test.js "T-KEY-071" | fast-check repeated words |
| T-KEY-072 | KEY-19 | INT | P0 | COVERED | secrets.test.js "T-KEY-072" | painted not returned, copy via offscreen port |
| T-KEY-073 | KEY-19 | NEG | P0 | COVERED | secrets.test.js "T-KEY-073" | copy refusals |
| T-KEY-074 | KEY-19/EXT-13 | SEC | P0 | COVERED | secrets.test.js "T-KEY-074" | offscreen page timer, clamps, malformed |
| T-KEY-075 | KEY-20 | UNIT | P0 | COVERED | vault-handlers.test.js "T-KEY-075" | ms boundaries, cap, binding |
| T-KEY-076 | KEY-20 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-08…" and "PT-01: enrolment needs a PASSWORD grant…" |  |
| T-KEY-077 | KEY-20 | INT | P0 | COVERED | vault-handlers.test.js "T-KEY-077" | shared throttle |
| T-KEY-078 | KEY-20 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-078" | purposeOf |
| T-KEY-079 | KEY-21 | INT | P0 | COVERED | passkey.test.js "passkeyService: enroll seals session keys, unlock restores them…" | security notification not asserted (minor) |
| T-KEY-080 | KEY-21 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-01…" |  |
| T-KEY-081 | KEY-21 | NEG | P0 | COVERED | passkey.test.js "passkeyService: wrong secret, stale vault, locked enroll, removal" + "HW-001: legacy (user-handle) seals…" |  |
| T-KEY-082 | KEY-21 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-082" | biometrics-only |
| T-KEY-083 | KEY-21 | E2E | P1 | COVERED | apps/extension/test/e2e/browser.test.js (T-KEY-083 / T-KEY-130) | Chromium CDP virtual authenticator with PRF: enrol via the real enrol screen, status prf-v1, lock, biometric unlock restores the session |
| T-KEY-084 | KEY-22 | MIG | P0 | COVERED | pentest-regressions.test.js "PT-11: an existing install is migrated…" |  |
| T-KEY-085 | KEY-22 | RES | P0 | COVERED | apps/extension/test/qa/vault-handlers.test.js "T-KEY-085" | fake IDB read-back hook + abort: boot and lazy migration keep and serve the legacy copy; verified move removes it |
| T-KEY-086 | KEY-22 | UNIT | P0 | COVERED | vault-handlers.test.js "T-KEY-086" | exact |
| T-KEY-087 | KEY-22 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-11: key material lives in extension-origin IndexedDB…" |  |
| T-KEY-088 | KEY-22 | NEG | P1 | COVERED | pentest-regressions.test.js "PT-11: … a removed key cannot be resurrected" |  |
| T-KEY-089 | KEY-23 | INT | P0 | COVERED | secrets.test.js "T-KEY-089" | account #2 vs scure, zeroed |
| T-KEY-090 | KEY-23 | NEG | P0 | COVERED | send.test.js "a signing key that does not belong to the account is refused" + pentest-regressions.test.js "PT-12" |  |
| T-KEY-091 | KEY-23 | NEG | P1 | COVERED | secrets.test.js "T-KEY-091" | locked / no EVM |
| T-KEY-092 | KEY-24 | UNIT | P0 | COVERED | qrsync.test.js (4 tests: decode, out-of-order, rejects non-UR/absurd seq/oversize, malformed keys) |  |
| T-KEY-093 | KEY-24 | SEC | P0 | COVERED | audit-a5-a8.test.js "A5: …scrypt memory exceeds the cap…", "A5: total scrypt work…" |  |
| T-KEY-094 | KEY-24 | INT | P0 | COVERED | secrets.test.js "T-KEY-094" | dry run, grant, import, stage cleared |
| T-KEY-095 | KEY-24 | SEC | P0 | COVERED | seed-typing.test.js "QR import: the staged keystores are destroyed after 5 wrong one-time codes" |  |
| T-KEY-096 | KEY-24 | NEG | P1 | COVERED | secrets.test.js "T-KEY-096" | code format, expiry, size |
| T-KEY-097 | KEY-24 | PROP | P1 | COVERED | secrets.test.js "T-KEY-097" | fast-check + mutations |
| T-KEY-098 | KEY-25 | INT | P0 | COVERED | vault-handlers.test.js "T-KEY-098" | remove |
| T-KEY-099 | KEY-25 | NEG | P0 | COVERED | vault-handlers.test.js "T-KEY-099" | refusals, no change |
| T-KEY-100 | KEY-26 | INT | P1 | COVERED | vault-handlers.test.js "T-KEY-100" | accounts and wallets |
| T-KEY-101 | KEY-26 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-101" | refusals |
| T-KEY-102 | KEY-27 | INT | P1 | COVERED | vault-handlers.test.js "T-KEY-053 / T-KEY-102" | resetEmptyVault |
| T-KEY-103 | KEY-27 | SEC | P0 | COVERED | vault-handlers.test.js "T-KEY-103" | refused with wallets / locked |
| T-KEY-104 | KEY-28 | INT | P1 | COVERED | apps/extension/test/e2e/ledger.test.js "T-KEY-104" | throwaway device key signs prepared tx; wrong signer/replay/bad sig/tampered tx refused; broadcast on mock chain; no keystore stored |
| T-KEY-105 | KEY-28 | SEC | P0 | COVERED | apps/extension/test/e2e/ledger.test.js "T-KEY-105" | reveal/copy/addAccount/sendSubmit/smart account/perps/earn/dApp sign refused for Ledger (OBS-06) |
| T-KEY-106 | KEY-29 | INT | P1 | COVERED | venue-secrets.test.js "T-KEY-146 / T-KEY-106" + vault-handlers T-KEY-123 | real perpsEnable; blob decrypts under session passwordKey; survives lock/unlock; v1→v2 re-key in T-KEY-123 |
| T-KEY-107 | KEY-30 | UNIT | P0 | COVERED | secrets.test.js "T-KEY-107" | all names/casings, depth, cycles |
| T-KEY-108 | KEY-30 | SEC | P0 | COVERED | worker-router.test.js "T-MSG-002 / T-KEY-108" | all messages, both states |
| T-KEY-109 | KEY-30 | SEC | P0 | COVERED | apps/extension/test/qa/ui-port-scan.test.js | port open before wallet exists; 29 messages (snapshot/patches/responses) deep-scanned for secret fields, password/session keys, phrases (incl. painted generated phrase), private keys, BIP-39 runs |
| T-KEY-110 | KEY-30 | UNIT | P1 | COVERED | errors.test.js (4 tests) |  |
| T-KEY-111 | KEY-30 | PROP | P2 | COVERED | apps/extension/test/qa/sanitize.prop.test.js (2) | fast-check random nested trees vs a structural oracle; no input mutation; non-string error untouched; depth>5 untouched; single-token codes pass |
| T-KEY-112 | KEY-31 | SEC | P0 | COVERED | failover.test.js "logger redacts API keys in URLs, hex secrets and mnemonic-shaped text" |  |
| T-KEY-113 | KEY-31 | PROP | P1 | COVERED | secrets.test.js "T-KEY-113" | property |
| T-KEY-114 | KEY-31 | SEC | P0 | COVERED | secrets.test.js "T-KEY-114" | source scan |
| T-KEY-115 | KEY-06 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-KEY-115 / T-EXT-035" | lockout enforced in UI; raw code shown = BUG-14 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-KEY-116 | KEY-18 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-KEY-116" | phrase only as images; no word run in text/alt/aria |
| T-KEY-117 | KEY-19 | UI | P1 | COVERED | apps/extension/test/e2e/browser.test.js (T-KEY-117) | built extension, Playwright fake clock: short press no reveal; Space-hold reveals; window blur re-masks; second hold reveals; auto-hide at 60 s; hold control returns. Copy button N/A by design (secret is an image, no copy path; T-KEY-116) |
| T-KEY-118 | KEY-14 | UI | P2 | COVERED | apps/extension/test/e2e/browser.test.js "T-EXT-040 / T-EXT-041 / T-KEY-118" | unlock + onboarding screens clean |
| T-KEY-119 | KEY-22 | PERF | P3 | COVERED | apps/extension/test/qa/perf-ext.test.js (2) | Found BUG-18: vault persist throws RangeError (btoa spread) from the 8th wallet; passworder fails at >=250k bytes. Lock/unlock/getState stay fast up to the failure. Pinned as a known bug. | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-KEY-120 | KEY-02 | SEC | P0 | COVERED | worker-router.test.js "T-KEY-120" | boot access levels (behavioural, real index.ts) |
| T-SIG-001 | SIG-01 | UNIT | P0 | COVERED | provider.test.js "personal_sign accepts both param orders, hex and utf8, and rejects bad input" |  |
| T-SIG-002 | SIG-01 | NEG | P0 | COVERED | provider.test.js "personal_sign accepts both param orders…" |  |
| T-SIG-003 | SIG-01 | UNIT | P1 | COVERED | apps/extension/test/qa/signing-units.test.js "T-SIG-003" | 0x / odd hex as text |
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
| T-SIG-014 | SIG-03 | PROP | P1 | COVERED | signing-units.test.js "T-SIG-014" | independent EIP-712 encoder, random trees, spec Mail vector |
| T-SIG-015 | SIG-03 | PROP | P1 | COVERED | signing-units.test.js "T-SIG-015" | fuzz |
| T-SIG-016 | SIG-05 | INT | P0 | COVERED | provider.test.js "eth_sendTransaction: approval signs/broadcasts with the connected account…" + "evmSendTransaction: prepares, signs locally and broadcasts…" |  |
| T-SIG-017 | SIG-05 | SEC | P0 | COVERED | provider.test.js "pending signing approval is bound to the original connection, account and chain" / "chain changes invalidate queued typed-data approvals" |  |
| T-SIG-018 | SIG-05 | SEC | P0 | COVERED | provider.test.js "pending signing approval is bound to the original connection, account and chain" |  |
| T-SIG-019 | SIG-05 | NEG | P0 | COVERED | provider.test.js "eth_sendTransaction normalisation: strict fields, from binding, hex quantities" |  |
| T-SIG-020 | SIG-05 | SEC | P0 | COVERED | signing-units.test.js "T-SIG-020" | esbuild define release/dev × loopback/https/http |
| T-SIG-021 | SIG-05 | RES | P1 | COVERED | e2e/fullstack.test.js "T-DATA-013 / T-CH-017 / T-SIG-021" | broadcast 503 → ≤1 tx |
| T-SIG-022 | SIG-05 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-DAPP-051 ..." | signatures verified with viem verifyMessage/verifyTypedData |
| T-SIG-023 | SIG-06 | UNIT | P0 | COVERED | chain-data.test.js "gas: EIP-1559 tiers…" + send.test.js "EVM native…", "EVM: legacy (pre-1559)…" |  |
| T-SIG-024 | SIG-06 | KAT | P0 | COVERED | secrets.test.js "T-SIG-024" | address-bound key |
| T-SIG-025 | SIG-06 | UNIT | P1 | COVERED | tokens.test.js "estimateSend (ERC-20)…", "estimateSend (native)…" + send.test.js "EVM: … insufficient funds and contract recipients are flagged" |  |
| T-SIG-026 | SIG-07 | KAT | P0 | COVERED | apps/extension/test/qa/family-verify.test.js (5) + test/send.test.js per-family | independent noble/msgpack/protobuf verifiers: Stellar, Tezos, Algorand, Sui, Cosmos (+ EVM/BTC/SOL/TRON/NEAR in send.test.js); remaining families deterministic+structural |
| T-SIG-027 | SIG-07 | NEG | P0 | COVERED | send.test.js "EVM rejects malformed recipients…", XRP/Bitcoin dust/insufficient tests, "parseUnits / formatUnits are exact and strict" |  |
| T-SIG-028 | SIG-07 | PROP | P1 | COVERED | signing-units.test.js "T-SIG-028" | property 0..36 decimals |
| T-SIG-029 | SIG-08 | INT | P0 | COVERED | provider.test.js "solana provider flow: connect, signMessage, signTransaction, signAndSendTransaction, disconnect" + "solana tx parse and signature slot filling verifies with ed25519" |  |
| T-SIG-030 | SIG-08 | SEC | P0 | COVERED | audit-fixes.test.js "Solana: a serialized transaction message is refused as a \"message\"; text is not" |  |
| T-SIG-031 | SIG-08 | PROP | P1 | COVERED | signing-units.test.js "T-SIG-031" | fuzz 5000 |
| T-SIG-032 | SIG-09 | INT | P1 | COVERED | multi.test.js (10 tests) + multi-extra.test.js |  |
| T-SIG-033 | SIG-09 | KAT | P1 | WEAK | apps/extension/test/qa/spec-vectors.test.js (2) | ton_proof digest and ADR-036 sign bytes match an independent construction from the spec text (field binding, sorted keys, escapes); the published spec example vectors were not available offline so they are not asserted |
| T-SIG-034 | SIG-09 | PROP | P2 | COVERED | signing-units.test.js "T-SIG-034" | fuzz 4000, time bound |
| T-SIG-035 | SIG-10 | UNIT | P0 | COVERED | policy.test.js "Harbour mainnets and curated testnets are classified and signable; unknown chains are refused" + "a user-added network becomes signable…" |  |
| T-SIG-036 | SIG-10 | SEC | P0 | COVERED | signing-units.test.js "T-SIG-036" | all non-EVM registry chains + fakes |
| T-SIG-037 | SIG-11 | INT | P1 | COVERED | apps/extension/test/qa/session-boundary.test.js (2) | sessionFor stable within a minute, rolls at exact boundary (+59.999 s / +60 s / -1 ms), distinct per chain |
| T-SIG-038 | SIG-12 | UNIT | P0 | COVERED | provider.test.js "SIWE (EIP-4361) parsing and mismatch detection" |  |
| T-SIG-039 | SIG-12 | PROP | P2 | COVERED | signing-units.test.js "T-SIG-039" | fuzz |
| T-SIG-040 | SIG-13 | INT | P0 | COVERED | provider.test.js "no wallet yet -> 4100; locked wallet keeps the request and asks the UI to unlock" |  |
| T-SIG-041 | SIG-13 | SEC | P0 | COVERED | provider-port.test.js "T-SIG-041" | bound, expiring, single-use proof; disabling needs grant |
| T-SIG-042 | SIG-13 | SEC | P0 | COVERED | provider.test.js "HW-2026-006: approvals for a phishing-listed origin are refused unless the user typed the site host" + "PT-10…" |  |
| T-SIG-043 | SIG-13 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-SIG-043 / T-SIG-044 / T-UX-030" | Reject click → 4001 in real UI |
| T-SIG-044 | SIG-05 | UI | P1 | COVERED | apps/extension/test/e2e/browser.test.js "T-SIG-043 / T-SIG-044 / T-UX-030" | closing the approval window → 4001 |
| T-DAPP-001 | DAPP-04 | UNIT | P0 | COVERED | provider.test.js "parsePageRequest keeps only the 4 allowed keys and deep-copies params" |  |
| T-DAPP-002 | DAPP-04 | NEG | P0 | COVERED | provider.test.js "parsePageRequest rejects malformed, oversize and unsafe payloads" |  |
| T-DAPP-003 | DAPP-04 | SEC | P0 | COVERED | provider-port.test.js "T-DAPP-003" | proto keys nested + JSON.parse |
| T-DAPP-004 | DAPP-04 | PROP | P0 | COVERED | provider-port.test.js "T-DAPP-004" | fc.anything incl. bigint/typed arrays |
| T-DAPP-005 | DAPP-05 | UNIT | P0 | COVERED | provider.test.js "method allowlist: wallet UI messages and bridge-namespaced names are not dApp methods" |  |
| T-DAPP-006 | DAPP-05 | NEG | P1 | COVERED | provider.test.js "unsupported / unknown methods: 4200 vs -32601, and no UI-message injection" |  |
| T-DAPP-007 | DAPP-03 | SEC | P0 | COVERED | page-bridge.test.js "T-DAPP-007" + provider-port.test.js "T-DAPP-007 (worker side)" | nonce/source/origin/second hello; untrusted frames 4100 |
| T-DAPP-008 | DAPP-03 | INT | P1 | COVERED | page-bridge.test.js "T-DAPP-008" | late content script |
| T-DAPP-009 | DAPP-06 | NEG | P1 | COVERED | page-bridge.test.js "T-DAPP-009" | duplicate id, 200 inflight, local -32601/4200 |
| T-DAPP-010 | DAPP-06 | RES | P0 | COVERED | provider.test.js "pending requests survive a worker restart; re-sent request not duplicated…" |  |
| T-DAPP-011 | DAPP-06 | RES | P1 | COVERED | page-bridge.test.js "T-DAPP-011" | reload → 4900 + disconnect |
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
| T-DAPP-030 | DAPP-11 | UNIT | P1 | COVERED | signing-units.test.js "T-DAPP-030" | decimal/hex/octal/short IPv4, IPv6, dotless |
| T-DAPP-031 | DAPP-12 | UNIT | P1 | COVERED | tokens.test.js "sanitizeToken validates network/address/metadata…", "hostile metadata is cleaned…", "upsert … list is capped" |  |
| T-DAPP-032 | DAPP-13 | INT | P1 | COVERED | provider.test.js "read RPC is proxied to the origin chain; params must be an array" |  |
| T-DAPP-033 | DAPP-13 | SEC | P1 | COVERED | provider-port.test.js "T-DAPP-033" | read-only proxy, no from |
| T-DAPP-034 | DAPP-14 | INT | P1 | COVERED | provider-port.test.js "T-DAPP-034 / T-DAPP-035" | origin-scoped events, allowlist |
| T-DAPP-035 | DAPP-14 | SEC | P0 | COVERED | provider-port.test.js "T-DAPP-034 / T-DAPP-035" | init after lock: no secret, no accounts |
| T-DAPP-036 | DAPP-15 | UNIT | P0 | COVERED | provider.test.js "site risk: blocklist hit, whitelist override, cache, and honest \"unavailable\"" |  |
| T-DAPP-037 | DAPP-15 | RES | P1 | COVERED | provider.test.js "site risk…honest unavailable" + "HW-2026-018: siteRisk handles a ScamSniffer-sized list…" |  |
| T-DAPP-038 | DAPP-15 | SEC | P0 | COVERED | provider.test.js "PT-10: a clean dApp iframe inside a phishing-listed page is blocked…" |  |
| T-DAPP-039 | DAPP-16 | UNIT | P2 | COVERED | page-bridge.test.js "T-DAPP-039 / T-DAPP-046" | blocked domains, patterns, no injection |
| T-DAPP-040 | DAPP-17 | INT | P1 | COVERED | walletconnect.test.js (16 tests) |  |
| T-DAPP-041 | DAPP-17 | MIG | P1 | COVERED | walletconnect.test.js "PT-06 migration…" |  |
| T-DAPP-042 | DAPP-17 | NEG | P1 | COVERED | walletconnect.test.js "parseWcUri accepts v2 links and refuses…", "session_request: refuses unknown sessions…" |  |
| T-DAPP-043 | DAPP-18 | UNIT | P0 | COVERED | provider.test.js "calldata decoding…" + audit-fixes.test.js "decoder: Permit2 approve and multicall expose inner approvals" |  |
| T-DAPP-044 | DAPP-18 | PROP | P1 | COVERED | signing-units.test.js "T-DAPP-044" | fuzz + approve selector |
| T-DAPP-045 | DAPP-18 | UNIT | P1 | COVERED | display-integrity.test.js (9 tests) |  |
| T-DAPP-046 | DAPP-19 | INT | P2 | COVERED | page-bridge.test.js "T-DAPP-039 / T-DAPP-046" | update path, MAIN/allFrames/document_start |
| T-DAPP-047 | DAPP-20 | INT | P1 | COVERED | provider.test.js "page navigation drops its pending requests; window close / expiry reject them with 4001" |  |
| T-DAPP-048 | DAPP-01 | UNIT | P1 | COVERED | page-bridge.test.js "T-DAPP-048" | EIP-1193 + legacy + EIP-6963 + no impersonation |
| T-DAPP-049 | DAPP-01/DAPP-02 | SEC | P1 | COVERED | page-bridge.test.js "T-DAPP-049" | page tampering |
| T-DAPP-050 | DAPP-02 | UNIT | P2 | COVERED | page-bridge.test.js "T-DAPP-050" | onlyIfTrusted |
| T-DAPP-051 | DAPP-01..20 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-DAPP-051 / T-PM-006 / T-SIG-022 / T-X-012" | browser: connect, switch, personal_sign, v4 typed, send, watchAsset, revoke |
| T-DAPP-052 | DAPP-07 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-DAPP-052" | cross-origin iframe origin shown, not the top page |
| T-DAPP-053 | DAPP-10 | PERF | P2 | COVERED | apps/extension/test/qa/perf-ext.test.js (2) | 1000-read burst: all answered, served count within the documented limiter budget (120 burst + 60/s), no unexpected errors, heap < 64 MiB; paced 40/s all served. Rate-limited reads answer -32005 as designed. | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-EXT-001 | EXT-01 | SEC | P0 | COVERED | apps/extension/test/qa/ext-infra.test.js "T-EXT-001 / T-EXT-003" | manifest config + built dist/manifest.json |
| T-EXT-002 | EXT-01 | CON | P1 | COVERED | ext-infra.test.js "T-EXT-002" | localhost/127/https |
| T-EXT-003 | EXT-02 | SEC | P0 | COVERED | ext-infra.test.js "T-EXT-001 / T-EXT-003" | exact CSP, no unsafe tokens, built artefact |
| T-EXT-004 | EXT-02 | SEC | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-EXT-004" | Trusted Types block innerHTML/insertAdjacentHTML/script.src |
| T-EXT-005 | EXT-03 | UNIT | P0 | COVERED | accessPolicy.test.js (2 tests) |  |
| T-EXT-006 | EXT-03 | SEC | P0 | COVERED | worker-router.test.js "T-MSG-001" | all 182 messages × 6 senders, no state change/fetch |
| T-EXT-007 | EXT-03 | SEC | P0 | COVERED | ext-infra.test.js "T-EXT-007" | flags stripped through router |
| T-EXT-008 | EXT-04 | INT | P0 | COVERED | worker-router.test.js "T-KEY-120" | behavioural boot |
| T-EXT-009 | EXT-05 | UNIT | P0 | COVERED | ext-infra.test.js "T-EXT-009" | duplicate, unknown, redaction |
| T-EXT-010 | EXT-05 | SEC | P1 | COVERED | ext-infra.test.js "T-EXT-010" | disjoint maps |
| T-EXT-011 | EXT-05 | NEG | P1 | COVERED | ext-infra.test.js "T-EXT-011" | malformed raw / proto names |
| T-EXT-012 | EXT-06 | INT | P1 | COVERED | ext-infra.test.js "T-EXT-012" | port snapshot/patch/foreign/ids/throw |
| T-EXT-013 | EXT-07 | UNIT | P1 | COVERED | ext-infra.test.js "T-EXT-013" | 19/20 retries, step name |
| T-EXT-014 | EXT-07 | RES | P1 | COVERED | ext-infra.test.js "T-EXT-014" | queue semantics |
| T-EXT-015 | EXT-07 | UNIT | P2 | COVERED | ext-infra.test.js "T-EXT-015" | 1 h guard with fake clock |
| T-EXT-016 | EXT-08 | MIG | P1 | COVERED | migrations.test.js (3 tests) |  |
| T-EXT-017 | EXT-08 | UNIT | P1 | COVERED | ext-infra.test.js "T-EXT-017 / T-EXT-044" | hydrate rules |
| T-EXT-018 | EXT-08 | SEC | P0 | COVERED | ext-infra.test.js "T-EXT-018" | field + value scan of store and persisted tuple |
| T-EXT-019 | EXT-09 | RES | P0 | COVERED | ext-infra.test.js "T-EXT-019" | second worker instance on same storage, resend dedupe, single signature |
| T-EXT-020 | EXT-09 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-EXT-020" | SW killed via CDP while approval pending; settles, one valid signature |
| T-EXT-021 | EXT-10 | UNIT | P1 | COVERED | settings.test.js "applyPatch validates every field…", "applyPatch ignores junk…", "normalizeSettings tolerates corrupt / old storage" |  |
| T-EXT-022 | EXT-10 | SEC | P0 | COVERED | pentest-regressions.test.js "PT-04: only settings that WEAKEN security need re-auth" |  |
| T-EXT-023 | EXT-10 | UNIT | P2 | COVERED | settings.test.js "locale list and pick" |  |
| T-EXT-024 | EXT-11 | KAT | P0 | COVERED | ext-infra.test.js "T-EXT-024" | RFC 8032 + tampering |
| T-EXT-025 | EXT-11 | SEC | P0 | COVERED | ext-infra.test.js "T-EXT-025 / T-EXT-026" | downgrade, expiry, filters |
| T-EXT-026 | EXT-11 | SEC | P1 | COVERED | ext-infra.test.js "T-EXT-025 / T-EXT-026" | AMB-11 documented |
| T-EXT-027 | EXT-11 | RES | P1 | COVERED | ext-infra.test.js "T-EXT-027" | 500/timeout/bad JSON/bad sig through router |
| T-EXT-028 | EXT-12 | UNIT | P0 | COVERED | policy.test.js "the three signing switches are explicit and on in this build" |  |
| T-EXT-029 | EXT-12 | UNIT | P0 | COVERED | policy.test.js "smart accounts need the remote flag…" |  |
| T-EXT-030 | EXT-13 | INT | P1 | COVERED | ext-infra.test.js "T-EXT-030" + "T-EXT-030b" | BUG-09 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-EXT-031 | EXT-14 | SEC | P0 | COVERED | apps/extension/test/qa/release-tooling.test.js "T-EXT-031", "T-EXT-031 (refusals)" | real scripts in a sandbox repo, throwaway Ed25519 key; tamper/pin/signer-swap/determinism |
| T-EXT-032 | EXT-14 | SEC | P0 | COVERED | check-frozen.test.js (2 tests) |  |
| T-EXT-033 | EXT-14 | SEC | P0 | COVERED | release-tooling.test.js "T-EXT-033" | verify.mjs leak-scan section executed in vm on fake bundles + fake key files |
| T-EXT-034 | EXT-14 | SEC | P1 | COVERED | security-2026-11-18.test.js "SEC-01…" |  |
| T-EXT-035 | EXT-15 | SEC | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-KEY-115 / T-EXT-035" | typed password not kept in DOM after submit |
| T-EXT-036 | EXT-15 | UI | P1 | COVERED | provider.test.js "HW-004…" |  |
| T-EXT-037 | EXT-16 | INT | P2 | COVERED | ext-infra.test.js "T-EXT-037" | bounded text, malformed, click URL allowlist |
| T-EXT-038 | EXT-01..16 | E2E | P1 | COVERED | apps/extension/test/e2e/browser.test.js "T-EXT-038 / T-KEY-047" | real Chromium + built extension + Go API + mock chain |
| T-EXT-039 | EXT-06 | PERF | P3 | COVERED | apps/extension/test/qa/perf-ext.test.js | 1000 live-slice patches with a connected popup port: p95 < 50 ms; only the live slice is broadcast. |
| T-EXT-040 | EXT-15 | UI | P2 | COVERED | apps/extension/test/e2e/browser.test.js "T-EXT-040 / T-EXT-041 / T-KEY-118" | axe-core critical on Home = BUG-13 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-UX-001 | UX-01 | UNIT | P0 | COVERED | apps/extension/test/qa/ux-sa-units.test.js "T-UX-001 / T-UX-022" | boundaries |
| T-UX-002 | UX-02 | UNIT | P0 | COVERED | audit-fixes.test.js "spending cap rewrite (MetaMask style)…" + provider.test.js "PT-02…" |  |
| T-UX-003 | UX-02 | E2E | P1 | COVERED | apps/extension/test/e2e/browser.test.js (T-UX-003) | real built extension in Chromium: dApp requests approve(spender, 2^256-1); user edits the spend-limit field to 10; the transaction that reaches the chain decodes to approve(same spender, 10*10^18) |
| T-UX-004 | UX-03 | INT | P1 | COVERED | approval-preview.test.js (13 tests) |  |
| T-UX-005 | UX-04 | INT | P1 | COVERED | approval-scan.test.js (10 tests) |  |
| T-UX-006 | UX-04 | PERF | P2 | COVERED | approval-scan.test.js "pairs are de-duplicated and the scan is capped…" / "added tokens are checked … in ONE batched call" |  |
| T-UX-007 | UX-05 | UNIT | P0 | COVERED | audit-fixes.test.js "EVM recipients: bad mixed-case checksum rejected…" + addressBook.test.js "wallet-core accepts real addresses…" |  |
| T-UX-008 | UX-05 | SEC | P0 | COVERED | audit-fixes.test.js "send: lookalike (address poisoning) detection and plan fingerprint" + phase8.test.js "ScamSniffer lists…" |  |
| T-UX-009 | UX-05 | UNIT | P2 | COVERED | addressBook.test.js (6 tests) |  |
| T-UX-010 | UX-06 | PROP | P0 | COVERED | ux-sa-units.test.js "T-UX-010" + signing-units.test.js "T-SIG-028" | all converters 0..36 |
| T-UX-011 | UX-06 | UNIT | P1 | COVERED | settings.test.js "formatFiat…" (3 tests) | NaN not asserted (minor) |
| T-UX-012 | UX-06 | NEG | P0 | COVERED | internal/api/qa_unit_test.go TestFormatUnitsHostileDecimalsDoNotPanic | BUG-03 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-UX-013 | UX-06 | PROP | P1 | COVERED | qa_unit_test.go TestFormatUnitsMatchesBigRatProperty, TestFormatUnitsExact | new |
| T-UX-014 | UX-07 | UNIT | P1 | COVERED | tokens.test.js "hostile metadata is cleaned…" + nfts.test.js "spam heuristic" | backend SpamScore has no direct test |
| T-UX-015 | UX-08 | UNIT | P1 | COVERED | display-integrity.test.js (existing, T-DAPP-045) + ux-sa-units.test.js "T-UX-024 / T-UX-015" |  |
| T-UX-016 | UX-09 | UNIT | P0 | COVERED | swap.test.js "safety: …" (8 tests) |  |
| T-UX-017 | UX-09 | UNIT | P0 | COVERED | swap.test.js "safety: bridge calls (BridgeData) are decoded…" |  |
| T-UX-018 | UX-09 | UNIT | P0 | COVERED | audit-fixes.test.js "solana: lookup tables resolve and the swap guard refuses authority changes…" |  |
| T-UX-019 | UX-09 | PROP | P1 | COVERED | ux-sa-units.test.js "T-UX-019" | fuzz |
| T-UX-020 | UX-10 | UNIT | P1 | COVERED | chain-data.test.js "gas: EIP-1559 tiers from feeHistory percentiles, legacy single tier" |  |
| T-UX-021 | UX-11 | UNIT | P1 | COVERED | qa_unit_test.go TestFriendlyChainErrorMapping | new |
| T-SA-001 | SA-01 | UNIT | P0 | COVERED | smart-account-core.test.js "pinned constants…" + smart-account-guard.test.js "every smart account chain has its own explicit limits entry…" |  |
| T-SA-002 | SA-02 | UNIT | P0 | COVERED | smart-account-guard.test.js "intent: …" (3 tests) + "red-team finding 2…" |  |
| T-SA-003 | SA-03 | UNIT | P0 | COVERED | smart-account-guard.test.js "delegation state: none, pinned, other…" |  |
| T-SA-004 | SA-04 | UNIT | P0 | COVERED | smart-account-guard.test.js "sponsor reply…", "gas limits, fee and nonce over the bounds are refused", "max fee is every gas limit x maxFeePerGas…" |  |
| T-SA-005 | SA-04 | PROP | P0 | COVERED | ux-sa-units.test.js "T-SA-005" | property both SA chains, unpinned paymaster |
| T-SA-006 | SA-05 | INT | P0 | COVERED | smart-account-service.test.js "approve needs a fresh re-auth… signs a self-sent type-4 that recovers to the account" |  |
| T-SA-007 | SA-05 | SEC | P0 | COVERED | smart-account-guard.test.js "freshness: a prepared operation expires after 2 minutes…" + smart-account-service.test.js "fails closed…" |  |
| T-SA-008 | SA-06 | INT | P0 | COVERED | smart-account-send.test.js (13 tests) |  |
| T-SA-009 | SA-06 | UNIT | P0 | COVERED | smart-account-send.test.js "verifyInclusion…", "a receipt that is not for this operation is a mismatch…" |  |
| T-SA-010 | SA-07 | UNIT | P1 | COVERED | provider.test.js "5792 normalizer: strict fields, caps, sizes, chain and from binding" |  |
| T-SA-011 | SA-07 | INT | P1 | COVERED | provider.test.js "5792 sendCalls: one approval…", "5792 capabilities…" |  |
| T-SA-012 | SA-07 | SEC | P0 | COVERED | provider.test.js "5792: methods answer 4200 while the flag is off…", "7715: methods answer 4200…" |  |
| T-SA-013 | SA-08 | UNIT | P0 | COVERED | smart-account-permissions.test.js "unlimited, zero, expired, over 30 days, unknown fields…" |  |
| T-SA-014 | SA-08 | SEC | P0 | COVERED | smart-account-grant-store.test.js "a site reads only its own grants…" + provider.test.js "7715: … a site reads back only its own grants" |  |
| T-SA-015 | SA-09 | INT | P1 | COVERED | apps/extension/test/smart-account-send.test.js (existing) | sendOperation returns sponsored true/false from the actual paymaster reply and falls back to user-paid on refusal. UI label is derived from the gasless flag, not from the reply: see OBS-16. |
| T-SA-016 | SA-10 | UNIT | P0 | COVERED | policy.test.js "smart accounts need the remote flag…" |  |
| T-SA-017 | SA-02..09 | E2E | P2 | MISSING | — |  |
| T-CH-001 | CH-01 | CON | P1 | COVERED | apps/extension/test/qa/chains-contract.test.js (2) | chains.yaml read with js-yaml vs chainList.gen.ts and the registry: ids, chain ids, indexed=sources, testnet flags, testnets unpriced, all enabled+served |
| T-CH-002 | CH-01 | UNIT | P1 | COVERED | chains.test.js (needs ../../../research data) + harbour-chains.test.js | ENV-DEPENDENT |
| T-CH-003 | CH-02 | UNIT | P1 | COVERED | networks.test.js "field validation", "duplicates are rejected, edits are not" |  |
| T-CH-004 | CH-02 | INT | P1 | COVERED | networks.test.js "RPC probe requires a JSON-RPC answer with the same chain id" + audit-fixes.test.js "site-supplied RPC probe: https only…" |  |
| T-CH-005 | CH-03 | UNIT | P1 | COVERED | tokens.test.js (probe tests: valid, no contract, not a token, bytes32, dead node, bad input) |  |
| T-CH-006 | CH-03 | INT | P1 | COVERED | apps/extension/test/qa/tokens-networks.test.js "T-CH-006" | 100 manual tokens persist across lock/unlock, case-insensitive upsert, 101st refused, remove frees a slot, not in clear storage, invalid input refused |
| T-CH-007 | CH-04 | INT | P1 | COVERED | runtime-network-review.test.js "coalescer: concurrent and back-to-back callers share one run…" | asserted on the coalescer, not via getBalances handler |
| T-CH-008 | CH-04 | SEC | P1 | COVERED | harbour.test.js "HW-014: schema guards reject malformed or foreign-address responses" |  |
| T-CH-009 | CH-05 | INT | P0 | COVERED | e2e/fullstack.test.js "T-CH-009 / T-UX-028" | quote→submit→API broadcast→chain |
| T-CH-010 | CH-05 | NEG | P0 | COVERED | e2e/fullstack.test.js "T-CH-010" | stale/insufficient/unknown chain/locked |
| T-CH-011 | CH-05 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-CH-011" | popup Send UI: confirm amount/to/fee, hash shown = chain tx, value exact |
| T-CH-012 | CH-06 | INT | P0 | COVERED | harbour.test.js "RPC proxy: reads are signed, eth_sendRawTransaction becomes /v1/tx broadcast…" + runtime-network-review.test.js "RPC: unknown_chain falls back…" + defi-broadcast.test.js |  |
| T-CH-013 | CH-06 | CON | P0 | COVERED | apps/extension/test/qa/canonical-golden.test.js "T-CH-013" + e2e/fullstack.test.js (live API accepts every signed request) | shared Go goldens (4 vectors incl. unicode/lowercase method) |
| T-CH-014 | CH-07 | RES | P1 | COVERED | failover.test.js (5 tests) |  |
| T-CH-015 | CH-07 | UNIT | P2 | COVERED | apps/extension/test/qa/failover-timing.test.js (3) + locale-format.test.js (regex) | fake clock, node that answers after 15 s: normal call cut off at 10 s and moved to the next endpoint; getSupply/getProgramAccounts wait and succeed; slow methods cut off at 30 s (mutation 30 s -> 10 s fails 2 tests) |
| T-DEFI-001 | DEFI-01 | INT | P0 | COVERED | apps/extension/test/qa/swap-flow.test.js (2 tests) | fake gateway LI.FI + ERC-20 ledger: approve exact amount to Diamond, fresh stepTransaction validated, broadcast decoded, status success; forged spender/receiver/target/amount/chain/value/min refused unsigned |
| T-DEFI-002 | DEFI-01/UX-09 | SEC | P0 | COVERED | swap.test.js "safety: router must be the LI.FI Diamond and calldata must pay us" et al. |  |
| T-DEFI-003 | DEFI-01 | UNIT | P1 | COVERED | swap.test.js "slippage helpers clamp and normalise", "CTA resolution…", "price impact severity…" |  |
| T-DEFI-004 | DEFI-01 | UNIT | P2 | COVERED | swap-providers.test.js "dust picker keeps priced non-native balances…" |  |
| T-DEFI-005 | DEFI-01 | RES | P1 | COVERED | swap-flow.test.js "T-DEFI-005" + "T-DEFI-001: unlimited..." (expired route) | 429/500/no routes → plain error, no routes; a route older than expiresAt+5 min refused |
| T-DEFI-006 | DEFI-02 | INT | P1 | COVERED | apps/extension/test/qa/earn-flow.test.js (7) | Mock-chain success paths: Cosmos stake/unstake/claim/max, refusals (bad validator, minimum, over balance, no rewards, same destination), node rejection; TRON freeze+vote with 2 broadcasts, claim/unstake summaries, rejection. Other families: family-verify + signing-units + defi-failure-matrix; EVM in e2e keys-lifecycle. |
| T-DEFI-007 | DEFI-02 | NEG | P1 | COVERED | staking.test.js "amount parsing", "cosmos message builder validation" |  |
| T-DEFI-008 | DEFI-03 | INT | P1 | COVERED | testnet-defi.test.js (12 tests) + testnet-defi-handlers.test.js (7 tests) |  |
| T-DEFI-009 | DEFI-03 | SEC | P0 | COVERED | testnet-defi-handlers.test.js "worker blocks unsupported network, RPC mismatch, disabled features…" |  |
| T-DEFI-010 | DEFI-04 | KAT | P1 | COVERED | hyperliquid-golden.test.js + phase7.test.js "Hyperliquid L1 (agent) signing matches the Python SDK vectors" |  |
| T-DEFI-011 | DEFI-05 | KAT | P1 | COVERED | polymarket-golden.test.js "order matches the official client" + phase7.test.js |  |
| T-DEFI-012 | DEFI-06 | UNIT | P1 | COVERED | ramps.test.js (13 tests) + ramps-fund.test.js |  |
| T-DEFI-013 | DEFI-06 | SEC | P1 | COVERED | tokens-networks.test.js "T-DEFI-013" | plan expectation revised to the documented design (publishable keys, stored unencrypted): secret/junk formats refused, UI sees masked previews only, clear, tampered storage re-validated |
| T-DEFI-014 | DEFI-07 | UNIT | P2 | COVERED | settings.test.js "mapRates…", phase6.test.js market tests |  |
| T-DEFI-015 | DEFI-08 | SEC | P1 | COVERED | security-2026-11-18.test.js "SEC-05…" (2 tests) |  |
| T-DEFI-016 | DEFI-08 | INT | P1 | COVERED | nfts.test.js "EVM NFT transfer plans…", send.test.js "NFT ERC-721: ownership is checked…" |  |
| T-DATA-001 | DATA-01 | UNIT | P1 | COVERED | activityEngine.test.js (6 tests) + activityFeed.test.js (4 tests) + eip7708.test.js |  |
| T-DATA-002 | DATA-01 | RES | P1 | COVERED | e2e/fullstack.test.js "T-DATA-002" | broadcast tap → pending → alarm → confirmed |
| T-DATA-003 | DATA-02 | INT | P2 | COVERED | runtime-network-review.test.js "Arbitrum Sepolia and Polygon Amoy history use Etherscan V2…" |  |
| T-DATA-004 | DATA-03 | INT | P1 | COVERED | e2e/fullstack.test.js "T-DATA-004 / T-DATA-017" + e2e/quota.test.js | add/remove sync against real API; quota path BUG-10 |
| T-DATA-005 | DATA-04 | INT | P2 | COVERED | runtime-network-review.test.js "realtime URL: a deployed API may not hand out a temporary tunnel…" + harbour.test.js "API and realtime URLs…" | only-while-UI-open not asserted (minor) |
| T-DATA-006 | DATA-05 | INT | P0 | COVERED | apps/extension/test/e2e/fullstack.test.js "T-DATA-006" | real Go API, non-extractable key, PoW, /v1/me |
| T-DATA-007 | DATA-05 | SEC | P0 | COVERED | harbour.test.js "a server-chosen proof-of-work difficulty above the cap is refused" | negative/non-integer not asserted (minor) |
| T-DATA-008 | DATA-05 | SEC | P0 | COVERED | harbour.test.js "only device_unknown re-registers; a revoked device keeps its key" |  |
| T-DATA-009 | DATA-05 | CONC | P1 | COVERED | e2e/fullstack.test.js "T-DATA-009 / T-DATA-010" | 10 concurrent → 1 registration (real API) |
| T-DATA-010 | DATA-05 | MIG | P1 | COVERED | e2e/fullstack.test.js "T-DATA-009 / T-DATA-010" | legacy record wiped |
| T-DATA-011 | DATA-05 | KAT | P0 | COVERED | canonical-golden.test.js "T-DATA-011" | shared PoW goldens |
| T-DATA-012 | DATA-06 | SEC | P1 | COVERED | harbour.test.js "HW-014: schema guards reject malformed or foreign-address responses" |  |
| T-BE-001 | BE-01 | SEC | P0 | COVERED | internal/api TestSecurityHeaders |  |
| T-BE-002 | BE-01 | NEG | P1 | COVERED | apps/backend/internal/api/qa_unit2_test.go TestQABodyLimitBeforeSignatureWork | 413 before lookup (nil store proves it) |
| T-BE-003 | BE-01 | SEC | P1 | COVERED | qa_unit2_test.go TestQARecovererHidesPanics | real handler panic |
| T-BE-004 | BE-01 | SEC | P1 | COVERED | qa_unit2_test.go TestQALogsCarryNoIdentifiers | route pattern only |
| T-BE-005 | BE-02 | RES | P1 | COVERED | qa_integration2_test.go TestQAHealthzDependencyDown | Redis unreachable |
| T-BE-006 | BE-03 | INT | P0 | COVERED | qa_integration_test.go TestQAChallengeShapeAndStorage | new |
| T-BE-007 | BE-03 | NEG | P0 | COVERED | qa_integration_test.go TestQAChallengeLimitPerAddress + TestClientIPGroupsIPv6By64 | strengthened |
| T-BE-008 | BE-04 | INT | P0 | COVERED | internal/api TestDeviceFlow (registration) |  |
| T-BE-009 | BE-04 | NEG | P0 | COVERED | qa_integration_test.go TestQARegistrationRejectsMalformed | strengthened |
| T-BE-010 | BE-04 | NEG | P1 | COVERED | internal/api TestDeviceFlow "duplicate key" 409 |  |
| T-BE-011 | BE-04 | SEC | P0 | COVERED | internal/api TestRegistrationCeilingNeedsProofOfWork |  |
| T-BE-012 | BE-04 | CONC | P1 | COVERED | qa_integration2_test.go TestQAChallengeSingleUseUnderRace | 8 parallel → 1 |
| T-BE-013 | BE-05 | UNIT | P1 | COVERED | internal/api TestEffectiveTierProbation |  |
| T-BE-014 | BE-06 | INT | P0 | COVERED | internal/api TestDeviceFlow (/v1/me) |  |
| T-BE-015 | BE-06 | SEC | P0 | COVERED | qa_integration_test.go TestQASignedRequestTampering | strengthened |
| T-BE-016 | BE-06 | SEC | P0 | COVERED | internal/api TestReplayRejected |  |
| T-BE-017 | BE-06 | SEC | P0 | COVERED | qa_integration_test.go TestQARevokedDeviceRefusedAfterCacheWindow | new |
| T-BE-018 | BE-06 | SEC | P0 | COVERED | internal/api TestFailedAuthIsLimitedPerClient (unknown devices) |  |
| T-BE-019 | BE-06 | NEG | P0 | COVERED | internal/api TestFailedAuthIsLimitedPerClient |  |
| T-BE-020 | BE-06 | SEC | P1 | COVERED | qa_unit2_test.go TestQAAuthFailuresBounded | 50k cap, per-client, minute roll |
| T-BE-021 | BE-06 | KAT | P0 | COVERED | apps/backend/internal/devicesig/devicesig_test.go TestCanonicalMatchesIndependentGoldenVectors, TestVerifyRFC8032Test1, TestVerifyRejectsMalformedInputs | new (Phase 4) |
| T-BE-022 | BE-06 | PROP | P0 | COVERED | devicesig_test.go TestSignVerifyPropertyAndSingleByteMutation | new |
| T-BE-023 | BE-06 | PROP | P1 | COVERED | devicesig_test.go FuzzVerify | new |
| T-BE-024 | BE-07 | INT | P1 | COVERED | qa_integration2_test.go TestQARequestRateLimitExact | exact |
| T-BE-025 | BE-07 | UNIT | P1 | COVERED | qa_integration2_test.go TestQABackfillBudget | rollback + TTL once |
| T-BE-026 | BE-08 | INT | P0 | COVERED | internal/api TestDeviceFlow (Idempotency-Key replay) |  |
| T-BE-027 | BE-08 | NEG | P0 | COVERED | qa_integration_test.go TestQAIdempotencyMisuse | new |
| T-BE-028 | BE-08 | RES | P0 | COVERED | qa_integration_test.go TestQAIdempotencyKeyReleasedAfterRetryableFailure | new |
| T-BE-029 | BE-08 | SEC | P0 | COVERED | internal/api TestScrubBroadcast + TestSendCountersDoNotStoreDeviceIDs |  |
| T-BE-030 | BE-09 | SEC | P1 | COVERED | qa_unit2_test.go TestQALogsCarryNoIdentifiers | security events tags only |
| T-BE-031 | BE-10/11 | CON | P1 | COVERED | qa_integration2_test.go TestQAMeContract | field kinds |
| T-BE-032 | BE-12 | INT | P0 | COVERED | internal/api TestDeviceFlow (addresses, deny-list, link encryption "plain" check, tracked rows) |  |
| T-BE-033 | BE-12 | NEG | P0 | COVERED | qa_integration_test.go TestQAPutAddressesValidation | strengthened |
| T-BE-034 | BE-12 | SEC | P0 | COVERED | qa_integration_test.go TestQAQuotaExceededRollsBack | strengthened |
| T-BE-035 | BE-12 | NEG | P1 | COVERED | qa_integration_test.go TestQAPutAddressesIsAtomic | BUG-01 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-BE-036 | BE-12 | CONC | P0 | COVERED | qa_integration_test.go TestQAConcurrentAddsRespectQuota | new |
| T-BE-037 | BE-12 | NEG | P1 | COVERED | qa_integration2_test.go TestQABackfillBudget | deny-list not charged |
| T-BE-038 | BE-13 | INT | P0 | COVERED | internal/api TestDeviceFlow (rpc forwarded with X-HB-Priority user) |  |
| T-BE-039 | BE-13 | SEC | P0 | COVERED | qa_integration_test.go TestQARPCRefusals | strengthened |
| T-BE-040 | BE-13 | SEC | P0 | COVERED | qa_unit_test.go TestFilteredLogsRejectsNestedEmptyTopics + qa_integration_test.go TestQARPCNestedNullTopicsForwarded | BUG-02 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-BE-041 | BE-13 | SEC | P1 | COVERED | internal/api TestStripGatewayInternals |  |
| T-BE-042 | BE-13 | NEG | P1 | COVERED | qa_integration2_test.go TestQARPCGatewayFailures | 8 MiB+ answer |
| T-BE-043 | BE-13 | RES | P1 | COVERED | qa_integration2_test.go TestQARPCGatewayFailures | gateway down |
| T-BE-044 | BE-13 | NEG | P1 | COVERED | qa_integration2_test.go TestQARPCGatewayFailures | batch counts per call |
| T-BE-045 | BE-13 | PROP | P0 | COVERED | qa_integration2_test.go TestQAHandleRPCRandomBodies | seeded property, 306 bodies |
| T-BE-046 | BE-14..18 | SEC | P0 | COVERED | internal/api TestReadScreensMakeNoRPCCalls ("Addresses a device doesn't track are refused") |  |
| T-BE-047 | BE-14 | INT | P1 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (portfolio totals, thin-liquidity and spam not priced, cached second call) |  |
| T-BE-048 | BE-14 | SEC | P1 | COVERED | qa_integration2_test.go TestQAPortfolioCacheIsPerDevice | no bleed |
| T-BE-049 | BE-16 | INT | P1 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (history paging, no duplicates, newest first) |  |
| T-BE-050 | BE-16 | NEG | P1 | COVERED | qa_integration2_test.go TestQAReadRouteValidation | 3 bad cursors |
| T-BE-051 | BE-16 | PROP | P2 | COVERED | qa_unit2_test.go TestQACursorRoundTrip | 500 cursors + malformed |
| T-BE-052 | BE-17 | INT | P2 | COVERED | apps/backend/internal/api/qa_integration3_test.go TestQANFTsDirtyFlagRequestsSync | dirty list → one nfts.sync per minute for 3 reads, syncing flag, /v1/media URLs only, spam without image, clean list not syncing |
| T-BE-053 | BE-18 | NEG | P2 | COVERED | qa_integration2_test.go TestQAReadRouteValidation + TestQAChartRangeDefault | OBS-04 |
| T-BE-054 | BE-19 | SEC | P0 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (SEC-2026-11-18-02 block) |  |
| T-BE-055 | BE-19 | SEC | P0 | COVERED | qa_integration_test.go TestQAPendingTxNotRevealedToOtherDevice | new |
| T-BE-056 | BE-19 | NEG | P1 | COVERED | qa_unit_test.go TestTxHashFormat | new |
| T-BE-057 | BE-20 | INT | P0 | COVERED | internal/api TestSendRealtimePush (estimate) | only one chain type; +20 % / 21000 rule not asserted |
| T-BE-058 | BE-20 | NEG | P0 | COVERED | qa_integration_test.go TestQAEstimateValidation | strengthened |
| T-BE-059 | BE-20 | RES | P1 | COVERED | qa_integration2_test.go TestQAEstimateFallbacks | would_fail |
| T-BE-060 | BE-21 | INT | P1 | COVERED | apps/backend/internal/api/qa_integration3_test.go TestQASimulateModes | stub simulator: full mode with formatted amounts (unknown decimals unformatted), reverted message, ErrUnsupported silent basic, error → basic + warn |
| T-BE-061 | BE-22 | INT | P0 | COVERED | internal/api TestSendRealtimePush (broadcast, pending row, realtime, push) |  |
| T-BE-062 | BE-22 | SEC | P0 | COVERED | qa_integration_test.go TestQABroadcastRefusesUnsafeTransactions | strengthened |
| T-BE-063 | BE-22 | RES | P1 | COVERED | qa_integration2_test.go TestQABroadcastNodeAnswers | already known |
| T-BE-064 | BE-22 | SEC | P1 | COVERED | qa_integration2_test.go TestQABroadcastNodeAnswers | local hash wins |
| T-BE-065 | BE-22 | RES | P1 | COVERED | qa_integration3_test.go TestQABroadcastRetryAfterPendingInsertFailure | one-shot trigger failure on pending insert → 500 retryable (no internals); same Idempotency-Key → already known → 200, one row |
| T-BE-066 | BE-22 | NEG | P1 | COVERED | qa_integration2_test.go TestQABroadcastNodeAnswers | 11th limited |
| T-BE-067 | BE-23 | SEC | P0 | COVERED | internal/api TestSendRealtimePush ("Realtime tokens cover the balance channel and the pending tx") | JWT aud/exp not asserted |
| T-BE-068 | BE-23 | KAT | P1 | COVERED | qa_unit2_test.go TestQASignHS256MatchesIndependentJWT | RFC 7515 A.1 key |
| T-BE-069 | BE-25 | SEC | P0 | COVERED | internal/api TestKnownPushHost | b64 length checks not asserted (minor) |
| T-BE-070 | BE-25 | INT | P1 | COVERED | qa_integration3_test.go TestQAPushRoutesFollowAddresses | routes = tracked addresses, resync on +/-, keyed tags (no plain address), DELETE removes sub + routes, no routes without sub |
| T-BE-071 | BE-26 | SEC | P0 | COVERED | internal/api TestMediaProxyBlocksPrivateAddresses |  |
| T-BE-072 | BE-26 | SEC | P0 | COVERED | internal/api TestMediaProxyBlocksPrivateAddresses ("even via redirects") |  |
| T-BE-073 | BE-26 | SEC | P0 | COVERED | qa_unit2_test.go TestQAMediaRefusesDangerousImages | SVG/HTML/10MiB+1/25Mpx PNG & GIF headers/WebP/private/URL schemes |
| T-BE-074 | BE-26 | UNIT | P1 | COVERED | internal/api TestReadScreensMakeNoRPCCalls (re-encoded image bounds) |  |
| T-BE-075 | BE-26 | NEG | P1 | COVERED | qa_integration2_test.go TestQAMediaRouteGuards | keys + per-IP limit |
| T-BE-076 | BE-26 | CONC | P2 | COVERED | qa_integration3_test.go TestQAMediaDisconnectAndConcurrency | 10 cold fetches: ≤4 upstream at once; others 200/503 |
| T-BE-077 | BE-26 | RES | P1 | COVERED | qa_integration3_test.go TestQAMediaDisconnectAndConcurrency | client disconnect → fetch completes, cached positively, one upstream hit |
| T-BE-078 | BE-26 | PROP | P1 | COVERED | qa_unit2_test.go FuzzQAFetchImage | go fuzz target + seeds |
| T-BE-079 | BE-27 | UNIT | P1 | COVERED | qa_unit_test.go TestNormalizeAddress | new |
| T-BE-080 | BE-28 | SEC | P0 | COVERED | internal/api TestRealIPOnlyTrustsProxies |  |
| T-BE-081 | BE-28 | UNIT | P1 | COVERED | internal/api TestClientIPGroupsIPv6By64 |  |
| T-BE-082 | BE-29 | UNIT | P1 | COVERED | internal/config TestLoadRepoConfig, TestEnabledChains, TestPublicUpstreamsAndAllChains | invalid configs only partly |
| T-BE-083 | BE-29 | SEC | P1 | COVERED | internal/config TestLoadSecretFiles, TestLoadSecretFilesIgnoresForeignVariables |  |
| T-BE-084 | BE-30 | SEC | P0 | COVERED | internal/store TestRequireTLS + deploy/postgres/initdb TestRequireTLSHBA |  |
| T-BE-085 | BE-31 | INT | P0 | COVERED | qa_integration2_test.go TestQAMigrateTwiceIsNoop + store/qa_db_test.go | second run no-op |
| T-BE-086 | BE-31 | NEG | P1 | COVERED | apps/backend/cmd/migrate/qa_migrate_test.go TestQAMigrateRequiresAppRoleUnlessAllowed | real binary, non-CREATEROLE owner, harbour_app held aside: exit≠0; HB_ALLOW_MISSING_APP_ROLE=1 → 0 + warning |
| T-BE-087 | BE-32 | UNIT | P3 | COVERED | apps/backend/internal/hbclient/qa_canon_test.go (+ extension canonical-golden.test.js for the TS twin) | Green on the user machine. Go client signs the shared golden vectors (every line but the random nonce) and the server-side re-derivation verifies; TS side already green against the same files |
| T-BE-088 | BE-01..28 | PERF | P2 | COVERED | apps/backend/internal/api/qa_load_test.go | Green on the user machine, opt-in HB_QA_PERF=1: 200 rps signed GET /v1/me for 30 s over 40 devices; zero non-200, p99 < 100 ms, goroutines back to baseline. Run without -race |
| T-BE-089 | BE-04 | PERF | P3 | COVERED | apps/backend/internal/devicesig/qa_pow_test.go + apps/extension/test/qa/pow-perf.test.js | JS half green (3 solves at difficulty 20, median < 10 s). Go half green on the user machine: CheckPow constant-time, 14-bit solve, opt-in 20-bit solve |
| T-BE-090 | BE-01..28 | CON | P1 | COVERED | qa_unit2_test.go TestQAErrorShape | shape + no Go text |
| T-GW-001 | GW-01 | INT | P1 | COVERED | qa_integration2_test.go TestQAGatewayQuota | 429 |
| T-GW-002 | GW-02 | UNIT | P2 | COVERED | qa_unit2_test.go TestQAGatewayConfigRoute | shared golden with extension |
| T-GW-003 | GW-03 | UNIT | P1 | COVERED | internal/api TestGatewayPricesShapeAndCache |  |
| T-GW-004 | GW-04 | NEG | P1 | COVERED | qa_unit2_test.go TestQAGatewayPlanRefusals | plan cases |
| T-GW-005 | GW-05 | SEC | P1 | COVERED | internal/api TestCleanQuery + TestGatewayRejectsUnlistedRoutes |  |
| T-GW-006 | GW-06 | NEG | P2 | COVERED | qa_unit2_test.go TestQAGatewayPlanRefusals | plan cases |
| T-GW-007 | GW-07 | SEC | P0 | COVERED | internal/api TestGatewayInjectsKeysAndScrubsEchoes + TestGatewayRejectsUnlistedRoutes |  |
| T-GW-008 | GW-08 | SEC | P0 | COVERED | internal/api TestGatewayUniswapRoute |  |
| T-GW-009 | GW-09 | NEG | P1 | COVERED | internal/api TestGatewayJupiterTokenSearchRejectsAbuse |  |
| T-GW-010 | GW-10 | NEG | P1 | COVERED | qa_unit2_test.go TestQAGatewayPlanRefusals | plan cases |
| T-GW-011 | GW-11 | SEC | P0 | COVERED | internal/api TestGatewayHeliusProgramAccountsOnlyOwnStakeAccounts |  |
| T-GW-012 | GW-12 | SEC | P0 | COVERED | internal/api TestJSONRPCGuardRejectsParserDifferentials, TestGatewayRPCRoutesRefuseTheDifferentialBody, TestGatewayAlchemyBroadcastAndLogsPolicy, TestGatewayRPCCannotBeSteeredPastTheAllowlist |  |
| T-GW-013 | GW-12 | INT | P1 | COVERED | internal/api TestGatewayRPCCannotBeSteeredPastTheAllowlist (Ethereum via rpc-gateway) |  |
| T-GW-014 | GW-13 | NEG | P1 | COVERED | qa_unit2_test.go TestQAGatewayPlanRefusals | plan cases |
| T-GW-015 | GW-14 | SEC | P0 | COVERED | internal/api TestGatewayEtherscanSetsServerKeyAndIgnoresCallerKey |  |
| T-GW-016 | GW-15 | NEG | P1 | COVERED | qa_unit2_test.go TestQAGatewayPlanRefusals | plan cases |
| T-GW-017 | GW-16 | SEC | P0 | COVERED | internal/api TestGatewayPimlicoUnpinnedSponsorTestnetOnly |  |
| T-GW-018 | GW-16 | SEC | P0 | COVERED | internal/api TestGatewayPimlicoPinsSponsorPolicy |  |
| T-GW-019 | GW-16 | NEG | P1 | COVERED | internal/api TestGatewayPimlicoPinsSponsorPolicy (invalid policy → refused) |  |
| T-GW-020 | GW-17 | PROP | P0 | COVERED | qa_unit_test.go FuzzJSONRPCClean | new |
| T-GW-021 | GW-18 | PROP | P0 | COVERED | qa_unit_test.go FuzzCanonLogFilter | new |
| T-GW-022 | GW-19 | SEC | P0 | COVERED | internal/api TestGatewayInjectsKeysAndScrubsEchoes |  |
| T-GW-023 | GW-19 | RES | P1 | COVERED | internal/api TestGatewayUpstreamAuthFailureIsBadGateway |  |
| T-GW-024 | GW-19 | RES | P1 | COVERED | qa_unit2_test.go TestQAGatewayUpstreamFailures | cap, 500 text, timeout |
| T-GW-025 | GW-19 | INT | P1 | COVERED | internal/api TestGatewayPricesShapeAndCache (hits/cache) | unit-level fake cache, not Redis |
| T-GW-026 | GW-* | CON | P1 | COVERED | qa_unit2_test.go TestQAGatewayRouteMatrix + TestQAWrongMethod405 | resolver × GET/POST, router × others |
| T-IDX-001 | IDX-01 | SEC | P0 | COVERED | internal/gateway/qa_server_test.go TestQAGatewayRoutesRequireBearerToken | new |
| T-IDX-002 | IDX-01 | SEC | P1 | COVERED | qa_server_test.go TestQAGatewayEmptyTokenHandlerIsOpen (handler contract; refusal to start lives in cmd/rpc-gateway/main.go:33-36) | partial: main not exec-tested |
| T-IDX-003 | IDX-02 | UNIT | P1 | COVERED | internal/gateway TestBlockLagRouting, TestStickySession |  |
| T-IDX-004 | IDX-03 | RES | P1 | COVERED | internal/gateway TestHedgingOnlyForUserFacing, TestProviderOutageUnderLoad |  |
| T-IDX-005 | IDX-04 | UNIT | P1 | COVERED | apps/backend/internal/gateway/qa_unit_test.go TestQABreakerTransitions | all transitions with explicit clock |
| T-IDX-006 | IDX-05 | UNIT | P0 | COVERED | internal/gateway TestFinalizedAndLatestCaching |  |
| T-IDX-007 | IDX-05 | PROP | P1 | COVERED | gateway/qa_unit_test.go FuzzQAParseBlockRef | go fuzz + seeds |
| T-IDX-008 | IDX-05 | UNIT | P2 | COVERED | internal/gateway TestCacheBoundedByBytes |  |
| T-IDX-009 | IDX-06 | CONC | P1 | COVERED | internal/gateway TestCoalescedReads | copy-independence not asserted |
| T-IDX-010 | IDX-07 | RES | P0 | COVERED | internal/gateway TestBroadcastFanoutAndAlreadyKnown |  |
| T-IDX-011 | IDX-08 | UNIT | P1 | COVERED | internal/gateway TestGetLogsSplit |  |
| T-IDX-012 | IDX-09 | RES | P1 | COVERED | internal/gateway TestHeadFollowerOnly, TestHeadPollIsBatched, TestLocalAnswers |  |
| T-IDX-013 | IDX-10 | UNIT | P1 | COVERED | rpchttp/qa_unit_test.go TestQABuildURLAndParseQuantity | no key in errors |
| T-IDX-014 | IDX-11 | INT | P0 | COVERED | internal/indexer TestNewWalletMatchesChain, TestCappedBackfillAndOlderPages, TestDormantAddressAndLazyNFTs | failing-source path not asserted |
| T-IDX-015 | IDX-11 | CONC | P0 | COVERED | qa_db_test.go TestQAClaimBackfillConcurrent | new |
| T-IDX-016 | IDX-12 | INT | P0 | COVERED | internal/store TestIngestEventsBatched + internal/indexer TestLivePath |  |
| T-IDX-017 | IDX-12 | NEG | P0 | COVERED | qa_linkcrypto_test.go TestValidAmount | new (unit level of the ingest guard) |
| T-IDX-018 | IDX-12 | PROP | P1 | COVERED | apps/backend/internal/store/qa_ingest_prop_test.go TestQAIngestProjectionProperty | 200 random events (amounts to 2^200, native+tokens), each sent twice, shuffled, 37-event batches: rows = unique events, per-address net = oracle exactly, one activity row per (address, tx) |
| T-IDX-019 | IDX-13 | UNIT | P2 | COVERED | apps/backend/internal/indexer/qa_debounce_test.go (8) | Green on the user machine. Burst coalescing with merged refs, per-id windows, fresh second window, window extension, Flush now and waits, cancelled ctx, concurrency cap 8. Real short timers, not a fake clock (the debouncer uses time.AfterFunc) |
| T-IDX-020 | IDX-14 | SEC | P1 | COVERED | store/qa_mediakey_test.go TestQAMediaKeyKeyed | independent HMAC |
| T-IDX-021 | IDX-15 | INT | P1 | COVERED | internal/indexer TestLivePath + adapters/sources/alchemy TestNotifyAPI |  |
| T-IDX-022 | IDX-16 | INT | P1 | COVERED | internal/indexer TestLivePath |  |
| T-IDX-023 | IDX-17 | INT | P1 | COVERED | internal/store TestGapFillScopes, TestLastHeartbeatAndGapRowFor | ingest Start publish not asserted |
| T-IDX-024 | IDX-18 | INT | P0 | COVERED | apps/backend/internal/indexer/qa_repair_test.go TestQARepairConfirmationsHoldAndFinality + live_test.go TestLivePath | 3-confirmation removal, younger mismatch kept and holds finality, re-mined tx moved, balance refreshed, finalized only up to verified block |
| T-IDX-025 | IDX-19 | UNIT | P1 | COVERED | apps/backend/internal/indexer/qa_spam_test.go TestQASpamScore | real tokens < 50; URL/airdrop/telegram/no-decimals/empty ≥ 50; look-alike and long symbols score higher; 20k random inputs in 0..100; zero-width alone = 40 (OBS-09) |
| T-IDX-026 | IDX-20 | SEC | P0 | COVERED | internal/ingest/ingest_test.go TestDeliveryAuthentication | new (package had no tests) |
| T-IDX-027 | IDX-20 | SEC | P0 | COVERED | ingest_test.go TestStaleDeliveryNotPublished | new |
| T-IDX-028 | IDX-20 | RES | P1 | COVERED | ingest_test.go TestPublishFailureIsRetryable | new |
| T-IDX-029 | IDX-20 | KAT | P1 | COVERED | adapters/sources/alchemy TestVerifyWebhook |  |
| T-IDX-030 | IDX-20 | PROP | P1 | COVERED | apps/backend/adapters/sources/alchemy/qa_fuzz_test.go FuzzQAWebhookParsing | WebhookID/VerifyWebhook/ParseWebhook: no panic (444k execs, 20 s); parsed amounts non-negative integers, 0x hashes |
| T-IDX-031 | IDX-21 | INT | P1 | COVERED | apps/backend/internal/txtrack/qa_txtrack_test.go TestQATrackerOutcomes | confirmed/failed published with block+from; not found → block-time backoff; RPC error → 15 s; aged → dropped; unknown chain dropped unpublished; replaced nonce → dropped after 3 checks; settled never re-checked |
| T-IDX-032 | IDX-22 | UNIT | P1 | COVERED | notifier/qa_unit_test.go TestQANotificationTextHelpers + TestQADisplayAmountHostileDecimals (xfail BUG-03) |  |
| T-IDX-033 | IDX-22 | RES | P1 | COVERED | adapters/notify/webpush TestSend | 410 cleanup covered in adapter |
| T-IDX-034 | IDX-23 | INT | P1 | COVERED | internal/prices TestPoller + adapters/prices TestQuotes |  |
| T-IDX-035 | IDX-24 | INT | P2 | COVERED | internal/api TestSendRealtimePush (Centrifugo publishes) |  |
| T-IDX-036 | IDX-25 | INT | P1 | COVERED | apps/backend/internal/events/qa_events_test.go TestQABusAtLeastOnceAndDurableResume | embedded JetStream: handler error → redelivered, durable consumer resumes with only new messages, acked not redelivered |
| T-IDX-037 | IDX-26 | CON | P1 | COVERED | contracttest TestSuitesAgainstFakes + adapters/*/TestContract |  |
| T-IDX-038 | IDX-27 | UNIT | P2 | COVERED | ratelimit/qa_unit_test.go TestQAWaitCancelAndUnlimited |  |
| T-IDX-039 | IDX-28 | KAT | P0 | COVERED | internal/evmtx TestDecode, TestSender, TestType4DecodeAndSender + qa_test.go TestEIP155ExampleKnownAnswer | strengthened |
| T-IDX-040 | IDX-28 | NEG | P0 | COVERED | internal/evmtx/qa_test.go TestDecodeAndSenderRefuseMalformed, TestSenderRefusesInvalidRecoveryID | new |
| T-IDX-041 | IDX-28 | PROP | P0 | COVERED | qa_test.go TestMutatedTransactionsNeverKeepSenderAndHash, FuzzDecodeSender | new |
| T-IDX-042 | IDX-28 | UNIT | P2 | COVERED | qa_test.go TestSenderAcceptsHighSTwin | documents ASM-12 |
| T-IDX-043 | IDX-28 | PROP | P1 | COVERED | qa_test.go TestRLPEncodeRoundTripProperty | new |
| T-IDX-044 | IDX-29 | KAT | P0 | COVERED | devicesig_test.go TestPowKnownAnswers, TestPowBoundaries | new |
| T-IDX-045 | IDX-29 | UNIT | P1 | COVERED | devicesig_test.go TestValidNonceBoundaries | new |
| T-IDX-046 | IDX-30 | SEC | P0 | COVERED | internal/store/qa_linkcrypto_test.go TestLinkCryptoSealOpenBinding | new |
| T-IDX-047 | IDX-30 | SEC | P0 | COVERED | qa_linkcrypto_test.go TestLinkCryptoTagsDomainSeparated | new |
| T-IDX-048 | IDX-30 | PROP | P1 | COVERED | qa_linkcrypto_test.go TestLinkCryptoRoundTripProperty | new |
| T-IDX-049 | IDX-30 | SEC | P1 | COVERED | qa_linkcrypto_test.go TestSecretBox | new |
| T-IDX-050 | IDX-11..24 | PERF | P2 | COVERED | apps/backend/internal/store/qa_perf_test.go | Green on the user machine, opt-in HB_QA_PERF=1: 10k addresses, 1M transfers, 1M activity rows; history page p95 9.5 ms, tx lookup p95 0.7 ms, ingest of 500 events 127 ms (duplicates 14 ms); plans use the indexes |
| T-IDX-051 | IDX-03 | PERF | P3 | COVERED | apps/backend/internal/gateway/qa_load_test.go | Green on the user machine, opt-in HB_QA_PERF=1: 1000 rps distinct eth_getBalance via the gateway handler to fake nodes; zero failures, median overhead < 5 ms vs direct, bounded goroutines |
| T-DB-001 | DB-21 | MIG | P0 | COVERED | internal/store/qa_db_test.go TestQAFreshSchemaHasEveryObject | strengthened |
| T-DB-002 | DB-21 | MIG | P1 | COVERED | qa_db2_test.go TestQAPartitioning | partman path asserted when available (both paths: run with/without pg_partman) |
| T-DB-003 | DB-21 | CONC | P0 | COVERED | qa_db_test.go TestQAConcurrentMigrate | new |
| T-DB-004 | DB-21 | RES | P0 | COVERED | qa_db_test.go TestQAFailedMigrationRollsBack | new |
| T-DB-005 | DB-20 | MIG | P0 | COVERED | qa_db_test.go TestQAMigration0010PreservesData | new |
| T-DB-006 | DB-20 | MIG | P1 | COVERED | qa_db2_test.go TestQAMigrations0007To0009Data | pseudo transfers/balances/spam/event_keys/summary |
| T-DB-007 | DB-20 | MIG | P1 | COVERED | qa_db2_test.go TestQAMigrations0007To0009Data | added_at truncation + default + role |
| T-DB-008 | DB-20 | MIG | P1 | COVERED | qa_db2_test.go TestQAMigrations0007To0009Data | dormant + nft_dirty per state |
| T-DB-009 | DB-20 | MIG | P2 | COVERED | apps/backend/internal/store/qa_db2_test.go TestQAMigrations0003And0004Data | data-preserving |
| T-DB-010 | DB-21 | MIG | P1 | COVERED | qa_db2_test.go TestQAForwardOnlyVersionTable | forward-only, version PK |
| T-DB-011 | DB-03 | INT | P0 | COVERED | qa_db_test.go TestQADeviceKeyConstraints | new |
| T-DB-012 | DB-04 | INT | P1 | COVERED | qa_db2_test.go TestQAConstraintViolationsNamed | unique/check/fk/key length |
| T-DB-013 | DB-05 | INT | P0 | COVERED | qa_db_test.go TestQADeviceDeleteCascades | new |
| T-DB-014 | DB-07/08 | INT | P1 | COVERED | qa_db2_test.go TestQAPartitioning | DEFAULT partition, AMB-16 error surfaced, rows kept |
| T-DB-015 | DB-17 | SEC | P1 | COVERED | qa_db_test.go TestQAServiceRoleIsLeastPrivilege (foreign table refused by SECURITY DEFINER helper) | new |
| T-DB-016 | DB-18 | PROP | P0 | COVERED | qa_db_test.go TestQARefCodecProperty + TestRefCodec | strengthened |
| T-DB-017 | DB-19 | SEC | P0 | COVERED | qa_db_test.go TestQAServiceRoleIsLeastPrivilege | new |
| T-DB-018 | DB-19 | SEC | P1 | COVERED | qa_db2_test.go TestQASecurityDefinerExposure | harbour_ensure_partition only (documented) |
| T-DB-019 | DB-22 | SEC | P0 | COVERED | qa_db_test.go TestQAEnsureAppLoginInputHandling | new |
| T-DB-020 | DB-10/12/13 | INT | P1 | COVERED | qa_db2_test.go TestQANumericBounds | max uint256 + 79 digits |
| T-DB-021 | DB-23 | INT | P2 | COVERED | internal/store TestPruneTimeSeries | deliveries/pending prune not asserted |
| T-DB-022 | DB-01..16 | PERF | P2 | COVERED | qa_db2_test.go TestQAHotQueriesUseIndexes | EXPLAIN with seqscan off |
| T-DB-023 | DB-05 | SEC | P0 | COVERED | qa_db_test.go TestQALinkTableResistsCorrelation | new |
| T-DB-024 | DB-14 | INT | P1 | COVERED | qa_db2_test.go TestQAInsertPendingDuplicate | idempotent |
| T-DB-025 | DB-01..23 | MIG | P1 | COVERED | qa_db2_test.go TestQASchemaGolden + testdata/schema.golden.sql | normalised pg_dump golden |
| T-X-001 | X-01 | PROP | P0 | COVERED | apps/extension/test/qa/amounts.prop.test.js (4) + apps/backend/internal/api/qa_amounts_test.go (2) | string oracle to 2^256-1 at 0..36 decimals; parse/format inverse; approve cap exact; static scan for Number() on amounts (5 reviewed exceptions); Go formatUnits exact, valueUSD within 1e-12 |
| T-X-002 | X-01 | UNIT | P1 | COVERED | apps/extension/test/qa/number-lint.test.js | allow-listed lint over src/core/** (outside chains/send): every Number()/parseFloat() on an amount-like value classified display/fiat/metadata; new hits and stale entries fail |
| T-X-003 | X-02 | UNIT | P1 | COVERED | apps/extension/test/qa/time-boundaries.test.js (2) + apps/backend/internal/api/qa_integration3_test.go TestQADailyCounterUTCMidnight + indexer_test partitions | TZ=America/New_York across spring-forward/fall-back: grants last real ms; lock alarm relative; backend daily budget resets at 00:00 UTC with server TZ=UTC+14 |
| T-X-004 | X-02 | NEG | P1 | COVERED | apps/backend/internal/api/qa_integration3_test.go TestQAClockSkewBoundary | fixed server clock: ±ClockSkew accepted, ±(ClockSkew+1 s) refused with an error code |
| T-X-005 | X-03 | UNIT | P2 | COVERED | apps/extension/test/qa/locale-format.test.js (5) | formatFiat in de/ja/zh-TW/ar/en + fallback, floor, signed; ar checked for directional marks and a single digit script; OBS-13 pinned |
| T-X-006 | X-04 | PROP | P1 | COVERED | apps/extension/test/qa/roundtrip.prop.test.js (2) + roundtrip-state.prop.test.js (5) | PendingStore + settled outcomes; any JSON state through passworder, sizes around the 32 KiB chunk and 1 MiB, VaultService save/lock/unlock with a staged keystore, wallet-core keystore export/import (mnemonic and private key), history cursors byte for byte |
| T-X-007 | X-05 | MIG | P0 | COVERED | apps/extension/test/qa/legacy-upgrade.test.js (2 tests) | v1 KDF+vault+keystore in storage.local, store v0, legacy passkey seal, perps agent under old key, pre-PT-06 WC session, auto-lock 0, raw-seed device: all upgraded at boot/unlock, nothing lost, artefacts removed |
| T-X-008 | X-06 | UNIT | P1 | COVERED | apps/extension/test/qa/flag-gating.test.js (3) | perps/predictions/smart-account handlers refuse in the handler with flag absent/false/non-boolean or venue killed (no venue/bundler call); control shows the flag on opens the gate; build flags covered by T-X-009/T-MSG-005 |
| T-X-009 | X-07 | SEC | P0 | COVERED | release-tooling.test.js "T-X-009" | apiUrlStatus matrix, vite.config throw, bundled policy HB_API_SECURE/mainnetSigningReady |
| T-X-010 | X-08 | SEC | P1 | WEAK | apps/extension/test/qa/supply-chain.test.js (2 tests) | npm audit gate behaviour with a fake npm + checked-in exceptions valid; govulncheck could not run (no network to golang.org / vuln DB in this environment) |
| T-X-011 | X-09 | CONC | P0 | COVERED | aggregate of T-KEY-019/023/052, T-BE-012/036, T-DB-003, T-IDX-009/015, T-DATA-009 (all COVERED) | plus new concurrency evidence: BUG-04/05/06/07/09 xfails |
| T-MSG-001 | all MSG-001..160 | SEC | P0 | COVERED | apps/extension/test/qa/worker-router.test.js "T-MSG-001" | 182 msgs × 6 outsider senders through the real router; no state change, no fetch |
| T-MSG-002 | all MSG | SEC | P0 | COVERED | worker-router.test.js "T-MSG-002 / T-KEY-108" | empty body locked + unlocked, uiSafe, leak scan, crash log scan |
| T-MSG-003 | all MSG | PROP | P0 | COVERED | worker-router.test.js "T-MSG-003" | fast-check bodies per message (50 local / 200 CI; KDF msgs 3) |
| T-MSG-004 | value-moving MSG (send*, swap*, earn*, defi*, perps*, prediction*, nftTransfer*, smartAccount*, approvalsRevoke, ledgerSend*) | SEC | P0 | COVERED | worker-router.test.js "T-MSG-004" | value-moving while locked, broadcast spy |
| T-MSG-005 | value-moving MSG | SEC | P0 | COVERED | apps/extension/test/qa/value-guards.test.js (3 tests) | insecure-API build: 54 value-moving calls on non-signing chains refused, no key material taken (spy), no broadcast; provider switch/tx refused; testnet control signs |
| T-MSG-006 | registry | CON | P1 | COVERED | worker-router.test.js "T-MSG-006" | live registry == inventory (found 22 missing rows, inventory fixed) |
| T-MSG-007 | grant-gated MSG (backupBegin, revealPrivateKey, copyPrivateKey, addWallet(non-first), qrSyncImport, removeWallet, passkeyEnroll, passkeyDisable, setSettings(weaken)) | SEC | P0 | COVERED | worker-router.test.js "T-MSG-007" | grant-gated through router + setSettings weaken |
| T-PM-001 | all PM-001..069 | NEG | P0 | COVERED | apps/extension/test/qa/provider-port.test.js "T-PM-001" | all PM × 8 malformed param shapes through the real port; BUG-08 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-PM-002 | PM with needsConnection | SEC | P0 | COVERED | provider-port.test.js "T-PM-002" | 4100, no window |
| T-PM-003 | PM with approval | SEC | P0 | COVERED | provider-port.test.js "T-PM-003" | 5 approval kinds, 4001, one window, no broadcast |
| T-PM-004 | PM local/rpc | UNIT | P1 | COVERED | provider-port.test.js "T-PM-004" | local shapes, rpc proxy, unsupported 4200 |
| T-PM-005 | all PM | PROP | P0 | COVERED | provider-port.test.js "T-PM-005" | fast-check per method (30 local / 200 CI) |
| T-PM-006 | all PM | E2E | P1 | COVERED | apps/extension/test/e2e/browser.test.js "T-DAPP-051 ..." | wallet_switchEthereumChain → chainId 0xaa36a7 |
| T-RT-001 | RT-06..24 (signed routes) | SEC | P0 | COVERED | qa_integration_test.go TestQAEverySignedRouteNeedsSignature | new |
| T-RT-002 | all RT | NEG | P1 | COVERED | qa_unit2_test.go TestQAWrongMethod405 | 14 routes × methods |
| T-RT-003 | all RT | CON | P1 | COVERED | qa_integration2_test.go TestQAMeContract + qa_unit2_test.go TestQAErrorShape + e2e/fullstack.test.js T-DATA-016 | success + error shapes |
| T-RT-004 | all RT | PROP | P0 | COVERED | qa_integration2_test.go TestQAHandleRPCRandomBodies + qa_unit2_test.go FuzzQAFetchImage/FuzzQARealIP + qa_unit_test.go FuzzJSONRPCClean/FuzzCanonLogFilter | no 500 / no panic |
| T-RT-005 | all RT | PERF | P3 | COVERED | apps/backend/internal/realtime/qa_load_test.go | Green on the user machine, opt-in HB_QA_PERF=1: 50 balance + 50 tx events/s for 10 s to a fake Centrifugo; none lost, p99 < 100 ms, heap growth < 20 MiB, goroutines stable |
| T-DBO-001 | all DBO-01..63 | MIG | P0 | COVERED | qa_db_test.go TestQAFreshSchemaHasEveryObject | tables, functions, roles, partitions, bytea refs; index-level golden is T-DB-025 |
| T-DBO-002 | all CHECK/UNIQUE/FK constraints in DBO list | INT | P1 | COVERED | qa_db2_test.go TestQAConstraintViolationsNamed | named constraints from catalog |
| T-GOF-001 | all GOF-0001..0627 | UNIT | P1 | COVERED | qa/TEST_SUMMARY.md section 3 (measured on the user machine, Go 1.26.10, Postgres 16 + Redis 7.4 in Docker) | overall 76.0% statements with -coverpkg=./... (target 70); per package own tests: api 85.1, devicesig 90.9, evmtx 94.0, gateway 86.7, ratelimit 100; store 87.1% average per function (111 funcs; a function average, not statement-weighted); only 0% packages are main() entry points and tiny stubs |
| T-EXP-001 | all EXP-0001..1616 | UNIT | P1 | COVERED | qa/COVERAGE_BASELINE.md + qa/tools/v8-line-coverage.cjs | Coverage run of all 41 QA files; QA-only line coverage 63.4% of mapped src lines; baseline per directory and per file recorded. Key files: keySchedule 100, passworder 100, storage 100, walletService 100, vaultService 81, swap/safety 82, provider/ratelimit 100, smartAccount/delegation 100. Low QA-only files (smartAccount/send, provider/multi, typed, solanaTx) are covered by the original suites. No enforced threshold gate. |
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
| T-REG-015 | b2dbc94 | REG | P0 | COVERED | worker-router.test.js T-KEY-120 | behavioural: the booted worker calls setAccessLevel(TRUSTED_CONTEXTS) for local and session |
| T-REG-016 | b2b9770 | REG | P1 | COVERED | approval-preview.test.js + internal/api TestDeviceFlow (eth_simulateV1 forwarded) |  |
| T-REG-017 | 0c1d006 | REG | P0 | COVERED | internal/api TestJSONRPCGuardRejectsParserDifferentials et al. |  |
| T-REG-018 | cf3c951 | REG | P1 | COVERED | testnet-defi.test.js "Uniswap API swap: proxy target, exact approval…" |  |
| T-REG-019 | 0d78eb3 | REG | P0 | COVERED | pentest-regressions.test.js (PT-01/03/04/05/08/11) |  |
| T-REG-020 | d2e8104 | REG | P0 | COVERED | pentest-regressions.test.js (PT-02/12), provider.test.js (PT-07/PT-10), walletconnect.test.js (PT-06) | PT-09 only via source-regex wiring test |
| T-REG-021 | b26a725 | REG | P3 | COVERED | apps/extension/test/e2e/browser.test.js | Browser E2E: Back from a nested screen returns to the previous layer (scoped to .hb-layer.idle). |
| T-REG-022 | 68bcb51 / fb9c7e9 / 296961d | REG | P0 | COVERED | internal/store TestRequireTLS + initdb TestRequireTLSHBA |  |
| T-REG-023 | 57ded23 | REG | P0 | COVERED | internal/api TestScrubBroadcast, TestSecurityHeaders, TestSendCountersDoNotStoreDeviceIDs | security-event log content not asserted |
| T-REG-024 | 320adc5 | REG | P1 | COVERED | internal/config TestLoadSecretFiles |  |
| T-REG-025 | f4f5c94 | REG | P1 | COVERED | apps/backend/internal/realtime/qa_jwt_test.go TestQARealtimeTokensAudienceAndBinding + cmd/migrate/qa_migrate_test.go | aud claim = Centrifugo config audience, channel/device binding, namespaces refuse client subscribe; migrate role check (T-BE-086) |
| T-REG-026 | 68d65cc | REG | P3 | COVERED | apps/extension/test/qa/reg-static.test.js (3) | Static scan: no third-party hostnames in source beyond a reviewed allowlist; only exception is the Bonfida SNS proxy (OBS-15). |
| T-REG-027 | fd7206e | REG | P1 | COVERED | restore-vectors.test.js + display-integrity "page title … escaped" |  |
| T-REG-028 | b05b9cc | REG | P1 | COVERED | apps/extension/test/qa/release-tooling.test.js "T-EXT-031 (refusals)" | no key without HB_RELEASE_KEY_PEM / --key-file; key file must be 0600 and outside the repo; never created implicitly |
| T-REG-029 | a20239b | REG | P1 | COVERED | apps/extension/test/qa/supply-chain.test.js "T-REG-029" | .npmrc ignore-scripts/save-exact/audit-level, verify.mjs runs audit gate + lockfile check, prod deps exact |
| T-REG-030 | e09d05a | REG | P0 | COVERED | passkey.test.js "HW-001…" (3 tests) |  |
| T-REG-031 | eba8c0f | REG | P3 | COVERED | apps/extension/test/e2e/browser.test.js | Browser E2E: Token approvals scan shows coverage and the empty state. |
| T-REG-032 | 35a1ceb | REG | P0 | COVERED | harbour.test.js "HW-014…" |  |
| T-REG-033 | 0e37148 | REG | P0 | COVERED | secrets.test.js T-KEY-089 + e2e/keys-lifecycle.test.js T-KEY-122 | zeroing asserted on returned bytes, per handler |
| T-REG-034 | 316e5cb / c765527 | REG | P1 | COVERED | provider.test.js "HW-004: receive/buy/fund routes gated on backupRequired" |  |
| T-REG-035 | c193d91 | REG | P1 | COVERED | apps/extension/test/qa/page-bridge.test.js "T-DAPP-048" | isTrust/isTrustWallet/isCoinbaseWallet/isRabby/isPhantom absent, isMetaMask false, no window.trustwallet |
| T-REG-036 | def7f87 | REG | P1 | COVERED | settings-service.test.js "HW-011…" + settings.test.js |  |
| T-REG-037 | b2d7139 | REG | P0 | COVERED | provider.test.js "site risk…", "HW-2026-019…", "wallet_switchEthereumChain…(HW-2026-005)" |  |
| T-KEY-121 | KEY-13 | SEC | P0 | COVERED | crypto-kat.test.js "T-KEY-046" | aes-128-ctr/scrypt params |
| T-KEY-122 | KEY-23 | SEC | P0 | COVERED | apps/extension/test/e2e/keys-lifecycle.test.js (3 tests) | spy wraps openActiveKeys/openConnectionKeys at bundle time; success + failure on real API/mock chain; value-moving handlers driven to failure |
| T-KEY-123 | KEY-04 | SEC | P0 | COVERED | vault-handlers.test.js "T-KEY-123 / T-KEY-124" | only v2 written |
| T-KEY-124 | KEY-07 | SEC | P0 | COVERED | vault-handlers.test.js "T-KEY-123 / T-KEY-124" | no v1 leftovers |
| T-KEY-125 | KEY-05 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-125" | both directions vs node:crypto |
| T-KEY-126 | KEY-11 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-126" | TREZOR BIP-39 |
| T-KEY-127 | KEY-13 | KAT | P0 | COVERED | crypto-kat.test.js "T-KEY-127" | Web3 Secret Storage vector |
| T-KEY-128 | KEY-24 | KAT | P1 | COVERED | secrets.test.js "T-KEY-128" | Web3 scrypt vector, param caps, budget |
| T-KEY-129 | KEY-14/KEY-15/KEY-26/KEY-28 | MIG | P1 | COVERED | vault-handlers.test.js "T-KEY-129" | legacy entries |
| T-KEY-130 | KEY-21 | RES | P1 | COVERED | apps/extension/test/qa/biometrics-failures.test.js (3) + browser.test.js (T-KEY-083 / T-KEY-130) | plus real-browser run: authenticator without PRF is refused with a clear alert and no seal stored |
| T-KEY-131 | KEY-15 | CONC | P0 | COVERED | vault-handlers.test.js "T-KEY-131" | no orphan |
| T-KEY-132 | KEY-22 | CONC | P1 | COVERED | vault-handlers.test.js "T-KEY-132" | atomic batches |
| T-KEY-133 | KEY-24 | CONC | P1 | COVERED | secrets.test.js "T-KEY-133" | BUG-07 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-KEY-134 | KEY-25/KEY-26 | CONC | P1 | COVERED | vault-handlers.test.js "T-KEY-134" | race consistent |
| T-KEY-135 | KEY-26 | CONC | P0 | COVERED | vault-handlers.test.js "T-KEY-135" | BUG-06 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-KEY-136 | KEY-02 | RES | P0 | COVERED | vault-handlers.test.js "T-KEY-136" | IDB failure recoverable |
| T-KEY-137 | KEY-15 | RES | P0 | COVERED | vault-handlers.test.js "T-KEY-137" | BUG-04 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-KEY-138 | KEY-25 | RES | P1 | COVERED | vault-handlers.test.js "T-KEY-138" | IDB abort consistent |
| T-KEY-139 | KEY-12/KEY-13 | NEG | P1 | COVERED | vault-handlers.test.js "T-KEY-139" | OBS-02 |
| T-KEY-140 | KEY-07 | PROP | P0 | COVERED | crypto-kat.test.js "T-KEY-140" | rekey property |
| T-KEY-141 | KEY-13 | PROP | P1 | COVERED | crypto-kat.test.js "T-KEY-141" | property |
| T-KEY-142 | KEY-22 | PROP | P1 | COVERED | vault-handlers.test.js "T-KEY-142" | property |
| T-KEY-143 | KEY-05/KEY-02 | CON | P0 | COVERED | crypto-kat.test.js "T-KEY-143" | golden format through VaultService.unlock |
| T-KEY-144 | KEY-22 | CON | P1 | COVERED | vault-handlers.test.js "T-KEY-144" | golden keys |
| T-KEY-145 | KEY-29 | NEG | P1 | COVERED | venue-secrets.test.js "T-KEY-145" | feature off / locked / no agent → refused, no exchange/POST call |
| T-KEY-146 | KEY-29 | SEC | P0 | COVERED | apps/extension/test/qa/venue-secrets.test.js (2 tests) | agent pk + Polymarket key/secret/passphrase never in any response; creds encrypted at rest; secret never sent, only HMAC |
| T-SIG-045 | SIG-08 | KAT | P0 | COVERED | crypto-kat.test.js "T-SIG-045" | RFC 8032 |
| T-SIG-046 | SIG-06 | PROP | P0 | COVERED | signing-units.test.js "T-SIG-046" | @ethereumjs/tx oracle, legacy+1559, 5 chain ids |
| T-SIG-047 | SIG-04 | PROP | P1 | COVERED | signing-units.test.js "T-SIG-047" | property + viem cross-check |
| T-SIG-048 | SIG-04 | NEG | P1 | COVERED | signing-units.test.js "T-SIG-048" | key sizes; OBS-03 documented |
| T-SIG-049 | SIG-06/SIG-07 | NEG | P0 | COVERED | apps/extension/test/qa/send-guards.test.js (3 tests) | pending nonce, plan reuse, fee jump, malformed amounts, tier fallback, self-send warning; zero amount = BUG-15 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-SIG-050 | SIG-06/SIG-07 | SEC | P0 | COVERED | send-guards.test.js "T-SIG-050" | broadcast raw decoded with @ethereumjs/tx: signer=active account, chainId from registry despite from/chainId/tx overrides |
| T-DAPP-054 | DAPP-08 | CONC | P1 | COVERED | provider-port.test.js "T-DAPP-054" | one connection record |
| T-DAPP-055 | DAPP-08/DAPP-09 | RES | P1 | COVERED | apps/extension/test/qa/provider-resilience.test.js (2) | local quota at connect → site error, no connection recorded, retry works (OBS-07 raw message); session quota at queue → immediate error, no orphan pending |
| T-DAPP-056 | DAPP-11 | RES | P1 | COVERED | provider-resilience.test.js "T-DAPP-056" | hanging RPC: error to site bounded by 8 s per probe, nothing saved (OBS-08) |
| T-DAPP-057 | DAPP-17 | RES | P1 | COVERED | apps/extension/test/qa/wc-resilience.test.js (3) | SW restart: alarm resume reconnects and the pending request is answered; relay down → next alarm retries; failed send swallowed = BUG-17 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-DAPP-058 | DAPP-09 | PROP | P1 | COVERED | signing-units.test.js "T-DAPP-058" + provider-port.test.js "T-DAPP-058 (worker)" | property + worker limits |
| T-DAPP-059 | DAPP-10 | PROP | P1 | COVERED | signing-units.test.js "T-DAPP-059" | property, sliding windows |
| T-DAPP-060 | DAPP-03/DAPP-04/DAPP-06/DAPP-14 | CON | P1 | COVERED | provider-port.test.js "T-DAPP-060" | init/evt/res golden |
| T-EXT-041 | KEY-06/KEY-14/KEY-18/KEY-19/KEY-21/SIG-05/SIG-13/EXT-10/UX-02/UX-04/UX-05/UX-06/CH-05/DEFI-01/DAPP-08 | UI | P1 | COVERED | apps/extension/test/e2e/browser.test.js "T-EXT-040 / T-EXT-041 / T-KEY-118" | see BUG-13 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-EXT-042 | EXT-10 | MIG | P1 | COVERED | settings.test.js "normalizeSettings tolerates corrupt / old storage" + settings-service.test.js "corrupt stored settings fall back…" |  |
| T-EXT-043 | EXT-08 | CONC | P2 | COVERED | ext-infra.test.js "T-EXT-043" | debounce, complete tuples |
| T-EXT-044 | EXT-08 | PROP | P2 | COVERED | ext-infra.test.js "T-EXT-017 / T-EXT-044" | property |
| T-EXT-045 | EXT-11 | PROP | P1 | COVERED | ext-infra.test.js "T-EXT-045" | fuzz 3000 |
| T-UX-022 | UX-01 | PROP | P1 | COVERED | ux-sa-units.test.js "T-UX-001 / T-UX-022" | monotonic property |
| T-UX-023 | UX-02 | PROP | P0 | COVERED | ux-sa-units.test.js "T-UX-023" | viem decode oracle |
| T-UX-024 | UX-08 | PROP | P1 | COVERED | ux-sa-units.test.js "T-UX-024 / T-UX-015" | property |
| T-UX-025 | UX-10 | PROP | P1 | COVERED | ux-sa-units.test.js "T-UX-025" | property incl. legacy |
| T-UX-026 | UX-01/UX-02/UX-03/DAPP-18 | SEC | P0 | COVERED | approval-preview.test.js "batch: an unlimited approval names the spender… high-risk warning", "unknown call with no preview is flagged…" |  |
| T-UX-027 | UX-06 | SEC | P0 | COVERED | ux-sa-units.test.js "T-UX-027" | BUG-11 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-UX-028 | UX-10 | SEC | P1 | COVERED | e2e/fullstack.test.js "T-CH-009 / T-UX-028" | feeMax ≥ signed gas×maxFee |
| T-UX-029 | UX-11 | SEC | P1 | COVERED | canonical-golden.test.js "T-UX-029 (extension half)" + apps/backend/internal/api/qa_unit_test.go TestFriendlyChainErrorNeverEchoesInput, TestFriendlyChainErrorMapping | both halves |
| T-SA-018 | SA-05 | KAT | P0 | COVERED | smart-account-core.test.js "authorization digest and both type-4 transactions equal the kit" |  |
| T-SA-019 | SA-06 | KAT | P0 | COVERED | smart-account-core.test.js "kit-built typed data signs to the pinned vectors…" |  |
| T-SA-020 | SA-05/SA-06/SA-07/SA-09 | RES | P1 | COVERED | smart-account-send.test.js "sponsorship refused and the estimate also fails…", "reverted and pending operations are reported", "a receipt not yet visible…" |  |
| T-SA-021 | SA-02 | PROP | P0 | COVERED | ux-sa-units.test.js "T-SA-021" | fuzz 3000 |
| T-SA-022 | SA-03 | PROP | P1 | COVERED | ux-sa-units.test.js "T-SA-022" | exact pinned form |
| T-SA-023 | SA-07 | CON | P1 | COVERED | ux-sa-units.test.js "T-SA-023" | status codes, receipts |
| T-SA-024 | SA-08 | CON | P1 | COVERED | provider.test.js "7715: one approval, nothing signed before it, response shape…" |  |
| T-SA-025 | SA-01 | SEC | P0 | COVERED | smart-account-kit-offline.test.js + smart-account-send.test.js "a provider reply cannot change callData…" |  |
| T-SA-026 | SA-02/SA-03/SA-04/SA-05/SA-06/SA-09 | SEC | P0 | COVERED | smart-account-send.test.js "a paymaster outside the allow-list signs nothing", "not enabled, foreign delegate, bad intent and a fee over the cap are refused…" |  |
| T-CH-016 | CH-02/CH-03 | MIG | P1 | COVERED | tokens-networks.test.js "T-CH-016" | legacy token rows (no addedAt/networkId) kept with stable id, malformed dropped; built-in chain saved as custom → RPC override, one identity |
| T-CH-017 | CH-02/CH-03/CH-04/CH-05 | RES | P1 | COVERED | e2e/fullstack.test.js "T-DATA-013 / T-CH-017 / T-SIG-021" | quote/submit under upstream errors |
| T-CH-018 | CH-01 | SEC | P1 | COVERED | chains.test.js "EVM chain ids are unique and match wallet-core" | ENV-DEPENDENT |
| T-CH-019 | CH-06 | SEC | P0 | COVERED | defi-broadcast.test.js "indexed network: broadcast through the Harbour RPC URL, public RPC untouched", "API refusal is final…" |  |
| T-CH-020 | CH-07 | SEC | P1 | COVERED | failover.test.js "network errors fail over too, and non-RPC requests pass through untouched" |  |
| T-DEFI-017 | DEFI-02/DEFI-03/DEFI-04/DEFI-05/DEFI-06/DEFI-07/DEFI-08 | RES | P1 | COVERED | apps/extension/test/qa/defi-failure-matrix.test.js (16) + defi-failure-matrix-venues.test.js (8) + swap-flow.test.js (T-DEFI-005) | 8 failure modes x ramps, staking on 7 chains, perps, predictions and NFT handlers: friendly failure, nothing posted to a venue, bounded calls per request (no retry storm under 429) |
| T-DATA-013 | DATA-02/DATA-03/DATA-04/DATA-06 | RES | P1 | COVERED | e2e/fullstack.test.js "T-DATA-013 / T-CH-017 / T-SIG-021" | 503 storms |
| T-DATA-014 | DATA-05 | PROP | P1 | COVERED | canonical-golden.test.js "T-DATA-014" | property + first-solution check |
| T-DATA-015 | DATA-06 | PROP | P1 | COVERED | canonical-golden.test.js "T-DATA-015" | fuzz 5 checkers |
| T-DATA-016 | DATA-05/DATA-06/CH-06 | CON | P0 | COVERED | e2e/fullstack.test.js "T-DATA-016" + canonical-golden.test.js | live two-sided contract |
| T-DATA-017 | DATA-03 | SEC | P1 | COVERED | e2e/fullstack.test.js "T-DATA-004 / T-DATA-017" | payload keys, no names, EVM only |
| T-BE-091 | BE-06 | CONC | P0 | COVERED | qa_integration_test.go TestQAParallelReplayAcceptedOnce | new |
| T-BE-092 | BE-07 | CONC | P1 | COVERED | qa_integration2_test.go TestQARequestRateLimitExact | 50 parallel → 10 |
| T-BE-093 | BE-22 | CONC | P1 | COVERED | qa_integration2_test.go TestQAParallelSameTxBroadcast | 5 → same hash, 1 row |
| T-BE-094 | BE-01..28 | RES | P0 | COVERED | apps/backend/internal/api/qa_pgdown_test.go TestQAPostgresDownEverySignedRoute + qa_integration2_test.go (Redis down, gateway failures) | PG made unavailable (ALLOW_CONNECTIONS false + terminate): 17 signed routes → JSON 5xx retryable, no hang, no internals; same Idempotency-Key executes after recovery |
| T-BE-095 | BE-28 | PROP | P1 | COVERED | qa_unit2_test.go FuzzQARealIP | go fuzz target + seeds |
| T-BE-096 | BE-29 | PROP | P2 | COVERED | apps/backend/internal/config/qa_fuzz_test.go (FuzzLoad + 2 tests) | Green on the user machine (60 s fuzz, ~22k execs, no panic). Fuzz target seeded with the real YAML; no panic, error or usable config; bad/missing files return errors |
| T-BE-097 | BE-15/BE-18/BE-19/BE-23/BE-24/BE-26 | INT | P1 | COVERED | apps/backend/internal/api/read_test.go TestReadScreensMakeNoRPCCalls (verified Phase 3) + qa_integration*_test.go | seeded Postgres/Redis: portfolio totals/pricing/spam, history paging, chart, asset, tx (own vs other device), nfts + media; no RPC from read routes |
| T-BE-098 | BE-31 | SEC | P1 | COVERED | cmd/migrate/qa_migrate_test.go TestQAMigrateLoginsAndNoPasswordInLogs | app + 2 service logins work with their passwords, members of harbour_app, not superuser; no password in output incl. error paths |
| T-GW-027 | GW-01..19 | INT | P1 | COVERED | internal/api TestGatewayRPCCannotBeSteeredPastTheAllowlist (full stack for RPC routes) | other routes unit-only |
| T-IDX-052 | IDX-30 | KAT | P1 | COVERED | qa_linkcrypto_test.go TestPrimitivesKnownAnswers | new |
| T-IDX-053 | IDX-12 | CONC | P0 | COVERED | qa_db_test.go TestQAConcurrentIngestDedupes | new |
| T-IDX-054 | IDX-18 | CONC | P1 | COVERED | apps/backend/internal/indexer/qa_repair_conc_test.go TestQARepairConcurrentWithLiveIngest | repair loop during 40 live deliveries: no repair error, all live events survive, orphan removed (repair is not lock-serialised with ingest; outcome checked) |
| T-IDX-055 | IDX-21 | CONC | P1 | COVERED | qa_txtrack_test.go TestQATwoTrackersProcessEachRowOnce | 4 concurrent RunOnce over 60 rows: each checked once, published once (SKIP LOCKED claim) |
| T-IDX-056 | IDX-11..25 | RES | P0 | COVERED | apps/backend/internal/indexer/qa_resilience_test.go (2 tests) | RPC down → logged, 10-min backoff, resumes; Postgres down → loops survive, progress after recovery; NATS down >5 s at start → consumers never start = BUG-16 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-IDX-057 | IDX-02 | PROP | P1 | COVERED | apps/backend/internal/gateway/qa_pool_prop_test.go TestQAPickNeverReturnsIneligibleProperty | 2000 random pools: never excluded/open/below minBlock/no budget; nil only when nothing eligible |
| T-IDX-058 | IDX-04 | PROP | P1 | COVERED | gateway/qa_unit_test.go TestQABreakerInvariantsProperty | 300 random runs |
| T-IDX-059 | IDX-29 | PROP | P1 | COVERED | devicesig_test.go TestSolvePowProperty | new |
| T-IDX-060 | IDX-25/IDX-24/IDX-16/IDX-21/IDX-23 | CON | P1 | COVERED | apps/backend/internal/qacontract/contract_test.go (3) | producer structs carry every consumer field (go/ast on unexported consumers) for balance/tx.status (2 producers)/activity; golden wire JSON for 7 payloads + channels; extension routes channel prefixes |
| T-IDX-061 | IDX-01..10 | INT | P1 | COVERED | internal/gateway TestProviderOutageUnderLoad et al. (server via httptest) |  |
| T-IDX-062 | IDX-02..27 | NEG | P1 | COVERED | apps/backend/internal/store/qa_ingest_malformed_test.go + adapters/chains/evm/qa_malformed_test.go + alchemy FuzzQAWebhookParsing + gateway FuzzQAParseBlockRef | store refuses a batch with any malformed event atomically (OBS-10), 78-digit max stored; EVM client: 10 garbage answers × result/truncated/500/error → errors, no panic, no invented head/fees/inclusion |
| T-DBO-003 | DB-01..23 | NEG | P1 | COVERED | qa_db2_test.go TestQANotNullEverywhere | generated from information_schema |
| T-MSG-008 | all MSG | NEG | P1 | COVERED | worker-router.test.js "T-MSG-008" | invalid values, 0 crashes |
| T-PM-007 | all PM | CON | P1 | COVERED | provider.test.js "serializeError maps to EIP-1193 / EIP-1474 codes without leaking internals" | result shapes per method not golden-tested |
| T-X-012 | BE-03/BE-04/BE-06/BE-07/BE-08/BE-10/BE-12/BE-13/BE-14/BE-16/BE-20/BE-21/BE-22/BE-23/IDX-01/IDX-02/IDX-03/IDX-05/IDX-07/IDX-09/IDX-10/DB-21/DATA-03/DATA-05/CH-06 | E2E | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-DAPP-051 ..." | full dApp journey end-to-end incl. chain receipt |
| T-X-013 | X-02 | PROP | P2 | COVERED | apps/extension/test/qa/utc-keys.prop.test.js (3) + apps/backend/internal/api/qa_integration3_test.go TestQADailyCounterUTCMidnight | TZ=Pacific/Kiritimati (UTC+14): weekday/month-day/DTSTART/DTSTAMP from UTC for random instants around day/month boundaries vs an ISO-string oracle; Go side at UTC midnight |
| T-KEY-147 | KEY-20 | CONC | P0 | COVERED | vault-handlers.test.js "T-KEY-147" | BUG-05 | Fixed 2026-11-23: the known-bug marker is now a plain assertion (regression test). |
| T-SA-027 | SA-07 | CONC | P2 | COVERED | apps/extension/test/provider.test.js (5792 sendCalls concurrent) | two origins, concurrent requests and approvals: 2 prompts, 2 bundles sent, both ids retrievable, cross-origin lookup 5730 |
| T-CH-021 | CH-05/DEFI-01/DEFI-02/DEFI-03/DEFI-04/DEFI-05 | CONC | P0 | COVERED | e2e/fullstack.test.js "T-CH-021" | double submit → one tx |
| T-DATA-018 | DATA-03 | CONC | P1 | COVERED | e2e/fullstack.test.js "T-DATA-018" | debounce, final set |
| T-DAPP-061 | DAPP-12 | INT | P1 | COVERED | provider.test.js "wallet_watchAsset reads symbol/decimals from the chain, never from the page" |  |
| T-DAPP-062 | DAPP-02 | CON | P1 | COVERED | page-bridge.test.js "T-DAPP-062" | provider surfaces |
| T-EXT-046 | EXT-10 | INT | P1 | COVERED | ext-infra.test.js "T-EXT-046" | alarm, side panel, slice |
| T-EXT-047 | EXT-11 | CON | P1 | COVERED | apps/extension/test/qa/canonical-golden.test.js "T-EXT-047" + qa_unit2_test.go TestQAGatewayConfigRoute | two-sided golden |
| T-SA-028 | SA-08 | INT | P1 | COVERED | smart-account-service.test.js "grantPermission: signs the checked delegation…" + provider.test.js "7715…" |  |
| T-SA-029 | SA-05 | PROP | P1 | COVERED | ux-sa-units.test.js "T-SA-029" | independent RLP digest + recovery |
| T-UX-030 | UX-08 | SEC | P0 | COVERED | apps/extension/test/e2e/browser.test.js "T-SIG-043 / T-SIG-044 / T-UX-030" | origin above actions; bidi not raw; keyboard reachable |
| T-IDX-063 | IDX-13 | INT | P1 | COVERED | apps/backend/internal/indexer/qa_refresh_nfts_test.go TestQARefreshExtraRefsAndSweep + indexer_test.go (rebase refresh, older read ignored, balance.changed) | extra refs read, as_of_block + balances_refreshed_at set; sweep only stale, per chain |
| T-IDX-064 | IDX-14 | INT | P1 | COVERED | qa_refresh_nfts_test.go TestQANFTSyncReplaceMediaAndDirty | 2 pages, malformed token id skipped, media key = HMAC key of source, as_of max page, dirty cleared, MarkNFTsMoved re-dirties, provider error leaves list, sale replaces atomically |
| T-IDX-065 | IDX-22 | INT | P1 | COVERED | apps/backend/internal/notifier/qa_routing_test.go TestQAPushRouting | Postgres+Redis+capturing channel: only routed device notified, dedupe, spam/stale silent, unverified generic title, tx status only to sender and only settled, malformed dropped, keyed Redis tags |
| T-IDX-066 | IDX-10 | PROP | P1 | COVERED | rpchttp/qa_unit_test.go FuzzQAParseQuantity | go fuzz + seeds |
