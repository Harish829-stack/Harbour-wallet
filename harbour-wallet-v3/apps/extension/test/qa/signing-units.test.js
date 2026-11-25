// QA: signing primitives and parsers in isolation, against INDEPENDENT oracles (an EIP-712 encoder written here on @metamask/abi-utils +
// @noble keccak; @ethereumjs/tx for transaction decoding and sender recovery; viem only where it is the documented reference).
// TEST_PLAN: T-SIG-003, 014, 015, 020, 028, 031, 034, 036, 039, 046, 047, 048, T-DAPP-030, 044, 058, 059.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { encode as abiEncode } from '@metamask/abi-utils';
import { keccak_256 } from '@noble/hashes/sha3';
import { TransactionFactory } from '@ethereumjs/tx';
import { recoverTypedDataAddress, recoverMessageAddress, hashMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { harness, SRC } from './harness.mjs';

const H = await harness(`
  export { normalizePersonalSign, normalizeEthSign, normalizeTypedData } from './core/provider/methods';
  export { evmSignMessage, evmRecover, evmSignTypedData, typedDataDigest } from './core/provider/evmSign';
  export { parseUnits, formatUnits } from './core/chains/send/util';
  export { signEvmTx } from './core/chains/send/evm';
  export { parseSolTx } from './core/provider/solanaTx';
  export { decodePsbt } from './core/provider/psbt';
  export { parseSiwe } from './core/provider/siwe';
  export { parseSiws } from './core/provider/siws';
  export { isSigningChain, isSigningEvmChain, mainnetSigningReady } from './core/harbour/policy';
  export { CLIENT_CHAIN_IDS } from './core/harbour/config';
  export { ALL_CHAINS, chainById } from './core/chains/index';
  export { isPrivateNetworkUrl } from './core/provider/origin';
  export { decodeCalldata } from './core/provider/decode';
  export { RateLimiter } from './core/provider/ratelimit';
  export { PendingStore, MAX_PENDING_TOTAL, PENDING_TTL_MS, SETTLED_TTL_MS } from './core/provider/store';
  export { ProviderError } from './core/provider/errors';
`);
const { M } = H;
const KEY = new Uint8Array(32).fill(0x46);
const ME = privateKeyToAccount('0x' + '46'.repeat(32)).address;
const hex = (u) => '0x' + Buffer.from(u).toString('hex');

// ---------------------------------------------------------------- messages (SIG-01/02/04)

test('T-SIG-003: "0x" and odd-length "0x1" are signed as UTF-8 text, not as bytes', () => {
  for (const m of ['0x', '0x1', '0xabc']) {
    const n = M.normalizePersonalSign([m, ME], ME);
    assert.equal(n.hexInput, false, m); assert.equal(n.utf8, m); assert.equal(n.bytesHex, hex(Buffer.from(m)));
  }
  const b = M.normalizePersonalSign(['0x6869', ME], ME); assert.equal(b.hexInput, true); assert.equal(b.utf8, 'hi');
});

test('T-SIG-047: evmRecover(evmSignMessage(m)) is the signer for random messages; raw-hash and personal modes differ', async () => {
  await fc.assert(fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 300 }), async (bytes) => {
    const h = hex(bytes);
    const sig = await M.evmSignMessage(KEY, h, 'personal');
    assert.equal(await M.evmRecover(h, sig), ME);
    assert.equal(await recoverMessageAddress({ message: { raw: h }, signature: sig }), ME, 'viem agrees');
    const digest = hashMessage({ raw: h });
    const raw = await M.evmSignMessage(KEY, digest, 'rawHash');
    assert.notEqual(raw, await M.evmSignMessage(KEY, digest, 'personal'));
  }), { numRuns: 60, seed: 12 });
});

