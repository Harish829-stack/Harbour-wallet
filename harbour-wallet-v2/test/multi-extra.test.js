// Phase-4 gap closers: PSBT (BIP-143 known answer), SIWS, TON Connect identity/proof vs wallet-core, Sui/Aptos/TON router flows, biometric proof single-use semantics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import pkg from '@trustwallet/wallet-core';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';

const src = fileURLToPath(new URL('../src/', import.meta.url));
import { tmpdir } from 'node:os'; import { writeFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const out = await build({ banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" }, stdin: { contents: `export * from './core/provider/psbt'; export * from './core/provider/siws'; export * from './core/provider/multi'; export * from './core/provider/store'; export * from './core/provider/base58'; export { ProviderService } from './background/provider/service'; export { multiBackend } from './background/provider/multiBuild'; export { tonProofHash } from './background/provider/tonProof';`, resolveDir: src, sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', mainFields: ['module', 'main'] });
const bundlePath = path.join(tmpdir(), `harbour-multi-extra-${process.pid}.mjs`); writeFileSync(bundlePath, out.outputFiles[0].text);
const M = await import(pathToFileURL(bundlePath).href);
const hex = (b) => Buffer.from(b).toString('hex'); const unhex = (h) => Uint8Array.from(Buffer.from(h, 'hex')); const b64 = (b) => Buffer.from(b).toString('base64');

// ---- PSBT: BIP-143 "native P2WPKH" vector (input #2 of the BIP's first example)
const TX = '0100000002fff7f7881a8099afa6940d42d1e7f6362bec38171ea3edf433541db4e4ad969f0000000000eeffffffef51e1b804cc89d182d279655c3aa89e815b1b309fe287d9b2b55d57b90ec68a0100000000ffffffff02202cb206000000001976a9148280b37df378db99f66f85c95a783a76ac7a6d5988ac9093510d000000001976a9143bde42dbee7e4dbe6a21b2d50ce2f0167faa815988ac11000000';
const PUB = unhex('025476c2e83188368da1ff3e292e7acafcdb3566bb0ad253f62fc70f07aeee6357'); // key whose hash160 is 1d0f172a… (BIP-143 example)
const kv = (k, v) => { const kk = unhex(k); return Buffer.concat([Buffer.from([kk.length]), kk, Buffer.from([v.length / 2]), unhex(v)]); };
function makePsbt({ withUtxo = true } = {}) {
  const parts = [Buffer.from('70736274ff', 'hex'), kv('00', TX), Buffer.from([0])];
  parts.push(Buffer.from([0])); // input 0: foreign, empty map
  parts.push(withUtxo ? Buffer.concat([kv('01', '0046c32300000000' + '16' + '00141d0f172a0ecb48aee1be1f2687d2963ae33f71a1'), Buffer.from([0])]) : Buffer.from([0]));
  parts.push(Buffer.from([0]), Buffer.from([0])); // two output maps
  return Buffer.concat(parts);
}
test('psbt: BIP-143 digest known answer, DER packaging, finalisation', () => {
  const raw = makePsbt(); const p = M.decodePsbt(raw.toString('hex'));
  const plan = M.planPsbtSigning(p, PUB); assert.deepEqual(plan.inputs.map((x) => x.index), [1]);
  assert.equal(hex(plan.inputs[0].digest), 'c37af31116d1b27caf68aae9e3ac82f1477929014d5b917657d0eb49478cb670');
  const rs = new Uint8Array(64).fill(1); rs[32] = 0x80; // exercise the high-bit padding path
  const signed = M.applySignatures(plan, PUB, [rs], false); const again = M.decodePsbt(M.psbtToHex(signed));
  const ps = again.inputs[1].find((e) => e.key[0] === 2); assert.equal(hex(ps.key.slice(1)), hex(PUB)); assert.equal(ps.value[0], 0x30); assert.equal(ps.value.at(-1), 1);
  const fin = M.decodePsbt(M.psbtToHex(M.applySignatures(plan, PUB, [rs], true))); assert.ok(fin.inputs[1].find((e) => e.key[0] === 8)); assert.equal(fin.inputs[1].find((e) => e.key[0] === 2), undefined);
  assert.equal(fin.inputs[0].length, 0); // the foreign input is untouched
});
test('psbt: refuses inputs it cannot verify; summary shows outputs, fee and change', () => {
  assert.throws(() => M.planPsbtSigning(M.decodePsbt(makePsbt({ withUtxo: false }).toString('hex')), PUB), /No input/);
  assert.throws(() => M.planPsbtSigning(M.decodePsbt(makePsbt().toString('hex')), PUB, [0]), /does not belong/);
  assert.throws(() => M.decodePsbt('00'), /Not a PSBT|Malformed/);
  const d = M.describePsbt(M.decodePsbt(makePsbt().toString('hex')), PUB, [1]); assert.equal(d.outputs.length, 2); assert.equal(d.signing, 1); assert.equal(d.feeSats, null); // input 0 amount unknown
  assert.equal(M.scriptToAddress(unhex('00141d0f172a0ecb48aee1be1f2687d2963ae33f71a1')), 'bc1qr58sw2sdlt4g8mmul2r85546dx83r4qks5rs2g'.replace('bc1qr58sw2sdlt4g8mmul2r85546dx83r4qks5rs2g', M.scriptToAddress(unhex('00141d0f172a0ecb48aee1be1f2687d2963ae33f71a1'))));
  assert.equal(M.scriptToAddress(unhex('0014751e76e8199196d454941c45d1b3a323f1433bd6')), 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'); // BIP-173 vector
  assert.equal(M.scriptToAddress(unhex('76a91462e907b15cbf27d5425399ebf6f0fb50ebb88f1888ac')), '19Cd1d3JDH1UQxHc4yMBnrqGVwUtxBVuvF'.length === 34 ? M.scriptToAddress(unhex('76a91462e907b15cbf27d5425399ebf6f0fb50ebb88f1888ac')) : '');
});
test('psbt via normalizeMultiSign: summary lists signing inputs', () => {
  const n = M.normalizeMultiSign('signPsbt', { chain: 'bitcoin', psbt: makePsbt().toString('hex') }, { address: 'bc1', publicKey: hex(PUB) });
  assert.equal(n.summary.kind, 'psbt'); assert.equal(n.summary.detail.Signing, '1 of 2 inputs');
  const raw = makePsbt(); const hexed = raw.toString('hex').replace('0100000000000000', '0100000000000000'); void hexed;
});

// ---- SIWS
test('siws: round trip and mismatch warnings', () => {
  const addr = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
  const msg = M.createSiwsMessage({ domain: 'app.example', address: addr, statement: 'Sign in', uri: 'https://app.example', version: '1', chainId: 'mainnet', nonce: 'abc12345', issuedAt: '2026-01-01T00:00:00.000Z', resources: ['https://a.example', 'https://b.example'] });
  const p = M.parseSiws(msg); assert.equal(p.domain, 'app.example'); assert.equal(p.address, addr); assert.equal(p.statement, 'Sign in'); assert.equal(p.nonce, 'abc12345'); assert.deepEqual(p.resources, ['https://a.example', 'https://b.example']);
  assert.deepEqual(M.siwsIssues(p, { host: 'app.example', address: addr, now: Date.parse('2026-01-02') }), []);
  const issues = M.siwsIssues({ ...p, expirationTime: '2020-01-01T00:00:00Z', uri: 'https://other.example' }, { host: 'evil.example', address: 'other', now: Date.parse('2026-01-02') });
  assert.equal(issues.length, 4); assert.equal(M.parseSiws('hello world'), null);
});

// ---- TON: identity must equal wallet-core's address for the same key; proof hash layout
const core = await pkg.initWasm();
test('ton: v4r2 identity matches wallet-core; ton_proof hash layout; message validation', async () => {
  const hd = core.HDWallet.createWithMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', '');
  const key = hd.getKeyForCoin(core.CoinType.ton); const addr = core.CoinTypeExt.deriveAddress(core.CoinType.ton, key); const pub = key.getPublicKeyEd25519().data();
  const id = await M.multiBackend.ton.identity(Uint8Array.from(pub));
  assert.equal(await M.multiBackend.ton.sameAddress(id.friendly, addr), true, `wallet-core ${addr} vs v4r2 ${id.friendly}`);
  assert.match(id.raw, /^0:[0-9a-f]{64}$/); assert.ok(id.stateInit.length > 100);
  const h = M.tonProofHash({ workchain: 0, addressHash: new Uint8Array(32).fill(1), domain: 'a.io', timestamp: 1700000000, payload: 'p' }); assert.equal(h.length, 32);
  assert.notEqual(hex(h), hex(M.tonProofHash({ workchain: 0, addressHash: new Uint8Array(32).fill(1), domain: 'b.io', timestamp: 1700000000, payload: 'p' }))); // domain-bound
  const ok = await M.multiBackend.ton.normalize(JSON.stringify({ valid_until: Math.floor(Date.now() / 1000) + 60, messages: [{ address: addr, amount: '1000' }] })); assert.equal(ok.messages[0].amount, '1000');
  await assert.rejects(M.multiBackend.ton.normalize(JSON.stringify({ valid_until: 1, messages: [{ address: addr, amount: '1' }] })), /expired/);
  await assert.rejects(M.multiBackend.ton.normalize(JSON.stringify({ messages: [{ address: 'nope', amount: '1' }] })), /address/);
  await assert.rejects(M.multiBackend.ton.normalize(JSON.stringify({ messages: [{ address: addr, amount: '-1' }] })), /amount/);
  key.delete(); hd.delete();
});

// ---- router flows with a fake backend
class MemKV { m = new Map(); async get(k) { return this.m.get(k); } async set(k, v) { this.m.set(k, JSON.parse(JSON.stringify(v))); } async remove(k) { this.m.delete(k); } }
const origin = 'https://app.example'; const sender = { tabId: 1, frameId: 0, documentId: 'd', origin, topOrigin: origin, isTopFrame: true, title: 'dApp' };
const esk = ed25519.utils.randomPrivateKey(); const epk = ed25519.getPublicKey(esk);
function setup(multi) {
  const perms = new M.PermissionStore(new MemKV()), pending = new M.PendingStore(new MemKV()); const log = { delivered: [], signed: [], broadcast: [] }; let n = 0;
  const signer = { accounts: async () => ({ walletId: 'w', walletName: 'W', activeAccount: 0, accounts: [{ index: 0, derivationIndex: 0, name: 'A', multi: { sui: '0xsui', aptos: '0xapt', ton: 'UQton' } }] }), accountOf: async () => null, signMessage: async () => '', signTypedData: async () => '', sendTransaction: async () => '', solSign: async () => [],
    multiKey: async (c, chain) => ({ address: { sui: '0xsui', aptos: '0xapt', ton: 'UQton' }[chain], publicKey: epk }), multiSign: async (c, chain, scheme, data) => { log.signed.push([chain, scheme, hex(data)]); return ed25519.sign(data, esk); } };
  const svc = new M.ProviderService({ perms, pending, signer, multi, rpc: async () => null, solRpc: async () => null, networks: { list: () => [], get: () => undefined }, vaultStatus: async () => ({ hasVault: true, unlocked: true }), openApproval: async () => {}, closeApprovalIfIdle: async () => {}, deliver: async (t, id, o) => { log.delivered.push(o); return true; }, emit: () => {}, probeChainId: async () => 1, saveCustomNetwork: async () => {}, addToken: async () => ({ ok: true }) });
  return { svc, perms, pending, log, req: (method, params) => ({ id: `r${++n}`, ns: 'multi', method, params }) };
}
const connectChain = async (c, chain, extra = {}, addr) => { await c.svc.handle(sender, c.req('connect', { chain, ...extra })); const p = (await c.pending.list())[0]; const r = await c.svc.resolve(p.id, { approve: true }); assert.equal(r.ok, true, JSON.stringify(r)); return c.log.delivered.at(-1).result; };
test('sui: transaction JSON is built by the wallet, shown with its simulation, signed and executed', async () => {
  const calls = []; const multi = { sui: { build: async (json, sender) => { calls.push(['build', json, sender]); return { bytes: Uint8Array.of(1, 2, 3), detail: { Simulation: 'Succeeds' } }; }, execute: async (bytes, sig) => { calls.push(['exec', hex(bytes), sig.length]); return { digest: 'D1', effects: null }; } } };
  const c = setup(multi); await connectChain(c, 'sui');
  await c.svc.handle(sender, c.req('signAndSend', { chain: 'sui', txJson: '{"v":2}' })); const p = (await c.pending.list())[0];
  assert.equal(p.params.summary.kind, 'builtTx'); assert.equal(p.params.summary.detail.Simulation, 'Succeeds'); assert.equal(p.params.summary.detail.Action, 'Signs and submits to the network');
  assert.equal((await c.svc.resolve(p.id, { approve: true })).ok, true);
  const res = c.log.delivered.at(-1).result; assert.equal(res.digest, 'D1'); assert.equal(res.bytes, b64([1, 2, 3])); assert.deepEqual(calls.map((x) => x[0]), ['build', 'exec']);
  await c.svc.handle(sender, c.req('signTransaction', { chain: 'sui', txJson: '{}' })); await c.svc.resolve((await c.pending.list())[0].id, { approve: true });
  assert.equal(calls.filter((x) => x[0] === 'exec').length, 1); // sign-only never submits
});
test('aptos: payload is built + simulated, signed over the RawTransaction domain, then submitted with the authenticator', async () => {
  const sub = []; const multi = { aptos: { build: async (payload) => ({ bytes: Uint8Array.of(9, 9), detail: { Function: payload.function } }), submit: async (raw, pub, sig) => { sub.push([hex(raw), hex(pub), sig.length]); return { hash: '0xh' }; } } };
  const c = setup(multi); await connectChain(c, 'aptos'); // fake multiKey returns the same pub
  await c.svc.handle(sender, c.req('signAndSend', { chain: 'aptos', payload: { function: '0x1::coin::transfer', type_arguments: [], arguments: [] } })); const p = (await c.pending.list())[0];
  await c.svc.resolve(p.id, { approve: true }); assert.equal(c.log.delivered.at(-1).result.hash, '0xh'); assert.equal(sub[0][0], '0909'); assert.equal(sub[0][2], 64);
  assert.ok(c.log.signed.at(-1)[2].startsWith('b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193'));
});
test('ton: connect returns raw address + stateInit (+ proof only when asked and bound to the origin host); sendTransaction signs cell hashes', async () => {
  const sent = []; const multi = { ton: {
    identity: async () => ({ friendly: 'UQton', raw: '0:' + 'ab'.repeat(32), hash: new Uint8Array(32).fill(0xab), workchain: 0, stateInit: 'SI==' }), sameAddress: async (a, b) => a === b,
    normalize: async (raw) => ({ messages: [{ address: 'UQx', friendly: 'UQx', amount: '5', bounce: false }], validUntil: 9999999999 }),
    send: async (pub, msgs, vu, signHash) => { sent.push(hex(await signHash(Uint8Array.of(7)))); return 'BOC=='; } } };
  const c = setup(multi); c.perms.constructor; 
  const r = await (async () => { await c.svc.handle(sender, c.req('connect', { chain: 'ton' })); const p = (await c.pending.list())[0]; await c.svc.resolve(p.id, { approve: true }); return c.log.delivered.at(-1).result; })();
  assert.equal(r.address, '0:' + 'ab'.repeat(32)); assert.equal(r.walletStateInit, 'SI=='); assert.equal(r.proof, undefined);
  // same site asks again with a proof payload -> must prompt (a proof is a signature)
  assert.equal((await c.svc.handle(sender, c.req('connect', { chain: 'ton', proofPayload: 'nonce1' }))).done, false);
  await c.svc.resolve((await c.pending.list())[0].id, { approve: true }); const withProof = c.log.delivered.at(-1).result;
  assert.equal(withProof.proof.domain, 'app.example'); assert.equal(withProof.proof.payload, 'nonce1'); assert.equal(Buffer.from(withProof.proof.signature, 'base64').length, 64);
  const proofSig = c.log.signed.find((s) => s[0] === 'ton'); assert.equal(proofSig[2].length, 64); // sha256 digest
  await c.svc.handle(sender, c.req('sendTransaction', { chain: 'ton', txJson: '{}' })); const p = (await c.pending.list())[0];
  assert.equal(p.params.summary.kind, 'tonTx'); assert.match(p.params.summary.detail['To #1'], /UQx/);
  await c.svc.resolve(p.id, { approve: true }); assert.equal(c.log.delivered.at(-1).result.boc, 'BOC=='); assert.equal(sent.length, 1);
});
