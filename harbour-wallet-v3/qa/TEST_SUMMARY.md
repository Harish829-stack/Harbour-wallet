# TEST_SUMMARY.md — Harbour Wallet v3 pre-audit test suite (Phase 6)

Date: 2026-11-23 · Branch: `fix/runtime-network-review` · Nothing is committed. The test phases did not change production source; the fix pass on 2026-11-23 (section 0) fixed every finding.

## 0. Fix pass (2026-11-23)

All 18 defects (BUG-01..18) and all 16 observations (OBS-01..16) are fixed in the product code; the fix and the file for each are on the **Status** line of its entry in `qa/BUGS_FOUND.md`. Every test that reproduced a bug as expected-fail (`knownBug`, `expectKnownBug`, `qaKnownBug`) is now a plain assertion, so a regression fails the suite. New: `apps/extension/test/qa/fix-regressions.test.js` (BUG-08, BUG-12, OBS-15) and `apps/backend/internal/api/qa_sns_test.go` (OBS-15 gateway route).

Results after the fixes (cloud sandbox, Go 1.26.10, Node 22, Postgres 16, Redis): extension original tests 753 (752 pass, 1 skip, 0 fail); extension QA suites 304 tests, 304 pass, 0 fail, 0 known-bug skips; full-stack + browser E2E 32 tests, 32 pass, 0 skips; Go `go test -race -count=1 ./...` all packages ok. `tsc --noEmit` and eslint on the changed source files are clean.

Main design changes: `VaultService.update(fn)` (one worker-wide queue for every vault read-modify-write; keystore, wallet list and vault written in one `setMany`), `qrCodeCheck` (serialised one-time-code checks counted before scrypt), a serialised `consumeReauth`, `store.ReplaceDeviceAddresses` (remove + add in one transaction, budget refunded on refusal), address tracking that adds what fits and tells the user (`tracking` notice on Home), and `.sol` lookups through the Harbour gateway (`/v1/gw/sns/resolve/<name>`).

## 1. Result

Of the 712 planned test IDs: **709 COVERED, 0 COVERED-XFAIL, 2 WEAK, 1 MISSING**, 0 BROKEN. Every P0 item is covered. The 3 items that are not fully covered are listed in section 6 with the reason. All Go items are green. Since the fix pass there are no open known bugs.

### Gap counts by category

| Category | COVERED | COVERED-XFAIL | WEAK | BROKEN | MISSING | Total |
|---|---|---|---|---|---|---|
| CON | 19 | 0 | 0 | 0 | 0 | 19 |
| CONC | 30 | 0 | 0 | 0 | 0 | 30 |
| E2E | 14 | 0 | 0 | 0 | 1 | 15 |
| INT | 102 | 0 | 0 | 0 | 0 | 102 |
| KAT | 28 | 0 | 1 | 0 | 0 | 29 |
| MIG | 21 | 0 | 0 | 0 | 0 | 21 |
| NEG | 80 | 0 | 0 | 0 | 0 | 80 |
| PERF | 11 | 0 | 0 | 0 | 0 | 11 |
| PROP | 64 | 0 | 0 | 0 | 0 | 64 |
| REG | 37 | 0 | 0 | 0 | 0 | 37 |
| RES | 43 | 0 | 0 | 0 | 0 | 43 |
| SEC | 150 | 0 | 1 | 0 | 0 | 151 |
| UI | 6 | 0 | 0 | 0 | 0 | 6 |
| UNIT | 104 | 0 | 0 | 0 | 0 | 104 |
| **All** | **709** | **0** | **2** | **0** | **1** | **712** |

## 2. Suites and runs (every suite run three times)

| Suite | Command | Run 1 / 2 / 3 |
|---|---|---|
| Extension original tests (87 files) | `node --test test/*.test.js` | 748 tests, 747 pass, 1 skipped, 0 fail — identical in all three serial runs |
| Extension QA suites (`test/qa`, 41 files) | `HB_FUZZ_RUNS=200 node --test --test-force-exit --test-concurrency=1 test/qa/*.test.js` | QA suites re-run last pass: all green except known-bug skips; see run log, 9 skipped (known bugs), 0 fail — identical in all three runs. Files added after those runs (mutation-hardening, locale-format, utc-keys, and the stricter spec-vectors) were covered by one further full run: 283 tests, 273 pass, 10 skipped (the extra skip is the OBS-13 marker), 0 fail |
| Full-stack + browser E2E (`test/e2e`) | `node --test --test-force-exit --test-concurrency=1 test/e2e/*.test.js` (real Go API + Postgres + Redis + mock chain, Chromium) | 30 tests, 26 pass, 4 skipped (known bugs), 0 fail — identical in all three runs |
| Backend Go (`apps/backend`, 33 QA test files plus the originals) | `go test -race -count=1 ./...` with `HB_TEST_POSTGRES_URL` / `HB_TEST_REDIS_URL` set (Postgres 16, Redis 7.4 in Docker) | run on the user's Mac with Go 1.26.10: all packages `ok`. One existing timing test (`TestHedgingOnlyForUserFacing`) failed once while the machine was loaded and passed 3 of 3 when re-run alone. Without the database variables, the database tests skip (coverage 39 %), so always set them |

