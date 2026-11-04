# Harbour v3: attacker code review of 2026-11-04 (findings A1–A9) and their fixes

Scope: `harbour-wallet-v3` extension (`src/`) and the Go backend (`backend/internal/api`), reviewed read-only from an outside attacker's point of view at `068d8d4`. No live service was attacked. This file merges the original findings with what was done about them, so there is one place to read.

Status as of 2026-11-04: **A1–A8 are closed, A9 is open (housekeeping).** A7 was a false positive in the review (see below).

## Summary

| # | Sev | Area | Title | Status | Fix |
|---|-----|------|-------|--------|-----|
| A1 | HIGH | backend gateway | JSON-RPC allowlist on `/v1/gw/*` bypassed by case-variant or duplicate keys (Go parser differential) | Fixed | `gateway.go`: strict token-level parse; the gateway forwards the re-marshalled validated body, never the raw bytes |
| A2 | MED | backend gateway | Gateway allowed `eth_sendRawTransaction` and unbounded `eth_getLogs`, bypassing `/v1/tx` and `/v1/rpc` | Fixed | Raw broadcast removed from the gateway; `eth_getLogs` needs an address or topic filter and a bounded block range (at most 2000) |
| A3 | MED | approval screen | No balance-change preview on Harbour chains and an unknown contract call raised no warning | Fixed | `eth_simulateV1` allowed on `/v1/rpc`; new `unknownCall`, `simulationUnavailable` and `blindCall` warnings; `blindCall` is high risk (second acknowledgement) |
| A4 | MED | extension storage | `chrome.storage.local` writable from the content-script context | Fixed | `setAccessLevel('TRUSTED_CONTEXTS')` at worker boot; verified in real Chromium 153 |
| A5 | LOW | QR import | scrypt parameters from a scanned QR allowed about 2 GiB per key | Fixed | 64 MiB cap per key and a per-import work budget (2^26 of N*r*p) |
| A6 | LOW | typed data | Typed data without `domain.chainId` accepted silently (replayable on every chain) | Fixed (warning) | `noChainId` warning forces the acknowledgement and shows on the approval screen |
| A7 | n/a | typed data | Claimed: typed approval applies a chain switch without re-checking the connection chain | Not a finding | Already enforced: `needConn` compares the live connection chain with the chain bound when the request was queued. Regression test added, no code change |
| A8 | LOW | settings | Unblocking a site needed no re-auth | Fixed | `providerBlacklistRemove` consumes the one-shot `manage` re-auth; the popup prompts for it |
| A9 | INFO | hygiene | Release, config and Firebase admin keys sit in the REA root folder (git-ignored, untracked) | Open | Keep the release and config signing keys offline; rotate the Firebase key if the folder was ever synced |

## Findings and fixes

### A1 (HIGH): gateway allowlist bypass by parser differential
- Before: `jsonRPCGuard` unmarshalled the body into a struct and checked `Method`, then the gateway forwarded the original bytes. Go `encoding/json` matches keys case-insensitively and the last duplicate wins, so a body with `"method":"debug_traceTransaction"` followed by `"Method":"eth_chainId"` passed as `eth_chainId` while a case-sensitive upstream ran the first. Any registered device could then call any upstream method on Harbour's paid Alchemy, Helius and Pimlico keys. No user funds were at risk, but quota and cost were.
- Fix (`0c1d006` in the local nested repo, `bf56077` in the REA root repo): `parseRPCObject` rejects unknown, case-variant and duplicate keys, trailing data, and non-string or empty methods. `jsonRPCClean` validates a single object or a batch of at most 50 and returns the re-marshalled body that is forwarded to Helius, Alchemy and Pimlico.
- Tests: `gateway_rpc_guard_test.go` (unit) and `gateway_e2e_test.go` (a real registered device against the real handler stack with live Postgres and Redis, and a recording fake upstream). Refused bodies never reach the upstream; the control request arrives byte-exact as the rebuilt body.

### A2 (MED): gateway reopened what `/v1/rpc` and `/v1/tx` closed
- Before: the gateway allowlist included `eth_sendRawTransaction` and an unrestricted `eth_getLogs`, skipping the broadcast checks and the log policy.
- Fix: broadcasts only go through `/v1/tx`. `eth_getLogs` on the gateway follows the `/v1/rpc` rule (address or topic filter) plus a block range of at most 2000 (`blockHash` or explicit hex from and to).

