# Harbour Wallet — Build Log & Decisions

> Append-only record of every decision and task. Newest entries at the bottom.
> RE basis: `../trust-wallet-RE.md` + `../evidence/`. Goal: a Trust Wallet-compatible
> wallet under the "Harbour Wallet" brand, using the same open-source libraries
> Trust Wallet uses so we never write unaudited crypto.

## Guiding principles
1. **No custom crypto.** All key generation, derivation, keystore, and signing go
   through `@trustwallet/wallet-core@4.8.2` (byte-identical to TW's build) or other
   audited libraries. We only write orchestration/UI.
2. **RE-aligned.** Every behavioral choice (KDF iterations, cipher, storage schema,
   flows, endpoints) matches the RE docs; deviations are logged with a reason.
3. **Optimal, not copied.** We write clean modern code, not transcribed minified
   source. Equivalence is proven by tests, not by code identity.
4. **Own branding.** Name "Harbour Wallet"; not Trust Wallet's name/logo.

## Stack decisions
| Concern | Choice | Why (RE / audit) |
|---|---|---|
| Crypto / HD / keystore / signing | `@trustwallet/wallet-core@4.8.2` | TW's own lib, byte-identical; audited; RE §4.5/§4.7 |
| Build tool | Vite + `@crxjs/vite-plugin` | TW uses Vite (recovered `__vite__mapDeps`); crxjs handles MV3 |
| UI | React + TypeScript | TW uses React (RE §3) |
| State | Redux Toolkit + redux-persist | TW uses Redux; storage key `wallet:store` mirrors TW `trust:store` (§6.2) |
| Extension APIs | `webextension-polyfill` | MV3, matches TW |
| Outer vault encryption | WebCrypto (PBKDF2-SHA256 + AES-GCM) | browser-native, audited; RE §4.3 (passworder-equivalent) |
| EVM RPC / encoding | `viem` | audited, modern; for tx build/encode (signing stays in wallet-core) |
| dApp provider std | EIP-1193 / EIP-6963 | RE §5.12 |
| Chains at launch | ETH, BTC, BNB, Polygon, Solana, Arbitrum, Base + Sepolia | user decision |

## Task log
### T0 — 2026-10-15 — PoC core validated
- Built & tested the secure core in `../wallet-clone` (proof of concept): PBKDF2
  20k/210k, passworder AES-GCM, vault create/lock/unlock + throttle, keystore
  aes-128-ctr scrypt 16384/8/4/32. 5/5 tests pass; addresses match TW. Carrying
  these modules into Harbour Wallet.

### T1 — 2026-10-15 — Harbour Wallet scaffold + secure core + onboarding UI
- Scaffolded MV3 project: Vite + @crxjs + React 18 + TS + Redux Toolkit + viem + webextension-polyfill + wallet-core 4.8.2.
- Ported secure core to TS: `core/walletCore` (wallet-core singleton), `passwordService` (PBKDF2 20k/210k), `passworder` (AES-GCM/PBKDF2-SHA256 10k), `vaultService` (create/unlock/lock/throttle + storage schema), `walletService` (HD + aes-128-ctr keystore), `chains` (7 + Sepolia).
- Background SW: message router (status/generateMnemonic/createWallet/unlock/lock) + onInstalled→onboarding (RE §3.0).
- Popup: React onboarding — welcome(terms gate)→create password(min 8)→backup→unlock→home.
- **Decision:** replaced `Buffer` with TextEncoder/TextDecoder (Buffer absent in SW) — correctness fix.
- **Decision:** wallet-core 4.8.2 Emscripten build REJECTS `locateFile` ("not in INCOMING_MODULE_JS_API"); removed the override and let Emscripten self-resolve the wasm (shipped at dist root via public/). Works.
- **UI decision:** LIGHT theme, Trust Wallet-style layout, dummy "Harbour" branding (gradient H logo, blue accent) — no TW assets/copyright.
- Build: `tsc --noEmit` clean, `vite build` clean, wasm emitted to dist. Ran the built extension headless: welcome→create→backup verified end-to-end; wallet-core generates a real mnemonic + real ETH/BTC/BNB/Polygon addresses in-extension. Screenshots: shot-welcome/password/backup.png.
- **Open:** home screen is placeholder (balances/send next); import-existing path routes to password but import UI not built; dApp provider/content bridge minimal stub.

### T2 — 2026-10-15 — Full setup: icons + prebuilt dist
- Generated extension icons (16/32/48/128, blue H) and wired them into the manifest (action + icons).
- Rebuilt; `dist/` is a complete loadable MV3 extension (13 MB incl. wallet-core.wasm). Verified end-to-end again (welcome→create→backup, 0 console errors).
- Shipped prebuilt `dist/` so the wallet can be loaded via chrome://extensions → Load unpacked with no build step. Added INSTALL.md.

### T3 — 2026-10-15 — Agent roles defined
- Created `.claude/agents/`: supervisor, frontend, backend, db, re, testing, review,
  compare (TW-vs-Harbour flow diff). Task-scoped specialized agents; main session
  supervises and gates against RE docs + tests + compare reports.
- Note to user: agents are ephemeral (run a task, return), not an always-on org;
  "exactly like TW" = behavioral equivalence on the achievable surface, not byte-identical.

### T4 — 2026-10-15 — Scope correction, local audit and safety/build repairs

- Latest user instruction requires the full target UI/screens/UX and a working
  wallet. The earlier generic light layout and seven-chain launch scope do not
  satisfy it. Governing plan: `../IMPLEMENTATION-PLAN.md`; comparison ledger:
  `../UI-PARITY.md`; verified findings: `../audit/CURRENT-STATUS.md`.
- Found unrestricted page→content→internal-wallet relay. Removed the relay and
  restricted the background router to this extension's exact UI document;
  content-script sender IDs alone cannot authorize internal wallet commands.
  Added negative sender regression tests. Provider implementation remains pending.
- Reject invalid create inputs in background before any vault mutation. This is
  a minimum safety repair; full target password validation is still pending.
- Corrected Node 22 test invocation and made builds copy the hash-verified
  wallet-core WASM automatically. A clean build previously omitted it.
- Dependencies installed with lockfile. `npm test`: 3 passing. `npm run build`:
  passing with WASM. Existing dependency audit: 7 high / 2 moderate advisories,
  recorded in `../audit/harbour-dependency-audit.json`; no forced upgrades.
- Captured Harbour public welcome/password screens and reference
  welcome/authentication/password screens in isolated Chromium. Large layout
  and flow differences are recorded, not claimed fixed. No wallet was created.
- Installed local RE tooling and verified REA recovery via Linux x64 Docker;
  details in `../tools/README.md`. Preserved original supplied ZIP.
- Full wallet implementation and UI equivalence remain **unfinished**. Next
  chronological feature is #02 onboarding; finish its complete spec/fixtures
  before implementation. Root workspace has no Git repository; no commit made.

## T-phase2 — EIP-1193 provider, bridge, and approval surfaces (2026-10-19)

- Implemented the MV3 page provider in `src/inpage/`: EIP-1193 Ethereum methods/events,
  EIP-6963 discovery, Trust-compatible `window.trustwallet` aliases, Solana wallet
  surface, and a private `MessageChannel` bridge. `src/content/content.ts` validates
  request IDs/namespaces/methods/JSON payload budgets, forwards through a named
  runtime port, reconnects after service-worker restarts, and never calls the internal
  popup router.
- Background provider registration now packages `public-production/inpage.js`,
  registers MAIN-world scripts at document start, binds every request to the browser
  sender origin/tab/frame/document, maintains connection/blacklist state, and emits
  only allowlisted events. Storage changes refresh public state so lock/disconnect
  removes exposed accounts.
- Implemented durable approval journaling: queued connect/sign/typed-data/transaction,
  switch/add-chain, watch-asset, and Solana requests are shown in the `/notification`
  window. A claimed request is marked `executing` before key access or broadcast;
  settled results are retained as replay tombstones. Binding snapshots and sender-aware
  request keys prevent changed-account and stale-document replay. The UI disables an
  executing request because a broadcast outcome can be unknown.
- `/approval` is implemented as the target's allowance-management surface, with
  on-chain rechecks and explicit revocation confirmation. Connections, connection
  detail, blacklist, and default-wallet settings are wired to real background stores.
- Evidence: REA recovery and source ranges in `../evidence/30-dapp-approvals/2026-10-19/recovery/`;
  the original 53 MB HAR was preserved and analyzed through the sanitized 1,049,392-byte
  projection (`ev_551b146661f76ad4aeba38f5a5c3feb79f998e627d6b4c43e2cda4f46f188ce3`).
  The HAR shows Sepolia JSON-RPC reads, gas estimation, raw broadcast and receipt
  polling, plus Trust gateway/NaaS traffic; it does not prove WalletConnect behavior.
- Verification: `npm test` 315/315 and `npm run build` pass. Live Chrome dApp interaction,
  approval-window screenshots, and real network signing remain unverified in this run.
- Packaging repair: CRXJS was emitting a dynamic content loader whose hashed chunk could
  become stale in an unpacked extension (`ERR_FILE_NOT_FOUND`). The isolated bridge is now
  bundled by `scripts/build-content.mjs` as static `dist/public-content.js` and registered
  at runtime beside the MAIN-world `inpage.js`; the generated manifest contains no dynamic
  content-script loader.

## T5 — Canonical merge + Wave 2: live home balances (2026-10-15)

**Canonical merge.** Discovered the container variant and the Mac build had diverged. The
Mac build was AHEAD (sender auth via accessPolicy, full common-password list, input
validation, reentrancy guard, defaultCoins, Lottie+QR multi-step onboarding, keystore at
bare `<walletId>` via sk.identifier() — exact TW schema, viem+redux deps). Adopted the Mac
build as the single source of truth; container variant preserved on branch `container-variant`.
Lesson logged: parallel edits to one unversioned tree across sessions cause silent drift.

**Wave 2 — Home balances (live).**
- `src/core/rpc.ts`: per-chain public RPC endpoints (ETH/BSC/Polygon/Arbitrum/Base/Sepolia),
  overridable at build time with `VITE_RPC_<chainId>` (drop in Alchemy/Infura).
- `src/core/balanceService.ts`: viem `getBalance` per EVM chain; all EVM chains share the one
  `ethereum` secp256k1 address. Tolerant — a dead RPC yields ok:false, never throws.
- `src/core/priceService.ts`: best-effort CoinGecko USD prices; {} on failure (UI shows amounts
  without USD rather than breaking).
- `vaultService.getState()`: decrypts vault state with the live session unlock key (no password
  re-prompt) so home can read public addresses.
- background: `getAccounts` + `getBalances` handlers (static imports — see bug below).
- `App.tsx` home: fetches accounts+balances on entry, renders real per-chain native balances +
  USD total, graceful "…"/"—" states.
- test/rpc.test.js: locks the endpoint map. Suite 6/6 green.

**Bug fixed (MV3 SW):** `await import()` inside the service worker threw "window is not defined"
— Vite's dynamic-import preload helper touches window/document, absent in a SW. Switched the
SW's balance/price/chains imports to static top-level imports.

**Verified** end-to-end in headless Chromium: createWallet → home → getBalances returns ok:true
with correct per-chain shape; container egress blocks RPC so values are 0/—, which is the
designed degradation. Real balances populate in the user's browser where RPC is reachable.

**Next:** Send flow (build tx → fee/nonce → sign via wallet-core → broadcast on Sepolia), then
Receive (QR of address). Prices/balances will show live once loaded in Chrome.

## T6 — Full end-to-end wallet: all screens, flow, animations (2026-10-15)

Built the complete Trust-Wallet-style app in one pass. UI/flow reconstructed from the live TW
capture; neutral branding; real Sepolia for chain calls; dummy data for presentation-only screens.

**Architecture**
- `wallet/ui.tsx` — shared kit + animations: injected keyframes (shimmer skeleton, slide-in
  screens, slide-up sheets, fade, spin, pop, animated success checkmark, rise). Icon set, Btn,
  IconBtn, Coin, Row, Screen (pushed view w/ back), Sheet (bottom sheet), Skeleton, Spinner, Empty.
- `wallet/data.ts` — dummy data: assets+prices, trending, dApps, activity, staking, NFTs, buy
  providers, sparkline; formatters. Clearly labelled sample data in-UI.
- `wallet/screens.tsx` — pushed screens: Send (multi-step, real Sepolia send), Receive (QR),
  TokenDetail (sparkline chart + activity), Activity, Buy, Discover (dApps), Search, Staking,
  NFTs, WalletSelector, Settings + Security/Preferences/Networks/About subpages, SwapConfirm.
- `wallet/Wallet.tsx` — host: 4 bottom tabs (Home·Trending·Swap·Earn) + navigation stack
  rendering pushed screens with slide animation; header wallet-selector + globe/search/gear.
- background `sendTx` — derives the ethereum private key via wallet-core StoredKey (session
  password key), signs + broadcasts with viem walletClient. Defaults to Sepolia testnet.
- `.env` VITE_RPC_11155111 = user's Infura Sepolia (rpc.ts override).

**Screens (21 captured headless):** home, trending, swap, swap-confirm, earn, staking,
token-detail, send (form/review/result), receive, buy, activity, nfts, discover, search,
settings, security, networks, about, wallet-selector.

**Animations:** screen slide-in, bottom-sheet slide-up, skeleton shimmer loaders, success
checkmark draw, list rise, tap-scale feedback, tab fade, toggle slide. (TW's exact Lottie files
are proprietary — equivalents drawn fresh, per the branding line.)

**Real vs sample:** real = Sepolia balance + send (viem), EVM balances (browser), QR address,
keystore/crypto. sample = prices, trending, charts, dApps, activity history, staking APRs, NFTs,
buy providers, swap quotes — all labelled in-UI.

---
## 2026-10-16 — Multi-account ("Add account" from Seed Phrase 1)

Wired the previously-dead "Add account" action in the wallet selector. It was a no-op
(`onClick={() => {}}`) and the core had no account-index concept (always derived index 0).

**Evidence**: evidence/08-derivation (decompiled TW `getPrivateKeyForWallet`). TW derives
additional accounts by taking the coin's default path and replacing its LAST "0" with the
account index — e.g. ethereum `m/44'/60'/0'/0/0` → `…/0/1` — then `HDWallet.getKey(coin, path)`.
Replicated exactly (not the "logical" account' component).

**Core** (`walletService.ts`): `accountPath(coin, index)` + `deriveAddressesWithWallet(w, index)`
using `CoinTypeExt.derivationPath` / `getKey` / `CoinTypeExt.deriveAddress`.

**Background** (`background/index.ts`): wallet shape now carries `accounts[]` + `activeAccount`
(legacy single-account vaults migrated in place via `ensureAccounts`). New `addAccount` /
`switchAccount` messages; `getAccounts` returns the account list; `createWallet` seeds Account 1.
`sendTx` now signs with the ACTIVE account's derivation index (was always index 0 — would have
silently signed Account N transfers with Account 1's key).

**UI**: wallet selector lists accounts live, "Add account" derives+activates the next one,
tapping an account switches it; header + settings show the active account name / count.

**Verification**: `test/add-account.test.js` cross-checks the path-string mutation against
wallet-core's structured `getDerivedKey(eth,0,0,i)` for i∈{0,1,2,7} and asserts index 0 == the
canonical address. `npm test` (9/9) green; `tsc --noEmit` + `vite build` clean.

---
## 2026-10-16 — Multi-wallet ("Add new wallet" + Manage wallets, TW selector parity)

Harbour only ever supported ONE wallet (`vault.create` throws if a vault exists; every handler
read `wallets[0]`), so "Add new wallet"/"Create new wallet" had nothing behind it.

**Evidence**: evidence/08-derivation (TW wallet slice) — wallets keyed by uuid, each `{id, type,
name, accountId}`; `accountsPerWallet[id]`; active wallet+account via `setWalletId`; new mnemonics
deduped by checking the ethereum address isn't already present (`MNEMONIC_ALREADY_EXISTS`);
`persistWallet` seeds "Account 1".

**Background** (`background/index.ts`): vault state now has `activeWalletId`; `activeEntry()`
resolves/repairs it; all handlers (getAccounts, getBalances, sendTx, addAccount, switchAccount)
operate on the ACTIVE wallet. New messages: `addWallet` (generate or import a seed, deduped by
ETH address, labelled "Seed Phrase N", activated), `switchWallet`, `listWallets`, `revealMnemonic`
(backup flow). `createWallet` now records `activeWalletId` + label + type.

**UI** (`screens.tsx`): wallet selector rebuilt to TW parity — seed-phrase groups, each listing its
accounts (radio-selected) with a per-group "Add account", then "Add new wallet →" / "Manage
wallets →". Removed the old "Create/Add existing/Back up" rows from the popover (matches TW).
New screens: AddWallet (create fresh / import existing), ManageWallets (seed list + "Back up your
Secret Phrase" link), Backup (reveals/shows the phrase).

**Naming note**: TW's screenshot shows two cards both labelled "Seed Phrase 1" (a TW quirk);
Harbour labels sequentially ("Seed Phrase 1", "Seed Phrase 2", …) — clearer, same structure.

**Verification**: `test/multi-wallet.test.js` asserts distinct seeds → distinct ETH addresses
(both kept) and same seed → identical address (dedupe fires). `npm test` 11/11; `tsc` + build clean.

---
## 2026-10-16 — Edit Wallet screen (rename / reveal / remove + accounts)

Manage wallets → selecting a wallet now opens "Edit Wallet" (was routed straight to backup).

**Evidence**: TW wallet slice — `changeWalletName({id, name})` and `removeWallet(id)` (delete
keystore with password → remove from store → re-point active wallet).

**Background** (`background/index.ts`): new `renameWallet` (sets `w.label`), `removeWallet`
(deletes keystore from storage + drops wallet + re-points `activeWalletId`; refuses removing the
only wallet), `renameAccount` (sets account name).

**UI** (`screens.tsx`): EditWalletScreen — Wallet Name (inline rename, pencil), Secret Phrase
(eye → backup), Remove wallet (red trash → confirm sheet), and the Accounts list; each account
row → AccountDetailScreen (inline rename + copyable EVM address). Added `edit` + `trash` icons.

**Decision**: removing the *last* wallet is blocked (TW drops you to onboarding instead) — safer
for now; say if you want the onboarding-reset behaviour.

**Verification**: `npm test` 11/11; `tsc` + build clean.

---
## 2026-10-16 — Backup Secret Phrase flow (fix "shows nothing" + TW parity)

Root cause: the home "Backup your Secret Phrase now" banner routed to the App-level backup
screen, which renders `mnemonic.split(' ')` from a state var that's only populated right after
wallet creation — so for an existing wallet it rendered a blank grid.

**Fix**: the banner now pushes the in-stack `backup` screen (active wallet), same path the
Manage-wallets / Edit-wallet links use, which pulls the phrase via `revealMnemonic`.

**BackupScreen** rebuilt to TW's flow: warning card ("Back up safely these 12 words… never
share"), a blurred word grid with "Tap to reveal", button Show → Proceed. Proceed calls new
`markBackedUp` (clears `seedPhraseBackupRequired`) so the warning banner/flag goes away.

**Verification**: `npm test` 11/11; `tsc` + build clean.

---
## 2026-10-16 — Search + DApps + Network selector (fresh REA recovery)

These flows were NOT in the existing evidence, so they were recovered with REA's engine
(Wakaru 1.14.0) run directly on the shipped TW chunks (the REA wrapper had no binary
configured). New evidence: evidence/19-search-manage-crypto, 20-dapp-discovery, 21-network-filter,
+ evidence/REA-RECOVERY-NOTE.md.

Recovered from chunks manage-crypto-CZfZXrkn.js, dapps-D5KacSOR.js, HorizontalNetworksFilter-D_mSA3oc.js:
- Search = TW "ManageCrypto": tabs Crypto|DApps; Crypto placeholder "Token name or contract
  address" + "+" action (Crypto only); DApps placeholder "Search DApps".
- Crypto: HorizontalNetworksFilter (All + network chips + count) and asset rows with a Switch
  bound to isShownInHomeScreen (TW emits SET_HOME_OVERRIDE show/hide).
- DApps: FetchDappDiscovery -> sections[{id,name,items[{name,description,url,...}]}] + searchResults;
  DappRow truncates description to 74 chars; errors "DApps are unavailable right now"/"No DApps found".
- Network selector (globe): "Select network" — All Networks + list, radios, search, count button.

**Implementation**:
- background: getUiPrefs / setAssetHidden (SET_HOME_OVERRIDE equivalent) / setNetworkFilter;
  KEYS.UI persists hidden assets + active network filter.
- data.ts: DAPP_SECTIONS (Popular/Latest/Featured) + NETWORKS (from the home asset set); dapp descriptions.
- screens: SearchScreen rebuilt (Crypto/DApps tabs, chip row, toggles, dapp sections);
  NetworkSelectorScreen added. Header globe -> networkSelector. Home crypto list now filters by
  hidden assets + active network. UI prefs persist across unlocks.

**Verification**: `npm test` 11/11; `tsc` + build clean.

---
## 2026-10-16 — Responsive layout (fix fixed 375×600)

Concern: Harbour UI not responsive. Root cause (not a missing TW feature): App.tsx Shell and
Wallet.tsx were hardcoded to `width: 375` / `minHeight: 600` (const W = 375), so the UI never
filled a taller side panel / full tab and could clip in smaller windows.

REA grounding (evidence/22-window-context, recovered window-COx4dq7s.js): TW never pins a pixel
box — it fills its container with viewport-relative sizing (`h-full`, `h-[65vh]`) and detects
context via `isPopupOpened()` / side panel / tab (`useIsCompactView`) to switch modals to
fullscreen when compact.

Fix: global CSS (html/body/#root height:100%, body min-width:360, `.hb-root` = width:100%
max-width:480 margin:auto min-height:100dvh) and both app containers switched to `.hb-root`
(removed the fixed width/height and `const W`). Now fills the side panel / tab and adapts to
width, capped at 480 and centered on wide screens; popup still renders ~360.

**Verification**: `npm test` 11/11; `tsc` + build clean.

---
## 2026-10-16 — Trending tab (TW TrendingTokens parity, fresh REA recovery)

Recovered via REA engine (Wakaru 1.14.0) from App-D29UTaP5.js (`--unpack` -> entry.js module).
Evidence: evidence/23-trending/bundle.js (TrendingTokens page, PriceChangeSelect, table column
defs, MarketSentiment, CategoriesSelect).

Recovered structure: title "Trending"; search (dashboard.tokens.input-placeholder); a controls
row with BlockchainSelect + CategoriesSelect + PriceChangeSelect (1H/24H/7D/1M); a sortable
3-col table (colgroup 42/29/29): Token (icon+symbol+network) | Price (price + %Δ for the selected
timeframe, green/red) | Market (market cap compact + "Vol:" volume). Rows -> token detail;
30 skeleton rows while loading; empty "Token not found".

Implementation:
- priceService.fetchTrending now requests price_change_percentage=1h,24h,7d,30d + market_cap +
  total_volume, so the timeframe selector and Market column are REAL CoinGecko data (not faked).
- Wallet.tsx: replaced the old chip-list trending with a <TrendingTab> — search, 1H/24H/7D/1M
  timeframe dropdown, sortable Price/Market headers, Token|Price+%Δ|MarketCap+Vol rows, skeletons,
  "Token not found" empty state.

Scoped out (needs a backend Harbour doesn't have): the category taxonomy and per-network trending
feed (TW's CategoriesSelect + FETCH_TRENDING_NETWORKS). Noted as a gap.

**Verification**: `npm test` 11/11; `tsc` + build clean.

---
## 2026-10-16 — Trending: all 3 dropdowns (Networks / Trending category / timeframe)

Follow-up: the first Trending pass had only the 24H dropdown. RE'd the other two from the
recovered entry.js (evidence/23-trending): BlockchainSelect (Networks) and CategoriesSelect
(Trending category).

- BlockchainSelect: compact "Networks" button -> dropdown with "Network Name" search, "All
  Networks" + network list, radios. Implemented and wired to REAL CoinGecko ecosystem-category
  filtering (ethereum-ecosystem, binance-smart-chain, polygon/arbitrum/base/solana-ecosystem).
  Only networks with an ecosystem feed are listed; selecting one re-queries that chain's tokens.
- CategoriesSelect (Trending): TW's category list is backend-driven (FETCH_HOT_TOKEN_CATEGORIES),
  so the exact names are NOT in the bundle. Backed here with real CoinGecko sort/order modes —
  Trending (default, market_cap_desc), Top Gainers, Top Losers, Market Cap, Volume — matching the
  dropdown structure and the screenshot's "Trending" default. Honest substitute, not a faked API.
- PriceChangeSelect (24H): 1H/24H/7D/1M (unchanged).

Data layer: fetchTrending(opts) now takes {category, order}; getTrending passes them through.
TrendingTab self-fetches on network/mode change; header sort (Price/Market) overrides mode sort;
timeframe switches the %Δ column.

**Verification**: `npm test` 11/11; `tsc` + build clean.

---
## 2026-10-16 — Trending: responsiveness + UI polish (HAR was invalid)

Provided HAR (Trust_wallet.har) contained only Google new-tab traffic (gstatic/ogs.google.com),
zero Trust Wallet / gateway calls — so TW's real trending endpoints could not be extracted from it.
Data source remains live CoinGecko (real market data) until a valid TW HAR is supplied.

UI / responsive improvements to TrendingTab:
- Controls row (Networks / Trending / timeframe) now flex-wraps instead of overflowing on narrow widths.
- Dropdowns: click-away overlay to close, active (accent) state, surface-colored panel.
- Table: sticky header while scrolling; row hover (.hb-trow); tabular-nums on Price/Market columns.
- fmtPrice: significant-digit formatting for sub-$1 tokens (e.g. $0.005857) matching TW; fmtPct with
  thousands separators for large % moves.

**Verification**: `npm test` 11/11; `tsc` + build clean.

### Needed from user: a valid TW HAR to fetch TW-exact trending data
The trending calls come from the extension's service worker/popup, not a normal web page, so a
new-tab HAR won't contain them. Capture via chrome://extensions -> Trust Wallet ->
"Inspect views: service worker" -> Network -> open Trending in the popup -> Save all as HAR;
or expand TW to a full tab (home.html) and record Network there. Look for
gateway.us.trustwallet.com requests (hot tokens / categories / trending networks).

## HAR-driven Trending alignment (network-log.har)
- Evidence: evidence/24-har-api-contract/API-CONTRACT.md (34 distinct TW gateway calls), test/fixtures/tw-listings.json.
- TW Trending = GET gateway.us.trustwallet.com/v1/assets/listings (category_id, networks, sort_field, sort_direction, limit, version=27). Auth is a TW device credential; Harbour deliberately does NOT call it (impersonation/ToS).
- Implemented: src/core/twTaxonomy.ts (real network coin ids, category ids, default network set, listing response shape + adapter); Trending dropdowns now use TW network coin ids + category ids; data stays CoinGecko.
- Unmapped: category 'bstocks' (no verified public equivalent); HyperEVM/Robinhood/Arc networks have no CoinGecko category so are hidden from the network dropdown.

## Swap tab rebuild (2026-10-16)
- Evidence: evidence/25-swap/ (serializer schemas, TW strings, SWAP-SPEC.md with confidence tags, gaps and deviations).
- Core: src/core/swap/* (types, domains, amount, errors, rules, tokens, lifi, jupiter, engine, safety). Background: src/background/{keys,swapService}.ts + message cases swapState/SetSettings/SearchTokens/Balances/Max/Quote/Approve/Submit/Status/History (old 0x getSwapQuote removed).
- UI: src/popup/wallet/swap/{SwapTab,parts,sheets,screens,swapStore}; old hardcoded SwapTab (Wallet.tsx) and SwapConfirmScreen (screens.tsx) deleted.
- Sources: LI.FI (EVM + single-tx bridge), Jupiter lite-api (Solana), trustwallet/assets logos, public RPCs. TW's gateway is NOT used.
- Verification: tsc clean, build clean, `npm test` 30/30 (13 old + 17 new in test/swap.test.js).
- NOT verified: live LI.FI/Jupiter responses (egress blocked, not bypassed), visual QA in Chrome, any real mainnet swap. Not implemented: BTC/THORChain, multi-leg, EVM<->Solana, gasless, VIP fees, RWA/geoblock, dust cleaner.

## Token detail: real chart, history, market info (2026-10-16)
- Problem: Token detail chart used the static SPARK array and History used the static ACTIVITY sample; range pills did nothing; Activity screen was sample data.
- TW evidence (HAR): `GET gateway.us.trustwallet.com/v2/market/charts/c<coin>?currency=USD&period=day` -> {prices:[{price,date}]}; `/v2/market/info/c<coin>`; `/v1/txhub/txs?asset&chain&address&from&to&limit=50`, `POST /v1/txhub/bulk_history`. All on TW's authenticated gateway: NOT used. Only `period=day` was captured; other TW periods UNKNOWN.
- Harbour sources: CoinGecko market_chart + coin info (src/core/marketData.ts); history via Blockscout v2 (ETH/Base/Arbitrum/Polygon/Sepolia), Routescan etherscan-compatible (BNB), Blockstream Esplora (BTC), Solana RPC signatures (src/core/txHistory.ts). Background messages tokenChart/tokenInfo/txHistory. UI: src/popup/wallet/tokenData.tsx; TokenDetailScreen + ActivityScreen rewired.
- Verification: tsc clean, build clean, `npm test` 41/41 (11 new in test/history.test.js, fixtures from public docs).
- NOT verified: live responses of any of these APIs (egress blocked, not bypassed); visual QA. Known gaps: only native-asset transfers (no ERC-20/SPL), Solana rows have no amounts/direction, BNB provider coverage is a guess, Blockscout Polygon host is [likely], CoinGecko free tier rate limits and caps "All" at 1 year, no USD value per history row.

---
## 2026-10-19 — Documentation sync and new mandate
- Re-read all REA docs and the source. Recomputed screen status in `UI-PARITY.md` (code-inspected); noted the user-updated
  theme and two palette conflicts in `DESIGN-SYSTEM.md`; added governing rules to `AGENTS.md`; new research items #30–#39 in
  `rebuild-tracker.md`; revised build order in `IMPLEMENTATION-PLAN.md`.
- Verification: `npx tsc --noEmit` clean on the current tree before any new work.

---
## 2026-10-19 — Chain registry: Trust Wallet's 86 enabled chains (gap-fill #1)
- Found user's refreshed `network-log.har` (151 MB, 3,467 entries, last entry truncated) with `/v1/balances/chains` (86 enabled). Mapped every
  chain id to wallet-core CoinType (all 86 present in 4.8.2). Generator + evidence in `evidence/30-chain-registry/`.
- New modules: `src/core/chains/{types,index,registry.json,rpcUrls}.ts`, `src/core/chains/adapters/{types,index,evm,solana}.ts`.
  `core/chains.ts` is now a legacy view over the registry. Home/Search/Networks/Activity assets derive from the registry (`popup/wallet/data.ts`);
  no hard-coded prices remain for natives. `getBalances` now reads balances through per-family adapters and prices via CoinGecko ids (`fetchNativePrices`).
  Fresh wallets show Trust-Wallet-style default assets only (`DEFAULT_HOME_CHAINS`); other chains are enabled in Manage crypto.
- Coin logos: 82/86 chain logos bundled from public `trustwallet/assets` into `public/chains/`; letter-avatar fallback for the rest.
- Derivation now also covers HyperEVM / Robinhood Chain / Arc (in registry, not in the 128-coin default list).
- Modularity: `background/handlers/*` (pluggable message handlers) and `popup/wallet/features/*` (pluggable screens) added; `background/walletState.ts` extracted.
- Housekeeping: deleted stale `dist.prebuild-*` and `vite.config.ts.timestamp-*` (delete permission granted by user).
- Verification: `tsc` clean, `npm test` 114/114 (new `test/chains.test.js`), `npm run build` OK. NOT verified: any live RPC/CoinGecko call (sandbox egress blocked), visual QA.

---
## 2026-10-19 — UI-only polish and built-extension visual audit
- User narrowed this session to existing UI/UX; no new wallet feature, route, background contract, approval flow, or network adapter was added.
- Fixed the asset packaging path: 82 chain marks downloaded under `public/chains/` had never entered Vite's `public-production/` bundle. Copied them to `public-production/chains/`, retargeted `scripts/fetch-chain-logos.mjs`, and passed chain IDs to the shared Coin view in Receive, Send, Search, network selection, token detail, and token-network rows. Removed fragile remote Trending image hotlinks in favor of curated bundled marks and neutral fallback. Hash manifest: `audit/ui/2026-10-19/chain-logo-manifest.json`; provenance/rights limits: `ASSET-LEDGER.md`.
- Unified the existing controls further: accessible wallet-select button and sheet dialog/Escape semantics, input/number formatting and reduced-motion treatment, consistent wallet avatar, a clearer empty state, and removal of an inert Send scanner affordance.
- Removed production display of static provider quotes, staking APRs/positions, sample NFT ownership, and invented DApps. Those existing views now explain their unavailable integration without presenting fixtures as live.
- Ran the built MV3 extension in disposable Chromium profiles and captured/inspected 27 popup states/layouts at 320/375/480 px (including Send invalid-input/sheet and Trending loading/settled) plus create/import onboarding screens. `audit/ui/2026-10-19/checks.json`: 27 captures, zero page errors, zero missing images, zero horizontal-overflow checks after repair. Navigation and dark-mode selection were exercised; financial operations were not.
- Validation: `npm run build` passes; focused settings/chain tests 32/32 pass. Full suite currently 147/156: 9 failures in history and staking/signing tests unrelated to the UI edits. They remain open; no whole-wallet success claim.

---
## 2026-10-19 — Multi-chain data adapters (worker NN=32)
- Evidence/status: `evidence/32-chain-data/STATUS.md` (per-family Real/Unsupported, endpoints, live-unverified); `evidence/30-chain-registry/ADAPTERS.md` rewritten.
- Balances: every registry family now has a native-balance adapter (`core/chains/adapters/{utxo,cosmos,substrate,others}.ts`, helpers `codec.ts`, `net.ts`); only Nimiq and Aion are explicit "unsupported". Polkadot/Kusama use Asset Hub (relay-chain registry endpoints would return a stale 0).
- Tokens: SPL + TRC-20 balances/probes (`adapters/tokens.ts`), handlers `chainDataToken*`, vault field `customChainTokens`, new screen `addChainToken` (Select network lists Solana/Tron), Home merges them with EVM tokens (`tokensStore.ts`), detail screen branches on `token.chain`.
- History: `fetchHistory(chain|id, address)` in `core/txHistory.ts` now covers EVM (+ERC-20, optional explorer-reported USD), Esplora and 17 non-EVM families (`adapters/history.ts`); `HistoryItem` gained `token?`/`usd?`. Activity screen aggregates all visible supported chains.
- Gas station: `core/gasFees.ts`, `features/gas.tsx` (screen `gasStation`, linked from Token detail of EVM natives), message `chainDataGas`.
- Shared-file patches (anchored): `handlers/index.ts` (+chainData), `features/index.ts` (+gas), `background/index.ts` txHistory input validation regex, `screens.tsx` (TokenDetail balance + gas link, Activity), `tokensStore.ts`, `tokenScreens.tsx`, `customTokens.ts` (optional `chain`/`standard`), `core/chains/index.ts` (explorer URL fix: prefix-style paths lost the hash).
- Deviations: public APIs instead of TW NaaS/gateway; gas tier formula is Harbour's; Solana token names via Jupiter index (verified against on-chain decimals).
- Verification: `npx tsc --noEmit` clean; `test/chain-data.test.js` (27) + `test/chain-data-handlers.test.js` (3) pass. Full `npm test`: 7 failures in other workers' in-flight suites (send EVM legacy/IoTeX, cosmos/solana staking signing, lido) — none touch these modules.
- NOT verified: all live endpoints, visual QA of gas/add-token screens, Blockscout hosts for non-core chains, Send for SPL/TRC-20.

## 2026-10-19 Ramps, Fund, Discover, Sentiment, Help (worker NN=36/37)
- Core: `src/core/ramps/*`, `src/core/discover/*`, `src/core/sentiment/*`; handlers `handlers/ramps.ts`, `handlers/discover.ts`.
- UI: `features/{ramps,rampFlow,rampSteps,rampFund,rampKit,discover,dappsPanel,sentimentHelp}.tsx`. Screens: fund, buy, sell, fiatRamps, fundCex*, rampApiKeys, discover, marketSentiment, help.
- Shared patches (anchored): `screens.tsx` (removed static Buy/Discover, DApps tab uses DappsPanel), `Wallet.tsx` Fund -> `fund`, `settingsScreens.tsx` Help -> `help`, `data.ts` static TRENDING/DAPPS/BUY_PROVIDERS removed.
- Deviations: recurring buy = Mercuryo first buy + .ics; no shared keys (user adds own, local only); DeFiLlama directory; sentiment from public feeds.
- Verification: tsc clean except unrelated ImportSecret; npm test 251 pass. Not verified: all live endpoints, visual QA.

## 2026-10-19 — Custom network visibility repair
- Root cause: `NetworkSelectorScreen`, Search, and the home asset filter consumed static `NETWORKS = ASSETS.map(...)`; custom networks were correctly validated, persisted, and available to background RPC/send handlers but could never enter the popup catalog.
- Fix: `data.ts` now derives custom native assets and `networkOptions()` from the synchronized `networkRegistry`; Wallet refreshes after `syncNetworks`, and the selector also synchronizes on mount. Custom native assets therefore appear in the home selector and the Send/Receive asset pickers with their saved chain ID/symbol.
- Verification: `npx tsc --noEmit` and `npm run build` pass; focused network/settings tests pass (22/22). Chrome interaction with a live custom RPC remains pending.

## 2026-10-19 — dApp provider stack (worker NN=31)
- Evidence/status: `evidence/31-dapp-provider/STATUS.md` (Real/Partial/Gap per screen and flow).
- Page: `src/inpage/*` (EIP-1193, EIP-6963, `window.trustwallet`, Solana + Wallet Standard), bundled by `scripts/build-inpage.mjs` into `public/inpage.js`; `src/content/content.ts` is a validating relay.
- Core/background: `src/core/provider/*` (protocol, methods, stores, decode, typed, siwe, solanaTx, phishing, evmSign), `src/background/provider/*` (service, ports, approval window, rpc, fees, signer), handler `handlers/provider.ts`.
- UI: `features/provider.tsx` (approval surface at `#/notification`, Connections, Blacklist, Connection detail, token approvals panel).
- Shared patches: `background/index.ts`, `manifest.config.ts` (exclude_matches), `package.json` build step.
- Verification: `tsc` clean; `test/provider.test.js` 60/60; full `npm test` 328/328. Not verified: any live RPC/phishing list, MAIN-world injection in a real Chrome profile, visual QA, Solana page object in a browser.

## 2026-10-19 — Send / Receive / Transaction detail (worker NN=33)
- Evidence: `evidence/33-send-receive/{SPEC,STATUS}.md`, `tw-strings.json` (68 recovered TW strings).
- Core: `src/core/chains/send/*` (one module per family, `index.ts` support matrix), `src/core/sendService.ts` (records, ENS/SNS, payment URIs, recipient risk). Background: `handlers/chainSend.ts`, `keys.ts` gained `privateKeyFor` (key returned as a copy, zeroed by the handler).
- UI: `popup/wallet/send/*` (select, prepare, confirm, transaction, receive, extras, parts, lib, store), registered in `features/send.tsx`; `screens.tsx` Send/Receive blocks replaced by thin re-exports.
- Verification: `npx tsc --noEmit` clean for these files (remaining errors are in `onboarding/ImportSecret.tsx`, another worker); `npm test` 334/334 including 48 send tests (mocked fetch, no broadcasts). Not verified: any live network, visual QA in Chrome, camera QR on a device.

---
## 2026-10-19 — Earn/Staking (34) + NFTs (35)
- Core: `src/core/staking/*` (registry, validators + bundled snapshot, cosmos, solana, evm [Lido, BNB StakeHub], service), `src/core/nfts/*` (media sanitiser, spam heuristic, blockscout, solana DAS/Magic Eden, transfer builders, service).
- Background: `handlers/earn.ts` (+`earnKeys.ts`, `earnEvm.ts`), `handlers/nfts.ts`. UI: `features/earn.tsx`, `earnParts.tsx`, `nfts.tsx`. Wallet.tsx Earn tab -> `EarnTab` (hidden for hardware/non-mnemonic wallets); static StakingScreen/NftsScreen and STAKING/NFTS constants deleted (screens.tsx, data.ts).
- Public equivalents used: trustwallet/assets validators lists, chain LCD/RPC, Lido, StakeHub, Blockscout v2, Solana DAS/Magic Eden. TW gateway not used. Evidence: evidence/34-staking, evidence/35-nfts.
- Verification: tsc clean; `npm test` 334/334 (test/staking.test.js 15, test/nfts.test.js 12). Signing vectors are self-generated regression pins, not official.
- NOT verified: any live network call, any broadcast, visual QA in Chrome, StakeHub ABI/addresses, Magic Eden access.

## 2026-10-19 NN=38 Onboarding branches, settings gaps, theme
- Core: importKey, onboardingRules, qrImport, backupVerify, settingsExtra. Background: handlers/onboardingExtra (status, importInitiate/Complete/Cancel, qrVerify/qrImportAll, resetEmptyVault, validatePrivateKey), handlers/settingsExtra (walletsDetailed, walletBalances, revealPrivateKey); keys.ts/index.ts handle private-key wallets, 30-wallet limit.
- UI: onboarding/Onboarding.tsx rewritten (+ImportSecret, qrScanner, BackupFlow, instructions); features/onboarding.tsx, features/settings.tsx, wallet/walletScreens.tsx; settingsScreens.tsx completed; tokenised system.css/onboarding.css.
- Verification: tsc clean; npm test 334/334 (test/onboarding-import.test.js 16). Mocked fetch only.
- NOT verified: any browser run, camera, WebAuthn, live Solana RPC, dark-mode visual audit, Send handling of migration params.

## 2026-10-19 — Integration gate (lead)
tsc clean; npm test 334/334; vite build OK. Workers 31/33/34/35/38 delivered (see evidence/*/STATUS.md). Open: WalletConnect v2, Ledger, live verification, Chrome visual QA, migration->send param check.

## 2026-10-19 — Padded hex quantities in eth_sendTransaction
Uniswap swap failed with `Invalid value.` (normalizeSendTx rejected a leading-zero `value`, e.g. ethers-v5 `0x0f4240`). `src/core/provider/methods.ts` now accepts padded hex quantities and canonicalises them; non-hex/oversized still rejected. Cause inferred from the error text (`Invalid ${k}.`), not from a captured request. Verified: tsc + node tests only, not in Chrome.

## 2026-10-19 — Connected dApp indicator on Home
Home header shows the active tab's connected site (icon + green dot) beside the Networks button; tap opens a card (network + Connected, site icon/name/host, Disconnect). New background message `providerCurrentSite` (chrome.tabs active tab -> perms.get(origin)); Disconnect reuses `providerDisconnect`. `add-cutom-network.har` contains only network traffic (no UI), so layout follows the supplied Trust Wallet screenshot; the HAR confirms one `validate/url` site check for chainlist.org and an RPC call to the custom network. Verified: tsc/tests/build only, not in Chrome.

## 2026-10-19 — WalletConnect v2 (Harbour-side equivalent)
**Evidence correction:** TW 26.41.0 ships no pairing/relay/session client (only a Kotlin request mapper) — `evidence/16-walletconnect-BLOCKED/README.md` addendum (scripted search, not REA).
**Built:** `@reown/walletkit@1.6.0` + `@walletconnect/core@2.25.0` (+`utils@2.25.0`) in the service worker.
- `src/core/walletconnect/index.ts` — pure policy: `wc:` URI validation (v2/irn only, expiry), `negotiate` (required namespace/chain/method/event that Harbour can't meet refuses the proposal; optional narrowed; nothing unrequested granted), `mapRequest` allowlist (EVM: personal_sign, eth_sign, eth_signTypedData[_v3/_v4], eth_sendTransaction, wallet_switch/addEthereumChain, wallet_watchAsset; Solana: signMessage, signTransaction; no eth_signTransaction/Cosmos), Solana result shape mapping.
- `src/background/walletconnect/{bridge,kit}.ts` — relay events -> `ProviderService` via a synthetic sender (`tabId -1`, `documentId wc:<topic>`); outcomes routed back by `deliver()` in provider/index.ts; sessions indexed in `harbour:wc:sessions`; WalletKit storage on chrome.storage.local; resume + 30 s alarm while sessions exist; origin disconnect / session_delete end both sides.
- `ProviderService`: new pending kind `wcSession` (queued like connect, executed via `negotiate` then `host.approve`, then `perms.connect`); `view.ts` builds the proposal view; `features/provider.tsx` renders it (account select, verify banner, granted networks/methods).
- Handlers `wcStatus/wcSetProjectId/wcPair/wcDisconnect`; screen `features/walletconnect.tsx`; entry row in Connections; QR scan via `AddressScanner` new `onRaw` prop.
**Security decisions:** dApp URL is self-declared, so a proposal flagged scam is refused unprompted, and an unverified (INVALID/UNKNOWN) proposal claiming an already-connected site's address is refused; INVALID/scam on a new site needs the explicit acknowledgement box. Every request still passes the provider router and approval UI; WC request chain is bound to the connection chain before queueing.
**Verified:** tsc, `npm test` (349 pass; 12 new in `test/walletconnect.test.js` + 1 ProviderService test), `npm run build`, and WalletKit `init` in a window-less service-worker-like VM (stub WebSocket).
**NOT verified / UNKNOWN:** any live relay session (needs a Reown Cloud project ID, entered in the screen or `VITE_WC_PROJECT_ID`; I have none); Chrome runtime behaviour of the worker while idle; Reown Cloud domain allow-list vs `chrome-extension://` origin; wallet metadata URL is the placeholder `https://harbour.invalid`. Known limits: concurrent WC requests on different chains can invalidate each other's binding (safe: they fail with "connection changed"); WC request expiry is not honoured (15 min pending TTL); `session_authenticate` (SIWE) is rejected as unsupported; no accountsChanged/chainChanged events are pushed to WC sessions.

## 2026-10-19 — Cleanup
Removed stale `content.js`, `public/`, empty `src/popup/provider/`; fixed path comment in `scripts/build-inpage.mjs`. Unreferenced-module scan found no other dead files. Added `FEATURE-MATRIX.md`. Gate: tsc clean, 349/349, build OK.

## 2026-10-21 — Backend reverse-engineering documentation (no build change)

User scope: use REA on supplied Trust Wallet v26.41.0 for backend, DB, stack and
end-to-end API documentation. Deliverables: root `TRUST-WALLET-BACKEND.md` and
`evidence/40-backend-api/2026-10-21/` with 73 recovered ApiService methods,
historical HTTP/RPC shape catalogues, exact local SQL/storage and bounded auth,
streaming, WebSocket/device evidence. Actual server DB/framework remain UNKNOWN;
a proposed equivalent architecture is explicitly separated from recovered facts.

Verification: 238 JS files parsed; source-range/input/recovery digests and document
links checked; 6 controlled synthetic auth-function checks pass. Pinned offline
REA 6.5.0/Wakaru 1.14.0; no new tools installed. No app source changes, app tests,
Chrome execution, live API calls or backend deployment in this documentation pass.
No implementation, integration or parity status upgraded. See the evidence README
for capture truncation, redactions, exact evidence IDs and unresolved requirements.

## 2026-10-21 — Harbour parity plan (doc 11), first implementation pass
Done: kernel (event registry, INTERNAL_/PUBLIC_ namespaces, boot loop, persisted queue, self-heal guard), `wallet:store` migrations (pre/post), worker RTK store with the 16 TW slice names + `harbour-ui` port (snapshot/patch) + popup `useWorkerState`, Harbour Kit (HttpClient, NodeRepository, failover/race, gateway client, Ed25519-signed remote config, CoinGecko/DefiLlama price chain, GoPlus checks, eth_simulateV1 preview, Hyperliquid + Polymarket read-only, all flag-gated), `gateway/` Cloudflare Worker (keys server-side), LI.FI key removed from the bundle, swap quotes carry token-risk warnings.
Verified: tsc clean; vite build OK; no API-key strings in bundle; 330/330 unit tests (2 only pass outside the read-only mount: they unlink temp files); real Chromium smoke test of the built extension (boot, migrations, port snapshot, events, store persisted as [1,0,state]).
Not done / needs live resources: gateway deploy + keys, Relay/THORChain swap execution (unverified API shapes, signs funds), Hyperliquid/Polymarket trading, new provider families (Cosmos/Aptos/Sui/TON/Tron/BTC), chain registry 86->168, Ledger WebHID, push, perps/prediction signing, UI screenshot parity, mainnet QA.

## 2026-10-21 (later) — gateway live
Deployed `harbour-gateway` (workers.dev). `scripts/check-gateway.mjs`: all 15 route checks PASS (health, signed config, prices, Helius, Alchemy x5 chains, Etherscan chain 1, TronGrid, LI.FI, Jupiter, allowlist rejections). Extension routes Solana RPC via Helius and EVM RPC via Alchemy when VITE_HB_GATEWAY_URL is set; Alchemy NFT primary (Blockscout fallback); Etherscan V2 history fallback for Ethereum. Production bundle: gateway URL embedded, 0 secret values present.
Known provider limits: Etherscan free plan covers Ethereum only; Toncenter key is testnet-only (needs a mainnet key); Polymarket host unreachable on this network (feature stays off).

## 2026-10-21 (Phase 1/2 completion)
Old 600-line router split into modules/{wallet,market,swap,tokens,send,settingsCore}.ts (58 events, all named INTERNAL_*); index.ts is 69 lines. Real-Chromium smoke: create wallet -> lock -> bad/good unlock, store slices follow. Added tests: boundaries (popup may not import vault/keys/wallet-core/storage/background), migrations (old profile, rerun no-op, crash resume). Kit: NodeRepository now drives viem fallback transport (swap + send) with rank tiers; `npm run verify` (tsc, gateway tsc, tests, prebuild, build, secret scan) + .github/workflows/harbour-ci.yml.
Not done: popup screens still use their own stores rather than the worker mirror; opt-in telemetry (needs a Sentry DSN); earn/naming/ramp Kit clients (existing core modules already cover them).

## Phase 3 — chain breadth (partial)
- 13 extra wallet-core chains in `registry.extra.json` (10 EVM + LTC/DOGE/DASH via Blockbook), hidden until listed in `extra-enabled.json`.
- UTXO adapters (balance, send/fee/broadcast/status, history) now speak Blockbook (`chain.api === 'blockbook'`).
- `node scripts/check-chains.mjs --write` probes endpoints live and enables only passing chains. tsc clean, 353 tests pass.

## Phase 4 — dApp provider families (partial)
- New generic namespace `multi` (core/provider/multi.ts, inpage/multi.ts): Cosmos (Keplr API: enable/getKey/signAmino/signDirect/signArbitrary/offline signers, 11 chains), Sui (Wallet Standard connect + signPersonalMessage), Aptos (Petra-style window.aptos: connect/account/signMessage/signTransaction of built RawTransaction), Tron (TronLink request + tronWeb sign/signMessageV2; txID must equal sha256(raw_data)), Bitcoin (accounts + BIP-137 message signing).
- Same approval queue, per-origin Connection.others, binding check (account change invalidates pending), approval screen shows decoded Cosmos msg types / Tron contract / message text.
- Not done: TON Connect, Sui/Aptos transaction *building* (needs SDKs), Bitcoin PSBT signing, SIWS, biometric approval, per-load handshake nonce, test-dApp suite in Chrome. 363 tests pass; verify.mjs green.

## 2026-10-21 — Upload archive root repair

Inspected `/Users/jatinsharma/Desktop/Harbour.zip`: extension manifest was at
`dist/manifest.json`, with a `dist/` wrapper and macOS metadata. Created
`harbour-wallet-v2/releases/Harbour-root-fixed.zip` by stripping that wrapper and
omitting hidden metadata; retained runtime bytes are identical to the uploaded
archive. Root manifest, ZIP CRC and manifest file references pass. Hashes and
checks: `harbour-wallet-v2/releases/Harbour-root-fixed.validation.json`.
This repackages the October 19 archive; it does not rebuild current source.
Firefox compatibility remains incomplete (Chromium service worker/side panel);
no AMO upload, signing or Firefox runtime verification performed.

## Phase 4 — gap closing (2026-10-21)

Closed the Phase 4 gaps before Phase 5:
- TON Connect (`window.harbourTon`): wallet v4r2 identity, `ton_addr` + `ton_proof`, `sendTransaction` via toncenter. `signData` is not supported.
- Sui and Aptos transaction building, simulation and submission (`signTransaction` / `signAndExecute` / `signAndSubmit`) on mainnet.
- Bitcoin `signPsbt`: P2WPKH inputs, SIGHASH_ALL, BIP-143, optional finalize.
- SIWS (`solana:signIn`): message parsing, plus origin, domain and expiry warnings on the approval screen.
- Opt-in biometric approval (Connections → toggle): a single-use proof that lasts 60 s and is bound to one pending request.
- Per-load nonce handshake between the inpage script and the content script.

Service-worker fixes found by the real-Chrome e2e run:
- `build.modulePreload:false`: Vite's preload helper touches `document`.
- No dynamic `import()` in the background, because MV3 forbids it in service workers. Chain SDKs are now static imports in `multiBuild.ts`.
- `src/background/globalShims.ts` sets the `Buffer` global and must stay the first import of the entry file. Without it, registration fails with status 15.
- A minimal `window.crypto` shim is applied only around the TON SDK calls.

Results:
- Chrome e2e passes for connect and sign on Cosmos, Sui, Aptos, Tron and Bitcoin, plus TON connect with `ton_proof`.
- Unit tests: 371 pass. `verify.mjs` passes.

Still not tested:
- Live Sui and Aptos transactions and TON send: the sandbox has no access to those RPCs.
- Real third-party dApps such as the Keplr, Sui and TON Connect demos.

## Phase 5 — money features (2026-10-21)

**Swap**
- Quote racing (`core/swap/engine.ts`): LI.FI, Relay, Jupiter and THORChain are queried in parallel, each capped at 12 s. Failed providers are dropped while any provider answers. The best output is tagged "Best" in the provider sheet. If all providers fail, the user-fixable error (amount, pair) wins over network errors.
- Relay (`relay.ts`, gateway `/relay/*` with `RELAY_API_KEY`): EVM-source swaps and bridges, including EVM to Solana. At submit time Harbour re-quotes, and only signs approve and deposit items that match the confirmed quote: same chain, our address, the confirmed spender, value capped, and output within slippage. Signature-type steps are refused. Settlement is polled via `/intents/status/v2`.
- THORChain (`thorchain.ts`, public THORNode via Liquify/Ninerealms, or gateway `/thornode/*`): BTC to and from ETH, BNB, Base natives and ERC-20s. There is a new `bitcoin` swap domain.
  - BTC sends to the vault with the memo in an OP_RETURN (wallet-core `outputOpReturn`).
  - EVM sources call `router.depositWithExpiry`; ERC-20 sells approve the router first.
  - Harbour fetches a fresh quote before sending and requires the memo's payout address to be our own.
  - Settlement is read from `/thorchain/tx/status`; a REFUND outbound counts as failed.
- LI.FI Solana-source bridge legs are now signable when we are the sole signer and fee payer.
- Payouts always go to our own account address, never to an address carried in the route.
- Dust cleaner (Swap settings → "Clean up small balances"): curated and recent tokens on the current network worth $0.01–$5, converted to the native coin one swap at a time.

**Gasless (beta)** (`core/swap/gasless.ts`): EIP-7702 delegation to the Ethereum Foundation's Simple7702Account (EntryPoint v0.8, audited by Spearbit), plus a Pimlico-sponsored UserOperation through gateway `/pimlico/<chainId>` with `PIMLICO_API_KEY`.
- Supported chains: Ethereum, BNB Chain, Polygon, Arbitrum, Base.
- Off unless the remote flag `gasless7702` is on AND the user enables "Gasless swaps (beta)".
- Approve and swap are batched in one user operation.
- Safety checks:
  - accounts delegated elsewhere are refused;
  - the delegate's `entryPoint()` is checked before signing an authorisation;
  - any unavailability falls back to normal transactions.

**Earn**
- TRON (Stake 2.0): freeze, vote all TRON Power, claim, unfreeze (14 days), withdraw expired, redelegate votes.
- Tezos (TzKT and node RPC): baker delegation, undelegation, redelegation; the reveal operation is added when needed.
- Cardano (Koios): register the stake key (2 ADA deposit), delegate, redelegate, claim, unstake.
  - Claim adds a DRep "always abstain" vote delegation, which reward withdrawals require since the Plomin hard fork.
  - Unstake withdraws rewards and deregisters the stake key.
  - Cardano is a new extra chain (balance, send, staking). It stays off until `node scripts/check-chains.mjs --write` passes it.
- Polkadot nomination pools on Asset Hub, via `@polkadot/api` 16.5.6 (live metadata) and an ed25519 raw signer: join, bond extra, claim, compound, unbond (28 days), withdraw.
- Rocket Pool (rETH) is offered next to Lido for ETH. Deposits respect the deposit-pool maximum. Unstaking burns rETH when the protocol has collateral; otherwise the user is told to swap.
- Earn UI: compound for Cosmos and Polkadot; claim wherever rewards are claimable; no amount field for whole-balance delegation (Tezos, Cardano).

**NFTs**
- EVM collection floor price from Alchemy's OpenSea metadata, shown on the collection screen.
- Report/hide, the spam filter and Solana DAS already existed.

**Ramps**
- Buy, sell, recurring buys, P2P, CEX funding and the trusted-address guard already existed (no change).

**Gateway**
- New routes: `/relay/*`, `/thornode/*`, `/pimlico/<chainId>` (method allowlist).
- `deploy-gateway.mjs` pushes `RELAY_API_KEY` and `PIMLICO_API_KEY`.
- `config.json` adds the `gasless7702: false` flag.

**Results**
- Tests: 384 pass (new: `swap-providers`, `staking-phase5`, `gasless`). `verify.mjs` passes.
- Real Chrome: the service worker starts, there are no Phase 4 regressions, and `swapState` reports `gasless:false` by default.

**Not tested live** (the sandbox cannot reach these APIs):
- Relay, THORNode and Pimlico responses;
- TronGrid staking contracts, TzKT, Koios and Polkadot Asset Hub;
- Rocket Pool contract reads.

Mainnet test with small amounts before release.

## Phase 6 — markets, discover, notifications (2026-10-21)

**Market data fallbacks** (`core/marketData.ts`)
- Each lookup tries, in order: gateway `/v2/market/charts`, then `/info` (CoinGecko with the server key, cached in KV), then CoinGecko direct, then DefiLlama (`coins.llama.fi` chart, or price only for info).
- Native coins resolve through the registry `cg` id, so every mainnet chain gets a chart, not only the 7 curated ones.
- Tokens (`token:<chainId>:<address>`) use GeckoTerminal: the top pool's OHLCV for charts, plus token price, FDV and volume. The custom-token detail screen now shows a DEX price chart (1H–1Y).
- Trending lists use gateway `/v2/market/tickers`, then CoinGecko.

**Trending**
- New modes: "Hot tokens" (CoinGecko `/search/trending`, via gateway `/v2/market/trending`) and "Hot on DEXs" (GeckoTerminal trending pools on chains Harbour supports; the network filter applies).
- The network filter is ordered by DefiLlama DeFi TVL.

**Sentiment and announcements**
- RSS feeds (CoinDesk, Cointelegraph, Decrypt and now The Block) come through gateway `/rss/<source>`, cached for 10 minutes, with direct fetch as the fallback.
- Signed remote-config announcements are stored on each config sync and shown in Help, merged with the user's own feed. New announcements are notified once each when the "Product announcements" topic is on.

**Notifications** (`background/notify.ts`)
- **Local watcher** (no server): a 5-minute alarm reads recent history for the active account on Ethereum, Bitcoin, BNB Chain, Solana, Polygon, Arbitrum, Base and TRON. It notifies new confirmed incoming transfers (at most 3 per run) and opens the explorer on click. The first look only records existing history, so enabling it doesn't flood. It follows Settings › Notifications.
- **Server push**:
  - `gcm` permission; `chrome.instanceID` FCM token, registered with gateway `/push/register` (unregistered when push is turned off). Messages arrive on `chrome.gcm.onMessage`.
  - The gateway (`gateway/push.ts`) keeps registrations in KV. A cron every 5 minutes checks a rotating slice of addresses within the free plan's 50-subrequest budget: Etherscan v2 transfers and token transfers, TronGrid, Helius signatures, mempool.space.
  - It sends FCM HTTP v1 data messages, authenticated with an RS256 service-account JWT, and deletes registrations whose token is gone.
  - While server push is registered, the local watcher stands down.
- The Notifications screen shows which delivery path is active and has "Send a test notification".

**Deploy**
- `deploy-gateway.mjs` creates and binds the `CACHE` KV namespace (prices, market data and push), pushes `FCM_SERVICE_ACCOUNT` (or `FCM_SERVICE_ACCOUNT_FILE`), and prints `VITE_HB_FCM_SENDER_ID`.
- `wrangler.toml` has `[triggers] crons = ["*/5 * * * *"]`.

**Results**
- Tests: 390 pass (new `phase6.test.js`: fallbacks, GeckoTerminal, hot tokens, the notification rule, push registration, the watcher cursor, FCM JWT signature verification and dead-token cleanup). `verify.mjs` passes.
- Real Chrome: the activity alarm is scheduled, a test notification displays, and `getHot`/`getTrendingNetworks` respond (empty in the sandbox because there is no egress). No Phase 4/5 regressions.

**Not tested live**
- GeckoTerminal, DefiLlama, CoinGecko trending, FCM delivery and the gateway cron.
- The exit check ("a test transfer triggers a push") needs a deployed gateway with a Firebase project.

## Phase 7 — perps, predictions, Ledger (2026-10-21)

**Perps (Hyperliquid)**: `core/perps/hyperliquid.ts`, `background/handlers/perps.ts`, `popup/wallet/features/perps.tsx`. Behind the remote flag `perps`.
- **Signing**:
  - L1 agent signing (msgpack action hash, phantom-agent EIP-712) and user-signed actions (approveAgent, approveBuilderFee, withdraw3) both reproduce the official Python SDK test vectors exactly.
  - The agent key is generated on the device, encrypted with the wallet password, and cannot withdraw.
- **Flows**:
  - Enable trading: approve the agent and the optional builder fee.
  - Deposit Arbitrum USDC to Bridge2 (minimum 5 USDC); withdraw to self (1 USDC fee).
  - Market (IOC ±5%) or limit (GTC) orders with a leverage update; cancel; close at market.
- **Screens**: account, positions with PnL and liquidation price, open orders, recent fills (realized PnL after fees), markets by volume.
- **Wire format**: float_to_wire, 5 significant figures, lot-size rounding.
- **Builder code**: `VITE_HB_HL_BUILDER`, `VITE_HB_HL_BUILDER_FEE`.

**Predictions (Polymarket, CLOB V2)**: `core/predictions/polymarket.ts`, `background/handlers/predictions.ts`, `features/predictions.tsx`. Behind the flag `predictions` and Polymarket's own `/api/geoblock` check; an unknown region means no trading.
- **Read**: markets (Gamma), market detail with books, portfolio (Data API positions and activity), pUSD and USDC.e balances.
- **Trade (EOA)**:
  - Wrap USDC.e to pUSD via the CollateralOnramp.
  - Approve the exchange (pUSD) or the CTF operator (sells).
  - L1 ClobAuth derives or creates API credentials (stored encrypted).
  - V2 order struct signed for the CTF or Neg Risk exchange (domain version "2"), sent with L2 HMAC headers, fill-or-kill at the best price.
- **Limits**:
  - Books that report `version: "v2"` (traded by positionId on the V2 exchange) are read-only, with a link to polymarket.com.
  - The builder code is a public bytes32 (`VITE_HB_PM_BUILDER_CODE`).

**Ledger (WebHID)**: `popup/ledger/device.ts` (`@ledgerhq/hw-transport-webhid` 6.36.0, `hw-app-eth` 7.10.0, `hw-app-btc` 11.6.0, `hw-app-solana` 7.12.0).
- **Connect your Ledger** (Add wallet) reads the Ethereum (44'/60'/0'/0/0), Bitcoin native-segwit (84'/0'/0'/0/0) and Solana (44'/501'/0') addresses and adds a `ledger` wallet that holds public addresses and paths only.
- **Sending** goes through `chainSend.ledgerSendPrepare` and `ledgerSendSubmit`:
  - EVM: the unsigned serialized transaction is signed on the device with Ledger's clear-signing resolution. The background recovers the signer and refuses a mismatch.
  - Bitcoin: wallet-core coin selection, previous transactions fetched from Esplora, `createPaymentTransaction` (segwit, bech32). The background checks that the signed transaction pays exactly the prepared outputs.
- Solana is receive-only for now.
- The Ledger libraries load lazily in the popup, with a `Buffer` shim.

**Other**
- `.env.example` documents the public build settings.
- Mobile sync: the existing QR sync is unchanged.

**Results**
- Tests: 399 pass (new `phase7.test.js`, including the SDK signature vectors). `verify.mjs` passes.
- Real Chrome: the service worker starts, perps and predictions report `FEATURE_DISABLED` while their flags are off, and there are no regressions.

**Not tested live**
- Hyperliquid exchange calls and Polymarket CLOB orders: the sandbox has no egress, so the plan's exit test is pending.
- Ledger signing: there is no device here.

## Phase 8 — security, hardening, release (2026-10-21)
Simulation previews (`eth_simulateV1`), GoPlus + ScamSniffer address/approval checks, approval scanner with revoke, `tabs` permission removed, `npm audit` to 0 high/critical, reproducible builds (`scripts/repro.mjs`), deterministic zip + Ed25519-signed release metadata (`scripts/release.mjs`, `verify-release.mjs`). See `SECURITY.md`, `RELEASE.md`, `STORE-LISTING.md`. Commits `a99c7f0`, `112d811`.

## Final gap sweep (2026-10-22)
- Non-EVM custom tokens: TON jettons, Sui coins, Aptos coins and fungible assets — probe, balance, add-token UI and send (`adapters/tokens.ts`, `send/{ton,sui,aptos}.ts`). `test/tokens-nonevm.test.js` (7 tests). Total 410 tests pass; `tsc --noEmit` clean.
- Found PSBT signing was already implemented (stale comment fixed).
- `.gitignore` now excludes `harbour-release-key.json` and `*-adminsdk-*.json` (both were untracked but not ignored).
- Remaining documented gaps: ICP, FIO, Nimiq, Ontology, Aion send; Cosmos IBC/CW20 tokens; Stellar/Polkadot Asset Hub tokens; BTC inscriptions view; USD prices for non-EVM custom tokens.
