
## 10. Backend API (BE)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-BE-001 | BE-01 | SEC | P0 | httptest server | any route | headers nosniff, DENY, no-referrer, CSP default-src 'none', no-store; HSTS only on TLS or trusted X-Forwarded-Proto | be-unit |
| T-BE-002 | BE-01 | NEG | P1 | — | body 1 MiB + 1 to signed route | 413 too_large (before signature work) | be-unit |
| T-BE-003 | BE-01 | SEC | P1 | handler panics | request | 500 JSON, no stack in body, process alive (Recoverer) | be-unit |
| T-BE-004 | BE-01 | SEC | P1 | log capture | request with query string + address in path | access log contains route pattern only (no query/addresses) | be-unit |
| T-BE-005 | BE-02 | RES | P1 | DB down / Redis down | GET /healthz | 503 'Database unavailable' / 'Cache unavailable' | be-int |
| T-BE-006 | BE-03 | INT | P0 | miniredis/real Redis | POST challenge | 32-byte b64url challenge, difficulty from config, expires_at = now+TTL; key hb:pow:<ch> with TTL | be-int |
| T-BE-007 | BE-03 | NEG | P0 | ChallengesPerHour=N | N+1 challenges same IP; same /64 IPv6 different host bits | 429 Retry-After 3600 on N+1 (IPv6 /64 shares bucket) | be-int |
| T-BE-008 | BE-04 | INT | P0 | challenge | solve PoW, sign registration message | 201, device_id UUID, probation tier quotas; DB row public_key 32 bytes | be-int |
| T-BE-009 | BE-04 | NEG | P0 | — | bad JSON; public_key not b64url / 31 bytes; attestation 4097 bytes; expired/unknown challenge; wrong PoW; counter '' or 21 chars; signature by other key; same challenge reused | 400 codes per path (bad_request/bad_key/challenge_expired/bad_pow/bad_signature); reuse → challenge_expired (GETDEL) | be-int |
| T-BE-010 | BE-04 | NEG | P1 | key already registered | register again | 409 already_registered | be-int |
| T-BE-011 | BE-04 | SEC | P0 | RegistrationsPerHour=2 | 3 valid registrations | 3rd 429 busy; failed PoW attempts do NOT consume the ceiling (finding 22) | be-int |
| T-BE-012 | BE-04 | CONC | P1 | — | same solved challenge submitted twice concurrently | exactly one 201 | be-int |
| T-BE-013 | BE-05 | UNIT | P1 | — | effectiveTier(default, created now/old/zero), (trusted, any) | probation / default / probation / trusted | be-unit |
| T-BE-014 | BE-06 | INT | P0 | registered device | valid signed GET /v1/me | 200 with device id | be-int |
| T-BE-015 | BE-06 | SEC | P0 | — | missing each header; device not UUID / uppercase UUID; nonce 15/65 chars/illegal char; date non-numeric; date ±(skew+1 s); signature altered; body altered after signing; query altered; method altered | 401 unauthorized / clock_skew; never 200 | be-int |
| T-BE-016 | BE-06 | SEC | P0 | — | replay identical signed request (same nonce) within window | second → 401 (auth_replay event logged) | be-int |
| T-BE-017 | BE-06 | SEC | P0 | device revoked in DB | request; then after 61 s (fake clock) | 401 device_revoked at the latest after cache expiry (ASM-05) | be-int |
| T-BE-018 | BE-06 | SEC | P0 | — | unknown device id with valid format | 401 device_unknown; counts toward auth-failure budget | be-int |
| T-BE-019 | BE-06 | NEG | P0 | — | 31 failures from one IP for unseen devices | 31st → 429 before DB lookup (spy store); a device already cached on that IP still served | be-unit |
| T-BE-020 | BE-06 | SEC | P1 | — | authFailures map > 50k keys | reset without unbounded growth | be-unit |
| T-BE-021 | BE-06 | KAT | P0 | — | devicesig.Canonical golden vectors (shared with T-CH-013); Verify with RFC 8032 test-vector keys | exact strings; true/false | be-unit |
| T-BE-022 | BE-06 | PROP | P0 | — | random method/path/body/nonce | Verify(Sign(canonical)) true; any single-byte mutation → false | be-prop |
| T-BE-023 | BE-06 | PROP | P1 | — | fuzz deviceAuth with random header values | never panics; never 200 without valid sig | be-fuzz |
| T-BE-024 | BE-07 | INT | P1 | tier RPM=5 | 6 requests in a minute; next minute | 6th 429; resets | be-int |
| T-BE-025 | BE-07 | UNIT | P1 | real Redis | dailyCounter over limit | returns false and rolls back increment; TTL set once | be-int |
| T-BE-026 | BE-08 | INT | P0 | — | PUT /me/addresses with Idempotency-Key twice same body | second replays status with `{"replayed":true}`, header Idempotent-Replay | be-int |
| T-BE-027 | BE-08 | NEG | P0 | — | same key different body; key 129 chars; concurrent same key | 422 idempotency_mismatch; 400; 409 in_progress | be-int |
| T-BE-028 | BE-08 | RES | P0 | handler returns 500/429/409 or panics | retry same key | key released, retry executes | be-int |
| T-BE-029 | BE-08 | SEC | P0 | broadcast idempotent replay | inspect Redis value | only tx_hash/status/error kept (no channel/token); keys are HMAC tags, not raw device id or key | be-int |
| T-BE-030 | BE-09 | SEC | P1 | log capture | auth failures | security_event lines carry tags only (no IP, sig, body, raw device id) | be-unit |
| T-BE-031 | BE-10/11 | CON | P1 | — | GET /me, /me/addresses | JSON schema (fields, types) stable | be-int |
| T-BE-032 | BE-12 | INT | P0 | — | add 3 EVM addresses (mixed case), remove 1 | normalised lowercase, deduped; device_count maintained; address.added only for newly tracked; link rows encrypted (no plaintext address/device association in device_addresses) | be-int |
| T-BE-033 | BE-12 | NEG | P0 | — | 0 or 101 changes; non-EVM chain; invalid address; unknown chain | 400 messages | be-int |
| T-BE-034 | BE-12 | SEC | P0 | MaxAddresses=2 | add 3 | 403 quota_exceeded; tx rolled back (no tracked rows/links/device_count changes) | be-int |
| T-BE-035 | BE-12 | NEG | P1 | (ASM-02) | request removing A and adding over-quota B | expect atomic (A still linked; backfill counter unchanged) — currently removal persists → expected-fail + BUGS_FOUND | be-int |
| T-BE-036 | BE-12 | CONC | P0 | MaxAddresses=5 | 10 parallel PUTs each adding 1 new address | ≤5 links total (FOR UPDATE serialisation) | be-int |
| T-BE-037 | BE-12 | NEG | P1 | BackfillsPerDay=2 | add 3 untracked | 429 backfill_quota; deny-listed addresses don't count | be-int |
| T-BE-038 | BE-13 | INT | P0 | fake rpc-gateway | eth_blockNumber single & batch | forwarded re-marshalled body, X-HB-Priority user, bearer token, session scoped `<device>:<sess>` | be-unit |
| T-BE-039 | BE-13 | SEC | P0 | — | method not allowlisted (debug_traceTransaction, eth_sendTransaction, personal_*); batch > MaxBatch; empty batch; invalid JSON | JSON-RPC error method_not_allowed / bad_request; nothing forwarded | be-unit |
| T-BE-040 | BE-13 | SEC | P0 | — | eth_getLogs without address/topic; topics [null]; [[]]; [[null]] (ASM-03); duplicate/differently-cased keys ADDRESS/address; extra keys | refused; `[[null]]` expected refused → BUG if forwarded | be-unit |
| T-BE-041 | BE-13 | SEC | P1 | gateway returns error.data.upstreamsTried | call | field stripped (single & batch) | be-unit |
| T-BE-042 | BE-13 | NEG | P1 | gateway returns 8 MiB+1 | call | response_too_large | be-unit |
| T-BE-043 | BE-13 | RES | P1 | gateway down | call | gateway_unavailable retryable | be-unit |
| T-BE-044 | BE-13 | NEG | P1 | RPCPerMinute=3 | batch of 4 | 429 rate_limited (batch counts per call) | be-int |
| T-BE-045 | BE-13 | PROP | P0 | — | fuzz handleRPC body | never panics; forwarded body always valid JSON-RPC with allowlisted methods | be-fuzz |
| T-BE-046 | BE-14..18 | SEC | P0 | device A tracks X; device B tracks Y | B requests portfolio/history/nfts with addresses=chain:X | 403 not_tracked (no IDOR) | be-int |
| T-BE-047 | BE-14 | INT | P1 | seeded balances/prices | portfolio | values = amount/10^dec × price; spam assets flagged; cache hit second time (X-HB-Cache) keyed per device | be-int |
| T-BE-048 | BE-14 | SEC | P1 | two devices same query string | portfolio | cache keys differ (no cross-device cache bleed) | be-int |
| T-BE-049 | BE-16 | INT | P1 | seeded activity | history paging with cursor, limit bounds (0, 1, max, max+1) | stable ordering by block_time desc, tx_hash; no duplicates across pages | be-int |
| T-BE-050 | BE-16 | NEG | P1 | — | cursor not base64 / not JSON / missing tx_hash | 400 bad cursor | be-int |
| T-BE-051 | BE-16 | PROP | P2 | — | encodeCursor/decodeCursor round-trip | identity | be-prop |
| T-BE-052 | BE-17 | INT | P2 | — | nfts with dirty flag | sync requested; media keys point to /v1/media | be-int |
| T-BE-053 | BE-18 | NEG | P2 | — | unknown asset, invalid chain, invalid range | 404/400 | be-int |
| T-BE-054 | BE-19 | SEC | P0 | tx indexed involving X (tracked by A) | B queries /v1/tx | chain view only (source 'chain'), no transfer amounts (SEC-2026-11-18-02) | be-int |
| T-BE-055 | BE-19 | SEC | P0 | tx broadcast by A pending | B queries | not 'pending' source (no Harbour-origin leak) | be-int |
| T-BE-056 | BE-19 | NEG | P1 | — | hash uppercase / 63 hex / no 0x; unknown chain | lowercase accepted; 400 otherwise | be-unit |
| T-BE-057 | BE-20 | INT | P0 | fake gateway | estimate EIP-1559 chain and legacy chain; gas = 21000 / other | fees per formula; +20% buffer except 21000; chain_id from config | be-unit |
| T-BE-058 | BE-20 | NEG | P0 | — | from not tracked; to invalid; value negative/0x-hex/2^256; data odd/too large (>128 KiB); non-EVM chain | 403 not_tracked / 400 | be-unit |
| T-BE-059 | BE-20 | RES | P1 | estimateGas returns revert; tip call fails | estimate | 422 would_fail; default tip 1 gwei used | be-unit |
| T-BE-060 | BE-21 | INT | P1 | simulator stub returns changes / ErrUnsupported / error | simulate | full mode with formatted amounts / basic mode / basic mode + warn log | be-unit |
| T-BE-061 | BE-22 | INT | P0 | signed EIP-1559 tx from tracked address | broadcast | 200 tx_hash = keccak(raw) lowercase; pending row; tx.status event; channel token when realtime secret set | be-int |
| T-BE-062 | BE-22 | SEC | P0 | — | tx signed for other chain id; pre-EIP-155 legacy tx; tx from untracked address; malformed raw; type 5 envelope | 400 wrong_network / wrong_network / 403 not_tracked / 400 bad_transaction | be-unit |
| T-BE-063 | BE-22 | RES | P1 | node replies 'already known' | broadcast | 200 with locally computed hash | be-unit |
| T-BE-064 | BE-22 | SEC | P1 | node returns different hash | broadcast | local hash used, warning logged | be-unit |
| T-BE-065 | BE-22 | RES | P1 | InsertPending fails after send | broadcast; retry with same Idempotency-Key | 500 then retry → already known → 200 (no double-send harm) | be-int |
| T-BE-066 | BE-22 | NEG | P1 | — | 11 broadcasts in a minute | 11th 429 | be-int |
| T-BE-067 | BE-23 | SEC | P0 | device tracking X, pending tx T | realtime token | subscription tokens only for balances:X and tx:T; JWT HS256 with aud 'harbour-realtime', exp=1 h, sub=device | be-int |
| T-BE-068 | BE-23 | KAT | P1 | — | SignHS256 vs independent HMAC-SHA256 JWT construction (RFC 7515 A.1 key) | identical | be-unit |
| T-BE-069 | BE-25 | SEC | P0 | — | push endpoint http://, non-push host, `fcm.googleapis.com.evil.com`, IP literal, >1024 chars; p256dh 64 bytes; auth 15 bytes | 400 bad_subscription | be-unit |
| T-BE-070 | BE-25 | INT | P1 | — | PUT then addresses change then DELETE | routes synced to route tags; delete removes sub+routes | be-int |
| T-BE-071 | BE-26 | SEC | P0 | media key whose source resolves to 127.0.0.1 / 10.x / 169.254.169.254 / [::1] / 100.64.x / 64:ff9b::a00:1 | GET media | 404 and negative cache 1 h; dialer never connects (Control hook) | be-unit |
| T-BE-072 | BE-26 | SEC | P0 | public host redirects to private IP / to file:// / 4 redirects | GET | refused | be-unit |
| T-BE-073 | BE-26 | SEC | P0 | — | SVG, HTML, 10 MiB+1, 5000×5000 PNG (25 Mpx), GIF bomb header, WebP | refused permanent (no decode of oversized) / WebP accepted | be-unit |
| T-BE-074 | BE-26 | UNIT | P1 | 1024×512 PNG | GET | PNG 512×256; headers image/png, immutable cache, CSP sandbox, nosniff | be-unit |
| T-BE-075 | BE-26 | NEG | P1 | — | key not 32 hex; unknown key; 601 requests/min/IP | 404 / 404 / 429 | be-int |
| T-BE-076 | BE-26 | CONC | P2 | — | 10 concurrent cold fetches | ≤4 concurrent decodes; others wait ≤5 s then 503 | be-unit |
| T-BE-077 | BE-26 | RES | P1 | client disconnects mid-fetch | then another client | fetch completes on own deadline; not negatively cached | be-unit |
| T-BE-078 | BE-26 | PROP | P1 | — | fuzz fetchImage decode with random bytes (served by httptest) | never panics | be-fuzz |
| T-BE-079 | BE-27 | UNIT | P1 | — | normalizeAddress for evm valid/invalid/unknown chain/non-evm | lowercase / errors | be-unit |
| T-BE-080 | BE-28 | SEC | P0 | TrustProxy on, trusted 10/8 | XFF spoofed by client direct (untrusted peer); XFF chain 'evil, client, 10.0.0.2' from 10.0.0.1 | untrusted peer: RemoteAddr unchanged; trusted: right-most untrusted hop = client | be-unit |
| T-BE-081 | BE-28 | UNIT | P1 | — | clientIP IPv4, IPv6 → /64, unparsable | per rule | be-unit |
| T-BE-082 | BE-29 | UNIT | P1 | temp config dir | Load valid; missing file; bad YAML; unknown chain in ENABLED_CHAINS; tier missing; provider key ref missing | config / errors from validate() | be-unit |
| T-BE-083 | BE-29 | SEC | P1 | — | LoadSecretFiles with NAME_FILE pointing to file; DecodeKey hex/base64 shorter than min | env populated; error | be-unit |
| T-BE-084 | BE-30 | SEC | P0 | — | requireTLS host remote + sslmode disable / require (no verify) / verify-full; loopback; socket; HB_ALLOW_INSECURE_DB=1 | refuse / refuse / ok / ok / ok / ok | be-unit |
| T-BE-085 | BE-31 | INT | P0 | fresh Postgres | migrate; run again | all versions applied once; second run applies none | db-mig |
| T-BE-086 | BE-31 | NEG | P1 | migration user without CREATEROLE | migrate | exits non-zero unless HB_ALLOW_MISSING_APP_ROLE=1 | db-mig |
| T-BE-087 | BE-32 | UNIT | P3 | — | hbclient TS & Go client canonicalisation | equals devicesig golden | be-unit |
| T-BE-088 | BE-01..28 | PERF | P2 | Postgres+Redis | 200 rps signed GET /v1/me for 30 s | p99 < 100 ms locally; no goroutine leak | be-perf |
| T-BE-089 | BE-04 | PERF | P3 | — | registration PoW at difficulty 20 | JS solvePow < 10 s on CI; Go CheckPow O(1) | ext-perf |
| T-BE-090 | BE-01..28 | CON | P1 | — | every error response | shape {"error":{"code","message","retryable"}}; messages user-presentable (no Go error text) | be-unit |

