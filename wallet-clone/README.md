# Nova Wallet (placeholder) — RE-backed secure core

A Trust Wallet-compatible wallet built from the reverse-engineering in
`../trust-wallet-RE.md` + `../evidence/`. Placeholder branding; swap in `src/theme.js`.

## Status (this milestone: secure core)
Built & tested (`npm test`, 5/5 passing):
- `src/passwordService.js` — PBKDF2-HMAC-SHA512, 20k/210k iters, 512-bit (RE §4.1)
- `src/passworder.js` — outer AES-GCM-256, PBKDF2-SHA256 10k (RE §4.3/§4.6)
- `src/vaultService.js` — vault create/lock/unlock + throttle (5 free, 5s→5min) + storage schema (RE §4.2/§4.9/§6.2)
- `src/chains.js` — 7 mainnets + Sepolia testnet (RE §4.8)
- Keystore: wallet-core aes-128-ctr + scrypt 16384/8/4/32, v3 (RE §4.5)

Equivalence proven in `test/`: same mnemonic → same addresses as Trust Wallet;
keystore params match; vault round-trips; wrong password rejected.

## Run tests
    npm install      # pulls @trustwallet/wallet-core@4.8.2 (the exact TW build)
    npm test

## Config
Copy `.env.example` → `.env` and add your Alchemy key + Sepolia RPC URL.

## Not built yet (next milestones)
- Onboarding UI (React), popup/full-page (RE §3)
- dApp provider inject + content bridge (RE §5.12/§5.14)
- Transaction build/sign/broadcast (RE §5.11) — needs RPC (Alchemy/Sepolia)
- Balances/prices/history (RE §5.10) — needs API provider
- WalletConnect (RE §5.16, via WC SDK), Ledger (via @ledgerhq)
