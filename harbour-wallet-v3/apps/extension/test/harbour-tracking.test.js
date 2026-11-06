// Address tracking against a backend that serves fewer networks (ENABLED_CHAINS): refused networks are remembered,
// so a refresh no longer repeats the failed batch plus one PUT per network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const out = await build({ stdin: { contents: `export * from './device'; export * from './client'; export * from './data';`, resolveDir: fileURLToPath(new URL('../src/core/harbour/', import.meta.url)), sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_HB_API_URL: 'https://api.test' }) } });
const H = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const A = '0xe3b055427bdb39a6e66748d2c4212ff3946a82c7';

test('networks the backend refuses are not re-sent on every refresh', async () => {
  let mem; H.setDeviceStorage({ load: async () => mem, save: async (v) => { mem = v; }, forget: async () => { mem = undefined; } });
  const puts = [];
  H.setRawFetch(async (url, init = {}) => {
    if (url.endsWith('/v1/devices/challenge')) return json({ challenge: 'c', difficulty: 4 });
    if (url.endsWith('/v1/devices')) return json({ device_id: '11111111-1111-1111-1111-111111111111' }, 201);
    if (url.endsWith('/v1/me/addresses') && init.method === 'PUT') {
      const body = JSON.parse(typeof init.body === 'string' ? init.body : new TextDecoder().decode(init.body)); puts.push(body);
      return body.add.some((r) => r.chain !== 'sepolia') ? json({ error: { code: 'bad_address', message: "One of the addresses or networks isn't valid.", retryable: false } }, 400) : json({ addresses: body.add });
    }
    return json({}, 404);
  });
  H.resetTrackingForTests();
  const refs = [{ chain: 'sepolia', address: A }, { chain: 'ethereum', address: A }, { chain: 'base', address: A }];
  await H.ensureTracked(refs);
  assert.equal(puts.length, 4); // the batch, then one per network: sepolia accepted, ethereum and base refused
  await H.ensureTracked(refs); await H.ensureTracked(refs);
  assert.equal(puts.length, 4, 'tracked and refused refs are not sent again');
  // A lone ref the backend refuses is remembered too (no exception, no repeat).
  await H.ensureTracked([{ chain: 'opbnb', address: A }]); await H.ensureTracked([{ chain: 'opbnb', address: A }]);
  assert.equal(puts.length, 5);
});
