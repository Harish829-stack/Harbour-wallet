// WalletConnect v2 policy: pairing-URI validation, which chains/methods Harbour will approve, and the mapping of
// session requests onto the dApp provider's request router (so WalletConnect gets the same validation and approval UI as an injected dApp).
// Pure (no WalletKit import) so it is unit-tested without a relay. The WalletKit transport lives in background/walletconnect.
//
// Evidence note (see evidences/re-evidence/16-walletconnect): Trust Wallet 26.41.0 ships no WalletConnect pairing/session client — only a Kotlin request mapper
// (com.trustwallet.kit.plugin.walletconnect). This module is a Harbour-side equivalent built on the public Reown WalletKit.
import { b58decode, b58encode, b64ToBytes, bytesToB64 } from '../provider/base58';
import { normalizeOrigin } from '../provider/origin';

export const SOLANA_MAINNET_CAIP = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const EVM_METHODS_SUPPORTED = ['personal_sign', 'eth_sign', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4', 'eth_sendTransaction', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_watchAsset'] as const;
export const SOLANA_METHODS_SUPPORTED = ['solana_signMessage', 'solana_signTransaction'] as const;
export const EVENTS_SUPPORTED = ['chainChanged', 'accountsChanged'] as const;
/** WalletConnect specification error codes (https://specs.walletconnect.com/2.0/specs/clients/sign/error-codes). */
export const WC_ERR = { USER_REJECTED: 5000, UNSUPPORTED_CHAINS: 5100, UNSUPPORTED_METHODS: 5101, UNSUPPORTED_EVENTS: 5102, UNSUPPORTED_ACCOUNTS: 5103, UNSUPPORTED_NAMESPACE_KEY: 5104 } as const;

export interface ParsedWcUri { topic: string; version: 2; symKey: string; relayProtocol: string; expiry?: number }
export type UriResult = { ok: true; value: ParsedWcUri } | { ok: false; error: string };
/** `wc:<topic>@2?relay-protocol=irn&symKey=<64 hex>[&expiryTimestamp=<unix s>]`. v1 pairings and malformed URIs are refused before anything is sent to a relay. */
export function parseWcUri(raw: unknown, nowSec = Math.floor(Date.now() / 1000)): UriResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a WalletConnect link.' };
  let uri = raw.trim(); if (uri.length > 2048) return { ok: false, error: 'This link is too long.' };
  const m = /^(?:wc:|[a-z]+:\/\/wc\?uri=)/i.exec(uri);
  if (m && !/^wc:/i.test(uri)) { try { uri = decodeURIComponent(uri.slice(m[0].length)); } catch { return { ok: false, error: 'This is not a WalletConnect link.' }; } }
  const mm = /^wc:([0-9a-f]{64})@(\d+)\?(.*)$/i.exec(uri);
  if (!mm) return { ok: false, error: /^wc:[^@]+@1\b/i.test(uri) ? 'WalletConnect v1 links are no longer supported.' : 'This is not a WalletConnect link.' };
  if (mm[2] !== '2') return { ok: false, error: mm[2] === '1' ? 'WalletConnect v1 links are no longer supported.' : 'Unsupported WalletConnect version.' };
  const q = new URLSearchParams(mm[3]); const symKey = q.get('symKey') ?? ''; const relay = q.get('relay-protocol') ?? '';
  if (!/^[0-9a-f]{64}$/i.test(symKey)) return { ok: false, error: 'This WalletConnect link is incomplete.' };
  if (relay !== 'irn') return { ok: false, error: 'This link uses an unsupported relay.' };
  const expiry = q.get('expiryTimestamp'); let expiryN: number | undefined;
  if (expiry !== null) { expiryN = Number(expiry); if (!Number.isFinite(expiryN)) return { ok: false, error: 'This WalletConnect link is invalid.' }; if (expiryN <= nowSec) return { ok: false, error: 'This WalletConnect link has expired. Refresh the QR code on the site.' }; }
  return { ok: true, value: { topic: mm[1].toLowerCase(), version: 2, symKey: symKey.toLowerCase(), relayProtocol: relay, ...(expiryN !== undefined ? { expiry: expiryN } : {}) } };
}

