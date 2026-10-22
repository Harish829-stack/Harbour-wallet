// Single choke point for "my own transactions". Every EVM broadcast in the wallet (send, swap, earn, revoke, dApp requests) ends in a
// JSON-RPC `eth_sendRawTransaction` call made with fetch from the service worker. Wrapping fetch once means no feature has to remember
// to record its transaction, and nothing about the request or response is changed.
import { parseTransaction, recoverTransactionAddress } from 'viem';
import type { BroadcastInfo } from './engine';

const RAW_SEND = /"method"\s*:\s*"eth_sendRawTransaction"/;
const HASH = /^0x[0-9a-fA-F]{64}$/;

/** Decodes a signed EVM transaction into what the ledger needs. Returns null for anything unparseable. */
export async function decodeRawTx(raw: string, hash: string, fallbackChainId?: number): Promise<BroadcastInfo | null> {
  try {
    const t: any = parseTransaction(raw as `0x${string}`);
    const from = await recoverTransactionAddress({ serializedTransaction: raw as any });
    const chainId = Number(t.chainId ?? fallbackChainId); if (!Number.isFinite(chainId) || chainId <= 0) return null;
    return { chainId, from, to: t.to ?? null, value: '0x' + BigInt(t.value ?? 0).toString(16), input: String(t.data ?? t.input ?? '0x'), nonce: Number(t.nonce ?? 0), hash };
  } catch { return null; }
}

/** Wraps globalThis.fetch (install AFTER the failover wrapper so the final, successful response is the one observed). */
export function installBroadcastTap(onBroadcast: (info: BroadcastInfo) => Promise<void> | void, resolveChainId?: (url: string) => number | undefined): void {
  const base = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await base(input, init);
    try {
      const body = init?.body; if (typeof body !== 'string' || !RAW_SEND.test(body) || !res.ok) return res;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const calls = ([] as any[]).concat(JSON.parse(body)); const reply = ([] as any[]).concat(await res.clone().json());
      for (const c of calls) {
        if (c?.method !== 'eth_sendRawTransaction' || typeof c.params?.[0] !== 'string') continue;
        const r = reply.find((x) => x?.id === c.id); const hash = r?.result; if (typeof hash !== 'string' || !HASH.test(hash)) continue;
        void decodeRawTx(c.params[0], hash, resolveChainId?.(url)).then((info) => info && onBroadcast(info)).catch(() => { /* recording is best-effort and must never affect the send */ });
      }
    } catch { /* observing must never break the request */ }
    return res;
  }) as typeof fetch;
}
