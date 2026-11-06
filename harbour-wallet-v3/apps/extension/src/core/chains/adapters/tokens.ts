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

export type TokenStandard = 'SPL' | 'TRC20' | 'JETTON' | 'COIN';
export const STANDARD_LABEL: Record<TokenStandard, string> = { SPL: 'SPL', TRC20: 'TRC-20', JETTON: 'Jetton', COIN: 'Coin' };
export type TokenFailure = 'INVALID_ADDRESS' | 'UNSUPPORTED_NETWORK' | 'NOT_A_CONTRACT' | 'NOT_A_TOKEN' | 'NETWORK_ERROR';
export interface ChainTokenMeta { address: string; name: string; symbol: string; decimals: number; standard: TokenStandard }
export type ChainProbe = { ok: true; token: ChainTokenMeta; needsManual?: boolean } | { ok: false; code: TokenFailure; error: string };
export type ChainTokenBalance = { ok: true; raw: string; formatted: string } | { ok: false; error: string };

export const TOKEN_CHAINS: Record<string, TokenStandard> = { solana: 'SPL', tron: 'TRC20', ton: 'JETTON', sui: 'COIN', aptos: 'COIN' };
export const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const NET_ERR: ChainProbe = { ok: false, code: 'NETWORK_ERROR', error: 'Could not reach the network. Check your connection and try again.' };
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- address validation ----------
export const isSolanaAddress = (a: string): boolean => { try { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && base58Decode(a).length === 32; } catch { return false; } };
export const isTronAddress = (a: string): boolean => { try { const p = base58CheckDecode(a); return p.length === 21 && p[0] === 0x41; } catch { return false; } };
export const isTonAddress = (a: string): boolean => /^[A-Za-z0-9_-]{48}$/.test(a) || /^-?\d+:[0-9a-fA-F]{64}$/.test(a);
/** Move coin type `0x<addr>::<module>::<Name>` (Sui and Aptos legacy coins). */
export const isMoveCoinType = (a: string): boolean => /^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/.test(a) && a.length <= 160;
/** Aptos fungible-asset metadata object address. */
export const isAptosFaAddress = (a: string): boolean => /^0x[0-9a-fA-F]{1,64}$/.test(a);
export const validTokenAddress = (chainId: string, a: string): boolean => (chainId === 'solana' ? isSolanaAddress(a) : chainId === 'tron' ? isTronAddress(a) : chainId === 'ton' ? isTonAddress(a) : chainId === 'sui' ? isMoveCoinType(a) : chainId === 'aptos' ? isMoveCoinType(a) || isAptosFaAddress(a) : false);

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

