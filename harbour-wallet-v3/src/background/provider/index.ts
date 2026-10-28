import { logError } from '../../core/logger';
// Provider wiring inside the service worker: content-script ports (one per frame), event fan-out, approval window, inpage registration.
// This listener is separate from the internal wallet router (background/index.ts): ports named `harbour-provider` can only reach ProviderService.
import browser from 'webextension-polyfill';
import { local, session, KEYS } from '../../core/storage';
import { VaultService } from '../../core/vaultService';
import { WalletService } from '../../core/walletService';
import { getCore } from '../../core/walletCore';
import { ERR, ProviderError, serializeError } from '../../core/provider/errors';
import { isAllowedEvent, parsePageRequest, senderKey, type Namespace, type OutMessage, type SenderInfo } from '../../core/provider/protocol';
import { BLOCKED_DOMAINS, normalizeOrigin } from '../../core/provider/origin';
import { PendingStore, PermissionStore, PKEYS, type Outcome } from '../../core/provider/store';
import { getNetworkState, setNetworkState, customNetwork } from '../../core/networkRegistry';
import { probeRpcChainId } from '../../core/networks';
import { solanaRpcUrl } from '../../core/rpc';
import { readTokens, sanitizeToken, upsertToken } from '../../core/customTokens';
import { activeEntry } from '../walletState';
import { evmNetwork, evmNetworks } from './networks';
import { makeRpc } from './rpc';
import { createSigner } from './signer';
import { multiBackend } from './multiBuild';
import { ProviderService, type DeliverTarget } from './service';
import type { ViewDeps } from './view';
import { ApprovalWindow } from './approvalWindow';
import { loadSettings } from '../settingsService';
import { WalletConnectBridge, WC_TAB, SESSIONS_KEY } from '../walletconnect/bridge';
import { createKit, readProjectId } from '../walletconnect/kit';

export const PORT_NAME = 'harbour-provider';
export const GC_ALARM = 'harbour-provider-gc';
const INPAGE_ID = 'harbour-inpage';
const CONTENT_ID = 'harbour-content';
const MATCHES = ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'];
export const EXCLUDE_MATCHES = [...BLOCKED_DOMAINS.map((d) => `*://*.${d}/*`), '*://*.recaptcha.net/recaptcha/*', '*://www.google.com/recaptcha/*', '*://*.hcaptcha.com/*', '*://*.challenges.cloudflare.com/*', '*://*.captcha-delivery.com/*', '*://*.arkoselabs.com/*', '*://*.funcaptcha.com/*', '*://*.doubleclick.net/*', '*://*.googlesyndication.com/*', '*://*.amazon-adsystem.com/*', '*://*.magic.link/*'];

interface Live { port: chrome.runtime.Port; sender: SenderInfo }
const live = new Map<string, Live>();   // `${tabId}:${frameId}`
const liveKey = (t: { tabId: number; frameId: number }) => `${t.tabId}:${t.frameId}`;

const kvLocal = { get: <T,>(k: string) => local.get<T>(k), set: (k: string, v: unknown) => local.set(k, v), remove: (k: string) => local.remove(k) };
const kvSession = { get: <T,>(k: string) => session.get<T>(k), set: (k: string, v: unknown) => session.set(k, v), remove: (k: string) => session.remove(k) };
export const perms = new PermissionStore(kvLocal);
export const pending = new PendingStore(kvSession);
export const approvalUrl = () => browser.runtime.getURL('src/popup/index.html') + '#/notification';
const approvalWindow = new ApprovalWindow({
  create: (o) => chrome.windows.create(o) as any, get: (id) => chrome.windows.get(id) as any, update: (id, o) => chrome.windows.update(id, o), remove: (id) => chrome.windows.remove(id), getLastFocused: () => chrome.windows.getLastFocused() as any,
}, kvSession, pending, approvalUrl());

let ctxCache: { vault: VaultService; wallet: WalletService } | null = null;
async function ctx() { if (!ctxCache) { const core = await getCore(); ctxCache = { vault: new VaultService(core), wallet: new WalletService(core) }; } return ctxCache; }
// The signer needs vault/wallet synchronously per call; they are created on first use (core is initialised by then).
const signer = createSigner(() => { if (!ctxCache) throw new ProviderError(ERR.INTERNAL, 'Wallet core is not ready.'); return ctxCache; });
const ensureCtx = async () => { await ctx(); };

