
## 2. Signing (SIG)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-SIG-001 | SIG-01 | UNIT | P0 | connected 0xA | personal_sign ['hello', 0xA]; [0xA, 'hello'] (swapped); ['0x68656c6c6f', 0xA] | utf8 'hello' both orders; hex input decoded to bytes; bytesHex identical | ext-unit |
| T-SIG-002 | SIG-01 | NEG | P0 | — | params not array; length 1; message number; address invalid; message > 128 KiB | -32602 with specific message | ext-unit |
| T-SIG-003 | SIG-01 | UNIT | P1 | — | '0x' and '0x1' (odd) | treated as UTF-8 text (documented) | ext-unit |
| T-SIG-004 | SIG-04 | KAT | P0 | key 0x4646…46 | evmSignMessage('hello', personal); evmRecover | signature equals viem `signMessage` for same key; recovers 0x9d8A…5A4F; EIP-191 hash = keccak('\x19Ethereum Signed Message:\n5hello') | ext-unit |
| T-SIG-005 | SIG-02 | SEC | P0 | eth_sign disabled (default) | eth_sign request | 4200 'eth_sign is disabled'; no approval window opened | ext-int |
| T-SIG-006 | SIG-02 | UNIT | P0 | enabled | eth_sign 32-byte non-UTF8 hash; UTF-8 text payload; 31-byte binary | rawHash=true; personal prefix (ASM-09); -32602 | ext-unit |
| T-SIG-007 | SIG-02 | KAT | P0 | — | raw-hash mode sign 0x00…01 | signature verifies with ecrecover over the raw hash (no prefix) | ext-unit |
| T-SIG-008 | SIG-03 | KAT | P0 | — | EIP-712 "Mail" example from the EIP with key `cow` (keccak('cow')) | digest 0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2; signature v=28 r=0x4355c4…, s=0x07299936… (EIP vector) | ext-unit |
| T-SIG-009 | SIG-03 | UNIT | P0 | — | normalizeTypedData with JSON string vs object; param order swapped; V1 array form | same normalized output; V1 → 4200 | ext-unit |
| T-SIG-010 | SIG-03 | NEG | P0 | — | missing types/primaryType/domain/message; primaryType not in types; typed data > 200 KiB; invalid JSON | -32602 | ext-unit |
| T-SIG-011 | SIG-03 | SEC | P0 | site on chain 1 | typed data with domain.chainId 137 / '0x89' / '137' | refused or explicit chain-mismatch warning blocks signing (per service.ts:185) — assert refusal | ext-int |
| T-SIG-012 | SIG-03 | SEC | P0 | connected 0xA | typed data for address 0xB | 4100 'not authorized' | ext-int |
| T-SIG-013 | SIG-03 | UNIT | P1 | — | summarizeTypedData on Permit, Permit2 PermitSingle/Batch, Seaport order, DAI permit (allowed flag), unlimited amount | approval summary with token, spender, amount, unlimited flag, expiry | ext-unit |
| T-SIG-014 | SIG-03 | PROP | P1 | — | random valid EIP-712 type trees (fast-check generator) | `typedDataDigest` equals viem `hashTypedData`; signature recovers signer | ext-prop |
| T-SIG-015 | SIG-03 | PROP | P1 | — | fuzz normalizeTypedData with arbitrary JSON | throws only ProviderError(-32602/4200), never TypeError | ext-fuzz |
| T-SIG-016 | SIG-05 | INT | P0 | connected chain 11155111, mock RPC + mock backend | eth_sendTransaction {from: me, to, value, data} approve in window | signed EIP-1559 tx with chainId 11155111, nonce from pending count, broadcast via /v1/tx/sepolia/broadcast, returns hash = keccak(raw) | ext-int |
| T-SIG-017 | SIG-05 | SEC | P0 | pending tx | site switches chain (wallet_switchEthereumChain) then user approves | 4100 'switched networks while pending'; nothing signed | ext-int |
| T-SIG-018 | SIG-05 | SEC | P0 | pending tx | user switches active account then approves | 4100 'connected account changed'; nothing signed | ext-int |
| T-SIG-019 | SIG-05 | NEG | P0 | — | from ≠ connected; value negative / >2^256; gas non-hex; data odd length; to invalid; chainId param mismatch | -32602 / 4100 | ext-unit |
| T-SIG-020 | SIG-05 | SEC | P0 | mainnet chain, build pointing at http loopback backend in release mode | eth_sendTransaction | refused by signing policy (mainnetSigningReady false) | ext-unit |
| T-SIG-021 | SIG-05 | RES | P1 | broadcast returns 503 then 200 | approve | retry with same raw bytes (idempotent key); single tx hash returned | ext-int |
| T-SIG-022 | SIG-05 | E2E | P0 | fixture dApp + mock chain | connect → send tx → approve | dApp receives hash; activity shows pending then confirmed | ext-e2e |
| T-SIG-023 | SIG-06 | UNIT | P0 | — | evmTxRequest/evmTierFees slow/standard/fast, legacy chain (no baseFee) | maxFee=2·base+tip·pct; legacy gasPrice; 21000 gas exact for native; token transfer data = transfer(to, amount) | ext-unit |
| T-SIG-024 | SIG-06 | KAT | P0 | — | EIP-155 example (nonce 9, 20 gwei, 21000, to 0x3535…35, 1 ETH, chainId 1, key 0x4646…) built through `signEvmTx` legacy path | raw = 0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83 (EIP-155 vector); hash = keccak256(raw) | ext-int |
| T-SIG-025 | SIG-06 | UNIT | P1 | — | sendService preflight: recipient contract code, insufficient native for fee, token amount > balance, estimate failure fallback | issues list with blocking flags; warning text for contract recipient | ext-unit |
| T-SIG-026 | SIG-07 | KAT | P0 | test mnemonic | build+sign one transfer per family (Solana, BTC P2WPKH, Cosmos, Tron, TON, Sui, Aptos, Near, Polkadot, Stellar, XRP, Tezos, Algorand, Cardano, Filecoin, Harmony, ICON, MultiversX, Theta, VeChain, Waves, Zilliqa, IoTeX) with mocked network inputs | signed payload equals pinned golden (wallet-core deterministic signing); signature verifies with family verifier where available | ext-int |
| T-SIG-027 | SIG-07 | NEG | P0 | — | per family: invalid recipient, zero/negative amount, amount with too many decimals, memo too long, dust below minimum | blocking issue, no signing | ext-unit |
| T-SIG-028 | SIG-07 | PROP | P1 | — | parseUnits/formatUnits (send/util) random bigints and decimals 0..36 | formatUnits(parseUnits(x,d),d) == normalized x; never float rounding | ext-prop |
| T-SIG-029 | SIG-08 | INT | P0 | Solana connected | signMessage (UTF-8), signTransaction (legacy + v0), signAllTransactions, signAndSendTransaction with mock RPC | signatures verify with ed25519 over message bytes; fee payer must be me; send broadcasts via RPC | ext-int |
| T-SIG-030 | SIG-08 | SEC | P0 | — | signMessage with bytes that parse as a transaction message | refused or flagged as transaction (looksLikeSolMessage) — no blind tx signing via signMessage | ext-unit |
| T-SIG-031 | SIG-08 | PROP | P1 | — | fuzz parseSolanaTx / solanaTx decoders with random bytes | never throws non-ProviderError; never reads out of bounds | ext-fuzz |
| T-SIG-032 | SIG-09 | INT | P1 | multi connected (cosmos, sui, aptos, ton, tron, btc) | sign requests per chain | correct curve/format; address mismatch refused; PSBT inputs not owned → refused/flagged | ext-int |
| T-SIG-033 | SIG-09 | KAT | P1 | — | TON proof (ton_proof v2 spec example), Cosmos ADR-036 signArbitrary example | match spec vectors | ext-unit |
| T-SIG-034 | SIG-09 | PROP | P2 | — | fuzz psbt.ts parser | no crash; bounded memory | ext-fuzz |
| T-SIG-035 | SIG-10 | UNIT | P0 | — | evmSigningBasis for harbour mainnet id, testnet id, custom id, unknown, '0x1', 1n, -1, '', null, 2^64 | basis values per policy; null for unknown/invalid | ext-unit |
| T-SIG-036 | SIG-10 | SEC | P0 | — | isSigningChain for non-EVM chain ids not in CHAIN_IDS | false | ext-unit |
| T-SIG-037 | SIG-11 | INT | P1 | — | sessionFor(chain) across minute boundary; estimate→broadcast share X-HB-Session | same session within a minute; backend pins upstream | ext-int |
| T-SIG-038 | SIG-12 | UNIT | P0 | — | parseSiwe on EIP-4361 example; siweIssues with mismatched domain/address/chain | parsed fields; issues ['domain'],['address'],['chain'] | ext-unit |
| T-SIG-039 | SIG-12 | PROP | P2 | — | fuzz parseSiwe / siws | never throws; returns null or object | ext-fuzz |
| T-SIG-040 | SIG-13 | INT | P0 | pending request, wallet locked | providerResolve approve | {locked:true, error:'LOCKED'}; request stays pending | ext-int |
| T-SIG-041 | SIG-13 | SEC | P0 | prefs.biometricApproval on | providerResolve without fresh providerBioProof | refused | ext-int |
| T-SIG-042 | SIG-13 | SEC | P0 | site on blocklist (phishing high) top origin or embedding origin | approve | requires explicit risk acknowledgement; otherwise refused | ext-int |
| T-SIG-043 | SIG-13 | E2E | P0 | — | reject in approval window; close window | dApp receives 4001 user rejected; closing window rejects all non-internal pending | ext-e2e |
| T-SIG-044 | SIG-05 | UI | P1 | — | approval screen | origin shown first (HW-2026-017), amounts with symbol & decimals, warnings visible, buttons keyboard-accessible | ext-e2e |

