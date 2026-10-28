// EIP-7702: a wallet with a delegation designator is still a wallet, never "a smart contract".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const out = await build({ entryPoints: [fileURLToPath(new URL('../src/core/evmCode.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('code classification', () => {
  const delegated = '0xef0100' + '63c0c19a282a1b52b07dd5a65b58948a07dae32b';
  assert.deepEqual(['0x', '', '0x0', delegated, delegated.toUpperCase().replace('0XEF', '0xef'), '0x6080604052', undefined, null, 'garbage'].map(M.codeKind),
    ['eoa', 'eoa', 'eoa', 'delegated', 'delegated', 'contract', 'unknown', 'unknown', 'unknown']);
  assert.equal(M.isContractCode(delegated), false); assert.equal(M.isWalletCode(delegated), true);
  assert.equal(M.delegationTarget(delegated), '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b');
  assert.equal(M.isContractCode('0x6080604052'), true); assert.equal(M.isContractCode(undefined), false);
});