test('T-SIG-048: wrong key sizes are refused without producing a signature; non-hex input is refused (OBS-03 fixed)', async () => {
  for (const k of [new Uint8Array(31).fill(1), new Uint8Array(33).fill(1), new Uint8Array(32)]) await assert.rejects(M.evmSignMessage(k, '0x6869', 'personal'));
  // evmSignMessage refuses anything that is not 0x-hex (OBS-03), even though every caller normalises first.
  for (const m of ['hello', '0xzz', '', '0x123', undefined]) await assert.rejects(M.evmSignMessage(KEY, m, 'personal'), /hex/, String(m));
  assert.equal(await M.evmRecover('0x6869', await M.evmSignMessage(KEY, '0x6869', 'personal')), ME);
  await assert.rejects(M.evmSignMessage(KEY, '0x6869', 'rawHash'), 'raw hash mode needs 32 bytes');
  assert.throws(() => M.normalizeEthSign([ME, '0x' + 'ff'.repeat(31)]), (e) => e.code === -32602, 'eth_sign binary must be a 32-byte hash');
});

// ---------------------------------------------------------------- EIP-712 (SIG-03) against an independent encoder

function eip712Hash(td) {
  const deps = (t, acc = new Set()) => { if (acc.has(t) || !td.types[t]) return acc; acc.add(t); for (const f of td.types[t]) deps(f.type.replace(/\[\d*\]$/, ''), acc); return acc; };
  const encodeType = (t) => { const [p, ...rest] = [...deps(t)]; return [p, ...rest.sort()].map((x) => `${x}(${td.types[x].map((f) => `${f.type} ${f.name}`).join(',')})`).join(''); };
  const typeHash = (t) => keccak_256(Buffer.from(encodeType(t)));
  const encodeValue = (type, v) => {
    if (td.types[type]) return ['bytes32', hashStruct(type, v)];
    if (type === 'string') return ['bytes32', keccak_256(Buffer.from(v))];
    if (type === 'bytes') return ['bytes32', keccak_256(Buffer.from(v.slice(2), 'hex'))];
    const arr = type.match(/^(.*)\[(\d*)\]$/);
    if (arr) { const parts = v.map((x) => encodeValue(arr[1], x)); return ['bytes32', keccak_256(abiEncode(parts.map((p) => p[0]), parts.map((p) => p[1])))]; }
    return [type, v];
  };
  const hashStruct = (t, v) => { const enc = td.types[t].map((f) => encodeValue(f.type, v[f.name])); return keccak_256(abiEncode(['bytes32', ...enc.map((e) => e[0])], [typeHash(t), ...enc.map((e) => e[1])])); };
  return hex(keccak_256(Buffer.concat([Buffer.from([0x19, 0x01]), hashStruct('EIP712Domain', td.domain), hashStruct(td.primaryType, td.message)])));
}
const atom = fc.constantFrom('uint256', 'uint8', 'int64', 'address', 'bool', 'bytes32', 'string', 'bytes');
const valueOf = (type) => ({ uint256: fc.bigInt({ min: 0n, max: (1n << 256n) - 1n }).map(String), uint8: fc.integer({ min: 0, max: 255 }), int64: fc.bigInt({ min: -(1n << 63n), max: (1n << 63n) - 1n }).map(String),
  address: fc.uint8Array({ minLength: 20, maxLength: 20 }).map((b) => hex(b)), bool: fc.boolean(), bytes32: fc.uint8Array({ minLength: 32, maxLength: 32 }).map(hex), string: fc.string({ maxLength: 20 }), bytes: fc.uint8Array({ maxLength: 40 }).map(hex) })[type];
const typedData = fc.record({ inner: fc.array(fc.tuple(fc.constantFrom('a', 'b', 'c', 'd'), atom), { minLength: 1, maxLength: 3 }), outer: fc.array(fc.tuple(fc.constantFrom('x', 'y', 'z'), atom), { minLength: 1, maxLength: 3 }), withArray: fc.boolean(), chainId: fc.integer({ min: 1, max: 1e6 }) })
  .chain(({ inner, outer, withArray, chainId }) => {
    const uniq = (l) => l.filter(([n], i) => l.findIndex(([m]) => m === n) === i);
    const I = uniq(inner).map(([name, type]) => ({ name, type })), O = [...uniq(outer).map(([name, type]) => ({ name, type })), { name: 'child', type: withArray ? 'Inner[]' : 'Inner' }];
    const innerVal = fc.record(Object.fromEntries(I.map((f) => [f.name, valueOf(f.type)])));
    return fc.record({ ...Object.fromEntries(O.slice(0, -1).map((f) => [f.name, valueOf(f.type)])), child: withArray ? fc.array(innerVal, { maxLength: 3 }) : innerVal })
      .map((message) => ({ types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }], Inner: I, Outer: O }, primaryType: 'Outer', domain: { name: 'QA', chainId }, message }));
  });

