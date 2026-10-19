# UI and UX parity ledger

Updated: 2026-10-15. Reference: supplied Trust Wallet 26.41.0. This is a build
comparison ledger, separate from research coverage. No row currently passes full
parity. Inventory is incomplete until all reachable screens and states are traced.

## Captured baseline

Chromium 141.0.7390.37, 1365×900, new isolated profiles, first-run light theme,
no wallets created. Script: `tools/capture-first-run.mjs`. Images and sanitized
DOM/button states: `audit/screens/reference/` and `audit/screens/harbour/`.

| Feature/state | Target evidence and observed contract | Harbour mismatch | Parity |
|---|---|---|---|
| 01 Fresh install | `reference/00-install.json`: one automatically opened `home.html#/onboarding` tab; exact startup code ranges in `evidence/01-install/2026-10-15-local/` | Different internal filename is acceptable only as an intentional implementation choice; surface/behavior still compared | Positive target runtime captured; build comparison incomplete |
| 02 Welcome | `reference/01-welcome.*`: large full-page composition, illustration left, content right; Import before Create, both disabled until terms; QR action enabled | 375px panel, generic styling/copy, opposite action order, QR absent, terms links lack destinations | Fail |
| 02 Authentication selection | `reference/02-create-entry.*`: “Secure your wallet”, Back, “Select an option”, Password option | Skips this screen and generates a mnemonic before password setup | Fail |
| 02/03 Create password | `reference/03-password.*`: left sidebar/stepper, right form, Back, masked fields, visibility controls, Continue disabled initially | Generic panel, missing stepper/Back/visibility controls; full policy absent | Fail |
| 02 Import routes | Recovered `SelectImportMethod` and import chunks; live screen matrix not yet captured | Existing-wallet action routes to empty create input; no import UI | Not compared |
| 02 Completion/backup | Recovered onboarding/backup chunks; complete live matrix not captured | Generic seed grid; target branch order/completion/security acknowledgements not matched | Not compared |
| 09 Unlock/session | Target code available; screenshots/lifecycle fixtures pending | Minimal unlock view; no proved full session/autolock behavior | Not compared |
| 10 Home/assets/history | Prior research/HAR; all screen states pending | Fixed amounts, fixed token list, no data or history | Fail by code inspection |
| 11 Send/receive | Complete screen/branch inventory pending | Inert action controls | Not implemented |
| 12–15 Permissions/signing/network | `/notification` dApp approvals, `/approval` allowance management, provider settings, custom chains, errors | Implemented in code and build; Chrome interaction/capture pending | Partial — code/build verified |
| 16 QR/WalletConnect | Complete proposals/session/sync flow UNKNOWN | No implementation | Not implemented |
| 17 Buy/swap/stake/NFT | Split and enumerate on reaching lifecycle gate | Inert Buy/Swap controls; remaining screens absent | Not implemented |
| 18 Hardware | Import and signing screen matrix pending | No implementation | Not implemented |

All screenshots above are relative to `audit/screens/`. Earlier feature sections
and bundled module filenames are discovery aids, not claims of complete UI.

## Required record for each screen

- Feature number, source entry/route and evidence ID; reachable preconditions.
- Surface: onboarding tab, popup, side panel, approval window; viewport and locale.
- States: initial/loading/empty/data/validation/rejected/error/success as applicable.
- Trigger and next state for every control, Back/close/cancel, keyboard/focus,
  disabled gating, timers, persistence and lock/reopen behavior.
- Reference capture, build capture, comparison result and exact remaining differences.
- Component geometry, typography, spacing, color/theme, icons/illustrations and motion.
- Sanitization: never capture seeds/passwords/private keys/tokens. Broadly masking
  the UI is not acceptable; mask only actual sensitive fields.
- Explicit branding/asset substitutions permitted by the user; never substitute
  an invented business flow, fake value or inactive control for functionality.

The next feature is #02. Capture its remaining branches, trace and complete its
spec, then implement and compare it before advancing. Initial public screen
captures do not certify onboarding as finished.

## 2026-10-16 — Authoritative v2 inventory, pass 1

Supersedes the historical Harbour comparison above. Active app: `harbour-wallet-v2/`.
Intentional Harbour presentation enhancement replaces pixel-equality acceptance.
Behavioral equivalence still requires target evidence. No complete-wallet claim.

### Discovery scope and evidence

REA artifact analysis: `ev_aa3b5231cb188455bd7bad54484cd5ebc7b69e7acfe59430533f27b7fdb5eef3`
(selected keepAlive source only; complete file inventory, partial semantic graph).
Router recovery: `evidence/00-screen-structure/2026-10-16/REA-result.json`
and `REA-<chunk>.json`. Exact original inputs, byte ranges, source hashes, recovered
modules/maps and manifests are co-located. `discovery.json` is inert AST discovery
evidence, not a second implementation tracker.

234 chunk files parsed; 92 literal `path` candidates. Four non-UI path fields
(fp, Ledger derivation, walletkit) excluded. Index routes added below. This is a
structural lower bound: nested state machines, dynamic dialogs and background
approval dispatch are not exhausted. Bundled routes are code-discovered only;
enabled/reachable/runtime-observed must be proven per condition.

### Shared contract fields for route rows

Each row has a stable ID, parent, lifecycle gate, original chunk + UTF-8 byte
offset, REA evidence, Harbour component, and separate I/G/V/T statuses. All route
rows start **code-discovered**, with **reachability, enablement and runtime UNKNOWN**
unless an explicit observation below says otherwise. Main authenticated tree is
under `RequireUnlock`; hardware accounts suppress the earn branch; send bridge
is conditional on `enabled` (exact flag still UNKNOWN). Routes are shared by
popup/home/sidepanel through the packaged UI entry; per-route surface behavior
needs runtime proof.

