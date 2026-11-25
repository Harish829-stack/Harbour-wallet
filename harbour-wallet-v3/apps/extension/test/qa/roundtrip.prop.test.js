// QA (property): PendingStore records and settled outcomes survive a JSON storage round trip (as chrome.storage.session does) and a
// worker restart (fresh PendingStore over the same storage) with identity. TEST_PLAN: T-X-006 (PendingStore part).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const o = await build({ stdin: { contents: "export { PendingStore } from './src/core/provider/store.ts'", resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const { PendingStore } = await import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64'));
const RUNS = Number(process.env.HB_FUZZ_RUNS ?? 200);

const jsonKv = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : undefined), set: async (k, v) => { m.set(k, JSON.stringify(v)); }, remove: async (k) => { m.delete(k); } }; };
const hex = fc.bigUintN(256).map((b) => '0x' + b.toString(16)); // bigints travel as hex strings
const json = fc.letrec((t) => ({ v: fc.oneof({ maxDepth: 3 }, fc.string(), fc.integer(), fc.boolean(), fc.constant(null), hex, fc.array(t('v'), { maxLength: 3 }), fc.dictionary(fc.string({ maxLength: 5 }).filter((k) => k !== '__proto__'), t('v'), { maxKeys: 3 })) })).v;
const req = fc.record({ key: fc.uuid(), reqId: fc.string(), ns: fc.constantFrom('eip155', 'solana'), method: fc.string(), kind: fc.constantFrom('sign', 'tx', 'typed', 'connect'), params: json, origin: fc.webUrl({ withQueryParameters: false, withFragments: false }), topOrigin: fc.webUrl(), isTopFrame: fc.boolean(), tabId: fc.integer({ min: 0, max: 1e6 }), frameId: fc.integer({ min: 0, max: 50 }), title: fc.option(fc.string(), { nil: undefined }) }, { requiredKeys: ['key', 'reqId', 'ns', 'method', 'kind', 'params', 'origin', 'topOrigin', 'isTopFrame', 'tabId', 'frameId'] });

test('T-X-006: PendingStore records are identical after storage round trip and a store restart', async () => {
  await fc.assert(fc.asyncProperty(fc.array(req, { minLength: 1, maxLength: 4 }), async (reqs) => {
    const kv = jsonKv(); const a = new PendingStore(kv, () => 1_000);
    const added = []; for (const r of reqs) added.push(await a.add(r));
    const b = new PendingStore(kv, () => 1_000); // worker restarted
    for (const p of added) assert.deepEqual(await b.get(p.id), JSON.parse(JSON.stringify(p)));
    assert.equal((await b.list()).length, new Set(reqs.map((r) => r.key)).size);
    const claimed = await b.claim(added[0].id); assert.equal(claimed.stage, 'executing');
    assert.equal(await new PendingStore(kv).claim(added[0].id), undefined, 'a claimed request is never claimed twice after restart');
    assert.deepEqual(await b.take(added[0].id), { ...JSON.parse(JSON.stringify(added[0])), stage: 'executing' });
  }), { numRuns: RUNS });
});

test('T-X-006: settled outcomes round trip (result and error shapes)', async () => {
  await fc.assert(fc.asyncProperty(fc.string({ minLength: 1 }).filter((k) => k !== '__proto__'), fc.oneof(json.map((result) => ({ result })), fc.record({ error: fc.record({ code: fc.integer(), message: fc.string() }) })), async (key, outcome) => {
    const kv = jsonKv(); await new PendingStore(kv, () => 5).putSettled(key, outcome);
    assert.deepEqual(await new PendingStore(kv, () => 6).takeSettled(key), JSON.parse(JSON.stringify(outcome)));
    // takeSettled does NOT remove (OBS-11): a resend within the TTL gets the same answer instead of a second prompt.
    assert.deepEqual(await new PendingStore(kv, () => 7).takeSettled(key), JSON.parse(JSON.stringify(outcome)));
    assert.equal(await new PendingStore(kv, () => 5 + 5 * 60_000 + 1).takeSettled(key), undefined, 'expires after SETTLED_TTL_MS');
  }), { numRuns: RUNS });
});
