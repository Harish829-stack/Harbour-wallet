// Harbour Kit HttpClient (plan A7): retry with backoff + jitter, timeout, TTL cache, per-host token bucket, circuit breaker.
export interface HttpOptions {
  retries?: number; timeoutMs?: number; cacheTtlMs?: number; ratePerSec?: number;
  breakerThreshold?: number; breakerCooldownMs?: number;
  headers?: Record<string, string>; method?: string; body?: BodyInit | null;
}
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Breaker = { fails: number; openUntil: number };
type Bucket = { tokens: number; at: number };

export class HttpClient {
  private cache = new Map<string, { exp: number; data: unknown }>();
  private breakers = new Map<string, Breaker>();
  private buckets = new Map<string, Bucket>();
  constructor(private defaults: HttpOptions = {}, private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  private async take(host: string, rate: number): Promise<void> {
    const b = this.buckets.get(host) ?? { tokens: rate, at: Date.now() };
    const now = Date.now();
    b.tokens = Math.min(rate, b.tokens + ((now - b.at) / 1000) * rate); b.at = now;
    this.buckets.set(host, b);
    if (b.tokens >= 1) { b.tokens -= 1; return; }
    const wait = ((1 - b.tokens) / rate) * 1000; b.tokens = 0; b.at = now + wait;
    await sleep(wait);
  }

  async json<T = any>(url: string, opts: HttpOptions = {}): Promise<T> {
    const o = { retries: 2, timeoutMs: 10_000, breakerThreshold: 5, breakerCooldownMs: 30_000, ...this.defaults, ...opts };
    const host = new URL(url).host;
    const cacheKey = o.method && o.method !== 'GET' ? '' : url;
    if (o.cacheTtlMs && cacheKey) {
      const hit = this.cache.get(cacheKey);
      if (hit && hit.exp > Date.now()) return hit.data as T;
    }
    const br = this.breakers.get(host) ?? { fails: 0, openUntil: 0 };
    this.breakers.set(host, br);
    if (br.openUntil > Date.now()) throw new Error(`circuit open: ${host}`);

    let lastErr: unknown;
    for (let i = 0; i <= o.retries; i++) {
      try {
        if (o.ratePerSec) await this.take(host, o.ratePerSec);
        const res = await this.fetchImpl(url, { method: o.method, body: o.body, headers: o.headers, signal: AbortSignal.timeout(o.timeoutMs) });
        if (!res.ok) {
          if (RETRY_STATUS.has(res.status) && i < o.retries) { lastErr = new Error(`HTTP ${res.status}`); await sleep(backoff(i)); continue; }
          throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, final: true });
        }
        const data = (await res.json()) as T;
        br.fails = 0;
        if (o.cacheTtlMs && cacheKey) this.cache.set(cacheKey, { exp: Date.now() + o.cacheTtlMs, data });
        return data;
      } catch (e: any) {
        lastErr = e;
        if (e?.final) break;
        if (i < o.retries) await sleep(backoff(i));
      }
    }
    if (++br.fails >= o.breakerThreshold) br.openUntil = Date.now() + o.breakerCooldownMs;
    throw lastErr instanceof Error ? lastErr : new Error('request failed');
  }
}
const backoff = (attempt: number) => Math.min(4000, 250 * 2 ** attempt) * (0.5 + Math.random() / 2);
export const http = new HttpClient();