## 11. Third-party gateway (GW)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-GW-001 | GW-01 | INT | P1 | — | gw quota exceeded | 429 Retry-After 30 | be-int |
| T-GW-002 | GW-02 | UNIT | P2 | config set / unset | /v1/gw/v1/config | 200 {config,signature} cache 300 / 404 no_config | be-unit |
| T-GW-003 | GW-03 | UNIT | P1 | fake CoinGecko | ids with invalid entries, 150 ids, none | invalid dropped; ≤100 sorted; '{}' without upstream call; post-processing to {price,change} | be-unit |
| T-GW-004 | GW-04 | NEG | P1 | — | coin 'BTC' uppercase, '../x', days '2'; tickers vs_currency eur, order 'x;y' | 400 | be-unit |
| T-GW-005 | GW-05 | SEC | P1 | — | /gt/ paths with '..', encoded slashes, long ids; query keys outside list; values with '&' | 404/400 | be-unit |
| T-GW-006 | GW-06 | NEG | P2 | — | /rss/unknown, POST | 404 | be-unit |
| T-GW-007 | GW-07 | SEC | P0 | fake LI.FI | path outside regex; query > 2048; PUT method | rejected; API key header added only to LI.FI host; key scrubbed from response body | be-unit |
| T-GW-008 | GW-08 | SEC | P0 | key set | body chainId 1; tokenInChainId 11155111 & tokenOutChainId 1; nested quote.chainId 1 at depth 3; depth 13; no chain id; non-numeric chainId; query string present | rejected; only all-Sepolia bodies forwarded | be-unit |
| T-GW-009 | GW-09 | NEG | P1 | — | jup search with 2 params / long query / special chars | 400 | be-unit |
| T-GW-010 | GW-10 | NEG | P1 | — | relay/thornode path variants, thor tx status non-hex | 400/404 | be-unit |
| T-GW-011 | GW-11 | SEC | P0 | — | Helius getProgramAccounts for Token program; Stake program without memcmp; memcmp at offset 0; staker offset 12 with own address | refused / refused / refused / forwarded (SEC-2026-11-19-01) | be-unit |
| T-GW-012 | GW-12 | SEC | P0 | — | alchemy rpc: method `debug_traceCall`; body {"method":"debug_x","Method":"eth_chainId"} (A1); duplicate "method" keys; trailing data; non-string method; batch 51; eth_getLogs span 2001; fromBlock 'latest'; blockHash+range | all refused; forwarded body always rebuilt from validated fields | be-unit |
| T-GW-013 | GW-12 | INT | P1 | chain served by rpc-gateway | alchemy/<served id>/rpc | routed to rpc-gateway with bearer token, upstreamsTried stripped | be-unit |
| T-GW-014 | GW-13 | NEG | P1 | — | nft method not in list; >24 params; value with '/' | rejected | be-unit |
| T-GW-015 | GW-14 | SEC | P0 | — | etherscan module/action not allowed; apikey param supplied by caller; chainid non-digit; 9 values for one key; 201-char value | rejected / caller apikey replaced by server key | be-unit |
| T-GW-016 | GW-15 | NEG | P1 | — | trongrid path outside regex (case-insensitive variants allowed); toncenter unknown method | 403 not_allowed | be-unit |
| T-GW-017 | GW-16 | SEC | P0 | no policy configured | pm_sponsorUserOperation on chain 1 / 11155111 | 403 sponsorship_not_configured / forwarded | be-unit |
| T-GW-018 | GW-16 | SEC | P0 | policy 'sp_abc' | client context {sponsorshipPolicyId:'attacker'} and extra fields | forwarded params = [userOp, entryPoint, {sponsorshipPolicyId:'sp_abc'}] only | be-unit |
| T-GW-019 | GW-16 | NEG | P1 | policy with invalid chars | sponsor call | 400 (fail closed) | be-unit |
| T-GW-020 | GW-17 | PROP | P0 | — | fuzz parseRPCObject / jsonRPCClean | never panics; accepted ⇒ re-marshalled output parses to same method/params and only allowed methods | be-fuzz |
| T-GW-021 | GW-18 | PROP | P0 | — | fuzz canonLogFilter | accepted ⇒ exactly the 5 known keys max, each once | be-fuzz |
| T-GW-022 | GW-19 | SEC | P0 | upstream echoes API key in body / error | call | key scrubbed (scrubBytes) | be-unit |
| T-GW-023 | GW-19 | RES | P1 | upstream 401/403 | call | 502 (not 401 to device) | be-unit |
| T-GW-024 | GW-19 | RES | P1 | upstream > 4 MiB; timeout; 500 | call | bounded read / 502 upstream_unavailable | be-unit |
| T-GW-025 | GW-19 | INT | P1 | cache Redis | cacheable GET twice | second served from cache (X-HB-Cache hit) with same body/status | be-int |
| T-GW-026 | GW-* | CON | P1 | — | table test over every documented route × allowed method → resolves; × other methods → rejected | full route matrix | be-unit |

