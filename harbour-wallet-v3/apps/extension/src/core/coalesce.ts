// Request coalescing: callers asking for the same key while a request is running, or within `reuseMs` after it finished, share
// one result. Failures are never reused. Used where several UI triggers fire together (popup open = focus + visibilitychange +
// the first load + a realtime tick, which repeated every balance source two to four times in the 2026-11-19 capture).
export function coalescer<T>(reuseMs: number, now: () => number = Date.now) {
  const memo = new Map<string, { at: number; p: Promise<T>; done: boolean }>();
  return (key: string, run: () => Promise<T>): Promise<T> => {
    const hit = memo.get(key);
    if (hit && (!hit.done || now() - hit.at < reuseMs)) return hit.p;
    const entry = { at: now(), p: run(), done: false };
    memo.set(key, entry);
    entry.p.then(() => { entry.done = true; entry.at = now(); }, () => { if (memo.get(key) === entry) memo.delete(key); });
    for (const [k, v] of memo) if (v.done && now() - v.at >= reuseMs) memo.delete(k); // keep the map small
    return entry.p;
  };
}
