# Harbour Wallet: security (single reference)

Last updated 2026-10-23. This file replaces `SECURITY-COMPARISON-TW-26.41.0.md`, `SECURITY-FINDINGS-REGISTER.md` and `TRUST-WALLET-SECURITY-IMPLEMENTATIONS.md`.

## Contents
1. Security model and hardening (what the wallet does today)
2. Review of 2026-10-23: summary and what you still need to do
3. Findings register (dApp, signing, backend, supply chain)
4. Secrets comparison with Trust Wallet 26.41.0 (vault, password, keystore)
5. Trust Wallet 26.41.0 implementation reference (what to copy, what to design alone)
6. External review scope
7. Reporting

## 1. Security model and hardening
### Trust boundaries
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

### Phase 8 hardening (2026-10-21)
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
- Added 2026-10-23: `idle` (lock the wallet when the operating system locks the screen).
- Kept: `alarms` (auto-lock, config refresh, activity watcher), `storage`, `notifications`, `gcm` (server push), `scripting` (registering the provider content scripts at runtime), `sidePanel` and `clipboardWrite` (copy address).
- Host access (`https://*/*`) is needed to inject the dApp provider and for the chain RPCs and APIs.

**CSP**
- `extension_pages`: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.
- No remote code, no `eval` or `new Function`, no `innerHTML` (React only).
- `wasm-unsafe-eval` is needed for wallet-core.

**Dependencies**
- Runtime dependencies `@noble/hashes`, `jsqr` and `@ngraveio/bc-ur` pinned to exact versions; the gateway deploy script pins `wrangler@4.151.2`.
- `npm audit --omit=dev`: 0 critical, 0 high, 0 moderate, 9 low.
- Upgrades: `@mysten/sui` 1.45.2 and `@ledgerhq/hw-app-eth` 7.11.0.
- Overrides: `axios` 1.20.0 and `ws` 8.22.0.

**Reproducible builds**
- `node scripts/repro.mjs` builds twice and compares every file. Result: 139 files identical, deterministic zip identical.

**Signed releases**
- `node scripts/release.mjs` creates a deterministic zip, its SHA-256, an Ed25519 signature and per-file hashes.
- Verify with `node scripts/verify-release.mjs`.

## 2. Review of 2026-10-23: summary
Seven fix steps were implemented and tested (full suite: 427 pass; the 2 failures, `onboarding-import` and `qrsync`, are sandbox file-deletion errors unrelated to the changes).

| Step | Area | Result |
|---|---|---|
| 1 | Signing screens | `eth_sign` refused unless the developer setting is on, then 32-byte hash only; Permit2 approve and router multicalls decoded, hidden approvals and unlimited allowances flagged |
| 2 | Swaps and bridges | LI.FI target/spender pinned to the Diamond and calldata decoded (receiver, min-out); Relay targets checked against Relay's own chain list; THORChain vault and router confirmed by 2 independent nodes, memo parsed in full |
| 3 | Solana | Lookup tables resolved; swap guard refuses authority/delegate/burn/freeze/close-to-other and extra SOL; dry-run simulation required; dApp transactions show warnings and the simulated SOL change |
| 4 | Send | Address-poisoning lookalike warning; Confirm screen plan fingerprint checked on submit |
| 5 | Networks | Site-supplied RPC is not contacted before approval; https only, no private hosts, no redirects |
| 6 | Bitcoin and Ledger | PSBT fee ceiling and previous-transaction cross-check; Ledger BTC outputs compared exactly |
| 7 | Backend and release | Gateway query cleaning; config signing key via env/stdin and 1-90 day config expiry; pinned release signer; pinned versions; lock on OS screen lock |

**Deferred (not done):** SIG-08 non-EVM decoding (Cosmos, Sui, Aptos, TON), SIG-11 per-request WalletConnect chain, SIG-14 Polymarket/Hyperliquid price and approval flow, SIG-09 (accepted), Earn-submit plan binding (second half of SIG-15), Ledger device-verified address flag, simulated token balance deltas, EVM swap balance-delta simulation.

**Your actions (these cannot be done from code):**
1. Rotate the leaked Sepolia Infura key and rebuild. Old zips (`releases/Harbour-root-fixed.zip`, `harbour-extension-final-beforeBackendSeperation.zip`) and `dist/` still contain it until rebuilt; delete the stale zips.
2. Redeploy the gateway: `node scripts/deploy-gateway.mjs` (fixes INF-03, 04, 05, 06, 13 are source-only until then).
3. Create `release-signer.pub` with your release public key (verify-release now refuses to run without a pinned signer).
4. Re-sign and republish the remote config at least monthly (it now expires; use `HARBOUR_CONFIG_KEY=... node scripts/config-tool.mjs sign config/config.json 30`).
5. Move the config and release signing keys, `harbour-keys.env` and the Firebase admin service account out of the shared project folder; rotate the Firebase key if the folder was ever synced or shared (finding F6).
6. Run Relay once live: the Relay target check reads `protocol.v2` from `https://api.relay.link/chains` and could not be tried from the build sandbox. If Relay swaps are refused, check that response shape.
7. Build with `npm ci --ignore-scripts` and review the 9 low `npm audit` items.

## 3. Findings register

Date 2026-10-23. Static review of `harbour-wallet-v2` (source, `dist/`, `gateway/`, `scripts/`) plus the Trust Wallet 26.41.0 bundle for comparison. Two focused reviews (signing paths; gateway/DOM/supply chain) plus a direct read of the dApp connection path. Findings marked **verified** were re-read in code by the lead reviewer; the rest are the reviewers' claims with file:line evidence. This is not a pentest and not a substitute for the external review listed in `SECURITY.md`.

Status: FIXED (code changed, regression test or build gate added), OPEN (needs decision/work), ACCEPT (documented risk).
"Redeploy"/"rebuild" means the fix is in source but not live until you redeploy the gateway or rebuild the extension.

### A. Fixed in this pass

