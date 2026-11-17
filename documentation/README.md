# Harbour documentation

Start here. Each guide has one job; read them in this order if you are new.

| Guide | Read it to |
| --- | --- |
| [how-to-run.md](how-to-run.md) | install the prerequisites, start the backend, build and load the extension, run the tests, fix common problems |
| [architecture.md](architecture.md) | understand how the extension and backend fit together and why, with the main request flows and the tech stack |
| [backend-services.md](backend-services.md) | learn what each Go service does, its API, ports, events, configuration and data, and how to extend it |
| [extension.md](extension.md) | find your way around the extension code, build settings, the dApp request path and key behaviours |
| [chains-and-providers.md](chains-and-providers.md) | see which chains are served and how, which providers are used, and how to add a chain |
| [security.md](security.md) | understand the security model, audit status, open items and the hardware test matrix |
| [deployment-railway.md](deployment-railway.md) | deploy the backend to Railway, service by service |
| [release.md](release.md) | cut a signed extension release and publish it to the Chrome Web Store |
| [contributing.md](contributing.md) | follow the branch, test, CI and documentation rules |

`media/harbour-demo.mp4` is a short demo of the wallet.

## Other places with documentation

- `SECURITY_FINDINGS.md` and `SECURITY_EXPLAINED.md` at the repository root record the 2026-11-16/17 security audit finding by finding (table and plain-language explanation); [security.md](security.md) summarises them.
- Each app has a short README that points back here: `harbour-wallet-v3/apps/extension/README.md`, `harbour-wallet-v3/apps/backend/README.md`, `harbour-wallet-v3/infra/railway/README.md`.
- `apps/extension/src/integrations/testnet-defi/README.md` describes the testnet Swap and Earn code.
- `apps/backend/.env.example` documents every backend environment variable; `apps/extension/.env.example` documents the build settings.
- `research/` holds the Trust Wallet reverse-engineering evidence and write-ups (`research/docs/`). It is not needed to build, run or deploy Harbour.

## Conventions

- Commands are written relative to the repository root unless a path starts with `apps/`.
- There are no secrets in this folder. Never paste real keys or tokens into a guide.
- Past versions of removed documents (build logs, plans, audit reports, earlier status pages) remain available in git history.
