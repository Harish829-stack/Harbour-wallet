// Architecture guard (plan Phase 1 exit): popup code is a thin client. It may use pure core helpers/types, but never the vault,
// key material, wallet-core, storage or background modules. Everything stateful goes through the worker over the UI port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../src/popup/', import.meta.url));
const FORBIDDEN = [/core\/vaultService/, /core\/walletService/, /core\/walletCore/, /core\/passworder/, /core\/passwordService/, /core\/passkeyService/, /core\/storage/, /core\/rpc['"]/, /\/background\//, /@trustwallet\/wallet-core/];
const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });

test('popup never imports vault, keys, wallet-core, storage or background code', () => {
  const bad = [];
  for (const f of walk(root)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) if (FORBIDDEN.some((re) => re.test(m[1] + "'"))) bad.push(`${path.relative(root, f)} -> ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
