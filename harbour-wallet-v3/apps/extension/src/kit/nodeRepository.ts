// Harbour Kit NodeRepository (plan A7): default nodes, then gateway fallback, then user-custom. Health-scored rotation.
export interface NodeEntry { url: string; source: 'default' | 'gateway' | 'custom'; /** Explicit priority tier (lower first); falls back to the source order. Health only reorders within a tier. */ rank?: number }
const ORDER: Record<NodeEntry['source'], number> = { custom: 0, default: 1, gateway: 2 };

export class NodeRepository {
  private health = new Map<string, number>(); // consecutive-failure score, lower is better
  private openUntil = new Map<string, number>(); // circuit breaker: unhealthy nodes are skipped until this time
  static readonly BREAKER_THRESHOLD = 3; static readonly COOLDOWN_MS = 30_000;
  constructor(private nodes: NodeEntry[] = []) {}
  set(nodes: NodeEntry[]) { this.nodes = nodes; }
  report(url: string, ok: boolean, now = Date.now()) {
    const n = ok ? 0 : (this.health.get(url) ?? 0) + 1;
    this.health.set(url, n);
    if (ok) this.openUntil.delete(url);
    else if (n >= NodeRepository.BREAKER_THRESHOLD) this.openUntil.set(url, now + NodeRepository.COOLDOWN_MS);
  }
  /** True while the node's circuit is open (it failed repeatedly and is cooling down). */
  isOpen(url: string, now = Date.now()): boolean { return (this.openUntil.get(url) ?? 0) > now; }
  /** Nodes ordered by user preference, then health, then source order. */
  ordered(): string[] {
    const sorted = [...this.nodes]
      .sort((a, b) => (a.rank ?? ORDER[a.source]) - (b.rank ?? ORDER[b.source]) || (this.health.get(a.url) ?? 0) - (this.health.get(b.url) ?? 0))
      .map((n) => n.url);
    return [...sorted.filter((u) => !this.isOpen(u)), ...sorted.filter((u) => this.isOpen(u))]; // tripped breakers go last, never dropped entirely
  }
  /** Tries each node in order until `fn` succeeds, recording health on the way. */
  async withNode<T>(fn: (url: string) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const url of this.ordered()) {
      try { const r = await fn(url); this.report(url, true); return r; } catch (e) { last = e; this.report(url, false); }
    }
    throw last instanceof Error ? last : new Error('no nodes available');
  }
}
