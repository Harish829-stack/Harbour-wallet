import { sha256 } from '@noble/hashes/sha256';

/** TON Connect ton_proof signing input: sha256(0xffff || "ton-connect" || sha256(message)), message per the TON Connect spec. */
export function tonProofHash(p: { workchain: number; addressHash: Uint8Array; domain: string; timestamp: number; payload: string }): Uint8Array {
  const te = new TextEncoder(); const dom = te.encode(p.domain); const pay = te.encode(p.payload);
  const wc = new Uint8Array(4); new DataView(wc.buffer).setInt32(0, p.workchain, false);
  const dl = new Uint8Array(4); new DataView(dl.buffer).setUint32(0, dom.length, true);
  const ts = new Uint8Array(8); new DataView(ts.buffer).setBigUint64(0, BigInt(p.timestamp), true);
  const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let q = 0; for (const x of a) { o.set(x, q); q += x.length; } return o; };
  const message = cat(te.encode('ton-proof-item-v2/'), wc, p.addressHash, dl, dom, ts, pay);
  return sha256(cat(Uint8Array.of(0xff, 0xff), te.encode('ton-connect'), sha256(message)));
}