For every route row, unresolved contract fields are explicitly UNKNOWN: precise
inputs/actions/output schemas, back/cancel/close semantics, service/network/account
restrictions beyond the guard above, loading/empty/error/retry/success branches,
and popup/reload/worker-restart/lock interruptions. Next investigation: recover
its owning component and callers, trigger under disposable conditions, then
replace these UNKNOWN fields with evidenced state rows before implementation.
Screenshots/tests: none in this pass except onboarding observations below.

I = implementation classification; G = integration; V = inspected render;
T = interaction/lifecycle. A component name establishes no completion.
Source paths below are relative to `artifacts/reference-26.41.0/`; Harbour
component names are in `src/popup/wallet/screens.tsx` unless a path is given.

| Stable ID | Parent / gate | Target route → element | Source : byte / REA ID | Harbour | I | G | V | T |
|---|---|---|---|---|---|---|---|---|
| RT-669eba4c | /market-sentiment / 10 | `/market-sentiment/articles/:symbol?` → SentimentPanel | App-D29UTaP5.js:1417806 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-f5a37694 | /market-sentiment / 10 | `/market-sentiment/posts/:symbol?` → SentimentPanel | App-D29UTaP5.js:1418007 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-8334bf58 | /send / 11 | `/send/:assetId` → Prepare | App-D29UTaP5.js:1491357 / `ev_ed3f7468516b784d` | SendScreen | incomplete | partial | pending | pending |
| RT-ea6813e9 | /send / 11 | `/send/:collectionId/:nftId` → Prepare | App-D29UTaP5.js:1491422 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-f6313af9 | /send / 11 | `/send/:assetId/inscriptions` → Inscriptions | App-D29UTaP5.js:1491499 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-ee21cd8e | /send / 11 | `/send/:assetId/inscribe` → Inscribe | App-D29UTaP5.js:1491582 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-508b3a71 | /send / 11 | `/send/bridge` → Bridge | App-D29UTaP5.js:1491660 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-1337c315 | /send / 11 | `/send/confirm` → Confirm | App-D29UTaP5.js:1491722 / `ev_ed3f7468516b784d` | SendScreen | incorrect flow | partial | pending | pending |
| RT-2b5b2a3f | /receive / 10 | `/receive/chain/:blockchainId` → ReceiveAsset | App-D29UTaP5.js:1504640 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-91a31cdf | /receive / 11 | `/receive/:assetId` → ReceiveAsset | App-D29UTaP5.js:1504721 / `ev_ed3f7468516b784d` | ReceiveScreen | incomplete | partial | pending | pending |
| RT-2f8d2547 | /fund / 17 | `/fund/cex` → CexFunding | App-D29UTaP5.js:1650705 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-86c918b6 | /fund / 17 | `/fund/cex/:providerId` → CexFundingProvider | App-D29UTaP5.js:1650768 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-4879733a | /fund / 17 | `/fund/cex/:providerId/platform` → CexFundingPlatform | App-D29UTaP5.js:1650851 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-a45c8a76 | /fund / 17 | `/fund/cex/:providerId/assets` → CexFundingAssets | App-D29UTaP5.js:1650943 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-78de4731 | /fund / 17 | `/fund/cex/:providerId/platform/assets` → CexFundingAssets | App-D29UTaP5.js:1651031 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-7bedc17e | /fund / 17 | `/fund/cex/qr` → CexFundingQr | App-D29UTaP5.js:1651128 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-c0787d45 | /earn / 17 | `/earn/staking` → StakingList | App-D29UTaP5.js:1855297 / `ev_ed3f7468516b784d` | StakingScreen | fixture/static | absent | pending | pending |
| RT-86bbd5b1 | /earn / 17 | `/earn/staking/:assetId` → Staking | App-D29UTaP5.js:1855365 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-90e003d6 | /earn / 17 | `/earn/stake/:assetId/:amount?/:validatorId?` → Stake | App-D29UTaP5.js:1855438 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-99383e92 | /earn / 17 | `/earn/unstake/:assetId` → Unstake | App-D29UTaP5.js:1855530 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-fe4c35ac | /earn / 17 | `/earn/redelegate/:assetId` → Redelegate | App-D29UTaP5.js:1855603 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-7c9a29e3 | /earn / 17 | `/earn/compound/:assetId` → Compound | App-D29UTaP5.js:1855682 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-d889cae3 | /earn / 17 | `/earn/claim-delegation/:assetId` → Claim | App-D29UTaP5.js:1855757 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-a91ecdd3 | /settings / 08–09 | `/settings/help` → Help | App-D29UTaP5.js:2048000 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-b464e1a5 | /settings / 08–09 | `/settings/language` → Language | App-D29UTaP5.js:2048058 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-3f3d6f7b | /settings / 10 | `/settings/currency` → Currency | App-D29UTaP5.js:2048124 / `ev_ed3f7468516b784d` | CurrencyScreen | incomplete | UI only | pending | pending |
| RT-70a638e7 | /settings / 08–09 | `/settings/color-mode` → ColorMode | App-D29UTaP5.js:2048190 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-7097cda7 | /settings / 09 | `/settings/preferences` → Preferences | App-D29UTaP5.js:2048259 / `ev_ed3f7468516b784d` | PreferencesScreen | incomplete | partial | pending | pending |
| RT-30acc0dd | /settings / 11 | `/settings/address-book` → AddressBook | App-D29UTaP5.js:2048331 / `ev_ed3f7468516b784d` | AddressBookScreen | fixture/static | absent | pending | pending |
| RT-4c6eb3cf | /settings / 10 | `/settings/notifications` → Notifications | App-D29UTaP5.js:2048404 / `ev_ed3f7468516b784d` | NotificationsScreen | incomplete | UI only | pending | pending |
| RT-9ef1340c | /settings / 09 | `/settings/security` → Security | App-D29UTaP5.js:2048480 / `ev_ed3f7468516b784d` | SecurityScreen | incomplete | partial | pending | pending |
| RT-99ffb5af | /settings / 08–09 | `/settings/auto-lock` → AutoLock | App-D29UTaP5.js:2048546 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-79e1b89f | /settings / 08–09 | `/settings/security/select-source-wallet` → MigrationRouteGuard | App-D29UTaP5.js:2048613 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-a61ce794 | /settings / 08–09 | `/settings/security/select-destination-wallet` → MigrationRouteGuard | App-D29UTaP5.js:2048753 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-5b301338 | /settings / 08–09 | `/settings/security/select-assets` → MigrationRouteGuard | App-D29UTaP5.js:2048903 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-15bd2e03 | /settings / 08–09 | `/settings/connections` → Connections | App-D29UTaP5.js:2049030 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-e6e20e5a | /settings / 08–09 | `/settings/connections-blacklist` → ConnectionsBlacklist | App-D29UTaP5.js:2049102 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-78668232 | /settings / 08–09 | `/settings/connection/:id` → Connection | App-D29UTaP5.js:2049193 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-3139f32e | /settings / 08 | `/settings/wallets` → Wallets | App-D29UTaP5.js:2049267 / `ev_ed3f7468516b784d` | ManageWalletsScreen | incomplete | partial | pending | pending |
| RT-c2114471 | /settings / 08 | `/settings/wallet/:id` → Wallet | App-D29UTaP5.js:2049331 / `ev_ed3f7468516b784d` | EditWalletScreen | incomplete | partial | pending | pending |
| RT-1880d59b | /settings / 08–09 | `/settings/wallet/accounts/:id` → Accounts | App-D29UTaP5.js:2049397 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-99c839da | /settings / 08 | `/settings/wallet/account/:walletId/:accountId` → Account | App-D29UTaP5.js:2049474 / `ev_ed3f7468516b784d` | AccountDetailScreen | incomplete | partial | pending | pending |
| RT-b3d4b1d8 | /settings / 08–09 | `/settings/developer` → DeveloperSettings | App-D29UTaP5.js:2049566 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-115d4a6d | /settings / 08–09 | `/settings/developer/faucets` → Faucets | App-D29UTaP5.js:2049642 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-72d47e52 | /settings / 08–09 | `/settings/utxo` → UtxoManagement | App-D29UTaP5.js:2049716 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-6594d49b | root / 15 | `/network/*` → PS | App-D29UTaP5.js:2135181 / `ev_ed3f7468516b784d` | NetworksScreen | incomplete | partial | pending | pending |
| RT-3025d4f2 | root / 10 | `/notification` → RS | App-D29UTaP5.js:2135242 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-729112b2 | root / 11 | `/send/*` → App$5 | App-D29UTaP5.js:2135306 / `ev_ed3f7468516b784d` | SendScreen | incomplete | partial | pending | pending |
| RT-76049153 | root / 11 | `/receive/*` → Receive | App-D29UTaP5.js:2135392 / `ev_ed3f7468516b784d` | ReceiveScreen | incomplete | partial | pending | pending |
| RT-1fdc0163 | root / 17 | `/swap/*` → App$3 | App-D29UTaP5.js:2135458 / `ev_ed3f7468516b784d` | SwapTab | fixture/static | partial | pending | pending |
| RT-2d993cdc | root / 17 | `/fund/*` → Fund | App-D29UTaP5.js:2135544 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-b47df0a4 | root / 17 | `/buy/*` → WS | App-D29UTaP5.js:2135604 / `ev_ed3f7468516b784d` | BuyScreen | fixture/static | absent | pending | pending |
| RT-56f81540 | root / 17 | `/sell/*` → HS | App-D29UTaP5.js:2135685 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-439958d6 | root / 17 | `/fiat-ramps/*` → OS | App-D29UTaP5.js:2135768 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-b2ec06bd | root / 17 | `/earn/*` → App$2 | App-D29UTaP5.js:2135836 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-428af5ae | root / 08–09 | `/settings/*` → App$1 | App-D29UTaP5.js:2135922 / `ev_ed3f7468516b784d` | SettingsScreen | incomplete | partial | pending | pending |
| RT-f1c8d203 | root / 10 | `/transaction/:id` → KS | App-D29UTaP5.js:2135987 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-c8ab93e2 | root / 10 | `/collections/:collectionId` → zS | App-D29UTaP5.js:2136054 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-002267a8 | root / 10 | `/collections/reported` → VS | App-D29UTaP5.js:2136131 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-97d4de7d | root / 10 | `/collections/:collectionId/nfts/:nftId` → BS | App-D29UTaP5.js:2136203 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-7c4db1ea | root / 10 | `/manage-crypto` → FS | App-D29UTaP5.js:2136292 / `ev_ed3f7468516b784d` | SearchScreen | incomplete | partial | pending | pending |
| RT-b85dbe11 | root / 10 | `/approval` → NS | App-D29UTaP5.js:2136357 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-824e93cf | root / 10 | `/asset/:assetId` → DS | App-D29UTaP5.js:2136417 / `ev_ed3f7468516b784d` | TokenDetailScreen | fixture/static | partial | pending | pending |
| RT-f3023578 | root / 10 | `/gas-station/:assetId` → jS | App-D29UTaP5.js:2136483 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-069c684c | root / 10 | `/custom-asset/*` → _S | App-D29UTaP5.js:2136555 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-1efbac12 | root / 10 | `/history` → History | App-D29UTaP5.js:2136621 / `ev_ed3f7468516b784d` | ActivityScreen | fixture/static | absent | pending | pending |
| RT-76fd2ef3 | root / 10 | `/market-sentiment/*` → MarketSentiment | App-D29UTaP5.js:2136685 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-332672cf | root / 10 | `/trending-tokens/*` → Component | App-D29UTaP5.js:2136768 / `ev_ed3f7468516b784d` | TrendingTab | incomplete | public adapter | pending | pending |
| RT-a4c38002 | root / 10 | `*` → Home | App-D29UTaP5.js:2136844 / `ev_ed3f7468516b784d` | wallet/Wallet.tsx | fixture/static | partial | pending | pending |
| RT-eaa1092a | root / 09 | `/unlock` → ZS | App-D29UTaP5.js:2136901 / `ev_ed3f7468516b784d` | App.tsx | incomplete | partial | pending | pending |
| RT-044ce513 | root / OB | `/onboarding` → US | App-D29UTaP5.js:2136986 / `ev_ed3f7468516b784d` | onboarding/Onboarding.tsx | incomplete | partial | pending | pending |
| RT-45c38dd6 | /buy / 17 | `/buy/enter-amount` → BuyEnterAmount | buy-mUiKGiqX.js:48484 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-6349db11 | /buy / 17 | `/buy/select-fiat` → BuySelectFiat | buy-mUiKGiqX.js:48559 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-9aee319e | /buy / 17 | `/buy/select-crypto` → BuySelectCrypto | buy-mUiKGiqX.js:48632 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-398122a9 | /buy / 17 | `/buy/select-network` → BuySelectNetwork | buy-mUiKGiqX.js:48709 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-61865c4b | /buy / 17 | `/buy/select-provider` → BuySelectProvider | buy-mUiKGiqX.js:48788 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-eef95c1e | /buy / 17 | `/buy/select-payment-method` → BuySelectPaymentMethod | buy-mUiKGiqX.js:48869 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-6cf31105 | /buy / 17 | `/buy/recurring-setup` → RecurringBuySetup | buy-mUiKGiqX.js:48961 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-11678067 | /custom-asset / 10 | `/custom-asset/select-network` → SelectNetwork | custom-asset-Bpl9EE2o.js:34397 / `ev_b7327560de20d460` | missing | missing | absent | pending | pending |
| RT-55261490 | /custom-asset / 10 | `/custom-asset/add-asset/:blockchainType/:blockchainId` → AddAsset | custom-asset-Bpl9EE2o.js:34473 / `ev_b7327560de20d460` | missing | missing | absent | pending | pending |
| RT-47cc7605 | /custom-asset / 10 | `/custom-asset/add-asset/:blockchainType/:blockchainId/manual/:contractAddress?` → AddAsset | custom-asset-Bpl9EE2o.js:34569 / `ev_b7327560de20d460` | missing | missing | absent | pending | pending |
| RT-e1189ca3 | /fiat-ramps / 17 | `/fiat-ramps/buy/:assetId?` → BuyCryptoTab | fiat-ramps-BdoaGdC5.js:172132 / `ev_918d594f0146f16d` | missing | missing | absent | pending | pending |
| RT-0405ec05 | /fiat-ramps / 17 | `/fiat-ramps/sell/:assetId?` → SellCryptoTab | fiat-ramps-BdoaGdC5.js:172206 / `ev_918d594f0146f16d` | missing | missing | absent | pending | pending |
| RT-41b465a6 | /network / 15 | `/network/custom` → AddCustomNetwork | network-BgRJPftY.js:179693 / `ev_0cdd9317d22637c6` | missing | missing | absent | pending | pending |
| RT-e5f0f99e | /sell / 17 | `/sell/enter-amount` → SellEnterAmount | sell-DEKcDK89.js:19231 / `ev_e2a688b3b95feb80` | missing | missing | absent | pending | pending |
| RT-a6ae15ba | /sell / 17 | `/sell/select-fiat` → SellSelectFiat | sell-DEKcDK89.js:19307 / `ev_e2a688b3b95feb80` | missing | missing | absent | pending | pending |
| RT-44e2b70c | /sell / 17 | `/sell/select-provider` → SellSelectProvider | sell-DEKcDK89.js:19381 / `ev_e2a688b3b95feb80` | missing | missing | absent | pending | pending |
| RT-d55b0ec5 | /sell / 17 | `/sell/select-network` → SellSelectNetwork | sell-DEKcDK89.js:19463 / `ev_e2a688b3b95feb80` | missing | missing | absent | pending | pending |
| RT-d2499bcb | /send / 11 | `/send/` → SelectAsset | App-D29UTaP5.js:1491232 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-b2948db8 | /receive / 10 | `/receive/` → SelectChain | App-D29UTaP5.js:1504578 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-e1c03eae | /fund / 17 | `/fund/` → FundingMethods | App-D29UTaP5.js:1650640 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-7ad2332a | /settings / 08–09 | `/settings/` → Settings | App-D29UTaP5.js:2047941 / `ev_ed3f7468516b784d` | missing | missing | absent | pending | pending |
| RT-9b1a1401 | root / 10 | `/` → e.props.element | Page-7xxhohWn.js:19994 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-bb031660 | /buy / 17 | `/buy/` → BuySelectCrypto | buy-mUiKGiqX.js:48419 / `ev_9a044681674938f9` | missing | missing | absent | pending | pending |
| RT-a58b477d | root / 10 | `/` → i | dist-B_ANQAOl.js:53530 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-965dfc0b | root / 10 | `/` → i | dist-B_ANQAOl.js:66846 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-75b3f4a1 | root / 10 | `/` → i | dist-B_ANQAOl.js:67400 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-75b3f4a1 | root / 10 | `/` → i | dist-B_ANQAOl.js:67455 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-679c73c1 | root / 10 | `/` → t | dist-B_ANQAOl.js:67874 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-dd1a519b | root / 10 | `/` → t | dist-B_ANQAOl.js:68088 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-81ad339c | root / 10 | `/` → i | dist-B_ANQAOl.js:68505 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-81ad339c | root / 10 | `/` → i[t] | dist-B_ANQAOl.js:68830 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-5feb42f9 | root / 10 | `/` → i.data[e] | dist-B_ANQAOl.js:123360 / `UNKNOWN` | missing | missing | absent | pending | pending |
| RT-560897e7 | /network / 15 | `/network/` → Networks | network-BgRJPftY.js:179631 / `ev_0cdd9317d22637c6` | missing | missing | absent | pending | pending |
| RT-49ceaab1 | /sell / 17 | `/sell/` → SellSelectCrypto | sell-DEKcDK89.js:19165 / `ev_e2a688b3b95feb80` | missing | missing | absent | pending | pending |

