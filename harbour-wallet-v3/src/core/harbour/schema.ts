// HW-2026-014 (CCSS J-03 / I-04): runtime shape checks for Harbour API responses. No dependency (supply chain, K-area):
// small hand-written guards that throw a HarbourApiError('bad_response') so callers treat a malformed answer like an outage
// instead of rendering attacker- or bug-shaped data. Cross-checks: answers must only describe the addresses we asked about,
// and a broadcast's tx_hash must be the hash of the raw transaction we sent.
import { keccak_256 } from '@noble/hashes/sha3';
import { HarbourApiError } from './device';
import type { AddressRef, Portfolio, History, NftView } from './client';

const bad = (what: string): never => { throw new HarbourApiError(0, 'bad_response', `Harbour returned an unexpected ${what}. Please try again.`, true); };
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 512) => typeof v === 'string' && v.length <= max;
const strOrNull = (v: unknown, max = 512) => v === null || v === undefined || str(v, max);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown) => v === null || v === undefined || num(v);
const intStr = (v: unknown) => typeof v === 'string' && /^\d{1,80}$/.test(v);
const decStr = (v: unknown) => typeof v === 'string' && /^-?\d{1,80}(\.\d{1,80})?$/.test(v);
const arr = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;
const refKey = (chain: string, address: string) => `${chain}:${address.toLowerCase()}`;
const allowedSet = (refs?: AddressRef[]) => (refs?.length ? new Set(refs.map((r) => refKey(r.chain, r.address))) : null);

function asset(a: any): boolean {
  return isObj(a) && str(a.chain, 64) && str(a.asset_ref, 256) && str(a.kind, 32) && strOrNull(a.symbol, 64) && strOrNull(a.name, 256)
    && (a.decimals === null || a.decimals === undefined || (Number.isInteger(a.decimals) && a.decimals >= 0 && a.decimals <= 36))
    && strOrNull(a.logo_url, 2048) && typeof a.spam === 'boolean' && typeof a.verified === 'boolean';
}

export function checkPortfolio(p: unknown, refs?: AddressRef[]): Portfolio {
  const ok = allowedSet(refs);
  if (!isObj(p) || !num(p.value_usd) || !arr(p.addresses, 1000)) return bad('portfolio');
  for (const a of p.addresses as any[]) {
    if (!isObj(a) || !str(a.chain, 64) || !str(a.address, 128) || typeof a.synced !== 'boolean' || !num(a.value_usd) || !arr(a.assets, 5000)) return bad('portfolio');
    if (ok && !ok.has(refKey(a.chain, a.address))) return bad('portfolio (address not requested)');
    for (const h of a.assets as any[]) if (!asset(h) || !intStr(h.amount_raw) || !decStr(h.amount) || !numOrNull(h.value_usd) || !isObj(h.price) || !numOrNull(h.price.usd)) return bad('portfolio asset');
  }
  return p as Portfolio;
}

export function checkHistory(h: unknown, refs?: AddressRef[]): History {
  const ok = allowedSet(refs);
  if (!isObj(h) || !arr(h.items, 1000) || !strOrNull(h.cursor, 2048)) return bad('history');
  for (const r of h.items as any[]) {
    if (!isObj(r) || !str(r.chain, 64) || !str(r.address, 128) || !str(r.tx_hash, 256) || !str(r.block_time, 64) || !str(r.direction, 16) || !str(r.finality, 32) || !arr(r.transfers, 500)) return bad('history row');
    if (ok && !ok.has(refKey(r.chain, r.address))) return bad('history (address not requested)');
    for (const t of r.transfers as any[]) if (!asset(t) || !intStr(t.amount_raw) || !decStr(t.amount) || !['in', 'out', 'self'].includes(t.direction) || !strOrNull(t.counterparty, 128) || !strOrNull(t.token_id, 100)) return bad('history transfer');
  }
  return h as History;
}

export function checkNfts(n: unknown, refs?: AddressRef[]): { nfts: NftView[] } {
  const ok = allowedSet(refs);
  if (!isObj(n) || !arr(n.nfts, 10_000)) return bad('NFT list');
  for (const x of n.nfts as any[]) {
    if (!isObj(x) || !str(x.chain, 64) || !str(x.address, 128) || !str(x.contract, 128) || !str(x.token_id, 100) || !decStr(x.amount) || !str(x.standard, 32) || !strOrNull(x.name, 512) || !strOrNull(x.collection, 512) || !strOrNull(x.image_url, 2048) || typeof x.spam !== 'boolean') return bad('NFT');
    if (ok && !ok.has(refKey(x.chain, x.address))) return bad('NFT list (address not requested)');
  }
  return n as { nfts: NftView[] };
}

export function checkAddresses(a: unknown): { addresses: Array<AddressRef & { backfill_state: string; synced: boolean }> } {
  if (!isObj(a) || !arr(a.addresses, 1000)) return bad('address list');
  for (const r of a.addresses as any[]) if (!isObj(r) || !str(r.chain, 64) || !str(r.address, 128) || typeof r.synced !== 'boolean') return bad('address list');
  return a as any;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
/** EVM raw txs (0x…): the returned hash must be keccak256(raw). Other families are shape-checked only. */
export function checkBroadcast(r: unknown, raw: string): { tx_hash: string; status: string; channel?: string; channel_token?: string } {
  if (!isObj(r) || !str(r.tx_hash, 256) || !str(r.status, 32) || !strOrNull(r.channel, 256) || !strOrNull(r.channel_token, 4096)) return bad('broadcast result');
  if (/^0x[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    const want = '0x' + hex(keccak_256(Uint8Array.from(raw.slice(2).match(/../g)!.map((b) => parseInt(b, 16)))));
    // Same code and wording as the RPC hook's check: the transaction may still have been sent, so the user must not blindly retry.
    if (r.tx_hash.toLowerCase() !== want) throw new HarbourApiError(0, 'bad_hash', 'Harbour could not confirm this transaction. Check your activity before trying again.', false);
  }
  return r as any;
}
