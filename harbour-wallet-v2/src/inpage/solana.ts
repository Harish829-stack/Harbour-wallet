// Solana provider (window.trustwallet.solana / window.solana) + Wallet Standard registration.
// Trust Wallet parity: connect / disconnect / signMessage / signTransaction / signAllTransactions / signAndSendTransaction (evidence/12-dapp-provider, Solana adapter).
import { Emitter, ProviderRpcError } from './emitter';
import type { Bridge, BridgeEvent } from './bridge';
import { b58decode, b58encode, b64ToBytes, bytesToB64 } from '../core/provider/base58';
import { createSiwsMessage } from '../core/provider/siws';

/** Minimal PublicKey look-alike (dApps usually only call toBase58/toString/toBytes/equals). Signature slots are filled using the dApp's own PublicKey class, see attach(). */
export class SolPublicKey {
  private _b: Uint8Array;
  constructor(v: string | Uint8Array) { this._b = typeof v === 'string' ? b58decode(v) : Uint8Array.from(v); if (this._b.length !== 32) throw new Error('Invalid public key'); }
  toBase58() { return b58encode(this._b); } toString() { return this.toBase58(); } toJSON() { return this.toBase58(); }
  toBytes() { return Uint8Array.from(this._b); }
  toBuffer() { const B = (globalThis as any).Buffer; return B ? B.from(this._b) : this.toBytes(); }
  equals(o: any) { return !!o && typeof o.toBase58 === 'function' && o.toBase58() === this.toBase58(); }
}
const isVersioned = (tx: any) => tx && tx.message && typeof tx.version !== 'undefined' && typeof tx.serialize === 'function';
function serializeTx(tx: any): Uint8Array {
  if (tx instanceof Uint8Array) return tx;
  if (isVersioned(tx)) return tx.serialize();
  if (tx && typeof tx.serialize === 'function') return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  throw new ProviderRpcError(-32602, 'Unsupported transaction object.');
}
/** Put Harbour's signature into the dApp's own transaction object using the dApp's PublicKey class. */
function attach(tx: any, address: string, sig: Uint8Array) {
  if (tx instanceof Uint8Array) return tx;
  const proto = isVersioned(tx) ? tx.message?.staticAccountKeys?.[0] : (tx.feePayer ?? tx.signatures?.[0]?.publicKey);
  const PK = proto?.constructor; if (typeof PK !== 'function' || typeof tx.addSignature !== 'function') throw new ProviderRpcError(-32603, 'Could not apply the signature to this transaction object.');
  tx.addSignature(new PK(address), sig); return tx;
}
const toBytes = (m: unknown): Uint8Array => { if (m instanceof Uint8Array) return m; if (m instanceof ArrayBuffer) return new Uint8Array(m); if (Array.isArray(m)) return Uint8Array.from(m as number[]); throw new ProviderRpcError(-32602, 'Message must be a Uint8Array.'); };

export class HarbourSolana extends Emitter {
  readonly isHarbour = true; isTrust = true; isTrustWallet = true; isPhantom = false;
  publicKey: SolPublicKey | null = null; isConnected = false;
  constructor(private bridge: Bridge) {
    super();
    for (const k of ['connect', 'disconnect', 'signMessage', 'signTransaction', 'signAllTransactions', 'signAndSendTransaction'] as const) (this as any)[k] = (this as any)[k].bind(this);
    bridge.onInit((s) => { if (s.solana.publicKey && !this.publicKey) this.setKey(s.solana.publicKey, false); if (!s.solana.publicKey && this.publicKey) this.clear(); });
    bridge.onEvent((e) => this.onEvent(e));
  }
  private setKey(addr: string, emit: boolean) { this.publicKey = new SolPublicKey(addr); this.isConnected = true; if (emit) { this.emit('connect', this.publicKey); this.emit('accountChanged', this.publicKey); } }
  private clear() { const had = !!this.publicKey; this.publicKey = null; this.isConnected = false; if (had) this.emit('disconnect'); }
  private onEvent(e: BridgeEvent) {
    if (e.ns !== 'solana') return;
    if (e.name === 'connect') { const pk = (e.data as any)?.publicKey; if (typeof pk === 'string') this.setKey(pk, true); }
    else if (e.name === 'disconnect') this.clear();
  }
  async connect(opts?: { onlyIfTrusted?: boolean }) {
    const r = await this.bridge.request('solana', 'connect', opts && typeof opts === 'object' ? { onlyIfTrusted: opts.onlyIfTrusted === true } : {});
    if (!r || typeof r.publicKey !== 'string') throw new ProviderRpcError(-32603, 'Invalid connect response.');
    this.setKey(r.publicKey, false); this.emit('connect', this.publicKey); return { publicKey: this.publicKey! };
  }
  async disconnect() { await this.bridge.request('solana', 'disconnect'); this.clear(); }
  async signMessage(message: Uint8Array, _display?: string) {
    const r = await this.bridge.request('solana', 'signMessage', { message: bytesToB64(toBytes(message)) });
    return { signature: b64ToBytes(r.signature), publicKey: this.publicKey ?? new SolPublicKey(r.publicKey) };
  }
  private async signOne(tx: any, method: 'signTransaction' | 'signAndSendTransaction', options?: unknown) {
    const r = await this.bridge.request('solana', method, { transaction: bytesToB64(serializeTx(tx)), ...(options ? { options } : {}) });
    return r;
  }
  async signTransaction(tx: any) { const r = await this.signOne(tx, 'signTransaction'); if (tx instanceof Uint8Array) return b64ToBytes(r.signedTransaction); return attach(tx, r.publicKey, b58decode(r.signature)); }
  async signAllTransactions(txs: any[]) {
    if (!Array.isArray(txs)) throw new ProviderRpcError(-32602, 'Expected an array of transactions.');
    const r = await this.bridge.request('solana', 'signAllTransactions', { transactions: txs.map((t) => bytesToB64(serializeTx(t))) });
    return txs.map((t, i) => (t instanceof Uint8Array ? b64ToBytes(r.transactions[i].signedTransaction) : attach(t, r.publicKey, b58decode(r.transactions[i].signature))));
  }
  async signAndSendTransaction(tx: any, options?: { skipPreflight?: boolean; maxRetries?: number }) { const r = await this.signOne(tx, 'signAndSendTransaction', options); return { signature: r.signature as string }; }
  /** Raw bytes in / raw bytes out (used by the Wallet Standard features). */
  async signTransactionBytes(bytes: Uint8Array) { const r = await this.signOne(bytes, 'signTransaction'); return b64ToBytes(r.signedTransaction); }
}

