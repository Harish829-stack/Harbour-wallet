
## 4. Extension platform (EXT)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-EXT-001 | EXT-01 | SEC | P0 | built manifest (prod mode, https API) | parse dist/manifest.json | permissions exactly the 9 listed; host_permissions only `https://*/*` (no loopback in prod); no `externally_connectable`; no `web_accessible_resources` exposing internal pages; minimum_chrome_version 137 | ext-unit |
| T-EXT-002 | EXT-01 | CON | P1 | local build (VITE_HB_API_URL=http://localhost) | manifest | adds loopback host permissions only then | ext-unit |
| T-EXT-003 | EXT-02 | SEC | P0 | — | CSP string | script-src 'self' 'wasm-unsafe-eval' only; object-src 'self'; base-uri 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'; no 'unsafe-eval'/'unsafe-inline'/remote hosts | ext-unit |
| T-EXT-004 | EXT-02 | SEC | P0 | Playwright popup | attempt `el.innerHTML = '<img onerror>'` via DevTools eval | TypeError (Trusted Types) | ext-e2e |
| T-EXT-005 | EXT-03 | UNIT | P0 | — | isInternalWalletSender: popup URL; side panel same URL; `/src/popup/index.html?x` ; other path; content script sender (tab, page URL); other extension id; http URL; missing url | true only for exact extension popup path | ext-unit |
| T-EXT-006 | EXT-03 | SEC | P0 | real router | runtime.sendMessage from content-script-like sender for every INTERNAL message | {ok:false, error:'UNAUTHORIZED'}; no handler invoked (spy) | ext-int |
| T-EXT-007 | EXT-03 | SEC | P0 | — | message with isInternal/source/internal flags | stripped before dispatch | ext-unit |
| T-EXT-008 | EXT-04 | INT | P0 | fake chrome with setAccessLevel spy | SW boot | session and local set to TRUSTED_CONTEXTS | ext-int |
| T-EXT-009 | EXT-05 | UNIT | P0 | — | registerEvent duplicate; dispatch unknown; handler throws Error with URL+key in message | throws 'duplicate event'; undefined → 'unknown_message'; error redacted | ext-unit |
| T-EXT-010 | EXT-05 | SEC | P1 | (ASM-15) | union of keys of every handler map (modules + handlers/*) | pairwise disjoint | ext-unit |
| T-EXT-011 | EXT-05 | NEG | P1 | — | raw message null, string, {type:5}, {type:'__proto__'}, {type:'constructor'} | INVALID_REQUEST / unknown_message; no prototype access | ext-int |
| T-EXT-012 | EXT-06 | INT | P1 | — | connect `harbour-ui` from popup sender; from content sender; request with non-number id; handler throws | snapshot then patches; foreign sender disconnected; ignored; error response | ext-int |
| T-EXT-013 | EXT-07 | UNIT | P1 | fake timers | bootWith step failing 19× then succeeding; failing 20× | resolves; rejects with step name | ext-unit |
| T-EXT-014 | EXT-07 | RES | P1 | — | queue job handler throws; job without handler | kept for next boot; others removed after success | ext-unit |
| T-EXT-015 | EXT-07 | UNIT | P2 | — | selfHeal twice within 1 h | reload once | ext-unit |
| T-EXT-016 | EXT-08 | MIG | P1 | stored tuples [0,0,{}], [1,0,{…}], malformed, missing | runMigrations('pre'/'post') | version advanced per step and persisted after each step; malformed treated as fresh | ext-unit |
| T-EXT-017 | EXT-08 | UNIT | P1 | — | hydrateStore with unknown slice, partial slice, transient slices | unknown dropped; missing keep defaults; transient never persisted | ext-unit |
| T-EXT-018 | EXT-08 | SEC | P0 | — | every slice initial state & after full flows | no secret-named fields/values (ties to T-KEY-109) | ext-int |
| T-EXT-019 | EXT-09 | RES | P0 | pending approval in session storage | simulate SW termination (drop module state, keep session storage), re-import SW | approval window still lists request; approve signs exactly once | ext-int |
| T-EXT-020 | EXT-09 | E2E | P0 | Playwright | stop SW via CDP during pending approval; approve | single signature/broadcast; dApp resolves | ext-e2e |
| T-EXT-021 | EXT-10 | UNIT | P1 | — | applyPatch/normalizeSettings with unknown keys, bad types, locale not supported, currency unknown | sanitized settings; defaults applied | ext-unit |
| T-EXT-022 | EXT-10 | SEC | P0 | — | setSettings patch that weakens security (enable eth_sign, longer auto-lock, disable biometric approval) without manage grant | refused AUTH_REQUIRED (weakensSecurity) | ext-int |
| T-EXT-023 | EXT-10 | UNIT | P2 | — | pickLocale/intlTag/localeLabel | expected tags | ext-unit |
| T-EXT-024 | EXT-11 | KAT | P0 | test Ed25519 keypair (RFC 8032 test 1) | verifySignature over exact text; altered whitespace; wrong key; bad base64 | true / false / false / false | ext-unit |
| T-EXT-025 | EXT-11 | SEC | P0 | stored version 5 | config version 4 (valid sig); expired expiresAt; non-boolean flags; announcement url javascript: | refused / refused / filtered / url dropped | ext-unit |
| T-EXT-026 | EXT-11 | SEC | P1 | (ASM-06) | valid config without expiresAt | accepted (documents replay risk AMB-11) | ext-unit |
| T-EXT-027 | EXT-11 | RES | P1 | config endpoint 500 / timeout / invalid JSON | refreshConfig | null; previous config kept; kill switches unchanged | ext-unit |
| T-EXT-028 | EXT-12 | UNIT | P0 | — | SIGNING_POLICY frozen; FEATURES values; featureEnabled unknown key | explicit values asserted (review gate); unknown → false | ext-unit |
| T-EXT-029 | EXT-12 | UNIT | P0 | — | smartAccountsAvailable matrix (flag × walletType × chain) | true only for flag true + mnemonic/privateKey + pinned chain + signing chain | ext-unit |
| T-EXT-030 | EXT-13 | INT | P1 | fake offscreen API | two concurrent copy requests | single offscreen doc; point-to-point port; clear timers per copy | ext-int |
| T-EXT-031 | EXT-14 | SEC | P0 | test keypair | release.mjs sign → verify-release.mjs; tamper zip byte | verify ok / fails | ext-unit |
| T-EXT-032 | EXT-14 | SEC | P0 | — | check-frozen.mjs after modifying a frozen file in a temp copy | fails with file name | ext-unit |
| T-EXT-033 | EXT-14 | SEC | P0 | fake built bundle containing an Alchemy URL with key / a value from a fake key file | verify.mjs leak scan function | flags the file | ext-unit |
| T-EXT-034 | EXT-14 | SEC | P1 | — | env-guard.mjs with .env.production holding SECRET-like value (SEC-2026-11-18-01) | build refused | ext-unit |
| T-EXT-035 | EXT-15 | SEC | P0 | Playwright | type password in unlock field, submit; type phrase in import field, submit | input values cleared from DOM after submit; React state cleared; no secret in `document.body.innerText` or a11y tree after navigation | ext-e2e |
| T-EXT-036 | EXT-15 | UI | P1 | — | revealGate / backupGate (HW-2026-004) | receive/buy/fund routes gated until backup done; hashchange re-bind | ext-e2e |
| T-EXT-037 | EXT-16 | INT | P2 | fake push event | wirePushEvents with payload | notification created with safe text; malformed payload ignored | ext-int |
| T-EXT-038 | EXT-01..16 | E2E | P1 | Playwright | full smoke: install → onboarding tab opens automatically → create → lock via idle API emulation → unlock | flows succeed | ext-e2e |
| T-EXT-039 | EXT-06 | PERF | P3 | — | 1000 store patches with UI open | patch fan-out < 50 ms p95 | ext-perf |
| T-EXT-040 | EXT-15 | UI | P2 | axe-core in Playwright (dev only) | home, send, approval, settings, onboarding | no critical a11y violations; hidden home layer inert (b26a725) | ext-e2e |

## 5. Transaction UX safety (UX)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-UX-001 | UX-01 | UNIT | P0 | — | isUnlimited at 2^159-1, 2^159, MAX_UINT256 | false, true, true | ext-unit |
| T-UX-002 | UX-02 | UNIT | P0 | — | setApproveAmount on approve calldata; on non-approve; amount > MAX_UINT256; negative | rewritten selector+spender preserved; null; null; null | ext-unit |
| T-UX-003 | UX-02 | E2E | P1 | dApp approve unlimited | user edits cap to 10 tokens | signed tx data encodes 10·10^dec | ext-e2e |
| T-UX-004 | UX-03 | INT | P1 | mock backend simulate full/basic/failed | approval view | asset changes displayed; failure shows 'would fail'; basic mode labelled | ext-int |
| T-UX-005 | UX-04 | INT | P1 | mock multicall RPC | approvalsScan → approvalsRevoke | only allowance>0 shown; revoke builds approve(spender,0) and goes through signing policy | ext-int |
| T-UX-006 | UX-04 | PERF | P2 | 500 pairs | scan | ≤ 6 multicall requests (≈100 per call) | ext-unit |
| T-UX-007 | UX-05 | UNIT | P0 | — | sendValidateAddress per family: valid, wrong checksum (EVM mixed-case), other-family address, empty, whitespace, zero address | valid/invalid; checksum mismatch flagged | ext-unit |
| T-UX-008 | UX-05 | SEC | P0 | address book with 0xAbC…123 | recipient 0xAbC…(poisoned middle)…123 from history | poisoning warning (similar prefix/suffix) or at minimum full-address confirmation; scam list hit → blocking warning | ext-int |
| T-UX-009 | UX-05 | UNIT | P2 | — | addressBook save/remove/list limits, duplicate names | per rules | ext-unit |
| T-UX-010 | UX-06 | PROP | P0 | — | toAtomic/fromAtomic, parseTokenAmount/formatTokenAmount, parseUnits/formatUnits for decimals 0..36 and random strings | round-trip exact; reject >decimals fraction digits, negatives, exponents, '1e3', ' 1', '.', '1.' handled consistently; never Number precision loss | ext-prop |
| T-UX-011 | UX-06 | UNIT | P1 | — | formatFiat/compact/signed for 0, 1e-9, 1e15, negative, NaN, each currency locale | stable formatting; NaN → '—' or 0 (no 'NaN' text) | ext-unit |
| T-UX-012 | UX-06 | NEG | P0 | — | backend formatUnits with dec=-1, dec=1_000_000, raw '-5', raw '1e3' (ASM-04) | no panic, bounded output (expected fail if it panics → BUGS_FOUND) | be-unit |
| T-UX-013 | UX-06 | PROP | P1 | — | backend formatUnits(raw, d) vs big.Rat reference for random raw/d∈[0,77] | equal | be-prop |
| T-UX-014 | UX-07 | UNIT | P1 | — | cleanText on control chars/RTL/1000 chars; SpamScore on airdrop-like names ('Visit x.com to claim'), unicode lookalikes, decimals nil/0/>36 | cleaned; spam score high for scam patterns | ext-unit, be-unit |
| T-UX-015 | UX-08 | UNIT | P1 | — | (see T-DAPP-045) | — | ext-unit |
| T-UX-016 | UX-09 | UNIT | P0 | — | validateLifiTransaction: to ≠ diamond; data with transfer/approve selector; receiver ≠ me; minAmountOut below quote×(1-slippage); value ≠ quoted; chain mismatch; non-EVM receiver marker for EVM dest | SwapError for each; valid tx passes | ext-unit |
| T-UX-017 | UX-09 | UNIT | P0 | — | decodeLifiCall for each facet shape (swap, bridge BridgeData) and unknown | decoded or null (fail closed) | ext-unit |
| T-UX-018 | UX-09 | UNIT | P0 | — | Jupiter tx: program not JUP; fee payer not me; extra signer slots | refused | ext-unit |
| T-UX-019 | UX-09 | PROP | P1 | — | fuzz parseSolanaTx / decodeLifiCall | never throws non-SwapError; attachSolanaSignature length invariant | ext-fuzz |
| T-UX-020 | UX-10 | UNIT | P1 | — | gasFees.buildQuote with/without feeHistory, maxPriority 0, huge baseFee | tiers monotonic slow≤standard≤fast; costs = fee×gas | ext-unit |
| T-UX-021 | UX-11 | UNIT | P1 | — | backend friendlyChainError for each pattern incl. mixed case; unknown | mapped codes; 'rejected' default | be-unit |

## 6. Smart accounts (SA)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-SA-001 | SA-01 | UNIT | P0 | — | constants: every DELEGATES chain has PAYMASTERS and limitsFor entry; addresses lowercase; ENTRYPOINT checksum valid | invariants hold | ext-unit |
| T-SA-002 | SA-02 | UNIT | P0 | — | checkIntent: unpinned chain; from ≠ account (case-insensitive equal accepted); 0 calls; 17 calls; call to DelegationManager / each enforcer (any case); call to self/delegate/EntryPoint with data; with '0x' data | GuardError reasons chain/from/calls/protocol_call/self_call; '0x' self call allowed | ext-unit |
| T-SA-003 | SA-03 | UNIT | P0 | — | delegationState: '', '0x', '0x0', 0xef0100+pinned (upper/lower), 0xef0100+other, contract code, null | none/pinned/other | ext-unit |
| T-SA-004 | SA-04 | UNIT | P0 | — | acceptGasPrice/Estimate/sponsor: non-object, missing fast, '0x0' maxFee, value > limits, priority > max, leading zero '0x01', 67-char hex, non-pinned paymaster, total fee > maxTotalFeeWei | GuardError each; valid replies parsed to bigint | ext-unit |
| T-SA-005 | SA-04 | PROP | P0 | — | random gas replies | accepted ⇒ all values within LIMITS and total fee ≤ cap | ext-prop |
| T-SA-006 | SA-05 | INT | P0 | Sepolia mock RPC, unlocked mnemonic wallet | smartAccountPrepare(enable) → smartAccountApprove | EIP-7702 authorization signed for pinned delegate & chain id & current nonce+1; type-4 tx gas 150k; user-paid | ext-int |
| T-SA-007 | SA-05 | SEC | P0 | — | prepared op older than PREPARED_TTL_MS; approve twice; reject then approve | expired / one-shot / refused | ext-int |
| T-SA-008 | SA-06 | INT | P0 | mock bundler | sendOperation sponsored and user-paid | userOp signed over EntryPoint v0.7 hash; inclusion verified by UserOperationEvent for the right hash & sender; mismatch → error | ext-int |
| T-SA-009 | SA-06 | UNIT | P0 | — | verifyInclusion with receipt null, status 0x0, logs for other userOpHash/account, success=false | mismatch / tx_reverted / op_reverted | ext-unit |
| T-SA-010 | SA-07 | UNIT | P1 | — | normalizeSendCalls v1.0/v2.0.0, atomicRequired, chainId mismatch, from mismatch, required unknown capability | normalized / errors (refuseRequiredCapabilities) | ext-unit |
| T-SA-011 | SA-07 | INT | P1 | flag on | wallet_getCapabilities, wallet_sendCalls, wallet_getCallsStatus (pending/done), showCallsStatus | EIP-5792 shapes; status codes; bundles per origin in session (≤50) | ext-int |
| T-SA-012 | SA-07 | SEC | P0 | flag off | any 5792/7715 method | 4200 | ext-int |
| T-SA-013 | SA-08 | UNIT | P0 | — | normalizePermissionRequest: expiry > 30 days, past, non-integer; allowance 0/negative/huge; unknown type; session key invalid | errors; valid normalized | ext-unit |
| T-SA-014 | SA-08 | SEC | P0 | grants for site A | site B wallet_getGrantedExecutionPermissions | only own grants | ext-int |
| T-SA-015 | SA-09 | INT | P1 | first op | sponsorship flag & confirmation shows gasless vs user-paid as Pimlico reports | correct label | ext-int |
| T-SA-016 | SA-10 | UNIT | P0 | — | (T-EXT-029) | — | ext-unit |
| T-SA-017 | SA-02..09 | E2E | P2 | Playwright + mock bundler | enable smart account, send batch from dApp, check status | end-to-end with guard | ext-e2e |

## 7. Chains, networks, tokens (CH)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-CH-001 | CH-01 | CON | P1 | — | chainList.gen.ts vs backend `config/chains.yaml` | every backend EVM chain present with same chain id/name; testnet flags consistent (single source of truth) | ext-unit |
| T-CH-002 | CH-01 | UNIT | P1 | — | chainById, testnets list (2–3 + curated), network groups Default/Custom/Testnets | per product rule | ext-unit |
| T-CH-003 | CH-02 | UNIT | P1 | — | validateNetwork: duplicate chainId, builtin chainId, bad URL, http non-local, symbol >6, name empty | errors per field | ext-unit |
| T-CH-004 | CH-02 | INT | P1 | mock RPC | probeRpcChainId ok / mismatch / timeout / non-JSON | ok / error / error / error | ext-unit |
| T-CH-005 | CH-03 | UNIT | P1 | mock client | probeToken: EOA, non-token contract, decimals 37, symbol bytes32, network error | INVALID/NOT_A_CONTRACT/NOT_A_TOKEN/…/NETWORK_ERROR | ext-unit |
| T-CH-006 | CH-03 | INT | P1 | — | tokenAdd/tokenRemove/tokenList persist in vault customTokens; ≤100 | persisted; 101st refused | ext-int |
| T-CH-007 | CH-04 | INT | P1 | mock backend portfolio | getBalances (coalesced, 61e9857) | concurrent identical requests produce one backend call | ext-int |
| T-CH-008 | CH-04 | SEC | P1 | backend returns portfolio for an address not requested | client.checkPortfolio | rejected (HW-2026-014) | ext-unit |
| T-CH-009 | CH-05 | INT | P0 | mock chain | sendQuote → sendSubmit (native & ERC-20) | tiers; signed+broadcast; activity pending record | ext-int |
| T-CH-010 | CH-05 | NEG | P0 | — | sendSubmit with stale quote, amount > balance, chain not signing, locked | errors; nothing signed | ext-int |
| T-CH-011 | CH-05 | E2E | P0 | Playwright + mock chain | send ETH via UI | confirm screen shows recipient, amount, fee; tx hash shown | ext-e2e |
| T-CH-012 | CH-06 | INT | P0 | — | harbourRpc for served chain: request signed (headers X-HB-*), eth_sendRawTransaction → POST /v1/tx/<chain>/broadcast with Idempotency-Key; unserved chain → public RPC, marked for 10 min | per spec; replay response verified tx_hash == keccak(raw) | ext-int |
| T-CH-013 | CH-06 | CON | P0 | — | `canonical()` in client.ts vs Go `devicesig.Canonical` for shared fixtures (method case, query, empty body, unicode body) | byte-identical strings (cross-language golden file) | ext-unit + be-unit |
| T-CH-014 | CH-07 | RES | P1 | fake endpoints | first endpoint 429/timeout/500/invalid JSON | next endpoint used; breaker opens after N failures and half-opens after cooldown; non-RPC requests untouched | ext-unit |
| T-CH-015 | CH-07 | UNIT | P2 | — | slow-method allowance (getSupply) | longer timeout applied only to listed methods | ext-unit |

## 8. DeFi & third parties (DEFI)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DEFI-001 | DEFI-01 | INT | P0 | mock LI.FI | swapQuote → swapApprove → swapSubmit | approval exact amount to diamond; tx validated by safety; broadcast; status polling | ext-int |
| T-DEFI-002 | DEFI-01/UX-09 | SEC | P0 | mock aggregator returns tampered tx (receiver attacker) at submit refresh | swapSubmit | refused with SwapError; nothing signed | ext-int |
| T-DEFI-003 | DEFI-01 | UNIT | P1 | — | slippage rules: normalizeSlippage, step, acceptSlippageInput, >30 clamp, high warning >5, priceImpactSeverity, resolveCta matrix | per rules | ext-unit |
| T-DEFI-004 | DEFI-01 | UNIT | P2 | — | dust scan/convert thresholds | per rules | ext-unit |
| T-DEFI-005 | DEFI-01 | RES | P1 | quote API 429/500 | swapQuote | friendly error; no stale quote reused after 60 s | ext-int |
| T-DEFI-006 | DEFI-02 | INT | P1 | mock chain per family | earnPrepare/earnSubmit stake/unstake/claim (EVM, Cosmos, Solana, Polkadot, Tron, Tezos, Cardano) | correct tx shape; fee shown; validators list | ext-int |
| T-DEFI-007 | DEFI-02 | NEG | P1 | — | amount below minimum delegation, unknown validator, unsupported action | errors | ext-unit |
| T-DEFI-008 | DEFI-03 | INT | P1 | mock Sepolia | defiCatalog/defiPrepare/defiSubmit (Aave supply/withdraw, Uniswap swap via universal router) | calldata verified against router/pool addresses; feature checks | ext-int |
| T-DEFI-009 | DEFI-03 | SEC | P0 | — | defiSubmit on non-testnet chain / feature disabled | refused (assertSigningEvmChain/assertFeature) | ext-int |
| T-DEFI-010 | DEFI-04 | KAT | P1 | — | hyperliquid action signing (EIP-712 agent) KAT vs @nktkas/hyperliquid devDependency | identical signatures | ext-unit |
| T-DEFI-011 | DEFI-05 | KAT | P1 | — | polymarket order signing (EIP-712 CTF Exchange) | matches reference | ext-unit |
| T-DEFI-012 | DEFI-06 | UNIT | P1 | — | ramps guard (allowed URLs/hosts), quotes sort, checkout URL builder escaping, ICS generation | per rules; no javascript: URLs | ext-unit |
| T-DEFI-013 | DEFI-06 | SEC | P1 | — | rampsKeysSet/Get/Clear | user keys encrypted at rest; never returned in clear to UI (masked) | ext-int |
| T-DEFI-014 | DEFI-07 | UNIT | P2 | — | marketData/priceService/fiat mapRates with partial/invalid upstream data | graceful defaults | ext-unit |
| T-DEFI-015 | DEFI-08 | SEC | P1 | — | NFT media loaded only on request (SEC-2026-11-18-05); mediaUrl accepts only /v1/media/ paths | third-party URLs never loaded directly | ext-unit |
| T-DEFI-016 | DEFI-08 | INT | P1 | — | nftTransferPrepare/Submit ERC-721/1155 | safeTransferFrom calldata; ownership checked | ext-int |

## 9. Activity & data (DATA)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DATA-001 | DATA-01 | UNIT | P1 | — | classify/merge/filter over fixtures (send, receive, swap, approve, self, failed) | correct kinds, dedupe by hash, ordering by time | ext-unit |
| T-DATA-002 | DATA-01 | RES | P1 | pending activity, receipt arrives after SW restart | reconcilePendingActivity alarm | pending → confirmed/failed | ext-int |
| T-DATA-003 | DATA-02 | INT | P2 | mock Etherscan v2 gateway | history for Arbitrum Sepolia / Amoy (5f4d4a9) | rows parsed | ext-int |
| T-DATA-004 | DATA-03 | INT | P1 | — | after addWallet/removeWallet/switch | PUT /v1/me/addresses with exact add/remove diff (EVM only) | ext-int |
| T-DATA-005 | DATA-04 | INT | P2 | fake Centrifugo | wireRealtime only while UI port open; reconnect after broadcast | per spec; deployed API never returns tunnel URL (4f44aaa) | ext-int |
| T-DATA-006 | DATA-05 | INT | P0 | fake fetch backend | deviceIdentity first call | WebCrypto Ed25519 non-extractable key (exportKey('pkcs8') throws); PoW solved; registration signature verifies; saved deviceId | ext-int |
| T-DATA-007 | DATA-05 | SEC | P0 | — | challenge difficulty 27 / -1 / 1.5 | bad_challenge, no PoW loop | ext-unit |
| T-DATA-008 | DATA-05 | SEC | P0 | — | server responds device_revoked / bad signature / replay | NO re-registration (key not rotated); only device_unknown triggers re-register once | ext-int |
| T-DATA-009 | DATA-05 | CONC | P1 | — | 10 concurrent deviceIdentity() calls | one registration (Web Lock + pending promise) | ext-int |
| T-DATA-010 | DATA-05 | MIG | P1 | IDB holds legacy raw seed record (kind≠webcrypto) | deviceIdentity | wiped and re-enrolled | ext-int |
| T-DATA-011 | DATA-05 | KAT | P0 | — | JS leadingZeroBits / solvePow vs Go CheckPow on shared fixtures | agree | ext-unit + be-unit |
| T-DATA-012 | DATA-06 | SEC | P1 | — | checkPortfolio/checkNfts/checkAddresses with extra/missing fields, foreign addresses | rejected or filtered | ext-unit |