const networksReady: Promise<void> = local.get<any>(KEYS.NETWORKS).then((n) => { if (n) setNetworkState(n); }).catch(() => {});

export const rpc = makeRpc();
// WalletConnect v2 (Harbour-side equivalent; Trust Wallet 26.41.0 ships no pairing/session client — see evidences/re-evidence/16-walletconnect).
export const wc = new WalletConnectBridge({
  kv: kvLocal, perms, service: () => getProvider(), createKit, projectId: readProjectId,
  networks: { get: (id) => evmNetwork(id) }, disconnectOrigin: (o) => disconnectOrigin(o),
});
const WC_ALARM = 'harbour-wc-keepalive';
/** Reconnect to the relay after a worker restart and keep it alive while sessions exist (alarms wake the worker; WebSocket traffic extends it). */
export function initWalletConnectBackground(): void {
  void wc.resume();
  chrome.alarms.get(WC_ALARM).then((a) => { if (!a) void chrome.alarms.create(WC_ALARM, { periodInMinutes: 0.5 }); }).catch(() => {});
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === WC_ALARM) void wc.resume(); });
}
void SESSIONS_KEY;
let service: ProviderService | null = null;
export function getProvider(): ProviderService {
  if (service) return service;
  service = new ProviderService({
    perms, pending, signer: wrapSigner(), rpc: (c, m, p) => networksReady.then(() => rpc(c, m, p)), solRpc,
    networks: { list: () => evmNetworks(), get: (id) => evmNetwork(id) },
    vaultStatus: async () => { await ensureCtx(); const v = ctxCache!.vault; return { hasVault: await v.exists(), unlocked: await v.isUnlocked() }; },
    openApproval: () => approvalWindow.open(), closeApprovalIfIdle: () => approvalWindow.closeIfIdle(),
    deliver, emit, wc: wc.host, multi: multiBackend,
    ethSignEnabled: async () => (await loadSettings()).developerSettings.isEthSignEnabled === true,
    probeChainId: async (url) => { const r = await probeRpcChainId(url, fetch, { fromSite: true }); if (!r.ok) throw new Error(r.error); return r.chainId; },
    saveCustomNetwork: async (n) => {
      // A second approval may have added this ID while the first RPC probe ran.
      if (evmNetwork(n.chainId)) return;
      const st = getNetworkState(); const prev = customNetwork(n.chainId);
      setNetworkState({ ...st, custom: [...st.custom.filter((x) => x.chainId !== n.chainId), { ...n, addedAt: prev?.addedAt ?? Date.now() }].sort((a, b) => a.addedAt - b.addedAt) });
      await local.set(KEYS.NETWORKS, getNetworkState());
    },
    addToken: async ({ walletId, ...t }) => {
      try {
        await ensureCtx(); const vault = ctxCache!.vault; const clean = sanitizeToken({ ...t, manual: false }); if (!clean.ok) return { ok: false, error: clean.error };
        const st: any = await vault.getState(); const w = st.wallets?.[walletId] ?? activeEntry(st)?.[1]; if (!w) return { ok: false, error: 'No wallet found' };
        const res = upsertToken(readTokens(w.customTokens), clean.token); if ('error' in res) return { ok: false, error: res.error };
        w.customTokens = res.list; await vault.persist(st); return { ok: true };
      } catch (e: any) { return { ok: false, error: e?.message ?? 'Could not add the token' }; }
    },
    version: (() => { try { return browser.runtime.getManifest().version; } catch { return '0'; } })(),
  });
  return service;
}
function wrapSigner() {
  const w = async <T,>(f: () => Promise<T>) => { await ensureCtx(); return f(); };
  return {
    accounts: () => w(() => signer.accounts()), accountOf: (a: string, b: number) => w(() => signer.accountOf(a, b)),
    signMessage: (...a: Parameters<typeof signer.signMessage>) => w(() => signer.signMessage(...a)), signTypedData: (...a: Parameters<typeof signer.signTypedData>) => w(() => signer.signTypedData(...a)),
    sendTransaction: (...a: Parameters<typeof signer.sendTransaction>) => w(() => signer.sendTransaction(...a)), solSign: (...a: Parameters<typeof signer.solSign>) => w(() => signer.solSign(...a)),
    multiKey: (...a: Parameters<typeof signer.multiKey>) => w(() => signer.multiKey(...a)), multiSign: (...a: Parameters<typeof signer.multiSign>) => w(() => signer.multiSign(...a)),
  };
}
async function solRpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(solanaRpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20_000), credentials: 'omit' });
  const j: any = await res.json(); if (j?.error) throw new ProviderError(ERR.INTERNAL, String(j.error.message ?? 'Solana RPC error').slice(0, 300)); return j?.result;
}

