// Makes the Harbour API look like an ordinary JSON-RPC endpoint to the rest of the wallet. rpc.ts hands out
// `${HB_API_URL}/v1/rpc/<chain>` for Harbour networks; this wrapper signs those requests with the device key and turns
// `eth_sendRawTransaction` into POST /v1/tx/<chain>/broadcast (sender checks, tracking, idempotency, friendly errors).
// viem clients, the activity engine, gas quotes and dApp calls therefore all use the backend without changes.
import { HB_API_URL, evmIdOfBackend } from './config';
import { signedRequest, broadcastTx, setRawFetch, HarbourApiError } from './client';
import { keccak256 } from 'viem';

const PREFIX = `${HB_API_URL}/v1/rpc/`;
let onBroadcast: ((chain: string, hash: string) => void) | null = null;
/** Called after the API accepted a broadcast (the service worker refreshes its realtime subscriptions). */
export const setBroadcastListener = (f: (chain: string, hash: string) => void): void => { onBroadcast = f; };
/** Same upstream for a send flow (nonce -> estimate -> broadcast): one session id per chain per minute. */
export const sessionFor = (chain: string): string => `${chain}-${Math.floor(Date.now() / 60_000)}`;
const rpcReply = (id: unknown, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, ...body }), { status, headers: { 'Content-Type': 'application/json' } });

export async function harbourRpc(chain: string, body: string, signal?: AbortSignal): Promise<Response> {
  let parsed: any; try { parsed = JSON.parse(body); } catch { parsed = null; }
  if (parsed && !Array.isArray(parsed) && parsed.method === 'eth_sendRawTransaction' && typeof parsed.params?.[0] === 'string') {
    try {
      const r = await broadcastTx(chain, parsed.params[0], sessionFor(chain));
      // The hash of a signed transaction is keccak256 of its bytes: never accept a different one from the server.
      const own = keccak256(parsed.params[0] as `0x${string}`);
      if (String(r.tx_hash).toLowerCase() !== own.toLowerCase()) throw new HarbourApiError(0, 'bad_hash', 'Harbour could not confirm this transaction. Check your activity before trying again.', false);
      try { onBroadcast?.(chain, r.tx_hash); } catch { /* listeners never affect the send */ }
      return rpcReply(parsed.id, { result: r.tx_hash });
    } catch (e) {
      // JSON-RPC error with the API's plain-language message (viem surfaces `message` / `shortMessage`).
      const code = e instanceof HarbourApiError ? e.code : 'network_busy';
      const message = e instanceof Error ? e.message : 'Network busy, please try again.';
      return rpcReply(parsed.id, { error: { code: -32000, message, data: { harbour: code } } });
    }
  }
  try {
    const res = await signedRequest('POST', `/v1/rpc/${chain}`, body, { 'X-HB-Session': sessionFor(chain) }, signal);
    if (res.ok || res.status === 429) return res; // 429 already carries a JSON-RPC error body
    const b = await res.json().catch(() => ({}));
    return rpcReply(parsed?.id, { error: { code: -32000, message: b?.error?.message ?? 'Network busy, please try again.' } });
  } catch (e: any) {
    if (signal?.aborted) throw e;
    return rpcReply(parsed?.id, { error: { code: -32000, message: e instanceof HarbourApiError ? e.message : 'Network busy, please try again.' } });
  }
}

/** Wraps fetch so requests to the Harbour RPC proxy are signed. Everything else passes through untouched. */
export function makeHarbourFetch(base: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(PREFIX)) return base(input, init);
    const chain = url.slice(PREFIX.length).split(/[/?#]/)[0];
    if (!evmIdOfBackend(chain) || (init?.method ?? 'GET').toUpperCase() !== 'POST' || typeof init?.body !== 'string') return base(input, init);
    return harbourRpc(chain, init.body, init.signal ?? undefined);
  }) as typeof fetch;
}

let installed = false;
/** Call first thing in the service worker, before any other fetch wrapper. */
export function installHarbourFetch(): void {
  if (installed) return; installed = true;
  const base = globalThis.fetch.bind(globalThis);
  setRawFetch(base);
  globalThis.fetch = makeHarbourFetch(base);
}