// ---------- TON jettons (toncenter v3 index, same host as the v2 registry endpoint) ----------
const tonV3 = (chain: ChainInfo) => endpointsOf(chain).map((u) => u.replace(/\/api\/v2$/, '/api/v3'));
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
/** The owner's jetton-wallet contract for a master (raw "0:HEX" form) and its balance; null wallet = the owner holds none. */
export async function tonJettonWallet(chain: ChainInfo, owner: string, master: string, f: Fetcher): Promise<{ wallet: string | null; balance: bigint }> {
  return firstOf(tonV3(chain), async (u) => {
    const r = await getJ(f, `${u}/jetton/wallets?owner_address=${encodeURIComponent(owner)}&jetton_address=${encodeURIComponent(master)}&limit=1&offset=0`);
    if (!r.ok || !Array.isArray(r.body?.jetton_wallets)) throw new Error(`HTTP ${r.status}`);
    const w = r.body.jetton_wallets[0]; if (!w) return { wallet: null, balance: 0n };
    return { wallet: String(w.address), balance: toBig(w.balance ?? 0) };
  });
}
export async function jettonBalance(chain: ChainInfo, owner: string, master: string, decimals: number, f: Fetcher): Promise<ChainTokenBalance> {
  try { const { balance } = await tonJettonWallet(chain, owner, master, f); return { ok: true, raw: balance.toString(), formatted: formatUnits(balance, decimals) }; }
  catch (e: any) { return { ok: false, error: e?.message ?? 'balance unavailable' }; }
}
export async function probeJetton(chain: ChainInfo, master: string, f: Fetcher): Promise<ChainProbe> {
  if (!isTonAddress(master)) return { ok: false, code: 'INVALID_ADDRESS', error: 'Enter a valid jetton master address.' };
  let body: any;
  try {
    body = await firstOf(tonV3(chain), async (u) => {
      const r = await getJ(f, `${u}/jetton/masters?address=${encodeURIComponent(master)}&limit=1&offset=0`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.body;
    });
  } catch { return NET_ERR; }
  const m = body?.jetton_masters?.[0];
  if (!m) return { ok: false, code: 'NOT_A_TOKEN', error: 'This address is not a jetton master.' };
  const content = m.jetton_content ?? {}; const info = Object.values(body?.metadata ?? {}).map((x: any) => x?.token_info?.[0]).find(Boolean) as any;
  const decimals = num(content.decimals ?? info?.extra?.decimals ?? 9);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return { ok: false, code: 'NOT_A_TOKEN', error: 'This jetton reports invalid decimals.' };
  const name = clean(content.name ?? info?.name, 64), symbol = clean(content.symbol ?? info?.symbol, 32);
  return { ok: true, token: { address: master, name, symbol, decimals, standard: 'JETTON' }, needsManual: !name || !symbol };
}

// ---------- Sui coins (suix_getBalance / suix_getCoinMetadata) ----------
export async function suiCoinBalance(chain: ChainInfo, owner: string, coinType: string, decimals: number, f: Fetcher): Promise<ChainTokenBalance> {
  try {
    const raw = await firstOf(endpointsOf(chain), async (u) => {
      const r = await rpc(f, u, 'suix_getBalance', [owner, coinType]); if (r.error) throw new Error(r.error.message ?? 'RPC error');
      return toBig(r.result?.totalBalance ?? 0);
    });
    return { ok: true, raw: raw.toString(), formatted: formatUnits(raw, decimals) };
  } catch (e: any) { return { ok: false, error: e?.message ?? 'balance unavailable' }; }
}
export async function probeSuiCoin(chain: ChainInfo, coinType: string, f: Fetcher): Promise<ChainProbe> {
  if (!isMoveCoinType(coinType)) return { ok: false, code: 'INVALID_ADDRESS', error: 'Enter a Sui coin type such as 0x2::sui::SUI.' };
  let meta: any;
  try {
    meta = await firstOf(endpointsOf(chain), async (u) => { const r = await rpc(f, u, 'suix_getCoinMetadata', [coinType]); if (r.error) throw new Error(r.error.message ?? 'RPC error'); return r.result; });
  } catch { return NET_ERR; }
  if (!meta) return { ok: false, code: 'NOT_A_TOKEN', error: 'No coin metadata was found for this coin type.' };
  const decimals = num(meta.decimals); if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return { ok: false, code: 'NOT_A_TOKEN', error: 'This coin reports invalid decimals.' };
  const name = clean(meta.name, 64), symbol = clean(meta.symbol, 32);
  return { ok: true, token: { address: coinType, name, symbol, decimals, standard: 'COIN' }, needsManual: !name || !symbol };
}

// ---------- Aptos coins (`0x1::coin`) and fungible assets (metadata object) ----------
const aptosView = (chain: ChainInfo, f: Fetcher, fn: string, typeArgs: string[], args: unknown[]) => firstOf(endpointsOf(chain), async (u) => {
  const r = await postJ(f, `${u}/view`, { function: fn, type_arguments: typeArgs, arguments: args }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.body;
});
export async function aptosBalance(chain: ChainInfo, owner: string, asset: string, decimals: number, f: Fetcher): Promise<ChainTokenBalance> {
  try {
    const b = isMoveCoinType(asset) ? await aptosView(chain, f, '0x1::coin::balance', [asset], [owner]) : await aptosView(chain, f, '0x1::primary_fungible_store::balance', ['0x1::fungible_asset::Metadata'], [owner, asset]);
    const raw = toBig(b?.[0] ?? 0); return { ok: true, raw: raw.toString(), formatted: formatUnits(raw, decimals) };
  } catch (e: any) { return { ok: false, error: e?.message ?? 'balance unavailable' }; }
}
export async function probeAptosAsset(chain: ChainInfo, asset: string, f: Fetcher): Promise<ChainProbe> {
  const coin = isMoveCoinType(asset);
  if (!coin && !isAptosFaAddress(asset)) return { ok: false, code: 'INVALID_ADDRESS', error: 'Enter an Aptos coin type (0x…::module::Name) or a fungible-asset address.' };
  const holder = coin ? asset.split('::')[0] : asset; const resource = coin ? `0x1::coin::CoinInfo<${asset}>` : '0x1::fungible_asset::Metadata';
  let r: any;
  try {
    r = await firstOf(endpointsOf(chain), async (u) => {
      const x = await getJ(f, `${u}/accounts/${holder}/resource/${encodeURIComponent(resource)}`);
      if (x.status === 404) return null; if (!x.ok) throw new Error(`HTTP ${x.status}`); return x.body;
    });
  } catch { return NET_ERR; }
  const d = r?.data; if (!d) return { ok: false, code: 'NOT_A_TOKEN', error: coin ? 'No coin info was found for this coin type.' : 'This address is not a fungible asset.' };
  const decimals = num(d.decimals); if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return { ok: false, code: 'NOT_A_TOKEN', error: 'This asset reports invalid decimals.' };
  const name = clean(d.name, 64), symbol = clean(d.symbol, 32);
  return { ok: true, token: { address: asset, name, symbol, decimals, standard: 'COIN' }, needsManual: !name || !symbol };
}

export function probeChainToken(chain: ChainInfo, address: string, f: Fetcher): Promise<ChainProbe> {
  const a = address.trim();
  if (chain.id === 'solana') return probeSpl(chain, a, f);
  if (chain.id === 'tron') return probeTrc20(chain, a, f);
  if (chain.id === 'ton') return probeJetton(chain, a, f);
  if (chain.id === 'sui') return probeSuiCoin(chain, a, f);
  if (chain.id === 'aptos') return probeAptosAsset(chain, a, f);
  return Promise.resolve({ ok: false, code: 'UNSUPPORTED_NETWORK', error: 'Custom tokens are not supported on this network yet.' });
}
export function chainTokenBalance(chain: ChainInfo, owner: string, token: { address: string; decimals: number }, f: Fetcher): Promise<ChainTokenBalance> {
  if (chain.id === 'solana') return splBalance(chain, owner, token.address, token.decimals, f);
  if (chain.id === 'tron') return trc20Balance(chain, owner, token.address, token.decimals, f);
  if (chain.id === 'ton') return jettonBalance(chain, owner, token.address, token.decimals, f);
  if (chain.id === 'sui') return suiCoinBalance(chain, owner, token.address, token.decimals, f);
  if (chain.id === 'aptos') return aptosBalance(chain, owner, token.address, token.decimals, f);
  return Promise.resolve({ ok: false, error: 'unsupported' });
}
