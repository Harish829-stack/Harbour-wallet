// EVM signing for dApp requests, on top of viem. The private key is passed in as bytes for one operation (never as a string),
// and the caller zeroes it afterwards (HW-2026-009).
import { createPublicClient, defineChain, fallback, http, hashTypedData, keccak256, hashMessage, recoverMessageAddress, type Hex } from 'viem';
import { evmAccountFromBytes } from './evmAccount';
import type { TxRequest } from './methods';

export type SignMode = 'personal' | 'rawHash';
/** personal_sign / eth_sign. `personal` applies the EIP-191 prefix; `rawHash` signs a 32-byte digest as-is (legacy eth_sign on non-text data). */
export async function evmSignMessage(pk: Uint8Array, bytesHex: string, mode: SignMode): Promise<Hex> {
  const account = evmAccountFromBytes(pk);
  if (mode === 'rawHash') { if (!/^0x[0-9a-fA-F]{64}$/.test(bytesHex)) throw new Error('A raw signature needs exactly 32 bytes.'); return account.sign!({ hash: bytesHex as Hex }); }
  return account.signMessage({ message: { raw: bytesHex as Hex } });
}
export async function evmRecover(bytesHex: string, signature: string): Promise<string> { return recoverMessageAddress({ message: { raw: bytesHex as Hex }, signature: signature as Hex }); }
export const personalMessageHash = (bytesHex: string): Hex => hashMessage({ raw: bytesHex as Hex });
export const sha3 = (bytesHex: string): Hex => keccak256(bytesHex as Hex);

export interface TypedDataLike { types: Record<string, Array<{ name: string; type: string }>>; primaryType: string; domain: Record<string, any>; message: Record<string, any> }
export async function evmSignTypedData(pk: Uint8Array, td: TypedDataLike): Promise<Hex> {
  const account = evmAccountFromBytes(pk);
  return account.signTypedData(td as any);
}
export const typedDataDigest = (td: TypedDataLike): Hex => hashTypedData(td as any);

export interface SendOptions { urls: string[]; chainId: number; name: string; symbol: string; timeoutMs?: number; gas?: bigint; fee?: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint } }
const big = (h?: string): bigint | undefined => (h === undefined ? undefined : BigInt(h));
/** Prepare (gas, fees, nonce from the node), sign locally and broadcast with eth_sendRawTransaction. Returns the transaction hash. */
export async function evmSendTransaction(pk: Uint8Array, tx: TxRequest, o: SendOptions): Promise<Hex> {
  const account = evmAccountFromBytes(pk);
  const chain = defineChain({ id: o.chainId, name: o.name, nativeCurrency: { name: o.symbol, symbol: o.symbol, decimals: 18 }, rpcUrls: { default: { http: o.urls } } });
  const client = createPublicClient({ chain, transport: fallback(o.urls.map((u) => http(u, { timeout: o.timeoutMs ?? 15_000, retryCount: 0 }))) });
  const fee = { ...(o.fee ?? {}) };
  const legacy = fee.gasPrice !== undefined || tx.gasPrice !== undefined || tx.type === '0x0';
  const req: Record<string, unknown> = { account, to: tx.to as Hex | undefined, value: BigInt(tx.value), data: tx.data as Hex, chain };
  const gas = o.gas ?? big(tx.gas); if (gas !== undefined) req.gas = gas;
  if (tx.nonce !== undefined) req.nonce = Number(BigInt(tx.nonce));
  if (legacy) { req.type = 'legacy'; req.gasPrice = fee.gasPrice ?? big(tx.gasPrice); }
  else { req.type = 'eip1559'; const mf = fee.maxFeePerGas ?? big(tx.maxFeePerGas), mp = fee.maxPriorityFeePerGas ?? big(tx.maxPriorityFeePerGas); if (mf !== undefined) req.maxFeePerGas = mf; if (mp !== undefined) req.maxPriorityFeePerGas = mp; }
  const prepared: any = await client.prepareTransactionRequest(req as any);
  const { from: _from, ...rest } = prepared;
  const serialized = await account.signTransaction({ ...rest, chainId: o.chainId });
  return client.sendRawTransaction({ serializedTransaction: serialized });
}
