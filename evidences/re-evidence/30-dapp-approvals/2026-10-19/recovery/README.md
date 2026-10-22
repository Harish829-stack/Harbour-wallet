# 2026-10-19 — Phase 2 notification/approval evidence

Status: CODE-CONFIRMED static recovery; no reference wallet execution in this pass. Later lifecycle evidence remains provisional: this recovery does not close chronological research gate #02 or subsequent gates.

## Reproduction and provenance

REA CLI 6.5.0 and Wakaru 1.14.0; pinned Linux Docker image `sha256:8b8694b18f00e42c6bdf2a26eda3daad9c0ea2ee17c3f98464e0624438152403`, network disabled, all capabilities dropped, no-new-privileges. Tool executable SHA-256 and recovery options are in each `*-recovered/manifest.json`. Every input is retained with the corresponding recovered source, source map, provenance and raw REA record. `source-ranges.json` records original full-file hashes and exact zero-based, end-exclusive UTF-8 byte ranges. Declaration wrappers and final separators are recorded explicitly; all four carved inputs passed `node --check` before recovery. REA may render JSX in recovered modules; these are analysis outputs, not executable app replacements.

Initial Docker socket access was sandbox-denied. An approved rerun against the same pinned offline image succeeded. No packages/tools were upgraded, no recorded URLs fetched, no keys/passwords/tokens inspected or retained.

Repeat each recovery, with a new absent output directory:

```sh
docker run --rm --platform linux/amd64 --network none --cap-drop ALL --security-opt no-new-privileges --mount type=bind,source=/Users/jatinsharma/Desktop/REA/evidence/30-dapp-approvals/2026-10-19/recovery,target=/output sha256:8b8694b18f00e42c6bdf2a26eda3daad9c0ea2ee17c3f98464e0624438152403 recover-javascript-sources /output/background-popup.js /output/background-repeat --format json
```

## Evidence registry

- `background-rea.json`: `ev_f5dfc9207dba8d877cd37897d1caf721984790975b98b345cc5a37c62a6e19e7`.
- `allowance-rea.json`: `ev_9c61f5bd048b6d307a83087601c952b683cecb5e398c218829de930a44f67c03`.
- `connect-rea.json`: `ev_bbddd2ee7e5819d3c128cc7ae7744acab6880c5fc0d8c51713324b69b5e2c8f1`.
- `notification-rea.json`: `ev_fdece6977f9690af130733871117fb2af4e6b9c79d0b32c37b00ebe78d961242`.
- `connections-rea.json`: `ev_a30da1e36bbccdac044dbdca00478dba7dcc01f0f8044a6e974951adade633cf`.

## Conclusions and implementation implications

- [certain] `/notification` is the dApp request surface. The retained 488-byte `notification-C0DFw0BI.js` imports App module export `n`; the original App footer exports App$6 as `n`. `notification-recovered/modules/bundle.js:321-372` is App$6: notification queue, pagination, per-request crash boundary, and tab navigation invalidation. The top-level route wiring was observed in original App source at UTF-8 byte offsets near 2135k; route slice was not fed to REA in this bounded pass. Therefore this bridge-to-export correspondence is target source checked, not an independently recovered route graph.
- [certain] `/approval` is the token allowance detail/revocation screen, not the connect/sign popup. `allowance-recovered/modules/bundle.js:40-172` consumes router state assetId/spenderAddress/spenderName/chain/allowance/isUnlimited/risk data/walletAddress and stages revoke-approval transaction data. No popup-request queue in that chunk. A Harbour dApp approval alias may be useful, but must be documented as a routing deviation, not claimed target parity.
- [certain] Background `background-recovered/modules/bundle.js:139-240`: ID derives from base64(origin + underscore + method); same origin/method pending request focuses an existing window then rejects resource-unavailable. Exact origin blacklist rejects; notification queue stores id/method/sender/params/window. Existing notification window and side-panel context may be reused; otherwise a new popup is created. Completion cleans up listeners and closes the window only when no requests remain and keepWindowOpen is false.
- [certain] `background-recovered/modules/bundle.js:83-92,205-219`: confirm/cancel messages are accepted only from extension UI (`sender.id === runtime.id` and sender.url starts with runtime extension URL). Message names are `INTERNAL_notificationConfirm_<id>` and `INTERNAL_notificationCancel_<id>`. Confirm unwraps the first value of non-empty plain object params; cancel rejects supplied error. The notification is removed separately by UI. Window closure rejects userRejectedRequest and removes notification; abandon does likewise (221-239).
- [certain] Background lines 241-318: missing remotePort sender is unauthorized; page-supplied `isInternal`, `source`, and transaction `asset` hints are stripped before deciding authorization (helpers lines 102-137). Uninitialized wallet opens onboarding and rejects. Locked wallet first opens an unlock notification, then reuses that window for the original request. Lines 320-370 build `popup.html?notification=1#/notification`, 375x600, with a fallback placement attempt.
- [certain] UI `notification-recovered/modules/bundle.js:33-89,190-311`: write requests check requested EVM web3ChainId against selected chain, block non-allowed embedded frames, reject unconnected external origins, and offer wallet switch when connection account differs. Connect and wallet permission requests map to ConnectWallet; personal/typed messages to SignMessage; send/sign transactions to network-specific transaction views. The allowlisted embedded-frame exceptions are target-specific and not a recommended Harbour bypass policy.
- [certain] Connect `connect-recovered/modules/bundle.js:9-144`: site metadata comes from sender tab; connection payload includes origin/icon/title/addresses/selectedWalletId/networkId/chainId/accountId. It emits ADD_CONNECTED_SITE before confirm, adds an Ethereum connection for Binance requests, then confirms after 500ms with address. Existing allowed ETH account requests skip repeated approval. Risk service may require additional confirmation, and unavailable checks display a warning. Blacklisting dispatches local blacklist state, disconnects prior connection, then cancels.
- [certain] `connections-recovered/modules/bundle.js` implements connection detail, list, blacklist. Detail shows wallet/account/address/first-connected date; can switch active wallet/account and revoke dApp access. List disconnect-all uses DISCONNECT_ALL; blacklist removal dispatches removeBlacklistedSite. Original nested settings paths are `/connections`, `/connections-blacklist`, `/connection/:id` under `/settings/*`. These three screens are recovered; state/controller storage internals remain outside this bounded pass.

## Limits / exact remaining gaps

UNKNOWN: dynamic browser execution of these flows in this pass; network risk service internals; restart persistence of pending target approval promises; complete dApp connection store/controller schema; WalletConnect pairing/proposal runtime; chain-specific send/sign details beyond the UI dispatch recovered here. This evidence does not prove live RPC or authenticated gateway availability. No HAR credentials or captured device identifiers were used. Bridge and EIP-1193 request/response specifics continue to use pre-existing evidence/12-dapp-provider and evidence/14-bridge. The workspace has no evidence/13 directory; do not cite one as recovered evidence.

Build readiness: Partial as a full equivalent-wallet specification; sufficient within this bounded pass for queue/window lifecycle, trusted confirmation boundary, connect metadata, routing distinction, and connection management behaviors. Acceptance requires independently exercising allow/reject/window-close/tab-change/locked-wallet/duplicate-request branches in isolated Chrome and verifying local signer contracts separately.
