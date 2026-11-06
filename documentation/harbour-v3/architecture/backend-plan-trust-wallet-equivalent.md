<!-- Exported from Claude Docs on 2026-11-02. Source: https://claude.ai/artifact/1noUpyBHo5KKjBKA4sVMh4 -->
> **Local copy.** Exported from the shared doc https://claude.ai/artifact/1noUpyBHo5KKjBKA4sVMh4 on 2026-11-02 (written 2026-10-27). Status: historical design (superseded by the Go services plan). Embedded diagrams in the original appear here as text placeholders. Treat code as the source of truth; see `audit/HANDOFF.md`.

# Harbour Backend Plan: Trust Wallet-Equivalent Services

Oct 27, 2026 · @Harish

## Answer

A Trust Wallet-class backend is a **read-and-relay data plane**, never a custody system: it indexes public chain data, aggregates prices and swap routes, scores risk, and pushes updates, while every key and signature stays in the extension. REA on Trust Wallet 26.41.0 shows one HMAC-authenticated gateway (`gateway.us.trustwallet.com`) fronting about 73 API methods, an NDJSON balance stream, a Centrifugo-style WebSocket, and a separate node service (`*.twnodes.com`); the client keeps its own cache in a SQLite database (sql.js) with about 40 tables. The server's language and database are not in the extension and stay unknown.

**The plan:** build Harbour's backend in four phases over about 16 to 20 weeks: (1) device auth plus a proper database behind the existing Cloudflare gateway, (2) an indexer for balances, history and token discovery on 5 to 7 chains, (3) a realtime stream and push, (4) risk, approvals, NFTs and swap sessions. Postgres (or Cloudflare D1 at first) holds public data only: device records, public addresses, indexed transactions, prices. Seeds, keys and passwords never leave the device.

## How Trust Wallet's backend is reached

&#91;embedded content: Trust Wallet 26.41.0 backend hosts, from REA\]

Everything in the solid box goes to one host, signed with a per-device HMAC key (`X-TW-CREDENTIAL`, `X-TW-NONCE`, `X-TW-DATE`, `Authorization: HMAC-SHA256`). Chain RPC goes to a separate node service using short-lived session URLs, so the gateway never has to proxy raw RPC traffic.

## API contracts

These are the calls Harbour needs equivalents for, grouped by service. Paths and fields are recovered from Trust Wallet's `ApiService` (73 methods); the full list with every parameter is in `evidences/re-evidence/40-backend-api/2026-10-21/CLIENT-CONTRACTS.md`.

| Service | Trust Wallet call | What goes in | What comes back | Harbour today |
| --- | --- | --- | --- | --- |
| Device auth | `POST /v2/devices/fingerprint` | random identifier, bundle id, screen size | `device_id`, `hash_key` (HMAC secret) | None (IP rate limit only) |
| Device settings | `PUT /v2/devices/{id}`, `/push-topics` | version, language, currency, push token, topics | ok | Push register in KV |
| Wallet registry | `POST /v3/devices/{d}/wallets/{w}/register`, `/address_association` | public addresses per coin, parent wallet id | accounts, coins | None |
| Token discovery | `POST /v1/assets` (version 30) | assets, `from_time` cursor | `docs`, `meta.interval_ms` (poll rate set by server) | Client scans via RPC and explorers |
| Balances | `POST /v1/balances/stream`, `GET /v1/balances/chains` | `[{asset_id, address}]`, currency | NDJSON lines: total, available, staked, rewards, fiat values; per-chain capability flags | Direct RPC per chain |
| Market | `POST /v2/market/tickers`, `GET /v2/market/rates`, `/charts/{a}`, `/info/{a}` | assets, currency | price, 24h change, provider, timestamp | Gateway CoinGecko cache |
| Search and listings | `GET /v1/search/assets`, `/v1/assets/listings`, tabs and trending config | query, networks, limits | assets with pricing | CoinGecko and GeckoTerminal |
| History | `GET /v1/txhub/txs`, `POST /v1/txhub/bulk_history` | asset, address, time range, `next_token` | `{data, meta}` with cursor | Explorer APIs via gateway |
| Risk | `POST /v1/validate/address`, `/url`, `/transaction`, `/message` | address or URL or tx object | provider, `risk_analysis`, `flagged_address` | GoPlus, ScamSniffer, phishing lists |
| Approvals | `POST /v1/approvals/scan` | `[{chain, address}]`, currency | allowances with risk | GoPlus plus on-chain `allowance()` |
| Simulation | `POST api.trustwallet.com/v1/wizard/simulate`, `/visualize` | transaction | balance changes or silent failure code "1" | `eth_simulateV1` on RPC |
| NFTs | `POST /v3/nft/collections`, token and metadata GETs | owners by chain, page, `exclude_spam=true` | collections, tokens | Alchemy, Blockscout, Magic Eden |
| Swaps | `/amber-api/v2/session`, `/session/status`, `/session/close`, `/route/step`, `/v1/history/status` | parameters, features, session id | quotes, steps, settlement status | LI.FI, Jupiter, Relay, THORChain from the client |
| Realtime | `POST /v1/centrifugo-hooks/token`, then `wss://.../stream/ws` | empty body | token for the socket | None |
| Content | `/v2/announcements`, `/v1/homepage`, `/v1/discover/*`, naming `/v1/lookup` | device, wallet prefix `m_` | cards, dApps, resolved address | Static lists |

