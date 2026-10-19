// Pre-flight for a native or ERC-20 send: gas estimate, balances, recipient-is-contract check.
// TW's Send flow warns on: insufficient gas (`send.low-gas-warning`), a recipient that is a smart contract
// (`send.confirmation.risk.smart-contract`: "Sending tokens directly to a contract may result in permanent loss") and
// shows the estimated network fee (`send-tx.content.network-fee.estimated-fee`) [certain: message ids in App chunk].
import { getAddress, isAddress, parseEther, type PublicClient } from 'viem';
import { encodeTransfer, parseTokenAmount, tokenBalance } from './erc20';

export interface SendInput { from: string; to: string; amount: string; token?: { address: string; decimals: number } }
export interface SendEstimate {
  gas: string; feeWei: string; nativeBalance: string; tokenBalance?: string; maxNativeWei: string;
  recipientIsContract: boolean; enoughGas: boolean; enoughBalance: boolean; error?: string;
}
const GAS_BUFFER_NUM = 12n, GAS_BUFFER_DEN = 10n; // 20% headroom so a "Max" send is not rejected by a rising base fee

export const validRecipient = (to: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(to ?? '') && isAddress(to, { strict: false });

export async function estimateSend(client: PublicClient, input: SendInput): Promise<SendEstimate> {
  if (!validRecipient(input.to)) throw new Error('Invalid recipient address');
  const from = getAddress(input.from); const to = getAddress(input.to.toLowerCase());
  const [nativeBalance, recipientCode] = await Promise.all([client.getBalance({ address: from }), client.getCode({ address: to }).catch(() => undefined)]);
  let tx: { to: `0x${string}`; value?: bigint; data?: `0x${string}` }; let raw = 0n; let tBal: bigint | undefined;
  if (input.token) {
    tBal = await tokenBalance(client, input.token.address, from);
    raw = parseTokenAmount(input.amount, input.token.decimals);
    tx = { to: getAddress(input.token.address), data: encodeTransfer(to, raw) };
  } else {
    const wei = parseEther(String(input.amount));
    if (wei <= 0n) throw new Error('Enter a valid amount');
    raw = wei; tx = { to, value: wei };
  }
  let gas = 0n; let estimateError: string | undefined;
  try { gas = await client.estimateGas({ account: from, ...tx }); }
  catch (e: any) {
    // Typical cause: the transfer would revert (amount above balance, paused token). Fall back to a safe ceiling so the
    // UI can still show balances, and surface the reason instead of hiding it.
    estimateError = e?.shortMessage || e?.message || 'Could not estimate the network fee';
    gas = input.token ? 100_000n : 21_000n;
  }
  let perGas = 0n;
  try { const f = await client.estimateFeesPerGas(); perGas = f.maxFeePerGas ?? f.gasPrice ?? 0n; } catch { /* fall through */ }
  if (perGas === 0n) { try { perGas = await client.getGasPrice(); } catch { /* leave 0 */ } }
  const feeWei = gas * perGas;
  const headroom = (feeWei * GAS_BUFFER_NUM) / GAS_BUFFER_DEN;
  const maxNative = nativeBalance > headroom ? nativeBalance - headroom : 0n;
  const enoughGas = input.token ? nativeBalance >= feeWei : nativeBalance >= raw + feeWei;
  const enoughBalance = input.token ? (tBal ?? 0n) >= raw : nativeBalance >= raw;
  return {
    gas: gas.toString(), feeWei: feeWei.toString(), nativeBalance: nativeBalance.toString(), tokenBalance: tBal?.toString(), maxNativeWei: maxNative.toString(),
    recipientIsContract: !!recipientCode && recipientCode !== '0x', enoughGas, enoughBalance, error: estimateError,
  };
}

// Transaction request for the wallet client (viem) — same shape for native and token sends.
export function buildTransfer(input: SendInput): { to: `0x${string}`; value?: bigint; data?: `0x${string}` } {
  if (!validRecipient(input.to)) throw new Error('Invalid recipient address');
  const to = getAddress(input.to.toLowerCase());
  if (input.token) return { to: getAddress(input.token.address), data: encodeTransfer(to, parseTokenAmount(input.amount, input.token.decimals)) };
  const value = parseEther(String(input.amount));
  if (value <= 0n) throw new Error('Enter a valid amount');
  return { to, value };
}

// ===================================================================================================================
// Multi-chain Send service helpers (pure; used by background/handlers/chainSend.ts and unit-tested).
// ===================================================================================================================
import { namehash, normalize } from 'viem/ens';
import type { ChainInfo } from './chains/types';
import type { TxState } from './chains/send/types';

/** A transaction Harbour itself broadcast. Contains no secrets; shown on Transaction detail and merged into Activity. */
export interface SentTx {
  id: string;             // `${chainId}:${hash}`
  chainId: string;        // registry id
  symbol: string; decimals: number; assetKey: string;   // assetKey: chain id for native, `${chainId}:${contract}` for tokens
  from: string; to: string; amount: string;             // raw units
  feeEst: string; feeSymbol: string; feeDecimals: number;
  hash: string; ts: number; state: TxState; tier: string;
  memo?: string; block?: string; feeActual?: string; error?: string; confirmations?: number;
  kind?: 'send' | 'nft' | 'bridge'; nftName?: string;
  replace?: Record<string, any>;  // EVM nonce / fee data (kept for diagnostics)
}
export const SENT_TX_KEY = 'wallet:sent:txs'; export const MAX_SENT_TXS = 300;
export function upsertSent(list: SentTx[], rec: SentTx, max = MAX_SENT_TXS): SentTx[] {
  const out = [rec, ...list.filter((x) => x.id !== rec.id)].sort((a, b) => b.ts - a.ts);
  return out.slice(0, max);
}
export const readSent = (raw: unknown): SentTx[] => (Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && typeof x.hash === 'string' && typeof x.chainId === 'string') : []);

