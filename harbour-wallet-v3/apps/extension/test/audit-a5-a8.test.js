// Audit A5 (QR scrypt bomb), A6 (typed data without chainId), A8 (unblocking a site needs re-auth). A7 lives in provider.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/qrSync'; export { summarizeTypedData } from './core/provider/typed';`, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', external: ['@ngraveio/bc-ur'] });
const tmp = fileURLToPath(new URL('./.a5a8.mjs', import.meta.url)); writeFileSync(tmp, out.outputFiles[0].text);
const M = await import(tmp + '?' + Date.now()); unlinkSync(tmp);

const key = (kp) => ({ type: 'mnemonic', crypto: { cipher: 'aes-128-ctr', cipherparams: { iv: '00'.repeat(16) }, ciphertext: '11'.repeat(32), kdf: 'scrypt', kdfparams: { dklen: 32, salt: '22'.repeat(32), ...kp }, mac: '33'.repeat(32) } });

test('A5: a key whose scrypt memory exceeds the cap is refused instantly (old bound allowed 2 GiB)', async () => {
  const t = Date.now();
  assert.equal(await M.codeMatchesKey(key({ n: 1 << 20, r: 16, p: 8 }), 'ABC123'), false);   // 2 GiB
  assert.equal(await M.codeMatchesKey(key({ n: 1 << 18, r: 16, p: 1 }), 'ABC123'), false);   // 512 MiB
  assert.ok(Date.now() - t < 500, 'refused without running scrypt');
});
test('A5: total scrypt work across one import is budgeted, so 100 heavy keys cannot hang the worker', async () => {
  const budget = { spent: M.QR_MAX_TOTAL_WORK - 1 }; const t = Date.now();   // the import has already used up its budget
  for (let i = 0; i < 100; i++) assert.equal(await M.codeMatchesKey(key({ n: 1 << 16, r: 8, p: 8 }), 'ABC123', budget), false);
  assert.ok(Date.now() - t < 500, 'every remaining key was refused without running scrypt');
});
test('A5: a normal wallet-core key is still accepted by the bounds (N=2^14, r=8, p=4)', async () => {
  const budget = { spent: 0 };
  await M.codeMatchesKey(key({ n: 1 << 14, r: 8, p: 4 }), 'ABC123', budget);   // wrong MAC -> false, but it must have run, i.e. been within bounds
  assert.equal(budget.spent, (1 << 14) * 8 * 4);
});

const td = (domain) => ({ types: { Mail: [{ name: 'to', type: 'address' }] }, primaryType: 'Mail', domain, message: { to: '0x' + '11'.repeat(20) } });
test('A6: typed data with no domain.chainId carries the noChainId warning', () => {
  for (const d of [{ name: 'X' }, { name: 'X', chainId: null }, { name: 'X', chainId: '' }]) assert.ok(M.summarizeTypedData(td(d)).warnings.includes('noChainId'));
  assert.ok(!M.summarizeTypedData(td({ name: 'X', chainId: 1 })).warnings.includes('noChainId'));
  assert.ok(!M.summarizeTypedData(td({ name: 'X', chainId: '0x1' })).warnings.includes('noChainId'));
});

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
test('A8: unblocking a site consumes the manage re-auth grant, and the popup prompts for it', () => {
  const h = read('background/handlers/provider.ts'); const i = h.indexOf('async providerBlacklistRemove');
  assert.match(h.slice(i, i + 220), /consumeReauth\('manage'\)/);
  assert.match(read('popup/api.ts'), /providerBlacklistRemove: '/);
});
