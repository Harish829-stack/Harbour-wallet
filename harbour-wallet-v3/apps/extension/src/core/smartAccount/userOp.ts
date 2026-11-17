// ERC-4337 v0.7 user operation for the MetaMask Stateless7702 delegate. Pure: no I/O, no keys.
// The delegate validates an EIP-712 `PackedUserOperation` (domain EIP7702StatelessDeleGator v1, verifyingContract = the account
// itself), NOT the standard userOpHash. Harbour computes this digest itself; no third party ever supplies a hash to sign.
import { concat, hashTypedData, pad, toHex, type Hex } from 'viem';
import { ENTRYPOINT_V07, type Address } from './constants';

export interface UserOp {
  sender: Address; nonce: bigint; callData: Hex;
  callGasLimit: bigint; verificationGasLimit: bigint; preVerificationGas: bigint;
  maxFeePerGas: bigint; maxPriorityFeePerGas: bigint;
  paymaster?: Address; paymasterVerificationGasLimit?: bigint; paymasterPostOpGasLimit?: bigint; paymasterData?: Hex;
  signature: Hex;
}

/** MetaMask kit's EOA stub signature (r=1, s=1, v=0x1b): valid shape for gas estimation. */
export const STUB_SIGNATURE: Hex = '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000011b';

const p16 = (n: bigint): Hex => pad(toHex(n), { size: 16 });

export const paymasterAndData = (op: UserOp): Hex =>
  op.paymaster ? concat([op.paymaster, p16(op.paymasterVerificationGasLimit ?? 0n), p16(op.paymasterPostOpGasLimit ?? 0n), op.paymasterData ?? '0x']) : '0x';

export function userOpTypedData(op: UserOp, chainId: number) {
  return {
    domain: { name: 'EIP7702StatelessDeleGator', version: '1', chainId, verifyingContract: op.sender },
    types: {
      PackedUserOperation: [
        { name: 'sender', type: 'address' }, { name: 'nonce', type: 'uint256' }, { name: 'initCode', type: 'bytes' }, { name: 'callData', type: 'bytes' },
        { name: 'accountGasLimits', type: 'bytes32' }, { name: 'preVerificationGas', type: 'uint256' }, { name: 'gasFees', type: 'bytes32' },
        { name: 'paymasterAndData', type: 'bytes' }, { name: 'entryPoint', type: 'address' },
      ],
    },
    primaryType: 'PackedUserOperation' as const,
    message: {
      sender: op.sender, nonce: op.nonce, initCode: '0x' as Hex, callData: op.callData,
      accountGasLimits: concat([p16(op.verificationGasLimit), p16(op.callGasLimit)]), preVerificationGas: op.preVerificationGas,
      gasFees: concat([p16(op.maxPriorityFeePerGas), p16(op.maxFeePerGas)]), paymasterAndData: paymasterAndData(op), entryPoint: ENTRYPOINT_V07,
    },
  };
}

/** The 32-byte digest the account key signs. */
export const userOpDigest = (op: UserOp, chainId: number): Hex => hashTypedData(userOpTypedData(op, chainId));

/** JSON-RPC form of an operation (hex quantities) as bundlers expect it. No `factory` fields: the account already exists (7702). */
export function toRpcOp(op: UserOp): Record<string, string> {
  const h = (v: bigint) => toHex(v);
  const o: Record<string, string> = {
    sender: op.sender, nonce: h(op.nonce), callData: op.callData, callGasLimit: h(op.callGasLimit), verificationGasLimit: h(op.verificationGasLimit),
    preVerificationGas: h(op.preVerificationGas), maxFeePerGas: h(op.maxFeePerGas), maxPriorityFeePerGas: h(op.maxPriorityFeePerGas), signature: op.signature,
  };
  if (op.paymaster) {
    o.paymaster = op.paymaster; o.paymasterVerificationGasLimit = h(op.paymasterVerificationGasLimit ?? 0n);
    o.paymasterPostOpGasLimit = h(op.paymasterPostOpGasLimit ?? 0n); o.paymasterData = op.paymasterData ?? '0x';
  }
  return o;
}
