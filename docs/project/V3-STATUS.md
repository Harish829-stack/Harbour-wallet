# Harbour Wallet v3 — Current Project Status

Updated: 2026-11-04

This is the current status document for the implementation on branch
`harbour-v3`. The older reverse-engineering and Harbour-v2 documents remain
valuable evidence and history, but their implementation counts and next-step
claims are not current for v3.

## Source of truth

- Implementation: `harbour-wallet-v3/`
- Backend deployment/runtime design: `harbour-wallet-v3/backend/README.md` and
  `harbour-wallet-v3/backend/deploy/`
- Security status: `harbour-wallet-v3/audit/summary.md`, `findings.md`, and
  `fixes.md`
- Historical Trust Wallet research: `docs/re/`,
  `docs/trust-wallet-architecture/`, and `docs/project/rebuild-tracker.md`

## Verified local state

- Branch: `harbour-v3` in the `REA` repository root, tracking
  `origin/harbour-v3`; the 2026-11-03 work is pushed (`d63e439`); the 2026-11-04 security and Swap commits (`89a93c1` through `0c6bdd1`) are local and not pushed.
  `harbour-wallet-v3/` also contains a stray local-only `.git` with no remote;
  commit from the repository root.
- TypeScript: `npm exec tsc -- --noEmit` passes.
- Lint: `npx eslint . --max-warnings 0` passes (2026-11-03).
- Tests: full `npm test` passes 558/558 on `931a0ad` (2026-11-04, Linux, node 22,
  clean `npm ci`; `chains.test.js` needs an `evidences/` folder beside the repo).
  Not re-run on macOS. `tsc --noEmit` is clean at the same commit.
- Backend: `go vet` and `go test ./internal/api` pass on go1.26.10.
- Live RPC/provider, deployed-backend, Chrome visual, and Ledger hardware
  verification are still incomplete.

## Security rounds (2026-11-03 and 2026-11-04)

Three attacker-style rounds on the extension, all closed with tests; each has
its own record in `harbour-wallet-v3/docs/reference/`.

- **Pentest PT-01..PT-12** (`security-pentest-2026-11-03-fixes.md`; commits
  `127797a`, `30ab742`, record `678375f`): biometric enrolment needs the
  password and a platform authenticator; the spending-cap edit now reaches the
  signer (MetaMask-style cap); module-level unlock queue; `manage` re-auth for
  destructive or weakening actions; WalletConnect permissions kept apart from
  the real site's; chain switch only on approve; 800 ms approve arming delay;
  top-origin phishing check; vault and keystores in IndexedDB; Trusted Types
  CSP; private-key wallets sign for dApps.
- **Seed typing and reveal** (`security-pentest-2026-11-04-seed-typing.md`,
  `0c5511a`): QR stage 5 min and destroyed after 5 wrong codes, masked inputs,
  local BIP39 word check, re-mask on blur, idle wipe, clipboard clear and
  warning, press-and-hold (1.2 s) reveal. No extension can stop screenshots or
  keyloggers; QR or Ledger import is the real defence.
- **Attacker review A1-A9** (below).
- **Token approvals scan** (2026-11-04, `harbour-wallet-v3/docs/reference/approval-scan.md`): Sepolia and Base
  Sepolia only, other networks say "Approval scanning isn't available on this network."; allowances are read on
  chain (through `/v1/rpc`) for added tokens x known spenders plus a ledger of approvals this wallet signed (Swap,
  Earn, sites); the screen states what was checked. Log-based "Deep scan" is deferred and documented there.
- Not tested here: real Touch ID or Windows Hello hardware; the Go backend
  tests for the latest gateway commits were run by the other session in docker.

## Attacker review fixes (2026-11-04)

An outside-attacker code review found nine items (A1-A9). Eight are closed in
code with tests; A7 was a false positive (the pending-request binding in
`needConn` already refuses a stale chain switch, so only a regression test was
added). A9 (release/config/Firebase keys sitting in the REA folder) is a manual
action and is still open. Full detail: `harbour-wallet-v3/docs/reference/security-attack-review-2026-11-04.md`.

- A1/A2 backend gateway: strict JSON-RPC parse, forward only the validated
  body, no raw broadcast, bounded `eth_getLogs` (`bf56077`).
- A3 approval screen: `eth_simulateV1` allowed on `/v1/rpc`; `unknownCall`,
  `simulationUnavailable` and `blindCall` warnings (`931a0ad`). **Restart the API
  container so it loads `config/api.yaml`.**
- A4 `chrome.storage.local` pinned to trusted contexts (verified in Chromium 153).
- A5 QR scrypt memory and work caps. A6 `noChainId` typed-data warning.
  A8 re-auth to unblock a site (`931a0ad`).
