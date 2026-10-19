// Persistent state of the dApp provider: per-origin connections, blacklist, tracked token approvals, and the pending-request queue.
// Storage is injected (chrome.storage.local / .session in the extension, a Map in tests) and every read-modify-write is serialised.
import type { Namespace } from './protocol';
import { hostnameOf } from './origin';

export interface KV { get<T = any>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; remove(key: string): Promise<void> }
export const PKEYS = {
  CONNECTIONS: 'wallet:provider:connections', BLACKLIST: 'wallet:provider:blacklist', APPROVALS: 'wallet:provider:tokenApprovals', PREFS: 'wallet:provider:prefs',
  PENDING: 'wallet:provider:pending', SETTLED: 'wallet:provider:settled', WINDOW: 'wallet:provider:window',
} as const;

class Lock { private tail: Promise<unknown> = Promise.resolve(); run<T>(fn: () => Promise<T>): Promise<T> { const p = this.tail.then(fn, fn); this.tail = p.catch(() => {}); return p; } }
const newId = (): string => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
export { newId };

export interface Connection {
  id: string; origin: string; title: string; icon?: string;
  walletId: string; walletName: string; accountIndex: number; accountName: string;
  evmAddress?: string; solanaAddress?: string;
  chainId: number;                 // EVM chain this origin currently sees (Harbour: per-origin; TW: wallet-global)
  namespaces: Namespace[];
  connectedAt: number; lastUsedAt: number;
}
export interface BlacklistItem { id: string; origin: string; title?: string; icon?: string; addedAt: number }
export interface TrackedApproval { id: string; chainId: number; token: string; spender: string; owner: string; origin: string; txHash?: string; amount: string; unlimited: boolean; at: number }
export interface ProviderPrefs { defaultWallet: boolean }
export const DEFAULT_PREFS: ProviderPrefs = { defaultWallet: false };
const MAX_CONNECTIONS = 200; const MAX_BLACKLIST = 500; const MAX_APPROVALS = 300;