### Navigation map and explicit gaps

- Fresh install → full-page onboarding → create/import/QR → authentication → password.
- Import → source selection → Trust method / other secret import / Ledger. Secret
  import branches to private-key network picker or Solana derivation selection.
- Create/import completion → carousel, pin guide, sidepanel. Backup is deferred.
- Authenticated shell → send, receive, swap, fund, buy, sell, fiat ramps, earn,
  settings, asset detail, collections, history, approvals, network/custom assets,
  market sentiment and trending. Parent/child routes are enumerated above.
- Settings → wallets/accounts, connections/blacklist/detail, security migration
  source/destination/assets, auto-lock, language, currency, theme, preferences,
  address book, notifications, developer/faucets, UTXO management.

**Gaps:** rows marked missing; private-key import/network selection; Solana
derivation choice; QR camera/payload/decryption; biometrics/passkey conditions;
wallet-count limit; additional-wallet onboarding/backup; Chrome capture of provider
approvals and pending recovery; transaction details and chain-specific fees/sign/broadcast;
all index/conditional/dialog states; reload and worker/session lifecycle.
Production static data exists in Activity/NFTs/Staking/Buy/Swap confirmation,
asset-price fallback and sparkline; provider and approval implementation is code-complete
for Phase 2 but lacks Chrome capture.
Public RPC/CoinGecko adapters exist for a chain subset, with live reachability
and full client equivalence unverified. No authenticated Trust gateway use is
authorized. Later routes remain behind chronological research gates.

