# Balance / history / send adapter status per chain family (updated 2026-10-19, chain-data worker)

Full per-family detail, endpoints and gaps: `../32-chain-data/STATUS.md`. All data adapters are live-unverified (egress blocked); tests use mocked fetch.

| Family (kind) | Chains | Balance | History | Send/sign | Notes |
|---|---|---|---|---|---|
| evm | 45 | Real (JSON-RPC, fallback list) | Real for 13 chains (Blockscout/Routescan incl. ERC-20); others unsupported | Real (viem, native + ERC-20) | gas station for all |
| solana | solana | Real | Real (parsed txs, SPL legs) | see send worker | SPL custom tokens Real |
| utxo | bitcoin | Real (Esplora) | Real (Esplora) | see send worker | |
| cosmos | 14 | Real (LCD bank, per-chain denom) | Real (LCD tx search) | see send worker | |
| tron | tron | Real | Real (native + TRC-20) | see send worker | TRC-20 custom tokens Real |
| ton, aptos(partial hist), sui, near, algorand, ripple, stellar, tezos, filecoin, waves, vechain, multiversx, icp | one each | Real | Real (aptos: sent txs only) | see send worker | |
| polkadot, kusama | 2 | Real (Asset Hub System.Account) | Real (Subscan Asset Hub) | see send worker | relay chain deliberately not used |
| harmony, icon, zilliqa, theta, iotex, fio, ontology | one each | Real | Unsupported (no keyless tx-list API) | see send worker | |
| nimiq, aion | 2 | Unsupported (explicit `unsupported:`) | Unsupported | n/a | no verified public endpoint |
