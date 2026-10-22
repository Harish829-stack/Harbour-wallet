// Transaction-history adapters for the non-EVM families (EVM / Esplora live in core/txHistory.ts). Each adapter turns one public explorer / node API
// into normalized HistoryItem rows (direction = kind send|receive|self|contract, amount in human units, token, counterparty, status, hash, timestamp).
// TW's own source (gateway /v1/txhub/*) needs a TW credential and is NOT used. Shapes follow each API's public docs; live-unverified (egress blocked).
import type { ChainInfo } from '../types';
import type { HistoryItem, TxKind } from '../../txHistory';
import type { Fetcher } from './types';
import { formatUnits, firstOf } from './types';
import { endpointsOf, getJ, postJ, rpc } from './net';
import { base58CheckEncode, hexToBytes, toBig } from './codec';
import { explorerTxUrl } from '../index';
import { solanaRpcUrl } from '../../rpc';

const big = (v: unknown): bigint => { try { return toBig(v); } catch { return 0n; } };
const eq = (a: unknown, b: string) => typeof a === 'string' && a === b;
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const http = (r: { ok: boolean; status: number }) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); };
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const isoMs = (v: unknown): number => { const t = Date.parse(String(v ?? '')); return Number.isFinite(t) ? t : 0; };

interface Row { chain: ChainInfo; id: string; kind: TxKind; ts: number; raw?: bigint; human?: string; decimals?: number; symbol?: string; cp?: string; status?: HistoryItem['status']; method?: string; token?: HistoryItem['token']; url?: string; key?: string }
const trimZeros = (s: string) => (/^\d+\.\d+$/.test(s) ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
/** One normalized row. `raw` (base units) or `human` (already decimal) supplies the amount. */
export function row(r: Row): HistoryItem {
  const dec = r.decimals ?? r.chain.decimals;
  return {
    id: r.key ?? r.id, assetId: r.chain.id, kind: r.kind, status: r.status ?? 'confirmed', timestamp: r.ts,
    amount: (r.human !== undefined ? trimZeros(r.human) : undefined) ?? (r.raw !== undefined ? formatUnits(r.raw, dec) : ''), symbol: r.symbol ?? r.chain.symbol,
    counterparty: r.cp || undefined, method: r.method, token: r.token, url: r.url ?? explorerTxUrl(r.chain, r.id) ?? undefined,
  };
}
/** Direction of a value transfer relative to `me`. */
export const dirOf = (from: unknown, to: unknown, me: string): TxKind => (eq(from, me) && eq(to, me) ? 'self' : eq(from, me) ? 'send' : eq(to, me) ? 'receive' : 'contract');
const cpOf = (kind: TxKind, from?: string, to?: string) => (kind === 'send' ? to : kind === 'receive' ? from : to);

// ---------- Solana: signatures + parsed transactions (balance deltas) ----------
const KNOWN_MINT: Record<string, string> = { EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC', Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT' };
export function mapSolanaTx(chain: ChainInfo, sig: any, tx: any, me: string): HistoryItem[] {
  const id = String(sig?.signature ?? ''); if (!id) return [];
  const ts = sig.blockTime ? num(sig.blockTime) * 1000 : tx?.blockTime ? num(tx.blockTime) * 1000 : 0;
  const status: HistoryItem['status'] = sig.err || tx?.meta?.err ? 'failed' : sig.confirmationStatus === 'processed' ? 'pending' : 'confirmed';
  const keys: string[] = arr(tx?.transaction?.message?.accountKeys).map((k: any) => (typeof k === 'string' ? k : String(k?.pubkey ?? '')));
  const meta = tx?.meta; const mine = keys.indexOf(me);
  if (!meta || mine < 0) return [row({ chain, id, kind: 'contract', ts, status, method: 'Transaction' })];
  const pre = arr(meta.preBalances), post = arr(meta.postBalances);
  const delta = (i: number) => BigInt(num(post[i])) - BigInt(num(pre[i]));
  let net = delta(mine); if (mine === 0) net += BigInt(num(meta.fee)); // the fee payer's own fee is not part of the transfer
  const others = keys.map((k, i) => ({ k, d: delta(i) })).filter((x) => x.k !== me && x.d !== 0n);
  const out: HistoryItem[] = [];
  // SPL token movements for this owner, per mint.
  const tokens = new Map<string, { dec: number; d: bigint }>();
  const acc = (list: any[], sign: bigint) => { for (const b of list) if (eq(b?.owner, me) && b?.mint) { const e = tokens.get(b.mint) ?? { dec: num(b.uiTokenAmount?.decimals), d: 0n }; e.d += sign * big(b.uiTokenAmount?.amount); tokens.set(b.mint, e); } };
  acc(arr(meta.preTokenBalances), -1n); acc(arr(meta.postTokenBalances), 1n);
  const cpFor = (positive: boolean) => others.filter((x) => (positive ? x.d < 0n : x.d > 0n)).sort((a, b) => (a.d < b.d ? (positive ? -1 : 1) : positive ? 1 : -1))[0]?.k;
  for (const [mint, e] of tokens) {
    if (e.d === 0n) continue; const recv = e.d > 0n; const sym = KNOWN_MINT[mint] ?? `${mint.slice(0, 4)}…`;
    out.push(row({ chain, id, key: out.length ? `${id}:${mint.slice(0, 6)}` : id, kind: recv ? 'receive' : 'send', ts, status, raw: recv ? e.d : -e.d, decimals: e.dec, symbol: sym, token: { symbol: sym, address: mint, decimals: e.dec }, cp: cpFor(recv), method: 'Token transfer', url: explorerTxUrl(chain, id) }));
  }
  const MIN_NATIVE = 10_000_000n; // 0.01 SOL: smaller changes next to a token move are rent / fees, not a transfer
  if (net !== 0n && (!out.length || net >= MIN_NATIVE || -net >= MIN_NATIVE)) out.push(row({ chain, id, key: out.length ? `${id}:sol` : id, kind: net > 0n ? 'receive' : 'send', ts, status, raw: net > 0n ? net : -net, cp: cpFor(net > 0n), method: 'Transaction' }));
  if (!out.length) out.push(row({ chain, id, kind: 'contract', ts, status, method: 'Transaction' }));
  return out;
}
export async function solanaHistory(chain: ChainInfo, me: string, f: Fetcher): Promise<HistoryItem[]> {
  const urls = [solanaRpcUrl(), ...endpointsOf(chain)].filter((u, i, a) => u && a.indexOf(u) === i);
  const sigs = await firstOf(urls, async (u) => { const r = await rpc(f, u, 'getSignaturesForAddress', [me, { limit: 20 }], 12000); if (r.error || !Array.isArray(r.result)) throw new Error(r.error?.message ?? 'bad response'); return r.result as any[]; });
  const url = urls[0]; const out: HistoryItem[][] = new Array(sigs.length);
  let i = 0;
  const worker = async () => { while (i < sigs.length) { const k = i++; const s = sigs[k]; let tx: any = null;
    try { const r = await rpc(f, url, 'getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }], 12000); tx = r.result ?? null; } catch { tx = null; }
    out[k] = mapSolanaTx(chain, s, tx, me); } };
  await Promise.all(Array.from({ length: Math.min(5, sigs.length) }, worker));
  return out.flat();
}

// ---------- Tron: TronGrid ----------
const tronB58 = (hex: unknown): string | undefined => { try { return typeof hex === 'string' && /^41[0-9a-fA-F]{40}$/.test(hex) ? base58CheckEncode(hexToBytes(hex)) : typeof hex === 'string' ? hex : undefined; } catch { return undefined; } };
export function mapTronTxs(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body?.data)) {
    const id = String(t?.txID ?? ''); if (!id) continue;
    const c = t?.raw_data?.contract?.[0]; const v = c?.parameter?.value ?? {};
    const status: HistoryItem['status'] = (t?.ret?.[0]?.contractRet ?? 'SUCCESS') === 'SUCCESS' ? 'confirmed' : 'failed';
    const ts = num(t?.block_timestamp ?? t?.raw_data?.timestamp);
    if (c?.type === 'TransferContract') { const from = tronB58(v.owner_address), to = tronB58(v.to_address); const kind = dirOf(from, to, me); out.push(row({ chain, id, kind, ts, raw: big(v.amount), cp: cpOf(kind, from, to), status })); }
    else out.push(row({ chain, id, kind: 'contract', ts, status, method: c?.type === 'TriggerSmartContract' ? 'Contract call' : String(c?.type ?? 'Transaction').replace(/Contract$/, '') }));
  }
  return out;
}
export function mapTrc20(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body?.data)) {
    const id = String(t?.transaction_id ?? ''); const ti = t?.token_info; if (!id || !ti) continue;
    const kind = dirOf(t.from, t.to, me); const dec = num(ti.decimals); const sym = String(ti.symbol ?? '').slice(0, 32);
    out.push(row({ chain, id, key: `${id}:${String(ti.address ?? '').slice(0, 8)}`, kind, ts: num(t.block_timestamp), raw: big(t.value), decimals: dec, symbol: sym, token: { symbol: sym, address: ti.address, decimals: dec }, cp: cpOf(kind, t.from, t.to), method: 'Token transfer', url: explorerTxUrl(chain, id) }));
  }
  return out;
}
async function tronHistory(chain: ChainInfo, me: string, f: Fetcher): Promise<HistoryItem[]> {
  const base = endpointsOf(chain)[0] ?? 'https://api.trongrid.io';
  const [a, b] = await Promise.allSettled([getJ(f, `${base}/v1/accounts/${me}/transactions?limit=50&order_by=block_timestamp,desc`, 12000), getJ(f, `${base}/v1/accounts/${me}/transactions/trc20?limit=50&order_by=block_timestamp,desc`, 12000)]);
  if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
  const ok = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' && r.value.ok ? r.value.body : null);
  if (!ok(a) && !ok(b)) throw new Error('HTTP error');
  const tokens = mapTrc20(chain, ok(b), me); const seen = new Set(tokens.map((x) => x.id.split(':')[0]));
  return [...mapTronTxs(chain, ok(a), me).filter((x) => !(x.kind === 'contract' && seen.has(x.id))), ...tokens];
}

