// Testnet approval scan: reads ERC-20 allowances ON CHAIN for (token, spender) pairs the wallet knows about. An allowance is keyed
// by token AND spender, so there is no way to ask a node "which spenders did this owner approve"; candidates come from:
//   1. the user's added tokens x the contracts Harbour itself talks to (Aave pool/gateway, Uniswap routers, Permit2),
//   2. protocol token lists (Aave reserves, Uniswap base tokens),
//   3. the local approval ledger (every approve signed by this wallet: Swap, Earn, connected sites).
// Every pair is read in batched Multicall3 calls (about 100 per RPC request) and nothing is shown unless the chain says the
// allowance is above zero. Approvals to unknown spenders for tokens that were never added or signed here are NOT found
// (that needs event-log discovery, a deferred "Deep scan", see docs/reference/approval-scan.md).
import { decodeFunctionResult, encodeFunctionData, erc20Abi, formatUnits } from 'viem';
import type { Fetcher } from './chains/adapters/types';
import { multicall } from './staking/evm';
import type { Approval } from './approvals';

const MAX = (1n << 256n) - 1n;
export const MAX_SCAN_PAIRS = 800;
export const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
export type Hex = `0x${string}`;

export interface ScanToken { address: string; symbol?: string; name?: string; decimals?: number }
export interface ScanSpender { address: string; name: string }
export interface LedgerPair { token: string; spender: string; label?: string; at?: number }
export interface ScanInput { owner: string; chainId: string; rpcUrls: string[]; tokens: ScanToken[]; spenders: ScanSpender[]; ledger: LedgerPair[]; fetcher?: Fetcher }
export interface Coverage { chainId: string; tokens: number; spenders: number; pairs: number; ledger: number; unreadable: number; truncated: boolean }
export interface ScanResult { items: Approval[]; coverage: Coverage; /** Ledger pairs whose live allowance is zero (safe to forget). */ settled: LedgerPair[] }

/** Which networks a scan request covers. No request = every supported network; a request that names only unsupported ones is refused. */
export function pickScanChains(supported: Record<string, number>, requested?: unknown): { ids: string[] } | { error: string; code: 'unsupported_network' } {
  const all = Object.keys(supported);
  if (requested === undefined || requested === null) return { ids: all };
  const ids = (Array.isArray(requested) ? requested : [requested]).filter((c): c is string => typeof c === 'string' && c in supported);
  return ids.length ? { ids: [...new Set(ids)] } : { error: "Approval scanning isn't available on this network.", code: 'unsupported_network' };
}

const lc = (a: string) => a.toLowerCase();
const isAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const key = (t: string, s: string) => `${lc(t)}:${lc(s)}`;

