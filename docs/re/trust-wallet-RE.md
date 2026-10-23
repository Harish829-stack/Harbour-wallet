# Trust Wallet — Reverse Engineering Notes

> Living document. Appended and updated across sessions. Static analysis only
> unless a section is explicitly marked RUNTIME. Every claim carries a confidence
> tag: **[certain]** = read directly from recovered/decompiled code,
> **[likely]** = strong inference, **[guessing]** = gap-fill to verify.

## Aim & operating model

**Goal:** reverse engineer **every feature** of the Trust Wallet extension and
document exactly how it is implemented and what decisions Trust Wallet made, with
cited evidence and explicit confidence — strong enough that the wallet could be
built later from this documentation without guessing. **Building is future work,
out of current scope.**

**This doc = the evidence base + per-feature implementation specifications.** It
never contains transcribed decompiled code. Each feature records: what it does,
how it's implemented, the decisions made, why the conclusion holds, and
**verification fixtures** (real-target input→output test vectors) that a future
build must reproduce to prove equivalence.

**Dependency note:** `@trustwallet/wallet-core@4.8.2` is an open-source
dependency Trust Wallet *uses* (confirmed byte-identical to the shipped wasm). We
document *that it is used and with what parameters/call sites*, not its internals.

**Evidence rules:** never invent params/formats/behavior; every claim cites target
evidence (REA/WABT/controlled execution) with a confidence tag; a failed search ≠
absence; mark gaps `UNKNOWN` rather than filling them; wallet-core support ≠ proof
the extension uses it. Documentation progress is tracked in `docs/project/rebuild-tracker.md`.

---

## 0. Document metadata

| Field | Value |
|---|---|
| Last updated | 2026-10-15 |
| Primary target | Trust Wallet Chrome extension (Manifest V3) |
| Version analyzed | **26.41.0** (zip `evidences/extension/26.41.0_0.zip`, sha256 `9e1401e8…7054096`) |
| Source | Unpacked extension from user's Chrome profile |
| Method | Static: REA `analyze_javascript_application` + `recover_javascript_sources` (Wakaru 1.14.0), plus direct reads of bundled JS |
| Android APK | Provided but **not yet analyzed** (deferred by user) |

### Confidence legend
- **[certain]** — directly observed in recovered source / decompiled bytes
- **[likely]** — inferred from strong static evidence, not yet confirmed end-to-end
- **[guessing]** — placeholder pending verification

---

## 1. Toolchain & environment

All analysis runs in the Claude cloud container (x86_64, Ubuntu 24.04, JDK 21),
**not** on the Mac. The Mac's device bridge is a Linux VM (arm64) and cannot run
macOS-native tools (Hopper).

Installed / verified:
- `rea` CLI **6.5.0** (`rea-agents`) — REA MCP + CLI
- Ghidra **12.1.4** (`/root/re-tools/ghidra_12.1.4_PUBLIC`) — native decompiler OK on x86_64
- jadx-headless-mcp **0.7.1** JAR (`/root/re-tools/jadx-headless-mcp-0.7.1-all.jar`) — for the APK later
- Wakaru **1.14.0** (`$(which wakaru)`) — JS source recovery backend for REA

Working copies:
- Unpacked extension: `/root/re-work/trust-ext/src/26.41.0_0`
- Recovered onboarding modules: `/root/re-work/rec-onb/modules`
- Recovered auth/password modules: `/root/re-work/rec-auth/modules`

### Blockers encountered (and resolution)
1. **REA MCP server started without `REA_WAKARU_COMMAND` / `REA_WABT_BIN_DIRECTORY`.** [certain]
   The MCP `recover_javascript_sources` and `inspect_wasm_artifact` tools return
   `capability_unavailable`. **Workaround:** run via the `rea` CLI with the env
   vars set. Permanent fix: restart the REA server with both exported.
2. **No source maps shipped.** `.map` files are referenced but absent; recovery
   relies on Wakaru de-minification (names synthetic except surviving literals). [certain]
3. **REA `recover_javascript_sources` OOMs on the 42 MB `background.js`.** Wakaru's
   Rust parser aborts (`memory allocation failed`). **Resolution:** carve the
   exact vault/password/encryption module blocks (brace-balanced, `node --check`
   valid, ~17 KB) into `vault-crypto-slice.js` and recover *that* through REA.
   Evidence `ev_4f0946c2c582ee95063ed1fdb473d17ce7473a8ea46700113a34723813057bf6`
   (Wakaru 1.14.0). This REA recovery **independently reproduced** the grep
   findings: `DEFAULT_ITERATIONS=20000`, `UNLOCK_ITERATIONS=210000`,
   `DEFAULT_BIT_KEY_LEN=512`, `hmacSha512`, passworder `PBKDF2/10000/SHA-256/AES-GCM-256`. [certain]
4. **REA `inspect_wasm_artifact` rejects files > 8 MB.** `wallet-core.wasm` is
   10 MB, so REA's wasm wrapper cannot take it. WABT **1.0.42** was built from
   source (REA enforces that exact version; no prebuilt was reachable) and REA
   then accepts the version banner but still refuses on the 8 MB cap. **Resolution:**
   wasm facts come from WABT 1.0.42 directly (`wasm-validate`/`wasm-objdump`) plus
   execution of the byte-identical wallet-core 4.8.2 build (§4.5). [certain]

### Evidence provenance (which tool produced which finding)
- **Onboarding flow, import path, password rules** → REA `recover_javascript_sources`
  (Wakaru) on the onboarding/auth chunks (`rec-onb`, `rec-auth`). [REA]
- **Vault / key-derivation / seed-encryption** → REA `recover_javascript_sources`
  on the carved `vault-crypto-slice.js` (ev_4f0946c2…), cross-checked against
  direct reads of `background.js`. [REA + direct read]
- **wallet-core format / cipher / KDF presence** → WABT 1.0.42 `wasm-validate` +
  `wasm-objdump` on `wallet-core.wasm`. [WABT]
- **Exact StoredKey scrypt params** → controlled execution of the byte-identical
  wallet-core 4.8.2 wasm (same SHA-256). [EXEC]
- **Structure / coverage** → REA `analyze_javascript_application` (summary). [REA]

---

## 2. Extension surface (manifest)

- **Manifest V3**, `minimum_chrome_version` 114. [certain]
- Background: single service worker `background.js` (~42 MB bundled). [certain]
- Content script: `content-scripts/content.js` at `document_start`, all frames,
  `https://*/*` + localhost; excludes a long list of auth/captcha/social domains. [certain]
- Injected page providers: **`window.ethereum`** and **`window.trustwallet`** (via `inpage.js`). [certain]
- Permissions: `alarms, tabs, storage, clipboardWrite, notifications, scripting, sidePanel, gcm`. [certain]
- CSP (extension pages): `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. [certain]
- Bundled WASM: `wallet-core.wasm` (crypto/signing), `sql-wasm.wasm` (SQLite). [certain]

### dApp JSON-RPC methods exposed (from `inpage.js`)
`eth_requestAccounts`, `eth_accounts`, `eth_sendTransaction`, `personal_sign`,
`eth_sign`, `eth_signTypedData`, `personal_ecRecover`, `eth_subscribe`,
`eth_getLogs`, filters, and `wallet_*` (addEthereumChain, switchEthereumChain,
requestPermissions, getPermissions, revokePermissions, watchAsset,
sendCalls, getCallsStatus, getCapabilities). [certain]

---

## 3. First-time onboarding flow

### 3.0 Install / first-run entry — Implementation specification (REA-genuine)

**RE method:** REA `recover_javascript_sources` on a carved, `node --check`-valid
slice of `background.js` (the big bundle OOMs Wakaru whole, so the install
functions + the `init_background` module block were sliced out). Evidence
`ev_8602c9a3b364b24477e3c153d0fd2480920c11a92000a36ee0d34ebaa1a7b9b9`
(Wakaru 1.14.0). Recovered source is readable with real identifiers. [certain]

**Observable contract:** on fresh install, a new tab opens at the onboarding page.

**Implementation (recovered, verbatim behavior):**
- `ONBOARDING_ROUTE = "/home.html#/onboarding"` (set in the `init_background`
  module init). [certain]
- `registerInstallListener()`:
  ```js
  polyfill.runtime.onInstalled.addListener((e) => {
    if (e.reason === "install") {
      polyfill.tabs.create({ url: ONBOARDING_ROUTE }).catch(logger_default.error);
    }
  });
  ```
  Only `reason === "install"` opens the tab; update/other reasons do not. [certain]
- **Background startup order** (`init_background`, the service-worker entry): init
  Reflect polyfill → ext polyfill → store → logger → web3 → browser service →
  main → migration → devtools → sentry → constants → logger bridge → app →
  relay-status poller → swap-leg alarm → set `ONBOARDING_ROUTE` → init Sentry →
  install logger→Sentry bridge → `onSuspend` flush listener → `BrowserService.attach()`
  → buffer relay/swap alarms → `registerInstallListener()` → `registerWeb3()` →
  `init()` (bootstrap store + migrations, identify Sentry user, register devtools). [certain]

**Decisions Trust Wallet made (unguessable without RE):**
- Onboarding is a **full page at a hash route** (`/home.html#/onboarding`), not the
  popup. [certain]
