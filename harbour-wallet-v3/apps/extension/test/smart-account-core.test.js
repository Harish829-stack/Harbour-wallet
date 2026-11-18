// Smart accounts core (src/core/smartAccount): builders reproduce MetaMask's kit byte for byte (fixtures/aa/vectors.json, made by the kit
// with viem 2.31.4) using the extension's pinned viem and its existing signHash. Pure code, no network.
process.env.DO_NOT_TRACK = '1'; // tests below load the kit's root entry to compare with it; analytics must stay off (the offline test covers production code)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/constants'; export * from './core/smartAccount/abi'; export * from './core/smartAccount/userOp'; export * from './core/smartAccount/kit'; export * from './core/smartAccount/delegation'; export { signHash, evmAccountFromBytes } from './core/provider/evmAccount';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, logLevel: 'silent', define: { 'import.meta.env': '{}' } });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const v = JSON.parse(readFileSync(new URL('./fixtures/aa/vectors.json', import.meta.url), 'utf8'));
const PK = hexToBytes('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'); // public anvil test key used by the fixtures
const signer = (h) => M.signHash(h, PK);
const SINK = '0x000000000000000000000000000000000000dEaD';
const calls1 = [{ to: SINK, value: 5n, data: '0x' }];
const calls2 = [...calls1, { to: '0x1111111111111111111111111111111111111111', value: 0n, data: '0xa9059cbb0000000000000000000000002222222222222222222222222222222222222222000000000000000000000000000000000000000000000000000000000000000a' }];
const toOp = (o) => ({ sender: o.sender, nonce: BigInt(o.nonce), callData: o.callData, callGasLimit: BigInt(o.callGasLimit), verificationGasLimit: BigInt(o.verificationGasLimit), preVerificationGas: BigInt(o.preVerificationGas), maxFeePerGas: BigInt(o.maxFeePerGas), maxPriorityFeePerGas: BigInt(o.maxPriorityFeePerGas), ...(o.paymaster ? { paymaster: o.paymaster, paymasterVerificationGasLimit: BigInt(o.paymasterVerificationGasLimit), paymasterPostOpGasLimit: BigInt(o.paymasterPostOpGasLimit), paymasterData: o.paymasterData } : {}), signature: '0x' });