// ---------------------------------------------------------------- ports
const send = (port: chrome.runtime.Port, m: OutMessage) => { try { port.postMessage(m); return true; } catch { return false; } };
async function deliver(t: DeliverTarget, reqId: string, outcome: Outcome): Promise<boolean> {
  if (t.tabId === WC_TAB) return wc.deliver(t.documentId, reqId, outcome);
  const l = live.get(liveKey(t)); if (!l) return false;
  if (t.documentId && l.sender.documentId && t.documentId !== l.sender.documentId) return false;
  return send(l.port, { t: 'res', id: reqId, ...('result' in outcome ? { result: outcome.result } : { error: outcome.error }) });
}
function emit(origin: string, ns: Namespace, name: string, data?: unknown) {
  if (!isAllowedEvent(ns, name)) return;
  for (const l of live.values()) if (l.sender.origin === origin) send(l.port, { t: 'evt', ns, name, data });
  // WalletConnect sessions have no page port: the relay carries chainChanged (and adds the chain to the session first when needed).
  if (ns === 'evm' && name === 'chainChanged' && typeof data === 'string') { try { void wc.onChainChanged(origin, Number(BigInt(data))).catch(() => {}); } catch { /* malformed id */ } }
}
/** Settings > Connections: the user moved a site to another network. */
export function announceChain(origin: string, chainId: number): void {
  const hex = `0x${chainId.toString(16)}`; emit(origin, 'evm', 'chainChanged', hex); emit(origin, 'evm', 'networkChanged', String(chainId));
}
function senderOf(port: chrome.runtime.Port): SenderInfo | null {
  const sd = port.sender; if (!sd || sd.id !== browser.runtime.id || !sd.tab || typeof sd.tab.id !== 'number' || typeof sd.frameId !== 'number') return null;
  if ((sd.url ?? '').startsWith('chrome-extension://') || (sd.url ?? '').startsWith('moz-extension://')) return null;
  const origin = normalizeOrigin((sd as any).origin ?? sd.url); if (!origin) return null;
  const topOrigin = normalizeOrigin(sd.tab.url) ?? origin;
  const icon = typeof sd.tab.favIconUrl === 'string' && /^https?:\/\//.test(sd.tab.favIconUrl) ? sd.tab.favIconUrl : undefined;
  return { tabId: sd.tab.id, frameId: sd.frameId, documentId: (sd as any).documentId, origin, topOrigin, isTopFrame: sd.frameId === 0, title: typeof sd.tab.title === 'string' ? sd.tab.title.slice(0, 120) : undefined, icon, incognito: !!sd.tab.incognito };
}
function onConnect(port: chrome.runtime.Port) {
  if (port.name !== PORT_NAME) return;
  const s = senderOf(port);
  if (!s) {   // untrusted/opaque frame: keep the channel open but answer every request with 4100 (disconnecting would make the content script retry forever)
    port.onMessage.addListener((m: any) => { const id = typeof m?.id === 'string' ? m.id.slice(0, 64) : null; if (id) send(port, { t: 'res', id, error: { code: ERR.UNAUTHORIZED, message: 'This frame cannot use the Harbour provider.' } }); });
    return;
  }
  const k = liveKey(s); live.set(k, { port, sender: s });
  void getProvider().initState(s.origin).then((state) => send(port, { t: 'init', state })).catch(() => {});
  port.onMessage.addListener((m: unknown) => { void onPageMessage(port, s, m); });
  port.onDisconnect.addListener(() => { void chrome.runtime.lastError; if (live.get(k)?.port === port) live.delete(k); void getProvider().dropFor(s.tabId, s.frameId, s.documentId); });
}
async function onPageMessage(port: chrome.runtime.Port, s: SenderInfo, raw: unknown) {
  const parsed = parsePageRequest(raw);
  if (!parsed.ok) { if (parsed.id) send(port, { t: 'res', id: parsed.id, error: serializeError(parsed.error) }); return; }
  const svc = getProvider(); const req = parsed.req;
  try {
    await networksReady;
    const settled = await svc.takeSettled(senderKey(s, req.id));
    if (settled) { send(port, { t: 'res', id: req.id, ...('result' in settled ? { result: settled.result } : { error: settled.error }) }); return; }
    const r = await svc.handle(s, req);
    if (r.done) send(port, { t: 'res', id: req.id, ...('result' in r.outcome ? { result: r.outcome.result } : { error: r.outcome.error }) });
  } catch (e) { send(port, { t: 'res', id: req.id, error: serializeError(e) }); }
}