### Onboarding state and branch inventory — gate #02

Source locations are recovered filenames in `evidence/02-onboarding-flow/` and
`03-auth-password/`; fresh QR/completion evidence is under
`02-onboarding-flow/2026-10-16-branches/REA-*.json` with exact byte ranges.
Runtime paths below use `2026-10-16-runtime` unless marked historical. Every row
is code-discovered; conditions and observed scope appear separately. All V/T
remain pending until the dated inspection/test addendum. Substates listed in one
row must be split when fixtures exist; they are not counted as individual proven
screens. Fields not established in the contract cell remain UNKNOWN.

| ID | Gate | State/group | Target source | Contract / outstanding condition | Harbour | I | Runtime scope | V / T |
|---|---|---|---|---|---|---|---|---|
| OB-001 | 01 | Fresh install | onboarding / install | terms off; Import/Create disabled; QR enabled | Onboarding/welcome | partial | first-run fixture | pending / pending |
| OB-002 | 02 | Welcome accepted | onboarding | terms toggle → Import/Create enabled | Onboarding/welcome | partial | import-other/01-welcome | pending / pending |
| OB-003 | 02 | Authentication/password option | authentication; globalSteps | Back → welcome; Password → create-password; platform biometrics conditional UNKNOWN | Onboarding/authentication | partial | import-other/02-authentication | pending / pending |
| OB-004 | 02–03 | Password empty/invalid/mismatch/valid | CreatePassword; useValidatePassword | 8–64/common-list; show/hide; disabled Continue; async errors | Onboarding/password | partial | import-other/03-password | pending / pending |
| OB-005 | 02 | Import source picker | SelectImportMethod | Trust → method; Other → secret; Ledger → hardware flow; Back → home | Onboarding/sources | partial | import-other/04-import-menu | pending / pending |
| OB-006 | 02 | Trust import method | onboarding/SelectImportMethod$1 | QR recommended vs secret; Back → sources | Onboarding/trust-method | partial | historical import-trust | pending / pending |
| OB-007 | 02 | Mnemonic input and name | import-mnemonic-or-private-key | masked/paste/show; duplicate-name/invalid phrase; submit loading/error; Back source-dependent | Onboarding/secret | partial | import-other/05-import-choice | pending / pending |
| OB-008 | 02 | Import instruction carousel | import-mnemonic-or-private-key/ImportInstructions | source-specific desktop/mobile instructions and return controls | missing | missing | not recaptured | pending / pending |
| OB-009 | 02 | Private-key input detected | import-mnemonic-or-private-key | one word >8 chars → network selector; validation per chain | Onboarding/secret boundary | blocked behavior | code only | pending / pending |
| OB-010 | 02 | Private-key network picker/search/empty | PrivateKeyNetworkSelect | selected network → validate → initiate/complete import; exact registry unresolved | missing | missing | code only | pending / pending |
| OB-011 | 02 | Solana derivation choice | SolanaDerivation | two history-positive variants → Trust/Phantom radios, balances, Next/Back/error; one result skips | missing | missing | code only | pending / pending |
| OB-012 | 02 | Import duplicate/rejection/retry | import-mnemonic-or-private-key/onSubmit | MNEMONIC_ALREADY_EXISTS/private-key duplicate warning; clears transient secret context | partial generic error | partial | code only | pending / pending |
| OB-013 | 02 | QR mobile instructions | import-qr | link QR → I completed scan; manual import fallback | Onboarding/qr-mobile | partial | historical qr | pending / pending |
| OB-014 | 02 | QR camera permission prompt/denied | import-qr/ScannerBox | request camera; denied instruction and retry; stop all tracks on cleanup | boundary only | missing | fresh REA; not runtime | pending / pending |
| OB-015 | 02 | QR scanning/loading/parse error/retry | import-qr/ImportWithQr | 80ms scan attempts/success delay; parsed payload → password; camera in-use error | missing | missing | fresh REA; not runtime | pending / pending |
| OB-016 | 02 | QR encryption password/decrypt/import | import-qr/InputQrPassword | imported stored keys; empty/wrong password and recovery behavior still being traced | missing | missing | fresh REA; not runtime | pending / pending |
| OB-017 | 02 | Ledger connect/address selection/error | import-ledger | device/coin restrictions and connect/import stages remain unresolved | boundary only | missing | historical import-ledger | pending / pending |
| OB-018 | 02 | Biometrics authentication variants/errors | authentication; biometrics | platform/capability conditions; password fallback; passkey provider unresolved | missing | missing | packaged only | pending / pending |
| OB-019 | 02 | Passkey setup flow | set-passkeys; onboarding map | flow query supports SET_PASSKEY; exact capability and completion unresolved | missing | missing | packaged only | pending / pending |
| OB-020 | 02 | Wallet limit blocked | onboarding HOME canCreateWallet | canCreateWallet false → BLOCKED_MAX_WALLETS; exact maximum unresolved | missing | missing | code only | pending / pending |
| OB-021 | 02 | Create completion/carousel | Completed; onboarding | new wallet backup deferred; slide timer 7s; app/sidepanel/pin actions | Onboarding/completed | partial | historical create-complete | pending / pending |
| OB-022 | 02 | Pin guide/open panel/error | Completed | toolbar status; pin instructions; panel open branch; browser conditions unresolved | Onboarding/completed | partial | code only | pending / pending |
| OB-023 | 02 | Additional-wallet onboarding | useOnboardingType; globalSteps | existing wallets bypass initial auth/terms as conditional code indicates; runtime pending | separate AddWalletScreen | incorrect flow | code only | pending / pending |
| OB-024 | 02 | Backup warning/authentication | backup-seedphrase | onboarding query BACKUP_SEEDPHRASE; exact password/biometric guard pending | BackupScreen | partial | code only | pending / pending |
| OB-025 | 02 | Backup reveal/acknowledge/complete | backup-seedphrase | masked secret; verification/persistence/return paths require full fixtures | BackupScreen | partial | code only | pending / pending |
| OB-026 | 02 | Idle close/completion pause | onboarding/Page | 600000ms, 500ms event throttle; completion pauses idle timer | Onboarding effect | partial | code only | pending / pending |
| OB-027 | 02 | Reload/close/reopen/interrupted setup | onboarding + background | state/vault timing, recovery and additional mode UNKNOWN per branch | partial | unverified | not tested | pending / pending |