// ---------- Cosmos LCD ----------
const attr = (e: any, key: string): string[] => arr(e?.attributes).filter((a: any) => a?.key === key).map((a: any) => String(a?.value ?? ''));
export function mapCosmosTxs(chain: ChainInfo, bodies: any[], me: string, denom: string): HistoryItem[] {
  const seen = new Set<string>(); const out: HistoryItem[] = [];
  for (const body of bodies) for (const t of arr(body?.tx_responses)) {
    const id = String(t?.txhash ?? ''); if (!id || seen.has(id)) continue; seen.add(id);
    const status: HistoryItem['status'] = num(t.code) === 0 ? 'confirmed' : 'failed'; const ts = isoMs(t.timestamp);
    let hit: { from: string; to: string; amount: bigint } | null = null;
    for (const e of arr(t.events).filter((e: any) => e?.type === 'transfer')) {
      const to = attr(e, 'recipient'), from = attr(e, 'sender'), amt = attr(e, 'amount');
      for (let i = 0; i < Math.max(to.length, amt.length) && !hit; i++) {
        if (!(eq(to[i], me) || eq(from[i], me))) continue;
        const m = new RegExp(`(?:^|,)(\\d+)${denom.replace(/[^\w/]/g, '')}(?:,|$)`).exec(amt[i] ?? '');
        if (m) hit = { from: from[i], to: to[i], amount: BigInt(m[1]) };
      }
    }
    if (hit) { const kind = dirOf(hit.from, hit.to, me); out.push(row({ chain, id, kind, ts, raw: hit.amount, cp: cpOf(kind, hit.from, hit.to), status })); }
    else out.push(row({ chain, id, kind: 'contract', ts, status, method: 'Transaction' }));
  }
  return out;
}
async function cosmosHistory(chain: ChainInfo, me: string, f: Fetcher): Promise<HistoryItem[]> {
  const { COSMOS_DENOM } = await import('./cosmos'); const denom = COSMOS_DENOM[chain.id]; if (!denom) throw new Error('no denom');
  return firstOf(endpointsOf(chain), async (u) => {
    const bodies: any[] = []; let fail = 0;
    for (const key of ['transfer.recipient', 'transfer.sender']) {
      const q = `${key}='${me}'`; let got = false;
      // SDK <= 0.47 takes `events=`, SDK 0.50 takes `query=`.
      for (const p of [`events=${encodeURIComponent(q)}`, `query=${encodeURIComponent(q)}`]) {
        const r = await getJ(f, `${u}/cosmos/tx/v1beta1/txs?${p}&order_by=ORDER_BY_DESC&pagination.limit=25`, 12000);
        if (r.ok && Array.isArray(r.body?.tx_responses)) { bodies.push(r.body); got = true; break; }
      }
      if (!got) fail++;
    }
    if (fail === 2) throw new Error('tx search unavailable');
    return mapCosmosTxs(chain, bodies, me, denom);
  });
}

