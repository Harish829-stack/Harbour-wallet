// Bitcoin PSBT (BIP-174) parsing, native-SegWit (P2WPKH, BIP-143, SIGHASH_ALL) signing and finalisation, plus a human summary for the approval screen.
// Scope on purpose: only P2WPKH inputs that belong to the connected key are signed; anything else is left untouched (or refused when asked for explicitly).
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { b64ToBytes, bytesToB64, b58encode } from './base58';
import { ERR, ProviderError } from './errors';

type KV = { key: Uint8Array; value: Uint8Array };
export interface TxIn { txid: Uint8Array; vout: number; sequence: number }
export interface TxOut { value: bigint; script: Uint8Array }
export interface Psbt { version: number; locktime: number; ins: TxIn[]; outs: TxOut[]; global: KV[]; inputs: KV[][]; outputs: KV[][] }
const bad = (m: string): never => { throw new ProviderError(ERR.INVALID_PARAMS, m); };
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const sha256d = (b: Uint8Array) => sha256(sha256(b));
const hash160 = (b: Uint8Array) => ripemd160(sha256(b));
const u32 = (n: number) => { const o = new Uint8Array(4); new DataView(o.buffer).setUint32(0, n >>> 0, true); return o; };
const u64 = (n: bigint) => { const o = new Uint8Array(8); new DataView(o.buffer).setBigUint64(0, n, true); return o; };
const varint = (n: number) => (n < 0xfd ? Uint8Array.of(n) : n <= 0xffff ? Uint8Array.of(0xfd, n & 0xff, n >> 8) : cat(Uint8Array.of(0xfe), u32(n)));
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

class Reader {
  p = 0; constructor(public b: Uint8Array) {}
  take(n: number) { if (n < 0 || this.p + n > this.b.length) bad('Malformed PSBT.'); const o = this.b.slice(this.p, this.p + n); this.p += n; return o; }
  u8() { return this.take(1)[0]; }
  u32() { return new DataView(this.take(4).buffer).getUint32(0, true); }
  u64() { return new DataView(this.take(8).buffer).getBigUint64(0, true); }
  varint() { const f = this.u8(); if (f < 0xfd) return f; if (f === 0xfd) { const b = this.take(2); return b[0] | (b[1] << 8); } if (f === 0xfe) return this.u32(); return bad('Unsupported varint.'); }
  get done() { return this.p >= this.b.length; }
}
function readMap(r: Reader): KV[] { const out: KV[] = []; for (;;) { const kl = r.varint(); if (kl === 0) return out; const key = r.take(kl); const value = r.take(r.varint()); out.push({ key, value }); if (out.length > 1000) bad('PSBT too large.'); } }
const writeMap = (m: KV[]) => cat(...m.map((e) => cat(varint(e.key.length), e.key, varint(e.value.length), e.value)), Uint8Array.of(0));
const findKV = (m: KV[], type: number) => m.find((e) => e.key.length >= 1 && e.key[0] === type);

export function parseTx(b: Uint8Array): { version: number; locktime: number; ins: TxIn[]; outs: TxOut[] } {
  const r = new Reader(b); const version = r.u32(); const nin = r.varint(); if (nin === 0 || nin > 500) bad('Unsupported transaction.');
  const ins: TxIn[] = []; for (let i = 0; i < nin; i++) { const txid = r.take(32); const vout = r.u32(); if (r.varint() !== 0) bad('PSBT inputs must be unsigned.'); ins.push({ txid, vout, sequence: r.u32() }); }
  const nout = r.varint(); if (nout === 0 || nout > 500) bad('Unsupported transaction.');
  const outs: TxOut[] = []; for (let i = 0; i < nout; i++) { const value = r.u64(); outs.push({ value, script: r.take(r.varint()) }); }
  const locktime = r.u32(); if (!r.done) bad('Malformed transaction.'); return { version, locktime, ins, outs };
}
export function decodePsbt(input: string): Psbt {
  const raw = /^[0-9a-fA-F]+$/.test(input) && input.length % 2 === 0 ? Uint8Array.from(input.match(/../g)!.map((h) => parseInt(h, 16))) : b64ToBytes(input);
  const r = new Reader(raw); if (!eq(r.take(5), Uint8Array.of(0x70, 0x73, 0x62, 0x74, 0xff))) bad('Not a PSBT.');
  const global = readMap(r); const g = findKV(global, 0x00); if (!g || g.key.length !== 1) bad('PSBT has no unsigned transaction (PSBT v2 is not supported).');
  const tx = parseTx(g!.value); const inputs = tx.ins.map(() => readMap(r)); const outputs = tx.outs.map(() => readMap(r)); if (!r.done) bad('Malformed PSBT.');
  return { ...tx, global, inputs, outputs };
}
export function encodePsbt(p: Psbt): Uint8Array { return cat(Uint8Array.of(0x70, 0x73, 0x62, 0x74, 0xff), writeMap(p.global), ...p.inputs.map(writeMap), ...p.outputs.map(writeMap)); }

