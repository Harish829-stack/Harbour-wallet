import { tokenRisk, addressRisk, type RiskReport } from '../providers/goplus';
import { isKilled } from '../failover';
const SAFE: RiskReport = { risky: false, flags: [] };
// Advisory checks: errors and kill-switched providers degrade to "no signal" rather than blocking the user.
export async function checkToken(chainId: number, address: string): Promise<RiskReport> {
  if (isKilled('goplus')) return SAFE; try { return await tokenRisk(chainId, address); } catch { return SAFE; }
}
export async function checkAddress(chainId: number, address: string): Promise<RiskReport> {
  if (isKilled('goplus')) return SAFE; try { return await addressRisk(chainId, address); } catch { return SAFE; }
}

/** Transaction preview via eth_simulateV1 where the RPC supports it. Returns null when unsupported (never blocks). */
export async function simulateCall(rpcUrl: string, call: { from: string; to: string; data?: string; value?: string }): Promise<{ ok: boolean; gasUsed?: string; error?: string } | null> {
  try {
    const res = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_simulateV1', params: [{ blockStateCalls: [{ calls: [call] }], validation: true }, 'latest'] }) });
    const j: any = await res.json();
    const c = j?.result?.[0]?.calls?.[0];
    if (!c) return null;
    return c.status === '0x1' ? { ok: true, gasUsed: c.gasUsed } : { ok: false, error: c.error?.message ?? 'reverted' };
  } catch { return null; }
}
