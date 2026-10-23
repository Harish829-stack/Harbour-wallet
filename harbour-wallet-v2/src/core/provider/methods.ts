// Method allowlist + parameter normalisation for dApp requests. Everything here is pure and unit-tested.
// Evidence: Trust Wallet inpage `request()` switch (evidences/re-evidence/12-dapp-provider) — see evidences/re-evidence/31-dapp-provider/STATUS.md for the mapping.
import { ERR, ProviderError } from './errors';
import type { Namespace } from './protocol';

export type MethodKind =
  | 'local' | 'rpc' | 'connect' | 'permissionsRequest' | 'permissionsRevoke' | 'sign' | 'typed' | 'tx' | 'switchChain' | 'addChain' | 'watchAsset'
  | 'solConnect' | 'solDisconnect' | 'solSignMessage' | 'solSignTx' | 'solSignAll' | 'solSignSend' | 'multiConnect' | 'multiDisconnect' | 'multiSign';
export interface MethodSpec { kind: MethodKind; needsConnection?: boolean; approval?: boolean }

const L: MethodSpec = { kind: 'local' };
export const EVM_METHODS: Readonly<Record<string, MethodSpec>> = Object.freeze({
  eth_chainId: L, net_version: L, eth_accounts: L, eth_coinbase: L, web3_clientVersion: L, web3_sha3: L, personal_ecRecover: L, wallet_getPermissions: L,
  eth_requestAccounts: { kind: 'connect', approval: true },
  wallet_requestPermissions: { kind: 'permissionsRequest', approval: true },
  wallet_revokePermissions: { kind: 'permissionsRevoke' },
  personal_sign: { kind: 'sign', needsConnection: true, approval: true },
  eth_sign: { kind: 'sign', needsConnection: true, approval: true },
  eth_signTypedData: { kind: 'typed', needsConnection: true, approval: true },
  eth_signTypedData_v3: { kind: 'typed', needsConnection: true, approval: true },
  eth_signTypedData_v4: { kind: 'typed', needsConnection: true, approval: true },
  eth_sendTransaction: { kind: 'tx', needsConnection: true, approval: true },
  wallet_switchEthereumChain: { kind: 'switchChain', needsConnection: true, approval: true },
  wallet_addEthereumChain: { kind: 'addChain', needsConnection: true, approval: true },
  wallet_watchAsset: { kind: 'watchAsset', needsConnection: true, approval: true },
  // read-only JSON-RPC proxied to the origin's selected network (public RPC)
  ...Object.fromEntries([
    'eth_blockNumber', 'eth_call', 'eth_estimateGas', 'eth_gasPrice', 'eth_getBalance', 'eth_getBlockByHash', 'eth_getBlockByNumber',
    'eth_getBlockTransactionCountByHash', 'eth_getBlockTransactionCountByNumber', 'eth_getCode', 'eth_getLogs', 'eth_getStorageAt',
    'eth_getTransactionByHash', 'eth_getTransactionByBlockHashAndIndex', 'eth_getTransactionByBlockNumberAndIndex', 'eth_getTransactionCount',
    'eth_getTransactionReceipt', 'eth_feeHistory', 'eth_maxPriorityFeePerGas', 'eth_protocolVersion', 'eth_syncing', 'eth_getProof',
    'eth_getUncleCountByBlockHash', 'eth_getUncleCountByBlockNumber', 'eth_sendRawTransaction', 'eth_blobBaseFee', 'net_listening', 'net_peerCount',
  ].map((m) => [m, { kind: 'rpc' } as MethodSpec])),
});
export const SOLANA_METHODS: Readonly<Record<string, MethodSpec>> = Object.freeze({
  connect: { kind: 'solConnect', approval: true },
  disconnect: { kind: 'solDisconnect' },
  signMessage: { kind: 'solSignMessage', needsConnection: true, approval: true },
  signTransaction: { kind: 'solSignTx', needsConnection: true, approval: true },
  signAllTransactions: { kind: 'solSignAll', needsConnection: true, approval: true },
  signAndSendTransaction: { kind: 'solSignSend', needsConnection: true, approval: true },
});
export const MULTI_METHODS: Readonly<Record<string, MethodSpec>> = Object.freeze({
  connect: { kind: 'multiConnect', approval: true },
  disconnect: { kind: 'multiDisconnect' },
  signMessage: { kind: 'multiSign', needsConnection: true, approval: true },
  signTransaction: { kind: 'multiSign', needsConnection: true, approval: true },
  signAmino: { kind: 'multiSign', needsConnection: true, approval: true },
  signDirect: { kind: 'multiSign', needsConnection: true, approval: true },
  signAndSend: { kind: 'multiSign', needsConnection: true, approval: true },
  sendTransaction: { kind: 'multiSign', needsConnection: true, approval: true },
  signPsbt: { kind: 'multiSign', needsConnection: true, approval: true },
});
/** Explicitly unsupported (TW: UNIMPLEMENTED_WALLET_METHODS + filters/subscriptions). They answer 4200 and never reach a handler. */
export const UNSUPPORTED_EVM = new Set(['wallet_getCapabilities', 'wallet_sendCalls', 'wallet_getCallsStatus', 'wallet_showCallsStatus', 'eth_newFilter', 'eth_newBlockFilter', 'eth_newPendingTransactionFilter', 'eth_uninstallFilter', 'eth_subscribe', 'eth_unsubscribe', 'eth_signTransaction', 'eth_decrypt', 'eth_getEncryptionPublicKey', 'eth_getFilterChanges', 'eth_getFilterLogs']);