// ---------------------------------------------------------------- inpage registration (TW: scripting.registerContentScripts, world MAIN, document_start)
export async function registerInpage(): Promise<void> {
  const script: any = { id: INPAGE_ID, js: ['inpage.js'], matches: MATCHES, excludeMatches: EXCLUDE_MATCHES, runAt: 'document_start', world: 'MAIN', allFrames: true, persistAcrossSessions: true };
  try { await chrome.scripting.registerContentScripts([script]); }
  catch (e: any) { if (!/duplicate script id/i.test(String(e?.message))) { logError('inpage registration failed', e); return; } try { await chrome.scripting.updateContentScripts([script]); } catch (e2) { logError('inpage update failed', e2); } }
}

async function registerContentBridge(): Promise<void> {
  const script: any = { id: CONTENT_ID, js: ['public-content.js'], matches: MATCHES, excludeMatches: EXCLUDE_MATCHES, runAt: 'document_start', allFrames: true, persistAcrossSessions: true };
  try { await chrome.scripting.registerContentScripts([script]); }
  catch (e: any) {
    if (!/duplicate script id/i.test(String(e?.message))) { logError('content registration failed', e); return; }
    try { await chrome.scripting.updateContentScripts([script]); } catch (e2) { logError('content update failed', e2); }
  }
}

export function initProviderBackground(): void {
  browser.runtime.onConnect.addListener(onConnect as any);
  browser.runtime.onInstalled.addListener(() => { void registerInpage(); void registerContentBridge(); });
  void registerInpage(); void registerContentBridge();
  browser.tabs.onRemoved.addListener((tabId) => { void getProvider().dropFor(tabId, null); });
  browser.windows.onRemoved.addListener(async (id) => { if (await approvalWindow.handleRemoved(id)) await getProvider().rejectWhere((p) => !p.internal); });
  try { void chrome.alarms.create(GC_ALARM, { periodInMinutes: 1 }); } catch { /* alarms unavailable */ }
  browser.alarms.onAlarm.addListener((a) => { if (a.name === GC_ALARM) void getProvider().gc(); });
  // Permissions and vault state can change in any extension surface (including the auto-lock alarm).
  // Refresh only public provider state; never forward storage values or session key material to the page.
  browser.storage.onChanged.addListener((changes, area) => {
    const relevant = area === 'session' ? KEYS.UNLOCK in changes : area === 'local' &&
      [PKEYS.CONNECTIONS, PKEYS.BLACKLIST, PKEYS.PREFS, KEYS.VAULT].some((key) => key in changes);
    if (!relevant) return;
    for (const entry of live.values()) void getProvider().initState(entry.sender.origin)
      .then((state) => { if (live.get(liveKey(entry.sender)) === entry) send(entry.port, { t: 'init', state }); })
      .catch(() => {});
  });
}
/** Used by the approval UI handlers. */
export { approvalWindow };
/** Disconnect a site from the settings UI and tell its open pages. */
export async function disconnectOrigin(origin: string, ns?: Namespace): Promise<void> {
  if (!ns) void wc.onOriginDisconnected(origin).catch(() => {});
  const c = await perms.disconnect(origin, ns); if (!c) return;
  const spaces: Namespace[] = ns ? [ns] : c.namespaces;
  for (const n of spaces) { if (n === 'evm') { emit(origin, 'evm', 'accountsChanged', []); emit(origin, 'evm', 'disconnect', { code: ERR.DISCONNECTED, message: 'Disconnected by the user.' }); } else emit(origin, n, 'disconnect'); }
}

export function viewDeps(): ViewDeps {
  const svc = getProvider();
  return { perms, rpc: (c, m, p) => networksReady.then(() => rpc(c, m, p)), networks: { list: () => evmNetworks(), get: (id) => evmNetwork(id) }, signer: wrapSigner(), kv: kvSession, tokenMeta: (c, a) => svc.tokenMeta(c, a), solRpc,
    probeChainId: async (url) => { const r = await probeRpcChainId(url); if (!r.ok) throw new Error(r.error); return r.chainId; } };
}
export { signer as rawSigner, wrapSigner, ensureCtx };
