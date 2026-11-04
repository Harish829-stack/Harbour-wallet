# Harbour Wallet security audit: handoff for the next agent

Last updated 2026-11-02. Every referenced document is in this repository (section 3). Read this file first, then the files it points to. Treat the **code as the only source of truth**. These docs describe the code at the commits named; re-check anything you rely on.

## 1. What this project is

- **Product:** Harbour Wallet, a self-custodial browser-extension crypto wallet (Chrome MV3) with a Go backend. No smart contracts.
- **Repo:** `/Users/jatinsharma/Desktop/REA/harbour-wallet-v3` (git, branch `harbour-v3`).
  - **Baseline commit:** `6692a88` ("Baseline before security audit fixes"), the code the audit ran on.
  - **Fix commits:** everything after it; see `git log --oneline 6692a88..`.
- **Extension:**
  - `src/` holds the code: `background/` (service worker), `core/`, `popup/`, `content/`, `inpage/`, `offscreen/`.
  - Tests are in `test/` (node --test); build and release scripts are in `scripts/`.
  - `gateway/` is the legacy Cloudflare worker, superseded by `/v1/gw`.
- **Backend:**
  - `backend/` holds the Go services: api, rpc-gateway, indexer, webhook-ingest, price-poller, tx-tracker, notifier, realtime-bridge.
  - Postgres, Redis, NATS and Centrifugo run through `backend/deploy/docker-compose.yml`.
  - Start it with `backend/run.sh` or `make up`.
- **Architecture map:** `audit/00-architecture.md`.

## 2. What has been done (in order)

1. **Framework.** A generic audit framework for "browser extension + backend + database" wallets.
   - 139 controls in areas A–M, levels L1–L3.
   - Built from CCSS v9, OWASP ASVS 5.0, the OWASP Browser Extension cheat sheet, SLSA and the CIS PostgreSQL benchmark.
   - Copy in the repo: `audit/FRAMEWORK.md`. Shared doc: "Harbour Wallet — Security Audit Framework & Checklist" (link in section 3).
2. **Agent prompt saved as a skill.** `extension-wallet-audit` audits a codebase against the framework, using code as the only evidence.
3. **Static audit** on `6692a88`.
   - Every control is scored in `audit/results.md`.
   - Findings HW-2026-001 to 017 are in `audit/findings.md`.
   - Overview: `audit/summary.md`.
   - Tool output: `audit/tool-output/`.
4. **Runtime audit** in Chrome for Testing 156 through chrome-devtools-mcp, against the local backend.
   - Results are in `audit/runtime-results.md`.
   - New findings: HW-018 (phishing check always failed with a RangeError) and HW-019 (dApp RPC skipped the signed fetch hook).
5. **End-to-end audit** with a mitmproxy capture (`audit/flows.mitm`) plus the Docker, Postgres and Redis MCPs.
   - New finding: HW-020 (device↔transaction links in plaintext in Redis and in `pending_transactions`).
6. **Remediation** of all 20 findings as far as code allows: about one commit per finding, plus docs and Postgres-cert follow-ups.
   - Status of each finding: the `Status:` lines in `audit/findings.md`.
   - Hand steps, verification and behaviour changes: `audit/fixes.md`.
7. **Postgres TLS follow-up.** The first `make up` after the change failed because the certificates did not exist yet.
   - Fixed: the certificates were generated, `backend/.env` was switched to `verify-full`, and the Compose file and `pg-certs.sh` now guard against this.
   - `make up` and `run.sh` both create the certificates automatically now.
8. **Later review rounds (2026-11-03 and 2026-11-04, after the audit above).** Three attacker-style rounds on the extension and gateway, all fixed and tested; they are tracked in their own records, not in `findings.md`:
   - Pentest PT-01..PT-12 (biometric enrolment, spending cap, throttle, re-auth, WalletConnect, IndexedDB vault, Trusted Types): `docs/reference/security-pentest-2026-11-03-fixes.md`.
   - Seed typing and reveal hardening (threat-model 1.1): `docs/reference/security-pentest-2026-11-04-seed-typing.md`.
   - Attacker review A1-A9 (gateway parser bypass, approval preview, `storage.local` pinned, QR scrypt cap): `docs/reference/security-attack-review-2026-11-04.md`. A9 (keys in the REA root folder) is open.
   - Status index: `docs/project/V3-STATUS.md`. Full suite 558/558 on `931a0ad`.