export function specFor(ns: Namespace, method: string): MethodSpec | null {
  const table = ns === 'evm' ? EVM_METHODS : ns === 'multi' ? MULTI_METHODS : SOLANA_METHODS;
  return Object.prototype.hasOwnProperty.call(table, method) ? table[method] : null;
}
/** Names TW's page guard refuses to forward because they collide with the extension's own bridge events. */
export const isBridgeNamespaced = (m: string): boolean => /^(?:PUBLIC|INTERNAL)_/i.test(m) || m.endsWith('_callback');

// ---------------------------------------------------------------- param helpers
const bad = (msg: string): never => { throw new ProviderError(ERR.INVALID_PARAMS, msg); };
export const isHexAddress = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-fA-F]{40}$/.test(s);
export const isHexData = (s: unknown): s is string => typeof s === 'string' && /^0x([0-9a-fA-F]{2})*$/.test(s);
export const sameAddress = (a: unknown, b: unknown): boolean => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export const hexToBytes = (h: string): Uint8Array => { const s = h.slice(2); const out = new Uint8Array(s.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return out; };
export const bytesToHex = (b: Uint8Array): string => '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export function tryUtf8(b: Uint8Array): string | null { try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return null; } }
const arr = (p: unknown): unknown[] => (Array.isArray(p) ? p : bad('Params must be an array.'));
export const toHexQuantity = (n: bigint | number): string => '0x' + BigInt(n).toString(16);

export const MAX_MESSAGE_BYTES = 128 * 1024;

export interface NormalizedMessage { address: string; bytesHex: string; utf8: string | null; hexInput: boolean; method: 'personal_sign' | 'eth_sign'; rawHash: boolean }
/** personal_sign: [message, address] (TW also accepts [address, message] when the first param is the connected account). */
export function normalizePersonalSign(params: unknown, connected: string): NormalizedMessage {
  const p = arr(params); if (p.length < 2) bad('personal_sign expects [message, address].');
  let [message, address] = p as [unknown, unknown];
  if (typeof message === 'string' && sameAddress(message, connected) && typeof address === 'string' && !sameAddress(address, connected)) [message, address] = [address, message];
  if (typeof message !== 'string') bad('Message must be a string.');
  if (!isHexAddress(address)) bad('Invalid address.');
  const hexInput = isHexData(message) && (message as string).length > 2;
  const bytes = hexInput ? hexToBytes(message as string) : new TextEncoder().encode(message as string);
  if (bytes.length > MAX_MESSAGE_BYTES) bad('Message too large.');
  return { address: address as string, bytesHex: bytesToHex(bytes), utf8: tryUtf8(bytes), hexInput, method: 'personal_sign', rawHash: false };
}
/** eth_sign: [address, data]. Follows TW: UTF-8 payloads are signed with the personal-message prefix, anything else must be a raw 32-byte hash. */
export function normalizeEthSign(params: unknown): NormalizedMessage {
  const p = arr(params); if (p.length < 2) bad('eth_sign expects [address, data].');
  const [address, data] = p as [unknown, unknown];
  if (!isHexAddress(address)) bad('Invalid address.');
  if (!isHexData(data) || (data as string).length <= 2) bad('eth_sign data must be 0x-prefixed hex.');
  const bytes = hexToBytes(data as string);
  if (bytes.length > MAX_MESSAGE_BYTES) bad('Message too large.');
  const utf8 = tryUtf8(bytes);
  if (utf8 === null && bytes.length !== 32) bad('eth_sign only signs UTF-8 text or a 32-byte hash.');
  return { address: address as string, bytesHex: bytesToHex(bytes), utf8, hexInput: true, method: 'eth_sign', rawHash: utf8 === null };
}

export interface TypedDataInput { address: string; typedData: { types: Record<string, Array<{ name: string; type: string }>>; primaryType: string; domain: Record<string, any>; message: Record<string, any> }; version: 'V3' | 'V4'; method: string }
/** eth_signTypedData(_v3/_v4): [address, typedData(JSON string | object)] — order is detected like TW. Legacy V1 (array form) is rejected like TW. */
export function normalizeTypedData(method: string, params: unknown, connected: string): TypedDataInput {
  const p = arr(params); if (p.length < 2) bad('Expected [address, typedData].');
  let [a, d] = p as [unknown, unknown];
  if (!(typeof a === 'string' && isHexAddress(a))) [a, d] = [d, a];
  if (!isHexAddress(a)) bad('Invalid address.');
  void connected;
  let data: any = d;
  if (typeof data === 'string') { if (data.length > 200 * 1024) bad('Typed data too large.'); try { data = JSON.parse(data); } catch { bad('Typed data is not valid JSON.'); } }
  if (Array.isArray(data)) throw new ProviderError(ERR.UNSUPPORTED_METHOD, 'eth_signTypedData V1 (array form) is not supported.');
  if (!data || typeof data !== 'object') bad('Typed data must be an object.');
  const { types, primaryType, domain, message } = data;
  if (!types || typeof types !== 'object' || Array.isArray(types)) bad('Typed data is missing `types`.');
  if (typeof primaryType !== 'string' || !primaryType) bad('Typed data is missing `primaryType`.');
  if (!domain || typeof domain !== 'object') bad('Typed data is missing `domain`.');
  if (!message || typeof message !== 'object') bad('Typed data is missing `message`.');
  for (const [name, fields] of Object.entries(types as Record<string, unknown>)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !Array.isArray(fields) || fields.length > 64) bad('Invalid type definition.');
    for (const f of fields as any[]) if (!f || typeof f.name !== 'string' || typeof f.type !== 'string' || f.type.length > 64) bad('Invalid type field.');
  }
  if (!(types as any)[primaryType] && primaryType !== 'EIP712Domain') bad('primaryType is not defined in types.');
  return { address: a as string, typedData: { types, primaryType, domain, message }, version: method === 'eth_signTypedData_v4' ? 'V4' : 'V3', method };
}

