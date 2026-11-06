# Harbour Wallet: audit results

> **Update 2026-10-30:** this file records the audit as run on baseline `6692a88`. Fixes are on branch `harbour-v3`; current finding status is in `findings.md`, the overview in `summary.md`, hand steps in `fixes.md`. Control statuses below are not re-scored.

Framework: Extension Wallet Security Audit Framework & Checklist (139 controls), target L3.
Codebase: harbour-wallet-v3 (audited 2026-10-30 at baseline commit `6692a88`).
Method: static, read-only code review. Code, config and tool output are the only evidence; comments, READMEs and docs are not.

## Area A: Key & seed generation

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| A-01 | L1 | PASS | src/core/walletService.ts:7-12; node_modules/@trustwallet/wallet-core/dist/lib/wallet-core.js (getRandomValues); src/core/passwordService.ts:10-12 | `const w = this.core.HDWallet.create(128, passwordKey);` / wallet-core RNG binding calls `crypto.getRandomValues(b)` | Math.random appears only in UI animation, retry jitter, an inpage UUID fallback (src/inpage/index.ts:13) and a Polymarket order salt (src/core/predictions/polymarket.ts:111); none touch key material. |
| A-02 | L1 | PASS | src/core/walletService.ts:10,13; src/background/modules/wallet.ts:34-36 | `HDWallet.create(128, …)` / `isValidMnemonic(m) { return this.core.Mnemonic.isValid(m); }` | 128-bit (12 words). Import path rejects invalid phrases before any key is built. |
| A-03 | L1 | PASS | src/core/walletService.ts:26-33; src/background/handlers/ledger.ts:10; test/provider.test.js:29 | `const base = this.core.CoinTypeExt.derivationPath(coin); const at = base.lastIndexOf('0');` | Default wallet-core BIP-44 paths per coin. Test file uses the well-known Hardhat vector address. Cross-wallet comparison not executed (static audit). |
| A-04 | L1 | PASS | src/background/index.ts:91-102; src/core/uiSafe.ts:5-21; src/core/harbour/client.ts:59-72 | `if (field) logError(...blocked secret field...)` / `return uiSafe(sanitizeResult(result));` | Backend endpoints carry only addresses and signed raw txs. No analytics/error-reporting SDK in src (grep sentry\|analytics\|posthog\|mixpanel). Traffic capture not performed (static). |
| A-05 | L1 | PASS | package.json:18-49; scripts/prepare-wasm.mjs:5-9; package-lock.json | `"@noble/hashes": "1.5.0"`, `"@trustwallet/wallet-core": "4.8.2"` / `if (digest !== '1b78048f…') throw` | Exact version pins and a SHA-256 pin on the wallet-core WASM. viem 2.21.19 has an upstream advisory path (see K-02). |
| A-06 | L1 | NEEDS EXTERNAL EVIDENCE | - | - | Key-generation documentation is a document control; code comments are not accepted as evidence. |
| A-07 | L2 | NOT FOUND IN CODE | searched test/ for entropy\|randomness\|dieharder\|NIST | - | No statistical randomness test exists. |
| A-08 | L2 | PARTIAL | src/core/keySchedule.ts:33-38; src/background/handlers/secrets.ts:51; src/core/walletService.ts:10-11; src/background/modules/wallet.ts:48 | `finally { master.fill(0); }` / `return w.mnemonic();` | KDF master key and phrase word arrays are wiped, but the generated mnemonic is returned and passed as an immutable JS string, which cannot be zeroed. |
| A-09 | L2 | NEEDS EXTERNAL EVIDENCE | - | - | Independent cryptography review report required. |
| A-10 | L3 | NOT FOUND IN CODE | src/core/walletService.ts:54; searched src for passphrase\|25th | `this.core.HDWallet.createWithMnemonic(mnemonic, '')` | BIP-39 passphrase is always empty; no dice/user entropy option. |
| A-11 | L3 | PASS | src/background/handlers/ledger.ts:1-25; package.json:21-24 | `addresses[ct] = address; hw[ct] = norm(path);` (only device-reported addresses and paths are stored) | Ledger via WebHID; no key material in the extension for Ledger wallets. |

