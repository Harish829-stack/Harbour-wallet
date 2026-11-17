// P0 spike. Reuses the validated builders from documentation/smart-accounts/validation/mine.mjs.
// Never prints or writes the private key into logs; key lives only in .state/key.json (mode 600, gitignored).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const EXT = resolve(ROOT, 'harbour-wallet-v3/apps/extension');
const req = createRequire(EXT + '/package.json');
const { encodeFunctionData, parseAbi, encodeAbiParameters, concat, pad, toHex, hashTypedData, serializeSignature,
  serializeTransaction, keccak256, parseGwei, formatEther, getAddress } = req('viem');
const { privateKeyToAccount, sign, generatePrivateKey } = req('viem/accounts');
const { hashAuthorization } = req('viem/experimental');

const CHAINS = { sepolia: { id: 11155111, rpc: 'https://ethereum-sepolia-rpc.publicnode.com' }, baseSepolia: { id: 84532, rpc: 'https://sepolia.base.org' } };
const CHAIN = process.env.CHAIN || 'sepolia';
if (!CHAINS[CHAIN]) throw new Error('CHAIN must be sepolia or baseSepolia');
const CHAIN_ID = CHAINS[CHAIN].id;
const RPC_URL = process.env.RPC_URL || CHAINS[CHAIN].rpc;
const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const DELEGATE = '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b';
const ZERO = '0x0000000000000000000000000000000000000000';
const STUB_SIG = '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000011b'; // kit EOA_STUB_SIGNATURE (r=1,s=1,v=0x1b)
const SINK = '0x000000000000000000000000000000000000dEaD';
const STATE = resolve(HERE, '.state');

// ---- secrets: only read, never printed ----
function pimlicoKey() {
  if (process.env.PIMLICO_API_KEY) return process.env.PIMLICO_API_KEY;
  const envFile = resolve(EXT, '../backend/.env');
  const m = readFileSync(envFile, 'utf8').match(/^PIMLICO_API_KEY=(.*)$/m);
  if (!m) throw new Error('PIMLICO_API_KEY missing in apps/backend/.env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}
let KEY_CACHE; const apiKey = () => (KEY_CACHE ??= pimlicoKey());
const redact = (s) => { try { const k = apiKey(); return k ? String(s).split(k).join('<key>') : String(s); } catch { return String(s); } };
const bundlerUrl = () => `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${apiKey()}`;

// ---- json-rpc ----
async function rpc(url, method, params = []) {
  let res;
  try { res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); }
  catch (e) { throw new Error(redact(`network error calling ${method}: ${e.cause?.code || e.message}`)); }
  const j = await res.json().catch(() => ({}));
  if (j.error) { const err = new Error(redact(`${method}: ${j.error.message}`)); err.code = j.error.code; err.data = j.error.data; throw err; }
  return j.result;
}
const chain = (m, p) => rpc(RPC_URL, m, p);
const bundler = (m, p) => rpc(bundlerUrl(), m, p);

// ---- builders (same as validation/mine.mjs) ----
const abi = parseAbi(['function execute((address target, uint256 value, bytes callData) execution)', 'function execute(bytes32 mode, bytes executionCalldata)']);
const BATCH = '0x0100000000000000000000000000000000000000000000000000000000000000';
export const encodeCalls = (calls) => calls.length === 1
  ? encodeFunctionData({ abi, functionName: 'execute', args: [{ target: calls[0].to, value: calls[0].value, callData: calls[0].data }] })
  : encodeFunctionData({ abi, functionName: 'execute', args: [BATCH, encodeAbiParameters([{ type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'callData', type: 'bytes' }] }], [calls.map((c) => ({ target: c.to, value: c.value, callData: c.data }))])] });