**New in this REA pass:** the realtime socket carries two kinds of channels. Balance channels are named `balances:<coin>.<checksummed address>`, chosen by `RealtimeBalanceService`, which ranks accounts with non-zero balances first and stops at a channel cap. Swap quote channels are `swaps:v1.<sessionId>`, opened by `SwapQuoteSessionService`, which falls back to polling `session/status` when the server rejects the channel. Errors 102, 103 and 106 mean rejected; 105 means already subscribed.

## Data stores

Trust Wallet keeps a full SQLite cache inside the extension and a server registry of public data; neither holds keys. The local schema is recovered exactly (49 CREATE TABLE statements, about 40 distinct tables including migration copies); the server schema is not in the extension, so the server column below is what its API contracts force it to store.

**Inside the extension (recovered)**

| Store | Contents | Notes |
| --- | --- | --- |
| `storage.local` `trust:pbkdf2`, `trust:vaultId`, `trust:wallets:<vaultId>` | KDF parameters, encrypted vault and keystores | The only secret data |
| `storage.session` | Derived unlock keys | Cleared when the browser closes |
| `storage.local` `trust:store` | Redux state, 16 slices, versioned migrations | No secrets |
| `storage.local` `TrustSDK_DB` | SQLite file (sql.js), deflated and Base64-encoded | Compressed, not encrypted |

The SQLite tables group as follows: asset identity and capability (`AssetInfo`, `AssetStatus`, `AssetLocalStatus`); balances per address (`AssetAccount` with available, frozen, locked, rewards, staked, pending, blocked, claimable, transferable and inscribed amounts stored as text); prices (`AssetTicker`, `MarketInfo`, `AssetHighlights`); security (`AssetSecurityInfo`, `Approval` keyed by wallet, address, spender and asset); fees (`FeePriority`); price alerts with sync and retry fields (`PriceAlert`, `PriceAlertAssets`, `PriceAlertSettings`); home and earn caches; swap pairs; launchpool, stablecoin and perpetuals tables. Amounts are strings in smallest units, never floats.

**On the server (forced by the API, engine unknown)**

| Data | Why the server must hold it |
| --- | --- |
| Device id, HMAC `hash_key`, version, language, currency, push token, topics | Signs every request; push delivery |
| Wallet id to public addresses per coin, parent wallet | `register` and `address_association`; drives discovery and push |
| Asset catalogue: id, chain, contract, decimals, icon, capability flags, listings | Search, listings, buy/sell/swap flags |
| Discovery cursor per wallet scope | `from_time` incremental discovery |
| Indexed balances and transactions per address | Balance stream and txhub history |
| Price and market snapshots by provider | Tickers, charts, rates |
| Risk and approval results | Validate and approvals scan |
| Swap sessions, steps and settlement | Amber session lifecycle |
| Realtime tokens and channel entitlements | Centrifugo connect and subscribe |
| Announcements, homepage, discover config, VIP points | Server-driven content |

Captured response headers hint at Istio/Envoy on the `twnodes` hosts and Cloudflare on the CDN, platform and wallet-kit hosts; Trust Wallet's real database and server language are unknown.

