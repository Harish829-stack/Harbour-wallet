# Chrome Web Store listing (draft)

**Name:** Harbour Wallet
**Category:** Productivity
**Short description:** A self-custodial multi-chain crypto wallet: send, swap, stake and connect to dApps across 90+ networks.

**Description:**
Harbour is a self-custodial wallet. Your keys are encrypted on your device and never leave it.
- Holds assets on Ethereum and EVM networks, Bitcoin, Solana, TRON, TON, Cosmos, Sui, Aptos, Polkadot, Tezos, Cardano and more.
- Swaps and bridges through public aggregators, showing the best quote.
- Stakes natively on Cosmos chains, Solana, ETH (Lido or Rocket Pool), BNB, TRON, Tezos, Polkadot and Cardano.
- Connects to dApps on EVM, Solana, Cosmos, Sui, Aptos, TRON, Bitcoin and TON, with a clear review of every request: decoded calls, estimated balance changes and phishing warnings.
- Shows NFTs, markets, charts and news, and notifies incoming transfers.
- Supports Ledger hardware wallets.
- Includes a token-approval scanner with one-tap revoke.

**Single purpose:** manage the user's own crypto assets and sign transactions they approve.

**Permission justifications**
- `storage`: the encrypted vault and settings, on this device.
- `alarms`: the auto-lock timer, remote-config refresh and the incoming-transfer check.
- `notifications`: incoming transfers and announcements, when enabled.
- `gcm`: optional server push for incoming transfers.
- `scripting`: registers the wallet provider script that dApps talk to.
- `sidePanel`: optional side-panel mode.
- `clipboardWrite`: copying addresses and transaction hashes.
- Host permission `https://*/*`: injects the wallet provider into the web pages the user visits and reads public blockchain data.

**Data use (privacy):**
- No personal data is collected or sold.
- Public blockchain addresses are sent to public blockchain APIs to read balances and history, and to the optional push service only if the user enables push.
- No analytics are collected by default.

**Remote code:** none. All code ships in the package; remote config is signed data (flags), not code.

**Assets to prepare:** 128×128 icon (exists), 1280×800 screenshots (home, swap, dApp approval, staking, NFTs), a 440×280 small tile, and a privacy policy URL.