Current lower bound: **105 route/index records + 27 onboarding state groups**. These overlap (onboarding route contains its groups); do not sum them as unique screens. No exhaustive state or reachability claim.

## Swap tab update (2026-10-16)
Swap tab, settings sheet, providers sheet, token picker, confirm/approve, status and history are implemented from recovered TW logic; see harbour-wallet-v2/evidence/25-swap/SWAP-SPEC.md. Implementation and build verified; live APIs and visual/interaction QA still pending.

## 2026-10-16 — Local logos and rendered v2 review

The structural inventory remains **105 route/index records plus 27 overlapping onboarding state groups**. The earlier 80-missing/25-partial route comparison is a baseline, not a recalculated current count after subsequent swap/settings work. No route is promoted to complete by an icon, fixture, or build.

| Harbour item | Implementation / integration | Visual inspection | Interaction check | Open gap |
|---|---|---|---|---|
| OB-001/002 welcome | Terms gate and create/import entry are wired | Built MV3 `audit/onboarding-v2/create-complete/01-welcome.png` inspected | Terms → Create in disposable profile passed | Target QR branch and all return paths incomplete |
| OB-003 authentication | Password branch wired | `02-authentication.png` inspected | Password selection passed | Biometrics/passkey branches unresolved |
| OB-004 password | Local validation and wallet creation wired | `03-password.png` inspected | Valid disposable password → create passed | Invalid/common/mismatch, reload and failure fixtures incomplete |
| OB-021 completion | Creation result and carousel wired | `04-completed.png` inspected | Creation reached; carousel/pin/sidepanel actions not checked | Target assets and browser-specific pin states incomplete |
| Home popup | Public balance/market adapters for supported chains, local logos | `05-wallet-popup.png` inspected after settling | Opened in built extension; no funds or send tested | Full chain support, loading/errors, price outage, receive/send and lifecycle gaps |
| Settings/currency | Local settings and bundled USD/EUR/GBP/BTC/ETH/BNB marks | `06-settings-popup.png`, `07-currency-popup.png` inspected | Navigation into both screens passed; mutation not checked | Many settings branches and persistence/lifecycle remain |
| Portfolio/send/approval design fixtures | Development-only render and feedback, excluded from production | `audit/design/2026-10-16/*.png` inspected | Nine fixture checks passed in `checks.json` | Send/provider integration and actual extension approval surface unimplemented |
| Buy, staking, NFTs, dApp discovery | Static financial/provider/collection cards removed from production; explicit empty state | Not yet inspected after this change | Not checked | Live provider/position/ownership/catalog adapters and target flows missing |

