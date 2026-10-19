// Send engine: signing + quote tests per chain family. Everything uses mocked fetch; NOTHING is broadcast to a real network.
// Signing correctness is checked structurally with independent code where possible (viem / noble / manual tx parsing); see evidence/33-send-receive/STATUS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseTransaction, recoverTransactionAddress, keccak256 } from 'viem';
import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { loadSend, getCore, account, otherAddress, mockFetch, rpcHandler, hexOf, NOW } from './send-helpers.mjs';

const S = await loadSend();
const core = await getCore();
const chain = (id) => S.chainById(id);
const sha256 = (b) => createHash('sha256').update(b).digest();
const env = (f) => ({ core, fetch: f, now: () => NOW, random: (n) => new Uint8Array(n).fill(7) });
const params = (c, from, to, amount, extra = {}) => ({ chain: c, from, to, amount, asset: { kind: 'native', decimals: c.decimals, symbol: c.symbol }, ...extra });
const issueCodes = (q) => q.issues.map((i) => i.code);
const addrBytes = (c, a) => core.AnyAddress.createWithString(a, core.CoinType[c.ct]).data();
const pubOf = (key) => core.PrivateKey.createWithData(key);

// ---------- registry / support matrix ----------
test('every registry chain either has a send family or an explicit documented reason', () => {
  for (const c of S.ALL_CHAINS) {
    const s = S.sendSupport(c);
    if (s.supported) assert.ok(S.SEND_FAMILIES[c.kind], c.id);
    else assert.ok(s.reason && s.reason.length > 20, `${c.id} has no reason`);
  }
  const unsupported = S.ALL_CHAINS.filter((c) => !S.sendSupport(c).supported).map((c) => c.id).sort();
  assert.deepEqual(unsupported, ['aion', 'fio', 'internet_computer', 'nimiq', 'ontology']);
});
test('parseUnits / formatUnits are exact and strict', () => {
  assert.equal(S.parseUnits('1.5', 18), 1500000000000000000n);
  assert.equal(S.parseUnits('0.000001', 6), 1n);
  assert.throws(() => S.parseUnits('0.0000001', 6));
  assert.throws(() => S.parseUnits('1e3', 6)); assert.throws(() => S.parseUnits('', 6)); assert.throws(() => S.parseUnits('-1', 6));
  assert.equal(S.formatUnits(1234500n, 6), '1.2345'); assert.equal(S.formatUnits(5n, 8), '0.00000005');
});

