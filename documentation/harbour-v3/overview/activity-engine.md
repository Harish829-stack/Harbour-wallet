# Harbour Activity engine (unified history)
Evidence: `evidences/re-evidence/41-activity-history/` (Trust Wallet 26.41.0). TW's history is a private server (`/v1/txhub/*`) that classifies transactions; Harbour reproduces the behaviour client-side from public data.

## Sources, merged per network (`src/core/activity/merge.ts`, priority high→low)
1. **Local ledger** — every EVM transaction this wallet broadcasts is captured at the single choke point `eth_sendRawTransaction` (`broadcastTap.ts`: decodes the signed tx with viem, recovers `from`). Shown instantly as *pending*, typed from calldata (approve / revoke / transfer), settled from the receipt by an alarm (`harbour:activity-pending`, 1 min). Replaced/expired transactions are dropped (nonce moved on, or 24 h).
2. **Log scanner** (`scanner.ts`) — `eth_getLogs` for ERC-20/721 `Transfer` in/out and `Approval`, on the chain's own RPC: works on any EVM chain (testnets, custom networks) with no explorer/API key. Persisted block interval `[lo,hi]` grows contiguously forward + backward; adaptive window (halves on node range limits); a window counts only after its receipts resolved (no silent gaps); last 12 blocks re-scanned each refresh (reorg safety).
3. **Explorer** (`txHistory.ts`, Blockscout / Routescan / Esplora / adapters) — native transfers and extra detail; non-EVM chains use only this.

## Typing (`classify.ts`)
approve / revoke (direct `approve()` call; allowance 0 ⇒ revoke; ≥2^255 ⇒ Unlimited; spend-events from `transferFrom` are NOT approvals), swap (I started the tx, value left me, a different fungible token came back), send / receive / self, mint (inbound from 0x0), contract (+ method label). Zero-value inbound transfers (address poisoning) are dropped.

## Limits / known gaps
- Incoming **native** transfers and internal transfers are invisible to logs; they come from the explorer where one exists (none for most testnets / custom networks).
- ERC-1155 and non-EVM chains have no log scan.
- Backfill depth is bounded (`maxBackfillWindows`, 60) and grows a few windows per open; mainnets with an explorer are covered deeper by it.
- Fixed in the same change: `txHistory` handler rejected every network id containing `-` (all testnets except Sepolia).
