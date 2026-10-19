# Repository status — 2026-10-15

## Outcome

The workspace contains useful Trust Wallet 26.41.0 research and an early Harbour
extension scaffold. It does **not** contain a complete or visually equivalent
Trust Wallet implementation. No full-wallet completion percentage is justified.
The user's latest instruction authorizes a complete implementation with matching
screens and UX, allowing replacement branding/assets where necessary.

## What was checked

- [certain] Local host: macOS arm64; Node 22.22.3; npm 10.9.8. Historical
  `/root/re-work` and `/root/re-tools` locations refer to another environment.
- [certain] `26.41.0_0.zip`: 58,673,602 bytes, SHA-256
  `028160c250aa65591d54fd3ec123181db612cc6cdb6963431a870d35b3bcdf31`.
  This differs from the historical ZIP digest in the notes. The original is
  unchanged; only its `26.41.0_0/` contents were extracted into
  `artifacts/reference-26.41.0/` (429 files). Mac metadata was excluded.
  Extraction checks prevented path traversal. Inventory: `reference-inventory.json`.
- [certain] Manifest version is 26.41.0, MV3. This is a user-supplied unpacked
  distribution, not a newly acquired signed CRX. Official distribution identity
  and CRX signature have **not** been independently authenticated.
- [certain] Shipped `wallet-core.wasm` is byte-identical to the installed npm
  `@trustwallet/wallet-core@4.8.2`: SHA-256
  `1b78048fa04fd8905b4eea99eb281bffb167e46a5559d28392a5e8116a885171`.
  WABT 1.0.42 validates the module; `wallet-core-sections.txt` preserves section output.
- [certain] All 46 recovered JS/map artifacts listed by historical manifests
  match their recorded hashes (`evidence-integrity.json`). This verifies file
  integrity, not semantic equivalence or whole-feature coverage.
- [certain] Historical slices include synthetic scaffolding and joined ranges;
  a whole-slice substring search is not an adequate provenance test. See
  `slice-source-check.json` and `install-source-correspondence.json`.
  The install finding was independently re-extracted without stubs, with original
  byte offsets, then recovered through REA in Linux x64. Bundle:
  `../evidence/01-install/2026-10-15-local/`.

## Research coverage and contradictions

The existing 18-row table actually contains **14 Established, 3 Partial, 1 Blocked**;
its prose says 13/4/1. Neither is a full implementation-readiness measure.