| ID | Sev | Finding | Fix | Needs |
|---|---|---|---|---|
| INF-01 | High | Keyed Sepolia Infura RPC URL inlined from `.env` (`VITE_RPC_11155111`) into `dist/` and every release zip (**verified** in `dist/assets/settingsExtra-*.js`) | Moved the variable to `.env.development` (not loaded by production builds); `scripts/verify.mjs` now fails the build on Infura/Alchemy/Helius/Pimlico keyed URLs | **Rotate the Infura key**, rebuild, delete old zips |
| INF-03 | High | Gateway rate-limit key was the client-chosen `x-hb-device-id`, so one caller could mint unlimited buckets (**verified** `worker.ts`) | Key is now `cf-connecting-ip` only | Redeploy gateway. Still recommended: Cloudflare Rate Limiting / Durable Object limiter, count batch size, set `ALLOWED_ORIGINS` |
| INF-05 | Med | One malformed registration or upstream row aborted the whole push cron run before the offset was saved, stalling everyone (**verified** `push.ts`) | Per-registration try/catch | Redeploy gateway |
| INF-06 | Med | Push title used attacker-controlled token symbols ("Received 5000 USDT") | Symbol sanitized to `[A-Za-z0-9._-]` and tagged "(unverified token)" | Redeploy gateway |
| INF-09 | Low | dApp-supplied RPC URL was probed before approval, including LAN/metadata hosts | `isPrivateNetworkUrl` blocks RFC1918, link-local, CGNAT, IPv6 literals, `.local`; loopback still allowed | Open item: still probes before approval | **FIXED:** approval screen no longer contacts a site-supplied RPC; the probe runs only after approval, https-only, private hosts refused, redirects refused, credentials omitted; known chains keep the built-in registry entry; UI labels name/RPC as site-chosen.**
| INF-10 | Low | Remote logos loaded from arbitrary hosts with the extension referrer | `<meta name="referrer" content="no-referrer">` in the popup document | Rebuild |
| INF-13 | Low | Duplicate `module`/`action` query params could slip past the Etherscan allowlist | Exactly one of each required | Redeploy gateway |
| SIG-06 | Med | dApp Solana `signMessage` could sign serialized transaction bytes, producing a valid transaction signature | `looksLikeSolMessage` refuses bytes that parse as a transaction message; test added | Rebuild |
| SIG-12 | Low | EVM recipient/token address with a wrong mixed-case checksum was accepted | `strict` checksum validation in 4 places; test added | Rebuild |
| SIG-10 | Low | After a dApp-triggered auto-switch, the request was bound to the old chain, so the approved request always failed | Bind to the connection re-read after the switch | Rebuild |
| SIG-01/02 (partial) | High | Swap/bridge calldata from third-party APIs was not inspected | Any step whose calldata starts with transfer/transferFrom/approve/increaseAllowance/setApprovalForAll/permit/safeTransferFrom is rejected (LI.FI and Relay); test added | Full fix still open (see B) |

Earlier this session: unlock throttle serialized and `storage.session` pinned to trusted contexts (vault review).

### B. Open, ranked

