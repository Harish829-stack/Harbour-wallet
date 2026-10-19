# 32 — Multi-chain data adapters (balances, tokens, history, gas)

Status key: **Real** = implemented against a documented public API with mocked-fetch tests; **Unsupported** = deliberately not implemented (reason given).
Everything is **live-unverified**: the build sandbox blocks public RPC/explorer egress, so request shapes follow each project's public docs and were
exercised only against mocked `fetch` (`test/chain-data.test.js`, `test/chain-data-handlers.test.js`). Trust Wallet's own sources
(`*.twnodes.com` NaaS, `gateway.us.trustwallet.com`) need a TW credential and are NOT used (public equivalents named below).

## Native balance (`core/chains/adapters/*`, registered in `adapters/index.ts`)
Contract: never throws; account-not-found => `0` with `ok:true`; any transport/parse failure => `ok:false` (UI shows "Unavailable", never a fake zero).
Integer fields above 2^53 (FIO, Algorand, Waves, Tron) are read from raw JSON text so they are not rounded.

| Family (chains) | Status | Endpoint (registry endpoint first, then adapter fallback) | Not-found rule |
|---|---|---|---|
| utxo (bitcoin) | Real | Esplora `GET {mempool.space/api, blockstream.info/api}/address/{a}` chain+mempool funded−spent | n/a (zeros) |
| cosmos (14: cosmos, terra, kava, agoric, thorchain, injective, osmosis, zetachain, akash, sei, juno, stride, axelar, neutron) | Real | LCD `GET /cosmos/bank/v1beta1/balances/{a}`; denom table `COSMOS_DENOM` (uatom, uluna, ukava, ubld, **rune**, **inj**, uosmo, **azeta**, uakt, usei, ujuno, ustrd, uaxl, untrn); `by_denom` fallback if paginated | denom absent => 0 |
| tron | Real | TronGrid `POST /wallet/getaccount {address, visible:true}` | `{}` => 0 |
| ton | Real | toncenter v2 `GET /getAddressBalance?address=` | uninitialised => "0" |
| aptos | Real | `POST /view 0x1::coin::balance<AptosCoin>` (coin + paired FA) | 404/`account_not_found` => 0 |
| sui | Real | JSON-RPC `suix_getBalance(addr,"0x2::sui::SUI")` | "0" |
| near | Real | JSON-RPC `query/view_account` (`amount`); fallback `free.rpc.fastnear.com` | `UNKNOWN_ACCOUNT` => 0 |
| algorand | Real | algod-compatible `GET /v2/accounts/{a}?exclude=all` (algonode) | 404 => 0 |
| ripple | Real | `account_info` (validated ledger) | `actNotFound` => 0 |
| stellar | Real | Horizon `GET /accounts/{a}` native balance (exact 7-dp parse) | 404 => 0 |
| tezos | Real | node RPC `/chains/main/blocks/head/context/contracts/{a}/balance` | 404 => 0 |
| filecoin | Real | Lotus `Filecoin.StateGetActor` (`Balance`) | "actor not found" => 0 |
| waves | Real | node `GET /addresses/balance/{a}` | n/a |
| vechain | Real | Thor `GET /accounts/{a}` (`balance` hex) | n/a |
| harmony | Real | `eth_getBalance` on api.harmony.one with `one1…` bech32 -> hex (avoids `hmyv2_getBalance` JSON-number precision loss) | n/a |
| icon | Real | `icx_getBalance` (`/api/v3`) | n/a |
| zilliqa | Real | JSON-RPC `GetBalance` with `zil1…` bech32 -> hex | code −5 "not created" => 0 |
| multiversx | Real | gateway `GET /address/{erd1…}/balance` | new account "0" |
| theta | Real | `theta.GetAccount` (`coins.thetawei`; TFUEL ignored) | "not found" => 0 |
| iotex | Real | `eth_getBalance` on `babel-api.mainnet.iotex.io` with `io1…` -> hex (registry gRPC-web endpoint not used) | n/a |
| polkadot, kusama (substrate) | Real | `state_getStorage(System.Account)` key = twox128("System")‖twox128("Account") constant ‖ blake2_128(pk) ‖ pk; free balance from SCALE AccountInfo. **Asset Hub** RPCs (`*-asset-hub-rpc.polkadot.io`, dwellir) only: balances moved there in the 2025 migration, the relay endpoints in the registry would answer a stale 0 | no storage entry => 0 |
| internet_computer (icp) | Real | Rosetta `POST rosetta-api.internetcomputer.org/account/balance` (64-hex ledger account id) | n/a |
| fio | Real | `POST /v1/chain/get_fio_balance {fio_public_key}` (`available`) | 404 => 0 |
| ontology | Real | JSON-RPC `getbalance` (`ont`) | n/a |
| nimiq | **Unsupported** | no verified public Albatross JSON-RPC (nimiq.watch is the retired legacy chain) | reports `unsupported:` |
| aion | **Unsupported** | Aion mainnet public endpoints retired | reports `unsupported:` |

