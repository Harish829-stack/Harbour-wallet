// ERC-4337 v0.7 user operation shape and its JSON-RPC form. Pure: no I/O, no keys. The signature over it (the delegate's EIP-712
// PackedUserOperation) and the stub signature come from MetaMask's kit (kit.ts); no third party ever supplies a hash to sign.
import { toHex, type Hex } from 'viem';
import type { Address } from './constants';

export interface UserOp {
  sender: Address; nonce: bigint; callData: Hex;
  callGasLimit: bigint; verificationGasLimit: bigint; preVerificationGas: bigint;
  maxFeePerGas: bigint; maxPriorityFeePerGas: bigint;
  paymaster?: Address; paymasterVerificationGasLimit?: bigint; paymasterPostOpGasLimit?: bigint; paymasterData?: Hex;
  signature: Hex;
}

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
