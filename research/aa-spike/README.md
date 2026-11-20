# aa-spike (P0, throwaway)

Testnet spike for EIP-7702 smart accounts (MetaMask Stateless7702 + Pimlico). Not product code.

    node spike.mjs offline            # no network: re-checks builders against vectors.json
    node spike.mjs gen                # make test EOA, print address to fund (key kept in .state/, gitignored)
    node spike.mjs checks             # delegate code + entryPoint() on chain
    node spike.mjs upgrade            # self-sent type-4 (auth nonce = tx nonce + 1)
    node spike.mjs sponsor-probe      # pm_sponsorUserOperation with / without policy id
    node spike.mjs ops                # user-paid 1-call, sponsored 1-call, 2-call batch
    node spike.mjs revoke             # zero-address type-4
    node spike.mjs all                # checks, upgrade, probe, ops, revoke

Env: CHAIN=sepolia|baseSepolia (default sepolia), RPC_URL (optional override),
SPONSORSHIP_POLICY_ID (optional; sponsored steps and the "with policy" probe need it).
PIMLICO_API_KEY is read from apps/backend/.env and never printed. Results (no secrets): .state/report-<chain>.json

## dApp test pages

    python3 serve.py      # then open https://127.0.0.1:8443/dapp-full.html (or dapp-test.html), accept the cert warning once

HTTPS because Harbour injects window.ethereum on https pages only (http://127.0.0.1 only in local-backend builds).
serve.py serves just the three page files; nothing else in this folder (e.g. .state/) is reachable.

- `dapp-test.html`: quick safety check (window.ethereum only, no libraries).
- `dapp-full.html`: full walkthrough: account/7702 status, batch builder, free-transaction check, session-key lifecycle (grant, spend,
  break attempts, revoke check), the same negative checks. Testnets only. The session key stays in tab memory; reads and the key's own
  transactions go to the public RPC shown on the page, the free-tx lookup to Blockscout; every other fetch is blocked.
- `dapp-full.lib.js` is built from Harbour's own node_modules (same versions): `node build-dapp-full.mjs` (rebuild after any
  extension dependency change; it rewrites the SRI hash in dapp-full.html, so a stale or edited bundle will not load).
