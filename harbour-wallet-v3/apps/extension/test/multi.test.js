// Non-EVM provider families (namespace 'multi'): exact signed bytes, signature packaging, strict validation, and the connect/sign flow through ProviderService.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { sha256 } from '@noble/hashes/sha256';
import { sha3_256 } from '@noble/hashes/sha3';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/provider/multi'; export * from './core/provider/store'; export * from './core/provider/methods'; export * from './core/provider/protocol'; export { ProviderService } from './background/provider/service';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const hex = (b) => Buffer.from(b).toString('hex'); const b64 = (b) => Buffer.from(b).toString('base64');
const sk = secp256k1.utils.randomPrivateKey(); const pk = secp256k1.getPublicKey(sk, true); const esk = ed25519.utils.randomPrivateKey(); const epk = ed25519.getPublicKey(esk);
/** wallet-core style 65-byte signature r||s||recid over a 32-byte digest */
const signSecp = (digest) => { const s = secp256k1.sign(digest, sk); return Uint8Array.from([...s.toCompactRawBytes(), s.recovery]); };

test('cosmos: amino bytes are key-sorted and escaped; SignDoc protobuf layout is exact', () => {
  assert.equal(Buffer.from(M.aminoSignBytes({ b: 1, a: { d: '<&>', c: [2, { z: 1, y: 2 }] } })).toString(), '{"a":{"c":[2,{"y":2,"z":1}],"d":"\\u003c\\u0026\\u003e"},"b":1}');
  assert.equal(hex(M.directSignBytes(Uint8Array.of(1, 2), Uint8Array.of(3), 'c', '5')), '0a020102' + '1201' + '03' + '1a0163' + '2005');
  assert.equal(M.chainOfCosmosId('osmosis-1'), 'osmosis'); assert.equal(M.chainOfCosmosId('evil-1'), null);
});
test('cosmos amino: signer/chain checks, plan signs sha256(sortedJSON) and packages a keplr-shaped response', () => {
  const doc = { chain_id: 'cosmoshub-4', account_number: '1', sequence: '2', fee: { gas: '1', amount: [] }, msgs: [{ type: 'cosmos-sdk/MsgSend', value: {} }], memo: '' };
  const n = M.normalizeMultiSign('signAmino', { chain: 'cosmos', chainId: 'cosmoshub-4', signer: 'cosmos1me', signDoc: doc }, { address: 'cosmos1me' });
  assert.deepEqual(n.summary.types, ['cosmos-sdk/MsgSend']);
  assert.throws(() => M.normalizeMultiSign('signAmino', { chain: 'cosmos', chainId: 'cosmoshub-4', signer: 'cosmos1other', signDoc: doc }, { address: 'cosmos1me' }), /signer/);
  assert.throws(() => M.normalizeMultiSign('signAmino', { chain: 'cosmos', chainId: 'osmosis-1', signer: 'cosmos1me', signDoc: doc }, { address: 'cosmos1me' }), /chainId/);
  const plan = M.signPlan(n, 'cosmos1me'); assert.equal(plan.scheme, 'secp256k1'); assert.equal(hex(plan.data), hex(sha256(M.aminoSignBytes(doc))));
  const r = plan.encode(signSecp(plan.data), pk, { address: 'cosmos1me' });
  assert.equal(r.signature.pub_key.value, b64(pk)); const sig = Buffer.from(r.signature.signature, 'base64'); assert.equal(sig.length, 64);
  assert.ok(secp256k1.verify(sig, plan.data, pk));
});
test('cosmos direct: body type URLs are decoded for the approval screen; arbitrary data uses ADR-36', () => {
  const any = (url) => { const u = Buffer.from(url); return Buffer.concat([Buffer.from([0x0a, u.length]), u]); };
  const body = Buffer.concat([Buffer.from([0x0a, any('/cosmos.bank.v1beta1.MsgSend').length]), any('/cosmos.bank.v1beta1.MsgSend')]);
  const n = M.normalizeMultiSign('signDirect', { chain: 'cosmos', chainId: 'cosmoshub-4', signer: 'cosmos1me', bodyBytes: b64(body), authInfoBytes: b64([1]), accountNumber: '7' }, { address: 'cosmos1me' });
  assert.deepEqual(n.summary.types, ['/cosmos.bank.v1beta1.MsgSend']);
  const a = M.normalizeMultiSign('signMessage', { chain: 'cosmos', signer: 'cosmos1me', data: 'hi' }, { address: 'cosmos1me' });
  const doc = M.signPlan(a, 'cosmos1me').encode(signSecp(M.signPlan(a, 'cosmos1me').data), pk, {}).signed;
  assert.equal(doc.msgs[0].type, 'sigverify/MsgSignData'); assert.equal(doc.msgs[0].value.signer, 'cosmos1me'); assert.equal(doc.msgs[0].value.data, b64('hi'));
});
test('sui: personal-message signing uses intent [3,0,0] + BCS(vec<u8>) + blake2b; signature is flag||sig||pubkey', async () => {
  const n = M.normalizeMultiSign('signMessage', { chain: 'sui', messageB64: b64('hello') }, { address: '0x1' });
  const plan = M.signPlan(n, '0x1'); assert.equal(plan.scheme, 'ed25519'); assert.equal(plan.data.length, 32);
  const { blake2b } = await import('@noble/hashes/blake2b'); assert.equal(hex(plan.data), hex(blake2b(Uint8Array.from([3, 0, 0, 5, ...Buffer.from('hello')]), { dkLen: 32 })));
  const r = plan.encode(ed25519.sign(plan.data, esk), epk, {}); const raw = Buffer.from(r.signature, 'base64');
  assert.equal(raw.length, 97); assert.equal(raw[0], 0); assert.ok(ed25519.verify(raw.subarray(1, 65), plan.data, raw.subarray(65))); assert.equal(r.bytes, b64('hello'));
});
test('aptos: message format, raw-transaction domain prefix, authenticator layout', () => {
  assert.equal(hex(sha3_256(new TextEncoder().encode('APTOS::RawTransaction'))), 'b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193');
  const m = M.normalizeMultiSign('signMessage', { chain: 'aptos', message: 'hi', nonce: '7', address: true, application: true, chainId: true, appName: 'app.example' }, { address: '0xabc' });
  assert.equal(m.summary.text, 'APTOS\naddress: 0xabc\napplication: app.example\nchainId: 1\nmessage: hi\nnonce: 7');
  const t = M.normalizeMultiSign('signTransaction', { chain: 'aptos', txB64: b64([9, 9]) }, { address: '0xabc' }); const plan = M.signPlan(t, '0xabc');
  assert.equal(hex(plan.data), 'b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193' + '0909');
  const sig = ed25519.sign(plan.data, esk); const auth = Buffer.from(plan.encode(sig, epk, {}).authenticator, 'base64');
  assert.equal(auth.length, 1 + 1 + 32 + 1 + 64); assert.equal(auth[0], 0); assert.equal(auth[1], 32); assert.equal(auth[34], 64);
});
test('tron: signs the txID only when it equals sha256(raw_data); messages use the TRON prefix with v=27/28; tx v=0/1', () => {
  const raw = Buffer.from('0a02abcd', 'hex'); const txID = hex(sha256(raw));
  const ok = M.normalizeMultiSign('signTransaction', { chain: 'tron', txID, rawDataHex: raw.toString('hex') }, { address: 'T' }); assert.equal(hex(M.signPlan(ok, 'T').data), txID);
  assert.throws(() => M.normalizeMultiSign('signTransaction', { chain: 'tron', txID: '00'.repeat(32), rawDataHex: raw.toString('hex') }, { address: 'T' }), /does not match/);
  const msg = M.signPlan(M.normalizeMultiSign('signMessage', { chain: 'tron', message: 'hi' }, { address: 'T' }), 'T'); const s = msg.encode(signSecp(msg.data), pk, {});
  assert.equal(s.length, 130); assert.ok(['1b', '1c'].includes(s.slice(128)));
  assert.ok(['00', '01'].includes(M.signPlan(ok, 'T').encode(signSecp(M.signPlan(ok, 'T').data), pk, {}).slice(128)));
});
test('bitcoin: BIP-137 header 39/40 and raw transaction signing refused (signPsbt is the PSBT path)', () => {
  const n = M.normalizeMultiSign('signMessage', { chain: 'bitcoin', message: 'hello' }, { address: 'bc1q' }); const plan = M.signPlan(n, 'bc1q');
  const raw = Buffer.from(plan.encode(signSecp(plan.data), pk, {}), 'base64'); assert.equal(raw.length, 65); assert.ok([39, 40].includes(raw[0]));
  assert.throws(() => M.normalizeMultiSign('signTransaction', { chain: 'bitcoin', psbt: 'x' }, { address: 'bc1q' }), /Unsupported Bitcoin method/);
});
test('validation: unknown chains/methods, oversized and malformed input are rejected', () => {
  assert.throws(() => M.normalizeMultiSign('signMessage', { chain: 'ethereum', message: 'x' }, { address: 'a' }), /Unsupported chain/);
  assert.throws(() => M.normalizeMultiSign('signMessage', { chain: 'sui', messageB64: '***' }, { address: 'a' }));
  assert.throws(() => M.normalizeMultiSign('sendTransaction', { chain: 'sui' }, { address: 'a' }));
  assert.equal(M.specFor('multi', 'signDirect').kind, 'multiSign'); assert.equal(M.specFor('multi', 'eth_sign'), null);
  assert.equal(M.parsePageRequest({ id: 'a1', ns: 'multi', method: 'connect', params: { chain: 'sui' } }).ok, true);
});

