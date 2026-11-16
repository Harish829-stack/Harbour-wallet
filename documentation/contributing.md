# Contributing

## Workflow

- Branch from `main`, keep commits small and descriptive, open a pull request. CI must pass (`backend.yml` for `apps/backend/**`, `extension.yml` for `apps/extension/**`).
- Before opening a PR: in `apps/extension` run `npm run lint && npm test` (or `npm run verify`); for backend changes run `make test` and `make lint` in `apps/backend`.
- Install the pre-commit guard once: `ln -s ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit`. It refuses `.env`, key files, device files, Firebase service accounts and Postgres certificates, and runs `gitleaks` on staged changes if it is installed (`brew install gitleaks`).
- Never commit secrets. These are git-ignored on purpose: every `.env`, `harbour-keys.env`, `harbour-config-key.json`, `harbour-release-key.json`, Firebase admin JSON, `*.pem`, network captures (`*.har`, `*.mitm`) and `apps/backend/deploy/postgres/certs/`.

## Where things go

| Change | Look in |
| --- | --- |
| A new screen or flow | `apps/extension/src/popup/`; business logic in `src/core/`; worker handler in `src/background/handlers/` |
| Anything that signs or moves value | add or adjust a check in `src/core/harbour/policy.ts`; add a regression test |
| A new chain | [chains-and-providers.md](chains-and-providers.md) |
| A new provider or backend service | [backend-services.md](backend-services.md) ("Extending the backend") |
| A database change | a new numbered file in `apps/backend/migrations/` (never edit an applied one) |
| Deployment settings | `infra/railway/*.toml` and [deployment-railway.md](deployment-railway.md) |

## Rules enforced by tooling

- ESLint runs with `--max-warnings 0`; `tsc --noEmit` must be clean.
- `golangci-lint` with depguard blocks provider SDK imports outside `adapters/` and `cmd/`; `scripts/check-provider-names.sh` blocks provider names in service code.
- CI runs `go vet`, `go test -race`, `govulncheck`, `gosec`, `go mod tidy` drift check, the Docker image build (including the `SERVICE=bogus` entrypoint check), `npm audit` gate and a bundle secret scan.
- The popup must not import vault, key or wallet-core code (`test/boundaries.test.js`), and nothing returned to the popup may carry secrets.
- `go.mod` and `go.sum` must be tidy; provider names stay out of service code.

## Documentation

All documentation lives in `documentation/`; an app's own `README.md` is the only exception and should stay short and point here. When you change behaviour, ports, commands or environment variables, update the matching guide in the same pull request. Prefer editing a guide over adding a new file.
