// Page-side providers for the non-EVM, non-Solana families (namespace 'multi'): Keplr-style Cosmos, Sui (Wallet Standard), Aptos (Petra-style window.aptos),
// TronLink-style Tron and Bitcoin (account + message signing). Each is a thin translator: it validates the shape of what the dApp passed and forwards
// plain JSON to the background; keys, approval and signature packaging live in the background (core/provider/multi.ts).
import { Emitter, ProviderRpcError } from './emitter';
import type { Bridge, BridgeEvent } from './bridge';
import { chainOfCosmosId, MULTI_CHAINS } from '../core/provider/multiChains';
import { b64ToBytes, bytesToB64 } from '../core/provider/base58';

type Acct = { address: string; publicKey: string };
const unhex = (h: string) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return o; };
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const toBytes = (m: unknown): Uint8Array => { if (m instanceof Uint8Array) return m; if (m instanceof ArrayBuffer) return new Uint8Array(m); if (Array.isArray(m)) return Uint8Array.from(m as number[]); throw new ProviderRpcError(-32602, 'Expected bytes.'); };

class Base extends Emitter {
  constructor(protected bridge: Bridge, private chains: string[]) {
    super();
    bridge.onEvent((e: BridgeEvent) => { if (e.ns === 'multi') this.onEvt(e); });
  }
  protected acct(chain: string): Acct | undefined { return this.bridge.multi(chain); }
  protected call(chain: string, method: string, extra: Record<string, unknown> = {}) { return this.bridge.request('multi', method, { chain, ...extra }); }
  protected async connect(chain: string, onlyIfTrusted = false): Promise<Acct> { return (await this.call(chain, 'connect', onlyIfTrusted ? { onlyIfTrusted: true } : {})) as Acct; }
  protected onEvt(_e: BridgeEvent) { /* subclasses */ }
  protected owns(chain: unknown) { return typeof chain === 'string' && this.chains.includes(chain); }
}

// ---------------------------------------------------------------- Cosmos (Keplr API subset)
export class HarbourKeplr extends Base {
  readonly isHarbour = true; version = '0.12.0'; mode = 'extension' as const;
  constructor(bridge: Bridge) {
    super(bridge, Object.keys(MULTI_CHAINS).filter((k) => MULTI_CHAINS[k].family === 'cosmos'));
    for (const k of ['enable', 'disable', 'getKey', 'signAmino', 'signDirect', 'signArbitrary', 'getOfflineSigner', 'getOfflineSignerOnlyAmino', 'getOfflineSignerAuto', 'experimentalSuggestChain', 'sendTx', 'getEnigmaUtils'] as const) (this as any)[k] = (this as any)[k].bind(this);
  }
  private chain(chainId: string): string { const c = chainOfCosmosId(chainId); if (!c) throw new Error(`Harbour does not support the chain ${String(chainId).slice(0, 40)}.`); return c; }
  async enable(chainIds: string | string[]) { for (const id of Array.isArray(chainIds) ? chainIds : [chainIds]) await this.connect(this.chain(id)); }
  async disable(chainIds?: string | string[]) { for (const id of chainIds ? (Array.isArray(chainIds) ? chainIds : [chainIds]) : []) await this.call(this.chain(id), 'disconnect'); }
  async getKey(chainId: string) {
    const chain = this.chain(chainId); const a = this.acct(chain) ?? (await this.connect(chain)); const pub = unhex(a.publicKey);
    return { name: 'Harbour', algo: 'secp256k1', pubKey: pub, address: bech32Bytes(a.address), bech32Address: a.address, isNanoLedger: false, isKeystone: false, ethereumHexAddress: '' };
  }
  async signAmino(chainId: string, signer: string, signDoc: any, _opts?: unknown) { return this.call(this.chain(chainId), 'signAmino', { chainId, signer, signDoc }); }
  async signDirect(chainId: string, signer: string, signDoc: { bodyBytes?: Uint8Array | null; authInfoBytes?: Uint8Array | null; chainId?: string | null; accountNumber?: { toString(): string } | null }, _opts?: unknown) {
    const r: any = await this.call(this.chain(chainId), 'signDirect', { chainId, signer, bodyBytes: bytesToB64(toBytes(signDoc.bodyBytes)), authInfoBytes: bytesToB64(toBytes(signDoc.authInfoBytes)), accountNumber: String(signDoc.accountNumber ?? '0') });
    // Hand back the dApp's own doc shape (bytes + the accountNumber object it gave us) so its protobuf code keeps working.
    return { signed: { bodyBytes: toBytes(signDoc.bodyBytes), authInfoBytes: toBytes(signDoc.authInfoBytes), chainId: r.signed.chainId, accountNumber: signDoc.accountNumber }, signature: r.signature };
  }
  async signArbitrary(chainId: string, signer: string, data: string | Uint8Array) {
    const r: any = await this.call(this.chain(chainId), 'signMessage', typeof data === 'string' ? { signer, data } : { signer, dataB64: bytesToB64(data) }); return r.signature;
  }
  private signerFor(chainId: string, amino: boolean) {
    const self = this; const get = async () => { const k = await self.getKey(chainId); return [{ address: k.bech32Address, algo: 'secp256k1', pubkey: k.pubKey }]; };
    return { getAccounts: get, signAmino: (s: string, d: any) => self.signAmino(chainId, s, d), ...(amino ? {} : { signDirect: (s: string, d: any) => self.signDirect(chainId, s, d) }) };
  }
  getOfflineSigner(chainId: string) { return this.signerFor(chainId, false); }
  getOfflineSignerOnlyAmino(chainId: string) { return this.signerFor(chainId, true); }
  async getOfflineSignerAuto(chainId: string) { return this.signerFor(chainId, false); }
  async experimentalSuggestChain() { throw new ProviderRpcError(4200, 'Harbour ships a fixed list of Cosmos chains; suggesting chains is not supported.'); }
  async sendTx() { throw new ProviderRpcError(4200, 'Broadcast the signed transaction with your own RPC.'); }
  getEnigmaUtils() { throw new ProviderRpcError(4200, 'Not supported.'); }
}
/** Keplr's getKey returns the 20-byte account address; derive it back from the bech32 string (data part, 5->8 bit regroup). */
function bech32Bytes(addr: string): Uint8Array {
  const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'; const data = addr.slice(addr.lastIndexOf('1') + 1, -6); const out: number[] = []; let acc = 0, bits = 0;
  for (const c of data) { const v = CH.indexOf(c); if (v < 0) return new Uint8Array(); acc = (acc << 5) | v; bits += 5; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); acc &= (1 << bits) - 1; } }
  return Uint8Array.from(out);
}

