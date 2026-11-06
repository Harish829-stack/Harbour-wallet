import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import pkg from '@trustwallet/wallet-core';
const { initWasm } = pkg;

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './addressBook';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const A = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

// Real wallet-core validity, exactly as the background wires it (core.AnyAddress.isValid(addr, core.CoinType[coin])).
const core = await initWasm();
const isValid = (coin, addr) => { try { return core.AnyAddress.isValid(addr, core.CoinType[coin]); } catch { return false; } };
const ETH = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // public EIP-55 sample address
const BTC = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';         // Bitcoin genesis address
const BECH = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'; // BIP-173 style bech32 sample
const SOL = '11111111111111111111111111111111';           // Solana system program id (valid base58 pubkey)

test('wallet-core accepts real addresses and rejects junk (the check the background uses)', () => {
  assert.equal(isValid('ethereum', ETH), true); assert.equal(isValid('ethereum', ETH.toLowerCase()), true);
  assert.equal(isValid('ethereum', ETH.slice(0, -1) + 'x'), false); assert.equal(isValid('ethereum', '0x123'), false);
  assert.equal(isValid('bitcoin', BTC), true); assert.equal(isValid('bitcoin', BECH), true); assert.equal(isValid('bitcoin', ETH), false);
  assert.equal(isValid('solana', SOL), true); assert.equal(isValid('solana', BTC), false);
  assert.equal(isValid('solana', 'not-an-address'), false);
});
test('sanitizeEntry: needs a name and >=1 valid address; trims; drops emptied fields', () => {
  const ok = A.sanitizeEntry({ name: '  Alice   Smith ', addresses: { ethereum: ` ${ETH} `, bitcoin: '' } }, isValid);
  assert.deepEqual(ok, { ok: true, name: 'Alice Smith', addresses: { ethereum: ETH } });
  assert.equal(A.sanitizeEntry({ name: '', addresses: { ethereum: ETH } }, isValid).ok, false);
  assert.equal(A.sanitizeEntry({ name: 'x', addresses: {} }, isValid).ok, false);
  assert.equal(A.sanitizeEntry({ name: 'x', addresses: { ethereum: '' } }, isValid).ok, false);
  assert.equal(A.sanitizeEntry({ name: 'x'.repeat(41), addresses: { ethereum: ETH } }, isValid).ok, false);
});
test('sanitizeEntry rejects bad address for a coin, unknown coins, and non-objects', () => {
  const bad = A.sanitizeEntry({ name: 'Bob', addresses: { bitcoin: ETH } }, isValid); assert.equal(bad.ok, false); assert.match(bad.error, /Bitcoin/);
  assert.equal(A.sanitizeEntry({ name: 'Bob', addresses: { dogecoin: 'D7Y6JxBaVxzHP5vLSgbPTkcH4vLEgKGSsS' } }, isValid).ok, false);
  for (const v of [null, 'x', 5, [], undefined]) assert.equal(A.sanitizeEntry(v, isValid).ok, false);
  assert.equal(A.sanitizeEntry({ name: 'Bob', addresses: [ETH] }, isValid).ok, false);
  assert.equal(A.sanitizeEntry({ name: 'Bob', addresses: { ethereum: 'a'.repeat(200) } }, isValid).ok, false);
});
test('control characters in names are neutralised', () => {
  assert.equal(A.cleanName('A\u0000\nB\t\tC\u007f'), 'A B C');
  assert.equal(A.sanitizeEntry({ name: '\u0000\u0001', addresses: { ethereum: ETH } }, isValid).ok, false);
});
test('upsert / remove / filter / cap', () => {
  let n = 0; const id = () => `id${++n}`;
  const a = A.upsertEntry([], { name: 'A', addresses: { ethereum: ETH } }, id); assert.equal(a.ok, true); assert.equal(a.entry.id, 'id1');
  const b = A.upsertEntry(a.list, { name: 'B', addresses: { bitcoin: BTC } }, id); assert.equal(b.list.length, 2);
  const edited = A.upsertEntry(b.list, { id: 'id1', name: 'A2', addresses: { ethereum: ETH, solana: SOL } }, id);
  assert.equal(edited.list.length, 2); assert.equal(edited.list[0].name, 'A2'); assert.equal(edited.entry.id, 'id1');
  assert.equal(A.upsertEntry(b.list, { id: 'nope', name: 'x', addresses: { ethereum: ETH } }, id).ok, false);
  assert.deepEqual(A.entriesForCoin(edited.list, 'bitcoin').map((e) => e.name), ['B']);
  assert.deepEqual(A.entriesForCoin(edited.list, 'solana').map((e) => e.name), ['A2']);
  assert.deepEqual(A.removeEntry(edited.list, 'id2').map((e) => e.id), ['id1']);
  const full = Array.from({ length: A.MAX_ADDRESS_BOOK_ENTRIES }, (_, i) => ({ id: `f${i}`, name: 'n', addresses: { ethereum: ETH } }));
  assert.equal(A.upsertEntry(full, { name: 'x', addresses: { ethereum: ETH } }, id).ok, false);
  assert.equal(A.upsertEntry(full, { id: 'f3', name: 'renamed', addresses: { ethereum: ETH } }, id).ok, true); // editing a full book still works
});
test('readEntries re-validates stored data and tolerates garbage', () => {
  assert.deepEqual(A.readEntries(undefined), []); assert.deepEqual(A.readEntries('x'), []);
  const r = A.readEntries([{ id: 'a', name: 'ok', addresses: { ethereum: ETH, junk: 'y' } }, { id: 5 }, null, { id: 'b', name: '', addresses: { ethereum: ETH } }, { id: 'c', name: 'noaddr', addresses: {} }]);
  assert.deepEqual(r, [{ id: 'a', name: 'ok', addresses: { ethereum: ETH } }]);
});