## Area B: Key storage & vault encryption

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| B-01 | L1 | PASS | src/core/passworder.ts:24-31 | `const salt = crypto.getRandomValues(new Uint8Array(32)); … const iv = crypto.getRandomValues(new Uint8Array(12)); … AES-GCM` | Fresh salt+IV on every encrypt. Keystores additionally use wallet-core aes128ctr (src/core/walletService.ts:63-64). |
| B-02 | L1 | PASS | src/core/keySchedule.ts:15,30-32; src/core/vaultService.ts:26 | `export const ARGON2_DEFAULT: Argon2Params = { m: 47104, t: 2, p: 1 };` | 46 MiB / t=2 / p=1 exceeds OWASP minimum (19 MiB, t=2). Legacy v1 vaults still read with PBKDF2 until migrated (src/core/passworder.ts:10,35). |
| B-03 | L1 | PASS | src/core/passwordPolicy.ts:5-11; src/background/modules/wallet.ts:34; src/popup/wallet/addPassword.tsx:5,37 | `if (value.length < 8) … if (value.length > 64) … commonPasswords.includes(value)` | Min 8, max 64, common-password list, strength meter. Enforced in the worker as well as the UI. |
| B-04 | L1 | PASS | src/core/storage.ts:15-23; src/core/vaultService.ts:35-39; src/core/logger.ts:26-49 | `await local.set(KEYS.VAULT, await passworder.encrypt(unlockKey, state));` | Only encrypted vault/keystores in storage.local; derived keys only in storage.session; logger masks hex/mnemonic shapes. Only localStorage use is ramp UI prefs (src/popup/wallet/features/rampKit.tsx:23-24). |
| B-05 | L1 | PASS | src/background/index.ts:44-45; src/core/vaultService.ts:28-29; src/background/secretRender.ts:1-3,50-63 | `chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' })` | Phrase/keys are rendered as PNG in the worker; UI gets pixels only. |
| B-06 | L1 | PARTIAL | src/background/index.ts:43-62; src/core/settings.ts:12 | `export const AUTO_LOCK_OPTIONS = [1, 5, 10, 15, 30, 60, 0] as const; // minutes; 0 = never` | Idle alarm and OS-lock handlers drop session keys, but users can choose 'never' auto-lock. |
| B-07 | L2 | PASS | src/core/vaultService.ts:6,40-49,165-172 | `const FREE_ATTEMPTS = 5, BASE_DELAY_MS = 5000, MAX_DELAY_MS = 300000;` + serialised attempts | Exponential backoff after 5 failures, serialised to stop parallel guessing. Online only; offline cost is B-11. |
| B-08 | L2 | PASS | src/core/keySchedule.ts:16-28; src/core/vaultService.ts:62-64,99-110 | `if (!isV2(pb)) { try { keys = await this.migrateToV2(…) } … }` | Params stored with salt; v1 to v2 migration is atomic (single setMany). |
| B-09 | L2 | PASS | src/background/handlers/secrets.ts:84-142; src/background/reauth.ts:9-17; src/offscreen/clipboard.ts:67-73 | `if (!(await consumeRevealGrant())) return { ok: false, error: 'AUTH_REQUIRED' };` / clipboard cleared after 60 s | One-shot 2-minute re-auth grant; copy happens in an offscreen doc and is overwritten after 60 s. Warning-screen wording not reviewed. |
| B-10 | L2 | PARTIAL | src/background/keys.ts:40-44,58-72 | `return core.HexCoding.encode(pk.data()) as `0x${string}`;` | WASM key objects are deleted in dispose() and privateKeyFor returns a zeroable copy, but evmPrivateKey() returns the key as a hex JS string. |
| B-11 | L3 | NEEDS EXTERNAL EVIDENCE | - | - | Requires a hashcat benchmark against a test vault. Note: biometric unlock (B-12 / finding HW-2026-001) may bypass the KDF entirely. |
| B-12 | L3 | PARTIAL | src/core/passkey.ts:39-50,65-74; src/core/passkeyService.ts:18-26,31-41 | `const userId = random32(); … user: { id: userId … } … return { secret: toHex(userId) … }` then `passworder.encrypt(secret, { passwordKey, unlockKey })` | Hardware option exists (Ledger, WebAuthn). The WebAuthn path uses the credential's userHandle (user.id) as the encryption secret instead of the PRF extension. See finding HW-2026-001. |