/** Recipient facts the Confirm screen turns into TW's guard sheet (send.confirmation.*). */
export interface RecipientRisk { newRecipient: boolean; inAddressBook: boolean; contactName?: string; selfSend: boolean }
export function assessRecipient(to: string, from: string, sent: SentTx[], chainId: string, book: Array<{ name: string; addresses: Record<string, string> }>, ct: string): RecipientRisk {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const contact = book.find((e) => Object.values(e.addresses ?? {}).some((a) => typeof a === 'string' && same(a, to)) || (e.addresses?.[ct] && same(e.addresses[ct], to)));
  const before = sent.some((s) => s.chainId === chainId && same(s.to, to));
  return { newRecipient: !contact && !before, inAddressBook: !!contact, contactName: contact?.name, selfSend: same(to, from) };
}

// ---- name resolution (TW: address-and-memo-input.address.label "Address or Domain Name") ----
export type NameService = 'ens' | 'sns';
export function nameService(input: string, chain: ChainInfo): NameService | null {
  const s = input.trim().toLowerCase();
  if (!s || s.length > 255 || /\s/.test(s) || !s.includes('.')) return null;
  if (chain.kind === 'evm' && s.endsWith('.eth')) return 'ens';
  if (chain.kind === 'solana' && s.endsWith('.sol')) return 'sns';
  return null;
}
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
type Rpc = (url: string, method: string, params: unknown[]) => Promise<any>;
/** ENS forward resolution on Ethereum mainnet: registry.resolver(node) then resolver.addr(node). No CCIP-read / wildcard support. */
export async function resolveEns(name: string, mainnetRpcs: string[], call: Rpc): Promise<string> {
  const node = namehash(normalize(name.trim().toLowerCase())).slice(2);
  let last: unknown = new Error('Name could not be resolved');
  for (const url of mainnetRpcs) {
    try {
      const r = await call(url, 'eth_call', [{ to: ENS_REGISTRY, data: '0x0178b8bf' + node }, 'latest']);
      const resolver = '0x' + String(r).slice(-40); if (/^0x0{40}$/.test(resolver)) throw new Error('This name has no resolver');
      const a = await call(url, 'eth_call', [{ to: resolver, data: '0x3b3b57de' + node }, 'latest']);
      const addr = '0x' + String(a).slice(-40); if (!/^0x[0-9a-f]{40}$/i.test(addr) || /^0x0{40}$/.test(addr)) throw new Error('This name does not point to an address');
      return addr;
    } catch (e) { last = e; }
  }
  throw last;
}
/** Bonfida SNS public proxy (Solana .sol names). */
export async function resolveSns(name: string, f: typeof fetch): Promise<string> {
  const r = await f(`https://sns-sdk-proxy.bonfida.workers.dev/resolve/${encodeURIComponent(name.trim().toLowerCase().replace(/\.sol$/, ''))}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Name could not be resolved'); const j: any = await r.json();
  if (j?.s !== 'ok' || typeof j.result !== 'string') throw new Error('Name could not be resolved'); return j.result;
}

// ---- chain resolution incl. user-added EVM networks ----
import type { CustomNetwork } from './networkRegistry';
import { chainById, chainByEvmId } from './chains/index';
/** A user-added EVM network (Settings > Networks) as a ChainInfo so the EVM send family can use it. */
export const customChainInfo = (n: CustomNetwork): ChainInfo => ({
  twId: 60, id: `custom-${n.chainId}`, name: n.name, wcId: 'ethereum', ct: 'ethereum', kind: 'evm', blockchain: 'Ethereum', symbol: n.symbol, decimals: 18, evmChainId: n.chainId,
  rpcs: [n.rpcUrl], explorer: n.explorerUrl, txPath: '/tx/{id}', accountPath: '/address/{address}',
});
export function resolveSendChain(id: string | undefined, evmChainId: number | undefined, custom: CustomNetwork[]): ChainInfo | undefined {
  if (id) { const c = chainById(id); if (c) return c; const m = /^custom-(\d+)$/.exec(id); if (m) { const n = custom.find((x) => x.chainId === Number(m[1])); if (n) return customChainInfo(n); } }
  if (evmChainId != null) { const c = chainByEvmId(evmChainId); if (c) return c; const n = custom.find((x) => x.chainId === evmChainId); if (n) return customChainInfo(n); }
  return undefined;
}
/** Validate a user-supplied token descriptor for non-EVM families (contract / mint / asset id / denom). */
export function sanitizeTokenSpec(raw: any): { contract: string; decimals: number; symbol: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const contract = typeof raw.contract === 'string' ? raw.contract.trim() : ''; const decimals = Number(raw.decimals);
  if (!contract || contract.length > 128 || /[\s\u0000-\u001f]/.test(contract)) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const symbol = String(raw.symbol ?? '').replace(/[^\p{L}\p{N}._-]/gu, '').slice(0, 12) || 'TOKEN';
  return { contract, decimals, symbol };
}

// ---- payment URIs (QR codes / pasted links): BIP-21 style `scheme:address?amount=..&memo=..` and EIP-681 `ethereum:0x..@137/transfer?address=0x..&uint256=..` ----
export interface PaymentRequest { address: string; amount?: string; memo?: string; chainHint?: string }
export function parsePaymentUri(input: string): PaymentRequest {
  const text = String(input ?? '').trim().slice(0, 2048);
  const m = /^([a-z][a-z0-9+.-]{1,24}):(?!\/\/)(.+)$/i.exec(text);
  if (!m || /^(https?|ftp|file|javascript|data)$/i.test(m[1])) return { address: text };
  const rest = m[2]; const q = rest.indexOf('?'); const head = q < 0 ? rest : rest.slice(0, q); const params = new URLSearchParams(q < 0 ? '' : rest.slice(q + 1));
  let address = head; let chainHint: string | undefined;
  const at = address.indexOf('@'); if (at > 0) { const after = address.slice(at + 1).split('/')[0]; if (/^\d+$/.test(after)) chainHint = after; address = address.slice(0, at); }
  const slash = address.indexOf('/'); if (slash > 0) address = address.slice(0, slash);
  if (/^ethereum$/i.test(m[1]) && /\/transfer/i.test(head) && params.get('address')) address = params.get('address')!;
  const amount = params.get('amount') ?? undefined; const memo = params.get('memo') ?? params.get('dt') ?? params.get('tag') ?? params.get('message') ?? undefined;
  return { address, amount: amount && /^\d*\.?\d+$/.test(amount) ? amount : undefined, memo: memo ? memo.slice(0, 120) : undefined, chainHint };
}

/** Receive-side notes per chain family (TW: modal-receive.account-does-not-exist for chains that need activation). */
export function receiveNote(chain: ChainInfo): string | null {
  switch (chain.kind) {
    case 'ripple': return 'A new XRP account needs a first payment of at least 1 XRP (the base reserve) before it exists on the ledger.';
    case 'stellar': return 'A new Stellar account needs a first payment of at least 1 XLM before it exists on the network.';
    case 'algorand': return 'A new Algorand account needs at least 0.1 ALGO before it can hold assets.';
    case 'substrate': return `Keep at least the existential deposit (${chain.id === 'polkadot' ? '1 DOT' : '0.000333 KSM'}) so the account stays active.`;
    case 'tron': return 'A new TRON address becomes active after its first incoming transfer.';
    case 'tezos': return 'A first incoming transfer to a new Tezos address burns 0.06425 XTZ for the account (paid by the sender).';
    default: return null;
  }
}
