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
  onlyKeys(raw, ['chainId', 'to', 'expiry', 'permission', 'isAdjustmentAllowed'], 'request');
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
