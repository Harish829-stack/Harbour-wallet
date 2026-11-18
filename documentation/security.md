# Security

Current security model, what has been audited and fixed, what is still open, and how to report problems. Treat the code as the source of truth; this page describes intent and status. Historical audit working files are kept out of the repository (see the end of this page).

## Trust boundaries

- **Keys exist only in the extension's background service worker.** They are derived from the encrypted keystore with the session password, used for one operation and wiped. The popup never imports vault, key or wallet-core code (`test/boundaries.test.js` enforces it) and every worker response passes the `uiSafe` filter. Secret phrases and private keys reach the screen only as images or opaque chips rendered by the worker; the clipboard is written from an offscreen page and wiped after 60 s.
- **Vault.** Argon2id (46 MiB, t=2) → HKDF → AES-256-GCM. Unlock attempts are throttled through a module-level serial queue. Vault, KDF record, keystores and the biometric seal live in extension-origin IndexedDB; `chrome.storage.local` is pinned to trusted contexts.
- **Biometrics.** Platform authenticator with WebAuthn PRF only; devices without PRF fall back to the password. Enrolment needs the password. Every wallet has a password.
- **Re-authentication.** Adding or importing a wallet, backup and reveal, removing a wallet and weakening settings need a fresh password or biometric check (one-shot grants for `reveal`, `addWallet`, `manage`, cleared on lock). Seed reveal is a 1.2 s press-and-hold, auto-hidden after 60 s or on blur; QR import stages expire after 5 minutes or 5 wrong codes.
- **UI ↔ worker.** Only the extension's own pages may call wallet commands (`isInternalWalletSender`). There is no `externally_connectable` and no `onMessageExternal`.
- **dApps** reach the wallet only through the provider port (inpage → content script → worker). The origin comes from the browser, never the page; each page load does a nonce handshake; requests are rate-limited per origin; every signature waits for an approval window. Approve buttons arm after 800 ms and disarm on blur. Phishing-listed sites are blocked (the user must type the host to continue); site-requested network switches need approval; WalletConnect permissions are kept apart from the real site's; request-scoped chains stop one session moving another request's chain.
- **Approval previews.** Decoded calldata, hidden-approval detection, simulated balance changes (EVM `eth_simulateV1` with backend fallback, Solana SPL diffs), address and token risk lists. Lists are advisory; when one is unavailable the UI says so. `eth_sign` is off by default.
- **Content Security Policy.** `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`, Trusted Types required, no remote code, no `eval`, no `innerHTML`.
- **Backend.** Ed25519 device-signed requests with single-use nonces, proof-of-work registration, quotas with a probation tier, per-service least-privilege database and NATS logins, encrypted device-to-address links, per-service secrets only, an SSRF-safe media proxy, an allow-listed and size-capped RPC proxy, a validated third-party gateway, TLS-verified database connections. Detail in [backend-services.md](backend-services.md).
- **Supply chain.** Install scripts disabled, pinned dependencies, `npm audit` gate with dated exceptions (`audit-exceptions.json`), `govulncheck` and `gosec` in CI, SBOM, reproducible builds, signed releases, pre-commit and CI secret scanning (gitleaks).
- **Self-custody only.** Harbour never holds user funds. Swap, trading and staking fees may be charged, as in comparable wallets.

## What has been audited and fixed

| Round | Scope | Outcome |
| --- | --- | --- |
| L1-L3 audit, 2026-10-28/30 | 139 controls against the Extension Wallet Security Audit Framework; static review of extension and backend | 17 findings fixed in code, 1 mostly fixed, HW-2026-002 (secret rotation) and HW-2026-015 (service-to-service TLS) need operator action |
| Pentest PT-01..PT-12, 2026-11-03 | extension: create/import, export, unlock, signing, dApp, WalletConnect | all 12 fixed with regression tests |
| Seed typing and reveal, 2026-11-04 | threat model for typing and revealing secrets | six mitigations; no extension can stop screenshots or keyloggers, QR or Ledger import is the real defence |
| Attacker review A1..A9, 2026-11-04 | extension and gateway | A1-A8 closed (A7 was a false positive); A9 is key hygiene |
| Review fixes, 2026-11-16 | SIG-11 WalletConnect chain, Earn plan locking, balance previews, Ledger pairing | all fixed with tests |
| Security audit, first pass, 2026-11-16 | whole repository: extension, backend, CI, deployment images (static review; extension tests and build run) | findings 1-20: approval-screen hidden characters, CI permissions and pinning, cache Redis password and more fixed; 9-19 open or operator actions |
| Security audit, second pass, 2026-11-16/17 | backend built, run and attacked; production extension build run in Chromium and attacked from a test page | findings 21-25 fixed with tests (log-filter guard bypass, registration lock-out, failed-authentication limit, device ids in counters, `NAME_FILE` loading); **26 open and waiting for owner approval**; 27-29 recorded |

The 2026-11-16/17 audit is recorded finding by finding in [SECURITY_FINDINGS.md](../SECURITY_FINDINGS.md) (table, commits, what was and was not verified) and [SECURITY_EXPLAINED.md](../SECURITY_EXPLAINED.md) (plain language). Those two files are the detailed record; this page is the summary.

