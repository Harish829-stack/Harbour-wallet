# 10 - Comparison with Harbour Wallet

Sources: Trust Wallet 26.41.0 analysis (docs 01-09) vs `FEATURE-MATRIX.md` (Harbour, 2026-10-19). Harbour claims come from that file and are not re-verified here.

## 1. Architecture alignment

| Area | Trust Wallet 26.41.0 | Harbour | Gap |
|---|---|---|---|
| Runtime | MV3 worker, Redux, DI, 204 `@Event` handlers, internal/public split | MV3 router, modular `handlers/*` | Low. Verify Harbour enforces internal-flag stripping (doc 09 s3) |
| Crypto core | wallet-core 4.8.2 wasm | same wasm | None |
| Vault | PBKDF2 + AES-GCM, keystore, throttle, session unlock | same layering | Low; derived keys held in `storage.session` in TW; Harbour should choose consciously |
| Chains | 168-entry embedded registry | 86 chains | Medium: registry is 168 vs 86 shipped; user-visible count in TW UNKNOWN |
| Provider | EIP-1193/6963 + many chain families, HMAC handshake | EIP-1193/6963, Solana, Wallet Standard; injection never loaded in Chrome | High until Chrome QA passes |
| Backend | Private gateways, node fleet, WalletKit (Kotlin/JS) | Public RPCs, CoinGecko-style, assets repo | Structural: cannot match data quality without a gateway |
| Swap | Own swap API plus relay/rango/metaswap hooks | LI.FI + Jupiter | Medium: no BTC/THORChain, no cross-VM, no gasless |
| Earn | Gateway-backed multi-chain staking | 12 Cosmos, SOL, ETH Lido, BNB | Medium: Tron, Polkadot, Cardano missing |
| NFT | Gateway + indexer | Blockscout/DAS/Magic Eden | Low-Medium |
| Ramps | Provider aggregation via gateway | Public provider substitutes | Medium |
| Perps / prediction | Hyperliquid client and prediction clients present | Not present | New-scope features (UI exposure in TW UNKNOWN) |
| Analytics/flags | Amplitude + Experiment, Sentry | None listed | Intentional; flags give remote kill switches |
| Security extras | User blacklist only; no simulation (doc 05) | Public lists + local blacklist; approval scan partial | Harbour already ahead on lists |

## 2. Ranked gaps to close

1. **Verification**: live RPC/API checks, Chrome QA of injection, TW signing vectors. (Blocks trust in everything else.)
2. **Provider parity**: confirm the HMAC-style page-to-content handshake equivalent and internal-flag stripping (doc 02, 09).
3. **Chain breadth**: reconcile 86 vs 168 registry; prioritise chains with token support beyond EVM.
4. **Send coverage**: ICP, FIO, Nimiq, Aion, Ontology; tokens on non-EVM chains; FlexGas.
5. **Swap**: BTC/THORChain, EVM<->Solana, gasless.
6. **Staking**: Tron, Polkadot, Cardano; multi-validator.
7. **Remote config**: TW pulls chain config from a CDN (e.g. Polkadot `chain-config.json`) and flags from Amplitude; Harbour has no remote-update path.
8. **Ledger/hardware**: stub only.
9. **Notifications/push**: TW has `gcm` permission; Harbour lacks a push backend.
10. **Hardening choices**: decide how long derived keys stay in session storage (doc 08/09).

## 2b. Where Harbour deliberately differs

Per-origin chain selection, modular adapters, EVM staking signed with viem, public-provider backends. These are valid trade-offs but mean parity tests need per-feature acceptance criteria rather than behaviour diffing.

## 3. Worked example: Ethereum send

TW: UI -> store -> worker handler -> WalletKit builds transaction via gateway/nodes -> wallet-core signs -> broadcast through node host (doc 05).
Harbour: UI -> handler -> adapter builds tx from public RPC -> wallet-core signing input -> RPC broadcast. Same signing core, different data plane; fee estimates and nonce/balance freshness will differ.

## 4. Evidence caveats

Harbour statements are quoted from its matrix, which itself says verification is the largest gap. TW statements follow the labels in docs 01-09.
