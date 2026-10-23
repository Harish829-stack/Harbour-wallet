# scripts/

Build, release and maintenance scripts for the extension. Run from `harbour-wallet-v2/`.

| Script | Purpose | Run by |
| --- | --- | --- |
| `prepare-wasm.mjs` | Copy the wallet-core WASM from `node_modules` into `public-production/` | `npm run build` |
| `build-inpage.mjs` | Bundle `src/inpage` into `public-production/inpage.js` | `npm run build` |
| `build-content.mjs` | Bundle `src/content` into `public-production/public-content.js` | `npm run build` |
| `verify.mjs` | Lint, type-check, tests, gateway check, build, secret scan | `npm run verify` |
| `check-rpc.mjs` | Probe every configured RPC endpoint | `npm run check:rpc` |
| `check-gateway.mjs` | Exercise every live gateway route and the code that consumes them | manual |
| `deploy-gateway.mjs` | Push secrets from `harbour-keys.env` and deploy the Cloudflare Worker | manual |
| `config-tool.mjs` | Sign and verify the remote config (`config/config.json`) | manual |
| `release.mjs`, `verify-release.mjs`, `repro.mjs`, `lib-zip.mjs` | Package, sign and reproducibly verify a release zip | manual (see `docs/harbour/RELEASE.md`) |
| `check-chains.mjs` | Probe extra chains' endpoints live (`--write` enables the passing ones) | manual |
| `gen-chain-registry.mjs`, `gen-extra-chains.mjs` | Regenerate chain registry data from the wallet-core reference in `evidences/` | manual |
| `fetch-chain-logos.mjs`, `import-assets.py` | Refresh chain logos and Harbour app icons (`brand/harbour-logo-source.png`) | manual |
