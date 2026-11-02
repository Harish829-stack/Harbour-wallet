<!-- Exported from Claude Docs on 2026-11-02. Source: https://claude.ai/artifact/ERWMnUGTgEuPAJWbVhbExp -->
> **Local copy.** Exported from the shared doc https://claude.ai/artifact/ERWMnUGTgEuPAJWbVhbExp on 2026-11-02 (written 2026-10-29). Status: snapshot before the audit; banner lists what is out of date. Embedded diagrams in the original appear here as text placeholders. Treat code as the source of truth; see `audit/HANDOFF.md`.

# Harbour v3 — Production Readiness Report

Oct 29, 2026 · @Harish

> **Update Nov 2, 2026:** this report is the 2026-10-29 snapshot. Since then a full L1–L3 security audit (139 controls) and its fixes were done on `harbour-v3` (baseline `6692a88`, 23 commits after it). Superseded below: the vault already uses Argon2id (not PBKDF2); the Go backend now builds and tests green on Go 1.26.10, including integration tests; `TestDeviceFlow` is fixed and covers quotas again; `TestNewWalletMatchesChain` passed on rerun (still treat it as flaky); 493 of 494 JavaScript tests pass. Current state, findings and hand steps: `harbour-wallet-v3/audit/summary.md`, `findings.md`, `fixes.md`, and `audit/HANDOFF.md`.

## Verdict

**Harbour v3 is a feature-complete private beta, not yet ready for a public mainnet release: about 70% of the way there.** The code itself is in good shape; what is missing is proof that it behaves correctly in a real browser, against a real backend, and under outside review.

The score is my judgment from the evidence in this report, not a measured number. Licensing and AWS deployment are out of scope.

- **Ready:** key custody design, dApp provider and signing policy, 477 of 478 JavaScript tests passing, type-check and lint clean, reproducible signed release scripts.
- **Not ready:** an unrotated Infura key, an unverified Go backend, no browser end-to-end tests, a weak vault key-derivation schedule, and no independent audit.
- **Safe to do now:** a closed beta on the curated testnets with trusted testers.
- **Do not do yet:** publish to the Chrome Web Store with mainnet signing enabled.

## Scope and method

I analysed the `harbour-wallet-v3` extension and Go backend on branch `harbour-v3` (all work committed, latest 8f6873c), plus the project's audit and status documents.

| Area | Size |
| --- | --- |
| Extension, background worker | 6,215 lines, 60 files |
| Extension, core logic | 13,112 lines, 177 files |
| Extension, popup UI | 8,352 lines, 80 files |
| Page-injected provider and content script | 629 lines, 7 files |
| Go backend | 20,161 lines, 26 test files |
| JavaScript tests | 56 files, 478 test results in the last run |

What I ran: the full JavaScript test suite, the TypeScript compiler with the repo's own version (5.5.4), ESLint with zero warnings allowed, and searches for TODOs, console output and unsafe type escapes. I also read the signing policy, vault, re-auth, provider and network code directly.

