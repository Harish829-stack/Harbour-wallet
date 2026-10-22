# Custom token import, Send and Receive — spec and evidence

Source: `custom-token.har` + TW 26.41.0 bundle (`custom-asset` chunk, `App-D29UTaP5.js` for Send / Receive message ids).

## HAR findings
- [certain] Adding an unlisted token first asks TW's authenticated gateway (`gateway.us.trustwallet.com`, asset index lookup) and gets **404**.
- [certain] TW then falls back to on-chain `eth_call` for `name()`, `symbol()`, `decimals()`.
- [certain] Not used by Harbour and why: `/v1/assets`, `/v1/coinstatus`, `/v1/approvals/scan`, `/v1/txhub/bulk_history`, `/v2/market/tickers`
  all need a TW device credential. Calling them would be impersonating TW's client, so Harbour does not. Session tokens, device ids
  and hash keys in the HAR were not copied anywhere.

## TW flow (reproduced)
Select network -> Add custom token -> address field (trimmed, 200 ms debounced lookup) -> preview (name, symbol, decimals, type, network)
-> warning -> "Add token manually" (name, symbol, decimals 0-32; decimals read-only when auto-filled) -> Add token (disabled until valid).
Send pre-flight: estimated network fee, low-gas warning (`send.low-gas-warning`), smart-contract recipient risk
(`send.confirmation.risk.smart-contract`). [certain: message ids; wording is TW's CMS and is not in the bundle, so Harbour wording is its own]

## Harbour implementation
`core/erc20.ts` (probe, encode, amounts), `core/customTokens.ts` (model, per-wallet encrypted storage), `core/tokenPrice.ts`,
`core/sendService.ts` (estimate + transfer), `popup/wallet/tokenScreens.tsx`, token rows on Home / Search / Token detail / Send / Receive.

Deviations (honest):
- On-chain probe runs on **every supported EVM chain**; TW limits it to Ethereum + custom networks [likely].
- bytes32 `name`/`symbol` fallback (old tokens such as MKR); metadata is sanitised (control chars, length caps).
- Prices come from CoinGecko's public contract endpoint, not TW's ticker service; **unlisted tokens show no fiat value**.
- No token logos (TW loads them from its CDN).
- Token chart / history are not shown for custom tokens (no price series without TW's gateway).

## Verified / not verified
- Verified: 15 unit tests (`test/tokens.test.js`); Chromium E2E against a **mock JSON-RPC** server: probe, invalid address, add, balance,
  Home row, detail, Send (fee, Max, amount > balance, contract-recipient banner, review, broadcast), Receive, remove.
- NOT verified: live RPC endpoints (egress blocked in the build env); live CoinGecko response shape; fee-on-transfer / rebasing tokens;
  tokens with non-standard `transfer` return values; visual QA on the real device.
