// Tolerant HTTP helpers for the non-EVM adapters: HTTP status is data (404 often means "account not found"), network failures throw.
import type { ChainInfo } from '../types';
import type { Fetcher } from './types';

export interface Resp { status: number; ok: boolean; body: any; text: string }
export async function req(f: Fetcher, url: string, init?: RequestInit, ms = 8000): Promise<Resp> {
  const res = await f(url, { ...init, headers: { accept: 'application/json', ...(init?.headers as any) }, signal: AbortSignal.timeout(ms) });
  let text = ''; try { text = await res.text(); } catch { /* empty */ }
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: res.status, ok: res.ok, body, text };
}
export const getJ = (f: Fetcher, url: string, ms?: number) => req(f, url, undefined, ms);
export const postJ = (f: Fetcher, url: string, body: unknown, ms?: number) => req(f, url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, ms);
/** JSON-RPC 2.0 call. Returns the whole envelope (result and/or error); throws only for transport / non-JSON failures. */
export async function rpc(f: Fetcher, url: string, method: string, params: unknown, ms?: number): Promise<{ result?: any; error?: any; text: string; status: number }> {
  const r = await postJ(f, url, { jsonrpc: '2.0', id: 1, method, params }, ms);
  if (!r.body || typeof r.body !== 'object' || (!('result' in r.body) && !('error' in r.body))) throw new Error(r.ok ? 'bad response' : `HTTP ${r.status}`);
  return { result: r.body.result, error: r.body.error, text: r.text, status: r.status };
}
export const trimUrl = (u: string) => u.replace(/\/+$/, '');
/** Endpoint list: registry endpoints (unless `only`), with adapter-level `first`/`last` additions, de-duplicated. */
export function endpointsOf(chain: ChainInfo, o: { first?: string[]; last?: string[]; only?: string[] } = {}): string[] {
  const base = o.only ?? (chain.endpoints ?? []);
  return [...(o.first ?? []), ...base, ...(o.last ?? [])].map(trimUrl).filter((u, i, a) => u && a.indexOf(u) === i);
}

import type { BalanceAdapter } from './types';
import { fail, okRaw, firstOf } from './types';
/** Build a balance adapter from "ask one endpoint, return base units". A thrown error moves on to the next endpoint; a returned
 *  value (including 0n for account-not-found) is final. Never throws. */
export function simple(get: (url: string, chain: ChainInfo, address: string, f: Fetcher) => Promise<bigint>, o: { first?: string[]; last?: string[]; only?: string[] } = {}): BalanceAdapter {
  return async (chain, address, f) => {
    const urls = endpointsOf(chain, o);
    if (!urls.length) return fail('no endpoint configured');
    try { return okRaw(await firstOf(urls, (u) => get(u, chain, address, f)), chain.decimals); }
    catch (e: any) { return fail(e?.name === 'TimeoutError' ? 'request timed out' : (e?.message ?? 'request failed')); }
  };
}
export const unsupported = (reason: string): BalanceAdapter => async () => fail(`unsupported: ${reason}`);
