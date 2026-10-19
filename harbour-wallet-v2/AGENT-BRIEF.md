# Harbour Wallet — shared brief for implementation workers (2026-10-19)

Goal (user mandate): Harbour = a fully functional, secure, modular Chrome-MV3 wallet that clones Trust Wallet v26.41.0 with **no screen left
unimplemented**, non-static data, Trust-Wallet-like architecture, public logos/assets. Read first: `../AGENTS.md` (2026-10-19 section),
`../UI-PARITY.md` (2026-10-19 table), `../DESIGN-SYSTEM.md` ("Current theme as found"), `BUILD-LOG.md` (newest entries), `evidence/INDEX` and `../evidence/INDEX.md`.

## Where things are / how to work
- Project: `$HOME/mnt/REA/harbour-wallet-v2` **on the user's Mac via `device_bash`** (your Read/Write/Edit tools see only the cloud workspace, NOT these files).
  Edit device files with `python3` read-modify-write, `sed -i`, or `cat > file <<'E' … E`. Never retype a whole big file; patch with unique anchors and re-read
  the region right before patching (other workers edit shared files concurrently).
- Verify with: `cd $HOME/mnt/REA/harbour-wallet-v2 && npx tsc --noEmit` and `npm test` (node --test). Do NOT run `npm run build` (the lead builds).
- No network except npm registry + github raw (public RPC/CoinGecko are blocked in this sandbox): implement against documented public APIs, **unit-test with mocked
  `fetch`**, and say "live-unverified" in docs. Never fabricate data. Never fall back to hard-coded prices/balances/lists.
- File deletion is allowed only for files you created. Never touch `../harbour-wallet/`, `../wallet-clone/`, the HAR files' contents (do not copy tokens/device ids/session ids).
- Use REA when a Trust Wallet behaviour is uncertain: TW extension is extracted at `../artifacts/reference-26.41.0/` (`chunks/*.js`, `background.js` 42 MB single line, `inpage.js`).
  Previously recovered readable code: `../evidence/NN-*/` and `evidence/NN-*/` (grep there first). REA MCP tools are `mcp__remote-devices__rea__*` (load via ToolSearch);
  `recover_javascript_sources` may be unavailable → fallback: `npm i -g @wakaru/cli@1.14.0` in the cloud container, stage the chunk (`device_stage_files`), run `wakaru file.js -o out.js`,
  write the result under `evidence/NN-<feature>/` (state honestly that Wakaru was run directly). For huge `background.js` carve a brace-balanced `node --check`-valid slice first.
  Cheap first pass: `grep -o` for i18n keys/strings/route names/endpoint paths in the chunk.
- TW's authenticated gateway (`gateway.us.trustwallet.com`, `*.twnodes.com`) is NOT used. Use public equivalents (name them + record the deviation). Public static files on
  `raw.githubusercontent.com/trustwallet/assets/...` are fine as data (e.g. validators lists, token lists, logos).

## Architecture rules
- `src/core/` = pure logic (no DOM/chrome APIs; injectable `fetch`), `src/background/` = service worker (router + `handlers/<feature>.ts` registered in `handlers/index.ts`),
  `src/popup/` = UI, `src/popup/wallet/features/<feature>.tsx` registers screens (`SCREENS_<feature>`) which are merged into `SCREENS`; `src/content/` + `src/inpage/` = provider bridge.
- Background handlers are reachable only from the extension's own UI (router enforces `isInternalWalletSender`); website-originated requests go through the provider allowlist only.
- Never put secrets (seed, password, private keys, keystores) into messages to the UI or logs. Signing happens in the background with wallet-core / viem.
- Public chains/assets come from `src/core/chains/index.ts` (86 chains; `chainById`, `addressFor`, explorer helpers, `/chains/<id>.png` logos). Add new per-family code under
  `core/chains/adapters/<kind>.ts` and register it (`registerBalanceAdapter`).
- Theme: use `T` (`src/popup/theme.ts`) / `--hb-*` CSS variables and the shared components in `src/popup/wallet/ui.tsx` (`Screen`, `Row`, `Btn`, `IconBtn`, `Coin`, `Empty`,
  `Skeleton`, `Sheet`…). No raw hex colors. Must work in dark mode. Keep Trust Wallet's screen structure/labels (evidence-backed), Harbour branding (name/logo only).
- Every screen needs real loading / empty / error states, keyboard focus, and no inert controls.
- Tests: add `test/<feature>.test.js` (node --test, esbuild-bundle pattern like `test/history.test.js`/`test/swap.test.js`).

## Documentation duties (update at each step)
- Append (never rewrite) a dated section to `BUILD-LOG.md` using `cat >> BUILD-LOG.md <<'E'` — what changed, files, deviations (public equivalent used), verification, NOT-verified list.
- Put specs/evidence under `evidence/NN-<feature>/` (use your assigned NN) incl. a `STATUS.md` listing each screen/flow: Real / Partial / Gap.
- Do not edit `../UI-PARITY.md` / `../rebuild-tracker.md` — the lead merges your STATUS.md into them.

## Final report (≤ 300 words)
What was built (screens/flows), key files, deviations from TW, tests/tsc results, what is still missing or live-unverified. Be honest; no completion claims without evidence.
