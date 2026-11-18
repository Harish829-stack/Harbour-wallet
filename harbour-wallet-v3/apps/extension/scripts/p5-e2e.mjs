// P5 end-to-end check on a TESTNET (Sepolia or Base Sepolia). Uses the SAME production code the wallet uses to enable the smart account,
// build and sign the permission delegation, and revoke it; the "site" side (redeeming through MetaMask's DelegationManager) is plain viem.
// It proves on real contracts that: the limits hold (amount, total, delegate-only, exact calldata, expiry) and that a revoked grant stops working.
//
//   node scripts/p5-e2e.mjs keygen                       # prints a NEW throwaway testnet address + key (never use it on mainnet)
//   RPC_URL=<rpc> OWNER_PK=<key> [CHAIN=sepolia|base-sepolia (default base-sepolia)] [WAIT_EXPIRY=1] [SKIP_ERC20=1] node scripts/p5-e2e.mjs
//
// Also deploys a tiny throwaway ERC-20 (HarbourTestToken, 1,000,000 HTT to the owner) and checks the erc20-token-allowance permission the same way
// (cap, total, valueLte 0, token-only, delegate-only, revoke). Never put keys or RPC URLs in this file: pass them as environment variables.
//
// Fund the printed address with about 0.005 test ETH first (amounts are small; most of the cost is gas). It refuses any chain that is not Sepolia or Base Sepolia, never prints a key
// (except `keygen`), and spends at most a few thousandths of test ETH. Exit code 0 only if every check passes.
process.env.DO_NOT_TRACK = '1';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, encodeFunctionData, hexToBytes, parseAbi } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia, baseSepolia } from 'viem/chains';
import { DelegationManager as DM_ABI } from '@metamask/delegation-abis';
import { encodeSingleExecution } from '@metamask/smart-accounts-kit/utils';

if (process.argv[2] === 'keygen') { const k = generatePrivateKey(); console.log(`address ${privateKeyToAccount(k).address}\nkey     ${k}\nTestnet only. Fund the address with ~0.02 test ETH, then run with OWNER_PK=<key>.`); process.exit(0); }

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './core/smartAccount/constants'; export * from './core/smartAccount/permissions'; export * from './core/smartAccount/permissionDelegation'; export * from './core/smartAccount/delegation'; export { signHash } from './core/provider/evmAccount';`, resolveDir: src, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` }, define: { 'import.meta.env': '{}' } });
const W = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const chains = { sepolia, 'base-sepolia': baseSepolia }; const chain = chains[process.env.CHAIN ?? 'base-sepolia'];
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
if ((await bal(owner.address)) < parseEther('0.0045')) { console.error('Owner needs at least 0.0045 test ETH (most of it is gas).'); process.exit(2); }

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

const grant = async (allowance, ttlSec, token = null) => {
  const now = Math.floor(Date.now() / 1000);
  const p = W.normalizePermissionRequest({ chainId: '0x' + chain.id.toString(16), to: session.address, expiry: now + ttlSec, permission: token ? { type: 'erc20-token-allowance', data: { allowance: '0x' + allowance.toString(16), tokenAddress: token } } : { type: 'native-token-allowance', data: { allowance: '0x' + allowance.toString(16) } } }, now);
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
  let gas; try { gas = ((await pub.estimateGas({ account: who.address, to: DM, data })) * 14n) / 10n; } catch (e) { return { ok: false, reason: short(e) }; } // a fixed 400k ran out of gas inside the account call
  try { const r = await wait(await wallet.sendTransaction({ to: DM, data, gas })); return { ok: r.status === 'success', reason: r.status }; } catch (e) { return { ok: false, reason: short(e) }; }
};

// 3. Limits on a 0.001 test-ETH allowance.
const A = await grant(parseEther('0.0001'), 3600);
let r = await redeem(A, recipient, parseEther('0.00004')); check('redeem within the allowance works', r.ok && (await bal(recipient)) === parseEther('0.00004'), r.reason);
r = await redeem(A, recipient, parseEther('0.00007')); check('redeem that would pass the total allowance is refused', !r.ok, r.reason);
r = await redeem(A, recipient, parseEther('0.00006')); check('spending the rest (total exactly the allowance) works', r.ok && (await bal(recipient)) === parseEther('0.0001'), r.reason);
r = await redeem(A, recipient, 1n); check('one wei more is refused (allowance used up)', !r.ok, r.reason);
const B = await grant(parseEther('0.0001'), 3600);
r = await redeem(B, owner.address, 0n, other, createWalletClient({ account: other, chain, transport: http(process.env.RPC_URL) })); check('anyone other than the session key cannot redeem', !r.ok, r.reason);
r = await redeem(B, recipient, 0n, session, sessionWallet, '0x12345678'); check('calldata is refused (the grant only allows plain native transfers)', !r.ok, r.reason);
r = await redeem(B, recipient, parseEther('0.00001')); check('a fresh grant works before revoking', r.ok, r.reason);