- Tab opens **only** on `install`, not on update. [certain]
- `onInstalled` is registered late in a fixed startup sequence, after services and
  alarms are attached. [certain]

**Verification fixture:** load unpacked → first install → exactly one tab opens at
`chrome-extension://<id>/home.html#/onboarding`. (Runtime capture pending.)

**Build readiness:** Ready within scope. Gap: none for the entry itself; the
onboarding UI it opens is §3.1+.

---

Entry summary: on `chrome.runtime.onInstalled` with reason `"install"`, the worker opens
`ONBOARDING_ROUTE = "/home.html#/onboarding"` in a new tab. [certain, REA ev_8602c9a3]

### 3.1 Flow orchestration (`chunks/onboarding-BHcKddMJ.js`)
- `useOnboardingType()` reads `wallets` from the Redux store; **0 wallets →
  `first-wallet` mode**, else `additional-wallet`. [certain]
- First-wallet mode gates the buttons behind a **Terms of Use / Privacy Policy**
  checkbox. [certain]
- Top-level flows (`re` map): `HOME`, `CREATE_MNEMONIC`, `IMPORT_WALLET`,
  `IMPORT_QR`, `SET_PASSKEY`, `IMPORT_LEDGER`, `BACKUP_SEEDPHRASE`. [certain]
- Welcome screen offers: **Create new wallet**, **I already have a wallet**
  (import), **Scan QR to sync** (from Trust Wallet mobile). [certain]
- Idle guard: onboarding tab auto-closes after **600000 ms (10 min)** idle. [certain]

### 3.2 Create-new-wallet path
On click (`setupType === FIRST_WALLET`):
1. `setupAuthentication()` → emits **`SavePassword`**. [certain]
2. `createMnemonic()` → emits **`GenerateHDWallet`** (mnemonic generated **inside
   wallet-core.wasm**), then **`InitiateImportMnemonic`**, then
   **`CompleteImportMnemonic`** (with `solanaDerivationType: PHANTOM`,
   `isMnemonicNewlyGenerated: true`). [certain]
3. New wallet is flagged **`seedPhraseBackupRequired: true`** — backup is deferred,
   not forced at creation time. [certain]

### 3.3 Import path (traced — `chunks/import-mnemonic-or-private-key-CXfCQtf3.js`)
- `SelectImportMethod` → choose source. Trust-Wallet sub-methods: **QR from mobile**
  (recommended) or **Secret Phrase / Private Key**. [certain]
- A password is collected first and held in React context
  (`PrivateDataProvider`, `data.password`); `SavePassword` creates the vault
  before any import handler runs. The import handlers carry an **`@IsUnlocked()`**
  decorator, so the vault must already exist/be unlocked. [certain]

**Input UI (`PasswordTextarea`):**
- Masked entry (mnemonic masks all words except the last as `••••••••`; private
  key masked via `-webkit-text-security`). Paste supported; value `.trim()`ed;
  tagged `ph-no-capture` to keep it out of PostHog analytics. [certain]

**Seed-phrase import:**
1. Client validation: wallet-core `validateMnemonic`, word count must be **12–24**
   (message IDs `validate-seed-phrase.length` / `.generic`). [certain]
2. `INITIATE_IMPORT_MNEMONIC {mnemonic}` → `WalletService.importMnemonic` builds
   the AES-128-CTR StoredKey (encrypted with the derived password key) and returns
   `walletId`; throws `InvalidMnemonic` if wallet-core rejects it. [certain]
3. `DERIVE_SOLANA_ADDRESS {walletId}` → derives both Solana derivation variants
   (DEFAULT vs PHANTOM) and their balances; if only one type, auto-selects. The
   HD wallet is decrypted in-handler with `getPassword()`. [certain]
4. `COMPLETE_IMPORT_MNEMONIC {walletId, solanaDerivationType, name}` →
   `addAccountDerivation`, `fetchAccountsForWallet`, `persistWallet(..., MNEMONIC)`.
   `seedPhraseBackupRequired` is **false** for imported seeds (`!pe`). [certain]

**Private-key import:**
1. `INITIATE_IMPORT_PRIVATE_KEY {privateKey, blockchain}` →
   `WalletService.importPrivateKey`; wallet-core validates against secp256k1 /
   ed25519 and throws `InvalidKey` otherwise; returns `walletId`. [certain]
2. `COMPLETE_IMPORT_PRIVATE_KEY {walletId, walletName}` → `persistWallet(...,
   PRIVATE_KEY, true, …)`, `switchWallet`, sets `authenticated` / `!firstTime` /
   `walletNewlyImported`. No Solana derivation-type step. [certain]
- Hardware path: `ImportLedgerAddress` (can also take a `password` to create the
  vault inline). [certain]
- Analytics on success: `WALLET_CREATED` with `actionSourceType: "importwallet"`
  and `walletType` MNEMONIC / PRIVATE_KEY. [certain]

### 3.4 Password rules (`chunks/useValidatePassword-Dn2iwOd-.js`)
- Min **8**, max **64** characters. [certain]
- Rejected against a hardcoded list of **~430 common passwords**. [certain]

---

## 4. Vault & key management (the core)

Source: `background.js` — `PasswordService`, `VaultService`, `OnboardingService`,
`WalletService`, and the passworder-style encryption strategy.

### 4.1 Password → key derivation (`PasswordService`)
- `hash(password, salt, iterations)` = wallet-core **`hmacSha512`**, i.e.
  **PBKDF2-HMAC-SHA512**, output **512-bit** (`DEFAULT_BIT_KEY_LEN=512`). [certain]
- `DEFAULT_ITERATIONS = 2e4` (**20,000**) [certain]
- `UNLOCK_ITERATIONS = 21e4` (**210,000**) [certain]
- `generateSalt()` = **32 bytes** from `crypto.getRandomValues`. [certain]

> ⚠️ Correction from an earlier session note: these are **20,000 / 210,000**, not
> "2 / 21" — that earlier figure was a truncated grep (`2e4`/`21e4`).

### 4.2 Vault creation (`VaultService.create`)
1. Generate 32-byte salt. [certain]
2. Derive **password key** @ 20,000 iters and **unlockKey** @ 210,000 iters. [certain]
3. `persistSalt(salt, UNLOCK_ITERATIONS)` → store `{salt, iterations}` under `PBKDF2_KEY`. [certain]
4. `setPassword(passwordKey)` and `setUnlockKey(unlockKey)` → stored in
   **`chrome.storage.session`** on MV3 (cleared on browser restart). Raw password
   is **never** persisted. [certain]
