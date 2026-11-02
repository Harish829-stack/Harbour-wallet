<!-- Exported from Claude Docs on 2026-11-02. Source: https://claude.ai/artifact/AeKzNNvjvfTVkw7wo95wHY -->
> **Local copy.** Exported from the shared doc https://claude.ai/artifact/AeKzNNvjvfTVkw7wo95wHY on 2026-11-02 (written 2026-10-22). Status: historical (harbour-wallet-v2). Embedded diagrams in the original appear here as text placeholders. Treat code as the source of truth; see `audit/HANDOFF.md`.

# Harbour Wallet — Implementation Documentation

Oct 22, 2026 · @Harish

## 1. Overview

Harbour Wallet is a Chrome Manifest V3 multi-chain wallet extension built as a close functional clone of Trust Wallet 26.41.0, implemented in 8 phases from `docs/trust-wallet-architecture/11-harbour-parity-plan.md`. It supports 86 chains, 6 dApp provider families beyond EVM and Solana, 4 swap providers, 9 earn families, and a signed release candidate (0.1.0). The code lives in `harbour-wallet-v2/` on branch `feat/harbour-parity`; about 25,000 lines of TypeScript, 410 automated tests.

**Design rules that shaped every phase:** keys never leave the background worker; third-party services are free tiers reached through one Cloudflare gateway (`harbour-gateway`) that holds the API keys; features that move money or carry legal risk (perps, predictions, gasless) ship behind remote flags that default to off; every unverified live path is labelled as such.

### Architecture

| Layer | Where | Responsibility |
| --- | --- | --- |
| Popup / side panel UI | `src/popup/` | React screens: onboarding, wallet, send, swap, earn, NFTs, markets, perps, predictions, Ledger. No secrets; talks to the worker over messages. |
| Background service worker | `src/background/` | Vault, signing, handlers (`handlers/*`), swap and send services, provider router, notifications. The only place keys are decrypted. |
| Content + inpage scripts | `src/content/`, `src/inpage/` | dApp bridge. Inpage injects EIP-1193/6963, Solana and Wallet Standard providers; content script relays over a nonce handshake. |
| Core (pure logic) | `src/core/` | Chains, send engine, swap providers, staking, markets, perps/predictions clients, security checks. No DOM or `chrome.*`; `fetch` is injected so everything is testable. |
| Harbour Kit | `src/kit/` | Data plane: node repository with failover, gateway client, remote config (signed), provider clients (CoinGecko, DefiLlama, GeckoTerminal, GoPlus). |
| Gateway | `gateway/` | Cloudflare Worker: keyed proxies, caching, per-device rate limits, push watcher cron. |

### Technology stack

TypeScript, React, Vite with `@crxjs`/vite-plugin for the MV3 build; `@trustwallet/wallet-core` (WASM) for key derivation, address validation and signing across chains; viem for EVM; `@mysten/sui`, `@aptos-labs/ts-sdk`, `@ton/core` + `@ton/crypto` for the newer provider families; `@polkadot/api` for nomination pools; `@msgpack/msgpack` for Hyperliquid; Ledger WebHID libraries (`hw-app-eth`, `hw-app-btc`, `hw-app-solana`); WalletConnect via `@reown/walletkit`. Tests run on Node's built-in runner with esbuild bundles; end-to-end checks run in real Chrome via Playwright.

## 2. Phases 0–3: foundation, data plane, chain breadth

These phases turned the popup-only prototype into a structured wallet with a verification harness, a gateway-backed data plane and broad chain coverage. The first wallet screens (home, send, receive, swap, trending, token detail, NFTs, earn, ramps, discover, sentiment, onboarding branches, multi-wallet and multi-account) were built before the parity plan and are carried forward unchanged.

