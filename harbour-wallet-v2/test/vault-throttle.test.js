// Parallel wrong guesses must be serialized so the lockout still trips after FREE_ATTEMPTS (5), and storage.session stays pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pbkdf2Sync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const fakeBrowser = `
const store = (g) => ({ get: async (k) => { await new Promise(r => setTimeout(r, 1)); return k in g.data ? { [k]: g.data[k] } : {}; }, set: async (o) => { Object.assign(g.data, o); }, remove: async (k) => { delete g.data[k]; } });
const state = globalThis.__fake = { local: { data: {} }, session: { data: {} } };
export default { storage: { local: store(state.local), session: store(state.session) } };`;
const plugin = { name: 'fake', setup(b) {
  b.onResolve({ filter: /^webextension-polyfill$/ }, () => ({ path: 'fake', namespace: 'fake' }));
  b.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: fakeBrowser, loader: 'js' }));
} };
const out = await build({ stdin: { contents: `export { VaultService } from './core/vaultService';`, resolveDir: root, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', plugins: [plugin] });
const { VaultService } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const core = { HexCoding: { encode: (u) => Buffer.from(u).toString('hex'), decode: (h) => new Uint8Array(Buffer.from(h, 'hex')) },
  PBKDF2: { hmacSha512: (p, s, i, l) => new Uint8Array(pbkdf2Sync(p, s, 1, l, 'sha512')) } }; // 1 iteration: speed only

test('parallel wrong passwords cannot outrun the throttle', async () => {
  const v = new VaultService(core);
  await v.create('correct horse battery', { wallets: {} }); await v.lock();
  const guesses = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => v.unlock('wrong-' + i)));
  const msgs = guesses.map((g) => g.reason?.message);
  assert.equal(msgs.filter((m) => m === 'Incorrect password').length, 6, '5 free guesses plus the one that arms the lockout; unserialized this would be 12');
  assert.equal(msgs.filter((m) => m === 'TOO_MANY_ATTEMPTS').length, 6);
  await assert.rejects(v.checkPassword('correct horse battery'), /TOO_MANY_ATTEMPTS/, 'lockout also blocks the right password');
});
