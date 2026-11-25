// QA (property): every amount path is exact integer arithmetic up to 2^256-1, at 0, 18 and 36 decimals. Independent oracle: the
// decimal string is built and parsed with plain string/BigInt arithmetic written here, never with the code under test.
// TEST_PLAN: T-X-001 (extension part; the backend part is apps/backend/internal/api/qa_amounts_test.go).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { harness } from './harness.mjs';

const RUNS = Number(process.env.HB_FUZZ_RUNS ?? 300);
const { M } = await harness(`
  export { parseUnits, formatUnits as sendFormat } from './core/chains/send/util';
  export { formatUnits as adapterFormat } from './core/chains/adapters/types';
  export { toRaw } from './core/staking/service';
  export { toAtomic, fromAtomic } from './core/swap/amount';
  export { setApproveAmount, encodeApprove, decodeCalldata } from './core/provider/decode';
  export { decodeApprove } from './core/swap/relay';
`);
const MAX = 2n ** 256n - 1n;
const DECS = [0, 6, 8, 9, 18, 24, 36];
/** Oracle: raw → canonical decimal string (no trailing zeros, no trailing dot). */
const oracleFormat = (raw, d) => { if (d === 0) return raw.toString(); const s = raw.toString().padStart(d + 1, '0'); const w = s.slice(0, -d); const f = s.slice(-d).replace(/0+$/, ''); return f ? `${w}.${f}` : w; };
const rawArb = fc.oneof(fc.bigInt({ min: 0n, max: MAX }), fc.constantFrom(0n, 1n, MAX, MAX - 1n, 10n ** 18n, 10n ** 36n, 2n ** 53n + 1n, 2n ** 128n));

test('T-X-001: formatUnits (send and balance adapters) equals the string oracle for 0 … 2^256-1 at every decimals', () => {
  fc.assert(fc.property(rawArb, fc.constantFrom(...DECS), (raw, d) => {
    const want = oracleFormat(raw, d);
    assert.equal(M.sendFormat(raw, d), want); assert.equal(M.adapterFormat(raw, d), want); assert.equal(M.fromAtomic(raw, d), want); assert.equal(M.fromAtomic(raw.toString(), d), want);
  }), { numRuns: RUNS });
  assert.equal(M.sendFormat(MAX, 18), '115792089237316195423570985008687907853269984665640564039457.584007913129639935');
  assert.equal(M.sendFormat(MAX, 36), '115792089237316195423570985008687907853269.984665640564039457584007913129639935');
  assert.equal(M.sendFormat(-5n, 2), '-0.05');
});

test('T-X-001: parseUnits / toRaw / toAtomic invert formatUnits exactly; over-precise input is refused (send, staking) or never rounded up (swap)', () => {
  fc.assert(fc.property(rawArb, fc.constantFrom(...DECS), (raw, d) => {
    const s = oracleFormat(raw, d);
    assert.equal(M.parseUnits(s, d), raw);
    assert.equal(M.toAtomic(s, d), raw);
    assert.equal(M.toRaw(s, d), raw > 0n ? raw : null);
    // one digit too many
    const over = (s.includes('.') ? s : s + '.') + '0'.repeat(d - (s.split('.')[1]?.length ?? 0)) + '7';
    assert.throws(() => M.parseUnits(over, d), /Too many decimals/);
    assert.equal(M.toRaw(over, d), null);
    const sw = M.toAtomic(over, d); assert.ok(sw === null || sw === raw, 'swap input truncates extra digits, never rounds up');
  }), { numRuns: RUNS });
  for (const bad of ['', '.', '-1', '1e3', '0x10', 'NaN', 'Infinity', '1.2.3', ' 1 2', '١٢']) {
    assert.throws(() => M.parseUnits(bad, 18), /valid amount/, bad); assert.equal(M.toAtomic(bad, 18), null, bad);
  }
  assert.equal(M.toRaw('1,5', 6), 1_500_000n, 'staking accepts a decimal comma');
});

test('T-X-001: approve calldata carries the exact amount up to 2^256-1; a custom cap above 2^256-1 or ≤ 0 is refused', () => {
  const spender = '0x1111111254eeb25477b68fb85ed929f73a960582';
  fc.assert(fc.property(fc.bigInt({ min: 1n, max: MAX }), fc.bigInt({ min: 1n, max: MAX }), (site, user) => {
    const data = M.encodeApprove(spender, site);
    assert.equal(M.decodeApprove(data).amount, site);
    const re = M.setApproveAmount(data, user); assert.equal(M.decodeApprove(re).amount, user); assert.equal(M.decodeApprove(re).spender.toLowerCase(), spender);
    assert.equal(BigInt(M.decodeCalldata(re).amount), user);
  }), { numRuns: RUNS });
  const data = M.encodeApprove(spender, 5n);
  for (const a of [0n, -1n, MAX + 1n, 2n ** 300n]) assert.equal(M.setApproveAmount(data, a), null, String(a));
});

test('T-X-001: no Number()/parseFloat() conversion of a wei/raw amount feeds transaction building (static scan of the value-moving code)', () => {
  const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
  const files = ['background/handlers/chainSend.ts', 'background/swapService.ts', 'background/handlers/earn.ts', 'background/handlers/earnEvm.ts', 'background/handlers/approvals.ts', 'background/handlers/nfts.ts',
    'background/provider/service.ts', ...readdirSync(join(SRC, 'core/chains/send')).map((f) => `core/chains/send/${f}`)].filter((f) => { try { return statSync(join(SRC, f)).isFile(); } catch { return false; } });
  const hits = [];
  for (const f of files) readFileSync(join(SRC, f), 'utf8').split('\n').forEach((line, i) => {
    if (/(Number|parseFloat)\(\s*[^)]*\b(amount|raw|wei|value|fee|gas|balance)\b/i.test(line) && !/\/\/.*(display|label|usd)/i.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`);
  });
  // Reviewed, bounded uses: satoshi amounts in the UTXO planner (max supply 2.1e15 < 2^53) and wallet-core's numeric UTXO fields.
  // Each entry was read: none converts a value that is signed or broadcast.
  const REVIEWED = [
    /core\/chains\/send\/utxo\.ts:/,                    // satoshis: bounded by 2.1e15 < 2^53
    /background\/provider\/service\.ts:\d+: let target: number;/, // chain id of wallet_switchEthereumChain (not an amount)
    /core\/chains\/send\/algorand\.ts:\d+:.*Math\.max\(Number\(tp\[/,         // Algorand min fee in microAlgos (a few thousand), BigInt'ed again
    /core\/chains\/send\/solana\.ts:\d+: const decimals/,     // token decimals
    /core\/chains\/send\/sui\.ts:\d+:.*\.sort\(/,             // sort comparator: only the sign of a BigInt difference is used
  ];
  const unreviewed = hits.filter((h) => !REVIEWED.some((re) => re.test(h)));
  assert.deepEqual(unreviewed, [], `Number() on an amount in value-moving code:\n${unreviewed.join('\n')}`);
});