## How MetaMask does it differently

MetaMask splits the same jobs across several small public APIs and authenticates with a signed-in profile instead of a device HMAC. This comes from MetaMask's open-source `@metamask/core-backend` package, not from REA.

| Concern | Trust Wallet | MetaMask |
| --- | --- | --- |
| Hosts | One gateway plus node and CDN hosts | `accounts.api.cx.metamask.io` (balances, transactions, NFTs, discovery), `price.api.cx.metamask.io`, `token.api.cx.metamask.io`, `tokens.api.cx.metamask.io` |
| Auth | Per-device HMAC key from a fingerprint call | Bearer token from MetaMask's sign-in (authentication controller), cached about 5 minutes |
| Realtime | Centrifugo-style socket; channels `balances:<coin>.<address>`, `swaps:v1.<session>` | WebSocket; channels `account-activity.v1.<CAIP-10 account>`; connects only when signed in, unlocked and the feature flag is on |
| Fallback | Per-chain RPC when the stream misses assets | Polling when the socket is down; per-chain status pushed as `system-notification` |
| Chain RPC | Own node service with session URLs | Infura by default (general knowledge, not verified here) |
| Security alerts | Gateway `validate` endpoints | Blockaid simulation and alerts on major EVM chains since 2024 |

The lesson for Harbour: MetaMask's split-by-domain APIs with standard bearer tokens are easier to build and scale than one large gateway, and its rule of connecting realtime only when unlocked is worth copying.

