# Sepolia DeFi adapter

This module adds Aave V3 supply/withdraw on Base Sepolia and Uniswap Trading API swaps on Ethereum Sepolia to the **V3 extension**. Existing production aggregator and native staking code is preserved.

## Switch or detach

`config.ts` contains the only mode switch:

```ts
export const DEFI_CONFIG: Readonly<{ mode: 'testnet' | 'legacy' }> = Object.freeze({ mode: 'testnet' });
```

Set `mode` to `'legacy'` and rebuild to restore the previous Swap and Earn tabs and their background message registrations. Testnet handlers are then unregistered. The existing global `swap` and `earn` feature flags still apply.

The host connections are limited to:

- `popup/wallet/Wallet.tsx`: chooses the new or legacy tab component.
- `background/index.ts`: registers legacy swap handlers only in legacy mode.
- `background/handlers/index.ts`: chooses the new DeFi handlers or legacy staking handlers.

For full removal, restore those three connections, remove `popup/wallet/defi/`, `background/handlers/testnetDefi.ts` and this folder. Legacy implementations require no reconstruction.

## Boundaries

- `client.ts`: network-aware public RPC reads for the configured test markets.
- `aavekit.ts`: AaveKit (api.v3.aave.com) reserve list and supply/withdraw plans, incl. native ETH via the WETH gateway; every returned transaction is decoded and checked before review. Falls back to `aave.ts` for ERC-20 reserves.
- `aave.ts`: on-chain reserve state (status/caps/rates/positions) and the direct supply/withdraw builder.
- `uniswap.ts`: seeds the token picker from known Sepolia ERC-20 contracts, then uses Uniswap's API for exact-input quotes, approval checks and swap calldata. Native ETH is sent as the API's zero address. Quotes must honour the user's slippage floor; API transaction data is used after enforcing chain, account, the Uniswap proxy target and the ETH value. Approvals are rebuilt for the exact input amount.
- `rpc.ts`, `abis.ts`, `types.ts`: shared protocol primitives with no wallet/key dependencies.
- `plans.ts`: bounded, expiring, single-use worker review storage.
- `background/handlers/testnetDefi.ts`: active wallet checks, estimates, review IDs, signing, submission and receipts.
- `popup/wallet/defi/TestnetDefiTab.tsx`: network-aware discovery, action form, review and result. The popup cannot supply arbitrary calldata to the signer.

## Runtime behavior

Swap is enabled on **Ethereum Sepolia (11155111)**; Earn is enabled on **Base Sepolia (84532)**. The selected wallet network and RPC-reported chain must agree. Other networks show a switch prompt. This switch changes the wallet's network filter, not a website's dApp connection.

Earn lists reserves from AaveKit (plus native ETH for the WETH reserve), then checks each reserve's active/frozen/paused state, remaining supply cap, balances and liquidity on-chain; if AaveKit is unavailable it uses `Pool.getReservesList()` directly. AaveKit's own cap flag is ignored because it reports cap-0 (unlimited) reserves as full. A frozen or capped asset with an existing position remains visible for withdrawal. Current variable APY is calculated from the live ray-denominated supply rate. Withdrawals are simulated for existing collateral restrictions.

Swap lists ETH and known ERC-20 token contracts, with up to eight additional contracts per session. Uniswap's API chooses the route and checks live liquidity for the entered amount; a token can appear in the picker and still have no usable route. WETH is hidden from the picker so users can swap native ETH directly. Cross-chain swaps are not enabled.

The testnet Swap path does not offer separate wrap or unwrap actions. Token symbols are accompanied by contract address suffixes, and Aave eligibility is determined only by live reserves on Base Sepolia.

The Uniswap API key is held by the backend (`UNISWAP_API_KEY`) and its allow-listed routes are reached through Harbour's signed gateway. Approvals grant only the swap's exact input amount. Review plans bind amount, calldata, recipient, account and network. Swaps include the API's minimum output and deadline. The worker waits for each receipt and stops after a revert, expiry, lock, account or selected-network change. Keys are wiped immediately after each signature. Partial transaction hashes remain available in the result and the existing activity recorder.

To enable API quotes, set `UNISWAP_API_KEY` in the backend environment and restart/redeploy the Harbour API. The extension never receives this key.

Plans are in worker memory: service-worker restart or popup/account/network changes can require a fresh review. No automatic retry submits a transaction. If an RPC times out after a broadcast, check the explorer/activity before retrying. Hardware wallets are currently unavailable in this adapter.

## Checks

```bash
node --test test/testnet-defi.test.js test/testnet-defi-handlers.test.js
npm run verify
node scripts/check-testnet-defi.mjs
```

The last command makes read-only calls to the public Sepolia RPC (override with `SEPOLIA_RPC_URL`). It verifies chain ID, bytecode at all deployment addresses, live Earn discovery and the seeded swap token list. It never opens a wallet or broadcasts. Signed supply/withdraw/swap acceptance testing requires a funded test wallet and explicit transaction confirmation in the extension.

Deployment sources:

- https://developers.uniswap.org/deployments
- https://github.com/aave-dao/aave-address-book/blob/main/src/ts/AaveV3Sepolia.ts
- https://www.aave.com/docs/aave-v3/smart-contracts/pool
- https://developers.uniswap.org/docs/trading/swapping-api/concepts/no-permit2-workflow
- https://aave.com/docs/aave-v3/getting-started/graphql
