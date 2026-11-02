# Harbour Wallet v3 — Current Project Status

Updated: 2026-11-02

This is the current status document for the implementation on branch
`harbour-v3`. The older reverse-engineering and Harbour-v2 documents remain
valuable evidence and history, but their implementation counts and next-step
claims are not current for v3.

## Source of truth

- Implementation: `harbour-wallet-v3/`
- Backend deployment/runtime design: `harbour-wallet-v3/backend/README.md` and
  `harbour-wallet-v3/backend/deploy/`
- Security status: `harbour-wallet-v3/audit/summary.md`, `findings.md`, and
  `fixes.md`
- Historical Trust Wallet research: `docs/re/`,
  `docs/trust-wallet-architecture/`, and `docs/project/rebuild-tracker.md`

## Verified local state

- Branch: `harbour-v3`, clean working tree, tracking `origin/harbour-v3`.
- TypeScript: `npm exec tsc -- --noEmit` passes.
- Tests: 497 total; 496 pass, 1 fails because the sandbox refuses the test's
  localhost listener (`provider.test.js`, `listen EPERM 127.0.0.1`).
- Verification: `npm run verify` is currently blocked by ESLint errors in the
  generated `.kdfprobe.mjs` (`TextEncoder`, `TextDecoder`, and `console`).
- Live RPC/provider, deployed-backend, Chrome visual, and Ledger hardware
  verification are still incomplete.

## Remaining implementation scope

The v3 code intentionally reports unsupported paths rather than faking support.
The remaining gaps include several chain-specific send paths (currently ICP,
FIO, Nimiq, Aion, and Ontology), some non-EVM token coverage, inscriptions and
bridge flows, and hardware-wallet validation. Feature flags and provider keys
also need production configuration before those areas can be exercised.

## Release readiness

The code remediation pass is substantially complete, but release sign-off is
not complete. The security handoff still requires secret rotation, moving the
release key out of the repository, Postgres TLS, CI/branch protection,
inter-service TLS, cleanup of captured-token artifacts, and independent/live
validation. See `harbour-wallet-v3/audit/fixes.md` for the exact hand steps.

## Immediate next actions

1. Fix the lint gate and make the localhost-dependent test use an injected or
   in-process test server.
2. Re-run tests, `npm run verify`, and a production build.
3. Complete the security handoff steps and re-run the audit gates.
4. Deploy the backend dependencies and services in a staging environment.
5. Run live RPC, Chrome, provider, and Ledger checks before a release candidate.
