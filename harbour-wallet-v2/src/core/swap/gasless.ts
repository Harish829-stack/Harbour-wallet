// Gasless EVM execution (TW: SWAP_QUOTE_SUPPORTS_7702 + sponsored swaps), behind the remote flag `gasless7702` AND the
// user's "Gasless swaps (beta)" setting. The EOA is delegated (EIP-7702) to the Ethereum Foundation's audited
// Simple7702Account (EntryPoint v0.8) and runs the calls as one ERC-4337 UserOperation whose gas a paymaster sponsors
// (Pimlico, through harbour-gateway `/pimlico/<chainId>`, which holds the key). If anything is unavailable the caller falls
// back to a normal transaction.
// Safety: Harbour only ever authorises the pinned delegate below, refuses accounts already delegated elsewhere, and checks
// the delegate's `entryPoint()` on-chain before signing an authorisation.
import { concat, encodeFunctionData, hashTypedData, pad, parseAbi, toHex, type Hex } from 'viem';
import { hashAuthorization } from 'viem/experimental';
import { GATEWAY_URL } from '../../kit/endpoints';

export const ENTRYPOINT_V08 = '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108' as const;
export const SIMPLE_7702 = '0xe6Cae83BdE06E4c305530e199D7217f42808555B' as const; // EF AA team, Spearbit-audited (docs.candide.dev)
export const GASLESS_CHAIN_IDS = [1, 56, 137, 42161, 8453] as const;
export const GASLESS_FLAG = 'gasless7702';
export const DUMMY_SIG = '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c' as const;
export const bundlerUrl = (chainId: number): string | null => (GATEWAY_URL && (GASLESS_CHAIN_IDS as readonly number[]).includes(chainId) ? `${GATEWAY_URL}/pimlico/${chainId}` : null);

const accountAbi = parseAbi(['function execute(address target, uint256 value, bytes data)', 'function executeBatch((address target, uint256 value, bytes data)[] calls)', 'function entryPoint() view returns (address)']);
const epAbi = parseAbi(['function getNonce(address sender, uint192 key) view returns (uint256 nonce)']);
export interface Call { to: `0x${string}`; value: bigint; data: `0x${string}` }

export function encodeCalls(calls: Call[]): Hex {
  if (!calls.length) throw new Error('No calls');
  return calls.length === 1
    ? encodeFunctionData({ abi: accountAbi, functionName: 'execute', args: [calls[0].to, calls[0].value, calls[0].data] })
    : encodeFunctionData({ abi: accountAbi, functionName: 'executeBatch', args: [calls.map((c) => ({ target: c.to, value: c.value, data: c.data }))] });
}
/** EIP-7702 delegation indicator `0xef0100 || address` → delegate address (lowercase), '' for no code, null for other code. */
export function delegationOf(code: string | undefined | null): string | null {
  const c = (code ?? '0x').toLowerCase();
  if (c === '0x' || c === '') return '';
  return /^0xef0100[0-9a-f]{40}$/.test(c) ? `0x${c.slice(8)}` : null;
}

