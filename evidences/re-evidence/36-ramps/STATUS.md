# 36 Ramps status (Real / Partial / Gap)
Verification: `npx tsc --noEmit` clean (except unrelated ImportSecret), `npm test` all pass (mocked fetch). Nothing live-verified. No visual QA.

| Screen / flow | Status | Note |
|---|---|---|
| Fund menu (`fund`) | Real | Home Fund button now pushes `fund` |
| Buy flow (`buy`): amount, fiat, crypto, network, provider, method | Real (live-unverified) | quotes need provider keys; Ramp is key-less |
| Sell (`sell`) | Real (live-unverified) | balance check, percent slider |
| Fiat ramps tabs (`fiatRamps`) | Real | Buy/Sell tabs |
| Provider quotes | Partial | Banxa widget-only; others need keys |
| Recurring buy | Partial | Mercuryo first buy + .ics reminder |
| Buy with P2P | Real | Binance P2P new tab |
| Deposit from exchange (providers, platform, assets, QR) | Real / Partial | public asset lists, registry fallback labelled |
| Ramp API keys | Real | local only, masked |
| CSVC verification code | Gap | |
| Provider min/max limits | Gap | |