## Custom assets, non-EVM (`adapters/tokens.ts`, `background/handlers/chainData.ts`, `popup/wallet/tokenScreens.tsx`)
| Flow | Status | Notes |
|---|---|---|
| Solana SPL balance | Real | `getTokenAccountsByOwner(owner,{mint})` jsonParsed, sums all accounts (Token + Token-2022) |
| Solana SPL probe | Real / Partial | decimals + mint-ness from `getAccountInfo` (certain). name/symbol are not on the mint: best-effort Jupiter token index (`lite-api.jup.ag/tokens/v2/search`), accepted only if `id` AND `decimals` match the chain; otherwise the user types name/symbol (decimals stay chain-locked). Metaplex metadata PDA not implemented |
| Tron TRC-20 balance + probe | Real | TronGrid `triggerconstantcontract` (`balanceOf/name/symbol/decimals`, string + bytes32 decoding) |
| Jetton (TON), Aptos/Sui coins, Cosmos IBC tokens | Gap | not implemented |
| Add/remove/list UI | Real | `addChainToken` screen (reached from Select network), tokens stored per wallet in vault `customChainTokens`, shown on Home beside EVM tokens, detail screen shows SPL/TRC20 + explorer link |
| Send / USD price for these tokens | Gap | send belongs to the send worker; no CoinGecko mapping for non-EVM contracts, rows show balance only |

## Transaction history (`core/txHistory.ts` `fetchHistory(chain|id, address)`, `adapters/history.ts`)
Normalized `HistoryItem`: `kind` (send/receive/self/contract = direction), `amount` (human), `symbol`, optional `token{symbol,address,decimals}`, `counterparty`, `status`, `id` (hash), `timestamp` (ms), `url`, optional `usd`.
`usd` is set ONLY when the explorer reports the rate valid at that transaction (Blockscout `historic_exchange_rate`); today's price is never used as "price at tx time".

