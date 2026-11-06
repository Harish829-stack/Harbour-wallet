# 36 Ramps, Fund, Sell, P2P, Recurring (spec and deviations)

Confidence tags: [certain] seen in TW bundle/HAR strings, [likely] inferred from TW routes or provider docs, [guessing], UNKNOWN.
The TW authenticated gateway is not used. Provider endpoints below are LIVE-UNVERIFIED (no network in this build).

## TW flows recovered
- Routes: /fund (FundingMethods), /fund/cex/{providers,platform,assets,qr}, /buy/new[/enter-amount|select-fiat|select-crypto|select-network|select-provider|select-payment-method], /buy/recurring-setup, /sell/new[...], /fiat-ramps (Buy|Sell tabs) [certain].
- Quotes grouped by payment category with BestPrice and IsRecommended badges; `enforceTrustedRampAddress` guards the widget address [certain].
- FundingMethods rows: Buy crypto, Deposit from exchange, Receive, Buy with P2P, Recurring buy [likely]. CEX: Binance goes through a platform step, Coinbase does not [likely].
- English message catalog absent from the bundle: copy uses inline defaults; other strings [guessing].

## Harbour implementation
- Core `src/core/ramps/*`: fiat table, asset catalog, six provider adapters (Transak, Ramp, MoonPay, Mercuryo, Banxa, Onramper), quote aggregator, key store, URL guard, CEX lists, P2P URL, recurring .ics.
- Wallet address always comes from the vault in the background; never from the UI payload. URLs built only with `buildSafeUrl` (https, allow-listed host, no credentials).
- Keys: Settings > Help > Ramp API keys, stored in chrome.storage.local `wallet:ramp:keys`, publishable keys only, UI sees masked previews. Without a key the provider shows "Needs API key"; there are no fake quotes or fallback prices.
- Final step opens the provider widget in a new tab with the validated address prefilled. Sell mirrors buy (amount slider, balance check).
- CEX: asset lists from Coinbase Exchange public API / Binance public bapi (unofficial) else registry-derived with an explicit limit notice; QR + copy + network warnings + exchange withdrawal link.
- P2P: Binance P2P URL for USDT/BTC/ETH/BNB/USDC.

## Deviations and gaps
- Recurring buy: no provider scheduler is available without partner keys. Harbour does a first Mercuryo purchase plus a downloadable .ics reminder. Partial.
- MoonPay/Mercuryo signed-URL requirements (secret key) cannot be met client-side: widget opens unsigned, or reports needs key. [likely]
- Banxa has no public quote API: widget only.
- Sell is also offered in the Fund menu (Harbour addition).
- No per-provider min/max from TW config; provider limits surface only as quote errors.
- Binance bapi endpoint is unofficial [guessing]; falls back to registry.
- TW CSVC verification code step: not reproduced (gap).
- All quote response shapes are parsed from provider docs and unit tests with mocked fetch; never checked against live responses.
