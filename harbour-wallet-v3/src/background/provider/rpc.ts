// JSON-RPC proxy for a dApp's read-only calls on the selected network. Harbour networks go through the Harbour API (signed with
// the device key); only when that cannot answer (rate limit, outage) does a read fall back to the registry's public endpoints.
// Identical reads are cached for a few seconds and shared while in flight: a dApp's first page load repeats the same
// eth_chainId / eth_blockNumber / multicall dozens of times, and the wallet's own balances and sends share the same API quota.
import { ERR, ProviderError } from '../../core/provider/errors';
import { evmNetwork } from './networks';

let nextId = 1;
export type RpcCall = (chainId: number, method: string, params?: unknown[]) => Promise<any>;

const isBlockTag = (v: unknown) => typeof v === 'string' && /^(latest|pending|safe|finalized|earliest)$/.test(v);
const isHexNumber = (v: unknown) => typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v) && v.length <= 18;
/** Seconds a result may be reused (0 = never). Answers that name a past block never change, the rest only live for a block or so. */
export function cacheTtlSeconds(method: string, params: unknown[]): number {
  const last = params[params.length - 1];
  switch (method) {
    case 'eth_chainId': case 'net_version': return 300;
    case 'eth_blockNumber': return 2;
    case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': case 'eth_feeHistory': return 5;
    case 'eth_getBalance': case 'eth_call': case 'eth_getCode': case 'eth_getStorageAt': case 'eth_estimateGas':
      if (last === 'pending') return 0;
      return isHexNumber(last) || (params.length && typeof last === 'object' && last && ('blockHash' in (last as any))) ? 120 : 3;
    case 'eth_getTransactionCount': return isHexNumber(last) ? 120 : last === 'pending' ? 0 : 2;
    case 'eth_getBlockByNumber': return isHexNumber(params[0]) ? 120 : isBlockTag(params[0]) ? 2 : 0;
    case 'eth_getBlockByHash': case 'eth_getTransactionByHash': return 30;
    case 'eth_getTransactionReceipt': return 2;
    case 'eth_getLogs': { const f: any = params[0]; return f && (f.blockHash || (isHexNumber(f.fromBlock) && isHexNumber(f.toBlock))) ? 120 : 3; }
    default: return 0;
  }
}

interface Entry { exp: number; value: any }
const MAX_ENTRIES = 400;

function once(f: typeof fetch, urls: string[], method: string, params: unknown[], timeoutMs: number): Promise<{ ok: true; result: any } | { ok: false; err: ProviderError; retry: boolean }[]> {
  return (async () => {
    const errs: { ok: false; err: ProviderError; retry: boolean }[] = [];
    for (const url of urls) {
      try {
        const res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }), signal: AbortSignal.timeout(timeoutMs), credentials: 'omit' });
        if (!res.ok) { errs.push({ ok: false, err: new ProviderError(ERR.INTERNAL, `RPC endpoint answered HTTP ${res.status}.`), retry: true }); continue; }
        const j: any = await res.json();
        if (j && j.error) {
          const code = Number.isInteger(j.error.code) ? j.error.code : ERR.INTERNAL;
          const e = new ProviderError(code === 3 ? -32000 : code, String(j.error.message ?? 'RPC error').slice(0, 300), j.error.data);
          // The Harbour API could not reach any node (marked by fetchHook.ts): another endpoint may still answer. A node's own error (revert, bad params) is final.
          if (j.error.data?.harbour === 'upstream') { errs.push({ ok: false, err: e, retry: true }); continue; }
          throw e;
        }
        if (!j || !('result' in j)) { errs.push({ ok: false, err: new ProviderError(ERR.INTERNAL, 'Malformed RPC response.'), retry: true }); continue; }
        return { ok: true, result: j.result } as any;
      } catch (e) {
        if (e instanceof ProviderError && e.code !== ERR.INTERNAL) throw e;
        errs.push({ ok: false, err: e instanceof ProviderError ? e : new ProviderError(ERR.INTERNAL, 'Could not reach the network RPC.'), retry: true });
      }
    }
    return errs as any;
  })();
}

export function makeRpc(f: typeof fetch = fetch, timeoutMs = 12_000, now: () => number = Date.now): RpcCall {
  const cache = new Map<string, Entry>(); const inflight = new Map<string, Promise<any>>();
  const run = async (chainId: number, method: string, params: unknown[]): Promise<any> => {
    const net = evmNetwork(chainId);
    if (!net || !net.rpcs.length) throw new ProviderError(ERR.CHAIN_DISCONNECTED, 'No RPC endpoint is available for this network.');
    let r: any = await once(f, net.rpcs, method, params, timeoutMs);
    if (r && r.ok) return r.result;
    let last: ProviderError | undefined = (r as any[]).at(-1)?.err;
    const extra = (net.fallbackRpcs ?? []).filter((u) => !net.rpcs.includes(u));
    if (extra.length) {
      r = await once(f, extra, method, params, timeoutMs);
      if (r && r.ok) return r.result;
      last = (r as any[]).at(-1)?.err ?? last;
    }
    throw last ?? new ProviderError(ERR.INTERNAL, 'RPC unavailable.');
  };
  return async (chainId, method, params = []) => {
    const ttl = cacheTtlSeconds(method, params);
    if (!ttl) return run(chainId, method, params);
    const key = `${chainId}|${method}|${JSON.stringify(params)}`;
    const hit = cache.get(key); if (hit && hit.exp > now()) return hit.value;
    const pending = inflight.get(key); if (pending) return pending;
    const p = run(chainId, method, params).then((value) => {
      // an empty receipt only means "not mined yet": do not keep it
      if (!(method === 'eth_getTransactionReceipt' && value == null)) {
        if (cache.size >= MAX_ENTRIES) { const first = cache.keys().next().value; if (first !== undefined) cache.delete(first); }
        cache.set(key, { exp: now() + ttl * 1000, value });
      }
      return value;
    }).finally(() => { inflight.delete(key); });
    inflight.set(key, p);
    return p;
  };
}
