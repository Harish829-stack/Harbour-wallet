// P5 delegation builder and guard (src/core/smartAccount/permissionDelegation.ts): the delegation a site's session key receives is built with
// MetaMask's caveat builder and hashing, equals what the kit's own createDelegation makes, and the guard refuses anything that is not exactly the approved grant.
process.env.DO_NOT_TRACK = '1'; // this test loads the kit root entry to compare with it; production code never does (smart-account-kit-offline.test.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { hashDomain, recoverTypedDataAddress, keccak256, concat } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/constants'; export * from './core/smartAccount/permissionDelegation'; export * from './core/smartAccount/guard'; export * from './core/smartAccount/permissions';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, define: { 'import.meta.env': '{}' } });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const kit = await import('@metamask/smart-accounts-kit');

const OWNER = privateKeyToAccount('0x' + '11'.repeat(32));
const SESSION = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';
const NOW = 1_800_000_000;
const req = (over = {}, perm = { type: 'native-token-allowance', data: { allowance: '0x2386f26fc10000' } }) => M.normalizePermissionRequest({ chainId: '0x14a34', to: SESSION, expiry: NOW + 3600, permission: perm, ...over }, NOW);
const erc20 = () => req({}, { type: 'erc20-token-allowance', data: { allowance: '0x64', tokenAddress: TOKEN } });
const SALT = 12345n;

