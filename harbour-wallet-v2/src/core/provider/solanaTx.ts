// Minimal Solana transaction parser/describer for the approval screen and for signing the right signature slot.
// Handles legacy and v0 messages; address-table lookups are reported as "unresolved" (never silently ignored).
import { b58encode } from './base58';

export interface SolInstruction { programIndex: number; accountIndexes: number[]; data: Uint8Array }
export interface SolTx {
  version: 'legacy' | number; sigCount: number; sigOffset: number; msgOffset: number; message: Uint8Array;
  numRequiredSignatures: number; numReadonlySigned: number; numReadonlyUnsigned: number;
  keys: string[]; keyBytes: Uint8Array[]; blockhash: string; instructions: SolInstruction[]; lookups: number;
}
function cu16(b: Uint8Array, p: number): { v: number; n: number } {
  let v = 0, shift = 0, n = 0;
  for (; n < 3; n++) { const byte = b[p + n]; if (byte === undefined) throw new Error('bad tx'); v |= (byte & 0x7f) << shift; if (!(byte & 0x80)) return { v, n: n + 1 }; shift += 7; }
  throw new Error('bad tx');
}
export function parseSolTx(bytes: Uint8Array): SolTx {
  const sc = cu16(bytes, 0); const sigOffset = sc.n; const msgOffset = sc.n + sc.v * 64;
  if (sc.v < 1 || msgOffset >= bytes.length) throw new Error('bad tx');
  const message = bytes.slice(msgOffset); let p = 0; let version: 'legacy' | number = 'legacy';
  if (message[0] & 0x80) { version = message[0] & 0x7f; if (version !== 0) throw new Error('unsupported tx version'); p = 1; }
  const numRequiredSignatures = message[p], numReadonlySigned = message[p + 1], numReadonlyUnsigned = message[p + 2]; p += 3;
  if (numRequiredSignatures === undefined || numRequiredSignatures < 1) throw new Error('bad tx');
  const nk = cu16(message, p); p += nk.n; const keyBytes: Uint8Array[] = [];
  for (let i = 0; i < nk.v; i++) { const k = message.slice(p, p + 32); if (k.length !== 32) throw new Error('bad tx'); keyBytes.push(k); p += 32; }
  if (numRequiredSignatures > keyBytes.length || sc.v !== numRequiredSignatures) throw new Error('bad tx');
  const bh = message.slice(p, p + 32); if (bh.length !== 32) throw new Error('bad tx'); p += 32;
  const ni = cu16(message, p); p += ni.n; const instructions: SolInstruction[] = [];
  for (let i = 0; i < ni.v; i++) {
    const programIndex = message[p++]; if (programIndex === undefined) throw new Error('bad tx');
    const na = cu16(message, p); p += na.n; const accountIndexes = Array.from(message.slice(p, p + na.v)); if (accountIndexes.length !== na.v) throw new Error('bad tx'); p += na.v;
    const nd = cu16(message, p); p += nd.n; const data = message.slice(p, p + nd.v); if (data.length !== nd.v) throw new Error('bad tx'); p += nd.v;
    instructions.push({ programIndex, accountIndexes, data });
  }
  let lookups = 0;
  if (version === 0) { const nl = cu16(message, p); p += nl.n; lookups = nl.v; }
  return { version, sigCount: sc.v, sigOffset, msgOffset, message, numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned, keys: keyBytes.map(b58encode), keyBytes, blockhash: b58encode(bh), instructions, lookups };
}
/** Index of `address` among the required signers (the signature slot to fill), or -1. */
export const signerSlot = (tx: SolTx, address: string): number => tx.keys.slice(0, tx.numRequiredSignatures).indexOf(address);
export function withSignature(bytes: Uint8Array, tx: SolTx, slot: number, sig: Uint8Array): Uint8Array {
  if (sig.length !== 64 || slot < 0 || slot >= tx.sigCount) throw new Error('bad signature slot'); const out = bytes.slice(); out.set(sig, tx.sigOffset + slot * 64); return out;
}

export const PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program', TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'Token Program', TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022 Program',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Associated Token Account', ComputeBudget111111111111111111111111111111: 'Compute Budget', MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: 'Memo', Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo: 'Memo (v1)',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter Aggregator v6',
};
const u64 = (d: Uint8Array, o: number): bigint => { let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(d[o + i] ?? 0); return v; };
const u32 = (d: Uint8Array, o: number): number => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
export type SolWarning = 'authority' | 'delegate' | 'close' | 'unresolved' | 'unknownProgram' | 'feePayerNotYou';
export interface SolInstructionView { program: string; programId: string; title: string; details: Array<[string, string]>; warning?: SolWarning }
const AUTH_TYPES = ['Mint tokens', 'Freeze account', 'Account owner', 'Close account'];

