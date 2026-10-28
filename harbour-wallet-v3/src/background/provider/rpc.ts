// JSON-RPC proxy to the selected network's public RPCs (Trust Wallet routes this through its own gateway; Harbour uses the registry's public endpoints).
import { ERR, ProviderError } from '../../core/provider/errors';
import { evmNetwork } from './networks';

let nextId = 1;
export type RpcCall = (chainId: number, method: string, params?: unknown[]) => Promise<any>;
export function makeRpc(f: typeof fetch = fetch, timeoutMs = 12_000): RpcCall {
  return async (chainId, method, params = []) => {
    const net = evmNetwork(chainId);
    if (!net || !net.rpcs.length) throw new ProviderError(ERR.CHAIN_DISCONNECTED, 'No RPC endpoint is available for this network.');
    let lastErr: ProviderError | undefined;
    for (const url of net.rpcs) {
      try {
        const res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }), signal: AbortSignal.timeout(timeoutMs), credentials: 'omit' });
        if (!res.ok) { lastErr = new ProviderError(ERR.INTERNAL, `RPC endpoint answered HTTP ${res.status}.`); continue; }
        const j: any = await res.json();
        if (j && j.error) { const code = Number.isInteger(j.error.code) ? j.error.code : ERR.INTERNAL; throw new ProviderError(code === 3 ? -32000 : code, String(j.error.message ?? 'RPC error').slice(0, 300), j.error.data); }
        if (!j || !('result' in j)) { lastErr = new ProviderError(ERR.INTERNAL, 'Malformed RPC response.'); continue; }
        return j.result;
      } catch (e) {
        if (e instanceof ProviderError && e.code !== ERR.INTERNAL) throw e; // a real node-side error (revert, bad params): do not retry elsewhere
        lastErr = e instanceof ProviderError ? e : new ProviderError(ERR.INTERNAL, 'Could not reach the network RPC.');
      }
    }
    throw lastErr ?? new ProviderError(ERR.INTERNAL, 'RPC unavailable.');
  };
}
