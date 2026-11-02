# Harbour Wallet: fix report (2026-10-30)

Branch `harbour-v3`, baseline commit `6692a88`; one commit per finding after it (`git log --oneline 6692a88..`). Statuses are also in `findings.md`.

## Verification

2026-11-02 H-05 follow-up to `0a9d9f8`: the Postgres server now rewrites `host` rules to `hostssl` for both existing and fresh volumes. `go test ./deploy/postgres/initdb` passed in `golang:1.26.10-alpine` (the rule is idempotent and leaves existing `hostssl` rules intact). An isolated fresh Postgres initialization produced only `hostssl` TCP rules. The live Compose database accepted a TLS 1.3 session and rejected `sslmode=disable` with `no pg_hba.conf entry ... no encryption`; API `/healthz` returned 200 after restart. This does not verify production edge TLS or internal service transport (J-01/J-05).

| Check | Result |
| --- | --- |
| Extension `tsc --noEmit`, gateway `tsc` | clean |
| ESLint on every changed file (`--max-warnings 0`) | clean |
| Extension unit tests (`node --test test/*.test.js`) | 493 pass, 1 fail: `chains.test.js` reads `../evidences/re-evidence/...har-balances-chains.json`, which is outside the repo (not related to these fixes) |
| Backend `gofmt`, `go vet ./...`, `go test ./...` (golang:1.26.10 container) | clean / all packages pass |
| Backend integration tests against the local stack (`internal/api`, `internal/indexer`, `internal/prices`) | pass; `TestDeviceFlow` now reaches and passes the quota, forged-key, stale-clock and idempotency assertions |

New tests: phishing large list + cache cap, lazy fetch, phishing block override, prompted chain switch, backup gate, auto-lock cap, byte-key EVM signer parity with viem, API schema guards, WebAuthn PRF biometrics and legacy migration, legacy add-password drops the seal, cross-wallet restore vectors, Postgres TLS policy, security headers, broadcast replay scrub, secret files.

## What you need to do by hand

1. **Postgres TLS (HW-007).** Done on 2026-10-30: certificates created in `backend/deploy/postgres/certs` and `POSTGRES_URL` in `.env` set to `verify-full`. Remaining: `chmod 644 deploy/postgres/certs/ca.crt deploy/postgres/certs/server.crt`, then `make up`, and check every service connects. On a fresh machine run `backend/scripts/setup.sh` BEFORE `make up` (otherwise Docker creates empty folders for the missing cert files). In production use the provider CA (for example the RDS bundle) with `sslmode=verify-full`.
2. **Rotate secrets (HW-002).** Rotate every provider key and server secret in `backend/.env`, plus the Postgres and Redis dev passwords shared during the audit. Load production secrets with `NAME_FILE` mounts from a secrets manager. Install the hook: `ln -s ../../scripts/pre-commit .git/hooks/pre-commit` and `brew install gitleaks`.
3. **Release key (HW-003).** Put the Ed25519 PEM into the CI `release` environment secret `HB_RELEASE_KEY_PEM`, add two required reviewers, and set `HB_RELEASE_APPROVERS`. Then securely delete `../harbour-release-key.json`. Offline signing: `node scripts/release.mjs --key-file` with a 0600 file outside the repo.
4. **CI and repository (HW-008).** Copy `ci/extension.yml` (and `backend/ci/backend.yml`) to `.github/workflows/`. Turn on branch protection (required checks, 1 review, no force push), and 2FA/hardware keys on the Chrome Web Store and GitHub accounts.
5. **Biometrics (HW-001).** Users who had biometrics on must turn it on again (Settings > Security). Devices without WebAuthn PRF (an older Chrome, or an authenticator without hmac-secret) can only use the password. Tell users in the release notes.
6. **Alerting (HW-013, I-09).** Add alerts on `security_event` lines (for example a burst of `auth_bad_signature`, `auth_replay` or `register_rate_limited`) and on the gateway metrics.
7. **Inter-service TLS (HW-015).** Use mTLS or a private network and mesh between api, rpc-gateway, NATS and Centrifugo in production. Not changed in code.
8. **Cleanup.** Delete `audit/flows.mitm` (contains tokens) and the MCP Chrome test profile (throwaway wallet). Run the remaining external items: pen test, ASVS L2 backend review, bug bounty, IR drill, Ledger clear-signing check (C-12).

## Behaviour changes to note in release notes

- Receive, Buy and Fund open the backup flow until the secret phrase is backed up.
- Auto-lock "Never" is gone (maximum 4 hours); a stored "Never" becomes 10 minutes.
- Sites listed for phishing are blocked; continuing means typing the site's host.
- Site-requested network switches now ask for approval.
- `window.trustwallet` and the `isTrust*` flags are gone. dApps that only detect Trust Wallet will see Harbour through EIP-6963 or `window.ethereum`.
- Biometric unlock needs re-enrolment (PRF).
