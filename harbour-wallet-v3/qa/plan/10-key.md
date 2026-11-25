
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