Asset source/usage is in `ASSET-LEDGER.md`; visual rationale in `REFERENCE-LEDGER.md` and `DESIGN-SYSTEM.md`. Known native/curated swap contract icons are local; dynamic unknown assets retain an image URL with a neutral failure fallback, so provenance/loading remains partial. Production sample price/change fallback was removed. The popup captures exercise a new disposable wallet only and prove no live transaction or approval behavior. Screenshot counts above are **7 built-extension surfaces** and **5 fixture surfaces**; state variants are not all covered. Chronological detailed research remains at #02.

## 2026-10-19 — Recomputed implementation status (code-inspected; NOT runtime-verified)

Supersedes the "80 missing / 25 partial" baseline above. Basis: `src/popup/wallet/*`, `SCREENS` registry (screens.tsx:790),
`SETTINGS_SCREENS`, `NETWORK_SCREENS`, `TOKEN_SCREENS`, `SWAP_SCREENS`, background router cases. `tsc` passes (2026-10-19).
Legend: **Real** = wired to a service, no static data · **Partial** = real but fewer branches than Trust Wallet ·
**Static** = sample data in `popup/wallet/data.ts` · **Missing** = no screen. V (visual) and T (interaction) remain *pending* for all.

| Area (TW route group) | Harbour component | Status | Gap to close |
|---|---|---|---|
| Install / onboarding tab | Onboarding.tsx (welcome, authentication, biometrics, password, sources, trust-method, secret, qr-mobile, boundary, completed) | Partial | private-key import + network picker, Solana derivation choice, QR camera/scan/decrypt, import instructions carousel, passkey setup, wallet-limit block, Ledger import, additional-wallet mode, palette unification |
| Unlock / lock / auto-lock | App.tsx, vaultService, settingsService (chrome.alarms) | Real | TW's own countdown scheduler is UNKNOWN (Harbour uses alarms + activity ping) |
| Home (assets, balances, tabs) | Wallet.tsx | Partial | header shows literal "Seed Phrase 1"; chain list limited to ~8; approvals sub-tab empty; sparkline/static `ASSETS` list in `data.ts` |
| Trending (`/trending-tokens`) | TrendingTab | Partial | CoinGecko data (TW gateway not used); `bstocks`, HyperEVM/Robinhood/Arc categories unmapped |
| Search / manage-crypto | SearchScreen | Partial | DApps tab static; token search limited to custom/known list |
| Network selector / `/network/*` | NetworkSelectorScreen, networkScreens (custom networks add/edit) | Partial | built-in registry plus persisted custom EVM networks now appear in selector/home/send; broader Trust Wallet 86-chain parity and visual/interaction capture remain |
| Asset detail `/asset/:id` | TokenDetailScreen, tokenData.tsx | Partial | real chart/info/history for native assets; ERC-20/SPL history, per-row USD missing |
| History `/history`, `/transaction/:id` | ActivityScreen; tx detail missing | Partial / Missing | native transfers only; no tx detail screen |
| Send `/send/*` | SendScreen (EVM native + ERC-20, estimate, contract warning) | Partial | no BTC/SOL/other-chain send; no asset picker, NFT send, inscriptions/inscribe, bridge; confirm flow "incorrect" |
| Receive `/receive/*` | ReceiveScreen | Partial | no chain picker (`/receive/chain/:id`), no per-chain receive list |
| Swap `/swap/*` | SwapTab + sheets + confirm/status/history | Partial | LI.FI + Jupiter, live APIs unverified; no BTC/THORChain, EVM↔Solana, gasless, dust cleaner |
| Buy `/buy/*` (8 routes) | BuyScreen | Static | all 8 sub-screens missing; no real providers |
| Sell `/sell/*` (5), `/fiat-ramps/*` (2) | — | Missing | |
| Fund `/fund/*` (7, CEX funding) | — | Missing | |
| Earn `/earn/*` (7) | StakingScreen | Static | stake, unstake, redelegate, compound, claim, staking detail |
| NFTs `/collections/*` (3) | NftsScreen | Static | collection list/detail/NFT detail/reported |
| Discover / dApps | DiscoverScreen | Static | real dApp directory, in-app browser launch |
| dApp provider, `/approval`, `/notification` | `src/inpage`, `src/content/content.ts`, provider background, `features/provider.tsx` | Implemented (build/test verified; Chrome interaction pending) | `/notification` handles dApp requests; `/approval` handles tracked token allowances; connections, blacklist, custom chain and signing approval paths are wired |
| Settings root + Security/AutoLock/Language/Currency/ColorMode/Preferences/AddressBook/Notifications/About/Faucets | SETTINGS_SCREENS | Partial→Real | Help, Connections, Connections blacklist, Connection detail, Wallet accounts list, Developer, UTXO management, Security migration (3 screens) missing |
| Wallets / wallet / account screens | ManageWalletsScreen, EditWalletScreen, AccountDetailScreen | Partial | accounts list screen; hardware/imported wallet variants |
| Custom asset `/custom-asset/*` (3) | TOKEN_SCREENS (selectTokenNetwork, addCustomToken, customTokenDetail) | Partial | non-EVM custom assets |
| Market sentiment (2) | — | Missing | |
| Gas station `/gas-station/:id` | — | Missing | |
| WalletConnect / QR sync | syncMobile.tsx, qrSync.ts (import only) | Partial | WalletConnect v2 pairing/sessions missing |
| Hardware (Ledger) | — | Missing | |

