// Solana pre-sign simulation: run the transaction (unsigned, fresh blockhash) and report whether it would fail and how the wallet's SOL
// AND SPL-token balances change. Token changes compare the user's token accounts before (getTokenAccountsByOwner) with their state after
// the simulated run (simulateTransaction `accounts`), for Token and Token-2022. Only writable accounts can change, so only those are watched.
// It also flags the two drainer patterns that move no tokens at signing time: handing a token account to another owner (SetAuthority)
// and letting another address spend it (Approve).
import { b58encode, b64ToBytes } from './base58';
import { parseSolTx, type SolTx } from './solanaTx';

export const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const KNOWN_MINT: Record<string, { symbol: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', decimals: 6 }, Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', decimals: 6 },
  So11111111111111111111111111111111111111112: { symbol: 'wSOL', decimals: 9 },
};
const MAX_WATCHED = 40;
export type SolTokenWarning = 'tokenOwnerChanged' | 'tokenDelegated';
export interface SolTokenChange { mint: string; amount: string; direction: 'in' | 'out'; symbol: string | null; decimals: number | null }
export interface SolSimResult { ok: boolean; error?: string; solDelta?: bigint; unitsConsumed?: number; tokenChanges?: SolTokenChange[]; tokenWarnings?: SolTokenWarning[]; tokensChecked?: boolean }
type Rpc = (method: string, params: unknown[]) => Promise<any>;

/** SPL Token account (165-byte base layout, shared by Token-2022). */
export interface SplAccount { mint: string; owner: string; amount: bigint; delegate: string | null; delegatedAmount: bigint }
export function decodeSplAccount(data: Uint8Array): SplAccount | null {
  if (!(data instanceof Uint8Array) || data.length < 165) return null;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { mint: b58encode(data.slice(0, 32)), owner: b58encode(data.slice(32, 64)), amount: dv.getBigUint64(64, true),
    delegate: dv.getUint32(72, true) === 1 ? b58encode(data.slice(76, 108)) : null, delegatedAmount: dv.getBigUint64(121, true) };
}
/** Accounts the transaction may write: writable static keys plus resolved lookup-table writables. */
export function writableKeys(tx: SolTx): string[] {
  const nStatic = tx.keyBytes.length; const out: string[] = [];
  for (let i = 0; i < nStatic; i++) {
    const w = i < tx.numRequiredSignatures ? i < tx.numRequiredSignatures - tx.numReadonlySigned : i < nStatic - tx.numReadonlyUnsigned;
    if (w) out.push(tx.keys[i]);
  }
  if (!tx.lookups) out.push(...tx.keys.slice(nStatic, nStatic + tx.tables.reduce((n, t) => n + t.writable.length, 0)));
  return out;
}
const accData = (a: any): Uint8Array | null => { const d = a?.data; try { return Array.isArray(d) && typeof d[0] === 'string' ? b64ToBytes(d[0]) : null; } catch { return null; } };

/** Net token change per mint for `wallet`, from token accounts before and after. Pure: tested directly. */
export function tokenDiff(wallet: string, pre: Map<string, SplAccount>, post: Map<string, SplAccount | null>): { changes: Map<string, bigint>; warnings: Set<SolTokenWarning> } {
  const changes = new Map<string, bigint>(); const warnings = new Set<SolTokenWarning>();
  const add = (mint: string, d: bigint) => { if (d !== 0n) changes.set(mint, (changes.get(mint) ?? 0n) + d); };
  for (const [addr, after] of post) {
    const before = pre.get(addr);
    if (before) {
      if (!after) { add(before.mint, -before.amount); continue; }                                        // closed: its balance left
      if (after.owner !== wallet) { warnings.add('tokenOwnerChanged'); add(before.mint, -before.amount); continue; } // no longer yours
      add(before.mint, after.amount - before.amount);
      if (after.delegate && after.delegatedAmount > 0n && (after.delegate !== before.delegate || after.delegatedAmount > before.delegatedAmount)) warnings.add('tokenDelegated');
    } else if (after && after.owner === wallet) add(after.mint, after.amount);                           // new account of yours: incoming
  }
  for (const [m, v] of [...changes]) if (v === 0n) changes.delete(m);
  return { changes, warnings };
}

