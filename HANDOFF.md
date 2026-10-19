# REA workspace — handoff for the next agent

> **UPDATED 2026-10-19.** Sections 4–7 below were written 2026-10-16 and are partly stale. Current truth: `UI-PARITY.md`
> (2026-10-19 table), `rebuild-tracker.md` (2026-10-19), `DESIGN-SYSTEM.md` ("Current theme as found 2026-10-19"), and
> `harbour-wallet-v2/BUILD-LOG.md`. Since the handoff was written the tree gained: swap rebuild (LI.FI/Jupiter), token detail with
> real chart/history, custom tokens + custom networks, settings suite (security, auto-lock, language, currency, color mode,
> preferences, address book, notifications, faucets, about), passkey/biometric unlock, QR sync import, send estimate + ERC-20,
> fiat rates. Still absent: dApp provider/approvals/connections, non-EVM send, real staking/NFT/buy/sell/fund/discover.
> The user's mandate is now: implement every Trust Wallet screen (see AGENTS.md 2026-10-19).


Written 2026-10-16. Workspace root: `/Users/jatinsharma/Desktop/REA` (mounted as `$HOME/mnt/REA` in `device_bash`).
Confidence tags: [certain] = verified in files/commands, [likely] = strong inference, [guess] = gap-filling.

## 1. One-paragraph state

Two things live here. (A) A reverse-engineering (RE) evidence base for the Trust Wallet (TW) Chrome extension v26.41.0. (B) "Harbour Wallet", an MV3 extension (Vite + React + TypeScript) that is meant to be an exact UI/UX clone of TW, built in `harbour-wallet-v2/`. The crypto core and the wallet-management screens are real and tested. Much of the rest of the UI is sample data. There is no dApp provider and no WalletConnect. Nothing has been visually compared to TW or QA'd in a live Chrome session. [certain]

## 2. Ground rules from the user (do not violate)

- Every feature must be evidence-backed via REA ("don't guess"). Say when you are unsure.
- Exact UI/UX clone of TW. Only the name and logo stay neutral ("Harbour"). Copyright is not a concern to the user.
- Use `@trustwallet/wallet-core@4.8.2` for all crypto. No custom crypto. The shipped `wallet-core.wasm` is byte-identical to it. [certain]
- Data source decision (user chose "option 1"): Harbour uses PUBLIC data (CoinGecko, public RPCs). It must NOT call TW's authenticated gateway `gateway.us.trustwallet.com`. Reason: that needs a TW device credential minted via `POST /v2/devices/fingerprint` with `x-origin: Trust/26.41.0 Extension`. That is impersonating TW's client, and an attempt to verify it live was blocked by the safety classifier ("Third-Party Attack"). Do not try to work around it. If the user later wants gateway access, they must authorize it explicitly.
- Never reuse session tokens, device ids or hash_keys found in the HAR files. Never copy them into code or config.
- User's reply style preference: lead with the uncomfortable truth, tag confidence, no flattery, hold position unless given new information.

## 3. Folder map (what each thing is, and whether to use it)

