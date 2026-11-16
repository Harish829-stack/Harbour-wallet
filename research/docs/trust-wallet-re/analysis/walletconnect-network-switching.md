# WalletConnect network switching — research (2026-10-22)

Question: after a dApp connects (esp. via WalletConnect), why can't the network be changed, and what do Trust Wallet / MetaMask do?

## Evidence: Trust Wallet extension 26.41.0 (injected provider; it ships no WC client, only a request mapper)
- Network is **global**: `setSelectedBlockchain`; a dApp uses whatever the wallet has selected.
- `wallet_switchEthereumChain` (`SwitchNetwork.handle`, background.js): bad id -> 4902; same chain -> no-op but re-broadcasts `CHAIN_CHANGED`; connected site -> **no popup**, `applyChainSwitch` (select chain, broadcast `CHAIN_CHANGED` to tabs, toast "Chain switched to {name}"); unconnected site -> approval popup first.
- `autoSwitchDappChain` runs before send/sign when a connected site's request carries a `web3ChainId` different from the selected chain -> auto-switch.
- User switching network in the wallet UI (`SWITCH_BLOCKCHAIN` -> `applyBlockchainSwitch`) also broadcasts `CHAIN_CHANGED` to connected tabs.
- No per-site network control found in the Connection screen data (`connectedDapps` holds chainId per site, but switching is via the global selector).

## Evidence: WalletConnect v2 (specs + Reown docs + universal-provider source)
- A session is bound to the chains granted at approval (CAIP-2). Every `session_request` carries a `chainId`; wallets must reject chains not in the session.
- No wallet "current network" exists in the protocol. The dApp keeps its own default chain.
- Wallet can extend a session with `walletKit.updateSession({topic, namespaces})` (append-only, must include existing + new; dApp gets `session_update`).
- Wallet tells the dApp about a switch with `walletKit.emitSessionEvent({topic, event:{name:'chainChanged', data:<id>}, chainId:'eip155:<id>'})`. Switching to a chain not in the session requires `updateSession` first.
- dApp side (`universal-provider` eip155.ts): `wallet_switchEthereumChain` -> if chain already in session, switches **locally** with no wallet call; else forwards the request to the wallet, then `setDefaultChain`. If neither works it throws.

## Harbour gaps (src, as of this date)
1. `emit()` (background/provider/index.ts) only reaches injected content-script ports. WC sessions use synthetic tab -1, so `chainChanged`/`accountsChanged` never reach a WC dApp. `KitLike` has no `updateSession` or `emitSessionEvent`.
2. `negotiate` grants only the chains the dApp asked for, and `mapRequest` rejects any other chain. An approved `wallet_switchEthereumChain` to another chain updates Harbour's connection record but the session never gains the chain, so later requests fail with "not approved for this session".
3. WC approval screen sends `networks: []` (view.ts), so there is no network picker on connect; chain = first required chain.
4. Connection detail shows "Network" read-only; no way to change it.
5. `bridge.onRequest` already follows the dApp's request chain (like TW `autoSwitchDappChain`) — keep.

## Plan
- KitLike: add `updateSession`, `emitSessionEvent`; bridge `emitToSessions(origin, name, data)`; route ProviderService `emit` to WC sessions for that origin too.
- On `switchChain` / `addChain` / connection network change for a WC origin: if chain not in session, `updateSession` (append chain + accounts) then `emitSessionEvent chainChanged`.
- Connection detail: network picker (limited to Harbour networks) that updates the connection and emits `chainChanged` (injected + WC).
- Optional: WC proposal screen shows the requested networks and lets user pick the initial one.
- Unverified: live relay behaviour (no project ID tested); how Trust/MetaMask *mobile* handle WC proposals.

---
# Addendum: injected-provider connect and auto-switch (Aave v3 / faucet scenario), 2026-10-22
Evidence: TW 26.41.0 `background.js` and `chunks/App-D29UTaP5.js` (extracted from 26.41.0_0.zip). REA `analyze_javascript_application` on the folder timed out on the device (60 s), so findings come from reading the extracted bundle directly.

## Trust Wallet behaviour (CONFIRMED in bundle)
1. Connect popup (`connect-wallet.title`) shows only WalletSelect, the address and three permission cards. **No network selector.**
2. The connection stores `chainId`/`networkId` from the request (`ADD_CONNECTED_SITE`); the dApp's chain is the wallet's **global** selected blockchain.
3. `wallet_switchEthereumChain` (`SwitchNetwork`): unknown id -> 4902; connected site -> **silent** `applyChainSwitch` (+ toast, `CHAIN_CHANGED` broadcast); only unconnected sites get a popup.
4. `wallet_addEthereumChain` (`WalletAddEthereumChain`): if the chain is already known, it **rewinds into the switch handler** (switches, returns null). Only unknown chains show the add popup (then switch).
5. `autoSwitchDappChain` is called **before** sendTransaction / signTypedData chain checks: connected site + request `web3ChainId` != selected -> auto-switch. The "different network than selected" error (`dapp.chainid-mismatch`) is only a fallback.
6. `getDappBlockchains` = built-in dApp-compatible chains + custom chains (testnets are in this set; 26.41.0 has no testnet-mode flag, `migrateTestnets` removes `areTestnetsEnabled`). Faucets screen is just external links.

## Harbour gaps (service.ts / provider.tsx)
A. Connect approval shows a network `<select>` defaulting to the connection's chain or Ethereum (DEFAULT_CHAIN=1). `eth_chainId` before connect is always 1.
B. `switchChain` for a connected site always queues an approval popup (TW: silent).
C. `addChain` for a known chain returns null with **no switch** (comment says "site must call switch"). Faucets/dApps that only call `wallet_addEthereumChain` never switch. TW rewinds to switch.
D. `tx` / `typed` with a mismatched chainId throw INVALID_PARAMS; TW auto-switches first.
E. Connection detail network is read-only (WC gaps 1-4 above still apply).
Base Sepolia (84532) was not found in src chain registry via grep; check `evmChains()` — an unknown id returns 4902.

## Fix plan (injected provider)
1. Remove the network picker from the EVM connect approval; connection chain = current connection chain else default; keep account select.
2. `switchChain`: connected site -> switch immediately (update perms, emit chainChanged/networkChanged), no popup; unconnected -> existing approval.
3. `addChain` known chain: treat as switch (same path as 2).
4. `tx`/`typed`/`sign` with chainId != connection chain and site connected: auto-switch (emit events) then continue, as TW; keep error only if chain unknown.
5. Connection detail: add network picker (also covers WalletConnect once emit/updateSession exist).
6. Unverified: MetaMask exact prompts (docs fetched did not describe switch-after-add); live behaviour of Aave's own switch logic.

## Implemented (branch feat/dapp-auto-switch-network)
- Silent switch for connected sites, addChain-known = switch, tx/typed auto-switch, no network picker on connect, network picker in Connection details.
- WalletConnect: bridge.onChainChanged (updateSession then chainChanged); wired from ProviderService emit.
- Registry: 22 EVM testnets in src/core/chains/testnets.ts (RPC liveness not probed from the sandbox: run npm run check:rpc).
- Tests: provider/walletconnect tests updated; tsc clean; 403/405 pass (2 fail on sandbox file-delete EPERM only).