## Area C: Transaction signing security

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| C-01 | L1 | PASS | src/background/provider/service.ts:146-166,278-294,339-355 | `return this.queue(s, req, 'sign', n, evmConn);` … `if (!decision.approve) …` | Every sign/typed/tx/multi/sol request enters the approval queue; execution only from resolve(). |
| C-02 | L1 | PASS | src/background/provider/view.ts:31-41,105-187; src/background/provider/index.ts:135-141 | `const origin = normalizeOrigin((sd as any).origin ?? sd.url)` / txView decodes calldata, token meta from chain | Recipient, value, token, network, fee and origin come from the request/chain, not dApp labels. |
| C-03 | L1 | PARTIAL | src/background/provider/service.ts:163,168-174,302-308 | `if (tx.chainId !== undefined && Number(BigInt(tx.chainId)) !== chainId) { … if (!(await this.autoSwitch(…))) throw …` | A connected site whose tx or typed data names another known chain is switched silently (autoSwitch), and wallet_switchEthereumChain is silent for connected sites. The tx is still bound to and shown with its chain. |
| C-04 | L1 | PASS | src/background/provider/service.ts:147-149; src/background/provider/index.ts:80 | `if (req.method === 'eth_sign' && !(await this.d.ethSignEnabled?.())) throw …` | Off unless the developer setting is on; raw-hash requests get a high-risk acknowledgement (src/popup/wallet/features/provider.tsx:129-130). |
| C-05 | L1 | PASS | src/core/provider/typed.ts:29-50; src/background/provider/service.ts:153-159 | `if (dc !== undefined … && !this.policy.isSigningEvmChain(dc)) throw …` | Domain fields and message tree are shown; domain chainId is validated. |
| C-06 | L2 | PASS | src/background/provider/view.ts:125-149; src/core/provider/typed.ts:32-46; src/popup/wallet/features/provider.tsx:130,189 | `if (isUnlimited(amt)) warnings.add('unlimitedApproval');` … `hiddenApproval`, `setApprovalForAll` | Includes Permit/Permit2 and approvals hidden inside multicall; high-risk items need an explicit acknowledgement. |
| C-07 | L2 | PASS | src/background/provider/view.ts:159-172; src/core/provider/simulate.ts:26-33 | `d.rpc(chainId, 'eth_simulateV1', simulateParams(…))` | Falls back to a 'simulationUnavailable' warning if the RPC lacks eth_simulateV1. Testnet accuracy comparison not run. |
| C-08 | L2 | PASS | src/core/sendService.ts:91-103; src/background/handlers/chainSend.ts:116 | `return known.find((k) => … x.slice(0, head) === t.slice(0, head) && x.slice(-tail) === t.slice(-tail));` | Applies to the in-wallet Send flow; dApp-initiated txs rely on GoPlus/ScamSniffer checks instead. |
| C-09 | L2 | PASS | src/core/provider/methods.ts:147-161; src/background/provider/service.ts:455-457; src/background/provider/view.ts:111 | `if (!Object.keys(fee).length && tx.maxFeePerGas === undefined && tx.gasPrice === undefined) throw …` | Hex quantities are capped at 256 bits, nonce comes from RPC, a custom dApp nonce is flagged, and the fee must be the one shown. |
| C-10 | L2 | PASS | src/background/provider/service.ts:88-93,278-294,528-533; src/content/content.ts:63-66 | `this.approvalLimiter = new RateLimiter({ capacity: 6, refillPerSec: 0.1 }, …)`; MAX_PENDING checks; needConn binding | Per-origin limits; a request is invalidated if the connection changed while pending. |
| C-11 | L3 | PASS | src/background/modules/settingsCore.ts:34-63; src/core/sendService.ts:91-97 | `return { newRecipient: !contact && !before, inAddressBook: !!contact, … }` | Address book plus a first-time-recipient flag. |
| C-12 | L3 | PARTIAL | src/background/handlers/ledger.ts:1-3; src/popup/ledger/device.ts | Ledger signing for in-wallet sends (ledgerSendPrepare/ledgerSendSubmit) | Uncertain: did not confirm that dApp provider requests from a Ledger account are clear-signed on device. |

