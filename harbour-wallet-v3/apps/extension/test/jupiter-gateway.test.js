// Jupiter's free lite-api host is deprecated and the current API needs a key: the extension may only reach Jupiter through the
// Harbour gateway, where the key lives. Nothing in src may call the old host or carry a Jupiter key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const files = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });

test('no code path calls the deprecated lite-api.jup.ag host or embeds a Jupiter key', () => {
  for (const f of files(src)) {
    const t = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(!/https?:\/\/lite-api\.jup\.ag/.test(t), `${path.relative(src, f)} calls lite-api.jup.ag`);
    assert.ok(!/x-api-key/i.test(t) || !/jup/i.test(t.match(/.*x-api-key.*/i)?.[0] ?? ''), `${path.relative(src, f)} sends a Jupiter key from the client`);
  }
});

test('Jupiter swaps go through the backend swap service only (it holds the key); token search through the gateway', () => {
  const b = readFileSync(path.join(src, 'core/swap/backend.ts'), 'utf8');
  assert.match(b, /'\/v1\/swap\/quotes'/); assert.match(b, /'\/v1\/swap\/transaction'/);
  assert.ok(!existsSync(path.join(src, 'core/swap/jupiter.ts')), 'no client-side Jupiter adapter');
  const t = readFileSync(path.join(src, 'core/chains/adapters/tokens.ts'), 'utf8');
  assert.match(t, /\$\{GATEWAY_URL\}\/jup\/tokens\/v2\/search\?query=/);
});
