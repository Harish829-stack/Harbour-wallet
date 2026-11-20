# Extension guide

The Chrome Manifest V3 wallet in `harbour-wallet-v3/apps/extension`. To build and load it see [how-to-run.md](how-to-run.md); to ship it see [release.md](release.md).

## Layout

| Path | What it is |
| --- | --- |
| `src/background/` | Service worker: vault, signing, dApp provider, WalletConnect, message handlers. The only place keys exist |
| `src/core/` | Wallet logic with no UI: chains, vault and passwords, keys, transactions, swaps, staking, NFTs, activity, ramps, the backend client (`core/harbour/`), signing policy (`core/harbour/policy.ts`) |
| `src/kit/` | Network kit: failover, HTTP client with retries and circuit breaker, signed remote config, market-data clients, last-known-good cache |
| `src/popup/` | React UI (popup, side panel, onboarding, approval screens) |
| `src/inpage/`, `src/content/` | Injected dApp provider (`window.ethereum`, EIP-6963) and the content script that validates and forwards requests |
| `src/offscreen/` | Hidden page used for clipboard writes and clears |
| `src/integrations/testnet-defi/` | Testnet Swap (Uniswap on Sepolia) and Earn (Aave on Base Sepolia); has its own README |
| `public-production/` | Static assets copied into the build (logos, fonts, illustrations). `inpage.js`, `public-content.js` and `wallet-core.wasm` inside it are generated |
| `scripts/` | Build, verify, release, chain-registry generators, signing tools |
| `test/` | Unit and regression tests (`node --test`) |
| `config/`, `releases/`, `release-signer.pub` | Signed remote config, signed release metadata, the pinned release signer |
| `gateway/` | Legacy Cloudflare Worker, replaced by the backend's `/v1/gw`. Not deployed; kept only because tests still cover it |
| `tools/` | Manual audit harnesses (UI layout screenshots, mitm end-to-end) |

## Commands

Run from `apps/extension` with Node 22.

| Command | What it does |
| --- | --- |
| `npm ci` | install exact locked dependencies (install scripts are disabled on purpose, `.npmrc`) |
| `npm run dev` | Vite dev build |
| `npm run build` | copy and verify the wallet-core WASM, bundle the injected and content scripts, type-check, build into `dist/` |
| `npm test` | all tests in `test/` |
| `npm run lint` | ESLint, zero warnings |
| `npm run verify` | lint, type-check, tests, build, audit gate, bundle secret scan |
| `npm run check:rpc` | probe every configured public RPC endpoint (needs internet) |
| `node scripts/repro.mjs` | build twice and compare every file; must report "reproducible" |
| `node scripts/release.mjs` | signed release zip, see [release.md](release.md) |
| `python3 ../backend/scripts/gen_chains.py [--check]` | regenerate the backend chain list and `chainList.gen.ts` from the registry |

Scripts that read research data (`gen-chain-registry.mjs`, `gen-extra-chains.mjs`, `test/chains.test.js`) read from `research/evidences/`. Release and gateway scripts read local key files (`harbour-release-key.json`, `harbour-keys.env`) from the repository root; both are git-ignored.

## Build configuration

`.env.production` (copy from `.env.example`) holds **public** build settings only:

| Variable | Meaning |
| --- | --- |
| `VITE_HB_API_URL` | the backend `api` URL. `https://` required for any build you hand out; `http://` only for localhost (and `release.mjs` refuses those builds) |
| `VITE_HB_CONFIG_PUBKEY` | base64 Ed25519 public key that verifies the signed remote config |
| `VITE_WC_PROJECT_ID` | Reown / WalletConnect project id |
| `VITE_HB_FCM_SENDER_ID` | Firebase sender id for server push; empty means local notification watcher only |
| `VITE_HB_HL_BUILDER`, `VITE_HB_HL_BUILDER_FEE`, `VITE_HB_PM_BUILDER_CODE` | optional Hyperliquid and Polymarket builder codes; empty means none |

Never put provider keys or keyed RPC URLs in any extension `.env` file. Third-party calls go to `VITE_HB_API_URL/v1/gw`, where the backend holds the keys. The bundle secret scan in `scripts/verify.mjs` fails the build if a key value appears in `dist/`.