5. Generate random `vaultId` (`crypto.randomUUID()`), dispatch store `INIT`. [certain]

`OnboardingService.handlePassword`: if a vault exists → `load(password)`, else
→ `create(password)`. [certain]

### 4.3 Seed encryption — two layers
**Layer A — wallet-core StoredKey** (`WalletService.importMnemonic`):
- `pe = vaultService.getPassword()` → the **derived 20k password key** (not the raw password). [certain]
- `walletCore.importMnemonicWallet(pe, mnemonic)` builds a wallet-core
  **StoredKey** (keystore) encrypted with `pe`. [certain]
- `keyStoreService.attach(vaultId).import(mnemonic, uuid, pe, supportedCoins)`
  persists it. [certain]
- A new HD wallet derives accounts across many coins via `accountForCoin`. [certain]
- **Cipher (confirmed):** the keystore service hard-codes
  `StoredKeyEncryption.aes128Ctr` for both `import` (mnemonic) and `importKey`
  (private key). So the StoredKey is **AES-128-CTR**. [certain — see §4.5]

**Layer B — vault blob** (`VaultService.onUpdate`):
- Entire Redux wallet state (which contains the StoredKey) is encrypted again by
  `getEncryptionStrategy().encrypt(unlockKey, state)` and written under `STORAGE_KEY`. [certain]
- Strategy (MetaMask-passworder style, found at `background.js` offset ~1,475,304):
  `keyFromPassword` runs **PBKDF2 SHA-256, 10,000 iters** over the unlockKey →
  **AES-GCM-256**, random **16-byte IV**. Output `{data, iv, salt}` base64. [certain]

**Net:** seed at rest = AES-GCM(state incl. StoredKey) where the StoredKey is
itself wallet-core-encrypted. Password brute-force cost is dominated by the
210,000-iteration SHA-512 layer; the inner 10,000-iter SHA-256 wrap is weak alone
but sits on top of that. [likely — not benchmarked]

### 4.4 Unlock / brute-force protection
- `UnlockThrottleService` tracks `{failedAttempts, lockedUntil}`, raises
  `TOO_MANY_ATTEMPTS`. [certain]
- Error codes: `VAULT_IS_EMPTY`, `FORBIDDEN_REQUEST`, `TOO_MANY_ATTEMPTS`. [certain]

### 4.5 wallet-core StoredKey — wasm decompilation findings

Decompiled `wallet-core.wasm` with WABT 1.0.36 (`wasm-validate` passes;
`wasm-objdump` data + disassembly). Build path strings confirm this is
TrustWallet wallet-core: `src/Keystore/EncryptionParameters.cpp`,
`TWStoredKeyEncryptionLevel`, `TW::Keystore::EncryptionParameters`. [certain]

- **Format:** Ethereum **keystore v3** — JSON fields present in the wasm:
  `crypto`, `cipher`, `cipherparams`, `ciphertext`, `kdf`, `kdfparams`, `mac`,
  `version`, `address`. [certain]
- **Cipher:** **AES-128-CTR** — selected by the extension (hard-coded
  `aes128Ctr`). The wasm also contains `aes-192-ctr` and `aes-256-ctr` code paths
  that the extension does not use. [certain]
- **KDF:** **scrypt** (wallet-core's write default; `pbkdf2` is also present for
  reading foreign keystores). Validator string: `Missing required scrypt
  parameters n, p, r, or dklen`. [certain]
- **Encryption level:** the extension passes only the cipher, no
  `StoredKeyEncryptionLevel`, so wallet-core's default level applies. [certain]

**Exact StoredKey parameters — RESOLVED (controlled execution).** [certain]

The compiled scrypt constants were not recoverable from the stripped wasm
statically, so they were confirmed by executing the extension's **own** wasm:

- Identified the bundled build by wasm byte-size, then verified **identical
  SHA-256**: `@trustwallet/wallet-core` **4.8.2**
  (`1b78048fa04fd8905b4eea99eb281bffb167e46a5559d28392a5e8116a885171`) ==
  extension `wallet-core.wasm`. Byte-for-byte the same binary. [certain]
- Ran `StoredKey.importHDWalletWithEncryption(mnemonic, name, pw,
  CoinType.ethereum, StoredKeyEncryption.aes128Ctr)` on a throwaway in-process
  mnemonic (no real seed) in Node, exported the keystore JSON:

```json
{ "version": 3, "cipher": "aes-128-ctr",
  "cipherparams": { "iv": "<16 bytes>" },
  "kdf": "scrypt",
  "kdfparams": { "dklen": 32, "n": 16384, "p": 4, "r": 8, "salt": "<32 bytes>" } }
```

**StoredKey (per-wallet keystore) parameters:** [certain]
| Field | Value |
|---|---|
| format | Ethereum keystore **v3** |
| cipher | **aes-128-ctr**, 16-byte random IV |
| KDF | **scrypt** |
| n | **16384** (2^14) |
| r | **8** |
| p | **4** |
| dklen | **32** |
| salt | 32 random bytes |
| mac | keccak256(derivedKey[16:32] ‖ ciphertext) (keystore-v3 standard) |

Note: `p=4` (not the common `p=1`) and `n=16384` are wallet-core's default
level. This is the "light" scrypt tier — fast, not the 262144 heavy tier. This
is the **inner** layer; the vault's outer AES-GCM layer (§4.2/§4.6) adds the
210k-SHA512 + 10k-SHA256 cost on top.

### 4.7 wallet-core usage — how Trust Wallet drives the library (REA-genuine)

**RE method:** REA `recover_javascript_sources` on a carved valid slice of
`background.js` containing `KeyStoreService`, `WalletCoreService`, `WalletService`,
and the `KeyStore.Default` adapter. Evidence
`ev_7afedf54d49efe1062a9545bfdf1c23c0a13b8c90893c9c8352af83754640c1e`
(Wakaru 1.14.0). Readable source, real identifiers. [certain]
This supersedes the earlier grep-only evidence for the cipher selection (§4.5).

**The decisions Trust Wallet made in driving wallet-core:**

- **Cipher selection (both paths):** [certain, REA]
  - `KeyStoreService.import(mnemonic, name, password, coins)` →
    `keystore.import(..., StoredKeyEncryption.aes128Ctr)`
  - `KeyStoreService.importPrivateKey(...)` →
    `keystore.importKey(..., StoredKeyEncryption.aes128Ctr, Derivation.default)`
  So **aes-128-ctr** for mnemonic *and* private-key stored keys; private-key import
  additionally pins **`Derivation.default`**.
- **HD wallet construction:** `WalletCoreService.importMnemonicWallet(password,
  mnemonic)` → `HDWallet.createWithMnemonic(mnemonic, password)`. Note the argument
  order (password first in the wrapper, mnemonic first in wallet-core). [certain, REA]
- **StoredKey build (adapter `KeyStore.Default.prototype.import`):** [certain, REA]
  1. `Mnemonic.isValid(mnemonic)` → throws `InvalidMnemonic` on failure.
  2. `StoredKey.importHDWalletWithEncryption(mnemonic, name, Buffer(password),
     coins[0], encryption)` — builds the keystore.
  3. `HDWallet.createWithMnemonic(mnemonic, "")` — **empty BIP39 passphrase** ("").
  4. For each supported coin: `storedKey.accountForCoin(coin, hdWallet)` — derives
     that coin's account into the stored key.
  5. `mapWallet(...)`, then `delete()` on both native handles, then persist
     (`importWallet`).
- **Password used for the StoredKey:** the derived password key from the vault
  (`vaultService.getPassword()`), not the raw password (see §4.3). [certain]
- **Validation:** mnemonic via `Mnemonic.isValid`; private key via `PrivateKey.isValid`
  (secp256k1 / ed25519) before import. [certain, REA]

**Decisions a builder could not guess:** aes-128-ctr specifically (wallet-core
supports 128/192/256), `Derivation.default` for private keys, the empty-string
BIP39 passphrase, per-coin `accountForCoin` derivation, and that the StoredKey is
keyed by the *derived* password rather than the raw password.