## 12. RPC gateway, indexer, ingest and workers (IDX)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-IDX-001 | IDX-01 | SEC | P0 | token set | /rpc, /status, /metrics without/with wrong/with right Bearer; /healthz | 401/401/200; healthz open | be-unit |
| T-IDX-002 | IDX-01 | SEC | P1 | token empty, GATEWAY_ALLOW_NO_TOKEN unset | start rpc-gateway main | exits non-zero | be-int |
| T-IDX-003 | IDX-02 | UNIT | P1 | fake members with heads/latency/breakers | pick with minBlock, exclusions, stale heads; pinned session | highest score eligible; pinned member reused until unhealthy | be-unit |
| T-IDX-004 | IDX-03 | RES | P1 | slow first upstream | user-facing call | hedge after delay to second; first success wins; tried list recorded | be-unit |
| T-IDX-005 | IDX-04 | UNIT | P1 | fake clock | breaker open/half-open/close transitions; bucket refill/take/wait | per state machine | be-unit |
| T-IDX-006 | IDX-05 | UNIT | P0 | — | cachePolicy for blockNumber, getBlockByNumber('latest'/finalized number/hash), getTransactionReceipt null, eth_call at latest, getLogs ranges beyond finalized | never cache non-final/null results forever; finalized immutable cached forever | be-unit |
| T-IDX-007 | IDX-05 | PROP | P1 | — | parseBlockRef fuzz | no panic | be-fuzz |
| T-IDX-008 | IDX-05 | UNIT | P2 | — | LRU max size eviction | bytes bounded | be-unit |
| T-IDX-009 | IDX-06 | CONC | P1 | — | 50 identical concurrent calls | one upstream call; each caller gets an independent copy (mutating one doesn't affect others) | be-unit |
| T-IDX-010 | IDX-07 | RES | P0 | members: one rejects 'already known', one errors | broadcast | success result; isAlreadyKnown patterns | be-unit |
| T-IDX-011 | IDX-08 | UNIT | P1 | — | getLogs range 10k background vs user-facing | background split into chunks; user-facing never split | be-unit |
| T-IDX-012 | IDX-09 | RES | P1 | head poll errors / stale | LocalHead | false when stale; BestHead excludes open breakers | be-unit |
| T-IDX-013 | IDX-10 | UNIT | P1 | — | BuildURL with key placeholders; ParseQuantity edge (0x, 0x0, non-hex, >64-bit) | URL; errors; no key in error strings (snippet) | be-unit |
| T-IDX-014 | IDX-11 | INT | P0 | Postgres + fake source | backfill new address; dormant address; failing source | done with synced_to; dormant state; failed with error, retried | be-int |
| T-IDX-015 | IDX-11 | CONC | P0 | two indexer workers | ClaimBackfill concurrently | each job claimed once (SKIP LOCKED or equivalent) | be-int |
| T-IDX-016 | IDX-12 | INT | P0 | — | IngestEvents same events twice; events across two months; event in month without partition | idempotent (event_keys); partitions created on demand; amounts NUMERIC exact | be-int |
| T-IDX-017 | IDX-12 | NEG | P0 | — | event with amount '-1', '1.5', 'abc', 79 digits | rejected by validAmount; batch not corrupted | be-int |
| T-IDX-018 | IDX-12 | PROP | P1 | — | random event batches | per-address balance projection = Σ in − Σ out (never negative for fixture histories); activity rows unique | be-int |
| T-IDX-019 | IDX-13 | UNIT | P2 | fake clock | debouncer trigger bursts, flush | coalesced refresh with merged refs | be-unit |
| T-IDX-020 | IDX-14 | SEC | P1 | — | MediaKey(src) with secret | 32 hex, keyed (differs with secret), deterministic | be-unit |
| T-IDX-021 | IDX-15 | INT | P1 | fake provider webhooks API | subscribe/unsubscribe batching; signing key stored encrypted (SecretBox) | rows & tracked_addresses.webhook_id updated | be-int |
| T-IDX-022 | IDX-16 | INT | P1 | — | HandleDelivery valid payload | ingest, promote dormant, NFTs marked moved, incoming published | be-int |
| T-IDX-023 | IDX-17 | INT | P1 | heartbeat older than DownAfter | ingest Start | gap-fill request published | be-int |
| T-IDX-024 | IDX-18 | INT | P0 | indexed tx whose block hash changed (reorg) | Repair | events removed & re-ingested at new block; balances refreshed; finalized marked | be-int |
| T-IDX-025 | IDX-19 | UNIT | P1 | — | (T-UX-014 backend part) | — | be-unit |
| T-IDX-026 | IDX-20 | SEC | P0 | webhook with key K | delivery with valid HMAC; wrong HMAC; missing header; non-hex; unknown webhook id; body > 8 MiB | 200 / 401 / 401 / 401 / 401 / 413 | be-int |
| T-IDX-027 | IDX-20 | SEC | P0 | — | authentic delivery whose first event is older than replay window | 200 but not published (ignored) | be-int |
| T-IDX-028 | IDX-20 | RES | P1 | JetStream publish fails | delivery | 503 (provider retries); retry republishes | be-int |
| T-IDX-029 | IDX-20 | KAT | P1 | — | Alchemy signature example (HMAC-SHA256 hex of body) | verifies | be-unit |
| T-IDX-030 | IDX-20 | PROP | P1 | — | fuzz WebhookID/ParseWebhook | never panics | be-fuzz |
| T-IDX-031 | IDX-21 | INT | P1 | pending rows | tracker RunOnce with receipts success/fail/none; nonce consumed by other tx | confirmed/failed/backoff/replaced|dropped; events published | be-int |
| T-IDX-032 | IDX-22 | UNIT | P1 | — | notifier safeSymbol (control chars, long), displayAmount, chainLabel | sanitized | be-unit |
| T-IDX-033 | IDX-22 | RES | P1 | push endpoint 410 Gone | deliver | subscription removed | be-int |
| T-IDX-034 | IDX-23 | INT | P1 | — | price poller with source priority & failures | falls back to next source; ticks inserted; cache updated | be-int |
| T-IDX-035 | IDX-24 | INT | P2 | fake Centrifugo | bridge publish | correct channel names lowercase | be-unit |
| T-IDX-036 | IDX-25 | INT | P1 | embedded NATS | Publish/Consume durable; handler error → redelivery | at-least-once semantics | be-int |
| T-IDX-037 | IDX-26 | CON | P1 | existing contract suite pattern | every adapter (alchemy/infura/url rpc, alchemy source, coingecko/alchemy prices, alchemy risk, webpush) against httptest upstream fixtures | adapter contract holds | be-unit |
| T-IDX-038 | IDX-27 | UNIT | P2 | — | ratelimit Wait with ctx cancel; rps<=0 | returns ctx error; unlimited | be-unit |
| T-IDX-039 | IDX-28 | KAT | P0 | — | evmtx.Decode/Sender on EIP-155 example tx; EIP-1559 tx signed by viem fixture; EIP-2930; EIP-4844 (type 3); EIP-7702 (type 4) fixtures | hash, nonce, chainId, sender exactly match | be-unit |
| T-IDX-040 | IDX-28 | NEG | P0 | — | type 5; 0x7f prefix; truncated; trailing bytes; length prefix overflow (beLen n=4 huge); recID 2; r > 32 bytes; empty | errors, no panic | be-unit |
| T-IDX-041 | IDX-28 | PROP | P0 | — | fuzz Decode & Sender with random bytes + mutated valid txs | never panics; if both succeed for a mutation of a valid tx, either sender differs or the mutation was in non-signed bytes | be-fuzz |
| T-IDX-042 | IDX-28 | UNIT | P2 | (ASM-12) | high-s signature variant of valid tx | sender recovered (documented) | be-unit |
| T-IDX-043 | IDX-28 | PROP | P1 | — | EncodeBytes/EncodeBig/EncodeList round trip via header/list | decode(encode(x)) == x | be-prop |
| T-IDX-044 | IDX-29 | KAT | P0 | — | LeadingZeroBits on known hashes; CheckPow at difficulty 0, 8, 256; counter length bounds | exact | be-unit |
| T-IDX-045 | IDX-29 | UNIT | P1 | — | ValidNonce boundaries 15/16/64/65, illegal chars, unicode | per rule | be-unit |
| T-IDX-046 | IDX-30 | SEC | P0 | — | LinkCrypto seal/open round trip; open with other device id (AAD); tampered blob; short blob; secret < 32 bytes | ok / error / error / error / constructor error | be-unit |
| T-IDX-047 | IDX-30 | SEC | P0 | — | DeviceTag/KeyTag/RouteTag domain separation | tags differ across functions for same input; deterministic; 32 hex | be-unit |
| T-IDX-048 | IDX-30 | PROP | P1 | — | random (device, tracked id) | open(seal(x)) == x; nonce fresh each seal | be-prop |
| T-IDX-049 | IDX-30 | SEC | P1 | — | SecretBox round trip; tamper; wrong label | ok / error / error | be-unit |
| T-IDX-050 | IDX-11..24 | PERF | P2 | 10k tracked addresses, 1M transfers | history page query & ingest batch | EXPLAIN uses indexes (address_activity_page, transfers_hash); p95 page < 50 ms locally | be-perf |
| T-IDX-051 | IDX-03 | PERF | P3 | fake upstreams | 1000 rps through gateway | no unbounded goroutines; latency overhead < 5 ms | be-perf |

## 13. Database (DB)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DB-001 | DB-21 | MIG | P0 | empty DB (no partman) | apply 0001..0010 | success; schema_migrations has 10 versions | db-mig |
| T-DB-002 | DB-21 | MIG | P1 | DB with pg_partman available | apply all | partman path taken; partitions managed by partman | db-mig |
| T-DB-003 | DB-21 | CONC | P0 | — | two migrate processes concurrently | advisory lock serialises; each version once | db-mig |
| T-DB-004 | DB-21 | RES | P0 | inject failing SQL in a copy of migration N | migrate | migration N rolled back entirely, not recorded; earlier ones kept | db-mig |
| T-DB-005 | DB-20 | MIG | P0 | DB at 0009 populated with text refs (assets, transfers across 2 months + default partition, activity summaries with assets) | apply 0010 | every hash/address converted to bytea; hb_ref_text(round-trip) equals lowercase originals; summaries compacted with asset ids; row counts unchanged | db-mig |
| T-DB-006 | DB-20 | MIG | P1 | DB at 0006 with EIP-7708 pseudo-asset transfers | apply 0007 | pseudo transfers & balances deleted; spam_score 100; activity summaries filtered; event_keys kept | db-mig |
| T-DB-007 | DB-20 | MIG | P1 | DB at 0007 | apply 0008 | added_at truncated to day; default changed; harbour_app role & grants exist | db-mig |
| T-DB-008 | DB-20 | MIG | P1 | DB at 0008 with tracked rows in each backfill state | apply 0009 | constraint replaced (dormant allowed); nft_dirty false for done/capped, true others | db-mig |
| T-DB-009 | DB-20 | MIG | P2 | DB at 0003 pre-state with failed backfills; at 0004 with rows | apply 0003 / 0004 | failed→pending; device_count=1 | db-mig |
| T-DB-010 | DB-21 | MIG | P1 | (no down migrations exist) | — | N/A for "down": documented; instead verify forward-only idempotency (re-running a file's DDL fails safely only via version table) | db-mig |
| T-DB-011 | DB-03 | INT | P0 | — | insert device with 31/33-byte key; duplicate key | CHECK violation; unique violation (→ ErrDuplicateKey) | be-int |
| T-DB-012 | DB-04 | INT | P1 | — | duplicate (chain,address); invalid backfill_state; unknown chain FK | violations | be-int |
| T-DB-013 | DB-05 | INT | P0 | — | delete device | device_addresses & push rows cascade; pending_transactions.device_id set NULL | be-int |
| T-DB-014 | DB-07/08 | INT | P1 | — | insert transfer with block_time far future/past (no partition) via harbour_ensure_partition | partition created; DEFAULT partition holding rows of that month → error surfaced (AMB-16) | be-int |
| T-DB-015 | DB-17 | SEC | P1 | harbour_app login | call harbour_ensure_partition('devices', now()) | exception 'not a partitioned fact table' | be-int |
| T-DB-016 | DB-18 | PROP | P0 | — | hb_ref/hb_ref_text on random strings (hex even/odd/upper, 'native', '', unicode, '0x') | hb_ref_text(hb_ref(t)) == lower-hex-normalised t; injective on normalised domain | be-int |
| T-DB-017 | DB-19 | SEC | P0 | service login in harbour_app | CREATE TABLE, DROP TABLE, CREATE ROLE, COPY … PROGRAM, ALTER TABLE | permission denied; DML on tables allowed | be-int |
| T-DB-018 | DB-19 | SEC | P1 | — | PUBLIC execute on SECURITY DEFINER functions | documented (AMB-16) | be-int |
| T-DB-019 | DB-22 | SEC | P0 | — | EnsureAppLogin user 'Bad-Name', 'x; DROP', password 15 chars, password with quotes `a'b"c\`, user == current_user | errors / quoting safe (role created with exact password, login works) | be-int |
| T-DB-020 | DB-10/12/13 | INT | P1 | — | NUMERIC(78,0) max uint256 value; > 78 digits | stored exactly; overflow error | be-int |
| T-DB-021 | DB-23 | INT | P2 | — | PurgeDeliveries 7 d, PrunePending, PruneTimeSeries | old rows removed only | be-int |
| T-DB-022 | DB-01..16 | PERF | P2 | — | EXPLAIN of each hot query in store/read.go & indexer.go | index scans (no seq scan on large tables) | be-perf |
| T-DB-023 | DB-05 | SEC | P0 | populated DB | attacker with SELECT only on device_addresses + tracked_addresses | cannot link device to address without key: added_at only day precision; enc ref random; link_hash keyed (statistical join test on timestamps fails) | be-int |
| T-DB-024 | DB-14 | INT | P1 | — | InsertPending duplicate (chain, hash) | no error (upsert/ignore) or defined error — assert behaviour | be-int |
| T-DB-025 | DB-01..23 | MIG | P1 | — | `pg_dump --schema-only` after migrations vs committed golden schema | identical (catches drift) | db-mig |