// ---------- Aptos (txs SENT by the account; incoming transfers need the indexer and are a documented gap) ----------
const APT_TRANSFERS = new Set(['0x1::aptos_account::transfer', '0x1::aptos_account::transfer_coins', '0x1::coin::transfer']);
export function mapAptos(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body)) {
    const id = String(t?.hash ?? ''); if (!id || t.type !== 'user_transaction') continue;
    const status: HistoryItem['status'] = t.success === false ? 'failed' : 'confirmed'; const ts = Math.floor(num(t.timestamp) / 1000);
    const fn = String(t.payload?.function ?? ''); const args = arr(t.payload?.arguments);
    if (APT_TRANSFERS.has(fn) && args.length >= 2 && (fn !== '0x1::coin::transfer' || /aptos_coin::AptosCoin$/.test(String(arr(t.payload?.type_arguments)[0] ?? 'AptosCoin::AptosCoin')))) {
      const kind = dirOf(t.sender, args[0], me); out.push(row({ chain, id, kind, ts, raw: big(args[1]), cp: cpOf(kind, t.sender, args[0]), status }));
    } else out.push(row({ chain, id, kind: 'contract', ts, status, method: fn.split('::').slice(-1)[0] || 'Transaction' }));
  }
  return out;
}

// ---------- Sui ----------
export function mapSui(chain: ChainInfo, bodies: any[], me: string): HistoryItem[] {
  const seen = new Set<string>(); const out: HistoryItem[] = [];
  for (const body of bodies) for (const t of arr(body?.data)) {
    const id = String(t?.digest ?? ''); if (!id || seen.has(id)) continue; seen.add(id);
    const status: HistoryItem['status'] = t.effects?.status?.status === 'failure' ? 'failed' : 'confirmed'; const ts = num(t.timestampMs);
    const sender = t.transaction?.data?.sender; const g = t.effects?.gasUsed ?? {};
    const gas = big(g.computationCost) + big(g.storageCost) - big(g.storageRebate);
    let mine = 0n; let cp: string | undefined; let best = 0n;
    for (const c of arr(t.balanceChanges)) {
      if (c?.coinType !== '0x2::sui::SUI') continue; const who = c?.owner?.AddressOwner; const a = BigInt(String(c.amount ?? '0').replace(/[^\d-]/g, '') || '0');
      if (eq(who, me)) mine += a; else if (who && (a > best || (a < 0n && -a > best))) { best = a < 0n ? -a : a; cp = who; }
    }
    const isSender = eq(sender, me); const amt = isSender ? -mine - gas : mine;
    if (amt > 0n || (isSender && amt === 0n && !arr(t.balanceChanges).length)) { const kind: TxKind = isSender ? 'send' : 'receive'; out.push(row({ chain, id, kind, ts, raw: amt > 0n ? amt : 0n, cp: kind === 'receive' ? sender : cp, status })); }
    else out.push(row({ chain, id, kind: 'contract', ts, status, method: 'Transaction' }));
  }
  return out;
}
async function suiHistory(chain: ChainInfo, me: string, f: Fetcher): Promise<HistoryItem[]> {
  return firstOf(endpointsOf(chain), async (u) => {
    const q = (filter: any) => rpc(f, u, 'suix_queryTransactionBlocks', [{ filter, options: { showBalanceChanges: true, showEffects: true, showInput: true } }, null, 25, true], 12000);
    const rs = await Promise.all([q({ FromAddress: me }), q({ ToAddress: me })]);
    const good = rs.filter((r) => !r.error && r.result);
    if (!good.length) throw new Error(rs[0].error?.message ?? 'bad response');
    return mapSui(chain, good.map((r) => r.result), me);
  });
}