| Path | What it is | Use it for |
|---|---|---|
| `26.41.0_0.zip` | The user-supplied TW extension (58.7 MB). Unsigned/unauthenticated distribution. | Original artifact. Never modify. |
| `artifacts/reference-26.41.0/` | Extracted TW extension (429 files): `background.js` (42 MB single-line minified), `chunks/` (about 236 JS chunks), `inpage.js`, `content-scripts/`, `manifest.json`, `wallet-core.wasm`. | Source for fresh REA recovery of any screen. Find the chunk by name, e.g. `manage-crypto-*.js`, `dapps-*.js`, `HorizontalNetworksFilter-*.js`. |
| `trust-wallet-RE.md` (50 KB) | Main RE spec: onboarding, vault/crypto, features #10–#18, runtime (§6) and HAR contracts (§7). | First read for any crypto/vault/storage question. It contains some contradictions; `audit/CURRENT-STATUS.md` corrects them. |
| `rebuild-tracker.md` | 18-feature chronological research tracker (Established / Partial / Blocked). | Research coverage only. It is NOT an implementation claim. |
| `AGENTS.md` | Charter and method: strict chronological order, REA-first, evidence rules. | Method. Parts are superseded by `IMPLEMENTATION-PLAN.md`: build is now in scope. |
| `IMPLEMENTATION-PLAN.md` | Governing build plan: architecture boundaries, per-feature loop. | Process for building. |
| `UI-PARITY.md` | Per-screen parity ledger. Dated 2026-10-15; first-run/onboarding rows are mostly "Fail". | Template for the parity record. Stale: later work is not reflected. |
| `audit/CURRENT-STATUS.md` | Honest audit of what was verified vs. claimed. | Read before trusting any "done" claim. |
| `audit/screens/{reference,harbour}/` | Playwright first-run screenshots and sanitized DOM (Chromium 141). | Visual baseline for onboarding only. |
| `evidence/` | REA-recovered readable source per feature: `01-install` … `18-ledger`, plus `19-search-manage-crypto`, `20-dapp-discovery`, `21-network-filter`, `22-window-context`, `23-trending`. `INDEX.md` maps each to its REA evidence id. `slices/` holds the carved inputs. `runtime/` holds live-extension captures, including `api-contracts.md`. | Read `NN-<feature>/bundle.js` to see how TW implements a feature. Cite the evidence id. |
| `evidence/REA-RECOVERY-NOTE.md` | Records that features 19–23 were recovered with Wakaru 1.14.0 run directly, because the REA wrapper had no `REA_WAKARU_COMMAND`. | Honest provenance for 19–23. |
| `egjidjbpglichdcondbcbdnbeeppgdph.har` | Earlier real TW HAR (240 entries). Source of `evidence/runtime/api-contracts.md`. | API contracts. Contains tokens. Do not copy. |
| `harbour-wallet-v2/Trust_wallet.har` | Useless: Google new-tab traffic, zero TW calls. | Ignore. |
| `harbour-wallet-v2/network-log.har` | Valid TW capture (318 entries, 12.9 MB; 186 gateway calls). | Spec for the gateway API (see `evidence/24-har-api-contract/`). Contains tokens. Do not copy. |
| `tools/` | Pinned toolchain: REA CLI 6.5.0, Wakaru 1.14.0, WABT 1.0.42, Playwright/Chromium 141, scripts such as `capture-first-run.mjs`. `tools/README.md` has the install commands. | RE and capture tooling. |
| `wallet-core/` | Checked-out upstream wallet-core source (docs/reference). | Reference only. Do not RE its internals. |
| `wallet-clone/` | Early JS proof-of-concept of the secure core. | Historical. Not a production target. |
| `harbour-wallet/` | OLD Harbour build (older iteration, with tarballs and `dist.*` backups). | Do not develop here. The active tree is v2. |
| `harbour-wallet-v2/` | ACTIVE build. See §4. | All new work goes here. |
| `.rea-work/` | Empty scratch. | n/a |

## 4. Active codebase: `harbour-wallet-v2/`

Build and test: `npm install`, then `npm run build` (runs `prepare-wasm.mjs`, `tsc --noEmit`, `vite build`), then in Chrome use Load unpacked on `dist/`. `npm test` runs `node --test test/*.test.js`: 13 passing as of the last run. [certain]
Quirk: `vite build` fails with EPERM when it tries to delete the old `dist/` (no delete permission on the device). Workaround used every time: `mv -n dist dist.prebuild-$(date +%H%M%S)` before building. There are 11+ stale `dist.prebuild-*` dirs plus several `vite.config.ts.timestamp-*.mjs` files. Cleaning them needs `device_request_delete_permission`, which has not been asked for.

