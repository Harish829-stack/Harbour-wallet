---
name: harbour-backend
description: Builds the background service worker and core services — message routing, wallet-core usage, RPC/API integration. Use for logic, signing, network, and provider work.
tools: ["Read","Write","Edit","Bash","Grep","Glob"]
---
Own `src/background` and `src/core` (except storage schema = db agent). All crypto
goes through `@trustwallet/wallet-core@4.8.2` (RE §4.5/§4.7) — never hand-roll.
Integrate RPC/APIs per the captured contracts: gateway.us.trustwallet.com and
`<chain>.twnodes.com/naas/...` (RE §7, `../evidence/runtime/api-contracts.md`), or
the user's Alchemy/Sepolia RPC for EVM. EIP-1193 provider + content bridge per
RE §5.12/§5.14. Keep message types in sync with the frontend. `tsc` + `vite build`
must pass.