Re-run a full control-by-control audit before a public release.

## Open items

**Fixed (finding 26, High):** the fee the user approved now alone decides the transaction type and every fee value in `evmSendTransaction` (a site's own `gasPrice`, `maxFeePerGas`, `maxPriorityFeePerGas` or `type` is ignored when an approved fee exists), and the approval screen computes its estimate from the wallet's own preset, so the screen and the signed transaction agree. Regression tests: `provider.test.js` (site asks 50,000 gwei, user approved 3 gwei) and `approval-preview.test.js`. A site that wants a higher fee (a speed-up) no longer gets it automatically; the user picks a faster level.

The rest need a person, not a code change:

1. **Rotate secrets.** Rotate every provider key and server secret ever kept in a local `.env`, including the Infura key that leaked in old v2 builds, and the Firebase admin key if the folder was ever synced. Production secrets should come from a secrets manager through `NAME_FILE` mounts.
2. **Release key.** Move `harbour-release-key.json` out of the working folder: put the Ed25519 PEM in the CI `release` environment secret `HB_RELEASE_KEY_PEM`, require two reviewers, set `HB_RELEASE_APPROVERS`, then securely delete the local file.
3. **Repository settings.** Branch protection on `main` (required checks, one review, no force push, signed commits); 2FA or hardware keys on GitHub and the Chrome Web Store accounts.
4. **Captured session tokens.** A DevTools capture containing session and device headers (`3novlog.3novlog`) was removed from the tree but still exists in git history; rewrite history and revoke those sessions.
5. **Service-to-service TLS.** Use a private network or mTLS between `api`, `rpc-gateway`, NATS and Centrifugo in production.
6. **Alerting.** Alert on `security_event` log lines (bursts of `auth_bad_signature`, `auth_replay`, `register_rate_limited`) and on gateway metrics.
7. **Go toolchain.** Keep `go.mod` on a patched Go release; `govulncheck` in CI reports standard-library advisories.
8. **Real devices.** Test Touch ID, Windows Hello and Ledger on hardware (matrix below).
9. **Independent assurance.** Third-party audit, penetration test, bug bounty and an incident-response drill have not happened yet. Do not ship mainnet signing publicly before them.
10. **Third-party data exposure (finding 27).** Bitcoin, Tron and Solana balance reads and some price reads go straight from the extension to public services, which see the user's IP address with that address. Route them through the backend gateway or state it in the privacy policy.

Known residual risks: new recovery phrases pass through a JavaScript string at creation (wallet-core returns them that way); the approval preview for some calls still depends on the backend, so cross-check high-value or unknown calls with an independent RPC; non-EVM approval decoding is weaker than EVM.

## Real-device test matrix

| Device | Cases |
| --- | --- |
| MacBook, Touch ID (Chrome Web Store build; passkeys are bound to the extension id) | enable biometrics; unlock; dApp sign after auto-lock; reveal and backup gate; wrong finger three times; cancel the sheet; password fallback; macOS without PRF shows the password-only message |
| Windows 11, Windows Hello (PIN, face or fingerprint) | same cases; Hello dialog behind the browser; PRF-less build falls back to password |
| Ledger Nano S+/X over USB | connect (opens a full tab); read ETH, BTC, SOL addresses; add wallet; send ETH and an ERC-20 with clear-signing and blind-signing off and on; send BTC; device locked; wrong app open; reject on device; unplug mid-sign; send from the popup with the device already paired and never paired |

## Reporting a vulnerability

Report privately to the maintainers. Do not open a public issue for a security bug.

## Where the old audit material went

The detailed audit working files (framework, per-control results, pentest and red-team reports, tool output) are no longer part of `documentation/`. They were git-ignored working files; the copies that were tracked remain in git history. Local-only copies are not in the repository folder any more (the `_to_delete/` folder they were moved to did not exist on 2026-11-16), so keep your own private copy if you still need them.

## Smart accounts (flag `smartAccounts`, default off)

The delegate (MetaMask Stateless7702), the DelegationManager, the caveat enforcers and the paymaster are pinned per chain in `core/smartAccount/constants.ts`. Crypto and encoding come from MetaMask's audited packages (see extension.md); the kit's analytics entry is never imported (test-enforced). Provider replies are read only through strict readers in `guard.ts` and the signed digest is always computed locally from the final operation. Keys are opened only inside `openActiveKeys()` and disposed right after signing; the frozen secure files are checked by `scripts/check-frozen.mjs` in `npm run verify`.

A dApp cannot enable, revoke or upgrade: those messages are UI-only. `wallet_sendCalls` needs the account already enabled and the user's approval; sponsorship is decided by the gateway-pinned policy and Pimlico, never by the site, and a refusal falls back to a user-paid operation (a reply that fails the guard signs nothing). Spending permissions (`wallet_requestExecutionPermissions`) are re-checked by the guard against the user-approved terms (delegate, native or ERC-20 allowance, expiry of at most 30 days, no calldata for native, nothing else) before signing; revoke is an on-chain `disableDelegation` by the user.

Not done before mainnet (P7): independent review of `guard.ts`, `send.ts` and the key adapter; mainnet pins and a per-chain byte-diff of the DelegationManager; kill-switch drill; a global cap on the sponsorship policy.
