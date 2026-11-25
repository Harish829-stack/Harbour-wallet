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
