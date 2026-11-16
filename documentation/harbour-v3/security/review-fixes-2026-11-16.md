# Security review fixes — 2026-11-16

Branch: `security/review-fixes-2026-11-16` (from `codebase-structuring`). Four commits, extension only; no backend changes needed.
Tests: full extension suite passes (587 tests, incl. 9 new), `tsc --noEmit` and ESLint clean on changed files.

| # | Finding | Status before | Fix | Commit |
|---|---------|---------------|-----|--------|
| 1 | SIG-11 WalletConnect chain mix-up | Confirmed (narrower than reported) | Request-scoped chain (CAIP-27) | `3d80653` |
| 2 | Earn plan locking | Confirmed for staking; Aave lending already locked | Single-use worker-held review + fee cap | `c43126e` |
| 3 | Balance-change previews | EVM already had `eth_simulateV1`; Solana SPL gap real | SPL token diff + drainer flags; EVM backend fallback | `ffbf998` |
| 4 | Real-device biometrics / Ledger | Biometrics already tab-based; Ledger picker opened in popup | Ledger pairing in a full tab; manual test matrix below | `177e24e` |

## 1. SIG-11 — WalletConnect request chain
**Was:** `bridge.ts` wrote each request's `chainId` into the shared connection record (`perms.update`) before handling it. Two WC sessions for the same declared origin, or two concurrent requests for different chains, could move the chain another request ran on (wrong-chain reads; `eth_sendTransaction` without `chainId` queued on the other chain; pending approvals cancelled). Injected connections were not affected (PT-06 key separation).

**Now:**
- `ProviderService.handle(sender, req, scope?)` — the WC request's chain is passed as `scope.chainId` for that request only; nothing is persisted.
- Session namespaces (`rec.chains`, checked by `mapRequest`) are what authorize a chain.
- Approvals carry `binding.scoped` + the request chain; `needConn` and the tx executor check the request chain, not the connection's.
- A payload naming another chain than the request (tx `chainId`, EIP-712 `domain.chainId`) is refused, never auto-switched.
- Wallet-side network switches no longer cancel request-scoped approvals. Only `wallet_switchEthereumChain` changes the session default and emits `chainChanged`.

## 2. Earn plan locking
**Was:** `earnSubmit` rebuilt the staking plan from scratch: MAX amounts, BNB shares, Rocket Pool calls, Cosmos reward sets and the EVM fee could differ from the confirm screen. Aave testnet lending already used a worker-held review (unchanged).

**Now** (same model as Send `planHash` / testnet DeFi):
- `earnPrepare` builds the plan once, stores it in a worker `ReviewStore` under a random `reviewId`, bound to `walletId:derivationIndex`, TTL 3 min. Returns `reviewId` + summary.
- `earnSubmit` accepts only `reviewId` (single use, also on failure) and runs exactly that plan. Only nonce / sequence / blockhash / counter are read fresh.
- Fee cap: EVM steps refuse to sign if the live per-gas price exceeds the reviewed price +20% (multi-step: "Step 1 was sent… review the remaining step"). Cardano refuses if the rebuilt fee exceeds the reviewed fee +20%.

## 3. Balance-change previews
**Solana (new):** `simulateSolTx` now fetches the wallet's token accounts (Token + Token-2022), asks `simulateTransaction` for the post-state of every writable account, and reports net change per mint with decimals (known mints + on-chain mint decimals). Drainer patterns that move nothing at signing time are flagged and need the high-risk acknowledgement:
- `tokenOwnerChanged` — a token account of yours would belong to someone else (SetAuthority).
- `tokenDelegated` — another address could spend your tokens (Approve).
If token accounts cannot be read, the preview stays SOL-only and says token changes were not checked.

**EVM (fallback):** when the RPC lacks `eth_simulateV1`, the approval view calls the backend `POST /v1/tx/{chain}/simulate` (Alchemy `simulateAssetChanges`) before declaring the call blind. The backend has Alchemy simulation configured for **Ethereum and Base** only (`config/chains.yaml` `risk:`). To extend coverage, add `alchemy-simulate: {network: …}` for other chains Alchemy's Simulation API supports.

## 4. Biometrics and Ledger on real devices
Code review:
- Biometrics already run every WebAuthn step in a full tab (popup would close on the OS sheet). PRF is required; devices without PRF fall back to password (fails closed). Passkeys are bound to the extension ID, and the manifest pins no `key`: test on the Chrome Web Store build.
- **Fixed:** Ledger import opened Chrome's WebHID chooser in the toolbar popup, which closes on focus loss. Add wallet › Connect your Ledger now opens in a full tab (`?ledger=1`). Sending from the popup only reuses an already-granted device; if none is found it explains how to pair instead of opening the chooser.
- Open question: no Ledger path in `background/provider`, so confirm whether dApp signing with a Ledger account is meant to work.

### Manual test matrix (to run on real hardware)
| Device | Cases |
|---|---|
| MacBook, Touch ID (Chrome store build) | enable biometrics; unlock; dApp sign after auto-lock; reveal/backup gate; wrong finger ×3; cancel sheet; password fallback; macOS without PRF → password-only message |
| Windows 11, Windows Hello (PIN + face/finger) | same as above; Hello dialog behind browser; PRF unsupported build → password-only |
| Ledger Nano S+/X (USB) | connect from popup → opens tab; read ETH/BTC/SOL addresses; add wallet; send ETH + ERC-20 (clear-sign + blind-sign off/on); send BTC; device locked; wrong app open; reject on device; unplug mid-sign; send from popup with device already paired; send with device never paired → pairing message |

Automation to add later: Chrome DevTools virtual authenticator with `hasPrf: true` for e2e biometric flows; Ledger **Speculos** emulator for APDU-level signing tests in CI.

## Not changed
- Backend: no code changes (gateway already allows `getTokenAccountsByOwner`, `getMultipleAccounts`, `simulateTransaction`, `eth_simulateV1`; `/v1/tx/{chain}/simulate` already existed).
- Test runner note: on the Linux VM, tests need `ESBUILD_BINARY_PATH` pointing to a linux esbuild binary because `node_modules` was installed on macOS.
