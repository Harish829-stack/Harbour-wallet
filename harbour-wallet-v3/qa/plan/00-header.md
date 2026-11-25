# TEST_PLAN.md — Phase 2 (Harbour Wallet v3)

Status: COMPLETE for Phase 2 (2026-11-19). Written from source/specs only; no existing test was read. Statuses (COVERED/WEAK/MISSING…) are added in Phase 3 (`TEST_GAP_REPORT.md`) and updated here in Phase 5.

## 0. Conventions

**Test ID** `T-<GROUP>-<NNN>`; groups follow FEATURE_INVENTORY Part A (KEY, SIG, DAPP, EXT, UX, SA, CH, DEFI, DATA, BE, GW, IDX, DB, X) plus parameterised suites over Part C (MSG, PM, RT, DBO) and regressions (REG).

**Categories** (column `Cat`): `UNIT` unit · `INT` integration · `E2E` end-to-end · `NEG` negative/abuse · `SEC` security · `PROP` property-based/fuzz · `KAT` cryptographic known-answer · `CONC` state/concurrency · `RES` resilience/fault injection · `MIG` migration/compatibility · `CON` contract/API · `PERF` performance/load · `UI` accessibility/UI · `REG` regression.

**Priority**: P0 fund-loss/security · P1 core function · P2 edge · P3 nice-to-have.

**Layers** (column `Layer`) and where the tests live (existing conventions first):
| Layer | Location | Runner | Notes |
|---|---|---|---|
| `ext-unit` | `apps/extension/test/*.test.js` | `node --test` (existing) | pure modules, chrome APIs faked at the boundary |
| `ext-int` | `apps/extension/test/integration/*.test.js` | `node --test` | real wallet-core WASM, real handlers/router, in-memory `chrome.*` + `fake-indexeddb` (new devDependency: needed to exercise the real IndexedDB secret store under Node) |
| `ext-prop` | `apps/extension/test/property/*.test.js` | `node --test` + `fast-check` (new devDependency: no property-based tool exists in the repo) | |
| `ext-fuzz` | `apps/extension/test/fuzz/*.test.js` | `node --test` + `fast-check` arbitraries (bounded runs in CI, long campaigns opt-in via env `HB_FUZZ_RUNS`) | |
| `ext-e2e` | `apps/extension/test/e2e/*.spec.mjs` | Playwright with the unpacked `dist/` (new devDependency `@playwright/test`: no browser runner exists; required for real MV3 flows) + local fixture dApp (`tools/e2e/dapp/index.html` exists) + local anvil-free mock RPC/backend | |
| `be-unit` | `apps/backend/**/x_test.go` | `go test -race ./...` (existing) | |
| `be-int` | `apps/backend/**/x_integration_test.go` | `go test` with `HB_TEST_POSTGRES_URL` / `HB_TEST_REDIS_URL` (existing convention, `make test-integration`) | real Postgres + Redis (containers), embedded NATS server (already a dependency) |
| `be-fuzz` | `apps/backend/**/fuzz_test.go` | native `go test -fuzz` (no new dependency); seed corpus runs on every `go test` | |
| `be-prop` | `apps/backend/**/prop_test.go` | `testing/quick` (stdlib) | |
| `db-mig` | `apps/backend/migrations/migrations_test.go` (build tag `integration`) | real Postgres 16 with and without pg_partman | |
| `be-perf` / `ext-perf` | `*_bench_test.go`, `test/perf/*.test.js` | `go test -bench`, `node --test` timing assertions (smoke level) | |

Mutation testing (Phase 5): StrykerJS for extension crypto/signing/permission modules; `gremlins` for Go `devicesig`, `evmtx`, `api/auth.go`, `api/gateway.go` parsers. Both are dev-only tools.

**Test data rules**: published vectors only (BIP-39/32/44 TREZOR vectors, EIP-155 example tx, EIP-191, EIP-712 "Mail" example, RFC 8032 Ed25519, RFC 9106 Argon2id, RFC 5869 HKDF, NIST AES-GCM), deterministic test mnemonic `abandon×11 about` and `test test … junk`; local mock RPC servers; no mainnet, no real keys, no real provider keys (backend tests use dummy keys and httptest upstreams).

## 0.1 Assumptions and flagged ambiguities (expected behaviour where the source is unclear)
| ID | Assumption (the test asserts this; if the product differs the test is marked expected-fail and logged in BUGS_FOUND.md) | Source |
|---|---|---|
| ASM-01 | The UI must never receive key material through ANY channel, including Redux patches on `harbour-ui` (AMB-02). | user rule "dumb UI" |
| ASM-02 | `PUT /me/addresses` must be atomic: if the add part is refused, removals and backfill budget must not be consumed (AMB-05). | API semantics |
| ASM-03 | eth_getLogs through `/v1/rpc` must require at least one concrete address or topic value; `[[null]]`/`[[]]` topic lists count as unfiltered (AMB-06). | handler comment |
| ASM-04 | Formatting functions must never panic or allocate unboundedly on hostile decimals (AMB-07): negative → treat as invalid, >77 → invalid. | robustness |
| ASM-05 | A revoked device may be served for at most 60 s by an API replica (AMB-08) — documented window, asserted as ≤ 60 s. | code comment |
| ASM-06 | A signed remote config without `expiresAt` is accepted (current behaviour) — flagged risk (AMB-11), test documents it; separate test asserts a config whose version < stored version is refused. | code |
| ASM-07 | Generated wallets: address set derived with an empty BIP-39 passphrase must equal the set derived from the mnemonic alone (AMB-12). | BIP-39 |
| ASM-08 | `accountPath` must equal Trust Wallet's per-coin rule; table pinned per coin from wallet-core default paths (AMB-13). | RE evidence |
| ASM-09 | eth_sign with a payload that is valid UTF-8 is signed with the EIP-191 personal prefix (TW parity, AMB-14). | code comment |
| ASM-10 | `vault.create` concurrency: at most one vault ever exists; second concurrent create fails with FORBIDDEN_REQUEST (AMB-03). | invariant |
| ASM-11 | `isPrivateNetworkUrl` is a best-effort literal check; DNS-rebinding names are accepted (AMB-15) — documented, not failed. | code comment |
| ASM-12 | Backend `evmtx.Sender` accepts high-s signatures (nodes reject later) — documented, P2 (AMB-17). | code |
| ASM-13 | Notification watcher only works while unlocked (AMB-01) — documented. | code |
| ASM-14 | Legacy `gateway/worker.ts` is out of scope beyond type-check and its own existing tests (README: not deployed). | README |
| ASM-15 | Duplicate INTERNAL handler names across modules must be impossible (AMB-04): a test asserts all handler maps have disjoint keys. | design intent |
| ASM-16 | Copy grant for an imported private key is reusable within 60 s (AMB-21) — documented. | code |
