# Harbour Wallet

Self-custody crypto wallet for Chrome (Manifest V3), built on `@trustwallet/wallet-core`, plus a small Cloudflare Worker gateway that holds provider API keys.

## Repository layout

| Path | What it is |
| --- | --- |
| `harbour-wallet-v2/` | The product: extension source (`src/`), gateway (`gateway/`), scripts, tests |
| `docs/` | All documentation. See [docs/README.md](docs/README.md) |
| `evidences/` | Reverse-engineering evidence, extension reference copy, network captures, audit data. See [evidences/README.md](evidences/README.md) |
| `tools/` | Reverse-engineering and verification scripts |

## Setup

Requires Node 22 and npm.

```bash
cd harbour-wallet-v2
npm ci
cp .env.example .env.production   # fill in the public build settings
npm run build                     # outputs dist/
```

Load the extension: open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select `harbour-wallet-v2/dist`.

For live development run `npm run dev`.

## Checks

```bash
npm run verify    # lint (zero warnings), type-check, tests, gateway type-check, production build, secret scan
npm run lint      # lint only
npm test          # unit tests only
npm run check:rpc # probe every configured RPC endpoint (needs internet)
```

## Gateway and secrets

Provider API keys never go into the extension. Copy `harbour-keys.env.example` to `harbour-keys.env` and fill it in. Gateway health: `GET /health`. Failover design and endpoint order: [docs/harbour/RELIABILITY.md](docs/harbour/RELIABILITY.md). They live in Cloudflare Worker secrets, set by `scripts/deploy-gateway.mjs` from a local `harbour-keys.env` kept at the repository root (git-ignored; never commit it). Signing keys (`harbour-config-key.json`, `harbour-release-key.json`) and service-account files are git-ignored in the same way.

## Releasing

See [docs/harbour/RELEASE.md](docs/harbour/RELEASE.md). Security model: [docs/harbour/SECURITY.md](docs/harbour/SECURITY.md).