export interface WcAccountInfo { evm?: string; solana?: string }
export interface WcNamespaceReq { chains?: string[]; methods: string[]; events: string[] }
export interface ProposalLike { requiredNamespaces?: Record<string, WcNamespaceReq>; optionalNamespaces?: Record<string, WcNamespaceReq> }
export interface SupportedNamespace { chains: string[]; methods: string[]; events: string[]; accounts: string[] }
export const evmCaip = (id: number) => `eip155:${id}`;
export const parseEvmCaip = (c: unknown): number | null => { const m = typeof c === 'string' ? /^eip155:([1-9]\d{0,14})$/.exec(c) : null; return m ? Number(m[1]) : null; };

/** What Harbour can offer for this account: every wallet EVM network, plus Solana mainnet when the account has a Solana address. */
export function supportedNamespaces(account: WcAccountInfo, evmChainIds: number[]): Record<string, SupportedNamespace> {
  const out: Record<string, SupportedNamespace> = {};
  if (account.evm && evmChainIds.length) {
    const chains = evmChainIds.map(evmCaip);
    out.eip155 = { chains, methods: [...EVM_METHODS_SUPPORTED], events: [...EVENTS_SUPPORTED], accounts: chains.map((c) => `${c}:${account.evm}`) };
  }
  if (account.solana) out.solana = { chains: [SOLANA_MAINNET_CAIP], methods: [...SOLANA_METHODS_SUPPORTED], events: [], accounts: [`${SOLANA_MAINNET_CAIP}:${account.solana}`] };
  return out;
}

export interface ProposalSummary {
  required: Array<{ namespace: string; chains: string[]; methods: string[]; events: string[] }>;
  optional: Array<{ namespace: string; chains: string[]; methods: string[]; events: string[] }>;
}
export const summarizeProposal = (p: ProposalLike): ProposalSummary => {
  const f = (o?: Record<string, WcNamespaceReq>) => Object.entries(o ?? {}).map(([namespace, v]) => ({ namespace, chains: (v.chains ?? (namespace.includes(':') ? [namespace] : [])).slice(0, 50), methods: (v.methods ?? []).slice(0, 80), events: (v.events ?? []).slice(0, 40) }));
  return { required: f(p.requiredNamespaces), optional: f(p.optionalNamespaces) };
};

export interface Approval { ok: true; namespaces: Record<string, SupportedNamespace>; evmChainIds: number[]; solana: boolean; initialChainId: number }
export interface ApprovalError { ok: false; code: number; message: string }
/**
 * Intersect a proposal with what Harbour supports. A required namespace/chain/method Harbour cannot honour refuses the whole proposal (spec behaviour);
 * optional ones are narrowed to what is supported. Chains/methods nobody asked for are never granted.
 */
export function negotiate(p: ProposalLike, account: WcAccountInfo, evmChainIds: number[]): Approval | ApprovalError {
  const supported = supportedNamespaces(account, evmChainIds);
  const req = p.requiredNamespaces ?? {}; const opt = p.optionalNamespaces ?? {};
  const keyOf = (k: string) => k.split(':')[0];
  for (const [k, v] of Object.entries(req)) {
    const ns = keyOf(k); const s = supported[ns];
    if (!s) return { ok: false, code: WC_ERR.UNSUPPORTED_NAMESPACE_KEY, message: `Harbour cannot provide the ${ns} namespace for this account.` };
    const chains = v.chains ?? (k.includes(':') ? [k] : []);
    if (!chains.length) return { ok: false, code: WC_ERR.UNSUPPORTED_CHAINS, message: `The ${ns} request names no chains.` };
    const bad = chains.find((c) => !s.chains.includes(c)); if (bad) return { ok: false, code: WC_ERR.UNSUPPORTED_CHAINS, message: `Harbour does not support ${bad}.` };
    const badM = (v.methods ?? []).find((m) => !s.methods.includes(m)); if (badM) return { ok: false, code: WC_ERR.UNSUPPORTED_METHODS, message: `Harbour does not support the method ${badM}.` };
    const badE = (v.events ?? []).find((e) => !s.events.includes(e)); if (badE) return { ok: false, code: WC_ERR.UNSUPPORTED_EVENTS, message: `Harbour does not support the event ${badE}.` };
  }
  const out: Record<string, SupportedNamespace> = {};
  for (const [ns, s] of Object.entries(supported)) {
    const reqs = [...Object.entries(req), ...Object.entries(opt)].filter(([k]) => keyOf(k) === ns);
    if (!reqs.length) continue;
    const wanted = new Set<string>(); const methods = new Set<string>(); const events = new Set<string>();
    for (const [k, v] of reqs) { for (const c of v.chains ?? (k.includes(':') ? [k] : [])) wanted.add(c); for (const m of v.methods ?? []) methods.add(m); for (const e of v.events ?? []) events.add(e); }
    const chains = s.chains.filter((c) => wanted.has(c)); if (!chains.length) continue;
    out[ns] = { chains, methods: s.methods.filter((m) => methods.has(m)), events: s.events.filter((e) => events.has(e)), accounts: s.accounts.filter((a) => chains.some((c) => a.startsWith(c + ':'))) };
  }
  if (!Object.keys(out).length) return { ok: false, code: WC_ERR.UNSUPPORTED_CHAINS, message: 'None of the requested networks are supported by Harbour.' };
  const approvedEvm = (out.eip155?.chains ?? []).map((c) => parseEvmCaip(c)!).filter((n) => n != null);
  const reqEvm = (req.eip155?.chains ?? Object.entries(req).filter(([k]) => k.startsWith('eip155:')).map(([k]) => k)).map(parseEvmCaip).find((n): n is number => n != null);
  return { ok: true, namespaces: out, evmChainIds: approvedEvm, solana: !!out.solana, initialChainId: reqEvm ?? approvedEvm[0] ?? 1 };
}

