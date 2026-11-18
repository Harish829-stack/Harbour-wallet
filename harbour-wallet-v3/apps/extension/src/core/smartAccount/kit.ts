// The ONLY place that touches MetaMask's audited `@metamask/smart-accounts-kit`. Harbour does not hand-build ERC-7821 call data
// or the EIP-712 type list any more: they come from the kit (`/utils`: encodeCalls, SIGNABLE_USER_OP_TYPED_DATA) and the packing
// from viem (toPackedUserOperation). test/fixtures/aa/vectors.json pins the result byte for byte, so a kit or viem upgrade that
// changes anything fails the tests.
//
// WHY NOT toMetaMaskSmartAccount(): the kit ships analytics that are ON by default and post to a MetaMask endpoint the first time
// that function (and createDelegation and others) is called. A wallet must not phone home, so this file imports ONLY the pure
// `/utils` entry point, never the kit's root entry, and test/smart-account-kit-offline.test.js fails if any code path here makes a
// network call or if anything else imports the kit root. The signer is only alive inside the caller's key window
// (openActiveKeys() -> evmAccountFromBytes -> dispose()).
import { type Hex, type LocalAccount } from 'viem';
import { toPackedUserOperation } from 'viem/account-abstraction';
import { encodeCalls as kitEncodeCalls, SIGNABLE_USER_OP_TYPED_DATA } from '@metamask/smart-accounts-kit/utils';
import { ENTRYPOINT_V07, type Address } from './constants';
import type { UserOp } from './userOp';

/** ERC-7821 call data (single call or batch) exactly as MetaMask's kit encodes it. */
export const encodeKitCalls = (calls: readonly { to: Address; value: bigint; data: Hex }[]): Hex => kitEncodeCalls(calls.map((c) => ({ to: c.to, value: c.value, data: c.data })));

/** The kit's EOA stub signature (r=1, s=1, v=27): a valid shape for gas estimation and sponsorship; it signs nothing. Pinned to the kit by the tests. */
export const STUB_SIGNATURE: Hex = '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000011b';

/** Domain name of the Stateless7702 delegate's EIP-712 domain (the kit's contract name for it); pinned by vectors.json. */
const DOMAIN_NAME = 'EIP7702StatelessDeleGator';

type KitSigner = Pick<LocalAccount, 'signTypedData'>;

/** The EIP-712 request the delegate validates, built from the kit's type list and viem's packing. */
export function userOpTypedData(op: UserOp, chainId: number) {
  const packed = toPackedUserOperation({
    sender: op.sender, nonce: op.nonce, callData: op.callData, callGasLimit: op.callGasLimit, verificationGasLimit: op.verificationGasLimit,
    preVerificationGas: op.preVerificationGas, maxFeePerGas: op.maxFeePerGas, maxPriorityFeePerGas: op.maxPriorityFeePerGas,
    paymaster: op.paymaster, paymasterVerificationGasLimit: op.paymasterVerificationGasLimit, paymasterPostOpGasLimit: op.paymasterPostOpGasLimit, paymasterData: op.paymasterData,
    signature: '0x',
  } as any);
  return {
    domain: { name: DOMAIN_NAME, version: '1', chainId, verifyingContract: op.sender },
    types: SIGNABLE_USER_OP_TYPED_DATA, primaryType: 'PackedUserOperation' as const,
    message: { ...packed, entryPoint: ENTRYPOINT_V07 },
  };
}

/** Signs the final operation. `signer` must be dropped by the caller right after. */
export const signUserOp = (op: UserOp, chainId: number, signer: KitSigner): Promise<Hex> => signer.signTypedData(userOpTypedData(op, chainId) as any);
