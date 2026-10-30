# Harbour Wallet: runtime audit results

> **Update 2026-10-30:** this file records the audit as run on baseline `6692a88`. Fixes are on branch `harbour-v3`; current finding status is in `findings.md`, the overview in `summary.md`, hand steps in `fixes.md`. Control statuses below are not re-scored.

| Item | Value |
| --- | --- |
| Date | 2026-10-30 |
| Build | `dist/` (local build, API `http://localhost:8080`), extension ID `lgobkgelpfojjfmomhabgnbbkjgdjpeo` |
| Browser | Chrome for Testing 156.0.8078.80, driven by chrome-devtools-mcp (`--categoryExtensions`) |
| Backend | Local docker-compose stack (`make up`), all services healthy |
| Test wallet | Throwaway wallet created in the MCP profile (address `0x0bDf…3742`, no funds). Test dApp origin: `https://example.com` |
| Limits | Service-worker console and network traffic cannot be inspected with this MCP. Funded-transaction paths were not executed (no testnet funds). Passkey and Ledger were not exercised |

## Results

| ID | Runtime test | Observed | Result |
| --- | --- | --- | --- |
| E-08 / F-01 | Unconnected page reads `eth_accounts`, `selectedAddress` | `[]`, `null` | PASS |
| E-09 | Enumerate provider and window globals | EIP-6963 announces `Harbour` (`app.harbourwallet`); also `isTrust`/`isTrustWallet`, `window.trustwallet`, `window.trustWallet`; onboarding offers "Have the Trust Wallet mobile app?" | PARTIAL (confirms HW-2026-010) |
| C-01 | `eth_sign`, `personal_sign`, `eth_sendTransaction`, switch chain from an unconnected site | All refused with 4100 | PASS |
| C-04 | `eth_sign` from a connected site | 4200 "eth_sign is disabled in Harbour" | PASS |
| C-01 | `personal_sign` for another account; tx with a foreign `from` | 4100 both | PASS |
| C-01 | `eth_signTransaction` | 4200 unsupported | PASS |
| I-06 | `admin_peers`, `debug_traceTransaction` via provider | -32601; `eth_blockNumber` works | PASS |
| E-10 / E-14 | Forged `HARBOUR_INPAGE_HELLO` handshake from the page | Not acknowledged | PASS |
| E-10 / E-14 | Raw bridge messages: bad namespace, `createWallet`/`unlock` methods, oversized id, prototype-polluted params | Rejected or no reply; polluted params ignored | PASS |
| C-10 | 200 parallel `eth_blockNumber` | 122 served, 78 rate-limited (-32005) | PASS |
| E-07 / E-11 | Page fetches `chrome-extension://…/{popup,manifest,inpage.js,wasm}`; iframes the popup | All fetches blocked; frame not readable | PASS |
| E-02 | Popup: inject inline `<script>`, inline `onerror` handler, remote `<script src>` | All blocked by CSP (eval through DevTools is a CDP artefact, not a CSP gap) | PASS |
| B-01 / B-02 | Inspect `chrome.storage.local` after creating a wallet | Vault `v:2`, 12-byte IV, 32-byte salt; KDF record `argon2id m=47104 t=2 p=1`; keystore `aes-128-ctr` + `scrypt n=16384 r=8 p=4` | PASS |
| B-04 | Search local and session storage and `localStorage` for the password and phrase-shaped strings | Neither found; `localStorage` empty | PASS |
| B-05 | Session storage after unlock | Only `wallet:password`, `wallet:unlock` (derived keys) plus provider queue | PASS |
| B-07 | 7 wrong unlock attempts | ~1.9 s each (Argon2id); 7th → `TOO_MANY_ATTEMPTS`; correct password also refused during lockout | PASS |
| B-06 | Manual lock | Session keys removed; `backupBegin` → `LOCKED`; dApp `eth_accounts` → `[]`; sign request waits for unlock | PASS |
| B-06 | Auto-lock set to 1 min, wait 75 s | Locked, session keys dropped | PASS |
| B-06 | Set auto-lock to 0 | Accepted (never locks) | PARTIAL (confirms HW-2026-011) |
| B-09 | `backupBegin`, `revealPrivateKey`, `copyPrivateKey` without re-auth | All `AUTH_REQUIRED` | PASS |
| B-09 / B-05 | `revealAuth` then `backupBegin`; reuse the grant | Response is PNG images plus opaque chip IDs only (no words in the JSON); second use → `AUTH_REQUIRED` | PASS |
| D-01 | Complete onboarding | Wallet ready with no backup step ("Back up … from Settings any time") | FAIL (confirms HW-2026-004) |
| B-03 | Password form | Strength meter shown; Continue disabled until valid and matching | PASS |
| F-02 / F-03 | Connect prompt | Shows browser origin `https://example.com`; account selection; Connect/Reject | PASS |
| C-03 / F-07 | Connected site calls `wallet_switchEthereumChain` (Sepolia) | Switched with **no prompt**; `chainChanged` emitted | PARTIAL (confirms HW-2026-005) |
| C-03 | Connected site sends typed data with domain chainId Base Sepolia while on Sepolia | Wallet **silently switched** to Base Sepolia before the approval window | PARTIAL (confirms HW-2026-005) |
| C-03 | Typed data with chainId 1 (not served) | 4902 "network not available" | PASS |
| C-02 / C-06 | Unlimited `approve()` on Sepolia USDC | Shows network, token, spender, "Unlimited"; spending limit defaults to 0; alert "unlimited access"; two acknowledgement boxes (unchecked at render, verified over 4 s); Confirm disabled (no funds) | PASS |
| C-05 / C-06 | EIP-2612 Permit, unlimited, Base Sepolia | Domain decoded; "Unlimited token access … Unlimited: Yes"; one acknowledgement box | PASS (note: unlimited permits only need the single acknowledgement, not the high-risk one) |
| F-07 | `wallet_addEthereumChain` with `http://192.168.1.1` and `169.254.169.254` RPCs | Refused (-32602) | PASS |
| **F-05** | Site risk check on every approval | **"Site safety check is unavailable"** on every request. Root cause reproduced: the ScamSniffer list has 359,277 entries, and `blacklist.push(...list)` throws `RangeError: Maximum call stack size exceeded`, so `siteRisk()` always fails | **FAIL (new HW-2026-018, High)** |
| G-03 | API call with no auth / random signature / other key claiming the device / replayed nonce / swapped path / clock −1 h | 401 / 401 / 401 / 401 / 401 / 401 `clock_skew`; valid request 200 | PASS |
| G-03 | Device key in IndexedDB | `CryptoKey.extractable = false` | PASS |
| G-04 | Signed portfolio request for an untracked address | 403 `not_tracked` | PASS |
| G-02 | 1.5 MB signed body | 413 `too_large` | PASS |
| G-07 | Response headers on `/healthz`, `/v1/push/vapid` | No `X-Content-Type-Options`, HSTS or `Cache-Control: no-store` | PARTIAL (confirms HW-2026-012) |
| E-05 | Popup console | Only one "form field without id/name" issue; no errors or CSP violations | PASS |

