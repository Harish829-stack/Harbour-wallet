// P5 (partly built): strict normalizer for a dApp's permission request (ERC-7715 style, session key held by the dApp).
// Harbour creates and stores no key: the site sends only the PUBLIC address of its own session key plus the limits it wants.
// Refused always: unlimited / root grants, expiry beyond 30 days or in the past, unknown fields, an unpinned chain.
// NOT yet reachable from a dApp: signing the delegation needs the Delegation Framework's per-chain addresses confirmed on
// Sepolia and Base Sepolia first (open question Q7, research/aa-spike/q7.mjs). Until then no provider method points here.
import { getAddress, isAddress } from 'viem';
import { ERR, ProviderError } from '../provider/errors';
import { isSmartAccountChain } from './constants';

export const MAX_PERMISSION_SECONDS = 30 * 24 * 3600;
const MAX_UINT256 = (1n << 256n) - 1n;
export type PermissionType = 'native-token-allowance' | 'erc20-token-allowance';
export interface NormalizedPermission { chainId: number; sessionKey: string; expiry: number; type: PermissionType; allowance: bigint; token: string | null }

const bad = (m: string): never => { throw new ProviderError(ERR.INVALID_PARAMS, m); };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const QTY = /^0x(0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/;
const onlyKeys = (o: Record<string, unknown>, keys: string[], what: string) => { for (const k of Object.keys(o)) if (!keys.includes(k)) bad(`Unsupported ${what} field: ${k}.`); };

export function normalizePermissionRequest(raw: unknown, now: number = Math.floor(Date.now() / 1000)): NormalizedPermission {
  if (!isObj(raw)) return bad('Expected a permission request object.');
  onlyKeys(raw, ['chainId', 'from', 'to', 'expiry', 'permission', 'isAdjustmentAllowed'], 'request');
  if (raw.isAdjustmentAllowed !== undefined && raw.isAdjustmentAllowed !== false) bad('Adjustable permissions are not supported.');
  if (typeof raw.chainId !== 'string' || !QTY.test(raw.chainId)) bad('Invalid chainId.');
  const chainId = Number(BigInt(raw.chainId as string));
  if (!isSmartAccountChain(chainId)) throw new ProviderError(ERR.CALLS_CHAIN_UNSUPPORTED);
  if (typeof raw.to !== 'string' || !isAddress(raw.to, { strict: false })) bad('`to` must be the public address of the site\'s session key.');
  if (typeof raw.expiry !== 'number' || !Number.isSafeInteger(raw.expiry)) bad('`expiry` must be a unix time in seconds.');
  const expiry = raw.expiry as number;
  if (expiry <= now) bad('The permission has already expired.');
  if (expiry > now + MAX_PERMISSION_SECONDS) bad('A permission can last at most 30 days.');
  const p = raw.permission; if (!isObj(p)) return bad('Missing permission.');
  onlyKeys(p, ['type', 'data'], 'permission');
  if (p.type !== 'native-token-allowance' && p.type !== 'erc20-token-allowance') throw new ProviderError(ERR.CAPS_UNSUPPORTED, 'Unsupported permission type.');
  const d = p.data; if (!isObj(d)) return bad('Missing permission data.');
  onlyKeys(d, p.type === 'erc20-token-allowance' ? ['allowance', 'tokenAddress'] : ['allowance'], 'permission data');
  if (typeof d.allowance !== 'string' || !QTY.test(d.allowance)) bad('Invalid allowance.');
  const allowance = BigInt(d.allowance as string);
  if (allowance === 0n) bad('The allowance must be more than zero.');
  if (allowance === MAX_UINT256) bad('Unlimited permissions are never granted.');
  let token: string | null = null;
  if (p.type === 'erc20-token-allowance') { if (typeof d.tokenAddress !== 'string' || !isAddress(d.tokenAddress, { strict: false })) bad('Invalid token address.'); token = getAddress(d.tokenAddress as string); }
  return { chainId, sessionKey: getAddress(raw.to as string), expiry, type: p.type, allowance, token };
}

/** wallet_requestExecutionPermissions params: exactly ONE request, for the connected account on the connected chain. `from` may be omitted or must be that account. */
export function normalizeGrantParams(params: unknown, me: string, chainId: number, now?: number): NormalizedPermission {
  if (!Array.isArray(params) || params.length !== 1) bad('Send exactly one permission request.');
  const r = (params as unknown[])[0];
  if (!isObj(r)) return bad('Expected a permission request object.');
  if (r.from !== undefined && !(typeof r.from === 'string' && isAddress(r.from, { strict: false }) && r.from.toLowerCase() === me.toLowerCase())) throw new ProviderError(ERR.UNAUTHORIZED, 'The requested account has not been authorized by the user.');
  const p = normalizePermissionRequest(r, now);
  if (p.chainId !== chainId) throw new ProviderError(ERR.CALLS_CHAIN_UNSUPPORTED);
  return p;
}

export interface GrantRecord {
  id: string; origin: string; chainId: number; account: string; sessionKey: string; type: PermissionType; allowance: string; token: string | null; expiry: number; grantedAt: number;
  /** ABI-encoded signed delegation (what the site redeems); stored so the site can read its grant back. */
  context: string;
  delegation: { delegate: string; delegator: string; authority: string; caveats: Array<{ enforcer: string; terms: string; args: string }>; salt: string; signature: string };
}
/** The ERC-7715 response for a stored grant (the context is the ABI-encoded signed delegation the site redeems through the DelegationManager). */
export function grantResponse(r: GrantRecord, context: string, delegationManager: string) {
  const data: Record<string, string> = { allowance: '0x' + BigInt(r.allowance).toString(16) }; if (r.token) data.tokenAddress = r.token;
  return { chainId: '0x' + r.chainId.toString(16), from: r.account, to: r.sessionKey, expiry: r.expiry, permission: { type: r.type, data, isAdjustmentAllowed: false }, context, delegationManager, dependencies: [] as unknown[] };
}
