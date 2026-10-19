# Harbour asset ledger — 2026-10-16

Production bundle: `harbour-wallet-v2/public-production/`. The earlier extracted `harbour-wallet-v2/public/reference/` remains historical material and is excluded by Vite's `publicDir`.

| Asset | Source and license | Local path | Modification and use |
|---|---|---|---|
| Ethereum, BTC, BNB, SOL, USDC and 15 other crypto/fiat marks | [spothq/cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons/tree/1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color), [CC0 1.0](https://github.com/spothq/cryptocurrency-icons/blob/1a63530be6e374711a8554f31b17e4cb92c25fa5/LICENSE.md) | `harbour-wallet-v2/public-production/asset-logos/*.svg`, license in `public-production/licenses/CRYPTOCURRENCY-ICONS-CC0.txt` | Copied unchanged, selected by a fixed symbol map. Used in asset rows, send/receive, currency settings, swap fallback, and design fixtures. POL uses the existing Polygon/MATIC network mark as a documented visual approximation. No logo is inferred from an unverified contract address. |
| UI glyphs and app icon anchor | [Lucide](https://lucide.dev/license), ISC | `harbour-wallet-v2/node_modules/lucide-react`, bundled by Vite; app icons in `public-production/icons/`, license in `public-production/licenses/LUCIDE.txt` | Glyphs scaled/stroked by UI. App icon adds Harbour color and shape around Lucide Anchor. |
| Inter font | [Inter](https://rsms.me/inter/), SIL Open Font License | `harbour-wallet-v2/node_modules/@fontsource/inter`, bundled by Vite; license in `public-production/licenses/INTER.txt` | Local Latin 400/500/600/700 WOFF2 for UI. |
| Harbour lighthouse illustration | Original Harbour vector authored for this project | `harbour-wallet-v2/public-production/illustrations/harbour.svg` | Used in onboarding and preview. |

The exact pinned crypto icon archive SHA-256 is `eea5e6aa5b6350db16bb67ec2bc059fd3fc8efbcb375f7be1ea87812f522943c`. `tools/import-crypto-logos.mjs` validates it and rejects scripts or external SVG references. Per-file hashes and exact URLs are in `evidence/00-screen-structure/2026-10-16/asset-logo-import.json`. Crypto marks identify well-known assets visually; they are not proof of the asset's network or contract. Unrecognized identities use a neutral shape.

Unresolved asset use: target-completion PancakeSwap artwork is not bundled. Its current card links to PancakeSwap, but the generic QR glyph must not be presented as its logo. Dynamic remote swap/token images still need a separate provenance and availability pass; they are not part of this licensed local set. No extracted Trust Wallet artwork is cleared for Harbour redistribution.

## 2026-10-19 — Chain logos now included in the production extension

The 82 downloaded network marks were in `harbour-wallet-v2/public/chains/`, which Vite does not package because `publicDir` is `public-production`. They are now copied unchanged to `harbour-wallet-v2/public-production/chains/`, and `scripts/fetch-chain-logos.mjs` targets that directory for future imports. The built extension includes all 82 and shows them in Home, Receive, network selection, and search. Four registry chains still use the neutral fallback.

Source: the public [trustwallet/assets chain logo tree](https://github.com/trustwallet/assets/tree/master/blockchains), using candidate `blockchains/<network>/info/logo.png` URLs in `scripts/fetch-chain-logos.mjs`. This earlier download used unpinned `master`; exact successful candidate URLs and commit were not recorded. Local file sizes and SHA-256 hashes are in `audit/ui/2026-10-19/chain-logo-manifest.json`. The repository states its **scripts and documentation** are MIT licensed; that statement does not establish rights to every contributed chain trademark. Logo ownership remains with the respective projects. The marks are asset identifiers, never Harbour branding or contract verification.

Trending now uses only the curated bundled symbol marks and a neutral fallback. It no longer hot-links live market image URLs that failed to load in the extension. Dynamic swap images remain a separate unresolved provenance/availability item.