**Build readiness:** Ready within scope. Remaining `UNKNOWN`: the exact
`getSupportedCoins()` list and per-coin derivation paths — that is feature #08.

### 4.8 Account & address derivation (#08) — Implementation specification (REA-genuine)

**RE method:** REA `recover_javascript_sources` on a carved valid slice of
`background.js` (Solana enum, `DeriveSolanaAddress`, the supported-coins class,
`KeyStoreService.addAccountDerivation`). Evidence
`ev_934dc08b070ccd9ec87b47e1ef7673627d52f095dde103edb9b7ca8c482f9b0a`
(Wakaru 1.14.0). [certain]

**Supported coins (the decision):**
- `getDefaultCoins()` returns a **hardcoded list of 128 wallet-core `CoinType`
  values** (recovered in full): aeternity, aion, binance, bitcoin, bitcoinCash,
  bitcoinGold, boba, callisto, cardano, confluxeSpace, cosmos, dash, decred,
  digiByte, dogecoin, eos, ethereum, ethereumClassic, fio, goChain, groestlcoin,
  icon, ioTeX, kava, kin, litecoin, mantle, merlin, metis, monacoin, nebulas,
  nuls, nano, near, nimiq, ontology, qtum, xrp, stellar, tezos, theta,
  thunderCore, neo, viction, tron, veChain, viacoin, wanchain, zcash, firo,
  zilliqa, zelcash, ravencoin, solana, waves, terra, terraV2, harmony, algorand,
  kusama, polkadot, filecoin, multiversX, bandChain, smartChainLegacy, smartChain,
  oasis, polygon, thorchain, bluzelle, optimism, arbitrum, ecochain,
  avalancheCChain, xdai, fantom, cryptoOrg, celo, ronin, osmosis, ecash,
  cronosChain, smartBitcoinCash, kuCoinCommunityChain, aurora, evmos, nativeEvmos,
  moonriver, moonbeam, kavaEvm, kaia, meter, okxchain, nervos, everscale,
  polygonzkEVM, aptos, sui, neutron, stride, nativeInjective, stargaze, sei, ton,
  opBNB, base, linea, greenfield, mantaPacific, nativeZetaChain, zetaEVM,
  tbinance, blast, scroll, internetComputer, bounceBit, zkLinkNova, zksync,
  agoric, neon, akash, ioTeXEVM, juno, axelar, sonic, plasma, monad, megaETH. [certain, REA]
- `getSupportedCoins()` = `uniqBy([...getDefaultCoins(), ...allowedBlockchains→CoinType], v => v.value)`
  — the default set plus any extra allowed blockchains, de-duplicated by CoinType
  value. [certain, REA]
- On wallet creation each supported coin is derived into the StoredKey via
  `accountForCoin(coin, hdWallet)` (§4.7). Derivation paths themselves come from
  wallet-core per CoinType (not overridden by TW for the default case). [certain]

**Solana dual derivation (the notable decision):** `DeriveSolanaAddress.handle`
derives **two** Solana addresses and picks by on-chain history: [certain, REA]
- `DEFAULT` = `hdWallet.getAddressForCoin(CoinType.solana)` (wallet-core default path).
- `PHANTOM` = `hdWallet.getAddressDerivation(CoinType.solana, Derivation.solanaSolana)`
  (the Phantom-compatible variant).
- Calls `solanaService.hasTransactionHistory([default, phantom])`; on lookup
  failure it **falls back to DEFAULT only**. Enum: `DEFAULT="default"`,
  `PHANTOM="phantom"`.

**Adding a derivation later:** `KeyStoreService.addAccountDerivation(walletId,
password, coinType, derivation)` loads the StoredKey, removes the coin's existing
account, and re-adds it with the chosen derivation. [certain, REA]

**Decisions a builder could not guess:** the exact 128-coin default set and its
order, the uniqBy-on-CoinType-value merge, and especially Solana's
derive-both-then-choose-by-history behavior with DEFAULT fallback.

**Build readiness:** Ready within scope. `UNKNOWN`: per-CoinType derivation-path
strings are wallet-core's internal defaults (dependency behavior, documented as
"wallet-core default"); `getAllowedBlockchains()` extra set beyond defaults is
config-/flag-driven and not fully enumerated here.

### 4.9 Unlock / lock / session (#09) — Implementation specification (REA-genuine)

**RE method:** REA `recover_javascript_sources`. Unlock path + throttle from the
vault slice (ev_4f0946c2, `04-06-vault-crypto/`); auto-lock module + lock
orchestrator from a new slice (ev_d62096af, `09-lock-session/`). [certain]

**Unlock (password → vault open):** [certain, REA]
- `VaultService.loadWithPassword(password)` → `decryptVaultGuarded(password)` →
  `unlockThrottle.guard(() => decryptVault(password), isPasswordGuessFailure)`.
- `decryptVault` reads `PBKDF2_KEY` (salt + stored iterations), reads the
  `STORAGE_KEY` blob, derives the key and AES-GCM-decrypts (wrong password →
  "Incorrect password"). On success the derived password/unlock keys go back into
  `storage.session`.

**Throttle (brute-force protection) — exact values:** [certain, REA]
- State `{failedAttempts, lockedUntil}` under its own `STORAGE_KEY`; empty =
  `{0,0}`.
- `FREE_ATTEMPTS = 5`, `BASE_DELAY_MS = 5000`, `MAX_DELAY_MS = 300000`.
- After a failure: `n = failedAttempts+1`; `excess = n - 5`; if `excess > 0`,
  `lockedUntil = now + min(5000 · 2^(excess-1), 300000)`. So attempts 1–5 are
  free; then lockout doubles 5s, 10s, 20s, … capped at **5 minutes**.
- `assertNotLocked()` throws while `lockedUntil > now`; a correct unlock calls
  `reset()` to clear the counter.

**Lock:** [certain, REA]
- `VaultService.lock()` = `clearPassword()` → removes `PASSWORD_KEY` and
  `UNLOCK_KEY` from `storage.session`. `reset()` also clears them.
- The lock orchestrator: `setPreventAutoTriggerBiometrics(true)` →
  `vaultService.lock()` → `sendOneTimeMessage(LOCK_CALLBACK)`.

**Auto-lock (session lifetime) — exact values:** [certain, REA]
- `DEFAULT_LOCK_TIME_IN_MINUTES = 10`.
- `AUTO_LOCK_OPTIONS = [1, 5, 10, 15, 30, 60, 0]` minutes (0 = never,
  `AUTO_LOCK_NEVER`).
- `isAutoLockEnabled = (v) => v !== 0`; `sanitizeLockTime` falls back to **10** if
  the value isn't an allowed option.
- MV3 session keys (`PASSWORD_KEY`/`UNLOCK_KEY` in `storage.session`) are also
  cleared by the browser on service-worker/browser restart (§4.2). [certain]

**Decisions a builder could not guess:** 5 free attempts, 5s base / 5-min cap
exponential backoff, the exact auto-lock option set, 10-min default, and that
"lock" simply clears the session-held derived keys (the encrypted vault stays on
disk). [certain]

**Build readiness:** Ready within scope. `UNKNOWN`: the alarm/timer wiring that
*triggers* auto-lock after inactivity (which alarm fires `lock()`); documented
here is the policy + lock mechanism, not the countdown scheduler.

## 5. Features #10–#18 — Implementation specifications (REA-genuine)

Each sub-section is backed by REA `recover_javascript_sources`; recovered source
shipped in `evidences/re-evidence/NN-*/`. Runtime/server contracts are marked `UNKNOWN` per the
static-analysis boundary.

### 5.10 Home — assets / balances / tokens / prices / history (#10)
Evidence ev_491e9157 (`10-home-assets/`), from `AssetService` in `background.js`. [certain]
- `AssetService` owns asset data: `getAssetDetails` / `getAssetsDetails`,
  `getCoinStatus(IfNeeded)`, `getNonManagedAssets`, and discovery feeds
  `fetchTrendingTokens`, `fetchTrendingNetworks`, `fetchMarketSentiment(SupportedCrypto)`. [certain]