| Phase | Delivered |
| --- | --- |
| 0. Verification harness | Node test runner with esbuild bundles and mocked fetch; real-Chrome e2e via Playwright; `scripts/verify.mjs` (tsc, gateway tsc, tests, build, secret scan); boundary tests that stop the popup importing vault, keys or wallet-core; CI workflow `harbour-ci.yml`. |
| 1. Core architecture | Background kernel (event registry with `INTERNAL_*` / `PUBLIC_*` namespaces, boot loop, persisted queue, self-heal guard); the old 600-line router split into six modules with 58 events; worker-held Redux store with the 16 Trust Wallet slice names, a `harbour-ui` port that pushes snapshots and patches, and versioned pre- and post-boot storage migrations. |
| 2. Kit and gateway | `src/kit`: HttpClient, NodeRepository with ranked failover that also drives the viem transport, Ed25519-signed remote config, price chain (CoinGecko, then DefiLlama), GoPlus checks. `harbour-gateway` deployed as a Cloudflare Worker so no API key ships in the bundle (the LI.FI key was removed from it). |
| 3. Chain breadth and send | 86 enabled chains in `registry.json`, plus 13 extra wallet-core chains in `registry.extra.json` (10 EVM, LTC, DOGE, DASH over Blockbook) that stay hidden until `check-chains.mjs` probes them live. Send engines for 25 families, each with fee tiers, memo or tag handling and inactive-account or reserve checks; per-family history adapters; custom tokens (EVM, SPL, TRC-20); Cardano added as its own family. |

**Known limits from these phases:** the registry is 86 enabled chains rather than the plan's 168; popup screens still use their own stores in places instead of the worker mirror; opt-in telemetry is not built (it needs a Sentry DSN); sending is not available on ICP, FIO, Nimiq, Ontology and Aion, each with an in-app reason shown on the Send screen.

## 3. Phase 4: dApp provider families

Dapps can now connect to Harbour on seven families. EVM (EIP-1193 and 6963), Solana and Wallet Standard existed already; Phase 4 added Cosmos, Sui, Aptos, Tron, Bitcoin and TON through a generic `multi` namespace (`core/provider/multi.ts`, `inpage/multi.ts`).

| Family | Surface | What works |
| --- | --- | --- |
| Cosmos | Keplr API on 11 chains | enable, getKey, signAmino, signDirect, signArbitrary, offline signers |
| Sui | Wallet Standard | connect, signPersonalMessage, build, simulate and submit transactions |
| Aptos | Petra-style `window.aptos` | connect, signMessage, build and submit transactions |
| Tron | TronLink request and tronWeb | sign, signMessageV2; the `txID` must equal sha256 of the raw data or the request is refused |
| Bitcoin | accounts, BIP-137, `signPsbt` | P2WPKH inputs, SIGHASH\_ALL, BIP-143, optional finalize |
| TON | `window.harbourTon` (TON Connect) | wallet v4r2 identity, `ton_addr`, `ton_proof`, `sendTransaction` (no `signData`) |

All families share one approval queue, per-origin connection records, and a binding check: if the account changes, pending requests are invalidated. The approval screen decodes what it can (Cosmos message types, Tron contract, PSBT inputs and outputs, message text).

**Also added:** SIWS sign-in with origin, domain and expiry warnings; opt-in biometric approval (a single-use proof valid for 60 seconds and bound to one pending request); a per-load nonce handshake between the inpage and content scripts.

**Service-worker constraints found by the real-Chrome run:** MV3 forbids dynamic `import()` in a service worker, so chain SDKs are static imports in `multiBuild.ts` and Vite's `modulePreload` is off; `globalShims.ts` sets `Buffer` and must remain the first import of the background entry; a narrow `window.crypto` shim wraps TON SDK calls only.

**Verified:** Chrome e2e passes connect and sign on every family above, including TON `ton_proof`. **Not verified:** live Sui, Aptos and TON transactions, and third-party demo dApps (Keplr, Sui, TON Connect).

## 4. Phase 5: swaps, gasless and earn

Swaps now race four providers and the best output wins; staking covers nine families. All signing code is unit-tested against mocked nodes; none of the new money paths has been run against mainnet yet.

### Swap

| Provider | Covers | Safety rules |
| --- | --- | --- |
| LI.FI | EVM swaps and bridges; Solana-source legs when Harbour is sole signer and fee payer | Existing path, key held by the gateway |
| Jupiter | Solana swaps | Existing path |
| Relay (`/relay/*`) | EVM-source swaps and bridges, including EVM to Solana | Re-quote at submit time; sign only `transaction` steps with our address, the confirmed spender, capped value and output within slippage; signature steps refused |
| THORChain (`/thornode/*`) | BTC to and from ETH, BNB and Base natives and ERC-20s | BTC sends to the vault with an OP\_RETURN memo; EVM sources call `router.depositWithExpiry`; fresh quote at submit; payout address must be the user's own; REFUND counts as failed |