## Backend test-suite note

`./run.sh test` → `TestDeviceFlow` fails at `backend/internal/api/api_test.go:82-83`. Registration now returns the `probation` tier (`internal/api/auth.go:163-179`), but the test expects `default`. This is a stale test, not a defect. However, because it stops at line 83, the security assertions after it never run in CI: forged key, stale clock, the address quota of 2, and the rest of the flow. The forged-key, stale-clock and IDOR cases were verified manually above; the quota case was not. Fix the expectation (accept `probation`, or set `ProbationTier: ""` in the test config) so CI covers them again.

## New finding

### HW-2026-018: Phishing detection never works at runtime
- Control ID(s): F-05, F-09
- Severity: **High**
- Component: extension (service worker)
- Description: `siteRisk()` appends the ScamSniffer domain list with `cfg.blacklist.push(...(await optionalList(f, SCAMSNIFFER_DOMAINS)))`. The list now has 359,277 entries, and spreading that many arguments throws `RangeError: Maximum call stack size exceeded`. The `catch` returns `{ level: 'unavailable' }` because `mem` was never set, so the MetaMask list is discarded too. Every approval shows "Site safety check is unavailable". Even if it worked, the merged cache (about 13 MB) would exceed the 10 MB `storage.session` quota.
- Impact: Known phishing and drainer domains are never flagged, and users get used to seeing the "unavailable" note on every request.
- Evidence: `src/core/provider/phishing.ts:65`; runtime reproduction in the popup context (`a.push(...scamSnifferList)` → RangeError); approval windows on example.com all showed the unavailable note.
- Recommendation: Merge with a loop or `concat` (for example `for (const d of list) set.add(d)`), store the lists separately or in IndexedDB rather than `storage.session`, add a unit test with a large list, and fail closed (or show a prominent warning) when the check is unavailable. Combine with the HW-2026-006 block-screen fix.
- Status: Open

## Cleanup