- Balances and fiat/prices are fetched through service calls + the `useBalances`
  / `useFiats` hooks (chunks). The **client** methods and shapes are recovered;
  the **live API endpoints and responses are `UNKNOWN`** (runtime/server). [certain]
- Decision: a managed/non-managed asset split and a coin-status gating layer
  (`getCoinStatusIfNeeded`) before fetching details. [certain]

### 5.11 Send — transaction build / sign / broadcast (#11)
Evidence ev_d433f7dd (`11-transaction/`), `TransactionServiceManager`. [certain] (Partial.)
- **Decision = per-network strategy router:** `TransactionServiceManager.resolveService(network)`
  dispatches to a network-specific service, then calls `stage`, `estimateGas`,
  `status`, `sign`, and `validateAddress` / `validateContractAddress(Format)`. [certain]
- Actual signing is delegated to wallet-core (§4.7) / web3 per network; the
  per-network signing bodies are vendored and **not individually traced** here. [certain]
- `UNKNOWN`: fee/nonce selection details and broadcast endpoints per chain. 

### 5.12 dApp provider — EIP-1193 (#12)
Evidence ev_8511560a (`12-provider/`), recovered from `inpage.js` (full). [certain]
- Injects `window.ethereum` and `window.trustwallet`; `request({method,params})`
  is the EIP-1193 entry; supports `eth_requestAccounts`, `eth_sendTransaction`,
  `personal_sign`, `eth_signTypedData`, chain/account methods. [certain]
- **Decisions:** `isMetaMask: false`, `isTrust`/`isTrustWallet: true`; advertises
  via **EIP-6963** `announceProvider` with `name: "Trust"`, `rdns:
  "com.trustwallet.app"`. [certain]
- Requests are posted to the content script → background for approval/handling
  (bridge in §5.14); approval-UI flow is background-side. [certain]

### 5.13 Message / typed-data signing (#13)
Covered by ev_8511560a (provider side) + §4.7 (wallet-core signing). [certain]
- `personal_sign` and `eth_signTypedData` enter via the provider `request()`,
  are forwarded to background, and signed via wallet-core with the derived key.
- `UNKNOWN`: the exact background approval-screen flow for signing requests. 

### 5.14 Content ↔ inpage ↔ background bridge (#14)
Evidence ev_6b52a033 (`14-bridge-content/`), from `content-scripts/content.js`. [certain]
- Content script injects `inpage.js` into the page, then relays between page and
  background using `window.postMessage` (page↔content, channels tagged
  `"content"` / `"inpage"`) and `chrome.runtime` messaging (content↔background). [certain]
- Decision: a two-hop bridge (page world ↔ isolated content world ↔ service
  worker), with source tags to route messages. [certain]

### 5.15 Network / RPC (#15)
Evidence ev_de93124b (`15-network/`), `NetworkService`. [certain]
- `onApplicationBoot`, `startPollGasFees` / `stopPollGasFees`,
  `checkPendingTransactions`. RPC node resolution is per `blockchain.id` with an
  `blockchain.isCustom` path for user-added networks. [certain]
- `UNKNOWN`: the default RPC endpoint URLs (config/remote-driven). 

### 5.16 WalletConnect / QR sync (#16) — BLOCKED
- Implemented via a **Kotlin/JS-compiled** `WalletConnectService` (WalletConnect/
  reown kotlin-multiplatform SDK; symbols like `JsWalletConnectService$handleRequest$slambda`). [certain]
- Static JS recovery cannot produce clean source for Kotlin/JS-compiled code, so
  the internals are **not reverse-engineered**. The decision established: TW uses
  the WC Kotlin SDK with a `WalletConnectService` request router. [certain]
- To build this feature, use the WalletConnect SDK directly rather than
  reconstructing TW's compiled copy. Status: **Blocked (compiled language boundary).**

### 5.17 Swaps (#17)
Evidence ev_1db92cac (`17-swap/`), `SwapService`. [certain]
- `SwapService` handles `quote`, `route`, `slippage`, `getWalletSwapAsset`,
  `submitSwapTransaction`, `resolveSessionApproval`, `recordSwapTransaction`,
  `transformFees`. [certain]
- Decision: swaps go through a provider/quote model with slippage handling, then
  submit as a normal transaction (§5.11). [certain]
- `UNKNOWN`: the swap provider API endpoints/quote responses (runtime/server). 
- **Correction 2026-10-16:** the endpoint UNKNOWN above is superseded. Recovered: walletkit `TrustSwapClient` (`/v2.1/swap`, `/v2.1/swap/quote`), Amber routing API, Thorchain service, approval service; 69 serializer schemas. Server-side behavior and TW defaults remain UNKNOWN. See `evidences/re-evidence/25-swap/SWAP-SPEC.md`.

### 5.18 Hardware wallet — Ledger (#18)
Evidence ev_153b6ed2 (`18-ledger/`), from the `import-ledger` chunk. [certain]
- TW-side Ledger integration (the heavy `@ledgerhq` transport lives in the
  vendored `ledger-*` chunk, not re-RE'd). Recovered chunk covers the import flow:
  address retrieval (`getAddress`) and wiring into the wallet model. [certain]
- `UNKNOWN`: full per-coin Ledger signing path. Build via `@ledgerhq` libraries
  directly. 

### 4.6 Net onboarding crypto picture (clarified)

Seed at rest = **two nested encryptions**, both rooted in the user password:

1. Password → PBKDF2-HMAC-SHA512 (20k iters, 32-byte salt) = `passwordKey`;
   and (210k iters) = `unlockKey`. Neither the password nor these keys are on
   disk — they live in `storage.session`. [certain]
2. Seed → wallet-core StoredKey, **AES-128-CTR + scrypt (n=16384, r=8, p=4,
   dklen=32)**, encrypted with `passwordKey`. [certain]
3. Whole Redux state (incl. that StoredKey) → **AES-GCM-256** (passworder:
   PBKDF2-SHA256 10k over `unlockKey`), written to `storage.local` under
   `STORAGE_KEY`. [certain]

To decrypt the seed offline an attacker needs: the on-disk vault blob + the
on-disk PBKDF2 salt, then must brute-force the password through the
210k-SHA512 → 10k-SHA256 → AES-GCM chain to get the StoredKey, then crack the
StoredKey's own scrypt+AES-128-CTR layer with the same password. [likely]

---

## 5. Storage keys

> **Exact string values RESOLVED at runtime — see §6.2.** `trust:store`, `trust:pbkdf2`,
> `trust:vault`, `trust:vaultId`, `trust:wallets:<vaultId>`, `<walletId>` (keystore). (observed references)

| Key (constant) | Store | Purpose | Confidence |
|---|---|---|---|
| `STORAGE_KEY` | `storage.local` | Encrypted vault blob (AES-GCM) | [likely] |
| `PBKDF2_KEY` | `storage.local` | `{salt, iterations}` for KDF | [certain] |
| `VAULT_ID_KEY` | `storage.local` | `{vaultId}` (random UUID) | [certain] |
| `PASSWORD_KEY` | `storage.session` | Derived 20k password key | [certain] |
| `UNLOCK_KEY` | `storage.session` | Derived 210k unlock key | [certain] |
| throttle `STORAGE_KEY` | `storage.local` | Failed-attempt lockout state | [likely] |

*(Exact string values of the constants not yet dumped — see Open Questions.)*

---

## 6. Message/event handlers (onboarding-relevant)

Internal event bus (`Tn("…")` / `vn.emit`):
`GenerateHDWallet`, `InitiateImportMnemonic`, `CompleteImportMnemonic`,
`DeriveSolanaAddress`, `ImportLedgerAddress`, `InitiateImportPrivateKey`,
`CompleteImportPrivateKey`, `SavePassword`. [certain]

---

## 7. Open questions / next steps

- [x] Decompile `wallet-core.wasm` → StoredKey = **keystore v3, AES-128-CTR,
      scrypt**. Done §4.5. Exact scrypt n/r/p remain a static blocker.
- [x] Trace import-existing-wallet (mnemonic + private key). Done §3.3.
- [ ] Dump exact string values of storage-key constants (`STORAGE_KEY`,
      `PBKDF2_KEY`, etc.). [pending]
- [x] Recover exact scrypt params — **RESOLVED** via byte-identical wallet-core
      4.8.2 execution: n=16384, r=8, p=4, dklen=32, aes-128-ctr. See §4.5.
- [ ] Confirm whether vault blob lives in `storage.local` vs `storage.managed`. [pending]
- [ ] `eth_sendTransaction` → confirmation → signing path. [pending]
- [ ] Network calls during onboarding (analytics endpoints, assets CDN). [pending]
- [ ] Android APK analysis (jadx) and compare with extension. [pending]
- [ ] RUNTIME verification with a throwaway test wallet (no real funds). [pending]

---

## 8. Changelog

- **2026-10-15 (1)** — Initial doc. Covered: toolchain/blockers, manifest surface,
  onboarding flow, vault/KDF/seed-encryption crypto, storage keys, handlers.
  Source: REA + Wakaru recovery of onboarding/auth chunks + `background.js` reads.
- **2026-10-15 (2)** — Decompiled `wallet-core.wasm` (WABT 1.0.36). Confirmed
  StoredKey = keystore v3 / **AES-128-CTR** / **scrypt** (§4.5), added net crypto
  picture (§4.6). Traced full import-existing-wallet path, mnemonic + private key
  (§3.3). Logged scrypt-params static blocker. Tooling note: WABT 1.0.42 (REA's
  pinned version) has no prebuilt Linux asset reachable here; used 1.0.36 directly.
- **2026-10-15 (3)** — RESOLVED scrypt params via controlled execution of the
  extension's own wasm (confirmed byte-identical to `@trustwallet/wallet-core`
  **4.8.2**, same SHA-256). StoredKey = aes-128-ctr + scrypt **n=16384, r=8, p=4,
  dklen=32**, keystore v3 (§4.5). Throwaway in-process mnemonic only; no real seed.
