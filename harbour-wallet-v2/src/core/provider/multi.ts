// Non-EVM, non-Solana dApp provider families (Keplr-style Cosmos, Sui, Aptos, TronLink-style Tron, Bitcoin message signing) behind ONE generic namespace ('multi').
// Everything here is pure: parameter validation, the exact bytes that get signed, and how signatures are packaged for each wallet API.
// The signer only ever receives (chain, scheme, bytes); it never sees dApp-shaped objects.
import { sha256 } from '@noble/hashes/sha256';
import { sha3_256, keccak_256 } from '@noble/hashes/sha3';
import { blake2b } from '@noble/hashes/blake2b';
import { ERR, ProviderError } from './errors';
import { b64ToBytes, bytesToB64 } from './base58';
import { decodePsbt, describePsbt, planPsbtSigning } from './psbt';

export type MultiOp = 'message' | 'tx' | 'amino' | 'direct' | 'send' | 'psbt';
export type Scheme = 'secp256k1' | 'ed25519';
import { MULTI_CHAINS, isMultiChain, chainOfCosmosId } from './multiChains';
export { MULTI_CHAINS, isMultiChain, chainOfCosmosId };

const bad = (m: string): never => { throw new ProviderError(ERR.INVALID_PARAMS, m); };
const utf8 = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => { const s = h.replace(/^0x/i, ''); if (!/^([0-9a-fA-F]{2})*$/.test(s)) bad('Expected hex.'); const o = new Uint8Array(s.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return o; };
const concat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const uleb = (n: number) => { const o: number[] = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return Uint8Array.from(o); };
const varint = (n: bigint) => { const o: number[] = []; do { let b = Number(n & 0x7fn); n >>= 7n; if (n) b |= 0x80; o.push(b); } while (n); return Uint8Array.from(o); };
const MAX_MSG = 64 * 1024;
const str = (v: unknown, what: string, max = 4096): string => (typeof v === 'string' && v.length <= max ? v : bad(`${what} must be a string.`));
const b64 = (v: unknown, what: string, max = MAX_MSG): Uint8Array => { const s = str(v, what, max * 2); try { const b = b64ToBytes(s); if (b.length > max) bad(`${what} too large.`); return b; } catch (e) { if (e instanceof ProviderError) throw e; return bad(`${what} must be base64.`); } };

// ---------------------------------------------------------------- Cosmos (Keplr): amino JSON, SignDoc protobuf, ADR-36 arbitrary data
const sortObj = (v: any): any => (Array.isArray(v) ? v.map(sortObj) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortObj(v[k])])) : v);
/** Cosmos "sortedJsonStringify" + the escaping the chains apply to <, > and &. */
export const aminoSignBytes = (doc: unknown): Uint8Array => utf8(JSON.stringify(sortObj(doc)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'));
const pbBytes = (tag: number, b: Uint8Array) => concat(Uint8Array.of(tag), varint(BigInt(b.length)), b);
/** cosmos.tx.v1beta1.SignDoc { body_bytes=1, auth_info_bytes=2, chain_id=3, account_number=4 } */
export function directSignBytes(body: Uint8Array, authInfo: Uint8Array, chainId: string, accountNumber: string): Uint8Array {
  return concat(pbBytes(0x0a, body), pbBytes(0x12, authInfo), pbBytes(0x1a, utf8(chainId)), Uint8Array.of(0x20), varint(BigInt(accountNumber)));
}
function pbFields(b: Uint8Array): Array<{ tag: number; wire: number; bytes?: Uint8Array; num?: bigint }> {
  const out: Array<{ tag: number; wire: number; bytes?: Uint8Array; num?: bigint }> = []; let p = 0;
  const rv = () => { let r = 0n, s = 0n; for (;;) { if (p >= b.length) throw new Error('eof'); const x = b[p++]; r |= BigInt(x & 0x7f) << s; if (!(x & 0x80)) return r; s += 7n; } };
  while (p < b.length) { const k = Number(rv()); const wire = k & 7; const tag = k >> 3; if (wire === 0) out.push({ tag, wire, num: rv() }); else if (wire === 2) { const n = Number(rv()); if (p + n > b.length) throw new Error('eof'); out.push({ tag, wire, bytes: b.slice(p, p + n) }); p += n; } else if (wire === 1) { p += 8; } else if (wire === 5) { p += 4; } else throw new Error('wire'); }
  return out;
}
/** Message type URLs inside a TxBody (field 1 = repeated Any{ type_url=1 }). Used so the approval screen can say WHAT is being signed. */
export function cosmosBodyTypes(body: Uint8Array): string[] {
  try { return pbFields(body).filter((f) => f.tag === 1 && f.bytes).map((f) => new TextDecoder().decode(pbFields(f.bytes!).find((g) => g.tag === 1)?.bytes ?? new Uint8Array())).filter(Boolean); } catch { return []; }
}

// ---------------------------------------------------------------- Aptos
export function aptosFullMessage(p: { message: string; nonce: string; address?: boolean; application?: boolean; chainId?: boolean }, ctx: { address: string; chainId?: number; application?: string }): string {
  const lines = ['APTOS'];
  if (p.address) lines.push(`address: ${ctx.address}`);
  if (p.application) lines.push(`application: ${ctx.application ?? ''}`);
  if (p.chainId) lines.push(`chainId: ${ctx.chainId ?? 1}`);
  lines.push(`message: ${p.message}`, `nonce: ${p.nonce}`);
  return lines.join('\n');
}
const APTOS_RAW_TX_PREFIX = sha3_256(utf8('APTOS::RawTransaction'));

// ---------------------------------------------------------------- Tron
const tronMsgDigest = (m: Uint8Array) => keccak_256(concat(utf8('\x19TRON Signed Message:\n' + m.length), m));
/** Minimal Transaction.raw decode for the approval screen: contract type URLs and TransferContract amount/addresses (hex). */
export function describeTron(rawHex: string): { contracts: string[]; transfer?: { owner: string; to: string; amount: string } } {
  try {
    const raw = pbFields(unhex(rawHex)); const out: { contracts: string[]; transfer?: { owner: string; to: string; amount: string } } = { contracts: [] };
    for (const c of raw.filter((f) => f.tag === 11 && f.bytes)) {
      const param = pbFields(c.bytes!).find((f) => f.tag === 2 && f.bytes); if (!param) continue;
      const any = pbFields(param.bytes!); const url = new TextDecoder().decode(any.find((f) => f.tag === 1)?.bytes ?? new Uint8Array()); out.contracts.push(url.split('.').pop() ?? url);
      if (url.endsWith('TransferContract')) { const v = pbFields(any.find((f) => f.tag === 2)?.bytes ?? new Uint8Array()); out.transfer = { owner: hex(v.find((f) => f.tag === 1)?.bytes ?? new Uint8Array()), to: hex(v.find((f) => f.tag === 2)?.bytes ?? new Uint8Array()), amount: String(v.find((f) => f.tag === 3)?.num ?? 0n) }; }
    }
    return out;
  } catch { return { contracts: [] }; }
}

// ---------------------------------------------------------------- Bitcoin (BIP-137 message signing and PSBT signing)
const btcMsgDigest = (m: Uint8Array) => sha256(sha256(concat(utf8('\x18Bitcoin Signed Message:\n'), varint(BigInt(m.length)), m)));

// ---------------------------------------------------------------- request normalisation
export interface MultiRequest { chain: string; op: MultiOp; method: string; summary: { kind: string; text?: string; hex?: string; types?: string[]; detail?: Record<string, string> }; data: Record<string, any> }
const OPS: Record<string, MultiOp> = { signMessage: 'message', signTransaction: 'tx', signAmino: 'amino', signDirect: 'direct', signAndSend: 'send', sendTransaction: 'send', signPsbt: 'psbt' };

export function normalizeMultiSign(method: string, params: unknown, ctx: { address: string; publicKey?: string; detail?: Record<string, string> }): MultiRequest {
  const op = OPS[method]; if (!op) throw new ProviderError(ERR.METHOD_NOT_FOUND);
  const p = (params && typeof params === 'object' && !Array.isArray(params) ? params : bad('Params must be an object.')) as Record<string, any>;
  const chain = p.chain; if (!isMultiChain(chain)) bad('Unsupported chain.');
  const fam = MULTI_CHAINS[chain as string].family;
  const need = (ok: boolean, msg: string) => { if (!ok) throw new ProviderError(ERR.UNSUPPORTED_METHOD, msg); };
  switch (fam) {
    case 'cosmos': {
      const cid = MULTI_CHAINS[chain].cosmosChainId!;
      if (op === 'message') { const data = typeof p.data === 'string' ? utf8(p.data.slice(0, MAX_MSG)) : b64(p.dataB64, 'data'); if (p.signer !== undefined && p.signer !== ctx.address) bad('signer does not match the connected account.');
        return { chain, op, method, summary: { kind: 'message', text: tryText(data) ?? undefined, hex: '0x' + hex(data), detail: { Standard: 'ADR-36 arbitrary data' } }, data: { dataB64: bytesToB64(data) } }; }
      if (p.chainId !== cid) bad('chainId does not match the connected chain.');
      if (p.signer !== ctx.address) bad('signer does not match the connected account.');
      if (op === 'amino') {
        const doc = p.signDoc; if (!doc || typeof doc !== 'object' || doc.chain_id !== cid || !Array.isArray(doc.msgs)) bad('Invalid StdSignDoc.');
        const types = (doc.msgs as any[]).map((m) => String(m?.type ?? '?')).slice(0, 20);
        return { chain, op, method, summary: { kind: 'cosmosTx', types, detail: { 'Chain ID': cid, Memo: String(doc.memo ?? ''), Fee: JSON.stringify(doc.fee ?? {}) } }, data: { doc } };
      }
      if (op === 'direct') {
        const body = b64(p.bodyBytes, 'bodyBytes'); const auth = b64(p.authInfoBytes, 'authInfoBytes'); const an = str(p.accountNumber, 'accountNumber', 24); if (!/^\d+$/.test(an)) bad('accountNumber must be digits.');
        return { chain, op, method, summary: { kind: 'cosmosTx', types: cosmosBodyTypes(body), detail: { 'Chain ID': cid, 'Account number': an } }, data: { bodyB64: bytesToB64(body), authB64: bytesToB64(auth), accountNumber: an } };
      }
      return need(false, 'Unsupported Cosmos method.') as never;
    }
    case 'sui': {
      if (op === 'message') { const m = b64(p.messageB64, 'message'); return { chain, op, method, summary: { kind: 'message', text: tryText(m) ?? undefined, hex: '0x' + hex(m) }, data: { messageB64: bytesToB64(m) } }; }
      if (op === 'tx' || op === 'send') { const t = b64(p.txB64, 'transaction', 256 * 1024); return { chain, op, method, summary: { kind: ctx.detail ? 'builtTx' : 'rawTx', hex: '0x' + hex(t.slice(0, 64)), detail: { ...(ctx.detail ?? { Note: 'Transaction bytes are shown unparsed. Only sign on sites you trust.' }), Size: `${t.length} bytes`, ...(op === 'send' ? { Action: 'Signs and submits to the network' } : {}) } }, data: { txB64: bytesToB64(t) } }; }
      return need(false, 'Unsupported Sui method.') as never;
    }
    case 'aptos': {
      if (op === 'message') {
        const message = str(p.message, 'message', MAX_MSG); const nonce = str(p.nonce ?? '', 'nonce', 128);
        const full = aptosFullMessage({ message, nonce, address: p.address === true, application: p.application === true, chainId: p.chainId === true }, { address: ctx.address, chainId: Number.isFinite(p.networkChainId) ? p.networkChainId : 1, application: str(p.appName ?? '', 'application', 200) });
        return { chain, op, method, summary: { kind: 'message', text: full, hex: '0x' + hex(utf8(full)) }, data: { full, message, nonce, address: p.address === true, application: p.application === true, chainId: p.chainId === true } };
      }
      if (op === 'tx' || op === 'send') { const t = b64(p.txB64, 'transaction', 256 * 1024); return { chain, op, method, summary: { kind: ctx.detail ? 'builtTx' : 'rawTx', hex: '0x' + hex(t.slice(0, 64)), detail: { ...(ctx.detail ?? { Note: 'Transaction bytes are shown unparsed. Only sign on sites you trust.' }), Size: `${t.length} bytes`, ...(op === 'send' ? { Action: 'Signs and submits to the network' } : {}) } }, data: { txB64: bytesToB64(t) } }; }
      return need(false, 'Unsupported Aptos method.') as never;
    }
    case 'tron': {
      if (op === 'message') { const m = typeof p.message === 'string' && p.hex !== true ? utf8(p.message) : unhex(str(p.message, 'message')); if (m.length > MAX_MSG) bad('Message too large.'); return { chain, op, method, summary: { kind: 'message', text: tryText(m) ?? undefined, hex: '0x' + hex(m) }, data: { messageB64: bytesToB64(m) } }; }
      if (op === 'tx') {
        const txID = str(p.txID, 'txID', 64).toLowerCase(); const rawHex = str(p.rawDataHex, 'rawDataHex', 200_000).toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(txID)) bad('Invalid txID.');
        if (hex(sha256(unhex(rawHex))) !== txID) bad('txID does not match the transaction data.'); // the site cannot make us sign a hash that is not the data we show
        const d = describeTron(rawHex);
        return { chain, op, method, summary: { kind: 'tronTx', types: d.contracts, detail: { ...(d.transfer ? { 'To (hex)': d.transfer.to, Amount: `${d.transfer.amount} sun` } : {}), 'Transaction ID': txID } }, data: { txID } };
      }
      return need(false, 'Unsupported Tron method.') as never;
    }
    case 'ton': return need(false, 'Use sendTransaction for TON.') as never;
    case 'btc': {
      if (op === 'message') { const m = typeof p.message === 'string' ? utf8(p.message) : bad('message must be a string.'); if (m.length > MAX_MSG) bad('Message too large.'); return { chain, op, method, summary: { kind: 'message', text: tryText(m) ?? undefined, hex: '0x' + hex(m), detail: { Standard: 'BIP-137' } }, data: { messageB64: bytesToB64(m) } }; }
      if (op === 'psbt') {
        const raw = str(p.psbt, 'psbt', 400_000); const pub = ctx.publicKey ? Uint8Array.from(ctx.publicKey.match(/../g)!.map((h) => parseInt(h, 16))) : bad('No public key for this account.');
        const psbt = decodePsbt(raw); const only = Array.isArray(p.toSignInputs) ? (p.toSignInputs as unknown[]).filter((x) => Number.isInteger(x)) as number[] : undefined;
        const plan = planPsbtSigning(psbt, pub, only); const d = describePsbt(psbt, pub, plan.inputs.map((x) => x.index));
        return { chain, op, method, summary: { kind: 'psbt', detail: { Signing: `${d.signing} of ${d.inputs} inputs`, 'Total in': d.inputSats ? `${d.inputSats} sats` : 'Unknown', Fee: d.feeSats ? `${d.feeSats} sats` : 'Unknown', ...(d.warnings.length ? { Warnings: d.warnings.join(' ') } : {}), ...Object.fromEntries(d.outputs.map((o, i) => [`To #${i + 1}`, `${o.address} — ${o.sats} sats${o.yours ? ' (your change/own address)' : ''}`])) } }, data: { psbt: raw, finalize: p.autoFinalized !== false, only: only ?? null } };
      }
      return need(false, 'Unsupported Bitcoin method.') as never;
    }
  }
}
function tryText(b: Uint8Array): string | null { try { const s = new TextDecoder('utf-8', { fatal: true }).decode(b); return /[\u0000-\u0008\u000e-\u001f]/.test(s) ? null : s; } catch { return null; } }

// ---------------------------------------------------------------- what to sign, and how to package the signature
export interface SignPlan { scheme: Scheme; data: Uint8Array; encode(sig: Uint8Array, publicKey: Uint8Array, ctx: { address: string }): unknown }
const recid = (sig: Uint8Array) => sig[64] & 1;
export function signPlan(req: MultiRequest, addr: string): SignPlan {
  const fam = MULTI_CHAINS[req.chain].family; const d = req.data;
  switch (fam) {
    case 'cosmos': {
      const doc = req.op === 'message' ? { chain_id: '', account_number: '0', sequence: '0', fee: { gas: '0', amount: [] }, msgs: [{ type: 'sigverify/MsgSignData', value: { signer: addr, data: d.dataB64 } }], memo: '' } : req.op === 'amino' ? d.doc : null;
      const bytes = doc ? aminoSignBytes(doc) : directSignBytes(b64ToBytes(d.bodyB64), b64ToBytes(d.authB64), MULTI_CHAINS[req.chain].cosmosChainId!, d.accountNumber);
      const pk = (pub: Uint8Array, sig: Uint8Array) => ({ pub_key: { type: 'tendermint/PubKeySecp256k1', value: bytesToB64(pub) }, signature: bytesToB64(sig.slice(0, 64)) });
      return { scheme: 'secp256k1', data: sha256(bytes), encode: (sig, pub) => req.op === 'direct'
        ? { signed: { bodyBytes: d.bodyB64, authInfoBytes: d.authB64, chainId: MULTI_CHAINS[req.chain].cosmosChainId, accountNumber: d.accountNumber }, signature: pk(pub, sig) }
        : { signed: doc, signature: pk(pub, sig) } };
    }
    case 'sui': {
      const intent = req.op === 'message' ? Uint8Array.of(3, 0, 0) : Uint8Array.of(0, 0, 0);
      const body = req.op === 'message' ? (() => { const m = b64ToBytes(d.messageB64); return concat(uleb(m.length), m); })() : b64ToBytes(d.txB64);
      const digest = blake2b(concat(intent, body), { dkLen: 32 });
      return { scheme: 'ed25519', data: digest, encode: (sig, pub) => { const signature = bytesToB64(concat(Uint8Array.of(0), sig, pub)); return { bytes: req.op === 'message' ? d.messageB64 : d.txB64, signature }; } };
    }
    case 'aptos': {
      if (req.op === 'message') return { scheme: 'ed25519', data: utf8(d.full), encode: (sig, _pub, c) => ({ address: c.address, application: d.application ? '' : undefined, chainId: d.chainId ? 1 : undefined, fullMessage: d.full, message: d.message, nonce: d.nonce, prefix: 'APTOS', signature: hex(sig) }) };
      return { scheme: 'ed25519', data: concat(APTOS_RAW_TX_PREFIX, b64ToBytes(d.txB64)), encode: (sig, pub) => ({ signature: hex(sig), publicKey: hex(pub), authenticator: bytesToB64(concat(Uint8Array.of(0, 32), pub, Uint8Array.of(64), sig)) }) };
    }
    case 'tron': {
      if (req.op === 'message') return { scheme: 'secp256k1', data: tronMsgDigest(b64ToBytes(d.messageB64)), encode: (sig) => hex(concat(sig.slice(0, 64), Uint8Array.of(27 + recid(sig)))) };
      return { scheme: 'secp256k1', data: unhex(d.txID), encode: (sig) => hex(concat(sig.slice(0, 64), Uint8Array.of(recid(sig)))) };
    }
    case 'ton': throw new ProviderError(ERR.INTERNAL, 'TON requests are signed by the TON backend.');
    case 'btc': if (req.op !== 'message') throw new ProviderError(ERR.INTERNAL, 'PSBTs are signed per input by the router.'); return { scheme: 'secp256k1', data: btcMsgDigest(b64ToBytes(d.messageB64)), encode: (sig) => bytesToB64(concat(Uint8Array.of(39 + recid(sig)), sig.slice(0, 64))) }; // p2wpkh header range (BIP-137)
  }
}
