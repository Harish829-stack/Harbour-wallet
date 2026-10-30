// HW-2026-009 (CCSS B-08): EVM signing from private-key BYTES. viem's privateKeyToAccount needs the key as a hex string,
// which JS cannot wipe. These helpers keep the key in a Uint8Array that the caller zeroes after the operation
// (ActiveKeys/ConnKeys.dispose()), and sign with @noble/curves (the same RFC 6979, low-S signer viem uses internally).
import { secp256k1 } from '@noble/curves/secp256k1';
import { toAccount, publicKeyToAddress } from 'viem/accounts';
import { hashMessage, hashTypedData, hexToBytes, keccak256, serializeSignature, serializeTransaction, numberToHex, bytesToHex, type Hex, type LocalAccount, type Signature } from 'viem';

export function signHash(hash: Hex, pk: Uint8Array): Signature {
  if (!(pk instanceof Uint8Array) || pk.length !== 32) throw new Error('Invalid signing key.');
  const sig = secp256k1.sign(hexToBytes(hash), pk, { lowS: true });
  return { r: numberToHex(sig.r, { size: 32 }), s: numberToHex(sig.s, { size: 32 }), v: sig.recovery ? 28n : 27n, yParity: sig.recovery };
}

/** A viem LocalAccount whose key never becomes a string. The account is only valid until `pk` is zeroed. */
export function evmAccountFromBytes(pk: Uint8Array): LocalAccount {
  const publicKey = bytesToHex(secp256k1.getPublicKey(pk, false));
  const address = publicKeyToAddress(publicKey);
  const sign = async ({ hash }: { hash: Hex }) => serializeSignature(signHash(hash, pk));
  const acct = toAccount({
    address,
    sign,
    signMessage: async ({ message }: { message: any }) => sign({ hash: hashMessage(message) }),
    signTypedData: async (td: any) => sign({ hash: hashTypedData(td) }),
    signTransaction: async (tx: any, opts?: { serializer?: (t: any, s?: Signature) => Hex }) => {
      const ser = opts?.serializer ?? (serializeTransaction as any);
      const signable = tx.type === 'eip4844' ? { ...tx, sidecars: false } : tx;
      return ser(tx, signHash(keccak256(ser(signable)), pk));
    },
  } as any);
  return { ...acct, publicKey, source: 'privateKey' } as LocalAccount;
}

export const zero = (...bufs: Uint8Array[]) => { for (const b of bufs) { try { b.fill(0); } catch { /* detached */ } } };