| ID | Sev | Finding | Recommended fix |
|---|---|---|---|
| SIG-01 | High | LI.FI EVM swap: receiver and min-out come from the same API response; `tx.to`/`approvalAddress` not allowlisted (`core/swap/safety.ts`, `swapService.ts`) | Per-chain allowlist of router/spender; decode calldata for receiver = own address; require `eth_simulateV1` balance delta >= min-out | **FIXED (LI.FI):** `to` and spender must be the LI.FI Diamond (verified for chains 1/56/137/42161/8453); calldata decoded (swap receiver + min-out, BridgeData receiver/destination call/sold asset); unknown shapes fail closed. Not done: simulated balance delta (eth_simulateV1 is not widely available).**
| SIG-02 | High | Relay execute step accepts any `to` (only the dangerous selectors are now blocked) | Allowlist Relay router/solver per chain; decode expected selector | **FIXED (design):** Relay execute `to` and approve spender must be contracts listed by Relay's own /chains (fetched directly, not via the gateway); unverifiable = refused. Needs a live check that `protocol.v2` holds the depository/router (could not reach api.relay.link here).**
| SIG-03 | High | Jupiter / LI.FI-Solana transactions signed without instruction inspection; ALT lookups unresolved | Reuse `describeSolTx`; allowlist programs; reject delegate/authority instructions; simulate and check balance delta. Note Jupiter legitimately closes wSOL accounts and uses lookup tables, so this needs simulation, not a plain denylist | **FIXED:** lookup tables resolved before inspection; swap txs refused on authority/owner change, delegate, burn, freeze, close-to-other, SOL out beyond sell amount + rent, non-allowlisted program (Jupiter); dry-run simulation must succeed and not drain extra SOL (Jupiter + LI.FI-Solana).**
| INF-02 | Low | Stale release zips may embed key hooks | Delete `releases/Harbour-root-fixed.zip` and the `beforeBackendSeperation` zip |
| INF-04 | Med | Gateway KV cache keys include raw query strings (write amplification) | Whitelist and clamp `per_page`, `page`, etc. | **FIXED:** `cleanSearch` rebuilds bounded, validated, sorted query strings for GeckoTerminal and Alchemy NFT; junk params are refused (redeploy gateway).**
| INF-07 | Med | Config-signing key kept online next to the Cloudflare token; `config-tool sign` takes the key as argv | Keep offline/encrypted, read from stdin | **PARTLY FIXED:** `config-tool sign` takes the key from `HARBOUR_CONFIG_KEY` or stdin, never argv. Keeping the key offline is still your action.**
| INF-08 | Low | Signed remote config has no expiry; `killedProviders` can disable GoPlus and risk checks fail open silently | Add `issuedAt/expiresAt`; show "risk check unavailable" | **PARTLY FIXED:** signing tool stamps `issuedAt/expiresAt` (1-90 days, default 30) and the app rejects expired configs. Still open: a visible "risk check unavailable" state when a provider is killed. Re-sign and republish config at least monthly.**
| INF-11 | Low | `npx --yes wrangler@4` unpinned with Cloudflare token in env; three caret deps; 9 low `npm audit` items (elliptic/ethers v5/ledger chain); keccak has an install script | Pin exact versions, `npm ci --ignore-scripts` | **PARTLY FIXED:** wrangler pinned to 4.151.2; the three caret runtime deps pinned to installed versions. Still open: `npm ci --ignore-scripts` in your build, and the 9 low npm-audit items.**
| INF-12 | Low | `verify-release.mjs` verifies against the signer embedded in release.json | Pin the expected public key in the repo | **FIXED:** verify-release requires a pinned signer (`release-signer.pub`, `HARBOUR_RELEASE_PUBKEY` or argument) and fails if release.json disagrees. Action: create `release-signer.pub` with your public key.**
| SIG-04 | Med | Swap approval spender comes from the same untrusted API response; "unlimited" setting makes it `maxUint256` | Static per-chain spender allowlist | **FIXED:** spender checked against the same independent sources before any approve (LI.FI static, Relay /chains, THORChain nodes).**
| SIG-05 | Med | THORChain inbound vault/router not cross-checked across independent nodes | Cross-check two nodes; parse the full memo | **FIXED:** vault + router confirmed by >=2 independent THORNodes (halt flags respected); memo parsed in full (no affiliates, output asset must match).**
| SIG-07 | Med | `eth_sign` raw 32-byte hash blind-signing behind a checkbox | Disable unless an Advanced setting is on (MetaMask default) | **FIXED: setting now enforced (off by default), 32-byte hash only; tests added.**
| SIG-08 | Med | Cosmos/Sui/Aptos/TON transactions shown as types/bytes, not decoded recipients/amounts | Decode MsgSend/MsgDelegate and Tron contract calls; build-and-simulate for Sui/Aptos/TON | **DEFERRED:** needs per-chain decoders (Cosmos Msg, Sui/Aptos/TON build-and-simulate); large separate work.**
| SIG-09 | Low (downgraded) | WalletConnect identity is the peer's self-declared URL. Reviewed: an unverified proposal can no longer borrow an already-connected origin (guard exists in `onProposal`), but a spoofed origin that is not yet connected creates a permission record the real site then reuses | Key WC permissions as `wc:<origin>`; show Verify status on every request | **ACCEPTED (not changed):** already mitigated by the connected-origin guard and the Verify warning on every request; keying permissions as `wc:<origin>` needs a data-model migration.**
| SIG-11 | Low | WC requests rewrite the shared connection's chain | Per-session chain | **DEFERRED:** needs per-request chain plumbing through the provider service (shared connection chain is read in many places).**
| SIG-13 | Low | No address-poisoning (prefix/suffix lookalike) warning | Compare with history and address book | **FIXED:** recipient compared with sent history, contacts and own address; same start/end but different middle triggers a poisoning warning (contract-recipient warning already existed).**
| SIG-14 | Low | Polymarket max-price guard and unlimited pUSD approval; Hyperliquid 10% slippage | Pass confirmed price; exact approvals | **DEFERRED:** needs the Earn/Polymarket price and approval flow reworked.**
| SIG-15 | Low | Earn/send submit rebuilds the plan instead of binding to the previewed one | Hash the previewed plan, enforce fee cap | **FIXED (send):** Confirm screen gets a SHA-256 fingerprint of chain/from/to/asset/amount/memo; submit is refused if the rebuilt plan differs. Earn submit not changed.**
| SIG-16 | Low | Solana burn/freeze shown as "Token instruction #n"; no simulation of dApp Solana txs | Add warnings and simulation | **FIXED:** burn/freeze/nonce-authority described and warned; dApp Solana txs show resolved instructions, simulation result and estimated SOL change; failed dry run raises a warning. Token balance deltas are still not simulated.**
| SIG-17 | Low | Typed-data approval detection is name-based; Permit2 `approve` and router multicall shown as unknown | Detect by field shape and selector | **FIXED: Permit2 approve + multicall (0xac9650d8/5ae401dc/1f0464d1) now decoded, hidden approvals and unlimited allowances flagged, undecodable batch parts warned; tests added.**
| SIG-18 | Low | EVM keys handed to viem as hex strings (not zeroable) | Accept; reduce lifetime |
| SIG-19 | Low | Ledger add-wallet trusts popup-reported address; BTC Ledger output check is substring-based; PSBT fee display trusts foreign `witness_utxo` | Device-verified flag; strict output compare | **PARTLY FIXED:** PSBT: fee ceiling (0.01 BTC and 20% of inputs), non_witness_utxo must match amount/script, warnings for unknown amounts/scripts/foreign inputs/no change. Ledger BTC: exact output list comparison instead of substring. Still open: device-verified address flag at Ledger add-wallet.**
| INF-09b | Low | Probe still happens before the user approves `wallet_addEthereumChain` | Probe after approval | **FIXED:** approval screen no longer contacts a site-supplied RPC; the probe runs only after approval, https-only, private hosts refused, redirects refused, credentials omitted; known chains keep the built-in registry entry; UI labels name/RPC as site-chosen.**

### C. Checked and sound (verified)

- No signature without an approval window for sign/typed/tx/Solana/multi requests; displayed params are the signed params (`execute()` signs the pending record).
- Origin comes from the browser port (`senderOf`), per-frame; opaque frames refused; `documentId` binds responses to the right document; content script validates schema, method allowlist, event allowlist, size and prototype keys; internal API only for the exact popup URL.
- No `externally_connectable`, no `web_accessible_resources`, strict CSP, no `eval`/`innerHTML`, every `window.open` is https + `noopener`.
- Gateway: allowlisted methods and paths, no caller-controlled upstream host (no SSRF), error text not leaked, config signature (Ed25519) with downgrade check, wallet-core.wasm pinned by hash.
- The page-to-content handshake nonce is an anti-confusion measure, not a boundary against hostile page scripts; those already have the page's own authority, and every value-moving action needs an approval.

### D. Not reviewed or unverified

Ledger device code (`popup/ledger/device.ts`) and Ledger blind-signing prompts; NFT send; non-EVM send families beyond address validation; the live deployed gateway; whether the Infura key was free-tier/testnet-only; CI practice; Chrome Web Store contents; whether Etherscan honors the first or last duplicated parameter (now moot). Trust Wallet's client-side swap checks and `eth_sign` handling were not confirmed from its bundle. Two test files (`onboarding-import`, `qrsync`) fail here only because the sandbox forbids deleting their temp files; they were not affected by these changes.

