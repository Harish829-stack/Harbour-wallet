<!-- Exported from Claude Docs on 2026-11-02. Source: https://claude.ai/artifact/AcqiuC43HS3hDHmDZ1jMFt -->
> **Local copy.** Exported from the shared doc https://claude.ai/artifact/AcqiuC43HS3hDHmDZ1jMFt on 2026-11-02 (written 2026-10-23). Status: historical (reviews harbour-wallet-v2). Embedded diagrams in the original appear here as text placeholders. Treat code as the source of truth; see `audit/HANDOFF.md`.

# Harbour Wallet: Production Readiness and Architecture

&#32;&#32;&#32;&#32;&#32;&#32;&#32;&#32;Oct 23, 2026 · @Harish

## Verdict

Harbour is a credible Trust Wallet-class **beta**, not yet a production wallet: its core design is close to Trust Wallet 26.41.0, but proof, operations and some ownership boundaries are not. Basis: a read of `harbour-wallet-v2` (about 340 source files, 26k lines of TypeScript), the gateway, CI, and your own RE and security docs. It is not a pentest.

- **Where it matches or beats Trust Wallet:** same wallet-core 4.8.2 signing, same vault layering (PBKDF2 + AES-GCM outer layer, keystore inside, throttled unlock), strict MV3 CSP, no `externally_connectable`, origin taken from the browser port. It is ahead on signed remote config, calldata decoding, simulation, address-poisoning warnings, OS-lock auto-lock and reproducible signed releases.
- **Where it is behind:** no real backend (one stateless Cloudflare Worker with KV), public-RPC data quality, thin per-chain transaction decoding (Cosmos, Sui, Aptos, TON), no crash or health telemetry, no external audit, and Chrome end-to-end QA that your own parity doc lists as the largest gap.
- **Biggest structural risks:** (1) the unlock keys are weak-by-copy: the keystore passphrase is derived at only 20k PBKDF2 iterations, and they sit in `storage.session`; (2) 965 `any` casts and several 500-line service files make a signing-path regression easy;

My estimate: roughly 70 to 75 percent of Trust Wallet's client surface and about 85 percent of its client-side security, but under 20 percent of its backend and operations. Treat those percentages as judgment, not measurement.

## Parity scorecard

Harbour is at or near parity on custody and provider design, and clearly behind on backend, data quality and operations. Trust Wallet facts come from your RE docs (26.41.0); Harbour facts from the code read today.

| Area | Trust Wallet 26.41.0 | Harbour (this codebase) | Gap |
| --- | --- | --- | --- |
| Signing core | wallet-core 4.8.2 wasm | Same wasm, pinned by hash | None |
| Vault | PBKDF2 10k + AES-GCM outer, aes-128-ctr keystore, throttled unlock, derived keys in `storage.session` | Same layering; unlock throttle serialized; session pinned to trusted contexts | Low. Keystore passphrase at 20k iterations is copied from TW and weak |
| Runtime | MV3 worker, Redux, about 204 events, internal/public split | Router with \~19 handler files, Redux store, one UI port, internal-sender check | Low |
| dApp provider | EIP-1193/6963, many families, HMAC handshake | EIP-1193/6963, Solana, Wallet Standard, WalletConnect; per-frame origin from browser port | Low; needs Chrome E2E proof |
| Tx safety | No simulation, no scam feed (per RE) | `eth_simulateV1`, phishing and address lists, calldata decode, Permit2, Solana simulation | Harbour ahead on EVM and Solana |
| Non-EVM decoding | Gateway-built transactions | Cosmos, Sui, Aptos, TON shown as types/bytes (SIG-08 open) | Medium |
| Chains | 168-entry registry | 86 shipped | Medium |
| Swap/Earn/Ramps | Private aggregation gateway | LI.FI, Jupiter, Relay, THORChain; public provider substitutes | Medium |
| Hardware | Ledger via WebUSB | Ledger BTC/ETH/SOL; no device-verified address flag | Medium |
| Backend | Private gateways, node fleet, device registry, indexer | One Worker, KV only, no accounts, no indexer | **Large** |
| Observability | Sentry, Amplitude, feature flags | None (2 console calls only) | **Large** |
| Release | Chrome Web Store, staged rollout | Signed deterministic zip, reproducible build, CI runs `verify` | Medium: no staged rollout, no store history |
| Assurance | Unknown (assume audited) | None external; 46 test files, \~436 test cases, 965 `any` casts | **Large** |