## Area D: Backup, recovery & key compromise

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| D-01 | L1 | FAIL | src/background/modules/wallet.ts:59; src/popup/wallet/Wallet.tsx:159-162,170 | `seedPhraseBackupRequired: newlyGenerated` → only a banner `{backupRequired && (… 'Back up your secret phrase' …)}`; Receive button always shown | Backup is a reminder, not a gate; funds can be received before backup is confirmed. |
| D-02 | L1 | PARTIAL | src/core/walletService.ts:26-55; test/provider.test.js:29 | standard wallet-core derivation | No automated cross-wallet restore test found; the derivation code uses standard paths. |
| D-03 | L1 | PASS | src/core/harbour/client.ts:59-72; src/core/qrSync.ts:1-21 | endpoints: /v1/me/portfolio, /v1/me/addresses, /v1/tx/…/broadcast (addresses and raw txs only) | QR sync is inbound only (import from mobile), decrypted on device. |
| D-04 | L1 | NEEDS EXTERNAL EVIDENCE | - | - | User key-compromise guidance is a document. |
| D-05 | L1 | NEEDS EXTERNAL EVIDENCE | src/kit/remoteConfig.ts:42-52 (kill switches exist) | - | Procedure is a document; code supports signed provider kill switches. |
| D-06 | L2 | PASS | backend/internal/api/server.go:152-179; src/core/vaultService.ts:23-24 | no reset/recovery route on the API; `if (await this.exists()) throw new Error('FORBIDDEN_REQUEST');` | Recovery is only by re-importing the phrase. |
| D-07 | L2 | NEEDS EXTERNAL EVIDENCE | - | - | Drill records required. |
| D-08 | L2 | NEEDS EXTERNAL EVIDENCE | - | - | Help-centre content not in repo. |
| D-09 | L3 | NEEDS EXTERNAL EVIDENCE | - | - | Status page / signed announcements channel external. (Remote-config announcements depend on the extension.) |
| D-10 | L3 | NOT FOUND IN CODE | searched src for slip39\|shamir\|social recovery | - | Not implemented. |