const cleanText = (s: unknown, n: number): string => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');
const safeIcon = (u: unknown): string | undefined => (typeof u === 'string' && /^https?:\/\//.test(u) && u.length <= 500 ? u : undefined);

export class PermissionStore {
  private lock = new Lock();
  constructor(private kv: KV, private now: () => number = Date.now) {}

  // ---- connections
  async all(): Promise<Connection[]> { const m = (await this.kv.get<Record<string, Connection>>(PKEYS.CONNECTIONS)) ?? {}; return Object.values(m).sort((a, b) => b.lastUsedAt - a.lastUsedAt); }
  async get(origin: string): Promise<Connection | undefined> { const m = (await this.kv.get<Record<string, Connection>>(PKEYS.CONNECTIONS)) ?? {}; return Object.prototype.hasOwnProperty.call(m, origin) ? m[origin] : undefined; }
  async getById(id: string): Promise<Connection | undefined> { return (await this.all()).find((c) => c.id === id); }
  connect(input: Omit<Connection, 'id' | 'connectedAt' | 'lastUsedAt' | 'title'> & { title?: string }): Promise<Connection> {
    return this.lock.run(async () => {
      const m = (await this.kv.get<Record<string, Connection>>(PKEYS.CONNECTIONS)) ?? {};
      const prev = Object.prototype.hasOwnProperty.call(m, input.origin) ? m[input.origin] : undefined;
      if (!prev && Object.keys(m).length >= MAX_CONNECTIONS) { const oldest = Object.values(m).sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0]; delete m[oldest.origin]; }
      const t = this.now();
      const c: Connection = { ...input, title: cleanText(input.title, 80) || hostnameOf(input.origin), icon: safeIcon(input.icon), id: prev?.id ?? newId(), connectedAt: prev?.connectedAt ?? t, lastUsedAt: t,
        namespaces: Array.from(new Set([...(prev?.namespaces ?? []), ...input.namespaces])) };
      m[input.origin] = c; await this.kv.set(PKEYS.CONNECTIONS, m); return c;
    });
  }
  update(origin: string, patch: Partial<Connection>): Promise<Connection | undefined> {
    return this.lock.run(async () => {
      const m = (await this.kv.get<Record<string, Connection>>(PKEYS.CONNECTIONS)) ?? {};
      if (!Object.prototype.hasOwnProperty.call(m, origin)) return undefined;
      const { id: _i, origin: _o, ...rest } = patch; m[origin] = { ...m[origin], ...rest }; await this.kv.set(PKEYS.CONNECTIONS, m); return m[origin];
    });
  }
  /** Remove one namespace from a connection, or the whole connection when no namespace remains. */
  disconnect(origin: string, ns?: Namespace): Promise<Connection | undefined> {
    return this.lock.run(async () => {
      const m = (await this.kv.get<Record<string, Connection>>(PKEYS.CONNECTIONS)) ?? {};
      if (!Object.prototype.hasOwnProperty.call(m, origin)) return undefined;
      const c = m[origin];
      if (ns) { c.namespaces = c.namespaces.filter((x) => x !== ns); if (ns === 'evm') delete c.evmAddress; if (ns === 'solana') delete c.solanaAddress; }
      if (!ns || c.namespaces.length === 0) delete m[origin]; else m[origin] = c;
      await this.kv.set(PKEYS.CONNECTIONS, m); return c;
    });
  }
  disconnectAll(): Promise<Connection[]> { return this.lock.run(async () => { const all = Object.values((await this.kv.get<Record<string, Connection>>(PKEYS.CONNECTIONS)) ?? {}); await this.kv.set(PKEYS.CONNECTIONS, {}); return all; }); }
  /** Throttled "last used" bookkeeping (never rewrites more than once a minute per origin). */
  async touch(origin: string): Promise<void> { const c = await this.get(origin); if (c && this.now() - c.lastUsedAt > 60_000) await this.update(origin, { lastUsedAt: this.now() }); }
  async isConnected(origin: string, ns: Namespace): Promise<Connection | undefined> { const c = await this.get(origin); return c && c.namespaces.includes(ns) && (ns === 'evm' ? !!c.evmAddress : !!c.solanaAddress) ? c : undefined; }

  // ---- blacklist (matched by hostname, so any scheme/port of a blocked host is blocked)
  async blacklist(): Promise<BlacklistItem[]> { return ((await this.kv.get<BlacklistItem[]>(PKEYS.BLACKLIST)) ?? []).slice().sort((a, b) => b.addedAt - a.addedAt); }
  async isBlacklisted(origin: string): Promise<boolean> { const h = hostnameOf(origin); if (!h) return true; return (await this.blacklist()).some((b) => hostnameOf(b.origin) === h); }
  addBlacklist(origin: string, meta: { title?: string; icon?: string } = {}): Promise<BlacklistItem | undefined> {
    return this.lock.run(async () => {
      const list = (await this.kv.get<BlacklistItem[]>(PKEYS.BLACKLIST)) ?? []; const h = hostnameOf(origin); if (!h) return undefined;
      const hit = list.find((b) => hostnameOf(b.origin) === h); if (hit) return hit;
      if (list.length >= MAX_BLACKLIST) list.shift();
      const item: BlacklistItem = { id: newId(), origin, title: cleanText(meta.title, 80) || undefined, icon: safeIcon(meta.icon), addedAt: this.now() };
      list.push(item); await this.kv.set(PKEYS.BLACKLIST, list);
      const m = (await this.kv.get<Record<string, Connection>>(PKEYS.CONNECTIONS)) ?? {};
      for (const o of Object.keys(m)) if (hostnameOf(o) === h) delete m[o];
      await this.kv.set(PKEYS.CONNECTIONS, m); return item;
    });
  }
  removeBlacklist(id: string): Promise<boolean> { return this.lock.run(async () => { const list = (await this.kv.get<BlacklistItem[]>(PKEYS.BLACKLIST)) ?? []; const next = list.filter((b) => b.id !== id); await this.kv.set(PKEYS.BLACKLIST, next); return next.length !== list.length; }); }

  // ---- tracked token approvals (approve() calls signed through Harbour; live allowance is verified on chain when listed)
  async approvals(): Promise<TrackedApproval[]> { return ((await this.kv.get<TrackedApproval[]>(PKEYS.APPROVALS)) ?? []).slice().sort((a, b) => b.at - a.at); }
  trackApproval(a: Omit<TrackedApproval, 'id' | 'at'>): Promise<TrackedApproval> {
    return this.lock.run(async () => {
      const list = (await this.kv.get<TrackedApproval[]>(PKEYS.APPROVALS)) ?? [];
      const same = (x: TrackedApproval) => x.chainId === a.chainId && x.token.toLowerCase() === a.token.toLowerCase() && x.spender.toLowerCase() === a.spender.toLowerCase() && x.owner.toLowerCase() === a.owner.toLowerCase();
      const rest = list.filter((x) => !same(x)); const item: TrackedApproval = { ...a, id: newId(), at: this.now() }; rest.push(item);
      await this.kv.set(PKEYS.APPROVALS, rest.slice(-MAX_APPROVALS)); return item;
    });
  }
  untrackApproval(id: string): Promise<void> { return this.lock.run(async () => { const list = (await this.kv.get<TrackedApproval[]>(PKEYS.APPROVALS)) ?? []; await this.kv.set(PKEYS.APPROVALS, list.filter((x) => x.id !== id)); }); }

  async prefs(): Promise<ProviderPrefs> { return { ...DEFAULT_PREFS, ...((await this.kv.get<ProviderPrefs>(PKEYS.PREFS)) ?? {}) }; }
  async setPrefs(p: Partial<ProviderPrefs>): Promise<ProviderPrefs> { const next = { ...(await this.prefs()), ...(typeof p.defaultWallet === 'boolean' ? { defaultWallet: p.defaultWallet } : {}) }; await this.kv.set(PKEYS.PREFS, next); return next; }
}

