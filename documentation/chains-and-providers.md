# Chains and providers

## What is served, and how

| Group | Reads (balances, history, NFTs) | Sending | Configured in |
| --- | --- | --- | --- |
| **EVM, indexed** (18 entries in `chains.yaml` have an indexer `sources:` block) | Backend database: Alchemy Transfers + Address Activity webhooks, balances from chain via Multicall3, NFTs, prices | Extension signs; broadcast through the backend | `apps/backend/config/chains.yaml` |
| **EVM, RPC-only** (the other EVM entries, 60 in total) | Native balance and fees through the backend RPC proxy `/v1/rpc/{chain}`; history and NFTs from public explorers where the extension adapters support them | Same | `chains.yaml` entries without `sources:` |
| **Non-EVM** (Bitcoin, Solana, TRON, Cosmos family, TON, Sui, Aptos, XRP, Stellar, and more) | The extension calls each chain's public endpoints directly; the backend does not serve them, except Solana, TRON and TON calls routed through `/v1/gw` where keys are needed | Per-family send code in `src/core/chains/send/` | `src/core/chains/registry*.json` |

Indexed chains: ethereum, base, sepolia, base-sepolia, polygon, arbitrum, optimism, smartchain (BNB), avalanchec, linea, scroll, zksync, blast, mantle, celo, xdai (Gnosis), opbnb, sonic.

`ENABLED_CHAINS` in the backend `.env` limits what a deployment serves; empty means every chain in `chains.yaml`.

**Defaults.** Only a chain's native coin is shown by default; tokens and NFTs appear after the user adds them. Networks are grouped Default / Custom / Testnets, and the same lists are used everywhere. Mainnets plus a few testnets ship; users add the rest by hand or through a dApp.

**Finality.** Chains whose nodes serve the `finalized` tag use it (`policy: finalized-tag`); the others use a block depth with `finality.options.confirmations`.

**Privacy trade-off.** Non-EVM reads and public-explorer reads reach third parties from the user's browser, and RPC-only EVM reads pass through the Harbour proxy, unlike indexed chains.

## Adding or changing an EVM chain

1. Add it to the extension registry (`apps/extension/src/core/chains/registry*.json`) if it is not there.
2. Add its network slugs to the `T` table in `apps/backend/scripts/gen_chains.py` (Alchemy, Infura, CoinGecko platform, finality, block time). Chains without an entry get public RPCs from the registry and a 30-block depth. The `INDEXED` set in that script chooses which chains get an indexer source.
3. Run `python3 apps/backend/scripts/gen_chains.py`. It rewrites the generated block of `config/chains.yaml` and `apps/extension/src/core/harbour/chainList.gen.ts`. `--check` fails if they are out of date (CI-friendly).
4. Restart the backend (`./run.sh restart`).

Provider slugs and per-chain Alchemy product coverage (Transfers API, Address Activity) come from the providers' naming conventions; **verify each new chain against the live provider**. A wrong slug makes that upstream fail and the gateway falls over to the next one.

## Providers

| Provider | Used by | For |
| --- | --- | --- |
| Alchemy | rpc-gateway, indexer, price-poller, api `/v1/gw` | RPC, Transfers API, webhooks, NFTs, metadata, asset-change simulation (Ethereum and Base only today), price fallback |
| Infura | rpc-gateway | second RPC provider |
| QuickNode, Chainstack | rpc-gateway (optional) | third and fourth pools for Ethereum and Base; full URLs in `QUICKNODE_*_URL`, `CHAINSTACK_*_URL`; skipped when empty |
| Public RPC endpoints | rpc-gateway | chains the keyed providers do not serve; shared and rate-limited, add keyed providers for production |
| CoinGecko, Alchemy Prices | price-poller | token prices, in that order (`price_sources`); thin or spam-scored tokens show "no price"; testnets have no prices |
| Etherscan v2 | api `/v1/gw` | history for chains the indexer does not cover |
| Helius, TronGrid, TON Center | api `/v1/gw` | Solana, TRON and TON access with server-held keys |
| LI.FI, Jupiter, Relay, THORChain, Uniswap Trading API | api `/v1/gw` / extension | swap and bridge quotes; Pimlico for optional gasless swaps |
| Blockscout, Routescan, mempool.space / Esplora | extension | explorer history without keys |
| GoPlus, ScamSniffer, MetaMask phishing list | extension | token, address and site risk checks (advisory) |
| Onramper (aggregates MoonPay, Banxa, Transak, Mercuryo and others) | backend | buy / sell quotes and signed checkout sessions; the receiving address comes from the vault and EVM addresses must belong to the device ([buy-sell-onramper.md](buy-sell-onramper.md)) |
| Hyperliquid, Polymarket | extension | perps and prediction markets (flagged off by default) |
| WalletConnect / Reown | extension | WalletConnect v2 relay (project id required) |
| Web Push (VAPID), Firebase Cloud Messaging | notifier, extension | push notifications; FCM optional |

Every backend key is listed in `apps/backend/.env.example`.

## Adding a provider

See "Extending the backend" in [backend-services.md](backend-services.md): a plain URL-based provider needs only YAML and an env var; anything with its own scheme needs one adapter package that passes the shared `contracttest` suite.
