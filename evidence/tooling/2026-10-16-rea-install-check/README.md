# REA installation check — 2026-10-16

User requested installation from https://github.com/morluto/rea.
Official instructions checked: https://github.com/morluto/rea/blob/main/docs/installation.md.

Existing global `rea-agents@6.5.0` on Node 22.22.3 was verified; no installation or configuration mutation was needed. `rea setup --client codex --dry-run --json` returned an empty action plan. `rea doctor --client codex --skill --json` returned scoped healthy=true and skill version 42 aligned. Global package.json SHA-256: `a500302319c1214a8bb6c9a8b4a4a090806e95eef884204a9d9fbb4003050a6c` (installed metadata checksum, not a package authenticity proof).

A live MCP `binary_session({})` responded as REA 6.5.0 with 207 tools and protocol 2025-06-18. No target was opened. Saved identity: `live-server-identity.json`.

Limits: doctor environment_healthy=false because optional native engines are absent/unconfigured and other clients have no REA registration. Codex checks pass; this is not proof that every analysis provider works. Registry latest lookup failed with sandbox DNS ENOTFOUND; latest release was not established. Existing pinned investigation toolchain was preserved. No wallet investigation or build work resumed.
