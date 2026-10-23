// Transparent RPC failover for the background service worker. Any JSON-RPC POST whose URL belongs to a known endpoint pool
// (an EVM chain's RPC list, or the Solana list) is retried on the next healthy endpoint of the same pool when it fails,
// times out, or is rate limited (429). Per-endpoint circuit breakers skip unhealthy nodes for a cooldown; whole rounds are
// retried with exponential backoff. Only the original request body is forwarded (a signed tx or a read call). Keys and seed
// phrases never pass through here, and failures are recorded by host name only.
import { NodeRepository } from './nodeRepository';
import { recordNet } from './netStatus';
import { logWarn } from '../core/logger';
import { evmChains } from '../core/chains/index';
import { getRpcUrls } from '../core/chains/rpcUrls';
import { solanaRpcUrls } from '../core/rpc';

const ATTEMPT_TIMEOUT_MS = 10_000;
const ROUNDS = 2;
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const SEND_METHOD = /"method"\s*:\s*"(eth_sendRawTransaction|eth_sendTransaction|sendTransaction|sendBoc|sendBocReturnHash)"/;

const norm = (u: string) => { try { const x = new URL(u); return `${x.origin}${x.pathname.replace(/\/$/, '')}`; } catch { return u; } };
const hostOf = (u: string) => { try { return new URL(u).host; } catch { return 'unknown'; } };

type Pools = { byUrl: Map<string, string>; urls: Map<string, string[]> };
let pools: Pools | null = null; let builtAt = 0;
function buildPools(now = Date.now()): Pools {
  if (pools && now - builtAt < 30_000) return pools;
  const byUrl = new Map<string, string>(); const urls = new Map<string, string[]>();
  const add = (key: string, list: string[]) => { if (list.length < 2) return; urls.set(key, list); for (const u of list) if (!byUrl.has(norm(u))) byUrl.set(norm(u), key); };
  for (const c of evmChains()) add(`evm:${c.evmChainId}`, getRpcUrls(c));
  add('solana', solanaRpcUrls());
  pools = { byUrl, urls }; builtAt = now;
  return pools;
}

const repos = new Map<string, NodeRepository>();
const repoFor = (key: string, list: string[]): NodeRepository => {
  let r = repos.get(key); if (!r) { r = new NodeRepository(); repos.set(key, r); }
  r.set(list.map((url, rank) => ({ url, source: 'default' as const, rank })));
  return r;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (round: number) => Math.min(2000, 300 * 2 ** round) * (0.5 + Math.random() / 2);

function withTimeout(parent: AbortSignal | null | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(new DOMException('timeout', 'TimeoutError')), ms);
  const onAbort = () => c.abort(parent!.reason);
  if (parent) { if (parent.aborted) c.abort(parent.reason); else parent.addEventListener('abort', onAbort, { once: true }); }
  return { signal: c.signal, done: () => { clearTimeout(t); parent?.removeEventListener('abort', onAbort); } };
}

/** Wraps a fetch implementation with pool-aware failover. Non-RPC and non-POST requests pass through untouched. */
export function makeFailoverFetch(base: typeof fetch): typeof fetch {
  return async function failoverFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    if (method !== 'POST' || typeof init?.body !== 'string') return base(input, init);
    const { byUrl, urls } = buildPools();
    const key = byUrl.get(norm(url));
    if (!key) return base(input, init);

    const repo = repoFor(key, urls.get(key)!);
    const isSend = SEND_METHOD.test(init.body);
    let lastRes: Response | undefined; let lastErr: unknown;
    for (let round = 0; round < ROUNDS; round++) {
      // The requested endpoint goes first unless its circuit is open; then the rest by health.
      const ordered = repo.ordered();
      const first = ordered.find((u) => norm(u) === norm(url));
      const order = first && !repo.isOpen(first) ? [first, ...ordered.filter((u) => u !== first)] : ordered;
      for (const u of order) {
        if (init.signal?.aborted) throw init.signal.reason ?? new DOMException('aborted', 'AbortError');
        const t = withTimeout(init.signal, ATTEMPT_TIMEOUT_MS);
        try {
          const res = await base(u, { ...init, signal: t.signal });
          if (RETRY_STATUS.has(res.status)) { repo.report(u, false); recordNet('rpc', false, hostOf(u)); lastRes = res; continue; }
          repo.report(u, true); recordNet('rpc', true, hostOf(u));
          return res;
        } catch (e: any) {
          if (init.signal?.aborted) throw e; // the caller gave up; do not keep trying
          repo.report(u, false); recordNet('rpc', false, hostOf(u)); lastErr = e;
          // A timed-out broadcast may still have been accepted: never resend it elsewhere.
          if (isSend && e?.name === 'TimeoutError') throw e;
        } finally { t.done(); }
      }
      if (round < ROUNDS - 1) await sleep(backoff(round));
    }
    logWarn(`rpc pool ${key} exhausted`);
    if (lastRes) return lastRes;
    throw lastErr instanceof Error ? lastErr : new Error('all RPC endpoints failed');
  } as typeof fetch;
}

let installed = false;
/** Call once at service-worker start. */
export function installFailoverFetch(): void {
  if (installed) return; installed = true;
  globalThis.fetch = makeFailoverFetch(globalThis.fetch.bind(globalThis));
}
