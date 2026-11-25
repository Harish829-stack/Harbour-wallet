// QA (KAT): the signed transactions of the ed25519 families are checked with an INDEPENDENT verifier (@noble/curves + @noble/hashes +
// @msgpack, written from each chain's published signing rules), not with wallet-core: the signature must verify over the exact bytes
// the chain defines, under the account's public key, and the signed body must carry the requested recipient/amount. Network inputs are
// mocked (same fixtures as test/send.test.js); nothing is broadcast. Complements the EVM/BTC/SOL/TRON/NEAR checks in test/send.test.js.
// TEST_PLAN: T-SIG-026 (Stellar, Tezos, Algorand, Sui).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512_256 } from '@noble/hashes/sha512';
import { blake2b } from '@noble/hashes/blake2b';
import { decode as mpDecode, encode as mpEncode } from '@msgpack/msgpack';
import { loadSend, getCore, account, otherAddress, mockFetch, rpcHandler, NOW } from '../send-helpers.mjs';

const S = await loadSend();
const core = await getCore();
const chain = (id) => S.chainById(id);
const env = (f) => ({ core, fetch: f, now: () => NOW, random: (n) => new Uint8Array(n).fill(7) });
const params = (c, from, to, amount, extra = {}) => ({ chain: c, from, to, amount, asset: { kind: 'native', decimals: c.decimals, symbol: c.symbol }, ...extra });
const J = (path, val) => [(u) => u.includes(path), typeof val === 'function' ? val : () => val];
/** RFC 4648 base32 (no padding) — Algorand addresses are base32(pubkey ‖ sha512/256(pubkey)[28:32]). */
const b32 = (str) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = []; for (const ch of str) { val = (val << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Uint8Array.from(out); };
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function build(id, mk) {
  const c = chain(id); const me = await account(c); const to = await otherAddress(c); const { f, amount, memo } = mk(c, me, to);
  const p = params(c, me.address, to, amount, memo ? { memo } : {}); const fam = S.familyOf(c);
  const q = await fam.quote(env(f), p); const built = await fam.build(env(f), p, me.key, q, 'average');
  return { c, me, to, amount, built, pub: ed25519.getPublicKey(me.key) };
}

test('T-SIG-026: Stellar — envelope signature verifies over sha256(networkId ‖ ENVELOPE_TYPE_TX ‖ tx) with the account key; hint = last 4 bytes of the key', async () => {
  const { built, pub, amount } = await build('stellar', () => ({ f: mockFetch([J('/accounts/', () => ({ sequence: '100', subentry_count: 1, num_sponsoring: 0, num_sponsored: 0, balances: [{ asset_type: 'native', balance: '50.0000000' }] })), J('/fee_stats', { last_ledger_base_fee: '100', fee_charged: { p50: '100', p90: '500' } })]), amount: 10_000_000n, memo: '777' }));
  const env_ = Buffer.from(built.raw, 'base64');
  const type = env_.readUInt32BE(0); assert.ok(type === 0 || type === 2, `ENVELOPE_TYPE_TX_V0 or _TX, got ${type}`);
  // signatures<20>: count(4) then { hint(4), opaque<64>: len(4) + 64 } — one signature at the end
  const sigBlock = env_.subarray(env_.length - 76);
  assert.equal(sigBlock.readUInt32BE(0), 1, 'one signature'); assert.deepEqual([...sigBlock.subarray(4, 8)], [...pub.subarray(28)], 'signature hint');
  assert.equal(sigBlock.readUInt32BE(8), 64);
  const sig = sigBlock.subarray(12); const tx = env_.subarray(4, env_.length - 76);
  const networkId = sha256(new TextEncoder().encode('Public Global Stellar Network ; September 2015'));
  // a v0 envelope's tx is signed as the v1 Transaction: MuxedAccount(KEY_TYPE_ED25519 = 0) ‖ the same fields
  const signedTx = type === 0 ? concat(Uint8Array.of(0, 0, 0, 0), tx) : tx;
  if (type === 0) assert.deepEqual([...tx.subarray(0, 32)], [...pub], 'v0 source account = the key');
  const payload = sha256(concat(networkId, Uint8Array.of(0, 0, 0, 2), signedTx));
  assert.equal(ed25519.verify(sig, payload, pub), true);
  const flipped = Uint8Array.from(tx); flipped[flipped.length - 20] ^= 1;
  assert.equal(ed25519.verify(sig, sha256(concat(networkId, Uint8Array.of(0, 0, 0, 2), type === 0 ? concat(Uint8Array.of(0, 0, 0, 0), flipped) : flipped)), pub), false, 'a changed body does not verify');
  assert.ok(Buffer.from(tx).includes(Buffer.from(BigInt(amount).toString(16).padStart(16, '0'), 'hex')), 'amount (int64 stroops) in the signed body');
  assert.ok(Buffer.from(tx).includes(Buffer.from('777')) || Buffer.from(tx).includes(Buffer.from([0, 0, 0, 0, 0, 0, 3, 9])), 'memo in the signed body');
});

test('T-SIG-026: Tezos — the operation is forged bytes ‖ 64-byte signature over blake2b-256(0x03 ‖ forged)', async () => {
  const { built, pub } = await build('tezos', () => ({ f: mockFetch([[(u) => u.endsWith('/head/hash'), () => core.Base58.encode(Uint8Array.from([1, 52, ...new Array(32).fill(9)]))], J('/balance', (u) => (u.includes('tz1') && false ? '0' : '5000000')), J('/counter', '77'), J('/manager_key', null)]), amount: 1_000_000n }));
  const raw = Buffer.from(built.raw, 'hex'); const forged = raw.subarray(0, raw.length - 64); const sig = raw.subarray(raw.length - 64);
  assert.deepEqual([...forged.subarray(0, 32)], new Array(32).fill(9), 'branch = the mocked head block hash');
  assert.equal(ed25519.verify(sig, blake2b(concat(Uint8Array.of(3), forged), { dkLen: 32 }), pub), true);
  assert.equal(ed25519.verify(sig, blake2b(concat(Uint8Array.of(3), forged.subarray(1)), { dkLen: 32 }), pub), false);
});

test('T-SIG-026: Algorand — msgpack { sig, txn }; sig verifies over "TX" ‖ canonical msgpack(txn); txn names the recipient, amount, fee and genesis', async () => {
  const { built, pub, amount, to } = await build('algorand', (c, me, to) => ({ f: mockFetch([J('/v2/accounts/', (u) => (u.includes(to) ? { amount: 500000 } : { amount: 5000000, 'min-balance': 100000 })), J('/v2/transactions/params', { fee: 0, 'min-fee': 1000, 'genesis-id': 'mainnet-v1.0', 'genesis-hash': 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=', 'last-round': 30000000 })]), amount: 1_000_000n, memo: 'note' }));
  const raw = Buffer.from(built.raw, 'base64'); const st = mpDecode(raw);
  assert.deepEqual(Object.keys(st).sort(), ['sig', 'txn']);
  const txn = st.txn; const keys = Object.keys(txn); assert.deepEqual(keys, [...keys].sort(), 'canonical: keys sorted');
  const msg = concat(new TextEncoder().encode('TX'), mpEncode(txn));
  assert.ok(raw.includes(Buffer.from(mpEncode(txn))), 'our canonical re-encoding equals the signed bytes');
  assert.equal(ed25519.verify(st.sig, msg, pub), true);
  assert.equal(BigInt(txn.amt), amount); assert.equal(txn.type, 'pay'); assert.equal(txn.gen, 'mainnet-v1.0');
  assert.equal(Buffer.from(txn.gh).toString('base64'), 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=');
  assert.deepEqual([...txn.snd], [...pub], 'sender = account public key');
  const rb = b32(to); assert.equal(rb.length, 36);
  assert.deepEqual([...rb.subarray(32)], [...sha512_256(rb.subarray(0, 32)).subarray(28)], 'recipient checksum (independent decode)');
  assert.deepEqual([...txn.rcv], [...rb.subarray(0, 32)], 'receiver');
  assert.equal(new TextDecoder().decode(txn.note), 'note'); assert.ok(Number(txn.fee) >= 1000);
});

test('T-SIG-026: Sui — serialized signature = 0x00 ‖ sig ‖ pubkey, verifying over blake2b-256(intent [0,0,0] ‖ tx bytes)', async () => {
  const { built, pub } = await build('sui', () => ({ f: mockFetch([rpcHandler({ suix_getCoins: { data: [{ coinObjectId: '0x' + 'ab'.repeat(32), version: '12', digest: '5Y8sXtvPFVpFRiKJhdeRUsDYPKbUHKEYK1vwJ8TFhZs3', balance: '3000000000' }], hasNextPage: false }, suix_getReferenceGasPrice: '750' })]), amount: 10n ** 8n }));
  const j = JSON.parse(built.raw); const tx = Buffer.from(j.tx, 'base64'); const s = Buffer.from(j.sig, 'base64');
  assert.equal(s.length, 97); assert.equal(s[0], 0, 'ed25519 flag'); assert.deepEqual([...s.subarray(65)], [...pub]);
  const digest = blake2b(concat(Uint8Array.of(0, 0, 0), tx), { dkLen: 32 });
  assert.equal(ed25519.verify(s.subarray(1, 65), digest, pub), true);
  assert.ok(tx.includes(Buffer.from('ab'.repeat(32), 'hex')), 'gas coin object referenced');
});

// ---- Cosmos SDK (SIGN_MODE_DIRECT): TxRaw{1 body, 2 auth_info, 3 signatures}; signature = secp256k1 over sha256(SignDoc{1 body,
// 2 auth_info, 3 chain_id, 4 account_number}). A minimal protobuf reader/writer is written here (no generated code).
const readProto = (buf) => { const out = []; let i = 0; const varint = () => { let x = 0n, s = 0n; for (;;) { const b = buf[i++]; x |= BigInt(b & 0x7f) << s; s += 7n; if (!(b & 0x80)) return x; } };
  while (i < buf.length) { const key = Number(varint()); const field = key >> 3, wt = key & 7; if (wt === 2) { const n = Number(varint()); out.push({ field, bytes: buf.subarray(i, i + n) }); i += n; } else if (wt === 0) out.push({ field, varint: varint() }); else throw new Error(`wire type ${wt}`); } return out; };
const pv = (n) => { const o = []; let x = BigInt(n); do { let b = Number(x & 0x7fn); x >>= 7n; if (x) b |= 0x80; o.push(b); } while (x); return Uint8Array.from(o); };
const pBytes = (field, b) => concat(pv((field << 3) | 2), pv(b.length), b);
test('T-SIG-026: Cosmos — TxRaw signature verifies (secp256k1) over sha256(SignDoc) with the node-reported chain id and account number', async () => {
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const COS = [
    [(u) => u.includes('/cosmos/auth/v1beta1/accounts/'), () => ({ account: { '@type': '/cosmos.auth.v1beta1.BaseAccount', address: 'x', account_number: '1234', sequence: '9' } })],
    [(u) => u.includes('/cosmos/bank/v1beta1/balances/'), () => ({ balance: { denom: 'x', amount: '10000000' } })],
    [(u) => u.endsWith('/node_info'), () => ({ default_node_info: { network: 'cosmoshub-4' } })],
    [(u) => u.endsWith('/node/v1beta1/config'), () => ({ minimum_gas_price: '0.0025uatom' })],
  ];
  const c = chain('cosmos'); const me = await account(c); const to = await otherAddress(c);
  const p = params(c, me.address, to, 1_000_000n, { memo: 'qa' }); const fam = S.familyOf(c);
  const q = await fam.quote(env(mockFetch(COS)), p); const built = await fam.build(env(mockFetch(COS)), p, me.key, q, 'average');
  const txRaw = readProto(Buffer.from(JSON.parse(built.raw).tx_bytes, 'base64'));
  const body = txRaw.find((x) => x.field === 1).bytes, auth = txRaw.find((x) => x.field === 2).bytes, sigs = txRaw.filter((x) => x.field === 3);
  assert.equal(sigs.length, 1); assert.equal(sigs[0].bytes.length, 64);
  const signDoc = concat(pBytes(1, body), pBytes(2, auth), pBytes(3, new TextEncoder().encode('cosmoshub-4')), pv((4 << 3) | 0), pv(1234));
  const pub = secp256k1.getPublicKey(me.key, true);
  assert.equal(secp256k1.verify(sigs[0].bytes, sha256(signDoc), pub, { prehash: false, lowS: true }), true, 'signature over the SignDoc');
  const wrongChain = concat(pBytes(1, body), pBytes(2, auth), pBytes(3, new TextEncoder().encode('cosmoshub-3')), pv(32), pv(1234));
  assert.equal(secp256k1.verify(sigs[0].bytes, sha256(wrongChain), pub, { prehash: false }), false, 'bound to the chain id');
  assert.ok(Buffer.from(auth).includes(Buffer.from(pub)), 'auth_info carries the account public key');
  assert.ok(Buffer.from(auth).includes(Buffer.from([0x18, 0x09])), 'sequence 9 from the node');
  for (const s of [to, 'uatom', 'qa', '1000000']) assert.ok(Buffer.from(body).includes(Buffer.from(s)), s);
});
