// Real on-chain history for the Token detail "History" tab and the Activity screen.
// TW source (evidence: HAR `GET gateway.us.trustwallet.com/v1/txhub/txs?asset=c<coin>&chain=<chain>&address=..&limit=50`,
// `POST /v1/txhub/bulk_history`) is TW's private gateway and is NOT used. Harbour reads public explorer APIs instead:
//   EVM (1, 8453, 42161, 137, Sepolia): Blockscout v2 REST   (/api/v2/addresses/{addr}/transactions)
//   BNB Smart Chain: Routescan etherscan-compatible txlist    (coverage of chain 56 is [guessing])
//   Bitcoin: Blockstream Esplora (/api/address/{addr}/txs)
//   Solana: JSON-RPC getSignaturesForAddress (status + time only; no amounts)
// Shapes follow public docs and are UNVERIFIED live from the build environment (egress blocked there).
// Only NATIVE-asset movements are listed; ERC-20/SPL transfers are not (documented gap).
import type { ChainInfo } from './chains/types';
import { chainById, explorerTxUrl } from './chains/index';
import { NON_EVM_HISTORY, HISTORY_UNSUPPORTED_REASON } from './chains/adapters/history';
import { firstOf } from './chains/adapters/types';
export type TxKind = 'send' | 'receive' | 'self' | 'contract';
export interface HistoryItem {
  id: string; assetId: string; kind: TxKind; status: 'confirmed' | 'failed' | 'pending';
  timestamp: number;            // ms epoch (0 if unknown)
  amount: string;               // human units, no sign; '' when unknown
  symbol: string; counterparty?: string; method?: string; url?: string;
  /** Set for non-native movements (ERC-20 / SPL / TRC-20 / IOU); `symbol` then carries the token symbol. */
  token?: { symbol: string; address?: string; decimals?: number };
  /** Fiat value at transaction time, ONLY when the explorer reports it (never today's price). */
  usd?: number;
}

export const EXPLORER_TX: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/', smartchain: 'https://bscscan.com/tx/', polygon: 'https://polygonscan.com/tx/', arbitrum: 'https://arbiscan.io/tx/',
  base: 'https://basescan.org/tx/', sepolia: 'https://sepolia.etherscan.io/tx/', bitcoin: 'https://blockstream.info/tx/', solana: 'https://solscan.io/tx/',
};
const BLOCKSCOUT: Record<string, string> = {
  ethereum: 'https://eth.blockscout.com', base: 'https://base.blockscout.com', arbitrum: 'https://arbitrum.blockscout.com',
  polygon: 'https://polygon.blockscout.com', sepolia: 'https://eth-sepolia.blockscout.com',
};
const ROUTESCAN_CHAIN: Record<string, number> = { smartchain: 56 };
export const SYMBOL: Record<string, string> = { ethereum: 'ETH', smartchain: 'BNB', polygon: 'POL', arbitrum: 'ETH', base: 'ETH', sepolia: 'ETH', bitcoin: 'BTC', solana: 'SOL' };
const DECIMALS: Record<string, number> = { bitcoin: 8, solana: 9 };

