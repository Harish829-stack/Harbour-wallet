# Documentation

All project documents live here. Nothing else in the repository is documentation, apart from each app's README.

| Folder | Contents |
| --- | --- |
| `harbour-v3/overview/` | How it works, tech stack, chains, developer guide, feature matrix, current status (`v3-status.md` is the authoritative status) |
| `harbour-v3/planning/` | Implementation plan, build log, rebuild tracker, agent charter |
| `harbour-v3/architecture/` | Backend plans, database design, optimization, reliability, readiness reports |
| `harbour-v3/security/` | Security model, audit framework, pentest and attack-review fixes, approval scan; `audit-v3/` holds the full audit working files |
| `harbour-v3/operations/` | Release process, store listing, hosting comparison, **Railway deployment guide** |
| `trust-wallet-re/analysis/` | Reverse-engineering findings on the Trust Wallet extension |
| `trust-wallet-re/architecture/` | Architecture write-up of the reference extension and the parity plan |
| `media/` | Demo video |
| `_old-docs-index.md`, `_old-reference-index.md` | The previous index files, kept because they carry original source links and dates |

Many older documents (especially under `architecture/` and `trust-wallet-re/`) describe `harbour-wallet-v2` and use its paths. They are historical context and are not rewritten.

## Where things moved (2026-11-06 restructuring)

| Before | Now |
| --- | --- |
| `harbour-wallet-v3/src`, `scripts`, `test`, `public-production`, `package.json`, … | `harbour-wallet-v3/apps/extension/…` |
| `harbour-wallet-v3/backend` | `harbour-wallet-v3/apps/backend` |
| `harbour-wallet-v3/gateway` (legacy Cloudflare Worker, still covered by tests) | `harbour-wallet-v3/apps/extension/gateway` |
| `harbour-wallet-v3/audit/{e2e,ui-layout}` | `harbour-wallet-v3/apps/extension/tools/{e2e,ui-layout}` |
| `docs/`, `harbour-wallet-v3/docs`, `harbour-wallet-v3/audit/*.md`, `Harbour-v3-audit/`, `Claude outputs/` | `documentation/…` |
| `evidences/`, `tools/` | `research/evidences/`, `research/tools/` |
| `harbour-wallet-v2/` | removed from the branch (still on `main` and in history; local copy in `_to_delete/`) |
| `harbour-wallet-v3/ci/`, `backend/ci/` (copies of the workflows) | `.github/workflows/` (single source) |
| `harbour-wallet-v3/.gitleaks.toml`, `scripts/pre-commit` | `.gitleaks.toml`, `scripts/git-hooks/pre-commit` |
