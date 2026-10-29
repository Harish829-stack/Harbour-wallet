import { isPrivateNetworkUrl } from '../../core/provider/origin';
import { BUILD_PROVIDER_POLICY, DEFAULT_EVM_CHAIN, type ProviderPolicy } from '../../core/harbour/policy';
// The dApp provider's brain: request router (allowlist -> permission checks -> approval queue) and approval resolution.
// Everything environment-specific (storage, signing, RPC, windows, ports) is injected so the whole flow is unit-testable with fakes.
import { ERR, ProviderError, serializeError } from '../../core/provider/errors';
import type { InitState, Namespace, PageRequest, SenderInfo } from '../../core/provider/protocol';
import { senderKey } from '../../core/provider/protocol';
import { EVM_METHODS, UNSUPPORTED_EVM, isHexData, normalizeAddChain, normalizeEthSign, normalizePersonalSign, normalizeSendTx, normalizeSolMessage, normalizeSolTx, normalizeSwitchChain, normalizeTypedData, normalizeWatchAsset, parseChainIdHex, sameAddress, specFor, toHexQuantity, type TxRequest, hexToBytes, bytesToHex } from '../../core/provider/methods';
import { MAX_PENDING_PER_ORIGIN, MAX_PENDING_TOTAL, type Connection, type Outcome, type PendingKind, type PendingRequest, type PendingStore, type PermissionStore } from '../../core/provider/store';
import { RateLimiter } from '../../core/provider/ratelimit';
import { b58encode, b64ToBytes, bytesToB64 } from '../../core/provider/base58';
import { decodeCalldata, decodeString, isUnlimited, lowerApproveAmount, SEL } from '../../core/provider/decode';
import { parseSolTx, signerSlot, withSignature } from '../../core/provider/solanaTx';
import { evmRecover, sha3, type SignMode, type TypedDataLike } from '../../core/provider/evmSign';
import { validateNetwork, normalizeUrl } from '../../core/networks';
import { customNetworks } from '../../core/networkRegistry';
import type { EvmNetwork } from './networks';
import type { RpcCall } from './rpc';
import type { FeeValues } from './fees';
import type { AccountEntry, ConnRef, WalletAccounts } from './wallet';
import { negotiate, type SupportedNamespace } from '../../core/walletconnect';
import { tonProofHash } from './tonProof';
import { applySignatures, decodePsbt, planPsbtSigning, psbtToB64, psbtToHex } from '../../core/provider/psbt';
import { isMultiChain, normalizeMultiSign, signPlan, MULTI_CHAINS, type Scheme, type MultiRequest } from '../../core/provider/multi';

export interface Signer {
  accounts(): Promise<WalletAccounts | null>;
  accountOf(walletId: string, index: number): Promise<AccountEntry | null>;
  signMessage(c: ConnRef, bytesHex: string, mode: SignMode): Promise<string>;
  signTypedData(c: ConnRef, td: TypedDataLike): Promise<string>;
  sendTransaction(c: ConnRef, net: EvmNetwork, tx: TxRequest, opts: { gas?: bigint; fee?: FeeValues }): Promise<string>;
  solSign(c: ConnRef, messages: Uint8Array[]): Promise<Uint8Array[]>;
  /** Address + public key of a non-EVM chain account (used at connect time, before a connection exists). */
  multiKey(c: ConnRef, chain: string): Promise<{ address: string; publicKey: Uint8Array }>;
  multiSign(c: ConnRef, chain: string, scheme: Scheme, data: Uint8Array): Promise<Uint8Array>;
}
export interface DeliverTarget { tabId: number; frameId: number; documentId?: string }
export interface ServiceDeps {
  perms: PermissionStore; pending: PendingStore; signer: Signer; rpc: RpcCall; solRpc(method: string, params: unknown[]): Promise<any>;
  networks: { list(): EvmNetwork[]; get(chainId: number): EvmNetwork | undefined };
  /** What this build may sign (core/harbour/policy.ts). Defaults to the shipped build policy; tests pass a wider one. */
  policy?: ProviderPolicy;
  vaultStatus(): Promise<{ hasVault: boolean; unlocked: boolean }>;
  openApproval(): Promise<void>; closeApprovalIfIdle(): Promise<void>;
  deliver(t: DeliverTarget, reqId: string, outcome: Outcome): Promise<boolean>;
  emit(origin: string, ns: Namespace, name: string, data?: unknown): void;
  probeChainId(rpcUrl: string): Promise<number>;                                     // asks a node for eth_chainId
  saveCustomNetwork(n: { chainId: number; name: string; rpcUrl: string; symbol: string; explorerUrl?: string }): Promise<void>;
  addToken(t: { walletId: string; chainId: number; address: string; name: string; symbol: string; decimals: number }): Promise<{ ok: boolean; error?: string }>;
  /** WalletConnect transport (optional: absent in unit tests that do not exercise it). */
  wc?: WcHost;
  /** Sui / Aptos / TON SDK backend (optional: absent in unit tests that do not exercise it). */
  multi?: MultiBackend;
  /** Developer setting "Allow eth_sign requests" (off unless the user turned it on). Absent = off. */
  ethSignEnabled?: () => Promise<boolean>;
  now?: () => number; version?: string;
}
export interface TonMsg { address: string; friendly: string; amount: string; payload?: string; stateInit?: string; bounce: boolean }
/** Chain-SDK work for Sui / Aptos / TON (real implementation: ./multiBuild.ts; injected so the router stays unit-testable). */
export interface MultiBackend {
  sui?: { build(json: string, sender: string): Promise<{ bytes: Uint8Array; detail: Record<string, string> }>; execute(bytes: Uint8Array, signatureB64: string): Promise<unknown> };
  aptos?: { build(payload: any, sender: string, pub: Uint8Array): Promise<{ bytes: Uint8Array; detail: Record<string, string> }>; submit(raw: Uint8Array, pub: Uint8Array, sig: Uint8Array): Promise<{ hash: string }> };
  ton?: {
    identity(pub: Uint8Array): Promise<{ friendly: string; raw: string; hash: Uint8Array; workchain: number; stateInit: string }>;
    sameAddress(a: string, b: string): Promise<boolean>;
    normalize(raw: unknown): Promise<{ messages: TonMsg[]; validUntil: number }>;
    send(pub: Uint8Array, messages: TonMsg[], validUntil: number, signHash: (h: Uint8Array) => Promise<Uint8Array>): Promise<string>;
  };
}
export interface WcHost {
  approve(proposalId: number, namespaces: Record<string, SupportedNamespace>, meta: { origin: string; title?: string; icon?: string; chains: string[] }): Promise<string>;
  reject(proposalId: number, code: number, message: string): Promise<void>;
}
export type HandleResult = { done: true; outcome: Outcome } | { done: false };
export interface Decision { approve: boolean; accountIndex?: number; chainId?: number; gasLimit?: string; feeLevel?: 'safe' | 'average' | 'fast'; fee?: { maxFeePerGas?: string; maxPriorityFeePerGas?: string; gasPrice?: string }; allowanceLimit?: string }