### E. Verification run

`tsc --noEmit` clean (extension and gateway). `node --test test/*.test.js`: 427 pass, 2 fail (`onboarding-import`, `qrsync`: the build sandbox forbids deleting their temp files; unrelated to these changes). New or extended tests: `test/vault-throttle.test.js`, `test/audit-fixes.test.js`, `provider`, `swap`, `swap-providers`, `multi-extra`.



## 4. Secrets comparison with Trust Wallet 26.41.0
Evidence: Trust Wallet `26.41.0_0.zip` (extracted to `evidences/extension/reference-26.41.0`, `background.js` read directly) and Harbour source (`harbour-wallet-v2/src`). Labels: **CONFIRMED** = code read in both. This is a static review, not a pentest.

### 1. Side by side

| Concern | Trust Wallet 26.41.0 | Harbour | Verdict |
|---|---|---|---|
| Outer vault cipher | `keyFromPassword`: PBKDF2-SHA256 **10,000** it -> AES-GCM-256, 16-byte IV (`@metamask/browser-passworder` pattern) | identical (`core/passworder.ts`) | Equal. The 10k is applied to an already-derived 128-hex key, not the raw password |
| Password -> keys | wallet-core PBKDF2-HMAC-SHA512: **20k** "password" key (keystore passphrase), **210k** unlock key (vault) | identical constants (`core/passwordService.ts`) | Equal |
| Keystore | wallet-core StoredKey, aes-128-ctr, scrypt n=16384 r=8 p=4 | identical | Equal; see F2 |
| Unlocked state | `storage.session["password"]` and `["unlockKey"]` (derived keys, not the password); cleared on lock/browser close | identical (`wallet:password`, `wallet:unlock`) | Equal |
| session access level | never calls `setAccessLevel` (0 hits) | **now pinned to TRUSTED_CONTEXTS** | Harbour ahead (F1) |
| Unlock throttle | 5 free attempts, 5 s doubling to 5 min, **serialized** (`serialize`/`guard`), stored `trust:unlock-throttle` | same numbers; **was not serialized**, now is | Fixed (F3) |
| Password check | `verifyPassword` re-derives and compares to session key with `!==` | decrypts the vault (AEAD) instead | Harbour fine |
| Seed export | `getSeedPhrase(password, walletId)` requires password argument every time | `revealAuth` password/passkey -> one-shot 2-minute grant, consumed on read | Equal strength |
| Seed on screen | DOM text | **canvas** (`SeedCanvas`), no copy | Harbour ahead |
| Private key on screen | n/a to compare | DOM text, 60 s auto-hide, Copy button | See F5 |
| Auto-lock | alarm, default 10 min | alarm, configurable | Equal |
| Biometric | passkey-derived secret seals the password key | seals both keys under 32-byte secret | Equal; Harbour re-verifies unlock key against vault |
| Internal API gate | internal/public namespaces + `stripExternalTrustFlags` | `isInternalWalletSender`: exact popup URL only | Harbour stricter |
| Phishing / simulation | user blacklist only | public lists + simulation | Harbour ahead |
| Permissions | alarms, tabs, storage, scripting, ... | `tabs` removed | Harbour ahead |
| Telemetry | Sentry (stacktrace attached) + Amplitude | none | Harbour ahead |

### 2. Findings and actions

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | Low | `storage.session` holds both derived keys; only the browser default keeps content scripts out. | **Fixed**: `setAccessLevel(TRUSTED_CONTEXTS)` at worker boot (`background/index.ts`) |
| F2 | Low (hardening, not a vulnerability) | Offline attack on a stolen profile takes the cheapest path: the keystore passphrase is only PBKDF2-SHA512 20k, then scrypt n=16384 p=4 (below the OWASP p=5 equivalent for n=2^14). The 210k unlock key protects the vault, which holds metadata, not the seed. | **Deferred**: chaining the 210k step in front of scrypt only raises per-guess cost roughly 1.5-2x (scrypt dominates), so the migration risk is not worth it alone. Better ROI: raise the minimum length for new passwords, and if a KDF change is wanted later, do it once with a memory-hard KDF. Original idea: derive the keystore passphrase from the 210k unlock key (HKDF) and re-wrap every keystore plus the agent-key blobs on next unlock. It touches 14 call sites and the passkey seal, and a bug could lock users out of funds, so I did not ship it blind. |
| F3 | Medium | `unlock` and `checkPassword` read the throttle, verify, then arm. N parallel messages all read counter 0, so the lockout could be skipped. Trust Wallet serializes this. | **Fixed**: promise-chain mutex in `core/vaultService.ts`; test `test/vault-throttle.test.js` (12 parallel guesses -> 6 checked, 6 blocked) |
| F4 | Info | Decrypted mnemonic and derived keys exist as JS strings; JS cannot zero them. wallet-core objects are `delete()`d after use (good). | Accepted, same as Trust Wallet |
| F5 | Low | Private-key Copy leaves the key on the clipboard. | Open: needs an offscreen document to clear it after the popup closes; recommend hide Copy for keys or add the offscreen clear |
| F6 | **High (hygiene)** | The REA project folder holds `harbour-wallet-firebase-adminsdk-*.json` (Firebase admin service account), `harbour-release-key.json` (release signing key), `harbour-config-key.json`, `harbour-keys.env`. I did not open them. They are outside the extension and not in `dist/` or the shipped zip, but they sit beside evidence and zips that get shared. | Open: move out of the folder, rotate the Firebase key if the folder was ever synced or shared, keep the release key offline |

### 3. Not found as problems
No raw password stored anywhere; seed and private keys only inside the AES-128-CTR keystore; popup never imports vault or wallet-core code (enforced by `test/boundaries.test.js`); no `externally_connectable`; no `console.log` in `src`.

