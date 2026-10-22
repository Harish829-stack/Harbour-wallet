# Harbour Wallet — Feature Matrix (2026-10-19, after cleanup)
Gate: `tsc` clean · `npm test` 349/349 · `vite build` OK. Evidence: code inspection + mocked tests. **Nothing is live-network-verified and no Chrome visual QA has been done since onboarding.** Per-area detail: `evidences/re-evidence/NN-*/STATUS.md`.

## 1. Implemented (code complete, mock-tested)
| Area | Status | Notes |
|---|---|---|
| Chain registry | 86 TW chains (CoinType-keyed), logos, derivation, adapters | HAR `/v1/balances/chains` list |
| Vault/crypto, lock, auto-lock | Real | PBKDF2→passworder→StoredKey; session keys; unlock throttle |
| Onboarding | Create, phrase/private-key import, network picker, Solana Trust/Phantom, QR import, passkey, backup, wallet limit (30), idle timeout, additional wallet | Camera/WebAuthn not run in browser |
| dApp provider | EIP-1193/6963, `trustwallet` alias, Solana + Wallet Standard, approval window, connections, blacklist, detail, Approvals tab | MAIN-world injection never loaded in Chrome |
| WalletConnect v2 | Reown WalletKit in service worker, pair/disconnect, project-ID setting | Needs a free Reown project ID; relay unverified |
| Send / Receive / Tx detail | EVM (45), BTC, SOL(+SPL), TRON(+TRC20), 14 Cosmos + THORChain, XRP, ALGO full; ~16 families native only; NFT send | See gaps |
| Swap | LI.FI (EVM) + Jupiter (Solana), settings, providers, confirm, status, history | APIs unverified |
| Staking / Earn | 12 Cosmos chains, SOL, ETH(Lido), BNB(StakeHub) | |
| NFTs | Collections, items, detail, hide/report, send (721/1155/SOL) | |
| Buy / Sell / ramps | Amount, fiat/crypto/network/provider/payment pickers, recurring, P2P, CEX funding | Quotes are public-provider substitutes |
| Discover, announcements, sentiment | Real screens + public sources | |
| Settings | Security, auto-lock, language, currency, colour mode, preferences, address book, wallet manage/accounts/detail, developer, faucets, notifications (prefs), help, migration | |
| Custom networks/tokens, gas screen | Real | |
| Theme | Tokenised light/dark, onboarding palette unified | Raw gradients remain; dark audit pending |

## 2. Left to implement
- **Ledger / hardware wallets** (stub only: `handlers/ledger.ts`, `features/ledger.tsx`; Ledger signing; hardware-wallet route). Ledger import in onboarding falls back to a message.
- **Send**: ICP, FIO, Nimiq, Aion, Ontology unsupported; tokens on most non-EVM chains; FlexGas; bridge and inscriptions/inscribe logic (screens only); sanctioned-address / exchange-memo lists.
- **Provider**: SIWS, biometric unlock in approval window, wallet-wide (not per-origin) chain; real approval scan beyond Harbour-granted allowances.
- **Staking**: Tron, Polkadot, Cardano, multi-validator; **NFT**: floor prices, BSC/Avalanche indexers.
- **Swap**: BTC/THORChain, EVM↔Solana, gasless, dust cleaner.
- **Settings**: UTXO management thin; notifications have no push backend; Points unconfirmed.
- **Assets**: logos for zklinknova, neutron, neon, aurora; i18n beyond English.
- **Verification (largest gap)**: live RPC/API checks, Chrome QA (injection, camera, passkey, dark mode), TW official signing vectors, route-by-route screenshot parity (105 routes), release hardening, migration→Send params check.

## 3. Similarity to Trust Wallet
- **Same/closest**: wallet-core 4.8.2 wasm (identical) for derivation/signing; CoinType-keyed 86-chain set; StoredKey/passworder vault layering, PBKDF2 params, session-key and unlock-throttle model; MV3 service-worker router + content-script→inpage provider split (EIP-1193/6963, `window.trustwallet`); route/screen names and flow order recovered from the bundle (onboarding, send, swap, earn, settings); per-chain send via wallet-core signing inputs.
- **Similar (re-implemented)**: screens/UX from recovered strings and captures, not original source; dark/light via CSS tokens; auto-lock via alarms (TW's scheduler UNKNOWN).
- **Different**: Harbour is modular (`handlers/*`, `features/*`, per-family adapters); per-origin chain in the provider; EVM staking signed with viem, not AnySigner.

## 4. Replaced with public/equivalent providers (TW uses a private gateway)
| TW capability | Harbour substitute |
|---|---|
| Balances/prices/tickers | Public chain RPCs + CoinGecko-style price service |
| Token/asset lists, logos, validators | trustwallet/assets (GitHub), bundled snapshots |
| Tx history | RPC + explorer (Blockscout-type) APIs |
| NFT collections | Blockscout v2 (15 EVM), Solana DAS / Magic Eden |
| Swap | LI.FI, Jupiter |
| Buy/Sell quotes | Public ramp providers + P2P/CEX funding screens |
| Staking data | Chain REST/RPC, Lido, StakeHub, assets lists |
| Discover / announcements / sentiment | Public feeds, `core/discover`, `core/sentiment` |
| Phishing/blacklist | Public lists + local blacklist |
| WalletConnect relay | Reown Cloud (user-supplied project ID) |
| Approval scan, points, push notifications | Not replaced yet |
Numbers will not match Trust Wallet's.
