# Harbour Wallet (REA repository)

Self-custody crypto wallet: a Chrome (Manifest V3) extension plus a Go backend. This repository also holds the reverse-engineering research the wallet was built from.

```
.
├── harbour-wallet-v3/        The product
│   ├── apps/extension/       Chrome MV3 extension (TypeScript, React, Vite)
│   ├── apps/backend/         Go services: api, rpc-gateway, indexer, webhook-ingest, price-poller, tx-tracker, notifier, realtime-bridge, migrate
│   └── infra/railway/        Railway config-as-code, one file per service
├── documentation/            Every document: product, architecture, security, operations, Trust Wallet RE write-ups. Start at documentation/README.md
├── research/                 Reverse-engineering material (not needed to build or deploy)
│   ├── evidences/            Captured evidence, extension reference copy, chain registry data
│   └── tools/                RE and verification scripts
├── scripts/git-hooks/        Pre-commit secret guard
└── .github/workflows/        CI: extension.yml, backend.yml; dependabot.yml
```

Secrets and local state (git-ignored, never committed): `harbour-keys.env`, `harbour-config-key.json`, `harbour-release-key.json`, the Firebase service-account file, every `.env`. `assets/` is a local clone of an icon library used only by `apps/extension/scripts/import-assets.py`. `_to_delete/` holds files taken out of the tree during the restructuring; delete it when you are happy.

## Quick start

Extension (Node 22):

```bash
cd harbour-wallet-v3/apps/extension
npm ci
cp .env.example .env.production   # fill in the public build settings
npm run build                     # dist/ -> chrome://extensions -> Load unpacked
npm run verify                    # lint, type-check, tests, build, audit gate, secret scan
```

Backend (Go, Docker):

```bash
cd harbour-wallet-v3/apps/backend
make setup && make up             # local stack with Docker Compose
make test                         # unit tests
```

Deploying the backend to Railway: [documentation/harbour-v3/operations/railway-deployment.md](documentation/harbour-v3/operations/railway-deployment.md).

Install the pre-commit guard once: `ln -s ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit`.
