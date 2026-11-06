// Per-key token bucket (injectable clock). Used per origin: a cheap bucket for read RPC, a tight one for requests that open an approval window.
export interface BucketSpec { capacity: number; refillPerSec: number }
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(private spec: BucketSpec, private now: () => number = Date.now, private maxKeys = 500) {}
  /** Returns true when the call is allowed (and consumes a token). */
  take(key: string): boolean {
    const t = this.now(); let b = this.buckets.get(key);
    if (!b) { if (this.buckets.size >= this.maxKeys) this.buckets.delete(this.buckets.keys().next().value as string); b = { tokens: this.spec.capacity, at: t }; this.buckets.set(key, b); }
    b.tokens = Math.min(this.spec.capacity, b.tokens + ((t - b.at) / 1000) * this.spec.refillPerSec); b.at = t;
    if (b.tokens < 1) return false; b.tokens -= 1; return true;
  }
}
