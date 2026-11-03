# Harbour Wallet v3 — Current Project Status

Updated: 2026-11-03

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
  `origin/harbour-v3`; the 2026-11-03 work is pushed (HEAD `d63e439`).
  `harbour-wallet-v3/` also contains a stray local-only `.git` with no remote;
  commit from the repository root.
- TypeScript: `npm exec tsc -- --noEmit` passes.
- Lint: `npx eslint . --max-warnings 0` passes (2026-11-03).
- Tests: the testnet DeFi suites (`testnet-defi`, `testnet-defi-handlers`,
  `aavekit`) pass (20). The full `npm test` has not been re-run on macOS since
  `@uniswap/sdk-core` was removed; run `npm install` first. The last full run
  (2026-11-02) had 497 results: 496 passed and 1 failed only because the
  sandbox refused its localhost listener (`provider.test.js`).
- Backend: `go vet` and `go test ./internal/api` pass on go1.26.10.
- Live RPC/provider, deployed-backend, Chrome visual, and Ledger hardware
  verification are still incomplete.

## Testnet Swap and Earn (2026-11-03)

- Swap on Ethereum Sepolia uses the Uniswap Trading API through the backend
  gateway (`UNISWAP_API_KEY`; that route accepts only chain 11155111). Approvals
  cover only the exact input amount. Quotes outside the user's slippage, or
  with an unexpected ETH value or target, are rejected before review. Open:
  the swap recipient is not decoded, because the proxy's calldata format is
  not public; the slippage and value checks plus simulation before signing
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