// ---------------------------------------------------------------- Wallet Standard
const ICON = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="#0b6e5f"/><path d="M48 18a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm-3 20h6v24c10-1 17-8 18-16h-8l12-14 12 14h-8c-1 17-14 30-28 30S22 63 21 46h-8l12-14 12 14h-8c1 8 8 15 18 16V38z" fill="#fff" transform="translate(0,-2) scale(.96) translate(2,3)"/></svg>');
export const HARBOUR_ICON = ICON;
export function registerWalletStandard(p: HarbourSolana) {
  const chains = ['solana:mainnet', 'solana:devnet', 'solana:testnet'] as const;
  const feats = ['standard:connect', 'standard:disconnect', 'standard:events', 'solana:signIn', 'solana:signMessage', 'solana:signTransaction', 'solana:signAndSendTransaction'] as const;
  const listeners = new Set<(c: { accounts?: unknown[] }) => void>();
  const account = () => (p.publicKey ? [Object.freeze({ address: p.publicKey.toBase58(), publicKey: p.publicKey.toBytes(), chains: [...chains], features: [...feats] })] : []);
  p.on('connect', () => listeners.forEach((l) => l({ accounts: account() }))); p.on('disconnect', () => listeners.forEach((l) => l({ accounts: account() })));
  const versions = ['legacy', 0] as const;
  const wallet = {
    version: '1.0.0' as const, name: 'Harbour', icon: ICON as `data:image/svg+xml;base64,${string}`, chains,
    get accounts() { return account(); },
    features: {
      'standard:connect': { version: '1.0.0', connect: async (input?: { silent?: boolean }) => { if (input?.silent && !p.publicKey) { try { await p.connect({ onlyIfTrusted: true }); } catch { /* not trusted */ } } else if (!p.publicKey) await p.connect(); return { accounts: account() }; } },
      'standard:disconnect': { version: '1.0.0', disconnect: () => p.disconnect() },
      'standard:events': { version: '1.0.0', on: (ev: string, l: (c: { accounts?: unknown[] }) => void) => { if (ev !== 'change') return () => {}; listeners.add(l); return () => listeners.delete(l); } },
      'solana:signIn': { version: '1.0.0', signIn: async (...inputs: Array<Record<string, any>>) => {
        const out = [];
        for (const i of inputs.length ? inputs : [{}]) {
          if (!p.publicKey) await p.connect(); const address = p.publicKey!.toBase58();
          if (i.address && i.address !== address) throw new ProviderRpcError(-32602, 'The requested account is not the connected account.');
          const text = createSiwsMessage({ domain: String(i.domain ?? location.host), address, statement: i.statement, uri: i.uri ?? location.origin, version: i.version ?? '1', chainId: i.chainId, nonce: i.nonce, issuedAt: i.issuedAt ?? new Date().toISOString(), expirationTime: i.expirationTime, notBefore: i.notBefore, requestId: i.requestId, resources: i.resources });
          const bytes = new TextEncoder().encode(text); const r = await p.signMessage(bytes);
          out.push({ account: account()[0], signedMessage: bytes, signature: r.signature, signatureType: 'ed25519' as const });
        }
        return out;
      } },
      'solana:signMessage': { version: '1.1.0', signMessage: async (...inputs: Array<{ message: Uint8Array }>) => { const out = []; for (const i of inputs) { const r = await p.signMessage(i.message); out.push({ signedMessage: i.message, signature: r.signature }); } return out; } },
      'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: versions, signTransaction: async (...inputs: Array<{ transaction: Uint8Array }>) => { const out = []; for (const i of inputs) out.push({ signedTransaction: await p.signTransactionBytes(i.transaction) }); return out; } },
      'solana:signAndSendTransaction': { version: '1.0.0', supportedTransactionVersions: versions, signAndSendTransaction: async (...inputs: Array<{ transaction: Uint8Array; options?: any }>) => { const out = []; for (const i of inputs) { const r = await p.signAndSendTransaction(i.transaction, i.options); out.push({ signature: b58decode(r.signature) }); } return out; } },
    },
  };
  const callback = (api: { register(...w: unknown[]): unknown }) => { try { api.register(wallet); } catch (e) { console.error('[harbour] wallet-standard register failed', e); } };
  try { const ev = new Event('wallet-standard:register-wallet', { bubbles: false, cancelable: false, composed: false }); Object.defineProperty(ev, 'detail', { value: callback }); window.dispatchEvent(ev); } catch { /* not supported */ }
  try { window.addEventListener('wallet-standard:app-ready', (e: any) => callback(e.detail)); } catch { /* not supported */ }
  return wallet;
}