// 4. Revoke exactly as Settings does (disableDelegation from the account), then redeem must fail.
const dg = B.d; const disable = encodeFunctionData({ abi: DM_ABI, functionName: 'disableDelegation', args: [{ delegate: dg.delegate, delegator: dg.delegator, authority: dg.authority, caveats: dg.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms, args: c.args })), salt: dg.salt, signature: B.signature }] });
const dr = await wait(await ownerWallet.sendTransaction({ to: DM, data: disable }));
check('revoke transaction succeeds', dr.status === 'success');
check('on-chain status says disabled', (await pub.readContract({ address: DM, abi: DM_ABI, functionName: 'disabledDelegations', args: [B.id] })) === true);
r = await redeem(B, recipient, parseEther('0.00001')); check('after revoking, the site can no longer redeem', !r.ok, r.reason);

// 4b. ERC-20 allowance (erc20-token-allowance = valueLte 0 + erc20TransferAmount + timestamp), on a throwaway token the owner deploys here.
if (process.env.SKIP_ERC20 !== '1') {
  const TOKEN_BYTECODE = '0x6080604052348015600e575f80fd5b506040516105fc3803806105fc833981016040819052602b916083565b5f8181556001600160a01b038316808252600160209081526040808420859055518481529192917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a3505060b8565b5f80604083850312156093575f80fd5b82516001600160a01b038116811460a8575f80fd5b6020939093015192949293505050565b610537806100c55f395ff3fe608060405234801561000f575f80fd5b5060043610610090575f3560e01c8063313ce56711610063578063313ce5671461012757806370a082311461014157806395d89b4114610160578063a9059cbb14610182578063dd62ed3e14610195575f80fd5b806306fdde0314610094578063095ea7b3146100db57806318160ddd146100fe57806323b872dd14610114575b5f80fd5b6100c5604051806040016040528060128152602001712430b93137bab9102a32b9ba102a37b5b2b760711b81525081565b6040516100d291906103c4565b60405180910390f35b6100ee6100e9366004610414565b6101bf565b60405190151581526020016100d2565b6101065f5481565b6040519081526020016100d2565b6100ee61012236600461043c565b61022b565b61012f601281565b60405160ff90911681526020016100d2565b61010661014f366004610476565b60016020525f908152604090205481565b6100c56040518060400160405280600381526020016212151560ea1b81525081565b6100ee610190366004610414565b610336565b6101066101a3366004610496565b600260209081525f928352604080842090915290825290205481565b335f8181526002602090815260408083206001600160a01b038716808552925280832085905551919290917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925906102199086815260200190565b60405180910390a35060015b92915050565b6001600160a01b0383165f9081526002602090815260408083203384529091528120545f1981146102845761026083826104db565b6001600160a01b0386165f9081526002602090815260408083203384529091529020555b6001600160a01b0385165f90815260016020526040812080548592906102ab9084906104db565b90915550506001600160a01b0384165f90815260016020526040812080548592906102d79084906104ee565b92505081905550836001600160a01b0316856001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8560405161032391815260200190565b60405180910390a3506001949350505050565b335f908152600160205260408120805483919083906103569084906104db565b90915550506001600160a01b0383165f90815260016020526040812080548492906103829084906104ee565b90915550506040518281526001600160a01b0384169033907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef90602001610219565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b80356001600160a01b038116811461040f575f80fd5b919050565b5f8060408385031215610425575f80fd5b61042e836103f9565b946020939093013593505050565b5f805f6060848603121561044e575f80fd5b610457846103f9565b9250610465602085016103f9565b929592945050506040919091013590565b5f60208284031215610486575f80fd5b61048f826103f9565b9392505050565b5f80604083850312156104a7575f80fd5b6104b0836103f9565b91506104be602084016103f9565b90509250929050565b634e487b7160e01b5f52601160045260245ffd5b81810381811115610225576102256104c7565b80820180821115610225576102256104c756fea2646970667358221220e971b38efcd329bb2c587cb5f2d51d9487b8b044be823cca80ac207c431a8f6164736f6c634300081a0033';
  const tokenAbi = parseAbi(['constructor(address to, uint256 supply)', 'function transfer(address to, uint256 v) returns (bool)', 'function approve(address s, uint256 v) returns (bool)', 'function balanceOf(address) view returns (uint256)']);
  const dep = await wait(await ownerWallet.deployContract({ abi: tokenAbi, bytecode: TOKEN_BYTECODE, args: [owner.address, parseUnits('1000000', 18)] }));
  const token = dep.contractAddress; const tbal = (a) => pub.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [a] });
  check('test token deployed, the whole supply is with the smart account', (await tbal(owner.address)) === parseUnits('1000000', 18), token);
  const xfer = (to, amt) => encodeFunctionData({ abi: tokenAbi, functionName: 'transfer', args: [to, amt] });
  const U = (n) => parseUnits(String(n), 18); const rcpt = privateKeyToAccount(generatePrivateKey()).address;
  const T = await grant(U(100), 3600, token);
  r = await redeem(T, token, 0n, session, sessionWallet, xfer(rcpt, U(40))); check('token: redeem within the allowance works', r.ok && (await tbal(rcpt)) === U(40), r.reason);
  r = await redeem(T, token, 0n, session, sessionWallet, xfer(rcpt, U(70))); check('token: redeem that would pass the total allowance is refused', !r.ok, r.reason);
  r = await redeem(T, token, 0n, session, sessionWallet, xfer(rcpt, U(60))); check('token: spending the rest (total exactly the allowance) works', r.ok && (await tbal(rcpt)) === U(100), r.reason);
  r = await redeem(T, token, 0n, session, sessionWallet, xfer(rcpt, 1n)); check('token: one unit more is refused (allowance used up)', !r.ok, r.reason);
  const T2 = await grant(U(100), 3600, token);
  r = await redeem(T2, token, 0n, session, sessionWallet, encodeFunctionData({ abi: tokenAbi, functionName: 'approve', args: [session.address, U(1)] })); check('token: approve() is refused (only transfer() is allowed)', !r.ok, r.reason);
  r = await redeem(T2, token, 1n, session, sessionWallet, xfer(rcpt, U(1))); check('token: sending ETH along with the transfer is refused (valueLte 0)', !r.ok, r.reason);
  r = await redeem(T2, rcpt, 0n, session, sessionWallet, xfer(rcpt, U(1))); check('token: a call to anything other than the granted token is refused', !r.ok, r.reason);
  r = await redeem(T2, token, 0n, other, createWalletClient({ account: other, chain, transport: http(process.env.RPC_URL) }), xfer(rcpt, U(1))); check('token: anyone other than the session key cannot redeem', !r.ok, r.reason);
  r = await redeem(T2, token, 0n, session, sessionWallet, xfer(rcpt, U(1))); check('token: a fresh grant works before revoking', r.ok, r.reason);
  const dg2 = T2.d; const dis2 = encodeFunctionData({ abi: DM_ABI, functionName: 'disableDelegation', args: [{ delegate: dg2.delegate, delegator: dg2.delegator, authority: dg2.authority, caveats: dg2.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms, args: c.args })), salt: dg2.salt, signature: T2.signature }] });
  check('token: revoke transaction succeeds', (await wait(await ownerWallet.sendTransaction({ to: DM, data: dis2 }))).status === 'success');
  r = await redeem(T2, token, 0n, session, sessionWallet, xfer(rcpt, U(1))); check('token: after revoking, the site can no longer redeem', !r.ok, r.reason);
} else console.log('SKIP  ERC-20 checks (SKIP_ERC20=1)');

// 5. Expiry (optional, waits about a minute).
if (process.env.WAIT_EXPIRY === '1') {
  const C = await grant(parseEther('0.0001'), 45);
  r = await redeem(C, recipient, parseEther('0.00001')); check('before expiry the grant works', r.ok, r.reason);
  while ((await pub.getBlock()).timestamp <= BigInt(C.p.expiry)) await new Promise((x) => setTimeout(x, 6000));
  r = await redeem(C, recipient, parseEther('0.00001')); check('after the expiry the site can no longer redeem', !r.ok, r.reason);
} else console.log('SKIP  expiry check (set WAIT_EXPIRY=1; it waits about a minute)');

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed. Owner balance now ${formatEther(await bal(owner.address))}.`);
process.exit(results.every(Boolean) ? 0 : 1);