Quotes are fetched in parallel with a 12 second cap per provider; failed providers are dropped while any answers, and a user-fixable error (amount, pair) beats a network error. Payouts always go to the user's own account address, never one carried inside a route. A dust cleaner (Swap settings, Clean up small balances) converts tokens worth $0.01–$5 on the current network into the native coin, one swap at a time.

### Gasless swaps (beta)

EIP-7702 delegation to the Ethereum Foundation's Simple7702Account (EntryPoint v0.8), with an ERC-4337 UserOperation sponsored by Pimlico through the gateway (`/pimlico/<chainId>`, method allowlist). Supported on Ethereum, BNB Chain, Polygon, Arbitrum and Base. It runs only when the remote flag `gasless7702` is on and the user enables the toggle; accounts delegated to another contract are refused, the delegate's `entryPoint()` is checked before signing, and any failure falls back to a normal transaction. Approve and swap are batched in one operation.

### Earn

| Family | Actions |
| --- | --- |
| Cosmos (12 chains), Solana, Lido, BNB | Existing: stake, unstake, claim; compound for Cosmos |
| TRON Stake 2.0 | Freeze, vote, claim, unfreeze (14 days), withdraw expired, redelegate votes |
| Tezos | Baker delegation, undelegation, redelegation; reveal added when needed |
| Cardano | Register stake key (2 ADA deposit, counted once), delegate, redelegate, claim (adds the DRep always-abstain vote reward withdrawal requires), unstake |
| Polkadot Asset Hub | Nomination pools via `@polkadot/api`: join, bond extra, claim, compound, unbond (28 days), withdraw |
| Rocket Pool | rETH deposit next to Lido; unstake burns rETH when collateral exists, otherwise the user is told to swap |

NFT collections now show floor price from Alchemy's OpenSea metadata. **Not tested live:** Relay, THORNode and Pimlico responses; TronGrid, TzKT, Koios and Asset Hub staking; Rocket Pool reads.

## 5. Phase 6: markets, discover and notifications

Charts and market info now fall back across four sources, and incoming-transfer notifications work with or without a server.

### Market data

Each chart or info lookup tries the gateway first (`/v2/market/charts`, `/info`, CoinGecko with the server key, cached in KV), then CoinGecko directly, then DefiLlama. Native coins resolve through the registry's `cg` id, so every mainnet chain gets a chart. Tokens (`token:<chainId>:<address>`) use GeckoTerminal for the top pool's OHLCV, price, FDV and volume; the custom-token screen shows a DEX price chart from 1H to 1Y.

Trending gained two modes: Hot tokens (CoinGecko trending through the gateway) and Hot on DEXs (GeckoTerminal trending pools on supported chains). The network filter is ordered by DefiLlama TVL.

### Sentiment and announcements

RSS from CoinDesk, Cointelegraph, Decrypt and The Block comes through gateway `/rss/<source>` (fixed allowlist, 10 minute cache) with a direct-fetch fallback. Announcements arrive in the Ed25519-signed remote config, are stored on every sync, shown in Help, and notified once each when the Product announcements topic is on.

### Notifications

| Path | How it works |
| --- | --- |
| Local watcher | A 5 minute alarm reads recent history for the active account on Ethereum, Bitcoin, BNB Chain, Solana, Polygon, Arbitrum, Base and TRON; notifies up to 3 new confirmed incoming transfers per run. The first run only records existing history. |
| Server push | `gcm` permission and a `chrome.instanceID` FCM token registered at gateway `/push/register`. A gateway cron every 5 minutes checks a rotating slice of registered addresses within the free plan's 50-subrequest budget, then sends FCM HTTP v1 data messages signed with an RS256 service-account JWT and deletes dead tokens. While push is registered the local watcher stands down. |

The Notifications screen shows which path is active and offers a test notification. `deploy-gateway.mjs` creates the `CACHE` KV namespace, pushes the Firebase service account, and prints `VITE_HB_FCM_SENDER_ID` for the build.

**Verified:** 390 tests at that point, including FCM JWT signature verification and dead-token cleanup; in real Chrome the alarm is scheduled and a test notification displays. **Not verified live:** GeckoTerminal, DefiLlama and CoinGecko trending responses, FCM delivery and the cron; the exit check (a test transfer triggers a push) needs the deployed gateway and a Firebase project.

## 6. Phase 7: perps, predictions, Ledger

Three advanced features landed. Perps and predictions are behind remote flags that default to off; Ledger is always available from Add wallet.

