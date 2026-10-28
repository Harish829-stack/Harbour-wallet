// Feature message handlers: token approvals (scan + revoke). UI-only. Revoke = approve(spender, 0) signed with the local EVM key
// (hardware wallets: not here; use the dApp/explorer flow on the device).
import type { HandlerMap } from './types';
import { chainById, explorerTxUrl } from '../../core/chains/index';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { APPROVAL_CHAINS, scanApprovals, revokeCall } from '../../core/approvals';
import { activeInfo } from './earnKeys';
import { estimatePlan, runPlan } from './earnEvm';
import { openActiveKeys } from '../keys';
import type { CallPlan } from '../../core/staking/evm';

const fail = (error: string, code = 'error') => ({ ok: false as const, error, code });
const isAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

export const handlers: HandlerMap = {
  async approvalsScan(msg, ctx) {
    try {
      const info = await activeInfo(ctx); const owner = info?.addresses.ethereum; if (!owner) return fail('This wallet has no EVM account', 'no_address');
      const ids = (Array.isArray(msg.chainIds) ? msg.chainIds : Object.keys(APPROVAL_CHAINS)).filter((c: unknown) => typeof c === 'string' && APPROVAL_CHAINS[c as string]).slice(0, 8) as string[];
      const res = await Promise.all(ids.map(async (id) => { const c = chainById(id); try { return { id, items: c ? await scanApprovals(owner, id, getRpcUrls(c)) : [] }; } catch (e: any) { return { id, items: [], error: String(e?.message ?? 'failed').slice(0, 120) }; } }));
      return { ok: true, owner, items: res.flatMap((r) => r.items), errors: res.filter((r) => r.error).map((r) => ({ chainId: r.id, error: r.error })), canRevoke: info!.walletType === 'mnemonic' || info!.walletType === 'privateKey' };
    } catch (e: any) { return fail(String(e?.message ?? 'Scan failed')); }
  },
  async approvalsRevoke(msg, ctx) {
    try {
      const info = await activeInfo(ctx); const owner = info?.addresses.ethereum; if (!owner) return fail('This wallet has no EVM account', 'no_address');
      if (info!.walletType !== 'mnemonic' && info!.walletType !== 'privateKey') return fail('Revoking from a hardware wallet is not available here yet', 'unsupported_wallet');
      const chain = chainById(String(msg.chainId ?? '')); if (!chain || !APPROVAL_CHAINS[chain.id] || !isAddr(msg.token) || !isAddr(msg.spender)) return fail('Bad request', 'bad_request');
      const plan: CallPlan[] = [{ ...revokeCall(msg.token, msg.spender), label: 'Revoke approval', gasFallback: 60_000n }];
      if (msg.dryRun === true) { const est = await estimatePlan(chain, owner as `0x${string}`, plan); return { ok: true, fee: est.fee.toString(), symbol: chain.symbol, decimals: chain.decimals }; }
      const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
      try { const [hash] = await runPlan(chain, keys.evmPrivateKey(), plan); return { ok: true, hash, explorerUrl: explorerTxUrl(chain, hash) }; } finally { keys.dispose(); }
    } catch (e: any) { return fail(String(e?.shortMessage ?? e?.message ?? 'Revoke failed').slice(0, 200)); }
  },
};