| Family | Status | Source | Notes |
|---|---|---|---|
| EVM (ethereum, base, arbitrum, polygon, sepolia, optimism, xdai, zksync, scroll, blast, celo) | Real | Blockscout v2 `/api/v2/addresses/{a}/transactions` + `/token-transfers?type=ERC-20` | hosts other than the first five are naming-convention guesses |
| EVM (smartchain, avalanchec) | Real | Routescan etherscan-compatible `txlist` + `tokentx` | |
| Other EVM chains (≈30) | **Unsupported** | no keyless public tx-list API wired | UI says history unavailable |
| Bitcoin | Real | Esplora `/address/{a}/txs` (mempool.space, blockstream fallback) | |
| Solana | Real | `getSignaturesForAddress` + `getTransaction` jsonParsed: native delta, SPL legs, counterparty | 20 newest signatures; token symbol only for USDC/USDT (else short mint) |
| Tron | Real | TronGrid `/v1/accounts/{a}/transactions` + `/transactions/trc20` | |
| Cosmos (14) | Real | LCD `/cosmos/tx/v1beta1/txs` events `transfer.recipient|sender` (`events=` then `query=` for SDK 0.50) | native denom only |
| Aptos | Partial | `/accounts/{a}/transactions` | only txs the account **sent**; incoming need the indexer (gap) |
| Sui | Real | `suix_queryTransactionBlocks` From/To + balanceChanges, gas netted | SUI only |
| TON | Real | toncenter `/getTransactions` | |
| Algorand | Real | algonode indexer `/v2/accounts/{a}/transactions` | payments only |
| Stellar | Real | Horizon `/accounts/{a}/payments` | native + create_account |
| Ripple | Real | `account_tx` | XRP + IOU payments |
| NEAR | Real | NearBlocks `api.nearblocks.io/v1/account/{a}/txns` | rate-limited without key |
| Tezos | Real | TzKT `/v1/accounts/{a}/operations?type=transaction` | |
| Filecoin | Real | Filfox `/api/v1/address/{a}/transfers` | |
| Waves | Real | node `/transactions/address/{a}/limit/25` | native transfers |
| VeChain | Real | Thor `POST /logs/transfer` | VET transfers |
| MultiversX | Real | `api.multiversx.com/accounts/{a}/transfers` | |
| Polkadot/Kusama | Real | Subscan Asset Hub `/api/v2/scan/transfers` | keyless quota is small |
| ICP | Real | Rosetta `/search/transactions` | |
| Harmony, ICON, Zilliqa, Theta, IoTeX, FIO, Ontology, Nimiq, Aion | **Unsupported** | no stable keyless tx-list API verified | `unsupported:true` + reason (`HISTORY_UNSUPPORTED_REASON`) |

## Gas station (`core/gasFees.ts`, `popup/wallet/features/gas.tsx`, message `chainDataGas`)
Real for every EVM network: `eth_gasPrice` + `eth_feeHistory(5,"latest",[10,50,90])` + `eth_maxPriorityFeePerGas`. Tiers: priority = median of the 10/50/90th percentile over 5 blocks;
`maxFee = nextBase × (1.25 slow | 2 standard | 2 fast) + priority`; chains without a base fee get one honest tier from `eth_gasPrice`. Shows the cost of a 21,000-gas transfer in native units and
USD (CoinGecko native price; omitted on testnets / when unavailable), refreshes every 15 s, loading/error/retry states. Deviation: TW's `/gas-station/:assetId` data comes from its gateway; the formula above is Harbour's, not TW's. No time estimates are shown (would be invented).
Entry point: Token detail › Holdings › "Gas station" (EVM natives); screen name `gasStation`.

## UI wiring
- Home already read `getBalances` (adapters); Token detail Holdings previously showed `— SYM` for non-EVM and `0.0000` on failure: now shows the real balance, "Unavailable" + "Couldn't load balance" on adapter failure.
- Activity now aggregates every visible network with a wired history source (bounded concurrency 6, max 30 chains) and lists per-chain failures with Retry; unsupported chains are skipped silently (Token detail › History states "not available for this network yet").
- Messages (`handlers/chainData.ts`): `chainDataCapabilities`, `chainDataBalance`, `chainDataHistory`, `chainDataGas`, `chainDataTokenProbe|Add|Remove|Balances`. The legacy `txHistory` message now accepts any registry id/address charset and routes through `fetchHistory`.

## Side fix
`explorerTxUrl` / `explorerAddressUrl` (`core/chains/index.ts`) dropped the hash/address for wallet-core's prefix-style paths (`/tx/`, `/#/transaction/`, 85 of 86 chains): now appended when no `{id}`/`{address}` placeholder exists (this also repairs the Send "done" explorer link).

## NOT verified / known gaps
Live responses of every endpoint above; Blockscout hosts for optimism/xdai/zksync/scroll/blast/celo; Routescan coverage of 56/43114; `lite-api.jup.ag` token search shape; Aptos incoming history; Solana/Tron token USD prices; Jetton/other non-EVM token standards; Send for non-EVM tokens (send worker).