### Perps (Hyperliquid)

Flag `perps`; code in `core/perps/hyperliquid.ts`, `background/handlers/perps.ts`, `features/perps.tsx`. L1 agent signing (msgpack action hash and the phantom-agent EIP-712) and the user-signed actions (approveAgent, approveBuilderFee, withdraw3) reproduce the official SDK test vectors exactly. The agent key is generated on the device, encrypted with the wallet password, and cannot withdraw.

- Enable trading by approving the agent and the optional builder fee.
- Deposit Arbitrum USDC to Bridge2 (minimum 5 USDC); withdraw to self (1 USDC fee).
- Market (IOC, ±5%) and limit (GTC) orders with leverage update, cancel, and close at market.
- Screens for account, positions with PnL and liquidation price, open orders, recent fills, and markets by volume.
- Builder fee settings: `VITE_HB_HL_BUILDER`, `VITE_HB_HL_BUILDER_FEE`.

### Predictions (Polymarket CLOB V2)

Flag `predictions` plus Polymarket's `/api/geoblock` check; an unknown region means no trading. Reads cover markets (Gamma), market detail with books, portfolio (Data API) and pUSD or USDC.e balances. Trading from the wallet's own EOA wraps USDC.e into pUSD through the CollateralOnramp, approves the exchange or CTF operator, derives API credentials with a ClobAuth EIP-712 signature (stored encrypted), and signs V2 orders for the CTF or Neg Risk exchange, sent fill-or-kill with L2 HMAC headers. Books marked `version: "v2"` are read-only with a link out to polymarket.com. Builder code: `VITE_HB_PM_BUILDER_CODE`.

### Ledger over WebHID

