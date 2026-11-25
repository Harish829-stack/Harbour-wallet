
## 18. Gap-closure tests (added after the first traceability pass found uncovered Feature×Category cells)

These rows close cells that the first matrix run reported as gaps where a test is genuinely needed (rather than an N/A reason).

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-KEY-121 | KEY-13 | SEC | P0 | — | exported keystore JSON | cipher aes-128-ctr, KDF scrypt with wallet-core default params (n≥2^14), MAC present; passphrase is the derived passwordKey (decrypt with the raw user password FAILS) | ext-int |
| T-KEY-122 | KEY-23 | SEC | P0 | spy wraps Uint8Array allocations returned by ActiveKeys | run every signing handler (send, typed, personal, solana, multi, swap, earn, smart account) to completion and to failure | dispose() called in finally; every returned key buffer is all-zero afterwards | ext-int |
| T-KEY-123 | KEY-04 | SEC | P0 | v1 vault | any write path (persist, setPassword, migrate) | never writes a v1 (PBKDF2) record or v1 passworder blob | ext-int |
| T-KEY-124 | KEY-07 | SEC | P0 | after v1→v2 migration | scan IDB + storage.local + storage.session | no copy of old v1 keys/blobs remains; no plaintext | ext-int |
| T-KEY-125 | KEY-05 | KAT | P0 | — | passworder v2 with fixed salt/IV (test seam) vs node:crypto HKDF-SHA256 + AES-256-GCM computed independently | identical ciphertext/tag | ext-unit |
| T-KEY-126 | KEY-11 | KAT | P0 | — | BIP-39 TREZOR vectors (entropy → mnemonic → seed with passphrase 'TREZOR') via wallet-core Mnemonic/HDWallet | match published vectors | ext-int |
| T-KEY-127 | KEY-13 | KAT | P0 | — | Web3 Secret Storage v3 scrypt test vector (password 'testpassword') imported with StoredKey.importJSON | decrypts to published private key 7a28b5ba57c53603b0b07b56bba752f7784bf506fa95edc395f5cf6c7514fe9d | ext-int |
| T-KEY-128 | KEY-24 | KAT | P1 | — | codeMatchesKey on a minified keystore fixture with known code (scrypt RFC 7914 parameters scaled) | true for right code, false for wrong, MAC checked before decrypt | ext-unit |
| T-KEY-129 | KEY-14/KEY-15/KEY-26/KEY-28 | MIG | P1 | vault state from older builds: wallet without `accounts` (only `addresses`), without `type`, without activeAccount | openActiveKeys, listWallets, addAccount | treated as mnemonic, account 0 from `addresses`; no crash; persisted state upgraded consistently | ext-int |
| T-KEY-130 | KEY-21 | RES | P1 | WebAuthn unavailable / PRF extension unsupported / user cancels | enrol & unlock | clear error; password path unaffected; no partial seal stored | ext-int |
| T-KEY-131 | KEY-15 | CONC | P0 | grant | two addWallet(import) concurrently with different mnemonics | both succeed or second gets WALLET_CREATION_IN_PROGRESS; vault lists every stored keystore (no orphan keystore, no lost wallet) | ext-int |
| T-KEY-132 | KEY-22 | CONC | P1 | — | concurrent secureStore.setMany batches touching same keys | each batch atomic (all-or-nothing); final state equals one serial order | ext-int |
| T-KEY-133 | KEY-24 | CONC | P1 | staged keys | 10 wrong codes in parallel | stage destroyed after exactly 5 counted failures; no extra imports | ext-int |
| T-KEY-134 | KEY-25/KEY-26 | CONC | P1 | 2 wallets | removeWallet(B) concurrently with addAccount(B) / switchWallet(B) | final vault consistent: B absent, active points to existing wallet, no keystore for absent wallet | ext-int |
| T-KEY-135 | KEY-26 | CONC | P0 | unlocked | concurrent read-modify-write handlers (renameWallet, tokenAdd via provider addToken, backupFinish, switchAccount) | no lost update: every change present afterwards (vault persist is not serialized → likely BUG; expected-fail if lost) | ext-int |
| T-KEY-136 | KEY-02 | RES | P0 | storage write fails after PBKDF2 record written, before vault blob | createWallet | no half-created vault that blocks onboarding (exists() false or interrupted state recoverable via resetEmptyVault) | ext-int |
| T-KEY-137 | KEY-15 | RES | P0 | vault.persist throws after keystore written | addWallet | error surfaced; orphan keystore either removed or harmless and not listed; retry succeeds | ext-int |
| T-KEY-138 | KEY-25 | RES | P1 | keystore removal throws | removeWallet | wallet entry and keystore stay consistent (both present or both absent) | ext-int |
| T-KEY-139 | KEY-12/KEY-13 | NEG | P1 | — | deriveAddresses / buildStoredKey with invalid mnemonic, 11 words, non-English words, mixed case, extra spaces | invalid rejected before wallet-core (no WASM abort); normalised input accepted | ext-int |
| T-KEY-140 | KEY-07 | PROP | P0 | — | random valid mnemonics / private keys × random passphrases | rekeyKeystore(ks, a, b) decrypts with b to the same secret; never with a | ext-prop |
| T-KEY-141 | KEY-13 | PROP | P1 | — | random 12/24-word mnemonics | buildStoredKey→export→import→decryptMnemonic == input; addresses stable | ext-prop |
| T-KEY-142 | KEY-22 | PROP | P1 | — | random key names (secret & non-secret patterns) and JSON values | local.get(local.set(k,v)) == v; secret keys only ever land in IDB | ext-prop |
| T-KEY-143 | KEY-05/KEY-02 | CON | P0 | — | golden vault blob & KDF record produced by the current build (committed fixture) | current build decrypts it; field names/types unchanged (format contract for future migrations) | ext-unit |
| T-KEY-144 | KEY-22 | CON | P1 | — | KEYS map and SECRET_KEYS list | equal to committed golden list (renaming a storage key requires a migration) | ext-unit |
| T-KEY-145 | KEY-29 | NEG | P1 | locked / no agent | perpsOrder, predictionOrder | LOCKED / needs enable; no network call | ext-int |
| T-KEY-146 | KEY-29 | SEC | P0 | — | perps/prediction handlers responses | never contain agent key / api secret / passphrase (uiSafe + value scan) | ext-int |
| T-SIG-045 | SIG-08 | KAT | P0 | — | Ed25519 RFC 8032 test vectors 1–3 through the Solana signing path (wallet-core) | identical signatures | ext-unit |
| T-SIG-046 | SIG-06 | PROP | P0 | — | random tx fields (nonce, fees, gas, value, data, chainId) signed via signEvmTx | viem parseTransaction recovers our address and the same fields; chainId preserved | ext-prop |
| T-SIG-047 | SIG-04 | PROP | P1 | — | random messages | evmRecover(evmSignMessage(m)) == address; raw vs personal mode give different signatures | ext-prop |
| T-SIG-048 | SIG-04 | NEG | P1 | — | key of 31/33 bytes, non-hex message | throws, no signature | ext-unit |
| T-SIG-049 | SIG-06/SIG-07 | NEG | P0 | — | stale quote reuse, fee tier missing, nonce gap, recipient = own address (allowed?) , 0 amount | blocking issues or explicit errors per rule | ext-unit |
| T-SIG-050 | SIG-06/SIG-07 | SEC | P0 | — | send builders with from ≠ active account address; chain id override in params | refused; chain id always from registry | ext-int |
| T-DAPP-054 | DAPP-08 | CONC | P1 | — | concurrent connect approvals for same origin; connect + disconnect race | single connection record; final state matches last user action | ext-int |
| T-DAPP-055 | DAPP-08/DAPP-09 | RES | P1 | storage quota exceeded on write | connect / pending add | request fails with clear error; no corrupted records | ext-int |
| T-DAPP-056 | DAPP-11 | RES | P1 | RPC probe hangs | wallet_addEthereumChain | times out, 4xxx error to site; nothing saved | ext-int |
| T-DAPP-057 | DAPP-17 | RES | P1 | relay socket closes | WC request pending | resume via alarm; pending request still answered or rejected, never lost silently | ext-int |
| T-DAPP-058 | DAPP-09 | PROP | P1 | — | random sequences of add/settle/drop/gc/takeSettled with fake clock | invariants: ≤MAX_PENDING_TOTAL, no expired entry returned, each settled outcome taken at most once | ext-prop |
| T-DAPP-059 | DAPP-10 | PROP | P1 | — | random request timings | tokens taken in any window ≤ capacity + refill·Δt | ext-prop |
| T-DAPP-060 | DAPP-03/DAPP-04/DAPP-06/DAPP-14 | CON | P1 | — | inpage↔content↔background message schemas (req/res/evt/init/ack/fatal) | match committed golden schema; InitState fields exact | ext-unit |
| T-EXT-041 | KEY-06/KEY-14/KEY-18/KEY-19/KEY-21/SIG-05/SIG-13/EXT-10/UX-02/UX-04/UX-05/UX-06/CH-05/DEFI-01/DAPP-08 | UI | P1 | Playwright + axe-core | each screen: unlock, onboarding, backup, reveal, biometrics settings, approval (sign/typed/tx), settings/security, approvals list, send confirm, swap, connections | no critical a11y violations; full keyboard path; amounts/addresses not truncated ambiguously (full address on confirm) | ext-e2e |
| T-EXT-042 | EXT-10 | MIG | P1 | stored settings from older builds (missing keys, auto-lock 0, unknown currency, removed locale) | loadSettings | normalized; 0→default 10; unknown currency→USD | ext-unit |
| T-EXT-043 | EXT-08 | CONC | P2 | — | rapid dispatches + SW stop during 250 ms debounce | persisted state never partially written; next boot hydrates last complete tuple | ext-int |
| T-EXT-044 | EXT-08 | PROP | P2 | — | random persisted slice objects | hydrate never throws; result has every slice with default keys | ext-prop |
| T-EXT-045 | EXT-11 | PROP | P1 | — | fuzz parseConfig | never throws; output only booleans in flags/chains; urls https only | ext-fuzz |
| T-UX-022 | UX-01 | PROP | P1 | — | random uint256 | isUnlimited monotonic in value | ext-prop |
| T-UX-023 | UX-02 | PROP | P0 | — | random approve calldata + amounts | setApproveAmount keeps spender & selector; amount field equals new value; decode(result).amount == new | ext-prop |
| T-UX-024 | UX-08 | PROP | P1 | — | random unicode strings | output has no bidi/control chars and ≤ max length | ext-prop |
| T-UX-025 | UX-10 | PROP | P1 | — | random baseFee/tip/gas | tiers monotonic; max cost ≥ fee×gas for each tier | ext-prop |
| T-UX-026 | UX-01/UX-02/UX-03/DAPP-18 | SEC | P0 | approval view model | unlimited approve, permit, Permit2, setApprovalForAll(true), undecodable call, simulation failure | each produces a blocking/explicit warning flag requiring confirmation | ext-int |
| T-UX-027 | UX-06 | SEC | P0 | — | display rounding of amounts to send / receive / fees | never displays a smaller outgoing amount or fee than the signed value (rounding up for debits) | ext-unit |
| T-UX-028 | UX-10 | SEC | P1 | — | fee shown vs signed tx max fee | shown max ≥ signed maxFeePerGas×gas | ext-int |
| T-UX-029 | UX-11 | SEC | P1 | — | backend & extension error mapping with raw node messages containing URLs, keys, stack traces | output never contains them | ext-unit, be-unit |
| T-SA-018 | SA-05 | KAT | P0 | — | EIP-7702 authorization digest keccak256(0x05‖rlp([chainId, delegate, nonce])) vs viem `hashAuthorization` | identical; signature recovers our address | ext-unit |
| T-SA-019 | SA-06 | KAT | P0 | — | ERC-4337 v0.7 userOpHash vs viem `getUserOperationHash` for fixtures | identical | ext-unit |
| T-SA-020 | SA-05/SA-06/SA-07/SA-09 | RES | P1 | mock bundler: timeout, 500, malformed, receipt never arrives | operations | GuardError / timeout error; no second signature; status pending→failed handled | ext-int |
| T-SA-021 | SA-02 | PROP | P0 | — | fuzz checkIntent | accepted ⇒ chain pinned, 1..16 calls, no protected target | ext-fuzz |
| T-SA-022 | SA-03 | PROP | P1 | — | random code strings | delegationState total function; 'pinned' only for exact 0xef0100‖pinned | ext-prop |
| T-SA-023 | SA-07 | CON | P1 | — | EIP-5792 getCapabilities/sendCalls/getCallsStatus responses | conform to EIP-5792 v2 JSON shapes (status codes 100/200/400/500/600) | ext-unit |
| T-SA-024 | SA-08 | CON | P1 | — | ERC-7715 request/grant response | conform to ERC-7715 draft shape used by MetaMask kit | ext-unit |
| T-SA-025 | SA-01 | SEC | P0 | — | static analysis test: every address used in signing (delegate, EntryPoint, paymaster, DelegationManager, enforcers) originates from constants.ts | no import of addresses from replies (AST scan of core/smartAccount) | ext-unit |
| T-SA-026 | SA-02/SA-03/SA-04/SA-05/SA-06/SA-09 | SEC | P0 | hostile mock bundler/paymaster/RPC | return foreign paymaster, gas above limits, foreign delegate code, wrong chain id | nothing signed; GuardError reason logged | ext-int |
| T-CH-016 | CH-02/CH-03 | MIG | P1 | stored custom networks/tokens from older builds (missing addedAt, uppercase addresses) | load | normalized; ids stable | ext-unit |
| T-CH-017 | CH-02/CH-03/CH-04/CH-05 | RES | P1 | RPC/backend errors (timeout, 429, invalid JSON) | balance, probe, quote, submit | friendly errors; no partial vault writes; submit never double-broadcasts different txs | ext-int |
| T-CH-018 | CH-01 | SEC | P1 | — | registry: unique chain ids, unique ids, no EVM id collision between mainnet/testnet entries | invariants | ext-unit |
| T-CH-019 | CH-06 | SEC | P0 | served chain | any RPC from SW | always signed to backend; broadcast never sent to public RPC for served chains; unserved fallback only after 404 unknown_chain | ext-int |
| T-CH-020 | CH-07 | SEC | P1 | — | failover with non-pool URL; failure logs | non-pool URLs untouched; logs contain host only | ext-unit |
| T-DEFI-017 | DEFI-02/DEFI-03/DEFI-04/DEFI-05/DEFI-06/DEFI-07/DEFI-08 | RES | P1 | third-party API failure modes per feature (timeout, 429, 500, malformed) | each handler | friendly error; no signing with partial data | ext-int |
| T-DATA-013 | DATA-02/DATA-03/DATA-04/DATA-06 | RES | P1 | backend 503/timeout/invalid JSON | history, address sync, realtime, data fetch | retry later (queue/alarm); UI shows friendly state; no loop storms (backoff) | ext-int |
| T-DATA-014 | DATA-05 | PROP | P1 | — | random challenge/pub, difficulty 0..12 | solvePow result passes JS check and Go CheckPow fixture | ext-prop |
| T-DATA-015 | DATA-06 | PROP | P1 | — | fuzz schema checkers | never throw; accepted ⇒ fields well-typed | ext-fuzz |
| T-DATA-016 | DATA-05/DATA-06/CH-06 | CON | P0 | — | shared golden JSON fixtures for every backend endpoint used by client.ts | client parses backend golden responses; backend tests produce the same golden (two-sided contract) | ext-unit, be-unit |
| T-DATA-017 | DATA-03 | SEC | P1 | — | address sync payload | only {chain,address} for EVM addresses; no wallet names/ids/grouping hints; order randomized or sorted (no wallet grouping leak) | ext-int |
| T-BE-091 | BE-06 | CONC | P0 | — | same signed request (same nonce) sent 20× in parallel | exactly one 200 | be-int |
| T-BE-092 | BE-07 | CONC | P1 | RPM=10 | 50 parallel requests | exactly 10 succeed | be-int |
| T-BE-093 | BE-22 | CONC | P1 | — | same raw tx broadcast 5× in parallel with different Idempotency-Keys | all 200 with same hash; single pending row | be-int |
| T-BE-094 | BE-01..28 | RES | P0 | Redis down / Postgres down / gateway down injected per route | every signed route | JSON 5xx retryable, no panic, idempotency key not pinned, no partial DB writes | be-int |
| T-BE-095 | BE-28 | PROP | P1 | — | fuzz realIP with random XFF and peers | never panics; untrusted peer never rewritten | be-fuzz |
| T-BE-096 | BE-29 | PROP | P2 | — | fuzz config YAML loader | no panic; invalid → error | be-fuzz |
| T-BE-097 | BE-15/BE-18/BE-19/BE-23/BE-24/BE-26 | INT | P1 | real Postgres/Redis seeded | each read route via signed HTTP | expected data & status | be-int |
| T-BE-098 | BE-31 | SEC | P1 | log capture | migrate with app/service users | passwords never logged | be-int |
| T-GW-027 | GW-01..19 | INT | P1 | full API stack, httptest upstreams | each gateway route through signed request + quotas | forwarded/rejected per route table; cache behaviour | be-int |
| T-IDX-052 | IDX-30 | KAT | P1 | — | HMAC-SHA256 RFC 4231 case 2 and AES-256-GCM NIST vector via the same primitives LinkCrypto composes | match | be-unit |
| T-IDX-053 | IDX-12 | CONC | P0 | — | two ingest workers ingest overlapping batches concurrently | event_keys dedupe holds; balances/activity not double counted | be-int |
| T-IDX-054 | IDX-18 | CONC | P1 | — | Repair concurrently with live ingest for same chain | WithLock serialises; final state consistent | be-int |
| T-IDX-055 | IDX-21 | CONC | P1 | two tracker instances | RunOnce concurrently | each pending row processed once per due time; no conflicting state | be-int |
| T-IDX-056 | IDX-11..25 | RES | P0 | inject Postgres/NATS/RPC/provider failures into each worker loop | run | errors logged, backoff, no crash/exit, progress resumes | be-int |
| T-IDX-057 | IDX-02 | PROP | P1 | — | random pools | pick never returns excluded/open member or member below minBlock | be-prop |
| T-IDX-058 | IDX-04 | PROP | P1 | — | random outcome sequences | breaker state machine invariants (open → no traffic until cooldown; one half-open probe) | be-prop |
| T-IDX-059 | IDX-29 | PROP | P1 | — | random challenge/pubkey | CheckPow(SolvePow(d)) true; LeadingZeroBits ≤ 256 | be-prop |
| T-IDX-060 | IDX-25/IDX-24/IDX-16/IDX-21/IDX-23 | CON | P1 | — | NATS payloads AddressAddedEvent, TxStatusEvent, RawDelivery, TickMessage, gap-fill; Centrifugo channel names | golden JSON; producers & consumers agree | be-unit |
| T-IDX-061 | IDX-01..10 | INT | P1 | — | rpc-gateway HTTP server with httptest upstreams (pool+hedge+cache+breaker+splitting+broadcast) | end-to-end behaviour through HTTP | be-int |
| T-IDX-062 | IDX-02..27 | NEG | P1 | — | malformed provider payloads/RPC responses for every adapter & worker (null results, wrong types, huge numbers, negative values) | rejected/logged; no DB corruption | be-int |
| T-DBO-003 | DB-01..23 | NEG | P1 | — | NULL into NOT NULL, wrong types, out-of-range values for every table (generated) | rejected | be-int |
| T-MSG-008 | all MSG | NEG | P1 | — | each message with semantically invalid values (unknown walletId/chainId/asset, negative amounts, out-of-range indices) | specific error code/sentence; no generic crash text | ext-int |
| T-PM-007 | all PM | CON | P1 | — | EIP-1193 / EIP-1474 error codes and result shapes; EIP-6963 announce detail | conform | ext-unit |
| T-X-012 | BE-03/BE-04/BE-06/BE-07/BE-08/BE-10/BE-12/BE-13/BE-14/BE-16/BE-20/BE-21/BE-22/BE-23/IDX-01/IDX-02/IDX-03/IDX-05/IDX-07/IDX-09/IDX-10/DB-21/DATA-03/DATA-05/CH-06 | E2E | P0 | Docker Compose backend + mock JSON-RPC chain (deterministic, local) + Playwright extension built against it | register device, add wallet (address sync), view portfolio/history, estimate, simulate, send (broadcast), realtime status | full stack works; no real network | ext-e2e |
| T-X-013 | X-02 | PROP | P2 | — | random instants around UTC day/month boundaries | day/month keys computed in UTC consistently in Go and JS | be-prop, ext-prop |
| T-KEY-147 | KEY-20 | CONC | P0 | one reveal grant | two concurrent consumeReauth('reveal') (two reveal requests) | at most one returns true (get+remove is not atomic → expected-fail if both pass) | ext-int |
| T-SA-027 | SA-07 | CONC | P2 | — | concurrent wallet_sendCalls from two origins | both bundles retrievable (session map read-modify-write) | ext-int |
| T-CH-021 | CH-05/DEFI-01/DEFI-02/DEFI-03/DEFI-04/DEFI-05 | CONC | P0 | — | submit handler invoked twice quickly with the same prepared quote (double click / two windows) | exactly one signature and one broadcast | ext-int |
| T-DATA-018 | DATA-03 | CONC | P1 | — | 10 rapid wallet changes | one debounced PUT whose add/remove diff equals final state | ext-int |
| T-DAPP-061 | DAPP-12 | INT | P1 | connected | wallet_watchAsset ERC-20 → approve | token appears in vault customTokens of the connected wallet; duplicate request is idempotent | ext-int |
| T-DAPP-062 | DAPP-02 | CON | P1 | jsdom | Solana provider (publicKey, connect, disconnect, signMessage, signTransaction, signAllTransactions, signAndSendTransaction, events) and multi provider surfaces | match committed golden API surface (names, arities, event names) | ext-unit |
| T-EXT-046 | EXT-10 | INT | P1 | — | setSettings lockTimeInMinutes / preferSidePanel / currency through the router | alarm re-armed with new delay; side panel behaviour applied; rate fetched and stored; store slices updated | ext-int |
| T-EXT-047 | EXT-11 | CON | P1 | — | backend `/v1/gw/v1/config` response fixture (Go handler) consumed by kit/remoteConfig.refreshConfig | shapes agree ({config: string, signature: base64}); signature verified over exact text | ext-unit, be-unit |
| T-SA-028 | SA-08 | INT | P1 | flag on, smart account enabled (mock chain) | wallet_requestExecutionPermissions → approve → wallet_getGrantedExecutionPermissions | grant stored per origin; delegation signed with pinned DelegationManager & enforcers; response context usable by the kit | ext-int |
| T-SA-029 | SA-05 | PROP | P1 | — | random chain ids (pinned set) and nonces | authorization digest equals viem hashAuthorization; signature recovers our address | ext-prop |
| T-UX-030 | UX-08 | SEC | P0 | Playwright approval window | site title / token symbol containing U+202E, zero-width joiners, lookalike 'USDC' | rendered text neutralised (no reordering), lookalikes flagged where token unverified | ext-e2e |
| T-IDX-063 | IDX-13 | INT | P1 | Postgres + fake source | RefreshBalances for tracked id with extra refs; sweep due addresses | balances upserted with as_of_block; refreshed_at updated; stale reads re-requested | be-int |
| T-IDX-064 | IDX-14 | INT | P1 | Postgres + fake source | SyncNFTs / NFTsSynced / MarkNFTsMoved | holdings replaced atomically; media keys set; dirty flag cleared | be-int |
| T-IDX-065 | IDX-22 | INT | P1 | Postgres + embedded NATS + fake push service | activity event for address with route tag | push delivered only to subscribers of that route; tx status push to sending device only | be-int |
| T-IDX-066 | IDX-10 | PROP | P1 | — | fuzz ParseQuantity / parseBlockNumber | never panics; valid hex ≤ 64-bit parsed exactly | be-fuzz |
