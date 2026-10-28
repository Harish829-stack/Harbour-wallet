// Pure helpers behind the Activity screen: merge per-network history into one feed, order it, and derive the network filter chips.
// Kept free of React / chrome APIs so it is unit-testable.
import type { HistoryItem } from './txHistory';

/** Sort key: a pending transaction with no block time yet is the newest thing that can exist, so it leads the feed. */
const rank = (x: HistoryItem): number => (x.status === 'pending' && !x.timestamp ? Number.MAX_SAFE_INTEGER : x.timestamp || 0);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Newest first; ties resolve by network then hash so the order never reshuffles while results stream in. */
export const compareActivity = (a: HistoryItem, b: HistoryItem): number => rank(b) - rank(a) || cmp(a.assetId, b.assetId) || cmp(a.id, b.id);

/** Flatten per-network lists, drop duplicates (same network + same row id) and sort newest first. */
export function mergeActivity(lists: ReadonlyArray<ReadonlyArray<HistoryItem>>): HistoryItem[] {
  const seen = new Set<string>(); const out: HistoryItem[] = [];
  for (const list of lists) for (const x of list) { const k = `${x.assetId}:${x.id}`; if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out.sort(compareActivity);
}

/** Networks that have at least one row, most recently active first (drives the filter chips). */
export function activityNetworks(items: ReadonlyArray<HistoryItem>): Array<{ assetId: string; count: number }> {
  const m = new Map<string, { count: number; latest: number }>();
  for (const x of items) { const e = m.get(x.assetId) ?? { count: 0, latest: 0 }; e.count++; e.latest = Math.max(e.latest, rank(x)); m.set(x.assetId, e); }
  return [...m.entries()].sort((a, b) => b[1].latest - a[1].latest || cmp(a[0], b[0])).map(([assetId, e]) => ({ assetId, count: e.count }));
}

/** Fetch order: the network the user is looking at, then networks that hold a balance, then the rest (stable). Applied before any cap. */
export function orderChains(ids: ReadonlyArray<string>, preferred: string | null | undefined, funded: ReadonlySet<string>): string[] {
  const w = (id: string) => (id === preferred ? 0 : funded.has(id) ? 1 : 2);
  return ids.map((id, i) => ({ id, i })).sort((a, b) => w(a.id) - w(b.id) || a.i - b.i).map((x) => x.id);
}
