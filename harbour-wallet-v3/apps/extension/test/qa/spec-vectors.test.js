// QA (KAT): TON Connect ton_proof signing input and Cosmos ADR-036 sign bytes, each checked against an independent
// construction written here from the spec text (node:crypto only, never the code under test). TEST_PLAN: T-SIG-033.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const load = async (src) => { const o = await build({ stdin: { contents: src, resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64')); };
const { tonProofHash } = await load("export { tonProofHash } from './src/background/provider/tonProof.ts'");
const { signPlan, aminoSignBytes } = await load("export { signPlan, aminoSignBytes } from './src/core/provider/multi.ts'");
const sha = (b) => createHash('sha256').update(b).digest();

test('T-SIG-033: ton_proof hash = sha256(0xffff || "ton-connect" || sha256("ton-proof-item-v2/" || wc(BE32) || addr || len(dom)(LE32) || dom || ts(LE64) || payload))', () => {
  const addressHash = Buffer.from('0102030405060708091011121314151617181920212223242526272829303132', 'hex');
  const p = { workchain: 0, addressHash, domain: 'example.com', timestamp: 1_700_000_000, payload: 'doc-example-123' };
  const wc = Buffer.alloc(4); wc.writeInt32BE(0);
  const dl = Buffer.alloc(4); dl.writeUInt32LE(11);
  const ts = Buffer.alloc(8); ts.writeBigUInt64LE(1_700_000_000n);
  const msg = Buffer.concat([Buffer.from('ton-proof-item-v2/'), wc, addressHash, dl, Buffer.from('example.com'), ts, Buffer.from('doc-example-123')]);
  const want = sha(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), sha(msg)]));
  assert.equal(Buffer.from(tonProofHash(p)).toString('hex'), want.toString('hex'));
  // every input field is bound: changing any one changes the digest
  const base = Buffer.from(tonProofHash(p)).toString('hex');
  for (const alt of [{ workchain: -1 }, { domain: 'example.org' }, { timestamp: 1_700_000_001 }, { payload: 'doc-example-124' }, { addressHash: Buffer.alloc(32, 7) }])
    assert.notEqual(Buffer.from(tonProofHash({ ...p, ...alt })).toString('hex'), base, JSON.stringify(Object.keys(alt)));
  // endianness is only visible for an asymmetric workchain value (0 and -1 encode the same either way): 0x01020304 big-endian
  const wcA = Buffer.alloc(4); wcA.writeInt32BE(0x01020304);
  const msgA = Buffer.concat([Buffer.from('ton-proof-item-v2/'), wcA, addressHash, dl, Buffer.from('example.com'), ts, Buffer.from('doc-example-123')]);
  assert.equal(Buffer.from(tonProofHash({ ...p, workchain: 0x01020304 })).toString('hex'), sha(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), sha(msgA)])).toString('hex'), 'workchain is big-endian');
  // workchain -1 (masterchain) encodes as 0xffffffff big-endian
  const wcm = Buffer.alloc(4); wcm.writeInt32BE(-1); assert.equal(wcm.toString('hex'), 'ffffffff');
});

test('T-SIG-033: ADR-036 signArbitrary sign bytes are the canonical amino StdSignDoc (sorted keys, no spaces, empty chain_id, MsgSignData)', () => {
  const signer = 'cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu', data = Buffer.from('hello cosmos').toString('base64');
  const plan = signPlan({ chain: 'cosmos', op: 'message', data: { dataB64: data } }, signer);
  const expected = `{"account_number":"0","chain_id":"","fee":{"amount":[],"gas":"0"},"memo":"","msgs":[{"type":"sigverify/MsgSignData","value":{"data":"${data}","signer":"${signer}"}}],"sequence":"0"}`;
  assert.equal(plan.scheme, 'secp256k1');
  assert.equal(Buffer.from(plan.data).toString('hex'), sha(Buffer.from(expected)).toString('hex'));
  assert.equal(Buffer.from(aminoSignBytes({ b: 1, a: { d: '<&>', c: [] } })).toString(), '{"a":{"c":[],"d":"\\u003c\\u0026\\u003e"},"b":1}');
});
