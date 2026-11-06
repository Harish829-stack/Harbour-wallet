import { http } from '../httpClient';
// GoPlus Security API (free tier): token, address and approval risk. All calls are advisory; failure never blocks a transaction.
export interface RiskReport { risky: boolean; flags: string[] }
const flag = (v: unknown) => v === '1' || v === 1 || v === true;

export async function tokenRisk(chainId: number, address: string): Promise<RiskReport> {
  const a = address.toLowerCase();
  const j = await http.json<{ result?: Record<string, any> }>(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${a}`, { cacheTtlMs: 300_000, retries: 1 });
  const r = j.result?.[a];
  if (!r) return { risky: false, flags: [] };
  const flags: string[] = [];
  if (flag(r.is_honeypot)) flags.push('honeypot');
  if (flag(r.cannot_sell_all)) flags.push('cannot_sell_all');
  if (flag(r.is_blacklisted)) flags.push('blacklist');
  if (flag(r.hidden_owner)) flags.push('hidden_owner');
  if (flag(r.is_mintable)) flags.push('mintable');
  if (Number(r.sell_tax) > 0.3 || Number(r.buy_tax) > 0.3) flags.push('high_tax');
  return { risky: flags.some((f) => f !== 'mintable'), flags };
}
export async function addressRisk(chainId: number, address: string): Promise<RiskReport> {
  const j = await http.json<{ result?: Record<string, any> }>(`https://api.gopluslabs.io/api/v1/address_security/${address}?chain_id=${chainId}`, { cacheTtlMs: 300_000, retries: 1 });
  const r = j.result ?? {};
  const flags = Object.entries(r).filter(([k, v]) => k !== 'data_source' && flag(v)).map(([k]) => k);
  return { risky: flags.length > 0, flags };
}
