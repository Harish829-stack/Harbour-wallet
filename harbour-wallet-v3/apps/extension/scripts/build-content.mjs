// Bundle the isolated-world bridge as a self-contained classic content script.
// Keeping this out of CRXJS's dynamic-import loader prevents stale hashed chunks
// from surviving an unpacked-extension reload.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  entryPoints: [root + 'src/content/content.ts'],
  outfile: root + 'public-production/public-content.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});
