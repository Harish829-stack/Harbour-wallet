// Non-EVM custom-asset support (TW: custom-asset flow on Solana / Tron): token balances + metadata probes. Pure functions over an injectable fetch.
//   SPL    : getTokenAccountsByOwner(owner, {mint}) jsonParsed (sums every token account; covers Token and Token-2022), getAccountInfo(mint) for decimals.
//            name/symbol are NOT on the mint account (Metaplex metadata PDA needs off-curve derivation); they are looked up best-effort on Jupiter's
//            public token index (lite-api.jup.ag/tokens/v2/search) and otherwise the user types them (decimals stay locked to the chain value).
//   TRC-20 : TronGrid POST /wallet/triggerconstantcontract (balanceOf / name / symbol / decimals) — same ABI selectors as ERC-20.
import type { ChainInfo } from '../types';
import type { Fetcher } from './types';
import { endpointsOf, postJ, getJ, rpc } from './net';
import { base58CheckDecode, base58Decode, bytesToHex, toBig } from './codec';
import { solanaRpcUrl } from '../../rpc';
import { firstOf, formatUnits } from './types';

export type TokenFailure = 'INVALID_ADDRESS' | 'UNSUPPORTED_NETWORK' | 'NOT_A_CONTRACT' | 'NOT_A_TOKEN' | 'NETWORK_ERROR';
export interface ChainTokenMeta { address: string; name: string; symbol: string; decimals: number; standard: 'SPL' | 'TRC20' }
export type ChainProbe = { ok: true; token: ChainTokenMeta; needsManual?: boolean } | { ok: false; code: TokenFailure; error: string };
export type ChainTokenBalance = { ok: true; raw: string; formatted: string } | { ok: false; error: string };

export const TOKEN_CHAINS: Record<string, 'SPL' | 'TRC20'> = { solana: 'SPL', tron: 'TRC20' };
export const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const NET_ERR: ChainProbe = { ok: false, code: 'NETWORK_ERROR', error: 'Could not reach the network. Check your connection and try again.' };
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- address validation ----------
export const isSolanaAddress = (a: string): boolean => { try { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && base58Decode(a).length === 32; } catch { return false; } };
export const isTronAddress = (a: string): boolean => { try { const p = base58CheckDecode(a); return p.length === 21 && p[0] === 0x41; } catch { return false; } };
export const validTokenAddress = (chainId: string, a: string): boolean => (chainId === 'solana' ? isSolanaAddress(a) : chainId === 'tron' ? isTronAddress(a) : false);