test('pinned constants: delegate and EntryPoint match the fixtures; only testnets are pinned', () => {
  assert.equal(M.ENTRYPOINT_V07.toLowerCase(), v.env.EntryPoint.toLowerCase());
  assert.deepEqual(Object.keys(M.DELEGATES).map(Number).sort((a, b) => a - b), [84532, 11155111]);
  for (const a of Object.values(M.DELEGATES)) assert.equal(a.toLowerCase(), v.env.impl.toLowerCase());
  assert.ok(Object.isFrozen(M.DELEGATES) && Object.isFrozen(M.PAYMASTERS));
  assert.equal(M.delegateFor(1), null); assert.equal(M.isSmartAccountChain(1), false); assert.equal(M.isSmartAccountChain(84532), true);
  assert.equal(M.isPinnedPaymaster(84532, '0x777777777777AeC03fd955926DbF81597e66834C'), true);
  assert.equal(M.isPinnedPaymaster(84532, '0x' + '22'.repeat(20)), false);
});
test('call encoding equals the kit (single and batch)', () => {
  assert.equal(M.encodeCalls(calls1).toLowerCase(), v.callData1.toLowerCase());
  assert.equal(M.encodeCalls(calls2).toLowerCase(), v.callData2.toLowerCase());
  assert.throws(() => M.encodeCalls([]), /No calls/);
  assert.throws(() => M.encodeCalls(Array(17).fill(calls1[0])), /At most 16/);
});
test('normalizeCall is strict', () => {
  assert.deepEqual({ ...M.normalizeCall({ to: SINK.toLowerCase(), value: '0x5', data: '0x' }) }, { to: SINK, value: 5n, data: '0x' });
  for (const bad of [{ to: 'nope' }, { to: SINK, value: -1 }, { to: SINK, value: 'x' }, { to: SINK, data: '0xabc' }, { to: SINK, data: 'zz' }, { to: 5 }]) assert.throws(() => M.normalizeCall(bad), /Invalid/);
});
test('kit-built typed data signs to the pinned vectors (op1 without paymaster, op2 with paymaster)', async () => {
  const owner = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  for (const k of ['op1', 'op2']) assert.equal((await M.signUserOp(toOp(v[k].op), v.chainId, owner)).toLowerCase(), v[k].sig.toLowerCase(), k);
  assert.ok(v.op2.op.paymaster, 'op2 carries a paymaster, so paymasterAndData is covered');
});
test('the account key bytes sign the same way (evmAccountFromBytes signer, as in the worker)', async () => {
  const acct = M.evmAccountFromBytes(PK);
  for (const k of ['op1', 'op2']) assert.equal((await M.signUserOp(toOp(v[k].op), v.chainId, acct)).toLowerCase(), v[k].sig.toLowerCase(), k);
});
test('stub signature equals the kit stub and the RPC op form has no factory fields', async () => {
  const { toMetaMaskSmartAccount, Implementation } = await import('@metamask/smart-accounts-kit');
  const { createPublicClient, custom } = await import('viem');
  const client = createPublicClient({ chain: { id: v.chainId, name: 'x', nativeCurrency: { name: 'E', symbol: 'E', decimals: 18 }, rpcUrls: { default: { http: [] } } }, transport: custom({ request: async () => '0x' }) });
  const kit = await toMetaMaskSmartAccount({ client, implementation: Implementation.Stateless7702, address: v.account, signer: { account: privateKeyToAccount('0x' + '11'.repeat(32)) } });
  assert.equal(M.STUB_SIGNATURE, await kit.getStubSignature());
  const r = M.toRpcOp({ ...toOp(v.op2.op), signature: M.STUB_SIGNATURE });
  assert.ok(r.paymaster && r.paymasterData); assert.equal(r.factory, undefined); assert.match(r.nonce, /^0x/);
});
test('the pinned delegate and DelegationManager equal the kit deployments for every pinned chain', async () => {
  const { getSmartAccountsEnvironment } = await import('@metamask/smart-accounts-kit');
  for (const id of Object.keys(M.DELEGATES).map(Number)) {
    const env = getSmartAccountsEnvironment(id);
    assert.equal(env.implementations.EIP7702StatelessDeleGatorImpl.toLowerCase(), M.DELEGATES[id].toLowerCase());
    assert.equal(env.EntryPoint.toLowerCase(), M.ENTRYPOINT_V07.toLowerCase());
  }
});
test('authorization digest and both type-4 transactions equal the kit', () => {
  assert.equal(M.authorizationDigest(v.env.impl, v.chainId, 3).toLowerCase(), v.authDigest.toLowerCase());
  const base = { account: v.account, chainId: v.chainId, txNonce: 2, maxFeePerGas: 3_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n, gas: 100_000n };
  assert.equal(M.buildSignedType4({ ...base, kind: 'upgrade' }, signer).raw.toLowerCase(), v.upgradeRaw.toLowerCase());
  assert.equal(M.buildSignedType4({ ...base, kind: 'revoke' }, signer).raw.toLowerCase(), v.revokeRaw.toLowerCase());
  const up = M.buildSignedType4({ ...base, kind: 'upgrade' }, signer);
  assert.equal(up.authorization.nonce, 3, 'authorization nonce = transaction nonce + 1');
  assert.equal(M.buildSignedType4({ ...base, kind: 'upgrade', gas: undefined }, signer).raw.length > 10, true);
});
test('type-4 builder refuses chain 0, unpinned chains, bad nonces and bad fees', () => {
  const base = { account: v.account, chainId: v.chainId, txNonce: 0, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n };
  assert.throws(() => M.buildSignedType4({ ...base, chainId: 0, kind: 'revoke' }, signer), /Invalid chain/);
  assert.throws(() => M.buildSignedType4({ ...base, chainId: 0, kind: 'upgrade' }, signer), /Invalid chain/);
  assert.throws(() => M.buildSignedType4({ ...base, chainId: 1, kind: 'upgrade' }, signer), /not available/);
  assert.throws(() => M.buildSignedType4({ ...base, txNonce: -1, kind: 'upgrade' }, signer), /Invalid nonce/);
  assert.throws(() => M.buildSignedType4({ ...base, maxFeePerGas: 0n, kind: 'upgrade' }, signer), /Invalid fee/);
  assert.throws(() => M.buildSignedType4({ ...base, maxFeePerGas: 1n, maxPriorityFeePerGas: 2n, kind: 'upgrade' }, signer), /Invalid fee/);
  assert.equal(M.authorizationTarget('revoke', 84532), M.ZERO_ADDRESS);
});