## 3. Reference documents

Every document is in this repository. The claude.ai links are the editable originals of the shared docs; the local copies in `docs/reference/` were exported on 2026-11-02 (index: `docs/reference/README.md`).

| Doc | Local path | Use it for |
| --- | --- | --- |
| This handoff | `audit/HANDOFF.md` | Start here |
| Framework (139 controls) | `audit/FRAMEWORK.md` (canonical); `docs/reference/audit-framework-shared.md` (shared-doc copy, [original](https://claude.ai/artifact/Jd31QzSXNn6CgXojxXhrWt)) | Control IDs, levels, severity rules (Section 18), sign-off (Section 19) |
| Control results | `audit/results.md` | Per-control PASS/PARTIAL/FAIL with file:line evidence, **as of `6692a88`** (not re-scored after fixes) |
| Findings + current status | `audit/findings.md` | The 20 findings; the `Status:` line on each is current |
| Fix report | `audit/fixes.md` | What was verified, the manual steps left, and release-note changes |
| Summary | `audit/summary.md` | Post-remediation overview at the top, original audit below it |
| Runtime results | `audit/runtime-results.md` | Browser tests run, **as of `6692a88`** |
| Architecture map | `audit/00-architecture.md` | Where each component lives (updated for the fixes) |
| Tool output | `audit/tool-output/` | npm audit, audit gate and secret-scan output from the static audit |
| Audit skill | `docs/reference/extension-wallet-audit-SKILL.md` | Re-running the audit, code as the only evidence (copy of the installed skill) |
| New developer guide | `docs/reference/new-developer-guide.md` ([original](https://claude.ai/artifact/6x85gJ2duGXZ3ax9p3RMku)) | Setup, run and everyday commands; current, with a TLS banner |
| Production readiness report (v3) | `docs/reference/production-readiness-report-v3.md` ([original](https://claude.ai/artifact/ERWMnUGTgEuPAJWbVhbExp)) | 2026-10-29 snapshot from before the audit; its banner lists what is out of date |
| Backend Go services, indexer and RPC plan | `docs/reference/backend-go-services-indexer-rpc-plan.md` | The design the v3 backend follows (2026-10-27) |
| Redesign: backend, database and architecture | `docs/reference/redesign-backend-db-architecture.md` | Reverse-engineered Trust Wallet evidence behind the backend design (2026-10-27) |
| Backend plan: Trust Wallet-equivalent services | `docs/reference/backend-plan-trust-wallet-equivalent.md` | Earlier backend plan, superseded by the Go services plan |
| Development progress report | `docs/reference/development-progress-report.md` | v2-era status report (2026-10-28), has unfilled placeholders |
| Production readiness and architecture (v2) | `docs/reference/production-readiness-and-architecture-v2.md` | Review of `harbour-wallet-v2` (2026-10-23) |
| Implementation documentation (v2) | `docs/reference/implementation-documentation-v2.md` | How `harbour-wallet-v2` was built (2026-10-22) |

Docs marked v2 or "earlier" are context only; where they disagree with the v3 code, the code wins.

## 4. Finding status (short)

| Finding | State |
| --- | --- |
| 001 biometrics, 003 release key, 004 backup gate, 005 chain switch, 006 phishing block, 007 DB TLS, 008 supply chain, 009 key bytes, 010 Trust Wallet flags, 011 auto-lock, 012 headers/CORS, 013 security logs, 014 API schema, 016 approvals, 018 phishing crash, 019 RPC fetch, 020 Redis privacy | Fixed in code |
| 002 plaintext secrets | Partly: `NAME_FILE` secret mounts, gitleaks config and pre-commit hook done; key rotation and a secrets manager are manual |
| 017 informational leftovers | Mostly fixed. Still open: Ledger clear-signing check (C-12) and alert rules (I-09) |
| 015 inter-service plaintext HTTP | Open: needs mTLS or a private network at deployment |

Residuals to know about:
- **HW-009:** the new mnemonic is still a JS string at creation, because wallet-core returns it that way.
- **HW-014:** there is no second-provider cross-check of nonce or balance.
- **HW-016:** the full allowance scanner already existed; it covers mainnets only.

## 5. Open work, in priority order

1. **Confirm the stack runs with TLS.** In `backend/`, run `chmod 644 deploy/postgres/certs/ca.crt deploy/postgres/certs/server.crt`, then `make up` (or `./run.sh`). Check that every service connects. If one fails, read `docker compose -f deploy/docker-compose.yml logs postgres migrate api`.
2. **Hand steps in `audit/fixes.md`:**
   - rotate every secret in `backend/.env` and the dev Postgres/Redis passwords shared during the audit;
   - move the release key into the CI `release` environment and delete `../harbour-release-key.json`;
   - install `ci/extension.yml` and `backend/ci/backend.yml` under `.github/workflows/`, with branch protection;
   - set up store/GitHub 2FA and alert rules on `security_event` logs.
3. **Re-score the controls** touched by the fixes (`results.md` is still the baseline):
   - Start with the L1 FAILs D-01, G-06 and H-05, and the HW-001 area-B blocker.
   - Then update the sign-off section in `summary.md`.
4. **Re-run the runtime checks** on the fixed build (rebuild `dist/` first):
   - phishing block screen and host-typing override;
   - chain-switch prompt;
   - backup gate on Receive/Buy/Fund;
   - auto-lock options;
   - no `window.trustwallet`;
   - PRF biometrics on a Mac with Touch ID.
5. **HW-015:** mTLS or private networking between services in the deployment.
6. **External work:** pen test, ASVS L2 backend review, bug bounty, incident-response drill, Ledger clear-signing check, independent audit (needed for L2/L3).
7. **Cleanup:** delete `audit/flows.mitm` (it contains session tokens) and the chrome-devtools-mcp test profile (it holds a throwaway wallet connected to example.com).

## 6. How to build and verify

```sh
# extension (repo root)
npm ci --ignore-scripts      # .npmrc sets ignore-scripts
npx tsc --noEmit && npx tsc -p gateway/tsconfig.json
npm run lint                 # zero warnings
npm test                     # expect 493 pass, 1 fail: test/chains.test.js needs ../evidences/... outside the repo
npm run verify               # lint, tsc, tests, build, audit gate, lockfile, secret-leak scan

# backend
cd backend
./run.sh                     # or: make up  (both create Postgres certs first)
make test                    # unit tests, no services needed
make test-integration        # needs the stack; TestNewWalletMatchesChain can be flaky when packages run together
```

Environment notes:
- The audit sessions ran in a Linux VM with no Go toolchain. Go was run with the `golang:1.26.10-alpine` image, mounting `backend/` to `/src`.
- When running integration tests from a container, use `host.docker.internal` and `HB_ALLOW_INSECURE_DB=1`. The services refuse plaintext connections to any database that is not on loopback.
- `node_modules` holds the macOS esbuild binary. On Linux, point `ESBUILD_BINARY_PATH` at a linux esbuild or reinstall.

## 7. Runtime test setup used

- **Browser:** Chrome for Testing 156.0.8078.80 at `/Users/jatinsharma/chrome-for-testing/chrome/mac_arm-156.0.8078.80/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
- **chrome-devtools-mcp:** started with `--categoryExtensions` and that executable path. The unpacked `dist/` extension ID is `lgobkgelpfojjfmomhabgnbbkjgdjpeo`.
- **Other MCPs used:** mitmproxy (capture written with `-w`), Docker, Postgres and Redis MCPs. Credentials live in the user's Claude Desktop config; never paste them into chat.
- **Limits:**
  - The MCP cannot read the service worker's console or network traffic.
  - Funded transactions, Ledger and passkeys were not exercised.
  - Code run through CDP `evaluate` bypasses CSP, so do not count it as a CSP gap.

## 8. Working rules for the next agent

- Code, config and tool output are the only evidence. READMEs, comments and these docs are pointers, not proof. Cite file:line.
- Make one commit per fix. End each message with the user's attribution trailer (`Co-Authored-By` / `Claude-Session`).
- Add a unit test for every security fix, the way the existing ones were done (`test/provider.test.js`, `test/passkey.test.js`, `test/harbour.test.js`, `backend/internal/api/security_internal_test.go`).
- Never print secrets: not from `backend/.env`, `.hbdevice.json`, the release key or `flows.mitm`. Mask them in output.
- Use `rm` only for files you created or that the user approved deleting.
- When a fix changes user-visible behaviour, add it to the release-note list in `audit/fixes.md`.
