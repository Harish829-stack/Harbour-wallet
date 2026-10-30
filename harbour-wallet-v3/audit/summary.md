# Harbour Wallet: audit summary

## Post-remediation update (2026-10-30)

Everything below the "Original audit" heading is the state at audit time and is kept as the record. Fixes were made on branch `harbour-v3`, from baseline `6692a88` (`git log --oneline 6692a88..`). 19 commits, mostly one per finding; per-finding status is in `findings.md`, the hand steps are in `fixes.md`.

| Outcome | Findings |
| --- | --- |
| Fixed in code (17) | HW-2026-001, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 016, 018, 019, 020 |
| Partly fixed, hand steps remain (1) | HW-2026-002 (rotate keys, move to a secrets manager) |
| Mostly fixed (1) | HW-2026-017 (Ledger clear-signing check and alert rules open) |
| Open, deployment work (1) | HW-2026-015 (mTLS or private network between services) |

Residual notes: HW-009 keeps the new recovery phrase as a JS string at creation (wallet-core returns it that way); HW-014 does not cross-check nonce/balance against a second provider; HW-016 was a false gap in the static audit (a full allowance scanner already existed in Settings; it covers mainnets only).

Verification: extension `tsc` and ESLint clean; 493 unit tests pass, 1 fails (`chains.test.js` reads an evidence file outside the repo, unrelated); backend `gofmt`, `go vet` and `go test ./...` pass (Go 1.26.10 container); integration tests pass against the local stack, and `TestDeviceFlow` again runs the quota, forged-key, stale-clock and replay checks.

Sign-off effect (code side, not re-scored control by control): the code causes of the L1 failures D-01 (backup gate), G-06 (secret file mounts) and H-05 (Postgres TLS) and the open High HW-2026-001 are fixed. L1 stays unconfirmed until the hand steps are done (TLS setup run, secrets rotated, release key moved, CI and branch protection on) and the controls are re-checked. L2 and L3 still need the external work: pen test, ASVS L2 review, bug bounty, IR drill, Ledger clear-signing check, independent audit. Delete `audit/flows.mitm` (contains tokens).

---

# Original audit

| Item | Value |
| --- | --- |
| Framework | Extension Wallet Security Audit Framework & Checklist, 139 controls, target L3 (`audit/FRAMEWORK.md`) |
| Codebase | `harbour-wallet-v3` on Desktop/REA. Audited 2026-10-30 as a non-git snapshot; it is now a git repository with baseline commit `6692a88` (`Baseline before security audit fixes`) |
| Scope found | MV3 extension (service worker, popup/side panel, content script, MAIN-world inpage provider, offscreen clipboard); Go backend (api, rpc-gateway, indexer, webhook-ingest, price-poller, tx-tracker, notifier, realtime-bridge); Postgres + Redis + NATS + Centrifugo (docker-compose); legacy Cloudflare gateway worker; release scripts |
| Method | Static, read-only review. Code, config and tool output are the only evidence. Comments, READMEs and docs were not used as evidence |
| Tools run | `npm audit --omit=dev` (13: 4 high, 9 low), `scripts/audit-gate.mjs` (passed with 1 accepted exception), regex secret scan of source (0 hard-coded secrets; test vectors only), dist leak check against 43 backend secret values (0 hits). Semgrep, gitleaks, Go and govulncheck are not installed on the machine, so they were not run |

## Results by level

| Level | Controls | PASS | PARTIAL | FAIL | NOT FOUND | NEEDS EXTERNAL EVIDENCE |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | 63 | 41 | 8 | 3 | 1 | 10 |
| L2 | 51 | 23 | 8 | 0 | 6 | 14 |
| L3 | 25 | 4 | 6 | 1 | 4 | 10 |
| **Total** | **139** | **68** | **22** | **4** | **11** | **34** |

## Results by area

| Area | PASS | PARTIAL | FAIL | NOT FOUND | EXTERNAL |
| --- | --- | --- | --- | --- | --- |
| A Key & seed generation (11) | 6 | 1 | 0 | 2 | 2 |
| B Key storage & vault (12) | 8 | 3 | 0 | 0 | 1 |
| C Transaction signing (12) | 10 | 2 | 0 | 0 | 0 |
| D Backup & recovery (10) | 2 | 1 | 1 | 1 | 5 |
| E Extension MV3 (15) | 12 | 1 | 0 | 0 | 2 |
| F dApp & phishing (10) | 7 | 3 | 0 | 0 | 0 |
| G Backend & API (13) | 9 | 2 | 1 | 0 | 1 |
| H Database (12) | 5 | 1 | 1 | 2 | 3 |
| I RPC / indexer (9) | 6 | 1 | 0 | 2 | 0 |
| J Network & transport (7) | 1 | 2 | 0 | 0 | 4 |
| K Supply chain (10) | 0 | 4 | 1 | 3 | 2 |
| L Logging & IR (9) | 2 | 1 | 0 | 1 | 5 |
| M Operations & people (9) | 0 | 0 | 0 | 0 | 9 |

