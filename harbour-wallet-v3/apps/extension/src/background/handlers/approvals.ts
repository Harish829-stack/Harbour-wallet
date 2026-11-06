// Feature message handlers: token approvals (scan + revoke). UI-only. Revoke = approve(spender, 0) signed with the local EVM key
// (hardware wallets: not here; use the dApp/explorer flow on the device).
import type { HandlerMap } from './types';
import { decodeFunctionResult, parseAbi } from 'viem';
import { chainById, explorerTxUrl } from '../../core/chains/index';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { APPROVAL_CHAINS, revokeCall } from '../../core/approvals';
import { scanOnChain, readAllowance, pickScanChains, PERMIT2, type ScanSpender, type ScanToken, type LedgerPair } from '../../core/approvalScan';
import { readTokens } from '../../core/customTokens';
import { displayHost } from '../../core/provider/origin';
import { ethCall } from '../../core/staking/evm';
import { activeInfo } from './earnKeys';
import { estimatePlan, runPlan } from './earnEvm';
import { openActiveKeys } from '../keys';
import { activeEntry } from '../walletState';
import { perms } from '../provider/index';
import { SEPOLIA, BASE_SEPOLIA, SWAP_BASES } from '../../integrations/testnet-defi/config';
import { aaveGateway } from '../../integrations/testnet-defi/aavekit';
import type { CallPlan } from '../../core/staking/evm';

const fail = (error: string, code = 'error') => ({ ok: false as const, error, code });
const isAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const reservesAbi = parseAbi(['function getAllReservesTokens() view returns ((string symbol, address tokenAddress)[])']);

/** Contracts Harbour itself sends approvals to on each network (the "known spenders" every added token is checked against). */
export function knownSpenders(evmId: number): ScanSpender[] {
  const out: ScanSpender[] = [{ address: PERMIT2, name: 'Permit2' }];
  if (evmId === SEPOLIA.chainId) out.push({ address: SEPOLIA.pool, name: 'Aave V3 Pool' }, { address: SEPOLIA.apiRouter, name: 'Uniswap router' }, { address: SEPOLIA.apiRouterLegacy, name: 'Uniswap router (legacy)' }, { address: SEPOLIA.universalRouter, name: 'Uniswap Universal Router' });
  if (evmId === BASE_SEPOLIA.chainId) { out.push({ address: BASE_SEPOLIA.pool, name: 'Aave V3 Pool' }); const g = aaveGateway(evmId); if (g) out.push({ address: g, name: 'Aave WETH Gateway' }); }
  return out;
}
/** Tokens the protocols Harbour talks to use: Uniswap base tokens (Sepolia) and the market's Aave reserves (one read). Best effort. */
async function protocolTokens(evmId: number, rpcUrls: string[]): Promise<ScanToken[]> {
  const out: ScanToken[] = []; if (evmId === SEPOLIA.chainId) for (const a of SWAP_BASES) out.push({ address: a });
  const provider = evmId === SEPOLIA.chainId ? SEPOLIA.dataProvider : evmId === BASE_SEPOLIA.chainId ? BASE_SEPOLIA.dataProvider : undefined;
  if (provider) {
    try {
      const raw = await ethCall(fetch, rpcUrls, provider, '0xb316ff89'); // getAllReservesTokens()
      for (const r of decodeFunctionResult({ abi: reservesAbi, functionName: 'getAllReservesTokens', data: raw }) as ReadonlyArray<{ symbol: string; tokenAddress: string }>) if (isAddr(r.tokenAddress)) out.push({ address: r.tokenAddress, symbol: r.symbol.slice(0, 16) });
    } catch { /* the added-token and ledger candidates still apply */ }
  }
  return out;
}

