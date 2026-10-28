// Minimal Node-style event emitter (the page-facing provider API: on / once / off / removeListener / emit / removeAllListeners ...).
type Fn = (...args: any[]) => void;
export class Emitter {
  private _l: Record<string, Fn[]> = Object.create(null);
  on(e: string, f: Fn) { (this._l[e] ??= []).push(f); return this; }
  addListener(e: string, f: Fn) { return this.on(e, f); }
  prependListener(e: string, f: Fn) { (this._l[e] ??= []).unshift(f); return this; }
  once(e: string, f: Fn) { const w: Fn = (...a) => { this.off(e, w); f(...a); }; (w as any)._orig = f; return this.on(e, w); }
  off(e: string, f: Fn) { const l = this._l[e]; if (l) this._l[e] = l.filter((x) => x !== f && (x as any)._orig !== f); return this; }
  removeListener(e: string, f: Fn) { return this.off(e, f); }
  removeAllListeners(e?: string) { if (e) delete this._l[e]; else this._l = Object.create(null); return this; }
  emit(e: string, ...a: any[]) { const l = this._l[e]; if (!l || !l.length) return false; for (const f of l.slice()) { try { f(...a); } catch (err) { setTimeout(() => { throw err; }); } } return true; }
  listenerCount(e: string) { return this._l[e]?.length ?? 0; }
  listeners(e: string) { return (this._l[e] ?? []).slice(); }
  eventNames() { return Object.keys(this._l); }
  setMaxListeners() { return this; }
}
export class ProviderRpcError extends Error {
  code: number; data?: unknown;
  constructor(code: number, message: string, data?: unknown) { super(message); this.name = 'ProviderRpcError'; this.code = code; if (data !== undefined) this.data = data; }
}