## Target architecture

&#91;embedded content: target architecture · 4 layers\]

The trust boundary is the service worker: the popup and content script never hold keys, and the gateway never sees keys or recovery phrases. Dashed parts do not exist yet; everything else is in the code today.

## Gaps to close before launch

Five blockers stand between today's build and a public release: key hygiene, a stronger vault KDF, independent audit, real end-to-end proof, and operations. Ranked by risk to user funds first.

| # | Gap | Evidence | Fix | Effort |
| --- | --- | --- | --- | --- |
| 1 | Keystore passphrase derived at 20k PBKDF2 iterations; outer layer at 10k | `vaultService.ts`, `passworder.ts` copy Trust Wallet constants | Versioned vault: scrypt or Argon2id (wasm) or PBKDF2 600k+, migrate on next unlock, keep old-format read path | 1 week |
| 2 | Unlock key held in `storage.session` as a string for the whole session | `vaultService.ts` `session.set(KEYS.UNLOCK, ...)` | Keep, but shorten auto-lock default, wipe on idle and OS lock (done), and never log or mirror it; consider per-signing re-derivation for high-value sends | 3-5 days |
| 4 | No external audit; 965 `any` casts on signing paths | Grep of `src`; SECURITY.md section 6 | Type the message boundary (zod or valibot schemas per event), then commission one audit of vault, provider, signing | 4-8 weeks incl. audit |
| 5 | Chrome end-to-end proof missing | Parity doc: injection QA is the largest gap | Playwright suite on a built `dist/` against local Anvil/Solana test validator: onboarding, send, swap, dApp connect, WalletConnect, lock | 1-2 weeks |
| 6 | Gateway is stateless, free-plan limits (50 subrequests, KV only), per-isolate rate limit | `worker.ts` in-memory `hits` Map; `wrangler.toml` | Durable Object or Cloudflare Rate Limiting, paid plan, `ALLOWED_ORIGINS`, signed device tokens | 1 week |
| 7 | No crash, health or funnel telemetry | Only 2 `console.*` calls; logger masks but does not ship | Opt-in, scrubbed error reporting; gateway-side metrics only; no addresses | 3-5 days |
| 8 | Non-EVM transaction decoding (SIG-08), per-request WalletConnect chain (SIG-11) | Findings register, deferred | Decoders for Cosmos Msg, Sui/Aptos/TON build-and-simulate; per-session chain | 2-3 weeks |
| 9 | Dependency and supply chain: 9 low audit items, `npm ci` without `--ignore-scripts`, 8.7 MB stale zips in repo | SECURITY.md section 2 | `--ignore-scripts`, lockfile review in CI, SBOM, delete stale zips, Dependabot with exact pins | 2-3 days |
| 10 | Large UI files and mixed-style code (`screens.tsx` 587 lines, `swapService.ts` 561, `provider/service.ts` 523) | Line counts | Split by feature, enforce size and `no-explicit-any` in ESLint | ongoing |

## UI and extension design rules

The UI should be a dumb, replaceable view over a worker that owns all state and secrets. Harbour already does this (one `harbour-ui` port, worker-pushed snapshots, a test that forbids the popup from importing vault code); keep it and tighten it.

1. **No secret ever crosses to the popup.** Recovery phrases are drawn on a canvas and gated behind password re-entry (already done); extend the rule to private-key export and any backup QR. The popup holds addresses, balances and display state only.
2. **One source of truth.** Worker store (Redux) is authoritative; the popup mirrors it with `useSyncExternalStore`. Do not let popup stores (`tokensStore`, `networkStore`, `swapStore`, `send/store`) persist their own copy of wallet state; they should cache view state only.
3. **Typed message contract.** Define every UI-to-worker event as a schema-validated type shared by both sides. Today handlers take `any`, so a renamed field fails at runtime on a signing path.
4. **Every value-moving screen follows one pattern:** build a plan, show decoded details, simulate, show risk, bind a fingerprint of the plan, then sign that exact plan. Send already fingerprints; Earn, Perps and Predictions do not (SIG-14, SIG-15).
5. **Failure states are designed, not caught.** Offline, degraded, locked, stale price, provider killed, simulation unavailable: each gets a named banner and a plain sentence (your rule: no raw HTTP codes). Add the missing "risk check unavailable" state (INF-08).
6. **Approval windows are the only dApp gate.** Show origin, chain, decoded intent, balance changes, spender and allowance size, and an explicit warning for blind signing. Never auto-approve; rate-limit per origin (done).
7. **Accessibility and i18n from day one.** Keyboard focus order in the popup, `aria-label`s on icon buttons, contrast tokens from `DESIGN-SYSTEM.md`, and a message catalogue instead of inline English strings (there is a `locale` setting but no string catalogue in the files read).
8. **Performance budget.** Popup first paint under about 300 ms on a mid laptop: lazy-load swap, earn, perps, NFTs; keep wallet-core wasm and heavy SDKs (Polkadot, Ton, Sui, Aptos) out of the popup bundle and load per chain family on demand in the worker.
9. **Permissions stay minimal.** Re-justify `https://*/*` host access on the store page, keep `tabs` removed, and keep `gcm` only while push is on.