Flakiness found and fixed in the test infrastructure (not the product): (a) the E2E stack left per-IP rate-limit and daily counters in Redis, so the second run in a row failed from the dApp journey on with "NETWORK_DISABLED_IN_TESTS"; `stack.mjs` now flushes its Redis DB at start; (b) running the original suites concurrently with another heavy suite under `--test-force-exit` dropped tests from the report (737/731/743 reported instead of 748); run serially they are stable.

## 3. Coverage

- **Extension (TS):** measured by `qa/tools/v8-line-coverage.cjs` over all 41 QA files: **63.4 % of the source lines that the worker bundles contain** (QA suites only; the 748 original tests and the browser E2E are not in this figure, so it is a floor). Security core: keySchedule, passworder, storage, walletService 100 %; vaultService 81 %; swap/safety 82 %; provider/ratelimit and protocol 100 %. Low QA-only files such as `smartAccount/send.ts`, `provider/multi.ts`, `solanaTx.ts` are exercised by the original suites. Per-file baseline: `qa/COVERAGE_BASELINE.md`. No threshold gate is enforced. Plain `c8 report` cannot be used on these bundles (it reports a false 100 %).
- **Backend (Go):** measured on the user's Mac: **76.0 % of statements overall** (`go test -coverpkg=./... ./...`; target 70 %). Per package, counting only that package's own tests: `internal/api` 85.1 %, `devicesig` 90.9 %, `evmtx` 94.0 %, `gateway` 86.7 %, `ratelimit` 100 %, `indexer` 74.3 %, `notifier` 78.0 %, `config` 80.3 %; `store` has an average of 87.1 % per function (111 functions; a function average, not statement-weighted). The `cmd/*` packages (`main` entry points) and a few tiny stubs report 0 %. Two store functions that no test reached (`SaveBackfillCursor`, `PurgeDeliveries`) now have tests. T-GOF-001 is COVERED.

## 4. Mutation testing (StrykerJS, command runner; configs in `qa/tools/mutation/`)

| File | Tests used | Score before hardening | After |
|---|---|---|---|
| `core/errors.ts` | errors.test, sanitize.prop, mutation-hardening | 63.6 % (82 killed / 47 survived) | **89.2 %** (115 / 14) |
| `core/passkey.ts` | biometrics-failures, mutation-hardening | 31.4 % (70 / 153) | **83.9 %** (187 / 36) |
| `background/provider/tonProof.ts` | spec-vectors | 91.7 % (11 / 1) | **100 %** (12 / 0) |

The survivors that remain are regex anchors, optional-chaining and try/catch variants and UI-only fallbacks that no observable behaviour distinguishes. Mutation testing caught real test gaps: the TON workchain endianness (invisible for workchain 0 and -1), every WebAuthn request parameter (platform attachment, user verification, resident key, PRF) and most error-text mappings were unpinned. Go mutation testing (gremlins) was not run (no toolchain). Only three files were mutated; this is a sample, not a whole-codebase score.

Go (gremlins on `internal/devicesig`, run on your Mac): 0 survived, 10 killed, 1 not covered (the `RegistrationMessage` string, line 75), 25 timed out. Gremlins counts a timeout as neither killed nor survived, so its 100% efficacy covers only the 10 killed; the 25 timeouts (mostly the nonce check on line 67 and the PoW loop) are inconclusive, most likely because the default timeout is too tight for the slower PoW tests. A rerun with a larger timeout would settle them.

## 5. Bugs and observations (details, file/line, reproduction in `qa/BUGS_FOUND.md`)

18 defects (BUG-01..18) and 16 observations (OBS-01..16), **all fixed on 2026-11-23** (section 0). Before the fix each defect had a test that reproduced it, marked expected-fail (`knownBug` / `expectKnownBug` / `qaKnownBug`); the test fails once the bug is fixed, so the marker is removed with the fix, and fails immediately under `HB_QA_STRICT=1`.

