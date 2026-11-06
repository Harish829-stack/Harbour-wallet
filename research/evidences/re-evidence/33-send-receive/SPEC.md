# Send / Receive / Transaction detail — SPEC (evidence 33)

Confidence tags: [REA] recovered from the TW extension chunks with REA (string id + default text in `tw-strings.json`); [HAR] seen in captured traffic; [INFER] inferred from TW behaviour or standard wallet practice; [ASSUME] Harbour decision with no TW evidence.

## Routes
| Route | Screen | Source |
|---|---|---|
| `/send` | SelectAsset, title "Select asset to send" | [REA] `send.select-asset` strings |
| `/send/:assetId` | Prepare: "Address or Domain Name", address book, Amount, Max, fee row | [REA] |
| `/send/confirm` | Confirm: From/To, amount, fee, "Before you send" guard sheet | [REA] guard strings; layout [INFER] |
| `/send/bridge` | "Bridge & send" (From/To Network, Minimum received, Provider, Total) | [REA] strings; flow depends on TW private route gateway, Gap |
| `/send/:collectionId/:nftId` | NFT transfer | [REA] route, [INFER] form |
| `/send/:assetId/inscriptions`, `/inscribe` | "Inscribed Tokens" unlock notice | [REA] strings; indexer private, Gap |
| `/receive`, `/receive/chain/:blockchainId`, `/receive/:assetId` | chain/asset list, QR, "Address copied", warning | [REA] |
| `/transaction/:id` | status, hash, fee, explorer; "This transaction is still pending" notice | [REA] |

## Behaviour recovered
- Fee tiers are Safe / Average / Fast with "Estimated transaction cost" and "Gas cost" [REA]; FlexGas fee payment exists in TW and is not implemented [REA, Gap].
- Errors: dust ("Unable to prepare the transaction due to a dust error"), "Insufficient funds, please try again with a larger amount.", simulation rejected, network-check failure [REA]. Harbour reuses these texts.
- Guard sheet "Before you send": memo required for exchange address, risky address, exchange deposit address needs memo/tag, restricted/fraudulent address, smart-contract recipient, "couldn't check this recipient" [REA]. Harbour implements smart-contract, new recipient, self-send and high value locally; the risk/sanction/exchange lists come from a private TW service and are a Gap.
- XRP reserve strings ("Added to Reserve", "Learn more about XRP reserves") [REA]: Harbour enforces the 1 XRP base reserve and destination-tag rules.
- Receive: "Wallet Address", "`${symbol} Address`", "Address copied" [REA]. The "Only send {assetName} ({assetType}) assets..." warning text is recovered [REA].
- No re-authentication step before signing, and no speed-up / cancel for pending transactions, were found in the chunks [REA negative]. Harbour implements neither.
- Pending notice: "This transaction is still pending" with explorer pointer and "Learn more" [REA]. The delay before it appears is [ASSUME] 10 minutes. The Learn-more URL was not recovered, so it is omitted.
- High-value threshold of 1,000 USD-equivalent for the extra guard: [ASSUME].
- Name resolution: label "Address or Domain Name" [REA]; ENS (.eth, Ethereum mainnet registry) and SNS (.sol via Bonfida proxy) [INFER].
- Fiat toggle and Max in the amount field [INFER from TW UI captures].

## Harbour architecture
Popup (Prepare/Confirm) -> background handlers `chainSend.ts` -> `core/chains/send/<family>.ts`. The background derives the active account's key per call from the unlocked session, signs with wallet-core AnySigner (or viem for EVM), broadcasts through public endpoints and zeroes the key. The popup never sees keys. All sent transactions are recorded under `wallet:sent:txs` for the detail screen.