## Sign-off status (Section 19, code side only)

- **L1: not met.**
  - There are 3 FAIL controls: D-01 (backup not enforced), G-06 (plaintext secrets) and H-05 (DB TLS disabled).
  - The open High finding HW-2026-001 is in Area B. L1 requires 0 open High findings in Areas A–C while biometric unlock ships.
  - 8 L1 controls are PARTIAL and 1 is NOT FOUND (L-04, security.txt).
- **L2: not met.** It needs L1 first. It also needs 0 open High findings, an ASVS L2 backend verification, a pen test, a bug bounty and an IR drill, all of which are external.
- **L3: not met.** K-10 (release key handling) fails, and the 4 NOT FOUND controls (A-10, D-10, I-08, K-08) plus the independent audit are open.

**NEEDS EXTERNAL EVIDENCE items that block sign-off:**

- **L1:** A-06 key-generation docs; D-04/D-05 compromise procedures; E-13 privacy policy; J-01 TLS at the edge; K-03 store account 2FA; K-04 branch protection (enable on the remote); M-01 to M-03 key inventory, offboarding, staff MFA.
- **L2+:** A-09, B-11, D-07 to D-09, E-15, G-13, H-06, H-09, H-12, J-04, J-06, J-07, L-05 to L-09, M-04 to M-09.

## Top 10 risks

0. **HW-2026-018 (High, runtime):** phishing detection never works. A `RangeError` from spreading the 359k-entry ScamSniffer list means every site shows "safety check unavailable". See `runtime-results.md`.
0b. **HW-2026-019 (Medium, runtime):** dApp-path RPC reads are sent unsigned, refused with 401, then fall back to public RPCs, which leaks addresses and calldata and means approval data comes from third-party nodes (`makeRpc(fetch)` captures fetch before the Harbour hook is installed).
0c. **HW-2026-020 (Medium, runtime):** Redis keys, broadcast idempotency bodies and `pending_transactions` keep device↔tx links in plaintext, undoing the encrypted device→address links in Postgres.
1. **HW-2026-001 (High):** biometric unlock seals the vault keys under the WebAuthn user handle (not a secret), which can bypass Argon2id. Use the PRF extension.
2. **HW-2026-008 (Medium):** supply chain. No extension CI, the audit gate is not wired in, install scripts are unrestricted, and third-party code in the service worker is not compartmentalised.
3. **HW-2026-002 (Medium):** live provider keys and the address-link encryption key sit in plaintext in `backend/.env`.
4. **HW-2026-006 (Medium):** phishing-listed sites get a click-through warning, not a block.
5. **HW-2026-005 (Medium):** connected sites can switch networks silently (`autoSwitch`, `wallet_switchEthereumChain`).
6. **HW-2026-003 (Medium):** the release signing key is a local plaintext file, with no two-person release.
7. **HW-2026-004 (Medium):** funds can be received before the seed is backed up.
8. **HW-2026-007 (Medium):** Postgres connections use `sslmode=disable`.
9. **HW-2026-009 (Low):** EVM private keys and the new mnemonic pass through un-zeroable JS strings.
10. **HW-2026-013 / 014 (Low):** no backend security-event logging, and API responses and chain reads are used without schema validation or cross-provider checks.

## Notable strengths (verified in code)

- Argon2id (46 MiB, t=2) → HKDF → AES-256-GCM vault with atomic KDF migration and serialised throttling.
- A "dumb UI" boundary: the phrase and keys are rendered to PNG in the worker, every response passes the `uiSafe` filter, and the clipboard is written from an offscreen document with a 60 s wipe.
- A strict internal router: only `/src/popup/index.html` can call wallet commands. The provider origin comes from `port.sender`, method allowlists apply, and requests are rate-limited and bound to the connection.
- Rich approval view: calldata decoding, Permit/Permit2/multicall hidden-approval detection, `eth_simulateV1` asset changes, GoPlus and ScamSniffer address risk, and `eth_sign` disabled by default.
- Backend: Ed25519 device-signed requests with nonce replay protection, proof-of-work registration, an SSRF-safe media proxy, encrypted device→address links, and least-privilege per-service DB roles.

## Verification pass

All 139 IDs have a row (coverage check at the end of `results.md`). The key citations, 25 file:line references across the extension and backend, were re-opened after writing and matched the claims. No corrections were needed.