Source layout (about 2,000 lines of src):
- `src/core/`: `walletCore.ts` (wallet-core singleton), `walletService.ts` (derivation; account path = default path with the LAST "0" replaced by the account index, per TW evidence 08), `vaultService.ts`, `passworder.ts` (AES-GCM), `passwordService.ts` (PBKDF2 20k/210k), `storage.ts`, `balanceService.ts`, `rpc.ts`, `chains.ts`, `priceService.ts` (CoinGecko prices and trending), `twTaxonomy.ts` (TW network coin ids, category ids and listings response adapter, from the HAR), `commonPasswords.json`, `defaultCoins.json`.
- `src/background/index.ts`: MV3 service-worker message router. Handlers: `status`, `generateMnemonic`, `validateMnemonic`, `createWallet`, `unlock`, `lock`, `getAccounts`, `getBalances`, `getTrending`, `getSwapQuote`, `sendTx`, `addAccount`, `switchAccount`, `addWallet`, `switchWallet`, `listWallets`, `revealMnemonic`, `renameWallet`, `removeWallet`, `renameAccount`, `markBackedUp`, `getUiPrefs`, `setAssetHidden`, `setNetworkFilter`. `accessPolicy.ts` restricts the router to the extension's own UI document.
- `src/popup/`: `App.tsx` (shell, loads state), `onboarding/`, and `wallet/` with `Wallet.tsx` (home, tabs, TrendingTab), `screens.tsx` (about 820 lines; screen registry `SCREENS`), `ui.tsx` (icons, shared components, global CSS), `data.ts` (static asset, dapp and sample data), `theme.ts`. Layout is a fluid `.hb-root` (max-width 480px).
- `src/content/content.ts`: 4-line stub. Provider support is intentionally absent.
- `public/reference/`: fonts (Inter), Lottie JSONs, banner images extracted from TW.
- Vault model: wallets keyed by uuid, `activeWalletId`, per-wallet `accounts[]` plus `activeAccount`; mnemonic dedupe by ETH address; keystores are wallet-core StoredKey JSON in `chrome.storage.local[walletId]`; vault state is passworder-encrypted.
- `BUILD-LOG.md`: append-only log with one entry per task. Read the newest entries first. `test/`: `add-account`, `multi-wallet`, `core`, `rpc`, `accessPolicy`, `tw-listings` (plus `fixtures/tw-listings.json`, five real captured listings responses).

## 5. What has been achieved