export interface TxRequest {
  from: string; to?: string; value: string; data: string;
  gas?: string; nonce?: string; gasPrice?: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string; type?: string; chainId?: string;
}
const TX_KEYS = new Set(['from', 'to', 'value', 'data', 'input', 'gas', 'gasLimit', 'nonce', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'type', 'chainId', 'accessList']);
/** eth_sendTransaction: [txObject]. Unknown/dangerous fields (e.g. EIP-7702 authorizationList) are rejected rather than ignored. */
export function normalizeSendTx(params: unknown, connected: string): TxRequest {
  const p = arr(params); const t = p[0];
  if (!t || typeof t !== 'object' || Array.isArray(t)) bad('Expected a transaction object.');
  const o = t as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!TX_KEYS.has(k)) bad(`Unsupported transaction field: ${k}.`);
  const from = o.from === undefined ? connected : o.from;
  if (!isHexAddress(from)) bad('Invalid `from` address.');
  if (!sameAddress(from, connected)) throw new ProviderError(ERR.UNAUTHORIZED, 'The `from` address is not the connected account.');
  if (o.to !== undefined && o.to !== null && !isHexAddress(o.to)) bad('Invalid `to` address.');
  // Real dApps (viem/ethers wrappers, Uniswap) send padded quantities such as "0x00" or "0x0de0b6b3a7640000"; accept them and
  // canonicalise (strict JSON-RPC form) instead of rejecting a valid request. Non-hex or oversized values still fail.
  const q = (k: string): string | undefined => {
    const v = o[k]; if (v === undefined || v === null) return undefined;
    if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{0,64}$/.test(v)) bad(`Invalid ${k}.`);
    const digits = (v as string).slice(2).replace(/^0+/, ''); return '0x' + (digits || '0');
  };
  const dataRaw = o.data ?? o.input; if (o.data !== undefined && o.input !== undefined && o.data !== o.input) bad('`data` and `input` differ.');
  if (dataRaw !== undefined && dataRaw !== null && !isHexData(dataRaw)) bad('Invalid transaction data.');
  const data = (dataRaw as string | undefined) ?? '0x';
  if (data.length > 2 + 2 * 128 * 1024) bad('Transaction data too large.');
  const to = (o.to ?? undefined) as string | undefined;
  if (!to && data === '0x') bad('A transaction needs a recipient or data.');
  const out: TxRequest = { from: from as string, ...(to ? { to } : {}), value: q('value') ?? '0x0', data };
  const gas = q('gas') ?? q('gasLimit'); if (gas) out.gas = gas;
  for (const k of ['nonce', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'type', 'chainId'] as const) { const v = q(k); if (v !== undefined) out[k] = v; }
  if (out.gasPrice && (out.maxFeePerGas || out.maxPriorityFeePerGas)) bad('Cannot mix gasPrice with EIP-1559 fee fields.');
  if (out.type && !['0x0', '0x2'].includes(out.type)) bad('Only legacy (0x0) and EIP-1559 (0x2) transactions are supported.');
  if (Array.isArray(o.accessList) && o.accessList.length) bad('accessList is not supported.');
  return out;
}

