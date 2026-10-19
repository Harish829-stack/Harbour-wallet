import { copyFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source = new URL('../node_modules/@trustwallet/wallet-core/dist/lib/wallet-core.wasm', import.meta.url);
const digest = createHash('sha256').update(readFileSync(source)).digest('hex');
if (digest !== '1b78048fa04fd8905b4eea99eb281bffb167e46a5559d28392a5e8116a885171') {
  throw new Error('wallet-core.wasm does not match the pinned reference dependency');
}
copyFileSync(source, new URL('../public/wallet-core.wasm', import.meta.url));
console.log('Prepared verified wallet-core 4.8.2 WASM');