## Area E: Browser extension (MV3) security

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| E-01 | L1 | PASS | manifest.config.ts:20-22 | `permissions: ['alarms','storage','clipboardWrite','notifications','scripting','sidePanel','gcm','idle','offscreen']`, `host_permissions: ['https://*/*', …local only]` | No tabs/webRequest/cookies. Broad https host access is needed to inject the provider; keep a written justification per permission. |
| E-02 | L1 | PASS | manifest.config.ts:19 | `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; base-uri 'none'` | wasm-unsafe-eval is needed for wallet-core; no unsafe-eval or remote hosts. |
| E-03 | L1 | PASS | searched src for eval(\|new Function\|innerHTML\|dangerouslySetInnerHTML\|insertAdjacentHTML\|document.write; eslint.config.js:18 | `'no-eval': 'error', 'no-implied-eval': 'error'` (0 matches in src) | Static only; Semgrep not run (not installed on device). |
| E-04 | L1 | PASS | src/kit/remoteConfig.ts:18-52 | `if (… !(await verifySignature(env.config, env.signature, CONFIG_PUBLIC_KEY))) return null;` (flags/data only) | Remote config is signed data with downgrade and expiry checks; no fetched code. |
| E-05 | L1 | PASS | src/background/accessPolicy.ts:3-15; src/background/index.ts:92; src/background/kernel/port.ts:26; src/background/clipboard.ts:14; src/background/provider/index.ts:135-147 | `return url.protocol === 'chrome-extension:' && url.hostname === extensionId && url.pathname === '/src/popup/index.html';` | Internal router accepts only the popup document; provider ports reach ProviderService only, with method allowlists. |
| E-06 | L1 | PASS | manifest.config.ts (no externally_connectable); searched src for onMessageExternal\|onConnectExternal (0) | - | No external messaging surface. |
| E-07 | L1 | PASS | dist/manifest.json (no web_accessible_resources); src/background/provider/index.ts:169-173 | `world: 'MAIN'` via chrome.scripting.registerContentScripts | Inpage is registered by scripting, so no WAR is exposed. |
| E-08 | L1 | PASS | src/background/provider/service.ts:97-101; src/content/content.ts:1-6 | `accounts: visible && c?.evmAddress && … ? [c.evmAddress] : []` | Unconnected sites see no accounts; the content script never renders wallet data into the DOM. |
| E-09 | L2 | PARTIAL | src/inpage/index.ts:26-28,53-56; src/inpage/ethereum.ts:9 | `isTrust = true; isTrustWallet = true;` / `define('trustwallet', twProxy)` / EIP-6963 announce | No secrets in the inpage script; EIP-6963 is present. It also impersonates Trust Wallet's provider flags and namespace (finding HW-2026-010). |
| E-10 | L2 | PASS | src/content/content.ts:71-80; src/inpage/bridge.ts:23-40 | `if (e.source !== window \|\| … \|\| e.ports.length !== 1) return; … nonce must match` | Private MessageChannel with a per-load nonce; the inpage script runs at document_start before page scripts. |
| E-11 | L2 | PASS | dist/manifest.json (no web_accessible_resources) | - | Websites cannot frame extension pages. |
| E-12 | L2 | PASS | src/core/vaultService.ts:28-29,153-154; src/background/provider/index.ts:43 | keys in storage.session; `export const pending = new PendingStore(kvSession);` | State survives worker restarts; secrets are never written to storage.local in plaintext. |
| E-13 | L2 | NEEDS EXTERNAL EVIDENCE | src/core/settings.ts:69; src/popup/wallet/settingsScreens.tsx:326 | `Harbour has no account and sends no analytics.` | No telemetry in code; the privacy policy document is external. |
| E-14 | L3 | PASS | src/background/provider/index.ts:135-141,155-157 | origin/tab/frame taken from `port.sender`; `parsePageRequest(raw)` re-validated in the worker | The worker does not trust content-script claims. |
| E-15 | L3 | NEEDS EXTERNAL EVIDENCE | - | - | Third-party pen-test report required. |

## Area F: dApp connection & phishing protection

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| F-01 | L1 | PASS | src/background/provider/service.ts:135-137,262-266 | `case 'eth_accounts': return ok(c?.evmAddress ? [c.evmAddress] : []);` |  |
| F-02 | L1 | PASS | src/core/provider/origin.ts:2-8; src/background/provider/service.ts:120 | `return u.origin;` (scheme+host+port); perms.get(s.origin) | Exact-origin scoping. |
| F-03 | L1 | PASS | src/background/provider/index.ts:138; src/popup/wallet/features/provider.tsx:149 | `<strong>{v.title}</strong><div …>{v.origin}</div>` | Origin comes from the browser. Note: the page-controlled tab title is shown in bold above it (Info). |
| F-04 | L1 | PASS | src/popup/wallet/features/provider.tsx:206-217; src/background/provider/index.ts:206-211 | Connections screen + `disconnectOrigin()` |  |
| F-05 | L2 | PARTIAL | src/core/provider/phishing.ts:6-10,34,56-72; src/popup/wallet/features/provider.tsx:128-130,150,189-190 | `{risk && <Warning>This site is flagged as dangerous…</Warning>}` + acknowledgement checkbox | MetaMask + ScamSniffer lists refreshed every 24 h, but a flagged site gets a warning the user can click through, not a block screen; the provider is still injected. |
| F-06 | L2 | PASS | src/core/provider/origin.ts:12; src/popup/wallet/features/provider.tsx:152 | `isPunycodeHost = (host) => host.split('.').some((l) => l.startsWith('xn--'))` |  |
| F-07 | L2 | PARTIAL | src/background/provider/service.ts:168-195,468-488; src/core/provider/origin.ts:21-29 | `if (evmConn) { await this.applyChain(…); return ok(null); }` (silent switch) | addChain needs approval, refuses private-network RPCs and probes the chainId. switchChain is silent for connected sites, and there is no check for a non-canonical RPC on a known chain ID. |
| F-08 | L2 | PASS | src/background/provider/service.ts:490-494,534-542; src/background/provider/view.ts:73-75 | `const meta = await this.tokenMeta(chainId, asset.address);` (contract values, not dApp values) |  |
| F-09 | L3 | PASS | src/background/provider/view.ts:159-174; src/kit/clients/securityClient.ts | `checkAddress(chainId, tx.to)` (GoPlus) + `addressRisk(…) === 'scam'` (ScamSniffer) | Drainer test-contract run not performed. |
| F-10 | L3 | PARTIAL | src/popup/wallet/features/provider.tsx:233-236 | `Token allowances granted through Harbour, checked on chain. Other allowances may exist.` | Only allowances granted through Harbour are listed and revocable. |

## Area G: Backend & API security

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| G-01 | L1 | PASS | backend/internal/evmtx/devsign/devsign.go:1-4; backend/cmd/hbdevice/send.go:17-23; backend/internal/api/server.go:152-179 | devsign imported only by cmd/hbdevice (dev tool, env HB_DEV_PRIVATE_KEY) | No API route handles user keys. |
| G-02 | L1 | PASS | backend/internal/api/server.go:138,207-214,315-332; backend/internal/api/media.go:32,38 | `maxBody(1<<20)`; `evmAddr` regexp; `txHashRe` | Dynamic fuzzing not performed. |
| G-03 | L1 | PASS | backend/internal/api/auth.go:216-277; src/core/harbour/client.ts:10-22; src/core/harbour/device.ts:118-126 | Ed25519 device signature over method/path/date/nonce/body-hash; nonce SetNX replay guard | Device key is non-extractable WebCrypto; no static API keys in dist (secret scan: 0 hits). |
| G-04 | L1 | PASS | backend/internal/api/read.go:30-60; backend/internal/api/send.go:362 | `if !ok { writeErr(w, http.StatusForbidden, "not_tracked", …) }` / `s.ownsAddress(w, r, chain, from)` |  |
| G-05 | L1 | PASS | backend/internal/api/auth.go:47-78,307-322; backend/internal/api/media.go:317 | per-IP and global challenge caps; per-device per-minute counter; media per-IP 600/min | Load test not run. |
| G-06 | L1 | FAIL | backend/.env (values redacted in this report); backend/.hbdevice.json; backend/internal/config/secrets.go:10-25 | `ALCHEMY_API_KEY=alch…`, `INFURA_API_SECRET=…`, `ADDRESS_LINK_ENCRYPTION_KEY=…`, `POSTGRES_PASSWORD=…` in plaintext | Live provider keys and server secrets are plaintext files inside the project folder; config reads raw env vars with no secrets-manager integration. They are excluded from dist (checked) and .gitignore'd, but this folder is not a git repo, so history cannot be checked. |
| G-07 | L1 | PARTIAL | backend/internal/api/server.go:133-181; backend/internal/api/media.go:370-377; gateway/.dev.vars.example:15-16 | security headers only in `writeImage`; `ALLOWED_ORIGINS … Empty = any` | JSON API sets no nosniff/HSTS (HSTS may be at the edge, not in repo). No CORS headers (default-deny, acceptable). The legacy Cloudflare gateway allows any origin when unset. |
| G-08 | L2 | PASS | backend/internal/api/media.go:182-243 | dialer `Control` refuses private/loopback/CGNAT/NAT64 at connect time; ≤3 redirects | Rebinding-safe. |
| G-09 | L2 | PASS | backend/internal/store/devices.go:70-130; backend/migrations/0008_runtime_role_privacy.sql:7-11; backend/internal/api/server.go:223-232 | AES-256-GCM sealed device→address links; `accessLog logs route patterns only` |  |
| G-10 | L2 | PARTIAL | backend/internal/realtime/jwt.go:27,37,42 | `{"alg":"HS256","typ":"JWT"}` … `"exp": now.Add(ttl).Unix()` | Algorithm fixed and expiry set; no `aud` claim. Verification is done by Centrifugo (config not audited). |
| G-11 | L2 | PASS | backend/internal/api/server.go:197-205 | `writeErr sends a user-presentable error; never raw upstream text.` |  |
| G-12 | L2 | PASS | backend/internal/api/send.go:353-364; backend/internal/api/auth.go:361-422 | chain-id match, recovered sender must be owned by the device, 10/min broadcast rate, idempotency hash check | Manual abuse testing not performed. |
| G-13 | L3 | NEEDS EXTERNAL EVIDENCE | - | - | Third-party ASVS L3 audit. |

## Area H: Database security

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| H-01 | L1 | PASS | backend/migrations/*.sql (searched mnemonic\|private_key\|seed\|secret: none) | only device public keys stored |  |
| H-02 | L1 | PASS | backend/deploy/docker-compose.yml:19 | `ports: ["127.0.0.1:5432:5432"]` | Local stack only; the production network layout is not in the repo. |
| H-03 | L1 | PASS | backend/internal/store/read.go:112-114,335; backend/internal/store/store.go:144-158 | constant format fragments + `$n` params; DDL uses `quote_ident($1), quote_literal($2)` | sqlmap not run. |
| H-04 | L1 | PASS | backend/migrations/0008_runtime_role_privacy.sql:13-31; backend/deploy/docker-compose.yml:70-80; backend/internal/store/store.go:140-158 | `GRANT SELECT, INSERT, UPDATE, DELETE … TO harbour_app` / per-service logins NOSUPERUSER | If the migrator lacks CREATEROLE, the role setup is skipped with a NOTICE only (0008:29-30). |
| H-05 | L1 | FAIL | backend/deploy/docker-compose.yml:76,109,148,169,185,201,227 | `postgres://harbour_api:${PG_PW_API}@postgres:5432/harbour?sslmode=disable` | No configuration in the repo requires TLS (verify-full) for DB connections. |
| H-06 | L1 | NEEDS EXTERNAL EVIDENCE | - | - | Cloud storage/backup encryption config not in repo. |
| H-07 | L2 | PASS | backend/internal/store/devices.go:70-130; backend/migrations/0008_runtime_role_privacy.sql:10-11 | device↔address links encrypted; added_at truncated to day |  |
| H-08 | L2 | NOT FOUND IN CODE | backend/deploy/postgres/Dockerfile:1-4; searched backend for pgaudit | - | No DB audit logging. |
| H-09 | L2 | NEEDS EXTERNAL EVIDENCE | - | - | Restore-drill evidence. |
| H-10 | L2 | NOT FOUND IN CODE | searched repo for postgresql.conf\|pg_hba\|scram-sha-256 | - | No hardened DB config in repo. |
| H-11 | L3 | PARTIAL | backend/internal/store/devices.go:87-105; backend/deploy/docker-compose.yml:114 | `NewLinkCrypto derives an AES-256-GCM key … from one secret` | Application-level encryption exists for address links, but the key comes from an env var (no KMS); push tokens not reviewed. |
| H-12 | L3 | NEEDS EXTERNAL EVIDENCE | - | - | Decommissioning procedure. |

## Area I: RPC, node & indexer data integrity

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| I-01 | L1 | PASS | scripts/verify.mjs:22-35; audit/tool-output (dist scan: 43 backend secret values, 0 hits) | - | The extension reads Harbour networks through the signed /v1/rpc proxy; public fallback RPCs carry no keys (src/config/rpcEndpoints.json). |
| I-02 | L1 | PASS | src/core/chains/send/evm.ts:45-49; src/background/provider/signer.ts:28; backend/internal/api/send.go:353-356 | `call(env, chain, 'eth_getTransactionCount', [from, 'pending'])` / `assertSigningEvmChain(net.chainId)` | Nonce/gas come from RPC, chain ID from the local registry, not the indexer. |
| I-03 | L2 | PASS | src/config/rpcEndpoints.json:3-21; src/kit/failoverFetch.ts:41; backend/deploy/docker-compose.yml:92-100 | ≥3 public providers per chain + Alchemy/Infura/QuickNode/Chainstack upstreams |  |
| I-04 | L2 | NOT FOUND IN CODE | searched src/kit and backend/internal/gateway for consistency\|quorum\|divergen | - | No cross-provider check for critical reads. |
| I-05 | L2 | PASS | backend/internal/indexer/live.go:18,100; backend/internal/indexer/indexer.go:64-65,222-225 | `reorg repair` / `c.Finality.Classify(b, latest, finalized)` | Devnet reorg simulation not run. |
| I-06 | L2 | PASS | backend/config/api.yaml:19-43; backend/deploy/docker-compose.yml:101 | `rpc_allowed_methods:` (no admin_/debug_/personal_) | The gateway port is bound to localhost. |
| I-07 | L2 | PASS | backend/internal/api/media.go:274-307; src/core/customTokens.ts (sanitizeToken) | `image.DecodeConfig … // SVG and anything else fails here` then re-encode PNG |  |
| I-08 | L3 | NOT FOUND IN CODE | searched src for eth_getProof\|helios\|light client usage | - | eth_getProof is allowed by the proxy but not used for verification. |
| I-09 | L3 | PARTIAL | backend/internal/gateway/metrics.go; backend/internal/gateway/health.go | - | Metrics and health checks exist; alert rules are not in the repo. |

## Area J: Network & transport security

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| J-01 | L1 | NEEDS EXTERNAL EVIDENCE | backend/deploy/docker-compose.yml:108 | `API_ADDR: ":8080"` (plain HTTP behind an edge) | TLS termination config not in repo. |
| J-02 | L1 | PASS | scripts/api-url.mjs; vite.config.ts:8-10; scripts/release.mjs:19-25 | `if (!info \|\| info.local \|\| !String(info.api).startsWith('https://') \|\| … host_permissions … 'http://')) … release refused` | Note: the current dist/ is a local build with http://localhost host permissions; it cannot be released. |
| J-03 | L1 | PARTIAL | src/core/harbour/device.ts:147-154; src/core/harbour/client.ts:47-72 | `const body = await res.json().catch(() => ({})); … return body;` | Backend responses get TypeScript types but no runtime schema validation. |
| J-04 | L2 | NEEDS EXTERNAL EVIDENCE | - | - | WAF/DDoS config. |
| J-05 | L2 | PARTIAL | backend/deploy/docker-compose.yml:42-55,91,111 | NATS per-service passwords; `GATEWAY_INTERNAL_TOKEN`; `RPC_GATEWAY_URL: http://rpc-gateway:8081` | Inter-service traffic is authenticated but plaintext HTTP. |
| J-06 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| J-07 | L3 | NEEDS EXTERNAL EVIDENCE | - | - |  |

## Area K: Supply chain & build integrity

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| K-01 | L1 | PARTIAL | package-lock.json; backend/ci/backend.yml:53-56 | backend CI: `go mod tidy && git diff --exit-code go.mod go.sum` | Lockfile present, but no extension CI workflow (npm ci) was found. |
| K-02 | L1 | PARTIAL | scripts/audit-gate.mjs:1-28; audit-exceptions.json; audit/tool-output/npm-audit.json; backend/ci/backend.yml:65-66 | gate output: `npm audit gate passed (1 high/critical advisories, all with a current exception)` | npm audit: 4 high / 9 low, all high from GHSA-mrhx-c7xc-m3w5 (zod via @ton/ton and viem/abitype; npm reports viem@2.57.13 as a fix). The gate is not called from scripts/verify.mjs or any extension CI. Backend CI runs govulncheck and gosec. |
| K-03 | L1 | NEEDS EXTERNAL EVIDENCE | - | - | Store publisher account settings. |
| K-04 | L1 | NEEDS EXTERNAL EVIDENCE | - | - | Repository settings (this folder is not a git checkout). |
| K-05 | L2 | NOT FOUND IN CODE | searched repo root for .npmrc, lavamoat, allow-scripts | - | Install scripts of dependencies run unrestricted. |
| K-06 | L2 | PARTIAL | scripts/release.mjs:37-49; scripts/verify-release.mjs:9-17; release-signer.pub | `const signature = sign(null, zip, createPrivateKey(key.priv))` | Signed release + per-file hashes; no hosted-CI SLSA provenance. |
| K-07 | L2 | NOT FOUND IN CODE | searched scripts for cyclonedx\|spdx\|sbom | - |  |
| K-08 | L3 | NOT FOUND IN CODE | searched for lavamoat\|compartment\|SES | - | No runtime isolation of third-party code in the service worker (it bundles all chain SDKs). |
| K-09 | L3 | PARTIAL | scripts/repro.mjs:13-19 | two clean builds must produce identical files and zip | No byte-for-byte diff against the published store package. |
| K-10 | L3 | FAIL | scripts/release.mjs:13,26-31 | `const keyFile = process.env.HB_RELEASE_KEY ?? path.join(root, '..', 'harbour-release-key.json');` … `writeFileSync(keyFile, JSON.stringify(key…))` | The release signing key is a plaintext JSON file on a developer machine; no two-person approval or isolated build. |

## Area L: Logging, monitoring & incident response

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| L-01 | L1 | PASS | src/core/logger.ts:23-58; backend/internal/api/server.go:223-232; eslint.config.js:17 | redaction of URLs, hex, mnemonic shapes; `'no-console': 'error'` | The policy is enforced in code; a written policy document is still advisable. |
| L-02 | L1 | PARTIAL | backend/internal/api/server.go:224-231; backend/internal/api/auth.go:223-226,254-262 | accessLog records route+status; `unauth := func() { writeErr(…) }` (no log line) | Auth failures, revoked-device hits and replayed nonces are not logged as security events beyond status codes. |
| L-03 | L1 | PASS | src/core/logger.ts:34-58 | redact() applied to every log; no error-reporting SDK |  |
| L-04 | L1 | NOT FOUND IN CODE | searched repo for security.txt | - | No disclosure policy in repo; the IR plan is external. |
| L-05 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| L-06 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| L-07 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| L-08 | L3 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| L-09 | L3 | NEEDS EXTERNAL EVIDENCE | - | - |  |

## Area M: Operations, people & access control

| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |
| --- | --- | --- | --- | --- | --- |
| M-01 | L1 | NEEDS EXTERNAL EVIDENCE | - | - | Code references the release key, .env secrets and the config signing key, but the inventory is a document. |
| M-02 | L1 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| M-03 | L1 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| M-04 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| M-05 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| M-06 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| M-07 | L2 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| M-08 | L3 | NEEDS EXTERNAL EVIDENCE | - | - |  |
| M-09 | L3 | NEEDS EXTERNAL EVIDENCE | - | - |  |

## Coverage check

Expected A11 B12 C12 D10 E15 F10 G13 H12 I9 J7 K10 L9 M9 = 139.
Found A11 B12 C12 D10 E15 F10 G13 H12 I9 J7 K10 L9 M9 = 139.
