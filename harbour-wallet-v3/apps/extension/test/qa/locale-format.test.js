// QA (unit): formatFiat in ar, de, ja, zh-TW (the plan's "zh-TC" is the Traditional-Chinese locale) and the slow-method allowance of the
// RPC failover. TEST_PLAN: T-X-005, T-CH-015.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const load = async (f) => { const o = await build({ stdin: { contents: `export * from './src/${f}.ts'`, resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' }, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64')); };
const F = await load('core/fiat');
const ctx = (locale, code, usdPer) => ({ locale, code, usdPer });
const NB = /[   ]/;

test('T-X-005: de — comma decimal, dot grouping, trailing euro sign', () => {
  const s = F.formatFiat(1234.56 * 1.1, ctx('de', 'EUR', 1.1));
  assert.match(s, /^1\.234,56[   ]€$/, s);
  assert.match(F.formatFiat(0, ctx('de', 'EUR', 1.1)), /^0,00[   ]€$/);
});
test('T-X-005: ja / zh-TW — currency symbol first, JPY without decimals, TWD with two', () => {
  assert.match(F.formatFiat(1234.56 * 0.0067, ctx('ja', 'JPY', 0.0067)), /^[¥￥]1,235$/);
  assert.match(F.formatFiat(1234.56 * 0.031, ctx('zh-TW', 'TWD', 0.031)), /^(NT\$|\$)1,234\.56$/);
  assert.equal(F.formatFiat(1234.56, ctx('en', 'USD', 1)), '$1,234.56');
});
test('T-X-005: ar — RTL-safe: the currency is wrapped in directional marks and digits are one consistent script', () => {
  const s = F.formatFiat(1234.56 * 0.2723, ctx('ar', 'AED', 0.2723));
  assert.match(s, /[‏؜]/, `directional mark present: ${JSON.stringify(s)}`);
  const latn = (s.match(/[0-9]/g) ?? []).length, arab = (s.match(/[٠-٩۰-۹]/g) ?? []).length;
  assert.ok((latn > 0) !== (arab > 0), `digits are all Latin or all Arabic-Indic: ${JSON.stringify(s)}`);
  assert.ok(/د\.إ|AED/.test(s), 'currency shown');
});
test('T-X-005: unknown locale falls back to en; non-finite is a dash; sub-cent floor', () => {
  assert.equal(F.formatFiat(12.5, ctx('xx-INVALID-zz', 'USD', 1)), '$12.50');
  assert.equal(F.formatFiat(Infinity, ctx('en', 'USD', 1)), '—'); assert.equal(F.formatFiat(NaN, ctx('en', 'USD', 1)), '—');
  assert.equal(F.formatFiat(0.001, ctx('en', 'USD', 1)), '<$0.01'); assert.equal(F.formatFiat(0.01, ctx('en', 'USD', 1)), '$0.01'); assert.equal(F.formatFiat(0, ctx('en', 'USD', 1)), '$0.00');
  assert.equal(F.formatFiatSigned(5, ctx('en', 'USD', 1)), '+$5.00'); assert.equal(F.formatFiatSigned(-5, ctx('en', 'USD', 1)), '-$5.00');
});
test('T-X-005: a tiny NEGATIVE amount keeps its sign (OBS-13 fixed)', () => {
  assert.equal(F.formatFiat(-0.001, ctx('en', 'USD', 1)), '>-$0.01');
  assert.equal(F.formatFiat(0.001, ctx('en', 'USD', 1)), '<$0.01');
  assert.match(F.formatFiat(-1e-10, ctx('en', 'BTC', 1)), /^-</);
});

// ---------------------------------------------------------------- T-CH-015
test('T-CH-015: the 30 s allowance applies only to the listed slow methods; every other call keeps the 10 s attempt timeout', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../src/kit/failoverFetch.ts', import.meta.url), 'utf8');
  const slow = src.match(/const SLOW_METHOD = (\/.*\/);/)[1];
  const re = new RegExp(slow.slice(1, -1));
  const body = (m) => JSON.stringify({ jsonrpc: '2.0', id: 1, method: m, params: [] });
  for (const m of ['getSupply', 'getProgramAccounts']) assert.ok(re.test(body(m)), m);
  for (const m of ['eth_blockNumber', 'getBalance', 'eth_getLogs', 'getSupplyX', 'getprogramaccounts', 'eth_sendRawTransaction']) assert.ok(!re.test(body(m)), m);
  assert.match(src, /const ATTEMPT_TIMEOUT_MS = 10_000;/); assert.match(src, /const SLOW_TIMEOUT_MS = 30_000;/);
  assert.match(src, /SLOW_METHOD\.test\(init\.body\) \? SLOW_TIMEOUT_MS : ATTEMPT_TIMEOUT_MS/, 'the longer timeout is chosen only through the method test');
});
void NB;