Research (REA) [certain unless noted]
- 18 lifecycle features processed in `rebuild-tracker.md`; the audited count is 14 Established, 3 Partial (#11 send, #17 swap/staking/NFT, #18 Ledger; #15 network config has a gap), 1 Blocked (#16 WalletConnect, Kotlin/JS-compiled).
- Established highlights: onboarding flow, password policy, PBKDF2 20k/210k, vault and session storage, StoredKey (aes-128-ctr, scrypt n=16384 r=8 p=4 dklen=32), wallet-core usage, derivation, lock/session, home/assets, provider (EIP-1193), signing, content/inpage/background bridge, network/RPC.
- This session added fresh recoveries for Search/DApps/Network filter (19–21) and Trending (23) with Wakaru 1.14.0, plus `evidence/24-har-api-contract/API-CONTRACT.md` (34 distinct TW gateway calls) in the v2 folder.

Harbour features working this session
- Add account (from "Seed Phrase 1"), with TW-exact derivation.
- Multi-wallet: TW-style wallet selector, Add new wallet, Manage wallets, Edit Wallet (rename, reveal, remove; the last wallet can't be removed), account detail.
- Backup Secret Phrase flow (warning card, blurred words, Show, Proceed, `markBackedUp`). This fixed the blank screen.
- Search screen (Crypto/DApps tabs, toggles to hide assets) and network selector/filter.
- Fluid responsive layout.
- Trending tab: sortable Token/Price/Market table, search, three dropdowns (Networks, category, 1H/24H/7D/1M), skeleton and empty states. Real market data from CoinGecko; network coin ids and category ids come from the real TW HAR (`twTaxonomy.ts`).
- Earlier (T0–T6): secure core, onboarding, unlock/lock, many screens, icons, prebuilt `dist/`.

## 6. What is NOT done or not trustworthy

Honest gaps (highest risk first)
1. [certain] No dApp provider, no approval windows, no message or typed-data signing UI, no WalletConnect. `content.ts` is a stub by design (an unsafe page-to-wallet relay was removed during the audit).
2. [certain] Many screens ship sample or static data: Buy providers are labelled "sample data in this build"; Staking, NFTs, Activity, DApps lists, Swap quote come from `data.ts` or placeholder logic. They are not wired to real services.
3. [likely] "Exact UI/UX clone" is not demonstrated for most screens. Only the first-run onboarding has side-by-side captures, and `UI-PARITY.md` rates those "Fail". There is no screenshot matrix, theme matrix or live QA across the screens built this session. All changes were verified by `tsc`, the build and unit tests, not in a running Chrome.
4. [certain] Send (#11) is only partially RE'd (per-network signing bodies, fee/nonce, broadcast endpoints). `sendTx` exists, but its fidelity to TW is unproven.
5. [certain] Chains: Harbour supports its own set (ETH, BTC, BNB, Polygon, Solana, Arbitrum, Base plus Sepolia), not TW's full 86-chain enabled set (`/v1/balances/chains` in the HAR).
6. [certain] Trending uses CoinGecko, not TW's source. Its numbers will differ from TW's. The `bstocks` category has no verified public equivalent and was left out. HyperEVM, Robinhood Chain and Arc have no CoinGecko category, so they are hidden from the network dropdown.
7. [certain] Auto-lock scheduler (which alarm), background approval flow (#12/#13) and per-network Ledger signing are still unresolved in the RE.
8. [certain] TW gateway features seen in the HAR but not built (they need authenticated access): `/v1/assets`, `/v2/market/tickers`, `/v1/balances/stream`, `/v1/txhub/*` history, `/v2/announcements`, `/v3/nft/collections`, `/v1/approvals/scan`, staking, discover, points, buycrypto quote. Contracts are documented in `evidence/runtime/api-contracts.md` and `evidence/24-har-api-contract/`. Public-source substitutes would have to be designed per feature.
9. [certain] Housekeeping: stale `dist.prebuild-*` and `vite.config.ts.timestamp-*` files; the old `harbour-wallet/` tree has not received this session's changes; `UI-PARITY.md` and `rebuild-tracker.md` have not been updated for this session.

## 7. Suggested next steps for the next agent

1. Load `harbour-wallet-v2/dist` in Chrome and click through every screen built so far. Capture TW vs Harbour screenshots at the same viewport. Update `UI-PARITY.md`. This is the biggest verification gap.
2. Replace sample-data screens with real, public-source data, one at a time, each with fresh REA recovery of the TW chunk first: Activity (public RPC or explorer), Staking, NFTs, Buy, Swap.
3. Finish #11 Send RE (fees, nonce, broadcast) before trusting `sendTx`, and add tests.
4. Build the dApp provider and approval windows using `evidence/12-dapp-provider`, `evidence/14-bridge`, and the safeguards in `IMPLEMENTATION-PLAN.md`: strict method/schema filtering, origin binding, no access to internal commands from the page.
5. Expand the chain set toward TW's list only where evidence and public RPCs exist.
6. Log every change in `harbour-wallet-v2/BUILD-LOG.md`, keep evidence under `evidence/NN-…`, and say plainly when recovery used Wakaru directly instead of the REA wrapper.

## 8. Environment and tooling notes

- The session runs in a cloud container linked to the user's Mac. Work on the Mac files with `device_bash`; use `device_stage_files` / `device_commit_files` only when a cloud-only tool is needed.
- The REA MCP wrapper `recover_javascript_sources` returned `capability_unavailable` (no `REA_WAKARU_COMMAND`). Workaround: `npm i -g @wakaru/cli@1.14.0` in the cloud container; run `wakaru file.js -o out.js` (single file) or `wakaru big.js --unpack=auto -o dir --provenance` (bundles). Stage chunks from the device, then commit evidence back.
- `background.js` (42 MB) cannot be processed whole. Carve a brace-balanced, `node --check`-valid slice first.
- The device shell cannot delete files without permission. The device network allowlist blocks `gateway.us.trustwallet.com` (proxy 403).
- Bash in the cloud container cannot call TW's private gateway. A live attempt was denied by the safety classifier, and that denial must not be bypassed.
- Memory notes live under the Project "REA-TESTing" (`areas/harbour-wallet.md`, `areas/trust-wallet-re.md`).