// ---------------------------------------------------------------- Sui (Wallet Standard). Transaction signing needs the Sui SDK to build bytes; not offered yet.
export function registerSuiWallet(bridge: Bridge, icon: string) {
  const chain = 'sui'; const listeners = new Set<(c: { accounts?: unknown[] }) => void>();
  const account = () => { const a = bridge.multi(chain); return a ? [Object.freeze({ address: a.address, publicKey: unhex(a.publicKey), chains: ['sui:mainnet', 'sui:testnet', 'sui:devnet'], features: ['sui:signPersonalMessage', 'sui:signTransaction', 'sui:signAndExecuteTransaction'] })] : []; };
  const notify = () => listeners.forEach((l) => l({ accounts: account() }));
  bridge.onInit(() => notify()); bridge.onEvent((e) => { if (e.ns === 'multi') notify(); });
  // The wallet (not the page) builds the final bytes: the page only sends the transaction's JSON; the background resolves objects, simulates and shows the result.
  const suiTx = async (method: string, transaction: { toJSON(): Promise<string> | string }, acct?: { address?: string }) => {
    const a = bridge.multi(chain); if (!a || (acct?.address && acct.address !== a.address)) throw new ProviderRpcError(4100, 'Account not connected.');
    const json = await transaction.toJSON(); if (typeof json !== 'string') throw new ProviderRpcError(-32602, 'Expected a serialisable transaction.');
    return bridge.request('multi', method, { chain, txJson: json });
  };
  const wallet = {
    version: '1.0.0' as const, name: 'Harbour', icon: icon as `data:image/svg+xml;base64,${string}`, chains: ['sui:mainnet'],
    get accounts() { return account(); },
    features: {
      'standard:connect': { version: '1.0.0', connect: async (input?: { silent?: boolean }) => { if (!account().length) await bridge.request('multi', 'connect', { chain, ...(input?.silent ? { onlyIfTrusted: true } : {}) }); await bridge.ready(); return { accounts: account() }; } },
      'standard:disconnect': { version: '1.0.0', disconnect: async () => { await bridge.request('multi', 'disconnect', { chain }); } },
      'standard:events': { version: '1.0.0', on: (ev: string, l: (c: { accounts?: unknown[] }) => void) => { if (ev !== 'change') return () => {}; listeners.add(l); return () => listeners.delete(l); } },
      'sui:signTransaction': { version: '2.0.0', signTransaction: async (input: { transaction: { toJSON(): Promise<string> | string }; account?: { address?: string } }) => suiTx('signTransaction', input.transaction, input.account) },
      'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction: async (input: { transaction: { toJSON(): Promise<string> | string }; account?: { address?: string } }) => suiTx('signAndSend', input.transaction, input.account) },
      'sui:signTransactionBlock': { version: '1.0.0', signTransactionBlock: async (input: { transactionBlock: { serialize(): string }; account?: { address?: string } }) => suiTx('signTransaction', { toJSON: () => input.transactionBlock.serialize() }, input.account) },
      'sui:signAndExecuteTransactionBlock': { version: '1.0.0', signAndExecuteTransactionBlock: async (input: { transactionBlock: { serialize(): string }; account?: { address?: string } }) => suiTx('signAndSend', { toJSON: () => input.transactionBlock.serialize() }, input.account) },
      'sui:signPersonalMessage': { version: '1.1.0', signPersonalMessage: async (input: { message: Uint8Array; account?: { address?: string } }) => {
        const a = bridge.multi(chain); if (!a || (input.account?.address && input.account.address !== a.address)) throw new ProviderRpcError(4100, 'Account not connected.');
        return bridge.request('multi', 'signMessage', { chain, messageB64: bytesToB64(toBytes(input.message)) });
      } },
    },
  };
  const callback = (api: { register(...w: unknown[]): unknown }) => { try { api.register(wallet); } catch (e) { console.error('[harbour] sui wallet register failed', e); } };
  try { const ev = new Event('wallet-standard:register-wallet', { bubbles: false, cancelable: false, composed: false }); Object.defineProperty(ev, 'detail', { value: callback }); window.dispatchEvent(ev); } catch { /* unsupported */ }
  try { window.addEventListener('wallet-standard:app-ready', (e: any) => callback(e.detail)); } catch { /* unsupported */ }
  return wallet;
}

