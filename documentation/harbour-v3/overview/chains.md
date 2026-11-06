# Harbour v3: supported chains (plan phase 8)

Decision (2026-10-29): v3 is no longer testnet-only. It serves every chain Harbour v2 offered, with mainnet signing.

## What is served and how

| Group | Count | Reads (balances, history, NFTs) | Sending / signing | Where it is configured |
|---|---|---|---|---|
| **EVM, indexed** | 14 mainnets + Ethereum, Base + Sepolia, Base Sepolia | Backend database (Alchemy Transfers + Address Activity webhooks, balances from chain via Multicall3, NFTs, prices) | Extension signs; broadcast through the backend | `backend/config/chains.yaml` entries with `sources:` |
| **EVM, RPC-only** | 38 mainnets | Native balance and fees through the backend RPC proxy (`/v1/rpc/{chain}`); history and NFTs from public explorers where the v2 adapters support them | Same as above | `chains.yaml` entries without `sources:` |
| **Non-EVM** | 41 (Bitcoin, Solana, TRON, Cosmos family, TON, Sui, Aptos, XRP, Stellar, ...) | The extension calls each chain's public endpoints directly (v2 adapters). The backend does not serve them. | v2 per-family send code | `src/core/chains/registry*.json` |

Indexed EVM mainnets: ethereum, base, polygon, arbitrum, optimism, smartchain (BNB), avalanchec, linea, scroll, zksync, blast, mantle, celo, xdai (Gnosis), opbnb, sonic.
The default home shows Bitcoin, Ethereum, Solana, Tron, BNB Chain, Base, Polygon, Arbitrum, Optimism and Avalanche; the rest are turned on from Manage crypto.

## Adding or changing an EVM chain

1. Add it to the extension registry (`src/core/chains/registry*.json`) if it is not there.
2. Add its network slugs to the `T` table in `backend/scripts/gen_chains.py` (Alchemy, Infura, CoinGecko platform, finality, block time). Chains with no entry get public RPCs from the registry and a 30-block depth.
3. `python3 backend/scripts/gen_chains.py` rewrites the generated block of `chains.yaml` and `src/core/harbour/chainList.gen.ts`. `--check` fails if they are out of date.
4. `ENABLED_CHAINS` (backend `.env`) restricts what a deployment serves; empty means all.

Finality: chains whose nodes serve the `finalized` tag use it (`finalized-tag`); the others use `depth` with `finality.options.confirmations`.

## Things to verify before relying on this

- **Provider slugs and product coverage were not tested against live services.** Infura slugs come from Infura's endpoint list. Alchemy slugs, webhook network names and which chains support the Transfers API and Address Activity are from Alchemy's naming convention and need checking per chain. A wrong slug makes that upstream fail and the gateway fails over to the public RPCs. `gen_chains.py` has the `INDEXED` set to trim.
- **Go code was not compiled** (module proxy blocked where this was written): `cd backend && go build ./... && go vet ./... && ./run.sh test`.
- **Public RPC endpoints** come from the registry and are shared, rate-limited and unauthenticated. For production, add keyed providers (QuickNode, Chainstack) per chain.
- **Privacy:** non-EVM and RPC-only reads reach third parties directly from the user's browser (non-EVM) or through the Harbour proxy (EVM RPC-only), unlike indexed chains.
- **Security audit:** `SECURITY-AUDIT-V3.md` finding V3-02 (testnet-only enforcement) no longer applies. The deferred v2 items SIG-08 (weaker approval decoding for non-EVM chains), SIG-11 and SIG-14 now apply to v3 again. Mainnet signing means real funds: audit before a public release.
