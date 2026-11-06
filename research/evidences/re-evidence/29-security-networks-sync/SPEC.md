# Reveal-phrase auth, Custom Networks, Sync with Mobile, popup mode

Tags: [certain] read from the TW 26.41.0 bundle or screenshots, [likely] inference, [guessing] fill-in.

## 1. Seed phrase needs re-authentication
- [likely] TW asks for the password (or biometrics) before showing the phrase. Exact TW screen wording not captured; Harbour wording is its own.
- Harbour: `revealMnemonic` is refused unless `revealAuth` succeeded in the last 2 minutes; the grant is one-shot and cleared on lock.
  Password path reuses the lock-screen throttling. Biometric path runs in a tab (`?reveal=1`) like biometric unlock.
- Not verified: real Touch ID / Windows Hello hardware.

## 2. Custom Networks (Settings)
- [certain] Layout and fields from screenshots: empty state, "Built-in network RPCs" list with pencil, Add form (Network name, RPC URL, Chain ID,
  Token symbol, Block explorer URL (Optional)), orange "Double check the network info" alert, EVM only.
- Harbour additions (own design): RPC is probed and its `eth_chainId` must equal the typed chain id; https only (http allowed for localhost);
  built-in chains only allow changing/resetting their RPC; custom networks become selectable for custom tokens and feed RPC / explorer lookups.
- NOT done: native-coin balance row for a custom network on Home; swaps/dApp access on custom networks. Tokens on them work (add, balance, send, receive).

## 3. Sync with Mobile
- [certain] TW's QR step shows a static deep link `https://link.trustwallet.com/extension_sync`. It is an IMPORT from the TW mobile app:
  the desktop camera reads the phone's animated QR (Blockchain Commons UR frames -> CBOR -> gzip -> JSON array of minified wallet-core StoredKeys),
  then a 6-character one-time code decrypts them. Limits: 400 KiB compressed, 1 MB inflated, sequence numbers 1..2048.
- Harbour: same pipeline (`core/qrSync.ts`), seed-phrase wallets only. The code is verified with the keystore MAC before wallet-core is touched,
  because wallet-core aborts its wasm runtime on a wrong password or malformed JSON. Duplicates are detected by address.
- Harbour does not talk to any TW server; the only TW-specific thing is the deep link that opens the TW mobile app.
- Verified: unit tests build a real wallet-core StoredKey, encode it as multi-frame UR, decode it and decrypt it. E2E: import, duplicate, wrong code,
  malformed key; camera stream starts with a fake device.
- NOT verified: a real QR from the TW mobile app (the minified field layout comes from the bundle; if TW changes it this will fail closed);
  jsQR reading a live phone screen (frame rate / lighting).

## 4. Popup mode
- Toolbar popup and side-panel toggle both behave correctly in Chromium (`setPanelBehavior` flips with the setting; popup renders at 380x600).
  The real toolbar click cannot be automated headlessly. Harbour has no dApp provider / approval window yet; if "popup mode" meant the dApp
  connection popup, that is a separate feature and is not built.