export const handlers: HandlerMap = {
  async approvalsScan(msg, ctx) {
    try {
      const info = await activeInfo(ctx); const owner = info?.addresses.ethereum; if (!owner) return fail('This wallet has no EVM account', 'no_address');
      const pick = pickScanChains(APPROVAL_CHAINS, msg.chainIds ?? msg.chainId); if ('error' in pick) return fail(pick.error, pick.code);
      const e = activeEntry((await ctx.vault.getState()) as any); const added = readTokens((e?.[1] as any)?.customTokens);
      const ledgerAll = await perms.approvals();
      const res = await Promise.all(pick.ids.map(async (id) => {
        const c = chainById(id); const evmId = APPROVAL_CHAINS[id];
        try {
          if (!c) throw new Error('Unknown network');
          const rpcUrls = getRpcUrls(c);
          const mine = ledgerAll.filter((a) => a.chainId === evmId && a.owner.toLowerCase() === owner.toLowerCase());
          const ledger: LedgerPair[] = mine.map((a) => ({ token: a.token, spender: a.spender, at: a.at, label: a.origin ? displayHost(a.origin) : a.source === 'swap' ? 'Harbour Swap' : a.source === 'earn' ? 'Harbour Earn' : undefined }));
          const tokens: ScanToken[] = [...(await protocolTokens(evmId, rpcUrls)), ...added.filter((t) => t.chainId === evmId && !t.chain).map((t) => ({ address: t.address, symbol: t.symbol, name: t.name, decimals: t.decimals }))];
          const r = await scanOnChain({ owner, chainId: id, rpcUrls, tokens, spenders: knownSpenders(evmId), ledger });
          // A recorded approval whose allowance is now zero was revoked or spent: forget it.
          for (const s of r.settled) for (const a of mine) if (a.token.toLowerCase() === s.token.toLowerCase() && a.spender.toLowerCase() === s.spender.toLowerCase()) await perms.untrackApproval(a.id).catch(() => {});
          return { id, items: r.items, coverage: r.coverage };
        } catch (er: any) { return { id, items: [], error: String(er?.message ?? 'failed').slice(0, 120) }; }
      }));
      return { ok: true, owner, items: res.flatMap((r) => r.items), coverage: res.flatMap((r) => (r.coverage ? [r.coverage] : [])), supported: Object.keys(APPROVAL_CHAINS), errors: res.filter((r) => r.error).map((r) => ({ chainId: r.id, error: r.error })), canRevoke: info!.walletType === 'mnemonic' || info!.walletType === 'privateKey' };
    } catch (e: any) { return fail(String(e?.message ?? 'Scan failed')); }
  },
  async approvalsRevoke(msg, ctx) {
    try {
      const info = await activeInfo(ctx); const owner = info?.addresses.ethereum; if (!owner) return fail('This wallet has no EVM account', 'no_address');
      if (info!.walletType !== 'mnemonic' && info!.walletType !== 'privateKey') return fail('Revoking from a hardware wallet is not available here yet', 'unsupported_wallet');
      const chain = chainById(String(msg.chainId ?? '')); if (!chain || !APPROVAL_CHAINS[chain.id] || !isAddr(msg.token) || !isAddr(msg.spender)) return fail('Bad request', 'bad_request');
      // Re-check on chain right before sending: an allowance that is already zero needs no transaction (and no fee).
      const live = await readAllowance(getRpcUrls(chain), msg.token, owner, msg.spender);
      if (live === 0n) return { ok: true, alreadyRevoked: true };
      const plan: CallPlan[] = [{ ...revokeCall(msg.token, msg.spender), label: 'Revoke approval', gasFallback: 60_000n }];
      if (msg.dryRun === true) { const est = await estimatePlan(chain, owner as `0x${string}`, plan); return { ok: true, fee: est.fee.toString(), symbol: chain.symbol, decimals: chain.decimals }; }
      const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
      try { const [hash] = await runPlan(chain, keys.evmPrivateKey(), plan); return { ok: true, hash, explorerUrl: explorerTxUrl(chain, hash) }; } finally { keys.dispose(); }
    } catch (e: any) { return fail(String(e?.shortMessage ?? e?.message ?? 'Revoke failed').slice(0, 200)); }
  },
};
