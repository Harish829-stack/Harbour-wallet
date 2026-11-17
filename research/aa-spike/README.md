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
