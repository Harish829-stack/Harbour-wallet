# Trust Wallet RE — Evidence Bundle

Self-contained evidence for the reverse-engineered features. Hand this folder to
the dev team alongside `trust-wallet-RE.md` (specs) and `rebuild-tracker.md`
(coverage). Everything here was produced by **REA `recover_javascript_sources`**
(Wakaru 1.14.0) from the shipped Trust Wallet extension v26.41.0
(`background.js` / chunk files), except where noted.

## How to read it
- `slices/` — the exact JavaScript carved out of the shipped bundle and fed to
  REA (the input, for provenance). `background.js` is a 42 MB single-line minified
  file that Wakaru cannot process whole, so each feature's code was carved into a
  brace-balanced, `node --check`-valid slice first.
- `NN-<feature>/bundle.js` (+ `.map`) — the **REA-recovered, readable source**
  with real identifiers. This is what you actually read to build.
- `NN-<feature>/REA-manifest.json` — REA's evidence record (digests, provenance).
- For chunk-based features (onboarding/auth) the recovered files keep their
  original chunk names instead of `bundle.js`.

## Feature → evidence map

| # | Feature | Folder | Recovered source | REA evidence ID | Spec |
|---|---|---|---|---|---|
| 01 | Install / first-run entry | `01-install/` | bundle.js | ev_8602c9a3 | §3.0 |
| 02 | Onboarding flow | `02-onboarding-flow/` | onboarding-BHcKddMJ.js + chunks | (rec-onb) | §3.1–3.3 |
| 03 | Auth / password / validation | `03-auth-password/` | authentication + useValidatePassword + chunks | (rec-auth) | §3.4, §4 |
| 04–06 | Key derivation, vault, seed encryption | `04-06-vault-crypto/` | bundle.js | ev_4f0946c2 | §4.1–4.7 |
| 07 | wallet-core usage decisions | `07-walletcore-usage/` | bundle.js | ev_7afedf54 | §4.7 |
| 08 | Account & address derivation | `08-derivation/` | bundle.js | ev_934dc08b | §4.8 |
| 09 | Unlock / lock / session | `09-lock-session/` | bundle.js | ev_d62096af (+ ev_4f0946c2) | §4.9 |
| 10 | Home / assets / balances | `10-home-assets/` | bundle.js | ev_491e9157 | §5.10 |
| 11 | Send / transaction (router) | `11-transaction/` | bundle.js | ev_d433f7dd | §5.11 |
| 12 | dApp provider (EIP-1193) | `12-dapp-provider/` | bundle.js (inpage) | ev_8511560a | §5.12 |
| 13 | Message / typed-data signing | (provider+walletcore) | — | ev_8511560a + ev_7afedf54 | §5.13 |
| 14 | content↔inpage↔background bridge | `14-bridge/` | bundle.js (content) | ev_6b52a033 | §5.14 |
| 15 | Network / RPC | `15-network/` | bundle.js | ev_de93124b | §5.15 |
| 16 | WalletConnect | `16-walletconnect-BLOCKED/` (README 2026-10-19 addendum, `wc-request-mapper-slice.js`) | scripted search, not REA | CORRECTED: only a Kotlin request mapper ships; no pairing/session client found | §5.16 |
| 17 | Swaps | `17-swap/` | bundle.js | ev_1db92cac | §5.17 |
| 18 | Hardware (Ledger) | `18-ledger/` | bundle.js | ev_153b6ed2 | §5.18 |
| 30 | dApp approvals, notification flow, connections | `30-dapp-approvals/2026-10-19/` | `recovery/*.js`, sanitized HAR projection | `ev_551b146661f76ad4aeba38f5a5c3feb79f998e627d6b4c43e2cda4f46f188ce3` (final HAR projection); `ev_f5dfc9207dba8d877cd37897d1caf721984790975b98b345cc5a37c62a6e19e7`, `ev_9c61f5bd048b6d307a83087601c952b683cecb5e398c218829de930a44f67c03`, `ev_bbddd2ee7e5819d3c128cc7ae7744acab6880c5fc0d8c51713324b69b5e2c8f1`, `ev_fdece6977f9690af130733871117fb2af4e6b9c79d0b32c37b00ebe78d961242`, `ev_a30da1e36bbccdac044dbdca00478bda7dcc01f0f8044a6e974951adade633cf` | Phase 2 build evidence |