// ---------- TON (toncenter v2 getTransactions) ----------
const b64ToHex = (s: string): string => { try { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Array.from(bin, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''); } catch { return s; } };
export function mapTon(chain: ChainInfo, body: any): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body?.result)) {
    const h = String(t?.transaction_id?.hash ?? ''); if (!h) continue; const id = b64ToHex(h); const ts = num(t.utime) * 1000;
    const inn = t.in_msg ?? {}; const outs = arr(t.out_msgs).filter((m: any) => m?.destination);
    if (inn.source && big(inn.value) > 0n) out.push(row({ chain, id, kind: 'receive', ts, raw: big(inn.value), cp: inn.source }));
    else if (outs.length) out.push(row({ chain, id, kind: 'send', ts, raw: outs.reduce((n: bigint, m: any) => n + big(m.value), 0n), cp: outs[0].destination }));
    else out.push(row({ chain, id, kind: 'contract', ts, method: 'Transaction' }));
  }
  return out;
}

// ---------- Algorand (indexer) ----------
export function mapAlgorand(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body?.transactions)) {
    const id = String(t?.id ?? ''); if (!id) continue; const ts = num(t['round-time']) * 1000; const p = t['payment-transaction'];
    if (t['tx-type'] === 'pay' && p) { const kind = dirOf(t.sender, p.receiver, me); out.push(row({ chain, id, kind, ts, raw: big(p.amount), cp: cpOf(kind, t.sender, p.receiver) })); }
    else out.push(row({ chain, id, kind: 'contract', ts, method: String(t['tx-type'] ?? 'Transaction') }));
  }
  return out;
}

