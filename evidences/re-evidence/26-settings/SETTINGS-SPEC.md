# Settings — spec, HAR comparison, deviations

## HAR comparison (network-log.har)
- [certain] The HAR contains no Settings-specific API call. Settings in Trust Wallet's extension is local state (chrome.storage) plus alarms.
- [certain] Only settings-adjacent call: `GET gateway.us.trustwallet.com/v2/market/rates?currency=ETH` -> `[{currency,value}]` (base-currency rate). That host needs a TW device credential; Harbour does NOT call it and never reuses HAR tokens/ids.
- [certain] The HAR is truncated at ~150 MB (3,467 entries recovered). Calls after the cut are unseen.
- Harbour replaces the rate source with open.er-api.com (fiat) and CoinGecko (BTC/ETH/BNB). [Guessing] response shapes follow public docs; not verified live (egress blocked in build env).

## Source of the spec
Option lists, defaults, layouts, currency table (170), locale list (30), address-book model, auto-lock options and alarm design were recovered from TW's JS bundle via REA. [certain] for those values. TW's English UI strings are not in the bundle: label wording is Harbour's.

## What is now real
- Auto-lock: options 1/5/10/15/30/60/never (default 10). chrome.alarms timer, re-armed on UI activity pings (20 s throttle), locks the vault on fire; popup polls status every 5 s and returns to Unlock. Did not exist before.
- Currency: 170 currencies, rate-gated switch (refuses if no rate), cached 30 min with stale fallback; applied to Home, token rows, Trending.
- Language: 30 locales; controls number/currency/date formatting only. UI text stays English.
- Color mode: system/light/dark via `<html data-theme>`; onboarding stays light.
- Preferences: asset-cell layouts 1/2/3, hide assets < $0.01 (unknown values never hidden), hide NFTs, Manage crypto.
- Address book: ethereum/bitcoin/solana addresses validated by wallet-core `AnyAddress.isValid`, stored inside the encrypted vault; picker in Send.
- Open in side panel (shown only when supported), Fullscreen, Testnet faucets, Help.

## Deviations from TW
- Defaults: preferSidePanel=false, hideNFTs=false, hideLowBalanceAssets=false; no analytics flag.
- pt vs pt-BR: exact match first (TW picks the first prefix match).
- Arbitrum Sepolia faucet: TW reuses the Ethereum Sepolia Alchemy URL (apparent slip); Harbour links Alchemy's Arbitrum Sepolia page.

## Deliberately omitted (no real feature behind them yet)
Connected/Blacklisted dApps, Default wallet, Developer toggles, push notifications, Custom Networks, Sync with Mobile, UTXO management, biometrics, analytics, TW help links. Shipping them would be toggles that store a value and do nothing.

## Unverified
Live rate APIs; side panel overriding the popup (`openPanelOnActionClick`) [Likely]; visual QA of dark mode and the three layouts; 1-minute alarm minimum (fine on Chrome >= 114).
