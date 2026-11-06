# NN=38 Onboarding, Settings, Theme: status

Legend: Real = implemented and unit-tested or type-checked; Partial = implemented, a part is unverified or limited; Gap = not done.
All network paths (Solana history/balances, camera, WebAuthn) are **live-unverified**: unit tests use mocked fetch; no Chrome run was made.

## Onboarding (OB-001..OB-027)
| ID | Item | Status | Notes |
|---|---|---|---|
| OB-001 | Welcome + terms (first wallet) | Real | Terms hidden for additional wallets |
| OB-002 | Authentication choice (password / biometrics) | Real | existing flow kept |
| OB-003 | Password create | Real | |
| OB-004 | Biometrics create | Partial | existing; WebAuthn live-unverified |
| OB-005 | Import source list | Real | |
| OB-006 | Trust Wallet method (QR / phrase) | Real | |
| OB-007 | Secret input, phrase vs key detection (>8 chars single token) | Real | core/importKey, tested |
| OB-008 | Wallet name + duplicate-name rule | Real | tested |
| OB-009 | Private-key network picker (search, empty state, EVM group) | Real | tested option logic |
| OB-010 | Key validation per curve | Real | secp256k1 hex, ed25519 base58 tested with wallet-core |
| OB-011 | Private-key import with aes128Ctr | Real | keystore round-trip tested; signing path patched in keys.ts/index.ts, not exercised end-to-end |
| OB-012 | Solana derivation choice with balances | Partial | choice logic tested; balances via public RPC live-unverified |
| OB-013 | Import instructions carousel | Partial | original icons instead of TW GIFs |
| OB-014 | QR scanner (getUserMedia + jsQR, 80 ms, errors, track stop) | Partial | camera not run in a browser |
| OB-015 | UR multi-frame decode | Real | core/qrSync tested |
| OB-016 | Encryption-code screen + decrypt | Real | decryptStoredKeys tested incl. private-key key; `sk.account(0).coin()` path only partly confirmed |
| OB-017 | Passkey setup flow (?flow=SET_PASSKEY) | Partial | reuses BiometricEnroll; unverified live |
| OB-018 | Wallet limit 30 | Real | tested; enforced in addWallet/importComplete |
| OB-019 | Additional-wallet mode (no terms/auth) | Real | onboardingMode tested; UI not browser-run |
| OB-020 | Duplicate wallet / key rejection | Real | tested |
| OB-021 | Idle timeout 600000/500 ms | Real | tested |
| OB-022 | Interrupted setup / reload recovery | Real | resetEmptyVault + restoreStep tested |
| OB-023 | Backup verification flow | Real | backupVerify tested; wired in onboarding tab and in-wallet `backup` |
| OB-024 | Ledger import entry | Partial | routes to `importLedger` when another worker registers it; fallback message otherwise |
| OB-025 | Completed screen | Real | existing |
| OB-026 | Locked-vault unlock gate | Real | |
| OB-027 | Max-wallets blocked screen | Real | |

## Settings routes
| Route | Status | Notes |
|---|---|---|
| settings (main) | Real | Notifications + Developer rows added |
| settingsSecurity / AutoLock / Biometrics | Real | migration row added |
| settingsPrefs | Real | hide-balances toggle added |
| settingsLanguage / Currency / ColorMode | Real | error/busy states added |
| settingsNotifications | Partial | preferences stored; no push delivery exists |
| settingsDeveloper | Real | testnets toggle (via hidden assets), flags, custom RPC link, DEVELOPER_SECTIONS |
| settingsFaucets | Real | 8 links, https-checked |
| customNetworks (per-chain RPC override) | Real | pre-existing, linked |
| walletSelector / manageWallets | Real | grouped by kind, no Add account for private-key |
| editWallet (wallet detail) | Real | rename, backup, reveal private key, remove |
| settingsWalletAccounts | Real | |
| accountDetail | Real | all network addresses |
| settingsHardwareWallet | Partial | placeholder |
| migrationSelectSource/Destination/Assets | Partial | real balances (public RPC, live-unverified); hands off to `send` |
| addWallet / backup overrides | Real | |
| about/help | n/a | other worker |

## Theme
Onboarding CSS and system.css tokenised (light+dark tokens); Wallet.tsx header shows real wallet name; token swaps across wallet screens. Not visually audited in a browser. A few decorative gradients remain.

## Deviations / dependencies
- Import-instruction GIF art replaced by original icons.
- Send screen must honour params `{assetId, to, isMax, migration}`; not verified.
- Push notifications have no backend.
- Faucet chain ids are labels only.
