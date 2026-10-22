// Activity engine: owns the per-(network, address) document that backs the Activity tab.
//   local   - transactions THIS wallet broadcast, recorded the moment the node accepts them (pending) and settled from the receipt
//   items   - typed rows the log scanner derived from chain data (incoming tokens, mints, approvals, swaps, anything on any EVM chain)
//   scan    - the persisted block interval already covered, so history is never rescanned and the backlog grows a little on each open
// All storage and network access is injected (`Deps`), so the engine runs unchanged under node tests and inside the MV3 service worker.
import type { HistoryItem } from '../txHistory';
import { classify, tokensNeeded, type TokenMeta, type ClassifyCtx } from './classify';
import { type Rpc, type Receipt, type TxLite, RpcError, SEL_SYMBOL, SEL_DECIMALS, decodeAbiString, hexToNum, hexToBig, lc, pool } from './evm';
import { scanLogs, newScanState, DEFAULT_SCAN, type ScanState, type ScanOptions } from './scanner';

export interface Store { get<T = any>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void> }
export interface Deps {
  store: Store; now: () => number;
  rpcFor: (chainId: number) => Rpc;
  chainIdOf: (assetId: string) => number | undefined;     // asset (network) id -> EVM chain id
  assetIdOf: (chainId: number) => string | undefined;     // EVM chain id -> asset (network) id
  nativeSymbol: (assetId: string) => string;
  explorerTx: (assetId: string, hash: string) => string | undefined;
  onPending?: (hasPending: boolean) => void;
  scan?: Partial<ScanOptions>;
}
export interface LocalRec { hash: string; nonce: number; from: string; to: string | null; value: string; input: string; createdAt: number; status: 'pending' | 'confirmed' | 'failed'; items: HistoryItem[]; misses?: number }
interface Doc { v: 1; scan?: ScanState; items: HistoryItem[]; local: LocalRec[] }
export interface BroadcastInfo { chainId: number; from: string; to: string | null; value: string; input: string; nonce: number; hash: string }

const REORG_BLOCKS = 12;            // blocks re-scanned on every refresh, so a reorg can never leave a phantom row
const MAX_ITEMS = 400;              // scanner rows kept per network+address
const MAX_LOCAL = 60;               // own transactions kept per network+address
const LOCAL_KEEP_MS = 7 * 86_400_000; // settled local rows are dropped after a week (the scanner/explorer cover them)
const PENDING_MAX_MS = 24 * 3_600_000;
const REFRESH_MIN_MS = 15_000;
const META_MAX = 3000;
const docKey = (assetId: string, address: string) => `activity:v1:${assetId}:${lc(address)}`;
const INDEX_KEY = 'activity:v1:index';
const META_KEY = 'activity:v1:meta';

