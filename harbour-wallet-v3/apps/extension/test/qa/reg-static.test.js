// QA regression (static scan): the legacy v2 Cloudflare gateway is not part of the v3 extension (ASM-14, commit 68d65cc).
// TEST_PLAN: T-REG-026. Nothing under src/ or the production manifest may point at the legacy gateway or any *.workers.dev origin other
// than the one reviewed third-party service listed below; the legacy worker sources are not imported by the extension.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n); const s = statSync(p);
    if (s.isDirectory()) { if (n !== 'node_modules') walk(p, out); } else if (/\.(ts|tsx|js|mjs|json|html|css)$/.test(n)) out.push(p);
  }
  return out;
}
const SRC = walk(join(ROOT, 'src'));
const read = (p) => readFileSync(p, 'utf8');

// OBS-15 (fixed): .sol lookups go through the Harbour gateway; no source file may call a *.workers.dev origin directly.
test('T-REG-026: no source file references a *.workers.dev origin (the SNS lookup goes through the Harbour gateway)', () => {
  const found = [];
  for (const f of SRC) for (const m of read(f).matchAll(/https?:\/\/[a-z0-9.-]*workers\.dev/gi)) found.push([relative(ROOT, f), m[0].toLowerCase()]);
  assert.deepEqual(found, [], `workers.dev origins in source: ${JSON.stringify(found)}`);
  assert.match(read(join(ROOT, 'src/core/sendService.ts')), /\/sns\/resolve\//, 'SNS resolution uses the gateway route');
});

test('T-REG-026: no legacy gateway ORIGIN (harbour-gateway.<account>.workers.dev) appears in src, the manifest source or public assets, and src never imports gateway/', () => {
  const wrangler = read(join(ROOT, 'gateway/wrangler.toml'));
  const name = wrangler.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
  assert.ok(name, 'wrangler name found');
  const surfaces = [...SRC, join(ROOT, 'manifest.config.ts'), ...walk(join(ROOT, 'public-production'))];
  const origin = new RegExp(`${name.replace(/[-]/g, '\\-')}\\.[a-z0-9-]+\\.`, 'i'); // the worker's public hostname; the bare word still appears in comments about the gateway concept
  const hits = surfaces.filter((f) => origin.test(read(f))).map((f) => relative(ROOT, f));
  assert.deepEqual(hits, [], `legacy gateway origin for "${name}" referenced`);
  const imports = SRC.filter((f) => /\.(ts|tsx|js|mjs)$/.test(f)).filter((f) => /from\s+['"](\.\.?\/)+gateway\/|import\s+['"](\.\.?\/)+gateway\//.test(read(f))).map((f) => relative(ROOT, f));
  assert.deepEqual(imports, [], 'the legacy worker sources are not imported by the extension');
});

test('T-REG-026: the legacy deploy script refuses to run without the explicit --legacy-v2 flag', () => {
  const t = read(join(ROOT, 'scripts/deploy-gateway.mjs'));
  assert.match(t, /--legacy-v2/);
  assert.match(t, /process\.exit\(1\)|process\.exit\(2\)/, 'exits when the flag is absent');
});
