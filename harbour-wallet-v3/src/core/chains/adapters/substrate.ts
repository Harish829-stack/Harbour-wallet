// Polkadot / Kusama native balance via public JSON-RPC state_getStorage(System.Account).
// Since the Asset Hub migration (Polkadot Nov 2025, Kusama Oct 2025) account balances live on Asset Hub, NOT on the relay chain
// (wallet-core's explorer entries already point at assethub-*.subscan.io). The relay endpoints in the registry are deliberately not
// used as a fallback: they would answer a stale 0 for a funded account.
import { blake2b } from '@noble/hashes/blake2b';
import { simple, rpc } from './net';
import { base58Decode, bytesToHex, hexToBytes } from './codec';

export const ASSET_HUB_RPC: Record<string, string[]> = {
  polkadot: ['https://polkadot-asset-hub-rpc.polkadot.io', 'https://asset-hub-polkadot-rpc.dwellir.com'],
  kusama: ['https://kusama-asset-hub-rpc.polkadot.io', 'https://asset-hub-kusama-rpc.dwellir.com'],
};
// twox128("System") ++ twox128("Account") — constant, so no xxhash implementation is needed.
const SYSTEM_ACCOUNT_PREFIX = '26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9';

/** SS58 (single-byte network prefix) -> 32-byte public key; verifies the checksum. */
export function ss58Decode(addr: string): Uint8Array {
  const raw = base58Decode(addr);
  if (raw.length !== 35 || raw[0] >= 64) throw new Error('unsupported SS58 address');
  const body = raw.slice(0, 33);
  const pre = new Uint8Array(7 + 33); pre.set(new TextEncoder().encode('SS58PRE')); pre.set(body, 7);
  const h = blake2b(pre, { dkLen: 64 });
  if (h[0] !== raw[33] || h[1] !== raw[34]) throw new Error('bad SS58 checksum');
  return body.slice(1);
}
export function systemAccountKey(addr: string): string {
  const pk = ss58Decode(addr);
  return '0x' + SYSTEM_ACCOUNT_PREFIX + bytesToHex(blake2b(pk, { dkLen: 16 })) + bytesToHex(pk);
}
const le = (b: Uint8Array): bigint => { let n = 0n; for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]); return n; };
/** SCALE AccountInfo { nonce, consumers, providers, sufficients: u32; data: { free, reserved, frozen: u128, flags } } -> free balance. */
export function decodeFree(hex: string): bigint {
  const b = hexToBytes(hex);
  if (b.length < 32) throw new Error('bad AccountInfo');
  return le(b.slice(16, 32));
}
import type { BalanceAdapter } from './types';
import { fail } from './types';
const viaHubs = (hubs: string[]): BalanceAdapter => simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'state_getStorage', [systemAccountKey(a)]);
  if (r.error) throw new Error(r.error.message ?? 'RPC error');
  if (r.result == null) return 0n; // no System.Account entry => account does not exist yet
  if (typeof r.result !== 'string') throw new Error('bad response');
  return decodeFree(r.result);
}, { only: hubs });
/** Asset Hub endpoints are chosen by chain id (the registry only lists the relay chain). */
export const substrateAdapter: BalanceAdapter = (chain, address, f) => {
  const hubs = ASSET_HUB_RPC[chain.id];
  return hubs ? viaHubs(hubs)(chain, address, f) : Promise.resolve(fail('unsupported: no Asset Hub endpoint for ' + chain.id));
};