Sources: [@metamask/core-backend README](https://cdn.jsdelivr.net/npm/@metamask/core-backend@6.3.3/README.md), [The Block on Blockaid alerts](https://theblock.co/post/278156/metamask-blockaid-security-alerts).

## Harbour backend design

Keep the Cloudflare gateway as the front door and add three things behind it: device auth, a Postgres database of public chain data, and background workers that fill it. The wallet must still work when all of it is down, by falling back to direct RPC as it does today.

&#91;embedded content: Harbour backend target · 4 layers\]

**Device auth (better than Trust Wallet's).** Trust Wallet's server issues a shared HMAC secret and its signature skips the request body. Harbour should instead generate an Ed25519 key pair in the extension (WebCrypto, non-extractable, kept in IndexedDB), register only the public key, and sign `method; path; sorted query; SHA-256(body); timestamp; nonce`. The server checks a 5-minute clock window and rejects reused nonces for 10 minutes. A leaked database then holds no signing secrets. Registration is gated by Cloudflare Turnstile or a small proof-of-work, and rate limits key on device id plus IP in a Durable Object.

**Database schema (Postgres; Cloudflare D1 is enough for phase 1).** All amounts are `numeric(78,0)` in smallest units, as Trust Wallet's local schema does with strings.

| Table | Key columns | Purpose |
| --- | --- | --- |
| `devices` | id, public\_key, app\_version, locale, currency, push\_token (encrypted), created\_at, last\_seen\_at, revoked\_at | Auth and settings |
| `device_addresses` | device\_id, chain, address, added\_at | Which addresses to index and push for; the privacy cost, so delete on unregister |
| `chains` | id (CAIP-2), family, enabled, ws\_supported, finality\_depth | Capability flags like `/v1/balances/chains` |
| `assets` | asset\_id, chain, contract, symbol, decimals, logo, flags, spam\_score, verified | Catalogue, search, spam filter |
| `balances` | chain, address, asset\_id, amount, block\_number, updated\_at | Balance stream source |
| `blocks` | chain, number, hash, parent\_hash | Reorg detection |
| `transfers` | chain, tx\_hash, log\_index, block\_number, block\_time, from, to, asset\_id, amount, status | History; partition by chain and month |
| `prices` | asset\_id, currency, ts, price, change\_24h, source | Tickers and charts (latest copy in cache) |
| `risk_results` | kind, subject, provider, result, expires\_at | Cached address, URL and token checks |
| `approvals` | chain, owner, spender, asset\_id, allowance, block\_number, risk | Approval scanner |
| `swap_sessions`, `swap_steps` | session id, device\_id, params, provider, status, tx\_hash, expires\_at | Server-side swap state, if you add it |
| `config_releases` | seq, payload, signature, issued\_at, expires\_at | Signed remote config history |

**What never goes in the database:** seeds, private keys, passwords or their hashes, signed but unbroadcast transactions, and IP addresses beyond short-lived rate-limit counters.

## Phased build plan

Four phases of about 4 to 5 weeks each for 2 engineers; each ends at a gate the extension can test against. Start each feature behind a signed-config flag, with direct RPC as the fallback.

| Phase | Weeks | Build | Trust Wallet equivalent | Gate |
| --- | --- | --- | --- | --- |
| 1. Foundation | 1-4 | Ed25519 device registration and request signing; D1 or Postgres with migrations; `devices`, `device_addresses`, `chains`, `assets`; asset catalogue job (CoinGecko plus your token lists); move push registrations out of KV | `/v2/devices/*`, wallet register, `/v1/assets` metadata and search | Replayed and unsigned requests are refused; clean install registers and lists assets |
| 2. Indexer | 5-9 | Balances and transfer history for Ethereum, BNB, Polygon, Arbitrum, Base, Solana, Tron, fed by provider APIs and webhooks (Alchemy transfers, Helius) rather than your own nodes; reorg handling via `blocks`; `/v1/balances` as NDJSON, `/v1/history` with cursors; token discovery | `/v1/balances/stream`, `/v1/txhub/*`, `/v1/assets` discovery | Balances match RPC within one block on all 7 chains; a forced reorg rewrites history correctly |
| 3. Realtime and push | 10-13 | Durable Object WebSocket per device; channels `balances:<chain>.<address>`; connect only while unlocked; notifier sends FCM pushes from the indexer stream instead of 5-minute polling | `/stream/ws`, centrifugo token, push topics | Incoming transfer shows in the popup in under 10 s and as a push in under 30 s |
| 4. Safety and trading | 14-20 | Risk endpoints wrapping GoPlus and ScamSniffer with caching; approval scanner from indexed `Approval` events; NFT ownership; optional server swap sessions that only aggregate quotes, with client-side validation kept as the safety layer | `/v1/validate/*`, `/v1/approvals/scan`, `/v3/nft/*`, amber sessions | Each endpoint degrades to "check unavailable" in the UI, never to "safe" |

**Running cost, roughly:** Cloudflare Workers paid plan, a managed Postgres (Neon or Supabase), and provider API plans (Alchemy, Helius) are the main bills; your own nodes are not needed until volume justifies them. Check current pricing before budgeting.

**Operations from phase 1:** structured logs with request ids, per-route and per-provider error dashboards, alerts on error rate and quota, daily database backups, and a runbook for rotating every key.

## Evidence and confidence

The client side of Trust Wallet's backend is well evidenced; the server side is not recoverable from an extension at all.

| Claim | Confidence | Source |
| --- | --- | --- |
| Hosts, 73 `ApiService` methods, request fields | Confirmed in code | REA recovery of `background.js` (26.41.0, SHA-256 `a6dc88b6...`), `CLIENT-CONTRACTS.md` |
| HMAC signing string and headers; body not signed | Confirmed in code and re-run on synthetic fixtures | `auth-fixtures.json` |
| Local SQLite schema and `TrustSDK_DB` storage | Confirmed in code | `local-schema-unique.sql` (49 CREATE TABLE statements) |
| Response shapes (NDJSON balances, tickers, history) | Observed in historical captures only | `HAR-SCHEMAS.md`, `har-contracts.json` |
| Realtime channel names `balances:<coin>.<address>` and `swaps:v1.<session>` | Confirmed in code, this pass | Direct scan of the REA-extracted bundle (`RealtimeBalanceService`, `SwapQuoteSessionService`) |
| Server database, language, hosting | Unknown | Not present in any client artifact |
| MetaMask design | Public source and press, not REA | Links in the MetaMask section |

This pass reused the REA evidence recorded on 2026-10-21 (`docs/re/TRUST-WALLET-BACKEND.md`) and added the realtime channel findings by scanning the same extracted bundle; it did not run a live browser capture or contact any Trust Wallet server. Populated responses for NFTs, history items and discovery `docs` are still missing from the captures, so those endpoint shapes in Harbour should be designed by you, not copied.
