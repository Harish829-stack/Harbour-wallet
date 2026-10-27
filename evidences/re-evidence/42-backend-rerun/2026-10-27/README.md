# Backend and database re-run (REA 6.5.0), 2026-10-27

Fresh REA pass on Trust Wallet extension 26.41.0 that does not rely on earlier docs.

## REA runs
| Run | Tool | Input | Evidence id |
| --- | --- | --- | --- |
| Runtime API capture | inspect-web-network-capture (CLI, Linux VM) | inputs/login-onboard-addnewwallet.sanitized.har | ev_c8051aa45a2532d9a30a1fe849363f147fc506b42604365ab6ee61eb428e897a |
| | | inputs/native-send.sanitized.har | ev_88e5da0ce37b8cb19f72977ab0b1a9d0d58d1b11f3247b9ab040a1a100ed4fcd |
| | | inputs/base-flow.sanitized.har | ev_e58a039bf636a5835738eafaca956ae63cc6107e87c014a9be8d67ffc61313f3 |
| | | inputs/add-cutom-network.sanitized.har | ev_687fb921ea94a8a75fd9e9a01e85e41a5faf0d75fff42001f2dc2746066dafcb |
| | | inputs/custom-token.sanitized.har | ev_a9da7fc4acf0abb21f39e7fbe0e3822aad2f5a440692dec30b557491d4472ae7 |
| | | inputs/auto-switch-network.sanitized.har | ev_e4b0a9e350b336b35c4a2235c014cfec4afa4494a85a831b88267c45aabd9b92 |
| | | inputs/lock-unlock-biometric.sanitized.har | ev_edd022f889a16edddb3b097088ff6eba1db7cbea8e2e42da5f962117719c008b |
| | | inputs/Trust_wallet.sanitized.har | ev_b4d14f2438ab8201438e4c7618bb79f590d4b0e3397baec13aa796e45e8a352b |
| API surface | inspect-analysis-view kind api-surface | surface/*.backend.har (bodies, _initiator and Sentry removed) | api-surface-*.json; merged in api-surface-merged.txt |
| SQLite engine | inspect_wasm_artifact (MCP, macOS, WABT 1.0.42) | reference-26.41.0/sql-wasm.wasm | ev_1a32f910cd641e49ac474c9cd2bf0953b67623e6ba23d322a12ff584adf427ee |
| JS application graph | analyze-javascript-application | content.js, keepAlive.js, chunks/store-cAVdfWrK.js | ev_f64ab17334ad0d69b5852f3ffaef0fc0b0da54d10b13b509f012567fffbca723 |

## Derivations
- sanitized: 27 entries with empty or invalid serverIPAddress had the field removed (REA HAR schema requires a valid IP). Nothing else changed.
- surface: response bodies, request bodies, _initiator stacks and Sentry requests removed so the api-surface projection fits its 96 MiB budget. Grouping only reads method, origin and path.

## Not completed
- analyze-javascript-application on background.js (42.7 MB): exceeds the 60 s device bridge wait and the VM's per-call process lifetime. Background facts (storage keys, DDL, slices, services, events) come from a direct static scan of the shipped file, SHA-256 a6dc88b6583df8488ba549ed7228a8a0d47db0488c0484078cef1f34b6b49d44.
- E2E-network-log-trust-wallet.har (53 MB) and network-log.har (151 MB): above REA's 32 MiB capture input limit; not used.

## Network log deep dive (same day)
Direct Python parsing (network-deep-dive/har_lib.py) of the 8 captures above plus E2E-network-log-trust-wallet.har (1,098 entries) and the complete prefix of network-log.har (3,467 entries, 2.8 h, file truncated at byte 151,289,122 of 151,300,000).
Findings recorded in the "Network logs" sections of the redesign doc: polling cadence, headers, device credential behaviour, payload shapes, node fleet methods, send flows, realtime frames, errors and latency.
No captured values (addresses, tokens, device ids) were copied into the doc; only field names, counts and timings.
