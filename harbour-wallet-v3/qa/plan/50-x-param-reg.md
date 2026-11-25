
## 14. Cross-cutting (X)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-X-001 | X-01 | PROP | P0 | — | every amount path (send, swap, earn, approvals, backend formatUnits/valueUSD) with values near 2^256-1 and decimals 0/18/36 | BigInt/big.Int exact; no Number() on wei; USD float only for display | ext-prop, be-prop |
| T-X-002 | X-01 | UNIT | P1 | — | grep-based lint: `Number(` / `parseFloat(` applied to wei/raw fields in core/** | none (or allow-listed display-only sites) | ext-unit |
| T-X-003 | X-02 | UNIT | P1 | fake clock at 23:59:59.999 UTC and month end, DST change in local TZ | daily counter key, partition month, reauth TTL, auto-lock alarm | UTC-based boundaries; local DST does not shift TTLs | be-unit, ext-unit |
| T-X-004 | X-02 | NEG | P1 | — | device clock skew exactly = ClockSkew and +1 s | accepted / rejected | be-unit |
| T-X-005 | X-03 | UNIT | P2 | — | formatFiat in ar, de, ja, zh-TC | locale-appropriate separators; RTL safe | ext-unit |
| T-X-006 | X-04 | PROP | P1 | — | JSON round trips of vault state, keystore export/import, cursor, PendingStore records | identity | ext-prop |
| T-X-007 | X-05 | MIG | P0 | fixtures of every stored-data version: v1 KDF, v1 passworder, store tuple v0, legacy secrets in storage.local, legacy passkey seal, legacy device seed, pre-PT-06 WC sessions, stored auto-lock 0 ('Never') | boot + unlock current build | all upgraded without loss; legacy artefacts removed | ext-int |
| T-X-008 | X-06 | UNIT | P1 | — | build flags × remote flags (killed provider, smartAccounts off) | features gated in both registration and handler re-check | ext-unit |
| T-X-009 | X-07 | SEC | P0 | — | scripts/api-url.mjs with http://non-loopback in production mode | build refused / HB_API_SECURE false ⇒ mainnet signing off | ext-unit |
| T-X-010 | X-08 | SEC | P1 | CI | npm audit gate (high/critical prod deps) and govulncheck | pass or documented exceptions (audit-exceptions.json) not expired | ext-unit, be-unit |
| T-X-011 | X-09 | CONC | P0 | — | (aggregate of T-KEY-019/023/052, T-BE-012/036, T-DB-003, T-IDX-009/015, T-DATA-009) | — | — |

## 15. Parameterised suites over the exhaustive index (Part C)

These suites guarantee that every generated inventory row (MSG-###, PM-###, RT-##, DBO-##, GOF-####, EXP-####) is exercised. They are table-driven: the table is generated from source by `qa/tools/gen-index.mjs`, so a new handler/method/route automatically joins the suite (a test fails if the generated table and the live registry differ).

| Test ID | Covers | Cat | Pri | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|
| T-MSG-001 | all MSG-001..160 | SEC | P0 | dispatch each message from a non-internal sender (content-script sender, other extension, http page) | `UNAUTHORIZED`, handler spy not called | ext-int |
| T-MSG-002 | all MSG | SEC | P0 | dispatch each message with `{}` body while locked and while unlocked | no throw escapes; response passes `uiSafe` (no SECRET_FIELD_BLOCKED); error strings pass `userText` | ext-int |
| T-MSG-003 | all MSG | PROP | P0 | fuzz each message with fast-check records (random types for every field read by the handler, prototype keys, huge strings) — 200 runs each in CI, 10k with HB_FUZZ_RUNS | no unhandled rejection; no storage write of secret keys to chrome.storage.local; response JSON-serialisable | ext-fuzz |
| T-MSG-004 | value-moving MSG (send*, swap*, earn*, defi*, perps*, prediction*, nftTransfer*, smartAccount*, approvalsRevoke, ledgerSend*) | SEC | P0 | invoke while locked | LOCKED/locked error; no RPC broadcast performed (fetch spy) | ext-int |
| T-MSG-005 | value-moving MSG | SEC | P0 | invoke for a chain where `isSigningChain` is false | refused before signing | ext-int |
| T-MSG-006 | registry | CON | P1 | compare live `listEvents()` after boot vs generated MSG table | equal sets (no unlisted handler) | ext-int |
| T-MSG-007 | grant-gated MSG (backupBegin, revealPrivateKey, copyPrivateKey, addWallet(non-first), qrSyncImport, removeWallet, passkeyEnroll, passkeyDisable, setSettings(weaken)) | SEC | P0 | invoke without grant, with expired grant, with grant for other wallet, with wrong-method grant | AUTH_REQUIRED in every case | ext-int |
| T-PM-001 | all PM-001..069 | NEG | P0 | each method with params: none, null, wrong type, oversized | spec-conformant error codes (-32602/-32600), never -32603 with stack | ext-int |
| T-PM-002 | PM with needsConnection | SEC | P0 | call from unconnected origin | 4100 | ext-int |
| T-PM-003 | PM with approval | SEC | P0 | call from connected origin; never approve (timeout/close) | approval window opened once (rate limited); outcome 4001 on reject/close; nothing signed | ext-int |
| T-PM-004 | PM local/rpc | UNIT | P1 | call each | result matches expected shape; rpc methods proxied only to the origin's chain | ext-int |
| T-PM-005 | all PM | PROP | P0 | fuzz params per method (fast-check `jsonValue`) through content→background | no crash, no approval opened for invalid params, no signature | ext-fuzz |
| T-PM-006 | all PM | E2E | P1 | Playwright fixture dApp invokes each method once | expected success/error per method table | ext-e2e |
| T-RT-001 | RT-06..24 (signed routes) | SEC | P0 | unsigned / bad signature / replayed | 401 for every route | be-int |
| T-RT-002 | all RT | NEG | P1 | wrong HTTP method for each path | 405 (chi) and JSON-free body; no handler execution | be-unit |
| T-RT-003 | all RT | CON | P1 | golden JSON schema per success and error response | matches | be-int |
| T-RT-004 | all RT | PROP | P0 | `go test -fuzz` per handler with random bodies/queries via httptest | no panics; no 500 except injected dependency failures | be-fuzz |
| T-RT-005 | all RT | PERF | P3 | 50 rps each for 10 s | p99 bounded; memory stable | be-perf |
| T-DBO-001 | all DBO-01..63 | MIG | P0 | after full migration: every table/index/function/role from the DBO list exists with the expected definition | exists; definitions match golden | db-mig |
| T-DBO-002 | all CHECK/UNIQUE/FK constraints in DBO list | INT | P1 | violation insert per constraint (generated) | rejected with the constraint name | be-int |
| T-GOF-001 | all GOF-0001..0627 | UNIT | P1 | coverage gate (Phase 5): every function executed by at least one test that asserts its behaviour; uncovered functions listed with justification in TEST_SUMMARY.md | ≥ 85 % line / ≥ 75 % branch on internal/api, devicesig, evmtx, store/devices; ≥ 70 % overall | be-unit, be-int |
| T-EXP-001 | all EXP-0001..1616 | UNIT | P1 | c8 coverage for core/** and background/** | same thresholds for core/vaultService, keySchedule, passworder, storage, provider/*, smartAccount/*, swap/safety | ext-unit, ext-int |

## 16. Regression tests (one per fix commit in `git log`, 2026-10-30 → 2026-11-19)

| Test ID | Commit | Cat | Pri | Behaviour pinned | Layer |
|---|---|---|---|---|---|
| T-REG-001 | 4f44aaa | REG | P2 | deployed API never returns a temporary tunnel URL as realtime URL (localhost/trycloudflare refused in non-local builds) | be-unit |
| T-REG-002 | ac9a470 | REG | P1 | Tron requests go through `/v1/gw/trongrid`; WalletConnect telemetry disabled in kit config | ext-unit |
| T-REG-003 | 61e9857 | REG | P2 | concurrent getBalances coalesced (T-CH-007) | ext-int |
| T-REG-004 | 4e40f64 | REG | P1 | capability reads cached; final batch status; receipt logs scoped to the user op hash (userOpLogs) | ext-unit |
| T-REG-005 | e4605c7 | REG | P2 | Solana getSupply allowed longer timeout; Cosmos tx search params; TzKT bakers parsing; dead Cosmos REST hosts removed | ext-unit |
| T-REG-006 | 5f4d4a9 | REG | P2 | Arbitrum Sepolia & Amoy history via Etherscan v2 gateway (T-DATA-003) | ext-int |
| T-REG-007 | 03e483b | REG | P1 | backend serving fewer chains → unserved marked, public RPC fallback, retry after 10 min | ext-unit |
| T-REG-008 | e839b99 | REG | P2 | protocol reads batched in Multicall3 | ext-unit |
| T-REG-009 | 3a43fdc | REG | P0 | getProgramAccounts restricted (T-GW-011) | be-unit |
| T-REG-010 | 9755b18 | REG | P0 | build refuses .env with secret (T-EXT-034) | ext-unit |
| T-REG-011 | d8221b9 | REG | P1 | NFT media only on request (T-DEFI-015) | ext-unit |
| T-REG-012 | 2b895b0 | REG | P0 | unpinned sponsorship refused on mainnets (T-GW-017) | be-unit |
| T-REG-013 | de98755 | REG | P0 | /v1/tx privacy (T-BE-054/055) | be-int |
| T-REG-014 | 7724fc8 | REG | P0 | QR scrypt cap (T-KEY-093); typed-data chainId warning (T-SIG-011); re-auth needed to unblock a site | ext-unit |
| T-REG-015 | b2dbc94 | REG | P0 | storage.local pinned to trusted contexts (T-EXT-008) | ext-int |
| T-REG-016 | b2b9770 | REG | P1 | undecodable/unpreviewable calls flagged; eth_simulateV1 allowed on /v1/rpc | ext-unit, be-unit |
| T-REG-017 | 0c1d006 | REG | P0 | strict JSON-RPC parse, validated body forwarded (T-GW-012 A1/A2) | be-unit |
| T-REG-018 | cf3c951 | REG | P1 | Uniswap no-Permit2 proxy with exact approvals | ext-unit |
| T-REG-019 | 0d78eb3 | REG | P0 | PT-01 (T-KEY-080), PT-03 (T-KEY-023), PT-04 (passkeyDisable needs manage grant), PT-05 (T-KEY-050), PT-08 (T-KEY-060/076), PT-11 (T-KEY-087) | ext-int |
| T-REG-020 | d2e8104 | REG | P0 | PT-02, PT-06 (T-DAPP-017), PT-07, PT-09, PT-10, PT-12 provider hardening — each finding's documented behaviour | ext-int |
| T-REG-021 | b26a725 | REG | P3 | hidden home layer inert (T-EXT-040) | ext-e2e |
| T-REG-022 | 68bcb51 / fb9c7e9 / 296961d | REG | P0 | Postgres TLS required (T-BE-084); clear error when certs missing | be-unit |
| T-REG-023 | 57ded23 | REG | P0 | keyed Redis tags, scrubbed broadcast replays, early device unlink, security headers, security-event logs (T-BE-029/030/001) | be-int |
| T-REG-024 | 320adc5 | REG | P1 | NAME_FILE secrets (T-BE-083) | be-unit |
| T-REG-025 | f4f5c94 | REG | P1 | realtime JWT audience (T-BE-067); migrate fails without harbour_app (T-BE-086) | be-int |
| T-REG-026 | 68d65cc | REG | P3 | legacy Cloudflare gateway is not deployed (ASM-14): the extension bundle and kit endpoints never reference a workers.dev / legacy gateway origin, so the fixed allowlist cannot be reached | ext-unit |
| T-REG-027 | fd7206e | REG | P1 | origin leads approval header; cross-wallet restore vectors | ext-unit |
| T-REG-028 | b05b9cc | REG | P1 | release key only from CI/KMS secret, no implicit key file (T-EXT-031) | ext-unit |
| T-REG-029 | a20239b | REG | P1 | install scripts disabled (.npmrc ignore-scripts), audit gate in verify | ext-unit |
| T-REG-030 | e09d05a | REG | P0 | biometric seal with PRF, user handle not secret (T-KEY-079/081) | ext-int |
| T-REG-031 | eba8c0f | REG | P3 | Home approvals link to full allowance scan | ext-e2e |
| T-REG-032 | 35a1ceb | REG | P0 | API responses validated & pinned to requested addresses (T-CH-008, T-DATA-012) | ext-unit |
| T-REG-033 | 0e37148 | REG | P0 | EVM signing with key bytes, zeroed on dispose (T-KEY-089) | ext-int |
| T-REG-034 | 316e5cb / c765527 | REG | P1 | backup gate on receive/buy/fund routes (T-EXT-036) | ext-e2e |
| T-REG-035 | c193d91 | REG | P1 | no Trust Wallet impersonation flags (T-DAPP-048) | ext-unit |
| T-REG-036 | def7f87 | REG | P1 | auto-lock 'Never' removed, cap 4 h, stored 0 migrated (T-KEY-036) | ext-unit |
| T-REG-037 | b2d7139 | REG | P0 | phishing block screen works; signed dApp RPC; prompted network switches (T-DAPP-036/025) | ext-int |
