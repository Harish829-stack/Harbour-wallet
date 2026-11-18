// P5: build and check the delegation a dApp's session key receives. Pure; no I/O, no keys, no network.
// Encoding and hashing are MetaMask's: caveat terms and the delegation struct hash come from @metamask/delegation-core and the caveat
// builder and typed-data types from the kit's /utils entry (never its root entry, which carries default-on analytics; see kit.ts).
// What stays Harbour's: WHICH caveats a request may get, and the guard that re-reads the finished delegation with the independent
// decoders and refuses anything that is not exactly the approved grant.
import { hashTypedData, getAddress, type Hex } from 'viem';
import { createCaveatBuilder, SIGNABLE_DELEGATION_TYPED_DATA } from '@metamask/smart-accounts-kit/utils';
import {
  ROOT_AUTHORITY, hashDelegation, encodeDelegations, decodeTimestampTerms, decodeNativeTokenTransferAmountTerms, decodeExactCalldataTerms, decodeERC20TransferAmountTerms, decodeValueLteTerms,
} from '@metamask/delegation-core';
import { DELEGATION_MANAGER, ENFORCERS, isSmartAccountChain, type Address } from './constants';
import { GuardError } from './guard';
import type { NormalizedPermission } from './permissions';

export interface DelegationCaveat { enforcer: Address; terms: Hex; args: Hex }
export interface PermissionDelegation { delegate: Address; delegator: Address; authority: Hex; caveats: DelegationCaveat[]; salt: bigint }

const environment = { DelegationManager: DELEGATION_MANAGER, caveatEnforcers: ENFORCERS } as any;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The delegation for a normalized request: root authority from the user's own account, limited by exactly three caveats. */
export function buildPermissionDelegation(p: NormalizedPermission, delegator: Address, salt: bigint): PermissionDelegation {
  if (!isSmartAccountChain(p.chainId)) throw new GuardError('chain');
  if (salt < 0n || salt >= 1n << 256n) throw new GuardError('salt');
  const b = createCaveatBuilder(environment);
  if (p.type === 'native-token-allowance') b.addCaveat('exactCalldata', { calldata: '0x' }).addCaveat('nativeTokenTransferAmount', { maxAmount: p.allowance });
  else b.addCaveat('valueLte', { maxValue: 0n }).addCaveat('erc20TransferAmount', { tokenAddress: p.token as Address, maxAmount: p.allowance });
  b.addCaveat('timestamp', { afterThreshold: 0, beforeThreshold: p.expiry });
  const d: PermissionDelegation = { delegate: p.sessionKey as Address, delegator, authority: ROOT_AUTHORITY as Hex, caveats: b.build() as DelegationCaveat[], salt };
  checkPermissionDelegation(d, p, delegator);
  return d;
}

/** Refuses anything that is not EXACTLY the approved grant: this delegate, this delegator, root authority, exactly the expected enforcers
 *  (pinned addresses, in order) with terms that decode to the approved limits. Runs on every delegation before it is signed. */
export function checkPermissionDelegation(d: PermissionDelegation, p: NormalizedPermission, delegator: Address): void {
  const fail = (r: string): never => { throw new GuardError(r); };
  if (!same(d.delegate, p.sessionKey) || !same(d.delegator, delegator)) fail('delegation_parties');
  if (same(d.delegate, d.delegator)) fail('delegation_self');
  if (d.authority !== ROOT_AUTHORITY) fail('delegation_authority');
  const native = p.type === 'native-token-allowance';
  const want = native ? [ENFORCERS.ExactCalldataEnforcer, ENFORCERS.NativeTokenTransferAmountEnforcer, ENFORCERS.TimestampEnforcer] : [ENFORCERS.ValueLteEnforcer, ENFORCERS.ERC20TransferAmountEnforcer, ENFORCERS.TimestampEnforcer];
  if (d.caveats.length !== want.length) fail('delegation_caveats');
  d.caveats.forEach((c, i) => { if (!same(c.enforcer, want[i])) fail('delegation_enforcer'); if (c.args !== '0x00' && c.args !== '0x') fail('delegation_args'); });
  const [c0, c1, c2] = d.caveats;
  try {
    if (native) {
      if (decodeExactCalldataTerms(c0.terms).calldata !== '0x') fail('delegation_calldata');
      if (decodeNativeTokenTransferAmountTerms(c1.terms).maxAmount !== p.allowance) fail('delegation_allowance');
    } else {
      if (decodeValueLteTerms(c0.terms).maxValue !== 0n) fail('delegation_value');
      const t = decodeERC20TransferAmountTerms(c1.terms);
      if (!same(t.tokenAddress, p.token as string) || t.maxAmount !== p.allowance) fail('delegation_allowance');
    }
    const ts = decodeTimestampTerms(c2.terms);
    if (ts.afterThreshold !== 0 || ts.beforeThreshold !== p.expiry) fail('delegation_expiry');
  } catch (e) { if (e instanceof GuardError) throw e; fail('delegation_terms'); }
  if (!(d.salt >= 0n && d.salt < 1n << 256n)) fail('salt');
}

/** The EIP-712 request the account signs (DelegationManager domain). */
export function delegationTypedData(d: PermissionDelegation, chainId: number) {
  return {
    domain: { name: 'DelegationManager', version: '1', chainId, verifyingContract: DELEGATION_MANAGER },
    types: SIGNABLE_DELEGATION_TYPED_DATA, primaryType: 'Delegation' as const,
    message: { delegate: getAddress(d.delegate), delegator: getAddress(d.delegator), authority: d.authority, caveats: d.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })), salt: d.salt },
  };
}

/** The delegation's struct hash (MetaMask's hashDelegation): the identifier used to disable it on-chain later. */
export const permissionHash = (d: PermissionDelegation): Hex => hashDelegation({ ...d, signature: '0x' } as any) as Hex;
export const permissionDigest = (d: PermissionDelegation, chainId: number): Hex => hashTypedData(delegationTypedData(d, chainId) as any);

/** Signs the checked delegation. The caller re-checks first, and drops the signer right after. */
export async function signPermission(d: PermissionDelegation, p: NormalizedPermission, delegator: Address, signer: { signTypedData: (a: any) => Promise<Hex> }): Promise<Hex> {
  checkPermissionDelegation(d, p, delegator);
  return signer.signTypedData(delegationTypedData(d, p.chainId));
}

/** The ABI-encoded signed delegation chain a site passes to the DelegationManager (ERC-7715 `context`). MetaMask's encoder. */
export const permissionContext = (d: PermissionDelegation, signature: Hex): Hex => encodeDelegations([{ ...d, signature }] as any) as Hex;