- **2026-10-15 (4)** — Re-derived the vault/crypto through **REA** (not just grep):
  built WABT 1.0.42 from source for REA's wasm tool; carved the vault/password/
  encryption modules into a valid slice and ran REA `recover_javascript_sources`
  (ev_4f0946c2…), which reproduced all KDF/cipher values. Logged REA tool limits
  (Wakaru OOM on 42 MB monolith; REA wasm inspector 8 MB cap) and per-finding
  provenance (§1). No facts changed — this hardened their evidence basis.

---

## 6. Runtime verification (live extension) — RUNTIME-genuine

**Harness:** the extension was loaded unpacked into headful Chromium 1194 (via
Playwright + `xvfb`) in the analysis container, with a fresh profile and a
**throwaway wallet** (random seed, no funds). Storage, console, and network were
captured. Evidence: `evidences/re-evidence/runtime/` (storage schema redacted — secrets/
ciphertext/salt stripped; KDF/cipher parameters kept, not secret). [certain]

### 6.1 Onboarding UI — confirmed at runtime [certain]
- Welcome screen renders exactly as statically specced (§3.1): title "Join 200M
  users in securing their financial future", a Terms/Privacy **checkbox that gates**
  "I already have a wallet" and "Create new wallet" (both disabled until checked),
  plus "Scan QR to sync".
- Create-password step: `Step 1 of 2 · Secure your wallet · Create password`, two
  fields `data-testid="password-field"`, placeholder "Min 8 characters" (confirms §3.4).

### 6.2 Storage schema — RESOLVED (was the main gap) [certain]
After creating a wallet, `chrome.storage.local` holds these exact keys:

| Key | Contents |
|---|---|
| `trust:store` | Redux-persist root (slices `0`,`1`,`2`) |
| `trust:pbkdf2` | `{ salt: "0x…", iterations: 210000 }` — the KDF salt + unlock iterations |
| `trust:vault` | `{ data, iv, salt }` (base64) — the AES-GCM vault blob (§4.2 outer layer) |
| `trust:vaultId` | `{ vaultId: "<uuid>" }` |
| `trust:wallets:<vaultId>` | `["<walletId-uuid>"]` — wallet-id index for the vault |
| `<walletId-uuid>` | the wallet-core **StoredKey keystore v3 JSON** (the encrypted seed) |
| `com.trustwallet.kit.common-override_node_greenfield_cid1017` | a node-URL override config |

Session keys (`PASSWORD_KEY`/`UNLOCK_KEY`) live in `storage.session` (cleared on
restart), per §4.2.

### 6.3 Crypto parameters — RUNTIME-confirmed [certain]
The live keystore written by the extension:
`cipher = aes-128-ctr`, `kdf = scrypt`, `kdfparams = {n:16384, r:8, p:4, dklen:32}`,
`version: 3`, `type: "mnemonic"`. This **matches the executed-wasm result (§4.5)
exactly** — so the params are now confirmed by the real extension at runtime, not
just by running the dependency. `trust:pbkdf2.iterations = 210000` confirms the
unlock-KDF iteration count (§4.1). A new wallet derives accounts across the full
default coin set (§4.8) — ~40+ coin types present in `activeAccounts`.

### 6.4 Network behavior [certain within egress limits]
- At onboarding (no wallet yet) the extension contacts only **Sentry**
  (`o4507686279512064.ingest.us.sentry.io`) and **Amplitude**
  (`api.lab.amplitude.com`, `api2.amplitude.com`) — analytics/telemetry; no
  wallet-data server calls before a wallet exists.
- The container's egress proxy blocks Trust Wallet's own API/RPC hosts
  (`ERR_TUNNEL_CONNECTION_FAILED`), so balance/price/RPC **responses** were not
  captured. The client *requests* it attempts remain `UNKNOWN`-resolved on the
  server side — a network boundary, not a gap in the static spec.