## One request from click to signature

A website asks to send a transaction. Reading these files in order shows the whole path.

1. **Page asks.** `window.ethereum.request(...)` is defined in `src/inpage/ethereum.ts`; `src/inpage/index.ts` installs it and announces Harbour to wallet pickers.
2. **Private channel.** `src/inpage/bridge.ts` opens a nonce-handshaked channel to the content script so other scripts on the page cannot listen in.
3. **Validate.** `src/content/content.ts` checks the request shape and method allowlist and forwards it over the `harbour-provider` port. The page cannot choose its origin; Chrome reports it.
4. **Route.** `src/background/provider/index.ts` calls `ProviderService.handle` (`service.ts`). Reads are answered directly; anything that signs or changes state goes into a pending queue.
5. **Approve.** `approvalWindow.ts` opens the approval window; screens live in `src/popup/wallet/features/provider.tsx` and receive a prepared summary from `view.ts`, never raw keys. Approve and Reject call `providerResolve` in `handlers/provider.ts`.
6. **Sign and send.** `execute` in `service.ts` re-checks that the site is still connected (signing policy in `core/harbour/policy.ts`), signs with the vault key through `signer.ts` and sends.
7. **Relay.** `src/core/harbour/fetchHook.ts` makes the Harbour API look like an ordinary RPC endpoint: it signs each call with the device key and turns `eth_sendRawTransaction` into a backend broadcast request.

The popup follows a shorter path: `bg({ type: '...' })` in `src/popup/api.ts` sends a message on the `harbour-ui` port; `src/background/index.ts` looks the name up in the event registry (`kernel/events.ts`) and runs the handler registered in `modules/` or `handlers/`.

**Adding a feature:** register a message handler in `src/background/handlers/` (add it to `handlers/index.ts`), call it from a screen with `bg(...)`. Anything that moves value also needs a check in `core/harbour/policy.ts`, and anything that returns data to the popup must stay free of secrets (`core/uiSafe.ts`).

## Behaviours worth knowing

- **Networks.** Three groups everywhere: Default, Custom, Testnets. Mainnets plus a few testnets ship by default; users add others manually or through a dApp (EIP-3085) and a site-requested switch asks for approval.
- **Auth.** Every wallet has a password; biometrics (platform authenticator with WebAuthn PRF) are optional and need the password to enrol. Adding a wallet, importing, backing up, revealing and weakening settings require re-authentication (`background/reauth.ts`: one-shot grants for `reveal`, `addWallet` and `manage`).
- **Storage.** Vault, KDF record, keystores and biometric seal live in extension-origin IndexedDB (`core/secureStore.ts`); `chrome.storage.local` is pinned to trusted contexts.
- **Activity.** Unified history merges (1) a local ledger of transactions this wallet broadcast, (2) a log scanner on the chain's own RPC for ERC-20/721 transfers and approvals, and (3) explorer data for native transfers. Classification (send, receive, swap, approve, revoke, mint, contract) is in `core/activity/classify.ts`. For indexed chains the backend history is used instead.
- **Approvals screen.** Decoded calldata, Permit/Permit2/multicall hidden-approval detection, `eth_simulateV1` balance changes (falling back to the backend `/v1/tx/{chain}/simulate`), Solana SPL diffs and drainer flags, phishing and address risk lists. If a list is unavailable the UI says so instead of claiming safety. Editable spending cap works like MetaMask's.
- **Token approvals scan** (Settings > Security). Allowances are read on chain through `/v1/rpc` for the user's added tokens times the contracts Harbour talks to, plus a ledger of approvals this wallet signed (Swap, Earn, connected sites); nothing is shown unless the chain reports an allowance above zero. It covers the networks listed in `approvalScan.ts` (Sepolia and Base Sepolia when this was written) and answers "Approval scanning isn't available on this network" elsewhere. A log-based "Deep scan" that would find approvals to unknown spenders is deferred.
- **Testnet Swap and Earn.** Swap on Ethereum Sepolia uses the Uniswap Trading API through the backend (`UNISWAP_API_KEY`; only chain 11155111). Earn on Base Sepolia uses AaveKit. Every transaction either returns is decoded and checked before review. Details in `src/integrations/testnet-defi/README.md`; tests: `node --test test/testnet-defi.test.js test/testnet-defi-handlers.test.js test/aavekit.test.js`.
- **Remote config.** `config/config.json` is signed; flags `perps`, `predictions` and `smartAccounts` are `false` by default, and providers can be killed remotely.
- **Permissions.** `alarms`, `storage`, `clipboardWrite`, `notifications`, `scripting`, `sidePanel`, `gcm`, `idle` (lock when the OS locks) and `offscreen`; host access `https://*/*` for the injected provider and chain endpoints.