// ------------------------------------------------------------------ pending requests (survive service-worker restarts: stored in storage.session)
export type PendingKind = 'connect' | 'permissions' | 'sign' | 'typed' | 'tx' | 'switchChain' | 'addChain' | 'watchAsset' | 'solConnect' | 'solSignMessage' | 'solSignTx' | 'solSignAll' | 'solSignSend' | 'wcSession';
export interface PendingRequest {
  id: string;                 // internal id shown to the approval UI
  key: string;                // `${tabId}:${frameId}:${page request id}` — de-duplicates a content-script resend after a worker restart
  reqId: string; ns: Namespace; method: string; kind: PendingKind;
  params: any;                // normalised parameters (JSON-safe; bigints as hex strings)
  origin: string; topOrigin: string; isTopFrame: boolean; tabId: number; frameId: number; documentId?: string;
  title?: string; icon?: string; createdAt: number; expiresAt: number;
  stage?: 'executing';      // durable claim: never replay signing/broadcast after an interrupted worker
  binding?: Pick<Connection, 'id' | 'walletId' | 'accountIndex' | 'chainId' | 'evmAddress' | 'solanaAddress'>;
  internal?: boolean;         // raised by the extension UI itself (e.g. revoke approval)
}
export type Outcome = { result: unknown } | { error: { code: number; message: string; data?: unknown } };
export const PENDING_TTL_MS = 15 * 60_000; export const SETTLED_TTL_MS = 5 * 60_000; export const MAX_PENDING_TOTAL = 25; export const MAX_PENDING_PER_ORIGIN = 5;

export class PendingStore {
  private lock = new Lock();
  constructor(private kv: KV, private now: () => number = Date.now) {}
  private async read(): Promise<Record<string, PendingRequest>> { return (await this.kv.get<Record<string, PendingRequest>>(PKEYS.PENDING)) ?? {}; }
  async list(): Promise<PendingRequest[]> { return Object.values(await this.read()).sort((a, b) => a.createdAt - b.createdAt); }
  async get(id: string): Promise<PendingRequest | undefined> { const m = await this.read(); return Object.prototype.hasOwnProperty.call(m, id) ? m[id] : undefined; }
  async findByKey(key: string): Promise<PendingRequest | undefined> { return (await this.list()).find((p) => p.key === key); }
  add(r: Omit<PendingRequest, 'id' | 'createdAt' | 'expiresAt'>): Promise<PendingRequest> {
    return this.lock.run(async () => { const m = await this.read(); const existing = Object.values(m).find((p) => p.key === r.key); if (existing) return existing; const t = this.now(); const p: PendingRequest = { ...r, id: newId(), createdAt: t, expiresAt: t + PENDING_TTL_MS }; m[p.id] = p; await this.kv.set(PKEYS.PENDING, m); return p; });
  }
  /** Persist execution ownership before any key access or network side effect. */
  claim(id: string): Promise<PendingRequest | undefined> {
    return this.lock.run(async () => { const m = await this.read(); const p = Object.prototype.hasOwnProperty.call(m, id) ? m[id] : undefined; if (!p || p.stage === 'executing') return undefined; p.stage = 'executing'; await this.kv.set(PKEYS.PENDING, m); return p; });
  }
  /** Atomically remove and return a request (so two concurrent resolutions can never both act on it). */
  take(id: string): Promise<PendingRequest | undefined> {
    return this.lock.run(async () => { const m = await this.read(); if (!Object.prototype.hasOwnProperty.call(m, id)) return undefined; const p = m[id]; delete m[id]; await this.kv.set(PKEYS.PENDING, m); return p; });
  }
  takeWhere(pred: (p: PendingRequest) => boolean): Promise<PendingRequest[]> {
    return this.lock.run(async () => { const m = await this.read(); const out: PendingRequest[] = []; for (const [k, p] of Object.entries(m)) if (p.stage !== 'executing' && pred(p)) { out.push(p); delete m[k]; } if (out.length) await this.kv.set(PKEYS.PENDING, m); return out; });
  }
  expired(): Promise<PendingRequest[]> { const t = this.now(); return this.takeWhere((p) => p.expiresAt <= t); }
  // settled outcomes waiting for a content script that has not reconnected yet
  putSettled(key: string, outcome: Outcome): Promise<void> {
    return this.lock.run(async () => { const m = (await this.kv.get<Record<string, { outcome: Outcome; at: number }>>(PKEYS.SETTLED)) ?? {}; const t = this.now();
      for (const [k, v] of Object.entries(m)) if (t - v.at > SETTLED_TTL_MS) delete m[k]; m[key] = { outcome, at: t }; await this.kv.set(PKEYS.SETTLED, m); });
  }
  takeSettled(key: string): Promise<Outcome | undefined> {
    return this.lock.run(async () => { const m = (await this.kv.get<Record<string, { outcome: Outcome; at: number }>>(PKEYS.SETTLED)) ?? {}; const v = Object.prototype.hasOwnProperty.call(m, key) ? m[key] : undefined; if (!v) return undefined; if (this.now() - v.at > SETTLED_TTL_MS) { delete m[key]; await this.kv.set(PKEYS.SETTLED, m); return undefined; } return v.outcome; });
  }
}
