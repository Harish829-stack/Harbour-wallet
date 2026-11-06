# Evidences

Everything the reverse-engineering work is based on.

- `re-evidence/` — numbered per-feature evidence folders (specs, extracted data, status notes). `INDEX.md` lists them.
- `audit/` — integrity, inventory and tooling audit output (JSON, screenshots).
- `backend-research/` (+ `.zip`) — Trust Wallet backend research for version 26.41.0.
- `extension/` — the supplied extension package, its extracted reference copy, and samples. Git-ignored (large, third-party).
- `network-logs/` — HAR captures. Git-ignored: they contain session tokens and device identifiers. Never copy values from them into code or config.
- `reference/wallet-core/` — local clone of upstream wallet-core, used by `harbour-wallet-v2/scripts/gen-*.mjs`. Git-ignored.

Scripts in `../tools/` read and write these paths.