export async function simulateSolTx(rpc: Rpc, txBytes: Uint8Array, wallet: string, parsed?: SolTx): Promise<SolSimResult> {
  try {
    let s = ''; for (const x of txBytes) s += String.fromCharCode(x);
    // Token accounts the wallet owns now (both token programs). Failure -> SOL-only preview, reported as unchecked.
    const pre = new Map<string, SplAccount>(); let tokensChecked = true;
    try {
      const lists = await Promise.all(TOKEN_PROGRAMS.map((programId) => rpc('getTokenAccountsByOwner', [wallet, { programId }, { encoding: 'base64', commitment: 'processed' }])));
      for (const l of lists) for (const it of Array.isArray(l?.value) ? l.value : []) { const d = accData(it?.account); const a = d && decodeSplAccount(d); if (a && typeof it.pubkey === 'string') pre.set(it.pubkey, a); }
    } catch { tokensChecked = false; }
    let tx: SolTx | null = parsed ?? null; if (!tx) { try { tx = parseSolTx(txBytes); } catch { tx = null; } }
    const watched = tokensChecked && tx ? [...new Set(writableKeys(tx))].filter((k) => k !== wallet).slice(0, MAX_WATCHED) : [];
    const before = Number((await rpc('getBalance', [wallet, { commitment: 'processed' }]))?.value ?? NaN);
    const r = await rpc('simulateTransaction', [btoa(s), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed', accounts: { encoding: 'base64', addresses: [wallet, ...watched] } }]);
    const v = r?.value; if (!v) return { ok: false, error: 'No simulation result' };
    if (v.err) return { ok: false, error: typeof v.err === 'string' ? v.err : JSON.stringify(v.err).slice(0, 160) };
    const after = Number(v.accounts?.[0]?.lamports ?? NaN);
    const out: SolSimResult = { ok: true, solDelta: Number.isFinite(before) && Number.isFinite(after) ? BigInt(after) - BigInt(before) : undefined, unitsConsumed: v.unitsConsumed, tokensChecked: tokensChecked && !!tx };
    if (out.tokensChecked) {
      const post = new Map<string, SplAccount | null>();
      watched.forEach((addr, i) => {
        const a = v.accounts?.[i + 1];
        if (!pre.has(addr) && !a) return;
        const d = a && TOKEN_PROGRAMS.includes(a.owner) ? accData(a) : null; post.set(addr, d ? decodeSplAccount(d) : null);
      });
      const { changes, warnings } = tokenDiff(wallet, pre, post);
      const unknown = [...changes.keys()].filter((m) => !KNOWN_MINT[m]);
      const dec = new Map<string, number>();
      if (unknown.length) {
        try { const m = await rpc('getMultipleAccounts', [unknown, { encoding: 'base64', commitment: 'processed' }]); (m?.value ?? []).forEach((acc: any, i: number) => { const d = accData(acc); if (d && d.length >= 45) dec.set(unknown[i], d[44]); }); } catch { /* decimals unknown */ }
      }
      out.tokenChanges = [...changes].slice(0, 12).map(([mint, n]) => ({ mint, amount: (n < 0n ? -n : n).toString(), direction: n < 0n ? 'out' : 'in', symbol: KNOWN_MINT[mint]?.symbol ?? null, decimals: KNOWN_MINT[mint]?.decimals ?? dec.get(mint) ?? null }));
      out.tokenWarnings = [...warnings];
    }
    return out;
  } catch (e: any) { return { ok: false, error: String(e?.message ?? e).slice(0, 160) }; }
}
/** Fetch an account's raw data (base64) for lookup-table resolution. */
export async function solAccountData(rpc: Rpc, address: string): Promise<Uint8Array | null> {
  const r = await rpc('getAccountInfo', [address, { encoding: 'base64', commitment: 'confirmed' }]);
  const b64 = r?.value?.data?.[0]; if (typeof b64 !== 'string') return null;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