## Testing notes

- The suite includes `test/pentest-regressions.test.js`, which replays each past attack against the real worker handlers.
- `test/boundaries.test.js` enforces that the popup never imports vault, key or wallet-core code.
- On Linux, if `node_modules` was installed on macOS, set `ESBUILD_BINARY_PATH` to a Linux esbuild binary or reinstall with `npm ci`.
- Real Touch ID / Windows Hello and Ledger flows need manual testing; the matrix is in [security.md](security.md).

## Smart accounts (EIP-7702), behind the remote flag `smartAccounts`

**Audited code, not our own.** Call encoding (ERC-7821), the user-operation EIP-712 typed data and the permission delegations come from MetaMask's packages (`@metamask/smart-accounts-kit/utils`, `@metamask/delegation-core`, `@metamask/delegation-abis`) plus `viem`, all pinned to exact versions. Only `src/core/smartAccount/kit.ts` imports the kit, and only its `/utils` entry: the kit's root entry sends analytics, and `smart-account-kit-offline.test.js` fails the build if that ever changes.

Pure code in `src/core/smartAccount/` (constants, `kit`, call validation, user operation and type-4 builders, `guard`, `send`, `calls5792`, `permissions`, `permissionDelegation`, `grantStore`). The worker side is `background/smartAccountService.ts` (status, enable/revoke, `sendCalls` for Harbour's own flows, `submitDappCalls` for EIP-5792, `grantPermission`, grant list and revoke) and `background/handlers/smartAccount.ts` (five UI-only messages; Approve/Reject carry only a requestId). The popup section is `popup/wallet/features/smartAccount.tsx`, under Settings -> Wallets -> the active wallet (hidden unless the flag is on, the wallet is a recovery-phrase or private-key wallet, and the network is Sepolia or Base Sepolia).

**dApp methods.** `wallet_getCapabilities`, `wallet_sendCalls`, `wallet_getCallsStatus`, `wallet_showCallsStatus` (EIP-5792, atomic only) and `wallet_requestExecutionPermissions`, `wallet_getGrantedExecutionPermissions` (ERC-7715 style, native and ERC-20 allowances only). A site can never turn the account on, revoke a grant, or upgrade the account. Every method the provider service exposes must also be forwarded by `wrapSigner()` in `background/provider/index.ts`; `provider-signer-wrap.test.js` enforces it.

**Fees: sponsor first, then user-paid.** `sendOperation` asks the paymaster for sponsorship first. Any refusal (the policy's per-user limit used up, budget spent, paymaster unreachable) falls back to a user-paid operation with a safety margin on the bundler's gas estimate (+25% call and verification gas, +10% pre-verification, never above the hard caps; sponsored operations are not padded because the paymaster signature covers the gas limits). A sponsor reply that fails the guard still signs nothing. There is no gasless setting: the backend gateway pins the sponsorship policy (`PIMLICO_SPONSORSHIP_POLICY_ID`) and the policy in the Pimlico dashboard decides who is sponsored. The confirmation screen says "Free for your first smart-account transaction. Otherwise paid from your account"; the real outcome appears in the receipt (paymaster in the `UserOperationEvent`). Pimlico counts per-user limits after inclusion, so a few quick batches from one address can all be sponsored: put a global cap on the policy.

**Success is read from the chain, limits are per chain.** After `eth_sendUserOperation` the bundler's receipt only names a transaction; `verifyInclusion` (`core/smartAccount/send.ts`) reads the receipt through the wallet's own RPC path and accepts only the EntryPoint `UserOperationEvent` for that exact hash and sender, with its `success` flag deciding the result. A mismatch is `receipt_mismatch` and never triggers a fallback transaction; `wallet_getCallsStatus` uses the same check. Gas and fee ceilings are per chain (`CHAIN_LIMITS` in `constants.ts`, one entry required for every smart account chain, enforced by a test); a chain without an entry can never pass the fee cap.

**Local testing.** The flag comes from the signed remote config, not `config/config.json`: sign a copy with `scripts/config-tool.mjs`, set `CONFIG_JSON` and `CONFIG_SIG` in the backend `.env`, set `VITE_HB_CONFIG_PUBKEY` in the env file the build uses (`.env.production` wins over `.env` for `npm run build`), and build with a loopback `VITE_HB_API_URL` if you want `http://localhost` pages to get the provider (other builds inject it on `https://` pages only). The test dApps below exercise every method; `scripts/p5-e2e.mjs` proves the permission limits on chain. Full design: `documentation/smart-accounts/`.

### Test dApp for smart accounts (testnets only)

Two pages in `research/aa-spike/`: `dapp-test.html` (quick refusal checks, no libraries) and `dapp-full.html` (the full walkthrough below).

**Run it**

1. Turn the smart account on in Harbour (Settings -> Wallets -> the active wallet) on Sepolia or Base Sepolia, with some test ETH.
2. Start the server: `cd research/aa-spike && python3 serve.py`.
3. Open `https://127.0.0.1:8443/dapp-full.html` in the Chrome profile that has Harbour, accept the certificate warning once, and reload.

`serve.py` uses HTTPS because Harbour injects `window.ethereum` on `https://` pages only (plus `http://localhost` in loopback-API builds). It serves only the three page files, never the rest of the folder (`.state/` holds the spike's test key), and keeps its self-signed certificate in `.state/` (git-ignored). Do not serve the folder with `python3 -m http.server`.

**What each section does** (results print as PASS / FAIL in the log at the bottom; Copy log shares them)

| Section | Use | Expected |
|---|---|---|
| 1. Account | Connect, switch to Sepolia / Base Sepolia, Refresh | Smart account shows ON (code `0xef0100` + the pinned delegate), capabilities `atomic: supported` |
| 2. Batch ETH send | One row per transfer (To address, Amount in ETH), "+ Add transaction", Send batch, Check status | One approval in Harbour, then `PASS batch confirmed`. With "All or nothing" unticked it is still accepted and still atomic; an account that is OFF gets 5760 |
| 3. Free transaction check | Check free transaction | AVAILABLE before the first sponsored operation, USED (with its transaction link) after. One per address |
| 4. Session key | 1 make key, 2 fund it from Harbour, 3 grant an ETH allowance and expiry, 4 spend as the key | Grant checks PASS, then `PASS session key spend confirmed` |
| 4. Try to break it | Over the limit, After expiry, Wrong calldata, Someone else redeems | PASS for each (simulated with `eth_call`, costs nothing). For expiry, grant with 1 minute and wait for it to pass |
| 4. Revoke | Revoke the grant in Harbour Settings, wait for confirmation, then Try spending again | PASS: disabled on chain, spend refused with `CannotUseADisabledDelegation` |
| 5. Negative checks | Run negative checks | 11 PASS, no approval prompt |

**Safety rules built into the page.** Every button refuses to run unless the wallet and the RPC are on Sepolia or Base Sepolia. The session key is created in the tab's memory, never saved or logged, and is gone on reload (send nothing valuable to it). The page never asks for a real key. Requests leave the tab only to the wallet, the public RPCs listed under "Advanced" (reads and the session key's own transactions) and Blockscout (free-transaction lookup); every other request is blocked.

**Libraries.** `dapp-full.lib.js` bundles viem and MetaMask's delegation packages from the extension's own `node_modules` (same versions as Harbour). After an extension dependency change, run `node research/aa-spike/build-dapp-full.mjs`: it rebuilds the file and updates the integrity hash in the page, so a stale or edited bundle will not load.

**Verified (2026-11-20)** on Sepolia and Base Sepolia: batches confirmed, free transaction reported as used, grant, spend, over-limit, expiry, wrong calldata, wrong caller and the 11 negative checks all PASS on both chains; revoke PASS on Base Sepolia.