const p16 = (n) => pad(toHex(BigInt(n)), { size: 16 });
const typed = (op, chainId) => ({
  domain: { name: 'EIP7702StatelessDeleGator', version: '1', chainId, verifyingContract: op.sender },
  types: { PackedUserOperation: [{ name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' }, { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' }, { name: 'gasFees', type: 'bytes32' }, { name: 'paymasterAndData', type: 'bytes' }, { name: 'entryPoint', type: 'address' }] },
  primaryType: 'PackedUserOperation',
  message: { sender: op.sender, nonce: BigInt(op.nonce), initCode: '0x', callData: op.callData, accountGasLimits: concat([p16(op.verificationGasLimit), p16(op.callGasLimit)]), preVerificationGas: BigInt(op.preVerificationGas), gasFees: concat([p16(op.maxPriorityFeePerGas), p16(op.maxFeePerGas)]), paymasterAndData: op.paymaster ? concat([op.paymaster, p16(op.paymasterVerificationGasLimit), p16(op.paymasterPostOpGasLimit), op.paymasterData]) : '0x', entryPoint: ENTRYPOINT },
});
const signOp = async (op, pk) => serializeSignature(await sign({ hash: hashTypedData(typed(op, CHAIN_ID)), privateKey: pk }));
async function rawType4(pk, { delegate, nonce, fees, gas }) {
  const acct = privateKeyToAccount(pk);
  const a = await sign({ hash: hashAuthorization({ contractAddress: delegate, chainId: CHAIN_ID, nonce: nonce + 1 }), privateKey: pk });
  const unsigned = { type: 'eip7702', chainId: CHAIN_ID, nonce, maxFeePerGas: fees.max, maxPriorityFeePerGas: fees.tip, gas, to: acct.address, value: 0n, data: '0x',
    authorizationList: [{ contractAddress: delegate, chainId: CHAIN_ID, nonce: nonce + 1, r: a.r, s: a.s, yParity: a.yParity }] };
  const sig = await sign({ hash: keccak256(serializeTransaction(unsigned)), privateKey: pk });
  return serializeTransaction(unsigned, sig);
}

// ---- state / report (no secrets) ----
mkdirSync(STATE, { recursive: true });
const keyFile = resolve(STATE, 'key.json'), reportFile = resolve(STATE, `report-${CHAIN}.json`);
const report = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
const record = (k, v) => { report[k] = v; writeFileSync(reportFile, JSON.stringify(report, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2)); console.log(`[${CHAIN}] ${k}:`, JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x))); };
function loadPk() {
  if (!existsSync(keyFile)) return null;
  return JSON.parse(readFileSync(keyFile, 'utf8')).pk;
}
function ensureKey() {
  let pk = loadPk();
  if (!pk) { pk = generatePrivateKey(); writeFileSync(keyFile, JSON.stringify({ pk }), { mode: 0o600 }); chmodSync(keyFile, 0o600); }
  return pk;
}
const hexN = (h) => BigInt(h);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { throw new Error(msg); };

async function fees() {
  const [gp, tip] = await Promise.all([chain('eth_gasPrice'), chain('eth_maxPriorityFeePerGas').catch(() => toHex(parseGwei('1')))]);
  const t = hexN(tip) || parseGwei('1');
  return { tip: t, max: hexN(gp) * 2n + t };
}
async function waitTx(hash) {
  for (let i = 0; i < 60; i++) { const r = await chain('eth_getTransactionReceipt', [hash]); if (r) return r; await sleep(3000); }
  fail('timeout waiting for tx ' + hash);
}
async function delegationOf(addr) { const c = await chain('eth_getCode', [addr, 'latest']); return c.toLowerCase().startsWith('0xef0100') && c.length === 48 ? getAddress('0x' + c.slice(8)) : c === '0x' ? null : 'other-code'; }

