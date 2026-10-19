# Swap tab — Trust Wallet extension vs Harbour (evidence-backed spec)

Date: 2026-10-16. Confidence tags: [certain] hard evidence in the recovered bundle/strings, [likely] strong inference, [guessing] gap filled, UNKNOWN not recovered.

## 1. What TW's Swap tab actually is
- Client: Kotlin/JS `walletkit` service (`TrustSwapClient` → `/v2.1/swap`, `/v2.1/swap/quote`; Amber routing API: domains, providers, route, route-step, history, transaction-submit; Thorchain service; approval service; smart-contract decoder) plus a React chunk (SwapBlock, SwapDetails, SettingsModal, QuoteRefreshRing, useSwapCta, useSwapQuoteFeed, swap runs / progress toast, history). [certain]
- Evidence: `evidence/25-swap/{serializer-schemas.json, tw-swap-strings.en.json, tw-swap-ui-messages.json}`. `tw-swap-i18n-keys.json` is low value.
- Backend is TW's authenticated gateway (`gateway.us.trustwallet.com`). Harbour does NOT call it (needs a TW device credential = impersonation). No HAR token/device id/hash_key is used anywhere in code.

## 2. Feature status in Harbour
| Feature | Evidence | Harbour | Status |
|---|---|---|---|
| Pair form, flip, max, balances, fiat values | [certain] | `swap/SwapTab.tsx`, `swapStore.ts` | built, not live-QA'd |
| Token picker: search, network chips, recents, popular, balances | [certain] UI / [guessing] curated lists | `swap/screens.tsx`, `core/swap/tokens.ts`, LI.FI token lookup | built |
| Quote feed, 60 s auto-refresh + countdown ring | [certain] (`refreshInterval:60`) | `QuoteRing`, `QUOTE_REFRESH_SECONDS` | built |
| Multiple providers + sort (best price / fastest / most secure / recommended) | [certain] AmberRouteSort | `ProvidersSheet`, `engine.sortRoutes` | built (labels are Harbour's) |
| Settings: slippage presets 0.1/0.5/1.0/2.5, stepper ±0.1, clamp 30, >5% warning | [certain] | `sheets.tsx`, `rules.ts` | built |
| Settings toggles: Best price execution, Solana turbo, Unlimited allowance | [certain] names; mechanism of MEV UNKNOWN | Harbour: Flashbots/48.club RPC for chains 1 and 56 only | built, mechanism differs |
| Price impact severity (5 / 20 default, server override) | [certain] | `rules.priceImpactSeverity` | built, tested |
| CTA state machine (select → amount → gas → approve → impact ack → balance → swap) | [certain] order; exact balance text UNKNOWN | `resolveCta` | built, tested |
| ERC-20 approval then swap (staged) | [certain] | `swapService.approve/submit` | built, not run on mainnet |
| Status polling 2 s/5 s/10 s, 30 min timeout, processing/processed/failed | [certain] | `swapStatus`, `SwapStatusScreen` | built, tested cadence |
| Swap history | [certain] | `SwapHistoryScreen`, `wallet:swap:history` (cap 100) | built |
| Cross-chain bridge (EVM↔EVM) single-tx routes | [likely] | LI.FI single-step routes | built, unverified live |
| Solana swaps | [certain] feature / API UNKNOWN | Jupiter lite-api | built, unverified live |

## 3. Not implemented (gaps)
Bitcoin / THORChain swaps (needs UTXO + OP_RETURN signer); multi-leg runs and EVM↔Solana bridges (single-tx only); gasless / EIP-712 / 7702 swaps; VIP fee discounts; RWA / geoblock rules; dust cleaner; Sepolia (aggregators do not quote testnets); hardware-wallet approve flow.

## 4. Known deviations and UNKNOWNs
- TW default sort order, default pair, and the insufficient-balance label template: UNKNOWN. Harbour defaults: sort `quantity`, From=ETH, To empty.
- Insufficient-balance check is placed before the approval check (TW passes the native symbol there; template text not recovered).
- LI.FI price impact is derived from USD amounts. Jupiter `priceImpactPct` treated as a fraction [likely].
- Provider sort labels, MEV mechanism and the curated popular-token lists are Harbour's choices, not recovered TW behavior.

## 5. Safety model (aggregator output is untrusted)
EVM (`core/swap/safety.validateLifiTransaction`, plus contract-code and `estimateGas` checks in `swapService`): chainId, `from`, `to` non-zero, calldata hex, sell amount unchanged, `value` ≤ sell amount (native) + native fees, token sells carry no extra value, spender == `tx.to` == approved spender, min-out within user slippage, output drift ≤ slippage since quote. Solana: fee payer == our address, exactly one signature slot, Jupiter program present. **Not validated:** Solana instruction bodies beyond that, so a malicious Jupiter response could still do something unexpected inside the Jupiter program account list.

## 6. Verification actually performed
- `tsc --noEmit` clean; `vite build` clean; `npm test` 13 existing + 17 new tests pass (`test/swap.test.js`: rules, amounts, error mapping, LI.FI and Jupiter mapping from fixtures, safety accept/reject cases, Solana tx parse/attach).
- **Not performed:** any live call to LI.FI, Jupiter, THORNode or CoinGecko (egress blocked from both the cloud sandbox and the Mac shell; not bypassed). Response shapes follow public docs. Fixtures are hand-written from docs, so they prove internal consistency, not that the real APIs match.
- **Not performed:** visual QA in Chrome, and any real signed/broadcast swap.
- Needed from the user: a live smoke test in Chrome (quote ETH→USDC, SOL→USDC, one approval) with a small-balance wallet.