// ---------- Stellar (Horizon payments) ----------
export function mapStellar(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const r of arr(body?._embedded?.records)) {
    const id = String(r?.transaction_hash ?? ''); if (!id) continue; const ts = isoMs(r.created_at); const status: HistoryItem['status'] = r.transaction_successful === false ? 'failed' : 'confirmed';
    if (r.type === 'payment' && r.asset_type === 'native') { const kind = dirOf(r.from, r.to, me); out.push(row({ chain, id, key: `${id}:${r.id}`, kind, ts, human: String(r.amount), cp: cpOf(kind, r.from, r.to), status, url: explorerTxUrl(chain, id) })); }
    else if (r.type === 'create_account') { const kind = dirOf(r.funder, r.account, me); out.push(row({ chain, id, key: `${id}:${r.id}`, kind, ts, human: String(r.starting_balance), cp: cpOf(kind, r.funder, r.account), status, method: 'Create account', url: explorerTxUrl(chain, id) })); }
  }
  return out;
}

// ---------- XRP Ledger account_tx ----------
const RIPPLE_EPOCH = 946684800;
export function mapRipple(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const w of arr(body?.result?.transactions)) {
    const t = w?.tx ?? w?.tx_json ?? {}; const id = String(w?.hash ?? t.hash ?? ''); if (!id) continue;
    const ts = (num(t.date ?? w?.close_time_iso) + RIPPLE_EPOCH) * 1000 || isoMs(w?.close_time_iso);
    const status: HistoryItem['status'] = (w?.meta?.TransactionResult ?? 'tesSUCCESS') === 'tesSUCCESS' ? (w.validated === false ? 'pending' : 'confirmed') : 'failed';
    if (t.TransactionType === 'Payment') {
      const kind = dirOf(t.Account, t.Destination, me); const a = t.Amount;
      if (typeof a === 'string') out.push(row({ chain, id, kind, ts, raw: big(a), cp: cpOf(kind, t.Account, t.Destination), status }));
      else if (a && typeof a === 'object') out.push(row({ chain, id, kind, ts, human: String(a.value ?? ''), symbol: String(a.currency ?? '').slice(0, 12), token: { symbol: String(a.currency ?? '').slice(0, 12), address: a.issuer }, cp: cpOf(kind, t.Account, t.Destination), status, method: 'Token payment' }));
    } else out.push(row({ chain, id, kind: 'contract', ts, status, method: String(t.TransactionType ?? 'Transaction') }));
  }
  return out;
}

