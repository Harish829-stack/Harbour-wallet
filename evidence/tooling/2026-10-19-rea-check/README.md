# REA check — 2026-10-19

Health/identity check of the live REA MCP server, run from the Cowork session via the
remote-devices REA bridge (not the Mac CLI; `rea` is a user-level nvm install at
`/Users/jatinsharma/.nvm/.../bin/rea` and is not reachable from the device Linux VM).

## Result: PASS — live server cryptographically aligned with the 2026-10-16 baseline

`binary_session` with expected identity returned `alignment.state = "aligned"` (no reasons).

| Field | 2026-10-16 baseline | 2026-10-19 | |
|---|---|---|---|
| package | rea-agents 6.5.0 | rea-agents 6.5.0 | match |
| command_path | /Users/jatinsharma/.nvm/versions/node/v22.22.3/bin/rea | same | match |
| catalog counts | 207 tools / 153 CLI / 6 prompts | 207 / 153 / 6 | match |
| combined_sha256 | 405725e736ec8dc8483435b970acbf20f9f26b9f1fd25203b992f5ab4cd2a4f4 | same | match |
| tools_sha256 | 805433f17bb4f709558ff20c04f96fe561fca2938fd0f459b1f8cc0f6b438ded | same | match |
| prompts_sha256 | 7152916ab48bd2a9677a5ad9cdbde0a51dc53c113934952ad096e93f5f18aa7e | same | match |
| skill | reverse-engineer-anything v42 | same | match |
| sdk | 2.3.1 | 2.3.1 | match |
| negotiated protocol | 2025-06-18 | 2025-11-25 | expected — different client host |
| client | codex-mcp-client | local-agent-mode-rea 1.0.0 | expected — Cowork session |

Server started_at 2026-10-19T12:58:16Z (fresh process).

## Analysis-engine / provider state (no target open)

Changes vs baseline doctor:
- **Ghidra 12.1.4 is now installed and detected** at `/Users/jatinsharma/tools/ghidra_12.1.4_PUBLIC`
  (Java 21 OK; headless + application.properties OK). Baseline had GHIDRA_INSTALL_DIR unset.
  BUT status is still `unavailable` / `executable_missing`: the native decompiler
  `Ghidra/Features/Decompiler/os/mac_arm_64/decompile` is not built, so decompilation won't run
  until that binary is produced. Disassembly-level ops would import but the decompiler is the gap.
- **JS source recovery** (`recover_javascript_sources`) is `provider_missing`: the live MCP server
  was launched without `REA_WAKARU_COMMAND` (the known limitation in AGENTS.md). `inspect_wasm_artifact`
  IS available. For JS recovery, use the CLI-with-env workaround or run Wakaru directly (as evidence 19–23 did).
- Hopper: not installed. IDA: not configured. (unchanged)

Available now (no target needed): native-macOS inspection, REA artifact graph, managed/.NET static,
Android + adb, frida (device/process listing), electron/web + browser capture, flutter, wasm inspect,
session/application tools (verify_reconstruction, evaluate_reconstruction_coverage, evidence bundles, etc.).

Most official-proxy disassembly ops report `target_required` — expected, no binary is open.
