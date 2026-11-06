// Broadcast for testnet Swap / Earn transactions. On Harbour-indexed networks the signed transaction goes through the Harbour
// API (the same `/v1/rpc/<chain>` URL plain sends use; the service worker's fetch hook turns eth_sendRawTransaction into
// POST /v1/tx/<chain>/broadcast). The backend then tracks it as pending, settles it, and refreshes balances and history at once,
// like every other send. Reads stay on public RPC (see client.ts). Only when the Harbour API cannot be reached does the
// transaction go to the public endpoint instead, so a backend outage never blocks a swap.
import { keccak256 } from 'viem';

export interface BroadcastDeps {
  fetch: typeof fetch;
  /** `${HB_API_URL}/v1/rpc/${backendChain}`, or undefined for networks Harbour does not index. */
  harbourRpcUrl?: string;
  /** Public-RPC fallback (viem's sendRawTransaction). */
  sendPublic: (raw: `0x${string}`) => Promise<`0x${string}`>;
}

// Error codes the fetch hook uses when the API itself was unreachable (not a refusal of the transaction).
const UNREACHABLE = new Set(['network_busy', 'upstream']);

export async function broadcastSigned(raw: `0x${string}`, deps: BroadcastDeps): Promise<`0x${string}`> {
  const own = keccak256(raw);
  if (deps.harbourRpcUrl) {
    let reply: any = null;
    try {
      const res = await deps.fetch(deps.harbourRpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [raw] }) });
      reply = await res.json();
    } catch { reply = null; }
    if (typeof reply?.result === 'string') {
      if (reply.result.toLowerCase() !== own.toLowerCase()) throw new Error('Harbour could not confirm this transaction. Check your activity before trying again.');
      return own;
    }
    // A refusal (funds, nonce, sender checks...) is final and shown as is; only an unreachable API falls through.
    if (reply?.error && !UNREACHABLE.has(String(reply.error?.data?.harbour ?? ''))) throw new Error(String(reply.error.message || 'The network rejected this transaction.'));
  }
  try { return await deps.sendPublic(raw); } catch (e) {
    // The API may have broadcast it before the connection dropped: the node already has the same transaction.
    if (/already known/i.test(e instanceof Error ? e.message : String(e))) return own;
    throw e;
  }
}
