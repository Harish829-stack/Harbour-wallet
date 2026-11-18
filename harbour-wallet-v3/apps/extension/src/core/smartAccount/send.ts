// Build, sponsor, check, sign and send ONE smart account operation (Flow B). Pure orchestration: every side effect (chain reads,
// bundler calls, the signature) is injected, so tests run it with fakes and the worker passes real ones. The key never enters this
// file: `signUserOp` is a callback that signs only the final operation assembled HERE (the kit derives the typed data from it;
// no third party ever supplies a hash or typed data to sign). Provider replies are read only through the guard's strict readers.
import { keccak256, toHex, type Hex } from 'viem';
import { ENTRYPOINT_V07, limitsFor, type Address } from './constants';
import { encodeCalls } from './abi';
import { toRpcOp, type UserOp } from './userOp';
import { STUB_SIGNATURE } from './kit';
import { acceptGasEstimate, padGasEstimate, acceptGasPrice, acceptSponsorReply, assembleOp, checkIntent, maxTotalFee, requirePinnedDelegation, type GasFields, type SponsorFields } from './guard';

export interface SendDeps {
  chainId: number; account: Address;
  getCode(): Promise<string | null | undefined>;
  /** EntryPoint.getNonce(account, 0): read from the chain, never from a provider reply. */
  readNonce(): Promise<bigint>;
  bundler(method: string, params: unknown[]): Promise<any>;
  /** Signs the final operation (kit-built EIP-712 PackedUserOperation) and returns the serialized 65-byte signature. */
  signUserOp(op: UserOp): Promise<Hex>;
  /** The transaction receipt from the USER'S OWN RPC (not the bundler). The bundler's receipt only names the transaction; success is read here. */
  getTxReceipt(hash: Hex): Promise<ChainReceipt | null | undefined>;
  sleep?(ms: number): Promise<void>;
}
export interface ChainReceipt { status: string; logs: readonly { address: string; topics: readonly string[]; data: string }[] }
export interface SendInput { calls: unknown; sponsor: boolean }
export interface Sent { userOpHash: Hex; txHash: Hex; sponsored: boolean; maxFeeWei: bigint }
/** topic0 of EntryPoint v0.7 UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed). */
export const USER_OP_EVENT_TOPIC = keccak256(toHex('UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)'));
export type Inclusion = 'success' | 'op_reverted' | 'tx_reverted' | 'mismatch';
/** Reads a chain receipt strictly: the transaction must have succeeded and carry the EntryPoint's UserOperationEvent for exactly this hash (and sender, when known). Anything else is a mismatch. */
export function verifyInclusion(rc: ChainReceipt | null | undefined, userOpHash: string, account?: string): Inclusion {
  if (!rc || !Array.isArray(rc.logs)) return 'mismatch';
  if (rc.status !== 'success') return 'tx_reverted';
  const want = userOpHash.toLowerCase();
  const log = rc.logs.find((l) => l && typeof l.address === 'string' && l.address.toLowerCase() === ENTRYPOINT_V07.toLowerCase() && Array.isArray(l.topics) && l.topics[0]?.toLowerCase() === USER_OP_EVENT_TOPIC && l.topics[1]?.toLowerCase() === want);
  if (!log || typeof log.data !== 'string' || !/^0x[0-9a-fA-F]{256}$/.test(log.data)) return 'mismatch';
  if (account && log.topics[2]?.toLowerCase() !== '0x' + '0'.repeat(24) + account.slice(2).toLowerCase()) return 'mismatch';
  return BigInt('0x' + log.data.slice(2 + 64, 2 + 128)) === 1n ? 'success' : 'op_reverted';
}
export const codeErr = (message: string, code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { code }, extra);

export async function sendOperation(d: SendDeps, input: SendInput, timeoutMs = 120_000): Promise<Sent> {
  const L = limitsFor(d.chainId);
  const calls = checkIntent({ chainId: d.chainId, from: d.account, account: d.account, calls: input.calls });
  requirePinnedDelegation(await d.getCode(), d.chainId);
  const nonce = await d.readNonce();
  const callData = encodeCalls(calls);
  const price = acceptGasPrice(await d.bundler('pimlico_getUserOperationGasPrice', []), L);
  const zero: GasFields = { callGasLimit: 0n, verificationGasLimit: 0n, preVerificationGas: 0n };
  const stub = assembleOp({ sender: d.account, nonce, callData, price, gas: zero, signature: STUB_SIGNATURE, limits: L });
  let gas: GasFields; let sponsor: SponsorFields | undefined;
  // Sponsorship is tried first; any refusal (first free operation already used, policy budget spent, paymaster unreachable) falls back to a
  // user-paid operation. A reply that arrives but fails the guard (unknown paymaster, bad fields) is NOT a refusal and still signs nothing.
  let reply: unknown; let refused = !input.sponsor;
  if (input.sponsor) { try { reply = await d.bundler('pm_sponsorUserOperation', [toRpcOp(stub), ENTRYPOINT_V07]); } catch { refused = true; } }
  if (!refused) { sponsor = acceptSponsorReply(reply, d.chainId, L); gas = sponsor; }
  else {
    gas = padGasEstimate(acceptGasEstimate(await d.bundler('eth_estimateUserOperationGas', [toRpcOp(stub), ENTRYPOINT_V07]).catch((e) => { throw codeErr(String(e?.message ?? 'Could not estimate the operation'), 'estimate_failed'); }), L), L);
  }
  const unsigned: UserOp = assembleOp({ sender: d.account, nonce, callData, price, gas, sponsor, signature: STUB_SIGNATURE, limits: L }); // enforces the fee cap
  const op: UserOp = { ...unsigned, signature: await d.signUserOp(unsigned) };
  const hash: Hex = await d.bundler('eth_sendUserOperation', [toRpcOp(op), ENTRYPOINT_V07]);
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const until = Date.now() + timeoutMs;
  const maxFeeWei = maxTotalFee(op);
  while (Date.now() < until) {
    const rc = await d.bundler('eth_getUserOperationReceipt', [hash]).catch(() => null);
    const tx = rc?.receipt?.transactionHash;
    if (typeof tx === 'string' && /^0x[0-9a-fA-F]{64}$/.test(tx)) {
      const chainRc = await d.getTxReceipt(tx as Hex).catch(() => null);
      if (chainRc) { // not on our RPC yet: keep waiting
        const r = verifyInclusion(chainRc, hash, d.account);
        if (r === 'success') return { userOpHash: hash, txHash: tx as Hex, sponsored: !!sponsor, maxFeeWei };
        if (r === 'mismatch') throw codeErr('The bundler receipt does not match the chain', 'receipt_mismatch', { userOpHash: hash });
        throw codeErr('The transaction reverted', 'op_reverted', { userOpHash: hash });
      }
    }
    await sleep(2000);
  }
  throw codeErr('The transaction is still pending', 'op_pending', { userOpHash: hash });
}