// ---------------------------------------------------------------- Aptos (Petra-style window.aptos)
export class HarbourAptos extends Base {
  readonly isHarbour = true;
  constructor(bridge: Bridge) { super(bridge, ['aptos']); for (const k of ['connect', 'disconnect', 'isConnected', 'account', 'network', 'signMessage', 'signTransaction', 'signAndSubmitTransaction'] as const) (this as any)[k] = (this as any)[k].bind(this); }
  protected onEvt(e: BridgeEvent) { if (e.name === 'connect' && (e.data as any)?.chain === 'aptos') this.emit('accountChange', { address: (e.data as any).address, publicKey: '0x' + (e.data as any).publicKey }); else if (e.name === 'disconnect' && (e.data as any)?.chain === 'aptos') this.emit('disconnect'); }
  async connect() { const a = await this.connect_('aptos'); return a; }
  private async connect_(c: string) { const a = await super.connect(c); return { address: a.address, publicKey: '0x' + a.publicKey }; }
  async disconnect() { await this.call('aptos', 'disconnect'); }
  async isConnected() { await this.bridge.ready().catch(() => null); return !!this.acct('aptos'); }
  async account() { const a = this.acct('aptos'); if (!a) throw new ProviderRpcError(4100, 'Not connected.'); return { address: a.address, publicKey: '0x' + a.publicKey }; }
  async network() { return 'Mainnet'; }
  async signMessage(p: { message: string; nonce: string | number; address?: boolean; application?: boolean; chainId?: boolean }) {
    if (!p || typeof p.message !== 'string') throw new ProviderRpcError(-32602, 'message must be a string.');
    return this.call('aptos', 'signMessage', { message: p.message, nonce: String(p.nonce ?? ''), address: p.address === true, application: p.application === true, chainId: p.chainId === true, appName: location.host });
  }
  /** Petra-style: an entry-function payload ({ function, type_arguments, arguments }); Harbour builds, simulates, signs and submits. */
  async signAndSubmitTransaction(payload: any) {
    const p = payload?.payload && typeof payload.payload === 'object' ? payload.payload : payload;
    if (!p || typeof p.function !== 'string') throw new ProviderRpcError(-32602, 'Expected an entry function payload.');
    const r: any = await this.call('aptos', 'signAndSend', { payload: { function: p.function, type_arguments: p.type_arguments ?? p.typeArguments ?? [], arguments: p.arguments ?? p.functionArguments ?? [] } }); return { hash: r.hash };
  }
  /** Accepts an already-built RawTransaction (BCS bytes, or an object exposing bcsToBytes/rawTransaction.bcsToBytes). Returns the signed AccountAuthenticator. */
  async signTransaction(tx: any) {
    const raw: Uint8Array | null = tx instanceof Uint8Array ? tx : typeof tx?.bcsToBytes === 'function' ? tx.bcsToBytes() : typeof tx?.rawTransaction?.bcsToBytes === 'function' ? tx.rawTransaction.bcsToBytes() : null;
    if (!raw) throw new ProviderRpcError(4200, 'Harbour signs built Aptos transactions only (pass the RawTransaction).');
    const r: any = await this.call('aptos', 'signTransaction', { txB64: bytesToB64(raw) }); return b64ToBytes(r.authenticator);
  }
}

