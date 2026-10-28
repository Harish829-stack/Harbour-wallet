// "Sync with Mobile": UR multi-frame decode -> gunzip -> unminify -> wallet-core decrypt with the 6-char code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import pkg from '@trustwallet/wallet-core';
import { UR, UREncoder } from '@ngraveio/bc-ur';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/qrSync';`, resolveDir: root, sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', external: ['@ngraveio/bc-ur'], nodePaths: [fileURLToPath(new URL('../node_modules', import.meta.url))] });
const tmp = fileURLToPath(new URL('./.qrsync.mjs', import.meta.url));
(await import('node:fs')).writeFileSync(tmp, out.outputFiles[0].text);
const Q = await import(tmp + '?' + Date.now());
(await import('node:fs')).unlinkSync(tmp);

const MNEMONIC = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const CODE = 'A1b2C3';
async function exportKey(core, mnemonic, code) {
  const sk = core.StoredKey.importHDWalletWithEncryption(mnemonic, 'Phone', new TextEncoder().encode(code), core.CoinType.ethereum, core.StoredKeyEncryption.aes128Ctr);
  const j = JSON.parse(new TextDecoder().decode(sk.exportJSON())); sk.delete(); return j;
}
const minify = (j) => ({ c: { c: j.crypto.cipher, p: { i: j.crypto.cipherparams.iv }, t: j.crypto.ciphertext, k: j.crypto.kdf, kp: { d: j.crypto.kdfparams.dklen, n: j.crypto.kdfparams.n, p: j.crypto.kdfparams.p, r: j.crypto.kdfparams.r, s: j.crypto.kdfparams.salt }, m: j.crypto.mac }, t: j.type, a: null, b: null, n: j.name });
const frames = (payload, max = 60) => { const ur = UR.fromBuffer(Buffer.from(gzipSync(Buffer.from(payload)))); const enc = new UREncoder(ur, max); const f = []; for (let i = 0; i < Math.max(enc.fragments.length * 2, 4); i++) f.push(enc.nextPart()); return f; };

test('animated QR frames decode back to the exported key and the one-time code decrypts it', async () => {
  const core = await pkg.initWasm();
  const payload = JSON.stringify([minify(await exportKey(core, MNEMONIC, CODE))]);
  const fr = frames(payload); assert.ok(fr.length > 2, 'multi-frame transfer');
  const reader = Q.createQrSyncReader(); let keys = null;
  for (const f of fr) { keys = await reader.receive(f); if (keys) break; }
  assert.ok(keys && keys.length === 1);
  const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(keys[0])));
  assert.equal(sk.isMnemonic(), true);
  assert.equal(sk.decryptMnemonic(new TextEncoder().encode(CODE)), MNEMONIC);
  assert.equal(await Q.codeMatchesKey(keys[0], CODE), true, 'MAC check accepts the right code');
  assert.equal(await Q.codeMatchesKey(keys[0], 'ZZZZZZ'), false, 'MAC check rejects a wrong code without touching wasm');
  assert.equal(await Q.codeMatchesKey({ ...keys[0], crypto: { ...keys[0].crypto, kdfparams: { ...keys[0].crypto.kdfparams, n: 3 } } }, CODE), false, 'bad KDF params rejected');
  sk.delete();
});

test('frames can arrive out of order and repeated', async () => {
  const core = await pkg.initWasm();
  const fr = frames(JSON.stringify([minify(await exportKey(core, MNEMONIC, CODE))])).reverse();
  const r = Q.createQrSyncReader(); let keys = null;
  for (const f of [...fr, ...fr]) { keys = await r.receive(f); if (keys) break; }
  assert.ok(keys);
});

test('rejects non-UR text, absurd sequence numbers and oversize payloads', async () => {
  const r = Q.createQrSyncReader();
  await assert.rejects(r.receive('https://example.com'), /Not a wallet sync QR/);
  await assert.rejects(r.receive('ur:bytes/99999-99999/lpadaxcfaxiacyvdlbptvemk'), /out-of-range|Invalid|invalid/);
  const big = Buffer.alloc(Q.MAX_INFLATED + 10, 65).toString();
  const ur = UR.fromBuffer(Buffer.from(gzipSync(Buffer.from(big)))); const enc = new UREncoder(ur, 500); const r2 = Q.createQrSyncReader();
  await assert.rejects((async () => { for (let i = 0; i < 500; i++) { const k = await r2.receive(enc.nextPart()); if (k) return; } })(), /maximum|Unexpected/);
  await assert.rejects(r2.receive(enc.nextPart()), /already rejected/);
});

test('malformed keys never reach wallet-core', async () => {
  const core = await pkg.initWasm(); const keys = await (async () => { const r = Q.createQrSyncReader(); let k = null; for (const f of frames(JSON.stringify([minify(await exportKey(core, MNEMONIC, CODE))]))) { k = await r.receive(f); if (k) break; } return k; })();
  assert.equal(Q.isWellFormedKey(keys[0]), true);
  for (const bad of [null, {}, { ...keys[0], type: 5 }, { ...keys[0], crypto: { ...keys[0].crypto, ciphertext: 'zz' } }, { ...keys[0], crypto: { ...keys[0].crypto, kdf: 'pbkdf2' } }]) assert.equal(Q.isWellFormedKey(bad), false);
});

test('one-time code shape', () => { assert.ok(Q.ONE_TIME_CODE.test('A1b2C3')); assert.ok(!Q.ONE_TIME_CODE.test('12345')); assert.ok(!Q.ONE_TIME_CODE.test('12 456')); });