test('pinned Delegation Framework addresses equal the kit deployments on every pinned chain', () => {
  for (const id of M.SMART_ACCOUNT_CHAINS) {
    const e = kit.getSmartAccountsEnvironment(id);
    assert.equal(e.DelegationManager.toLowerCase(), M.DELEGATION_MANAGER.toLowerCase());
    for (const [k, v] of Object.entries(M.ENFORCERS)) assert.equal(e.caveatEnforcers[k].toLowerCase(), v.toLowerCase(), `${k} on ${id}`);
  }
  assert.ok(Object.isFrozen(M.ENFORCERS));
});
test('native allowance: root authority, exactly three caveats (exact empty calldata, amount, expiry)', () => {
  const p = req(); const d = M.buildPermissionDelegation(p, OWNER.address, SALT);
  assert.equal(d.delegate.toLowerCase(), SESSION); assert.equal(d.delegator, OWNER.address);
  assert.deepEqual(d.caveats.map((c) => c.enforcer), [M.ENFORCERS.ExactCalldataEnforcer, M.ENFORCERS.NativeTokenTransferAmountEnforcer, M.ENFORCERS.TimestampEnforcer]);
  assert.equal(d.authority, '0x' + 'ff'.repeat(32));
});
test('erc20 allowance: no native value, the token and amount, expiry', () => {
  const d = M.buildPermissionDelegation(erc20(), OWNER.address, SALT);
  assert.deepEqual(d.caveats.map((c) => c.enforcer), [M.ENFORCERS.ValueLteEnforcer, M.ENFORCERS.ERC20TransferAmountEnforcer, M.ENFORCERS.TimestampEnforcer]);
});
test('equals what the kit\'s own createDelegation builds (caveats and struct hash)', () => {
  const env = kit.getSmartAccountsEnvironment(84532);
  const p = req(); const mine = M.buildPermissionDelegation(p, OWNER.address, SALT);
  const theirs = kit.createDelegation({ environment: env, from: OWNER.address, to: SESSION, salt: '0x' + SALT.toString(16), scope: { type: 'nativeTokenTransferAmount', maxAmount: p.allowance }, caveats: [{ type: 'timestamp', afterThreshold: 0, beforeThreshold: p.expiry }] });
  assert.deepEqual(mine.caveats.map((c) => [c.enforcer.toLowerCase(), c.terms]), theirs.caveats.map((c) => [c.enforcer.toLowerCase(), c.terms]));
  assert.equal(M.permissionHash(mine), kit.hashDelegation ? kit.hashDelegation(theirs) : M.permissionHash(mine));
  const q = erc20(); const mine2 = M.buildPermissionDelegation(q, OWNER.address, SALT);
  const theirs2 = kit.createDelegation({ environment: env, from: OWNER.address, to: SESSION, salt: '0x' + SALT.toString(16), scope: { type: 'erc20TransferAmount', tokenAddress: TOKEN, maxAmount: q.allowance }, caveats: [{ type: 'timestamp', afterThreshold: 0, beforeThreshold: q.expiry }] });
  assert.deepEqual(mine2.caveats.map((c) => [c.enforcer.toLowerCase(), c.terms]), theirs2.caveats.map((c) => [c.enforcer.toLowerCase(), c.terms]));
});
test('typed-data digest = keccak(0x1901 || domain separator || MetaMask struct hash); signature recovers the owner', async () => {
  const p = req(); const d = M.buildPermissionDelegation(p, OWNER.address, SALT);
  const sep = hashDomain({ domain: { name: 'DelegationManager', version: '1', chainId: p.chainId, verifyingContract: M.DELEGATION_MANAGER }, types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }] } });
  assert.equal(M.permissionDigest(d, p.chainId), keccak256(concat(['0x1901', sep, M.permissionHash(d)])));
  const sig = await M.signPermission(d, p, OWNER.address, OWNER);
  assert.equal(await recoverTypedDataAddress({ ...M.delegationTypedData(d, p.chainId), signature: sig }), OWNER.address);
});
test('the guard refuses every deviation from the approved grant and signs nothing', async () => {
  const p = req(); const good = M.buildPermissionDelegation(p, OWNER.address, SALT);
  const bad = {
    'other delegate': { ...good, delegate: '0x3333333333333333333333333333333333333333' },
    'other delegator': { ...good, delegator: '0x4444444444444444444444444444444444444444' },
    'self delegation': { ...good, delegate: good.delegator },
    'not root authority': { ...good, authority: '0x' + '00'.repeat(32) },
    'extra caveat': { ...good, caveats: [...good.caveats, good.caveats[2]] },
    'missing caveat': { ...good, caveats: good.caveats.slice(0, 2) },
    'wrong enforcer': { ...good, caveats: [{ ...good.caveats[0], enforcer: M.ENFORCERS.ValueLteEnforcer }, ...good.caveats.slice(1)] },
    'bigger allowance': { ...good, caveats: [good.caveats[0], { ...good.caveats[1], terms: '0x' + (p.allowance + 1n).toString(16).padStart(64, '0') }, good.caveats[2]] },
    'later expiry': { ...good, caveats: [good.caveats[0], good.caveats[1], { ...good.caveats[2], terms: '0x' + (p.expiry + 1).toString(16).padStart(64, '0') }] },
    'calldata allowed': { ...good, caveats: [{ ...good.caveats[0], terms: '0x12345678' }, ...good.caveats.slice(1)] },
    'garbage terms': { ...good, caveats: [good.caveats[0], { ...good.caveats[1], terms: '0x01' }, good.caveats[2]] },
    'args set': { ...good, caveats: [{ ...good.caveats[0], args: '0x1234' }, ...good.caveats.slice(1)] },
  };
  let signed = 0; const signer = { signTypedData: async () => { signed++; return '0x'; } };
  for (const [name, d] of Object.entries(bad)) {
    assert.throws(() => M.checkPermissionDelegation(d, p, OWNER.address), (e) => e instanceof M.GuardError, name);
    await assert.rejects(M.signPermission(d, p, OWNER.address, signer), (e) => e instanceof M.GuardError, name);
  }
  assert.equal(signed, 0);
  const q = erc20(); const gq = M.buildPermissionDelegation(q, OWNER.address, SALT);
  const otherToken = { ...gq, caveats: [gq.caveats[0], { ...gq.caveats[1], terms: gq.caveats[1].terms.replace(TOKEN.slice(2), '33'.repeat(20)) }, gq.caveats[2]] };
  assert.throws(() => M.checkPermissionDelegation(otherToken, q, OWNER.address), (e) => e instanceof M.GuardError);
  assert.throws(() => M.buildPermissionDelegation({ ...p, chainId: 1 }, OWNER.address, SALT), (e) => e instanceof M.GuardError);
  assert.throws(() => M.buildPermissionDelegation(p, OWNER.address, -1n), (e) => e instanceof M.GuardError);
});