### 4. Recommended next step
Ship F2 as a versioned key schedule: `unlockKey = PBKDF2-SHA512(pw, salt, >=210k)`, `keystoreKey = HKDF(unlockKey, "harbour/keystore/v2")`, migrate on first unlock behind a `kdfVersion` field, passkey unlock re-derives `keystoreKey` from the sealed unlock key. Then raise the unlock cost or move to a memory-hard KDF.

## 5. Trust Wallet 26.41.0 implementation reference

Method: four read-only research passes over the extracted 26.41.0 bundle (`evidences/extension/reference-26.41.0`: `background.js`, `chunks/*.js`, `inpage.js`, `content-scripts`) and the saved HARs/RE evidence under `evidences/`. They scanned the bundle with Python string windows. **The REA MCP tools (`rea__*`) were not used for this pass**: the bundle is a 42 MB single-line file and earlier attempts at the application-graph tool were rejected or too heavy, so direct scanning of the REA-extracted files was used. Every claim is a code quote with a confidence; "NOT FOUND" is scoped to the bundle, not proof of absence. TW's backend (gateway, "Amber" swap API, risk scanners) is private and cannot be read.

Verdict legend: **COPY** = proven TW behaviour worth adopting; **BEYOND TW** = TW does not do it, Harbour must design it; **HARBOUR AHEAD** = Harbour already stricter.

### 1. Signing screens

| Issue | Trust Wallet 26.41.0 | Verdict / what to do |
|---|---|---|
| SIG-07 eth_sign | CONFIRMED. `isEthSignEnabled:false` by default (developer setting), migration forces it off, handler throws `ETH_SIGN_DISABLED`, only exactly 32-byte hex accepted ("eth_sign requires 32 byte message hash"), and the signer layer hard-blocks it ("eth_sign is no longer supported"). Typed-data **v1** is blocked in the UI. personal_sign shows text only if strict UTF-8 decodes, else raw hex. Every message also goes to a server `/v1/validate/message` risk check. | **COPY**: off by default behind an Advanced toggle; 32-byte only; block typed-data v1; strict UTF-8 fallback to hex. **Do better**: add an explicit "opaque hash can drain funds" warning when enabled (TW has none). |
| SIG-17 typed data / permit | CONFIRMED. `detectIntent` recognises Permit2 (`PermitSingle`/`PermitBatch`, unlimited when amount >= 2^160-1), DAI permit (`allowed`/`holder`, revoke detected) and EIP-2612 (`value`, unlimited >= 2^256-1). Card shows token, amount ("Unlimited" in red), expiry ("Never" in warning colour), spender, signature validity; a DANGER banner for unlimited non-revoke permits. Typed-data chainId mismatch rejects with `CHAIN_ID_MISMATCH`; a missing chainId is accepted silently. Seaport/Order: NOT FOUND. dApp ERC-20 approve gets a dedicated screen with increase-allowance and native-value warnings and an Unlimited spending-limit modal. | **COPY** the `detectIntent` design (small, self-contained). **Do better**: detect by field shape not name, add Seaport/Order, warn when chainId is missing or verifyingContract is unknown or the spender is an EOA. |
| Tx decoding for dApp `eth_sendTransaction` | CONFIRMED. Local ABI decode only for transfer (`0xa9059cbb`), transferFrom (`0x23b872dd`), approve (`0x095ea7b3`), setApprovalForAll (`0xa22cb465`). Unknown calldata -> warning `send-tx.decoding-warning` + raw hex behind "view details". No 4byte lookup. Simulation is server-side (`/v1/wizard/simulate`) for Ethereum and BSC only; no local `eth_call`/`eth_simulate`. Risk verdict from `/v1/validate/transaction` drives a banner and a hard stop (`shouldStop`); when the check is unavailable it shows a fail-open "unavailable" banner. | **COPY** the three tiers (decode / "could not decode" warning / "check unavailable" banner). **Beyond TW**: local `eth_simulateV1` balance deltas (Harbour already has it) and decoders for `increaseAllowance`, Permit2 `approve`, router `multicall`. |
| SIG-13 address poisoning | Partial. Server risk on the recipient (`/v1/validate/address`): ERROR for flagged/restricted, ERROR for smart-contract recipient ("may result in permanent loss"), WARNING for memo-required exchange, WARNING for high risk, WARNING when the check is unavailable ("Double-check the address"). Only the fiat-ramp URL has a local anti-poisoning override. Local first-seen / lookalike / self-send / clipboard checks: NOT FOUND. | **COPY** the contract-recipient and unavailable wording. **BEYOND TW**: build local first-seen, prefix/suffix lookalike vs history and address book, full address in review. |
| SIG-12 checksum | CONFIRMED weak. dApp-side `isValidAddress` is regex only; send validation delegates to wallet-core `CoinTypeExt.validate`. No mixed-case checksum rejection. | **HARBOUR AHEAD** (strict checksum already shipped). Also show the checksummed form in review. |
| SIG-15 preview vs submit | CONFIRMED. Commit receives UI-supplied data and **rebuilds** (`GenericTransactionService.sign` -> `buildTransaction`). Guard: refuses if active wallet/account changed since confirmation. Nonce re-read for EIP-7702; Tron max-send amount adjusted silently. No hash of the previewed fields. | **COPY** the active-account guard. **BEYOND TW**: hash {to,value,data,nonce,gas,chainId} at review and refuse on any difference. |
| SIG-10/11 chain handling | CONFIRMED. Silent switch for connected sites (`autoSwitchDappChain` before sends and typed data), prompt only for unconnected; strict chainId `^0x[1-9a-fA-F][0-9a-fA-F]*$` + safe-integer; unknown chain -> 4902; **registry wins**: for a known chainId the built-in network details are shown and the site only chooses the name. | **COPY** registry-wins, strict hex, 4902. Decide deliberately about silent auto-switch (TW behaviour, Harbour matches). |

### 2. dApp-supplied networks (INF-09 / INF-09b)