const hex = (n: number) => '0x' + n.toString(16);
const ok = (result: unknown): HandleResult => ({ done: true, outcome: { result } });
const fail = (e: unknown): HandleResult => ({ done: true, outcome: { error: serializeError(e) } });
export const DEFAULT_CHAIN = DEFAULT_EVM_CHAIN; // Harbour v3: the first network the backend serves (was 1, which this build does not offer)
const KIND_OF: Record<string, PendingKind> = { connect: 'connect', permissionsRequest: 'permissions', sign: 'sign', typed: 'typed', tx: 'tx', switchChain: 'switchChain', addChain: 'addChain', watchAsset: 'watchAsset', solConnect: 'solConnect', solSignMessage: 'solSignMessage', solSignTx: 'solSignTx', solSignAll: 'solSignAll', solSignSend: 'solSignSend', multiConnect: 'multiConnect', multiSign: 'multiSign' };

export class ProviderService {
  private readLimiter: RateLimiter; private approvalLimiter: RateLimiter; private rpcLimiter: RateLimiter; private rpcAllLimiter: RateLimiter;
  private now: () => number; private policy: ProviderPolicy;
  constructor(private d: ServiceDeps) {
    this.now = d.now ?? Date.now; this.policy = d.policy ?? BUILD_PROVIDER_POLICY;
    this.readLimiter = new RateLimiter({ capacity: 120, refillPerSec: 60 }, this.now);
    this.approvalLimiter = new RateLimiter({ capacity: 6, refillPerSec: 0.1 }, this.now);
    // Proxied chain reads spend the wallet's own Harbour API quota (signed with the device key). A dApp's first page load makes
    // dozens of reads, so a site gets a burst of 300 then 20/s (identical reads are cached and shared by background/provider/rpc.ts).
    this.rpcLimiter = new RateLimiter({ capacity: 300, refillPerSec: 20 }, this.now);
    this.rpcAllLimiter = new RateLimiter({ capacity: 1000, refillPerSec: 60 }, this.now);
  }

  // ------------------------------------------------------------------ state for a freshly injected page
  async initState(origin: string): Promise<InitState> {
    const c = await this.d.perms.get(origin); const prefs = await this.d.perms.prefs();
    const chainId = c?.chainId ?? this.policy.defaultChain;
    const st = await this.d.vaultStatus(); const visible = st.hasVault && st.unlocked && !(await this.d.perms.isBlacklisted(origin));
    return { evm: { chainId: hex(chainId), networkVersion: String(chainId), accounts: visible && c?.evmAddress && c.namespaces.includes('evm') ? [c.evmAddress] : [], connected: true }, solana: { publicKey: visible && c?.solanaAddress && c.namespaces.includes('solana') ? c.solanaAddress : null }, multi: visible && c?.others && c.namespaces.includes('multi') ? c.others : {}, prefs: { defaultWallet: prefs.defaultWallet } };
  }

  // ------------------------------------------------------------------ request router
  async handle(sender: SenderInfo, req: PageRequest): Promise<HandleResult> {
    try { return await this.route(sender, req); } catch (e) { return fail(e); }
  }
  private async route(s: SenderInfo, req: PageRequest): Promise<HandleResult> {
    if (!this.readLimiter.take(s.origin)) throw new ProviderError(ERR.LIMIT_EXCEEDED);
    if (req.ns === 'evm' && UNSUPPORTED_EVM.has(req.method)) throw new ProviderError(ERR.UNSUPPORTED_METHOD, `Harbour does not support ${req.method}.`);
    // Namespaces this build does not serve are refused before anything else (core/harbour/policy.ts).
    if ((req.ns === 'solana' && !this.policy.families.solana) || (req.ns === 'multi' && !this.policy.families.multi)) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'This network is not available in Harbour.');
    const spec = specFor(req.ns, req.method);
    if (!spec) throw new ProviderError(ERR.METHOD_NOT_FOUND, `The method ${req.method} does not exist or is not available.`);
    if (await this.d.perms.isBlacklisted(s.origin)) {
      if (req.method === 'eth_chainId' || req.method === 'net_version') return ok(req.method === 'eth_chainId' ? hex(this.policy.defaultChain) : String(this.policy.defaultChain));
      if (req.method === 'eth_accounts') return ok([]);
      throw new ProviderError(ERR.UNAUTHORIZED, 'This site is on your blacklist in Harbour settings.');
    }
    const conn = await this.d.perms.get(s.origin);
    const evmConn = conn && conn.namespaces.includes('evm') && conn.evmAddress ? conn : undefined;
    const solConn = conn && conn.namespaces.includes('solana') && conn.solanaAddress ? conn : undefined;
    let chainId = conn?.chainId ?? this.policy.defaultChain;
    void this.d.perms.touch(s.origin).catch(() => {});