| ID | Severity | Summary (all FIXED 2026-11-23) |
|---|---|---|
| BUG-01 | Medium | `PUT /v1/me/addresses` is not atomic: a refused add still applies removals and burns backfill budget |
| BUG-02 | Medium | nested-null `eth_getLogs` topic filter passes the "address or topic required" guard |
| BUG-03 | Low → Medium | `formatUnits` panics on negative decimals, quadratic work on huge decimals |
| BUG-04 | Low | `addWallet` lists the keystore id before the vault write; a failed persist leaves an orphan |
| BUG-05 | Low | re-auth grants are not atomically consumed (one grant can authorise two concurrent operations) |
| BUG-06 | Low → Medium | vault read-modify-write handlers are not serialised; concurrent updates are lost |
| BUG-07 | Low → Medium | QR-sync "5 wrong codes" limit bypassed by parallel guesses |
| BUG-08 | Low | `eth_sendRawTransaction` from a site is forwarded to the backend without local validation |
| BUG-09 | Low | two concurrent private-key copies both fail (offscreen port handshake) |
| BUG-10 | Medium | on a new device most accounts stay untracked (18 refs per address vs a 40/day backfill budget) |
| BUG-11 | Low | send confirmation truncates amount and fee (can show "0") |
| BUG-12 | Medium | approval window never opens when the browser window is larger than the screen |
| BUG-13 | Low | Home tab strip violates ARIA (axe-core critical) |
| BUG-14 | Low | unlock screen shows the internal code `TOO_MANY_ATTEMPTS` |
| BUG-15 | Low | the worker signs and broadcasts a zero-amount native send (UI blocks it, worker does not) |
| BUG-16 | Medium | indexer consumers die for good if NATS is unreachable > 5 s at start |
| BUG-17 | Low | a WalletConnect answer that fails to send is dropped silently |
| BUG-18 | High | the vault cannot be saved once it holds about 8 wallets (`passworder.ts` spreads a large byte array into `String.fromCharCode`, which throws RangeError); the add fails and leaves an orphan keystore |

Severities are copied from `BUGS_FOUND.md`. Observations added in the last phase: OBS-11 (`takeSettled` does not remove what it returns), OBS-12 (`TECHNICAL` regex misses `at fn (file:1:2)` stack frames), OBS-13 (a tiny negative amount is shown as `<$0.01`, losing its sign).

## 6. Items not fully covered (3)

| Plan ID | Pri | Status | Reason |
|---|---|---|---|
| T-SIG-033 | P1 | WEAK | Published TON proof / ADR-036 spec vectors were not available offline; checked against an independent construction from the spec text (field binding, big-endian workchain, sorted keys, escapes). |
| T-X-010 | P1 | WEAK | npm audit gate is tested with a fake npm. `govulncheck ./...` was run on the maintainer's Mac on 2026-11-25 (go1.26.x): 0 vulnerabilities reachable from the code; 2 in imported packages and 1 in a required module are not called (`-show verbose` lists them). It cannot run in the offline sandbox, so it stays a manual step (`go run golang.org/x/vuln/cmd/govulncheck@latest ./...` from apps/backend). |
| T-SA-017 | P2 | MISSING | Needs a mock bundler, the remote smart-account flag and a pinned testnet chain wired into the Playwright stack; the worker path is covered at unit level (smart-account-send.test.js) but the browser journey is not built. |

## 7. What the suite is, how to run it

- Layout, commands, E2E requirements and conventions: `apps/extension/test/README.md`.
- Plan, inventory, assumptions: `qa/TEST_DISCOVERY.md`, `qa/FEATURE_INVENTORY.md`, `qa/TEST_PLAN.md`; per-ID status: `qa/tools/gap.table.md` (generated from `qa/tools/impl.tsv` by `python3 qa/tools/gen-gap.py`); original Phase-3 baseline: `qa/TEST_GAP_REPORT.md`.
- Safety rules held throughout: no real keys, funds, mainnet or network calls (published mnemonics, throwaway Hardhat keys, in-process fakes, local Postgres/Redis, mock chain); production source untouched (bugs are logged, not fixed); secrets files (`.env`, key JSONs, `.hbdevice.json`, certs) were never read.
- New test infrastructure and why: Playwright + axe-core (no browser or a11y tooling existed; needed for the approval window, lock screen, backup images), `fast-check` (no property-testing tool existed), an in-process mock JSON-RPC chain (the foundry/anvil download was refused), StrykerJS kept outside the repo dependencies.

## 8. Housekeeping for the user

- `qa/.transfer/v3-src.tgz` on your machine is a transfer artefact and can be deleted.
- Local setup used for the Go run: Docker containers `hb-pg` (postgres:16, port 55432) and `hb-redis` (redis:7.4, port 56379); remove with `docker rm -f hb-pg hb-redis`. The two Homebrew installs (postgresql@16, redis) are unused and can be removed with `brew uninstall`.
- Remaining work: the browser journey for smart-account batches (T-SA-017), the official TON / ADR-036 spec vectors (T-SIG-033, needs them pasted in or network access) and a `govulncheck` run in CI (T-X-010, run by hand so far). No open bugs.
- Closed in the last pass: T-DEFI-017 (`defi-failure-matrix-venues.test.js`: perps, predictions, NFTs, 429 never a retry storm), T-X-006 (`roundtrip-state.prop.test.js`: vault state, large vaults, keystore export/import, cursors), T-CH-015 (`failover-timing.test.js`: fake-clock run of the 10 s / 30 s timeouts).
