wallet-core.wasm is NOT committed (10MB). After `npm install`, copy it here:
cp node_modules/@trustwallet/wallet-core/dist/lib/wallet-core.wasm public/wallet-core.wasm
(then `npm run build`). This ships the wasm to dist root for the service worker.