// ---------- EVM ----------
const ethRpc = (over = {}) => rpcHandler({
  eth_getBalance: '0xde0b6b3a7640000', eth_getTransactionCount: '0x7', eth_getCode: '0x', eth_estimateGas: '0x5208',
  eth_getBlockByNumber: { baseFeePerGas: '0x3b9aca00' }, // 1 gwei base fee
  eth_feeHistory: { reward: [['0x3b9aca00', '0x77359400', '0xb2d05e00']] }, eth_call: '0x' + (5_000_000).toString(16).padStart(64, '0'),
  eth_sendRawTransaction: (p) => keccak256(p[0]), ...over,
});
const RECIP = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
test('EVM native: EIP-1559 tx is built with the pending nonce, decodes back, and is signed by the account key', async () => {
  const c = chain('ethereum'); const me = await account(c);
  const log = []; const f = mockFetch([ethRpc()], log);
  const p = params(c, me.address, RECIP, 10n ** 17n);
  const q = await S.familyOf(c).quote(env(f), p);
  assert.deepEqual(q.tiers.map((t) => t.id), ['slow', 'average', 'fast']);
  assert.ok(q.tiers[0].fee < q.tiers[1].fee && q.tiers[1].fee < q.tiers[2].fee, 'tiers are ordered');
  assert.equal(q.assetBalance, (10n ** 18n).toString()); assert.deepEqual(q.issues.filter((i) => i.blocking), []);
  const r = await S.signAndBroadcast(env(f), p, me.key, q, 'average');
  const raw = r.built.raw; const tx = parseTransaction(raw);
  assert.equal(tx.type, 'eip1559'); assert.equal(tx.nonce, 7); assert.equal(tx.chainId, 1); assert.equal(tx.value, 10n ** 17n); assert.equal(tx.to.toLowerCase(), RECIP.toLowerCase()); assert.equal(tx.gas, 21000n);
  assert.equal((await recoverTransactionAddress({ serializedTransaction: raw })).toLowerCase(), me.address.toLowerCase());
  assert.equal(r.hash, keccak256(raw));
  assert.equal(log.filter((l) => l.body?.method === 'eth_sendRawTransaction').length, 1);
});
test('EVM ERC-20: transfer(address,uint256) calldata, token balance, gas headroom, tx to the token contract', async () => {
  const c = chain('smartchain'); const me = await account(c); const token = '0x55d398326f99059fF775485246999027B3197955';
  const f = mockFetch([ethRpc({ eth_estimateGas: '0xfde8' })]);
  const p = params(c, me.address, RECIP, 1_000_000n, { asset: { kind: 'token', contract: token, decimals: 18, symbol: 'USDT' } });
  const q = await S.familyOf(c).quote(env(f), p);
  assert.equal(q.assetBalance, '5000000'); assert.equal(q.tiers[1].max.toString(), '5000000');
  const built = await S.familyOf(c).build(env(f), p, me.key, q, 'fast'); const tx = parseTransaction(built.raw);
  assert.equal(tx.to.toLowerCase(), token.toLowerCase()); assert.equal(tx.value ?? 0n, 0n); assert.equal(tx.data.slice(0, 10), '0xa9059cbb');
  assert.equal(tx.data.slice(34, 74).toLowerCase(), RECIP.slice(2).toLowerCase()); assert.equal(BigInt('0x' + tx.data.slice(74)), 1_000_000n);
  assert.equal(tx.gas, (0xfde8n * 12n) / 10n);
});
test('EVM: legacy (pre-1559) chains get a gasPrice tx; insufficient funds and contract recipients are flagged', async () => {
  const c = chain('classic'); const me = await account(c);
  const f = mockFetch([ethRpc({ eth_getBlockByNumber: {}, eth_gasPrice: '0x3b9aca00', eth_getBalance: '0x100', eth_getCode: '0x6080' })]);
  const p = params(c, me.address, RECIP, 10n ** 18n);
  const q = await S.familyOf(c).quote(env(f), p);
  assert.ok(issueCodes(q).includes('insufficient-funds')); assert.ok(issueCodes(q).includes('smart-contract'));
  await assert.rejects(S.signAndBroadcast(env(f), p, me.key, q, 'average'), /Insufficient funds/);
  const f2 = mockFetch([ethRpc({ eth_getBlockByNumber: {}, eth_gasPrice: '0x3b9aca00' })]);
  const q2 = await S.familyOf(c).quote(env(f2), p); const tx = parseTransaction((await S.familyOf(c).build(env(f2), p, me.key, q2, 'average')).raw);
  assert.equal(tx.type, 'legacy'); assert.equal(tx.gasPrice, 1_000_000_000n); assert.equal(tx.chainId, 61);
});
test('EVM Max: native max = balance - worst-case fee and the signed value equals it', async () => {
  const c = chain('ethereum'); const me = await account(c);
  const f = mockFetch([ethRpc()]); const q0 = await S.familyOf(c).quote(env(f), params(c, me.address, RECIP, 0n));
  const t = q0.tiers[1]; assert.equal(t.max, 10n ** 18n - t.feeMax);
  const p = params(c, me.address, RECIP, t.max, { isMax: true }); const q = await S.familyOf(c).quote(env(f), p);
  const tx = parseTransaction((await S.familyOf(c).build(env(f), p, me.key, q, 'average')).raw);
  assert.equal(tx.value + tx.maxFeePerGas * tx.gas, 10n ** 18n);
});
test('EVM rejects malformed recipients before any signing', async () => {
  const c = chain('ethereum'); const me = await account(c);
  await assert.rejects(S.familyOf(c).quote(env(mockFetch([])), params(c, me.address, '0x123', 1n)), /Invalid recipient/);
});
test('IoTeX native uses the web3 gateway with an Ethereum-format tx from the same key', async () => {
  const c = chain('iotex'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch([ethRpc()]); const p = params(c, me.address, to, 10n ** 15n); const q = await S.familyOf(c).quote(env(f), p);
  const tx = parseTransaction((await S.familyOf(c).build(env(f), p, me.key, q, 'average')).raw);
  assert.equal(tx.chainId, 4689); assert.equal(tx.to.toLowerCase(), '0x' + hexOf(S.bech32Bytes(to)));
});

// ---------- Bitcoin ----------
function parseBtc(hex) {
  const b = Buffer.from(hex, 'hex'); let o = 0; const rd = (n) => { const r = b.subarray(o, o + n); o += n; return r; };
  const vi = () => { const f = b[o++]; if (f < 0xfd) return f; if (f === 0xfd) { const v = b.readUInt16LE(o); o += 2; return v; } const v = b.readUInt32LE(o); o += 4; return v; };
  const start = o; const version = rd(4).readInt32LE(0); let segwit = false; if (b[o] === 0 && b[o + 1] === 1) { segwit = true; o += 2; }
  const bodyStart = o; const n = vi(); const ins = [];
  for (let i = 0; i < n; i++) { const txid = Buffer.from(rd(32)).reverse().toString('hex'); const vout = rd(4).readUInt32LE(0); const sl = vi(); rd(sl); rd(4); ins.push({ txid, vout }); }
  const m = vi(); const outs = []; for (let i = 0; i < m; i++) { const value = rd(8).readBigUInt64LE(0); const sl = vi(); outs.push({ value, script: rd(sl).toString('hex') }); }
  const bodyEnd = o; const wit = [];
  if (segwit) for (let i = 0; i < n; i++) { const k = vi(); const items = []; for (let j = 0; j < k; j++) { const l = vi(); items.push(rd(l)); } wit.push(items); }
  const lock = rd(4);
  const legacy = Buffer.concat([b.subarray(start, start + 4), b.subarray(bodyStart, bodyEnd), lock]);
  return { version, segwit, ins, outs, wit, txid: Buffer.from(sha256(sha256(legacy))).reverse().toString('hex') };
}
const esplora = (utxos, rates) => [
  [(u) => /\/address\/.+\/utxo$/.test(u), () => utxos],
  [(u) => u.endsWith('/v1/fees/recommended'), () => rates ?? { fastestFee: 20, halfHourFee: 10, hourFee: 5, economyFee: 2, minimumFee: 1 }],
  [(u, b, i) => u.endsWith('/tx') && i.method === 'POST', () => 'txid-from-node'],
];
test('Bitcoin: segwit tx spends the UTXO, pays the recipient, returns change, fee matches the quote and the txid is self-consistent', async () => {
  const c = chain('bitcoin'); const me = await account(c); const to = await otherAddress(c);
  const utxo = { txid: 'aa'.repeat(32), vout: 1, value: 100000, status: { confirmed: true } };
  const f = mockFetch(esplora([utxo])); const p = params(c, me.address, to, 30000n);
  const q = await S.familyOf(c).quote(env(f), p);
  assert.equal(q.tiers[1].detail, '10 sat/vB'); assert.ok(q.tiers[0].fee < q.tiers[2].fee); assert.deepEqual(q.issues.filter((i) => i.blocking), []);
  const built = await S.familyOf(c).build(env(f), p, me.key, q, 'average'); const tx = parseBtc(built.raw);
  assert.ok(tx.segwit); assert.equal(tx.ins.length, 1); assert.equal(tx.ins[0].txid, 'aa'.repeat(32)); assert.equal(tx.ins[0].vout, 1); assert.equal(tx.wit[0].length, 2, 'P2WPKH witness = signature + pubkey');
  const pay = tx.outs.find((o) => o.value === 30000n); assert.ok(pay, 'recipient output');
  assert.equal(pay.script, hexOf(core.BitcoinScript.lockScriptForAddress(to, core.CoinType.bitcoin).data()));
  const total = tx.outs.reduce((s, o) => s + o.value, 0n); assert.equal(100000n - total, q.tiers[1].fee, 'on-chain fee equals the quoted fee');
  assert.equal(tx.outs.length, 2); assert.equal(built.hash, tx.txid, 'txid = double-sha256 of the non-witness serialisation');
  assert.equal(await S.familyOf(c).broadcast(env(f), c, built), 'txid-from-node');
  assert.equal(f.log.filter((l) => l.method === 'POST').length, 1);
});
test('Bitcoin Max sends everything minus fee with a single output; dust and insufficient funds are explicit', async () => {
  const c = chain('bitcoin'); const me = await account(c); const to = await otherAddress(c);
  const utxo = { txid: 'bb'.repeat(32), vout: 0, value: 50000, status: { confirmed: true } };
  const f = mockFetch(esplora([utxo])); const q0 = await S.familyOf(c).quote(env(f), params(c, me.address, to, 0n));
  const max = q0.tiers[1].max; assert.ok(max > 0n && max < 50000n);
  const p = params(c, me.address, to, max, { isMax: true }); const q = await S.familyOf(c).quote(env(f), p);
  const tx = parseBtc((await S.familyOf(c).build(env(f), p, me.key, q, 'average')).raw); assert.equal(tx.outs.length, 1); assert.equal(tx.outs[0].value, max);
  const qd = await S.familyOf(c).quote(env(f), params(c, me.address, to, 300n)); assert.ok(issueCodes(qd).includes('dust'));
  const qi = await S.familyOf(c).quote(env(f), params(c, me.address, to, 60000n)); assert.ok(issueCodes(qi).includes('insufficient-funds'));
  const none = await S.familyOf(c).quote(env(mockFetch(esplora([]))), params(c, me.address, to, 1000n)); assert.ok(issueCodes(none).includes('insufficient-funds'));
});
test('Bitcoin falls back to blockstream-style fee-estimates', async () => {
  const c = chain('bitcoin'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch([[(u) => /\/utxo$/.test(u), () => [{ txid: 'cc'.repeat(32), vout: 0, value: 90000 }]], [(u) => u.endsWith('/v1/fees/recommended'), () => ({ __status: 404, body: {} })], [(u) => u.endsWith('/fee-estimates'), () => ({ 1: 30, 3: 12, 6: 3 })]]);
  const q = await S.familyOf(c).quote(env(f), params(c, me.address, to, 10000n)); assert.deepEqual(q.tiers.map((t) => t.detail), ['3 sat/vB', '12 sat/vB', '30 sat/vB']);
});

// ---------- Solana ----------
const BH = '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi';
const SOL = (over = {}) => rpcHandler({ getBalance: { value: 2_000_000_000 }, getLatestBlockhash: { value: { blockhash: BH, lastValidBlockHeight: 1 } },
  getRecentPrioritizationFees: [{ prioritizationFee: 0 }, { prioritizationFee: 1000 }, { prioritizationFee: 5000 }, { prioritizationFee: 20000 }], getAccountInfo: { value: null }, getMinimumBalanceForRentExemption: 890880,
  sendTransaction: 'sig-from-node', ...over });
function parseSolTx(b58) {
  const bytes = Buffer.from(core.Base58.decodeNoCheck(b58)); let o = 0; const n = bytes[o++]; const sigs = []; for (let i = 0; i < n; i++) { sigs.push(bytes.subarray(o, o + 64)); o += 64; }
  return { sigs, message: bytes.subarray(o) };
}
test('Solana native: ed25519 signature verifies against the account key; blockhash, recipient and priority fee are used; new recipient needs rent', async () => {
  const c = chain('solana'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch([SOL()]);
  let q = await S.familyOf(c).quote(env(f), params(c, me.address, to, 5000n)); assert.ok(issueCodes(q).includes('below-minimum'));
  const p = params(c, me.address, to, 1_000_000n); q = await S.familyOf(c).quote(env(f), p);
  assert.ok(!issueCodes(q).includes('below-minimum')); assert.equal(q.tiers[0].fee, 5000n); assert.ok(q.tiers[2].fee > q.tiers[1].fee);
  const built = await S.familyOf(c).build(env(f), p, me.key, q, 'fast'); const { sigs, message } = parseSolTx(built.raw);
  assert.ok(ed25519.verify(sigs[0], message, pubOf(me.key).getPublicKeyEd25519().data()), 'signature verifies over the message');
  assert.ok(Buffer.from(message).includes(Buffer.from(core.Base58.decodeNoCheck(BH))), 'blockhash embedded');
  assert.ok(Buffer.from(message).includes(Buffer.from(addrBytes(c, to))), 'recipient embedded');
  assert.equal((await S.familyOf(c).build(env(f), p, me.key, q, 'fast')).raw, built.raw, 'deterministic');
  assert.equal(await S.familyOf(c).broadcast(env(f), c, built), 'sig-from-node');
});
test('Solana SPL: creates the recipient ATA when missing, uses the sender token account and the mint', async () => {
  const c = chain('solana'); const me = await account(c); const to = await otherAddress(c); const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const f = mockFetch([SOL({
    getAccountInfo: (p) => (p[0] === mint ? { value: { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', data: { parsed: { info: { decimals: 6 } } } } } : { value: null }),
    getTokenAccountsByOwner: { value: [{ pubkey: 'Gr9ZsSrFLTH7GBA5fvHYBYpxH5mWCzDTFKUuYFxn8CsA', account: { data: { parsed: { info: { tokenAmount: { amount: '5000000' } } } } } }] },
    getMinimumBalanceForRentExemption: (p) => (p[0] === 165 ? 2039280 : 890880),
  })]);
  const p = params(c, me.address, to, 1_000_000n, { asset: { kind: 'token', contract: mint, decimals: 6, symbol: 'USDC' } });
  const q = await S.familyOf(c).quote(env(f), p); assert.equal(q.assetBalance, '5000000'); assert.ok(q.tiers[1].fee >= 5000n + 2039280n, 'ATA rent is part of the fee');
  const built = await S.familyOf(c).build(env(f), p, me.key, q, 'average'); const { sigs, message } = parseSolTx(built.raw);
  assert.ok(ed25519.verify(sigs[0], message, pubOf(me.key).getPublicKeyEd25519().data()));
  assert.ok(Buffer.from(message).includes(Buffer.from(core.Base58.decodeNoCheck('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'))), 'associated token program invoked (ATA creation)');
  assert.ok(Buffer.from(message).includes(Buffer.from(core.Base58.decodeNoCheck(mint))));
});

// ---------- TRON ----------
const TRON = () => [
  [(u) => u.endsWith('/wallet/getaccount'), (u, b) => (b.address === TRON.dest ? {} : { balance: 50_000_000, address: b.address })],
  [(u) => u.endsWith('/wallet/getaccountresource'), () => ({ freeNetLimit: 600, freeNetUsed: 0 })],
  [(u) => u.endsWith('/wallet/getchainparameters'), () => ({ chainParameter: [{ key: 'getEnergyFee', value: 420 }, { key: 'getTransactionFee', value: 1000 }, { key: 'getCreateNewAccountFeeInSystemContract', value: 1000000 }] })],
  [(u) => u.endsWith('/wallet/getnowblock'), () => ({ blockID: '00', block_header: { raw_data: { number: 100, txTrieRoot: '11'.repeat(32), witness_address: '41' + '22'.repeat(20), parentHash: '33'.repeat(32), version: 30, timestamp: NOW - 3000 } } })],
  [(u) => u.endsWith('/wallet/triggerconstantcontract'), (u, b) => (b.function_selector.startsWith('balanceOf') ? { constant_result: ['00'.repeat(31) + '64'] } : { energy_used: 14000, result: { result: true } })],
  [(u) => u.endsWith('/wallet/broadcasttransaction'), (u, b) => ({ result: true, txid: b.txID })],
];
test('TRON native: txID = sha256(raw_data), signature verifies for the account key, free bandwidth means zero fee', async () => {
  const c = chain('tron'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch(TRON()); const p = params(c, me.address, to, 1_000_000n); const q = await S.familyOf(c).quote(env(f), p);
  assert.equal(q.tiers[1].fee, 0n); assert.equal(q.tiers[1].max, 50_000_000n);
  const built = await S.familyOf(c).build(env(f), p, me.key, q, 'average'); const j = JSON.parse(built.raw);
  assert.equal(built.hash, j.txID); assert.equal(hexOf(sha256(Buffer.from(j.raw_data_hex, 'hex'))), j.txID);
  const sig = Buffer.from(j.signature[0], 'hex'); const pub = pubOf(me.key).getPublicKeySecp256k1(false).data();
  assert.ok(secp256k1.verify(sig.subarray(0, 64), Buffer.from(j.txID, 'hex'), pub, { lowS: false }), 'ECDSA verifies');
  assert.equal(j.raw_data.contract[0].type, 'TransferContract'); assert.equal(j.raw_data.contract[0].parameter.value.amount, 1_000_000);
  assert.equal(await S.familyOf(c).broadcast(env(f), c, built), j.txID);
});
test('TRON TRC-20: energy based fee, TriggerSmartContract transfer(address,uint256), balance check', async () => {
  const c = chain('tron'); const me = await account(c); const to = await otherAddress(c); const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  const f = mockFetch(TRON()); const p = params(c, me.address, to, 5_000_000n, { asset: { kind: 'token', contract: usdt, decimals: 6, symbol: 'USDT' } });
  const q = await S.familyOf(c).quote(env(f), p); assert.equal(q.assetBalance, '100'); assert.ok(issueCodes(q).includes('insufficient-funds'));
  const p2 = { ...p, amount: 50n }; const q2 = await S.familyOf(c).quote(env(f), p2); assert.equal(q2.tiers[1].fee, 14000n * 420n);
  const j = JSON.parse((await S.familyOf(c).build(env(f), p2, me.key, q2, 'average')).raw);
  assert.equal(j.raw_data.contract[0].type, 'TriggerSmartContract'); assert.match(j.raw_data.contract[0].parameter.value.data, /^a9059cbb/); assert.ok(j.raw_data.fee_limit >= 10_000_000);
});
test('TRON: an unactivated recipient adds the 1 TRX activation fee and a warning', async () => {
  const c = chain('tron'); const me = await account(c); const to = await otherAddress(c); TRON.dest = to;
  const q = await S.familyOf(c).quote(env(mockFetch(TRON())), params(c, me.address, to, 1_000_000n)); TRON.dest = undefined;
  assert.equal(q.tiers[1].fee, 1_000_000n); assert.ok(issueCodes(q).includes('inactive-account')); assert.equal(q.recipientInactive, true);
});

// ---------- Cosmos family ----------
const COS = (over = {}) => [
  [(u) => u.includes('/cosmos/auth/v1beta1/accounts/'), () => ({ account: { '@type': '/cosmos.auth.v1beta1.BaseAccount', address: 'x', account_number: '1234', sequence: '9' } })],
  [(u) => u.includes('/cosmos/bank/v1beta1/balances/'), () => ({ balance: { denom: 'x', amount: '10000000' } })],
  [(u) => u.endsWith('/node_info'), () => ({ default_node_info: { network: over.chainId ?? 'cosmoshub-4' } })],
  [(u) => u.endsWith('/node/v1beta1/config'), () => ({ minimum_gas_price: '0.0025uatom' })],
  [(u, b, i) => u.endsWith('/cosmos/tx/v1beta1/txs') && i.method === 'POST', () => ({ tx_response: { code: 0, txhash: 'ABCDEF' } })],
];
test('Cosmos bank send: TxRaw carries recipient, denom, memo, amount; account number / sequence / chain id come from the node; broadcast body is {tx_bytes, mode}', async () => {
  const c = chain('cosmos'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch(COS()); const p = params(c, me.address, to, 1_000_000n, { memo: 'hello-harbour' }); const q = await S.familyOf(c).quote(env(f), p);
  assert.equal(q.ctx.accountNumber, '1234'); assert.equal(q.ctx.sequence, '9'); assert.equal(q.ctx.chainId, 'cosmoshub-4'); assert.equal(q.tiers[0].fee, 5000n);
  const built = await S.familyOf(c).build(env(f), p, me.key, q, 'average'); const body = JSON.parse(built.raw);
  assert.equal(body.mode, 'BROADCAST_MODE_SYNC'); const bytes = Buffer.from(body.tx_bytes, 'base64');
  for (const s of [to, 'uatom', 'hello-harbour', '1000000']) assert.ok(bytes.includes(Buffer.from(s)), s);
  assert.equal(await S.familyOf(c).broadcast(env(f), c, built), 'ABCDEF');
  assert.equal((await S.familyOf(c).build(env(f), p, me.key, q, 'average')).raw, built.raw, 'deterministic');
});
test('Cosmos: every configured chain quotes + signs (THORChain uses its own MsgSend and a protocol fee)', async () => {
  for (const id of Object.keys(S.COSMOS_SPECS)) {
    const c = chain(id); const me = await account(c); const to = await otherAddress(c);
    const f = mockFetch(COS({ chainId: id + '-1' })); const p = params(c, me.address, to, 100000n);
    const q = await S.familyOf(c).quote(env(f), p); const built = await S.familyOf(c).build(env(f), p, me.key, q, 'slow');
    assert.ok(JSON.parse(built.raw).tx_bytes.length > 100, id);
    if (id === 'thorchain') assert.equal(q.tiers[0].fee, 2_000_000n);
  }
});
test('Cosmos: a rejected broadcast surfaces the node log', async () => {
  const c = chain('osmosis'); const f = mockFetch([[(u) => u.endsWith('/txs'), () => ({ tx_response: { code: 5, raw_log: 'insufficient fees' } })]]);
  await assert.rejects(S.familyOf(c).broadcast(env(f), c, { raw: '{}' }), /insufficient fees/);
});

// ---------- the remaining families: quote + sign with mocked nodes ----------
const J = (path, val) => [(u) => u.includes(path), typeof val === 'function' ? val : () => val];
const xrpl = (method, fn) => [(u, b) => b?.method === method, fn];
const setups = {
  ton: (c, me, to) => ({ f: mockFetch([J('/getWalletInformation', { ok: true, result: { balance: '5000000000', seqno: 3, wallet: true } }), J('/getAddressInformation', { ok: true, result: { state: 'active' } })]), amount: 10n ** 9n, memo: 'harbour',
    check: (b) => { assert.ok(Buffer.from(b.raw, 'base64').length > 80); } }),
  aptos: (c, me, to) => ({ f: mockFetch([J('/estimate_gas_price', { gas_estimate: 100, deprioritized_gas_estimate: 100, prioritized_gas_estimate: 150 }), [(u) => u.endsWith('/view'), () => ['100000000']],
    J('/accounts/', (u) => (u.includes(to) ? { __status: 404, body: { message: 'not found' } } : { sequence_number: '4' })), [(u) => u.endsWith('mainnet.aptoslabs.com/v1'), () => ({ chain_id: 1 })]]), amount: 10n ** 6n,
    check: (b) => { const j = JSON.parse(b.raw); assert.equal(j.sequence_number, '4'); assert.equal(j.max_gas_amount, '4000'); assert.ok(j.signature); } }),
  sui: (c, me, to) => ({ f: mockFetch([rpcHandler({ suix_getCoins: { data: [{ coinObjectId: '0x' + 'ab'.repeat(32), version: '12', digest: '5Y8sXtvPFVpFRiKJhdeRUsDYPKbUHKEYK1vwJ8TFhZs3', balance: '3000000000' }], hasNextPage: false }, suix_getReferenceGasPrice: '750' })]), amount: 10n ** 8n,
    check: (b) => { const j = JSON.parse(b.raw); assert.ok(j.tx.length > 40 && j.sig.length > 40); } }),
  near: (c, me, to) => ({ f: mockFetch([rpcHandler({ query: (p) => (p.request_type === 'view_access_key' ? { nonce: 42, block_hash: '4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ' } : { amount: '5000000000000000000000000', storage_usage: 182 }), gas_price: { gas_price: '100000000' } })]), amount: 10n ** 24n,
    check: (b) => { assert.ok(Buffer.from(b.raw, 'base64').length > 100); assert.ok(b.hash); } }),
  algorand: (c, me, to) => ({ f: mockFetch([J('/v2/accounts/', (u) => (u.includes(to) ? { amount: 500000 } : { amount: 5000000, 'min-balance': 100000 })), J('/v2/transactions/params', { fee: 0, 'min-fee': 1000, 'genesis-id': 'mainnet-v1.0', 'genesis-hash': 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=', 'last-round': 30000000 })]), amount: 1_000_000n, memo: 'note',
    check: (b) => { assert.ok(Buffer.from(b.raw, 'base64').length > 100); } }),
  ripple: (c, me, to) => ({ f: mockFetch([xrpl('account_info', (u, b) => (b.params[0].account === to ? { result: { account_data: { Balance: '20000000', Flags: 0 }, status: 'success' } } : { result: { account_data: { Balance: '50000000', Sequence: 11, OwnerCount: 2, Flags: 0 }, ledger_current_index: 90000000, status: 'success' } })),
    xrpl('server_info', () => ({ result: { info: { validated_ledger: { reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } })), xrpl('fee', () => ({ result: { drops: { base_fee: '10', median_fee: '5000', open_ledger_fee: '10' } } }))]), amount: 5_000_000n, memo: '12345',
    check: (b) => { assert.match(b.raw, /^[0-9A-F]+$/); assert.ok(b.raw.startsWith('12000022')); } }),
  stellar: (c, me, to) => ({ f: mockFetch([J('/accounts/', () => ({ sequence: '100', subentry_count: 1, num_sponsoring: 0, num_sponsored: 0, balances: [{ asset_type: 'native', balance: '50.0000000' }] })), J('/fee_stats', { last_ledger_base_fee: '100', fee_charged: { p50: '100', p90: '500' } })]), amount: 10_000_000n, memo: '777',
    check: (b) => { assert.ok(Buffer.from(b.raw, 'base64').length > 100); } }),
  tezos: (c, me, to) => ({ f: mockFetch([[(u) => u.endsWith('/head/hash'), () => core.Base58.encode(Uint8Array.from([1, 52, ...new Array(32).fill(9)]))], J('/balance', (u) => (u.includes(to) ? { __status: 404, body: {} } : '5000000')), J('/counter', '77'), J('/manager_key', null)]), amount: 1_000_000n,
    check: (b) => { assert.match(b.raw, /^[0-9a-f]+$/); assert.ok(b.raw.length > 200); } }),
  filecoin: (c, me, to) => ({ f: mockFetch([rpcHandler({ 'Filecoin.WalletBalance': '5000000000000000000', 'Filecoin.MpoolGetNonce': 5, 'Filecoin.GasEstimateMessageGas': { GasLimit: 1500000, GasFeeCap: '101000', GasPremium: '99000' }, 'Filecoin.MpoolPush': { '/': 'bafy-cid' } })]), amount: 10n ** 17n,
    check: (b) => { const j = JSON.parse(b.raw); assert.equal(j.Message.Nonce, 5); assert.equal(j.Message.To, undefined === 1 ? '' : j.Message.To); assert.ok(j.Signature.Data); } }),
  waves: (c, me, to) => ({ f: mockFetch([J('/addresses/balance/', { balance: 500000000 })]), amount: 10n ** 7n, memo: 'note',
    check: (b) => { const j = JSON.parse(b.raw); assert.equal(j.type, 4); assert.equal(j.fee, 100000); assert.ok(j.proofs[0]); } }),
  vechain: (c, me, to) => ({ f: mockFetch([J('/accounts/', { balance: '0x56bc75e2d63100000', energy: '0x8ac7230489e80000' }), J('/blocks/best', { id: '0x00ab12cd' + '11'.repeat(28), number: 11000000 }), J('/blocks/0', { id: '0x00000000851caf3cfdb6e899cf5958bfb1ac3413d346d43539627e6be7ec1b4a' })]), amount: 10n ** 18n,
    check: (b) => { assert.match(b.raw, /^0x[0-9a-f]+$/); } }),
  harmony: (c, me, to) => ({ f: mockFetch([rpcHandler({ eth_getBalance: '0xde0b6b3a7640000', eth_getTransactionCount: '0x2', eth_gasPrice: '0x3b9aca00', eth_sendRawTransaction: '0xhash' })]), amount: 10n ** 16n,
    check: (b) => { assert.match(b.raw, /^0x[0-9a-f]+$/); } }),
  icon: (c, me, to) => ({ f: mockFetch([rpcHandler({ icx_getBalance: '0xde0b6b3a7640000', icx_sendTransaction: '0xtxhash' })]), amount: 10n ** 16n,
    check: (b) => { const j = JSON.parse(b.raw); assert.equal(j.to, to); assert.ok(j.signature); assert.equal(j.version, '0x3'); } }),
  zilliqa: (c, me, to) => ({ f: mockFetch([rpcHandler({ GetBalance: { balance: '5000000000000', nonce: 4 }, GetMinimumGasPrice: '2000000000', CreateTransaction: { TranID: 'abc' } })]), amount: 10n ** 11n,
    check: (b) => { const j = JSON.parse(b.raw); assert.equal(Number(j.nonce), 5); assert.ok(j.signature); } }),
  elrond: (c, me, to) => ({ f: mockFetch([J('/address/', { data: { account: { nonce: 15, balance: '5000000000000000000' } } }), J('/network/config', { data: { config: { erd_chain_id: '1', erd_min_gas_limit: 50000, erd_min_gas_price: 1000000000 } } })]), amount: 10n ** 17n, memo: 'hi',
    check: (b) => { const j = JSON.parse(b.raw); assert.equal(j.nonce, 15); assert.equal(j.chainID, '1'); assert.ok(j.signature); assert.equal(j.gasLimit, 50000 + 1500 * 2); } }),
  theta: (c, me, to) => ({ f: mockFetch([rpcHandler({ 'theta.GetAccount': { coins: { thetawei: '100000000000000000000', tfuelwei: '5000000000000000000' }, sequence: '12' } })]), amount: 10n ** 18n,
    check: (b) => { assert.match(b.raw, /^[0-9a-f]+$/); } }),
};
for (const [id, mk] of Object.entries(setups)) {
  test(`${id}: quote -> sign gives a deterministic transaction (no broadcast)`, async () => {
    const c = chain(id); const me = await account(c); const to = await otherAddress(c); const { f, check, memo, amount } = mk(c, me, to);
    const fam = S.familyOf(c); const p = params(c, me.address, to, amount, memo ? { memo } : {});
    const q = await fam.quote(env(f), p);
    assert.equal(q.tiers.length, 3); assert.ok(q.tiers.every((t) => t.fee >= 0n && t.max >= 0n)); assert.deepEqual(q.issues.filter((i) => i.blocking), [], JSON.stringify(q.issues));
    const built = await fam.build(env(f), p, me.key, q, 'average'); assert.ok(built.raw && built.raw.length > 20); check(built, q);
    assert.equal((await fam.build(env(f), p, me.key, q, 'average')).raw, built.raw, 'signing is deterministic');
    assert.ok(!f.log.some((l) => /send|broadcast|submit|CreateTransaction|injection/i.test(l.url + JSON.stringify(l.body ?? ''))), 'nothing was broadcast');
  });
}
test('Polkadot: without a balance source the quote fails loudly instead of guessing', async () => {
  const c = chain('polkadot'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch([rpcHandler({ chain_getFinalizedHead: '0x' + 'ab'.repeat(32), chain_getBlockHash: '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3', state_getRuntimeVersion: { specVersion: 1002000, transactionVersion: 26 }, system_accountNextIndex: 8 })]);
  await assert.rejects(S.familyOf(c).quote(env(f), params(c, me.address, to, 10n ** 10n)));
});
test('XRP: destination tag validation uses the TW messages; a required-tag recipient is blocked without a tag; the reserve is excluded from Max', async () => {
  assert.equal(S.validateXrpTag('123'), null); assert.equal(S.validateXrpTag('abc'), 'Destination Tag must be a number'); assert.equal(S.validateXrpTag('4294967296'), 'Destination Tag must be between 0 and 4294967295');
  const c = chain('ripple'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch([xrpl('account_info', (u, b) => (b.params[0].account === to ? { result: { account_data: { Balance: '20000000', Flags: 0x20000 }, status: 'success' } } : { result: { account_data: { Balance: '50000000', Sequence: 1, OwnerCount: 0 }, ledger_current_index: 5, status: 'success' } })),
    xrpl('server_info', () => ({ result: { info: { validated_ledger: { reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } })), xrpl('fee', () => ({ result: { drops: { base_fee: '10', median_fee: '10', open_ledger_fee: '10' } } }))]);
  const q = await S.familyOf(c).quote(env(f), params(c, me.address, to, 1_000_000n)); assert.ok(issueCodes(q).includes('memo-required'));
  const q2 = await S.familyOf(c).quote(env(f), params(c, me.address, to, 1_000_000n, { memo: '1' })); assert.ok(!issueCodes(q2).includes('memo-required'));
  assert.equal(q.reserve, '1000000'); assert.equal(q.tiers[1].max, 50_000_000n - 1_000_000n - q.tiers[1].fee);
});
test('XRP: an unactivated recipient needs the base reserve', async () => {
  const c = chain('ripple'); const me = await account(c); const to = await otherAddress(c);
  const f = mockFetch([xrpl('account_info', (u, b) => (b.params[0].account === to ? { result: { error: 'actNotFound', status: 'error' } } : { result: { account_data: { Balance: '50000000', Sequence: 1, OwnerCount: 0 }, ledger_current_index: 5, status: 'success' } })),
    xrpl('server_info', () => ({ result: { info: { validated_ledger: { reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } })), xrpl('fee', () => ({ result: { drops: { base_fee: '10', median_fee: '10', open_ledger_fee: '10' } } }))]);
  const q = await S.familyOf(c).quote(env(f), params(c, me.address, to, 500_000n)); assert.ok(q.issues.some((i) => i.code === 'inactive-account' && i.blocking));
});
test('NEAR: the access-key nonce is incremented and the transfer deposit is a 16-byte little-endian u128', async () => {
  const c = chain('near'); const me = await account(c); const to = await otherAddress(c); const { f } = setups.near(c, me, to);
  const p = params(c, me.address, to, 123456789n); const q = await S.familyOf(c).quote(env(f), p); const built = await S.familyOf(c).build(env(f), p, me.key, q, 'average');
  assert.ok(Buffer.from(built.raw, 'base64').includes(Buffer.from('15cd5b07000000000000000000000000', 'hex')), 'deposit 123456789 as LE u128');
});
test('building never broadcasts: only an explicit broadcast() performs a send', async () => {
  const c = chain('ethereum'); const me = await account(c); const log = []; const f = mockFetch([ethRpc()], log);
  const p = params(c, me.address, RECIP, 1n); const q = await S.familyOf(c).quote(env(f), p); await S.familyOf(c).build(env(f), p, me.key, q, 'slow');
  assert.ok(!log.some((l) => l.body?.method === 'eth_sendRawTransaction'));
});
test('a signing key that does not belong to the account is refused', async () => {
  const c = chain('ethereum'); const me = await account(c); const f = mockFetch([ethRpc()]); const other = new Uint8Array(32).fill(7);
  const p = params(c, me.address, RECIP, 1n); const q = await S.familyOf(c).quote(env(f), p);
  await assert.rejects(S.familyOf(c).build(env(f), p, other, q, 'slow'), /does not match/);
});
test('quoteToWire strips the opaque context and stringifies bigint', async () => {
  const c = chain('ethereum'); const me = await account(c); const q = await S.familyOf(c).quote(env(mockFetch([ethRpc()])), params(c, me.address, RECIP, 1n));
  const w = S.quoteToWire(q); assert.equal(w.ctx, undefined); assert.equal(typeof w.tiers[0].fee, 'string'); JSON.stringify(w);
});

// ---------- NFT transfers ----------
test('NFT ERC-721: ownership is checked, the safeTransferFrom calldata decodes, and the tx is signed by the owner', async () => {
  const c = chain('ethereum'); const me = await account(c); const contract = '0x60E4d786628Fea6478F785A6d7e704777c86a7c6'; const tokenId = '1234';
  const f = mockFetch([ethRpc({ eth_call: () => '0x' + me.address.slice(2).toLowerCase().padStart(64, '0') })]);
  const p = { chain: c, from: me.address, to: RECIP, standard: 'erc721', contract, tokenId };
  const q = await S.quoteNftTransfer(env(f), p); assert.deepEqual(q.issues.filter((i) => i.blocking), []); assert.equal(q.assetBalance, '1');
  const built = await S.buildNftTransfer(env(f), p, me.key, q, 'average'); const tx = parseTransaction(built.raw);
  assert.equal(tx.to.toLowerCase(), contract.toLowerCase()); assert.ok(tx.data.startsWith('0x42842e0e'), 'safeTransferFrom(address,address,uint256)');
  assert.ok(tx.data.endsWith(BigInt(tokenId).toString(16).padStart(64, '0'))); assert.equal((await recoverTransactionAddress({ serializedTransaction: built.raw })).toLowerCase(), me.address.toLowerCase());
});
test('NFT ERC-721 not owned by the sender is a blocking issue (never signed blindly)', async () => {
  const c = chain('ethereum'); const me = await account(c);
  const f = mockFetch([ethRpc({ eth_call: () => '0x' + RECIP.slice(2).toLowerCase().padStart(64, '0') })]);
  const q = await S.quoteNftTransfer(env(f), { chain: c, from: me.address, to: RECIP, standard: 'erc721', contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', tokenId: '5' });
  assert.ok(q.issues.some((i) => i.blocking && i.code === 'insufficient-funds'));
});

// ---------- payment URIs, name resolution, records ----------
test('parsePaymentUri: BIP-21, EIP-681 transfer, plain address, and links are not treated as payment requests', () => {
  assert.deepEqual(S.parsePaymentUri('bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.5&memo=hi'), { address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', amount: '0.5', memo: 'hi', chainHint: undefined });
  const e = S.parsePaymentUri('ethereum:0x70997970C51812dc3A010C7d01b50e0d17dc79C8@137'); assert.equal(e.address, RECIP); assert.equal(e.chainHint, '137');
  assert.equal(S.parsePaymentUri(RECIP).address, RECIP); assert.equal(S.parsePaymentUri('https://evil.example/x').address, 'https://evil.example/x');
  assert.equal(S.parsePaymentUri('bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=1e9').amount, undefined);
});
test('ENS: resolver lookup then addr(); a name without a resolver fails with a clear error', async () => {
  const resolverAddr = '0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41'; const target = RECIP.toLowerCase();
  const call = async (url, method, [tx]) => (tx.data.startsWith('0x0178b8bf') ? '0x' + resolverAddr.slice(2).padStart(64, '0') : '0x' + target.slice(2).padStart(64, '0'));
  assert.equal((await S.resolveEns('Vitalik.eth', ['https://rpc.invalid'], call)).toLowerCase(), target);
  await assert.rejects(S.resolveEns('nobody.eth', ['https://rpc.invalid'], async () => '0x' + '0'.repeat(64)), /no resolver/);
  assert.equal(S.nameService('a.eth', chain('ethereum')), 'ens'); assert.equal(S.nameService('a.sol', chain('solana')), 'sns'); assert.equal(S.nameService('a.eth', chain('solana')), null);
});
test('assessRecipient: new vs known (address book / previous send) and self-send', () => {
  const sent = [{ chainId: 'ethereum', to: RECIP }]; const book = [{ name: 'Ann', addresses: { ethereum: '0x1111111111111111111111111111111111111111' } }];
  assert.equal(S.assessRecipient(RECIP, '0xabc', sent, 'ethereum', book, 'ethereum').newRecipient, false);
  const r = S.assessRecipient('0x1111111111111111111111111111111111111111', '0xabc', [], 'ethereum', book, 'ethereum'); assert.equal(r.contactName, 'Ann'); assert.equal(r.newRecipient, false);
  assert.equal(S.assessRecipient('0x2222222222222222222222222222222222222222', '0xabc', sent, 'ethereum', book, 'ethereum').newRecipient, true);
  assert.equal(S.assessRecipient('0xABC', '0xabc', [], 'ethereum', [], 'ethereum').selfSend, true);
});
test('sent-transaction records: upsert replaces by id, newest first, capped, and tolerates junk storage', () => {
  const mk = (id, ts) => ({ id, chainId: 'ethereum', symbol: 'ETH', decimals: 18, assetKey: 'ethereum', from: 'a', to: 'b', amount: '1', feeEst: '1', feeSymbol: 'ETH', feeDecimals: 18, hash: id, ts, state: 'pending', tier: 'average' });
  let l = S.upsertSent([], mk('a', 1)); l = S.upsertSent(l, mk('b', 2)); l = S.upsertSent(l, { ...mk('a', 1), state: 'confirmed' });
  assert.deepEqual(l.map((x) => x.id).sort(), ['a', 'b']); assert.equal(l.find((x) => x.id === 'a').state, 'confirmed');
  assert.deepEqual(S.readSent('junk'), []); assert.deepEqual(S.readSent([null, 5, { id: 1 }]), []);
});
