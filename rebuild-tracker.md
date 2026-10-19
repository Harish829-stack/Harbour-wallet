# Trust Wallet RE — Feature Coverage Tracker (chronological)

> Companion to `trust-wallet-RE.md` (evidence base + specs) and `AGENTS.md` (method).
> Tracks **documentation progress**, not building.
>
> **Order is law.** Features are RE'd strictly top-to-bottom. A feature starts only
> once the one above it is genuinely RE'd via REA + decompiler tools, confidence
> assigned, gaps marked `UNKNOWN`. No jumping.
>
> **"REA-genuine" bar.** A row is only `Established` when its facts were produced by
> **REA** (source recovery) for JS, or by a decompiler/controlled execution for
> wasm. Facts read by raw `grep` of the un-recoverable 42 MB `background.js` are
> marked `grep-only` and are NOT yet at the bar — they must be re-RE'd by carving a
> valid slice and running REA `recover_javascript_sources` (the method proven on the
> vault slice), because Wakaru OOMs on the full bundle.

## Legend
- RE progress: ⬜ Not started · 🔄 In progress · 🟡 Partial · ✅ Established
- Method: REA (recovery) · WABT · exec (controlled execution) · grep (needs re-RE via REA)
- Confidence: High / Medium / Low / Unassessed

## Chronological feature list

| # | Feature (lifecycle order) | RE progress | Method | Confidence | Evidence | Remaining gap |
|---|---|---|---|---|---|---|
| 01 | Install / first-run entry (`onInstalled` → onboarding tab) | ✅ Established | REA | High | §3.0; REA ev_8602c9a3 (sliced bg.js) | none in scope |
| 02 | Onboarding flow (create / import / backup routing) | ✅ Established | REA | High | rec-onb (§3) | none material |
| 03 | Password rules + validation | ✅ Established | REA | High | rec-auth (§3.4) | none |
| 04 | Key derivation (PBKDF2-SHA512 20k/210k) | ✅ Established | REA | High | rec-vault ev_4f0946c2 (§4.1) | none |
| 05 | Vault create + session key storage | ✅ Established | REA+RUNTIME | High | rec-vault (§4.2); runtime schema §6.2 | none (storage keys resolved) |
| 06 | Seed encryption — StoredKey + vault (2 layers) | ✅ Established | REA+exec+WABT+RUNTIME | High | §4.5/§4.7; runtime-confirmed §6.3 | none |
| 07 | wallet-core usage decisions (how TW drives the lib) | ✅ Established | REA + exec | High | §4.7; REA ev_7afedf54 | supported-coin list/paths = #08 |
| 08 | Account & address derivation per chain + chain list | ✅ Established | REA | High | §4.8; REA ev_934dc08b (128-coin list, Solana dual-derive) | per-coin paths = wallet-core default; allowed-blockchain extras config-driven |
| 09 | Unlock / lock / session lifetime / throttling | ✅ Established | REA | High | §4.9; REA ev_d62096af + ev_4f0946c2 | auto-lock countdown scheduler (which alarm) |
| 10 | Home: balances / tokens / prices / history | ✅ Established | REA+HAR | High | §5.10/§7; ev_491e9157 + HAR | none (gateway contracts captured) |
| 11 | Send: tx build → fees → nonce → sign → broadcast → errors | 🟡 Partial | REA | Medium | §5.11; ev_d433f7dd | per-network signing bodies, fee/nonce, broadcast endpoints |
| 12 | dApp provider (EIP-1193) | ✅ Established | REA | High | §5.12; ev_8511560a (inpage) | background approval-UI flow |
| 13 | Message / typed-data signing | ✅ Established | REA | Medium | §5.13; ev_8511560a + ev_7afedf54 | background approval screen flow |
| 14 | content↔inpage↔background message bridge | ✅ Established | REA | High | §5.14; ev_6b52a033 | none material |
| 15 | Network / RPC / endpoints | ✅ Established | REA+HAR | High | §5.15/§7; ev_de93124b + HAR | twnodes NaaS map captured |
| 16 | WalletConnect / QR sync | ⚠ Partial (corrected 2026-10-19) | Partial | likely | scripted search of background.js/chunks (not REA); evidence/16 addendum | TW 26.41.0 ships only a Kotlin WC *request mapper* (`WcMethod`, `WcRequestDispatcher`); no pairing/relay/session code or UI found. Harbour implements WC v2 via public Reown WalletKit (deviation). Reachability behind a flag UNKNOWN |
| 17 | Swaps / staking / NFTs | 🟡 Partial | REA+HAR | Medium | §5.17/§7; ev_1db92cac + HAR | staking/NFT/buy captured; DEX swap endpoint not in HAR |
| 18 | Hardware wallet (Ledger) integration | 🟡 Partial | REA | Medium | §5.18; ev_153b6ed2 | per-coin Ledger signing (use @ledgerhq) |