// ---- steps ----
async function stepGen() {
  const pk = ensureKey(); const a = privateKeyToAccount(pk).address;
  console.log(`\nTEST EOA (fund with faucet ETH on ${CHAIN}, ~0.05 ETH is plenty): ${a}\n`);
  record('eoa', a);
  try { record('balanceEth', formatEther(hexN(await chain('eth_getBalance', [a, 'latest'])))); } catch (e) { console.log('balance unavailable:', e.message); }
}
async function stepChecks() {
  const code = await chain('eth_getCode', [DELEGATE, 'latest']);
  const ep = await chain('eth_call', [{ to: DELEGATE, data: '0xb0d691fe' }, 'latest']).catch((e) => 'ERR ' + e.message);
  const epAddr = ep.startsWith('0x') && ep.length === 66 ? getAddress('0x' + ep.slice(26)) : ep;
  const eps = await bundler('eth_supportedEntryPoints', []).catch((e) => 'ERR ' + e.message);
  record('delegateChecks', { delegate: DELEGATE, hasCode: code !== '0x', codeBytes: (code.length - 2) / 2, codeHash: code === '0x' ? null : keccak256(code), entryPoint: epAddr, entryPointIsV07: String(epAddr).toLowerCase() === ENTRYPOINT.toLowerCase(), bundlerSupportedEntryPoints: eps });
}
async function stepUpgrade() {
  const pk = ensureKey(); const a = privateKeyToAccount(pk).address;
  const cur = await delegationOf(a);
  if (cur && cur.toLowerCase() === DELEGATE.toLowerCase()) return record('upgrade', { skipped: 'already delegated' });
  const nonce = Number(hexN(await chain('eth_getTransactionCount', [a, 'pending'])));
  const f = await fees(); const gas = 150000n;
  const raw = await rawType4(pk, { delegate: DELEGATE, nonce, fees: f, gas });
  const hash = await chain('eth_sendRawTransaction', [raw]); const r = await waitTx(hash);
  const after = await delegationOf(a);
  record('upgrade', { tx: hash, status: r.status, gasLimit: gas, gasUsed: hexN(r.gasUsed), authNonce: nonce + 1, txNonce: nonce, delegatedTo: after, ok: r.status === '0x1' && after?.toLowerCase() === DELEGATE.toLowerCase() });
}
async function sponsorCall(op, context) {
  const params = context ? [op, ENTRYPOINT, context] : [op, ENTRYPOINT];
  return bundler('pm_sponsorUserOperation', params);
}
const baseOp = async (sender, calls) => {
  const nonce = await chain('eth_call', [{ to: ENTRYPOINT, data: encodeFunctionData({ abi: parseAbi(['function getNonce(address,uint192) view returns (uint256)']), functionName: 'getNonce', args: [sender, 0n] }) }, 'latest']);
  const gp = await bundler('pimlico_getUserOperationGasPrice', []);
  return { sender, nonce: toHex(hexN(nonce)), callData: encodeCalls(calls), maxFeePerGas: gp.fast.maxFeePerGas, maxPriorityFeePerGas: gp.fast.maxPriorityFeePerGas, signature: STUB_SIG };
};
const policy = () => process.env.SPONSORSHIP_POLICY_ID;
const NO_POLICY = process.env.SPONSOR_NO_POLICY === '1'; // sponsor with no policy id (testnet default behaviour)
async function stepProbe() {
  const pk = ensureKey(); const a = privateKeyToAccount(pk).address;
  const op = await baseOp(a, [{ to: SINK, value: 1n, data: '0x' }]);
  const out = {};
  for (const [label, ctx] of [['withoutPolicyId', undefined], ['withEmptyContext', {}], ['withPolicyId', policy() ? { sponsorshipPolicyId: policy() } : null], ['withBogusPolicyId', { sponsorshipPolicyId: 'sp_does_not_exist' }]]) {
    if (ctx === null) { out[label] = { skipped: 'set SPONSORSHIP_POLICY_ID' }; continue; }
    try { const r = await sponsorCall(op, ctx); out[label] = { ok: true, paymaster: r.paymaster, fields: Object.keys(r) }; }
    catch (e) { out[label] = { ok: false, code: e.code, error: e.message, data: e.data }; }
  }
  record('sponsorProbe', out);
}
async function runOp(label, calls, { sponsor }) {
  const pk = ensureKey(); const a = privateKeyToAccount(pk).address;
  const delegated = await delegationOf(a);
  if (!delegated || delegated.toLowerCase() !== DELEGATE.toLowerCase()) fail('account is not delegated to the pinned delegate; run upgrade first');
  let op = await baseOp(a, calls); const info = { label, calls: calls.length, sponsor };
  if (sponsor) {
    if (!policy() && !NO_POLICY) return record(label, { skipped: 'set SPONSORSHIP_POLICY_ID or SPONSOR_NO_POLICY=1' });
    const r = await sponsorCall(op, policy() ? { sponsorshipPolicyId: policy() } : undefined);
    info.noPolicyId = !policy();
    info.paymaster = r.paymaster; info.gas = { verificationGasLimit: r.verificationGasLimit, callGasLimit: r.callGasLimit, preVerificationGas: r.preVerificationGas };
    op = { ...op, ...r };                      // paymaster, paymasterData, paymaster gas, op gas limits
  } else {
    const g = await bundler('eth_estimateUserOperationGas', [op, ENTRYPOINT]);
    info.estimate = g; op = { ...op, verificationGasLimit: g.verificationGasLimit, callGasLimit: g.callGasLimit, preVerificationGas: g.preVerificationGas };
  }
  op.signature = await signOp({ ...op, nonce: op.nonce, verificationGasLimit: op.verificationGasLimit, callGasLimit: op.callGasLimit }, pk);
  const hash = await bundler('eth_sendUserOperation', [op, ENTRYPOINT]); info.userOpHash = hash;
  for (let i = 0; i < 60; i++) {
    const r = await bundler('eth_getUserOperationReceipt', [hash]).catch(() => null);
    if (r) { info.success = r.success; info.tx = r.receipt?.transactionHash; info.actualGasUsed = r.actualGasUsed; info.actualGasCost = r.actualGasCost; break; }
    await sleep(3000);
  }
  if (info.success === undefined) info.success = 'no receipt in 3 min';
  if (info.estimate && info.actualGasUsed) info.estimateVsActual = { estimatedTotalGas: (hexN(op.verificationGasLimit) + hexN(op.callGasLimit) + hexN(op.preVerificationGas)).toString(), actualGasUsed: hexN(info.actualGasUsed).toString() };
  record(label, info);
}
const stepOps = async () => {
  const c1 = [{ to: SINK, value: 1n, data: '0x' }];
  const c2 = [...c1, { to: '0x000000000000000000000000000000000000bEEF', value: 1n, data: '0x' }];
  for (const [label, calls, sponsor] of [['op_userPaid_1call', c1, false], ['op_sponsored_1call', c1, true], ['op_userPaid_2call_batch', c2, false], ['op_sponsored_2call_batch', c2, true]]) {
    try { await runOp(label, calls, { sponsor }); } catch (e) { record(label, { ok: false, code: e.code, error: e.message, data: e.data }); }
  }
};
async function stepRevoke() {
  const pk = ensureKey(); const a = privateKeyToAccount(pk).address;
  const nonce = Number(hexN(await chain('eth_getTransactionCount', [a, 'pending'])));
  const f = await fees(); const gas = 150000n;
  const raw = await rawType4(pk, { delegate: ZERO, nonce, fees: f, gas });
  const hash = await chain('eth_sendRawTransaction', [raw]); const r = await waitTx(hash);
  const after = await delegationOf(a);
  record('revoke', { tx: hash, status: r.status, gasUsed: hexN(r.gasUsed), codeAfter: after === null ? '0x (cleared)' : after, ok: r.status === '0x1' && after === null });
}