    if (req.ns === 'evm') {
      switch (spec.kind) {
        case 'local': { const st = await this.d.vaultStatus(); return this.local(req, st.hasVault && st.unlocked ? evmConn : undefined, chainId); }
        case 'rpc': {
          if (!this.rpcLimiter.take(s.origin) || !this.rpcAllLimiter.take('*')) throw new ProviderError(ERR.LIMIT_EXCEEDED, 'Too many requests from this site. Please wait a moment.');
          const params = req.params === undefined ? [] : Array.isArray(req.params) ? req.params : (() => { throw new ProviderError(ERR.INVALID_PARAMS, 'Params must be an array.'); })();
          return ok(await this.d.rpc(chainId, req.method, params));
        }
        case 'permissionsRevoke': { if (evmConn) { await this.d.perms.disconnect(s.origin, 'evm'); this.d.emit(s.origin, 'evm', 'accountsChanged', []); this.d.emit(s.origin, 'evm', 'disconnect', { code: ERR.DISCONNECTED, message: 'Disconnected by the user.' }); } return ok(null); }
        case 'connect':
          if (evmConn && (await this.d.vaultStatus()).unlocked) return ok([evmConn.evmAddress]);
          return this.queue(s, req, 'connect', { requested: 'evm' });
        case 'permissionsRequest':
          if (evmConn && (await this.d.vaultStatus()).unlocked) return ok([permission(evmConn, s.origin)]);
          return this.queue(s, req, 'permissions', { requested: 'evm' });
        default: break;
      }
      if (!evmConn) throw new ProviderError(ERR.UNAUTHORIZED);
      const me = evmConn.evmAddress!;
      switch (spec.kind) {
        case 'sign': {
          if (req.method === 'eth_sign' && !(await this.d.ethSignEnabled?.())) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'eth_sign is disabled in Harbour. It can sign anything, including transactions, so sites must use personal_sign or typed data.');
          const n = req.method === 'eth_sign' ? normalizeEthSign(req.params) : normalizePersonalSign(req.params, me);
          if (req.method === 'eth_sign' && !n.rawHash) throw new ProviderError(ERR.INVALID_PARAMS, 'eth_sign only signs a 32-byte hash. Use personal_sign for text.');
          if (!sameAddress(n.address, me)) throw new ProviderError(ERR.UNAUTHORIZED, 'The requested account has not been authorized by the user.');
          return this.queue(s, req, 'sign', n, evmConn);
        }
        case 'typed': {
          const n = normalizeTypedData(req.method, req.params, me);
          if (!sameAddress(n.address, me)) throw new ProviderError(ERR.UNAUTHORIZED, 'The requested account has not been authorized by the user.');
          const dc = (n.typedData.domain as any)?.chainId;
          if (dc !== undefined && dc !== null && String(dc).length && !this.policy.isSigningEvmChain(dc)) throw new ProviderError(ERR.UNRECOGNIZED_CHAIN, 'This network is not available in Harbour.');
          if (dc !== undefined && dc !== null && String(dc).length && Number(dc) !== chainId) { if (!(await this.autoSwitch(s.origin, evmConn, dc))) throw new ProviderError(ERR.INVALID_PARAMS, 'Provided chainId does not match the currently active chain.'); chainId = Number(dc); }
          return this.queue(s, req, 'typed', n, (await this.d.perms.get(s.origin)) ?? evmConn);
        }
        case 'tx': {
          const tx = normalizeSendTx(req.params, me);
          if (tx.chainId !== undefined && Number(BigInt(tx.chainId)) !== chainId) { const want = Number(BigInt(tx.chainId)); if (!(await this.autoSwitch(s.origin, evmConn, want))) throw new ProviderError(ERR.INVALID_PARAMS, 'Provided chainId does not match the currently active chain.'); chainId = want; }
          if (!this.d.networks.get(chainId)) throw new ProviderError(ERR.CHAIN_DISCONNECTED);
          if (!this.policy.isSigningEvmChain(chainId)) throw new ProviderError(ERR.UNRECOGNIZED_CHAIN, 'This network is not available in Harbour.');
          return this.queue(s, req, 'tx', { tx, chainId }, (await this.d.perms.get(s.origin)) ?? evmConn);
        }
        case 'switchChain': {
          const { chainId: target } = normalizeSwitchChain(req.params);
          if (!this.d.networks.get(target) || !this.policy.isSigningEvmChain(target)) throw new ProviderError(ERR.UNRECOGNIZED_CHAIN);
          // Trust Wallet (SwitchNetwork handler): a connected site is switched silently; only an unconnected site is prompted.
          if (evmConn) { await this.applyChain(s.origin, target, target === chainId); return ok(null); }
          if (target === chainId) return ok(null);
          return this.queue(s, req, 'switchChain', { chainId: target }, evmConn);
        }
        case 'addChain': {
          // A network's identity is its chain ID. An already-saved chain is a
          // no-op: no prompt, no RPC/metadata replacement, no switch (the site
          // must call wallet_switchEthereumChain for that).
          const candidate = Array.isArray(req.params) ? req.params[0] : null;
          const requestedId = parseChainIdHex(candidate?.chainId);
          // Trust Wallet (WalletAddEthereumChain): a chain the wallet already has is handled as wallet_switchEthereumChain.
          if (this.d.networks.get(requestedId)) { if (evmConn && requestedId != null) await this.applyChain(s.origin, requestedId, requestedId === chainId); return ok(null); }
          if (!this.policy.siteAddChain) throw new ProviderError(ERR.UNRECOGNIZED_CHAIN, 'Harbour does not support adding this network.');
          const a = normalizeAddChain(req.params);
          // chainlist sends several RPCs and the first is often rate-limited: keep every usable https one and try them in order on approval.
          const usable = a.rpcUrls.map((u) => normalizeUrl(u)).filter((r): r is { ok: true; url: string } => r.ok && !isPrivateNetworkUrl(r.url));
          const rpcUrl = usable[0];
          if (!rpcUrl || !rpcUrl.ok) throw new ProviderError(ERR.INVALID_PARAMS, 'rpcUrls must contain at least one https:// URL.');
          if (isPrivateNetworkUrl(rpcUrl.url)) throw new ProviderError(ERR.INVALID_PARAMS, 'This RPC address points at a private network and cannot be added by a site.');
          const explorer = a.explorerUrls.map((u) => normalizeUrl(u)).find((r) => r.ok);
          const v = validateNetwork({ name: a.chainName, rpcUrl: rpcUrl.url, chainId: a.chainId, symbol: a.symbol, explorerUrl: explorer && explorer.ok ? explorer.url : '' }, customNetworks());
          if (!v.ok) throw new ProviderError(ERR.INVALID_PARAMS, v.error);
          return this.queue(s, req, 'addChain', { chainId: a.chainId, known: false, network: { name: v.network.name, rpcUrl: v.network.rpcUrl, symbol: v.network.symbol, explorerUrl: v.network.explorerUrl ?? '', rpcUrls: usable.map((r) => r.url).slice(0, 6) } }, evmConn);
        }
        case 'watchAsset': return this.queue(s, req, 'watchAsset', { asset: normalizeWatchAsset(req.params), chainId }, evmConn);
        default: throw new ProviderError(ERR.METHOD_NOT_FOUND);
      }
    }

    // ---- Cosmos / Sui / Aptos / Tron / Bitcoin
    if (req.ns === 'multi') {
      const p = (req.params && typeof req.params === 'object' && !Array.isArray(req.params) ? req.params : {}) as Record<string, any>;
      if (!isMultiChain(p.chain)) throw new ProviderError(ERR.INVALID_PARAMS, 'Unsupported chain.');
      const chain = p.chain as string; const have = conn?.namespaces.includes('multi') ? conn.others?.[chain] : undefined;
      switch (spec.kind) {
        case 'multiConnect': {
          const proof = chain === 'ton' && typeof p.proofPayload === 'string' ? p.proofPayload.slice(0, 256) : undefined; // a proof is a signature: always asks
          if (have && !proof && (await this.d.vaultStatus()).unlocked) return ok(chain === 'ton' ? await this.tonResult(have, undefined, s.origin, conn!) : have);
          if (p.onlyIfTrusted === true) throw new ProviderError(ERR.UNAUTHORIZED, 'The site is not trusted yet.');
          return this.queue(s, req, 'multiConnect', { chain, ...(proof ? { proofPayload: proof } : {}) });
        }
        case 'multiDisconnect': {
          if (conn && have) { const others = { ...conn.others }; delete others[chain]; if (Object.keys(others).length) await this.d.perms.update(s.origin, { others }); else await this.d.perms.disconnect(s.origin, 'multi'); this.d.emit(s.origin, 'multi', 'disconnect', { chain }); }
          return ok(null);
        }
        default: break;
      }
      if (!conn || !have) throw new ProviderError(ERR.UNAUTHORIZED);
      const fam = MULTI_CHAINS[chain].family; const mb = this.d.multi; let detail: Record<string, string> | undefined; let params: any = req.params;
      const wantsTx = req.method === 'signTransaction' || req.method === 'signAndSend';
      try {
        if (fam === 'ton') {
          if (req.method !== 'sendTransaction' || !mb?.ton) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'Unsupported TON method.');
          const t = await mb.ton.normalize(p.txJson); const total = t.messages.reduce((a, m) => a + BigInt(m.amount), 0n);
          const n: MultiRequest = { chain, op: 'send', method: req.method, data: { ton: t }, summary: { kind: 'tonTx', detail: { ...Object.fromEntries(t.messages.map((m, i) => [`To #${i + 1}`, `${m.friendly} — ${m.amount} nanoTON${m.payload ? ' (with payload)' : ''}${m.stateInit ? ' (deploys contract)' : ''}`])), 'Total': `${total} nanoTON`, 'Valid until': new Date(t.validUntil * 1000).toISOString() } } };
          return this.queue(s, req, 'multiSign', n, conn);
        }
        if (fam === 'sui' && wantsTx && typeof p.txJson === 'string') { if (!mb?.sui) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'Sui transactions are unavailable.'); const b = await mb.sui.build(p.txJson, have.address); detail = b.detail; params = { chain, txB64: bytesToB64(b.bytes) }; }
        if (fam === 'aptos' && wantsTx && p.payload && typeof p.payload === 'object') { if (!mb?.aptos) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'Aptos transactions are unavailable.'); const b = await mb.aptos.build(p.payload, have.address, hexToBytes('0x' + have.publicKey)); detail = b.detail; params = { chain, txB64: bytesToB64(b.bytes) }; }
      } catch (e) { if (e instanceof ProviderError) throw e; throw new ProviderError(ERR.INVALID_PARAMS, String((e as Error)?.message ?? 'Could not prepare this transaction.').slice(0, 200)); }
      const n = normalizeMultiSign(req.method, params, { address: have.address, publicKey: have.publicKey, detail });
      return this.queue(s, req, 'multiSign', n, conn);
    }

    // ---- Solana
    switch (spec.kind) {
      case 'solConnect': {
        if (solConn && (await this.d.vaultStatus()).unlocked) return ok({ publicKey: solConn.solanaAddress });
        if ((req.params as any)?.onlyIfTrusted === true) throw new ProviderError(ERR.UNAUTHORIZED, 'The site is not trusted yet.');
        return this.queue(s, req, 'solConnect', { requested: 'solana' });
      }
      case 'solDisconnect': { if (solConn) { await this.d.perms.disconnect(s.origin, 'solana'); this.d.emit(s.origin, 'solana', 'disconnect'); } return ok(null); }
      default: break;
    }
    if (!solConn) throw new ProviderError(ERR.UNAUTHORIZED);
    switch (spec.kind) {
      case 'solSignMessage': return this.queue(s, req, 'solSignMessage', normalizeSolMessage(req.params), solConn);
      case 'solSignTx': case 'solSignAll': case 'solSignSend': {
        const n = normalizeSolTx(req.params);
        if (spec.kind !== 'solSignAll' && n.transactions.length !== 1) throw new ProviderError(ERR.INVALID_PARAMS, 'Exactly one transaction is required.');
        for (const t of n.transactions) { const p = parseSolTx(b64ToBytes(t)); if (signerSlot(p, solConn.solanaAddress!) < 0) throw new ProviderError(ERR.INVALID_PARAMS, 'The connected account is not a required signer of this transaction.'); }
        return this.queue(s, req, KIND_OF[spec.kind], n, solConn);
      }
      default: throw new ProviderError(ERR.METHOD_NOT_FOUND);
    }
  }

  private async local(req: PageRequest, c: Connection | undefined, chainId: number): Promise<HandleResult> {
    const p = Array.isArray(req.params) ? req.params : [];
    switch (req.method) {
      case 'eth_chainId': return ok(hex(chainId));
      case 'net_version': return ok(String(chainId));
      case 'eth_accounts': return ok(c?.evmAddress ? [c.evmAddress] : []);
      case 'eth_coinbase': return ok(c?.evmAddress ?? null);
      case 'web3_clientVersion': return ok(`Harbour/${this.d.version ?? '0'}`);
      case 'web3_sha3': { if (!isHexData(p[0])) throw new ProviderError(ERR.INVALID_PARAMS, 'Expected 0x-prefixed hex.'); return ok(sha3(p[0] as string)); }
      case 'personal_ecRecover': {
        const [msg, sig] = p as [unknown, unknown]; if (!isHexData(msg) || typeof sig !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(sig)) throw new ProviderError(ERR.INVALID_PARAMS);
        try { return ok(await evmRecover(msg as string, sig)); } catch { throw new ProviderError(ERR.INVALID_PARAMS, 'Invalid signature.'); }
      }
      case 'wallet_getPermissions': return ok(c?.evmAddress ? [permission(c, c.origin)] : []);
      default: throw new ProviderError(ERR.METHOD_NOT_FOUND);
    }
  }

  /** Create (or de-duplicate) an approval request and make the approval window visible. */
  private async queue(s: SenderInfo, req: PageRequest, kind: PendingKind, params: unknown, bound?: Connection): Promise<HandleResult> {
    const key = senderKey(s, req.id);
    const existing = await this.d.pending.findByKey(key);
    if (existing?.stage === 'executing') throw new ProviderError(ERR.RESOURCE_UNAVAILABLE, 'This request is executing or its outcome is unknown. Do not resubmit; check the wallet and chain history.');
    if (existing) return { done: false }; // a content-script resend after a worker restart: the original request is still waiting
    const st = await this.d.vaultStatus();
    if (!st.hasVault) throw new ProviderError(ERR.UNAUTHORIZED, 'Harbour has no wallet yet. Create or import one first.');
    if (!this.approvalLimiter.take(s.origin)) throw new ProviderError(ERR.LIMIT_EXCEEDED, 'Too many requests from this site. Wait a moment and try again.');
    const all = await this.d.pending.list();
    if (all.length >= MAX_PENDING_TOTAL || all.filter((p) => p.origin === s.origin).length >= MAX_PENDING_PER_ORIGIN) throw new ProviderError(ERR.LIMIT_EXCEEDED, 'Too many pending requests.');
    if ((kind === 'connect' || kind === 'permissions' || kind === 'solConnect' || kind === 'multiConnect') && all.some((p) => p.origin === s.origin && p.kind === kind)) throw new ProviderError(ERR.RESOURCE_UNAVAILABLE);
    const c = bound;
    const binding = c ? { id: c.id, walletId: c.walletId, accountIndex: c.accountIndex, chainId: c.chainId, evmAddress: c.evmAddress, solanaAddress: c.solanaAddress, others: c.others } : undefined;
    await this.d.pending.add({ binding, key, reqId: req.id, ns: req.ns, method: req.method, kind, params, origin: s.origin, topOrigin: s.topOrigin, isTopFrame: s.isTopFrame, tabId: s.tabId, frameId: s.frameId, documentId: s.documentId, title: s.title, icon: s.icon });
    await this.d.openApproval().catch(() => {});
    return { done: false };
  }

  /** A WalletConnect session proposal enters the same approval queue as an injected connect request. */
  /** Make `chainId` the connection's network and tell the site (EIP-1193 chainChanged + legacy networkChanged). `quiet` re-announces without a write. */
  private async applyChain(origin: string, chainId: number, same = false): Promise<void> {
    if (!same) await this.d.perms.update(origin, { chainId });
    this.d.emit(origin, 'evm', 'chainChanged', hex(chainId)); this.d.emit(origin, 'evm', 'networkChanged', String(chainId));
  }
  /** Trust Wallet `autoSwitchDappChain`: a connected site whose request names another known chain switches the wallet there first. */
  private async autoSwitch(origin: string, conn: Connection | undefined, raw: unknown): Promise<boolean> {
    if (!conn) return false;
    let target: number; try { target = typeof raw === 'string' && /^0x/i.test(raw) ? Number(BigInt(raw)) : Number(raw); } catch { return false; }
    if (!Number.isSafeInteger(target) || target <= 0 || !this.d.networks.get(target)) return false;
    await this.applyChain(origin, target); return true;
  }
  async queueWcSession(s: SenderInfo, proposalId: number, params: Record<string, unknown>): Promise<void> {
    const req: PageRequest = { id: `proposal:${proposalId}`, ns: 'evm', method: 'wc_sessionProposal', params: [] };
    await this.queue(s, req, 'wcSession', { proposalId, ...params });
  }

  // ------------------------------------------------------------------ settlement
  async settle(p: PendingRequest, outcome: Outcome): Promise<void> {
    // Journal the final result before removing the execution claim or delivering it.
    await this.d.pending.putSettled(p.key, outcome);
    await this.d.pending.take(p.id);
    if (p.internal) return;
    const delivered = await this.d.deliver({ tabId: p.tabId, frameId: p.frameId, documentId: p.documentId }, p.reqId, outcome).catch(() => false);
    void delivered; // tombstone remains until TTL even after successful delivery
  }
  /** Called when a content script (re)connects and re-sends a request: hand back a stored outcome if one exists. */
  takeSettled(key: string) { return this.d.pending.takeSettled(key); }
  async rejectWhere(pred: (p: PendingRequest) => boolean, error = new ProviderError(ERR.USER_REJECTED)): Promise<number> {
    const list = await this.d.pending.takeWhere(pred);
    for (const p of list) await this.settle(p, { error: serializeError(error) });
    if (list.length) await this.d.closeApprovalIfIdle().catch(() => {});
    return list.length;
  }
  /** The page that issued the requests went away (navigation/reload/tab close): nobody is waiting for these any more. */
  async dropFor(tabId: number, frameId: number | null, documentId?: string): Promise<void> {
    const gone = await this.d.pending.takeWhere((p) => p.tabId === tabId && (frameId === null || p.frameId === frameId) && (!documentId || !p.documentId || p.documentId === documentId));
    if (gone.length) await this.d.closeApprovalIfIdle().catch(() => {});
  }
  async gc(): Promise<void> { for (const p of await this.d.pending.expired()) await this.settle(p, { error: serializeError(new ProviderError(ERR.USER_REJECTED, 'The request expired.')) }); await this.d.closeApprovalIfIdle().catch(() => {}); }

  // ------------------------------------------------------------------ approve / reject (called from the approval UI)
  async resolve(id: string, decision: Decision): Promise<{ ok: boolean; error?: string; locked?: boolean }> {
    const peek = await this.d.pending.get(id); if (!peek) return { ok: false, error: 'This request is no longer pending.' };
    if (peek.stage === 'executing') return { ok: false, error: 'This request is executing or its outcome is unknown. Do not resubmit.' };
    if (peek.expiresAt <= this.now()) { const expired = await this.d.pending.take(id); if (expired) await this.settle(expired, { error: serializeError(new ProviderError(ERR.USER_REJECTED, 'The request expired.')) }); return { ok: false, error: 'The request expired.' }; }
    if (!decision.approve) {
      const p = await this.d.pending.take(id); if (p) await this.settle(p, { error: serializeError(new ProviderError(ERR.USER_REJECTED)) });
      await this.d.closeApprovalIfIdle().catch(() => {}); return { ok: true };
    }
    const st = await this.d.vaultStatus(); if (!st.unlocked) return { ok: false, locked: true, error: 'LOCKED' };
    const p = await this.d.pending.claim(id); if (!p) return { ok: false, error: 'This request is no longer pending or is already executing.' };
    let outcome: Outcome; let message: string | undefined;
    try { outcome = { result: await this.execute(p, decision) }; }
    catch (e) { const w = serializeError(e); outcome = { error: w }; message = w.message; }
    await this.settle(p, outcome);
    await this.d.closeApprovalIfIdle().catch(() => {});
    return message ? { ok: false, error: message } : { ok: true };
  }

  private async execute(p: PendingRequest, dec: Decision): Promise<unknown> {
    const { perms } = this.d;
    if (await perms.isBlacklisted(p.origin)) throw new ProviderError(ERR.UNAUTHORIZED, 'This site is on your blacklist.');
    switch (p.kind) {
      case 'connect': case 'permissions': case 'solConnect': {
        const ns: Namespace = p.kind === 'solConnect' ? 'solana' : 'evm';
        const accts = await this.d.signer.accounts(); if (!accts) throw new ProviderError(ERR.UNAUTHORIZED, 'No wallet available.');
        let existing = await perms.get(p.origin);
        if (existing && existing.walletId !== accts.walletId) { await perms.disconnect(p.origin); existing = undefined; }
        const index = existing && existing.walletId === accts.walletId ? existing.accountIndex : dec.accountIndex ?? accts.activeAccount;
        const a = accts.accounts[index]; if (!a) throw new ProviderError(ERR.INVALID_PARAMS, 'Unknown account.');
        if (ns === 'evm' && !a.evm) throw new ProviderError(ERR.UNAUTHORIZED, 'This account has no EVM address.');
        if (ns === 'solana' && !a.solana) throw new ProviderError(ERR.UNAUTHORIZED, 'This account has no Solana address.');
        let chainId = existing?.chainId ?? this.policy.defaultChain;
        if (ns === 'evm' && dec.chainId !== undefined) { if (!this.d.networks.get(dec.chainId)) throw new ProviderError(ERR.UNRECOGNIZED_CHAIN); chainId = dec.chainId; }
        const prevAddr = existing?.evmAddress;
        const conn = await perms.connect({ origin: p.origin, title: p.title, icon: p.icon, walletId: accts.walletId, walletName: accts.walletName, accountIndex: index, accountName: a.name, chainId, namespaces: [ns], ...(ns === 'evm' ? { evmAddress: a.evm } : { solanaAddress: a.solana }), ...(existing?.evmAddress && ns === 'solana' ? { evmAddress: existing.evmAddress } : {}), ...(existing?.solanaAddress && ns === 'evm' ? { solanaAddress: existing.solanaAddress } : {}) });
        if (ns === 'solana') { this.d.emit(p.origin, 'solana', 'connect', { publicKey: a.solana }); return { publicKey: a.solana }; }
        if (!prevAddr || !sameAddress(prevAddr, a.evm)) this.d.emit(p.origin, 'evm', 'accountsChanged', [a.evm]);
        if (!existing || existing.chainId !== chainId) this.d.emit(p.origin, 'evm', 'chainChanged', hex(chainId));
        this.d.emit(p.origin, 'evm', 'connect', { chainId: hex(chainId) });
        return p.kind === 'permissions' ? [permission(conn, p.origin)] : [a.evm];
      }
      case 'multiConnect': {
        const chain = p.params.chain as string;
        const accts = await this.d.signer.accounts(); if (!accts) throw new ProviderError(ERR.UNAUTHORIZED, 'No wallet available.');
        let existing = await perms.get(p.origin);
        if (existing && existing.walletId !== accts.walletId) { await perms.disconnect(p.origin); existing = undefined; }
        const index = existing ? existing.accountIndex : dec.accountIndex ?? accts.activeAccount;
        const a = accts.accounts[index]; if (!a) throw new ProviderError(ERR.INVALID_PARAMS, 'Unknown account.');
        if (!a.multi?.[chain]) throw new ProviderError(ERR.UNAUTHORIZED, 'This account has no address on this chain.');
        const k = await this.d.signer.multiKey({ walletId: accts.walletId, accountIndex: index }, chain);
        if (chain === 'ton') { const same = await this.d.multi?.ton?.sameAddress(k.address, a.multi[chain]) ?? k.address === a.multi[chain]; if (!same) throw new ProviderError(ERR.INTERNAL, 'The key does not match the account address.'); }
        else if (k.address !== a.multi[chain]) throw new ProviderError(ERR.INTERNAL, 'The key does not match the account address.');
        const entry = { address: k.address, publicKey: bytesToHex(k.publicKey).slice(2) };
        const conn = await perms.connect({ origin: p.origin, title: p.title, icon: p.icon, walletId: accts.walletId, walletName: accts.walletName, accountIndex: index, accountName: a.name, chainId: existing?.chainId ?? this.policy.defaultChain, namespaces: ['multi'], others: { ...(existing?.others ?? {}), [chain]: entry },
          ...(existing?.evmAddress ? { evmAddress: existing.evmAddress } : {}), ...(existing?.solanaAddress ? { solanaAddress: existing.solanaAddress } : {}) });
        this.d.emit(p.origin, 'multi', 'connect', { chain, ...entry });
        return chain === 'ton' ? this.tonResult(entry, p.params.proofPayload, p.origin, conn, { walletId: accts.walletId, accountIndex: index }) : entry;
      }
      case 'multiSign': {
        const conn = await this.needConn(p, 'multi'); const n = p.params as ReturnType<typeof normalizeMultiSign>; const mine = conn.others?.[n.chain]; if (!mine) throw new ProviderError(ERR.UNAUTHORIZED, 'The site is no longer connected.');
        const pub = hexToBytes('0x' + mine.publicKey); const mb = this.d.multi;
        if (MULTI_CHAINS[n.chain].family === 'ton') {
          if (!mb?.ton) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'TON is unavailable.');
          const boc = await mb.ton.send(pub, n.data.ton.messages, n.data.ton.validUntil, (h) => this.d.signer.multiSign(conn, n.chain, 'ed25519', h));
          return { boc };
        }
        if (n.op === 'psbt') {
          const plan = planPsbtSigning(decodePsbt(n.data.psbt), pub, n.data.only ?? undefined); const sigs: Uint8Array[] = [];
          for (const x of plan.inputs) sigs.push((await this.d.signer.multiSign(conn, n.chain, 'secp256k1', x.digest)).slice(0, 64));
          const signed = applySignatures(plan, pub, sigs, n.data.finalize === true); return { psbtHex: psbtToHex(signed), psbtBase64: psbtToB64(signed) };
        }
        const plan = signPlan(n, mine.address);
        const sig = await this.d.signer.multiSign(conn, n.chain, plan.scheme, plan.data);
        const out: any = plan.encode(sig, pub, { address: mine.address });
        if (n.op !== 'send') return out;
        const fam = MULTI_CHAINS[n.chain].family;
        if (fam === 'sui' && mb?.sui) return { ...out, ...(await mb.sui.execute(b64ToBytes(n.data.txB64), out.signature) as object) };
        if (fam === 'aptos' && mb?.aptos) return mb.aptos.submit(b64ToBytes(n.data.txB64), pub, sig);
        throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'Submitting is unavailable.');
      }
      case 'wcSession': {
        const wc = this.d.wc; if (!wc) throw new ProviderError(ERR.INTERNAL, 'WalletConnect is not available.');
        const accts = await this.d.signer.accounts(); if (!accts) throw new ProviderError(ERR.UNAUTHORIZED, 'No wallet available.');
        let existing = await perms.get(p.origin);
        if (existing && existing.walletId !== accts.walletId) { await perms.disconnect(p.origin); existing = undefined; }
        const index = existing ? existing.accountIndex : dec.accountIndex ?? accts.activeAccount;
        const a = accts.accounts[index]; if (!a) throw new ProviderError(ERR.INVALID_PARAMS, 'Unknown account.');
        const proposal = p.params.proposal as { requiredNamespaces?: any; optionalNamespaces?: any };
        const neg = negotiate(proposal, { evm: a.evm, solana: a.solana }, this.d.networks.list().map((n) => n.chainId));
        if (!neg.ok) { await wc.reject(p.params.proposalId, neg.code, neg.message).catch(() => {}); throw new ProviderError(ERR.INVALID_PARAMS, neg.message); }
        const chains = Object.values(neg.namespaces).flatMap((n) => n.chains);
        const topic = await wc.approve(p.params.proposalId, neg.namespaces, { origin: p.origin, title: p.title, icon: p.icon, chains });
        const chainId = existing && neg.evmChainIds.includes(existing.chainId) ? existing.chainId : neg.initialChainId;
        await perms.connect({ origin: p.origin, title: p.title, icon: p.icon, walletId: accts.walletId, walletName: accts.walletName, accountIndex: index, accountName: a.name, chainId,
          namespaces: [...(neg.evmChainIds.length ? ['evm' as const] : []), ...(neg.solana ? ['solana' as const] : [])],
          ...(neg.evmChainIds.length ? { evmAddress: a.evm } : existing?.evmAddress ? { evmAddress: existing.evmAddress } : {}), ...(neg.solana ? { solanaAddress: a.solana } : existing?.solanaAddress ? { solanaAddress: existing.solanaAddress } : {}) });
        if (neg.evmChainIds.length) { this.d.emit(p.origin, 'evm', 'accountsChanged', [a.evm]); }
        return { topic };
      }
      case 'sign': {
        const conn = await this.needConn(p, 'evm'); const n = p.params;
        return this.d.signer.signMessage(conn, n.bytesHex, n.rawHash ? 'rawHash' : 'personal');
      }
      case 'typed': { const conn = await this.needConn(p, 'evm'); return this.d.signer.signTypedData(conn, p.params.typedData); }
      case 'tx': {
        const conn = await this.needConn(p, 'evm');
        const { chainId } = p.params as { chainId: number }; let tx = (p.params as { tx: TxRequest }).tx;
        // User-edited spending limit: only a plain approve(spender, amount) may be rewritten, and only to a LOWER amount.
        if (dec.allowanceLimit !== undefined) {
          const nd = /^\d{1,78}$/.test(dec.allowanceLimit) ? lowerApproveAmount(tx.data ?? '0x', BigInt(dec.allowanceLimit)) : null;
          if (!nd) throw new ProviderError(ERR.INVALID_PARAMS, 'The spending limit cannot be applied to this request.');
          tx = { ...tx, data: nd };
        }
        if (conn.chainId !== chainId) throw new ProviderError(ERR.UNAUTHORIZED, 'The site switched networks while this request was pending.');
        const net = this.d.networks.get(chainId); if (!net) throw new ProviderError(ERR.CHAIN_DISCONNECTED);
        const fee: FeeValues = {}; if (dec.fee?.maxFeePerGas) fee.maxFeePerGas = BigInt(dec.fee.maxFeePerGas); if (dec.fee?.maxPriorityFeePerGas) fee.maxPriorityFeePerGas = BigInt(dec.fee.maxPriorityFeePerGas); if (dec.fee?.gasPrice) fee.gasPrice = BigInt(dec.fee.gasPrice);
        // The fee must be the one the user saw: never let the node pick it at signing time (it could be anything).
        if (!Object.keys(fee).length && tx.maxFeePerGas === undefined && tx.gasPrice === undefined) throw new ProviderError(ERR.INVALID_PARAMS, 'The network fee could not be shown, so this transaction was not sent. Try again.');
        const hash = await this.d.signer.sendTransaction(conn, net, tx, { gas: dec.gasLimit ? BigInt(dec.gasLimit) : undefined, fee: Object.keys(fee).length ? fee : undefined });
        const call = decodeCalldata(tx.data);
        if (call.kind === 'approve' && !call.decrease && tx.to) {
          void perms.trackApproval({ chainId, token: tx.to, spender: call.spender, owner: conn.evmAddress!, origin: p.origin, txHash: hash, amount: call.amount.toString(), unlimited: isUnlimited(call.amount) }).catch(() => {});
        }
        return hash;
      }
      case 'switchChain': {
        const { chainId } = p.params as { chainId: number }; if (!this.d.networks.get(chainId)) throw new ProviderError(ERR.UNRECOGNIZED_CHAIN);
        await this.needConn(p, 'evm'); await this.applyChain(p.origin, chainId); return null;
      }
      case 'addChain': {
        const { chainId, known, network } = p.params as { chainId: number; known: boolean; network?: { name: string; rpcUrl: string; symbol: string; explorerUrl: string; rpcUrls?: string[] } };
        await this.needConn(p, 'evm');
        // Another approval or Settings action may have added the chain while
        // this request was pending. Never replace that saved RPC or metadata.
        if (this.d.networks.get(chainId)) return null;
        if (known) throw new ProviderError(ERR.UNRECOGNIZED_CHAIN, 'This network was removed while the request was pending.');
        if (!network) throw new ProviderError(ERR.INVALID_PARAMS);
        // First RPC that answers with the requested chain ID wins; a rate-limited or dead endpoint just moves on to the next one.
        const candidates = [...new Set([network.rpcUrl, ...(network.rpcUrls ?? [])])].slice(0, 6);
        let chosen: string | null = null; let wrong: number | null = null;
        for (const url of candidates) {
          const seen = await this.d.probeChainId(url).catch(() => null);
          if (seen === chainId) { chosen = url; break; }
          if (seen != null) wrong = seen;
        }
        if (!chosen) { if (wrong != null) throw new ProviderError(ERR.INVALID_PARAMS, `This RPC belongs to chain ID ${wrong}, not ${chainId}.`); throw new ProviderError(ERR.INTERNAL, 'Could not reach any RPC URL for this network (they may be rate-limited). Try again in a moment.'); }
        network.rpcUrl = chosen;
        if (this.d.networks.get(chainId)) return null;
        await this.d.saveCustomNetwork({ chainId, name: network.name, rpcUrl: network.rpcUrl, symbol: network.symbol, explorerUrl: network.explorerUrl || undefined });
        await perms.update(p.origin, { chainId }); this.d.emit(p.origin, 'evm', 'chainChanged', hex(chainId)); this.d.emit(p.origin, 'evm', 'networkChanged', String(chainId)); return null;
      }
      case 'watchAsset': {
        const { asset, chainId } = p.params as { asset: { address: string; symbol?: string; decimals?: number }; chainId: number }; await this.needConn(p, 'evm');
        const meta = await this.tokenMeta(chainId, asset.address); if (!meta) throw new ProviderError(ERR.INVALID_PARAMS, 'This address is not a valid ERC-20 token on the selected network.');
        const r = await this.d.addToken({ walletId: (await this.needConn(p, 'evm')).walletId, chainId, address: asset.address, name: meta.name || meta.symbol, symbol: meta.symbol, decimals: meta.decimals });
        if (!r.ok) throw new ProviderError(ERR.INTERNAL, r.error ?? 'Could not add the token.'); return true;
      }
      case 'solSignMessage': {
        const conn = await this.needConn(p, 'solana'); const [sig] = await this.d.signer.solSign(conn, [b64ToBytes(p.params.messageB64)]);
        return { signature: bytesToB64(sig), publicKey: conn.solanaAddress };
      }
      case 'solSignTx': case 'solSignAll': case 'solSignSend': {
        const conn = await this.needConn(p, 'solana'); const raws: Uint8Array[] = (p.params.transactions as string[]).map(b64ToBytes);
        const parsed = raws.map(parseSolTx); const slots = parsed.map((t) => signerSlot(t, conn.solanaAddress!)); if (slots.some((s) => s < 0)) throw new ProviderError(ERR.INVALID_PARAMS, 'The connected account is not a required signer.');
        const sigs = await this.d.signer.solSign(conn, parsed.map((t) => t.message));
        const signed = raws.map((r, i) => withSignature(r, parsed[i], slots[i], sigs[i]));
        if (p.kind === 'solSignSend') {
          const opts = (p.params.options ?? {}) as { skipPreflight?: boolean; maxRetries?: number };
          const signature = await this.d.solRpc('sendTransaction', [bytesToB64(signed[0]), { encoding: 'base64', skipPreflight: opts.skipPreflight === true, maxRetries: opts.maxRetries ?? 3, preflightCommitment: 'confirmed' }]);
          return { signature: String(signature) };
        }
        const out = signed.map((b, i) => ({ signedTransaction: bytesToB64(b), signature: b58encode(sigs[i]) }));
        return p.kind === 'solSignAll' ? { transactions: out, publicKey: conn.solanaAddress } : { ...out[0], publicKey: conn.solanaAddress };
      }
      default: throw new ProviderError(ERR.METHOD_NOT_FOUND);
    }
  }
  /** TON Connect `connect` payload: raw address, wallet v4r2 stateInit, and (when asked) a ton_proof signed for THIS origin's host. */
  private async tonResult(entry: { address: string; publicKey: string }, proofPayload: string | undefined, origin: string, conn: Connection | ConnRef, ref?: ConnRef): Promise<unknown> {
    const ton = this.d.multi?.ton; if (!ton) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'TON is unavailable.');
    const id = await ton.identity(hexToBytes('0x' + entry.publicKey));
    const out: any = { address: id.raw, friendly: entry.address, publicKey: entry.publicKey, walletStateInit: id.stateInit };
    if (proofPayload) {
      const host = new URL(origin).host; const timestamp = Math.floor(this.now() / 1000);
      const sig = await this.d.signer.multiSign((ref ?? conn) as ConnRef, 'ton', 'ed25519', tonProofHash({ workchain: id.workchain, addressHash: id.hash, domain: host, timestamp, payload: proofPayload }));
      out.proof = { timestamp, domain: host, payload: proofPayload, signature: bytesToB64(sig) };
    }
    return out;
  }
  private async needConn(p: PendingRequest, ns: Namespace): Promise<Connection> {
    const c = await this.d.perms.isConnected(p.origin, ns); if (!c) throw new ProviderError(ERR.UNAUTHORIZED, 'The site is no longer connected.');
    const b = p.binding;
    if (!b || c.id !== b.id || c.walletId !== b.walletId || c.accountIndex !== b.accountIndex || c.chainId !== b.chainId || c.evmAddress !== b.evmAddress || c.solanaAddress !== b.solanaAddress || JSON.stringify(c.others ?? null) !== JSON.stringify(b.others ?? null)) throw new ProviderError(ERR.UNAUTHORIZED, 'The connection changed while this request was pending. Request again for the current account and chain.');
    return c;
  }
  /** Token metadata straight from the contract (symbol(), decimals(), name()). Never trusts dApp-supplied values. */
  async tokenMeta(chainId: number, address: string): Promise<{ symbol: string; name: string; decimals: number } | null> {
    try {
      const [sym, dec, name] = await Promise.all([this.d.rpc(chainId, 'eth_call', [{ to: address, data: SEL.symbol }, 'latest']), this.d.rpc(chainId, 'eth_call', [{ to: address, data: SEL.decimals }, 'latest']), this.d.rpc(chainId, 'eth_call', [{ to: address, data: SEL.name }, 'latest']).catch(() => '0x')]);
      const decimals = Number(BigInt(dec)); const symbol = decodeString(sym);
      if (!symbol || !Number.isInteger(decimals) || decimals < 0 || decimals > 32) return null;
      return { symbol, name: decodeString(name) || symbol, decimals };
    } catch { return null; }
  }
}
/** EIP-2255 permission object as returned by wallet_getPermissions / wallet_requestPermissions (TW reads caveats[0].value[0]). */
export function permission(c: Connection, origin: string) {
  return { parentCapability: 'eth_accounts', invoker: origin, caveats: [{ type: 'restrictReturnedAccounts', value: [c.evmAddress] }], date: c.connectedAt, id: c.id };
}
void EVM_METHODS; void hexToBytes; void toHexQuantity;
