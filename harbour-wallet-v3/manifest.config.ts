import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';
// @ts-expect-error plain .mjs helper shared with vite.config.ts
import { apiUrlStatus } from './scripts/api-url.mjs';

export default defineManifest((env) => {
  const api = apiUrlStatus(loadEnv(env.mode, process.cwd(), 'VITE_').VITE_HB_API_URL);
  return {
    manifest_version: 3,
    name: 'Harbour Wallet',
    version: '0.1.0',
    description: 'Self-custody crypto wallet.',
    // 137 is the first Chrome with unflagged WebCrypto Ed25519, which the device key needs (audit V3-33).
    minimum_chrome_version: '137',
    action: { default_popup: 'src/popup/index.html', default_title: 'Harbour Wallet', default_icon: { '16':'icons/icon16.png','32':'icons/icon32.png','48':'icons/icon48.png','128':'icons/icon128.png' } },
    icons: { '16':'icons/icon16.png','32':'icons/icon32.png','48':'icons/icon48.png','128':'icons/icon128.png' },
    background: { service_worker: 'src/background/index.ts', type: 'module' },
    side_panel: { default_path: 'src/popup/index.html' },
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; base-uri 'none'" },
    permissions: ['alarms', 'storage', 'clipboardWrite', 'notifications', 'scripting', 'sidePanel', 'gcm', 'idle', 'offscreen'],
    // Plain-http loopback access only in local builds that talk to a backend on this computer.
    host_permissions: ['https://*/*', ...(api.local ? ['http://localhost/*', 'http://127.0.0.1/*'] : [])],
  };
});