Route-record tally (105 records): the per-route "Harbour" column above this section is historical; use this table.

### Newly noted discrepancies (2026-10-19)
- Onboarding palette differs from popup palette (see DESIGN-SYSTEM.md "Conflict #1").
- Home header hard-codes "Seed Phrase 1".
- `ASSETS`/`NETWORKS` constants in `data.ts` still drive the home list for native assets.
- `Wallet.tsx` has an "approvals" sub-tab with no provider behind it.

## 2026-10-19 — UI-only rendered pass on the built v2 extension

Latest user scope: finish the UI/UX of existing screens; do not implement new wallet features. This pass did not add a route, service adapter, financial operation, or approval handler. The research inventory remains **105 route/index records plus 27 overlapping onboarding state groups**; these are not a count of completed screens.

Corrections to the code-inspected snapshot above: onboarding's later CSS already maps its active palette to Harbour `--hb-*`; the old blue declarations are overridden. Home already reads the active wallet label. `ASSETS`/`NETWORKS` now derive from the 86-chain registry. The 82 downloaded chain logos were absent from the built extension because they lived in `public/`, outside Vite's configured `public-production/` directory; this is now fixed. These are dated corrections, not retroactive edits to the earlier table.

Visual/interaction evidence: `audit/ui/2026-10-19/` contains **27 built-extension captures** (25 popup states at 375×600, including Send invalid-input and asset-picker sheet plus Trending loading/settled, and 320×600/480×800 dark Home variants) and `checks.json`. The audit created a disposable wallet in an isolated Chromium profile, navigated existing controls, and stored no seed/password. It reached Home, Send form/validation/sheet, Buy, Receive selector/QR, network selector, Search Crypto/DApps, asset detail, Activity, Collectibles, Trending, Swap, Earn, wallet selector, Settings, Currency, Preferences, Color Mode, and dark variants. Every captured state was inspected; no page errors, missing images, or body horizontal overflow remained after repair. `audit/onboarding-v2/create-complete/` and `audit/onboarding-v2/import-other/` provide additional inspected full-page welcome/auth/password/completion/import captures. These checks establish rendered/navigation scope only, not transaction, integration, or exhaustive state parity.