export function createActivityEngine(deps: Deps) {
  const opts: ScanOptions = { ...DEFAULT_SCAN, ...deps.scan };
  const locks = new Map<string, Promise<unknown>>(); const lastRun = new Map<string, number>();
  const blockTimes = new Map<string, number>();
  let metaDoc: Record<string, { s: string; d: number }> | undefined;

  /** Serializes all work on one document (a broadcast can land while a refresh is mid-flight). */
  const withLock = <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn); locks.set(key, run.catch(() => undefined)); return run;
  };
  const load = async (key: string): Promise<Doc> => { const d = await deps.store.get<Doc>(key); return d && d.v === 1 ? { ...d, items: d.items ?? [], local: d.local ?? [] } : { v: 1, items: [], local: [] }; };

  async function setIndex(key: string, pending: boolean) {
    const idx = (await deps.store.get<{ pending: string[] }>(INDEX_KEY)) ?? { pending: [] }; const has = idx.pending.includes(key);
    if (pending === has) return;
    idx.pending = pending ? [...idx.pending, key] : idx.pending.filter((k) => k !== key);
    await deps.store.set(INDEX_KEY, idx); deps.onPending?.(idx.pending.length > 0);
  }

  // ---- token metadata (symbol / decimals), cached across sessions ----
  async function ensureMeta(rpc: Rpc, assetId: string, tokens: string[]): Promise<void> {
    metaDoc ??= (await deps.store.get(META_KEY)) ?? {}; let dirty = false;
    await pool(tokens.filter((t) => !metaDoc![`${assetId}:${t}`]), 4, async (t) => {
      let s = '', d = 18;
      try { s = decodeAbiString(await rpc<string>('eth_call', [{ to: t, data: SEL_SYMBOL }, 'latest'])); } catch (e) { if (!(e instanceof RpcError)) throw e; }
      try { const h = await rpc<string>('eth_call', [{ to: t, data: SEL_DECIMALS }, 'latest']); const n = Number(hexToBig(h)); if (h && h !== '0x' && Number.isInteger(n) && n >= 0 && n <= 36) d = n; } catch (e) { if (!(e instanceof RpcError)) throw e; }
      metaDoc![`${assetId}:${t}`] = { s, d }; dirty = true; // a reverting contract (not a token) is cached with defaults; transport errors propagate and retry
    });
    if (dirty) { const keys = Object.keys(metaDoc); if (keys.length > META_MAX) for (const k of keys.slice(0, keys.length - META_MAX)) delete metaDoc[k]; await deps.store.set(META_KEY, metaDoc); }
  }
  const metaOf = (assetId: string) => (t: string): TokenMeta => { const m = metaDoc?.[`${assetId}:${lc(t)}`]; return { symbol: m?.s || 'ERC-20', decimals: m?.d ?? 18 }; };
  const ctxFor = (assetId: string, me: string, source: ClassifyCtx['source']): ClassifyCtx => ({ assetId, me, source, nativeSymbol: deps.nativeSymbol(assetId), meta: metaOf(assetId), url: (h) => deps.explorerTx(assetId, h) });

  async function blockTime(rpc: Rpc, blockHex: string): Promise<number> {
    const hit = blockTimes.get(blockHex); if (hit) return hit;
    const b = await rpc<{ timestamp: string } | null>('eth_getBlockByNumber', [blockHex, false]); const ts = b ? hexToNum(b.timestamp) * 1000 : 0;
    if (ts) { if (blockTimes.size > 500) blockTimes.clear(); blockTimes.set(blockHex, ts); }
    return ts;
  }

  /** Classifies one mined transaction (receipt -> typed rows). Returns [] when the node no longer knows it (reorged out). */
  async function classifyMined(rpc: Rpc, assetId: string, me: string, hash: string, source: ClassifyCtx['source'], known?: TxLite | null): Promise<{ items: HistoryItem[]; failed: boolean } | null> {
    const receipt = await rpc<Receipt | null>('eth_getTransactionReceipt', [hash]); if (!receipt) return null;
    const failed = receipt.status === '0x0'; const sender = lc(receipt.from) === me;
    const tx = known ?? (sender ? await rpc<TxLite | null>('eth_getTransactionByHash', [hash]) : null);
    const needed = tokensNeeded(receipt, me); // a failed approve/transfer has no logs: its token is the transaction's `to`
    if (failed && receipt.to && /^0x(095ea7b3|a9059cbb)/.test(lc(tx?.input))) needed.push(lc(receipt.to));
    const [ts] = await Promise.all([blockTime(rpc, receipt.blockNumber), ensureMeta(rpc, assetId, needed)]);
    return { items: classify(ctxFor(assetId, me, source), { hash, receipt, tx, timestamp: ts, status: failed ? 'failed' : 'confirmed' }), failed };
  }

  async function reconcile(doc: Doc, assetId: string, me: string, rpc: Rpc): Promise<boolean> {
    const now = deps.now(); let changed = false;
    for (const rec of [...doc.local]) {
      if (rec.status !== 'pending') { if (now - rec.createdAt > LOCAL_KEEP_MS) { doc.local = doc.local.filter((r) => r !== rec); changed = true; } continue; }
      let mined: Awaited<ReturnType<typeof classifyMined>>;
      try { mined = await classifyMined(rpc, assetId, me, rec.hash, 'local', { hash: rec.hash, from: rec.from, to: rec.to, value: rec.value, input: rec.input, nonce: String(rec.nonce) }); } catch { continue; } // node unreachable: keep pending, retry later
      if (mined) { rec.items = mined.items; rec.status = mined.failed ? 'failed' : 'confirmed'; changed = true; continue; }
      // Not found on the node. Replaced / cancelled (account nonce moved past it) or expired -> drop it; otherwise keep waiting.
      let nonceMoved = false;
      try { nonceMoved = hexToNum(await rpc<string>('eth_getTransactionCount', [rec.from, 'latest'])) > rec.nonce; } catch { /* keep waiting */ }
      rec.misses = (rec.misses ?? 0) + 1;
      if ((nonceMoved && rec.misses >= 2 && now - rec.createdAt > 120_000) || now - rec.createdAt > PENDING_MAX_MS) { doc.local = doc.local.filter((r) => r !== rec); changed = true; } else changed = true;
    }
    return changed;
  }

  async function runScan(doc: Doc, assetId: string, me: string, rpc: Rpc): Promise<void> {
    // Re-scan the last few blocks every time: drop what they produced and let the scanner rebuild it (reorg safety).
    if (doc.scan) { const hi = Math.max(doc.scan.lo - 1, doc.scan.hi - REORG_BLOCKS); doc.items = doc.items.filter((i) => (i.block ?? 0) <= hi); doc.scan = { ...doc.scan, hi }; }
    const st = doc.scan ?? newScanState(hexToNum(await rpc<string>('eth_blockNumber')), opts.startWin);
    doc.scan = st;
    try {
      await scanLogs(rpc, me, st, opts, async (logs) => {
        const hashes = [...new Set(logs.map((l) => l.transactionHash))]; const fresh: HistoryItem[] = [];
        await pool(hashes, 4, async (h) => { const r = await classifyMined(rpc, assetId, me, h, 'logs'); if (r) fresh.push(...r.items); });
        doc.items.push(...fresh);
      });
    } finally { // keep every completed window even when a later one failed
      const seen = new Set<string>(); doc.items = doc.items.filter((i) => { const k = `${i.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
      doc.items.sort((a, b) => b.timestamp - a.timestamp); doc.items.length = Math.min(doc.items.length, MAX_ITEMS);
    }
  }

  return {
    /** Refreshes (rate-limited) and returns the two engine-owned sources for merging with explorer rows. */
    async read(assetId: string, address: string, force = false): Promise<{ local: HistoryItem[]; logs: HistoryItem[]; error?: string }> {
      const chainId = deps.chainIdOf(assetId); const me = lc(address);
      if (chainId == null) return { local: [], logs: [], error: 'Not an EVM network.' };
      const key = docKey(assetId, address);
      return withLock(key, async () => {
        const doc = await load(key); let error: string | undefined;
        const due = force || deps.now() - (lastRun.get(key) ?? 0) >= REFRESH_MIN_MS;
        if (due) {
          const rpc = deps.rpcFor(chainId);
          try { await reconcile(doc, assetId, me, rpc); } catch { /* retried next time */ }
          try { await runScan(doc, assetId, me, rpc); lastRun.set(key, deps.now()); } catch (e) { error = e instanceof Error ? e.message : 'scan failed'; }
          await deps.store.set(key, doc); await setIndex(key, doc.local.some((r) => r.status === 'pending'));
        }
        return { local: doc.local.flatMap((r) => r.items), logs: doc.items, error };
      });
    },
    /** Called once the node has accepted a signed transaction: shows it instantly as pending. */
    async recordBroadcast(b: BroadcastInfo): Promise<void> {
      const assetId = deps.assetIdOf(b.chainId); if (!assetId) return;
      const me = lc(b.from); const key = docKey(assetId, b.from);
      await withLock(key, async () => {
        const doc = await load(key); if (doc.local.some((r) => lc(r.hash) === lc(b.hash))) return;
        const rpc = deps.rpcFor(b.chainId);
        try { if (b.to && /^0x(095ea7b3|a9059cbb)/.test(lc(b.input))) await ensureMeta(rpc, assetId, [lc(b.to)]); } catch { /* symbol falls back to ERC-20 */ }
        const tx: TxLite = { hash: b.hash, from: b.from, to: b.to, value: b.value, input: b.input, nonce: String(b.nonce) };
        const now = deps.now(); const items = classify(ctxFor(assetId, me, 'local'), { hash: b.hash, tx, timestamp: now, status: 'pending' });
        doc.local.unshift({ hash: b.hash, nonce: b.nonce, from: me, to: b.to ? lc(b.to) : null, value: b.value, input: b.input, createdAt: now, status: 'pending', items });
        doc.local.length = Math.min(doc.local.length, MAX_LOCAL);
        await deps.store.set(key, doc); await setIndex(key, true);
      });
    },
    /** Alarm entry point: settle every network+address that still has pending transactions. */
    async reconcilePending(): Promise<void> {
      const idx = (await deps.store.get<{ pending: string[] }>(INDEX_KEY)) ?? { pending: [] };
      for (const key of idx.pending) {
        const [, , assetId, address] = key.split(':'); const chainId = deps.chainIdOf(assetId); if (chainId == null) { await setIndex(key, false); continue; }
        await withLock(key, async () => {
          const doc = await load(key); const changed = await reconcile(doc, assetId, address, deps.rpcFor(chainId)).catch(() => false);
          if (changed) await deps.store.set(key, doc); await setIndex(key, doc.local.some((r) => r.status === 'pending'));
        });
      }
    },
  };
}
export type ActivityEngine = ReturnType<typeof createActivityEngine>;
