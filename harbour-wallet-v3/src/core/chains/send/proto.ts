// wallet-core protobuf namespace. Imported through a namespace so the same code works in the Vite bundle (named export) and in
// node test bundles where the CJS package is loaded as a default export.
import * as WC from '@trustwallet/wallet-core';
export const TW: typeof import('@trustwallet/wallet-core').TW = (WC as any).TW ?? (WC as any).default?.TW;
