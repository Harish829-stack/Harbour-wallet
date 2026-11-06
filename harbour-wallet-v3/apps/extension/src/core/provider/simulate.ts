// Transaction preview: eth_simulateV1 with traceTransfers (geth/reth/erigon/nethermind RPCs that support it) gives the ERC-20 Transfer
// logs plus synthetic native-ETH transfer logs (from 0xEeee…EEeE). Harbour turns them into the user's net balance changes.
// Unsupported RPCs return null: the review falls back to the decoded call and the eth_estimateGas check.
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const NATIVE_PSEUDO = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export interface AssetChange { token: string; amount: string; direction: 'in' | 'out'; kind: 'native' | 'erc20' | 'nft' }
const topicAddr = (t: string) => `0x${t.slice(-40)}`.toLowerCase();

/** Net per-token change for `owner` from simulation logs (ERC-721 transfers are counted per token id). */
export function assetChangesFrom(logs: any[], owner: string): AssetChange[] {
  const me = owner.toLowerCase(); const net = new Map<string, { amount: bigint; kind: AssetChange['kind'] }>();
  for (const l of Array.isArray(logs) ? logs : []) {
    const t: string[] = l?.topics ?? [];
    if (t[0] !== TRANSFER || t.length < 3) continue;
    const from = topicAddr(t[1]); const to = topicAddr(t[2]); const token = String(l.address ?? '').toLowerCase();
    if (from !== me && to !== me) continue;
    const nft = t.length === 4; // ERC-721: tokenId in topic[3], no data
    const kind: AssetChange['kind'] = token === NATIVE_PSEUDO ? 'native' : nft ? 'nft' : 'erc20';
    let v: bigint; try { v = nft ? 1n : BigInt(l.data && l.data !== '0x' ? l.data : '0x0'); } catch { continue; }
    const key = nft ? `${token}:${BigInt(t[3]).toString()}` : token;
    const cur = net.get(key) ?? { amount: 0n, kind };
    cur.amount += (to === me ? v : 0n) - (from === me ? v : 0n); net.set(key, cur);
  }
  return [...net.entries()].filter(([, v]) => v.amount !== 0n).map(([token, v]) => ({ token, amount: (v.amount < 0n ? -v.amount : v.amount).toString(), direction: v.amount < 0n ? 'out' : 'in', kind: v.kind }));
}
export function simulateParams(tx: { from: string; to?: string; value?: string; data?: string; gas?: string }) {
  return [{ blockStateCalls: [{ calls: [{ from: tx.from, ...(tx.to ? { to: tx.to } : {}), ...(tx.value ? { value: tx.value } : {}), ...(tx.data ? { input: tx.data } : {}), ...(tx.gas ? { gas: tx.gas } : {}) }] }], traceTransfers: true, validation: false }, 'latest'];
}
/** null = the RPC does not support eth_simulateV1 (or it failed); otherwise status + changes. */
export function readSimulation(result: any, owner: string): { ok: boolean; error?: string; changes: AssetChange[] } | null {
  const c = result?.[0]?.calls?.[0]; if (!c) return null;
  return { ok: c.status === '0x1', error: c.status === '0x1' ? undefined : String(c.error?.message ?? 'reverted').slice(0, 200), changes: c.status === '0x1' ? assetChangesFrom(c.logs, owner) : [] };
}