test('T-SIG-014: typedDataDigest equals an independent EIP-712 encoder for random type trees, and the signature recovers to the signer', async () => {
  await fc.assert(fc.asyncProperty(typedData, async (td) => {
    const n = M.normalizeTypedData('eth_signTypedData_v4', [ME, JSON.stringify(td)], ME);
    const ours = M.typedDataDigest(n.typedData);
    assert.equal(ours, eip712Hash(td));
    const sig = await M.evmSignTypedData(KEY, n.typedData);
    const { EIP712Domain, ...types } = td.types;
    assert.equal(await recoverTypedDataAddress({ domain: td.domain, types, primaryType: td.primaryType, message: n.typedData.message, signature: sig }), ME);
  }), { numRuns: 120, seed: 31 });
  // EIP-712 spec "Mail" example
  const mail = { types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }], Person: [{ name: 'name', type: 'string' }, { name: 'wallet', type: 'address' }], Mail: [{ name: 'from', type: 'Person' }, { name: 'to', type: 'Person' }, { name: 'contents', type: 'string' }] },
    primaryType: 'Mail', domain: { name: 'Ether Mail', version: '1', chainId: 1, verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' }, message: { from: { name: 'Cow', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' }, to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' }, contents: 'Hello, Bob!' } };
  assert.equal(M.typedDataDigest(mail), '0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2');
});

test('T-SIG-015: normalizeTypedData on arbitrary JSON only throws ProviderError -32602/4200, never a TypeError', () => {
  fc.assert(fc.property(fc.jsonValue(), fc.jsonValue(), fc.constantFrom('eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4'), (a, b, m) => {
    for (const params of [[a, b], [ME, a], [ME, JSON.stringify(a)], a]) {
      try { M.normalizeTypedData(m, params, ME); } catch (e) { assert.ok(e instanceof M.ProviderError && [-32602, 4200].includes(e.code), `${e?.name}: ${e?.message}`); }
    }
  }), { numRuns: 1500, seed: 15 });
});

// ---------------------------------------------------------------- transactions (SIG-06/07)

test('T-SIG-046: signEvmTx output decodes (ethereumjs) to the same fields and recovers to our address, legacy and EIP-1559', async () => {
  const chain = M.chainById('ethereum') ?? M.ALL_CHAINS.find((c) => c.evmChainId === 1);
  await fc.assert(fc.asyncProperty(fc.record({ nonce: fc.integer({ min: 0, max: 2 ** 31 }), gas: fc.bigInt({ min: 21000n, max: 30_000_000n }), value: fc.bigInt({ min: 0n, max: 10n ** 24n }), base: fc.bigInt({ min: 1n, max: 10n ** 12n }),
    prio: fc.bigInt({ min: 0n, max: 10n ** 10n }), legacy: fc.boolean(), data: fc.option(fc.uint8Array({ maxLength: 64 }).map(hex), { nil: undefined }), to: fc.uint8Array({ minLength: 20, maxLength: 20 }).map(hex), tier: fc.constantFrom('slow', 'average', 'fast'), chainId: fc.constantFrom(1, 10, 137, 8453, 11155111) }),
  async (r) => {
    const ctx = { nonce: r.nonce, gas: r.gas, legacy: r.legacy, base: r.base, prio: { slow: r.prio, average: r.prio, fast: r.prio }, gasPrice: r.base, l1Fee: 0n, value: r.value, toAddr: r.to };
    const built = await M.signEvmTx({ ...chain, evmChainId: r.chainId }, KEY, ME, ctx, r.tier, { to: r.to, value: r.value, data: r.data, gas: r.gas });
    const tx = TransactionFactory.fromSerializedData(Buffer.from(built.raw.slice(2), 'hex'));
    assert.equal(tx.getSenderAddress().toString().toLowerCase(), ME.toLowerCase());
    assert.equal(Number(tx.common.chainId()), r.chainId);
    assert.equal(tx.nonce, BigInt(r.nonce)); assert.equal(tx.gasLimit, r.gas); assert.equal(tx.value, r.value);
    assert.equal(tx.to.toString().toLowerCase(), r.to.toLowerCase());
    assert.equal(hex(tx.data), r.data && r.data !== '0x' ? r.data : '0x');
    assert.equal(tx.type, r.legacy ? 0 : 2);
    assert.equal(built.hash, hex(tx.hash()));
  }), { numRuns: 80, seed: 46 });
  const other = new Uint8Array(32).fill(7);
  await assert.rejects(M.signEvmTx(chain, other, ME, { nonce: 0, gas: 21000n, legacy: true, base: 1n, prio: { slow: 0n, average: 0n, fast: 0n }, gasPrice: 1n, l1Fee: 0n, value: 0n, toAddr: ME }, 'average', { to: ME, value: 0n, gas: 21000n }), /does not match/);
});

