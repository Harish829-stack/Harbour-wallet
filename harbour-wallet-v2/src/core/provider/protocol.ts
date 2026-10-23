// Wire protocol between the page (inpage provider), the content script and the background provider router.
// The page is untrusted: everything arriving from it is re-validated at every hop (inpage -> content -> background).
import { ERR, ProviderError } from './errors';

export type Namespace = 'evm' | 'solana' | 'multi';
export const NAMESPACES: readonly Namespace[] = ['evm', 'solana', 'multi'];

/** What a dApp may ask for. Only these four keys cross the bridge; the sender's identity comes from the browser, never from here. */
export interface PageRequest { id: string; ns: Namespace; method: string; params?: unknown }

/** background -> content -> page */
export type OutMessage =
  | { t: 'res'; id: string; result?: unknown; error?: { code: number; message: string; data?: unknown } }
  | { t: 'evt'; ns: Namespace; name: string; data?: unknown }
  | { t: 'init'; state: InitState };

export interface InitState {
  evm: { chainId: string; networkVersion: string; accounts: string[]; connected: boolean };
  solana: { publicKey: string | null };
  /** Cosmos/Sui/Aptos/Tron/Bitcoin accounts this origin may see, by registry chain id. */
  multi: Record<string, { address: string; publicKey: string }>;
  prefs: { defaultWallet: boolean };
}

/** Events a page is allowed to receive (anything else from the background is dropped by the content script). */
export const EVENT_ALLOWLIST: Record<Namespace, readonly string[]> = {
  evm: ['accountsChanged', 'chainChanged', 'connect', 'disconnect', 'networkChanged'],
  solana: ['connect', 'disconnect', 'accountChanged'],
  multi: ['connect', 'disconnect'],
};

export const MAX_PARAMS_BYTES = 256 * 1024;
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const METHOD_RE = /^[A-Za-z0-9_]{1,64}$/;

function scan(v: unknown, depth: number, budget: { n: number }): boolean {
  if (++budget.n > 20000 || depth > 24) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => scan(x, depth + 1, budget));
  if (typeof v === 'object') {
    for (const k of Object.keys(v as object)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') return false; if (!scan((v as any)[k], depth + 1, budget)) return false; }
    return true;
  }
  return false; // functions, symbols, bigint, undefined
}

export type ParseResult = { ok: true; req: PageRequest } | { ok: false; id?: string; error: ProviderError };
/** Strict structural validation of a request coming from a page. Returns a sanitised deep copy (JSON round trip) with only the 4 allowed keys. */
export function parsePageRequest(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: new ProviderError(ERR.INVALID_REQUEST) };
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && ID_RE.test(o.id) ? o.id : undefined;
  if (!id) return { ok: false, error: new ProviderError(ERR.INVALID_REQUEST, 'Invalid request id.') };
  if (typeof o.ns !== 'string' || !(NAMESPACES as readonly string[]).includes(o.ns)) return { ok: false, id, error: new ProviderError(ERR.INVALID_REQUEST, 'Invalid namespace.') };
  if (typeof o.method !== 'string' || !METHOD_RE.test(o.method)) return { ok: false, id, error: new ProviderError(ERR.INVALID_REQUEST, 'Invalid method.') };
  let params: unknown = undefined;
  if (o.params !== undefined) {
    if (!scan(o.params, 0, { n: 0 })) return { ok: false, id, error: new ProviderError(ERR.INVALID_PARAMS, 'Params must be plain JSON.') };
    let text: string; try { text = JSON.stringify(o.params); } catch { return { ok: false, id, error: new ProviderError(ERR.INVALID_PARAMS) }; }
    if (text.length > MAX_PARAMS_BYTES) return { ok: false, id, error: new ProviderError(ERR.INVALID_PARAMS, 'Request too large.') };
    params = JSON.parse(text);
  }
  return { ok: true, req: { id, ns: o.ns as Namespace, method: o.method, ...(params !== undefined ? { params } : {}) } };
}

/** Is an event name allowed to reach the page? */
export const isAllowedEvent = (ns: unknown, name: unknown): boolean => typeof ns === 'string' && typeof name === 'string' && (EVENT_ALLOWLIST as Record<string, readonly string[]>)[ns]?.includes(name) === true;

/** Identity of the frame that made a request, as reported by the browser for the port (never by page data). */
export interface SenderInfo {
  tabId: number; frameId: number; documentId?: string;
  origin: string; topOrigin: string; isTopFrame: boolean;
  title?: string; icon?: string; incognito?: boolean;
}
export const senderKey = (s: Pick<SenderInfo, 'tabId' | 'frameId' | 'origin' | 'documentId'>, id: string) => JSON.stringify([s.tabId, s.frameId, s.origin, s.documentId ?? null, id]);