export function parseChainIdHex(v: unknown): number {
  if (typeof v !== 'string' || !/^0x[1-9a-fA-F][0-9a-fA-F]{0,13}$/.test(v)) bad('chainId must be a 0x-prefixed hex string without leading zeros.');
  const n = Number(BigInt(v as string)); if (!Number.isSafeInteger(n) || n < 1) bad('chainId out of range.'); return n;
}
export function normalizeSwitchChain(params: unknown): { chainId: number } {
  const p = arr(params); const o = p[0] as any;
  if (!o || typeof o !== 'object') bad('Expected [{ chainId }].');
  return { chainId: parseChainIdHex(o.chainId) };
}
export interface AddChainInput { chainId: number; chainName: string; symbol: string; decimals: number; rpcUrls: string[]; explorerUrls: string[]; iconUrls: string[] }
export function normalizeAddChain(params: unknown): AddChainInput {
  const p = arr(params); const o = p[0] as any;
  if (!o || typeof o !== 'object') bad('Expected a chain object.');
  const chainId = parseChainIdHex(o.chainId);
  if (typeof o.chainName !== 'string' || !o.chainName.trim() || o.chainName.length > 100) bad('Invalid chainName.');
  const nc = o.nativeCurrency; if (!nc || typeof nc !== 'object' || typeof nc.symbol !== 'string' || !nc.symbol.trim()) bad('Invalid nativeCurrency.');
  const decimals = nc.decimals === undefined ? 18 : nc.decimals;
  if (decimals !== 18) bad('Only 18-decimal native currencies are supported.');
  const strs = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 300).slice(0, max) : []);
  const rpcUrls = strs(o.rpcUrls, 10); if (!rpcUrls.length) bad('rpcUrls must contain at least one URL.');
  return { chainId, chainName: o.chainName.trim(), symbol: nc.symbol.trim(), decimals: 18, rpcUrls, explorerUrls: strs(o.blockExplorerUrls, 5), iconUrls: strs(o.iconUrls, 3) };
}
export interface WatchAssetInput { address: string; symbol?: string; decimals?: number; image?: string }
export function normalizeWatchAsset(params: unknown): WatchAssetInput {
  const p: any = Array.isArray(params) ? params[0] : params;
  if (!p || typeof p !== 'object') bad('Expected { type, options }.');
  if (String(p.type).toUpperCase() !== 'ERC20') throw new ProviderError(ERR.INVALID_PARAMS, 'Only ERC20 assets can be watched.');
  const o = p.options; if (!o || typeof o !== 'object' || !isHexAddress(o.address)) bad('Invalid token address.');
  const out: WatchAssetInput = { address: o.address };
  if (typeof o.symbol === 'string') out.symbol = o.symbol.slice(0, 32);
  if (o.decimals !== undefined && o.decimals !== null) { const d = Number(o.decimals); if (!Number.isInteger(d) || d < 0 || d > 32) bad('Invalid decimals.'); out.decimals = d; }
  if (typeof o.image === 'string' && /^https:\/\//.test(o.image) && o.image.length <= 300) out.image = o.image;
  return out;
}

// Solana: bytes cross the bridge as base64.
export const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const MAX_SOL_TX_BYTES = 1232 * 4;
export function normalizeSolMessage(params: unknown): { messageB64: string; length: number } {
  const o = params as any; if (!o || typeof o !== 'object' || typeof o.message !== 'string' || !B64_RE.test(o.message)) bad('Expected { message: base64 }.');
  const padding = o.message.endsWith('==') ? 2 : o.message.endsWith('=') ? 1 : 0;
  const len = Math.floor((o.message.length * 3) / 4) - padding; if (len === 0 || len > MAX_MESSAGE_BYTES) bad('Invalid message length.');
  return { messageB64: o.message, length: len };
}
export function normalizeSolTx(params: unknown): { transactions: string[]; options?: { skipPreflight?: boolean; maxRetries?: number } } {
  const o = params as any; if (!o || typeof o !== 'object') bad('Expected { transaction } or { transactions }.');
  const list: unknown[] = Array.isArray(o.transactions) ? o.transactions : o.transaction !== undefined ? [o.transaction] : [];
  if (!list.length || list.length > 10) bad('Between 1 and 10 transactions are required.');
  for (const t of list) if (typeof t !== 'string' || !B64_RE.test(t) || Math.floor((t.length * 3) / 4) > MAX_SOL_TX_BYTES || t.length < 8) bad('Invalid transaction encoding.');
  const options: { skipPreflight?: boolean; maxRetries?: number } = {};
  if (o.options && typeof o.options === 'object') { if (typeof o.options.skipPreflight === 'boolean') options.skipPreflight = o.options.skipPreflight; if (Number.isInteger(o.options.maxRetries) && o.options.maxRetries >= 0 && o.options.maxRetries <= 10) options.maxRetries = o.options.maxRetries; }
  return { transactions: list as string[], options };
}
