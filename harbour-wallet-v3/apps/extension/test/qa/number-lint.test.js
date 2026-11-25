// QA (lint): Number()/parseFloat() applied to an amount-like identifier anywhere under src/core/** (core/chains/send is covered
// by the stricter scan in amounts.prop.test.js). Every hit must be on a reviewed allow-list of display / fiat / metadata uses;
// a new hit fails the test and forces a human to classify it. TEST_PLAN: T-X-002.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = fileURLToPath(new URL('../../src/core/', import.meta.url));
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });

// Each entry: file, a distinctive fragment of the line, and why it is not a signed/broadcast amount.
const REVIEWED = [
  ['gasFees.ts', 'Number(BigInt(wei)) / 1e9', 'gwei label for display only; fee decisions stay BigInt'],
  ['txHistory.ts', 'historic_exchange_rate', 'fiat exchange rate for display'],
  ['txHistory.ts', "Number(x.amount) === 0", 'zero test of a display amount to hide spam rows'],
  ['ramps/pA.ts', 'Number(req.amount)', 'fiat/crypto quote amount sent to a ramp provider; no on-chain value'],
  ['ramps/pB.ts', 'Number(req.amount)', 'fiat/crypto quote amount sent to a ramp provider; no on-chain value'],
  ['ramps/pC.ts', 'Number(req.amount)', 'fiat/crypto quote amount sent to a ramp provider; no on-chain value'],
  ['sendService.ts', 'Number(raw.decimals)', 'token decimals metadata'],
  ['erc20.ts', 'Number(d.value)', 'token decimals read from eth_call'],
  ['chains/adapters/tokens.ts', "Number(BigInt('0x'", 'token decimals read from eth_call'],
  ['perps/hyperliquid.ts', 'Number(', 'venue market data (leverage, px, sz): display; orders are signed from typed fields elsewhere'],
  ['nfts/alchemy.ts', 'Number(item.balance)', 'NFT owned count for display'],
  ['nfts/blockscout.ts', 'Number(e.amount)', 'NFT owned count for display'],
  ['activity/merge.ts', 'Number(x.amount) === 0', 'zero test of a display amount to hide spam rows'],
  ['staking/solana.ts', 'result?.value?.total', 'total SOL supply used for an APY estimate'],
  ['smartAccount/permissions.ts', 'Number(BigInt(raw.chainId', 'chain id, not an amount'],
  ['swap/amount.ts', 'Number(value)', 'fmtToken display formatting'],
  ['swap/rules.ts', 'Number(raw)', 'slippage percentage'],
  ['swap/relay.ts', 'Number(fee.currency?.decimals', 'quote fee decimals / USD display values'],
  ['swap/relay.ts', 'Number(fee.amountUsd)', 'quote fee USD display'],
  ['swap/relay.ts', 'Number(gas.amountUsd)', 'quote fee USD display'],
];

test('T-X-002: every Number()/parseFloat() on an amount-like value in src/core/** is a reviewed display/metadata use', () => {
  const hits = [];
  for (const f of walk(CORE)) {
    const rel = relative(CORE, f).replace(/\\/g, '/');
    if (rel.startsWith('chains/send/')) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/(Number|parseFloat)\([^)]*\b(amount|raw|wei|value|balance|fee|gas)\b/i.test(line)) hits.push({ rel, n: i + 1, line });
    });
  }
  const unreviewed = hits.filter((h) => !REVIEWED.some(([file, frag]) => h.rel.endsWith(file) && h.line.includes(frag)));
  assert.deepEqual(unreviewed.map((h) => `${h.rel}:${h.n}: ${h.line.trim().slice(0, 140)}`), [], 'unreviewed Number() on an amount in core');
  // The allow-list must not rot: each reviewed entry still matches a real line.
  const stale = REVIEWED.filter(([file, frag]) => !hits.some((h) => h.rel.endsWith(file) && h.line.includes(frag)));
  assert.deepEqual(stale.map((s) => `${s[0]}: ${s[1]}`), [], 'stale allow-list entries');
});