`popup/ledger/device.ts`; WebHID runs in popup pages only. Connect your Ledger reads Ethereum (44'/60'/0'/0/0), Bitcoin native segwit (84'/0'/0'/0/0) and Solana (44'/501'/0') addresses and stores public addresses and paths, never keys.

| Chain | Signing flow | Check before broadcast |
| --- | --- | --- |
| EVM | Background prepares the unsigned transaction, the device signs with clear-signing resolution | Background recovers the signer and refuses a mismatch |
| Bitcoin | wallet-core coin selection, previous transactions from Esplora, device `createPaymentTransaction` | Signed transaction must pay exactly the prepared outputs |
| Solana | Receive only | n/a |

**Verified:** 399 tests at that point, including the SDK signature vectors; in real Chrome both flags report `FEATURE_DISABLED` while off. **Not verified:** Hyperliquid exchange calls, Polymarket orders (the sandbox has no egress) and Ledger signing (no device). Legal review is advisable before enabling predictions or perps for the public.

## 7. Phase 8: security, hardening and release

Phase 8 produced a reproducible, Ed25519-signed 0.1.0 release candidate and added risk checks to every approval. `SECURITY.md` is the full security model; this is the summary.

### Trust boundaries

Keys exist only in the background worker, are derived from the encrypted keystore (wallet-core StoredKey, AES-128-CTR) for one operation and wiped; the popup cannot import vault, key or wallet-core code (a test enforces it). Only this extension's own pages may send runtime messages, and there is no `externally_connectable`. dApp origin comes from the browser's `sender`, each page load does a fresh nonce handshake, approval requests are rate-limited per origin, and every signature waits for an approval window. API keys live only as gateway secrets, and the bundle secret scan fails the build if a key value appears. The Hyperliquid agent key and Polymarket credentials are stored encrypted and the agent key cannot withdraw; Ledger wallets hold public addresses only.

### What was added

| Area | Detail |
| --- | --- |
| Site and address risk | MetaMask eth-phishing-detect plus ScamSniffer domains; ScamSniffer addresses and GoPlus address reputation on dApp targets, approval spenders and send recipients; GoPlus token risk on swap buy tokens. Advisory only; when a list is unreachable the UI says so. |
| Transaction previews | `eth_simulateV1` with `traceTransfers` shows estimated native, ERC-20 and NFT balance changes on the approval screen; `eth_estimateGas` remains the revert check where simulation is unsupported. |
| Approval scanner | Settings, Security, Token approvals: GoPlus approval data verified with on-chain `allowance()` reads and one-tap revoke (`approve(spender, 0)`). Not available for Ledger wallets. |
| Permissions | `tabs` removed. Kept: alarms, storage, notifications, gcm, scripting, sidePanel, clipboardWrite, plus host access for the provider and RPCs. |
| CSP | `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`; no remote code, `eval` or `innerHTML`. |
| Dependencies | `npm audit --omit=dev`: 0 critical, 0 high, 0 moderate, 9 low. Upgraded `@mysten/sui` and `@ledgerhq/hw-app-eth`; pinned `axios` and `ws`. |

### Release tooling

`scripts/repro.mjs` builds twice and compares every file (139 identical). `scripts/release.mjs` writes a deterministic zip, SHA-256, per-file hashes and an Ed25519 signature; `scripts/verify-release.mjs` checks them. The 0.1.0 candidate zip has SHA-256 `d1685f6b945df8e796ac4d0c37bc64726d259e3b68ddb107dd9dc75710fa2163`, signed by public key `o9LU42tlcJAGxCZBpJKHglR7KMZuvLJfunJbkyB6jyc=`; metadata is in `releases/`. The private signing key is outside the repo and must be backed up offline. `STORE-LISTING.md` and `RELEASE.md` cover the Chrome Web Store submission and the release procedure.

**Still required before public release:** an external review of the vault, provider, signing code and gateway (scope listed in `SECURITY.md`), store screenshots and a privacy-policy URL, and the Trust Wallet screenshot parity measurement.

## 8. Gateway backend

The only backend is `harbour-gateway`, a Cloudflare Worker on the free plan (`gateway/worker.ts`, `gateway/push.ts`). It holds every provider key as a Worker secret, normalises responses, caches in a KV namespace (`CACHE`), limits each device to 120 requests a minute, and runs a push watcher on a 5 minute cron. The extension calls it when `VITE_HB_GATEWAY_URL` is set at build time and falls back to public endpoints otherwise.

| Route | Upstream | Notes |
| --- | --- | --- |
| `/helius/rpc` | Helius Solana RPC | Method allowlist (expanded to include getProgramAccounts and related reads) |
| `/alchemy/<chainId>/rpc`, `/alchemy/<chainId>/nft/*` | Alchemy | EVM RPC and NFT endpoints, including floor price and spam checks |
| `/etherscan/v2` | Etherscan v2 | History fallback; free plan covers Ethereum only |
| `/trongrid/*`, `/toncenter/*` | TronGrid, Toncenter | Path allowlists; Toncenter now also allows `jetton/masters` and `sendBocReturnHash` |
| `/gt/*`, `/rss/<source>` | GeckoTerminal, news feeds | Cached; RSS from a fixed allowlist |
| `/relay/*`, `/thornode/*`, `/pimlico/<chainId>` | Relay, THORNode, Pimlico | Swap quotes and status, gasless bundler (JSON-RPC method allowlist) |
| `/v2/market/prices, charts, info, tickers, trending` | CoinGecko | Trust Wallet-shaped responses, cached |
| `/v1/config` | Signed remote config | Ed25519 signature; carries the feature flags and announcements |
| `/push/register`, `/push/unregister` | FCM | Registrations in KV; cron sends data messages |

LI.FI and Jupiter quote routes also run through it. Secrets are `ALCHEMY_API_KEY`, `HELIUS_API_KEY`, `ETHERSCAN_API_KEY`, `TRONGRID_API_KEY`, `TONCENTER_API_KEY`, `LIFI_API_KEY`, `JUP_API_KEY`, `COINGECKO_KEY`, `RELAY_API_KEY`, `PIMLICO_API_KEY`, `FCM_SERVICE_ACCOUNT`, `CONFIG_JSON` and `CONFIG_SIG`.

**Deploying:** `node scripts/deploy-gateway.mjs` from a machine with `harbour-keys.env`. It creates the KV namespace, uploads secrets, signs and publishes `config/config.json` (flags `perps`, `predictions`, `gasless7702`, all false), and prints `VITE_HB_FCM_SENDER_ID`. `scripts/check-gateway.mjs` runs the route checks. The gateway was live at the Phase 2 checkpoint with 15 of 15 checks passing; it needs a redeploy to pick up the Relay, THORNode, Pimlico, push and Toncenter changes made since. The Toncenter key in use was testnet-only, so TON mainnet and jetton calls need a mainnet key.

## 9. Testing and results

The final build passes 410 unit tests, type-checks clean for the extension and gateway, builds for production, and passes the secret-leak scan with the real key file (11 key values checked, none in the bundle). The same build passed the real-Chrome run on 22 October 2026.

| Check | Result | How |
| --- | --- | --- |
| Unit tests | 410 pass, 0 fail | `npm test`: Node's runner over esbuild bundles of `src/core`, mocked `fetch`, wallet-core WASM for real signing |
| Type check | Clean | `tsc --noEmit` for the extension and for `gateway/` |
| Production build | Pass | `vite build`, about 33 seconds |
| Secret scan | Pass | `scripts/verify.mjs` compares the bundle against every value in `harbour-keys.env` plus common key shapes |
| Real Chrome | Pass | Playwright with a fresh profile: service worker boot; connect and sign on Sui, Aptos, Tron and Bitcoin; TON connect with `ton_proof`; the approval window text; no mnemonic in storage or UI state |
| Reproducible build | 139 files identical | `scripts/repro.mjs` (Phase 8) |
| Release signature | Verified | `scripts/verify-release.mjs` on the 0.1.0 candidate |

Signing code is checked against independent references where they exist: Hyperliquid against the official SDK vectors, Tron `txID` against sha256 of the raw data, EVM transactions parsed and recovered with viem, ed25519 and secp256k1 signatures verified with noble. The final gap sweep added `test/tokens-nonevm.test.js` (7 tests) for jetton, Sui coin and Aptos asset probes, balances, quotes and signing.

**What could not be tested here, and so needs a small-amount mainnet pass:** Sui, Aptos and TON transactions including the new token sends; Relay, THORChain and Pimlico swaps; TronGrid, Tezos, Cardano and Polkadot staking; GeckoTerminal, DefiLlama and CoinGecko trending; FCM push delivery and the gateway cron; Hyperliquid and Polymarket orders; Ledger signing. The build sandbox has no route to those services or to a hardware device.

## 10. Gap audit and what remains

A final sweep of the plan against the code found one real feature gap that could be built and tested here, and it is now closed: sending and holding TON jettons, Sui coins and Aptos coins or fungible assets (commit `0e9bc8d`). It also found that Bitcoin PSBT signing, listed as missing in an old comment, already worked, and that the release signing key and Firebase service-account file were untracked but not git-ignored; both are now ignored.

### Still open

| Item | Why it is open | Next step |
| --- | --- | --- |
| Send on ICP, FIO, Nimiq, Ontology, Aion | No usable browser-side library or public broadcast endpoint; the Send screen shows the reason | Add an IC agent, FIO ABI serialiser, or endpoints when wanted; Aion is discontinued |
| Tokens on Cosmos (IBC, CW20), Stellar, Polkadot Asset Hub | Not built | Same probe, balance and send pattern as the jetton work |
| USD prices for non-EVM custom tokens | No CoinGecko mapping for those contracts | GeckoTerminal token price lookup |
| Chain registry at 86, plan said 168 | 13 extra chains are built but stay hidden until probed live | Run `check-chains.mjs --write` with network access, then widen the list |
| BTC inscriptions view, coin control | Not built | Optional polish |
| Solana signing on Ledger | Receive only | Add a `signTransaction` flow like EVM and BTC |
| Opt-in telemetry | Needs a Sentry DSN | Provide a DSN and a consent switch |
| Popup stores on the worker mirror | Some popup screens still keep their own stores | Migrate screen by screen; no user-visible change |
| 95% screenshot parity | Not measured | Capture and compare against the Trust Wallet screenshots |
| External security review | Not commissioned | Scope is in `SECURITY.md` |

### Before a public release

- [ ] Redeploy the gateway with `node scripts/deploy-gateway.mjs` (needs `RELAY_API_KEY`, `PIMLICO_API_KEY`, `FCM_SERVICE_ACCOUNT_FILE` and `FCM_SENDER_ID` in `harbour-keys.env`) and put a mainnet Toncenter key in place.
- [ ] Run `npm install` on the development Mac, then `node scripts/verify.mjs`.
- [ ] Back up `harbour-release-key.json` offline; losing it means no future signed releases.
- [ ] Mainnet test with small amounts: Relay and THORChain swaps, Sui, Aptos and TON sends including tokens, each staking family, push delivery, then perps, predictions and Ledger behind their flags.
- [ ] Legal review before turning on predictions or perps.
- [ ] Prepare store screenshots and a privacy-policy URL, then commission the external review.
