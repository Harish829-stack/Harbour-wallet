# Extension Wallet Security Audit Framework & Checklist

Oct 30, 2026 · @Harish

## 1. Purpose & scope

This framework sets out how to audit any self-custodial wallet built as a browser extension with a backend, end to end against public industry standards, at three assurance levels (L1, L2, L3) across 13 audit areas. Every control has an ID, a level, a source standard and a test method, so each audit run produces a pass/fail record for each control.

| Component | In scope | Notes |
| --- | --- | --- |
| Browser extension | Yes | MV3 service worker, popup UI, content scripts, injected provider, vault |
| Backend services & APIs | Yes | Everything the extension calls: auth, pricing, history, notifications, relays |
| Database(s) | Yes | Every datastore the backend uses, including caches and backups |
| RPC / node / indexer layer | Yes | Self-hosted or third-party providers that the extension or backend reads chain data from |
| Build, CI/CD & release pipeline | Yes | Includes Chrome Web Store / Firefox AMO publishing accounts |
| Smart contracts | No | Not covered here. If the wallet uses smart accounts, multisig or other contracts, add a section based on SCSVS or EEA EthTrust |
| Mobile app | No | Add an OWASP MASVS section if a mobile client is built |

**Self-custody principle:** the user's seed and private keys never leave the user's device, and the backend never holds them. Any finding that breaks this is Critical at every level.

## 2. Standards used and how they map

No single standard covers a self-custodial extension wallet with a backend. CCSS v9 governs the key lifecycle, OWASP ASVS 5.0 governs the backend and API, and the OWASP extension and Web3 wallet guidance covers the browser-specific attack surface. Every control in Sections 4–16 cites at least one of the standards below.