// ---------- NEAR (NearBlocks API) ----------
export function mapNear(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body?.txns)) {
    const id = String(t?.transaction_hash ?? ''); if (!id) continue; const ts = Math.floor(num(t.block_timestamp) / 1e6);
    const status: HistoryItem['status'] = t.outcomes?.status === false ? 'failed' : 'confirmed'; const act = arr(t.actions)[0];
    if (act?.action === 'TRANSFER') { const kind = dirOf(t.signer_account_id, t.receiver_account_id, me); out.push(row({ chain, id, kind, ts, raw: big(String(t.actions_agg?.deposit ?? '0').split('.')[0]), cp: cpOf(kind, t.signer_account_id, t.receiver_account_id), status })); }
    else out.push(row({ chain, id, kind: 'contract', ts, status, cp: t.receiver_account_id, method: act?.method || String(act?.action ?? 'Transaction') }));
  }
  return out;
}

// ---------- Tezos (TzKT) ----------
export function mapTezos(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body)) {
    const id = String(t?.hash ?? ''); if (!id) continue; const from = t.sender?.address, to = t.target?.address; const kind = dirOf(from, to, me);
    out.push(row({ chain, id, key: `${id}:${t.counter ?? ''}`, kind, ts: isoMs(t.timestamp), raw: big(t.amount ?? 0), cp: cpOf(kind, from, to), status: t.status === 'applied' ? 'confirmed' : 'failed', method: t.parameter?.entrypoint, url: explorerTxUrl(chain, id) }));
  }
  return out;
}

// ---------- Filecoin (Filfox) ----------
export function mapFilecoin(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body?.transfers)) {
    if (t?.type && t.type !== 'transfer') continue; const id = String(t?.message ?? ''); if (!id) continue; const kind = dirOf(t.from, t.to, me);
    out.push(row({ chain, id, kind, ts: num(t.timestamp) * 1000, raw: big(t.value), cp: cpOf(kind, t.from, t.to) }));
  }
  return out;
}

