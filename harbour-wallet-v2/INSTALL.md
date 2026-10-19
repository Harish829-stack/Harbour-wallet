# Harbour Wallet — Install & Run

## Option A — just load the prebuilt extension (no tools needed)
1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** → select the **`dist/`** folder in this directory
4. The Harbour icon appears and onboarding opens. Create a wallet.

That's it — `dist/` is a complete, built MV3 extension (includes wallet-core wasm + icons).

## Option B — build from source yourself
Requires Node 18+.
```
npm install
cp node_modules/@trustwallet/wallet-core/dist/lib/wallet-core.wasm public-production/
npm run build        # outputs dist/
```
Then Load unpacked → select `dist/` (steps above).
For live dev: `npm run dev`.

## Notes
- Crypto is 100% `@trustwallet/wallet-core@4.8.2` (no custom crypto).
- Working now: create wallet, secret-phrase backup, unlock/lock. Home screen
  balances + Send are the next milestone (see BUILD-LOG.md).
