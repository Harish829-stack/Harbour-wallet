// EIP-7702 upgrade / revoke: a user-paid, SELF-SENT type-4 transaction. Pure builders; the caller supplies the signer.
// Rules (documentation/smart-accounts/02): the authorization targets the pinned delegate (upgrade) or the zero address (revoke),
// its chainId is the active chain and never 0, and its nonce is the transaction nonce + 1 (the sender's nonce is incremented
// before the authorization list is processed).
import { keccak256, serializeTransaction, type Hex, type Signature } from 'viem';
import { hashAuthorization } from 'viem/experimental';
import { DELEGATES, TYPE4_GAS_LIMIT, ZERO_ADDRESS, type Address } from './constants';

export type Signer = (digest: Hex) => Signature;
export interface Type4Params {
  account: Address; chainId: number; txNonce: number;
  maxFeePerGas: bigint; maxPriorityFeePerGas: bigint;
  /** 'upgrade' authorizes the pinned delegate for chainId; 'revoke' authorizes the zero address. */
  kind: 'upgrade' | 'revoke';
  gas?: bigint;
}

export const authorizationDigest = (contractAddress: Address, chainId: number, nonce: number): Hex => hashAuthorization({ address: contractAddress, chainId, nonce });

/** Target of the authorization for a kind. Throws when there is no pinned delegate for the chain (so an unlisted chain cannot be upgraded). */
export function authorizationTarget(kind: 'upgrade' | 'revoke', chainId: number): Address {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('Invalid chain.'); // chain id 0 means "all chains": always refused
  if (kind === 'revoke') return ZERO_ADDRESS;
  const d = DELEGATES[chainId];
  if (!d) throw new Error('Smart accounts are not available on this network.');
  return d;
}

/** Signs and serializes the self-sent type-4 transaction. */
export function buildSignedType4(p: Type4Params, sign: Signer): { raw: Hex; authorization: { contractAddress: Address; chainId: number; nonce: number } } {
  if (!Number.isSafeInteger(p.txNonce) || p.txNonce < 0) throw new Error('Invalid nonce.');
  if (p.maxFeePerGas <= 0n || p.maxPriorityFeePerGas < 0n || p.maxPriorityFeePerGas > p.maxFeePerGas) throw new Error('Invalid fee.');
  const contractAddress = authorizationTarget(p.kind, p.chainId);
  const nonce = p.txNonce + 1;
  const a = sign(authorizationDigest(contractAddress, p.chainId, nonce));
  const unsigned = {
    type: 'eip7702' as const, chainId: p.chainId, nonce: p.txNonce, maxFeePerGas: p.maxFeePerGas, maxPriorityFeePerGas: p.maxPriorityFeePerGas,
    gas: p.gas ?? TYPE4_GAS_LIMIT, to: p.account, value: 0n, data: '0x' as Hex,
    authorizationList: [{ address: contractAddress, chainId: p.chainId, nonce, r: a.r, s: a.s, yParity: a.yParity ?? (a.v === 28n ? 1 : 0) }],
  };
  const sig = sign(keccak256((serializeTransaction as any)(unsigned)));
  return { raw: (serializeTransaction as any)(unsigned, sig) as Hex, authorization: { contractAddress, chainId: p.chainId, nonce } };
}
