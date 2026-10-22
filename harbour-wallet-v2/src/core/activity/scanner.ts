// Chain-agnostic EVM log scanner. Finds every ERC-20/721 Transfer into or out of an address and every Approval it granted, using only
// eth_getLogs on the chain's own RPC, so it works on any EVM chain (testnets, custom networks) with no explorer or API key.
//   * The scanned block interval [lo, hi] is persisted and only ever grows contiguously: forward to the head, backward into history.
//   * Window size adapts to the node (halves when it rejects a range, doubles after a streak of successes).
//   * A window only counts as scanned after `onWindow` resolved, so a failed receipt fetch can never leave a silent gap.
import { type Rpc, type RawLog, RpcError, isRangeError, toHex, hexToNum, topicAddress, TOPIC_TRANSFER, TOPIC_APPROVAL } from './evm';

export interface ScanState { lo: number; hi: number; win: number; backfilled: number }
export interface ScanOptions { forwardWindows: number; backfillWindows: number; maxBackfillWindows: number; minWin: number; maxWin: number; startWin: number }
export const DEFAULT_SCAN: ScanOptions = { forwardWindows: 6, backfillWindows: 4, maxBackfillWindows: 60, minWin: 128, maxWin: 100_000, startWin: 10_000 };
/** An empty interval sitting just above the head: the first refresh scans backward from the head. */
export const newScanState = (head: number, win = DEFAULT_SCAN.startWin): ScanState => ({ lo: head + 1, hi: head, win, backfilled: 0 });

async function logsInRange(rpc: Rpc, me: string, from: number, to: number): Promise<RawLog[]> {
  const range = { fromBlock: toHex(from), toBlock: toHex(to) }; const topic = topicAddress(me);
  const [incoming, outgoing, approvals] = await Promise.all([
    rpc<RawLog[]>('eth_getLogs', [{ ...range, topics: [TOPIC_TRANSFER, null, topic] }]),
    rpc<RawLog[]>('eth_getLogs', [{ ...range, topics: [TOPIC_TRANSFER, topic] }]),
    rpc<RawLog[]>('eth_getLogs', [{ ...range, topics: [TOPIC_APPROVAL, topic] }]),
  ]);
  const seen = new Set<string>(); const out: RawLog[] = [];
  for (const l of [...incoming, ...outgoing, ...approvals]) { const k = `${l.transactionHash}:${l.logIndex}`; if (!seen.has(k) && !l.removed) { seen.add(k); out.push(l); } }
  return out;
}

/** Scans forward then backward, mutating `st` in place after each window completes. On error `st` still reflects every completed window. */
export async function scanLogs(rpc: Rpc, me: string, st: ScanState, opts: ScanOptions, onWindow: (logs: RawLog[], from: number, to: number) => Promise<void>): Promise<{ head: number; complete: boolean }> {
  const head = hexToNum(await rpc<string>('eth_blockNumber'));
  if (!Number.isFinite(head) || head <= 0) throw new RpcError('Bad block number from node.');
  let streak = 0;
  const step = async (dir: 'fwd' | 'back'): Promise<void> => {
    for (let shrinks = 0; ; ) {
      const from = dir === 'fwd' ? st.hi + 1 : Math.max(0, st.lo - st.win);
      const to = dir === 'fwd' ? Math.min(head, st.hi + st.win) : st.lo - 1;
      let logs: RawLog[];
      try { logs = await logsInRange(rpc, me, from, to); }
      catch (e) {
        if (isRangeError(e) && st.win > opts.minWin && shrinks++ < 12) { st.win = Math.max(opts.minWin, st.win >> 1); streak = 0; continue; }
        throw e;
      }
      await onWindow(logs, from, to);
      if (dir === 'fwd') st.hi = to; else { st.lo = from; st.backfilled++; }
      if (++streak >= 3 && st.win < opts.maxWin) { st.win = Math.min(opts.maxWin, st.win * 2); streak = 0; }
      return;
    }
  };
  for (let n = 0; st.hi < head && n < opts.forwardWindows; n++) await step('fwd');
  for (let n = 0; st.lo > 0 && st.backfilled < opts.maxBackfillWindows && n < opts.backfillWindows; n++) await step('back');
  return { head, complete: st.hi >= head && (st.lo === 0 || st.backfilled >= opts.maxBackfillWindows) };
}