export function fmtUnits(v: bigint, decimals: number): string {
  const neg = v < 0n; const a = neg ? -v : v; const base = 10n ** BigInt(decimals);
  const whole = a / base; const frac = (a % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}
const big = (v: unknown): bigint => { try { return BigInt(v as any); } catch { return 0n; } };
const lc = (s: unknown) => String(s ?? '').toLowerCase();
const kindOf = (from: string, to: string, me: string, value: bigint, hasMethod: boolean): TxKind => {
  const f = lc(from) === me; const t = lc(to) === me;
  if (f && t) return 'self';
  if (value === 0n && hasMethod) return 'contract';
  if (f) return 'send'; if (t) return 'receive';
  return 'contract';
};

// ---- Blockscout v2: { items: [{ hash, timestamp, from:{hash}, to:{hash}|null, value, status, method, result }] }
export function mapBlockscout(body: any, assetId: string, address: string): HistoryItem[] {
  const me = lc(address); const out: HistoryItem[] = [];
  for (const t of Array.isArray(body?.items) ? body.items : []) {
    if (!t?.hash) continue;
    const value = big(t.value); const from = t.from?.hash ?? ''; const to = t.to?.hash ?? '';
    const ts = Date.parse(String(t.timestamp ?? '')); const failed = t.status === 'error' || (t.result && t.result !== 'success' && t.status !== 'ok');
    const kind = kindOf(from, to, me, value, !!t.method);
    const cp = kind === 'send' ? to : kind === 'receive' ? from : to || undefined;
    out.push({ id: String(t.hash), assetId, kind, status: failed ? 'failed' : t.status === 'ok' || t.result === 'success' ? 'confirmed' : 'pending', timestamp: Number.isFinite(ts) ? ts : 0, amount: fmtUnits(value, 18), symbol: SYMBOL[assetId], counterparty: cp || undefined, method: t.method ? String(t.method) : undefined, url: EXPLORER_TX[assetId] + t.hash });
  }
  return out;
}

// ---- Etherscan-compatible: { status:'1', result:[{ hash, timeStamp, from, to, value, isError, functionName, methodId }] }
export function mapEtherscanLike(body: any, assetId: string, address: string): HistoryItem[] {
  const me = lc(address); const out: HistoryItem[] = [];
  const rows = Array.isArray(body?.result) ? body.result : [];
  for (const t of rows) {
    if (!t?.hash) continue;
    const value = big(t.value); const hasMethod = !!(t.functionName || (t.methodId && t.methodId !== '0x'));
    const kind = kindOf(t.from, t.to, me, value, hasMethod);
    out.push({ id: String(t.hash), assetId, kind, status: String(t.isError) === '1' ? 'failed' : 'confirmed', timestamp: Number(t.timeStamp) * 1000 || 0, amount: fmtUnits(value, 18), symbol: SYMBOL[assetId],
      counterparty: (kind === 'send' ? t.to : kind === 'receive' ? t.from : t.to) || undefined, method: t.functionName ? String(t.functionName).split('(')[0] : undefined, url: EXPLORER_TX[assetId] + t.hash });
  }
  return out;
}

// ---- Esplora: [{ txid, vin:[{prevout:{scriptpubkey_address,value}}], vout:[{scriptpubkey_address,value}], status:{confirmed,block_time}, fee }]
export function mapEsplora(body: any, address: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const t of Array.isArray(body) ? body : []) {
    if (!t?.txid) continue;
    let inMine = 0n, outMine = 0n, outOthers = 0n;
    for (const i of t.vin ?? []) if (i?.prevout?.scriptpubkey_address === address) inMine += big(i.prevout.value);
    for (const o of t.vout ?? []) { if (o?.scriptpubkey_address === address) outMine += big(o.value); else outOthers += big(o.value); }
    let kind: TxKind; let amt: bigint; let cp: string | undefined;
    if (inMine > 0n && outOthers === 0n) { kind = 'self'; amt = outMine; }
    else if (inMine > 0n) { kind = 'send'; amt = outOthers; cp = (t.vout ?? []).find((o: any) => o?.scriptpubkey_address && o.scriptpubkey_address !== address)?.scriptpubkey_address; }
    else { kind = 'receive'; amt = outMine; cp = (t.vin ?? [])[0]?.prevout?.scriptpubkey_address; }
    out.push({ id: String(t.txid), assetId: 'bitcoin', kind, status: t.status?.confirmed ? 'confirmed' : 'pending', timestamp: t.status?.block_time ? Number(t.status.block_time) * 1000 : 0, amount: fmtUnits(amt, DECIMALS.bitcoin), symbol: 'BTC', counterparty: cp, url: EXPLORER_TX.bitcoin + t.txid });
  }
  return out;
}

// ---- Solana getSignaturesForAddress: { result: [{ signature, blockTime, err, confirmationStatus }] }
export function mapSolanaSignatures(body: any): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const s of Array.isArray(body?.result) ? body.result : []) {
    if (!s?.signature) continue;
    out.push({ id: String(s.signature), assetId: 'solana', kind: 'contract', status: s.err ? 'failed' : s.confirmationStatus === 'processed' ? 'pending' : 'confirmed', timestamp: s.blockTime ? Number(s.blockTime) * 1000 : 0, amount: '', symbol: 'SOL', method: 'Transaction', url: EXPLORER_TX.solana + s.signature });
  }
  return out;
}