### A3 (MED): no effect preview, and an unknown call was silent
- Before: `eth_simulateV1` was not in `rpc_allowed_methods`, so the approval view got `method_not_allowed` and set only `simulationUnavailable`, which counted toward neither `dangerous` nor `high`. A "Claim" drainer calling an unknown function was a one-click approval.
- Fix (`b2b9770`, mirrored in `931a0ad`): `config/api.yaml` allows `eth_simulateV1`. `view.ts` adds `unknownCall` (undecodable call to a contract), `simulationUnavailable` and `blindCall` (no preview and value above zero or an unknown call). `provider.tsx` labels them and treats `blindCall` as high risk.
- Deploy note: the running API container must be restarted to load `api.yaml`.
- Tests: `approval-preview.test.js` (5) and `TestDeviceFlow` extended to prove `eth_simulateV1` reaches the upstream through the real `/v1/rpc` with the real config.

### A4 (MED): state integrity in `chrome.storage.local`
- Before: PT-11 moved key material to IndexedDB, but settings, connections, the blacklist, prefs, custom networks and the unlock throttle stayed in `storage.local`, which content scripts can read and write by default. A renderer compromise could weaken protections without the handler re-auth.
- Fix: `chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })` at worker boot, next to the existing `storage.session` pin. The content script never uses storage.
- Verified in real Chromium 153 with the built extension: after boot a content script gets "Access to storage is not allowed from this context" for read and write; with the level forced open (control) the same script succeeds; the worker still reads. `storage-access.test.js` guards the pin.

### A5 to A8 (LOW)
- A5: `codeMatchesKey` refuses keys with `128*N*r` above 64 MiB and takes a per-import budget, wired through `qrImport.ts` and the `qrSyncImport` handler. A normal wallet-core key (N=2^14, r=8, p=4) still passes.
- A6: `typed.ts` adds `noChainId` when `domain.chainId` is missing, null or empty.
- A7: no change. `needConn` already refuses to sign when the connection chain differs from the bound chain, so the typed path cannot apply a stale switch. `provider.test.js` now pins the behaviour. The original review claim was wrong because it looked only at `execute` and missed the binding check.
- A8: `providerBlacklistRemove` consumes `manage` re-auth; `MANAGE_GUARDED` in `popup/api.ts` prompts for it.
- Tests: `audit-a5-a8.test.js` (5) plus the A7 test. With the A5, A6 and A8 fixes reverted in a throwaway copy, the new tests fail.

### A9 (INFO)
`harbour-release-key.json`, `harbour-config-key.json`, `harbour-keys.env` and the Firebase admin JSON are git-ignored and untracked, but sit beside evidence and zips. Keep the release and config signing keys offline; rotate the Firebase key if the folder was ever synced. This is a manual action.

## What held up
Internal router (exact popup URL only), vault (Argon2id with HKDF, serialized throttle, atomic re-key, IndexedDB key material), one-shot re-auth bound to a wallet, PRF-only platform biometrics, page request validation (`from` must be the connected account, `authorizationList` and `accessList` rejected, eth_sign off by default), worker-side signing of the pending record, the 800 ms arming delay, and the backend's allowlisted upstream paths, response cap and device-signed gateway calls.

## Not covered
Popup rendering and XSS sinks, Ledger, the WalletConnect bridge internals, Solana and multi-chain decoders, backend auth and broadcast (sound in the 2026-10-28 audit), indexer and notifier. A signed-in staging run of the A3 preview (real dApp, real chain) has not been done.

## Test environment
No Go on the device VM: Go tests run in `golang:1.26.10-alpine` through docker against the compose Postgres (`harbour_test` database) and Redis (DB 15). Extension tests and builds run in `node:22-alpine` on a copy of the repo, because the host `node_modules` holds macOS binaries. The extension suite passes except `chains.test.js`, which reads a file outside the repo.

## Where the commits live
The work was committed first in the nested local-only repo inside `harbour-wallet-v3/` (`0c1d006`, `b2b9770`, `b2dbc94`, `7724fc8`) and then recorded in the REA root repository, which tracks `origin/harbour-v3` (`bf56077` backend, `931a0ad` extension). Treat the root repository as the source of truth. See `docs/project/V3-STATUS.md`.
