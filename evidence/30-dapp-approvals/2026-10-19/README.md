# Phase 2 dApp approval evidence

This bundle records the REA recovery and network analysis used for Harbour's Phase 2 implementation.

The target route distinction is confirmed by recovered target chunks: `/notification` is the dApp request decision surface for connect, signing, typed data, transactions, and network changes; `/approval` is token allowance management. The recovered slices and manifests are under `recovery/`.

The supplied HAR is 53,464,733 bytes and exceeds REA's 32 MiB capture limit. `prepare-har.py` creates `network-projection.har` without headers, cookies, query values, session tokens, addresses, or bodies while retaining all 1,098 source ordinals and RPC method names. REA analyzed that final projection completely as Evidence `ev_551b146661f76ad4aeba38f5a5c3feb79f998e627d6b4c43e2cda4f46f188ce3` (derived historical-reference evidence; no live attribution).

Observed recorded network patterns include Sepolia JSON-RPC reads, `eth_estimateGas`, `eth_sendRawTransaction`, receipt polling, Trust gateway calls, and per-chain NaaS APIs. Network capture alone does not prove dApp-provider causality or WalletConnect behavior.