/** UTXO being spent by input i: from witness_utxo (0x01) — the only form accepted for SegWit signing (amount is committed by the BIP-143 digest). */
export function inputUtxo(p: Psbt, i: number): TxOut | null {
  const w = findKV(p.inputs[i], 0x01); if (!w) return null; const r = new Reader(w.value); const value = r.u64(); const script = r.take(r.varint()); return { value, script };
}
export const p2wpkhScript = (pubkey: Uint8Array) => cat(Uint8Array.of(0x00, 0x14), hash160(pubkey));

/** BIP-143 digest for a P2WPKH input, SIGHASH_ALL. */
export function bip143Digest(p: Psbt, i: number, utxo: TxOut): Uint8Array {
  const prevouts = sha256d(cat(...p.ins.map((x) => cat(x.txid, u32(x.vout))))); const seqs = sha256d(cat(...p.ins.map((x) => u32(x.sequence))));
  const outs = sha256d(cat(...p.outs.map((o) => cat(u64(o.value), varint(o.script.length), o.script))));
  const scriptCode = cat(Uint8Array.of(0x19, 0x76, 0xa9, 0x14), utxo.script.slice(2), Uint8Array.of(0x88, 0xac));
  const x = p.ins[i];
  return sha256d(cat(u32(p.version), prevouts, seqs, x.txid, u32(x.vout), scriptCode, u64(utxo.value), u32(x.sequence), outs, u32(p.locktime), u32(1)));
}
/** r||s (64 bytes, low-S as produced by the signer) -> DER + SIGHASH_ALL. */
export function derSig(rs: Uint8Array): Uint8Array {
  const int = (b: Uint8Array) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; let v = b.slice(i); if (v[0] & 0x80) v = cat(Uint8Array.of(0), v); return cat(Uint8Array.of(0x02, v.length), v); };
  const body = cat(int(rs.slice(0, 32)), int(rs.slice(32, 64))); return cat(Uint8Array.of(0x30, body.length), body, Uint8Array.of(0x01));
}