| Existing UI area | Implementation/integration after this pass | Visual inspection | Interaction check | Remaining gap |
|---|---|---|---|---|
| Home, asset rows, wallet selector | Existing live wallet state; packaged chain marks | 375 light/dark, 320 dark, 480 dark; wallet selector | Open/select screen, tab navigation | Long names/balances, outage states and full lifecycle not checked |
| Send, Receive, network/search selectors | Existing services; chain-ID logo rendering repaired | Send, Receive list/QR, network selector, Search Crypto/DApps | Open/back, Receive asset selection, search tab switch | No funded send/review or full network search exercised |
| Asset detail, Activity, Trending, Swap | Existing adapters unchanged; Trending image hotlinks removed | All four captured | Entry/back/tab switch | Live APIs, chart/history interaction and quote flow not verified |
| Buy, Earn/Staking, NFTs, DApp directory | **No live integration**; static quotes/APRs/owned NFTs/fake DApps replaced with designed unavailable states | Buy, Earn, Collectibles, Search DApps inspected | Open/back | Feature implementation remains outside this UI-only request |
| Settings, Currency, Preferences, Color Mode | Existing settings services unchanged | Light and dark captures | Navigation and Dark selection | Other settings branches and persistence/reopen still need QA |
| Onboarding existing create/import path | Existing behavior unchanged; active CSS remains Harbour teal | Welcome/auth/password/completion/import menu/secret form inspected | Terms/create/import source path | Other onboarding branches and error/reload states not checked |

Build/typecheck passes. Focused settings/chain tests: 32/32. Full `npm test`: 147/156 passed; nine failures are in history and staking/signing suites, outside the UI-only edits. No UI parity claim is made for routes or states not captured here, nor for missing feature screens.

## 2026-10-19 (evening) — status after worker round 2
Source of truth per area: `harbour-wallet-v2/evidence/NN-*/STATUS.md`. Gate: tsc clean, 334/334 tests, `vite build` OK. ALL network paths are mock-tested only (live-unverified); no Chrome visual QA yet.
- 31 dApp provider (EIP-1193/6963, Solana, approvals, connections, blacklist): built; MAIN-world injection never loaded in real Chrome. Gaps: SIWS, biometric in approval window, Ledger signing, per-origin (not wallet-wide) chain.
- 33 Send/Receive/Tx detail: real for EVM(45), BTC, SOL, TRON, 14 Cosmos+THOR, XRP, ALGO; native-only for ~16 other families; explicit unsupported: ICP, FIO, Nimiq, Aion, Ontology. Bridge/Inscribe = documented gap.
- 34 Staking: 12 Cosmos chains, SOL, ETH(Lido), BNB(StakeHub). Not done: Tron/Polkadot/Cardano staking.
- 35 NFTs: Blockscout (15 EVM), Solana DAS/Magic Eden; ERC-721/1155 + SOL send.
- 38 Onboarding/settings/theme: import branches, QR import, passkey/backup flows, wallet management, developer settings, faucets, notifications (prefs only); theme tokenised light/dark. Gaps: dark-mode visual audit, hardware-wallet route placeholder, migration params must be honoured by Send.
- Unassigned: Ledger (stub only).
- 2026-10-19 WalletConnect v2: BUILT (not Chrome-verified, no live relay): Settings › Connections › WalletConnect screen (`walletConnect`: paste/scan `wc:` link, project ID entry, session list + Disconnect); session-proposal approval in the standard approval window (kind `wcSession`); requests reuse the injected-dApp approval screens. TW 26.41.0 has no such screen (see evidence/16 addendum), so there is no capture to compare against.
