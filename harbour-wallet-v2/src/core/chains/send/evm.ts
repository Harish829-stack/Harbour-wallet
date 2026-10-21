// EVM family: native + ERC-20 transfers, EIP-1559 (type 2) with legacy fallback, nonce from the pending pool.
// All JSON-RPC calls go through the injected fetch (viem is used only for encoding/signing), so everything is mockable.
// TW evidence: edit-fee-eip1559.{slow,default,fast}, send.low-gas-warning, send.confirmation.risk.smart-contract, send-tx.nonce-warning.
import { privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, keccak256, getAddress, isAddress, serializeTransaction, type Hex } from 'viem';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendParams, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, bech32Bytes, bytesToHex, fundsIssues, issue, rpc, firstOf, scale, sub0 } from './util';
import { rpcUrl } from '../../rpc';

const ERC20_TRANSFER = [{ type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const;
const OP_STACK = new Set([10, 8453, 81457, 7777777, 34443]);
const GAS_PRICE_ORACLE = '0x420000000000000000000000000000000000000F';

export const evmRpcs = (chain: ChainInfo): string[] => {
  const o = chain.evmChainId ? (() => { try { return rpcUrl(chain.evmChainId!); } catch { return undefined; } })() : undefined;
  return Array.from(new Set([...(o ? [o] : []), ...(chain.rpcs ?? [])]));
};
const call = (env: SendEnv, chain: ChainInfo, method: string, params: unknown[] = []) => firstOf(evmRpcs(chain), (u) => rpc(env.fetch, u, method, params));
const big = (h: any): bigint => (h == null || h === '0x' ? 0n : BigInt(h));
export const validEvmAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a ?? '') && isAddress(a, { strict: false });

export function evmTransferData(to: string, amount: bigint): Hex { return encodeFunctionData({ abi: ERC20_TRANSFER, functionName: 'transfer', args: [getAddress(to.toLowerCase()), amount] }); }
const balanceOfData = (owner: string): Hex => ('0x70a08231' + owner.replace(/^0x/, '').toLowerCase().padStart(64, '0')) as Hex;

interface Ctx { nonce: number; gas: bigint; legacy: boolean; base: bigint; prio: Record<FeeTierId, bigint>; gasPrice: bigint; l1Fee: bigint; data?: Hex; value: bigint; toAddr: string }
export type { Ctx as EvmCtx };
const TIER_MULT: Record<FeeTierId, number> = { slow: 1.125, average: 1.5, fast: 2 };
const LEGACY_MULT: Record<FeeTierId, number> = { slow: 0.9, average: 1, fast: 1.3 };

async function l1Fee(env: SendEnv, chain: ChainInfo, tx: any): Promise<bigint> {
  if (!chain.evmChainId || !OP_STACK.has(chain.evmChainId)) return 0n;
  try {
    const ser = serializeTransaction({ type: 'eip1559', chainId: chain.evmChainId, nonce: 0, gas: 100000n, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n, to: tx.to, value: tx.value, data: tx.data });
    const data = encodeFunctionData({ abi: [{ type: 'function', name: 'getL1Fee', stateMutability: 'view', inputs: [{ name: '_data', type: 'bytes' }], outputs: [{ type: 'uint256' }] }] as const, functionName: 'getL1Fee', args: [ser] });
    return big(await call(env, chain, 'eth_call', [{ to: GAS_PRICE_ORACLE, data }, 'latest']));
  } catch { return 0n; }
}

export interface EvmTxInput { to: string; value: bigint; data?: Hex }
export interface EvmPrepared { ctx: Ctx; nativeBalance: bigint; estimateError?: string; recipientCode: string }
/** Nonce, gas estimate and fee market for an arbitrary call (shared by sends and NFT transfers). `fallbackGas` is used when estimateGas reverts. */
export async function prepareEvm(env: SendEnv, chain: ChainInfo, from: string, tx: EvmTxInput, fallbackGas: bigint, codeOf?: string): Promise<EvmPrepared> {
  const toHex = (v: bigint) => '0x' + v.toString(16);
  const callObj = { from, to: tx.to, ...(tx.data ? { data: tx.data } : {}), value: toHex(tx.value) };
  const [balHex, nonceHex, code, block] = await Promise.all([
    call(env, chain, 'eth_getBalance', [from, 'latest']), call(env, chain, 'eth_getTransactionCount', [from, 'pending']),
    codeOf ? call(env, chain, 'eth_getCode', [codeOf, 'latest']).catch(() => '0x') : Promise.resolve('0x'),
    call(env, chain, 'eth_getBlockByNumber', ['latest', false]).catch(() => null),
  ]);
  let gas = 0n; let estimateError: string | undefined;
  try { gas = big(await call(env, chain, 'eth_estimateGas', [callObj])); }
  catch (e: any) { gas = fallbackGas; estimateError = e?.message ? `Couldn't estimate the network fee: ${String(e.message).slice(0, 120)}` : MSG.simulationNetwork; }
  const base = block?.baseFeePerGas ? big(block.baseFeePerGas) : 0n; const legacy = !block?.baseFeePerGas;
  const prio: Record<FeeTierId, bigint> = { slow: 0n, average: 0n, fast: 0n }; let gasPrice = 0n;
  if (legacy) gasPrice = big(await call(env, chain, 'eth_gasPrice', []));
  else {
    let rewards: bigint[][] = [];
    try { const fh = await call(env, chain, 'eth_feeHistory', ['0x5', 'latest', [10, 50, 90]]); rewards = (fh?.reward ?? []).map((r: string[]) => r.map(big)); } catch { /* fall back below */ }
    const avg = (i: number) => (rewards.length ? rewards.reduce((s, r) => s + (r[i] ?? 0n), 0n) / BigInt(rewards.length) : 0n);
    let [sl, m, f] = [avg(0), avg(1), avg(2)];
    if (m === 0n && f === 0n) { try { m = big(await call(env, chain, 'eth_maxPriorityFeePerGas', [])); sl = m; f = m * 2n; } catch { /* leave zero (some L2s accept 0) */ } }
    prio.slow = sl; prio.average = m > sl ? m : sl; prio.fast = f > prio.average ? f : prio.average;
  }
  const l1 = await l1Fee(env, chain, tx);
  return { ctx: { nonce: Number(big(nonceHex)), gas, legacy, base, prio, gasPrice, l1Fee: l1, data: tx.data, value: tx.value, toAddr: tx.to }, nativeBalance: big(balHex), estimateError, recipientCode: code };
}
export const evmTierFees = (c: Ctx, id: FeeTierId) => {
  const maxPer = c.legacy ? scale(c.gasPrice, LEGACY_MULT[id]) : scale(c.base, TIER_MULT[id]) + c.prio[id];
  const expPer = c.legacy ? maxPer : c.base + c.prio[id];
  return { fee: c.gas * expPer + c.l1Fee, feeMax: c.gas * maxPer + c.l1Fee, maxPer, detail: `${(() => { const g = Number(maxPer) / 1e9; return g >= 1 ? g.toFixed(2) : g.toPrecision(2); })()} gwei` };
};
/** Sign a transaction with the prepared nonce / fee market. */
/** The unsigned transaction object (viem shape) a tier produces; shared by local signing and hardware (Ledger) signing. */
export function evmTxRequest(chain: ChainInfo, c: Ctx, tier: FeeTierId, tx: { to: string; value: bigint; data?: Hex; gas: bigint }): any {
  if (!chain.evmChainId) throw new Error('Missing chain id');
  const t: any = { chainId: chain.evmChainId, nonce: c.nonce, gas: tx.gas, to: getAddress(tx.to.toLowerCase()), value: tx.value, ...(tx.data ? { data: tx.data } : {}) };
  if (c.legacy) { t.type = 'legacy'; t.gasPrice = scale(c.gasPrice, LEGACY_MULT[tier]); }
  else { t.type = 'eip1559'; t.maxPriorityFeePerGas = c.prio[tier]; t.maxFeePerGas = scale(c.base, TIER_MULT[tier]) + c.prio[tier]; }
  return t;
}
/** Transfer call for a send (native value or ERC-20 transfer), with the same gas rule as build(). */
export function evmSendCall(p: SendParams, q: SendQuote, tier: FeeTierId): { to: string; value: bigint; data?: Hex; gas: bigint } {
  const c: Ctx = q.ctx; const isToken = p.asset.kind === 'token'; const to = getAddress(p.to.toLowerCase());
  const t = q.tiers.find((x) => x.id === tier) ?? q.tiers[1];
  const gas = c.gas === 21000n && !isToken && !q.recipientIsContract ? 21000n : (c.gas * 12n) / 10n;
  const amount = p.isMax ? t.max : p.amount;
  return isToken ? { to: p.asset.contract!, value: 0n, data: evmTransferData(to, amount), gas } : { to, value: amount, gas };
}
export async function signEvmTx(chain: ChainInfo, key: Uint8Array, from: string, c: Ctx, tier: FeeTierId, tx: { to: string; value: bigint; data?: Hex; gas: bigint }): Promise<BuiltTx> {
  const account = privateKeyToAccount(('0x' + bytesToHex(key)) as Hex);
  if (account.address.toLowerCase() !== from.toLowerCase()) throw new Error('Signing key does not match the account address');
  const t = evmTxRequest(chain, c, tier, tx);
  const raw = await account.signTransaction(t);
  return { raw, hash: keccak256(raw), meta: { nonce: c.nonce, to: t.to, value: t.value.toString(), data: t.data ?? '0x', gas: tx.gas.toString(), type: t.type, maxFeePerGas: t.maxFeePerGas?.toString(), maxPriorityFeePerGas: t.maxPriorityFeePerGas?.toString(), gasPrice: t.gasPrice?.toString() } };
}
export const broadcastEvm = async (env: SendEnv, chain: ChainInfo, raw: string) => String(await firstOf(evmRpcs(chain), (u) => rpc(env.fetch, u, 'eth_sendRawTransaction', [raw])));
export async function statusEvm(env: SendEnv, chain: ChainInfo, hash: string): Promise<TxStatus> {
  const [rc, tx] = await Promise.all([call(env, chain, 'eth_getTransactionReceipt', [hash]).catch(() => null), call(env, chain, 'eth_getTransactionByHash', [hash]).catch(() => null)]);
  if (!tx && !rc) return { state: 'unknown' };
  if (!rc) return { state: 'pending', from: tx?.from, to: tx?.to, value: tx?.value ? big(tx.value).toString() : undefined };
  let conf: number | undefined; try { conf = Number(big(await call(env, chain, 'eth_blockNumber', []))) - Number(big(rc.blockNumber)) + 1; } catch { /* optional */ }
  const fee = rc.gasUsed && (rc.effectiveGasPrice || tx?.gasPrice) ? (big(rc.gasUsed) * big(rc.effectiveGasPrice ?? tx.gasPrice)).toString() : undefined;
  return { state: rc.status === '0x1' ? 'confirmed' : 'failed', block: String(Number(big(rc.blockNumber))), confirmations: conf, fee, from: rc.from, to: rc.to ?? tx?.to, value: tx?.value ? big(tx.value).toString() : undefined, error: rc.status === '0x1' ? undefined : 'Transaction reverted' };
}

export const evmFamily: SendFamily = {
  kinds: ['evm'], memo: 'none', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const isToken = p.asset.kind === 'token';
    if (!validEvmAddress(p.to)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const from = p.from; const to = getAddress(p.to.toLowerCase()); const amt = p.amount > 0n ? p.amount : 1n;
    const tx: EvmTxInput = isToken ? { to: getAddress(p.asset.contract!.toLowerCase()), data: evmTransferData(to, amt), value: 0n } : { to, value: amt };
    const [prep, tokHex] = await Promise.all([prepareEvm(env, chain, from, tx, isToken ? 100_000n : 21_000n, to),
      isToken ? call(env, chain, 'eth_call', [{ to: tx.to, data: balanceOfData(from) }, 'latest']).catch(() => '0x') : Promise.resolve('0x0')]);
    const nativeBalance = prep.nativeBalance; const assetBalance = isToken ? big(tokHex) : nativeBalance; const issues = [];
    if (prep.estimateError) issues.push(issue('estimate-failed', prep.estimateError, false));
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => { const t = evmTierFees(prep.ctx, id); return { id, fee: t.fee, feeMax: t.feeMax, max: isToken ? assetBalance : sub0(nativeBalance, t.feeMax), detail: t.detail }; });
    issues.push(...fundsIssues({ amount: p.amount, isToken, assetBalance, nativeBalance, fee: tiers[1].feeMax! }));
    const isContract = !!prep.recipientCode && prep.recipientCode !== '0x';
    if (isContract) issues.push(issue('smart-contract', MSG.smartContract, false));
    if (from.toLowerCase() === to.toLowerCase()) issues.push(issue('self-send', 'You are sending to your own address.', false));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: nativeBalance.toString(), assetBalance: assetBalance.toString(), issues, recipientIsContract: isContract, ctx: prep.ctx };
  },
  async build(_env, p, key, q, tier): Promise<BuiltTx> {
    return signEvmTx(p.chain, key, p.from, q.ctx, tier, evmSendCall(p, q, tier));
  },
  broadcast: (env, chain, tx) => broadcastEvm(env, chain, tx.raw),
  status: (env, chain, hash) => statusEvm(env, chain, hash),
};

/** IoTeX native (io1...) accepts Ethereum-format transactions on its web3 gateway: same secp256k1 key / 20-byte address, chain id 4689. */
export const iotexFamily: SendFamily = {
  ...evmFamily, kinds: ['iotex'], tokens: false,
  async quote(env, p) { return evmFamily.quote(env, toEvmView(env, p)); },
  async build(env, p, key, q, tier) {
    const view = toEvmView(env, p);
    const a = privateKeyToAccount(('0x' + bytesToHex(key)) as Hex);
    return evmFamily.build(env, { ...view, from: a.address }, key, q, tier);
  },
};
function toEvmView(_env: SendEnv, p: SendParams): SendParams {
  const hex = (addr: string) => (addr.startsWith('0x') ? addr : '0x' + bytesToHex(bech32Bytes(addr)));
  const chain: ChainInfo = { ...p.chain, evmChainId: 4689, rpcs: ['https://babel-api.mainnet.iotex.io'] };
  return { ...p, chain, from: hex(p.from), to: hex(p.to) };
}