export function describeSolInstruction(tx: SolTx, ix: SolInstruction): SolInstructionView {
  const programId = tx.keys[ix.programIndex] ?? '?'; const program = PROGRAMS[programId] ?? 'Unknown program'; const acct = (i: number) => tx.keys[ix.accountIndexes[i]] ?? '(lookup table account)';
  const d = ix.data; const view: SolInstructionView = { program, programId, title: program, details: [] };
  if (!tx.keys[ix.programIndex]) { view.warning = 'unresolved'; return view; }
  if (programId === '11111111111111111111111111111111') {
    const tag = u32(d, 0);
    if (tag === 2 && d.length >= 12) { view.title = 'Transfer SOL'; view.details = [['From', acct(0)], ['To', acct(1)], ['Amount (lamports)', u64(d, 4).toString()]]; }
    else if (tag === 0) { view.title = 'Create account'; view.details = [['New account', acct(1)], ['Lamports', u64(d, 4).toString()]]; }
    else if (tag === 1) { view.title = 'Assign account owner'; view.warning = 'authority'; view.details = [['Account', acct(0)]]; }
    else view.title = `System instruction #${tag}`;
  } else if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' || programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
    const tag = d[0];
    if (tag === 3 && d.length >= 9) { view.title = 'Transfer token'; view.details = [['From', acct(0)], ['To', acct(1)], ['Amount (base units)', u64(d, 1).toString()]]; }
    else if (tag === 12 && d.length >= 10) { view.title = 'Transfer token'; view.details = [['From', acct(0)], ['Mint', acct(1)], ['To', acct(2)], ['Amount (base units)', u64(d, 1).toString()], ['Decimals', String(d[9])]]; }
    else if ((tag === 4 && d.length >= 9) || (tag === 13 && d.length >= 10)) { view.title = 'Approve delegate'; view.warning = 'delegate'; view.details = [['Token account', acct(0)], ['Delegate', acct(tag === 4 ? 1 : 2)], ['Amount (base units)', u64(d, 1).toString()]]; }
    else if (tag === 5) { view.title = 'Revoke delegate'; view.details = [['Token account', acct(0)]]; }
    else if (tag === 6) { view.title = 'Set authority'; view.warning = 'authority'; view.details = [['Account', acct(0)], ['Authority type', AUTH_TYPES[d[1]] ?? String(d[1])], ['New authority', d[2] === 1 && d.length >= 35 ? b58encode(d.slice(3, 35)) : 'None (permanently revoked)']]; }
    else if (tag === 9) { view.title = 'Close token account'; view.warning = 'close'; view.details = [['Account', acct(0)], ['Remaining balance to', acct(1)]]; }
    else if (tag === 7) { view.title = 'Mint tokens'; view.details = [['Mint', acct(0)], ['To', acct(1)], ['Amount (base units)', u64(d, 1).toString()]]; }
    else view.title = `Token instruction #${tag}`;
  } else if (programId === 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') { view.title = 'Create token account'; view.details = [['Payer', acct(0)], ['Account', acct(1)], ['Owner', acct(2)], ['Mint', acct(3)]]; }
  else if (programId === 'ComputeBudget111111111111111111111111111111') {
    if (d[0] === 2 && d.length >= 5) { view.title = 'Set compute unit limit'; view.details = [['Units', String(u32(d, 1))]]; } else if (d[0] === 3 && d.length >= 9) { view.title = 'Set priority fee'; view.details = [['Micro-lamports per unit', u64(d, 1).toString()]]; } else view.title = 'Compute budget';
  } else if (programId.startsWith('Memo')) { view.title = 'Memo'; try { view.details = [['Text', new TextDecoder('utf-8', { fatal: true }).decode(d).slice(0, 200)]]; } catch { /* binary memo */ } }
  else { view.warning = PROGRAMS[programId] ? undefined : 'unknownProgram'; view.details = [['Accounts', String(ix.accountIndexes.length)], ['Data bytes', String(d.length)]]; }
  return view;
}
export function describeSolTx(bytes: Uint8Array, wallet: string): { feePayer: string; version: string; blockhash: string; instructions: SolInstructionView[]; warnings: SolWarning[]; signerSlot: number; requiredSigners: number } {
  const tx = parseSolTx(bytes); const instructions = tx.instructions.map((i) => describeSolInstruction(tx, i)); const warnings = new Set<SolWarning>(instructions.map((i) => i.warning).filter((w): w is SolWarning => !!w));
  if (tx.lookups > 0) warnings.add('unresolved'); if (tx.keys[0] !== wallet) warnings.add('feePayerNotYou');
  return { feePayer: tx.keys[0], version: String(tx.version), blockhash: tx.blockhash, instructions, warnings: [...warnings], signerSlot: signerSlot(tx, wallet), requiredSigners: tx.numRequiredSignatures };
}
