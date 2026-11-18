// P5 end-to-end check on a TESTNET (Sepolia or Base Sepolia). Uses the SAME production code the wallet uses to enable the smart account,
// build and sign the permission delegation, and revoke it; the "site" side (redeeming through MetaMask's DelegationManager) is plain viem.
// It proves on real contracts that: the limits hold (amount, total, delegate-only, exact calldata, expiry) and that a revoked grant stops working.
//
//   node scripts/p5-e2e.mjs keygen                       # prints a NEW throwaway testnet address + key (never use it on mainnet)
//   RPC_URL=<rpc> OWNER_PK=<key> [CHAIN=sepolia|base-sepolia] [WAIT_EXPIRY=1] node scripts/p5-e2e.mjs
//
// Fund the printed address with about 0.02 test ETH first. It refuses any chain that is not Sepolia or Base Sepolia, never prints a key
// (except `keygen`), and spends at most a few thousandths of test ETH. Exit code 0 only if every check passes.
process.env.DO_NOT_TRACK = '1';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData, hexToBytes } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia, baseSepolia } from 'viem/chains';
import { DelegationManager as DM_ABI } from '@metamask/delegation-abis';
import { encodeSingleExecution } from '@metamask/smart-accounts-kit/utils';

if (process.argv[2] === 'keygen') { const k = generatePrivateKey(); console.log(`address ${privateKeyToAccount(k).address}\nkey     ${k}\nTestnet only. Fund the address with ~0.02 test ETH, then run with OWNER_PK=<key>.`); process.exit(0); }

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/constants'; export * from './core/smartAccount/permissions'; export * from './core/smartAccount/permissionDelegation'; export * from './core/smartAccount/delegation'; export { signHash } from './core/provider/evmAccount';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, define: { 'import.meta.env': '{}' } });
const W = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const chains = { sepolia, 'base-sepolia': baseSepolia }; const chain = chains[process.env.CHAIN ?? 'sepolia'];
if (!chain || !process.env.RPC_URL || !/^0x[0-9a-fA-F]{64}$/.test(process.env.OWNER_PK ?? '')) { console.error('Set RPC_URL, OWNER_PK (and optionally CHAIN=sepolia|base-sepolia). Run `node scripts/p5-e2e.mjs keygen` for a throwaway key.'); process.exit(2); }
const pub = createPublicClient({ chain, transport: http(process.env.RPC_URL) });
if ((await pub.getChainId()) !== chain.id || !W.isSmartAccountChain(chain.id)) { console.error('Refusing: the RPC is not the expected testnet.'); process.exit(2); }
const ownerPk = hexToBytes(process.env.OWNER_PK); const owner = privateKeyToAccount(process.env.OWNER_PK);
const ownerWallet = createWalletClient({ account: owner, chain, transport: http(process.env.RPC_URL) });
const results = []; const check = (name, ok, note = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };
const wait = (hash) => pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
const bal = (a) => pub.getBalance({ address: a });
const DM = W.DELEGATION_MANAGER; const MODE_SINGLE = '0x' + '00'.repeat(32);
const short = (e) => String(e?.shortMessage ?? e?.message ?? e).split('\n')[0].slice(0, 140);

console.log(`chain ${chain.name}, owner ${owner.address}, balance ${formatEther(await bal(owner.address))}`);
if ((await bal(owner.address)) < parseEther('0.015')) { console.error('Owner needs at least 0.015 test ETH.'); process.exit(2); }

// 1. Enable the smart account with the wallet's own builder (self-sent type-4, authorization nonce = tx nonce + 1).
const code = await pub.getCode({ address: owner.address });
const pinned = (c) => !!c && c.toLowerCase() === ('0xef0100' + W.DELEGATES[chain.id].slice(2)).toLowerCase();
if (!pinned(code)) {
  if (code && code !== '0x') { console.error('Owner is delegated to something else; use a fresh throwaway key.'); process.exit(2); }
  const nonce = await pub.getTransactionCount({ address: owner.address, blockTag: 'pending' }); const fees = await pub.estimateFeesPerGas();
  const built = W.buildSignedType4({ account: owner.address, chainId: chain.id, txNonce: nonce, maxFeePerGas: (fees.maxFeePerGas * 12n) / 10n, maxPriorityFeePerGas: fees.maxPriorityFeePerGas, kind: 'upgrade' }, (d) => W.signHash(d, ownerPk));
  await wait(await pub.sendRawTransaction({ serializedTransaction: built.raw }));
}
check('smart account is on (account runs the pinned delegate)', pinned(await pub.getCode({ address: owner.address })));

