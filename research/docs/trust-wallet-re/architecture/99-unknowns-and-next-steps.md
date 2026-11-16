# 99 - Unknowns and Next Steps

| # | Unknown | Doc | Suggested next step |
|---|---|---|---|
| 1 | Consumer of `keepAlive.js` | 02 | Trace message names in worker listeners |
| 2 | Passkey secret source | 03 | Trace `PasskeyService.retrievePassword` |
| 3 | Meaning of PBKDF2 length 512 | 03 | Inspect VaultService derive call |
| 4 | Inversify confirmation (DI is custom decorators `Use`, `Injectable`, `Module`) | 02 | Look for container class |
| 5 | WalletConnect relay / project id | 04 | Search for `relay.walletconnect` config |
| 6 | Approval popup UI strings | 04/06 | Mine popup chunk for approval components |
| 7 | UI exposure of perps and prediction markets | 06 | Check route gating by flags |
| 8 | Gateway API schemas, GraphQL endpoints | 07 | Capture traffic with HAR in repo or live run |
| 9 | `X-TW-*` signing algorithm | 07 | Decompile WalletKit HTTP interceptor |
| 10 | Node selection order, retry policy | 07 | Read `DefaultNodeRepository` |
| 11 | Walletkit per-chain tx building | 05 | Dynamic capture via REA browser scenario |
| 12 | Registry 168 vs UI 86 chains | 03/10 | Compare registry flags vs UI lists |
| 13 | `trust:store` persisted contents | 08 | Runtime inspection of storage |
| 14 | SQLite consumer and schema | 08 | Search WalletKit for SQL driver usage |
| 15 | `isInPopup` exact check | 09 | Read implementation |
| 16 | Sentry/Amplitude scrubbing | 09 | Inspect beforeSend and event properties |
| 17 | Amplitude API key location | 07 | Search runtime config assembly |

Dynamic analysis (loading the extension in Chrome via REA browser capture) would resolve most of #8-#13 and is the highest-value next step.