export interface UserOp {
  sender: `0x${string}`; nonce: bigint; factory?: `0x${string}`; factoryData?: Hex; callData: Hex;
  callGasLimit: bigint; verificationGasLimit: bigint; preVerificationGas: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint;
  paymaster?: `0x${string}`; paymasterVerificationGasLimit?: bigint; paymasterPostOpGasLimit?: bigint; paymasterData?: Hex; signature: Hex;
  eip7702Auth?: { chainId: Hex; address: `0x${string}`; nonce: Hex; yParity: Hex; r: Hex; s: Hex };
}
const p16 = (v: bigint) => pad(toHex(v), { size: 16 });
/** ERC-4337 v0.8 userOpHash (EIP-712). For a 7702 op (factory 0x7702) the initCode hashed is the delegate address + factoryData. */
export function userOpHash(op: UserOp, chainId: number, delegate: `0x${string}` = SIMPLE_7702): Hex {
  const initCode: Hex = op.factory ? (op.factory.toLowerCase().startsWith('0x7702') ? concat([delegate, op.factoryData ?? '0x']) : concat([op.factory, op.factoryData ?? '0x'])) : '0x';
  const paymasterAndData: Hex = op.paymaster ? concat([op.paymaster, p16(op.paymasterVerificationGasLimit ?? 0n), p16(op.paymasterPostOpGasLimit ?? 0n), op.paymasterData ?? '0x']) : '0x';
  return hashTypedData({
    domain: { name: 'ERC4337', version: '1', chainId, verifyingContract: ENTRYPOINT_V08 },
    types: { PackedUserOperation: [
      { name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' },
      { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' }, { name: 'gasFees', type: 'bytes32' }, { name: 'paymasterAndData', type: 'bytes' },
    ] },
    primaryType: 'PackedUserOperation',
    message: {
      sender: op.sender, nonce: op.nonce, initCode, callData: op.callData,
      accountGasLimits: concat([p16(op.verificationGasLimit), p16(op.callGasLimit)]), preVerificationGas: op.preVerificationGas,
      gasFees: concat([p16(op.maxPriorityFeePerGas), p16(op.maxFeePerGas)]), paymasterAndData,
    },
  });
}
export const authorizationDigest = (chainId: number, nonce: number) => hashAuthorization({ contractAddress: SIMPLE_7702, chainId, nonce });

/** JSON-RPC form of a user operation (hex quantities), as bundlers expect it. */
export function toRpcOp(op: UserOp): Record<string, unknown> {
  const h = (v?: bigint) => (v == null ? undefined : toHex(v));
  const o: Record<string, unknown> = {
    sender: op.sender, nonce: h(op.nonce), callData: op.callData, callGasLimit: h(op.callGasLimit), verificationGasLimit: h(op.verificationGasLimit),
    preVerificationGas: h(op.preVerificationGas), maxFeePerGas: h(op.maxFeePerGas), maxPriorityFeePerGas: h(op.maxPriorityFeePerGas), signature: op.signature,
  };
  if (op.factory) { o.factory = op.factory; o.factoryData = op.factoryData ?? '0x'; }
  if (op.paymaster) { o.paymaster = op.paymaster; o.paymasterVerificationGasLimit = h(op.paymasterVerificationGasLimit); o.paymasterPostOpGasLimit = h(op.paymasterPostOpGasLimit); o.paymasterData = op.paymasterData ?? '0x'; }
  if (op.eip7702Auth) o.eip7702Auth = op.eip7702Auth;
  return o;
}

export interface GaslessDeps {
  chainId: number; sender: `0x${string}`;
  /** Bundler + paymaster JSON-RPC. */ bundler: (method: string, params: unknown[]) => Promise<any>;
  /** Chain reads. */ getCode: (a: `0x${string}`) => Promise<string | undefined>; call: (to: `0x${string}`, data: Hex) => Promise<Hex>; txCount: (a: `0x${string}`) => Promise<number>;
  /** Raw secp256k1 signature over a 32-byte digest (key stays with the caller). */ signDigest: (h: Hex) => Promise<{ r: Hex; s: Hex; yParity: number; serialized: Hex }>;
  sleep?: (ms: number) => Promise<void>;
}

/** Runs `calls` as one sponsored user operation; returns the bundled transaction hash. Throws `gasless_unavailable` errors the caller treats as "fall back". */
export async function sendGasless(d: GaslessDeps, calls: Call[], timeoutMs = 120_000): Promise<{ userOpHash: Hex; txHash: Hex }> {
  const unavailable = (why: string) => Object.assign(new Error(`Gasless unavailable: ${why}`), { code: 'gasless_unavailable' });
  const deleg = delegationOf(await d.getCode(d.sender));
  if (deleg === null) throw unavailable('account has contract code');
  if (deleg && deleg !== SIMPLE_7702.toLowerCase()) throw unavailable('account is delegated to another contract');
  const nonce = BigInt(await d.call(ENTRYPOINT_V08, encodeFunctionData({ abi: epAbi, functionName: 'getNonce', args: [d.sender, 0n] })));
  const op: UserOp = { sender: d.sender, nonce, callData: encodeCalls(calls), callGasLimit: 0n, verificationGasLimit: 0n, preVerificationGas: 0n, maxFeePerGas: 0n, maxPriorityFeePerGas: 0n, signature: DUMMY_SIG };
  if (!deleg) {
    // first use: check the pinned delegate really is the v0.8 account, then authorise it
    const ep = await d.call(SIMPLE_7702, encodeFunctionData({ abi: accountAbi, functionName: 'entryPoint' }));
    if (`0x${ep.slice(-40)}`.toLowerCase() !== ENTRYPOINT_V08.toLowerCase()) throw unavailable('delegate contract mismatch');
    const authNonce = await d.txCount(d.sender);
    const sig = await d.signDigest(authorizationDigest(d.chainId, authNonce));
    op.factory = '0x7702'; op.factoryData = '0x';
    op.eip7702Auth = { chainId: toHex(d.chainId), address: SIMPLE_7702, nonce: toHex(authNonce), yParity: toHex(sig.yParity), r: sig.r, s: sig.s };
  }
  const price = await d.bundler('pimlico_getUserOperationGasPrice', []);
  op.maxFeePerGas = BigInt(price?.fast?.maxFeePerGas ?? 0); op.maxPriorityFeePerGas = BigInt(price?.fast?.maxPriorityFeePerGas ?? 0);
  if (op.maxFeePerGas <= 0n) throw unavailable('no gas price');
  const sp = await d.bundler('pm_sponsorUserOperation', [toRpcOp(op), ENTRYPOINT_V08]).catch((e) => { throw unavailable(String(e?.message ?? 'not sponsored')); });
  if (!sp?.paymaster) throw unavailable('not sponsored');
  Object.assign(op, {
    paymaster: sp.paymaster, paymasterData: sp.paymasterData ?? '0x', paymasterVerificationGasLimit: BigInt(sp.paymasterVerificationGasLimit ?? 0), paymasterPostOpGasLimit: BigInt(sp.paymasterPostOpGasLimit ?? 0),
    callGasLimit: BigInt(sp.callGasLimit), verificationGasLimit: BigInt(sp.verificationGasLimit), preVerificationGas: BigInt(sp.preVerificationGas),
  });
  op.signature = (await d.signDigest(userOpHash(op, d.chainId))).serialized;
  const hash: Hex = await d.bundler('eth_sendUserOperation', [toRpcOp(op), ENTRYPOINT_V08]);
  const sleep = d.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const rc = await d.bundler('eth_getUserOperationReceipt', [hash]).catch(() => null);
    if (rc?.receipt?.transactionHash) {
      if (rc.success === false) throw Object.assign(new Error('The sponsored transaction reverted'), { code: 'gasless_reverted' });
      return { userOpHash: hash, txHash: rc.receipt.transactionHash };
    }
    await sleep(2000);
  }
  throw Object.assign(new Error('The sponsored transaction is still pending'), { code: 'gasless_pending', userOpHash: hash });
}