## Backend design

Keep the backend thin and non-custodial: it serves data, never holds keys, and the wallet must still work, degraded, if every Harbour server is down. Trust Wallet runs a large private gateway; you do not need to match it, you need the same trust properties.

**Principles**

- Stateless edge first (Cloudflare Workers is a good fit), a small database only where state is unavoidable.
- Every response the wallet acts on is either verifiable (signed config, on-chain data cross-checked) or advisory only.
- No wallet identity on the server. Push registration is the one exception; treat it as optional and minimise it.

**Components**

| Component | Today | Production target |
| --- | --- | --- |
| Keyed proxies (RPC, Etherscan, Alchemy, Helius, Trongrid, Toncenter, Pimlico) | Method and path allowlists, 50-call batch cap | Add per-route budgets, response size caps, upstream failover, and a paid plan |
| Auth and abuse control | Rate limit by IP in a per-isolate Map | Cloudflare Rate Limiting or a Durable Object counter; per-install signed token (public key registered once, requests signed, short-lived) instead of a shared device id; Turnstile on registration |
| Signed remote config | Ed25519, expiry added, killed-providers list | Keep; add versioning, staged rollout percent, a monotonic sequence number against replay, and a second offline-held signing key for rotation |
| Push | KV registration of FCM token plus up to 12 addresses, cron poll every 5 minutes | Move to a DB or Durable Objects, hash addresses, delete on unregister and after 30 days, use provider webhooks instead of polling, and document the privacy cost in the store listing |
| Market data | CoinGecko via KV cache, DefiLlama fallback | Keep; add stale-while-revalidate and a status field so the UI can show "last known" |
| Swap quotes | LI.FI, Jupiter, Relay, THORChain raced in the client | Keep client-side validation (it is the safety layer); gateway only holds keys |
| Indexer (history, balances) | Public explorers and RPC, activity engine in the worker | Optional later: self-hosted indexer for 5 to 10 main chains if explorer quality or rate limits hurt |
| Observability | `/health` only | Structured logs with request ids, metrics per route and upstream, alerts on error rate and KV or upstream quota, an uptime check |

**Rules for every endpoint:** allowlist inputs, bound sizes, never reflect upstream errors, never put API keys in URLs the client sees, log no addresses, and version the path (`/v1/`). Treat all upstream data as untrusted and validate it before display.

## Database and storage design

A self-custody wallet's real database is the browser, not a server. Secrets stay on the device, the server stores almost nothing, and what the server does store must be safe to leak.

**On the device (the main data store)**

| Data | Where | Protection | Notes |
| --- | --- | --- | --- |
| Vault (wallet list, mnemonics, imported keys) | `storage.local`, one encrypted blob | AES-GCM under a password-derived key | Version the blob and KDF parameters so the KDF can be upgraded without data loss |
| Keystore per wallet | `storage.local` | wallet-core `StoredKey` | Same, versioned |
| Unlock and session keys | `storage.session` | Trusted contexts only, cleared on browser close and OS lock | Never persisted, never logged |
| UI and app state | `storage.local` `wallet:store` with migrations | Contains no secrets (enforced in code review and a test) | Keep the two-phase migration runner; add a test per migration |
| Activity and history, address book, custom tokens, caches | Currently `storage.local` | Plain, but non-secret | `storage.local` is about 10 MB without the `unlimitedStorage` permission; move large lists to IndexedDB with pruning, or request `unlimitedStorage` |
| Hyperliquid agent key, Polymarket credentials | Encrypted with the wallet password | Withdrawal-incapable agent key | Keep scoped and revocable |