export async function scanOnChain(inp: ScanInput): Promise<ScanResult> {
  const f: Fetcher = inp.fetcher ?? fetch; const owner = inp.owner as Hex;
  const tokens = new Map<string, ScanToken>(); const spenders = new Map<string, ScanSpender>();
  for (const t of inp.tokens) if (isAddr(t.address)) tokens.set(lc(t.address), t);
  for (const s of inp.spenders) if (isAddr(s.address)) spenders.set(lc(s.address), s);
  const ledger = new Map<string, LedgerPair>(); for (const l of inp.ledger) if (isAddr(l.token) && isAddr(l.spender)) ledger.set(key(l.token, l.spender), l);

  // Candidate pairs: added/protocol tokens x known spenders, plus every ledger pair (its token need not be in the list).
  const pairs = new Map<string, { token: string; spender: string }>();
  for (const l of ledger.values()) pairs.set(key(l.token, l.spender), { token: lc(l.token), spender: lc(l.spender) });
  for (const t of tokens.keys()) for (const s of spenders.keys()) pairs.set(`${t}:${s}`, { token: t, spender: s });
  const list = [...pairs.values()]; const truncated = list.length > MAX_SCAN_PAIRS; const used = list.slice(0, MAX_SCAN_PAIRS);

  const reads = await multicall(f, inp.rpcUrls, used.map((p) => ({ to: p.token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'allowance', args: [owner, p.spender as Hex] }) })));
  const hits: Array<{ token: string; spender: string; value: bigint }> = []; let unreadable = 0; const settled: LedgerPair[] = [];
  used.forEach((p, i) => {
    const raw = reads[i]; if (!raw) { unreadable++; return; }
    let v: bigint; try { v = decodeFunctionResult({ abi: erc20Abi, functionName: 'allowance', data: raw }) as bigint; } catch { unreadable++; return; }
    if (v > 0n) hits.push({ ...p, value: v }); else { const l = ledger.get(key(p.token, p.spender)); if (l) settled.push(l); }
  });

  // Name, symbol and decimals only for the tokens that actually have an allowance and are not already known.
  const need = [...new Set(hits.map((h) => h.token))].filter((t) => { const k = tokens.get(t); return !(k?.symbol && k.decimals != null); });
  const meta = new Map<string, { symbol: string; name: string; decimals: number }>();
  if (need.length) {
    const calls = need.flatMap((t) => (['symbol', 'name', 'decimals'] as const).map((fn) => ({ to: t, data: encodeFunctionData({ abi: erc20Abi, functionName: fn }) })));
    const res = await multicall(f, inp.rpcUrls, calls).catch(() => calls.map(() => null));
    need.forEach((t, i) => {
      const dec = (fn: 'symbol' | 'name' | 'decimals', raw: Hex | null) => { if (!raw) return undefined; try { return decodeFunctionResult({ abi: erc20Abi, functionName: fn, data: raw }); } catch { return undefined; } };
      const symbol = dec('symbol', res[i * 3]); const name = dec('name', res[i * 3 + 1]); const decimals = dec('decimals', res[i * 3 + 2]);
      meta.set(t, { symbol: typeof symbol === 'string' ? symbol.slice(0, 16) : '', name: typeof name === 'string' ? name.slice(0, 60) : '', decimals: typeof decimals === 'number' && decimals >= 0 && decimals <= 32 ? decimals : 18 });
    });
  }

  const items: Approval[] = hits.map((h) => {
    const t = tokens.get(h.token); const m = meta.get(h.token);
    const decimals = t?.decimals ?? m?.decimals ?? 18; const unlimited = h.value >= MAX / 2n;
    const l = ledger.get(key(h.token, h.spender));
    return { chainId: inp.chainId, token: h.token, symbol: t?.symbol ?? m?.symbol ?? '', name: t?.name ?? m?.name ?? '', decimals, spender: h.spender,
      spenderName: spenders.get(h.spender)?.name ?? l?.label, allowance: h.value.toString(), formatted: unlimited ? 'Unlimited' : formatUnits(h.value, decimals), unlimited, risky: false, riskNotes: [], approvedAt: l?.at };
  }).sort((x, y) => Number(y.unlimited) - Number(x.unlimited) || (y.approvedAt ?? 0) - (x.approvedAt ?? 0));

  return { items, settled, coverage: { chainId: inp.chainId, tokens: tokens.size, spenders: spenders.size, pairs: used.length, ledger: ledger.size, unreadable, truncated } };
}

/** What a scan actually checked, in words, so an empty list is never read as "you have none". */
export function coverageSummary(d: { coverage?: Coverage[]; supported?: string[] }, nameOf: (chainId: string) => string): string {
  const cov = d.coverage ?? []; if (!cov.length) return `Scanned ${(d.supported ?? []).map(nameOf).join(' and ')}.`;
  const unread = cov.reduce((n, x) => n + x.unreadable, 0); const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return cov.map((x) => `${nameOf(x.chainId)}: ${pl(x.tokens, 'token')} checked against ${pl(x.spenders, 'known contract')}${x.ledger ? `, plus ${pl(x.ledger, 'approval')} made from this wallet` : ''}.`).join(' ')
    + (unread ? ` ${unread} could not be read.` : '') + ' Approvals to other contracts for tokens you have not added are not listed yet.';
}

/** Current on-chain allowance (null when unreadable). Used to re-check right before a revoke. */
export async function readAllowance(rpcUrls: string[], token: string, owner: string, spender: string, f: Fetcher = fetch): Promise<bigint | null> {
  const [raw] = await multicall(f, rpcUrls, [{ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'allowance', args: [owner as Hex, spender as Hex] }) }]);
  if (!raw) return null; try { return decodeFunctionResult({ abi: erc20Abi, functionName: 'allowance', data: raw }) as bigint; } catch { return null; }
}