| Standard | Version | Applies to | Areas | Code used in this doc |
| --- | --- | --- | --- | --- |
| [CryptoCurrency Security Standard (CCSS)](https://cryptoconsortium.org/standards/) | v9.0 | Key generation, storage, usage, compromise, audits, logs | A, B, C, D, L, M | CCSS 1.01.x – 2.04.x |
| [OWASP ASVS](https://quality.arc42.org/standards/owasp-asvs) | 5.0.0 (May 2025) | Backend, API, auth, crypto, data protection, logging | G, H, J, L | ASVS V1–V16 |
| [OWASP Browser Extension Vulnerabilities Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html) | Current | MV3 permissions, CSP, storage, message passing, DOM skimming | B, E, F | OWASP-EXT-1 – 13 |
| [OWASP Web3 Wallet Security project](https://owasp.org/www-project-web3-wallet-security/) | In development | Wallet Top 10, WWSVS, WWSTG | C, F | OWASP-W3W |
| [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | Current | KDF for vault password, backend password hashing | B, G | OWASP-PSC |
| BIP-39 / BIP-32 / BIP-44, SLIP-44 | Final | Mnemonic, HD derivation, derivation paths | A, D | BIP-xx |
| EIP-1193, EIP-6963, EIP-712, EIP-191, EIP-155 | Final | Provider API, provider discovery, typed-data signing, chain-ID replay protection | C, E, F | EIP-xxxx |
| [CIS PostgreSQL Benchmark](https://www.crunchydata.com/blog/postgres-security-checklist-from-the-center-for-internet-security) (or the CIS benchmark for your DB engine) | v1.0 for PG 17 | Database hardening | H | CIS-DB |
| [SLSA](https://slsa.dev/spec/v1.0/levels) | v1.0 | Build provenance and supply chain | K | SLSA L1–L3 |

**Not covered by any public wallet standard:** RPC and indexer data integrity (Area I). Controls there are derived from the threat model and from the CCSS address-verification clause 1.02.4.

## 3. Audit levels

The levels are cumulative: L2 includes every L1 control, and L3 includes every L2 control. A wallet should pass L1 before public launch, L2 before handling meaningful user funds at scale, and L3 for high-assurance certification.

| Level | Meaning | When a wallet needs it | CCSS equivalent | ASVS equivalent | Who performs it |
| --- | --- | --- | --- | --- | --- |
| **L1 — Baseline** | Critical first-layer defences against the most common wallet and web attacks | Before public beta or store listing | Level I | L1 | Internal security team plus automated scanners |
| **L2 — Production** | Defence against targeted attackers: phishing, malicious dApps, supply chain, backend abuse | Before general availability or a marketing push | Level II | L2 | Internal team plus an independent pen-test firm |
| **L3 — High assurance** | Defence in depth, formal processes, and independent verification of all controls | For certification, enterprise partners, or a high TVL | Level III | L3 | Independent third-party auditor (e.g. a CCSS Auditor) |

**How to read the checklists.** Each area in Sections 4–16 has one table. *Level* is the lowest level at which a control is required. *Result* is for the auditor to fill in: Pass, Fail, Partial, or N/A, with a link to evidence.

## 4. Area A — Key & seed generation

The goal is to show that every seed is generated from a CSPRNG, entirely on the device, with nothing observing it.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| A-01 | Entropy comes only from `crypto.getRandomValues` (Web Crypto). No `Math.random`, timestamps, or user-chosen phrases | L1 | CCSS 1.01.2 | Grep the source for RNG calls; trace the mnemonic generation path |  |
| A-02 | Mnemonic follows BIP-39 with at least 128 bits of entropy (12 words), and the checksum is validated on import | L1 | CCSS 1.01.2, BIP-39 | Unit test with BIP-39 vectors; import a bad-checksum phrase and confirm rejection |  |
| A-03 | HD derivation follows BIP-32/44 with the correct SLIP-44 coin types per chain | L1 | CCSS 1.02.6, BIP-32/44 | Derive addresses from the standard test mnemonic and compare against reference wallets |  |
| A-04 | Seed generation happens entirely client-side; no seed, entropy, or key is sent to the backend, analytics, or error reporting | L1 | CCSS 1.01.1 | Proxy all traffic (Burp/mitmproxy) during onboarding; search payloads for seed material |  |
| A-05 | Crypto libraries are well-known and pinned (e.g. @scure/bip39, @noble/\*, ethers) with integrity hashes | L1 | CCSS 1.01.3 | Review the lockfile and SBOM; check versions against advisories |  |
| A-06 | The key-generation procedure is documented: libraries, derivation paths, supported chains | L1 | CCSS 1.01.5 | Document review |  |
| A-07 | Generated seeds pass statistical randomness testing over a large sample in CI | L2 | CCSS 1.01.6 | Generate 10k+ seeds in test mode; run NIST STS or dieharder |  |
| A-08 | Intermediate entropy buffers are zeroed after use and never logged | L2 | CCSS 1.01.1 | Code review; heap snapshot of the service worker after onboarding |  |
| A-09 | The key-generation code path is reviewed by an independent cryptography reviewer | L2 | CCSS 1.01.6 | Third-party review report |  |
| A-10 | Optional user-added entropy (dice, BIP-39 passphrase / 25th word) is supported and correctly mixed in | L3 | CCSS 1.01.7 | Test vectors with a passphrase; review the mixing logic |  |
| A-11 | Hardware wallet support (Ledger/Trezor) lets keys be generated and kept off the browser entirely | L3 | CCSS 1.01.7, 1.03.6 | Functional test of HW onboarding; confirm no key material reaches the extension |  |

## 5. Area B — Key storage & vault encryption

The goal is to show that the encrypted vault resists offline brute force, and that decrypted keys exist only in memory and only while the wallet is unlocked. Extension storage is not encrypted by the browser, so the vault's own encryption is the only protection ([OWASP-EXT-9](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html)).

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| B-01 | The vault (seed and imported keys) is encrypted with AES-256-GCM, with a unique random salt and IV for every encryption | L1 | CCSS 1.03.1, ASVS V11 | Dump `chrome.storage.local`; inspect the vault format; check that the IV never repeats across saves |  |
| B-02 | The password KDF meets OWASP minimums: Argon2id (m=19 MiB, t=2, p=1) or PBKDF2-HMAC-SHA256 with at least 600,000 iterations | L1 | OWASP-PSC, CCSS 1.03.1 | Read the KDF params from the code and the vault header |  |
| B-03 | Minimum password length is 8 or more, with a strength meter; no maximum below 64 characters | L1 | ASVS V6 | UI test |  |
| B-04 | No plaintext seed, key, or password is in `localStorage`, `chrome.storage`, IndexedDB, logs, or crash reports | L1 | OWASP-EXT-9, CCSS 1.03.1 | Inspect storage with DevTools; grep logs and Sentry payloads |  |
| B-05 | Decrypted key material is kept only in service-worker memory or `chrome.storage.session` (restricted from content scripts), never in the popup or page DOM | L1 | OWASP-EXT-9, EXT-11 | Code review; check the `setAccessLevel` setting on session storage |  |
| B-06 | Auto-lock after a configurable idle timeout and on browser restart; lock wipes decrypted keys from memory | L1 | CCSS 1.05.1 | Functional test; heap snapshot after lock |  |
| B-07 | Unlock attempts are rate-limited with backoff | L2 | ASVS V6 | Script repeated unlock attempts |  |
| B-08 | The KDF version is stored in the vault, and migration to stronger params happens transparently on unlock | L2 | CCSS 1.03.1 | Seed an old-format vault; unlock; confirm the re-encryption |  |
| B-09 | Revealing the seed or exporting a private key requires password re-entry, a warning screen, and an anti-screenshot/clipboard warning; the clipboard auto-clears | L2 | CCSS 1.03.5 | UI test; check the clipboard after timeout |  |
| B-10 | Memory hygiene: key buffers use `Uint8Array` and are zeroed after signing; no keys in long-lived JS strings | L2 | CCSS 1.03.5 | Code review; heap snapshot diffing |  |
| B-11 | Offline brute-force cost estimate: an extracted vault with a 10-char password costs more than a defined USD threshold to crack | L3 | CCSS 1.03.1 | Run hashcat benchmarks against a test vault; document the result |  |
| B-12 | Hardware-backed key option: Ledger/Trezor or passkey (WebAuthn PRF) wrapping of the vault key | L3 | CCSS 1.03.6 | Functional test; review the key-wrapping design |  |

## 6. Area C — Transaction signing security

The goal is to show that the user always sees exactly what they are signing, and that nothing gets signed without explicit approval in the extension's own UI.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| C-01 | Every signature (tx, `personal_sign`, `eth_signTypedData_v4`) needs explicit approval in the popup; nothing is auto-signed | L1 | CCSS 1.05.1 | Trigger every RPC sign method from a test dApp |  |
| C-02 | The confirmation screen shows the decoded recipient, amount, token, network, fee and requesting origin, all taken from the request rather than from dApp-supplied labels | L1 | CCSS 1.05.1, OWASP-W3W | Send crafted requests with misleading metadata |  |
| C-03 | Chain ID is enforced (EIP-155) and must match the selected network; a mismatch is blocked or warned | L1 | EIP-155 | Send a tx with a wrong `chainId` |  |
| C-04 | `eth_sign` (raw hash signing) is disabled, or gated behind a strong warning | L1 | OWASP-W3W | Call `eth_sign` from a test dApp |  |
| C-05 | EIP-712 typed data is fully decoded, with domain (name, chainId, verifyingContract) and message fields shown; domain chainId is validated | L1 | EIP-712 | Send Permit / Permit2 / Seaport payloads |  |
| C-06 | Approvals are flagged: `approve`, `setApprovalForAll`, Permit/Permit2, showing spender and amount, with a warning on unlimited approvals | L2 | OWASP-W3W | Request unlimited approvals; check the UI |  |
| C-07 | Transaction simulation shows the expected balance changes before signing | L2 | OWASP-W3W | Compare simulation output to actual on-chain results on a testnet |  |
| C-08 | Address poisoning defence: lookalike addresses from history are flagged, and the full address can be viewed | L2 | CCSS 1.05.4 | Seed history with a lookalike address; attempt a send |  |
| C-09 | Nonce and gas are computed locally or validated; dApp-supplied gas values are bounded | L2 | CCSS 1.05.1 | Send absurd gas values |  |
| C-10 | The signing request queue cannot be spammed or reordered; each request is bound to its origin and shown one at a time | L2 | OWASP-EXT-13 | Flood requests from a malicious page |  |
| C-11 | Address book / allowlist for trusted recipients, with a first-time-recipient warning | L3 | CCSS 1.05.4 | Functional test |  |
| C-12 | Hardware wallet signing shows the same details on the device's trusted display | L3 | CCSS 1.05.5 | Ledger/Trezor clear-signing test |  |

## 7. Area D — Backup, recovery & key compromise

The goal is to show that users can always recover their funds from the seed alone, and that the wallet team has a tested playbook for when keys or the extension itself are compromised.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| D-01 | Onboarding forces a seed backup confirmation (re-enter selected words) before funds can be received | L1 | CCSS 1.03.2 | Onboarding UI test |  |
| D-02 | Restoring from the seed in the wallet under audit and in a reference wallet (e.g. MetaMask) produces identical addresses | L1 | CCSS 1.03.2, BIP-44 | Cross-wallet restore test |  |
| D-03 | No cloud or server backup of the seed, unless it is end-to-end encrypted with a key the backend never sees | L1 | CCSS 1.03.3 | Traffic and design review |  |
| D-04 | A documented key-compromise procedure: user guidance to move funds, revoke approvals and rotate | L1 | CCSS 1.06.1 | Document review |  |
| D-05 | Extension-compromise procedure: how to push an emergency update, pull a store listing, and notify users | L1 | CCSS 1.06.1 | Document review |  |
| D-06 | The “forgot password” flow restores only via the seed; there is no backend reset path | L2 | CCSS 1.03.5 | Functional test |  |
| D-07 | The compromise procedures are rehearsed at least annually (tabletop or drill), with results recorded | L2 | CCSS 1.06.3 | Drill report |  |
| D-08 | A user guide covers geographically separate seed backups (metal/paper) | L2 | CCSS 1.03.4 | Help-centre review |  |
| D-09 | Out-of-band communication channel for incidents (status page, signed announcements) that does not depend on the extension | L3 | CCSS 1.06.4 | Review the channel and test it |  |
| D-10 | Optional Shamir (SLIP-39) or social recovery, designed and reviewed independently | L3 | CCSS 1.03.4 | Third-party design review |  |

## 8. Area E — Browser extension (MV3) security

The goal is to show that no web page, other extension, or compromised renderer can reach privileged wallet logic or read sensitive data. The controls map directly to the 13 risks in the [OWASP Browser Extension Vulnerabilities Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html).

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| E-01 | Least-privilege manifest: only required `permissions`; no `<all_urls>` unless justified; `optional_host_permissions` preferred | L1 | OWASP-EXT-1 | Manifest review; justify each permission |  |
| E-02 | Strict CSP on `extension_pages`: `script-src 'self'`; no `unsafe-eval`, no remote script hosts | L1 | OWASP-EXT-5, EXT-8 | Manifest review; attempt inline script injection |  |
| E-03 | No `eval`, `new Function`, `innerHTML`, or `dangerouslySetInnerHTML` with untrusted data; any HTML that must be rendered is sanitised with DOMPurify | L1 | OWASP-EXT-3 | Semgrep / ESLint security rules; manual review |  |
| E-04 | No remotely hosted code; all logic ships in the signed package | L1 | OWASP-EXT-6 | Review network calls for fetched JS |  |
| E-05 | Every `runtime.onMessage` / `onMessageExternal` handler validates `sender.id` and `sender.origin`, and allowlists the action names and parameter schemas | L1 | OWASP-EXT-13 | Fuzz the message handlers from a content script and from a hostile page |  |
| E-06 | `externally_connectable` is absent or narrowly scoped | L1 | OWASP-EXT-13 | Manifest review |  |
| E-07 | `web_accessible_resources` is minimal and scoped with `matches`; it cannot be used for fingerprinting or clickjacking | L1 | OWASP-EXT-1 | Manifest review; attempt to load resources from a third-party origin |  |
| E-08 | No sensitive data (balances, addresses, keys) is rendered into the page DOM or page JS context; sensitive UI is in the popup or side panel only | L1 | OWASP-EXT-11, EXT-12 | Inspect the page DOM and window objects on a dApp site |  |
| E-09 | Injected provider (EIP-1193) exposes only the documented API and holds no secrets; it is announced via EIP-6963 | L2 | EIP-1193, EIP-6963 | Review the inpage script; enumerate `window.ethereum` properties |  |
| E-10 | Content script ↔ service worker channel resists prototype pollution and spoofed `postMessage` (check `event.source` and origin) | L2 | OWASP-EXT-12, EXT-13 | Prototype-pollution and postMessage spoofing tests |  |
| E-11 | Clickjacking: the popup and extension pages cannot be framed by websites | L2 | OWASP-EXT-7 | Attempt to iframe extension pages |  |
| E-12 | MV3 service-worker lifecycle: state survives termination without persisting secrets in plaintext; relock behaviour is defined | L2 | OWASP-EXT-9 | Force-terminate the SW (chrome://serviceworker-internals); verify state |  |
| E-13 | Privacy policy and data-collection disclosure match actual telemetry; opt-out is available | L2 | OWASP-EXT-2, EXT-10 | Compare the policy to observed traffic |  |
| E-14 | Compromised-renderer resilience: the service worker never trusts claims from content scripts about origin or user intent | L3 | OWASP-EXT-13 | Threat-model review; simulate a malicious content-script message |  |
| E-15 | Independent extension pen test by a firm with wallet experience | L3 | CCSS 2.01.2 | Third-party report |  |

## 9. Area F — dApp connection & phishing protection

The goal is to show that a site only gets the access the user granted, and that known-malicious sites are blocked before the user is asked to sign anything.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| F-01 | `eth_requestAccounts` needs explicit per-origin approval; sites see no accounts before that | L1 | EIP-1193 | Call `eth_accounts` from an unconnected site |  |
| F-02 | Connections are scoped by exact origin (scheme + host + port), not by domain suffix; subdomains are not auto-trusted | L1 | OWASP-EXT-13 | Connect on `a.example.com`; test from `b.example.com` |  |
| F-03 | The origin shown in prompts comes from the browser (`sender.origin`), not from page-supplied metadata | L1 | OWASP-W3W | Spoof the site name or icon via page metadata |  |
| F-04 | Users can view and revoke connected sites, and per-site permissions | L1 | OWASP-W3W | UI test |  |
| F-05 | Phishing blocklist check before connect or sign (e.g. MetaMask eth-phishing-detect, ChainPatrol, or your own list), with updates at least daily | L2 | OWASP-W3W | Visit a listed domain; verify the block screen |  |
| F-06 | Punycode / IDN homograph domains are shown in punycode or flagged | L2 | OWASP-W3W | Visit a homograph test domain |  |
| F-07 | `wallet_addEthereumChain` / `wallet_switchEthereumChain` require approval and show the RPC URL; known chain IDs with a non-canonical RPC trigger a warning | L2 | OWASP-W3W | Add a chain with a malicious RPC |  |
| F-08 | `wallet_watchAsset` validates token contract data; spoofed symbols are flagged | L2 | OWASP-W3W | Add a token with a fake symbol |  |
| F-09 | Malicious-contract / drainer detection before signing (threat intel on the destination contract) | L3 | OWASP-W3W | Use known drainer test contracts on a testnet |  |
| F-10 | Approval-revoke tooling inside the wallet (list token approvals, one-click revoke) | L3 | OWASP-W3W | Functional test |  |

## 10. Area G — Backend & API security

The goal is to show that the backend cannot be abused to harm users or to learn more about them than it needs to, and that a full backend compromise still cannot move user funds. The full requirement lists are in [ASVS 5.0](https://quality.arc42.org/standards/owasp-asvs) chapters V1–V16. Run each chapter at the level being audited; the rows below are the wallet-critical subset.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| G-01 | Architecture review confirms the backend has no path to user keys or signing | L1 | CCSS 1.01.1, ASVS V15 | Design review; data-flow diagram |  |
| G-02 | Input validation and encoding on every endpoint (addresses, amounts, chain IDs, pagination) | L1 | ASVS V1, V2 | DAST (ZAP/Burp) plus manual fuzzing |  |
| G-03 | API authentication: signed requests or SIWE (EIP-4361) where user binding is needed; no static API keys shipped in the extension | L1 | ASVS V4, V6 | Extract the extension bundle; search for secrets; test unauthenticated access |  |
| G-04 | Authorisation: object-level checks (no IDOR on wallet or address data) | L1 | ASVS V8 | Swap user / address IDs in requests |  |
| G-05 | Rate limiting and abuse controls on every public endpoint | L1 | ASVS V2 | Load-test with k6; confirm 429s |  |
| G-06 | Secrets (RPC keys, DB creds, signing keys) are kept in a secrets manager, never in the repo or images | L1 | ASVS V13 | gitleaks / trufflehog scan; image inspection |  |
| G-07 | Security headers and CORS: an allowlist that includes only the extension origin (`chrome-extension://<id>`) | L1 | ASVS V3, V13 | Header scan; cross-origin requests |  |
| G-08 | SSRF protection on any URL-fetching feature (token metadata, NFT images, ENS avatars) | L2 | ASVS V1, V12 | SSRF payloads to internal IPs and metadata endpoints |  |
| G-09 | Privacy: address-to-IP correlation is minimised; logs do not join IPs to wallet addresses | L2 | ASVS V14 | Log and data-model review |  |
| G-10 | Self-contained tokens (JWT): algorithm pinned, short expiry, audience checked | L2 | ASVS V9 | JWT attack tests (alg none, key confusion) |  |
| G-11 | Error handling leaks no stack traces or internals | L2 | ASVS V16 | Trigger errors; inspect responses |  |
| G-12 | Business-logic tests: price and fee manipulation, notification spoofing, relay or replay abuse | L2 | ASVS V2 | Manual abuse-case testing |  |
| G-13 | Full ASVS L3 verification across V1–V16 | L3 | ASVS L3 | Third-party ASVS audit |  |

## 11. Area H — Database security

The goal is to show that the database holds the minimum user data, is hardened to the CIS benchmark for its engine, and that a leaked backup reveals nothing useful. Examples use PostgreSQL; for any other engine, apply the matching CIS benchmark.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| H-01 | No key material, seeds, or vault passwords are stored, ever | L1 | CCSS 1.03.1 | Schema review; data-sampling search |  |
| H-02 | DB is not publicly reachable; it sits in a private subnet with access only from the app tier | L1 | CIS-DB, ASVS V13 | Port scan from the internet; review security groups |  |
| H-03 | Parameterised queries / ORM everywhere; no string-built SQL | L1 | ASVS V1 | SAST plus sqlmap against the APIs |  |
| H-04 | Least-privilege DB roles: the app user has no superuser or DDL rights; migrations run under a separate role | L1 | CIS-DB | Review `pg_roles` and grants |  |
| H-05 | TLS is required for all DB connections (`sslmode=verify-full`) | L1 | CIS-DB, ASVS V12 | Attempt a non-TLS connection |  |
| H-06 | Encryption at rest for the database, snapshots and backups | L1 | CIS-DB, ASVS V14 | Cloud config review |  |
| H-07 | Data minimisation: store only what features need (e.g. hashed device IDs, not raw IP + address pairs) | L2 | ASVS V14 | Data inventory review |  |
| H-08 | DB audit logging (pgaudit or equivalent) on auth, DDL and privileged access, shipped to a central log | L2 | CIS-DB, CCSS 2.04.2 | Config review; trigger events and confirm they are logged |  |
| H-09 | Backups are tested by a restore drill at least quarterly; retention is defined | L2 | CIS-DB | Restore-drill evidence |  |
| H-10 | Hardened config per the full CIS PostgreSQL benchmark (logging, auth methods `scram-sha-256`, extensions) | L2 | CIS-DB | Run a CIS-CAT or pgdsat scan |  |
| H-11 | Column-level or application-level encryption for sensitive fields (email, push tokens) with KMS-managed keys | L3 | ASVS V11, V14 | Design and code review |  |
| H-12 | Data sanitisation procedure for decommissioned DBs and disks, with evidence | L3 | CCSS 2.02.2 | Procedure plus evidence review |  |

## 12. Area I — RPC, node & indexer data integrity

The goal is to show that a lying or compromised RPC or indexer cannot trick a user into a harmful signature or show them false balances. No public wallet standard covers this area in depth, so these controls come from standard extension-wallet threat modelling.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| I-01 | RPC endpoints are HTTPS/WSS only, and provider API keys are not exposed in the extension (or are scoped and rate-limited) | L1 | ASVS V12, V13 | Bundle inspection; traffic review |  |
| I-02 | Data used in signing (nonce, chainId, gas) is not taken blindly from the indexer; it is validated against an RPC node | L1 | CCSS 1.02.4 | Return a malicious indexer response in a test env |  |
| I-03 | Failover: at least 2 independent RPC providers per chain, with health checks | L2 | Threat model | Kill the primary provider; observe behaviour |  |
| I-04 | Cross-provider consistency check for critical reads (balance before send, chainId, latest block) | L2 | Threat model | Inject a mismatching provider |  |
| I-05 | Indexer reorg handling: confirmations required before showing a tx as final; reorged txs are reverted in the UI | L2 | Threat model | Simulate a reorg on a local devnet (anvil) |  |
| I-06 | Self-hosted nodes and indexer: hardened hosts, RPC admin namespaces (`admin_`, `debug_`, `personal_`) disabled publicly | L2 | CIS benchmarks | Call admin methods externally |  |
| I-07 | Token and NFT metadata is treated as untrusted (sanitised names, no HTML/JS, SVGs sandboxed) | L2 | OWASP-EXT-3 | Mint a test token with an XSS name or SVG |  |
| I-08 | Light-client or proof verification (e.g. `eth_getProof`, Helios) for balances on critical flows | L3 | Threat model | Design review plus test |  |
| I-09 | Monitoring alerts on provider divergence, indexer lag beyond a threshold, and unusual chain events | L3 | CCSS 2.04.3 | Review alert rules; trigger a test alert |  |

## 13. Area J — Network & transport security

The goal is to show that all traffic is encrypted and authenticated end to end, and that internal services are not exposed.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| J-01 | TLS 1.2+ only (prefer 1.3), with strong ciphers, HSTS, and valid certificates on every public endpoint | L1 | ASVS V12 | testssl.sh / SSL Labs scan |  |
| J-02 | The extension makes no plain-HTTP requests, and all host permissions are `https://` | L1 | OWASP-EXT-4 | Manifest plus traffic review |  |
| J-03 | Responses from the backend are schema-validated in the extension before use | L1 | OWASP-EXT-4 | Return malformed responses through a proxy |  |
| J-04 | WAF / DDoS protection in front of the public API | L2 | ASVS V13 | Config review |  |
| J-05 | Internal service-to-service traffic uses mTLS or a private network, and admin panels are VPN or SSO only | L2 | ASVS V12 | Network diagram plus scan |  |
| J-06 | DNS security: DNSSEC or registrar lock, CAA records, and monitoring for subdomain takeover | L2 | Threat model | DNS review; takeover scan |  |
| J-07 | External attack-surface scan at least quarterly | L3 | CCSS 2.01.1 | Scan reports |  |

## 14. Area K — Supply chain & build integrity

The goal is to show that the extension users install is exactly the reviewed code, and that no dependency or publishing account can slip in a malicious update. This is the most common real-world way wallet extensions get drained.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| K-01 | Lockfile committed; installs use `npm ci` / `pnpm install --frozen-lockfile` | L1 | OWASP-EXT-7 | CI config review |  |
| K-02 | Dependency scanning (npm audit, Snyk, Dependabot) on every PR; no known high or critical vulns at release | L1 | OWASP-EXT-7, CCSS 2.01.1 | Scan report |  |
| K-03 | Chrome Web Store / AMO publisher accounts use hardware-key 2FA and are restricted to named owners | L1 | OWASP-EXT-6 | Account settings review |  |
| K-04 | Branch protection: reviewed PRs only, no direct pushes to main or release | L1 | SLSA L2 | Repo settings review |  |
| K-05 | Dependency allowlisting and install-script controls (e.g. LavaMoat `allow-scripts`, `ignore-scripts`) | L2 | OWASP-EXT-7 | Review config; add a test package with a postinstall script |  |
| K-06 | Build runs on a hosted CI with signed provenance (SLSA Build L2) | L2 | SLSA L2 | Verify the provenance attestation |  |
| K-07 | SBOM (CycloneDX/SPDX) generated for every release | L2 | SLSA | Check the release artefacts |  |
| K-08 | Runtime compartmentalisation of third-party code (e.g. LavaMoat policy) so a compromised dependency cannot reach keys | L3 | OWASP-EXT-7 | Policy review; malicious-dependency simulation |  |
| K-09 | Reproducible builds: a published package can be rebuilt from a tag and diffed byte for byte against the store package | L3 | SLSA L3 | Rebuild and diff |  |
| K-10 | Hardened, isolated build platform (SLSA Build L3) and two-person release approval | L3 | SLSA L3, CCSS 1.04.3 | Process and platform review |  |

## 15. Area L — Logging, monitoring & incident response

The goal is to show that security events are recorded without leaking user secrets, and that a compromise is detected and handled quickly.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| L-01 | Documented logging policy: what is logged, what must never be logged (seeds, keys, passwords, full IP + address pairs) | L1 | CCSS 2.04.1, ASVS V16 | Document review |  |
| L-02 | Security events are logged on the backend: auth failures, rate-limit hits, admin actions, config changes | L1 | CCSS 2.04.1, ASVS V16 | Trigger events; check the logs |  |
| L-03 | Extension error reporting scrubs sensitive fields before sending (Sentry `beforeSend` filters) | L1 | OWASP-EXT-2 | Force errors during signing; inspect payloads |  |
| L-04 | Incident response plan with roles, severity levels and contact tree, plus a security.txt / disclosure policy | L1 | CCSS 1.06.1 | Document review; check `/.well-known/security.txt` |  |
| L-05 | Tamper-evident log storage (append-only / WORM bucket), with alerts on critical events | L2 | CCSS 2.04.2 | Attempt to delete a log entry; trigger an alert |  |
| L-06 | Monitoring of the store listing and publisher account (unexpected version, ownership change) | L2 | OWASP-EXT-6 | Alert-rule review |  |
| L-07 | Bug bounty programme (e.g. Immunefi, HackerOne) with a defined scope and payouts | L2 | CCSS 2.01.2 | Programme review |  |
| L-08 | 1-year log retention, SIEM integration, and on-chain monitoring for mass-drain patterns across the wallet's users | L3 | CCSS 2.04.3 | SIEM config; detection-rule review |  |
| L-09 | IR plan exercised yearly with a post-mortem; mean time to emergency release measured | L3 | CCSS 1.06.3 | Exercise report |  |

## 16. Area M — Operations, people & access control

The goal is to show that the people and company keys behind the wallet are controlled. Users hold their own keys, but the wallet company holds keys that matter just as much: the store publisher account, code-signing keys, cloud root accounts and production DB credentials. CCSS key-access clauses 1.04.x apply to those.

| ID | Requirement | Level | Source | How to test | Result |
| --- | --- | --- | --- | --- | --- |
| M-01 | Inventory of company-held critical keys and accounts, each with a named owner | L1 | CCSS 1.02.3, 1.04.1 | Inventory review |  |
| M-02 | Onboarding and offboarding checklists grant and revoke access (repo, cloud, store, DB) within 24 h of leaving | L1 | CCSS 1.04.1, 1.04.2 | Sample recent leavers; check access |  |
| M-03 | SSO plus phishing-resistant MFA (hardware keys) for all staff on GitHub, cloud, store and email | L1 | ASVS V6 | IdP config review |  |
| M-04 | Least privilege: production access is role-based, reviewed quarterly | L2 | CCSS 1.04.3 | Access-review records |  |
| M-05 | Quorum (two-person) approval for releases, infra changes and access to the publisher account | L2 | CCSS 1.04.3 | Process evidence |  |
| M-06 | Background checks and annual security training (social engineering and crypto-specific phishing) for keyholders | L2 | CCSS 1.04.4 | HR records |  |
| M-07 | Independent penetration test at least annually and after major releases | L2 | CCSS 2.01.2 | Pen-test reports |  |
| M-08 | Formal keyholder registry with an audit trail of every grant and revoke | L3 | CCSS 1.04.5 | Registry review |  |
| M-09 | Full independent audit against this framework (CCSS Level III + ASVS L3) | L3 | CCSS 2.01.3 | Audit certificate |  |

## 17. Audit process

Each audit run goes through eight phases. Phases 3–5 cover all 13 areas at the target level. Phase 8 loops back to phase 7 until every Critical and High finding is closed.

1. **Prepare.** Freeze a commit and release build; collect the manifest, architecture and data-flow diagrams, the asset inventory and prior reports; pick the target level.
2. **Threat model.** Use STRIDE per component (extension, service worker, content script, backend, DB, RPC/indexer), with attacker profiles: malicious dApp, phishing site, malicious extension, compromised dependency, compromised RPC, insider, stolen laptop.
3. **Static review.** Manual code review of Areas A–C and E first (the key and signing paths), followed by SAST and secret scanning.
4. **Dynamic testing.** Test the extension against hostile test dApps, and the backend with DAST and manual API testing. Inspect the DB and cloud config.
5. **Process & document review.** Check the CCSS operational controls (D, L, M) against evidence.
6. **Report.** Rate findings using Section 18 and record the result for every control ID.
7. **Remediate.** Fix the findings, with owners and due dates.
8. **Re-test.** Verify each fix and update the control results. Sign off the level using Section 19.

| Phase | Tools |
| --- | --- |
| Static review | Semgrep (JS/TS security rules), ESLint `no-unsanitized`, CodeQL, gitleaks / trufflehog |
| Dependencies | npm audit, Snyk or OSV-Scanner, LavaMoat, CycloneDX generator |
| Extension testing | Chrome DevTools, chrome://serviceworker-internals, Burp Suite / mitmproxy, a custom malicious-dApp test harness |
| Chain testing | Anvil / Hardhat local devnets, testnets, Tenderly for simulation |
| Backend & API | OWASP ZAP, Burp Suite, k6, sqlmap |
| TLS & network | testssl.sh, nmap |
| Database | pgdsat / CIS-CAT, pgaudit |
| Vault cracking (B-11) | hashcat |

## 18. Severity rating & findings template

Severity is based on impact on user funds and keys first, and likelihood second.

| Severity | Definition | Wallet examples | Fix before |
| --- | --- | --- | --- |
| Critical | Direct loss of funds or key exposure, exploitable remotely or at scale | Seed sent to the backend; a web page can trigger signing without approval; malicious update path | Any release |
| High | Loss of funds that needs user interaction, or a mass privacy breach | Misleading confirmation screen; weak KDF; message handler without origin check | The level sign-off |
| Medium | Partial bypass of a defence, or a limited data leak | No phishing blocklist; missing rate limit; verbose errors | The next release cycle |
| Low | Hardening gap with no direct exploit path | Missing security header; over-broad but unused permission | Backlog, tracked |
| Info | Best-practice note | Code-quality or documentation suggestion | Optional |

**Finding template** (one per finding):

```markdown
### <PREFIX>-<YYYY>-<NNN>: <short title>
- Control ID(s): <e.g. E-05, C-02>
- Severity: Critical | High | Medium | Low | Info
- Component: extension | service worker | backend | DB | RPC/indexer | build
- Description: what is wrong
- Impact: what an attacker can do, and to whose funds/data
- Steps to reproduce: 1. ... 2. ...
- Evidence: screenshots, requests, code refs (file:line @ commit)
- Recommendation: specific fix
- Owner / due date:
- Status: Open | Fixed | Verified | Accepted risk
```

## 19. Level sign-off criteria

The framework has 139 controls: 63 at L1, 51 more at L2 (114 total), and 25 more at L3 (139 total). A level is achieved only when every control at that level and below is Pass or a justified N/A.

| Criterion | L1 | L2 | L3 |
| --- | --- | --- | --- |
| Controls required | 63 | 114 | 139 |
| Open Critical findings | 0 | 0 | 0 |
| Open High findings | 0 in Areas A–C; others with a fix plan | 0 | 0 |
| Open Medium findings | Allowed, tracked | Allowed with risk acceptance signed by the CTO | 0, or formally accepted by the auditor |
| ASVS level verified for the backend | L1 | L2 | L3 |
| Independent pen test (extension + backend) | Not required | Required, within 12 months | Required, within 6 months |
| Bug bounty live | Not required | Required | Required |
| IR and compromise drills | Plan documented | Drill done within 12 months | Drill plus post-mortem within 12 months |
| Who signs off | Internal security lead | Security lead plus external pen-test firm | Independent third-party auditor |
| Re-audit cadence | Every major release | Annually and on major release | Annually, with continuous monitoring |

## 20. References

- [CCSS — CryptoCurrency Certification Consortium](https://cryptoconsortium.org/standards/) (official standard and auditor programme)
- [CCSS v9.0 clause list and control mappings — Open Security Architecture](https://opensecurityarchitecture.org/frameworks/ccss-v9)
- [Hacken CCSS audit methodology](https://docs.hacken.io/methodologies/ccss)
- [OWASP ASVS 5.0 overview](https://quality.arc42.org/standards/owasp-asvs)
- [OWASP Browser Extension Vulnerabilities Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Web3 Wallet Security project](https://owasp.org/www-project-web3-wallet-security/) and its [GitHub repository](https://github.com/OWASP/www-project-web3-wallet-security)
- [SLSA v1.0 security levels](https://slsa.dev/spec/v1.0/levels)
- [CIS PostgreSQL Benchmark checklist — Crunchy Data](https://www.crunchydata.com/blog/postgres-security-checklist-from-the-center-for-internet-security)
- BIP-39, BIP-32, BIP-44 (github.com/bitcoin/bips); EIP-155, EIP-191, EIP-712, EIP-1193, EIP-4361, EIP-6963 (eips.ethereum.org)

**Note:** the OWASP Web3 Wallet Verification Standard (WWSVS) was still in development when this was written. When it publishes requirement IDs, map them into Areas C and F.
