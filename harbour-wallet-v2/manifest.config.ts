import { defineManifest } from '@crxjs/vite-plugin';
import { BLOCKED_DOMAINS } from './src/core/provider/origin';
// Sites where no provider is ever injected (Trust Wallet's list, evidence/12-dapp-provider) + captcha/ad frames. The page provider itself (public/inpage.js) is
// registered at runtime with chrome.scripting.registerContentScripts({ world: 'MAIN' }) — see src/background/provider/index.ts — so it needs no web_accessible_resources entry.
const EXCLUDE = [...BLOCKED_DOMAINS.map((d) => `*://*.${d}/*`), '*://*.recaptcha.net/recaptcha/*', '*://www.google.com/recaptcha/*', '*://*.hcaptcha.com/*', '*://*.challenges.cloudflare.com/*', '*://*.captcha-delivery.com/*', '*://*.arkoselabs.com/*', '*://*.funcaptcha.com/*', '*://*.doubleclick.net/*', '*://*.googlesyndication.com/*', '*://*.amazon-adsystem.com/*', '*://*.magic.link/*'];
export default defineManifest({
  manifest_version: 3,
  name: 'Harbour Wallet',
  version: '0.1.0',
  description: 'Self-custody crypto wallet.',
  minimum_chrome_version: '114',
  action: { default_popup: 'src/popup/index.html', default_title: 'Harbour Wallet', default_icon: { '16':'icons/icon16.png','32':'icons/icon32.png','48':'icons/icon48.png','128':'icons/icon128.png' } },
  icons: { '16':'icons/icon16.png','32':'icons/icon32.png','48':'icons/icon48.png','128':'icons/icon128.png' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/popup/index.html' },
  content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
  permissions: ['alarms', 'tabs', 'storage', 'clipboardWrite', 'notifications', 'scripting', 'sidePanel'],
  host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
});
