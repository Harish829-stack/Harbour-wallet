import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
// @ts-expect-error plain .mjs helper shared with scripts/release.mjs
import { apiUrlStatus } from './scripts/api-url.mjs';

export default defineConfig(({ mode }) => {
  // The backend URL is baked into the bundle: refuse anything but https (or a backend on this computer for local builds).
  const api = apiUrlStatus(loadEnv(mode, process.cwd(), 'VITE_').VITE_HB_API_URL);
  if (!api.ok) throw new Error(api.error);
  if (api.local && mode === 'production') console.warn(`\n[harbour] Local build: the API is ${api.url}. This dist/ cannot be released (scripts/release.mjs refuses it).\n`);
  return {
    publicDir: 'public-production',
    plugins: [react(), crx({ manifest }), {
      // dist/build-info.json tells release.mjs which API this bundle talks to.
      name: 'harbour-build-info',
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ api: api.url, local: api.local, mode }) }); },
    }],
    build: { target: 'esnext', modulePreload: false, sourcemap: false, // never ship public source maps
      // Extension bundles load from disk, so chunk size is not a network cost (the service worker bundles all chain SDKs, ~10 MB); modules imported both lazily and eagerly are intentional (lazy keeps them out of the content-script/inpage graphs).
      chunkSizeWarningLimit: 12000,
      rollupOptions: {
        input: { popup: 'src/popup/index.html', offscreen: 'src/offscreen/clipboard.html' },
        onwarn(warning, defaultHandler) { if (/dynamically imported by .* but also statically imported/s.test(warning.message)) return; defaultHandler(warning); },
      } },
    server: { port: 5173 },
  };
});
