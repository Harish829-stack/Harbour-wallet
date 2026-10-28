// WalletConnect v2 bridge: relays WalletKit events into the dApp provider (ProviderService) so a WalletConnect session gets exactly the same
// validation, approval window, signing and permission checks as an injected dApp. Transport (WalletKit) is injected: no relay needed in tests.
import type { Outcome, PermissionStore } from '../../core/provider/store';
import type { PageRequest, SenderInfo } from '../../core/provider/protocol';
import { ERR, serializeError } from '../../core/provider/errors';
import { mapRequest, mapResult, originOfMetadata, parseWcUri, sanitizeText, summarizeProposal, WC_ERR, type SupportedNamespace } from '../../core/walletconnect';
import type { ProviderService, WcHost } from '../provider/service';

export const WC_TAB = -1;                       // synthetic tab id: replies for these requests go to the relay, not a content script
export const SESSIONS_KEY = 'harbour:wc:sessions';
export const PROJECT_ID_KEY = 'harbour:wc:projectId';
export interface WcSessionRecord { topic: string; origin: string; name: string; url: string; icon?: string; chains: string[]; methods: string[]; connectedAt: number; expiry?: number }

/** The subset of @reown/walletkit this bridge uses. */
export interface KitLike {
  on(event: string, cb: (e: any) => void): unknown;
  pair(a: { uri: string }): Promise<unknown>;
  approveSession(a: { id: number; namespaces: Record<string, SupportedNamespace> }): Promise<{ topic: string; expiry?: number; peer?: any }>;
  rejectSession(a: { id: number; reason: { code: number; message: string } }): Promise<unknown>;
  respondSessionRequest(a: { topic: string; response: { id: number; jsonrpc: '2.0'; result?: unknown; error?: { code: number; message: string } } }): Promise<unknown>;
  disconnectSession(a: { topic: string; reason: { code: number; message: string } }): Promise<unknown>;
  getActiveSessions(): Record<string, any>;
  updateSession(a: { topic: string; namespaces: Record<string, any> }): Promise<unknown>;
  emitSessionEvent(a: { topic: string; event: { name: string; data: unknown }; chainId: string }): Promise<unknown>;
  rejectSessionAuthenticate?(a: { id: number; reason: { code: number; message: string } }): Promise<unknown>;
}
export interface KV { get<T>(k: string): Promise<T | undefined>; set(k: string, v: unknown): Promise<void> }
export interface BridgeDeps {
  kv: KV; perms: PermissionStore; service(): ProviderService;
  createKit(projectId: string): Promise<KitLike>;
  projectId(): Promise<string | null>;
  networks: { get(chainId: number): unknown };
  disconnectOrigin(origin: string): Promise<void>;
  now?: () => number;
}

const userRejected = { code: WC_ERR.USER_REJECTED, message: 'User rejected.' };
type Verify = { origin?: string; validation?: string; isScam?: boolean } | null;
const verifyOf = (e: any): Verify => { const v = e?.verifyContext?.verified; return v ? { origin: typeof v.origin === 'string' ? v.origin.slice(0, 200) : undefined, validation: typeof v.validation === 'string' ? v.validation : undefined, isScam: v.isScam === true } : null; };

export class WalletConnectBridge {
  private kit: KitLike | null = null; private starting: Promise<KitLike | null> | null = null;
  private now: () => number;
  constructor(private d: BridgeDeps) { this.now = d.now ?? Date.now; }

  // ---------------------------------------------------------------- state
  async configured(): Promise<boolean> { return !!(await this.d.projectId()); }
  async sessions(): Promise<WcSessionRecord[]> {
    const idx = (await this.d.kv.get<Record<string, WcSessionRecord>>(SESSIONS_KEY)) ?? {}; const t = Math.floor(this.now() / 1000);
    return Object.values(idx).filter((s) => !s.expiry || s.expiry > t).sort((a, b) => b.connectedAt - a.connectedAt);
  }
  private async putSession(r: WcSessionRecord) { const idx = (await this.d.kv.get<Record<string, WcSessionRecord>>(SESSIONS_KEY)) ?? {}; idx[r.topic] = r; await this.d.kv.set(SESSIONS_KEY, idx); }
  private async dropSession(topic: string): Promise<WcSessionRecord | undefined> { const idx = (await this.d.kv.get<Record<string, WcSessionRecord>>(SESSIONS_KEY)) ?? {}; const r = idx[topic]; delete idx[topic]; await this.d.kv.set(SESSIONS_KEY, idx); return r; }