TW (CONFIRMED): EIP-3085 schema check; `isBlockedRpcHost` blocks non-http(s), `.local/.internal/.localhost`, **any IPv6 literal**, IPv4 0/8, 10/8, 127/8, 100.64/10, 169.254/16, 172.16/12, 192.168/16, >=224, with `localhost` and `127.0.0.1` exempt; applied when adding, when binding a node, and on every RPC call; `redirect:"error"` on fetches; `eth_chainId` probe (5 s timeout, 60 s cache) with "RPC chain ID mismatch" error; warning "A malicious network provider can lie about the state of the blockchain and record your network activity"; the approval screen labels the network name "Name chosen by the site". **TW also probes the dApp URL before approval** (validator in the popup), so that leak is TW parity, not a Harbour-only flaw. Gaps in TW: http allowed, no DNS resolution check, no decimal/hex-encoded IPv4 handling.
Harbour status: private-network block shipped (matches TW's list). **To copy**: apply the guard on every RPC call and node bind, `redirect:'error'`, registry-wins display, "name chosen by the site" label. **To do better**: probe only after approval, block http except loopback.

### 3. Swaps and bridges (SIG-01 to SIG-05, SIG-14)

Key finding: **Trust Wallet does not solve these client-side.** Its client checks only: the transaction's sender matches the active wallet (`assertPressedFrom`, SDK "Address mismatch" check), the approval token equals the sold token, `minAmountOut` is present (not recomputed), quotes are single-use (`claimQuote`, 3 attempts, 64 spent IDs), staged build max age 15 s / step 45 s, and price impact is recomputed from USD prices. The swap transaction `to`, calldata, value, chainId, spender, Solana instructions and THORChain vault are **not validated** (EVM/Solana/BTC tx copied straight from the Amber API response; Relay `to/data` likewise). Harbour's `validateLifiTransaction` is already stricter than TW.

| Issue | TW | Verdict |
|---|---|---|
| SIG-01/02 calldata, receiver | NOT FOUND. Trusts private Amber backend. | **BEYOND TW**: router allowlist + receiver decode + simulation delta (design below) |
| SIG-04 approvals | CONFIRMED. Exact `minAmount` by default; unlimited is a Settings toggle (default off, warns "Unlimited approval is not safe unless you fully trust the contract"); approval token must equal sold token; mainnet USDT reset `approve(spender,0)` when an existing allowance is lower than required; allowance read decides if approval is needed; batched with swap on EIP-7702/smart wallets. Spender is not allowlisted and not checked against `tx.to`. | **COPY** exact-by-default, USDT reset-to-0, allowance read. Harbour already checks spender == `tx.to`. |
| SIG-03 Solana | Jupiter: NOT FOUND (TW uses Amber/Relay `serializedMessage`). Instruction inspection on swaps: NOT FOUND; simulation used only to classify errors. | **BEYOND TW** for swaps; but see Solana dApp signing below for the UI pieces to copy. |
| SIG-05 THORChain/BTC | BTC swaps arrive as a provider-built PSBT; client checks only "PSBT non-empty". `/thorchain/inbound_addresses` used only for gas rate, not vault verification. | **BEYOND TW**: keep unsupported or verify vault via 2+ nodes and decode memo + PSBT outputs |
| SIG-14 slippage | CONFIRMED. Presets 0.1/0.5/1/2.5, clamp 0..30, warning above 5%, price-impact severity thresholds 5% (moderate) and 20% (severe) from server, **hard block at >=30% impact**, server codes `high_price_divergence`/`high_price_impact`, quote refresh 60 s, "Quote expired" state. `exceedsSlippageBand` only decides whether a refreshed quote replaces the shown one. | **COPY** (Harbour already has these in SWAP-SPEC). Add client min-out recompute and quote-vs-tx drift check. |
| Token risk UX | All server-side via TW gateway (`/v1/validate/*`, `/v1/approvals/scan`, asset `security_info` with honeypot/tax/blacklist flags, "Scanned by"). No third-party scanner name (GoPlus, Blockaid, CertiK, ScamSniffer, HashDit...) appears anywhere in the bundle. | Harbour's public-list approach (GoPlus, ScamSniffer) is a valid substitute. **COPY** the UX: blocking states for honeypot/tax/blacklist and a "Scanned by" label. |
| Fee/affiliate | NOT FOUND client-side. | Validate any fee recipient against a hard-coded constant. |

**Design for Harbour (since TW gives none):** per-chain allowlist of router/spender addresses taken from each provider's official docs (verified before shipping); decode calldata for receiver == own address and min-out; require an `eth_simulateV1` balance delta >= min-out; fail closed when simulation is unavailable on swaps (TW fails open, which is weaker).

### 4. Non-EVM, Solana, Bitcoin, Ledger, WalletConnect

| Issue | TW | Verdict |
|---|---|---|
| SIG-08 non-EVM | dApp families: exactly solana, ethereum, binance, cosmos, ton, tron, bitcoin. **No Sui/Aptos dApp provider.** Cosmos sign_doc shown as a raw JSON tree (no Msg decoding). TON shows summed amount + raw message JSON. Tron shows `raw_data_hex`, fee, decoded value/token transfer. Bitcoin: signPSBT/pushPSBT only, message signing rejected. | **BEYOND TW** for Cosmos Msg decoding (send/delegate/authz/ibc/execute-contract), TON/Tron recipient fields. Do not claim Sui/Aptos parity. |
| SIG-06/16 Solana | CONFIRMED strong UI: `simulateTransaction` (replaceRecentBlockhash, sigVerify false, up to 30 accounts) -> balance changes incl. SPL and "Accounts closed"; lookup tables resolved (max 8, unresolvable throws, `sign-tx.unresolved-accounts` warning); SetAuthority = ERROR banner, Approve/ApproveChecked = delegation banner with amount/mint/delegate, CloseAccount decoded; unknown program labelled; "couldn't decode" banner; wallet must be a signer. Simulation failure warns but still allows signing (fail open); blockhash validity fails open. **signMessage over transaction bytes: NOT FOUND, TW signs them.** | **COPY** simulate + ALT resolution + SetAuthority/Approve/Close banners. **HARBOUR AHEAD** on the signMessage guard (shipped). Make simulation failure require an explicit acknowledgement. |
| SIG-19 Ledger | CONFIRMED real: WebUSB only; apps Ethereum (all EVM), Solana, Binance, Bitcoin; derivation fixed Ledger-Live style (`44'/60'/i'/0/0`, `44'/501'/i'`, BTC `84'/0'/i'`), user picks only the account index; **address NOT verified on device** (`getAddress(path)` without display flag); stores `{address, coin, publicKey, derivationIndex}`; ERC-20 clear-signing only, EIP-712 hashed, blind-signing handled reactively via error mapping; BTC PSBT via `wpkh(@0)` policy. | **COPY** the narrow model. **Do better**: verify on device at add time (display=true), store the full path, explicit blind-sign warning. |
| SIG-19 Bitcoin PSBT | CONFIRMED. `decodePsbtParam`, `computePsbtSummary` (recipients, OP_RETURN, fee only if all prevouts known, "Inputs you sign N/M"), `assertPsbtSighashesSafe` allow-list `[0,1,3,129,131]`, SIGHASH_SINGLE-without-matching-output guard, nonWitnessUtxo txid check, signInputs range check, key `.delete()` in `finally`. No fee cap/dust check, no change-output flagging. | **COPY** allow-list, SINGLE guard, txid check, summary. **Do better**: fee-rate cap, flag change outputs, guard taproot script-path. |
| SIG-09/11 WalletConnect | **TW 26.41.0 has no WalletConnect transport/pairing/Verify.** Only Kotlin DTO/mapper classes (`WcMethod`, `WcRequestDispatcher`) not reachable by users. | **BEYOND TW**: design from the WalletConnect spec (Harbour already rejects scam-flagged and unverified-origin-collision proposals). |
| SIG-18 key handling | CONFIRMED. Re-derives per operation: `StoredKey.wallet(pwd)` -> `getKey` -> `finally{hd.delete(); sk.delete()}`; `withPrivateKey` wrapper deletes key in `finally`; `assertKeyMatchesAccount`. No JS buffer zeroing (PSBT path copies `Uint8Array.from(key.data())`). Session secrets live in `storage.session` for the whole unlocked period. (One report called it a "plaintext password"; the earlier vault review showed it is a derived key, `deriveKey(...)`, and that stands.) | **COPY**; Harbour already matches and zeroes more. |

### 5. Connection model, config, backend

| Topic | TW | Verdict |
|---|---|---|
| Permissions | Per-origin, keyed by dapp id; sender frame origin; null/opaque origin rejected; blacklist by origin; one pending request per origin+method; `stripExternalTrustFlags`; `INTERNAL_*` methods only on trusted UI ports (by **port name**); cross-origin iframe request shows "embedded inside {topOrigin}" warning but permission is not tied to top origin; `networkId` is read from page params. Inpage channel uses a 32-byte channel secret, per-message nonce + keyed MAC with replay cache (512) and 1 MB cap, but the secret is handed to the page's own JS world within a 2 s window, so it authenticates "same page context", not trusted code. | Harbour matches or exceeds (sender URL pinned, documentId binding, MessageChannel). **To copy**: the iframe warning; do better: bind to top-frame origin or refuse cross-origin frames. |
| Remote config/flags | Amplitude Experiment, TLS + public key only, **nothing signed**; per-flag hardcoded default (fail-closed), last-good persisted in redux; flags can only enable/disable features and delist chains, never carry URLs; node list comes from the gateway (`/v2/projects/<id>/nodes`) guarded by chain-id probe + SSRF guard. | **HARBOUR AHEAD** (Ed25519-signed config). **COPY**: safe per-flag defaults and last-good persistence. Add expiry (INF-08). |
| Gateway auth (INF-03) | `POST /v2/devices/fingerprint` (no attestation) returns `device_id` + `hash_key`; every gateway request carries `X-TW-CREDENTIAL`, `X-TW-NONCE` (uuid), `X-TW-DATE` and `Authorization: HMAC-SHA256 Signature=` over `METHOD;path;sorted-query;device_id;nonce;date` (body not signed); on 403 re-fingerprint and retry once; identifying headers only sent to first-party hosts. Fingerprint is mintable by anyone, so it identifies a device but is not real authentication. | **COPY** the HMAC scheme + 403 retry + first-party-only headers; **do better**: sign a body hash, reject replayed nonces/stale dates server-side, rate-limit fingerprint by IP. |
| Push (INF-05/06) | `gcm` permission; `PUT /v2/devices/{id}` with push token; wallet addresses registered server-side `POST /v3/devices/{id}/wallets/{wid}/register`; client shows `gcm.notification.title/body` as sent. **No client-side sanitisation or verified-token filter** (done server-side, e.g. spam/honeypot flags). | **BEYOND TW**: Harbour's sanitize + "(unverified token)" label is more than TW does client-side; add a fixed template for unverified tokens. |
| Phishing lists | No client list; all via gateway `/v1/validate/url|address|transaction|message`, `/v1/approvals/scan`; user blacklist; HIGH/MEDIUM risk interstitial "Warning! You could lose all your tokens!"; fail-open behaviour on errors not confirmed. | **HARBOUR AHEAD** (public lists). Keep explicit "risk check unavailable" wording. |
| Updates / Sentry / wasm | Auto-update gated by flag; applies only when no wallet UI is open; remembers failed target version; reload-loop guard; wasm only functionally probed (no hash); Sentry scrubber redacts key names (privatekey, mnemonic, seed, password, keystore, address, signature, xpub...) and values by regex (EVM/TON/bech32/base58 addresses, 66-hex, 80+ hex). | **COPY** the update state machine and Sentry scrubber if telemetry is ever added; **HARBOUR AHEAD** on wasm SHA-256 pin. |
| Embedded keys (INF-01/07) | Only public identifiers: Amplitude key, Sentry DSNs, GCM sender key. Provider keys hidden behind `*.twnodes.com` (~150 hosts). | Confirms the rule: no provider key in the client. Harbour's Infura key violated it (fixed). |
| Auto-lock | Options `[1,5,10,15,30,60,0]` min (0 = never), default 10, alarm-based, UI activity pings re-arm it, boot reconcile of session secret vs authenticated flag. **No `chrome.idle`**, so no lock on screen lock. | **COPY** options + reconcile. **Do better**: lock on screen lock via `chrome.idle`. |

### 6. Where TW gives us nothing to copy (must be designed independently)

SIG-01/02/03/05 swap and bridge validation, SIG-09/11 WalletConnect, SIG-13 local poisoning detection, Sui/Aptos dApp signing, Cosmos message decoding, EVM balance-change simulation, signed config expiry, a real device attestation for the gateway.

### 7. Suggested implementation order for Harbour
1. Signing UX: eth_sign off by default + Advanced toggle, block typed-data v1, `detectIntent` permits + unlimited banner, decoder tiers (SIG-07/17).
2. Swap safety: allowlist + calldata/receiver decode + simulation delta, fail-closed (SIG-01/02/04).
3. Solana: simulation + ALT resolution + SetAuthority/Approve/Close banners (SIG-03/16).
4. Send safety: plan hash at review, local poisoning checks, contract-recipient warning (SIG-13/15).
5. Network handling: registry-wins, RPC guard on every call, redirect error (INF-09).
6. Bitcoin PSBT checks, Ledger on-device verify.
7. Gateway: HMAC per-request scheme, nonce/date checks (INF-03/05).

### 8. Approval screen (read from `chunks/App-D29UTaP5.js`, `approval-detail-*.js`)
Static read of the popup code; REA's source recovery was unavailable (needs a Wakaru install) and its whole-app analysis timed out, so this is direct reading of the minified chunk.

| Trust Wallet behaviour | Harbour today | Action |
|---|---|---|
| **Editable spending limit** (`SpendingLimitModal`, `initialSpendingLimit`): for an unlimited approve the box is pre-filled with your balance, not "Unlimited"; changing it opens a confirmation modal, with a stronger warning for the high default | Shows "Unlimited" and a warning only; no way to lower it | **COPY**: let the user replace the approve amount (rewrite calldata) and default to balance |
| `sign-tx.simulation-failed` (likely to fail, fee still charged) and `simulation-unavailable` (cannot preview, trust only if you know the site) | Warns on failure; no message when simulation is merely unavailable | Add the unavailable banner |
| `sign-tx.decode-failed` / `undecodable` banner | Shows "Unknown contract function" | Keep, add the banner wording |
| `dapp.embedded-frame-warning` (request comes from an iframe inside another page) | Has `embedded` flag in the view | Confirm it is shown in the UI |
| `dapp.chainid-mismatch` (request for another chain than the wallet) | Auto-switches for known chains, refuses unknown | Equal or stricter |
| Risk gate: high-risk URL needs **two checkboxes** ("I can lose all my tokens", "cannot be recovered") + "Proceed anyway"; `risk.dapp-check-unavailable` when the check cannot run | One acknowledgement checkbox when dangerous; site-check-unavailable note exists | Optional: second checkbox for high-risk sites |
| Solana: instruction list with role tags (signer/writable), lookup-table notes, authority/delegate/close banners, "N transactions will all be signed", "accounts closed" balance row | Done in step 3 (lookups resolved, warnings, simulation) | Add "N transactions" banner |
| Bitcoin PSBT: sighash banners (`ANYONECANPAY`, `SINGLE`, partial), OP_RETURN data, "inputs you sign" | Harbour refuses non-ALL sighash, shows outputs, fee, warnings | Harbour stricter |
| Typed data: token approval card, "Signature valid until", revoke label, unlimited warning | Done (`typed.ts`) | Equal |
| Approvals tab detail page with risk tag (High/Medium) | Approvals list with GoPlus flags and revoke | Equal |

### 5.8.1 How Trust Wallet applies an edited spending limit (Wakaru decompile of App-D29UTaP5.js)

- The ERC-20 approve page keeps the user-edited limit in state; the effective allowance is the edited value, or the dApp-requested value when the field is empty or not a number.
- When the dApp requests unlimited and the balance is known, the field is pre-filled with the balance (rounded down) instead of unlimited.
- Editing the limit rewrites the `approve` calldata with a helper that swaps the amount (limit x 10^decimals) in the original data. The rewritten data replaces `data.params.data` in the staged request.
- Any change to the staged request (data, gas, value) re-stages the transaction in the background, so the fee shown always matches the data that will be signed.
- Confirm is blocked until the limit is valid (not negative, not empty). If the limit is unlimited or high relative to balance, a confirmation modal with a danger button appears before signing.
- Harbour gap: no editable limit yet. Planned: pre-fill with balance, rewrite approve amount via the decoder, re-quote, confirmation modal.

### 5.8.2 Implemented in Harbour (2026-10-23)

- Editable spending limit on plain ERC-20 approve: pre-filled with the request, or the balance when the site asks for unlimited. The background rewrites the calldata and only accepts a limit lower than or equal to the request (`lowerApproveAmount`). Other calls cannot be rewritten.
- "Balance changes could not be simulated" note when the RPC has no `eth_simulateV1`.
- Solana banner when one approval signs several transactions.
- Second risk checkbox ("I accept the risk of losing funds...") for high-risk requests (flagged site or address, unlimited or hidden approvals, failed or missing simulation, raw hash signing).
- Lending history rows show `-` for deposit/repay and `+` for withdraw/borrow.

## 6. External review scope (to commission before public release)
1. **Vault**: password KDF parameters, keystore handling, auto-lock, passkey and biometric unlock, and reveal-phrase gating (`core/vaultService.ts`, `core/passworder.ts`, `background/keys.ts`, `core/passkeyService.ts`).
2. **Provider**: origin binding, the handshake, the pending queue and settle, the per-namespace signing paths (EVM, Solana, multi-chain) and the approval view (`background/provider/*`, `src/inpage`, `src/content`).
3. **Signing correctness**: PSBT, TON proof, Hyperliquid, Polymarket and Ledger verification (tests contain the vectors).
4. **Gateway**: allowlists, rate limiting, push registration (`gateway/*`).

Everything under sections 2 and 3 should be re-read by the reviewer; items marked FIXED are covered by tests under `test/` (`audit-fixes`, `provider`, `swap`, `swap-providers`, `multi-extra`, `vault-throttle`).

## 7. Reporting
Report vulnerabilities privately to the maintainers. Do not open public issues for security bugs.