export interface PsbtPlan { psbt: Psbt; inputs: Array<{ index: number; digest: Uint8Array }> }
/** Which inputs we will sign: P2WPKH inputs paying to OUR key (optionally limited to `only`). Refuses anything but SIGHASH_ALL. */
export function planPsbtSigning(p: Psbt, pubkey: Uint8Array, only?: number[]): PsbtPlan {
  const mine = p2wpkhScript(pubkey); const inputs: PsbtPlan['inputs'] = [];
  p.ins.forEach((_, i) => {
    if (only && !only.includes(i)) return; const u = inputUtxo(p, i); if (!u || !eq(u.script, mine)) { if (only) bad(`Input ${i} does not belong to the connected account.`); return; }
    const st = findKV(p.inputs[i], 0x03); if (st && new DataView(st.value.buffer, st.value.byteOffset).getUint32(0, true) !== 1) bad(`Input ${i} requests a sighash type Harbour does not sign.`);
    inputs.push({ index: i, digest: bip143Digest(p, i, u) });
  });
  if (!inputs.length) bad('No input in this PSBT can be signed by the connected account.');
  return { psbt: p, inputs };
}
/** Add the signatures; with `finalize`, turn them into final_scriptwitness and drop signing metadata (BIP-174 finalizer). */
export function applySignatures(plan: PsbtPlan, pubkey: Uint8Array, sigsRS: Uint8Array[], finalize: boolean): Psbt {
  const p: Psbt = { ...plan.psbt, inputs: plan.psbt.inputs.map((m) => m.slice()) };
  plan.inputs.forEach((x, k) => {
    const sig = derSig(sigsRS[k]);
    if (finalize) { const wit = cat(Uint8Array.of(2), varint(sig.length), sig, varint(pubkey.length), pubkey); p.inputs[x.index] = [...p.inputs[x.index].filter((e) => [0x01].includes(e.key[0])), { key: Uint8Array.of(0x08), value: wit }]; }
    else p.inputs[x.index] = [...p.inputs[x.index].filter((e) => !(e.key[0] === 0x02 && eq(e.key.slice(1), pubkey))), { key: cat(Uint8Array.of(0x02), pubkey), value: sig }];
  });
  return p;
}

// ---------------------------------------------------------------- addresses + summary
const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(v: number[]) { const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; let c = 1; for (const x of v) { const b = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((b >>> i) & 1) c ^= G[i]; } return c >>> 0; }
export function segwitAddress(hrp: string, ver: number, prog: Uint8Array): string {
  const data: number[] = [ver]; let acc = 0, bits = 0; for (const b of prog) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; data.push((acc >> bits) & 31); } } if (bits) data.push((acc << (5 - bits)) & 31);
  const expand = [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
  const mod = polymod([...expand, ...data, 0, 0, 0, 0, 0, 0]) ^ (ver === 0 ? 1 : 0x2bc830a3); const chk = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
  return hrp + '1' + [...data, ...chk].map((d) => CH[d]).join('');
}
const b58check = (v: number, h: Uint8Array) => { const body = cat(Uint8Array.of(v), h); return b58encode(cat(body, sha256d(body).slice(0, 4))); };
export function scriptToAddress(s: Uint8Array): string | null {
  if (s.length === 22 && s[0] === 0 && s[1] === 0x14) return segwitAddress('bc', 0, s.slice(2));
  if (s.length === 34 && s[0] === 0 && s[1] === 0x20) return segwitAddress('bc', 0, s.slice(2));
  if (s.length === 34 && s[0] === 0x51 && s[1] === 0x20) return segwitAddress('bc', 1, s.slice(2));
  if (s.length === 25 && s[0] === 0x76 && s[1] === 0xa9 && s[2] === 0x14 && s[23] === 0x88 && s[24] === 0xac) return b58check(0x00, s.slice(3, 23));
  if (s.length === 23 && s[0] === 0xa9 && s[1] === 0x14 && s[22] === 0x87) return b58check(0x05, s.slice(2, 22));
  return null;
}
export function describePsbt(p: Psbt, pubkey: Uint8Array, signable: number[]): { outputs: Array<{ address: string; sats: string; yours: boolean }>; feeSats: string | null; inputSats: string | null; signing: number; inputs: number } {
  const mine = p2wpkhScript(pubkey); let inSum = 0n, known = true;
  p.ins.forEach((_, i) => { const u = inputUtxo(p, i); if (u) inSum += u.value; else known = false; });
  const outSum = p.outs.reduce((a, o) => a + o.value, 0n);
  return { outputs: p.outs.map((o) => ({ address: scriptToAddress(o.script) ?? `script ${hex(o.script).slice(0, 40)}…`, sats: o.value.toString(), yours: eq(o.script, mine) })), feeSats: known ? (inSum - outSum).toString() : null, inputSats: known ? inSum.toString() : null, signing: signable.length, inputs: p.ins.length };
}
export const psbtToB64 = (p: Psbt) => bytesToB64(encodePsbt(p)); export const psbtToHex = (p: Psbt) => hex(encodePsbt(p));