// ---------- Waves node ----------
export function mapWaves(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(arr(body)[0])) {
    const id = String(t?.id ?? ''); if (!id) continue;
    if (t.type === 4 && !t.assetId) { const kind = dirOf(t.sender, t.recipient, me); out.push(row({ chain, id, kind, ts: num(t.timestamp), raw: big(t.amount), cp: cpOf(kind, t.sender, t.recipient) })); }
    else out.push(row({ chain, id, kind: 'contract', ts: num(t.timestamp), method: `Type ${t.type}` }));
  }
  return out;
}

// ---------- VeChain Thor logs/transfer ----------
export function mapVeChain(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const m = me.toLowerCase(); const out: HistoryItem[] = [];
  for (const l of arr(body)) {
    const id = String(l?.meta?.txID ?? ''); if (!id) continue; const s = String(l.sender ?? '').toLowerCase(), r = String(l.recipient ?? '').toLowerCase();
    const kind = dirOf(s, r, m); out.push(row({ chain, id, kind, ts: num(l.meta?.blockTimestamp) * 1000, raw: big(l.amount), cp: cpOf(kind, l.sender, l.recipient) }));
  }
  return out;
}

// ---------- MultiversX API ----------
export function mapMultiversx(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body)) {
    const id = String(t?.txHash ?? t?.originalTxHash ?? ''); if (!id || (t.type && t.type !== 'Transaction')) continue; const kind = dirOf(t.sender, t.receiver, me);
    out.push(row({ chain, id, kind: t.function && big(t.value) === 0n ? 'contract' : kind, ts: num(t.timestamp) * 1000, raw: big(t.value), cp: cpOf(kind, t.sender, t.receiver), status: t.status === 'success' ? 'confirmed' : t.status === 'pending' ? 'pending' : 'failed', method: t.function }));
  }
  return out;
}

// ---------- Polkadot / Kusama Asset Hub (Subscan transfers) ----------
export function mapSubscan(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of arr(body?.data?.transfers)) {
    const id = String(t?.hash ?? ''); if (!id) continue; const kind = dirOf(t.from, t.to, me);
    out.push(row({ chain, id, kind, ts: num(t.block_timestamp) * 1000, human: String(t.amount ?? ''), symbol: t.asset_symbol || chain.symbol, cp: cpOf(kind, t.from, t.to), status: t.success === false ? 'failed' : 'confirmed' }));
  }
  return out;
}

// ---------- Internet Computer (Rosetta /search/transactions) ----------
export function mapRosetta(chain: ChainInfo, body: any, me: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const w of arr(body?.transactions)) {
    const tx = w?.transaction; const id = String(tx?.transaction_identifier?.hash ?? ''); if (!id) continue;
    const ops = arr(tx.operations).filter((o: any) => o?.type === 'TRANSACTION'); const mine = ops.filter((o: any) => eq(o?.account?.address, me)).reduce((n: bigint, o: any) => n + BigInt(String(o?.amount?.value ?? '0').replace(/[^\d-]/g, '') || '0'), 0n);
    const other = ops.find((o: any) => !eq(o?.account?.address, me))?.account?.address; const ts = Math.floor(num(tx.metadata?.timestamp) / 1e6);
    out.push(row({ chain, id, kind: mine > 0n ? 'receive' : mine < 0n ? 'send' : 'self', ts, raw: mine < 0n ? -mine : mine, cp: other }));
  }
  return out;
}

// ---------- dispatch ----------
type H = (chain: ChainInfo, me: string, f: Fetcher) => Promise<HistoryItem[]>;
const viaEndpoints = (path: (u: string, me: string) => string, map: (c: ChainInfo, b: any, me: string) => HistoryItem[], o: { only?: string[] } = {}): H => async (chain, me, f) =>
  firstOf(endpointsOf(chain, o), async (u) => { const r = await getJ(f, path(u, me), 12000); http(r); if (r.body == null) throw new Error('bad response'); return map(chain, r.body, me); });
const SUBSCAN: Record<string, string> = { polkadot: 'https://assethub-polkadot.api.subscan.io', kusama: 'https://assethub-kusama.api.subscan.io' };
const ROSETTA_NET = { blockchain: 'Internet Computer', network: '00000000000000020101' };

