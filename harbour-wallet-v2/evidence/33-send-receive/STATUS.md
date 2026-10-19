# Send / Receive / Transaction detail — STATUS (evidence 33)

Verification level for every row: signing is checked against independent code in `test/send.test.js` (viem recover, noble ed25519/secp256k1, manual BTC parse); fee / nonce / UTXO / broadcast paths run against MOCKED fetch. **No chain was contacted live: every network path is live-unverified.** Nothing is ever broadcast in tests.

Legend: Real = signs and broadcasts through a public API, tested offline. Partial = works with listed limits. Gap = explicit "not supported yet" state with a reason, never a silent failure.

## Chain families (registry: 86 chains + Sepolia)
| Family (chains) | Status | Notes |
|---|---|---|
| EVM (45 + Sepolia + user-added networks) | Real | EIP-1559 tiers from feeHistory, legacy fallback, OP-stack L1 fee, ERC-20, contract-recipient warning, Max, nonce from pending count |
| Bitcoin (Esplora) | Real | segwit UTXO selection via wallet-core plan, change to sender, dust check, fee-rate tiers; ordinals/inscribed UTXOs are NOT detected (see Gap below) |
| Solana | Real | SOL, SPL and Token-2022, ATA creation, priority-fee tiers, rent checks |
| TRON | Real | TRX + TRC-20, bandwidth/energy fee, 1 TRX activation fee |
| Cosmos SDK (14 chains) + THORChain | Real | native denoms; memo; fixed gas-price tiers. Token (IBC/CW20) sends not implemented, native only |
| XRP | Real | destination tag, lsfRequireDestTag block, reserve check |
| Stellar | Partial | XLM only; no custom assets |
| Algorand | Real | ALGO + ASA |
| NEAR, Aptos, TON, Sui, Tezos, Filecoin, Polkadot/Kusama, Waves, VeChain (fee in VTHO), Harmony, ICON, Zilliqa, MultiversX, Theta, IoTeX | Partial | native coin only. Fees for TON, Sui, Tezos and ICON are fixed estimates. No jettons (TON), Aptos/Sui coins, ESDT, TFUEL listing |
| Internet Computer, FIO, Nimiq, Aion, Ontology | Gap | no signer + public broadcast path available; reason shown on the Prepare screen (`UNSUPPORTED_REASON`) |

## Screens
| Screen | Status | Notes |
|---|---|---|
| `/send` SelectAsset | Real | search, balances, unsupported rows explain on open |
| `/send/:assetId` Prepare | Real | paste, QR scan (camera + image fallback), address book, ENS/SNS, memo/tag/comment, fiat toggle, Max, fee tiers |
| `/send/confirm` | Real | summary, tier edit, guard sheet, pending/success/failure, fee-jump guard (+25%), retry |
| `/transaction/:id` | Real | polls every 6 s while pending, explorer link, stuck notice. No speed-up/cancel (TW has none) |
| `/receive`, `/receive/chain/:id`, `/receive/:assetId` | Real | searchable list, QR, copy, share (clipboard fallback), TW warning, per-chain notes |
| `sendNft` (ERC-721/1155, Solana SPL NFT) | Partial | engine + handlers + screen done and tested for ERC-721; the NFT feature ships its own `nftSend` flow, so this one is only reachable via `params.nft` |
| `/send/bridge` | Gap | TW routes through a private gateway; screen says so |
| `/send/:assetId/inscriptions`, `/inscribe` | Gap | needs an indexer (private TW gateway); screen says so |

## Known gaps and assumptions
- Risk lists (sanctioned / "potentially risky" / exchange-address memo requirement) have no public equivalent: not implemented. Locally implemented guards: smart contract, new recipient, self-send, high value (1,000 USD, assumption).
- FlexGas fee payment and Ledger signing are not implemented here (Ledger belongs to the hardware worker).
- Migration chaining (wallet migration `params.migration`) resolves each next destination address through `walletsDetailed`; untested end to end.
- Fee estimates for non-EVM chains are live-unverified; confirm against a funded testnet account before trusting mainnet.
- Unit tests: 48 in `test/send.test.js`; full suite 334/334.