type F = typeof fetch;
const get = async (url: string, f: F, init?: RequestInit) => {
  const res = await f(url, { ...init, signal: AbortSignal.timeout(12_000), headers: { accept: 'application/json', ...(init?.headers as any) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// ---- Blockscout v2 ERC-20 transfers: { items: [{ transaction_hash, timestamp, from:{hash}, to:{hash}, total:{value,decimals}, token:{symbol,address_hash|address,decimals} }] }
export function mapBlockscoutTokens(body: any, assetId: string, address: string): HistoryItem[] {
  const me = lc(address); const out: HistoryItem[] = [];
  for (const t of Array.isArray(body?.items) ? body.items : []) {
    const hash = t?.transaction_hash ?? t?.tx_hash; if (!hash || !t?.token) continue;
    const from = t.from?.hash ?? ''; const to = t.to?.hash ?? ''; const dec = Number(t.total?.decimals ?? t.token.decimals ?? 18);
    const kind = kindOf(from, to, me, 1n, false); const ts = Date.parse(String(t.timestamp ?? '')); const addr = t.token.address_hash ?? t.token.address;
    const sym = String(t.token.symbol ?? '').slice(0, 32) || 'Token';
    out.push({ id: `${hash}:${t.log_index ?? addr ?? ''}`, assetId, kind, status: 'confirmed', timestamp: Number.isFinite(ts) ? ts : 0, amount: fmtUnits(big(t.total?.value), Number.isFinite(dec) ? dec : 18), symbol: sym,
      counterparty: (kind === 'send' ? to : kind === 'receive' ? from : to) || undefined, method: 'Token transfer', token: { symbol: sym, address: addr, decimals: dec }, url: explorerTxFor(assetId, String(hash)) });
  }
  return out;
}
// ---- Etherscan-compatible tokentx: { result: [{ hash, timeStamp, from, to, value, tokenSymbol, tokenDecimal, contractAddress }] }
export function mapEtherscanTokens(body: any, assetId: string, address: string): HistoryItem[] {
  const me = lc(address); const out: HistoryItem[] = [];
  for (const t of Array.isArray(body?.result) ? body.result : []) {
    if (!t?.hash) continue; const dec = Number(t.tokenDecimal); const kind = kindOf(t.from, t.to, me, 1n, false); const sym = String(t.tokenSymbol ?? '').slice(0, 32) || 'Token';
    out.push({ id: `${t.hash}:${t.logIndex ?? t.contractAddress ?? ''}`, assetId, kind, status: 'confirmed', timestamp: Number(t.timeStamp) * 1000 || 0, amount: fmtUnits(big(t.value), Number.isInteger(dec) && dec >= 0 && dec <= 36 ? dec : 18), symbol: sym,
      counterparty: (kind === 'send' ? t.to : kind === 'receive' ? t.from : t.to) || undefined, method: 'Token transfer', token: { symbol: sym, address: t.contractAddress, decimals: dec }, url: explorerTxFor(assetId, String(t.hash)) });
  }
  return out;
}
/** Explorer link for any registry chain (the legacy table first, then wallet-core's explorer template). */
export function explorerTxFor(assetId: string, hash: string): string { return EXPLORER_TX[assetId] ? EXPLORER_TX[assetId] + hash : explorerTxUrl(chainById(assetId), hash); }

// Additional public EVM history providers (hosts follow each project's public naming; live-unverified, see evidence/32-chain-data/STATUS.md).
const BLOCKSCOUT_MORE: Record<string, string> = {
  optimism: 'https://optimism.blockscout.com', xdai: 'https://gnosis.blockscout.com', zksync: 'https://zksync.blockscout.com', scroll: 'https://scroll.blockscout.com',
  blast: 'https://blast.blockscout.com', celo: 'https://celo.blockscout.com',
};
const ROUTESCAN_MORE: Record<string, number> = { avalanchec: 43114 };
const blockscoutHost = (id: string) => BLOCKSCOUT[id] ?? BLOCKSCOUT_MORE[id];
const routescanId = (id: string) => ROUTESCAN_CHAIN[id] ?? ROUTESCAN_MORE[id];
const nativeSymbol = (id: string) => SYMBOL[id] ?? chainById(id)?.symbol ?? '';

/** True when a keyless public history source is wired for this chain (EVM explorers, Esplora, or a non-EVM family adapter). */
export function historySupportedFor(chain: ChainInfo | undefined): boolean {
  if (!chain) return false;
  if (chain.kind === 'evm') return !!(blockscoutHost(chain.id) || routescanId(chain.id));
  if (chain.kind === 'utxo') return true;
  return !!NON_EVM_HISTORY[chain.kind];
}
export const historySupported = (assetId: string) => historySupportedFor(chainById(assetId));
export const historyUnsupportedReason = (chain: ChainInfo): string => HISTORY_UNSUPPORTED_REASON[chain.kind] ?? 'No public history source for this network yet.';

async function evmHistory(chain: ChainInfo, address: string, f: F): Promise<HistoryItem[]> {
  const id = chain.id; let native: HistoryItem[] | null = null; let tokens: HistoryItem[] | null = null; let err: unknown;
  const bs = blockscoutHost(id); const rs = routescanId(id);
  const nat = async () => { try {
    if (bs) { const b = await get(`${bs}/api/v2/addresses/${address}/transactions`, f); native = mapBlockscout(b, id, address).map((x) => ({ ...x, symbol: nativeSymbol(id), url: explorerTxFor(id, x.id) }));
      // Blockscout reports the exchange rate valid at the transaction's block when it has one; today's rate is never used.
      for (const t of Array.isArray(b?.items) ? b.items : []) { const r = Number(t?.historic_exchange_rate); const x = native.find((n) => n.id === t.hash); if (x && Number.isFinite(r) && r > 0 && Number(x.amount) > 0) x.usd = Number(x.amount) * r; } }
    else if (rs) native = mapEtherscanLike(await get(`https://api.routescan.io/v2/network/mainnet/evm/${rs}/etherscan/api?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=50`, f), id, address).map((x) => ({ ...x, symbol: nativeSymbol(id), url: explorerTxFor(id, x.id) }));
  } catch (e) { err = e; } };
  const tok = async () => { try {
    if (bs) tokens = mapBlockscoutTokens(await get(`${bs}/api/v2/addresses/${address}/token-transfers?type=ERC-20`, f), id, address);
    else if (rs) tokens = mapEtherscanTokens(await get(`https://api.routescan.io/v2/network/mainnet/evm/${rs}/etherscan/api?module=account&action=tokentx&address=${address}&sort=desc&page=1&offset=50`, f), id, address);
  } catch (e) { err ??= e; } };
  await Promise.all([nat(), tok()]);
  if (native === null && tokens === null) throw err ?? new Error('no source');
  const tk: HistoryItem[] = tokens ?? []; const tokenHashes = new Set(tk.map((x) => x.id.split(':')[0]));
  // A zero-value contract call that produced a token transfer is shown once, as the transfer.
  const nt = ((native ?? []) as HistoryItem[]).filter((x) => !(tokenHashes.has(x.id) && (x.kind === 'contract' || Number(x.amount) === 0)));
  return [...nt, ...tk];
}

/** One entry point for every chain: normalized rows, newest first. Never throws. */
export async function fetchHistory(chainOrId: ChainInfo | string, address: string, opts?: { solanaRpc?: string } | null, f: F = fetch): Promise<{ ok: true; items: HistoryItem[] } | { ok: false; error: string; unsupported?: boolean }> {
  const chain = typeof chainOrId === 'string' ? chainById(chainOrId) : chainOrId;
  if (!address) return { ok: false, error: 'No address for this network.' };
  if (!chain || !historySupportedFor(chain)) return { ok: false, error: 'History is not available for this network yet.', unsupported: true };
  try {
    let items: HistoryItem[];
    if (chain.kind === 'evm') items = await evmHistory(chain, address, f);
    else if (chain.kind === 'utxo') items = await firstOf((chain.endpoints ?? ['https://blockstream.info/api']).map((u) => u.replace(/\/+$/, '')), async (u) => mapEsplora(await get(`${u}/address/${address}/txs`, f), address));
    else items = await NON_EVM_HISTORY[chain.kind](chain, address, f);
    items.sort((a, b) => b.timestamp - a.timestamp);
    return { ok: true, items: items.slice(0, 60) };
  } catch (e: any) { return { ok: false, error: 'Could not load history right now.' }; }
}
