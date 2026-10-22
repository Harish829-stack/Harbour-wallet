// Low-level EVM helpers for the activity engine: event topics, selectors, ABI decoding and a small failover JSON-RPC client.
// Pure and dependency-free (no browser APIs) so the whole engine is unit-testable under node.
export const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const TOPIC_APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
export const SEL_APPROVE = '0x095ea7b3';
export const SEL_TRANSFER = '0xa9059cbb';
export const SEL_SYMBOL = '0x95d89b41';
export const SEL_DECIMALS = '0x313ce567';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
/** An allowance at or above this is shown as "Unlimited" (wallets approve 2^256-1, or 2^255+ via helper libraries). */
export const UNLIMITED_MIN = 1n << 255n;
/** Human labels for common method selectors (4-byte), used for contract rows when no richer event explains the transaction. */
export const SELECTOR_LABEL: Record<string, string> = {
  '0xa0712d68': 'Mint', '0x40c10f19': 'Mint', '0x1249c58b': 'Mint', '0xd0e30db0': 'Deposit', '0x2e1a7d4d': 'Withdraw', '0xa22cb465': 'Set Approval For All',
  '0x095ea7b3': 'Approve', '0x23b872dd': 'Transfer From', '0x42842e0e': 'Transfer NFT', '0xb88d4fde': 'Transfer NFT', '0x4e71d92d': 'Claim', '0x379607f5': 'Claim', '0x3ccfd60b': 'Withdraw',
};

export interface RawLog { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex: string; removed?: boolean }
export interface Receipt { transactionHash: string; blockNumber: string; status?: string; from: string; to: string | null; gasUsed?: string; effectiveGasPrice?: string; logs: RawLog[] }
export interface TxLite { hash: string; from: string; to: string | null; value: string; input: string; nonce: string; blockNumber?: string | null }
export type Rpc = <T = any>(method: string, params?: unknown[]) => Promise<T>;

export class RpcError extends Error { constructor(message: string, public code?: number) { super(message); this.name = 'RpcError'; } }
/** True when a node rejected an eth_getLogs range as too wide / too many results (the cue to shrink the scan window). */
export const isRangeError = (e: unknown): boolean => e instanceof RpcError && /range|too many|more than|exceed|limit|too (large|wide|big)|10,?000|response size|query returned|max(imum)? (block|results)/i.test(e.message);

export const lc = (s: unknown): string => String(s ?? '').toLowerCase();
export const toHex = (n: number): string => '0x' + n.toString(16);
export const hexToNum = (h: unknown): number => { try { return h ? Number(BigInt(h as string)) : 0; } catch { return 0; } };
export const hexToBig = (h: unknown): bigint => { try { return h && h !== '0x' ? BigInt(h as string) : 0n; } catch { return 0n; } };
export const topicAddress = (a: string): string => '0x' + lc(a).replace(/^0x/, '').padStart(64, '0');
export const addressOfTopic = (t: string): string => '0x' + lc(t).slice(-40);
/** The n-th 32-byte word of ABI calldata (after the 4-byte selector) as an address / bigint. */
const word = (input: string, n: number): string => lc(input).slice(10 + n * 64, 10 + (n + 1) * 64);
export const wordAddress = (input: string, n: number): string => { const w = word(input, n); return w.length === 64 ? '0x' + w.slice(24) : ''; };
export const wordBig = (input: string, n: number): bigint => { const w = word(input, n); return w.length === 64 ? BigInt('0x' + w) : 0n; };

/** Failover JSON-RPC client: tries each URL on network / HTTP / rate-limit failures; a JSON-RPC error object is deterministic and thrown at once. */
export function makeRpc(urls: string[], f: typeof fetch = (...a) => fetch(...a), timeoutMs = 12_000): Rpc {
  let seq = 0;
  return async <T = any>(method: string, params: unknown[] = []): Promise<T> => {
    let last: unknown = new Error('No RPC endpoint available.');
    for (const url of urls) {
      let res: Response;
      try { res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }), signal: AbortSignal.timeout(timeoutMs) }); }
      catch (e) { last = e; continue; }
      if (!res.ok) { last = new Error(`HTTP ${res.status}`); continue; }
      let j: any; try { j = await res.json(); } catch (e) { last = e; continue; }
      if (j?.error) {
        const code = Number(j.error.code); const msg = String(j.error.message ?? 'RPC error');
        if (code === -32005 && /rate|capacity|too many requests/i.test(msg)) { last = new RpcError(msg, code); continue; }
        throw new RpcError(msg, code);
      }
      return j.result as T;
    }
    throw last;
  };
}

/** Runs `fn` over `items` with at most `n` in flight; rejects on the first failure (callers rely on all-or-nothing windows). */
export async function pool<T>(items: readonly T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0; let failed: unknown; let hasFailed = false;
  const worker = async () => { while (!hasFailed && i < items.length) { const x = items[i++]; try { await fn(x); } catch (e) { hasFailed = true; failed = e; } } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  if (hasFailed) throw failed;
}

/** Decodes an ABI `string` return (dynamic) or a legacy `bytes32` symbol; output is restricted to safe printable characters. */
export function decodeAbiString(hex: string): string {
  const h = String(hex ?? '').replace(/^0x/, ''); if (!h) return '';
  let bytes: number[] = [];
  if (h.length === 64) bytes = (h.match(/../g) ?? []).map((b) => parseInt(b, 16)).filter((b) => b > 0);
  else { const off = parseInt(h.slice(0, 64), 16) * 2; const len = parseInt(h.slice(off, off + 64), 16); if (!Number.isFinite(off) || !Number.isFinite(len) || len > 256) return ''; bytes = (h.slice(off + 64, off + 64 + len * 2).match(/../g) ?? []).map((b) => parseInt(b, 16)); }
  const text = new TextDecoder().decode(new Uint8Array(bytes));
  return text.replace(/[^\p{L}\p{N}._$+\- ]/gu, '').trim().slice(0, 16);
}
