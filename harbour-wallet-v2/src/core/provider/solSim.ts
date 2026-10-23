// Solana pre-sign simulation: run the transaction (unsigned, fresh blockhash) and report whether it would fail and how our SOL balance changes.
export interface SolSimResult { ok: boolean; error?: string; solDelta?: bigint; unitsConsumed?: number }
type Rpc = (method: string, params: unknown[]) => Promise<any>;
export async function simulateSolTx(rpc: Rpc, txBytes: Uint8Array, wallet: string): Promise<SolSimResult> {
  try {
    let s = ''; for (const x of txBytes) s += String.fromCharCode(x);
    const before = Number((await rpc('getBalance', [wallet, { commitment: 'processed' }]))?.value ?? NaN);
    const r = await rpc('simulateTransaction', [btoa(s), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed', accounts: { encoding: 'base64', addresses: [wallet] } }]);
    const v = r?.value; if (!v) return { ok: false, error: 'No simulation result' };
    if (v.err) return { ok: false, error: typeof v.err === 'string' ? v.err : JSON.stringify(v.err).slice(0, 160) };
    const after = Number(v.accounts?.[0]?.lamports ?? NaN);
    return { ok: true, solDelta: Number.isFinite(before) && Number.isFinite(after) ? BigInt(after) - BigInt(before) : undefined, unitsConsumed: v.unitsConsumed };
  } catch (e: any) { return { ok: false, error: String(e?.message ?? e).slice(0, 160) }; }
}
/** Fetch an account's raw data (base64) for lookup-table resolution. */
export async function solAccountData(rpc: Rpc, address: string): Promise<Uint8Array | null> {
  const r = await rpc('getAccountInfo', [address, { encoding: 'base64', commitment: 'confirmed' }]);
  const b64 = r?.value?.data?.[0]; if (typeof b64 !== 'string') return null;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
