// Smart accounts: status, enable (upgrade) and revoke of the user's own account (EIP-7702, MetaMask Stateless7702 delegate).
// Thin orchestration over the pure code in core/smartAccount (documentation/smart-accounts). Rules that hold here:
//  - Behind the signed remote flag `smartAccounts` (default false) AND core/harbour/policy.ts smartAccountsAvailable().
//  - Dumb UI: prepare() returns a decoded summary and a requestId; approve()/reject() take only that requestId. The prepared
//    operation, its nonce and its fees stay in this worker's memory. No key, digest or signature ever leaves it.
//  - Upgrade and revoke are user-paid, self-sent type-4 transactions signed here with the existing pattern
//    openActiveKeys() -> signHash() -> dispose() in finally, behind consumeReauth('manage').
import { encodeFunctionData, formatEther, parseAbi, type Hex } from 'viem';
import { serializeSignature } from 'viem/accounts';
import { GATEWAY_URL } from '../kit/endpoints';
import { signHash, evmAccountFromBytes } from '../core/provider/evmAccount';
import { smartAccountsAvailable } from '../core/harbour/policy';
import { resolveSendChain } from '../core/sendService';
import { customNetworks } from '../core/networkRegistry';
import { logWarn } from '../core/logger';
import { DELEGATES, ENTRYPOINT_V07, SMART_ACCOUNT_FLAG, isSmartAccountChain, TYPE4_GAS_LIMIT, PREPARED_TTL_MS, type Address } from '../core/smartAccount/constants';
import { buildSignedType4 } from '../core/smartAccount/delegation';
import { sendOperation } from '../core/smartAccount/send';
import { GuardError, GUARD_MESSAGE, assertFresh, checkAuthorization, delegationState, type DelegationState } from '../core/smartAccount/guard';
import { delegationTarget } from '../core/evmCode';
import { evmClientFor, feeData } from './handlers/earnEvm';
import { activeInfo } from './handlers/earnKeys';
import { openActiveKeys } from './keys';
import { consumeReauth } from './reauth';
import type { HandlerCtx } from './handlers/types';

const getStore = () => import('./store'); // lazy: keeps this module importable outside the extension runtime

export type SmartKind = 'enable' | 'revoke';
interface Prepared { kind: SmartKind; chainId: number; account: Address; walletId: string; before: DelegationState; txNonce: number; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; preparedAt: number }
const prepared = new Map<string, Prepared>(); // in memory only; a worker restart drops them and the user simply starts again

const fail = (error: string, code = 'error') => ({ ok: false as const, error, code });
const errOf = (e: any) => {
  if (e instanceof GuardError) { logWarn('smart account: guard refused a request', e.reason); return fail(GUARD_MESSAGE, 'guard_failed'); }
  return fail(String(e?.shortMessage ?? e?.message ?? 'Request failed').slice(0, 300), String(e?.code ?? 'error'));
};

export async function flagOn(): Promise<boolean> {
  try { return (await getStore()).store.getState().sdkFeatureSlice.flags[SMART_ACCOUNT_FLAG] === true; } catch { return false; }
}

async function context(ctx: HandlerCtx, chainIdRaw: unknown) {
  const chainId = Number(chainIdRaw);
  const info = await activeInfo(ctx);
  if (!info) throw Object.assign(new Error('No wallet found'), { code: 'no_wallet' });
  if (!smartAccountsAvailable({ flag: await flagOn(), chainId, walletType: info.walletType })) throw Object.assign(new Error('Smart accounts are not available for this account or network.'), { code: 'unavailable' });
  const chain = resolveSendChain(undefined, chainId, customNetworks()); if (!chain) throw Object.assign(new Error('Unknown network'), { code: 'unavailable' });
  const account = info.addresses.ethereum as Address | undefined; if (!account) throw Object.assign(new Error('This wallet has no EVM account'), { code: 'no_address' });
  return { chainId, chain, account, walletId: info.walletId, client: evmClientFor(chain) };
}
const codeState = async (client: ReturnType<typeof evmClientFor>, account: Address, chainId: number) => {
  const code = await client.getCode({ address: account });
  const state = delegationState(code, chainId);
  return { state, delegatedTo: state === 'other' ? delegationTarget(code) : null };
};