## 3. dApp interaction (DAPP)

| Test ID | Feature | Cat | Pri | Preconditions | Input / action | Expected | Layer |
|---|---|---|---|---|---|---|---|
| T-DAPP-001 | DAPP-04 | UNIT | P0 | — | parsePageRequest valid {id,ns,method,params} | ok with deep copy; extra keys dropped | ext-unit |
| T-DAPP-002 | DAPP-04 | NEG | P0 | — | null, array, id missing/65 chars/with spaces, ns 'btc', method 'a.b', params with function/symbol/bigint/NaN/Infinity/undefined, depth 25, 20001 nodes, 256 KiB+1 JSON | ok:false with -32600/-32602 and id echoed when parseable | ext-unit |
| T-DAPP-003 | DAPP-04 | SEC | P0 | — | params containing `__proto__`, `constructor`, `prototype` keys (also nested, also via JSON.parse) | rejected; Object.prototype unmodified after call | ext-unit |
| T-DAPP-004 | DAPP-04 | PROP | P0 | — | fuzz parsePageRequest with fast-check `anything()` | never throws; ok ⇒ output JSON-serialisable and ≤256 KiB | ext-fuzz |
| T-DAPP-005 | DAPP-05 | UNIT | P0 | — | specFor for every method in EVM/SOLANA/MULTI tables; 'toString', '__proto__', 'hasOwnProperty' | spec or null; prototype names → null | ext-unit |
| T-DAPP-006 | DAPP-05 | NEG | P1 | — | each UNSUPPORTED_EVM method via content script | 4200 without reaching background | ext-unit |
| T-DAPP-007 | DAPP-03 | SEC | P0 | content script loaded | HELLO with bad nonce format; from another window (iframe postMessage to parent); second HELLO after ack; origin mismatch | ignored; first valid channel wins | ext-unit (jsdom) |
| T-DAPP-008 | DAPP-03 | INT | P1 | content loads after inpage | inpage retries | channel established within 200 tries; requests queued until ack | ext-unit (jsdom) |
| T-DAPP-009 | DAPP-06 | NEG | P1 | — | duplicate request id in flight; 201 inflight | -32600 duplicate; -32005 limit | ext-unit |
| T-DAPP-010 | DAPP-06 | RES | P0 | inflight requests | background port disconnects (SW restart) | reconnect with backoff; inflight requests re-sent; background dedupes via takeSettled (no double approval) | ext-int |
| T-DAPP-011 | DAPP-06 | RES | P1 | extension reloaded (runtime.id undefined) | request | fatal message; all inflight rejected with 'Harbour was reloaded…'; provider emits disconnect 4900 | ext-unit |
| T-DAPP-012 | DAPP-07 | SEC | P0 | — | port sender: chrome-extension URL; no tab; frameId missing; origin 'null' (sandboxed iframe); http://evil.com; https; http://localhost | rejected (4100 answers) for the first five; accepted for https & loopback | ext-int |
| T-DAPP-013 | DAPP-07 | SEC | P0 | evil.com iframe embedded in good.com which is connected | iframe requests eth_accounts / sign | origin = evil.com (not good.com); not connected → [] / 4100 | ext-int |
| T-DAPP-014 | DAPP-07 | UNIT | P1 | — | normalizeOrigin: 'https://a.com/path?x', 'https://A.COM:443', 'http://127.0.0.1:8545', 'ftp://x', 'javascript:alert(1)', '' | origin strings / null | ext-unit |
| T-DAPP-015 | DAPP-08 | INT | P0 | — | eth_requestAccounts → approve → eth_accounts; disconnect via settings; revoke via wallet_revokePermissions | accounts [me]; after disconnect [], accountsChanged [] and disconnect events to that origin only | ext-int |
| T-DAPP-016 | DAPP-08 | SEC | P0 | site A connected | site B eth_accounts | [] (no cross-origin leakage) | ext-int |
| T-DAPP-017 | DAPP-08 | SEC | P0 | WalletConnect session for 'https://a.com' | injected a.com eth_accounts | not connected (separate key `#walletconnect`, PT-06) | ext-int |
| T-DAPP-018 | DAPP-08 | NEG | P1 | blacklisted origin | any request | 4100 blacklist message | ext-int |
| T-DAPP-019 | DAPP-08 | UNIT | P1 | — | PermissionStore connect/scoped/disconnect(ns)/revoke/isConnected/list with fake KV | correct records; namespaces tracked; storage shape stable | ext-unit |
| T-DAPP-020 | DAPP-09 | UNIT | P0 | fake clock | PendingStore add beyond MAX_PENDING_TOTAL, per-origin cap, TTL expiry 15 min, settled 5 min | oldest rejected / limit error; expired removed by gc; settled retrievable once | ext-unit |
| T-DAPP-021 | DAPP-09 | CONC | P0 | — | same request id resent after SW restart while approval pending | single pending entry; outcome delivered once | ext-int |
| T-DAPP-022 | DAPP-09 | SEC | P0 | pending sign from tab 1 doc A | tab navigates (new documentId) then user approves | outcome not delivered to new document; request dropped (dropFor) | ext-int |
| T-DAPP-023 | DAPP-10 | UNIT | P0 | fake clock | RateLimiter capacity/refill, maxKeys eviction | tokens refill linearly; 501st key evicts oldest | ext-unit |
| T-DAPP-024 | DAPP-10 | NEG | P0 | — | 7 eth_requestAccounts in 1 s from one origin | 7th refused -32005; approval window not spammed | ext-int |
| T-DAPP-025 | DAPP-11 | INT | P1 | connected | wallet_switchEthereumChain to known chain; to unknown chain | chainChanged event; 4902 for unknown | ext-int |
| T-DAPP-026 | DAPP-11 | SEC | P0 | — | wallet_addEthereumChain rpcUrls: http://192.168.1.1, http://10.0.0.1, http://169.254.169.254, http://[::1], http://printer.local, http://localhost:8545, https://rpc.example | private ones refused before any fetch; loopback & public accepted | ext-unit |
| T-DAPP-027 | DAPP-11 | SEC | P0 | — | add chain where RPC reports different chain id than requested | refused | ext-int |
| T-DAPP-028 | DAPP-11 | NEG | P1 | — | chainId non-hex, leading zero '0x01', > 2^53, nativeCurrency decimals ≠18, name with control chars, explorer javascript: URL | -32602 | ext-unit |
| T-DAPP-029 | DAPP-11 | CONC | P2 | — | two add-chain approvals for same id race; SW restart before network list loaded | single entry; stored list not overwritten (networksReady) | ext-int |
| T-DAPP-030 | DAPP-11 | UNIT | P1 | — | isPrivateNetworkUrl with decimal/octal/hex IPv4 forms (normalised by URL parser), 0.0.0.0, 224.0.0.1, 100.64.0.1, 'intranet' (no dot) | true; documented ASM-11 for DNS names | ext-unit |
| T-DAPP-031 | DAPP-12 | UNIT | P1 | — | sanitizeToken: decimals 0..36 / 37 / -1 / 1.5; symbol with RTL override; address checksum invalid; 101st token | valid / error per rule; cleaned symbol | ext-unit |
| T-DAPP-032 | DAPP-13 | INT | P1 | connected chain | eth_call, eth_getBalance, eth_sendRawTransaction passthrough | proxied to selected network RPC; results returned; rate limited per origin | ext-int |
| T-DAPP-033 | DAPP-13 | SEC | P1 | not connected | eth_call | allowed (read-only) or refused per spec — assert current behaviour and that no account data is implied | ext-int |
| T-DAPP-034 | DAPP-14 | INT | P1 | two tabs same origin, one other origin | change active account / chain | events only to tabs of connected origin; event names filtered by EVENT_ALLOWLIST | ext-int |
| T-DAPP-035 | DAPP-14 | SEC | P0 | — | storage.onChanged handler | init messages never include storage values or session key material (only public InitState fields) | ext-int |
| T-DAPP-036 | DAPP-15 | UNIT | P0 | — | checkHost: exact, subdomain, whitelist override, punycode, uppercase, trailing dot | blocked/ok per eth-phishing-detect semantics | ext-unit |
| T-DAPP-037 | DAPP-15 | RES | P1 | list fetch fails / returns HTML / > 6 MB | siteRisk | 'unavailable' (no false 'ok' claim); cache not persisted when too large | ext-unit |
| T-DAPP-038 | DAPP-15 | SEC | P0 | embedding origin blocklisted, iframe origin clean | approval | high risk detected via topOrigin | ext-int |
| T-DAPP-039 | DAPP-16 | UNIT | P2 | — | isBlockedDomain('x.com'), 'sub.x.com', 'notx.com', EXCLUDE_MATCHES patterns valid match patterns | true, true, false; patterns valid | ext-unit |
| T-DAPP-040 | DAPP-17 | INT | P1 | fake WalletKit | pair URI, session proposal approve/reject, request routed through ProviderService with same validation, chain add on chainChanged, disconnect | identical checks to injected path; permission key `<origin>#walletconnect` | ext-int |
| T-DAPP-041 | DAPP-17 | MIG | P1 | pre-PT-06 sessions sharing injected key | resume | sessions ended once and shared record removed | ext-int |
| T-DAPP-042 | DAPP-17 | NEG | P1 | — | malformed pairing URI, unknown chain namespaces, request for unapproved method | errors returned to peer; no crash | ext-int |
| T-DAPP-043 | DAPP-18 | UNIT | P0 | — | decodeCalldata for transfer, transferFrom, approve (limited/unlimited ≥2^159), increaseAllowance, setApprovalForAll(true/false), permit, multicall nested 4 deep, unknown selector, truncated data | correct DecodedCall; flattenCalls stops at depth 3; unknown → 'unknown' (flagged undecodable, A3) | ext-unit |
| T-DAPP-044 | DAPP-18 | PROP | P1 | — | fuzz decodeCalldata with random hex | never throws | ext-fuzz |
| T-DAPP-045 | DAPP-18 | UNIT | P1 | — | plainLabel/displayText with bidi overrides U+202E, zero-width, newlines, 1000 chars | stripped & truncated | ext-unit |
| T-DAPP-046 | DAPP-19 | INT | P2 | fake chrome.scripting | registerInpage twice | update path on duplicate id; MAIN world, all frames, document_start | ext-unit |
| T-DAPP-047 | DAPP-20 | INT | P1 | pending from tab | tab closed; approval window closed | pending dropped / rejected (non-internal) | ext-int |
| T-DAPP-048 | DAPP-01 | UNIT | P1 | jsdom inpage | window.ethereum.request, send (legacy), sendAsync, isConnected, on/removeListener, EIP-6963 announceProvider on requestProvider event | spec-compliant behaviour; no `isTrust`/`trustwallet` impersonation (HW-2026-010) | ext-unit |
| T-DAPP-049 | DAPP-01/DAPP-02 | SEC | P1 | — | page overwrites window.ethereum methods / prototype | wallet's internal bridge unaffected (closures), handshake still private | ext-unit |
| T-DAPP-050 | DAPP-02 | UNIT | P2 | jsdom | solana provider connect({onlyIfTrusted:true}) when not trusted | 4100 'not trusted yet' | ext-unit |
| T-DAPP-051 | DAPP-01..20 | E2E | P0 | Playwright + fixture dApp (`tools/e2e/dapp`) | connect, personal_sign, typed sign, send, switch chain, add chain, watch asset, disconnect | each flow end-to-end through real content script + SW + approval window | ext-e2e |
| T-DAPP-052 | DAPP-07 | E2E | P0 | Playwright | cross-origin iframe on fixture dApp attempts eth_requestAccounts | approval shows iframe origin, not top origin; top-origin risk evaluated | ext-e2e |
| T-DAPP-053 | DAPP-10 | PERF | P2 | — | 1000 eth_blockNumber reads from one page | served within rate limits, SW memory stable | ext-perf |