### 6.5 What runtime did NOT resolve
- Server/API response contracts for #10/#15/#17 (egress-blocked).
- The auto-lock countdown trigger (#09) — not exercised in this run.
- #16 WalletConnect — unchanged (compiled-code boundary).

## 7. Server / API contracts (from live HAR) — RUNTIME-genuine

Captured from a HAR of the real extension on open internet (throwaway wallet, 240
requests). Resolves the egress-blocked gaps for #10/#15/#17. Full map:
`evidences/re-evidence/runtime/api-contracts.md`. [certain]

- **Main API gateway: `gateway.us.trustwallet.com`.** Asset-id scheme
  `c<coinType>` (native) / `c<coinType>_t<tokenAddr>` (token). Key endpoints:
  `POST /v1/balances/stream` (balances, streaming `{amounts:{total,total_in_fiat,
  available,…}}`), `POST /v2/market/tickers` (prices), `/v2/market/charts|info/c<ct>`,
  `POST /v1/assets` + `GET /v1/assets?asset_ids=` (metadata), `/v1/txhub/bulk_history`
  + `/v1/txhub/txs` (history), `POST /v1/validate/address` (validation + risk),
  `/v2/announcements`, `/v1/buycrypto/widget/quote`, staking (`/v1/invests/staking`,
  `/v1/discover/group/invest-staking`, `/v1/apr/proxy/stakewiz`), `POST /v3/nft/collections`,
  device fingerprint. [certain]
- **Per-chain RPC: `<chain>.twnodes.com/naas/session/<token>/…`** (node-as-a-service,
  session token in path). EVM → JSON-RPC POST at session root; UTXO → Blockbook
  `GET /api/v2/address/<addr>`; Cosmos → LCD `GET /cosmos/…`; Tron `POST /wallet/getaccount`;
  Solana JSON-RPC; Cardano GraphQL. Plus `api.bnbchain.org` (BNB staking),
  `query.thegraph.kiln.fi` (Kiln). [certain]
- **Assets CDN:** `assets-cdn.trustwallet.com/blockchains/<chain>/assets/<addr>/logo.png`.
  **WalletKit:** `wallet-kit.trustwallet.com`. [certain]
- **Not captured:** DEX **swap** quote/submit endpoints (no swap action in this HAR). [certain gap]

## 9. Status — feature coverage (all 18)

Updated: 2026-10-15. Target: Trust Wallet extension v26.41.0 · wallet-core 4.8.2.
Method per row: REA = `recover_javascript_sources`; EXEC = controlled execution of
byte-identical wallet-core 4.8.2; WABT = wasm decode. Evidence in `evidences/re-evidence/NN-*/`.

| # | Feature | Status | Method | Spec | Evidence |
| --- | --- | --- | --- | --- | --- |
| 01 | Install / first-run entry | Established | REA | §3.0 | ev_8602c9a3 |
| 02 | Onboarding flow | Established | REA | §3.1–3.3 | rec-onb |
| 03 | Password rules / validation | Established | REA | §3.4 | rec-auth |
| 04 | Key derivation (PBKDF2-SHA512 20k/210k) | Established | REA | §4.1 | ev_4f0946c2 |
| 05 | Vault create / session keys | Established | REA | §4.2 | ev_4f0946c2 |
| 06 | Seed encryption (2 layers) | Established | REA+EXEC+WABT | §4.3–4.7 | ev_4f0946c2 |
| 07 | wallet-core usage decisions | Established | REA+EXEC | §4.7 | ev_7afedf54 |
| 08 | Account & address derivation (128 coins) | Established | REA | §4.8 | ev_934dc08b |
| 09 | Unlock / lock / session / throttle | Established | REA | §4.9 | ev_d62096af |
| 10 | Home / assets / balances / prices / history | Established | REA+HAR | §5.10/§7 | ev_491e9157 + HAR |
| 11 | Send / tx (per-network router) | Partial | REA | §5.11 | ev_d433f7dd |
| 12 | dApp provider (EIP-1193) | Established | REA | §5.12 | ev_8511560a |
| 13 | Message / typed-data signing | Established | REA | §5.13 | ev_8511560a + ev_7afedf54 |
| 14 | content↔inpage↔background bridge | Established | REA | §5.14 | ev_6b52a033 |
| 15 | Network / RPC (twnodes NaaS map) | Established | REA+HAR | §5.15/§7 | ev_de93124b + HAR |
| 16 | WalletConnect / QR sync | Blocked | — | §5.16 | Kotlin/JS-compiled |
| 17 | Swaps / staking / NFTs | Partial | REA+HAR | §5.17/§7 | ev_1db92cac + HAR (staking/NFT yes); swap client/UI recovered 2026-10-16, see evidences/re-evidence/25-swap/SWAP-SPEC.md |
| 18 | Hardware (Ledger) | Partial | REA | §5.18 | ev_153b6ed2 |

Summary: 13 Established, 4 Partial (client RE'd; runtime/vendored part UNKNOWN),
1 Blocked. Remaining for a faithful build: verification fixtures (real
input→output) and live server/API contracts for the partial features; the
Blocked feature is built from the WalletConnect SDK directly.

## 2026-10-15 — Local audit corrections and implementation authorization

This dated addendum supersedes conflicting scope/status prose above while
preserving its history. The user now explicitly authorizes full implementation
with the same screens and UX, and permits substitute branding/assets where
necessary. See `docs/project/IMPLEMENTATION-PLAN.md`, `docs/re/UI-PARITY.md` and
`evidences/audit/CURRENT-STATUS.md`. The research and build completion states remain separate.

- **Target identity [certain]:** the supplied ZIP hashes to
  `028160c250aa65591d54fd3ec123181db612cc6cdb6963431a870d35b3bcdf31`,
  58,673,602 bytes. The earlier ZIP hash is not the local ZIP's identity. This
  does not prove a different payload: the 23 historical REA source input hashes
  all have matching local files (artifact chunks or the saved carved slices).
  Original ZIP preserved; extraction in `evidences/extension/reference-26.41.0/`;
  `evidences/audit/reference-inventory.json`, `evidences/audit/source-input-integrity.json`.
  CRX signature/official acquisition provenance remains **UNKNOWN** for this ZIP.
- **Evidence integrity [certain]:** all 46 historical recovered JS/map files
  listed by manifests match their recorded digests. Verified input snapshots are
  now deposited alongside them in `inputs-verified-local/`. Manifest integrity
  is not runtime equivalence or proof that synthetic scaffolding is shipped code.
- **Dependency [certain]:** shipped WASM and installed wallet-core 4.8.2 are
  byte-identical (`1b78048f…a885171`). Direct WABT 1.0.42 validation succeeds.
- **Tool environment [certain]:** this run is on macOS arm64, not the historical
  Linux container. Local REA 6.5.0, Wakaru 1.14.0, source-built WABT 1.0.42,
  Playwright 1.56.1 and Chromium 141.0.7390.37 are installed. REA's JS recovery
  adapter rejects macOS, so an isolated Linux x64 Docker environment was built
  and verified. See `tools/README.md`; installation failures and resolutions are
  recorded there. REA WABT inspection of smaller sql-wasm succeeds
  (`evidences/audit/rea-sql-wasm-probe.json`); wallet-core still exceeds REA's 8 MiB cap.
- **#01 revalidation [certain], CODE-AND-RUNTIME-CONFIRMED within tested scope:**
  exact original install listener, init function and startup initializer ranges
  were re-extracted without dependency mocks. `source-ranges.json` binds them to
  original half-open UTF-8 byte offsets. REA evidence
  `ev_a13180a7e6eb023cb2aa10adc16d7550a0b9c2d436adc075c054cae62fd17a1b`
  and full input/recovery/manifest bundle are in
  `evidences/re-evidence/01-install/2026-10-15-local/`. Fresh install in isolated Chromium
  opens one `home.html#/onboarding` tab without manual navigation:
  `evidences/audit/screens/reference/00-install.json`. Update/non-install behavior is
  code-confirmed, not separately runtime-tested.
- **#02 public screen observations [certain], OBSERVED-ONLY:** at 1365×900,
  welcome uses full-page columns, terms gate Import/Create, QR is enabled;
  Create enters “Select an option” with a “Password” control before the password
  form. Screenshots and sanitized DOM: `evidences/audit/screens/reference/01–03-*`.
  Implementation correspondence: recovered onboarding/auth chunks. Remaining
  onboarding branches and a complete per-screen spec are still required.
- **Coverage correction [certain]:** the historical table contains 14 Established,
  3 Partial and 1 Blocked, not 13/4/1. Those labels overstate full-feature
  readiness: several Established rows have open implementation/runtime gaps.
  “All processed” is not “all reverse engineered.” Later-row exploration after
  partial #11 did not satisfy the chronological gate. Retain it as provisional
  evidence; reopen incomplete earlier gates before advancing.
- **Build correction [certain]:** Harbour remains a scaffold with constant home
  data and inactive action controls. Its unrestricted content bridge was removed,
  internal sender authorization added, invalid wallet-create input rejected,
  test invocation fixed, and hash-verified WASM packaging made automatic. These
  are build changes, not target findings. Three tests and a clean build pass;
  complete functional/visual equivalence is **not** established.

## 2026-10-16 — REA installation verification

REA 6.5.0 is already installed. Scoped Codex registration/skill checks pass; setup preview has no actions. Live MCP responds as 6.5.0 (207 tools). See [installation check](../../evidences/re-evidence/tooling/2026-10-16-rea-install-check/README.md) for commands, checksum, saved checks and limitations. No feature coverage changed; prior paused work and chronological next steps remain unchanged.


## 2026-10-16 — Complete v2 coverage and enhanced Harbour presentation

The current user instruction governs: develop only `harbour-wallet-v2/`; preserve
`harbour-wallet/` and `wallet-clone/` as historical. Cover every evidenced target
screen, subscreen, significant state and internal flow of supplied v26.41.0,
with a cohesive Harbour design. Pixel equality is superseded by intentional
presentation improvements; architecture, navigation and wallet semantics remain
evidence-led. Original ZIP remains unchanged; official CRX signature is UNKNOWN.

Order: REA-first whole-target structural inventory → comparison with active v2 →
explicit gaps → official extension design research and licensed asset ledger →
shared system rendered at real dimensions → chronological implementation,
interaction/lifecycle verification and repair. Whole-target structural discovery
is authorized before gate #02; it does not close later feature research gates.
`docs/re/UI-PARITY.md` is the sole screen/state/navigation coverage authority. Track
implementation, integration, visual inspection and interaction separately. Sample
data and development previews never count as live integration. Resume detailed
research at #02; preserve later evidence as provisional. Continue independent
work when a dependency blocks a gate. Append durable evidence and build records.

## 2026-10-19 — Phase 2 RE correction and build handoff

REA recovery of the supplied v26.41.0 target distinguishes the routes: `/notification`
(`notification-C0DFw0BI.js`, `notification-ui.js`) is the dApp request decision surface;
`/approval` (`approval-detail-CuYqbU-I.js`) is token allowance management. Connection,
blacklist and popup-confirmation slices are preserved under
`evidences/re-evidence/30-dapp-approvals/2026-10-19/recovery/`, with source ranges and REA manifests.
This corrects older Harbour notes that treated both routes as absent or treated
`/approval` as the dApp request route. [certain, CODE-CONFIRMED]

The original `harbour-wallet-v2/E2E-network-log-trust-wallet.har` is 53,464,733 bytes,
over REA's 32 MiB capture input limit. A deterministic sanitized projection retains all
1,098 original ordinals and removes headers, cookies, query values, session tokens,
addresses and bodies. REA analyzed the projection completely (Evidence
`ev_551b146661f76ad4aeba38f5a5c3feb79f998e627d6b4c43e2cda4f46f188ce3`). Observed
patterns include Sepolia JSON-RPC reads, `eth_estimateGas`, `eth_sendRawTransaction`,
receipt polling, Trust gateway calls, and per-chain NaaS endpoints. The capture has no
runtime attribution for the dApp provider and does not establish WalletConnect behavior.
[certain for recorded traffic; runtime attribution UNKNOWN]

Harbour Phase 2 now implements the EIP-1193/EIP-6963 page provider, private content
bridge, origin-bound background router, `/notification` request window, `/approval`
allowance panel, connection management and blacklist. Durable executing claims and
settlement tombstones fail closed after worker interruption; provider state is refreshed
on lock/disconnect. Build status is recorded in `harbour-wallet-v2/BUILD-LOG.md`.

## 2026-10-21 — User-requested backend and API specification

The current direct request authorizes a cross-cutting investigation of the supplied
`/Users/jatinsharma/Desktop/REA/samples/trustwallet-extension/26.41.0_0/26.41.0_0`
backend surface. Deliverable: [docs/re/TRUST-WALLET-BACKEND.md](TRUST-WALLET-BACKEND.md),
with durable source/range/REA evidence under
[evidences/re-evidence/40-backend-api/2026-10-21/](../../evidences/re-evidence/40-backend-api/2026-10-21/README.md).
This does not close chronological lifecycle gates or establish implemented UI coverage.

- [certain, CODE-CONFIRMED] Recovered 73 ApiService method bodies, gateway HMAC
  construction/403 recovery, device bootstrap, balance mapping/feed, WebSocket
  command lifecycle, SQLite drivers/schema and storage helpers. Thirteen bounded
  REA/Wakaru runs retained; one is deliberately empty after credential-node
  omission, and two have identical focus-source output, so these are not thirteen
  independent confirmations. Exact statements and scope are in the evidence registry.
- [certain, CODE-CONFIRMED] Packaged SQL persistence exports database bytes,
  deflates/Base64-encodes them and writes Chrome local storage `TrustSDK_DB`.
  This establishes a client database path, not Trust Wallet's server DB.
- [certain, OBSERVED-ONLY] Six HAR files yield 5,216 complete records/237 normalized
  HTTP groups/86 RPC method-host pairs. One capture is truncated; only 3,467
  complete prefix entries from that file are used. Public chain config has 108
  rows/86 enabled. Historical capture attribution to this exact version is not
  independently authenticated. No recorded URL or credential was reused.
- Static discovery: 238 JS files parsed; 802 combined path-literal locations and
  2,264 syntactic sink candidates. Duplicates, SDK-only/dead paths and collection
  `.get()` false positives remain explicit; this is not proof of all active APIs.
- Verification: exact source/input/recovery hashes and local links checked; six
  controlled auth-function fixtures pass with synthetic inputs and an explicitly
  substituted Node HMAC primitive. No full extension/browser runtime or live
  server/API compatibility was verified in this pass.

UNKNOWN: actual remote server language/framework/DB/cache/deployment, credential
issuance/authorization internals, risk/quote/VIP algorithms, every dynamic endpoint,
all populated response/publication schemas and full per-feature reachability.
Build readiness: Partial for an equivalent backend specification; server internals
cannot be recovered from a browser package alone. Original target files unchanged.

## 2026-10-21 — Harbour upload support (no new target finding)

Repacked Desktop Harbour.zip to place manifest.json at archive root.
Details and hashes: harbour-wallet-v2/releases/Harbour-root-fixed.validation.json.
No Trust Wallet target evidence or feature confidence changed; Firefox port and
store validation remain unverified. Continue chronological research at #02.

## Reverse Engineering Status

Updated: 2026-10-15, local audit. This section governs current readiness over
the older summaries. Build coverage is in `docs/re/UI-PARITY.md`, not this table.

| Scope | Audited status | Confidence / remaining gap |
|---|---|---|
| Baseline | Local identities/integrity verified | [certain]; official CRX provenance/signature UNKNOWN |
| 2026-10-21 backend request | Client code and historical contracts documented; Partial overall | [docs/re/TRUST-WALLET-BACKEND.md](TRUST-WALLET-BACKEND.md); code-backed auth/local SQLite, 73 methods, bounded inventories; server DB/framework/private algorithms UNKNOWN; lifecycle gates unchanged |
| 01 Install | CODE-AND-RUNTIME-CONFIRMED for fresh-install entry | [certain]; bundle deposited; update-negative runtime fixture absent |
| 02 Onboarding | Recovered flow evidence; partial public runtime fixture set | [certain] for captured/code-backed portions; full screens/branches/fixtures incomplete; next active feature |
| 03–08 Password/vault/account decisions | Historical code/dependency evidence preserved and hash-checked | Per-claim prior confidence retained; full specification/readiness must be audited in order |
| 09 Session | Policy/lock evidence; partial overall flow | Scheduler and lifecycle behavior incomplete |
| 10 Home/data | Client/HAR evidence; full screen/state coverage incomplete | Do not equate API discovery with home-feature completion |
| 11 Transactions | Partial | Per-network signing, fees/nonces, broadcast and approvals unresolved |
| 12–15 Provider/signing/bridge/network | Provisional later-feature evidence | Full background approvals/configuration/fixtures incomplete; chronological gate not satisfied |
| 16 WalletConnect/QR | UNKNOWN implementation details | Compiled-code difficulty is not proof no REA route exists; SDK choice alone does not close parity |
| 17 Swaps/staking/NFT | Partial, provisional | Split flows and close client/service/runtime gaps in order |
| 18 Ledger | Partial, provisional | Per-coin signing/device/runtime paths incomplete |

Next: finish the #02 implementation specification and full onboarding screen/state
matrix, then implement and compare it under the governing plan. No all-feature
or exact-wallet completion claim is supported.
