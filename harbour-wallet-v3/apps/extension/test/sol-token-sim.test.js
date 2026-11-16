// Solana pre-sign preview: SPL token balance changes (Token + Token-2022) and the owner/delegate drainer patterns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/provider/solSim'; export { b58encode, b58decode, bytesToB64 } from './core/provider/base58';`, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const key = (n) => M.b58encode(new Uint8Array(32).fill(n));
const WALLET = key(1), ATTACKER = key(9), USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', BONK = key(7);
const ATA_USDC = key(2), ATA_BONK = key(3), NEW_ATA = key(4), PROGRAM = key(5);
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
function spl({ mint, owner, amount, delegate = null, delegated = 0n }) {
  const b = new Uint8Array(165); const dv = new DataView(b.buffer);
  b.set(M.b58decode(mint), 0); b.set(M.b58decode(owner), 32); dv.setBigUint64(64, BigInt(amount), true);
  if (delegate) { dv.setUint32(72, 1, true); b.set(M.b58decode(delegate), 76); } b[108] = 1; dv.setBigUint64(121, BigInt(delegated), true); return b;
}
const acct = (data) => ({ owner: TOKEN, lamports: 2039280, data: [M.bytesToB64(data), 'base64'] });
// legacy message: header [1 signer, 0 ro-signed, 1 ro-unsigned], keys: wallet(w,s), ATA_USDC(w), ATA_BONK(w), NEW_ATA(w), PROGRAM(ro)
function txBytes() {
  const keys = [WALLET, ATA_USDC, ATA_BONK, NEW_ATA, PROGRAM].map((k) => [...M.b58decode(k)]);
  const msg = [1, 0, 1, keys.length, ...keys.flat(), ...new Array(32).fill(8), 1, 4, 4, 0, 1, 2, 3, 1, 0];
  return new Uint8Array([1, ...new Array(64).fill(0), ...msg]);
}
function rpc(post) {
  return async (method, params) => {
    if (method === 'getTokenAccountsByOwner') return { value: params[1].programId === TOKEN ? [
      { pubkey: ATA_USDC, account: acct(spl({ mint: USDC, owner: WALLET, amount: 500_000_000n })) },
      { pubkey: ATA_BONK, account: acct(spl({ mint: BONK, owner: WALLET, amount: 1000n })) }] : [] };
    if (method === 'getBalance') return { value: 1_000_000_000 };
    if (method === 'getMultipleAccounts') return { value: params[0].map(() => { const m = new Uint8Array(82); m[44] = 5; return { data: [M.bytesToB64(m), 'base64'] }; }) };
    if (method === 'simulateTransaction') { const addrs = params[1].accounts.addresses; assert.equal(addrs[0], WALLET); assert.ok(!addrs.includes(PROGRAM), 'read-only accounts are not watched');
      return { value: { err: null, unitsConsumed: 1, accounts: addrs.map((a) => (a === WALLET ? { lamports: 999_995_000 } : post[a] ?? null)) } }; }
    throw new Error(method);
  };
}

test('token outflow, incoming new token and decimals are reported per mint', async () => {
  const r = await M.simulateSolTx(rpc({
    [ATA_USDC]: acct(spl({ mint: USDC, owner: WALLET, amount: 400_000_000n })),
    [ATA_BONK]: acct(spl({ mint: BONK, owner: WALLET, amount: 1000n })),
    [NEW_ATA]: acct(spl({ mint: key(6), owner: WALLET, amount: 42n })),
  }), txBytes(), WALLET);
  assert.equal(r.ok, true); assert.equal(r.tokensChecked, true); assert.equal(r.solDelta, -5000n);
  const usdc = r.tokenChanges.find((c) => c.mint === USDC); assert.deepEqual([usdc.direction, usdc.amount, usdc.symbol, usdc.decimals], ['out', '100000000', 'USDC', 6]);
  const nw = r.tokenChanges.find((c) => c.mint === key(6)); assert.deepEqual([nw.direction, nw.amount, nw.decimals], ['in', '42', 5]);
  assert.ok(!r.tokenChanges.some((c) => c.mint === BONK), 'unchanged balances are not listed');
  assert.deepEqual(r.tokenWarnings, []);
});
test('drainer patterns: account handed to another owner, spend delegated, account closed', async () => {
  const r = await M.simulateSolTx(rpc({
    [ATA_USDC]: acct(spl({ mint: USDC, owner: ATTACKER, amount: 500_000_000n })),
    [ATA_BONK]: acct(spl({ mint: BONK, owner: WALLET, amount: 1000n, delegate: ATTACKER, delegated: 1000n })),
  }), txBytes(), WALLET);
  assert.ok(r.tokenWarnings.includes('tokenOwnerChanged')); assert.ok(r.tokenWarnings.includes('tokenDelegated'));
  assert.equal(r.tokenChanges.find((c) => c.mint === USDC).direction, 'out', 'an account you no longer own counts as lost');
  const closed = M.tokenDiff(WALLET, new Map([[ATA_BONK, { mint: BONK, owner: WALLET, amount: 7n, delegate: null, delegatedAmount: 0n }]]), new Map([[ATA_BONK, null]]));
  assert.equal(closed.changes.get(BONK), -7n);
});
test('token accounts unreadable: SOL-only preview, reported as unchecked', async () => {
  const base = rpc({}); const r = await M.simulateSolTx(async (m, p) => { if (m === 'getTokenAccountsByOwner') throw new Error('rate limited'); return base(m, p); }, txBytes(), WALLET);
  assert.equal(r.ok, true); assert.equal(r.tokensChecked, false); assert.equal(r.tokenChanges, undefined);
});
