// Aave (Sepolia, Base Sepolia) and Uniswap (Sepolia) constants + Aave Pool ABI parity with the official packages.
// Fixture: test/fixtures/defi/vectors.json, generated from @bgd-labs/aave-address-book, @uniswap/sdk-core, universal-router-sdk, v4-sdk.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { toFunctionSelector } from 'viem';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..', 'src', 'integrations', 'testnet-defi');
const V = JSON.parse(fs.readFileSync(path.join(dir, 'fixtures', 'defi', 'vectors.json'), 'utf8'));
const lc = (s) => s.toLowerCase();
async function load(file) {
  const out = path.join(tmpdir(), `defi-${path.basename(file)}-${process.pid}.mjs`);
  await build({ entryPoints: [path.join(root, file)], bundle: true, outfile: out, format: 'esm', platform: 'node', logLevel: 'silent' });
  return import(pathToFileURL(out).href);
}

test('Aave pools and data providers equal the official address book', async () => {
  const c = await load('config.ts');
  assert.equal(lc(c.SEPOLIA.pool), lc(V.aave.sepolia.pool));
  assert.equal(lc(c.SEPOLIA.dataProvider), lc(V.aave.sepolia.dataProvider));
  assert.equal(lc(c.BASE_SEPOLIA.pool), lc(V.aave.baseSepolia.pool));
  assert.equal(lc(c.BASE_SEPOLIA.dataProvider), lc(V.aave.baseSepolia.dataProvider));
});

test('Uniswap WETH9 and Universal Router equal the official SDK registries', async () => {
  const c = await load('config.ts');
  assert.equal(lc(c.SEPOLIA.weth), lc(V.uniswap.weth9Sepolia));
  assert.equal(lc(c.SEPOLIA.universalRouter), lc(V.uniswap.universalRouterSepolia['2.1.2']));
});

test('Aave Pool ABI functions equal the official IPool signatures', async () => {
  const a = await load('abis.ts');
  for (const sig of V.poolSigs) {
    const name = sig.split('(')[0];
    const fn = a.poolAbi.find((x) => x.type === 'function' && x.name === name);
    assert.ok(fn, `${name} missing`);
    assert.equal(`${name}(${fn.inputs.map((i) => i.type).join(',')})`, sig);
    assert.equal(toFunctionSelector(`function ${sig}`), toFunctionSelector(fn));
  }
});

test('Universal Router command ids and v4 action ids equal the official constants', () => {
  const src = fs.readFileSync(path.join(root, 'universalRouter.ts'), 'utf8');
  const grab = (name) => {
    const m = src.match(new RegExp(`const ${name} = \\{([^}]*)\\} as const`));
    assert.ok(m, `${name} not found`);
    return Object.fromEntries([...m[1].matchAll(/(\w+):\s*(0x[0-9a-fA-F]+)/g)].map((x) => [x[1], Number(x[2])]));
  };
  const C = grab('C'), A = grab('A');
  for (const [k, v] of Object.entries(C)) assert.equal(v, V.commands[k], `command ${k}`);
  for (const [k, v] of Object.entries(A)) assert.equal(v, V.v4Actions[k], `v4 action ${k}`);
});
