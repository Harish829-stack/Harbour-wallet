# FEATURE_INVENTORY.md — Phase 1 (Harbour Wallet v3)

Status: COMPLETE (2026-11-19). Built from source only (no tests read). Paths are relative to `harbour-wallet-v3/`. Line numbers are at HEAD `4f44aaa`.

How to read this file
- Part A: curated feature groups with unique Feature IDs (`KEY-`, `SIG-`, `DAPP-`, `EXT-`, `UX-`, `SA-`, `CH-`, `DEFI-`, `DATA-`, `BE-`, `GW-`, `IDX-`, `DB-`, `X-`). Each row lists source, inputs, outputs, state changes, side effects, error paths and caller trust.
- Part B: threat model (assets, attackers, abuse cases) mapped to Feature IDs.
- Part C (generated, exhaustive): every INTERNAL message handler (`MSG-###`), every provider method (`PM-###`), every HTTP route (`RT-##`), every DB object (`DBO-##`) and every Go function (`GOF-####`), each with file:line and the Feature ID it belongs to. Nothing in the codebase that is callable from a trust boundary is missing from Part C.

Caller trust levels: **T0** anonymous internet / any web page; **T1** registered device (signed API request) or connected dApp origin; **T2** extension UI page (popup/side panel/approval window, extension origin); **T3** service worker internal / backend service-to-service; **T4** operator (env, migrations, CLI).

---------------------------------------------------------------------------------------------------------------------------------

## Part A. Feature groups

### A1. Key and secret management (KEY)
| ID | Feature | Source | Inputs | Outputs | State changes | Side effects | Error paths | Trust |
|---|---|---|---|---|---|---|---|---|
| KEY-01 | Password policy | `apps/extension/src/core/passwordPolicy.ts:5` | password string | `{valid, error?}` | — | — | empty, <8, >64 UTF-16 units, in commonPasswords list | T2 |
| KEY-02 | Vault create | `core/vaultService.ts:25` | password, initial state | vaultId | IDB `wallet:pbkdf2` (v2 Argon2id record), `wallet:vault` (AES-GCM v2), local `wallet:vaultId`; session `wallet:password`, `wallet:unlock` | VAULT_REV marker | `FORBIDDEN_REQUEST` if vault exists; KDF param errors | T3 (via `createWallet`) |
| KEY-03 | KDF v2 (Argon2id m=47104 KiB,t=2,p=1 → HKDF-SHA256 split into unlockKey/passwordKey, NFKC) | `core/keySchedule.ts:30` | password, salt, params | two 128-hex keys | zeroises master | — | `VAULT_KDF_PARAMS_INVALID` (m<8p, m>262144, t∉1..10, p∉1..4) | T3 |
| KEY-04 | KDF v1 legacy (PBKDF2-HMAC-SHA512 20k / 210k via wallet-core) | `core/passwordService.ts:3-13`, `vaultService.ts:16-20` | password, salt, iterations | hex key | — | — | — | T3 |
| KEY-05 | Passworder envelope v2 (HKDF→AES-GCM-256, 32B salt, 12B IV) + v1 legacy read (PBKDF2-SHA256 10k) | `core/passworder.ts:15-31` | high-entropy secret (≥32 chars), object | JSON `{v,data,iv,salt}` | — | — | encrypt refuses short secret; decrypt → `Incorrect password` on any failure; JSON.parse of payload outside try | T3 |
| KEY-06 | Unlock (serialized, throttled) | `core/vaultService.ts:52-66`, handler `modules/wallet.ts:76` | password | decrypted vault state | throttle record, session keys, lock alarm armed, legacy passkey dropped | — | `TOO_MANY_ATTEMPTS` (5 free, 5 s·2^(n-1) to 300 s), `VAULT_IS_EMPTY`, `Incorrect password` | T2 |
| KEY-07 | v1→v2 key-schedule migration on unlock (all-or-nothing re-key of vault, keystores, perps/prediction blobs) | `core/vaultService.ts:72-112`, `core/keyMigration.ts:12-41` | password, state, old keys | new keys | IDB secrets in one txn; passkey seal cleared | — | any re-key failure → nothing written, unlock still succeeds with v1; unreadable perps/predictions blobs dropped silently | T3 |
| KEY-08 | Change/add password for biometrics-only wallet | `core/vaultService.ts:120-143`, handler `passkeyAddPassword` `modules/wallet.ts:120` | new password, passkey secret | ok | full re-key + re-seal PRF blob | — | `LOCKED`, `BIOMETRICS_NOT_SET_UP`, already has password, invalid password, PRF verify failure | T2 |
| KEY-09 | Password check for re-auth | `core/vaultService.ts:146-155` | password | void | throttle | — | same as unlock | T3 |
| KEY-10 | Lock / auto-lock / OS-idle lock | `vaultService.ts:163-166`, `background/index.ts:54-69`, `settingsService.ts:32-37` | alarm, idle state, `lock` msg | — | session keys + reauth grants removed; store `unlocked:false` | provider `init` re-broadcast | — | T3/T2 |
| KEY-11 | Mnemonic generation (128-bit) | `core/walletService.ts:6-11` | session passwordKey | 12-word phrase (worker only) | — | — | `LOCKED` | T3 |
| KEY-12 | HD derivation of all supported coins, account-index path rewrite, Solana variant | `core/walletService.ts:24-48` | mnemonic / HDWallet, index | address map | — | — | unsupported pinned CoinType throws | T3 |
| KEY-13 | Keystore build/encrypt (wallet-core StoredKey aes-128-ctr, passphrase = passwordKey) | `core/walletService.ts:56-72` | mnemonic, name | StoredKey | — | — | `LOCKED`; frees on error | T3 |
| KEY-14 | Create first wallet (vault + keystore + optional passkey) | `background/modules/wallet.ts:32-75` | password, mnemonic?/newlyGenerated, name, passkey? | `{ok, addresses}` | vault, keystore, wallet list, manage grant (10 min), lock timer | — | `INVALID_WALLET_INPUT`, `WALLET_CREATION_IN_PROGRESS`, `FORBIDDEN_REQUEST`, passkey enrol failure drops vault keys | T2 |
| KEY-15 | Add / import additional wallet (mnemonic), duplicate detection, 30-wallet cap | `modules/wallet.ts:255-296` | mnemonic?, name, AUTHORIZED symbol | `{ok, walletId}` | vault, keystore, reveal grant for new wallet | — | locked, `MAX_WALLETS`, invalid phrase, `AUTH_REQUIRED`, duplicate | T2 |
| KEY-16 | Import private key (classify, decode hex/base58/bech32, curve validity, network pick) | `core/importKey.ts:23-85`, handlers `validatePrivateKey`, `importInitiate/importComplete/importCancel` (`handlers/onboardingExtra.ts`) | secret, chain | validity, wallet | vault + keystore | — | invalid key, unsupported network, duplicate address | T2 |
| KEY-17 | Live import check (kind + validity only) | `handlers/secrets.ts importCheck` | secret, chain | `{kind, valid}` | none | key bytes zeroed | — | T2 |
| KEY-18 | Backup: reveal phrase as images, tap-to-verify with opaque chip ids | `handlers/secrets.ts backupBegin/Check/Finish/Cancel`, `core/backupSession.ts:9-30`, `background/secretRender.ts` | reveal grant, sessionId, picks, theme | PNG grid + chips; check result | session `wallet:backupSession` (15 min, equality classes only); `seedPhraseBackupRequired=false` | words array wiped | `LOCKED`, `AUTH_REQUIRED`, `BACKUP_EXPIRED`, `BACKUP_MISMATCH`, no phrase | T2 |
| KEY-19 | Reveal / copy imported private key (image; offscreen clipboard, auto-clear 60 s) | `handlers/secrets.ts revealPrivateKey/copyPrivateKey/secretViewClosed`, `background/clipboard.ts`, `offscreen/clipboard.ts` | walletId, reveal grant | PNG + meta | session copy grant 60 s | clipboard write + clear | `AUTH_REQUIRED`, wrong wallet type | T2 |
| KEY-20 | Re-auth grants (reveal 2 min / addWallet 10 min / manage 2 min, one-shot, wallet-bound, method-bound) | `background/reauth.ts:15-41`, handlers `revealAuth`, `reauthStatus` | purpose, method, password/secret, walletId | ok | session grant keys | — | locked, wrong password (throttled), PRF verify fail | T2 |
| KEY-21 | Biometric (WebAuthn PRF) enrol / unlock / disable / legacy retirement | `core/passkeyService.ts:18-72`, `core/passkey.ts`, handlers `passkeyEnroll/Unlock/Disable/Status` | PRF secret, credentialId, manage grant(password) | ok | IDB `wallet:passkey:vault`, local `wallet:passkey` | OS security notification | `LOCKED`, `AUTH_REQUIRED`, `BIOMETRICS_NOT_SET_UP`, legacy seal, password-generated wallet | T2 |
| KEY-22 | Secret storage split (IDB for secrets, storage.local for rest; lazy + boot migration with read-back verify) | `core/storage.ts:8-60`, `core/secureStore.ts` | key, value | — | IDB / chrome.storage | VAULT_REV marker | `SECURE_STORE_VERIFY_FAILED` keeps legacy copy | T3 |
| KEY-23 | Active-key access for signing (per-op open, address-verified, dispose zeroises) | `background/keys.ts:16-75` | session passwordKey, vault state | key bytes | — | — | locked, no wallet, Solana mismatch, key/address mismatch | T3 |
| KEY-24 | QR "sync with mobile" import (UR fountain → gzip → minified StoredKeys; one-time code; 5 wrong codes destroys stage; KDF work budget) | `core/qrSync.ts:12-97`, `core/qrImport.ts`, `background/qrStage.ts:11-39`, handlers `qrStage`, `qrSyncImport`, `qrImportAll`, `qrVerify` | frames, storedKeys, code | stageId, imported count | session stage (5 min) | — | size limits (400 KiB/1 MB, 2048 seq), malformed key, `INCORRECT_CODE`, `QR_TOO_MANY_ATTEMPTS`, `QR_EXPIRED`, `AUTH_REQUIRED` | T2 |
| KEY-25 | Remove wallet (needs backup done + manage grant), cannot remove last | `modules/wallet.ts:361-385` | walletId | ok | vault, keystore deleted, active switched | address sync | `BACKUP_REQUIRED`, `AUTH_REQUIRED`, only wallet | T2 |
| KEY-26 | Accounts: add (HD index), switch, rename; wallets: switch, rename, list | `modules/wallet.ts:173-219, 298-318, 346-400` | ids, names, index | lists | vault | address sync | locked, invalid index, name rules (`validateWalletName`, 40 chars) | T2 |
| KEY-27 | Reset empty/interrupted vault | `handlers/onboardingExtra.ts resetEmptyVault`, `dropVaultKeys` | — | ok | vault removed only if no wallets | — | refuses when wallets exist | T2 |
| KEY-28 | Ledger hardware wallet add / prepare / submit (WebHID in popup; worker never sees keys) | `handlers/ledger.ts`, `handlers/chainSend.ts ledgerSendPrepare/Submit`, `popup/ledger/*` | addresses, signed tx | wallet / tx hash | vault | broadcast | device errors, address mismatch | T2 |
| KEY-29 | Perps agent key / prediction API creds encrypted under passwordKey | `handlers/perps.ts perpsEnable`, `handlers/predictions.ts`, `storage.ts:23` | session key | — | IDB blobs | — | locked | T2 |
| KEY-30 | Dumb-UI enforcement (`findSecretField` / `uiSafe`, `sanitizeResult` error text) | `core/uiSafe.ts:5-21`, `core/errors.ts`, `background/index.ts:99-111` | any handler result | safe result | — | security log line | `SECRET_FIELD_BLOCKED` | T3 |
| KEY-31 | Redacting logger | `core/logger.ts:4-35` | any | console line (≤300 chars) | — | — | — | T3 |

### A2. Signing (SIG)
| ID | Feature | Source | Inputs | Outputs | Errors / notes | Trust |
|---|---|---|---|---|---|---|
| SIG-01 | personal_sign normalisation (param order swap, hex vs UTF-8, 128 KiB cap) | `core/provider/methods.ts normalizePersonalSign` | params, connected account | NormalizedMessage | -32602 bad params; message > 128 KiB | T0→T1 |
| SIG-02 | eth_sign (developer setting, UTF-8→personal prefix else raw 32-byte hash only) | `methods.ts normalizeEthSign`, `background/provider/service.ts:176-179` | params | sig | 4200 disabled; -32602 non-hash | T1 |
| SIG-03 | EIP-712 V3/V4 typed data (order detection, V1 rejected, 200 KiB, domain.chainId must match site chain) | `methods.ts normalizeTypedData`, `service.ts:183-190`, `core/provider/typed.ts summarizeTypedData`, `core/provider/evmSign.ts:19-23` | params | signature | 4200 V1; 4100 wrong account; chain mismatch | T1 |
| SIG-04 | EVM message signing primitives (personal hash, raw hash, recover) | `core/provider/evmSign.ts:9-16` | pk bytes, hex | Hex | — | T3 |
| SIG-05 | eth_sendTransaction (normalise, simulate, fee tiers, chain binding, from binding, sign, broadcast via backend) | `service.ts:550-600`, `background/provider/view.ts`, `background/provider/fees.ts`, `core/provider/evmSign.ts:28`, `core/harbour/fetchHook.ts` | tx params | tx hash | 4100 account/chain changed while pending, -32602, insufficient funds, signing policy refusal | T1 |
| SIG-06 | EVM tx build/sign (EIP-1559/legacy, chain id, nonce from node, gas tiers) for wallet sends | `core/chains/send/evm.ts:45-107`, `core/sendService.ts`, `core/gasFees.ts:22-56` | SendParams | raw tx | estimate failure fallback gas, contract-recipient warning | T2 |
| SIG-07 | Non-EVM send builders (Solana, BTC/UTXO, Cosmos, Tron, TON, Sui, Aptos, Near, Polkadot, Stellar, Ripple, Tezos, Algorand, Cardano, Filecoin, Harmony, ICON, MultiversX, Theta, VeChain, Waves, Zilliqa, IoTeX) | `core/chains/send/*.ts`, `core/chains/send/index.ts` | SendParams | signed payload | per-family address/amount/fee/memo rules | T2 |
| SIG-08 | Solana dApp signing (signMessage, signTransaction, signAll, signAndSend; message vs tx detection; simulation) | `core/provider/solanaTx.ts`, `solSim.ts`, `siws.ts`, `service.ts:279-330` | base58/base64 tx/msg | signature(s) | 4100, malformed tx, fee payer ≠ connected | T1 |
| SIG-09 | Multi-chain dApp signing (Cosmos amino/direct, Sui, Aptos, TON proof, Tron, BTC PSBT) | `core/provider/multi.ts`, `psbt.ts`, `background/provider/multiBuild.ts`, `tonProof.ts` | chain, payload | signature | not connected; address mismatch; PSBT input ownership | T1 |
| SIG-10 | Chain-id / replay protection: wallet signs only for chains allowed by signing policy; backend rejects pre-EIP-155 and wrong chain id | `core/harbour/policy.ts:17-60`, `apps/backend/internal/api/send.go:357-360` | chainId | allow/deny | mainnet needs secure backend; custom networks allowed | T3 |
| SIG-11 | Nonce management (pending nonce from node, session pinning estimate→nonce→broadcast) | `fetchHook.ts:15 sessionFor`, `api/send.go:87-94, 207`, gateway pool `pinned` | session id | — | stale nonce → `nonce_used`/`nonce_gap` friendly errors | T1 |
| SIG-12 | SIWE / SIWS parsing and issue detection (domain, address, chain) | `core/provider/siwe.ts:3-19`, `siws.ts` | message | parsed / issues | non-SIWE text returns null | T1 |
| SIG-13 | Approval window decision path & biometric approval preference | `service.ts:430-460`, `background/provider/approvalWindow.ts`, handlers `providerResolve`, `providerBioProof` | pending id, decision, proof | outcome | locked → `LOCKED`; blacklisted; high-risk site confirmation | T2 |

### A3. dApp interaction (DAPP)
| ID | Feature | Source | Notes | Trust |
|---|---|---|---|---|
| DAPP-01 | Inpage EIP-1193 provider + EIP-6963 announcement | `src/inpage/ethereum.ts`, `inpage/index.ts`, `inpage/emitter.ts` | `request`, legacy `send/sendAsync`, events, `isHarbour`/default-wallet flag | T0 |
| DAPP-02 | Inpage Solana + multi providers | `inpage/solana.ts`, `inpage/multi.ts` | connect/disconnect/sign APIs per family | T0 |
| DAPP-03 | Page↔content bridge (nonce'd MessageChannel handshake, first channel wins, 200 retries) | `inpage/bridge.ts`, `content/content.ts:38-82` | origin check, nonce regex | T0 |
| DAPP-04 | Request validation (`parsePageRequest`, `scan`, 256 KiB, id/method regex, proto keys) | `core/provider/protocol.ts:33-60` | deep copy via JSON | T0 |
| DAPP-05 | Method allowlist / unsupported list / bridge-namespaced names | `core/provider/methods.ts:9-63` | 4200 / -32601 | T0 |
| DAPP-06 | Content relay: inflight dedupe, MAX_INFLIGHT 200, reconnect/backoff, fatal on invalidation | `content/content.ts:15-36` | | T0 |
| DAPP-07 | Sender identity & origin normalisation (https or loopback http; extension URLs rejected; opaque frames get 4100) | `background/provider/index.ts senderOf/onConnect`, `core/provider/origin.ts:2-8` | | T0 |
| DAPP-08 | Permission store: connect, scoped connections, revoke, disconnect, blacklist, prefs, WalletConnect key separation | `core/provider/store.ts:35-110`, `origin.ts:27-31`, handlers `provider*` | | T1/T2 |
| DAPP-09 | Pending request queue (TTL 15 min, settled 5 min, MAX_PENDING_TOTAL 25, per-origin cap, binding snapshot) | `core/provider/store.ts:112-157` | | T1 |
| DAPP-10 | Rate limiting per origin (read 120/60s, approval 6 +0.1/s, rpc 300/20s, rpcAll 1000/60s) | `core/provider/ratelimit.ts`, `service.ts:106-115` | -32005 | T1 |
| DAPP-11 | wallet_switchEthereumChain / wallet_addEthereumChain (private-URL refusal, chain-id probe, custom network save) | `service.ts`, `background/provider/index.ts saveCustomNetwork`, `core/networks.ts:14-60`, `origin.ts:20-26` | | T1 |
| DAPP-12 | wallet_watchAsset (token sanitise, ≤100 tokens) | `core/customTokens.ts:22-46`, `provider/index.ts addToken` | | T1 |
| DAPP-13 | Read-only RPC passthrough to the site's network (allowlisted methods incl. eth_sendRawTransaction) | `methods.ts:38-44`, `background/provider/rpc.ts` | | T1 |
| DAPP-14 | Event fan-out (accountsChanged, chainChanged, connect, disconnect, networkChanged) per origin; storage.onChanged → init refresh | `provider/index.ts emit, initProviderBackground` | | T3→T0 |
| DAPP-15 | Phishing / scam lists (MetaMask + ScamSniffer, 24 h session cache ≤6 MB, whitelist precedence), site risk on top & embedding origin | `core/provider/phishing.ts:6-79`, `service.ts:436-446` | | T3 |
| DAPP-16 | Blocked domains (no injection) & exclude-matches (captcha/ads) | `origin.ts:16-17`, `provider/index.ts EXCLUDE_MATCHES` | | T0 |
| DAPP-17 | WalletConnect v2 bridge (pair, sessions, chain add, permission key `#walletconnect`, keepalive, project id) | `background/walletconnect/{bridge,kit}.ts`, `core/walletconnect/index.ts`, handlers `wc*` | | T1 (peer declared) |
| DAPP-18 | Approval UI view model (decode calldata, approvals/unlimited detection, simulation, typed summary, display text sanitising) | `background/provider/view.ts`, `core/provider/decode.ts`, `displayText.ts` | | T2 |
| DAPP-19 | Inpage/content script registration (MAIN world, all frames, persistAcrossSessions) | `provider/index.ts registerInpage/registerContentBridge` | | T3 |
| DAPP-20 | Provider GC & tab/window cleanup (reject on approval window close) | `provider/index.ts initProviderBackground` | | T3 |

### A4. Extension platform security (EXT)
| ID | Feature | Source | Notes |
|---|---|---|---|
| EXT-01 | Manifest permissions, min Chrome 137, host permissions (loopback only for local builds) | `manifest.config.ts` |
| EXT-02 | CSP with Trusted Types `'none'`, no remote script | `manifest.config.ts` |
| EXT-03 | Internal sender authorization (`isInternalWalletSender`), `stripExternalFlags` | `background/accessPolicy.ts`, `kernel/events.ts:20-24` |
| EXT-04 | storage.session & storage.local pinned to TRUSTED_CONTEXTS | `background/index.ts:48-52` |
| EXT-05 | Event registry (duplicate names throw; unknown → `unknown_message`; handler errors redacted) | `kernel/events.ts` |
| EXT-06 | UI port `harbour-ui` (snapshot + patches; id-tagged requests) | `kernel/port.ts` |
| EXT-07 | Boot pipeline with retries (20×2 s), persisted job queue, WASM self-heal (1/h) | `kernel/boot.ts` |
| EXT-08 | Store migrations (versioned tuple, resumable) & hydration (unknown slices dropped, transient slices not persisted) | `background/store/*` |
| EXT-09 | Service-worker restart resilience (pending approvals in session storage, bundles in session, provider re-init, WC resume, alarms) | `provider/index.ts`, `store.ts`, `walletconnect/bridge.ts` |
| EXT-10 | Settings (auto-lock options ≤240 min, locale, currency, developer settings incl. eth_sign, weakensSecurity → manage grant) | `core/settings.ts:14-148`, `background/settingsService.ts`, handlers `getSettings/setSettings` |
| EXT-11 | Signed remote config (Ed25519 over exact JSON, version monotonic, optional expiry, kill switches) | `kit/remoteConfig.ts`, handlers `getRemoteConfig/refreshRemoteConfig` |
| EXT-12 | Feature flags & signing policy | `core/harbour/policy.ts` |
| EXT-13 | Offscreen clipboard document | `background/clipboard.ts`, `offscreen/clipboard.ts` |
| EXT-14 | Release signing / verification, frozen secure-code check, audit gate, bundle secret scan | `scripts/release.mjs`, `verify-release.mjs`, `check-frozen.mjs`, `audit-gate.mjs`, `verify.mjs` |
| EXT-15 | Popup secure field / reveal gate / reauth modal (UI never holds secrets; inputs cleared) | `popup/secureField.tsx`, `popup/wallet/revealGate.tsx`, `popup/reauthModal.tsx`, `popup/wallet/SeedCanvas.tsx` |
| EXT-16 | Notifications (Web Push via GCM, activity poll alarm, notify rules) | `background/notify.ts`, `core/notifyRules.ts`, `background/harbour.ts` |

### A5. Transaction UX safety (UX)
| ID | Feature | Source |
|---|---|---|
| UX-01 | Calldata decoding (transfer, approve, setApprovalForAll, permit, multicall flatten ≤3), unlimited threshold ≥2^159 | `core/provider/decode.ts` |
| UX-02 | Spending-cap editing (`setApproveAmount`) MetaMask-style | `decode.ts:74-81`, `popup/wallet/features/provider.tsx` |
| UX-03 | Simulation (backend full/basic; Solana sim) shown pre-sign | `api/send.go handleSimulate`, `core/provider/simulate.ts`, `solSim.ts` |
| UX-04 | Approvals scan & revoke (allowance multicall over known pairs, local ledger) | `core/approvalScan.ts`, `core/approvals.ts`, handlers `approvalsScan/approvalsRevoke` |
| UX-05 | Address book, address validation, contract-recipient warning, scam-address check | `core/addressBook.ts`, `handlers/chainSend.ts sendValidateAddress`, `phishing.ts addressRisk`, `sendService.ts` |
| UX-06 | Amount/decimals/rounding (parseUnits/formatUnits, toAtomic/fromAtomic, MAX_DECIMALS 36, fiat formatting, low balance) | `core/chains/send/util.ts:18-30`, `core/swap/amount.ts`, `core/erc20.ts:27-97`, `core/fiat.ts`, backend `api/read.go formatUnits/valueUSD` |
| UX-07 | Token metadata spoofing defences (cleanText, spam score, verified flag, NFT spam) | `core/erc20.ts:33`, `internal/indexer/spam.go`, `core/nfts/spam.ts` |
| UX-08 | Display text sanitising (plainLabel, bidi/control chars) | `core/provider/displayText.ts` |
| UX-09 | Swap safety (aggregator tx must match quote: LI.FI diamond target, receiver = self, minAmount vs slippage, dangerous selectors, Jupiter program, Solana tx parsing) | `core/swap/safety.ts` |
| UX-10 | Fee tiers & max-cost display (backend estimate slow/normal/fast, +20% gas buffer except 21000) | `api/send.go handleEstimate`, `core/gasFees.ts` |
| UX-11 | User-facing error text mapping (backend friendlyChainError, extension userText) | `api/send.go:168-188`, `core/errors.ts` |

### A6. Smart accounts (SA)
| ID | Feature | Source |
|---|---|---|
| SA-01 | Pinned constants (EntryPoint v0.7, delegates, paymasters, limits per chain) | `core/smartAccount/constants.ts` |
| SA-02 | Guard: intent check (chain, from=account, 1..16 calls, protected targets, self-call) | `core/smartAccount/guard.ts checkIntent` |
| SA-03 | Delegation state from code (none/pinned/other) | `guard.ts delegationState`, `core/evmCode.ts` |
| SA-04 | Gas price / estimate / sponsorship reply acceptance with bounds | `guard.ts acceptGasPrice/acceptGasEstimate/…` |
| SA-05 | Enable (type-4 authorization, fixed gas 150k) / revoke delegation | `background/smartAccountService.ts`, `core/smartAccount/delegation.ts` |
| SA-06 | User-op build/sign/send, inclusion verification from receipt logs | `core/smartAccount/{userOp,send}.ts` |
| SA-07 | EIP-5792 wallet_sendCalls / getCallsStatus / getCapabilities / showCallsStatus | `core/smartAccount/calls5792.ts`, `service.ts` |
| SA-08 | ERC-7715 execution permissions (≤30 days, native/erc20 allowance), grant store | `core/smartAccount/{permissions,permissionDelegation,grantStore}.ts`, `background/grants.ts` |
| SA-09 | Sponsorship (first op sponsored under server-pinned policy; testnets unpinned) | `api/gateway.go:315-398` (backend), `smartAccountService.ts` |
| SA-10 | Availability gating (remote flag + wallet type + chain) | `policy.ts smartAccountsAvailable` |

### A7. Chains, networks, tokens (CH)
| ID | Feature | Source |
|---|---|---|
| CH-01 | Chain registry (generated chain list, testnets, adapters, rpcUrls, network registry) | `core/chains/*`, `core/harbour/chainList.gen.ts`, `core/networkRegistry.ts` |
| CH-02 | Custom networks (validate, probe chain id, save, remove, RPC overrides) | `core/networks.ts`, handlers `networkList/Save/Remove` |
| CH-03 | Custom tokens (probe ERC-20, add/remove, ≤100) | `core/customTokens.ts`, `core/erc20.ts`, handlers `token*`, `chainDataToken*` |
| CH-04 | Balances (backend portfolio + direct chain adapters) | `core/balanceService.ts`, handlers `getBalances`, `walletBalances`, `chainDataBalance` |
| CH-05 | Send (quote, submit, tx list/detail, support matrix, NFT send) | `handlers/chainSend.ts`, `core/chains/send/*`, `core/nfts/transfer.ts` |
| CH-06 | RPC routing: Harbour-served chains via signed `/v1/rpc`, broadcasts via `/v1/tx/.../broadcast`, unserved chains fall back to public RPC (10 min) | `core/harbour/fetchHook.ts`, `core/chains/rpcUrls.ts` |
| CH-07 | Failover fetch (pools, breakers, retries, slow-method allowances) | `kit/failoverFetch.ts`, `kit/failover.ts`, `kit/netStatus.ts` |

### A8. DeFi & third-party features (DEFI)
| ID | Feature | Source |
|---|---|---|
| DEFI-01 | Swap engine (LI.FI, Jupiter, Relay, THORChain), quote/approve/submit/status/history, dust scan/convert, slippage rules | `core/swap/*`, `background/swapService.ts`, `modules/swap.ts` |
| DEFI-02 | Staking (EVM, Cosmos, Solana, Polkadot, Tron, Tezos, Cardano) list/prepare/submit | `core/staking/*`, `handlers/earn*.ts` |
| DEFI-03 | Testnet DeFi (Aave v3 pool/gateway, Uniswap universal router), catalog/prepare/submit | `integrations/testnet-defi/*`, `handlers/testnetDefi.ts` |
| DEFI-04 | Perps (Hyperliquid agent key, deposit/withdraw/order/cancel/close) | `core/perps/hyperliquid.ts`, `handlers/perps.ts` |
| DEFI-05 | Predictions (Polymarket creds, wrap, order) | `core/predictions/polymarket.ts`, `handlers/predictions.ts` |
| DEFI-06 | Ramps (providers, quotes, checkout URLs, CEX deposit, P2P, recurring ICS, user API keys) | `core/ramps/*`, `handlers/ramps.ts` |
| DEFI-07 | Market data (prices, charts, trending, sentiment, discover dApps, help) | `core/{marketData,priceService,tokenPrice}.ts`, `core/sentiment`, `core/discover`, `modules/market.ts`, `handlers/discover.ts` |
| DEFI-08 | NFTs (list via backend/Alchemy/Blockscout/Solana/onchain, add/remove/report, media proxy URLs, transfer) | `core/nfts/*`, `handlers/nfts.ts` |

### A9. Activity & data (DATA)
| ID | Feature | Source |
|---|---|---|
| DATA-01 | Activity engine (scanner, classify, merge, filter, EVM, broadcast tap, pending reconcile alarm) | `core/activity/*`, `background/activityRuntime.ts` |
| DATA-02 | Tx history (backend history, per-chain adapters history) | `core/txHistory.ts`, `core/chains/adapters/history.ts`, `modules/market.ts txHistory` |
| DATA-03 | Address sync to backend (WALLET_CHANGES → PUT /v1/me/addresses) | `background/harbour.ts scheduleAddressSync/syncAddresses` |
| DATA-04 | Realtime (Centrifugo token, subscriptions while UI open, reconnect after broadcast) | `background/harbour.ts wireRealtime`, `kernel/port.ts onUiOpenChange` |
| DATA-05 | Device identity & registration (non-extractable Ed25519, PoW ≤26 bits, Web Lock, re-register only on device_unknown) | `core/harbour/device.ts`, `core/harbour/client.ts:26-44` |
| DATA-06 | Response schema checks for backend data | `core/harbour/schema.ts`, `client.ts checkPortfolio/checkNfts/checkAddresses` |

### A10. Backend API (BE)
| ID | Endpoint / feature | Source | Inputs | Outputs | State / side effects | Error paths | Trust |
|---|---|---|---|---|---|---|---|
| BE-01 | Router, middleware (Recoverer, accessLog route-only, securityHeaders, 1 MiB body, realIP) | `internal/api/server.go:150-198, 240-330, 360-373` | HTTP | — | — | 413 via MaxBytesReader | T0 |
| BE-02 | `GET /healthz` | `server.go:156` | — | ok / 503 | — | DB or Redis down | T0 |
| BE-03 | `POST /v1/devices/challenge` (per-IP/h limit, 32-byte challenge, difficulty, TTL) | `auth.go:48-81` | — | challenge | Redis `hb:pow:*`, `hb:chal:*` | 429, 500 | T0 |
| BE-04 | `POST /v1/devices` (PoW, key proof, single-use challenge, global hourly ceiling, attestation ≤4 KiB) | `auth.go:109-172` | public_key, challenge, pow_counter, signature, attestation | device_id, tier, quotas | `devices` row | 400 bad_key/challenge_expired/bad_pow/bad_signature, 409, 429 busy | T0 |
| BE-05 | Effective tier & probation | `auth.go:177-186` | tier, created, now | tier | — | — | T3 |
| BE-06 | Device auth middleware (uuid, nonce 16–64, date skew, body hash, revocation, nonce replay SETNX, auth-failure budget 30/min/IP, devCache 1 min, touch) | `auth.go:272-352` | headers + body | ctx device | Redis nonce; last_seen_at | 401 unauthorized/clock_skew/device_unknown/device_revoked, 429 | T1 |
| BE-07 | Per-device rate limit (per-minute counter), daily counter Lua | `auth.go:354-403` | device | — | Redis | 429 | T1 |
| BE-08 | Idempotency (key ≤128, SETNX pending, replay with req-hash match, scrubbing, no caching of 5xx/429/409) | `auth.go:405-535` | Idempotency-Key | replay | Redis `hb:idem:*` | 409 in_progress, 422 mismatch | T1 |
| BE-09 | Security event logging (keyed tags) | `auth.go:537-554` | — | log | — | — | T3 |
| BE-10 | `GET /v1/me` | `handlers.go:17-25` | — | device, tier, quotas, chains | — | — | T1 |
| BE-11 | `GET /v1/me/addresses` | `handlers.go:39-51` | — | addresses | — | 500 | T1 |
| BE-12 | `PUT /v1/me/addresses` (1..100 changes, normalise, dedupe, remove, backfill daily quota, max addresses, address.added events, push route sync) | `handlers.go:66-148` | add[], remove[] | added, removed | `tracked_addresses`, `device_addresses`, device_count, Redis bf | 400 bad_request/bad_address, 429 backfill_quota, 403 quota_exceeded | T1 |
| BE-13 | `POST /v1/rpc/{chain}` (allowlisted methods, batch ≤MaxBatch, eth_getLogs canonical filter, re-marshal, RPC quota, session pin, 8 MiB cap, strip upstreamsTried) | `handlers.go:152-302` | JSON-RPC | JSON-RPC | Redis | JSON-RPC errors (method_not_allowed, bad_request, rate_limited, gateway_unavailable, response_too_large) | T1 |
| BE-14 | `GET /v1/me/portfolio` (+ addresses filter, cache) | `read.go:200-265` | addresses? | holdings, value_usd | cache Redis | 400/403 | T1 |
| BE-15 | `GET /v1/me/portfolio/chart` | `read.go:509-540` | range | points | — | 400 | T1 |
| BE-16 | `GET /v1/me/history` (cursor, limit, triggers LoadOlder) | `read.go:317-440` | addresses, cursor, limit | items, cursor | NATS refresh | 400 bad cursor | T1 |
| BE-17 | `GET /v1/me/nfts` (+ NFT sync request) | `read.go:441-507` | addresses | items | nft_dirty | — | T1 |
| BE-18 | `GET /v1/assets/{chain}/{asset}` and `/prices` | `read.go:542-606` | chain, ref, range | asset, series | — | 404 | T1 |
| BE-19 | `GET /v1/tx/{chain}/{hash}` (indexed view only to involved device; pending view only to sender device; else chain view) | `media.go:30-117` | chain, hash | status | — | 400, 404 unknown_tx, 503 | T1 |
| BE-20 | `POST /v1/tx/{chain}/estimate` (sender must be tracked, nonce, gas +20%, EIP-1559 tiers slow/normal/fast or legacy) | `send.go:192-257` | from,to,value,data | fees | — | 404 unknown_chain, 400 unsupported/bad_address/bad_request, 403 not_tracked, 422 friendly, 503 network_busy, 429 | T1 |
| BE-21 | `POST /v1/tx/{chain}/simulate` (simulator full mode else eth_call + estimate basic) | `send.go:273-327` | tx | changes, warnings | — | as above, 30/min | T1 |
| BE-22 | `POST /v1/tx/{chain}/broadcast` (decode, chain id match, recover sender, ownership, 10/min, already-known, hash mismatch override, pending insert, tx.status event, realtime channel token) | `send.go:338-406` | raw | tx_hash, status, nonce, channel | `pending_transactions`, NATS | 400 bad_transaction/wrong_network, 403, 422, 503, 500 after send | T1 |
| BE-23 | `POST /v1/realtime/token` (connection + per-channel subscription JWTs, 1 h) | `realtime.go:25-71` | — | url, token, subscriptions | — | 503 unavailable | T1 |
| BE-24 | `GET /v1/push/vapid` | `realtime.go:73-81` | — | public key | — | 503 | T0 |
| BE-25 | `PUT/DELETE /v1/me/push` (https endpoint on known push hosts, p256dh 65 B, auth 16 B, route tags) | `realtime.go:89-140` | subscription | enabled | `push_subscriptions`, `push_routes` | 400 bad_subscription | T1 |
| BE-26 | `GET /v1/media/{key}` (32-hex key, 600/min/IP, negative cache, SSRF-safe client, decode/resize/re-encode PNG, 10 MiB, 16 Mpx, CSP sandbox) | `media.go:199-427` | key | PNG | Redis cache | 404, 429, 503 busy | T0 |
| BE-27 | Address normalisation (EVM only; others "not supported yet") | `server.go:332-349` | chain, addr | lowercase | — | errors | T3 |
| BE-28 | Real IP from trusted proxies (right-to-left XFF), client IP /64 for IPv6 | `server.go:251-330` | headers | RemoteAddr | — | — | T0 |
| BE-29 | Config load/validate/defaults, restrict chains, dotenv, secret files, key decoding | `internal/config/config.go:190-520`, `secrets.go:11` | files/env | Config | — | validation errors | T4 |
| BE-30 | DB TLS requirement (verify-full except loopback unless HB_ALLOW_INSECURE_DB=1) | `internal/store/store.go:29-46` | URL | — | — | refuse insecure | T4 |
| BE-31 | `migrate` command (advisory lock, per-file txn, role check, app/service logins, -maintain partitions + pruning) | `cmd/migrate/main.go`, `store.go:68-150` | env | — | schema | die on failure | T4 |
| BE-32 | Dev tools `hbdevice`, `hbkeys`, `hbverify`, TS client `clients/ts` | `cmd/hb*`, `clients/ts/*` | CLI | — | — | — | T4 |

### A11. Third-party gateway `/v1/gw/*` (GW)
| ID | Route | Source (`internal/api/gateway.go`) | Validation |
|---|---|---|---|
| GW-01 | per-device gateway quota | `:1082-1100` | tier-based counter |
| GW-02 | `/v1/config` signed remote config passthrough | `:1136-1144` | 404 when unset |
| GW-03 | `/v2/market/prices` | `:667` | coin-id regex, ≤100 ids, sorted, post-processed |
| GW-04 | `/v2/market/charts`, `/info`, `/tickers`, `/trending` | `:705-750` | coin regex, days set, ticker param regexes |
| GW-05 | `/gt/*` GeckoTerminal | `:751` | path regex, cleanQuery (9 keys, value regex) |
| GW-06 | `/rss/{feed}` | `:764` | fixed feed map |
| GW-07 | `/lifi/v1/*` | `:770` | path regex, rawQuery ≤2048, GET/POST; body forwarded as-is |
| GW-08 | `/uniswap/v1/*` | `:776` | POST, key configured, no query, body chain ids all == 11155111 (depth ≤12) |
| GW-09 | `/jup/swap/v1/*`, `/jup/tokens/v2/search` | `:786-797` | path regex; search: single `query` regex |
| GW-10 | `/relay/*`, `/thornode/*` | `:798-818` | path regex, methods |
| GW-11 | `/helius/rpc` | `:819` | jsonRPCClean + solRPCMethods + boundedSolana (getProgramAccounts only Stake program with staker/withdrawer memcmp) |
| GW-12 | `/alchemy/{chainId}/rpc` (via rpc-gateway when served) | `:827` | jsonRPCClean + evmRPCMethods + boundedLogs (address/topic required, ≤2000 blocks or blockHash) |
| GW-13 | `/alchemy/{chainId}/nft/{method}` | `:853` | 6 methods, cleanQuery (24 params) |
| GW-14 | `/etherscan/v2` | `:867` | module:action regex, chainid digits, drops apikey, ≤8 values/key, ≤200 chars |
| GW-15 | `/trongrid/*`, `/toncenter/*` | `:890-903` | path regexes, methods |
| GW-16 | `/pimlico/{chainId}` | `:904-922` | 7 chain ids, aaRPCMethods, unpinned sponsorship testnets only, policy pinning (context replaced) |
| GW-17 | JSON-RPC strict parser (exact 4 lowercase keys, no duplicates/case variants, string method, no trailing data, batch ≤50) | `:205-312` | |
| GW-18 | Canonical eth_getLogs filter | `:400-462` | exact 5 keys, once each |
| GW-19 | Upstream run/fetch/cache, 4 MiB cap, auth failures → 502, key scrubbing | `:946-1080` | |

### A12. RPC gateway, indexer, ingest, workers (IDX)
| ID | Feature | Source |
|---|---|---|
| IDX-01 | rpc-gateway HTTP (bearer token constant-time compare; `/rpc/{chain}`, `/status`, `/metrics`, `/healthz`) | `internal/gateway/server.go:21-60`, `cmd/rpc-gateway/main.go:33-47` |
| IDX-02 | Pool member selection (score, head freshness, minBlock, exclusions), session pinning | `internal/gateway/pool.go:86-290` |
| IDX-03 | Hedged requests, user-facing priority, retries across members | `internal/gateway/gateway.go:251-380` |
| IDX-04 | Circuit breaker & latency windows, token buckets | `internal/gateway/health.go` |
| IDX-05 | Response cache with finality-aware policy, block-ref parsing | `internal/gateway/cache.go:37-269` |
| IDX-06 | Singleflight de-duplication | `internal/gateway/flight.go` |
| IDX-07 | Broadcast fan-out & already-known handling | `gateway.go:381-456` |
| IDX-08 | eth_getLogs splitting for background calls | `gateway.go:458+` |
| IDX-09 | Head polling (latest/finalized), LocalHead for eth_blockNumber | `pool.go:301-431`, `internal/rpchttp/rpchttp.go:148-260` |
| IDX-10 | Upstream HTTP client (URL build with keys, snippet errors, quantity parsing) | `internal/rpchttp/rpchttp.go` |
| IDX-11 | Indexer backfill (claim job, dormant probe, history window, capped/skipped/failed states, cursor) | `internal/indexer/indexer.go:304-476`, `store/indexer.go:31-90` |
| IDX-12 | Ingest events (dedupe via event_keys, partitions on demand, assets upsert, transfers/transactions/activity, amounts validated) | `store/indexer.go:247-560` |
| IDX-13 | Balance refresh / sweep / debouncer, settled refresher | `indexer.go:553-650, 700-786`, `refresh.go` |
| IDX-14 | NFT sync (lazy, dirty flag), media key HMAC | `indexer.go:477-495, 651-700`, `store/indexer.go:669-717` |
| IDX-15 | Live webhooks management (subscribe/unsubscribe batches, public URL probe, encrypted signing keys) | `indexer/live.go:68-392`, `store/live.go:26-128` |
| IDX-16 | Delivery handling → ingest, promote dormant, NFTs moved, incoming publish | `live.go:393-540` |
| IDX-17 | Gap-fill (ingest-down detection, per-chain candidates, safety margin) | `live.go:555-645`, `ingest.go Start/RunHeartbeat` |
| IDX-18 | Reorg repair (unfinal txs vs chain, remove events, re-ingest), finalization marking | `live.go:673-786`, `store/live.go:293-410` |
| IDX-19 | Spam scoring | `indexer/spam.go:16` |
| IDX-20 | webhook-ingest receive (8 MiB, webhook id → cached decrypted key, HMAC verify, unparseable stored, replay window, delivery record, JetStream publish) | `internal/ingest/ingest.go:109-215`, `adapters/sources/alchemy/webhooks.go:93-107` |
| IDX-21 | tx-tracker (due pending, backoff, receipt → confirmed/failed/dropped/replaced, publish, prune) | `internal/txtrack/txtrack.go`, `store/send.go:14-90` |
| IDX-22 | notifier (activity/tx → Web Push, safe symbol/amount formatting, route lookups) | `internal/notifier/notifier.go`, `adapters/notify/webpush/webpush.go` |
| IDX-23 | price-poller (held assets, sources priority, ticks, cache, snapshots, prune) | `internal/prices/*`, `store/prices.go` |
| IDX-24 | realtime-bridge (NATS → Centrifugo publish), JWT HS256 with aud | `internal/realtime/*` |
| IDX-25 | NATS JetStream bus (durable consumers) / Log bus | `internal/events/events.go` |
| IDX-26 | Adapters: Alchemy/Infura/URL RPC factories; Alchemy source (history, balances, NFTs, webhooks); CoinGecko/Alchemy prices; Alchemy risk simulator; EVM client/ABI; registry | `adapters/**`, `internal/registry` |
| IDX-27 | Rate limiter (token bucket wait) | `internal/ratelimit/ratelimit.go` |
| IDX-28 | EVM raw tx decode / sender recovery / RLP encode | `internal/evmtx/*` |
| IDX-29 | Device-signature protocol (canonical string, PoW, nonce format) | `internal/devicesig/devicesig.go` |
| IDX-30 | LinkCrypto (AES-GCM link blobs with device AAD, HMAC blind index, device/key/route tags) & SecretBox | `internal/store/devices.go:72-156, 350-387` |

### A13. Database (DB)
| ID | Object | Source | Constraints / notes |
|---|---|---|---|
| DB-01 | `chains` | `migrations/0001_init.sql:6` | PK chain_id |
| DB-02 | `assets` | `0001:13`, `0002 kind`, `0010 asset_ref→bytea` | UNIQUE(chain_id, asset_ref); FK chains; kind CHECK; spam_score |
| DB-03 | `devices` | `0001:28` | public_key UNIQUE, length=32 CHECK; revoked_at |
| DB-04 | `tracked_addresses` | `0001:38`, `0002`, `0004`, `0009` | UNIQUE(chain, address); backfill_state CHECK (+dormant in 0009); device_count; webhook FK SET NULL; nft_dirty |
| DB-05 | `device_addresses` | `0001:55`, `0008` | PK link_hash; FK devices CASCADE; added_at day-truncated |
| DB-06 | `event_keys` | `0001:65`, `0010` | PK(chain, tx_hash, event_ref) dedupe |
| DB-07 | `transactions` (monthly RANGE partitions) | `0001:72`, `0010` | finality CHECK; NUMERIC(78,0) fee |
| DB-08 | `transfers` (monthly RANGE partitions) | `0001:89`, `0004 transfers_unfinal`, `0010` | FK assets; NUMERIC(78,0) amount |
| DB-09 | `price_ticks` | `0001:109` | PK(asset_id, ts) |
| DB-10 | `balances` | `0001:118`, `0002 balances_asset`, `0005 balances_held` | PK(tracked, asset); FK CASCADE |
| DB-11 | `nft_holdings` | `0001:127`, `0005` | PK(tracked, asset, token_id); media_key index |
| DB-12 | `address_activity` (HASH ×32) | `0001:138` | direction CHECK; PK(tracked, tx_hash); page index |
| DB-13 | `balance_snapshots` | `0001:155` | PK(tracked, day, asset) |
| DB-14 | `pending_transactions` | `0001:163`, `0006`, `0010` | state CHECK; device FK SET NULL; pending_due index |
| DB-15 | `webhooks`, `webhook_deliveries`, `service_heartbeats` | `0004` | encrypted signing key; delivery PK(source, id) |
| DB-16 | `push_subscriptions`, `push_routes` | `0006` | one sub per device; route_tag keyed HMAC |
| DB-17 | Partition functions `harbour_ensure_monthly_partitions`, `harbour_ensure_partition` (SECURITY DEFINER, UTC, partman-aware) | `0001:177`, `0002:24`, `0003:3` | |
| DB-18 | Codec functions `hb_ref`, `hb_ref_text`, `hb_refs` (IMMUTABLE) | `0010:15-40` | |
| DB-19 | Roles & grants (`harbour_api`, `harbour_indexer`, `harbour_prices`, `harbour_tracker`, `harbour_app`, default privileges) | `0001:219`, `0002:50`, `0004:47`, `0005:14`, `0006:30`, `0008:13`, `0010:63` | |
| DB-20 | Data migrations: 0003 failed→pending, 0004 device_count=1, 0007 delete EIP-7708 pseudo-transfers, 0008 day-truncate added_at, 0009 nft flags, 0010 summary compaction + bytea conversion | each file | data-preserving requirement |
| DB-21 | Migration runner (`schema_migrations`, advisory lock 7263001, per-file txn, lexical order) | `internal/store/store.go:68-118` | |
| DB-22 | App login creation (role-name regex, ≥16-char password, quote_ident/literal, must differ from owner) | `store.go:160-189` | |
| DB-23 | Retention: deliveries 7 days, pending prune, price_ticks/snapshots prune | `store/live.go:136`, `store/send.go:47`, `store/prices.go:75` | |

### A14. Cross-cutting (X)
| ID | Concern | Where |
|---|---|---|
| X-01 | Numeric precision: BigInt everywhere for amounts; Go big.Int; NUMERIC(78,0); float only for USD | extension `core/**`, backend `read.go valueUSD` |
| X-02 | Time: unix seconds in auth (skew window), UTC days for counters, partitions UTC, monthly boundaries, JS Date in TTLs | `auth.go`, `0003`, `reauth.ts`, `store.ts` |
| X-03 | Locale / i18n (supported locales, intl tags, fiat formatting) | `core/settings.ts:28-46`, `core/fiat.ts` |
| X-04 | Serialization round-trips (vault JSON, keystore JSON, cursors base64 JSON, hb_ref, RLP, canonical strings) | many |
| X-05 | Versioning / backward compat (KDF v1/v2, passworder v1/v2, store tuple, migrations, PT-06 WC sessions, legacy passkey seal, legacy device seed) | as cited |
| X-06 | Feature flags (build + signed remote) | `policy.ts`, `remoteConfig.ts` |
| X-07 | Config/env (VITE_HB_API_URL secure check, ENABLED_CHAINS, backend env/secret files) | `core/harbour/config.ts`, `scripts/api-url.mjs`, `internal/config` |
| X-08 | Dependency risk (npm audit gate, govulncheck, pinned versions, overrides axios/ws) | `scripts/audit-gate.mjs`, `package.json`, `go.mod` |
| X-09 | Concurrency (vault queue, creatingWallet flag, Web Locks for device, Redis SETNX, advisory lock, FOR UPDATE quota, singleflight) | as cited |

---------------------------------------------------------------------------------------------------------------------------------

## Part B. Threat model

### B1. Assets (ranked)
1. **A1 User key material**: mnemonics, private keys, keystore passphrase (passwordKey), vault unlock key, PRF secrets, perps agent keys, Polymarket creds. Loss = total, irreversible fund loss.
2. **A2 Signing authority**: the ability to make the wallet produce a signature/broadcast (approvals, permits, 7702 delegation, 7715 grants, sponsored ops).
3. **A3 User password** (offline guessable from a stolen profile).
4. **A4 Integrity of what the user is shown** before signing (recipient, amount, chain, spender, simulation, site identity).
5. **A5 Privacy**: device ↔ address linkage, balances, history, IP; server must not be able to group addresses into wallets.
6. **A6 Backend provider budget & keys** (Alchemy/Infura/Helius/Pimlico/LI.FI/Uniswap/Etherscan keys, sponsorship balance).
7. **A7 Availability** of wallet and backend (DoS, quota exhaustion, registration lock-out).
8. **A8 Data integrity** of indexed history/balances (forged webhooks, reorgs, replay).
9. **A9 Release integrity** (signed builds, remote config).

### B2. Attackers
| ID | Attacker | Capabilities |
|---|---|---|
| ATK-1 | Malicious website / dApp | arbitrary JS in MAIN world, iframes, crafted provider requests, phishing UI, clickjacking, rapid request floods, hostile typed data/tx |
| ATK-2 | Compromised renderer / content-script context | read/modify page-world and content-script messages, chrome.storage of untrusted contexts (mitigated), IndexedDB of page origin |
| ATK-3 | Malicious extension page context / XSS in popup | DOM access, can call internal router as legit sender |
| ATK-4 | Physical / profile thief | copy of browser profile (IndexedDB, storage), offline brute force |
| ATK-5 | Network attacker / hostile RPC / hostile aggregator / hostile bundler-paymaster | tamper responses, return malicious tx data, gas numbers, chain ids |
| ATK-6 | Malicious registered device (API client) | signed requests, quota abuse, IDOR attempts, cache poisoning, key-budget abuse via /v1/gw, address enumeration |
| ATK-7 | Anonymous internet client | registration spam, PoW grinding, auth-failure probing, media SSRF, webhook forgery |
| ATK-8 | Insider with DB/Redis read | try to link devices↔addresses, read secrets |
| ATK-9 | Compromised upstream provider | forged webhooks (without key), malicious NFT URLs/metadata, spam tokens |
| ATK-10 | WalletConnect peer | declared metadata spoofing, request floods |
| ATK-11 | Supply-chain | malicious dependency, tampered release/config |

### B3. Abuse cases (each mapped to features and later to tests)
| ID | Abuse case | Attacker | Features |
|---|---|---|---|
| AB-01 | Read mnemonic/private key/password via any UI response, store patch, log line, error text or DOM | ATK-3 | KEY-30, KEY-31, EXT-06, KEY-18, KEY-19 |
| AB-02 | Page calls internal router (`runtime.sendMessage`) to sign/reveal/export | ATK-1/2 | EXT-03, DAPP-07 |
| AB-03 | Content script/renderer reads vault/keystores from storage | ATK-2 | KEY-22, EXT-04 |
| AB-04 | Offline brute force of stolen vault / downgrade KDF params / tamper KDF record to huge memory | ATK-4 | KEY-03, KEY-05, KEY-07 |
| AB-05 | Online brute force of password via unlock/checkPassword in parallel | ATK-3 | KEY-06, KEY-09 |
| AB-06 | Reveal/backup/remove/enrol-biometrics without fresh auth; reuse a grant across wallets | ATK-3 | KEY-20, KEY-21, KEY-25 |
| AB-07 | Sign for another account / chain than connected; switch chain or account while request pending | ATK-1 | SIG-01..05, DAPP-09 |
| AB-08 | Blind-sign hashes (eth_sign), Permit/Permit2/unlimited approvals, setApprovalForAll disguised | ATK-1 | SIG-02, SIG-03, UX-01, UX-02 |
| AB-09 | Cross-chain replay (EIP-712 domain chain mismatch, legacy no-chainId tx) | ATK-1 | SIG-03, SIG-10 |
| AB-10 | Origin spoofing via iframe, sandbox (`null`) origin, extension URLs, http origins, punycode | ATK-1 | DAPP-07, DAPP-15 |
| AB-11 | Prototype pollution / oversized / deeply nested params, duplicate ids, request floods | ATK-1 | DAPP-04..06, DAPP-10 |
| AB-12 | wallet_addEthereumChain pointing at LAN/metadata (SSRF from wallet) or lying chain id | ATK-1 | DAPP-11 |
| AB-13 | Token metadata spoofing (fake symbol/decimals), address poisoning, bidi text | ATK-1/9 | UX-05..08 |
| AB-14 | Aggregator returns tx that sends funds elsewhere / approves attacker / lowers minOut | ATK-5 | UX-09 |
| AB-15 | Bundler/paymaster returns huge gas/fees, foreign paymaster, foreign delegate; dApp batch targets DelegationManager | ATK-5/1 | SA-01..09 |
| AB-16 | Device signature forgery, replay, clock skew abuse, revoked device continuing | ATK-6/7 | BE-06, IDX-29 |
| AB-17 | IDOR: read/simulate/broadcast for addresses not tracked; learn other users' addresses via /v1/tx; cache cross-talk | ATK-6 | BE-12..22 |
| AB-18 | Use /v1/gw as open relay for provider keys (debug_* methods, case/duplicate JSON keys, unbounded logs, program scans, mainnet sponsorship, mainnet Uniswap) | ATK-6 | GW-* |
| AB-19 | SSRF through media proxy (private IPs, DNS rebinding, redirects), decompression bombs | ATK-9/7 | BE-26 |
| AB-20 | Webhook forgery/replay to inject fake history/balances | ATK-7/9 | IDX-20, IDX-16 |
| AB-21 | Registration flood / global ceiling exhaustion / challenge reuse | ATK-7 | BE-03, BE-04 |
| AB-22 | DB/Redis insider links device↔address | ATK-8 | IDX-30, DB-05, BE-08 |
| AB-23 | SQL injection / role escalation via migrations or app-login creation | ATK-8/4 | DB-21, DB-22 |
| AB-24 | Downgrade or replay remote config (re-enable killed provider) | ATK-5/11 | EXT-11 |
| AB-25 | QR import code brute force / malicious QR (memory/KDF exhaustion, WASM abort) | ATK-1 (screen), crafted QR | KEY-24 |
| AB-26 | Service-worker restart mid-approval leads to double-send or orphaned approval | ATK-1 | EXT-09, DAPP-09 |
| AB-27 | Information leakage in errors/logs (upstreamsTried, keys in URLs, raw node errors) | ATK-6 | BE-01, BE-13, GW-19, KEY-31 |
| AB-28 | Numeric errors: overflow/negative balances, decimals abuse (negative/huge), rounding up amounts | ATK-9/1 | UX-06, X-01, AMB-07 |
| AB-29 | Release tampering / malicious dependency | ATK-11 | EXT-14, X-08 |

---------------------------------------------------------------------------------------------------------------------------------

## Part C. Exhaustive generated index

Generated by `qa/tools/gen-index.mjs` + `gen-partc.mjs` from source at HEAD. Every row is a callable entry point or code unit with its location and owning Feature ID.

### C1. INTERNAL message handlers (182) — caller trust T2 (extension UI only, enforced by EXT-03)

| ID | Message | Source | Feature |
|---|---|---|---|
| MSG-001 | `activity` | `apps/extension/src/background/modules/wallet.ts:150` | DATA-01 |
| MSG-002 | `addAccount` | `apps/extension/src/background/modules/wallet.ts:173` | KEY-26 |
| MSG-003 | `addressBookList` | `apps/extension/src/background/modules/settingsCore.ts:39` | UX-05 |
| MSG-004 | `addressBookRemove` | `apps/extension/src/background/modules/settingsCore.ts:61` | UX-05 |
| MSG-005 | `addressBookSave` | `apps/extension/src/background/modules/settingsCore.ts:46` | UX-05 |
| MSG-006 | `addWallet` | `apps/extension/src/background/modules/wallet.ts:255` | KEY-15/KEY-24 |
| MSG-007 | `announcements` | `apps/extension/src/background/handlers/discover.ts:45` | DEFI-07 |
| MSG-008 | `approvalsRevoke` | `apps/extension/src/background/handlers/approvals.ts:69` | UX-04 |
| MSG-009 | `approvalsScan` | `apps/extension/src/background/handlers/approvals.ts:46` | UX-04 |
| MSG-010 | `backupBegin` | `apps/extension/src/background/handlers/secrets.ts:86` | KEY-18 |
| MSG-011 | `backupCancel` | `apps/extension/src/background/handlers/secrets.ts:122` | KEY-18 |
| MSG-012 | `backupCheck` | `apps/extension/src/background/handlers/secrets.ts:104` | KEY-18 |
| MSG-013 | `backupFinish` | `apps/extension/src/background/handlers/secrets.ts:109` | KEY-18 |
| MSG-014 | `cexAssets` | `apps/extension/src/background/handlers/ramps.ts:91` | DEFI-06 |
| MSG-015 | `cexDeposit` | `apps/extension/src/background/handlers/ramps.ts:92` | DEFI-06 |
| MSG-016 | `cexProviders` | `apps/extension/src/background/handlers/ramps.ts:90` | DEFI-06 |
| MSG-017 | `chainDataBalance` | `apps/extension/src/background/handlers/chainData.ts:32` | CH-04 |
| MSG-018 | `chainDataGas` | `apps/extension/src/background/handlers/chainData.ts:43` | CH-04 |
| MSG-019 | `chainDataHistory` | `apps/extension/src/background/handlers/chainData.ts:38` | CH-04 |
| MSG-020 | `chainDataTokenAdd` | `apps/extension/src/background/handlers/chainData.ts:54` | CH-03 |
| MSG-021 | `chainDataTokenBalances` | `apps/extension/src/background/handlers/chainData.ts:80` | CH-03 |
| MSG-022 | `chainDataTokenProbe` | `apps/extension/src/background/handlers/chainData.ts:50` | CH-03 |
| MSG-023 | `chainDataTokenRemove` | `apps/extension/src/background/handlers/chainData.ts:73` | CH-03 |
| MSG-024 | `checkAddressRisk` | `apps/extension/src/background/handlers/kitEvents.ts:34` | UX-05/UX-07 |
| MSG-025 | `checkTokenRisk` | `apps/extension/src/background/handlers/kitEvents.ts:30` | UX-05/UX-07 |
| MSG-026 | `copyPrivateKey` | `apps/extension/src/background/handlers/secrets.ts:138` | KEY-19 |
| MSG-027 | `createWallet` | `apps/extension/src/background/modules/wallet.ts:32` | KEY-06/KEY-14 |
| MSG-028 | `dappDetail` | `apps/extension/src/background/handlers/discover.ts:28` | DEFI-07 |
| MSG-029 | `dappsQuery` | `apps/extension/src/background/handlers/discover.ts:18` | DEFI-07 |
| MSG-030 | `defiCatalog` | `apps/extension/src/background/handlers/testnetDefi.ts:97` | DEFI-03 |
| MSG-031 | `defiPrepare` | `apps/extension/src/background/handlers/testnetDefi.ts:109` | DEFI-03 |
| MSG-032 | `defiSubmit` | `apps/extension/src/background/handlers/testnetDefi.ts:115` | DEFI-03 |
| MSG-033 | `earnAvailable` | `apps/extension/src/background/handlers/earn.ts:314` | DEFI-02 |
| MSG-034 | `earnDetails` | `apps/extension/src/background/handlers/earn.ts:330` | DEFI-02 |
| MSG-035 | `earnList` | `apps/extension/src/background/handlers/earn.ts:315` | DEFI-02 |
| MSG-036 | `earnPrepare` | `apps/extension/src/background/handlers/earn.ts:342` | DEFI-02 |
| MSG-037 | `earnSubmit` | `apps/extension/src/background/handlers/earn.ts:349` | DEFI-02 |
| MSG-038 | `getAccounts` | `apps/extension/src/background/modules/wallet.ts:158` | KEY-26 |
| MSG-039 | `getBalances` | `apps/extension/src/background/modules/market.ts:23` | CH-04 |
| MSG-040 | `getFiatRate` | `apps/extension/src/background/modules/market.ts:99` | DEFI-07 |
| MSG-041 | `getHot` | `apps/extension/src/background/modules/market.ts:69` | DEFI-07 |
| MSG-042 | `getSettings` | `apps/extension/src/background/modules/settingsCore.ts:11` | EXT-10 |
| MSG-043 | `getTrending` | `apps/extension/src/background/modules/market.ts:62` | DEFI-07 |
| MSG-044 | `getTrendingNetworks` | `apps/extension/src/background/modules/market.ts:72` | DEFI-07 |
| MSG-045 | `getUiPrefs` | `apps/extension/src/background/modules/settingsCore.ts:72` | EXT-10 |
| MSG-046 | `helpConfigGet` | `apps/extension/src/background/handlers/discover.ts:39` | DEFI-07 |
| MSG-047 | `helpConfigSet` | `apps/extension/src/background/handlers/discover.ts:40` | DEFI-07 |
| MSG-048 | `importCancel` | `apps/extension/src/background/handlers/onboardingExtra.ts:203` | KEY-16 |
| MSG-049 | `importCheck` | `apps/extension/src/background/handlers/secrets.ts:150` | KEY-17 |
| MSG-050 | `importComplete` | `apps/extension/src/background/handlers/onboardingExtra.ts:205` | KEY-16 |
| MSG-051 | `importInitiate` | `apps/extension/src/background/handlers/onboardingExtra.ts:159` | KEY-16 |
| MSG-052 | `ledgerAddWallet` | `apps/extension/src/background/handlers/ledger.ts:14` | KEY-28 |
| MSG-053 | `ledgerSendPrepare` | `apps/extension/src/background/handlers/chainSend.ts:146` | KEY-28 |
| MSG-054 | `ledgerSendSubmit` | `apps/extension/src/background/handlers/chainSend.ts:173` | KEY-28 |
| MSG-055 | `listWallets` | `apps/extension/src/background/modules/wallet.ts:313` | KEY-26 |
| MSG-056 | `lock` | `apps/extension/src/background/modules/wallet.ts:146` | KEY-06/KEY-14 |
| MSG-057 | `networkList` | `apps/extension/src/background/modules/tokens.ts:24` | CH-02 |
| MSG-058 | `networkRemove` | `apps/extension/src/background/modules/tokens.ts:63` | CH-02 |
| MSG-059 | `networkSave` | `apps/extension/src/background/modules/tokens.ts:32` | CH-02 |
| MSG-060 | `nftAdd` | `apps/extension/src/background/handlers/nfts.ts:133` | DEFI-08 |
| MSG-061 | `nftCollection` | `apps/extension/src/background/handlers/nfts.ts:100` | DEFI-08 |
| MSG-062 | `nftItem` | `apps/extension/src/background/handlers/nfts.ts:111` | DEFI-08 |
| MSG-063 | `nftList` | `apps/extension/src/background/handlers/nfts.ts:71` | DEFI-08 |
| MSG-064 | `nftRemove` | `apps/extension/src/background/handlers/nfts.ts:146` | DEFI-08 |
| MSG-065 | `nftReport` | `apps/extension/src/background/handlers/nfts.ts:124` | DEFI-08 |
| MSG-066 | `nftTransferPrepare` | `apps/extension/src/background/handlers/nfts.ts:217` | DEFI-08 |
| MSG-067 | `nftTransferSubmit` | `apps/extension/src/background/handlers/nfts.ts:218` | DEFI-08 |
| MSG-068 | `notifyStatus` | `apps/extension/src/background/modules/settingsCore.ts:21` | EXT-16 |
| MSG-069 | `notifyTest` | `apps/extension/src/background/modules/settingsCore.ts:20` | EXT-16 |
| MSG-070 | `onboardingSecure` | `apps/extension/src/background/handlers/onboardingExtra.ts:129` | KEY-27 |
| MSG-071 | `passkeyAddPassword` | `apps/extension/src/background/modules/wallet.ts:120` | KEY-21 |
| MSG-072 | `passkeyDisable` | `apps/extension/src/background/modules/wallet.ts:135` | KEY-21 |
| MSG-073 | `passkeyEnroll` | `apps/extension/src/background/modules/wallet.ts:90` | KEY-21 |
| MSG-074 | `passkeyStatus` | `apps/extension/src/background/modules/wallet.ts:83` | KEY-21 |
| MSG-075 | `passkeyUnlock` | `apps/extension/src/background/modules/wallet.ts:107` | KEY-21 |
| MSG-076 | `perpsAccount` | `apps/extension/src/background/handlers/perps.ts:78` | DEFI-04 |
| MSG-077 | `perpsCancel` | `apps/extension/src/background/handlers/perps.ts:153` | DEFI-04 |
| MSG-078 | `perpsClose` | `apps/extension/src/background/handlers/perps.ts:163` | DEFI-04 |
| MSG-079 | `perpsDeposit` | `apps/extension/src/background/handlers/perps.ts:108` | DEFI-04 |
| MSG-080 | `perpsEnable` | `apps/extension/src/background/handlers/perps.ts:92` | DEFI-04 |
| MSG-081 | `perpsMarkets` | `apps/extension/src/background/handlers/perps.ts:74` | DEFI-04 |
| MSG-082 | `perpsOrder` | `apps/extension/src/background/handlers/perps.ts:134` | DEFI-04 |
| MSG-083 | `perpsWithdraw` | `apps/extension/src/background/handlers/perps.ts:122` | DEFI-04 |
| MSG-084 | `predictionMarket` | `apps/extension/src/background/handlers/predictions.ts:62` | DEFI-05 |
| MSG-085 | `predictionMarkets` | `apps/extension/src/background/handlers/predictions.ts:58` | DEFI-05 |
| MSG-086 | `predictionOrder` | `apps/extension/src/background/handlers/predictions.ts:93` | DEFI-05 |
| MSG-087 | `predictionPortfolio` | `apps/extension/src/background/handlers/predictions.ts:70` | DEFI-05 |
| MSG-088 | `predictionWrap` | `apps/extension/src/background/handlers/predictions.ts:79` | DEFI-05 |
| MSG-089 | `providerBioProof` | `apps/extension/src/background/handlers/provider.ts:62` | SIG-13 |
| MSG-090 | `providerBlacklistAdd` | `apps/extension/src/background/handlers/provider.ts:98` | DAPP-08 |
| MSG-091 | `providerBlacklistRemove` | `apps/extension/src/background/handlers/provider.ts:107` | DAPP-08 |
| MSG-092 | `providerConnection` | `apps/extension/src/background/handlers/provider.ts:70` | DAPP-08 |
| MSG-093 | `providerDisconnect` | `apps/extension/src/background/handlers/provider.ts:95` | DAPP-08 |
| MSG-094 | `providerPrefs` | `apps/extension/src/background/handlers/provider.ts:108` | DAPP-08 |
| MSG-095 | `providerResolve` | `apps/extension/src/background/handlers/provider.ts:42` | SIG-13 |
| MSG-096 | `providerRevoke` | `apps/extension/src/background/handlers/provider.ts:127` | DAPP-08 |
| MSG-097 | `providerSetChain` | `apps/extension/src/background/handlers/provider.ts:88` | DAPP-08 |
| MSG-098 | `providerView` | `apps/extension/src/background/handlers/provider.ts:37` | DAPP-08 |
| MSG-099 | `qrImportAll` | `apps/extension/src/background/handlers/onboardingExtra.ts:235` | KEY-24 |
| MSG-100 | `qrStage` | `apps/extension/src/background/handlers/secrets.ts:163` | KEY-24 |
| MSG-101 | `qrSyncImport` | `apps/extension/src/background/modules/wallet.ts:221` | KEY-15/KEY-24 |
| MSG-102 | `qrVerify` | `apps/extension/src/background/handlers/onboardingExtra.ts:227` | KEY-24 |
| MSG-103 | `rampsCheckout` | `apps/extension/src/background/handlers/ramps.ts:54` | DEFI-06 |
| MSG-104 | `rampsConfig` | `apps/extension/src/background/handlers/ramps.ts:38` | DEFI-06 |
| MSG-105 | `rampsKeysClear` | `apps/extension/src/background/handlers/ramps.ts:75` | DEFI-06 |
| MSG-106 | `rampsKeysGet` | `apps/extension/src/background/handlers/ramps.ts:70` | DEFI-06 |
| MSG-107 | `rampsKeysSet` | `apps/extension/src/background/handlers/ramps.ts:71` | DEFI-06 |
| MSG-108 | `rampsMarketRef` | `apps/extension/src/background/handlers/ramps.ts:50` | DEFI-06 |
| MSG-109 | `rampsP2pUrl` | `apps/extension/src/background/handlers/ramps.ts:87` | DEFI-06 |
| MSG-110 | `rampsQuotes` | `apps/extension/src/background/handlers/ramps.ts:43` | DEFI-06 |
| MSG-111 | `rampsRecurringIcs` | `apps/extension/src/background/handlers/ramps.ts:79` | DEFI-06 |
| MSG-112 | `reauthStatus` | `apps/extension/src/background/modules/wallet.ts:331` | KEY-20 |
| MSG-113 | `removeWallet` | `apps/extension/src/background/modules/wallet.ts:361` | KEY-25 |
| MSG-114 | `renameAccount` | `apps/extension/src/background/modules/wallet.ts:388` | KEY-26 |
| MSG-115 | `renameWallet` | `apps/extension/src/background/modules/wallet.ts:346` | KEY-26 |
| MSG-116 | `revealAuth` | `apps/extension/src/background/modules/wallet.ts:332` | KEY-20 |
| MSG-117 | `revealPrivateKey` | `apps/extension/src/background/handlers/secrets.ts:124` | KEY-19 |
| MSG-118 | `sendNftQuote` | `apps/extension/src/background/handlers/chainSend.ts:201` | CH-05 |
| MSG-119 | `sendNftSubmit` | `apps/extension/src/background/handlers/chainSend.ts:208` | CH-05 |
| MSG-120 | `sendQuote` | `apps/extension/src/background/handlers/chainSend.ts:112` | CH-05 |
| MSG-121 | `sendSubmit` | `apps/extension/src/background/handlers/chainSend.ts:126` | CH-05 |
| MSG-122 | `sendTxDetail` | `apps/extension/src/background/handlers/chainSend.ts:223` | CH-05 |
| MSG-123 | `sendTxList` | `apps/extension/src/background/handlers/chainSend.ts:236` | CH-05 |
| MSG-124 | `sendValidateAddress` | `apps/extension/src/background/handlers/chainSend.ts:95` | CH-05 |
| MSG-125 | `sentiment` | `apps/extension/src/background/handlers/discover.ts:33` | DEFI-07 |
| MSG-126 | `sentimentAssets` | `apps/extension/src/background/handlers/discover.ts:32` | DEFI-07 |
| MSG-127 | `setAssetHidden` | `apps/extension/src/background/modules/settingsCore.ts:80` | EXT-10 |
| MSG-128 | `setNetworkFilter` | `apps/extension/src/background/modules/settingsCore.ts:95` | EXT-10 |
| MSG-129 | `setSettings` | `apps/extension/src/background/modules/settingsCore.ts:22` | EXT-10 |
| MSG-130 | `simulateTx` | `apps/extension/src/background/handlers/kitEvents.ts:38` | UX-03 |
| MSG-131 | `status` | `apps/extension/src/background/modules/wallet.ts:24` | KEY-06/KEY-14 |
| MSG-132 | `swapApprove` | `apps/extension/src/background/modules/swap.ts:44` | DEFI-01 |
| MSG-133 | `swapBalances` | `apps/extension/src/background/modules/swap.ts:26` | DEFI-01 |
| MSG-134 | `swapDustConvert` | `apps/extension/src/background/modules/swap.ts:56` | DEFI-01 |
| MSG-135 | `swapDustScan` | `apps/extension/src/background/modules/swap.ts:52` | DEFI-01 |
| MSG-136 | `swapHistory` | `apps/extension/src/background/modules/swap.ts:64` | DEFI-01 |
| MSG-137 | `swapMax` | `apps/extension/src/background/modules/swap.ts:33` | DEFI-01 |
| MSG-138 | `swapQuote` | `apps/extension/src/background/modules/swap.ts:40` | DEFI-01 |
| MSG-139 | `swapSearchTokens` | `apps/extension/src/background/modules/swap.ts:19` | DEFI-01 |
| MSG-140 | `swapSetSettings` | `apps/extension/src/background/modules/swap.ts:12` | DEFI-01 |
| MSG-141 | `swapState` | `apps/extension/src/background/modules/swap.ts:5` | DEFI-01 |
| MSG-142 | `swapStatus` | `apps/extension/src/background/modules/swap.ts:60` | DEFI-01 |
| MSG-143 | `swapSubmit` | `apps/extension/src/background/modules/swap.ts:48` | DEFI-01 |
| MSG-144 | `switchAccount` | `apps/extension/src/background/modules/wallet.ts:203` | KEY-26 |
| MSG-145 | `switchWallet` | `apps/extension/src/background/modules/wallet.ts:298` | KEY-26 |
| MSG-146 | `tokenAdd` | `apps/extension/src/background/modules/tokens.ts:81` | CH-03 |
| MSG-147 | `tokenBalances` | `apps/extension/src/background/modules/tokens.ts:116` | CH-03 |
| MSG-148 | `tokenChart` | `apps/extension/src/background/modules/market.ts:75` | DEFI-07 |
| MSG-149 | `tokenInfo` | `apps/extension/src/background/modules/market.ts:83` | DEFI-07 |
| MSG-150 | `tokenList` | `apps/extension/src/background/modules/tokens.ts:74` | CH-03 |
| MSG-151 | `tokenProbe` | `apps/extension/src/background/modules/tokens.ts:14` | CH-03 |
| MSG-152 | `tokenRemove` | `apps/extension/src/background/modules/tokens.ts:105` | CH-03 |
| MSG-153 | `txHistory` | `apps/extension/src/background/modules/market.ts:90` | DATA-02 |
| MSG-154 | `unlock` | `apps/extension/src/background/modules/wallet.ts:76` | KEY-06/KEY-14 |
| MSG-155 | `validateMnemonic` | `apps/extension/src/background/modules/wallet.ts:28` | KEY-06/KEY-14 |
| MSG-156 | `validatePrivateKey` | `apps/extension/src/background/handlers/onboardingExtra.ts:152` | KEY-16 |
| MSG-157 | `walletBalances` | `apps/extension/src/background/handlers/settingsExtra.ts:26` | CH-04 |
| MSG-158 | `wcDisconnect` | `apps/extension/src/background/handlers/walletconnect.ts:19` | DAPP-17 |
| MSG-159 | `wcPair` | `apps/extension/src/background/handlers/walletconnect.ts:18` | DAPP-17 |
| MSG-160 | `wcSetProjectId` | `apps/extension/src/background/handlers/walletconnect.ts:12` | DAPP-17 |
| MSG-161 | `providerSession` | `apps/extension/src/background/handlers/provider.ts:29` | DAPP-08 |
| MSG-162 | `providerPending` | `apps/extension/src/background/handlers/provider.ts:33` | DAPP-08 |
| MSG-163 | `providerConnections` | `apps/extension/src/background/handlers/provider.ts:69` | DAPP-08 |
| MSG-164 | `providerCurrentSite` | `apps/extension/src/background/handlers/provider.ts:78` | DAPP-08 |
| MSG-165 | `providerDisconnectAll` | `apps/extension/src/background/handlers/provider.ts:96` | DAPP-08 |
| MSG-166 | `providerBlacklist` | `apps/extension/src/background/handlers/provider.ts:97` | DAPP-08 |
| MSG-167 | `providerApprovals` | `apps/extension/src/background/handlers/provider.ts:114` | DAPP-08 |
| MSG-168 | `sendSupport` | `apps/extension/src/background/handlers/chainSend.ts:92` | CH-05 |
| MSG-169 | `chainDataCapabilities` | `apps/extension/src/background/handlers/chainData.ts:28` | CH-04 |
| MSG-170 | `onboardingStatus` | `apps/extension/src/background/handlers/onboardingExtra.ts:110` | KEY-27 |
| MSG-171 | `resetEmptyVault` | `apps/extension/src/background/handlers/onboardingExtra.ts:118` | KEY-27 |
| MSG-172 | `walletsDetailed` | `apps/extension/src/background/handlers/settingsExtra.ts:11` | CH-04 |
| MSG-173 | `wcStatus` | `apps/extension/src/background/handlers/walletconnect.ts:10` | DAPP-17 |
| MSG-174 | `getNetworkStatus` | `apps/extension/src/background/handlers/kitEvents.ts:27` | CH-07 |
| MSG-175 | `getRemoteConfig` | `apps/extension/src/background/handlers/kitEvents.ts:28` | EXT-11 |
| MSG-176 | `refreshRemoteConfig` | `apps/extension/src/background/handlers/kitEvents.ts:29` | EXT-11 |
| MSG-177 | `secretViewClosed` | `apps/extension/src/background/handlers/secrets.ts:147` | KEY-19 |
| MSG-178 | `smartAccountStatus` | `apps/extension/src/background/handlers/smartAccount.ts:7` | SA-05/SA-08 |
| MSG-179 | `smartAccountGrants` | `apps/extension/src/background/handlers/smartAccount.ts:8` | SA-05/SA-08 |
| MSG-180 | `smartAccountPrepare` | `apps/extension/src/background/handlers/smartAccount.ts:9` | SA-05/SA-08 |
| MSG-181 | `smartAccountApprove` | `apps/extension/src/background/handlers/smartAccount.ts:10` | SA-05/SA-08 |
| MSG-182 | `smartAccountReject` | `apps/extension/src/background/handlers/smartAccount.ts:11` | SA-05/SA-08 |
| MSG-183 | `swapPreview` | `apps/extension/src/background/modules/swap.ts:48` | DEFI-01 |

> MSG-161..182 were added in Phase 4: the Phase-1 generator only matched `name: async (` handlers; the live registry check (T-MSG-006, `test/qa/worker-router.test.js`) found 22 method-shorthand handlers it had missed. IDs 001–160 are unchanged.

### C2. dApp provider methods (69) — caller trust T0 (any page), approval gates T1

| ID | NS | Method | Kind | Approval | Needs connection | Source | Feature |
|---|---|---|---|---|---|---|---|
| PM-001 | evm | `eth_chainId` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-002 | evm | `net_version` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-003 | evm | `eth_accounts` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-004 | evm | `eth_coinbase` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-005 | evm | `web3_clientVersion` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-006 | evm | `web3_sha3` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-007 | evm | `personal_ecRecover` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-008 | evm | `wallet_getPermissions` | local |  |  | `apps/extension/src/core/provider/methods.ts:15` | DAPP-01 |
| PM-009 | evm | `eth_requestAccounts` | connect | Y |  | `apps/extension/src/core/provider/methods.ts:16` | DAPP-08 |
| PM-010 | evm | `wallet_requestPermissions` | permissionsRequest | Y |  | `apps/extension/src/core/provider/methods.ts:17` | DAPP-08 |
| PM-011 | evm | `wallet_revokePermissions` | permissionsRevoke |  |  | `apps/extension/src/core/provider/methods.ts:18` | DAPP-08 |
| PM-012 | evm | `personal_sign` | sign | Y | Y | `apps/extension/src/core/provider/methods.ts:19` | SIG-01/SIG-02 |
| PM-013 | evm | `eth_sign` | sign | Y | Y | `apps/extension/src/core/provider/methods.ts:20` | SIG-01/SIG-02 |
| PM-014 | evm | `eth_signTypedData` | typed | Y | Y | `apps/extension/src/core/provider/methods.ts:21` | SIG-03 |
| PM-015 | evm | `eth_signTypedData_v3` | typed | Y | Y | `apps/extension/src/core/provider/methods.ts:22` | SIG-03 |
| PM-016 | evm | `eth_signTypedData_v4` | typed | Y | Y | `apps/extension/src/core/provider/methods.ts:23` | SIG-03 |
| PM-017 | evm | `eth_sendTransaction` | tx | Y | Y | `apps/extension/src/core/provider/methods.ts:24` | SIG-05 |
| PM-018 | evm | `wallet_switchEthereumChain` | switchChain | Y | Y | `apps/extension/src/core/provider/methods.ts:25` | DAPP-11 |
| PM-019 | evm | `wallet_addEthereumChain` | addChain | Y | Y | `apps/extension/src/core/provider/methods.ts:26` | DAPP-11 |
| PM-020 | evm | `wallet_watchAsset` | watchAsset | Y | Y | `apps/extension/src/core/provider/methods.ts:27` | DAPP-12 |
| PM-021 | evm | `wallet_getCapabilities` | capabilities |  | Y | `apps/extension/src/core/provider/methods.ts:29` | SA-07 |
| PM-022 | evm | `wallet_sendCalls` | calls | Y | Y | `apps/extension/src/core/provider/methods.ts:30` | SA-07 |
| PM-023 | evm | `wallet_getCallsStatus` | callsStatus |  | Y | `apps/extension/src/core/provider/methods.ts:31` | SA-07 |
| PM-024 | evm | `wallet_showCallsStatus` | showCalls |  | Y | `apps/extension/src/core/provider/methods.ts:32` | SA-07 |
| PM-025 | evm | `wallet_requestExecutionPermissions` | grant | Y | Y | `apps/extension/src/core/provider/methods.ts:34` | SA-08 |
| PM-026 | evm | `wallet_getGrantedExecutionPermissions` | grants |  | Y | `apps/extension/src/core/provider/methods.ts:35` | SA-08 |
| PM-027 | evm | `eth_blockNumber` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:38` | DAPP-13 |
| PM-028 | evm | `eth_call` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:38` | DAPP-13 |
| PM-029 | evm | `eth_estimateGas` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:38` | DAPP-13 |
| PM-030 | evm | `eth_gasPrice` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:38` | DAPP-13 |
| PM-031 | evm | `eth_getBalance` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:38` | DAPP-13 |
| PM-032 | evm | `eth_getBlockByHash` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:38` | DAPP-13 |
| PM-033 | evm | `eth_getBlockByNumber` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:38` | DAPP-13 |
| PM-034 | evm | `eth_getBlockTransactionCountByHash` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:39` | DAPP-13 |
| PM-035 | evm | `eth_getBlockTransactionCountByNumber` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:39` | DAPP-13 |
| PM-036 | evm | `eth_getCode` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:39` | DAPP-13 |
| PM-037 | evm | `eth_getLogs` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:39` | DAPP-13 |
| PM-038 | evm | `eth_getStorageAt` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:39` | DAPP-13 |
| PM-039 | evm | `eth_getTransactionByHash` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:40` | DAPP-13 |
| PM-040 | evm | `eth_getTransactionByBlockHashAndIndex` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:40` | DAPP-13 |
| PM-041 | evm | `eth_getTransactionByBlockNumberAndIndex` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:40` | DAPP-13 |
| PM-042 | evm | `eth_getTransactionCount` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:40` | DAPP-13 |
| PM-043 | evm | `eth_getTransactionReceipt` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:41` | DAPP-13 |
| PM-044 | evm | `eth_feeHistory` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:41` | DAPP-13 |
| PM-045 | evm | `eth_maxPriorityFeePerGas` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:41` | DAPP-13 |
| PM-046 | evm | `eth_protocolVersion` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:41` | DAPP-13 |
| PM-047 | evm | `eth_syncing` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:41` | DAPP-13 |
| PM-048 | evm | `eth_getProof` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:41` | DAPP-13 |
| PM-049 | evm | `eth_getUncleCountByBlockHash` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:42` | DAPP-13 |
| PM-050 | evm | `eth_getUncleCountByBlockNumber` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:42` | DAPP-13 |
| PM-051 | evm | `eth_sendRawTransaction` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:42` | DAPP-13 |
| PM-052 | evm | `eth_blobBaseFee` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:42` | DAPP-13 |
| PM-053 | evm | `net_listening` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:42` | DAPP-13 |
| PM-054 | evm | `net_peerCount` | rpc |  |  | `apps/extension/src/core/provider/methods.ts:42` | DAPP-13 |
| PM-055 | solana | `connect` | solConnect | Y |  | `apps/extension/src/core/provider/methods.ts:46` | DAPP-08 |
| PM-056 | solana | `disconnect` | solDisconnect |  |  | `apps/extension/src/core/provider/methods.ts:47` | DAPP-08 |
| PM-057 | solana | `signMessage` | solSignMessage | Y | Y | `apps/extension/src/core/provider/methods.ts:48` | SIG-08 |
| PM-058 | solana | `signTransaction` | solSignTx | Y | Y | `apps/extension/src/core/provider/methods.ts:49` | SIG-08 |
| PM-059 | solana | `signAllTransactions` | solSignAll | Y | Y | `apps/extension/src/core/provider/methods.ts:50` | SIG-08 |
| PM-060 | solana | `signAndSendTransaction` | solSignSend | Y | Y | `apps/extension/src/core/provider/methods.ts:51` | SIG-08 |
| PM-061 | multi | `connect` | multiConnect | Y |  | `apps/extension/src/core/provider/methods.ts:54` | DAPP-08 |
| PM-062 | multi | `disconnect` | multiDisconnect |  |  | `apps/extension/src/core/provider/methods.ts:55` | DAPP-08 |
| PM-063 | multi | `signMessage` | multiSign | Y | Y | `apps/extension/src/core/provider/methods.ts:56` | SIG-09 |
| PM-064 | multi | `signTransaction` | multiSign | Y | Y | `apps/extension/src/core/provider/methods.ts:57` | SIG-09 |
| PM-065 | multi | `signAmino` | multiSign | Y | Y | `apps/extension/src/core/provider/methods.ts:58` | SIG-09 |
| PM-066 | multi | `signDirect` | multiSign | Y | Y | `apps/extension/src/core/provider/methods.ts:59` | SIG-09 |
| PM-067 | multi | `signAndSend` | multiSign | Y | Y | `apps/extension/src/core/provider/methods.ts:60` | SIG-09 |
| PM-068 | multi | `sendTransaction` | multiSign | Y | Y | `apps/extension/src/core/provider/methods.ts:61` | SIG-09 |
| PM-069 | multi | `signPsbt` | multiSign | Y | Y | `apps/extension/src/core/provider/methods.ts:62` | SIG-09 |
| PM-UNS | evm | UNSUPPORTED_EVM set (filters, subscriptions, eth_signTransaction, eth_decrypt, eth_getEncryptionPublicKey, …) → 4200 | — | — | — | `apps/extension/src/core/provider/methods.ts:61` | DAPP-05 |

### C3. HTTP routes (30)

| ID | Method | Path | Handler | Source | Service | Feature |
|---|---|---|---|---|---|---|
| RT-01 | GET | `/healthz` | `func` | `apps/backend/internal/api/server.go:156` | api (`/v1` prefix except /healthz) | BE-02 / IDX-01 / IDX-20 |
| RT-02 | POST | `/devices/challenge` | `s.handleChallenge` | `apps/backend/internal/api/server.go:170` | api (`/v1` prefix except /healthz) | BE-03 |
| RT-03 | POST | `/devices` | `s.handleRegister` | `apps/backend/internal/api/server.go:171` | api (`/v1` prefix except /healthz) | BE-04 |
| RT-04 | GET | `/media/{key}` | `s.handleMedia` | `apps/backend/internal/api/server.go:172` | api (`/v1` prefix except /healthz) | BE-26 |
| RT-05 | GET | `/push/vapid` | `s.handleVAPID` | `apps/backend/internal/api/server.go:173` | api (`/v1` prefix except /healthz) | BE-24 |
| RT-06 | GET | `/me` | `s.handleMe` | `apps/backend/internal/api/server.go:176` | api (`/v1` prefix except /healthz) | BE-10 |
| RT-07 | GET | `/me/addresses` | `s.handleListAddresses` | `apps/backend/internal/api/server.go:177` | api (`/v1` prefix except /healthz) | BE-11/BE-12 |
| RT-08 | PUT | `/me/addresses` | `s.handlePutAddresses` | `apps/backend/internal/api/server.go:178` | api (`/v1` prefix except /healthz) | BE-11/BE-12 |
| RT-09 | POST | `/rpc/{chain}` | `s.handleRPC` | `apps/backend/internal/api/server.go:179` | api (`/v1` prefix except /healthz) | BE-13 / IDX-01 |
| RT-10 | GET | `/gw/*` | `s.handleGateway` | `apps/backend/internal/api/server.go:180` | api (`/v1` prefix except /healthz) | GW-* |
| RT-11 | POST | `/gw/*` | `s.handleGateway` | `apps/backend/internal/api/server.go:181` | api (`/v1` prefix except /healthz) | GW-* |
| RT-12 | GET | `/me/portfolio` | `s.handlePortfolio` | `apps/backend/internal/api/server.go:182` | api (`/v1` prefix except /healthz) | BE-14 |
| RT-13 | GET | `/me/portfolio/chart` | `s.handleChart` | `apps/backend/internal/api/server.go:183` | api (`/v1` prefix except /healthz) | BE-15 |
| RT-14 | GET | `/me/history` | `s.handleHistory` | `apps/backend/internal/api/server.go:184` | api (`/v1` prefix except /healthz) | BE-16 |
| RT-15 | GET | `/me/nfts` | `s.handleNFTs` | `apps/backend/internal/api/server.go:185` | api (`/v1` prefix except /healthz) | BE-17 |
| RT-16 | GET | `/assets/{chain}/{asset}` | `s.handleAsset` | `apps/backend/internal/api/server.go:186` | api (`/v1` prefix except /healthz) | BE-18 |
| RT-17 | GET | `/assets/{chain}/{asset}/prices` | `s.handleAssetPrices` | `apps/backend/internal/api/server.go:187` | api (`/v1` prefix except /healthz) | BE-18 |
| RT-18 | GET | `/tx/{chain}/{hash}` | `s.handleTx` | `apps/backend/internal/api/server.go:188` | api (`/v1` prefix except /healthz) | BE-19 |
| RT-19 | POST | `/tx/{chain}/estimate` | `s.handleEstimate` | `apps/backend/internal/api/server.go:189` | api (`/v1` prefix except /healthz) | BE-20 |
| RT-20 | POST | `/tx/{chain}/simulate` | `s.handleSimulate` | `apps/backend/internal/api/server.go:190` | api (`/v1` prefix except /healthz) | BE-21 |
| RT-21 | POST | `/tx/{chain}/broadcast` | `s.handleBroadcast` | `apps/backend/internal/api/server.go:191` | api (`/v1` prefix except /healthz) | BE-22 |
| RT-22 | POST | `/realtime/token` | `s.handleRealtimeToken` | `apps/backend/internal/api/server.go:192` | api (`/v1` prefix except /healthz) | BE-23 |
| RT-23 | PUT | `/me/push` | `s.handlePutPush` | `apps/backend/internal/api/server.go:193` | api (`/v1` prefix except /healthz) | BE-25 |
| RT-24 | DELETE | `/me/push` | `s.handleDeletePush` | `apps/backend/internal/api/server.go:194` | api (`/v1` prefix except /healthz) | BE-25 |
| RT-25 | POST | `/rpc/{chain}` | `auth` | `apps/backend/internal/gateway/server.go:32` | rpc-gateway | BE-13 / IDX-01 |
| RT-26 | GET | `/status` | `auth` | `apps/backend/internal/gateway/server.go:33` | rpc-gateway | IDX-01 |
| RT-27 | GET | `/metrics` | `auth` | `apps/backend/internal/gateway/server.go:37` | rpc-gateway | IDX-01 |
| RT-28 | GET | `/healthz` | `func` | `apps/backend/internal/gateway/server.go:41` | rpc-gateway | BE-02 / IDX-01 / IDX-20 |
| RT-29 | POST | `/webhooks/{source}` | `in.receive` | `apps/backend/internal/ingest/ingest.go:109` | webhook-ingest | IDX-20 |
| RT-30 | GET | `/healthz` | `func` | `apps/backend/internal/ingest/ingest.go:110` | webhook-ingest | BE-02 / IDX-01 / IDX-20 |
| RT-31 | GET | `/healthz` | inline | `apps/backend/cmd/indexer/main.go:80` | indexer | IDX-11 |

### C4. Database objects and DDL statements (63)

| ID | Statement | Object | Source |
|---|---|---|---|
| DBO-01 | CREATE TABLE | `chains` | `apps/backend/migrations/0001_init.sql:6` |
| DBO-02 | CREATE TABLE | `assets` | `apps/backend/migrations/0001_init.sql:13` |
| DBO-03 | CREATE TABLE | `devices` | `apps/backend/migrations/0001_init.sql:28` |
| DBO-04 | CREATE TABLE | `tracked_addresses` | `apps/backend/migrations/0001_init.sql:38` |
| DBO-05 | CREATE TABLE | `device_addresses` | `apps/backend/migrations/0001_init.sql:55` |
| DBO-06 | CREATE INDEX | `device_addresses_device` | `apps/backend/migrations/0001_init.sql:61` |
| DBO-07 | CREATE TABLE | `event_keys` | `apps/backend/migrations/0001_init.sql:66` |
| DBO-08 | CREATE TABLE | `transactions` | `apps/backend/migrations/0001_init.sql:73` |
| DBO-09 | CREATE INDEX | `transactions_hash` | `apps/backend/migrations/0001_init.sql:87` |
| DBO-10 | CREATE INDEX | `transactions_block` | `apps/backend/migrations/0001_init.sql:88` |
| DBO-11 | CREATE TABLE | `transfers` | `apps/backend/migrations/0001_init.sql:90` |
| DBO-12 | CREATE INDEX | `transfers_hash` | `apps/backend/migrations/0001_init.sql:106` |
| DBO-13 | CREATE INDEX | `transfers_block` | `apps/backend/migrations/0001_init.sql:107` |
| DBO-14 | CREATE TABLE | `price_ticks` | `apps/backend/migrations/0001_init.sql:109` |
| DBO-15 | CREATE TABLE | `balances` | `apps/backend/migrations/0001_init.sql:118` |
| DBO-16 | CREATE TABLE | `nft_holdings` | `apps/backend/migrations/0001_init.sql:127` |
| DBO-17 | CREATE TABLE | `address_activity` | `apps/backend/migrations/0001_init.sql:138` |
| DBO-18 | CREATE INDEX | `address_activity_page` | `apps/backend/migrations/0001_init.sql:147` |
| DBO-19 | CREATE TABLE | `balance_snapshots` | `apps/backend/migrations/0001_init.sql:155` |
| DBO-20 | CREATE TABLE | `pending_transactions` | `apps/backend/migrations/0001_init.sql:163` |
| DBO-21 | CREATE OR REPLACE FUNCTION | `harbour_ensure_monthly_partitions` | `apps/backend/migrations/0001_init.sql:176` |
| DBO-22 | CREATE ROLE | `harbour_api` | `apps/backend/migrations/0001_init.sql:225` |
| DBO-23 | CREATE ROLE | `harbour_indexer` | `apps/backend/migrations/0001_init.sql:228` |
| DBO-24 | ALTER TABLE | `tracked_addresses` | `apps/backend/migrations/0002_indexer.sql:3` |
| DBO-25 | CREATE INDEX | `tracked_addresses_backfill` | `apps/backend/migrations/0002_indexer.sql:9` |
| DBO-26 | CREATE INDEX | `tracked_addresses_sweep` | `apps/backend/migrations/0002_indexer.sql:10` |
| DBO-27 | ALTER TABLE | `assets` | `apps/backend/migrations/0002_indexer.sql:12` |
| DBO-28 | CREATE INDEX | `balances_asset` | `apps/backend/migrations/0002_indexer.sql:15` |
| DBO-29 | CREATE OR REPLACE FUNCTION | `harbour_ensure_partition` | `apps/backend/migrations/0002_indexer.sql:20` |
| DBO-30 | CREATE OR REPLACE FUNCTION | `harbour_ensure_partition` | `apps/backend/migrations/0003_partition_fix.sql:3` |
| DBO-31 | CREATE TABLE | `webhooks` | `apps/backend/migrations/0004_live.sql:5` |
| DBO-32 | CREATE INDEX | `webhooks_chain` | `apps/backend/migrations/0004_live.sql:14` |
| DBO-33 | ALTER TABLE | `tracked_addresses` | `apps/backend/migrations/0004_live.sql:19` |
| DBO-34 | CREATE INDEX | `tracked_addresses_subscribe` | `apps/backend/migrations/0004_live.sql:24` |
| DBO-35 | CREATE INDEX | `tracked_addresses_unsubscribe` | `apps/backend/migrations/0004_live.sql:25` |
| DBO-36 | CREATE TABLE | `webhook_deliveries` | `apps/backend/migrations/0004_live.sql:28` |
| DBO-37 | CREATE INDEX | `webhook_deliveries_received` | `apps/backend/migrations/0004_live.sql:37` |
| DBO-38 | CREATE TABLE | `service_heartbeats` | `apps/backend/migrations/0004_live.sql:40` |
| DBO-39 | CREATE INDEX | `transfers_unfinal` | `apps/backend/migrations/0004_live.sql:45` |
| DBO-40 | ALTER TABLE | `nft_holdings` | `apps/backend/migrations/0005_read_api.sql:3` |
| DBO-41 | CREATE INDEX | `nft_holdings_media` | `apps/backend/migrations/0005_read_api.sql:6` |
| DBO-42 | CREATE INDEX | `balance_snapshots_day` | `apps/backend/migrations/0005_read_api.sql:9` |
| DBO-43 | CREATE INDEX | `balances_held` | `apps/backend/migrations/0005_read_api.sql:10` |
| DBO-44 | CREATE ROLE | `harbour_prices` | `apps/backend/migrations/0005_read_api.sql:15` |
| DBO-45 | ALTER TABLE | `pending_transactions` | `apps/backend/migrations/0006_send_realtime.sql:3` |
| DBO-46 | CREATE INDEX | `pending_due` | `apps/backend/migrations/0006_send_realtime.sql:9` |
| DBO-47 | CREATE TABLE | `push_subscriptions` | `apps/backend/migrations/0006_send_realtime.sql:12` |
| DBO-48 | CREATE TABLE | `push_routes` | `apps/backend/migrations/0006_send_realtime.sql:24` |
| DBO-49 | CREATE INDEX | `push_routes_device` | `apps/backend/migrations/0006_send_realtime.sql:29` |
| DBO-50 | CREATE ROLE | `harbour_tracker` | `apps/backend/migrations/0006_send_realtime.sql:34` |
| DBO-51 | ALTER TABLE | `device_addresses` | `apps/backend/migrations/0008_runtime_role_privacy.sql:11` |
| DBO-52 | CREATE ROLE | `harbour_app` | `apps/backend/migrations/0008_runtime_role_privacy.sql:16` |
| DBO-53 | ALTER TABLE | `tracked_addresses` | `apps/backend/migrations/0009_lazy_chains_nfts.sql:18` |
| DBO-54 | ALTER TABLE | `tracked_addresses` | `apps/backend/migrations/0009_lazy_chains_nfts.sql:21` |
| DBO-55 | CREATE OR REPLACE FUNCTION | `hb_ref` | `apps/backend/migrations/0010_compact_refs.sql:14` |
| DBO-56 | CREATE OR REPLACE FUNCTION | `hb_ref_text` | `apps/backend/migrations/0010_compact_refs.sql:23` |
| DBO-57 | CREATE OR REPLACE FUNCTION | `hb_refs` | `apps/backend/migrations/0010_compact_refs.sql:32` |
| DBO-58 | ALTER TABLE | `assets` | `apps/backend/migrations/0010_compact_refs.sql:47` |
| DBO-59 | ALTER TABLE | `event_keys` | `apps/backend/migrations/0010_compact_refs.sql:48` |
| DBO-60 | ALTER TABLE | `transactions` | `apps/backend/migrations/0010_compact_refs.sql:49` |
| DBO-61 | ALTER TABLE | `transfers` | `apps/backend/migrations/0010_compact_refs.sql:53` |
| DBO-62 | ALTER TABLE | `address_activity` | `apps/backend/migrations/0010_compact_refs.sql:57` |
| DBO-63 | ALTER TABLE | `pending_transactions` | `apps/backend/migrations/0010_compact_refs.sql:58` |

### C5. Go functions and methods (627, non-test)

Feature mapping is by package: api/* → BE/GW; devicesig → IDX-29; evmtx → IDX-28; gateway → IDX-01..09; rpchttp → IDX-10; indexer → IDX-11..19; ingest → IDX-20; txtrack → IDX-21; notifier/webpush → IDX-22; prices → IDX-23; realtime → IDX-24; events → IDX-25; store → DB-*/IDX-12..18/IDX-30; config → BE-29; adapters → IDX-26; ratelimit → IDX-27; cmd → BE-31/BE-32 and service mains.

| ID | Location | Function |
|---|---|---|
| GOF-0001 | `apps/backend/adapters/chains/evm/abi.go:25` | `mustHex` |
| GOF-0002 | `apps/backend/adapters/chains/evm/abi.go:33` | `word` |
| GOF-0003 | `apps/backend/adapters/chains/evm/abi.go:39` | `uintWord` |
| GOF-0004 | `apps/backend/adapters/chains/evm/abi.go:41` | `addrWord` |
| GOF-0005 | `apps/backend/adapters/chains/evm/abi.go:49` | `pad32` |
| GOF-0006 | `apps/backend/adapters/chains/evm/abi.go:63` | `encodeAggregate3` |
| GOF-0007 | `apps/backend/adapters/chains/evm/abi.go:100` | `readWord` |
| GOF-0008 | `apps/backend/adapters/chains/evm/abi.go:107` | `readUint` |
| GOF-0009 | `apps/backend/adapters/chains/evm/abi.go:120` | `decodeAggregate3` |
| GOF-0010 | `apps/backend/adapters/chains/evm/abi.go:164` | `decodeUint256` |
| GOF-0011 | `apps/backend/adapters/chains/evm/abi.go:172` | `decodeString` |
| GOF-0012 | `apps/backend/adapters/chains/evm/abi.go:192` | `cleanText` |
| GOF-0013 | `apps/backend/adapters/chains/evm/client.go:29` | `init` |
| GOF-0014 | `apps/backend/adapters/chains/evm/client.go:47` | `New` |
| GOF-0015 | `apps/backend/adapters/chains/evm/client.go:55` | `(c *Client) Family` |
| GOF-0016 | `apps/backend/adapters/chains/evm/client.go:56` | `(c *Client) Chain` |
| GOF-0017 | `apps/backend/adapters/chains/evm/client.go:64` | `(e *RPCError) Error` |
| GOF-0018 | `apps/backend/adapters/chains/evm/client.go:67` | `(c *Client) Call` |
| GOF-0019 | `apps/backend/adapters/chains/evm/client.go:106` | `hexQty` |
| GOF-0020 | `apps/backend/adapters/chains/evm/client.go:108` | `parseQty` |
| GOF-0021 | `apps/backend/adapters/chains/evm/client.go:116` | `parseBig` |
| GOF-0022 | `apps/backend/adapters/chains/evm/client.go:129` | `(c *Client) LatestBlock` |
| GOF-0023 | `apps/backend/adapters/chains/evm/client.go:138` | `(c *Client) multicall` |
| GOF-0024 | `apps/backend/adapters/chains/evm/client.go:175` | `(c *Client) Balances` |
| GOF-0025 | `apps/backend/adapters/chains/evm/client.go:211` | `(c *Client) TokenInfo` |
| GOF-0026 | `apps/backend/adapters/chains/evm/client.go:251` | `(c *Client) Fees` |
| GOF-0027 | `apps/backend/adapters/chains/evm/client.go:285` | `(c *Client) Nonce` |
| GOF-0028 | `apps/backend/adapters/chains/evm/client.go:294` | `(c *Client) ConfirmedNonce` |
| GOF-0029 | `apps/backend/adapters/chains/evm/client.go:303` | `(c *Client) Broadcast` |
| GOF-0030 | `apps/backend/adapters/chains/evm/client.go:313` | `(c *Client) Simulate` |
| GOF-0031 | `apps/backend/adapters/chains/evm/client.go:334` | `(c *Client) Inclusion` |
| GOF-0032 | `apps/backend/adapters/chains/evm/client.go:358` | `(c *Client) BlockHash` |
| GOF-0033 | `apps/backend/adapters/chains/evm/client.go:387` | `NewFinalizedTag` |
| GOF-0034 | `apps/backend/adapters/chains/evm/client.go:396` | `(f *FinalizedTag) FinalizedBlock` |
| GOF-0035 | `apps/backend/adapters/chains/evm/client.go:411` | `(f *FinalizedTag) Classify` |
| GOF-0036 | `apps/backend/adapters/chains/evm/client.go:434` | `NewDepth` |
| GOF-0037 | `apps/backend/adapters/chains/evm/client.go:461` | `(d *Depth) FinalizedBlock` |
| GOF-0038 | `apps/backend/adapters/chains/evm/client.go:473` | `(d *Depth) Classify` |
| GOF-0039 | `apps/backend/adapters/notify/webpush/webpush.go:41` | `init` |
| GOF-0040 | `apps/backend/adapters/notify/webpush/webpush.go:64` | `decodeB64` |
| GOF-0041 | `apps/backend/adapters/notify/webpush/webpush.go:73` | `opt` |
| GOF-0042 | `apps/backend/adapters/notify/webpush/webpush.go:86` | `New` |
| GOF-0043 | `apps/backend/adapters/notify/webpush/webpush.go:108` | `PrivateKey` |
| GOF-0044 | `apps/backend/adapters/notify/webpush/webpush.go:120` | `PublicBytes` |
| GOF-0045 | `apps/backend/adapters/notify/webpush/webpush.go:129` | `GenerateKeys` |
| GOF-0046 | `apps/backend/adapters/notify/webpush/webpush.go:138` | `(c *Channel) Name` |
| GOF-0047 | `apps/backend/adapters/notify/webpush/webpush.go:141` | `(c *Channel) Send` |
| GOF-0048 | `apps/backend/adapters/notify/webpush/webpush.go:187` | `(c *Channel) vapidJWT` |
| GOF-0049 | `apps/backend/adapters/notify/webpush/webpush.go:202` | `hkdf` |
| GOF-0050 | `apps/backend/adapters/notify/webpush/webpush.go:213` | `Encrypt` |
| GOF-0051 | `apps/backend/adapters/notify/webpush/webpush.go:242` | `seal` |
| GOF-0052 | `apps/backend/adapters/notify/webpush/webpush.go:268` | `Decrypt` |
| GOF-0053 | `apps/backend/adapters/notify/webpush/webpush.go:304` | `guardedClient` |
| GOF-0054 | `apps/backend/adapters/notify/webpush/webpush.go:326` | `clip` |
| GOF-0055 | `apps/backend/adapters/prices/alchemy/alchemy.go:27` | `init` |
| GOF-0056 | `apps/backend/adapters/prices/alchemy/alchemy.go:42` | `New` |
| GOF-0057 | `apps/backend/adapters/prices/alchemy/alchemy.go:63` | `(s *Source) Name` |
| GOF-0058 | `apps/backend/adapters/prices/alchemy/alchemy.go:76` | `(s *Source) do` |
| GOF-0059 | `apps/backend/adapters/prices/alchemy/alchemy.go:110` | `usd` |
| GOF-0060 | `apps/backend/adapters/prices/alchemy/alchemy.go:124` | `(s *Source) Quotes` |
| GOF-0061 | `apps/backend/adapters/prices/coingecko/coingecko.go:26` | `init` |
| GOF-0062 | `apps/backend/adapters/prices/coingecko/coingecko.go:46` | `New` |
| GOF-0063 | `apps/backend/adapters/prices/coingecko/coingecko.go:74` | `(s *Source) Name` |
| GOF-0064 | `apps/backend/adapters/prices/coingecko/coingecko.go:76` | `(s *Source) get` |
| GOF-0065 | `apps/backend/adapters/prices/coingecko/coingecko.go:111` | `(s *Source) Quotes` |
| GOF-0066 | `apps/backend/adapters/risk/alchemy/alchemy.go:24` | `init` |
| GOF-0067 | `apps/backend/adapters/risk/alchemy/alchemy.go:35` | `New` |
| GOF-0068 | `apps/backend/adapters/risk/alchemy/alchemy.go:54` | `(s *Simulator) Name` |
| GOF-0069 | `apps/backend/adapters/risk/alchemy/alchemy.go:59` | `(s *Simulator) Simulate` |
| GOF-0070 | `apps/backend/adapters/rpc/alchemy/alchemy.go:14` | `init` |
| GOF-0071 | `apps/backend/adapters/rpc/alchemy/alchemy.go:17` | `New` |
| GOF-0072 | `apps/backend/adapters/rpc/infura/infura.go:14` | `init` |
| GOF-0073 | `apps/backend/adapters/rpc/infura/infura.go:17` | `New` |
| GOF-0074 | `apps/backend/adapters/rpc/url/url.go:17` | `init` |
| GOF-0075 | `apps/backend/adapters/rpc/url/url.go:20` | `New` |
| GOF-0076 | `apps/backend/adapters/sources/alchemy/alchemy.go:32` | `init` |
| GOF-0077 | `apps/backend/adapters/sources/alchemy/alchemy.go:59` | `New` |
| GOF-0078 | `apps/backend/adapters/sources/alchemy/alchemy.go:104` | `(s *Source) Name` |
| GOF-0079 | `apps/backend/adapters/sources/alchemy/alchemy.go:108` | `(s *Source) Subscribe` |
| GOF-0080 | `apps/backend/adapters/sources/alchemy/alchemy.go:112` | `(s *Source) opts` |
| GOF-0081 | `apps/backend/adapters/sources/alchemy/alchemy.go:120` | `(s *Source) base` |
| GOF-0082 | `apps/backend/adapters/sources/alchemy/alchemy.go:126` | `(s *Source) do` |
| GOF-0083 | `apps/backend/adapters/sources/alchemy/alchemy.go:155` | `(e *APIError) Error` |
| GOF-0084 | `apps/backend/adapters/sources/alchemy/alchemy.go:157` | `snippet` |
| GOF-0085 | `apps/backend/adapters/sources/alchemy/alchemy.go:164` | `(s *Source) rpc` |
| GOF-0086 | `apps/backend/adapters/sources/alchemy/alchemy.go:218` | `(s *Source) categories` |
| GOF-0087 | `apps/backend/adapters/sources/alchemy/alchemy.go:233` | `(s *Source) transfers` |
| GOF-0088 | `apps/backend/adapters/sources/alchemy/alchemy.go:259` | `(s *Source) fillTimestamps` |
| GOF-0089 | `apps/backend/adapters/sources/alchemy/alchemy.go:292` | `containsStr` |
| GOF-0090 | `apps/backend/adapters/sources/alchemy/alchemy.go:301` | `hexToDec` |
| GOF-0091 | `apps/backend/adapters/sources/alchemy/alchemy.go:313` | `parseIndex` |
| GOF-0092 | `apps/backend/adapters/sources/alchemy/alchemy.go:324` | `eventRef` |
| GOF-0093 | `apps/backend/adapters/sources/alchemy/alchemy.go:352` | `(s *Source) convert` |
| GOF-0094 | `apps/backend/adapters/sources/alchemy/alchemy.go:456` | `decodeCursor` |
| GOF-0095 | `apps/backend/adapters/sources/alchemy/alchemy.go:471` | `encodeCursor` |
| GOF-0096 | `apps/backend/adapters/sources/alchemy/alchemy.go:478` | `(s *Source) Backfill` |
| GOF-0097 | `apps/backend/adapters/sources/alchemy/alchemy.go:580` | `(s *Source) Since` |
| GOF-0098 | `apps/backend/adapters/sources/alchemy/alchemy.go:643` | `(s *Source) TokenContracts` |
| GOF-0099 | `apps/backend/adapters/sources/alchemy/alchemy.go:679` | `(s *Source) NFTs` |
| GOF-0100 | `apps/backend/adapters/sources/alchemy/alchemy.go:746` | `(s *Source) HasIncoming` |
| GOF-0101 | `apps/backend/adapters/sources/alchemy/webhooks.go:31` | `internalRef` |
| GOF-0102 | `apps/backend/adapters/sources/alchemy/webhooks.go:37` | `(s *Source) WebhooksEnabled` |
| GOF-0103 | `apps/backend/adapters/sources/alchemy/webhooks.go:40` | `(s *Source) MaxAddressesPerWebhook` |
| GOF-0104 | `apps/backend/adapters/sources/alchemy/webhooks.go:82` | `(s *Source) WebhookID` |
| GOF-0105 | `apps/backend/adapters/sources/alchemy/webhooks.go:93` | `(s *Source) VerifyWebhook` |
| GOF-0106 | `apps/backend/adapters/sources/alchemy/webhooks.go:109` | `(s *Source) chainForNetwork` |
| GOF-0107 | `apps/backend/adapters/sources/alchemy/webhooks.go:118` | `decimalsOf` |
| GOF-0108 | `apps/backend/adapters/sources/alchemy/webhooks.go:144` | `(s *Source) ParseWebhook` |
| GOF-0109 | `apps/backend/adapters/sources/alchemy/webhooks.go:240` | `(s *Source) notify` |
| GOF-0110 | `apps/backend/adapters/sources/alchemy/webhooks.go:262` | `(s *Source) CreateWebhook` |
| GOF-0111 | `apps/backend/adapters/sources/alchemy/webhooks.go:291` | `(s *Source) UpdateWebhookAddresses` |
| GOF-0112 | `apps/backend/adapters/sources/alchemy/webhooks.go:304` | `(s *Source) DeleteWebhook` |
| GOF-0113 | `apps/backend/adapters/sources/alchemy/webhooks.go:309` | `plainSymbol` |
| GOF-0114 | `apps/backend/cmd/api/main.go:27` | `main` |
| GOF-0115 | `apps/backend/cmd/hbdevice/main.go:33` | `main` |
| GOF-0116 | `apps/backend/cmd/hbdevice/main.go:106` | `need` |
| GOF-0117 | `apps/backend/cmd/hbdevice/main.go:113` | `check` |
| GOF-0118 | `apps/backend/cmd/hbdevice/send.go:22` | `printAddr` |
| GOF-0119 | `apps/backend/cmd/hbdevice/send.go:33` | `send` |
| GOF-0120 | `apps/backend/cmd/hbdevice/send.go:82` | `watch` |
| GOF-0121 | `apps/backend/cmd/hbkeys/main.go:11` | `main` |
| GOF-0122 | `apps/backend/cmd/hbverify/main.go:26` | `main` |
| GOF-0123 | `apps/backend/cmd/hbverify/main.go:141` | `deref` |
| GOF-0124 | `apps/backend/cmd/hbverify/main.go:148` | `die` |
| GOF-0125 | `apps/backend/cmd/indexer/main.go:24` | `main` |
| GOF-0126 | `apps/backend/cmd/migrate/main.go:19` | `main` |
| GOF-0127 | `apps/backend/cmd/migrate/main.go:82` | `die` |
| GOF-0128 | `apps/backend/cmd/notifier/main.go:24` | `main` |
| GOF-0129 | `apps/backend/cmd/price-poller/main.go:24` | `main` |
| GOF-0130 | `apps/backend/cmd/realtime-bridge/main.go:18` | `main` |
| GOF-0131 | `apps/backend/cmd/rpc-gateway/main.go:21` | `main` |
| GOF-0132 | `apps/backend/cmd/tx-tracker/main.go:20` | `main` |
| GOF-0133 | `apps/backend/cmd/webhook-ingest/main.go:27` | `main` |
| GOF-0134 | `apps/backend/internal/api/auth.go:35` | `deviceFrom` |
| GOF-0135 | `apps/backend/internal/api/auth.go:48` | `(s *Server) handleChallenge` |
| GOF-0136 | `apps/backend/internal/api/auth.go:104` | `(s *Server) quotas` |
| GOF-0137 | `apps/backend/internal/api/auth.go:109` | `(s *Server) handleRegister` |
| GOF-0138 | `apps/backend/internal/api/auth.go:177` | `(s *Server) effectiveTier` |
| GOF-0139 | `apps/backend/internal/api/auth.go:194` | `(s *Server) shouldTouch` |
| GOF-0140 | `apps/backend/internal/api/auth.go:203` | `(s *Server) lookupDevice` |
| GOF-0141 | `apps/backend/internal/api/auth.go:252` | `(f *authFailures) roll` |
| GOF-0142 | `apps/backend/internal/api/auth.go:258` | `(f *authFailures) blocked` |
| GOF-0143 | `apps/backend/internal/api/auth.go:265` | `(f *authFailures) add` |
| GOF-0144 | `apps/backend/internal/api/auth.go:272` | `(s *Server) deviceAuth` |
| GOF-0145 | `apps/backend/internal/api/auth.go:355` | `(s *Server) counter` |
| GOF-0146 | `apps/backend/internal/api/auth.go:369` | `(s *Server) dailyCounter` |
| GOF-0147 | `apps/backend/internal/api/auth.go:387` | `(s *Server) rateLimit` |
| GOF-0148 | `apps/backend/internal/api/auth.go:419` | `(c *captureWriter) WriteHeader` |
| GOF-0149 | `apps/backend/internal/api/auth.go:420` | `(c *captureWriter) Write` |
| GOF-0150 | `apps/backend/internal/api/auth.go:434` | `(s *Server) idempotency` |
| GOF-0151 | `apps/backend/internal/api/auth.go:438` | `(s *Server) idempotencyNoBody` |
| GOF-0152 | `apps/backend/internal/api/auth.go:442` | `(s *Server) idempotencyBroadcast` |
| GOF-0153 | `apps/backend/internal/api/auth.go:447` | `scrubBroadcast` |
| GOF-0154 | `apps/backend/internal/api/auth.go:463` | `(s *Server) devTag` |
| GOF-0155 | `apps/backend/internal/api/auth.go:470` | `(s *Server) idemRedisKey` |
| GOF-0156 | `apps/backend/internal/api/auth.go:477` | `(s *Server) idempotencyHandler` |
| GOF-0157 | `apps/backend/internal/api/auth.go:540` | `(s *Server) secEvent` |
| GOF-0158 | `apps/backend/internal/api/gateway.go:44` | `GatewayKeysFromEnv` |
| GOF-0159 | `apps/backend/internal/api/gateway.go:71` | `DefaultGatewayHosts` |
| GOF-0160 | `apps/backend/internal/api/gateway.go:141` | `setOf` |
| GOF-0161 | `apps/backend/internal/api/gateway.go:186` | `(c redisGWCache) Get` |
| GOF-0162 | `apps/backend/internal/api/gateway.go:194` | `(c redisGWCache) Set` |
| GOF-0163 | `apps/backend/internal/api/gateway.go:198` | `newGateway` |
| GOF-0164 | `apps/backend/internal/api/gateway.go:220` | `parseRPCObject` |
| GOF-0165 | `apps/backend/internal/api/gateway.go:264` | `jsonRPCClean` |
| GOF-0166 | `apps/backend/internal/api/gateway.go:319` | `hasSponsorCall` |
| GOF-0167 | `apps/backend/internal/api/gateway.go:347` | `pinSponsorPolicy` |
| GOF-0168 | `apps/backend/internal/api/gateway.go:408` | `canonLogFilter` |
| GOF-0169 | `apps/backend/internal/api/gateway.go:464` | `jsonRPCGuard` |
| GOF-0170 | `apps/backend/internal/api/gateway.go:482` | `boundedSolana` |
| GOF-0171 | `apps/backend/internal/api/gateway.go:513` | `boundedLogs` |
| GOF-0172 | `apps/backend/internal/api/gateway.go:548` | `cleanQuery` |
| GOF-0173 | `apps/backend/internal/api/gateway.go:594` | `uniswapBodyAllowed` |
| GOF-0174 | `apps/backend/internal/api/gateway.go:633` | `rawQuery` |
| GOF-0175 | `apps/backend/internal/api/gateway.go:644` | `(g *gateway) coingecko` |
| GOF-0176 | `apps/backend/internal/api/gateway.go:657` | `(g *gateway) resolve` |
| GOF-0177 | `apps/backend/internal/api/gateway.go:928` | `lifiTTL` |
| GOF-0178 | `apps/backend/internal/api/gateway.go:938` | `(g *gateway) alchemySlug` |
| GOF-0179 | `apps/backend/internal/api/gateway.go:957` | `(g *gateway) run` |
| GOF-0180 | `apps/backend/internal/api/gateway.go:1015` | `(g *gateway) fetch` |
| GOF-0181 | `apps/backend/internal/api/gateway.go:1063` | `scrubBytes` |
| GOF-0182 | `apps/backend/internal/api/gateway.go:1072` | `scrub` |
| GOF-0183 | `apps/backend/internal/api/gateway.go:1082` | `(s *Server) gwLimit` |
| GOF-0184 | `apps/backend/internal/api/gateway.go:1090` | `(s *Server) handleGateway` |
| GOF-0185 | `apps/backend/internal/api/gateway.go:1136` | `(s *Server) handleGatewayConfig` |
| GOF-0186 | `apps/backend/internal/api/gateway.go:1147` | `alchemySlugs` |
| GOF-0187 | `apps/backend/internal/api/handlers.go:17` | `(s *Server) handleMe` |
| GOF-0188 | `apps/backend/internal/api/handlers.go:34` | `view` |
| GOF-0189 | `apps/backend/internal/api/handlers.go:39` | `(s *Server) handleListAddresses` |
| GOF-0190 | `apps/backend/internal/api/handlers.go:66` | `(s *Server) handlePutAddresses` |
| GOF-0191 | `apps/backend/internal/api/handlers.go:152` | `(s *Server) handleRPC` |
| GOF-0192 | `apps/backend/internal/api/handlers.go:251` | `filteredLogs` |
| GOF-0193 | `apps/backend/internal/api/handlers.go:274` | `stripGatewayInternals` |
| GOF-0194 | `apps/backend/internal/api/media.go:34` | `(s *Server) handleTx` |
| GOF-0195 | `apps/backend/internal/api/media.go:126` | `(s *Server) deviceInvolvedInTx` |
| GOF-0196 | `apps/backend/internal/api/media.go:164` | `(e *rpcError) Error` |
| GOF-0197 | `apps/backend/internal/api/media.go:167` | `(s *Server) gatewayCall` |
| GOF-0198 | `apps/backend/internal/api/media.go:172` | `(s *Server) gatewayCallSession` |
| GOF-0199 | `apps/backend/internal/api/media.go:240` | `blocked` |
| GOF-0200 | `apps/backend/internal/api/media.go:255` | `newMediaClient` |
| GOF-0201 | `apps/backend/internal/api/media.go:282` | `mediaURL` |
| GOF-0202 | `apps/backend/internal/api/media.go:295` | `fetchImage` |
| GOF-0203 | `apps/backend/internal/api/media.go:359` | `(s *Server) handleMedia` |
| GOF-0204 | `apps/backend/internal/api/media.go:419` | `writeImage` |
| GOF-0205 | `apps/backend/internal/api/read.go:31` | `(s *Server) selectTracked` |
| GOF-0206 | `apps/backend/internal/api/read.go:72` | `ids` |
| GOF-0207 | `apps/backend/internal/api/read.go:81` | `formatUnits` |
| GOF-0208 | `apps/backend/internal/api/read.go:104` | `valueUSD` |
| GOF-0209 | `apps/backend/internal/api/read.go:129` | `assetOf` |
| GOF-0210 | `apps/backend/internal/api/read.go:140` | `priceOf` |
| GOF-0211 | `apps/backend/internal/api/read.go:172` | `synced` |
| GOF-0212 | `apps/backend/internal/api/read.go:176` | `(s *Server) cacheKey` |
| GOF-0213 | `apps/backend/internal/api/read.go:181` | `(s *Server) cached` |
| GOF-0214 | `apps/backend/internal/api/read.go:192` | `(s *Server) writeCached` |
| GOF-0215 | `apps/backend/internal/api/read.go:200` | `(s *Server) handlePortfolio` |
| GOF-0216 | `apps/backend/internal/api/read.go:267` | `encodeCursor` |
| GOF-0217 | `apps/backend/internal/api/read.go:272` | `decodeCursor` |
| GOF-0218 | `apps/backend/internal/api/read.go:317` | `(s *Server) handleHistory` |
| GOF-0219 | `apps/backend/internal/api/read.go:441` | `(s *Server) handleNFTs` |
| GOF-0220 | `apps/backend/internal/api/read.go:483` | `(s *Server) requestNFTSync` |
| GOF-0221 | `apps/backend/internal/api/read.go:509` | `(s *Server) handleChart` |
| GOF-0222 | `apps/backend/internal/api/read.go:542` | `(s *Server) assetFromPath` |
| GOF-0223 | `apps/backend/internal/api/read.go:561` | `(s *Server) handleAsset` |
| GOF-0224 | `apps/backend/internal/api/read.go:576` | `(s *Server) handleAssetPrices` |
| GOF-0225 | `apps/backend/internal/api/realtime.go:26` | `(s *Server) handleRealtimeToken` |
| GOF-0226 | `apps/backend/internal/api/realtime.go:67` | `(s *Server) handleVAPID` |
| GOF-0227 | `apps/backend/internal/api/realtime.go:76` | `b64len` |
| GOF-0228 | `apps/backend/internal/api/realtime.go:85` | `(s *Server) handlePutPush` |
| GOF-0229 | `apps/backend/internal/api/realtime.go:118` | `(s *Server) handleDeletePush` |
| GOF-0230 | `apps/backend/internal/api/realtime.go:126` | `(s *Server) routeTags` |
| GOF-0231 | `apps/backend/internal/api/realtime.go:139` | `(s *Server) syncPushRoutes` |
| GOF-0232 | `apps/backend/internal/api/realtime.go:155` | `knownPushHost` |
| GOF-0233 | `apps/backend/internal/api/send.go:53` | `toQty` |
| GOF-0234 | `apps/backend/internal/api/send.go:64` | `hexToDec` |
| GOF-0235 | `apps/backend/internal/api/send.go:73` | `(s *Server) sendChain` |
| GOF-0236 | `apps/backend/internal/api/send.go:89` | `sendSession` |
| GOF-0237 | `apps/backend/internal/api/send.go:97` | `(s *Server) parseTx` |
| GOF-0238 | `apps/backend/internal/api/send.go:132` | `(s *Server) ownsAddress` |
| GOF-0239 | `apps/backend/internal/api/send.go:147` | `sendRateKey` |
| GOF-0240 | `apps/backend/internal/api/send.go:149` | `(s *Server) sendRate` |
| GOF-0241 | `apps/backend/internal/api/send.go:163` | `networkBusy` |
| GOF-0242 | `apps/backend/internal/api/send.go:168` | `friendlyChainError` |
| GOF-0243 | `apps/backend/internal/api/send.go:192` | `(s *Server) handleEstimate` |
| GOF-0244 | `apps/backend/internal/api/send.go:273` | `(s *Server) handleSimulate` |
| GOF-0245 | `apps/backend/internal/api/send.go:329` | `nonNil` |
| GOF-0246 | `apps/backend/internal/api/send.go:338` | `(s *Server) handleBroadcast` |
| GOF-0247 | `apps/backend/internal/api/server.go:37` | `(p LogPublisher) Publish` |
| GOF-0248 | `apps/backend/internal/api/server.go:100` | `New` |
| GOF-0249 | `apps/backend/internal/api/server.go:142` | `(s *Server) powDifficulty` |
| GOF-0250 | `apps/backend/internal/api/server.go:150` | `(s *Server) Handler` |
| GOF-0251 | `apps/backend/internal/api/server.go:208` | `writeJSON` |
| GOF-0252 | `apps/backend/internal/api/server.go:215` | `writeErr` |
| GOF-0253 | `apps/backend/internal/api/server.go:219` | `(s *Server) internalErr` |
| GOF-0254 | `apps/backend/internal/api/server.go:224` | `maxBody` |
| GOF-0255 | `apps/backend/internal/api/server.go:233` | `routePattern` |
| GOF-0256 | `apps/backend/internal/api/server.go:241` | `(s *Server) accessLog` |
| GOF-0257 | `apps/backend/internal/api/server.go:253` | `clientIP` |
| GOF-0258 | `apps/backend/internal/api/server.go:278` | `ParseCIDRs` |
| GOF-0259 | `apps/backend/internal/api/server.go:293` | `inNets` |
| GOF-0260 | `apps/backend/internal/api/server.go:305` | `(s *Server) realIP` |
| GOF-0261 | `apps/backend/internal/api/server.go:335` | `(s *Server) normalizeAddress` |
| GOF-0262 | `apps/backend/internal/api/server.go:351` | `(s *Server) tier` |
| GOF-0263 | `apps/backend/internal/api/server.go:360` | `(s *Server) securityHeaders` |
| GOF-0264 | `apps/backend/internal/config/config.go:190` | `Load` |
| GOF-0265 | `apps/backend/internal/config/config.go:210` | `(c *Config) restrictChains` |
| GOF-0266 | `apps/backend/internal/config/config.go:234` | `(c *Config) ApplyDefaults` |
| GOF-0267 | `apps/backend/internal/config/config.go:236` | `(c *Config) defaults` |
| GOF-0268 | `apps/backend/internal/config/config.go:319` | `(c *Config) validate` |
| GOF-0269 | `apps/backend/internal/config/config.go:362` | `(p Provider) key` |
| GOF-0270 | `apps/backend/internal/config/config.go:372` | `(c *Config) ChainNames` |
| GOF-0271 | `apps/backend/internal/config/config.go:394` | `(c *Config) Upstreams` |
| GOF-0272 | `apps/backend/internal/config/config.go:440` | `LoadDotEnv` |
| GOF-0273 | `apps/backend/internal/config/config.go:458` | `LoadSecretFiles` |
| GOF-0274 | `apps/backend/internal/config/config.go:477` | `loadDotEnv` |
| GOF-0275 | `apps/backend/internal/config/config.go:515` | `Env` |
| GOF-0276 | `apps/backend/internal/config/secrets.go:11` | `DecodeKey` |
| GOF-0277 | `apps/backend/internal/core/index/index.go:169` | `IsNativeTransferLog` |
| GOF-0278 | `apps/backend/internal/core/notify/notify.go:24` | `(e ErrGone) Error` |
| GOF-0279 | `apps/backend/internal/core/rpc/rpc.go:37` | `(e *Error) Error` |
| GOF-0280 | `apps/backend/internal/core/rpc/rpc.go:46` | `(e *TransportError) Error` |
| GOF-0281 | `apps/backend/internal/core/rpc/rpc.go:52` | `(e *TransportError) Unwrap` |
| GOF-0282 | `apps/backend/internal/core/rpc/rpc.go:103` | `(c Class) String` |
| GOF-0283 | `apps/backend/internal/core/rpc/rpc.go:130` | `Classify` |
| GOF-0284 | `apps/backend/internal/core/rpc/rpc.go:188` | `NewGatewayError` |
| GOF-0285 | `apps/backend/internal/core/rpc/rpc.go:206` | `MethodKind` |
| GOF-0286 | `apps/backend/internal/devicesig/devicesig.go:36` | `Canonical` |
| GOF-0287 | `apps/backend/internal/devicesig/devicesig.go:42` | `Sign` |
| GOF-0288 | `apps/backend/internal/devicesig/devicesig.go:47` | `Verify` |
| GOF-0289 | `apps/backend/internal/devicesig/devicesig.go:56` | `B64` |
| GOF-0290 | `apps/backend/internal/devicesig/devicesig.go:59` | `UnB64` |
| GOF-0291 | `apps/backend/internal/devicesig/devicesig.go:62` | `ValidNonce` |
| GOF-0292 | `apps/backend/internal/devicesig/devicesig.go:75` | `RegistrationMessage` |
| GOF-0293 | `apps/backend/internal/devicesig/devicesig.go:78` | `PowInput` |
| GOF-0294 | `apps/backend/internal/devicesig/devicesig.go:83` | `LeadingZeroBits` |
| GOF-0295 | `apps/backend/internal/devicesig/devicesig.go:96` | `CheckPow` |
| GOF-0296 | `apps/backend/internal/devicesig/devicesig.go:105` | `SolvePow` |
| GOF-0297 | `apps/backend/internal/events/events.go:44` | `Connect` |
| GOF-0298 | `apps/backend/internal/events/events.go:68` | `(n *NATS) Publish` |
| GOF-0299 | `apps/backend/internal/events/events.go:74` | `(n *NATS) Consume` |
| GOF-0300 | `apps/backend/internal/events/events.go:99` | `(n *NATS) Close` |
| GOF-0301 | `apps/backend/internal/events/events.go:104` | `(l Log) Publish` |
| GOF-0302 | `apps/backend/internal/events/events.go:108` | `(l Log) Consume` |
| GOF-0303 | `apps/backend/internal/events/events.go:112` | `(l Log) Close` |
| GOF-0304 | `apps/backend/internal/evmtx/devsign/devsign.go:31` | `ParseKey` |
| GOF-0305 | `apps/backend/internal/evmtx/devsign/devsign.go:40` | `Address` |
| GOF-0306 | `apps/backend/internal/evmtx/devsign/devsign.go:45` | `Sign` |
| GOF-0307 | `apps/backend/internal/evmtx/evmtx.go:26` | `Decode` |
| GOF-0308 | `apps/backend/internal/evmtx/evmtx.go:69` | `uint` |
| GOF-0309 | `apps/backend/internal/evmtx/evmtx.go:81` | `header` |
| GOF-0310 | `apps/backend/internal/evmtx/evmtx.go:104` | `beLen` |
| GOF-0311 | `apps/backend/internal/evmtx/evmtx.go:117` | `list` |
| GOF-0312 | `apps/backend/internal/evmtx/sender.go:15` | `Sender` |
| GOF-0313 | `apps/backend/internal/evmtx/sender.go:82` | `Keccak` |
| GOF-0314 | `apps/backend/internal/evmtx/sender.go:89` | `rawItems` |
| GOF-0315 | `apps/backend/internal/evmtx/sender.go:107` | `payload` |
| GOF-0316 | `apps/backend/internal/evmtx/sender.go:117` | `rlpHeader` |
| GOF-0317 | `apps/backend/internal/evmtx/sender.go:129` | `EncodeBytes` |
| GOF-0318 | `apps/backend/internal/evmtx/sender.go:137` | `EncodeBig` |
| GOF-0319 | `apps/backend/internal/evmtx/sender.go:145` | `EncodeUint` |
| GOF-0320 | `apps/backend/internal/evmtx/sender.go:148` | `EncodeList` |
| GOF-0321 | `apps/backend/internal/gateway/cache.go:37` | `(e *centry) size` |
| GOF-0322 | `apps/backend/internal/gateway/cache.go:39` | `newCache` |
| GOF-0323 | `apps/backend/internal/gateway/cache.go:43` | `newCacheFor` |
| GOF-0324 | `apps/backend/internal/gateway/cache.go:57` | `(c *cache) get` |
| GOF-0325 | `apps/backend/internal/gateway/cache.go:76` | `(c *cache) remove` |
| GOF-0326 | `apps/backend/internal/gateway/cache.go:83` | `(c *cache) put` |
| GOF-0327 | `apps/backend/internal/gateway/cache.go:103` | `(c *cache) len` |
| GOF-0328 | `apps/backend/internal/gateway/cache.go:118` | `(b blockRef) numeric` |
| GOF-0329 | `apps/backend/internal/gateway/cache.go:120` | `parseBlockRef` |
| GOF-0330 | `apps/backend/internal/gateway/cache.go:170` | `splitParams` |
| GOF-0331 | `apps/backend/internal/gateway/cache.go:179` | `requestBlock` |
| GOF-0332 | `apps/backend/internal/gateway/cache.go:218` | `cachePolicy` |
| GOF-0333 | `apps/backend/internal/gateway/flight.go:23` | `(g *flightGroup) do` |
| GOF-0334 | `apps/backend/internal/gateway/flight.go:54` | `copyResp` |
| GOF-0335 | `apps/backend/internal/gateway/gateway.go:50` | `New` |
| GOF-0336 | `apps/backend/internal/gateway/gateway.go:104` | `NewWithPools` |
| GOF-0337 | `apps/backend/internal/gateway/gateway.go:113` | `(g *Gateway) Pool` |
| GOF-0338 | `apps/backend/internal/gateway/gateway.go:119` | `(g *Gateway) Run` |
| GOF-0339 | `apps/backend/internal/gateway/gateway.go:129` | `(g *Gateway) Handle` |
| GOF-0340 | `apps/backend/internal/gateway/gateway.go:142` | `(g *Gateway) HandleBatch` |
| GOF-0341 | `apps/backend/internal/gateway/gateway.go:159` | `(g *Gateway) handle` |
| GOF-0342 | `apps/backend/internal/gateway/gateway.go:223` | `(g *Gateway) countCall` |
| GOF-0343 | `apps/backend/internal/gateway/gateway.go:232` | `compact` |
| GOF-0344 | `apps/backend/internal/gateway/gateway.go:251` | `(g *Gateway) call` |
| GOF-0345 | `apps/backend/internal/gateway/gateway.go:274` | `errString` |
| GOF-0346 | `apps/backend/internal/gateway/gateway.go:284` | `(p *Pool) hedgeDelay` |
| GOF-0347 | `apps/backend/internal/gateway/gateway.go:300` | `(g *Gateway) execute` |
| GOF-0348 | `apps/backend/internal/gateway/gateway.go:344` | `(g *Gateway) hedged` |
| GOF-0349 | `apps/backend/internal/gateway/gateway.go:381` | `(g *Gateway) broadcast` |
| GOF-0350 | `apps/backend/internal/gateway/gateway.go:451` | `isAlreadyKnown` |
| GOF-0351 | `apps/backend/internal/gateway/gateway.go:458` | `(g *Gateway) splitLogs` |
| GOF-0352 | `apps/backend/internal/gateway/health.go:32` | `newWindow` |
| GOF-0353 | `apps/backend/internal/gateway/health.go:36` | `(w *window) record` |
| GOF-0354 | `apps/backend/internal/gateway/health.go:46` | `(w *window) reset` |
| GOF-0355 | `apps/backend/internal/gateway/health.go:61` | `(w *window) counts` |
| GOF-0356 | `apps/backend/internal/gateway/health.go:87` | `(w *window) stats` |
| GOF-0357 | `apps/backend/internal/gateway/health.go:135` | `(s breakerState) String` |
| GOF-0358 | `apps/backend/internal/gateway/health.go:153` | `(b *breaker) eligible` |
| GOF-0359 | `apps/backend/internal/gateway/health.go:167` | `(b *breaker) acquire` |
| GOF-0360 | `apps/backend/internal/gateway/health.go:187` | `(b *breaker) result` |
| GOF-0361 | `apps/backend/internal/gateway/health.go:218` | `(b *breaker) release` |
| GOF-0362 | `apps/backend/internal/gateway/health.go:226` | `(b *breaker) current` |
| GOF-0363 | `apps/backend/internal/gateway/health.go:244` | `newBucket` |
| GOF-0364 | `apps/backend/internal/gateway/health.go:252` | `(b *bucket) refill` |
| GOF-0365 | `apps/backend/internal/gateway/health.go:262` | `(b *bucket) available` |
| GOF-0366 | `apps/backend/internal/gateway/health.go:272` | `(b *bucket) take` |
| GOF-0367 | `apps/backend/internal/gateway/health.go:290` | `(b *bucket) wait` |
| GOF-0368 | `apps/backend/internal/gateway/health.go:303` | `(b *bucket) usedRatio` |
| GOF-0369 | `apps/backend/internal/gateway/metrics.go:12` | `(g *Gateway) count` |
| GOF-0370 | `apps/backend/internal/gateway/metrics.go:38` | `(g *Gateway) Status` |
| GOF-0371 | `apps/backend/internal/gateway/metrics.go:65` | `(g *Gateway) Healthy` |
| GOF-0372 | `apps/backend/internal/gateway/metrics.go:83` | `ms` |
| GOF-0373 | `apps/backend/internal/gateway/metrics.go:86` | `(g *Gateway) WriteMetrics` |
| GOF-0374 | `apps/backend/internal/gateway/pool.go:33` | `(m *member) record` |
| GOF-0375 | `apps/backend/internal/gateway/pool.go:71` | `NewPool` |
| GOF-0376 | `apps/backend/internal/gateway/pool.go:86` | `(p *Pool) headFresh` |
| GOF-0377 | `apps/backend/internal/gateway/pool.go:101` | `(p *Pool) BestHead` |
| GOF-0378 | `apps/backend/internal/gateway/pool.go:115` | `(p *Pool) Finalized` |
| GOF-0379 | `apps/backend/internal/gateway/pool.go:130` | `(p *Pool) estLatest` |
| GOF-0380 | `apps/backend/internal/gateway/pool.go:143` | `(p *Pool) score` |
| GOF-0381 | `apps/backend/internal/gateway/pool.go:163` | `(p *Pool) pick` |
| GOF-0382 | `apps/backend/internal/gateway/pool.go:230` | `(p *Pool) pinned` |
| GOF-0383 | `apps/backend/internal/gateway/pool.go:256` | `(p *Pool) pin` |
| GOF-0384 | `apps/backend/internal/gateway/pool.go:274` | `(p *Pool) touch` |
| GOF-0385 | `apps/backend/internal/gateway/pool.go:285` | `(p *Pool) idle` |
| GOF-0386 | `apps/backend/internal/gateway/pool.go:290` | `(p *Pool) headInterval` |
| GOF-0387 | `apps/backend/internal/gateway/pool.go:303` | `(p *Pool) LocalHead` |
| GOF-0388 | `apps/backend/internal/gateway/pool.go:323` | `(p *Pool) RunHeads` |
| GOF-0389 | `apps/backend/internal/gateway/pool.go:368` | `(p *Pool) follower` |
| GOF-0390 | `apps/backend/internal/gateway/pool.go:383` | `(p *Pool) pollAll` |
| GOF-0391 | `apps/backend/internal/gateway/pool.go:392` | `(p *Pool) pollHead` |
| GOF-0392 | `apps/backend/internal/gateway/server.go:21` | `(g *Gateway) Handler` |
| GOF-0393 | `apps/backend/internal/gateway/server.go:52` | `(g *Gateway) serveRPC` |
| GOF-0394 | `apps/backend/internal/hbclient/client.go:32` | `New` |
| GOF-0395 | `apps/backend/internal/hbclient/client.go:38` | `(c *Client) PublicKeyB64` |
| GOF-0396 | `apps/backend/internal/hbclient/client.go:43` | `(c *Client) Register` |
| GOF-0397 | `apps/backend/internal/hbclient/client.go:71` | `(c *Client) Do` |
| GOF-0398 | `apps/backend/internal/hbclient/client.go:81` | `(e *HTTPError) Error` |
| GOF-0399 | `apps/backend/internal/hbclient/client.go:83` | `(c *Client) do` |
| GOF-0400 | `apps/backend/internal/indexer/indexer.go:45` | `(c *Chain) Heads` |
| GOF-0401 | `apps/backend/internal/indexer/indexer.go:50` | `(c *Chain) FreshHeads` |
| GOF-0402 | `apps/backend/internal/indexer/indexer.go:54` | `(c *Chain) readHeads` |
| GOF-0403 | `apps/backend/internal/indexer/indexer.go:110` | `(ix *Indexer) needBlock` |
| GOF-0404 | `apps/backend/internal/indexer/indexer.go:126` | `(ix *Indexer) balanceReadStale` |
| GOF-0405 | `apps/backend/internal/indexer/indexer.go:146` | `New` |
| GOF-0406 | `apps/backend/internal/indexer/indexer.go:157` | `(ix *Indexer) chainNames` |
| GOF-0407 | `apps/backend/internal/indexer/indexer.go:168` | `(ix *Indexer) Wake` |
| GOF-0408 | `apps/backend/internal/indexer/indexer.go:180` | `(ix *Indexer) Run` |
| GOF-0409 | `apps/backend/internal/indexer/indexer.go:231` | `(ix *Indexer) workerLoop` |
| GOF-0410 | `apps/backend/internal/indexer/indexer.go:253` | `(ix *Indexer) sweepLoop` |
| GOF-0411 | `apps/backend/internal/indexer/indexer.go:274` | `(ix *Indexer) TriggerRefresh` |
| GOF-0412 | `apps/backend/internal/indexer/indexer.go:279` | `(ix *Indexer) Flush` |
| GOF-0413 | `apps/backend/internal/indexer/indexer.go:281` | `keys` |
| GOF-0414 | `apps/backend/internal/indexer/indexer.go:289` | `(ix *Indexer) ingestOpts` |
| GOF-0415 | `apps/backend/internal/indexer/indexer.go:304` | `(ix *Indexer) RunOneBackfill` |
| GOF-0416 | `apps/backend/internal/indexer/indexer.go:325` | `(ix *Indexer) backfill` |
| GOF-0417 | `apps/backend/internal/indexer/indexer.go:434` | `(ix *Indexer) probeDormant` |
| GOF-0418 | `apps/backend/internal/indexer/indexer.go:477` | `(ix *Indexer) SyncNFTsByID` |
| GOF-0419 | `apps/backend/internal/indexer/indexer.go:496` | `(ix *Indexer) LoadOlder` |
| GOF-0420 | `apps/backend/internal/indexer/indexer.go:553` | `(ix *Indexer) RefreshBalances` |
| GOF-0421 | `apps/backend/internal/indexer/indexer.go:651` | `(ix *Indexer) SyncNFTs` |
| GOF-0422 | `apps/backend/internal/indexer/indexer.go:704` | `newDebouncer` |
| GOF-0423 | `apps/backend/internal/indexer/indexer.go:712` | `(db *debouncer) Trigger` |
| GOF-0424 | `apps/backend/internal/indexer/indexer.go:729` | `(db *debouncer) take` |
| GOF-0425 | `apps/backend/internal/indexer/indexer.go:744` | `(db *debouncer) done` |
| GOF-0426 | `apps/backend/internal/indexer/indexer.go:753` | `(db *debouncer) fire` |
| GOF-0427 | `apps/backend/internal/indexer/indexer.go:770` | `(db *debouncer) Flush` |
| GOF-0428 | `apps/backend/internal/indexer/live.go:27` | `ActivitySubject` |
| GOF-0429 | `apps/backend/internal/indexer/live.go:68` | `(ix *Indexer) EnableLive` |
| GOF-0430 | `apps/backend/internal/indexer/live.go:97` | `probeURL` |
| GOF-0431 | `apps/backend/internal/indexer/live.go:123` | `(p *webhookPath) check` |
| GOF-0432 | `apps/backend/internal/indexer/live.go:140` | `(ix *Indexer) runLive` |
| GOF-0433 | `apps/backend/internal/indexer/live.go:272` | `(ix *Indexer) sortedChains` |
| GOF-0434 | `apps/backend/internal/indexer/live.go:285` | `(ix *Indexer) ManageWebhooks` |
| GOF-0435 | `apps/backend/internal/indexer/live.go:293` | `(ix *Indexer) manageWebhooks` |
| GOF-0436 | `apps/backend/internal/indexer/live.go:380` | `splitSub` |
| GOF-0437 | `apps/backend/internal/indexer/live.go:393` | `(ix *Indexer) HandleDelivery` |
| GOF-0438 | `apps/backend/internal/indexer/live.go:460` | `(ix *Indexer) afterIngest` |
| GOF-0439 | `apps/backend/internal/indexer/live.go:523` | `(ix *Indexer) publishIncoming` |
| GOF-0440 | `apps/backend/internal/indexer/live.go:540` | `safetyMargin` |
| GOF-0441 | `apps/backend/internal/indexer/live.go:555` | `(ix *Indexer) GapFill` |
| GOF-0442 | `apps/backend/internal/indexer/live.go:565` | `(ix *Indexer) gapFillChain` |
| GOF-0443 | `apps/backend/internal/indexer/live.go:619` | `(ix *Indexer) gapFillOne` |
| GOF-0444 | `apps/backend/internal/indexer/live.go:646` | `mergeResult` |
| GOF-0445 | `apps/backend/internal/indexer/live.go:673` | `(ix *Indexer) Repair` |
| GOF-0446 | `apps/backend/internal/indexer/live.go:776` | `reorgConfirmations` |
| GOF-0447 | `apps/backend/internal/indexer/refresh.go:16` | `(ix *Indexer) safetyOverdue` |
| GOF-0448 | `apps/backend/internal/indexer/refresh.go:44` | `newSettledRefresher` |
| GOF-0449 | `apps/backend/internal/indexer/refresh.go:49` | `(s *settledRefresher) handle` |
| GOF-0450 | `apps/backend/internal/indexer/refresh.go:89` | `(ix *Indexer) refreshAddress` |
| GOF-0451 | `apps/backend/internal/indexer/refresh.go:114` | `(ix *Indexer) refreshActiveBalances` |
| GOF-0452 | `apps/backend/internal/indexer/spam.go:16` | `SpamScore` |
| GOF-0453 | `apps/backend/internal/indexer/wiring.go:15` | `BuildChains` |
| GOF-0454 | `apps/backend/internal/ingest/ingest.go:76` | `(b *bucket) Allow` |
| GOF-0455 | `apps/backend/internal/ingest/ingest.go:93` | `New` |
| GOF-0456 | `apps/backend/internal/ingest/ingest.go:107` | `(in *Ingest) Handler` |
| GOF-0457 | `apps/backend/internal/ingest/ingest.go:122` | `(in *Ingest) signingKey` |
| GOF-0458 | `apps/backend/internal/ingest/ingest.go:154` | `(in *Ingest) receive` |
| GOF-0459 | `apps/backend/internal/ingest/ingest.go:227` | `(in *Ingest) Start` |
| GOF-0460 | `apps/backend/internal/ingest/ingest.go:242` | `(in *Ingest) RunHeartbeat` |
| GOF-0461 | `apps/backend/internal/logx/logx.go:11` | `New` |
| GOF-0462 | `apps/backend/internal/notifier/notifier.go:55` | `(n *Notifier) Run` |
| GOF-0463 | `apps/backend/internal/notifier/notifier.go:73` | `(n *Notifier) HandleActivity` |
| GOF-0464 | `apps/backend/internal/notifier/notifier.go:115` | `(n *Notifier) deliverAll` |
| GOF-0465 | `apps/backend/internal/notifier/notifier.go:133` | `safeSymbol` |
| GOF-0466 | `apps/backend/internal/notifier/notifier.go:150` | `(n *Notifier) HandleTx` |
| GOF-0467 | `apps/backend/internal/notifier/notifier.go:178` | `(n *Notifier) deliver` |
| GOF-0468 | `apps/backend/internal/notifier/notifier.go:213` | `displayAmount` |
| GOF-0469 | `apps/backend/internal/notifier/notifier.go:239` | `chainLabel` |
| GOF-0470 | `apps/backend/internal/prices/cache.go:30` | `Key` |
| GOF-0471 | `apps/backend/internal/prices/cache.go:33` | `Get` |
| GOF-0472 | `apps/backend/internal/prices/poller.go:48` | `(p *Poller) heldAssets` |
| GOF-0473 | `apps/backend/internal/prices/poller.go:68` | `(p *Poller) RunOnce` |
| GOF-0474 | `apps/backend/internal/prices/poller.go:184` | `jsonID` |
| GOF-0475 | `apps/backend/internal/prices/poller.go:189` | `(p *Poller) now` |
| GOF-0476 | `apps/backend/internal/prices/poller.go:197` | `(p *Poller) Run` |
| GOF-0477 | `apps/backend/internal/ratelimit/ratelimit.go:21` | `New` |
| GOF-0478 | `apps/backend/internal/ratelimit/ratelimit.go:30` | `(l *Limiter) Wait` |
| GOF-0479 | `apps/backend/internal/realtime/bridge.go:43` | `(b *Bridge) Run` |
| GOF-0480 | `apps/backend/internal/realtime/bridge.go:64` | `(b *Bridge) HandleBalance` |
| GOF-0481 | `apps/backend/internal/realtime/bridge.go:74` | `(b *Bridge) HandleTx` |
| GOF-0482 | `apps/backend/internal/realtime/bridge.go:84` | `(b *Bridge) Publish` |
| GOF-0483 | `apps/backend/internal/realtime/jwt.go:16` | `BalanceChannel` |
| GOF-0484 | `apps/backend/internal/realtime/jwt.go:21` | `TxChannel` |
| GOF-0485 | `apps/backend/internal/realtime/jwt.go:26` | `SignHS256` |
| GOF-0486 | `apps/backend/internal/realtime/jwt.go:40` | `ConnectionToken` |
| GOF-0487 | `apps/backend/internal/realtime/jwt.go:45` | `SubscriptionToken` |
| GOF-0488 | `apps/backend/internal/registry/registry.go:27` | `New` |
| GOF-0489 | `apps/backend/internal/registry/registry.go:30` | `(r *Registry[T]) Register` |
| GOF-0490 | `apps/backend/internal/registry/registry.go:40` | `(r *Registry[T]) Get` |
| GOF-0491 | `apps/backend/internal/registry/registry.go:52` | `(r *Registry[T]) Names` |
| GOF-0492 | `apps/backend/internal/registry/registry.go:58` | `(r *Registry[T]) namesLocked` |
| GOF-0493 | `apps/backend/internal/rpchttp/rpchttp.go:45` | `BuildURL` |
| GOF-0494 | `apps/backend/internal/rpchttp/rpchttp.go:69` | `New` |
| GOF-0495 | `apps/backend/internal/rpchttp/rpchttp.go:88` | `(u *Upstream) ID` |
| GOF-0496 | `apps/backend/internal/rpchttp/rpchttp.go:89` | `(u *Upstream) Provider` |
| GOF-0497 | `apps/backend/internal/rpchttp/rpchttp.go:90` | `(u *Upstream) Chain` |
| GOF-0498 | `apps/backend/internal/rpchttp/rpchttp.go:93` | `(u *Upstream) Call` |
| GOF-0499 | `apps/backend/internal/rpchttp/rpchttp.go:141` | `snippet` |
| GOF-0500 | `apps/backend/internal/rpchttp/rpchttp.go:150` | `(u *Upstream) Head` |
| GOF-0501 | `apps/backend/internal/rpchttp/rpchttp.go:189` | `(u *Upstream) blockNumber` |
| GOF-0502 | `apps/backend/internal/rpchttp/rpchttp.go:200` | `(u *Upstream) finalizedBlock` |
| GOF-0503 | `apps/backend/internal/rpchttp/rpchttp.go:208` | `parseBlockNumber` |
| GOF-0504 | `apps/backend/internal/rpchttp/rpchttp.go:221` | `(u *Upstream) headBatch` |
| GOF-0505 | `apps/backend/internal/rpchttp/rpchttp.go:262` | `(u *Upstream) post` |
| GOF-0506 | `apps/backend/internal/rpchttp/rpchttp.go:288` | `(u *Upstream) Health` |
| GOF-0507 | `apps/backend/internal/rpchttp/rpchttp.go:300` | `ParseQuantity` |
| GOF-0508 | `apps/backend/internal/store/devices.go:34` | `(s *Store) CreateDevice` |
| GOF-0509 | `apps/backend/internal/store/devices.go:52` | `(s *Store) GetDevice` |
| GOF-0510 | `apps/backend/internal/store/devices.go:65` | `(s *Store) TouchDevice` |
| GOF-0511 | `apps/backend/internal/store/devices.go:82` | `(c *LinkCrypto) DeviceTag` |
| GOF-0512 | `apps/backend/internal/store/devices.go:90` | `(c *LinkCrypto) KeyTag` |
| GOF-0513 | `apps/backend/internal/store/devices.go:97` | `(c *LinkCrypto) RouteTag` |
| GOF-0514 | `apps/backend/internal/store/devices.go:106` | `NewLinkCrypto` |
| GOF-0515 | `apps/backend/internal/store/devices.go:126` | `(c *LinkCrypto) linkHash` |
| GOF-0516 | `apps/backend/internal/store/devices.go:135` | `(c *LinkCrypto) seal` |
| GOF-0517 | `apps/backend/internal/store/devices.go:145` | `(c *LinkCrypto) open` |
| GOF-0518 | `apps/backend/internal/store/devices.go:179` | `(s *Store) AddDeviceAddresses` |
| GOF-0519 | `apps/backend/internal/store/devices.go:236` | `(s *Store) RemoveDeviceAddresses` |
| GOF-0520 | `apps/backend/internal/store/devices.go:266` | `(s *Store) DeviceAddresses` |
| GOF-0521 | `apps/backend/internal/store/devices.go:310` | `(s *Store) DeviceOwns` |
| GOF-0522 | `apps/backend/internal/store/devices.go:332` | `(s *Store) CountUntracked` |
| GOF-0523 | `apps/backend/internal/store/devices.go:353` | `NewSecretBox` |
| GOF-0524 | `apps/backend/internal/store/devices.go:371` | `(b *SecretBox) Seal` |
| GOF-0525 | `apps/backend/internal/store/devices.go:380` | `(b *SecretBox) Open` |
| GOF-0526 | `apps/backend/internal/store/indexer.go:31` | `(s *Store) ClaimBackfill` |
| GOF-0527 | `apps/backend/internal/store/indexer.go:50` | `(s *Store) GetTracked` |
| GOF-0528 | `apps/backend/internal/store/indexer.go:62` | `(s *Store) SaveBackfillCursor` |
| GOF-0529 | `apps/backend/internal/store/indexer.go:68` | `(s *Store) FinishBackfill` |
| GOF-0530 | `apps/backend/internal/store/indexer.go:87` | `(s *Store) UpdateHistory` |
| GOF-0531 | `apps/backend/internal/store/indexer.go:116` | `(c *AssetCache) get` |
| GOF-0532 | `apps/backend/internal/store/indexer.go:128` | `(c *AssetCache) child` |
| GOF-0533 | `apps/backend/internal/store/indexer.go:132` | `(c *AssetCache) mergeInto` |
| GOF-0534 | `apps/backend/internal/store/indexer.go:146` | `NewAssetCache` |
| GOF-0535 | `apps/backend/internal/store/indexer.go:148` | `nullStr` |
| GOF-0536 | `apps/backend/internal/store/indexer.go:156` | `(s *Store) UpsertAsset` |
| GOF-0537 | `apps/backend/internal/store/indexer.go:190` | `(s *Store) SetTokenInfo` |
| GOF-0538 | `apps/backend/internal/store/indexer.go:202` | `(s *Store) AssetsMissingInfo` |
| GOF-0539 | `apps/backend/internal/store/indexer.go:247` | `(r *IngestResult) NoteBlock` |
| GOF-0540 | `apps/backend/internal/store/indexer.go:270` | `(s *Store) ensurePartitions` |
| GOF-0541 | `apps/backend/internal/store/indexer.go:287` | `validAmount` |
| GOF-0542 | `apps/backend/internal/store/indexer.go:308` | `(s *Store) IngestEvents` |
| GOF-0543 | `apps/backend/internal/store/indexer.go:518` | `execBatch` |
| GOF-0544 | `apps/backend/internal/store/indexer.go:537` | `assetInputKey` |
| GOF-0545 | `apps/backend/internal/store/indexer.go:545` | `nullJSON` |
| GOF-0546 | `apps/backend/internal/store/indexer.go:564` | `(s *Store) UpsertBalances` |
| GOF-0547 | `apps/backend/internal/store/indexer.go:592` | `(s *Store) HeldTokenRefs` |
| GOF-0548 | `apps/backend/internal/store/indexer.go:602` | `(s *Store) DueForSweep` |
| GOF-0549 | `apps/backend/internal/store/indexer.go:625` | `(s *Store) Balances` |
| GOF-0550 | `apps/backend/internal/store/indexer.go:644` | `(s *Store) TrackedID` |
| GOF-0551 | `apps/backend/internal/store/indexer.go:669` | `SetMediaKeySecret` |
| GOF-0552 | `apps/backend/internal/store/indexer.go:676` | `MediaKey` |
| GOF-0553 | `apps/backend/internal/store/indexer.go:690` | `(s *Store) ReplaceNFTs` |
| GOF-0554 | `apps/backend/internal/store/live.go:26` | `(s *Store) Webhooks` |
| GOF-0555 | `apps/backend/internal/store/live.go:45` | `(s *Store) WebhookKey` |
| GOF-0556 | `apps/backend/internal/store/live.go:56` | `(s *Store) InsertWebhook` |
| GOF-0557 | `apps/backend/internal/store/live.go:68` | `(s *Store) DeleteWebhookRow` |
| GOF-0558 | `apps/backend/internal/store/live.go:81` | `(s *Store) PendingSubscriptions` |
| GOF-0559 | `apps/backend/internal/store/live.go:94` | `(s *Store) PendingUnsubscriptions` |
| GOF-0560 | `apps/backend/internal/store/live.go:107` | `(s *Store) SetSubscribed` |
| GOF-0561 | `apps/backend/internal/store/live.go:129` | `(s *Store) InsertDelivery` |
| GOF-0562 | `apps/backend/internal/store/live.go:136` | `(s *Store) PurgeDeliveries` |
| GOF-0563 | `apps/backend/internal/store/live.go:142` | `(s *Store) Heartbeat` |
| GOF-0564 | `apps/backend/internal/store/live.go:168` | `(s *Store) LastHeartbeat` |
| GOF-0565 | `apps/backend/internal/store/live.go:192` | `(s *Store) GapFillCandidates` |
| GOF-0566 | `apps/backend/internal/store/live.go:212` | `(s *Store) GapRowFor` |
| GOF-0567 | `apps/backend/internal/store/live.go:224` | `(s *Store) AdvanceLastSeen` |
| GOF-0568 | `apps/backend/internal/store/live.go:232` | `(s *Store) PromoteDormant` |
| GOF-0569 | `apps/backend/internal/store/live.go:243` | `(s *Store) MarkNFTsMoved` |
| GOF-0570 | `apps/backend/internal/store/live.go:269` | `(s *Store) NFTsSynced` |
| GOF-0571 | `apps/backend/internal/store/live.go:274` | `(s *Store) TouchActivity` |
| GOF-0572 | `apps/backend/internal/store/live.go:293` | `(s *Store) RemoveEvents` |
| GOF-0573 | `apps/backend/internal/store/live.go:353` | `(s *Store) TxEventKeys` |
| GOF-0574 | `apps/backend/internal/store/live.go:365` | `(s *Store) MarkFinalized` |
| GOF-0575 | `apps/backend/internal/store/live.go:386` | `(s *Store) UnfinalTxs` |
| GOF-0576 | `apps/backend/internal/store/live.go:399` | `(s *Store) SetTxBlock` |
| GOF-0577 | `apps/backend/internal/store/live.go:411` | `(s *Store) WithLock` |
| GOF-0578 | `apps/backend/internal/store/prices.go:22` | `(s *Store) HeldAssets` |
| GOF-0579 | `apps/backend/internal/store/prices.go:45` | `(s *Store) InsertTicks` |
| GOF-0580 | `apps/backend/internal/store/prices.go:63` | `(s *Store) SnapshotBalances` |
| GOF-0581 | `apps/backend/internal/store/prices.go:75` | `(s *Store) PruneTimeSeries` |
| GOF-0582 | `apps/backend/internal/store/read.go:27` | `(s *Store) TrackedStates` |
| GOF-0583 | `apps/backend/internal/store/read.go:55` | `scanAsset` |
| GOF-0584 | `apps/backend/internal/store/read.go:68` | `(s *Store) Holdings` |
| GOF-0585 | `apps/backend/internal/store/read.go:107` | `(s *Store) Activity` |
| GOF-0586 | `apps/backend/internal/store/read.go:136` | `(s *Store) AssetsByRef` |
| GOF-0587 | `apps/backend/internal/store/read.go:155` | `(s *Store) Asset` |
| GOF-0588 | `apps/backend/internal/store/read.go:165` | `(s *Store) TxFinality` |
| GOF-0589 | `apps/backend/internal/store/read.go:194` | `(s *Store) NFTs` |
| GOF-0590 | `apps/backend/internal/store/read.go:215` | `(s *Store) MediaSource` |
| GOF-0591 | `apps/backend/internal/store/read.go:232` | `(s *Store) Chart` |
| GOF-0592 | `apps/backend/internal/store/read.go:261` | `(s *Store) PriceSeries` |
| GOF-0593 | `apps/backend/internal/store/read.go:297` | `(s *Store) Tx` |
| GOF-0594 | `apps/backend/internal/store/read.go:334` | `(s *Store) Pending` |
| GOF-0595 | `apps/backend/internal/store/read.go:344` | `sprintf` |
| GOF-0596 | `apps/backend/internal/store/send.go:14` | `(s *Store) InsertPending` |
| GOF-0597 | `apps/backend/internal/store/send.go:31` | `(s *Store) DevicePending` |
| GOF-0598 | `apps/backend/internal/store/send.go:40` | `scanPending` |
| GOF-0599 | `apps/backend/internal/store/send.go:47` | `(s *Store) PrunePending` |
| GOF-0600 | `apps/backend/internal/store/send.go:57` | `(s *Store) DuePending` |
| GOF-0601 | `apps/backend/internal/store/send.go:69` | `(s *Store) UpdatePending` |
| GOF-0602 | `apps/backend/internal/store/send.go:81` | `(s *Store) PendingDevice` |
| GOF-0603 | `apps/backend/internal/store/send.go:102` | `(s *Store) UpsertPushSub` |
| GOF-0604 | `apps/backend/internal/store/send.go:122` | `(s *Store) DeletePushSub` |
| GOF-0605 | `apps/backend/internal/store/send.go:131` | `(s *Store) HasPushSub` |
| GOF-0606 | `apps/backend/internal/store/send.go:138` | `(s *Store) ReplaceRoutes` |
| GOF-0607 | `apps/backend/internal/store/send.go:153` | `(s *Store) PushSubsForRoute` |
| GOF-0608 | `apps/backend/internal/store/send.go:163` | `(s *Store) PushSubForDevice` |
| GOF-0609 | `apps/backend/internal/store/send.go:175` | `scanSub` |
| GOF-0610 | `apps/backend/internal/store/send.go:187` | `(s *Store) AssetTrust` |
| GOF-0611 | `apps/backend/internal/store/store.go:34` | `requireTLS` |
| GOF-0612 | `apps/backend/internal/store/store.go:44` | `isLoopbackOrSocket` |
| GOF-0613 | `apps/backend/internal/store/store.go:53` | `Open` |
| GOF-0614 | `apps/backend/internal/store/store.go:76` | `(s *Store) Close` |
| GOF-0615 | `apps/backend/internal/store/store.go:80` | `(s *Store) Migrate` |
| GOF-0616 | `apps/backend/internal/store/store.go:128` | `(s *Store) MaintainPartitions` |
| GOF-0617 | `apps/backend/internal/store/store.go:145` | `(s *Store) UpsertChains` |
| GOF-0618 | `apps/backend/internal/store/store.go:161` | `(s *Store) EnsureAppLogin` |
| GOF-0619 | `apps/backend/internal/testdb/testdb.go:16` | `URL` |
| GOF-0620 | `apps/backend/internal/txtrack/txtrack.go:48` | `BuildChains` |
| GOF-0621 | `apps/backend/internal/txtrack/txtrack.go:68` | `(t *Tracker) Run` |
| GOF-0622 | `apps/backend/internal/txtrack/txtrack.go:104` | `(t *Tracker) RunOnce` |
| GOF-0623 | `apps/backend/internal/txtrack/txtrack.go:109` | `(t *Tracker) runDue` |
| GOF-0624 | `apps/backend/internal/txtrack/txtrack.go:114` | `(t *Tracker) runOnce` |
| GOF-0625 | `apps/backend/internal/txtrack/txtrack.go:134` | `(t *Tracker) backoff` |
| GOF-0626 | `apps/backend/internal/txtrack/txtrack.go:146` | `(t *Tracker) check` |
| GOF-0627 | `apps/backend/internal/txtrack/txtrack.go:184` | `(t *Tracker) finish` |

### C6. Extension exported functions/constants/classes (1616, non-test, excl. generated chain list)

Owning feature = the group whose source path contains the file (Part A tables).

| ID | Location | Symbol |
|---|---|---|
| EXP-0001 | `apps/extension/src/core/twTaxonomy.ts:6` | `TW_NETWORKS` |
| EXP-0002 | `apps/extension/src/core/twTaxonomy.ts:20` | `TW_DEFAULT_NETWORKS` |
| EXP-0003 | `apps/extension/src/core/twTaxonomy.ts:23` | `TW_CATEGORIES` |
| EXP-0004 | `apps/extension/src/core/twTaxonomy.ts:38` | `fromListingDoc` |
| EXP-0005 | `apps/extension/src/core/txHistory.ts:35` | `EXPLORER_TX` |
| EXP-0006 | `apps/extension/src/core/txHistory.ts:44` | `SYMBOL` |
| EXP-0007 | `apps/extension/src/core/txHistory.ts:47` | `fmtUnits` |
| EXP-0008 | `apps/extension/src/core/txHistory.ts:63` | `mapBlockscout` |
| EXP-0009 | `apps/extension/src/core/txHistory.ts:77` | `mapEtherscanLike` |
| EXP-0010 | `apps/extension/src/core/txHistory.ts:91` | `mapEsplora` |
| EXP-0011 | `apps/extension/src/core/txHistory.ts:108` | `mapBlockbook` |
| EXP-0012 | `apps/extension/src/core/txHistory.ts:126` | `mapSolanaSignatures` |
| EXP-0013 | `apps/extension/src/core/txHistory.ts:143` | `mapBlockscoutTokens` |
| EXP-0014 | `apps/extension/src/core/txHistory.ts:156` | `mapEtherscanTokens` |
| EXP-0015 | `apps/extension/src/core/txHistory.ts:166` | `explorerTxFor` |
| EXP-0016 | `apps/extension/src/core/txHistory.ts:185` | `ETHERSCAN_V2_HISTORY` |
| EXP-0017 | `apps/extension/src/core/txHistory.ts:194` | `historySupportedFor` |
| EXP-0018 | `apps/extension/src/core/txHistory.ts:200` | `historySupported` |
| EXP-0019 | `apps/extension/src/core/txHistory.ts:201` | `historyUnsupportedReason` |
| EXP-0020 | `apps/extension/src/core/txHistory.ts:211` | `dropNativeShadows` |
| EXP-0021 | `apps/extension/src/core/txHistory.ts:251` | `fetchHistory` |
| EXP-0022 | `apps/extension/src/core/importKey.ts:15` | `MAX_WALLETS` |
| EXP-0023 | `apps/extension/src/core/importKey.ts:16` | `WALLET_LIMIT_ERROR` |
| EXP-0024 | `apps/extension/src/core/importKey.ts:17` | `canCreateWallet` |
| EXP-0025 | `apps/extension/src/core/importKey.ts:19` | `PRIVATE_KEY_MIN_LENGTH` |
| EXP-0026 | `apps/extension/src/core/importKey.ts:20` | `MAX_WALLET_NAME` |
| EXP-0027 | `apps/extension/src/core/importKey.ts:23` | `classifySecret` |
| EXP-0028 | `apps/extension/src/core/importKey.ts:29` | `normalizeMnemonic` |
| EXP-0029 | `apps/extension/src/core/importKey.ts:30` | `mnemonicWordCount` |
| EXP-0030 | `apps/extension/src/core/importKey.ts:32` | `mnemonicLengthState` |
| EXP-0031 | `apps/extension/src/core/importKey.ts:39` | `defaultWalletName` |
| EXP-0032 | `apps/extension/src/core/importKey.ts:45` | `validateWalletName` |
| EXP-0033 | `apps/extension/src/core/importKey.ts:57` | `coreCodec` |
| EXP-0034 | `apps/extension/src/core/importKey.ts:62` | `decodePrivateKeyBytes` |
| EXP-0035 | `apps/extension/src/core/importKey.ts:78` | `validatePrivateKey` |
| EXP-0036 | `apps/extension/src/core/importKey.ts:97` | `privateKeyNetworkOptions` |
| EXP-0037 | `apps/extension/src/core/importKey.ts:115` | `evmFamily` |
| EXP-0038 | `apps/extension/src/core/importKey.ts:121` | `hasDuplicateAddress` |
| EXP-0039 | `apps/extension/src/core/importKey.ts:137` | `pickSolanaVariants` |
| EXP-0040 | `apps/extension/src/core/importKey.ts:144` | `solanaHasHistory` |
| EXP-0041 | `apps/extension/src/core/importKey.ts:162` | `IMPORT_ERRORS` |
| EXP-0042 | `apps/extension/src/core/approvalScan.ts:15` | `MAX_SCAN_PAIRS` |
| EXP-0043 | `apps/extension/src/core/approvalScan.ts:16` | `PERMIT2` |
| EXP-0044 | `apps/extension/src/core/approvalScan.ts:27` | `pickScanChains` |
| EXP-0045 | `apps/extension/src/core/approvalScan.ts:38` | `scanOnChain` |
| EXP-0046 | `apps/extension/src/core/approvalScan.ts:84` | `coverageSummary` |
| EXP-0047 | `apps/extension/src/core/approvalScan.ts:92` | `readAllowance` |
| EXP-0048 | `apps/extension/src/core/qrImport.ts:10` | `decryptStoredKeys` |
| EXP-0049 | `apps/extension/src/core/discover/help.ts:8` | `HELP_STORAGE` |
| EXP-0050 | `apps/extension/src/core/discover/help.ts:10` | `DEFAULT_HELP` |
| EXP-0051 | `apps/extension/src/core/discover/help.ts:11` | `normalizeHelp` |
| EXP-0052 | `apps/extension/src/core/discover/help.ts:16` | `applyHelpPatch` |
| EXP-0053 | `apps/extension/src/core/discover/help.ts:31` | `parseAnnouncements` |
| EXP-0054 | `apps/extension/src/core/discover/help.ts:42` | `FAQ` |
| EXP-0055 | `apps/extension/src/core/discover/index.ts:9` | `LLAMA_PROTOCOLS` |
| EXP-0056 | `apps/extension/src/core/discover/index.ts:10` | `LLAMA_CHAINS` |
| EXP-0057 | `apps/extension/src/core/discover/index.ts:11` | `DISCOVER_TTL_MS` |
| EXP-0058 | `apps/extension/src/core/discover/index.ts:12` | `MAX_DAPPS` |
| EXP-0059 | `apps/extension/src/core/discover/index.ts:19` | `DAPP_CATEGORIES` |
| EXP-0060 | `apps/extension/src/core/discover/index.ts:28` | `categoryId` |
| EXP-0061 | `apps/extension/src/core/discover/index.ts:34` | `mapProtocols` |
| EXP-0062 | `apps/extension/src/core/discover/index.ts:55` | `mapChains` |
| EXP-0063 | `apps/extension/src/core/discover/index.ts:64` | `llamaChainName` |
| EXP-0064 | `apps/extension/src/core/discover/index.ts:65` | `harbourChainFor` |
| EXP-0065 | `apps/extension/src/core/discover/index.ts:71` | `buildSections` |
| EXP-0066 | `apps/extension/src/core/discover/index.ts:79` | `filterDapps` |
| EXP-0067 | `apps/extension/src/core/discover/index.ts:95` | `loadDapps` |
| EXP-0068 | `apps/extension/src/core/notifyRules.ts:5` | `newIncoming` |
| EXP-0069 | `apps/extension/src/core/customTokens.ts:11` | `MAX_TOKENS` |
| EXP-0070 | `apps/extension/src/core/customTokens.ts:16` | `tokenNetworks` |
| EXP-0071 | `apps/extension/src/core/customTokens.ts:17` | `TOKEN_NETWORKS` |
| EXP-0072 | `apps/extension/src/core/customTokens.ts:18` | `networkByChainId` |
| EXP-0073 | `apps/extension/src/core/customTokens.ts:19` | `tokenId` |
| EXP-0074 | `apps/extension/src/core/customTokens.ts:22` | `sanitizeToken` |
| EXP-0075 | `apps/extension/src/core/customTokens.ts:37` | `readTokens` |
| EXP-0076 | `apps/extension/src/core/customTokens.ts:40` | `upsertToken` |
| EXP-0077 | `apps/extension/src/core/customTokens.ts:46` | `removeToken` |
| EXP-0078 | `apps/extension/src/core/erc20.ts:15` | `ERC20_ABI` |
| EXP-0079 | `apps/extension/src/core/erc20.ts:27` | `MAX_DECIMALS` |
| EXP-0080 | `apps/extension/src/core/erc20.ts:33` | `cleanText` |
| EXP-0081 | `apps/extension/src/core/erc20.ts:42` | `clientFor` |
| EXP-0082 | `apps/extension/src/core/erc20.ts:47` | `clientFromRequest` |
| EXP-0083 | `apps/extension/src/core/erc20.ts:49` | `isNetworkError` |
| EXP-0084 | `apps/extension/src/core/erc20.ts:51` | `probeToken` |
| EXP-0085 | `apps/extension/src/core/erc20.ts:82` | `tokenBalance` |
| EXP-0086 | `apps/extension/src/core/erc20.ts:87` | `parseTokenAmount` |
| EXP-0087 | `apps/extension/src/core/erc20.ts:96` | `formatTokenAmount` |
| EXP-0088 | `apps/extension/src/core/erc20.ts:97` | `encodeTransfer` |
| EXP-0089 | `apps/extension/src/core/settingsExtra.ts:6` | `walletKind` |
| EXP-0090 | `apps/extension/src/core/settingsExtra.ts:12` | `WALLET_KIND_LABEL` |
| EXP-0091 | `apps/extension/src/core/settingsExtra.ts:13` | `canAddAccount` |
| EXP-0092 | `apps/extension/src/core/settingsExtra.ts:14` | `canBackupPhrase` |
| EXP-0093 | `apps/extension/src/core/settingsExtra.ts:15` | `canRevealPrivateKey` |
| EXP-0094 | `apps/extension/src/core/settingsExtra.ts:17` | `groupWallets<T extends { type?: string }>` |
| EXP-0095 | `apps/extension/src/core/settingsExtra.ts:22` | `shortAddress` |
| EXP-0096 | `apps/extension/src/core/settingsExtra.ts:26` | `DEVELOPER_FLAGS` |
| EXP-0097 | `apps/extension/src/core/settingsExtra.ts:33` | `testnetsEnabled` |
| EXP-0098 | `apps/extension/src/core/settingsExtra.ts:34` | `setTestnetsHidden` |
| EXP-0099 | `apps/extension/src/core/settingsExtra.ts:42` | `FAUCETS` |
| EXP-0100 | `apps/extension/src/core/settingsExtra.ts:50` | `isSafeFaucetUrl` |
| EXP-0101 | `apps/extension/src/core/settingsExtra.ts:55` | `emptyMigration` |
| EXP-0102 | `apps/extension/src/core/settingsExtra.ts:56` | `pickSource` |
| EXP-0103 | `apps/extension/src/core/settingsExtra.ts:60` | `destinationOptions` |
| EXP-0104 | `apps/extension/src/core/settingsExtra.ts:61` | `pickDestination` |
| EXP-0105 | `apps/extension/src/core/settingsExtra.ts:62` | `toggleAsset` |
| EXP-0106 | `apps/extension/src/core/settingsExtra.ts:63` | `selectAllAssets` |
| EXP-0107 | `apps/extension/src/core/settingsExtra.ts:66` | `hasPositiveBalance` |
| EXP-0108 | `apps/extension/src/core/settingsExtra.ts:67` | `migratableAssets` |
| EXP-0109 | `apps/extension/src/core/settingsExtra.ts:68` | `canContinueFromSource` |
| EXP-0110 | `apps/extension/src/core/settingsExtra.ts:69` | `canContinueFromDestination` |
| EXP-0111 | `apps/extension/src/core/settingsExtra.ts:70` | `canMigrate` |
| EXP-0112 | `apps/extension/src/core/settingsExtra.ts:72` | `migrationQueue` |
| EXP-0113 | `apps/extension/src/core/marketData.ts:11` | `CHART_RANGES` |
| EXP-0114 | `apps/extension/src/core/marketData.ts:17` | `COINGECKO_COIN` |
| EXP-0115 | `apps/extension/src/core/marketData.ts:22` | `coinIdFor` |
| EXP-0116 | `apps/extension/src/core/marketData.ts:28` | `tokenRef` |
| EXP-0117 | `apps/extension/src/core/marketData.ts:41` | `mapLlamaChart` |
| EXP-0118 | `apps/extension/src/core/marketData.ts:46` | `mapMarketChart` |
| EXP-0119 | `apps/extension/src/core/marketData.ts:68` | `fetchChart` |
| EXP-0120 | `apps/extension/src/core/marketData.ts:106` | `mapCoinInfo` |
| EXP-0121 | `apps/extension/src/core/marketData.ts:117` | `fetchInfo` |
| EXP-0122 | `apps/extension/src/core/smartAccount/userOp.ts:15` | `toRpcOp` |
| EXP-0123 | `apps/extension/src/core/smartAccount/delegation.ts:18` | `authorizationDigest` |
| EXP-0124 | `apps/extension/src/core/smartAccount/delegation.ts:21` | `authorizationTarget` |
| EXP-0125 | `apps/extension/src/core/smartAccount/delegation.ts:30` | `buildSignedType4` |
| EXP-0126 | `apps/extension/src/core/smartAccount/abi.ts:10` | `normalizeCall` |
| EXP-0127 | `apps/extension/src/core/smartAccount/abi.ts:22` | `encodeCalls` |
| EXP-0128 | `apps/extension/src/core/smartAccount/guard.ts:11` | `GUARD_MESSAGE` |
| EXP-0129 | `apps/extension/src/core/smartAccount/guard.ts:12` | `GuardError extends Error {` |
| EXP-0130 | `apps/extension/src/core/smartAccount/guard.ts:26` | `checkIntent` |
| EXP-0131 | `apps/extension/src/core/smartAccount/guard.ts:44` | `delegationState` |
| EXP-0132 | `apps/extension/src/core/smartAccount/guard.ts:53` | `requirePinnedDelegation` |
| EXP-0133 | `apps/extension/src/core/smartAccount/guard.ts:68` | `acceptGasPrice` |
| EXP-0134 | `apps/extension/src/core/smartAccount/guard.ts:87` | `acceptGasEstimate` |
| EXP-0135 | `apps/extension/src/core/smartAccount/guard.ts:95` | `padGasEstimate` |
| EXP-0136 | `apps/extension/src/core/smartAccount/guard.ts:105` | `acceptSponsorReply` |
| EXP-0137 | `apps/extension/src/core/smartAccount/guard.ts:119` | `maxTotalFee` |
| EXP-0138 | `apps/extension/src/core/smartAccount/guard.ts:123` | `checkFeeCap` |
| EXP-0139 | `apps/extension/src/core/smartAccount/guard.ts:130` | `assembleOp` |
| EXP-0140 | `apps/extension/src/core/smartAccount/guard.ts:139` | `checkAuthorization` |
| EXP-0141 | `apps/extension/src/core/smartAccount/guard.ts:147` | `assertFresh` |
| EXP-0142 | `apps/extension/src/core/smartAccount/permissions.ts:10` | `MAX_PERMISSION_SECONDS` |
| EXP-0143 | `apps/extension/src/core/smartAccount/permissions.ts:20` | `normalizePermissionRequest` |
| EXP-0144 | `apps/extension/src/core/smartAccount/permissions.ts:47` | `normalizeGrantParams` |
| EXP-0145 | `apps/extension/src/core/smartAccount/permissions.ts:66` | `grantResponse` |
| EXP-0146 | `apps/extension/src/core/smartAccount/constants.ts:7` | `SMART_ACCOUNT_FLAG` |
| EXP-0147 | `apps/extension/src/core/smartAccount/constants.ts:10` | `ENTRYPOINT_V07` |
| EXP-0148 | `apps/extension/src/core/smartAccount/constants.ts:16` | `SMART_ACCOUNT_CHAINS: readonly number[]` |
| EXP-0149 | `apps/extension/src/core/smartAccount/constants.ts:17` | `DELEGATES` |
| EXP-0150 | `apps/extension/src/core/smartAccount/constants.ts:23` | `PAYMASTERS` |
| EXP-0151 | `apps/extension/src/core/smartAccount/constants.ts:28` | `ZERO_ADDRESS` |
| EXP-0152 | `apps/extension/src/core/smartAccount/constants.ts:30` | `TYPE4_GAS_LIMIT` |
| EXP-0153 | `apps/extension/src/core/smartAccount/constants.ts:32` | `MAX_CALLS` |
| EXP-0154 | `apps/extension/src/core/smartAccount/constants.ts:33` | `PREPARED_TTL_MS` |
| EXP-0155 | `apps/extension/src/core/smartAccount/constants.ts:37` | `LIMITS` |
| EXP-0156 | `apps/extension/src/core/smartAccount/constants.ts:51` | `CHAIN_LIMITS` |
| EXP-0157 | `apps/extension/src/core/smartAccount/constants.ts:55` | `limitsFor` |
| EXP-0158 | `apps/extension/src/core/smartAccount/constants.ts:57` | `delegateFor` |
| EXP-0159 | `apps/extension/src/core/smartAccount/constants.ts:58` | `isSmartAccountChain` |
| EXP-0160 | `apps/extension/src/core/smartAccount/constants.ts:59` | `isPinnedPaymaster` |
| EXP-0161 | `apps/extension/src/core/smartAccount/constants.ts:63` | `DELEGATION_MANAGER` |
| EXP-0162 | `apps/extension/src/core/smartAccount/constants.ts:64` | `ENFORCERS` |
| EXP-0163 | `apps/extension/src/core/smartAccount/calls5792.ts:22` | `normalizeSendCalls` |
| EXP-0164 | `apps/extension/src/core/smartAccount/calls5792.ts:53` | `refuseRequiredCapabilities` |
| EXP-0165 | `apps/extension/src/core/smartAccount/calls5792.ts:61` | `buildCapabilities` |
| EXP-0166 | `apps/extension/src/core/smartAccount/calls5792.ts:72` | `UOP_EVENT` |
| EXP-0167 | `apps/extension/src/core/smartAccount/calls5792.ts:73` | `BEFORE_EXECUTION_EVENT` |
| EXP-0168 | `apps/extension/src/core/smartAccount/calls5792.ts:80` | `userOpLogs<T extends { address?: unknown; topics?: unknown }` |
| EXP-0169 | `apps/extension/src/core/smartAccount/calls5792.ts:102` | `buildCallsStatus` |
| EXP-0170 | `apps/extension/src/core/smartAccount/send.ts:28` | `USER_OP_EVENT_TOPIC` |
| EXP-0171 | `apps/extension/src/core/smartAccount/send.ts:31` | `verifyInclusion` |
| EXP-0172 | `apps/extension/src/core/smartAccount/send.ts:40` | `codeErr` |
| EXP-0173 | `apps/extension/src/core/smartAccount/send.ts:42` | `sendOperation` |
| EXP-0174 | `apps/extension/src/core/smartAccount/grantStore.ts:6` | `GRANTS_KEY` |
| EXP-0175 | `apps/extension/src/core/smartAccount/grantStore.ts:8` | `makeGrantStore` |
| EXP-0176 | `apps/extension/src/core/smartAccount/permissionDelegation.ts:22` | `buildPermissionDelegation` |
| EXP-0177 | `apps/extension/src/core/smartAccount/permissionDelegation.ts:36` | `checkPermissionDelegation` |
| EXP-0178 | `apps/extension/src/core/smartAccount/permissionDelegation.ts:62` | `delegationTypedData` |
| EXP-0179 | `apps/extension/src/core/smartAccount/permissionDelegation.ts:71` | `permissionHash` |
| EXP-0180 | `apps/extension/src/core/smartAccount/permissionDelegation.ts:72` | `permissionDigest` |
| EXP-0181 | `apps/extension/src/core/smartAccount/permissionDelegation.ts:75` | `signPermission` |
| EXP-0182 | `apps/extension/src/core/smartAccount/permissionDelegation.ts:81` | `permissionContext` |
| EXP-0183 | `apps/extension/src/core/smartAccount/kit.ts:18` | `encodeKitCalls` |
| EXP-0184 | `apps/extension/src/core/smartAccount/kit.ts:21` | `STUB_SIGNATURE` |
| EXP-0185 | `apps/extension/src/core/smartAccount/kit.ts:29` | `userOpTypedData` |
| EXP-0186 | `apps/extension/src/core/smartAccount/kit.ts:44` | `signUserOp` |
| EXP-0187 | `apps/extension/src/core/fiat.ts:14` | `BASE_CURRENCIES` |
| EXP-0188 | `apps/extension/src/core/fiat.ts:15` | `CURRENCY_CODES` |
| EXP-0189 | `apps/extension/src/core/fiat.ts:16` | `POPULAR_CURRENCIES` |
| EXP-0190 | `apps/extension/src/core/fiat.ts:17` | `OTHER_CURRENCIES` |
| EXP-0191 | `apps/extension/src/core/fiat.ts:18` | `isCryptoCurrency` |
| EXP-0192 | `apps/extension/src/core/fiat.ts:21` | `RATES_TTL_MS` |
| EXP-0193 | `apps/extension/src/core/fiat.ts:26` | `mapRates` |
| EXP-0194 | `apps/extension/src/core/fiat.ts:43` | `fetchRates` |
| EXP-0195 | `apps/extension/src/core/fiat.ts:56` | `getRate` |
| EXP-0196 | `apps/extension/src/core/fiat.ts:76` | `USD_CTX` |
| EXP-0197 | `apps/extension/src/core/fiat.ts:77` | `toFiat` |
| EXP-0198 | `apps/extension/src/core/fiat.ts:85` | `formatFiat` |
| EXP-0199 | `apps/extension/src/core/fiat.ts:98` | `formatFiatSigned` |
| EXP-0200 | `apps/extension/src/core/fiat.ts:101` | `formatFiatPrice` |
| EXP-0201 | `apps/extension/src/core/fiat.ts:110` | `formatFiatCompact` |
| EXP-0202 | `apps/extension/src/core/walletService.ts:5` | `WalletService {` |
| EXP-0203 | `apps/extension/src/core/errors.ts:19` | `userText` |
| EXP-0204 | `apps/extension/src/core/errors.ts:31` | `friendlyMessage` |
| EXP-0205 | `apps/extension/src/core/errors.ts:37` | `sanitizeResult<T>` |
| EXP-0206 | `apps/extension/src/core/tokenPrice.ts:6` | `PLATFORM` |
| EXP-0207 | `apps/extension/src/core/tokenPrice.ts:10` | `fetchTokenPrices` |
| EXP-0208 | `apps/extension/src/core/activity/broadcastTap.ts:11` | `decodeRawTx` |
| EXP-0209 | `apps/extension/src/core/activity/broadcastTap.ts:21` | `installBroadcastTap` |
| EXP-0210 | `apps/extension/src/core/activity/filter.ts:7` | `tokenKey` |
| EXP-0211 | `apps/extension/src/core/activity/filter.ts:8` | `emptyAllow` |
| EXP-0212 | `apps/extension/src/core/activity/filter.ts:10` | `filterByAddedAssets` |
| EXP-0213 | `apps/extension/src/core/activity/filter.ts:20` | `allowFromWallet` |
| EXP-0214 | `apps/extension/src/core/activity/engine.ts:39` | `createActivityEngine` |
| EXP-0215 | `apps/extension/src/core/activity/classify.ts:14` | `NATIVE_TRANSFER_LOG` |
| EXP-0216 | `apps/extension/src/core/activity/classify.ts:16` | `NATIVE` |
| EXP-0217 | `apps/extension/src/core/activity/classify.ts:21` | `tokenFlows` |
| EXP-0218 | `apps/extension/src/core/activity/classify.ts:42` | `allowanceLogs` |
| EXP-0219 | `apps/extension/src/core/activity/classify.ts:52` | `tokensNeeded` |
| EXP-0220 | `apps/extension/src/core/activity/classify.ts:58` | `classify` |
| EXP-0221 | `apps/extension/src/core/activity/index.ts:17` | `evmOf` |
| EXP-0222 | `apps/extension/src/core/activity/index.ts:23` | `activitySupported` |
| EXP-0223 | `apps/extension/src/core/activity/index.ts:24` | `activityUnsupportedReason` |
| EXP-0224 | `apps/extension/src/core/activity/index.ts:34` | `startActivityEngine` |
| EXP-0225 | `apps/extension/src/core/activity/index.ts:44` | `currentActivityEngine` |
| EXP-0226 | `apps/extension/src/core/activity/index.ts:65` | `setAssetAllowProvider` |
| EXP-0227 | `apps/extension/src/core/activity/index.ts:67` | `fetchActivity` |
| EXP-0228 | `apps/extension/src/core/activity/evm.ts:3` | `TOPIC_TRANSFER` |
| EXP-0229 | `apps/extension/src/core/activity/evm.ts:4` | `TOPIC_APPROVAL` |
| EXP-0230 | `apps/extension/src/core/activity/evm.ts:5` | `SEL_APPROVE` |
| EXP-0231 | `apps/extension/src/core/activity/evm.ts:6` | `SEL_TRANSFER` |
| EXP-0232 | `apps/extension/src/core/activity/evm.ts:7` | `SEL_SYMBOL` |
| EXP-0233 | `apps/extension/src/core/activity/evm.ts:8` | `SEL_DECIMALS` |
| EXP-0234 | `apps/extension/src/core/activity/evm.ts:9` | `ZERO_ADDRESS` |
| EXP-0235 | `apps/extension/src/core/activity/evm.ts:11` | `UNLIMITED_MIN` |
| EXP-0236 | `apps/extension/src/core/activity/evm.ts:13` | `SELECTOR_LABEL` |
| EXP-0237 | `apps/extension/src/core/activity/evm.ts:19` | `LEND_SELECTORS` |
| EXP-0238 | `apps/extension/src/core/activity/evm.ts:26` | `RpcError extends Error { constructor` |
| EXP-0239 | `apps/extension/src/core/activity/evm.ts:28` | `isRangeError` |
| EXP-0240 | `apps/extension/src/core/activity/evm.ts:30` | `lc` |
| EXP-0241 | `apps/extension/src/core/activity/evm.ts:31` | `toHex` |
| EXP-0242 | `apps/extension/src/core/activity/evm.ts:32` | `hexToNum` |
| EXP-0243 | `apps/extension/src/core/activity/evm.ts:33` | `hexToBig` |
| EXP-0244 | `apps/extension/src/core/activity/evm.ts:34` | `topicAddress` |
| EXP-0245 | `apps/extension/src/core/activity/evm.ts:35` | `addressOfTopic` |
| EXP-0246 | `apps/extension/src/core/activity/evm.ts:38` | `wordAddress` |
| EXP-0247 | `apps/extension/src/core/activity/evm.ts:39` | `wordBig` |
| EXP-0248 | `apps/extension/src/core/activity/evm.ts:42` | `makeRpc` |
| EXP-0249 | `apps/extension/src/core/activity/evm.ts:64` | `pool<T>` |
| EXP-0250 | `apps/extension/src/core/activity/evm.ts:72` | `decodeAbiString` |
| EXP-0251 | `apps/extension/src/core/activity/scanner.ts:10` | `DEFAULT_SCAN` |
| EXP-0252 | `apps/extension/src/core/activity/scanner.ts:12` | `newScanState` |
| EXP-0253 | `apps/extension/src/core/activity/scanner.ts:27` | `scanLogs` |
| EXP-0254 | `apps/extension/src/core/activity/merge.ts:7` | `hashOf` |
| EXP-0255 | `apps/extension/src/core/activity/merge.ts:12` | `mergeSources` |
| EXP-0256 | `apps/extension/src/core/fiatTable.ts:5` | `FIAT_TABLE` |
| EXP-0257 | `apps/extension/src/core/settings.ts:14` | `AUTO_LOCK_OPTIONS` |
| EXP-0258 | `apps/extension/src/core/settings.ts:15` | `MAX_LOCK_MINUTES` |
| EXP-0259 | `apps/extension/src/core/settings.ts:16` | `DEFAULT_LOCK_MINUTES` |
| EXP-0260 | `apps/extension/src/core/settings.ts:17` | `isAutoLockEnabled` |
| EXP-0261 | `apps/extension/src/core/settings.ts:18` | `sanitizeLockTime` |
| EXP-0262 | `apps/extension/src/core/settings.ts:22` | `autoLockLabel` |
| EXP-0263 | `apps/extension/src/core/settings.ts:28` | `SUPPORTED_LOCALES` |
| EXP-0264 | `apps/extension/src/core/settings.ts:31` | `pickLocale` |
| EXP-0265 | `apps/extension/src/core/settings.ts:37` | `intlTag` |
| EXP-0266 | `apps/extension/src/core/settings.ts:40` | `localeLabel` |
| EXP-0267 | `apps/extension/src/core/settings.ts:49` | `COLOR_MODES` |
| EXP-0268 | `apps/extension/src/core/settings.ts:51` | `TOKEN_LAYOUTS` |
| EXP-0269 | `apps/extension/src/core/settings.ts:73` | `DEFAULT_SETTINGS` |
| EXP-0270 | `apps/extension/src/core/settings.ts:92` | `applyPatch` |
| EXP-0271 | `apps/extension/src/core/settings.ts:125` | `normalizeSettings` |
| EXP-0272 | `apps/extension/src/core/settings.ts:130` | `sideEffects` |
| EXP-0273 | `apps/extension/src/core/settings.ts:138` | `LOW_BALANCE_USD` |
| EXP-0274 | `apps/extension/src/core/settings.ts:139` | `isLowBalance` |
| EXP-0275 | `apps/extension/src/core/settings.ts:144` | `weakensSecurity` |
| EXP-0276 | `apps/extension/src/core/storage.ts:10` | `isSecretKey` |
| EXP-0277 | `apps/extension/src/core/storage.ts:12` | `VAULT_REV` |
| EXP-0278 | `apps/extension/src/core/storage.ts:25` | `migrateSecretsToSecureStore` |
| EXP-0279 | `apps/extension/src/core/storage.ts:36` | `local` |
| EXP-0280 | `apps/extension/src/core/storage.ts:59` | `session` |
| EXP-0281 | `apps/extension/src/core/storage.ts:64` | `KEYS` |
| EXP-0282 | `apps/extension/src/core/passwordService.ts:2` | `DEFAULT_ITERATIONS` |
| EXP-0283 | `apps/extension/src/core/passwordService.ts:3` | `UNLOCK_ITERATIONS` |
| EXP-0284 | `apps/extension/src/core/passwordService.ts:4` | `KEY_LEN_BYTES` |
| EXP-0285 | `apps/extension/src/core/passwordService.ts:5` | `PasswordService {` |
| EXP-0286 | `apps/extension/src/core/swap/safety.ts:12` | `DANGEROUS_SELECTORS` |
| EXP-0287 | `apps/extension/src/core/swap/safety.ts:13` | `hasDangerousSelector` |
| EXP-0288 | `apps/extension/src/core/swap/safety.ts:16` | `LIFI_DIAMOND` |
| EXP-0289 | `apps/extension/src/core/swap/safety.ts:17` | `LIFI_ALLOWED` |
| EXP-0290 | `apps/extension/src/core/swap/safety.ts:18` | `isAllowedLifiTarget` |
| EXP-0291 | `apps/extension/src/core/swap/safety.ts:20` | `LIFI_NON_EVM_RECEIVER` |
| EXP-0292 | `apps/extension/src/core/swap/safety.ts:28` | `decodeLifiCall` |
| EXP-0293 | `apps/extension/src/core/swap/safety.ts:47` | `validateLifiTransaction` |
| EXP-0294 | `apps/extension/src/core/swap/safety.ts:100` | `JUPITER_PROGRAM` |
| EXP-0295 | `apps/extension/src/core/swap/safety.ts:111` | `parseSolanaTx` |
| EXP-0296 | `apps/extension/src/core/swap/safety.ts:123` | `attachSolanaSignature` |
| EXP-0297 | `apps/extension/src/core/swap/safety.ts:127` | `b64ToBytes` |
| EXP-0298 | `apps/extension/src/core/swap/safety.ts:128` | `bytesToB64` |
| EXP-0299 | `apps/extension/src/core/swap/errors.ts:4` | `SWAP_MESSAGES` |
| EXP-0300 | `apps/extension/src/core/swap/errors.ts:22` | `swapError` |
| EXP-0301 | `apps/extension/src/core/swap/errors.ts:25` | `classifyAggregatorError` |
| EXP-0302 | `apps/extension/src/core/swap/thorchain.ts:14` | `THORNODE_URLS` |
| EXP-0303 | `apps/extension/src/core/swap/thorchain.ts:26` | `THOR_ROUTER_ABI` |
| EXP-0304 | `apps/extension/src/core/swap/thorchain.ts:33` | `thorAsset` |
| EXP-0305 | `apps/extension/src/core/swap/thorchain.ts:40` | `toThorUnits` |
| EXP-0306 | `apps/extension/src/core/swap/thorchain.ts:44` | `fromThorUnits` |
| EXP-0307 | `apps/extension/src/core/swap/thorchain.ts:48` | `thorSupports` |
| EXP-0308 | `apps/extension/src/core/swap/thorchain.ts:65` | `thorQuote` |
| EXP-0309 | `apps/extension/src/core/swap/thorchain.ts:80` | `mapThorRoute` |
| EXP-0310 | `apps/extension/src/core/swap/thorchain.ts:105` | `thorchainRoutes` |
| EXP-0311 | `apps/extension/src/core/swap/thorchain.ts:115` | `checkThorQuote` |
| EXP-0312 | `apps/extension/src/core/swap/thorchain.ts:134` | `verifyThorInbound` |
| EXP-0313 | `apps/extension/src/core/swap/thorchain.ts:153` | `thorRouterCall` |
| EXP-0314 | `apps/extension/src/core/swap/thorchain.ts:165` | `readThorStatus` |
| EXP-0315 | `apps/extension/src/core/swap/thorchain.ts:173` | `thorStatus` |
| EXP-0316 | `apps/extension/src/core/swap/relay.ts:13` | `RELAY_BASE` |
| EXP-0317 | `apps/extension/src/core/swap/relay.ts:14` | `RELAY_SOLANA_CHAIN_ID` |
| EXP-0318 | `apps/extension/src/core/swap/relay.ts:21` | `relayChainId` |
| EXP-0319 | `apps/extension/src/core/swap/relay.ts:27` | `relaySupports` |
| EXP-0320 | `apps/extension/src/core/swap/relay.ts:30` | `relayQuote` |
| EXP-0321 | `apps/extension/src/core/swap/relay.ts:47` | `decodeApprove` |
| EXP-0322 | `apps/extension/src/core/swap/relay.ts:54` | `mapRelayRoute` |
| EXP-0323 | `apps/extension/src/core/swap/relay.ts:84` | `relayRoutes` |
| EXP-0324 | `apps/extension/src/core/swap/relay.ts:96` | `relayTransactions` |
| EXP-0325 | `apps/extension/src/core/swap/relay.ts:139` | `relayTargets` |
| EXP-0326 | `apps/extension/src/core/swap/relay.ts:155` | `relayStatus` |
| EXP-0327 | `apps/extension/src/core/swap/engine.ts:13` | `validateRouteRequest` |
| EXP-0328 | `apps/extension/src/core/swap/engine.ts:24` | `sortRoutes` |
| EXP-0329 | `apps/extension/src/core/swap/engine.ts:33` | `eligibleProviders` |
| EXP-0330 | `apps/extension/src/core/swap/engine.ts:51` | `getSwapRoutes` |
| EXP-0331 | `apps/extension/src/core/swap/jupiter.ts:12` | `JUP_BASE` |
| EXP-0332 | `apps/extension/src/core/swap/jupiter.ts:13` | `WSOL_MINT` |
| EXP-0333 | `apps/extension/src/core/swap/jupiter.ts:15` | `jupMint` |
| EXP-0334 | `apps/extension/src/core/swap/jupiter.ts:18` | `SOLANA_PRIORITY` |
| EXP-0335 | `apps/extension/src/core/swap/jupiter.ts:35` | `mapJupiterRoute` |
| EXP-0336 | `apps/extension/src/core/swap/jupiter.ts:57` | `jupiterRoutes` |
| EXP-0337 | `apps/extension/src/core/swap/jupiter.ts:65` | `jupiterSwapTransaction` |
| EXP-0338 | `apps/extension/src/core/swap/types.ts:108` | `DEFAULT_SWAP_SETTINGS` |
| EXP-0339 | `apps/extension/src/core/swap/tokens.ts:7` | `assetId` |
| EXP-0340 | `apps/extension/src/core/swap/tokens.ts:12` | `logoFor` |
| EXP-0341 | `apps/extension/src/core/swap/tokens.ts:17` | `nativeAsset` |
| EXP-0342 | `apps/extension/src/core/swap/tokens.ts:21` | `makeToken` |
| EXP-0343 | `apps/extension/src/core/swap/tokens.ts:63` | `popularAssets` |
| EXP-0344 | `apps/extension/src/core/swap/tokens.ts:69` | `knownLogoSymbol` |
| EXP-0345 | `apps/extension/src/core/swap/tokens.ts:74` | `defaultPair` |
| EXP-0346 | `apps/extension/src/core/swap/tokens.ts:78` | `sameAsset` |
| EXP-0347 | `apps/extension/src/core/swap/rules.ts:2` | `SLIPPAGE_PRESETS` |
| EXP-0348 | `apps/extension/src/core/swap/rules.ts:3` | `SLIPPAGE_MAX` |
| EXP-0349 | `apps/extension/src/core/swap/rules.ts:4` | `SLIPPAGE_STEP` |
| EXP-0350 | `apps/extension/src/core/swap/rules.ts:5` | `HIGH_SLIPPAGE_ABOVE` |
| EXP-0351 | `apps/extension/src/core/swap/rules.ts:6` | `DEFAULT_SLIPPAGE` |
| EXP-0352 | `apps/extension/src/core/swap/rules.ts:7` | `QUOTE_REFRESH_SECONDS` |
| EXP-0353 | `apps/extension/src/core/swap/rules.ts:8` | `SWAP_WATCH_TIMEOUT_MS` |
| EXP-0354 | `apps/extension/src/core/swap/rules.ts:12` | `priceImpactSeverity` |
| EXP-0355 | `apps/extension/src/core/swap/rules.ts:18` | `stepSlippage` |
| EXP-0356 | `apps/extension/src/core/swap/rules.ts:23` | `normalizeSlippage` |
| EXP-0357 | `apps/extension/src/core/swap/rules.ts:28` | `acceptSlippageInput` |
| EXP-0358 | `apps/extension/src/core/swap/rules.ts:33` | `isHighSlippage` |
| EXP-0359 | `apps/extension/src/core/swap/rules.ts:35` | `effectiveSlippage` |
| EXP-0360 | `apps/extension/src/core/swap/rules.ts:37` | `pollDelayMs` |
| EXP-0361 | `apps/extension/src/core/swap/rules.ts:48` | `resolveCta` |
| EXP-0362 | `apps/extension/src/core/swap/domains.ts:4` | `SOLANA_LIFI_CHAIN_ID` |
| EXP-0363 | `apps/extension/src/core/swap/domains.ts:5` | `SWAP_DOMAINS` |
| EXP-0364 | `apps/extension/src/core/swap/domains.ts:14` | `domainById` |
| EXP-0365 | `apps/extension/src/core/swap/domains.ts:15` | `domainByLifiId` |
| EXP-0366 | `apps/extension/src/core/swap/dust.ts:4` | `DUST_DEFAULT_USD` |
| EXP-0367 | `apps/extension/src/core/swap/dust.ts:5` | `DUST_MAX_ITEMS` |
| EXP-0368 | `apps/extension/src/core/swap/dust.ts:9` | `pickDust` |
| EXP-0369 | `apps/extension/src/core/swap/amount.ts:3` | `toAtomic` |
| EXP-0370 | `apps/extension/src/core/swap/amount.ts:9` | `fromAtomic` |
| EXP-0371 | `apps/extension/src/core/swap/amount.ts:13` | `fmtToken` |
| EXP-0372 | `apps/extension/src/core/swap/amount.ts:19` | `fmtUsd` |
| EXP-0373 | `apps/extension/src/core/swap/amount.ts:25` | `rateOf` |
| EXP-0374 | `apps/extension/src/core/swap/lifi.ts:14` | `LIFI_BASE` |
| EXP-0375 | `apps/extension/src/core/swap/lifi.ts:15` | `EVM_NATIVE` |
| EXP-0376 | `apps/extension/src/core/swap/lifi.ts:16` | `SOL_NATIVE` |
| EXP-0377 | `apps/extension/src/core/swap/lifi.ts:24` | `lifiAddress` |
| EXP-0378 | `apps/extension/src/core/swap/lifi.ts:29` | `toAsset` |
| EXP-0379 | `apps/extension/src/core/swap/lifi.ts:53` | `mapLifiStep` |
| EXP-0380 | `apps/extension/src/core/swap/lifi.ts:78` | `mapLifiRoute` |
| EXP-0381 | `apps/extension/src/core/swap/lifi.ts:103` | `lifiRoutes` |
| EXP-0382 | `apps/extension/src/core/swap/lifi.ts:120` | `lifiStepTransaction` |
| EXP-0383 | `apps/extension/src/core/swap/lifi.ts:125` | `lifiStatus` |
| EXP-0384 | `apps/extension/src/core/swap/lifi.ts:133` | `lifiToken` |
| EXP-0385 | `apps/extension/src/core/provider/siws.ts:4` | `createSiwsMessage` |
| EXP-0386 | `apps/extension/src/core/provider/siws.ts:14` | `parseSiws` |
| EXP-0387 | `apps/extension/src/core/provider/siws.ts:24` | `siwsIssues` |
| EXP-0388 | `apps/extension/src/core/provider/decode.ts:4` | `MAX_UINT256` |
| EXP-0389 | `apps/extension/src/core/provider/decode.ts:6` | `isUnlimited` |
| EXP-0390 | `apps/extension/src/core/provider/decode.ts:30` | `decodeCalldata` |
| EXP-0391 | `apps/extension/src/core/provider/decode.ts:64` | `SEL` |
| EXP-0392 | `apps/extension/src/core/provider/decode.ts:65` | `decodeString` |
| EXP-0393 | `apps/extension/src/core/provider/decode.ts:68` | `encodeAllowanceCall` |
| EXP-0394 | `apps/extension/src/core/provider/decode.ts:69` | `encodeBalanceCall` |
| EXP-0395 | `apps/extension/src/core/provider/decode.ts:70` | `encodeApprove` |
| EXP-0396 | `apps/extension/src/core/provider/decode.ts:74` | `setApproveAmount` |
| EXP-0397 | `apps/extension/src/core/provider/decode.ts:82` | `flattenCalls` |
| EXP-0398 | `apps/extension/src/core/provider/origin.ts:2` | `normalizeOrigin` |
| EXP-0399 | `apps/extension/src/core/provider/origin.ts:9` | `hostnameOf` |
| EXP-0400 | `apps/extension/src/core/provider/origin.ts:10` | `isLocalOrigin` |
| EXP-0401 | `apps/extension/src/core/provider/origin.ts:12` | `isPunycodeHost` |
| EXP-0402 | `apps/extension/src/core/provider/origin.ts:14` | `isInsecureOrigin` |
| EXP-0403 | `apps/extension/src/core/provider/origin.ts:15` | `displayHost` |
| EXP-0404 | `apps/extension/src/core/provider/origin.ts:17` | `BLOCKED_DOMAINS` |
| EXP-0405 | `apps/extension/src/core/provider/origin.ts:18` | `isBlockedDomain` |
| EXP-0406 | `apps/extension/src/core/provider/origin.ts:21` | `isPrivateNetworkUrl` |
| EXP-0407 | `apps/extension/src/core/provider/origin.ts:33` | `WC_SUFFIX` |
| EXP-0408 | `apps/extension/src/core/provider/origin.ts:34` | `isWcKey` |
| EXP-0409 | `apps/extension/src/core/provider/origin.ts:35` | `wcKey` |
| EXP-0410 | `apps/extension/src/core/provider/origin.ts:36` | `baseOrigin` |
| EXP-0411 | `apps/extension/src/core/provider/evmSign.ts:9` | `evmSignMessage` |
| EXP-0412 | `apps/extension/src/core/provider/evmSign.ts:14` | `evmRecover` |
| EXP-0413 | `apps/extension/src/core/provider/evmSign.ts:15` | `personalMessageHash` |
| EXP-0414 | `apps/extension/src/core/provider/evmSign.ts:16` | `sha3` |
| EXP-0415 | `apps/extension/src/core/provider/evmSign.ts:19` | `evmSignTypedData` |
| EXP-0416 | `apps/extension/src/core/provider/evmSign.ts:23` | `typedDataDigest` |
| EXP-0417 | `apps/extension/src/core/provider/evmSign.ts:28` | `evmSendTransaction` |
| EXP-0418 | `apps/extension/src/core/provider/errors.ts:2` | `ERR` |
| EXP-0419 | `apps/extension/src/core/provider/errors.ts:24` | `ProviderError extends Error {` |
| EXP-0420 | `apps/extension/src/core/provider/errors.ts:28` | `providerError` |
| EXP-0421 | `apps/extension/src/core/provider/errors.ts:33` | `serializeError` |
| EXP-0422 | `apps/extension/src/core/provider/base58.ts:4` | `b58encode` |
| EXP-0423 | `apps/extension/src/core/provider/base58.ts:16` | `b58decode` |
| EXP-0424 | `apps/extension/src/core/provider/base58.ts:30` | `isSolanaAddress` |
| EXP-0425 | `apps/extension/src/core/provider/base58.ts:33` | `bytesToB64` |
| EXP-0426 | `apps/extension/src/core/provider/base58.ts:34` | `b64ToBytes` |
| EXP-0427 | `apps/extension/src/core/provider/phishing.ts:6` | `PHISHING_URL` |
| EXP-0428 | `apps/extension/src/core/provider/phishing.ts:9` | `SCAMSNIFFER_DOMAINS` |
| EXP-0429 | `apps/extension/src/core/provider/phishing.ts:10` | `SCAMSNIFFER_ADDRESSES` |
| EXP-0430 | `apps/extension/src/core/provider/phishing.ts:13` | `parseList` |
| EXP-0431 | `apps/extension/src/core/provider/phishing.ts:24` | `addressRisk` |
| EXP-0432 | `apps/extension/src/core/provider/phishing.ts:38` | `parsePhishingConfig` |
| EXP-0433 | `apps/extension/src/core/provider/phishing.ts:44` | `checkHost` |
| EXP-0434 | `apps/extension/src/core/provider/phishing.ts:55` | `resetPhishingCache` |
| EXP-0435 | `apps/extension/src/core/provider/phishing.ts:57` | `MAX_CACHE_CHARS` |
| EXP-0436 | `apps/extension/src/core/provider/phishing.ts:59` | `addAll` |
| EXP-0437 | `apps/extension/src/core/provider/phishing.ts:60` | `siteRisk` |
| EXP-0438 | `apps/extension/src/core/provider/psbt.ts:35` | `parseTx` |
| EXP-0439 | `apps/extension/src/core/provider/psbt.ts:42` | `decodePsbt` |
| EXP-0440 | `apps/extension/src/core/provider/psbt.ts:49` | `encodePsbt` |
| EXP-0441 | `apps/extension/src/core/provider/psbt.ts:52` | `inputUtxo` |
| EXP-0442 | `apps/extension/src/core/provider/psbt.ts:55` | `p2wpkhScript` |
| EXP-0443 | `apps/extension/src/core/provider/psbt.ts:58` | `bip143Digest` |
| EXP-0444 | `apps/extension/src/core/provider/psbt.ts:66` | `derSig` |
| EXP-0445 | `apps/extension/src/core/provider/psbt.ts:72` | `MAX_FEE_SATS` |
| EXP-0446 | `apps/extension/src/core/provider/psbt.ts:74` | `psbtFee` |
| EXP-0447 | `apps/extension/src/core/provider/psbt.ts:80` | `planPsbtSigning` |
| EXP-0448 | `apps/extension/src/core/provider/psbt.ts:100` | `applySignatures` |
| EXP-0449 | `apps/extension/src/core/provider/psbt.ts:113` | `segwitAddress` |
| EXP-0450 | `apps/extension/src/core/provider/psbt.ts:120` | `scriptToAddress` |
| EXP-0451 | `apps/extension/src/core/provider/psbt.ts:128` | `describePsbt` |
| EXP-0452 | `apps/extension/src/core/provider/psbt.ts:134` | `psbtToB64` |
| EXP-0453 | `apps/extension/src/core/provider/multiChains.ts:3` | `MULTI_CHAINS` |
| EXP-0454 | `apps/extension/src/core/provider/multiChains.ts:12` | `isMultiChain` |
| EXP-0455 | `apps/extension/src/core/provider/multiChains.ts:14` | `chainOfCosmosId` |
| EXP-0456 | `apps/extension/src/core/provider/siwe.ts:3` | `parseSiwe` |
| EXP-0457 | `apps/extension/src/core/provider/siwe.ts:13` | `siweIssues` |
| EXP-0458 | `apps/extension/src/core/provider/solSim.ts:9` | `TOKEN_PROGRAMS` |
| EXP-0459 | `apps/extension/src/core/provider/solSim.ts:22` | `decodeSplAccount` |
| EXP-0460 | `apps/extension/src/core/provider/solSim.ts:29` | `writableKeys` |
| EXP-0461 | `apps/extension/src/core/provider/solSim.ts:41` | `tokenDiff` |
| EXP-0462 | `apps/extension/src/core/provider/solSim.ts:57` | `simulateSolTx` |
| EXP-0463 | `apps/extension/src/core/provider/solSim.ts:94` | `solAccountData` |
| EXP-0464 | `apps/extension/src/core/provider/evmAccount.ts:8` | `signHash` |
| EXP-0465 | `apps/extension/src/core/provider/evmAccount.ts:15` | `evmAccountFromBytes` |
| EXP-0466 | `apps/extension/src/core/provider/evmAccount.ts:33` | `zero` |
| EXP-0467 | `apps/extension/src/core/provider/ratelimit.ts:3` | `RateLimiter {` |
| EXP-0468 | `apps/extension/src/core/provider/simulate.ts:5` | `NATIVE_PSEUDO` |
| EXP-0469 | `apps/extension/src/core/provider/simulate.ts:10` | `assetChangesFrom` |
| EXP-0470 | `apps/extension/src/core/provider/simulate.ts:26` | `simulateParams` |
| EXP-0471 | `apps/extension/src/core/provider/simulate.ts:30` | `readSimulation` |
| EXP-0472 | `apps/extension/src/core/provider/multi.ts:30` | `aminoSignBytes` |
| EXP-0473 | `apps/extension/src/core/provider/multi.ts:33` | `directSignBytes` |
| EXP-0474 | `apps/extension/src/core/provider/multi.ts:43` | `cosmosBodyTypes` |
| EXP-0475 | `apps/extension/src/core/provider/multi.ts:48` | `aptosFullMessage` |
| EXP-0476 | `apps/extension/src/core/provider/multi.ts:61` | `describeTron` |
| EXP-0477 | `apps/extension/src/core/provider/multi.ts:80` | `normalizeMultiSign` |
| EXP-0478 | `apps/extension/src/core/provider/multi.ts:147` | `signPlan` |
| EXP-0479 | `apps/extension/src/core/provider/protocol.ts:6` | `NAMESPACES: readonly Namespace[]` |
| EXP-0480 | `apps/extension/src/core/provider/protocol.ts:26` | `EVENT_ALLOWLIST` |
| EXP-0481 | `apps/extension/src/core/provider/protocol.ts:32` | `MAX_ID_LEN` |
| EXP-0482 | `apps/extension/src/core/provider/protocol.ts:33` | `MAX_METHOD_LEN` |
| EXP-0483 | `apps/extension/src/core/provider/protocol.ts:34` | `MAX_PARAMS_BYTES` |
| EXP-0484 | `apps/extension/src/core/provider/protocol.ts:52` | `parsePageRequest` |
| EXP-0485 | `apps/extension/src/core/provider/protocol.ts:70` | `isAllowedEvent` |
| EXP-0486 | `apps/extension/src/core/provider/protocol.ts:78` | `senderKey` |
| EXP-0487 | `apps/extension/src/core/provider/methods.ts:14` | `EVM_METHODS` |
| EXP-0488 | `apps/extension/src/core/provider/methods.ts:45` | `SOLANA_METHODS` |
| EXP-0489 | `apps/extension/src/core/provider/methods.ts:53` | `MULTI_METHODS` |
| EXP-0490 | `apps/extension/src/core/provider/methods.ts:65` | `UNSUPPORTED_EVM` |
| EXP-0491 | `apps/extension/src/core/provider/methods.ts:67` | `specFor` |
| EXP-0492 | `apps/extension/src/core/provider/methods.ts:72` | `isBridgeNamespaced` |
| EXP-0493 | `apps/extension/src/core/provider/methods.ts:76` | `isHexAddress` |
| EXP-0494 | `apps/extension/src/core/provider/methods.ts:77` | `isHexData` |
| EXP-0495 | `apps/extension/src/core/provider/methods.ts:78` | `isHexQuantity` |
| EXP-0496 | `apps/extension/src/core/provider/methods.ts:79` | `sameAddress` |
| EXP-0497 | `apps/extension/src/core/provider/methods.ts:80` | `hexToBytes` |
| EXP-0498 | `apps/extension/src/core/provider/methods.ts:81` | `bytesToHex` |
| EXP-0499 | `apps/extension/src/core/provider/methods.ts:82` | `tryUtf8` |
| EXP-0500 | `apps/extension/src/core/provider/methods.ts:84` | `toHexQuantity` |
| EXP-0501 | `apps/extension/src/core/provider/methods.ts:86` | `MAX_MESSAGE_BYTES` |
| EXP-0502 | `apps/extension/src/core/provider/methods.ts:90` | `normalizePersonalSign` |
| EXP-0503 | `apps/extension/src/core/provider/methods.ts:102` | `normalizeEthSign` |
| EXP-0504 | `apps/extension/src/core/provider/methods.ts:116` | `normalizeTypedData` |
| EXP-0505 | `apps/extension/src/core/provider/methods.ts:145` | `normalizeSendTx` |
| EXP-0506 | `apps/extension/src/core/provider/methods.ts:176` | `parseChainIdHex` |
| EXP-0507 | `apps/extension/src/core/provider/methods.ts:180` | `normalizeSwitchChain` |
| EXP-0508 | `apps/extension/src/core/provider/methods.ts:186` | `normalizeAddChain` |
| EXP-0509 | `apps/extension/src/core/provider/methods.ts:199` | `normalizeWatchAsset` |
| EXP-0510 | `apps/extension/src/core/provider/methods.ts:212` | `B64_RE` |
| EXP-0511 | `apps/extension/src/core/provider/methods.ts:214` | `normalizeSolMessage` |
| EXP-0512 | `apps/extension/src/core/provider/methods.ts:223` | `normalizeSolTx` |
| EXP-0513 | `apps/extension/src/core/provider/solanaTx.ts:17` | `parseSolTx` |
| EXP-0514 | `apps/extension/src/core/provider/solanaTx.ts:52` | `resolveLookupTables` |
| EXP-0515 | `apps/extension/src/core/provider/solanaTx.ts:64` | `signerSlot` |
| EXP-0516 | `apps/extension/src/core/provider/solanaTx.ts:65` | `withSignature` |
| EXP-0517 | `apps/extension/src/core/provider/solanaTx.ts:69` | `PROGRAMS` |
| EXP-0518 | `apps/extension/src/core/provider/solanaTx.ts:80` | `describeSolInstruction` |
| EXP-0519 | `apps/extension/src/core/provider/solanaTx.ts:111` | `describeSolTx` |
| EXP-0520 | `apps/extension/src/core/provider/solanaTx.ts:118` | `looksLikeSolMessage` |
| EXP-0521 | `apps/extension/src/core/provider/solanaTx.ts:127` | `SWAP_BASE_PROGRAMS` |
| EXP-0522 | `apps/extension/src/core/provider/solanaTx.ts:133` | `guardSolSwapTx` |
| EXP-0523 | `apps/extension/src/core/provider/typed.ts:29` | `summarizeTypedData` |
| EXP-0524 | `apps/extension/src/core/provider/store.ts:7` | `PKEYS` |
| EXP-0525 | `apps/extension/src/core/provider/store.ts:29` | `DEFAULT_PREFS` |
| EXP-0526 | `apps/extension/src/core/provider/store.ts:35` | `PermissionStore {` |
| EXP-0527 | `apps/extension/src/core/provider/store.ts:125` | `PENDING_TTL_MS` |
| EXP-0528 | `apps/extension/src/core/provider/store.ts:127` | `PendingStore {` |
| EXP-0529 | `apps/extension/src/core/provider/displayText.ts:17` | `hasHiddenChars` |
| EXP-0530 | `apps/extension/src/core/provider/displayText.ts:20` | `visibleText` |
| EXP-0531 | `apps/extension/src/core/provider/displayText.ts:25` | `plainLabel` |
| EXP-0532 | `apps/extension/src/core/provider/displayText.ts:30` | `visibleDeep<T>` |
| EXP-0533 | `apps/extension/src/core/networkRegistry.ts:8` | `setNetworkState` |
| EXP-0534 | `apps/extension/src/core/networkRegistry.ts:20` | `getNetworkState` |
| EXP-0535 | `apps/extension/src/core/networkRegistry.ts:21` | `customNetworks` |
| EXP-0536 | `apps/extension/src/core/networkRegistry.ts:22` | `customNetwork` |
| EXP-0537 | `apps/extension/src/core/networkRegistry.ts:23` | `rpcOverride` |
| EXP-0538 | `apps/extension/src/core/networkRegistry.ts:24` | `customExplorer` |
| EXP-0539 | `apps/extension/src/core/rpc.ts:9` | `configRpcs` |
| EXP-0540 | `apps/extension/src/core/rpc.ts:15` | `GATEWAY_EVM_CHAINS` |
| EXP-0541 | `apps/extension/src/core/rpc.ts:16` | `gatewayRpc` |
| EXP-0542 | `apps/extension/src/core/rpc.ts:17` | `rpcUrl` |
| EXP-0543 | `apps/extension/src/core/rpc.ts:22` | `rpcUrlList` |
| EXP-0544 | `apps/extension/src/core/rpc.ts:33` | `solanaRpcUrls` |
| EXP-0545 | `apps/extension/src/core/rpc.ts:39` | `solanaRpcUrl` |
| EXP-0546 | `apps/extension/src/core/rpc.ts:44` | `protectedRpcUrl` |
| EXP-0547 | `apps/extension/src/core/gasFees.ts:15` | `TRANSFER_GAS` |
| EXP-0548 | `apps/extension/src/core/gasFees.ts:22` | `buildQuote` |
| EXP-0549 | `apps/extension/src/core/gasFees.ts:40` | `fetchGasQuote` |
| EXP-0550 | `apps/extension/src/core/gasFees.ts:53` | `gwei` |
| EXP-0551 | `apps/extension/src/core/networks.ts:9` | `BUILTIN_EVM` |
| EXP-0552 | `apps/extension/src/core/networks.ts:10` | `isBuiltinChain` |
| EXP-0553 | `apps/extension/src/core/networks.ts:14` | `normalizeUrl` |
| EXP-0554 | `apps/extension/src/core/networks.ts:26` | `validateNetwork` |
| EXP-0555 | `apps/extension/src/core/networks.ts:44` | `probeRpcChainId` |
| EXP-0556 | `apps/extension/src/core/networks.ts:56` | `checkNetwork` |
| EXP-0557 | `apps/extension/src/core/networks.ts:63` | `emptyState` |
| EXP-0558 | `apps/extension/src/core/seedWords.ts:11` | `assessTypedPhrase` |
| EXP-0559 | `apps/extension/src/core/seedWords.ts:29` | `prefixSet` |
| EXP-0560 | `apps/extension/src/core/assetLogos.ts:15` | `tokenLogoPath` |
| EXP-0561 | `apps/extension/src/core/assetLogos.ts:20` | `validatorLogoPath` |
| EXP-0562 | `apps/extension/src/core/assetLogos.ts:25` | `dappLogoPath` |
| EXP-0563 | `apps/extension/src/core/harbour/schema.ts:27` | `checkPortfolio` |
| EXP-0564 | `apps/extension/src/core/harbour/schema.ts:38` | `checkHistory` |
| EXP-0565 | `apps/extension/src/core/harbour/schema.ts:49` | `checkNfts` |
| EXP-0566 | `apps/extension/src/core/harbour/schema.ts:60` | `checkAddresses` |
| EXP-0567 | `apps/extension/src/core/harbour/schema.ts:68` | `checkBroadcast` |
| EXP-0568 | `apps/extension/src/core/harbour/data.ts:13` | `refsFor` |
| EXP-0569 | `apps/extension/src/core/harbour/data.ts:20` | `SERVED_TTL_MS` |
| EXP-0570 | `apps/extension/src/core/harbour/data.ts:22` | `servedChains` |
| EXP-0571 | `apps/extension/src/core/harbour/data.ts:30` | `backendServes` |
| EXP-0572 | `apps/extension/src/core/harbour/data.ts:35` | `resetServedForTests` |
| EXP-0573 | `apps/extension/src/core/harbour/data.ts:43` | `REFUSED_RETRY_MS` |
| EXP-0574 | `apps/extension/src/core/harbour/data.ts:58` | `resetTrackingForTests` |
| EXP-0575 | `apps/extension/src/core/harbour/data.ts:60` | `ensureTracked` |
| EXP-0576 | `apps/extension/src/core/harbour/data.ts:67` | `syncTracked` |
| EXP-0577 | `apps/extension/src/core/harbour/data.ts:89` | `invalidatePortfolio` |
| EXP-0578 | `apps/extension/src/core/harbour/data.ts:91` | `portfolioGeneration` |
| EXP-0579 | `apps/extension/src/core/harbour/data.ts:92` | `portfolio` |
| EXP-0580 | `apps/extension/src/core/harbour/data.ts:114` | `nativeBalance` |
| EXP-0581 | `apps/extension/src/core/harbour/data.ts:126` | `hbTokenId` |
| EXP-0582 | `apps/extension/src/core/harbour/data.ts:128` | `tokenItems` |
| EXP-0583 | `apps/extension/src/core/harbour/data.ts:143` | `findHbToken` |
| EXP-0584 | `apps/extension/src/core/harbour/data.ts:149` | `historyItems` |
| EXP-0585 | `apps/extension/src/core/harbour/data.ts:178` | `fetchHarbourHistory` |
| EXP-0586 | `apps/extension/src/core/harbour/data.ts:187` | `nftCollections` |
| EXP-0587 | `apps/extension/src/core/harbour/data.ts:202` | `fetchHarbourNfts` |
| EXP-0588 | `apps/extension/src/core/harbour/policy.ts:17` | `SIGNING_POLICY` |
| EXP-0589 | `apps/extension/src/core/harbour/policy.ts:19` | `mainnetSigningReady` |
| EXP-0590 | `apps/extension/src/core/harbour/policy.ts:23` | `PROVIDER_FAMILIES` |
| EXP-0591 | `apps/extension/src/core/harbour/policy.ts:28` | `FEATURES` |
| EXP-0592 | `apps/extension/src/core/harbour/policy.ts:33` | `featureEnabled` |
| EXP-0593 | `apps/extension/src/core/harbour/policy.ts:36` | `DEFAULT_EVM_CHAIN: number` |
| EXP-0594 | `apps/extension/src/core/harbour/policy.ts:42` | `evmSigningBasis` |
| EXP-0595 | `apps/extension/src/core/harbour/policy.ts:53` | `isSigningEvmChain` |
| EXP-0596 | `apps/extension/src/core/harbour/policy.ts:55` | `isSigningChain` |
| EXP-0597 | `apps/extension/src/core/harbour/policy.ts:61` | `smartAccountsAvailable` |
| EXP-0598 | `apps/extension/src/core/harbour/policy.ts:72` | `BUILD_PROVIDER_POLICY` |
| EXP-0599 | `apps/extension/src/core/harbour/policy.ts:74` | `NetworkNotEnabledError extends Error {` |
| EXP-0600 | `apps/extension/src/core/harbour/policy.ts:78` | `assertSigningEvmChain` |
| EXP-0601 | `apps/extension/src/core/harbour/policy.ts:81` | `assertSigningChain` |
| EXP-0602 | `apps/extension/src/core/harbour/policy.ts:84` | `assertFeature` |
| EXP-0603 | `apps/extension/src/core/harbour/client.ts:11` | `canonical` |
| EXP-0604 | `apps/extension/src/core/harbour/client.ts:16` | `setRawFetch` |
| EXP-0605 | `apps/extension/src/core/harbour/client.ts:26` | `signedRequest` |
| EXP-0606 | `apps/extension/src/core/harbour/client.ts:45` | `api` |
| EXP-0607 | `apps/extension/src/core/harbour/client.ts:60` | `getPortfolio` |
| EXP-0608 | `apps/extension/src/core/harbour/client.ts:61` | `getHistory` |
| EXP-0609 | `apps/extension/src/core/harbour/client.ts:63` | `getNfts` |
| EXP-0610 | `apps/extension/src/core/harbour/client.ts:65` | `getMe` |
| EXP-0611 | `apps/extension/src/core/harbour/client.ts:66` | `listAddresses` |
| EXP-0612 | `apps/extension/src/core/harbour/client.ts:67` | `putAddresses` |
| EXP-0613 | `apps/extension/src/core/harbour/client.ts:69` | `broadcastTx` |
| EXP-0614 | `apps/extension/src/core/harbour/client.ts:75` | `simulateTx` |
| EXP-0615 | `apps/extension/src/core/harbour/client.ts:76` | `realtimeToken` |
| EXP-0616 | `apps/extension/src/core/harbour/client.ts:77` | `vapidKey` |
| EXP-0617 | `apps/extension/src/core/harbour/client.ts:78` | `putPush` |
| EXP-0618 | `apps/extension/src/core/harbour/client.ts:79` | `deletePush` |
| EXP-0619 | `apps/extension/src/core/harbour/client.ts:82` | `mediaUrl` |
| EXP-0620 | `apps/extension/src/core/harbour/device.ts:13` | `b64url` |
| EXP-0621 | `apps/extension/src/core/harbour/device.ts:38` | `setDeviceStorage` |
| EXP-0622 | `apps/extension/src/core/harbour/device.ts:41` | `forgetDevice` |
| EXP-0623 | `apps/extension/src/core/harbour/device.ts:62` | `solvePow` |
| EXP-0624 | `apps/extension/src/core/harbour/device.ts:69` | `HarbourApiError extends Error {` |
| EXP-0625 | `apps/extension/src/core/harbour/device.ts:72` | `parseResponse` |
| EXP-0626 | `apps/extension/src/core/harbour/device.ts:82` | `MAX_POW_BITS` |
| EXP-0627 | `apps/extension/src/core/harbour/device.ts:90` | `deviceIdentity` |
| EXP-0628 | `apps/extension/src/core/harbour/device.ts:113` | `resetDevice` |
| EXP-0629 | `apps/extension/src/core/harbour/fetchHook.ts:13` | `setBroadcastListener` |
| EXP-0630 | `apps/extension/src/core/harbour/fetchHook.ts:15` | `sessionFor` |
| EXP-0631 | `apps/extension/src/core/harbour/fetchHook.ts:23` | `UNSERVED_RETRY_MS` |
| EXP-0632 | `apps/extension/src/core/harbour/fetchHook.ts:25` | `isUnserved` |
| EXP-0633 | `apps/extension/src/core/harbour/fetchHook.ts:26` | `markUnserved` |
| EXP-0634 | `apps/extension/src/core/harbour/fetchHook.ts:27` | `resetUnservedForTests` |
| EXP-0635 | `apps/extension/src/core/harbour/fetchHook.ts:30` | `setPublicRpcResolver` |
| EXP-0636 | `apps/extension/src/core/harbour/fetchHook.ts:42` | `harbourRpc` |
| EXP-0637 | `apps/extension/src/core/harbour/fetchHook.ts:74` | `harbourGateway` |
| EXP-0638 | `apps/extension/src/core/harbour/fetchHook.ts:87` | `makeHarbourFetch` |
| EXP-0639 | `apps/extension/src/core/harbour/fetchHook.ts:104` | `installHarbourFetch` |
| EXP-0640 | `apps/extension/src/core/harbour/config.ts:7` | `HB_API_URL: string` |
| EXP-0641 | `apps/extension/src/core/harbour/config.ts:10` | `isLoopbackUrl` |
| EXP-0642 | `apps/extension/src/core/harbour/config.ts:15` | `isSecureEndpoint` |
| EXP-0643 | `apps/extension/src/core/harbour/config.ts:18` | `HB_API_SECURE: boolean` |
| EXP-0644 | `apps/extension/src/core/harbour/config.ts:20` | `TUNNEL_HOST` |
| EXP-0645 | `apps/extension/src/core/harbour/config.ts:24` | `realtimeUrlAllowed` |
| EXP-0646 | `apps/extension/src/core/harbour/config.ts:33` | `HARBOUR_CHAINS` |
| EXP-0647 | `apps/extension/src/core/harbour/config.ts:38` | `HARBOUR_CHAIN_IDS: string[]` |
| EXP-0648 | `apps/extension/src/core/harbour/config.ts:40` | `CLIENT_CHAIN_IDS: string[]` |
| EXP-0649 | `apps/extension/src/core/harbour/config.ts:42` | `isClientChain` |
| EXP-0650 | `apps/extension/src/core/harbour/config.ts:43` | `isHarbourChain` |
| EXP-0651 | `apps/extension/src/core/harbour/config.ts:44` | `isHarbourEvm` |
| EXP-0652 | `apps/extension/src/core/harbour/config.ts:46` | `INDEXED_CHAINS` |
| EXP-0653 | `apps/extension/src/core/harbour/config.ts:47` | `isIndexedChain` |
| EXP-0654 | `apps/extension/src/core/harbour/config.ts:48` | `isIndexedEvm` |
| EXP-0655 | `apps/extension/src/core/harbour/config.ts:49` | `backendChainOf` |
| EXP-0656 | `apps/extension/src/core/harbour/config.ts:51` | `chainIdOfBackend` |
| EXP-0657 | `apps/extension/src/core/harbour/config.ts:52` | `evmIdOfBackend` |
| EXP-0658 | `apps/extension/src/core/harbour/config.ts:55` | `harbourRpcUrl` |
| EXP-0659 | `apps/extension/src/core/passworder.ts:24` | `encrypt` |
| EXP-0660 | `apps/extension/src/core/passworder.ts:32` | `decrypt<T` |
| EXP-0661 | `apps/extension/src/core/evmCode.ts:7` | `delegationTarget` |
| EXP-0662 | `apps/extension/src/core/evmCode.ts:13` | `codeKind` |
| EXP-0663 | `apps/extension/src/core/evmCode.ts:22` | `isContractCode` |
| EXP-0664 | `apps/extension/src/core/evmCode.ts:24` | `isWalletCode` |
| EXP-0665 | `apps/extension/src/core/logger.ts:12` | `redact` |
| EXP-0666 | `apps/extension/src/core/logger.ts:29` | `logError` |
| EXP-0667 | `apps/extension/src/core/logger.ts:33` | `logWarn` |
| EXP-0668 | `apps/extension/src/core/walletconnect/index.ts:11` | `SOLANA_MAINNET_CAIP` |
| EXP-0669 | `apps/extension/src/core/walletconnect/index.ts:12` | `EVM_METHODS_SUPPORTED` |
| EXP-0670 | `apps/extension/src/core/walletconnect/index.ts:13` | `SOLANA_METHODS_SUPPORTED` |
| EXP-0671 | `apps/extension/src/core/walletconnect/index.ts:14` | `EVENTS_SUPPORTED` |
| EXP-0672 | `apps/extension/src/core/walletconnect/index.ts:16` | `WC_ERR` |
| EXP-0673 | `apps/extension/src/core/walletconnect/index.ts:21` | `parseWcUri` |
| EXP-0674 | `apps/extension/src/core/walletconnect/index.ts:43` | `evmCaip` |
| EXP-0675 | `apps/extension/src/core/walletconnect/index.ts:44` | `parseEvmCaip` |
| EXP-0676 | `apps/extension/src/core/walletconnect/index.ts:47` | `supportedNamespaces` |
| EXP-0677 | `apps/extension/src/core/walletconnect/index.ts:61` | `summarizeProposal` |
| EXP-0678 | `apps/extension/src/core/walletconnect/index.ts:72` | `negotiate` |
| EXP-0679 | `apps/extension/src/core/walletconnect/index.ts:104` | `mapRequest` |
| EXP-0680 | `apps/extension/src/core/walletconnect/index.ts:125` | `mapResult` |
| EXP-0681 | `apps/extension/src/core/walletconnect/index.ts:132` | `originOfMetadata` |
| EXP-0682 | `apps/extension/src/core/walletconnect/index.ts:133` | `sanitizeText` |
| EXP-0683 | `apps/extension/src/core/passkey.ts:14` | `toHex` |
| EXP-0684 | `apps/extension/src/core/passkey.ts:15` | `fromHex` |
| EXP-0685 | `apps/extension/src/core/passkey.ts:19` | `b64url` |
| EXP-0686 | `apps/extension/src/core/passkey.ts:20` | `SECRET_HEX` |
| EXP-0687 | `apps/extension/src/core/passkey.ts:22` | `BiometricsError extends Error { constructor` |
| EXP-0688 | `apps/extension/src/core/passkey.ts:25` | `isUserCancel` |
| EXP-0689 | `apps/extension/src/core/passkey.ts:35` | `PRF_SALT` |
| EXP-0690 | `apps/extension/src/core/passkey.ts:36` | `PRF_SCHEME` |
| EXP-0691 | `apps/extension/src/core/passkey.ts:45` | `Biometrics {` |
| EXP-0692 | `apps/extension/src/core/passkey.ts:104` | `detectPlatform` |
| EXP-0693 | `apps/extension/src/core/passkey.ts:108` | `BIOMETRIC_NAME` |
| EXP-0694 | `apps/extension/src/core/passkey.ts:109` | `biometricAvailability` |
| EXP-0695 | `apps/extension/src/core/sendService.ts:15` | `validRecipient` |
| EXP-0696 | `apps/extension/src/core/sendService.ts:17` | `estimateSend` |
| EXP-0697 | `apps/extension/src/core/sendService.ts:54` | `buildTransfer` |
| EXP-0698 | `apps/extension/src/core/sendService.ts:82` | `SENT_TX_KEY` |
| EXP-0699 | `apps/extension/src/core/sendService.ts:83` | `upsertSent` |
| EXP-0700 | `apps/extension/src/core/sendService.ts:87` | `readSent` |
| EXP-0701 | `apps/extension/src/core/sendService.ts:91` | `assessRecipient` |
| EXP-0702 | `apps/extension/src/core/sendService.ts:99` | `lookalikeOf` |
| EXP-0703 | `apps/extension/src/core/sendService.ts:105` | `planHashOf` |
| EXP-0704 | `apps/extension/src/core/sendService.ts:112` | `nameService` |
| EXP-0705 | `apps/extension/src/core/sendService.ts:122` | `resolveEns` |
| EXP-0706 | `apps/extension/src/core/sendService.ts:137` | `resolveSns` |
| EXP-0707 | `apps/extension/src/core/sendService.ts:148` | `customChainInfo` |
| EXP-0708 | `apps/extension/src/core/sendService.ts:152` | `resolveSendChain` |
| EXP-0709 | `apps/extension/src/core/sendService.ts:158` | `sanitizeTokenSpec` |
| EXP-0710 | `apps/extension/src/core/sendService.ts:169` | `parsePaymentUri` |
| EXP-0711 | `apps/extension/src/core/sendService.ts:183` | `receiveNote` |
| EXP-0712 | `apps/extension/src/core/sendService.ts:196` | `btcOutputsOf` |
| EXP-0713 | `apps/extension/src/core/balanceService.ts:11` | `nativeSymbol` |
| EXP-0714 | `apps/extension/src/core/balanceService.ts:12` | `NATIVE_SYMBOL` |
| EXP-0715 | `apps/extension/src/core/balanceService.ts:14` | `fetchNativeBalance` |
| EXP-0716 | `apps/extension/src/core/balanceService.ts:28` | `fetchEvmBalances` |
| EXP-0717 | `apps/extension/src/core/uiSafe.ts:8` | `findSecretField` |
| EXP-0718 | `apps/extension/src/core/uiSafe.ts:19` | `uiSafe<T>` |
| EXP-0719 | `apps/extension/src/core/vaultService.ts:11` | `VaultService {` |
| EXP-0720 | `apps/extension/src/core/ramps/cex.ts:10` | `CEX_PROVIDERS` |
| EXP-0721 | `apps/extension/src/core/ramps/cex.ts:14` | `cexProvider` |
| EXP-0722 | `apps/extension/src/core/ramps/cex.ts:32` | `parseCoinbaseCurrencies` |
| EXP-0723 | `apps/extension/src/core/ramps/cex.ts:47` | `parseBinanceNetworks` |
| EXP-0724 | `apps/extension/src/core/ramps/cex.ts:61` | `registryCexAssets` |
| EXP-0725 | `apps/extension/src/core/ramps/cex.ts:69` | `fetchCexAssets` |
| EXP-0726 | `apps/extension/src/core/ramps/cex.ts:89` | `cexDepositInfo` |
| EXP-0727 | `apps/extension/src/core/ramps/pA.ts:9` | `transak` |
| EXP-0728 | `apps/extension/src/core/ramps/pA.ts:47` | `ramp` |
| EXP-0729 | `apps/extension/src/core/ramps/fiat.ts:12` | `RAMP_FIATS` |
| EXP-0730 | `apps/extension/src/core/ramps/fiat.ts:18` | `fiatInfo` |
| EXP-0731 | `apps/extension/src/core/ramps/fiat.ts:19` | `isRampFiat` |
| EXP-0732 | `apps/extension/src/core/ramps/quotes.ts:11` | `getRampQuotes` |
| EXP-0733 | `apps/extension/src/core/ramps/quotes.ts:51` | `groupByCategory` |
| EXP-0734 | `apps/extension/src/core/ramps/quotes.ts:60` | `fetchMarketReference` |
| EXP-0735 | `apps/extension/src/core/ramps/guard.ts:8` | `parseAmount` |
| EXP-0736 | `apps/extension/src/core/ramps/guard.ts:20` | `isPlausibleAddress` |
| EXP-0737 | `apps/extension/src/core/ramps/guard.ts:35` | `buildSafeUrl` |
| EXP-0738 | `apps/extension/src/core/ramps/guard.ts:49` | `enforceTrustedAddress` |
| EXP-0739 | `apps/extension/src/core/ramps/guard.ts:59` | `assertOpenable` |
| EXP-0740 | `apps/extension/src/core/ramps/guard.ts:66` | `safeHttpsLink` |
| EXP-0741 | `apps/extension/src/core/ramps/assets.ts:6` | `RAMP_TOKENS` |
| EXP-0742 | `apps/extension/src/core/ramps/assets.ts:11` | `tokenAssetId` |
| EXP-0743 | `apps/extension/src/core/ramps/assets.ts:13` | `buildRampAssets` |
| EXP-0744 | `apps/extension/src/core/ramps/assets.ts:26` | `rampAssetById` |
| EXP-0745 | `apps/extension/src/core/ramps/providers.ts:12` | `PROVIDERS` |
| EXP-0746 | `apps/extension/src/core/ramps/providers.ts:13` | `providerById` |
| EXP-0747 | `apps/extension/src/core/ramps/providers.ts:16` | `sanitizeKeys` |
| EXP-0748 | `apps/extension/src/core/ramps/providers.ts:29` | `keysFor` |
| EXP-0749 | `apps/extension/src/core/ramps/providers.ts:32` | `buildCheckoutUrl` |
| EXP-0750 | `apps/extension/src/core/ramps/keys.ts:6` | `RAMP_KEYS_STORAGE` |
| EXP-0751 | `apps/extension/src/core/ramps/keys.ts:9` | `normalizeKeys` |
| EXP-0752 | `apps/extension/src/core/ramps/keys.ts:18` | `setProviderKeys` |
| EXP-0753 | `apps/extension/src/core/ramps/keys.ts:28` | `maskKey` |
| EXP-0754 | `apps/extension/src/core/ramps/keys.ts:30` | `describeKeys` |
| EXP-0755 | `apps/extension/src/core/ramps/pC.ts:6` | `banxa` |
| EXP-0756 | `apps/extension/src/core/ramps/pC.ts:20` | `onramper` |
| EXP-0757 | `apps/extension/src/core/ramps/p2p.ts:6` | `P2P_ASSETS` |
| EXP-0758 | `apps/extension/src/core/ramps/p2p.ts:7` | `isP2pAsset` |
| EXP-0759 | `apps/extension/src/core/ramps/p2p.ts:8` | `buildP2pUrl` |
| EXP-0760 | `apps/extension/src/core/ramps/recurring.ts:17` | `nextOccurrence` |
| EXP-0761 | `apps/extension/src/core/ramps/recurring.ts:22` | `buildRecurringIcs` |
| EXP-0762 | `apps/extension/src/core/ramps/kit.ts:7` | `ProviderError extends Error {` |
| EXP-0763 | `apps/extension/src/core/ramps/kit.ts:24` | `KEY` |
| EXP-0764 | `apps/extension/src/core/ramps/kit.ts:27` | `PAYMENT_CATEGORIES` |
| EXP-0765 | `apps/extension/src/core/ramps/kit.ts:30` | `categoryOf` |
| EXP-0766 | `apps/extension/src/core/ramps/kit.ts:41` | `num` |
| EXP-0767 | `apps/extension/src/core/ramps/kit.ts:42` | `qid` |
| EXP-0768 | `apps/extension/src/core/ramps/kit.ts:43` | `getJson` |
| EXP-0769 | `apps/extension/src/core/ramps/kit.ts:52` | `need` |
| EXP-0770 | `apps/extension/src/core/ramps/kit.ts:56` | `toUnits` |
| EXP-0771 | `apps/extension/src/core/ramps/kit.ts:60` | `fromUnits` |
| EXP-0772 | `apps/extension/src/core/ramps/kit.ts:63` | `assetDecimals` |
| EXP-0773 | `apps/extension/src/core/ramps/kit.ts:64` | `firstRejection` |
| EXP-0774 | `apps/extension/src/core/ramps/kit.ts:70` | `TRANSAK_NET` |
| EXP-0775 | `apps/extension/src/core/ramps/kit.ts:71` | `RAMP_PREFIX` |
| EXP-0776 | `apps/extension/src/core/ramps/kit.ts:72` | `MERCURYO_NET` |
| EXP-0777 | `apps/extension/src/core/ramps/kit.ts:73` | `BANXA_NET` |
| EXP-0778 | `apps/extension/src/core/ramps/kit.ts:76` | `compositeCode` |
| EXP-0779 | `apps/extension/src/core/ramps/pB.ts:7` | `moonpay` |
| EXP-0780 | `apps/extension/src/core/ramps/pB.ts:41` | `mercuryo` |
| EXP-0781 | `apps/extension/src/core/staking/cosmos.ts:12` | `lcd<T` |
| EXP-0782 | `apps/extension/src/core/staking/cosmos.ts:20` | `decFloor` |
| EXP-0783 | `apps/extension/src/core/staking/cosmos.ts:35` | `computeBaseApr` |
| EXP-0784 | `apps/extension/src/core/staking/cosmos.ts:45` | `delegatorApr` |
| EXP-0785 | `apps/extension/src/core/staking/cosmos.ts:49` | `fetchCosmosParams` |
| EXP-0786 | `apps/extension/src/core/staking/cosmos.ts:58` | `fetchCosmosBaseApr` |
| EXP-0787 | `apps/extension/src/core/staking/cosmos.ts:72` | `mapChainValidator` |
| EXP-0788 | `apps/extension/src/core/staking/cosmos.ts:81` | `fetchBondedValidators` |
| EXP-0789 | `apps/extension/src/core/staking/cosmos.ts:85` | `validAddress` |
| EXP-0790 | `apps/extension/src/core/staking/cosmos.ts:89` | `mergeValidators` |
| EXP-0791 | `apps/extension/src/core/staking/cosmos.ts:106` | `mapCosmosPositions` |
| EXP-0792 | `apps/extension/src/core/staking/cosmos.ts:128` | `summarize` |
| EXP-0793 | `apps/extension/src/core/staking/cosmos.ts:137` | `fetchCosmosOverview` |
| EXP-0794 | `apps/extension/src/core/staking/cosmos.ts:167` | `fetchCosmosBalance` |
| EXP-0795 | `apps/extension/src/core/staking/cosmos.ts:179` | `cosmosGas` |
| EXP-0796 | `apps/extension/src/core/staking/cosmos.ts:183` | `cosmosFee` |
| EXP-0797 | `apps/extension/src/core/staking/cosmos.ts:200` | `buildCosmosMessages` |
| EXP-0798 | `apps/extension/src/core/staking/cosmos.ts:223` | `buildCosmosSigningInput` |
| EXP-0799 | `apps/extension/src/core/staking/cosmos.ts:232` | `signCosmos` |
| EXP-0800 | `apps/extension/src/core/staking/cosmos.ts:242` | `parseCosmosAccount` |
| EXP-0801 | `apps/extension/src/core/staking/cosmos.ts:248` | `fetchCosmosSigningContext` |
| EXP-0802 | `apps/extension/src/core/staking/cosmos.ts:257` | `broadcastCosmos` |
| EXP-0803 | `apps/extension/src/core/staking/polkadot.ts:10` | `POOL_ENDPOINTS` |
| EXP-0804 | `apps/extension/src/core/staking/polkadot.ts:11` | `DOT_UNBOND_DAYS` |
| EXP-0805 | `apps/extension/src/core/staking/polkadot.ts:16` | `poolsApi` |
| EXP-0806 | `apps/extension/src/core/staking/polkadot.ts:37` | `poolMember` |
| EXP-0807 | `apps/extension/src/core/staking/polkadot.ts:46` | `fetchPolkadotOverview` |
| EXP-0808 | `apps/extension/src/core/staking/polkadot.ts:84` | `polkadotCall` |
| EXP-0809 | `apps/extension/src/core/staking/polkadot.ts:117` | `ed25519Signer` |
| EXP-0810 | `apps/extension/src/core/staking/polkadot.ts:128` | `polkadotFee` |
| EXP-0811 | `apps/extension/src/core/staking/polkadot.ts:131` | `polkadotSubmit` |
| EXP-0812 | `apps/extension/src/core/staking/tron.ts:11` | `TRON_UNFREEZE_DAYS` |
| EXP-0813 | `apps/extension/src/core/staking/tron.ts:13` | `tronPost` |
| EXP-0814 | `apps/extension/src/core/staking/tron.ts:26` | `parseTronAccount` |
| EXP-0815 | `apps/extension/src/core/staking/tron.ts:33` | `fetchTronState` |
| EXP-0816 | `apps/extension/src/core/staking/tron.ts:41` | `fetchTronOverview` |
| EXP-0817 | `apps/extension/src/core/staking/tron.ts:68` | `tronContracts` |
| EXP-0818 | `apps/extension/src/core/staking/tron.ts:103` | `signTronContract` |
| EXP-0819 | `apps/extension/src/core/staking/tron.ts:113` | `broadcastTron` |
| EXP-0820 | `apps/extension/src/core/staking/tezos.ts:10` | `TZKT` |
| EXP-0821 | `apps/extension/src/core/staking/tezos.ts:21` | `isTezosBaker` |
| EXP-0822 | `apps/extension/src/core/staking/tezos.ts:24` | `topBakers` |
| EXP-0823 | `apps/extension/src/core/staking/tezos.ts:28` | `fetchTezosOverview` |
| EXP-0824 | `apps/extension/src/core/staking/tezos.ts:48` | `fetchTezosContext` |
| EXP-0825 | `apps/extension/src/core/staking/tezos.ts:53` | `tezosFee` |
| EXP-0826 | `apps/extension/src/core/staking/tezos.ts:56` | `tezosTarget` |
| EXP-0827 | `apps/extension/src/core/staking/tezos.ts:63` | `signTezosDelegation` |
| EXP-0828 | `apps/extension/src/core/staking/tezos.ts:77` | `injectTezos` |
| EXP-0829 | `apps/extension/src/core/staking/cardano.ts:12` | `STAKE_KEY_DEPOSIT` |
| EXP-0830 | `apps/extension/src/core/staking/cardano.ts:19` | `bech32Data` |
| EXP-0831 | `apps/extension/src/core/staking/cardano.ts:28` | `isPoolId` |
| EXP-0832 | `apps/extension/src/core/staking/cardano.ts:29` | `poolIdBytes` |
| EXP-0833 | `apps/extension/src/core/staking/cardano.ts:35` | `fetchCardanoState` |
| EXP-0834 | `apps/extension/src/core/staking/cardano.ts:46` | `fetchCardanoOverview` |
| EXP-0835 | `apps/extension/src/core/staking/cardano.ts:63` | `cardanoStakeInput` |
| EXP-0836 | `apps/extension/src/core/staking/types.ts:82` | `stakeError` |
| EXP-0837 | `apps/extension/src/core/staking/validators.ts:6` | `VALIDATORS_BASE` |
| EXP-0838 | `apps/extension/src/core/staking/validators.ts:7` | `validatorsUrl` |
| EXP-0839 | `apps/extension/src/core/staking/validators.ts:16` | `sanitizeValidators` |
| EXP-0840 | `apps/extension/src/core/staking/validators.ts:30` | `bundledValidators` |
| EXP-0841 | `apps/extension/src/core/staking/validators.ts:40` | `loadValidatorList` |
| EXP-0842 | `apps/extension/src/core/staking/validators.ts:55` | `clearValidatorCache` |
| EXP-0843 | `apps/extension/src/core/staking/solana.ts:10` | `STAKE_PROGRAM` |
| EXP-0844 | `apps/extension/src/core/staking/solana.ts:13` | `isSolAddress` |
| EXP-0845 | `apps/extension/src/core/staking/solana.ts:15` | `solRpc` |
| EXP-0846 | `apps/extension/src/core/staking/solana.ts:24` | `mapVoteAccounts` |
| EXP-0847 | `apps/extension/src/core/staking/solana.ts:30` | `solanaBaseApr` |
| EXP-0848 | `apps/extension/src/core/staking/solana.ts:35` | `solanaValidators` |
| EXP-0849 | `apps/extension/src/core/staking/solana.ts:56` | `mapStakeAccounts` |
| EXP-0850 | `apps/extension/src/core/staking/solana.ts:72` | `stakePosition` |
| EXP-0851 | `apps/extension/src/core/staking/solana.ts:86` | `summarizeSolana` |
| EXP-0852 | `apps/extension/src/core/staking/solana.ts:99` | `SUPPLY_TTL_MS` |
| EXP-0853 | `apps/extension/src/core/staking/solana.ts:102` | `resetSupplyForTests` |
| EXP-0854 | `apps/extension/src/core/staking/solana.ts:103` | `solanaTotalSupply` |
| EXP-0855 | `apps/extension/src/core/staking/solana.ts:117` | `fetchSolanaOverview` |
| EXP-0856 | `apps/extension/src/core/staking/solana.ts:139` | `buildSolanaStakeInput` |
| EXP-0857 | `apps/extension/src/core/staking/solana.ts:156` | `signSolanaStake` |
| EXP-0858 | `apps/extension/src/core/staking/solana.ts:163` | `sendSolana` |
| EXP-0859 | `apps/extension/src/core/staking/solana.ts:168` | `solanaBlockhash` |
| EXP-0860 | `apps/extension/src/core/staking/registry.ts:44` | `STAKING_ASSETS` |
| EXP-0861 | `apps/extension/src/core/staking/registry.ts:46` | `stakingAsset` |
| EXP-0862 | `apps/extension/src/core/staking/evm.ts:12` | `ethCall` |
| EXP-0863 | `apps/extension/src/core/staking/evm.ts:22` | `multicall` |
| EXP-0864 | `apps/extension/src/core/staking/evm.ts:36` | `LIDO` |
| EXP-0865 | `apps/extension/src/core/staking/evm.ts:42` | `stethAbi` |
| EXP-0866 | `apps/extension/src/core/staking/evm.ts:43` | `queueAbi` |
| EXP-0867 | `apps/extension/src/core/staking/evm.ts:52` | `lidoStakePlan` |
| EXP-0868 | `apps/extension/src/core/staking/evm.ts:57` | `lidoUnstakePlan` |
| EXP-0869 | `apps/extension/src/core/staking/evm.ts:67` | `lidoClaimPlan` |
| EXP-0870 | `apps/extension/src/core/staking/evm.ts:70` | `lidoApr` |
| EXP-0871 | `apps/extension/src/core/staking/evm.ts:77` | `lidoAllowance` |
| EXP-0872 | `apps/extension/src/core/staking/evm.ts:81` | `fetchLidoOverview` |
| EXP-0873 | `apps/extension/src/core/staking/evm.ts:118` | `ROCKET` |
| EXP-0874 | `apps/extension/src/core/staking/evm.ts:124` | `rocketStorageAbi` |
| EXP-0875 | `apps/extension/src/core/staking/evm.ts:125` | `rocketDepositAbi` |
| EXP-0876 | `apps/extension/src/core/staking/evm.ts:126` | `rethAbi` |
| EXP-0877 | `apps/extension/src/core/staking/evm.ts:127` | `rocketKey` |
| EXP-0878 | `apps/extension/src/core/staking/evm.ts:128` | `rocketDepositPool` |
| EXP-0879 | `apps/extension/src/core/staking/evm.ts:136` | `rocketApr` |
| EXP-0880 | `apps/extension/src/core/staking/evm.ts:144` | `rocketPosition` |
| EXP-0881 | `apps/extension/src/core/staking/evm.ts:148` | `rocketStakePlan` |
| EXP-0882 | `apps/extension/src/core/staking/evm.ts:156` | `rocketUnstakePlan` |
| EXP-0883 | `apps/extension/src/core/staking/evm.ts:167` | `STAKE_HUB` |
| EXP-0884 | `apps/extension/src/core/staking/evm.ts:168` | `stakeHubAbi` |
| EXP-0885 | `apps/extension/src/core/staking/evm.ts:175` | `creditAbi` |
| EXP-0886 | `apps/extension/src/core/staking/evm.ts:183` | `isEvmAddress` |
| EXP-0887 | `apps/extension/src/core/staking/evm.ts:185` | `bscPlan` |
| EXP-0888 | `apps/extension/src/core/staking/evm.ts:205` | `bscSharesFor` |
| EXP-0889 | `apps/extension/src/core/staking/evm.ts:209` | `bscCreditFor` |
| EXP-0890 | `apps/extension/src/core/staking/evm.ts:215` | `bscBalanceShares` |
| EXP-0891 | `apps/extension/src/core/staking/evm.ts:219` | `fetchBscOverview` |
| EXP-0892 | `apps/extension/src/core/staking/service.ts:27` | `loadDetails` |
| EXP-0893 | `apps/extension/src/core/staking/service.ts:45` | `toListItem` |
| EXP-0894 | `apps/extension/src/core/staking/service.ts:49` | `loadList` |
| EXP-0895 | `apps/extension/src/core/staking/service.ts:65` | `toRaw` |
| EXP-0896 | `apps/extension/src/core/coalesce.ts:4` | `coalescer<T>` |
| EXP-0897 | `apps/extension/src/core/keyMigration.ts:12` | `rekeyKeystore` |
| EXP-0898 | `apps/extension/src/core/keyMigration.ts:39` | `rekeyBlob` |
| EXP-0899 | `apps/extension/src/core/priceService.ts:17` | `fetchUsdPrices` |
| EXP-0900 | `apps/extension/src/core/priceService.ts:25` | `fetchMarket` |
| EXP-0901 | `apps/extension/src/core/priceService.ts:42` | `fetchTrending` |
| EXP-0902 | `apps/extension/src/core/priceService.ts:69` | `fetchNativePrices` |
| EXP-0903 | `apps/extension/src/core/priceService.ts:79` | `mapCgTrending` |
| EXP-0904 | `apps/extension/src/core/priceService.ts:87` | `fetchHot` |
| EXP-0905 | `apps/extension/src/core/priceService.ts:102` | `fetchTrendingNetworks` |
| EXP-0906 | `apps/extension/src/core/onboardingRules.ts:5` | `ONBOARDING_IDLE_MS` |
| EXP-0907 | `apps/extension/src/core/onboardingRules.ts:6` | `ONBOARDING_EVENT_THROTTLE_MS` |
| EXP-0908 | `apps/extension/src/core/onboardingRules.ts:7` | `QR_SCAN_INTERVAL_MS` |
| EXP-0909 | `apps/extension/src/core/onboardingRules.ts:14` | `createIdleGuard` |
| EXP-0910 | `apps/extension/src/core/onboardingRules.ts:36` | `onboardingMode` |
| EXP-0911 | `apps/extension/src/core/onboardingRules.ts:54` | `STEP_KEY` |
| EXP-0912 | `apps/extension/src/core/onboardingRules.ts:55` | `serializeStep` |
| EXP-0913 | `apps/extension/src/core/onboardingRules.ts:56` | `restoreStep` |
| EXP-0914 | `apps/extension/src/core/onboardingRules.ts:72` | `cameraErrorKind` |
| EXP-0915 | `apps/extension/src/core/onboardingRules.ts:80` | `CAMERA_MESSAGES` |
| EXP-0916 | `apps/extension/src/core/onboardingRules.ts:87` | `QR_PARSE_ERROR` |
| EXP-0917 | `apps/extension/src/core/backupSession.ts:9` | `planBackup` |
| EXP-0918 | `apps/extension/src/core/backupSession.ts:20` | `checkPicks` |
| EXP-0919 | `apps/extension/src/core/nfts/added.ts:10` | `MAX_ADDED_NFTS` |
| EXP-0920 | `apps/extension/src/core/nfts/added.ts:11` | `nftKey` |
| EXP-0921 | `apps/extension/src/core/nfts/added.ts:12` | `keyOf` |
| EXP-0922 | `apps/extension/src/core/nfts/added.ts:14` | `sanitizeAdded` |
| EXP-0923 | `apps/extension/src/core/nfts/added.ts:23` | `readAdded` |
| EXP-0924 | `apps/extension/src/core/nfts/added.ts:24` | `addedKeys` |
| EXP-0925 | `apps/extension/src/core/nfts/added.ts:27` | `keepAdded` |
| EXP-0926 | `apps/extension/src/core/nfts/added.ts:41` | `checkOwnership` |
| EXP-0927 | `apps/extension/src/core/nfts/added.ts:60` | `stubCollections` |
| EXP-0928 | `apps/extension/src/core/nfts/blockscout.ts:10` | `BLOCKSCOUT_HOSTS` |
| EXP-0929 | `apps/extension/src/core/nfts/blockscout.ts:19` | `collectionKey` |
| EXP-0930 | `apps/extension/src/core/nfts/blockscout.ts:21` | `mapBlockscoutInstance` |
| EXP-0931 | `apps/extension/src/core/nfts/blockscout.ts:42` | `mapBlockscoutCollections` |
| EXP-0932 | `apps/extension/src/core/nfts/blockscout.ts:63` | `fetchBlockscoutCollections` |
| EXP-0933 | `apps/extension/src/core/nfts/blockscout.ts:75` | `fetchBlockscoutOwned` |
| EXP-0934 | `apps/extension/src/core/nfts/blockscout.ts:89` | `blockscoutInstanceUrl` |
| EXP-0935 | `apps/extension/src/core/nfts/transfer.ts:10` | `evmNftTransfer` |
| EXP-0936 | `apps/extension/src/core/nfts/transfer.ts:27` | `buildSolanaNftInput` |
| EXP-0937 | `apps/extension/src/core/nfts/transfer.ts:37` | `signSolanaNft` |
| EXP-0938 | `apps/extension/src/core/nfts/types.ts:40` | `emptyReportState` |
| EXP-0939 | `apps/extension/src/core/nfts/onchain.ts:15` | `resolveTokenUri` |
| EXP-0940 | `apps/extension/src/core/nfts/onchain.ts:31` | `fillMissingMetadata` |
| EXP-0941 | `apps/extension/src/core/nfts/solana.ts:11` | `UNGROUPED` |
| EXP-0942 | `apps/extension/src/core/nfts/solana.ts:12` | `solCollectionKey` |
| EXP-0943 | `apps/extension/src/core/nfts/solana.ts:14` | `mapDasAsset` |
| EXP-0944 | `apps/extension/src/core/nfts/solana.ts:35` | `groupSolana` |
| EXP-0945 | `apps/extension/src/core/nfts/solana.ts:49` | `fetchDas` |
| EXP-0946 | `apps/extension/src/core/nfts/solana.ts:68` | `MAGIC_EDEN` |
| EXP-0947 | `apps/extension/src/core/nfts/solana.ts:69` | `mapMagicEden` |
| EXP-0948 | `apps/extension/src/core/nfts/solana.ts:82` | `fetchMagicEden` |
| EXP-0949 | `apps/extension/src/core/nfts/alchemy.ts:13` | `ALCHEMY_NFT_CHAINS` |
| EXP-0950 | `apps/extension/src/core/nfts/alchemy.ts:18` | `mapAlchemyOwned` |
| EXP-0951 | `apps/extension/src/core/nfts/alchemy.ts:50` | `alchemyAvailable` |
| EXP-0952 | `apps/extension/src/core/nfts/alchemy.ts:52` | `fetchAlchemyCollections` |
| EXP-0953 | `apps/extension/src/core/nfts/media.ts:4` | `IPFS_GATEWAY` |
| EXP-0954 | `apps/extension/src/core/nfts/media.ts:5` | `ARWEAVE_GATEWAY` |
| EXP-0955 | `apps/extension/src/core/nfts/media.ts:9` | `sanitizeMediaUrl` |
| EXP-0956 | `apps/extension/src/core/nfts/media.ts:36` | `isAutoLoadMedia` |
| EXP-0957 | `apps/extension/src/core/nfts/media.ts:47` | `mediaHost` |
| EXP-0958 | `apps/extension/src/core/nfts/media.ts:49` | `sanitizeLink` |
| EXP-0959 | `apps/extension/src/core/nfts/media.ts:54` | `cleanText` |
| EXP-0960 | `apps/extension/src/core/nfts/media.ts:58` | `mapAttributes` |
| EXP-0961 | `apps/extension/src/core/nfts/service.ts:15` | `NFT_CHAINS: string[]` |
| EXP-0962 | `apps/extension/src/core/nfts/service.ts:18` | `loadCollections` |
| EXP-0963 | `apps/extension/src/core/nfts/service.ts:57` | `loadCollectionItems` |
| EXP-0964 | `apps/extension/src/core/nfts/service.ts:68` | `isHidden` |
| EXP-0965 | `apps/extension/src/core/nfts/service.ts:69` | `splitCollections` |
| EXP-0966 | `apps/extension/src/core/nfts/service.ts:74` | `setReported` |
| EXP-0967 | `apps/extension/src/core/nfts/service.ts:78` | `sanitizeReportState` |
| EXP-0968 | `apps/extension/src/core/nfts/spam.ts:8` | `isSuspiciousCollection` |
| EXP-0969 | `apps/extension/src/core/walletCore.ts:3` | `getCore` |
| EXP-0970 | `apps/extension/src/core/approvals.ts:10` | `APPROVAL_CHAINS` |
| EXP-0971 | `apps/extension/src/core/approvals.ts:11` | `APPROVAL_UNSUPPORTED` |
| EXP-0972 | `apps/extension/src/core/approvals.ts:14` | `GOPLUS_CHAINS` |
| EXP-0973 | `apps/extension/src/core/approvals.ts:19` | `parseGoPlus` |
| EXP-0974 | `apps/extension/src/core/approvals.ts:35` | `scanApprovals` |
| EXP-0975 | `apps/extension/src/core/approvals.ts:49` | `revokeCall` |
| EXP-0976 | `apps/extension/src/core/keySchedule.ts:15` | `ARGON2_DEFAULT` |
| EXP-0977 | `apps/extension/src/core/keySchedule.ts:19` | `isV2` |
| EXP-0978 | `apps/extension/src/core/keySchedule.ts:26` | `v2Record` |
| EXP-0979 | `apps/extension/src/core/keySchedule.ts:30` | `deriveV2` |
| EXP-0980 | `apps/extension/src/core/perps/hyperliquid.ts:9` | `HL_API` |
| EXP-0981 | `apps/extension/src/core/perps/hyperliquid.ts:10` | `HL_BRIDGE` |
| EXP-0982 | `apps/extension/src/core/perps/hyperliquid.ts:11` | `ARB_USDC` |
| EXP-0983 | `apps/extension/src/core/perps/hyperliquid.ts:12` | `MIN_DEPOSIT` |
| EXP-0984 | `apps/extension/src/core/perps/hyperliquid.ts:13` | `SIGNATURE_CHAIN_ID` |
| EXP-0985 | `apps/extension/src/core/perps/hyperliquid.ts:17` | `hlInfo<T` |
| EXP-0986 | `apps/extension/src/core/perps/hyperliquid.ts:25` | `floatToWire` |
| EXP-0987 | `apps/extension/src/core/perps/hyperliquid.ts:33` | `roundPrice` |
| EXP-0988 | `apps/extension/src/core/perps/hyperliquid.ts:40` | `roundSize` |
| EXP-0989 | `apps/extension/src/core/perps/hyperliquid.ts:45` | `orderAction` |
| EXP-0990 | `apps/extension/src/core/perps/hyperliquid.ts:48` | `orderWire` |
| EXP-0991 | `apps/extension/src/core/perps/hyperliquid.ts:54` | `marketPrice` |
| EXP-0992 | `apps/extension/src/core/perps/hyperliquid.ts:55` | `cancelAction` |
| EXP-0993 | `apps/extension/src/core/perps/hyperliquid.ts:56` | `leverageAction` |
| EXP-0994 | `apps/extension/src/core/perps/hyperliquid.ts:59` | `actionHash` |
| EXP-0995 | `apps/extension/src/core/perps/hyperliquid.ts:65` | `l1Digest` |
| EXP-0996 | `apps/extension/src/core/perps/hyperliquid.ts:80` | `userAction` |
| EXP-0997 | `apps/extension/src/core/perps/hyperliquid.ts:83` | `userDigest` |
| EXP-0998 | `apps/extension/src/core/perps/hyperliquid.ts:94` | `hlExchange` |
| EXP-0999 | `apps/extension/src/core/perps/hyperliquid.ts:101` | `orderStatuses` |
| EXP-1000 | `apps/extension/src/core/perps/hyperliquid.ts:107` | `perpMarkets` |
| EXP-1001 | `apps/extension/src/core/perps/hyperliquid.ts:121` | `mapAccount` |
| EXP-1002 | `apps/extension/src/core/perps/hyperliquid.ts:135` | `perpAccount` |
| EXP-1003 | `apps/extension/src/core/perps/hyperliquid.ts:139` | `toSig` |
| EXP-1004 | `apps/extension/src/core/secureStore.ts:9` | `secureStoreAvailable` |
| EXP-1005 | `apps/extension/src/core/secureStore.ts:21` | `secureStore` |
| EXP-1006 | `apps/extension/src/core/chains/rpcUrls.ts:7` | `getRpcUrls` |
| EXP-1007 | `apps/extension/src/core/chains/rpcUrls.ts:14` | `getPublicRpcUrls` |
| EXP-1008 | `apps/extension/src/core/chains/rpcUrls.ts:26` | `publicRpcForBackend` |
| EXP-1009 | `apps/extension/src/core/chains/cardano.ts:23` | `toTxInputs` |
| EXP-1010 | `apps/extension/src/core/chains/cardano.ts:29` | `cardanoPlan` |
| EXP-1011 | `apps/extension/src/core/chains/cardano.ts:32` | `cardanoSign` |
| EXP-1012 | `apps/extension/src/core/chains/cardano.ts:41` | `cardanoFamily` |
| EXP-1013 | `apps/extension/src/core/chains/adapters/history.ts:23` | `row` |
| EXP-1014 | `apps/extension/src/core/chains/adapters/history.ts:32` | `dirOf` |
| EXP-1015 | `apps/extension/src/core/chains/adapters/history.ts:37` | `mapSolanaTx` |
| EXP-1016 | `apps/extension/src/core/chains/adapters/history.ts:63` | `solanaHistory` |
| EXP-1017 | `apps/extension/src/core/chains/adapters/history.ts:77` | `mapTronTxs` |
| EXP-1018 | `apps/extension/src/core/chains/adapters/history.ts:89` | `mapTrc20` |
| EXP-1019 | `apps/extension/src/core/chains/adapters/history.ts:113` | `mapCosmosTxs` |
| EXP-1020 | `apps/extension/src/core/chains/adapters/history.ts:135` | `resetTxSearchFormForTests` |
| EXP-1021 | `apps/extension/src/core/chains/adapters/history.ts:157` | `mapAptos` |
| EXP-1022 | `apps/extension/src/core/chains/adapters/history.ts:171` | `mapSui` |
| EXP-1023 | `apps/extension/src/core/chains/adapters/history.ts:201` | `mapTon` |
| EXP-1024 | `apps/extension/src/core/chains/adapters/history.ts:214` | `mapAlgorand` |
| EXP-1025 | `apps/extension/src/core/chains/adapters/history.ts:225` | `mapStellar` |
| EXP-1026 | `apps/extension/src/core/chains/adapters/history.ts:237` | `mapRipple` |
| EXP-1027 | `apps/extension/src/core/chains/adapters/history.ts:253` | `mapNear` |
| EXP-1028 | `apps/extension/src/core/chains/adapters/history.ts:265` | `mapTezos` |
| EXP-1029 | `apps/extension/src/core/chains/adapters/history.ts:275` | `mapFilecoin` |
| EXP-1030 | `apps/extension/src/core/chains/adapters/history.ts:285` | `mapWaves` |
| EXP-1031 | `apps/extension/src/core/chains/adapters/history.ts:296` | `mapVeChain` |
| EXP-1032 | `apps/extension/src/core/chains/adapters/history.ts:306` | `mapMultiversx` |
| EXP-1033 | `apps/extension/src/core/chains/adapters/history.ts:316` | `mapSubscan` |
| EXP-1034 | `apps/extension/src/core/chains/adapters/history.ts:326` | `mapRosetta` |
| EXP-1035 | `apps/extension/src/core/chains/adapters/history.ts:344` | `NON_EVM_HISTORY` |
| EXP-1036 | `apps/extension/src/core/chains/adapters/history.ts:361` | `HISTORY_UNSUPPORTED_REASON` |
| EXP-1037 | `apps/extension/src/core/chains/adapters/cosmos.ts:5` | `COSMOS_DENOM` |
| EXP-1038 | `apps/extension/src/core/chains/adapters/cosmos.ts:11` | `cosmosBalance` |
| EXP-1039 | `apps/extension/src/core/chains/adapters/codec.ts:4` | `bytesToHex` |
| EXP-1040 | `apps/extension/src/core/chains/adapters/codec.ts:5` | `hexToBytes` |
| EXP-1041 | `apps/extension/src/core/chains/adapters/codec.ts:12` | `base58Decode` |
| EXP-1042 | `apps/extension/src/core/chains/adapters/codec.ts:20` | `base58Encode` |
| EXP-1043 | `apps/extension/src/core/chains/adapters/codec.ts:28` | `base58CheckDecode` |
| EXP-1044 | `apps/extension/src/core/chains/adapters/codec.ts:34` | `base58CheckEncode` |
| EXP-1045 | `apps/extension/src/core/chains/adapters/codec.ts:43` | `bech32Decode` |
| EXP-1046 | `apps/extension/src/core/chains/adapters/codec.ts:55` | `bech32ToHex20` |
| EXP-1047 | `apps/extension/src/core/chains/adapters/codec.ts:62` | `parseDecimal` |
| EXP-1048 | `apps/extension/src/core/chains/adapters/codec.ts:69` | `toBig` |
| EXP-1049 | `apps/extension/src/core/chains/adapters/codec.ts:77` | `intField` |
| EXP-1050 | `apps/extension/src/core/chains/adapters/others.ts:9` | `tronBalance` |
| EXP-1051 | `apps/extension/src/core/chains/adapters/others.ts:19` | `tonBalance` |
| EXP-1052 | `apps/extension/src/core/chains/adapters/others.ts:26` | `aptosBalance` |
| EXP-1053 | `apps/extension/src/core/chains/adapters/others.ts:35` | `suiBalance` |
| EXP-1054 | `apps/extension/src/core/chains/adapters/others.ts:42` | `nearBalance` |
| EXP-1055 | `apps/extension/src/core/chains/adapters/others.ts:53` | `algorandBalance` |
| EXP-1056 | `apps/extension/src/core/chains/adapters/others.ts:63` | `rippleBalance` |
| EXP-1057 | `apps/extension/src/core/chains/adapters/others.ts:71` | `stellarBalance` |
| EXP-1058 | `apps/extension/src/core/chains/adapters/others.ts:81` | `tezosBalance` |
| EXP-1059 | `apps/extension/src/core/chains/adapters/others.ts:89` | `filecoinBalance` |
| EXP-1060 | `apps/extension/src/core/chains/adapters/others.ts:96` | `wavesBalance` |
| EXP-1061 | `apps/extension/src/core/chains/adapters/others.ts:105` | `vechainBalance` |
| EXP-1062 | `apps/extension/src/core/chains/adapters/others.ts:117` | `harmonyBalance` |
| EXP-1063 | `apps/extension/src/core/chains/adapters/others.ts:118` | `iotexBalance` |
| EXP-1064 | `apps/extension/src/core/chains/adapters/others.ts:121` | `iconBalance` |
| EXP-1065 | `apps/extension/src/core/chains/adapters/others.ts:128` | `zilliqaBalance` |
| EXP-1066 | `apps/extension/src/core/chains/adapters/others.ts:135` | `multiversxBalance` |
| EXP-1067 | `apps/extension/src/core/chains/adapters/others.ts:143` | `thetaBalance` |
| EXP-1068 | `apps/extension/src/core/chains/adapters/others.ts:150` | `ROSETTA_ICP` |
| EXP-1069 | `apps/extension/src/core/chains/adapters/others.ts:151` | `icpBalance` |
| EXP-1070 | `apps/extension/src/core/chains/adapters/others.ts:158` | `fioBalance` |
| EXP-1071 | `apps/extension/src/core/chains/adapters/others.ts:168` | `ontologyBalance` |
| EXP-1072 | `apps/extension/src/core/chains/adapters/others.ts:174` | `nimiqBalance` |
| EXP-1073 | `apps/extension/src/core/chains/adapters/others.ts:175` | `aionBalance` |
| EXP-1074 | `apps/extension/src/core/chains/adapters/utxo.ts:5` | `utxoBalance` |
| EXP-1075 | `apps/extension/src/core/chains/adapters/cardano.ts:6` | `KOIOS` |
| EXP-1076 | `apps/extension/src/core/chains/adapters/cardano.ts:21` | `cardanoAddressInfo` |
| EXP-1077 | `apps/extension/src/core/chains/adapters/cardano.ts:31` | `cardanoTipSlot` |
| EXP-1078 | `apps/extension/src/core/chains/adapters/cardano.ts:36` | `cardanoSubmit` |
| EXP-1079 | `apps/extension/src/core/chains/adapters/cardano.ts:43` | `cardanoBalance` |
| EXP-1080 | `apps/extension/src/core/chains/adapters/types.ts:14` | `fail` |
| EXP-1081 | `apps/extension/src/core/chains/adapters/types.ts:15` | `formatUnits` |
| EXP-1082 | `apps/extension/src/core/chains/adapters/types.ts:21` | `okRaw` |
| EXP-1083 | `apps/extension/src/core/chains/adapters/types.ts:23` | `jsonPost` |
| EXP-1084 | `apps/extension/src/core/chains/adapters/types.ts:28` | `jsonGet` |
| EXP-1085 | `apps/extension/src/core/chains/adapters/types.ts:34` | `firstOf<T>` |
| EXP-1086 | `apps/extension/src/core/chains/adapters/tokens.ts:15` | `STANDARD_LABEL` |
| EXP-1087 | `apps/extension/src/core/chains/adapters/tokens.ts:21` | `TOKEN_CHAINS` |
| EXP-1088 | `apps/extension/src/core/chains/adapters/tokens.ts:22` | `TOKEN_PROGRAMS` |
| EXP-1089 | `apps/extension/src/core/chains/adapters/tokens.ts:27` | `isSolanaAddress` |
| EXP-1090 | `apps/extension/src/core/chains/adapters/tokens.ts:28` | `isTronAddress` |
| EXP-1091 | `apps/extension/src/core/chains/adapters/tokens.ts:29` | `isTonAddress` |
| EXP-1092 | `apps/extension/src/core/chains/adapters/tokens.ts:31` | `isMoveCoinType` |
| EXP-1093 | `apps/extension/src/core/chains/adapters/tokens.ts:33` | `isAptosFaAddress` |
| EXP-1094 | `apps/extension/src/core/chains/adapters/tokens.ts:34` | `validTokenAddress` |
| EXP-1095 | `apps/extension/src/core/chains/adapters/tokens.ts:38` | `splBalance` |
| EXP-1096 | `apps/extension/src/core/chains/adapters/tokens.ts:50` | `probeSpl` |
| EXP-1097 | `apps/extension/src/core/chains/adapters/tokens.ts:70` | `jupiterMeta` |
| EXP-1098 | `apps/extension/src/core/chains/adapters/tokens.ts:83` | `tronAbiParam` |
| EXP-1099 | `apps/extension/src/core/chains/adapters/tokens.ts:84` | `decodeAbiString` |
| EXP-1100 | `apps/extension/src/core/chains/adapters/tokens.ts:104` | `trc20Balance` |
| EXP-1101 | `apps/extension/src/core/chains/adapters/tokens.ts:112` | `probeTrc20` |
| EXP-1102 | `apps/extension/src/core/chains/adapters/tokens.ts:130` | `tonJettonWallet` |
| EXP-1103 | `apps/extension/src/core/chains/adapters/tokens.ts:138` | `jettonBalance` |
| EXP-1104 | `apps/extension/src/core/chains/adapters/tokens.ts:142` | `probeJetton` |
| EXP-1105 | `apps/extension/src/core/chains/adapters/tokens.ts:161` | `suiCoinBalance` |
| EXP-1106 | `apps/extension/src/core/chains/adapters/tokens.ts:170` | `probeSuiCoin` |
| EXP-1107 | `apps/extension/src/core/chains/adapters/tokens.ts:186` | `aptosBalance` |
| EXP-1108 | `apps/extension/src/core/chains/adapters/tokens.ts:192` | `probeAptosAsset` |
| EXP-1109 | `apps/extension/src/core/chains/adapters/tokens.ts:209` | `probeChainToken` |
| EXP-1110 | `apps/extension/src/core/chains/adapters/tokens.ts:218` | `chainTokenBalance` |
| EXP-1111 | `apps/extension/src/core/chains/adapters/net.ts:7` | `req` |
| EXP-1112 | `apps/extension/src/core/chains/adapters/net.ts:13` | `getJ` |
| EXP-1113 | `apps/extension/src/core/chains/adapters/net.ts:14` | `postJ` |
| EXP-1114 | `apps/extension/src/core/chains/adapters/net.ts:16` | `rpc` |
| EXP-1115 | `apps/extension/src/core/chains/adapters/net.ts:21` | `trimUrl` |
| EXP-1116 | `apps/extension/src/core/chains/adapters/net.ts:26` | `endpointsOf` |
| EXP-1117 | `apps/extension/src/core/chains/adapters/net.ts:36` | `simple` |
| EXP-1118 | `apps/extension/src/core/chains/adapters/net.ts:44` | `unsupported` |
| EXP-1119 | `apps/extension/src/core/chains/adapters/solana.ts:4` | `solanaBalance` |
| EXP-1120 | `apps/extension/src/core/chains/adapters/index.ts:14` | `BALANCE_ADAPTERS` |
| EXP-1121 | `apps/extension/src/core/chains/adapters/index.ts:26` | `registerBalanceAdapter` |
| EXP-1122 | `apps/extension/src/core/chains/adapters/index.ts:28` | `fetchNativeBalance` |
| EXP-1123 | `apps/extension/src/core/chains/adapters/index.ts:35` | `fetchNativeBalances` |
| EXP-1124 | `apps/extension/src/core/chains/adapters/index.ts:43` | `addressFor` |
| EXP-1125 | `apps/extension/src/core/chains/adapters/substrate.ts:9` | `ASSET_HUB_RPC` |
| EXP-1126 | `apps/extension/src/core/chains/adapters/substrate.ts:17` | `ss58Decode` |
| EXP-1127 | `apps/extension/src/core/chains/adapters/substrate.ts:26` | `systemAccountKey` |
| EXP-1128 | `apps/extension/src/core/chains/adapters/substrate.ts:32` | `decodeFree` |
| EXP-1129 | `apps/extension/src/core/chains/adapters/substrate.ts:47` | `substrateAdapter` |
| EXP-1130 | `apps/extension/src/core/chains/adapters/evm.ts:6` | `evmBalance` |
| EXP-1131 | `apps/extension/src/core/chains/testnets.ts:18` | `TESTNET_CHAINS` |
| EXP-1132 | `apps/extension/src/core/chains/index.ts:11` | `EXTRA_CHAINS` |
| EXP-1133 | `apps/extension/src/core/chains/index.ts:12` | `ALL_CHAINS` |
| EXP-1134 | `apps/extension/src/core/chains/index.ts:17` | `chainById` |
| EXP-1135 | `apps/extension/src/core/chains/index.ts:18` | `chainByTwId` |
| EXP-1136 | `apps/extension/src/core/chains/index.ts:19` | `chainByEvmId` |
| EXP-1137 | `apps/extension/src/core/chains/index.ts:20` | `evmChains` |
| EXP-1138 | `apps/extension/src/core/chains/index.ts:21` | `chainLogo` |
| EXP-1139 | `apps/extension/src/core/chains/index.ts:26` | `ENABLED_CHAIN_IDS: readonly string[]` |
| EXP-1140 | `apps/extension/src/core/chains/index.ts:27` | `isEnabledChain` |
| EXP-1141 | `apps/extension/src/core/chains/index.ts:28` | `ENABLED_CHAINS` |
| EXP-1142 | `apps/extension/src/core/chains/index.ts:32` | `NETWORK_CATEGORIES: readonly NetworkCategory[]` |
| EXP-1143 | `apps/extension/src/core/chains/index.ts:33` | `NETWORK_CATEGORY_LABEL` |
| EXP-1144 | `apps/extension/src/core/chains/index.ts:34` | `chainCategory` |
| EXP-1145 | `apps/extension/src/core/chains/index.ts:36` | `networkSubtitle` |
| EXP-1146 | `apps/extension/src/core/chains/index.ts:39` | `DEFAULT_HOME_CHAINS: string[]` |
| EXP-1147 | `apps/extension/src/core/chains/index.ts:42` | `explorerTxUrl` |
| EXP-1148 | `apps/extension/src/core/chains/index.ts:48` | `explorerAddressUrl` |
| EXP-1149 | `apps/extension/src/core/chains/send/stellar.ts:14` | `stellarFamily` |
| EXP-1150 | `apps/extension/src/core/chains/send/proto.ts:4` | `TW: typeof import` |
| EXP-1151 | `apps/extension/src/core/chains/send/sui.ts:25` | `suiFamily` |
| EXP-1152 | `apps/extension/src/core/chains/send/cosmos.ts:12` | `COSMOS_SPECS` |
| EXP-1153 | `apps/extension/src/core/chains/send/cosmos.ts:30` | `cosmosFamily` |
| EXP-1154 | `apps/extension/src/core/chains/send/near.ts:16` | `nearFamily` |
| EXP-1155 | `apps/extension/src/core/chains/send/filecoin.ts:12` | `filecoinFamily` |
| EXP-1156 | `apps/extension/src/core/chains/send/ripple.ts:16` | `validateXrpTag` |
| EXP-1157 | `apps/extension/src/core/chains/send/ripple.ts:23` | `rippleFamily` |
| EXP-1158 | `apps/extension/src/core/chains/send/theta.ts:13` | `thetaFamily` |
| EXP-1159 | `apps/extension/src/core/chains/send/polkadot.ts:26` | `polkadotFamily` |
| EXP-1160 | `apps/extension/src/core/chains/send/waves.ts:9` | `wavesFamily` |
| EXP-1161 | `apps/extension/src/core/chains/send/ton.ts:18` | `tonFamily` |
| EXP-1162 | `apps/extension/src/core/chains/send/tron.ts:16` | `tronFamily` |
| EXP-1163 | `apps/extension/src/core/chains/send/tezos.ts:16` | `tezosFamily` |
| EXP-1164 | `apps/extension/src/core/chains/send/utxo.ts:27` | `fetchRates` |
| EXP-1165 | `apps/extension/src/core/chains/send/utxo.ts:52` | `utxoSelection` |
| EXP-1166 | `apps/extension/src/core/chains/send/utxo.ts:60` | `utxoFamily` |
| EXP-1167 | `apps/extension/src/core/chains/send/harmony.ts:13` | `harmonyFamily` |
| EXP-1168 | `apps/extension/src/core/chains/send/vechain.ts:10` | `VTHO` |
| EXP-1169 | `apps/extension/src/core/chains/send/vechain.ts:17` | `vechainFamily` |
| EXP-1170 | `apps/extension/src/core/chains/send/zilliqa.ts:13` | `zilliqaFamily` |
| EXP-1171 | `apps/extension/src/core/chains/send/types.ts:8` | `TIER_IDS` |
| EXP-1172 | `apps/extension/src/core/chains/send/types.ts:89` | `SendError extends Error { constructor` |
| EXP-1173 | `apps/extension/src/core/chains/send/multiversx.ts:13` | `multiversxFamily` |
| EXP-1174 | `apps/extension/src/core/chains/send/solana.ts:18` | `solanaFamily` |
| EXP-1175 | `apps/extension/src/core/chains/send/nft.ts:26` | `quoteNftTransfer` |
| EXP-1176 | `apps/extension/src/core/chains/send/nft.ts:43` | `buildNftTransfer` |
| EXP-1177 | `apps/extension/src/core/chains/send/nft.ts:47` | `broadcastNftTransfer` |
| EXP-1178 | `apps/extension/src/core/chains/send/util.ts:6` | `MSG` |
| EXP-1179 | `apps/extension/src/core/chains/send/util.ts:15` | `issue` |
| EXP-1180 | `apps/extension/src/core/chains/send/util.ts:18` | `parseUnits` |
| EXP-1181 | `apps/extension/src/core/chains/send/util.ts:25` | `formatUnits` |
| EXP-1182 | `apps/extension/src/core/chains/send/util.ts:30` | `maxBig` |
| EXP-1183 | `apps/extension/src/core/chains/send/util.ts:31` | `minBig` |
| EXP-1184 | `apps/extension/src/core/chains/send/util.ts:32` | `sub0` |
| EXP-1185 | `apps/extension/src/core/chains/send/util.ts:35` | `hexToBytes` |
| EXP-1186 | `apps/extension/src/core/chains/send/util.ts:36` | `bytesToHex` |
| EXP-1187 | `apps/extension/src/core/chains/send/util.ts:38` | `bigToBytes` |
| EXP-1188 | `apps/extension/src/core/chains/send/util.ts:39` | `b64` |
| EXP-1189 | `apps/extension/src/core/chains/send/util.ts:40` | `fromB64` |
| EXP-1190 | `apps/extension/src/core/chains/send/util.ts:41` | `utf8` |
| EXP-1191 | `apps/extension/src/core/chains/send/util.ts:44` | `jget` |
| EXP-1192 | `apps/extension/src/core/chains/send/util.ts:49` | `jpost` |
| EXP-1193 | `apps/extension/src/core/chains/send/util.ts:57` | `rpc` |
| EXP-1194 | `apps/extension/src/core/chains/send/util.ts:62` | `firstOf<T>` |
| EXP-1195 | `apps/extension/src/core/chains/send/util.ts:67` | `trimUrl` |
| EXP-1196 | `apps/extension/src/core/chains/send/util.ts:70` | `tiersFrom` |
| EXP-1197 | `apps/extension/src/core/chains/send/util.ts:74` | `scale` |
| EXP-1198 | `apps/extension/src/core/chains/send/util.ts:76` | `fundsIssues` |
| EXP-1199 | `apps/extension/src/core/chains/send/util.ts:82` | `randomBytes` |
| EXP-1200 | `apps/extension/src/core/chains/send/util.ts:86` | `bech32Bytes` |
| EXP-1201 | `apps/extension/src/core/chains/send/aptos.ts:15` | `aptosPayload` |
| EXP-1202 | `apps/extension/src/core/chains/send/aptos.ts:22` | `aptosFamily` |
| EXP-1203 | `apps/extension/src/core/chains/send/index.ts:31` | `SEND_FAMILIES` |
| EXP-1204 | `apps/extension/src/core/chains/send/index.ts:37` | `UNSUPPORTED_REASON` |
| EXP-1205 | `apps/extension/src/core/chains/send/index.ts:44` | `sendSupport` |
| EXP-1206 | `apps/extension/src/core/chains/send/index.ts:50` | `familyOf` |
| EXP-1207 | `apps/extension/src/core/chains/send/index.ts:55` | `memoKindOf` |
| EXP-1208 | `apps/extension/src/core/chains/send/index.ts:57` | `validateMemo` |
| EXP-1209 | `apps/extension/src/core/chains/send/index.ts:62` | `quoteToWire` |
| EXP-1210 | `apps/extension/src/core/chains/send/index.ts:67` | `signAndBroadcast` |
| EXP-1211 | `apps/extension/src/core/chains/send/index.ts:74` | `txStatus` |
| EXP-1212 | `apps/extension/src/core/chains/send/algorand.ts:12` | `algorandFamily` |
| EXP-1213 | `apps/extension/src/core/chains/send/evm.ts:17` | `evmRpcs` |
| EXP-1214 | `apps/extension/src/core/chains/send/evm.ts:23` | `validEvmAddress` |
| EXP-1215 | `apps/extension/src/core/chains/send/evm.ts:25` | `evmTransferData` |
| EXP-1216 | `apps/extension/src/core/chains/send/evm.ts:45` | `prepareEvm` |
| EXP-1217 | `apps/extension/src/core/chains/send/evm.ts:70` | `evmTierFees` |
| EXP-1218 | `apps/extension/src/core/chains/send/evm.ts:77` | `evmTxRequest` |
| EXP-1219 | `apps/extension/src/core/chains/send/evm.ts:85` | `evmSendCall` |
| EXP-1220 | `apps/extension/src/core/chains/send/evm.ts:92` | `signEvmTx` |
| EXP-1221 | `apps/extension/src/core/chains/send/evm.ts:99` | `broadcastEvm` |
| EXP-1222 | `apps/extension/src/core/chains/send/evm.ts:100` | `statusEvm` |
| EXP-1223 | `apps/extension/src/core/chains/send/evm.ts:109` | `evmFamily` |
| EXP-1224 | `apps/extension/src/core/chains/send/evm.ts:135` | `iotexFamily` |
| EXP-1225 | `apps/extension/src/core/chains/send/icon.ts:12` | `iconFamily` |
| EXP-1226 | `apps/extension/src/core/sentiment/index.ts:19` | `cleanText` |
| EXP-1227 | `apps/extension/src/core/sentiment/index.ts:34` | `feedBlocks` |
| EXP-1228 | `apps/extension/src/core/sentiment/index.ts:54` | `parseRss` |
| EXP-1229 | `apps/extension/src/core/sentiment/index.ts:67` | `parseCryptoCompare` |
| EXP-1230 | `apps/extension/src/core/sentiment/index.ts:76` | `parseReddit` |
| EXP-1231 | `apps/extension/src/core/sentiment/index.ts:88` | `parseStocktwits` |
| EXP-1232 | `apps/extension/src/core/sentiment/index.ts:106` | `lexiconScore` |
| EXP-1233 | `apps/extension/src/core/sentiment/index.ts:115` | `labelFor` |
| EXP-1234 | `apps/extension/src/core/sentiment/index.ts:116` | `classify` |
| EXP-1235 | `apps/extension/src/core/sentiment/index.ts:120` | `sentimentScore` |
| EXP-1236 | `apps/extension/src/core/sentiment/index.ts:124` | `matchesAsset` |
| EXP-1237 | `apps/extension/src/core/sentiment/index.ts:131` | `sentimentAssets` |
| EXP-1238 | `apps/extension/src/core/sentiment/index.ts:136` | `isSymbol` |
| EXP-1239 | `apps/extension/src/core/sentiment/index.ts:138` | `assetName` |
| EXP-1240 | `apps/extension/src/core/sentiment/index.ts:152` | `fetchSentiment` |
| EXP-1241 | `apps/extension/src/core/backupVerify.ts:3` | `shuffleWords` |
| EXP-1242 | `apps/extension/src/core/backupVerify.ts:8` | `chipWord` |
| EXP-1243 | `apps/extension/src/core/backupVerify.ts:11` | `verifySelection` |
| EXP-1244 | `apps/extension/src/core/chains.ts:6` | `CHAINS` |
| EXP-1245 | `apps/extension/src/core/chains.ts:7` | `TESTNETS` |
| EXP-1246 | `apps/extension/src/core/qrSync.ts:12` | `MAX_COMPRESSED` |
| EXP-1247 | `apps/extension/src/core/qrSync.ts:16` | `unminify` |
| EXP-1248 | `apps/extension/src/core/qrSync.ts:36` | `createQrSyncReader` |
| EXP-1249 | `apps/extension/src/core/qrSync.ts:63` | `ONE_TIME_CODE` |
| EXP-1250 | `apps/extension/src/core/qrSync.ts:70` | `QR_MAX_KEY_BYTES` |
| EXP-1251 | `apps/extension/src/core/qrSync.ts:71` | `QR_MAX_TOTAL_WORK` |
| EXP-1252 | `apps/extension/src/core/qrSync.ts:73` | `codeMatchesKey` |
| EXP-1253 | `apps/extension/src/core/qrSync.ts:92` | `isWellFormedKey` |
| EXP-1254 | `apps/extension/src/core/activityFeed.ts:9` | `compareActivity` |
| EXP-1255 | `apps/extension/src/core/activityFeed.ts:12` | `mergeActivity` |
| EXP-1256 | `apps/extension/src/core/activityFeed.ts:19` | `activityNetworks` |
| EXP-1257 | `apps/extension/src/core/activityFeed.ts:26` | `orderChains` |
| EXP-1258 | `apps/extension/src/core/activityFeed.ts:32` | `resolveActivityChain` |
| EXP-1259 | `apps/extension/src/core/passkeyService.ts:18` | `passkeyMeta` |
| EXP-1260 | `apps/extension/src/core/passkeyService.ts:24` | `dropLegacyPasskey` |
| EXP-1261 | `apps/extension/src/core/passkeyService.ts:31` | `enrollPasskey` |
| EXP-1262 | `apps/extension/src/core/passkeyService.ts:41` | `removePasskey` |
| EXP-1263 | `apps/extension/src/core/passkeyService.ts:44` | `unlockWithPasskey` |
| EXP-1264 | `apps/extension/src/core/passkeyService.ts:58` | `LEGACY_MSG` |
| EXP-1265 | `apps/extension/src/core/passkeyService.ts:62` | `verifyPasskeySecret` |
| EXP-1266 | `apps/extension/src/core/addressBook.ts:8` | `ADDRESS_BOOK_COINS` |
| EXP-1267 | `apps/extension/src/core/addressBook.ts:10` | `ADDRESS_BOOK_COIN_LABEL` |
| EXP-1268 | `apps/extension/src/core/addressBook.ts:11` | `MAX_ADDRESS_BOOK_ENTRIES` |
| EXP-1269 | `apps/extension/src/core/addressBook.ts:12` | `MAX_NAME_LENGTH` |
| EXP-1270 | `apps/extension/src/core/addressBook.ts:18` | `cleanName` |
| EXP-1271 | `apps/extension/src/core/addressBook.ts:23` | `sanitizeEntry` |
| EXP-1272 | `apps/extension/src/core/addressBook.ts:42` | `upsertEntry` |
| EXP-1273 | `apps/extension/src/core/addressBook.ts:50` | `removeEntry` |
| EXP-1274 | `apps/extension/src/core/addressBook.ts:52` | `entriesForCoin` |
| EXP-1275 | `apps/extension/src/core/addressBook.ts:54` | `readEntries` |
| EXP-1276 | `apps/extension/src/core/predictions/polymarket.ts:9` | `GAMMA` |
| EXP-1277 | `apps/extension/src/core/predictions/polymarket.ts:10` | `CLOB` |
| EXP-1278 | `apps/extension/src/core/predictions/polymarket.ts:11` | `DATA` |
| EXP-1279 | `apps/extension/src/core/predictions/polymarket.ts:12` | `POLYGON` |
| EXP-1280 | `apps/extension/src/core/predictions/polymarket.ts:13` | `PUSD` |
| EXP-1281 | `apps/extension/src/core/predictions/polymarket.ts:14` | `USDCE` |
| EXP-1282 | `apps/extension/src/core/predictions/polymarket.ts:15` | `ONRAMP` |
| EXP-1283 | `apps/extension/src/core/predictions/polymarket.ts:16` | `CTF` |
| EXP-1284 | `apps/extension/src/core/predictions/polymarket.ts:17` | `EXCHANGES` |
| EXP-1285 | `apps/extension/src/core/predictions/polymarket.ts:24` | `mapMarket` |
| EXP-1286 | `apps/extension/src/core/predictions/polymarket.ts:31` | `markets` |
| EXP-1287 | `apps/extension/src/core/predictions/polymarket.ts:37` | `market` |
| EXP-1288 | `apps/extension/src/core/predictions/polymarket.ts:40` | `book` |
| EXP-1289 | `apps/extension/src/core/predictions/polymarket.ts:47` | `geoblock` |
| EXP-1290 | `apps/extension/src/core/predictions/polymarket.ts:52` | `positions` |
| EXP-1291 | `apps/extension/src/core/predictions/polymarket.ts:56` | `activity` |
| EXP-1292 | `apps/extension/src/core/predictions/polymarket.ts:62` | `CLOB_AUTH_MESSAGE` |
| EXP-1293 | `apps/extension/src/core/predictions/polymarket.ts:63` | `clobAuthDigest` |
| EXP-1294 | `apps/extension/src/core/predictions/polymarket.ts:73` | `l2Signature` |
| EXP-1295 | `apps/extension/src/core/predictions/polymarket.ts:77` | `l2Headers` |
| EXP-1296 | `apps/extension/src/core/predictions/polymarket.ts:81` | `apiCreds` |
| EXP-1297 | `apps/extension/src/core/predictions/polymarket.ts:99` | `orderAmounts` |
| EXP-1298 | `apps/extension/src/core/predictions/polymarket.ts:108` | `buildOrder` |
| EXP-1299 | `apps/extension/src/core/predictions/polymarket.ts:113` | `orderDigest` |
| EXP-1300 | `apps/extension/src/core/predictions/polymarket.ts:125` | `orderBody` |
| EXP-1301 | `apps/extension/src/core/predictions/polymarket.ts:128` | `postOrder` |
| EXP-1302 | `apps/extension/src/core/passwordPolicy.ts:5` | `validatePassword` |
| EXP-1303 | `apps/extension/src/background/qrStage.ts:11` | `QR_MAX_WRONG_CODES` |
| EXP-1304 | `apps/extension/src/background/qrStage.ts:15` | `stageQrKeys` |
| EXP-1305 | `apps/extension/src/background/qrStage.ts:25` | `readQrStage` |
| EXP-1306 | `apps/extension/src/background/qrStage.ts:31` | `clearQrStage` |
| EXP-1307 | `apps/extension/src/background/qrStage.ts:33` | `qrWrongCode` |
| EXP-1308 | `apps/extension/src/background/reauth.ts:17` | `ALL_GRANT_KEYS` |
| EXP-1309 | `apps/extension/src/background/reauth.ts:19` | `purposeOf` |
| EXP-1310 | `apps/extension/src/background/reauth.ts:20` | `grantReauth` |
| EXP-1311 | `apps/extension/src/background/reauth.ts:33` | `consumeReauth` |
| EXP-1312 | `apps/extension/src/background/reauth.ts:38` | `hasReauth` |
| EXP-1313 | `apps/extension/src/background/reauth.ts:41` | `clearReauth` |
| EXP-1314 | `apps/extension/src/background/swapService.ts:58` | `getSettings` |
| EXP-1315 | `apps/extension/src/background/swapService.ts:62` | `setSettings` |
| EXP-1316 | `apps/extension/src/background/swapService.ts:71` | `rememberAssets` |
| EXP-1317 | `apps/extension/src/background/swapService.ts:77` | `listHistory` |
| EXP-1318 | `apps/extension/src/background/swapService.ts:113` | `getBalances` |
| EXP-1319 | `apps/extension/src/background/swapService.ts:156` | `maxSpendable` |
| EXP-1320 | `apps/extension/src/background/swapService.ts:178` | `gaslessAvailable` |
| EXP-1321 | `apps/extension/src/background/swapService.ts:188` | `quote` |
| EXP-1322 | `apps/extension/src/background/swapService.ts:238` | `approve` |
| EXP-1323 | `apps/extension/src/background/swapService.ts:294` | `submit` |
| EXP-1324 | `apps/extension/src/background/swapService.ts:458` | `status` |
| EXP-1325 | `apps/extension/src/background/swapService.ts:494` | `searchTokens` |
| EXP-1326 | `apps/extension/src/background/swapService.ts:510` | `scanDust` |
| EXP-1327 | `apps/extension/src/background/swapService.ts:523` | `convertDust` |
| EXP-1328 | `apps/extension/src/background/clipboard.ts:42` | `copySecretToClipboard` |
| EXP-1329 | `apps/extension/src/background/walletState.ts:6` | `ensureAccounts` |
| EXP-1330 | `apps/extension/src/background/walletState.ts:16` | `activeEntry` |
| EXP-1331 | `apps/extension/src/background/walletState.ts:24` | `nextSeedLabel` |
| EXP-1332 | `apps/extension/src/background/harbour.ts:17` | `evmAddresses` |
| EXP-1333 | `apps/extension/src/background/harbour.ts:27` | `syncAddresses` |
| EXP-1334 | `apps/extension/src/background/harbour.ts:39` | `scheduleAddressSync` |
| EXP-1335 | `apps/extension/src/background/harbour.ts:85` | `reconnectRealtime` |
| EXP-1336 | `apps/extension/src/background/harbour.ts:90` | `wireRealtime` |
| EXP-1337 | `apps/extension/src/background/harbour.ts:106` | `syncWebPush` |
| EXP-1338 | `apps/extension/src/background/harbour.ts:123` | `wirePushEvents` |
| EXP-1339 | `apps/extension/src/background/activityRuntime.ts:16` | `ACTIVITY_PENDING_ALARM` |
| EXP-1340 | `apps/extension/src/background/activityRuntime.ts:19` | `activityEngine` |
| EXP-1341 | `apps/extension/src/background/activityRuntime.ts:32` | `startActivityRecording` |
| EXP-1342 | `apps/extension/src/background/activityRuntime.ts:33` | `reconcilePendingActivity` |
| EXP-1343 | `apps/extension/src/background/provider/wallet.ts:17` | `readWalletAccounts` |
| EXP-1344 | `apps/extension/src/background/provider/wallet.ts:22` | `readAccountOf` |
| EXP-1345 | `apps/extension/src/background/provider/wallet.ts:29` | `openConnectionKeys` |
| EXP-1346 | `apps/extension/src/background/provider/multiBuild.ts:29` | `multiBackend` |
| EXP-1347 | `apps/extension/src/background/provider/signer.ts:17` | `createSigner` |
| EXP-1348 | `apps/extension/src/background/provider/rpc.ts:14` | `cacheTtlSeconds` |
| EXP-1349 | `apps/extension/src/background/provider/rpc.ts:61` | `makeRpc` |
| EXP-1350 | `apps/extension/src/background/provider/view.ts:37` | `buildView` |
| EXP-1351 | `apps/extension/src/background/provider/networks.ts:8` | `evmNetworks` |
| EXP-1352 | `apps/extension/src/background/provider/networks.ts:14` | `evmNetwork` |
| EXP-1353 | `apps/extension/src/background/provider/networks.ts:16` | `txUrl` |
| EXP-1354 | `apps/extension/src/background/provider/tonProof.ts:4` | `tonProofHash` |
| EXP-1355 | `apps/extension/src/background/provider/approvalWindow.ts:12` | `APPROVAL_W` |
| EXP-1356 | `apps/extension/src/background/provider/approvalWindow.ts:14` | `ApprovalWindow {` |
| EXP-1357 | `apps/extension/src/background/provider/index.ts:35` | `PORT_NAME` |
| EXP-1358 | `apps/extension/src/background/provider/index.ts:36` | `GC_ALARM` |
| EXP-1359 | `apps/extension/src/background/provider/index.ts:40` | `EXCLUDE_MATCHES` |
| EXP-1360 | `apps/extension/src/background/provider/index.ts:48` | `perms` |
| EXP-1361 | `apps/extension/src/background/provider/index.ts:49` | `pending` |
| EXP-1362 | `apps/extension/src/background/provider/index.ts:50` | `approvalUrl` |
| EXP-1363 | `apps/extension/src/background/provider/index.ts:63` | `rpc` |
| EXP-1364 | `apps/extension/src/background/provider/index.ts:75` | `wc` |
| EXP-1365 | `apps/extension/src/background/provider/index.ts:81` | `initWalletConnectBackground` |
| EXP-1366 | `apps/extension/src/background/provider/index.ts:88` | `getProvider` |
| EXP-1367 | `apps/extension/src/background/provider/index.ts:152` | `announceChain` |
| EXP-1368 | `apps/extension/src/background/provider/index.ts:189` | `registerInpage` |
| EXP-1369 | `apps/extension/src/background/provider/index.ts:204` | `initProviderBackground` |
| EXP-1370 | `apps/extension/src/background/provider/index.ts:226` | `disconnectOrigin` |
| EXP-1371 | `apps/extension/src/background/provider/index.ts:233` | `viewDeps` |
| EXP-1372 | `apps/extension/src/background/provider/fees.ts:7` | `feePresets` |
| EXP-1373 | `apps/extension/src/background/provider/fees.ts:25` | `maxFeeOf` |
| EXP-1374 | `apps/extension/src/background/provider/service.ts:102` | `DEFAULT_CHAIN` |
| EXP-1375 | `apps/extension/src/background/provider/service.ts:105` | `ProviderService {` |
| EXP-1376 | `apps/extension/src/background/provider/service.ts:678` | `permission` |
| EXP-1377 | `apps/extension/src/background/grants.ts:6` | `grantStore` |
| EXP-1378 | `apps/extension/src/background/walletconnect/bridge.ts:10` | `WC_TAB` |
| EXP-1379 | `apps/extension/src/background/walletconnect/bridge.ts:11` | `SESSIONS_KEY` |
| EXP-1380 | `apps/extension/src/background/walletconnect/bridge.ts:12` | `PROJECT_ID_KEY` |
| EXP-1381 | `apps/extension/src/background/walletconnect/bridge.ts:42` | `WalletConnectBridge {` |
| EXP-1382 | `apps/extension/src/background/walletconnect/kit.ts:33` | `WALLET_METADATA` |
| EXP-1383 | `apps/extension/src/background/walletconnect/kit.ts:35` | `createKit` |
| EXP-1384 | `apps/extension/src/background/walletconnect/kit.ts:41` | `readProjectId` |
| EXP-1385 | `apps/extension/src/background/keys.ts:18` | `openActiveKeys` |
| EXP-1386 | `apps/extension/src/background/notify.ts:20` | `ACTIVITY_ALARM` |
| EXP-1387 | `apps/extension/src/background/notify.ts:26` | `WATCH_CHAINS: string[]` |
| EXP-1388 | `apps/extension/src/background/notify.ts:28` | `FCM_SENDER_ID` |
| EXP-1389 | `apps/extension/src/background/notify.ts:35` | `watchedAddresses` |
| EXP-1390 | `apps/extension/src/background/notify.ts:45` | `showNotification` |
| EXP-1391 | `apps/extension/src/background/notify.ts:53` | `pollActivity` |
| EXP-1392 | `apps/extension/src/background/notify.ts:75` | `notifyAnnouncements` |
| EXP-1393 | `apps/extension/src/background/notify.ts:84` | `syncRemotePush` |
| EXP-1394 | `apps/extension/src/background/notify.ts:105` | `applyNotifySchedule` |
| EXP-1395 | `apps/extension/src/background/notify.ts:109` | `wireNotifications` |
| EXP-1396 | `apps/extension/src/background/notify.ts:127` | `notifyStatus` |
| EXP-1397 | `apps/extension/src/background/smartAccountService.ts:45` | `flagOn` |
| EXP-1398 | `apps/extension/src/background/smartAccountService.ts:67` | `status` |
| EXP-1399 | `apps/extension/src/background/smartAccountService.ts:79` | `prepare` |
| EXP-1400 | `apps/extension/src/background/smartAccountService.ts:105` | `approve` |
| EXP-1401 | `apps/extension/src/background/smartAccountService.ts:135` | `reject` |
| EXP-1402 | `apps/extension/src/background/smartAccountService.ts:140` | `preparedCount` |
| EXP-1403 | `apps/extension/src/background/smartAccountService.ts:152` | `sendCallsAvailable` |
| EXP-1404 | `apps/extension/src/background/smartAccountService.ts:161` | `sendCalls` |
| EXP-1405 | `apps/extension/src/background/smartAccountService.ts:189` | `CALLS_STATE_TTL_MS` |
| EXP-1406 | `apps/extension/src/background/smartAccountService.ts:191` | `invalidateCallsState` |
| EXP-1407 | `apps/extension/src/background/smartAccountService.ts:192` | `callsState` |
| EXP-1408 | `apps/extension/src/background/smartAccountService.ts:208` | `submitDappCalls` |
| EXP-1409 | `apps/extension/src/background/smartAccountService.ts:231` | `resetUserOpStatusForTests` |
| EXP-1410 | `apps/extension/src/background/smartAccountService.ts:232` | `userOpStatus` |
| EXP-1411 | `apps/extension/src/background/smartAccountService.ts:258` | `grantPermission` |
| EXP-1412 | `apps/extension/src/background/smartAccountService.ts:291` | `grants` |
| EXP-1413 | `apps/extension/src/background/secretRender.ts:9` | `sanitizeTheme` |
| EXP-1414 | `apps/extension/src/background/secretRender.ts:48` | `GRID` |
| EXP-1415 | `apps/extension/src/background/secretRender.ts:50` | `renderPhraseGrid` |
| EXP-1416 | `apps/extension/src/background/secretRender.ts:66` | `renderWord` |
| EXP-1417 | `apps/extension/src/background/secretRender.ts:77` | `renderSecretBlock` |
| EXP-1418 | `apps/extension/src/background/accessPolicy.ts:3` | `isInternalWalletSender` |
| EXP-1419 | `apps/extension/src/background/modules/wallet.ts:23` | `handlers` |
| EXP-1420 | `apps/extension/src/background/modules/shared.ts:9` | `defaultHiddenAssets` |
| EXP-1421 | `apps/extension/src/background/modules/shared.ts:13` | `networksReady` |
| EXP-1422 | `apps/extension/src/background/modules/shared.ts:14` | `saveNetworks` |
| EXP-1423 | `apps/extension/src/background/modules/shared.ts:17` | `buildCtx` |
| EXP-1424 | `apps/extension/src/background/modules/tokens.ts:13` | `handlers` |
| EXP-1425 | `apps/extension/src/background/modules/swap.ts:4` | `handlers` |
| EXP-1426 | `apps/extension/src/background/modules/market.ts:22` | `handlers` |
| EXP-1427 | `apps/extension/src/background/modules/settingsCore.ts:10` | `handlers` |
| EXP-1428 | `apps/extension/src/background/handlers/ramps.ts:36` | `handlers` |
| EXP-1429 | `apps/extension/src/background/handlers/walletconnect.ts:9` | `handlers` |
| EXP-1430 | `apps/extension/src/background/handlers/earn.ts:362` | `handlers` |
| EXP-1431 | `apps/extension/src/background/handlers/kitEvents.ts:10` | `CONFIG_ANNOUNCEMENTS_KEY` |
| EXP-1432 | `apps/extension/src/background/handlers/kitEvents.ts:14` | `applyRemoteConfig` |
| EXP-1433 | `apps/extension/src/background/handlers/kitEvents.ts:26` | `handlers` |
| EXP-1434 | `apps/extension/src/background/handlers/settingsExtra.ts:10` | `handlers` |
| EXP-1435 | `apps/extension/src/background/handlers/smartAccount.ts:6` | `handlers` |
| EXP-1436 | `apps/extension/src/background/handlers/perps.ts:172` | `handlers` |
| EXP-1437 | `apps/extension/src/background/handlers/chainData.ts:16` | `MAX_CHAIN_TOKENS` |
| EXP-1438 | `apps/extension/src/background/handlers/chainData.ts:18` | `readChainTokens` |
| EXP-1439 | `apps/extension/src/background/handlers/chainData.ts:26` | `handlers` |
| EXP-1440 | `apps/extension/src/background/handlers/secrets.ts:34` | `consumeRevealGrant` |
| EXP-1441 | `apps/extension/src/background/handlers/secrets.ts:85` | `handlers` |
| EXP-1442 | `apps/extension/src/background/handlers/earnKeys.ts:8` | `activeInfo` |
| EXP-1443 | `apps/extension/src/background/handlers/earnKeys.ts:15` | `earnAvailability` |
| EXP-1444 | `apps/extension/src/background/handlers/earnKeys.ts:23` | `withCoinKey<T>` |
| EXP-1445 | `apps/extension/src/background/handlers/earnEvm.ts:9` | `evmClientFor` |
| EXP-1446 | `apps/extension/src/background/handlers/earnEvm.ts:16` | `feeData` |
| EXP-1447 | `apps/extension/src/background/handlers/earnEvm.ts:21` | `estimateCall` |
| EXP-1448 | `apps/extension/src/background/handlers/earnEvm.ts:26` | `estimatePlan` |
| EXP-1449 | `apps/extension/src/background/handlers/earnEvm.ts:34` | `runPlan` |
| EXP-1450 | `apps/extension/src/background/handlers/testnetDefi.ts:96` | `handlers` |
| EXP-1451 | `apps/extension/src/background/handlers/ledger.ts:10` | `LEDGER_DEFAULT_PATHS` |
| EXP-1452 | `apps/extension/src/background/handlers/ledger.ts:12` | `handlers` |
| EXP-1453 | `apps/extension/src/background/handlers/discover.ts:16` | `handlers` |
| EXP-1454 | `apps/extension/src/background/handlers/index.ts:30` | `allExtraHandlers` |
| EXP-1455 | `apps/extension/src/background/handlers/index.ts:31` | `runExtraHandler` |
| EXP-1456 | `apps/extension/src/background/handlers/approvals.ts:26` | `knownSpenders` |
| EXP-1457 | `apps/extension/src/background/handlers/approvals.ts:45` | `handlers` |
| EXP-1458 | `apps/extension/src/background/handlers/provider.ts:27` | `handlers` |
| EXP-1459 | `apps/extension/src/background/handlers/onboardingExtra.ts:27` | `_pendingCount` |
| EXP-1460 | `apps/extension/src/background/handlers/onboardingExtra.ts:38` | `dropVaultKeys` |
| EXP-1461 | `apps/extension/src/background/handlers/onboardingExtra.ts:57` | `persistImportedWallet` |
| EXP-1462 | `apps/extension/src/background/handlers/onboardingExtra.ts:108` | `handlers` |
| EXP-1463 | `apps/extension/src/background/handlers/predictions.ts:128` | `handlers` |
| EXP-1464 | `apps/extension/src/background/handlers/chainSend.ts:90` | `handlers` |
| EXP-1465 | `apps/extension/src/background/handlers/nfts.ts:226` | `handlers` |
| EXP-1466 | `apps/extension/src/background/kernel/events.ts:8` | `eventName` |
| EXP-1467 | `apps/extension/src/background/kernel/events.ts:10` | `registerEvent` |
| EXP-1468 | `apps/extension/src/background/kernel/events.ts:15` | `registerEvents` |
| EXP-1469 | `apps/extension/src/background/kernel/events.ts:18` | `hasEvent` |
| EXP-1470 | `apps/extension/src/background/kernel/events.ts:19` | `listEvents` |
| EXP-1471 | `apps/extension/src/background/kernel/events.ts:22` | `stripExternalFlags<T extends Record<string, any>>` |
| EXP-1472 | `apps/extension/src/background/kernel/events.ts:28` | `dispatchEvent` |
| EXP-1473 | `apps/extension/src/background/kernel/boot.ts:6` | `BOOT_MAX_ATTEMPTS` |
| EXP-1474 | `apps/extension/src/background/kernel/boot.ts:7` | `BOOT_RETRY_MS` |
| EXP-1475 | `apps/extension/src/background/kernel/boot.ts:16` | `bootWith` |
| EXP-1476 | `apps/extension/src/background/kernel/boot.ts:27` | `selfHeal` |
| EXP-1477 | `apps/extension/src/background/kernel/boot.ts:39` | `queue` |
| EXP-1478 | `apps/extension/src/background/kernel/port.ts:10` | `onUiOpenChange` |
| EXP-1479 | `apps/extension/src/background/kernel/port.ts:23` | `servePort` |
| EXP-1480 | `apps/extension/src/background/settingsService.ts:11` | `LOCK_ALARM` |
| EXP-1481 | `apps/extension/src/background/settingsService.ts:17` | `loadSettings` |
| EXP-1482 | `apps/extension/src/background/settingsService.ts:21` | `rateStore` |
| EXP-1483 | `apps/extension/src/background/settingsService.ts:25` | `cachedRate` |
| EXP-1484 | `apps/extension/src/background/settingsService.ts:32` | `armLockTimer` |
| EXP-1485 | `apps/extension/src/background/settingsService.ts:37` | `clearLockTimer` |
| EXP-1486 | `apps/extension/src/background/settingsService.ts:40` | `sidePanelSupported` |
| EXP-1487 | `apps/extension/src/background/settingsService.ts:41` | `applySidePanel` |
| EXP-1488 | `apps/extension/src/background/settingsService.ts:48` | `saveSettings` |
| EXP-1489 | `apps/extension/src/background/store/slices.ts:7` | `app` |
| EXP-1490 | `apps/extension/src/background/store/slices.ts:8` | `approvals` |
| EXP-1491 | `apps/extension/src/background/store/slices.ts:9` | `asset` |
| EXP-1492 | `apps/extension/src/background/store/slices.ts:10` | `blockchains` |
| EXP-1493 | `apps/extension/src/background/store/slices.ts:11` | `dapps` |
| EXP-1494 | `apps/extension/src/background/store/slices.ts:12` | `fiat` |
| EXP-1495 | `apps/extension/src/background/store/slices.ts:13` | `migration` |
| EXP-1496 | `apps/extension/src/background/store/slices.ts:14` | `migrations` |
| EXP-1497 | `apps/extension/src/background/store/slices.ts:15` | `nft` |
| EXP-1498 | `apps/extension/src/background/store/slices.ts:16` | `notification` |
| EXP-1499 | `apps/extension/src/background/store/slices.ts:17` | `sdkFeatureSlice` |
| EXP-1500 | `apps/extension/src/background/store/slices.ts:18` | `settings` |
| EXP-1501 | `apps/extension/src/background/store/slices.ts:19` | `staking` |
| EXP-1502 | `apps/extension/src/background/store/slices.ts:20` | `swap` |
| EXP-1503 | `apps/extension/src/background/store/slices.ts:21` | `tx` |
| EXP-1504 | `apps/extension/src/background/store/slices.ts:23` | `live` |
| EXP-1505 | `apps/extension/src/background/store/slices.ts:24` | `wallet` |
| EXP-1506 | `apps/extension/src/background/store/slices.ts:29` | `reducers` |
| EXP-1507 | `apps/extension/src/background/store/slices.ts:30` | `actions` |
| EXP-1508 | `apps/extension/src/background/store/migrations.ts:8` | `PRE_MIGRATIONS` |
| EXP-1509 | `apps/extension/src/background/store/migrations.ts:12` | `POST_MIGRATIONS` |
| EXP-1510 | `apps/extension/src/background/store/migrations.ts:14` | `readStore` |
| EXP-1511 | `apps/extension/src/background/store/migrations.ts:20` | `runMigrations` |
| EXP-1512 | `apps/extension/src/background/store/index.ts:11` | `store` |
| EXP-1513 | `apps/extension/src/background/store/index.ts:19` | `hydrateStore` |
| EXP-1514 | `apps/extension/src/background/store/sync.ts:7` | `initStoreFromVault` |
| EXP-1515 | `apps/extension/src/background/store/sync.ts:25` | `syncStore` |
| EXP-1516 | `apps/extension/src/kit/clients/securityClient.ts:5` | `checkToken` |
| EXP-1517 | `apps/extension/src/kit/clients/securityClient.ts:8` | `checkAddress` |
| EXP-1518 | `apps/extension/src/kit/clients/securityClient.ts:13` | `simulateCall` |
| EXP-1519 | `apps/extension/src/kit/clients/priceClient.ts:8` | `getPrices` |
| EXP-1520 | `apps/extension/src/kit/remoteConfig.ts:14` | `EMPTY_CONFIG` |
| EXP-1521 | `apps/extension/src/kit/remoteConfig.ts:18` | `verifySignature` |
| EXP-1522 | `apps/extension/src/kit/remoteConfig.ts:26` | `parseConfig` |
| EXP-1523 | `apps/extension/src/kit/remoteConfig.ts:43` | `refreshConfig` |
| EXP-1524 | `apps/extension/src/kit/endpoints.ts:6` | `GATEWAY_URL: string` |
| EXP-1525 | `apps/extension/src/kit/endpoints.ts:7` | `CONFIG_URL: string` |
| EXP-1526 | `apps/extension/src/kit/endpoints.ts:8` | `CONFIG_PUBLIC_KEY: string` |
| EXP-1527 | `apps/extension/src/kit/lastKnown.ts:10` | `withLastKnown<T>` |
| EXP-1528 | `apps/extension/src/kit/providers/geckoterminal.ts:7` | `GT_BASE` |
| EXP-1529 | `apps/extension/src/kit/providers/geckoterminal.ts:9` | `GT_NETWORK` |
| EXP-1530 | `apps/extension/src/kit/providers/geckoterminal.ts:14` | `gtChainOf` |
| EXP-1531 | `apps/extension/src/kit/providers/geckoterminal.ts:24` | `gtToken` |
| EXP-1532 | `apps/extension/src/kit/providers/geckoterminal.ts:32` | `gtChart` |
| EXP-1533 | `apps/extension/src/kit/providers/geckoterminal.ts:41` | `gtTrendingPools` |
| EXP-1534 | `apps/extension/src/kit/providers/defillama.ts:4` | `defillamaPrices` |
| EXP-1535 | `apps/extension/src/kit/providers/goplus.ts:6` | `tokenRisk` |
| EXP-1536 | `apps/extension/src/kit/providers/goplus.ts:20` | `addressRisk` |
| EXP-1537 | `apps/extension/src/kit/providers/polymarket.ts:4` | `pmMarkets` |
| EXP-1538 | `apps/extension/src/kit/providers/hyperliquid.ts:5` | `hlMeta` |
| EXP-1539 | `apps/extension/src/kit/providers/hyperliquid.ts:6` | `hlMids` |
| EXP-1540 | `apps/extension/src/kit/providers/hyperliquid.ts:7` | `hlState` |
| EXP-1541 | `apps/extension/src/kit/providers/hyperliquid.ts:8` | `hlOpenOrders` |
| EXP-1542 | `apps/extension/src/kit/providers/coingecko.ts:3` | `coingeckoPrices` |
| EXP-1543 | `apps/extension/src/kit/failover.ts:3` | `setKilledProviders` |
| EXP-1544 | `apps/extension/src/kit/failover.ts:4` | `isKilled` |
| EXP-1545 | `apps/extension/src/kit/failover.ts:9` | `failover<T>` |
| EXP-1546 | `apps/extension/src/kit/failover.ts:19` | `race<T>` |
| EXP-1547 | `apps/extension/src/kit/failoverFetch.ts:36` | `invalidatePools` |
| EXP-1548 | `apps/extension/src/kit/failoverFetch.ts:56` | `makeFailoverFetch` |
| EXP-1549 | `apps/extension/src/kit/failoverFetch.ts:98` | `installFailoverFetch` |
| EXP-1550 | `apps/extension/src/kit/evmTransport.ts:10` | `nodesFor` |
| EXP-1551 | `apps/extension/src/kit/evmTransport.ts:17` | `evmTransport` |
| EXP-1552 | `apps/extension/src/kit/netStatus.ts:10` | `recordNet` |
| EXP-1553 | `apps/extension/src/kit/netStatus.ts:14` | `markStale` |
| EXP-1554 | `apps/extension/src/kit/netStatus.ts:16` | `netStatus` |
| EXP-1555 | `apps/extension/src/kit/netStatus.ts:26` | `resetNetStatus` |
| EXP-1556 | `apps/extension/src/kit/nodeRepository.ts:5` | `NodeRepository {` |
| EXP-1557 | `apps/extension/src/kit/httpClient.ts:14` | `HttpClient {` |
| EXP-1558 | `apps/extension/src/kit/httpClient.ts:67` | `http` |
| EXP-1559 | `apps/extension/src/kit/gateway.ts:7` | `getDeviceId` |
| EXP-1560 | `apps/extension/src/kit/gateway.ts:14` | `gatewayEnabled` |
| EXP-1561 | `apps/extension/src/kit/gateway.ts:16` | `gatewayJson<T` |
| EXP-1562 | `apps/extension/src/integrations/testnet-defi/abis.ts:3` | `tokenAbi` |
| EXP-1563 | `apps/extension/src/integrations/testnet-defi/abis.ts:9` | `poolAbi` |
| EXP-1564 | `apps/extension/src/integrations/testnet-defi/abis.ts:15` | `dataAbi` |
| EXP-1565 | `apps/extension/src/integrations/testnet-defi/abis.ts:19` | `wethAbi` |
| EXP-1566 | `apps/extension/src/integrations/testnet-defi/broadcast.ts:19` | `broadcastSigned` |
| EXP-1567 | `apps/extension/src/integrations/testnet-defi/plans.ts:2` | `ReviewStore<T extends { expiresAt: number; owner: string }> ` |
| EXP-1568 | `apps/extension/src/integrations/testnet-defi/rpc.ts:7` | `tokenAddress` |
| EXP-1569 | `apps/extension/src/integrations/testnet-defi/rpc.ts:11` | `sameAddress` |
| EXP-1570 | `apps/extension/src/integrations/testnet-defi/rpc.ts:12` | `readToken` |
| EXP-1571 | `apps/extension/src/integrations/testnet-defi/rpc.ts:21` | `approvals` |
| EXP-1572 | `apps/extension/src/integrations/testnet-defi/aave.ts:9` | `reserveFlags` |
| EXP-1573 | `apps/extension/src/integrations/testnet-defi/aave.ts:16` | `supplyApy` |
| EXP-1574 | `apps/extension/src/integrations/testnet-defi/aave.ts:19` | `reserve` |
| EXP-1575 | `apps/extension/src/integrations/testnet-defi/aave.ts:41` | `listEarnAssets` |
| EXP-1576 | `apps/extension/src/integrations/testnet-defi/aave.ts:47` | `prepareEarn` |
| EXP-1577 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:21` | `AAVEKIT_URL` |
| EXP-1578 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:23` | `EARN_PROVIDER: 'aavekit' | 'onchain'` |
| EXP-1579 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:24` | `NATIVE_TOKEN` |
| EXP-1580 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:31` | `aaveGateway` |
| EXP-1581 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:32` | `gatewayAbi` |
| EXP-1582 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:38` | `AaveKitUnavailable extends Error {}` |
| EXP-1583 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:49` | `aaveKitQuery<T>` |
| EXP-1584 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:118` | `listEarnAssetsKit` |
| EXP-1585 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:139` | `verifyKitTx` |
| EXP-1586 | `apps/extension/src/integrations/testnet-defi/aavekit.ts:174` | `prepareEarnKit` |
| EXP-1587 | `apps/extension/src/integrations/testnet-defi/client.ts:9` | `DEFI_MULTICALL` |
| EXP-1588 | `apps/extension/src/integrations/testnet-defi/client.ts:11` | `defiClient` |
| EXP-1589 | `apps/extension/src/integrations/testnet-defi/universalRouter.ts:38` | `checkUniversalRouterSwap` |
| EXP-1590 | `apps/extension/src/integrations/testnet-defi/config.ts:2` | `DEFI_CONFIG` |
| EXP-1591 | `apps/extension/src/integrations/testnet-defi/config.ts:3` | `testnetDefiEnabled` |
| EXP-1592 | `apps/extension/src/integrations/testnet-defi/config.ts:7` | `SEPOLIA` |
| EXP-1593 | `apps/extension/src/integrations/testnet-defi/config.ts:27` | `BASE_SEPOLIA` |
| EXP-1594 | `apps/extension/src/integrations/testnet-defi/config.ts:33` | `PLAN_TTL_MS` |
| EXP-1595 | `apps/extension/src/integrations/testnet-defi/config.ts:34` | `SWAP_BASES` |
| EXP-1596 | `apps/extension/src/integrations/testnet-defi/config.ts:35` | `assertTestnetNetwork` |
| EXP-1597 | `apps/extension/src/integrations/testnet-defi/config.ts:38` | `aaveDeployment` |
| EXP-1598 | `apps/extension/src/integrations/testnet-defi/uniswap.ts:23` | `swapCatalog` |
| EXP-1599 | `apps/extension/src/integrations/testnet-defi/uniswap.ts:29` | `minimumOutput` |
| EXP-1600 | `apps/extension/src/integrations/testnet-defi/uniswap.ts:35` | `prepareSwap` |
| EXP-1601 | `apps/extension/src/integrations/testnet-defi/uniswap.ts:100` | `uniswapError` |
| EXP-1602 | `apps/extension/src/integrations/testnet-defi/uniswap.ts:125` | `prepareWrap` |
| EXP-1603 | `apps/extension/src/inpage/ethereum.ts:7` | `HarbourEthereum extends Emitter {` |
| EXP-1604 | `apps/extension/src/inpage/emitter.ts:3` | `Emitter {` |
| EXP-1605 | `apps/extension/src/inpage/emitter.ts:18` | `ProviderRpcError extends Error {` |
| EXP-1606 | `apps/extension/src/inpage/bridge.ts:10` | `Bridge {` |
| EXP-1607 | `apps/extension/src/inpage/multi.ts:28` | `HarbourKeplr extends Base {` |
| EXP-1608 | `apps/extension/src/inpage/multi.ts:69` | `registerSuiWallet` |
| EXP-1609 | `apps/extension/src/inpage/multi.ts:104` | `HarbourAptos extends Base {` |
| EXP-1610 | `apps/extension/src/inpage/multi.ts:133` | `HarbourTron extends Base {` |
| EXP-1611 | `apps/extension/src/inpage/multi.ts:161` | `HarbourBitcoin extends Base {` |
| EXP-1612 | `apps/extension/src/inpage/multi.ts:179` | `HarbourTon extends Base {` |
| EXP-1613 | `apps/extension/src/inpage/solana.ts:10` | `SolPublicKey {` |
| EXP-1614 | `apps/extension/src/inpage/solana.ts:34` | `HarbourSolana extends Emitter {` |
| EXP-1615 | `apps/extension/src/inpage/solana.ts:77` | `HARBOUR_ICON` |
| EXP-1616 | `apps/extension/src/inpage/solana.ts:78` | `registerWalletStandard` |

Unmapped entries: none.