// ---------------------------------------------------------------- Tron (TronLink request API + minimal tronWeb)
export class HarbourTron extends Base {
  readonly isHarbour = true; ready = false;
  tronWeb: any = null;
  constructor(bridge: Bridge) {
    super(bridge, ['tron']); bridge.onInit(() => this.sync());
    for (const k of ['request'] as const) (this as any)[k] = (this as any)[k].bind(this);
  }
  private sync() { const a = this.acct('tron'); this.ready = !!a; this.tronWeb = a ? this.makeWeb(a.address) : null; }
  protected onEvt(e: BridgeEvent) { if ((e.data as any)?.chain === 'tron') { this.sync(); if (e.name === 'connect') window.postMessage({ message: { action: 'setAccount', data: { address: (e.data as any).address } }, isTronLink: true }, '*'); } }
  private makeWeb(address: string) {
    const self = this; const msg = (m: string, hexIn = false) => self.call('tron', 'signMessage', { message: m, hex: hexIn });
    return { defaultAddress: { base58: address, hex: '' }, ready: true,
      trx: { sign: (tx: any) => self.signTx(tx), signTransaction: (tx: any) => self.signTx(tx), signMessageV2: async (m: string) => msg(m), signMessage: async (m: string, hexIn?: boolean) => msg(m, hexIn === true) } };
  }
  private async signTx(tx: any) {
    if (!tx || typeof tx.txID !== 'string' || typeof tx.raw_data_hex !== 'string') throw new ProviderRpcError(-32602, 'Expected a Tron transaction with txID and raw_data_hex.');
    const sig = await this.call('tron', 'signTransaction', { txID: tx.txID, rawDataHex: tx.raw_data_hex }); return { ...tx, signature: [sig] };
  }
  async request(a: { method: string; params?: any }) {
    switch (a?.method) {
      case 'tron_requestAccounts': { const c = await this.connect('tron'); this.sync(); return { code: 200, message: 'ok', data: [c.address] }; }
      case 'tron_accounts': return this.acct('tron') ? [this.acct('tron')!.address] : [];
      default: throw new ProviderRpcError(4200, `Harbour does not support ${String(a?.method).slice(0, 40)}.`);
    }
  }
}

// ---------------------------------------------------------------- Bitcoin (account + message signing; PSBT signing is not available yet)
export class HarbourBitcoin extends Base {
  readonly isHarbour = true;
  constructor(bridge: Bridge) { super(bridge, ['bitcoin']); for (const k of ['requestAccounts', 'getAccounts', 'getPublicKey', 'signMessage', 'signPsbt', 'getNetwork', 'disconnect', 'pushPsbt'] as const) (this as any)[k] = (this as any)[k].bind(this); }
  async requestAccounts() { return [(await this.connect('bitcoin')).address]; }
  async getAccounts() { await this.bridge.ready().catch(() => null); const a = this.acct('bitcoin'); return a ? [a.address] : []; }
  async getPublicKey() { const a = this.acct('bitcoin') ?? (await this.connect('bitcoin')); return a.publicKey; }
  async getNetwork() { return 'livenet'; }
  async disconnect() { await this.call('bitcoin', 'disconnect'); }
  async signMessage(message: string, _type?: string) { if (typeof message !== 'string') throw new ProviderRpcError(-32602, 'message must be a string.'); return this.call('bitcoin', 'signMessage', { message }); }
  /** UniSat-style: PSBT as hex in, signed PSBT as hex out. Only P2WPKH inputs owned by the connected account are signed. */
  async signPsbt(psbtHex: string, opts?: { autoFinalized?: boolean; toSignInputs?: Array<{ index: number }> }) {
    if (typeof psbtHex !== 'string') throw new ProviderRpcError(-32602, 'Expected a PSBT as a hex string.');
    const r: any = await this.call('bitcoin', 'signPsbt', { psbt: psbtHex, autoFinalized: opts?.autoFinalized !== false, ...(opts?.toSignInputs ? { toSignInputs: opts.toSignInputs.map((x) => x.index) } : {}) }); return r.psbtHex as string;
  }
  async pushPsbt() { throw new ProviderRpcError(4200, 'Broadcast the finalised transaction with your own node.'); }
}