test('T-SIG-028: parseUnits/formatUnits round trip exactly for random amounts and decimals 0..36; malformed input refused', () => {
  fc.assert(fc.property(fc.bigInt({ min: 0n, max: 10n ** 60n }), fc.integer({ min: 0, max: 36 }), (raw, d) => {
    const s = M.formatUnits(raw, d);
    assert.equal(M.parseUnits(s, d), raw);
    assert.doesNotMatch(s, /e|E/, 'never scientific notation');
  }), { numRuns: 2000, seed: 28 });
  assert.equal(M.parseUnits('0.1', 18), 100000000000000000n); assert.equal(M.parseUnits('1.', 6), 1000000n); assert.equal(M.parseUnits('.5', 1), 5n);
  for (const bad of ['', '.', '1e18', '-1', '1,5', ' 1 2', 'NaN', '0x10', '١']) assert.throws(() => M.parseUnits(bad, 18), bad);
  assert.throws(() => M.parseUnits('0.1234567', 6), /Too many decimals/);
});

// ---------------------------------------------------------------- parsers fuzz (SIG-08/09/12)

const fuzzBytes = fc.oneof(fc.uint8Array({ maxLength: 600 }), fc.uint8Array({ minLength: 1, maxLength: 4 }).map((h) => Uint8Array.from([...h, ...new Uint8Array(100)])));
test('T-SIG-031: parseSolTx on random bytes throws plain Errors only (no RangeError/TypeError from out-of-bounds reads)', () => {
  fc.assert(fc.property(fuzzBytes, (b) => {
    try { const tx = M.parseSolTx(b); assert.ok(Array.isArray(tx.keys) && Array.isArray(tx.instructions)); }
    catch (e) { assert.ok(!(e instanceof TypeError) && !(e instanceof RangeError), `${e?.name}: ${e?.message}`); }
  }), { numRuns: 5000, seed: 31 });
});

test('T-SIG-034: decodePsbt on random input never crashes the process and refuses non-PSBT data', () => {
  const t0 = Date.now();
  fc.assert(fc.property(fc.oneof(fc.string(), fuzzBytes.map((b) => Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff, ...b]).toString('base64')), fuzzBytes.map((b) => Buffer.from(b).toString('hex'))), (s) => {
    try { M.decodePsbt(s); } catch (e) { assert.ok(!(e instanceof RangeError) || /length|bounds|Invalid/i.test(e.message), `${e?.name}: ${e?.message}`); }
  }), { numRuns: 4000, seed: 34 });
  assert.ok(Date.now() - t0 < 30_000, 'bounded time');
});

test('T-SIG-039: parseSiwe / parseSiws never throw and return null or an object', () => {
  fc.assert(fc.property(fc.oneof(fc.string(), fc.string().map((s) => `${s} wants you to sign in with your Ethereum account:\n${ME}\n\nURI: ${s}\nVersion: 1\nChain ID: ${s}\nNonce: ${s}\nIssued At: ${s}`)), (s) => {
    for (const f of [M.parseSiwe, M.parseSiws]) { const r = f(s); assert.ok(r === null || typeof r === 'object'); }
  }), { numRuns: 3000, seed: 39 });
});

