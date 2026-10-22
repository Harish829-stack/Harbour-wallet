# Trust Wallet extension parity — governing implementation plan

Updated: 2026-10-15. Target baseline: supplied v26.41.0 artifact. Rebaseline if
the user supplies a different version; never combine releases without comparison.

## Accepted objective

Build a complete working browser wallet whose screens, navigation, validation,
account behavior and transaction/provider flows reproduce the target within
explicitly evidenced scope. Replacement name/logo/assets are permitted by the
user where originals cannot be obtained. A generic wallet redesign, a seven-chain
MVP, inert controls or invented balances do not satisfy this objective.

This latest user instruction supersedes earlier documentation-only scope in
docs/project/AGENTS.md and the research notes. Their evidence, chronology, custody and
confidence rules remain. `docs/project/rebuild-tracker.md` continues to measure research;
it must never be used as a claim that the wallet is implemented.

## Current baseline

See [current status](evidences/audit/CURRENT-STATUS.md) for verified findings and limitations.
`harbour-wallet/` is the implementation candidate; `wallet-clone/` is a historical
core PoC, not a second production target. Keep the originals and both projects
preserved. There is no justified “all screens” or functional-parity completion claim.

## Architecture boundaries

| Component | Responsibility and parity obligation |
|---|---|
| React UI | Separate full-page onboarding, popup, side panel and approval-window surfaces as proven by target. Match routes, controls, states, typography, geometry, keyboard/focus behavior and themes. UI never signs or invents RPC data. |
| MV3 background | Vault/session lifecycle, account registry, approvals, chain services and transaction orchestration. Authenticate internal senders; treat website requests as a separate origin-bound permission domain. |
| Page provider | Implement the proven provider interfaces, discovery and events. Never expose the internal wallet router through page messages. |
| Content bridge | Strict method/schema filtering, request correlation, frame/origin binding and response routing; no direct access to recovery data or privileged commands. |
| Wallet Core 4.8.2 | Use pinned byte-identical dependency with the target's proven calls/arguments; do not reimplement its internals or assume supported library chains equal enabled extension chains. |
| Browser storage | Local encrypted vault/keystores, session-derived keys and persistent public state. Recover exact schemas/migrations and write order before claiming parity. No server receives seed/password/private keys. |
| Chain/data services | Explicit adapters for each proven client contract, amounts represented exactly, public RPC and legitimately provisioned external services. Never reuse captured credentials or session URLs. |
| Optional backend | Only if a proven public-data contract requires an owned proxy/indexer. Its implementation and database are currently UNKNOWN; do not introduce a backend or persist wallet secrets by assumption. |

Use the current folders for UI/background/core/content. Add provider, approval,
chain adapters and comparison fixtures only when their chronological feature is
reached and specified. Shared schemas must separate internal wallet requests
from website JSON-RPC requests.

## Feature loop — one lifecycle feature at a time

1. Reload docs/project/AGENTS.md, both research docs, this plan and the current UI parity row.
2. Check original artifact identities. Reuse prior evidence only after binding
   inputs and outputs to the current target by hash/offset/manifest.
3. Resolve the feature's code paths with REA/recovery; establish exact dependency
   arguments, messages, state, conditions and errors. `UNKNOWN` stays explicit.
4. Capture every reachable screen/state for that feature in an isolated profile.
   Link screenshots and sanitized state to code branches. Mask recovery material;
   never store passwords, seeds, private keys or session/API tokens in fixtures.
5. Finish the implementation specification before UI coding. Preserve history
   with dated corrections rather than silently replacing earlier findings.
6. Implement the complete flow in Harbour. Keep working interactions tied to
   actual services/state. Financial submission ambiguity must be reconciled;
   do not automatically sign a replacement after a timeout.
7. Compare reference and Harbour at identical viewport, locale, theme, account
   and network conditions. Approve intentional branding substitutions explicitly
   in the diff record. A screenshot alone proves neither behavior nor custody.
8. Run focused tests and a clean build, then verify the built extension. Record
   remaining gaps and feature acceptance before starting the next feature.

## Ordered work

| Lifecycle gate | Required outcome | Current state |
|---|---|---|
| Baseline/tools | Immutable artifact, reproducible tool versions and hashes; operational REA recovery | Local baseline and Linux recovery verified; full acquisition/signature provenance remains limited |
| 01 Install | Correct first-run entry and surfaces, install/update branches | Recovered exact ranges and positive install runtime fixture; target update branch code-confirmed only |
| 02 Onboarding | All create/import/backup routing and screen states, back/cancel/retry, existing-wallet mode | Next active feature; public welcome/auth/password fixtures captured; Harbour differs |
| 03 Password validation | Exact common-password policy, errors, confirmation and submit gating | Earlier recovered code available; Harbour minimum-length check is insufficient |
| 04–08 Vault and accounts | Proven KDF/encryption/session/storage/account operations and target-driven chain set | Core PoC only; differential and integration verification required |
| 09 Unlock/session | Unlock, throttle, inactivity scheduler, worker/browser lifecycle and lock broadcasts | Scheduler and full implementation parity pending |
| 10 Home/data | Actual balances/tokens/fiat/prices/history with loading/error/refresh behavior | Harbour home uses constants |
| 11 Send | Per-network staging, address/risk validation, fee/nonce, approval, signing, broadcast and reconciliation | Target per-network details and implementation incomplete |
| 12–15 Provider/signing/bridge/network | Request/response/event equivalence, origin permissions, approval UI, chain/RPC resolution | Earlier evidence provisional; end-to-end implementation pending |
| 16 WalletConnect/QR | Exact SDK integration decisions, proposals/sessions/approvals/errors and UI | UNKNOWN details; compiled JS is an investigation difficulty, not proof of impossibility |
| 17 Swap/stake/NFT | Split into discovered chronological subfeatures, trace their complete flows | Research partial; no working implementation |
| 18 Hardware | Enumerated devices/chains, connection/import/sign/reject/disconnect flows | Research partial; no working implementation |

