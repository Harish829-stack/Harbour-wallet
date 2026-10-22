# Trust Wallet server/API contracts (from live HAR, 240 entries)

Source: HAR captured from the real extension on open internet (throwaway wallet).
Resolves the egress-blocked gaps for #10/#15/#17.

## Main API gateway — `gateway.us.trustwallet.com`
Asset-id scheme: native = `c<coinType>` (e.g. `c60` ETH, `c0` BTC); token =
`c<coinType>_t<tokenAddress>`. Currency param e.g. `USD`.

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | /v1/balances/stream | balances (streaming) | body `{currency, addresses:[{asset_id,address}]}` → NDJSON `{type:"balance",payload:{...amounts:{total,total_in_fiat,available,...}}}` |
| POST | /v2/market/tickers | prices | body `{currency, assets:[asset_id]}` → `{tickers:[{id,price,change_24h,provider,slug,last_updated_time}]}` |
| GET  | /v2/market/charts/c<ct> | price chart | per asset |
| GET  | /v2/market/info/c<ct> | market info | |
| POST | /v1/assets | asset metadata (bulk) | body `{assets:[{address,coin,publicKey}]}` |
| GET  | /v1/assets?asset_ids=... | asset metadata | → `[{name,symbol,type,decimals,network,asset_id,icon_url,classification,...}]` |
| GET  | /v1/search/assets | token search | |
| GET  | /v1/coinstatus/c<ct>, /v2/coinstatus/c<ct> | coin status/gating | |
| POST | /v1/txhub/bulk_history | tx history (bulk) | body `{addresses:[{chain,address}]}` → `{data:[],meta:{unsupported_chains:[...]}}` |
| GET  | /v1/txhub/txs | tx history (single) | query `asset,chain,address,from,to` |
| POST | /v1/validate/address | address validation + risk | body `{asset_id,address,version,type}` → `{provider,risk_analysis:{risk_level,...}}` |
| GET  | /v2/announcements | announcements | |
| GET  | /v1/buycrypto/widget/quote | buy-crypto quote | fiat on-ramp |
| GET  | /v1/cex-transfer/providers/{coinbase-pay,binance-pay}/assets | CEX transfer | |
| GET  | /v1/discover/group/invest-staking, /v1/invests/staking | staking discovery | |
| GET  | /v1/apr/proxy/stakewiz | staking APR proxy | |
| POST | /v3/nft/collections | NFTs | |
| GET  | /v3/points/<addr>/vip | loyalty points | |
| POST | /v2/devices/fingerprint, GET /v2/devices/<id> | device identity | |

## Per-chain RPC/nodes — `<chain>.twnodes.com` (NaaS)
Pattern: `https://<chain>.twnodes.com/naas/session/<sessionToken>/...`
(NaaS = node-as-a-service; a session token is embedded in the path).
- **EVM** (ethereum, bsc, polygon-zkevm, zetachain-evm, neon, zklink-nova-evm, evmos-jsonrpc, callisto, …): `POST` JSON-RPC at the session root.
- **UTXO** (btc-book, litecoin/doge/dash/zcash/…-blockbook): Blockbook `GET /api/v2/address/<addr>`.
- **Cosmos** (crypto-org-lcd, greenfield, evmos-api, stargaze-api): LCD `GET /cosmos/...`.
- **Tron**: `POST /wallet/getaccount`. **Solana**: `POST` JSON-RPC. **Cardano**: GraphQL POST.
- Also: `api.bnbchain.org/bnb-staking/v1/validator/all`, `query.thegraph.kiln.fi/subgraphs/name/vsuite` (Kiln staking).

## Other hosts
- `assets-cdn.trustwallet.com` — token/chain logos (`/blockchains/<chain>/assets/<addr>/logo.png`).
- `wallet-kit.trustwallet.com` — WalletKit service.

## Not captured (not exercised in this HAR)
- DEX **swap** quote/submit endpoints (no swap action performed) — capture a swap next time.