// ---------- Solana ----------
const solUrls = (chain: ChainInfo) => [solanaRpcUrl(), ...endpointsOf(chain)].filter((u, i, a) => u && a.indexOf(u) === i);
export async function splBalance(chain: ChainInfo, owner: string, mint: string, decimals: number, f: Fetcher): Promise<ChainTokenBalance> {
  try {
    const accounts = await firstOf(solUrls(chain), async (u) => {
      const r = await rpc(f, u, 'getTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      if (r.error || !Array.isArray(r.result?.value)) throw new Error(r.error?.message ?? 'bad response');
      return r.result.value as any[];
    });
    let sum = 0n;
    for (const a of accounts) sum += toBig(a?.account?.data?.parsed?.info?.tokenAmount?.amount ?? 0);
    return { ok: true, raw: sum.toString(), formatted: formatUnits(sum, decimals) };
  } catch (e: any) { return { ok: false, error: e?.message ?? 'balance unavailable' }; }
}
export async function probeSpl(chain: ChainInfo, mint: string, f: Fetcher): Promise<ChainProbe> {
  if (!isSolanaAddress(mint)) return { ok: false, code: 'INVALID_ADDRESS', error: 'Enter a valid token mint address.' };
  let info: any;
  try {
    info = await firstOf(solUrls(chain), async (u) => {
      const r = await rpc(f, u, 'getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      if (r.error) throw new Error(r.error.message ?? 'RPC error');
      return r.result;
    });
  } catch { return NET_ERR; }
  const v = info?.value;
  if (!v) return { ok: false, code: 'NOT_A_CONTRACT', error: 'No account was found at this address on Solana.' };
  const parsed = v.data?.parsed;
  if (!TOKEN_PROGRAMS.includes(v.owner) || parsed?.type !== 'mint') return { ok: false, code: 'NOT_A_TOKEN', error: 'This address is not an SPL token mint.' };
  const decimals = Number(parsed.info?.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return { ok: false, code: 'NOT_A_TOKEN', error: 'This mint reports invalid decimals.' };
  const meta = await jupiterMeta(mint, decimals, f);
  return { ok: true, token: { address: mint, name: meta?.name ?? '', symbol: meta?.symbol ?? '', decimals, standard: 'SPL' }, needsManual: !meta };
}
/** Best-effort name/symbol. The id AND decimals must match the on-chain mint or the hit is ignored (a lookalike cannot spoof the card). */
export async function jupiterMeta(mint: string, decimals: number, f: Fetcher): Promise<{ name: string; symbol: string } | null> {
  try {
    const r = await getJ(f, `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, 6000);
    const hit = (Array.isArray(r.body) ? r.body : []).find((t: any) => t?.id === mint && Number(t?.decimals) === decimals);
    const name = clean(hit?.name, 64), symbol = clean(hit?.symbol, 32);
    return name && symbol ? { name, symbol } : null;
  } catch { return null; }
}

// ---------- Tron ----------
const tronUrls = (chain: ChainInfo) => endpointsOf(chain);
/** 21-byte Tron address (0x41…) -> 32-byte ABI word without the 0x41 prefix. */
export const tronAbiParam = (addr: string): string => bytesToHex(base58CheckDecode(addr).slice(1)).padStart(64, '0');
export function decodeAbiString(hex: string): string {
  const h = hex.replace(/^0x/, ''); if (!h) return '';
  const word = (i: number) => h.slice(i * 64, i * 64 + 64);
  if (h.length >= 128 && /^0{60}[0-9a-f]{4}$/.test(word(0))) { // dynamic string: offset, length, data
    const off = parseInt(word(0), 16) * 2; const len = parseInt(h.slice(off, off + 64), 16);
    if (Number.isFinite(len) && len > 0 && len < 256) return utf8FromHex(h.slice(off + 64, off + 64 + len * 2));
  }
  return utf8FromHex(h.slice(0, 64)).replace(/\0+$/, ''); // bytes32 style
}
const utf8FromHex = (hex: string) => new TextDecoder().decode(Uint8Array.from(hex.match(/../g) ?? [], (x) => parseInt(x, 16))).replace(/\0/g, '');
async function tronCall(chain: ChainInfo, f: Fetcher, owner: string, contract: string, selector: string, parameter: string): Promise<string> {
  return firstOf(tronUrls(chain), async (u) => {
    const r = await postJ(f, `${u}/wallet/triggerconstantcontract`, { owner_address: owner, contract_address: contract, function_selector: selector, parameter, visible: true });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (r.body?.result?.result !== true) { const e: any = new Error(r.body?.result?.message ?? 'call failed'); e.callFailed = true; throw e; }
    const out = r.body?.constant_result?.[0];
    if (typeof out !== 'string') { const e: any = new Error('no data'); e.callFailed = true; throw e; }
    return out;
  });
}
export async function trc20Balance(chain: ChainInfo, owner: string, contract: string, decimals: number, f: Fetcher): Promise<ChainTokenBalance> {
  try {
    if (!isTronAddress(owner)) return { ok: false, error: 'bad owner address' };
    const out = await tronCall(chain, f, owner, contract, 'balanceOf(address)', tronAbiParam(owner));
    const raw = BigInt('0x' + (out.replace(/^0x/, '') || '0'));
    return { ok: true, raw: raw.toString(), formatted: formatUnits(raw, decimals) };
  } catch (e: any) { return { ok: false, error: e?.message ?? 'balance unavailable' }; }
}
export async function probeTrc20(chain: ChainInfo, contract: string, f: Fetcher): Promise<ChainProbe> {
  if (!isTronAddress(contract)) return { ok: false, code: 'INVALID_ADDRESS', error: 'Enter a valid TRC-20 contract address (starts with T).' };
  const call = (sel: string) => tronCall(chain, f, contract, contract, sel, '');
  const [n, s, d] = await Promise.allSettled([call('name()'), call('symbol()'), call('decimals()')]);
  const rejected = [n, s, d].filter((x): x is PromiseRejectedResult => x.status === 'rejected');
  if (rejected.length === 3 && rejected.every((x) => !(x.reason as any)?.callFailed)) return NET_ERR;
  if (d.status !== 'fulfilled') return { ok: false, code: 'NOT_A_TOKEN', error: 'This contract does not look like a TRC-20 token (no decimals).' };
  const decimals = Number(BigInt('0x' + (d.value.replace(/^0x/, '') || '0')));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return { ok: false, code: 'NOT_A_TOKEN', error: 'This contract reports invalid decimals.' };
  const name = n.status === 'fulfilled' ? clean(decodeAbiString(n.value), 64) : ''; const symbol = s.status === 'fulfilled' ? clean(decodeAbiString(s.value), 32) : '';
  if (!name || !symbol) return { ok: false, code: 'NOT_A_TOKEN', error: 'This contract does not return a token name and symbol.' };
  return { ok: true, token: { address: contract, name, symbol, decimals, standard: 'TRC20' } };
}

export function probeChainToken(chain: ChainInfo, address: string, f: Fetcher): Promise<ChainProbe> {
  const a = address.trim();
  if (chain.id === 'solana') return probeSpl(chain, a, f);
  if (chain.id === 'tron') return probeTrc20(chain, a, f);
  return Promise.resolve({ ok: false, code: 'UNSUPPORTED_NETWORK', error: 'Custom tokens are not supported on this network yet.' });
}
export function chainTokenBalance(chain: ChainInfo, owner: string, token: { address: string; decimals: number }, f: Fetcher): Promise<ChainTokenBalance> {
  if (chain.id === 'solana') return splBalance(chain, owner, token.address, token.decimals, f);
  if (chain.id === 'tron') return trc20Balance(chain, owner, token.address, token.decimals, f);
  return Promise.resolve({ ok: false, error: 'unsupported' });
}
