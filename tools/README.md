# Pinned reverse-engineering tools

Installed and verified locally on 2026-10-15. No personal browser profile or real
wallet was used. Research remains pinned to supplied extension 26.41.0.

| Tool | Version / identity | Use |
|---|---|---|
| Node / npm | 22.22.3 / 10.9.8, already installed | CLI/build execution |
| REA CLI | rea-agents 6.5.0 | Static analysis, recovery/evidence, WASM adapter |
| Official REA source | tag `rea-agents-6.5.0`, commit `3b79af28e80785afce9f5998d8f03289402a1847` | Local docs/source at `vendor/rea/` |
| Wakaru | 1.14.0; native Mac binary and Linux binary in container | JS source recovery |
| WABT | 1.0.42, source tag 1.0.42, commit `ff0ef7e0009402740c805a9744c09b05be063e48` | wasm-validate, wasm-objdump, wasm2wat |
| Playwright / Chromium | 1.56.1 / 141.0.7390.37 (build 1194) | Isolated extension UI capture |
| Docker | Existing Desktop 4.63.0, Engine 29.2.1 | Linux x64 recovery required by REA adapter |

Sources: [official REA](https://github.com/morluto/rea),
[Wakaru](https://github.com/pionxzh/wakaru),
[WABT](https://github.com/WebAssembly/wabt),
[Playwright](https://github.com/microsoft/playwright).
Package distribution origins/integrity are in `toolchain/package-lock.json`.
Native file hashes: `../audit/tool-binary-hashes.json`. Container metadata:
`../audit/rea-linux-image.json`. Source commit IDs above pin tool source separately
from binary hashes; version strings alone do not prove a binary's source.

## Installation commands actually used

Run from the workspace root `/Users/jatinsharma/Desktop/REA`:

```sh
git clone --depth 1 --branch rea-agents-6.5.0 https://github.com/morluto/rea.git tools/vendor/rea
npm install --prefix tools/toolchain --save-exact rea-agents@6.5.0 @wakaru/cli@1.14.0 playwright@1.56.1
git clone --depth 1 --branch 1.0.42 https://github.com/WebAssembly/wabt.git tools/vendor/wabt
cmake -S tools/vendor/wabt -B tools/vendor/wabt/build -DBUILD_TESTS=OFF -DBUILD_LIBWASM=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build tools/vendor/wabt/build -j 4
PLAYWRIGHT_BROWSERS_PATH=/Users/jatinsharma/Desktop/REA/tools/browsers tools/toolchain/node_modules/.bin/playwright install chromium
docker build --platform linux/amd64 -t rea-wallet-re:6.5.0 tools/linux
```

Build base resolved to official `node:22.22.3-bookworm-slim` digest
`sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752`.
Installed image identity:
`sha256:8b8694b18f00e42c6bdf2a26eda3daad9c0ea2ee17c3f98464e0624438152403`.
Use that installed image identity for exact repeat runs. The Dockerfile pins
REA/Wakaru versions; a fresh image build can resolve different transitive or OS
packages. Export/freeze its dependency inventory before a new analysis baseline.

## Verified capabilities and limits

- `tools/rea --version`: 6.5.0. `tools/rea` supplies local WABT/native Wakaru paths
  and a workspace-local Darwin compiler cache. No global PATH changes required.
- macOS Wakaru prints 1.14.0, but REA 6.5.0's recovery adapter supports Linux x64
  only. `../audit/rea-recovery-probe.json` preserves that explicit diagnostic.
  Do not claim that configuring the Mac binary enables REA recovery.
- Linux x64 REA recovery succeeds with networking disabled and exact versions:
  old-slice smoke test `../audit/rea-linux-recovery-probe.json`; exact-target
  extraction/recovery `../evidences/re-evidence/01-install/2026-10-15-local/`.
  Executed Linux Wakaru SHA-256:
  `664fa06782a61eda7ed15885134b52525fd565dd77607e642062ceb6cd927c38`.
- All WABT banners are 1.0.42. Direct validation of shipped wallet-core succeeds;
  section summary is `../audit/wallet-core-sections.txt`.
- REA's WABT route succeeds on shipped sql-wasm:
  `../audit/rea-sql-wasm-probe.json`, evidence `ev_c6e4336e…`.
  Wallet Core is 10,362,000 bytes and exceeds REA's 8 MiB wrapper limit: use direct
  WABT and controlled execution of the byte-identical dependency, not a false
  “REA WASM inspection succeeded” claim.
- Playwright captures real reference and Harbour public onboarding screens with
  separate temporary profiles. `capture-first-run.mjs` deletes its temporary
  profile on completion and never creates a wallet.
- Native Ghidra/Android JADX are not required for this JS/WASM extension baseline;
  no new versions were installed. Doctor detected an existing external JADX JAR;
  Android/native analysis was not performed.

## Repeat exact install-feature recovery

The script extracts actual original byte ranges with explicit statement
separators; it does not execute target code or introduce mocked dependencies.

```sh
python3 tools/extract-install.py
node --check evidences/re-evidence/01-install/2026-10-15-local/install-entry-exact.js
docker run --rm --platform linux/amd64 --network none --cap-drop ALL --security-opt no-new-privileges \
  --mount type=bind,source=/Users/jatinsharma/Desktop/REA/evidences/re-evidence/01-install/2026-10-15-local,target=/output \
  sha256:8b8694b18f00e42c6bdf2a26eda3daad9c0ea2ee17c3f98464e0624438152403 \
  recover-javascript-sources /output/install-entry-exact.js /output/recovery-repeat --format json
```

REA output directories must be absent. Preserve each run separately. Do not run
Wakaru on the entire 42 MB background bundle; use exact slices and source mappings.

## Failures and resolution

1. Sandboxed network access could not resolve GitHub. Authorized download rerun
   succeeded. Initial source tag `v6.5.0` does not exist; `git ls-remote` established
   official tag `rea-agents-6.5.0`; source was then cloned at that tag.
2. `wabt@1.0.42` is unavailable in npm. Removed it from the npm request and built
   official WABT 1.0.42 from source rather than substituting a different version.
3. npm installed Wakaru's native package but did not expose a `.bin/wakaru` link;
   use the exact platform binary path recorded by REA.
4. REA recovery on Mac reports unsupported capability, as documented upstream.
   Docker socket access was sandbox-blocked; authorized Docker access verified
   the existing daemon. Built the official-tool Linux x64 image and reran the
   smallest failing recovery successfully. Runtime container has no network.
5. Initial REA WABT probe failed compiling the Darwin ownership helper under the
   sandbox. Authorized rerun succeeded. Direct WABT validation also succeeded.
6. First public UI capture missed the authentication option step and timed out.
   Inspected saved screen state, selected its actual “Password” button, reran
   successfully, then verified the automatic install tab without navigation.

## Agent integration state

The CLI and source are installed and usable now. `rea setup --client codex
--skill=false --dry-run` was inspected; its proposed global registration is
preserved in `../audit/rea-setup-plan.json`. That plan was **not applied** and no
global Codex configuration was changed. This chat does not expose a REA MCP tool;
REA operations here run through the CLI. MCP connection is a separate setup
step and requires correct host-specific capabilities/restart, not merely npm
installation. No unavailable capability is treated as verified.
