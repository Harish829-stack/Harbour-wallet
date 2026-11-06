# #16 WalletConnect — BLOCKED (compiled-language boundary)
WalletConnect is implemented via a Kotlin/JS-compiled WalletConnectService
(WalletConnect/reown kotlin-multiplatform SDK). Static JS recovery cannot produce
clean source for Kotlin-compiled code. Decision established: TW uses the WC Kotlin
SDK with a `WalletConnectService` request router. To build: use the WalletConnect
SDK directly. See trust-wallet-RE.md §5.16.

## 2026-10-19 addendum — correction and re-investigation (scripted string search, NOT an REA run)
**Method/limits:** `python3` regex search over `artifacts/reference-26.41.0/{background.js, chunks/*.js, inpage.js}` (REA's 42 MB analysis OOMs per AGENTS.md; REA `search_strings` needs a binary session, not applicable to JS). A failed search does not prove absence.
**Findings (CODE-CONFIRMED for what is present; absence = scope-limited):**
- Present: Trust Wallet's own Kotlin SDK plugin `com.trustwallet.kit.plugin.walletconnect` inside the wallet-kit bundle (`background.js` ≈ offsets 14,045,000–14,064,000; slice saved as `wc-request-mapper-slice.js`): `WcJsonRpcRequest{id,method,params,jsonrpc}`, `WcMethod` enum (ETH sign/typed/sendTransaction, `solana_signMessage`, `solana_signTransaction`, `cosmos_signDirect`, `cosmos_signAmino`), `WcOperation` {Message, PersonalMessage, TypeMessage, Transaction}, `WalletConnectEthereum/Solana/CosmosMapper`, `WcRequestDispatcher`, `WcService`, `JsWalletConnectService.handleRequest`. It converts a WalletConnect JSON-RPC request into wallet-kit sign requests. A `Source.WalletConnect` ("walletConnect") label exists in the swap/tx source enum.
- Not found anywhere in the shipped JS: `wc:` URI handling, pairing, relay URL (`relay.walletconnect`), `session_proposal`/`session_request`/`approveSession`, `@reown`/`@walletconnect` strings, `verify.walletconnect`, any WalletConnect screen text in UI chunks or `_locales/en`. `handleRequest(` has no call site outside the Kotlin class. The only other "WalletConnect" hits are the `WalletConnectedOnOrigin` bridge event and `HardwareWalletConnectionHint`.
- **Conclusion [likely]:** v26.41.0 has no user-reachable WalletConnect pairing/session feature; the earlier "BLOCKED: implemented via Kotlin/JS WalletConnectService" statement overstated it (the Kotlin class is a request mapper, not a transport). Whether it is reachable behind a flag is UNKNOWN.
- **Build decision:** Harbour's WalletConnect v2 is a *public-equivalent*, not a recovered Trust Wallet design: `@reown/walletkit@1.6.0` + `@walletconnect/core@2.25.0` in the service worker; method set and the request→provider mapping mirror `WcMethod` where Harbour has an equivalent (EVM sign/typed/send; Solana signMessage/signTransaction). Cosmos methods are not implemented. See `harbour-wallet-v2/BUILD-LOG.md`.