1. The tracker labels some rows Established while retaining implementation gaps:
   auto-lock scheduler (#09), background approvals (#12/#13), and default network
   configuration (#15). Static discovery alone does not close these flows.
2. Send (#11), swaps/staking/NFT grouping (#17), Ledger (#18), and WalletConnect
   (#16) are incomplete. Reusing an SDK is an implementation option, not proof of
   Trust Wallet's options, call sequence, permissions or UX.
3. Processing #12–#18 after partial #11 broke the chronological gate. Preserve
   this work as provisional evidence; do not discard it or call it completion.
4. The “only #02–#05 genuine” note and next-target list contradict later rows.
   Several older open questions are superseded by runtime/HAR appendices.
5. There is no exhaustive reachable screen/state inventory, theme/viewport matrix,
   or visual comparison suite. One onboarding screenshot cannot establish UI parity.
6. Third-party service captures describe client boundaries; they do not grant
   credentials/access or reproduce the service. Session tokens in the HAR must
   not be reused or copied into implementation/configuration.

## Build audit

| Area | Verified current state | Missing for parity |
|---|---|---|
| `wallet-clone/` | Small JS core proof of concept; package pins wallet-core 4.8.2 | No complete extension UI or transaction/provider flows; its tests were not rerun in this audit |
| `harbour-wallet/` | React/TS/MV3 scaffold; wallet generation, vault orchestration, basic screens | Most wallet features and exact UI/UX |
| Welcome / onboarding | Fixed 375px panel, generic light theme | Reference uses full-page two-column layouts; authentication selection, import branches, backup/completion states differ or are missing |
| Import | “I already have a wallet” routes straight to password | No mnemonic/private-key import UI; can reach create with an empty mnemonic (now rejected in background) |
| Home | Hardcoded `$0.00`, four fixed token rows | Live balances/prices/history, real token/account state, errors and loading |
| Actions | Send/Receive/Buy/Swap are noninteractive `div`s | Full working flows, signing/approval/broadcast/error handling |
| Chains | Seven mainnet entries plus a separate Sepolia definition | Full target-derived supported/configured set and account behavior |
| Vault | Implements orchestration around wallet-core and WebCrypto | Differential fixtures, schema parity, transactional create, session/autolock and failure recovery |
| dApps | No injected provider; previously forwarded arbitrary website messages | Dedicated origin-bound provider API, permissions and approvals |
| Tests | Original Harbour test checks wallet-core directly | Service, UI and reference differential coverage; library self-consistency is not whole-wallet parity |

## Corrections made in this audit

- Blocked internal wallet commands unless the sender is this extension's exact UI
  document. Extension ID alone would also admit content scripts. Removed the
  unrestricted website-to-internal-command relay. Added regression tests for the
  sender boundary. This is a build security correction, not a target RE claim.
- Added background validation of password length and mnemonic before create.
  Full target password policy remains a separate parity task.
- Fixed the Node 22 test command (`node --test test/*.test.js`).
- Made every build copy the npm WASM after verifying its reference hash. Previously
  a clean source build compiled successfully while omitting this required file.
- Installed dependencies with a lockfile. Recorded the existing dependency audit:
  7 high and 2 moderate advisories; no forced version migration was applied.

## Verification

- `harbour-wallet`: `npm test` — 3 tests pass (2 sender-boundary tests, 1 existing
  dependency test). `npm run build` — succeeds, verified WASM included.
- Isolated Chromium 141.0.7390.37 captures: `screens/reference/` and
  `screens/harbour/`. Both use fresh disposable profiles at 1365×900. No wallet
  was created and no password/seed/private key was recorded.
- Reference install opens exactly one onboarding tab without manual navigation:
  `screens/reference/00-install.json`. Update/reinstall negative cases were not
  exercised; their branch condition is code-confirmed only.
- Captured reference welcome → authentication option → create-password. The
  first attempt expected “Create password” on the option screen and timed out;
  inspected the captured state, selected the actual “Password” button, and
  reran successfully. No product behavior was inferred from that timeout.
- REA JavaScript recovery: Mac adapter returns `capability_unavailable`; the
  same pinned operation succeeds in Linux x64 with network disabled. WABT works
  directly and through REA on the smaller `sql-wasm.wasm`. The first sandboxed
  REA/WABT probe failed compiling its macOS ownership helper; authorized rerun
  succeeded. The >8 MiB Wallet Core limitation remains.
- Workspace root has no Git repository. No commit was created or claimed.

## Ordered continuation

Use `../IMPLEMENTATION-PLAN.md` and `../UI-PARITY.md`. Resume at #02 after the
new #01 evidence; audit each earlier “Established” gate before advancing. Do not
resume at balances or swaps simply because the scaffold already shows them.
Complete implementation remains outstanding; this audit does not certify the
wallet for use with funds.

## 2026-10-16 — Complete v2 coverage and enhanced Harbour presentation

The current user instruction governs: develop only `harbour-wallet-v2/`; preserve
`harbour-wallet/` and `wallet-clone/` as historical. Cover every evidenced target
screen, subscreen, significant state and internal flow of supplied v26.41.0,
with a cohesive Harbour design. Pixel equality is superseded by intentional
presentation improvements; architecture, navigation and wallet semantics remain
evidence-led. Original ZIP remains unchanged; official CRX signature is UNKNOWN.

Order: REA-first whole-target structural inventory → comparison with active v2 →
explicit gaps → official extension design research and licensed asset ledger →
shared system rendered at real dimensions → chronological implementation,
interaction/lifecycle verification and repair. Whole-target structural discovery
is authorized before gate #02; it does not close later feature research gates.
`UI-PARITY.md` is the sole screen/state/navigation coverage authority. Track
implementation, integration, visual inspection and interaction separately. Sample
data and development previews never count as live integration. Resume detailed
research at #02; preserve later evidence as provisional. Continue independent
work when a dependency blocks a gate. Append durable evidence and build records.