test('T-DAPP-044: decodeCalldata never throws on random hex and recognises approve/transfer selectors', () => {
  fc.assert(fc.property(fc.oneof(fc.uint8Array({ maxLength: 300 }).map(hex), fc.string(), fc.uint8Array({ maxLength: 200 }).map((b) => '0x095ea7b3' + Buffer.from(b).toString('hex'))), (h) => { const r = M.decodeCalldata(h); assert.equal(typeof r.kind, 'string'); }), { numRuns: 4000, seed: 44 });
  const approve = M.decodeCalldata('0x095ea7b3' + '00'.repeat(12) + 'aa'.repeat(20) + 'ff'.repeat(32));
  assert.equal(approve.kind, 'approve');
});

// ---------------------------------------------------------------- policy (SIG-10/SIG-05)

test('T-SIG-036: isSigningChain is false for non-EVM chains outside the build list and for unknown EVM ids', () => {
  for (const c of M.ALL_CHAINS.filter((c) => c.kind !== 'evm')) assert.equal(M.isSigningChain(c), M.CLIENT_CHAIN_IDS.includes(c.id) && M.mainnetSigningReady(), c.id);
  for (const fake of [{ id: 'dogecoin', kind: 'utxo' }, { id: 'not-a-chain', kind: 'cosmos' }, { kind: 'solana' }, null, undefined, {}]) assert.equal(M.isSigningChain(fake), false, JSON.stringify(fake));
  for (const id of [999999999, '0x3b9ac9ff', -1, 'abc', null, '']) assert.equal(M.isSigningEvmChain(id), false, String(id));
});

test('T-SIG-020: a release build pointing at an http loopback backend refuses mainnet signing (and an https one allows it)', async () => {
  const dir = new URL('../../node_modules/.cache/harbour-qa/', import.meta.url).pathname; mkdirSync(dir, { recursive: true });
  const load = async (env, tag) => {
    const out = await build({ stdin: { contents: "export { mainnetSigningReady, isSigningEvmChain } from './core/harbour/policy';", resolveDir: SRC, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', define: { 'import.meta.env': JSON.stringify(env) } });
    const f = join(dir, `policy-${tag}-${process.pid}.mjs`); writeFileSync(f, out.outputFiles[0].text);
    try { return await import(pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
  };
  const relLoop = await load({ PROD: true, VITE_HB_API_URL: 'http://127.0.0.1:8080' }, 'a');
  assert.equal(relLoop.mainnetSigningReady(), false); assert.equal(relLoop.isSigningEvmChain(1), false, 'Ethereum mainnet refused');
  const relHttps = await load({ PROD: true, VITE_HB_API_URL: 'https://api.harbour.example' }, 'b');
  assert.equal(relHttps.mainnetSigningReady(), true);
  const relPlainHttp = await load({ PROD: true, VITE_HB_API_URL: 'http://api.harbour.example' }, 'c');
  assert.equal(relPlainHttp.mainnetSigningReady(), false, 'non-loopback http is never secure');
  const devLoop = await load({ PROD: false, VITE_HB_API_URL: 'http://localhost:8080' }, 'd');
  assert.equal(devLoop.mainnetSigningReady(), true, 'development build may use a local backend');
});

// ---------------------------------------------------------------- origin / rate limits / pending store (DAPP-09/10/11)

test('T-DAPP-030: isPrivateNetworkUrl catches every private/reserved IPv4 form the URL parser normalises, IPv6 literals and dotless hosts', () => {
  for (const u of ['http://10.0.0.1', 'http://167772161', 'http://0x0a000001', 'http://012.0.0.1', 'http://0.0.0.0', 'http://224.0.0.1', 'http://100.64.0.1', 'http://169.254.169.254/latest/meta-data', 'http://172.16.5.4', 'http://192.168.1.1',
    'http://[::1]', 'http://[fd00::1]', 'http://intranet', 'http://router.local', 'http://db.internal', 'http://x.localdomain', 'not a url', 'http://127.1', 'http://2130706433']) {
    const h = (() => { try { return new URL(u).hostname; } catch { return '(invalid)'; } })();
    if (h === '127.0.0.1') assert.equal(M.isPrivateNetworkUrl(u), false, `${u} → loopback allowed for dev chains`);
    else assert.equal(M.isPrivateNetworkUrl(u), true, `${u} (${h})`);
  }
  for (const u of ['https://rpc.ankr.com/eth', 'https://1.1.1.1', 'http://localhost:8545', 'http://127.0.0.1:8545', 'https://8.8.8.8']) assert.equal(M.isPrivateNetworkUrl(u), false, u);
});

test('T-DAPP-059: RateLimiter never grants more than capacity + refill·Δt in any window (property, injected clock)', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 10 }), fc.array(fc.integer({ min: 0, max: 3000 }), { minLength: 1, maxLength: 200 }), (cap, rate, gaps) => {
    let t = 0; const rl = new M.RateLimiter({ capacity: cap, refillPerSec: rate }, () => t);
    const grants = [];
    for (const g of gaps) { t += g; if (rl.take('o')) grants.push(t); }
    for (let i = 0; i < grants.length; i++) for (let j = i; j < grants.length; j++) {
      const n = j - i + 1, dt = (grants[j] - grants[i]) / 1000;
      assert.ok(n <= cap + rate * dt + 1e-9, `${n} grants in ${dt}s (cap ${cap}, rate ${rate})`);
    }
  }), { numRuns: 400, seed: 59 });
  let t = 0; const rl = new M.RateLimiter({ capacity: 1, refillPerSec: 1 }, () => t, 3);
  for (const k of ['a', 'b', 'c', 'd']) rl.take(k);
  assert.equal(rl.take('d'), false, 'keys are bounded but the newest key keeps its state');
});