// 2. A "site": a fresh session key (funded for gas) and a fresh recipient.
const session = privateKeyToAccount(generatePrivateKey()); const sessionWallet = createWalletClient({ account: session, chain, transport: http(process.env.RPC_URL) });
const other = privateKeyToAccount(generatePrivateKey());
await wait(await ownerWallet.sendTransaction({ to: session.address, value: parseEther('0.003') }));
const recipient = privateKeyToAccount(generatePrivateKey()).address;

const grant = async (allowance, ttlSec) => {
  const now = Math.floor(Date.now() / 1000);
  const p = W.normalizePermissionRequest({ chainId: '0x' + chain.id.toString(16), to: session.address, expiry: now + ttlSec, permission: { type: 'native-token-allowance', data: { allowance: '0x' + allowance.toString(16) } } }, now);
  const salt = BigInt('0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'));
  const d = W.buildPermissionDelegation(p, owner.address, salt);
  const signature = await W.signPermission(d, p, owner.address, owner);
  return { d, signature, p, context: W.permissionContext(d, signature), id: W.permissionHash(d) };
};
const redeemData = (g, to, value, callData = '0x') => encodeFunctionData({ abi: DM_ABI, functionName: 'redeemDelegations', args: [[g.context], [MODE_SINGLE], [encodeSingleExecution({ target: to, value, callData })]] });
/** Simulates first (a revert costs nothing); sends only if it would succeed. Returns { ok, reason }. */
const redeem = async (g, to, value, who = session, wallet = sessionWallet, callData = '0x') => {
  const data = redeemData(g, to, value, callData);
  try { await pub.call({ account: who.address, to: DM, data }); } catch (e) { return { ok: false, reason: short(e) }; }
  try { const r = await wait(await wallet.sendTransaction({ to: DM, data, gas: 400_000n })); return { ok: r.status === 'success', reason: r.status }; } catch (e) { return { ok: false, reason: short(e) }; }
};

// 3. Limits on a 0.001 test-ETH allowance.
const A = await grant(parseEther('0.001'), 3600);
let r = await redeem(A, recipient, parseEther('0.0004')); check('redeem within the allowance works', r.ok && (await bal(recipient)) === parseEther('0.0004'), r.reason);
r = await redeem(A, recipient, parseEther('0.0007')); check('redeem that would pass the total allowance is refused', !r.ok, r.reason);
r = await redeem(A, recipient, parseEther('0.0006')); check('spending the rest (total exactly the allowance) works', r.ok && (await bal(recipient)) === parseEther('0.001'), r.reason);
r = await redeem(A, recipient, 1n); check('one wei more is refused (allowance used up)', !r.ok, r.reason);
const B = await grant(parseEther('0.001'), 3600);
r = await redeem(B, owner.address, 0n, other, createWalletClient({ account: other, chain, transport: http(process.env.RPC_URL) })); check('anyone other than the session key cannot redeem', !r.ok, r.reason);
r = await redeem(B, recipient, 0n, session, sessionWallet, '0x12345678'); check('calldata is refused (the grant only allows plain native transfers)', !r.ok, r.reason);
r = await redeem(B, recipient, parseEther('0.0001')); check('a fresh grant works before revoking', r.ok, r.reason);

// 4. Revoke exactly as Settings does (disableDelegation from the account), then redeem must fail.
const dg = B.d; const disable = encodeFunctionData({ abi: DM_ABI, functionName: 'disableDelegation', args: [{ delegate: dg.delegate, delegator: dg.delegator, authority: dg.authority, caveats: dg.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms, args: c.args })), salt: dg.salt, signature: B.signature }] });
const dr = await wait(await ownerWallet.sendTransaction({ to: DM, data: disable }));
check('revoke transaction succeeds', dr.status === 'success');
check('on-chain status says disabled', (await pub.readContract({ address: DM, abi: DM_ABI, functionName: 'disabledDelegations', args: [B.id] })) === true);
r = await redeem(B, recipient, parseEther('0.0001')); check('after revoking, the site can no longer redeem', !r.ok, r.reason);

// 5. Expiry (optional, waits about a minute).
if (process.env.WAIT_EXPIRY === '1') {
  const C = await grant(parseEther('0.001'), 45);
  r = await redeem(C, recipient, parseEther('0.0001')); check('before expiry the grant works', r.ok, r.reason);
  while ((await pub.getBlock()).timestamp <= BigInt(C.p.expiry)) await new Promise((x) => setTimeout(x, 6000));
  r = await redeem(C, recipient, parseEther('0.0001')); check('after the expiry the site can no longer redeem', !r.ok, r.reason);
} else console.log('SKIP  expiry check (set WAIT_EXPIRY=1; it waits about a minute)');

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed. Owner balance now ${formatEther(await bal(owner.address))}.`);
process.exit(results.every(Boolean) ? 0 : 1);
