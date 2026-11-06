# 31 - dApp provider stack: status (2026-10-19)

Legend: Real = implemented and exercised by tests with fakes; Partial = implemented, limited or not exercised end to end; Gap = not built.
Nothing here was verified against a live RPC, CoinGecko-free price source, the MetaMask phishing list, or a real dApp page: all such paths are **live-unverified** (sandbox egress blocked; tests use mocked fetch / a local JSON-RPC server).

## Page side
| Item | Status | Notes |
|---|---|---|
| `window.ethereum`, `window.trustwallet`, EIP-1193 request/events | Real (unit) | `src/inpage/ethereum.ts`; static answers served from cache; legacy `enable/send/sendAsync` |
| EIP-6963 announce (rdns `app.harbourwallet`) | Partial | built and bundled (`public/inpage.js`, 15 KB); not loaded into a real page |
| Solana provider + Wallet Standard (connect, signMessage, signTransaction(s), signAndSendTransaction) | Real (service) / Partial (page object) | service flow verified with ed25519; page object untested in a browser. `signIn` (SIWS) not implemented |
| MAIN-world injection | Partial | `registerContentScripts` id `harbour-inpage`, `document_start`; not verified in a loaded Chrome profile |
| Content bridge | Real (unit) | strict allowlist, schema validation, id correlation, 200 inflight cap, port-sender origin/frame binding in background |

## Background
| Item | Status | Notes |
|---|---|---|
| Provider router separate from internal router | Real | `background/provider/*`; internal router rejects non-extension senders (tested) |
| Per-origin permissions, blacklist (by hostname) | Real | `core/provider/store.ts` |
| Restart-surviving pending queue + settled hand-off | Real (fakes) | stage journal prevents replay of an executing tx; real worker kill not tested |
| Rate limiting (-32005), per-origin pending caps | Real | |
| Error codes 4001/4100/4200/4900/4901/4902/-32002/-32005/-32601/-32602/-32603 | Real | |
| Phishing check | Partial | MetaMask list, 24h cache; live-unverified; shows "unavailable" honestly |

## Approval window (`#/notification`, `ProviderSurface`)
| Screen / flow | Status |
|---|---|
| Connect (account + network picker), permissions request | Real UI, not visually QA'd |
| Sign message (SIWE card, eth_sign warning), typed data (tree, permit warnings) | Real UI |
| Send transaction (decode, fee presets, gas edit, warnings) | Real UI; fee presets heuristic from node data |
| Switch chain, add chain (RPC chain-id probe), watch asset (metadata read from chain) | Real UI |
| Solana connect / sign / transaction screens | Partial |
| Unlock inside the window | Partial: password only, no biometric |
| Ledger/hardware accounts signing | Gap |

## Settings / Home
| Screen | Status |
|---|---|
| `/settings/connections`, blacklist, `/settings/connection/:id` | Real UI (`connections`, `connectionsBlacklist`, `connectionDetail`) |
| Home "Approvals" sub-tab | Partial: lists only allowances tracked through Harbour, re-read on chain; revoke is a real tx |

## Deviations from Trust Wallet
- One connected account per origin for both EVM and Solana; chain is per origin (TW: wallet-global).
- Wallet Home Approvals is not a full on-chain allowance scan.
- Known-chain `wallet_addEthereumChain` for an installed chain other than the current one asks for confirmation; approval never replaces the saved RPC or switches.
- No use of TW authenticated gateway.

## Tests
`test/provider.test.js` (60 tests): protocol/allowlist, origin binding, permission/pending stores, rate limiter, error codes, service flows, restart resilience, decode/SIWE/typed summary, phishing (mock fetch), personal_sign vector (web3.js), EIP-712 Mail spec vector and an independent v4 array encoder cross-check, raw-tx broadcast against a local mock node, Solana flows. `npx tsc --noEmit` clean; `npm test` 328/328.
