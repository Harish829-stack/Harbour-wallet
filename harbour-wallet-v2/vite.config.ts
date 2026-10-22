import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
export default defineConfig({
  publicDir: 'public-production',
  plugins: [react(), crx({ manifest })],
  build: { target: 'esnext', modulePreload: false, sourcemap: false, // never ship public source maps
    // Extension bundles load from disk, so chunk size is not a network cost (the service worker bundles all chain SDKs, ~10 MB); modules imported both lazily and eagerly are intentional (lazy keeps them out of the content-script/inpage graphs).
    chunkSizeWarningLimit: 12000,
    rollupOptions: {
      input: { popup: 'src/popup/index.html' },
      onwarn(warning, defaultHandler) { if (/dynamically imported by .* but also statically imported/s.test(warning.message)) return; defaultHandler(warning); },
    } },
  server: { port: 5173 },
});
