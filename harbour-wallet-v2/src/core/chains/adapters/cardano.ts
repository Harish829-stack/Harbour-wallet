// Cardano balance + Koios I/O (no wallet-core import: the balance adapter registry must stay wasm-free).
import type { ChainInfo } from '../types';
import type { BalanceAdapter, Fetcher } from './types';
import { fail, okRaw } from './types';

export const KOIOS = 'https://api.koios.rest/api/v1';
const base = (c?: ChainInfo) => ((c?.endpoints?.[0]) ?? KOIOS).replace(/\/$/, '');

async function kpost(f: Fetcher, url: string, body: unknown): Promise<any> {
  const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}
async function kget(f: Fetcher, url: string): Promise<any> {
  const r = await f(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}

export interface CardanoUtxo { txHash: string; index: number; lovelace: bigint; assets: Array<{ policyId: string; assetNameHex: string; quantity: bigint }> }
export async function cardanoAddressInfo(f: Fetcher, address: string, chain?: ChainInfo): Promise<{ balance: bigint; stakeAddress: string | null; utxos: CardanoUtxo[] }> {
  const rows = await kpost(f, `${base(chain)}/address_info`, { _addresses: [address] });
  const a = Array.isArray(rows) ? rows[0] : null;
  if (!a) return { balance: 0n, stakeAddress: null, utxos: [] };
  const utxos: CardanoUtxo[] = ((a.utxo_set ?? []) as any[]).map((u) => ({
    txHash: String(u.tx_hash), index: Number(u.tx_index), lovelace: BigInt(u.value ?? 0),
    assets: ((u.asset_list ?? []) as any[]).map((t) => ({ policyId: String(t.policy_id), assetNameHex: String(t.asset_name ?? ''), quantity: BigInt(t.quantity ?? 0) })),
  }));
  return { balance: BigInt(a.balance ?? 0), stakeAddress: a.stake_address ? String(a.stake_address) : null, utxos };
}
export async function cardanoTipSlot(f: Fetcher, chain?: ChainInfo): Promise<number> {
  const t = await kget(f, `${base(chain)}/tip`); const s = Number((Array.isArray(t) ? t[0] : t)?.abs_slot);
  if (!Number.isFinite(s) || s <= 0) throw new Error('No Cardano tip');
  return s;
}
export async function cardanoSubmit(f: Fetcher, cbor: Uint8Array, chain?: ChainInfo): Promise<string> {
  const r = await f(`${base(chain)}/submittx`, { method: 'POST', headers: { 'content-type': 'application/cbor' }, body: cbor, signal: AbortSignal.timeout(20000) });
  const t = (await r.text()).trim();
  if (!r.ok) throw new Error(t.slice(0, 300) || `HTTP ${r.status}`);
  return t.replace(/"/g, '');
}

export const cardanoBalance: BalanceAdapter = async (chain, address, f) => {
  try { return okRaw((await cardanoAddressInfo(f, address, chain)).balance, chain.decimals); } catch (e: any) { return fail(e?.message ?? 'failed'); }
};