- Go tests ran in a `golang:1.26.10-alpine` container against the compose
  Postgres and Redis (`go vet`, `go build ./...`, `internal/api` pass); extension
  tests ran in `node:22-alpine` (`tsc` clean, suite passes except
  `chains.test.js`, which needs a file outside the repo).
- The same changes also exist as commits in the stray nested repo inside
  `harbour-wallet-v3/` (`0c1d006`, `b2b9770`, `b2dbc94`, `7724fc8`). That repo
  has no remote; the REA root repository is the source of truth.

## Testnet Swap and Earn (2026-11-03)

- Swap on Ethereum Sepolia uses the Uniswap Trading API through the backend
  gateway (`UNISWAP_API_KEY`; that route accepts only chain 11155111). Approvals
  cover only the exact input amount. Quotes outside the user's slippage, or
  with an unexpected ETH value or target, are rejected before review. Native-ETH
  input goes straight to the Universal Router and its calldata is verified by
  `checkUniversalRouterSwap` before review (`89a93c1`; fixes "Uniswap returned
  an invalid or unexpected transaction"); token input keeps the no-Permit2
  proxy. Open: on the proxy path the swap recipient is not decoded, because the
  proxy's calldata format is not public; the slippage and value checks plus simulation before signing
  limit the risk.
- Earn on Base Sepolia uses AaveKit (`api.v3.aave.com`), including native ETH
  through the WETH gateway. Every returned transaction is decoded and checked
  before review, reserve state and balances are read on-chain, and ERC-20
  reserves fall back to direct contract calls when AaveKit is unavailable.
  Open: native ETH withdraw has not been run live; the user's address is sent
  to Aave's API (relates to the V3-10 privacy opt-in).
- Details: `harbour-wallet-v3/src/integrations/testnet-defi/README.md` and the
  developer guide's "Testnet Swap and Earn" section.

## Wallet UI pass (2026-11-03)

Committed in `d63e439` (wallet popup only; no handler, provider or signing logic
changed). Details: `docs/re/DESIGN-SYSTEM.md` and `docs/re/UI-PARITY.md`.

- Shared layout: 16px gutters matching the header, one section-label, note and
  card style, primary actions pinned in the screen footer on form and
  confirmation screens, one sticky `SearchBox`, one tab-page title row.
- Swap/Earn testnet selectors are anchored dropdowns, not bottom sheets.
- Focus: inputs get a border + soft ring; borderless inputs inside a framed box
  (search, amount, address rows) pass the glow to the box edge.
- Navigation: no backdrop blur on headers, `overflow: clip` on stack layers,
  deferred autofocus and progressive long lists so pushed screens slide cleanly.
- Verified: `tsc`, eslint on changed files, mock-transport renders of ~90
  screens at 380×600 and frame captures of the Networks/Search/Settings pushes.
  Not verified: a live, unlocked extension in Chrome, and ~15 screens the mock
  cannot render (Buy/Sell, staking amount, Perps, Predictions market, NFT item).
  Full `npm test` in a Linux copy: 509 results, 506 passed; the 3 failures need
  files that copy did not include (evidence JSON, gateway sources), not UI code.

## Remaining implementation scope

The v3 code intentionally reports unsupported paths rather than faking support.
The remaining gaps include several chain-specific send paths (currently ICP,
FIO, Nimiq, Aion, and Ontology), some non-EVM token coverage, inscriptions and
bridge flows, and hardware-wallet validation. Feature flags and provider keys
also need production configuration before those areas can be exercised.

## Release readiness

The code remediation pass is substantially complete, but release sign-off is
not complete. Postgres now requires TLS for all TCP connections (`df50ed6`).
The security handoff still requires secret rotation, moving the release key out
of the repository, CI/branch protection, inter-service TLS, cleanup of
captured-token artifacts, and independent/live validation. The DevTools network
capture `harbour-wallet-v3/3novlog.3novlog` (session, device and signature
headers) was removed from the tree in `3725814`, but it remains in history from
`58de5f4`, which is on `origin`. Rewrite history and revoke those sessions. See `harbour-wallet-v3/audit/fixes.md` for the exact hand steps.

## Immediate next actions

1. Remove `3novlog.3novlog` from git history and revoke the captured
   sessions, then push `harbour-v3`.
2. Run `npm install`, the full `npm test` (make the localhost-dependent test
   use an in-process server), `npm run verify`, and a production build.
3. Complete the security handoff steps and re-run the audit gates.
4. Deploy the backend dependencies and services in a staging environment.
5. Run live RPC, Chrome, provider, and Ledger checks before a release candidate.