Expand this list and the numbered research tracker when target artifacts reveal
additional reachable settings/account/permission/recovery screens; a chunk's name
alone is not proof that it is reachable. Preserve the authoritative lifecycle
order; earlier exploratory findings for later rows do not unlock their build.

## Acceptance and honest completion

Each feature requires: a complete source-backed specification; a reachable
screen/state inventory; approved visual comparisons; matching deterministic
public outputs; matching validation/errors/state transitions; relevant negative
and lifecycle cases; and a passing built-extension test. Fix all unexplained
visual differences in stable regions. Record any approved assets, dynamic
content or environment differences instead of hiding them with broad masks.

No overall completion until every enabled in-scope feature meets these gates.
Any unavailable service, hardware, server behavior or remaining UNKNOWN must be
reported with its effect on functionality. Full equivalence is not established
by using the same crypto library or matching a few addresses. Release hardening
also requires resolving recorded dependency advisories and custody/message-boundary
review; the current successful build is not a release approval.

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
`docs/re/UI-PARITY.md` is the sole screen/state/navigation coverage authority. Track
implementation, integration, visual inspection and interaction separately. Sample
data and development previews never count as live integration. Resume detailed
research at #02; preserve later evidence as provisional. Continue independent
work when a dependency blocks a gate. Append durable evidence and build records.

## 2026-10-16 — Asset and rendered implementation pass

Local CC0 crypto/fiat marks, Inter and Lucide are recorded in `docs/re/ASSET-LEDGER.md`.
The original Harbour illustration, shared controls, and popup tokens are in
`docs/re/DESIGN-SYSTEM.md`; inspected Trust and four-extension research is in
`docs/re/REFERENCE-LEDGER.md`. Portfolio/send/approval development fixtures were
rendered at popup size and interaction-checked, but are not production coverage.
Built MV3 onboarding and popup captures are in `evidences/audit/onboarding-v2/` and the
current statuses remain in `docs/re/UI-PARITY.md`. Production static price, APR,
on-ramp, NFT and dApp rows were removed while real adapters are unfinished.
Next implementation gate remains #02 onboarding, with QR reader/background,
private-key import, Solana history choice and other branches unresolved.

## 2026-10-19 — Revised build order (user mandate: no screen left; gaps first)

**Session scope amendment, 2026-10-19:** The latest user request pauses new feature implementation and asks for UI/UX completion on existing screens only. The broader build order below remains the long-term plan; this session's rendered coverage, design corrections, and unresolved UI gaps are recorded in `docs/re/UI-PARITY.md` and `harbour-wallet-v2/BUILD-LOG.md`. Do not treat visually polished unavailable states as feature completion.

Phase 0 — Docs sync (done 2026-10-19).
Phase 1 — **Fill gaps in what exists**: (a) chain registry → Trust Wallet's enabled set with real derivation/addresses;
(b) home header/wallet name, theme unification (onboarding), remaining hard-coded colours; (c) receive chain picker + per-chain
receive; (d) send confirm flow + asset picker; (e) onboarding missing branches (private key, Solana derivation, QR scan,
passkey, wallet limit); (f) settings partials; (g) tx detail + history completeness.
Phase 2 — **Provider/approval stack** (dApp EIP-1193 inpage, content bridge with allowlist + origin binding, approval window,
connections/blacklist/detail screens, switch/add chain, personal_sign/typed data/tx).
Phase 3 — **Multi-chain send/sign**: BTC (UTXO), Solana, then wallet-core chains (Cosmos family, TRON, TON, etc.) via
wallet-core signing + public broadcast RPCs.
Phase 4 — **Replace static screens with public data**: NFTs, staking/earn, buy/sell/fund/fiat-ramps (public provider
equivalents), discover, market sentiment, gas station.
Phase 5 — Remaining settings (help, developer, UTXO, security migration), WalletConnect v2, Ledger.
Phase 6 — Verification pass in Chrome (screenshots TW vs Harbour), parity ledger update, security review.

Each step: REA recovery when uncertain → spec in `evidences/re-evidence/NN-*` → implementation → `tsc` + build + tests → BUILD-LOG + parity
ledger entry. Module boundaries: `core/` (pure logic, no DOM), `background/` (router, services, approvals), `popup/` (UI),
`content/` + `inpage/` (provider bridge). New background messages must pass `accessPolicy` (UI-only) unless explicitly part of the
provider allowlist.
