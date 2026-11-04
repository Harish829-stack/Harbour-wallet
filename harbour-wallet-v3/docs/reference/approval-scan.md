# Token approvals scan (Settings > Security > Token approvals)

Status 2026-11-04. Scans **Ethereum Sepolia and Base Sepolia only**. Any other network is refused with
"Approval scanning isn't available on this network." (`pickScanChains`, code `unsupported_network`); the screen also says so.

## What it does today

An ERC-20 allowance is keyed by token **and** spender, so a node cannot be asked "which spenders did this address approve".
The scan therefore reads `allowance(owner, spender)` on chain for pairs Harbour knows about, in batched Multicall3 calls
(about 100 reads per RPC request, 800 pairs at most per network), and lists only pairs whose live allowance is above zero.

Candidate pairs:

1. **Added tokens x known spenders.** Tokens: the active wallet's added tokens on that chain, the network's Aave reserves
   (one `getAllReservesTokens` read) and the Uniswap base tokens (Sepolia). Spenders: Aave V3 Pool, Aave WETH Gateway (Base Sepolia),
   Uniswap router, legacy router and Universal Router (Sepolia), and Permit2 (revoking `approve(Permit2, 0)` also cuts everything
   nested under it).
2. **The approval ledger.** Every `approve` the wallet signs is recorded: Swap and Earn (`source: 'swap' | 'earn'`, written by
   `defiSubmit` after the approve is mined) and connected sites (`ProviderService`, as before). Ledger pairs are scanned even
   when the token was never added, which is how an approval to an unknown spender for an unadded token is found.
3. **On-chain truth.** Nothing is shown from a record alone: every candidate is read from the chain. A ledger entry whose allowance
   is now zero is forgotten. Revoke re-reads the allowance first and sends nothing if it is already zero.

The screen never says only "No active approvals found": it states how many tokens were checked against how many contracts,
how many could not be read (a token whose `allowance()` reverts), and that approvals to other contracts for tokens you have not
added are not listed.

Code: `src/core/approvalScan.ts` (scan, coverage text, chain selection), `src/background/handlers/approvals.ts` (candidates,
revoke), `src/core/approvals.ts` (`APPROVAL_CHAINS`; the GoPlus mainnet scan is kept as `GOPLUS_CHAINS`, switched off).
Tests: `test/approval-scan.test.js`, ledger assertions in `test/testnet-defi-handlers.test.js`.

## RPC cost

All reads go to the Harbour API (`/v1/rpc`, device-signed), never to a user-supplied RPC and never to a third party. A scan costs
about 2 to 4 `eth_call`s per network (allowances, reserves list, metadata for hits). The gateway caches `latest` reads for about
a block. Well below the per-device limits in `backend/config/api.yaml` (600 rpc/min, 200 on probation).

## Not covered (known limits)

- Approvals to a spender Harbour does not know, for a token that was never added and never approved from this wallet. Needs step 4.
- Off-chain signatures (Permit, Permit2 `permit`): nothing exists on chain until a spender uses them; no scanner can list them.
- Permit2's nested allowances to individual routers (revoke the Permit2 approval instead).
- NFT `setApprovalForAll` approvals.
- Tokens whose `allowance()` reverts (counted as "could not be read").
- Hardware wallets can scan, but Revoke is not available for them.

## Step 4, deferred: "Deep scan" by event logs (NOT implemented, opted out)

Goal: find approvals to unknown spenders for tokens the wallet has never seen, by querying `Approval(owner, spender, value)`
events with the owner in `topics[1]` and no token filter, then confirming each hit on chain (an old event can be stale).

Why it is deferred: `eth_getLogs` is the one method that can use up the RPC quota.

- `/v1/rpc` caps `eth_getLogs` at 2,000 blocks and needs an address or topic filter (`logs_max_range` in `backend/config/chains.yaml`).
  Base Sepolia makes a block every 2 s (about 43,000 blocks a day, about 22 queries a day of history, about 650 for 30 days);
  Sepolia makes one every 12 s (about 4 a day).
- It is also the most expensive call per request at providers like Alchemy (roughly 60 compute units against about 26 for
  `eth_call`; check current pricing). A 30-day first scan on Base Sepolia is on the order of 40k units per user. A burst of 650
  calls would also hit the 200 rpc/min probation limit.

Design to implement later:

1. Make it an explicit **Deep scan** button, never part of opening the tab.
2. Check first whether the Etherscan V2 route in the backend gateway (`/v1/gw`, the backend's key) covers Base Sepolia on the
   current free tier (one `getLogs` call for any block range, topic filter on the owner). If yes, use it for history. Not yet checked.
3. Otherwise page the RPC: at most 7 days per run, one query at a time about a second apart (no bursts), and store the last
   scanned block per owner and network so the next run only fetches new blocks (a few calls a day).
4. Cache results for a few minutes; charge it against a per-device daily budget like the existing backfill budget.
5. Feed discovered (token, spender) pairs into the same on-chain confirmation step and the approval ledger.
6. Show the scanned block range ("scanned the last N days") in the coverage text.

Privacy: an owner-topic query tells the backend which address is asked about; the backend already tracks the device's addresses.
