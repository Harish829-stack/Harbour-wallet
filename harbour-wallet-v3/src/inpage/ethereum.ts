// EIP-1193 provider (window.ethereum / window.trustwallet). Trust Wallet parity notes: evidences/re-evidence/12-dapp-provider (EthereumAdapter + request switch).
import { Emitter, ProviderRpcError } from './emitter';
import type { Bridge, BridgeEvent } from './bridge';
import type { InitState } from '../core/provider/protocol';

const STATIC = new Set(['eth_chainId', 'net_version', 'eth_accounts', 'eth_coinbase']);
export class HarbourEthereum extends Emitter {
  readonly isHarbour = true;
  isTrust = true; isTrustWallet = true; isMetaMask = false;   // Trust Wallet's flags, kept so dApps that special-case Trust keep working
  chainId: string | null = null; networkVersion: string | null = null; selectedAddress: string | null = null;
  private accounts: string[] = [];
  private connected = false;
  constructor(private bridge: Bridge) {
    super();
    for (const k of ['request', 'enable', 'send', 'sendAsync', 'isConnected', 'getChainId', 'getNetworkVersion', 'getAddress'] as const) (this as any)[k] = (this as any)[k].bind(this);
    bridge.onInit((s, first) => this.apply(s, first));
    bridge.onEvent((e) => this.onEvent(e));
  }
  private apply(s: InitState, first: boolean) {
    const prevAccounts = this.accounts.join(','), prevChain = this.chainId;
    this.chainId = s.evm.chainId; this.networkVersion = s.evm.networkVersion; this.accounts = s.evm.accounts.slice(); this.selectedAddress = this.accounts[0] ?? null;
    const wasConnected = this.connected; this.connected = s.evm.connected;
    if (first) { if (this.connected) setTimeout(() => this.emit('connect', { chainId: this.chainId }), 0); return; }
    if (!wasConnected && this.connected) this.emit('connect', { chainId: this.chainId });
    if (wasConnected && !this.connected) this.emit('disconnect', new ProviderRpcError(4900, 'Harbour is disconnected.'));
    if (prevChain !== this.chainId) { this.emit('chainChanged', this.chainId); this.emit('networkChanged', this.networkVersion); }
    if (prevAccounts !== this.accounts.join(',')) this.emit('accountsChanged', this.accounts.slice());
  }
  private onEvent(e: BridgeEvent) {
    if (e.ns !== 'evm') return;
    switch (e.name) {
      case 'accountsChanged': this.accounts = Array.isArray(e.data) ? (e.data as string[]).filter((x) => typeof x === 'string') : []; this.selectedAddress = this.accounts[0] ?? null; this.emit('accountsChanged', this.accounts.slice()); break;
      case 'chainChanged': if (typeof e.data === 'string') { this.chainId = e.data; this.networkVersion = String(parseInt(e.data, 16)); this.emit('chainChanged', this.chainId); } break;
      case 'networkChanged': this.emit('networkChanged', e.data); break;
      case 'connect': this.connected = true; this.emit('connect', e.data ?? { chainId: this.chainId }); break;
      case 'disconnect': { this.connected = false; const d: any = e.data ?? {}; this.emit('disconnect', new ProviderRpcError(Number(d.code) || 4900, String(d.message ?? 'Disconnected'))); break; }
    }
  }
  isConnected() { return this.connected; }
  getChainId() { return this.chainId; }
  getNetworkVersion() { return this.networkVersion; }
  getAddress() { return this.selectedAddress; }
  async request(args: { method: string; params?: unknown }): Promise<any> {
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new ProviderRpcError(-32600, 'Expected a single, non-array, object argument.', args);
    const { method, params } = args;
    if (typeof method !== 'string' || method.length === 0) throw new ProviderRpcError(-32600, "'args.method' must be a non-empty string.", args);
    if (params !== undefined && !Array.isArray(params) && (typeof params !== 'object' || params === null)) throw new ProviderRpcError(-32600, "'args.params' must be an object or array if provided.", args);
    if (STATIC.has(method)) { await this.bridge.ready(); const r = this.staticResult(method); if (r !== undefined) return r; }
    if (method === 'eth_requestAccounts') { const a = await this.bridge.request('evm', method, params); if (Array.isArray(a)) { /* state arrives via events */ } return a; }
    return this.bridge.request('evm', method, params);
  }
  private staticResult(method: string): unknown {
    switch (method) {
      case 'eth_chainId': return this.chainId ?? undefined;
      case 'net_version': return this.networkVersion ?? undefined;
      case 'eth_accounts': return this.accounts.slice();
      case 'eth_coinbase': return this.accounts[0] ?? null;
    }
    return undefined;
  }
  enable() { return this.request({ method: 'eth_requestAccounts' }); }
  sendAsync(payload: any, cb: (err: any, res?: any) => void) {
    const one = (p: any) => this.request({ method: p?.method, params: p?.params }).then((result) => ({ id: p?.id ?? null, jsonrpc: '2.0', result }));
    if (Array.isArray(payload)) Promise.all(payload.map((p) => one(p).catch((e) => ({ id: p?.id ?? null, jsonrpc: '2.0', error: { code: e.code, message: e.message } })))).then((r) => cb(null, r), (e) => cb(e, undefined));
    else one(payload).then((r) => cb(null, r), (e) => cb(e, undefined));
  }
  send(a: any, b?: any): any {
    if (typeof a === 'string') return this.request({ method: a, params: b });
    if (typeof b === 'function') return this.sendAsync(a, b);
    // legacy synchronous form: only the values Harbour already knows
    if (a && STATIC.has(a.method)) { const r = this.staticResult(a.method); return { id: a.id ?? null, jsonrpc: '2.0', result: r ?? null }; }
    throw new ProviderRpcError(4200, `Harbour does not support calling ${a?.method} synchronously without a callback. Provide a callback to call it asynchronously.`);
  }
}
