// Token approval scan (plan Phase 8): GoPlus approval security lists the ERC-20 allowances an address has granted, with spender
// reputation; Harbour then reads each allowance on-chain (the source of truth) and offers a revoke (approve(spender, 0)).
// GoPlus is advisory and keyless; its response shape is parsed defensively.
import { decodeFunctionResult, encodeFunctionData, erc20Abi, formatUnits } from 'viem';
import type { Fetcher } from './chains/adapters/types';
import { ethCall } from './staking/evm';

export const APPROVAL_CHAINS: Record<string, number> = { ethereum: 1, smartchain: 56, polygon: 137, arbitrum: 42161, base: 8453, optimism: 10, avalanchec: 43114 };
const MAX = (1n << 256n) - 1n;
export interface Approval { chainId: string; token: string; symbol: string; name: string; decimals: number; spender: string; spenderName?: string; allowance: string; formatted: string; unlimited: boolean; risky: boolean; riskNotes: string[]; approvedAt?: number }

const bool = (v: unknown) => v === 1 || v === '1' || v === true;
export function parseGoPlus(chainId: string, body: any): Omit<Approval, 'allowance' | 'formatted' | 'unlimited'>[] {
  const rows: any[] = Array.isArray(body?.result) ? body.result : [];
  const out: Omit<Approval, 'allowance' | 'formatted' | 'unlimited'>[] = [];
  for (const t of rows) {
    const token = String(t?.token_address ?? '').toLowerCase(); if (!/^0x[0-9a-f]{40}$/.test(token)) continue;
    const list: any[] = Array.isArray(t?.approved_list) ? t.approved_list : Array.isArray(t?.approvals) ? t.approvals : [];
    for (const a of list) {
      const spender = String(a?.approved_contract ?? '').toLowerCase(); if (!/^0x[0-9a-f]{40}$/.test(spender)) continue;
      const info = a?.address_info ?? {};
      const notes = [...(Array.isArray(info.malicious_behavior) ? info.malicious_behavior.map(String) : []), ...(bool(info.doubt_list) ? ['doubt_list'] : []), ...(info.is_open_source === 0 || info.is_open_source === '0' ? ['not_open_source'] : [])];
      out.push({ chainId, token, symbol: String(t.token_symbol ?? '').slice(0, 16), name: String(t.token_name ?? '').slice(0, 60), decimals: Number(t.decimals ?? 18), spender, spenderName: info.contract_name ? String(info.contract_name).slice(0, 60) : (info.tag ? String(info.tag).slice(0, 60) : undefined), risky: notes.some((n) => n !== 'not_open_source') || bool(t.malicious_address), riskNotes: notes, approvedAt: Number(a?.approved_time) ? Number(a.approved_time) * 1000 : undefined });
    }
  }
  return out;
}

export async function scanApprovals(owner: string, chainId: string, rpcUrls: string[], f: Fetcher = fetch): Promise<Approval[]> {
  const evm = APPROVAL_CHAINS[chainId]; if (!evm) return [];
  const r = await f(`https://api.gopluslabs.io/api/v2/token_approval_security/${evm}?addresses=${owner.toLowerCase()}`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Approval scan failed (HTTP ${r.status})`);
  const found = parseGoPlus(chainId, await r.json()).slice(0, 60);
  const live = await Promise.all(found.map(async (a) => {
    try {
      const raw = await ethCall(f, rpcUrls, a.token, encodeFunctionData({ abi: erc20Abi, functionName: 'allowance', args: [owner as `0x${string}`, a.spender as `0x${string}`] }));
      const v = decodeFunctionResult({ abi: erc20Abi, functionName: 'allowance', data: raw }) as bigint;
      return v > 0n ? { ...a, allowance: v.toString(), formatted: v >= MAX / 2n ? 'Unlimited' : formatUnits(v, a.decimals), unlimited: v >= MAX / 2n } : null;
    } catch { return null; } // unreadable: not shown rather than guessed
  }));
  return live.filter((x): x is Approval => !!x).sort((x, y) => Number(y.risky) - Number(x.risky) || Number(y.unlimited) - Number(x.unlimited));
}
export const revokeCall = (token: string, spender: string) => ({ to: token as `0x${string}`, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender as `0x${string}`, 0n] }), value: 0n });
