# Harbour Wallet — Build Log & Decisions

> Append-only record of every decision and task. Newest entries at the bottom.
> RE basis: `../trust-wallet-RE.md` + `../evidence/`. Goal: a Trust Wallet-compatible
> wallet under the "Harbour Wallet" brand, using the same open-source libraries
> Trust Wallet uses so we never write unaudited crypto.

## Guiding principles
1. **No custom crypto.** All key generation, derivation, keystore, and signing go
   through `@trustwallet/wallet-core@4.8.2` (byte-identical to TW's build) or other
   audited libraries. We only write orchestration/UI.
2. **RE-aligned.** Every behavioral choice (KDF iterations, cipher, storage schema,
   flows, endpoints) matches the RE docs; deviations are logged with a reason.
3. **Optimal, not copied.** We write clean modern code, not transcribed minified
   source. Equivalence is proven by tests, not by code identity.
4. **Own branding.** Name "Harbour Wallet"; not Trust Wallet's name/logo.

## Stack decisions
| Concern | Choice | Why (RE / audit) |
|---|---|---|
| Crypto / HD / keystore / signing | `@trustwallet/wallet-core@4.8.2` | TW's own lib, byte-identical; audited; RE §4.5/§4.7 |
| Build tool | Vite + `@crxjs/vite-plugin` | TW uses Vite (recovered `__vite__mapDeps`); crxjs handles MV3 |
| UI | React + TypeScript | TW uses React (RE §3) |
| State | Redux Toolkit + redux-persist | TW uses Redux; storage key `wallet:store` mirrors TW `trust:store` (§6.2) |
| Extension APIs | `webextension-polyfill` | MV3, matches TW |
| Outer vault encryption | WebCrypto (PBKDF2-SHA256 + AES-GCM) | browser-native, audited; RE §4.3 (passworder-equivalent) |
| EVM RPC / encoding | `viem` | audited, modern; for tx build/encode (signing stays in wallet-core) |
| dApp provider std | EIP-1193 / EIP-6963 | RE §5.12 |
| Chains at launch | ETH, BTC, BNB, Polygon, Solana, Arbitrum, Base + Sepolia | user decision |

## Task log
### T0 — 2026-10-15 — PoC core validated
- Built & tested the secure core in `../wallet-clone` (proof of concept): PBKDF2
  20k/210k, passworder AES-GCM, vault create/lock/unlock + throttle, keystore
  aes-128-ctr scrypt 16384/8/4/32. 5/5 tests pass; addresses match TW. Carrying
  these modules into Harbour Wallet.

### T1 — 2026-10-15 — Harbour Wallet scaffold + secure core + onboarding UI
- Scaffolded MV3 project: Vite + @crxjs + React 18 + TS + Redux Toolkit + viem + webextension-polyfill + wallet-core 4.8.2.
- Ported secure core to TS: `core/walletCore` (wallet-core singleton), `passwordService` (PBKDF2 20k/210k), `passworder` (AES-GCM/PBKDF2-SHA256 10k), `vaultService` (create/unlock/lock/throttle + storage schema), `walletService` (HD + aes-128-ctr keystore), `chains` (7 + Sepolia).
- Background SW: message router (status/generateMnemonic/createWallet/unlock/lock) + onInstalled→onboarding (RE §3.0).
- Popup: React onboarding — welcome(terms gate)→create password(min 8)→backup→unlock→home.
- **Decision:** replaced `Buffer` with TextEncoder/TextDecoder (Buffer absent in SW) — correctness fix.
- **Decision:** wallet-core 4.8.2 Emscripten build REJECTS `locateFile` ("not in INCOMING_MODULE_JS_API"); removed the override and let Emscripten self-resolve the wasm (shipped at dist root via public/). Works.
- **UI decision:** LIGHT theme, Trust Wallet-style layout, dummy "Harbour" branding (gradient H logo, blue accent) — no TW assets/copyright.
- Build: `tsc --noEmit` clean, `vite build` clean, wasm emitted to dist. Ran the built extension headless: welcome→create→backup verified end-to-end; wallet-core generates a real mnemonic + real ETH/BTC/BNB/Polygon addresses in-extension. Screenshots: shot-welcome/password/backup.png.
- **Open:** home screen is placeholder (balances/send next); import-existing path routes to password but import UI not built; dApp provider/content bridge minimal stub.

### T2 — 2026-10-15 — Full setup: icons + prebuilt dist
- Generated extension icons (16/32/48/128, blue H) and wired them into the manifest (action + icons).
- Rebuilt; `dist/` is a complete loadable MV3 extension (13 MB incl. wallet-core.wasm). Verified end-to-end again (welcome→create→backup, 0 console errors).
- Shipped prebuilt `dist/` so the wallet can be loaded via chrome://extensions → Load unpacked with no build step. Added INSTALL.md.

### T3 — 2026-10-15 — Agent roles defined
- Created `.claude/agents/`: supervisor, frontend, backend, db, re, testing, review,
  compare (TW-vs-Harbour flow diff). Task-scoped specialized agents; main session
  supervises and gates against RE docs + tests + compare reports.
- Note to user: agents are ephemeral (run a task, return), not an always-on org;
  "exactly like TW" = behavioral equivalence on the achievable surface, not byte-identical.

### T4 — 2026-10-15 — Scope correction, local audit and safety/build repairs

- Latest user instruction requires the full target UI/screens/UX and a working
  wallet. The earlier generic light layout and seven-chain launch scope do not
  satisfy it. Governing plan: `../IMPLEMENTATION-PLAN.md`; comparison ledger:
  `../UI-PARITY.md`; verified findings: `../audit/CURRENT-STATUS.md`.
- Found unrestricted page→content→internal-wallet relay. Removed the relay and
  restricted the background router to this extension's exact UI document;
  content-script sender IDs alone cannot authorize internal wallet commands.
  Added negative sender regression tests. Provider implementation remains pending.
- Reject invalid create inputs in background before any vault mutation. This is
  a minimum safety repair; full target password validation is still pending.
- Corrected Node 22 test invocation and made builds copy the hash-verified
  wallet-core WASM automatically. A clean build previously omitted it.
- Dependencies installed with lockfile. `npm test`: 3 passing. `npm run build`:
  passing with WASM. Existing dependency audit: 7 high / 2 moderate advisories,
  recorded in `../audit/harbour-dependency-audit.json`; no forced upgrades.
- Captured Harbour public welcome/password screens and reference
  welcome/authentication/password screens in isolated Chromium. Large layout
  and flow differences are recorded, not claimed fixed. No wallet was created.
- Installed local RE tooling and verified REA recovery via Linux x64 Docker;
  details in `../tools/README.md`. Preserved original supplied ZIP.
- Full wallet implementation and UI equivalence remain **unfinished**. Next
  chronological feature is #02 onboarding; finish its complete spec/fixtures
  before implementation. Root workspace has no Git repository; no commit made.
