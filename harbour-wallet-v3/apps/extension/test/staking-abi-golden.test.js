// Golden ABI-parity test for hand-written staking ABIs (Lido, BNB StakeHub/StakeCredit).
// Fixture signatures come from the providers' official sources (see vectors.json "source").
// Rocket Pool has no official ABI package reachable offline: see scripts/verify-rocketpool-onchain.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { toFunctionSelector } from 'viem';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC = path.join(__dirname, '..', 'src', 'core', 'staking', 'evm.ts');
const V = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'staking', 'vectors.json'), 'utf8'));
const GROUP = { 'lido.stETH': 'stethAbi', 'lido.queue': 'queueAbi', 'bnb.stakeHub': 'stakeHubAbi', 'bnb.credit': 'creditAbi' };

let cache;
async function load() {
  if (cache) return cache;
  const out = path.join(tmpdir(), `staking-evm-${process.pid}.mjs`);
  await build({ entryPoints: [SRC], bundle: true, outfile: out, format: 'esm', platform: 'node', logLevel: 'silent' });
  return (cache = await import(pathToFileURL(out).href));
}

test('staking addresses are the documented ones', async () => {
  const e = await load();
  assert.equal(e.LIDO.queue.toLowerCase(), '0x889edc2edab5f40e902b864ad4d7ade8e412f9b1'); // docs.lido.fi
  assert.equal(e.LIDO.stETH.toLowerCase(), '0xae7ab96520de3a18e5e111b5eaab095312d7fe84'); // docs.lido.fi/contracts/lido
  assert.equal(e.STAKE_HUB, '0x0000000000000000000000000000000000002002'); // docs.bnbchain.org
});

test('every Harbour staking ABI function matches an official signature', async () => {
  const e = await load();
  for (const v of V.sigs) {
    const abi = e[GROUP[v.group]];
    const name = v.sig.split('(')[0];
    const fn = abi.find((x) => x.type === 'function' && x.name === name);
    assert.ok(fn, `${v.group}: ${name} missing in Harbour ABI`);
    const canon = (ins) => ins.map((i) => i.type === 'tuple' ? `(${canon(i.components)})` : i.type).join(',');
    assert.equal(`${name}(${canon(fn.inputs)})`, v.sig, `${v.group}: ${name} signature differs`);
  }
});

test('official selectors are reproduced by the encoder', () => {
  for (const v of V.sigs) assert.equal(toFunctionSelector('function ' + v.sig), v.selector);
});

test('Harbour ABIs contain no unvetted write functions', async () => {
  const e = await load();
  const allowedWrites = new Set(['submit', 'approve', 'requestWithdrawals', 'claimWithdrawal', 'deposit', 'burn', 'delegate', 'undelegate', 'redelegate', 'claim', 'aggregate3']);
  for (const k of ['stethAbi', 'queueAbi', 'rocketDepositAbi', 'rethAbi', 'stakeHubAbi', 'creditAbi'])
    for (const x of e[k]) if (x.type === 'function' && !['view', 'pure'].includes(x.stateMutability))
      assert.ok(allowedWrites.has(x.name), `${k}.${x.name} is an unexpected write`);
});