// ---------------------------------------------------------------- request mapping
export interface WcSessionRequest { chainId: string; request: { method: string; params?: unknown } }
export type Mapped = { ok: true; ns: 'evm' | 'solana'; method: string; params: unknown; chainId?: number; solana?: 'message' | 'transaction' } | { ok: false; code: number; message: string };
/** Map a WalletConnect session request to the provider router's PageRequest vocabulary. Anything not in the allowlist is refused (5101). */
export function mapRequest(r: WcSessionRequest, approvedChains: string[], approvedMethods: string[]): Mapped {
  const { method } = r.request; const params = r.request.params;
  if (typeof method !== 'string' || !approvedMethods.includes(method)) return { ok: false, code: WC_ERR.UNSUPPORTED_METHODS, message: `The method ${String(method).slice(0, 60)} was not approved for this session.` };
  if (!approvedChains.includes(r.chainId)) return { ok: false, code: WC_ERR.UNSUPPORTED_CHAINS, message: `${String(r.chainId).slice(0, 60)} was not approved for this session.` };
  if ((EVM_METHODS_SUPPORTED as readonly string[]).includes(method)) {
    const id = parseEvmCaip(r.chainId); if (id == null) return { ok: false, code: WC_ERR.UNSUPPORTED_CHAINS, message: 'Invalid chain.' };
    return { ok: true, ns: 'evm', method, params: params ?? [], chainId: id };
  }
  if (method === 'solana_signMessage') {
    const o = params as any; if (!o || typeof o.message !== 'string') return { ok: false, code: 5000 + 1, message: 'Expected { message, pubkey }.' };
    let bytes: Uint8Array; try { bytes = b58decode(o.message); } catch { return { ok: false, code: 5001, message: 'The message is not base58.' }; }
    return { ok: true, ns: 'solana', method: 'signMessage', params: { message: bytesToB64(bytes) }, solana: 'message' };
  }
  if (method === 'solana_signTransaction') {
    const o = params as any; if (!o || typeof o.transaction !== 'string') return { ok: false, code: 5001, message: 'Only { transaction } (base64) is supported.' };
    try { b64ToBytes(o.transaction); } catch { return { ok: false, code: 5001, message: 'The transaction is not base64.' }; }
    return { ok: true, ns: 'solana', method: 'signTransaction', params: { transaction: o.transaction }, solana: 'transaction' };
  }
  return { ok: false, code: WC_ERR.UNSUPPORTED_METHODS, message: 'Unsupported method.' };
}
/** Router result -> WalletConnect response result (Solana shapes differ: WC wants base58 signatures). */
export function mapResult(kind: 'message' | 'transaction' | undefined, result: any): unknown {
  if (kind === 'message') return { signature: b58encode(b64ToBytes(result.signature)) };
  if (kind === 'transaction') return { signature: result.signature, transaction: result.signedTransaction };
  return result;
}

/** Display origin for a session: the dApp's declared URL, https only. Self-declared metadata is never trusted as identity beyond display; the relay's verify result is shown beside it. */
export const originOfMetadata = (url: unknown): string | null => normalizeOrigin(typeof url === 'string' ? url : '');
export const sanitizeText = (s: unknown, max: number): string => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