**On the server (only if you add accounts-free features)**

| Table or namespace | Fields | Retention | Why |
| --- | --- | --- | --- |
| `push_devices` | token hash, hashed addresses, topics, cursors, created, last seen | 30 days idle | Push alerts; use D1 or Postgres instead of KV so you can query and delete |
| `config_releases` | version, sequence, signed payload, issued, expires, signer id | Forever | Audit and rollback of remote config |
| `provider_status` | provider, state, last checked, killed flag | Short | Powers the "risk check unavailable" UI |
| Cache (KV) | price, market, quote responses | TTL seconds to minutes | Cost and rate-limit control; whitelisted keys only |

**Rules:** no seed, key, password hash or plaintext address list on a server; every table has a retention rule and a delete path; back up only what you cannot rebuild (config history); and add an optional encrypted-cloud backup of the vault only if you accept the support risk, with client-side encryption and a separate key.

## Security design principles

Design for the compromise of any one layer: a malicious page, a hostile API response, a bad dependency, or a stolen laptop should each fail to move funds.

1. **Keys live in one place.** Only the service worker touches key material, only for one operation, then it is wiped. Hold this line with the existing boundary test and add a lint rule forbidding vault imports outside `background/` and `core/`.
2. **Treat every outside input as hostile:** page messages, WalletConnect payloads, API quotes, QR codes, token metadata, pasted addresses. Validate with schemas at the edge, fail closed on unknown shapes (your swap checks already do).
3. **Sign only what the user saw.** Bind the approved plan to a hash and sign that plan. Extend this from Send to Earn, Perps and Predictions.
4. **Independent verification beats trusting the quoting API.** Allowlist routers and spenders, decode calldata, simulate balance changes, cross-check THORChain nodes. Trust Wallet does none of this client-side, so this is where Harbour can be better.
5. **Make blind signing hard.** `eth_sign` is off by default (done); keep unlimited approvals and unknown selectors behind explicit warnings.
6. **Slow down offline attacks.** Raise the KDF cost and version it; keep the 5-free-attempts then exponential lockout; lock on idle and OS lock (done).
7. **Defend the supply chain.** Exact pins, `npm ci --ignore-scripts`, lockfile review, reproducible builds (done), signed releases with a pinned public key (done, add the key file), 2-person release approval, and a store account with hardware-key 2FA.
8. **No silent kill switches that fail open.** Remote config can disable a provider, but the UI must say the check is unavailable. Config is signed, expiring and replay-protected.
9. **Plan for incidents.** A published security contact and `security.txt`, a rotation runbook for every secret, a tested way to ship an emergency extension update, and a way to warn users in-app via signed config.
10. **Verify, do not assert.** Fuzz the provider message path, property-test address and amount parsing, run signing test vectors against Trust Wallet and wallet-core, and run `npm audit` and a secret scan in CI (secret scan exists in `verify`).

## Phased roadmap

Four phases, each ending in a gate you can test. Effort assumes a team of 2 to 3 engineers; adjust to yours.

| Phase | Weeks | Work | Gate to leave the phase |
| --- | --- | --- | --- |
| 0. Hygiene | 1 | Rotate and relocate all secrets; delete stale zips; pin release public key; rotate Infura key; redeploy gateway; publish `security.txt` | Clean-clone build passes `npm run verify`; no secrets in repo history (scan with gitleaks) |
| 1. Harden core | 2 to 5 | Versioned vault KDF upgrade and migration; typed message schemas; remove `any` from vault, provider, signing; rate limiter and signed device tokens on the gateway; error telemetry (opt-in) | Migration test from old vault passes; zero `any` in signing paths; gateway load test holds the budget |
| 2. Prove it | 4 to 8 | Playwright E2E on the built extension against local chains; signing vectors vs wallet-core and Trust Wallet; fuzz provider path; non-EVM decoders; per-session WalletConnect chain | E2E green in CI on every PR; no open High findings |
| 3. External review and beta | 8 to 14 | Independent audit of vault, provider and signing; fix findings; staged Web Store rollout (1%, 10%, 50%, 100%); bug bounty; status page and incident runbook | Audit report with no unresolved High or Critical; one month of beta with crash rate below your target |
| 4. Scale | After launch | Optional indexer, D1 or Postgres for push, more chains, Android build, hardware-wallet verification flow | Driven by user data, not this plan |