## Provenance / dependency notes
- Shipped extension: Trust Wallet v26.41.0, `26.41.0_0.zip`
  (sha256 9e1401e8…7054096). Original artifact is the user's zip, not re-shipped here.
- Crypto engine is `@trustwallet/wallet-core@4.8.2`, confirmed **byte-identical**
  to the shipped `wallet-core.wasm` (sha256 1b78048f…a885171). It is an npm
  dependency — install it, do not re-derive. StoredKey params (aes-128-ctr,
  scrypt n=16384/r=8/p=4/dklen=32) were confirmed by executing this exact build;
  that evidence is reproducible via `slices/` + the version, not a recovered file.
- Scrypt/keystore wasm facts were cross-checked with WABT 1.0.42.

## Status
All 18 features reverse-engineered except #16 WalletConnect (Kotlin/JS-compiled,
blocked). Runtime verification fixtures (real input→output capture) and live
server/API contracts remain pending across features — static client implementation only.

## 2026-10-15 — Local provenance and readiness correction

The status paragraph above is historical and overstates completeness. Current
coverage is the final status section of `../trust-wallet-RE.md` and the dated
audit addendum in `../rebuild-tracker.md`. Later-feature evidence is preserved;
unclosed chronological gates and missing screen/behavior fixtures remain.

- The supplied ZIP's verified SHA-256 is
  `028160c250aa65591d54fd3ec123181db612cc6cdb6963431a870d35b3bcdf31`;
  its old recorded ZIP digest does not identify this local archive.
- All 46 recovered JS/map files listed by historical manifests match their
  recorded hashes (`../audit/evidence-integrity.json`).
- All 23 historical input hashes match local artifact files or saved slices.
  Exact verified inputs have been copied into each feature's
  `inputs-verified-local/`. See `../audit/source-input-integrity.json`.
  Slices can contain synthetic scaffolding/concatenation; do not attribute every
  byte in a slice to the target. New #01 evidence records actual original ranges.
- Crypto dependency WASM identity was rechecked against installed 4.8.2 and
  validated by WABT 1.0.42. It remains a dependency, not an internal RE target.

| Feature | New self-contained evidence | Evidence ID | Verification |
|---|---|---|---|
| 01 Install | `01-install/2026-10-15-local/`: exact extracted input, source-ranges.json, REA-result.json, recovery/inputs, recovery/modules, recovery/manifest.json and reports | ev_a13180a7e6eb023cb2aa10adc16d7550a0b9c2d436adc075c054cae62fd17a1b | REA 6.5.0 + Wakaru 1.14.0 in Linux x64; positive fresh-install runtime in `../audit/screens/reference/00-install.json` |

Public onboarding comparison fixtures currently live in `../audit/screens/`.
They contain no entered recovery data or created wallet; full per-feature runtime
bundles remain to be completed and deposited as those gates close.

## 2026-10-16 — Whole-target structural discovery (provisional)

`00-screen-structure/2026-10-16/`: 234 chunk AST pass, exact router slices with
original byte ranges/hashes, six offline REA/Wakaru 1.14.0 recoveries. Main router
evidence `ev_ed3f7468516b784d6ad74966aacfbcb46d2724fd5ae4124e2d7a6b524cb19587`.
REA inventory parent `ev_aa3b5231cb188455bd7bad54484cd5ebc7b69e7acfe59430533f27b7fdb5eef3`.
Coverage authority: `UI-PARITY.md`; 105 route/index records, not 105 proven reachable
screens. Dynamic states/conditions remain open. No later research gate closed.