The throwaway test wallet and the connection to `example.com` remain in the MCP Chrome profile. Remove the extension there, or delete the profile, after review.


## End-to-end pass 2 (proxy + Docker + funded testnet tx), 2026-10-30

| Item | Value |
| --- | --- |
| Tooling | chrome-devtools-mcp with traffic routed through mitmproxy (`audit/flows.mitm`, 45 flows), Docker MCP (container logs) |
| Not available | Postgres MCP (password authentication failed for user `harbour`) and Redis MCP (connected, but exposed no tools). DB and Redis contents were not inspected |
| Transaction | Real Sepolia self-send of 0.000001 ETH from the test wallet via a dApp request on example.com: tx `0xb53ea1f2…dc34`, block `0xb7820c`, status `0x1` |

| ID | Runtime test | Observed | Result |
| --- | --- | --- | --- |
| C-01 / C-02 | dApp `eth_sendTransaction` → approval → Confirm | Approval showed network, value, from/to, fee; tx signed, broadcast and mined | PASS |
| G-03 | Signed API calls in captured traffic | `/v1/tx/sepolia/broadcast`, the nonce read, `/v1/realtime/token` and `/v1/me/push` all carry the `X-HB-*` device signature | PASS |
| G-12 / I-02 | Broadcast path | Nonce (`eth_getTransactionCount pending`) and broadcast both went through the signed backend with the same `X-HB-Session` (`sepolia-29`); the backend returned the hash and tx-tracker logged `tx settled … confirmed` | PASS |
| A-04 / B-04 | Scanned every request URL, header and body in `flows.mitm` for the vault password, phrase-shaped text and private-key-length hex | No password or phrase. The only 64-hex values are tx and block hashes in RPC calls | PASS |
| L-01 | API container logs during the test | Route + status + latency only; no addresses, IPs, bodies or signatures | PASS |
| L-02 | 401s in API logs | Logged only as `status:401` access lines, with no reason or device | PARTIAL (confirms HW-2026-013) |
| **I-02 / I-04 / G-09** | Where dApp-path reads go | **Every read made for the dApp approval flow went to `/v1/rpc/sepolia` UNSIGNED, was refused with 401, and was then sent to public RPCs** (`ethereum-sepolia-rpc.publicnode.com`, `sepolia.base.org`): `eth_getBalance`, `eth_getCode`, `eth_estimateGas`, `eth_simulateV1`, `eth_getBlockByNumber`, `eth_gasPrice`, `eth_maxPriorityFeePerGas`, `eth_getTransactionReceipt`. 12 of 15 `/v1/rpc` calls were unsigned | **FAIL (new HW-2026-019, Medium)** |
| F-09 | Address-risk lookup | `api.gopluslabs.io/api/v1/address_security/<recipient>` called for the tx target (here the user's own address) | PASS (expected third-party disclosure, document in the privacy policy) |
| G-05 | Rate limits seen in logs | `/v1/gw/*` returned 429 repeatedly for the probation-tier device | PASS (works; may hurt UX for new installs) |
| — | Address sync | 17 × `PUT /v1/me/addresses` → 400 in a burst (11:01:53) | Info: functional bug, the extension retries addresses the backend rejects |

### New finding

### HW-2026-019: dApp-path RPC reads bypass device signing and leak to public RPCs
- Control ID(s): I-02, I-04, G-09
- Severity: **Medium**
- Component: extension (service worker provider)
- Description: `src/background/provider/index.ts:57` runs `export const rpc = makeRpc();` when the module is evaluated, and `makeRpc(f = fetch)` (`src/background/provider/rpc.ts:61`) captures `fetch` at that moment. ES-module imports are evaluated before the body of `src/background/index.ts`, so `installHarbourFetch()` (line 7) has not yet wrapped `fetch`. The provider's RPC client therefore sends raw, unsigned requests to `/v1/rpc/<chain>`, always gets 401, and falls back to the public endpoints in `rpcEndpoints.json`.
- Impact:
  - **Privacy:** every dApp interaction discloses the user's address, balance queries, simulated calldata and pending tx hashes to public RPC operators, which defeats the backend proxy's purpose.
  - **Integrity:** the approval screen's balance, simulation and fee presets, and the fee that gets signed, come from an unauthenticated third-party node rather than Harbour's upstream pool.
  - **Cost:** two requests per read, and the API logs fill with 401s.
- Evidence: `audit/flows.mitm` (12 unsigned `POST /v1/rpc/sepolia|base-sepolia` → 401, each followed by the same method to publicnode/base.org); API container logs 11:28:19–11:29:15; source lines above.
- Recommendation: Resolve fetch lazily (`makeRpc((...a) => fetch(...a))`, or create `rpc` inside `initProviderBackground()`), or import and run `installHarbourFetch` from a side-effect module that is the first import of the service worker. Add a test asserting that provider reads to Harbour networks carry `X-HB-Signature`. Treat a 401 from the proxy as an error, not a reason to fall back silently.
- Status: Open


## Database and Redis inspection (Postgres + Redis MCP, read-only), 2026-10-30

| ID | Check | Observed | Result |
| --- | --- | --- | --- |
| H-01 | Schema review of all public tables | No column for seeds, private keys or passwords. `devices` holds only `public_key`; webhook signing keys are stored as `enc_signing_key` (0 rows without encryption) | PASS |
| H-07 / G-09 | `device_addresses` | 166 links stored as `link_hash` + `enc_tracked_ref` (36-byte AES-GCM blobs); 0 rows with a non-truncated `added_at` | PASS |
| H-04 | Roles | Services log in as `harbour_api`, `harbour_indexer`, `harbour_webhook`, `harbour_prices`, `harbour_txtrack`, `harbour_notifier` (each NOSUPERUSER, member of `harbour_app`); `harbour_app` has only SELECT/INSERT/UPDATE/DELETE. Owner `harbour` is a superuser (used by migrate and now by this read-only MCP) | PASS |
| H-05 | `pg_settings.ssl` | `off` | FAIL (confirms HW-2026-007) |
| H-08 | `log_connections`, `log_statement`, `shared_preload_libraries` | off / none / empty (no pgaudit) | NOT FOUND (confirmed at runtime) |
| H-10 | `password_encryption`, `listen_addresses` | `scram-sha-256` (good); `*` (all interfaces inside the container; host binding is 127.0.0.1) | PARTIAL |
| G-03 | `devices` | 21 devices, 0 revoked, 0 with attestation | Info |
| **G-09 / H-07** | **`pending_transactions`** | Rows hold `device_id` **and** the plaintext `from` address; the test tx still had its `device_id` after confirmation (the older rows had it cleared) | **PARTIAL, see HW-2026-020** |
| **G-09** | **Redis keyspace** | `hb:push:<device-uuid>:tx:<chain>:<tx-hash>` keys (6 seen) and broadcast idempotency records `hb:idem:<device-uuid>:bc-…` whose stored body includes `tx_hash` and a live `channel_token` JWT. tx hash → sender address, so device↔address links can be recovered from Redis in plaintext | **FAIL (new HW-2026-020, Medium)** |
| G-03 | Replay keys | No `hb:nonce:*` keys left (expired after 2× clock skew, as designed) | PASS |
| G-12 | Address-update idempotency records | Created with `keepBody=false` (stored body `{"replayed":true}`), as the code intends | PASS |
| — | Idempotency volume | About 400 `hb:idem:*` keys, over 200 from one device: each failing address sync (400) uses a fresh Idempotency-Key | Info (same address-sync bug) |

### New finding

### HW-2026-020: Device↔transaction (and so device↔address) links kept in plaintext in Redis and `pending_transactions`
- Control ID(s): G-09, H-07
- Severity: **Medium**
- Component: backend (API, Redis, DB)
- Description: Postgres encrypts device→address links (LinkCrypto), but other stores keep the same relationship in the clear:
  - Redis key names `hb:push:<device-id>:tx:<chain>:<hash>`.
  - Broadcast idempotency records `hb:idem:<device-id>:bc-…`, whose stored response contains `tx_hash` and a realtime `channel_token`.
  - `pending_transactions.device_id` next to the plaintext `from` column, retained after confirmation.

  Because the tx hash gives the sender address on chain, anyone with read access to Redis or a DB dump can map devices to addresses without the link key. The cached `channel_token` is also a bearer token that stays valid until it expires.
- Evidence: Redis `SCAN *` (keys above); `GET hb:idem:40e9155c-…:bc-063d4939…` (body decoded to `tx_hash` + `channel_token`); `SELECT … FROM pending_transactions` (device_id present on the tx confirmed at 11:29:22). Code: `backend/internal/api/server.go:174` (`s.idempotency`, which keeps the body, on broadcast).
- Recommendation: Use `idempotencyNoBody` for broadcast, or strip `channel_token`. Use an HMAC of the device ID (LinkCrypto `RouteTag`-style) in Redis key names. Null `pending_transactions.device_id` when a tx settles, or store it encrypted. Set short TTLs on `hb:push:*`.
- Status: Open