  // ---------------------------------------------------------------- lifecycle
  /** Start the relay client (idempotent). Returns null when no project ID is configured. */
  ensure(): Promise<KitLike | null> {
    if (this.kit) return Promise.resolve(this.kit);
    this.starting ??= (async () => {
      const id = await this.d.projectId(); if (!id) return null;
      const kit = await this.d.createKit(id); this.attach(kit); this.kit = kit; return kit;
    })().finally(() => { this.starting = null; });
    return this.starting;
  }
  /** Service-worker wake-up: reconnect to the relay only when there is something to listen for. */
  async resume(): Promise<void> { if ((await this.sessions()).length) await this.ensure().catch(() => null); }
  private attach(kit: KitLike) {
    kit.on('session_proposal', (e) => { void this.onProposal(e).catch(() => {}); });
    kit.on('session_request', (e) => { void this.onRequest(e).catch(() => {}); });
    kit.on('session_delete', (e) => { void this.onDelete(String(e?.topic ?? '')).catch(() => {}); });
    kit.on('session_authenticate', (e) => { void kit.rejectSessionAuthenticate?.({ id: e?.id, reason: { code: WC_ERR.UNSUPPORTED_METHODS, message: 'Harbour does not support WalletConnect authenticate requests.' } }).catch(() => {}); });
  }

  // ---------------------------------------------------------------- pairing (user pastes / scans a wc: link)
  async pair(rawUri: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const u = parseWcUri(rawUri, Math.floor(this.now() / 1000)); if (!u.ok) return u;
    if (!(await this.configured())) return { ok: false, error: 'WalletConnect needs a project ID. Add one first.' };
    const kit = await this.ensure().catch(() => null); if (!kit) return { ok: false, error: 'Could not start WalletConnect.' };
    try { await kit.pair({ uri: rawUri.trim() }); return { ok: true }; }
    catch (e) { return { ok: false, error: String((e as any)?.message ?? 'Could not pair with this site.').slice(0, 200) }; }
  }

