# Harbour Wallet — security model and release review

## Trust boundaries
- **Keys** exist only in the background service worker. They are derived from the encrypted keystore with the session password, used for one operation and then wiped.
  - Keystore format: wallet-core `StoredKey`, AES-128-CTR.
  - The popup never imports vault, key or wallet-core code; `test/boundaries.test.js` enforces this.
  - `chrome.storage.session` keeps its default trusted-contexts access level, so content scripts cannot read it.
- **UI ↔ worker**: every runtime message goes through `isInternalWalletSender`, which accepts only this extension's own pages. There is no `externally_connectable` key and no `onMessageExternal` listener.
- **dApps** reach the wallet only through the provider port (inpage → content script → background).
  - The page origin comes from the browser (`sender`), never from the page.
  - The inpage and content scripts do a fresh nonce handshake on each page load.
  - Each origin's approval requests are rate-limited.
  - Every signature and transaction waits for an approval window. That window shows decoded calldata, simulated balance changes, and site and address risk.
- **Secrets on servers**: provider API keys live only in harbour-gateway, as Worker secrets. The bundle secret scan in `scripts/verify.mjs` fails the build if a key value appears in the bundle.
- **Session keys**:
  - The Hyperliquid agent key and the Polymarket API credentials are stored encrypted with the wallet password.
  - The agent key cannot withdraw funds.
  - Ledger wallets store public addresses and derivation paths only.

## Phase 8 hardening (2026-10-21)
**Phishing and risk checks**
- MetaMask `eth-phishing-detect` plus ScamSniffer domains for sites.
- ScamSniffer scam addresses and GoPlus address reputation, used for dApp transaction targets, approval spenders and send recipients.
- GoPlus token risk on swap buy tokens.
- All checks are advisory. If a list is unavailable, the UI says so rather than claiming the site or address is safe.

**Transaction previews**
- `eth_simulateV1` with `traceTransfers` produces the estimated balance changes (native, ERC-20, NFTs) on the approval screen.
- `eth_estimateGas` stays the revert check where simulation is not supported.

**Approval scanner**
- Settings › Security › Token approvals: GoPlus approval security, verified with on-chain `allowance()` reads, and a one-tap revoke (`approve(spender, 0)`).

**Permissions**
- Removed `tabs`. The active-tab URL used by the connected-site indicator is already covered by host permissions.
- Kept: `alarms` (auto-lock, config refresh, activity watcher), `storage`, `notifications`, `gcm` (server push), `scripting` (registering the provider content scripts at runtime), `sidePanel` and `clipboardWrite` (copy address).
- Host access (`https://*/*`) is needed to inject the dApp provider and for the chain RPCs and APIs.

**CSP**
- `extension_pages`: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.
- No remote code, no `eval` or `new Function`, no `innerHTML` (React only).
- `wasm-unsafe-eval` is needed for wallet-core.

**Dependencies**
- `npm audit --omit=dev`: 0 critical, 0 high, 0 moderate, 9 low.
- Upgrades: `@mysten/sui` 1.45.2 and `@ledgerhq/hw-app-eth` 7.11.0.
- Overrides: `axios` 1.20.0 and `ws` 8.22.0.

**Reproducible builds**
- `node scripts/repro.mjs` builds twice and compares every file. Result: 139 files identical, deterministic zip identical.

**Signed releases**
- `node scripts/release.mjs` creates a deterministic zip, its SHA-256, an Ed25519 signature and per-file hashes.
- Verify with `node scripts/verify-release.mjs`.

## External review scope (to commission before public release)
1. **Vault**: password KDF parameters, keystore handling, auto-lock, passkey and biometric unlock, and reveal-phrase gating (`core/vaultService.ts`, `core/passworder.ts`, `background/keys.ts`, `core/passkeyService.ts`).
2. **Provider**: origin binding, the handshake, the pending queue and settle, the per-namespace signing paths (EVM, Solana, multi-chain) and the approval view (`background/provider/*`, `src/inpage`, `src/content`).
3. **Signing correctness**: PSBT, TON proof, Hyperliquid, Polymarket and Ledger verification (tests contain the vectors).
4. **Gateway**: allowlists, rate limiting, push registration (`gateway/*`).

## Reporting
Report vulnerabilities privately to the maintainers. Do not open public issues for security bugs.