// ---- offline self-check: builders reproduce the saved vectors (no network, no key printed) ----
async function stepOffline() {
  const v = JSON.parse(readFileSync(resolve(ROOT, 'documentation/smart-accounts/validation/vectors.json'), 'utf8'));
  const PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // public anvil test key used by the vectors
  const res = []; const chk = (n, a, b) => res.push([n, String(a).toLowerCase() === String(b).toLowerCase()]);
  const c1 = [{ to: SINK, value: 5n, data: '0x' }];
  chk('callData single', encodeCalls(c1), v.callData1);
  for (const k of ['op1', 'op2']) chk('userOp sig ' + k, serializeSignature(await sign({ hash: hashTypedData({ ...typed(v[k].op, v.chainId), }), privateKey: PK })), v[k].sig);
  const saved = CHAIN_ID; // typed() uses CHAIN_ID via signOp only; the vectors use their own chainId above
  chk('authorization digest', hashAuthorization({ contractAddress: v.env.impl, chainId: v.chainId, nonce: 3 }), v.authDigest);
  const { sign: s2 } = { sign };
  const mk = async (delegate) => { const a = await s2({ hash: hashAuthorization({ contractAddress: delegate, chainId: v.chainId, nonce: 3 }), privateKey: PK }); const u = { type: 'eip7702', chainId: v.chainId, nonce: 2, maxFeePerGas: 3000000000n, maxPriorityFeePerGas: 1000000000n, gas: 100000n, to: v.account, value: 0n, data: '0x', authorizationList: [{ contractAddress: delegate, chainId: v.chainId, nonce: 3, r: a.r, s: a.s, yParity: a.yParity }] }; return serializeTransaction(u, await s2({ hash: keccak256(serializeTransaction(u)), privateKey: PK })); };
  chk('type-4 upgrade', await mk(v.env.impl), v.upgradeRaw); chk('type-4 revoke', await mk(ZERO), v.revokeRaw);
  chk('stub signature shape', STUB_SIG.length, 2 + 130);
  chk('pinned delegate == vectors impl', DELEGATE, v.env.impl); chk('entrypoint == vectors', ENTRYPOINT, v.env.EntryPoint);
  for (const [n, ok] of res) console.log(ok ? 'PASS' : 'FAIL', n);
  process.exit(res.every(([, ok]) => ok) ? 0 : 1);
}

