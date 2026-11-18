// Smart account boundary tests: (1) a dApp cannot reach enable/revoke through the provider, (2) responses of the smart account
// handlers carry no secret-named fields (uiSafe), (3) the popup never imports signing code from core/smartAccount, and the
// handler file exposes only the four UI messages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({
  stdin: { contents: `export { specFor, isBridgeNamespaced } from './core/provider/methods'; export { uiSafe, findSecretField } from './core/uiSafe';`,
    resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const UI_MESSAGES = ['smartAccountStatus', 'smartAccountPrepare', 'smartAccountApprove', 'smartAccountReject'];

test('a web page cannot reach the smart account messages or methods through the provider', () => {
  for (const ns of ['evm', 'solana'])
    for (const m of [...UI_MESSAGES, 'wallet_upgradeDelegation', 'wallet_enableSmartAccount', 'wallet_revokeDelegation', 'eth_signAuthorization'])
      assert.equal(M.specFor(ns, m), null, `${ns}:${m}`);
});

test('the UI message names are exactly the four handlers, none takes key material', () => {
  const text = readFileSync(path.join(src, 'background/handlers/smartAccount.ts'), 'utf8');
  const names = [...text.matchAll(/^\s+(smartAccount\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(names.sort(), [...UI_MESSAGES].sort());
  assert.match(text, /svc\.approve\(ctx, \{ requestId: m\.requestId \}\)/, 'approve forwards only the requestId');
  assert.match(text, /svc\.reject\(\{ requestId: m\.requestId \}\)/, 'reject forwards only the requestId');
});

test('uiSafe blocks any secret-named field in a smart account response', () => {
  const ok = { ok: true, requestId: 'r1', kind: 'enable', chainId: 11155111, summary: { account: '0xabc', delegate: '0xdef' }, txHash: '0x12' };
  assert.deepEqual(M.uiSafe(ok), ok);
  for (const k of ['privateKey', 'mnemonic', 'password', 'secretKey'])
    assert.equal(M.uiSafe({ ...ok, [k]: 'x' }).error, 'SECRET_FIELD_BLOCKED', k);
});

const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });

test('the popup never imports the smart account core or service (signing code stays in the worker)', () => {
  const bad = [];
  const root = path.join(src, 'popup');
  for (const f of walk(root))
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g))
      if (/smartAccount(?:Service)?(?:\/(?:userOp|delegation|guard|abi))?['"]?$/.test(m[1]) && /core\/smartAccount\/(userOp|delegation|guard|abi)|smartAccountService/.test(m[1]))
        bad.push(`${path.relative(root, f)} -> ${m[1]}`);
  assert.deepEqual(bad, []);
});
