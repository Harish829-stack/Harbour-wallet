import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
export default defineConfig({
  publicDir: 'public-production',
  plugins: [react(), crx({ manifest })],
  build: { target: 'esnext', modulePreload: false, rollupOptions: { input: { popup: 'src/popup/index.html' } } },
  server: { port: 5173 },
});
