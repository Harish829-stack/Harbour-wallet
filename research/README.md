# Research

Reverse-engineering material for the Trust Wallet extension (26.41.0). Nothing here is needed to build, test or deploy Harbour, except three chain-registry JSON files under `evidences/re-evidence/30-chain-registry/` that the extension's `test/chains.test.js` and chain generators read.

- `evidences/` – captured evidence per feature (`re-evidence/INDEX.md`), the supplied extension (git-ignored), network logs (git-ignored)
- `tools/` – analysis scripts; run them from the `research/` folder (they resolve `evidences/…` and `tools/…` from there)

Write-ups and findings are in `docs/trust-wallet-re/` (`analysis/` for findings, `architecture/` for the reference extension's architecture and the Harbour parity plan). `docs/_old-*-index.md` keep the original source links and dates. Many of these documents describe the retired `harbour-wallet-v2` and use its paths; they are historical context and are not kept in sync with the code.
