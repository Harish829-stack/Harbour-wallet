# Extension tests

| Folder / pattern | What it is | Command |
|---|---|---|
| `test/*.test.js` | The original unit / integration suites (node:test). | `npm test` |
| `test/qa/*.test.js` | Pre-audit QA suites: the real service worker bundled whole with esbuild and fakes only at the browser boundary (`qa/harness.mjs`), plus property tests (fast-check), KATs, static lints and resilience tests. | `npm run test:qa` (`test:qa:ci` = 200 fuzz runs, serial; `test:qa:strict` = known bugs fail) |
| `test/e2e/*.test.js` | Full-stack and browser E2E: the real Go API + Postgres + Redis + a deterministic mock JSON-RPC chain (`e2e/mock-chain.mjs`); `browser.test.js` loads the built extension into Chromium with Playwright (axe-core for a11y, a CDP virtual authenticator for biometrics). | `npm run test:e2e` |

Backend tests live next to the Go code (`apps/backend/**/qa_*_test.go`, `internal/qacontract`).

## E2E requirements
`HB_E2E_POSTGRES_ADMIN_URL` (a role that may CREATE DATABASE), `HB_E2E_REDIS_URL` (use a spare DB, e.g. `/13`), and either `HB_E2E_API_BIN` (a built `apps/backend/cmd/api`) or `go` on PATH; Playwright with Chromium for the browser file. A missing requirement is reported as a skip that names it; `npm run test:e2e` fails if any is missing. Nothing leaves the machine; no real keys or funds are used (published mnemonics, throwaway Hardhat keys, mocks).

## Conventions
- Never change production source to make a test pass. A test that finds a bug stays, is marked with `knownBug(t, 'BUG-nn', reproduced, evidence)` (`qa/known-bug.mjs`; Go: `expectKnownBug` / `qaKnownBug`), and the bug is logged in `qa/BUGS_FOUND.md`. A known bug skips while it reproduces and **fails once it is fixed** (so the marker gets removed) or under `HB_QA_STRICT=1`.
- Spies are bundle-time `transform`s in the harness (e.g. key-dispose spy); production files are untouched.
- Every test names its plan id (`T-AAA-nnn`) from `qa/TEST_PLAN.md`; `qa/tools/impl.tsv` maps ids to files and `python3 qa/tools/gen-gap.py` regenerates the gap tables.

## Fix pass (2026-11-23)
All BUG-01..18 and OBS-01..16 in `qa/BUGS_FOUND.md` are fixed. Each `knownBug(...)` / `expectKnownBug(...)` marker that reproduced a bug is now a plain assertion, so a regression fails the suite. `test/qa/fix-regressions.test.js` adds direct tests for BUG-08, BUG-12 and OBS-15.

## New in the previous pass
- `test/qa/earn-flow.test.js` (T-DEFI-006): staking success paths against a mock chain (Cosmos LCD, TRON).
- `test/qa/perf-ext.test.js` (T-DAPP-053, T-EXT-039, T-KEY-119): provider read burst, popup broadcast latency, vault size limits (surfaces BUG-18).
- `test/qa/reg-static.test.js` (T-REG-026): third-party host allowlist.
- `test/qa/pow-perf.test.js` (T-BE-089, JS half).

## Coverage (T-EXP-001)
Run the QA suites under V8 coverage, then report on `src/**` (from `apps/extension`):

```
rm -rf /tmp/cov && HB_QA_COVERAGE=1 NODE_V8_COVERAGE=/tmp/cov HB_FUZZ_RUNS=30 node --test --test-concurrency=1 test/qa/*.test.js
npx c8 report --temp-directory /tmp/cov --exclude-node-modules=false --all=false --exclude-after-remap=true --include 'src/**' --reporter=text-summary --reporter=text
```

`HB_QA_COVERAGE=1` makes the harness keep its bundles on disk with inline source maps so V8 can map them back to `src/`.