/** What the UI shows on the Smart account screen. Public data only. */
export async function status(ctx: HandlerCtx, p: { chainId: unknown }) {
  try {
    const chainId = Number(p.chainId); const info = await activeInfo(ctx);
    if (!smartAccountsAvailable({ flag: await flagOn(), chainId, walletType: info?.walletType })) return { ok: true as const, available: false as const };
    const c = await context(ctx, chainId); const s = await codeState(c.client, c.account, chainId);
    return { ok: true as const, available: true as const, chainId, address: c.account, network: c.chain.name, state: s.state, delegate: DELEGATES[chainId], delegatedTo: s.delegatedTo };
  } catch (e) { return errOf(e); }
}

/** Builds the confirmation summary and remembers the operation under a requestId. Signs nothing. */
export async function prepare(ctx: HandlerCtx, p: { kind: unknown; chainId: unknown }) {
  try {
    if (p.kind !== 'enable' && p.kind !== 'revoke') return fail('Unknown request', 'bad_request');
    const kind = p.kind as SmartKind; const c = await context(ctx, p.chainId);
    const s = await codeState(c.client, c.account, c.chainId);
    if (kind === 'enable' && s.state === 'pinned') return fail('Smart account is already on for this network.', 'already_enabled');
    if (kind === 'revoke' && s.state === 'none') return fail('Smart account is not on for this network.', 'not_enabled');
    const txNonce = await c.client.getTransactionCount({ address: c.account, blockTag: 'pending' });
    const f = await feeData(c.client, false);
    const base = f.maxFeePerGas ?? f.gasPrice ?? 0n; if (base <= 0n) throw new Error('Could not read the network fee.');
    const maxFeePerGas = (base * 12n) / 10n; const maxPriorityFeePerGas = f.maxPriorityFeePerGas && f.maxPriorityFeePerGas < maxFeePerGas ? f.maxPriorityFeePerGas : 0n;
    const maxFee = TYPE4_GAS_LIMIT * maxFeePerGas;
    const balance = await c.client.getBalance({ address: c.account });
    if (balance < maxFee) return fail(`You need about ${formatEther(maxFee)} ${c.chain.symbol} for the network fee.`, 'insufficient_funds');
    const now = Date.now(); for (const [k, v] of prepared) if (now - v.preparedAt > PREPARED_TTL_MS) prepared.delete(k);
    const requestId = crypto.randomUUID();
    prepared.set(requestId, { kind, chainId: c.chainId, account: c.account, walletId: c.walletId, before: s.state, txNonce, maxFeePerGas, maxPriorityFeePerGas, preparedAt: now });
    return {
      ok: true as const, requestId, kind, chainId: c.chainId, network: c.chain.name, symbol: c.chain.symbol, address: c.account, currentState: s.state, delegatedTo: s.delegatedTo,
      delegate: kind === 'enable' ? DELEGATES[c.chainId] : null, maxFee: formatEther(maxFee), maxFeeWei: maxFee.toString(), expiresInSec: Math.floor(PREPARED_TTL_MS / 1000), needsReauth: true,
    };
  } catch (e) { return errOf(e); }
}

