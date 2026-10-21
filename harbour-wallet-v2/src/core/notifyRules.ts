// Pure notification rules (unit-tested; no extension APIs).
import type { HistoryItem } from './txHistory';

/** New confirmed incoming items since the last look; the first look only records what is there (no flood on enable). */
export function newIncoming(items: HistoryItem[], seen: string[] | undefined): { fresh: HistoryItem[]; seen: string[] } {
  const ids = items.map((i) => i.id);
  if (!seen) return { fresh: [], seen: ids.slice(0, 50) };
  const known = new Set(seen);
  const fresh = items.filter((i) => !known.has(i.id) && i.kind === 'receive' && i.status === 'confirmed');
  return { fresh, seen: [...ids, ...seen].filter((x, i, all) => all.indexOf(x) === i).slice(0, 80) };
}
