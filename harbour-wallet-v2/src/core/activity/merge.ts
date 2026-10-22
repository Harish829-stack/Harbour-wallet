// Combines the three activity sources for one network into a single de-duplicated feed.
// Priority (highest first): local ledger (my own broadcasts, instant) > log scanner (typed, chain-agnostic) > explorer (native transfers, labels).
import type { HistoryItem } from '../txHistory';
import { lc } from './evm';

const TYPED = new Set(['approve', 'revoke', 'swap']);
export const hashOf = (x: HistoryItem): string => lc(x.hash ?? x.id.split(':')[0]);
/** Identity of a row across sources: same transaction, same asset, same direction, same amount. */
const keyOf = (x: HistoryItem): string => `${hashOf(x)}|${lc(x.token?.address) || 'native'}|${x.kind}|${x.amount}`;
const rank = (s: HistoryItem['status']) => (s === 'pending' ? 0 : 1);

export function mergeSources(local: readonly HistoryItem[], logs: readonly HistoryItem[], explorer: readonly HistoryItem[]): HistoryItem[] {
  // A transaction already explained as approve / revoke / swap by a higher-priority source hides every lower-priority row of that transaction
  // (the explorer would otherwise add a bare "contract call" and the raw token legs next to the typed row).
  const typed = new Set<string>(); const out: HistoryItem[] = []; const byKey = new Map<string, HistoryItem>();
  for (const [src, list] of ([['local', local], ['logs', logs], ['explorer', explorer]] as const)) {
    const hereTyped = new Set<string>();
    for (const x of list) {
      const h = hashOf(x); if (typed.has(h)) continue;
      // Zero-value inbound token transfers are address-poisoning noise, whichever source reports them.
      if (x.kind === 'receive' && x.token && Number(x.amount) === 0) continue;
      const k = keyOf(x); const prev = byKey.get(k);
      if (prev) { // same row from a lower-priority source: keep the higher-priority row, adopt a settled status and any extra detail
        if (rank(prev.status) < rank(x.status)) { prev.status = x.status; if (x.timestamp) prev.timestamp = x.timestamp; }
        prev.usd ??= x.usd; prev.counterparty ??= x.counterparty; prev.url ??= x.url;
        continue;
      }
      const row = { ...x, source: x.source ?? (src === 'explorer' ? 'explorer' : src) } as HistoryItem;
      byKey.set(k, row); out.push(row); if (TYPED.has(x.kind)) hereTyped.add(h);
    }
    for (const h of hereTyped) typed.add(h);
  }
  return out;
}