/** Signs and broadcasts a prepared upgrade or revoke. Needs a fresh 'manage' re-authentication (password or biometrics). */
export async function approve(ctx: HandlerCtx, p: { requestId: unknown }) {
  const id = typeof p.requestId === 'string' ? p.requestId : '';
  const e = prepared.get(id); if (!e) return fail('This request expired. Start again.', 'expired');
  try {
    assertFresh(e.preparedAt);
    const c = await context(ctx, e.chainId);
    if (c.account.toLowerCase() !== e.account.toLowerCase() || c.walletId !== e.walletId) throw new GuardError('account_changed');
    if (!(await consumeReauth('manage', { walletId: e.walletId }))) return fail('Confirm with your password first.', 'AUTH_REQUIRED'); // keep the request for a retry within its lifetime
    prepared.delete(id); // single use from here on
    const now = await codeState(c.client, c.account, c.chainId);
    if (now.state !== e.before) throw new GuardError('state_changed');
    const txNonce = await c.client.getTransactionCount({ address: c.account, blockTag: 'pending' });
    const kind = e.kind === 'enable' ? 'upgrade' : 'revoke';
    const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
    let raw: `0x${string}`;
    try {
      const pk = keys.evmPrivateKey();
      if (evmAccountFromBytes(pk).address.toLowerCase() !== e.account.toLowerCase()) throw new GuardError('key_mismatch');
      const built = buildSignedType4({ account: e.account, chainId: e.chainId, txNonce, maxFeePerGas: e.maxFeePerGas, maxPriorityFeePerGas: e.maxPriorityFeePerGas, kind }, (d) => signHash(d, pk));
      checkAuthorization(built.authorization, { kind, chainId: e.chainId, txNonce });
      raw = built.raw;
    } finally { keys.dispose(); }
    const txHash = await c.client.sendRawTransaction({ serializedTransaction: raw });
    return { ok: true as const, txHash, kind: e.kind, chainId: e.chainId };
  } catch (err) { return errOf(err); }
}

/** Forgets a prepared request. Takes only its id. */
export function reject(p: { requestId: unknown }) {
  if (typeof p.requestId === 'string') prepared.delete(p.requestId);
  return { ok: true as const };
}
/** Test hook: how many prepared requests are held. */
export const preparedCount = () => prepared.size;

// ---------- Harbour's own flows (swap, ...): one operation, optionally sponsored ----------
const epAbi = parseAbi(['function getNonce(address sender, uint192 key) view returns (uint256 nonce)']);
const bundlerUrl = (chainId: number): string | null => (GATEWAY_URL && isSmartAccountChain(chainId) ? `${GATEWAY_URL}/pimlico/${chainId}` : null);

/** True when the flag is on, the chain is pinned and the gateway can reach a bundler. Used to decide whether to offer sponsored actions. */
export async function sendCallsAvailable(chainId: number): Promise<boolean> { return (await flagOn()) && !!bundlerUrl(chainId); }

/**
 * Runs `calls` for the user's own account as ONE smart account operation. The caller (a Harbour feature) has already shown its own
 * confirmation and holds the unlocked key for this action; this function never opens keys itself and never keeps them.
 * Returns the transaction hash, or null when smart accounts cannot be used (flag off, account not enabled, sponsorship refused,
 * guard refused): the caller then sends normal transactions exactly as before. A guard refusal is logged and signs nothing.
 * It throws only for an operation that was sent and then reverted or is still pending (code op_reverted / op_pending).
 */
export async function sendCalls(p: { chainId: number; client: ReturnType<typeof evmClientFor>; account: string; privateKey: Uint8Array; calls: unknown; sponsor?: boolean }): Promise<Hex | null> {
  const url = bundlerUrl(p.chainId); if (!url || !(await flagOn())) return null;
  const account = p.account as Address;
  let id = 0;
  try {
    if (evmAccountFromBytes(p.privateKey).address.toLowerCase() !== account.toLowerCase()) throw new GuardError('key_mismatch');
    const r = await sendOperation({
      chainId: p.chainId, account,
      getCode: () => p.client.getCode({ address: account }),
      readNonce: async () => BigInt((await p.client.call({ to: ENTRYPOINT_V07, data: encodeFunctionData({ abi: epAbi, functionName: 'getNonce', args: [account, 0n] }) })).data ?? '0x0'),
      bundler: async (method, params) => {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(20000) });
        const j = await res.json(); if (j?.error) throw new Error(j.error.message ?? 'bundler error'); return j.result;
      },
      signDigest: (digest) => serializeSignature(signHash(digest, p.privateKey)),
    }, { calls: p.calls, sponsor: p.sponsor !== false });
    return r.txHash;
  } catch (e: any) {
    if (e?.code === 'op_reverted' || e?.code === 'op_pending') throw e;
    if (e instanceof GuardError) { if (e.reason !== 'not_enabled') logWarn('smart account: guard refused an operation', e.reason); return null; }
    return null; // sponsor_refused, estimate_failed, network errors: fall back to normal transactions
  }
}