// ---------------------------------------------------------------- TON Connect (injected JS bridge: window.harbourTon.tonconnect)
export class HarbourTon extends Base {
  readonly isHarbour = true; private cbs = new Set<(e: any) => void>(); private evId = 0;
  readonly tonconnect: any;
  constructor(bridge: Bridge, icon: string) {
    super(bridge, ['ton']);
    const self = this;
    this.tonconnect = {
      deviceInfo: { platform: 'browser', appName: 'Harbour', appVersion: '1', maxProtocolVersion: 2, features: ['SendTransaction', { name: 'SendTransaction', maxMessages: 4 }] },
      walletInfo: { name: 'Harbour', app_name: 'harbour', image: icon, about_url: '', platforms: ['chrome'] },
      protocolVersion: 2, isWalletBrowser: false,
      connect: (_v: number, req?: { items?: Array<{ name: string; payload?: string }> }) => self.doConnect(req, false),
      restoreConnection: () => self.doConnect(undefined, true),
      send: (m: { method: string; params?: unknown[]; id: string }) => self.doSend(m),
      listen: (cb: (e: any) => void) => { self.cbs.add(cb); return () => self.cbs.delete(cb); },
    };
  }
  protected onEvt(e: BridgeEvent) { if ((e.data as any)?.chain === 'ton' && e.name === 'disconnect') this.fire({ event: 'disconnect', id: ++this.evId, payload: {} }); }
  private fire(e: any) { for (const f of this.cbs) { try { f(e); } catch { /* listener failed */ } } }
  private async doConnect(req: { items?: Array<{ name: string; payload?: string }> } | undefined, silent: boolean) {
    const id = ++this.evId;
    try {
      const proof = req?.items?.find((i) => i?.name === 'ton_proof');
      const r: any = await this.call('ton', 'connect', { ...(silent ? { onlyIfTrusted: true } : {}), ...(proof ? { proofPayload: String(proof.payload ?? '') } : {}) });
      const items: any[] = [{ name: 'ton_addr', address: r.address, network: '-239', publicKey: r.publicKey, walletStateInit: r.walletStateInit }];
      if (r.proof) items.push({ name: 'ton_proof', proof: { timestamp: r.proof.timestamp, domain: { lengthBytes: new TextEncoder().encode(r.proof.domain).length, value: r.proof.domain }, payload: r.proof.payload, signature: r.proof.signature } });
      const ev = { event: 'connect', id, payload: { items, device: this.tonconnect.deviceInfo } }; this.fire(ev); return ev;
    } catch (e: any) { const ev = { event: 'connect_error', id, payload: { code: e?.code === 4001 ? 300 : 0, message: String(e?.message ?? 'Connection failed').slice(0, 200) } }; return ev; }
  }
  private async doSend(m: { method: string; params?: unknown[]; id: string }) {
    try {
      if (m?.method === 'disconnect') { await this.call('ton', 'disconnect'); return { result: {}, id: m.id }; }
      if (m?.method !== 'sendTransaction') return { error: { code: 400, message: `Method ${String(m?.method).slice(0, 40)} is not supported.` }, id: m?.id };
      const r: any = await this.call('ton', 'sendTransaction', { txJson: m.params?.[0] }); return { result: r.boc, id: m.id };
    } catch (e: any) { return { error: { code: e?.code === 4001 ? 300 : 1, message: String(e?.message ?? 'Request failed').slice(0, 200) }, id: m?.id }; }
  }
}
void hex;
