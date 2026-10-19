// Custom networks (TW: Settings > Custom Networks > "Add custom network": name, RPC URL, chain id, token symbol, optional
// block-explorer URL; EVM only; warning "A malicious network provider can lie about the state of the blockchain…").
// [certain: field set and warning text from the screenshots/bundle]. Validation rules below are Harbour's own.
import { cleanText } from './erc20';
import { evmChains } from './chains/index';
import { customNetworks, type CustomNetwork, type NetworkState } from './networkRegistry';

export const BUILTIN_EVM = evmChains().map((c) => ({ chainId: c.evmChainId!, name: c.name, testnet: !!c.testnet }));
export const isBuiltinChain = (chainId: number) => BUILTIN_EVM.some((c) => c.chainId === chainId);
const MAX_CUSTOM = 50;

// https only; plain http is accepted for a local node (the extension has host access to localhost only).
export function normalizeUrl(raw: unknown, { optional = false }: { optional?: boolean } = {}): { ok: true; url: string } | { ok: false; error: string } {
  const s = String(raw ?? '').trim();
  if (!s) return optional ? { ok: true, url: '' } : { ok: false, error: 'Enter a URL.' };
  let u: URL; try { u = new URL(s); } catch { return { ok: false, error: 'Enter a valid URL.' }; }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return { ok: false, error: 'The URL must start with https://.' };
  if (u.username || u.password) return { ok: false, error: 'Do not put credentials in the URL.' };
  return { ok: true, url: s.replace(/\/+$/, '') };
}

export type NetInput = { name?: unknown; rpcUrl?: unknown; chainId?: unknown; symbol?: unknown; explorerUrl?: unknown };
export function validateNetwork(input: NetInput, existing: CustomNetwork[] = customNetworks(), editing?: number): { ok: true; network: Omit<CustomNetwork, 'addedAt'> } | { ok: false; error: string; field?: string } {
  const name = cleanText(input.name, 40); if (!name) return { ok: false, error: 'Enter a network name.', field: 'name' };
  const rpc = normalizeUrl(input.rpcUrl); if (!rpc.ok) return { ok: false, error: rpc.error, field: 'rpcUrl' };
  const idStr = String(input.chainId ?? '').trim();
  const chainId = /^\d+$/.test(idStr) ? Number(idStr) : NaN;
  if (!Number.isSafeInteger(chainId) || chainId < 1) return { ok: false, error: 'Chain ID must be a positive whole number.', field: 'chainId' };
  if (editing == null) {
    if (isBuiltinChain(chainId)) return { ok: false, error: 'This chain is already built in. Edit its RPC from the list instead.', field: 'chainId' };
    if (existing.some((n) => n.chainId === chainId)) return { ok: false, error: 'A custom network with this chain ID already exists.', field: 'chainId' };
    if (existing.length >= MAX_CUSTOM) return { ok: false, error: `You can add up to ${MAX_CUSTOM} custom networks.` };
  }
  const symbol = cleanText(input.symbol, 11); if (!symbol) return { ok: false, error: 'Enter the token symbol.', field: 'symbol' };
  const ex = normalizeUrl(input.explorerUrl, { optional: true }); if (!ex.ok) return { ok: false, error: ex.error, field: 'explorerUrl' };
  return { ok: true, network: { chainId, name, rpcUrl: rpc.url, symbol, explorerUrl: ex.url || undefined } };
}

type F = typeof fetch;
// A wrong RPC is the most common mistake, so confirm the node really reports the chain id the user typed.
export async function probeRpcChainId(rpcUrl: string, f: F = fetch): Promise<{ ok: true; chainId: number } | { ok: false; code: 'RPC_UNREACHABLE' | 'RPC_INVALID'; error: string }> {
  try {
    const res = await f(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, code: 'RPC_UNREACHABLE', error: `The RPC answered with HTTP ${res.status}.` };
    const j: any = await res.json(); const hex = j?.result;
    if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]+$/.test(hex)) return { ok: false, code: 'RPC_INVALID', error: 'This URL did not answer like an Ethereum JSON-RPC node.' };
    return { ok: true, chainId: Number(BigInt(hex)) };
  } catch { return { ok: false, code: 'RPC_UNREACHABLE', error: 'Could not reach this RPC URL.' }; }
}

export async function checkNetwork(n: { chainId: number; rpcUrl: string }, f: F = fetch): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  const p = await probeRpcChainId(n.rpcUrl, f);
  if (!p.ok) return { ok: false, error: p.error, field: 'rpcUrl' };
  if (p.chainId !== n.chainId) return { ok: false, error: `This RPC belongs to chain ID ${p.chainId}, not ${n.chainId}.`, field: 'chainId' };
  return { ok: true };
}

export const emptyState = (): NetworkState => ({ custom: [], rpcOverrides: {} });