  // ---------------------------------------------------------------- proposals
  private async onProposal(e: any) {
    const kit = this.kit!; const id = Number(e?.id); const p = e?.params; if (!Number.isInteger(id) || !p) return;
    const reject = (code: number, message: string) => kit.rejectSession({ id, reason: { code, message } }).catch(() => {});
    const meta = p.proposer?.metadata ?? {}; const origin = originOfMetadata(meta.url);
    if (!origin) return void (await reject(WC_ERR.USER_REJECTED, 'The site did not provide a valid https:// address.'));
    if (await this.d.perms.isBlacklisted(origin)) return void (await reject(WC_ERR.USER_REJECTED, 'This site is blocked in Harbour.'));
    // The dApp's URL is self-declared. Never let an unverified proposal borrow the identity (and saved permission) of a site already connected,
    // and never prompt for a site the relay's Verify API flags as malicious.
    const verify = verifyOf(e);
    if (verify?.isScam) return void (await reject(WC_ERR.USER_REJECTED, 'This site was flagged as malicious.'));
    if (verify?.validation !== 'VALID' && (await this.d.perms.get(origin))) return void (await reject(WC_ERR.USER_REJECTED, 'A site with this address is already connected to Harbour and WalletConnect could not verify this request. Disconnect the site first.'));
    const icon = Array.isArray(meta.icons) ? meta.icons.find((i: unknown) => typeof i === 'string' && /^https:\/\//.test(i)) : undefined;
    const sender: SenderInfo = { tabId: WC_TAB, frameId: 0, documentId: `wc:proposal`, origin, topOrigin: origin, isTopFrame: true, title: sanitizeText(meta.name, 80) || undefined, icon };
    const proposal = { requiredNamespaces: p.requiredNamespaces ?? {}, optionalNamespaces: p.optionalNamespaces ?? {} };
    try { await this.d.service().queueWcSession(sender, id, { proposal, summary: summarizeProposal(proposal), verify, description: sanitizeText(meta.description, 200), declaredUrl: sanitizeText(meta.url, 200) }); }
    catch (err) { await reject(WC_ERR.USER_REJECTED, serializeError(err).message); }
  }
  /** Called by ProviderService when the user approves: send the session to the relay and index it. */
  readonly host: WcHost = {
    approve: async (proposalId, namespaces, meta) => {
      const kit = await this.ensure(); if (!kit) throw new Error('WalletConnect is not configured.');
      const s = await kit.approveSession({ id: proposalId, namespaces });
      const peer = s.peer?.metadata ?? {};
      await this.putSession({ topic: s.topic, origin: meta.origin, name: sanitizeText(peer.name, 80) || meta.title || meta.origin, url: sanitizeText(peer.url, 200), icon: meta.icon, chains: meta.chains,
        methods: Array.from(new Set(Object.values(namespaces).flatMap((n) => n.methods))), connectedAt: this.now(), expiry: s.expiry });
      return s.topic;
    },
    reject: async (proposalId, code, message) => { const kit = this.kit ?? (await this.ensure()); await kit?.rejectSession({ id: proposalId, reason: { code, message } }); },
  };

  // ---------------------------------------------------------------- requests
  private async respond(topic: string, id: number, o: Outcome, kind?: 'message' | 'transaction') {
    const kit = this.kit ?? (await this.ensure()); if (!kit) return;
    const response = 'result' in o ? { id, jsonrpc: '2.0' as const, result: mapResult(kind ?? shapeKind(o.result), o.result) }
      : { id, jsonrpc: '2.0' as const, error: { code: o.error.code === ERR.USER_REJECTED ? WC_ERR.USER_REJECTED : o.error.code, message: o.error.message } };
    await kit.respondSessionRequest({ topic, response }).catch(() => {});
  }
  private async onRequest(e: any) {
    const topic = String(e?.topic ?? ''); const id = Number(e?.id); if (!topic || !Number.isInteger(id)) return;
    const fail = (code: number, message: string) => this.respond(topic, id, { error: { code, message } });
    const rec = (await this.sessions()).find((s) => s.topic === topic); if (!rec) return fail(ERR.UNAUTHORIZED, 'This session is no longer connected in Harbour.');
    const mapped = mapRequest({ chainId: String(e?.params?.chainId ?? ''), request: e?.params?.request ?? { method: '' } }, rec.chains, rec.methods);
    if (!mapped.ok) return fail(mapped.code, mapped.message);
    const conn = await this.d.perms.get(rec.origin); if (!conn || !conn.namespaces.includes(mapped.ns)) return fail(ERR.UNAUTHORIZED, 'The connection was removed in Harbour.');
    if (mapped.ns === 'evm' && mapped.chainId != null) {
      if (!this.d.networks.get(mapped.chainId)) return fail(ERR.UNRECOGNIZED_CHAIN, 'This network is not available in Harbour.');
      // WalletConnect carries the target chain on every request; the router binds to the connection's chain.
      if (conn.chainId !== mapped.chainId) await this.d.perms.update(rec.origin, { chainId: mapped.chainId });
    }
    const sender: SenderInfo = { tabId: WC_TAB, frameId: 0, documentId: `wc:${topic}`, origin: rec.origin, topOrigin: rec.origin, isTopFrame: true, title: rec.name, icon: rec.icon };
    const req: PageRequest = { id: String(id), ns: mapped.ns, method: mapped.method, params: mapped.params as any };
    const r = await this.d.service().handle(sender, req);
    if (r.done) await this.respond(topic, id, r.outcome, mapped.solana);
  }
  /** ProviderService settled a request raised by this bridge (user decision, expiry, window closed). */
  async deliver(documentId: string | undefined, reqId: string, outcome: Outcome): Promise<boolean> {
    if (!documentId?.startsWith('wc:')) return false;
    if (reqId.startsWith('proposal:')) {
      if ('error' in outcome) { const kit = this.kit ?? (await this.ensure()); await kit?.rejectSession({ id: Number(reqId.slice(9)), reason: userRejected }).catch(() => {}); }
      return true;
    }
    const topic = documentId.slice(3); const id = Number(reqId); if (!topic || !Number.isInteger(id)) return false;
    await this.respond(topic, id, outcome); return true;
  }

  // ---------------------------------------------------------------- network changes
  /**
   * The wallet moved this site to another EVM network (silent switch, auto-switch, Connection details). A WalletConnect dApp only learns of it through
   * the relay: add the chain to the session when it is new (updateSession is append-only), then emit `chainChanged`.
   */
  async onChainChanged(origin: string, chainId: number): Promise<void> {
    const recs = (await this.sessions()).filter((x) => x.origin === origin); if (!recs.length || !Number.isSafeInteger(chainId) || chainId <= 0) return;
    const kit = this.kit ?? (await this.ensure().catch(() => null)); if (!kit) return;
    const caip = `eip155:${chainId}`;
    for (const rec of recs) {
      try {
        const ns = kit.getActiveSessions()[rec.topic]?.namespaces?.eip155; if (!ns) continue;                  // the session has no EVM namespace
        const accounts: string[] = Array.isArray(ns.accounts) ? ns.accounts : [];
        const chains: string[] = Array.isArray(ns.chains) && ns.chains.length ? ns.chains : Array.from(new Set(accounts.map((a) => a.split(':').slice(0, 2).join(':'))));
        if (!chains.includes(caip)) {
          const address = accounts[0]?.split(':')[2]; if (!address) continue;
          const live = kit.getActiveSessions()[rec.topic].namespaces;
          await kit.updateSession({ topic: rec.topic, namespaces: { ...live, eip155: { ...ns, chains: [...chains, caip], accounts: [...accounts, `${caip}:${address}`] } } });
          rec.chains = Array.from(new Set([...rec.chains, caip])); await this.putSession(rec);
        }
        if ((ns.events ?? []).includes('chainChanged')) await kit.emitSessionEvent({ topic: rec.topic, event: { name: 'chainChanged', data: chainId }, chainId: caip });
      } catch { /* dApp offline or it refused the update: its next request will name the chain it wants */ }
    }
  }

  // ---------------------------------------------------------------- ending sessions
  async disconnect(topic: string): Promise<void> {
    const rec = await this.dropSession(topic); const kit = this.kit ?? (await this.ensure().catch(() => null));
    await kit?.disconnectSession({ topic, reason: { code: 6000, message: 'User disconnected.' } }).catch(() => {});
    if (rec && !(await this.sessions()).some((s) => s.origin === rec.origin)) await this.d.disconnectOrigin(rec.origin).catch(() => {});
  }
  /** The user removed the site in Settings > Connections: end every WalletConnect session for that origin too. */
  async onOriginDisconnected(origin: string): Promise<void> {
    for (const s of (await this.sessions()).filter((x) => x.origin === origin)) {
      await this.dropSession(s.topic); const kit = this.kit ?? (await this.ensure().catch(() => null));
      await kit?.disconnectSession({ topic: s.topic, reason: { code: 6000, message: 'User disconnected.' } }).catch(() => {});
    }
  }
  private async onDelete(topic: string) {
    const rec = await this.dropSession(topic);
    if (rec && !(await this.sessions()).some((s) => s.origin === rec.origin)) await this.d.disconnectOrigin(rec.origin).catch(() => {});
  }
}
function shapeKind(r: any): 'message' | 'transaction' | undefined {
  if (r && typeof r === 'object' && typeof r.signedTransaction === 'string') return 'transaction';
  if (r && typeof r === 'object' && typeof r.signature === 'string' && typeof r.publicKey === 'string') return 'message';
  return undefined;
}
