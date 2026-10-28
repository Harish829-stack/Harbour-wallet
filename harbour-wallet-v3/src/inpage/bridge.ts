// Page side of the bridge. The inpage script talks to the content script over a private MessageChannel (handshake via one window.postMessage),
// so responses are never broadcast to other scripts on the page. The content script forwards only allowlisted, validated requests.
import type { InitState, Namespace } from '../core/provider/protocol';
import { ProviderRpcError } from './emitter';

type Pending = { resolve(v: any): void; reject(e: any): void };
export type BridgeEvent = { ns: Namespace; name: string; data?: unknown };
const HELLO = 'HARBOUR_INPAGE_HELLO';

export class Bridge {
  private port: MessagePort | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private initWaiters: Array<(s: InitState) => void> = [];
  state: InitState | null = null;
  /** Accounts connected in THIS page before the next state refresh arrives (the refresh is asynchronous, a connect() must be usable straight away). */
  private multiLocal: Record<string, { address: string; publicKey: string; at: number }> = {};
  multi(chain: string): { address: string; publicKey: string } | undefined { const s = this.state?.multi?.[chain]; if (s) return s; const l = this.multiLocal[chain]; return l && Date.now() - l.at < 5000 ? l : undefined; }
  private listeners = new Set<(e: BridgeEvent) => void>(); private initListeners = new Set<(s: InitState, first: boolean) => void>();
  private rid = Math.random().toString(36).slice(2, 10);

  constructor() { this.hello(); }
  private hello() {
    // The content script may load after this script: keep offering fresh channels (a transferred port cannot be re-sent) until one is acknowledged.
    let tries = 0; let done = false;
    // Per-load nonce: the content script must echo it in its ack, so a script that merely replays/forges a handshake cannot take over the channel.
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
    const target = location.origin && location.origin !== 'null' ? location.origin : '*';
    const attempt = () => {
      if (done || ++tries > 200) { clearInterval(timer); return; }
      const ch = new MessageChannel();
      ch.port1.onmessage = (ev) => {
        const m = ev.data;
        if (done) { if (this.port === ch.port1) this.onMessage(m); return; }
        if (m && typeof m === 'object' && m.t === 'ack' && m.nonce === nonce) { done = true; this.port = ch.port1; clearInterval(timer); }
      };
      try { window.postMessage({ type: HELLO, v: 1, nonce }, target, [ch.port2]); } catch { /* retry on the next tick */ }
    };
    const timer: any = setInterval(attempt, 50); attempt();
  }
  private onMessage(m: any) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'res' && typeof m.id === 'string') { const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); if (m.error) p.reject(new ProviderRpcError(Number(m.error.code) || -32603, String(m.error.message ?? 'Request failed'), m.error.data)); else p.resolve(m.result); }
    else if (m.t === 'evt' && typeof m.name === 'string') for (const f of this.listeners) f({ ns: m.ns, name: m.name, data: m.data });
    else if (m.t === 'init' && m.state) { const first = !this.state; this.state = m.state; for (const w of this.initWaiters.splice(0)) w(m.state); for (const f of this.initListeners) f(m.state, first); }
    else if (m.t === 'fatal') {
      if (this.state) this.state.evm.connected = false;
      for (const f of this.listeners) f({ ns: 'evm', name: 'disconnect', data: { code: 4900, message: String(m.message ?? 'Harbour is unavailable. Refresh the page.') } });
      for (const [id, p] of this.pending) { p.reject(new ProviderRpcError(4900, String(m.message ?? 'Harbour is unavailable. Refresh the page.'))); this.pending.delete(id); }
    }
  }
  onEvent(f: (e: BridgeEvent) => void) { this.listeners.add(f); }
  onInit(f: (s: InitState, first: boolean) => void) { this.initListeners.add(f); if (this.state) f(this.state, true); }
  /** Resolves once the content script has delivered the initial wallet state for this origin (or rejects after `ms`). */
  ready(ms = 8000): Promise<InitState> {
    if (this.state) return Promise.resolve(this.state);
    return new Promise((res, rej) => { const t = setTimeout(() => rej(new ProviderRpcError(4900, 'Harbour is not reachable. Refresh the page or check that the extension is enabled.')), ms); this.initWaiters.push((s) => { clearTimeout(t); res(s); }); });
  }
  async request(ns: Namespace, method: string, params?: unknown): Promise<any> {
    await this.ready();
    const id = `h${this.rid}${(++this.seq).toString(36)}`;
    const track = (r: any) => { if (ns !== 'multi' || !params || typeof (params as any).chain !== 'string') return r; const chain = (params as any).chain as string; if (method === 'connect' && r && typeof r.publicKey === 'string') this.multiLocal[chain] = { address: String(r.friendly ?? r.address), publicKey: r.publicKey, at: Date.now() }; else if (method === 'disconnect') delete this.multiLocal[chain]; return r; };
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve: (r) => resolve(track(r)), reject }); try { this.port!.postMessage({ t: 'req', id, ns, method, ...(params !== undefined ? { params } : {}) }); } catch (e) { this.pending.delete(id); reject(new ProviderRpcError(-32603, 'Could not reach Harbour.')); } });
  }
}