(Expand by inserting sub-features at their correct chronological position.)

## Honest note on method

Only #02–#05 are REA-genuine `Established`. #01, the cipher-selection part of #06,
#07, and #12 rest partly or wholly on `grep` of `background.js`/`inpage.js` because
Wakaru OOMs on those large bundles. They are downgraded until re-RE'd via carved
REA slices. The scrypt params (#06) are `exec`-proven (strong, but not REA JS
recovery) and the wasm format is `WABT` — both honest binary evidence, labelled as
such, not as REA.

## Next target (strict order)

1. **#01** — DONE (REA ev_8602c9a3, §3.0).
2. **#06 / #07** — DONE (REA ev_7afedf54, §4.7).
3. **#08** — DONE (REA ev_934dc08b, §4.8). Next: **#10** home: balances/tokens/prices/history.

All chronological features (#01–#18) have been processed; see table above and Status below.

## Status

Updated: 2026-10-15 (batch #10–#18)
Target: Trust Wallet extension v26.41.0 · dependency wallet-core 4.8.2
All 18 features processed.
- Established (REA-genuine): #01–#10, #12, #13, #14 (13 features).
- Partial (client RE'd; runtime/vendored part UNKNOWN): #11, #15, #17, #18 (4).
- Blocked (Kotlin/JS-compiled, not statically recoverable): #16 (1).
Runtime DONE (§6) + server/API contracts captured from HAR (§7): #10 & #15
now Established with real endpoints; #17 staking/NFT captured, DEX swap still
uncaptured. Still pending: auto-lock trigger (static, I can finish), #16 (blocked).

## 2026-10-15 — Audited correction (current)

The earlier table/summary is historical and contains contradictions. Its rows
actually show 14 Established, 3 Partial and 1 Blocked after the HAR update; neither
that count nor “all processed” establishes complete feature readiness. The
“only #02–#05 genuine” note is also superseded by later deposited evidence.

Current authority: final **Reverse Engineering Status** in `trust-wallet-RE.md`,
`audit/CURRENT-STATUS.md`, and the build plan `IMPLEMENTATION-PLAN.md`.
The user now authorizes a full faithful implementation; this tracker continues
to track research only. UI/build parity is separately tracked in `UI-PARITY.md`.

| Feature | Current RE gate | Verified from target | Evidence / gap |
|---|---|---|---|
| 01 | Established for install entry | Yes: code + fresh-install runtime | `evidence/01-install/2026-10-15-local/`; ev_a13180a7; exact source offsets, no mocks; `audit/screens/reference/00-install.json`; update-negative runtime not exercised |
| 02 | In progress: next active feature | Partial overall | Historical REA chunks hash-bound to local inputs; welcome/auth/password runtime captures in `audit/screens/reference/`; full branch/screen/state inventory and fixtures incomplete |
| 03–08 | Retained evidence; audit readiness in order | Partial overall / per-claim prior tags | Verified historical file integrity and source input hashes do not by themselves establish complete fixtures or build readiness |
| 09–10 | Reopened as partial overall | Partial | Auto-lock scheduler/lifecycle and full home UI/data/error fixtures remain |
| 11 | Partial | Partial | Network-specific transaction implementation and approval/broadcast fixtures incomplete |
| 12–15 | Provisional later-feature evidence | Partial overall | #11 gate was not closed; background approval/configuration/end-to-end details incomplete |
| 16 | UNKNOWN details; investigation required | No full-flow proof | Compiled code is a difficulty, not proof that static analysis is impossible; SDK reuse alone cannot close the feature |
| 17–18 | Partial, provisional | Partial | Full swap/staking/NFT and hardware paths/fixtures unresolved |

Local tools: REA 6.5.0, Wakaru 1.14.0, WABT 1.0.42, Playwright 1.56.1,
Chromium 141.0.7390.37. Mac JS recovery is unsupported in this REA adapter;
pinned Linux x64 recovery was installed and successfully verified with networking
disabled. Tool identities/commands/limitations: `tools/README.md` and `audit/`.

All 23 historical source inputs have matching local files; all 46 listed
recovered JS/map artifacts match manifest hashes. Snapshots deposited into
`evidence/*/inputs-verified-local/`; original inputs and concatenation/stub
limitations are distinguished in `audit/source-input-integrity.json`.

**Ordered next action:** complete #02's specification and reachable onboarding
screen/state coverage, then implement/compare it. Do not jump to home/send on the
basis of historical labels. No complete-wallet or complete-UI claim is supported.

## 2026-10-16 — REA installation verification

REA 6.5.0 is already installed. Scoped Codex registration/skill checks pass; setup preview has no actions. Live MCP responds as 6.5.0 (207 tools). See [installation check](evidence/tooling/2026-10-16-rea-install-check/README.md) for commands, checksum, saved checks and limitations. No feature coverage changed; prior paused work and chronological next steps remain unchanged.


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

## 2026-10-19 — Research status snapshot and new build mandate

Build mandate changed (see AGENTS.md 2026-10-19): implement everything; research is now driven by implementation gaps and
resolved with REA on demand. Research rows (unchanged evidence, honest status):
Established 14 (#01–#10, #12–#15), Partial 3 (#11 send, #17 swap/stake/NFT, #18 Ledger), Blocked/unknown 1 (#16 WalletConnect).
Evidence added since 2026-10-15: `evidence/19..23` (search/manage-crypto, dApp discovery, network filter, window context,
trending), `24-har-api-contract` (34 gateway calls), `25-swap`, `26-settings`, `27-biometrics`, `28-custom-token`,
`29-security-networks-sync`.

New research items opened by the build (each to be recovered with REA before/while implementing; spec goes in `evidence/NN-*`):
| # | Item | Status |
|---|---|---|
| 30 | dApp approvals (connect / sign / typed-data / tx / add-switch chain) + connections screens | ✅ Build implemented; REA recovered; Chrome interaction pending — `evidence/30-dapp-approvals/2026-10-19/` |
| 31 | Send per-network (BTC UTXO, Solana, Cosmos, etc.) incl. confirm flow, NFT send, inscriptions | ⬜ |
| 32 | Receive (chain list, per-chain asset) and tx detail | ⬜ |
| 33 | Staking / earn flows (stake, unstake, redelegate, compound, claim) | ⬜ |
| 34 | NFT collections / detail / reported | ⬜ |
| 35 | Buy / sell / fiat-ramps / CEX fund / recurring buy | ⬜ |
| 36 | Settings remainder (help, connections, developer, UTXO, security migration, accounts) | ⬜ |
| 37 | Chain registry (86 enabled chains), custom asset non-EVM, gas station | ⬜ |
| 38 | Market sentiment, onboarding branches (private-key, Solana derivation, QR scan, passkey) | ⬜ |

## 2026-10-19 — Custom network catalog repair
- The background already persisted and routed custom EVM networks, but popup network controls read a static built-in-only `NETWORKS` array. The popup now derives network options and native asset entries from the synchronized `networkRegistry`, so a saved custom chain is selectable from the home network button and send/receive asset pickers. Build/runtime Chrome verification is still pending.
| 39 | WalletConnect v2 and Ledger | ⬜ |

## 2026-10-19 — UI-only session checkpoint

The latest user request restricts this session to UI/UX on already present screens. No REA recovery or target implementation claim was added; all numbered research statuses and chronological gates above remain unchanged. Built-extension visual evidence and remaining screen gaps are recorded in `UI-PARITY.md` (2026-10-19 UI-only rendered pass). The build journal is `harbour-wallet-v2/BUILD-LOG.md`. Resume detailed feature research at the earliest unfinished gate only when feature implementation is back in scope.