async function stepCodeDiff() {
  const out = {};
  for (const [name, c] of Object.entries(CHAINS)) out[name] = await rpc(process.env['RPC_' + name] || c.rpc, 'eth_getCode', [DELEGATE, 'latest']);
  const a = out.sepolia, b = out.baseSepolia; const diffs = []; let start = -1;
  for (let i = 2; i <= Math.max(a.length, b.length); i += 2) { const d = a.slice(i, i + 2) !== b.slice(i, i + 2); if (d && start < 0) start = i; if (!d && start >= 0) { diffs.push([(start - 2) / 2, (i - 2) / 2]); start = -1; } }
  record('codeDiff', { sepoliaHash: keccak256(a), baseSepoliaHash: keccak256(b), lengthBytes: [(a.length - 2) / 2, (b.length - 2) / 2], differingByteRanges: diffs, sample: diffs.slice(0, 6).map(([x, y]) => ({ at: x, sepolia: '0x' + a.slice(2 + x * 2, 2 + y * 2).slice(0, 80), baseSepolia: '0x' + b.slice(2 + x * 2, 2 + y * 2).slice(0, 80) })) });
}
const steps = { codediff: stepCodeDiff, offline: stepOffline, gen: stepGen, checks: stepChecks, upgrade: stepUpgrade, 'sponsor-probe': stepProbe, ops: stepOps, revoke: stepRevoke,
  all: async () => { await stepGen(); await stepChecks(); await stepUpgrade(); await stepProbe(); await stepOps(); await stepRevoke(); } };
const cmd = process.argv[2];
if (!steps[cmd]) { console.log('usage: node spike.mjs', Object.keys(steps).join('|')); process.exit(2); }
steps[cmd]().catch((e) => { console.error('FAILED:', redact(e.message)); process.exit(1); });