What I could not run: the Go build and tests (no Go toolchain on your machine's shell), Docker, the extension in a live Chrome, and `npm run verify`. Backend ratings below come from code and tests read, not from a green run.

Excluded by request: licensing and legal, and AWS deployment.

## Scorecard

Eight areas, each scored out of 10 for production readiness. The weakest are verification and operations, not the wallet code.

| Area | Score | Evidence |
| --- | --- | --- |
| Code quality | 8 | `tsc` 0 errors, ESLint clean with zero warnings allowed, no TODO or console output left; 290 uses of `as any` or `@ts-ignore` are the main debt |
| Key custody and secret handling | 7 | Keys stay in the worker; recovery phrases and private keys reach the popup only as images or opaque chips; password or biometrics required to reveal, back up or add a wallet; weak key derivation (see Security) |
| dApp provider and signing | 8 | Every signature goes through the approval window; mainnet, testnet and custom signing are explicit switches in `policy.ts`; origin binding, request throttle, `eth_sign` off by default |
| Networks and custom networks | 7 | Three consistent groups (Default, Custom, Testnets); site add-chain now persists and tries every RPC; fixed today but never exercised in a live browser |
| Go backend | 6 | 26 test files, CI runs `govulncheck` and `gosec`; not run here, 28 Go standard-library advisories wait on a toolchain bump, one integration test fails and one is flaky |
| Automated testing | 6 | 477 of 478 JavaScript results pass (the one failure needs a file outside the repo); no browser end-to-end tests and no component tests for the popup |
| Release engineering | 7 | Reproducible build, signed release, pinned `release-signer.pub`, CI runs verification; a release build must use an https API URL |
| Independent assurance | 3 | One internal audit (8 High findings, most now fixed); no third-party audit, no bug bounty, no incident-response plan on record |

## Security and key handling

The two worst findings from the internal audit are fixed in code; the remaining risk is a weak password-to-key schedule and a leaked key you still need to rotate.

**Confirmed in the code**

- The popup no longer receives recovery phrases or private keys. A reveal returns an image of the key, backup uses opaque tap-in-order chips, and copying never passes through the UI (`background/handlers/secrets.ts`).
- Revealing, backing up, creating, importing or QR-importing a wallet needs a one-shot password or biometric grant: 2 minutes for reveal, 10 minutes for add-wallet (`background/reauth.ts`, covered by `reauth-gate.test.js`).
- Signing is gated by an explicit policy with three switches, and mainnet signing also needs a secure backend in release builds (`core/harbour/policy.ts`).
- The extension page policy is strict: scripts only from the extension itself, no inline code, no remote code.

**Still open**

| Item | Severity | What it means |
| --- | --- | --- |
| Weak key derivation | Medium | The outer vault layer uses PBKDF2-SHA256 with 10,000 iterations and the keystore passphrase uses 20,000, matching Trust Wallet but far below current guidance. A stolen browser profile is cheap to attack offline. The v2 notes already propose a versioned key schedule (F2); v3 has not applied it |
| Address linking without opt-in (V3-10) | Medium | Every wallet address is linked to the device id on the backend. Needs a product decision |
| Device-key fallback (V3-33) | Medium | When Chrome lacks WebCrypto Ed25519, a raw seed is stored in IndexedDB. The minimum Chrome version of 114 likely predates universal support |
| `zod` advisory (V3-22) | Low | No patched release works with the viem and abitype versions in use; CI audits at critical level only |
| Go standard-library advisories | Medium | `govulncheck` found 28 in Go 1.26; fixes are in 1.26.1 and later |

## Provider, networks and signing

The provider design is sound, but four real bugs surfaced in this session through manual use, which shows the gap between unit tests and the live browser.

| Bug found | Cause | Status |
| --- | --- | --- |
| Chainlist network not saved | Any chain the wallet library knew was treated as built-in and silently dropped from Custom networks; saves could also overwrite the list after a worker restart | Fixed, committed |
| Add-chain failed on rate-limited RPC | Only the first RPC the site sent was tried; chainlist's endpoint answered HTTP 429 | Fixed, now tries up to six |
| Chainlist opened MetaMask despite default-wallet setting | `window.ethereum` was a plain value that MetaMask could overwrite | Fixed, now locked; needs a live check |
| Home and Settings network lists differed | Settings listed the whole registry with different grouping and icons | Fixed, same groups, order and icons |

What holds up:

- Site-added chains pass through the approval window and an RPC chain-ID check before they can be saved or signed on.
- Private-network and non-https RPC addresses are refused for site-supplied chains.
- The curated testnets are generated from one list shared by extension, backend and faucets, so they cannot drift.

What to verify before release: the MegaETH testnet values (chain 6343) are unconfirmed because sources disagreed; run `npm run check:rpc`. Custom networks can sign after approval, so a site-supplied chain with a hostile RPC can show false balances; the approval screen already warns about this.

## Testing, quality and build

Logic is well covered; the browser layer is not covered at all, and that is where this session's bugs lived.

| Check | Result |
| --- | --- |
| JavaScript tests | 477 of 478 pass; `chains.test.js` needs a file outside the repo |
| TypeScript compiler (repo version 5.5.4) | 0 errors |
| ESLint, zero warnings allowed | Clean |
| TODO, FIXME, console output | 0 |
| `as any` and `@ts-ignore` | 290 occurrences across the source |
| Go tests | 26 files across API, indexer, gateway and adapters; not run here |
| Browser end-to-end tests | None |
| Component tests for the popup | None; `ui-secrets.test.js` checks the secret boundary only |

Known test debt (as of 2026-10-29): the integration test `TestDeviceFlow` expected the old quota tier (fixed 2026-10-30), and the indexer test `TestNewWalletMatchesChain` is flaky.

Build and release: the repo has scripts for a reproducible build, a signed release and a pinned signer key (I did not run them), and CI runs verification, `govulncheck` and `gosec`. The current `dist/` was built against `http://localhost:8080`; the build scripts refuse a release unless the API URL is https.

## Blockers and next steps

Six items stand between today's build and a public mainnet release, in the order I would do them.

1. **Rotate the Infura key** (V3-04) and replace `INFURA_API_KEY_2`. Minutes of work, and it closes the one High finding still open.
2. **Run the Go backend for real:** `./run.sh test`, `govulncheck`, `gosec`, and bump the Go toolchain to 1.26.1 or later. Fix `TestDeviceFlow` and the flaky indexer test.
3. **Add browser end-to-end tests** for the flows that failed by hand this session: connect from a dApp, add a chain from chainlist, switch network, send on a testnet, reveal and back up a phrase. Playwright with the built extension is the practical route.
4. **Harden key derivation** with the versioned key schedule already designed in the v2 notes (F2), migrating on first unlock.
5. **Decide the open product questions:** opt-in address linking (V3-10) and what to do about the device-key fallback on older Chrome (V3-33).
6. **Get an independent audit** of the extension, backend and key generation, then open a bug bounty, before enabling mainnet signing for the public.

Medium-term: replace the `as any` casts with typed message maps, confirm the MegaETH testnet values, and add component tests for the approval and network screens.

Sources: `SECURITY-AUDIT-V3.md` (sections 1 and 8), the project's v3 implementation status and remediation notes, and direct reading and test runs of the `harbour-v3` branch on 2026-10-29.