export const NON_EVM_HISTORY: Record<string, H> = {
  solana: solanaHistory, tron: tronHistory, cosmos: cosmosHistory, sui: suiHistory,
  aptos: viaEndpoints((u, me) => `${u}/accounts/${me}/transactions?limit=25`, mapAptos),
  ton: viaEndpoints((u, me) => `${u}/getTransactions?address=${encodeURIComponent(me)}&limit=25`, (c, b) => mapTon(c, b)),
  algorand: viaEndpoints((_u, me) => `https://mainnet-idx.algonode.cloud/v2/accounts/${me}/transactions?limit=25`, mapAlgorand, { only: ['-'] }),
  stellar: viaEndpoints((u, me) => `${u}/accounts/${me}/payments?order=desc&limit=25`, mapStellar),
  near: viaEndpoints((_u, me) => `https://api.nearblocks.io/v1/account/${me}/txns?per_page=25&page=1`, mapNear, { only: ['-'] }),
  tezos: viaEndpoints((_u, me) => `https://api.tzkt.io/v1/accounts/${me}/operations?type=transaction&limit=25`, mapTezos, { only: ['-'] }),
  filecoin: viaEndpoints((_u, me) => `https://filfox.info/api/v1/address/${me}/transfers?pageSize=25&page=0`, mapFilecoin, { only: ['-'] }),
  waves: viaEndpoints((u, me) => `${u}/transactions/address/${me}/limit/25`, mapWaves),
  multiversx: viaEndpoints((_u, me) => `https://api.multiversx.com/accounts/${me}/transfers?size=25`, mapMultiversx, { only: ['-'] }),
  ripple: async (chain, me, f) => firstOf(endpointsOf(chain), async (u) => { const r = await rpc(f, u, 'account_tx', [{ account: me, limit: 25, ledger_index_min: -1, ledger_index_max: -1 }], 12000); if (r.error || r.result?.status === 'error') { if (r.result?.error === 'actNotFound') return []; throw new Error(r.result?.error ?? 'RPC error'); } return mapRipple(chain, { result: r.result }, me); }),
  vechain: async (chain, me, f) => firstOf(endpointsOf(chain), async (u) => { const r = await postJ(f, `${u}/logs/transfer`, { range: { unit: 'block', from: 0, to: 4294967295 }, options: { offset: 0, limit: 25 }, criteriaSet: [{ sender: me }, { recipient: me }], order: 'desc' }, 12000); http(r); return mapVeChain(chain, r.body, me); }),
  substrate: async (chain, me, f) => { const host = SUBSCAN[chain.id]; if (!host) throw new Error('unsupported'); const r = await postJ(f, `${host}/api/v2/scan/transfers`, { address: me, row: 25, page: 0, direction: 'all' }, 12000); http(r); if (r.body?.code !== undefined && r.body.code !== 0) throw new Error(r.body.message ?? 'Subscan error'); return mapSubscan(chain, r.body, me); },
  icp: async (chain, me, f) => { const r = await postJ(f, 'https://rosetta-api.internetcomputer.org/search/transactions', { network_identifier: ROSETTA_NET, account_identifier: { address: me }, limit: 25 }, 12000); http(r); return mapRosetta(chain, r.body, me); },
};
/** Families with no reliable keyless public transaction-list API (documented in evidences/re-evidence/32-chain-data/STATUS.md). */
export const HISTORY_UNSUPPORTED_REASON: Record<string, string> = {
  harmony: 'no stable public tx-list API', icon: 'tracker API not verified', zilliqa: 'explorer APIs need a key', theta: 'explorer API not verified', iotex: 'no keyless tx-list API',
  fio: 'history_v2 is not served by public nodes', ontology: 'explorer API not verified', nimiq: 'no public endpoint', aion: 'network retired',
};