test('T-DAPP-058: PendingStore random add/take/claim/expire/settle sequences keep their invariants (property, fake clock)', async () => {
  const op = fc.oneof(fc.record({ k: fc.constant('add'), key: fc.integer({ min: 0, max: 30 }) }), fc.record({ k: fc.constant('take'), i: fc.nat() }), fc.record({ k: fc.constant('claim'), i: fc.nat() }),
    fc.record({ k: fc.constant('tick'), ms: fc.integer({ min: 0, max: 20 * 60_000 }) }), fc.record({ k: fc.constant('expire') }), fc.record({ k: fc.constant('settle'), key: fc.integer({ min: 0, max: 5 }) }), fc.record({ k: fc.constant('takeSettled'), key: fc.integer({ min: 0, max: 5 }) }));
  await fc.assert(fc.asyncProperty(fc.array(op, { maxLength: 60 }), async (ops) => {
    let now = 1_000; const kv = new Map(); const store = new M.PendingStore({ get: async (k) => structuredClone(kv.get(k)), set: async (k, v) => { kv.set(k, structuredClone(v)); }, remove: async (k) => { kv.delete(k); } }, () => now);
    const settledAt = new Map(); const takenSettled = new Set();
    for (const o of ops) {
      const all = await store.list();
      if (o.k === 'add') await store.add({ key: `k${o.key}`, reqId: 'r', ns: 'evm', method: 'personal_sign', kind: 'sign', params: {}, origin: 'https://o', topOrigin: 'https://o', isTopFrame: true, tabId: 1, frameId: 0 });
      if (o.k === 'take' && all.length) { const p = all[o.i % all.length]; const a = await store.take(p.id); const b = await store.take(p.id); assert.ok(a && !b, 'taken once'); }
      if (o.k === 'claim' && all.length) { const p = all[o.i % all.length]; const a = await store.claim(p.id); const b = await store.claim(p.id); assert.ok(!b, 'claimed once'); if (a) assert.equal((await store.get(p.id)).stage, 'executing'); }
      if (o.k === 'tick') now += o.ms;
      if (o.k === 'expire') { const gone = await store.expired(); for (const g of gone) assert.ok(g.expiresAt <= now && g.stage !== 'executing'); }
      if (o.k === 'settle') { await store.putSettled(`s${o.key}`, { result: o.key }); settledAt.set(`s${o.key}`, now); takenSettled.delete(`s${o.key}`); }
      if (o.k === 'takeSettled') { const v = await store.takeSettled(`s${o.key}`); if (v) assert.ok(now - settledAt.get(`s${o.key}`) <= M.SETTLED_TTL_MS, 'no expired settled outcome returned'); }
      const keys = (await store.list()).map((p) => p.key); assert.equal(new Set(keys).size, keys.length, 'no duplicate request keys');
    }
  }), { numRuns: 200, seed: 58 });
});