// ------------------------------------------------------------------ service flow
class MemKV { m = new Map(); async get(k) { return this.m.get(k); } async set(k, v) { this.m.set(k, JSON.parse(JSON.stringify(v))); } async remove(k) { this.m.delete(k); } }
const TRON = 'TXYZexampleAddress'; const origin = 'https://app.example';
const sender = { tabId: 1, frameId: 0, documentId: 'd', origin, topOrigin: origin, isTopFrame: true, title: 'dApp' };
function setup() {
  const perms = new M.PermissionStore(new MemKV()), pending = new M.PendingStore(new MemKV()); const log = { delivered: [], events: [], signed: [] }; let n = 0;
  const signer = {
    accounts: async () => ({ walletId: 'w1', walletName: 'W', activeAccount: 0, accounts: [{ index: 0, derivationIndex: 0, name: 'A', multi: { tron: TRON } }] }),
    accountOf: async () => null, signMessage: async () => '', signTypedData: async () => '', sendTransaction: async () => '', solSign: async () => [],
    multiKey: async (c, chain) => ({ address: TRON, publicKey: pk }),
    multiSign: async (c, chain, scheme, data) => { log.signed.push([chain, scheme, hex(data)]); return signSecp(data); },
  };
  const svc = new M.ProviderService({ policy: { families: { evm: true, solana: true, multi: true }, isSigningEvmChain: () => true, siteAddChain: true, defaultChain: 1 },  perms, pending, signer, rpc: async () => null, solRpc: async () => null, networks: { list: () => [], get: () => undefined }, vaultStatus: async () => ({ hasVault: true, unlocked: true }),
    openApproval: async () => {}, closeApprovalIfIdle: async () => {}, deliver: async (t, reqId, outcome) => { log.delivered.push({ reqId, outcome }); return true; }, emit: (...a) => log.events.push(a),
    probeChainId: async () => 1, saveCustomNetwork: async () => {}, addToken: async () => ({ ok: true }) });
  return { svc, perms, pending, log, req: (method, params) => ({ id: `r${++n}`, ns: 'multi', method, params }) };
}
test('multi connect -> sign: stored per chain, bound to account, signs only what was approved', async () => {
  const c = setup();
  assert.equal((await c.svc.handle(sender, c.req('signMessage', { chain: 'tron', message: 'x' }))).outcome.error.code, 4100); // not connected
  assert.equal((await c.svc.handle(sender, c.req('connect', { chain: 'tron' }))).done, false);
  let p = (await c.pending.list())[0]; assert.equal(p.kind, 'multiConnect');
  assert.equal((await c.svc.resolve(p.id, { approve: true })).ok, true);
  const conn = await c.perms.get(origin); assert.deepEqual(conn.namespaces, ['multi']); assert.equal(conn.others.tron.address, TRON); assert.equal(conn.others.tron.publicKey, hex(pk));
  assert.equal((await c.svc.initState(origin)).multi.tron.address, TRON);
  assert.equal((await c.svc.handle(sender, c.req('connect', { chain: 'tron' }))).outcome.result.address, TRON); // already connected: no prompt
  const raw = Buffer.from('0a02abcd', 'hex');
  await c.svc.handle(sender, c.req('signTransaction', { chain: 'tron', txID: hex(sha256(raw)), rawDataHex: raw.toString('hex') }));
  p = (await c.pending.list())[0]; assert.equal(p.kind, 'multiSign');
  await c.perms.update(origin, { others: { tron: { address: 'Tother', publicKey: hex(pk) } } }); // connection changed while pending
  assert.equal((await c.svc.resolve(p.id, { approve: true })).ok, false); assert.equal(c.log.signed.length, 0);
});
test('multi sign result reaches the page; disconnect removes only that chain', async () => {
  const c = setup(); await c.svc.handle(sender, c.req('connect', { chain: 'tron' })); await c.svc.resolve((await c.pending.list())[0].id, { approve: true });
  await c.svc.handle(sender, c.req('signMessage', { chain: 'tron', message: 'hello' })); await c.svc.resolve((await c.pending.list())[0].id, { approve: true });
  const sigHex = c.log.delivered.at(-1).outcome.result; assert.equal(sigHex.length, 130); assert.equal(c.log.signed[0][0], 'tron');
  await c.svc.handle(sender, c.req('disconnect', { chain: 'tron' })); assert.equal(await c.perms.get(origin), undefined);
});
